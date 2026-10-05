import type { ReactNode } from "react";
import type { ElementLink } from "@mogram/core/model";
import type { RenderMode } from "./render-context";
import type { StateBadge } from "@mogram/core/presets";

/** State badge glyphs, drawn in a 16×16 box centred on (0, 0). */
export function BadgeGlyph({ badge, color }: { badge: StateBadge; color: string }) {
  switch (badge) {
    case "none":
      return null;
    case "dot":
      return <circle r={3} fill={color} />;
    case "plus":
      return <path d="M-3.5 0h7M0 -3.5v7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />;
    case "warn":
      return (
        <path d="M0 -4v4.2M0 3.4v0.1" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      );
    case "bolt":
      return <path d="M1 -4.5 -2.6 0.6h2.6l-1 3.9 3.6-5.1h-2.6z" fill={color} />;
    case "cross":
      return (
        <path d="M-3 -3l6 6M3 -3l-6 6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      );
  }
}

/** A small round badge (tile corner), background matches the canvas so it reads as cut out. */
export function Badge({
  badge,
  color,
  background,
  opacity,
  x,
  y,
}: {
  badge: StateBadge;
  color: string;
  background: string;
  opacity: number;
  x: number;
  y: number;
}) {
  if (badge === "none") return null;
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <circle r={9} fill={background} />
      <circle
        r={8}
        fill={color}
        fillOpacity={0.16}
        stroke={color}
        strokeOpacity={0.7}
        strokeWidth={1}
      />
      <BadgeGlyph badge={badge} color={color} />
    </g>
  );
}

/** Quiet "has a card" indicator (CA-5): a tiny page with lines. */
export function CardMark({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      <rect
        x={-5}
        y={-6}
        width={10}
        height={12}
        rx={2}
        fill="none"
        stroke={color}
        strokeWidth={1.1}
      />
      <path
        d="M-2.5 -2.5h5M-2.5 0h5M-2.5 2.5h3"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
      />
    </g>
  );
}

/** "Opens a nested diagram" indicator (NE-1): stacked layers. */
export function NestedMark({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden>
      <path
        d="M0 -5 5.5 -2.2 0 0.6 -5.5 -2.2z"
        fill="none"
        stroke={color}
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      <path
        d="M-5.5 0.6 0 3.4 5.5 0.6"
        fill="none"
        stroke={color}
        strokeWidth={1.1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </g>
  );
}

/** A small chain link: the element goes somewhere when clicked in the viewer. */
export function LinkMark({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(-45)`} aria-hidden>
      <rect
        x={-5.5}
        y={-2}
        width={6}
        height={4}
        rx={2}
        fill="none"
        stroke={color}
        strokeWidth={1.1}
      />
      <rect
        x={-0.5}
        y={-2}
        width={6}
        height={4}
        rx={2}
        fill="none"
        stroke={color}
        strokeWidth={1.1}
      />
    </g>
  );
}

/**
 * In an exported SVG an element with a web link is a real link (07 §18 P0-3); on the canvas and
 * in the viewer clicks are handled by the app instead.
 */
export function ExportLink({
  link,
  mode,
  children,
}: {
  link: ElementLink | null;
  mode: RenderMode;
  children: ReactNode;
}) {
  if (mode !== "export" || link?.kind !== "url") return <>{children}</>;
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
