"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * True after hydration. Animated canvases render only in the browser: their SVG depends on the
 * clock and the window size, so a server render could never match the first client render.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
