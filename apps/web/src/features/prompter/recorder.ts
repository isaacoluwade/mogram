import type { AssetPointer } from "@mogram/core/assets";
import { keepAsset } from "@/features/assets/store";

/**
 * Recording a beat at a time (D-105). One microphone stream is opened for a session; each beat
 * is its own take, started when the beat starts and finished when the reading moves on, so a
 * clip is always exactly one beat and nothing has to be cut afterwards.
 */

/** The microphone, as a recording needs it: no processing that changes the voice's level. */
export async function openMicrophone(deviceId: string | null): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      ...(deviceId === null ? {} : { deviceId: { exact: deviceId } }),
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
    },
  });
}

/** What the browser records in: Opus in WebM where it can. */
function recordingType(): string {
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"])
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  return "";
}

/** One take after another from the same stream. */
export class Takes {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  constructor(private readonly stream: MediaStream) {}

  /** Starts a take, dropping one that was under way. */
  start(): void {
    this.discard();
    const type = recordingType();
    const recorder = new MediaRecorder(this.stream, type === "" ? {} : { mimeType: type });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    this.chunks = chunks;
    this.recorder = recorder;
    recorder.start();
  }

  get recording(): boolean {
    return this.recorder !== null;
  }

  /** Ends the take under way and gives what it recorded; null when there wasn't one. */
  finish(): Promise<Blob | null> {
    const recorder = this.recorder;
    const chunks = this.chunks;
    this.recorder = null;
    if (recorder === null || recorder.state === "inactive") return Promise.resolve(null);
    return new Promise((resolve) => {
      recorder.onstop = () =>
        resolve(chunks.length === 0 ? null : new Blob(chunks, { type: recorder.mimeType }));
      recorder.stop();
    });
  }

  /** Throws away the take under way. */
  discard(): void {
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder !== null && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.stop();
    }
  }

  /** Ends the session: the microphone is let go. */
  close(): void {
    this.discard();
    for (const track of this.stream.getTracks()) track.stop();
  }
}

/** Below this loudness (RMS of a 20 ms window) is the room, not the voice. */
const QUIET = 0.012;
/** Room left before the first word and after the last, so neither is clipped. */
const LEAD = 0.12;
const TRAIL = 0.3;

/**
 * Where the voice starts and stops in a recording, by its loudness: the silence at either end is
 * skipped when it plays, not cut out of the file (D-105).
 */
export function voiceSpan(
  samples: Float32Array,
  rate: number,
): { readonly start: number; readonly end: number } | null {
  const window = Math.max(1, Math.round(rate * 0.02));
  let first = -1;
  let last = -1;
  for (let at = 0; at < samples.length; at += window) {
    let sum = 0;
    const end = Math.min(samples.length, at + window);
    for (let i = at; i < end; i++) sum += (samples[i] ?? 0) * (samples[i] ?? 0);
    if (Math.sqrt(sum / (end - at)) < QUIET) continue;
    if (first === -1) first = at;
    last = end;
  }
  if (first === -1) return null;
  const length = samples.length / rate;
  return {
    start: Math.max(0, first / rate - LEAD),
    end: Math.min(length, last / rate + TRAIL),
  };
}

/**
 * A take kept as a clip: its bytes in this browser's store, and the pointer that stands for them,
 * with its length and the silence it starts with. Null for a take with no voice in it.
 */
export async function keepTake(take: Blob): Promise<AssetPointer | null> {
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await take.arrayBuffer());
    const span = voiceSpan(audio.getChannelData(0), audio.sampleRate);
    if (span === null || span.end - span.start < 0.3) return null;
    const round = (value: number) => Math.round(value * 1000) / 1000;
    const type = take.type.startsWith("audio/ogg") ? "audio/ogg" : "audio/webm";
    return await keepAsset(new Blob([take], { type }), type, {
      seconds: round(span.end),
      ...(span.start > 0 ? { skip: round(span.start) } : {}),
    });
  } finally {
    void context.close();
  }
}
