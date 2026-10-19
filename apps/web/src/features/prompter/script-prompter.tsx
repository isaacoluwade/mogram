"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Play } from "lucide-react";
import { speakingTime } from "@mogram/core/picture";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

const SCRIPT = "mogram-prompter-script";
const LONGEST = 200_000;

function readScript(): string {
  try {
    return (window.localStorage.getItem(SCRIPT) ?? "").slice(0, LONGEST);
  } catch {
    return "";
  }
}

/** A script as the prompter reads it: a paragraph (a blank line apart) at a time. */
export function paragraphsOf(script: string): string[] {
  return script
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph !== "");
}

const never = (): (() => void) => () => undefined;

const length = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Any text, to read (D-96): paste what you're going to say, and read it. It's kept in this
 * browser and goes nowhere else. `onRead` is given its paragraphs when reading starts.
 */
export function ScriptDesk({ onRead }: { onRead: (paragraphs: readonly string[]) => void }) {
  // The script is in this browser, so there's nothing to show until the page is running in it.
  const here = useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
  return here ? <Desk onRead={onRead} /> : <div className="min-h-64 rounded-lg bg-fill-field" />;
}

function Desk({ onRead }: { onRead: (paragraphs: readonly string[]) => void }) {
  const [script, setScript] = useState(readScript);
  const paragraphs = useMemo(() => paragraphsOf(script), [script]);
  const words = useMemo(() => script.split(/\s+/).filter(Boolean).length, [script]);
  const seconds = Math.round(speakingTime(script));

  useEffect(() => {
    try {
      window.localStorage.setItem(SCRIPT, script);
    } catch {
      // Kept for this visit only.
    }
  }, [script]);

  return (
    <div className="flex flex-col gap-3">
      <textarea
        aria-label="Script"
        value={script}
        maxLength={LONGEST}
        spellCheck
        placeholder="So Terraform has read your file, and it has asked Azure what exists right now…"
        onChange={(event) => setScript(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && paragraphs.length > 0)
            onRead(paragraphs);
        }}
        className="min-h-64 w-full resize-y rounded-lg bg-fill-field p-4 text-body-lg leading-relaxed text-fg outline-none transition-colors duration-150 placeholder:text-fg-ghost focus:bg-fill-hover focus-visible:ring-1 focus-visible:ring-border-emphasis"
      />
      <div className="flex items-center justify-between gap-4">
        <p className="text-caption tabular-nums text-fg-muted" data-testid="script-length">
          {words === 0
            ? "A blank line starts a new paragraph. Kept in this browser."
            : `${words} ${words === 1 ? "word" : "words"} · about ${length(seconds)} to say`}
        </p>
        <Button
          variant="primary"
          disabled={paragraphs.length === 0}
          onClick={() => onRead(paragraphs)}
        >
          <Play />
          Read it
          <Kbd className="ml-1">⌘↵</Kbd>
        </Button>
      </div>
    </div>
  );
}
