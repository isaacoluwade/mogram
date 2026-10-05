import { describe, expect, it } from "vitest";
import { parseCombo } from "./keys";
import { CANVAS_MENU, CONNECTION_MENU, DIAGRAM_MENU, ELEMENT_MENU } from "./menus";
import { COMMANDS, command } from "./registry";
import type { MenuSpec } from "./types";

const normalised = (combo: string): string => {
  const c = parseCombo(combo);
  return `${c.mod ? "mod+" : ""}${c.alt ? "alt+" : ""}${c.shift ? "shift+" : ""}${c.key}`;
};

function ids(spec: MenuSpec): string[] {
  return spec.flatMap((entry) =>
    entry === "-" ? [] : typeof entry === "string" ? [entry] : ids(entry.items),
  );
}

describe("command registry", () => {
  it("gives every command its own id", () => {
    const all = COMMANDS.map((c) => c.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("never binds one key combo to two commands", () => {
    const owners = new Map<string, string>();
    for (const c of COMMANDS) {
      for (const combo of c.keys ?? []) {
        const key = normalised(combo);
        expect(owners.get(key), `${combo} is bound to ${owners.get(key)} and ${c.id}`).toBe(
          undefined,
        );
        owners.set(key, c.id);
      }
    }
  });

  it("only lists commands that exist in its menus", () => {
    for (const spec of [CANVAS_MENU, ELEMENT_MENU, CONNECTION_MENU, DIAGRAM_MENU]) {
      for (const id of ids(spec)) expect(command(id), id).toBeDefined();
    }
  });
});
