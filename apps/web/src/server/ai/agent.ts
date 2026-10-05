import "server-only";
import { findDiagramFolders, parseDiagram } from "@mogram/core/format";
import type { ProjectFiles } from "@mogram/core/model";
import type {
  AssistantEvent,
  ChatRequest,
  HistoryEntry,
  ModelChoice,
  ModelTier,
} from "@/lib/ai/protocol";
import { TOOL_SPECS, changeSummary, runTool, type ToolEnv } from "@/lib/ai/tools";
import { briefing, turnMessage } from "./briefing";
import {
  NO_USAGE,
  ProviderError,
  addUsage,
  type ModelMessage,
  type ModelProvider,
  type ModelToolCall,
  type ModelToolResult,
  type Usage,
} from "./providers/types";

/**
 * One turn of the assistant (A3): the model reads the diagram and the request, calls tools, sees
 * what each did, and carries on until it answers, asks, proposes a plan, or reaches the step
 * limit. Every change is streamed as it's made, so the canvas updates while the model works.
 */

/** Model calls in one turn, at most: a big build takes 6 to 10. */
const MAX_STEPS = 16;
const MAX_TOKENS = 8_192;

export interface TurnOutcome {
  readonly stop: "end" | "question" | "plan" | "limit" | "stopped" | "error";
  readonly usage: Usage;
  readonly steps: number;
}

/** Fast for small edits and questions, strong for building, planning and reviewing. */
export function tierFor(choice: ModelChoice, request: ChatRequest): ModelTier {
  if (choice !== "auto") return choice;
  let elements = 0;
  for (const folder of findDiagramFolders(request.files)) {
    const d = parseDiagram(request.files, folder).diagram;
    elements += d.components.size + d.containers.size;
  }
  const big =
    // An empty diagram: whatever's asked, it's building from scratch.
    elements === 0 ||
    request.prompt.length > 280 ||
    /\b(build|create|design|draw|set up|architect|from scratch|redesign|restructure|rebuild|plan|review|migrate|convert|whole|entire)\w*/i.test(
      request.prompt,
    );
  return big ? "strong" : "fast";
}

/** Earlier turns as alternating messages, starting with the person (as providers require). */
function historyMessages(history: readonly HistoryEntry[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const entry of history) {
    const last = out.at(-1);
    if (entry.role === "user") {
      if (last?.role === "user")
        out[out.length - 1] = { role: "user", text: `${last.text}\n\n${entry.text}` };
      else out.push({ role: "user", text: entry.text });
    } else if (last?.role === "user") {
      out.push({ role: "assistant", text: entry.text, calls: [] });
    } else if (last?.role === "assistant") {
      out[out.length - 1] = { role: "assistant", text: `${last.text}\n\n${entry.text}`, calls: [] };
    }
    // An assistant entry before any request has nothing to answer: dropped.
  }
  // The new request follows: the history ends with the assistant.
  if (out.at(-1)?.role === "user") out.pop();
  return out;
}

export async function runTurn(args: {
  readonly provider: ModelProvider;
  readonly model: string;
  readonly name: string;
  readonly request: ChatRequest;
  readonly env: ToolEnv;
  readonly emit: (event: AssistantEvent) => void;
  readonly signal: AbortSignal;
  readonly maxSteps?: number;
}): Promise<TurnOutcome> {
  const { request, emit, signal } = args;
  const start: ProjectFiles = request.files;
  let files = start;
  let usage = NO_USAGE;
  let stop: TurnOutcome["stop"] = "limit";
  let steps = 0;
  const messages: ModelMessage[] = [
    ...historyMessages(request.history),
    {
      role: "user",
      text: turnMessage({
        files,
        folder: request.folder,
        selection: request.selection,
        prompt: request.prompt,
      }),
    },
  ];
  const system = briefing(args.name);

  try {
    for (; steps < (args.maxSteps ?? MAX_STEPS); steps++) {
      if (signal.aborted) {
        stop = "stopped";
        break;
      }
      let text = "";
      const calls: ModelToolCall[] = [];
      let cutOff = false;
      for await (const event of args.provider.stream({
        model: args.model,
        system,
        messages,
        tools: TOOL_SPECS,
        maxTokens: MAX_TOKENS,
        signal,
      })) {
        if (event.type === "text") {
          text += event.text;
          emit({ type: "text", text: event.text });
        } else if (event.type === "call") {
          calls.push({ id: event.id, name: event.name, input: event.input });
        } else {
          usage = addUsage(usage, event.usage);
          cutOff = event.stop === "length";
        }
      }
      if (signal.aborted) {
        stop = "stopped";
        break;
      }
      messages.push({ role: "assistant", text, calls });
      if (calls.length === 0) {
        stop = "end";
        if (cutOff)
          emit({ type: "text", text: '\n\n(I was cut off there. Say "continue" to carry on.)' });
        break;
      }
      // A step's text and the next step's text read as separate paragraphs.
      if (text.trim() !== "") emit({ type: "text", text: "\n\n" });

      const results: ModelToolResult[] = [];
      let ends: "question" | "plan" | null = null;
      for (const call of calls) {
        if (ends !== null) {
          results.push({
            id: call.id,
            content: "Not run: the turn ended with your question.",
            isError: true,
          });
          continue;
        }
        const result = runTool(args.env, { files, folder: request.folder }, call);
        files = result.files;
        for (const event of result.events) emit(event);
        results.push({ id: call.id, content: result.content, isError: result.isError });
        ends = result.ends;
      }
      messages.push({ role: "tool", results });
      if (ends !== null) {
        stop = ends;
        steps++;
        break;
      }
    }
    if (stop === "limit")
      emit({
        type: "text",
        text: "\n\nI've stopped here to check in: say \"continue\" and I'll carry on.",
      });
  } catch (error) {
    if (signal.aborted) {
      stop = "stopped";
    } else {
      stop = "error";
      emit({
        type: "error",
        message:
          error instanceof ProviderError
            ? error.message
            : "Something went wrong while the assistant was working. Try again.",
      });
      if (!(error instanceof ProviderError)) console.error("assistant turn failed", error);
    }
  }

  const changed = changeSummary(start, files);
  emit({
    type: "done",
    files: changed === null ? null : files,
    changes: changed,
    stop: stop === "error" ? "stopped" : stop,
  });
  return { stop, usage, steps };
}
