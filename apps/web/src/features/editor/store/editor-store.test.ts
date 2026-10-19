import { describe, expect, it } from "vitest";
import { moveElements, moveEntries, updateElement } from "@mogram/core/edit";
import { parseDiagram } from "@mogram/core/format";
import { createEditorStore, dockOf, scenesOffered } from "./editor-store";

const FILES = {
  "mogram.yaml":
    "components:\n  web: generic/server\n  db: generic/database\nlayout:\n  web: [0, 0]\n  db: [20, 0]\n",
};

describe("editor store", () => {
  const DECK_FILES = {
    "mogram.yaml": `mogram: 1
name: Course
page: 16:9
theme: midnight
deck:
  slides:
    - section: Intro
    - slides/first
    - slides/second
`,
    "slides/first/mogram.yaml": "mogram: 1\nname: First\n",
    "slides/second/mogram.yaml":
      "mogram: 1\nname: Second\ncomponents:\n  service: generic/server\n",
  };

  it("includes cross-folder deck errors in the editor diagnostics", () => {
    const store = createEditorStore({
      files: {
        "mogram.yaml": "mogram: 1\nname: Course\ndeck:\n  slides: [lesson]\n",
      },
    });

    expect(store.getState().parsed().diagnostics).toContainEqual(
      expect.objectContaining({
        file: "mogram.yaml",
        severity: "error",
        message: 'Slide 1 is "lesson", but no folder with that name holds a diagram.',
      }),
    );
  });

  it("selects deck slides as the active root and restores the slide on undo and redo", () => {
    const store = createEditorStore({ files: DECK_FILES });
    expect(store.getState()).toMatchObject({
      root: "slides/first",
      deckRoot: "",
      slide: 1,
      folder: "slides/first",
      panels: { library: false },
    });
    expect(store.getState().parsed().diagram.settings).toMatchObject({
      page: "16:9",
      theme: "midnight",
    });

    store.getState().showSlide(null);
    expect(store.getState()).toMatchObject({ root: "", deckRoot: "", slide: null, folder: "" });
    store.getState().showSlide(2);
    expect(store.getState()).toMatchObject({
      root: "slides/second",
      deckRoot: "",
      slide: 2,
      folder: "slides/second",
    });
    store
      .getState()
      .edit("Reorder slides", (files) =>
        moveEntries(files, parseDiagram(files).diagram, { items: [2], to: 1 }),
      );
    store.getState().showSlide(2);
    expect(store.getState()).toMatchObject({ root: "slides/first", slide: 2 });
    store.getState().showSlide(1);
    store.getState().showSlide(2);
    expect(store.getState()).toMatchObject({ root: "slides/first", slide: 2 });
    store.getState().undo();
    expect(store.getState()).toMatchObject({ root: "slides/second", slide: 2 });
    store.getState().redo();
    expect(store.getState()).toMatchObject({ root: "slides/second", slide: 1 });
    store.getState().undo();
    store.getState().showSlide(2);
    const edited = store
      .getState()
      .edit("Rename service", (files, diagram) =>
        updateElement(files, diagram, { name: "service", set: { label: "Application host" } }),
      );
    expect(edited).toBe(true);
    expect(store.getState().files["slides/second/mogram.yaml"]).toContain("Application host");
    store.getState().showSlide(1);
    store.getState().undo();
    expect(store.getState()).toMatchObject({ root: "slides/second", slide: 2 });
    expect(store.getState().files["slides/second/mogram.yaml"]).not.toContain(
      "label: Application host",
    );

    store.getState().redo();
    expect(store.getState()).toMatchObject({ root: "slides/second", slide: 2 });
    expect(store.getState().files["slides/second/mogram.yaml"]).toContain(
      "label: Application host",
    );
  });

  it("opens a slide on its story, and offers scenes only where the slide has some (D-109)", () => {
    const files = {
      ...DECK_FILES,
      "slides/second/mogram.yaml":
        "mogram: 1\nname: Second\ncomponents:\n  service: generic/server\nscenes:\n  outage:\n    service: down\n",
    };
    const store = createEditorStore({ files });
    // The first slide has no scenes: there's only its story, whatever was picked.
    expect(dockOf(store.getState())).toBe("story");
    expect(scenesOffered(store.getState())).toBe(false);
    store.getState().setDock("scenes");
    expect(dockOf(store.getState())).toBe("story");

    // The second has one: scenes are on offer, and it still opens on the story.
    store.getState().showSlide(2);
    expect(scenesOffered(store.getState())).toBe(true);
    expect(dockOf(store.getState())).toBe("story");
    store.getState().setDock("scenes");
    expect(dockOf(store.getState())).toBe("scenes");
    store.getState().showSlide(1);
    store.getState().showSlide(2);
    expect(dockOf(store.getState())).toBe("story");

    // A diagram on its own opens on its scenes, as before; opened files that are a deck don't.
    const plain = createEditorStore({ files: FILES });
    expect(dockOf(plain.getState())).toBe("scenes");
    expect(scenesOffered(plain.getState())).toBe(true);
    plain.getState().replaceFiles(files, "Open");
    expect(dockOf(plain.getState())).toBe("story");
  });

  it("enters and leaves deck mode when a whole project replaces the open files", () => {
    const store = createEditorStore({ files: FILES });
    store.getState().replaceFiles(DECK_FILES, "Open files");
    expect(store.getState()).toMatchObject({
      root: "slides/first",
      deckRoot: "",
      slide: 1,
      folder: "slides/first",
      panels: { library: false },
    });

    store.getState().replaceFiles(FILES, "Open files");
    expect(store.getState()).toMatchObject({ root: "", deckRoot: null, slide: null, folder: "" });
  });

  it("opens the deck frame for editing and returns to deck settings", () => {
    const store = createEditorStore({
      files: {
        "mogram.yaml": "mogram: 1\nname: Course\ndeck:\n  frame: frame\n  slides: [slides/first]\n",
        "frame/mogram.yaml": "mogram: 1\nname: Frame\n",
        "slides/first/mogram.yaml": "mogram: 1\nname: First\n",
      },
    });

    expect(store.getState().showDeckFrame()).toBe(true);
    expect(store.getState()).toMatchObject({ root: "frame", deckRoot: "", slide: null });
    store.getState().showSlide(null);
    expect(store.getState()).toMatchObject({ root: "", deckRoot: "", slide: null });
  });

  it("runs edits as undoable steps and marks the document unsaved", () => {
    const store = createEditorStore({ files: FILES });
    expect(store.getState().save.kind).toBe("saved");
    store
      .getState()
      .edit("Move", (f, d) =>
        moveElements(f, d, [{ name: "web", parent: null, at: { x: 2, y: 0 } }]),
      );
    expect(store.getState().files["mogram.yaml"]).toContain("web: [2, 0]");
    expect(store.getState().save.kind).toBe("unsaved");
    store.getState().undo();
    expect(store.getState().files).toEqual(FILES);
    store.getState().redo();
    expect(store.getState().files["mogram.yaml"]).toContain("web: [2, 0]");
  });

  it("coalesces rapid edits with the same label into one undo step (typing, nudging)", () => {
    const store = createEditorStore({ files: FILES });
    for (const label of ["A", "AB", "ABC"]) {
      store
        .getState()
        .edit("Rename label", (f, d) => updateElement(f, d, { name: "web", set: { label } }), {
          coalesce: true,
        });
    }
    expect(store.getState().past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().files).toEqual(FILES);
  });

  it("makes everything saved in one visit to a text field one undo step, whatever the pauses", () => {
    const store = createEditorStore({ files: FILES });
    const label = (text: string) =>
      store
        .getState()
        .edit("Rename label", (f, d) => updateElement(f, d, { name: "web", set: { label: text } }));
    store.getState().startTyping("typing-a");
    label("Web");
    label("Web tier");
    store.getState().stopTyping("typing-a");
    label("Web tier 2");
    expect(store.getState().past).toHaveLength(2);
    store.getState().undo();
    store.getState().undo();
    expect(store.getState().files).toEqual(FILES);
  });

  it("takes back a typing session's saves on Escape, and only that session's", () => {
    const store = createEditorStore({ files: FILES });
    const label = (text: string) =>
      store
        .getState()
        .edit("Rename label", (f, d) => updateElement(f, d, { name: "web", set: { label: text } }));
    label("Before");
    const before = store.getState().files;
    store.getState().startTyping("typing-b");
    expect(store.getState().revertTyping("typing-b")).toBe(false);
    label("Typed");
    expect(store.getState().revertTyping("typing-b")).toBe(true);
    expect(store.getState().files).toEqual(before);
    expect(store.getState().revertTyping("typing-b")).toBe(false);
  });

  it("turns edit errors into a message instead of throwing", () => {
    const store = createEditorStore({ files: FILES });
    const ok = store
      .getState()
      .edit("Rename", (f, d) => updateElement(f, d, { name: "missing", set: { label: "x" } }));
    expect(ok).toBe(false);
    expect(store.getState().message?.tone).toBe("error");
  });

  it("keeps a save conflict visible while the person keeps editing", () => {
    const store = createEditorStore({ files: FILES });
    store.getState().setSave({ kind: "conflict", currentVersion: 4 });
    store
      .getState()
      .edit("Move", (f, d) =>
        moveElements(f, d, [{ name: "db", parent: null, at: { x: 21, y: 0 } }]),
      );
    expect(store.getState().save).toEqual({ kind: "conflict", currentVersion: 4 });
  });

  it("makes an assistant turn one undo step, and holds the person's edits meanwhile", () => {
    const store = createEditorStore({ files: FILES });
    const start = store.getState().files;
    const move = (x: number) =>
      moveElements(store.getState().files, store.getState().diagram(), [
        { name: "db", parent: null, at: { x, y: 0 } },
      ]).files;
    store.getState().startAssistant("t1");
    // The person's own edits and undo wait while it works.
    expect(
      store
        .getState()
        .edit("Move", (f, d) =>
          moveElements(f, d, [{ name: "db", parent: null, at: { x: 5, y: 0 } }]),
        ),
    ).toBe(false);
    store
      .getState()
      .applyAssistant("t1", move(30), { label: "Assistant: move", select: ["db"], follow: true });
    const last = move(40);
    store
      .getState()
      .applyAssistant("t1", last, { label: "Assistant: move", select: ["db"], follow: true });
    expect(store.getState().assistant?.touched).toEqual(["db"]);
    expect(store.getState().selection).toEqual(["db"]);
    store.getState().undo();
    expect(store.getState().files).toBe(last);
    store.getState().endAssistant("t1");
    // Both changes go with one undo.
    expect(store.getState().undoAssistant("t1")).toBe(true);
    expect(store.getState().files).toBe(start);
    expect(store.getState().undoAssistant("t1")).toBe(false);
  });

  it("shows one right-hand panel at a time, and one panel at all on narrow screens", () => {
    const store = createEditorStore({ files: FILES });
    store.getState().togglePanel("code", true);
    expect(store.getState().panels).toMatchObject({ code: true, inspector: false, library: true });
    // Narrowing the window leaves the panel in use, not both.
    store.getState().setViewport({ width: 834, height: 1112 });
    expect(store.getState().panels).toMatchObject({ code: true, library: false });
    store.getState().togglePanel("tours", true);
    expect(store.getState().panels).toEqual({
      library: false,
      inspector: false,
      code: false,
      tours: true,
      history: false,
    });
  });

  it("brings the inspector back when code or tours close, only if they covered it", () => {
    const store = createEditorStore({ files: FILES });
    const { togglePanel } = store.getState();
    togglePanel("code", true);
    togglePanel("tours", true); // switching between the covering panels keeps the memory
    togglePanel("tours", false);
    expect(store.getState().panels).toMatchObject({ inspector: true, code: false, tours: false });

    togglePanel("inspector", false);
    togglePanel("code", true);
    togglePanel("code", false);
    expect(store.getState().panels).toMatchObject({ inspector: false, code: false });
  });

  it("keeps showing the last diagram that parsed while typed YAML is broken, and blocks canvas edits", () => {
    const store = createEditorStore({ files: FILES });
    const before = store.getState().diagram();
    expect(before.components.size).toBeGreaterThan(0);
    store
      .getState()
      .replaceFiles({ "mogram.yaml": `${FILES["mogram.yaml"]}bad: [unclosed\n` }, "Edit YAML", {
        typed: true,
      });
    const shown = store.getState().parsed();
    expect(shown.brokenFiles).toEqual(["mogram.yaml"]);
    expect(shown.diagnostics.some((d) => d.severity === "error")).toBe(true);
    expect([...store.getState().diagram().components.keys()]).toEqual([
      ...before.components.keys(),
    ]);

    const edited = store
      .getState()
      .edit("Move", (f, d) =>
        moveElements(f, d, [{ name: "db", parent: null, at: { x: 40, y: 0 } }]),
      );
    expect(edited).toBe(false);
    expect(store.getState().message?.text).toMatch(/Fix the YAML in mogram.yaml/);

    // Opening broken files from the computer has no earlier version to fall back on.
    const opened = createEditorStore({ files: FILES });
    opened.getState().replaceFiles({ "mogram.yaml": "bad: [unclosed\n" }, "Open files");
    expect(opened.getState().diagram().components.size).toBe(0);
  });

  it("drops the selection of elements that no longer exist after undo", () => {
    const store = createEditorStore({ files: FILES });
    store.getState().select(["web", "db"]);
    store
      .getState()
      .replaceFiles({ "mogram.yaml": "components:\n  web: generic/server\n" }, "Open files");
    expect(store.getState().selection).toEqual(["web"]);
  });
});

describe("undo across nested diagrams", () => {
  const NESTED = {
    "mogram.yaml": "components:\n  aks: { type: azure/kubernetes-services, opens: ./aks }\n",
    "aks/mogram.yaml": "components:\n  web: generic/server\n",
  };

  it("goes back to the level the step was made at, and asks for it to be framed", () => {
    const store = createEditorStore({ files: NESTED });
    store.getState().openLevel("aks", "aks");
    store
      .getState()
      .edit("Rename", (f, d) => updateElement(f, d, { name: "web", set: { label: "Web tier" } }));
    store.getState().closeLevel();
    expect(store.getState().levelPath).toEqual([]);
    const fits = store.getState().fitRequest;
    store.getState().undo();
    expect(store.getState().levelPath).toEqual(["aks"]);
    expect(store.getState().folder).toBe("aks");
    expect(store.getState().fitRequest).toBe(fits + 1);
    expect(store.getState().files).toEqual(NESTED);
    // Redo stays where it is: the step was made here.
    store.getState().redo();
    expect(store.getState().levelPath).toEqual(["aks"]);
    expect(store.getState().files["aks/mogram.yaml"]).toContain("label: Web tier");
  });
});
