import { describe, expect, it } from "vitest";
import { codeKey, matchesCombo, parseCombo, type KeyInput } from "./keys";

const press = (key: string, code: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key,
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("key combos", () => {
  it("parses modifiers and keys, including a plus key", () => {
    expect(parseCombo("mod+shift+z")).toEqual({ mod: true, shift: true, alt: false, key: "z" });
    expect(parseCombo("mod++")).toEqual({ mod: true, shift: false, alt: false, key: "+" });
    expect(parseCombo("?")).toEqual({ mod: false, shift: false, alt: false, key: "?" });
  });

  it("maps physical key codes", () => {
    expect(codeKey("KeyR")).toBe("r");
    expect(codeKey("Digit1")).toBe("1");
    expect(codeKey("BracketRight")).toBe("]");
  });

  it("matches letters only with exactly the modifiers named", () => {
    expect(matchesCombo(press("v", "KeyV"), "v")).toBe(true);
    expect(matchesCombo(press("V", "KeyV", { shiftKey: true }), "v")).toBe(false);
    expect(matchesCombo(press("z", "KeyZ", { metaKey: true }), "mod+z")).toBe(true);
    expect(matchesCombo(press("z", "KeyZ", { ctrlKey: true }), "mod+z")).toBe(true);
    expect(matchesCombo(press("z", "KeyZ", { metaKey: true, shiftKey: true }), "mod+z")).toBe(
      false,
    );
  });

  it("matches shifted symbols without asking for Shift, and shifted digits by key code", () => {
    expect(matchesCombo(press("?", "Slash", { shiftKey: true }), "?")).toBe(true);
    expect(matchesCombo(press("!", "Digit1", { shiftKey: true }), "shift+1")).toBe(true);
    expect(matchesCombo(press("1", "Digit1"), "shift+1")).toBe(false);
    // A "?" sent without Shift (synthetic events) is still "?", never "/".
    expect(matchesCombo(press("?", "Slash"), "/")).toBe(false);
    expect(matchesCombo(press("?", "Slash"), "?")).toBe(true);
  });

  it("matches Option combos on a Mac by the physical key", () => {
    expect(matchesCombo(press("‰", "KeyR", { altKey: true, shiftKey: true }), "alt+shift+r")).toBe(
      true,
    );
    expect(
      matchesCombo(press("‘", "BracketRight", { metaKey: true, altKey: true }), "mod+alt+]"),
    ).toBe(true);
  });
});
