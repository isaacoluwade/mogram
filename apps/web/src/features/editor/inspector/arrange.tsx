"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalJustifyCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalJustifyCenter,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronsDown,
  ChevronsUp,
  Group,
  Pin,
  Shrink,
  Ungroup,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import {
  deleteElements,
  isLocked,
  moveElements,
  type Move,
  type ZOrderMove,
} from "@mogram/core/edit";
import { computeLayout, descendantsOf, type LayoutResult } from "@mogram/core/layout";
import type { Diagram } from "@mogram/core/model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { PropertyRow } from "@/components/ui/property-row";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  align,
  canZOrder,
  distribute,
  fitToContents,
  following,
  groupSelection,
  isResizable,
  relativeTo,
  resizeTo,
  toggleLock,
  zOrder,
} from "../actions";
import type { SelectionInfo } from "../commands/selection";
import { useEditor, useEditorStore } from "../editor-context";
import { FieldRow, InspectorSection, NumberField } from "./fields";

const MOVES: readonly { move: ZOrderMove; label: string; icon: ReactNode }[] = [
  { move: "back", label: "Send to back", icon: <ChevronsDown /> },
  { move: "backward", label: "Send backward", icon: <ArrowDownToLine /> },
  { move: "forward", label: "Bring forward", icon: <ArrowUpToLine /> },
  { move: "front", label: "Bring to front", icon: <ChevronsUp /> },
];

/**
 * Z-order for the selection (ED-23), also reachable here so touch screens don't depend on a
 * long-press menu. Moves that would change nothing are disabled.
 */
export function ArrangeRow({ bare = false }: { bare?: boolean }) {
  const store = useEditorStore();
  // Re-evaluate when the files or the selection change.
  useEditor((s) => s.files);
  useEditor((s) => s.selection);
  const buttons = (
    <div className="flex gap-0.5">
      {MOVES.map(({ move, label, icon }) => (
        <IconButton
          key={move}
          label={label}
          size="sm"
          disabled={!canZOrder(store, move)}
          onClick={() => zOrder(store, move)}
        >
          {icon}
        </IconButton>
      ))}
    </div>
  );
  return bare ? buttons : <PropertyRow label="Order">{buttons}</PropertyRow>;
}

/** One value shared by every name, or null when they differ (or there are none). */
function shared<T>(names: readonly string[], pick: (name: string) => T | undefined): T | null {
  const values = names.map(pick);
  const first = values[0];
  return first !== undefined && values.every((v) => v === first) ? first : null;
}

/**
 * The Arrange tab (04-format-panel §16.3): where things sit and how big they are, in grid units
 * relative to their container, which container holds them, their order, alignment, grouping and
 * lock. Every field writes to every selected element it applies to, and bends follow.
 */
export function ArrangeTab({ diagram, sel }: { diagram: Diagram; sel: SelectionInfo }) {
  const store = useEditorStore();
  const layout = useMemo(() => computeLayout(diagram), [diagram]);
  const placed = sel.names.filter((name) => layout.elements.has(name) && !diagram.groups.has(name));
  const resizable = placed.filter((name) => isResizable(diagram, name));
  const lockable = sel.names.filter((name) => !diagram.groups.has(name));
  const allLocked = lockable.length > 0 && lockable.every((name) => isLocked(diagram, name));
  const movable = placed.filter((name) => !isLocked(diagram, name));

  /** A typed value is one undo step; ↑/↓ steps on the same field fold into one. */
  const move = (
    step: boolean,
    change: (at: { x: number; y: number }) => { x: number; y: number },
  ) => {
    const moves: Move[] = movable.flatMap((name) => {
      const element = layout.elements.get(name);
      return element === undefined
        ? []
        : [{ name, parent: element.parent, at: change(element.rel) }];
    });
    if (moves.length === 0) return;
    store.getState().edit(
      step ? "Step position" : "Set position",
      following(store, (files, d) => moveElements(files, d, moves)),
      { coalesce: step },
    );
  };

  return (
    <>
      {sel.names.length > 1 ? <AlignSection count={placed.length} /> : null}
      {placed.length > 0 ? (
        <InspectorSection
          id="position"
          title={placed.length > 1 ? `Position · ${placed.length} elements` : "Position"}
          aside={
            placed.length === 1 && diagram.layout.get(placed[0] ?? "")?.at == null ? (
              <Badge tone="neutral" size="sm" title="Placed automatically. Moving it pins it.">
                Auto
              </Badge>
            ) : null
          }
        >
          <div className="flex gap-2">
            <NumberField
              label="X"
              value={shared(placed, (n) => layout.elements.get(n)?.rel.x)}
              onCommit={(x, step) => move(step, (at) => ({ x, y: at.y }))}
            />
            <NumberField
              label="Y"
              value={shared(placed, (n) => layout.elements.get(n)?.rel.y)}
              onCommit={(y, step) => move(step, (at) => ({ x: at.x, y }))}
            />
          </div>
          {resizable.length > 0 ? (
            <div className="mt-2 flex gap-2">
              <NumberField
                label="W"
                min={1}
                value={shared(resizable, (n) => layout.elements.get(n)?.size.w)}
                onCommit={(w, step) => resizeTo(store, "w", w, step)}
              />
              <NumberField
                label="H"
                min={1}
                value={shared(resizable, (n) => layout.elements.get(n)?.size.h)}
                onCommit={(h, step) => resizeTo(store, "h", h, step)}
              />
            </div>
          ) : null}
          <p className="mt-2 text-micro text-fg-muted">
            Grid units of 8 px from the top-left of {placed.length === 1 ? "its" : "their"}{" "}
            container. ↑ ↓ step by 1, Shift by 10.
          </p>
          {sel.containers.length > 0 ? (
            <ContainerSize diagram={diagram} names={sel.containers} />
          ) : null}
        </InspectorSection>
      ) : null}
      {sel.single !== null && placed.length === 1 ? (
        <InsideSection diagram={diagram} layout={layout} name={sel.single} />
      ) : null}
      {sel.stackable ? (
        <InspectorSection id="order" title="Order" aside={<ArrangeRow bare />}>
          <p className="text-caption text-fg-muted">
            Back, backward, forward and front among the things beside it.
          </p>
        </InspectorSection>
      ) : null}
      {sel.placeables.length > 0 || sel.groups.length > 0 ? (
        <InspectorSection id="grouping" title="Grouping">
          <div className="flex flex-col gap-1.5">
            {sel.placeables.length > 0 ? (
              <Button variant="secondary" size="sm" onClick={() => groupSelection(store)}>
                <Group /> Group {sel.placeables.length > 1 ? "selection" : "it"}
              </Button>
            ) : null}
            {sel.groups.length > 0 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  store
                    .getState()
                    .edit("Ungroup", (files, d) => deleteElements(files, d, sel.groups))
                }
              >
                <Ungroup /> Ungroup
              </Button>
            ) : null}
            {sel.kind === "group" ? (
              <p className="text-caption text-fg-muted">
                A group is drawn around its members wherever they sit, so it has no position.
              </p>
            ) : null}
          </div>
        </InspectorSection>
      ) : null}
      {lockable.length > 0 ? (
        <InspectorSection id="lock" title="Lock">
          <FieldRow label="Locked">
            <Switch
              aria-label="Locked"
              checked={allLocked}
              onCheckedChange={() => toggleLock(store)}
            />
          </FieldRow>
          <p className="mt-1.5 text-caption text-fg-muted">
            Locked elements can be selected and restyled, but not moved, resized or deleted.
          </p>
        </InspectorSection>
      ) : null}
    </>
  );
}

function AlignSection({ count }: { count: number }) {
  const store = useEditorStore();
  const tools: readonly { label: string; icon: ReactNode; run: () => void; min: number }[] = [
    { label: "Align left", icon: <AlignStartVertical />, run: () => align(store, "left"), min: 2 },
    {
      label: "Align centres",
      icon: <AlignCenterHorizontal />,
      run: () => align(store, "center"),
      min: 2,
    },
    { label: "Align right", icon: <AlignEndVertical />, run: () => align(store, "right"), min: 2 },
    { label: "Align top", icon: <AlignStartHorizontal />, run: () => align(store, "top"), min: 2 },
    {
      label: "Align middles",
      icon: <AlignCenterVertical />,
      run: () => align(store, "middle"),
      min: 2,
    },
    {
      label: "Align bottom",
      icon: <AlignEndHorizontal />,
      run: () => align(store, "bottom"),
      min: 2,
    },
    {
      label: "Distribute horizontally",
      icon: <AlignHorizontalJustifyCenter />,
      run: () => distribute(store, "horizontal"),
      min: 3,
    },
    {
      label: "Distribute vertically",
      icon: <AlignVerticalJustifyCenter />,
      run: () => distribute(store, "vertical"),
      min: 3,
    },
  ];
  return (
    <InspectorSection id="align" title="Align and distribute">
      <div className="grid grid-cols-8 gap-0.5">
        {tools.map((tool) => (
          <IconButton
            key={tool.label}
            label={tool.label}
            disabled={count < tool.min}
            onClick={tool.run}
          >
            {tool.icon}
          </IconButton>
        ))}
      </div>
    </InspectorSection>
  );
}

/** Whether containers keep a size of their own or fit what they hold. */
function ContainerSize({ diagram, names }: { diagram: Diagram; names: readonly string[] }) {
  const store = useEditorStore();
  const sized = names.filter((name) => diagram.layout.get(name)?.size != null);
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <span className="text-caption text-fg-muted">
        {sized.length === 0 ? "Fits its contents" : "Sized by hand"}
      </span>
      {sized.length > 0 ? (
        <Button variant="ghost" size="sm" onClick={() => fitToContents(store, sized)}>
          <Shrink /> Fit to contents
        </Button>
      ) : null}
    </div>
  );
}

/** Which container holds the element; moving it keeps it where it is on the canvas. */
function InsideSection({
  diagram,
  layout,
  name,
}: {
  diagram: Diagram;
  layout: LayoutResult;
  name: string;
}) {
  const store = useEditorStore();
  const element = layout.elements.get(name);
  if (element === undefined) return null;
  // Not itself, nor anything inside it.
  const inside = new Set([name, ...descendantsOf(layout, name)]);
  const options = [
    { value: "", label: "Canvas" },
    ...[...diagram.containers.values()]
      .filter((c) => !inside.has(c.name))
      .map((c) => ({ value: c.name, label: c.label })),
  ];
  return (
    <InspectorSection id="inside" title="Inside">
      <Select
        label="Container"
        value={element.parent ?? ""}
        disabled={isLocked(diagram, name)}
        onChange={(value) => {
          const parent = value === "" ? null : value;
          const at = relativeTo(layout, parent, { x: element.box.x, y: element.box.y });
          store.getState().edit(
            parent === null ? "Move to canvas" : "Move into container",
            following(store, (files, d) => moveElements(files, d, [{ name, parent, at }])),
          );
        }}
        options={options}
      />
      {diagram.layout.get(name)?.at != null ? (
        <p className="mt-2 flex items-center gap-1.5 text-caption text-fg-muted">
          <Pin className="size-3.5" /> Pinned where you put it.
        </p>
      ) : null}
    </InspectorSection>
  );
}
