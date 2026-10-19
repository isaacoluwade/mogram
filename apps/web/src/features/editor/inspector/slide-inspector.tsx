"use client";

import { findDiagramFolders } from "@mogram/core/format";
import { setDeckSetting, updateSlide } from "@mogram/core/edit";
import type { EditResult, SlideFields } from "@mogram/core/edit";
import type { Diagram } from "@mogram/core/model";
import type { ProjectFiles } from "@mogram/core/model";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useEditorShallow, useEditorStore } from "../editor-context";
import { zoomToFit } from "../actions";
import { parseCached, shownFiles } from "../store/editor-store";
import { CommitInput, FieldRow, FieldStack, InspectorSection } from "./fields";

const NONE = "__mogram_none__";

/** Deck-wide settings and the action for editing its shared frame diagram. */
export function DeckSettings({ diagram }: { diagram: Diagram }) {
  const store = useEditorStore();
  const { files, deckRoot, readOnly } = useEditorShallow((state) => ({
    files: shownFiles(state),
    deckRoot: state.deckRoot,
    readOnly: state.busy !== null || state.viewing !== null || state.assistant !== null,
  }));
  const deck = diagram.settings.deck;
  if (deck === null || deckRoot === null) return null;
  // A frame is a diagram: never the deck itself, nor another deck.
  const folders = findDiagramFolders(files).filter(
    (folder) => folder !== deckRoot && parseCached(files, folder).diagram.settings.deck === null,
  );
  const frameOptions = [
    { value: NONE, label: "No shared frame" },
    ...(deck.frame !== null && !folders.includes(deck.frame)
      ? [{ value: deck.frame, label: `${deck.frame} (unavailable)` }]
      : []),
    ...folders.map((folder) => ({ value: folder, label: folder })),
  ];

  const change = (run: (files: ProjectFiles, deckDiagram: Diagram) => EditResult) =>
    store
      .getState()
      .edit("Deck setting", (currentFiles) =>
        run(currentFiles, parseCached(currentFiles, deckRoot).diagram),
      );

  return (
    <InspectorSection id="deck" title="Deck">
      <FieldStack>
        <FieldRow label="Frame">
          <Select
            label="Deck frame"
            value={deck.frame ?? NONE}
            disabled={readOnly}
            onChange={(frame) =>
              change((currentFiles, deckDiagram) =>
                setDeckSetting(currentFiles, deckDiagram, {
                  key: "frame",
                  value: frame === NONE ? null : frame,
                }),
              )
            }
            options={frameOptions}
          />
        </FieldRow>
        <FieldRow label="Captions">
          <Switch
            checked={deck.captions}
            disabled={readOnly}
            aria-label="Show captions by default"
            onCheckedChange={(captions) =>
              change((currentFiles, deckDiagram) =>
                setDeckSetting(currentFiles, deckDiagram, { key: "captions", value: captions }),
              )
            }
          />
        </FieldRow>
        {deck.frame !== null ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={readOnly}
            onClick={() => {
              if (store.getState().showDeckFrame()) zoomToFit(store);
            }}
          >
            Edit frame diagram
          </Button>
        ) : null}
      </FieldStack>
    </InspectorSection>
  );
}

/**
 * The Slide tab (D-100): what the deck says about this slide, apart from what its diagram says.
 * Its title, which story it plays and which stretch of it, a scene over it, its frame, and
 * whether it's skipped.
 */
export function SlideInspector({ deckRoot, item }: { deckRoot: string; item: number }) {
  const store = useEditorStore();
  const { files, locked } = useEditorShallow((state) => ({
    files: shownFiles(state),
    locked: state.busy !== null || state.viewing !== null || state.assistant !== null,
  }));
  const deck = parseCached(files, deckRoot).diagram.settings.deck;
  const entry = deck?.entries.find((each) => each.item === item);
  if (deck === null || entry?.kind !== "slide") return null;
  // The slide's own diagram, whatever level of it is open on the canvas.
  const diagram = parseCached(files, entry.folder).diagram;

  const change = (patch: SlideFields, label = "Change slide") =>
    store
      .getState()
      .edit(label, (current) =>
        updateSlide(current, parseCached(current, deckRoot).diagram, { item, patch }),
      );
  const story = diagram.stories.find((each) => each.name === entry.story) ?? diagram.stories[0];
  const named = (story?.steps ?? []).flatMap((step, index) =>
    step.name === null
      ? []
      : [{ name: step.name, index, label: step.say ?? step.script ?? step.name }],
  );
  const fromIndex = named.find((step) => step.name === entry.from)?.index ?? -1;
  // A name a step no longer has is still shown, so it can be seen and changed.
  const keep = (value: string | null, options: { value: string; label: string }[]) =>
    value === null || options.some((option) => option.value === value)
      ? options
      : [...options, { value, label: `${value} (not in the story)` }];
  const stepLabel = (step: { name: string; label: string }) =>
    step.label === step.name ? step.name : `${step.name}: ${step.label.slice(0, 40)}`;

  return (
    <>
      <InspectorSection id="slide" title="Slide">
        <FieldStack>
          <FieldRow label="Title">
            <CommitInput
              label="Slide title"
              value={entry.title ?? ""}
              placeholder={diagram.settings.name}
              live={false}
              onCommit={(title) => change({ title: title.trim() === "" ? null : title.trim() })}
            />
          </FieldRow>
          <FieldRow label="Story">
            <Select
              label="Story it plays"
              value={entry.story ?? NONE}
              disabled={locked || diagram.stories.length === 0}
              options={keep(entry.story, [
                {
                  value: NONE,
                  label: diagram.stories.length === 0 ? "None: a still slide" : "The first",
                },
                ...diagram.stories.map((each) => ({ value: each.name, label: each.label })),
              ])}
              onChange={(value) => change({ story: value === NONE ? null : value })}
            />
          </FieldRow>
          {/* Only where there's a scene to lay over it (or one written that's since gone). */}
          {diagram.scenes.length > 0 || entry.scene !== null ? (
            <FieldRow label="Scene">
              <Select
                label="Scene over it"
                value={entry.scene ?? NONE}
                disabled={locked}
                options={keep(entry.scene, [
                  { value: NONE, label: "None" },
                  ...diagram.scenes.map((scene) => ({ value: scene.name, label: scene.label })),
                ])}
                onChange={(value) => change({ scene: value === NONE ? null : value })}
              />
            </FieldRow>
          ) : null}
        </FieldStack>
      </InspectorSection>
      {story !== undefined ? (
        <InspectorSection id="slide-stretch" title="Stretch of the story">
          <FieldStack>
            <p className="text-caption text-fg-muted">
              A slide can play part of its story. Name a step in the Story dock to start or stop
              there, or use “Start a new slide here” on a beat.
            </p>
            <FieldRow label="Starts after">
              <Select
                label="Starts after"
                value={entry.from ?? NONE}
                disabled={locked}
                options={keep(entry.from, [
                  { value: NONE, label: "The beginning" },
                  ...named.map((step) => ({ value: step.name, label: stepLabel(step) })),
                ])}
                onChange={(value) => change({ from: value === NONE ? null : value })}
              />
            </FieldRow>
            <FieldRow label="Stops after">
              <Select
                label="Stops after"
                value={entry.to ?? NONE}
                disabled={locked}
                options={keep(entry.to, [
                  { value: NONE, label: "The end" },
                  ...named
                    .filter((step) => step.index > fromIndex)
                    .map((step) => ({ value: step.name, label: stepLabel(step) })),
                ])}
                onChange={(value) => change({ to: value === NONE ? null : value })}
              />
            </FieldRow>
          </FieldStack>
        </InspectorSection>
      ) : null}
      <InspectorSection id="slide-playing" title="Playing">
        <FieldStack>
          <FieldRow label="Frame">
            <Switch
              aria-label="Draw the deck's frame under this slide"
              checked={entry.frame}
              disabled={locked || deck.frame === null}
              onCheckedChange={(frame) => change({ frame })}
            />
          </FieldRow>
          <FieldRow label="Skip">
            <Switch
              aria-label="Skip this slide when playing"
              checked={entry.skip}
              disabled={locked}
              onCheckedChange={(skip) => change({ skip })}
            />
          </FieldRow>
        </FieldStack>
      </InspectorSection>
    </>
  );
}
