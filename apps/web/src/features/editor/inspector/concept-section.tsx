"use client";

import { Lightbulb, X } from "lucide-react";
import { setConcept } from "@mogram/core/edit";
import type { Concept, Diagram } from "@mogram/core/model";
import { CONCEPT_PLATFORMS, CONCEPT_TOPICS, type ConceptTopic } from "@mogram/core/presets";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { parseTags } from "@/features/concepts/browse";
import { useEditorStore } from "../editor-context";
import { CommitInput, FieldRow, FieldStack, InspectorSection } from "./fields";

const ADD = "__add";
const NO_TOPIC = "__none";

/**
 * Making the diagram a concept (D-83, D-85): what it explains, where it's filed (topic, platform,
 * tags), and its parts — the elements someone applying it picks from their own diagram. Without
 * parts it's an explainer, inserted or opened as it is. Its patterns and scenes tell the story.
 */
export function ConceptSection({ diagram }: { diagram: Diagram }) {
  const store = useEditorStore();
  const concept = diagram.settings.concept;
  const write = (label: string, next: Concept | null) =>
    store.getState().edit(label, (files, d) => setConcept(files, d, { concept: next }));
  const caption = "text-caption text-fg-muted";
  if (concept === null)
    return (
      <InspectorSection id="concept" title="Concept" defaultOpen={false}>
        <p className={caption}>
          Turn this diagram into a concept: it shows up under Concepts, to apply to a diagram or
          insert as it is. Its traffic and scenes tell the story.
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          onClick={() =>
            write("Make a concept", {
              summary: diagram.settings.description,
              topic: null,
              platform: "any",
              tags: [],
              roles: [],
            })
          }
        >
          <Lightbulb />
          Make it a concept
        </Button>
      </InspectorSection>
    );
  const label = (name: string) =>
    diagram.components.get(name)?.label ?? diagram.containers.get(name)?.label ?? name;
  const playable = [...diagram.components.values(), ...diagram.containers.values()]
    .filter((element) => !concept.roles.some((role) => role.element === element.name))
    .map((element) => ({ value: element.name, label: element.label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const setRoles = (text: string, roles: Concept["roles"]) => write(text, { ...concept, roles });
  return (
    <InspectorSection id="concept" title="Concept">
      <FieldStack>
        <CommitInput
          label="Concept summary"
          placeholder="What it explains, in a sentence or two"
          value={concept.summary ?? ""}
          onCommit={(summary) => write("Concept summary", { ...concept, summary })}
        />
        <FieldRow label="Topic">
          <Select<ConceptTopic | typeof NO_TOPIC>
            label="Concept topic"
            value={concept.topic ?? NO_TOPIC}
            onChange={(topic) =>
              write("Concept topic", { ...concept, topic: topic === NO_TOPIC ? null : topic })
            }
            options={[
              { value: NO_TOPIC, label: "None yet" },
              ...CONCEPT_TOPICS.map((t) => ({ value: t.id, label: t.label })),
            ]}
          />
        </FieldRow>
        <FieldRow label="Platform">
          <Select
            label="Concept platform"
            value={concept.platform}
            onChange={(platform) => write("Concept platform", { ...concept, platform })}
            options={CONCEPT_PLATFORMS.map((p) => ({ value: p.id, label: p.label }))}
          />
        </FieldRow>
        <FieldRow label="Tags">
          <CommitInput
            label="Concept tags"
            placeholder="For search: dns, failover"
            className="w-full"
            value={concept.tags.join(", ")}
            onCommit={(text) => write("Concept tags", { ...concept, tags: parseTags(text) })}
          />
        </FieldRow>
        <p className={caption}>
          {concept.roles.length === 0
            ? "No parts: an explainer, inserted or opened as it is. Add parts to make it a pattern someone applies to their own elements."
            : "Its parts: what someone picks from their own diagram when they apply it. Say what each one does."}
        </p>
        {concept.roles.length > 0 ? (
          <ul className="flex flex-col gap-1.5" aria-label="Concept parts">
            {concept.roles.map((role, index) => (
              <li
                key={role.element}
                className="flex flex-col gap-1.5 rounded-md border border-border-subtle p-1.5"
              >
                <div className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate pl-1 text-micro text-fg-faint">
                    {label(role.element)}
                  </span>
                  <label className="flex items-center gap-1.5 text-micro text-fg-muted">
                    Optional
                    <Switch
                      aria-label={`${label(role.element)} is optional`}
                      checked={role.optional}
                      onCheckedChange={(optional) =>
                        setRoles(
                          "Change concept part",
                          concept.roles.map((r, i) => (i === index ? { ...r, optional } : r)),
                        )
                      }
                    />
                  </label>
                  <IconButton
                    label={`Remove ${label(role.element)} from the parts`}
                    size="sm"
                    onClick={() =>
                      setRoles(
                        "Remove concept part",
                        concept.roles.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <X />
                  </IconButton>
                </div>
                <CommitInput
                  label={`What ${label(role.element)} does`}
                  placeholder="e.g. What scales out"
                  value={role.label}
                  validate={(next) => (next.trim() === "" ? "Say what this part does." : null)}
                  onCommit={(text) =>
                    setRoles(
                      "Name concept part",
                      concept.roles.map((r, i) => (i === index ? { ...r, label: text.trim() } : r)),
                    )
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}
        {playable.length > 0 ? (
          <Select
            label="Add a part"
            value={ADD}
            onChange={(name) =>
              name === ADD
                ? undefined
                : setRoles("Add concept part", [
                    ...concept.roles,
                    { element: name, label: label(name), optional: false },
                  ])
            }
            options={[{ value: ADD, label: "Add a part…" }, ...playable]}
          />
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => write("Stop being a concept", null)}
        >
          Stop being a concept
        </Button>
      </FieldStack>
    </InspectorSection>
  );
}
