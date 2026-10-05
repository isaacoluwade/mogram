import { describe, expect, it } from "vitest";
import { snapToGuides } from "./guides";

const box = (x: number, y: number, w = 96, h = 96) => ({ x, y, w, h });

describe("smart guides", () => {
  it("shows a guide when edges already line up on the grid", () => {
    const result = snapToGuides(box(0, 200), [box(0, 0)], 0, 0);
    expect(result.dx).toBe(0);
    expect(result.guides).toContainEqual({ kind: "align", axis: "x", at: 0, from: 0, to: 296 });
  });

  it("pulls the move by one cell to line up, and no further", () => {
    expect(snapToGuides(box(8, 200), [box(0, 0)], 0, 0).dx).toBe(-8);
    expect(snapToGuides(box(16, 200), [box(0, 0)], 0, 0).dx).toBe(0);
  });

  it("never pulls by part of a cell", () => {
    // Centres 4 px apart (a container of odd width): the grid position stands.
    const result = snapToGuides(box(0, 200, 96), [box(0, 0, 88)], 0, 0);
    expect(result.dx).toBe(0);
  });

  it("evens out the gaps between two neighbours, ahead of alignment", () => {
    const left = box(0, 0);
    const right = box(400, 0);
    // Gaps of 96 and 112: one cell to the right evens them at 104.
    const result = snapToGuides(box(192, 0), [left, right], 0, 0);
    expect(result.dx).toBe(8);
    expect(result.guides.find((g) => g.kind === "spacing")).toMatchObject({
      axis: "x",
      gaps: [
        { from: 96, to: 200 },
        { from: 296, to: 400 },
      ],
    });
  });
});
