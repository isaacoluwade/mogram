import { describe, expect, it } from "vitest";
import { muxWebm, opusHead, vint } from "./webm-mux";

/** Reads EBML elements back: id, and where its body is. */
function readElements(bytes: Uint8Array, from = 0, to = bytes.length) {
  const out: { id: number; start: number; end: number }[] = [];
  let at = from;
  while (at < to) {
    const first = bytes[at] ?? 0;
    const idLength = Math.clz32(first) - 23;
    let id = 0;
    for (let i = 0; i < idLength; i++) id = id * 256 + (bytes[at + i] ?? 0);
    at += idLength;
    const sizeFirst = bytes[at] ?? 0;
    const sizeLength = Math.clz32(sizeFirst) - 23;
    let size = sizeFirst & (0xff >> sizeLength);
    for (let i = 1; i < sizeLength; i++) size = size * 256 + (bytes[at + i] ?? 0);
    at += sizeLength;
    out.push({ id, start: at, end: at + size });
    at += size;
  }
  return out;
}

const frame = (ms: number, key: boolean, size = 10) => ({
  data: new Uint8Array(size).fill(ms % 251),
  timestamp: ms * 1000,
  key,
});

describe("a deck's video file (WebM)", () => {
  it("writes sizes in the fewest bytes, never all ones", () => {
    expect([...vint(0)]).toEqual([0x80]);
    expect([...vint(126)]).toEqual([0xfe]);
    expect([...vint(127)]).toEqual([0x40, 0x7f]);
    expect([...vint(5000)]).toEqual([0x53, 0x88]);
  });

  it("holds the video and the voice, frame by frame, in clusters a player can seek to", () => {
    const video = Array.from({ length: 360 }, (_, i) =>
      frame(Math.round(i * (1000 / 30)), i % 60 === 0),
    );
    const audio = Array.from({ length: 600 }, (_, i) => frame(i * 20, true, 4));
    const file = muxWebm({
      video: { codec: "V_VP9", width: 1920, height: 1080, frames: video },
      audio: { sampleRate: 48000, channels: 1, header: opusHead(1, 48000), frames: audio },
      duration: 12,
    });
    const [ebml, segment] = readElements(file);
    expect(ebml?.id).toBe(0x1a45dfa3);
    expect(new TextDecoder().decode(file.slice(ebml!.start, ebml!.end))).toContain("webm");
    expect(segment?.id).toBe(0x18538067);
    const children = readElements(file, segment!.start, segment!.end);
    const clusters = children.filter((child) => child.id === 0x1f43b675);
    // About one a key frame past five seconds: 12 s of video.
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    expect(clusters.length).toBeLessThanOrEqual(4);
    let blocks = 0;
    for (const cluster of clusters)
      blocks += readElements(file, cluster.start, cluster.end).filter(
        (child) => child.id === 0xa3,
      ).length;
    expect(blocks).toBe(video.length + audio.length);
    expect(children.at(-1)?.id).toBe(0x1c53bb6b);
    const tracks = children.find((child) => child.id === 0x1654ae6b)!;
    const named = new TextDecoder().decode(file.slice(tracks.start, tracks.end));
    expect(named).toContain("V_VP9");
    expect(named).toContain("A_OPUS");
    expect(named).toContain("OpusHead");
  });
});
