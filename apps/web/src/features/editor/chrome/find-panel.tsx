"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { computeLayout, type Box } from "@mogram/core/layout";
import type { CardRef, Diagram, ProjectFiles } from "@mogram/core/model";
import { routeConnections } from "@mogram/core/routing";
import { IconButton } from "@/components/ui/icon-button";
import { Panel } from "@/components/ui/panel";
import { revealSelection } from "../actions";
import { shortcutLabel } from "../commands/keys";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { jumpToLevel } from "../levels";
import { parseCached, shownFiles } from "../store/editor-store";

interface Match {
  readonly name: string;
  readonly at: { readonly x: number; readonly y: number };
  /** The nested level it's on, and how that reads ("Payments › AKS"); "" at the top. */
  readonly path: readonly string[];
  readonly where: string;
}

interface Level {
  readonly path: readonly string[];
  readonly folder: string;
  readonly where: string;
}

/** Most levels Find looks through: plenty for a real project, a bound on a pathological one. */
const MAX_LEVELS = 64;

/**
 * The top diagram and every nested diagram below it, nearest first. A folder opened by several
 * components is one blueprint (NE-1), so it's searched once, by the first way in; the level being
 * edited keeps its own way in.
 */
function everyLevel(files: ProjectFiles, here: readonly string[], hereFolder: string): Level[] {
  const levels: Level[] = [{ path: hereFolder === "" ? here : [], folder: "", where: "" }];
  const seen = new Set([""]);
  for (let i = 0; i < levels.length && levels.length < MAX_LEVELS; i++) {
    const level = levels[i];
    if (level === undefined) break;
    for (const component of parseCached(files, level.folder).diagram.components.values()) {
      const folder = component.opens;
      if (folder == null || seen.has(folder)) continue;
      if (parseCached(files, folder).diagram.files.length === 0) continue;
      seen.add(folder);
      const where = level.where === "" ? component.label : `${level.where} › ${component.label}`;
      levels.push({
        path: folder === hereFolder ? here : [...level.path, component.name],
        folder,
        where,
      });
    }
  }
  return levels;
}

const samePath = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((name, i) => name === b[i]);

/** Every searchable element with the words it can be found by: label, YAML name, type, card. */
function searchable(diagram: Diagram): { name: string; words: string; box: Box | null }[] {
  const layout = computeLayout(diagram);
  const routes = routeConnections(diagram, layout);
  const card = (ref: CardRef | null): string =>
    ref === null ? "" : `${ref.title ?? ""} ${ref.kind === "inline" ? ref.body : ref.path}`;
  const boxOf = (name: string): Box | null =>
    layout.tiles.get(name) ?? layout.elements.get(name)?.box ?? layout.groups.get(name) ?? null;
  return [
    ...[...diagram.containers.values()].map((c) => ({
      name: c.name,
      words: `${c.label} ${c.name} ${c.type} ${card(c.card)}`,
      box: boxOf(c.name),
    })),
    ...[...diagram.components.values()].map((c) => ({
      name: c.name,
      words: `${c.label} ${c.name} ${c.type} ${card(c.card)}`,
      box: boxOf(c.name),
    })),
    ...[...diagram.groups.values()].map((g) => ({
      name: g.name,
      words: `${g.label} ${g.name}`,
      box: boxOf(g.name),
    })),
    ...[...diagram.decorations.values()].map((d) => ({
      name: d.name,
      words: `${d.text} ${d.name}`,
      box: boxOf(d.name),
    })),
    ...[...diagram.connections.values()].map((c) => {
      const route = routes.get(c.name);
      const middle = route?.points[Math.floor(route.points.length / 2)];
      return {
        name: c.name,
        words: `${c.text ?? ""} ${c.name} ${card(c.card)}`,
        box: middle === undefined ? null : { x: middle.x, y: middle.y, w: 0, h: 0 },
      };
    }),
  ];
}

/**
 * Find (⌘F; 05-ui-shell-commands §11.3.4, §13.8): a small panel under the top bar that finds
 * elements by label, YAML name, type or card text, here and in every nested diagram. Matches on
 * this level come first, in reading order (top to bottom, then left to right), then the other
 * levels'; Enter steps to the next and Shift+Enter back, going to its level, selecting it and
 * bringing it into view. Esc closes it.
 */
export function FindPanel() {
  const store = useEditorStore();
  const open = useEditor((s) => s.findOpen);
  if (!open) return null;
  return <FindBody onClose={() => store.getState().setFindOpen(false)} />;
}

function FindBody({ onClose }: { onClose: () => void }) {
  const store = useEditorStore();
  const { files, folder, levelPath } = useEditorShallow((s) => ({
    files: shownFiles(s),
    folder: s.folder,
    levelPath: s.levelPath,
  }));
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(-1);
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  // Where Find started: this level's matches come first, and stay first while stepping through.
  const [start] = useState(() => ({ path: levelPath, folder }));
  const levels = useMemo(
    () =>
      everyLevel(files, start.path, start.folder).map((level) => ({
        ...level,
        items: searchable(parseCached(files, level.folder).diagram),
      })),
    [files, start],
  );
  const matches = useMemo<Match[]>(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    const here = levels.find((level) => level.folder === start.folder);
    return [
      ...(here === undefined ? [] : [here]),
      ...levels.filter((level) => level !== here),
    ].flatMap((level) =>
      level.items
        .filter((item) => words.every((word) => item.words.toLowerCase().includes(word)))
        .map((item) => ({
          name: item.name,
          at: item.box ?? { x: 0, y: 0 },
          path: level.path,
          where: level.where,
        }))
        .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x),
    );
  }, [levels, query, start]);
  const levelCount = new Set(matches.map((match) => match.path.join("/"))).size;

  const go = (to: number) => {
    if (matches.length === 0) return;
    const next = ((to % matches.length) + matches.length) % matches.length;
    const match = matches[next];
    if (match === undefined) return;
    if (!samePath(match.path, store.getState().levelPath) && !jumpToLevel(store, match.path))
      return;
    setIndex(next);
    store.getState().select([match.name]);
    revealSelection(store);
  };

  const current = index >= 0 && index < matches.length ? index : -1;
  const count =
    query.trim().length === 0
      ? ""
      : matches.length === 0
        ? "No matches"
        : current < 0
          ? `${matches.length} found${levelCount > 1 ? ` on ${levelCount} levels` : ""}`
          : `${current + 1} of ${matches.length}`;
  // Which nested diagram the current match is in ("Top level" only when that tells it apart).
  const match = current >= 0 ? matches[current] : undefined;
  const where =
    match === undefined ? "" : match.where !== "" ? match.where : levelCount > 1 ? "Top level" : "";

  return (
    <Panel
      role="search"
      aria-label="Find"
      className="pointer-events-auto flex h-10 w-96 max-w-full items-center gap-1 pl-3 pr-1 shadow-popover animate-pop-in"
    >
      <Search aria-hidden className="size-4 shrink-0 text-fg-faint" />
      <input
        ref={input}
        data-find-input
        aria-label="Find in diagram"
        placeholder="Find labels, names, types…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIndex(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            go(current < 0 ? (event.shiftKey ? -1 : 0) : current + (event.shiftKey ? -1 : 1));
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          // ⌘F in the box selects what's typed rather than opening the browser's find.
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
            event.preventDefault();
            event.currentTarget.select();
          }
        }}
        className="h-8 min-w-0 flex-1 bg-transparent text-label text-fg outline-none placeholder:text-fg-ghost"
      />
      <span aria-live="polite" className="flex min-w-0 shrink items-center gap-1 px-1">
        <span className="shrink-0 text-micro tabular-nums text-fg-muted">{count}</span>
        {where !== "" ? (
          <span
            data-find-level
            title={where}
            className="min-w-0 truncate rounded-sm bg-fill-hover px-1 text-micro text-fg-soft"
          >
            {where}
          </span>
        ) : null}
      </span>
      <IconButton
        label="Previous match"
        shortcut={shortcutLabel("shift+enter")}
        disabled={matches.length === 0}
        onClick={() => go(current < 0 ? -1 : current - 1)}
      >
        <ChevronUp />
      </IconButton>
      <IconButton
        label="Next match"
        shortcut={shortcutLabel("enter")}
        disabled={matches.length === 0}
        onClick={() => go(current + 1)}
      >
        <ChevronDown />
      </IconButton>
      <IconButton label="Close find" shortcut="Esc" onClick={onClose}>
        <X />
      </IconButton>
    </Panel>
  );
}
