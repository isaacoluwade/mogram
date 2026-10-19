import type { ProjectFiles } from "@mogram/core/model";
import {
  AKS_FILES,
  AWS_SERVERLESS_FILES,
  BLANK_FILES,
  BLANK_DECK_FILES,
  FAILOVER_FILES,
  GCP_PIPELINE_FILES,
  KUBERNETES_APP_FILES,
  WEB_APP_FILES,
  WEB_APP_TOUR_FILES,
} from "./files";

export interface Template {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly files: ProjectFiles;
  /** What the template shows off, as short tags on its card. */
  readonly features: readonly string[];
}

export const TEMPLATES: readonly Template[] = [
  { id: "blank", name: "Blank", description: "An empty canvas.", files: BLANK_FILES, features: [] },
  {
    id: "blank-deck",
    name: "Blank deck",
    description: "A deck with one empty 16:9 slide.",
    files: BLANK_DECK_FILES,
    features: ["Deck", "16:9"],
  },
  {
    id: "web-app",
    name: "Three-tier web app",
    description: "Front Door, App Gateway, VMs and SQL with a cache and a geo-replica.",
    files: WEB_APP_FILES,
    features: ["Scenes", "Cards", "Tour"],
  },
  {
    id: "web-app-tour",
    name: "Three-tier web app tour",
    description:
      "An overview, a traffic spike and a regional outage, built from one linked diagram.",
    files: WEB_APP_TOUR_FILES,
    features: ["Deck", "Scenes", "16:9"],
  },
  {
    id: "aks",
    name: "Microservices on AKS",
    description: "A cluster you can open: services, namespaces and ports inside.",
    files: AKS_FILES,
    features: ["Nested", "Scenes", "Tour"],
  },
  {
    id: "failover",
    name: "Region failover",
    description: "Active/passive regions. Take the primary down and traffic reroutes.",
    files: FAILOVER_FILES,
    features: ["Scenes", "Reroute"],
  },
  {
    id: "aws-serverless",
    name: "Serverless API on AWS",
    description: "CloudFront, API Gateway and Lambda with DynamoDB, S3 and a queue worker.",
    files: AWS_SERVERLESS_FILES,
    features: ["AWS", "Scenes", "Tour"],
  },
  {
    id: "gcp-pipeline",
    name: "Event pipeline on Google Cloud",
    description: "Cloud Run, Pub/Sub and Dataflow streaming device events into BigQuery.",
    files: GCP_PIPELINE_FILES,
    features: ["Google Cloud", "Scenes", "Cards"],
  },
  {
    id: "kubernetes-app",
    name: "Web app on Kubernetes",
    description: "Ingress, services and autoscaled deployments, with Postgres on a StatefulSet.",
    files: KUBERNETES_APP_FILES,
    features: ["Kubernetes", "Scenes", "Motion"],
  },
];

/** Whether a `?template=` value names one of the templates. */
export function isTemplateId(id: string): boolean {
  return TEMPLATES.some((t) => t.id === id);
}

export function templateById(id: string | null | undefined): Template {
  return TEMPLATES.find((t) => t.id === id) ?? (TEMPLATES[0] as Template);
}
