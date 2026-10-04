import { afterEach, describe, expect, it, vi } from "vitest";
import { IconCache, iconSource } from "./icons";

const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';

function deferred() {
  let resolve: (response: Response) => void = () => {};
  const promise = new Promise<Response>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("IconCache", () => {
  it("joins a load already in flight, so preloading waits for the real result", async () => {
    const response = deferred();
    const fetch = vi.fn(() => response.promise);
    vi.stubGlobal("fetch", fetch);
    const cache = new IconCache();

    expect(cache.text("/a.svg")).toBeUndefined(); // drawing starts the load
    let preloaded = false;
    const preload = cache.loadAll(["/a.svg"]).then(() => (preloaded = true));
    await Promise.resolve();
    expect(preloaded).toBe(false);

    response.resolve(new Response(svg));
    await preload;
    expect(cache.text("/a.svg")).toBe(svg);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports a failed icon as unavailable, then tries again later", async () => {
    let now = 1_000;
    const fetch = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response(svg));
    vi.stubGlobal("fetch", fetch);
    const cache = new IconCache(() => now);
    const listener = vi.fn();
    cache.subscribe(listener);

    await cache.load("/b.svg");
    expect(cache.text("/b.svg")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);

    now += 20_000;
    expect(cache.text("/b.svg")).toBeUndefined(); // retrying
    await cache.load("/b.svg");
    expect(cache.text("/b.svg")).toBe(svg);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("retries a failed icon straight away when an export preloads it", async () => {
    const fetch = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response(svg));
    vi.stubGlobal("fetch", fetch);
    const cache = new IconCache();
    await cache.load("/c.svg");
    expect(cache.text("/c.svg")).toBeNull();
    await cache.loadAll(["/c.svg"]);
    expect(cache.text("/c.svg")).toBe(svg);
  });
});

describe("iconSource", () => {
  it("draws glyphs from any library in the theme colour, and artwork as it is", () => {
    expect(iconSource("generic/server", {}, "").kind).toBe("glyph");
    expect(iconSource("aws/user", {}, "").kind).toBe("glyph");
    expect(iconSource("aws/aws-cloud", {}, "").kind).toBe("glyph");
    expect(iconSource("aws/lambda", {}, "")).toEqual({
      kind: "artwork",
      url: "/icons/aws/lambda.svg",
      inline: null,
    });
    expect(iconSource("gcp/bigquery", {}, "").kind).toBe("artwork");
    expect(iconSource("k8s/svc", {}, "").url).toBe("/icons/k8s/service.svg");
  });

  it("reads uploads from the diagram's files and reports anything else as missing", () => {
    const files = { "icons/mine.svg": svg };
    expect(iconSource("icons/mine.svg", files, "")).toEqual({
      kind: "upload",
      url: null,
      inline: svg,
    });
    expect(iconSource("aws/not-real", files, "").kind).toBe("missing");
  });
});
