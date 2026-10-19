"use client";

import type { Tone } from "@mogram/core/model";
import type { Mark } from "@mogram/core/presets";
import type { Box } from "@mogram/core/layout";
import type { Pair, ScenePart } from "../scene";
import { tone as toneColors } from "../theme";
import { MarkBadge } from "./glyphs";
import { PresenceGroup } from "./presence";
import { useRender } from "./render-context";

/**
 * What a part's look draws (D-104): its tone as a wash (lines) or an outline (a region), and
 * its mark at its start or corner. Each eases from how it was to how it is, like any other look:
 * one that's the same throughout fades with the part; one that changes crossfades.
 */
export function PartLooks({
  part,
  markAt,
}: {
  part: ScenePart;
  /** Where its mark sits, in the element's coordinates. */
  markAt: { readonly x: number; readonly y: number };
}) {
  return (
    <g data-named-part={part.target}>
      <Changing pair={part.tone} show={part.show}>
        {(tone) => (tone === null ? null : <ToneLook part={part} tone={tone} />)}
      </Changing>
      <Changing pair={part.mark} show={part.show}>
        {(mark) => (mark === null ? null : <MarkLook mark={mark} at={markAt} />)}
      </Changing>
    </g>
  );
}

/** Draws a look that may change: once when it doesn't, the old and the new when it does. */
function Changing<T>({
  pair,
  show,
  children,
}: {
  pair: Pair<T>;
  show: Pair<number>;
  children: (value: T) => React.ReactNode;
}) {
  if (pair.from === pair.to) return <PresenceGroup pair={show}>{children(pair.to)}</PresenceGroup>;
  return (
    <>
      <PresenceGroup pair={{ from: show.from, to: show.from }} role="old">
        {children(pair.from)}
      </PresenceGroup>
      <PresenceGroup pair={{ from: show.to, to: show.to }} role="new">
        {children(pair.to)}
      </PresenceGroup>
    </>
  );
}

function ToneLook({ part, tone }: { part: ScenePart; tone: Tone }) {
  const { theme } = useRender();
  const color = toneColors(tone, theme.mode).solid;
  const box: Box = part.box;
  if (part.kind === "lines")
    return (
      <g data-part-tone={tone}>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={color} fillOpacity={0.14} />
        <rect x={box.x} y={box.y} width={3} height={box.h} fill={color} />
      </g>
    );
  return (
    <rect
      data-part-tone={tone}
      x={box.x}
      y={box.y}
      width={box.w}
      height={box.h}
      rx={4}
      fill="none"
      stroke={color}
      strokeWidth={2.5}
    />
  );
}

function MarkLook({ mark, at }: { mark: Mark; at: { readonly x: number; readonly y: number } }) {
  const { theme } = useRender();
  return (
    <MarkBadge
      mark={mark}
      mode={theme.mode}
      muted={theme.textMuted}
      background={theme.base}
      x={at.x}
      y={at.y}
    />
  );
}
