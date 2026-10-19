import { describe, expect, it } from "vitest";
import { buildDeepLink, deepLinkQuery, parseDeepLink } from "./deep-link";

describe("deep links (SH-4, CA-7, TO-11, NE-9)", () => {
  it("round-trips a level, scene, tour step and card", () => {
    const link = {
      level: ["aks", "pods"],
      scene: "bad_deploy",
      tour: "how_an_order_flows",
      step: "aks.checkout",
      card: "checkout",
    };
    const url = buildDeepLink("https://mogram.app/s/abc", link);
    expect(url).toBe(
      "https://mogram.app/s/abc?level=aks,pods&scene=bad_deploy&tour=how_an_order_flows&step=aks.checkout&card=checkout",
    );
    expect(parseDeepLink(new URL(url).searchParams)).toEqual({
      ...link,
      root: null,
      slide: null,
      story: null,
      beat: null,
    });
  });

  it("round-trips a folder shown by itself, and drops anything that isn't a folder inside the project", () => {
    const url = buildDeepLink("https://mogram.app/s/abc", {
      root: "slides/intro",
      beat: 2,
      story: "main",
    });
    expect(url).toBe("https://mogram.app/s/abc?root=slides/intro&story=main&beat=2");
    expect(parseDeepLink(new URL(url).searchParams).root).toBe("slides/intro");
    for (const bad of ["../secrets", "a/../b", "/etc", "a//b", "a/", ".", "a b"])
      expect(parseDeepLink({ root: bad }).root).toBeNull();
  });

  it("round-trips a story and how many of its beats have played", () => {
    const url = buildDeepLink("https://mogram.app/s/abc", { story: "main", beat: 3 });
    expect(url).toBe("https://mogram.app/s/abc?story=main&beat=3");
    expect(parseDeepLink(new URL(url).searchParams)).toMatchObject({ story: "main", beat: 3 });
    // The opening isn't spelled out, and a beat that isn't a number is dropped.
    expect(deepLinkQuery({ story: "main", beat: 0 })).toBe("?story=main");
    expect(parseDeepLink({ story: "main", beat: "-1" }).beat).toBeNull();
    expect(parseDeepLink({ story: "main", beat: "2e3" }).beat).toBeNull();
  });

  it("reads Next's searchParams objects, taking the first of repeated values", () => {
    expect(parseDeepLink({ scene: ["outage", "other"], card: "web_vm" })).toMatchObject({
      scene: "outage",
      card: "web_vm",
    });
  });

  it("drops anything that isn't a Mogram name", () => {
    const parsed = parseDeepLink(
      new URLSearchParams("scene=<script>&card=javascript:alert(1)&level=ok,../etc,%20,x y"),
    );
    expect(parsed).toEqual({
      root: null,
      slide: null,
      level: ["ok"],
      scene: null,
      card: null,
      tour: null,
      step: null,
      story: null,
      beat: null,
    });
  });

  it("is empty for the whole diagram", () => {
    expect(deepLinkQuery({})).toBe("");
  });
});
