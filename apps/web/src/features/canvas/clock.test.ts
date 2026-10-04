import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Clock } from "./clock";

/** A controllable time source and animation-frame queue. */
function setup() {
  let now = 1_000;
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames[id - 1] = () => {};
  });
  const clock = new Clock(() => now);
  return {
    clock,
    advance: (ms: number) => {
      now += ms;
    },
    /** Runs the frames queued so far (not ones they queue). */
    frame: () => {
      for (const callback of frames.splice(0)) callback(now);
    },
    pending: () => frames.length,
  };
}

describe("Clock (PR-9)", () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.unstubAllGlobals());

  it("gives every subscriber the same time each frame", () => {
    const { clock, advance, frame } = setup();
    const a: number[] = [];
    const b: number[] = [];
    clock.subscribe((t) => a.push(t));
    clock.subscribe((t) => b.push(t));
    advance(500);
    frame();
    expect(a.at(-1)).toBe(0.5);
    expect(b.at(-1)).toBe(0.5);
  });

  it("holds still while paused and carries on from there", () => {
    const { clock, advance, frame, pending } = setup();
    const seen: number[] = [];
    clock.subscribe((t) => seen.push(t));
    advance(1_000);
    clock.pause();
    frame();
    expect(pending()).toBe(0); // no frames while paused
    advance(5_000);
    expect(clock.time()).toBe(1);
    clock.resume();
    advance(250);
    frame();
    expect(seen.at(-1)).toBe(1.25);
  });

  it("tick() runs listeners once, so a paused diagram still shows state changes", () => {
    const { clock } = setup();
    clock.pause();
    const listener = vi.fn();
    clock.subscribe(listener);
    listener.mockClear();
    clock.tick();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops asking for frames when nothing listens", () => {
    const { clock, frame, pending } = setup();
    const stop = clock.subscribe(() => {});
    expect(pending()).toBe(1);
    stop();
    frame();
    expect(pending()).toBe(0);
  });
});
