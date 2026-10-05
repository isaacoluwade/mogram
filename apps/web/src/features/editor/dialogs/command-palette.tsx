"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Box, Clapperboard, CornerDownLeft, Layers, Plus, Search, Spline } from "lucide-react";
import type { IconEntry } from "@mogram/icons";
import { searchIcons } from "@mogram/icons";
import { SHAPE_INFO } from "@mogram/core/presets";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/cn";
import { preference, setPreference } from "@/lib/preferences";
import { addComponentAt, cloneAndConnect, insertFromLibrary, zoomToSelection } from "../actions";
import { ShapeThumb, matchingShapes } from "../library/shapes-section";
import { useCommandContext } from "../commands/context";
import { shortcutLabel } from "../commands/keys";
import { COMMANDS, GROUP_LABELS, isEnabled, labelOf } from "../commands/registry";
import type { CommandContext } from "../commands/types";
import type { Diagram } from "@mogram/core/model";
import { useEditor, useEditorStore } from "../editor-context";
import type { EditorStore, QuickAdd } from "../store/editor-store";
import { openNested } from "../levels";
import { librariesInUse } from "../library/library-choice";
import { storyDiagram } from "../store/editor-store";

/**
 * The command palette (⌘K or /; 05-ui-shell-commands §10, §13.8): one search over every command
 * that applies now, components to add, elements to jump to, nested diagrams and scenes. Recent
 * commands come first. Enter runs; ⌘Enter runs a command and keeps the palette open.
 */

type Section =
  | "Add here"
  | "Shapes"
  | "Recent"
  | "Commands"
  | "Add component"
  | "Elements"
  | "Nested diagrams"
  | "Scenes";
const SECTIONS: readonly Section[] = [
  "Add here",
  "Shapes",
  "Recent",
  "Commands",
  "Add component",
  "Elements",
  "Nested diagrams",
  "Scenes",
];

interface Item {
  readonly id: string;
  readonly section: Section;
  readonly label: string;
  /** Extra words the search also matches (the group, the element's YAML name). */
  readonly keywords: string;
  readonly detail?: string;
  readonly keys?: string;
  readonly icon: ReactNode;
  /** Commands can run with the palette kept open (⌘Enter). */
  readonly repeatable: boolean;
  readonly run: () => unknown;
}

function readRecent(): string[] {
  return [...preference("paletteRecent")];
}

function pushRecent(id: string): void {
  setPreference("paletteRecent", [id, ...readRecent().filter((v) => v !== id)].slice(0, 5));
}

/** Lower is better; null when some word of the query is missing. */
function score(item: Item, words: readonly string[], query: string): number | null {
  const label = item.label.toLowerCase();
  const haystack = `${label} ${item.keywords.toLowerCase()}`;
  let total = 0;
  for (const word of words) {
    const at = haystack.indexOf(word);
    if (at < 0) return null;
    total += at;
  }
  if (label.startsWith(query)) total -= 1000;
  else if (label.split(/\s+/).some((w) => w.startsWith(words[0] ?? ""))) total -= 500;
  return total;
}

function commandItems(context: CommandContext): Item[] {
  return COMMANDS.filter((c) => c.palette !== false && isEnabled(c, context)).map((c) => {
    const Icon = c.icon;
    const checked = c.checked?.(context);
    const key = c.keys?.[0];
    return {
      id: `command:${c.id}`,
      section: "Commands",
      label: labelOf(c, context),
      keywords: `${GROUP_LABELS[c.group]} ${c.description ?? ""}`,
      detail: checked === true ? "On" : GROUP_LABELS[c.group],
      ...(key === undefined ? {} : { keys: shortcutLabel(key) }),
      icon: Icon === undefined ? <CornerDownLeft /> : <Icon />,
      repeatable: true,
      run: () => {
        pushRecent(c.id);
        return c.run(context);
      },
    };
  });
}

/**
 * Quick add (06-canvas-interactions §9-10): what to put at the spot — a copy of the element the
 * arrow was on, a shape, or an icon — connected from that element when there is one.
 */
function quickAddItems(
  q: string,
  quickAdd: QuickAdd,
  diagram: Diagram,
  catalog: readonly IconEntry[] | null,
  store: EditorStore,
): Item[] {
  const from = quickAdd.from;
  const source = from === null ? undefined : diagram.components.get(from.name);
  const put = (type: string, label: string) => () =>
    insertFromLibrary(store, type, label, quickAdd.at, {
      connectFrom: from?.name ?? null,
    });
  const copy: Item[] =
    source !== undefined &&
    from !== null &&
    (q.length === 0 || source.label.toLowerCase().includes(q))
      ? [
          {
            id: "quick:copy",
            section: "Add here",
            label: `Copy of ${source.label}`,
            keywords: source.type,
            detail: "Connected",
            icon: <Plus />,
            repeatable: false,
            run: () => cloneAndConnect(store, from.name, from.direction),
          },
        ]
      : [];
  const shapes: Item[] = matchingShapes(q).map((shape) => ({
    id: `quick:shape/${shape}`,
    section: "Shapes",
    label: SHAPE_INFO[shape].label,
    keywords: SHAPE_INFO[shape].description,
    detail: "Shape",
    icon: <ShapeThumb shape={shape} className="h-4 w-6" />,
    repeatable: false,
    run: put(`shape/${shape}`, SHAPE_INFO[shape].label),
  }));
  const icons: Item[] =
    catalog === null || q.length === 0
      ? []
      : searchIcons(catalog, q, { prefer: librariesInUse(diagram), limit: 12 }).map((entry) => ({
          id: `quick:${entry.id}`,
          section: "Add component" as const,
          label: entry.name,
          keywords: entry.id,
          detail: entry.library,
          icon: <Plus />,
          repeatable: false,
          run: put(entry.id, entry.name),
        }));
  return [...copy, ...shapes, ...icons];
}

export function CommandPalette() {
  const store = useEditorStore();
  const open = useEditor((s) => s.dialog === "palette");
  const close = () => store.getState().setDialog(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? null : close())}>
      {open ? <PaletteBody onClose={close} /> : null}
    </DialogPrimitive.Root>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const store = useEditorStore();
  const contextNow = useCommandContext();
  // Built once when the palette opens: commands act on the selection as it was then.
  const [context, setContext] = useState(() => contextNow());
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [catalog, setCatalog] = useState<readonly IconEntry[] | null>(null);
  // Opened to add something at a spot (double-click, Alt-click on a hover arrow).
  const [quickAdd] = useState(() => store.getState().quickAdd);
  const list = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    import("@mogram/icons/catalog").then(
      (module) => {
        if (alive) setCatalog(module.ICONS);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  const items = useMemo(() => {
    const diagram = context.diagram;
    const commands = commandItems(context);
    const recentIds = readRecent();
    const recent = recentIds
      .map((id) => commands.find((item) => item.id === `command:${id}`))
      .filter((item): item is Item => item !== undefined)
      .map((item) => ({ ...item, section: "Recent" as const, id: `recent:${item.id}` }));
    const jump = (name: string) => () => {
      store.getState().select([name]);
      zoomToSelection(store);
    };
    const elements: Item[] = [
      ...[...diagram.components.values()].map((c) => ({
        id: `element:${c.name}`,
        section: "Elements" as const,
        label: c.label,
        keywords: `${c.name} ${c.type}`,
        detail: c.name,
        icon: <Box />,
        repeatable: false,
        run: jump(c.name),
      })),
      ...[...diagram.containers.values()].map((c) => ({
        id: `element:${c.name}`,
        section: "Elements" as const,
        label: c.label,
        keywords: `${c.name} ${c.type}`,
        detail: c.name,
        icon: <Box />,
        repeatable: false,
        run: jump(c.name),
      })),
      ...[...diagram.decorations.values()]
        .filter((d) => d.text.trim().length > 0)
        .map((d) => ({
          id: `element:${d.name}`,
          section: "Elements" as const,
          label: d.text.split("\n")[0] ?? d.name,
          keywords: `${d.name} ${d.variant}`,
          detail: d.name,
          icon: <Box />,
          repeatable: false,
          run: jump(d.name),
        })),
      ...[...diagram.connections.values()].map((c) => ({
        id: `element:${c.name}`,
        section: "Elements" as const,
        label:
          c.text ??
          `${diagram.components.get(c.from.element)?.label ?? c.from.element} → ${diagram.components.get(c.to.element)?.label ?? c.to.element}`,
        keywords: `${c.name} connection`,
        detail: c.name,
        icon: <Spline />,
        repeatable: false,
        run: jump(c.name),
      })),
    ];
    const nested: Item[] = [...diagram.components.values()]
      .filter((c) => c.opens !== null)
      .map((c) => ({
        id: `nested:${c.name}`,
        section: "Nested diagrams" as const,
        label: c.label,
        keywords: `${c.name} open nested`,
        detail: "Open",
        icon: <Layers />,
        repeatable: false,
        run: () => openNested(store, c.name),
      }));
    const scenes: Item[] = storyDiagram(store.getState().files).scenes.map((scene) => ({
      id: `scene:${scene.name}`,
      section: "Scenes" as const,
      label: scene.label,
      keywords: `${scene.name} scene`,
      detail: "Scene",
      icon: <Clapperboard />,
      repeatable: false,
      run: () => context.host.goToScene(scene.name),
    }));
    return { recent, commands, elements, nested, scenes };
  }, [context, store]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (quickAdd !== null) return quickAddItems(q, quickAdd, context.diagram, catalog, store);
    if (q.length === 0) {
      const recentIds = new Set(items.recent.map((item) => item.id.slice("recent:".length)));
      return [...items.recent, ...items.commands.filter((item) => !recentIds.has(item.id))];
    }
    const words = q.split(/\s+/).filter(Boolean);
    const rank = (pool: readonly Item[], limit: number): Item[] =>
      pool
        .map((item) => ({ item, at: score(item, words, q) }))
        .filter((entry): entry is { item: Item; at: number } => entry.at !== null)
        .sort((a, b) => a.at - b.at)
        .slice(0, limit)
        .map((entry) => entry.item);
    const inserts: Item[] =
      catalog === null
        ? []
        : searchIcons(catalog, q, { prefer: librariesInUse(context.diagram), limit: 6 })
            .slice(0, 6)
            .map((entry) => ({
              id: `insert:${entry.id}`,
              section: "Add component" as const,
              label: entry.name,
              keywords: entry.id,
              detail: entry.library,
              icon: <Plus />,
              repeatable: false,
              run: () => addComponentAt(store, entry.id, entry.name, null),
            }));
    return [
      ...rank(items.commands, 12),
      ...inserts,
      ...rank(items.elements, 8),
      ...rank(items.nested, 5),
      ...rank(items.scenes, 5),
    ];
  }, [query, items, catalog, context.diagram, store, quickAdd]);

  const current = Math.min(active, Math.max(0, shown.length - 1));

  useEffect(() => {
    list.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const run = (item: Item, keepOpen: boolean) => {
    if (keepOpen && item.repeatable) {
      void item.run();
      setContext(contextNow());
      return;
    }
    onClose();
    void item.run();
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className="fixed left-1/2 top-[12vh] z-50 flex max-h-[min(560px,76dvh)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-popover animate-pop-in focus:outline-none"
      >
        <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
        <div className="flex items-center gap-2.5 border-b border-border-muted px-4">
          <Search aria-hidden className="size-4 shrink-0 text-fg-faint" />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="palette-results"
            aria-activedescendant={shown[current] === undefined ? undefined : `palette-${current}`}
            aria-label="Search commands, elements and scenes"
            placeholder={
              quickAdd === null
                ? "Search commands, components, elements, scenes…"
                : "Add here: search shapes and icons…"
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const by = event.key === "ArrowDown" ? 1 : -1;
                setActive((current + by + shown.length) % Math.max(1, shown.length));
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                const item = shown[current];
                if (item !== undefined) run(item, event.metaKey || event.ctrlKey);
              }
            }}
            className="h-12 min-w-0 flex-1 bg-transparent text-body-sm text-fg outline-none placeholder:text-fg-ghost"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div
          ref={list}
          id="palette-results"
          role="listbox"
          aria-label="Results"
          className="min-h-0 flex-1 overflow-y-auto p-1.5"
        >
          {shown.length === 0 ? (
            <p className="px-3 py-8 text-center text-label text-fg-muted">
              Nothing matches “{query.trim()}”.
            </p>
          ) : (
            SECTIONS.map((section) => {
              const rows = shown
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.section === section);
              if (rows.length === 0) return null;
              return (
                <div key={section} role="group" aria-label={section} className="pb-1">
                  <div className="px-2.5 pb-1 pt-2 text-micro font-medium text-fg-muted">
                    {section}
                  </div>
                  {rows.map(({ item, index }) => (
                    <div
                      key={item.id}
                      id={`palette-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={index === current}
                      onPointerMove={() => {
                        if (index !== current) setActive(index);
                      }}
                      onClick={(event) => run(item, event.metaKey || event.ctrlKey)}
                      className={cn(
                        "flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-1.5 text-label text-fg-soft [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-secondary",
                        index === current && "bg-menu-active text-fg",
                      )}
                    >
                      {item.icon}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.detail !== undefined ? (
                        <span className="max-w-40 shrink-0 truncate text-micro text-fg-muted">
                          {item.detail}
                        </span>
                      ) : null}
                      {item.keys !== undefined ? <Kbd>{item.keys}</Kbd> : null}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-border-muted px-4 py-2 text-micro text-fg-muted">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> to move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> to run
          </span>
          <span className="flex items-center gap-1">
            <Kbd>{shortcutLabel("mod+enter")}</Kbd> to run and stay
          </span>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
