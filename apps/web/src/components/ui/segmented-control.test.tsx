// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SegmentedControl } from "./segmented-control";

function Example() {
  const [value, setValue] = useState<"loop" | "story" | "off">("loop");
  return (
    <SegmentedControl
      label="Plays"
      value={value}
      onChange={setValue}
      options={[
        { value: "loop", label: "This scene" },
        { value: "story", label: "All scenes" },
        { value: "off", label: "Off" },
      ]}
    />
  );
}

describe("SegmentedControl", () => {
  it("is a radio group with one checked option and roving focus", () => {
    render(<Example />);
    expect(screen.getByRole("radiogroup", { name: "Plays" })).toBeInTheDocument();
    const loop = screen.getByRole("radio", { name: "This scene" });
    expect(loop).toHaveAttribute("aria-checked", "true");
    expect(loop).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "All scenes" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves with the arrow keys, wrapping at the ends", () => {
    render(<Example />);
    const group = screen.getByRole("radiogroup");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: "All scenes" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(screen.getByRole("radio", { name: "Off" })).toHaveAttribute("aria-checked", "true");
  });

  it("selects on click", () => {
    render(<Example />);
    fireEvent.click(screen.getByRole("radio", { name: "Off" }));
    expect(screen.getByRole("radio", { name: "Off" })).toHaveAttribute("aria-checked", "true");
  });
});
