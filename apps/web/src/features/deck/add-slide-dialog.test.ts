import { describe, expect, it } from "vitest";
import { slideCandidates } from "./add-slide-dialog";

const diagram = (name: string, extra = "") => `mogram: 1\nname: ${name}\n${extra}`;

describe("the diagrams a deck can add as slides", () => {
  it("offers the project's diagrams, not the deck, its frame, other decks or nested levels", () => {
    const files = {
      "mogram.yaml": diagram("Course", "deck:\n  frame: frame\n  slides: [intro]\n"),
      "intro/mogram.yaml": diagram("Introduction"),
      "intro/db/mogram.yaml": diagram("Inside the database"),
      "flow/mogram.yaml": diagram("The flow"),
      "frame/mogram.yaml": diagram("Frame"),
      "other/mogram.yaml": diagram("Another deck", "deck:\n  slides: []\n"),
    };
    expect(slideCandidates(files, "")).toEqual([
      { folder: "flow", name: "The flow" },
      { folder: "intro", name: "Introduction" },
    ]);
  });

  it("offers a deck in a folder its own slide folders, and the project's other diagrams", () => {
    const files = {
      "mogram.yaml": diagram("Home"),
      "talks/mogram.yaml": diagram("Talk", "deck:\n  slides: [intro]\n"),
      "talks/intro/mogram.yaml": diagram("Introduction"),
      "talks/intro/db/mogram.yaml": diagram("Inside the database"),
      "notes/mogram.yaml": diagram("Notes"),
    };
    expect(slideCandidates(files, "talks").map((item) => item.folder)).toEqual([
      "notes",
      "talks/intro",
    ]);
  });
});
