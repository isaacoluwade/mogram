import { parseDiagram } from "../format/parse";
import { computeLayout } from "../layout/compute";
import { GRID } from "../layout/geometry";
import type { Diagram } from "../model/types";
import { endpointBox, followedVia, viaOrigin } from "../routing/route";
import { edit, type EditResult } from "./context";

/**
 * Carries connections' bends along with the elements an edit moved or resized (ED-29, P1.5):
 * `result` is that edit's outcome on `before`; the bends it left behind are rewritten in the
 * same result, so one undo step takes back both. Files that no longer parse are left alone.
 */
export function followTerminals(before: Diagram, result: EditResult, folder = ""): EditResult {
  const parsed = parseDiagram(result.files, folder);
  if (parsed.brokenFiles.length > 0) return result;
  const after = parsed.diagram;
  let layoutBefore: ReturnType<typeof computeLayout> | null = null;
  let layoutAfter: ReturnType<typeof computeLayout> | null = null;
  const updates: { name: string; via: { x: number; y: number }[] }[] = [];
  for (const connection of after.connections.values()) {
    const stored = after.layout.get(connection.name)?.via;
    const old = before.connections.get(connection.name);
    if (stored === null || stored === undefined || stored.length === 0 || old === undefined)
      continue;
    layoutBefore ??= computeLayout(before);
    layoutAfter ??= computeLayout(after);
    const source = endpointBox(layoutAfter, connection.from.element);
    const target = endpointBox(layoutAfter, connection.to.element);
    if (source === null || target === null) continue;
    const origin = viaOrigin(layoutAfter, connection);
    const moved = followedVia(layoutBefore, old, stored, { source, target }, origin);
    if (moved === null) continue;
    const via = moved.map((p) => ({
      x: Math.round((p.x - origin.x) / GRID),
      y: Math.round((p.y - origin.y) / GRID),
    }));
    const same = via.every((p, i) => {
      const was = stored[i];
      return was !== undefined && p.x === was.x && p.y === was.y;
    });
    if (same) continue;
    updates.push({ name: connection.name, via });
  }
  if (updates.length === 0) return result;
  const followed = edit(result.files, after, (ctx) => {
    for (const update of updates) ctx.setVia(update.name, update.via);
  });
  return { ...result, files: followed.files };
}
