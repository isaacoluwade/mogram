"use client";

import { useId } from "react";
import type { Control } from "@mogram/core/model";
import { controlValue } from "@mogram/core/picture";
import { Panel } from "@/components/ui/panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useViewer, useViewerController } from "./viewer-context";

/** A dial's number as it reads: whole when the dial moves in whole steps. */
function written(control: Extract<Control, { kind: "dial" }>, value: number): string {
  const places = control.step >= 1 ? 0 : control.step >= 0.1 ? 1 : 2;
  return `${value.toFixed(places)}${control.unit}`;
}

/**
 * What the viewer can set (D-88): a dial is a number the diagram's formulas read (so turning it
 * up can make a scale set grow, or a lease run out); a toggle turns a scene on; a pick chooses
 * one of several.
 */
export function ControlsBar() {
  const controller = useViewerController();
  const given = useViewer((s) => s.controls);
  const controls = controller.levels.top.diagram.controls;
  const scenes = controller.levels.top.diagram.scenes;
  const id = useId();
  if (controls.length === 0) return null;
  return (
    <Panel
      role="group"
      aria-label="Controls"
      data-testid="controls-bar"
      className="flex max-w-full flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5"
    >
      {controls.map((control) => {
        const value = controlValue(control, given);
        const field = `${id}-${control.name}`;
        if (control.kind === "dial" && typeof value === "number")
          return (
            <div key={control.name} className="flex items-center gap-2.5">
              <label htmlFor={field} className="text-caption font-medium text-fg-soft">
                {control.label}
              </label>
              <input
                id={field}
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={value}
                onChange={(event) =>
                  controller.setControl(control.name, Number(event.target.value))
                }
                aria-valuetext={written(control, value)}
                className="h-1.5 w-36 cursor-pointer accent-fg-soft"
              />
              <output
                htmlFor={field}
                className="w-12 text-caption font-medium tabular-nums text-fg"
                data-testid={`control-${control.name}`}
              >
                {written(control, value)}
              </output>
            </div>
          );
        if (control.kind === "toggle")
          return (
            <label key={control.name} className="flex items-center gap-2.5">
              <span className="text-caption font-medium text-fg-soft">{control.label}</span>
              <Switch
                checked={value === 1}
                onCheckedChange={(on) => controller.setControl(control.name, on)}
                aria-label={control.label}
              />
            </label>
          );
        if (control.kind === "pick" && typeof value === "string")
          return (
            <div key={control.name} className="flex items-center gap-2.5">
              <span className="text-caption font-medium text-fg-soft">{control.label}</span>
              <SegmentedControl
                label={control.label}
                size="sm"
                value={value}
                onChange={(next) => controller.setControl(control.name, next)}
                options={control.scenes.map((scene) => ({
                  value: scene,
                  label:
                    scene === "normal"
                      ? "Normal"
                      : (scenes.find((s) => s.name === scene)?.label ?? scene),
                }))}
              />
            </div>
          );
        return null;
      })}
    </Panel>
  );
}
