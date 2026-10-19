"use client";

import { memo, useRef } from "react";
import { CONTAINER_STYLE_INFO } from "@mogram/core/presets";
import { currentTime, useFrame, useTimeSource } from "../clock";
import { containerFrame, progressAt } from "../frames";
import { fleetFrame } from "../capacity-frames";
import { iconHref, iconSource, useIconCacheVersion } from "../icons";
import type { SceneContainer } from "../scene";
import { ellipsize } from "../text";
import { containerColors } from "../theme";
import { Badge, CardMark, MarkBadge } from "./glyphs";
import { actionProps, focusOpacity, useRender } from "./render-context";

const RADIUS = 14;

/** A container: region, VNet, subnet… with its preset look and state (ED-12, ED-14, PR-4). */
export const ContainerNode = memo(function ContainerNode({
  container,
}: {
  container: SceneContainer;
}) {
  const settings = useRender();
  const { theme, fontFamily, transitionStart, transitionSeconds } = settings;
  const source = useTimeSource();
  useIconCacheVersion();
  const now = currentTime(source);
  const colors = containerColors(container.type, theme, container.color);
  const frame = containerFrame(
    container,
    colors,
    theme,
    progressAt(now, transitionStart, transitionSeconds),
  );
  const rect = useRef<SVGRectElement | null>(null);
  const transitioning = transitionStart !== null && now - transitionStart < transitionSeconds + 0.1;
  // A scale set grows and shrinks with its copies (D-82), inside the room it keeps for its most.
  const timeline = settings.capacity?.timeline ?? null;
  const frames = timeline === null ? null : container.frames;
  const boxAt = (t: number) => {
    if (frames === null || timeline === null) return container.box;
    const fleet = fleetFrame(timeline, frames.component, frames.room, frames.max, t).frame;
    return {
      ...container.box,
      w: container.box.w - (frames.room.w - fleet.w),
      h: container.box.h - (frames.room.h - fleet.h),
    };
  };

  useFrame(transitioning || frames !== null, (t) => {
    const next = containerFrame(
      container,
      colors,
      theme,
      progressAt(t, transitionStart, transitionSeconds),
    );
    rect.current?.setAttribute("stroke", next.borderColor);
    rect.current?.setAttribute("fill", next.fillColor);
    if (frames !== null) {
      const sized = boxAt(t);
      rect.current?.setAttribute("width", String(sized.w));
      rect.current?.setAttribute("height", String(sized.h));
    }
  });

  const box = boxAt(now);
  const full = container.box;
  const headerIcon =
    container.icon ?? iconSource(CONTAINER_STYLE_INFO[container.type].icon, {}, "");
  const href = iconHref(headerIcon, { text: colors.icon, mode: theme.mode });
  const labelX = box.x + 34;
  const maxLabel = Math.max(40, box.w - 70);

  return (
    <g
      data-element={container.name}
      data-kind="container"
      {...actionProps(settings, container.label, container.hasCard || container.link !== null)}
      opacity={focusOpacity(settings, container.name)}
      style={{ transition: "opacity 400ms ease" }}
    >
      {container.tooltip !== null ? <title>{container.tooltip}</title> : null}
      {frames !== null ? (
        <rect
          data-part="room"
          x={full.x}
          y={full.y}
          width={full.w}
          height={full.h}
          rx={RADIUS}
          fill="none"
          stroke={colors.border}
          strokeDasharray="3 5"
          opacity={0.5}
        />
      ) : null}
      <rect
        ref={rect}
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={container.tray ? 10 : RADIUS}
        fill={frame.fillColor}
        stroke={frame.borderColor}
        strokeWidth={1.25}
        strokeDasharray={colors.dash}
      />
      {container.tray ? (
        // A container that arranges its contents (D-87): a small title, and room for them.
        <text
          x={box.x + 12}
          y={box.y + 16}
          fontSize={11}
          fontWeight={500}
          fill={colors.label}
          opacity={0.85}
          style={{ fontFamily }}
        >
          {ellipsize(container.label, Math.max(24, box.w - 24), 11, 500)}
        </text>
      ) : (
        <>
          {href != null ? (
            <image href={href} x={box.x + 12} y={box.y + 11} width={15} height={15} />
          ) : null}
          <text
            x={labelX}
            y={box.y + 23}
            fontSize={12.5}
            fontWeight={500}
            fill={colors.label}
            style={{ fontFamily }}
          >
            {ellipsize(container.label, maxLabel, 12.5, 500)}
          </text>
        </>
      )}
      {frame.badge.badge !== "none" ? (
        <Badge
          badge={frame.badge.badge}
          color={frame.badge.color}
          background={theme.base}
          opacity={frame.badge.opacity}
          x={box.x + box.w - 18}
          y={box.y + 18}
        />
      ) : null}
      {container.mark !== null ? (
        <MarkBadge
          mark={container.mark}
          mode={theme.mode}
          muted={theme.textMuted}
          background={theme.base}
          x={box.x + 2}
          y={box.y + 2}
        />
      ) : null}
      {container.hasCard ? (
        <CardMark
          x={box.x + box.w - (frame.badge.badge === "none" ? 18 : 40)}
          y={box.y + 18}
          color={theme.textMuted}
        />
      ) : null}
    </g>
  );
});
