"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Captions,
  Clapperboard,
  Download,
  FileText,
  Images,
  ListOrdered,
  ScrollText,
} from "lucide-react";
import { voiceFor } from "@mogram/core/assets";
import { deckSlides, deckTimeline } from "@mogram/core/deck";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Label } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/cn";
import { loaderFor } from "@/features/canvas/use-diagram";
import { saveBlob } from "@/features/files/download";
import {
  runDeckExport,
  type DeckExportKind,
  type DeckExportOptions,
} from "../../export/deck-export";
import { useEditor, useEditorStore } from "../editor-context";
import { parseCached } from "../store/editor-store";

const KINDS: readonly {
  readonly id: DeckExportKind;
  readonly label: string;
  readonly description: string;
  readonly icon: ReactNode;
}[] = [
  { id: "pdf", label: "PDF", description: "A page a slide or a beat", icon: <FileText /> },
  { id: "images", label: "Images", description: "Zipped, by section", icon: <Images /> },
  {
    id: "video",
    label: "Video",
    description: "At its own times, with voice",
    icon: <Clapperboard />,
  },
  { id: "script", label: "Script", description: "Every beat's words", icon: <ScrollText /> },
  { id: "subtitles", label: "Subtitles", description: "A .vtt for the video", icon: <Captions /> },
  { id: "chapters", label: "Chapters", description: "0:00 Section lines", icon: <ListOrdered /> },
];

function clock(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Export for a whole deck (D-106): every slide's picture, its words, or the deck as a video. */
export function DeckExportBody({ deckRoot, top }: { deckRoot: string; top: ReactNode }) {
  const store = useEditorStore();
  const files = useEditor((s) => s.files);
  const deck = parseCached(files, deckRoot).diagram;
  const nameId = useId();
  const [options, setOptions] = useState<DeckExportOptions>(() => ({
    kind: "pdf",
    each: "slide",
    imageFormat: "png",
    scale: 1,
    height: 1080,
    fps: 30,
    fileName: deck.settings.name,
  }));
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const set = (patch: Partial<DeckExportOptions>) =>
    setOptions((current) => ({ ...current, ...patch }));

  const summary = useMemo(() => {
    const loader = loaderFor(files);
    const slides = deckSlides(loader, deckRoot);
    const timeline = deckTimeline(
      loader,
      slides,
      undefined,
      (words) => voiceFor(files, deckRoot, words)?.seconds ?? null,
    );
    const beats = timeline.slides.reduce(
      (sum, slide) => sum + Math.max(1, slide.segments.filter((each) => each.endsBeat).length),
      0,
    );
    return { slides: slides.length, beats, seconds: timeline.duration };
  }, [files, deckRoot]);

  const busy = progress !== null;
  const nameMissing = options.fileName.trim() === "";
  const stills = options.kind === "pdf" || options.kind === "images";
  const kind = KINDS.find((item) => item.id === options.kind) ?? KINDS[0];
  const detail = stills
    ? `${options.each === "slide" ? summary.slides : summary.beats} ${options.kind === "pdf" ? "pages" : "images"}`
    : options.kind === "video"
      ? `${clock(summary.seconds + 1)} · ${options.height}p · ${options.fps} fps · WebM`
      : `${summary.slides} slides · ${clock(summary.seconds)} at the deck's own pace`;

  const start = async () => {
    if (nameMissing || busy) return;
    const controller = new AbortController();
    abort.current = controller;
    setError(null);
    setProgress(0);
    try {
      const result = await runDeckExport(files, deckRoot, options, setProgress, controller.signal);
      if (controller.signal.aborted) return;
      saveBlob(result.blob, result.filename);
      store.getState().notify(`Exported ${result.filename}`);
      store.getState().setDialog(null);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "The export failed.");
    } finally {
      abort.current = null;
      setProgress(null);
    }
  };

  return (
    <DialogContent
      size="xl"
      title="Export"
      description={`The whole deck · ${summary.slides} slides`}
      onInteractOutside={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <div className="flex flex-col gap-5">
        {top}
        <div className="flex flex-col gap-2">
          <Label>Format</Label>
          <div
            className="grid grid-cols-2 gap-1.5 sm:grid-cols-3"
            role="radiogroup"
            aria-label="Format"
          >
            {KINDS.map((item) => {
              const selected = options.kind === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={busy}
                  onClick={() => set({ kind: item.id })}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4",
                    selected
                      ? "border-border-emphasis bg-fill-active"
                      : "border-border bg-fill-faint hover:border-border-strong hover:bg-fill-hover",
                  )}
                >
                  <span className={selected ? "text-fg" : "text-fg-secondary"}>{item.icon}</span>
                  <span className="text-label font-medium text-fg">{item.label}</span>
                  <span className="text-micro leading-tight text-fg-muted">{item.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Field
          label="File name"
          htmlFor={nameId}
          error={nameMissing ? "A file name is required." : null}
        >
          <Input
            id={nameId}
            value={options.fileName}
            onChange={(event) => set({ fileName: event.target.value })}
            aria-invalid={nameMissing}
            disabled={busy}
          />
        </Field>

        {stills ? (
          <Row label="A page for">
            <SegmentedControl
              label="A page for"
              size="sm"
              value={options.each}
              onChange={(each) => set({ each })}
              options={[
                { value: "slide", label: "Each slide" },
                { value: "beat", label: "Each beat" },
              ]}
            />
          </Row>
        ) : null}
        {options.kind === "images" ? (
          <>
            <Row label="Images">
              <SegmentedControl
                label="Image format"
                size="sm"
                value={options.imageFormat}
                onChange={(imageFormat) => set({ imageFormat })}
                options={[
                  { value: "png", label: "PNG" },
                  { value: "jpeg", label: "JPEG" },
                ]}
              />
            </Row>
            <Row label="Scale">
              <SegmentedControl
                label="Scale"
                size="sm"
                value={String(options.scale) as "1" | "2" | "3"}
                onChange={(value) => set({ scale: Number(value) as 1 | 2 | 3 })}
                options={[
                  { value: "1", label: "1×" },
                  { value: "2", label: "2×" },
                  { value: "3", label: "3×" },
                ]}
              />
            </Row>
          </>
        ) : null}
        {options.kind === "video" ? (
          <>
            <Row label="Size">
              <SegmentedControl
                label="Video size"
                size="sm"
                value={String(options.height) as "1080" | "2160"}
                onChange={(value) => set({ height: Number(value) as 1080 | 2160 })}
                options={[
                  { value: "1080", label: "1080p" },
                  { value: "2160", label: "4K" },
                ]}
              />
            </Row>
            <Row label="Frame rate">
              <SegmentedControl
                label="Frame rate"
                size="sm"
                value={String(options.fps) as "30" | "60"}
                onChange={(value) => set({ fps: Number(value) as 30 | 60 })}
                options={[
                  { value: "30", label: "30" },
                  { value: "60", label: "60" },
                ]}
              />
            </Row>
            <p className="text-caption text-fg-muted">
              The deck plays at its own pace with each beat&apos;s recording, made in this browser.
              It takes about as long as the deck runs.
            </p>
          </>
        ) : null}
        <p className="text-caption tabular-nums text-fg-muted" data-testid="deck-export-detail">
          {detail}
        </p>
      </div>

      {error !== null ? (
        <p
          role="alert"
          className="mt-5 rounded-md border border-rose-line bg-rose-fill px-3 py-2 text-label text-rose"
        >
          {error}
        </p>
      ) : null}

      <DialogFooter className="justify-between">
        <div className="min-w-0 flex-1">
          {progress !== null ? (
            <div className="flex items-center gap-3">
              <Progress value={progress} label="Export progress" className="max-w-60" />
              <span aria-hidden className="text-caption tabular-nums text-fg-secondary">
                {Math.round(progress * 100)}%
              </span>
            </div>
          ) : null}
        </div>
        <Button
          variant="ghost"
          onClick={() => (busy ? abort.current?.abort() : store.getState().setDialog(null))}
        >
          Cancel
        </Button>
        <Button variant="primary" onClick={() => void start()} disabled={nameMissing || busy}>
          <Download />
          {busy ? "Exporting…" : `Download ${kind?.label ?? ""}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-label font-medium text-fg-soft">{label}</span>
      {children}
    </div>
  );
}
