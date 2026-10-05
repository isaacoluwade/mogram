"use client";

import { useEffect, useState } from "react";
import { CONCEPT_CATALOG, loadConcept } from "@mogram/concepts";
import type { ProjectFiles } from "@mogram/core/model";
import type { ConceptPlatform, ConceptTopic } from "@mogram/core/presets";
import { api } from "@/lib/api/client";
import { preference, setPreference, usePreference } from "@/lib/preferences";
import { getDraft, listDrafts } from "@/features/drafts/drafts";

/**
 * The concepts on offer (D-83, D-85): Mogram's own (a catalog that loads instantly, each diagram
 * loaded when it's opened) and the person's (drafts in this browser and, signed in, diagrams in
 * their account with a `concept:` section), all described the same way.
 */
export interface ConceptEntry {
  /** Unique across sources: `builtin:caching`, `draft:<id>`, `cloud:<id>`. */
  readonly key: string;
  readonly source: "builtin" | "draft" | "cloud";
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly topic: ConceptTopic | null;
  readonly platform: ConceptPlatform;
  readonly tags: readonly string[];
  /** A pattern you apply to your own elements, or an explainer you insert or open. */
  readonly kind: "pattern" | "explainer";
  /** Its files, loaded when it's opened. */
  readonly load: () => Promise<ProjectFiles>;
}

let builtins: readonly ConceptEntry[] | null = null;

export function builtinConcepts(): readonly ConceptEntry[] {
  builtins ??= CONCEPT_CATALOG.map((card) => ({
    key: `builtin:${card.id}`,
    source: "builtin" as const,
    id: card.id,
    title: card.title,
    summary: card.summary,
    topic: card.topic,
    platform: card.platform,
    tags: card.tags,
    kind: card.kind,
    load: async () => {
      const yaml = await loadConcept(card.id);
      if (yaml === null) throw new Error(`No concept ${card.id}`);
      return { "mogram.yaml": yaml };
    },
  }));
  return builtins;
}

export function builtinConcept(id: string): ConceptEntry | undefined {
  return builtinConcepts().find((entry) => entry.id === id);
}

type Described = {
  readonly summary: string | null;
  readonly topic: ConceptTopic | null;
  readonly platform: ConceptPlatform;
  readonly tags: readonly string[];
  readonly kind: "pattern" | "explainer";
};

const describe = (concept: Described) => ({
  summary: concept.summary ?? "",
  topic: concept.topic,
  platform: concept.platform,
  tags: concept.tags,
  kind: concept.kind,
});

/** Your own concepts, leaving out the diagram open now (`current`, a draft or cloud id). */
export function useOwnConcepts(signedIn: boolean, current: string | null): readonly ConceptEntry[] {
  const [entries, setEntries] = useState<readonly ConceptEntry[]>([]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const found: ConceptEntry[] = [];
      try {
        for (const draft of await listDrafts()) {
          if (draft.concept === null || draft.id === current) continue;
          found.push({
            key: `draft:${draft.id}`,
            source: "draft",
            id: draft.id,
            title: draft.name,
            ...describe(draft.concept),
            load: async () => (await getDraft(draft.id))?.files ?? {},
          });
        }
      } catch {
        // Drafts can be unavailable (private browsing): there are just none to offer.
      }
      if (signedIn) {
        try {
          for (const diagram of await api.listDiagrams()) {
            if (diagram.concept === null || diagram.id === current) continue;
            found.push({
              key: `cloud:${diagram.id}`,
              source: "cloud",
              id: diagram.id,
              title: diagram.name,
              ...describe(diagram.concept),
              load: async () => (await api.getDiagram(diagram.id)).files,
            });
          }
        } catch {
          // Offline or signed out meanwhile: the drafts and built-in ones are still there.
        }
      }
      if (live) setEntries(found);
    })();
    return () => {
      live = false;
    };
  }, [signedIn, current]);
  return entries;
}

// -------------------------------------------------------------------------------------------------
// Recently used

const RECENT = 8;

/** Concepts applied, inserted or opened most recently, newest first (their keys). */
export function useRecentConcepts(): readonly string[] {
  return usePreference("conceptRecent");
}

export function rememberConcept(key: string): void {
  setPreference(
    "conceptRecent",
    [key, ...preference("conceptRecent").filter((k) => k !== key)].slice(0, RECENT),
  );
}
