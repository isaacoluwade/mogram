"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Download,
  FileImage,
  FileText,
  FileType2,
  Film,
  Image as ImageIcon,
  Images,
} from "lucide-react";
import { computeLayout } from "@mogram/core/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Field, Input, Label } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { buildScene } from "@/features/canvas/scene";
import { DiagramSvg } from "@/features/canvas/svg/diagram-svg";
import { resolveTheme } from "@/features/canvas/theme";
import { resolveFor, useRoutes } from "@/features/canvas/use-diagram";
import { captionAt } from "@mogram/core/picture";
import { useEditor, useEditorClock, useEditorShallow, useEditorStore } from "../editor-context";
import { storyCursor } from "../store/editor-store";
import { useEditorMoment } from "../use-editor-scene";
import { saveBlob } from "@/features/files/download";
import { DeckExportBody } from "./deck-export";
import {
  CAPTION_BAND,
  exportFrame,
  hasAnimation,
  runExport,
  storySeconds,
  supportsWebp,
  type ExportArea,
  type ExportFormat,
  type ExportOptions,
} from "../../export/export";

interface FormatInfo {
  readonly id: ExportFormat;
  readonly label: string;
  readonly description: string;
  readonly icon: ReactNode;
  readonly animated: boolean;
  readonly badge?: string;
}

const FORMATS: readonly FormatInfo[] = [
  { id: "png", label: "PNG", description: "Sharp image", icon: <ImageIcon />, animated: false },
  { id: "jpeg", label: "JPEG", description: "Smaller image", icon: <FileImage />, animated: false },
  {
    id: "svg",
    label: "SVG",
    description: "Scales to any size",
    icon: <FileType2 />,
    animated: false,
  },
  { id: "pdf", label: "PDF", description: "Print or share", icon: <FileText />, animated: false },
  {
    id: "gif",
    label: "GIF",
    description: "Plays anywhere",
    icon: <Film />,
    animated: true,
    badge: "Animated",
  },
  {
    id: "webp",
    label: "WebP",
    description: "Smaller, sharper",
    icon: <Images />,
    animated: true,
    badge: "Advanced",
  },
];

const PAGE_AREA = { value: "page", label: "Page" } as const;
const AREAS: readonly { value: ExportArea; label: string }[] = [
  { value: "fit", label: "Fit" },
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
  { value: "16:9", label: "16:9" },
  { value: "4:3", label: "4:3" },
];

const PREVIEW_RATIO = 16 / 10;

/** Export (EX-1 … EX-8): pick a format, frame and size, preview it, download it. */
export function ExportDialog() {
  const store = useEditorStore();
  const open = useEditor((s) => s.dialog === "export");
  const deckRoot = useEditor((s) => s.deckRoot);
  // In a deck, the whole deck is what's usually wanted; one slide is still a picture away.
  const [whole, setWhole] = useState(true);
  const top =
    deckRoot === null ? null : (
      <SegmentedControl
        label="What to export"
        value={whole ? "deck" : "slide"}
        onChange={(value) => setWhole(value === "deck")}
        options={[
          { value: "deck", label: "The whole deck" },
          { value: "slide", label: "This slide" },
        ]}
      />
    );
  return (
    <Dialog open={open} onOpenChange={(next) => store.getState().setDialog(next ? "export" : null)}>
      {!open ? null : deckRoot !== null && whole ? (
        <DeckExportBody deckRoot={deckRoot} top={top} />
      ) : (
        <ExportDialogBody top={top} />
      )}
    </Dialog>
  );
}

function ExportDialogBody({ top }: { top: ReactNode }) {
  const store = useEditorStore();
  const { files, root, folder, scene, step } = useEditorShallow((s) => ({
    files: s.files,
    root: s.root,
    folder: s.folder,
    scene: s.scene,
    step: s.story,
  }));
  const diagram = useEditor((s) => s.parsed().diagram);
  const animated = useMemo(() => hasAnimation(files, folder, scene), [files, folder, scene]);
  const [webp] = useState(supportsWebp);
  const nameId = useId();
  // A story belongs to the diagram the editor is on: a level inside it is exported as it stands.
  const storyLength = useMemo(() => storySeconds(files, folder, root), [files, folder, root]);
  const hasStory = storyLength !== null;

  const paged = diagram.settings.page !== null;
  const [options, setOptions] = useState<ExportOptions>(() => ({
    format: "png",
    // A page is already the size it's meant to be seen at: 1920 × 1080 for 16:9.
    scale: paged ? 1 : 2,
    transparent: false,
    area: paged ? "page" : "fit",
    animation: hasStory ? "story" : "loop",
    fps: 20,
    fileName: diagram.settings.name,
  }));
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const set = (patch: Partial<ExportOptions>) =>
    setOptions((current) => ({ ...current, ...patch }));
  const format = FORMATS.find((f) => f.id === options.format) ?? FORMATS[0];
  const isAnimated = format?.animated === true;
  const canBeTransparent =
    options.format === "png" || options.format === "svg" || options.format === "webp";
  const layout = useMemo(() => computeLayout(diagram), [diagram]);
  const captions = options.captions !== false;
  const eachBeat =
    hasStory && options.each === "beats" && (options.format === "png" || options.format === "jpeg");
  const playsStory = isAnimated && hasStory && options.animation === "story";
  const playsScenes = isAnimated && options.animation === "scenes" && diagram.scenes.length > 0;
  // The words showing on the canvas go under a still; a played story keeps room for them all.
  const cursor = folder === root ? storyCursor(diagram, step) : null;
  const worded = captions && (playsStory || eachBeat || captionAt(diagram, cursor) !== null);
  const base = exportFrame(layout.bounds, options.area, layout.page);
  const frame =
    worded && (playsStory || !isAnimated) ? { ...base, h: base.h + CAPTION_BAND } : base;
  const scale = isAnimated ? Math.min(options.scale, 1280 / frame.w) : options.scale;
  const width = Math.round(frame.w * (options.format === "svg" ? 1 : scale));
  const height = Math.round(frame.h * (options.format === "svg" ? 1 : scale));
  const sceneLabel =
    scene === null ? "Normal" : (diagram.scenes.find((s) => s.name === scene)?.label ?? scene);
  const seconds = playsStory
    ? Math.round(storyLength ?? 0)
    : playsScenes
      ? (diagram.scenes.length + 1) * 4
      : 4;
  const plays = playsStory ? "story" : playsScenes ? "scenes" : "loop";
  const nameMissing = options.fileName.trim().length === 0;
  const busy = progress !== null;

  const start = async () => {
    if (nameMissing || busy) return;
    const controller = new AbortController();
    abort.current = controller;
    setError(null);
    setProgress(0);
    try {
      const result = await runExport(
        { files, folder, root, scene, story: step, options },
        setProgress,
        controller.signal,
      );
      // Cancelled (or the dialog closed) while the last step finished: don't download anyway.
      if (controller.signal.aborted) return;
      saveBlob(result.blob, result.filename);
      store.getState().notify(`Exported ${result.filename}`);
      store.getState().setDialog(null);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "The export failed. Try a smaller scale.");
    } finally {
      abort.current = null;
      setProgress(null);
    }
  };

  return (
    <DialogContent
      size="xl"
      title="Export"
      description={
        <>
          {folder !== root ? <>This level ({folder}) · </> : null}
          {cursor !== null && step !== null && step.index >= 0
            ? "The story, at the step showing"
            : `Scene: ${sceneLabel}`}
        </>
      }
      onInteractOutside={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      {top !== null ? <div className="mb-5">{top}</div> : null}
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <ExportPreview
            area={options.area}
            transparent={canBeTransparent && options.transparent}
            words={worded && !eachBeat}
          />
          <p className="text-caption text-fg-muted tabular-nums">
            {width} × {height} {options.format === "svg" ? "units" : "px"}
            {isAnimated ? ` · ${seconds}s ${plays} · ${options.fps} fps` : null}
            {eachBeat ? " · one image per beat, zipped" : null}
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Format</Label>
            <div
              className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 md:grid-cols-3"
              role="radiogroup"
              aria-label="Format"
            >
              {FORMATS.map((item) => {
                const unavailable =
                  item.animated && !animated
                    ? "Nothing in this diagram moves yet"
                    : item.id === "webp" && !webp
                      ? "This browser can't make WebP"
                      : null;
                const selected = options.format === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={unavailable !== null || busy}
                    title={unavailable ?? undefined}
                    onClick={() => set({ format: item.id })}
                    className={cn(
                      "relative flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4",
                      selected
                        ? "border-border-emphasis bg-fill-active"
                        : "border-border bg-fill-faint hover:border-border-strong hover:bg-fill-hover",
                    )}
                  >
                    <span
                      className={cn(
                        "flex w-full items-center justify-between",
                        selected ? "text-fg" : "text-fg-secondary",
                      )}
                    >
                      {item.icon}
                      {item.badge !== undefined ? (
                        <Badge size="sm" tone={item.id === "gif" ? "green" : "neutral"}>
                          {item.badge}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-label font-medium text-fg">{item.label}</span>
                    <span className="text-micro leading-tight text-fg-muted">
                      {unavailable ?? item.description}
                    </span>
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

          <Row label="Area">
            <SegmentedControl
              label="Area"
              size="sm"
              value={options.area}
              onChange={(area) => set({ area })}
              options={paged ? [PAGE_AREA, ...AREAS] : AREAS}
            />
          </Row>

          {options.format !== "svg" && options.format !== "pdf" ? (
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
          ) : null}

          {options.format === "png" || options.format === "svg" ? (
            <Row label="Editable copy">
              <Switch
                checked={options.embed !== false}
                onCheckedChange={(embed) => set({ embed })}
                aria-label="Include an editable copy of the diagram"
                title="Open the image in Mogram later to get the diagram back"
              />
            </Row>
          ) : null}

          {canBeTransparent ? (
            <Row label="Transparent background">
              <Switch
                checked={options.transparent}
                onCheckedChange={(transparent) => set({ transparent })}
                aria-label="Transparent background"
              />
            </Row>
          ) : null}

          {hasStory && !isAnimated && (options.format === "png" || options.format === "jpeg") ? (
            <Row label="Export">
              <SegmentedControl
                label="What to export"
                size="sm"
                value={options.each ?? "one"}
                onChange={(each) => set({ each })}
                options={[
                  { value: "one", label: "This picture" },
                  { value: "beats", label: "Every beat" },
                ]}
              />
            </Row>
          ) : null}

          {hasStory ? (
            <Row label="Story's words">
              <Switch
                checked={captions}
                onCheckedChange={(next) => set({ captions: next })}
                aria-label="Show the story's words under the picture"
              />
            </Row>
          ) : null}

          {isAnimated ? (
            <>
              {diagram.scenes.length > 0 || hasStory ? (
                <Row label="Plays">
                  <SegmentedControl
                    label="Animation"
                    size="sm"
                    value={options.animation}
                    onChange={(animation) => set({ animation })}
                    options={[
                      ...(hasStory ? [{ value: "story" as const, label: "The story" }] : []),
                      { value: "loop" as const, label: "This picture" },
                      ...(diagram.scenes.length > 0
                        ? [{ value: "scenes" as const, label: "All scenes" }]
                        : []),
                    ]}
                  />
                </Row>
              ) : null}
              <Row label="Frame rate">
                <SegmentedControl
                  label="Frame rate"
                  size="sm"
                  value={String(options.fps) as "10" | "20" | "25"}
                  onChange={(value) => set({ fps: Number(value) as 10 | 20 | 25 })}
                  options={[
                    { value: "10", label: "10" },
                    { value: "20", label: "20" },
                    { value: "25", label: "25" },
                  ]}
                />
              </Row>
              <p className="text-caption text-fg-muted">
                {playsStory
                  ? "The story plays through once at its own pace, then starts over."
                  : "Every animation repeats every 4 seconds, so the file loops without a jump."}
              </p>
            </>
          ) : null}
        </div>
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
          {busy ? "Exporting…" : `Download ${format?.label ?? ""}`}
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

/** Live, animated preview of exactly the frame that will be exported. */
function ExportPreview({
  area,
  transparent,
  words,
}: {
  area: ExportArea;
  transparent: boolean;
  /** Room for the story's words under the picture, with the words showing now in it. */
  words: boolean;
}) {
  const clock = useEditorClock();
  const { files, root, folder } = useEditorShallow((s) => ({
    files: s.files,
    root: s.root,
    folder: s.folder,
  }));
  const moment = useEditorMoment();
  const diagram = useEditor((s) => s.parsed().diagram);
  const layout = useMemo(() => computeLayout(diagram), [diagram]);
  const routes = useRoutes(diagram, layout);
  const theme = useMemo(() => resolveTheme(diagram.settings), [diagram.settings]);
  const model = useMemo(
    () =>
      buildScene({
        diagram,
        files,
        layout,
        routes,
        current: resolveFor(files, folder, diagram, moment),
        theme,
        fontFamily: "Inter",
      }),
    [diagram, files, folder, layout, routes, moment, theme],
  );
  const base = exportFrame(layout.bounds, area, layout.page);
  const frame = words ? { ...base, h: base.h + CAPTION_BAND } : base;
  const caption = words
    ? {
        text: folder === root ? captionAt(diagram, moment.story) : null,
        opacity: 1,
        box: { x: frame.x, y: frame.y + frame.h - CAPTION_BAND, w: frame.w, h: CAPTION_BAND },
      }
    : undefined;
  const wide = frame.w / frame.h >= PREVIEW_RATIO;

  return (
    <div className="flex aspect-[16/10] w-full items-center justify-center rounded-xl border border-border-subtle bg-page p-3">
      <div
        className={cn(
          "max-h-full max-w-full overflow-hidden rounded-sm shadow-hairline",
          transparent && "bg-checker",
        )}
        style={{
          aspectRatio: `${frame.w} / ${frame.h}`,
          width: wide ? "100%" : "auto",
          height: wide ? "auto" : "100%",
        }}
      >
        <DiagramSvg
          scene={model}
          time={{ kind: "live", clock }}
          mode="export"
          fontFamily="var(--font-sans)"
          frame={frame}
          transparent={transparent}
          className="size-full"
          {...(caption === undefined ? {} : { caption })}
        />
      </div>
    </div>
  );
}
