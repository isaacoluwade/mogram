"use client";

import { memo, useRef } from "react";
import { CONTAINER_STYLE_INFO } from "@mogram/core/presets";
import { SCENE_TRANSITION } from "@mogram/core/timeline";
import { currentTime, useFrame, useTimeSource } from "../clock";
import { containerFrame, progressAt } from "../frames";
import { iconHref, iconSource, useIconCacheVersion } from "../icons";
import type { SceneContainer } from "../scene";
import { ellipsize } from "../text";
import { containerColors } from "../theme";
import { Badge, CardMark } from "./glyphs";
import { actionProps, focusOpacity, useRender } from "./render-context";

const RADIUS = 14;

/** A container: region, VNet, subnet… with its preset look and state (ED-12, ED-14, PR-4). */
export const ContainerNode = memo(function ContainerNode({
  container,
}: {
  container: SceneContainer;
}) {
  const settings = useRender();
  const { theme, fontFamily, transitionStart } = settings;
  const source = useTimeSource();
  useIconCacheVersion();
  const now = currentTime(source);
  const colors = containerColors(container.type, theme, container.color);
  const frame = containerFrame(container, colors, theme, progressAt(now, transitionStart));
  const rect = useRef<SVGRectElement | null>(null);
  const transitioning = transitionStart !== null && now - transitionStart < SCENE_TRANSITION + 0.1;

  useFrame(transitioning, (t) => {
    const next = containerFrame(container, colors, theme, progressAt(t, transitionStart));
    rect.current?.setAttribute("stroke", next.borderColor);
    rect.current?.setAttribute("fill", next.fillColor);
  });

  const { box } = container;
  const headerIcon =
    container.icon ?? iconSource(CONTAINER_STYLE_INFO[container.type].icon, {}, "");
  const href = iconHref(headerIcon, { text: colors.icon, mode: theme.mode });
  const labelX = box.x + 34;
  const maxLabel = Math.max(40, box.w - 70);

  return (
    <g
      data-element={container.name}
      data-kind="container"
      {...actionProps(settings, container.label, container.hasCard)}
      opacity={focusOpacity(settings, container.name)}
      style={{ transition: "opacity 400ms ease" }}
    >
      <rect
        ref={rect}
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={RADIUS}
        fill={frame.fillColor}
        stroke={frame.borderColor}
        strokeWidth={1.25}
        strokeDasharray={colors.dash}
      />
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
