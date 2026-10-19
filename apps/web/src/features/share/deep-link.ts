/**
 * Deep links (SH-4, CA-7, TO-11, NE-9) are query parameters on any viewer URL (D-14):
 * `?level=aks,pods&scene=outage&card=web_vm&tour=checkout&step=web_vm`.
 * `level` is the path of components opened from the top. Unknown names are ignored by the viewer.
 */
export interface DeepLink {
  /**
   * A folder of the project shown by itself (D-97): `?root=slides/intro`. Its story plays, and
   * `level` starts from it. Null for the project's own diagram.
   */
  readonly root: string | null;
  /** A slide of a deck, counted from 1 (D-99): `?slide=12&beat=3`, the beat within the slide. */
  readonly slide: number | null;
  readonly level: readonly string[];
  readonly scene: string | null;
  readonly card: string | null;
  readonly tour: string | null;
  readonly step: string | null;
  /** A story and how many of its beats have played (D-86): `?story=main&beat=3`. */
  readonly story: string | null;
  readonly beat: number | null;
}

/** Names (and port-qualified names like `aks.web`) — anything else in a URL is dropped. */
const NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,79}$/;

/** A folder inside the project: names joined by slashes, never `..`. */
const FOLDER = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,79}(\/[A-Za-z0-9_][A-Za-z0-9_.-]{0,79}){0,7}$/;

const folderOf = (value: string | null): string | null =>
  value !== null && FOLDER.test(value) && !value.split("/").some((part) => /^\.+$/.test(part))
    ? value
    : null;

const clean = (value: string | null | undefined): string | null =>
  value != null && NAME.test(value) ? value : null;

type ParamSource =
  URLSearchParams | Readonly<Record<string, string | readonly string[] | undefined>>;

function read(source: ParamSource, key: string): string | null {
  if (source instanceof URLSearchParams) return source.get(key);
  const value = source[key];
  return typeof value === "string" ? value : (value?.[0] ?? null);
}

export function parseDeepLink(source: ParamSource): DeepLink {
  const level = (read(source, "level") ?? "")
    .split(",")
    .map((part) => clean(part.trim()))
    .filter((part): part is string => part !== null)
    .slice(0, 16);
  return {
    root: folderOf(read(source, "root")),
    slide: slideOf(read(source, "slide")),
    level,
    scene: clean(read(source, "scene")),
    card: clean(read(source, "card")),
    tour: clean(read(source, "tour")),
    step: clean(read(source, "step")),
    story: clean(read(source, "story")),
    beat: beatOf(read(source, "beat")),
  };
}

function slideOf(value: string | null): number | null {
  if (value === null || !/^\d{1,3}$/.test(value)) return null;
  return Number(value) > 0 ? Number(value) : null;
}

function beatOf(value: string | null): number | null {
  if (value === null || !/^\d{1,3}$/.test(value)) return null;
  return Number(value);
}

export function deepLinkQuery(link: Partial<DeepLink>): string {
  const params = new URLSearchParams();
  if (link.root != null) params.set("root", link.root);
  if (link.slide != null) params.set("slide", String(link.slide));
  if (link.level !== undefined && link.level.length > 0) params.set("level", link.level.join(","));
  if (link.scene != null) params.set("scene", link.scene);
  if (link.tour != null) params.set("tour", link.tour);
  if (link.step != null) params.set("step", link.step);
  if (link.card != null) params.set("card", link.card);
  if (link.story != null) params.set("story", link.story);
  if (link.beat != null && link.beat > 0) params.set("beat", String(link.beat));
  const query = params.toString().replace(/%2C/g, ",").replace(/%2F/g, "/");
  return query.length > 0 ? `?${query}` : "";
}

export function buildDeepLink(base: string, link: Partial<DeepLink>): string {
  return `${base}${deepLinkQuery(link)}`;
}
