# Containers part 1: stage-3 review

34 plans reviewed: 29 Improved, 5 Keep, 0 Rethought, 0 Merged. Most "Improved" edits fix a factual claim; the story shapes mostly held up.

## Most important changes

- `container-tags-vs-digests`: `latest` defaults to `imagePullPolicy: Always`, so the original trap could not happen. Rebuilt around a re-pushed `1.4` tag (default `IfNotPresent`).
- `k8s-deployment`: a ReplicaSet never reverts hand-edited pods (it matches by selector, not template). Reframed: hand edits don't propagate and vanish at the next rollout.
- `k8s-rolling-update-rollback`: `rollout undo` reuses the kept ReplicaSet and does not create one; readiness gating needs `maxUnavailable: 0` (default is 25%/25%).
- `k8s-ownership-deletion`: default (background) delete removes the owner at once; the `deletionTimestamp` and dashed owner apply only to foreground deletion or finalizers. Story split into cascade and finalizer hang.
- `k8s-api-server-etcd`: Raft commits on a majority, and losing quorum freezes the control plane but running pods keep serving.
- `k8s-cluster-architecture`: added the controller-manager step (Deployment to ReplicaSet to Pod objects) before scheduling.
- `k8s-reconciliation-loop`: no new "ReplicaSet controller instance"; the Deployment controller writes a ReplicaSet object.
- `container-dockerfile`: ENTRYPOINT can be overridden (`--entrypoint`); the contrast is now arguments replace CMD.
- `container-isolation-hardening`: two attacks (privilege abuse vs kernel bug) so hardening is shown not to stop kernel exploits.
- `container-multi-stage-build`: Alpine is ~8 MB, not 120 MB; argued from shell and package manager, not size.
- `k8s-jobs-cronjobs`: finished pods remain as Completed until TTL or cleanup.
- `k8s-daemonset`: `kubectl drain` does not evict DaemonSet pods; uses node removal instead.
- `k8s-namespaces`: "permission boundary" overclaimed; a namespace is a naming scope that RBAC, quotas and NetworkPolicy attach to.
- Smaller fixes: tmpfs lifetime, Compose restart policies, orchestrator "least load" claim, scheduler Pending ending, kubelet timing numbers (Lease ~10s, NotReady ~50s, 300s toleration), whiteout layers, CrashLoopBackOff as a Waiting reason, native sidecar stop, StatefulSet at-most-one behaviour.

## Patterns for the platform

- Two-state "same action, different outcome" side-by-sides (delete with or without a volume, same request before and after a NetworkPolicy, same edit with two Dockerfile orders) carry most of the moments; the platform needs a cheap A/B scene with a shared trigger.
- Timers with real numbers (boot time, backoff doubling, heartbeat/grace/toleration chain, progress deadline) recur; they need a labelled, scrubbable timeline.
- Selector/label arrows that recompute live when a label changes (Service, ReplicaSet, NetworkPolicy, canary split) are used by many plans; matching should be real logic, not hand-drawn.
- Ownership trees and controller relays (Deployment, ReplicaSet, Pod, finalizers) need hierarchical objects whose children react to a parent's deletion or template change.
- Counters and fill meters (replicas, completions, backoff, size, quota, requested vs actual) with an amber gap highlight on mismatch.
- Failure injection by click (kill a pod, host, node network, etcd replica, kernel) with an immediate visible consequence.
- Many plans quote real flags and field names; a small "what field/command maps here" overlay (command/args, maxSurge, RuntimeClass) would serve them all.
- Several plans run long (StatefulSet, Dockerfile, Sidecar); the build should allow optional "extra" beats behind a click.
