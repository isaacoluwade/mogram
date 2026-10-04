/// <reference lib="webworker" />
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import type { GifReply, GifRequest } from "./gif-client";

/**
 * GIF encoding off the main thread (EX-4). Frames arrive as RGBA pixels; each gets its own
 * 256-colour palette so gradients and state colours stay faithful.
 */
let encoder: ReturnType<typeof GIFEncoder> | null = null;
let size = { width: 0, height: 0 };
let first = true;

const reply = (message: GifReply, transfer: Transferable[] = []): void =>
  (self as unknown as Worker).postMessage(message, transfer);

self.onmessage = (event: MessageEvent<GifRequest>) => {
  const message = event.data;
  if (message.type === "start") {
    encoder = GIFEncoder();
    size = { width: message.width, height: message.height };
    first = true;
    return;
  }
  if (encoder === null) return;
  if (message.type === "frame") {
    const palette = quantize(message.rgba, 256, { format: "rgb565" });
    const index = applyPalette(message.rgba, palette, "rgb565");
    // repeat: 0 = loop forever (only written with the first frame).
    encoder.writeFrame(index, size.width, size.height, {
      palette,
      delay: message.delay,
      ...(first ? { repeat: 0 } : {}),
    });
    first = false;
    reply({ type: "progress" });
    return;
  }
  encoder.finish();
  const bytes = encoder.bytes();
  reply({ type: "done", bytes }, [bytes.buffer]);
  encoder = null;
};
