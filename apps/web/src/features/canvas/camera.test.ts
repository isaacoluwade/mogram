import { describe, expect, it } from "vitest";
import { fitBox, wheelZoomFactor } from "./camera";

describe("wheelZoomFactor", () => {
  it("zooms a mouse-wheel notch by about a fifth, in either unit", () => {
    expect(wheelZoomFactor(-100, 0)).toBeCloseTo(1.226, 2);
    expect(wheelZoomFactor(100, 0)).toBeCloseTo(1 / 1.226, 2);
    expect(wheelZoomFactor(-3, 1)).toBeCloseTo(1.226, 2); // three lines
    expect(wheelZoomFactor(-300, 0)).toBe(wheelZoomFactor(-100, 0)); // capped per event
  });

  it("keeps trackpad pinches proportional", () => {
    expect(wheelZoomFactor(-4, 0)).toBeCloseTo(Math.exp(4 * 0.0085), 6);
    expect(wheelZoomFactor(0, 0)).toBe(1);
  });
});

describe("fitBox", () => {
  const box = { x: 0, y: 0, w: 1000, h: 500 };
  it("fits the box, centred", () => {
    const camera = fitBox(box, { width: 500, height: 500 }, { padding: 0 });
    expect(camera.zoom).toBeCloseTo(0.5);
    expect(camera.x).toBeCloseTo(0);
    expect(camera.y).toBeCloseTo(125);
  });

  it("stops at minZoom and keeps the middle in view", () => {
    const camera = fitBox(box, { width: 500, height: 500 }, { padding: 0, minZoom: 0.8 });
    expect(camera.zoom).toBeCloseTo(0.8);
    expect(camera.x + 500 * 0.8).toBeCloseTo(250); // box centre at the viewport centre
  });
});
