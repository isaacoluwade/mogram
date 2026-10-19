import { describe, expect, it } from "vitest";
import { fitCamera } from "./actions";
import { createEditorStore } from "./store/editor-store";

describe("fitCamera", () => {
  it("centres deck slides between the rail and the open library", () => {
    const store = createEditorStore({
      files: {
        "mogram.yaml": "mogram: 1\nname: Course\ndeck:\n  slides: [slides/first]\n",
        "slides/first/mogram.yaml": "mogram: 1\nname: First\n",
      },
    });
    store.getState().setViewport({ width: 1200, height: 800 });

    const railOnly = fitCamera(store, { x: 0, y: 0, w: 100, h: 100 });
    store.getState().togglePanel("library", true);
    const railAndLibrary = fitCamera(store, { x: 0, y: 0, w: 100, h: 100 });

    expect(railAndLibrary.x).toBe(railOnly.x + 150);
  });
});
