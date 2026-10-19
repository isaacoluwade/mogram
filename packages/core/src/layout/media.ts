import { codeSize } from "../code/size";
import type { Component, GridSize } from "../model/types";
import { CODE_FONT_SIZE } from "../presets/code";

/** An image without a size in the layout is this many cells wide (D-102). */
export const IMAGE_WIDTH = 80;

/**
 * An image's own size, in cells: 80 wide at its picture's proportions, or 16:9 when those
 * aren't known.
 */
export function imageSize(image: NonNullable<Component["image"]>): GridSize {
  const ratio =
    image.natural === null ? 16 / 9 : image.natural.width / Math.max(1, image.natural.height);
  return { w: IMAGE_WIDTH, h: Math.max(1, Math.round(IMAGE_WIDTH / ratio)) };
}

/** A code element's text size, in px. */
export function codeFontSize(component: Component): number {
  return component.look?.text.fontSize ?? CODE_FONT_SIZE;
}

/** A shape's size when the layout doesn't give one: what its content needs, for media. */
export function contentSize(component: Component): GridSize | null {
  if (component.image !== null) return imageSize(component.image);
  if (component.code !== null)
    return codeSize(component.code.listing, {
      fontSize: codeFontSize(component),
      numbers: component.code.numbers,
      header: component.code.title !== null,
    });
  return null;
}
