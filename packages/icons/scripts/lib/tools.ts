import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { assertSafe } from "./clean";
import type { BuiltIcon } from "./model";
import { createElement, parseSvg, serializeSvg, walk } from "./svg";

interface ToolIconSource {
  /** The Mogram slug: `tool/<slug>` in diagram files. */
  readonly slug: string;
  /** The Simple Icons slug the logo comes from (https://simpleicons.org). */
  readonly simpleIcon: string;
  readonly category: string;
}

/**
 * Tool logos (IC-3). Mogram slugs follow the tool's everyday name where Simple Icons' slug is
 * awkward (`apachekafka` → `kafka`, `nodedotjs` → `nodejs`). Entries Simple Icons no longer
 * carries (brands that asked to be removed) are skipped with a log line, not a failure.
 */
export const TOOL_ICONS: readonly ToolIconSource[] = [
  { slug: "kubernetes", simpleIcon: "kubernetes", category: "Containers" },
  { slug: "helm", simpleIcon: "helm", category: "Containers" },
  { slug: "docker", simpleIcon: "docker", category: "Containers" },
  { slug: "istio", simpleIcon: "istio", category: "Networking" },
  { slug: "envoy", simpleIcon: "envoyproxy", category: "Networking" },
  { slug: "consul", simpleIcon: "consul", category: "Networking" },
  { slug: "nginx", simpleIcon: "nginx", category: "Networking" },
  { slug: "cloudflare", simpleIcon: "cloudflare", category: "Networking" },
  { slug: "redis", simpleIcon: "redis", category: "Data" },
  { slug: "postgresql", simpleIcon: "postgresql", category: "Data" },
  { slug: "mysql", simpleIcon: "mysql", category: "Data" },
  { slug: "mongodb", simpleIcon: "mongodb", category: "Data" },
  { slug: "elasticsearch", simpleIcon: "elasticsearch", category: "Data" },
  { slug: "kafka", simpleIcon: "apachekafka", category: "Messaging" },
  { slug: "rabbitmq", simpleIcon: "rabbitmq", category: "Messaging" },
  { slug: "grafana", simpleIcon: "grafana", category: "Observability" },
  { slug: "prometheus", simpleIcon: "prometheus", category: "Observability" },
  { slug: "fluentd", simpleIcon: "fluentd", category: "Observability" },
  { slug: "kibana", simpleIcon: "kibana", category: "Observability" },
  { slug: "logstash", simpleIcon: "logstash", category: "Observability" },
  { slug: "datadog", simpleIcon: "datadog", category: "Observability" },
  { slug: "new-relic", simpleIcon: "newrelic", category: "Observability" },
  { slug: "sentry", simpleIcon: "sentry", category: "Observability" },
  { slug: "opentelemetry", simpleIcon: "opentelemetry", category: "Observability" },
  { slug: "jaeger", simpleIcon: "jaeger", category: "Observability" },
  { slug: "terraform", simpleIcon: "terraform", category: "Infrastructure as code" },
  { slug: "ansible", simpleIcon: "ansible", category: "Infrastructure as code" },
  { slug: "jenkins", simpleIcon: "jenkins", category: "CI/CD" },
  { slug: "github", simpleIcon: "github", category: "CI/CD" },
  { slug: "gitlab", simpleIcon: "gitlab", category: "CI/CD" },
  { slug: "github-actions", simpleIcon: "githubactions", category: "CI/CD" },
  { slug: "argo", simpleIcon: "argo", category: "CI/CD" },
  { slug: "vault", simpleIcon: "vault", category: "Security" },
  { slug: "keycloak", simpleIcon: "keycloak", category: "Security" },
  { slug: "auth0", simpleIcon: "auth0", category: "Security" },
  { slug: "nodejs", simpleIcon: "nodedotjs", category: "Languages & frameworks" },
  { slug: "python", simpleIcon: "python", category: "Languages & frameworks" },
  { slug: "go", simpleIcon: "go", category: "Languages & frameworks" },
  { slug: "dotnet", simpleIcon: "dotnet", category: "Languages & frameworks" },
  { slug: "java", simpleIcon: "openjdk", category: "Languages & frameworks" },
  { slug: "react", simpleIcon: "react", category: "Languages & frameworks" },
  { slug: "nextjs", simpleIcon: "nextdotjs", category: "Languages & frameworks" },
  { slug: "vercel", simpleIcon: "vercel", category: "Platforms" },
  { slug: "stripe", simpleIcon: "stripe", category: "Platforms" },
  { slug: "twilio", simpleIcon: "twilio", category: "Platforms" },
  { slug: "slack", simpleIcon: "slack", category: "Platforms" },
  { slug: "openai", simpleIcon: "openai", category: "AI" },
  { slug: "anthropic", simpleIcon: "anthropic", category: "AI" },
  { slug: "linux", simpleIcon: "linux", category: "Operating systems" },
  { slug: "ubuntu", simpleIcon: "ubuntu", category: "Operating systems" },
  { slug: "windows", simpleIcon: "windows", category: "Operating systems" },
  { slug: "apple", simpleIcon: "apple", category: "Operating systems" },
];

/** What the tool NOTICE needs to credit each logo. */
export interface ToolCredit {
  readonly slug: string;
  readonly title: string;
  readonly simpleIcon: string;
  readonly license: string | null;
  readonly guidelines: string | null;
}

export interface ToolBuild {
  readonly icons: BuiltIcon[];
  readonly credits: ToolCredit[];
  readonly skipped: string[];
}

interface SimpleIconData {
  readonly title: string;
  readonly hex: string;
  readonly license: string | null;
  readonly guidelines: string | null;
}

export async function buildToolIcons(simpleIconsDir: string): Promise<ToolBuild> {
  const data = await readSimpleIconData(`${simpleIconsDir}/data/simple-icons.json`);
  const build: ToolBuild = { icons: [], credits: [], skipped: [] };
  for (const source of TOOL_ICONS) {
    const svgPath = `${simpleIconsDir}/icons/${source.simpleIcon}.svg`;
    const info = data.get(source.simpleIcon);
    if (info === undefined || !existsSync(svgPath)) {
      build.skipped.push(source.simpleIcon);
      continue;
    }
    const color = `#${info.hex.toLowerCase()}`;
    build.icons.push({
      entry: {
        library: "tool",
        slug: source.slug,
        name: info.title,
        category: source.category,
        otherCategories: [],
        aliases: [],
        kind: "artwork",
        color,
      },
      svg: redrawLogo(await readFile(svgPath, "utf8"), color, source.simpleIcon),
    });
    build.credits.push({
      slug: source.slug,
      title: info.title,
      simpleIcon: source.simpleIcon,
      license: info.license,
      guidelines: info.guidelines,
    });
  }
  return build;
}

/** Simple Icons logos are one path on a 24×24 grid; redraw them with the brand colour baked in. */
function redrawLogo(text: string, color: string, simpleIcon: string): string {
  const paths = [...walk(parseSvg(text))].filter((element) => element.name === "path");
  const d = paths[0]?.attributes.get("d");
  if (paths.length !== 1 || d === undefined) {
    throw new Error(`Simple Icons logo "${simpleIcon}" is not a single path.`);
  }
  const svg = createElement("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24" }, [
    createElement("path", { fill: color, d }),
  ]);
  assertSafe(svg);
  return serializeSvg(svg);
}

async function readSimpleIconData(path: string): Promise<Map<string, SimpleIconData>> {
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${path} is not a list of icons.`);
  const bySlug = new Map<string, SimpleIconData>();
  for (const item of parsed as unknown[]) {
    if (!isRecord(item)) continue;
    const { slug, title, hex, license, guidelines } = item;
    if (typeof slug !== "string" || typeof title !== "string" || typeof hex !== "string") continue;
    bySlug.set(slug, {
      title,
      hex,
      license: isRecord(license) && typeof license.type === "string" ? license.type : null,
      guidelines: typeof guidelines === "string" ? guidelines : null,
    });
  }
  return bySlug;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
