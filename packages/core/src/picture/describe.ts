import type { Diagram, SceneEntry } from "../model/types";
import { MARK_INFO } from "../presets/marks";

/** What people call an element: its label, or for an unlabelled arrow, its two ends. */
export function nameOf(diagram: Diagram, target: string): string {
  const element = diagram.components.get(target) ?? diagram.containers.get(target);
  if (element !== undefined) return element.label;
  const connection = diagram.connections.get(target);
  if (connection !== undefined) {
    if (connection.text !== null) return connection.text;
    const end = (name: string): string =>
      (diagram.components.get(name) ?? diagram.containers.get(name))?.label ?? name;
    return `${end(connection.from.element)} → ${end(connection.to.element)}`;
  }
  const decoration = diagram.decorations.get(target);
  if (decoration !== undefined) {
    const text = decoration.text.split("\n")[0] ?? "";
    return text.length > 24 ? `${text.slice(0, 23)}…` : text;
  }
  return target;
}

const times = (value: number): string => `${Number(value.toFixed(2))}×`;
const percent = (value: number): string => `${Math.round(value * 100)}%`;

/**
 * What one line of a set does, in a few plain words each: "shows Lease", "Database: down",
 * "Lease says “Expired”". One phrase per key, in the order they're written.
 */
export function describeChange(diagram: Diagram, entry: SceneEntry): string[] {
  const name = nameOf(diagram, entry.target);
  const out: string[] = [];
  const place = entry.place;
  if (place?.in !== undefined) out.push(`moves ${name} into ${nameOf(diagram, place.in)}`);
  if (place?.on !== undefined) out.push(`moves ${name} onto ${nameOf(diagram, place.on)}`);
  if (place?.cell !== undefined && place.in === undefined)
    out.push(`moves ${name} to cell ${place.cell.x}, ${place.cell.y}`);
  if (place?.along !== undefined && place.on === undefined)
    out.push(`moves ${name} along its line`);
  if (entry.show === "shown") out.push(`shows ${name}`);
  if (entry.show === "hidden") out.push(`hides ${name}`);
  if (entry.show === "faded") out.push(`fades ${name}`);
  if (entry.state !== null) out.push(`${name}: ${entry.state}`);
  if (entry.flow !== null) out.push(`${name}: ${entry.flow}`);
  if (entry.motion !== null)
    out.push(entry.motion === "none" ? `${name} stops moving` : `${name}: ${entry.motion}`);
  const capacity = entry.capacity;
  if (capacity?.traffic !== undefined) out.push(`${name} carries ${times(capacity.traffic)}`);
  if (capacity?.share !== undefined) out.push(`${name} gets ${percent(capacity.share)}`);
  if (capacity?.hit !== undefined) out.push(`${name} hits ${percent(capacity.hit)}`);
  if (capacity?.copies !== undefined)
    out.push(`${name}: ${capacity.copies} ${capacity.copies === 1 ? "copy" : "copies"}`);
  if (capacity?.size !== undefined) out.push(`${name}: size ${capacity.size}`);
  if (entry.label !== undefined) out.push(`${name} says “${entry.label}”`);
  if (entry.tone !== undefined) out.push(`${name} turns ${entry.tone}`);
  if (entry.mark === "none") out.push(`${name} loses its mark`);
  else if (entry.mark !== undefined)
    out.push(`${name} gets a ${MARK_INFO[entry.mark].label.toLowerCase()}`);
  return out;
}
