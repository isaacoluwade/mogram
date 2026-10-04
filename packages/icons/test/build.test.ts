import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertSafe,
  cleanArtwork,
  inlineStyles,
  removeNoise,
  scopeIds,
  tidyRoot,
  toCutoutGlyph,
  toGlyph,
  unwrapBareGroups,
  unwrapLinks,
} from "../scripts/lib/clean";
import { slugify } from "../scripts/lib/model";
import { renderCatalog } from "../scripts/lib/render-catalog";
import { renderIds } from "../scripts/lib/render-ids";
import { loadPinnedSet, sha256 } from "../scripts/lib/vendor";
import { parseSvg, serializeSvg, type SvgElement } from "../scripts/lib/svg";
import type { IconEntry } from "../src";

const SVG = 'xmlns="http://www.w3.org/2000/svg"';

function clean(source: string, steps: readonly ((svg: SvgElement) => void)[]): string {
  const svg = parseSvg(source);
  for (const step of steps) step(svg);
  return serializeSvg(svg);
}

const scopeAs = (prefix: string) => (svg: SvgElement) => {
  scopeIds(svg, prefix);
};

describe("parseSvg and serializeSvg", () => {
  it("round-trips an icon, self-closing empty elements and decoding entities", () => {
    const source = `<?xml version="1.0"?><!-- made by hand --><svg ${SVG} viewBox="0 0 1 1"><text>a &amp; b</text><path d="M0 0" /></svg>`;
    expect(serializeSvg(parseSvg(source))).toBe(
      `<svg ${SVG} viewBox="0 0 1 1"><text>a &amp; b</text><path d="M0 0"/></svg>`,
    );
  });

  it("refuses documents it cannot read", () => {
    expect(() => parseSvg(`<svg ${SVG}><g></svg>`)).toThrow();
    expect(() => parseSvg(`<svg ${SVG}><g>`)).toThrow();
    expect(() => parseSvg(`<html></html>`)).toThrow(/<svg>/);
    expect(() => parseSvg(`<svg ${SVG}><![CDATA[x]]></svg>`)).toThrow(/CDATA/);
    expect(() => parseSvg(`<svg ${SVG}></svg><`)).toThrow();
  });
});

describe("removeNoise", () => {
  it("drops titles, editor attributes, root size and whitespace", () => {
    const source = `<svg ${SVG} id="x" data-name="Layer 1" width="18" height="18" viewBox="0 0 18 18">
      <title>Icon-compute-21</title>
      <g data-name="g"><path d="M0 0"/></g>
    </svg>`;
    expect(clean(source, [removeNoise])).toBe(
      `<svg ${SVG} viewBox="0 0 18 18"><g><path d="M0 0"/></g></svg>`,
    );
  });

  it("repairs a misspelt viewBox or derives one from width and height", () => {
    expect(clean(`<svg ${SVG} width="18" height="18" xviewBox="0 0 9 9"/>`, [removeNoise])).toBe(
      `<svg ${SVG} viewBox="0 0 9 9"/>`,
    );
    expect(clean(`<svg ${SVG} width="18px" height="13.5"/>`, [removeNoise])).toBe(
      `<svg ${SVG} viewBox="0 0 18 13.5"/>`,
    );
    expect(() => clean(`<svg ${SVG}/>`, [removeNoise])).toThrow(/viewBox/);
  });
});

describe("inlineStyles", () => {
  it("turns class rules into attributes, with inline style winning", () => {
    const source = `<svg ${SVG}><defs><style>.a{fill:#111;}.b,.c{opacity:.5}/* note */</style></defs><rect class="a b" fill="#000"/><rect class="a" style="fill: #222; isolation: isolate"/></svg>`;
    expect(clean(source, [inlineStyles])).toBe(
      `<svg ${SVG}><defs/><rect fill="#111" opacity=".5"/><rect fill="#222"/></svg>`,
    );
  });

  it("keeps text and filter properties and drops Inkscape's layout-only ones", () => {
    const source = `<svg ${SVG}><text style="font-family:Arial;font-size:2px;line-height:1.25;-inkscape-font-specification:Arial;text-align:start;marker:none;filter:url(#f)">a</text></svg>`;
    expect(clean(source, [inlineStyles])).toBe(
      `<svg ${SVG}><text font-family="Arial" font-size="2px" filter="url(#f)">a</text></svg>`,
    );
    expect(() => clean(`<svg ${SVG}><path style="marker:url(#m)"/></svg>`, [inlineStyles])).toThrow(
      /presentation attribute/,
    );
  });

  it("refuses CSS it cannot express as attributes", () => {
    expect(() => clean(`<svg ${SVG}><style>rect{fill:red}</style></svg>`, [inlineStyles])).toThrow(
      /selector/,
    );
    expect(() =>
      clean(`<svg ${SVG}><rect style="mix-blend-mode: multiply"/></svg>`, [inlineStyles]),
    ).toThrow(/presentation attribute/);
    expect(() =>
      clean(`<svg ${SVG}><style>@media print{.a{fill:red}}</style></svg>`, [inlineStyles]),
    ).toThrow();
  });
});

describe("scopeIds", () => {
  it("prefixes referenced ids and their references, and drops the rest", () => {
    const source = `<svg ${SVG}><defs><linearGradient id="g1"/><linearGradient id="g2" href="#g1"/><clipPath id="c"/></defs><g id="unused"><rect fill="url(#g2)" clip-path="url('#c')"/><use xlink:href="#g1"/></g></svg>`;
    expect(clean(source, [scopeAs("vm")])).toBe(
      `<svg ${SVG}><defs><linearGradient id="vm-a"/><linearGradient id="vm-b" href="#vm-a"/><clipPath id="vm-c"/></defs><g><rect fill="url(#vm-b)" clip-path="url(#vm-c)"/><use xlink:href="#vm-a"/></g></svg>`,
    );
  });

  it("still scopes a reference to an id the file never defines", () => {
    expect(clean(`<svg ${SVG}><rect fill="url(#missing)"/></svg>`, [scopeAs("x")])).toBe(
      `<svg ${SVG}><rect fill="url(#x-a)"/></svg>`,
    );
  });

  it("counts past z with two letters", () => {
    const gradients = Array.from({ length: 28 }, (_, n) => `<linearGradient id="g${n}"/>`).join("");
    const uses = Array.from({ length: 28 }, (_, n) => `<rect fill="url(#g${n})"/>`).join("");
    const result = clean(`<svg ${SVG}>${gradients}${uses}</svg>`, [scopeAs("s")]);
    expect(result).toContain('id="s-z"');
    expect(result).toContain('id="s-aa"');
    expect(result).toContain('id="s-ab"');
  });
});

describe("unwrapBareGroups and tidyRoot", () => {
  it("lifts children out of attribute-less groups only", () => {
    expect(
      clean(`<svg ${SVG}><g><g opacity=".5"><g><path d="M0 0"/></g></g></g></svg>`, [
        unwrapBareGroups,
      ]),
    ).toBe(`<svg ${SVG}><g opacity=".5"><path d="M0 0"/></g></svg>`);
  });

  it("removes empty groups and defs", () => {
    expect(
      clean(`<svg ${SVG}><defs/><g fill="red"><g transform="x"/></g><path d="M0 0"/></svg>`, [
        unwrapBareGroups,
      ]),
    ).toBe(`<svg ${SVG}><path d="M0 0"/></svg>`);
  });

  it("unwraps links that go nowhere and refuses real ones", () => {
    expect(clean(`<svg ${SVG}><a id="a1"><path d="M0 0"/></a></svg>`, [unwrapLinks])).toBe(
      `<svg ${SVG}><path d="M0 0"/></svg>`,
    );
    expect(() => clean(`<svg ${SVG}><a href="https://x.example"/></svg>`, [unwrapLinks])).toThrow(
      /link/,
    );
  });

  it("drops editor namespaces from the root", () => {
    const source = `<svg ${SVG} xmlns:inkscape="i" xmlns:dc="d" xmlns:svg="s" viewBox="0 0 1 1"/>`;
    expect(clean(source, [tidyRoot])).toBe(`<svg ${SVG} viewBox="0 0 1 1"/>`);
  });

  it("puts xmlns and viewBox first and drops an unused xlink namespace", () => {
    const source = `<svg fill="none" viewBox="0 0 1 1" xmlns:xlink="http://www.w3.org/1999/xlink" ${SVG}/>`;
    expect(clean(source, [tidyRoot])).toBe(`<svg ${SVG} viewBox="0 0 1 1" fill="none"/>`);
    const withXlink = `<svg viewBox="0 0 1 1" ${SVG}><use xlink:href="#a"/></svg>`;
    expect(clean(withXlink, [tidyRoot])).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
  });
});

describe("assertSafe", () => {
  it.each([
    [`<svg ${SVG}><script>alert(1)</script></svg>`, /script/],
    [`<svg ${SVG} onload="alert(1)"/>`, /onload/],
    [`<svg ${SVG}><a href="javascript:alert(1)"/></svg>`, /Unsafe element <a>/],
    [`<svg ${SVG}><foreignObject/></svg>`, /foreignObject/],
    [`<svg ${SVG}><use href="https://evil.example/x.svg#a"/></svg>`, /External reference/],
    [`<svg ${SVG}><rect fill="url(https://evil.example/x.svg#a)"/></svg>`, /External url/],
    [`<svg ${SVG}><image href="#a"/></svg>`, /image/],
  ])("rejects %s", (source, message) => {
    expect(() => {
      assertSafe(parseSvg(source));
    }).toThrow(message);
  });

  it("accepts local references, quoted or not", () => {
    expect(() => {
      assertSafe(
        parseSvg(`<svg ${SVG}><rect fill="url('#a')" clip-path="url(#b)"/><use href="#a"/></svg>`),
      );
    }).not.toThrow();
  });
});

describe("cleanArtwork", () => {
  it("cleans an Inkscape file down to its drawing", () => {
    const source = `<?xml version="1.0"?><!-- Created with Inkscape --><svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="s" ${SVG} width="18mm" height="17mm" viewBox="0 0 18 17" id="svg1" inkscape:version="0.91"><defs id="defs2"/><sodipodi:namedview id="base"/><metadata><dc:title/></metadata><g inkscape:label="Layer 1" id="layer1"><a id="a3"><path id="p" d="M0 0" style="fill:#326ce5;stroke:none"/></a></g></svg>`;
    expect(serializeSvg(cleanArtwork(source, "pod"))).toBe(
      `<svg ${SVG} viewBox="0 0 18 17"><path d="M0 0" fill="#326ce5" stroke="none"/></svg>`,
    );
  });
});

describe("toGlyph and toCutoutGlyph", () => {
  it("recolours a single-colour drawing to currentColor", () => {
    const svg = parseSvg(`<svg ${SVG}><g fill="none"><path fill="#232F3D" d="M0 0"/></g></svg>`);
    toGlyph(svg, new Set(["#232f3d"]));
    expect(serializeSvg(svg)).toBe(
      `<svg ${SVG}><g fill="none"><path fill="currentColor" d="M0 0"/></g></svg>`,
    );
    const other = parseSvg(`<svg ${SVG}><path fill="#ff0000"/></svg>`);
    expect(() => {
      toGlyph(other, new Set(["#232f3d"]));
    }).toThrow(/#ff0000/);
  });

  it("cuts a white mark out of a dark square that takes the theme colour", () => {
    const svg = parseSvg(
      `<svg ${SVG} viewBox="0 0 40 40"><g fill-rule="evenodd"><rect fill="#242F3E" width="40" height="40"/><path fill="#FFFFFF" d="M1 1"/></g></svg>`,
    );
    toCutoutGlyph(svg, "cloud-cutout", {
      fill: new Set(["#242f3e"]),
      cutout: new Set(["#ffffff"]),
    });
    expect(serializeSvg(svg)).toBe(
      `<svg ${SVG} viewBox="0 0 40 40"><defs><mask id="cloud-cutout"><rect width="40" height="40" fill="#fff"/><path fill-rule="evenodd" fill="#000" d="M1 1"/></mask></defs><g mask="url(#cloud-cutout)"><g fill-rule="evenodd"><rect fill="currentColor" width="40" height="40"/></g></g></svg>`,
    );
  });

  it("refuses a cut-out shape under a transform it would lose", () => {
    const svg = parseSvg(
      `<svg ${SVG} viewBox="0 0 4 4"><g transform="scale(2)"><g><path fill="#fff" d="M0 0"/></g></g></svg>`,
    );
    expect(() => {
      toCutoutGlyph(svg, "x", { fill: new Set(), cutout: new Set(["#fff"]) });
    }).toThrow(/transform/);
  });
});

describe("loadPinnedSet", () => {
  it("checks a set of files against one manifest hash", async () => {
    const vendor = await mkdtemp(join(tmpdir(), "mogram-vendor-"));
    await mkdir(join(vendor, "set", "a"), { recursive: true });
    await writeFile(join(vendor, "set", "a", "one.svg"), "<svg/>");
    await writeFile(join(vendor, "set", "two.svg"), "<svg></svg>");
    const paths = ["a/one.svg", "two.svg"];
    const manifest = `a/one.svg ${sha256("<svg/>")}\ntwo.svg ${sha256("<svg></svg>")}\n`;
    const source = { baseUrl: "https://unused.example", paths, sha256: sha256(manifest) };
    const files = await loadPinnedSet(vendor, "set", source);
    expect([...files.keys()]).toEqual(paths);
    await writeFile(join(vendor, "set", "two.svg"), "<svg>changed</svg>");
    await expect(loadPinnedSet(vendor, "set", source)).rejects.toThrow(/SHA-256/);
  });
});

describe("slugify", () => {
  it("turns display names into slugs", () => {
    expect(slugify("Virtual Machine")).toBe("virtual-machine");
    expect(slugify("Web App + Database")).toBe("web-app-database");
    expect(slugify("Web Application Firewall Policies (WAF)")).toBe(
      "web-application-firewall-policies-waf",
    );
    expect(slugify("Workspaces 2")).toBe("workspaces-2");
  });
});

describe("renderCatalog", () => {
  const entry: IconEntry = {
    id: "tool/example",
    library: "tool",
    slug: "example",
    name: "Example",
    category: "Test",
    otherCategories: [],
    aliases: ["one", "two"],
    kind: "artwork",
    color: "#123456",
  };

  it("writes a typed module marked as generated", () => {
    const source = renderCatalog([entry]);
    expect(source.startsWith("// generated by scripts/build-catalog.ts — do not edit")).toBe(true);
    expect(source).toContain("export const ICONS: readonly IconEntry[] = [");
    expect(source).toContain('    aliases: ["one", "two"],\n');
    expect(source).toContain('    color: "#123456",\n');
  });

  it("splits a long catalog into array literals TypeScript can check", () => {
    const many = Array.from({ length: 900 }, (_, n) => ({ ...entry, id: `tool/e${n}` }));
    const source = renderCatalog(many);
    expect(source).toContain("const PART_3: readonly IconEntry[] = [");
    expect(source).not.toContain("PART_4");
    expect(source).toContain(
      "export const ICONS: readonly IconEntry[] = [...PART_1, ...PART_2, ...PART_3];",
    );
  });

  it("breaks a list that would not fit in 100 columns onto one item per line", () => {
    const long = { ...entry, aliases: Array.from({ length: 12 }, (_, n) => `alias number ${n}`) };
    expect(renderCatalog([long])).toContain('    aliases: [\n      "alias number 0",\n');
  });
});

describe("renderIds", () => {
  it("lists slugs and glyph slugs per library the way Prettier lays them out", () => {
    const glyph: IconEntry = {
      id: "generic/user",
      library: "generic",
      slug: "user",
      name: "User",
      category: "People",
      otherCategories: [],
      aliases: [],
      kind: "glyph",
      color: null,
    };
    const source = renderIds([
      glyph,
      { ...glyph, id: "aws/ec2", library: "aws", slug: "ec2", kind: "artwork" },
    ]);
    expect(source).toContain('  aws: "ec2",\n');
    expect(source).toContain('  generic: "user",\n');
    expect(source).toContain("export const GLYPH_SLUGS");
    expect(source.split("export const GLYPH_SLUGS")[1]).toContain('  aws: "",\n');
  });
});
