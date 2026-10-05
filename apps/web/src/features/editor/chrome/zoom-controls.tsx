"use client";

import { Map as MapIcon, Maximize, Minus, Plus } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Panel } from "@/components/ui/panel";
import { MotionButton } from "@/features/canvas/motion-button";
import { zoomBy, zoomTo, zoomToFit } from "../actions";
import { useEditor, useEditorStore } from "../editor-context";
import { shortcutLabel } from "../commands/keys";

export function ZoomControls() {
  const store = useEditorStore();
  const zoom = useEditor((s) => s.camera.zoom);
  const motionPaused = useEditor((s) => s.motionPaused);
  const showMinimap = useEditor((s) => s.showMinimap);
  return (
    <Panel shape="pill" className="flex items-center gap-0.5 p-1" role="group" aria-label="Zoom">
      <IconButton
        label="Zoom out"
        shortcut={shortcutLabel("mod+-")}
        size="sm"
        shape="round"
        onClick={() => zoomBy(store, 1 / 1.2)}
      >
        <Minus />
      </IconButton>
      <button
        type="button"
        onClick={() => zoomTo(store, 1)}
        className="h-7 min-w-12 rounded-full px-1.5 text-caption font-medium tabular-nums text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg"
        aria-label="Reset zoom to 100%"
      >
        {Math.round(zoom * 100)}%
      </button>
      <IconButton
        label="Zoom in"
        shortcut={shortcutLabel("mod+=")}
        size="sm"
        shape="round"
        onClick={() => zoomBy(store, 1.2)}
      >
        <Plus />
      </IconButton>
      <IconButton
        label={showMinimap ? "Hide minimap" : "Show minimap"}
        size="sm"
        shape="round"
        active={showMinimap}
        onClick={() => store.getState().toggleMinimap()}
      >
        <MapIcon />
      </IconButton>
      <IconButton
        label="Zoom to fit"
        shortcut="⇧1"
        size="sm"
        shape="round"
        onClick={() => zoomToFit(store)}
      >
        <Maximize />
      </IconButton>
      <MotionButton
        paused={motionPaused}
        onToggle={() => store.getState().setMotionPaused(!motionPaused)}
      />
    </Panel>
  );
}
