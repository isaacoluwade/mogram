import { describe, expect, it } from "vitest";
import { parseDiagram } from "../src/format";
import { humanize, toName, uniqueName } from "../src/model";

const errorsOf = (files: Record<string, string>, folder = "") =>
  parseDiagram(files, folder).diagnostics.filter((d) => d.severity === "error");

describe("parseDiagram — PRD examples", () => {
  it("reads the scenes example from the PRD verbatim (SC-5)", () => {
    const files = {
      "mogram.yaml": `
components:
  db_primary:
    type: azure/sql-database
  db_replica:
    type: azure/sql-database
  app:
    type: azure/app-service
connections:
  app_to_primary:
    from: app
    to: db_primary
    flow: traffic
scenes:
  region_outage:
    db_primary: down
    app_to_primary: blocked
    db_replica: active
`,
    };
    const { diagram, diagnostics } = parseDiagram(files);
    expect(diagnostics).toEqual([]);
    const scene = diagram.scenes[0]!;
    expect(scene.name).toBe("region_outage");
    expect(scene.label).toBe("Region outage");
    expect(scene.entries.map((e) => [e.target, e.state ?? e.flow])).toEqual([
      ["db_primary", "down"],
      ["app_to_primary", "blocked"],
      ["db_replica", "active"],
    ]);
  });

  it("reads the tours example from the PRD verbatim (TO-6)", () => {
    const files = {
      "mogram.yaml": `
components:
  web_vm: azure/virtual-machine
  storage: azure/storage-accounts
  cdn: azure/front-doors
  db_replica: azure/sql-database
scenes:
  region_outage:
    storage: degraded
tours:
  request_flow:
    start: web_vm
    steps:
      web_vm:
        next: storage
      storage:
        choices:
          Normal read: cdn
          Region outage:
            next: db_replica
            scene: region_outage
`,
    };
    const { diagram, diagnostics } = parseDiagram(files);
    expect(diagnostics).toEqual([]);
    const tour = diagram.tours[0]!;
    expect(tour.title).toBe("Request flow");
    expect(tour.start).toBe("web_vm");
    expect(tour.steps.get("web_vm")?.next).toBe("storage");
    expect(tour.steps.get("storage")?.choices).toEqual([
      { label: "Normal read", next: "cdn", scene: null },
      { label: "Region outage", next: "db_replica", scene: "region_outage" },
    ]);
  });

  it("reads the nested diagram example with ports (NE-3, NE-4)", () => {
    const files = {
      "compute.mogram.yaml": `
components:
  app_gateway: azure/application-gateways
  aks:
    type: azure/kubernetes-services
    opens: ./aks
connections:
  gateway_to_aks:
    from: app_gateway
    to: aks.web
`,
      "aks/mogram.yaml": `
ports:
  web: ingress
components:
  ingress: tool/nginx
`,
    };
    const root = parseDiagram(files);
    expect(root.diagnostics).toEqual([]);
    expect(root.diagram.components.get("aks")?.opens).toBe("aks");
    expect(root.diagram.connections.get("gateway_to_aks")?.to).toEqual({
      element: "aks",
      port: "web",
      part: null,
    });

    const nested = parseDiagram(files, "aks");
    expect(nested.diagnostics).toEqual([]);
    expect(nested.diagram.settings.ports.get("web")).toBe("ingress");
  });
});

describe("parseDiagram — files and folders (FI-6 … FI-10)", () => {
  it("treats one file as single-file mode with layout in the same file", () => {
    const { diagram } = parseDiagram({
      "checkout.mogram.yaml": "components:\n  a: generic/server\n",
    });
    expect(diagram.mode).toBe("single");
    expect(diagram.settingsFile).toBe("checkout.mogram.yaml");
    expect(diagram.layoutFile).toBe("checkout.mogram.yaml");
    expect(diagram.settings.name).toBe("checkout");
  });

  it("merges every Mogram file in a folder and writes layout to layout.mogram.yaml", () => {
    const files = {
      "mogram.yaml": "name: Checkout\ntheme: forest\n",
      "network.mogram.yaml": "containers:\n  vnet:\n    type: vnet\n",
      "compute.mogram": "components:\n  web_vm:\n    type: azure/virtual-machine\n    in: vnet\n",
      "docs/web-vm.md": "# Web VM",
    };
    const { diagram, diagnostics } = parseDiagram(files);
    expect(diagnostics).toEqual([]);
    expect(diagram.mode).toBe("folder");
    expect(diagram.files).toEqual(["mogram.yaml", "compute.mogram", "network.mogram.yaml"]);
    expect(diagram.layoutFile).toBe("layout.mogram.yaml");
    expect(diagram.settings).toMatchObject({ name: "Checkout", theme: "forest" });
    expect(diagram.components.get("web_vm")).toMatchObject({
      parent: "vnet",
      source: { file: "compute.mogram", line: 2 },
    });
  });

  it("does not merge subfolders into the parent diagram", () => {
    const { diagram } = parseDiagram({
      "mogram.yaml": "components:\n  a: generic/server\n",
      "aks/mogram.yaml": "components:\n  b: generic/server\n",
    });
    expect([...diagram.components.keys()]).toEqual(["a"]);
  });

  it("reports duplicate names across files, naming both files (FI-9)", () => {
    const [error] = errorsOf({
      "mogram.yaml": "components:\n  web_vm: generic/server\n",
      "compute.mogram.yaml": "\ncomponents:\n  web_vm: generic/server\n",
    });
    // Reported where the second definition is, so the fix happens in the newer file.
    expect(error).toMatchObject({ file: "compute.mogram.yaml", line: 3 });
    expect(error?.message).toContain("compute.mogram.yaml (line 3)");
    expect(error?.message).toContain("mogram.yaml (line 2)");
  });

  it("warns about settings outside mogram.yaml in folder mode", () => {
    const { diagnostics } = parseDiagram({
      "mogram.yaml": "name: A\n",
      "extra.mogram.yaml": "theme: paper\n",
    });
    expect(diagnostics[0]).toMatchObject({ severity: "warning", file: "extra.mogram.yaml" });
  });
});

describe("parseDiagram — plain-language diagnostics (FI-16)", () => {
  it("points at the file and line of a broken parent and suggests a fix", () => {
    const [error] = errorsOf({
      "compute.mogram.yaml": `containers:
  web_subnet:
    type: subnet
components:
  web_vm:
    type: azure/virtual-machine
    in: web_subnett
`,
    });
    expect(error).toMatchObject({ file: "compute.mogram.yaml", line: 7 });
    expect(error?.message).toBe(
      `"web_vm" is inside "web_subnett", but there is no container with that name. Did you mean "web_subnet"?`,
    );
  });

  it("explains invalid YAML without crashing", () => {
    const { diagnostics, diagram } = parseDiagram({
      "mogram.yaml": "components:\n  a: [unclosed\n",
    });
    expect(diagnostics[0]?.severity).toBe("error");
    expect(diagnostics[0]?.message).toMatch(/isn't valid YAML/);
    expect(diagram.components.size).toBe(0);
  });

  it("rejects unknown presets and lists the options", () => {
    const [error] = errorsOf({ "mogram.yaml": "components:\n  a:\n    state: brokn\n" });
    expect(error?.message).toContain(`"brokn" isn't a state preset`);
    expect(error?.message).toContain("healthy, active, scaling, degraded, overloaded or down");
  });

  it("rejects fractional positions (ED-9)", () => {
    const [error] = errorsOf({
      "mogram.yaml": "components:\n  a: generic/server\nlayout:\n  a: [1.5, 2]\n",
    });
    expect(error?.message).toContain("whole numbers");
    expect(error?.line).toBe(4);
  });

  it("checks connection endpoints, ports and backups", () => {
    const errors = errorsOf({
      "mogram.yaml": `components:
  a: generic/server
  b: generic/server
connections:
  a_to_c:
    from: a
    to: c
  a_to_b_web:
    from: a
    to: b.web
  backup:
    from: a
    to: b
    backup_for: missing
`,
    });
    expect(errors.map((e) => e.line)).toEqual([7, 10, 14]);
  });

  it("validates scene targets against element kinds", () => {
    const errors = errorsOf({
      "mogram.yaml": `components:
  a: generic/server
  b: generic/server
connections:
  link:
    from: a
    to: b
scenes:
  s:
    link: down
    a: traffic
    ghost: down
    a.inner: down
`,
    });
    expect(errors.map((e) => e.line)).toEqual([10, 11, 12, 13]);
    expect(errors[0]?.message).toContain("takes a flow preset");
  });

  it("detects container loops and keeps rendering", () => {
    const { diagram, diagnostics } = parseDiagram({
      "mogram.yaml": "containers:\n  a:\n    in: b\n  b:\n    in: a\n",
    });
    expect(diagnostics.some((d) => d.message.includes("loop"))).toBe(true);
    const parents = [diagram.containers.get("a")?.parent, diagram.containers.get("b")?.parent];
    expect(parents).toContain(null);
  });

  it("warns about unknown keys with a suggestion", () => {
    const { diagnostics } = parseDiagram({
      "mogram.yaml": "components:\n  a:\n    colour: '#ffffff'\n",
    });
    expect(diagnostics[0]).toMatchObject({ severity: "warning", line: 3 });
    expect(diagnostics[0]?.message).toContain(`Did you mean "color"?`);
  });

  it("refuses opens paths that leave the diagram folder", () => {
    const [outside] = errorsOf({ "mogram.yaml": "components:\n  a:\n    opens: ../elsewhere\n" });
    expect(outside?.message).toContain("outside the project");
    const [self] = errorsOf({ "mogram.yaml": "components:\n  a:\n    opens: ./\n" });
    expect(self?.message).toContain("its own folder");
  });
});

describe("parseDiagram — elements, layout and cards", () => {
  it("applies defaults and records only what was written (FI-3)", () => {
    const { diagram } = parseDiagram({ "mogram.yaml": "components:\n  web_vm:\n" });
    expect(diagram.components.get("web_vm")).toMatchObject({
      label: "Web VM",
      hasExplicitLabel: false,
      type: "generic/service",
      state: "healthy",
      hasExplicitState: false,
      motion: "none",
    });
  });

  it("reads layout short and long forms plus decorations (ED-10, ED-22)", () => {
    const { diagram, diagnostics } = parseDiagram({
      "mogram.yaml": `containers:
  vnet: { type: vnet }
components:
  web_vm: generic/server
connections:
  c:
    from: web_vm
    to: vnet
layout:
  vnet: { at: [2, 6], size: [60, 30] }
  web_vm: [4, 6]
  c: { via: [[24, 10], [24, 18]] }
  decorations:
    title: { text: Checkout, style: title, at: [0, -8] }
    hot: { zone: Hot path, at: [2, 4], size: [30, 14], in: vnet, tone: rose }
`,
    });
    expect(diagnostics).toEqual([]);
    expect(diagram.layout.get("vnet")).toMatchObject({
      at: { x: 2, y: 6 },
      size: { w: 60, h: 30 },
    });
    expect(diagram.layout.get("web_vm")?.at).toEqual({ x: 4, y: 6 });
    expect(diagram.layout.get("c")?.via).toEqual([
      { x: 24, y: 10 },
      { x: 24, y: 18 },
    ]);
    expect(diagram.decorations.get("title")).toMatchObject({
      variant: "text",
      style: "title",
      at: { x: 0, y: -8 },
    });
    expect(diagram.decorations.get("hot")).toMatchObject({
      variant: "zone",
      parent: "vnet",
      tone: "rose",
    });
  });

  it("distinguishes card files from inline cards (CA-3)", () => {
    const { diagram } = parseDiagram(
      {
        "app/mogram.yaml": `components:
  a:
    card: docs/web-vm.md
  b:
    card: The front door for all traffic.
  c:
    card: { title: Cache, body: "**Fast** reads" }
`,
      },
      "app",
    );
    expect(diagram.components.get("a")?.card).toEqual({
      kind: "file",
      title: null,
      path: "app/docs/web-vm.md",
    });
    expect(diagram.components.get("b")?.card).toEqual({
      kind: "inline",
      title: null,
      body: "The front door for all traffic.",
    });
    expect(diagram.components.get("c")?.card).toEqual({
      kind: "inline",
      title: "Cache",
      body: "**Fast** reads",
    });
  });

  it("warns about stale layout entries but keeps going", () => {
    const { diagnostics } = parseDiagram({ "mogram.yaml": "layout:\n  ghost: [1, 1]\n" });
    expect(diagnostics[0]).toMatchObject({ severity: "warning", line: 2 });
  });
});

describe("names", () => {
  it("humanises names with architecture acronyms", () => {
    expect(humanize("web_vm")).toBe("Web VM");
    expect(humanize("db-primary")).toBe("DB primary");
    expect(humanize("region_outage")).toBe("Region outage");
    expect(humanize("aks_ingress")).toBe("AKS ingress");
  });

  it("turns labels into valid, unique names", () => {
    expect(toName("Web VM")).toBe("web_vm");
    expect(toName("Application Gateway (WAF v2)")).toBe("application_gateway_waf_v2");
    expect(toName("123")).toBe("element_123");
    expect(uniqueName("web_vm", new Set(["web_vm", "web_vm_2"]))).toBe("web_vm_3");
  });
});
