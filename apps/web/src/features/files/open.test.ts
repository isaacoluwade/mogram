// @vitest-environment jsdom
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { OpenError, cleanSvg, readProject } from "./open";

const file = (name: string, text: string | Uint8Array, relative?: string): File => {
  const blob = new File([typeof text === "string" ? text : text.slice()], name);
  if (relative !== undefined)
    Object.defineProperty(blob, "webkitRelativePath", { value: relative });
  return blob;
};

describe("opening files from the computer (AC-2)", () => {
  it("opens a single .mogram.yaml", async () => {
    const files = await readProject([
      file("checkout.mogram.yaml", "components:\n  web: generic/server\n"),
    ]);
    expect(Object.keys(files)).toEqual(["checkout.mogram.yaml"]);
  });

  it("opens a folder and strips the folder name", async () => {
    const files = await readProject([
      file("mogram.yaml", "components: {}\n", "checkout/mogram.yaml"),
      file("web.md", "# Web\n", "checkout/docs/web.md"),
    ]);
    expect(Object.keys(files).sort()).toEqual(["docs/web.md", "mogram.yaml"]);
  });

  it("opens a zip, skipping hidden and macOS metadata files", async () => {
    const zip = zipSync({
      "aks/mogram.yaml": strToU8("components: {}\n"),
      "aks/.DS_Store": strToU8("x"),
      "__MACOSX/aks/._mogram.yaml": strToU8("x"),
    });
    expect(Object.keys(await readProject([file("aks.zip", zip)]))).toEqual(["mogram.yaml"]);
  });

  it("never takes in paths that climb out of the folder", async () => {
    const zip = zipSync({
      "x/mogram.yaml": strToU8("a: 1"),
      "x/../../etc/passwd": strToU8("root"),
    });
    expect(Object.keys(await readProject([file("evil.zip", zip)]))).toEqual(["mogram.yaml"]);
  });

  it("refuses paths with characters outside the project rules", async () => {
    const zip = zipSync({ "d/mogram.yaml": strToU8("a: 1"), "d/<x>.md": strToU8("x") });
    await expect(readProject([file("a.zip", zip)])).rejects.toBeInstanceOf(OpenError);
  });

  it("explains when there's no Mogram file", async () => {
    await expect(readProject([file("notes.md", "# hi")])).rejects.toThrow(/no Mogram file/);
  });
});

describe("cleaning uploaded SVG (IC-4, AC-7)", () => {
  it("removes scripts and event handlers", () => {
    const clean = cleanSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect onclick="alert(2)" width="2" height="2"/></svg>',
    );
    expect(clean).not.toBeNull();
    expect(clean).not.toMatch(/script|onclick/i);
  });

  it("refuses SVG that loads anything from elsewhere", () => {
    expect(
      cleanSvg(
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.example/x.png"/></svg>',
      ),
    ).toBeNull();
    expect(
      cleanSvg(
        '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.example/x.css);</style></svg>',
      ),
    ).toBeNull();
  });

  it("refuses things that aren't SVG", () => {
    expect(cleanSvg("<html><body>hi</body></html>")).toBeNull();
  });
});
