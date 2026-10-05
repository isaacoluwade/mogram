"use client";

import {
  ArrowLeft,
  ArrowRight,
  CornerDownRight,
  ExternalLink,
  Flag,
  Layers,
  Undo2,
  X,
} from "lucide-react";
import { humanize, withPlaceholders, type ElementLink } from "@mogram/core/model";
import { STATE_INFO, type StatePreset } from "@mogram/core/presets";
import { exitsOf, stepFor, stepNumber } from "@mogram/core/tours";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { useIconName } from "@/features/canvas/icons";
import { Markdown, cardContent } from "@/features/cards/markdown";
import { useViewerController, useViewerShallow } from "./viewer-context";

const STATE_TONE: Readonly<Record<StatePreset, BadgeProps["tone"]>> = {
  healthy: "neutral",
  active: "green",
  scaling: "violet",
  degraded: "amber",
  overloaded: "orange",
  down: "rose",
};

const WHAT_IF: readonly StatePreset[] = ["healthy", "degraded", "overloaded", "down"];

function typeLabel(type: string): string {
  const slug = type.split("/").pop() ?? type;
  return humanize(slug.replace(/\.svg$/i, ""));
}

/** "Virtual machine", "Node.js": the catalog's name for the icon, or the humanised type. */
function ComponentKind({ type }: { type: string }) {
  const name = useIconName(type);
  return <>{name ?? typeLabel(type)}</>;
}

/**
 * The card beside the camera (CA-1 … CA-7): title, markdown, "what if" state (SH-3), a way
 * inside nested diagrams, and the tour's controls while a tour is running (TO-1 … TO-6).
 */
export function CardPanel({ allowViewerState }: { allowViewerState: boolean }) {
  const controller = useViewerController();
  const { openCard, inspected, tour, wandered, present, levelPath, scene, viewerEntries } =
    useViewerShallow((s) => ({
      openCard: s.openCard,
      inspected: s.inspected,
      tour: s.tour,
      wandered: s.wandered,
      present: s.present,
      levelPath: s.levelPath,
      scene: s.scene,
      viewerEntries: s.viewerEntries,
    }));
  const name = openCard ?? inspected;
  if (name === null) return null;

  const geometry = controller.geometry(levelPath);
  const diagram = geometry.diagram;
  const component = diagram.components.get(name);
  const container = diagram.containers.get(name);
  const connection = diagram.connections.get(name);
  const element = component ?? container ?? connection;
  if (element === undefined) return null;
  const label = withPlaceholders(
    diagram,
    name,
    connection !== undefined ? (connection.text ?? connection.label) : element.label,
  );
  const card = element.card;
  const content = card === null ? null : cardContent(card, controller.levels.files, label);
  const resolved = controller.levels.resolve(levelPath, scene, viewerEntries);
  const state =
    component !== undefined || container !== undefined
      ? (resolved?.elements.get(name)?.state ?? "healthy")
      : null;
  const kind =
    component !== undefined ? (
      <ComponentKind type={component.type} />
    ) : container !== undefined ? (
      humanize(container.type)
    ) : (
      "Connection"
    );
  const whatIf = controller.viewerStateOf(name);
  const compact = openCard === null;

  return (
    <Panel
      role="dialog"
      aria-label={content?.title ?? label}
      className={cn(
        "pointer-events-auto absolute flex flex-col overflow-hidden animate-pop-in",
        compact
          ? "bottom-[88px] left-1/2 w-[min(360px,calc(100%-1rem))] -translate-x-1/2 max-md:bottom-[84px]"
          : "right-4 top-[72px] max-h-[calc(100%-168px)] w-[380px] max-md:inset-x-2 max-md:bottom-2 max-md:top-auto max-md:max-h-[48dvh] max-md:w-auto",
        !compact && present && "top-6 max-h-[calc(100%-48px)] w-[420px]",
      )}
    >
      <header className="flex items-start gap-3 px-4 pb-2 pt-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-caption text-fg-muted">{kind}</p>
          <h2
            className={cn(
              "font-display font-medium tracking-snug text-fg",
              present ? "text-title" : "text-heading",
            )}
          >
            {content?.title ?? label}
          </h2>
        </div>
        {state !== null && state !== "healthy" ? (
          <Badge tone={STATE_TONE[state]} className="mt-1">
            {STATE_INFO[state].label}
          </Badge>
        ) : null}
        <IconButton
          label="Close"
          size="sm"
          className="-mr-1.5 -mt-1"
          onClick={() =>
            void (compact
              ? controller.inspect(null)
              : tour !== null
                ? controller.endTour()
                : controller.closeCard())
          }
        >
          <X />
        </IconButton>
      </header>

      {element.data.size > 0 || element.link !== null ? (
        <div className="flex flex-col gap-2 px-4 pb-3">
          {element.data.size > 0 ? (
            <dl
              aria-label="Details"
              className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-caption"
            >
              {[...element.data].map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-fg-muted">{key}</dt>
                  <dd className="min-w-0 truncate text-fg-soft">{String(value)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {element.link !== null ? (
            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() =>
                element.link !== null && void controller.followElementLink(element.link)
              }
            >
              <ExternalLink />
              {linkLabel(element.link)}
            </Button>
          ) : null}
        </div>
      ) : null}

      {content !== null ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <Markdown
            source={content.body}
            files={controller.levels.files}
            folder={geometry.folder}
            onElementLink={(target) => void controller.followLink(target)}
            {...(present ? { className: "text-body-lg leading-relaxed" } : {})}
          />
        </div>
      ) : !compact ? (
        <p className="px-4 pb-4 text-body-sm text-fg-muted">No notes for this part yet.</p>
      ) : null}

      {component !== undefined && controller.canEnter(name) ? (
        <div className="border-t border-border-muted px-4 py-3">
          <Button variant="secondary" size="sm" onClick={() => void controller.enterLevel(name)}>
            <Layers />
            Look inside
          </Button>
        </div>
      ) : null}

      {allowViewerState && state !== null ? (
        <div className="flex flex-col gap-2 border-t border-border-muted px-4 py-3">
          <p className="text-caption text-fg-muted">What if it were…</p>
          <div className="flex flex-wrap gap-1.5">
            {WHAT_IF.map((preset) => (
              <Chip
                key={preset}
                selected={state === preset}
                onClick={() => controller.chooseViewerState(name, preset)}
              >
                {STATE_INFO[preset].label}
              </Chip>
            ))}
            {whatIf !== null ? (
              <Chip state="add" onClick={() => controller.setViewerState(name, null)}>
                Undo
              </Chip>
            ) : null}
          </div>
        </div>
      ) : null}

      {tour !== null && !compact ? <TourControls wandered={wandered} present={present} /> : null}
    </Panel>
  );
}

function TourControls({ wandered, present }: { wandered: boolean; present: boolean }) {
  const controller = useViewerController();
  const cursor = useViewerShallow((s) => ({ tour: s.tour })).tour;
  const tour = controller.tour();
  if (cursor === null || tour === null) return null;
  const step = stepFor(tour, cursor.step);
  const exits = exitsOf(step);
  const choices = step.choices;
  const { index, total } = stepNumber(tour, cursor);
  const atEnd = exits.length === 0;

  return (
    <div className="flex flex-col gap-3 border-t border-border-muted bg-fill-faint px-4 py-3">
      <div className="flex items-center gap-2 text-caption text-fg-muted">
        <Flag className="size-3.5" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{tour.title}</span>
        <span className="tabular-nums">
          {index} / {total}
        </span>
      </div>
      <div className="h-0.5 overflow-hidden rounded-full bg-fill-strong" aria-hidden>
        <div
          className="h-full rounded-full bg-fg transition-[width] duration-500"
          style={{ width: `${Math.min(100, (index / Math.max(1, total)) * 100)}%` }}
        />
      </div>
      {wandered ? (
        <Button variant="secondary" size="sm" onClick={() => void controller.resumeTour()}>
          <Undo2 />
          Back to step {index}
        </Button>
      ) : null}
      {choices.length > 0 ? (
        <div className="flex flex-col gap-1.5" role="group" aria-label="Choose where to go">
          {choices.map((choice, i) => (
            <button
              key={`${choice.label}-${i}`}
              type="button"
              onClick={() => void controller.nextStep(i)}
              className="flex items-center gap-2.5 rounded-md border border-border bg-raised px-3 py-2 text-left text-label text-fg-soft transition-colors hover:border-border-emphasis hover:text-fg"
            >
              <CornerDownRight className="size-3.5 shrink-0 text-fg-muted" aria-hidden />
              <span className="min-w-0 flex-1">{choice.label}</span>
              {present && i < 9 ? <Kbd>{i + 1}</Kbd> : null}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={cursor.history.length === 0}
          onClick={() => void controller.previousStep()}
          aria-keyshortcuts="ArrowLeft"
        >
          <ArrowLeft />
          Back
        </Button>
        <span className="flex-1" />
        {atEnd ? (
          <Button variant="primary" size="sm" onClick={() => void controller.endTour()}>
            Finish tour
          </Button>
        ) : choices.length === 0 ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => void controller.nextStep(0)}
            aria-keyshortcuts="ArrowRight"
          >
            Next
            <ArrowRight />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** What a link button says: where it goes. */
function linkLabel(link: ElementLink): string {
  switch (link.kind) {
    case "url":
      return link.url.replace(/^https?:\/\//, "").replace(/^mailto:/, "Email ");
    case "scene":
      return `Show the ${link.scene.replace(/_/g, " ")} scene`;
    case "tour":
      return `Start the ${link.tour.replace(/_/g, " ")} tour`;
    case "element":
      return `Go to ${link.element.replace(/_/g, " ")}`;
  }
}
