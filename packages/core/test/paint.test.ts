import { describe, expect, it } from "vitest";
import { parseDiagram } from "../src/format";
import {
  DEFAULT_GRADIENTS,
  DEFAULT_SOLIDS,
  GRADIENT_GROUPS,
  NOTE_COLORS,
  PALETTE,
  formatHex,
  formatPaint,
  hsvToRgb,
  namedColors,
  linear,
  normalizeHex,
  parseColor,
  parsePaint,
  radial,
  rgbToHsv,
  type Paint,
} from "../src/presets";

const paint = (text: string): Paint => {
  const read = parsePaint(text);
  if ("error" in read) throw new Error(read.error);
  return read.paint;
};

describe("hex colours with opacity", () => {
  it("normalises every hex form to #rrggbb, or #rrggbbaa when see-through", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("#abc8")).toBe("#aabbcc88");
    expect(normalizeHex("#5C9776")).toBe("#5c9776");
    expect(normalizeHex("#5c977680")).toBe("#5c977680");
    expect(normalizeHex("#5c9776ff")).toBe("#5c9776");
    expect(normalizeHex("5c9776")).toBeNull();
    expect(normalizeHex("#5c97")).toBe("#55cc9977");
    expect(normalizeHex("#12345")).toBeNull();
  });

  it("reads and writes alpha", () => {
    expect(parseColor("#ff000080")).toEqual({ r: 255, g: 0, b: 0, a: 128 / 255 });
    expect(formatHex({ r: 255, g: 0, b: 0, a: 0.5 })).toBe("#ff000080");
    expect(formatHex({ r: 255, g: 0, b: 0, a: 1 })).toBe("#ff0000");
  });
});

describe("paints in CSS syntax", () => {
  it("round-trips solids, linear and radial gradients", () => {
    for (const text of [
      "#1f3528",
      "#1f352880",
      "linear-gradient(135deg, #431043, #d34681)",
      "linear-gradient(90deg, #431043, #d34681 40%, #ffd400)",
      "radial-gradient(at 50% 50%, #431043, #d34681)",
      "radial-gradient(at 0% 0%, #431043, #d34681)",
      "radial-gradient(ellipse 120% 80% at 50% 0%, #161616, #0a0a0a)",
    ]) {
      expect(formatPaint(paint(text)), text).toBe(text);
    }
  });

  it("accepts the short forms people type", () => {
    expect(formatPaint(paint("linear-gradient(#000, #fff)"))).toBe(
      "linear-gradient(180deg, #000000, #ffffff)",
    );
    expect(formatPaint(paint("radial-gradient(#000, #fff)"))).toBe(
      "radial-gradient(at 50% 50%, #000000, #ffffff)",
    );
    expect(paint("  #ABC ")).toEqual({ kind: "solid", color: "#aabbcc" });
  });

  it("builds the same paints in code", () => {
    expect(formatPaint(linear(135, "#431043", "#d34681"))).toBe(
      "linear-gradient(135deg, #431043, #d34681)",
    );
    expect(formatPaint(radial({ x: 0, y: 0 }, ["#431043", "#d34681"]))).toBe(
      "radial-gradient(at 0% 0%, #431043, #d34681)",
    );
  });

  it("explains what to write instead", () => {
    const error = (text: string) => {
      const read = parsePaint(text);
      return "error" in read ? read.error : "";
    };
    expect(error("blue")).toMatch(/isn't a colour/);
    expect(error("linear-gradient(left, #000, #fff)")).toMatch(/angle like "135deg"/);
    expect(error("linear-gradient(90deg, #000)")).toMatch(/between 2 and 6 colours/);
    expect(error("linear-gradient(90deg, #000, red)")).toMatch(/"red" isn't a gradient colour/);
  });
});

describe("background and grid settings", () => {
  it("reads a gradient background and a grid colour from the file", () => {
    const { diagram, diagnostics } = parseDiagram(
      {
        "mogram.yaml": `mogram: 1\nbackground: "linear-gradient(135deg, #431043, #d34681)"\ngrid: "#ffffff40"\n`,
      },
      "",
    );
    expect(diagnostics).toEqual([]);
    expect(diagram.settings.background).toEqual(linear(135, "#431043", "#d34681"));
    expect(diagram.settings.grid).toBe("#ffffff40");
  });

  it("reports a background or grid it can't read, with the line", () => {
    const { diagnostics } = parseDiagram(
      { "mogram.yaml": `mogram: 1\nbackground: sunset\ngrid: white\n` },
      "",
    );
    expect(diagnostics.map((d) => [d.line, d.severity])).toEqual([
      [2, "error"],
      [3, "error"],
    ]);
    expect(diagnostics[0]?.message).toMatch(/isn't a colour/);
  });
});

describe("colour presets", () => {
  it("are valid hex colours, and every gradient round-trips through the file format", () => {
    for (const entry of [...DEFAULT_SOLIDS, ...PALETTE.flat(), ...NOTE_COLORS]) {
      expect(normalizeHex(entry.color), entry.name).toBe(entry.color);
    }
    for (const group of GRADIENT_GROUPS) {
      for (const gradient of group.gradients) {
        expect(paint(formatPaint(gradient.paint)), gradient.name).toEqual(gradient.paint);
      }
    }
  });

  it("give the picker four rows of solids, a full palette of twenty hues and grouped gradients", () => {
    expect(DEFAULT_SOLIDS).toHaveLength(28);
    expect(PALETTE).toHaveLength(20);
    for (const row of PALETTE) expect(row).toHaveLength(7);
    expect(DEFAULT_GRADIENTS).toHaveLength(14);
    expect(GRADIENT_GROUPS.map((group) => group.name)).toEqual([
      "Cool tones",
      "Warm tones",
      "Monochromatic",
      "Vivid",
    ]);
  });

  it("can be searched by name", () => {
    const blues = namedColors().filter((entry) => entry.name.toLowerCase().includes("blue"));
    expect(blues.length).toBeGreaterThan(5);
    expect(new Set(namedColors().map((entry) => entry.color)).size).toBe(namedColors().length);
  });
});

describe("hsv", () => {
  it("converts both ways without drifting", () => {
    for (const hex of [
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#d34681",
      "#431043",
      "#ffffff",
      "#000000",
      "#7f7f7f",
    ]) {
      const rgb = parseColor(hex);
      expect(formatHex(hsvToRgb(rgbToHsv(rgb)))).toBe(hex);
    }
    expect(rgbToHsv(parseColor("#ff0000"))).toEqual({ h: 0, s: 1, v: 1 });
    expect(formatHex(hsvToRgb({ h: 240, s: 1, v: 1 }, 0.5))).toBe("#0000ff80");
  });
});
