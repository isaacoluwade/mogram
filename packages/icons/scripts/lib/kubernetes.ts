import { strFromU8 } from "fflate";
import { cleanArtwork } from "./clean";
import type { BuiltIcon } from "./model";
import { serializeSvg } from "./svg";
import { loadPinnedSet } from "./vendor";

interface KubernetesIcon {
  readonly slug: string;
  readonly name: string;
  readonly category: string;
  /** Path below `icons/svg/` in kubernetes/community. */
  readonly path: string;
}

/**
 * The Kubernetes icon set from kubernetes/community (`icons/`), the community's standard for
 * architecture diagrams. Unlabelled artwork is used where it exists so the component's own
 * label is the only text; control plane and node components come labelled only ("api",
 * "sched"), which is how the project publishes them. Names are the Kubernetes kinds and
 * component names as the docs write them.
 */
const ICONS: readonly KubernetesIcon[] = [
  {
    slug: "control-plane",
    name: "Control Plane",
    category: "Control plane",
    path: "infrastructure_components/unlabeled/control-plane.svg",
  },
  {
    slug: "api-server",
    name: "API Server",
    category: "Control plane",
    path: "control_plane_components/labeled/api.svg",
  },
  {
    slug: "scheduler",
    name: "Scheduler",
    category: "Control plane",
    path: "control_plane_components/labeled/sched.svg",
  },
  {
    slug: "controller-manager",
    name: "Controller Manager",
    category: "Control plane",
    path: "control_plane_components/labeled/c-m.svg",
  },
  {
    slug: "cloud-controller-manager",
    name: "Cloud Controller Manager",
    category: "Control plane",
    path: "control_plane_components/labeled/c-c-m.svg",
  },
  {
    slug: "etcd",
    name: "etcd",
    category: "Control plane",
    path: "infrastructure_components/unlabeled/etcd.svg",
  },
  {
    slug: "node",
    name: "Node",
    category: "Nodes",
    path: "infrastructure_components/unlabeled/node.svg",
  },
  {
    slug: "kubelet",
    name: "kubelet",
    category: "Nodes",
    path: "control_plane_components/labeled/kubelet.svg",
  },
  {
    slug: "kube-proxy",
    name: "kube-proxy",
    category: "Nodes",
    path: "control_plane_components/labeled/k-proxy.svg",
  },
  { slug: "pod", name: "Pod", category: "Workloads", path: "resources/unlabeled/pod.svg" },
  {
    slug: "deployment",
    name: "Deployment",
    category: "Workloads",
    path: "resources/unlabeled/deploy.svg",
  },
  {
    slug: "replicaset",
    name: "ReplicaSet",
    category: "Workloads",
    path: "resources/unlabeled/rs.svg",
  },
  {
    slug: "statefulset",
    name: "StatefulSet",
    category: "Workloads",
    path: "resources/unlabeled/sts.svg",
  },
  {
    slug: "daemonset",
    name: "DaemonSet",
    category: "Workloads",
    path: "resources/unlabeled/ds.svg",
  },
  { slug: "job", name: "Job", category: "Workloads", path: "resources/unlabeled/job.svg" },
  {
    slug: "cronjob",
    name: "CronJob",
    category: "Workloads",
    path: "resources/unlabeled/cronjob.svg",
  },
  {
    slug: "horizontal-pod-autoscaler",
    name: "HorizontalPodAutoscaler",
    category: "Workloads",
    path: "resources/unlabeled/hpa.svg",
  },
  { slug: "service", name: "Service", category: "Networking", path: "resources/unlabeled/svc.svg" },
  { slug: "ingress", name: "Ingress", category: "Networking", path: "resources/unlabeled/ing.svg" },
  {
    slug: "endpoints",
    name: "Endpoints",
    category: "Networking",
    path: "resources/unlabeled/ep.svg",
  },
  {
    slug: "network-policy",
    name: "NetworkPolicy",
    category: "Networking",
    path: "resources/unlabeled/netpol.svg",
  },
  {
    slug: "persistent-volume",
    name: "PersistentVolume",
    category: "Storage",
    path: "resources/unlabeled/pv.svg",
  },
  {
    slug: "persistent-volume-claim",
    name: "PersistentVolumeClaim",
    category: "Storage",
    path: "resources/unlabeled/pvc.svg",
  },
  {
    slug: "storage-class",
    name: "StorageClass",
    category: "Storage",
    path: "resources/unlabeled/sc.svg",
  },
  { slug: "volume", name: "Volume", category: "Storage", path: "resources/unlabeled/vol.svg" },
  {
    slug: "namespace",
    name: "Namespace",
    category: "Configuration",
    path: "resources/unlabeled/ns.svg",
  },
  {
    slug: "configmap",
    name: "ConfigMap",
    category: "Configuration",
    path: "resources/unlabeled/cm.svg",
  },
  {
    slug: "secret",
    name: "Secret",
    category: "Configuration",
    path: "resources/unlabeled/secret.svg",
  },
  {
    slug: "limit-range",
    name: "LimitRange",
    category: "Configuration",
    path: "resources/unlabeled/limits.svg",
  },
  {
    slug: "resource-quota",
    name: "ResourceQuota",
    category: "Configuration",
    path: "resources/unlabeled/quota.svg",
  },
  {
    slug: "custom-resource-definition",
    name: "CustomResourceDefinition",
    category: "Configuration",
    path: "resources/unlabeled/crd.svg",
  },
  { slug: "role", name: "Role", category: "Access control", path: "resources/unlabeled/role.svg" },
  {
    slug: "role-binding",
    name: "RoleBinding",
    category: "Access control",
    path: "resources/unlabeled/rb.svg",
  },
  {
    slug: "cluster-role",
    name: "ClusterRole",
    category: "Access control",
    path: "resources/unlabeled/c-role.svg",
  },
  {
    slug: "cluster-role-binding",
    name: "ClusterRoleBinding",
    category: "Access control",
    path: "resources/unlabeled/crb.svg",
  },
  {
    slug: "service-account",
    name: "ServiceAccount",
    category: "Access control",
    path: "resources/unlabeled/sa.svg",
  },
  { slug: "user", name: "User", category: "Access control", path: "resources/unlabeled/user.svg" },
  {
    slug: "group",
    name: "Group",
    category: "Access control",
    path: "resources/unlabeled/group.svg",
  },
  {
    slug: "pod-security-policy",
    name: "PodSecurityPolicy",
    category: "Access control",
    path: "resources/unlabeled/psp.svg",
  },
];

const COMMIT = "b0e9e677be6c9b178368d57b86e9f548fcbd575f";

/**
 * Pinned to one commit of kubernetes/community. GitHub's zip archives are not byte-stable, so
 * the files are fetched one by one and checked together against a manifest hash (vendor.ts).
 */
export const KUBERNETES_SOURCE = {
  repository: "https://github.com/kubernetes/community/tree/master/icons",
  commit: COMMIT,
  baseUrl: `https://raw.githubusercontent.com/kubernetes/community/${COMMIT}/icons/svg`,
  paths: ICONS.map((icon) => icon.path),
  sha256: "5b4d06ddd5535149bff463cfc3b00257e1bc40e6b4b39b930c046461d3883190",
} as const;

export async function loadKubernetesIcons(vendorDir: string): Promise<Map<string, Uint8Array>> {
  return loadPinnedSet(vendorDir, `kubernetes-community-${COMMIT.slice(0, 12)}`, KUBERNETES_SOURCE);
}

export function buildKubernetesIcons(files: ReadonlyMap<string, Uint8Array>): BuiltIcon[] {
  return ICONS.map((icon) => ({
    entry: {
      library: "k8s",
      slug: icon.slug,
      name: icon.name,
      category: icon.category,
      otherCategories: [],
      aliases: [],
      kind: "artwork",
      color: null,
    },
    svg: cleanKubernetesSvg(fileOf(files, icon.path), icon),
  }));
}

/** loadPinnedSet has already checked that every path is present. */
function fileOf(files: ReadonlyMap<string, Uint8Array>, path: string): string {
  const data = files.get(path);
  if (data === undefined) throw new Error(`Kubernetes icon ${path} was not loaded.`);
  return strFromU8(data);
}

function cleanKubernetesSvg(source: string, icon: KubernetesIcon): string {
  try {
    return serializeSvg(cleanArtwork(source, icon.slug));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Kubernetes icon ${icon.path}: ${reason}`, { cause: error });
  }
}
