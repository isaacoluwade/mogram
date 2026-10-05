"use client";

import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";
import {
  SIZE_PRESETS,
  defaultScale,
  isQueue,
  nextSize,
  reindexSizes,
  routingOf,
  describePattern,
  LONGEST_CYCLE,
  PATTERN_DEFAULTS,
  SHORTEST_CYCLE,
  type ElementCapacity,
} from "@mogram/core/capacity";
import { FLOW_INFO, TONES } from "@mogram/core/presets";
import { setFlowValue, setScale, setTrafficPattern } from "@mogram/core/edit";
import type {
  Component,
  Connection,
  Diagram,
  Scale,
  ScaleSize,
  ScaleUp,
  TrafficPattern,
} from "@mogram/core/model";
import type { StatePreset } from "@mogram/core/presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { pinCapacity, setCapacityValue, setFlow } from "../actions";
import { useEditor } from "../editor-context";
import { useResolvedLevel } from "../use-editor-scene";
import {
  CommitInput,
  FieldRow,
  FieldStack,
  InspectorSection,
  NumberField,
  PresetGrid,
} from "./fields";
import { flowChoices, sceneLabel, sceneValue, shownFlow, useEdit, useSceneView } from "./shared";

/**
 * Capacity in the inspector (D-82): how a component copes with more traffic (more copies, or a
 * bigger size), what it does with traffic, and how much each connection carries. Settings are the
 * same in every scene; what a scene changes (traffic, shares, hit rates, held copies or sizes) is
 * written to the scene being edited.
 */

const MAX_COPIES = 24;
const MAX_SIZES = 8;

const SCALING_HELP = {
  off: "Choose how it copes with more traffic: more copies of it (out) or a bigger size (up).",
  out: "Adds copies as traffic grows and removes them as it falls, keeping each near its target load.",
  up: "Grows smoothly into a bigger size as traffic grows, and back down as it falls.",
} as const;

const caption = "text-caption text-fg-muted";

export function ScalingSection({ component }: { component: Component }) {
  const { store } = useEdit();
  const view = useSceneView();
  const resolved = useResolvedLevel();
  if (component.shape !== null) return null;
  const scale = component.scale;
  const kind = scale?.kind ?? "off";
  const write = (label: string, next: Scale | null, coalesce = false) =>
    store
      .getState()
      .edit(
        label,
        (files, diagram) => setScale(files, diagram, { name: component.name, scale: next }),
        { coalesce },
      );
  const held = sceneValue(view, component.name)?.capacity;
  const planned = resolved.capacity.elements.get(component.name);
  return (
    <InspectorSection id="scaling" title="Scaling" defaultOpen={scale !== null}>
      <FieldStack>
        {scale !== null ? <CapacityNow component={component} /> : null}
        <SegmentedControl
          label="Scaling"
          size="sm"
          value={kind}
          onChange={(next) =>
            next === kind
              ? undefined
              : write(
                  next === "off" ? "Stop scaling" : next === "out" ? "Scale out" : "Scale up",
                  next === "off" ? null : defaultScale(component, next),
                )
          }
          options={[
            { value: "off", label: "Off", ariaLabel: "Doesn't scale" },
            { value: "out", label: "Out", ariaLabel: "Scales out: more copies" },
            { value: "up", label: "Up", ariaLabel: "Scales up: a bigger size" },
          ]}
        />
        <p className={caption}>{SCALING_HELP[kind]}</p>
        {scale?.kind === "out" ? (
          <FieldRow label="Copies">
            <NumberField
              label="Min"
              value={scale.min}
              min={1}
              max={scale.max}
              onCommit={(min, step) => write("Change copies", { ...scale, min }, step)}
            />
            <NumberField
              label="Max"
              value={scale.max}
              min={scale.min}
              max={MAX_COPIES}
              onCommit={(max, step) => write("Change copies", { ...scale, max }, step)}
            />
          </FieldRow>
        ) : null}
        {scale?.kind === "out" ? (
          <Hint>
            The fewest it keeps running, and the most it may grow to. It only runs as many as its
            traffic needs.
          </Hint>
        ) : null}
        {scale?.kind === "up" ? (
          <SizesEditor
            scale={scale}
            inUse={planned?.size == null ? null : { index: planned.size, where: sceneLabel(view) }}
            onChange={(label, sizes, coalesce) => write(label, { ...scale, sizes }, coalesce)}
          />
        ) : null}
        {scale !== null ? <CapacityField component={component} /> : null}
        {scale !== null ? (
          <FieldRow label="Target">
            <NumberField
              label="Load"
              value={Math.round(scale.target * 100)}
              min={5}
              max={100}
              step={5}
              suffix="%"
              onCommit={(percent, step) =>
                write("Change target load", { ...scale, target: percent / 100 }, step)
              }
            />
          </FieldRow>
        ) : null}
        {scale !== null ? (
          <Hint>
            {scale.kind === "out"
              ? "The load it keeps each copy under: busier than this, it adds a copy."
              : "The load it keeps itself under: busier than this, it moves to a bigger size."}
          </Hint>
        ) : null}
        {scale !== null && view.scene !== null ? (
          <>
            <FieldRow label={`In ${sceneLabel(view)}`}>
              {scale.kind === "out" ? (
                <NumberField
                  label="Copies"
                  value={held?.copies ?? null}
                  min={1}
                  max={MAX_COPIES}
                  placeholder="Automatic"
                  onClear={() => pinCapacity(store, component.name, { copies: null })}
                  onCommit={(copies) => pinCapacity(store, component.name, { copies })}
                />
              ) : (
                <Select
                  label={`Size in ${sceneLabel(view)}`}
                  value={held?.size ?? "__auto"}
                  onChange={(size) =>
                    pinCapacity(store, component.name, { size: size === "__auto" ? null : size })
                  }
                  options={[
                    { value: "__auto", label: "Automatic" },
                    ...scale.sizes.map((s) => ({ value: s.name, label: s.name })),
                  ]}
                />
              )}
            </FieldRow>
            <p className={caption}>
              {scale.kind === "out"
                ? "Holds it at this many copies in this scene, whatever its traffic."
                : "Holds it at this size in this scene, whatever its traffic."}
            </p>
          </>
        ) : null}
      </FieldStack>
    </InspectorSection>
  );
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
const times = (value: number) => `${Math.round(value * 100) / 100}×`;

/**
 * What happens to it, in words: how much traffic reaches it (steady, or rising and falling with a
 * pattern), the copies or size it runs at and why, and the arrow to change, one click away.
 */
function CapacityNow({ component }: { component: Component }) {
  const { store } = useEdit();
  const view = useSceneView();
  const diagram = useEditor((s) => s.parsed().diagram);
  const resolved = useResolvedLevel();
  const scale = component.scale;
  const plan = resolved.capacity.elements.get(component.name);
  if (scale === null || plan === undefined) return null;
  const where = sceneLabel(view);
  const held = sceneValue(view, component.name)?.capacity;
  const target = percent(scale.target);
  const quiet = resolved.capacityOverTime?.quiet.elements.get(component.name);
  const busy = resolved.capacityOverTime?.busy.elements.get(component.name);
  const changes =
    quiet !== undefined && busy !== undefined && Math.abs(quiet.inflow - busy.inflow) > 1e-9;
  // Why it stops short of its most: it only runs what the traffic needs.
  const each = component.capacity ?? 1;
  const roomLeft = (p: ElementCapacity) =>
    scale.kind === "out" && !p.limited && p.copies < scale.max && held?.copies === undefined
      ? ` That's all it needs: it would use all ${scale.max} only with more than ${times((scale.max - 1) * each * scale.target)} reaching it.`
      : "";
  const runs = (p: ElementCapacity) =>
    scale.kind === "out"
      ? `${p.copies} ${p.copies === 1 ? "copy" : "copies"}`
      : (scale.sizes[p.size ?? 0]?.name ?? "");

  let reaching: string;
  let doing: string;
  if (changes) {
    reaching = `Traffic reaching it rises and falls between ${times(quiet.inflow)} and ${times(busy.inflow)}.`;
    const limit =
      busy.load > 1
        ? scale.kind === "out"
          ? ` At its most copies, busy traffic overloads it (${percent(busy.load)}).`
          : ` That's its largest size, and busy traffic overloads it (${percent(busy.load)}): add a bigger size, or scale it out instead.`
        : "";
    doing =
      held !== undefined && (held.copies !== undefined || held.size !== undefined)
        ? `This scene holds it at ${runs(plan)}.`
        : `It runs ${runs(quiet)} when quiet and ${scale.kind === "out" ? busy.copies : runs(busy)} when busy (${percent(busy.load)}).${limit}${roomLeft(busy)}`;
  } else {
    reaching = `Traffic reaching it: ${times(plan.inflow)} (1× is normal).`;
    if (scale.kind === "out")
      doing =
        held?.copies !== undefined
          ? `This scene holds it at ${runs(plan)}, each at ${percent(plan.load)}.`
          : plan.limited
            ? `It would need more than its most (${scale.max}), so its ${runs(plan)} each run at ${percent(plan.load)}${plan.load > 1 ? " and it's overloaded" : ""}.`
            : `It runs ${runs(plan)}: enough to keep each under its ${target} target (${percent(plan.load)}).${roomLeft(plan)}`;
    else
      doing =
        held?.size !== undefined
          ? `This scene holds it at ${runs(plan)}, at ${percent(plan.load)}.`
          : plan.limited
            ? `Even ${runs(plan)}, its largest size, can't keep it under ${target}: it runs at ${percent(plan.load)}${plan.load > 1 ? " and is overloaded" : ""}. Add a bigger size, or scale it out instead.`
            : `It uses ${runs(plan)}, the smallest size that keeps it under ${target} (${percent(plan.load)}).`;
  }

  // The arrows on the way to it that set its traffic: a pattern, or this scene's level.
  const before = upstreamOf(diagram, component.name);
  const arrows = [...diagram.connections.values()].flatMap((connection) => {
    if (!before.has(connection.name)) return [];
    const level = sceneValue(view, connection.name)?.capacity?.traffic;
    if (level !== undefined) return [{ connection, says: `${times(level)} in ${where}` }];
    if (connection.pattern !== null) return [{ connection, says: connection.pattern.kind }];
    if (connection.traffic !== null) return [{ connection, says: times(connection.traffic) }];
    return [];
  });
  const named = (c: Connection) =>
    `${labelOf(diagram, c.from.element)} → ${labelOf(diagram, c.to.element)}`;
  return (
    <div
      className="flex flex-col gap-1 rounded-lg border border-border-subtle bg-fill-faint px-3 py-2.5 text-caption text-fg-muted"
      data-testid="capacity-now"
    >
      <p className="font-medium text-fg-soft">
        {view.scene === null ? "What happens" : `In ${where}`}
      </p>
      <p>
        {reaching} {doing}
      </p>
      {arrows.length > 0 ? (
        <p>
          Its traffic is set on{" "}
          {arrows.map(({ connection, says }, index) => (
            <span key={connection.name}>
              {index > 0 ? ", " : ""}
              <button
                type="button"
                className="text-fg-soft underline decoration-border-strong underline-offset-2 hover:text-fg"
                onClick={() => store.getState().select([connection.name])}
              >
                {named(connection)}
              </button>{" "}
              ({says})
            </span>
          ))}
          : select it to change that.
        </p>
      ) : (
        <p>
          To watch it scale, select an arrow into it and give it Waves (busy, then quiet, on a loop)
          under Traffic.
        </p>
      )}
    </div>
  );
}

const labelOf = (diagram: Diagram, name: string): string =>
  diagram.components.get(name)?.label ?? diagram.containers.get(name)?.label ?? name;

/**
 * Under the state picker: where the choice applies (this scene, or every scene), and why the
 * canvas may show something else (overloaded by its load, or inside something that's down).
 */
export function StateNote({ component }: { component: Component }) {
  const view = useSceneView();
  const resolved = useResolvedLevel();
  const shown = resolved.elements.get(component.name);
  const load = resolved.capacity.elements.get(component.name)?.load ?? 0;
  const where = sceneLabel(view);
  const scoped =
    view.scene === null
      ? view.story.scenes.length > 0
        ? "Its state in every scene. Pick a scene in the strip below to change it just there."
        : null
      : `Only in ${where}. Pick Normal in the strip below to change it in every scene.`;
  const busy = resolved.capacityOverTime?.busy.elements.get(component.name);
  const why =
    shown?.reason !== "load" && busy !== undefined && busy.measured && busy.load > 1 + 1e-9
      ? `When its traffic is busy, its load reaches ${percent(busy.load)}, so it's overloaded then. More room (a bigger size, more copies) or less traffic fixes that.`
      : shown?.reason === "load"
        ? `On the canvas it’s ${STATE_LABEL[shown.state]}: its load is ${percent(load)} in ${where}, more than it can take. Picking a state doesn’t change that; more room (a bigger size, more copies) or less traffic does.`
        : shown?.reason === "cascade"
          ? `On the canvas it’s ${STATE_LABEL[shown.state]}, because something it’s inside is.`
          : null;
  if (scoped === null && why === null) return null;
  return (
    <div className="mt-2 flex flex-col gap-1 text-caption text-fg-muted" data-testid="state-note">
      {why !== null ? <p className="text-fg-soft">{why}</p> : null}
      {scoped !== null ? <p>{scoped}</p> : null}
    </div>
  );
}

const STATE_LABEL: Readonly<Record<StatePreset, string>> = {
  healthy: "healthy",
  active: "active",
  scaling: "scaling",
  degraded: "degraded",
  overloaded: "overloaded",
  down: "down",
};

/** The connections traffic crosses on its way to `name` (into it, or a container around it). */
function upstreamOf(diagram: Diagram, name: string): Set<string> {
  const parentOf = (n: string) =>
    diagram.components.get(n)?.parent ?? diagram.containers.get(n)?.parent ?? null;
  const found = new Set<string>();
  const seen = new Set<string>();
  const queue = [name];
  while (queue.length > 0) {
    const at = queue.shift() ?? "";
    if (seen.has(at)) continue;
    seen.add(at);
    const around: string[] = [];
    for (let p: string | null = at; p !== null && !around.includes(p); p = parentOf(p))
      around.push(p);
    for (const c of diagram.connections.values())
      if (around.includes(c.to.element) && !found.has(c.name)) {
        found.add(c.name);
        queue.push(c.from.element);
      }
  }
  return found;
}

/** The sizes it can be, smallest first: a name and, if you like, cores, memory and disks. */
function SizesEditor({
  scale,
  inUse,
  onChange,
}: {
  scale: ScaleUp;
  /** The size the current scene uses (its index), marked in the list. */
  inUse: { readonly index: number; readonly where: string } | null;
  onChange: (label: string, sizes: ScaleSize[], coalesce?: boolean) => void;
}) {
  const entries = scale.sizes.map((size, index) => ({ size, was: index as number | null }));
  const change = (label: string, next: typeof entries, coalesce = false) =>
    onChange(label, reindexSizes(next), coalesce);
  const setPart = (
    index: number,
    key: "cpu" | "memory" | "disks",
    value: number | null,
    coalesce = false,
  ) =>
    change(
      "Change size",
      entries.map((e, i) => (i === index ? { ...e, size: { ...e.size, [key]: value } } : e)),
      coalesce,
    );
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-6 items-center justify-between">
        <span className={caption}>Sizes, smallest first</span>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="sm">
              Presets
            </Button>
          </MenuTrigger>
          <MenuContent align="end" className="w-64">
            {SIZE_PRESETS.map((preset) => (
              <MenuItem
                key={preset.id}
                description={preset.description}
                onSelect={() =>
                  onChange(`Use ${preset.label.toLowerCase()} sizes`, [...preset.sizes])
                }
              >
                {preset.label}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </div>
      <ol className="flex flex-col gap-1.5" aria-label="Sizes">
        {scale.sizes.map((size, index) => (
          <li
            key={index}
            data-size={size.name}
            data-in-use={inUse?.index === index ? "true" : undefined}
            className={cn(
              "flex flex-col gap-1.5 rounded-md border p-1.5",
              inUse?.index === index ? "border-violet-line" : "border-border-subtle",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-4 shrink-0 text-center text-micro tabular-nums text-fg-faint">
                {index + 1}
              </span>
              <CommitInput
                label={`Size ${index + 1} name`}
                value={size.name}
                live={false}
                validate={(next) =>
                  next.trim() === ""
                    ? "A size needs a name."
                    : scale.sizes.some((s, i) => i !== index && s.name === next.trim())
                      ? `There's already a size called "${next.trim()}".`
                      : null
                }
                onCommit={(name) =>
                  change(
                    "Rename size",
                    entries.map((e, i) =>
                      i === index ? { ...e, size: { ...e.size, name: name.trim() } } : e,
                    ),
                  )
                }
              />
              {inUse?.index === index ? (
                <Badge tone="violet" size="sm" title={`The size it uses in ${inUse.where}`}>
                  In use
                </Badge>
              ) : null}
              <IconButton
                label={`Remove ${size.name}`}
                size="sm"
                disabled={scale.sizes.length <= 1}
                onClick={() =>
                  change(
                    "Remove size",
                    entries.filter((_, i) => i !== index),
                  )
                }
              >
                <X />
              </IconButton>
            </div>
            <div className="flex gap-1.5 pl-5">
              <NumberField
                label="CPU"
                value={size.cpu}
                min={1}
                max={1024}
                placeholder="–"
                onClear={() => setPart(index, "cpu", null)}
                onCommit={(cpu, step) => setPart(index, "cpu", cpu, step)}
              />
              <NumberField
                label="GB"
                value={size.memory}
                min={1}
                max={65536}
                placeholder="–"
                onClear={() => setPart(index, "memory", null)}
                onCommit={(memory, step) => setPart(index, "memory", memory, step)}
              />
              <NumberField
                label="Disks"
                value={size.disks}
                min={1}
                max={64}
                placeholder="–"
                onClear={() => setPart(index, "disks", null)}
                onCommit={(disks, step) => setPart(index, "disks", disks, step)}
              />
            </div>
          </li>
        ))}
      </ol>
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={scale.sizes.length >= MAX_SIZES}
        onClick={() =>
          change("Add size", [...entries, { size: nextSize(scale.sizes), was: scale.sizes.length }])
        }
      >
        <Plus /> Add a size
      </Button>
    </div>
  );
}

/** A short line under a field saying what it means, in plain words. */
function Hint({ children }: { children: ReactNode }) {
  return <p className="-mt-1.5 pl-[84px] text-micro text-fg-muted">{children}</p>;
}

const capacityRow = (scale: Scale | null) =>
  scale?.kind === "out" ? "Each copy" : scale?.kind === "up" ? "Smallest" : "Can take";

/**
 * How much one copy (or the smallest size, or the element) takes at full load. Shown in Scaling
 * for something that scales, and under Requests for anything else.
 */
function CapacityField({ component }: { component: Component }) {
  const { store } = useEdit();
  const name = component.name;
  const measured = component.capacity !== null || component.scale !== null;
  const write = (value: number | null, coalesce = false) =>
    store
      .getState()
      .edit(
        "Change what it takes",
        (files, diagram) => setFlowValue(files, diagram, { name, key: "capacity", value }),
        { coalesce },
      );
  return (
    <>
      <FieldRow label={capacityRow(component.scale)}>
        <NumberField
          label={component.scale === null ? "At 100%" : "Takes"}
          decimal
          step={0.5}
          min={0.05}
          max={1000}
          suffix="×"
          value={component.capacity ?? (measured ? 1 : null)}
          placeholder="Not measured"
          onClear={() => write(null)}
          onCommit={(capacity, step) => write(capacity, step)}
        />
      </FieldRow>
      <Hint>
        {component.scale?.kind === "out"
          ? "How much traffic one copy can take at full load. 1× is normal traffic; 2× is a copy twice as strong, so fewer are needed."
          : component.scale?.kind === "up"
            ? "How much the smallest size can take at full load (1× is normal traffic); each bigger size takes twice as much."
            : "How much it can take at full load (1× is normal traffic). Set it to show its load; past 100% it's overloaded."}
      </Hint>
    </>
  );
}

/**
 * What a component does with the requests that reach it: sends each on to all the next steps or
 * to one of them, answers some itself (a cache), or queues what can't go on yet.
 */
export function ComponentTrafficSection({ component }: { component: Component }) {
  const { store } = useEdit();
  const view = useSceneView();
  const name = component.name;
  const hit = sceneValue(view, name)?.capacity?.hit ?? component.hit;
  const autoRouting = routingOf({ ...component, routing: null });
  const routing = component.routing ?? autoRouting;
  const autoQueue = isQueue({ ...component, queue: null });
  const queue = component.queue ?? autoQueue;
  const flowValue = (label: string, args: Parameters<typeof setFlowValue>[2]) =>
    store.getState().edit(label, (files, diagram) => setFlowValue(files, diagram, args));
  const set =
    component.routing !== null ||
    component.capacity !== null ||
    component.hit !== null ||
    component.queue !== null;
  return (
    <InspectorSection id="traffic" title="Requests" defaultOpen={set}>
      <FieldStack>
        <FieldRow label="Sends to">
          <Select
            label="Each request goes to"
            value={component.routing ?? "auto"}
            onChange={(next) =>
              flowValue("Change where requests go", {
                name,
                key: "routing",
                value: next === "auto" ? null : next,
              })
            }
            options={[
              {
                value: "auto",
                label:
                  autoRouting === "split" ? "One of the next (auto)" : "All of the next (auto)",
              },
              { value: "split", label: "One of the next" },
              { value: "copy", label: "All of the next" },
            ]}
          />
        </FieldRow>
        <Hint>
          {routing === "split"
            ? "Like a load balancer: each request goes to just one of the next steps, so they share the traffic."
            : "Like an app calling its database and cache: every request goes on to each of the next steps."}
        </Hint>
        {component.scale === null ? <CapacityField component={component} /> : null}
        <FieldRow label="Cache">
          <NumberField
            label="Answers"
            value={hit === null ? null : Math.round(hit * 100)}
            min={0}
            max={100}
            step={5}
            suffix="%"
            placeholder="None"
            onClear={() => setCapacityValue(store, name, "hit", null)}
            onCommit={(percent) => setCapacityValue(store, name, "hit", percent / 100)}
          />
        </FieldRow>
        <Hint>
          For a cache: the share of requests it answers without passing them on, so what&apos;s
          after it gets less.
          {view.scene !== null ? ` This is ${sceneLabel(view)}’s.` : ""}
        </Hint>
        <FieldRow label="Queue">
          <Switch
            aria-label="Queues work it can't pass on yet"
            checked={queue}
            onCheckedChange={(on) =>
              flowValue(on ? "Make it a queue" : "Not a queue", {
                name,
                key: "queue",
                value: on === autoQueue ? null : on,
              })
            }
          />
        </FieldRow>
        <Hint>
          Holds requests the next steps can&apos;t take yet, and lets them catch up, instead of
          overloading them.
        </Hint>
      </FieldStack>
    </InspectorSection>
  );
}

/**
 * Everything about the traffic on an arrow, in one place (D-84): whether it flows (and in this
 * scene), how much — steady, or waves and bursts that rise and fall on their own — and its share
 * when its source sends each request to one place. How the dots look is under Style.
 */
export function ConnectionTrafficSection({
  diagram,
  connection,
}: {
  diagram: Diagram;
  connection: Connection;
}) {
  const { store } = useEdit();
  const view = useSceneView();
  const name = connection.name;
  const inScene = view.scene !== null;
  const held = sceneValue(view, name)?.capacity;
  const flow = shownFlow(view, diagram, name);
  const pattern = connection.pattern;
  const kind = pattern?.kind ?? "steady";
  const share = held?.share ?? connection.share;
  const source = diagram.components.get(connection.from.element);
  const splits = source !== undefined && routingOf(source) === "split";
  const writePattern = (label: string, next: TrafficPattern | null, coalesce = false) =>
    store
      .getState()
      .edit(label, (files, d) => setTrafficPattern(files, d, { name, pattern: next }), {
        coalesce,
      });
  const level = (
    label: string,
    value: number,
    onCommit: (value: number, step: boolean) => void,
  ) => (
    <NumberField
      label={label}
      decimal
      step={0.5}
      min={0}
      max={100}
      suffix="×"
      value={value}
      onCommit={onCommit}
    />
  );
  return (
    <InspectorSection id="traffic" title={`Traffic · ${sceneLabel(view)}`}>
      <FieldStack>
        <PresetGrid
          options={flowChoices(diagram)}
          value={flow}
          onChange={(next) => setFlow(store, [name], next)}
          label="Flow"
          describe={(f) => FLOW_INFO[f]}
          dot={(f) =>
            FLOW_INFO[f].tone === "neutral"
              ? TONES.neutral.dark.solid
              : TONES[FLOW_INFO[f].tone].dark.solid
          }
        />
        <FieldRow label="How much">
          <SegmentedControl
            label="Traffic pattern"
            size="sm"
            value={kind}
            onChange={(next) =>
              next === kind
                ? undefined
                : next === "steady"
                  ? writePattern("Steady traffic", null)
                  : writePattern(
                      next === "waves" ? "Traffic in waves" : "Traffic in bursts",
                      PATTERN_DEFAULTS[next],
                    )
            }
            options={[
              { value: "steady", label: "Steady", ariaLabel: "Steady traffic" },
              {
                value: "waves",
                label: "Waves",
                ariaLabel: "Waves: busy, then quiet, again and again",
              },
              { value: "bursts", label: "Bursts", ariaLabel: "Bursts: quiet, with a short spike" },
            ]}
          />
        </FieldRow>
        {pattern === null ? (
          <FieldRow label="Level">
            <NumberField
              label="Carries"
              decimal
              step={0.5}
              min={0}
              max={100}
              suffix="×"
              value={held?.traffic ?? connection.traffic}
              placeholder="As usual"
              onClear={() => setCapacityValue(store, name, "traffic", null)}
              onCommit={(value) => setCapacityValue(store, name, "traffic", value)}
            />
          </FieldRow>
        ) : (
          <>
            <FieldRow label="Quiet">
              {level("Quiet", pattern.low, (low, step) =>
                writePattern(
                  "Change quiet traffic",
                  { ...pattern, low: Math.min(low, pattern.high) },
                  step,
                ),
              )}
            </FieldRow>
            <FieldRow label="Busy">
              {level("Busy", pattern.high, (high, step) =>
                writePattern(
                  "Change busy traffic",
                  { ...pattern, high: Math.max(high, pattern.low) },
                  step,
                ),
              )}
            </FieldRow>
            <FieldRow label="Every">
              <NumberField
                label="Cycle"
                decimal
                step={1}
                min={SHORTEST_CYCLE}
                max={LONGEST_CYCLE}
                suffix="s"
                value={pattern.every}
                onCommit={(every, step) =>
                  writePattern("Change traffic cycle", { ...pattern, every }, step)
                }
              />
            </FieldRow>
            {inScene ? (
              <FieldRow label={`In ${sceneLabel(view)}`}>
                <NumberField
                  label="Hold at"
                  decimal
                  step={0.5}
                  min={0}
                  max={100}
                  suffix="×"
                  value={held?.traffic ?? null}
                  placeholder="Its pattern"
                  onClear={() => setCapacityValue(store, name, "traffic", null)}
                  onCommit={(value) => setCapacityValue(store, name, "traffic", value)}
                />
              </FieldRow>
            ) : null}
          </>
        )}
        {splits ? (
          <FieldRow label="Share">
            <NumberField
              label="Of split"
              value={share === null ? null : Math.round(share * 100)}
              min={0}
              max={100}
              step={5}
              suffix="%"
              placeholder="Even"
              onClear={() => setCapacityValue(store, name, "share", null)}
              onCommit={(percent) => setCapacityValue(store, name, "share", percent / 100)}
            />
          </FieldRow>
        ) : null}
        <p className={caption}>
          {pattern !== null
            ? `It ${describePattern(pattern)}, on its own: what it reaches scales up and down with it.${inScene ? " A scene can hold it at one level instead." : ""}`
            : (held?.traffic ?? connection.traffic) === null
              ? "Carries what its source sends on. Give it a level (5× is five times as much), or make it rise and fall on its own with Waves or Bursts."
              : `Carries ${held?.traffic ?? connection.traffic}× what it otherwise would, and everything after it feels the difference.`}
          {splits ? " Its source sends each request to one place, by share or evenly." : ""}
        </p>
      </FieldStack>
    </InspectorSection>
  );
}
