import "server-only";
import type { ToolSpec } from "@/lib/ai/tools";

/**
 * One shape for every model provider (A3): a conversation of user text, assistant text with tool
 * calls, and tool results; streamed back as text, tool calls and an end with token counts.
 */

export interface ModelToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

export interface ModelToolResult {
  readonly id: string;
  readonly content: string;
  readonly isError: boolean;
}

export type ModelMessage =
  | { readonly role: "user"; readonly text: string }
  | {
      readonly role: "assistant";
      readonly text: string;
      readonly calls: readonly ModelToolCall[];
    }
  | { readonly role: "tool"; readonly results: readonly ModelToolResult[] };

export interface ModelRequest {
  readonly model: string;
  /** The briefing: the same every turn, so providers can cache it. */
  readonly system: string;
  readonly messages: readonly ModelMessage[];
  readonly tools: readonly ToolSpec[];
  readonly maxTokens: number;
  readonly signal: AbortSignal;
}

export interface Usage {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
}

export const NO_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export const addUsage = (a: Usage, b: Usage): Usage => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite: a.cacheWrite + b.cacheWrite,
});

export type ModelEvent =
  | { readonly type: "text"; readonly text: string }
  | ({ readonly type: "call" } & ModelToolCall)
  | {
      readonly type: "end";
      /** "length" when the answer was cut off at the token limit. */
      readonly stop: "end" | "tools" | "length";
      readonly usage: Usage;
    };

export interface ModelProvider {
  stream(request: ModelRequest): AsyncIterable<ModelEvent>;
}

/** A provider refused or failed; the message is safe to show (no keys, no raw bodies). */
export class ProviderError extends Error {
  override readonly name = "ProviderError";
  constructor(
    message: string,
    /** Worth trying again shortly (rate limited, overloaded). */
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** Plain words for an HTTP failure from a model API. */
export function providerFailure(status: number, detail: string | null): ProviderError {
  if (status === 401 || status === 403)
    return new ProviderError(
      "The assistant's API key was refused. Check the server's settings.",
      false,
    );
  if (status === 429)
    return new ProviderError(
      "The model provider is rate limiting requests. Try again in a minute.",
      true,
    );
  if (status === 529 || status === 503 || status === 502)
    return new ProviderError("The model provider is overloaded. Try again in a minute.", true);
  if (status === 400)
    return new ProviderError(
      `The model provider refused the request${detail === null ? "." : `: ${detail}`}`,
      false,
    );
  return new ProviderError(`The model provider failed (${status}). Try again.`, status >= 500);
}

/**
 * Server-sent events from a fetch response, as `{ event, data }` (the event name is "" when the
 * stream doesn't name events, as OpenAI-style APIs don't).
 */
export async function* sseRecords(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ readonly event: string; readonly data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    buffer = buffer.replace(/\r\n/g, "\n");
    let end = buffer.indexOf("\n\n");
    while (end >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = "";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length > 0) yield { event, data: data.join("\n") };
      end = buffer.indexOf("\n\n");
    }
    if (done) return;
  }
}

/** Reads an error body's message without trusting its shape. */
export async function errorDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null) return null;
    const error = (body as { error?: unknown }).error;
    if (typeof error === "object" && error !== null && "message" in error)
      return String((error as { message: unknown }).message).slice(0, 300);
    return null;
  } catch {
    return null;
  }
}
