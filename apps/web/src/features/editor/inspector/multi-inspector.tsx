"use client";

import { updateElement } from "@mogram/core/edit";
import type { Connection, Diagram } from "@mogram/core/model";
import {
  FLOW_INFO,
  FLOW_PRESETS,
  MOTION_INFO,
  MOTION_PRESETS,
  TONES,
  TONE_NAMES,
} from "@mogram/core/presets";
import { cn } from "@/lib/cn";
import { setFlow, setMotion, setState } from "../actions";
import type { SelectionInfo } from "../commands/selection";
import { useEditorStore } from "../editor-context";
import { ConnectionStyle } from "./connection-inspector";
import { NamedStyleSection } from "./named-style";
import { ColorField, InspectorSection, PresetGrid, StatePicker } from "./fields";
import { StyleClipboard, effectiveState, sceneLabel, sceneValue, useSceneView } from "./shared";
import type { InspectorTab } from "./tabs";

/** One value every name shares, or null when they differ. */
function shared<T>(names: readonly string[], pick: (name: string) => T): T | null {
  const first = names[0];
  if (first === undefined) return null;
  const value = pick(first);
  return names.every((name) => pick(name) === value) ? value : null;
}

const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Several things selected (04-format-panel §16.4): each kind's controls show the real shared
 * value, or nothing pressed when the selection differs, and write to every element they apply to.
 * Arrange (align, distribute, order, grouping) is the shared tab.
 */
export function MultiInspector({
  diagram,
  sel,
  tab,
}: {
  diagram: Diagram;
  sel: SelectionInfo;
  tab: InspectorTab;
}) {
  const store = useEditorStore();
  const view = useSceneView();
  if (tab === "arrange") return null;

  if (tab === "style") {
    const colourable = [...sel.components, ...sel.containers, ...sel.connections];
    const colour = shared(
      colourable,
      (name) =>
        diagram.components.get(name)?.color ??
        diagram.containers.get(name)?.color ??
        diagram.connections.get(name)?.color ??
        null,
    );
    const mixed =
      colour === null &&
      colourable.some(
        (name) =>
          (diagram.components.get(name)?.color ??
            diagram.containers.get(name)?.color ??
            diagram.connections.get(name)?.color ??
            null) !== null,
      );
    const connections = sel.connections
      .map((name) => diagram.connections.get(name))
      .filter((c): c is Connection => c !== undefined);
    const tones = sel.decorations.filter(
      (name) => diagram.decorations.get(name)?.variant !== "note",
    );
    const tone = shared(tones, (name) => diagram.decorations.get(name)?.tone ?? "neutral");
    return (
      <>
        {colourable.length > 0 && diagram.styles.size > 0 ? (
          <NamedStyleSection diagram={diagram} names={colourable} />
        ) : null}
        {colourable.length > 0 ? (
          <InspectorSection id="colour" title={`Colour · ${plural(colourable.length, "element")}`}>
            <ColorField
              label="Colour for all selected"
              value={colour}
              mixed={mixed}
              onChange={(color, live) =>
                store.getState().edit(
                  "Change colour",
                  (files, d) => {
                    let result = { files };
                    for (const name of colourable)
                      result = updateElement(result.files, d, { name, set: { color } });
                    return result;
                  },
                  { coalesce: live },
                )
              }
            />
          </InspectorSection>
        ) : null}
        {connections.length > 0 ? <ConnectionStyle connections={connections} /> : null}
        {tones.length > 0 ? (
          <InspectorSection id="tone" title={`Tone · ${plural(tones.length, "decoration")}`}>
            <div role="radiogroup" aria-label="Tone" className="flex flex-wrap gap-1.5">
              {TONE_NAMES.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={tone === option}
                  aria-label={option}
                  onClick={() =>
                    store.getState().edit("Change tone", (files, d) => {
                      let result = { files };
                      for (const name of tones)
                        result = updateElement(result.files, d, { name, set: { tone: option } });
                      return result;
                    })
                  }
                  className={cn(
                    "size-7 rounded-full border-2 transition-transform hover:scale-110",
                    tone === option ? "border-fg" : "border-transparent",
                  )}
                  style={{ background: TONES[option].dark.solid }}
                />
              ))}
            </div>
          </InspectorSection>
        ) : null}
        <StyleClipboard />
      </>
    );
  }

  const state = shared(sel.placeables, (name) =>
    effectiveState(
      view,
      name,
      diagram.components.get(name)?.state ?? diagram.containers.get(name)?.state ?? "healthy",
    ),
  );
  const motion = shared(
    sel.components,
    (name) => sceneValue(view, name)?.motion ?? diagram.components.get(name)?.motion ?? "none",
  );
  const flow = shared(
    sel.connections,
    (name) => sceneValue(view, name)?.flow ?? diagram.connections.get(name)?.flow ?? "idle",
  );
  return (
    <>
      {sel.placeables.length > 0 ? (
        <InspectorSection
          id="state"
          title={`State · ${sceneLabel(view)} · ${plural(sel.placeables.length, "element")}`}
        >
          <StatePicker
            label="State for all selected"
            value={state}
            onChange={(next) => setState(store, sel.placeables, next)}
          />
        </InspectorSection>
      ) : null}
      {sel.components.length > 0 ? (
        <InspectorSection
          id="motion"
          title={`Motion · ${plural(sel.components.length, "component")}`}
        >
          <PresetGrid
            options={MOTION_PRESETS}
            value={motion}
            onChange={(next) => setMotion(store, sel.components, next)}
            label="Motion for all selected"
            describe={(m) => MOTION_INFO[m]}
          />
        </InspectorSection>
      ) : null}
      {sel.connections.length > 0 ? (
        <InspectorSection
          id="flow"
          title={`Flow · ${sceneLabel(view)} · ${plural(sel.connections.length, "connection")}`}
        >
          <PresetGrid
            options={FLOW_PRESETS}
            value={flow}
            onChange={(next) => setFlow(store, sel.connections, next)}
            label="Flow for all selected"
            describe={(f) => FLOW_INFO[f]}
            dot={(f) => TONES[FLOW_INFO[f].tone].dark.solid}
          />
        </InspectorSection>
      ) : null}
      {sel.placeables.length === 0 && sel.connections.length === 0 ? (
        <InspectorSection title="Selection">
          <p className="text-caption text-fg-muted">
            Style and arrange them together from the other tabs.
          </p>
        </InspectorSection>
      ) : null}
    </>
  );
}
