import "server-only";
import {
  NO_USAGE,
  ProviderError,
  errorDetail,
  providerFailure,
  sseRecords,
  type ModelEvent,
  type ModelMessage,
  type ModelProvider,
  type ModelRequest,
  type Usage,
} from "./types";

/**
 * Claude through Anthropic's Messages API, streamed. The briefing and the tool list are marked
 * for prompt caching, and so is the end of the conversation each step, so the steps of one turn
 * (and the next turn, within the cache's lifetime) reuse what was already read.
 */

const CACHE = { type: "ephemeral" } as const;

type Block =
  | { type: "text"; text: string; cache_control?: typeof CACHE }
  | { type: "tool_use"; id: string; name: string; input: unknown; cache_control?: typeof CACHE }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
      cache_control?: typeof CACHE;
    };

interface WireMessage {
  role: "user" | "assistant";
  content: Block[];
}

/** Our messages as Anthropic's: tool results go back as a user message. */
export function toAnthropicMessages(messages: readonly ModelMessage[]): WireMessage[] {
  const out: WireMessage[] = [];
  for (const message of messages) {
    let wire: WireMessage;
    if (message.role === "user")
      wire = { role: "user", content: [{ type: "text", text: message.text }] };
    else if (message.role === "assistant") {
      const content: Block[] = [];
      if (message.text.trim() !== "") content.push({ type: "text", text: message.text });
      for (const call of message.calls)
        content.push({ type: "tool_use", id: call.id, name: call.name, input: call.input ?? {} });
      if (content.length === 0) content.push({ type: "text", text: "…" });
      wire = { role: "assistant", content };
    } else {
      wire = {
        role: "user",
        content: message.results.map((r) => ({
          type: "tool_result",
          tool_use_id: r.id,
          content: r.content,
          ...(r.isError ? { is_error: true } : {}),
        })),
      };
    }
    // Two in a row from the same side are merged (the API wants them to alternate).
    const last = out.at(-1);
    if (last !== undefined && last.role === wire.role) last.content.push(...wire.content);
    else out.push(wire);
  }
  // The conversation so far is cached up to its last block.
  const lastBlock = out.at(-1)?.content.at(-1);
  if (lastBlock !== undefined) lastBlock.cache_control = CACHE;
  return out;
}

export function anthropicRequest(request: ModelRequest): Record<string, unknown> {
  return {
    model: request.model,
    max_tokens: request.maxTokens,
    stream: true,
    system: [{ type: "text", text: request.system, cache_control: CACHE }],
    tools: request.tools.map((tool, index) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
      ...(index === request.tools.length - 1 ? { cache_control: CACHE } : {}),
    })),
    messages: toAnthropicMessages(request.messages),
  };
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

export function anthropicProvider(options: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
}): ModelProvider {
  const send = options.fetch ?? fetch;
  return {
    async *stream(request) {
      let response: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        response = await send(`${options.baseUrl.replace(/\/$/, "")}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": options.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(anthropicRequest(request)),
          signal: request.signal,
        });
        if (response.ok) break;
        const failure = providerFailure(response.status, await errorDetail(response));
        if (!failure.retryable || attempt === 2) throw failure;
        await wait(1000 * 3 ** attempt, request.signal);
      }
      if (response?.body == null)
        throw new ProviderError("The model provider sent nothing back.", true);
      yield* parseAnthropicStream(response.body);
    },
  };
}

/** Anthropic's stream events as ours (exported for tests). */
export async function* parseAnthropicStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ModelEvent> {
  let usage: Usage = NO_USAGE;
  let stop: "end" | "tools" | "length" = "end";
  const tools = new Map<number, { id: string; name: string; json: string }>();
  for await (const record of sseRecords(body)) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(record.data) as Record<string, unknown>;
    } catch {
      continue;
    }
    switch (data.type) {
      case "message_start": {
        const u = (data.message as { usage?: Record<string, number> } | undefined)?.usage ?? {};
        usage = {
          input: u.input_tokens ?? 0,
          output: u.output_tokens ?? 0,
          cacheRead: u.cache_read_input_tokens ?? 0,
          cacheWrite: u.cache_creation_input_tokens ?? 0,
        };
        break;
      }
      case "content_block_start": {
        const block = data.content_block as
          { type?: string; id?: string; name?: string } | undefined;
        if (block?.type === "tool_use")
          tools.set(Number(data.index), { id: block.id ?? "", name: block.name ?? "", json: "" });
        break;
      }
      case "content_block_delta": {
        const delta = data.delta as
          { type?: string; text?: string; partial_json?: string } | undefined;
        if (delta?.type === "text_delta" && delta.text !== undefined)
          yield { type: "text", text: delta.text };
        else if (delta?.type === "input_json_delta") {
          const tool = tools.get(Number(data.index));
          if (tool !== undefined) tool.json += delta.partial_json ?? "";
        }
        break;
      }
      case "content_block_stop": {
        const tool = tools.get(Number(data.index));
        if (tool !== undefined) {
          tools.delete(Number(data.index));
          let input: unknown = {};
          try {
            input = tool.json.trim() === "" ? {} : JSON.parse(tool.json);
          } catch {
            input = { _unreadable: tool.json.slice(0, 200) };
          }
          yield { type: "call", id: tool.id, name: tool.name, input };
        }
        break;
      }
      case "message_delta": {
        const reason = (data.delta as { stop_reason?: string } | undefined)?.stop_reason;
        stop = reason === "tool_use" ? "tools" : reason === "max_tokens" ? "length" : "end";
        const output = (data.usage as { output_tokens?: number } | undefined)?.output_tokens;
        if (output !== undefined) usage = { ...usage, output };
        break;
      }
      case "error": {
        const error = data.error as { type?: string; message?: string } | undefined;
        throw new ProviderError(
          error?.type === "overloaded_error"
            ? "The model provider is overloaded. Try again in a minute."
            : `The model stopped with an error${error?.message === undefined ? "." : `: ${error.message}`}`,
          error?.type === "overloaded_error",
        );
      }
      default:
        break;
    }
  }
  yield { type: "end", stop, usage };
}
