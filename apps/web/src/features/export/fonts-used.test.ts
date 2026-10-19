import { describe, expect, it } from "vitest";
import { parseDiagram } from "@mogram/core/format";
import { fontsUsed } from "./export";

describe("the fonts an export embeds", () => {
  it("embeds the mono a code listing is set in, and nothing a diagram doesn't use", () => {
    const plain = parseDiagram({
      "mogram.yaml": "mogram: 1\nshapes:\n  a: { label: A }\nlayout:\n  a: [0, 0]\n",
    }).diagram;
    expect([...fontsUsed(plain)]).toEqual([]);
    const code = parseDiagram({
      "mogram.yaml":
        "mogram: 1\nshapes:\n  main: { shape: code, text: 'echo hi' }\nlayout:\n  main: [0, 0]\n",
    }).diagram;
    expect([...fontsUsed(code)]).toEqual(["mono"]);
  });
});
