"use client";

import { useRef, useState } from "react";
import { FileUp, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { OpenError, readProject } from "@/features/files/open";
import { useEditor, useEditorStore } from "../editor-context";

const ACCEPT = ".yaml,.yml,.mogram,.zip,.md,.svg,.png,.jpg,.jpeg,.gif,.webp";

/** Replaces the diagram with files from the computer (AC-2). One undo step brings it back. */
export function OpenDialog() {
  const store = useEditorStore();
  const open = useEditor((s) => s.dialog === "open");
  return (
    <Dialog open={open} onOpenChange={(next) => store.getState().setDialog(next ? "open" : null)}>
      {open ? (
        <DialogContent
          size="md"
          title="Open files"
          description="Replaces this diagram with what you choose. You can undo it."
        >
          <OpenBody />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function OpenBody() {
  const store = useEditorStore();
  const files = useRef<HTMLInputElement | null>(null);
  const folder = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async (list: readonly File[]) => {
    if (list.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const project = await readProject(list);
      store.getState().closeLevel(0);
      store.getState().replaceFiles(project, "Open files");
      store.getState().setDialog(null);
      store.getState().notify("Opened. Undo brings back what was here before.");
    } catch (cause) {
      setError(cause instanceof OpenError ? cause.message : "Those files couldn't be opened.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void load([...event.dataTransfer.files]);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors",
          over ? "border-border-emphasis bg-fill-hover" : "border-border-strong bg-fill-faint",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-fill-button text-fg-soft [&_svg]:size-5">
          <FileUp />
        </span>
        <div>
          <p className="text-body font-medium text-fg">
            Drop a Mogram file, folder zip or files here
          </p>
          <p className="mt-1 text-caption text-fg-muted">
            .mogram.yaml, a folder with mogram.yaml, a .zip of one, or a PNG or SVG exported with an
            editable copy
          </p>
        </div>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={busy}
            onClick={() => files.current?.click()}
          >
            <FileUp />
            Choose files
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => folder.current?.click()}
          >
            <FolderOpen />
            Choose folder
          </Button>
        </div>
        <input
          ref={files}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          onChange={(event) => void load([...(event.target.files ?? [])])}
        />
        <input
          ref={(node) => {
            folder.current = node;
            // React has no typed prop for directory pickers; set the attribute directly.
            node?.setAttribute("webkitdirectory", "");
          }}
          type="file"
          hidden
          onChange={(event) => void load([...(event.target.files ?? [])])}
        />
      </div>
      {error !== null ? (
        <p
          role="alert"
          className="rounded-md border border-rose-line bg-rose-fill px-3 py-2 text-label text-rose"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
