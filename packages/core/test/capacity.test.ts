import { describe, expect, it } from "vitest";
import { planCapacity } from "../src/capacity";
import { parseDiagram } from "../src/format";
import { resolveState } from "../src/state";

const diagramOf = (yaml: string) => {
  const { diagram, diagnostics } = parseDiagram({ "mogram.yaml": yaml });
  expect(diagnostics).toEqual([]);
  return diagram;
};

/** Resolves a diagram (in a scene, at a traffic level) and returns its capacity plan. */
function plan(yaml: string, options: { scene?: string; traffic?: number } = {}) {
  const diagram = diagramOf(yaml);
  const resolved = resolveState({
    diagram,
    scene: diagram.scenes.find((s) => s.name === options.scene)?.entries ?? [],
    ...(options.traffic !== undefined ? { traffic: options.traffic } : {}),
  });
  return {
    resolved,
    element: (name: string) => resolved.capacity.elements.get(name),
    traffic: (name: string) => resolved.capacity.connections.get(name),
  };
}

const WEB = `mogram: 1
name: Shop
components:
  users: { type: generic/users }
  lb: { type: azure/load-balancers }
  web: { type: azure/virtual-machine, scale: { min: 2, max: 8 } }
connections:
  users_to_lb: { from: users, to: lb }
  lb_to_web: { from: lb, to: web }
scenes:
  spike:
    users_to_lb: 5x
  flood:
    users_to_lb: 10x
  pinned:
    users_to_lb: 5x
    web: { copies: 3 }
`;

describe("capacity", () => {
  it("adds copies to keep each at its target, up to its most", () => {
    const normal = plan(WEB);
    expect(normal.element("web")).toMatchObject({ inflow: 1, copies: 2, limited: false });
    expect(normal.element("web")?.load).toBeCloseTo(0.5);
    expect(normal.resolved.elements.get("web")?.state).toBe("healthy");

    const spike = plan(WEB, { scene: "spike" });
    // 5x at 70% each needs ceil(5 / 0.7) = 8 copies.
    expect(spike.element("web")).toMatchObject({ inflow: 5, copies: 8, limited: false });

    const flood = plan(WEB, { scene: "flood" });
    expect(flood.element("web")).toMatchObject({ copies: 8, limited: true });
    expect(flood.element("web")?.load).toBeCloseTo(1.25);
    // Past its most copies it's overloaded, and says so.
    expect(flood.resolved.elements.get("web")).toMatchObject({
      state: "overloaded",
      reason: "load",
    });

    // Copies set by hand win; the load follows.
    const pinned = plan(WEB, { scene: "pinned" });
    expect(pinned.element("web")?.copies).toBe(3);
    expect(pinned.element("web")?.load).toBeCloseTo(5 / 3);
  });

  it("follows the traffic slider everywhere traffic enters", () => {
    const busy = plan(WEB, { traffic: 3 });
    expect(busy.traffic("users_to_lb")).toBeCloseTo(3);
    expect(busy.element("web")?.copies).toBe(5);
    const quiet = plan(WEB, { traffic: 0.2 });
    expect(quiet.element("web")?.copies).toBe(2);
  });

  it("splits at load balancers (by share, or evenly) and skips what's down", () => {
    const yaml = `mogram: 1
components:
  users: { type: generic/users }
  lb: { type: azure/load-balancers }
  a: { type: azure/virtual-machine, capacity: 1x }
  b: { type: azure/virtual-machine, capacity: 1x }
  c: { type: azure/virtual-machine, capacity: 1x }
connections:
  users_to_lb: { from: users, to: lb, traffic: 3x }
  lb_to_a: { from: lb, to: a }
  lb_to_b: { from: lb, to: b }
  lb_to_c: { from: lb, to: c }
scenes:
  b_down:
    b: down
  canary:
    lb_to_a: { share: 80% }
`;
    const even = plan(yaml);
    for (const name of ["lb_to_a", "lb_to_b", "lb_to_c"]) expect(even.traffic(name)).toBeCloseTo(1);

    const down = plan(yaml, { scene: "b_down" });
    expect(down.traffic("lb_to_b")).toBe(0);
    expect(down.traffic("lb_to_a")).toBeCloseTo(1.5);
    // 1.5x on a machine that takes 1x: overloaded.
    expect(down.resolved.elements.get("a")?.state).toBe("overloaded");

    const canary = plan(yaml, { scene: "canary" });
    expect(canary.traffic("lb_to_a")).toBeCloseTo(2.4);
    expect(canary.traffic("lb_to_b")).toBeCloseTo(0.3);
    expect(canary.traffic("lb_to_c")).toBeCloseTo(0.3);
  });

  it("sends calls to every dependency, and only misses past a cache", () => {
    const p = plan(`mogram: 1
components:
  api: { type: azure/function-apps }
  cache: { type: azure/cache-redis, hit: 80% }
  db: { type: azure/sql-database, capacity: 1x }
  audit: { type: azure/storage-accounts }
connections:
  api_to_cache: { from: api, to: cache, traffic: 4x }
  cache_to_db: { from: cache, to: db }
  api_to_audit: { from: api, to: audit }
`);
    expect(p.traffic("api_to_cache")).toBeCloseTo(4);
    expect(p.traffic("cache_to_db")).toBeCloseTo(0.8);
    expect(p.traffic("api_to_audit")).toBeCloseTo(1);
    expect(p.resolved.elements.get("db")?.state).toBe("healthy");
  });

  it("moves traffic to a backup when the connection it backs up is blocked", () => {
    const yaml = `mogram: 1
components:
  users: { type: generic/users }
  tm: { type: azure/traffic-manager-profiles }
  east: { type: azure/app-services, scale: { min: 1, max: 4 } }
  west: { type: azure/app-services, scale: { min: 1, max: 4 } }
connections:
  users_to_tm: { from: users, to: tm, traffic: 2x }
  tm_to_east: { from: tm, to: east }
  tm_to_west: { from: tm, to: west, backup_for: tm_to_east }
scenes:
  east_down:
    east: down
`;
    const normal = plan(yaml);
    expect(normal.traffic("tm_to_east")).toBeCloseTo(2);
    expect(normal.traffic("tm_to_west")).toBe(0);
    const failover = plan(yaml, { scene: "east_down" });
    expect(failover.traffic("tm_to_east")).toBe(0);
    expect(failover.traffic("tm_to_west")).toBeCloseTo(2);
    // The standby scales out to take it.
    expect(failover.element("west")?.copies).toBe(3);
  });

  it("multiplies what a connection carries by its traffic, after a split", () => {
    const p = plan(`mogram: 1
components:
  users: { type: generic/users }
  lb: { type: azure/load-balancers }
  a: { type: azure/virtual-machine }
  b: { type: azure/virtual-machine }
  db: { type: azure/sql-database }
connections:
  users_to_lb: { from: users, to: lb }
  lb_to_a: { from: lb, to: a, traffic: 3x }
  lb_to_b: { from: lb, to: b }
  a_to_db: { from: a, to: db }
scenes:
  quiet:
    users_to_lb: 0.5x
`);
    // Half each way, then three times that to a, and on to its database.
    expect(p.traffic("lb_to_a")).toBeCloseTo(1.5);
    expect(p.traffic("lb_to_b")).toBeCloseTo(0.5);
    expect(p.traffic("a_to_db")).toBeCloseTo(1.5);
    const quiet = plan(
      `mogram: 1
components:
  users: { type: generic/users }
  web: { type: azure/virtual-machine, scale: { min: 1, max: 4 } }
connections:
  users_to_web: { from: users, to: web, traffic: 2x }
scenes:
  quiet:
    users_to_web: 0.5x
`,
      { scene: "quiet" },
    );
    // The scene's level replaces the connection's own.
    expect(quiet.traffic("users_to_web")).toBeCloseTo(0.5);
  });

  it("feeds what's inside a container that traffic is sent to", () => {
    const p = plan(`mogram: 1
containers:
  scale_set: { type: scaling-group }
components:
  lb: { type: azure/load-balancers }
  web: { type: azure/virtual-machine, in: scale_set, scale: { min: 1, max: 6 } }
connections:
  lb_to_set: { from: lb, to: scale_set, traffic: 2x }
`);
    expect(p.element("web")).toMatchObject({ inflow: 2, copies: 3 });
  });

  it("grows a size at a time, and is overloaded past the largest", () => {
    const yaml = `mogram: 1
components:
  app: { type: generic/users }
  db: { type: azure/sql-database, scale: { sizes: [S1, S2, S4] } }
connections:
  app_to_db: { from: app, to: db }
scenes:
  busy:
    app_to_db: 2.5x
  peak:
    app_to_db: 4x
  by_hand:
    db: { size: S1 }
`;
    // Capacities 1, 2 and 4 at a 70% target: 1x needs S2.
    expect(plan(yaml).element("db")).toMatchObject({ size: 1, limited: false });
    expect(plan(yaml, { scene: "busy" }).element("db")).toMatchObject({ size: 2, limited: false });
    const peak = plan(yaml, { scene: "peak" });
    expect(peak.element("db")).toMatchObject({ size: 2, limited: true, load: 1 });
    expect(peak.resolved.elements.get("db")?.state).toBe("healthy");
    expect(plan(yaml, { scene: "by_hand" }).element("db")).toMatchObject({ size: 0, load: 1 });
  });

  it("lets a queue hold what its consumers can't take yet", () => {
    const yaml = `mogram: 1
components:
  orders: { type: generic/users }
  queue: { type: aws/sqs }
  workers: { type: aws/lambda, scale: { min: 1, max: 4 } }
connections:
  orders_to_queue: { from: orders, to: queue }
  queue_to_workers: { from: queue, to: workers }
scenes:
  burst:
    orders_to_queue: 6x
`;
    const calm = plan(yaml);
    expect(calm.element("queue")?.backlogRate).toBeLessThan(0);
    const burst = plan(yaml, { scene: "burst" });
    // Workers scale to their most (4) and take 4x; 2x waits in the queue.
    expect(burst.element("workers")).toMatchObject({ copies: 4, load: 1 });
    expect(burst.traffic("queue_to_workers")).toBeCloseTo(4);
    expect(burst.element("queue")?.backlogRate).toBeCloseTo(2);
    // The queue protects them: busy, not overloaded.
    expect(burst.resolved.elements.get("workers")?.state).toBe("healthy");
  });

  it("is quiet for diagrams that don't model capacity", () => {
    const p = plan(`mogram: 1
components:
  a: { type: generic/users }
  b: { type: generic/database }
connections:
  a_to_b: { from: a, to: b }
`);
    expect(p.resolved.capacity.active).toBe(false);
    expect(p.resolved.elements.get("b")?.state).toBe("healthy");
  });

  it("never invents or loses traffic at a split, whatever the shares", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const random = mulberry(seed);
      const count = 2 + Math.floor(random() * 4);
      const backends = Array.from({ length: count }, (_, i) => `b${i}`);
      const shares = backends.map(() => (random() < 0.5 ? null : Math.round(random() * 60)));
      const down = backends.filter(() => random() < 0.25);
      const traffic = Math.round(random() * 90) / 10;
      const yaml = `mogram: 1
components:
  users: { type: generic/users }
  lb: { type: azure/load-balancers }
${backends.map((b) => `  ${b}: { type: azure/virtual-machine${down.includes(b) ? ", state: down" : ""} }`).join("\n")}
connections:
  in: { from: users, to: lb, traffic: ${traffic}x }
${backends.map((b, i) => `  lb_${b}: { from: lb, to: ${b}${shares[i] === null ? "" : `, share: ${shares[i]}%`} }`).join("\n")}
`;
      const diagram = parseDiagram({ "mogram.yaml": yaml }).diagram;
      const resolved = resolveState({ diagram });
      const out = backends.reduce(
        (sum, b) => sum + (resolved.capacity.connections.get(`lb_${b}`) ?? 0),
        0,
      );
      const open = backends.filter((b) => !down.includes(b));
      const anyWeight = open.some((b) => shares[backends.indexOf(b)] !== 0);
      expect(out).toBeCloseTo(open.length > 0 && anyWeight ? traffic : 0, 6);
      for (const b of down) expect(resolved.capacity.connections.get(`lb_${b}`)).toBe(0);
      // And copies always stay within their bounds.
      const p = planCapacity({
        diagram: diagramOf(WEB),
        states: new Map(),
        flows: new Map(),
        traffic: random() * 20,
      });
      const copies = p.elements.get("web")?.copies ?? 0;
      expect(copies).toBeGreaterThanOrEqual(2);
      expect(copies).toBeLessThanOrEqual(8);
    }
  });
});

/** A small seeded random number generator, so property runs repeat. */
function mulberry(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
