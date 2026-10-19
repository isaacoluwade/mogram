/**
 * Pages (D-98): a fixed frame a diagram can have, for a slide, a video or a clean export. The
 * short side is always 135 cells, which is 1080 px at 100%, so a 28 px title is 28 px in a
 * 1080p video. The page's top-left corner is the canvas origin.
 */
export const PAGES = ["16:9", "4:3", "1:1", "9:16"] as const;

export type PageName = (typeof PAGES)[number];

/** A page's size in grid cells. */
const PAGE_CELLS: Readonly<Record<PageName, { readonly w: number; readonly h: number }>> = {
  "16:9": { w: 240, h: 135 },
  "4:3": { w: 180, h: 135 },
  "1:1": { w: 135, h: 135 },
  "9:16": { w: 135, h: 240 },
};

export function isPage(value: unknown): value is PageName {
  return typeof value === "string" && (PAGES as readonly string[]).includes(value);
}

/** A page's size in grid cells (8 px each at 100%). */
export function pageSize(page: PageName): { readonly w: number; readonly h: number } {
  return PAGE_CELLS[page];
}
