"use client";

import { useEffect, useState } from "react";
import type { ProjectFiles } from "@mogram/core/model";
import type { DeepLink } from "@/features/share/deep-link";
import { getDraft } from "@/features/drafts/drafts";
import { EditorLoading, EditorUnavailable } from "@/components/screens";
import { Viewer } from "./viewer";

/** Loads a browser draft and shows it in the viewer. */
export function LocalViewer({
  id,
  initialLink,
  present,
}: {
  id: string;
  initialLink: DeepLink;
  present: boolean;
}) {
  const [files, setFiles] = useState<ProjectFiles | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void getDraft(id)
      .then((draft) => {
        if (alive) setFiles(draft?.files ?? null);
      })
      .catch(() => {
        if (alive) setFiles(null);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (files === undefined) return <EditorLoading label="Opening preview" />;
  if (files === null) {
    return (
      <EditorUnavailable
        title="This draft isn't in this browser"
        description="Drafts are saved only in the browser they were made in."
      />
    );
  }
  return (
    <Viewer
      files={files}
      initialLink={initialLink}
      present={present}
      allowViewerState
      homeHref={`/draft/${id}`}
      editHref={`/draft/${id}`}
      preview
    />
  );
}
