"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FilePlus2, PanelRightClose } from "lucide-react";
import { writeProjectFile } from "@mogram/core/edit";
import { dirname, isMogramFile, joinPath } from "@mogram/core/model";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
import { Spinner } from "@/components/ui/skeleton";
import { useEditorShallow, useEditorStore } from "../editor-context";
import { parseCached } from "../store/editor-store";

const APPLY_DELAY_MS = 350;

/** CodeMirror is the heaviest part of the editor: it loads the first time the panel opens. */
const YamlEditor = dynamic(
  () => import("@/features/code/yaml-editor").then((module) => module.YamlEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center gap-2 p-4 text-label text-fg-muted">
        <Spinner label="Loading the code editor" />
        Loading the code editor…
      </div>
    ),
  },
);

/**
 * The YAML behind the canvas (FI-15). Edits here update the canvas live; problems show inline
 * with the file and line (FI-16). Canvas edits flow back into the text.
 */
export function CodePanel({ onClose }: { onClose: () => void }) {
  const store = useEditorStore();
  const { files, folder, codeFile, codeReveal } = useEditorShallow((s) => ({
    files: s.files,
    folder: s.folder,
    codeFile: s.codeFile,
    codeReveal: s.codeReveal,
  }));
  const parsed = parseCached(files, folder);
  // The files a code element shows (D-103) are edited here too, after the diagram's own.
  const listings = useMemo(
    () =>
      new Set(
        [...parsed.diagram.components.values()].flatMap((component) =>
          component.code?.path != null && files[component.code.path] !== undefined
            ? [component.code.path]
            : [],
        ),
      ),
    [parsed.diagram.components, files],
  );
  const paths = useMemo(() => {
    const local = Object.keys(files).filter((path) => {
      const dir = dirname(path);
      return dir === folder || dir === joinPath(folder, "docs");
    });
    const kind = (path: string) => (isMogramFile(path) ? 0 : path.endsWith(".md") ? 1 : 2);
    return [
      ...local.filter((path) => isMogramFile(path) || path.endsWith(".md")),
      ...[...listings].filter((path) => !local.includes(path)),
    ].sort(
      (a, b) =>
        kind(a) - kind(b) ||
        parsed.diagram.files.indexOf(a) - parsed.diagram.files.indexOf(b) ||
        a.localeCompare(b),
    );
  }, [files, folder, parsed.diagram.files, listings]);
  const active = codeFile !== null && files[codeFile] !== undefined ? codeFile : (paths[0] ?? null);
  const [creating, setCreating] = useState(false);
  const pending = useRef<{ readonly timer: number; readonly apply: () => void } | null>(null);

  // Closing the panel mid-typing applies what was typed rather than dropping it.
  useEffect(
    () => () => {
      const last = pending.current;
      pending.current = null;
      if (last === null) return;
      window.clearTimeout(last.timer);
      last.apply();
    },
    [],
  );

  const diagnostics = parsed.diagnostics.filter((d) => d.file === active);
  const counts = new Map<string, number>();
  for (const d of parsed.diagnostics)
    if (d.severity === "error") counts.set(d.file, (counts.get(d.file) ?? 0) + 1);

  const onChange = (text: string) => {
    if (active === null) return;
    if (pending.current !== null) window.clearTimeout(pending.current.timer);
    const label = isMogramFile(active)
      ? "Edit YAML"
      : active.endsWith(".md")
        ? "Edit card"
        : "Edit code";
    const apply = () => {
      const state = store.getState();
      state.replaceFiles({ ...state.files, [active]: text }, label, { typed: true });
    };
    const timer = window.setTimeout(() => {
      pending.current = null;
      apply();
    }, APPLY_DELAY_MS);
    pending.current = { timer, apply };
  };

  const prefix = folder.length > 0 ? `${folder}/` : "";

  return (
    <Panel
      role="region"
      className="flex h-full w-full flex-col overflow-hidden"
      aria-label="YAML code"
    >
      <PanelHeader>
        <PanelTitle>Code</PanelTitle>
        <IconButton label="New file" size="sm" onClick={() => setCreating(true)}>
          <FilePlus2 />
        </IconButton>
        <IconButton label="Hide code" size="sm" onClick={onClose}>
          <PanelRightClose />
        </IconButton>
      </PanelHeader>
      <Tabs
        value={active ?? ""}
        onValueChange={(path) => store.getState().setCodeFile(path)}
        className="contents"
      >
        <TabsList
          aria-label="Files"
          className="scrollbar-none shrink-0 overflow-x-auto border-b border-border-muted px-2 py-1.5"
        >
          {paths.map((path) => (
            <TabsTrigger key={path} value={path} variant="pill" className="font-mono">
              {path.startsWith(prefix) ? path.slice(prefix.length) : path}
              {(counts.get(path) ?? 0) > 0 ? (
                <Badge tone="rose" size="sm">
                  {counts.get(path)}
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {creating ? (
          <form
            className="flex items-center gap-1.5 border-b border-border-muted px-3 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              const raw = new FormData(event.currentTarget).get("name");
              const name = typeof raw === "string" ? raw.trim() : "";
              setCreating(false);
              if (name.length === 0) return;
              const file = name.endsWith(".md")
                ? joinPath(folder, "docs", name)
                : joinPath(folder, `${name.replace(/\.mogram(\.yaml)?$/i, "")}.mogram.yaml`);
              if (files[file] !== undefined) {
                store.getState().setCodeFile(file);
                return;
              }
              const content = file.endsWith(".md") ? "# Title\n\n" : "components:\n";
              const ok = store
                .getState()
                .edit("New file", (f, d) => writeProjectFile(f, d, { path: file, content }));
              if (ok) store.getState().setCodeFile(file);
            }}
          >
            <input
              name="name"
              autoFocus
              aria-label="File name"
              placeholder="network (or notes.md)"
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Escape") setCreating(false);
              }}
              className="h-8 min-w-0 flex-1 rounded-md bg-fill-field px-2.5 font-mono text-caption text-fg outline-none focus-visible:ring-1 focus-visible:ring-border-emphasis placeholder:text-fg-ghost"
            />
          </form>
        ) : null}
        {active === null ? (
          <p className="min-h-0 flex-1 p-4 text-label text-fg-muted">
            This diagram has no files yet.
          </p>
        ) : (
          <TabsContent value={active} className="min-h-0 flex-1 outline-none">
            <YamlEditor
              key={active}
              label={`Contents of ${active}`}
              value={files[active] ?? ""}
              onChange={onChange}
              diagnostics={diagnostics}
              language={
                isMogramFile(active) ? "yaml" : active.endsWith(".md") ? "markdown" : "plain"
              }
              reveal={codeReveal?.file === active ? codeReveal : null}
            />
          </TabsContent>
        )}
      </Tabs>
      <div className="shrink-0 border-t border-border-muted px-3.5 py-2 text-micro text-fg-muted">
        {diagnostics.length === 0
          ? "No problems in this file."
          : `${diagnostics.length} problem${diagnostics.length === 1 ? "" : "s"} in this file — hover the underlined lines.`}
      </div>
    </Panel>
  );
}
