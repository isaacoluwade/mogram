import { describe, expect, it } from "vitest";
import { parseDiagram } from "@mogram/core/format";
import type { LibraryId } from "@mogram/icons";
import { defaultLibrary, librariesInUse, offeredLibraries } from "./library-choice";

const ALL: LibraryId[] = ["azure", "aws", "gcp", "k8s", "generic", "tool"];

function diagramOf(components: string): ReturnType<typeof parseDiagram>["diagram"] {
  return parseDiagram({ "mogram.yaml": `mogram: 1\ncomponents:\n${components}` }, "").diagram;
}

describe("offeredLibraries", () => {
  it("offers every library unless the diagram's settings narrow it", () => {
    expect(offeredLibraries(null)).toEqual(ALL);
    expect(offeredLibraries(["tools", "AWS", "generic"])).toEqual(["aws", "generic", "tool"]);
    expect(offeredLibraries(["Google Cloud", "kubernetes"])).toEqual(["gcp", "k8s"]);
  });

  it("ignores names it doesn't know, and never offers nothing", () => {
    expect(offeredLibraries(["aws", "oracle"])).toEqual(["aws"]);
    expect(offeredLibraries(["oracle"])).toEqual(ALL);
    expect(offeredLibraries([])).toEqual(ALL);
  });
});

describe("librariesInUse and defaultLibrary", () => {
  const aws = diagramOf(
    "  a: { type: aws/lambda }\n  b: { type: aws/s3 }\n  c: { type: generic/users }\n" +
      "  d: { type: generic/users }\n  e: { type: generic/server }\n  f: { type: k8s/svc }\n",
  );

  it("counts the libraries components draw from, most used first, following short ids", () => {
    expect(librariesInUse(aws)).toEqual(["generic", "aws", "k8s"]);
    expect(librariesInUse(diagramOf("  x: { type: icons/mine.svg }\n"))).toEqual([]);
  });

  it("opens the panel on the cloud the diagram is drawn in", () => {
    expect(defaultLibrary(ALL, librariesInUse(aws))).toBe("aws");
    expect(defaultLibrary(["gcp", "generic"], librariesInUse(aws))).toBe("gcp");
    expect(defaultLibrary(ALL, [])).toBe("azure");
    expect(defaultLibrary(ALL, ["generic"])).toBe("azure");
  });
});
