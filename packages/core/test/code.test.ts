import { describe, expect, it } from "vitest";
import {
  codeSize,
  columnsThatFit,
  highlight,
  languageForFile,
  lineRange,
  listingLines,
  listingOf,
  shownLines,
  type Token,
  type TokenKind,
} from "../src/code";

/** A line's tokens as `kind:text` pairs, without the spaces between them. */
const kinds = (tokens: readonly Token[]): string[] =>
  tokens.filter((token) => token.text.trim() !== "").map((t) => `${t.kind}:${t.text.trim()}`);

const one = (language: Parameters<typeof highlight>[0], line: string) =>
  kinds(highlight(language, [line])[0] ?? []);

const kindOf = (language: Parameters<typeof highlight>[0], line: string): TokenKind | undefined =>
  highlight(language, [line])[0]?.[0]?.kind;

describe("listings (D-103)", () => {
  it("keeps every line as written, but for tabs and a final newline", () => {
    expect(listingLines("a\n\tb\n\n  c\n", "plain")).toEqual(["a", "  b", "", "  c"]);
    expect(listingLines("a\r\nb", "plain")).toEqual(["a", "b"]);
    expect(listingLines("", "plain")).toEqual([""]);
  });

  it("drops a terminal's colour and title codes from console output only", () => {
    const esc = String.fromCharCode(27);
    const bel = String.fromCharCode(7);
    const text = `${esc}[32m+ create${esc}[0m\n${esc}]0;title${bel}done`;
    expect(listingLines(text, "console")).toEqual(["+ create", "done"]);
    expect(listingLines(text, "plain")[0]).toContain(esc);
  });

  it("shows a slice in the file's own numbers, and what there is of one past the end", () => {
    const text = "1\n2\n3\n4\n5\n";
    const slice = listingOf(text, "plain", [2, 3]);
    expect(slice).toMatchObject({ first: 2, last: 3, missing: false });
    expect(shownLines(slice)).toEqual(["2", "3"]);
    expect(shownLines(listingOf(text, "plain", [4, 40]))).toEqual(["4", "5"]);
    expect(listingOf(null, "plain", [3, 4])).toMatchObject({ missing: true, lines: [] });
  });

  it("reads a line or a range, and nothing else", () => {
    expect(lineRange(12)).toEqual([12, 12]);
    expect(lineRange("12-31")).toEqual([12, 31]);
    expect(lineRange(" 4 - 6 ")).toEqual([4, 6]);
    for (const bad of ["31-12", "0", "x", "1-", -2, 1.5, null]) expect(lineRange(bad)).toBeNull();
  });

  it("knows a language by its file's extension", () => {
    expect(languageForFile("code/main.tf")).toBe("hcl");
    expect(languageForFile("prod.tfvars")).toBe("hcl");
    expect(languageForFile("a.yml")).toBe("yaml");
    expect(languageForFile("change.patch")).toBe("diff");
    expect(languageForFile("deploy.sh")).toBe("shell");
    expect(languageForFile("notes.txt")).toBe("plain");
    expect(languageForFile("Makefile")).toBe("plain");
    expect(languageForFile(null)).toBe("plain");
  });

  it("is as big as its widest line and its rows, with room for a header and numbers", () => {
    const listing = listingOf("x".repeat(40), "plain", null);
    const plain = codeSize(listing, { fontSize: 20, numbers: false, header: false });
    // 40 characters at 12 px, and 16 px either side: 512 px is 64 cells.
    expect(plain.w).toBe(64);
    // One row of 30 px, and 16 px above and below: 62 px is 8 cells.
    expect(plain.h).toBe(8);
    const dressed = codeSize(listing, { fontSize: 20, numbers: true, header: true });
    expect(dressed.w).toBeGreaterThan(plain.w);
    expect(dressed.h).toBe(Math.ceil((30 + 32 + 36) / 8));
    expect(columnsThatFit(listing, 512, { fontSize: 20, numbers: false })).toBe(40);
  });
});

describe("colouring code (D-103)", () => {
  it("colours HCL's block types, labels, attributes, strings, numbers and comments", () => {
    expect(one("hcl", 'resource "azurerm_resource_group" "main" {')).toEqual([
      "keyword:resource",
      'string:"azurerm_resource_group"',
      'string:"main"',
      "punctuation:{",
    ]);
    expect(one("hcl", "  required_providers {")).toEqual([
      "keyword:required_providers",
      "punctuation:{",
    ]);
    expect(one("hcl", '  backend "azurerm" {')[0]).toBe("keyword:backend");
    expect(one("hcl", "  location = 3 # west")).toEqual([
      "name:location",
      "punctuation:=",
      "number:3",
      "comment:# west",
    ]);
    // An attribute named like a block type is still an attribute.
    expect(one("hcl", "  provider = azurerm.west")[0]).toBe("name:provider");
    expect(one("hcl", "  enabled = true")).toContain("keyword:true");
  });

  it("carries HCL's block comments and heredocs from line to line", () => {
    const lines = highlight("hcl", [
      "/* a",
      "b */ x = 1",
      "policy = <<EOT",
      "# not a comment",
      "EOT",
    ]);
    expect(kinds(lines[0] ?? [])).toEqual(["comment:/* a"]);
    expect(kinds(lines[1] ?? [])[0]).toBe("comment:b */");
    expect(kinds(lines[3] ?? [])).toEqual(["string:# not a comment"]);
    expect(kinds(lines[4] ?? [])).toEqual(["punctuation:EOT"]);
  });

  it("reads a plan by each line's first mark", () => {
    const marks: [string, TokenKind][] = [
      ["  + resource", "added"],
      ["  - resource", "removed"],
      ["  ~ name = a -> b", "changed"],
      ["-/+ resource", "replaced"],
      ["+/- resource", "replaced"],
      [" <= data", "read"],
      ["  # azurerm_x.y must be replaced", "comment"],
      ["Plan: 9 to add, 0 to change, 9 to destroy.", "summary"],
      ["No changes. Your infrastructure matches.", "summary"],
      ["      }", "plain"],
    ];
    for (const [line, kind] of marks) expect(kindOf("plan", line), line).toBe(kind);
  });

  it("takes a diff's mark from its first column only", () => {
    expect(kindOf("diff", "+added")).toBe("added");
    expect(kindOf("diff", "-removed")).toBe("removed");
    expect(kindOf("diff", " - item: 1")).toBe("plain");
    expect(kindOf("diff", "@@ -1,2 +1,2 @@")).toBe("summary");
    expect(kindOf("diff", "--- a/main.tf")).toBe("summary");
  });

  it("tells a console's commands from their output", () => {
    expect(one("console", "$ terraform plan -out tfplan")).toEqual([
      "punctuation:$",
      "command:terraform",
      "command:plan -out tfplan",
    ]);
    expect(kindOf("console", "Terraform will perform the following actions:")).toBe("output");
    expect(kindOf("console", "  $ indented is output")).toBe("output");
  });

  it("colours each command in a shell line, and comments only after a space", () => {
    expect(one("shell", "terraform init && terraform apply | tee log # run")).toEqual([
      "command:terraform",
      "plain:init",
      "punctuation:&&",
      "command:terraform",
      "plain:apply",
      "punctuation:|",
      "command:tee",
      "plain:log",
      "comment:# run",
    ]);
    expect(one("shell", "TF_LOG=debug terraform plan")).toEqual([
      "name:TF_LOG=debug",
      "command:terraform",
      "plain:plan",
    ]);
    expect(one("shell", 'echo "$HOME" ${X}')).toEqual([
      "command:echo",
      'string:"$HOME"',
      "name:${X}",
    ]);
    expect(one("shell", "curl http://a/#x")).toEqual(["command:curl", "plain:http://a/#x"]);
  });

  it("colours YAML's keys, values and comments, never a word that only looks like a keyword", () => {
    expect(one("yaml", "data: 1")).toEqual(["name:data", "punctuation::", "number:1"]);
    expect(one("yaml", "  output: x # note")).toEqual([
      "name:output",
      "punctuation::",
      "string:x",
      "comment:# note",
    ]);
    expect(one("yaml", "- enabled: true")).toEqual([
      "punctuation:-",
      "name:enabled",
      "punctuation::",
      "keyword:true",
    ]);
    expect(one("yaml", "url: http://a/#x")).toEqual([
      "name:url",
      "punctuation::",
      "string:http://a/#x",
    ]);
    expect(one("yaml", "# a comment")).toEqual(["comment:# a comment"]);
  });

  it("colours JSON's keys apart from its strings", () => {
    expect(one("json", '  "name": "web", "count": 3, "on": true')).toEqual([
      'name:"name"',
      "punctuation::",
      'string:"web"',
      "punctuation:,",
      'name:"count"',
      "punctuation::",
      "number:3",
      "punctuation:,",
      'name:"on"',
      "punctuation::",
      "keyword:true",
    ]);
  });

  it("keeps every character of every line, in order", () => {
    const lines = ['resource "x" "y" { # a', "  - b: 'c'", "$ ls | wc -l"];
    for (const language of ["hcl", "yaml", "shell", "console", "plain"] as const)
      expect(
        highlight(language, lines).map((tokens) => tokens.map((t) => t.text).join("")),
        language,
      ).toEqual(lines);
  });
});
