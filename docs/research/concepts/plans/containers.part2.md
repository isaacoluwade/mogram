# Containers plans, part 2

Stage 2 plans for `catalog/containers.md` groups 3.5 to 3.8, in catalog order. These use the
shared Kubernetes visual language: an image is a stack of thin layers; a container is a running
box with a small play glyph; a node is a large frame (a machine) holding pods, with CPU and
memory bars along its bottom edge; a pod is a rounded capsule holding one or two containers and
its own IP; the control plane is a separate frame at the top (API server in the centre, etcd as
a cylinder beside it, the scheduler and controllers around it); desired state is a YAML card on
the left, actual state the cluster on the right, a reconciliation loop arrow between them
highlighting differences in amber; a Service is a stable badge (with a fixed virtual IP) in
front of pods, with arrows to the pods whose label tags match; requests are dots; the scheduler
places a pod by trying each node and crossing out the ones that don't fit (red ✗ with the
reason: "not enough memory", "taint: gpu").

## 3.5 Service networking

### Pod networking model and CNI (`k8s-pod-networking`)

**The aha**: Every pod gets its own real IP it can use to reach any other pod on any node,
directly and without NAT — the CNI plugin is just the plumbing that makes that promise true
underneath.
**Misconception to defeat**: That pods talk through NAT like Docker's default bridge network, or
that how CNI works underneath is the main idea rather than the flat-network guarantee on top.
**Cast**: Two node frames, each holding two pod capsules with real IPs. Between them, a plumbing
layer labelled "CNI plugin" whose look can be swapped (overlay tunnel, routed, eBPF). A "no NAT"
stamp.
**Opening frame**: Two nodes, four pods, a straight dashed line already joining every pod to
every other pod regardless of node. _"Every pod, its own IP, reachable from anywhere."_
**Story**:

1. A pod on node A sends a packet straight to a pod IP on node B; it arrives unchanged, no
   address rewritten. _"No NAT: the sender's own IP arrives intact."_
2. Zoom into the plumbing layer and swap its look between overlay, routed and eBPF; the pod-to-
   pod line on top never changes. _"Kubernetes guarantees the line. The plugin decides what
   happens underneath."_
3. A new pod appears on node A; CNI hands it the next free IP from node A's slice of the
   cluster's address range. _"IPs come from a per-node slice of one cluster range."_
   **The moment**: Beat 2 — three different plumbing looks underneath one unchanged top-level line.
   The CNI choice is invisible to the pods it carries.
   **Interaction**: Toggle which CNI "look" runs underneath; only the plumbing animates, never the
   pod-to-pod line.
   **Ending**: Back to the opening frame, plumbing hidden again.
   **Variants**: `k8s-service`, `k8s-network-policy`, `k8s-cluster-dns`.
   **Techniques**: boundary, token, toggle, zoom, caption.
   **Review**: Keep — flat-network guarantee on top, swappable CNI underneath; the toggle makes the contrast unmistakable.

### Service (`k8s-service`)

**The aha**: A Service is a stable badge with its own fixed IP that always forwards to whichever
pods currently match its label — clients never track pods directly.
**Misconception to defeat**: That a Service is itself a load-balancer box traffic passes
through, like a reverse proxy sitting on the wire.
**Cast**: A node frame with three pod capsules labelled `app=web`, each with its own changing IP.
A Service badge in front, labelled `svc/web · 10.96.0.4:80`, arrows to the matching pods. A
client box on the left.
**Opening frame**: Client → badge (fixed IP) → arrows fanning to three pods, each a different
IP. _"One stable name and IP. Many changing pods behind it."_
**Story**:

1. A request token reaches the badge, then bends onward to one pod. _"Clients talk to the badge,
   never the pods."_
2. One pod crashes; its arrow vanishes instantly. A replacement appears with a new IP, and a new
   arrow grows to it automatically because its label still matches. _"Pods come and go. The
   badge's IP never changes."_
3. Edit a pod's label from `app=web` to `app=web-old`: its arrow from the badge snaps and
   disappears. _"Lose the label, lose the traffic — even running fine."_
   **The moment**: Beat 3 — poking the label, not the pod, is what drops it from the Service.
   **Interaction**: Edit a pod's label live and watch its arrow connect or disconnect; kill a pod
   and watch the badge's IP stay put while arrows rewire.
   **Ending**: Badge steady, three arrows settled on three relabelled, healthy pods.
   **Variants**: `k8s-service-types`, `k8s-labels-selectors`, `k8s-endpointslices`, `k8s-ingress`.
   **Techniques**: token, restyle, appear/disappear, spotlight, caption.
   **Review**: Keep — label-poke moment is sharp and correct; badge-not-proxy is set up by the kube-proxy plan.

### Service types: ClusterIP, NodePort, LoadBalancer, ExternalName (`k8s-service-types`)

**The aha**: ClusterIP, NodePort and LoadBalancer are nested doors, each wider than the last,
opening the same Service further outward; ExternalName isn't a door at all, just a signpost.
**Misconception to defeat**: Treating the four types as unrelated mechanisms, or thinking
LoadBalancer bypasses the other two.
**Cast**: Three concentric rings — cluster, node, internet — around a Service badge and its
pods. A separate card off to the side labelled ExternalName, just a signpost icon.
**Opening frame**: Badge inside the innermost ring only. _"ClusterIP: the default — inside the
cluster only."_
**Story**:

1. A client outside the outer ring bounces off nothing yet. _"Inside only."_
2. Switch to NodePort: a numbered door opens on every node's edge; an external token enters any
   node's door and travels inward to the same badge, ClusterIP still intact beneath it. _"One
   more door, on every node — the first door stays."_
3. Switch to LoadBalancer: a cloud load-balancer icon appears outside, pointing at the still-open
   NodePort doors. _"A front door from the cloud — built on NodePort, built on ClusterIP."_
4. Pull back to five separate LoadBalancer Services, each with its own cloud LB and its own cost
   tag. _"Each one gets its own — which is why HTTP apps share an Ingress instead."_
5. Beside it, the ExternalName card: no badge, no pods, just a signpost to a name outside the
   cluster. _"Not a door — a DNS alias."_
   **The moment**: Beat 3 — the rings nesting, LoadBalancer visibly sitting on NodePort sitting on
   ClusterIP, all three live at once.
   **Interaction**: Toggle through the four types and watch doors appear or disappear around the
   same badge; a cost meter per LoadBalancer Service.
   **Ending**: All four side by side, rings nested, signpost apart.
   **Variants**: `k8s-service`, `k8s-ingress`, `k8s-headless-service`.
   **Techniques**: boundary, appear/disappear, token, side by side, meter, caption.
   **Review**: Keep — nested rings are the truest picture; claims match the catalog.

### Headless Service (`k8s-headless-service`)

**The aha**: A headless Service skips the stable-IP badge and hands back the real list of pod
IPs, so the client — not kube-proxy — picks which one to talk to.
**Misconception to defeat**: That it's a broken Service, or the same thing as ExternalName.
**Cast**: Side by side. Left: ordinary Service badge, arrows fanning to three pods. Right: the
same three pods, no badge, a DNS bubble returning a bare list of three IPs directly.
**Opening frame**: Both sides with three identical pods; only the left has a badge. _"Same pods.
One has a stable front; one doesn't."_
**Story**:

1. Left: a lookup for `svc/web` returns one IP (the badge), load-balanced invisibly. _"Normal:
   the badge picks for you."_
2. Right: a lookup for `svc/db` (`clusterIP: None`) returns three real pod IPs directly.
   _"Headless: DNS hands you the actual list."_
3. With a StatefulSet underneath, each pod also gets its own name — `db-0.db`, `db-1.db`,
   `db-2.db` — and the client dials `db-0` specifically. _"Useful when the client must pick: a
   primary, a specific peer."_
   **The moment**: Beat 2 — the DNS bubble returning a flat list of real IPs exactly where the
   badge would have been.
   **Interaction**: Toggle `clusterIP: None` on and off and watch the badge appear or disappear and
   the DNS answer change shape.
   **Ending**: Left load-balanced, right addressed by name.
   **Variants**: `k8s-service`, `k8s-statefulset`, `k8s-cluster-dns`.
   **Techniques**: side by side, toggle, contents, caption.
   **Review**: Keep — side-by-side with the DNS answer changing shape is the cleanest contrast.

### EndpointSlices (`k8s-endpointslices`)

**The aha**: The Service badge is only ever a name — EndpointSlices are the live roster of which
pods are actually behind it right now.
**Misconception to defeat**: That a Service "contains" the pods, or that no traffic reaching it
must be a networking bug rather than an empty roster.
**Cast**: Service badge at top. Below it, a roster card listing each pod's IP with a status chip
(Ready / NotReady / Terminating).
**Opening frame**: Badge with three green rows below. _"The badge is a name. This list is who's
actually behind it."_
**Story**:

1. A pod's readiness probe fails; its row flips red (NotReady) and its arrow from the badge
   disappears, though the pod itself keeps running, dimmed. _"Not removed — just marked not
   ready."_ A pod being deleted shows the same way, as Terminating, before its row goes.
2. A new pod joins matching the label; the roster gains a row, an arrow grows. _"A controller
   keeps this list current, automatically."_
3. Someone changes the Service's selector to a label no pod has: the whole roster empties to
   zero, and tokens arrive at the badge and bounce, "connection refused". _"Service 'broken' —
   really, an empty roster."_
4. Fix the selector back: rows repopulate instantly.
   **The moment**: Beat 3 — the roster collapsing to zero while the badge stays unchanged, proving
   the real failure sits downstream of the badge.
   **Interaction**: Break the selector and watch the roster empty; toggle one pod's readiness and
   see its row flip without the pod disappearing.
   **Ending**: Full roster, all green, badge fully wired.
   **Variants**: `k8s-service`, `k8s-probes`, `k8s-labels-selectors`.
   **Techniques**: contents, restyle, appear/disappear, spotlight, caption.
   **Review**: Improved — empty roster now shows connection refused; added Terminating state to the roster story.

### kube-proxy and Service virtual IPs (`k8s-kube-proxy`)

**The aha**: A ClusterIP isn't a machine or a proxy traffic passes through — it exists only as
packet-rewriting rules kube-proxy writes onto every node, which is why you can't even ping it.
**Misconception to defeat**: Imagining a literal proxy process sitting in the network path.
**Cast**: A node frame holding a small rulebook icon ("iptables/nftables rules"), written by a
kube-proxy agent in the corner. A packet token addressed to the ClusterIP.
**Opening frame**: A packet at a pod, addressed to `10.96.0.4` — a label on the token, not a box
on the network. _"That address names nothing on the wire — yet."_
**Story**:

1. kube-proxy watches the Service and its EndpointSlice, then writes rules into the node's
   rulebook: `10.96.0.4:80 → one of 10.0.1.6 / 10.0.2.9 / 10.0.2.4`. _"It watches the API, then
   writes local rules."_
2. The packet leaves addressed to `10.96.0.4`; at the rulebook its destination is crossed out and
   relabelled before it ever leaves the node. _"Rewritten before it's sent — the ClusterIP never
   travels on the wire."_
3. Someone pings `10.96.0.4` directly: no reply. The rules match the Service's port and
   protocol, and ping (ICMP) carries no port, so nothing rewrites it. _"You can't ping it —
   nothing's there to answer."_
4. The same rulebook, identical, on every other node; scaling the Service updates every node's
   copy at once.
   **The moment**: Beat 2 — the address visibly crossed out and rewritten at the node's edge before
   leaving. The ClusterIP is a rule, not a place.
   **Interaction**: Send a ping (bounces) versus a real connection (rewritten and delivered) at the
   same address.
   **Ending**: Rulebook settled, packet delivered to the real pod IP.
   **Variants**: `k8s-service`, `k8s-endpointslices`, `k8s-pod-networking`. The rulebook can be
   iptables or nftables (IPVS mode is deprecated); an eBPF CNI such as Cilium can replace kube-proxy
   entirely.
   **Techniques**: contents, token, restyle, failure, caption.
   **Review**: Improved — rule now lists several backends; ping failure explained by port-matching rules; modes (iptables, nftables, IPVS deprecated, eBPF) noted.

### Cluster DNS (CoreDNS) (`k8s-cluster-dns`)

**The aha**: Finding a Service in Kubernetes is just DNS — the kubelet points every pod at
CoreDNS and gives it a search list, so the pod's own resolver expands a short name into the
full one.
**Misconception to defeat**: Thinking Service discovery is Kubernetes-specific magic, not plain
DNS; or not knowing why external lookups can feel slow.
**Cast**: A pod with a `resolv.conf` card showing a search list. CoreDNS as a small frame with
records.
**Opening frame**: A pod looks up just `my-svc`. _"Looks too short to be a real name."_
**Story**:

1. The search list lights up (`my-ns.svc.cluster.local` first) and the name becomes
   `my-svc.my-ns.svc.cluster.local`, succeeding on the first try. _"The search list fills in the
   rest."_
2. CoreDNS answers with the Service's ClusterIP. _"It just answers from the Service and
   EndpointSlice objects it watches."_ (Headless: the pod IPs instead.)
3. The pod looks up an external name: each search suffix is tried and fails first (a counter for
   `ndots:5`), each attempt burning a tick, before the bare name finally resolves. _"External
   lookups pay for every failed internal guess first."_
   **The moment**: Beat 3 — the timer visibly burning through failed attempts before the real
   external answer.
   **Interaction**: Dial `ndots` and watch how many failed attempts happen before an external name
   resolves.
   **Ending**: Successful resolution, search list visible, cost paid.
   **Variants**: `k8s-service`, `k8s-headless-service`.
   **Techniques**: token, timer, meter, exchange, caption.
   **Review**: Improved — fixed who expands names (the pod's resolver, not the kubelet); full name shown in beat 1.

### Ingress and Ingress controllers (`k8s-ingress`)

**The aha**: An Ingress object is a routing table on paper — nothing happens until a controller
reads it and proxies for real, after which many HTTP apps can share one entry point.
**Misconception to defeat**: Believing creating an Ingress object alone exposes anything, the
way a LoadBalancer Service does.
**Cast**: An Ingress YAML card with host/path rules. Two Service badges with pods behind them.
**Opening frame**: The Ingress card alone, rules legible, no traffic flowing. _"Rules on paper.
No one's reading them yet."_
**Story**:

1. An Ingress controller appears and a dashed line connects it to the card — watching, still
   nothing flows. _"Install a controller — now the rules mean something."_
2. A client requests `shop.example.com/`: it reaches the controller (itself exposed through one
   LoadBalancer Service, the single external IP), which reads the rule and forwards to
   `svc-shop`. _"One entry point, routed by the rules."_
3. The same client requests `/api`: the same controller sends it to `svc-api` instead, both paths
   sharing one external IP. _"Many services, one external IP."_
4. Contrast inset: without Ingress, each Service would need its own LoadBalancer — two external
   IPs, two cost tags — fading in, then crossed out.
   **The moment**: Beat 1 — the Ingress card sitting dead until the controller attaches; only then
   does traffic move.
   **Interaction**: Toggle the controller off and watch traffic strand despite the rules existing;
   add a path rule and watch it start routing immediately.
   **Ending**: Two paths, one entry point, controller doing the work; a small stamp: _"Ingress is
   frozen. New features go to Gateway API."_
   **Variants**: `k8s-service-types`, `k8s-gateway-api`. Controllers are interchangeable (NGINX,
   Traefik, HAProxy, cloud load balancers); the community ingress-nginx was retired in March 2026.
   **Techniques**: contents, token, appear/disappear, side by side, caption.
   **Review**: Improved — controller's own LoadBalancer is the one external IP; Ingress-frozen stamp and ingress-nginx retirement added.

### Gateway API (`k8s-gateway-api`)

**The aha**: Gateway API splits one controller's job into three roles — who provides the load
balancer, who owns its listeners, who owns one app's routing — so each team touches only its
own layer.
**Misconception to defeat**: Seeing it as just "Ingress v2" with nicer YAML, missing that the
role split is the point.
**Cast**: Three stacked, owner-tagged cards: GatewayClass (platform vendor), Gateway (cluster
ops, with listeners), two HTTPRoutes (app teams), each pointing at its own Service badge.
**Opening frame**: Three cards with owner tags, arrows linking down to two Services. _"Three
layers, three owners."_
**Story**:

1. The platform team swaps the GatewayClass implementation; the Gateway and routes above are
   untouched. _"Change the engine underneath — the routes don't notice."_
2. Cluster ops adds a TLS listener to the Gateway and says which namespaces may attach routes
   (`allowedRoutes`); the app teams' routes point at it with `parentRefs`. _"One shared door,
   opened once. The Gateway decides who may use it."_
3. The "shop" team edits only their own HTTPRoute to add a 90/10 traffic weight between two
   backends — no one else's object changes. _"Weighted canaries, built into the standard."_
4. Contrast inset: the same split attempted on plain Ingress, as a controller-specific annotation
   — crossed out, "not portable."
   **The moment**: Beat 3 — the weight split as plain, portable route fields, immediately
   contrasted with the annotation hack it replaces.
   **Interaction**: Drag the HTTPRoute's weight slider and watch the token split ratio change live
   between two backends.
   **Ending**: Three layers settled, each owner's card lit only when they're editing.
   **Variants**: `k8s-ingress`, `k8s-canary-blue-green`.
   **Techniques**: boundary, restyle, dial, side by side, spotlight, caption.
   **Review**: Improved — added allowedRoutes/parentRefs, the Gateway's say over who attaches, which is the heart of the role split.

### NetworkPolicy (`k8s-network-policy`)

**The aha**: Kubernetes starts fully open — the instant any NetworkPolicy selects a pod,
everything not explicitly allowed in that direction for that pod is now blocked.
**Misconception to defeat**: Thinking the cluster is closed until you open holes, like cloud
security groups, or that a policy can "deny" a specific pod (there are no deny rules).
**Cast**: Three pod capsules (frontend, backend, db) with faint arrows connecting every pair. A
NetworkPolicy card on the left.
**Opening frame**: Every pair connected by a thin arrow. _"Default: everyone talks to
everyone."_
**Story**:

1. A policy selects `db`, allowing only `app=backend`; every other arrow into `db` vanishes at
   once, only backend's remains, now bold. _"Select a pod, and its default flips to deny."_
2. `frontend` → `backend` is untouched — no policy selects backend yet — and so is a pod from
   another namespace reaching `backend`. _"Pods no policy selects are wide open. Namespaces
   aren't a wall by themselves."_
3. A default-deny policy selecting every pod in the namespace is added: the remaining arrows
   vanish, including the cross-namespace one.
4. Allows are added as separate policies: `frontend → backend`, and a `namespaceSelector` rule
   for a monitoring pod in another namespace (a `podSelector` alone only matches the policy's own
   namespace). Each brings its arrow back; none cancels another. _"Allows only add up. Default-deny,
   then allow exactly what's needed."_
   **The moment**: Beat 1 — the fan of open arrows into `db` collapsing to one, the moment a single
   policy selects it.
   **Interaction**: Add or remove policies and watch which arrows live or die; toggle "CNI enforces
   policy" to see the unenforced case leak traffic anyway.
   **Ending**: Default-deny baseline, explicit allows only.
   **Variants**: `k8s-pod-networking`, `k8s-service`, `k8s-namespaces`.
   **Techniques**: boundary, restyle, appear/disappear, spotlight, failure, caption.
   **Review**: Improved — reordered beats (cross-namespace case was contradictory after default-deny), showed that allows only add up, fixed the security-group misconception.

## 3.6 Configuration and storage

### ConfigMap (`k8s-configmap`)

**The aha**: A ConfigMap keeps settings out of the image, so the same image runs anywhere just
by swapping which ConfigMap it's handed — but mounted files update live while environment
variables freeze at pod start.
**Misconception to defeat**: Expecting env vars to update live too, or baking config into the
image "to be safe".
**Cast**: A ConfigMap card with key/value rows. Two pods consuming it two ways: one as env vars
stamped at start-up, one as a mounted file inside the capsule.
**Opening frame**: One ConfigMap, two consuming pods. _"Same config, two ways in."_
**Story**:

1. Pod A starts; its env vars are stamped once, like a tattoo, at creation. _"Baked in at
   start."_
2. Pod B mounts the ConfigMap as a file; the file icon shows the live content.
3. The ConfigMap is edited (`LOG_LEVEL: info → debug`). Pod B's mounted file updates after a
   short delay (a minute or so; the app must re-read it, and a `subPath` mount never updates).
   Pod A's env var tattoo stays "info", untouched, though it's still running.
   _"Mounted files catch up. Env vars don't — ever, until restart."_
4. Pod A restarts; only now does its env var read "debug".
   **The moment**: Beat 3 — the two consumption modes from the same edit, one updating, one frozen.
   **Interaction**: Edit a key and watch both consumers; restart the env-var pod to catch it up.
   **Ending**: Both pods on "debug", one by waiting, one by restart.
   **Variants**: `k8s-secret`, `k8s-volumes`.
   **Techniques**: contents, restyle, timer, side by side, caption.
   **Review**: Improved — mounted updates need the app to re-read and never apply to subPath mounts.

### Secret (`k8s-secret`)

**The aha**: A Secret is handled like a ConfigMap, but it is only base64-encoded, not encrypted
— real protection comes from RBAC, encryption at rest and often an external vault, not the
object itself.
**Misconception to defeat**: Believing "Secret" in the name means the value is encrypted.
**Cast**: A Secret card showing a base64 value with a "decode" button. An etcd cylinder in the
control plane. An RBAC padlock on who may read the object.
**Opening frame**: Secret card reading `cGFzc3dvcmQxMjM=`. _"That's not encryption."_
**Story**:

1. Click "decode": the text flips instantly to "password123", no key required. _"Anyone who can
   read the object can read the value."_
2. Zoom into etcd: the same value sits there, still just base64 (amber: "not encrypted at rest,
   by default"). _"Barely dressed up, unless you turn on encryption at rest."_
3. Toggle encryption at rest on (via a cloud KMS): the etcd copy turns to ciphertext. Read
   through the API, it still decodes instantly for a viewer with RBAC rights. _"Encryption at
   rest protects the disk. RBAC protects the API."_
4. A second viewer without the RBAC permission gets a shut padlock and a 403.
   **The moment**: Beat 1 — the instant, trivial decode, undercutting the name "Secret" before
   anything else is explained.
   **Interaction**: Click decode and encode; toggle RBAC on a second viewer; toggle encryption at
   rest and watch only the etcd copy change.
   **Ending**: Plaintext accessible only through the RBAC-gated API, ciphertext at rest.
   **Variants**: `k8s-configmap`, `k8s-rbac`, `k8s-external-secrets`.
   **Techniques**: toggle, zoom, restyle, spotlight, caption.
   **Review**: Keep — instant decode is the right opening; base64 versus encryption at rest versus RBAC is correct.

### External secret stores in Kubernetes (`k8s-external-secrets`)

**The aha**: The real secret stays in an outside vault where it's rotated and audited; the
cluster only ever gets a syncing copy or a short-lived mount, never the long-term source of
truth.
**Misconception to defeat**: Thinking Kubernetes no longer needs a Secret object at all, or that
the sync is instant.
**Cast**: A vault box outside the cluster boundary holding the one true value. Inside: one path
through an External Secrets Operator into a Secret object; one path through a Secrets Store CSI
Driver straight into a pod's mounted volume.
**Opening frame**: Vault outside the boundary, holding the value. _"The source of truth lives
outside the cluster."_
**Story**:

1. Path A: the Operator polls the vault on a schedule and copies the value into a Secret object
   in etcd. _"Easy to use — but now a copy sits in etcd too."_
2. The vault's value rotates; the next poll updates the copy, with a visible lag. _"Synced, not
   instant."_
3. Path B, side by side: the CSI driver mounts the value straight into a pod's volume at
   startup; no Secret object is ever created. _"Never stored as a Secret at all."_
4. The vault rotates again; path B's mounted file stays stale until the pod restarts, unless the
   driver's optional rotation is switched on. Env vars fed from the synced Secret never update
   either. _"Each path trades differently: copied-and-lagging, or no-copy-but-rigid."_
   **The moment**: Beat 3 — the Secret-object box visibly crossed out for the CSI path, a route
   that never touches etcd (unless its optional "sync as Secret" is turned on, shown as a dashed
   box).
   **Interaction**: Toggle between the two paths and watch whether a Secret object appears in etcd.
   **Ending**: Vault as the one source, two different ways the cluster borrows from it.
   **Variants**: `k8s-secret`, `k8s-workload-identity`.
   **Techniques**: boundary, side by side, timer, token, appear/disappear, caption.
   **Review**: Improved — CSI rotation and sync-as-Secret options acknowledged so the 'stale until restart' and 'never a Secret' claims are accurate.

### Volumes (`k8s-volumes`)

**The aha**: A container's own filesystem resets on restart, but a volume belongs to the pod, so
it survives container restarts — and different volume types answer different "where does this
come from" questions.
**Misconception to defeat**: Assuming anything written inside a container survives a restart, or
treating all volume types as equally durable.
**Cast**: A pod with two containers sharing labelled volume icons: `emptyDir`, a `configMap`
file, `hostPath`, and a PVC with a dashed line out to a PersistentVolume outside the pod.
**Opening frame**: Pod with both containers, volumes plugged in between them. _"A volume belongs
to the pod, not the container."_
**Story**:

1. Container 1 writes to its own root filesystem, then crashes and restarts: the file is gone.
   _"The container's filesystem: gone on restart."_
2. Container 1 writes instead to the shared `emptyDir`; after the same crash and restart, the
   file is still there. _"The volume: survives the restart."_
3. Container 2 reads the same file from the `emptyDir`. _"Shared, not private to one
   container."_
4. The whole pod is deleted and replaced: `emptyDir` is gone with it, but the PVC's dashed line
   to its PersistentVolume reattaches to the new pod. _"EmptyDir dies with the pod. Only a claim
   outlives it."_
5. `hostPath` is tied to one node; rescheduled elsewhere, its data is left behind.
   **The moment**: Beat 4 — pod deleted and recreated, `emptyDir` vanishing while the PVC-backed
   volume calmly reattaches, side by side.
   **Interaction**: Crash the container (volume survives) versus delete the pod (`emptyDir` dies,
   PVC doesn't).
   **Ending**: New pod, same PVC-backed volume reattached, `emptyDir` freshly empty.
   **Variants**: `k8s-persistent-volumes`, `k8s-pod`.
   **Techniques**: contents, failure, restyle, side by side, caption.
   **Review**: Keep — crash versus pod delete versus PVC is the right ladder.

### PersistentVolumes and PersistentVolumeClaims (`k8s-persistent-volumes`)

**The aha**: Apps request storage with a claim and never name an actual disk, so the same
manifest works on any cloud — but ReadWriteOnce means one node, not one pod, and a Delete
reclaim policy means the disk goes when the claim does.
**Misconception to defeat**: Thinking ReadWriteOnce limits a volume to one pod, or that deleting
a PVC is harmless.
**Cast**: A PVC card (10Gi, ReadWriteOnce) bound by a dashed line to a PersistentVolume cylinder
sitting on a real cloud disk. Two pods on the same node, both plugged into the same PVC.
**Opening frame**: PVC bound 1:1 to a PV on a real disk. _"A claim for storage — not a disk by
name."_
**Story**:

1. The PVC binds to a matching PV automatically; no one chose the disk. _"Bound by size and
   access mode, not identity."_
2. Two pods on the same node both mount the same PVC: both succeed. _"One node, not one pod."_
3. A third pod on a different node tries the same PVC: it is scheduled, then sticks in
   ContainerCreating, red ✗, "Multi-Attach: volume already attached to another node". _"ReadWriteOnce
   means one node, not one pod. (ReadWriteOncePod is the one-pod mode.)"_
4. The pods go, then the PVC is deleted. With reclaim policy Delete (the default for dynamically
   provisioned volumes), the PV and the disk vanish with it, data gone.
5. Side by side, with reclaim policy Retain instead: the PVC is deleted, but the PV (now
   Released) and the disk remain, waiting for an admin.
   **The moment**: Beat 3 — the cross-node mount rejection, correcting the "one pod" misreading of
   ReadWriteOnce.
   **Interaction**: Toggle reclaim policy before deleting the PVC; try mounting the same PVC from a
   pod on another node.
   **Ending**: Two outcomes side by side, Delete versus Retain.
   **Variants**: `k8s-volumes`, `k8s-storage-class`.
   **Techniques**: contents, failure, side by side, toggle, caption.
   **Review**: Improved — RWO violation is a Multi-Attach stall in ContainerCreating, not a scheduling rejection; added ReadWriteOncePod, Released PV, default Delete.

### StorageClasses and dynamic provisioning (`k8s-storage-class`)

**The aha**: Nobody pre-creates disks — a StorageClass is a recipe a PVC uses to create one on
demand, and waiting for the pod to be scheduled first (`WaitForFirstConsumer`) avoids stranding
a zonal disk in the wrong zone.
**Misconception to defeat**: Thinking a StorageClass is a pool of storage, or missing why
`WaitForFirstConsumer` matters.
**Cast**: A StorageClass card (provisioner, binding mode). A PVC referencing it. Three node
frames in three zones. A pod not yet scheduled.
**Opening frame**: StorageClass card, no PVs yet. _"No disks pre-made — only a recipe for making
one."_
**Story**:

1. Immediate binding: the PVC is created and a disk is provisioned right away, in zone A, before
   anyone knows where the pod will land. _"Create now, guess the zone."_
2. The pod's other needs (a GPU, a spread rule, free CPU) only fit in zone B. Every node in B is
   crossed out, red ✗, "volume node affinity conflict"; zone A is out of room. The pod sits
   Pending, its disk stranded in zone A.
3. Reset with `WaitForFirstConsumer`: the PVC sits pending, no disk yet, until the scheduler
   picks a node first; only then is a matching disk provisioned in the same zone. _"Wait for the
   pod, then match its zone exactly."_
4. Zoom into the StorageClass card's other fields: disk type, reclaim policy, and
   `allowVolumeExpansion` letting a bound PVC grow later.
   **The moment**: Beats 2 and 3 side by side — the same pod, one stranded by an early guess, one
   correctly placed because provisioning waited.
   **Interaction**: Toggle the binding mode and watch whether the disk lands in the right zone.
   **Ending**: `WaitForFirstConsumer` settled, disk and pod in the same zone.
   **Variants**: `k8s-persistent-volumes`, `k8s-node-affinity`.
   **Techniques**: contents, side by side, toggle, failure, caption.
   **Review**: Improved — fixed the Immediate-binding failure: the pod can't be scheduled (volume node affinity conflict), it isn't placed in the wrong zone.

## 3.7 Scheduling and resource management

### Resource requests and limits (`k8s-requests-limits`)

**The aha**: Requests decide where a pod fits; limits decide what happens when it tries to use
more than allowed — CPU over the limit is throttled, memory over the limit gets the container killed.
**Misconception to defeat**: Thinking limits reserve capacity (that's requests), or that CPU and
memory fail the same way when exceeded.
**Cast**: One node frame with CPU and memory bars along the bottom. A pod capsule with two
numbers stamped on it: request (a dot marker on the bar) and limit (a ceiling line above it).
**Opening frame**: Node with free bars; pod showing `request: 250m/256Mi, limit: 500m/512Mi`,
both drawn as markers on the node's bars. _"Two numbers. Two different jobs."_
**Story**:

1. The pod is scheduled: the node's bars immediately reserve the request amount, whether it's
   used yet or not. _"This slice is reserved the moment the pod lands."_ (The CPU request also
   becomes the pod's share when the node is busy.)
2. Usage climbs past the request toward the limit; nothing bad happens, it's still under the
   ceiling. _"Using more than you requested, up to the limit: fine."_
3. CPU usage tries to cross the limit line: the needle flattens against the ceiling, a
   "throttled" chip appears, no crash. _"Over the CPU limit: slowed down, not killed."_
4. Memory usage crosses its limit line instead: the container is killed outright, red flash,
   "OOMKilled", and restarts fresh. _"Over the memory limit: killed."_
   **The moment**: Beat 3 versus beat 4 — the same shape of "hit the limit" producing a gentle
   flatten for CPU and a hard kill for memory.
   **Interaction**: Drag a load dial up for a container and watch CPU throttle while memory, pushed
   the same way, gets OOMKilled instead.
   **Ending**: Pod running steady, usage under both limits.
   **Variants**: `k8s-qos-eviction`, `k8s-resource-quotas`, `k8s-hpa`, `k8s-vpa`.
   **Techniques**: meter, dial, restyle, failure, side by side, caption.
   **Review**: Improved — memory limit kills the container, not the pod; CPU request as share noted.

### QoS classes and node-pressure eviction (`k8s-qos-eviction`)

**The aha**: QoS class isn't something you set — it falls out of requests and limits
automatically, and it shapes who gets evicted when a node runs short: pods using more than they
asked for go first (BestEffort always, since it asked for nothing), Guaranteed last.
**Misconception to defeat**: Thinking QoS is a field you configure directly, or that it's the
kernel's OOM killer.
**Cast**: A node frame running low on memory (bar nearly full, amber). Three pods, each
auto-tagged: Pod A (no requests or limits → BestEffort), Pod B (request < limit → Burstable),
Pod C (request = limit → Guaranteed).
**Opening frame**: Three pods, three computed badges, memory bar nearly full. _"No one set these
badges. They just follow from the numbers."_
**Story**:

1. Hover each pod: Pod A has no requests or limits at all; Pod C's request exactly equals its
   limit. _"The badge reads the spec, nothing else."_
2. The node's memory bar crosses the eviction threshold, flashing amber. _"Not about who's
   biggest — who's over their own ask the most."_
3. Pod A (BestEffort) is evicted first: the kubelet stops it and its owner creates a replacement,
   which lands elsewhere. _"BestEffort goes first, almost always."_
4. Pressure continues; Pod B (Burstable, now over its request) is evicted next. A second
   Burstable pod still under its request is passed over. _"Order: over its request, then
   priority, then by how far over."_
5. Pod C (Guaranteed) survives untouched as the node empties around it.
   **The moment**: Beat 3 — eviction picking the BestEffort pod specifically because of its
   auto-derived badge, not its size or age.
   **Interaction**: Change a pod's requests and limits and watch its QoS badge recompute live;
   trigger node pressure and watch eviction order follow the badges.
   **Ending**: Only the Guaranteed pod left standing on a drained node.
   **Variants**: `k8s-requests-limits`, `k8s-priority-preemption`.
   **Techniques**: restyle, meter, failure, spotlight, caption.
   **Review**: Improved — eviction order is over-request first, then priority; QoS only approximates it; evicted pods are replaced by their owner.

### ResourceQuota and LimitRange (`k8s-resource-quotas`)

**The aha**: A ResourceQuota is the team's total budget for a namespace; a LimitRange is the
default plate size handed to any container that doesn't ask for its own — once a quota covers
CPU or memory, pods without requests are rejected unless a LimitRange fills the gap.
**Misconception to defeat**: Confusing namespace-level quota with per-container requests and
limits, or missing that quota can reject a pod purely for lacking numbers.
**Cast**: A namespace boundary with a ResourceQuota card (CPU, memory, pod-count totals) and a
running meter. A LimitRange card with default values.
**Opening frame**: Namespace boundary, quota meter at 0/4 CPU. _"The namespace's whole budget."_
**Story**:

1. A pod with explicit requests is created: the quota meter ticks up. _"Every pod's request
   counts against the total."_
2. A bare pod with no requests or limits tries to be created: rejected outright, red ✗, "must
   specify limits". _"Quota demands numbers from everyone."_
3. A LimitRange card is added with defaults filled in. The same bare pod is retried — admitted,
   silently stamped with the default request and limit, quota meter ticks up accordingly.
   _"LimitRange fills the gap quota just created."_
4. More pods push the quota meter to 4/4; the next pod is rejected, "quota exceeded", even
   though the cluster has plenty of spare CPU. _"The team's ceiling, not the cluster's."_
   **The moment**: Beats 2 and 3 — the same bare pod going from rejected to accepted purely because
   a LimitRange appeared.
   **Interaction**: Add or remove the LimitRange and retry a bare pod; push the quota meter to its
   ceiling.
   **Ending**: Quota meter full, LimitRange quietly filling every gap beneath it.
   **Variants**: `k8s-requests-limits`, `k8s-namespaces`.
   **Techniques**: boundary, meter, contents, failure, caption.
   **Review**: Keep — the same bare pod rejected then admitted is the clearest demonstration.

### Node selectors and node affinity (`k8s-node-affinity`)

**The aha**: Node affinity attracts pods toward nodes with certain labels, but
"IgnoredDuringExecution" means it only acts at scheduling time — relabel a node afterward and
nothing already running there moves.
**Misconception to defeat**: Expecting a pod to be evicted or moved when a node's labels change
after it's already scheduled there.
**Cast**: Three node frames labelled `disk=ssd`, `disk=ssd`, `disk=hdd`. A pod with required
node affinity `disk=ssd`.
**Opening frame**: Pod pending, three nodes with labels visible. _"Attracted to ssd nodes —
required, not just preferred."_
**Story**:

1. The scheduler tries node 3 (`hdd`): red ✗, "label doesn't match required affinity." Tries
   node 1 (`ssd`): fits, placed there. _"Required affinity is a hard filter at placement time."_
2. Node 1 is relabelled afterward to `disk=hdd`; the already-running pod stays exactly where it
   is, untouched. _"IgnoredDuringExecution: the label changed, the pod didn't move."_
3. A new pod with the same rule is scheduled now: it rejects node 1 (now `hdd`) and lands on
   node 2 instead. _"The rule only bites at the moment of scheduling — for the next pod."_
4. Contrast: a soft "preferred" version is tried instead — the scheduler places the pod on the
   only available `hdd` node anyway, just with a lower score, no red ✗. _"Preferred: a nudge,
   not a wall."_
   **The moment**: Beat 2 — the node's label flipping right under a running, untouched pod.
   **Interaction**: Relabel a node live and watch existing pods stay while new pods react; toggle
   required versus preferred.
   **Ending**: Node labels settled, pods placed by the rules in force when each was scheduled.
   **Variants**: `k8s-taints-tolerations`, `k8s-pod-affinity`, `k8s-scheduler`.
   **Techniques**: restyle, failure, token, toggle, caption.
   **Review**: Keep — relabel under a running pod is the right moment; required versus preferred covered.

### Pod affinity and anti-affinity (`k8s-pod-affinity`)

**The aha**: Pod affinity places a pod relative to other pods — pulling it toward a topology
that already has matching pods, or anti-affinity pushing it away — and required anti-affinity
leaves a pod Pending if there aren't enough separate places to put it.
**Misconception to defeat**: Confusing this with node affinity (node labels, not other pods), or
missing why anti-affinity can strand a pod.
**Cast**: Three node frames (standing in for three zones). A cache pod already on node 1. A new
app pod with affinity "prefer same zone as cache". Separately, four web replicas with required
anti-affinity on each other.
**Opening frame**: Cache pod on node 1, app pod pending. _"Where you are matters more than what
label the node has."_
**Story**:

1. The scheduler scores node 1 highest for the app pod due to affinity; it's placed right beside
   the cache. _"Pulled toward its chatty pair."_
2. Four web replicas with required anti-affinity (per node) arrive; the first three land one per
   node, each attempt at a node that already holds one crossed out. _"Pushed apart from its own
   kind."_
3. A fourth replica tries to schedule: all three nodes already have one; every node is crossed
   out in turn, and the pod goes Pending. _"Required anti-affinity can run out of room."_
4. A fourth node joins the cluster; the pending replica places there immediately.
   **The moment**: Beat 3 — all three nodes crossed out one by one for the fourth replica, the same
   elimination look used for resource fit, now driven by other pods.
   **Interaction**: Add or remove nodes and watch whether the pending replica can place; toggle
   affinity to anti-affinity on the same rule, or from required to preferred (placed anyway).
   **Ending**: Cache and app paired on one node; four web replicas, one per node, no leftovers.
   **Variants**: `k8s-node-affinity`, `k8s-topology-spread`, `k8s-scheduler`.
   **Techniques**: restyle, failure, spotlight, side by side, caption.
   **Review**: Improved — fixed the four-replica wording; added required versus preferred toggle.

### Taints and tolerations (`k8s-taints-tolerations`)

**The aha**: A taint repels pods from a node by default; a toleration only lets a specific pod
ignore that taint — it doesn't pull the pod there, so dedicating nodes needs both a taint on the
node and matching affinity on the pod.
**Misconception to defeat**: Thinking a toleration attracts the pod to the tainted node, rather
than merely permitting it.
**Cast**: A node frame stamped with a taint badge, `taint: gpu=true:NoSchedule`. Two pods
pending: Pod A (no toleration), Pod B (toleration for `gpu=true`).
**Opening frame**: Tainted node, two pods pending. _"A taint repels. By default, everyone."_
**Story**:

1. The scheduler tries the tainted node for Pod A: red ✗, "taint: gpu — no toleration." Pod A
   lands on a different, untainted node. _"No toleration, no entry."_
2. The scheduler tries the same node for Pod B: no ✗, it's allowed on — but it's equally offered
   an untainted node and could land on either. _"Tolerating only removes the block — it doesn't
   pull you in."_
3. Node affinity for the GPU node's label is added to Pod B alongside its toleration: now it
   reliably lands on the tainted node. _"Taint plus toleration plus affinity: that's how you
   dedicate nodes."_
4. A `NoExecute` taint is applied live to a node with running pods lacking a matching toleration:
   they're evicted on the spot, unlike `NoSchedule`, which only blocks new placements.
   **The moment**: Beat 2 — Pod B tolerating the taint but still drifting to either node,
   correcting "toleration equals attraction" directly.
   **Interaction**: Toggle a pod's toleration and watch the red ✗ appear or disappear; apply
   `NoExecute` to a live node and watch eviction.
   **Ending**: GPU node holding only pods with both toleration and matching affinity.
   **Variants**: `k8s-node-affinity`, `k8s-cordon-drain`.
   **Techniques**: restyle, failure, token, side by side, caption.
   **Review**: Keep — beat 2 attacks the toleration-attracts myth directly; NoExecute covered.

### Topology spread constraints (`k8s-topology-spread`)

**The aha**: Topology spread balances a group of pods evenly across zones (or any topology key)
within a maximum skew — six replicas across three zones become 2-2-2, something anti-affinity
alone can only block, never balance.
**Misconception to defeat**: Thinking anti-affinity already does this; it can only say "not
together", not "evenly spread".
**Cast**: Three zone boundaries with uneven nodes: four in zone A, one each in B and C. Six web
replicas scheduling with a spread constraint keyed on zone, `maxSkew: 1`.
**Opening frame**: Zero pods placed, three empty zones (A is bigger). _"Six replicas. Balance them across
zones, not just avoid stacking."_
**Story**:

1. Replicas 1–2 land in zones A and B. Replica 3's placement in A or B is checked against skew
   (would hit 2, too high) and it's steered to the empty zone C instead. _"Steered toward the
   emptiest zone to keep the spread even."_
2. Replicas 4–6 fill in, always picking whichever zone keeps the max difference at or under 1.
   End state: 2-2-2 exactly. _"Balanced, not just scattered."_
3. Contrast inset: the same six replicas under per-node anti-affinity alone fill all six nodes,
   one each: 4-1-1, because anti-affinity only forbids sharing a node, not lopsided zones.
   _"Not together" is not "evenly"._
4. A node fails in zone A, losing one replica; the replacement is steered back into zone A to
   restore 2-2-2. (The rule acts only when a pod is scheduled: scaling down can leave it lopsided.)
   **The moment**: Beat 3's contrast — the same six pods under two rules, one balanced 2-2-2, one
   lumpy 4-1-1, side by side.
   **Interaction**: Dial `maxSkew` up and down and watch how uneven the result is allowed to be;
   toggle `DoNotSchedule` versus `ScheduleAnyway` when skew can't be satisfied.
   **Ending**: 2-2-2 across three zones, settled.
   **Variants**: `k8s-pod-affinity`, `k8s-scheduler`.
   **Techniques**: meter, side by side, restyle, dial, caption.
   **Review**: Improved — the 4-1-1 contrast was impossible with two nodes per zone; zones are now uneven so per-node anti-affinity truly yields 4-1-1; noted scheduling-time only.

### Pod priority and preemption (`k8s-priority-preemption`)

**The aha**: When the cluster is full, priority decides who loses — a higher-priority pending
pod can evict lower-priority running pods to make room for itself.
**Misconception to defeat**: Confusing priority with QoS class, or assuming a full cluster just
leaves new pods Pending forever regardless of importance.
**Cast**: A full node (bars maxed) holding three low-priority batch pods. A new pod,
`critical-system`, high priority, pending with nowhere to go.
**Opening frame**: Full node, three batch pods, one pending critical pod. _"The cluster is full.
Something has to give."_
**Story**:

1. Normal placement fails outright: red ✗ on every node, "doesn't fit." _"No free capacity —
   ordinarily, stuck."_
2. The scheduler compares `critical-system`'s priority against the lowest-priority pods on a
   candidate node and selects enough batch pods to evict, red flash, removed, freeing exactly
   enough room. _"Priority breaks the tie — by evicting."_
3. After the victims' graceful shutdown, `critical-system` is placed into the freed space; the
   evicted batch pods' owners create replacements, which wait Pending. _"The batch work isn't
   lost, it's queued behind."_
4. Contrast: a cheap placeholder pod at the lowest priority is shown holding spare capacity,
   instantly evicted the moment anything more important needs the room.
   **The moment**: Beat 2 — lower-priority pods crossed out specifically to make room for the
   higher-priority one, not a random or first-in-line choice.
   **Interaction**: Dial a pod's priority and watch the threshold at which it starts preempting
   others; set its preemption policy to Never and it just waits.
   **Ending**: `critical-system` running; bumped batch pods queued, waiting for room.
   **Variants**: `k8s-qos-eviction`, `k8s-pod-disruption-budget`.
   **Techniques**: meter, failure, restyle, dial, caption.
   **Review**: Improved — preempted pods are deleted and replaced by owners, not requeued; preemption policy Never added.

### Device plugins and Dynamic Resource Allocation (`k8s-device-allocation`)

**The aha**: GPUs aren't fungible like CPU cores — they're distinct physical devices with their
own models and memory sizes, so Kubernetes needs a separate mechanism, device plugins or the
finer-grained DRA, to hand them out deliberately.
**Misconception to defeat**: Treating `nvidia.com/gpu: 2` like requesting "2 CPUs" —
interchangeable units.
**Cast**: A node with two visibly different GPU icons, each labelled with a model and memory
size (A100 · 40GB, T4 · 16GB). A pod requesting `gpu: 1`.
**Opening frame**: Node with two different GPUs, a pod pending with a bare request. _"Which
one? They're not the same thing."_
**Story**:

1. Device-plugin view: the pod gets whichever GPU is free, the T4, with no say over which model.
   _"Countable, but blind to differences."_
2. The job actually needed 40GB; the T4's 16GB isn't enough, and it crashes at runtime out of
   memory, uncaught at scheduling. _"The old plugin model can't express that requirement."_
3. Switch to DRA: the pod claims a device by property through a ResourceClaim (a DeviceClass
   plus a selector such as memory ≥ 32GB).
   The scheduler specifically picks the A100, skipping the T4 outright, crossed out, "doesn't
   meet claimed properties." _"DRA lets you claim by property, not just by count."_
4. A second pod claims a partial share of the same GPU; DRA shows it partitioned, both pods
   within their slice.
   **The moment**: Beat 2 versus beat 3 — the same job, first crashing from a blind count-based
   match, then correctly placed once the claim describes what it actually needs.
   **Interaction**: Toggle device-plugin versus DRA mode for the same pending pod and watch whether
   it lands on a GPU that fits.
   **Ending**: DRA claim bound to the right device, job running without an OOM.
   **Variants**: `k8s-requests-limits`, `k8s-scheduler`.
   **Techniques**: restyle, failure, spotlight, side by side, caption.
   **Review**: Improved — DRA claim now names DeviceClass and selector.

## 3.8 Autoscaling

### Horizontal Pod Autoscaler (`k8s-hpa`)

**The aha**: HPA adds or removes pods, not nodes, and it measures utilisation against requests
— a pod with no CPU request can't be scaled on CPU at all, and if the new pods don't fit on
existing nodes, scaling stalls until something else adds capacity.
**Misconception to defeat**: Thinking HPA scales nodes, or scales on raw CPU usage rather than
usage relative to the request.
**Cast**: A Deployment with three pods, each with a CPU request and a live usage needle. An HPA
card with a target utilisation. A node frame underneath with a CPU bar.
**Opening frame**: Three pods at 40% utilisation, HPA card calm. _"Utilisation against the
request — not raw usage."_
**Story**:

1. Traffic rises; each pod's needle climbs to 90% of its request. HPA's formula ticks visibly:
   `desired = ceil(3 × 90/50)`. _"It does the math against the target, live."_
2. HPA scales the Deployment to six replicas; three new pods appear. Two fit on existing nodes;
   the third is crossed out, red ✗, "doesn't fit," and goes Pending. _"HPA only asks for more
   pods. Fitting them is someone else's job."_
3. Contrast strip: the same spike replayed on a pod with no CPU request set — the card shows a
   dash, "no requests — can't compute %," and never scales. _"No request, no CPU-based
   scaling."_
4. Traffic dips briefly; the scale-down stabilisation window (5 minutes by default) holds the
   replica count steady. Scaling up is not delayed. _"Slow to shrink, so it doesn't twitch on
   every blip."_
   **The moment**: Beat 2's Pending pod — HPA succeeding at its one job while immediately exposing
   the limit of that job.
   **Interaction**: Dial traffic up and down and watch the replica count compute live; remove the
   CPU request and watch scaling stop entirely.
   **Ending**: Six replicas requested, five running, one pending — a cliffhanger into cluster
   autoscaling.
   **Variants**: `k8s-requests-limits`, `k8s-vpa`, `k8s-cluster-autoscaler`, `k8s-keda`.
   **Techniques**: meter, dial, token, failure, timer, caption.
   **Review**: Improved — fixed ending count (five running, one pending); stabilisation window is the scale-down one.

### Vertical Pod Autoscaler (`k8s-vpa`)

**The aha**: VPA right-sizes each pod's own requests and limits instead of adding more pods —
useful for fixing bad sizing, but it must never act on the same metric as HPA for the same
workload, or the two fight.
**Misconception to defeat**: Thinking VPA is just "HPA for one pod," or safe to combine freely
with HPA on CPU.
**Cast**: One over-requested pod (request: 1 CPU, usage needle at 100m). A VPA card in
Off / Initial / Recreate / InPlaceOrRecreate mode.
**Opening frame**: Oversized pod, usage far below its own request line. _"Watching real usage
against what was asked for."_
**Story**:

1. In recommendation-only mode, VPA surfaces "recommended: 150m" without touching the pod.
   _"Learn first — the pod is untouched."_
2. In Recreate mode, VPA kills and recreates the pod with 150m stamped on it, a brief visible
   gap. _"Right-size by replacing it."_
3. In InPlaceOrRecreate mode, the same resize happens without the gap — the request number
   changes while the pod keeps running. _"Same fix, no downtime — if the node has room; else it
   recreates."_
4. Side by side with HPA: the same spike on two copies of the Deployment. Left, HPA adds pods,
   each one's size fixed. Right, VPA resizes the existing pods, the count fixed. _"Two different
   levers: more copies, or bigger copies."_
5. Warning overlay: both VPA and HPA pointed at CPU on the same Deployment — VPA resizes the
   request while HPA's utilisation math, based on that same request, swings wildly, replica
   count oscillating. _"Same metric, both acting: they fight."_
   **The moment**: Beat 4 — the side-by-side spike, one Deployment growing wider, the other
   growing taller, from the same traffic.
   **Interaction**: Toggle VPA's mode and watch whether the pod restarts; toggle "HPA also on CPU"
   and watch the oscillation appear.
   **Ending**: VPA settled on an in-place resize; HPA kept to a different metric.
   **Variants**: `k8s-hpa`, `k8s-requests-limits`.
   **Techniques**: meter, side by side, restyle, failure, caption.
   **Review**: Improved — in-place resize falls back to recreate when the node lacks room.

### Cluster Autoscaler (`k8s-cluster-autoscaler`)

**The aha**: Cluster Autoscaler reacts to pods that can't be scheduled, not to CPU load — the
chain is HPA creates pods, those pods go Pending, and only minutes later do new nodes appear to
fit them.
**Misconception to defeat**: Expecting node autoscaling to respond directly and quickly to load
the way HPA does.
**Cast**: Picking up `k8s-hpa`'s cliffhanger pod, crossed off every existing node. A Cluster
Autoscaler card watching the Pending queue. A predefined node group template.
**Opening frame**: One pod stuck Pending, existing nodes full. _"Not watching CPU. Watching
this."_
**Story**:

1. Cluster Autoscaler notices the Pending pod, a highlighted link from pod to card. _"It only
   reacts to pods that can't fit."_
2. It requests a new node from the predefined group; a new node frame fades in slowly, a timer
   ticking through boot, join and Ready while the pod stays Pending the whole time. _"Minutes,
   not seconds — a real machine has to boot."_
3. The node joins; the Pending pod is finally scheduled onto it. _"The chain completes: HPA →
   Pending → new node → scheduled."_
4. Later, load drops; several nodes sit mostly idle. For a node whose pods would fit elsewhere,
   Cluster Autoscaler waits out a cool-down, then drains it (respecting a PodDisruptionBudget
   shield) and removes it, one node at a time.
   **The moment**: Beat 2's timer — the visible, uncomfortable minutes-long gap between "pod is
   stuck" and "node exists."
   **Interaction**: Scrub the timer to feel the wait; toggle a strict PDB and watch scale-down slow
   or refuse.
   **Ending**: Right-sized node count, no Pending pods, no PDB violations.
   **Variants**: `k8s-hpa`, `k8s-scheduler`, `k8s-karpenter`, `k8s-pod-disruption-budget`.
   **Techniques**: timer, token, spotlight, failure, caption.
   **Review**: Improved — scale-down drains a node whose pods fit elsewhere after a cool-down; it does not consolidate proactively.

### Karpenter-style node provisioning (`k8s-karpenter`)

**The aha**: Instead of growing a predefined node group by one, Karpenter-style provisioning
reads exactly what the Pending pods need and launches the best-fitting, cheapest machine
directly — mixing sizes and even spot capacity, and shrinking the fleet again as load falls.
**Misconception to defeat**: Thinking this is just a faster Cluster Autoscaler, missing that it
isn't working from fixed node groups at all.
**Cast**: The same Pending-pod setup, but instead of one fixed node-group template, a cloud's
instance-type catalog spread out with price tags.
**Opening frame**: A Pending pod with specific needs; a catalog of instance types, no fixed
group. _"No group to grow. Just: what fits, cheapest?"_
**Story**:

1. It reads the pod's exact requirements and the NodePool's constraints; several catalog
   options are crossed out for not meeting constraints, and the cheapest adequate type is
   launched directly. _"Picked by fit and price, not by growing a fixed group."_
2. A burst of oddly-shaped pods arrives — tiny, huge, GPU-needing — and three different instance
   types launch side by side, each sized to what asked for it. _"Mixed sizes, because the pods
   aren't all the same shape."_
3. A spot-capable pod launches on a spot instance with a discount badge; later the cloud warns
   of reclaiming it, a flash, "interrupted," and a replacement launches (on-demand if no spot
   fits) to keep the pod running. _"It'll use cheap capacity, and recover when the cloud takes it back."_
4. Load drops; several underused nodes are consolidated onto fewer, cheaper ones.
   **The moment**: Beat 2 — three differently sized nodes for three differently shaped pods, beside
   a crossed-out "one fixed group" ghost from the cluster-autoscaler plan.
   **Interaction**: Change a pod's requirements and watch which instance type gets picked, and why
   others were ruled out.
   **Ending**: A lean, mixed fleet exactly matched to current pods.
   **Variants**: `k8s-cluster-autoscaler`, `k8s-device-allocation`.
   **Techniques**: meter, side by side, failure, restyle, caption.
   **Review**: Improved — spot interruption replacement is not necessarily on-demand.

### KEDA event-driven autoscaling (`k8s-keda`)

**The aha**: KEDA scales on the work waiting — queue length, consumer lag, a schedule — rather
than CPU, and it can take a workload all the way to zero replicas and back, starting consumers
before any of them would ever look busy.
**Misconception to defeat**: Expecting CPU-based HPA to notice a growing queue, or missing that
KEDA hands off to a regular HPA once it's above one replica.
**Cast**: A message queue with a length meter. A Deployment at zero replicas — no pod capsules
at all. A ScaledObject card watching the queue.
**Opening frame**: Queue empty, Deployment at zero. _"Zero pods. Nothing's running, and nothing
needs to be."_
**Story**:

1. Messages arrive, the queue meter climbing; CPU usage anywhere is irrelevant, there's no pod
   to be busy. _"Nothing to measure on CPU; the signal is the backlog."_
2. At a threshold, KEDA creates the first replica before it has processed a single message, i.e.
   before it ever looks busy. _"Scale from zero, triggered by the backlog."_
3. The queue keeps growing; KEDA hands off to a regular HPA it manages underneath, which scales
   from one to many on the same queue-length metric. _"Above one, it's a regular HPA."_
4. The queue drains; replicas scale down to the last one, then after a cool-down KEDA removes
   it too, back to zero.
5. Side by side with CPU-based HPA on the same workload: its floor is one pod, and that pod
   waits on a slow downstream call, so CPU stays low while the backlog grows and nothing scales.
   _"CPU can't see a backlog, and plain HPA can't reach zero for CPU."_ (Native HPA scale-to-zero
   is only beta in v1.37, and only for object and external metrics.)
   **The moment**: Beat 2 — the first pod appearing while the queue is already backed up and the
   pod itself is still at 0% CPU, visibly contradicting "scale on load."
   **Interaction**: Dial the queue length and watch the replica count follow it down to and up from
   exactly zero; compare against a CPU-only HPA on the same metric feed.
   **Ending**: Queue and replica count both at zero, settled.
   **Variants**: `k8s-hpa`, `k8s-jobs-cronjobs`.
   **Techniques**: meter, appear/disappear, side by side, dial, caption.
   **Review**: Improved — HPA scale-to-zero is now beta (v1.37) for external metrics, so 'alone' was dropped; fixed the CPU-HPA comparison; cool-down added.
