import { describe, expect, it } from "vitest";
import { decodeLibraryDrag, encodeLibraryDrag } from "./dnd";

describe("library drag payload", () => {
  it("round-trips", () => {
    const drag = { type: "azure/compute/virtual-machine", label: "Virtual machine" };
    expect(decodeLibraryDrag(encodeLibraryDrag(drag))).toEqual(drag);
  });

  it.each([
    "",
    "not json",
    "null",
    "42",
    '"text"',
    "[]",
    '{"type":1,"label":"x"}',
    '{"type":"","label":"x"}',
    '{"type":"a"}',
    JSON.stringify({ type: "a".repeat(201), label: "x" }),
    JSON.stringify({ type: "a", label: "x".repeat(2_000) }),
  ])("ignores %j", (raw) => {
    expect(decodeLibraryDrag(raw)).toBeNull();
  });
});
