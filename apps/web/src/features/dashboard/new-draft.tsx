"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isTemplateId, templateById } from "@/features/templates";
import { createDraft } from "@/features/drafts/drafts";
import { EditorLoading, EditorUnavailable } from "@/components/screens";

/** Creates a draft in this browser from a template, then replaces the URL with the editor. */
export function NewDraft({ template }: { template: string | null }) {
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  // An unknown template (an old or mistyped link) says so instead of quietly opening a blank one.
  const unknown = template !== null && !isTemplateId(template);
  useEffect(() => {
    // Strict mode runs effects twice in development; only ever create one draft.
    if (started.current || unknown) return;
    started.current = true;
    const chosen = templateById(template);
    void createDraft(chosen.id === "blank" ? "Untitled diagram" : chosen.name, chosen.files)
      .then((draft) => router.replace(`/draft/${draft.id}`))
      .catch(() => setFailed(true));
  }, [router, template, unknown]);
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
