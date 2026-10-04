import { basename } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { cleanArtwork } from "./clean";
import { slugify, type BuiltIcon } from "./model";
import { serializeSvg } from "./svg";
import { loadPinned } from "./vendor";

/**
 * The pinned Microsoft download (IC-1). The hash makes a rebuild produce the same catalog, and
 * a new release is adopted by changing these three lines and re-running the build.
 */
export const AZURE_SOURCE = {
  version: "V24",
  published: "July 2026",
  url: "https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V24.zip",
  sha256: "921594ccd1bf3d9c0a1bd7b6d924e050551a59342f2b353bb74bdcf761c35141",
  page: "https://learn.microsoft.com/en-us/azure/architecture/icons/",
} as const;

/**
 * Microsoft's folder names mapped to category names, in priority order. An icon filed in
 * several folders takes the first of them here as its category, so specific areas win over
 * catch-alls like "general" and "other". An unknown folder fails the build so new areas get a
 * deliberate name.
 */
const CATEGORIES: readonly (readonly [folder: string, category: string])[] = [
  ["compute", "Compute"],
  ["containers", "Containers"],
  ["networking", "Networking"],
  ["storage", "Storage"],
  ["monitor", "Monitor"],
  ["analytics", "Analytics"],
  ["databases", "Databases"],
  ["ai + machine learning", "AI + Machine Learning"],
  ["integration", "Integration"],
  ["web", "Web"],
  ["iot", "IoT"],
  ["identity", "Identity"],
  ["security", "Security"],
  ["management + governance", "Management + Governance"],
  ["devops", "DevOps"],
  ["developer tools", "Developer Tools"],
  ["hybrid + multicloud", "Hybrid + Multicloud"],
  ["migrate", "Migration"],
  ["migration", "Migration"],
  ["mixed reality", "Mixed Reality"],
  ["mobile", "Mobile"],
  ["app services", "App Services"],
  ["blockchain", "Blockchain"],
  ["intune", "Intune"],
  ["azure ecosystem", "Azure Ecosystem"],
  ["general", "General"],
  ["menu", "General"],
  // "new icons" is a release note, not a service area. Icons Microsoft files only there or in
  // "other" are given a real area by REFILED below.
  ["new icons", "Other"],
  ["other", "Other"],
];

/**
 * Areas for icons Microsoft files only under "other" or "new icons" (142 of them in V24),
 * chosen from the service's own Azure product category so they sit beside related icons:
 * Container Apps with Containers, Private Endpoints with Networking. Only Microsoft's codenames
 * with no public product behind them stay in "Other". A slug that is missing, or no longer filed
 * under "Other", fails the build so the table cannot go stale.
 */
const REFILED: Readonly<Record<string, string>> = {
  "agentic-web-apps": "Web",
  "ai-gateway": "AI + Machine Learning",
  "aks-istio": "Containers",
  "app-compliance-automation": "Security",
  "arc-data-services": "Hybrid + Multicloud",
  "arc-postgresql": "Hybrid + Multicloud",
  "arc-sql-managed-instance": "Hybrid + Multicloud",
  "arc-sql-server": "Hybrid + Multicloud",
  "avs-vm": "Compute",
  "azure-a": "General",
  "azure-access-point": "Networking",
  "azure-attestation": "Security",
  "azure-backup-center": "Storage",
  "azure-center-for-sap": "Compute",
  "azure-chaos-studio": "DevOps",
  "azure-cloud-shell": "Developer Tools",
  "azure-communication-services": "Web",
  "azure-consumption-commitment": "Management + Governance",
  "azure-data-sharing": "Analytics",
  "azure-data-transfer": "Migration",
  "azure-deployment-environments": "DevOps",
  "azure-dev-tunnels": "Developer Tools",
  "azure-edge-hardware-center": "Hybrid + Multicloud",
  "azure-enclaves": "Security",
  "azure-hpc-workbenches": "Compute",
  "azure-load-testing": "DevOps",
  "azure-managed-grafana": "Monitor",
  "azure-monitor-dashboard": "Monitor",
  "azure-network-function-manager": "Networking",
  "azure-network-function-manager-functions": "Networking",
  "azure-orbital": "Networking",
  "azure-quotas": "Management + Governance",
  "azure-sphere": "IoT",
  "azure-storage-mover": "Storage",
  "azure-support-center-blue": "Management + Governance",
  "azure-sustainability": "Management + Governance",
  "azure-video-indexer": "AI + Machine Learning",
  "azure-virtual-desktop": "Compute",
  "azure-vmware-solution": "Compute",
  azurite: "Developer Tools",
  "backup-vault": "Storage",
  "bare-metal-infrastructure": "Compute",
  "capacity-reservation-groups": "Compute",
  "central-service-instance-for-sap": "Compute",
  "cloud-services-extended-support": "Compute",
  "community-images": "Compute",
  "compliance-center": "Management + Governance",
  "confidential-ledgers": "Security",
  "connected-vehicle-platform": "IoT",
  "container-apps-environments": "Containers",
  "cost-export": "Management + Governance",
  "custom-ip-prefix": "Networking",
  "dashboard-hub": "Management + Governance",
  "data-collection-rules": "Monitor",
  "database-instance-for-sap": "Compute",
  "ddos-custom-policy": "Networking",
  "dedicated-hsm": "Security",
  // Microsoft Defender for IoT draws the industrial devices it watches; they are found with IoT.
  "defender-cm-local-manager": "IoT",
  "defender-dcs-controller": "IoT",
  "defender-distributer-control-system": "IoT",
  "defender-engineering-station": "IoT",
  "defender-external-management": "IoT",
  "defender-freezer-monitor": "IoT",
  "defender-historian": "IoT",
  "defender-hmi": "IoT",
  "defender-industrial-packaging-system": "IoT",
  "defender-industrial-printer": "IoT",
  "defender-industrial-robot": "IoT",
  "defender-industrial-scale-system": "IoT",
  "defender-marquee": "IoT",
  "defender-meter": "IoT",
  "defender-plc": "IoT",
  "defender-pneumatic-device": "IoT",
  "defender-programable-board": "IoT",
  "defender-relay": "IoT",
  "defender-robot-controller": "IoT",
  "defender-rtu": "IoT",
  "defender-sensor": "IoT",
  "defender-slot": "IoT",
  "defender-web-guiding-system": "IoT",
  "device-update-iot-hub": "IoT",
  "disconnected-operations": "Hybrid + Multicloud",
  "disk-pool": "Storage",
  "edge-management": "Hybrid + Multicloud",
  "elastic-san": "Storage",
  "exchange-on-premises-access": "Identity",
  "express-route-traffic-collector": "Networking",
  "expressroute-direct": "Networking",
  "fhir-service": "Integration",
  "hdi-aks-cluster": "Analytics",
  "internet-analyzer-profiles": "Networking",
  "kubernetes-fleet-manager": "Containers",
  "landing-zone": "Management + Governance",
  "log-analytics-query-pack": "Monitor",
  "managed-instance-apache-cassandra": "Databases",
  "medtech-service": "IoT",
  "microsoft-dev-box": "Developer Tools",
  "microsoft-discovery": "AI + Machine Learning",
  "mission-landing-zone": "Management + Governance",
  "mobile-networks": "Networking",
  "modular-data-center": "Hybrid + Multicloud",
  "monitor-health-models": "Monitor",
  "network-managers": "Networking",
  "network-security-perimeters": "Networking",
  "open-supply-chain-platform": "Integration",
  osconfig: "Management + Governance",
  "peering-service": "Networking",
  peerings: "Networking",
  "private-endpoints": "Networking",
  prometheus: "Monitor",
  "reserved-capacity": "Management + Governance",
  resiliency: "Management + Governance",
  "resource-guard": "Security",
  "resource-mover": "Migration",
  rtos: "IoT",
  "savings-plans": "Management + Governance",
  "scvmm-management-servers": "Hybrid + Multicloud",
  "sonic-dash": "Networking",
  "ssh-keys": "Compute",
  "storage-functions": "Storage",
  "template-specs": "DevOps",
  "test-base": "DevOps",
  "toolchain-orchestrator": "DevOps",
  "update-management-center": "Management + Governance",
  "video-analyzers": "AI + Machine Learning",
  "virtual-instance-for-sap": "Compute",
  "virtual-visits-builder": "Web",
  "vm-app-definitions": "Compute",
  "vm-app-versions": "Compute",
  "vm-image-version": "Compute",
  wac: "Management + Governance",
  "wac-installer": "Management + Governance",
  "web-app-database": "Web",
  "web-jobs": "App Services",
  "windows-notification-services": "Mobile",
  "worker-container-app": "Containers",
};

/**
 * Display names Microsoft's file names cannot produce: typos, words run together and
 * lowercase stems. Keyed by the file stem after the number and `icon-service-` are removed.
 */
const NAME_FIXES: Readonly<Record<string, string>> = {
  "external-id": "External ID",
  "external-id-modified": "External ID Modified",
  pubsub: "PubSub",
  promethus: "Prometheus",
  "Entra-Privleged-Identity-Management": "Entra Privileged Identity Management",
  VPNClientWindows: "VPN Client Windows",
  MachinesAzureArc: "Machines Azure Arc",
  AzureAttestation: "Azure Attestation",
  ExtendedSecurityUpdates: "Extended Security Updates",
  "Windows10-Core-Services": "Windows 10 Core Services",
  "HD-Insight-Clusters": "HDInsight Clusters",
  "Biz-Talk": "BizTalk",
};

const ICON_PATH = /^Azure_Public_Service_Icons\/Icons\/([^/]+)\/([^/]+\.svg)$/;

export async function loadAzureZip(vendorDir: string): Promise<Uint8Array> {
  return loadPinned(vendorDir, basename(AZURE_SOURCE.url), AZURE_SOURCE);
}

interface ZipIcon {
  readonly folder: string;
  readonly file: string;
  readonly source: string;
}

export function buildAzureIcons(zip: Uint8Array): BuiltIcon[] {
  const files = unzipSync(zip, { filter: (file) => ICON_PATH.test(file.name) });
  const icons: ZipIcon[] = Object.entries(files).map(([path, data]) => {
    const [, folder = "", file = ""] = ICON_PATH.exec(path) ?? [];
    return { folder, file, source: strFromU8(data) };
  });
  icons.sort((a, b) => folderRank(a.folder) - folderRank(b.folder) || compare(a.file, b.file));

  const bySlug = new Map<string, { icon: BuiltIcon; source: string }>();
  for (const icon of icons) {
    const category = categoryFor(icon.folder);
    const name = displayName(icon.file);
    // Different artwork under a name already taken (two "Workspaces" in compute) is kept and
    // numbered in file order, so the result is stable between builds.
    for (let n = 1; ; n += 1) {
      const unique = n === 1 ? name : `${name} ${n}`;
      const slug = slugify(unique);
      const existing = bySlug.get(slug);
      if (existing === undefined) {
        bySlug.set(slug, { source: icon.source, icon: newAzureIcon(icon, unique, slug, category) });
        break;
      }
      if (existing.source === icon.source) {
        // The same artwork filed in another folder: one icon, listed in both places.
        addCategory(existing.icon, category);
        break;
      }
    }
  }
  return refile([...bySlug.values()].map(({ icon }) => icon));
}

/** Moves icons out of "Other" using REFILED, and fails on entries that no longer apply. */
function refile(icons: readonly BuiltIcon[]): BuiltIcon[] {
  const current = new Map(icons.map(({ entry }) => [entry.slug, entry.category]));
  const known = new Set(CATEGORIES.map(([, category]) => category));
  const problems = Object.entries(REFILED).flatMap(([slug, category]) => {
    const filed = current.get(slug);
    if (filed === undefined) return [`${slug} is not in the download`];
    if (filed !== "Other") return [`${slug} is now filed under ${filed}`];
    if (!known.has(category)) return [`${slug} names unknown category ${category}`];
    return [];
  });
  if (problems.length > 0) throw new Error(`Azure REFILED table:\n- ${problems.join("\n- ")}`);
  return icons.map((icon) => {
    const category = REFILED[icon.entry.slug];
    if (category === undefined) return icon;
    const otherCategories = icon.entry.otherCategories.filter((other) => other !== category);
    return { ...icon, entry: { ...icon.entry, category, otherCategories } };
  });
}

function newAzureIcon(icon: ZipIcon, name: string, slug: string, category: string): BuiltIcon {
  return {
    entry: {
      library: "azure",
      slug,
      name,
      category,
      otherCategories: [],
      aliases: [],
      kind: "artwork",
      color: null,
    },
    svg: cleanAzureSvg(icon.source, slug, `${icon.folder}/${icon.file}`),
  };
}

function addCategory({ entry }: BuiltIcon, category: string): void {
  if (entry.category !== category && !entry.otherCategories.includes(category)) {
    entry.otherCategories.push(category);
  }
}

function cleanAzureSvg(source: string, slug: string, label: string): string {
  try {
    return serializeSvg(cleanArtwork(source, slug));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Azure icon ${label}: ${reason}`, { cause: error });
  }
}

function displayName(file: string): string {
  const stem = file
    .replace(/\.svg$/i, "")
    .replace(/^\d+\s*-icon-service-/i, "")
    .trim();
  return (
    NAME_FIXES[stem] ??
    stem
      .replace(/-/g, " ")
      .replace(/(\S)\(/g, "$1 (")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function categoryFor(folder: string): string {
  const match = CATEGORIES.find(([name]) => name === folder);
  if (match === undefined) throw new Error(`Unknown Azure icon folder "${folder}".`);
  return match[1];
}

function folderRank(folder: string): number {
  return CATEGORIES.findIndex(([name]) => name === folder);
}

function compare(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
