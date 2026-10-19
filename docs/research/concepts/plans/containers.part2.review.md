# Containers part 2 review (3.5 to 3.8)

Verdicts (30 plans): Keep 8, Improved 22, Rethought 0, Merged 0.

## Most important changes

- Storage class: the Immediate-binding failure was wrong (a zonal PV makes the pod unschedulable, "volume node affinity conflict", rather than placing it in the wrong zone); rewritten as an elimination.
- Topology spread: the 4-1-1 anti-affinity contrast was impossible with two nodes per zone; zones are now uneven (4/1/1 nodes).
- NetworkPolicy: beats reordered (cross-namespace beat contradicted default-deny); added "allows only add up" and the podSelector-versus-namespaceSelector trap.
- KEDA: "alone can scale to zero" was stale (HPA scale-to-zero is beta in v1.37 for external/object metrics); CPU-HPA comparison fixed.
- PV/PVC: ReadWriteOnce violation is a Multi-Attach stall in ContainerCreating; added ReadWriteOncePod, Released PV, default Delete.
- QoS eviction: order is over-request, then priority, then excess; evicted pods are replaced by their owner, not moved.
- Cluster DNS: the pod's resolver expands names, not the kubelet. External secrets: CSI rotation and sync-as-Secret options acknowledged.
- Smaller fixes: memory limit kills the container (not pod); HPA ending count and scale-down window; preempted pods are replaced not requeued; CA drains rather than consolidates.

## Patterns for the platform

- The red-X elimination of candidates with a reason (scheduler filters, affinity, taints, volume zone, preemption) recurs in about a dozen plans: it needs a reusable "candidate list with reasons" tool.
- Live rosters/contents (EndpointSlices, quota, labels) that react to editing one field: bound selectors and label-edit interaction.
- Side-by-side with two configurations of one setting (binding mode, reclaim policy, env vs mount, CSI vs operator), driven by a toggle.
- Dials feeding computed formulas on screen (HPA ceil formula, maxSkew, ndots, priority).
- Timers and cool-downs (CA node boot, stabilisation windows, KEDA cool-down, config propagation delay).
- Node frames with CPU/memory bars and zone boundaries are the shared canvas; keep their geometry consistent across plans, and allow uneven nodes per zone.
