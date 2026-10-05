"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isTemplateId, templateById } from "@/features/templates";
import { createDraft } from "@/features/drafts/drafts";
import { builtinConcept } from "@/features/concepts/catalog";
import { EditorLoading, EditorUnavailable } from "@/components/screens";

/**
 * Creates a draft in this browser from a template (or a built-in concept), then replaces the URL
 * with the editor.
 */
export function NewDraft({
  template,
  concept = null,
}: {
  template: string | null;
  concept?: string | null;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  const fromConcept = concept === null ? null : builtinConcept(concept);
  // An unknown template (an old or mistyped link) says so instead of quietly opening a blank one.
  const unknown =
    (concept !== null && fromConcept === undefined) ||
    (template !== null && !isTemplateId(template));
  useEffect(() => {
    // Strict mode runs effects twice in development; only ever create one draft.
    if (started.current || unknown) return;
    started.current = true;
    const start = async () => {
      if (fromConcept != null) return createDraft(fromConcept.title, await fromConcept.load());
      const chosen = templateById(template);
      return createDraft(chosen.id === "blank" ? "Untitled diagram" : chosen.name, chosen.files);
    };
    void start()
      .then((draft) => router.replace(`/draft/${draft.id}`))
      .catch(() => setFailed(true));
  }, [router, template, unknown, fromConcept]);
  if (unknown && concept !== null) {
    return (
      <EditorUnavailable
        title="That concept doesn't exist"
        description={`There's no concept called "${concept}". The library in the editor has every concept.`}
      />
    );
  }
  if (unknown) {
    return (
      <EditorUnavailable
        title="That template doesn't exist"
        description={`There's no template called "${template}". Your diagrams page has every template, and a blank canvas.`}
      />
    );
  }
  if (failed) {
    return (
      <EditorUnavailable
        title="Couldn't start a draft"
        description="This browser isn't letting Mogram store drafts (private browsing can do this). Try a normal window, or sign in to save to the cloud."
      />
    );
  }
  return <EditorLoading label="Creating your diagram" />;
}
