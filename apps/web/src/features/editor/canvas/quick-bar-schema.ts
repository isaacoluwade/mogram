import type { Diagram } from "@mogram/core/model";
import { preference, setPreference } from "@/lib/preferences";
import type { SelectionInfo } from "../commands/selection";
import type { EditorStore } from "../store/editor-store";
import { scopeOf, type InspectorTab } from "../inspector/tabs";

/**
 * The quick bar, declared (04-format-panel §16.9): what it offers for each kind of selection, in
 * order. Every control is a subset of the inspector — it says which tab and section hold the
 * rest of it — and edits through the same actions, so undo labels and mixed values match. Nothing
 * exists only in the bar.
 */
export type QuickControlId =
  | "state"
  | "motion"
  | "flow"
  | "tone"
  | "color"
  | "open-nested"
  | "route"
  | "line"
  | "arrow-start"
  | "arrow-end"
  | "text-style"
  | "note-fill"
  | "font"
  | "font-size"
  | "emphasis"
  | "align"
  | "list"
  | "text-color"
  | "decoration-tone";

export interface InspectorHome {
  readonly tab: InspectorTab;
  readonly section: string;
}

export interface QuickControl {
  readonly id: QuickControlId;
  /** What it edits in the selection; nothing hides it. */
  readonly targets: (sel: SelectionInfo, diagram: Diagram) => readonly string[];
  /** Where the rest of it is in the inspector. */
  readonly home: InspectorHome;
}

const single =
  (keep: (name: string, diagram: Diagram) => boolean) =>
  (sel: SelectionInfo, diagram: Diagram): readonly string[] =>
    sel.single !== null && keep(sel.single, diagram) ? [sel.single] : [];

const isShape = (name: string, diagram: Diagram): boolean =>
  diagram.components.get(name)?.shape != null;
const decoration = (name: string, diagram: Diagram) => diagram.decorations.get(name);
const rich = (name: string, diagram: Diagram): boolean => {
  const variant = decoration(name, diagram)?.variant;
  return variant === "text" || variant === "note";
};
const always = (sel: SelectionInfo, diagram: Diagram) => single((n, d) => rich(n, d))(sel, diagram);
const style = (section: string): InspectorHome => ({ tab: "style", section });
const element = (section: string): InspectorHome => ({ tab: "element", section });

export const QUICK_CONTROLS: Readonly<Record<QuickControlId, QuickControl>> = {
  state: { id: "state", targets: (sel) => sel.placeables, home: element("state") },
  motion: { id: "motion", targets: (sel) => sel.components, home: element("motion") },
  flow: { id: "flow", targets: (sel) => sel.connections, home: element("flow") },
  tone: { id: "tone", targets: single(isShape), home: style("tone") },
  color: {
    id: "color",
    targets: single(
      (name, diagram) =>
        !isShape(name, diagram) &&
        (diagram.components.has(name) ||
          diagram.containers.has(name) ||
          diagram.connections.has(name)),
    ),
    home: style("colour"),
  },
  "open-nested": {
    id: "open-nested",
    targets: single((name, diagram) => diagram.components.get(name)?.opens != null),
    home: element("nested"),
  },
  route: { id: "route", targets: (sel) => sel.connections, home: style("line") },
  line: { id: "line", targets: (sel) => sel.connections, home: style("line") },
  "arrow-start": {
    id: "arrow-start",
    targets: (sel) => sel.connections,
    home: style("arrowheads"),
  },
  "arrow-end": { id: "arrow-end", targets: (sel) => sel.connections, home: style("arrowheads") },
  "text-style": {
    id: "text-style",
    targets: single((name, diagram) => decoration(name, diagram)?.variant === "text"),
    home: style("text-style"),
  },
  "note-fill": {
    id: "note-fill",
    targets: single((name, diagram) => decoration(name, diagram)?.variant === "note"),
    home: style("typography"),
  },
  font: { id: "font", targets: always, home: style("typography") },
  "font-size": { id: "font-size", targets: always, home: style("typography") },
  emphasis: { id: "emphasis", targets: always, home: style("typography") },
  align: { id: "align", targets: always, home: style("typography") },
  list: { id: "list", targets: always, home: style("typography") },
  "text-color": { id: "text-color", targets: always, home: style("typography") },
  "decoration-tone": {
    id: "decoration-tone",
    targets: single(
      (name, diagram) => decoration(name, diagram) !== undefined && !rich(name, diagram),
    ),
    home: style("tone"),
  },
};

/** What kind of bar a selection gets. */
export type BarKind = "elements" | "connections" | "text" | "zone";

/** Each bar, in order; "|" is a divider (dropped at the ends and when doubled). */
export const QUICK_BAR: Readonly<Record<BarKind, readonly (QuickControlId | "|")[]>> = {
  elements: ["state", "motion", "flow", "tone", "color", "open-nested"],
  connections: ["route", "|", "line", "arrow-start", "arrow-end", "|", "flow", "color"],
  text: [
    "text-style",
    "note-fill",
    "|",
    "font",
    "font-size",
    "|",
    "emphasis",
    "align",
    "list",
    "text-color",
  ],
  zone: ["decoration-tone"],
};

export function barKind(sel: SelectionInfo, diagram: Diagram): BarKind {
  if (sel.single !== null) {
    if (rich(sel.single, diagram)) return "text";
    if (decoration(sel.single, diagram) !== undefined) return "zone";
  }
  if (sel.connections.length > 0 && sel.connections.length === sel.names.length)
    return "connections";
  return "elements";
}

export interface ResolvedControl {
  readonly id: QuickControlId;
  readonly names: readonly string[];
}

/** The controls a selection's bar shows, with what each edits, and dividers between groups. */
export function quickBarFor(
  sel: SelectionInfo,
  diagram: Diagram,
): { readonly kind: BarKind; readonly items: readonly (ResolvedControl | "|")[] } {
  const kind = barKind(sel, diagram);
  const items: (ResolvedControl | "|")[] = [];
  for (const entry of QUICK_BAR[kind]) {
    if (entry === "|") {
      if (items.length > 0 && items.at(-1) !== "|") items.push("|");
      continue;
    }
    const names = QUICK_CONTROLS[entry].targets(sel, diagram);
    if (names.length > 0) items.push({ id: entry, names });
  }
  while (items.at(-1) === "|") items.pop();
  return { kind, items };
}

/** Where "More in inspector" goes: the section of the bar's first control. */
export function barHome(items: readonly (ResolvedControl | "|")[]): InspectorHome {
  const first = items.find((item): item is ResolvedControl => item !== "|");
  return first === undefined ? element("details") : QUICK_CONTROLS[first.id].home;
}

/**
 * Opens the inspector on `home`'s tab with its section unfolded and in view: the deep link from
 * the quick bar (04 §16.9) that draw.io lacks.
 */
export function revealInInspector(
  store: EditorStore,
  diagram: Diagram,
  sel: SelectionInfo,
  home: InspectorHome,
): void {
  setPreference("inspectorTabs", { ...preference("inspectorTabs"), element: home.tab });
  const key = `${scopeOf(diagram, sel)}:${home.section}`;
  setPreference("inspectorSections", { ...preference("inspectorSections"), [key]: true });
  store.getState().togglePanel("inspector", true);
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      document
        .querySelector(`[aria-label="Inspector"] [data-section="${home.section}"]`)
        ?.scrollIntoView({ block: "nearest" }),
    ),
  );
}
