import type { Diagram } from "@mogram/core/model";
import { formatPaint, type Paint } from "@mogram/core/presets";

/** At most this many "Colours in this diagram" in the picker, most used first. */
const LIMIT = 14;

/**
 * The colours a diagram already uses (element overrides, notes, the background), so the picker
 * can offer them first and a diagram keeps a consistent palette.
 */
export function documentColors(diagram: Diagram): Paint[] {
  const counts = new Map<string, { paint: Paint; count: number }>();
  const add = (paint: Paint | null) => {
    if (paint === null) return;
    const key = formatPaint(paint);
    const entry = counts.get(key);
    if (entry === undefined) counts.set(key, { paint, count: 1 });
    else entry.count += 1;
  };
  const solid = (color: string | null) => add(color === null ? null : { kind: "solid", color });
  for (const component of diagram.components.values()) solid(component.color);
  for (const container of diagram.containers.values()) solid(container.color);
  for (const connection of diagram.connections.values()) solid(connection.color);
  add(diagram.settings.background);
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, LIMIT)
    .map((entry) => entry.paint);
}
