import { describe, expect, it } from "vitest";
import { parseHexColor } from "./fields";

describe("parseHexColor", () => {
  it.each([
    ["#fff", "#ffffff"],
    ["FFF", "#ffffff"],
    ["#1A2b3C", "#1a2b3c"],
    ["  0a0a0a ", "#0a0a0a"],
    ["#ffff", "#ffffff"],
    ["#11223380", "#11223380"],
    ["11223380", "#11223380"],
  ])("reads %j as %s", (text, color) => {
    expect(parseHexColor(text)).toBe(color);
  });

  it.each(["", "#ff", "#fffff", "red", "#gggggg", "rgb(0,0,0)"])("rejects %j", (text) => {
    expect(parseHexColor(text)).toBeNull();
  });
});
