import { describe, expect, it } from "vitest";
import { fitRich, layoutRich, lineOffset, parseRich, plainText } from "./rich-text";

const options = {
  family: "Inter, sans-serif",
  weight: 400,
  bold: false,
  italic: false,
  tracking: 0,
};

describe("rich text for notes and free text (ED-25)", () => {
  it("reads bold, italic, bullets and numbered lines", () => {
    const [title, bullet, numbered, plain] = parseRich(
      "**Follow-ups** for *today*\n- rate limit\n2. move *sessions*\nsnake_case_name stays",
    );
    expect(title).toEqual({
      list: null,
      number: 0,
      runs: [
        { text: "Follow-ups", bold: true, italic: false },
        { text: " for ", bold: false, italic: false },
        { text: "today", bold: false, italic: true },
      ],
    });
    expect(bullet).toMatchObject({ list: "bullet", runs: [{ text: "rate limit" }] });
    expect(numbered).toMatchObject({ list: "number", number: 2 });
    expect(plain?.runs).toEqual([{ text: "snake_case_name stays", bold: false, italic: false }]);
    expect(plainText("**A** *b*\n- c")).toBe("A b\nc");
  });

  it("leaves lone asterisks and maths alone", () => {
    expect(parseRich("2 * 3 * 4")[0]?.runs).toEqual([
      { text: "2 * 3 * 4", bold: false, italic: false },
    ]);
    expect(parseRich("**not closed")[0]?.runs[0]?.text).toBe("**not closed");
  });

  it("wraps words to the width, indents list lines, and splits words longer than a line", () => {
    const layout = layoutRich(parseRich("- one two three four five six"), {
      ...options,
      fontSize: 10,
      maxWidth: 80,
    });
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.lines[0]?.marker).toBe("•");
    expect(layout.lines[1]?.marker).toBeNull();
    expect(layout.lines[1]?.indent).toBe(layout.lines[0]?.indent);
    for (const line of layout.lines) expect(line.width).toBeLessThanOrEqual(80 + 1e-6);

    const long = layoutRich(parseRich("https://example.com/a/very/long/path"), {
      ...options,
      fontSize: 10,
      maxWidth: 60,
    });
    expect(long.splitWords).toBe(true);
  });

  it("fits a note's words: short text large, long text smaller", () => {
    const short = fitRich(parseRich("Ship it"), { ...options, maxWidth: 148 }, 116);
    const long = fitRich(
      parseRich("A much longer note that has to wrap across several lines to fit inside"),
      { ...options, maxWidth: 148 },
      116,
    );
    expect(short.fontSize).toBeGreaterThan(long.fontSize);
    expect(long.height).toBeLessThanOrEqual(116);
  });

  it("aligns lines within the width", () => {
    const [line] = layoutRich(parseRich("hi"), { ...options, fontSize: 10, maxWidth: 100 }).lines;
    if (line === undefined) throw new Error("no line");
    expect(lineOffset(line, "left", 100)).toBe(0);
    expect(lineOffset(line, "center", 100)).toBeCloseTo((100 - line.width) / 2);
    expect(lineOffset(line, "right", 100)).toBeCloseTo(100 - line.width);
  });
});
