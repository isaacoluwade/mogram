import { describe, expect, it } from "vitest";
import { diffLines, MAX_EDITS, type DiffOp } from "../src/edit/diff";
import { patchOriginal } from "../src/edit/patch";

/** Rebuilds both sides from the ops, proving every line is accounted for, in order. */
function replay(ops: readonly DiffOp[], a: readonly string[], b: readonly string[]) {
  const left: string[] = [];
  const right: string[] = [];
  for (const op of ops) {
    if (op.kind !== "insert") left.push(a[op.a] ?? "?");
    if (op.kind !== "delete") right.push(b[op.b] ?? "?");
    if (op.kind === "equal") expect(a[op.a]).toBe(b[op.b]);
  }
  return { left, right };
}

/** Longest common subsequence length, by dynamic programming (the reference for minimality). */
function lcs(a: readonly string[], b: readonly string[]): number {
  const row = new Array<number>(b.length + 1).fill(0);
  for (const x of a) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] ?? 0;
      row[j] = x === b[j - 1] ? diagonal + 1 : Math.max(above, row[j - 1] ?? 0);
      diagonal = above;
    }
  }
  return row[b.length] ?? 0;
}

/** Small deterministic generator, so failures reproduce. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

describe("diffLines", () => {
  it("is complete and minimal on random inputs", () => {
    const next = random(7);
    for (let round = 0; round < 300; round++) {
      const line = () => "abcde"[Math.floor(next() * 5)] ?? "a";
      const a = Array.from({ length: Math.floor(next() * 14) }, line);
      const b = Array.from({ length: Math.floor(next() * 14) }, line);
      const ops = diffLines(a, b);
      expect(ops).not.toBeNull();
      const { left, right } = replay(ops ?? [], a, b);
      expect(left).toEqual(a);
      expect(right).toEqual(b);
      expect(ops?.filter((op) => op.kind === "equal")).toHaveLength(lcs(a, b));
    }
  });

  it("handles empty sides", () => {
    expect(diffLines([], [])).toEqual([]);
    expect(diffLines([], ["x"])).toEqual([{ kind: "insert", b: 0 }]);
    expect(diffLines(["x"], [])).toEqual([{ kind: "delete", a: 0 }]);
  });

  it("diffs a one-line change in a large file without searching the shared lines", () => {
    const a = Array.from({ length: 50_000 }, (_, i) => `line ${i}`);
    const b = [...a];
    b[25_000] = "changed";
    const ops = diffLines(a, b);
    expect(ops?.filter((op) => op.kind !== "equal")).toEqual([
      { kind: "delete", a: 25_000 },
      { kind: "insert", b: 25_000 },
    ]);
  });

  it("gives up past maxEdits rather than spending quadratic memory", () => {
    const a = Array.from({ length: 30 }, (_, i) => `a${i}`);
    const b = Array.from({ length: 30 }, (_, i) => `b${i}`);
    expect(diffLines(a, b, 59)).toBeNull();
    expect(diffLines(a, b, 60)).toHaveLength(60);
    expect(MAX_EDITS).toBeGreaterThanOrEqual(1000);
  });
});

describe("patchOriginal", () => {
  it("writes the whole new print when the texts are too far apart to diff", () => {
    const size = MAX_EDITS + 10;
    const original = Array.from({ length: size }, (_, i) => `k${i}:  ${i}`).join("\n");
    const before = Array.from({ length: size }, (_, i) => `k${i}: ${i}`).join("\n");
    const after = Array.from({ length: size }, (_, i) => `z${i}: ${i}`).join("\n");
    expect(patchOriginal(original, before, after)).toBe(after);
  });

  it("keeps the original spacing of untouched lines", () => {
    const original = "a:   1   # note\nb: 2\n";
    const before = "a: 1 # note\nb: 2\n";
    const after = "a: 1 # note\nb: 3\n";
    expect(patchOriginal(original, before, after)).toBe("a:   1   # note\nb: 3\n");
  });
});
