import { readFile } from "node:fs/promises";
import { assertSafe, removeNoise, tidyRoot } from "./clean";
import type { BuiltIcon } from "./model";
import { parseSvg, serializeSvg } from "./svg";

interface GenericIconSource {
  readonly slug: string;
  readonly name: string;
  readonly category: string;
  /** The Lucide glyph drawn for this icon (https://lucide.dev/icons/<name>). */
  readonly lucide: string;
}

/**
 * Vendor-neutral icons (IC-2), each drawn with the closest Lucide glyph. Kept as one table so a
 * reviewer can see every choice at a glance. `globe`, `network`, `brackets`, `folder`, `layers`,
 * `cluster`, `tag`, `cloud` and `square` are container header icons in `@mogram/core` presets,
 * and `service` is the default component type, so those ids must not change.
 */
export const GENERIC_ICONS: readonly GenericIconSource[] = [
  { slug: "user", name: "User", category: "People", lucide: "user" },
  { slug: "users", name: "Users", category: "People", lucide: "users" },
  { slug: "identity", name: "Identity", category: "People", lucide: "id-card" },
  { slug: "browser", name: "Browser", category: "Devices", lucide: "app-window" },
  { slug: "phone", name: "Phone", category: "Devices", lucide: "smartphone" },
  { slug: "tablet", name: "Tablet", category: "Devices", lucide: "tablet" },
  { slug: "laptop", name: "Laptop", category: "Devices", lucide: "laptop" },
  { slug: "desktop", name: "Desktop", category: "Devices", lucide: "monitor" },
  { slug: "iot", name: "IoT device", category: "Devices", lucide: "radio" },
  { slug: "web-app", name: "Web app", category: "Applications", lucide: "panels-top-left" },
  { slug: "mobile-app", name: "Mobile app", category: "Applications", lucide: "tablet-smartphone" },
  { slug: "service", name: "Service", category: "Applications", lucide: "box" },
  { slug: "worker", name: "Worker", category: "Applications", lucide: "cog" },
  { slug: "function", name: "Function", category: "Applications", lucide: "square-function" },
  { slug: "api", name: "API", category: "Applications", lucide: "plug" },
  { slug: "scheduler", name: "Scheduler", category: "Applications", lucide: "calendar-clock" },
  { slug: "server", name: "Server", category: "Compute", lucide: "server" },
  { slug: "container", name: "Container", category: "Compute", lucide: "container" },
  { slug: "cluster", name: "Cluster", category: "Compute", lucide: "boxes" },
  { slug: "cpu", name: "CPU", category: "Compute", lucide: "cpu" },
  { slug: "gpu", name: "GPU", category: "Compute", lucide: "gpu" },
  { slug: "database", name: "Database", category: "Data", lucide: "database" },
  { slug: "cache", name: "Cache", category: "Data", lucide: "memory-stick" },
  { slug: "storage", name: "Storage", category: "Data", lucide: "hard-drive" },
  { slug: "warehouse", name: "Data warehouse", category: "Data", lucide: "warehouse" },
  { slug: "backup", name: "Backup", category: "Data", lucide: "database-backup" },
  { slug: "file", name: "File", category: "Data", lucide: "file" },
  { slug: "folder", name: "Folder", category: "Data", lucide: "folder" },
  { slug: "document", name: "Document", category: "Data", lucide: "file-text" },
  { slug: "queue", name: "Queue", category: "Messaging", lucide: "list-end" },
  { slug: "event", name: "Event", category: "Messaging", lucide: "zap" },
  { slug: "stream", name: "Stream", category: "Messaging", lucide: "waves" },
  { slug: "email", name: "Email", category: "Messaging", lucide: "mail" },
  { slug: "message", name: "Message", category: "Messaging", lucide: "message-square" },
  { slug: "notification", name: "Notification", category: "Messaging", lucide: "bell" },
  { slug: "cloud", name: "Cloud", category: "Networking", lucide: "cloud" },
  { slug: "internet", name: "Internet", category: "Networking", lucide: "earth" },
  { slug: "globe", name: "Globe", category: "Networking", lucide: "globe" },
  { slug: "network", name: "Network", category: "Networking", lucide: "network" },
  { slug: "load-balancer", name: "Load balancer", category: "Networking", lucide: "split" },
  { slug: "gateway", name: "Gateway", category: "Networking", lucide: "door-open" },
  { slug: "cdn", name: "CDN", category: "Networking", lucide: "radio-tower" },
  { slug: "dns", name: "DNS", category: "Networking", lucide: "signpost" },
  { slug: "router", name: "Router", category: "Networking", lucide: "router" },
  { slug: "switch", name: "Switch", category: "Networking", lucide: "ethernet-port" },
  { slug: "firewall", name: "Firewall", category: "Security", lucide: "brick-wall-fire" },
  { slug: "shield", name: "Shield", category: "Security", lucide: "shield" },
  { slug: "lock", name: "Lock", category: "Security", lucide: "lock" },
  { slug: "key", name: "Key", category: "Security", lucide: "key-round" },
  { slug: "vault", name: "Vault", category: "Security", lucide: "vault" },
  { slug: "monitor", name: "Monitoring", category: "Observability", lucide: "activity" },
  { slug: "chart", name: "Chart", category: "Observability", lucide: "chart-column" },
  { slug: "analytics", name: "Analytics", category: "Observability", lucide: "chart-pie" },
  { slug: "log", name: "Log", category: "Observability", lucide: "logs" },
  { slug: "search", name: "Search", category: "Observability", lucide: "search" },
  { slug: "code", name: "Code", category: "Development", lucide: "code" },
  { slug: "git", name: "Git", category: "Development", lucide: "git-branch" },
  { slug: "settings", name: "Settings", category: "Development", lucide: "settings" },
  { slug: "ai", name: "AI", category: "AI", lucide: "brain-circuit" },
  { slug: "robot", name: "Robot", category: "AI", lucide: "bot" },
  { slug: "payment", name: "Payment", category: "Business", lucide: "credit-card" },
  { slug: "cart", name: "Shopping cart", category: "Business", lucide: "shopping-cart" },
  { slug: "building", name: "Building", category: "Business", lucide: "building-2" },
  { slug: "brackets", name: "Brackets", category: "Shapes", lucide: "brackets" },
  { slug: "layers", name: "Layers", category: "Shapes", lucide: "layers" },
  { slug: "tag", name: "Tag", category: "Shapes", lucide: "tag" },
  { slug: "square", name: "Square", category: "Shapes", lucide: "square" },
];

/**
 * Lucide draws at 2px; 1.75 sits better next to the Azure artwork at diagram sizes. Colour comes
 * from `currentColor` so the canvas theme decides it.
 */
const GLYPH_ROOT = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "1.75",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
} as const;

export async function buildGenericIcons(lucideDir: string): Promise<BuiltIcon[]> {
  return Promise.all(
    GENERIC_ICONS.map(async (source) => {
      const text = await readFile(`${lucideDir}/icons/${source.lucide}.svg`, "utf8");
      return {
        entry: {
          library: "generic",
          slug: source.slug,
          name: source.name,
          category: source.category,
          otherCategories: [],
          aliases: [],
          kind: "glyph",
          color: null,
        },
        svg: cleanGlyph(text, source.lucide),
      };
    }),
  );
}

function cleanGlyph(text: string, lucideName: string): string {
  const svg = parseSvg(text);
  if (svg.attributes.get("viewBox") !== GLYPH_ROOT.viewBox) {
    throw new Error(`Lucide icon "${lucideName}" is not drawn on a 24×24 grid.`);
  }
  removeNoise(svg);
  svg.attributes = new Map(Object.entries(GLYPH_ROOT));
  tidyRoot(svg);
  assertSafe(svg);
  return serializeSvg(svg);
}
