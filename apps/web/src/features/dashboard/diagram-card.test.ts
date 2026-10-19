import { describe, expect, it } from "vitest";
import { aboutParts } from "./diagram-card";

const about = {
  kind: "diagram",
  slides: 0,
  scenes: 0,
  beats: 0,
  scripted: 0,
  recorded: 0,
} as const;

describe("what a card says about its diagram or deck", () => {
  it("says a deck's slides, and how much of its script is recorded", () => {
    expect(aboutParts({ ...about, kind: "deck", slides: 1 })).toEqual(["1 slide"]);
    expect(
      aboutParts({ ...about, kind: "deck", slides: 12, beats: 30, scripted: 30, recorded: 8 }),
    ).toEqual(["12 slides", "8 of 30 recorded"]);
    expect(
      aboutParts({ ...about, kind: "deck", slides: 3, beats: 4, scripted: 4, recorded: 4 }),
    ).toEqual(["3 slides", "All recorded"]);
  });

  it("says a diagram's scenes and story, and nothing for a plain one", () => {
    expect(aboutParts(about)).toEqual([]);
    expect(aboutParts({ ...about, scenes: 1, beats: 6 })).toEqual(["1 scene", "6-beat story"]);
  });
});
