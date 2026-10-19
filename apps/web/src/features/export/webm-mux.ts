/**
 * A WebM file from encoded video (VP9 or VP8) and, optionally, Opus audio (D-106): the browser
 * encodes with WebCodecs, and this writes the Matroska elements around the frames, so a deck's
 * video needs no library. Everything is in memory: sizes are known, so nothing is left open.
 */

export interface EncodedFrame {
  readonly data: Uint8Array;
  /** When it shows, in microseconds. */
  readonly timestamp: number;
  readonly key: boolean;
}

export interface WebmInput {
  readonly video: {
    readonly codec: "V_VP9" | "V_VP8";
    readonly width: number;
    readonly height: number;
    readonly frames: readonly EncodedFrame[];
  };
  readonly audio?: {
    readonly sampleRate: number;
    readonly channels: number;
    /** The Opus header the decoder needs (`OpusHead`). */
    readonly header: Uint8Array;
    readonly frames: readonly EncodedFrame[];
  };
  /** How long it runs, in seconds. */
  readonly duration: number;
}

// -------------------------------------------------------------------------------------------------
// EBML

const encoder = new TextEncoder();

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** An element's id, as its bytes are written (the length marker is part of the id). */
function idBytes(id: number): Uint8Array {
  const bytes: number[] = [];
  for (let value = id; value > 0; value = Math.floor(value / 256)) bytes.unshift(value & 0xff);
  return new Uint8Array(bytes);
}

/** A size as a variable-length integer, in the fewest bytes that hold it. */
export function vint(value: number): Uint8Array {
  let length = 1;
  while (value >= 2 ** (7 * length) - 1) length++;
  if (length > 8) throw new Error("That's too big for a WebM file.");
  const bytes = new Uint8Array(length);
  let rest = value;
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = rest & 0xff;
    rest = Math.floor(rest / 256);
  }
  bytes[0] = (bytes[0] ?? 0) | (0x80 >> (length - 1));
  return bytes;
}

function element(id: number, body: Uint8Array): Uint8Array {
  return concat([idBytes(id), vint(body.length), body]);
}

const master = (id: number, children: readonly Uint8Array[]) => element(id, concat(children));

function uint(id: number, value: number): Uint8Array {
  const bytes: number[] = [];
  let rest = Math.round(value);
  do {
    bytes.unshift(rest & 0xff);
    rest = Math.floor(rest / 256);
  } while (rest > 0);
  return element(id, new Uint8Array(bytes));
}

function float(id: number, value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value);
  return element(id, bytes);
}

const text = (id: number, value: string) => element(id, encoder.encode(value));

// The ids used, from the Matroska specification.
const ID = {
  EBML: 0x1a45dfa3,
  EBMLVersion: 0x4286,
  EBMLReadVersion: 0x42f7,
  EBMLMaxIDLength: 0x42f2,
  EBMLMaxSizeLength: 0x42f3,
  DocType: 0x4282,
  DocTypeVersion: 0x4287,
  DocTypeReadVersion: 0x4285,
  Segment: 0x18538067,
  Info: 0x1549a966,
  TimecodeScale: 0x2ad7b1,
  Duration: 0x4489,
  MuxingApp: 0x4d80,
  WritingApp: 0x5741,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  TrackNumber: 0xd7,
  TrackUID: 0x73c5,
  TrackType: 0x83,
  FlagLacing: 0x9c,
  CodecID: 0x86,
  CodecPrivate: 0x63a2,
  CodecDelay: 0x56aa,
  SeekPreRoll: 0x56bb,
  Video: 0xe0,
  PixelWidth: 0xb0,
  PixelHeight: 0xba,
  Audio: 0xe1,
  SamplingFrequency: 0xb5,
  Channels: 0x9f,
  Cluster: 0x1f43b675,
  Timecode: 0xe7,
  SimpleBlock: 0xa3,
  Cues: 0x1c53bb6b,
  CuePoint: 0xbb,
  CueTime: 0xb3,
  CueTrackPositions: 0xb7,
  CueTrack: 0xf7,
  CueClusterPosition: 0xf1,
} as const;

/** A cluster holds at most this long of the file, in ms (well under a block's ±32 s reach). */
const CLUSTER_MS = 5000;

/** Opus's own lead-in, in ns: what a decoder drops before the first sound. */
const OPUS_DELAY_NS = 6_500_000;

/** The WebM file. */
export function muxWebm(input: WebmInput): Uint8Array {
  const ebml = master(ID.EBML, [
    uint(ID.EBMLVersion, 1),
    uint(ID.EBMLReadVersion, 1),
    uint(ID.EBMLMaxIDLength, 4),
    uint(ID.EBMLMaxSizeLength, 8),
    text(ID.DocType, "webm"),
    uint(ID.DocTypeVersion, 4),
    uint(ID.DocTypeReadVersion, 2),
  ]);

  const info = master(ID.Info, [
    uint(ID.TimecodeScale, 1_000_000),
    float(ID.Duration, input.duration * 1000),
    text(ID.MuxingApp, "Mogram"),
    text(ID.WritingApp, "Mogram"),
  ]);

  const tracks: Uint8Array[] = [
    master(ID.TrackEntry, [
      uint(ID.TrackNumber, 1),
      uint(ID.TrackUID, 1),
      uint(ID.TrackType, 1),
      uint(ID.FlagLacing, 0),
      text(ID.CodecID, input.video.codec),
      master(ID.Video, [
        uint(ID.PixelWidth, input.video.width),
        uint(ID.PixelHeight, input.video.height),
      ]),
    ]),
  ];
  if (input.audio !== undefined)
    tracks.push(
      master(ID.TrackEntry, [
        uint(ID.TrackNumber, 2),
        uint(ID.TrackUID, 2),
        uint(ID.TrackType, 2),
        uint(ID.FlagLacing, 0),
        text(ID.CodecID, "A_OPUS"),
        element(ID.CodecPrivate, input.audio.header),
        uint(ID.CodecDelay, OPUS_DELAY_NS),
        uint(ID.SeekPreRoll, 80_000_000),
        master(ID.Audio, [
          float(ID.SamplingFrequency, input.audio.sampleRate),
          uint(ID.Channels, input.audio.channels),
        ]),
      ]),
    );
  const trackList = master(ID.Tracks, tracks);

  // Every frame of both tracks, in the order they play.
  const blocks = [
    ...input.video.frames.map((frame) => ({ track: 1, frame })),
    ...(input.audio?.frames ?? []).map((frame) => ({ track: 2, frame })),
  ].sort((a, b) => a.frame.timestamp - b.frame.timestamp || a.track - b.track);

  const clusters: Uint8Array[] = [];
  const cues: { time: number; offset: number }[] = [];
  let offset = info.length + trackList.length;
  let at = 0;
  while (at < blocks.length) {
    const start = Math.floor((blocks[at]?.frame.timestamp ?? 0) / 1000);
    const children: Uint8Array[] = [uint(ID.Timecode, start)];
    let cue = false;
    while (at < blocks.length) {
      const block = blocks[at];
      if (block === undefined) break;
      const ms = Math.floor(block.frame.timestamp / 1000);
      // A new cluster starts on a video key frame once this one is long enough.
      if (ms - start >= CLUSTER_MS && block.track === 1 && block.frame.key) break;
      if (ms - start > 32_000) break;
      const header = new Uint8Array(4);
      header[0] = 0x80 | block.track;
      new DataView(header.buffer).setInt16(1, ms - start);
      header[3] = block.frame.key ? 0x80 : 0;
      children.push(element(ID.SimpleBlock, concat([header, block.frame.data])));
      if (block.track === 1 && block.frame.key && !cue) cue = true;
      at++;
    }
    const cluster = master(ID.Cluster, children);
    if (cue) cues.push({ time: start, offset });
    offset += cluster.length;
    clusters.push(cluster);
  }
  const cueList = master(
    ID.Cues,
    cues.map((cue) =>
      master(ID.CuePoint, [
        uint(ID.CueTime, cue.time),
        master(ID.CueTrackPositions, [
          uint(ID.CueTrack, 1),
          uint(ID.CueClusterPosition, cue.offset),
        ]),
      ]),
    ),
  );
  const segment = master(ID.Segment, [info, trackList, ...clusters, cueList]);
  return concat([ebml, segment]);
}

/** The header an Opus decoder needs, for when the encoder doesn't give one (RFC 7845 §5.1). */
export function opusHead(channels: number, sampleRate: number): Uint8Array {
  const head = new Uint8Array(19);
  head.set(encoder.encode("OpusHead"), 0);
  const view = new DataView(head.buffer);
  head[8] = 1;
  head[9] = channels;
  view.setUint16(10, 312, true);
  view.setUint32(12, sampleRate, true);
  view.setInt16(16, 0, true);
  head[18] = 0;
  return head;
}
