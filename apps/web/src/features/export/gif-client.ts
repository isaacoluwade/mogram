/** Messages to and from `gif.worker.ts`. */
export type GifRequest =
  | { type: "start"; width: number; height: number }
  | { type: "frame"; rgba: Uint8ClampedArray; delay: number }
  | { type: "finish" };

export type GifReply = { type: "progress" } | { type: "done"; bytes: Uint8Array };

/** The parts of `Worker` the client uses (a fake stands in for it in tests). */
export interface GifWorker {
  onmessage: ((event: MessageEvent<GifReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: GifRequest, transfer?: Transferable[]): void;
  terminate(): void;
}

/** Frames waiting in the worker at most: each is width × height × 4 bytes. */
export const MAX_QUEUED_FRAMES = 4;

/**
 * Feeds frames to the GIF worker (EX-4). Rendering waits whenever the encoder falls
 * `MAX_QUEUED_FRAMES` behind, so a long export never piles hundreds of megabytes of pixels into
 * memory. Cancelling or a crashed worker rejects whatever is waiting at once.
 */
export class GifEncoderClient {
  private sent = 0;
  private encoded = 0;
  private bytes: Uint8Array | null = null;
  private failure: Error | null = null;
  private wake: (() => void) | null = null;

  constructor(
    private readonly worker: GifWorker,
    size: { readonly width: number; readonly height: number },
    private readonly onEncoded: (encoded: number) => void,
    private readonly signal?: AbortSignal,
  ) {
    worker.onmessage = (event) => {
      if (event.data.type === "progress") {
        this.encoded++;
        this.onEncoded(this.encoded);
      } else this.bytes = event.data.bytes;
      this.notify();
    };
    worker.onerror = () => this.fail(new Error("The GIF encoder stopped unexpectedly."));
    if (signal?.aborted === true) this.abort();
    else signal?.addEventListener("abort", this.abort, { once: true });
    worker.postMessage({ type: "start", width: size.width, height: size.height });
  }

  /** Hands one frame (its pixels are transferred) to the encoder, once there's room for it. */
  async add(rgba: Uint8ClampedArray, delay: number): Promise<void> {
    await this.until(() => (this.sent - this.encoded < MAX_QUEUED_FRAMES ? true : null));
    this.worker.postMessage({ type: "frame", rgba, delay }, [rgba.buffer]);
    this.sent++;
  }

  /** Waits for the last frame to be encoded and returns the finished file. */
  finish(): Promise<Uint8Array> {
    this.worker.postMessage({ type: "finish" });
    return this.until(() => this.bytes);
  }

  /** Throws if the export was cancelled or the encoder failed. */
  check(): void {
    if (this.failure !== null) throw this.failure;
  }

  dispose(): void {
    this.signal?.removeEventListener("abort", this.abort);
    this.worker.terminate();
  }

  private readonly abort = (): void =>
    this.fail(new DOMException("Export cancelled", "AbortError"));

  private fail(error: Error): void {
    this.failure ??= error;
    this.notify();
  }

  private notify(): void {
    const wake = this.wake;
    this.wake = null;
    wake?.();
  }

  private async until<T>(ready: () => T | null): Promise<T> {
    for (;;) {
      this.check();
      const value = ready();
      if (value !== null) return value;
      await new Promise<void>((resolve) => {
        this.wake = resolve;
      });
    }
  }
}
