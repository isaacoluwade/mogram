/**
 * The normalised Mogram model. It is always derived from file text by `parseDiagram`
 * and never mutated directly — edits go through `@mogram/core/edit` commands (D-4).
 * Vocabulary follows the PRD: component, container, group, connection, preset, state,
 * scene, card, tour, port, layout.
 */

import type {
  CanvasThemeName,
  ContainerStyleName,
  FlowPreset,
  MotionPreset,
  StatePreset,
} from "../presets/names";
import type { Paint } from "../presets/paint";
import type { FontName, TextAlign } from "../presets/text";
import type { Anchor, ArrowEnds, CornerStyle, JumpStyle, LinePattern } from "../presets/connectors";
import type { ShapeId } from "../presets/shapes";
import type { ConceptPlatform, ConceptTopic } from "../presets/concepts";

/** Path → file contents. Paths use `/`, are relative to the project root, never start with `./`. */
export type ProjectFiles = Readonly<Record<string, string>>;

/** A position in the source, 1-based, for plain-language diagnostics (FI-16) and the inspector (FI-13). */
export interface SourceRef {
  readonly file: string;
  readonly line: number;
}

/** Grid units (8px each, D-11). Always integers. */
export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export interface GridSize {
  readonly w: number;
  readonly h: number;
}

export type Intensity = "low" | "normal" | "high";
export type Speed = "slow" | "normal" | "fast";
export type Density = "low" | "normal" | "high";
export type Direction = "forward" | "reverse" | "both";
export type RouteStyle = "orthogonal" | "curved" | "straight";
export type Rollup = "worst" | "best" | "none";
export type Tone = "neutral" | "blue" | "green" | "amber" | "orange" | "rose" | "violet";
export type TextStyle = "title" | "heading" | "body" | "caption";

/** Where a card's content comes from (CA-3). */
export type CardRef =
  | { readonly kind: "inline"; readonly title: string | null; readonly body: string }
  | { readonly kind: "file"; readonly title: string | null; readonly path: string };

/**
 * Where clicking an element goes (07-document-workflow §18 P0-3): a web page, a scene, a tour, or
 * another element of the same diagram (`#name`).
 */
export type ElementLink =
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "scene"; readonly scene: string }
  | { readonly kind: "tour"; readonly tour: string }
  | { readonly kind: "element"; readonly element: string };

/** A custom property's value (`data:`, 07 §18 P0-5). */
export type DataValue = string | number | boolean;

/** What every element can carry besides its kind's own keys. */
export interface ElementExtras {
  readonly link: ElementLink | null;
  /** Custom properties, in the order written (owner, cost centre, SLA…). */
  readonly data: ReadonlyMap<string, DataValue>;
}

interface ElementBase extends ElementExtras {
  readonly name: string;
  /** Display label: explicit `label:` or the humanised name. */
  readonly label: string;
  /** True when `label:` is written in the file. */
  readonly hasExplicitLabel: boolean;
  readonly source: SourceRef;
}

/**
 * How an element grows with its traffic (capacity, D-82): out to more copies, or up through
 * bigger sizes. Each copy (or the first size) handles `capacity` traffic at 100%.
 */
export type Scale = ScaleOut | ScaleUp;

export interface ScaleOut {
  readonly kind: "out";
  readonly min: number;
  readonly max: number;
  /** The load each copy is kept at (0–1), adding or removing copies. */
  readonly target: number;
}

export interface ScaleUp {
  readonly kind: "up";
  /** Smallest first. */
  readonly sizes: readonly ScaleSize[];
  /** The load it's kept under (0–1), moving to a bigger size. */
  readonly target: number;
}

export interface ScaleSize {
  readonly name: string;
  readonly cpu: number | null;
  /** In GB. */
  readonly memory: number | null;
  readonly disks: number | null;
  /** Relative to the element's `capacity`: the first size is 1, and each size doubles. */
  readonly capacity: number;
}

/** What an element does to traffic passing through it (capacity, D-82). */
export interface FlowBehaviour {
  readonly scale: Scale | null;
  /** Traffic one copy handles at 100% (`capacity:`); null = 1, not written. */
  readonly capacity: number | null;
  /** Where traffic goes next: to all next elements (calls) or one of them (load balancing). */
  readonly routing: "split" | "copy" | null;
  /** A cache's hit rate (0–1): only misses go on. */
  readonly hit: number | null;
  /** Holds traffic its consumers can't take yet (null: from the icon). */
  readonly queue: boolean | null;
}

export interface Component extends ElementBase, FlowBehaviour {
  /** The named style it takes (`style:`, from the top-level `styles:`), if any. */
  readonly style: string | null;
  readonly kind: "component";
  /** Icon reference: `azure/…`, `generic/…`, `tool/…`, or a project path like `icons/x.svg`. */
  readonly type: string;
  readonly parent: string | null;
  readonly state: StatePreset;
  /** True when `state:` is written in the file (used by roll-up precedence, D-12). */
  readonly hasExplicitState: boolean;
  readonly motion: MotionPreset;
  readonly intensity: Intensity;
  readonly speed: Speed;
  readonly color: string | null;
  readonly card: CardRef | null;
  /** Normalised project folder of the nested diagram this component opens (NE-1). */
  readonly opens: string | null;
  /**
   * A shape (written under `shapes:`) is a component drawn as a geometric outline instead of an
   * icon tile, with its own look; null for icon components.
   */
  readonly shape: ShapeId | null;
  readonly look: ShapeLook | null;
}

/** How a shape is drawn (03-shapes-styles-library §5 P0-2). Written only when not the default. */
export interface ShapeLook {
  /** The colour scheme its fill, outline and words come from (default neutral). */
  readonly tone: Tone;
  /** Inside the outline: a colour or gradient; null = the tone's. */
  readonly fill: Paint | null;
  /** The outline's colour; null = the tone's; "none" = no outline. */
  readonly stroke: string | null;
  readonly strokeWidth: number;
  readonly dash: LinePattern;
  /** Corner radius in px for rectangles; null = the shape's own. */
  readonly corner: number | null;
  /** A cylinder's or queue's lid depth in px; null = the shape's own. */
  readonly lid: number | null;
  /** How far a hexagon's sides slant in, in px; null = the shape's own. */
  readonly slant: number | null;
  /** How deep a document's wavy edge is, in px; null = the shape's own. */
  readonly wave: number | null;
  readonly shadow: boolean;
  /** 0–100. */
  readonly opacity: number;
  /** Its label's typography; `color` comes from `text_color`. */
  readonly text: TextLook;
}

export interface Container extends ElementBase {
  /** The named style it takes (`style:`, from the top-level `styles:`), if any. */
  readonly style: string | null;
  readonly kind: "container";
  readonly type: ContainerStyleName;
  readonly icon: string | null;
  readonly parent: string | null;
  readonly state: StatePreset;
  readonly hasExplicitState: boolean;
  readonly rollup: Rollup;
  readonly color: string | null;
  readonly card: CardRef | null;
}

export interface Group extends ElementBase {
  readonly kind: "group";
  readonly members: readonly string[];
}

/** One end of a connection. `port` is set for `aks.web` style endpoints (NE-4). */
export interface Endpoint {
  readonly element: string;
  readonly port: string | null;
}

export interface Connection extends ElementBase {
  /** The named style it takes (`style:`, from the top-level `styles:`), if any. */
  readonly style: string | null;
  readonly kind: "connection";
  readonly from: Endpoint;
  readonly to: Endpoint;
  readonly flow: FlowPreset;
  readonly hasExplicitFlow: boolean;
  readonly direction: Direction;
  readonly speed: Speed;
  readonly density: Density;
  readonly route: RouteStyle;
  readonly color: string | null;
  /** Arrowheads per end (ED-29): the file's own, else what `direction` implies. */
  readonly arrows: ArrowEnds;
  /** Whether the file names arrowheads (written ends override `direction`'s defaults). */
  readonly hasExplicitArrows: boolean;
  readonly arrowSize: { readonly start: number; readonly end: number };
  readonly line: LinePattern;
  /** A custom dash pattern in px, overriding `line`. */
  readonly dash: readonly number[] | null;
  readonly width: number;
  readonly corners: CornerStyle;
  readonly jumps: JumpStyle;
  /** Explicit `label:` only — connections have no default label. */
  readonly text: string | null;
  readonly backupFor: string | null;
  readonly card: CardRef | null;
  /** Multiplies what it carries (a steady level); null = 1. Not set when it has a pattern. */
  readonly traffic: number | null;
  /** Traffic that changes on its own over time (D-84); null = steady. */
  readonly pattern: TrafficPattern | null;
  /** This connection's part (0–1) when its source splits traffic; null = an even share. */
  readonly share: number | null;
}

/**
 * Traffic that rises and falls on its own (D-84): `waves` are quiet for half of each cycle and
 * busy for the other half; `bursts` are quiet with a short spike once a cycle.
 */
export interface TrafficPattern {
  readonly kind: "waves" | "bursts";
  /** The busy level, as a multiple of what it would otherwise carry. */
  readonly high: number;
  /** The quiet level. */
  readonly low: number;
  /** Seconds in one cycle. */
  readonly every: number;
}

/**
 * How free text and sticky notes set their words (ED-25). Text may also use `**bold**`,
 * `*italic*` and `- ` list lines inline.
 */
export interface TextLook {
  /** `null`: the default (the display font for titles and headings, Inter otherwise). */
  readonly font: FontName | null;
  /** In px. `null`: the text style's size, or for a note, the largest size that fits. */
  readonly fontSize: number | null;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly align: TextAlign;
  /** Hex text colour. `null`: from the tone (text) or chosen against the fill (note). */
  readonly color: string | null;
}

/** Decorative elements live with the layout, not the architecture (ED-22). */
export type Decoration =
  | (DecorationBase & {
      readonly variant: "text";
      readonly style: TextStyle;
      readonly look: TextLook;
    })
  | (DecorationBase & { readonly variant: "label" })
  | (DecorationBase & { readonly variant: "zone"; readonly size: GridSize })
  | (DecorationBase & {
      readonly variant: "note";
      readonly size: GridSize;
      readonly fill: Paint;
      readonly look: TextLook;
    });

interface DecorationBase extends ElementExtras {
  readonly kind: "decoration";
  readonly name: string;
  readonly text: string;
  readonly tone: Tone;
  readonly parent: string | null;
  readonly at: GridPoint;
  readonly z: number;
  /** Locked against moving, resizing and deleting by hand (`locked: true`). */
  readonly locked: boolean;
  readonly source: SourceRef;
}

export type Element = Component | Container | Group | Connection;
export type Placeable = Component | Container;

export interface LayoutEntry {
  readonly at: GridPoint | null;
  readonly size: GridSize | null;
  readonly z: number;
  readonly via: readonly GridPoint[] | null;
  /** Connections: the fixed point each end attaches to; null = floating (ED-29). */
  readonly fromAnchor: Anchor | null;
  readonly toAnchor: Anchor | null;
  /** Connections: where the label sits, as a fraction along the path and a sideways offset. */
  readonly label: ConnectionLabelPlace | null;
  /** Locked against moving, resizing and deleting by hand (`locked: true`). */
  readonly locked: boolean;
  readonly source: SourceRef;
}

/** A connection label's place: `at` 0…1 from the start, `offset` grid units left of travel. */
export interface ConnectionLabelPlace {
  readonly at: number;
  readonly offset: number;
}

/** One line of a scene: what differs from normal for one element (SC-5). */
export interface SceneEntry {
  /** Element name, or a nested path such as `aks.ingress` (SC-10). */
  readonly target: string;
  readonly state: StatePreset | null;
  readonly flow: FlowPreset | null;
  readonly motion: MotionPreset | null;
  /** Capacity in this scene: traffic, shares, hit rates, or copies and sizes set by hand. */
  readonly capacity?: SceneCapacity;
  readonly source: SourceRef;
}

export interface SceneCapacity {
  readonly traffic?: number;
  readonly share?: number;
  readonly hit?: number;
  readonly copies?: number;
  /** A size's name, from the element's `scale.sizes`. */
  readonly size?: string;
}

export interface Scene {
  readonly name: string;
  readonly label: string;
  readonly entries: readonly SceneEntry[];
  readonly source: SourceRef;
}

export interface TourChoice {
  readonly label: string;
  readonly next: string | null;
  readonly scene: string | null;
}

export interface TourStep {
  /** Element name or nested path (TO-5). */
  readonly target: string;
  readonly next: string | null;
  readonly scene: string | null;
  readonly choices: readonly TourChoice[];
  readonly source: SourceRef;
}

export interface Tour {
  readonly name: string;
  readonly title: string;
  readonly start: string | null;
  /** Steps in file order, keyed by target. */
  readonly steps: ReadonlyMap<string, TourStep>;
  readonly source: SourceRef;
}

/**
 * A diagram that explains an idea others can reuse (D-83): it says what it shows, and which of
 * its elements play the parts someone applying it picks from their own diagram.
 */
export interface Concept {
  readonly summary: string | null;
  /** What it's about (D-85); null when it doesn't say. */
  readonly topic: ConceptTopic | null;
  /** Where it applies; `any` when it isn't tied to one. */
  readonly platform: ConceptPlatform;
  /** Words to find it by. */
  readonly tags: readonly string[];
  /** Parts someone picks from their own diagram. None: an explainer, inserted or opened. */
  readonly roles: readonly ConceptRole[];
}

export interface ConceptRole {
  /** The element in this diagram that plays the part. */
  readonly element: string;
  /** What the part is, in a few words ("What scales out"). */
  readonly label: string;
  /** Applying works without it (a load balancer in front, if there is one). */
  readonly optional: boolean;
}

export interface DiagramSettings {
  readonly name: string;
  readonly description: string | null;
  /** Present when this diagram is a concept (`concept:`). */
  readonly concept: Concept | null;
  readonly theme: CanvasThemeName;
  /** A custom canvas fill, solid or gradient, over the theme's own (ED-24). */
  readonly background: Paint | null;
  /** Grid dot colour with opacity (`#rrggbbaa`); null works one out from the background. */
  readonly grid: string | null;
  readonly libraries: readonly string[] | null;
  /** Port name → inner element name (NE-3). */
  readonly ports: ReadonlyMap<string, string>;
  /** Values every `%key%` placeholder in the diagram can show (07 §6.2), like draw.io's vars. */
  readonly data: ReadonlyMap<string, DataValue>;
}

export type DiagramMode = "single" | "folder";

/** A named style: where it's written and the keys it sets (03-shapes-styles-library §4). */
export interface StyleDefinition {
  readonly name: string;
  readonly source: SourceRef;
  readonly keys: readonly string[];
}

export interface Diagram {
  /** Project folder of this diagram, `""` for the root. */
  readonly folder: string;
  readonly mode: DiagramMode;
  /** Mogram files that make up this diagram, in a stable order. */
  readonly files: readonly string[];
  /** File holding settings (`mogram.yaml` or the single file). */
  readonly settingsFile: string;
  /** File where layout is (or will be) written (FI-10). */
  readonly layoutFile: string;
  readonly settings: DiagramSettings;
  readonly components: ReadonlyMap<string, Component>;
  readonly containers: ReadonlyMap<string, Container>;
  readonly groups: ReadonlyMap<string, Group>;
  readonly connections: ReadonlyMap<string, Connection>;
  readonly decorations: ReadonlyMap<string, Decoration>;
  /** Named styles (`styles:`), by name. */
  readonly styles: ReadonlyMap<string, StyleDefinition>;
  readonly layout: ReadonlyMap<string, LayoutEntry>;
  readonly scenes: readonly Scene[];
  readonly tours: readonly Tour[];
}

export type DiagnosticSeverity = "error" | "warning";

/** A plain-language problem pointing at a file and line (FI-16). */
export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}
