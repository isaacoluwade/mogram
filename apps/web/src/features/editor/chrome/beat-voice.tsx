"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Play, Square, Trash2 } from "lucide-react";
import { keepVoice, removeVoice, staleVoice, voiceFor } from "@mogram/core/assets";
import type { ProjectFiles } from "@mogram/core/model";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { VoicePlayer } from "@/features/assets/voice-player";
import { useEditor, useEditorStore } from "../editor-context";
import { parseCached, shownFiles, slidesOf } from "../store/editor-store";

/** Every script in the deck being edited (or the diagram), so a clip still used isn't offered. */
function scriptsIn(files: ProjectFiles, folders: readonly string[]): string[] {
  return folders.flatMap((folder) =>
    parseCached(files, folder).diagram.stories.flatMap((story) =>
      story.steps.flatMap((step) => (step.script === null ? [] : [step.script])),
    ),
  );
}

/**
 * A beat's recording (D-105), under its script: none yet, one (to play or remove), or one made
 * for words that have since changed (to play, and keep for the words as they are now).
 */
export function BeatVoice({ script }: { script: string | null }) {
  const store = useEditorStore();
  const files = useEditor((state) => shownFiles(state));
  const deckRoot = useEditor((state) => state.deckRoot);
  const root = useEditor((state) => state.root);
  const folder = deckRoot ?? root;
  const [playing, setPlaying] = useState(false);
  const [player] = useState(() => new VoicePlayer(() => setPlaying(false)));
  useEffect(() => () => player.stop(), [player]);

  const scripts = useMemo(() => {
    const folders =
      deckRoot === null
        ? [root]
        : [...new Set(slidesOf(files, deckRoot).map((slide) => slide.folder))];
    return scriptsIn(files, folders);
  }, [files, deckRoot, root]);
  if (script === null || script.trim() === "") return null;
  const voice = voiceFor(files, folder, script);
  const stale = voice === null ? staleVoice(files, folder, script, scripts) : null;
  const clip = voice ?? stale;

  const toggle = () => {
    if (clip === null) return;
    if (playing) player.stop();
    else {
      setPlaying(true);
      player.play(clip);
    }
  };

  return (
    <div className="mt-1 flex items-center gap-1 text-micro text-fg-muted" data-testid="beat-voice">
      {clip !== null ? (
        <IconButton
          label={playing ? "Stop" : "Play the recording"}
          size="sm"
          shape="round"
          onClick={toggle}
        >
          {playing ? <Square /> : <Play />}
        </IconButton>
      ) : null}
      <span
        className="min-w-0 truncate"
        data-voice={voice !== null ? "recorded" : stale !== null ? "stale" : "none"}
      >
        {voice !== null
          ? `Recorded · ${voice.seconds.toFixed(1)} s`
          : stale !== null
            ? "Recorded for earlier words"
            : "Not recorded: record it in the Script window"}
      </span>
      {stale !== null ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            store.getState().edit("Keep the recording", (current) => ({
              files: keepVoice(current, folder, stale.path, script),
            }))
          }
        >
          <Check />
          Keep this recording
        </Button>
      ) : null}
      {voice !== null ? (
        <IconButton
          label="Remove the recording"
          size="sm"
          shape="round"
          onClick={() => {
            player.stop();
            store.getState().edit("Remove the recording", (current) => ({
              files: removeVoice(current, voice.path),
            }));
          }}
        >
          <Trash2 />
        </IconButton>
      ) : null}
    </div>
  );
}
