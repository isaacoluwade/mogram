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
 * Any API shaped like OpenAI's Chat Completions, streamed: DeepSeek, OpenAI, and the many hosts
 * that copy it. Their caching is automatic (on a repeated prefix), so the briefing goes first and
 * never changes.
 */

type WireMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export function toOpenAiMessages(system: string, messages: readonly ModelMessage[]): WireMessage[] {
  const out: WireMessage[] = [{ role: "system", content: system }];
  for (const message of messages) {
    if (message.role === "user") out.push({ role: "user", content: message.text });
    else if (message.role === "assistant")
      out.push({
        role: "assistant",
        content: message.text.trim() === "" ? null : message.text,
        ...(message.calls.length > 0
          ? {
              tool_calls: message.calls.map((call) => ({
                id: call.id,
                type: "function" as const,
                function: { name: call.name, arguments: JSON.stringify(call.input ?? {}) },
              })),
            }
          : {}),
      });
    else
      for (const result of message.results)
        out.push({
          role: "tool",
          tool_call_id: result.id,
          content: result.isError ? `Error: ${result.content}` : result.content,
        });
  }
  return out;
}

export function openAiRequest(request: ModelRequest): Record<string, unknown> {
  return {
    model: request.model,
    max_tokens: request.maxTokens,
    stream: true,
    stream_options: { include_usage: true },
    messages: toOpenAiMessages(request.system, request.messages),
    tools: request.tools.map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
    })),
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

export function openAiProvider(options: {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
}): ModelProvider {
  const send = options.fetch ?? fetch;
  return {
    async *stream(request) {
      let response: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        response = await send(`${options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${options.apiKey}`,
          },
          body: JSON.stringify(openAiRequest(request)),
          signal: request.signal,
        });
        if (response.ok) break;
        const failure = providerFailure(response.status, await errorDetail(response));
        if (!failure.retryable || attempt === 2) throw failure;
        await wait(1000 * 3 ** attempt, request.signal);
      }
      if (response?.body == null)
        throw new ProviderError("The model provider sent nothing back.", true);
      yield* parseOpenAiStream(response.body);
    },
  };
}

interface Chunk {
  choices?: {
    delta?: {
      content?: string | null;
      tool_calls?: {
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string | null;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  } | null;
  error?: { message?: string };
}

/** OpenAI-style stream chunks as our events (exported for tests). */
export async function* parseOpenAiStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ModelEvent> {
  let usage: Usage = NO_USAGE;
  let stop: "end" | "tools" | "length" = "end";
  const calls = new Map<number, { id: string; name: string; args: string }>();
  for await (const record of sseRecords(body)) {
    if (record.data.trim() === "[DONE]") break;
    let chunk: Chunk;
    try {
      chunk = JSON.parse(record.data) as Chunk;
    } catch {
      continue;
    }
    if (chunk.error !== undefined)
      throw new ProviderError(
        `The model stopped with an error${chunk.error.message === undefined ? "." : `: ${chunk.error.message}`}`,
        false,
      );
    for (const choice of chunk.choices ?? []) {
      const delta = choice.delta;
      if (typeof delta?.content === "string" && delta.content !== "")
        yield { type: "text", text: delta.content };
      for (const part of delta?.tool_calls ?? []) {
        const index = part.index ?? 0;
        const call = calls.get(index) ?? { id: "", name: "", args: "" };
        if (part.id !== undefined) call.id = part.id;
        if (part.function?.name !== undefined) call.name += part.function.name;
        if (part.function?.arguments !== undefined) call.args += part.function.arguments;
        calls.set(index, call);
      }
      if (choice.finish_reason === "tool_calls") stop = "tools";
      else if (choice.finish_reason === "length") stop = "length";
    }
    if (chunk.usage != null) {
      const cached =
        chunk.usage.prompt_cache_hit_tokens ??
        chunk.usage.prompt_tokens_details?.cached_tokens ??
        0;
      usage = {
        input: Math.max(0, (chunk.usage.prompt_tokens ?? 0) - cached),
        output: chunk.usage.completion_tokens ?? 0,
        cacheRead: cached,
        cacheWrite: 0,
      };
    }
  }
  for (const [index, call] of [...calls.entries()].sort((a, b) => a[0] - b[0])) {
    let input: unknown = {};
    try {
      input = call.args.trim() === "" ? {} : JSON.parse(call.args);
    } catch {
      input = { _unreadable: call.args.slice(0, 200) };
    }
    yield { type: "call", id: call.id === "" ? `call_${index}` : call.id, name: call.name, input };
  }
  if (calls.size > 0) stop = "tools";
  yield { type: "end", stop, usage };
}
