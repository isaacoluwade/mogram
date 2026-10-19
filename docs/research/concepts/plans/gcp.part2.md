# Google Cloud plans, part 2

Stage 2 plans for `catalog/gcp.md` groups 7 to 11, in catalog order: Compute Engine; Google
Kubernetes Engine; Cloud Run and serverless; Storage; Databases. They use the shared Google
Cloud visual language: real service icons and names (Compute Engine, GKE Autopilot/Standard,
Cloud Run, Cloud Storage, Cloud SQL, Spanner, Bigtable, Firestore…); nesting as nested frames
(a region boundary holding zone frames, a VPC boundary holding regional subnets); requests as
small dots travelling along arrows; Cloud Run instances as boxes that hold several request dots
at once up to a concurrency limit, and that can shrink to none; Spanner's TrueTime as a clock
face with a visible uncertainty band around its hand; storage classes as shelves at growing
distance from a desk (Standard near, Archive in a back room), each with a storage-price and a
retrieval-price tag; "X vs Y" comparisons running the same traffic or task through each option
side by side; "which service do I use" questions as a short path whose answers light the
matching service icon and dim the rest; cost as a coin meter that ticks as things run. No new
technique was needed for this part; everything is built from the vocabulary in `README.md`.

## Compute Engine

### Choosing compute (`gcp-choose-compute`)

**The aha**: Start at the most managed rung (Cloud Run) and step down toward raw VMs only when you need the control; packaging as a container keeps the move between rungs cheap.
**Misconception to defeat**: That Compute Engine is the "default" starting point, with the managed options as shortcuts for toy use cases.
**Cast**: A vertical ladder of four rungs, each a frame holding the same small container icon: Cloud Run (top), GKE Autopilot, GKE Standard, Compute Engine (bottom: a VM with its OS visible, the container running on it). A side branch for Batch, VMware Engine, HPC and Agent Runtime. An "ops you own" meter beside the ladder.
**Opening frame**: The container icon sitting on the top rung, Cloud Run, the rest of the ladder dimmed below. _"Start here."_
**Story**:

1. The container drops to GKE Autopilot: the ops meter ticks up slightly. _"Need Kubernetes? Autopilot first."_
2. Drops to GKE Standard: node icons appear beneath it, now owned by you, ops meter rising further. _"Need node-level control, GKE Standard."_
3. Drops to Compute Engine: ops meter maxes; a VM and its OS appear under the container, now yours to patch and size. _"Need the VM itself, or the OS."_
4. The side branch lights for a finite job (Batch), a lift-and-shift (VMware Engine) and an AI agent (Agent Runtime); legacy App Engine sits greyed beside them. _"Specialist needs, specialist rungs. App Engine: superseded by Cloud Run."_
5. The same container icon is shown riding all four main rungs, unchanged. _"The container doesn't change — only who runs it."_
   **The moment**: Beat 5 — one identical container sitting on every rung while the machinery and the ops meter around it change.
   **Interaction**: Drag the container up and down the ladder; the ops meter and a short "what you now own" caption update live.
   **Ending**: Rests at the top rung, ops meter low. _"Climb down only when you must."_
   **Variants**: `gcp-gke-autopilot-vs-standard`, `gcp-cloud-run-resource-types`; compares to AWS Lambda/Fargate/EKS/EC2.
   **Techniques**: lanes, move, meter, restyle, choice, caption.
   **Review**: Improved — the Compute Engine rung swapped the container for a VM, which contradicted beat 5 ("same container on every rung"); the container now runs on the VM instead. Added legacy App Engine, greyed. Weighed a "do you need X?" question path (as in choose-storage); worse, because the ladder lets the ops meter and the identical-container moment show the cost of each step. Checked order and names against the catalog (Cloud Run, Autopilot first, Standard, VMs; Batch, VMware Engine, Agent Runtime).

### Machine families, types and sole tenancy (`gcp-machine-families`)

**The aha**: The name of a machine type tells you its shape and price: pick the family by the bottleneck, the type by memory-per-vCPU, and build a custom shape rather than overpay for the next size up.
**Misconception to defeat**: That instance types are a fixed menu to memorize, with no room to fit the actual workload.
**Cast**: A shelf of family badges (E2/N2 general-purpose, C2 compute-optimized, M memory, A2/G2 accelerator, Z storage), each with an icon. A build panel reading `n2-standard-8`, breaking into series/type/vCPUs. A custom-shape slider for vCPU and memory, with a price tag.
**Opening frame**: The label `n2-standard-8` sitting above an N2 badge, unexploded. _"A name, not a mystery."_
**Story**:

1. The label splits into three tags: "n2" (series), "standard" (type), "8" (vCPUs). _"Series, type, size."_
2. Hovering "standard" shows "highmem" and "highcpu" siblings with different memory bars. _"Type sets memory per vCPU."_
3. A workload needs 4 vCPU and 20 GB. It sits between `n2-standard-4` (16 GB, too small) and `n2-highmem-4` (32 GB, 12 GB unused). The custom slider drags to exactly 4 vCPU / 20 GB (`n2-custom-4-20480`), priced below highmem-4. A small note: custom shapes exist on the general-purpose series, not every family. _"Custom: pay for what you asked for."_
4. The A2 badge glows for an ML job, showing attached GPUs; the Z badge glows for a storage-bound job with Local SSD rows. _"Pick by the bottleneck."_
5. A sole-tenant node frame appears holding one VM alone, a "per-core licensing" tag beside it. _"A host to yourself — for licensing or isolation, not speed."_
   **The moment**: Beat 3, the custom slider landing between two fixed sizes with the price dropping — proof the menu isn't the only option.
   **Interaction**: Drag the custom vCPU/memory slider; price tracks continuously, crossing the fixed sizes.
   **Ending**: The custom shape sitting at exactly the workload's numbers, cheaper than either fixed neighbour.
   **Variants**: `gcp-choose-compute`, `gcp-spot-vms`; compares to AWS instance types, Azure VM sizes.
   **Techniques**: contents, dial, meter, spotlight, caption.
   **Review**: Improved — the arithmetic was wrong: n2-standard is 4 GB per vCPU and n2-highmem 8 GB per vCPU, so 6 vCPU was 24 and 48 GB (not 52), and there is no highmem-6. Replaced with 4 vCPU / 20 GB between 16 and 32 GB, and noted custom shapes are not on every series. Weighed a "pick by bottleneck" quiz as the lead; worse, since the slider landing between fixed sizes is the part AWS and Azure lack.

### Managed instance groups and the autoscaler (`gcp-managed-instance-groups`)

**The aha**: You manage one template and a target count; the MIG keeps that many healthy copies running across zones, replaces sick ones, and rolls out changes gradually — the VM-level counterpart of a Kubernetes Deployment.
**Misconception to defeat**: That a MIG is just a list of VMs someone remembers to keep matching.
**Cast**: An instance-template card at the top. Below, a region boundary holding three zone frames, each with VM copies cloned from the template and a heartbeat on each. An autoscaler dial. A rollout strip of grey (old template) vs blue (new template) VMs.
**Opening frame**: Template card above a regional MIG: six identical VMs, two per zone, all green heartbeats. _"One template, many identical copies."_
**Story**:

1. One VM's heartbeat flatlines, red; the MIG clones a fresh VM into the same zone, the sick one disappears. The heartbeat is the application health check, not the hardware. _"Autoheal: failed check, fresh copy."_
2. Load climbs on the autoscaler dial; new VMs clone in across all three zones to keep the spread even; a zonal MIG beside it would stack them all in one zone. _"Autoscaler watches, and adds across zones."_
3. The template updates to blue; a rolling update replaces VMs in small batches, with a visible "surge: 1, unavailable: 0" rule. _"Roll out gradually, by rule."_
4. A canary split shows 90% grey, 10% blue, side by side, before the full rollout continues. _"Test on a slice first."_
   **The moment**: Beat 1 — a red heartbeat answered not by an alert but by a silent clone taking its place, no human involved.
   **Interaction**: Kill a VM by click and watch autoheal replace it; drag the autoscaler's load slider and watch VM count track it evenly across zones.
   **Ending**: Six healthy blue VMs, two per zone, heartbeats steady.
   **Variants**: `gcp-choose-compute`, `gcp-spot-vms`, `gcp-regions-zones`; compares to AWS Auto Scaling groups, Azure VM Scale Sets, Kubernetes Deployments.
   **Techniques**: clone, contents, boundary, dial, failure, side by side, caption.
   **Review**: Improved — made the group explicitly regional (the even zone spread is a regional-MIG property; a zonal MIG sits in one zone and dies with it) and tied the heartbeat to the application health check that actually drives autohealing. Weighed a side-by-side with a Kubernetes Deployment; worse, since it needs Kubernetes knowledge the viewer may not have. Misconception (a mere list of VMs) is defeated by beat 1. Checked: surge/unavailable limits, canary via two templates, recreate-in-place on failure.

### Spot VMs (and preemptible VMs) (`gcp-spot-vms`)

**The aha**: Spot capacity is 60–91% cheaper because Google can reclaim it at any moment with only 30 seconds' notice — safe for work a MIG can recreate elsewhere, never for a lone stateful server.
**Misconception to defeat**: That Spot is just "a cheaper VM" with no real catch.
**Cast**: Two VMs side by side: Standard (full price tag) and Spot (price struck through, 70% off), with a countdown badge on the Spot VM. A MIG frame holding three Spot VMs behind a load balancer.
**Opening frame**: Standard VM at full price beside Spot at a fraction of it (60 to 91% off), both running the same job. _"Same VM, far less — if you can lose it."_
**Story**:

1. A "Google needs this capacity" banner lands on the Spot VM; a 30-second countdown starts; a shutdown script races to checkpoint its work. _"Reclaimed with 30 seconds' notice."_
2. Countdown hits zero: the Spot VM is stopped, no live migration. _"No live migration, no SLA."_
3. Cut to the MIG: one of three Spot VMs vanishes the same way; the MIG instantly clones a replacement, maybe in another zone. Work continues. _"Fine, if a MIG just rebuilds it."_
4. Cut to a lone Spot VM running a database on Local SSD: the same stop; the Local SSD data is gone and the service stays down until someone restarts it, if capacity is free (a Persistent Disk would survive, but nothing is serving). Red flash. _"One copy, nothing to rebuild it: fatal."_
   **The moment**: Beat 3 vs beat 4, side by side — identical stop, opposite outcome, depending only on whether something else can recreate the work.
   **Interaction**: Toggle "behind a MIG" on and off, trigger a reclaim, and compare continue vs. lose.
   **Ending**: Three Spot VMs behind the MIG, steady despite one having just been replaced.
   **Variants**: `gcp-managed-instance-groups`, `gcp-live-migration`, `gcp-machine-families`; compares to AWS Spot Instances (two-minute notice).
   **Techniques**: meter, timer, failure, clone, side by side, caption.
   **Review**: Improved — a Spot VM is stopped (or deleted by setting), not erased: persistent disks survive a stop, so "the file goes with it" was wrong; the data loss is Local SSD and memory, and the real failure is a lone server staying down. Opening price fixed (70% off is not a quarter), and the 30 s notice now has a use (shutdown script). Weighed leading with the AWS two-minute contrast; worse, as it needs AWS knowledge. Checked: 60–91%, 30 s, no live migration, no SLA.

### Live migration (`gcp-live-migration`)

**The aha**: When Google needs to maintain the host under your VM, it copies the running VM to another host while it keeps running, so you see a brief pause, not a reboot.
**Misconception to defeat**: That cloud host maintenance means your VM reboots, the way on-prem hardware maintenance would.
**Cast**: VM "web-01" on Host A inside a zone frame; Host B beside it, empty. A maintenance wrench approaching Host A. A memory-copy stream between the hosts. A tiny stopwatch for the pause, and an uptime counter on the VM.
**Opening frame**: web-01 running on Host A, uptime counter ticking, serving a steady stream of request dots. _"Running normally."_
**Story**:

1. The wrench lands on Host A: "scheduled maintenance". _"Google needs to work on this host."_
2. A stream of memory pages copies from Host A to Host B while web-01 keeps serving dots on Host A; pages it rewrites mid-copy flash and are sent again. _"The VM's state copies over — while it keeps running."_
3. For the final handoff the stopwatch runs a very short blackout: one dot waits an instant, none are lost, and the uptime counter never resets. _"A brief pause, not a reboot."_
4. web-01 is now shown fully on Host B, still serving; Host A greys out, taken offline. _"Same VM, same IP, new host."_
5. Contrast inset: a Spot VM, a VM set to "terminate on maintenance", and a GPU VM that can't migrate: the wrench lands and each stops or restarts, uptime counter reset, no Host B. _"Spot, opted-out and many GPU VMs don't get this."_
   **The moment**: Beats 2 to 3 — the request stream and uptime counter carrying on while the whole VM relocates underneath them.
   **Interaction**: Trigger "schedule maintenance" and watch the migration; toggle to a Spot VM and watch it just die instead.
   **Ending**: web-01 settled on Host B, dot stream unbroken throughout.
   **Variants**: `gcp-spot-vms`, `gcp-regions-zones`; compares to AWS's reboot/stop-start maintenance events.
   **Techniques**: stream, move, clone, timer, side by side, caption.
   **Review**: Improved — "doesn't visibly drop" contradicted the "brief pause" in the aha, so the blackout is now shown honestly (one dot waits); added the uptime counter so "not a reboot" is visible, and dirty-page re-copy so the pre-copy mechanism is true. The contrast now covers the real exceptions from the catalog (Spot, terminate-on-maintenance, many GPU/TPU VMs). Dropped the "under a second" figure, which varies. Weighed a before/after reboot comparison with AWS; worse, as the uptime counter does the same job without leaving Google Cloud.

### Snapshots, images and machine images (`gcp-snapshots-images`)

**The aha**: Three different copies for three different jobs: a snapshot backs up and restores one disk's data, a custom image standardizes what new VMs boot from, a machine image clones or backs up an entire VM.
**Misconception to defeat**: Treating "snapshot" and "image" as interchangeable words for "a VM backup".
**Cast**: One running VM with its disk at the centre of three columns. Left: a snapshot (a thin, incremental slice) peeling off the disk into a regional store. Middle: the disk's contents poured into an image template, grouped under a family label, stamped out as fresh VMs. Right: the whole VM — disk, config, metadata — wrapped into one machine-image package.
**Opening frame**: One running VM with its disk, unlabelled, centred under all three columns. _"One VM. Three kinds of copy."_
**Story**:

1. Left: the first snapshot is a full copy, then only the blocks changed since last time peel off into each new one; a schedule clock ticks beside it. _"Snapshot: a disk's data, incrementally, on a schedule."_
2. The snapshot restores onto a fresh disk in a different zone. _"Restore anywhere, any zone or region."_
3. Middle: the disk's contents become an image, grouped under the family `web-server` (images v11, v12; the family always points at the newest); three new VMs stamp out from v12, each with its own fresh disk. _"Image: a template new VMs boot from."_
4. Right: the whole VM zips into one machine-image card; it unpacks elsewhere into an identical whole VM. _"Machine image: clone or back up the entire VM."_
   **The moment**: The three columns side by side at the end, each producing a visibly different output from the same source VM.
   **Interaction**: Pick a goal ("restore lost data", "standardize new VMs", "clone this whole VM") and watch the matching column light up.
   **Ending**: Three labelled outputs side by side: a restored disk, three stamped VMs, one cloned VM.
   **Variants**: `gcp-live-migration`, `gcp-backup-dr`; compares to AWS AMIs and EBS snapshots.
   **Techniques**: clone, contents, timer, side by side, choice, caption.
   **Review**: Improved — `web-server-v12` was shown as the family; a family is the name (`web-server`) that points to the newest image, so v11/v12 are now members. Made the first-full, then-incremental snapshot behaviour explicit. Weighed one column per question ("I lost data", "I need ten VMs", "I want a twin"); the three-column picture already does that with the interaction. Misconception (snapshot = image) is defeated by the three different outputs. Checked: snapshots regional/multi-regional and restorable cross-zone; machine image = disks plus config plus metadata.

## Google Kubernetes Engine

### GKE Autopilot vs Standard (`gcp-gke-autopilot-vs-standard`)

**The aha**: Autopilot moves the unit you think and pay in from nodes to Pods — Google provisions and patches whatever nodes your Pods need; Standard leaves node pools, and their bill, to you.
**Misconception to defeat**: That Autopilot is just Standard with sensible defaults applied, rather than a different billing and ops unit entirely.
**Cast**: Two clusters side by side. Left "Standard": a node-pool frame of VM-shaped nodes, Pods packed unevenly, some nodes half-empty. Right "Autopilot": no nodes of yours, just a boundary with Pods floating in it, each tagged with its own cpu/mem request. A coin meter under each.
**Opening frame**: Both clusters running the same three Pods; left shows two nodes underneath, right shows none of yours. _"Same Pods. One has visible machines."_
**Story**:

1. Left: a fourth Pod is requested, doesn't fit, a new node VM appears half-empty around it; the coin meter jumps for the whole node. _"Standard bills for the node, however much of it you use."_
2. Right: the same fourth Pod appears; a node materializes inside a dimmed "Google's" frame, outside your inventory; the coin meter ticks up by only the Pod's CPU and memory request, whatever spare room that node has. _"Autopilot bills for the Pod."_
3. Someone tries to reach a node directly on the right: the attempt bounces, "no node access in Autopilot"; the same attempt on the left succeeds. _"The trade: no node-level control."_
4. A privileged Pod is attempted on the right and rejected; the same Pod runs fine on the left. _"Hardening is enforced for you, like it or not."_
   **The moment**: Beat 2 — a Google-owned node appearing while the meter charges only the Pod's request, right beside beat 1's half-empty node costing the same as a full one.
   **Interaction**: Add Pods one at a time to both clusters and watch nodes (or their absence) and the coin meters respond differently.
   **Ending**: Two coin meters, Standard's padded by unused capacity, Autopilot's tracking Pods exactly.
   **Variants**: `gcp-choose-compute`, `gcp-gke-node-pools`, `gcp-gke-regional-clusters`; compute classes let Standard run some workloads Autopilot-style (some Autopilot classes bill by node); compares to AWS EKS Auto Mode and Fargate.
   **Techniques**: side by side, appear/disappear, meter, failure, boundary, caption.
   **Review**: Improved — "a node sized exactly to the Pod" was wrong (nodes are bin-packed and can have spare room); the aha is that the spare room is Google's cost, not yours, so the node is now drawn dimmed and Google-owned while the meter tracks the request. Noted compute classes and the node-billed classes. Weighed a three-way table of who patches/who pays; worse, as the two coin meters make the difference felt. Checked: no node SSH, privileged Pods rejected, Autopilot recommended by Google.

### Zonal vs regional GKE clusters (`gcp-gke-regional-clusters`)

**The aha**: A regional cluster replicates the control plane across three zones and spreads each node pool across them too — surviving a zone outage, but multiplying your node count by the number of zones.
**Misconception to defeat**: Thinking "regional" just means "nodes spread around" with the same total node count as zonal.
**Cast**: A region boundary holding three zone frames. Zonal version: one control-plane icon and all nodes sit in Zone 1 only. Regional version: three linked control-plane icons, one per zone; a node pool set to "size: 3" puts one node in each zone.
**Opening frame**: Zonal cluster: control plane and six nodes, all inside Zone 1's frame. _"Everything in one zone."_
**Story**:

1. Zone 1 flashes red and greys out entirely: the zonal control plane and all nodes die with it, the API goes dark. _"Lose the zone, lose the cluster."_
2. Switch to regional: node-pool size "3" is requested; a node appears in each of the three zones — nine nodes total, not three. A dial drops it to 1: now three. _"Size 3 means 3 nodes per zone."_
3. Zone 1 flashes red: its control-plane replica and node grey out, but the other two replicas and nodes keep serving, API unaffected; the two zones left carry the whole load, so they need headroom. _"A region survives a zone — if you left room."_
4. During an upgrade, the regional control plane's three replicas update one at a time while the API stays reachable; the zonal one must go dark briefly. _"Also keeps the API up during upgrades."_
   **The moment**: Beat 2 — asking for "3" and getting 9, the moment the per-zone multiplication becomes visible and budgetable.
   **Interaction**: Set a node-pool size and cluster type (zonal/regional) and fail Zone 1 on each.
   **Ending**: Regional cluster surviving a zone loss, API dot stream uninterrupted.
   **Variants**: `gcp-regions-zones`, `gcp-gke-node-pools`; compares to multi-zonal clusters as the in-between case.
   **Techniques**: boundary, failure, clone, dial, side by side, caption.
   **Review**: Improved — added the per-zone dial down to 1 (so "3 becomes 9" reads as a lever, not a trap) and the capacity-headroom consequence of losing a third of the nodes. Weighed adding the multi-zonal in-between case as its own beat; kept it as a variant since the 3-becomes-9 moment is sharper alone. Checked: regional replicates the control plane across three zones, node counts are per zone, Autopilot is always regional, zonal control plane is unavailable during its upgrade (workloads keep running).

### Node pools and cluster autoscaling (`gcp-gke-node-pools`)

**The aha**: Node pools let one cluster host very different hardware under one roof — steer Pods onto the right pool with taints and selectors, and let each pool scale itself, while Pod autoscaling and node autoscaling run as two separate loops that have to cooperate.
**Misconception to defeat**: That a cluster has just "nodes", or that more Pods automatically makes more nodes appear with no logic behind it.
**Cast**: A cluster boundary holding three pool frames: general (plain VMs), high-memory (wide memory bars), GPU (chip badges). Pods float above, each tagged to match one pool's taint. Two stacked dials: Pod autoscaler and node autoscaler (per pool).
**Opening frame**: Three pools, each with two nodes, Pods correctly sorted above their matching pool. _"One cluster, three kinds of hardware."_
**Story**:

1. A GPU Pod and a plain Pod appear. The GPU pool carries a taint: the plain Pod is repelled from it and lands in the general pool; the GPU Pod, with a node selector and matching toleration, lands in the GPU pool. _"Selectors pull Pods in. Taints keep the others out."_
2. Load rises on the general pool; the Pod dial adds replicas; the ones that don't fit sit greyed as Pending, and only then does the node dial add a node. Two dials, two moments. _"Pods scale first. Pending Pods make nodes."_
3. The GPU pool's demand drops to zero; its node dial scales it down to zero nodes, the pool frame emptying. _"Each pool scales on its own."_
4. A pending Pod needs a shape no pool has; node auto-provisioning spins up a brand-new pool just for it. _"Or a pool appears to fit."_
   **The moment**: Beat 2, the gap between the Pod dial moving and the node dial catching up — the two loops are visibly separate, not one.
   **Interaction**: Raise Pod load with a slider and watch Pod count rise first, node count follow after a delay.
   **Ending**: Three pools, sizes settled to match demand, one scaled to zero.
   **Variants**: `gcp-gke-autopilot-vs-standard`, `gcp-managed-instance-groups`; compares to Kubernetes HPA (Pods only).
   **Techniques**: boundary, contents, dial, restyle, spotlight, caption.
   **Review**: Improved — beat 1 had a GPU Pod landing on the general pool "by mistake" and a taint bouncing it, which gets the mechanics backwards (a taint repels Pods lacking a toleration; a node selector is what pulls a Pod to a pool); rewritten. Beat 2 now shows the trigger for node scale-up: Pending Pods. Weighed a single-dial story (cluster autoscaler only); worse, because the two-loop gap is the catalog's point. Checked: per-pool autoscaling to zero on non-default pools, node auto-provisioning creates pools, HPA scales Pods only.

### GKE release channels and upgrades (`gcp-gke-release-channels`)

**The aha**: In GKE, upgrades aren't something you opt out of — you choose how early you get new versions and when disruption may happen, then design workloads to survive the node drains that follow.
**Misconception to defeat**: That you can simply never upgrade a managed GKE cluster, the way you might neglect a self-managed one.
**Cast**: Four channel lanes (Rapid, Regular, Stable, Extended), each a track with version markers moving left to right, Rapid's arriving soonest. A cluster sits on one lane. A maintenance-window clock. A node draining, its Pods migrating to a sibling node behind a PodDisruptionBudget shield.
**Opening frame**: A regional cluster on the "Regular" lane, a new version marker approaching. _"You picked how early, not whether."_
**Story**:

1. The marker reaches the cluster; the maintenance-window clock lights green, and the control plane updates with a brief dot on the API line, unbroken. _"Control plane first, inside your window."_
2. Nodes update next: one drains, its Pods evict, a PodDisruptionBudget shield allows only one at a time to leave (GKE honours it for up to about an hour per node), each migrating to a sibling node first. _"Nodes drain in order, respecting your budget."_
3. A lone Pod with no replica and no budget is evicted anyway; a brief red gap shows in its traffic. _"Skip the budget, and the drain hurts."_
4. Switch lanes: Rapid's marker was already past; Stable's hasn't arrived yet. Then a cluster that held back with a maintenance exclusion reaches its version's end-of-support date and is upgraded anyway. _"Choose when. Not whether."_
   **The moment**: Beat 3 — the undefended Pod's visible gap, right beside beat 2's defended Pods gliding through with no gap at all.
   **Interaction**: Choose a channel and watch the version marker's arrival shift; add or remove a PodDisruptionBudget and compare the drain.
   **Ending**: All nodes on the new version, the PDB-protected Pods never having dropped a request.
   **Variants**: `gcp-gke-node-pools`, `gcp-gke-regional-clusters`; compares to hand-managed Kubernetes version skew.
   **Techniques**: lanes, timer, token, failure, side by side, caption.
   **Review**: Improved — the misconception ("just never upgrade") was named but never defeated on screen; beat 4 now shows the forced upgrade at end of support (exclusions delay, they don't cancel). Made the cluster regional so the unbroken API dot is true, and added the PDB time limit. Weighed leading with the forced-upgrade shock; kept the safe-then-unsafe drain as the moment because it teaches what the viewer can do. Checked: four channels, control plane before nodes, surge/blue-green node upgrades.

### VPC-native GKE networking and private clusters (`gcp-gke-vpc-native`)

**The aha**: Because Pods get real addresses from the VPC's own subnet ranges, firewalls, peering, Interconnect and load balancers see Pods directly with no extra hop — the price is reserving enough address space up front.
**Misconception to defeat**: That Pod IPs are an internal Kubernetes-only detail invisible to the surrounding network.
**Cast**: A subnet with a primary range (nodes) and two secondary ranges (Pods: a /22, room for four /24 node blocks; Services). One node inside it, with Pods drawn as boxes each carrying a real IP from the Pod secondary range. A load balancer's network endpoint group pointing straight at individual Pods, bypassing the node.
**Opening frame**: One node, its primary IP, and a mostly-empty Pod-range block beside it. _"Pods will come from here."_
**Story**:

1. Three Pods schedule onto the node; each takes an IP from the Pod secondary range — a whole /24 block (256 addresses, sized for the default 110 Pods) is reserved for this one node, most of it unused. _"Each node claims a whole block, even for a few Pods."_
2. A firewall rule targets Pods directly by their real IP range, no special case for "Pod traffic". _"The VPC just sees these as ordinary addresses."_
3. The load balancer's NEG sends a request dot straight into one Pod's IP, skipping the node's own IP. _"Container-native load balancing: straight to the Pod."_
4. Nodes two to four join, each taking another /24 block; a fifth is refused with "Pod range exhausted", though compute is free. _"Size secondary ranges for the cluster you'll grow into."_
   **The moment**: Beat 4 — a cluster unable to add a node not for lack of compute, but because the address math was planned too small.
   **Interaction**: Add nodes one at a time and watch the Pod-range pool deplete; resize the secondary range and watch headroom return.
   **Ending**: The subnet's three ranges each holding exactly what they need, headroom visible.
   **Variants**: `gcp-global-vpc`, `gcp-private-google-access`; compares to routes-based (legacy) clusters and overlay CNIs like Calico.
   **Techniques**: contents, meter, token, boundary, failure, caption.
   **Review**: Improved — numbers did not add up: with a /24 per node, a "fourth node" only exhausts a range if the range is a /22, which is now stated, so four nodes fit and the fifth fails. Stated the /24-for-110-Pods reservation. Private clusters (the second half of the title) stay a variant to keep to one idea. Weighed an overlay-CNI side-by-side; worse, since the exhaustion moment is the practical lesson. Checked: alias IPs from secondary ranges, container-native LB via NEGs straight to Pod IPs.

## Cloud Run and serverless

### Cloud Run: services, jobs, worker pools and functions (`gcp-cloud-run-resource-types`)

**The aha**: Pick the shape of the work — request-driven (service), run-to-completion (job), or pulling from a queue (worker pool) — and a "function" is now just a service built for you from source, sharing the same runtime and pricing as everything else.
**Misconception to defeat**: That Cloud Run functions are a separate, lesser product from Cloud Run services, the way AWS Lambda sits apart from Fargate.
**Cast**: Four cards: Service (a URL, request dots arriving), Job (a checklist that fills and stops), Worker pool (a queue feeding it continuously), Function (source code folding into the Service card). One container icon above them, unlabelled.
**Opening frame**: One plain container icon above the four empty cards. _"Same container. Four shapes of work."_
**Story**:

1. The container drops into Service: a URL appears, request dots arrive and get answered, it waits for more. _"Request comes in, answer, wait."_
2. The container drops into Job: a checklist fills in, it runs each task, then stops entirely, no URL. _"Run the list, then done."_
3. The container drops into Worker pool: a Pub/Sub queue feeds it continuously, no URL, no single request/response. _"Always on, pulling from a queue."_
4. Source code (not a container) is dropped onto Function: it visibly builds into a container, then slides into the Service card, identical to beat 1's result. _"A function is a service Google built for you."_
   **The moment**: Beat 4 — the function's source code resolving into the exact same card as a hand-built service, erasing the line between them.
   **Interaction**: Drop the container (or source code) onto each card and watch its behaviour play out.
   **Ending**: All four cards running side by side, Function now identical in shape to Service.
   **Variants**: `gcp-cloud-run-concurrency`, `gcp-cloud-run-autoscaling`, `gcp-choose-compute`; compares to AWS Lambda (functions only), App Engine, Cloud Functions 1st gen.
   **Techniques**: clone, contents, token, restyle, side by side, caption.
   **Review**: Keep — the shape-of-work framing (request, run-to-completion, queue) is the catalog's aha and beat 4 visibly defeats the "functions are a lesser product" misconception by resolving source into the same Service card. Weighed a decision-question path like choose-storage; worse, because `gcp-choose-compute` already owns the ladder and the same-container-four-shapes image is more memorable. Checked: services serve HTTP/gRPC on a URL, jobs run to completion on demand or schedule, worker pools are URL-less always-on consumers, Cloud Run functions are services built from source.

### Cloud Run revisions and traffic splitting (`gcp-cloud-run-revisions-traffic`)

**The aha**: Releases and rollbacks are traffic moves, not redeploys — every change creates a new, immutable revision, and you shift a percentage of traffic to it whenever ready, instantly reversible.
**Misconception to defeat**: That deploying a new version replaces the old one, so rolling back means redeploying the old code.
**Cast**: A service box "api". Below, a stack of immutable revision cards (rev-1 grey, rev-2 blue), each with its own tag URL. A traffic-split bar above, divided by percentage. Request dots pour from the top, forking at the split bar.
**Opening frame**: rev-1 alone, traffic bar at 100% rev-1, all dots landing on it. _"One revision, all the traffic."_
**Story**:

1. rev-2 is deployed with traffic held back (by default a deploy sends 100% to the latest revision; here traffic is pinned to rev-1): a new card appears, the bar stays 100% on rev-1, rev-2 gets zero dots. _"Deploying makes a revision. You decide when it gets traffic."_
2. rev-2's own tag URL is hit directly by a tester's dot, bypassing the split. _"Test it at its own URL first."_
3. The traffic bar splits: 95% rev-1, 5% rev-2, a few dots now land on rev-2. _"Shift a slice, watch it."_
4. The bar slides fully to rev-2; rev-1's dot stream stops, but its card stays intact, scaled to zero instances and costing nothing. _"Full cutover — the old revision still exists."_
5. A problem appears on rev-2 (red flash); the bar slides instantly back to 100% rev-1. _"Rollback: just move the bar back."_
   **The moment**: Beat 5 — the instant reversal, with no redeploy, because rev-1 never went away.
   **Interaction**: Drag the traffic-split bar between revisions; click a revision's own tag URL to test it in isolation.
   **Ending**: Traffic bar back at 100% on the known-good revision, the failed one visible but silent.
   **Variants**: `gcp-cloud-run-resource-types`; compares to Cloud Deploy canaries, Kubernetes rolling updates.
   **Techniques**: contents, token, clone, meter, failure, caption.
   **Review**: Improved — beat 1 implied a new deploy gets no traffic, but by default Cloud Run routes 100% to the latest revision; it now shows the pinned/no-traffic deploy explicitly so the viewer is not misled. Added that the idle old revision scales to zero. Weighed starting from the failure (a bad deploy and instant rollback); worse, as the build-up makes the rollback beat the payoff. Checked: immutable revisions, tag URLs, percentage splits, instant rollback.

### Cloud Run concurrency (`gcp-cloud-run-concurrency`)

**The aha**: One Cloud Run instance serves many requests at once, up to a concurrency limit — unlike classic functions-as-a-service, where every request gets its own instance.
**Misconception to defeat**: "Cloud Run handles one request per instance like Lambda."
**Cast**: Two columns side by side. Left "FaaS model": a row of boxes, a new one for each request in flight at the same time; a box may be reused later, but never holds two at once. Right "Cloud Run instance": one box, concurrency limit "80" on its rim, request dots accumulating inside as they arrive.
**Opening frame**: Both sides at rest; left an empty row, right one empty box reading "0/80". _"Same traffic about to arrive."_
**Story**:

1. Five slow request dots arrive together. Left: five fresh boxes appear. Right: all five sit inside the one box, counter "5/80". _"FaaS: five instances. Cloud Run: one instance, five requests."_
2. Fifty more arrive while those are still running. Left: fifty more boxes crowd the screen. Right: the same box holds 55 dots, counter "55/80", still one box (if CPU runs hot, Cloud Run adds a second box anyway). _"Instances stay low while concurrency has room."_
3. The concurrency dial drags to "1": now each new dot spawns a fresh instance box on the right too, visually matching the left. _"Set it to 1, and it behaves like FaaS."_
4. The dial drags to "1000": thousands of dots pack into very few boxes. _"Higher concurrency, fewer instances, fewer cold starts, lower cost — if the code is thread-safe and CPU keeps up."_
   **The moment**: Beat 1 — the literal side-by-side, five boxes vs. one box holding five dots, the exact image the misconception gets wrong.
   **Interaction**: Drag the concurrency-limit dial and watch instance count respond inversely, request load held constant.
   **Ending**: Right side settled at a sensible concurrency, few instances, each comfortably full.
   **Variants**: `gcp-cloud-run-autoscaling`, `gcp-cloud-run-resource-types`; compares to AWS Lambda (fixed one request per execution environment).
   **Techniques**: contents, side by side, dial, token, caption.
   **Review**: Improved — the left column had boxes "disappearing after", which wrongly suggests FaaS instances are single-use; they are reused, but never hold two requests at once, so the dots now overlap in time (slow requests). Added that CPU, not just the limit, can trigger another instance. Alternative weighed: a Lambda-vs-Cloud-Run branded comparison; the generic FaaS column is fairer and still names Lambda in Variants. Checked: default 80, max 1000, 1 for non-thread-safe code.

### Cloud Run autoscaling, cold starts and billing modes (`gcp-cloud-run-autoscaling`)

**The aha**: Scale to zero means no idle cost and a cold start on the next request; minimum instances trade a small standing cost for skipping that cold start — and under request-based billing, CPU disappears the instant the response is sent, so work after the response needs instance-based billing or a worker pool.
**Misconception to defeat**: That a Cloud Run instance's CPU is always "on" while it exists, the way a VM's is.
**Cast**: An instance-count meter that can hit "0". One instance box with a CPU meter that visibly switches on and off. A "min instances" dial. A toggle between request-based and instance-based billing. A background task icon ("flush logs") drawn after the main response.
**Opening frame**: Zero instances, cost meter flat at zero. _"Idle. Nothing running, nothing billed."_
**Story**:

1. A request dot arrives: a cold instance box appears with a visible startup delay before it answers. _"Scale to zero: next request pays a cold start."_
2. "Min instances" is set to 1: an instance now sits warm with zero traffic; cost ticks up slightly, but the next request skips the spinner. _"A small standing cost buys away the cold start."_
3. On request-based billing, a request is answered and the instance's CPU meter snaps to zero immediately, even though a "flush logs" task is mid-flight inside the box, now frozen; it resumes only if another request happens to arrive. _"CPU is gone the instant the response leaves — frozen work included."_
4. Toggle to instance-based billing: the same background task now completes, CPU meter staying lit until it finishes, and the cost meter now ticks for every second the instance exists, idle included. _"Instance-based: CPU, and the bill, for the instance's whole life."_
   **The moment**: Beat 3 — the frozen "flush logs" icon, stalled mid-animation the instant CPU is pulled.
   **Interaction**: Toggle billing mode and watch the background task either freeze or finish; drag min-instances and watch the cold-start spinner appear or vanish.
   **Ending**: Min instances at 1, instance-based billing, background task completing cleanly every time.
   **Variants**: `gcp-cloud-run-concurrency`, `gcp-cloud-run-resource-types`; compares to GKE's Horizontal Pod Autoscaler.
   **Techniques**: meter, timer, toggle, dial, restyle, caption.
   **Review**: Improved — made the frozen task honest (throttled, not killed, and woken only by a later request) and showed the price of instance-based billing so the ending is not a free win. Weighed splitting cold start/min instances from billing modes; the catalog keeps them together and the shared "what is billed when" meter links them. Checked: request-based CPU only during requests, instance-based CPU for the instance lifetime, min instances warm, scale to zero.

### Cloud Run ingress, authentication and VPC egress (`gcp-cloud-run-networking`)

**The aha**: A Cloud Run URL is reachable from the internet by default, but every caller still needs a Google-signed identity token with Invoker permission unless you explicitly allow unauthenticated calls — reachable isn't authorized.
**Misconception to defeat**: That a public-looking HTTPS URL for a Cloud Run service means it's open to anyone who finds it.
**Cast**: A Cloud Run service with its URL exposed, a globe showing it's internet-reachable. An Invoker gate just inside the URL checking an ID token. Callers: an anonymous browser (no token), a service account "caller-svc" (with a token), and an `allUsers` toggle. A VPC egress path out the back to a private database.
**Opening frame**: The URL reachable (globe lit), the Invoker gate shown closed by default. _"Reachable, but gated."_
**Story**:

1. The anonymous browser's dot arrives with no token; the gate bounces it, "403 — not authorized" (no token, no Invoker). _"Reachable isn't authorized."_
2. `caller-svc`'s dot arrives with a Google-signed ID token whose audience is the service URL; the gate checks the caller against Invoker, opens, the dot passes. _"Identity, not network location, decides."_
3. The `allUsers` toggle flips on: the anonymous dot now passes too, gate wide open. _"Unless you choose this, deliberately."_
4. The service's own outbound request, headed for a private Cloud SQL instance, is rerouted through Direct VPC egress into the VPC instead of the public internet. _"Outbound into your VPC needs its own path too."_
5. Ingress is restricted to "internal only": the anonymous dot now bounces at the door, before even reaching the gate (ingress is checked first). _"Ingress settings decide who can even knock."_
   **The moment**: Beat 1 — the request reaching a perfectly live, internet-facing URL and still bouncing, because reachability and authorization are different gates.
   **Interaction**: Toggle `allUsers` and ingress settings, and watch which callers' dots get through.
   **Ending**: Gate closed to the public, open only to `caller-svc`'s signed token.
   **Variants**: `gcp-service-account-impersonation`, `gcp-private-google-access`; compares to VPC firewall rules (which don't govern this) and IAP.
   **Techniques**: token, boundary, toggle, failure, path trace, caption.
   **Review**: Improved — a call with no token gets 403 from Cloud Run, not 401 (401 is for a malformed or expired token), so the bounce label was wrong; added the token audience and that ingress is checked before IAM. Weighed leading with "internal-only" as the safe default; worse, since the default (public URL, closed gate) is the surprising bit. Misconception defeated by beat 1. Checked: ingress options, Invoker, allUsers, Direct VPC egress.

## Storage

### Choosing storage: object, block or file (`gcp-choose-storage`)

**The aha**: Decide by how the application reads data — through an HTTP API at any scale (object), as a disk owned by one VM (block), or as a shared POSIX file system for many clients (file) — and mounting a bucket with FUSE doesn't make it a real file system.
**Misconception to defeat**: Picking a storage type by habit rather than by the access pattern.
**Cast**: A question path with three branches: "An API, any scale?" → Cloud Storage. "A disk for one VM?" → Persistent Disk/Hyperdisk/Local SSD. "A shared folder tree for many clients?" → Filestore/NetApp/Lustre. A dashed fourth path: "Just want files on a bucket?" → Cloud Storage FUSE, with a warning badge.
**Opening frame**: Three questions unanswered, each leading to a dimmed service icon. _"Three questions, three answers."_
**Story**:

1. "An API, any scale?" lights: a client PUTs an object by key into a bucket tray. _"Object: through HTTP, by key."_
2. "A disk for one VM?" lights: a VM boots from, and exclusively owns, a Persistent Disk; a second VM's cable to write to it bounces (extra VMs can only read). _"Block: one writer."_
3. "A shared folder tree?" lights: three VMs mount the same Filestore path and all see the same files, with locking. _"File: shared POSIX access."_
4. The dashed FUSE path lights: a bucket mounted as `/mnt/photos`; an app tries to lock a file and edit it in place: the lock bounces, and a save replaces the whole object. _"FUSE dresses a bucket as folders. It's still an object store underneath: no locking, no in-place edits."_
   **The moment**: Beat 4 — the FUSE mount looking exactly like a file system until the lock request bounces, revealing the object store underneath.
   **Interaction**: Answer the question path and watch the matching service light; try the FUSE mount's lock to see it fail.
   **Ending**: All three real answers lit and running; the FUSE shortcut shown for what it actually is.
   **Variants**: `gcp-choose-database`, `gcp-gcs-storage-classes`, `gcp-block-storage`; compares to choosing among AWS S3, EBS, EFS.
   **Techniques**: choice, path trace, token, failure, spotlight, caption.
   **Review**: Improved — "one owner" was too strong: a Persistent Disk can be attached read-only to several VMs, so the claim is one writer; FUSE beat now says what actually fails (locking, and in-place edits that become whole-object rewrites). Weighed a table of access-pattern examples; worse than the question path, which makes the viewer decide. Checked: Filestore/NetApp/Managed Lustre as the file tier, FUSE has no locking.

### Cloud Storage classes (`gcp-gcs-storage-classes`)

**The aha**: Every class returns data in milliseconds through the same API — Archive isn't slow, it's expensive to read (and to delete early); choose by how often you read, not by how fast you need it back.
**Misconception to defeat**: That colder classes mean slower retrieval, the way AWS Glacier can mean hours.
**Cast**: Four shelves at growing distance from a desk: Standard (near), Nearline (30-day tag), Coldline (90-day), Archive (365-day, back room), plus a zonal "Rapid" shelf right beside the desk. Each shelf has a storage-price and retrieval-price tag. A stopwatch above all four, reading the same few milliseconds throughout.
**Opening frame**: The same object sitting on all four shelves, a stopwatch above each, all reading the same few milliseconds. _"Same speed, every shelf."_
**Story**:

1. A GET fires at Archive: it returns in the same few milliseconds as Standard — but the bill ticks up with a retrieval fee Standard never charged. _"Archive isn't slow. It's expensive to read."_
2. The object sits unread on Archive for a year, its storage-price tag barely moving. _"Cheap to just sit there."_
3. The object is deleted from Archive after 60 days: an early-deletion penalty lands on the bill, since Archive promises 365 days: the remaining 305 days of storage are billed. _"Leave early, pay anyway."_
4. An ML workload needing massive parallel throughput lights the Rapid shelf instead, a speed badge: the one class that is faster, and it lives in a single zone. _"Rapid is chosen for speed, not frequency."_
   **The moment**: Beat 1 — the stopwatch reading the identical millisecond reading for Archive as for Standard, directly contradicting the instinct that cold means slow.
   **Interaction**: Fire a GET at any shelf and watch the stopwatch stay constant while only the bill changes; try deleting early and see the penalty.
   **Ending**: Four shelves, same stopwatch reading across all, bills diverging sharply.
   **Variants**: `gcp-gcs-lifecycle-autoclass`, `gcp-choose-storage`; compares to AWS S3 Glacier tiers (hours to restore) and bucket location as a separate choice.
   **Techniques**: contents, meter, timer, token, side by side, caption.
   **Review**: Improved — removed the invented "12 ms" figure (latency varies; the point is that it is the same), made the early-deletion penalty concrete (305 days billed), and said Rapid is zonal. Weighed pricing per GB as the lead; worse, because the same-speed stopwatch is what breaks the Glacier instinct. Checked: Nearline 30, Coldline 90, Archive 365 days; all classes millisecond access; retrieval fees rise as classes get colder.

### Object Lifecycle Management and Autoclass (`gcp-gcs-lifecycle-autoclass`)

**The aha**: Lifecycle rules follow the calendar, Autoclass follows actual behaviour — use rules when the access pattern is known, Autoclass when it isn't; with Autoclass a read brings an object straight back to Standard, with no fee.
**Misconception to defeat**: That you must pick one storage class forever, or manually watch access patterns yourself.
**Cast**: A bucket of objects, each with an age badge. A "Lifecycle rules" panel: "age > 30d → Nearline", "age > 365d → delete". An "Autoclass" toggle on the same bucket, watching each object's actual read activity instead of age.
**Opening frame**: A bucket, lifecycle rules written but inactive, all objects on Standard. _"Rules are written. Nothing's moved yet."_
**Story**:

1. A timer runs 30 days: objects crossing the age line slide from Standard to Nearline automatically. _"Lifecycle: moves by the calendar."_
2. The timer runs to 365 days: the oldest objects vanish, deleted by rule. _"And deletes by it."_
3. Switch the bucket to Autoclass: an object untouched for a while has already drifted to Nearline on its own (the default floor; Coldline or Archive if you allow them), no rule written for it. _"Autoclass watches behaviour, not dates."_
4. That object gets read once: it snaps straight back to Standard immediately, no retrieval fee, no early-deletion penalty. _"A read brings it home, free."_
5. Autoclass adds a small per-object fee and leaves objects under 128 KiB in Standard. Side by side: an unpredictable access log (Autoclass, drifting and snapping back) next to a known nightly-log pattern (lifecycle rule, moving precisely at 30 days). _"Known pattern: rules. Unknown: Autoclass."_
   **The moment**: Beat 4 — the object snapping back to Standard on a single read with no fee, the opposite of what a lifecycle-ruled object would do.
   **Interaction**: Toggle Lifecycle vs Autoclass on the same bucket and watch the same object's class drift differently under each.
   **Ending**: Two buckets side by side, one calendar-driven, one behaviour-driven, both settled correctly.
   **Variants**: `gcp-gcs-storage-classes`, `gcp-choose-storage`; compares to S3 Intelligent-Tiering, and to retention policies which prevent deletion rather than perform it.
   **Techniques**: timer, move, toggle, meter, side by side, caption.
   **Review**: Improved — Autoclass's default terminal class is Nearline, so "drifted to Coldline" only holds if Coldline/Archive is allowed; fixed, and added the management fee and small-object exception that decide when Autoclass is the wrong tool. Weighed a pure cost graph; worse, since the snap-back-on-read is the vivid difference. Checked: lifecycle conditions (age, class, newer versions), Autoclass no retrieval or early-deletion fees, read returns object to Standard.

### Bucket locations and turbo replication (`gcp-gcs-locations`)

**The aha**: Location buys availability and a recovery point, not just geography — a regional bucket survives a zone loss, a dual- or multi-region bucket survives a region loss, and reads stay strongly consistent everywhere; turbo replication adds a known 15-minute recovery target.
**Misconception to defeat**: Thinking bucket location is only about latency to users, like a CDN edge choice.
**Cast**: A region boundary with three zone frames (regional bucket) versus a region pair A/B joined by a replication stream (dual-region). A write token lands in Region A; a trailing copy streams toward Region B with a visible lag gap. A "turbo replication" badge shrinking that gap's target to 15 minutes.
**Opening frame**: A regional bucket, its object already replicated silently across three zones. _"Regional: safe from a zone, by default."_
**Story**:

1. One zone fails (red flash, greys): the object is untouched, served from the surviving zones. _"Zone loss, no problem."_
2. The whole region fails: the regional bucket's object is unreachable entirely. _"But a region loss takes it all."_
3. Switch to dual-region: the same write lands in Region A and streams toward Region B; Region A fails before the stream finishes — Region B carries on serving everything it had, but the newest writes are missing from it (until A returns). _"Async replication: a region survives, but the newest writes may not be there. Default: 99.9% within an hour."_ A multi-region (US, EU, ASIA) bucket makes the same trade over a wider area; clients change nothing.
4. Turbo replication switches on: the same scenario replays with the gap target shrunk: 100% of new objects within 15 minutes, visibly tighter. _"A known, tighter recovery point — for a fee."_
5. A read request lands on either region at any time and gets a strongly consistent answer. _"Consistency isn't the trade here — recovery point is."_
   **The moment**: Beat 3, slowed — the write token caught mid-flight between regions, lost when A fails before B receives it.
   **Interaction**: Fail a zone vs. a whole region on each bucket type; toggle turbo replication and compare the gap width.
   **Ending**: Dual-region bucket with turbo replication, Region A failed, Region B serving everything except the last few minutes.
   **Variants**: `gcp-regions-zones`, `gcp-choose-storage`; compares to S3 Cross-Region Replication.
   **Techniques**: boundary, stream, token, failure, timer, side by side, caption.
   **Review**: Improved — "lost" overstated: unreplicated writes are missing from B (and unavailable until A recovers, lost only if A is gone); made the default (99.9% within an hour) and turbo target (15 minutes for all new objects) exact, and said failover needs no client change. Weighed a latency-map framing; that is the misconception itself. Checked: location fixed at creation, strongly consistent reads, regional spans zones.

### Cloud Storage access: uniform bucket-level access, public access prevention and signed URLs (`gcp-gcs-access-control`)

**The aha**: Make access boring and central — IAM only, nothing public — and when someone without a Google identity needs one file, hand out a short-lived signed URL instead of opening the bucket.
**Misconception to defeat**: That per-object ACLs are a finer, better-controlled way to share files than "just" IAM.
**Cast**: A bucket with scattered per-object ACL tags next to a bucket-level IAM shield. A "Uniform bucket-level access" switch that strips every per-object ACL away when flipped. A "Public access prevention" padlock that blocks any grant to `allUsers`. A signed-URL generator with a visible countdown.
**Opening frame**: A bucket with scattered, inconsistent per-object ACLs. _"Every object, its own rules."_
**Story**:

1. Uniform bucket-level access flips on: every per-object ACL goes inert (stored, no longer consulted); only the bucket's IAM shield decides. _"One shield, not a thousand little locks."_
2. Someone tries to grant `allUsers` read access: public access prevention's padlock snaps shut, refusing it outright. _"Nothing public, enforced, not just discouraged."_
3. An external customer with no Google identity needs one PDF: a signed URL is generated, countdown "expires in 1 hour", handed to them directly; it carries the signing service account's access, nothing more. _"They get one object, briefly, without ever touching the bucket."_
4. The countdown hits zero: the same URL now bounces. _"And then it's gone."_
   **The moment**: Beat 2 — the padlock refusing `allUsers` even though someone just tried to grant it, showing the guardrail is active, not just a policy document.
   **Interaction**: Try to grant `allUsers` and watch it bounce; generate a signed URL and watch it expire.
   **Ending**: One IAM shield, padlock shut, one time-limited signed URL mid-countdown for the one legitimate external need.
   **Variants**: `gcp-iam-roles`, `gcp-gcs-data-protection`; compares to legacy object ACLs and AWS S3 presigned URLs.
   **Techniques**: toggle, boundary, failure, timer, token, caption.
   **Review**: Improved — ACLs are not deleted by uniform access, they are ignored (and return if it is switched off within the grace period), so "dissolve" was wrong; added that a signed URL borrows its signer's permissions, the thing people forget. Weighed starting from a leak story; worse than the padlock bouncing allUsers, which shows prevention live. Checked: public access prevention blocks allUsers/allAuthenticatedUsers; signed URLs are time-limited and per-operation.

### Versioning, soft delete, retention policies and Bucket Lock (`gcp-gcs-data-protection`)

**The aha**: Versioning and soft delete undo accidents; a locked retention policy defeats even an Owner or an attacker trying to delete compliance data outright — they answer different threats.
**Misconception to defeat**: Treating all four as interchangeable "backup" settings rather than defences against different kinds of loss.
**Cast**: An object `contract.pdf` with a version stack behind it (v1, v2, v3). A soft-delete grace window (7 days, countdown) holding anything just deleted. A retention-policy padlock with an age threshold, and a Bucket Lock that, once set, turns the padlock's outline solid — even an "Owner" badge bounces off it.
**Opening frame**: `contract.pdf` v3 current, v1 and v2 stacked behind it, undefended. _"A history, so far undefended."_
**Story**:

1. Someone overwrites v3 by mistake: v2 is still there, one click restores it. _"Versioning undoes an overwrite."_
2. Someone deletes the object entirely: it sits in the 7-day soft-delete window, countdown visible, then one click restores it. _"Soft delete undoes a deletion — for a window."_
3. A retention policy sets a 7-year floor; before Bucket Lock, an admin edits the policy down to zero, shortens the soft-delete window to nothing and deletes early anyway. _"An unlocked policy, or soft delete, is just a setting."_
4. Bucket Lock is applied: the padlock solidifies. The same admin, even with Owner role, tries to delete or shorten the policy — both bounce. _"Locked, it can only be made longer — by anyone."_
   **The moment**: Beat 4 — an Owner badge, the most powerful role there is, bouncing off the locked padlock exactly like an attacker would.
   **Interaction**: Try to delete or shorten the policy before and after locking it; restore from soft delete within and after its window.
   **Ending**: `contract.pdf` under a solid, locked padlock, seven years from release, untouchable early.
   **Variants**: `gcp-gcs-lifecycle-autoclass` (which deletes; this keeps), `gcp-backup-dr`; compares to backup vaults.
   **Techniques**: layers, timer, failure, boundary, restyle, caption.
   **Review**: Improved — the plan showed soft delete as the safety net but never that its window is an editable setting too; beat 3 now shows an admin switching both off, which sets up why only the lock holds. Weighed a four-threats matrix; the escalating story (overwrite, delete, admin, attacker) already carries it. Misconception (all interchangeable) is defeated by each layer failing at a different step. Checked: soft delete 7 days default, versioning keeps noncurrent versions, locked policy can only lengthen.

### Persistent Disk vs Hyperdisk vs Local SSD (`gcp-block-storage`)

**The aha**: Network disks outlive the VM and can be snapshotted, resized, and (if regional) force-attached elsewhere after a zone failure; Local SSD is far faster but vanishes the moment the VM stops — and Hyperdisk lets you buy performance and capacity as two separate dials instead of over-sizing for IOPS.
**Misconception to defeat**: That all VM-attached disks behave the same, or that a bigger disk is the only way to get more IOPS.
**Cast**: A VM with three disk types cabled to it: Persistent Disk (a network disk reaching outside the VM, a size dial and a performance bar that grows with size), Hyperdisk (same network icon, two independent dials: capacity and IOPS/throughput), Local SSD (a disk drawn physically inside the VM box itself).
**Opening frame**: One VM, three disks attached, each a different distance from it. _"Not all disks are the same disk."_
**Story**:

1. The VM is stopped: the Persistent Disk and Hyperdisk data disks, sitting outside the VM, remain intact; Local SSD, inside the VM box, is wiped. (Deleting the VM would also take a boot disk set to auto-delete.) _"Local SSD's data dies with the VM."_
2. Persistent Disk's size dial drags up: its IOPS bar grows automatically alongside it, even when more IOPS wasn't really needed. _"Performance is tied to size — you overpay for space to get speed."_
3. Switch to Hyperdisk: capacity dial stays put, IOPS dial drags up alone, performance rising with no size change, even while attached. Newer machine series take only Hyperdisk. _"Buy performance and size separately."_
4. A zone fails: a Regional Persistent Disk (or Hyperdisk Balanced HA), replicated synchronously to a second zone, force-attaches to a VM there and keeps serving. A zonal disk in the same failure just goes dark. _"Regional variants survive the zone they're not currently in."_
   **The moment**: Beat 1 — the VM disappearing and Local SSD's data disappearing in the same instant, while the two network disks sit untouched just outside the VM box.
   **Interaction**: Stop/delete the VM and watch which disks survive; drag Hyperdisk's two dials independently and watch cost and performance respond separately.
   **Ending**: A Regional Hyperdisk Balanced HA serving from the surviving zone after the other zone's failure.
   **Variants**: `gcp-snapshots-images`, `gcp-choose-storage`; compares to Filestore (shared file system) and AWS EBS.
   **Techniques**: boundary, dial, failure, meter, side by side, caption.
   **Review**: Improved — "VM deleted, network disks remain" is wrong for a boot disk, which auto-deletes by default; the test is now a stop, which is what separates Local SSD cleanly, with the boot-disk caveat stated. Added live resizing and that newer series are Hyperdisk-only. Weighed a pure cost chart; worse, the survives-or-not beat is the sharper contrast. Checked: PD performance scales with size, Hyperdisk performance provisioned separately, regional PD / Hyperdisk Balanced HA sync-replicate across two zones.

### Moving data into Google Cloud (`gcp-data-transfer-options`)

**The aha**: Do the arithmetic first — 100 TB takes about 12 days over a 1 Gbps link and about four months over 100 Mbps, while a shipped Transfer Appliance takes a few weeks door to door whatever the link — so the slower the link and bigger the data, the sooner the appliance wins; live databases migrate with continuous replication so cutover takes minutes.
**Misconception to defeat**: That "just copy it over the network" always works given enough patience, or that a database migration must mean a long downtime window.
**Cast**: Two lanes: "network" (a data-volume meter sliding along a bandwidth-limited pipe, a day-counter ticking) and "appliance" (order, ship, copy, ship back, ingest, as five ticks on a stage bar and a truck crossing a map). A separate lane for Database Migration Service / Datastream: a source DB streaming continuous change events into a target DB, with a short "cutover" flag at the end.
**Opening frame**: 100 TB sitting at the start of both the network and appliance lanes, day-counter at zero. _"Same data. Two ways there."_
**Story**:

1. The network lane's meter crawls at 1 Gbps; the day-counter climbs to about 12 days before the volume meter reaches the end. _"1 Gbps: 12 days, if nothing else uses the link."_
2. The link drops to 100 Mbps: the counter races on past 100 days toward four months. _"100 Mbps: four months."_
3. The appliance lane's stages tick through order, shipping, copy, return and ingest: a few weeks, the same at any link speed. _"The appliance takes weeks, whatever the link."_ A caption notes small or medium data, or cloud-to-cloud, goes by `gcloud storage` or Storage Transfer Service.
4. The database lane starts: a continuous stream of change events flows from source to target while the source keeps serving live traffic, target staying in near-lockstep. _"Replicate continuously, while it's still live."_
5. The "cutover" flag drops: traffic switches to the target in minutes, the gap already nearly zero. _"Cutover is minutes, because the copying already finished."_
   **The moment**: Beats 2 and 3 — the 100 Mbps day-counter still climbing long after the appliance's stage bar has finished.
   **Interaction**: Dial the data volume and the link bandwidth and watch the crossover point where shipping an appliance wins (at 1 Gbps it is close; at 100 Mbps it is not).
   **Ending**: The appliance lane complete, and separately, the database's cutover flag dropped with no visible gap.
   **Variants**: `gcp-cloud-interconnect` (the path, not the tool); compares generally to any "move data to the cloud" decision.
   **Techniques**: meter, timer, token, stream, side by side, dial, caption.
   **Review**: Improved — a real slip: the appliance "arrives in 2 days flat" ignores order, copy, return and ingest (weeks), which would have made 100 TB at 1 Gbps look like an easy appliance win when the two are close. Added the 100 Mbps case where the gap is unmistakable and a stage bar for the appliance. Weighed one dial-only comparison; kept the two concrete speeds because the viewer should feel the numbers. Checked: 100 TB at 1 Gbps about 12 days (Google's own table, ~80% utilisation), DMS/Datastream continuous replication with minutes of cutover.

## Databases

### Choosing a Google Cloud database (`gcp-choose-database`)

**The aha**: Start from access pattern and scale, not familiarity — relational at modest scale, relational at global horizontal scale, documents synced to clients, huge key-based throughput, and analytics are five different shapes of problem with five different right answers.
**Misconception to defeat**: Mapping Google's databases one-to-one onto AWS's (Cloud SQL = RDS, Firestore = DynamoDB) and picking by that analogy instead of by the actual need.
**Cast**: A question path: "SQL and joins, modest scale?" → Cloud SQL / AlloyDB. "SQL, horizontal, multi-region writes?" → Spanner. "Documents synced to clients?" → Firestore. "Millions of key-based reads/writes per second?" → Bigtable. "Analytical scans over huge data?" → BigQuery (marked "not transactional"). Each answer lights its service icon. A dimmed side branch, "a fast cache in front?", points to Memorystore.
**Opening frame**: Five dimmed service icons under five unanswered questions. _"Five shapes of problem."_
**Story**:

1. "SQL and joins, modest scale?" lights Cloud SQL: a single-region relational icon with joined tables. _"The familiar shape, at a familiar scale."_
2. "SQL, horizontal, multi-region writes?" lights Spanner instead of Cloud SQL — a globe with multiple write regions. A Cloud SQL box beside it labels the limit: one writer, scaled up not out. _"Same SQL, but when writes outgrow one machine or need another region, Spanner."_
3. "Documents synced to clients?" lights Firestore: a mobile app and a web app both holding a live-updating copy of the same document. _"Built for client sync, not server joins."_
4. "Millions of key-based reads/writes per second?" lights Bigtable: a huge grid of rows keyed by one column, a time-series stream pouring in. _"No relations, pure key-based throughput."_
5. "Analytical scans over huge data?" lights BigQuery, a caption crossing out a transactional-looking icon beside it. _"Not a place to run your app's transactions."_
   **The moment**: Beat 2 — the same "SQL" starting point branching to a different answer purely because of scale, not familiarity.
   **Interaction**: Answer the question path and watch exactly one icon light; try forcing an AWS-analogy match and see a caption flag the mismatch.
   **Ending**: All five questions answered, five icons lit, none interchangeable.
   **Variants**: `gcp-spanner-truetime`, `gcp-bigtable-row-keys-tablets`, `gcp-firestore-modes`, `gcp-alloydb`, `gcp-bigquery-architecture`; compares to AWS RDS/Aurora/DynamoDB/Redshift mapped one-to-one (the trap).
   **Techniques**: choice, path trace, spotlight, caption.
   **Review**: Improved — beat 2's caption said "scale" without saying which scale; it is write scale and regions (Cloud SQL scales reads out through replicas, writes only up). Added the Memorystore side branch the catalog lists. Weighed an AWS-to-Google mapping table; that is the trap the plan warns about. Checked: Cloud SQL/AlloyDB regional relational, Spanner horizontal, Firestore client sync, Bigtable key-based, BigQuery not transactional.

### Cloud SQL high availability vs read replicas (`gcp-cloud-sql-ha-replicas`)

**The aha**: HA and read replicas solve different problems — the standby protects against a zone failure but serves no reads; replicas scale reads and give cross-region disaster recovery, but lag and must be promoted by hand.
**Misconception to defeat**: Thinking a standby is just another replica you could read from, or that a read replica is automatically ready to take over.
**Cast**: A primary Cloud SQL instance in Zone 1. Its HA standby in Zone 2, joined by a solid synchronous-replication line, labelled "no read traffic". Two read replicas further out (same region in a third zone, and another region), joined by dashed asynchronous lines with a visible lag gap, each servable by read-only clients.
**Opening frame**: Primary serving writes and reads; standby dark and idle; replicas lit, serving reads. _"One protects. Two others scale reads."_
**Story**:

1. A client tries to read from the standby: bounced, "standby accepts no traffic". _"It's not a replica you can use — it's insurance."_
2. Zone 1 fails: the primary goes dark; within about a minute the standby takes over as primary, same IP, writes resume. _"Automatic failover, same address."_
3. Meanwhile, the read replica in the third zone, a few seconds behind, keeps serving reads (stale by its lag) while it re-attaches to the new primary. _"Replicas keep serving — they were never tied to that zone."_
4. The whole region holding primary and standby fails: the cross-region read replica is manually promoted to a standalone writable primary, a deliberate click, not automatic; whatever the replica had not yet received is lost. _"Cross-region DR, but you promote it, and it lags."_
   **The moment**: Beat 1 — the client's read bouncing off the standby, the moment that kills the "it's just another copy" idea.
   **Interaction**: Fail Zone 1 and watch automatic failover; fail the whole region and promote the replica by hand, noting the lag it carried.
   **Ending**: The promoted cross-region replica now serving as primary, the old primary's region dark.
   **Variants**: `gcp-alloydb`, `gcp-regions-zones`, `gcp-spanner-splits-configs`; compares to AWS RDS Multi-AZ vs read replicas.
   **Techniques**: boundary, failure, token, timer, choice, caption.
   **Review**: Improved — "untouched" overstated what a replica does when its primary fails over (it re-attaches), and a same-region replica only survives if it sits in another zone; fixed. Promotion now shows the lag as lost data, which is why DR replicas are not HA. Weighed an AWS Multi-AZ framing; same split, but adds nothing for this audience. Misconceptions defeated in beats 1 and 4. Checked: synchronous standby in another zone, failover about a minute with the same IP, async replicas, manual promotion.

### AlloyDB for PostgreSQL (`gcp-alloydb`)

**The aha**: Because AlloyDB's storage layer itself replicates the data — rather than each replica copying the write-ahead log — failover is fast, read pools scale without full copies, and analytics run on fresh operational data; it's still single-primary and regional, unlike Spanner.
**Misconception to defeat**: Treating AlloyDB as "just a faster Cloud SQL" rather than a different storage architecture underneath the same PostgreSQL surface.
**Cast**: A primary compute node and several read-pool compute nodes all plugged into one shared, regional, log-based storage layer, rather than each having its own disk copy. A columnar-engine badge on the compute nodes (it is a cache in the nodes' memory, filled from the shared row data). A side note: "AlloyDB Omni: same engine, on-prem or other clouds."
**Opening frame**: One primary compute node and two read-pool nodes, all three plugged into one shared storage layer below. _"Compute nodes share one storage layer."_
**Story**:

1. Contrast inset: a classic Cloud SQL replica, each with its own full disk copy, data duplicated. _"The old way: copy the whole disk per replica."_
2. AlloyDB's read-pool nodes instead just plug into the same storage layer, no disk duplication, appearing almost instantly. _"Here: new compute, same storage. No copy to wait for."_
3. The primary fails: its standby compute node (in another zone) takes over, attached to the same storage layer, which already holds every committed write, so there is nothing to catch up. _"Storage didn't move, so neither did the data."_
4. An analytical query runs on a read-pool node's columnar engine over the same fresh data the primary just wrote. _"Analytics on live operational data, not yesterday's export."_
5. A caption lands: "Still one primary, one region", contrasted against a dimmed Spanner icon with multiple write regions. _"Not Spanner. Faster single-primary Postgres."_
   **The moment**: Beat 3 — the new primary starting work at once because there was never a second copy of storage to catch up.
   **Interaction**: Toggle "classic replica / AlloyDB read pool" and compare what each has to copy or replay before it is usable.
   **Ending**: Primary, two read pools, one storage layer, failover already done.
   **Variants**: `gcp-cloud-sql-ha-replicas`, `gcp-spanner-truetime`; compares to Amazon Aurora's similar disaggregated design.
   **Techniques**: side by side, clone, timer, restyle, spotlight, caption.
   **Review**: Improved — the columnar engine lives in compute-node memory, not on the storage layer; "seconds, not minutes" against Cloud SQL's about a minute was an unsupported number and is replaced by the real reason (no copy to catch up). Added the standby node in another zone. Weighed leading with a speed benchmark; worse, since the plan teaches architecture, not throughput. Checked: regional log-based shared storage, read pools, Omni, single primary unlike Spanner.

### Spanner TrueTime and external consistency (`gcp-spanner-truetime`)

**The aha**: TrueTime gives every data centre a clock reading as an interval with bounded uncertainty, not a single number; Spanner waits out that uncertainty before confirming a commit, and that short wait turns clocks scattered across the globe into one trustworthy order.
**Misconception to defeat**: That distributed databases can't have a true global order without one physical clock everyone shares, or that "waiting" is just latency with no purpose.
**Cast**: A world map with data centres in several regions, each showing a clock face with a shaded uncertainty band around its hand, fed by GPS and atomic-clock icons. Two transactions, A and B, on a timeline: A commits in Region 1, B starts afterward in Region 2, on the far side of the planet.
**Opening frame**: Several regional clocks, each hand sitting inside its own small uncertainty band, slightly different from each other. _"Every clock is a range, not a point."_
**Story**:

1. Transaction A requests a commit timestamp: TrueTime hands back an interval [t1, t1+ε], a few milliseconds wide. Spanner picks the top, t1+ε, as the commit timestamp, then holds the answer until the whole band is past it — a visible pause on A's band, "commit wait" (overlapping the replication round trip). _"Wait out the uncertainty before confirming."_
2. A is acknowledged with timestamp t1+ε, guaranteed to be in the past everywhere. _"Now every clock agrees it already happened."_
3. Transaction B starts afterward, anywhere in the world, and TrueTime gives it an interval guaranteed to start after t1+ε. _"B's timestamp is provably later — wherever B runs."_
4. The timeline draws A and B in strict order, left to right, regardless of which region each ran in. _"If A finished before B started anywhere, A gets the lower number. Always. External consistency."_
5. Contrast inset: a consistent read "as of t1+ε" runs lock-free against any replica worldwide and sees exactly A, nothing of B. _"Consistent snapshots, no locks, anywhere."_
   **The moment**: Beat 1, slowed — the deliberate pause on A's own timeline, a database choosing to wait a few milliseconds on purpose.
   **Interaction**: Drag the uncertainty band wider or narrower (worse/better clock hardware) and watch the forced commit-wait grow or shrink with it.
   **Ending**: A and B's timestamp intervals shown non-overlapping, the global order unambiguous.
   **Variants**: `gcp-spanner-splits-configs`, `gcp-choose-database`; compares to eventual/causal consistency elsewhere, and hybrid logical clocks (CockroachDB).
   **Techniques**: timer, meter, exchange, spotlight, dial, caption.
   **Review**: Improved — beat 1 left it unclear which timestamp Spanner picks and what it waits for (it picks the latest end of the interval, then waits until the earliest end has passed it), and gave no scale (a few ms), so the wait could read as arbitrary. Both stated. Weighed leading with a two-people-in-different-cities story; worse, the shaded clock band is the memorable part. Misconceptions defeated by beats 2 to 4. Checked: GPS and atomic clocks, commit wait, external consistency, lock-free snapshot reads.

### Spanner splits, replicas and instance configurations (`gcp-spanner-splits-configs`)

**The aha**: Scale comes from splitting the key space into pieces Spanner moves automatically — a monotonically increasing key sends every insert to the newest, last split and creates a hotspot, so the key design decides whether adding nodes actually helps.
**Misconception to defeat**: That Spanner scales automatically no matter what the primary key looks like.
**Cast**: A table's key range drawn as a long bar, divided into splits, each served by a different node, replicated by Paxos per the instance configuration (regional/dual-region/multi-region, leader region marked by a star). Two key designs compared: a timestamp-based key (an arrow always pointing at the rightmost split) and a UUIDv4/bit-reversed key (arrows scattering evenly).
**Opening frame**: The key-range bar evenly divided into four splits, four nodes, load spread evenly. _"Splits, spread across nodes."_
**Story**:

1. Switch to timestamp keys: every new insert's arrow lands on the rightmost split, that node's load meter spiking red while the others idle. _"Monotonic keys: every write piles onto the newest split."_
2. More nodes are added: the idle splits' nodes stay idle; Spanner divides the hot split, but the new inserts always land at the newest end, so the busy piece is still one piece on one node. _"Adding nodes didn't help. The newest end is still one split, one node."_
3. Switch to UUIDv4/bit-reversed keys: arrows scatter evenly across all splits; adding nodes this time spreads load visibly across all of them. _"Scattered keys: more nodes, more throughput."_
4. A child table is interleaved with its parent: its rows are drawn sitting physically next to the parent's row in the same split. _"Interleaving keeps related rows together for range scans."_
5. Switch instance configuration to multi-region: a write now has to reach quorum across regions, a visible round-trip delay compared to the regional configuration; moving the leader region (starred) closer to the writers shrinks that delay. _"Multi-region buys 99.999% availability, paid for in write latency — put the leader near the writers."_
   **The moment**: Beat 2 — the red-hot node staying exactly as hot after new nodes are added, proving the key design, not node count, was the ceiling.
   **Interaction**: Toggle between key designs and watch the load-per-split heatmap; add nodes and see whether throughput actually rises.
   **Ending**: Scattered keys, load spread evenly across nodes, leader region placed near the writers.
   **Variants**: `gcp-spanner-truetime`, `gcp-bigtable-row-keys-tablets`, `gcp-cloud-sql-ha-replicas`; compares to Bigtable tablets (no multi-row transactions).
   **Techniques**: contents, meter, path trace, toggle, dial, spotlight, caption.
   **Review**: Improved — Spanner does split hot ranges by load, so "still one split" needed the reason it does not help: appends always land on the newest piece. Everything else checked: monotonic keys hotspot, UUIDv4/bit-reversed keys scatter, interleaving co-locates children, multi-region 99.999% with leader-region write latency. Weighed a Bigtable-style heatmap-only plan; kept leader placement because multi-region cost is the other half of the concept.

### Bigtable tablets and row key design (`gcp-bigtable-row-keys-tablets`)

**The aha**: The row key is the only index and decides everything — a good key spreads writes across tablets while keeping related rows adjacent for range scans, while a key starting with a timestamp or sequential ID piles every write onto one node.
**Misconception to defeat**: "Bigtable is a relational database" — expecting secondary indexes, joins or multi-row transactions.
**Cast**: Rows sorted by a single key, drawn as one long sorted list, divided into tablets, each served by a node, with the actual bytes living in a separate Colossus layer underneath (nodes don't store the data themselves). Two key candidates compared: `timestamp#device` vs `device#reversed-timestamp`.
**Opening frame**: A sorted row list divided into four tablets across four nodes. _"Sorted by key. Chunked into tablets."_
**Story**:

1. Writes using `timestamp#device` keys arrive: every one sorts to the end of the list, landing in the last tablet — that node's write meter spikes while the other three idle. _"Start with a timestamp, and every write lands on the newest tablet. One hot node."_
2. More nodes are added: tablets rebalance across them within minutes (no data copied, since Colossus holds the bytes, only ownership moves) — but the hot tablet is still just one tablet. _"Rebalancing is fast, but it can't fix a bad key."_
3. Switch to `device#reversed-timestamp` keys: writes now spread across tablets by device (as long as there are many devices), and a range scan for one device's recent history still reads one contiguous chunk. _"Spread across devices, grouped within each — both at once."_
4. Someone filters on a non-key column: it can only scan rows to find matches, with no secondary index; a transaction across two rows is refused (writes are atomic per row only). _"The row key is the only index there is."_
   **The moment**: Beat 1 — the write meter spiking on exactly one tablet while three sit idle, immediately after a seemingly reasonable key choice.
   **Interaction**: Toggle between the two key designs and watch the per-tablet write-load heatmap; try a non-key filter and watch it scan, or a two-row transaction and watch it fail.
   **Ending**: `device#reversed-timestamp` keys, load spread evenly, a range scan still landing in one contiguous chunk.
   **Variants**: `gcp-spanner-splits-configs`, `gcp-choose-database`; compares to Spanner (relational, transactional) and Cassandra/HBase partition keys.
   **Techniques**: contents, meter, path trace, toggle, layers, caption.
   **Review**: Improved — "no such thing" overstated: Bigtable can filter on other columns, but only by scanning, and the misconception (relational) also includes multi-row transactions, which beat 4 now defeats. Added that device-first keys only spread if devices are many. Weighed a Spanner-vs-Bigtable side-by-side; belongs to choose-database. Checked: sorted rows, tablets served by nodes, data in Colossus, rebalancing moves ownership not data.

### Firestore Native mode vs Datastore mode (`gcp-firestore-modes`)

**The aha**: One storage engine, two front doors — Native mode for anything new, especially apps syncing live to clients; Datastore mode only for legacy Datastore or App Engine code. Both are strongly consistent and scale automatically, but the mode is chosen once, as part of the database's identity.
**Misconception to defeat**: Thinking Native and Datastore mode are two different databases, or that you can switch freely between them per-request.
**Cast**: One storage engine box, underground, with two labelled doors on top: Native mode (collections and documents, a phone and a browser both holding a live-syncing copy via a real-time listener) and Datastore mode (the plain Datastore API, a server icon only, no listener). A database-creation moment where exactly one door is chosen and the other greys out permanently for that database (a project can hold other databases in either mode).
**Opening frame**: The underground engine, both doors unlit, a choice pending. _"One engine. Two doors — pick one, once."_
**Story**:

1. Native mode is chosen at creation: that door lights, the other greys out and locks. _"The choice is made for this database's whole life."_
2. A document is written through Native mode: a phone and a browser, both holding real-time listeners, update instantly and simultaneously, no polling. _"Built for syncing straight to clients."_
3. A legacy App Engine server, written for the old Datastore API, reaches for the greyed-out Datastore-mode door and bounces — it needed a database created in that mode instead. _"Old code needs the old door, opened on purpose."_
4. Underneath both doors, the same engine handles both: strongly consistent, autoscaling, unaffected by which door is used. _"The engine doesn't care which door you came through."_
   **The moment**: Beat 1 — the instant one door locks the other out permanently, making clear this is a one-time identity choice, not a runtime setting.
   **Interaction**: Choose a mode at "creation" and watch the other door grey out; try to reach the wrong door with legacy code and watch it bounce.
   **Ending**: Native mode's door lit, a phone and a browser both showing the same live document.
   **Variants**: `gcp-choose-database`, `gcp-bigtable-row-keys-tablets`; compares to Bigtable (wide-column, analytics scale) and Firebase Realtime Database.
   **Techniques**: boundary, toggle, failure, token, restyle, caption.
   **Review**: Improved — clarified that the mode is per database, not per project or request, which is the part of the misconception the story did not state. Rest checked: Native has listeners, client SDKs, security rules; Datastore mode keeps the Datastore API; same engine, strong consistency, autoscaling. Weighed a feature table of the two modes; worse than the door that locks, which shows why the choice is permanent.
