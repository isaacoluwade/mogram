// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateElement } from "@mogram/core/edit";
import { EditorProvider, useEditor, useEditorStore } from "../editor-context";
import type { EditorStore } from "../store/editor-store";
import { CommitInput, SAVE_AFTER_MS } from "./fields";
import { NameAndFile } from "./shared";

const FILES = {
  "mogram.yaml":
    "components:\n  web: generic/server\n  db: generic/database\nlayout:\n  web: [0, 0]\n  db: [20, 0]\n",
};

/** A label field wired to the real editor store, as the inspector wires it. */
function LabelField({ name }: { name: string }) {
  const store = useEditorStore();
  const label = useEditor((s) => s.parsed().diagram.components.get(name)?.label ?? "");
  return (
    <CommitInput
      label="Label"
      value={label}
      onCommit={(next) =>
        store
          .getState()
          .edit("Rename label", (f, d) => updateElement(f, d, { name, set: { label: next } }))
      }
    />
  );
}

let store: EditorStore | null = null;
const files = () => store?.getState().files ?? {};
const past = () => store?.getState().past.length ?? 0;

/** Hands the editor's store to the test once mounted. */
function Probe() {
  const current = useEditorStore();
  useEffect(() => {
    store = current;
  }, [current]);
  return null;
}

function renderInEditor(ui: React.ReactNode) {
  return render(
    <EditorProvider init={{ files: FILES }}>
      <Probe />
      {ui}
    </EditorProvider>,
  );
}

function type(field: HTMLElement, text: string) {
  fireEvent.change(field, { target: { value: text } });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CommitInput saves as you type", () => {
  it("saves after a pause in typing, with no Enter or leaving the field", () => {
    renderInEditor(<LabelField name="web" />);
    const field = screen.getByLabelText("Label");
    fireEvent.focus(field);
    type(field, "Web tier");
    expect(files()["mogram.yaml"]).not.toContain("Web tier");
    act(() => {
      vi.advanceTimersByTime(SAVE_AFTER_MS);
    });
    expect(files()["mogram.yaml"]).toContain("label: Web tier");
  });

  it("keeps one visit to the field as one undo step, and Escape takes it back", () => {
    renderInEditor(<LabelField name="web" />);
    const field = screen.getByLabelText("Label");
    field.focus();
    fireEvent.focus(field);
    type(field, "Web");
    act(() => {
      vi.advanceTimersByTime(SAVE_AFTER_MS);
    });
    type(field, "Web tier");
    act(() => {
      vi.advanceTimersByTime(SAVE_AFTER_MS * 3);
    });
    expect(files()["mogram.yaml"]).toContain("label: Web tier");
    expect(past()).toBe(1);
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.blur(field);
    expect(files()).toEqual(FILES);
    expect((field as HTMLInputElement).value).toBe("Web");
  });

  it("saves what was typed when the field is left before the pause", () => {
    renderInEditor(<LabelField name="web" />);
    const field = screen.getByLabelText("Label");
    fireEvent.focus(field);
    type(field, "Front end");
    fireEvent.blur(field);
    expect(files()["mogram.yaml"]).toContain("label: Front end");
  });

  it("saves text for the element it was typed for, even if the field moves to another", () => {
    const { rerender } = renderInEditor(<LabelField name="web" />);
    const field = screen.getByLabelText("Label");
    fireEvent.focus(field);
    type(field, "Typed for web");
    rerender(
      <EditorProvider init={{ files: FILES }}>
        <Probe />
        <LabelField name="db" />
      </EditorProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(SAVE_AFTER_MS);
    });
    const yaml = files()["mogram.yaml"] ?? "";
    expect(yaml).toContain("label: Typed for web");
    expect(yaml.indexOf("label: Typed for web")).toBeLessThan(yaml.indexOf("  db:"));
  });
});

describe("the Name field", () => {
  function NameField() {
    const diagram = useEditor((s) => s.parsed().diagram);
    return <NameAndFile diagram={diagram} name="web" file="mogram.yaml" />;
  }

  it("renames as you type, and holds back names that aren't valid yet, saying why", () => {
    renderInEditor(<NameField />);
    const field = screen.getByLabelText("Name");
    fireEvent.focus(field);
    type(field, "db");
    act(() => {
      vi.advanceTimersByTime(SAVE_AFTER_MS);
    });
    expect(screen.getByText(/"db" is already used by another element/)).toBeTruthy();
    expect(files()).toEqual(FILES);

    type(field, "9web");
    expect(screen.getByText(/Names start with a letter/)).toBeTruthy();

    type(field, "web_server");
    act(() => {
      vi.advanceTimersByTime(SAVE_AFTER_MS);
    });
    expect(files()["mogram.yaml"]).toContain("web_server: generic/server");
  });
});
