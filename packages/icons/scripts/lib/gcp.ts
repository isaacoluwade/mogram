import { strFromU8, unzipSync } from "fflate";
import { cleanArtwork } from "./clean";
import { slugify, type BuiltIcon } from "./model";
import { serializeSvg } from "./svg";
import { loadPinned } from "./vendor";

/**
 * Google Cloud's official product icons, pinned (https://cloud.google.com/icons). Since 2025
 * Google draws 19 core products with their own icon and every other product with its category's
 * icon. The older two-tone "console" icons are not used: Google's guide says they "should not
 * be used as of 2026".
 */
export const GCP_SOURCE = {
  page: "https://cloud.google.com/icons",
  guide: "https://services.google.com/fh/files/misc/google-cloud-product-icons.pdf",
  guideUpdated: "May 2026",
  core: {
    url: "https://services.google.com/fh/files/misc/core-products-icons.zip",
    sha256: "6531a10f58bc599c24d9a455d81dd757c1a03c3c43da9cddf639b859c1c1eece",
  },
  categories: {
    url: "https://services.google.com/fh/files/misc/category-icons.zip",
    sha256: "e5bc3abd3527dc2500e9bff7f15870783e2c764129c49b7cd4c1b4e105345002",
  },
} as const;

interface CategoryInfo {
  readonly slug: string;
  readonly name: string;
  /**
   * The products Google's guide files under this category, which it says to draw with the
   * category icon. Spelled as Google spells them, with capitalisation fixed ("Cloud Nat" →
   * "Cloud NAT").
   */
  readonly products: readonly string[];
}

/**
 * Category icons keyed by their folder in Google's zip, with the products filed under each in
 * the product icons guide (May 2026). Left out: "SQL" (ambiguous next to Cloud SQL, which has
 * its own icon) and "Asset Inventory" (listed again as Cloud Asset Inventory).
 */
const CATEGORIES: Readonly<Record<string, CategoryInfo>> = {
  Agents: {
    slug: "ai-applications-agents",
    name: "AI Applications & Agents",
    products: [
      "Agent Assist",
      "AI Testing Agent",
      "Automotive AI Agent",
      "Code Documentation Agent",
      "Contact Center as a Service",
      "Conversational Agents",
      "Conversational Insights",
      "Customer Engagement Suite",
      "Deep Research Agent",
      "Food Ordering AI Agent",
      "Idea Generation Agent",
    ],
  },
  "AI _ Machine Learning": {
    slug: "ai-machine-learning",
    name: "AI & Machine Learning",
    products: [
      "Advanced Agent Modeling",
      "AI Hub",
      "AI Platform",
      "AI Platform Unified",
      "AutoML",
      "AutoML Natural Language",
      "AutoML Tables",
      "AutoML Translation",
      "AutoML Video Intelligence",
      "AutoML Vision",
      "Cloud GPU",
      "Cloud Healthcare API",
      "Cloud Natural Language API",
      "Cloud Optimization AI",
      "Cloud Optimization AI Fleet Routing API",
      "Cloud TPU",
      "Cloud Translation API",
      "Cloud Vision API",
      "Data Labeling",
      "Dialogflow ES",
      "Document AI",
      "Genomics",
      "Healthcare NLP API",
      "Media Translation API",
      "Recommendations AI",
      "Speech-to-Text",
      "TensorFlow Enterprise",
      "Text-to-Speech",
      "Visual Inspection AI",
    ],
  },
  "Business Intelligence": {
    slug: "business-intelligence",
    name: "Business Intelligence",
    products: [],
  },
  Collaboration: { slug: "collaboration", name: "Collaboration", products: ["Google Workspace"] },
  Compute: {
    slug: "compute",
    name: "Compute",
    products: [
      "Batch",
      "Container-Optimized OS",
      "GCE Systems Management",
      "Migrate to Virtual Machines",
      "OS Config Management",
      "OS Inventory Management",
      "OS Patch Management",
      "VMware Engine",
    ],
  },
  Containers: {
    slug: "containers",
    name: "Containers",
    products: ["Backup for GKE", "Knative Serving", "Migrate to Containers"],
  },
  "Data Analytics": {
    slug: "data-analytics",
    name: "Data Analytics",
    products: [
      "Analytics Hub",
      "BigLake",
      "Cloud Composer",
      "Cloud Data Fusion",
      "Data Catalog",
      "Data Layers",
      "Data Loss Prevention API",
      "Dataflow",
      "Dataplex",
      "Datapol",
      "Dataprep",
      "Dataproc",
      "Dataproc Metastore",
      "Datashare",
      "Datastream",
      "Pub/Sub",
    ],
  },
  Databases: {
    slug: "databases",
    name: "Databases",
    products: [
      "Bare Metal Solution",
      "Bigtable",
      "Database Center",
      "Database Migration Service",
      "Datastore",
      "Firestore",
      "Memorystore",
    ],
  },
  "Developer Tools": {
    slug: "developer-tools",
    name: "Developer Tools",
    products: [
      "Cloud Code",
      "Cloud Deployment Manager",
      "Cloud Scheduler",
      "Cloud Shell",
      "Cloud Tasks",
      "Cloud Workstations",
      "Runtime Config",
      "Service Catalog",
      "Tools for PowerShell",
    ],
  },
  DevOps: {
    slug: "devops",
    name: "DevOps",
    products: ["Artifact Registry", "Cloud Build", "Cloud Deploy", "Container Registry"],
  },
  "Hybrid & Multicloud": { slug: "hybrid-multicloud", name: "Hybrid & Multicloud", products: [] },
  "Integration Services": {
    slug: "integration-services",
    name: "Integration Services",
    products: [
      "Advanced API Security",
      "API Analytics",
      "Application Integration",
      "Cloud API Gateway",
      "Cloud APIs",
      "Cloud Endpoints",
      "Connectors",
      "Developer Portal",
      "Eventarc",
      "Workflows",
    ],
  },
  "Management Tools": {
    slug: "management-tools",
    name: "Management Tools",
    products: ["Carbon Footprint", "Producer Portal"],
  },
  "Maps & Geospatial": {
    slug: "maps-geospatial",
    name: "Maps & Geospatial",
    products: ["Earth Engine", "Google Earth", "Google Maps Platform"],
  },
  Marketplace: { slug: "marketplace", name: "Marketplace", products: ["Google Cloud Marketplace"] },
  "Media Services": { slug: "media-services", name: "Media Services", products: [] },
  Migration: {
    slug: "migration",
    name: "Migration",
    products: ["Migrate for Compute Engine", "Transfer Appliance"],
  },
  "Mixed Reality": { slug: "mixed-reality", name: "Mixed Reality", products: [] },
  Networking: {
    slug: "networking",
    name: "Networking",
    products: [
      "Cloud Armor",
      "Cloud CDN",
      "Cloud DNS",
      "Cloud Domains",
      "Cloud Firewall Rules",
      "Cloud IDS",
      "Cloud Interconnect",
      "Cloud Load Balancing",
      "Cloud NAT",
      "Cloud Network",
      "Cloud Router",
      "Cloud VPN",
      "Connectivity Test",
      "Data Transfer",
      "Network Connectivity Center",
      "Network Intelligence Center",
      "Network Security",
      "Network Tiers",
      "Network Topology",
      "Packet Mirroring",
      "Partner Interconnect",
      "Premium Network Tier",
      "Private Connectivity",
      "Private Service Connect",
      "Routes",
      "Service Mesh",
      "Virtual Private Cloud",
    ],
  },
  Observability: {
    slug: "observability",
    name: "Observability",
    products: [
      "Cloud Audit Logs",
      "Cloud Logging",
      "Cloud Monitoring",
      "Error Reporting",
      "Google Cloud Observability",
      "Profiler",
      "Trace",
    ],
  },
  Operations: {
    slug: "operations",
    name: "Operations",
    products: [
      "App Hub",
      "Backup and DR",
      "Capacity Planner",
      "Performance Dashboard",
      "Personalized Service Health",
    ],
  },
  "Security Identity": {
    slug: "security-identity",
    name: "Security & Identity",
    products: [
      "Access Context Manager",
      "Assured Workloads",
      "BeyondCorp",
      "Binary Authorization",
      "Certificate Authority Service",
      "Certificate Manager",
      "Cloud Asset Inventory",
      "Cloud External Key Manager",
      "Cloud HSM",
      "Cloud Security Scanner",
      "Identity and Access Management",
      "Identity-Aware Proxy",
      "Identity Platform",
      "Key Access Justifications",
      "Key Management Service",
      "Managed Service for Microsoft Active Directory",
      "Phishing Protection",
      "Policy Analyzer",
      "reCAPTCHA Enterprise",
      "Risk Manager",
      "Secret Manager",
      "Security Key Enforcement",
      "Web Risk",
      "Web Security Scanner",
      "Workload Identity Federation",
    ],
  },
  "Serverless Computing": {
    slug: "serverless-computing",
    name: "Serverless Computing",
    products: ["App Engine", "Cloud Functions"],
  },
  Storage: {
    slug: "storage",
    name: "Storage",
    products: [
      "Filestore",
      "Google Cloud NetApp Volumes",
      "Local SSD",
      "Parallelstore",
      "Persistent Disk",
      "Storage Transfer Service",
    ],
  },
  "Web & Mobile": { slug: "web-mobile", name: "Web & Mobile", products: [] },
  Web3: { slug: "web3", name: "Web3", products: ["Blockchain Node Engine", "Blockchain RPC"] },
};

interface CoreProduct {
  readonly slug: string;
  readonly name: string;
  /** The category folder whose section lists it. */
  readonly category: string;
  /** Products the guide marks as core that are drawn with this icon ("Looker Studio"). */
  readonly also?: readonly string[];
}

/** Core products keyed by their folder in Google's zip, named as the guide names them. */
const CORE_PRODUCTS: Readonly<Record<string, CoreProduct>> = {
  "AI Hypercomputer": {
    slug: "ai-hypercomputer",
    name: "AI Hypercomputer",
    category: "AI _ Machine Learning",
  },
  AlloyDB: { slug: "alloydb", name: "AlloyDB", category: "Databases", also: ["AlloyDB Omni"] },
  Anthos: { slug: "anthos", name: "Anthos", category: "Hybrid & Multicloud" },
  Apigee: { slug: "apigee", name: "Apigee", category: "Integration Services" },
  BigQuery: {
    slug: "bigquery",
    name: "BigQuery",
    category: "Data Analytics",
    also: ["BigQuery Functions", "BigQuery Omni"],
  },
  "Cloud Run": { slug: "cloud-run", name: "Cloud Run", category: "Serverless Computing" },
  "Cloud SQL": { slug: "cloud-sql", name: "Cloud SQL", category: "Databases" },
  "Cloud Spanner": { slug: "spanner", name: "Spanner", category: "Databases" },
  "Cloud Storage": { slug: "cloud-storage", name: "Cloud Storage", category: "Storage" },
  "Compute Engine": { slug: "compute-engine", name: "Compute Engine", category: "Compute" },
  "Distributed Cloud": {
    slug: "distributed-cloud",
    name: "Google Distributed Cloud",
    category: "Hybrid & Multicloud",
  },
  GKE: { slug: "gke", name: "Google Kubernetes Engine", category: "Containers" },
  Hyperdisk: { slug: "hyperdisk", name: "Hyperdisk", category: "Storage" },
  Looker: {
    slug: "looker",
    name: "Looker",
    category: "Business Intelligence",
    also: ["Looker Studio", "Looker Studio Pro"],
  },
  Mandiant: { slug: "mandiant", name: "Mandiant", category: "Security Identity" },
  "Security Command Center": {
    slug: "security-command-center",
    name: "Security Command Center",
    category: "Security Identity",
  },
  "Security Operations": {
    slug: "security-operations",
    name: "Google Security Operations",
    category: "Security Identity",
  },
  "Threat Intelligence": {
    slug: "threat-intelligence",
    name: "Google Threat Intelligence",
    category: "Security Identity",
  },
  "Vertex AI": { slug: "vertex-ai", name: "Vertex AI", category: "AI _ Machine Learning" },
};

const CORE_PATH = /^Unique Icons\/([^/]+)\/SVG\/[^/]+\.svg$/;
const CATEGORY_PATH = /^Category Icons\/([^/]+)\/SVG\/[^/]+\.svg$/;

export async function loadGcpZips(
  vendorDir: string,
): Promise<{ core: Uint8Array; categories: Uint8Array }> {
  return {
    core: await loadPinned(vendorDir, "gcp-core-products-icons.zip", GCP_SOURCE.core),
    categories: await loadPinned(vendorDir, "gcp-category-icons.zip", GCP_SOURCE.categories),
  };
}

/**
 * Builds the Google Cloud library (IC-7): each core product with its own icon, each category
 * icon, and an entry per product the guide lists, drawn with its category's icon as Google
 * directs. One file per entry keeps every icon id a plain file, like every other library.
 */
export function buildGcpIcons(zips: { core: Uint8Array; categories: Uint8Array }): BuiltIcon[] {
  const core = readFolders(zips.core, CORE_PATH, CORE_PRODUCTS, "core product");
  const categories = readFolders(zips.categories, CATEGORY_PATH, CATEGORIES, "category");
  const icons: BuiltIcon[] = [];
  const add = (name: string, slug: string, categoryFolder: string, source: string) => {
    const category = CATEGORIES[categoryFolder]?.name;
    if (category === undefined) throw new Error(`Unknown Google Cloud category ${categoryFolder}.`);
    icons.push({
      entry: {
        library: "gcp",
        slug,
        name,
        category,
        otherCategories: [],
        aliases: [],
        kind: "artwork",
        color: null,
      },
      svg: cleanGcpSvg(source, slug, name),
    });
  };
  for (const [folder, product] of Object.entries(CORE_PRODUCTS)) {
    const source = svgOf(core, folder);
    add(product.name, product.slug, product.category, source);
    for (const name of product.also ?? []) add(name, slugify(name), product.category, source);
  }
  for (const [folder, info] of Object.entries(CATEGORIES)) {
    const source = svgOf(categories, folder);
    add(info.name, info.slug, folder, source);
    for (const name of info.products) add(name, slugify(name), folder, source);
  }
  return icons;
}

/**
 * Reads each `<folder>/SVG/*.svg` and checks the folders match `known` exactly, so a product or
 * category Google adds, renames or drops fails the build instead of being silently missed.
 */
function readFolders(
  zip: Uint8Array,
  pattern: RegExp,
  known: Readonly<Record<string, unknown>>,
  what: string,
): Map<string, string> {
  const files = unzipSync(zip, { filter: (file) => pattern.test(file.name) });
  const byFolder = new Map<string, string>();
  for (const [path, data] of Object.entries(files)) {
    const [, folder = ""] = pattern.exec(path) ?? [];
    if (byFolder.has(folder)) throw new Error(`Google Cloud ${what} "${folder}" has two SVGs.`);
    byFolder.set(folder, strFromU8(data));
  }
  const unknown = [...byFolder.keys()].filter((folder) => !(folder in known));
  const missing = Object.keys(known).filter((folder) => !byFolder.has(folder));
  if (unknown.length > 0 || missing.length > 0) {
    throw new Error(
      `Google Cloud ${what} icons changed. New: ${unknown.join(", ") || "none"}. ` +
        `Missing: ${missing.join(", ") || "none"}.`,
    );
  }
  return byFolder;
}

/** readFolders has already checked that every known folder is present. */
function svgOf(folders: ReadonlyMap<string, string>, folder: string): string {
  const svg = folders.get(folder);
  if (svg === undefined) throw new Error(`Google Cloud icon folder ${folder} is missing.`);
  return svg;
}

function cleanGcpSvg(source: string, slug: string, name: string): string {
  try {
    return serializeSvg(cleanArtwork(source, slug));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Google Cloud icon ${name}: ${reason}`, { cause: error });
  }
}
