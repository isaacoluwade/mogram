import type { Paint } from "@mogram/core/presets";
import { linearLine, radialEllipse, type Box } from "../paint";

/**
 * The SVG gradient for a paint over `box`, in user space so it matches what CSS draws for the
 * same box. Renders nothing for a solid paint: use `paintFill` for the fill attribute.
 */
export function PaintGradient({ paint, box, id }: { paint: Paint; box: Box; id: string }) {
  if (paint.kind === "solid") return null;
  const stops = paint.stops.map((stop, index) => (
    <stop key={index} offset={stop.offset} stopColor={stop.color} />
  ));
  if (paint.kind === "linear") {
    return (
      <linearGradient id={id} gradientUnits="userSpaceOnUse" {...linearLine(paint.angle, box)}>
        {stops}
      </linearGradient>
    );
  }
  const { cx, cy, rx, ry } = radialEllipse(paint.center, paint.radius, box);
  // A unit circle stretched to the ellipse: SVG radial gradients are otherwise circles.
  return (
    <radialGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      cx={0}
      cy={0}
      r={1}
      gradientTransform={`translate(${cx} ${cy}) scale(${Math.max(rx, 0.001)} ${Math.max(ry, 0.001)})`}
    >
      {stops}
    </radialGradient>
  );
}

/** The `fill` value for a paint: its colour, or a reference to its `PaintGradient`. */
export function paintFill(paint: Paint, id: string): string {
  return paint.kind === "solid" ? paint.color : `url(#${id})`;
}
