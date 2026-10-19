"use client";

import { zipSync, type Zippable } from "fflate";
import { voiceFor } from "@mogram/core/assets";
import {
  deckBeats,
  deckChapters,
  deckPositionAt,
  deckScript,
  deckSlides,
  deckSubtitles,
  deckTimeline,
  slideClosing,
  slideDiagram,
  type DeckSlide,
} from "@mogram/core/deck";
import type { Box } from "@mogram/core/layout";
import type { ProjectFiles } from "@mogram/core/model";
import { toName } from "@mogram/core/model";
import { DiagramLoader } from "@mogram/core/nested";
import type { Moment } from "@mogram/core/picture";
import { findAsset } from "@/features/assets/remote";
import {
  defaultFileName,
  layerRenderer,
  rasterize,
  type ExportResult,
  type LayerRenderer,
} from "./export";
import { jpegsToPdf } from "./pdf";
import { muxWebm, opusHead, type EncodedFrame, type WebmInput } from "./webm-mux";

/**
 * A whole deck, exported (D-106): its pictures as a PDF or images, a page per slide or per beat;
 * its words as a script, subtitles and chapters; and the deck itself as a video at its own
 * times, with its voice. Every picture is drawn the way the player draws it: the frame under
 * the slide, on the deck's page.
 */

export type DeckExportKind = "pdf" | "images" | "video" | "script" | "subtitles" | "chapters";

export interface DeckExportOptions {
  readonly kind: DeckExportKind;
  /** A page or image per slide (its last picture) or per beat. */
  readonly each: "slide" | "beat";
  readonly imageFormat: "png" | "jpeg";
  readonly scale: 1 | 2 | 3;
  /** The video's height in px; its width follows the page. */
  readonly height: 1080 | 2160;
  readonly fps: 30 | 60;
  readonly fileName: string;
}

/** The deck's last picture holds this long at the end of a video. */
const END_HOLD = 1;

const cancelled = () => new DOMException("Export cancelled", "AbortError");

/** What a deck is, read once for an export. */
function readDeck(files: ProjectFiles, deckRoot: string) {
  const loader = new DiagramLoader(files);
  const deck = loader.load(deckRoot).diagram;
  if (deck.settings.deck === null) throw new Error("This isn't a deck.");
  const slides = deckSlides(loader, deckRoot);
  if (slides.length === 0) throw new Error("This deck has no slides yet.");
  const voice = (words: string) => voiceFor(files, deckRoot, words)?.seconds ?? null;
  const timeline = deckTimeline(loader, slides, undefined, voice);
  return { loader, deck, slides, timeline, beats: deckBeats(loader, slides, timeline) };
}

type Deck = ReturnType<typeof readDeck>;

/** Each slide's two layers, the frame under the slide, drawn once each when first needed. */
function deckLayers(files: ProjectFiles, { loader, deck, slides }: Deck) {
  const made = new Map<number, Promise<{ slide: LayerRenderer; frame: LayerRenderer | null }>>();
  const frameFolder = deck.settings.deck?.frame ?? null;
  return (index: number) => {
    let layers = made.get(index);
    if (layers === undefined) {
      const entry = slides[index];
      if (entry === undefined) throw new Error(`There's no slide ${index + 1}.`);
      const own = slideDiagram(deck, loader.load(entry.folder).diagram, entry, slides.length);
      const framed = entry.frame && frameFolder !== null && loader.has(frameFolder);
      layers = Promise.all([
        layerRenderer({ files, folder: entry.folder, scene: entry.scene, diagram: own }),
        framed
          ? layerRenderer({
              files,
              folder: frameFolder,
              scene: null,
              diagram: slideDiagram(deck, loader.load(frameFolder).diagram, entry, slides.length),
            })
          : Promise.resolve(null),
      ]).then(([slide, frame]) => ({ slide, frame }));
      made.set(index, layers);
    }
    return layers;
  };
}

/** Draws a slide's picture, frame first, on the deck's page at a size. */
function deckPainter(files: ProjectFiles, deck: Deck, stage: Box, width: number, height: number) {
  const layersOf = deckLayers(files, deck);
  // A frame doesn't move from picture to picture: it's drawn once a slide.
  const frames = new Map<number, Promise<HTMLCanvasElement | null>>();
  const frameOf = (index: number) => {
    let frame = frames.get(index);
    if (frame === undefined) {
      frame = layersOf(index).then(async ({ frame: layer }) =>
        layer === null
          ? null
          : rasterize(await layer.svg({ scene: null, story: null }, stage), width, height, null),
      );
      frames.set(index, frame);
    }
    return frame;
  };
  return async (
    index: number,
    moment: Moment,
    t = 0,
    from: {
      readonly moment: Moment;
      readonly start: number;
      readonly seconds: number;
    } | null = null,
  ): Promise<HTMLCanvasElement> => {
    const { slide } = await layersOf(index);
    const [frame, picture] = await Promise.all([
      frameOf(index),
      slide.svg(moment, stage, t, from).then((svg) => rasterize(svg, width, height, null)),
    ]);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Canvas isn't available in this browser.");
    context.fillStyle = slide.base;
    context.fillRect(0, 0, width, height);
    if (frame !== null) context.drawImage(frame, 0, 0);
    context.drawImage(picture, 0, 0);
    return canvas;
  };
}

/** The deck's page: every slide shares it, from the deck's own settings. */
async function stageOf(files: ProjectFiles, deck: Deck): Promise<Box> {
  const { slide } = await deckLayers(files, deck)(0);
  return slide.page;
}

/** The pictures a still export holds: each slide's last, or each beat's, in order. */
function stillsOf(deck: Deck, each: "slide" | "beat") {
  const out: { index: number; moment: Moment; beat: number | null }[] = [];
  deck.slides.forEach((entry, index) => {
    const timed = deck.timeline.slides[index];
    if (each === "slide" || timed === undefined) {
      const raw = deck.loader.load(entry.folder).diagram;
      out.push({
        index,
        moment: { scene: entry.scene, story: slideClosing(raw, entry) },
        beat: null,
      });
      return;
    }
    const ends = timed.segments.filter((segment) => segment.endsBeat);
    if (ends.length === 0)
      out.push({ index, moment: { scene: entry.scene, story: timed.opening }, beat: null });
    ends.forEach((segment) =>
      out.push({
        index,
        moment: { scene: entry.scene, story: segment.to },
        beat: segment.beat + 1,
      }),
    );
  });
  return out;
}

const slug = (text: string) => toName(text, "slide").replace(/_/g, "-");
const pad = (value: number) => String(value).padStart(2, "0");

/** An image's name in the zip: in its section's folder, by number and title. */
function imagePath(
  base: string,
  slides: readonly DeckSlide[],
  index: number,
  beat: number | null,
  extension: string,
): string {
  const slide = slides[index];
  if (slide === undefined) return `${base}/${pad(index + 1)}.${extension}`;
  const sections = [
    ...new Set(
      slides.map((each) => each.section).filter((title): title is string => title !== null),
    ),
  ];
  const at = slide.section === null ? -1 : sections.indexOf(slide.section);
  const folder = at === -1 ? base : `${base}/${pad(at + 1)}-${slug(slide.section ?? "")}`;
  const name = `${pad(slide.number)}-${slug(slide.title)}${beat === null ? "" : `-beat-${pad(beat)}`}`;
  return `${folder}/${name}.${extension}`;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob === null
          ? reject(new Error(`This browser can't create ${type} images.`))
          : resolve(blob),
      type,
      quality,
    ),
  );
}

const textFile = (text: string, filename: string, type: string): ExportResult => ({
  blob: new Blob([text], { type }),
  filename,
  width: 0,
  height: 0,
});

/** Renders the deck's export. `onProgress` receives 0…1; `signal` cancels. */
export async function runDeckExport(
  files: ProjectFiles,
  deckRoot: string,
  options: DeckExportOptions,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<ExportResult> {
  const deck = readDeck(files, deckRoot);
  const base = defaultFileName(options.fileName);
  const name = deck.deck.settings.name;

  if (options.kind === "script") {
    const recorded = (words: string) => voiceFor(files, deckRoot, words) !== null;
    onProgress(1);
    return textFile(
      deckScript(name, deck.slides, deck.beats, recorded),
      `${base}-script.md`,
      "text/markdown",
    );
  }
  if (options.kind === "subtitles") {
    onProgress(1);
    return textFile(deckSubtitles(deck.beats), `${base}.vtt`, "text/vtt");
  }
  if (options.kind === "chapters") {
    onProgress(1);
    return textFile(deckChapters(deck.slides, deck.timeline), `${base}-chapters.txt`, "text/plain");
  }

  const stage = await stageOf(files, deck);
  if (options.kind === "video")
    return deckVideo(files, deckRoot, deck, stage, options, base, onProgress, signal);

  // Stills: a PDF, or images in a zip.
  const scale = options.kind === "pdf" ? Math.max(2, options.scale) : options.scale;
  const width = Math.round(stage.w * scale);
  const height = Math.round(stage.h * scale);
  const paint = deckPainter(files, deck, stage, width, height);
  const stills = stillsOf(deck, options.each);
  if (options.kind === "pdf") {
    const pages = [];
    for (const [at, still] of stills.entries()) {
      if (signal?.aborted === true) throw cancelled();
      const jpeg = await toBlob(await paint(still.index, still.moment), "image/jpeg", 0.92);
      pages.push({
        jpeg: new Uint8Array(await jpeg.arrayBuffer()),
        image: { width, height },
        page: { width: stage.w, height: stage.h },
      });
      onProgress((at + 1) / stills.length);
    }
    const pdf = jpegsToPdf(pages, name);
    return {
      blob: new Blob([pdf.slice().buffer], { type: "application/pdf" }),
      filename: `${base}.pdf`,
      width: Math.round(stage.w),
      height: Math.round(stage.h),
    };
  }
  const extension = options.imageFormat === "jpeg" ? "jpg" : "png";
  const entries: Zippable = {};
  for (const [at, still] of stills.entries()) {
    if (signal?.aborted === true) throw cancelled();
    const image = await toBlob(
      await paint(still.index, still.moment),
      options.imageFormat === "jpeg" ? "image/jpeg" : "image/png",
      0.92,
    );
    entries[imagePath(base, deck.slides, still.index, still.beat, extension)] = new Uint8Array(
      await image.arrayBuffer(),
    );
    onProgress((at + 1) / stills.length);
  }
  const zipped = zipSync(entries, { level: 0 });
  return {
    blob: new Blob([zipped.slice().buffer], { type: "application/zip" }),
    filename: `${base}.zip`,
    width,
    height,
  };
}

// -------------------------------------------------------------------------------------------------
// Video

/** The codecs a WebM can hold, best first, with the bitrate a page of text needs. */
async function videoCodec(
  width: number,
  height: number,
  fps: number,
): Promise<{ codec: string; track: "V_VP9" | "V_VP8"; config: VideoEncoderConfig }> {
  if (typeof VideoEncoder === "undefined")
    throw new Error("This browser can't make video. Use a recent Chrome or Edge.");
  const bitrate = height >= 2160 ? 30_000_000 : 10_000_000;
  for (const [codec, track] of [
    [height >= 2160 ? "vp09.00.51.08" : "vp09.00.41.08", "V_VP9"],
    ["vp8", "V_VP8"],
  ] as const) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate, framerate: fps };
    const support = await VideoEncoder.isConfigSupported(config).catch(() => null);
    if (support?.supported === true) return { codec, track, config };
  }
  throw new Error(`This browser can't make a ${height}p video. Try 1080p.`);
}

async function deckVideo(
  files: ProjectFiles,
  deckRoot: string,
  deck: Deck,
  stage: Box,
  options: DeckExportOptions,
  base: string,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<ExportResult> {
  const height = options.height;
  const width = Math.round(((stage.w / stage.h) * height) / 2) * 2;
  const { track, config } = await videoCodec(width, height, options.fps);
  const paint = deckPainter(files, deck, stage, width, height);
  const duration = deck.timeline.duration + END_HOLD;
  const count = Math.ceil(duration * options.fps);

  const frames: EncodedFrame[] = [];
  let failure: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      frames.push({ data, timestamp: chunk.timestamp, key: chunk.type === "key" });
    },
    error: (error) => {
      failure = error;
    },
  });
  encoder.configure(config);
  try {
    for (let i = 0; i < count; i++) {
      if (signal?.aborted === true) throw cancelled();
      if (failure !== null) throw failure;
      const t = i / options.fps;
      const canvas = await videoFrame(paint, deck, t);
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(t * 1_000_000),
        duration: Math.round(1_000_000 / options.fps),
      });
      // A key frame every two seconds, so the file can be skipped through.
      encoder.encode(frame, { keyFrame: i % (options.fps * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 4) await new Promise((resolve) => setTimeout(resolve, 5));
      // Drawing is most of the work; the sound is the rest.
      onProgress(((i + 1) / count) * 0.9);
    }
    await encoder.flush();
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
  if (failure !== null) throw failure;
  const audio = await deckAudio(files, deckRoot, deck, duration);
  onProgress(1);
  const bytes = muxWebm({
    video: { codec: track, width, height, frames },
    ...(audio === null ? {} : { audio }),
    duration,
  });
  return {
    blob: new Blob([bytes.slice().buffer], { type: "video/webm" }),
    filename: `${base}.webm`,
    width,
    height,
  };
}

/** The picture at a time: a slide changing, or the cut between two, the old fading off the new. */
async function videoFrame(
  paint: ReturnType<typeof deckPainter>,
  deck: Deck,
  t: number,
): Promise<HTMLCanvasElement> {
  const at = deckPositionAt(deck.slides, deck.timeline, Math.min(t, deck.timeline.duration));
  if (at === null) throw new Error("This deck has no slides yet.");
  const { position, previous, changeStart, changeSeconds, cut } = at;
  const changing = previous !== null && changeStart !== null && t - changeStart < changeSeconds;
  if (cut && changing) {
    const canvas = await paint(position.slide, position.moment);
    const leaving = await paint(previous.slide, previous.moment);
    const context = canvas.getContext("2d");
    const p = Math.min(1, Math.max(0, (t - changeStart) / changeSeconds));
    if (context !== null) {
      context.globalAlpha = 1 - p * p * (3 - 2 * p);
      context.drawImage(leaving, 0, 0);
      context.globalAlpha = 1;
    }
    return canvas;
  }
  return paint(
    position.slide,
    position.moment,
    t,
    previous === null || changeStart === null
      ? null
      : { moment: previous.moment, start: changeStart, seconds: changeSeconds },
  );
}

/** Every beat's recording, each where its beat starts, mixed and encoded as Opus. */
async function deckAudio(
  files: ProjectFiles,
  deckRoot: string,
  deck: Deck,
  duration: number,
): Promise<NonNullable<WebmInput["audio"]> | null> {
  const clips = deck.beats.flatMap((beat) => {
    const voice = beat.script === null ? null : voiceFor(files, deckRoot, beat.script);
    return voice === null ? [] : [{ voice, start: beat.start }];
  });
  if (clips.length === 0 || typeof AudioEncoder === "undefined") return null;
  const rate = 48_000;
  const mix = new OfflineAudioContext(1, Math.ceil(duration * rate), rate);
  for (const clip of clips) {
    const blob = await findAsset(clip.voice.pointer);
    if (blob === null) continue;
    const source = mix.createBufferSource();
    source.buffer = await mix.decodeAudioData(await blob.arrayBuffer());
    source.connect(mix.destination);
    source.start(clip.start, clip.voice.skip, clip.voice.seconds);
  }
  const mixed = await mix.startRendering();

  const frames: EncodedFrame[] = [];
  let header: Uint8Array | null = null;
  let failure: Error | null = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      const description = meta?.decoderConfig?.description;
      if (header === null && description !== undefined)
        header = ArrayBuffer.isView(description)
          ? new Uint8Array(
              description.buffer.slice(
                description.byteOffset,
                description.byteOffset + description.byteLength,
              ),
            )
          : new Uint8Array(description.slice(0));
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      frames.push({ data, timestamp: chunk.timestamp, key: true });
    },
    error: (error) => {
      failure = error;
    },
  });
  encoder.configure({ codec: "opus", sampleRate: rate, numberOfChannels: 1, bitrate: 96_000 });
  const samples = mixed.getChannelData(0);
  const step = rate / 10;
  for (let at = 0; at < samples.length; at += step) {
    const data = samples.slice(at, Math.min(samples.length, at + step));
    const audio = new AudioData({
      format: "f32-planar",
      sampleRate: rate,
      numberOfFrames: data.length,
      numberOfChannels: 1,
      timestamp: Math.round((at / rate) * 1_000_000),
      data,
    });
    encoder.encode(audio);
    audio.close();
  }
  await encoder.flush();
  encoder.close();
  if (failure !== null) throw failure;
  return { sampleRate: rate, channels: 1, header: header ?? opusHead(1, rate), frames };
}
