"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { setData } from "@mogram/core/edit";
import type { DataValue, ElementLink } from "@mogram/core/model";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useEditorStore } from "../editor-context";
import { CommitInput, InspectorSection } from "./fields";
import { useEdit } from "./shared";

/** A link as the file writes it. */
export function linkText(link: ElementLink | null): string {
  if (link === null) return "";
  switch (link.kind) {
    case "url":
      return link.url;
    case "scene":
      return `scene:${link.scene}`;
    case "tour":
      return `tour:${link.tour}`;
    case "element":
      return `#${link.element}`;
  }
}

/** Why `text` can't be a link yet, or null (empty clears the link). */
function linkProblem(text: string): string | null {
  const value = text.trim();
  if (value === "") return null;
  if (/^(scene|tour):\S+$/.test(value)) return null;
  if (/^#[A-Za-z][\w-]*$/.test(value)) return null;
  if (/^(https?:\/\/|mailto:)\S+$/i.test(value)) return null;
  return "Use a web address (https://…), scene:name, tour:name or #element.";
}

/**
 * Where clicking the element goes in the viewer (07-document-workflow §18 P0-3): a web page, a
 * scene, a tour or another element. Cards and nested diagrams still open first.
 */
export function LinkSection({ name, link }: { name: string; link: ElementLink | null }) {
  const { set } = useEdit();
  return (
    <InspectorSection id="link" title="Link" defaultOpen={link !== null}>
      <CommitInput
        label="Link"
        mono
        live={false}
        placeholder="https://… or scene:name, #element"
        value={linkText(link)}
        validate={linkProblem}
        onCommit={(text) =>
          set(name, { link: text.trim() === "" ? null : text.trim() }, "Set link")
        }
      />
      <p className="mt-1.5 text-micro text-fg-muted">
        Viewers follow it with a click; a web page opens in a new tab.
      </p>
    </InspectorSection>
  );
}

/**
 * Custom properties (07 §18 P0-5): owner, cost centre, SLA, repository… shown in the viewer's
 * card and as a tooltip, and in any label through a `%key%` placeholder (07 §6.2). Values that
 * read as numbers or true/false are kept as such. `name: null` edits the diagram's own data,
 * which every element's placeholders can show.
 */
export function DataSection({
  name,
  data,
}: {
  name: string | null;
  data: ReadonlyMap<string, DataValue>;
}) {
  const store = useEditorStore();
  const rows = [...data].map(([key, value]) => [key, String(value)] as const);
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement | null>(null);
  // Closing the new-row form puts focus back on "Add a property", ready for the next one.
  const stopAdding = () => {
    setAdding(false);
    requestAnimationFrame(() => addButton.current?.focus());
  };
  const save = (next: readonly (readonly [string, string])[], label = "Edit data") =>
    store.getState().edit(label, (files, diagram) => setData(files, diagram, { name, rows: next }));
  return (
    <InspectorSection
      id="data"
      title={`Data${rows.length > 0 ? ` (${rows.length})` : ""}`}
      defaultOpen={rows.length > 0}
    >
      <div className="flex flex-col gap-1">
        {rows.map(([key, value], index) => (
          <div key={key} className="flex items-center gap-1">
            <CommitInput
              label={`Name of ${key}`}
              mono
              live={false}
              value={key}
              className="h-7 w-24 shrink-0 text-micro"
              onCommit={(next) =>
                save(
                  rows.map((row, i) => (i === index ? [next, row[1]] : row)),
                  "Rename data",
                )
              }
            />
            <CommitInput
              label={`Value of ${key}`}
              live={false}
              value={value}
              className="h-7 text-micro"
              onCommit={(next) => save(rows.map((row, i) => (i === index ? [row[0], next] : row)))}
            />
            <IconButton
              label={`Remove ${key}`}
              size="sm"
              onClick={() =>
                save(
                  rows.filter((_, i) => i !== index),
                  "Remove data",
                )
              }
            >
              <X />
            </IconButton>
          </div>
        ))}
        {adding ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const key = String(form.get("key") ?? "").trim();
              const value = String(form.get("value") ?? "");
              stopAdding();
              if (key.length > 0) save([...rows, [key, value]], "Add data");
            }}
          >
            <input
              name="key"
              autoFocus
              aria-label="New data name"
              placeholder="owner"
              className="h-7 w-24 shrink-0 rounded-md bg-fill-field px-2 font-mono text-micro text-fg outline-none placeholder:text-fg-ghost focus-visible:ring-1 focus-visible:ring-border-emphasis"
            />
            <input
              name="value"
              aria-label="New data value"
              placeholder="payments team"
              onKeyDown={(event) => {
                if (event.key === "Escape") stopAdding();
              }}
              className="h-7 min-w-0 flex-1 rounded-md bg-fill-field px-2 text-micro text-fg outline-none placeholder:text-fg-ghost focus-visible:ring-1 focus-visible:ring-border-emphasis"
            />
            <Button type="submit" size="sm" variant="secondary">
              Add
            </Button>
          </form>
        ) : (
          <Button
            ref={addButton}
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setAdding(true)}
          >
            <Plus /> Add a property
          </Button>
        )}
        <p className="mt-0.5 text-micro text-fg-muted">
          {name === null
            ? "Any label can show these with %key%, like %owner%."
            : "Show one in a label with %key%, like %owner%."}
        </p>
      </div>
    </InspectorSection>
  );
}
