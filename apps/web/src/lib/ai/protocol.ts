import { z } from "zod";

/**
 * The assistant's wire protocol (docs/plans/ai-and-history.md, A3/A4): what the browser sends for
 * one turn, and the events the server streams back while the model works. Shared by the route
 * and the panel so both sides agree on every shape.
 */

/** Which model answers: chosen per turn (Auto), or the fast or strong one. */
export const MODEL_CHOICES = ["auto", "fast", "strong"] as const;
export type ModelChoice = (typeof MODEL_CHOICES)[number];
export type ModelTier = "fast" | "strong";

const MAX_FILES_BYTES = 2_000_000;

/** One earlier exchange, as text: what was asked, what the assistant said and did. */
export const historyEntry = z.strictObject({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(20_000),
});
export type HistoryEntry = z.infer<typeof historyEntry>;

export const chatRequestBody = z
  .strictObject({
    /** The diagram as it is now (every file). */
    files: z.record(z.string().max(512), z.string()),
    /** The nested diagram on screen ("" is the top one). */
    folder: z.string().max(512),
    /** What's selected on the canvas, by name. */
    selection: z.array(z.string().max(64)).max(200),
    prompt: z.string().trim().min(1).max(8_000),
    history: z.array(historyEntry).max(40),
    model: z.enum(MODEL_CHOICES),
  })
  .refine(
    (body) =>
      Object.values(body.files).reduce((sum, text) => sum + text.length, 0) <= MAX_FILES_BYTES,
    { message: "The diagram is too large for the assistant.", path: ["files"] },
  );
export type ChatRequest = z.infer<typeof chatRequestBody>;

/** An answer the assistant offers in a question (the panel adds "Something else"). */
export interface QuestionOption {
  readonly label: string;
  readonly description?: string;
  /** A small YAML diagram picturing this option. */
  readonly preview?: string;
}

/** What a turn did to the files, for the change card. */
export interface ChangeSummary {
  readonly line: string;
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
  readonly moved: number;
}

/** Streamed as server-sent events, one JSON object per `data:` line. */
export type AssistantEvent =
  | { readonly type: "start"; readonly tier: ModelTier; readonly model: string }
  /** More of the assistant's reply. */
  | { readonly type: "text"; readonly text: string }
  /** A change the browser applies the same way (see `applyOp`), as it happens. */
  | {
      readonly type: "op";
      readonly op: AssistantOp;
      readonly summary: string;
      readonly select: readonly string[];
    }
  /** Point at elements without changing anything. */
  | { readonly type: "focus"; readonly folder: string; readonly names: readonly string[] }
  /** Working on something the person sees as a status line ("Checking the diagram"). */
  | { readonly type: "status"; readonly text: string }
  | {
      readonly type: "question";
      readonly question: string;
      readonly options: readonly QuestionOption[];
      readonly multiSelect: boolean;
    }
  | { readonly type: "plan"; readonly summary: string; readonly steps: readonly string[] }
  | {
      readonly type: "done";
      /** The files after the turn when it changed them, to check the replay against. */
      readonly files: Record<string, string> | null;
      readonly changes: ChangeSummary | null;
      readonly stop: "end" | "question" | "plan" | "limit" | "stopped";
    }
  | { readonly type: "error"; readonly message: string };

/** The tools that change the diagram, replayed in the browser exactly as on the server. */
export const MUTATING_TOOLS = [
  "add_elements",
  "update_elements",
  "remove_elements",
  "rename_element",
  "move_into",
  "arrange",
  "update_scene",
  "update_settings",
  "write_file",
  "set_scaling",
  "apply_concept",
] as const;
export type MutatingTool = (typeof MUTATING_TOOLS)[number];

export interface AssistantOp {
  readonly tool: MutatingTool;
  /** The diagram folder the change applies to. */
  readonly folder: string;
  /** The tool's input, already validated. */
  readonly input: Record<string, unknown>;
  /** What the change needs beyond its input, sent along so the browser can replay it: the
   * concept's file, for `apply_concept`. */
  readonly attachment?: string;
}

/** The assistant as the app presents it (from GET /api/ai/config). */
export interface AssistantConfig {
  readonly enabled: boolean;
  /** Why it's off, for the panel ("not set up on this server", "sign in to use it"). */
  readonly reason: string | null;
  /** What it's called: "Claude" when Claude answers, else "Assistant". */
  readonly name: string;
  readonly models: { readonly fast: string; readonly strong: string } | null;
}

/** Encodes one event for a `text/event-stream` response. */
export const encodeEvent = (event: AssistantEvent): string => `data: ${JSON.stringify(event)}\n\n`;

/**
 * Reads server-sent events from a response body, one parsed event at a time (the browser side of
 * `encodeEvent`). Lines that aren't `data:` are ignored.
 */
export async function* readEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AssistantEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let end = buffer.indexOf("\n\n");
    while (end >= 0) {
      const chunk = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ")) yield JSON.parse(line.slice(6)) as AssistantEvent;
      }
      end = buffer.indexOf("\n\n");
    }
    if (done) return;
  }
}
