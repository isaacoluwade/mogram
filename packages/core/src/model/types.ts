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
export type Tone = "neutral" | "green" | "amber" | "orange" | "rose" | "violet";
export type TextStyle = "title" | "heading" | "body" | "caption";

/** Where a card's content comes from (CA-3). */
export type CardRef =
  | { readonly kind: "inline"; readonly title: string | null; readonly body: string }
  | { readonly kind: "file"; readonly title: string | null; readonly path: string };

interface ElementBase {
  readonly name: string;
  /** Display label: explicit `label:` or the humanised name. */
  readonly label: string;
  /** True when `label:` is written in the file. */
  readonly hasExplicitLabel: boolean;
  readonly source: SourceRef;
}

export interface Component extends ElementBase {
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
}

export interface Container extends ElementBase {
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
  /** Explicit `label:` only — connections have no default label. */
  readonly text: string | null;
  readonly backupFor: string | null;
  readonly card: CardRef | null;
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

interface DecorationBase {
  readonly kind: "decoration";
  readonly name: string;
  readonly text: string;
  readonly tone: Tone;
  readonly parent: string | null;
  readonly at: GridPoint;
  readonly z: number;
  readonly source: SourceRef;
}

export type Element = Component | Container | Group | Connection;
export type Placeable = Component | Container;

export interface LayoutEntry {
  readonly at: GridPoint | null;
  readonly size: GridSize | null;
  readonly z: number;
  readonly via: readonly GridPoint[] | null;
  readonly source: SourceRef;
}

/** One line of a scene: what differs from normal for one element (SC-5). */
export interface SceneEntry {
  /** Element name, or a nested path such as `aks.ingress` (SC-10). */
  readonly target: string;
  readonly state: StatePreset | null;
  readonly flow: FlowPreset | null;
  readonly motion: MotionPreset | null;
  readonly source: SourceRef;
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

export interface DiagramSettings {
  readonly name: string;
  readonly description: string | null;
  readonly theme: CanvasThemeName;
  /** A custom canvas fill, solid or gradient, over the theme's own (ED-24). */
  readonly background: Paint | null;
  /** Grid dot colour with opacity (`#rrggbbaa`); null works one out from the background. */
  readonly grid: string | null;
  readonly libraries: readonly string[] | null;
  /** Port name → inner element name (NE-3). */
  readonly ports: ReadonlyMap<string, string>;
}

export type DiagramMode = "single" | "folder";

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
