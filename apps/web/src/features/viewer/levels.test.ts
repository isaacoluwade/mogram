import { describe, expect, it } from "vitest";
import { AKS_FILES } from "@/features/templates/files";
import { ProjectLevels, connectionBetween, focusSet, splitTarget } from "./levels";

describe("viewer levels", () => {
  const levels = new ProjectLevels(AKS_FILES);

  it("resolves a nested level with the top diagram's scene (NE-14, SC-10)", () => {
    const inside = levels.resolve(["aks"], "bad_deploy", []);
    expect(inside?.elements.get("checkout")?.state).toBe("down");
    expect(inside?.connections.get("web_to_checkout")?.flow).toBe("blocked");
    expect(levels.resolve(["aks"], null, [])?.elements.get("checkout")?.state).toBe("healthy");
  });

  it("passes viewer “what if” changes down by path (SH-3)", () => {
    const viewer = [
      {
        target: "aks.web",
        state: "overloaded" as const,
        flow: null,
        motion: null,
        source: { file: "", line: 0 },
      },
    ];
    expect(levels.resolve(["aks"], null, viewer)?.elements.get("web")?.state).toBe("overloaded");
  });

  it("marks everything inside down when its owner is down (NE-11)", () => {
    const viewer = [
      {
        target: "aks",
        state: "down" as const,
        flow: null,
        motion: null,
        source: { file: "", line: 0 },
      },
    ];
    expect(levels.resolve(["aks"], null, viewer)?.elements.get("ingress")?.state).toBe("down");
  });

  it("lists the parent's neighbours as stubs, leading to their ports (NE-5)", () => {
    const stubs = levels.stubs(["aks"]);
    expect(stubs.find((s) => s.neighbour === "app_gateway")).toMatchObject({
      direction: "in",
      port: "web",
      inner: "ingress",
    });
    expect(stubs.find((s) => s.neighbour === "orders_db")).toMatchObject({
      direction: "out",
      inner: "orders_api",
    });
  });

  it("rejects paths that don't lead anywhere", () => {
    expect(levels.levels(["nope"])).toBeNull();
    expect(levels.folderOf(["aks"])).toBe("aks");
  });

  it("splits tour targets into level and element", () => {
    expect(splitTarget("aks.checkout")).toEqual({ path: ["aks"], element: "checkout" });
    expect(splitTarget("front_door")).toEqual({ path: [], element: "front_door" });
  });

  it("finds connections in either direction and focuses an element with its connections", () => {
    const diagram = levels.geometry("").diagram;
    expect(connectionBetween(diagram, "front_door", "customers")?.name).toBe("customers_to_door");
    expect([...focusSet(diagram, "front_door")].sort()).toEqual([
      "customers_to_door",
      "door_to_gateway",
      "front_door",
    ]);
  });
});
