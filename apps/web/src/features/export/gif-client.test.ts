import { describe, expect, it } from "vitest";
import {
  GifEncoderClient,
  MAX_QUEUED_FRAMES,
  type GifReply,
  type GifRequest,
  type GifWorker,
} from "./gif-client";

class FakeWorker implements GifWorker {
  onmessage: ((event: MessageEvent<GifReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly received: GifRequest["type"][] = [];
  terminated = false;

  postMessage(message: GifRequest): void {
    this.received.push(message.type);
  }

  terminate(): void {
    this.terminated = true;
  }

  reply(data: GifReply): void {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  crash(): void {
    this.onerror?.(new Event("error") as ErrorEvent);
  }
}

const pixels = () => new Uint8ClampedArray(4);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("GifEncoderClient", () => {
  it("waits for the encoder once MAX_QUEUED_FRAMES are in flight", async () => {
    const worker = new FakeWorker();
    const encoded: number[] = [];
    const client = new GifEncoderClient(worker, { width: 1, height: 1 }, (n) => encoded.push(n));
    for (let i = 0; i < MAX_QUEUED_FRAMES; i++) await client.add(pixels(), 50);

    let added = false;
    const next = client.add(pixels(), 50).then(() => (added = true));
    await settle();
    expect(added).toBe(false);
    expect(worker.received.filter((type) => type === "frame")).toHaveLength(MAX_QUEUED_FRAMES);

    worker.reply({ type: "progress" });
    await next;
    expect(added).toBe(true);
    expect(encoded).toEqual([1]);
    expect(worker.received.filter((type) => type === "frame")).toHaveLength(MAX_QUEUED_FRAMES + 1);
  });

  it("returns the finished bytes", async () => {
    const worker = new FakeWorker();
    const client = new GifEncoderClient(worker, { width: 1, height: 1 }, () => {});
    await client.add(pixels(), 50);
    const bytes = new Uint8Array([71, 73, 70]);
    const done = client.finish();
    worker.reply({ type: "progress" });
    worker.reply({ type: "done", bytes });
    await expect(done).resolves.toBe(bytes);
    expect(worker.received).toEqual(["start", "frame", "finish"]);
  });

  it("rejects a waiting frame as soon as the export is cancelled", async () => {
    const worker = new FakeWorker();
    const controller = new AbortController();
    const client = new GifEncoderClient(
      worker,
      { width: 1, height: 1 },
      () => {},
      controller.signal,
    );
    for (let i = 0; i < MAX_QUEUED_FRAMES; i++) await client.add(pixels(), 50);
    const waiting = client.add(pixels(), 50);
    controller.abort();
    await expect(waiting).rejects.toMatchObject({ name: "AbortError" });
    expect(() => client.check()).toThrow("Export cancelled");
    client.dispose();
    expect(worker.terminated).toBe(true);
  });

  it("fails at once when the signal was already aborted", () => {
    const controller = new AbortController();
    controller.abort();
    const client = new GifEncoderClient(
      new FakeWorker(),
      { width: 1, height: 1 },
      () => {},
      controller.signal,
    );
    expect(() => client.check()).toThrow("Export cancelled");
  });

  it("rejects finish() when the worker crashes", async () => {
    const worker = new FakeWorker();
    const client = new GifEncoderClient(worker, { width: 1, height: 1 }, () => {});
    const done = client.finish();
    worker.crash();
    await expect(done).rejects.toThrow("The GIF encoder stopped unexpectedly.");
  });
});
