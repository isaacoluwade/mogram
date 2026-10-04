import { describe, expect, it } from "vitest";
import { LIMITS } from "@/lib/api/contracts";
import { nameOf, withName } from "./project-name";

describe("diagram names", () => {
  it("reads the YAML name, within the API's limit", () => {
    expect(nameOf({ "mogram.yaml": "name: Checkout\n" })).toBe("Checkout");
    const long = "x".repeat(LIMITS.nameLength + 30);
    expect(nameOf({ "mogram.yaml": `name: ${long}\n` })).toHaveLength(LIMITS.nameLength);
  });

  it("falls back to the default name, and writes renames into the YAML", () => {
    expect(nameOf({ "mogram.yaml": "components:\n  web: generic/server\n" })).toBe(
      "Untitled diagram",
    );
    const renamed = withName({ "mogram.yaml": "name: Old\n" }, "New");
    expect(nameOf(renamed)).toBe("New");
  });
});
