import { partOf } from "../model/parts";
import type {
  Component,
  Connection,
  Container,
  Decoration,
  Diagram,
  Group,
  Place,
  SceneCapacity,
  SceneEntry,
  Tone,
} from "../model/types";
import type { Mark, Presence } from "../presets/marks";
import type { Value } from "../values/formula";
import { stepAt, type Moment } from "./moment";
import { numberOf, scenesOn, scopeOf, workOut } from "./values";

/**
 * What's there at a moment (D-86). One definition, so the editor, the viewer, thumbnails and
 * exports can't disagree: the diagram, then every step played so far, then the scene picked.
 * (The viewer's own what-ifs and what the model derives come after, in `resolveState`.)
 *
 * The geometry is not part of this: a diagram is laid out once with everything shown, so
 * nothing unrelated shifts when something appears.
 */
export interface Picture {
  /**
   * The diagram as it stands: what's hidden is gone (so the model doesn't see it), and labels,
   * tones and marks are as the steps and scenes left them. The very same object as the diagram
   * written when nothing differs.
   */
  readonly diagram: Diagram;
  /**
   * The same, with what's hidden still in it: what an editor draws, faintly, so something
   * that isn't there yet can still be selected, placed and styled.
   */
  readonly whole: Diagram;
  /** State, flow, motion and capacity lines for `resolveState`, one per target. */
  readonly entries: readonly SceneEntry[];
  /** Everything the steps and scene say, by target, each key as its last word stands. */
  readonly lines: ReadonlyMap<string, SceneEntry>;
  /** Everything that isn't simply shown: faded, or hidden. */
  readonly presence: ReadonlyMap<string, Presence>;
  /** What stays bright while the rest dims; null when nothing dims. */
  readonly focus: ReadonlySet<string> | null;
  /** The element the camera frames; null for the whole diagram. */
  readonly zoom: string | null;
  /**
   * Every value as it stands (D-88): the diagram's data, the controls, and what steps and
   * scenes set, worked out. A formula that reads the model is left as written, for the renderer.
   */
  readonly values: ReadonlyMap<string, Value>;
  /** Values running from one number to another across the step showing (`[30, 0]`). */
  readonly ramps: ReadonlyMap<string, { readonly from: number; readonly to: number }>;
  readonly parts: ReadonlyMap<string, ReadonlyMap<string, PartState>>;
}

export interface PartState {
  readonly show: Presence;
  readonly tone: Tone | null;
  readonly mark: Mark | null;
}

type Merged = { -readonly [K in keyof SceneEntry]: SceneEntry[K] };

/** Lays `entry` over what's known for its target: each key it sets wins, the rest stay. */
function lay(over: Map<string, Merged>, entry: SceneEntry): void {
  const known = over.get(entry.target);
  if (known === undefined) {
    over.set(entry.target, { ...entry });
    return;
  }
  if (entry.state !== null) known.state = entry.state;
  if (entry.flow !== null) known.flow = entry.flow;
  if (entry.motion !== null) known.motion = entry.motion;
  if (entry.capacity !== undefined) {
    const capacity: SceneCapacity = { ...known.capacity, ...entry.capacity };
    known.capacity = capacity;
  }
  if (entry.show !== undefined) known.show = entry.show;
  if (entry.label !== undefined) known.label = entry.label;
  if (entry.tone !== undefined) known.tone = entry.tone;
  if (entry.mark !== undefined) known.mark = entry.mark;
  if (entry.value !== undefined) known.value = entry.value;
  if (entry.place !== undefined) {
    const place: { -readonly [K in keyof Place]: Place[K] } = { ...known.place, ...entry.place };
    // Going into a container takes it off what it rode on, and the other way round.
    if (entry.place.in !== undefined && entry.place.on === undefined) delete place.on;
    if (entry.place.on !== undefined && entry.place.in === undefined) delete place.in;
    known.place = place;
  }
  known.source = entry.source;
}

const copyOf = (map: ReadonlyMap<string, Merged>): Map<string, Merged> =>
  new Map([...map].map(([key, value]) => [key, { ...value }]));

const WEAKER: Readonly<Record<Presence, number>> = { shown: 0, faded: 1, hidden: 2 };
const weaker = (a: Presence, b: Presence): Presence => (WEAKER[a] >= WEAKER[b] ? a : b);

/**
 * The picture at a moment. `inherited` holds lines handed down to a nested diagram from the one
 * that opens it (SC-10): they lie under this diagram's own story and scene.
 */
export function pictureAt(
  diagram: Diagram,
  moment: Moment | null,
  inherited: readonly SceneEntry[] = [],
): Picture {
  // 1. Fold the layers, lowest first.
  let over = new Map<string, Merged>();
  for (const entry of inherited) lay(over, entry);

  let focus: readonly string[] = [];
  let zoom: string | null = null;
  const ramps = new Map<string, { from: number; to: number }>();
  const cursor = moment?.story ?? null;
  if (cursor !== null) {
    const base = copyOf(over);
    const named = new Map<string, Map<string, Merged>>();
    const beatFrom = cursor.beats.at(-1)?.played ?? 0;
    cursor.played.forEach((ref, index) => {
      const step = stepAt(diagram, ref);
      if (step === null) return;
      if (step.rewind !== null) {
        const to =
          step.rewind === "start"
            ? base
            : (named.get(`${ref.story}:${step.rewind}`) ??
              [...named].find(([key]) => key.endsWith(`:${step.rewind}`))?.[1] ??
              base);
        over = copyOf(to);
      }
      const last = index === cursor.played.length - 1;
      if (!(last && cursor.rewound)) for (const entry of step.entries) lay(over, entry);
      // Only the step showing has values on their way: earlier ones have arrived.
      if (last && !cursor.rewound)
        for (const entry of step.entries)
          if (entry.value?.from !== undefined && typeof entry.value.to === "number")
            ramps.set(entry.target, { from: entry.value.from, to: entry.value.to });
      if (step.name !== null) named.set(`${ref.story}:${step.name}`, copyOf(over));
      // Focus and zoom belong to the beat showing: a later step of it can move them.
      if (index >= beatFrom) {
        if (step.say !== null && index > beatFrom) {
          focus = [];
          zoom = null;
        }
        if (step.focus.length > 0) focus = step.focus;
        if (step.zoom !== null) zoom = step.zoom;
      }
    });
  }

  // The scene picked, then the scenes the controls have on (D-88), in the order written.
  const scene = moment?.scene ?? null;
  for (const name of [...(scene === null ? [] : [scene]), ...scenesOn(diagram, moment?.controls)])
    for (const entry of diagram.scenes.find((s) => s.name === name)?.entries ?? [])
      lay(over, entry);

  // Values: the diagram's data and the controls, with what was set laid over, worked out.
  const setValues = new Map(
    [...over].flatMap(([name, entry]) =>
      entry.value === undefined ? [] : [[name, entry.value.to] as const],
    ),
  );
  const values = workOut(diagram, moment?.controls, setValues);
  const computed =
    diagram.controls.length > 0 ||
    setValues.size > 0 ||
    [...diagram.settings.data.values()].some(
      (value) => typeof value === "string" && value.startsWith("="),
    ) ||
    [...diagram.connections.values()].some((connection) => connection.trafficFormula !== null);

  // 2. Presence: what each element says, then what holds it.
  const presence = new Map<string, Presence>();
  const own = (name: string, written: Presence): Presence => over.get(name)?.show ?? written;
  const held = new Map<string, Presence>();
  const containerPresence = (name: string, guard = 0): Presence => {
    const known = held.get(name);
    if (known !== undefined) return known;
    const container = diagram.containers.get(name);
    if (container === undefined || guard > 64) return "shown";
    let value = own(name, container.show);
    if (container.parent !== null)
      value = weaker(value, containerPresence(container.parent, guard + 1));
    held.set(name, value);
    return value;
  };
  const inside = (parent: string | null, mine: Presence): Presence =>
    parent === null ? mine : weaker(mine, containerPresence(parent));
  const note = (name: string, value: Presence): Presence => {
    if (value !== "shown") presence.set(name, value);
    return value;
  };
  for (const container of diagram.containers.values())
    note(container.name, containerPresence(container.name));
  // Where each thing a layout places is now (D-87): in a container, or riding on something.
  const placeOf = (name: string): Place | undefined => over.get(name)?.place;
  const homeOf = (component: Component): string | null =>
    placeOf(component.name)?.in ?? component.parent;
  const hostOf = (item: Component | Decoration): string | null => {
    const place = placeOf(item.name);
    if (place?.on !== undefined) return place.on;
    // Gone into a container: it no longer rides on anything.
    return place?.in !== undefined ? null : item.on;
  };
  const componentPresence = new Map<string, Presence>();
  const presenceOfComponent = (component: Component, guard = 0): Presence => {
    const known = componentPresence.get(component.name);
    if (known !== undefined) return known;
    let value = inside(homeOf(component), own(component.name, component.show));
    // What rides on something hidden is hidden with it (a rider on an arrow follows the arrow,
    // below, once arrows are known).
    const host = hostOf(component);
    const carrier = host === null ? undefined : diagram.components.get(host);
    if (carrier !== undefined && guard < 16)
      value = weaker(value, presenceOfComponent(carrier, guard + 1));
    else if (host !== null && diagram.containers.has(host))
      value = weaker(value, containerPresence(host));
    componentPresence.set(component.name, value);
    return value;
  };
  for (const component of diagram.components.values())
    note(component.name, presenceOfComponent(component));
  for (const decoration of diagram.decorations.values()) {
    let value = inside(decoration.parent, own(decoration.name, decoration.show));
    const host = hostOf(decoration);
    const carrier = host === null ? undefined : diagram.components.get(host);
    if (carrier !== undefined) value = weaker(value, presenceOfComponent(carrier));
    else if (host !== null && diagram.containers.has(host))
      value = weaker(value, containerPresence(host));
    note(decoration.name, value);
  }
  const of = (name: string): Presence => presence.get(name) ?? "shown";
  for (const component of diagram.components.values())
    for (const part of component.parts.values()) {
      const target = `${component.name}.${part.name}`;
      note(target, weaker(of(component.name), own(target, part.show)));
    }
  // A connection that ends on a part (D-104) goes when the part does.
  const endpointPresence = (element: string, part: string | null): Presence =>
    weaker(of(element), part === null ? "shown" : of(`${element}.${part}`));
  for (const connection of diagram.connections.values())
    note(
      connection.name,
      weaker(
        own(connection.name, connection.show),
        weaker(
          endpointPresence(connection.from.element, connection.from.part),
          endpointPresence(connection.to.element, connection.to.part),
        ),
      ),
    );
  // Riders on an arrow go with the arrow.
  for (const item of [...diagram.components.values(), ...diagram.decorations.values()]) {
    const host = hostOf(item);
    if (host === null || !diagram.connections.has(host)) continue;
    const value = weaker(of(item.name), of(host));
    if (value !== "shown") presence.set(item.name, value);
  }
  for (const group of diagram.groups.values())
    if (group.members.length > 0 && group.members.every((member) => of(member) === "hidden"))
      presence.set(group.name, "hidden");

  // 3. The diagram as it stands. Untouched maps are kept as they are.
  const gone = (name: string): boolean => presence.get(name) === "hidden";
  const looks = [...over.values()].some(
    (entry) =>
      entry.label !== undefined ||
      entry.tone !== undefined ||
      entry.mark !== undefined ||
      entry.place !== undefined,
  );
  /** A thing as placed now: its container, what it rides on, its cell. */
  const placed = <T extends Component | Decoration>(item: T, entry: Merged | undefined): T => {
    const place = entry?.place;
    if (place === undefined) return item;
    const on = place.on ?? (place.in !== undefined ? null : item.on);
    const along = place.along ?? item.along;
    if (item.kind === "decoration")
      return on === item.on && along === item.along ? item : { ...item, on, along };
    const parent = place.in ?? item.parent;
    const cell = place.cell ?? (place.in !== undefined ? null : item.cell);
    return on === item.on &&
      along === item.along &&
      parent === item.parent &&
      cell?.x === item.cell?.x &&
      cell?.y === item.cell?.y
      ? item
      : { ...item, on, along, parent, cell };
  };
  const anyGone = [...presence.values()].includes("hidden");
  /** `source` with each item as it stands, and (unless `all`) without what's hidden. */
  const keep = <T extends { readonly name: string }>(
    source: ReadonlyMap<string, T>,
    change: (item: T, entry: Merged | undefined) => T,
    all: boolean,
  ): ReadonlyMap<string, T> => {
    let touched = false;
    const out = new Map<string, T>();
    for (const [name, item] of source) {
      if (!all && gone(name)) {
        touched = true;
        continue;
      }
      const next = change(item, over.get(name));
      if (next !== item) touched = true;
      out.set(name, next);
    }
    return touched ? out : source;
  };
  const markOf = (item: Component | Container, entry: Merged | undefined) =>
    entry?.mark === undefined ? item.mark : entry.mark === "none" ? null : entry.mark;
  const scope = scopeOf(values);
  const asItStands = (all: boolean): Diagram => ({
    ...diagram,
    // Labels read values as they stand: `%left%` shows the number, not the formula.
    settings: computed ? { ...diagram.settings, data: values } : diagram.settings,
    components: keep<Component>(
      diagram.components,
      (written, entry) => {
        if (entry === undefined) return written;
        const item = placed(written, entry);
        const label = entry.label ?? item.label;
        const tone = entry.tone ?? item.look?.tone;
        const mark = markOf(item, entry);
        if (label === item.label && tone === item.look?.tone && mark === item.mark) return item;
        return {
          ...item,
          label,
          hasExplicitLabel: item.hasExplicitLabel || entry.label !== undefined,
          look: item.look === null || tone === undefined ? item.look : { ...item.look, tone },
          mark,
        };
      },
      all,
    ),
    containers: keep<Container>(
      diagram.containers,
      (item, entry) => {
        if (entry === undefined) return item;
        const label = entry.label ?? item.label;
        const mark = markOf(item, entry);
        if (label === item.label && mark === item.mark) return item;
        return {
          ...item,
          label,
          hasExplicitLabel: item.hasExplicitLabel || entry.label !== undefined,
          mark,
        };
      },
      all,
    ),
    connections: keep<Connection>(
      diagram.connections,
      (written, entry) => {
        // Traffic written as a formula is a number by now, so the model reads it as one.
        const item =
          written.trafficFormula === null
            ? written
            : { ...written, traffic: Math.max(0, numberOf(written.trafficFormula, scope)) };
        return entry?.label === undefined || entry.label === item.text
          ? item
          : { ...item, text: entry.label, label: entry.label, hasExplicitLabel: true };
      },
      all,
    ),
    decorations: keep<Decoration>(
      diagram.decorations,
      (written, entry) => {
        if (entry === undefined) return written;
        const item = placed(written, entry);
        const text = entry.label ?? item.text;
        const tone = entry.tone ?? item.tone;
        return text === item.text && tone === item.tone ? item : { ...item, text, tone };
      },
      all,
    ),
    groups: keep<Group>(
      diagram.groups,
      (item) => {
        if (all) return item;
        const members = item.members.filter((member) => !gone(member));
        return members.length === item.members.length ? item : { ...item, members };
      },
      all,
    ),
  });
  const whole = looks || computed ? asItStands(true) : diagram;
  const shown = anyGone ? asItStands(false) : whole;
  const parts = new Map<string, ReadonlyMap<string, PartState>>();
  for (const component of diagram.components.values()) {
    if (component.parts.size === 0) continue;
    const states = new Map<string, PartState>();
    for (const [name, part] of component.parts) {
      const entry = over.get(`${component.name}.${name}`);
      states.set(name, {
        // Hiding an element hides its parts.
        show: weaker(of(component.name), entry?.show ?? part.show),
        tone: entry?.tone ?? part.tone,
        mark: entry?.mark === undefined ? part.mark : entry.mark === "none" ? null : entry.mark,
      });
    }
    parts.set(component.name, states);
  }

  // 4. What the resolver needs: lines that say something about state, flow, motion or capacity
  // (and everything for a nested diagram, which works out its own picture).
  const entries: SceneEntry[] = [];
  for (const entry of over.values()) {
    // A line that sets a value names no element.
    if (entry.value !== undefined) continue;
    // A part's line is a look, kept in `parts` above; the resolver never sees it.
    if (partOf(diagram.components, entry.target) !== null) continue;
    const nested = entry.target.includes(".");
    if (
      nested ||
      entry.state !== null ||
      entry.flow !== null ||
      entry.motion !== null ||
      entry.capacity !== undefined
    )
      if (nested || !gone(entry.target)) entries.push(entry);
  }

  return {
    diagram: shown,
    whole,
    entries,
    lines: over,
    presence,
    focus: focus.length === 0 ? null : new Set(focus),
    zoom,
    values,
    ramps,
    parts,
  };
}
