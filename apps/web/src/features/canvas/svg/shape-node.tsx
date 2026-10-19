"use client";

import { memo, useRef } from "react";
import { currentTime, useFrame, useTimeSource } from "../clock";
import { componentAnimates, componentFrame, progressAt, type ComponentFrame } from "../frames";
import { measure } from "../text";
import type { SceneComponent, SceneShape } from "../scene";
import { Badge, CardMark, ExportLink, LinkMark, MarkBadge, NestedMark } from "./glyphs";
import { PaintGradient, paintFill } from "./paint-gradient";
import { actionProps, focusOpacity, useRender } from "./render-context";
import { ImageNode } from "./image-node";
import { CodeNode } from "./code-node";

/** How far the state ring sits outside the outline, in px. */
const RING = 4;
/** How far each copy in the "scaling" stack sits up and to the right. */
const STACK_STEP = 6;

interface ShapeRefs {
  motion: SVGGElement | null;
  glow: SVGCircleElement | null;
  ring: SVGPathElement | null;
  ghosts: SVGGElement | null;
  ghostNear: SVGPathElement | null;
  ghostFar: SVGPathElement | null;
  content: SVGGElement | null;
  badgeFrom: SVGGElement | null;
  badgeTo: SVGGElement | null;
}

function motionTransform(component: SceneComponent, frame: ComponentFrame): string {
  const { motion } = frame;
  if (motion.dx === 0 && motion.dy === 0 && motion.scale === 1 && motion.rotate === 0) return "";
  const { box } = component;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return `translate(${cx + motion.dx} ${cy + motion.dy}) rotate(${motion.rotate}) scale(${motion.scale}) translate(${-cx} ${-cy})`;
}

const stackOffset = (ghost: number, copies: number): string =>
  `translate(${STACK_STEP * ghost * copies} ${-STACK_STEP * ghost * copies})`;

function apply(refs: ShapeRefs, component: SceneComponent, frame: ComponentFrame): void {
  refs.motion?.setAttribute("transform", motionTransform(component, frame));
  refs.glow?.setAttribute("opacity", String(frame.glowOpacity * 0.55));
  refs.glow?.setAttribute("fill", frame.glowColor);
  refs.ring?.setAttribute("opacity", String(frame.ringOpacity));
  refs.ring?.setAttribute("stroke", frame.ringColor);
  refs.ghosts?.setAttribute("opacity", String(frame.ghostOpacity));
  refs.ghosts?.setAttribute("stroke", frame.ghostColor);
  refs.ghostNear?.setAttribute("transform", stackOffset(frame.ghostOpacity, 1));
  refs.ghostFar?.setAttribute("transform", stackOffset(frame.ghostOpacity, 2));
  refs.content?.setAttribute("opacity", String(frame.contentOpacity));
  refs.badgeFrom?.setAttribute("opacity", String(frame.badgeFrom.opacity));
  refs.badgeTo?.setAttribute("opacity", String(frame.badgeTo.opacity));
}

/**
 * A shape (M4): a component drawn as a geometric outline, with the same state look (ring, glow,
 * scaling stack, badge), motion, card and nesting marks as an icon tile, and its label wrapped
 * inside the outline (or under a person).
 */
export const ShapeNode = memo(function ShapeNode({ component }: { component: SceneComponent }) {
  const settings = useRender();
  const { theme, transitionStart, transitionSeconds } = settings;
  const source = useTimeSource();
  const now = currentTime(source);
  const transitioning = transitionStart !== null && now - transitionStart < transitionSeconds + 0.1;
  const frame = componentFrame(
    component,
    theme,
    now,
    progressAt(now, transitionStart, transitionSeconds),
  );
  const refs = useRef<ShapeRefs>({
    motion: null,
    glow: null,
    ring: null,
    ghosts: null,
    ghostNear: null,
    ghostFar: null,
    content: null,
    badgeFrom: null,
    badgeTo: null,
  }).current;

  useFrame(componentAnimates(component, transitioning), (t) => {
    apply(
      refs,
      component,
      componentFrame(component, theme, t, progressAt(t, transitionStart, transitionSeconds)),
    );
  });

  const shape = component.shape;
  if (shape === null) return null;
  const { box } = component;
  const gradientId = `${settings.ids.background}-shape-${component.name}`;
  const local = { x: 0, y: 0, w: box.w, h: box.h };
  const editing = settings.editingText === component.name;

  return (
    <ExportLink link={component.link} mode={settings.mode}>
      <g
        data-element={component.name}
        data-kind="component"
        data-shape={shape.id}
        data-state={component.state.to}
        {...actionProps(settings, component.label)}
        opacity={focusOpacity(settings, component.name)}
        style={{ transition: "opacity 400ms ease" }}
      >
        {component.tooltip !== null ? <title>{component.tooltip}</title> : null}
        <defs>
          <PaintGradient paint={shape.fill} box={local} id={gradientId} />
        </defs>
        <g
          ref={(node) => void (refs.motion = node)}
          transform={motionTransform(component, frame) || undefined}
        >
          <circle
            ref={(node) => void (refs.glow = node)}
            cx={box.x + box.w / 2}
            cy={box.y + box.h / 2}
            r={Math.max(box.w, box.h) * 0.62}
            fill={frame.glowColor}
            opacity={frame.glowOpacity * 0.55}
            filter={`url(#${settings.ids.glow})`}
          />
          <g transform={`translate(${box.x} ${box.y})`}>
            <g
              ref={(node) => void (refs.ghosts = node)}
              opacity={frame.ghostOpacity}
              stroke={frame.ghostColor}
              fill={shape.base}
              strokeWidth={1.2}
            >
              <path
                ref={(node) => void (refs.ghostFar = node)}
                d={shape.outline}
                transform={stackOffset(frame.ghostOpacity, 2)}
                strokeOpacity={0.45}
              />
              <path
                ref={(node) => void (refs.ghostNear = node)}
                d={shape.outline}
                transform={stackOffset(frame.ghostOpacity, 1)}
                strokeOpacity={0.7}
              />
            </g>
            {shape.shadow ? (
              // A soft lift: two offset copies, cheaper than a blur filter.
              <>
                <path d={shape.outline} transform="translate(1 4)" fill="black" fillOpacity={0.1} />
                <path
                  d={shape.outline}
                  transform="translate(0 1.5)"
                  fill="black"
                  fillOpacity={0.14}
                />
              </>
            ) : null}
            {/* The state ring: a wide stroke under the fill shows as a band outside the outline. */}
            <path
              ref={(node) => void (refs.ring = node)}
              d={shape.outline}
              fill="none"
              stroke={frame.ringColor}
              strokeWidth={shape.strokeWidth + RING * 2}
              strokeLinejoin="round"
              opacity={frame.ringOpacity}
            />
            <g opacity={shape.opacity}>
              <path d={shape.outline} fill={shape.base} />
              <g ref={(node) => void (refs.content = node)} opacity={frame.contentOpacity}>
                <path data-part="fill" d={shape.outline} fill={paintFill(shape.fill, gradientId)} />
                {component.image !== null ? (
                  <ImageNode
                    image={component.image}
                    name={component.name}
                    parts={component.parts}
                    width={box.w}
                    height={box.h}
                  />
                ) : null}
                {component.code !== null ? (
                  <CodeNode
                    code={component.code}
                    name={component.name}
                    parts={component.parts}
                    width={box.w}
                    height={box.h}
                  />
                ) : null}
              </g>
              {shape.stroke !== null ? (
                <path
                  data-part="outline"
                  d={shape.outline}
                  fill="none"
                  stroke={shape.stroke}
                  strokeWidth={shape.strokeWidth}
                  strokeDasharray={shape.dash === null ? undefined : shape.dash.join(" ")}
                  strokeLinejoin="round"
                />
              ) : null}
              {shape.details !== null ? (
                <path
                  d={shape.details}
                  fill="none"
                  stroke={shape.stroke ?? theme.tileBorder}
                  strokeWidth={shape.strokeWidth}
                />
              ) : null}
            </g>
            {editing ? null : <ShapeLabel shape={shape} box={box} baseColor={theme.base} />}
            <g ref={(node) => void (refs.badgeFrom = node)} opacity={frame.badgeFrom.opacity}>
              <Badge
                badge={frame.badgeFrom.badge}
                color={frame.badgeFrom.color}
                background={theme.base}
                opacity={1}
                x={box.w - 2}
                y={2}
              />
            </g>
            <g ref={(node) => void (refs.badgeTo = node)} opacity={frame.badgeTo.opacity}>
              <Badge
                badge={frame.badgeTo.badge}
                color={frame.badgeTo.color}
                background={theme.base}
                opacity={1}
                x={box.w - 2}
                y={2}
              />
            </g>
            {component.mark !== null ? (
              <MarkBadge
                mark={component.mark}
                mode={theme.mode}
                muted={theme.textMuted}
                background={theme.base}
                x={2}
                y={2}
              />
            ) : null}
            {component.hasCard ? <CardMark x={9} y={box.h - 9} color={theme.textMuted} /> : null}
            {component.opens ? (
              <NestedMark x={box.w - 10} y={box.h - 9} color={theme.textMuted} />
            ) : null}
            {component.link !== null && component.mark === null ? (
              <LinkMark x={10} y={10} color={theme.textMuted} />
            ) : null}
          </g>
        </g>
      </g>
    </ExportLink>
  );
}, sameShape);

/** The label, wrapped in the shape's label box and centred on it (or under a person). */
function ShapeLabel({
  shape,
  box,
  baseColor,
}: {
  shape: SceneShape;
  box: { w: number; h: number };
  baseColor: string;
}) {
  const { text, label } = shape;
  if (text.lines.length === 0) return null;
  const lineHeight = text.size * 1.3;
  const total = text.lines.length * lineHeight;
  const anchor = text.align === "left" ? "start" : text.align === "right" ? "end" : "middle";
  const x =
    text.align === "left"
      ? label.x
      : text.align === "right"
        ? label.x + label.w
        : label.x + label.w / 2;
  const top = shape.labelBelow ? box.h + 4 : label.y + (label.h - total) / 2;
  const weight = text.bold ? 650 : 500;
  const width = shape.labelBelow
    ? Math.max(...text.lines.map((line) => measure(line, text.size, weight, text.family)))
    : 0;
  return (
    <>
      {shape.labelBelow ? (
        <rect
          x={box.w / 2 - width / 2 - 5}
          y={top - 1}
          width={width + 10}
          height={total + 4}
          rx={5}
          fill={baseColor}
          opacity={0.82}
        />
      ) : null}
      <text
        data-part="label"
        textAnchor={shape.labelBelow ? "middle" : anchor}
        fontSize={text.size}
        fontWeight={weight}
        fontStyle={text.italic ? "italic" : undefined}
        fill={text.color}
        style={{ fontFamily: text.family }}
      >
        {text.lines.map((line, index) => (
          <tspan
            key={index}
            x={shape.labelBelow ? box.w / 2 : x}
            y={top + text.size * 0.95 + index * lineHeight}
          >
            {line}
          </tspan>
        ))}
      </text>
    </>
  );
}

function sameShape(a: { component: SceneComponent }, b: { component: SceneComponent }): boolean {
  const x = a.component;
  const y = b.component;
  if (x === y) return true;
  const s = x.shape;
  const t = y.shape;
  return (
    s !== null &&
    t !== null &&
    x.name === y.name &&
    x.label === y.label &&
    x.box.x === y.box.x &&
    x.box.y === y.box.y &&
    x.box.w === y.box.w &&
    x.box.h === y.box.h &&
    x.state.from === y.state.from &&
    x.state.to === y.state.to &&
    x.motion === y.motion &&
    x.intensity === y.intensity &&
    x.speed === y.speed &&
    x.color === y.color &&
    x.hasCard === y.hasCard &&
    x.opens === y.opens &&
    x.link === y.link &&
    x.tooltip === y.tooltip &&
    x.mark === y.mark &&
    x.image?.content === y.image?.content &&
    x.image?.fit === y.image?.fit &&
    // A listing's lines are the same array until its text or slice changes.
    x.code?.lines === y.code?.lines &&
    x.code?.fontSize === y.code?.fontSize &&
    x.code?.title === y.code?.title &&
    x.code?.numbers === y.code?.numbers &&
    x.code?.missing === y.code?.missing &&
    JSON.stringify(x.parts) === JSON.stringify(y.parts) &&
    s.outline === t.outline &&
    s.details === t.details &&
    JSON.stringify(s.fill) === JSON.stringify(t.fill) &&
    s.base === t.base &&
    s.stroke === t.stroke &&
    s.strokeWidth === t.strokeWidth &&
    s.dash?.join() === t.dash?.join() &&
    s.shadow === t.shadow &&
    s.opacity === t.opacity &&
    s.text.lines.join("\n") === t.text.lines.join("\n") &&
    s.text.size === t.text.size &&
    s.text.bold === t.text.bold &&
    s.text.italic === t.text.italic &&
    s.text.color === t.text.color &&
    s.text.align === t.text.align &&
    s.text.family === t.text.family
  );
}
