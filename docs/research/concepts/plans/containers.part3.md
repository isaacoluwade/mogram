# Containers plans, part 3

Stage 2 plans for `catalog/containers.md` groups 3.9–3.14, in catalog order. These use the shared
Kubernetes visual language set for the whole area: an image is a stack of thin layers; a
container is a running box with a small play glyph; a node is a large frame (a machine) holding
pods, with CPU and memory bars; a pod is a rounded capsule holding one or two containers and its
own IP; the control plane is a separate frame at the top (API server in the centre, etcd as a
cylinder, the scheduler and controllers around it); desired state is a YAML card on the left,
actual state the cluster on the right, a reconciliation loop arrow between them highlighting
differences in amber; a Service is a stable badge in front of pods with arrows to matching pods;
requests are dots; a request to the API server passes through a row of gates (authentication,
authorization/RBAC, admission) that each tick ✓ or stamp ✗; identities are small badge cards. No
new technique was needed for this part; everything below uses the existing vocabulary.

## Health, disruption and maintenance

### Liveness, readiness and startup probes (`k8s-probes`)

**The aha**: Liveness asks "is it stuck?" and restarts the container; readiness asks "can it take traffic right now?" and only reroutes traffic — two different questions with two different actions.
**Misconception to defeat**: That liveness and readiness are the same check under different names.
**Cast**: A pod capsule with one container, a heart icon (liveness) and a traffic-light icon (readiness) on its wall. A Service badge in front with arrows to matching pods. A probe pulse from the kubelet into the container.
**Opening frame**: Pod healthy, heart and traffic-light both green, Service arrow solid into it.
**Story**:

1. kubelet pings the heart — tick. _"Is it stuck?"_
2. kubelet pings the traffic light — tick. _"Can it serve traffic right now?"_
3. The app enters a long GC pause. Readiness fails (traffic light stamps ✗); the Service arrow to this pod disappears and thickens toward a sibling pod. The heart stays green. _"Readiness fail: pulled from the Service only."_
4. The app actually hangs. The heart fails; the pod flashes red and the container restarts (play glyph off, then on). _"Liveness fail: restarted."_
5. Contrast: a liveness probe pointed at a shared database. The database blips; every pod's heart fails at once; all restart together in a storm. _"Point liveness at yourself, not a dependency."_
6. A startup probe is added: during a slow boot, both other probes are suppressed (greyed) until it ticks once. _"Startup probe holds off the other two."_
   **The moment**: Beats 3 and 4 side by side: the same pod, one failure pulls traffic while the pod keeps running, the other restarts the pod — two red checks, two different actions.
   **Interaction**: Choose which probe fails and watch which action fires. A dial for the liveness target (self vs. shared dependency) triggers the restart storm.
   **Ending**: Holds on the readiness-fails/traffic-rerouted frame beside the liveness-fails/restarted frame.
   **Variants**: `k8s-graceful-termination`, `k8s-pod-disruption-budget`, `k8s-pod-failure-states`.
   **Techniques**: restyle, token, failure, side by side, spotlight, caption.
   **Review**: Keep — the side-by-side of two red checks with two different actions is the sharpest framing; claims match the catalog (readiness drops the Pod from EndpointSlices, liveness restarts, startup gates both).

### Graceful Pod termination (`k8s-graceful-termination`)

**The aha**: Endpoint removal and SIGTERM fire at the same instant, so the app has to keep serving in-flight work for a moment, not stop immediately.
**Misconception to defeat**: That Kubernetes waits for traffic to drain before sending SIGTERM.
**Cast**: A pod capsule with a container, a Service badge with an arrow into it, a 0–30s grace-period timer below, a SIGTERM bolt and a SIGKILL bolt.
**Opening frame**: Pod serving, Service arrow solid, timer at rest.
**Story**:

1. `kubectl delete pod` fires two things in the same beat: the Service arrow detaches and a SIGTERM bolt hits the container. _"Both at once."_
2. The timer starts at 30s. The container keeps serving what's already in flight, and a late request from a stale route may still arrive. _"Keep serving what's in flight."_
3. Replay with a preStop hook (`sleep 5`, a small spinning gear). It runs first, SIGTERM waits, and the detach finishes during the pause, so by SIGTERM no new traffic arrives. The timer shows the sleep counted against the 30s. _"preStop runs first, and eats grace time."_
4. The container exits cleanly before the timer runs out; the pod disappears. _"Clean exit: done."_
5. Contrast: the entrypoint is wrapped in a shell. The SIGTERM bolt stops at a box labelled `sh -c` and never reaches the app process inside. The timer runs out and SIGKILL fires, killing it hard. _"Wrapped in a shell, SIGTERM may never arrive."_
   **The moment**: Beat 1, the simultaneous detach-and-SIGTERM, which breaks the "it drains first" assumption.
   **Interaction**: Add or remove a preStop delay and watch how much of the grace period gets used. Toggle direct entrypoint vs. shell-wrapped and see whether SIGTERM reaches the app.
   **Ending**: Clean exit before the timer, grace period unused, beside the shell-wrapped case ending in SIGKILL.
   **Variants**: `k8s-probes`, `k8s-pod-disruption-budget`, `k8s-cordon-drain`.
   **Techniques**: token, timer, restyle, failure, side by side, caption.
   **Review**: Improved — beat 3 had preStop after SIGTERM; it runs before it and counts against terminationGracePeriodSeconds (now shown); tightened beat 2 to include late requests from stale routes.

### PodDisruptionBudget (`k8s-pod-disruption-budget`)

**The aha**: A PDB limits how many pods a _requested eviction_ (node drain, autoscaler scale-down, upgrade) may remove at once; it does nothing against a crash, a direct `kubectl delete pod`, or a Deployment rollout.
**Misconception to defeat**: That a PDB protects the app from any kind of pod loss.
**Cast**: Three pods behind one Service badge, labelled "minAvailable: 2". A shield over the group labelled "PDB". Eviction requests arrive as tokens.
**Opening frame**: Three pods, all ready, shield reading "2 of 3 must stay up."
**Story**:

1. An eviction token arrives for pod 1. The shield checks: 3 ready, evicting 1 leaves 2 — tick ✓, pod 1 is evicted, a replacement clones onto another node. _"Planned disruption, budget respected."_
2. A second eviction arrives for pod 2 before the replacement is ready. The shield checks: only 2 ready, evicting would drop to 1 — stamp ✗, the token bounces. _"Blocks once it would break the budget."_
3. Contrast: a node loses power and pod 3 just dies, and `kubectl delete pod` on another walks straight past the shield. No eviction token, no check. _"Crashes and direct deletes bypass the PDB."_
4. A PDB set to `minAvailable: 3` of 3: every eviction token bounces forever, and a drain operation hangs mid-list. _"Too strict: no planned maintenance can ever proceed."_
   **The moment**: Beat 3, the shield sitting dark and unconsulted while a pod dies anyway, proving it only gates requested evictions.
   **Interaction**: Set `minAvailable`/`maxUnavailable`, then trigger either a drain (eviction storm) or a random crash, and see which one the shield stops.
   **Ending**: Holds on the dark, bypassed shield beside the active, blocking shield.
   **Variants**: `k8s-cordon-drain`, `k8s-graceful-termination`, `k8s-priority-preemption`.
   **Techniques**: token, failure, restyle, clone, spotlight, caption.
   **Review**: Improved — removed "scale-down" as a generic PDB case (a Deployment scale-down or rollout does not use the Eviction API, so the PDB is not consulted); added direct delete to the bypass beat.

### Cordon and drain (`k8s-cordon-drain`)

**The aha**: Draining a node is cordon (no new pods land) plus eviction of the pods already there, honouring PDBs and leaving DaemonSet pods alone, so replicas elsewhere keep the app up.
**Misconception to defeat**: That drain just deletes the node's pods.
**Cast**: A node frame with three regular pods and one DaemonSet pod (a small node-badge icon). A scheduler eye above showing whether it can see the node.
**Opening frame**: Node healthy, four pods inside, scheduler eye open on it.
**Story**:

1. `kubectl cordon node-1`: an "Unschedulable" barrier appears around the node; the scheduler eye closes on it, but existing pods are untouched. _"Cordon: no new pods land here."_
2. `kubectl drain node-1 --ignore-daemonsets --delete-emptydir-data` (drain cordons by itself): each regular pod gets an eviction token one at a time, checked against its PDB shield; it shuts down gracefully and its ReplicaSet creates a replacement on another node. _"Drain evicts, respecting PodDisruptionBudgets."_
3. The DaemonSet pod is skipped, dimmed, "DaemonSet: stays" (without the flag, drain refuses to run at all). _"DaemonSet pods aren't evicted."_
4. The node, now empty of regular pods, is patched (a wrench flashes over it); `kubectl uncordon` removes the barrier and the scheduler eye reopens. _"Back in service."_
   **The moment**: Beat 3, the DaemonSet pod sitting untouched while its neighbours are evicted one by one, showing drain isn't "clear the node."
   **Interaction**: Step through cordon, drain, patch, uncordon; or compare with a bare pod that has no controller (evicted and not replaced), or with deleting the node outright (no graceful handoff).
   **Ending**: Node uncordoned, pods back at their old density elsewhere, nothing lost.
   **Variants**: `k8s-pod-disruption-budget`, `k8s-taints-tolerations`, `k8s-cluster-upgrade`.
   **Techniques**: boundary, token, restyle, clone, spotlight, caption.
   **Review**: Improved — real drain flags (--ignore-daemonsets, --delete-emptydir-data), replacement comes from the controller not from a clone, bare-pod caveat added.

## Security

### API request path (`k8s-api-access-control`)

**The aha**: Every write to the API server passes the same gates in the same order — authentication, authorization, admission — before it is stored in etcd (reads stop after authorization).
**Misconception to defeat**: That "RBAC" alone decides whether a request succeeds.
**Cast**: The control plane frame at top; the API server in the centre with three gates leading into it — Authn, Authz (RBAC), Admission — each a turnstile that stamps ✓ or ✗; the etcd cylinder behind them. A request dot carries a small identity badge.
**Opening frame**: Three gates in a row, idle, etcd quiet behind them.
**Story**:

1. A dot (carrying a client-cert badge) reaches gate 1, which reads the badge and ticks ✓. _"Authn: who are you?"_
2. The dot reaches gate 2, which checks RBAC rules against that identity and ticks ✓. _"Authz: are you allowed?"_
3. The dot reaches gate 3: a mutating stage stamps a label onto the object, the schema is checked, then a validating stage ticks ✓. _"Admission: mutate, validate."_
4. The dot drops into etcd, which glows briefly. _"Only now is it stored."_
5. Contrast: a dot with no valid badge is stamped ✗ at gate 1 (401) and bounces before gates 2 or 3. _"Not authenticated: stopped at gate 1."_
6. Second contrast: a dot with a valid identity but no RBAC permission passes gate 1, then is stamped ✗ at gate 2 (403). _"Authenticated isn't authorized."_
   **The moment**: Beats 5 and 6 side by side, two different failures stopping at two different gates, showing the gates are distinct checks in a fixed order.
   **Interaction**: Swap the dot's badge (valid cert, no cert, valid cert with no RBAC role) and watch where it stops.
   **Ending**: A clean dot sailing through all three gates into etcd, with the failed dots frozen at their gates beside it.
   **Variants**: `k8s-rbac`, `k8s-admission-control`, `k8s-service-accounts`.
   **Techniques**: token, exchange, restyle, spotlight, side by side, caption.
   **Review**: Improved — admission and schema validation sit between authz and etcd and apply to writes only (reads skip them); added the 401 vs 403 distinction to the two failure beats.

### Role-based access control (RBAC) (`k8s-rbac`)

**The aha**: A Role says what's allowed; a RoleBinding says who gets it and where — and permissions only ever add up, never subtract.
**Misconception to defeat**: That Kubernetes has deny rules, or that a ClusterRole always grants cluster-wide access.
**Cast**: Two namespace boundaries, "team-a" and "team-b". A Role card inside team-a ("get, list pods"). A ClusterRole card floating above both namespaces. Identity badges for a user and a ServiceAccount. Dashed binding lines.
**Opening frame**: The Role card sits alone in team-a, unbound, greyed.
**Story**:

1. A RoleBinding line is drawn from "Alice" to the Role card, inside team-a only; Alice's badge glows. _"A binding grants the role, here."_
2. Alice's dot requests "list pods" in team-a — passes. _"Allowed, in team-a."_
3. Alice's dot requests the same in team-b — bounces, no binding there. _"The same Role, bound once, works once."_
4. The ClusterRole card is bound with a RoleBinding inside team-a only; it glows, but team-b stays dark. _"A ClusterRole bound with a RoleBinding is still local."_
5. The same ClusterRole bound with a ClusterRoleBinding: both namespaces glow at once. _"Only a ClusterRoleBinding goes cluster-wide."_
6. A second Role grants Alice "delete pods"; her permission set visibly grows. A "deny delete" card is dragged in and bounces off. _"Permissions only add."_
   **The moment**: Beat 4 vs. 5, the same ClusterRole card bound two different ways, lighting one namespace or both.
   **Interaction**: Drag bindings onto role cards and watch which namespaces light up; try adding a deny rule and see it rejected.
   **Ending**: Alice's badge with two green chips, bound only within team-a.
   **Variants**: `k8s-api-access-control`, `k8s-service-accounts`, `k8s-namespaces`.
   **Techniques**: boundary, move, restyle, token, failure, caption.
   **Review**: Keep — the same ClusterRole lighting one namespace or two is the clearest way to separate role from binding; additive-only and no deny are correct.

### ServiceAccounts (`k8s-service-accounts`)

**The aha**: A Pod calls the API using its own workload identity, not a person's — give each app its own ServiceAccount with the least it needs.
**Misconception to defeat**: That a ServiceAccount is a kind of user account, or that every pod needs API access.
**Cast**: A pod capsule with a "default" badge projected inside it (a mounted token). A user badge "Alice" off to the side. The API-server gates from `k8s-api-access-control`.
**Opening frame**: Pod with the "default" ServiceAccount badge auto-mounted inside.
**Story**:

1. The container calls the API server with its mounted token (a short-lived, audience-bound JWT the kubelet keeps refreshing); it authenticates as `system:serviceaccount:ns:default`. _"Pods authenticate as ServiceAccounts, not as you."_
2. Contrast: Alice's badge, used from her laptop, is a different, human identity entirely at the same gates. _"A ServiceAccount isn't a user account."_
3. A dedicated "payments-sa" is created and swapped into the pod; a RoleBinding grants it only get on the secret `payments-key`. The shared default account (no rights of its own, but common to every pod in the namespace) goes unused. _"Give each app its own identity and minimum rights."_
4. A second pod that never calls the API has `automountServiceAccountToken: false` set; its badge slot stays empty. _"No API calls? Don't mount a token at all."_
   **The moment**: Beat 2, the human badge and the pod's mounted badge side by side at the same gates, visually similar but clearly different kinds of identity.
   **Interaction**: Swap a pod's ServiceAccount and watch its RBAC chips change; toggle automount off and see the token slot stay empty.
   **Ending**: A lean pod with a scoped "payments-sa" badge and exactly one permission chip.
   **Variants**: `k8s-rbac`, `k8s-workload-identity`, `k8s-api-access-control`.
   **Techniques**: token, restyle, side by side, appear / disappear, caption.
   **Review**: Improved — the default ServiceAccount has no permissions by default (it was drawn "wide-open"); the real risk is that everything is shared; token shown as short-lived and audience-bound.

### Workload identity federation for Pods (`k8s-workload-identity`)

**The aha**: A Pod trades its own cluster-issued token for short-lived cloud credentials, because the cloud's IAM already trusts the cluster as a token issuer — no cloud keys ever sit in a Secret.
**Misconception to defeat**: That cloud access means a Secret holding a cloud access key.
**Cast**: A pod with a ServiceAccount badge (an OIDC JWT). A cluster boundary. Outside it, a cloud IAM frame with a trust arrow pointing into the cluster, labelled "trusts this issuer." A locked chest, "cloud credentials," inside the cloud frame.
**Opening frame**: Pod badge inside the cluster; cloud IAM frame outside, trust arrow already drawn, chest locked.
**Story**:

1. Contrast opening: an old-style Secret card, "AWS_SECRET_KEY," sits in the pod, crossed out. _"The old way: a long-lived key in a Secret."_
2. The pod presents a projected token minted for the cloud's audience (for example `sts.amazonaws.com`); the badge travels out to the cloud IAM frame. _"The Pod shows its own cluster-issued token."_
3. Cloud IAM checks the signature and subject against the trust arrow — tick ✓ — because it trusts this issuer for exactly this namespace and ServiceAccount. _"The cloud already trusts this cluster to vouch for this one identity."_
4. The chest opens briefly; a short-lived credential card, with a visible countdown, flies back into the pod. _"Temporary credentials, scoped to this one ServiceAccount."_
5. The timer runs out, the credential card fades, and the pod repeats the exchange for a fresh one. _"It expires and renews itself."_
   **The moment**: Beat 3, the trust arrow — drawn once, outside any single request — lighting up to validate the token, replacing a stored secret with a standing trust relationship.
   **Interaction**: Swap which ServiceAccount's token is shown and see it rejected where the trust arrow wasn't set up for it; let the timer run out and watch renewal.
   **Ending**: A pod holding only a ticking, short-lived credential card — no Secret in sight.
   **Variants**: `k8s-service-accounts`, `k8s-secret`, `k8s-rbac`.
   **Techniques**: token, timer, boundary, failure, restyle, caption.
   **Review**: Improved — token is audience-specific and the trust is scoped to a namespace/ServiceAccount subject, not the whole cluster; story otherwise sound across IRSA, Azure WI and GKE.

### securityContext (`k8s-security-context`)

**The aha**: A handful of settings strip away most of what an attacker who gets into the app could do — a container's defaults are permissive until you say otherwise.
**Misconception to defeat**: That securityContext and the Pod Security Standards are the same thing (one is the dial, the other is the check).
**Cast**: A container box with labelled toggles on its wall: `runAsNonRoot`, `readOnlyRootFilesystem`, `allowPrivilegeEscalation`, `capabilities: drop ALL`, `seccomp: RuntimeDefault`. A small red dot standing in for an attacker already inside via a compromised app.
**Opening frame**: All toggles off, container running as root, the attacker dot already inside.
**Story**:

1. Everything at defaults: the process runs as the image's user (often root), writes anywhere, keeps a default set of Linux capabilities, can use setuid, and has no syscall filter. The dot does all four. _"Defaults: mostly unrestricted."_
2. Toggle `runAsNonRoot` (with a non-root UID): the process runs as an unprivileged user, so the dot's root actions stamp ✗; a root-only image would refuse to start. _"Can't act as root to begin with."_
3. Toggle `readOnlyRootFilesystem` on: the write attempt bounces off a now-solid layer. _"Nothing to overwrite."_
4. Toggle "drop ALL capabilities": a reach for a kernel capability bounces. _"No special powers left to use."_
5. Toggle `allowPrivilegeEscalation: false` and the RuntimeDefault seccomp profile: a setuid attempt and a risky syscall both bounce. _"Escalation and dangerous syscalls blocked too."_
6. All five on: the dot is boxed in; every move bounces. _"Same breach, nowhere to go."_
   **The moment**: Beat 1 vs. beat 6 side by side — the identical breach, one toggled-off container giving the attacker the run of the box, the fully-toggled one containing it completely.
   **Interaction**: Flip each toggle individually and watch which specific attacker action it blocks.
   **Ending**: All toggles on, the attacker dot frozen with no legal move.
   **Variants**: `k8s-pod-security-standards`, `container-isolation-hardening`, `k8s-rbac`.
   **Techniques**: restyle, failure, side by side, spotlight, caption.
   **Review**: Improved — defaults described accurately (a default capability set, seccomp unconfined, not simply "everything"); runAsNonRoot shown as running unprivileged rather than blocking actions mid-flight.

### Pod Security Standards and Pod Security Admission (`k8s-pod-security-standards`)

**The aha**: Label a namespace with a profile, and every pod submitted to it is checked against that profile automatically, at the door.
**Misconception to defeat**: Confusing the Standards (the policy) with securityContext (the settings being policed).
**Cast**: A namespace boundary labelled `pod-security.kubernetes.io/enforce: restricted`. An admission gate at its edge. Incoming pod specs as cards showing their securityContext toggles.
**Opening frame**: Namespace labelled "restricted," gate quiet, no pods yet.
**Story**:

1. A pod card with `privileged: true` reaches the gate, is compared against the "restricted" rules, and stamps ✗, bounced. _"Checked before it's even created."_
2. The namespace's label is switched to "warn": the same card passes through (ghosted ✓) trailing a warning ribbon. _"Warn mode: lets it in, flags it."_
3. Switched to "audit": the card passes silently, but an entry appears in an audit log off to the side. _"Audit: a record, no warning shown to the user."_
4. Switched back to "enforce": the card bounces again. Three gates side by side (enforce/warn/audit) show the same bad pod producing three different outcomes. _"Same rule, three ways to apply it."_
5. Three namespaces — privileged, baseline, restricted — get the same four specs: a privileged container, a hostNetwork pod, a plain root-running pod, a hardened non-root pod. Privileged admits all four; baseline blocks the first two; restricted admits only the hardened one. _"Three profiles, loosest to hardened."_
6. A Deployment with the bad template is accepted (enforce checks Pods only), but its ReplicaSet is refused every pod and a FailedCreate event appears. _"Enforce acts on Pods, so watch events, or use warn first."_
   **The moment**: Beat 4, one bad pod and three gate modes producing three different outcomes side by side.
   **Interaction**: Set the namespace's mode and profile, then throw pod specs at the gate to see which get through, warned, or logged.
   **Ending**: The "restricted" namespace, gate solid, bad pod bounced, good pod admitted.
   **Variants**: `k8s-security-context`, `k8s-admission-control`, `k8s-namespaces`.
   **Techniques**: boundary, restyle, token, side by side, failure, caption.
   **Review**: Improved — baseline blocks privileged containers (the plan said it let them through); beat 5 now compares the three profiles with one set of specs; added the Deployment-accepted-but-pods-refused gotcha.

### Admission controllers, webhooks and admission policies (`k8s-admission-control`)

**The aha**: Admission is the last gate before etcd — it mutates requests first, then validates them, and it's where a cluster enforces its rules on every object coming in.
**Misconception to defeat**: That RBAC decides what an object may contain (it only decides who may act).
**Cast**: The admission gate zoomed in, split into two stages: Mutating, then Validating. Plug-ins attached: a built-in (LimitRanger), an external webhook (shield icon, "Kyverno"), and a CEL rule chip.
**Opening frame**: An object card approaching the gate, its two stages empty.
**Story**:

1. The card enters Mutating: LimitRanger stamps default resource requests onto it, visibly adding a field. _"Mutating: can change the object."_
2. The webhook also mutates it, injecting a sidecar container icon. _"Webhooks can rewrite objects too."_
3. The card enters Validating: the Kyverno shield checks a rule ("must have resource limits") — tick ✓, passes to etcd. _"Validating: can only accept or reject, not change."_
4. A second object fails the check, stamps ✗, bounced with a message. _"Reject if it doesn't meet policy."_
5. Contrast failure: the webhook goes offline (greyed, "down"). With `failurePolicy: Fail` (the default) every request it matches, here every Pod create, bounces, even good ones, and deployment cards pile up. The in-process CEL rule chip beside it keeps working, since it runs inside the API server. _"A dead webhook with Fail blocks everything it matches."_
   **The moment**: Beat 5, one broken plug-in freezing the entire gate for the whole cluster.
   **Interaction**: Take the webhook offline and watch the jam, switch `failurePolicy` to Ignore and watch objects pass unchecked, or swap the rule to a CEL policy and watch no outage at all.
   **Ending**: Webhook back online, the gate flowing normally, one bad object still correctly rejected.
   **Variants**: `k8s-api-access-control`, `k8s-pod-security-standards`, `k8s-image-policy`, `k8s-custom-resources`.
   **Techniques**: token, restyle, failure, spotlight, caption.
   **Review**: Improved — blast radius is the requests the webhook matches (not literally every object); added the CEL policy as the no-outage contrast, using the chip the cast already had.

### Image admission policies (`k8s-image-policy`)

**The aha**: Supply-chain controls only count if the cluster enforces them at the door — an unsigned or unapproved image is rejected before it ever reaches a node.
**Misconception to defeat**: That scanning an image in CI is the same as blocking it from running.
**Cast**: A CI pipeline producing an image (a layer stack) with a scan report attached ("no critical CVEs"). The admission gate at the cluster boundary checking: registry allow-list, no `:latest` tag, digest pin, a signature badge (Sigstore).
**Opening frame**: A scanned, "clean" image at the end of the CI pipeline, the cluster gate ahead still closed to it.
**Story**:

1. The clean image is deployed using `:latest`; the gate stamps ✗, "no floating tags," bounced despite the clean scan. _"A clean scan in CI doesn't mean the cluster will take it."_
2. Referenced by digest (`image@sha256:…`) from an approved registry: the registry check and digest check both tick. _"Approved registry, pinned digest."_
3. The gate fetches the image's signature from the registry and verifies it — none attached — stamp ✗, bounced. _"Unsigned, still rejected."_
4. The image is signed (a Sigstore/cosign badge attached to the layer stack) and resubmitted: all checks tick, the image is admitted. _"Signed and verified: now it runs."_
5. Contrast: an attacker pushes a malicious image to an unapproved registry; the gate's first check stamps ✗ immediately, never reaching the signature check at all. _"Blocked at the door, not after it's running."_
   **The moment**: Beat 1, a scan that passed in CI still bouncing at the cluster gate, separating "found in CI" from "enforced at admission."
   **Interaction**: Toggle each requirement (registry, tag, digest, signature) and watch which one stops a given image.
   **Ending**: A fully compliant image admitted; the CI-scanned, unsigned image still sitting rejected outside.
   **Variants**: `k8s-admission-control`, `container-tags-vs-digests`, `container-registry`.
   **Techniques**: token, restyle, failure, spotlight, caption.
   **Review**: Improved — a digest is referenced, not "re-tagged"; the gate (Kyverno, policy-controller, VAP) does the verification, which the beat now shows.

### Multi-tenancy (`k8s-multi-tenancy`)

**The aha**: A namespace alone isn't a tenant boundary — real isolation is a stack of controls, chosen by how much the tenants trust each other.
**Misconception to defeat**: That giving each team its own namespace is enough separation.
**Cast**: One cluster frame holding two namespace boundaries, "team-a" and "team-b." A ladder of controls beside it: namespace → RBAC → quota → NetworkPolicy → Pod Security → dedicated nodes → sandboxed runtime → separate cluster.
**Opening frame**: Only the namespace rung is lit; team-a and team-b sit in separate boundaries, otherwise bare.
**Story**:

1. Team-b's pod sends a request straight into team-a's namespace — it sails through unblocked. _"A namespace is a folder, not a wall."_
2. The RBAC rung lights: team-b's identity tries to read team-a's Secrets — bounced. _"RBAC stops people, not packets."_
3. The quota rung lights: team-b tries a tenth pod past its CPU quota — bounced. _"Quota caps the blast radius of noisy neighbours."_
4. The NetworkPolicy rung lights (the CNI must enforce it): the open request from beat 1 is replayed and now bounces at a drawn wall. _"Now the packets are actually stopped."_
5. The Pod Security rung lights: a privileged pod spec from team-b is rejected at the gate. _"And what each pod is allowed to do."_
6. For a hostile tenant, the ladder keeps climbing: a dedicated node pool, then a sandboxed runtime wrapping its containers, then a fully separate cluster frame. _"The less you trust them, the higher you climb."_
   **The moment**: Beat 1 vs. beat 4, the identical cross-namespace request, unblocked with namespaces alone, blocked once NetworkPolicy is added.
   **Interaction**: Turn ladder rungs on and off and replay the cross-tenant request and the privileged-pod attempt to see which rungs stop which attack.
   **Ending**: The full ladder lit for a low-trust tenant pair, both attempts blocked.
   **Variants**: `k8s-namespaces`, `k8s-rbac`, `k8s-resource-quotas`, `k8s-network-policy`, `k8s-pod-security-standards`, `k8s-taints-tolerations`, `container-isolation-hardening`.
   **Techniques**: boundary, token, failure, spotlight, side by side, caption.
   **Review**: Improved — noted that NetworkPolicy only works with a CNI that enforces it; beat 1 vs 4 contrast is the right centrepiece.

## Extending Kubernetes

### CRI, CNI and CSI plugins (`k8s-extension-interfaces`)

**The aha**: Kubernetes itself doesn't run containers, wire networks or attach disks — it calls out through three standard plugin contracts, which is how every vendor fits in without changing Kubernetes core.
**Misconception to defeat**: That Kubernetes has its own built-in runtime, network, or storage engine.
**Cast**: The kubelet in a node with CRI and CSI sockets, and a container runtime beneath it with a CNI socket. Swappable cartridges outside each: containerd/CRI-O for CRI; Calico/Cilium/cloud VPC for CNI; a cloud-disk or Ceph driver for CSI.
**Opening frame**: Kubelet and runtime with all three sockets empty, a pod waiting to start, dimmed.
**Story**:

1. A containerd cartridge plugs into CRI; the kubelet's call "start this container" fires, and the play glyph lights. _"CRI: how the kubelet runs containers."_
2. A Calico cartridge plugs into the runtime's CNI socket; while building the pod's sandbox the runtime calls "give this pod an IP", and the capsule gets its IP. _"CNI: how the pod gets networked."_
3. A cloud-disk cartridge plugs into CSI; the call "attach this volume" fires, and a disk docks onto the pod. _"CSI: how storage gets attached."_
4. The CRI cartridge is swapped from containerd to CRI-O mid-scene; the same socket call produces the same result. _"Swap the plug-in, keep the contract."_
5. The CNI cartridge is swapped from Calico to Cilium; the same "give this pod an IP" call succeeds, an eBPF badge flickering instead of iptables. _"Kubernetes doesn't care how, only that the contract is met."_
   **The moment**: Beat 4, cartridges swapped under an unchanged socket call, same result, making the plug-in boundary visible as the point where every cloud and vendor differs.
   **Interaction**: Swap each socket's cartridge and watch the same high-level action still succeed through a different implementation.
   **Ending**: All three sockets filled, the pod fully running, networked and storage-attached, three cartridge logos visible.
   **Variants**: `container-runtimes-oci`, `k8s-pod-networking`, `k8s-storage-class`, `k8s-custom-resources`.
   **Techniques**: token, restyle, exchange, spotlight, caption.
   **Review**: Improved — the container runtime, not the kubelet, calls the CNI plugin; cast and opening frame redrawn so the sockets sit where the calls really happen.

### Custom resources (CRDs) (`k8s-custom-resources`)

**The aha**: A CRD only teaches the API server a new kind of object — nothing happens until a controller actually watches it and acts.
**Misconception to defeat**: That defining a CRD makes something happen by itself, the way creating a built-in object does.
**Cast**: The API server with a shelf of built-in kinds (Pod, Deployment, Service) and an empty slot. A CRD card, "PostgresCluster," being slid onto the shelf. An object of that kind submitted afterward. An empty space where a controller would sit.
**Opening frame**: The built-in shelf full, the custom shelf empty.
**Story**:

1. The "PostgresCluster" CRD is installed: a new labelled slot appears, complete with schema validation and kubectl support, exactly like the built-ins. _"A CRD adds a new kind of object to the API."_
2. A user applies a `PostgresCluster` manifest; the object appears on the shelf, stored in etcd, status blank. _"It's stored... and nothing else happens."_
3. Several idle seconds pass, nothing moves. _"No controller watching it yet. Just data."_
4. A controller box appears, its watch locked onto PostgresCluster objects. It reads the spec and spawns Pods, a Service and a Secret one by one. _"Only a controller turns it into anything real."_
5. The reconciliation loop arrow appears between the spec and the real Pods it spawned, closing the gap. _"Same loop as every built-in controller."_
   **The moment**: Beat 3, the long static beat where a perfectly valid custom object sits inert, proving a CRD is schema, not behaviour.
   **Interaction**: Apply the CRD and the object without a controller attached, confirming nothing happens; then attach the controller to watch it spring to life.
   **Ending**: A running PostgresCluster with its generated Pods, Service and Secret, the reconciliation loop idling steadily.
   **Variants**: `k8s-operators`, `k8s-declarative-objects`, `k8s-reconciliation-loop`.
   **Techniques**: appear / disappear, contents, spotlight, token, caption.
   **Review**: Keep — the long inert beat is the right way to show schema without behaviour; claims match the catalog.

### Operator pattern (`k8s-operators`)

**The aha**: An operator is a custom controller plus CRDs that encodes an expert's runbook for one piece of software, running it through the same reconcile loop as the built-ins.
**Misconception to defeat**: That an operator is just a fancy Helm chart (a chart installs once; an operator keeps working).
**Cast**: A `PostgresCluster` desired-state card ("3 nodes · daily backup") on the left; three Postgres pods (actual state) on the right; the reconciliation loop arrow between them, with the operator sitting on it; a runbook checklist (provision, fail over, backup, upgrade) pinned to the operator.
**Opening frame**: The desired card and three matching pods already running, loop quiet.
**Story**:

1. The node holding `postgres-1` dies (red flash); actual state drops to 2 pods; the gap vs. desired highlights amber along the loop. _"The operator sees the gap, just like any controller."_
2. The operator consults its runbook ("failover" lights): it promotes `postgres-2` to primary and clones a new `postgres-3` replica. _"But it acts like a specialist, not a generic restart."_
3. A scheduled timer fires "daily backup"; the operator snapshots the data, a backup card appears off to the side. _"It also runs the parts of the runbook that aren't failures."_
4. A version bump on the desired card ("postgres 16 → 17") has the operator upgrade replicas one at a time, in a safe order. _"Upgrades follow the same expert order a human operator would use."_
5. Contrast inset: a Helm chart installed the same three pods once. Replay beat 1: a StatefulSet restarts the pod, but nobody promotes a replica, repoints clients or re-seeds it, so the database stays broken. _"A chart installs. An operator keeps working."_
   **The moment**: Beat 5, the same failure twice: the operator's loop heals it with Postgres-specific steps, while the chart's one-time install leaves the failover undone.
   **Interaction**: Trigger a node failure, a scheduled backup, or a version bump and watch the operator's runbook respond to each differently.
   **Ending**: Three Postgres pods, correct version, a fresh backup card, the loop calm.
   **Variants**: `k8s-custom-resources`, `k8s-reconciliation-loop`, `k8s-helm`.
   **Techniques**: contents, failure, clone, restyle, timer, side by side, caption.
   **Review**: Improved — the chart's pods would be restarted by built-in controllers, so "nothing happens" was wrong; the real gap is the expert steps (promotion, repointing).

## Packaging and service mesh

### Helm (`k8s-helm`)

**The aha**: One chart, filled in with different values, produces the YAML for many environments — and Helm remembers every install, so upgrade and rollback are single commands.
**Misconception to defeat**: Confusing a chart with a plain folder of YAML, or thinking Helm re-renders nothing after install.
**Cast**: A chart (template YAML with `{{ }}` placeholders) plus a values card. A rendered manifest stack that becomes running pods. A release history strip showing revisions 1, 2, 3…
**Opening frame**: Chart and values card side by side, unrendered, the revision strip empty.
**Story**:

1. `values.yaml` (replicas: 3, image: v1) merges into the chart's placeholders, filling them in live. _"Values fill in the template."_
2. `helm install` applies the rendered YAML; pods appear; the strip gains "Revision 1" (stored in the cluster as a Secret). _"Helm remembers what it installed."_
3. A second environment's values (replicas: 10, different host) swap in against the same chart, producing a differently sized pod set beside the first. _"Same chart, different environment."_
4. `helm upgrade` with `image: v2` rolls the pods over to v2; the strip gains "Revision 2." _"Upgrade renders and applies again."_
5. `helm rollback 1` re-applies revision 1's manifests; pods roll back to v1 as a normal rolling update, recorded as "Revision 3." _"Rollback: one command, tracked like any other change."_
   **The moment**: Beat 3, the identical chart producing two visibly different deployments from two values cards side by side.
   **Interaction**: Edit a values field and watch the rendered YAML and resulting pods change live; click along the revision strip to time-travel the cluster state.
   **Ending**: The revision strip with three entries, the cluster sitting on the rolled-back v1 state.
   **Variants**: `k8s-kustomize`, `k8s-operators`, `k8s-rolling-update-rollback`.
   **Techniques**: contents, clone, move, restyle, side by side, caption.
   **Review**: Improved — rollback is a new revision and a rolling update, not instant; revision storage made visible.

### Kustomize (`k8s-kustomize`)

**The aha**: Instead of templating, Kustomize layers real patches over a base of plain YAML, so dev, staging and prod share one base and each overlay holds only what differs.
**Misconception to defeat**: That Kustomize is "Helm without values" (it patches finished YAML; it doesn't fill in placeholders).
**Cast**: A base folder of plain manifests (real YAML, no placeholders). Three overlay folders beside it — dev, staging, prod — each a thin stack of patch cards.
**Opening frame**: The base manifests sit whole and valid on their own; three empty overlay folders beside them.
**Story**:

1. `kubectl apply -k overlays/dev`: the dev overlay's one patch card ("replicas: 1") lays over the base Deployment; only that field changes colour. _"A patch changes only what it names."_
2. Switch to staging: a larger patch stack (replicas: 3, an added label) lays over the same base, producing a visibly different blend. _"Different overlay, same base, different result."_
3. Switch to prod: a patch stack with an image-tag change and a ConfigMap generator (a gear producing a ConfigMap card whose name carries a content hash, so a config change rolls the pods). _"Generators create config from the overlay too."_
4. Final frame: the base in the middle, three resulting manifests fanned out around it, each overlay's patch cards highlighted. _"Only the overlays, and only what they contain, differ."_
   **The moment**: Beat 4, three real, deployable manifests fanned around one unchanged base, each overlay's tiny patch set highlighted.
   **Interaction**: Pick an overlay and watch exactly which lines of the base get patched, highlighted live.
   **Ending**: The three-overlay fan, base untouched in the centre.
   **Variants**: `k8s-helm`, `k8s-declarative-objects`.
   **Techniques**: contents, layers, restyle, side by side, spotlight, caption.
   **Review**: Improved — added the hashed generator name, the detail that makes config changes roll pods; plan otherwise right.

### Service mesh (`k8s-service-mesh`)

**The aha**: Features every service needs — mTLS, retries, timeouts, traffic splitting, telemetry — move out of each app's code and into a layer of proxies that intercepts every call, at the cost of extra moving parts and latency.
**Misconception to defeat**: Confusing a mesh (traffic between services, inside the cluster) with an API gateway (traffic entering from outside) or with NetworkPolicy (L3/L4 only, no retries or mTLS).
**Cast**: Two pods, each with a small proxy box attached beside its container (sidecar). A mesh control plane, distinct from the Kubernetes control plane, configuring both proxies. A call travels pod A → proxy A → proxy B → pod B.
**Opening frame**: Two plain pods calling each other directly, a bare arrow between them, no proxies yet.
**Story**:

1. Proxy boxes attach to both pods; the direct arrow is replaced by a path through both proxies. _"Every call now passes through proxies."_
2. The mesh control plane pushes "mTLS required": the in-between leg grows a lock icon; an unencrypted attempt from a rogue pod bounces off proxy B. _"Encryption and identity, without touching app code."_
3. A rule pushed, "retry on 503, timeout 2s": a call to pod B fails once (red flash); proxy A retries automatically, with pod A's code never knowing. _"Retries and timeouts live in the proxy."_
4. A traffic-split rule routes 90% of calls to pod B v1 and 10% to a new canary pod; the path visibly forks. _"Traffic splitting, for any service, free."_
5. Contrast: a NetworkPolicy boundary drawn around the same two pods would let the raw packets through (right port, right pods) but has no view of the retries, mTLS or split happening one layer up. _"NetworkPolicy sees packets, L3/L4. The mesh sees calls, L7."_
6. A latency meter ticks up slightly as every call now takes the longer proxy-to-proxy path. _"The cost: extra hops, every call."_
   **The moment**: Beat 5, the NetworkPolicy wall drawn around the same pods, oblivious to everything the mesh is doing.
   **Interaction**: Toggle mesh rules (mTLS, retry, split ratio) and watch the call path change; toggle a NetworkPolicy alongside to see it's unaffected either way.
   **Ending**: The full path — mTLS lock, retry loop, weighted split — with a small latency cost ticking beside it.
   **Variants**: `k8s-mesh-sidecar-vs-ambient`, `k8s-network-policy`, `k8s-ingress`, `k8s-sidecar-containers`.
   **Techniques**: token, exchange, boundary, meter, side by side, spotlight, caption.
   **Review**: Keep — the NetworkPolicy wall oblivious to L7 behaviour is the sharpest contrast; claims about mTLS, retries, splits and added latency are correct.

### Sidecar vs. ambient mesh (`k8s-mesh-sidecar-vs-ambient`)

**The aha**: A sidecar gives every pod its own full proxy; ambient mode shares one proxy per node for mTLS and adds L7 proxies only where needed — trading per-pod cost for shared infrastructure.
**Misconception to defeat**: Confusing ambient's per-node ztunnel with the native sidecar container feature from the workloads group — same word, unrelated mechanism.
**Cast**: Side by side. Left, "Sidecar mode": three pods, each with its own full proxy box. Right, "Ambient mode": the same three pods, bare, inside one node frame, with a single shared "ztunnel" proxy at the node's edge and an optional "waypoint" proxy per namespace.
**Opening frame**: Both sides with three pods each; left pods already carrying proxy boxes, right pods bare, ztunnel idle.
**Story**:

1. Left: a mesh upgrade rolls out; each of the three proxy boxes must restart in turn, and each pod restarts with it. _"Upgrading the mesh means restarting every pod."_
2. Right: the same upgrade restarts only the ztunnel (connections through it blip, so roll it node by node); the pods never move. _"Ambient: upgrade the shared proxy, pods untouched."_
3. Both sides get mTLS: left routes through each pod's own sidecar; right routes through ztunnel only. _"Both get mTLS by default."_
4. A need arises for header-based L7 routing in one namespace. Left already pays the L7 cost everywhere (sidecars do it all). Right grows a waypoint proxy, but only for that namespace. _"Ambient adds L7 cost only where you use it."_
5. Resource meters compared: left shows one proxy's cost multiplied by three pods; right shows one ztunnel's cost shared across three pods, plus one small waypoint. _"Pay per pod, or pay per node."_
   **The moment**: Beat 1 vs. 2, the three-pod restart storm on the left against the single untouched ztunnel on the right, from the same mesh upgrade.
   **Interaction**: Trigger a mesh upgrade and watch how many pods restart on each side; toggle whether L7 routing is needed in a namespace and watch the waypoint appear only there.
   **Ending**: Side-by-side resource meters, ambient's total lower, with the caption "fewer resources, more shared infrastructure to run."
   **Variants**: `k8s-service-mesh`, `k8s-sidecar-containers`.
   **Techniques**: side by side, restyle, failure, meter, spotlight, caption.
   **Review**: Improved — admitted the ztunnel upgrade is not free of blips; the restart-storm contrast stands.

## Cluster operations and managed Kubernetes

### Managed Kubernetes and node pools (`k8s-managed-kubernetes`)

**The aha**: The cloud provider runs and patches the control plane for you; you still own everything about the nodes — sizing, upgrades, and everything you deploy onto them.
**Misconception to defeat**: That "managed Kubernetes" means the whole cluster, nodes included, is someone else's problem.
**Cast**: The control plane frame, stamped "managed by AKS/EKS/GKE" and padlocked. Below it, node-pool frames ("pool: general," "pool: gpu"), fully open, holding nodes with your pods.
**Opening frame**: A padlocked control plane above, two open node pools below with pods inside.
**Story**:

1. A control-plane patch rolls out silently inside the padlocked frame, a "patched" tag flashing, nodes below completely undisturbed. _"The provider patches and backs up the control plane."_
2. An attempt to reach inside the control-plane frame directly bounces; the padlock stays shut. _"You can't see or touch it directly."_
3. Attention shifts to the node pools: "pool: general" is resized from 3 to 6 nodes, and its VM size, labels and taints are all edited, unlocked. _"Nodes, sizing, labels, taints: still yours."_
4. A node image patch ships. Who triggers it is your setting: on EKS and AKS you start the node-image upgrade (AKS can auto-upgrade on a channel), while GKE nodes auto-upgrade on a release channel unless pinned. Either way it rolls pool by pool through your pools and your PDBs. _"Node upgrades are yours to configure."_
5. A toggle switches to a fully-managed mode (Autopilot, Auto Mode): the node-pool frames become padlocked too, and you're left only with pods. _"Fully managed modes take the nodes too — for a cost and less control."_
   **The moment**: Beat 2 vs. beat 3, the same cluster, one half padlocked and silent, the other half fully open to your hands.
   **Interaction**: Toggle between standard managed mode and a fully-managed mode and watch the padlock boundary move to cover the nodes too.
   **Ending**: Holds on the boundary line between the padlocked control plane and the open node pools, labelled "provider / you."
   **Variants**: `k8s-cluster-architecture`, `k8s-cluster-autoscaler`, `k8s-karpenter`, `k8s-cluster-upgrade`.
   **Techniques**: boundary, restyle, spotlight, toggle, caption.
   **Review**: Improved — "nothing happens automatically" is wrong for GKE (and configurable on AKS); the point is that node upgrade policy is yours.

### kubeconfig and contexts (`k8s-kubeconfig`)

**The aha**: kubectl is only an API client — the current context picks which cluster and which identity a command actually hits, so switching contexts quietly changes where every command lands.
**Misconception to defeat**: That kubectl always talks to "the cluster you're working on," rather than whatever the current context points at.
**Cast**: A kubeconfig card with three stacked sections — clusters, users, contexts (pairings of a cluster, a user and a namespace). A kubectl terminal. Two cluster frames, "dev" and "prod" (prod drawn larger and redder).
**Opening frame**: The kubeconfig card with "dev-context" highlighted; the terminal idle.
**Story**:

1. `kubectl get pods` sends a token through the highlighted context into the "dev" frame, returning dev's pods. _"The current context decides where this goes."_
2. `kubectl config use-context prod-context`: the highlighted row slides from dev-context to prod-context; nothing else changes yet. _"One command switches the target silently."_
3. The same `kubectl get pods`, typed identically, now travels into the "prod" frame instead. _"Same command. Different cluster."_
4. A tense beat: `kubectl delete deployment payments`, typed without checking context, lands in "prod" (still selected) and a pod set there vanishes. _"The classic outage: right command, wrong context."_
5. Contrast fix: a visible context indicator, "[prod]" in red, is added to the prompt; the same delete command is caught before being typed. _"Always know which context you're in."_
   **The moment**: Beat 4, an identical, correctly-typed command producing a production outage purely because of an unseen context switch two beats earlier.
   **Interaction**: Switch context via a dropdown and watch identical commands land in different cluster frames; enable or disable the prompt indicator.
   **Ending**: The terminal prompt showing "[dev]" clearly, the context card highlighting dev-context, a safe state.
   **Variants**: `k8s-rbac`, `k8s-managed-kubernetes`.
   **Techniques**: token, move, restyle, spotlight, failure, caption.
   **Review**: Keep — an identical command causing a prod outage purely from context is the most memorable framing; accurate.

### Cluster upgrades and version skew (`k8s-cluster-upgrade`)

**The aha**: Upgrades move one minor version at a time, control plane first then nodes, and must stay within a version-skew window — upgrading is routine, scheduled work, not a leap.
**Misconception to defeat**: That you can jump several versions at once, or that nodes and control plane drift apart freely.
**Cast**: A version ladder (1.35 → 1.36 → 1.37). The control plane frame on one side, node frames on the other, each tagged with its current version. A skew-window bracket: "kubelet may lag the API server by up to 3 minor versions."
**Opening frame**: Control plane and all nodes sitting together at 1.35.
**Story**:

1. An attempt to jump the control plane straight from 1.35 to 1.37 is blocked, stamp ✗: "one minor version at a time." _"No skipping rungs."_
2. The control plane steps up to 1.36 first; nodes stay at 1.35. The skew bracket shows this gap is fine. _"Control plane upgrades first."_
3. Nodes follow, drained one at a time or replaced by surge nodes (your PDBs must allow it), climbing to 1.36 while the rest keep serving. _"Nodes follow, a few at a time."_
4. A manifest using an apiVersion the new release no longer serves (say an old `autoscaling/v2beta2` HPA) fails to apply. _"Removed APIs must be migrated first."_
5. The timeline zooms out: three upgrades a year marching up the ladder steadily. _"Kubernetes keeps moving — upgrades are routine, not rare."_
   **The moment**: Beat 1, the blocked two-rung jump, establishing the one-step-at-a-time rule before anything else happens.
   **Interaction**: Try to jump multiple rungs and get blocked; drain nodes one at a time and watch the skew bracket track the gap.
   **Ending**: Control plane and all nodes aligned at 1.36, the skew bracket back to zero.
   **Variants**: `k8s-cordon-drain`, `k8s-ha-control-plane`, `k8s-declarative-objects`.
   **Techniques**: lanes, move, restyle, failure, timer, caption.
   **Review**: Improved — dropped the invented "Ingress API removed in 1.36"; added surge replacement and the PDB dependency.

### Highly available control plane (`k8s-ha-control-plane`)

**The aha**: etcd needs a majority to accept writes, so odd numbers matter — three members survive one failure, five survive two, but four survives no more failures than three does.
**Misconception to defeat**: That adding more control-plane nodes always means more fault tolerance, or that extra API servers add to that tolerance.
**Cast**: Three etcd cylinders in a ring (a quorum group), three API server boxes behind a load balancer, a scheduler and a controller-manager each crowned "active" (leader election via a Lease).
**Opening frame**: Three etcd cylinders glowing together as one quorum, three API servers behind a shared load balancer, one scheduler crowned.
**Story**:

1. One etcd cylinder goes dark. The remaining two still form a majority (2 of 3); the quorum bar stays green, writes still accepted. _"Three survive one failure."_
2. A second cylinder goes dark; only 1 of 3 remains, the quorum bar turns red, writes stop entirely. _"Lose the majority, lose writes — whatever else survives."_
3. Reset to five cylinders. Two go dark; 3 of 5 remains a majority, the bar stays green. _"Five survive two failures."_
4. Contrast: four cylinders. Two go dark; exactly 2 of 4, no majority, the bar goes red — shown beside the three-member case from beat 1, which survived one failure at the same threshold. _"Four members: same tolerance as three, more overhead."_
5. An API server box goes dark; the load balancer routes around it, the quorum bar entirely unaffected. _"Extra API servers add capacity, not quorum."_
6. The crowned scheduler goes dark; its Lease runs out (about 15 seconds) and a standby acquires it and takes the crown. _"Leader election: one active, with a short gap on failover."_
   **The moment**: Beat 4, three and four members side by side: both survive one failure, both lose quorum at two, and the fourth member costs more without tolerating more (three needs 2 up, four needs 3).
   **Interaction**: Set the etcd member count (3, 4, 5) and click cylinders to fail them, watching exactly when the quorum bar flips red.
   **Ending**: A five-member quorum bar, two failed, still green.
   **Variants**: `k8s-api-server-etcd`, `k8s-etcd-backup-restore`, `k8s-cluster-upgrade`.
   **Techniques**: meter, failure, side by side, timer, restyle, caption.
   **Review**: Improved — the moment claimed three survives two failures (it does not); leader failover is not instant.

### etcd backup and restore (`k8s-etcd-backup-restore`)

**The aha**: An etcd snapshot captures every cluster object (desired state), but nothing inside your persistent volumes — those need their own backup.
**Misconception to defeat**: That backing up etcd backs up "the cluster," including your data.
**Cast**: The etcd cylinder holding visible object cards (Pods, Deployments, Secrets). A PersistentVolume disk holding real app data (a database's rows). A snapshot camera.
**Opening frame**: etcd full of object cards; the PV disk full of app data rows, both fine.
**Story**:

1. The camera flashes at etcd (`etcdctl snapshot save`); a snapshot file drops out, a copy of every object card, Secrets included. _"A snapshot captures every object."_
2. The cluster and its disks are wiped (a red wave over everything). _"Disaster: all gone."_
3. `etcdutl snapshot restore` rebuilds a new etcd; every object card reappears as of snapshot time and Pods reschedule onto new nodes. _"Restore rebuilds every object."_
4. The restored PVC objects come back, but their volumes are new and empty (or point at disks that no longer exist), so the database starts blank. _"The data in your volumes was never in this snapshot."_
5. A separate backup tool operates independently on the PV disk, on its own schedule. _"Volume data needs its own backup, separately."_
   **The moment**: Beat 4, a fully, perfectly restored cluster sitting next to an empty database.
   **Interaction**: Take a snapshot, wipe the cluster, and restore, watching objects reappear while toggling whether a volume backup was also taken.
   **Ending**: A restored cluster with all objects back, a reminder icon on the PV disk pointing to a separate, successfully-run volume backup.
   **Variants**: `k8s-ha-control-plane`, `k8s-persistent-volumes`, data's `backup-vs-replication`.
   **Techniques**: clone, failure, contents, spotlight, caption.
   **Review**: Improved — restore is now `etcdutl`, the scenario takes the disks too (otherwise the old PV might survive), snapshots flagged as holding Secrets.

### Bootstrapping a cluster with kubeadm (`k8s-kubeadm`)

**The aha**: The control plane is itself just Pods — static Pods the kubelet runs straight from files on disk — which is how Kubernetes hosts its own control plane.
**Misconception to defeat**: That the control plane is some special non-Pod process, separate from everything else Kubernetes runs.
**Cast**: A bare machine, no cluster yet. A folder of static Pod manifest files on its disk. A kubelet already running, watching that folder. A PKI certificate stack being generated. A second bare machine for `kubeadm join`.
**Opening frame**: A bare machine, kubelet running alone, the manifest folder empty, no API server yet.
**Story**:

1. `kubeadm init` runs preflight checks, a checklist ticking: swap off, ports free, container runtime present. _"Checks the machine is ready first."_
2. A PKI stack is generated: a cluster CA (valid 10 years) and leaf certificate cards stamped "valid 1 year." _"Creates the cluster's own certificate authority."_
3. Static Pod manifest files (apiserver, etcd, scheduler, controller-manager) drop into the watched folder; the already-running kubelet notices them immediately and starts each as an ordinary Pod. _"The control plane starts as Pods the kubelet runs from files on disk."_
4. The now-running API server is reachable; a kubeconfig is handed out for `kubectl`. _"Only now does the API exist to talk to."_
5. A second machine runs `kubeadm join` with a bootstrap token, connecting to the API server and registering its kubelet as a node. _"Join adds a node using a short-lived token."_
6. A year passes on a timer; the leaf certificates' tags flash amber (renewed by `kubeadm certs renew` or an upgrade); the CA's does not. _"Those certificates expire and must be renewed."_
   **The moment**: Beat 3, the control plane coming alive through the exact same "kubelet watches a manifest, starts a Pod" behaviour as everything else, with files literally dropping into a folder.
   **Interaction**: Step through init, watching each manifest file land and its Pod start; let the certificate timer run out to see the amber warning.
   **Ending**: The control plane running as four static Pods, one worker joined (NotReady until a CNI plugin is installed), certificates valid.
   **Variants**: `k8s-kubelet`, `k8s-managed-kubernetes`, `k8s-daemonset`.
   **Techniques**: appear / disappear, contents, timer, restyle, caption.
   **Review**: Improved — only leaf certificates last one year (the CA lasts ten); added that nodes stay NotReady until a CNI is installed.

## Troubleshooting

### Container logs and logging architecture (`k8s-container-logs`)

**The aha**: Logs live on the node and vanish with the Pod, so anything worth keeping has to be shipped off the node while it's still there.
**Misconception to defeat**: That `kubectl logs` is itself a durable, cluster-wide log store.
**Cast**: A pod on a node, writing a scrolling ribbon of text to stdout/stderr. The node writes this to a local log file. A DaemonSet log-agent pod on the same node, reading that file and streaming it to a distant log-backend cylinder.
**Opening frame**: The pod writing a scrolling ribbon; the node's disk holding a matching log file; a `kubectl logs` arrow able to read it directly.
**Story**:

1. The app writes "starting up... request handled... error: timeout"; the log file grows in lockstep. _"Containers write to stdout/stderr."_
2. `kubectl logs mypod` draws a line straight to that file and prints it. _"kubectl reads the file on the node, live."_
3. The container crashes and restarts; the kubelet keeps the dead instance's log, so `kubectl logs --previous` shows its last words while plain `kubectl logs` shows the new instance. _"`--previous` reads the last instance's log."_
4. The kubelet rotates logs by size (10Mi by default, five files kept); old chunks fade as new ones are written. _"Rotation drops old lines."_
5. The pod is deleted and rescheduled onto a different node; the original node's log file vanishes with it. _"Delete the Pod, and anything not shipped elsewhere is gone."_
6. Contrast fix: the DaemonSet log agent, present throughout, had been streaming every line to the distant backend, which still holds the full history after the pod is gone. _"Ship it off the node, or lose it."_
   **The moment**: Beat 5 vs. beat 6, the node's own copy vanishing completely while the backend cylinder, filled by the agent running quietly throughout, is fine.
   **Interaction**: Delete or reschedule the pod and watch whether logs survive, depending on whether the log-agent DaemonSet was toggled on.
   **Ending**: The backend cylinder holding full log history, the original node's file gone.
   **Variants**: `k8s-pod-failure-states`, `k8s-daemonset`.
   **Techniques**: stream, contents, failure, token, spotlight, caption.
   **Review**: Improved — `--previous` reads the dead container's own retained log, not a rotated copy; rotation defaults stated.

### Diagnosing Pod failure states (`k8s-pod-failure-states`)

**The aha**: Each stuck state points at a different layer of the system — scheduler, registry, app, limits, config or probes — and the clues to tell them apart are already in `kubectl describe` and `kubectl logs --previous`.
**Misconception to defeat**: Treating every "pod isn't working" as one undifferentiated problem to poke at randomly.
**Cast**: A decision path the viewer walks: a start node, "Pod not Running," branching to six named failure-state cards — Pending, ErrImagePull/ImagePullBackOff, CrashLoopBackOff, OOMKilled, CreateContainerConfigError, Running-but-not-Ready — each with its own small diorama of the cause.
**Opening frame**: One question at the top, "What does `kubectl get pods` show?", six paths fanning down, all dimmed but the start.
**Story**:

1. "Pending" lights: a pod floats with no node under it; `kubectl describe` events show "0/5 nodes available: insufficient memory." _"The scheduler couldn't place it."_
2. "ErrImagePull" lights: the image layer stack fails to download, a registry box stamps ✗ "unauthorized" or "manifest not found." _"Wrong name or tag, or missing registry credentials."_
3. "CrashLoopBackOff" lights: the container starts, exits, restarts, exits again, with a growing backoff timer between attempts. `kubectl logs --previous` is pulled up, revealing the app's last words before it died. _"The process keeps exiting — read what it said last time."_
4. "OOMKilled" lights: the container's memory bar hits its limit and it is killed instantly; `kubectl describe` shows "exit code 137." _"Over the memory limit, killed by the kernel."_
5. "CreateContainerConfigError" lights: the container's env refers to a ConfigMap key or Secret that doesn't exist; an empty slot sits where the value should be and no container starts. (A missing ConfigMap volume instead leaves it in ContainerCreating with a FailedMount event.) _"Missing config, not even a container yet."_
6. "Running but not Ready" lights: the play glyph is on, but the readiness probe keeps stamping ✗ and the Service arrow never attaches. _"It's running — it just can't serve yet."_
   **The moment**: Beat 3, plain `kubectl logs` showing the new attempt (empty, or "waiting to start") against `kubectl logs --previous` showing the crashed attempt's real error: the most load-bearing diagnostic habit here.
   **Interaction**: Pick a symptom from `kubectl get pods` and walk the decision path, with each branch revealing the specific `describe`/`logs` evidence that confirms it.
   **Ending**: All six paths lit at once as a reference map, each leading back to one layer of the system.
   **Variants**: `k8s-probes`, `k8s-pod-lifecycle`, `k8s-container-logs`, `k8s-requests-limits`, `k8s-configmap`.
   **Techniques**: choice, spotlight, restyle, timer, caption.
   **Review**: Improved — CreateContainerConfigError applies to env references, volumes behave differently; clarified what plain logs show during a crash loop.

### Ephemeral debug containers (`k8s-ephemeral-debug-containers`)

**The aha**: Instead of building debugging tools into every image, attach a temporary toolbox container to a live Pod only when you need one.
**Misconception to defeat**: That you can always `kubectl exec` into a container to debug it — minimal or distroless images have no shell to exec into.
**Cast**: A pod with one slim container, clearly labelled "no shell." A `kubectl exec` arrow bouncing off it. A toolbox icon labelled "kubectl debug" waiting outside.
**Opening frame**: The slim pod running fine, no shell inside, nothing attached.
**Story**:

1. `kubectl exec -it mypod -- sh` is tried; it bounces: `executable file not found in $PATH`. _"Minimal images have no shell on purpose."_
2. `kubectl debug mypod -it --image=busybox --target=app` attaches a new ephemeral container into the same pod, sharing its namespaces (a network ring drawn around both). _"A debug container shares the Pod's namespaces."_
3. From inside the toolbox, process and socket checks reach across to the app container, dashed lines crossing in because the process namespace is shared. _"It can even see the app's own processes."_
4. The toolbox exits and stays as a greyed "Terminated" chip in the pod's status; an ephemeral container can't be removed or restarted, only left. The app container is never restarted. _"Attach, look, leave: the image never changes."_
5. Contrast variant: `kubectl debug node/node-1` starts a privileged Pod on that node with the host filesystem at `/host`, docking onto the node frame. _"The same idea works for a whole node."_
   **The moment**: Beat 1 vs. beat 2, the exact same slim container: exec bouncing off with nothing to run, then a toolbox sitting right alongside it with full tools and visibility, the app pod never touched.
   **Interaction**: Try `exec` first (fails), then `debug` (succeeds); choose whether the debug container shares the process namespace to see into the app container or not.
   **Ending**: The toolbox greyed as Terminated, the app container's restart count still 0.
   **Variants**: `k8s-pod-failure-states`, `k8s-security-context`, `container-multi-stage-build`.
   **Techniques**: token, failure, boundary, appear / disappear, spotlight, caption.
   **Review**: Improved — ephemeral containers are never removed (they linger as Terminated), node debug creates a Pod, and the exec error text was wrong.
