"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { canonicalIconId, iconKind, iconUrl } from "@mogram/icons";
import type { ProjectFiles } from "@mogram/core/model";
import { resolveFromFolder } from "@mogram/core/model";

/**
 * Icons are drawn as <image> elements with data: URLs. That keeps live rendering and export
 * identical (an exported SVG can't load files), and it is also the safe way to show uploaded
 * SVGs: scripts never run inside images (IC-4, IC-6, AC-7).
 */

export type IconKind = "artwork" | "glyph" | "upload" | "missing";

export interface IconSource {
  readonly kind: IconKind;
  /** URL to fetch (catalog icons) — null for uploads and missing icons. */
  readonly url: string | null;
  /** Inline SVG text for uploaded icons. */
  readonly inline: string | null;
}

/** Where an icon type comes from. `icons/x.svg` is a file in the diagram's folder. */
export function iconSource(type: string, files: ProjectFiles, folder: string): IconSource {
  const catalog = iconUrl(type);
  const kind = iconKind(type);
  if (catalog !== null && kind !== null) return { kind, url: catalog, inline: null };
  if (type.toLowerCase().endsWith(".svg")) {
    const path = resolveFromFolder(folder, type);
    const text = path === null ? undefined : files[path];
    if (text !== undefined) return { kind: "upload", url: null, inline: text };
  }
  return { kind: "missing", url: null, inline: null };
}

type Entry =
  | { status: "loading"; done: Promise<void> }
  | { status: "ready"; text: string }
  | { status: "failed"; at: number };

/** A failed icon is tried again after this long when it is drawn (or at once when preloading). */
const RETRY_MS = 15_000;

export class IconCache {
  private readonly entries = new Map<string, Entry>();
  private readonly listeners = new Set<() => void>();
  private version = 0;

  constructor(private readonly now: () => number = Date.now) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  snapshot = (): number => this.version;

  /** The icon's SVG text: undefined while loading, null if it couldn't be loaded. */
  text(url: string): string | null | undefined {
    const entry = this.entries.get(url);
    if (entry === undefined || (entry.status === "failed" && this.now() - entry.at >= RETRY_MS)) {
      void this.load(url);
      return undefined;
    }
    return entry.status === "ready" ? entry.text : entry.status === "failed" ? null : undefined;
  }

  /** Resolves once `url` has loaded or failed; joins a load already in flight. */
  load(url: string): Promise<void> {
    const entry = this.entries.get(url);
    if (entry?.status === "ready") return Promise.resolve();
    if (entry?.status === "loading") return entry.done;
    const done = this.fetch(url);
    this.entries.set(url, { status: "loading", done });
    return done;
  }

  async loadAll(urls: Iterable<string>): Promise<void> {
    await Promise.all([...new Set(urls)].map((url) => this.load(url)));
  }

  private async fetch(url: string): Promise<void> {
    let next: Entry;
    try {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error(String(response.status));
      next = { status: "ready", text: await response.text() };
    } catch {
      next = { status: "failed", at: this.now() };
    }
    this.entries.set(url, next);
    this.version++;
    for (const listener of this.listeners) listener();
  }
}

export const iconCache = new IconCache();

const dataUrls = new Map<string, string>();

/** `data:` URL for SVG text, with glyph strokes recoloured to `color`. */
export function svgDataUrl(svg: string, color: string | null): string {
  const key = `${color ?? ""}\u0000${svg}`;
  const cached = dataUrls.get(key);
  if (cached !== undefined) return cached;
  const text = color === null ? svg : svg.replace(/currentColor/g, color);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
  if (dataUrls.size > 2000) dataUrls.clear();
  dataUrls.set(key, url);
  return url;
}

/**
 * Single-colour tool logos that are nearly black (GitHub, Vercel, Next.js…) would vanish on a dark
 * canvas, and nearly white ones on a light canvas. Those take the canvas text colour instead.
 */
export function adaptLogo(svg: string, mode: "dark" | "light", textColor: string): string {
  const fills = [...svg.matchAll(/fill="#([0-9a-fA-F]{6})"/g)].map((match) => match[1] ?? "");
  const unique = new Set(fills.map((hex) => hex.toLowerCase()));
  if (unique.size !== 1) return svg;
  const hex = [...unique][0] ?? "";
  const n = Number.parseInt(hex, 16);
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  const invisible = mode === "dark" ? luminance < 0.06 : luminance > 0.85;
  return invisible ? svg.replace(/fill="#[0-9a-fA-F]{6}"/g, `fill="${textColor}"`) : svg;
}

/** Resolves an icon to an href now (undefined while loading, null if unavailable). */
export function iconHref(
  source: IconSource,
  theme: { readonly text: string; readonly mode: "dark" | "light" },
): string | null | undefined {
  switch (source.kind) {
    case "missing":
      return null;
    case "upload":
      return source.inline === null ? null : svgDataUrl(source.inline, null);
    case "artwork":
    case "glyph": {
      if (source.url === null) return null;
      const text = iconCache.text(source.url);
      if (text == null) return text;
      if (source.kind === "glyph") return svgDataUrl(text, theme.text);
      const adapted = source.url.includes("/tool/")
        ? adaptLogo(text, theme.mode, theme.text)
        : text;
      return svgDataUrl(adapted, null);
    }
  }
}

/** Re-renders when any icon finishes loading. */
export function useIconCacheVersion(): number {
  return useSyncExternalStore(iconCache.subscribe, iconCache.snapshot, () => 0);
}

/** Loads every icon a diagram needs before a static render (export, thumbnails). */
export async function preloadIcons(sources: Iterable<IconSource>): Promise<void> {
  const urls: string[] = [];
  for (const source of sources) if (source.url !== null) urls.push(source.url);
  await iconCache.loadAll(urls);
}

let names: Promise<ReadonlyMap<string, string>> | null = null;

function iconNames(): Promise<ReadonlyMap<string, string>> {
  names ??= import("@mogram/icons/catalog").then(
    (module) => new Map(module.ICONS.map((icon) => [icon.id, icon.name])),
    (error: unknown) => {
      names = null; // a failed chunk load (offline, new deploy) is tried again next time
      throw error;
    },
  );
  return names;
}

/** Display name of a catalog icon ("tool/nodejs" → "Node.js"), loading the catalog once, lazily. */
export function useIconName(type: string): string | null {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    iconNames().then(
      (map) => {
        if (alive) setName(map.get(canonicalIconId(type)) ?? null);
      },
      () => {
        if (alive) setName(null); // the card falls back to the icon id
      },
    );
    return () => {
      alive = false;
    };
  }, [type]);
  return name;
}
