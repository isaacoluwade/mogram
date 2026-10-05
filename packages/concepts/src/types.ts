import type { ConceptPlatform, ConceptTopic } from "@mogram/core/presets";

/** A part a pattern's concept asks for: the element in it, and what it does. */
export interface ConceptPart {
  readonly element: string;
  readonly label: string;
  readonly optional: boolean;
}

/**
 * What the catalog knows about a concept without loading its diagram (D-85): enough to list,
 * filter and search hundreds, and for the assistant to choose and apply one.
 */
export interface ConceptCard {
  /** Its file name: `content/<topic>/<id>.mogram.yaml`. */
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly topic: ConceptTopic;
  readonly platform: ConceptPlatform;
  readonly tags: readonly string[];
  /** A pattern you apply to your own elements, or an explainer you insert or open. */
  readonly kind: "pattern" | "explainer";
  readonly parts: readonly ConceptPart[];
}
