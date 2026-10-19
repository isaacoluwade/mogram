"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { staleVoice, voiceFiles, voiceFor } from "@mogram/core/assets";
import { deckBeats, deckInfo, deckSlides, deckTimeline } from "@mogram/core/deck";
import type { ProjectFiles } from "@mogram/core/model";
import { beatsOf } from "@mogram/core/picture";
import { EditorLoading, EditorUnavailable } from "@/components/screens";
import { loaderFor } from "@/features/canvas/use-diagram";
import { getDraft, saveDraft } from "@/features/drafts/drafts";
import { api } from "@/lib/api/client";
import { prompterChannel, withChanges, type PrompterMessage } from "./channel";
import { PrompterStage, type RecordingLink, type VoiceStatus } from "./prompter";
import { keepTake } from "./recorder";

/** What a project gives its Script window to read: a deck's beats, or a diagram's story's. */
interface Script {
  /** What's read at each beat: its script, or its caption without one. */
  readonly beats: readonly string[];
  /** The words a recording of each beat is found by; null for a beat with no script. */
  readonly scripts: readonly (string | null)[];
  readonly headings?: readonly (string | null)[];
  readonly durations?: readonly number[];
  readonly announce?: (started: number) => PrompterMessage;
  /** Where its recordings are kept. */
  readonly folder: string;
}

/** A project's script: the deck at `root`, or the story of the diagram there. */
export function scriptOf(files: ProjectFiles, root: string): Script {
  const loader = loaderFor(files);
  if (deckInfo(files, loader, root) !== null) {
    const slides = deckSlides(loader, root);
    const timeline = deckTimeline(
      loader,
      slides,
      undefined,
      (words) => voiceFor(files, root, words)?.seconds ?? null,
    );
    const beats = deckBeats(loader, slides, timeline);
    return {
      beats: beats.map((beat) => beat.script ?? beat.caption ?? ""),
      scripts: beats.map((beat) => beat.script),
      // Each slide's number and title over its first beat.
      headings: beats.map((beat, index) => {
        if (index > 0 && beats[index - 1]?.slide === beat.slide) return null;
        const slide = slides[beat.slide];
        return slide === undefined ? null : `${slide.number} · ${slide.title}`;
      }),
      durations: beats.map((beat) => beat.end - beat.start),
      // Before a word is read the deck is at its start; then at the slide of the beat begun.
      announce: (started) => {
        const beat = beats[started - 1];
        return beat === undefined
          ? { kind: "deck", slide: 0, beats: 0 }
          : { kind: "deck", slide: beat.slide, beats: beat.beat + 1 };
      },
      folder: root,
    };
  }
  const story = loader.has(root) ? loader.load(root).diagram.stories[0] : undefined;
  const beats = story === undefined ? [] : beatsOf(story);
  return {
    beats: beats.map((beat) => beat.script ?? beat.say ?? ""),
    scripts: beats.map((beat) => beat.script),
    folder: root,
  };
}

/** How long a recording waits for the editor to say it's been kept. */
const EDITOR_ANSWER_MS = 2000;

/**
 * The Script window (D-96, D-105): a deck's or a diagram's script, large, following the
 * reader's voice and moving the viewers on as it goes. Its files come from the editor in another
 * window as they change; its recordings go back to the editor to be kept, or straight into the
 * draft when no editor is open.
 */
export function ProjectPrompter({
  files: initial,
  channel,
  root = "",
  draftId,
  cloudId,
}: {
  readonly files: ProjectFiles;
  readonly channel: string;
  /** The folder of the deck or diagram to read. */
  readonly root?: string;
  /** For a draft: where a recording goes when no editor answers. */
  readonly draftId?: string;
  /** For a diagram in the account: the same, saved to it as a new version. */
  readonly cloudId?: string;
}) {
  const [files, setFiles] = useState(initial);
  // A draft re-read in this window (it was edited elsewhere) replaces what's here.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setFiles(initial);
  }
  const link = useRef<BroadcastChannel | null>(null);
  const waiting = useRef(new Map<string, (reason: string | null) => void>());
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const opened = new BroadcastChannel(channel);
    const answers = waiting.current;
    link.current = opened;
    opened.onmessage = (event: MessageEvent<PrompterMessage>) => {
      const message = event.data;
      if (message.kind === "files") setFiles(message.files);
      else if (message.kind === "voice-saved") answers.get(message.id)?.(message.reason);
    };
    // An editor of the same diagram answers with its files as they are now.
    opened.postMessage({ kind: "hello" } satisfies PrompterMessage);
    return () => {
      link.current = null;
      opened.close();
    };
  }, [channel]);

  const script = useMemo(() => scriptOf(files, root), [files, root]);
  // The same words give the same list, so files that change elsewhere don't restart the reader.
  const key = JSON.stringify(script.beats);
  const beats = useMemo(() => JSON.parse(key) as string[], [key]);

  /** Writes a recording's files: through the editor, or into the draft when none answers. */
  const keep = useCallback(
    async (changes: Readonly<Record<string, string | null>>) => {
      const id = crypto.randomUUID();
      const answer = new Promise<string | null | "none">((resolve) => {
        const timer = window.setTimeout(() => resolve("none"), EDITOR_ANSWER_MS);
        waiting.current.set(id, (reason) => {
          window.clearTimeout(timer);
          resolve(reason);
        });
      });
      link.current?.postMessage({ kind: "voice", id, files: changes } satisfies PrompterMessage);
      const reason = await answer;
      waiting.current.delete(id);
      if (reason === null) return;
      if (reason !== "none") throw new Error(reason);
      if (cloudId !== undefined) {
        // No editor has it open: saved straight to the account, on its latest version.
        const latest = await api.getDiagram(cloudId);
        const next = withChanges(latest.files, changes);
        await api.saveDiagram(cloudId, { files: { ...next }, baseVersion: latest.version });
        setFiles(next);
        return;
      }
      if (draftId === undefined)
        throw new Error("Open this diagram in the editor to keep recordings.");
      const draft = await getDraft(draftId);
      if (draft === null) throw new Error("This draft isn't in this browser any more.");
      const next = withChanges(draft.files, changes);
      if (!(await saveDraft(draftId, { name: draft.name, files: next })))
        throw new Error("This draft isn't in this browser any more.");
      setFiles(next);
    },
    [draftId, cloudId],
  );

  const { scripts, folder } = script;
  const recording = useMemo<RecordingLink>(() => {
    const every = scripts.filter((words): words is string => words !== null);
    const status = scripts.map((words): VoiceStatus => {
      if (words === null) return "none";
      if (voiceFor(files, folder, words) !== null) return "recorded";
      return staleVoice(files, folder, words, every) === null ? "none" : "stale";
    });
    return {
      status,
      canRecord: (beat) => (scripts[beat] ?? null) !== null,
      save: async (beat, take) => {
        const words = scripts[beat];
        if (words == null) return;
        const pointer = await keepTake(take);
        if (pointer === null)
          throw new Error("Nothing was heard in that take. Check the microphone, then go back.");
        await keep(voiceFiles(folder, words, pointer));
      },
    };
  }, [files, folder, scripts, keep]);

  if (beats.every((beat) => beat.trim() === ""))
    return (
      <EditorUnavailable
        title="Nothing to read yet"
        description="The Script window shows what a deck's or a diagram's story says. Give its beats a script (or a caption), then open it again."
      />
    );
  return (
    <PrompterStage
      beats={beats}
      channel={channel}
      recording={recording}
      {...(script.headings === undefined ? {} : { headings: script.headings })}
      {...(script.durations === undefined ? {} : { durations: script.durations })}
      {...(script.announce === undefined ? {} : { announce: script.announce })}
    />
  );
}

/** A draft's Script window: read from this browser, and read again when it's come back to. */
export function Prompter({ id, root = "" }: { readonly id: string; readonly root?: string }) {
  const [files, setFiles] = useState<ProjectFiles | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const load = () =>
      void getDraft(id)
        .then((draft) => alive && setFiles(draft?.files ?? null))
        .catch(() => alive && setFiles((had) => had ?? null));
    load();
    // The script is written in the editor, in another window: coming back here picks it up.
    const onVisible = () => document.visibilityState === "visible" && load();
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id]);
  if (files === undefined) return <EditorLoading label="Opening the Script window" />;
  if (files === null)
    return (
      <EditorUnavailable
        title="This draft isn't in this browser"
        description="Drafts are saved only in the browser they were made in."
      />
    );
  return <ProjectPrompter files={files} channel={prompterChannel(id)} root={root} draftId={id} />;
}
