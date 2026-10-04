"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

const TYPE_MS = 70;
const ERASE_MS = 35;
const HOLD_MS = 2600;

/**
 * Eden's hero types its emphasised phrase. This cycles through phrases, typing and erasing them,
 * with a caret. Screen readers get the first phrase only, and reduced motion shows it still.
 */
export function Typewriter({ phrases }: { phrases: readonly string[] }) {
  const [index, setIndex] = useState(0);
  const [length, setLength] = useState(phrases[0]?.length ?? 0);
  const [erasing, setErasing] = useState(false);
  const still = usePrefersReducedMotion();

  const phrase = phrases[index] ?? "";
  useEffect(() => {
    if (still || phrases.length < 2) return;
    let delay = erasing ? ERASE_MS : TYPE_MS;
    if (!erasing && length === phrase.length) delay = HOLD_MS;
    const timer = window.setTimeout(() => {
      if (!erasing && length === phrase.length) setErasing(true);
      else if (erasing && length === 0) {
        setErasing(false);
        setIndex((i) => (i + 1) % phrases.length);
      } else setLength((n) => n + (erasing ? -1 : 1));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [still, erasing, length, phrase.length, phrases.length]);

  // The longest phrase sits invisibly underneath, so typing never moves the layout.
  const longest = phrases.reduce((a, b) => (b.length > a.length ? b : a), "");
  return (
    <>
      <span className="sr-only">{phrases[0]}</span>
      {/* Own line on small screens; inline and unbroken from lg, like Eden's. */}
      <span aria-hidden className="grid align-top lg:inline-grid lg:whitespace-nowrap">
        <span className="invisible col-start-1 row-start-1">{longest}</span>
        <span className="headline-emphasis col-start-1 row-start-1">
          {still ? phrases[0] : phrase.slice(0, length)}
          <span className="ml-0.5 inline-block h-[0.9em] w-[3px] translate-y-[0.08em] animate-pulse bg-fg align-baseline motion-reduce:hidden" />
        </span>
      </span>
    </>
  );
}
