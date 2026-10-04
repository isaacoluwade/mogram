"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronLeft,
  Cloud,
  Code2,
  Download,
  Eye,
  FileUp,
  History,
  Keyboard,
  MoreHorizontal,
  MonitorPlay,
  Route,
  Share2,
} from "lucide-react";
import { setSetting } from "@mogram/core/edit";
import { Button } from "@/components/ui/button";
import { IconButton, IconLink } from "@/components/ui/icon-button";
import { LogoMark } from "@/components/ui/logo";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Panel, ToolbarDivider } from "@/components/ui/panel";
import { downloadProject } from "@/features/files/download";
import { deepLinkQuery } from "@/features/share/deep-link";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { useEditorHost, useOpenViewer } from "../persistence/host";
import { shortcutLabel } from "../shortcuts";
import type { SaveStatus } from "../store/editor-store";

function statusText(save: SaveStatus, kind: "local" | "cloud"): string {
  if (save.kind === "error") return `Couldn't save: ${save.message}`;
  switch (save.kind) {
    case "saving":
      return "Saving…";
    case "unsaved":
      return kind === "local" ? "Saving draft…" : "Unsaved changes";
    case "conflict":
      return "Changed elsewhere";
    case "saved":
      return kind === "local" ? "Draft saved in this browser" : "Saved";
  }
}

/** Top-left: back, logo, diagram name, save status and the diagram menu. */
export function TopLeftBar() {
  const store = useEditorStore();
  const host = useEditorHost();
  const { name, save } = useEditorShallow((s) => ({
    name: s.parsed().diagram.settings.name,
    save: s.save,
  }));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const commitName = () => {
    setEditing(false);
    const next = draft.trim();
    if (next.length === 0 || next === name) return;
    store
      .getState()
      .edit("Rename diagram", (files, diagram) =>
        setSetting(files, diagram, { key: "name", value: next }),
      );
  };

  return (
    <Panel className="flex h-11 items-center gap-1 pl-1 pr-1.5">
      <IconLink label="All diagrams" tooltipSide="bottom" href="/diagrams">
        <ChevronLeft />
      </IconLink>
      <Link href="/" aria-label="Mogram home" className="hidden shrink-0 sm:block">
        <LogoMark size="sm" />
      </Link>
      <div className="ml-1.5 flex min-w-0 flex-col justify-center leading-none">
        {editing ? (
          <input
            autoFocus
            aria-label="Diagram name"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitName();
              if (event.key === "Escape") setEditing(false);
            }}
            className="h-6 w-32 rounded-sm bg-fill-field px-1.5 text-label font-medium text-fg outline-none focus-visible:ring-1 focus-visible:ring-border-emphasis sm:w-44"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
            className="hit-area flex max-w-32 rounded-sm px-1.5 py-0.5 text-left text-label font-medium text-fg transition-colors hover:bg-fill-hover sm:max-w-56"
            title="Rename diagram"
          >
            {/* Truncate inside, so the button's larger touch area isn't clipped with the text. */}
            <span className="truncate">{name}</span>
          </button>
        )}
        <span
          role="status"
          title={statusText(save, host.kind)}
          className={`mt-0.5 truncate px-1.5 text-micro ${save.kind === "error" || save.kind === "conflict" ? "text-rose" : "text-fg-muted"}`}
        >
          {statusText(save, host.kind)}
        </span>
      </div>
      <DiagramMenu />
    </Panel>
  );
}

function DiagramMenu() {
  const store = useEditorStore();
  const host = useEditorHost();
  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label="Diagram menu" tooltipSide="bottom" className="ml-auto">
          <MoreHorizontal />
        </IconButton>
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        {host.kind === "local" && host.saveToCloud !== undefined ? (
          <MenuItem
            icon={<Cloud />}
            description="Keep it in your account and share it"
            onSelect={() => void host.saveToCloud?.()}
          >
            Save to cloud
          </MenuItem>
        ) : null}
        <MenuItem
          icon={<Download />}
          description="Mogram YAML, or a zip for folders"
          onSelect={() => {
            const state = store.getState();
            downloadProject(state.files, state.parsed().diagram.settings.name).catch(() =>
              state.notify("Couldn't prepare the download. Try again.", "error"),
            );
          }}
        >
          Download files
        </MenuItem>
        <MenuItem
          icon={<FileUp />}
          description="Replace with .mogram.yaml or a folder"
          onSelect={() => store.getState().setDialog("open")}
        >
          Open files…
        </MenuItem>
        {host.kind === "cloud" ? (
          <MenuItem
            icon={<History />}
            description="Earlier saved versions"
            onSelect={() => store.getState().setDialog("history")}
          >
            Version history
          </MenuItem>
        ) : null}
        <MenuSeparator className="md:hidden" />
        <MenuItem
          icon={<Code2 />}
          className="md:hidden"
          onSelect={() => store.getState().togglePanel("code", true)}
        >
          YAML code
        </MenuItem>
        <MenuItem
          icon={<Route />}
          className="md:hidden"
          onSelect={() => store.getState().togglePanel("tours", true)}
        >
          Tours
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<Keyboard />}
          shortcut="?"
          onSelect={() => store.getState().setDialog("shortcuts")}
        >
          Keyboard shortcuts
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/** Top-right: code, tours, present, export and share. */
export function TopRightBar() {
  const store = useEditorStore();
  const openViewer = useOpenViewer();
  const panels = useEditor((s) => s.panels);
  return (
    <Panel className="flex h-11 items-center gap-1 px-1.5">
      <IconButton
        label="YAML code"
        tooltipSide="bottom"
        active={panels.code}
        className="max-md:hidden"
        onClick={() => store.getState().togglePanel("code")}
      >
        <Code2 />
      </IconButton>
      <IconButton
        label="Tours"
        tooltipSide="bottom"
        active={panels.tours}
        className="max-md:hidden"
        onClick={() => store.getState().togglePanel("tours")}
      >
        <Route />
      </IconButton>
      <ToolbarDivider className="max-md:hidden" />
      {/* Preview opens the viewer where you are (level and scene); Present goes full screen. */}
      <Button
        variant="ghost"
        size="sm"
        aria-label="Preview"
        title={`Preview as viewers see it (${shortcutLabel("shift+p")})`}
        onClick={() => {
          const { levelPath, scene } = store.getState();
          void openViewer(deepLinkQuery({ level: levelPath, scene }));
        }}
      >
        <Eye />
        <span className="max-lg:hidden">Preview</span>
      </Button>
      <IconButton
        label="Present"
        tooltipSide="bottom"
        onClick={() => {
          const { levelPath, scene } = store.getState();
          const query = deepLinkQuery({ level: levelPath, scene });
          void openViewer(`${query.length > 0 ? `${query}&` : "?"}present=1`);
        }}
      >
        <MonitorPlay />
      </IconButton>
      <ToolbarDivider className="max-md:hidden" />
      {/* The label hides on phones, so the name is set explicitly. */}
      <Button
        variant="outline"
        size="sm"
        aria-label="Export"
        onClick={() => store.getState().setDialog("export")}
        aria-keyshortcuts={shortcutLabel("mod+e")}
      >
        <Download />
        <span className="max-sm:hidden">Export</span>
      </Button>
      <Button
        variant="primary"
        size="sm"
        aria-label="Share"
        onClick={() => store.getState().setDialog("share")}
      >
        <Share2 />
        <span className="max-sm:hidden">Share</span>
      </Button>
    </Panel>
  );
}
