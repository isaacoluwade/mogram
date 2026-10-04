import { describe, expect, it } from "vitest";
import { parseDiagram } from "../src/format";
import {
  DiagramLoader,
  followLevels,
  checkNestedReferences,
  findNestingLoops,
  resolveInstance,
  resolveLevels,
  stubsFor,
} from "../src/nested";
import {
  advance,
  back,
  cursorTo,
  mainPath,
  reachableSteps,
  startCursor,
  stepNumber,
} from "../src/tours";

const TOUR = `components:
  web_vm: azure/virtual-machine
  storage: azure/storage-accounts
  cdn: azure/front-door-and-cdn-profiles
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
`;

describe("tours", () => {
  const tour = parseDiagram({ "mogram.yaml": TOUR }).diagram.tours[0]!;

  it("lists the main path and every reachable step", () => {
    expect(mainPath(tour)).toEqual(["web_vm", "storage", "cdn"]);
    expect(reachableSteps(tour)).toEqual(["web_vm", "storage", "cdn", "db_replica"]);
  });

  it("follows choices, applies their scene, and goes back through history (TO-3, TO-6, TO-7)", () => {
    const start = startCursor(tour)!;
    expect(start).toMatchObject({ step: "web_vm", scene: null });
    const atStorage = advance(tour, start)!;
    expect(atStorage.step).toBe("storage");
    const outage = advance(tour, atStorage, 1)!;
    expect(outage).toMatchObject({ step: "db_replica", scene: "region_outage" });
    expect(stepNumber(tour, outage)).toEqual({ index: 3, total: 3 });
    expect(advance(tour, outage)).toBeNull();
    const backAgain = back(outage)!;
    expect(backAgain).toMatchObject({ step: "storage", scene: null });
    expect(back(start)).toBeNull();
  });
});

const NESTED = {
  "mogram.yaml": `name: Checkout
components:
  gateway: azure/application-gateways
  orders: { opens: ./service }
  payments: { opens: ./service }
  aks: { opens: ./aks }
connections:
  gateway_to_aks: { from: gateway, to: aks.web, flow: traffic }
  aks_to_orders: { from: aks, to: orders }
scenes:
  payments_db_down:
    payments.db: down
`,
  "service/mogram.yaml": `components:
  api: generic/server
  db: azure/sql-database
`,
  "aks/mogram.yaml": `name: AKS cluster
ports:
  web: ingress
components:
  ingress: tool/nginx
`,
};

describe("nested diagrams", () => {
  it("keeps state per instance of a shared blueprint (NE-13, NE-14)", () => {
    const loader = new DiagramLoader(NESTED);
    const root = loader.load("").diagram;
    const scene = root.scenes[0]!.entries;
    const resolved = resolveInstance(loader, { folder: "", scene, viewer: [], ownerDown: false });
    expect(resolved.elements.get("payments")).toMatchObject({
      state: "degraded",
      reason: "rollup",
    });
    expect(resolved.elements.get("orders")?.state).toBe("healthy");

    const paymentsInside = resolveInstance(loader, {
      folder: "service",
      scene: resolved.nested.get("payments")!.scene,
      viewer: [],
      ownerDown: false,
    });
    const ordersInside = resolveInstance(loader, {
      folder: "service",
      scene: resolved.nested.get("orders")!.scene,
      viewer: [],
      ownerDown: false,
    });
    expect(paymentsInside.elements.get("db")?.state).toBe("down");
    expect(ordersInside.elements.get("db")?.state).toBe("healthy");
  });

  it("lists parent neighbours as stubs with the port they arrive at (NE-5)", () => {
    const loader = new DiagramLoader(NESTED);
    const stubs = stubsFor(loader.load("").diagram, "aks", loader.load("aks").diagram);
    expect(stubs).toEqual([
      {
        connection: "gateway_to_aks",
        neighbour: "gateway",
        neighbourLabel: "Gateway",
        direction: "in",
        port: "web",
        inner: "ingress",
      },
      {
        connection: "aks_to_orders",
        neighbour: "orders",
        neighbourLabel: "Orders",
        direction: "out",
        port: null,
        inner: null,
      },
    ]);
  });

  it("resolves breadcrumb levels (NE-8)", () => {
    const loader = new DiagramLoader(NESTED);
    // Breadcrumbs name the instance (the component's label), which tells shared blueprints apart.
    expect(resolveLevels(loader, ["aks"])?.map((level) => level.label)).toEqual([
      "Checkout",
      "AKS",
    ]);
    expect(resolveLevels(loader, ["payments"])?.map((level) => level.folder)).toEqual([
      "",
      "service",
    ]);
    expect(resolveLevels(loader, ["missing"])).toBeNull();
  });

  it("checks ports against the nested diagram (NE-4)", () => {
    const files = { ...NESTED, "mogram.yaml": NESTED["mogram.yaml"].replace("aks.web", "aks.api") };
    const loader = new DiagramLoader(files);
    const diagnostics = checkNestedReferences(loader, loader.load("").diagram);
    expect(diagnostics[0]?.message).toContain(`only declares "web"`);
  });

  it("refuses loops and names the folders (NE-2)", () => {
    const loader = new DiagramLoader({
      "mogram.yaml": "components:\n  a: { opens: ./one }\n",
      "one/mogram.yaml": "components:\n  b: { opens: ../two }\n",
      "two/mogram.yaml": "components:\n  c: { opens: ../one }\n",
    });
    const [loop] = findNestingLoops(loader);
    expect(loop?.message).toContain("one opens two opens one");
    expect(loop?.file).toBe("two/mogram.yaml");
  });

  it("reports opens that point at a folder without a diagram", () => {
    const loader = new DiagramLoader({ "mogram.yaml": "components:\n  a: { opens: ./nothing }\n" });
    expect(checkNestedReferences(loader, loader.load("").diagram)[0]?.message).toContain(
      "has no mogram.yaml",
    );
  });
});

describe("cursorTo (deep links to a tour step)", () => {
  const tour = parseDiagram({ "mogram.yaml": TOUR }).diagram.tours[0]!;

  it("walks the shortest route so Back and the scene are right", () => {
    const atCdn = cursorTo(tour, "cdn")!;
    expect(atCdn.history.map((h) => h.step)).toEqual(["web_vm", "storage"]);
    expect(stepNumber(tour, atCdn)).toEqual({ index: 3, total: 3 });
    const viaChoice = cursorTo(tour, "db_replica")!;
    expect(viaChoice).toMatchObject({ step: "db_replica", scene: "region_outage" });
    expect(back(viaChoice)?.step).toBe("storage");
  });

  it("returns null for steps the tour never reaches", () => {
    expect(cursorTo(tour, "nowhere")).toBeNull();
  });
});

describe("followLevels", () => {
  it("follows a path as far as it leads, so a renamed level falls back to its parent", () => {
    const loader = new DiagramLoader({
      "mogram.yaml": "components:\n  aks: { type: azure/aks, opens: ./aks }\n",
      "aks/mogram.yaml": "components:\n  web: generic/server\n",
    });
    expect(followLevels(loader, ["aks", "web"]).map((level) => level.folder)).toEqual(["", "aks"]);
    expect(followLevels(loader, ["gone"]).map((level) => level.folder)).toEqual([""]);
    expect(resolveLevels(loader, ["aks", "web"])).toBeNull();
  });
});
