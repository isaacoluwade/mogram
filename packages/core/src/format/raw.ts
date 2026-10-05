/**
 * The raw records each file contributes, before the cross-file checks in `parse.ts` turn them
 * into a `Diagram`.
 */
import type {
  Component,
  Connection,
  Container,
  DataValue,
  Decoration,
  Group,
  LayoutEntry,
  Scene,
  Tour,
} from "../model/types";
import { type CanvasThemeName } from "../presets/names";
import type { ConceptPlatform, ConceptTopic } from "../presets/concepts";
import type { Paint } from "../presets/paint";
import type { Position } from "./diagnostics";

export type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** A raw reference that still needs cross-file validation, with where it was written. */
export interface Ref {
  readonly value: string;
  readonly at: Position;
}

export interface RawConcept {
  readonly at: Position;
  readonly summary: string | null;
  readonly topic: ConceptTopic | null;
  readonly platform: ConceptPlatform;
  readonly tags: readonly string[];
  readonly roles: { element: Ref; label: string; optional: boolean }[];
}

export interface RawSettings {
  readonly at: Position;
  name: string | null;
  description: string | null;
  concept: RawConcept | null;
  theme: CanvasThemeName | null;
  background: Paint | null;
  grid: string | null;
  libraries: string[] | null;
  ports: Map<string, Ref>;
  data: ReadonlyMap<string, DataValue>;
}

export interface RawComponent {
  readonly model: Mutable<Component>;
  readonly at: Position;
  readonly parentRef: Ref | null;
  readonly opensAt: Position | null;
}

export interface RawContainer {
  readonly model: Mutable<Container>;
  readonly at: Position;
  readonly parentRef: Ref | null;
}

export interface RawGroup {
  readonly model: Mutable<Group>;
  readonly at: Position;
  readonly memberRefs: Ref[];
}

export interface RawConnection {
  readonly model: Mutable<Connection>;
  readonly at: Position;
  readonly fromAt: Position;
  readonly toAt: Position;
  readonly backupAt: Position | null;
}

export interface RawDecoration {
  readonly model: Mutable<Decoration>;
  readonly at: Position;
  readonly parentRef: Ref | null;
}

export interface RawLayout {
  readonly name: string;
  readonly entry: LayoutEntry;
  readonly at: Position;
}

export interface RawScene {
  readonly model: Scene;
  readonly at: Position;
  readonly entryPositions: Position[];
}

export interface RawTour {
  readonly model: Tour;
  readonly at: Position;
  readonly startAt: Position | null;
  readonly stepPositions: Map<string, StepPositions>;
}

export interface StepPositions {
  readonly target: Position;
  readonly next: Position | null;
  readonly scene: Position | null;
  readonly choices: { readonly next: Position | null; readonly scene: Position | null }[];
}

export interface FileContribution {
  readonly file: string;
  settings: RawSettings | null;
  readonly components: RawComponent[];
  readonly containers: RawContainer[];
  readonly groups: RawGroup[];
  readonly connections: RawConnection[];
  readonly decorations: RawDecoration[];
  readonly layout: RawLayout[];
  readonly scenes: RawScene[];
  readonly tours: RawTour[];
  hasLayoutKey: boolean;
}
