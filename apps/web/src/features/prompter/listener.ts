/**
 * Listening with Chrome's own speech recogniser, on the device (D-96). Nothing is sent
 * anywhere: `processLocally` makes Chrome refuse to start unless it can recognise with the
 * language pack it has downloaded. What comes out is the recogniser's current guess at the
 * last few words, for `follow` in `@mogram/core/prompter` to place in the script.
 *
 * The API is newer than TypeScript's DOM types, so the parts used are declared here.
 */

interface RecognitionAlternative {
  readonly transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { readonly error: string }) => void) | null;
  /** Chrome takes the audio to listen to; without one it opens the default microphone. */
  start(track?: MediaStreamTrack): void;
  stop(): void;
  abort(): void;
}
interface RecognitionStatic {
  new (): Recognition;
  available?(options: { langs: string[]; processLocally: boolean }): Promise<string>;
  install?(options: { langs: string[]; processLocally: boolean }): Promise<boolean>;
}

function recogniser(): RecognitionStatic | null {
  const scope = globalThis as unknown as {
    SpeechRecognition?: RecognitionStatic;
    webkitSpeechRecognition?: RecognitionStatic;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export type ListenerState =
  | { readonly kind: "off" }
  | { readonly kind: "preparing"; readonly detail: string }
  | { readonly kind: "listening" }
  | { readonly kind: "failed"; readonly reason: string };

export interface ListenerOptions {
  readonly lang: string;
  /** The microphone to listen to; the system's own when left out or gone. */
  readonly deviceId?: string | null;
  /** The recogniser's current guess at the last words said, oldest first. */
  readonly onHeard: (words: readonly string[]) => void;
  readonly onState: (state: ListenerState) => void;
  /** How loud the microphone is, 0 to 1, a few times a second: proof it's being heard. */
  readonly onLevel?: (level: number) => void;
}

export interface Microphone {
  readonly id: string;
  readonly label: string;
}

/** The microphones there are. Their names are known only once the page may use one. */
export async function microphones(): Promise<Microphone[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === "audioinput" && device.deviceId !== "")
      .map((device, index) => ({
        id: device.deviceId,
        label: device.label === "" ? `Microphone ${index + 1}` : device.label,
      }));
  } catch {
    return [];
  }
}

async function openMicrophone(deviceId: string | null): Promise<MediaStream> {
  // Voice processing stays on: it's what a recogniser expects, and it takes out the room.
  if (deviceId !== null) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });
    } catch (error) {
      // The microphone picked last time isn't plugged in: use whichever is.
      if (!(error instanceof DOMException) || error.name === "NotAllowedError") throw error;
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

/** Reports how loud a microphone is until the returned function is called. */
function watchLevel(stream: MediaStream, onLevel: (level: number) => void): () => void {
  try {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const timer = window.setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      // Speech sits around 0.05 to 0.2 RMS: stretch that across the meter.
      onLevel(Math.min(1, Math.sqrt(sum / samples.length) * 5));
    }, 100);
    return () => {
      window.clearInterval(timer);
      void context.close();
    };
  } catch {
    return () => undefined;
  }
}

/** How many of the last words heard are passed on: more than the follower compares. */
const KEPT = 16;

/**
 * Starts listening and keeps listening: Chrome ends a session after a pause or a while, so it
 * is started again until `stop` is called. Returns how to stop.
 */
export async function listen(options: ListenerOptions): Promise<() => void> {
  const Recogniser = recogniser();
  if (Recogniser === null) {
    options.onState({
      kind: "failed",
      reason: "This browser has no speech recognition. Following your voice works in Chrome.",
    });
    return () => undefined;
  }
  const local = { langs: [options.lang], processLocally: true };
  if (Recogniser.available === undefined) {
    options.onState({
      kind: "failed",
      reason:
        "This version of Chrome can't recognise speech on this device. Update Chrome to follow your voice without sending audio anywhere.",
    });
    return () => undefined;
  }
  // The microphone first: if the page may not use one, there's no point fetching anything.
  let stream: MediaStream;
  try {
    options.onState({ kind: "preparing", detail: "Opening the microphone" });
    stream = await openMicrophone(options.deviceId ?? null);
  } catch (error) {
    const name = error instanceof DOMException ? error.name : "";
    options.onState({
      kind: "failed",
      reason:
        name === "NotAllowedError"
          ? "The microphone is blocked for this page. Allow it in the address bar."
          : name === "NotFoundError"
            ? "There's no microphone to listen to."
            : "The microphone couldn't be opened.",
    });
    return () => undefined;
  }
  try {
    options.onState({ kind: "preparing", detail: "Checking the language pack" });
    let status = await Recogniser.available(local);
    if (status === "downloadable" || status === "downloading") {
      options.onState({ kind: "preparing", detail: "Downloading the language pack (once)" });
      const installed = (await Recogniser.install?.(local)) ?? false;
      status = installed ? "available" : status;
    }
    if (status !== "available") {
      for (const each of stream.getTracks()) each.stop();
      options.onState({
        kind: "failed",
        reason: `Chrome can't recognise ${options.lang} on this device yet.`,
      });
      return () => undefined;
    }
  } catch {
    for (const each of stream.getTracks()) each.stop();
    options.onState({ kind: "failed", reason: "Chrome couldn't prepare speech recognition." });
    return () => undefined;
  }

  const track = stream.getAudioTracks()[0];
  const unwatch = options.onLevel === undefined ? null : watchLevel(stream, options.onLevel);

  let stopped = false;
  let current: Recognition | null = null;
  /** Whether this Chrome takes a track; if not it listens to the default microphone itself. */
  let takesTrack = track !== undefined;
  const release = (): void => {
    unwatch?.();
    for (const each of stream.getTracks()) each.stop();
  };
  track?.addEventListener("ended", () => {
    if (stopped) return;
    stopped = true;
    current?.abort();
    release();
    options.onState({ kind: "failed", reason: "The microphone went away." });
  });
  /** Words settled in sessions that have ended, so a restart doesn't forget the last few. */
  let settled: string[] = [];
  /** Sessions in a row that wouldn't start, or ended at once having heard nothing. */
  let duds = 0;
  const giveUp = (): void => {
    stopped = true;
    release();
    options.onState({
      kind: "failed",
      reason: "Chrome couldn't keep listening. Turn following on again to retry.",
    });
  };
  const start = (): void => {
    if (stopped) return;
    const began = performance.now();
    const recognition = new Recogniser();
    recognition.lang = options.lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.processLocally = true;
    // No vocabulary hints (`phrases`): on the bench, favouring a script's unusual words made
    // the recogniser say them where they weren't, and swallow the sentence around them. The
    // follower doesn't need every word, so a name heard wrong costs nothing.
    let words: string[] = [];
    recognition.onresult = (event) => {
      // Only the last few words matter, and a session's results grow for as long as it runs:
      // read backwards and stop once there are enough.
      const last: string[] = [];
      for (let i = event.results.length - 1; i >= 0 && last.length < KEPT; i--) {
        const said = (event.results[i]?.[0]?.transcript ?? "").split(/\s+/).filter(Boolean);
        last.unshift(...said.slice(-(KEPT - last.length)));
      }
      words = last;
      duds = 0;
      options.onHeard([...settled, ...words].slice(-KEPT));
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        stopped = true;
        release();
        options.onState({
          kind: "failed",
          reason: "The microphone is blocked for this page. Allow it in the address bar.",
        });
      } else if (event.error === "language-not-supported") {
        stopped = true;
        release();
        options.onState({
          kind: "failed",
          reason: `Chrome has no on-device language pack for ${options.lang}.`,
        });
      } else if (event.error === "audio-capture") {
        stopped = true;
        release();
        options.onState({ kind: "failed", reason: "The microphone couldn't be heard." });
      }
      // "no-speech" and "aborted" end the session; onend starts the next.
    };
    recognition.onend = () => {
      settled = [...settled, ...words].slice(-KEPT);
      if (stopped) return;
      // A silence ends a session after several seconds; one that ends at once is broken.
      duds = performance.now() - began < 1000 ? duds + 1 : 0;
      if (duds >= 5) giveUp();
      else window.setTimeout(start, 120);
    };
    current = recognition;
    try {
      if (takesTrack && track !== undefined) recognition.start(track);
      else recognition.start();
      options.onState({ kind: "listening" });
    } catch (error) {
      // An older Chrome that won't take a track listens to the default microphone instead.
      if (takesTrack && error instanceof TypeError) takesTrack = false;
      else duds++;
      if (duds >= 5) giveUp();
      else window.setTimeout(start, 400);
    }
  };
  start();
  return () => {
    if (!stopped) release();
    stopped = true;
    current?.abort();
    options.onState({ kind: "off" });
  };
}
