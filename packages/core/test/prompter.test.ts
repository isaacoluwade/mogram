import { describe, expect, it } from "vitest";
import person from "./fixtures/prompter-heard-person.json";
import bench from "./fixtures/prompter-heard.json";
import {
  beatAt,
  follow,
  FOLLOW,
  sameWord,
  scriptWords,
  steadyFollow,
  wordKey,
} from "../src/prompter";

const SCRIPT = scriptWords([
  "So Terraform has read your file, and it has asked Azure what exists right now.",
  "And the plan is just the difference between those two things. Nothing has been touched yet.",
  "Read that line again. 2 to add, nothing to change, nothing to destroy.",
  "And the plan is what you approve before anything real happens.",
]);

/** Reads a stream of hearings (each the recogniser's whole current guess) and returns the positions. */
function read(hearings: readonly string[], start = 0): number[] {
  let position = start;
  return hearings.map((heard) => {
    position = follow(SCRIPT, position, heard.split(" ")).position;
    return position;
  });
}

describe("matching words", () => {
  it("ignores case, punctuation and how a number is written", () => {
    expect(wordKey("File,")).toBe("file");
    expect(wordKey("Terraform's")).toBe("terraforms");
    expect(wordKey("2")).toBe("two");
    expect(wordKey("—")).toBe("");
  });

  it("forgives a recogniser's slip on a long word, never on a short one", () => {
    expect(sameWord("resource", "resources")).toBe(true);
    expect(sameWord("terraforms", "terraform")).toBe(true);
    expect(sameWord("diference", "difference")).toBe(true);
    expect(sameWord("the", "then")).toBe(false);
    expect(sameWord("to", "two")).toBe(false);
    expect(sameWord("plan", "play")).toBe(true);
    expect(sameWord("azure", "asked")).toBe(false);
  });
});

describe("following a reader", () => {
  it("moves with the words as a guess grows", () => {
    expect(
      read(["so", "so terraform", "so terraform has read", "so terraform has read your file"]),
    ).toEqual([1, 2, 4, 6]);
  });

  it("keeps up through misheard and dropped words", () => {
    // "red" for "read", "as your" for "Azure", and "it" dropped.
    const positions = read([
      "so terraform has red your file",
      "so terraform has red your file and has asked as your what exists right now",
    ]);
    expect(positions.at(-1)).toBe(15);
  });

  it("holds when the reader says something that isn't in the script", () => {
    const [at] = read(["so terraform has read your file"]);
    expect(read(["by the way I should mention my cat is asleep"], at)).toEqual([at]);
    // And picks up again when they come back to it.
    expect(read(["by the way and it has asked azure"], at)).toEqual([11]);
  });

  it("doesn't leap ahead on a common word or two", () => {
    // "the plan" is in beats 2 and 4: two words aren't enough to jump there.
    expect(read(["the plan"], 2)).toEqual([2]);
  });

  it("jumps ahead when a sentence is skipped, once enough words match", () => {
    const start = 6; // after "…read your file,"
    const positions = read(["and the plan", "and the plan is just the difference"], start);
    expect(positions[0]).toBe(start);
    expect(SCRIPT[(positions[1] ?? 0) - 1]?.key).toBe("difference");
  });

  it("stays put while the last few words are said again, then carries on", () => {
    // A recogniser changes its mind about the last word or two all the time: going back for
    // that would make the words flicker.
    const end = SCRIPT.findIndex((word) => word.key === "yet") + 1;
    const positions = read(
      [
        "nothing has been touched yet nothing has been touched",
        "has been touched yet nothing has been touched yet read that",
      ],
      end,
    );
    expect(positions).toEqual([end, end + 2]);
  });

  it("goes back when a sentence is read again", () => {
    const end = SCRIPT.findIndex((word) => word.key === "yet") + 1;
    const [at] = read(["touched yet and the plan is just the difference"], end);
    expect(SCRIPT[(at ?? 1) - 1]?.key).toBe("difference");
    expect(SCRIPT[(at ?? 1) - 1]?.beat).toBe(1);
  });

  it("steps over one small word misheard before a long one", () => {
    // "the difference" heard as "a difference", with the words before it heard right.
    const start = SCRIPT.findIndex((word) => word.key === "just") + 1;
    const [at] = read(["the plan is just a difference"], start);
    expect(SCRIPT[(at ?? 1) - 1]?.key).toBe("difference");
  });

  it("doesn't take words already said as proof of having moved on", () => {
    // "the" is nine words on. The words before it were all said before the reader stopped.
    const end = SCRIPT.findIndex((word) => word.key === "now") + 1;
    expect(read(["asked azure what exists right now by the"], end)).toEqual([end]);
  });

  it("goes back only when it's heard twice, when asked to be steady", () => {
    const end = SCRIPT.findIndex((word) => word.key === "yet") + 1;
    const steady = steadyFollow();
    const once = steady(SCRIPT, end, "touched yet and the plan is just the".split(" "));
    expect(once).toEqual({ position: end, moved: "held" });
    // The recogniser rights itself: nothing moved, and nothing is waiting any more.
    expect(steady(SCRIPT, end, "nothing has been touched yet".split(" ")).moved).toBe("held");
    steady(SCRIPT, end, "touched yet and the plan is just the".split(" "));
    const twice = steady(SCRIPT, end, "yet and the plan is just the difference".split(" "));
    expect(twice.moved).toBe("back");
    expect(SCRIPT[twice.position - 1]?.key).toBe("difference");
  });

  it("stays in the nearer of two places that read the same", () => {
    // "and the plan is" opens beats 2 and 4. From the end of beat 1, the nearer is beat 2.
    const start = SCRIPT.findIndex((word) => word.beat === 1);
    const [at] = read(["right now and the plan is"], start);
    expect(SCRIPT[(at ?? 1) - 1]?.beat).toBe(1);
  });

  it("reads a number said aloud as the digit written", () => {
    const start = SCRIPT.findIndex((word) => word.key === "two" && word.beat === 2);
    expect(read(["line again two to add nothing"], start - 2).at(-1)).toBe(start + 4);
  });

  it("says which beat the reader is in and how far through", () => {
    expect(beatAt(SCRIPT, 0)).toMatchObject({ beat: 0, progress: 0, done: false });
    const second = SCRIPT.findIndex((word) => word.beat === 1);
    expect(beatAt(SCRIPT, second).beat).toBe(1);
    expect(beatAt(SCRIPT, second + 8).progress).toBeCloseTo(0.5);
    expect(beatAt(SCRIPT, SCRIPT.length)).toMatchObject({ beat: 3, done: true });
  });
});

/**
 * What Chrome's on-device recogniser really heard when the bench (`apps/web/scripts/
 * prompter-bench.mjs`) read a script aloud: every guess, with when it came. Replayed here, so
 * a change to the follower is tried against real hearing without a browser or a microphone.
 */
describe("how far following may move the reader", () => {
  const filler = Array.from(
    { length: 12 },
    (_, i) => `Filler sentence number ${i} keeps going along.`,
  );
  const long = scriptWords([
    "We begin with the storage account and its name.",
    ...filler,
    "Finally the pipeline deploys everything to production safely.",
  ]);
  const heard = "finally the pipeline deploys everything to production".split(" ");

  it("finds the reader anywhere in the script, unless told to stay nearer", () => {
    const last = long.findIndex((word) => word.key === "production") + 1;
    expect(follow(long, 3, heard).position).toBe(last);
    expect(follow(long, 3, heard, { ...FOLLOW, reach: "nearby" })).toEqual({
      position: 3,
      moved: "held",
    });
    expect(follow(long, 3, heard, { ...FOLLOW, reach: "order" }).moved).toBe("held");
  });

  it("nearby still follows a sentence skipped or read again; in order, only the next words", () => {
    const skipped = "and the plan is just the difference".split(" ");
    const near = follow(SCRIPT, 6, skipped, { ...FOLLOW, reach: "nearby" });
    expect(SCRIPT[near.position - 1]?.key).toBe("difference");
    expect(follow(SCRIPT, 6, skipped, { ...FOLLOW, reach: "order" })).toEqual({
      position: 6,
      moved: "held",
    });
    // The words that come next still move it on.
    const on = follow(SCRIPT, 6, "your file and it has".split(" "), { ...FOLLOW, reach: "order" });
    expect(on).toEqual({ position: 9, moved: "on" });
    // And reading a sentence again doesn't take it back.
    const end = SCRIPT.findIndex((word) => word.key === "yet") + 1;
    const again = "touched yet and the plan is just the difference".split(" ");
    expect(follow(SCRIPT, end, again, { ...FOLLOW, reach: "order" }).position).toBe(end);
  });
});

describe("following what a recogniser really heard", () => {
  const script = scriptWords(bench.script);
  const first = (beat: number) => {
    const found = script.findIndex((word) => word.beat === beat);
    return found === -1 ? script.length : found;
  };
  type Part = { beat?: number; aside?: string; from: number; to: number };
  /** The position after each hearing, with when it was heard. */
  const replay = (name: keyof typeof bench.readings): [number, number][] => {
    let position = 0;
    const steady = steadyFollow();
    return (bench.readings[name].heard as [number, string][]).map(([at, heard]) => {
      position = steady(script, position, heard.split(/\s+/)).position;
      return [at, position];
    });
  };
  /** Where the prompter was at a moment of the recording. */
  const placeAt = (places: [number, number][], seconds: number) =>
    places.filter(([at]) => at <= seconds).at(-1)?.[1] ?? 0;

  it.each(["asides", "skipping", "again", "loose"] as const)(
    "has finished each paragraph of “%s” within two seconds of the reader",
    (name) => {
      const places = replay(name);
      for (const part of bench.readings[name].parts as Part[]) {
        if (part.beat === undefined) continue;
        // Read loosely, a paragraph's last words may never be said as written.
        const near = name === "loose" ? 3 : 1;
        const reached = Math.max(
          ...places
            .filter(([at]) => at >= part.from && at <= part.to + 2)
            .map(([, place]) => place),
        );
        expect(reached).toBeGreaterThanOrEqual(first(part.beat + 1) - near);
      }
    },
  );

  it("waits through every aside", () => {
    const places = replay("asides");
    for (const part of bench.readings.asides.parts as Part[]) {
      if (part.aside === undefined) continue;
      const before = placeAt(places, part.from);
      for (const [at, place] of places)
        if (at > part.from && at <= part.to)
          expect(Math.abs(place - before)).toBeLessThanOrEqual(2);
    }
  });

  it("never runs ahead of a reader going straight through", () => {
    const places = replay("loose");
    let last = 0;
    for (const [, place] of places) {
      expect(place - last).toBeLessThanOrEqual(6);
      last = place;
    }
  });
});

/**
 * The same, for a person: seven minutes of a LibriSpeech reader (public domain), with takes
 * from another chapter as asides, five takes skipped and three read twice.
 */
describe("following what a recogniser heard a person say", () => {
  const script = scriptWords(person.script);
  type Part = { beat?: number; aside?: string; from: number; to: number };
  const steady = steadyFollow();
  let position = 0;
  const moves: { at: number; position: number; moved: string }[] = [];
  for (const [at, heard] of person.heard as [number, string][]) {
    const next = steady(script, position, heard.split(/\s+/));
    position = next.position;
    moves.push({ at, position, moved: next.moved });
  }

  it("ends on the last word", () => {
    expect(position).toBe(script.length);
  });

  it("waits through every aside", () => {
    for (const part of person.parts as Part[]) {
      if (part.aside === undefined) continue;
      const during = moves.filter((move) => move.at > part.from + 1 && move.at <= part.to);
      const places = during.map((move) => move.position);
      expect(Math.max(...places) - Math.min(...places)).toBeLessThanOrEqual(2);
    }
  });

  it("goes back once, for the takes read twice, and jumps ahead once, for the ones skipped", () => {
    expect(moves.filter((move) => move.moved === "back")).toHaveLength(1);
    expect(moves.filter((move) => move.moved === "ahead")).toHaveLength(1);
  });
});
