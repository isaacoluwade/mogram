import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { formatPointer, parsePointer } from "@mogram/core/assets";
import { projectArchive } from "@/features/files/download";
import { preparePicture, pictureSource } from "./pictures";
import { addAssetSource, assetBytes, findAsset, uploadMissingAssets } from "./remote";
import { assetBlob, keepAsset, sha256 } from "./store";

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const blob = (bytes: Uint8Array) => new Blob([bytes.slice().buffer], { type: "image/png" });

afterEach(() => vi.unstubAllGlobals());

describe("assets in this browser (D-101)", () => {
  it("keeps bytes once by their hash and gives them back as they were", async () => {
    const pointer = await keepAsset(blob(PNG), "image/png", { width: 2, height: 3 });
    expect(pointer.hash).toBe(await sha256(PNG.slice().buffer));
    expect(await keepAsset(blob(PNG), "image/png", { width: 2, height: 3 })).toEqual(pointer);
    const kept = await assetBlob(pointer);
    expect(new Uint8Array(await kept!.arrayBuffer())).toEqual(PNG);
    expect(await assetBytes(formatPointer(pointer))).toEqual(PNG);
    expect(await assetBytes("not a pointer")).toBeNull();
    // A pointer that says another length isn't these bytes.
    expect(await assetBlob({ ...pointer, bytes: 99 })).toBeNull();
  });

  it("refuses what no project can hold", async () => {
    await expect(keepAsset(new Blob([]), "image/png")).rejects.toThrow("That file is empty.");
    await expect(keepAsset(blob(PNG), "audio/webm", { seconds: 121 })).rejects.toThrow(
      "A recording can be at most 120 seconds.",
    );
  });

  it("puts the real bytes back in a downloaded zip", async () => {
    const pointer = formatPointer(await keepAsset(blob(PNG), "image/png", { width: 2, height: 3 }));
    const zip = unzipSync(
      await projectArchive({ "mogram.yaml": "mogram: 1\n", "images/a.png": pointer }, "deck"),
    );
    expect(zip["deck/images/a.png"]).toEqual(PNG);
    expect(strFromU8(zip["deck/mogram.yaml"] ?? new Uint8Array())).toBe("mogram: 1\n");
  });

  it("turns a picture into a source an SVG can draw, whatever the file holds", async () => {
    expect(pictureSource("data:image/png;base64,iVBORw==")).toBe("data:image/png;base64,iVBORw==");
    expect(pictureSource("<svg viewBox='0 0 1 1'></svg>")).toMatch(/^data:image\/svg\+xml/);
    const pointer = formatPointer(await keepAsset(blob(PNG), "image/png", { width: 2, height: 3 }));
    expect(pictureSource(pointer)).toBeNull();
    await preparePicture(pointer);
    expect(pictureSource(pointer)).toBe("data:image/png;base64,iVBORw0KGgo=");
  });
});

describe("assets and the server (D-101)", () => {
  it("fetches what this browser hasn't from where the diagram came from, checking every byte", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const hash = await sha256(bytes.slice().buffer);
    const pointer = { hash, type: "image/png" as const, bytes: 5 };
    const fetched = vi.fn(async () => new Response(blob(bytes)));
    vi.stubGlobal("fetch", fetched);
    const stop = addAssetSource("/api/share/abc");
    const found = await findAsset(pointer);
    expect(new Uint8Array(await found!.arrayBuffer())).toEqual(bytes);
    expect(fetched).toHaveBeenCalledWith(`/api/share/abc/assets/${hash}`, expect.anything());
    // Kept now: asked again, nothing is fetched.
    await findAsset(pointer);
    expect(fetched).toHaveBeenCalledTimes(1);
    stop();
    // Bytes that aren't what the pointer says are never kept.
    const other = { hash: "0".repeat(64), type: "image/png" as const, bytes: 5 };
    addAssetSource("/api/diagrams/x");
    expect(await findAsset(other)).toBeNull();
  });

  it("uploads only what the account is missing, and asks about each asset once a visit", async () => {
    const a = parsePointer(
      formatPointer(await keepAsset(blob(new Uint8Array([7, 7])), "image/png")),
    )!;
    const b = parsePointer(
      formatPointer(await keepAsset(blob(new Uint8Array([8, 8])), "image/png")),
    )!;
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (url === "/api/assets/missing") return Response.json({ missing: [b.hash] });
        return new Response(null, { status: 201 });
      }),
    );
    const files = {
      "a.png": formatPointer(a),
      "b.png": formatPointer(b),
      "c.png": formatPointer(a),
    };
    await uploadMissingAssets(files);
    expect(calls).toEqual(["POST /api/assets/missing", `PUT /api/assets/${b.hash}`]);
    await uploadMissingAssets(files);
    expect(calls).toHaveLength(2);
  });
});
