"use client";

import { createElement } from "react";
import { parseDiagram } from "@mogram/core/format";
import { computeLayout, type Box } from "@mogram/core/layout";
import type { Diagram, ProjectFiles } from "@mogram/core/model";
import { toName } from "@mogram/core/model";
import { FLOW_INFO, type FontName } from "@mogram/core/presets";
import { routeConnections } from "@mogram/core/routing";
import type { ResolvedState } from "@mogram/core/state";
import { LOOP_SECONDS, SCENE_TRANSITION, STORY_HOLD, storyAt } from "@mogram/core/timeline";
import { CONTAINER_STYLE_INFO } from "@mogram/core/presets";
import { fontStack } from "@/features/canvas/fonts";
import { iconSource, preloadIcons, type IconSource } from "@/features/canvas/icons";
import { buildScene, type SceneModel } from "@/features/canvas/scene";
import { DiagramSvg } from "@/features/canvas/svg/diagram-svg";
import { resolveTheme } from "@/features/canvas/theme";
import { loadFonts } from "@/features/canvas/text";
import { resolveFor } from "@/features/canvas/use-diagram";
import { GifEncoderClient, type GifWorker } from "./gif-client";
import { muxAnimatedWebp, type AnimatedWebpFrame } from "./webp-mux";

/** Export formats (EX-1 … EX-5). GIF and WebP are only offered when something moves. */
export type ExportFormat = "png" | "jpeg" | "svg" | "gif" | "webp";
export type ExportArea = "fit" | "1:1" | "4:5" | "16:9" | "4:3" | "16:10";

export interface ExportOptions {
  readonly format: ExportFormat;
  readonly scale: 1 | 2 | 3;
  readonly transparent: boolean;
  readonly area: ExportArea;
  /** Loop the current scene, or play every scene in order (EX-6). */
  readonly animation: "loop" | "story";
  readonly fps: 10 | 20 | 25;
  readonly fileName: string;
}

export interface ExportRequest {
  readonly files: ProjectFiles;
  /** The diagram level to export — top level or any nested level (EX-8). */
  readonly folder: string;
  readonly scene: string | null;
  readonly options: ExportOptions;
}

export interface ExportResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly width: number;
  readonly height: number;
}

const PADDING = 48;
const MAX_ANIMATED_WIDTH = 1280;
const ASPECTS: Readonly<Record<Exclude<ExportArea, "fit">, number>> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "16:10": 16 / 10,
};

/** True when the diagram has anything to animate: traffic, motion, overload, or several scenes. */
export function hasAnimation(files: ProjectFiles, folder: string, scene: string | null): boolean {
  const { diagram } = parseDiagram(files, folder);
  if (diagram.scenes.length > 0) return true;
  const resolved = resolveFor(files, folder, diagram, scene);
  for (const status of resolved.connections.values())
    if (FLOW_INFO[status.flow].animated) return true;
  for (const status of resolved.elements.values())
    if (status.motion !== "none" || status.state === "overloaded") return true;
  return false;
}

export function exportFrame(bounds: Box, area: ExportArea): Box {
  const box = {
    x: bounds.x - PADDING,
    y: bounds.y - PADDING,
    w: Math.max(1, bounds.w) + PADDING * 2,
    h: Math.max(1, bounds.h) + PADDING * 2,
  };
  if (area === "fit") return box;
  const ratio = ASPECTS[area];
  if (box.w / box.h > ratio) {
    const h = box.w / ratio;
    return { ...box, y: box.y - (h - box.h) / 2, h };
  }
  const w = box.h * ratio;
  return { ...box, x: box.x - (w - box.w) / 2, w };
}

async function fontAsDataUrl(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Couldn't load the font ${path} (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:font/woff2;base64,${btoa(binary)}`;
}

/** Each font's file, under the family name the app's font stacks use (see canvas/fonts.ts). */
const FONT_FILES: Readonly<Record<FontName, { file: string; family: string; weight: string }>> = {
  inter: { file: "/fonts/inter-latin-wght-normal.woff2", family: "Inter", weight: "100 900" },
  geist: { file: "/fonts/geist-latin-wght-normal.woff2", family: "Geist", weight: "100 900" },
  instrument: {
    file: "/fonts/instrument-sans-latin-wght-normal.woff2",
    family: "instrument",
    weight: "400 700",
  },
  mono: {
    file: "/fonts/geist-mono-latin-wght-normal.woff2",
    family: "geistMono",
    weight: "100 900",
  },
};

const fontFaces = new Map<FontName, Promise<string>>();

function fontFace(font: FontName): Promise<string> {
  let face = fontFaces.get(font);
  if (face === undefined) {
    const { file, family, weight } = FONT_FILES[font];
    face = fontAsDataUrl(file).then(
      (url) =>
        `@font-face{font-family:"${family}";src:url(${url}) format("woff2");font-weight:${weight};}`,
      (error: unknown) => {
        fontFaces.delete(font); // the next export tries again rather than reusing the failure
        throw error;
      },
    );
    fontFaces.set(font, face);
  }
  return face;
}

/**
 * Inter and Geist, plus any font a note or text picked, embedded so exported text matches the
 * screen exactly (D-10, ED-25).
 */
async function embeddedFonts(used: ReadonlySet<FontName>): Promise<string> {
  const fonts = new Set<FontName>(["inter", "geist", ...used]);
  const faces = await Promise.all([...fonts].map(fontFace));
  return `${faces.join("")}svg{--font-display:"Geist","Inter",sans-serif;}`;
}

/** Fonts the diagram's free text and notes use. */
function fontsUsed(diagram: Diagram): Set<FontName> {
  const used = new Set<FontName>();
  for (const decoration of diagram.decorations.values()) {
    if (decoration.variant === "text" || decoration.variant === "note") {
      if (decoration.look.font !== null) used.add(decoration.look.font);
    }
  }
  return used;
}

interface Prepared {
  readonly frame: Box;
  readonly theme: ReturnType<typeof resolveTheme>;
  readonly modelFor: (
    current: ResolvedState,
    previous: ResolvedState | null,
    transitionStart: number | null,
  ) => SceneModel;
  readonly resolvedFor: (scene: string | null) => ResolvedState;
  readonly sceneNames: readonly (string | null)[];
  readonly title: string;
  readonly fonts: ReadonlySet<FontName>;
}

async function prepare(request: ExportRequest): Promise<Prepared> {
  const { files, folder } = request;
  const { diagram } = parseDiagram(files, folder);
  const layout = computeLayout(diagram);
  const routes = routeConnections(diagram, layout);
  const theme = resolveTheme(diagram.settings);
  const icons: IconSource[] = [...diagram.components.values()].map((c) =>
    iconSource(c.type, files, folder),
  );
  for (const container of diagram.containers.values()) {
    icons.push(
      iconSource(container.icon ?? CONTAINER_STYLE_INFO[container.type].icon, files, folder),
    );
  }
  const fonts = fontsUsed(diagram);
  // Measure with the real fonts: wrapping in notes depends on them.
  await Promise.all([preloadIcons(icons), loadFonts([...fonts].map(fontStack))]);
  const cache = new Map<string, ResolvedState>();
  const resolvedFor = (scene: string | null): ResolvedState => {
    const key = scene ?? "";
    let value = cache.get(key);
    if (value === undefined) {
      value = resolveFor(files, folder, diagram, scene);
      cache.set(key, value);
    }
    return value;
  };
  return {
    frame: exportFrame(layout.bounds, request.options.area),
    theme,
    resolvedFor,
    sceneNames: [null, ...diagram.scenes.map((s) => s.name)],
    title: diagram.settings.name,
    fonts,
    modelFor: (current, previous, transitionStart) =>
      buildScene({
        diagram,
        files,
        layout,
        routes,
        current,
        previous,
        transitionStart,
        theme,
        fontFamily: "Inter",
      }),
  };
}

async function markup(
  prepared: Prepared,
  model: SceneModel,
  t: number,
  transparent: boolean,
): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const style = await embeddedFonts(prepared.fonts);
  const element = createElement(DiagramSvg, {
    scene: model,
    time: { kind: "static", t },
    mode: "export",
    fontFamily: "Inter, sans-serif",
    frame: prepared.frame,
    transparent,
    embeddedStyle: style,
    title: prepared.title,
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n${renderToStaticMarkup(element)}`;
}

async function rasterize(
  svg: string,
  width: number,
  height: number,
  matte: string | null,
): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The diagram couldn't be drawn as an image."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("Canvas isn't available in this browser.");
    if (matte !== null) {
      ctx.fillStyle = matte;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob === null
          ? reject(new Error(`This browser can't create ${type} images.`))
          : resolve(blob),
      type,
      quality,
    );
  });
}

/** Whether the browser can encode WebP frames (needed for animated WebP). */
export function supportsWebp(): boolean {
  if (typeof document === "undefined") return false;
  return document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
}

export function defaultFileName(name: string): string {
  return toName(name, "diagram").replace(/_/g, "-");
}

/** Renders the export. `onProgress` receives 0…1; `signal` cancels long animated exports. */
export async function runExport(
  request: ExportRequest,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<ExportResult> {
  const { options } = request;
  const prepared = await prepare(request);
  const filename = `${defaultFileName(options.fileName)}.${options.format === "jpeg" ? "jpg" : options.format}`;

  if (options.format === "svg") {
    const model = prepared.modelFor(prepared.resolvedFor(request.scene), null, null);
    const svg = await markup(prepared, model, 0, options.transparent);
    onProgress(1);
    return {
      blob: new Blob([svg], { type: "image/svg+xml" }),
      filename,
      width: Math.round(prepared.frame.w),
      height: Math.round(prepared.frame.h),
    };
  }

  if (options.format === "png" || options.format === "jpeg") {
    const width = Math.round(prepared.frame.w * options.scale);
    const height = Math.round(prepared.frame.h * options.scale);
    const transparent = options.format === "png" && options.transparent;
    const model = prepared.modelFor(prepared.resolvedFor(request.scene), null, null);
    const svg = await markup(prepared, model, 0, transparent);
    const canvas = await rasterize(
      svg,
      width,
      height,
      options.format === "jpeg" ? prepared.theme.base : null,
    );
    const blob = await toBlob(canvas, options.format === "png" ? "image/png" : "image/jpeg", 0.92);
    onProgress(1);
    return { blob, filename, width, height };
  }

  // Animated: sample the shared clock frame by frame (PR-9). Every period divides 4s, so the
  // last frame flows straight into the first (EX-7).
  const scale = Math.min(options.scale, MAX_ANIMATED_WIDTH / prepared.frame.w);
  const width = Math.max(2, Math.round(prepared.frame.w * scale));
  const height = Math.max(2, Math.round(prepared.frame.h * scale));
  const sceneCount = prepared.sceneNames.length;
  const story = options.animation === "story" && sceneCount > 1;
  const duration = story ? sceneCount * STORY_HOLD : LOOP_SECONDS;
  const frameCount = Math.round(duration * options.fps);
  const delay = Math.round(1000 / options.fps);
  const transparent = options.format === "webp" && options.transparent;

  const modelAt = (t: number): SceneModel => {
    if (!story) return prepared.modelFor(prepared.resolvedFor(request.scene), null, null);
    const position = storyAt(t, sceneCount);
    const local = ((t % duration) + duration) % duration;
    const transitionStart = t - (local - position.to * STORY_HOLD);
    const inTransition = local - position.to * STORY_HOLD < SCENE_TRANSITION;
    const current = prepared.resolvedFor(prepared.sceneNames[position.to] ?? null);
    const previous = inTransition
      ? prepared.resolvedFor(prepared.sceneNames[position.from] ?? null)
      : null;
    return prepared.modelFor(current, previous, inTransition ? transitionStart : null);
  };

  if (options.format === "gif") {
    // Rendering and encoding overlap, so progress counts both halves of the work.
    let rendered = 0;
    let encoded = 0;
    const report = () => onProgress((rendered + encoded) / (2 * frameCount));
    const worker = new Worker(new URL("./gif.worker.ts", import.meta.url), {
      type: "module",
    }) as GifWorker;
    const encoder = new GifEncoderClient(
      worker,
      { width, height },
      (count) => {
        encoded = count;
        report();
      },
      signal,
    );
    try {
      for (let i = 0; i < frameCount; i++) {
        encoder.check();
        const t = i / options.fps;
        const canvas = await rasterize(
          await markup(prepared, modelAt(t), t, false),
          width,
          height,
          prepared.theme.base,
        );
        const ctx = canvas.getContext("2d");
        if (ctx === null) throw new Error("Canvas isn't available in this browser.");
        await encoder.add(ctx.getImageData(0, 0, width, height).data, delay);
        rendered = i + 1;
        report();
      }
      const bytes = await encoder.finish();
      return {
        blob: new Blob([bytes.slice().buffer], { type: "image/gif" }),
        filename,
        width,
        height,
      };
    } finally {
      encoder.dispose();
    }
  }

  const frames: AnimatedWebpFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    if (signal?.aborted === true) throw new DOMException("Export cancelled", "AbortError");
    const t = i / options.fps;
    const canvas = await rasterize(
      await markup(prepared, modelAt(t), t, transparent),
      width,
      height,
      transparent ? null : prepared.theme.base,
    );
    const blob = await toBlob(canvas, "image/webp", 0.9);
    frames.push({ webp: new Uint8Array(await blob.arrayBuffer()), duration: delay });
    onProgress((i + 1) / frameCount);
  }
  const bytes = muxAnimatedWebp(frames, width, height);
  return {
    blob: new Blob([bytes.slice().buffer], { type: "image/webp" }),
    filename,
    width,
    height,
  };
}

const THUMBNAIL = { width: 480, height: 300 } as const;

/** Small JPEG of the top level for dashboard cards (stored with the draft or cloud diagram). */
export async function renderThumbnail(files: ProjectFiles): Promise<string> {
  const options: ExportOptions = {
    format: "jpeg",
    scale: 1,
    transparent: false,
    area: "16:10",
    animation: "loop",
    fps: 10,
    fileName: "thumbnail",
  };
  const prepared = await prepare({ files, folder: "", scene: null, options });
  const model = prepared.modelFor(prepared.resolvedFor(null), null, null);
  const svg = await markup(prepared, model, 0.5, false);
  const canvas = await rasterize(svg, THUMBNAIL.width, THUMBNAIL.height, prepared.theme.base);
  return canvas.toDataURL("image/jpeg", 0.78);
}
