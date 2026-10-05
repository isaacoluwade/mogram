import { describe, expect, it } from "vitest";
import { setData } from "../src/edit";
import { parseDiagram } from "../src/format";
import { fillPlaceholders, withPlaceholders, type ProjectFiles } from "../src/model";

const files: ProjectFiles = {
  "mogram.yaml": `mogram: 1
name: Payments
data: { env: prod, owner: platform team }
containers:
  vnet: { type: vnet, data: { region: eastus } }
components:
  api:
    type: generic/service
    label: "%name% (%env%) in %region%"
    in: vnet
    data: { owner: payments }
  db: { type: generic/database, label: "%owner% · %missing% · 100%% · 50% off" }
shapes:
  step: { shape: diamond, label: "%type% on %diagram%" }
`,
};

describe("placeholders (07-document-workflow §6.2)", () => {
  const { diagram, diagnostics } = parseDiagram(files);

  it("reads the diagram's own data", () => {
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect([...diagram.settings.data]).toEqual([
      ["env", "prod"],
      ["owner", "platform team"],
    ]);
  });

  it("looks in the element, its containers, the diagram, then the built-ins", () => {
    const api = diagram.components.get("api");
    expect(api?.label).toBe("%name% (%env%) in %region%");
    expect(withPlaceholders(diagram, "api", api?.label ?? "")).toBe("api (prod) in eastus");
    // The element's own value wins over the diagram's.
    expect(withPlaceholders(diagram, "api", "%owner%")).toBe("payments");
    expect(withPlaceholders(diagram, "step", "%type% on %diagram%")).toBe("diamond on Payments");
  });

  it("leaves unknown tokens and stray percent signs as written; %% is one %", () => {
    expect(withPlaceholders(diagram, "db", diagram.components.get("db")?.label ?? "")).toBe(
      "platform team · %missing% · 100% · 50% off",
    );
    expect(fillPlaceholders("no tokens", () => "x")).toBe("no tokens");
  });

  it("fills %date% from the context", () => {
    expect(withPlaceholders(diagram, "db", "as of %date%", { date: new Date(2026, 9, 4) })).toBe(
      "as of 2026-10-04",
    );
  });

  it("writes the diagram's data with the settings at the top", () => {
    const plain: ProjectFiles = {
      "mogram.yaml": "mogram: 1\nname: Plain\ncomponents:\n  a: generic/service\n",
    };
    const result = setData(plain, parseDiagram(plain).diagram, {
      name: null,
      rows: [
        ["env", "staging"],
        ["replicas", "3"],
      ],
    });
    expect(result.files["mogram.yaml"]).toBe(
      "mogram: 1\nname: Plain\ndata: { env: staging, replicas: 3 }\ncomponents:\n  a: generic/service\n",
    );
    const { diagram: next } = parseDiagram(result.files);
    expect(next.settings.data.get("replicas")).toBe(3);
    const cleared = setData(result.files, next, { name: null, rows: [] });
    expect(cleared.files["mogram.yaml"]).toBe(plain["mogram.yaml"]);
  });
});
