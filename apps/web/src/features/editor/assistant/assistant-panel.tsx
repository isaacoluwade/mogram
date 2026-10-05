"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowUp,
  Check,
  CircleAlert,
  History,
  ListChecks,
  MoreHorizontal,
  PanelLeftClose,
  RotateCcw,
  Sparkles,
  Square,
  Undo2,
  X,
} from "lucide-react";
import type { ModelChoice } from "@/lib/ai/protocol";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { DiagramPreview } from "@/features/canvas/diagram-preview";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { useEditorHost } from "../persistence/host";
import { useCommandHost } from "../commands/context";
import type { LeftTab } from "../store/editor-store";
import { useAssistant, useConversation } from "./assistant-context";
import type { AssistantMessage, Message } from "./conversation";

/** Library | Assistant: the left column's two panels (A4). */
export function LeftTabs({ current }: { current: LeftTab }) {
  const store = useEditorStore();
  const name = useConversation((s) => s.config?.name ?? "Assistant");
  const tab = (id: LeftTab, label: string, icon?: React.ReactNode) => (
    <button
      type="button"
      role="tab"
      aria-selected={current === id}
      onClick={() => store.getState().showLeft(id)}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md px-2 font-display text-body font-medium tracking-snug transition-colors",
        current === id ? "text-fg-strong" : "text-fg-muted hover:text-fg",
      )}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div
      role="tablist"
      aria-label="Left panel"
      className="-ml-2 flex min-w-0 flex-1 items-center gap-0.5"
    >
      {tab("library", "Library")}
      {tab("concepts", "Concepts")}
      {tab("assistant", name, <Sparkles aria-hidden className="size-3.5 text-violet" />)}
    </div>
  );
}

const SUGGESTIONS = [
  "Add a cache in front of the database",
  "Review this architecture",
  "Explain this diagram",
  "Add an outage scene",
];
const EMPTY_SUGGESTIONS = [
  "A three-tier web app on Azure",
  "A serverless API on AWS",
  "An event-driven pipeline on Google Cloud",
];

/** Chat with the assistant, beside the library: it builds and changes the diagram with you. */
export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const assistant = useAssistant();
  const config = useConversation((s) => s.config);
  const messages = useConversation((s) => s.messages);
  const working = useConversation((s) => s.working);
  const follow = useConversation((s) => s.follow);
  const empty = useEditor((s) => {
    const d = s.diagram();
    return d.components.size + d.containers.size === 0;
  });

  return (
    <Panel
      role="region"
      aria-label="Assistant"
      className="flex h-full w-full flex-col overflow-hidden"
    >
      <PanelHeader>
        <LeftTabs current="assistant" />
        <Menu>
          <MenuTrigger asChild>
            <IconButton label="Assistant options" size="sm">
              <MoreHorizontal />
            </IconButton>
          </MenuTrigger>
          <MenuContent align="end" className="w-60">
            <MenuItem
              checked={follow}
              onSelect={() => assistant.conversation.getState().setFollow(!follow)}
              description="Select what it changes as it works"
            >
              Follow changes
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<RotateCcw />}
              disabled={messages.length === 0}
              onSelect={() => assistant.clear()}
            >
              New conversation
            </MenuItem>
          </MenuContent>
        </Menu>
        <IconButton label="Hide assistant" size="sm" onClick={onClose}>
          <PanelLeftClose />
        </IconButton>
      </PanelHeader>

      {config === null ? (
        <div className="flex flex-col gap-2 p-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-16" />
        </div>
      ) : !config.enabled ? (
        <Unavailable reason={config.reason} />
      ) : (
        <>
          <Transcript messages={messages} working={working} />
          {messages.length === 0 ? (
            <Suggestions
              items={empty ? EMPTY_SUGGESTIONS : SUGGESTIONS}
              name={config.name}
              empty={empty}
            />
          ) : null}
          <Composer />
        </>
      )}
    </Panel>
  );
}

function Unavailable({ reason }: { reason: string | null }) {
  const host = useEditorHost();
  const signIn = reason === "Sign in to use the assistant.";
  return (
    <EmptyState
      icon={<Sparkles />}
      title={signIn ? "Sign in to use the assistant" : "The assistant is off"}
      description={
        signIn ? "It builds and changes diagrams with you, in plain words." : (reason ?? undefined)
      }
      action={
        signIn ? (
          <Button asChild variant="primary" size="sm">
            <a
              href={`/sign-in?next=${encodeURIComponent(host.kind === "local" ? `/draft/${host.id}` : `/edit/${host.id}`)}`}
            >
              Sign in
            </a>
          </Button>
        ) : undefined
      }
    />
  );
}

function Suggestions({
  items,
  name,
  empty,
}: {
  items: readonly string[];
  name: string;
  empty: boolean;
}) {
  const assistant = useAssistant();
  return (
    <div className="flex flex-col gap-2 px-3 pb-3">
      <p className="text-caption text-fg-muted">
        {empty
          ? `Describe what you want to build, and ${name} draws it with you.`
          : `Ask ${name} to change, explain or review this diagram.`}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => void assistant.send(text)}
            className="rounded-full border border-border-subtle px-2.5 py-1 text-caption text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Transcript({
  messages,
  working,
}: {
  messages: readonly Message[];
  working: string | null;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const pinned = useRef(true);
  // Keeps to the newest words while they arrive, unless the person scrolled up to read.
  useLayoutEffect(() => {
    const node = scroller.current;
    if (node !== null && pinned.current) node.scrollTop = node.scrollHeight;
  }, [messages]);
  return (
    <div
      ref={scroller}
      onScroll={(event) => {
        const node = event.currentTarget;
        pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60;
      }}
      className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-gutter:stable]"
    >
      <ol aria-label="Conversation" aria-live="polite" className="flex flex-col gap-3">
        {messages.map((message, index) => (
          <li key={message.id}>
            {message.kind === "user" ? (
              <UserBubble text={message.text} about={message.about} />
            ) : (
              <Reply
                message={message}
                latest={index === messages.length - 1}
                busy={working !== null}
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function UserBubble({ text, about }: { text: string; about: readonly string[] }) {
  return (
    <div className="ml-6 flex flex-col items-end gap-1">
      <p className="whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-fill-active px-3 py-2 text-label text-fg">
        {text}
      </p>
      {about.length > 0 ? (
        <p className="text-micro text-fg-muted">About {about.join(", ")}</p>
      ) : null}
    </div>
  );
}

function Reply({
  message,
  latest,
  busy,
}: {
  message: AssistantMessage;
  latest: boolean;
  busy: boolean;
}) {
  const assistant = useAssistant();
  const working = message.status === "working";
  return (
    <div data-testid="assistant-reply" data-status={message.status} className="flex flex-col gap-2">
      {message.text.trim() !== "" ? (
        <p className="whitespace-pre-wrap break-words text-label leading-relaxed text-fg-soft">
          {message.text.trim()}
        </p>
      ) : working && message.steps.length === 0 ? (
        <p className="flex items-center gap-2 text-label text-fg-muted">
          <Sparkles aria-hidden className="size-3.5 animate-pulse text-violet" />
          Thinking…
        </p>
      ) : null}
      {working && message.steps.length > 0 ? (
        <p className="flex items-center gap-2 text-caption text-fg-muted">
          <Sparkles aria-hidden className="size-3.5 animate-pulse text-violet" />
          {message.steps.at(-1)?.summary}
        </p>
      ) : null}
      {!working && message.changes !== null ? <ChangeCard message={message} /> : null}
      {message.question !== null ? (
        <QuestionCard
          message={message}
          active={latest && !busy && message.question.answer === null}
        />
      ) : null}
      {message.plan !== null ? <PlanCard message={message} active={latest && !busy} /> : null}
      {message.status === "stopped" ? <p className="text-caption text-fg-muted">Stopped.</p> : null}
      {message.error !== null ? (
        <div className="flex items-start gap-2 rounded-lg border border-rose-line bg-rose-fill px-2.5 py-2 text-caption text-rose">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <span className="flex-1">{message.error}</span>
          {latest && !busy ? (
            <button
              type="button"
              className="font-medium underline"
              onClick={() => void assistant.retry(message.id)}
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ChangeCard({ message }: { message: AssistantMessage }) {
  const assistant = useAssistant();
  const store = useEditorStore();
  const changes = message.changes;
  if (changes === null) return null;
  return (
    <div
      data-testid="change-card"
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-3 py-2.5",
        message.undone ? "border-border-subtle opacity-70" : "border-violet-line bg-violet-fill",
      )}
    >
      <p className="flex items-start gap-2 text-caption text-fg">
        <Sparkles aria-hidden className="mt-px size-3.5 shrink-0 text-violet" />
        <span className="flex-1">
          {message.undone ? "Undone: " : ""}
          {changes.line}
        </span>
      </p>
      {!message.undone ? (
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2"
            onClick={() => assistant.showTurn(message.id)}
          >
            <ListChecks />
            Show
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2"
            onClick={() => assistant.undoTurn(message.id)}
          >
            <Undo2 />
            Undo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => store.getState().togglePanel("history", true)}
          >
            <History />
            History
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function QuestionCard({ message, active }: { message: AssistantMessage; active: boolean }) {
  const assistant = useAssistant();
  const question = message.question;
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [other, setOther] = useState<string | null>(null);
  const answer = (text: string) => void assistant.answer(message.id, text);

  // 1 to 4 pick an answer, as in Claude's own question cards.
  useEffect(() => {
    if (!active || question === null || question.multiSelect) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (target?.closest("input, textarea, [contenteditable=true]") != null) return;
      const option = question.options[Number(event.key) - 1];
      if (option !== undefined) {
        event.preventDefault();
        void assistant.answer(message.id, option.label);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, question, assistant, message.id]);

  if (question === null) return null;
  return (
    <div
      data-testid="question-card"
      className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5"
    >
      <p className="text-label font-medium text-fg">{question.question}</p>
      {question.answer !== null ? (
        <p className="flex items-center gap-1.5 text-caption text-fg-muted">
          <Check aria-hidden className="size-3.5 text-green" />
          {question.answer}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {question.options.map((option, index) => {
              const chosen = picked.includes(option.label);
              return (
                <li key={option.label}>
                  <button
                    type="button"
                    disabled={!active}
                    aria-pressed={question.multiSelect ? chosen : undefined}
                    onClick={() =>
                      question.multiSelect
                        ? setPicked((now) =>
                            chosen ? now.filter((l) => l !== option.label) : [...now, option.label],
                          )
                        : answer(option.label)
                    }
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors disabled:opacity-60",
                      chosen
                        ? "border-violet-line bg-violet-fill"
                        : "border-border-subtle hover:bg-fill-hover",
                    )}
                  >
                    <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded border border-border text-micro tabular-nums text-fg-secondary">
                      {question.multiSelect ? (
                        chosen ? (
                          <Check className="size-3" />
                        ) : null
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-label text-fg">{option.label}</span>
                      {option.description !== undefined ? (
                        <span className="text-caption text-fg-muted">{option.description}</span>
                      ) : null}
                      {option.preview !== undefined ? (
                        <span className="relative mt-1 block h-20 overflow-hidden rounded border border-border-subtle bg-surface">
                          <DiagramPreview
                            files={{ "mogram.yaml": option.preview }}
                            className="pointer-events-none absolute inset-0"
                            padding={8}
                            animate={false}
                          />
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {other === null ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!active}
                onClick={() => setOther("")}
                className="text-caption text-fg-muted underline-offset-2 hover:text-fg hover:underline disabled:opacity-60"
              >
                Something else…
              </button>
              {question.multiSelect ? (
                <Button
                  size="sm"
                  variant="primary"
                  className="ml-auto h-7"
                  disabled={!active || picked.length === 0}
                  onClick={() => answer(picked.join(", "))}
                >
                  Send
                </Button>
              ) : null}
            </div>
          ) : (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (other.trim() !== "") answer(other.trim());
              }}
            >
              <input
                autoFocus
                aria-label="Your answer"
                value={other}
                onChange={(event) => setOther(event.target.value)}
                className="h-8 min-w-0 flex-1 rounded-md bg-fill-field px-2.5 text-label text-fg outline-none placeholder:text-fg-ghost focus-visible:ring-1 focus-visible:ring-border-emphasis"
                placeholder="Your answer"
              />
              <Button
                type="submit"
                size="sm"
                variant="primary"
                className="h-8"
                disabled={other.trim() === ""}
              >
                Send
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

function PlanCard({ message, active }: { message: AssistantMessage; active: boolean }) {
  const assistant = useAssistant();
  const plan = message.plan;
  if (plan === null) return null;
  return (
    <div
      data-testid="plan-card"
      className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5"
    >
      <p className="text-label font-medium text-fg">{plan.summary}</p>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-caption text-fg-soft">
        {plan.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {plan.answer === null ? (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="primary"
            className="h-7"
            disabled={!active}
            onClick={() => void assistant.approvePlan(message.id)}
          >
            Build it
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7"
            disabled={!active}
            onClick={() => assistant.changePlan(message.id)}
          >
            Change something
          </Button>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-caption text-fg-muted">
          <Check aria-hidden className="size-3.5 text-green" />
          {plan.answer === "build" ? "Building it" : "Changing the plan"}
        </p>
      )}
    </div>
  );
}

const MODEL_OPTIONS = (models: { fast: string; strong: string } | null) =>
  [
    { value: "auto", label: "Auto", description: "Fast for edits, strong for building" },
    { value: "fast", label: "Fast", description: models?.fast ?? "Quick edits and questions" },
    { value: "strong", label: "Strong", description: models?.strong ?? "Building and reviews" },
  ] as const satisfies readonly { value: ModelChoice; label: string; description: string }[];

interface Mention {
  readonly name: string;
  readonly label: string;
}

function Composer() {
  const assistant = useAssistant();
  const commands = useCommandHost();
  const store = useEditorStore();
  const config = useConversation((s) => s.config);
  const working = useConversation((s) => s.working);
  const model = useConversation((s) => s.model);
  const focusRequest = useConversation((s) => s.focusRequest);
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const { selection, elements } = useEditorShallow((s) => ({
    selection: s.selection,
    elements: s.diagram(),
  }));
  const chips = useMemo(
    () =>
      selection.slice(0, 6).map((name) => ({
        name,
        label:
          elements.components.get(name)?.label ??
          elements.containers.get(name)?.label ??
          elements.connections.get(name)?.text ??
          name,
      })),
    [selection, elements],
  );

  // ⌘J and "Ask about this" put the cursor here (with any text to start from).
  useEffect(() => {
    if (focusRequest > 0) field.current?.focus();
  }, [focusRequest]);
  useEffect(
    () =>
      assistant.conversation.subscribe((state, previous) => {
        const prefill = state.prefill;
        if (prefill === null || prefill === previous.prefill) return;
        setText(prefill.text);
        requestAnimationFrame(() => {
          field.current?.focus();
          field.current?.setSelectionRange(prefill.text.length, prefill.text.length);
        });
      }),
    [assistant],
  );
  // Grows with what's typed, up to a point.
  useLayoutEffect(() => {
    const node = field.current;
    if (node === null) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 180)}px`;
  }, [text]);

  // "@ord" before the cursor offers elements to name.
  const query = /@([\w-]*)$/.exec(text.slice(0, caret))?.[1] ?? null;
  const mentions = useMemo<Mention[]>(() => {
    if (query === null) return [];
    const all: Mention[] = [...elements.components.values(), ...elements.containers.values()].map(
      (e) => ({ name: e.name, label: e.label }),
    );
    const q = query.toLowerCase();
    return all
      .filter((m) => m.name.toLowerCase().includes(q) || m.label.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, elements]);

  const insertMention = (mention: Mention) => {
    const before = text.slice(0, caret).replace(/@[\w-]*$/, `@${mention.name} `);
    const next = before + text.slice(caret);
    setText(next);
    setCaret(before.length);
    requestAnimationFrame(() => field.current?.setSelectionRange(before.length, before.length));
  };

  const send = () => {
    if (text.trim() === "" || working !== null) return;
    const prompt = text;
    setText("");
    void assistant.send(prompt);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // ⌘J hides the assistant from here too (shortcuts don't reach into text fields).
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
      event.preventDefault();
      commands.assistant?.();
      return;
    }
    if (mentions.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex(
          (i) => (i + (event.key === "ArrowDown" ? 1 : -1) + mentions.length) % mentions.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const mention = mentions[mentionIndex] ?? mentions[0];
        if (mention !== undefined) insertMention(mention);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    } else if (event.key === "Escape") {
      if (working !== null) {
        event.preventDefault();
        assistant.stop();
      }
      // Escape is the field's own here: it doesn't back out of the canvas too.
      event.stopPropagation();
    }
  };

  return (
    <div className="border-t border-border-muted p-3">
      {chips.length > 0 ? (
        <ul aria-label="Selected, sent with your request" className="mb-2 flex flex-wrap gap-1">
          {chips.map((chip) => (
            <li
              key={chip.name}
              className="flex items-center gap-1 rounded-full bg-fill-subtle py-0.5 pl-2 pr-1 text-micro text-fg-soft"
            >
              {chip.label}
              <button
                type="button"
                aria-label={`Leave out ${chip.label}`}
                onClick={() => store.getState().select(selection.filter((n) => n !== chip.name))}
                className="rounded-full p-0.5 text-fg-muted hover:bg-fill-hover hover:text-fg"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="relative rounded-lg bg-fill-field focus-within:ring-1 focus-within:ring-border-emphasis">
        {mentions.length > 0 ? (
          <ul
            role="listbox"
            aria-label="Elements"
            className="absolute inset-x-0 bottom-full mb-1 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-popover"
          >
            {mentions.map((mention, index) => (
              <li key={mention.name} role="option" aria-selected={index === mentionIndex}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertMention(mention);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-label",
                    index === mentionIndex ? "bg-menu-active text-fg" : "text-fg-soft",
                  )}
                >
                  <span className="truncate">{mention.label}</span>
                  <span className="truncate text-micro text-fg-muted">@{mention.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <textarea
          ref={field}
          rows={1}
          aria-label={`Message ${config?.name ?? "the assistant"}`}
          placeholder={`Ask ${config?.name ?? "the assistant"} to build or change the diagram…`}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setCaret(event.target.selectionStart);
            setMentionIndex(0);
          }}
          onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          className="block max-h-[180px] min-h-[44px] w-full resize-none bg-transparent px-3 pt-2.5 text-label text-fg outline-none placeholder:text-fg-ghost"
        />
        <div className="flex items-center gap-2 px-2 pb-2">
          <Select
            label="Model"
            value={model}
            options={MODEL_OPTIONS(config?.models ?? null)}
            className="h-7 w-auto bg-transparent px-1.5 text-caption text-fg-muted"
            onChange={(next) => assistant.conversation.getState().setModel(next)}
          />
          {working !== null ? (
            <IconButton label="Stop" size="sm" className="ml-auto" onClick={() => assistant.stop()}>
              <Square className="fill-current" />
            </IconButton>
          ) : (
            <IconButton
              label="Send"
              size="sm"
              shape="round"
              className="ml-auto bg-fg text-fg-inverse hover:bg-fg-soft disabled:opacity-40"
              disabled={text.trim() === ""}
              onClick={send}
            >
              <ArrowUp />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}
