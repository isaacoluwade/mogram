/** Levenshtein distance, capped for speed on short identifiers. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** The closest candidate when it is plausibly a typo, for "Did you mean …?" hints. */
export function closest(input: string, candidates: Iterable<string>): string | null {
  let best: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const lowered = input.toLowerCase();
  for (const candidate of candidates) {
    const distance = editDistance(lowered, candidate.toLowerCase());
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  const threshold = Math.max(1, Math.floor(input.length / 3));
  return best !== null && bestDistance <= threshold ? best : null;
}

export function didYouMean(input: string, candidates: Iterable<string>): string {
  const match = closest(input, candidates);
  return match === null ? "" : ` Did you mean "${match}"?`;
}

/** "a, b or c" for listing valid options in messages. */
export function listOptions(options: readonly string[]): string {
  if (options.length <= 1) return options.join("");
  return `${options.slice(0, -1).join(", ")} or ${options[options.length - 1] ?? ""}`;
}
