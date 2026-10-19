"use client";

import { use, useMemo, useRef, useState, type DragEvent } from "react";
import {
  addSection,
  addSlide,
  detachSlide,
  duplicateSlide,
  importSlideFiles,
  moveEntries,
  newSlideFolder,
  removeEntries,
  renameSection,
  updateSlide,
  type EditResult,
} from "@mogram/core/edit";
import { diagramFileSet } from "@mogram/core/format";
import type { Diagram, ProjectFiles } from "@mogram/core/model";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  EyeOff,
  FolderOpen,
  Heading,
  Images,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  Scissors,
  SquareArrowOutUpRight,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { AddSlideDialog, type ImportedSlide } from "@/features/deck/add-slide-dialog";
import { useEditor, useEditorShallow, useEditorStore } from "./editor-context";
import { addPictureSlides } from "./actions";
import { insertAfter, railRows, RAIL_DRAG, type RailRow } from "./deck/rail-rows";
import { SlideThumbnail } from "./deck/slide-tile";
import { parseCached, shownFiles, slidesOf } from "./store/editor-store";
import { EditorHostContext } from "./persistence/host";

/**
 * The slide rail (D-100): a deck's slides in order, under their sections. A tile shows a slide's
 * last picture; choosing it edits that slide. Everything here is a change to the deck's list, in
 * the same undo history as every other edit.
 */
export function SlideRail({ onClose }: { readonly onClose?: () => void }) {
  const store = useEditorStore();
  // Diagrams from the account are offered only when there's one to ask.
  const signedIn = use(EditorHostContext)?.signedIn ?? false;
  const { files, deckRoot, root, slide, locked } = useEditorShallow((state) => ({
    files: shownFiles(state),
    deckRoot: state.deckRoot,
    root: state.root,
    slide: state.slide,
    locked: state.busy !== null || state.viewing !== null || state.assistant !== null,
  }));
  const deckDiagram = useEditor((state) =>
    state.deckRoot === null ? null : parseCached(shownFiles(state), state.deckRoot).diagram,
  );
  const deck = deckDiagram?.settings.deck ?? null;
  const slides = useMemo(
    () => (deckRoot === null ? [] : slidesOf(files, deckRoot)),
    [files, deckRoot],
  );
  const rows = useMemo(
    () =>
      deck === null
        ? []
        : railRows(deck, slides, (folder) =>
            diagramFileSet(files, folder) === null
              ? null
              : parseCached(files, folder).diagram.settings.name,
          ),
    [deck, slides, files],
  );
  // Folded sections, by title: a title stays the same as entries move round it.
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
  const [renaming, setRenaming] = useState<number | null>(null);
  // A rename started from a menu keeps the focus: the menu closing mustn't take it back.
  const renameNext = useRef(false);
  const startRename = (item: number) => {
    renameNext.current = true;
    setRenaming(item);
  };
  const keepRenameFocus = (event: Event) => {
    if (!renameNext.current) return;
    renameNext.current = false;
    event.preventDefault();
  };
  const [adding, setAdding] = useState(false);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const pictures = useRef<HTMLInputElement | null>(null);

  if (deckRoot === null || deckDiagram === null || deck === null) return null;
  const onDeck = slide === null && root === deckRoot;
  const lastItem = deck.entries.at(-1)?.item ?? -1;

  /** Runs a command on the deck, as it is when it runs. */
  const editDeck = (
    label: string,
    run: (current: ProjectFiles, diagram: Diagram) => EditResult,
  ): boolean =>
    store.getState().edit(label, (current) => run(current, parseCached(current, deckRoot).diagram));

  const show = (item: number | null) => store.getState().showSlide(item);
  const at = insertAfter(deck, slide);

  const move = (items: readonly number[], to: number) => {
    const chosen = items[0];
    if (chosen === undefined || to === chosen || to === chosen + 1) return;
    const wasShowing = items.includes(slide ?? -1) ? slide : null;
    if (
      !editDeck("Move slides", (current, diagram) => moveEntries(current, diagram, { items, to }))
    )
      return;
    if (wasShowing !== null) show(to > wasShowing ? to - 1 : to);
  };

  const remove = (item: number) => {
    if (
      !editDeck("Delete from deck", (current, diagram) =>
        removeEntries(current, diagram, { items: [item] }),
      )
    )
      return;
    if (item !== slide) return;
    // The slide before, else the one after, else the deck itself.
    const after =
      parseCached(store.getState().files, deckRoot).diagram.settings.deck?.entries ?? [];
    const near =
      after.filter((entry) => entry.kind === "slide" && entry.item < item).at(-1) ??
      after.find((entry) => entry.kind === "slide");
    show(near?.item ?? null);
  };

  const onDrop = (event: DragEvent, to: number) => {
    setDropAt(null);
    if (!event.dataTransfer.types.includes(RAIL_DRAG)) return;
    event.preventDefault();
    const from = Number(event.dataTransfer.getData(RAIL_DRAG));
    if (Number.isInteger(from)) move([from], to);
  };
  const onDragOver = (event: DragEvent, to: number) => {
    if (locked || !event.dataTransfer.types.includes(RAIL_DRAG)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropAt !== to) setDropAt(to);
  };

  const sectionOf = (row: RailRow) => (row.kind === "slide" ? row.section : null);
  const visible = rows.filter((row) => {
    const section = sectionOf(row);
    return row.kind === "section" || section === null || !folded.has(section);
  });

  return (
    <>
      <Panel
        className="flex h-full w-full flex-col overflow-hidden"
        role="region"
        aria-label="Slides"
        data-testid="slide-rail"
      >
        <div className="flex shrink-0 items-center gap-1 border-b border-border-subtle p-2">
          <button
            type="button"
            aria-current={onDeck ? "page" : undefined}
            data-testid="deck-select"
            onClick={() => show(null)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-fill-hover",
              onDeck && "bg-fill-active",
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-fill-subtle text-fg-secondary">
              <Layers aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-micro text-fg-muted">
                Deck · {slides.length} {slides.length === 1 ? "slide" : "slides"}
              </span>
              <span className="block truncate text-caption font-medium text-fg">
                {deckDiagram.settings.name}
              </span>
            </span>
          </button>
          {onClose !== undefined ? (
            <IconButton label="Close slides" size="sm" onClick={onClose}>
              <X />
            </IconButton>
          ) : null}
        </div>

        <ul
          className="min-h-0 flex-1 overflow-y-auto px-2 py-2 [scrollbar-gutter:stable]"
          aria-label="Slides in order"
        >
          {visible.map((row) =>
            row.kind === "section" ? (
              <li
                key={`section-${row.item}`}
                className={cn(
                  "group/section mb-1 flex items-center gap-1 rounded-sm",
                  dropAt === row.item && "shadow-[inset_0_2px_0_var(--color-fg-soft)]",
                )}
                onDragOver={(event) => onDragOver(event, row.item)}
                onDragLeave={() => setDropAt(null)}
                onDrop={(event) => onDrop(event, row.item)}
              >
                {renaming === row.item ? (
                  <SectionName
                    title={row.title}
                    onDone={(title) => {
                      setRenaming(null);
                      if (title !== null && title !== row.title)
                        editDeck("Rename section", (current, diagram) =>
                          renameSection(current, diagram, { item: row.item, title }),
                        );
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    // Its name is its title; whether it's open is said by aria-expanded.
                    aria-label={row.title}
                    aria-expanded={!folded.has(row.title)}
                    onClick={() =>
                      setFolded((was) => {
                        const next = new Set(was);
                        if (next.has(row.title)) next.delete(row.title);
                        else next.add(row.title);
                        return next;
                      })
                    }
                    className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-sm px-1 text-left text-caption font-medium text-fg-soft transition-colors hover:bg-fill-hover"
                  >
                    {folded.has(row.title) ? (
                      <ChevronRight aria-hidden className="size-4 shrink-0" />
                    ) : (
                      <ChevronDown aria-hidden className="size-4 shrink-0" />
                    )}
                    <span className="truncate">{row.title}</span>
                    {folded.has(row.title) ? (
                      <span className="ml-auto pr-1 text-micro tabular-nums text-fg-muted">
                        {row.count}
                      </span>
                    ) : null}
                  </button>
                )}
                <Menu>
                  <MenuTrigger asChild>
                    <IconButton label={`Section "${row.title}"`} size="sm" disabled={locked}>
                      <MoreHorizontal />
                    </IconButton>
                  </MenuTrigger>
                  <MenuContent align="end" className="w-48" onCloseAutoFocus={keepRenameFocus}>
                    <MenuItem icon={<Pencil />} onSelect={() => startRename(row.item)}>
                      Rename
                    </MenuItem>
                    <MenuItem
                      icon={<ArrowUp />}
                      disabled={row.item === 0}
                      onSelect={() => move([row.item], row.item - 1)}
                    >
                      Move up
                    </MenuItem>
                    <MenuItem
                      icon={<ArrowDown />}
                      disabled={row.item >= lastItem}
                      onSelect={() => move([row.item], row.item + 2)}
                    >
                      Move down
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => remove(row.item)}>
                      Remove section
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </li>
            ) : (
              <li
                key={`slide-${row.item}`}
                draggable={!locked}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(RAIL_DRAG, String(row.item));
                }}
                onDragEnd={() => setDropAt(null)}
                onDragOver={(event) => onDragOver(event, row.item)}
                onDragLeave={() => setDropAt(null)}
                onDrop={(event) => onDrop(event, row.item)}
                className={cn(
                  "group/slide relative mb-2 rounded-md border p-1 transition-colors",
                  row.item === slide
                    ? "border-border-emphasis bg-fill-active"
                    : "border-border-subtle hover:border-border-strong",
                  dropAt === row.item && "shadow-[0_-3px_0_var(--color-fg-soft)]",
                )}
              >
                <button
                  type="button"
                  aria-current={row.item === slide ? "page" : undefined}
                  aria-label={`${row.slide === null ? "Skipped slide" : `Slide ${row.slide.number}`}: ${row.title}`}
                  onClick={() => show(row.item)}
                  className="flex w-full flex-col gap-1.5 text-left"
                >
                  <span
                    className={cn(
                      "relative block aspect-video w-full overflow-hidden rounded-sm bg-canvas",
                      row.slide === null && "opacity-50",
                    )}
                  >
                    {row.slide !== null ? (
                      <SlideThumbnail
                        files={files}
                        deck={deckDiagram}
                        slide={row.slide}
                        count={slides.length}
                        frame={row.slide.frame ? deck.frame : null}
                      />
                    ) : null}
                    {row.entry.skip ? (
                      <Badge className="absolute bottom-1 left-1" tone="neutral">
                        <EyeOff aria-hidden /> Skipped
                      </Badge>
                    ) : null}
                  </span>
                  <span className="flex min-w-0 items-baseline gap-1.5 px-1 pb-0.5">
                    <span className="shrink-0 text-micro tabular-nums text-fg-muted">
                      {row.slide?.number ?? "–"}
                    </span>
                    <span className="truncate text-caption text-fg-soft">{row.title}</span>
                  </span>
                </button>
                <Menu>
                  <MenuTrigger asChild>
                    <IconButton
                      label={
                        row.slide === null
                          ? `Options for skipped slide ${row.title}`
                          : `Options for slide ${row.slide.number}`
                      }
                      size="sm"
                      disabled={locked}
                      className="absolute right-1.5 top-1.5 bg-overlay"
                    >
                      <MoreHorizontal />
                    </IconButton>
                  </MenuTrigger>
                  <MenuContent align="end" className="w-56">
                    <MenuLabel>{row.title}</MenuLabel>
                    <MenuItem
                      icon={<ArrowUp />}
                      disabled={row.item === 0}
                      onSelect={() => move([row.item], row.item - 1)}
                    >
                      Move up
                    </MenuItem>
                    <MenuItem
                      icon={<ArrowDown />}
                      disabled={row.item >= lastItem}
                      onSelect={() => move([row.item], row.item + 2)}
                    >
                      Move down
                    </MenuItem>
                    <MenuItem
                      icon={<Copy />}
                      onSelect={() => {
                        if (
                          editDeck("Duplicate slide", (current, diagram) =>
                            duplicateSlide(current, diagram, { item: row.item }),
                          )
                        )
                          show(row.item + 1);
                      }}
                    >
                      Duplicate
                    </MenuItem>
                    <MenuItem
                      icon={<Scissors />}
                      description="Its own copy of the diagram"
                      onSelect={() => {
                        if (
                          editDeck("Detach slide", (current, diagram) =>
                            detachSlide(current, diagram, { item: row.item }),
                          )
                        )
                          show(row.item);
                      }}
                    >
                      Detach
                    </MenuItem>
                    <MenuItem
                      icon={<EyeOff />}
                      checked={row.entry.skip}
                      onSelect={() =>
                        editDeck(row.entry.skip ? "Show slide" : "Skip slide", (current, diagram) =>
                          updateSlide(current, diagram, {
                            item: row.item,
                            patch: { skip: !row.entry.skip },
                          }),
                        )
                      }
                    >
                      Skip when playing
                    </MenuItem>
                    <MenuItem
                      icon={<SquareArrowOutUpRight />}
                      onSelect={() =>
                        window.open(
                          `${window.location.pathname}?root=${encodeURIComponent(row.entry.folder).replace(/%2F/g, "/")}`,
                          "_blank",
                          "noopener",
                        )
                      }
                    >
                      Show in its own window
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => remove(row.item)}>
                      Remove from deck
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </li>
            ),
          )}
          <li
            aria-hidden
            className={cn(
              "h-6 rounded-sm",
              dropAt === lastItem + 1 && "shadow-[inset_0_2px_0_var(--color-fg-soft)]",
            )}
            onDragOver={(event) => onDragOver(event, lastItem + 1)}
            onDragLeave={() => setDropAt(null)}
            onDrop={(event) => onDrop(event, lastItem + 1)}
          />
          {rows.length === 0 ? (
            <li className="px-2 py-4 text-caption text-fg-muted">
              No slides yet. Add one below: a blank page, a diagram, a template or a concept.
            </li>
          ) : null}
        </ul>

        <div className="flex shrink-0 items-center gap-2 border-t border-border-subtle p-2">
          <Menu>
            <MenuTrigger
              disabled={locked}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "min-w-0 flex-1")}
            >
              <Plus aria-hidden />
              Add
            </MenuTrigger>
            <MenuContent
              side="top"
              align="start"
              className="w-60"
              onCloseAutoFocus={keepRenameFocus}
            >
              <MenuItem
                icon={<Plus />}
                onSelect={() => {
                  let made: string | null = null;
                  if (
                    editDeck("Add slide", (current, diagram) => {
                      const result = newSlideFolder(current, diagram, { at });
                      made = result.folder;
                      return result;
                    }) &&
                    made !== null
                  )
                    show(at);
                }}
              >
                Blank slide
              </MenuItem>
              <MenuItem
                icon={<FolderOpen />}
                description="A diagram, a template or a concept"
                onSelect={() => setAdding(true)}
              >
                Choose a slide…
              </MenuItem>
              <MenuItem
                icon={<Images />}
                description="One slide for each"
                onSelect={() => pictures.current?.click()}
              >
                Pictures…
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<Heading />}
                onSelect={() => {
                  if (
                    editDeck("Add section", (current, diagram) =>
                      addSection(current, diagram, { title: "New section", at }),
                    )
                  )
                    startRename(at);
                }}
              >
                Section
              </MenuItem>
            </MenuContent>
          </Menu>
          <input
            ref={pictures}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,.gif"
            className="hidden"
            onChange={(event) => {
              const chosen = [...(event.target.files ?? [])];
              event.target.value = "";
              if (chosen.length > 0)
                void addPictureSlides(store, chosen, at).catch((error: unknown) =>
                  store
                    .getState()
                    .notify(
                      error instanceof Error ? error.message : "Those pictures couldn't be added.",
                      "error",
                    ),
                );
            }}
          />
        </div>
      </Panel>
      <AddSlideDialog
        open={adding}
        onOpenChange={setAdding}
        files={files}
        deckRoot={deckRoot}
        signedIn={signedIn}
        onAddExisting={(folder) => {
          const ok = editDeck("Add slide", (current, diagram) =>
            addSlide(current, diagram, { folder, at }),
          );
          if (ok) show(at);
          return ok;
        }}
        onImport={(project: ImportedSlide) => {
          const ok = editDeck("Add slide", (current, diagram) =>
            importSlideFiles(current, diagram, {
              files: project.files,
              name: project.name,
              at,
              ...(project.origin === undefined ? {} : { origin: project.origin }),
            }),
          );
          if (ok) show(at);
          return ok;
        }}
      />
    </>
  );
}

/** A section's title being renamed in place: Enter keeps it, Escape doesn't. */
function SectionName({ title, onDone }: { title: string; onDone: (title: string | null) => void }) {
  const [value, setValue] = useState(title);
  return (
    <Input
      autoFocus
      aria-label="Section title"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onDone(value.trim() === "" ? null : value.trim())}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") onDone(value.trim() === "" ? null : value.trim());
        if (event.key === "Escape") onDone(null);
      }}
      className="h-9 min-w-0 flex-1 text-caption font-medium"
    />
  );
}
