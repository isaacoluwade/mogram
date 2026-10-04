"use client";

import { useState } from "react";

/**
 * Local edits of a value that can also change from outside (undo, another panel, the code
 * editor). The draft follows the source whenever the source changes, and is the person's typing
 * otherwise. This is React's "adjust state when a prop changes" pattern, without an effect.
 */
export function useDraft<T>(source: T): [T, (draft: T) => void] {
  const [state, setState] = useState({ source, draft: source });
  if (!Object.is(state.source, source)) {
    setState({ source, draft: source });
    return [source, (draft) => setState({ source, draft })];
  }
  return [state.draft, (draft) => setState({ source, draft })];
}
