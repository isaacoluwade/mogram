"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { Box, Point } from "@mogram/core/layout";
import { currentTime, useFrame, useTimeSource } from "../clock";
import { loadColor, machineFrame, percent, type MachineFrame } from "../capacity-frames";
import { iconHref, useIconCacheVersion } from "../icons";
import { tone } from "../theme";
import type { SceneComponent, SceneSpokes } from "../scene";
import { ExportLink } from "./glyphs";
import { actionProps, focusOpacity, useRender } from "./render-context";

const RADIUS = 14;
const ICON = 26;
const CHIP = { size: 7, gap: 3 } as const;
/** The icon and size name above the rows, and the load bar under them. */
const HEADER = 40;
const FOOTER = 24;

const DOT_SPACING = 14;

/** Re-renders with the clock while `active` (a resize under way); still otherwise. */
function useAnimatedTime(active: boolean): number {
  const source = useTimeSource();
  const [t, setT] = useState(() => currentTime(source));
  useEffect(() => {
    if (!active || source.kind !== "live") return;
    return source.clock.subscribe(setT);
  }, [active, source]);
  return source.kind === "static" ? source.t : active ? t : currentTime(source);
}

function sidePoint(panel: Box, toward: Point): Point {
  const cy = panel.y + Math.min(panel.h / 2, 40);
  return toward.x < panel.x + panel.w / 2 ? { x: panel.x, y: cy } : { x: panel.x + panel.w, y: cy };
}

function spokePath(from: Point, to: Point): string {
  const dx = (to.x - from.x) * 0.5;
  return `M${from.x} ${from.y}C${from.x + dx} ${from.y} ${to.x - dx} ${to.y} ${to.x} ${to.y}`;
}

/**
 * A component that scales up (D-82): one machine that grows. Its tile opens into a panel showing
 * what it has — cores that light up, memory that fills, disks that slide in — and the size's
 * name. It grows (and shrinks) smoothly into each new size, taking traffic all the while; the
 * faint outline is the largest size there is: once it's there and still busy, it can't grow.
 */
export const MachineNode = memo(function MachineNode({
  component,
  spokes,
}: {
  component: SceneComponent;
  spokes: SceneSpokes | null;
}) {
  const settings = useRender();
  const { theme, fontFamily } = settings;
  const source = useTimeSource();
  useIconCacheVersion();
  const scaling = component.scaling;
  const sizes = scaling?.kind === "up" ? scaling.sizes : [];
  const room: Box = scaling?.room ?? component.tile;
  const timeline = settings.capacity?.timeline ?? null;
  const now = currentTime(source);
  const resizing = timeline !== null && timeline.settledAt > now - 0.1;
  const t = useAnimatedTime(resizing);
  const frame: MachineFrame | null =
    timeline === null ? null : machineFrame(timeline, component.name, room, sizes, t);
  const panel = frame?.panel ?? room;
  const ends = [
    ...(spokes?.in ?? []).map((end) => ({ end, out: false })),
    ...(spokes?.out ?? []).map((end) => ({ end, out: true })),
  ];
  const dots = useRef<(SVGPathElement | null)[]>([]);

  // Traffic dots along the spokes keep moving.
  useFrame(timeline !== null && ends.length > 0, (time) => {
    dots.current.forEach((node) =>
      node?.setAttribute("stroke-dashoffset", String(-((time * 38) % DOT_SPACING))),
    );
  });

  const href = iconHref(component.icon, theme);
  const muted = theme.textMuted;
  const load = frame?.load ?? 0;
  const cores = frame?.cores ?? 0;
  const maxCores = Math.max(0, ...sizes.map((s) => s.cpu ?? 0));
  const lit = tone("violet", theme.mode).solid;
  const ceilingColor = frame?.ceiling === true ? tone("amber", theme.mode).solid : theme.tileBorder;
  // Each row says how much it has ("4 vCPU", "16 GB", "2 disks") and shows it beside.
  const diskCount = Math.round(frame?.disks ?? 0);
  const rows: { key: string; label: string }[] = [];
  if (maxCores > 0) rows.push({ key: "cpu", label: `${cores} vCPU` });
  if (sizes.some((s) => s.memory !== null))
    rows.push({ key: "memory", label: frame?.memory == null ? "–" : `${frame.memory} GB` });
  if (sizes.some((s) => s.disks !== null))
    rows.push({ key: "disks", label: `${diskCount} ${diskCount === 1 ? "disk" : "disks"}` });
  if (rows.length === 0) rows.push({ key: "capacity", label: `${frame?.size?.capacity ?? 1}×` });
  // Rows share the space between the size's name and the load bar, closer together when small.
  const step = Math.min(24, Math.max(14, (panel.h - HEADER - FOOTER) / rows.length));
  const rowY = (index: number) => panel.y + HEADER + 2 + index * step;
  const barX = panel.x + 60;
  const barW = Math.max(20, panel.w - 72);
  // One chip a core while they fit; past that, each chip stands for a few.
  const chips = Math.max(
    1,
    Math.min(maxCores, Math.floor((barW + CHIP.gap) / (CHIP.size + CHIP.gap))),
  );
  // Disks slide in one by one, as many as fit.
  const fitDisks = Math.max(1, Math.floor((barW + 4) / 13));
  const litChips = maxCores === 0 ? 0 : Math.round((cores / maxCores) * chips);
  // The name follows the machine as it grows, like a scale set's follows its frame.
  const labelY = panel.y + panel.h + 18;

  return (
    <ExportLink link={component.link} mode={settings.mode}>
      <g
        data-element={component.name}
        data-kind="component"
        data-scaling="up"
        data-size={frame?.size?.name}
        data-state={component.state.to}
        {...actionProps(settings, component.label)}
        opacity={focusOpacity(settings, component.name)}
        style={{ transition: "opacity 400ms ease" }}
      >
        {component.tooltip !== null ? <title>{component.tooltip}</title> : null}
        {/* The largest size there is: how far it can grow. */}
        <rect
          data-part="ceiling"
          x={room.x}
          y={room.y}
          width={room.w}
          height={room.h}
          rx={RADIUS + 4}
          fill="none"
          stroke={ceilingColor}
          strokeDasharray="3 5"
          opacity={frame?.ceiling === true ? 0.9 : 0.8}
        />
        {frame?.ceiling === true ? (
          <text
            x={room.x + room.w - 8}
            y={room.y - 6}
            textAnchor="end"
            fontSize={10}
            fill={ceilingColor}
            style={{ fontFamily }}
          >
            Largest size
          </text>
        ) : null}
        <g data-part="spokes" pointerEvents="none">
          {ends.map(({ end, out }, index) => {
            const side = sidePoint(panel, end.at);
            const d = out ? spokePath(side, end.at) : spokePath(end.at, side);
            return (
              <g key={`${end.connection}-${index}`}>
                <path d={d} fill="none" stroke={theme.line} strokeWidth={1} opacity={0.5} />
                <path
                  ref={(node) => void (dots.current[index] = node)}
                  d={d}
                  fill="none"
                  stroke={component.color ?? tone("green", theme.mode).solid}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeDasharray={`0 ${DOT_SPACING}`}
                />
              </g>
            );
          })}
        </g>
        <rect
          data-part="panel"
          x={panel.x}
          y={panel.y}
          width={panel.w}
          height={panel.h}
          rx={RADIUS}
          fill={theme.tile}
          stroke={load > 1 ? tone("orange", theme.mode).solid : theme.tileBorder}
          strokeWidth={load > 1 ? 1.75 : 1}
        />
        <rect
          x={panel.x + 1}
          y={panel.y + 1}
          width={panel.w - 2}
          height={Math.min(40, panel.h / 2)}
          rx={RADIUS - 1}
          fill={`url(#${settings.ids.sheen})`}
        />
        <g>
          {href != null ? (
            <image href={href} x={panel.x + 12} y={panel.y + 11} width={ICON} height={ICON} />
          ) : null}
          <text
            x={panel.x + 46}
            y={panel.y + 29}
            fontSize={12}
            fontWeight={600}
            fill={theme.text}
            style={{ fontFamily }}
          >
            {frame?.size?.name ?? ""}
          </text>
          {rows.map((row, index) => {
            const y = rowY(index);
            return (
              <g key={row.key} data-row={row.key}>
                <text x={panel.x + 12} y={y + 7} fontSize={9.5} fill={muted} style={{ fontFamily }}>
                  {row.label}
                </text>
                {row.key === "cpu"
                  ? Array.from({ length: chips }, (_, i) => (
                      <rect
                        key={i}
                        x={barX + i * (CHIP.size + CHIP.gap)}
                        y={y}
                        width={CHIP.size}
                        height={CHIP.size}
                        rx={1.5}
                        fill={i < litChips ? lit : theme.tileBorder}
                        opacity={i < litChips ? 1 : 0.5}
                      />
                    ))
                  : null}

                {row.key === "memory" || row.key === "capacity" ? (
                  <>
                    <rect
                      x={barX}
                      y={y + 1}
                      width={barW}
                      height={5}
                      rx={2.5}
                      fill={theme.tileBorder}
                    />
                    <rect
                      x={barX}
                      y={y + 1}
                      width={
                        barW *
                        (row.key === "memory"
                          ? (frame?.memoryShare ?? 0)
                          : (frame?.capacityShare ?? 0))
                      }
                      height={5}
                      rx={2.5}
                      fill={lit}
                    />
                  </>
                ) : null}
                {row.key === "disks"
                  ? Array.from(
                      { length: Math.min(Math.ceil(frame?.disks ?? 0), fitDisks) },
                      (_, i) => {
                        const share = Math.min(1, (frame?.disks ?? 0) - i);
                        return (
                          <g
                            key={i}
                            transform={`translate(${barX + i * 13} ${y - 2 + (1 - share) * 8})`}
                            opacity={share}
                          >
                            <ellipse cx={4.5} cy={2} rx={4.5} ry={2} fill={lit} />
                            <rect x={0} y={2} width={9} height={7} fill={lit} opacity={0.75} />
                            <ellipse cx={4.5} cy={9} rx={4.5} ry={2} fill={lit} opacity={0.75} />
                          </g>
                        );
                      },
                    )
                  : null}
              </g>
            );
          })}
          <rect
            x={panel.x + 12}
            y={panel.y + panel.h - 14}
            width={panel.w - 24}
            height={4}
            rx={2}
            fill={theme.tileBorder}
          />
          <rect
            data-part="load"
            x={panel.x + 12}
            y={panel.y + panel.h - 14}
            width={(panel.w - 24) * Math.min(1, load)}
            height={4}
            rx={2}
            fill={loadColor(load, theme)}
          />
        </g>
        <text
          x={room.x + room.w / 2}
          y={labelY}
          textAnchor="middle"
          fontSize={12}
          fontWeight={600}
          fill={theme.text}
          style={{ fontFamily }}
        >
          {component.label}
        </text>
        <text
          x={room.x + room.w / 2}
          y={labelY + 14}
          textAnchor="middle"
          fontSize={11}
          fill={muted}
          style={{ fontFamily }}
        >
          {frame === null ? "" : `${frame.size?.name ?? ""} · ${percent(load)}`}
        </text>
      </g>
    </ExportLink>
  );
});
