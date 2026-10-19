"use client";

import { CapacityTimeline } from "@mogram/core/capacity";
import { settledCapacity, type CapacityRuntime } from "@/features/canvas/capacity";
import { createElement } from "react";
import { parseDiagram } from "@mogram/core/format";
import { deckInfo, deckSlides, slideClosing, slideDiagram } from "@mogram/core/deck";
import { computeLayout, type Box } from "@mogram/core/layout";
import type { Diagram, ProjectFiles } from "@mogram/core/model";
import { DiagramLoader } from "@mogram/core/nested";
import { toName } from "@mogram/core/model";
import { FLOW_INFO, type FontName } from "@mogram/core/presets";
import { routeConnections } from "@mogram/core/routing";
import type { ResolvedState } from "@mogram/core/state";
import { LOOP_SECONDS, SCENE_TRANSITION, SCENE_HOLD, scenesAt } from "@mogram/core/timeline";
import {
  captionAt,
  cursorAtStep,
  segmentAt,
  storyTimeline,
  type Moment,
  type StepRef,
  type StoryCursor,
  type StoryTimeline,
} from "@mogram/core/picture";
import { strToU8, zipSync, type Zippable } from "fflate";
import { CONTAINER_STYLE_INFO } from "@mogram/core/presets";
import { fontStack } from "@/features/canvas/fonts";
import { iconSource, preloadIcons, type IconSource } from "@/features/canvas/icons";
import { preparePictures } from "@/features/assets/pictures";
import { buildScene, type SceneModel } from "@/features/canvas/scene";
import { DiagramSvg } from "@/features/canvas/svg/diagram-svg";
import { resolveTheme } from "@/features/canvas/theme";
import { loadFonts } from "@/features/canvas/text";
import { resolveFor } from "@/features/canvas/use-diagram";
import { GifEncoderClient, type GifWorker } from "./gif-client";
import { muxAnimatedWebp, type AnimatedWebpFrame } from "./webp-mux";
import { embedInPng, embedInSvg } from "./embed";
import { jpegToPdf } from "./pdf";

/** Export formats (EX-1 … EX-5). GIF and WebP are only offered when something moves. */
export type ExportFormat = "png" | "jpeg" | "svg" | "pdf" | "gif" | "webp";
/** `page` is the diagram's own page (D-98), exactly, with nothing around it. */
export type ExportArea = "page" | "fit" | "1:1" | "4:5" | "16:9" | "4:3" | "16:10";

export interface ExportOptions {
  readonly format: ExportFormat;
  readonly scale: 1 | 2 | 3;
  readonly transparent: boolean;
  readonly area: ExportArea;
  /** Loop the current scene, play every scene in order (EX-6), or play the story (D-86). */
  readonly animation: "loop" | "scenes" | "story";
  /** Draw the story's words under the diagram (D-86). On unless turned off. */
  readonly captions?: boolean;
  /** A still of the picture showing, or one of each beat of the story, zipped. */
  readonly each?: "one" | "beats";
  readonly fps: 10 | 20 | 25;
  readonly fileName: string;
  /**
   * Put the diagram's files inside the PNG or SVG, so opening the image in Mogram gives the
   * diagram back (07 §18 P0-6). On unless turned off.
   */
  readonly embed?: boolean;
}

export interface ExportRequest {
  readonly files: ProjectFiles;
  /** The diagram level to export — top level or any nested level (EX-8). */
  readonly folder: string;
  /**
   * The folder of the diagram whose story plays (D-97): the project's own unless said. A level
   * reached from it through `opens` is exported as it stands.
   */
  readonly root?: string;
  readonly scene: string | null;
  /** The step of the story showing (D-86): a still is the picture once it has played. */
  readonly story?: StepRef | null;
  /** Internal composed diagram, used for deck slide thumbnails with inherited settings. */
  readonly diagram?: Diagram;
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
const ASPECTS: Readonly<Record<Exclude<ExportArea, "fit" | "page">, number>> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "16:10": 16 / 10,
};

/**
 * True when the diagram has anything to animate: traffic, motion, overload, several scenes, or
 * capacity (its traffic always flows, and patterns make things scale, D-82, D-84).
 */
export function hasAnimation(files: ProjectFiles, folder: string, scene: string | null): boolean {
  const { diagram } = parseDiagram(files, folder);
  if (diagram.scenes.length > 0 || diagram.stories.length > 0) return true;
  const resolved = resolveFor(files, folder, diagram, scene);
  if (resolved.capacity.active) return true;
  for (const status of resolved.connections.values())
    if (FLOW_INFO[status.flow].animated) return true;
  for (const status of resolved.elements.values())
    if (status.motion !== "none" || status.state === "overloaded") return true;
  return false;
}

/** `box` grown to a ratio, centred. */
function grownTo(box: Box, ratio: number): Box {
  if (box.w / box.h > ratio) {
    const h = box.w / ratio;
    return { ...box, y: box.y - (h - box.h) / 2, h };
  }
  const w = box.h * ratio;
  return { ...box, x: box.x - (w - box.w) / 2, w };
}

/**
 * What an export shows. The page, when that's asked for and there is one, is exactly the page;
 * every other area is the contents with room around them, grown to the ratio asked for.
 */
export function exportFrame(bounds: Box, area: ExportArea, page: Box | null = null): Box {
  if (area === "page" && page !== null) return page;
  const box = {
    x: bounds.x - PADDING,
    y: bounds.y - PADDING,
    w: Math.max(1, bounds.w) + PADDING * 2,
    h: Math.max(1, bounds.h) + PADDING * 2,
  };
  if (area === "fit" || area === "page") return box;
  return grownTo(box, ASPECTS[area]);
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

/** Fonts the diagram's free text and notes use, and the mono a code listing is set in (D-103). */
export function fontsUsed(diagram: Diagram): Set<FontName> {
  const used = new Set<FontName>();
  for (const decoration of diagram.decorations.values()) {
    if (decoration.variant === "text" || decoration.variant === "note") {
      if (decoration.look.font !== null) used.add(decoration.look.font);
    }
  }
  for (const component of diagram.components.values())
    if (component.code !== null) used.add("mono");
  return used;
}

interface Prepared {
  readonly frame: Box;
  /** The diagram's page, when it has one. */
  readonly page: Box | null;
  readonly theme: ReturnType<typeof resolveTheme>;
  readonly modelFor: (
    current: ResolvedState,
    previous: ResolvedState | null,
    transitionStart: number | null,
    transitionSeconds?: number,
    ramp?: { readonly start: number; readonly seconds: number } | null,
  ) => SceneModel;
  /** The state in a scene, or at a moment of the story. */
  readonly resolvedFor: (at: Moment | string | null) => ResolvedState;
  /** The story's timeline, when this is the top diagram and it has one. */
  readonly story: StoryTimeline | null;
  readonly sceneNames: readonly (string | null)[];
  readonly title: string;
  readonly fonts: ReadonlySet<FontName>;
  readonly diagram: Diagram;
}

async function prepare(request: ExportRequest): Promise<Prepared> {
  const { files, folder } = request;
  const diagram = request.diagram ?? parseDiagram(files, folder).diagram;
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
  await Promise.all([
    preloadIcons(icons),
    preparePictures(files),
    loadFonts([...fonts].map(fontStack)),
  ]);
  const cache = new Map<string, ResolvedState>();
  const resolvedFor = (at: Moment | string | null): ResolvedState => {
    const key = momentKey(at);
    let value = cache.get(key);
    if (value === undefined) {
      value = resolveFor(files, folder, diagram, at);
      cache.set(key, value);
    }
    return value;
  };
  return {
    frame: exportFrame(layout.bounds, request.options.area, layout.page),
    page: layout.page,
    theme,
    resolvedFor,
    // A story belongs to the diagram being viewed: a level inside it is exported as it stands.
    story: folder === (request.root ?? "") ? storyTimeline(diagram) : null,
    sceneNames: [null, ...diagram.scenes.map((s) => s.name)],
    title: diagram.settings.name,
    fonts,
    diagram,
    modelFor: (current, previous, transitionStart, transitionSeconds, ramp) =>
      buildScene({
        ...(ramp == null ? {} : { ramp }),
        diagram,
        files,
        layout,
        routes,
        current,
        previous,
        transitionStart,
        ...(transitionSeconds === undefined ? {} : { transitionSeconds }),
        theme,
        fontFamily: "Inter",
      }),
  };
}

/** One diagram's pictures as SVG, for an export that draws many of them: a deck's (D-106). */
export interface LayerRenderer {
  /** The page (or the diagram's bounds without one), in px at scale 1. */
  readonly page: Box;
  /** The colour behind everything. */
  readonly base: string;
  /**
   * The picture at `to` drawn on `stage` (a box at scale 1) with nothing behind it, at time `t`;
   * while it's changing from `from`, part way.
   */
  svg(
    to: Moment,
    stage: Box,
    t?: number,
    from?: { readonly moment: Moment; readonly start: number; readonly seconds: number } | null,
  ): Promise<string>;
}

export async function layerRenderer(request: {
  readonly files: ProjectFiles;
  readonly folder: string;
  readonly scene: string | null;
  readonly diagram: Diagram;
}): Promise<LayerRenderer> {
  const prepared = await prepare({
    ...request,
    root: request.folder,
    options: {
      format: "png",
      scale: 1,
      transparent: true,
      area: "page",
      animation: "story",
      fps: 10,
      fileName: "deck",
    },
  });
  return {
    page: prepared.page ?? prepared.frame,
    base: prepared.theme.base,
    svg: async (to, stage, t = 0, from = null) => {
      const staged = { ...prepared, frame: stage };
      const changing = from !== null && t - from.start < from.seconds;
      const model = staged.modelFor(
        staged.resolvedFor(to),
        changing ? staged.resolvedFor(from.moment) : null,
        changing ? from.start : null,
        from?.seconds,
      );
      return markup(staged, model, t, true, changing ? null : still(staged, to));
    },
  };
}

/** A name for a moment, so its state is worked out once per export. */
function momentKey(at: Moment | string | null): string {
  if (at === null || typeof at === "string") return at ?? "";
  const story = at.story;
  if (story === null) return at.scene ?? "";
  const played = story.played.map((ref) => `${ref.story}.${ref.index}`).join(",");
  return `${at.scene ?? ""}|${story.story}|${played}|${story.rewound ? "r" : ""}`;
}

/** Room under the diagram for the story's words, in px at scale 1. */
export const CAPTION_BAND = 92;

/** The export frame with room for captions under it. */
function withCaptionBand(frame: Box): Box {
  return { ...frame, h: frame.h + CAPTION_BAND };
}

/** Where the words go: the band under the diagram. */
function captionBox(frame: Box): Box {
  return { x: frame.x, y: frame.y + frame.h - CAPTION_BAND, w: frame.w, h: CAPTION_BAND };
}

/** A still picture's capacity: the scene's plan, settled. */
/**
 * How long an animation with a traffic pattern runs so it loops: a whole number of the pattern's
 * cycles and of the 4 s every motion repeats in, kept to 40 s (beyond that, one cycle).
 */
function patternLoop(cycle: number): number {
  const halves = (n: number) => Math.max(1, Math.round(n * 2));
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const a = halves(cycle);
  const b = halves(LOOP_SECONDS);
  const both = (a * b) / gcd(a, b) / 2;
  return both <= 40 ? both : cycle;
}

function still(prepared: Prepared, at: Moment | string | null): CapacityRuntime | null {
  return settledCapacity(prepared.diagram, prepared.resolvedFor(at));
}

/** The story's words to draw under a frame: the text, and how far it has faded in (0–1). */
interface Caption {
  readonly text: string | null;
  readonly opacity: number;
}

async function markup(
  prepared: Prepared,
  model: SceneModel,
  t: number,
  transparent: boolean,
  capacity: CapacityRuntime | null = null,
  caption: Caption | null = null,
): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const style = await embeddedFonts(prepared.fonts);
  const frame = caption === null ? prepared.frame : withCaptionBand(prepared.frame);
  const element = createElement(DiagramSvg, {
    scene: model,
    time: { kind: "static", t },
    mode: "export",
    fontFamily: "Inter, sans-serif",
    frame,
    transparent,
    embeddedStyle: style,
    title: prepared.title,
    capacity,
    ...(caption === null
      ? {}
      : { caption: { text: caption.text, opacity: caption.opacity, box: captionBox(frame) } }),
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n${renderToStaticMarkup(element)}`;
}

export async function rasterize(
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

/** How long an animated story holds its last picture before it starts over. */
const STORY_END_HOLD = 2;

/** Renders the export. `onProgress` receives 0…1; `signal` cancels long animated exports. */
export async function runExport(
  request: ExportRequest,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<ExportResult> {
  const { options } = request;
  const prepared = await prepare(request);
  const extension = options.format === "jpeg" ? "jpg" : options.format;
  const filename = `${defaultFileName(options.fileName)}.${extension}`;
  const embed = options.embed !== false;
  const captions = options.captions !== false;

  // A still is the picture showing: the scene picked, and the step of the story shown (D-86).
  const cursor =
    request.story == null || request.folder !== ""
      ? null
      : cursorAtStep(prepared.diagram, request.story);
  const showing: Moment = { scene: request.scene, story: cursor };
  const captionOf = (story: StoryCursor | null): Caption | null => {
    if (!captions || story === null) return null;
    const text = captionAt(prepared.diagram, story);
    return text === null ? null : { text, opacity: 1 };
  };

  /** One still, as SVG text and its size in px at scale 1. */
  const stillSvg = async (at: Moment, transparent: boolean) => {
    const caption = captionOf(at.story);
    const model = prepared.modelFor(prepared.resolvedFor(at), null, null);
    const svg = await markup(prepared, model, 0, transparent, still(prepared, at), caption);
    const frame = caption === null ? prepared.frame : withCaptionBand(prepared.frame);
    return { svg, w: frame.w, h: frame.h };
  };
  const stillImage = async (at: Moment, format: "png" | "jpeg", scale: number, quality = 0.92) => {
    const transparent = format === "png" && options.transparent;
    const { svg, w, h } = await stillSvg(at, transparent);
    const width = Math.round(w * scale);
    const height = Math.round(h * scale);
    const canvas = await rasterize(
      svg,
      width,
      height,
      format === "jpeg" ? prepared.theme.base : null,
    );
    const blob = await toBlob(canvas, format === "png" ? "image/png" : "image/jpeg", quality);
    return { blob, width, height };
  };

  // Every beat as an image, zipped, in the order they play.
  if (
    options.each === "beats" &&
    prepared.story !== null &&
    (options.format === "png" || options.format === "jpeg")
  ) {
    const ends = [
      prepared.story.opening,
      ...prepared.story.segments.filter((segment) => segment.endsBeat).map((segment) => segment.to),
    ];
    const entries: Zippable = {};
    const base = defaultFileName(options.fileName);
    let size = { width: 0, height: 0 };
    for (const [index, story] of ends.entries()) {
      if (signal?.aborted === true) throw new DOMException("Export cancelled", "AbortError");
      const image = await stillImage(
        { scene: request.scene, story },
        options.format,
        options.scale,
      );
      size = {
        width: Math.max(size.width, image.width),
        height: Math.max(size.height, image.height),
      };
      const number = String(index).padStart(2, "0");
      entries[`${base}/${base}-${number}.${extension}`] = new Uint8Array(
        await image.blob.arrayBuffer(),
      );
      onProgress((index + 1) / ends.length);
    }
    if (embed) entries[`${base}/README.txt`] = strToU8(BEATS_NOTE);
    const zipped = zipSync(entries, { level: 0 });
    return {
      blob: new Blob([zipped.slice().buffer], { type: "application/zip" }),
      filename: `${base}.zip`,
      ...size,
    };
  }

  if (options.format === "svg") {
    const { svg: plain, w, h } = await stillSvg(showing, options.transparent);
    const svg = embed ? embedInSvg(plain, request.files) : plain;
    onProgress(1);
    return {
      blob: new Blob([svg], { type: "image/svg+xml" }),
      filename,
      width: Math.round(w),
      height: Math.round(h),
    };
  }

  if (options.format === "png" || options.format === "jpeg") {
    const { blob: image, width, height } = await stillImage(showing, options.format, options.scale);
    const blob =
      options.format === "png" && embed
        ? new Blob(
            [embedInPng(new Uint8Array(await image.arrayBuffer()), request.files).slice().buffer],
            {
              type: "image/png",
            },
          )
        : image;
    onProgress(1);
    return { blob, filename, width, height };
  }

  if (options.format === "pdf") {
    // A print-quality image of the diagram on a page its size (07 §18 P0-7).
    const scale = Math.max(2, options.scale);
    const { svg, w, h } = await stillSvg(showing, false);
    const width = Math.round(w * scale);
    const height = Math.round(h * scale);
    const canvas = await rasterize(svg, width, height, prepared.theme.base);
    const jpeg = await toBlob(canvas, "image/jpeg", 0.95);
    const pdf = jpegToPdf(
      new Uint8Array(await jpeg.arrayBuffer()),
      { width, height },
      { width: w, height: h },
      options.fileName,
    );
    onProgress(1);
    return {
      blob: new Blob([pdf.slice().buffer], { type: "application/pdf" }),
      filename,
      width: Math.round(w),
      height: Math.round(h),
    };
  }

  // Animated: sample the shared clock frame by frame (PR-9). Every period divides 4s, so the
  // last frame flows straight into the first (EX-7).
  const sceneCount = prepared.sceneNames.length;
  const scenes = options.animation === "scenes" && sceneCount > 1;
  const story = options.animation === "story" ? prepared.story : null;
  const banded = story !== null && captions;
  const area = banded ? withCaptionBand(prepared.frame) : prepared.frame;
  const scale = Math.min(options.scale, MAX_ANIMATED_WIDTH / area.w);
  const width = Math.max(2, Math.round(area.w * scale));
  const height = Math.max(2, Math.round(area.h * scale));
  // A traffic pattern (D-84) loops once per cycle (and every motion's loop): frames come from its
  // second time round, so copies that are draining at the end are draining at the start too.
  const cycle =
    scenes || story !== null
      ? null
      : (prepared.resolvedFor(showing).capacityOverTime?.cycle ?? null);
  const duration =
    story !== null
      ? story.duration + STORY_END_HOLD
      : scenes
        ? sceneCount * SCENE_HOLD
        : cycle === null
          ? LOOP_SECONDS
          : patternLoop(cycle);
  const offset = cycle === null ? 0 : duration;
  const frameCount = Math.round(duration * options.fps);
  const delay = Math.round(1000 / options.fps);
  const transparent = options.format === "webp" && options.transparent;

  /** Where an animation is at time `t`: the picture, the one it's changing from, and since when. */
  const positionAt = (
    t: number,
  ): {
    readonly key: number;
    readonly to: Moment | string | null;
    readonly from: Moment | string | null;
    readonly start: number;
    readonly seconds: number;
    /** How long the step lasts, change and hold: values run across it. */
    readonly lasts: number;
    readonly caption: Caption | null;
  } => {
    if (story !== null) {
      const segment = segmentAt(story, t);
      if (segment === null)
        return {
          key: -1,
          to: { scene: request.scene, story: story.opening },
          from: null,
          start: 0,
          seconds: 0,
          lasts: 0,
          caption: banded ? { text: null, opacity: 0 } : null,
        };
      // The words arrive with the first change of their beat.
      const first = story.segments.find((other) => other.beat === segment.beat) ?? segment;
      return {
        key: story.segments.indexOf(segment),
        to: { scene: request.scene, story: segment.to },
        from: { scene: request.scene, story: segment.from },
        start: segment.start,
        seconds: segment.change,
        lasts: segment.end - segment.start,
        caption: banded
          ? {
              text: captionAt(prepared.diagram, segment.to),
              opacity: Math.min(1, Math.max(0, (t - first.start) / 0.3)),
            }
          : null,
      };
    }
    if (scenes) {
      const position = scenesAt(t, sceneCount);
      const local = ((t % duration) + duration) % duration;
      return {
        key: position.to,
        to: prepared.sceneNames[position.to] ?? null,
        from: prepared.sceneNames[position.from] ?? null,
        start: t - (local - position.to * SCENE_HOLD),
        seconds: SCENE_TRANSITION,
        lasts: 0,
        caption: null,
      };
    }
    return { key: 0, to: showing, from: null, start: 0, seconds: 0, lasts: 0, caption: null };
  };

  // Capacity in an animation: copies boot and drain as it moves from picture to picture.
  let timeline: CapacityTimeline | null = null;
  let shown = Number.NaN;
  const capacityAt = (t: number): CapacityRuntime | null => {
    const position = positionAt(t);
    const resolved = prepared.resolvedFor(position.to);
    if (!resolved.capacity.active) return null;
    const moving = scenes || story !== null;
    if (timeline === null) {
      timeline = new CapacityTimeline(
        resolved.capacity,
        prepared.diagram,
        moving ? t : 0,
        resolved.capacityOverTime,
      );
      shown = position.key;
    } else if (position.key !== shown) {
      timeline.update(
        resolved.capacity,
        prepared.diagram,
        position.start,
        false,
        resolved.capacityOverTime,
      );
      shown = position.key;
    }
    return { timeline, version: position.key };
  };

  const modelAt = (t: number): SceneModel => {
    const position = positionAt(t);
    const current = prepared.resolvedFor(position.to);
    const inTransition = position.from !== null && t - position.start < position.seconds;
    return prepared.modelFor(
      current,
      inTransition ? prepared.resolvedFor(position.from) : null,
      inTransition ? position.start : null,
      position.seconds,
      position.lasts > 0 ? { start: position.start, seconds: position.lasts } : null,
    );
  };
  const frameAt = (t: number, clear: boolean): Promise<string> =>
    markup(prepared, modelAt(t), t, clear, capacityAt(t), positionAt(t).caption);

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
        const t = offset + i / options.fps;
        const canvas = await rasterize(await frameAt(t, false), width, height, prepared.theme.base);
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
    const t = offset + i / options.fps;
    const canvas = await rasterize(
      await frameAt(t, transparent),
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

const BEATS_NOTE =
  "One image per beat of the story, in the order they play. 00 is the opening, before anything happens.\n";

/** How long an animated export of a diagram's story runs, in seconds; null when it has none. */
export function storySeconds(files: ProjectFiles, folder: string, root = ""): number | null {
  if (folder !== root) return null;
  const timeline = storyTimeline(parseDiagram(files, folder).diagram);
  return timeline === null ? null : timeline.duration + STORY_END_HOLD;
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
  const source = new DiagramLoader(files);
  const info = deckInfo(files, source);
  const slide = info === null ? undefined : deckSlides(source)[0];
  if (info === null || slide === undefined) {
    const whole = await prepare({ files, folder: "", scene: null, options });
    return thumbnailOf(whole, null);
  }

  const deck = source.load("").diagram;
  const rawSlide = source.load(slide.folder).diagram;
  const diagram = slideDiagram(deck, rawSlide, slide, info.slides);
  const slideMoment = { scene: slide.scene, story: slideClosing(rawSlide, slide) };
  const prepared = await prepare({
    files,
    folder: slide.folder,
    root: slide.folder,
    scene: slide.scene,
    options,
    diagram,
  });
  const stage =
    prepared.page === null
      ? prepared.frame
      : grownTo(prepared.page, THUMBNAIL.width / THUMBNAIL.height);
  const slideCanvas = await thumbnailLayer(prepared, stage, slideMoment);
  let frameCanvas: HTMLCanvasElement | null = null;
  const frameFolder = deck.settings.deck?.frame;
  if (slide.frame && frameFolder !== null && frameFolder !== undefined && source.has(frameFolder)) {
    const rawFrame = source.load(frameFolder).diagram;
    const frameDiagram = slideDiagram(deck, rawFrame, slide, info.slides);
    const framePrepared = await prepare({
      files,
      folder: frameFolder,
      root: frameFolder,
      scene: null,
      options,
      diagram: frameDiagram,
    });
    frameCanvas = await thumbnailLayer(framePrepared, stage, null);
  }

  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL.width;
  canvas.height = THUMBNAIL.height;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("Canvas isn't available in this browser.");
  context.fillStyle = prepared.theme.base;
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (frameCanvas !== null) context.drawImage(frameCanvas, 0, 0);
  context.drawImage(slideCanvas, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.78);
}

/** A diagram with a page shows that page, whole, in the dashboard card's proportions. */
async function thumbnailOf(prepared: Prepared, at: Moment | null): Promise<string> {
  const stage =
    prepared.page === null
      ? prepared
      : { ...prepared, frame: grownTo(prepared.page, THUMBNAIL.width / THUMBNAIL.height) };
  const model = stage.modelFor(stage.resolvedFor(at), null, null);
  const svg = await markup(stage, model, 0.5, false, still(stage, at));
  const canvas = await rasterize(svg, THUMBNAIL.width, THUMBNAIL.height, stage.theme.base);
  return canvas.toDataURL("image/jpeg", 0.78);
}

/** Render one transparent deck layer aligned to the same page frame as the other. */
async function thumbnailLayer(
  prepared: Prepared,
  frame: Box,
  at: Moment | null,
): Promise<HTMLCanvasElement> {
  const aligned = { ...prepared, frame };
  const model = aligned.modelFor(aligned.resolvedFor(at), null, null);
  const svg = await markup(aligned, model, 0.5, true, still(aligned, at));
  return rasterize(svg, THUMBNAIL.width, THUMBNAIL.height, null);
}
