import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moveElements } from "@mogram/core/edit";
import type { ProjectFiles } from "@mogram/core/model";
import { ApiError } from "@/lib/api/client";
import { createEditorStore } from "../store/editor-store";
import { AutosaveController, PermanentSaveError } from "./autosave";

const FILES = { "mogram.yaml": "components:\n  web: generic/server\nlayout:\n  web: [0, 0]\n" };

function setup(persist: (files: ProjectFiles) => Promise<void>) {
  const store = createEditorStore({ files: FILES });
  const controller = new AutosaveController(store, 500);
  const detach = controller.attach(persist);
  let x = 0;
  const move = () => {
    x++;
    store
      .getState()
      .edit("Move", (f, d) => moveElements(f, d, [{ name: "web", parent: null, at: { x, y: 0 } }]));
  };
  return { store, controller, detach, move };
}

describe("autosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      visibilityState: "visible",
    });
    Object.assign(globalThis, { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("saves once after a quiet period, then reports saved", async () => {
    const persist = vi.fn(async () => {});
    const { store, move, detach } = setup(persist);
    move();
    move();
    expect(persist).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(persist).toHaveBeenCalledTimes(1);
    // A plain save: no checkpoint goes with it.
    expect(persist).toHaveBeenCalledWith(store.getState().files, undefined);
    expect(store.getState().save.kind).toBe("saved");
    detach();
  });

  it("stops on a conflict and waits for the person to choose", async () => {
    const persist = vi.fn(async () => {
      throw new ApiError(409, "conflict", "Changed elsewhere", 7);
    });
    const { store, move, detach } = setup(persist);
    move();
    await vi.advanceTimersByTimeAsync(500);
    expect(store.getState().save).toEqual({ kind: "conflict", currentVersion: 7 });
    move();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(persist).toHaveBeenCalledTimes(1);
    detach();
  });

  it("retries failures with growing delays", async () => {
    let calls = 0;
    const persist = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new ApiError(0, "offline", "Offline");
    });
    const { store, move, detach } = setup(persist);
    move();
    await vi.advanceTimersByTimeAsync(500);
    expect(store.getState().save.kind).toBe("error");
    await vi.advanceTimersByTimeAsync(1_000); // 500 × 2¹
    await vi.advanceTimersByTimeAsync(2_000); // 500 × 2²
    expect(persist).toHaveBeenCalledTimes(3);
    expect(store.getState().save.kind).toBe("saved");
    detach();
  });

  it("flushes immediately and stores the last change when the editor closes", async () => {
    const persist = vi.fn(async () => {});
    const { move, controller, detach } = setup(persist);
    move();
    await controller.flush();
    expect(persist).toHaveBeenCalledTimes(1);
    move();
    detach();
    await vi.runAllTimersAsync();
    expect(persist).toHaveBeenCalledTimes(2);
  });

  it("doesn't retry a request the server rejects, and says why", async () => {
    const persist = vi.fn(async () => {
      throw new ApiError(422, "invalid", "A diagram can be at most 5 MB.");
    });
    const { store, move, detach } = setup(persist);
    move();
    await vi.advanceTimersByTimeAsync(500);
    expect(store.getState().save).toEqual({
      kind: "error",
      message: "A diagram can be at most 5 MB.",
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(persist).toHaveBeenCalledTimes(1);
    detach();
  });

  it("explains an expired session instead of showing a bare 401", async () => {
    const persist = vi.fn(async () => {
      throw new ApiError(401, "unauthorized", "Unauthorized");
    });
    const { store, move, detach } = setup(persist);
    move();
    await vi.advanceTimersByTimeAsync(500);
    expect(store.getState().save).toEqual({
      kind: "error",
      message: "Your session has ended. Sign in again to keep saving.",
    });
    detach();
  });

  it("retries rate limits and timeouts, which pass", async () => {
    let calls = 0;
    const persist = vi.fn(async () => {
      calls++;
      if (calls === 1) throw new ApiError(429, "rate_limited", "Slow down");
    });
    const { store, move, detach } = setup(persist);
    move();
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(persist).toHaveBeenCalledTimes(2);
    expect(store.getState().save.kind).toBe("saved");
    detach();
  });

  it("reports false from flush when saving failed, so callers don't navigate away", async () => {
    const persist = vi.fn(async () => {
      throw new PermanentSaveError("This draft is no longer in this browser.");
    });
    const { move, controller, detach } = setup(persist);
    move();
    expect(await controller.flush()).toBe(false);
    detach();
  });
});
