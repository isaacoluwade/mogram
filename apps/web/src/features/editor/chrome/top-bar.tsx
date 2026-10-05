"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChevronLeft,
  CircleAlert,
  CloudCheck,
  Code2,
  LaptopMinimalCheck,
  LoaderCircle,
  Download,
  Eye,
  MoreHorizontal,
  MonitorPlay,
  Route,
  Share2,
  Sparkles,
} from "lucide-react";
import { setSetting } from "@mogram/core/edit";
import { Button } from "@/components/ui/button";
import { IconButton, IconLink } from "@/components/ui/icon-button";
import { LogoMark } from "@/components/ui/logo";
import { Menu, MenuContent, MenuTrigger } from "@/components/ui/menu";
import { Panel, ToolbarDivider } from "@/components/ui/panel";
import { deepLinkQuery } from "@/features/share/deep-link";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { useEditorHost, useOpenViewer } from "../persistence/host";
import { useCommandContext, useCommandHost } from "../commands/context";
import { shortcutLabel } from "../commands/keys";
import { CommandMenuItems } from "../commands/menu-items";
import { DIAGRAM_MENU, resolveMenu } from "../commands/menus";
import type { CommandContext } from "../commands/types";
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

/** Phones have room for less. */
function shortStatusText(save: SaveStatus, kind: "local" | "cloud"): string {
  switch (save.kind) {
    case "error":
      return "Couldn't save";
    case "saved":
      return kind === "local" ? "Draft saved" : "Saved";
    default:
      return statusText(save, kind);
  }
}

/**
 * How the diagram is saved, as a small icon beside its name (a laptop for a draft in this
 * browser, a cloud for the account, a spinner while saving), with the words in its tooltip and
 * for screen readers; a problem shows in words. It opens the version history.
 */
function SaveStatusButton({
  save,
  kind,
  onOpen,
}: {
  save: SaveStatus;
  kind: "local" | "cloud";
  onOpen: () => void;
}) {
  const text = statusText(save, kind);
  const problem = save.kind === "error" || save.kind === "conflict";
  const live = (
    <span role="status" className="sr-only">
      {text}
    </span>
  );
  if (problem)
    return (
      <>
        {live}
        <button
          type="button"
          onClick={onOpen}
          title={`${text} · Version history`}
          aria-label={`${text} · Version history`}
          className="flex h-8 shrink-0 items-center gap-1 rounded-md px-1.5 text-micro text-rose transition-colors hover:bg-fill-hover [&_svg]:size-3.5"
        >
          <CircleAlert aria-hidden />
          {shortStatusText(save, kind)}
        </button>
      </>
    );
  const saved = save.kind === "saved";
  const Icon = !saved ? LoaderCircle : kind === "local" ? LaptopMinimalCheck : CloudCheck;
  return (
    <>
      {live}
      <IconButton
        label={`${text} · Version history`}
        tooltipSide="bottom"
        size="sm"
        onClick={onOpen}
        className="text-fg-muted"
      >
        <Icon aria-hidden className={saved ? undefined : "motion-safe:animate-spin"} />
      </IconButton>
    </>
  );
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
      {/* One row: the name, then how it's saved (which opens the version history). */}
      <div className="ml-1 flex min-w-0 flex-1 items-center gap-0.5">
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
            className="h-8 min-w-0 flex-1 rounded-md bg-fill-field px-2 text-label font-medium text-fg outline-none focus-visible:ring-1 focus-visible:ring-border-emphasis"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
            className="flex h-8 min-w-0 items-center rounded-md px-2 text-left text-label font-medium text-fg transition-colors hover:bg-fill-hover"
            title="Rename diagram"
          >
            <span className="truncate">{name}</span>
          </button>
        )}
        {editing ? null : (
          <SaveStatusButton
            save={save}
            kind={host.kind}
            onOpen={() => store.getState().togglePanel("history", true)}
          />
        )}
      </div>
      <DiagramMenu />
    </Panel>
  );
}

function DiagramMenu() {
  const contextNow = useCommandContext();
  const [context, setContext] = useState<CommandContext | null>(null);
  return (
    <Menu onOpenChange={(open) => setContext(open ? contextNow() : null)}>
      <MenuTrigger asChild>
        <IconButton label="Diagram menu" tooltipSide="bottom" className="ml-auto">
          <MoreHorizontal />
        </IconButton>
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        {context === null ? null : (
          <CommandMenuItems
            entries={resolveMenu(DIAGRAM_MENU, context, true)}
            context={context}
            variant="dropdown"
          />
        )}
      </MenuContent>
    </Menu>
  );
}

/** Top-right: code, tours, present, export and share. */
export function TopRightBar() {
  const store = useEditorStore();
  const openViewer = useOpenViewer();
  const commands = useCommandHost();
  const panels = useEditor((s) => s.panels);
  const assistantShowing = useEditor((s) => s.panels.library && s.leftTab === "assistant");
  return (
    <Panel className="flex h-11 items-center gap-1 px-1.5">
      <IconButton
        label="Assistant"
        shortcut={shortcutLabel("mod+j")}
        tooltipSide="bottom"
        active={assistantShowing}
        onClick={() => commands.assistant?.()}
      >
        <Sparkles className="text-violet" />
      </IconButton>
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
      {/* Phones keep it in the diagram menu: both bars have to fit across the screen. */}
      <Button
        variant="outline"
        size="sm"
        className="max-sm:hidden"
        aria-label="Export"
        onClick={() => store.getState().setDialog("export")}
        aria-keyshortcuts={shortcutLabel("mod+e")}
      >
        <Download />
        Export
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
