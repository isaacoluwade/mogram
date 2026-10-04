import { describe, expect, it } from "vitest";
import { moveElements, updateElement } from "@mogram/core/edit";
import { createEditorStore } from "./editor-store";

const FILES = {
  "mogram.yaml":
    "components:\n  web: generic/server\n  db: generic/database\nlayout:\n  web: [0, 0]\n  db: [20, 0]\n",
};

describe("editor store", () => {
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

  it("shows one right-hand panel at a time, and one panel at all on narrow screens", () => {
    const store = createEditorStore({ files: FILES });
    store.getState().togglePanel("code", true);
    expect(store.getState().panels).toMatchObject({ code: true, inspector: false, library: true });
    store.getState().setViewport({ width: 834, height: 1112 });
    store.getState().togglePanel("tours", true);
    expect(store.getState().panels).toEqual({
      library: false,
      inspector: false,
      code: false,
      tours: true,
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
