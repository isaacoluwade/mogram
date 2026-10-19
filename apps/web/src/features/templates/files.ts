import type { ProjectFiles } from "@mogram/core/model";
import aksCard from "./aks/docs/aks.md";
import aksCluster from "./aks/aks/mogram.yaml";
import aksMain from "./aks/mogram.yaml";
import awsCard from "./aws-serverless/docs/upload.md";
import awsMain from "./aws-serverless/mogram.yaml";
import blankMain from "./blank/mogram.yaml";
import blankDeckMain from "./blank-deck/mogram.yaml";
import blankDeckIntro from "./blank-deck/intro/mogram.yaml";
import failoverMain from "./failover/mogram.yaml";
import gcpCard from "./gcp-pipeline/docs/enrich.md";
import gcpMain from "./gcp-pipeline/mogram.yaml";
import kubernetesMain from "./kubernetes-app/mogram.yaml";
import webFrontDoorCard from "./web-app/docs/front-door.md";
import webMain from "./web-app/mogram.yaml";
import webVmCard from "./web-app/docs/web-vm.md";
import webAppTourMain from "./web-app-tour/mogram.yaml";

/**
 * The templates' files. Each template is a folder here laid out exactly like the project it
 * starts (open one with "Open files…" and you get the same diagram); the files are imported as
 * text (`turbopack.rules` in next.config.ts, the raw-text plugin in vitest.config.mts).
 */

export const BLANK_FILES: ProjectFiles = { "mogram.yaml": blankMain };
export const BLANK_DECK_FILES: ProjectFiles = {
  "mogram.yaml": blankDeckMain,
  "intro/mogram.yaml": blankDeckIntro,
};

/** "Azure web app": the PRD's first journey, with scenes, cards and a branching tour. */
export const WEB_APP_FILES: ProjectFiles = {
  "mogram.yaml": webMain,
  "docs/front-door.md": webFrontDoorCard,
  "docs/web-vm.md": webVmCard,
};

/** A three-slide tour of the existing web app diagram and its resilience scenes. */
export const WEB_APP_TOUR_FILES: ProjectFiles = {
  "mogram.yaml": webAppTourMain,
  "architecture/mogram.yaml": webMain,
  "architecture/docs/front-door.md": webFrontDoorCard,
  "architecture/docs/web-vm.md": webVmCard,
};

/** "Storefront on AKS": a folder-mode diagram whose cluster opens a nested diagram with ports (NE-1 … NE-4). */
export const AKS_FILES: ProjectFiles = {
  "mogram.yaml": aksMain,
  "docs/aks.md": aksCard,
  "aks/mogram.yaml": aksCluster,
};

/** "Region failover": active/passive regions; break the primary and watch traffic reroute (PRD journey 8). */
export const FAILOVER_FILES: ProjectFiles = { "mogram.yaml": failoverMain };

/** "Serverless API on AWS": the AWS library end to end, with AWS group icons on the containers. */
export const AWS_SERVERLESS_FILES: ProjectFiles = {
  "mogram.yaml": awsMain,
  "docs/upload.md": awsCard,
};

/** "Event pipeline on Google Cloud": core product icons beside category-icon products. */
export const GCP_PIPELINE_FILES: ProjectFiles = {
  "mogram.yaml": gcpMain,
  "docs/enrich.md": gcpCard,
};

/** "Web app on Kubernetes": the Kubernetes icon set for a namespace's resources. */
export const KUBERNETES_APP_FILES: ProjectFiles = { "mogram.yaml": kubernetesMain };
