import { describe, expect, it } from "vitest";
import { deckSlides } from "@mogram/core/deck";
import type { Deck } from "@mogram/core/model";
import { loaderFor } from "@/features/canvas/use-diagram";
import { insertAfter, railRows } from "./rail-rows";

const slide = (name: string) => ({ [`${name}/mogram.yaml`]: `mogram: 1\nname: ${name}\n` });

function deckOf(list: string) {
  const files = {
    "mogram.yaml": `mogram: 1\nname: Course\ndeck:\n  slides:\n${list}`,
    ...slide("a"),
    ...slide("b"),
    ...slide("c"),
  };
  const loader = loaderFor(files);
  const deck = loader.load("").diagram.settings.deck as Deck;
  return { deck, slides: deckSlides(loader, "") };
}

describe("the slide rail's rows", () => {
  it("lists sections with how many slides are under each, and skipped slides uncounted", () => {
    const { deck, slides } = deckOf(
      "    - a\n    - section: First\n    - b: { skip: true }\n    - c\n    - section: Empty\n",
    );
    const rows = railRows(deck, slides, (folder) => folder.toUpperCase());
    expect(
      rows.map((row) =>
        row.kind === "section"
          ? `§${row.title}:${row.count}`
          : `${row.slide?.number ?? "skipped"} ${row.title}@${row.section ?? "-"}`,
      ),
    ).toEqual(["1 a@-", "§First:2", "skipped B@First", "2 c@First", "§Empty:0"]);
  });
});

describe("where a new slide goes", () => {
  const { deck } = deckOf("    - a\n    - section: First\n    - b\n    - section: Empty\n");

  it("goes after the slide showing, staying in its section", () => {
    expect(insertAfter(deck, 0)).toBe(1);
  });

  it("goes into an empty section that comes straight after", () => {
    expect(insertAfter(deck, 2)).toBe(4);
  });

  it("goes at the end with no slide showing", () => {
    expect(insertAfter(deck, null)).toBe(4);
  });
});
