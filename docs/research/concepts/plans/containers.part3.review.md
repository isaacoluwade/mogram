# Containers part 3: review summary

Verdicts (29 plans): Keep 5, Improved 24, Rethought 0, Merged 0.
Keep: k8s-probes, k8s-rbac, k8s-custom-resources, k8s-service-mesh, k8s-kubeconfig.

## Most important changes

- k8s-pod-security-standards: baseline blocks privileged containers (plan had it letting them through); added Deployment-accepted-but-pods-refused gotcha.
- k8s-ha-control-plane: the moment claimed three members survive two failures; both three and four lose quorum at two. Lease failover is not instant.
- k8s-pod-disruption-budget: scale-down and rollouts don't use the Eviction API; PDB gates requested evictions only.
- k8s-ephemeral-debug-containers: ephemeral containers can't be removed (linger Terminated); node debug creates a Pod.
- k8s-extension-interfaces: the runtime, not the kubelet, calls CNI.
- k8s-graceful-termination: preStop runs before SIGTERM and counts against the grace period.
- k8s-etcd-backup-restore: `etcdutl snapshot restore`; scenario takes the disks too; snapshots hold Secrets.
- k8s-cluster-upgrade: removed invented "Ingress removed in 1.36"; k8s-kubeadm: CA 10 years, leaf certs 1 year; k8s-managed-kubernetes: node upgrades are auto on GKE, configurable on AKS.
- Smaller fixes: drain flags, default ServiceAccount has no rights, admission blast radius limited to matched requests (CEL as no-outage contrast), operator vs chart contrast, `--previous` log semantics.

## Patterns for the platform

- Gate row with ✓/✗ stamps recurs in nearly every security plan (authn/authz/admission, PSA modes, image policy, PDB shield): one reusable "gate" component with per-gate outcomes and mode variants.
- Side-by-side with a shared replayed input (same request, pod spec or failure into two configurations) is the dominant moment.
- Toggle ladders (securityContext, multi-tenancy rungs, image policy checks) need switches that map to specific blocked attacker actions.
- Quorum/meter bars with clickable failures (etcd), timers for TTLs/leases/certs/grace periods, swappable cartridges (CRI/CNI/CSI), and a pluggable "version ladder".
