"use client";

import { CirclePause, CirclePlay } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

/**
 * Pauses and plays the diagram's motion (traffic, pulses, overload). Reduced-motion users start
 * paused (PR-9) and can still choose to watch it move.
 */
export function MotionButton({ paused, onToggle }: { paused: boolean; onToggle: () => void }) {
  return (
    <IconButton
      label={paused ? "Play motion" : "Pause motion"}
      shortcut="M"
      size="sm"
      shape="round"
      active={paused}
      onClick={onToggle}
    >
      {paused ? <CirclePlay /> : <CirclePause />}
    </IconButton>
  );
}
