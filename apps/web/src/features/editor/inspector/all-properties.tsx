"use client";

import { useMemo, useState } from "react";
import { FileCode2 } from "lucide-react";
import { readProperties, setProperty } from "@mogram/core/edit";
import type { Diagram, SourceRef } from "@mogram/core/model";
import { Button } from "@/components/ui/button";
import { useEditor, useEditorStore } from "../editor-context";
import { CommitInput, InspectorSection } from "./fields";

/**
 * Every key the element can take, as the file writes it (04-format-panel §16.7, draw.io's property
 * grid): the long tail the sections above leave out, editable as YAML values. Empty means the
 * default. "Edit in YAML" opens the code panel at the element.
 */
export function AllProperties({
  diagram,
  name,
  source,
}: {
  diagram: Diagram;
  name: string;
  source: SourceRef;
}) {
  const store = useEditorStore();
  const files = useEditor((s) => s.files);
  const rows = useMemo(() => readProperties(files, diagram, name), [files, diagram, name]);
  const [filter, setFilter] = useState("");
  const shown = rows.filter((row) => row.key.includes(filter.trim().toLowerCase()));
  return (
    <InspectorSection id="all-properties" title="All properties" defaultOpen={false}>
      <input
        aria-label="Filter properties"
        placeholder="Filter"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        className="mb-2 h-7 w-full rounded-md bg-fill-field px-2.5 text-caption text-fg outline-none placeholder:text-fg-ghost focus-visible:ring-1 focus-visible:ring-border-emphasis"
      />
      <dl className="flex flex-col gap-1">
        {shown.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <dt className="w-[84px] shrink-0 truncate font-mono text-micro text-fg-muted">
              {row.key}
            </dt>
            <dd className="min-w-0 flex-1">
              <CommitInput
                label={row.key}
                mono
                live={false}
                placeholder="default"
                value={row.value ?? ""}
                className="h-7 text-micro"
                onCommit={(text) =>
                  store
                    .getState()
                    .edit(`Set ${row.key}`, (f, d) =>
                      setProperty(f, d, { name, key: row.key, text }),
                    )
                }
              />
            </dd>
          </div>
        ))}
      </dl>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2"
        onClick={() => store.getState().revealInCode(source.file, source.line)}
      >
        <FileCode2 /> Edit in YAML
      </Button>
    </InspectorSection>
  );
}
