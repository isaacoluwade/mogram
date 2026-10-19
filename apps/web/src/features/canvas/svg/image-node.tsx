"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { pictureSource, preparePicture, subscribePictures } from "@/features/assets/pictures";
import type { SceneImage, ScenePart } from "../scene";
import { PartLooks } from "./part-looks";
import { FOCUS_DIM, useRender } from "./render-context";

/**
 * A picture (D-102), contained in or covering its element. Its regions (parts, D-104) can be
 * outlined and marked; while one is in focus the rest of the picture dims and the region stays
 * bright.
 */
export function ImageNode({
  image,
  name,
  parts,
  width,
  height,
}: {
  image: SceneImage;
  name: string;
  parts: readonly ScenePart[];
  width: number;
  height: number;
}) {
  const { theme, focus } = useRender();
  const clip = `mogram-region-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const source = useSyncExternalStore(
    subscribePictures,
    () => pictureSource(image.content),
    () => pictureSource(image.content),
  );
  useEffect(() => {
    if (source === null && image.content !== "") void preparePicture(image.content);
  }, [source, image.content]);

  if (source === null)
    return (
      <g data-part="image-missing">
        <rect width={width} height={height} fill={theme.tile} />
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={14}
          fill={theme.textMuted}
        >
          {image.content === "" ? "This picture isn't in the project." : "Loading the picture…"}
        </text>
      </g>
    );

  const focused = parts.filter((part) => focus?.has(part.target) === true && part.show.to > 0);
  const dimmed = focus !== null && focused.length > 0 && !focus.has(name);
  const picture = (
    <image
      href={source}
      width={width}
      height={height}
      preserveAspectRatio={image.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}
    />
  );
  return (
    <g data-part="image">
      <g opacity={dimmed ? FOCUS_DIM : 1}>{picture}</g>
      {dimmed ? (
        <>
          <clipPath id={clip}>
            {focused.map((part) => (
              <rect
                key={part.target}
                x={part.box.x}
                y={part.box.y}
                width={part.box.w}
                height={part.box.h}
              />
            ))}
          </clipPath>
          <g clipPath={`url(#${clip})`}>{picture}</g>
        </>
      ) : null}
      {parts.map((part) => (
        <PartLooks key={part.target} part={part} markAt={{ x: part.box.x, y: part.box.y }} />
      ))}
    </g>
  );
}
