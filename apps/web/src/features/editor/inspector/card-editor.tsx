"use client";

import { useState } from "react";
import { FileText, PenLine, Trash2 } from "lucide-react";
import { setCard } from "@mogram/core/edit";
import { joinPath, resolveFromFolder, toName, type CardRef } from "@mogram/core/model";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cardContent, Markdown } from "@/features/cards/markdown";
import { useEditorShallow, useEditorStore } from "../editor-context";
import { CommitInput } from "./fields";
import { useDraft } from "@/lib/use-draft";

/** Write a card inline or keep it in a markdown file in the repo (CA-2, CA-3). */
export function CardEditor({
  name,
  card,
  label,
}: {
  name: string;
  card: CardRef | null;
  label: string;
}) {
  const store = useEditorStore();
  const { files, folder } = useEditorShallow((s) => ({ files: s.files, folder: s.folder }));
  const [mode, setMode] = useState<"write" | "preview">("write");
  const content = card === null ? null : cardContent(card, files, label);
  const [body, setBody] = useDraft(content?.body ?? "");

  const save = (next: CardRef | null, fileContent?: string) =>
    store
      .getState()
      .edit("Edit card", (f, d) =>
        setCard(f, d, { name, card: next, ...(fileContent !== undefined ? { fileContent } : {}) }),
      );

  if (card === null) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-caption text-fg-muted">
          Explain this element where it lives. Cards stay hidden until someone opens them.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => save({ kind: "inline", title: null, body: `What does ${label} do?` })}
          >
            <PenLine /> Write card
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const path = joinPath(
                folder,
                "docs",
                `${toName(label, "card").replace(/_/g, "-")}.md`,
              );
              save(
                { kind: "file", title: null, path },
                files[path] ?? `# ${label}\n\nWhat does ${label} do?\n`,
              );
            }}
          >
            <FileText /> Markdown file
          </Button>
        </div>
      </div>
    );
  }

  const commitBody = () => {
    if (content !== null && body === content.body) return;
    if (card.kind === "inline") save({ ...card, body });
    else {
      const heading =
        card.title === null && files[card.path]?.trimStart().startsWith("#")
          ? `# ${content?.title ?? label}\n`
          : "";
      save(card, `${heading}${body}`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <CommitInput
        label="Card title"
        placeholder={label}
        value={card.title ?? ""}
        onCommit={(title) =>
          save({ ...card, title: title.trim().length === 0 ? null : title.trim() } as CardRef)
        }
      />
      {card.kind === "file" ? (
        <CommitInput
          label="Markdown file"
          mono
          live={false}
          value={card.path.slice(folder.length > 0 ? folder.length + 1 : 0)}
          onCommit={(path) => {
            const resolved = resolveFromFolder(folder, path.trim());
            if (resolved !== null && resolved.endsWith(".md"))
              save({ ...card, path: resolved }, files[resolved] ?? files[card.path]);
          }}
        />
      ) : null}
      <SegmentedControl
        label="Card editor mode"
        size="sm"
        value={mode}
        onChange={setMode}
        options={[
          { value: "write", label: "Write" },
          { value: "preview", label: "Preview" },
        ]}
      />
      {mode === "write" ? (
        <textarea
          aria-label="Card body (markdown)"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onBlur={commitBody}
          onKeyDown={(event) => event.stopPropagation()}
          rows={8}
          className="min-h-36 w-full resize-y rounded-md bg-fill-field px-2.5 py-2 font-mono text-caption leading-relaxed text-fg outline-none focus-visible:ring-1 focus-visible:ring-border-emphasis placeholder:text-fg-ghost focus:bg-fill-hover"
          placeholder="Markdown: **bold**, `code`, [links](https://…), [other card](#element)"
        />
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-md border border-border-subtle bg-fill-faint p-3">
          <Markdown
            source={body}
            files={files}
            folder={folder}
            onElementLink={(target) => store.getState().select([target])}
          />
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-micro text-fg-ghost">
          {card.kind === "file"
            ? "Saved in the repo as markdown"
            : "Saved inline in the diagram file"}
        </span>
        <Button variant="ghost" size="sm" onClick={() => save(null)}>
          <Trash2 /> Remove
        </Button>
      </div>
    </div>
  );
}
