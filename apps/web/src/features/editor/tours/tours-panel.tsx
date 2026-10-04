"use client";

import { useState } from "react";
import {
  ArrowLeft,
  GitBranch,
  MousePointerClick,
  PanelRightClose,
  Play,
  Plus,
  Route,
  Trash2,
  X,
} from "lucide-react";
import {
  addTour,
  deleteTour,
  removeTourStep,
  setTourChoices,
  updateTour,
  updateTourStep,
  type ChoiceInput,
} from "@mogram/core/edit";
import type { Diagram, Tour } from "@mogram/core/model";
import { reachableSteps, stepFor, tourStart } from "@mogram/core/tours";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Panel, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { useEditor, useEditorShallow, useEditorStore } from "../editor-context";
import { exitNested } from "../levels";
import { useOpenViewer } from "../persistence/host";
import { storyDiagram } from "../store/editor-store";
import { CommitInput } from "../inspector/fields";

/** Tour authoring (TO-9, TO-10): click elements in order, then add choices where it branches. */
export function ToursPanel({ onClose }: { onClose: () => void }) {
  const store = useEditorStore();
  const diagram = useEditor((s) => s.parsed().diagram);
  const { authoring, nested, files } = useEditorShallow((s) => ({
    authoring: s.tourAuthoring,
    nested: s.levelPath.length > 0,
    files: s.files,
  }));
  const [selected, setSelected] = useState<string | null>(diagram.tours[0]?.name ?? null);
  const tour = diagram.tours.find((t) => t.name === selected) ?? diagram.tours[0] ?? null;

  const create = () => {
    let created: string | undefined;
    const ok = store.getState().edit("New tour", (f, d) => {
      const result = addTour(f, d, { title: `Tour ${d.tours.length + 1}` });
      created = result.named;
      return result;
    });
    if (ok && created !== undefined) {
      setSelected(created);
      store.getState().setTourAuthoring(created);
    }
  };

  return (
    <Panel role="region" className="flex h-full w-full flex-col overflow-hidden" aria-label="Tours">
      <PanelHeader>
        <PanelTitle>Tours</PanelTitle>
        <IconButton label="New tour" size="sm" onClick={create}>
          <Plus />
        </IconButton>
        <IconButton label="Hide tours" size="sm" onClick={onClose}>
          <PanelRightClose />
        </IconButton>
      </PanelHeader>
      {nested ? (
        // Tours belong to the top diagram, the one people open (TO-10); they can still step
        // inside nested diagrams (`aks.checkout`).
        <EmptyState
          icon={<Route />}
          title={`Tours belong to ${storyDiagram(files).settings.name}`}
          description="A tour starts from the top diagram and can step into nested diagrams on the way. Go back to the top to write or change one."
          action={
            <Button variant="secondary" size="sm" onClick={() => exitNested(store, 0)}>
              <ArrowLeft /> Back to {storyDiagram(files).settings.name}
            </Button>
          }
        />
      ) : diagram.tours.length === 0 || tour === null ? (
        <EmptyState
          icon={<Route />}
          title="No tours yet"
          description="A tour walks people through the system, element by element, with the camera following the traffic."
          action={
            <Button variant="primary" size="sm" onClick={create}>
              <Plus /> Create a tour
            </Button>
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto border-b border-border-muted px-2 py-1.5"
            role="tablist"
            aria-label="Tours"
          >
            {diagram.tours.map((item) => (
              <button
                key={item.name}
                type="button"
                role="tab"
                aria-selected={item.name === tour.name}
                onClick={() => setSelected(item.name)}
                className={cn(
                  "h-7 shrink-0 rounded-md px-2.5 text-caption font-medium transition-colors",
                  item.name === tour.name
                    ? "bg-fill-active text-fg"
                    : "text-fg-faint hover:bg-fill-hover hover:text-fg-soft",
                )}
              >
                {item.title}
              </button>
            ))}
          </div>
          <TourEditor
            key={tour.name}
            diagram={diagram}
            tour={tour}
            authoring={authoring === tour.name}
          />
        </div>
      )}
    </Panel>
  );
}

function TourEditor({
  diagram,
  tour,
  authoring,
}: {
  diagram: Diagram;
  tour: Tour;
  authoring: boolean;
}) {
  const openViewer = useOpenViewer();
  const store = useEditorStore();
  const steps = reachableSteps(tour);
  const elements = [...diagram.components.values(), ...diagram.containers.values()];
  const elementOptions = elements.map((e) => ({ value: e.name, label: e.label }));
  const sceneOptions = [
    { value: "__keep", label: "Keep current scene" },
    { value: "normal", label: "Normal" },
    ...diagram.scenes.map((s) => ({ value: s.name, label: s.label })),
  ];
  const labelOf = (name: string): string =>
    diagram.components.get(name)?.label ?? diagram.containers.get(name)?.label ?? name;
  const start = tourStart(tour);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-2 border-b border-border-subtle px-3.5 py-3">
        <CommitInput
          label="Tour title"
          value={tour.title}
          onCommit={(title) =>
            store
              .getState()
              .edit("Rename tour", (f, d) => updateTour(f, d, { tour: tour.name, title }))
          }
        />
        <div className="flex gap-1.5">
          <Button
            variant={authoring ? "primary" : "secondary"}
            size="sm"
            className="flex-1"
            onClick={() => store.getState().setTourAuthoring(authoring ? null : tour.name)}
            aria-pressed={authoring}
          >
            <MousePointerClick />
            {authoring ? "Done adding steps" : "Add steps"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void openViewer(`?tour=${tour.name}`)}>
            <Play /> Play
          </Button>
          <IconButton
            label="Delete tour"
            onClick={() =>
              store.getState().edit("Delete tour", (f, d) => deleteTour(f, d, tour.name))
            }
          >
            <Trash2 />
          </IconButton>
        </div>
        {authoring ? (
          <p className="rounded-md border border-green-line bg-green-fill px-2.5 py-2 text-caption text-green">
            Click elements on the canvas in the order the tour should visit them.
          </p>
        ) : null}
      </div>
      {steps.length === 0 ? (
        <p className="px-3.5 py-6 text-center text-label text-fg-muted">
          No steps yet. Choose “Add steps”, then click elements on the canvas.
        </p>
      ) : (
        <ol className="flex flex-col">
          {steps.map((target, index) => {
            const step = stepFor(tour, target);
            const branching = step.choices.length > 0;
            const choices: ChoiceInput[] = step.choices.map((c) => ({
              label: c.label,
              next: c.next,
              scene: c.scene,
            }));
            const setChoices = (next: ChoiceInput[]) =>
              store
                .getState()
                .edit("Edit choices", (f, d) =>
                  setTourChoices(f, d, { tour: tour.name, step: target, choices: next }),
                );
            return (
              <li key={target} className="border-b border-border-subtle px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-micro tabular-nums text-fg-secondary">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-label font-medium text-fg hover:underline"
                    onClick={() => store.getState().select([target.split(".")[0] ?? target])}
                  >
                    {labelOf(target)}
                  </button>
                  {target === start ? (
                    <Badge tone="green" size="sm">
                      Start
                    </Badge>
                  ) : null}
                  <IconButton
                    label="Remove step"
                    size="sm"
                    onClick={() =>
                      store
                        .getState()
                        .edit("Remove step", (f, d) =>
                          removeTourStep(f, d, { tour: tour.name, target }),
                        )
                    }
                  >
                    <X />
                  </IconButton>
                </div>
                <div className="mt-2 flex flex-col gap-1.5 pl-8">
                  <Select
                    label="Scene at this step"
                    value={step.scene ?? "__keep"}
                    onChange={(scene) =>
                      store.getState().edit("Step scene", (f, d) =>
                        updateTourStep(f, d, {
                          tour: tour.name,
                          step: target,
                          set: { scene: scene === "__keep" ? null : scene },
                        }),
                      )
                    }
                    options={sceneOptions}
                  />
                  {branching ? (
                    <div className="flex flex-col gap-1.5">
                      {choices.map((choice, ci) => (
                        <div
                          key={ci}
                          className="rounded-md border border-border-subtle bg-fill-faint p-2"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-micro text-fg-muted">
                              {String.fromCharCode(65 + ci)}
                            </span>
                            <CommitInput
                              label="Choice label"
                              value={choice.label}
                              onCommit={(label) =>
                                setChoices(choices.map((c, i) => (i === ci ? { ...c, label } : c)))
                              }
                            />
                            <IconButton
                              label="Remove choice"
                              size="sm"
                              onClick={() => setChoices(choices.filter((_, i) => i !== ci))}
                            >
                              <X />
                            </IconButton>
                          </div>
                          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                            <Select
                              label="Goes to"
                              value={choice.next ?? ""}
                              onChange={(next) =>
                                setChoices(choices.map((c, i) => (i === ci ? { ...c, next } : c)))
                              }
                              options={elementOptions}
                            />
                            <Select
                              label="Choice scene"
                              value={choice.scene ?? "__keep"}
                              onChange={(scene) =>
                                setChoices(
                                  choices.map((c, i) =>
                                    i === ci
                                      ? { ...c, scene: scene === "__keep" ? null : scene }
                                      : c,
                                  ),
                                )
                              }
                              options={sceneOptions}
                            />
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setChoices([
                            ...choices,
                            {
                              label: `Option ${String.fromCharCode(65 + choices.length)}`,
                              next: elements[0]?.name ?? null,
                            },
                          ])
                        }
                      >
                        <Plus /> Add choice
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Select
                        label="Then go to"
                        value={step.next ?? "__end"}
                        onChange={(next) =>
                          store.getState().edit("Step next", (f, d) =>
                            updateTourStep(f, d, {
                              tour: tour.name,
                              step: target,
                              set: { next: next === "__end" ? null : next },
                            }),
                          )
                        }
                        options={[{ value: "__end", label: "End of tour" }, ...elementOptions]}
                      />
                      <IconButton
                        label="Branch here"
                        onClick={() => {
                          // Neither path should lead straight back to this step.
                          const others = elements.filter((e) => e.name !== target);
                          const next = step.next ?? others[0]?.name ?? null;
                          const another = others.find((e) => e.name !== next)?.name ?? null;
                          setChoices([
                            { label: "Continue", next },
                            { label: "Another path", next: another },
                          ]);
                        }}
                      >
                        <GitBranch />
                      </IconButton>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
