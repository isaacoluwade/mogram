"use client";

import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import {
  readEvents,
  type AssistantConfig,
  type AssistantEvent,
  type ChatRequest,
} from "@/lib/ai/protocol";
import { applyOp } from "@/lib/ai/tools";
import { sameFiles } from "@/lib/history/rules";
import { useEditorStore } from "../editor-context";
import { useEditorHost, type EditorHost } from "../persistence/host";
import type { EditorStore } from "../store/editor-store";
import { zoomToFit } from "../actions";
import {
  createConversationStore,
  historyFor,
  loadConversation,
  saveConversation,
  type ConversationActions,
  type ConversationState,
  type ConversationStore,
} from "./conversation";

/**
 * The assistant's controller (A4): runs a turn against the server, applies each change to the
 * canvas as it streams in (the same `applyOp` the server ran), and makes the whole turn one undo
 * step and one version in history. It lives as long as the editor, so a turn carries on while
 * the panel is closed.
 */

export interface AssistantController {
  readonly conversation: ConversationStore;
  send(prompt: string): Promise<void>;
  stop(): void;
  /** Answers the question in a message (and sends the answer as the next request). */
  answer(messageId: string, answer: string): Promise<void>;
  /** Plans: build it as proposed, or say what to change. */
  approvePlan(messageId: string): Promise<void>;
  changePlan(messageId: string): void;
  /** Undoes a turn's changes when nothing came after them. */
  undoTurn(messageId: string): void;
  /** Selects what a turn changed. */
  showTurn(messageId: string): void;
  /** Sends the request again (after an error). */
  retry(messageId: string): Promise<void>;
  clear(): void;
}

const AssistantContext = createContext<AssistantController | null>(null);

export function useAssistant(): AssistantController {
  const value = use(AssistantContext);
  if (value === null) throw new Error("Assistant UI must be inside <AssistantProvider>.");
  return value;
}

/** Subscribes to the conversation. */
export function useConversation<T>(
  selector: (state: ConversationState & ConversationActions) => T,
): T {
  return useStore(useAssistant().conversation, selector);
}

const UNREACHABLE: AssistantConfig = {
  enabled: false,
  reason: "The assistant couldn't be reached. Check your connection and reload.",
  name: "Assistant",
  models: null,
};

async function failureOf(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (typeof body.error?.message === "string") return body.error.message;
  } catch {
    // Not JSON: fall through.
  }
  return response.status === 429
    ? "Too many requests. Wait a minute, then try again."
    : "The assistant couldn't answer. Try again.";
}

const newId = (): string =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

function labelOf(store: EditorStore, name: string): string {
  const diagram = store.getState().diagram();
  return (
    diagram.components.get(name)?.label ??
    diagram.containers.get(name)?.label ??
    diagram.connections.get(name)?.text ??
    name
  );
}

function createController(
  store: EditorStore,
  initialHost: EditorHost,
  conversation: ConversationStore,
): AssistantController & { setHost(host: EditorHost): void; dispose(): void } {
  let abort: AbortController | null = null;
  // The host as it is now: it changes (e.g. with share settings), and a turn mustn't restart.
  let host = initialHost;
  const hostOf = () => host;
  const chat = () => conversation.getState();
  const assistantName = () => chat().config?.name ?? "The assistant";

  const send = async (prompt: string): Promise<void> => {
    const text = prompt.trim();
    if (text === "" || chat().working !== null) return;
    const config = chat().config;
    if (config?.enabled !== true) {
      store.getState().notify(config?.reason ?? "The assistant isn't available.", "error");
      return;
    }
    if (store.getState().busy !== null) return;
    if (store.getState().viewing !== null) store.getState().setViewing(null);

    const turn = newId();
    const replyId = `${turn}:reply`;
    const before = chat().messages;
    const state = store.getState();
    chat().add({
      kind: "user",
      id: `${turn}:ask`,
      text,
      about: state.selection.slice(0, 8).map((name) => labelOf(store, name)),
    });
    chat().add({
      kind: "assistant",
      id: replyId,
      turn,
      text: "",
      status: "working",
      steps: [],
      changes: null,
      question: null,
      plan: null,
      error: null,
      tier: null,
      undone: false,
    });
    chat().setWorking(turn);
    // The person's own changes become their own version before the assistant starts.
    await hostOf().saveNow();
    store.getState().startAssistant(turn);
    abort = new AbortController();
    const signal = abort.signal;
    const label = `${assistantName()}: ${text.length > 40 ? `${text.slice(0, 40)}…` : text}`;
    let changed = false;
    let added = 0;

    const handle = (event: AssistantEvent) => {
      switch (event.type) {
        case "start":
          chat().update(replyId, (m) => ({ ...m, tier: event.tier }));
          break;
        case "text":
          chat().update(replyId, (m) => ({ ...m, text: m.text + event.text }));
          break;
        case "op": {
          const editor = store.getState();
          try {
            const result = applyOp(editor.files, event.op);
            editor.applyAssistant(turn, result.files, {
              label,
              select: event.op.folder === editor.folder ? event.select : [],
              follow: chat().follow,
            });
            changed = true;
          } catch {
            // The final files at the end put things right.
          }
          chat().update(replyId, (m) => ({
            ...m,
            steps: [...m.steps, { summary: event.summary, select: event.select }],
          }));
          break;
        }
        case "focus": {
          const editor = store.getState();
          if (event.folder === editor.folder) editor.select(event.names);
          break;
        }
        case "question":
          chat().update(replyId, (m) => ({
            ...m,
            question: {
              question: event.question,
              options: event.options,
              multiSelect: event.multiSelect,
              answer: null,
            },
          }));
          break;
        case "plan":
          chat().update(replyId, (m) => ({
            ...m,
            plan: { summary: event.summary, steps: event.steps, answer: null },
          }));
          break;
        case "error":
          chat().update(replyId, (m) => ({ ...m, error: event.message, status: "error" }));
          break;
        case "done": {
          const editor = store.getState();
          // The server's files are the truth: if the replay drifted, they win.
          if (event.files !== null && !sameFiles(editor.files, event.files)) {
            editor.applyAssistant(turn, event.files, { label, follow: false });
            changed = true;
          }
          added = event.changes?.added ?? 0;
          chat().update(replyId, (m) => ({
            ...m,
            changes: event.changes,
            status: m.status === "error" ? "error" : event.stop === "stopped" ? "stopped" : "done",
          }));
          break;
        }
        case "status":
          break;
      }
    };

    try {
      const body: ChatRequest = {
        files: state.files,
        folder: state.folder,
        selection: [...state.selection],
        prompt: text,
        history: historyFor(before),
        model: chat().model,
      };
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
      if (!response.ok || response.body === null) throw new Error(await failureOf(response));
      for await (const event of readEvents(response.body)) handle(event);
    } catch (error) {
      if (signal.aborted) {
        chat().update(replyId, (m) => ({ ...m, status: "stopped" }));
      } else {
        const message =
          error instanceof TypeError
            ? "The assistant couldn't be reached. Check your connection."
            : error instanceof Error
              ? error.message
              : "Something went wrong.";
        chat().update(replyId, (m) => ({ ...m, status: "error", error: message }));
      }
    } finally {
      // Whatever happened, the reply stops "working" and the editor is the person's again.
      chat().update(replyId, (m) => (m.status === "working" ? { ...m, status: "done" } : m));
      store.getState().endAssistant(turn);
      chat().setWorking(null);
      // After building a lot, the whole result is framed (nothing is left selected to stand out).
      if (added >= 4) {
        store.getState().select([]);
        zoomToFit(store);
      }
      abort = null;
      if (changed) await hostOf().checkpoint({ source: "ai", label: text.slice(0, 200) });
    }
  };

  const find = (id: string) => {
    const message = chat().messages.find((m) => m.id === id);
    return message?.kind === "assistant" ? message : null;
  };

  return {
    conversation,
    send,
    stop: () => abort?.abort(),
    answer: async (id, answer) => {
      chat().update(id, (m) =>
        m.question === null ? m : { ...m, question: { ...m.question, answer } },
      );
      await send(answer);
    },
    approvePlan: async (id) => {
      chat().update(id, (m) =>
        m.plan === null ? m : { ...m, plan: { ...m.plan, answer: "build" } },
      );
      await send("Build it.");
    },
    changePlan: (id) => {
      chat().update(id, (m) =>
        m.plan === null ? m : { ...m, plan: { ...m.plan, answer: "change" } },
      );
      chat().focus("Change the plan: ");
    },
    undoTurn: (id) => {
      const message = find(id);
      if (message === null) return;
      if (store.getState().undoAssistant(message.turn)) {
        chat().update(id, (m) => ({ ...m, undone: true }));
        store.getState().notify(`Undid ${assistantName()}'s changes. Redo brings them back.`);
      } else {
        store
          .getState()
          .notify(
            "Other changes came after these. Version history can take the diagram further back.",
          );
        store.getState().togglePanel("history", true);
      }
    },
    showTurn: (id) => {
      const message = find(id);
      if (message === null) return;
      const names = [...new Set(message.steps.flatMap((s) => s.select))];
      const diagram = store.getState().diagram();
      const here = names.filter(
        (n) =>
          diagram.components.has(n) ||
          diagram.containers.has(n) ||
          diagram.connections.has(n) ||
          diagram.groups.has(n) ||
          diagram.decorations.has(n),
      );
      if (here.length === 0) store.getState().notify("What it changed isn't on this level.");
      else store.getState().select(here);
    },
    retry: async (id) => {
      const messages = chat().messages;
      const index = messages.findIndex((m) => m.id === id);
      const ask = messages[index - 1];
      if (ask?.kind === "user") await send(ask.text);
    },
    clear: () => {
      abort?.abort();
      chat().clear();
    },
    setHost: (next) => {
      host = next;
    },
    dispose: () => abort?.abort(),
  };
}

/** Holds the conversation for this diagram and runs its turns. */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const store = useEditorStore();
  const host = useEditorHost();
  const [conversation] = useState(createConversationStore);
  const key = `${host.kind}:${host.id}`;

  useEffect(() => {
    let alive = true;
    fetch("/api/ai/config", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("unreachable");
        const body = (await response.json()) as { assistant: AssistantConfig };
        if (alive) conversation.getState().setConfig(body.assistant);
      })
      .catch(() => {
        if (alive) conversation.getState().setConfig(UNREACHABLE);
      });
    return () => {
      alive = false;
    };
  }, [conversation, host.signedIn]);

  useEffect(() => {
    let alive = true;
    void loadConversation(key).then((messages) => {
      if (alive && conversation.getState().messages.length === 0)
        conversation.getState().load(messages);
    });
    // Saved whenever it settles (not on every word of a reply).
    const unsubscribe = conversation.subscribe((state, previous) => {
      if (state.working === null && state.messages !== previous.messages)
        void saveConversation(key, state.messages);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [conversation, key]);

  // One controller for the editor's lifetime; it's told when the host changes.
  const [controller] = useState(() => createController(store, host, conversation));
  useEffect(() => controller.setHost(host), [controller, host]);

  // Opened from "Describe what you want to build" (`?ask=`): the description is the first request.
  const [ask] = useState(() =>
    typeof window === "undefined" ? null : new URL(window.location.href).searchParams.get("ask"),
  );
  const asked = useRef(false);
  useEffect(() => {
    if (ask === null || ask.trim() === "" || asked.current) return;
    // Taken off the address, so reloading doesn't ask again.
    const url = new URL(window.location.href);
    if (url.searchParams.has("ask")) {
      url.searchParams.delete("ask");
      window.history.replaceState(window.history.state, "", url);
    }
    store.getState().showLeft("assistant");
    const start = (config: AssistantConfig) => {
      if (asked.current) return;
      asked.current = true;
      if (config.enabled) void controller.send(ask);
      else conversation.getState().focus(ask);
    };
    const config = conversation.getState().config;
    if (config !== null) {
      start(config);
      return;
    }
    return conversation.subscribe((state) => {
      if (state.config !== null) start(state.config);
    });
  }, [ask, controller, conversation, store]);
  useEffect(() => () => controller.dispose(), [controller]);

  return <AssistantContext value={controller}>{children}</AssistantContext>;
}
