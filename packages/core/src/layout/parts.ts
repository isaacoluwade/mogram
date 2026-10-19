import type { AreaPart, Component, LinesPart, Part } from "../model/types";
import { CODE_METRICS } from "../presets/code";
import type { LayoutResult } from "./compute";
import type { Box } from "./geometry";
import { codeFontSize } from "./media";

/**
 * Where a part is (D-104): the box a focus keeps bright, a zoom frames and a connection ends
 * on, in the same pixels as the layout.
 */

/** Where an image's picture is drawn inside its element's box: contained, or covering it. */
export function imageContentBox(component: Component, box: Box): Box {
  const natural = component.image?.natural;
  const ratio =
    natural === null || natural === undefined ? box.w / box.h : natural.width / natural.height;
  const height =
    component.image?.fit === "cover"
      ? Math.max(box.w / ratio, box.h)
      : Math.min(box.w / ratio, box.h);
  const width = height * ratio;
  return { x: box.x + (box.w - width) / 2, y: box.y + (box.h - height) / 2, w: width, h: height };
}

function areaBox(component: Component, box: Box, part: AreaPart): Box | null {
  const picture = imageContentBox(component, box);
  // Clipped to the element: a covering picture runs past its edges.
  const x = Math.max(box.x, picture.x + part.x * picture.w);
  const y = Math.max(box.y, picture.y + part.y * picture.h);
  const right = Math.min(box.x + box.w, picture.x + (part.x + part.w) * picture.w);
  const bottom = Math.min(box.y + box.h, picture.y + (part.y + part.h) * picture.h);
  return right <= x || bottom <= y ? null : { x, y, w: right - x, h: bottom - y };
}

/** The top of line `line` (the file's own number) in a listing drawn in `box`. */
export function codeLineTop(component: Component, box: Box, line: number): number {
  const code = component.code;
  const first = code?.listing.first ?? 1;
  const header = code?.title === null || code === null ? 0 : CODE_METRICS.header;
  return (
    box.y +
    CODE_METRICS.padding +
    header +
    (line - first) * codeFontSize(component) * CODE_METRICS.lineHeight
  );
}

function linesBox(component: Component, box: Box, part: LinesPart): Box | null {
  const listing = component.code?.listing;
  if (listing === undefined) return null;
  // Only the lines the slice shows, and only those that fit in the element.
  const first = Math.max(listing.first, part.first);
  const last = Math.min(listing.last, part.last);
  if (first > last) return null;
  const top = codeLineTop(component, box, first);
  const bottom = Math.min(
    box.y + box.h - CODE_METRICS.padding,
    codeLineTop(component, box, last + 1),
  );
  const inner = box.w - CODE_METRICS.padding * 2;
  return bottom <= top || inner <= 0
    ? null
    : { x: box.x + CODE_METRICS.padding, y: top, w: inner, h: bottom - top };
}

/** A part's box; null when it shows nowhere (outside the slice, or cut off by the element's size). */
export function partBox(layout: LayoutResult, component: Component, part: Part): Box | null {
  const box = layout.elements.get(component.name)?.box;
  if (box === undefined) return null;
  return part.kind === "area" ? areaBox(component, box, part) : linesBox(component, box, part);
}
