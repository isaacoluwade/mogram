import { describe, expect, it } from "vitest";
import { createEditorStore } from "./store/editor-store";
import { viewerQuery } from "./viewer-link";

const DECK = {
  "mogram.yaml":
    "mogram: 1\nname: Course\ndeck:\n  slides:\n    - section: Intro\n    - first\n    - flow\n",
  "first/mogram.yaml": "mogram: 1\nname: First\n",
  "flow/mogram.yaml": `mogram: 1
name: Flow
shapes:
  a: { label: A }
stories:
  main:
    - say: One
    - say: Two
layout:
  a: [0, 0]
`,
};

describe("the viewer's address for what the editor shows", () => {
  it("opens a deck on the slide being edited, and how far into it", () => {
    const store = createEditorStore({ files: DECK, slide: 2 });
    expect(store.getState().root).toBe("flow");
    expect(viewerQuery(store.getState())).toBe("?slide=2");
    store.getState().setStory({ story: "main", index: 0 }, 0);
    expect(viewerQuery(store.getState(), { present: true })).toBe("?slide=2&beat=1&present=1");
  });

  it("names the deck's folder when the deck isn't the project's own", () => {
    const files = Object.fromEntries(
      Object.entries(DECK).map(([path, text]) => [`talks/${path}`, text]),
    );
    const store = createEditorStore({
      files: { ...files, "mogram.yaml": "mogram: 1\nname: Home\n" },
      root: "talks",
    });
    expect(viewerQuery(store.getState())).toBe("?root=talks&slide=1");
  });

  it("is the level, scene and beat outside a deck", () => {
    const store = createEditorStore({ files: { "mogram.yaml": DECK["flow/mogram.yaml"] } });
    expect(viewerQuery(store.getState())).toBe("");
    store.getState().setStory({ story: "main", index: 1 }, 0);
    expect(viewerQuery(store.getState())).toBe("?story=main&beat=2");
  });
});
