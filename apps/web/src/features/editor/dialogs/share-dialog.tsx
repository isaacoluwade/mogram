"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, CloudUpload, Copy, Globe, Link2, Lock, LogIn, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { useEditorHost, type EditorHost } from "../persistence/host";
import { useDraft } from "@/lib/use-draft";
import { buildDeepLink } from "../../share/deep-link";

/** Share (SH-1 … SH-5, AC-5, AC-6): who can open the diagram, the link, and deep links. */
export function ShareDialog() {
  const store = useEditorStore();
  const open = useEditor((s) => s.dialog === "share");
  const host = useEditorHost();
  return (
    <Dialog open={open} onOpenChange={(next) => store.getState().setDialog(next ? "share" : null)}>
      {open ? (
        <DialogContent
          size="md"
          title="Share"
          description={
            host.kind === "local"
              ? "Share links need the diagram saved to your account."
              : "Anyone with the link can view it. Only you can edit it."
          }
        >
          {host.kind === "local" ? <LocalShare host={host} /> : <CloudShare host={host} />}
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function LocalShare({ host }: { host: EditorHost }) {
  const [busy, setBusy] = useState(false);
  const next = encodeURIComponent(`/draft/${host.id}`);
  return (
    <div className="flex flex-col gap-5">
      <StorageNote>
        This draft lives only in this browser. Nobody else can see it, and clearing your browser
        data removes it. Download the files any time to keep them in your repository.
      </StorageNote>
      {host.signedIn ? (
        <Button
          variant="primary"
          size="lg"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void host.saveToCloud?.().finally(() => setBusy(false));
          }}
        >
          <CloudUpload />
          {busy ? "Saving…" : "Save to my account"}
        </Button>
      ) : (
        <Button variant="primary" size="lg" asChild>
          <Link href={`/sign-in?next=${next}` as Route}>
            <LogIn />
            Sign in to share
          </Link>
        </Button>
      )}
      <p className="text-caption text-fg-muted">
        Saved diagrams stay private until you turn on link sharing. You can still edit this draft
        without an account.
      </p>
    </div>
  );
}

function CloudShare({ host }: { host: EditorHost }) {
  const store = useEditorStore();
  const share = host.share ?? {
    visibility: "private" as const,
    shareId: null,
    allowViewerState: false,
  };
  const [pending, setPending] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const accessId = useId();
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link =
    share.visibility === "link" && share.shareId !== null ? `${origin}/s/${share.shareId}` : null;

  const update = async (input: {
    visibility: "private" | "link";
    allowViewerState: boolean;
    regenerateLink?: boolean;
  }) => {
    if (host.updateShare === undefined) return;
    setPending(true);
    try {
      await host.updateShare(input);
    } catch (cause) {
      store
        .getState()
        .notify(cause instanceof Error ? cause.message : "Couldn't update sharing.", "error");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor={accessId}>General access</Label>
        <div className="flex items-center gap-3 rounded-xl border border-border-muted bg-fill-faint p-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4",
              share.visibility === "link"
                ? "bg-green-fill text-green"
                : "bg-fill-button text-fg-secondary",
            )}
          >
            {share.visibility === "link" ? <Globe /> : <Lock />}
          </span>
          <div className="min-w-0 flex-1">
            <Select
              label="General access"
              value={share.visibility}
              disabled={pending}
              onChange={(visibility) =>
                void update({ visibility, allowViewerState: share.allowViewerState })
              }
              options={[
                { value: "private", label: "Only you", description: "Nobody else can open it" },
                {
                  value: "link",
                  label: "Anyone with the link",
                  description: "Can view, play scenes and take tours",
                },
              ]}
              className="h-7 w-auto bg-transparent px-1.5 font-medium hover:bg-fill-hover"
            />
            <p id={accessId} className="px-1.5 text-caption text-fg-muted">
              {share.visibility === "link"
                ? "Anyone with the link can view. No sign-up needed."
                : share.shareId !== null
                  ? "Private. Turning the link back on revives the old one; reset it then for a new link."
                  : "Private. Turn on the link to share it."}
            </p>
          </div>
        </div>
      </div>

      {link !== null ? (
        <>
          <CopyField label="Link" value={link} />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-label font-medium text-fg-soft">Let viewers change state</p>
              <p className="text-caption text-fg-muted">
                Viewers can mark parts down or overloaded to try what-ifs. Their changes are never
                saved.
              </p>
            </div>
            <Switch
              checked={share.allowViewerState}
              disabled={pending}
              onCheckedChange={(allowViewerState) =>
                void update({ visibility: "link", allowViewerState })
              }
              aria-label="Let viewers change state"
            />
          </div>
          <DeepLinkBuilder base={link} />
          <div className="flex flex-wrap items-center gap-2">
            {confirmRegenerate ? (
              <>
                <span className="text-caption text-fg-secondary">
                  The current link will stop working.
                </span>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={pending}
                  onClick={() => {
                    setConfirmRegenerate(false);
                    void update({
                      visibility: "link",
                      allowViewerState: share.allowViewerState,
                      regenerateLink: true,
                    });
                  }}
                >
                  Make a new link
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmRegenerate(false)}>
                  Keep this link
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmRegenerate(true)}>
                <RefreshCw />
                Reset link
              </Button>
            )}
          </div>
        </>
      ) : null}

      <StorageNote>
        Saved in your Mogram account. Shared links always show the latest saved version. Turning the
        link off makes the diagram private again straight away.
      </StorageNote>
    </div>
  );
}

/** Builds a link that opens straight to a level, scene, card or tour step (SH-4). */
function DeepLinkBuilder({ base }: { base: string }) {
  const diagram = useEditor((s) => s.parsed().diagram);
  const { levelPath, currentScene } = useEditorShallow((s) => ({
    levelPath: s.levelPath,
    currentScene: s.scene,
  }));
  const [scene, setScene] = useDraft<string>(currentScene ?? "__none");
  const [target, setTarget] = useState<string>("__none");

  const cards = [...diagram.components.values(), ...diagram.containers.values()].filter(
    (e) => e.card !== null,
  );
  const tours = diagram.tours;
  const options = [
    { value: "__none", label: "Whole diagram" },
    ...cards.map((e) => ({ value: `card:${e.name}`, label: `Card · ${e.label}` })),
    ...tours.map((t) => ({ value: `tour:${t.name}`, label: `Tour · ${t.title}` })),
  ];
  const [kind, name] = target.split(":") as [string, string | undefined];
  const url = buildDeepLink(base, {
    level: levelPath,
    scene: scene === "__none" ? null : scene,
    card: kind === "card" ? (name ?? null) : null,
    tour: kind === "tour" ? (name ?? null) : null,
  });
  const anything = levelPath.length > 0 || scene !== "__none" || target !== "__none";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border-muted p-3">
      <div className="flex items-center gap-2 text-label font-medium text-fg-soft [&_svg]:size-4">
        <Link2 className="text-fg-muted" />
        Link to a moment
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select
          label="Scene"
          value={scene}
          onChange={setScene}
          options={[
            { value: "__none", label: "Normal" },
            ...diagram.scenes.map((s) => ({ value: s.name, label: s.label })),
          ]}
        />
        <Select label="Open" value={target} onChange={setTarget} options={options} />
      </div>
      {levelPath.length > 0 ? (
        <p className="text-caption text-fg-muted">
          Opens at this nested level ({levelPath.join(" › ")}).
        </p>
      ) : null}
      {anything ? <CopyField label="Link to this moment" value={url} hideLabel /> : null}
    </div>
  );
}

function CopyField({
  label,
  value,
  hideLabel = false,
}: {
  label: string;
  value: string;
  hideLabel?: boolean;
}) {
  const id = useId();
  const field = useRef<HTMLInputElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          ref={field}
          id={id}
          readOnly
          value={value}
          onFocus={(event) => event.currentTarget.select()}
          className="font-mono text-caption"
        />
        <Button
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(value).then(
              () => {
                setBlocked(false);
                setCopied(true);
              },
              () => {
                // Clipboard access can be denied: select the text so a keyboard copy works.
                setBlocked(true);
                field.current?.focus();
                field.current?.select();
              },
            );
          }}
          aria-label={copied ? "Copied" : `Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {blocked ? (
        <p role="status" className="text-caption text-fg-muted">
          This browser blocked copying. The link is selected: press Ctrl+C (⌘C on a Mac).
        </p>
      ) : null}
    </div>
  );
}

function StorageNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-fill-faint px-3 py-2.5 text-caption leading-relaxed text-fg-secondary">
      {children}
    </p>
  );
}
