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
    expect(parseDeepLink(new URL(url).searchParams)).toEqual(link);
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
    expect(parsed).toEqual({ level: ["ok"], scene: null, card: null, tour: null, step: null });
  });

  it("is empty for the whole diagram", () => {
    expect(deepLinkQuery({})).toBe("");
  });
});
