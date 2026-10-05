import { describe, expect, it } from "vitest";
import { pasteSnippet, setFlowValue, setScale, setSceneCapacity, setSceneEntry } from "../src/edit";
import { parseDiagram } from "../src/format";
import type { ProjectFiles } from "../src/model";

const parse = (yaml: string) => parseDiagram({ "mogram.yaml": yaml });
const messages = (yaml: string) => parse(yaml).diagnostics.map((d) => d.message);

const SHOP = `mogram: 1
name: Shop
components:
  users: { type: generic/users }
  lb: { type: azure/load-balancers, routing: split }
  web: { type: azure/virtual-machine, scale: { min: 2, max: 8, target: 60% }, capacity: 2x }
  db:
    type: azure/sql-database
    scale:
      sizes:
        - { name: S2, cpu: 2, memory: 8, disks: 1 }
        - { name: S4, cpu: 4, memory: 16, disks: 2 }
        - { name: S8, cpu: 8, memory: 32, disks: 4, capacity: 3x }
  cache: { type: azure/cache-redis, hit: 80% }
  queue: { type: aws/sqs, queue: true }
connections:
  users_to_lb: { from: users, to: lb, traffic: 1.5x }
  lb_to_web: { from: lb, to: web, share: 90% }
  web_to_db: { from: web, to: db }
scenes:
  spike:
    users_to_lb: 5x
    lb_to_web: { share: 50%, flow: traffic }
    web: { copies: 6, state: active }
    db: { size: S8 }
    cache: { hit: 20% }
`;

describe("capacity in the file format", () => {
  it("reads scaling, capacity, routing, hit rates, queues, traffic and shares", () => {
    const { diagram, diagnostics } = parse(SHOP);
    expect(diagnostics).toEqual([]);
    expect(diagram.components.get("web")?.scale).toEqual({
      kind: "out",
      min: 2,
      max: 8,
      target: 0.6,
    });
    expect(diagram.components.get("web")?.capacity).toBe(2);
    const db = diagram.components.get("db")?.scale;
    expect(db?.kind).toBe("up");
    if (db?.kind !== "up") return;
    expect(db.target).toBe(0.7);
    expect(db.sizes.map((s) => [s.name, s.cpu, s.memory, s.disks, s.capacity])).toEqual([
      ["S2", 2, 8, 1, 1],
      ["S4", 4, 16, 2, 2],
      ["S8", 8, 32, 4, 3],
    ]);
    expect(diagram.components.get("lb")?.routing).toBe("split");
    expect(diagram.components.get("cache")?.hit).toBe(0.8);
    expect(diagram.components.get("queue")?.queue).toBe(true);
    expect(diagram.connections.get("users_to_lb")?.traffic).toBe(1.5);
    expect(diagram.connections.get("lb_to_web")?.share).toBe(0.9);
    const spike = diagram.scenes[0]?.entries ?? [];
    expect(spike.map((e) => [e.target, e.capacity])).toEqual([
      ["users_to_lb", { traffic: 5 }],
      ["lb_to_web", { share: 0.5 }],
      ["web", { copies: 6 }],
      ["db", { size: "S8" }],
      ["cache", { hit: 0.2 }],
    ]);
    expect(spike.find((e) => e.target === "web")?.state).toBe("active");
  });

  it("says plainly what's wrong", () => {
    expect(messages("components:\n  web: { type: azure/vm, scale: { min: 5, max: 2 } }\n")).toEqual(
      [`"web" can't have a min (5) above its max (2).`],
    );
    expect(messages("components:\n  web: { type: azure/vm, scale: { min: 2 } }\n")).toEqual([]);
    expect(messages("components:\n  web: { type: azure/vm, scale: {} }\n")[0]).toMatch(
      /needs a max/,
    );
    expect(messages("components:\n  web: { type: azure/vm, scale: { max: 99 } }\n")[0]).toMatch(
      /from 1 to 24/,
    );
    expect(messages("components:\n  web: { type: azure/vm, hit: lots }\n")[0]).toMatch(
      /percentage, like 70%/,
    );
    expect(messages("connections:\n  a: { from: x, to: y, traffic: wave }\n")).toContainEqual(
      expect.stringMatching(
        /^"wave" isn't a traffic pattern on "a"\. Did you mean "waves"\? Give a level like 3x, or a pattern: steady, waves/,
      ),
    );
    expect(messages("connections:\n  a: { from: x, to: y, traffic: 3 times }\n")).toContain(
      'The traffic on "a" should be a multiple of normal traffic, like 3x (or 0.5x for half).',
    );
    expect(messages("shapes:\n  box: { shape: rounded, scale: { max: 3 } }\n")[0]).toMatch(
      /Scaling works on icon components/,
    );
    const scene = messages(`components:
  web: { type: azure/vm, scale: { max: 3 } }
  db: { type: azure/sql-database, scale: { sizes: [S1, S2] } }
scenes:
  peak:
    web: { traffic: 3x, size: S2 }
    db: { size: S3 }
`);
    expect(scene).toEqual([
      'In scene "peak", traffic is set on connections, not on "web".',
      `In scene "peak", "web" doesn't scale up (\`scale: { sizes }\`), so its size is ignored.`,
      'In scene "peak", "db" has no size "S3". Did you mean "S1"? Its sizes: S1, S2.',
    ]);
  });

  it("writes scaling and traffic readably, and keeps them through copy and paste", () => {
    const start: ProjectFiles = { "mogram.yaml": SHOP };
    const d = () => parseDiagram(files).diagram;
    let files: ProjectFiles = start;
    files = setScale(files, d(), {
      name: "web",
      scale: { kind: "out", min: 1, max: 4, target: 0.7 },
    }).files;
    expect(files["mogram.yaml"]).toContain("scale: { min: 1, max: 4 }");
    files = setScale(files, d(), {
      name: "cache",
      scale: {
        kind: "up",
        target: 0.7,
        sizes: [
          { name: "C1", cpu: null, memory: null, disks: null, capacity: 1 },
          { name: "C2", cpu: null, memory: null, disks: null, capacity: 2 },
        ],
      },
    }).files;
    expect(files["mogram.yaml"]).toMatch(/scale: { sizes: \[ ?C1, C2 ?\] }/);
    files = setFlowValue(files, d(), { name: "users_to_lb", key: "traffic", value: 2 }).files;
    files = setFlowValue(files, d(), { name: "lb_to_web", key: "share", value: null }).files;
    expect(files["mogram.yaml"]).toContain("users_to_lb: { from: users, to: lb, traffic: 2x }");
    expect(files["mogram.yaml"]).toContain("lb_to_web: { from: lb, to: web }");
    expect(parseDiagram(files).diagnostics).toEqual([]);

    // Pasting a copy keeps what it does to traffic.
    const pasted = pasteSnippet(files, d(), {
      text: "components:\n  db: { type: azure/sql-database, scale: { sizes: [S1, S2] }, hit: 50% }\n",
      parent: null,
      at: { x: 60, y: 0 },
    });
    const copy = parseDiagram(pasted.files).diagram.components.get(pasted.select?.[0] ?? "");
    expect(copy?.scale?.kind).toBe("up");
    expect(copy?.hit).toBe(0.5);
  });

  it("sets capacity in a scene without losing the line's state, and the other way round", () => {
    let files: ProjectFiles = { "mogram.yaml": SHOP };
    const d = () => parseDiagram(files).diagram;
    files = setSceneCapacity(files, d(), {
      scene: "spike",
      target: "web",
      capacity: { copies: 8 },
    }).files;
    expect(files["mogram.yaml"]).toContain("web: { state: active, copies: 8 }");
    files = setSceneEntry(files, d(), {
      scene: "spike",
      target: "web",
      value: { state: "overloaded" },
    }).files;
    expect(files["mogram.yaml"]).toContain("web: { state: overloaded, copies: 8 }");
    files = setSceneCapacity(files, d(), {
      scene: "spike",
      target: "users_to_lb",
      capacity: { traffic: null },
    }).files;
    expect(files["mogram.yaml"]).not.toContain("users_to_lb: 5x");
    expect(parseDiagram(files).diagnostics).toEqual([]);
  });
});
