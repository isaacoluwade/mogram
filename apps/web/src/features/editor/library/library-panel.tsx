"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, PanelLeftClose, Upload } from "lucide-react";
import { LIBRARIES, searchIcons, type IconEntry, type LibraryId } from "@mogram/icons";
import { writeProjectFile } from "@mogram/core/edit";
import { joinPath, toName } from "@mogram/core/model";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { addComponentAt } from "../actions";
import { LIBRARY_DRAG_TYPE, encodeLibraryDrag } from "../dnd";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { cleanSvg } from "@/features/files/open";
import { defaultLibrary, librariesInUse, offeredLibraries } from "./library-choice";
import { softHyphens } from "./soft-hyphens";

type Filter = LibraryId | "all" | "mine";

interface LibraryItem {
  readonly id: string;
  readonly name: string;
  readonly kind: "artwork" | "glyph" | "upload";
  readonly src: string;
}

const RECENT_KEY = "mogram.library.recent";

function readRecent(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string").slice(0, 12)
      : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string): void {
  try {
    const next = [id, ...readRecent().filter((v) => v !== id)].slice(0, 12);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode); recents are a convenience only.
  }
}

function toItem(entry: IconEntry): LibraryItem {
  return {
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    src: `/icons/${entry.library}/${entry.slug}.svg`,
  };
}

/** Sections open the first time the panel shows them: the busiest areas of each library. */
const OPEN_SECTIONS = [
  "Compute",
  "Networking",
  "Networking & Content Delivery",
  "Workloads",
  "Generic",
  "Tool logos",
];

/** The icon library (ED-2, IC-1 … IC-7): one search across every library, drag or click to add. */
export function LibraryPanel({ onClose }: { onClose: () => void }) {
  const store = useEditorStore();
  const { files, folder } = useEditorShallow((s) => ({ files: s.files, folder: s.folder }));
  const diagram = useEditor((s) => s.parsed().diagram);
  const offered = useMemo(
    () => offeredLibraries(diagram.settings.libraries),
    [diagram.settings.libraries],
  );
  // The providers the diagram already uses rank first when results are otherwise equal.
  const inUse = useMemo(() => librariesInUse(diagram), [diagram]);
  const [catalog, setCatalog] = useState<readonly IconEntry[] | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  // Opens on the cloud the diagram is drawn in (an AWS diagram shows AWS icons first).
  const [chosen, setFilter] = useState<Filter>(() => {
    const opening = store.getState().parsed().diagram;
    return defaultLibrary(offeredLibraries(opening.settings.libraries), librariesInUse(opening));
  });
  // A library the diagram's settings stop offering falls back to the default one.
  const filter: Filter =
    chosen === "all" || chosen === "mine" || offered.includes(chosen)
      ? chosen
      : defaultLibrary(offered, inUse);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set(OPEN_SECTIONS));
  // The library only renders in the browser (the editor mounts after hydration).
  const [recent, setRecent] = useState<string[]>(readRecent);
  const upload = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    import("@mogram/icons/catalog").then(
      (module) => {
        if (alive) setCatalog(module.ICONS);
      },
      () => {
        // Offline, or a new deploy removed the old chunk: say so instead of loading forever.
        if (alive) setCatalogFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  const uploads = useMemo<LibraryItem[]>(() => {
    const prefix = folder.length > 0 ? `${folder}/icons/` : "icons/";
    return Object.entries(files)
      .filter(([path]) => path.startsWith(prefix) && path.toLowerCase().endsWith(".svg"))
      .map(([path, svg]) => ({
        id: path.slice(folder.length > 0 ? folder.length + 1 : 0),
        name: path
          .slice(prefix.length)
          .replace(/\.svg$/i, "")
          .replace(/[-_]+/g, " "),
        kind: "upload" as const,
        src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      }));
  }, [files, folder]);

  const results = useMemo(() => {
    if (catalog === null || deferredQuery.trim().length === 0) return null;
    const library = filter === "all" || filter === "mine" ? undefined : filter;
    const found = searchIcons(catalog, deferredQuery, {
      ...(library ? { library } : {}),
      prefer: inUse,
    })
      .filter((entry) => offered.includes(entry.library))
      .slice(0, 120)
      .map(toItem);
    const mine = uploads.filter((item) =>
      item.name.toLowerCase().includes(deferredQuery.trim().toLowerCase()),
    );
    return filter === "mine" ? mine : [...mine, ...found];
  }, [catalog, deferredQuery, filter, uploads, inUse, offered]);

  const categories = useMemo(() => {
    if (catalog === null || filter === "mine") return [];
    const libraries: readonly LibraryId[] = filter === "all" ? offered : [filter];
    const groups = new Map<string, LibraryItem[]>();
    for (const entry of catalog) {
      if (!libraries.includes(entry.library)) continue;
      const key =
        filter === "all"
          ? (LIBRARIES.find((l) => l.id === entry.library)?.name ?? entry.library)
          : entry.category;
      const list = groups.get(key) ?? [];
      list.push(toItem(entry));
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [catalog, filter, offered]);

  const recentItems = useMemo(() => {
    if (catalog === null) return [];
    const byId = new Map(catalog.map((entry) => [entry.id, entry]));
    return recent
      .map((id) => byId.get(id))
      .filter((e): e is IconEntry => e !== undefined)
      .map(toItem);
  }, [catalog, recent]);

  const add = (item: LibraryItem) => {
    addComponentAt(store, item.id, item.name, null);
    if (item.kind !== "upload") {
      pushRecent(item.id);
      setRecent(readRecent());
    }
  };

  const onUpload = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (file === undefined) return;
    if (file.size > 500_000) {
      store.getState().notify("Icons can be at most 500 KB.", "error");
      return;
    }
    const clean = cleanSvg(await file.text());
    if (clean === null) {
      store.getState().notify(`${file.name} isn't an SVG Mogram can use.`, "error");
      return;
    }
    const slug = toName(file.name.replace(/\.svg$/i, ""), "icon").replace(/_/g, "-");
    const path = joinPath(folder, "icons", `${slug}.svg`);
    const ok = store
      .getState()
      .edit("Upload icon", (f, d) => writeProjectFile(f, d, { path, content: clean }));
    if (ok) {
      setFilter("mine");
      store
        .getState()
        .notify(`${file.name} is in this diagram's icons folder. Drag it onto the canvas.`);
    }
  };

  const toggle = (name: string) => {
    const next = new Set(open);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setOpen(next);
  };

  // Broadest first: everything, each library, then the diagram's own uploads.
  const filters: { id: Filter; label: string; title?: string }[] = [
    { id: "all", label: "All" },
    ...LIBRARIES.filter((library) => offered.includes(library.id)).map((library) => ({
      id: library.id,
      label: library.shortName,
      title: library.description,
    })),
    { id: "mine", label: "Mine", title: "Icons uploaded to this diagram" },
  ];

  return (
    <Panel
      role="region"
      className="flex h-full w-full flex-col overflow-hidden"
      aria-label="Icon library"
    >
      <PanelHeader>
        <PanelTitle>Library</PanelTitle>
        <IconButton label="Hide library" size="sm" onClick={onClose}>
          <PanelLeftClose />
        </IconButton>
      </PanelHeader>
      <div className="flex flex-col gap-2.5 px-3 pb-2 pt-3">
        <SearchField
          placeholder="Search icons, e.g. vm, s3, pod"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search icons"
          className="min-h-9"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Libraries">
          {filters.map((item) => (
            <Chip
              key={item.id}
              selected={filter === item.id}
              title={item.title}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {catalog === null && catalogFailed ? (
          <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
            <p className="text-label text-fg-muted">The icon library couldn’t load.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCatalogFailed(false);
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : catalog === null ? (
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="h-[74px] rounded-md" />
            ))}
          </div>
        ) : results !== null ? (
          results.length === 0 ? (
            <p className="px-1 py-6 text-center text-label text-fg-muted">
              No icons match “{deferredQuery}”.
            </p>
          ) : (
            <IconGrid items={results} onAdd={add} />
          )
        ) : filter === "mine" ? (
          uploads.length === 0 ? (
            <p className="px-1 py-6 text-center text-label text-fg-muted">
              Upload an SVG to use your own icon. It is saved in this diagram’s icons folder.
            </p>
          ) : (
            <IconGrid items={uploads} onAdd={add} />
          )
        ) : (
          <>
            {recentItems.length > 0 ? (
              <Section title="Recent" open={open.has("Recent")} onToggle={() => toggle("Recent")}>
                <IconGrid items={recentItems} onAdd={add} />
              </Section>
            ) : null}
            {categories.map(([name, items]) => (
              <Section
                key={name}
                title={name}
                count={items.length}
                open={open.has(name)}
                onToggle={() => toggle(name)}
              >
                <IconGrid items={items} onAdd={add} />
              </Section>
            ))}
          </>
        )}
      </div>
      <div className="border-t border-border-muted p-2.5">
        <input
          ref={upload}
          type="file"
          accept=".svg,image/svg+xml"
          hidden
          onChange={(event) => void onUpload(event.target.files)}
        />
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => upload.current?.click()}
        >
          <Upload />
          Upload SVG icon
        </Button>
      </div>
    </Panel>
  );
}

function Section({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border-subtle last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex h-9 w-full items-center gap-2 px-1 text-left text-label text-fg-soft transition-colors hover:text-fg"
      >
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-fg-muted transition-transform",
            !open && "-rotate-90",
          )}
        />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {count !== undefined ? (
          <span className="text-micro tabular-nums text-fg-ghost">{count}</span>
        ) : null}
      </button>
      {open ? <div className="pb-2.5">{children}</div> : null}
    </section>
  );
}

function IconGrid({
  items,
  onAdd,
}: {
  items: readonly LibraryItem[];
  onAdd: (item: LibraryItem) => void;
}) {
  return (
    <ul className="grid grid-cols-3 gap-1.5" role="list">
      {items.map((item) => (
        <li key={item.id}>
          <Tooltip content={item.name} side="right">
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  LIBRARY_DRAG_TYPE,
                  encodeLibraryDrag({ type: item.id, label: item.name }),
                );
                event.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onAdd(item)}
              aria-label={`Add ${item.name}`}
              className="group flex h-[74px] w-full flex-col items-center justify-center gap-1.5 rounded-md border border-transparent bg-fill-faint px-1.5 transition-colors hover:border-border hover:bg-fill-hover"
            >
              {item.kind === "glyph" ? (
                <span
                  aria-hidden
                  className="size-7 bg-fg-soft group-hover:bg-fg"
                  style={{
                    maskImage: `url(${item.src})`,
                    WebkitMaskImage: `url(${item.src})`,
                    maskSize: "contain",
                    maskRepeat: "no-repeat",
                    maskPosition: "center",
                  }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG icons; next/image adds no value here
                <img
                  src={item.src}
                  alt=""
                  className="size-7 object-contain"
                  loading="lazy"
                  draggable={false}
                />
              )}
              {/* Long single words ("Automanaged") hyphenate, or break, rather than being clipped. */}
              <span className="line-clamp-2 w-full text-center text-micro leading-tight text-fg-muted wrap-break-word hyphens-auto group-hover:text-fg-soft">
                {softHyphens(item.name)}
              </span>
            </button>
          </Tooltip>
        </li>
      ))}
    </ul>
  );
}
