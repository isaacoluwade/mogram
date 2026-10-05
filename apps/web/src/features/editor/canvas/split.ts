import { ancestorsOf, type Box, type LayoutResult, type Point } from "@mogram/core/layout";
import type { Diagram } from "@mogram/core/model";
import { nearestAlong, type RoutedPath } from "@mogram/core/routing";

/**
 * The connection a component dropped at `centre` would split (ED-29, 02-connectors §12): the
 * nearest whose line passes within a third of the tile of its middle. Connections that already
 * end at the component, or at a container holding it, don't count.
 */
export function splitTarget(
  diagram: Diagram,
  layout: LayoutResult,
  routes: ReadonlyMap<string, RoutedPath>,
  name: string | null,
  tile: Box,
  centre: Point,
): string | null {
  const reach = Math.min(tile.w, tile.h) / 3;
  const around = new Set(name === null ? [] : [name, ...ancestorsOf(layout, name)]);
  let best: string | null = null;
  let nearest = Infinity;
  for (const connection of diagram.connections.values()) {
    if (around.has(connection.from.element) || around.has(connection.to.element)) continue;
    const route = routes.get(connection.name);
    if (route === undefined) continue;
    const { distance } = nearestAlong(route, centre);
    if (distance <= reach && distance < nearest) {
      best = connection.name;
      nearest = distance;
    }
  }
  return best;
}
