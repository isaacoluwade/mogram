"use client";

import { readConversation, writeConversation } from "@/features/assistant/storage";
import { createStore, type StoreApi } from "zustand/vanilla";
import type {
  AssistantConfig,
  ChangeSummary,
  HistoryEntry,
  ModelChoice,
  ModelTier,
  QuestionOption,
} from "@/lib/ai/protocol";

/**
 * The conversation with the assistant for one diagram (A4): what was asked, what it said and did,
 * and its questions and plans with their answers. Kept in this browser per diagram, so it's there
 * when the diagram is opened again; only text goes back to the server as history.
 */

export interface Question {
  readonly question: string;
  readonly options: readonly QuestionOption[];
  readonly multiSelect: boolean;
  readonly answer: string | null;
}

export interface Plan {
  readonly summary: string;
  readonly steps: readonly string[];
  readonly answer: "build" | "change" | null;
}

export interface ChangeStep {
  readonly summary: string;
  readonly select: readonly string[];
}

export type Message =
  | {
      readonly kind: "user";
      readonly id: string;
      readonly text: string;
      /** What was selected when it was asked (labels), shown as chips. */
      readonly about: readonly string[];
    }
  | {
      readonly kind: "assistant";
      readonly id: string;
      readonly turn: string;
      readonly text: string;
      readonly status: "working" | "done" | "stopped" | "error";
      readonly steps: readonly ChangeStep[];
      readonly changes: ChangeSummary | null;
      readonly question: Question | null;
      readonly plan: Plan | null;
      readonly error: string | null;
      readonly tier: ModelTier | null;
      /** Its changes were undone from the card. */
      readonly undone: boolean;
    };

export type AssistantMessage = Extract<Message, { kind: "assistant" }>;

export interface ConversationState {
  /** null until the server says whether the assistant is on. */
  readonly config: AssistantConfig | null;
  readonly messages: readonly Message[];
  /** The turn under way, if any. */
  readonly working: string | null;
  readonly model: ModelChoice;
  /** Select what the assistant changes as it goes, so the canvas follows it. */
  readonly follow: boolean;
  /** Focus the composer (bumped by ⌘J and "Ask about this"). */
  readonly focusRequest: number;
  /** Text to put in the composer (e.g. "Change the plan: "). */
  readonly prefill: { readonly text: string; readonly at: number } | null;
}

export interface ConversationActions {
  setConfig(config: AssistantConfig): void;
  add(message: Message): void;
  update(id: string, change: (message: AssistantMessage) => AssistantMessage): void;
  setWorking(turn: string | null): void;
  setModel(model: ModelChoice): void;
  setFollow(follow: boolean): void;
  focus(prefill?: string): void;
  clear(): void;
  load(messages: readonly Message[]): void;
}

export type ConversationStore = StoreApi<ConversationState & ConversationActions>;

/** Messages kept per diagram. */
const KEEP = 80;

export function createConversationStore(): ConversationStore {
  return createStore<ConversationState & ConversationActions>()((setState, getState) => ({
    config: null,
    messages: [],
    working: null,
    model: "auto",
    follow: true,
    focusRequest: 0,
    prefill: null,
    setConfig: (config) => setState({ config }),
    add: (message) => setState({ messages: [...getState().messages, message].slice(-KEEP) }),
    update: (id, change) =>
      setState({
        messages: getState().messages.map((m) =>
          m.kind === "assistant" && m.id === id ? change(m) : m,
        ),
      }),
    setWorking: (working) => setState({ working }),
    setModel: (model) => setState({ model }),
    setFollow: (follow) => setState({ follow }),
    focus: (prefill) =>
      setState({
        focusRequest: getState().focusRequest + 1,
        ...(prefill !== undefined ? { prefill: { text: prefill, at: Date.now() } } : {}),
      }),
    clear: () => setState({ messages: [] }),
    load: (messages) => setState({ messages: messages.slice(-KEEP) }),
  }));
}

/** Earlier turns, as text, for the model (most recent last, within a budget). */
export function historyFor(messages: readonly Message[]): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const message of messages) {
    if (message.kind === "user") {
      out.push({
        role: "user",
        text:
          message.about.length > 0
            ? `${message.text}\n(About: ${message.about.join(", ")})`
            : message.text,
      });
      continue;
    }
    if (message.status === "working") continue;
    const parts: string[] = [];
    if (message.text.trim() !== "") parts.push(message.text.trim());
    if (message.changes !== null)
      parts.push(
        `[Changed the diagram: ${message.changes.line}${message.undone ? ". The person undid this." : ""}]`,
      );
    if (message.question !== null)
      parts.push(
        `[Asked: ${message.question.question} Options: ${message.question.options.map((o) => o.label).join("; ")}]`,
      );
    if (message.plan !== null)
      parts.push(
        `[Proposed a plan: ${message.plan.summary} Steps: ${message.plan.steps.join("; ")}]`,
      );
    if (message.error !== null) parts.push(`[The turn failed: ${message.error}]`);
    if (parts.length > 0) out.push({ role: "assistant", text: parts.join("\n").slice(0, 4_000) });
  }
  // The last 20 entries, within about 40,000 characters.
  const recent = out.slice(-20);
  let total = 0;
  const kept: HistoryEntry[] = [];
  for (let i = recent.length - 1; i >= 0; i--) {
    const entry = recent[i];
    if (entry === undefined) continue;
    total += entry.text.length;
    if (total > 40_000) break;
    kept.unshift(entry);
  }
  return kept;
}

export async function loadConversation(key: string): Promise<Message[]> {
  // A turn that was under way when the page closed didn't finish.
  return (await readConversation<Message>(key)).map((m) =>
    m.kind === "assistant" && m.status === "working" ? { ...m, status: "stopped" } : m,
  );
}

export async function saveConversation(key: string, messages: readonly Message[]): Promise<void> {
  await writeConversation(key, messages.slice(-KEEP));
}
