/**
 * Element names are chosen by people and read in pull requests (FI-1): `web_vm`, `db_primary`.
 */
import type { Diagram } from "./types";

export const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

/** Names that would be ambiguous inside the file format. */
const RESERVED_NAMES = new Set(["decorations", "normal"]);

export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name) && !RESERVED_NAMES.has(name);
}

/**
 * Every name in use. Components, containers, groups, connections and decorations share one
 * namespace across all of a diagram's files, so a new or renamed element must avoid all of them.
 */
export function elementNames(diagram: Diagram): Set<string> {
  return new Set([
    ...diagram.components.keys(),
    ...diagram.containers.keys(),
    ...diagram.groups.keys(),
    ...diagram.connections.keys(),
    ...diagram.decorations.keys(),
  ]);
}

/**
 * Words written in capitals when a name is humanised (`web_vm` → "Web VM").
 * Kept short and specific to architecture vocabulary.
 */
const ACRONYMS: ReadonlyMap<string, string> = new Map([
  ["ai", "AI"],
  ["aks", "AKS"],
  ["api", "API"],
  ["apim", "APIM"],
  ["aws", "AWS"],
  ["az", "AZ"],
  ["cd", "CD"],
  ["cdn", "CDN"],
  ["ci", "CI"],
  ["cpu", "CPU"],
  ["db", "DB"],
  ["dns", "DNS"],
  ["ec2", "EC2"],
  ["eks", "EKS"],
  ["gcp", "GCP"],
  ["gke", "GKE"],
  ["gpu", "GPU"],
  ["http", "HTTP"],
  ["https", "HTTPS"],
  ["iam", "IAM"],
  ["id", "ID"],
  ["iot", "IoT"],
  ["ip", "IP"],
  ["k8s", "K8s"],
  ["lb", "LB"],
  ["ml", "ML"],
  ["nat", "NAT"],
  ["nsg", "NSG"],
  ["rg", "RG"],
  ["s3", "S3"],
  ["sql", "SQL"],
  ["sso", "SSO"],
  ["tcp", "TCP"],
  ["ui", "UI"],
  ["url", "URL"],
  ["vm", "VM"],
  ["vms", "VMs"],
  ["vnet", "VNet"],
  ["vpc", "VPC"],
  ["vpn", "VPN"],
  ["waf", "WAF"],
]);

/** `web_vm` → "Web VM", `db-primary` → "DB primary", `region_outage` → "Region outage". */
export function humanize(name: string): string {
  const words = name.split(/[_\-\s]+/).filter((word) => word.length > 0);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      const acronym = ACRONYMS.get(lower);
      if (acronym !== undefined) return acronym;
      if (index === 0) return lower.charAt(0).toUpperCase() + lower.slice(1);
      return lower;
    })
    .join(" ");
}

/** "Web VM" → `web_vm`; returns `fallback` when nothing usable remains. */
export function toName(label: string, fallback = "element"): string {
  const cleaned = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  const candidate = /^[a-z]/.test(cleaned)
    ? cleaned
    : cleaned.length > 0
      ? `${fallback}_${cleaned}`
      : fallback;
  return isValidName(candidate) ? candidate : fallback;
}

/** First of `base`, `base_2`, `base_3` … not in `taken`. */
export function uniqueName(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base) && isValidName(base)) return base;
  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}_${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
