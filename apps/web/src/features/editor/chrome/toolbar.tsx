"use client";

import {
  Box,
  Ellipsis,
  Grid3x3,
  Hand,
  MousePointer2,
  Redo2,
  Spline,
  SquareDashed,
  StickyNote,
  Tag,
  Type,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Panel, ToolbarDivider } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { useEditorShallow, useEditorStore } from "../editor-context";
import { shortcutLabel } from "../shortcuts";
import type { Tool } from "../store/editor-store";

interface ToolInfo {
  readonly tool: Tool;
  readonly label: string;
  readonly key: string;
  readonly icon: ReactNode;
  /** Kept in the bar on phones; the rest move into "More tools" so Undo and Redo stay in reach. */
  readonly phone: boolean;
}

const TOOLS: readonly ToolInfo[] = [
  { tool: "select", label: "Select", key: "V", icon: <MousePointer2 />, phone: true },
  { tool: "hand", label: "Hand", key: "H", icon: <Hand />, phone: false },
  { tool: "connect", label: "Connect", key: "C", icon: <Spline />, phone: true },
  { tool: "container", label: "Container", key: "B", icon: <Box />, phone: false },
  { tool: "zone", label: "Highlight zone", key: "Z", icon: <SquareDashed />, phone: false },
  { tool: "text", label: "Text", key: "T", icon: <Type />, phone: true },
  { tool: "note", label: "Sticky note", key: "N", icon: <StickyNote />, phone: true },
  { tool: "label", label: "Label", key: "L", icon: <Tag />, phone: false },
];
const MORE = TOOLS.filter((item) => !item.phone);

/** Creation tools with their shortcut letters (Cloudairy pattern), in Eden's floating style. */
export function Toolbar() {
  const store = useEditorStore();
  const { tool, canUndo, canRedo, showGrid } = useEditorShallow((s) => ({
    tool: s.tool,
    canUndo: s.past.length > 0,
    canRedo: s.future.length > 0,
    showGrid: s.showGrid,
  }));
  const hidden = MORE.find((item) => item.tool === tool);
  return (
    <Panel shape="pill" role="toolbar" aria-label="Tools" className="flex items-center gap-0.5 p-1">
      {TOOLS.map((item) => (
        <IconButton
          key={item.tool}
          label={item.label}
          shortcut={item.key}
          tooltipSide="bottom"
          shape="round"
          active={tool === item.tool}
          className={cn(!item.phone && "max-sm:hidden")}
          onClick={() => store.getState().setTool(item.tool)}
        >
          {item.icon}
        </IconButton>
      ))}
      <Menu>
        <MenuTrigger asChild>
          {/* Shows the chosen tool when it lives in this menu. */}
          <IconButton
            label="More tools"
            shape="round"
            active={hidden !== undefined}
            className="sm:hidden"
          >
            {hidden?.icon ?? <Ellipsis />}
          </IconButton>
        </MenuTrigger>
        <MenuContent side="top" align="center" className="w-52">
          <MenuRadioGroup
            value={hidden?.tool ?? ""}
            onValueChange={(value) => {
              const picked = MORE.find((item) => item.tool === value);
              if (picked !== undefined) store.getState().setTool(picked.tool);
            }}
          >
            {MORE.map((item) => (
              <MenuRadioItem key={item.tool} value={item.tool} icon={item.icon}>
                {item.label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuItem icon={<Grid3x3 />} onSelect={() => store.getState().toggleGrid()}>
            {showGrid ? "Hide grid" : "Show grid"}
          </MenuItem>
        </MenuContent>
      </Menu>
      <ToolbarDivider />
      <IconButton
        label="Undo"
        shortcut={shortcutLabel("mod+z")}
        tooltipSide="bottom"
        shape="round"
        disabled={!canUndo}
        onClick={() => store.getState().undo()}
      >
        <Undo2 />
      </IconButton>
      <IconButton
        label="Redo"
        shortcut={shortcutLabel("mod+shift+z")}
        tooltipSide="bottom"
        shape="round"
        disabled={!canRedo}
        onClick={() => store.getState().redo()}
      >
        <Redo2 />
      </IconButton>
      <ToolbarDivider className="max-sm:hidden" />
      <IconButton
        label={showGrid ? "Hide grid" : "Show grid"}
        shortcut={shortcutLabel("mod+'")}
        tooltipSide="bottom"
        shape="round"
        active={showGrid}
        className="max-sm:hidden"
        onClick={() => store.getState().toggleGrid()}
      >
        <Grid3x3 />
      </IconButton>
    </Panel>
  );
}
