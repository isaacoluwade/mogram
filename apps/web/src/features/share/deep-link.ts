/**
 * Deep links (SH-4, CA-7, TO-11, NE-9) are query parameters on any viewer URL (D-14):
 * `?level=aks,pods&scene=outage&card=web_vm&tour=checkout&step=web_vm`.
 * `level` is the path of components opened from the top. Unknown names are ignored by the viewer.
 */
export interface DeepLink {
  readonly level: readonly string[];
  readonly scene: string | null;
  readonly card: string | null;
  readonly tour: string | null;
  readonly step: string | null;
}

/** Names (and port-qualified names like `aks.web`) — anything else in a URL is dropped. */
const NAME = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,79}$/;

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
    level,
    scene: clean(read(source, "scene")),
    card: clean(read(source, "card")),
    tour: clean(read(source, "tour")),
    step: clean(read(source, "step")),
  };
}

export function deepLinkQuery(link: Partial<DeepLink>): string {
  const params = new URLSearchParams();
  if (link.level !== undefined && link.level.length > 0) params.set("level", link.level.join(","));
  if (link.scene != null) params.set("scene", link.scene);
  if (link.tour != null) params.set("tour", link.tour);
  if (link.step != null) params.set("step", link.step);
  if (link.card != null) params.set("card", link.card);
  const query = params.toString().replace(/%2C/g, ",");
  return query.length > 0 ? `?${query}` : "";
}

export function buildDeepLink(base: string, link: Partial<DeepLink>): string {
  return `${base}${deepLinkQuery(link)}`;
}
