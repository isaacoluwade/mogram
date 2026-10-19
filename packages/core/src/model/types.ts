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
import type { PageName } from "../presets/pages";
import type { Paint } from "../presets/paint";
import type { FontName, TextAlign } from "../presets/text";
import type { Anchor, ArrowEnds, CornerStyle, JumpStyle, LinePattern } from "../presets/connectors";
import type { ShapeId } from "../presets/shapes";
import type { ConceptPlatform, ConceptTopic } from "../presets/concepts";
import type { Mark, Presence } from "../presets/marks";
import type { CodeLanguage } from "../presets/code";

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
  /** What an image shows (`shape: image`, D-102); null for every other shape. */
  readonly image: ImageContent | null;
  /** What a code listing shows (`shape: code`, D-103); null for every other shape. */
  readonly code: CodeContent | null;
  /** Named regions of a picture or lines of a listing (`parts:`, D-104), by name. */
  readonly parts: ReadonlyMap<string, Part>;
  /** Whether it's there before any story or scene says otherwise (`show:`, D-86). */
  readonly show: Presence;
  /** A small sign at its corner (`mark:`); it means nothing to the model. */
  readonly mark: Mark | null;
  /** The element or connection it rides on (`on:`, D-87): it sits beside it and goes where it goes. */
  readonly on: string | null;
  /** How far along the connection it rides on (0–1); null: half-way. */
  readonly along: number | null;
  /** Its cell in a grid container, as [column, row] from 0; null: the next free one. */
  readonly cell: GridPoint | null;
  /** The element it was written as a copy of (`like:`); it grows out of it when shown. */
  readonly like: string | null;
  /** What a meter shows (D-88); null for every other shape. */
  readonly meter: Meter | null;
}

/**
 * A meter (D-88): a shape that shows a value against a most, as a bar, a ring (a timer) or a
 * number. The value and the most are formulas, so nothing on screen is typed twice.
 */
/** A picture in the project, shown by an image element (D-102). */
export interface ImageContent {
  /** As written. */
  readonly src: string;
  /** The file in the project it names; null when it names nothing there. */
  readonly path: string | null;
  readonly fit: "contain" | "cover";
  /** The picture's own width and height in px, when its file says (a pointer or an SVG). */
  readonly natural: { readonly width: number; readonly height: number } | null;
}

/** A code listing (D-103): lines of text kept exactly, coloured by language. */
export interface CodeContent {
  /** Written in place (`text:`), or a text file in the project (`file:`, as written). */
  readonly text: string | null;
  readonly file: string | null;
  /** The file in the project `file:` names; null for `text:`, or when it names nothing there. */
  readonly path: string | null;
  /** `lines:`: the slice shown, in the file's own numbers; null for all of it. */
  readonly slice: readonly [number, number] | null;
  readonly language: CodeLanguage;
  /** The header's words; null for no header. */
  readonly title: string | null;
  /** Line numbers down the left. */
  readonly numbers: boolean;
  /** Every line of the text, as shown, and which of them are shown. */
  readonly listing: CodeListing;
}

/** A listing's lines (see `@mogram/core/code`). */
export interface CodeListing {
  readonly lines: readonly string[];
  readonly first: number;
  readonly last: number;
  readonly missing: boolean;
}

/**
 * A part (D-104): a named sub-area of an element that a set can show, tone and mark, that
 * `focus` and `zoom` can name, and that a connection can end on. Addressed `element.part`.
 */
export type Part = PartLook & (LinesPart | AreaPart);

interface PartLook {
  readonly name: string;
  readonly show: Presence;
  readonly tone: Tone | null;
  readonly mark: Mark | null;
  readonly source: SourceRef;
}

/** Lines of a code listing, in the file's own numbers. */
export interface LinesPart {
  readonly kind: "lines";
  readonly first: number;
  readonly last: number;
}

/** A region of a picture: x, y, width and height, each a share (0–1) of the picture. */
export interface AreaPart {
  readonly kind: "area";
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Meter {
  /** A formula (without its `=`): a number, a value's name, or something worked out. */
  readonly value: string;
  readonly max: string;
  readonly as: "bar" | "ring" | "number";
  /** The value it turns amber near and red at; null: it never warns. */
  readonly limit: number | null;
  /** Written after the number (`%`, ` s`). */
  readonly unit: string;
}

/**
 * Something the viewer can set (D-88): a dial is a number that formulas read; a toggle turns a
 * scene on; a pick chooses one of several scenes.
 */
export type Control =
  | (ControlBase & {
      readonly kind: "dial";
      readonly min: number;
      readonly max: number;
      readonly step: number;
      readonly start: number;
      readonly unit: string;
    })
  | (ControlBase & { readonly kind: "toggle"; readonly scene: string; readonly start: boolean })
  | (ControlBase & {
      readonly kind: "pick";
      readonly scenes: readonly string[];
      readonly start: string;
    });

interface ControlBase {
  readonly name: string;
  readonly label: string;
  readonly source: SourceRef;
}

/**
 * How a container arranges what's in it (D-87). Its children need no positions, it keeps room
 * for the most it ever holds, and a story can move things in and out of it.
 */
export interface ContainerLayout {
  readonly kind: "row" | "column" | "grid";
  /** Space between children, in grid units. */
  readonly gap: number;
  /** A grid's columns; null: from its written cells, or a block as square as it can be. */
  readonly columns: number | null;
}

/** Where something placed by a layout is put: in a container that arranges it, or on something. */
export interface Place {
  readonly in?: string;
  readonly on?: string;
  readonly cell?: GridPoint;
  readonly along?: number;
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
  readonly show: Presence;
  readonly mark: Mark | null;
  /** How it arranges what's in it; null: its children are placed freely. */
  readonly layout: ContainerLayout | null;
}

export interface Group extends ElementBase {
  readonly kind: "group";
  readonly members: readonly string[];
}

/** One end of a connection. `port` is set for `aks.web` style endpoints (NE-4). */
export interface Endpoint {
  readonly element: string;
  /** A port of a component that opens a nested diagram (`aks.web`, NE-3). */
  readonly port: string | null;
  /** A part of an image or code element (`portal.name_field`, D-104). */
  readonly part: string | null;
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
  readonly show: Presence;
  /** Its traffic as a formula (`= rps`, D-88): worked out for each picture; null when a number. */
  readonly trafficFormula: string | null;
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
      readonly width: number | null;
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
  readonly show: Presence;
  /** The element or connection it rides on (a branch name on a commit); null: placed at `at`. */
  readonly on: string | null;
  readonly along: number | null;
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

/**
 * One line of a `set` (D-86): what differs for one element, in a scene (SC-5) or at a step of a
 * story. Scenes and steps share this vocabulary; a key left out leaves that property alone.
 */
export interface SceneEntry {
  /** Element name, or a nested path such as `aks.ingress` (SC-10). */
  readonly target: string;
  readonly state: StatePreset | null;
  readonly flow: FlowPreset | null;
  readonly motion: MotionPreset | null;
  /** Capacity in this scene: traffic, shares, hit rates, or copies and sizes set by hand. */
  readonly capacity?: SceneCapacity;
  /** Whether it's there: `shown`, `faded` or `hidden`. */
  readonly show?: Presence;
  /** What it says. */
  readonly label?: string;
  /** A shape's or a text's colour scheme. */
  readonly tone?: Tone;
  /** The sign at its corner; `none` takes it away. */
  readonly mark?: Mark | "none";
  /** Where it goes, for something placed by a layout (`in`, `on`, `cell`, `along`). */
  readonly place?: Place;
  /**
   * When the target is a value (a key of the diagram's `data:`) and not an element: what it
   * becomes, and where it runs from when it changes across the step (`[30, 0]`).
   */
  readonly value?: { readonly to: DataValue; readonly from?: number };
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

/**
 * A story (D-86): a named run of steps, each a `set` with words. A step with `say` starts a
 * beat; the steps after it without one belong to that beat and play on by themselves.
 */
export interface Story {
  readonly name: string;
  readonly label: string;
  readonly steps: readonly StoryStep[];
  readonly source: SourceRef;
}

export interface StoryStep {
  /** A name another step can rewind to. */
  readonly name: string | null;
  /** The caption; it starts a beat. */
  readonly say: string | null;
  /** What's spoken (D-93): read from the prompter. It starts a beat too. */
  readonly script: string | null;
  /** What changes (`set:`). */
  readonly entries: readonly SceneEntry[];
  /** What stays bright while the rest dims; empty = nothing dims. */
  readonly focus: readonly string[];
  /** An element the camera frames. */
  readonly zoom: string | null;
  /** Seconds it stays once changed; null = long enough to read its words. */
  readonly hold: number | null;
  readonly pace: "normal" | "slow";
  /** Begin from an earlier picture: `start`, or a step's name. */
  readonly rewind: string | null;
  /** Stories the viewer can play from here, then come back. */
  readonly choices: readonly StoryChoice[];
  /** A formula (D-88): the step plays only while it holds, so a dial can change what happens. */
  readonly when: string | null;
  readonly source: SourceRef;
}

export interface StoryChoice {
  readonly label: string;
  /** The story it plays. */
  readonly play: string;
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

/**
 * A deck (D-99): an ordered list of slides, in sections. A slide is a diagram in a folder, on a
 * page; the deck adds order and nothing else.
 */
export interface Deck {
  /** A folder whose diagram is drawn under every slide; null for none. */
  readonly frame: string | null;
  /** Whether someone watching sees each beat's caption to begin with. */
  readonly captions: boolean;
  readonly entries: readonly DeckEntry[];
  readonly source: SourceRef;
}

/**
 * An entry in a deck's `slides` list. `item` is where it is in the list as written, counting
 * entries that couldn't be read: what an edit to the deck works from, so a bad line elsewhere
 * never makes it change the wrong one.
 */
export type DeckEntry =
  | {
      readonly kind: "section";
      readonly item: number;
      readonly title: string;
      readonly source: SourceRef;
    }
  | {
      readonly kind: "slide";
      readonly item: number;
      /** The folder of the diagram shown, from the project's root. */
      readonly folder: string;
      /** Which of its stories plays; null for the first. */
      readonly story: string | null;
      /** Names of steps: begin as things stood after `from`'s beat, stop after `to`'s. */
      readonly from: string | null;
      readonly to: string | null;
      /** A scene laid over it throughout. */
      readonly scene: string | null;
      /** What the rail, the overview and exports call it; null for the diagram's name. */
      readonly title: string | null;
      /** Whether the deck's frame is drawn under it. */
      readonly frame: boolean;
      /** Kept in the file, not shown or counted. */
      readonly skip: boolean;
      readonly source: SourceRef;
    };

export interface DiagramSettings {
  readonly name: string;
  readonly description: string | null;
  /** Present when this diagram is a concept (`concept:`). */
  readonly concept: Concept | null;
  /** Present when this folder is a deck (`deck:`): its own file then holds no elements. */
  readonly deck: Deck | null;
  readonly theme: CanvasThemeName;
  /** Whether the theme is written here, or is only the default (a slide takes its deck's). */
  readonly themeSet: boolean;
  /** A fixed frame (D-98): what a viewer, a thumbnail and an export show. Null: the contents. */
  readonly page: PageName | null;
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
  /** Stories, in file order: the first is the one a diagram plays (D-86). */
  readonly stories: readonly Story[];
  /** What the viewer can set (D-88), in the order written. */
  readonly controls: readonly Control[];
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
