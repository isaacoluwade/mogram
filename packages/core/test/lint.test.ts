import { describe, expect, it } from "vitest";
import { parseDiagram } from "../src/format";
import { lintDiagram, type LintRule } from "../src/lint";

const lint = (yaml: string) => lintDiagram(parseDiagram({ "mogram.yaml": yaml }).diagram);
const rules = (yaml: string): string[] =>
  lint(yaml).map((f) => `${f.rule}:${f.elements.join(",")}`);
const has = (yaml: string, rule: LintRule) => lint(yaml).some((f) => f.rule === rule);

describe("architecture review", () => {
  it("finds a subnet outside any network, in the cloud's words", () => {
    const findings = lint(`mogram: 1
name: Shop
containers:
  vnet: { type: network }
  web: { type: subnet, in: vnet }
  stray: { type: subnet, label: Data subnet }
components:
  vm: { type: azure/virtual-machine, in: web }
  db: { type: azure/sql-database, in: stray }
connections:
  vm_to_db: { from: vm, to: db }
`);
    expect(findings.map((f) => f.rule)).toEqual(["subnet-outside-network"]);
    expect(findings[0]?.elements).toEqual(["stray"]);
    expect(findings[0]?.message).toBe(
      "Data subnet is a subnet that isn't inside a virtual network.",
    );
  });

  it("asks for AWS subnets to sit in a zone, once the diagram has zones", () => {
    const yaml = `mogram: 1
name: Shop
containers:
  region: { type: region }
  vpc: { type: network, in: region }
  az1: { type: availability-zone, in: vpc }
  public: { type: public-subnet, in: az1 }
  private: { type: private-subnet, in: vpc }
components:
  web: { type: aws/ec2, in: public }
  db: { type: aws/rds, in: private }
connections:
  web_to_db: { from: web, to: db }
`;
    expect(rules(yaml)).toEqual(["subnet-outside-zone:private"]);
    // Without zones in the diagram, there's nothing to ask.
    expect(
      has(yaml.replace(/ {2}az1:.*\n/, "").replace("in: az1", "in: vpc"), "subnet-outside-zone"),
    ).toBe(false);
  });

  it("finds things nested the wrong way round for that cloud, but not side-by-side kinds", () => {
    expect(
      rules(`mogram: 1
name: Shop
containers:
  sub: { type: subnet }
  vnet: { type: network, in: sub }
components:
  vm: { type: azure/virtual-machine, in: vnet }
`),
    ).toContain("nesting-order:vnet,sub");
    // Public and private subnets are peers; resource groups and boxes nest any way.
    expect(
      has(
        `mogram: 1
name: Shop
containers:
  rg: { type: resource-group }
  region: { type: region, in: rg }
  vpc: { type: network, in: region }
  pub: { type: public-subnet, in: vpc }
  priv: { type: private-subnet, in: pub }
components:
  web: { type: aws/ec2, in: priv }
`,
        "nesting-order",
      ),
    ).toBe(false);
  });

  it("points out icons from another cloud", () => {
    const findings = lint(`mogram: 1
name: Shop
components:
  web: { type: azure/app-services }
  api: { type: azure/function-apps }
  queue: { type: aws/sqs, label: Orders queue }
connections:
  web_to_api: { from: web, to: api }
  api_to_queue: { from: api, to: queue }
`);
    const mixed = findings.find((f) => f.rule === "mixed-clouds");
    expect(mixed?.elements).toEqual(["queue"]);
    expect(mixed?.message).toContain("Azure icons with AWS icons (Orders queue)");
  });

  it("notes what nothing connects to, counting connections to a container", () => {
    const yaml = `mogram: 1
name: Shop
containers:
  cluster: { type: cluster }
components:
  users: { type: generic/users }
  pod: { type: generic/container, in: cluster }
  vault: { type: generic/key, label: Key vault }
shapes:
  title: { shape: rectangle, label: Checkout }
connections:
  users_to_cluster: { from: users, to: cluster }
`;
    expect(rules(yaml)).toEqual(["unconnected:vault"]);
    // A diagram with no connections is an inventory: nothing to say.
    expect(has(yaml.replace(/connections:\n.*\n/, ""), "unconnected")).toBe(false);
  });

  it("notes empty containers, and lists warnings first", () => {
    const findings = lint(`mogram: 1
name: Shop
containers:
  empty: { type: box, label: Later }
  sub: { type: subnet }
components:
  vm: { type: generic/server, in: sub }
`);
    expect(findings.map((f) => `${f.severity}:${f.rule}`)).toEqual([
      "warning:subnet-outside-network",
      "note:empty-container",
    ]);
  });
});
