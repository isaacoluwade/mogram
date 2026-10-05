import { describe, expect, it } from "vitest";
import { renameElement } from "../src/edit";
import { parseDiagram } from "../src/format";
import type { ProjectFiles } from "../src/model";

const files: ProjectFiles = {
  "mogram.yaml": `mogram: 1
name: Links
components:
  api:
    type: generic/service
    link: https://example.com/runbook
    data: { owner: payments, sla: 99.9, critical: true }
  db: { type: generic/database, link: "#api" }
  cache: { type: generic/database, link: "scene:outage" }
  bad: { type: generic/service, link: "javascript:alert(1)" }
scenes:
  outage:
    db: down
`,
};

describe("links and data on elements (07 §18 P0-3, P0-5)", () => {
  it("reads web, scene and element links, and named values", () => {
    const { diagram, diagnostics } = parseDiagram(files);
    expect(diagram.components.get("api")?.link).toEqual({
      kind: "url",
      url: "https://example.com/runbook",
    });
    expect(diagram.components.get("db")?.link).toEqual({ kind: "element", element: "api" });
    expect(diagram.components.get("cache")?.link).toEqual({ kind: "scene", scene: "outage" });
    expect([...(diagram.components.get("api")?.data ?? [])]).toEqual([
      ["owner", "payments"],
      ["sla", 99.9],
      ["critical", true],
    ]);
    // Only web and mail links: never script.
    expect(diagram.components.get("bad")?.link).toBeNull();
    expect(diagnostics.some((d) => d.message.includes("should be a web address"))).toBe(true);
  });

  it("warns about links to things that don't exist", () => {
    const broken = {
      "mogram.yaml": (files["mogram.yaml"] ?? "")
        .replace('link: "#api"', 'link: "#nope"')
        .replace("scene:outage", "scene:missing"),
    };
    const messages = parseDiagram(broken).diagnostics.map((d) => d.message);
    expect(messages.some((m) => m.includes('"#nope"'))).toBe(true);
    expect(messages.some((m) => m.includes('scene "missing"'))).toBe(true);
  });

  it("keeps element links pointing at a renamed element", () => {
    const { diagram } = parseDiagram(files);
    const renamed = renameElement(files, diagram, { from: "api", to: "payments_api" });
    expect(renamed.files["mogram.yaml"]).toContain(
      'db: { type: generic/database, link: "#payments_api" }',
    );
  });
});

describe("tidy up", () => {
  it("lays a container's contents out again in traffic order and pins them", async () => {
    const { tidyUp } = await import("../src/edit");
    const messy: ProjectFiles = {
      "mogram.yaml": `mogram: 1
name: Messy
components:
  web: generic/service
  api: generic/service
  db: generic/database
  note_text: generic/service
connections:
  web_to_api: { from: web, to: api }
  api_to_db: { from: api, to: db }
layout:
  web: [40, 30]
  api: [0, 0]
  db: [3, 50]
  web_to_api: { via: [[10, 10]] }
`,
    };
    const diagram = parseDiagram(messy).diagram;
    const result = tidyUp(messy, diagram, { parent: null });
    const tidy = parseDiagram(result.files).diagram;
    const at = (name: string) => tidy.layout.get(name)?.at;
    // Sources left, destinations right.
    expect((at("web")?.x ?? 0) < (at("api")?.x ?? 0)).toBe(true);
    expect((at("api")?.x ?? 0) < (at("db")?.x ?? 0)).toBe(true);
    expect(tidy.layout.get("web_to_api")?.via ?? null).toBeNull();
    expect(result.select).toContain("db");
  });
});
