"use client";

import { createContext, use, useEffect, useRef } from "react";

/**
 * One shared clock drives every animation (PR-9). Subscribers get the same `t` (seconds) each
 * frame and write DOM attributes through refs, so animation never re-renders React.
 * The clock can be paused (motion toggle, reduced motion) — `t` then holds still.
 */
export class Clock {
  private readonly listeners = new Set<(t: number) => void>();
  private frame: number | null = null;
  private origin = 0;
  private pausedAt: number | null = null;
  private readonly now: () => number;
  private readonly start: number;

  constructor(now: () => number = () => performance.now()) {
    this.now = now;
    this.start = now();
  }

  /** Seconds since the clock started, excluding paused time. */
  time(): number {
    const now = this.pausedAt ?? this.now();
    return (now - this.start - this.origin) / 1000;
  }

  get paused(): boolean {
    return this.pausedAt !== null;
  }

  pause(): void {
    if (this.pausedAt === null) this.pausedAt = this.now();
  }

  resume(): void {
    if (this.pausedAt === null) return;
    this.origin += this.now() - this.pausedAt;
    this.pausedAt = null;
    this.ensureRunning();
  }

  subscribe(listener: (t: number) => void): () => void {
    this.listeners.add(listener);
    listener(this.time());
    this.ensureRunning();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  /** Runs listeners once now (e.g. after a pause, so state changes still show). */
  tick(): void {
    const t = this.time();
    for (const listener of this.listeners) listener(t);
  }

  private ensureRunning(): void {
    if (
      this.frame !== null ||
      this.listeners.size === 0 ||
      typeof requestAnimationFrame === "undefined"
    )
      return;
    const loop = () => {
      this.frame = null;
      this.tick();
      if (this.listeners.size > 0 && this.pausedAt === null)
        this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  private stop(): void {
    if (this.frame !== null && typeof cancelAnimationFrame !== "undefined")
      cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  dispose(): void {
    this.listeners.clear();
    this.stop();
  }
}

/** Where animated SVG gets its time: a live clock, or a fixed `t` for thumbnails and export. */
export type TimeSource =
  | { readonly kind: "live"; readonly clock: Clock }
  | { readonly kind: "static"; readonly t: number };

export const TimeContext = createContext<TimeSource>({ kind: "static", t: 0 });

export function useTimeSource(): TimeSource {
  return use(TimeContext);
}

/** The time to render with right now (static `t`, or the live clock's current time). */
export function currentTime(source: TimeSource): number {
  return source.kind === "static" ? source.t : source.clock.time();
}

/**
 * Calls `onFrame(t)` on every clock tick while `active`. In static mode it never subscribes —
 * the component renders its frame from the static `t` directly.
 */
export function useFrame(active: boolean, onFrame: (t: number) => void): void {
  const source = useTimeSource();
  const callback = useRef(onFrame);
  useEffect(() => {
    callback.current = onFrame;
  });
  useEffect(() => {
    if (!active || source.kind !== "live") return;
    return source.clock.subscribe((t) => callback.current(t));
  }, [active, source]);
}
