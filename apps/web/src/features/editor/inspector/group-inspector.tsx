"use client";

import type { Group as GroupModel } from "@mogram/core/model";
import { useEditor } from "../editor-context";
import { CommitInput, InspectorSection } from "./fields";
import { useEdit } from "./shared";

/** A group outline: its label, and its members (each can be taken out). */
export function GroupInspector({ group }: { group: GroupModel }) {
  const { set } = useEdit();
  const diagram = useEditor((s) => s.parsed().diagram);
  return (
    <>
      <InspectorSection title="Label">
        <CommitInput
          label="Group label"
          value={group.label}
          onCommit={(label) => set(group.name, { label }, "Rename group")}
        />
      </InspectorSection>
      <InspectorSection title={`Members (${group.members.length})`}>
        <ul className="flex flex-col gap-1">
          {group.members.map((member) => (
            <li
              key={member}
              className="flex items-center justify-between rounded-md bg-fill-faint px-2.5 py-1.5 text-label text-fg-soft"
            >
              <span className="truncate">
                {diagram.components.get(member)?.label ??
                  diagram.containers.get(member)?.label ??
                  member}
              </span>
              <button
                type="button"
                className="text-caption text-fg-muted hover:text-rose"
                onClick={() =>
                  set(
                    group.name,
                    { members: group.members.filter((m) => m !== member) },
                    "Remove from group",
                  )
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-caption text-fg-muted">
          Groups are drawn around their members wherever they sit, so they have no position.
        </p>
      </InspectorSection>
    </>
  );
}
