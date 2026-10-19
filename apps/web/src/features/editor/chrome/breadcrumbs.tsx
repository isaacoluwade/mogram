"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Panel, ToolbarDivider } from "@/components/ui/panel";
import { useEditorShallow, useEditorStore } from "../editor-context";
import { exitNested } from "../levels";
import { levelsAlong, shownFiles } from "../store/editor-store";

/**
 * Where you are in nested diagrams (NE-8): a clear way back to the level you came from (also
 * Escape), then every level from the top; each crumb zooms back out to that level.
 */
export function Breadcrumbs() {
  const store = useEditorStore();
  const { files, root, levelPath } = useEditorShallow((s) => ({
    files: shownFiles(s),
    root: s.root,
    levelPath: s.levelPath,
  }));
  if (levelPath.length === 0) return null;
  const crumbs = levelsAlong(files, levelPath, root).map((level) => ({
    label: level.label,
    depth: level.path.length,
  }));
  const parent = crumbs.at(-2);
  return (
    <Panel
      shape="pill"
      className="scrollbar-none flex max-w-full items-center gap-1 overflow-x-auto p-1 animate-pop-in"
    >
      {parent !== undefined ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            aria-label={`Back to ${parent.label}`}
            title="Back out one level (Esc)"
            onClick={() => exitNested(store)}
          >
            <ArrowLeft />
            <span className="max-w-40 truncate max-sm:hidden">Back to {parent.label}</span>
            <span className="sm:hidden">Back</span>
            <Kbd className="ml-0.5 max-md:hidden">Esc</Kbd>
          </Button>
          <ToolbarDivider className="max-sm:hidden" />
        </>
      ) : null}
      <nav
        aria-label="Nested diagram levels"
        className="flex w-max items-center gap-0.5 whitespace-nowrap pr-1.5 text-caption max-sm:hidden"
      >
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.depth}>
            {index > 0 ? <ChevronRight aria-hidden className="size-3.5 text-fg-ghost" /> : null}
            {index === crumbs.length - 1 ? (
              <span aria-current="page" className="px-2 py-1 font-medium text-fg">
                {crumb.label}
              </span>
            ) : (
              <button
                type="button"
                className="rounded-full px-2 py-1 text-fg-faint transition-colors hover:bg-fill-hover hover:text-fg"
                onClick={() => exitNested(store, crumb.depth)}
              >
                {crumb.label}
              </button>
            )}
          </Fragment>
        ))}
      </nav>
    </Panel>
  );
}
