"use client";

import { ArrowDownToLine, ArrowUpToLine, ChevronsDown, ChevronsUp } from "lucide-react";
import type { ReactNode } from "react";
import type { ZOrderMove } from "@mogram/core/edit";
import { IconButton } from "@/components/ui/icon-button";
import { PropertyRow } from "@/components/ui/property-row";
import { canZOrder, zOrder } from "../actions";
import { useEditor, useEditorStore } from "../editor-context";

const MOVES: readonly { move: ZOrderMove; label: string; icon: ReactNode }[] = [
  { move: "back", label: "Send to back", icon: <ChevronsDown /> },
  { move: "backward", label: "Send backward", icon: <ArrowDownToLine /> },
  { move: "forward", label: "Bring forward", icon: <ArrowUpToLine /> },
  { move: "front", label: "Bring to front", icon: <ChevronsUp /> },
];

/**
 * Z-order for the selection (ED-23), also reachable here so touch screens don't depend on a
 * long-press menu. Moves that would change nothing are disabled.
 */
export function ArrangeRow() {
  const store = useEditorStore();
  // Re-evaluate when the files or the selection change.
  useEditor((s) => s.files);
  useEditor((s) => s.selection);
  return (
    <PropertyRow label="Order">
      <div className="flex gap-0.5">
        {MOVES.map(({ move, label, icon }) => (
          <IconButton
            key={move}
            label={label}
            size="sm"
            disabled={!canZOrder(store, move)}
            onClick={() => zOrder(store, move)}
          >
            {icon}
          </IconButton>
        ))}
      </div>
    </PropertyRow>
  );
}
