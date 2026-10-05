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
import { useEditor, useEditorClock, useEditorShallow, useEditorStore } from "../editor-context";
import { saveBlob } from "@/features/files/download";
import {
  exportFrame,
  hasAnimation,
  runExport,
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
  return (
    <Dialog open={open} onOpenChange={(next) => store.getState().setDialog(next ? "export" : null)}>
      {open ? <ExportDialogBody /> : null}
    </Dialog>
  );
}

function ExportDialogBody() {
  const store = useEditorStore();
  const { files, folder, scene } = useEditorShallow((s) => ({
    files: s.files,
    folder: s.folder,
    scene: s.scene,
  }));
  const diagram = useEditor((s) => s.parsed().diagram);
  const animated = useMemo(() => hasAnimation(files, folder, scene), [files, folder, scene]);
  const [webp] = useState(supportsWebp);
  const nameId = useId();

  const [options, setOptions] = useState<ExportOptions>(() => ({
    format: "png",
    scale: 2,
    transparent: false,
    area: "fit",
    animation: "loop",
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
  const frame = exportFrame(layout.bounds, options.area);
  const scale = isAnimated ? Math.min(options.scale, 1280 / frame.w) : options.scale;
  const width = Math.round(frame.w * (options.format === "svg" ? 1 : scale));
  const height = Math.round(frame.h * (options.format === "svg" ? 1 : scale));
  const sceneLabel =
    scene === null ? "Normal" : (diagram.scenes.find((s) => s.name === scene)?.label ?? scene);
  const story = options.animation === "story" && diagram.scenes.length > 0;
  const seconds = story ? (diagram.scenes.length + 1) * 4 : 4;
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
        { files, folder, scene, options },
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
          {folder.length > 0 ? <>This level ({folder}) · </> : null}
          Scene: {sceneLabel}
        </>
      }
      onInteractOutside={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <ExportPreview
            area={options.area}
            transparent={canBeTransparent && options.transparent}
          />
          <p className="text-caption text-fg-muted tabular-nums">
            {width} × {height} {options.format === "svg" ? "units" : "px"}
            {isAnimated ? ` · ${seconds}s ${story ? "story" : "loop"} · ${options.fps} fps` : null}
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
              options={AREAS}
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

          {isAnimated ? (
            <>
              {diagram.scenes.length > 0 ? (
                <Row label="Plays">
                  <SegmentedControl
                    label="Animation"
                    size="sm"
                    value={options.animation}
                    onChange={(animation) => set({ animation })}
                    options={[
                      { value: "loop", label: "This scene" },
                      { value: "story", label: "All scenes" },
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
                Every animation repeats every 4 seconds, so the file loops without a jump.
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
function ExportPreview({ area, transparent }: { area: ExportArea; transparent: boolean }) {
  const clock = useEditorClock();
  const { files, folder, scene } = useEditorShallow((s) => ({
    files: s.files,
    folder: s.folder,
    scene: s.scene,
  }));
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
        current: resolveFor(files, folder, diagram, scene),
        theme,
        fontFamily: "Inter",
      }),
    [diagram, files, folder, layout, routes, scene, theme],
  );
  const frame = exportFrame(layout.bounds, area);
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
        />
      </div>
    </div>
  );
}
