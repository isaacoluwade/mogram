/**
 * Myers' O(ND) line diff. Returns, for each line of `a` and `b`, whether it is kept, removed or
 * added, in order. Used to keep file edits to the minimum number of changed lines (FI-5).
 */

export type DiffOp =
  | { readonly kind: "equal"; readonly a: number; readonly b: number }
  | { readonly kind: "delete"; readonly a: number }
  | { readonly kind: "insert"; readonly b: number };

/**
 * Most changed lines a diff will search for. The search keeps D² numbers, so this bounds it to
 * ~16 MB and well under a second even for 1 MB files; two texts further apart than this share
 * too little for a minimal diff to matter, and callers fall back to writing the whole text.
 */
export const MAX_EDITS = 2000;

/** The line diff from `a` to `b`, or null when they differ by more than `maxEdits` lines. */
export function diffLines(
  a: readonly string[],
  b: readonly string[],
  maxEdits: number = MAX_EDITS,
): DiffOp[] | null {
  // A shared head and tail need no search; typical edits touch a few lines in between.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const middle = shortestEdit(a, b, start, endA, start, endB, maxEdits);
  if (middle === null) return null;
  const ops: DiffOp[] = [];
  for (let i = 0; i < start; i++) ops.push({ kind: "equal", a: i, b: i });
  for (const op of middle) ops.push(op);
  for (let i = 0; endA + i < a.length; i++) ops.push({ kind: "equal", a: endA + i, b: endB + i });
  return ops;
}

/** Myers' greedy search over a[a0, a1) and b[b0, b1). */
function shortestEdit(
  a: readonly string[],
  b: readonly string[],
  a0: number,
  a1: number,
  b0: number,
  b1: number,
  maxEdits: number,
): DiffOp[] | null {
  const n = a1 - a0;
  const m = b1 - b0;
  const max = Math.min(n + m, maxEdits);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  // trace[d] holds diagonals -d…d of the frontier before step d (all that step d reads).
  const trace: Int32Array[] = [];

  let found = false;
  for (let d = 0; d <= max && !found; d++) {
    trace.push(v.slice(offset - d, offset + d + 1));
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0));
      let x = down ? (v[offset + k + 1] ?? 0) : (v[offset + k - 1] ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && a[a0 + x] === b[b0 + y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = true;
        break;
      }
    }
  }
  if (!found) return null;

  // Backtrack through the saved frontiers.
  const ops: DiffOp[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const frontier = trace[d];
    if (frontier === undefined) break;
    const at = (k: number): number => frontier[k + d] ?? 0;
    const k = x - y;
    const down = k === -d || (k !== d && at(k - 1) < at(k + 1));
    const prevK = down ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      x--;
      y--;
      ops.push({ kind: "equal", a: a0 + x, b: b0 + y });
    }
    if (d > 0) {
      if (down) {
        y--;
        ops.push({ kind: "insert", b: b0 + y });
      } else {
        x--;
        ops.push({ kind: "delete", a: a0 + x });
      }
    }
  }
  return ops.reverse();
}
