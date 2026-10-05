"use client";

import type { ReactNode } from "react";
import { SquareDashed, StickyNote, Tag, Type } from "lucide-react";
import {
  CONTAINER_STYLE_INFO,
  SHAPES,
  SHAPE_INFO,
  containerIcon,
  containerName,
  shapeGeometry,
  type Cloud,
  type ContainerStyleName,
  type ShapeId,
} from "@mogram/core/presets";
import { Tooltip } from "@/components/ui/tooltip";
import { addComponentAt, insertFromLibrary } from "../actions";
import { LIBRARY_DRAG_TYPE, encodeLibraryDrag } from "../dnd";
import { useEditorStore } from "../editor-context";

/** One tile for everything the library adds, the size of an icon tile; names wrap to two lines. */
const TILE =
  "group flex h-[74px] w-full flex-col items-center justify-center gap-1.5 rounded-md border border-transparent bg-fill-faint px-1.5 text-fg-soft transition-colors hover:border-border hover:bg-fill-hover hover:text-fg";
const TILE_LABEL =
  "line-clamp-2 w-full text-center text-micro leading-tight wrap-break-word hyphens-auto";

/** Shapes whose name, kind or uses match the search (all of them for an empty query). */
export function matchingShapes(query: string): ShapeId[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return SHAPES.filter((shape) => {
    const info = SHAPE_INFO[shape];
    const text = `${shape} ${info.label} ${info.description} shape`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** A shape's outline drawn small, as its library thumbnail. */
export function ShapeThumb({ shape, className }: { shape: ShapeId; className?: string }) {
  const info = SHAPE_INFO[shape];
  // Fit the default proportions into a 40 × 28 box.
  const scale = Math.min(40 / (info.size.w * 8), 28 / (info.size.h * 8));
  const w = info.size.w * 8 * scale;
  const h = info.size.h * 8 * scale;
  const geometry = shapeGeometry(shape, w, h);
  return (
    <svg viewBox={`-2 -2 ${w + 4} ${h + 4}`} className={className} aria-hidden>
      <path
        d={geometry.outline}
        fill="currentColor"
        fillOpacity={0.12}
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {geometry.details !== null ? (
        <path d={geometry.details} fill="none" stroke="currentColor" strokeWidth={1.4} />
      ) : null}
    </svg>
  );
}

/**
 * The library's Shapes (03-shapes-styles-library §5 P0-3, P0-4): click to add one in the middle
 * of the view with its label open for typing, or drag it where it should go (onto a connection
 * to put it in between, into a container to nest it).
 */
export function ShapeGrid({ shapes }: { shapes: readonly ShapeId[] }) {
  const store = useEditorStore();
  return (
    <ul className="grid grid-cols-3 gap-1.5" role="list" aria-label="Shapes">
      {shapes.map((shape) => {
        const info = SHAPE_INFO[shape];
        return (
          <li key={shape}>
            <Tooltip
              content={`${info.label} — ${info.description} · ${info.size.w * 8} × ${info.size.h * 8}`}
              side="right"
            >
              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    LIBRARY_DRAG_TYPE,
                    encodeLibraryDrag({ type: `shape/${shape}`, label: info.label }),
                  );
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => addComponentAt(store, `shape/${shape}`, info.label, null)}
                aria-label={`Add ${info.label}`}
                className={TILE}
              >
                <ShapeThumb shape={shape} className="h-6 w-9" />
                <span className={TILE_LABEL}>{info.label}</span>
              </button>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

interface LibraryTile {
  readonly type: string;
  readonly label: string;
  readonly tip: string;
  readonly face: ReactNode;
}

/** A grid of things to add: click for the middle of the view, or drag them where they go. */
function TileGrid({ tiles, label }: { tiles: readonly LibraryTile[]; label: string }) {
  const store = useEditorStore();
  return (
    <ul className="grid grid-cols-3 gap-1.5" role="list" aria-label={label}>
      {tiles.map((tile) => (
        <li key={tile.type}>
          <Tooltip content={tile.tip} side="right">
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  LIBRARY_DRAG_TYPE,
                  encodeLibraryDrag({ type: tile.type, label: tile.label }),
                );
                event.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => insertFromLibrary(store, tile.type, tile.label, null)}
              aria-label={`Add ${tile.label}`}
              className={`${TILE} [&_svg.lucide]:size-5`}
            >
              {tile.face}
              <span className={TILE_LABEL}>{tile.label}</span>
            </button>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}

/**
 * Containers as the diagram's cloud names them (presets/clouds.ts), outermost first, each drawn
 * as a small frame with its border style. Added from here, a container also takes the cloud's
 * official group icon.
 */
export function ContainerGrid({
  kinds,
  cloud,
  glyph = () => false,
}: {
  kinds: readonly ContainerStyleName[];
  cloud: Cloud | null;
  /** Whether an icon is a one-colour glyph (drawn in the text colour) rather than artwork. */
  glyph?: (icon: string) => boolean;
}) {
  return (
    <TileGrid
      label="Containers"
      tiles={kinds.map((kind) => {
        const info = CONTAINER_STYLE_INFO[kind];
        const name = containerName(kind, cloud);
        const icon = containerIcon(kind, cloud);
        return {
          type: cloud === null ? `container/${kind}` : `container/${kind}@${cloud}`,
          label: name,
          tip: `${name} — ${info.description}`,
          face: (
            <span aria-hidden className="relative block h-6 w-9 shrink-0">
              <svg viewBox="0 0 40 28" className="size-full">
                <rect
                  x={1}
                  y={1}
                  width={38}
                  height={26}
                  rx={4}
                  fill="currentColor"
                  fillOpacity={0.08}
                  stroke="currentColor"
                  strokeWidth={1.3}
                  strokeDasharray={
                    info.border === "dashed" ? "3 2" : info.border === "dotted" ? "1 2" : undefined
                  }
                />
                {icon === null ? (
                  <rect
                    x={4}
                    y={4}
                    width={12}
                    height={3}
                    rx={1.5}
                    fill="currentColor"
                    fillOpacity={0.6}
                  />
                ) : null}
              </svg>
              {/* The cloud's own group icon in the header corner, as the canvas draws it. */}
              {icon === null ? null : glyph(icon) ? (
                <span
                  className="absolute left-[3px] top-[3px] size-3 bg-current"
                  style={{
                    maskImage: `url(/icons/${icon}.svg)`,
                    WebkitMaskImage: `url(/icons/${icon}.svg)`,
                    maskSize: "contain",
                    maskRepeat: "no-repeat",
                    maskPosition: "center",
                  }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG icons; next/image adds no value here
                <img
                  src={`/icons/${icon}.svg`}
                  alt=""
                  className="absolute left-[3px] top-[3px] size-3 rounded-[2px] object-contain"
                  draggable={false}
                />
              )}
            </span>
          ),
        };
      })}
    />
  );
}

/** Text, labels, highlight zones and sticky notes: things that explain, not architecture. */
export function AnnotationGrid() {
  return (
    <TileGrid
      label="Notes"
      tiles={[
        {
          type: "annotation/text",
          label: "Text",
          tip: "A heading or note on the canvas",
          face: <Type />,
        },
        { type: "annotation/label", label: "Label", tip: "A small pill label", face: <Tag /> },
        {
          type: "annotation/zone",
          label: "Highlight zone",
          tip: "A tinted area that draws attention",
          face: <SquareDashed />,
        },
        {
          type: "annotation/note",
          label: "Sticky note",
          tip: "A note with rich text",
          face: <StickyNote />,
        },
      ]}
    />
  );
}
