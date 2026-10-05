"use client";

import { memo, useMemo } from "react";
import type { LayoutResult } from "@mogram/core/layout";
import type { Stub } from "@mogram/core/nested";
import type { FlowPreset } from "@mogram/core/presets";
import { polylinePath } from "@mogram/core/routing";
import { withAlpha } from "@mogram/core/timeline";
import { plainLook, type SceneConnection } from "../scene";
import type { CanvasTheme } from "../theme";
import { ConnectionNode } from "./connection-node";

const REACH = 96;
const GAP = 18;

/**
 * Inside a nested diagram, the parent's neighbours appear as faded stubs at the edge, labelled,
 * leading to the element their port connects to (NE-5). Traffic on the parent connection keeps
 * flowing along the stub into the diagram (NE-7). In on the left, out on the right.
 * Used by both the viewer and the editor; render it as the SVG underlay.
 */
export const StubsOverlay = memo(function StubsOverlay({
  stubs,
  flows,
  layout,
  theme,
}: {
  stubs: readonly Stub[];
  /** Flow of each parent connection, by name (scene-aware in the viewer). */
  flows: ReadonlyMap<string, FlowPreset>;
  layout: LayoutResult;
  theme: CanvasTheme;
}) {
  const bounds = layout.bounds;
  const drawn = useMemo(() => {
    const used = new Map<string, number>();
    return stubs.map((stub) => {
      const tile =
        stub.inner === null
          ? null
          : (layout.tiles.get(stub.inner) ?? layout.elements.get(stub.inner)?.box ?? null);
      const incoming = stub.direction === "in";
      const key = `${stub.inner ?? ""}|${stub.direction}`;
      const index = used.get(key) ?? 0;
      used.set(key, index + 1);
      const y = (tile === null ? bounds.y + bounds.h / 2 : tile.y + tile.h / 2) + index * GAP;
      const edge = incoming ? bounds.x - 24 : bounds.x + bounds.w + 24;
      const outer = { x: incoming ? edge - REACH : edge + REACH, y };
      const inner = { x: tile === null ? edge : incoming ? tile.x : tile.x + tile.w, y };
      const flow = flows.get(stub.connection) ?? "idle";
      // Dots travel the way the traffic does: inward for incoming, outward for outgoing.
      const path = polylinePath(incoming ? [outer, inner] : [inner, outer]);
      const connection: SceneConnection = {
        name: `stub:${stub.connection}`,
        path,
        flow: { from: flow, to: flow },
        direction: "forward",
        speed: "normal",
        density: "normal",
        color: null,
        label: null,
        labelAt: outer,
        labelPlaced: false,
        hasCard: false,
        look: plainLook(path),
        fromElement: "",
        toElement: "",
        carries: false,
      };
      return { stub, connection, outer, incoming };
    });
  }, [stubs, layout, bounds, flows]);

  const labelColor = withAlpha(theme.textMuted, 0.75);
  return (
    <g aria-hidden data-layer="stubs" opacity={0.6} style={{ pointerEvents: "none" }}>
      {drawn.map(({ stub, connection, outer, incoming }) => (
        <g key={stub.connection}>
          <ConnectionNode connection={connection} />
          <text
            x={incoming ? outer.x - 10 : outer.x + 10}
            y={outer.y}
            dominantBaseline="middle"
            textAnchor={incoming ? "end" : "start"}
            fontSize={12}
            fill={labelColor}
            fontStyle="italic"
          >
            {`${incoming ? "from" : "to"} ${stub.neighbourLabel}`}
          </text>
        </g>
      ))}
    </g>
  );
});

/** Room to leave either side of a nested level when framing it, so stubs and labels stay in view. */
export const STUB_ROOM = 230;
