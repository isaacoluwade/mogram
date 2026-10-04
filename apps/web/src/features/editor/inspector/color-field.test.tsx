// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorProvider } from "../editor-context";
import { ColorField } from "./fields";

const FILES = { "mogram.yaml": "mogram: 1\n" };

describe("ColorField", () => {
  it("opens the colour picker from the swatch; picked and typed colours are final", async () => {
    const onChange = vi.fn();
    render(
      <EditorProvider init={{ files: FILES }}>
        <ColorField label="Line colour" value="#112233" onChange={onChange} />
      </EditorProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Line colour colour: #112233" }));
    fireEvent.click(await screen.findByRole("button", { name: "Red" }));
    expect(onChange).toHaveBeenLastCalledWith("#ef4444", false);

    const text = screen.getByRole("textbox", { name: "Line colour" });
    fireEvent.focus(text);
    fireEvent.change(text, { target: { value: "#fff" } });
    fireEvent.blur(text);
    expect(onChange).toHaveBeenLastCalledWith("#ffffff", false);
  });

  it("leaves the colour alone when what's typed isn't a colour, and resets when cleared", () => {
    const onChange = vi.fn();
    render(
      <EditorProvider init={{ files: FILES }}>
        <ColorField label="Line colour" value="#112233" onChange={onChange} />
      </EditorProvider>,
    );
    const text = screen.getByLabelText("Line colour");
    fireEvent.focus(text);
    fireEvent.change(text, { target: { value: "blue-ish" } });
    fireEvent.blur(text);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.focus(text);
    fireEvent.change(text, { target: { value: "" } });
    fireEvent.blur(text);
    expect(onChange).toHaveBeenLastCalledWith(null, false);
  });
});
