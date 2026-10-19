"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Mic, Pencil, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LogoGlyph } from "@/components/ui/logo";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { PrompterStage } from "@/features/prompter/prompter";
import { ScriptDesk } from "@/features/prompter/script-prompter";
import { AppShell, type DashboardUser } from "./app-shell";
import { aboutParts } from "./diagram-card";
import { useDashboard, type DashboardItem } from "./use-dashboard";

/** Opens an item's Script window beside the page, as the editor does. */
function openScriptWindow(item: DashboardItem): void {
  window.open(`${item.href}/prompter`, "mogram-script", "popup,width=1024,height=640");
}

/**
 * Script (D-96, D-105): everything with words to say, each a click from its Script window, and
 * how much of it is recorded; then any text at all, pasted and read.
 */
export function ScriptPage({ user }: { user: DashboardUser | null }) {
  const dashboard = useDashboard(user !== null);
  const [reading, setReading] = useState<readonly string[] | null>(null);
  // Reading takes the whole window: nothing but the words.
  if (reading !== null) return <PrompterStage beats={reading} onClose={() => setReading(null)} />;

  // A story's beats are what there is to say, with a script or only a caption.
  const scripts = dashboard.items.filter((item) => item.about.beats > 0);
  return (
    <AppShell user={user} active="script" create={dashboard} items={dashboard.items}>
      <PageHeader
        title="Script"
        description="Read what you're going to say, and record it. In Chrome the Script window follows your voice: it moves as you read, waits while you say something else, and finds you again. Nothing you say leaves this computer."
      />

      <section aria-labelledby="scripts-heading" className="flex flex-col gap-4">
        <h2
          id="scripts-heading"
          className="font-display text-heading font-medium tracking-snug text-fg"
        >
          Your scripts
        </h2>
        {dashboard.loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        ) : scripts.length > 0 ? (
          <ul className="flex flex-col gap-2" aria-label="Your scripts">
            {scripts.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <ScriptRow item={item} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<ScrollText />}
            title="Nothing with a story yet"
            description="A deck's or a diagram's story is its script: each beat has a caption and the words you say over it. Write them in the editor's Story dock, then read and record them here."
            action={
              <Button
                variant="secondary"
                disabled={dashboard.creating}
                onClick={() => dashboard.createFromTemplate("blank-deck")}
              >
                Start a deck
              </Button>
            }
            className="rounded-xl border border-dashed border-border-strong"
          />
        )}
      </section>

      <section aria-labelledby="any-heading" className="flex max-w-4xl flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="any-heading"
            className="font-display text-heading font-medium tracking-snug text-fg"
          >
            Read any text
          </h2>
          <p className="text-body-sm text-fg-muted">
            A talk, an intro, notes for a call: paste it and read it the same way. It isn&apos;t
            recorded or saved to a diagram.
          </p>
        </div>
        <ScriptDesk onRead={setReading} />
      </section>
    </AppShell>
  );
}

/** One thing with words: what it is, how much is recorded, and the way into its Script window. */
function ScriptRow({ item }: { item: DashboardItem }) {
  const { scripted, recorded, beats } = item.about;
  return (
    <article className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-border-muted bg-fill-faint p-3 transition-colors hover:border-border-strong">
      <span className="aspect-[16/10] w-24 shrink-0 overflow-hidden rounded-md bg-surface ring-1 ring-border-muted">
        {item.thumbnail !== null ? (
          // eslint-disable-next-line @next/next/no-img-element -- data: URL rendered in the browser; nothing for next/image to optimise
          <img src={item.thumbnail} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-fg-ghost">
            <LogoGlyph className="size-5" />
          </span>
        )}
      </span>
      <div className="flex min-w-40 flex-1 flex-col gap-1">
        <h3 className="truncate font-sans text-body font-medium text-fg">{item.name}</h3>
        <p className="truncate text-caption tabular-nums text-fg-muted">
          {[
            item.about.kind === "deck" ? "Deck" : "Diagram",
            ...aboutParts(item.about).filter((part) => !part.includes("recorded")),
            scripted < beats ? `${scripted} of ${beats} beats have a script` : null,
          ]
            .filter((part) => part !== null)
            .join(" · ")}
        </p>
      </div>
      <div className="flex w-44 shrink-0 flex-col gap-1.5 max-sm:w-full">
        <Progress
          value={scripted === 0 ? 0 : recorded / scripted}
          label={`${item.name}: recorded`}
        />
        <p className="text-caption tabular-nums text-fg-muted">
          {scripted === 0
            ? "No script to record yet"
            : recorded === scripted
              ? "All recorded"
              : `${recorded} of ${scripted} recorded`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => openScriptWindow(item)}>
          <Mic />
          Read and record
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link href={item.href as Route} aria-label={`Edit ${item.name}`}>
            <Pencil />
            Edit
          </Link>
        </Button>
      </div>
    </article>
  );
}
