# Azure plans, part 2

Stage 2 plans for `catalog/azure.md` groups 5 to 7 (Compute; Storage; Databases and analytics),
in catalog order. They use the shared Azure visual language: real service icons and names (App
Service, VM Scale Sets, Functions, Container Apps, AKS, storage accounts, Cosmos DB, Azure SQL);
Azure's nesting drawn as nested frames (region › availability zones › resources; subscription ›
resource group); requests as small dots travelling along arrows; a storage account's redundancy
shown as copies of the data placed in racks, zones and a paired region; "X vs Y" questions put
the same traffic or task through each option side by side with the difference highlighted;
"which service do I use" choices as a short question path whose answers light the matching
service; cold starts as a visible timer before the first response; cost as a coin meter.

## Compute

### Choosing a compute service (`azure-compute-decision`)

**The aha**: Each step from VMs toward Functions trades control for less operations work; pick the most managed service that still meets the requirements, and expect to mix several in one system.
**Misconception to defeat**: Thinking in IaaS/PaaS/FaaS labels alone, as if each service were one point on a single scale rather than a bundle of trade-offs.
**Cast**: Five platform frames in a row, left to right: Virtual Machines, AKS, Container Apps, App Service, Functions. Container Instances and Batch sit off to one side as "single container" and "big parallel jobs". Each frame is split into a top band "you manage" (orange) and a bottom band "Azure manages" (blue).
**Opening frame**: All frames at once; VMs almost entirely orange, Functions almost entirely blue, the rest graded between.
**Story**:

1. A sample web API box appears at the VM frame: OS, patching, scaling all orange. _"Full control, full operations work."_
2. It slides right to App Service: the orange band shrinks to "your code"; OS and patching turn blue. _"Managed web hosting."_
3. It slides on to Functions: only the trigger and handler stay orange. _"Managed down to the event."_
4. A second box, "needs the Kubernetes API itself", slides right from VMs and stops at AKS; it can't go further because Container Apps and App Service hide that API. _"Not inferior, just the wrong shape."_
5. A final frame shows one system: the API on App Service, a nightly job as a Function, a batch render on Batch, three frames lit together.
   **The moment**: Beat 5, one system lighting three different frames, so the row reads as a toolbox, not a ranking.
   **Interaction**: Choice: tick requirements ("custom kernel", "raw Kubernetes API", "event-driven only", "scale to zero") and watch the matching frame light up.
   **Ending**: Rests on the three-frame system. _"Pick per workload, not once."_
   **Variants**: `azure-vm-availability-options`, `azure-app-service-plans`, `azure-functions-hosting-plans`, `azure-container-apps`, `azure-aks-architecture`.
   **Techniques**: layers, restyle, move, choice, spotlight, caption.
   **Review**: Improved — fixed the frame order so beat 4's "stop at AKS" is physically meaningful (the old order put AKS after Container Apps, so sliding "further" made no sense); dropped the "skipped Container Apps" aside. Weighed a decision-tree framing (questions leading to a service); worse here, since the shared catalog entry for this id is about the trade-off, and the question path is already used by `azure-data-store-decision`. Facts checked against the catalog (service list, ACI/Batch roles).

### What a VM is made of (`azure-vm-building-blocks`)

**The aha**: A VM is a bundle of separate resources (disks, NIC, public IP) that can outlive it, and only "Stopped (deallocated)" stops the compute meter.
**Misconception to defeat**: That a VM is one resource, that its temporary disk is durable, and that shutting down inside the OS stops the bill.
**Cast**: A central VM box wired by dotted lines to an OS disk (cylinder), a data disk, a temporary disk (labelled "temporary, local to the host"), a NIC inside a subnet frame, and a public IP. Each wire carries a small "delete with VM: yes/no" switch. A cost meter along the bottom.
**Opening frame**: The VM wired to all five parts, meter ticking.
**Story**:

1. The app writes a scratch file to the temp disk, and a log file to the data disk. _"Temp disk: fast, local, not durable."_
2. Delete the VM with the data disk's switch on "no" and the NIC's on "no" (the CLI and API default; the portal pre-ticks OS disk, NIC and IP): the VM vanishes, the data disk and NIC stay, still billing. _"Parts can outlive the VM."_
3. Restore the VM. Click "Stop (deallocated)": compute meter drops to near zero; disks keep a thinner line. _"Compute stops. Storage doesn't."_
4. Resume, then shut down from inside the OS: the screen goes dark, yet the compute meter keeps ticking. _"The OS doesn't tell Azure's billing."_
5. Redeploy to new hardware: the temp disk's scratch file is gone; the data disk's log is intact.
   **The moment**: Beats 3 and 4 side by side: two identical dark VMs, one meter flat, one still running.
   **Interaction**: Toggle Delete / Stop (deallocated) / Shut down (guest OS) / Redeploy, and flip each part's delete-with-VM switch; watch which parts survive and what the meter does.
   **Ending**: Stop (deallocated) selected, compute flat, disks and NIC present. _"Only deallocation stops compute charges."_
   **Variants**: `azure-vm-availability-options`, `azure-app-service-plans`.
   **Techniques**: contents, meter, toggle, restyle, failure, caption.
   **Review**: Improved — beat 2 claimed the disk, NIC and IP always survive a delete, which is false for portal-created VMs (the portal pre-ticks "delete with VM" for the OS disk, NIC and IP; only data disks survive by default); added the per-part switch so the claim is true and the setting is visible. Renamed "ephemeral" on the temp disk (that word means ephemeral OS disks, a different feature) and used a data disk to show durable vs temp. Alternative weighed: a lifecycle state-machine diagram of VM power states; less visual than the surviving-parts picture. Dark-screen contrast kept as the moment.

### Availability sets vs availability zones vs Virtual Machine Scale Sets (`azure-vm-availability-options`)

**The aha**: Decide which failure you're surviving: a rack (availability set), a datacenter (availability zones) or a surge in load (scale set). The SLA only applies when VMs are actually spread that way.
**Misconception to defeat**: That spreading happens automatically, or that a scale set spans datacenters without you choosing zones.
**Cast**: A region frame holding three zone frames, each a datacenter of racks. An availability-set panel: one datacenter of racks, drawn with fault domains as rack columns and update domains as rows, with a note "Azure picks which datacenter". A Flexible scale set pool beside it, with a zones tick-box.
**Opening frame**: An availability set of three VMs in one datacenter, each in a different fault domain and update domain, SLA label 99.95%.
**Story**:

1. Planned maintenance rolls one update domain at a time: one VM greys briefly, the others serve. _"Updates are staggered."_
2. One rack loses power: the VM in that fault domain greys; the others, in other racks, stay lit. _"A set survives a rack."_
3. The whole datacenter goes dark: every VM in the set greys at once. _"Not a datacenter."_
4. Switch to availability zones: the same three VMs sit one per zone, label 99.99%. A zone goes dark; two keep serving.
5. Switch to a scale set: a load meter climbs and new instances appear. Zones unticked, they stay in one datacenter; ticked, they spread across all three. _"Spread it, or let the scale set spread it, but choose."_
   **The moment**: Beat 3 into beat 4: the same failure, now survived because the VMs moved from one datacenter's racks to three separate datacenters.
   **Interaction**: Choose a failure (rack, datacenter, load spike) against a configuration; the SLA label and survivors update.
   **Ending**: Zones chosen, a zone dark, two of three VMs still green.
   **Variants**: `azure-availability-zones-and-region-pairs`, `azure-compute-decision`.
   **Techniques**: boundary, failure, choice, restyle, meter, caption.
   **Review**: Improved — the old opening drew the availability set inside "Zone 1", but a set is not zone-pinned (you can't combine the two, and you don't pick the datacenter); redrawn as its own datacenter. Added update domains, half of what a set is for and missing entirely. Made the scale-set zones choice visible, since the misconception named it but no beat defeated it. SLAs (99.95% set, 99.99% zones) match the catalog. Alternative weighed: a table-style SLA ladder; weaker than the shared failure replayed three times.

### App Service plans (`azure-app-service-plans`)

**The aha**: You pay for the plan, not the apps: every app in a plan runs on every instance, so scaling the plan scales them all and one noisy app slows its neighbours.
**Misconception to defeat**: That each web app has its own dedicated compute.
**Cast**: A plan frame with a coin meter, holding Instance 1 and Instance 2 boxes. Apps "Shop" and "Blog" shown inside both instances. A tier strip (Free, Shared, Basic, Standard, Premium, Isolated) down the side, with the plan's tier highlighted.
**Opening frame**: Shop and Blog inside both instances, one shared CPU meter per instance, the coin meter showing 2 instances.
**Story**:

1. A third app, "API", is added: it appears inside both instances at once, and the coin meter doesn't move. _"Every app, every instance. No new bill."_
2. Shop gets a traffic spike: load spreads over both instances and both CPU meters pin red.
3. Blog slows in both instances, though nothing in Blog changed. _"One plan, one pool of CPU."_
4. The plan is scaled to 3 instances: Shop, Blog and API appear in the new Instance 3 together, and the coin meter steps up by one instance. _"You scale and pay for the plan."_
   **The moment**: Beat 3, Blog slowing for a reason entirely inside Shop; the shared meter is the whole story.
   **Interaction**: Dial the instance count and add or remove apps; apps appear in every instance, and cost follows instances only.
   **Ending**: Three apps, three instances, settled. _"Scale the plan, and everything on it moves together."_
   **Variants**: `azure-app-service-deployment-slots`, `azure-app-service-networking`, `azure-functions-hosting-plans`.
   **Techniques**: contents, clone, meter, dial, restyle, caption.
   **Review**: Improved — the aha leads with "you pay", yet no beat showed money; added a coin meter that stays flat when an app is added and steps when instances are. Fixed beat 2: load balances across instances, so a spike pins both meters, not one. Alternative weighed: a noisy-neighbour framing (one app hogging a shared kitchen); the same beat 3, so kept. Checked: apps run on all instances by default (per-app scaling is a Premium opt-in), tier list matches the catalog.

### Deployment slots and slot swap (`azure-app-service-deployment-slots`)

**The aha**: A release becomes a switch, not a deploy: production receives already-warm code with no downtime, and swapping back is the rollback.
**Misconception to defeat**: That a swap is a fast redeploy with a gap while the new version starts.
**Cast**: Two worker boxes under two fixed address labels, "Production" (blue, live traffic dots) and "Staging" (grey); each box holds an app version. Setting tags pinned to the labels, not the boxes: a "slot-sticky" tag on each label (prod database, staging database) and a plain tag that travels with the code.
**Opening frame**: Production serving v1 under live traffic; Staging holding v1, idle.
**Story**:

1. v2 deploys into the Staging box only; traffic still flows to v1. _"Deploy without exposure."_
2. Click "Swap". Before anything moves, Azure applies Production's sticky settings to the Staging box and restarts it, then sends warm-up requests (timer ticks) to every instance until it answers. _"Warmed up with production's settings, in private."_
3. Routing flips: the two boxes trade labels, slowed down. The dot stream moves from one box to the other with no gap; v2 now serves under "Production" with the production database. _"Settings that stay are the ones tied to the slot."_
4. v1, now under "Staging", is still running and warm. A problem appears in v2.
5. Swap again: labels trade back, traffic returns to warm v1 instantly.
   **The moment**: Beat 3, slowed: the dot stream crossing between boxes exactly as the labels trade, with no gap.
   **Interaction**: Swap button; mark a setting sticky or not and watch whether it stays on the label or travels with the code.
   **Ending**: Back on v1, v2 left in Staging for a fix. _"Rollback is just another swap."_
   **Variants**: `azure-container-apps` (revisions, a different mechanism for the same goal).
   **Techniques**: move, restyle, stream, token, caption.
   **Review**: Improved — warm-up was drawn before the swap, but in App Service it is part of the swap (settings applied, restart, warm-up, then the routing switch); reordered. Fixed the slot-sticky beat: the old version had the staging setting "stay behind", which hid the real lesson, that v2 arrives and runs with production's settings. Slots need Standard tier or above (catalog). Alternative weighed: blue-green in general with a load balancer; the slot version is the Azure-specific idea and shows warm-up and sticky settings, so kept.

### App Service networking: inbound vs outbound (`azure-app-service-networking`)

**The aha**: VNet integration only lets the app call into the VNet; it doesn't make the app private. That takes a private endpoint, and most designs need both.
**Misconception to defeat**: That turning on VNet integration closes off public access to the app.
**Cast**: An App Service box with two labelled arrows: "inbound" on the left from the public internet and a VNet client, and "outbound" on the right into a VNet frame holding a VM with a private IP (and a delegated "integration subnet").
**Opening frame**: A public client reaches the app; the app has no path into the VNet.
**Story**:

1. Turn on regional VNet integration (into a delegated subnet): the outbound arrow lights and the app calls the VM's private IP. The inbound side is untouched. _"Now it can reach in."_
2. A public client still connects exactly as before. _"Still wide open from outside."_
3. Add a private endpoint, a NIC with a private IP in the VNet: the public arrow turns red and closes (403 from the internet); a VNet client now reaches the app through the endpoint's private IP.
4. Turn VNet integration off with the endpoint still on: inbound stays private, but the app can no longer call the VM. _"Neither switch does the other's job."_
   **The moment**: Beat 2, the public arrow staying open despite VNet integration; then beat 4, the mirror image.
   **Interaction**: Toggle VNet integration and the private endpoint independently; each arrow reacts only to its own toggle.
   **Ending**: Both on: inbound private, outbound reaching the VM. _"Two separate switches."_
   **Variants**: `azure-private-endpoint-vs-service-endpoint`, `azure-private-endpoint-dns`, `azure-vnet-subnets`.
   **Techniques**: toggle, restyle, failure, path trace, caption.
   **Review**: Improved — added the mirror-image beat (private endpoint without VNet integration cannot call out), so both directions of the confusion are defeated, not one; named the delegated subnet and the endpoint's NIC. Alternative weighed: ASE as the fix for both; belongs in the plan tiers, not here. Checked: regional VNet integration is outbound-only; private endpoint is inbound-only; reaching the endpoint by name needs private DNS (linked to `azure-private-endpoint-dns`).

### Azure Functions hosting plans and cold starts (`azure-functions-hosting-plans`)

**The aha**: The hosting plan decides whether there is a cold start, along with scale limits, networking and billing; scaling to zero saves money but makes the first request wait.
**Misconception to defeat**: That cold starts are just something the language or code does, rather than a consequence of the plan you chose.
**Cast**: Two plan lanes, Flex Consumption and Premium, each a row of instance boxes that can be empty (grey dashed) or lit. A cost meter and a request timer above each lane. Dedicated and legacy Consumption as small greyed tags at the edge.
**Opening frame**: Flex Consumption at rest: zero instances, cost meter at $0.
**Story**:

1. A request arrives at Flex Consumption: a timer counts while an instance box appears and lights. _"Starting from nothing costs time."_
2. A second request moments later reaches the warm instance instantly. _"Warm, it's fast."_
3. Switch to Premium: an instance is always running (the minimum is one), cost meter above zero with no traffic. A first request arrives with no timer. _"Paying to never be cold."_
4. Back on Flex, dial "always ready instances" from 0 to 2: the timer shrinks to nothing as instances stay lit, and the cost meter rises. A big runtime package makes the timer longer at 0, but never matters at 2.
   **The moment**: Beat 1 against beat 3, side by side: one plan's visible wait, the other's instant answer, for the very first request.
   **Interaction**: Dial always-ready instances; timer and cost move in opposite directions.
   **Ending**: Timer at zero, cost above zero. _"You're buying away the wait."_
   **Variants**: `azure-functions-triggers-bindings`, `azure-container-apps`, `azure-app-service-plans`.
   **Techniques**: timer, meter, dial, restyle, caption.
   **Review**: Improved — removed the invented "1 to 2s" figure (Microsoft gives none; it varies with runtime and package) and softened the misconception: language and package size change how long a cold start lasts, but the plan decides whether one happens. Premium's minimum of one always-running instance is the accurate framing (the pre-warmed buffer is a separate scale-out feature). Alternative weighed: a four-plan comparison table; too many ideas for one story, and the two lanes show the trade directly. Checked against the catalog: Flex is the serverless default, always-ready instances, Premium and Dedicated, legacy Linux Consumption retiring 30 Sep 2028.

### Functions triggers and bindings (`azure-functions-triggers-bindings`)

**The aha**: The trigger both starts your code and drives how it scales; bindings replace connection boilerplate, so a function can be "message in, document out" in a few lines.
**Misconception to defeat**: That bindings are a convenience wrapper around code you'd still have to write, rather than code you don't write.
**Cast**: A function app in the middle. Left, a Service Bus queue feeding in via an arrow marked "trigger", a queue-depth meter beside it, and a small eye icon "scale controller" watching that meter. Right, an output arrow to a Cosmos DB icon marked "output binding".
**Opening frame**: An empty queue and no running instances (a dashed outline); the output arrow dim.
**Story**:

1. Messages pile into the queue; the depth meter climbs. _"Work is waiting."_
2. The scale controller, watching that meter, starts instances: boxes appear beside the first. _"The trigger drives scale, not just the call."_
3. Each instance receives messages (tokens along the trigger arrow) into a short body of code.
4. The function returns a value; it flows along the output binding and becomes a document in Cosmos DB. No SDK call is shown, just the arrow lighting. _"Message in, document out."_
5. An inset shows the same job without bindings: an explicit client, connection handling, serialisation. It sits beside the short version, three times as long.
   **The moment**: Beat 2, the queue-depth meter itself commanding new instances into existence.
   **Interaction**: Dial queue depth and watch instance count follow, down to none when it drains; toggle the "without bindings" inset.
   **Ending**: Queue drained, instances scaling back in. _"The queue is driving, start to finish."_
   **Variants**: `azure-functions-hosting-plans`, `azure-durable-functions`, `azure-event-hubs`.
   **Techniques**: token, meter, dial, contents, side by side, caption.
   **Review**: Improved — the opening showed one idle instance, but on a scale-to-zero plan there are none until the first message; the scale controller (the actor the moment depends on) was invisible, so it is now on screen. Beat 3 said "each instance pulls one message", but triggers deliver batches and concurrency per instance; changed. Alternative weighed: leading with bindings only (the "no code" side); the trigger-driven scaling is the less obvious half, so it stays the moment. Checked: exactly one trigger per function, any number of bindings.

### Durable Functions orchestrations (`azure-durable-functions`)

**The aha**: An orchestrator doesn't wait; it stops, and each time the next result arrives it re-runs from the top, replaying its history. That is why its code must be deterministic and why a workflow survives restarts.
**Misconception to defeat**: That an orchestrator is a long-running process holding its state in memory while it waits.
**Cast**: Left, orchestrator code as three lines: `a = call A`, `b = call B(a)`, `done`. Centre, a history strip ("A scheduled", "A done: 42"...). Right, activity boxes A and B. A cursor marks the line being executed.
**Opening frame**: The three lines, empty history, nothing running.
**Story**:

1. The orchestrator starts, runs line 1, schedules A (history: "A scheduled") and stops. The code panel goes dark: nothing is running or waiting. _"It stopped. Nothing is waiting."_
2. A runs and finishes; "A done: 42" is added to the history, which wakes the orchestrator.
3. The code runs again from line 1. At `call A` the cursor does not call anything: the history answers "42" instantly (A's box stays dark), and the cursor flies on to line 2. _"Replay: finished steps aren't redone."_
4. Line 2 has no history entry, so B is scheduled and the code stops again.
5. Insert `now()` into line 1: on replay it returns a different time than the first run, and a red mismatch appears between code and history. _"Replay must see the same code path."_
   **The moment**: Beat 3, the cursor running down already-done lines at speed, taking answers from the history, landing exactly where execution had stopped.
   **Interaction**: A "kill the host" button at any beat (nothing is in memory, so nothing is lost), and a toggle that makes line 1 nondeterministic.
   **Ending**: B finishes, the orchestration completes, history a full record. _"The log is the memory."_
   **Variants**: `azure-functions-triggers-bindings`; messaging's sagas as the general pattern.
   **Techniques**: contents, token, restyle, failure, caption.
   **Review**: Rethought — the old story killed a process in beat 2, but it had already stopped in beat 1, so the "kill" had nothing to kill, and the misconception ("long-running process") was only named. Rewritten around the real mechanism: the code visibly re-executes from line 1 when a result arrives, and the nondeterminism beat makes the rule ("must be deterministic") an on-screen failure instead of an assertion. Alternative weighed: a Logic Apps comparison; a different tool, left to the catalog's confusions. Checked: event-sourced history, replay after each await, activities not re-executed, history stored in Storage/SQL/Durable Task Scheduler.

### Azure Container Apps: environments, revisions and KEDA scaling (`azure-container-apps`)

**The aha**: You say when to scale and which revision gets traffic, never nodes or pods, and scale rules can use a queue's length or any KEDA signal, not just CPU or requests.
**Misconception to defeat**: That this is just AKS with fewer options, rather than something with no Kubernetes API at all.
**Cast**: An environment frame holding two container apps. "web": two stacked revisions v1 and v2 with replica counts and a traffic-split slider. "worker": one app with a queue-length meter driving its replica count. A `kubectl` icon, crossed out, sits beside the frame; an AKS cluster is greyed behind it.
**Opening frame**: web v1 alone, slider 100/0, traffic dots flowing to it.
**Story**:

1. v2 is deployed: a new immutable revision appears beside v1, replicas 0, no traffic (multiple-revision mode is on). _"Every change makes a new revision."_
2. The slider moves to 90/10: the dot stream splits. The trickle reaching v2 starts its first replica (HTTP scale rule, from zero). _"You choose the split."_
3. Elsewhere in the environment the worker sees a queue's length meter climb; its replicas rise 0, 3, 5 to match. _"Scale on the queue, not the CPU."_
4. The queue empties and the worker falls back to 0, its cost with it. At 100/0 v1 serves alone and v2 is retired.
5. The crossed-out `kubectl` flashes: no nodes, pods or API are exposed. For that, step across to AKS.
   **The moment**: Beat 3 into beat 4: a worker going from zero to five and back to zero on nothing but a queue's length.
   **Interaction**: Dial the traffic split and the queue length separately; the dot stream and the replica count each follow their own control.
   **Ending**: v1 serving, worker at zero. _"Revisions and scale rules, no cluster to run."_
   **Variants**: `azure-app-service-deployment-slots`, `azure-functions-hosting-plans`, `azure-aks-architecture`.
   **Techniques**: contents, clone, move, meter, dial, caption.
   **Review**: Improved — the old beats had v2 at 0 replicas while receiving 10% of traffic, a contradiction (traffic itself would start it), and the queue rule sat on a revision that was meant to take HTTP; split into a web app with an HTTP scale rule and a separate worker with the queue rule. Added the crossed-out `kubectl` so the "not just AKS-lite" misconception is defeated on screen. Alternative weighed: a pure KEDA-scaler tour; too many names for one idea. Checked: immutable revisions, weighted split only in multiple-revision mode, scale to zero, KEDA rules (catalog).

### AKS architecture: control plane, node pools and upgrades (`azure-aks-architecture`)

**The aha**: Microsoft runs the brain, the control plane, but you still own the body: node sizing, patching and upgrades, unless you opt into AKS Automatic.
**Misconception to defeat**: That "managed Kubernetes" means Azure runs the whole cluster, nodes included, by default.
**Cast**: A cluster frame in two layers: a cloud-shaped "control plane" on top with no visible hardware, and below it the "node resource group" holding a system node pool and a user node pool, each a scale set of nodes with pods. A "you / Azure" ownership colouring on each layer.
**Opening frame**: The control-plane cloud (Azure-coloured), the node pools below it (you-coloured), pods running.
**Story**:

1. You start an upgrade (or an auto-upgrade channel does): the control plane upgrades inside the cloud; the nodes below don't change. _"The brain upgrades first."_
2. A new node on the new version appears in the user pool (surge). An old node is cordoned: its pods are evicted and recreated on other nodes while a disruption budget keeps enough replicas up. Then the old node is deleted.
3. This repeats node by node until the pool is on the new version, the app never fully down. _"You size the surge and set the budgets."_
4. Toggle "AKS Automatic": sizing, scaling and upgrades turn Azure-coloured; the nodes remain in your subscription and bill, but Azure picks and patches them.
   **The moment**: Beat 2, pods leaving a node before it goes, and a new node arriving first.
   **Interaction**: Toggle AKS Automatic and watch which layer changes colour from "you" to "Azure".
   **Ending**: Fully upgraded, Automatic on, only the workloads clearly yours. _"The brain was always managed; now the body is too, if you ask."_
   **Variants**: `azure-container-apps`, `azure-aks-networking`, `azure-vm-availability-options`.
   **Techniques**: layers, boundary, move, restyle, toggle, caption.
   **Review**: Improved — "pods migrate" was wrong (Kubernetes evicts and recreates pods; it doesn't move them) and "node restarts on the new version" was wrong (AKS adds a surge node and replaces nodes); fixed both, with the PodDisruptionBudget that makes it safe. In Automatic, nodes stay in the customer's subscription, so the plan now changes ownership colour instead of sliding the layer into the cloud. Alternative weighed: a tier ladder (Free, Standard, Premium); a different question (SLA). Checked: system and user pools, node resource group, scale sets.

### AKS networking models: kubenet, Azure CNI, Overlay (`azure-aks-networking`)

**The aha**: Overlay versus flat networking is a choice between saving VNet address space and letting other networks reach pods directly, and it is awkward to change later.
**Misconception to defeat**: That this is a generic Kubernetes CNI choice rather than one with a real, exhaustible resource, the VNet's address space.
**Cast**: A VNet subnet drawn as a grid of real IP addresses, with a remaining-addresses meter. Nodes in the subnet; pods coloured by which range they draw from. A greyed "kubenet - legacy, retires 31 Mar 2028" chip at the side.
**Opening frame**: Azure CNI flat (pods take VNet addresses) selected: pods coloured as the subnet.
**Story**:

1. A new node joins: in flat mode its pod addresses (30 by default, plus the node's own) are reserved in the subnet at once, and the meter drops by a chunk. _"Flat: pods are VNet citizens, and cost addresses."_
2. An on-premises client over a VPN sends a packet straight to a pod's address; the path trace completes.
3. Switch to Azure CNI Overlay: the same node takes one VNet address; pods draw from a separate private range (another colour). The meter barely moves.
4. The same client tries the same pod address: the trace stops at the edge, because that range isn't routable outside the cluster. Traffic can reach the pod only through a Service or load balancer on a node. _"Overlay saves addresses, at the cost of direct reachability."_
   **The moment**: Beats 1 and 3 side by side: one meter draining by chunks, one nearly flat, paired with the on-premises trace that completes only for flat.
   **Interaction**: Toggle the modes and watch the address meter and the on-premises trace react together; add nodes to exhaust the subnet in flat mode.
   **Ending**: Overlay selected, meter healthy, trace stopped. _"A trade, not a free upgrade."_
   **Variants**: `azure-vnet-subnets`, `azure-aks-architecture`.
   **Techniques**: boundary, restyle, meter, path trace, toggle, caption.
   **Review**: Improved — beat 1 said each pod takes an address as it spins up; in flat Node Subnet mode the node reserves its whole pod allowance (30 by default) when it joins, which is the actual cause of exhaustion, now drawn. Said the overlay range is unroutable from outside instead of "needs NAT", and softened "hard to change later" (in-place moves to Overlay exist, going back to flat does not). Added the kubenet chip for the title. Alternative weighed: a pod-IP-budget calculator; kept as the interaction. Checked: Overlay is the recommended default, kubenet retiring 31 Mar 2028 (catalog).

## Storage

### Storage accounts: services, types and endpoints (`azure-storage-account`)

**The aha**: Most decisions (redundancy, network rules, encryption, default tier) are made once per account, so data is split across accounts by those needs, not by which app owns it.
**Misconception to defeat**: That an account is just a folder for one app's blobs, and different apps naturally get different settings inside it.
**Cast**: A named account box ("contoso123") with four endpoint doors labelled `.blob`, `.file`, `.queue`, `.table`. An account-wide settings panel beside it: a redundancy dial, a "public network access" switch, a default-tier switch.
**Opening frame**: The account with four doors open; panel showing LRS, network access from all networks, default tier Hot.
**Story**:

1. Flip network access to "selected networks only": all four doors gain a firewall padlock at once. _"One switch, every door."_
2. Two apps want to share the account: one needs GRS, the other is fine with LRS. The redundancy dial has one position and can't hold both.
3. A second account is created for the GRS app; its own dial is set independently. _"Split by setting, not by app."_
4. Both accounts sit side by side, each with its own four doors and one dial.
   **The moment**: Beat 2, the dial physically unable to point two ways at once, the reason the split happens at all.
   **Interaction**: Try to set a different redundancy level for one service inside an account; blocked, with a second account the only way forward.
   **Ending**: Two accounts, two dials, each consistent inside itself. _"The account is the unit of settings."_
   **Variants**: `azure-storage-redundancy`, `azure-blob-access-tiers`, `azure-storage-auth`.
   **Techniques**: boundary, toggle, restyle, dial, caption.
   **Review**: Improved — beat 1 flipped "public access" and padlocked all four doors, but the anonymous-access setting applies to blobs only; the account-wide switch is the network rule (public network access), so the beat now uses that. Alternative weighed: starting from a "one account per app" mistake and showing its cost sprawl; the dial that cannot split is sharper. Checked: redundancy is a single account-level SKU, account types per the catalog (GPv2, Premium, hierarchical namespace).

### Storage redundancy: LRS, ZRS, GRS, RA-GRS, GZRS, RA-GZRS (`azure-storage-redundancy`)

**The aha**: Zone copies survive losing a datacenter with nothing lost; geo copies survive losing the region but lag by minutes, can't be used until you start a failover (unless you chose an RA- SKU for reads), and the newest writes can be lost.
**Misconception to defeat**: That "three copies" means safe from anything whatever the copies share, and that geo failover happens by itself.
**Cast**: Region A as a boundary holding three zone frames, each a datacenter of racks. Region B, far right, the paired region. A SKU selector (LRS, ZRS, GRS, RA-GRS, GZRS, RA-GZRS). A manual "fail over" button, greyed until needed.
**Opening frame**: LRS selected: three copies of `photo.jpg`, all in Zone 1's racks.
**Story**:

1. One rack in Zone 1 fails: one copy greys, a fresh copy clones beside the survivors. _"A disk dies: fine."_
2. All of Zone 1 fails: all three copies grey. _"Lose the building, lose LRS."_
3. Switch to ZRS: one copy per zone. Zone 1 fails; two survive. _"Zones survive a datacenter."_
4. Switch to GRS: a stream of copies flows asynchronously to Region B (three copies there). Region A fails entirely; B's copies exist but nothing reads them until "fail over" is clicked by a person.
5. Slowed: a write lands in Region A, the client gets a success tick while the write is still mid-flight to B. A fails right then. B holds only the previous version; the in-flight write fades, red. _"Geo copies lag, and the newest write can be lost."_
6. Switch to RA-GRS: a read-only door lights on B even before any failover. After the failover, B becomes the single (LRS) primary.
   **The moment**: Beat 5, the acknowledged write caught mid-flight and vanishing because the region it was heading to never got it.
   **Interaction**: Choose a SKU and a failure (rack, zone, region); see what survives, whether the secondary is readable, and the cost meter.
   **Ending**: A ladder: LRS/rack, ZRS/zone, GRS/region (GZRS = the zone rung plus the region rung), cost rising, the failover button unclicked until Region A is truly gone.
   **Variants**: `azure-blob-data-protection`, `azure-availability-zones-and-region-pairs`, `azure-sql-failover-groups`; data's `storage-redundancy-levels` for the general version.
   **Techniques**: boundary, clone, stream, failure, choice, meter, token, caption.
   **Review**: Improved — added the facts the ladder needs but beats left out: after a failover the account runs on one region as LRS, geo replication has no lag SLA (typically minutes), and GZRS was named in the title but never drawn. Checked: LRS three copies in one datacenter, ZRS across three zones, GRS adds three copies in the paired region, RA- allows secondary reads, failover is customer-initiated. Alternative weighed: leading with the cost ladder; the lost write is the more memorable failure.

### Blob access tiers, smart tier and lifecycle management (`azure-blob-access-tiers`)

**The aha**: Tiering is a bet on how often data is read: colder tiers only save money if you rarely touch the data and keep it past the minimum, and Archive adds a real wait to get it back.
**Misconception to defeat**: "Important data goes hot, old data goes cold," and that colder is simply always cheaper.
**Cast**: Four shelves at growing distance from a desk: Hot (near), Cool ("30-day minimum"), Cold ("90-day minimum"), Archive (behind a closed door, "180-day minimum, offline"). A bill below with storage and access bars. A robot "smart tier" watching an access-pattern meter.
**Opening frame**: A blob on the Hot shelf, storage and access costs both on the bill.
**Story**:

1. The blob moves to Archive; the storage bar drops sharply. _"Rarely read? Pennies to keep."_
2. Someone requests it: the closed door; a clock spins through hours ("rehydrating"; standard priority can take up to 15 hours) before the blob reappears on Hot or Cool, a retrieval fee on the bill. _"Archive is offline."_
3. A second blob moved to Cool "because it isn't important" is read constantly: a per-GB read charge lands on every read, its access bar swelling past what Hot would cost. _"Cheap to keep, dear to read."_
4. Moved off Cool after 10 days: an early-deletion chip appears. _"Leave before the minimum, pay anyway."_
5. Two ways to automate: a lifecycle rule ("30 days since last read, to Cool") written by a person, and smart tier switched on, where the robot moves blobs between Hot, Cool and Cold itself, no rules written.
   **The moment**: Beat 3, two bills side by side: the "cheaper" tier costing more overall for data that turned out to be read often.
   **Interaction**: A dial for "reads per month" on one blob; the cheapest shelf for that rate lights, showing the crossover points.
   **Ending**: Dial at a low read rate, Archive lit, bill minimal. _"Tier by how often it's actually read."_
   **Variants**: `azure-storage-redundancy`, `azure-blob-data-protection`; data's `storage-access-tiers` for the general version.
   **Techniques**: contents, move, meter, timer, dial, side by side, caption.
   **Review**: Improved — lifecycle management is half the title and never appeared; added it beside smart tier, which only moves among Hot/Cool/Cold (not Archive). Rehydration wait specified (hours, up to 15 at standard priority; a high-priority option exists) and its destination online tier. Alternative weighed: a pure reads-per-month break-even chart; kept as the dial but the shelves are the memorable picture. Checked minimums (30/90/180 days), early-deletion charges, GA of smart tier in April 2026 (catalog).

### Storage authorization: account keys vs SAS vs Entra ID (`azure-storage-auth`)

**The aha**: Anyone holding a key or a SAS can use it until it expires or is rotated; Entra ID access is per identity and can be taken away in one place, so it is the one to prefer.
**Misconception to defeat**: That owning the account's control-plane role (Owner, Contributor) gives data access directly, or, in the other direction, that it grants none.
**Cast**: A storage account door. Credentials approach in turn: an "account key" (skeleton key), a "SAS" (a signed ticket with an expiry clock and scoped permissions printed on it), and an "Entra ID" badge checked against data roles. A drawer in the door labelled "list keys (control plane)".
**Opening frame**: The door and the three credential types waiting.
**Story**:

1. The account key is copied into a script, then into two more. Every copy opens the door fully, forever, until someone rotates the key everywhere. _"One secret, everywhere it leaked."_
2. A SAS is generated: one container, read-only, one-hour timer. It opens that and nothing else, then bounces at zero. Its issuer can't recall it early (only a stored access policy or a user delegation SAS can be revoked). _"Time-limited, not recallable."_
3. A user's Entra badge is checked against "Storage Blob Data Reader": granted. An Owner with no data role tries their Entra badge: bounces. Then they open the drawer, list the key, and walk through. _"Owner can't read blobs, but can fetch the key that can."_
4. "Allow shared key access" is switched off: the key now opens nothing. The Owner is bounced again. The Reader's role is removed: within minutes their badge bounces; no scripts to chase.
   **The moment**: Beat 4 against beat 1: removing Entra access is one edit in one place, while the key had to be found and rotated in every script.
   **Interaction**: Choose a credential type, click "revoke", and count the places that must change: everywhere for a key, nowhere else for Entra ID.
   **Ending**: Entra only, shared key off, door shut. _"Prefer the one you can take back with one click."_
   **Variants**: `azure-control-plane-vs-data-plane`, `azure-rbac`, `azure-key-vault`.
   **Techniques**: clone, timer, restyle, failure, choice, caption.
   **Review**: Improved — "Owner isn't a data key" was incomplete in a way that mislead: Owner and Contributor can list the account keys and so reach the data through Shared Key, which is the real reason to switch shared key access off; added the drawer and the switch. Role revocation isn't instant (token and role caches take minutes), so "instantly" became "in one place, within minutes". Added that an ad hoc SAS can't be recalled. Alternative weighed: a leaked-key incident story; the same beats, kept the credential tour. Checked against the catalog (account, service, user delegation SAS).

### Blob data protection: soft delete, versioning, snapshots, immutability (`azure-blob-data-protection`)

**The aha**: Redundancy copies your mistakes everywhere instantly; only these features take you back in time, and a locked immutability policy is the one thing even an administrator, or ransomware holding admin rights, can't undo.
**Misconception to defeat**: That redundant copies make a bad delete or overwrite recoverable.
**Cast**: A blob with three replica copies drawn behind it, a version stack of time-stamped slices, a recycle bin with a retention countdown, and a "protections" panel with soft delete, versioning and point-in-time restore switches. A padlock on one blob: "immutable until <date>, policy locked".
**Opening frame**: The blob with its three replicas, one version slice, empty bin.
**Story**:

1. The blob is deleted with only redundancy: all three replicas vanish at once. _"Copies copy the mistake."_
2. Undo; turn on versioning and soft delete. An overwrite stacks the old slice into the version stack. _"Overwrites don't erase, they stack."_
3. A delete drops the blob into the bin with a countdown, recoverable until zero. A script wrecks a thousand blobs; a restore slider scrubbed back to before it puts them back.
4. An attacker with the account's top role switches soft delete and versioning off and deletes. The ordinary blobs fall. One blob under a locked time-based retention policy refuses the delete and stays. _"Immutability doesn't ask who you are."_
   **The moment**: Beat 4, the one locked blob refusing a request that every other protection allowed, because the requester had every permission there is.
   **Interaction**: Scrub the point-in-time restore slider; attempt "turn off protections and delete everything" and see what the lock, and only the lock, stops.
   **Ending**: One immutable blob standing after the rest fell. _"The only one even you can't take back."_
   **Variants**: `azure-storage-redundancy`, `azure-backup`, data's `soft-delete-and-versioning`.
   **Techniques**: contents, clone, failure, restyle, spotlight, caption.
   **Review**: Improved — the old story had the attacker delete "everything, versions included" and then ended with the rest recovered from softer protections, but an admin can disable soft delete and versioning, so those aren't attack-proof; the plan now says so and recovers only from accident. Added the on-screen defeat of the redundancy misconception (beat 1), previously only named. The policy must be locked: an unlocked time-based policy can still be changed. Alternative weighed: a storage-account resource lock instead; locks only guard the control plane. Checked: soft delete, versioning, PITR for block blobs, time-based retention and legal hold.

### Azure Files and Azure File Sync (`azure-files`)

**The aha**: Azure Files is a file server you don't run, with real folder permissions; File Sync lets branch offices keep fast local copies while the full share stays in Azure.
**Misconception to defeat**: That it's blob storage with folder names, rather than a mountable SMB/NFS share with real file-system behaviour and ACLs.
**Cast**: An Azure Files share in the cloud, a folder tree with NTFS-style permission tags, mounted as a drive letter on a laptop. Two branch-office Windows servers, each with a local cache disk, linked to the share by "cloud tiering" arrows.
**Opening frame**: The cloud share's folder tree, both branch caches holding full copies of it.
**Story**:

1. A laptop opens `\\acct.file.core.windows.net\share` as a normal drive and renames a folder with files in it, one atomic action, as on any file server. _"A mounted drive, not an object store."_
2. Branch A writes a new file: it syncs up to the cloud share. _"The full share lives in Azure."_
3. Branch B's folder listing shows the file at once as a stub (a placeholder icon, near-zero local size); the bytes are pulled only when someone opens it. _"Present in the listing, not yet on disk."_
4. A file untouched for months ages into a stub at Branch A; the local space meter shrinks while the listing looks unchanged.
5. A user without the right NTFS permission opens a protected folder: refused, as on a real file server.
   **The moment**: Beat 3, a file that looks fully present yet is only a pointer until opened.
   **Interaction**: Toggle cloud tiering; open a stub and watch it hydrate from the cloud.
   **Ending**: Both caches hold only what is in use; the cloud share holds everything. _"Fast locally, complete centrally."_
   **Variants**: `azure-storage-account`; data's `file-storage` for the general version.
   **Techniques**: boundary, stream, restyle, contents, caption.
   **Review**: Improved — the misconception (blob-with-folders) was never defeated on screen; added a mounted-drive beat with a real rename. Tiering has two policies (free space on the volume and date since last access), shown by beats 3 and 4. Alternative weighed: Azure Files vs Azure NetApp Files comparison; belongs to a different decision. Checked: SMB and NFS, AD DS/Entra DS/Entra Kerberos identity-based access with share RBAC plus NTFS ACLs, File Sync agent on Windows Server.

## Databases and analytics

### Choosing a data store in Azure (`azure-data-store-decision`)

**The aha**: Start from the data's shape and access pattern, not from a favourite database; most real systems use several stores, each for what it does best, and some of those stores hold copies of the others.
**Misconception to defeat**: That one database, picked once, should hold everything an application needs.
**Cast**: A short branching question path: "Structured and relational?", "Flexible schema at global scale?", "Need in-memory speed?", "Need search or vectors?", "Telemetry or analytics?" Each answer lights a service: Azure SQL (or PostgreSQL), Cosmos DB, Azure Managed Redis, AI Search, Microsoft Fabric.
**Opening frame**: The question path dim; a sample shop's pieces (orders, catalog, sessions, search, dashboards) waiting beside it.
**Story**:

1. "Orders" walks the path: structured, relational. Azure SQL lights.
2. "Product catalog, flexible attributes, global reads" walks it: Cosmos DB lights.
3. "User sessions": needs raw speed. Azure Managed Redis lights.
4. "Product search": full-text and vector matching. AI Search lights, and an arrow of copies runs into it from the catalog. _"A search index is a copy, not the source."_
5. "Dashboards": Fabric lights, fed from SQL. All five lit services assemble into one architecture, each holding only its piece.
   **The moment**: Beat 5, one real system with five stores lit at once, each earning its place.
   **Interaction**: Toggle requirement checkboxes for a new piece of data and watch which store or stores light.
   **Ending**: The architecture settled, labelled by job rather than product. _"Shape first, then the store."_
   **Variants**: `azure-sql-deployment-options`, `azure-cosmos-db-partitioning`, `azure-analytics-services-choice`.
   **Techniques**: choice, spotlight, restyle, caption.
   **Review**: Improved — the old plan lit four stores but showed "dashboards" waiting in the opening and never routed; added Fabric. Added the copy arrow into AI Search so viewers don't think a search index is a primary store. Alternative weighed: a table of stores by data model; the walk-through shows the same selection faster and ends in the system. Checked names: Azure Managed Redis (replacing Azure Cache for Redis), AI Search, Fabric (catalog).

### Azure SQL: SQL Database vs SQL Managed Instance vs SQL Server on VMs (`azure-sql-deployment-options`)

**The aha**: The choice is the unit you hand to Azure: a database, a whole instance, or just the hardware. The closer you need to stay to on-premises SQL Server, the further down that list you go.
**Misconception to defeat**: That these are three price tiers of "the same SQL Server", rather than three units of management.
**Cast**: Three columns. "SQL Database": one database icon behind a thin logical-server shell. "Managed Instance": a fuller instance box inside a VNet with SQL Agent and CLR icons. "SQL Server on VM": a full VM box, OS and SQL Server both visible and yours.
**Opening frame**: All three columns, each running the same sample database.
**Story**:

1. "Run a cross-database query": SQL Database can't; Managed Instance and the VM can.
2. "Use SQL Agent jobs": none in SQL Database; both others have it.
3. "Patch the OS": SQL Database's patching happens invisibly; Managed Instance shows a scheduled maintenance window; on the VM a person clicks "install updates".
4. Two meters under each column move in opposite directions: "control and compatibility" rises left to right, "Azure does for you" falls.
   **The moment**: Beat 4, the two meters crossing: more control always costs some managed convenience.
   **Interaction**: Toggle a required SQL Server feature (cross-database queries, SQL Agent, linked servers, OS access) and see which columns survive.
   **Ending**: The feature list narrows the three columns to the one that fits. _"Choose the unit, not just the price."_
   **Variants**: `azure-sql-compute-models`, `azure-sql-failover-groups`, `azure-data-store-decision`.
   **Techniques**: side by side, meter, failure, choice, caption.
   **Review**: Improved — the old meters were "control" and "compatibility" moving in opposite directions, but both rise together toward the VM; the true opposite is how much Azure does for you. Fixed "blocks" to "can't" for cross-database queries (an unsupported feature, not a blocked request). Alternative weighed: a decision tree on features; the three-column test is the same, shown as survivors. Checked: SQL Agent absent from SQL Database; Managed Instance is inside a VNet with near-full compatibility.

### Azure SQL purchasing models: DTU vs vCore, serverless, elastic pools, Hyperscale (`azure-sql-compute-models`)

**The aha**: This is about how to pay for unpredictable load: serverless for one database that idles, an elastic pool for many databases that peak at different times, Hyperscale when size or fast scaling is the real problem.
**Misconception to defeat**: That DTU and vCore are two price lists for the same thing, and that a pool is always cheaper.
**Cast**: A single database with a toggle between a bundled DTU dial and vCore meters for compute and storage (IO comes with the vCores). An elastic pool frame holding five databases, each with a jagged usage chart and one combined pool line. A Hyperscale database with separate compute and storage layers.
**Opening frame**: DTU dial, one bundled number; toggled to vCore, two independent meters (compute, storage).
**Story**:

1. The single database's load goes idle overnight; in serverless mode compute pauses, cost drops to storage only, and the next request shows a short "resuming" timer. _"Billed per second of use."_
2. Five databases' charts, each spiking at a different hour, overlay into the pool: the combined line is far flatter than any one peak.
3. One purchased capacity covers all five; the pool's cost sits under five separate peak-sized purchases.
4. Now the five spike at the same hour: the combined line is as tall as the sum of peaks and the saving disappears. _"A pool pays when peaks don't line up."_
5. A Hyperscale database grows to 50 TB; its restore finishes on a fast timer (it uses storage snapshots), while a same-sized non-Hyperscale restore crawls on.
   **The moment**: Beats 2 and 3: five jagged charts collapsing into one smooth line, with the savings written under it, followed by beat 4 taking it away.
   **Interaction**: Dial how aligned the five peaks are, from staggered to simultaneous; the combined line and the pool's saving move together.
   **Ending**: A staggered pool at a flat line, well under the sum of its members' peaks. _"Pay for the shape of the demand, not each database's worst moment."_
   **Variants**: `azure-sql-deployment-options`, `azure-cosmos-db-partitioning` (a different resource, the same "budget split across units" idea).
   **Techniques**: toggle, dial, meter, chart, timer, caption.
   **Review**: Improved — the vCore panel showed three meters including IO, but IO isn't separately bought (it scales with vCores); fixed to two. The old interaction dialled database count, which doesn't change the picture; the real lever is how aligned the peaks are, and beat 4 now defeats "pools are always cheaper". Alternative weighed: a four-way chooser; four ideas, so kept the story but pooled the weight on the pool. Checked: serverless auto-pauses (not in Hyperscale), DTU as a blended measure, Hyperscale fast snapshot restore.

### Azure SQL high availability, geo-replication and failover groups (`azure-sql-failover-groups`)

**The aha**: A failover group moves the name with the data, so an app reconnects with the same connection string after a regional failover instead of being reconfigured.
**Misconception to defeat**: That failing over a database means updating every app's connection string by hand.
**Cast**: A primary region with a primary database and an in-region HA replica (zone-marked); a secondary region with a geo-replica. A "listener" name above both, its arrow on whichever is primary. An app below, its connection string label fixed and unchanging.
**Opening frame**: The listener pointing at the primary region; the app connecting through the listener, never touching either database's real name.
**Story**:

1. A zone in the primary region fails: the HA replica takes over; connections drop for a moment and the app's retry logic reconnects through the same name. _"Handled inside the region."_
2. The whole primary region fails. A grace-period timer runs (or a person clicks "fail over"); the failover group flips and the listener's arrow swings to the secondary region.
3. The connection string label never changes: it resolves through the same listener name to wherever primary now is. Writes acknowledged just before the failure that hadn't replicated are shown fading, a small cost of asynchronous replication. _"Same name, possibly a few seconds of writes less."_
4. A grey inset shows active geo-replication alone: each database has its own server name, so the app's string would need editing and redeploying.
   **The moment**: Beats 2 and 3 together: the listener arrow swinging regions while the connection string stays exactly as it was.
   **Interaction**: A "fail over the region" button; the listener re-points and the app's config label stays untouched.
   **Ending**: Listener on the new primary, app connected, no redeploy. _"The name moved so the app didn't have to."_
   **Variants**: `azure-storage-redundancy`, `azure-cosmos-db-global-distribution`.
   **Techniques**: move, token, failure, spotlight, caption.
   **Review**: Improved — "the app notices nothing" overstated zone failover (connections drop; apps need retry logic), and the plan made regional failover look automatic and lossless: it follows a grace period or a manual action and replication is asynchronous, so recent commits can be lost. Both now shown. Alternative weighed: a DNS-level view (the listener is a name that gets re-pointed); kept as a caption-level fact. Checked: read-write and read-only listeners, active geo-replication up to four secondaries (catalog).

### Cosmos DB partition keys and request units (`azure-cosmos-db-partitioning`)

**The aha**: Your provisioned RU/s are split evenly across physical partitions, so a hot key throttles you with 429s while capacity on other partitions goes unused.
**Misconception to defeat**: That more throughput alone fixes a slow container, and that "many distinct values" is all a good key needs.
**Cast**: A container whose items group by partition key into logical partitions, mapped onto a fixed row of physical partitions, each with an equal slice of the container's RU/s (6,000 RU/s over three partitions is 2,000 each). Requests are tokens with an RU-cost tag (a 1 KB point read costs 1 RU).
**Opening frame**: Three physical partitions, each meter calm and even, 2,000 RU/s each.
**Story**:

1. A well-spread key (`tenantId`, thousands of values, similar traffic): tokens spread evenly; every meter stays calm.
2. A low-cardinality key (`status`, two values): nearly every token piles onto one or two partitions; those meters hit their 2,000 limit and show 429s while the third sits flat. _"6,000 bought, 2,000 usable."_
3. Throughput doubled to 12,000: the hot partitions' ceilings go up with the budget, but the share stays even and the pile-up is still the first to break.
4. Another case: a key with thousands of values but one huge tenant sending half the traffic. That tenant's partition pins red too. _"Many values isn't enough: even traffic is."_
5. Changing the key in place is refused; the way forward is a new container with a better key and the data copied across.
   **The moment**: Beat 2, one partition pinned red while its neighbour sits idle at the same total throughput.
   **Interaction**: Dial the cardinality and skew of a sample key and watch the request spread and the 429 meter.
   **Ending**: A well-spread key restored, all meters calm at the same total RU/s. _"The key decided it, not the budget."_
   **Variants**: `azure-cosmos-db-consistency-levels`, `azure-cosmos-db-global-distribution`; data's partitioning concepts for the general version.
   **Techniques**: contents, token, meter, dial, spotlight, caption.
   **Review**: Improved — added real numbers (RU/s per partition) so "capacity sitting idle" adds up, and a skewed high-cardinality case: the old plan implied cardinality alone makes a good key, which is a common wrong lesson. Beat 3 now says the budget grows but the hot partition still breaks first. Alternative weighed: adding the 20 GB logical partition limit as the failure; kept the 429 as the more visible. Checked: 1 KB point read = 1 RU, logical partition 20 GB, even RU split across physical partitions (catalog).

### Cosmos DB consistency levels (`azure-cosmos-db-consistency-levels`)

**The aha**: Consistency is a dial, not a switch: stronger levels cost latency, cross-region availability and read RUs, and Session, the default, gives most apps what they need.
**Misconception to defeat**: That this is the CAP theorem restated, or one on/off choice rather than five graduated positions.
**Cast**: A writer client in Region A, a reader client in far Region B, and a five-position dial: Strong, Bounded Staleness, Session, Consistent Prefix, Eventual. A lag meter, a latency meter and an RU-cost meter beside the reader.
**Opening frame**: Dial on Eventual; two writes leave Region A moments apart.
**Story**:

1. At Eventual the reader in B sometimes sees the writes in the wrong order. _"Loosest: not even in order."_
2. Consistent Prefix: the writes always arrive in the order sent, just late. _"In order, eventually."_
3. Session: the writing client, reading from Region B with its session token, always sees its own writes; another client in B still lags. _"Your own writes, for free."_
4. Bounded Staleness: lag is capped at a visible maximum, a count of versions or a time. In a multi-region account the minimum is 100,000 versions or 5 minutes.
5. Strong: reads wait until Region B is proven caught up; latency spikes and the RU meter doubles. A network split between A and B drops B's availability to zero until it heals. _"Strongest, and it can cost you the region when cut off."_
   **The moment**: Beat 5 against beat 3 during the same network split: Strong's availability in B drops to zero while Session keeps serving, slightly stale, the whole time.
   **Interaction**: Move the dial live through all five levels while reading the same write stream from the far region.
   **Ending**: Dial back on Session, meters calm. _"The default most apps never need to move."_
   **Variants**: `azure-cosmos-db-partitioning`, `azure-cosmos-db-global-distribution`; data's general consistency-model concepts.
   **Techniques**: dial, meter, timer, failure, side by side, caption.
   **Review**: Improved — "5 versions or 5 seconds" is wrong for the cross-region scenario drawn: those are single-region minimums; a multi-region account's minimum bound is 100,000 versions or 5 minutes. Session needed the same-client framing (a session token), since "the reader that wrote" in another region reads as two clients. Added an RU meter for the cost the aha promises. The CAP distinction stays blurred: Strong is the CAP-flavoured end, so the plan no longer claims independence from it. Alternative weighed: a restaurant-ordering analogy; the writes-in-order demo is more direct. Checked: five levels, Session as default, Strong doubles read RUs (catalog).

### Cosmos DB global distribution and multi-region writes (`azure-cosmos-db-global-distribution`)

**The aha**: Writing in every region lowers latency and survives losing a region with no failover gap, but it gives up Strong consistency and means your data model must cope with conflicts.
**Misconception to defeat**: That multi-region writes are simply "more redundant" than single-region writes, with no trade-off.
**Cast**: Three region frames A, B, C, each with a Cosmos replica, a mode toggle (single-region writes / multi-region writes), and an RU/s meter per region.
**Opening frame**: Single-region writes: write arrows reach Region A only; a stream flows out to B and C as read replicas.
**Story**:

1. Region A fails: a visible gap while service-managed failover promotes B to accept writes.
2. Switch to multi-region writes: write arrows land in all three regions, each accepted locally. The "Strong" level greys out. _"Local writes, no Strong."_
3. Region A fails again in this mode: B and C keep accepting writes with no gap; the recovery is visibly faster than beat 1. _"No failover, because nobody was promoted."_
4. Two clients write the same item at once, one in A and one in C: a clash icon appears; by default the version with the later timestamp wins and the other greys out. _"No gap, but you must be ready for a clash."_
   **The moment**: Beat 1 against beat 3: the same regional failure with a gap in one mode and none in the other, followed straight by the clash only multi-region mode can produce.
   **Interaction**: Toggle the write mode; "fail a region"; "write the same item in two regions at once" to force a conflict.
   **Ending**: Multi-region writes settled, the resolved conflict beside the seamless failover. _"No gap, but you must be ready for a clash."_
   **Variants**: `azure-cosmos-db-consistency-levels`, `azure-sql-failover-groups`, `azure-storage-redundancy`.
   **Techniques**: toggle, failure, token, spotlight, side by side, caption.
   **Review**: Improved — reordered beats 3 and 4 so "the moment" (gap vs no gap, then the clash) matches the story order (the old plan put the clash before the second failure and then described it as following); added Strong greying out, the named consistency cost; added a per-region RU/s meter, as each region adds to the bill. Alternative weighed: leading with the conflict; but the no-gap payoff is what draws people to the feature. Checked: last-writer-wins default, custom resolution possible, Strong unavailable with multi-region writes (catalog).

### Cosmos DB change feed (`azure-cosmos-db-change-feed`)

**The aha**: Write once, and let materialized views, caches, search indexes and downstream services update themselves from the feed. The database becomes an event source, with no dual writes to keep in sync.
**Misconception to defeat**: That keeping a search index or a cache current means writing to it separately, in the same request as the database write.
**Cast**: A Cosmos container beside a change feed strip, ordered per partition key. Below, independent reader boxes: a Function trigger, a materialized view, a search index, a cache, each with a checkpoint marker kept in a "leases" container.
**Opening frame**: The strip with three checkpoint markers at slightly different positions.
**Story**:

1. A write lands in the container and appears at the head of the feed. _"One write, one place."_
2. Each reader processes the new entry at its own pace; one marker is a few entries behind, catching up.
3. An item is updated twice before a slow reader looks: the reader sees only its latest version, once, at its latest position. _"The feed is a view of changes, not a history of every change."_
4. A new reader is added mid-stream: its marker starts at the beginning and moves forward, invisible to the writer.
5. A crossed-out inset shows the alternative: writing to the database and to a search index in the same request, a failure between the two leaving them out of sync forever.
   **The moment**: Beat 5 beside beats 1 through 4: the single write with many readers, against the crossed-out dual write that fails between two stores.
   **Interaction**: Add a new reader partway through; watch it pick its starting point and catch up independently.
   **Ending**: All checkpoints at the same point on the feed, the dual-write inset still crossed out. _"The feed did the synchronising."_
   **Variants**: `azure-event-hubs`, `azure-cosmos-db-partitioning`; messaging's change-data-capture concepts.
   **Techniques**: contents, token, move, failure, side by side, caption.
   **Review**: Improved — the plan drew an append-only log, which would make viewers think every intermediate version and each delete is kept; in the default mode the feed holds only the latest version of each item (deletes and old versions need all-versions-and-deletes mode), so beat 3 now shows an item updated twice appearing once. Added the leases container where checkpoints live, and a restart-from-the-beginning reader. Alternative weighed: a transactional outbox framing; accurate, but it needs more explaining than the crossed-out dual write. Checked: ordered per partition key, lease container, Functions trigger and processor.

### Choosing analytics: Microsoft Fabric vs Azure Databricks vs Data Factory vs Synapse (`azure-analytics-services-choice`)

**The aha**: These overlap heavily, so the real choice is the operating model: Fabric for one SaaS estate built around Power BI, Databricks when Spark engineering or multicloud matters, Data Factory when you only need pipelines between stores you already run, and Synapse as the existing option that new investment is moving away from.
**Misconception to defeat**: That these are four competitors doing the same job, so picking one is a feature comparison.
**Cast**: Four boxes with overlapping capability circles. Fabric: OneLake, lakehouse, warehouse, pipelines, Real-Time Intelligence and Power BI inside one boundary, one capacity meter. Databricks: a Spark engine with its own cluster meter. Data Factory: pipeline and orchestration arrows, with small mapping-flow compute but no lakehouse or reports. Synapse: greyed, an arrow toward Fabric.
**Opening frame**: All four boxes; a task waiting: "move data from an on-premises SQL database into a lakehouse and build a Power BI report."
**Story**:

1. The task runs through Fabric: one capacity meter covers ingestion, storage, transformation and the report.
2. The task through Databricks: a Spark cluster meter spins up for the transformation; Power BI is a separate service with its own licensing and capacity. _"Two meters for one job."_
3. The task through Data Factory alone: it moves and lightly reshapes the data, then stops; no lakehouse, no report.
4. Synapse handles an older version of the task, greyed, with workloads visibly migrating toward Fabric.
   **The moment**: Beat 1 against beat 2, side by side: one capacity doing everything versus two meters doing parts of the same job.
   **Interaction**: Choice: pick a priority ("one SaaS bill", "Spark and multicloud", "just pipelines between stores I already run") and the matching service highlights.
   **Ending**: Fabric's single meter over the finished report, Synapse's arrow still pointing toward it. _"Choose by who runs it and how it's billed, not by the feature list."_
   **Variants**: `azure-data-store-decision`, `azure-event-hubs`, `azure-cosmos-db-change-feed`.
   **Techniques**: boundary, meter, choice, move, side by side, caption.
   **Review**: Improved — Data Factory was drawn as "no compute of its own, just moves data", but it runs mapping data flows and an integration runtime, so it is now "moves and lightly reshapes". Softened Synapse from "shouldn't start on" to what the catalog says (still supported, investment moving to Fabric), and noted that Data Factory also exists inside Fabric (flagged in the cast). Alternative weighed: a layers diagram of ingest/store/transform/serve for each; clearer to compare the meters on one task. Checked: Fabric billed by capacity, Databricks as a Spark platform, Power BI licensed separately.
