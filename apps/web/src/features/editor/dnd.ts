/** Data type for dragging icons from the library onto the canvas (ED-2). */
export const LIBRARY_DRAG_TYPE = "application/x-mogram-icon";

export interface LibraryDrag {
  readonly type: string;
  readonly label: string;
}

export function encodeLibraryDrag(drag: LibraryDrag): string {
  return JSON.stringify(drag);
}

/**
 * Reads a library drag back. Any page or app can put data under this type (another tab, an
 * extension), so anything that isn't exactly `{ type, label }` strings of sane length is ignored.
 */
export function decodeLibraryDrag(raw: string): LibraryDrag | null {
  if (raw.length === 0 || raw.length > 1_000) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { type, label } = value as Record<string, unknown>;
  if (typeof type !== "string" || typeof label !== "string") return null;
  if (type.length === 0 || type.length > 200 || label.length > 200) return null;
  return { type, label };
}
