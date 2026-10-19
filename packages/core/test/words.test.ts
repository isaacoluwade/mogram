import { describe, expect, it } from "vitest";
import {
  formatPointer,
  keepVoice,
  staleVoice,
  voiceFiles,
  voiceFor,
  voiceKey,
  voiceWords,
  VOICE_TAIL,
  type AssetPointer,
} from "../src/assets";
import {
  deckBeats,
  projectAbout,
  deckChapters,
  deckScript,
  deckSlides,
  deckSubtitles,
  deckTimeline,
  type DeckSource,
} from "../src/deck";
import { parseDiagram } from "../src/format";
import type { ProjectFiles } from "../src/model";

const clip = (seconds: number, skip?: number): AssetPointer => ({
  hash: "a".repeat(64),
  type: "audio/webm",
  bytes: 1000,
  seconds,
  ...(skip === undefined ? {} : { skip }),
});

describe("a recording is found by its words (D-105)", () => {
  it("keys words without case, punctuation or accents, and tells scripts apart", () => {
    expect(voiceWords("The plan — it's the difference!")).toEqual([
      "the",
      "plan",
      "its",
      "the",
      "difference",
    ]);
    expect(voiceKey("The plan is the difference.")).toBe(voiceKey("the plan, is the difference"));
    expect(voiceKey("Café crème")).toBe(voiceKey("cafe creme"));
    expect(voiceKey("The plan is the difference.")).toMatch(
      /^the-plan-is-the-difference-[0-9a-f]{8}$/,
    );
    expect(voiceKey("The plan is the difference. Nothing yet.")).not.toBe(
      voiceKey("The plan is the difference."),
    );
    expect(voiceKey(" ... ")).toBeNull();
  });

  it("finds a clip by the script, with how long it plays after the silence it skips", () => {
    const files = voiceFiles("talk", "The plan is the difference.", clip(6.19, 0.21));
    const found = voiceFor(files, "talk", "the plan is the difference");
    expect(found?.path).toMatch(/^talk\/voice\/the-plan-is-the-difference-[0-9a-f]{8}\.webm$/);
    expect(found?.seconds).toBeCloseTo(5.98, 5);
    expect(found?.skip).toBe(0.21);
    expect(voiceFor(files, "talk", "The plan is the change.")).toBeNull();
  });

  it("offers a clip whose words changed, and keeps it under the new words", () => {
    const old = "Terraform has read your file and asked Azure what exists.";
    const now = "Terraform has read your file, and asked Azure what exists right now.";
    const files: ProjectFiles = voiceFiles("", old, clip(4));
    const stale = staleVoice(files, "", now, [now]);
    expect(stale?.words).toBe(old);
    // Nothing alike is offered, and a clip another script still uses isn't either.
    expect(
      staleVoice(files, "", "Something else entirely.", ["Something else entirely."]),
    ).toBeNull();
    expect(staleVoice(files, "", now, [now, old])).toBeNull();

    const kept = keepVoice(files, "", stale!.path, now);
    expect(voiceFor(kept, "", now)?.seconds).toBe(4);
    expect(voiceFor(kept, "", old)).toBeNull();
    expect(Object.keys(kept)).toHaveLength(2);
    expect(Object.values(kept)).toContain(formatPointer(clip(4)));
  });
});

const DECK: ProjectFiles = {
  "mogram.yaml": `mogram: 1
name: Terraform in ten minutes
deck:
  slides:
    - section: Planning
    - title: { title: Welcome }
    - flow: { to: plan }
    - section: Applying
    - flow: { from: plan, title: Apply }
`,
  "title/mogram.yaml": "mogram: 1\nname: Title\n",
  "flow/mogram.yaml": `mogram: 1
name: The flow
shapes:
  write: { label: Write }
  plan: { label: Plan, show: hidden }
  apply: { label: Apply, show: hidden }
stories:
  main:
    - say: You write it.
      script: You write what you want in a file.
    - say: The plan is the difference.
      name: plan
      set: { plan: shown }
    - script: And apply makes it so.
      set: { apply: shown }
layout:
  write: [0, 0]
  plan: [20, 0]
  apply: [40, 0]
`,
};

function source(files: ProjectFiles): DeckSource {
  return {
    has: (folder) =>
      Object.keys(files).some((path) => path.startsWith(folder === "" ? "" : `${folder}/`)),
    load: (folder) => parseDiagram(files, folder),
  };
}

describe("a deck's words (D-105)", () => {
  const loader = source(DECK);
  const slides = deckSlides(loader, "");
  const timeline = deckTimeline(loader, slides);
  const beats = deckBeats(loader, slides, timeline);

  it("lists every beat with its words, slide and times", () => {
    expect(beats.map((beat) => [beat.slide, beat.beat, beat.caption, beat.script])).toEqual([
      [1, 0, "You write it.", "You write what you want in a file."],
      [1, 1, "The plan is the difference.", null],
      [2, 0, null, "And apply makes it so."],
    ]);
    for (const [index, beat] of beats.entries()) {
      expect(beat.end).toBeGreaterThan(beat.start);
      if (index > 0) expect(beat.start).toBeGreaterThanOrEqual(beats[index - 1]!.end - 1e-9);
    }
  });

  it("lasts as long as a beat's recording, and a little more", () => {
    const script = "You write what you want in a file.";
    const timed = deckTimeline(loader, slides, undefined, (words) => (words === script ? 9 : null));
    const first = deckBeats(loader, slides, timed)[0]!;
    expect(first.end - first.start).toBeCloseTo(9 + VOICE_TAIL, 5);
  });

  it("writes the script, marking what isn't recorded", () => {
    const script = deckScript("Terraform in ten minutes", slides, beats, (words) =>
      words.startsWith("You write"),
    );
    expect(script).toBe(`# Terraform in ten minutes

## Planning

### 1. Welcome

_A still slide: nothing is said._

### 2. The flow

**You write it.**

You write what you want in a file.

**The plan is the difference.**

## Applying

### 3. Apply

And apply makes it so.

_Not recorded yet._
`);
  });

  it("writes subtitles at the deck's times, and chapters where sections start", () => {
    const vtt = deckSubtitles(beats);
    expect(vtt.startsWith("WEBVTT\n\n1\n")).toBe(true);
    expect(vtt).toContain("You write what you want in a file.");
    expect(vtt).toContain("The plan is the difference.");
    expect(vtt).toMatch(/\d\d:\d\d:\d\d\.\d{3} --> \d\d:\d\d:\d\d\.\d{3}/);
    const chapters = deckChapters(slides, timeline).trim().split("\n");
    expect(chapters[0]).toBe("0:00 Planning");
    expect(chapters[1]).toMatch(/^0:\d\d Applying$/);
  });

  it("cuts long words into cues of two short lines", () => {
    const long = { ...beats[0]!, script: "word ".repeat(60).trim(), start: 0, end: 12 };
    const cues = deckSubtitles([long]).split("\n\n").slice(1);
    expect(cues.length).toBeGreaterThan(2);
    for (const cue of cues) expect(cue.split("\n")[2]!.length).toBeLessThanOrEqual(84);
  });
});

describe("what a project is, for a list of projects", () => {
  it("counts a deck's slides and how far its words have got", () => {
    const files = { ...DECK, ...voiceFiles("", "And apply makes it so.", clip(3)) };
    expect(projectAbout(files, source(files))).toEqual({
      kind: "deck",
      slides: 3,
      scenes: 0,
      beats: 3,
      scripted: 2,
      recorded: 1,
    });
  });

  it("counts a diagram's scenes and its story's beats", () => {
    const files = {
      "mogram.yaml": `mogram: 1
shapes:
  a: { label: A }
scenes:
  outage:
    a: down
stories:
  main:
    - say: One
    - say: Two
      script: The second, said aloud.
layout:
  a: [0, 0]
`,
    };
    expect(projectAbout(files, source(files))).toEqual({
      kind: "diagram",
      slides: 0,
      scenes: 1,
      beats: 2,
      scripted: 1,
      recorded: 0,
    });
  });
});
