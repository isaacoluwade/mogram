"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, PanelLeftClose, Upload } from "lucide-react";
import {
  LIBRARIES,
  canonicalIconId,
  libraryRank,
  searchIcons,
  type IconEntry,
  type LibraryId,
} from "@mogram/icons";
import { writeProjectFile } from "@mogram/core/edit";
import { joinPath, toName } from "@mogram/core/model";
import {
  CLOUD_CONTAINERS,
  CLOUD_LABELS,
  CONTAINER_STYLE_INFO,
  SHAPES,
  containerName,
  diagramCloud,
  isCloud,
  type Cloud,
  type ContainerStyleName,
} from "@mogram/core/presets";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { LeftTabs } from "../assistant/assistant-panel";
import { SearchField } from "@/components/ui/search-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { preference, setPreference, usePreference, type LibraryTab } from "@/lib/preferences";
import { addComponentAt } from "../actions";
import { LIBRARY_DRAG_TYPE, encodeLibraryDrag } from "../dnd";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { cleanSvg } from "@/features/files/open";
import { defaultLibrary, librariesInUse, offeredLibraries } from "./library-choice";
import { softHyphens } from "./soft-hyphens";
import { AnnotationGrid, ContainerGrid, ShapeGrid, matchingShapes } from "./shapes-section";

/** What the Icons menu shows: a catalog library, or the icons uploaded to this diagram. */
type Source = LibraryId | "mine";

interface LibraryItem {
  readonly id: string;
  readonly name: string;
  readonly kind: "artwork" | "glyph" | "upload";
  readonly src: string;
}

/** Generic icons (users, server, database…) belong in every diagram: they're a Basics tab. */
const BASICS_LIBRARY: LibraryId = "generic";

/** Most recent and used-in-this-diagram icons shown at the top. */
const RECENT_COUNT = 6;

function readRecent(): string[] {
  return [...preference("libraryRecent")].slice(0, 12);
}

function pushRecent(id: string): void {
  setPreference("libraryRecent", [id, ...readRecent().filter((v) => v !== id)].slice(0, 12));
}

function toItem(entry: IconEntry): LibraryItem {
  return {
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    src: `/icons/${entry.library}/${entry.slug}.svg`,
  };
}

const libraryName = (id: LibraryId): string =>
  LIBRARIES.find((library) => library.id === id)?.name ?? id;

/** Container kinds whose names (on this cloud, or anywhere) match the search. */
function matchingContainers(query: string, cloud: Cloud | null): ContainerStyleName[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return CLOUD_CONTAINERS[cloud ?? "any"].filter((kind) => {
    const info = CONTAINER_STYLE_INFO[kind];
    const names = [containerName(kind, "azure"), containerName(kind, "aws")];
    names.push(containerName(kind, "gcp"), info.label, info.description, kind, "container");
    const text = names.join(" ").toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/**
 * The library (ED-2, IC-1 … IC-7, 03-shapes-styles-library §5): one search across everything;
 * Recent; Basics (shapes, containers named for the diagram's cloud, notes, generic icons); and
 * the icons of one library at a time, chosen from a menu, by category.
 */
export function LibraryPanel({ onClose }: { onClose: () => void }) {
  const store = useEditorStore();
  const { files, folder } = useEditorShallow((s) => ({ files: s.files, folder: s.folder }));
  const diagram = useEditor((s) => s.parsed().diagram);
  const offered = useMemo(
    () => offeredLibraries(diagram.settings.libraries),
    [diagram.settings.libraries],
  );
  // The libraries the diagram already uses rank first when results are otherwise equal.
  const inUse = useMemo(() => librariesInUse(diagram), [diagram]);
  const menuLibraries = offered.filter((id) => id !== BASICS_LIBRARY);
  const [catalog, setCatalog] = useState<readonly IconEntry[] | null>(null);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  // Opens on the cloud the diagram is drawn in (an AWS diagram shows AWS icons).
  const [chosen, setChosen] = useState<Source>(() => {
    const opening = store.getState().parsed().diagram;
    const libraries = offeredLibraries(opening.settings.libraries).filter(
      (id) => id !== BASICS_LIBRARY,
    );
    return defaultLibrary(libraries, librariesInUse(opening));
  });
  // A library the diagram's settings stop offering falls back to the default one.
  const source: Source =
    chosen === "mine" || menuLibraries.includes(chosen)
      ? chosen
      : defaultLibrary(menuLibraries, inUse);
  const [category, setCategory] = useState<string | null>(null);
  const tab = usePreference("libraryTab");
  // Containers are named for the cloud being browsed, else the diagram's own.
  const cloud: Cloud | null = isCloud(source) ? source : diagramCloud(diagram);
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

  // Search results, grouped by library: the one being browsed first, then those in use.
  const results = useMemo(() => {
    if (catalog === null || deferredQuery.trim().length === 0) return null;
    const prefer = [...(source === "mine" ? [] : [source]), ...inUse];
    const found = searchIcons(catalog, deferredQuery, { prefer })
      .filter((entry) => offered.includes(entry.library))
      .slice(0, 150);
    const groups = new Map<LibraryId, LibraryItem[]>();
    for (const entry of found) {
      const list = groups.get(entry.library) ?? [];
      list.push(toItem(entry));
      groups.set(entry.library, list);
    }
    const rank = (id: LibraryId) => {
      const preferred = prefer.indexOf(id);
      return preferred === -1 ? 100 + libraryRank(id) : preferred;
    };
    const words = deferredQuery.trim().toLowerCase();
    return {
      shapes: matchingShapes(deferredQuery),
      containers: matchingContainers(deferredQuery, cloud),
      mine: uploads.filter((item) => item.name.toLowerCase().includes(words)),
      icons: [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b)),
    };
  }, [catalog, deferredQuery, source, inUse, offered, uploads, cloud]);

  // One library's icons by category, in catalog order.
  const categories = useMemo(() => {
    if (catalog === null || source === "mine") return [];
    const groups = new Map<string, LibraryItem[]>();
    for (const entry of catalog) {
      if (entry.library !== source) continue;
      const list = groups.get(entry.category) ?? [];
      list.push(toItem(entry));
      groups.set(entry.category, list);
    }
    return [...groups.entries()];
  }, [catalog, source]);

  // Group icons drawn in the text colour (AWS Cloud) rather than as artwork.
  const glyphs = useMemo(
    () => new Set((catalog ?? []).filter((entry) => entry.kind === "glyph").map((e) => e.id)),
    [catalog],
  );
  const isGlyph = (icon: string) => glyphs.has(icon);

  const generic = useMemo(
    () =>
      catalog === null
        ? []
        : catalog.filter((entry) => entry.library === BASICS_LIBRARY).map(toItem),
    [catalog],
  );

  // What was added lately, then what this diagram already uses: the quickest way back to them.
  const recentItems = useMemo(() => {
    if (catalog === null) return [];
    const byId = new Map(catalog.map((entry) => [entry.id, entry]));
    const used = [...diagram.components.values()]
      .filter((component) => component.shape === null)
      .map((component) => canonicalIconId(component.type));
    return [...new Set([...recent, ...used])]
      .map((id) => byId.get(id))
      .filter((e): e is IconEntry => e !== undefined && offered.includes(e.library))
      .slice(0, RECENT_COUNT)
      .map(toItem);
  }, [catalog, recent, diagram, offered]);

  const add = (item: LibraryItem) => {
    addComponentAt(store, item.id, item.name, null);
    if (item.kind !== "upload") {
      pushRecent(item.id);
      setRecent(readRecent());
    }
  };

  const choose = (next: Source) => {
    setChosen(next);
    setCategory(null);
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
      choose("mine");
      store
        .getState()
        .notify(`${file.name} is in this diagram's icons folder. Drag it onto the canvas.`);
    }
  };

  const open = category === null ? null : categories.find(([name]) => name === category);

  return (
    <Panel
      role="region"
      className="flex h-full w-full flex-col overflow-hidden"
      aria-label="Icon library"
    >
      <PanelHeader>
        <LeftTabs current="library" />
        <IconButton label="Hide library" size="sm" onClick={onClose}>
          <PanelLeftClose />
        </IconButton>
      </PanelHeader>
      <div className="px-3 pt-3">
        <SearchField
          placeholder="Search shapes and icons"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search shapes and icons"
          className="min-h-9"
        />
      </div>
      <input
        ref={upload}
        type="file"
        accept=".svg,image/svg+xml"
        hidden
        onChange={(event) => void onUpload(event.target.files)}
      />
      {/*
        Padded inside the scrolling area, so the first row (and its focus ring) never sits
        under the search field.
      */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4 pt-4">
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
        ) : results !== null ? (
          <SearchResults
            results={results}
            query={deferredQuery}
            cloud={cloud}
            glyph={isGlyph}
            onAdd={add}
          />
        ) : (
          <>
            {recentItems.length > 0 ? (
              <Block title="Recent">
                <IconGrid items={recentItems} onAdd={add} label="Recent" />
              </Block>
            ) : null}

            <Block title="Basics">
              <SegmentedControl
                label="Basics"
                size="sm"
                className="mb-3 w-full"
                value={tab}
                onChange={(next: LibraryTab) => setPreference("libraryTab", next)}
                options={[
                  { value: "shapes", label: "Shapes" },
                  { value: "containers", label: "Containers" },
                  { value: "notes", label: "Notes" },
                  { value: "generic", label: "Generic" },
                ]}
              />
              {tab === "shapes" ? (
                <ShapeGrid shapes={SHAPES} />
              ) : tab === "containers" ? (
                <>
                  <ContainerGrid
                    kinds={CLOUD_CONTAINERS[cloud ?? "any"]}
                    cloud={cloud}
                    glyph={isGlyph}
                  />
                  <p className="mt-2 text-micro text-fg-muted">
                    {cloud === null
                      ? "Choose a cloud under Icons to see its names for these."
                      : `Named the ${CLOUD_LABELS[cloud]} way, outermost first.`}
                  </p>
                </>
              ) : tab === "notes" ? (
                <AnnotationGrid />
              ) : catalog === null ? (
                <TileSkeletons />
              ) : (
                <IconGrid items={generic} onAdd={add} label="Generic icons" />
              )}
            </Block>

            <Block
              title="Icons"
              aside={
                <LibraryMenu
                  value={source}
                  libraries={menuLibraries}
                  uploads={uploads.length}
                  onChange={choose}
                />
              }
            >
              {source === "mine" ? (
                <div className="flex flex-col gap-3">
                  {uploads.length === 0 ? (
                    <p className="text-caption text-fg-muted">
                      Upload an SVG to use your own icon. It is saved in this diagram’s icons
                      folder.
                    </p>
                  ) : (
                    <IconGrid items={uploads} onAdd={add} label="Uploaded icons" />
                  )}
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
              ) : catalog === null ? (
                <TileSkeletons />
              ) : open != null ? (
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCategory(null)}
                    className="-mx-1 flex h-8 items-center gap-1.5 rounded-md px-1 text-left text-label text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg [&_svg]:size-4"
                  >
                    <ArrowLeft aria-hidden />
                    <span className="sr-only">Back to {libraryName(source)} categories: </span>
                    <span className="min-w-0 flex-1 truncate">{open[0]}</span>
                    <span className="text-micro tabular-nums text-fg-ghost">{open[1].length}</span>
                  </button>
                  <IconGrid items={open[1]} onAdd={add} label={open[0]} />
                </div>
              ) : (
                <ul role="list" aria-label={`${libraryName(source)} categories`}>
                  {categories.map(([name, items]) => (
                    <li key={name}>
                      <CategoryRow name={name} items={items} onOpen={() => setCategory(name)} />
                    </li>
                  ))}
                </ul>
              )}
            </Block>
          </>
        )}
      </div>
    </Panel>
  );
}

/** A titled part of the panel, with an optional control on the right of its title. */
function Block({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col">
      <div className="mb-2.5 flex h-7 items-center justify-between gap-2">
        <h3 className="text-caption font-medium text-fg-soft">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Which library's icons to browse: one menu instead of a row of filters. */
function LibraryMenu({
  value,
  libraries,
  uploads,
  onChange,
}: {
  value: Source;
  libraries: readonly LibraryId[];
  uploads: number;
  onChange: (source: Source) => void;
}) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Icon library: ${value === "mine" ? "Uploaded" : libraryName(value)}`}
          className="flex h-7 min-w-0 items-center gap-1 rounded-md px-2 text-caption text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg data-[state=open]:bg-fill-active [&_svg]:size-3.5"
        >
          <span className="truncate">{value === "mine" ? "Uploaded" : libraryName(value)}</span>
          <ChevronDown aria-hidden className="shrink-0 text-fg-muted" />
        </button>
      </MenuTrigger>
      <MenuContent align="end" className="w-48">
        <MenuRadioGroup value={value} onValueChange={(next) => onChange(next as Source)}>
          {libraries.map((id) => (
            <MenuRadioItem key={id} value={id}>
              {libraryName(id)}
            </MenuRadioItem>
          ))}
          <MenuSeparator />
          <MenuRadioItem value="mine">Uploaded{uploads > 0 ? ` (${uploads})` : ""}</MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

/** A category of the library being browsed: a glimpse of its icons, its size, and a way in. */
function CategoryRow({
  name,
  items,
  onOpen,
}: {
  name: string;
  items: readonly LibraryItem[];
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${name}, ${items.length} icons`}
      className="group -mx-1 flex h-10 w-[calc(100%+0.5rem)] items-center gap-2.5 rounded-md px-1 text-left transition-colors hover:bg-fill-hover"
    >
      <span aria-hidden className="flex w-16 shrink-0 -space-x-1">
        {items.slice(0, 3).map((item) => (
          <span
            key={item.id}
            className="flex size-6 items-center justify-center rounded-md bg-fill-faint ring-1 ring-sidebar"
          >
            <IconFace item={item} className="size-4" />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1 truncate text-label text-fg-soft group-hover:text-fg">
        {name}
      </span>
      <span className="text-micro tabular-nums text-fg-ghost">{items.length}</span>
      <ChevronRight aria-hidden className="size-3.5 shrink-0 text-fg-muted" />
    </button>
  );
}

/** Search results: shapes and containers first, then icons by library, then uploads. */
function SearchResults({
  results,
  query,
  cloud,
  glyph,
  onAdd,
}: {
  results: {
    readonly shapes: readonly (typeof SHAPES)[number][];
    readonly containers: readonly ContainerStyleName[];
    readonly mine: readonly LibraryItem[];
    readonly icons: readonly (readonly [LibraryId, LibraryItem[]])[];
  };
  query: string;
  cloud: Cloud | null;
  glyph: (icon: string) => boolean;
  onAdd: (item: LibraryItem) => void;
}) {
  const nothing =
    results.shapes.length === 0 &&
    results.containers.length === 0 &&
    results.mine.length === 0 &&
    results.icons.length === 0;
  if (nothing)
    return (
      <p className="px-1 py-6 text-center text-label text-fg-muted">Nothing matches “{query}”.</p>
    );
  return (
    <>
      {results.shapes.length > 0 ? (
        <Block title="Shapes">
          <ShapeGrid shapes={results.shapes} />
        </Block>
      ) : null}
      {results.containers.length > 0 ? (
        <Block title="Containers">
          <ContainerGrid kinds={results.containers} cloud={cloud} glyph={glyph} />
        </Block>
      ) : null}
      {results.icons.map(([library, items]) => (
        <Block
          key={library}
          title={libraryName(library)}
          aside={<span className="text-micro tabular-nums text-fg-ghost">{items.length}</span>}
        >
          <IconGrid items={items} onAdd={onAdd} label={`${libraryName(library)} results`} />
        </Block>
      ))}
      {results.mine.length > 0 ? (
        <Block title="Uploaded">
          <IconGrid items={results.mine} onAdd={onAdd} label="Uploaded results" />
        </Block>
      ) : null}
    </>
  );
}

function TileSkeletons() {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {Array.from({ length: 9 }, (_, i) => (
        <Skeleton key={i} className="h-[74px] rounded-md" />
      ))}
    </div>
  );
}

/** An icon as the library draws it: artwork as is, glyphs in the text colour. */
function IconFace({ item, className }: { item: LibraryItem; className: string }) {
  return item.kind === "glyph" ? (
    <span
      aria-hidden
      className={`${className} bg-fg-soft group-hover:bg-fg`}
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
      className={`${className} object-contain`}
      loading="lazy"
      draggable={false}
    />
  );
}

/** Tiles a grid draws at first, and adds each time its end scrolls near (draw.io's virtual thumbs). */
const TILE_PAGE = 48;

function IconGrid({
  items,
  onAdd,
  label,
}: {
  items: readonly LibraryItem[];
  onAdd: (item: LibraryItem) => void;
  label: string;
}) {
  // A category of hundreds of icons draws a page of tiles, then the next as its end nears the
  // view, so opening one or typing a search stays instant.
  const [shown, setShown] = useState(TILE_PAGE);
  const [forItems, setForItems] = useState(items);
  if (forItems !== items) {
    setForItems(items);
    setShown(TILE_PAGE);
  }
  const more = useRef<HTMLLIElement | null>(null);
  const hasMore = shown < items.length;
  useEffect(() => {
    const sentinel = more.current;
    if (!hasMore || sentinel === null || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setShown((count) => count + TILE_PAGE);
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, shown]);
  return (
    <ul
      className="grid grid-cols-3 gap-1.5"
      role="list"
      aria-label={label}
      data-tiles={items.length}
    >
      {items.slice(0, shown).map((item) => (
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
              <IconFace item={item} className="size-7" />
              {/* Long single words ("Automanaged") hyphenate, or break, rather than being clipped. */}
              <span className="line-clamp-2 w-full text-center text-micro leading-tight text-fg-muted wrap-break-word hyphens-auto group-hover:text-fg-soft">
                {softHyphens(item.name)}
              </span>
            </button>
          </Tooltip>
        </li>
      ))}
      {hasMore ? <li ref={more} aria-hidden data-more-tiles className="col-span-3 h-px" /> : null}
    </ul>
  );
}
