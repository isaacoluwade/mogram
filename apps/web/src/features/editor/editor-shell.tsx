"use client";

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  MousePointerClick,
  PanelLeftOpen,
  PanelRightOpen,
  Shapes,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { stepScene } from "@mogram/core/timeline";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Panel } from "@/components/ui/panel";
import { Spinner } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { useScrollFade } from "@/lib/use-scroll-fade";
import { resolveTheme } from "@/features/canvas/theme";
import { useLayout, useRoutes } from "@/features/canvas/use-diagram";
import { LibraryPanel } from "./library/library-panel";
import { InspectorPanel } from "./inspector/inspector-panel";
import { ShareDialog } from "./dialogs/share-dialog";
import { ToursPanel } from "./tours/tours-panel";
import { EditorCanvas, useIsEmptyDiagram } from "./canvas/editor-canvas";
import { Breadcrumbs } from "./chrome/breadcrumbs";
import { SceneStrip } from "./chrome/scene-strip";
import { Toolbar } from "./chrome/toolbar";
import { TopLeftBar, TopRightBar } from "./chrome/top-bar";
import { ZoomControls } from "./chrome/zoom-controls";
import { OpenDialog } from "./dialogs/open-dialog";
import { ShortcutsDialog } from "./dialogs/shortcuts-dialog";
import { useEditor, useEditorClock, useEditorShallow, useEditorStore } from "./editor-context";
import { useKeepSelectionInView } from "./canvas/keep-in-view";
import { CodePanel } from "./panels/code-panel";
import { useEditorHost, useOpenViewer } from "./persistence/host";
import { deepLinkQuery } from "@/features/share/deep-link";
import { useEditorShortcuts } from "./shortcuts";
import { storyDiagram } from "./store/editor-store";

// Heavy and only needed once opened: loaded on demand, not with the editor.
const ExportDialog = dynamic(
  () => import("./dialogs/export-dialog").then((module) => module.ExportDialog),
  { ssr: false },
);
const HistoryDialog = dynamic(
  () => import("./dialogs/history-dialog").then((module) => module.HistoryDialog),
  { ssr: false },
);

/**
 * The editor: a full-bleed canvas with Eden-style floating chrome (ED-1 … ED-10).
 *
 * Desktop: bars top-left/top-right, tools top-centre, library left, inspector/code/tours right,
 * scenes bottom-centre, zoom bottom-left. Below `lg` the tools move to the bottom; below `md`
 * the panels become bottom sheets and only one is open at a time.
 */
export function EditorShell() {
  const store = useEditorStore();
  useKeepSelectionInView(store);
  const clock = useEditorClock();
  const host = useEditorHost();
  const openViewer = useOpenViewer();
  const panels = useEditor((s) => s.panels);
  const dialog = useEditor((s) => s.dialog);
  const rightPanel = panels.code
    ? "code"
    : panels.tours
      ? "tours"
      : panels.inspector
        ? "inspector"
        : null;
  const anySheet = panels.library || rightPanel !== null;

  useStoreMessages();

  const actions = useMemo(
    () => ({
      save: () => {
        void host.saveNow();
      },
      nextScene: (direction: 1 | -1) => {
        const state = store.getState();
        const scenes = storyDiagram(state.files).scenes.map((s) => s.name);
        state.setScene(stepScene(scenes, state.scene, direction), clock.time());
      },
      preview: () => {
        const { levelPath, scene } = store.getState();
        void openViewer(deepLinkQuery({ level: levelPath, scene }));
      },
      togglePlay: () => {
        const state = store.getState();
        if (storyDiagram(state.files).scenes.length === 0) {
          state.notify("Add a scene first: scenes are the moments you play through.");
          return;
        }
        state.setPlaying(!state.playing);
      },
    }),
    [host, store, clock, openViewer],
  );
  useEditorShortcuts(store, actions);

  const closeRight = () => {
    if (rightPanel !== null) store.getState().togglePanel(rightPanel, false);
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-page" data-testid="editor">
      <EditorCanvas />

      <div className="pointer-events-none absolute inset-0 z-10">
        {/* Top row */}
        <div className="pointer-events-auto absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-2 max-md:left-2 max-md:top-2">
          <TopLeftBar />
        </div>
        <div className="pointer-events-auto absolute right-3 top-3 max-md:right-2 max-md:top-2">
          <TopRightBar />
        </div>
        <div className="pointer-events-auto absolute left-1/2 top-3 -translate-x-1/2 max-lg:hidden">
          <Toolbar />
        </div>
        <TourAuthoringBanner />

        {/* Nested levels and alerts: centred under the top bars, in the space the panels leave. */}
        <div
          className={cn(
            "pointer-events-none absolute top-16 flex flex-col items-center gap-2 max-md:inset-x-2 max-md:top-[60px]",
            panels.library ? "md:left-clear-library" : "md:left-clear-pill",
            rightPanel === null
              ? "md:right-clear-pill"
              : rightPanel === "code"
                ? "md:right-clear-code xl:right-clear-code-xl"
                : "md:right-clear-right",
          )}
        >
          <div className="pointer-events-auto min-w-0 max-w-full">
            <Breadcrumbs />
          </div>
          <YamlErrorBanner />
          <ConflictBanner />
        </div>

        {/* Side panels (bottom sheets on phones) */}
        {panels.library ? (
          <aside className="pointer-events-auto absolute bottom-3 left-3 top-16 w-panel-library max-md:inset-x-2 max-md:bottom-2 max-md:top-auto max-md:h-[62dvh] max-md:w-auto">
            <LibraryPanel onClose={() => store.getState().togglePanel("library", false)} />
          </aside>
        ) : (
          <div className="pointer-events-auto absolute left-3 top-16 max-md:hidden">
            <Panel shape="pill" className="p-1">
              <IconButton
                label="Show library"
                shape="round"
                tooltipSide="right"
                onClick={() => store.getState().togglePanel("library", true)}
              >
                <PanelLeftOpen />
              </IconButton>
            </Panel>
          </div>
        )}
        {rightPanel !== null ? (
          <aside
            className={cn(
              "pointer-events-auto absolute bottom-3 right-3 top-16 max-md:inset-x-2 max-md:bottom-2 max-md:top-auto max-md:h-[62dvh] max-md:w-auto",
              rightPanel === "code" ? "w-panel-code xl:w-panel-code-xl" : "w-panel-right",
            )}
          >
            {rightPanel === "code" ? (
              <CodePanel onClose={closeRight} />
            ) : rightPanel === "tours" ? (
              <ToursPanel onClose={closeRight} />
            ) : (
              <InspectorPanel onClose={closeRight} />
            )}
          </aside>
        ) : (
          <div className="pointer-events-auto absolute right-3 top-16 max-md:hidden">
            <Panel shape="pill" className="p-1">
              <IconButton
                label="Show inspector"
                shape="round"
                tooltipSide="left"
                onClick={() => store.getState().togglePanel("inspector", true)}
              >
                <PanelRightOpen />
              </IconButton>
            </Panel>
          </div>
        )}

        {/* Bottom: zoom, scenes and (below lg) tools, centred in the space the panels leave */}
        {/* With the library open on tablets the zoom buttons give way to the tools (pinch still zooms). */}
        <div
          className={cn(
            "pointer-events-auto absolute bottom-3 max-md:hidden",
            panels.library ? "left-clear-library max-lg:hidden" : "left-3",
          )}
        >
          <ZoomControls />
        </div>
        <div
          className={cn(
            "absolute bottom-3 flex flex-col items-center gap-2 max-md:inset-x-2 max-md:bottom-2",
            // Clear of the zoom controls on the left and the open panel on the right.
            panels.library
              ? "md:left-clear-library lg:left-[calc(var(--spacing-clear-library)+var(--spacing-clear-zoom))]"
              : "md:left-[calc(12px+var(--spacing-clear-zoom))]",
            rightPanel === null
              ? "md:right-clear-pill"
              : rightPanel === "code"
                ? "md:right-clear-code xl:right-clear-code-xl"
                : "md:right-clear-right",
            anySheet && "max-md:hidden",
          )}
        >
          <div className="pointer-events-auto flex min-w-0 max-w-full justify-center">
            <SceneStripDock />
          </div>
          <div className="pointer-events-auto flex max-w-full items-center gap-2 lg:hidden">
            <Panel shape="pill" className="p-1 md:hidden">
              <IconButton
                label="Library"
                shape="round"
                onClick={() => store.getState().togglePanel("library", true)}
              >
                <Shapes />
              </IconButton>
            </Panel>
            <ToolbarScroller />
            <Panel shape="pill" className="p-1 md:hidden">
              <IconButton
                label="Inspector"
                shape="round"
                onClick={() => store.getState().togglePanel("inspector", true)}
              >
                <SlidersHorizontal />
              </IconButton>
            </Panel>
          </div>
        </div>

        <EmptyCanvasHint libraryOpen={panels.library} />
      </div>

      <BusyOverlay />
      {dialog === "export" ? <ExportDialog /> : null}
      <ShareDialog />
      <ShortcutsDialog />
      {dialog === "history" ? <HistoryDialog /> : null}
      <OpenDialog />
    </div>
  );
}

/** Below lg the tools sit at the bottom and scroll sideways if they don't fit. */
function ToolbarScroller() {
  const scroller = useScrollFade<HTMLDivElement>();
  return (
    <div ref={scroller} className="scroll-fade scrollbar-none min-w-0 overflow-x-auto rounded-full">
      <Toolbar />
    </div>
  );
}

/** The scene strip needs the settled layout (no gesture previews) for its thumbnails. */
function SceneStripDock() {
  const diagram = useEditor((s) => s.parsed().diagram);
  const layout = useLayout(diagram);
  const routes = useRoutes(diagram, layout);
  const theme = useMemo(() => resolveTheme(diagram.settings), [diagram.settings]);
  return <SceneStrip layout={layout} routes={routes} theme={theme} />;
}

/** Store messages become toasts (errors in rose, everything else neutral). */
function useStoreMessages() {
  const message = useEditor((s) => s.message);
  useEffect(() => {
    if (message === null) return;
    if (message.tone === "error") toast.error(message.text, { id: message.id });
    else toast(message.text, { id: message.id });
  }, [message]);
}

function TourAuthoringBanner() {
  const store = useEditorStore();
  const { authoring, title } = useEditorShallow((s) => ({
    authoring: s.tourAuthoring,
    title: s.parsed().diagram.tours.find((t) => t.name === s.tourAuthoring)?.title ?? null,
  }));
  if (authoring === null) return null;
  return (
    <div className="pointer-events-auto absolute left-1/2 top-[68px] -translate-x-1/2 max-lg:top-auto max-lg:bottom-[150px] max-md:bottom-[136px]">
      <Panel
        shape="pill"
        className="flex items-center gap-3 py-1.5 pl-4 pr-1.5 text-label"
        role="status"
      >
        <MousePointerClick className="size-4 shrink-0 text-green" aria-hidden />
        <span className="truncate text-fg-soft">
          Click elements in order to add them to{" "}
          <span className="font-medium text-fg">{title ?? authoring}</span>
        </span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => store.getState().setTourAuthoring(null)}
        >
          Done
        </Button>
      </Panel>
    </div>
  );
}

/** Two tabs or devices saved the same cloud diagram: let the person choose (AC-4). */
function ConflictBanner() {
  const host = useEditorHost();
  const save = useEditor((s) => s.save);
  if (save.kind !== "conflict" || host.resolveConflict === undefined) return null;
  return (
    <div className="pointer-events-auto w-[min(560px,100%)]">
      <Banner
        tone="amber"
        title="This diagram changed somewhere else."
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void host.resolveConflict?.("reload")}
            >
              Load newer
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => void host.resolveConflict?.("overwrite")}
            >
              Keep mine
            </Button>
          </>
        }
      >
        Load the newer version, or keep yours and replace it.
      </Banner>
    </div>
  );
}

/** YAML typed in the code panel that doesn't parse yet: say where, and why the canvas waits. */
function YamlErrorBanner() {
  const store = useEditorStore();
  const parsed = useEditor((s) => s.parsed());
  const file = parsed.brokenFiles[0];
  if (file === undefined) return null;
  const problem = parsed.diagnostics.find((d) => d.file === file && d.severity === "error");
  return (
    <div className="pointer-events-auto w-[min(560px,100%)]">
      <Banner
        tone="rose"
        title={`${file}${problem !== undefined ? `, line ${problem.line}` : ""} isn't valid YAML.`}
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              store.getState().setCodeFile(file);
              store.getState().togglePanel("code", true);
            }}
          >
            Show the line
          </Button>
        }
      >
        The canvas shows the last version that worked until it&apos;s fixed.
      </Banner>
    </div>
  );
}

/** A blank canvas explains how to start (ED-2). */
function EmptyCanvasHint({ libraryOpen }: { libraryOpen: boolean }) {
  const store = useEditorStore();
  const empty = useIsEmptyDiagram();
  if (!empty) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="pointer-events-auto flex max-w-sm flex-col items-center text-center animate-fade-in">
        <span className="mb-4 flex size-14 items-center justify-center rounded-full border border-border bg-surface text-fg-secondary [&_svg]:size-6">
          <Shapes />
        </span>
        <p className="font-display text-body-lg font-medium tracking-snug text-fg">
          Start with a component
        </p>
        <p className="mt-1 text-body-sm text-fg-muted">
          Drag an icon from the library onto the canvas, or click one to add it. Then press C to
          connect things.
        </p>
        {!libraryOpen ? (
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => store.getState().togglePanel("library", true)}
          >
            <Shapes />
            Open the library
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** While the document is handed over (uploaded to the account), nothing on the page can change it. */
function BusyOverlay() {
  const busy = useEditor((s) => s.busy);
  if (busy === null) return null;
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-overlay animate-fade-in"
      role="alert"
      aria-busy="true"
    >
      <Panel className="flex items-center gap-3 px-4 py-3 text-label text-fg-soft">
        <Spinner label={busy} />
        {busy}
      </Panel>
    </div>
  );
}
