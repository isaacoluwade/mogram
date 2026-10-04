"use client";

import { useEffect, useRef } from "react";

/**
 * Marks a horizontal scroller with `data-fade="start" | "end" | "both"` while there is more to
 * see that way, so the `.scroll-fade` style fades only the edges that actually hide something.
 */
export function useScrollFade<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    const update = () => {
      const start = node.scrollLeft > 1;
      const end = node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
      const fade = start && end ? "both" : start ? "start" : end ? "end" : null;
      if (fade === null) node.removeAttribute("data-fade");
      else node.setAttribute("data-fade", fade);
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    for (const child of node.children) observer.observe(child);
    return () => {
      node.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);
  return ref;
}
