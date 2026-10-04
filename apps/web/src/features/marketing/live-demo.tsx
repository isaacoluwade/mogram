"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectFiles } from "@mogram/core/model";
import { parseDiagram } from "@mogram/core/format";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/cn";
import { DiagramPreview } from "@/features/canvas/diagram-preview";

const CYCLE_MS = 4000;
/** Keeps the diagram clear of the scene control along the bottom edge. */
const CONTROL_INSETS = { top: 0, right: 0, bottom: 40, left: 0 } as const;

/**
 * A live diagram with its scenes as a segmented control. It plays through the scenes on its own
 * until someone picks one (SC-6, SC-7 on the landing page).
 */
export function LiveDemo({
  files,
  className,
  padding = 40,
  minZoom,
  label = "Scene",
}: {
  files: ProjectFiles;
  className?: string;
  padding?: number;
  minZoom?: number;
  label?: string;
}) {
  const scenes = useMemo(() => parseDiagram(files).diagram.scenes, [files]);
  const options = useMemo(
    () => [
      { value: "normal", label: "Normal" },
      ...scenes.map((s) => ({ value: s.name, label: s.label })),
    ],
    [scenes],
  );
  const [scene, setScene] = useState("normal");
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || options.length < 2) return;
    const timer = window.setInterval(() => {
      setScene((current) => {
        const index = options.findIndex((o) => o.value === current);
        return options[(index + 1) % options.length]?.value ?? "normal";
      });
    }, CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [auto, options]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <DiagramPreview
        files={files}
        scene={scene === "normal" ? null : scene}
        className="absolute inset-0"
        padding={padding}
        {...(minZoom !== undefined ? { minZoom } : {})}
        {...(options.length > 1 ? { insets: CONTROL_INSETS } : {})}
      />
      {options.length > 1 ? (
        <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
          <SegmentedControl
            label={label}
            size="sm"
            value={scene}
            onChange={(value) => {
              setAuto(false);
              setScene(value);
            }}
            options={options}
            className="max-w-full overflow-x-auto border border-border bg-sidebar/90 shadow-panel backdrop-blur"
          />
        </div>
      ) : null}
    </div>
  );
}
