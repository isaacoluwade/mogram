import { preference, setPreference } from "@/lib/preferences";
import type { EditorStore } from "../store/editor-store";

/** What an inspector section listens for to open itself, scroll into view and take focus. */
export const SHOW_SECTION = "mogram:show-section";

/**
 * Opens the inspector on a section of the selected element (a listing's Code, a picture's
 * Picture), with its first field focused: what double-clicking an element with no label to type
 * in does.
 */
export function showInspectorSection(store: EditorStore, id: string): void {
  store.getState().togglePanel("inspector", true);
  setPreference("inspectorTabs", { ...preference("inspectorTabs"), element: "element" });
  // Once the inspector has drawn the newly selected element.
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      window.dispatchEvent(new CustomEvent(SHOW_SECTION, { detail: id })),
    ),
  );
}
