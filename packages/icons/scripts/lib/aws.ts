import { strFromU8, unzipSync } from "fflate";
import { cleanArtwork, toCutoutGlyph, toGlyph } from "./clean";
import { slugify, type BuiltIcon } from "./model";
import { serializeSvg } from "./svg";
import { loadPinned } from "./vendor";

/**
 * The pinned AWS Architecture Icons package. AWS publishes a new package each quarter under a
 * new URL; it is adopted by updating this block and re-running the build.
 */
export const AWS_SOURCE = {
  release: "07312026",
  published: "31 July 2026",
  url: "https://d1.awsstatic.com/onedam/marketing-channels/website/public/shared/architecture-icon-release/Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92.zip",
  sha256: "d2d166c453526471749d520e0db022c459abef759d2946cf2dd1d1c992dc6526",
  page: "https://aws.amazon.com/architecture/icons/",
} as const;

/**
 * AWS's folder names (`Arch_<folder>`, `Res_<folder>`, `Arch-Category_<folder>`) mapped to the
 * category names AWS uses on its product pages. An unknown folder fails the build so a new
 * area gets a deliberate name.
 */
const CATEGORIES: Readonly<Record<string, string>> = {
  Analytics: "Analytics",
  "Application-Integration": "Application Integration",
  "Artificial-Intelligence": "Artificial Intelligence",
  Blockchain: "Blockchain",
  "Business-Applications": "Business Applications",
  "Cloud-Financial-Management": "Cloud Financial Management",
  Compute: "Compute",
  Containers: "Containers",
  "Customer-Enablement": "Customer Enablement",
  "Customer-Experience": "Customer Experience",
  Databases: "Databases",
  "Developer-Tools": "Developer Tools",
  "End-User-Computing": "End User Computing",
  "Front-End-Web-Mobile": "Front-End Web & Mobile",
  Games: "Games",
  "General-Icons": "General",
  "Internet-of-Things": "Internet of Things",
  IoT: "Internet of Things",
  "Management-Tools": "Management & Governance",
  "Management-Governance": "Management & Governance",
  "Media-Services": "Media Services",
  "Migration-Modernization": "Migration & Modernization",
  "Multicloud-and-Hybrid": "Multicloud & Hybrid",
  "Networking-Content-Delivery": "Networking & Content Delivery",
  "Quantum-Technologies": "Quantum Technologies",
  Satellite: "Satellite",
  "Security-Identity": "Security, Identity & Compliance",
  Serverless: "Serverless",
  Storage: "Storage",
};

/** Library panel sections for the two kinds of icon that are not about one service. */
const GROUPS_CATEGORY = "Groups";
const CATEGORY_ICONS_CATEGORY = "Categories";

/**
 * AWS's own short names for services whose file names spell the long form out. Diagrams say
 * "Amazon S3", not "Amazon Simple Storage Service", and the slug follows (`aws/s3`). The long
 * name stays searchable as an alias. Resource icons use the same short names.
 */
const SHORT_NAMES: Readonly<Record<string, string>> = {
  "Amazon Simple Storage Service": "Amazon S3",
  "Amazon Simple Storage Service Glacier": "Amazon S3 Glacier",
  "Amazon Simple Queue Service": "Amazon SQS",
  "Amazon Simple Notification Service": "Amazon SNS",
  "Amazon Simple Email Service": "Amazon SES",
  "Amazon Elastic Block Store": "Amazon EBS",
  "Amazon Elastic File System": "Amazon EFS",
  "Amazon Elastic Container Service": "Amazon ECS",
  "Amazon Elastic Container Registry": "Amazon ECR",
  "Amazon Elastic Kubernetes Service": "Amazon EKS",
  "Amazon Virtual Private Cloud": "Amazon VPC",
  "AWS Identity and Access Management": "AWS IAM",
  "AWS Identity Access Management": "AWS IAM",
  "AWS Key Management Service": "AWS KMS",
  "AWS Database Migration Service": "AWS DMS",
  "Amazon Managed Streaming for Apache Kafka": "Amazon MSK",
  "Amazon Managed Workflows for Apache Airflow": "Amazon MWAA",
};

/**
 * Names AWS's file names cannot produce: hyphens that belong in the name, abbreviations and
 * typos. Keyed by the file stem (`Arch_<stem>_48.svg`, `Res_<stem>_48.svg`).
 */
const NAME_FIXES: Readonly<Record<string, string>> = {
  "AWS-rePost": "AWS re:Post",
  "AWS-rePost-Private": "AWS re:Post Private",
  "AWS-X-Ray": "AWS X-Ray",
  "AWS-Site-to-Site-VPN": "AWS Site-to-Site VPN",
  "AWS-Well-Architected-Tool": "AWS Well-Architected Tool",
  "AWS-Parallel-Cluster": "AWS ParallelCluster",
  "AWS-Training-Certification": "AWS Training and Certification",
  "Amazon-Augmented-AI-A2I": "Amazon Augmented AI (A2I)",
  "Amazon-FSx-for-WFS": "Amazon FSx for Windows File Server",
  "AWS-Marketplace_Light": "AWS Marketplace",
  "Amazon-CloudWatch_Cross-account-Observability": "Amazon CloudWatch Cross-Account Observability",
  "Amazon-CloudWatch_Event-Event-Based": "Amazon CloudWatch Event (Event-Based)",
  "Amazon-CloudWatch_Event-Time-Based": "Amazon CloudWatch Event (Time-Based)",
  "Amazon-Elastic-Container-Service_CopiIoT-CLI": "AWS Copilot CLI",
  "Amazon-OpenSearch-Service_OpenSearch-Dashboards": "Amazon OpenSearch Dashboards",
  "Amazon-OpenSearch-Service_OpenSearch-Ingestion": "Amazon OpenSearch Ingestion",
  "Amazon-RDS_Blue-Green-Deployments": "Amazon RDS Blue/Green Deployments",
  "Amazon-RDS_Multi-AZ": "Amazon RDS Multi-AZ",
  "Amazon-RDS_Multi-AZ-DB-Cluster": "Amazon RDS Multi-AZ DB Cluster",
  "Amazon-VPC_Virtual-private-cloud-VPC": "Amazon VPC Virtual Private Cloud",
  "Amazon-Simple-Storage-Service_S3-Multi-Region-Access-Points":
    "Amazon S3 Multi-Region Access Points",
  "Amazon-File-Cache_On-premises-NFS-linked-datasets":
    "Amazon File Cache On-Premises NFS Linked Datasets",
  "AWS-Identity-Access-Management_Add-on": "AWS IAM Add-on",
  "AWS-Identity-Access-Management_Long-Term-Security-Credential":
    "AWS IAM Long-Term Security Credential",
  "AWS-IoT-Device-Defender_IoT-Device-Jobs": "AWS IoT Device Jobs",
  "AWS-IoT_Over-Air-Update": "AWS IoT Over-the-Air Update",
  "AWS-Transfer-Family_AWS-AS2": "AWS Transfer Family AS2",
  "AWS-Transfer-Family_AWS-FTP": "AWS Transfer Family FTP",
  "AWS-Transfer-Family_AWS-FTPS": "AWS Transfer Family FTPS",
  "AWS-Transfer-Family_AWS-SFTP": "AWS Transfer Family SFTP",
  "Elastic-Load-Balancing_Application-Load-Balancer": "Application Load Balancer",
  "Elastic-Load-Balancing_Classic-Load-Balancer": "Classic Load Balancer",
  "Elastic-Load-Balancing_Gateway-Load-Balancer": "Gateway Load Balancer",
  "Elastic-Load-Balancing_Network-Load-Balancer": "Network Load Balancer",
  "Internet-alt1": "Internet (Alternate 1)",
  "Internet-alt2": "Internet (Alternate 2)",
};

/** Single words AWS spells inconsistently across files. */
const WORD_FIXES: Readonly<Record<string, string>> = {
  Aternate: "Alternate",
  Datasync: "DataSync",
  Saas: "SaaS",
};

/** Lowercase words that stay lowercase when a name is title-cased. */
const SMALL_WORDS = new Set([
  "a",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "via",
  "with",
]);

/**
 * Group icons label the boxes architecture diagrams draw around resources; a container's `icon`
 * shows one in its header. Named and slugged by hand: AWS's file names repeat words
 * ("Virtual-private-cloud-VPC") and the plain slugs would collide with services.
 */
const GROUPS: Readonly<Record<string, { readonly slug: string; readonly name: string }>> = {
  "AWS-Cloud": { slug: "aws-cloud", name: "AWS Cloud" },
  "AWS-Cloud-logo": { slug: "aws-cloud-logo", name: "AWS Cloud (logo)" },
  "AWS-Account": { slug: "aws-account", name: "AWS Account" },
  Region: { slug: "region", name: "Region" },
  "Virtual-private-cloud-VPC": { slug: "vpc-group", name: "Virtual Private Cloud (VPC)" },
  "Private-subnet": { slug: "private-subnet", name: "Private Subnet" },
  "Public-subnet": { slug: "public-subnet", name: "Public Subnet" },
  "Auto-Scaling-group": { slug: "auto-scaling-group", name: "Auto Scaling Group" },
  "Spot-Fleet": { slug: "spot-fleet", name: "Spot Fleet" },
  "EC2-instance-contents": { slug: "ec2-instance-contents", name: "EC2 Instance Contents" },
  "Server-contents": { slug: "server-contents", name: "Server Contents" },
  "Corporate-data-center": { slug: "corporate-data-center", name: "Corporate Data Center" },
  "AWS-IoT-Greengrass-Deployment": {
    slug: "iot-greengrass-deployment",
    name: "AWS IoT Greengrass Deployment",
  },
};

/**
 * The near-black AWS draws general resource icons in for light backgrounds (`Res_48_Light`).
 * They become `currentColor` glyphs so they read on dark canvases too, instead of shipping the
 * separate dark-background copies.
 */
const GENERAL_ICON_COLOURS: ReadonlySet<string> = new Set(["#232f3d", "#232f3e", "#242f3e"]);

/**
 * Icons AWS draws as a near-black square with a white mark, plus a `_Dark` copy with the colours
 * swapped. A near-black square would vanish on a dark canvas, so the square takes the theme
 * colour and the mark is cut out of it, which gives each copy on the background it was made for.
 */
const CUTOUT_ICONS = new Set(["AWS-Cloud", "AWS-Cloud-logo", "AWS-Marketplace_Light"]);

const release = AWS_SOURCE.release;
const SERVICE_PATH = new RegExp(
  `^Architecture-Service-Icons_${release}/Arch_([^/]+)/48/Arch_(.+)_48\\.svg$`,
);
const RESOURCE_PATH = new RegExp(`^Resource-Icons_${release}/Res_([^/]+)/Res_(.+)_48\\.svg$`);
const GENERAL_PATH = new RegExp(
  `^Resource-Icons_${release}/Res_General-Icons/Res_48_Light/Res_(.+)_48_Light\\.svg$`,
);
const GROUP_PATH = new RegExp(`^Architecture-Group-Icons_${release}/(.+)_32\\.svg$`);
const CATEGORY_PATH = new RegExp(
  `^Category-Icons_${release}/Arch-Category_48/Arch-Category_(.+)_48\\.svg$`,
);

export async function loadAwsZip(vendorDir: string): Promise<Uint8Array> {
  return loadPinned(vendorDir, `aws-icons-${release}.zip`, AWS_SOURCE);
}

type Kind = "service" | "resource" | "general" | "group" | "category";

interface Source {
  readonly kind: Kind;
  readonly folder: string | null;
  readonly stem: string;
  readonly path: string;
  readonly text: string;
}

/**
 * Builds the AWS library (IC-7): services at their 48px architecture size, resources, general
 * resource icons (as glyphs), group icons and category icons. Dark-background duplicates
 * (`_Dark`) and macOS archive debris are skipped.
 */
export function buildAwsIcons(zip: Uint8Array): BuiltIcon[] {
  const files = unzipSync(zip, {
    filter: (file) => file.name.endsWith(".svg") && !file.name.startsWith("__MACOSX/"),
  });
  const sources = Object.entries(files)
    .map(([path, data]) => readSource(path, strFromU8(data)))
    .filter((source): source is Source => source !== null)
    .sort(compareSources);

  const icons = new Map<string, BuiltIcon>();
  const names = new Set<string>();
  for (const source of sources) {
    const category = categoryOf(source);
    let name = nameOf(source);
    const existing = [...icons.values()].find(({ entry }) => entry.name === name);
    if (existing !== undefined && source.kind === "service") {
      // AWS files a few services in two areas, drawn in each area's colour: keep the first and
      // list the service under both.
      if (
        existing.entry.category !== category &&
        !existing.entry.otherCategories.includes(category)
      ) {
        existing.entry.otherCategories.push(category);
      }
      continue;
    }
    let slug = slugOf(source, name);
    if (names.has(name)) {
      // A resource drawn for the service as a whole: "AWS Cloud9" under "AWS Cloud9".
      name = `${name} (resource)`;
      slug = slugOf(source, name);
    } else if (icons.has(slug)) {
      // Only the slug clashes: the general "Shield" icon and the "AWS Shield" service.
      slug = `${slug}-resource`;
    }
    if (names.has(name) || icons.has(slug)) {
      throw new Error(`AWS icon "${name}" (${slug}) is used twice (${source.path}).`);
    }
    names.add(name);
    icons.set(slug, {
      entry: {
        library: "aws",
        slug,
        name,
        category,
        otherCategories: [],
        aliases: aliasesOf(source, name),
        kind: source.kind === "general" || CUTOUT_ICONS.has(source.stem) ? "glyph" : "artwork",
        color: null,
      },
      svg: cleanAwsSvg(source, slug),
    });
  }
  return [...icons.values()];
}

function readSource(path: string, text: string): Source | null {
  // Copies drawn for dark backgrounds: `…_Dark_48.svg`, `…_32_Dark.svg`, `Res_48_Dark/`.
  if (/_Dark[_./]/.test(path)) return null;
  const general = GENERAL_PATH.exec(path);
  if (general !== null) {
    const [, stem = ""] = general;
    return { kind: "general", folder: null, stem, path, text };
  }
  const service = SERVICE_PATH.exec(path);
  if (service !== null) {
    const [, folder = "", stem = ""] = service;
    return { kind: "service", folder, stem, path, text };
  }
  const resource = RESOURCE_PATH.exec(path);
  if (resource !== null) {
    const [, folder = "", stem = ""] = resource;
    return { kind: "resource", folder, stem: stem.trim(), path, text };
  }
  const group = GROUP_PATH.exec(path);
  if (group !== null) {
    const [, stem = ""] = group;
    return { kind: "group", folder: null, stem, path, text };
  }
  const category = CATEGORY_PATH.exec(path);
  if (category !== null) {
    const [, folder = ""] = category;
    return { kind: "category", folder, stem: folder, path, text };
  }
  if (/\/(16|32|64)\//.test(path) || /Arch-Category_(16|32|64)\//.test(path)) return null;
  throw new Error(`Unexpected file in the AWS package: ${path}`);
}

/** Services first so a resource that shares a service's name is the one renamed. */
const KIND_ORDER: readonly Kind[] = ["service", "category", "group", "resource", "general"];

function compareSources(a: Source, b: Source): number {
  return (
    KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
    compare(a.folder ?? "", b.folder ?? "") ||
    compare(a.stem, b.stem)
  );
}

function categoryOf(source: Source): string {
  if (source.kind === "group") return GROUPS_CATEGORY;
  if (source.kind === "category") return CATEGORY_ICONS_CATEGORY;
  if (source.kind === "general") return "General";
  const category = CATEGORIES[source.folder ?? ""];
  if (category === undefined) throw new Error(`Unknown AWS icon folder "${source.folder}".`);
  return category;
}

function nameOf(source: Source): string {
  const fixed = NAME_FIXES[source.stem];
  if (fixed !== undefined) return fixed;
  switch (source.kind) {
    case "group":
      return groupOf(source.stem).name;
    case "category":
      return categoryOf({ ...source, kind: "service" });
    case "service":
    case "general":
      return serviceName(source.stem);
    case "resource":
      return resourceName(source.stem);
  }
}

/** `Amazon-Simple-Queue-Service` → `Amazon SQS`; `AWS-Outposts-rack` → `AWS Outposts Rack`. */
function serviceName(stem: string): string {
  const name = words(stem).join(" ");
  return SHORT_NAMES[name] ?? name;
}

/**
 * Resource files are `<service>_<resource>`, sometimes with more parts (`AWS-IoT_Thing_Bank`)
 * and sometimes one part (`Amazon-Aurora-MySQL-Instance`). The name avoids saying the service
 * twice: `AWS-Lambda_Lambda-Function` is "AWS Lambda Function", and a resource that is itself a
 * full product name (`Amazon-MSK_Amazon-MSK-Connect`) is used as it is.
 */
function resourceName(stem: string): string {
  const [serviceStem = "", ...rest] = stem.split("_");
  const service = serviceName(serviceStem);
  if (rest.length === 0) return service;
  const resource = serviceName(rest.join("-"));
  if (/^(Amazon|AWS) /.test(resource)) return resource;
  const serviceWords = service.split(" ");
  const resourceWords = resource.split(" ");
  const [firstWord = ""] = serviceWords;
  const vendor = /^(Amazon|AWS)$/.test(firstWord) ? firstWord : null;
  const product = vendor === null ? serviceWords : serviceWords.slice(1);
  // "Lambda Function" under "AWS Lambda": the resource already starts with the product name.
  if (vendor !== null && startsWith(resourceWords, product)) {
    return [vendor, ...resourceWords].join(" ");
  }
  // "Blockchain" under "Amazon Managed Blockchain": drop the words the two names share.
  for (let overlap = Math.min(serviceWords.length, resourceWords.length); overlap > 0; overlap--) {
    if (startsWith(resourceWords, serviceWords.slice(-overlap))) {
      return [...serviceWords, ...resourceWords.slice(overlap)].join(" ");
    }
  }
  return `${service} ${resource}`;
}

function startsWith(list: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length > 0 && prefix.every((word, index) => list[index] === word);
}

/**
 * Splits a file stem into title-cased words, keeping AWS's own capitals (`DynamoDB`, `gp3`).
 * Small words are lowercase after the first word whichever way the file spells them, so
 * `S3-On-Outposts` and `S3-on-Outposts` give the same name.
 */
function words(stem: string): string[] {
  return stem
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word, index) => WORD_FIXES[word] ?? titleCase(word, index === 0));
}

function titleCase(word: string, first: boolean): string {
  if (SMALL_WORDS.has(word.toLowerCase()) && !first) return word.toLowerCase();
  if (!/^[a-z]+$/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** The slug drops the vendor word: `Amazon S3` → `s3`, `AWS Lambda Function` → `lambda-function`. */
function slugOf(source: Source, name: string): string {
  if (source.kind === "group") return groupOf(source.stem).slug;
  return slugify(name.replace(/^(Amazon|AWS) /, ""));
}

function groupOf(stem: string): { readonly slug: string; readonly name: string } {
  const group = GROUPS[stem];
  if (group === undefined) throw new Error(`Unknown AWS group icon "${stem}".`);
  return group;
}

/**
 * Search terms every AWS icon gets: its name without "Amazon" or "AWS", since people type
 * `lambda` and `s3` (IC-5), and the spelled-out name where the display name is AWS's
 * abbreviation (`amazon simple queue service`).
 */
function aliasesOf(source: Source, name: string): string[] {
  const aliases: string[] = [];
  const product = name.replace(/^(Amazon|AWS) /, "");
  if (product !== name) aliases.push(product.toLowerCase());
  if (source.kind === "service") {
    const long = words(source.stem).join(" ");
    if (SHORT_NAMES[long] !== undefined) aliases.push(long.toLowerCase());
  }
  return aliases;
}

function cleanAwsSvg(source: Source, slug: string): string {
  try {
    const svg = cleanArtwork(source.text, slug);
    if (source.kind === "general") toGlyph(svg, GENERAL_ICON_COLOURS);
    if (CUTOUT_ICONS.has(source.stem)) {
      toCutoutGlyph(svg, `${slug}-cutout`, {
        fill: GENERAL_ICON_COLOURS,
        cutout: new Set(["#ffffff"]),
      });
    }
    return serializeSvg(svg);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`AWS icon ${source.path}: ${reason}`, { cause: error });
  }
}

function compare(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
