# Fundamentals plans, part 1

Stage 2 plans for `catalog/fundamentals.md` groups 1 to 6, in catalog order. They use the shared
fundamentals language (consistent with the agent covering groups 7–12): the shared responsibility
stack is a column of ten layers — facility, network, servers, storage, virtualisation, OS,
runtime, app, data, identity/access — coloured blue where the customer manages the layer and grey
where the provider does; global infrastructure is drawn on a simple world map, a region a rounded
cluster of two or three zones (each zone a small building icon), edge locations small dots;
resources are small tiles; organisational hierarchy is nested frames (organisation › accounts or
subscriptions › groups › resources); money is a coin meter that ticks up while things run; demand
is a line over time along the bottom, capacity a shaded area over it that should hug the line when
things are working and gap away from it when they aren't.

## 1. What the cloud is

### On-premises vs cloud (`on-premises-vs-cloud`)

**The aha**: On-premises you guess capacity months ahead and live with the guess; in the cloud, capacity is minutes away and you hand back what you don't need.
**Misconception to defeat**: That the cloud is just "renting the same servers" — the difference is the guesswork, not the hardware.
**Cast**: One demand line along the bottom, time running left to right over a business week. Two capacity areas shaded over it, side by side: "On-premises" as a staircase of big rectangular steps (each ordered, not reactive), "Cloud" as a smooth area that can redraw itself. A coin meter under each.
**Opening frame**: Both sides show the same demand line; on-premises already has a staircase under it with visible gaps and one place where the line pokes above a step. Cloud's side is empty, waiting. _"Same demand. Two ways to meet it."_
**Story**:

1. On-premises: the line spikes above the current step; tokens queue up, red, stuck. An order is placed; a timer runs "6 weeks"; a new, much taller step lands — sized for a guess, not this spike. _"Too little, and you wait weeks for too much."_
2. The line dips low; the gap between it and the step's top grows huge, shaded idle; the coin meter keeps ticking at the same rate regardless. _"Too much, and you pay for the gap anyway."_
3. Switch to cloud: the shaded area rises and falls a beat behind the line, hugging it closely both up and down. _"Capacity requested in minutes. Handed back just as fast."_
4. The two coin meters run side by side: on-premises ticks at a flat rate all week; cloud's rate visibly slows every time the line dips. _"One guesses once. The other keeps adjusting."_
   **The moment**: The side-by-side freeze of the jagged staircase (big gaps, one overload spike) against the cloud area's tight hug of the same line.
   **Interaction**: A dial that reshapes the demand line (steady, spiky, seasonal); watch the staircase fail to keep up while the cloud area tracks it.
   **Ending**: Loops to the opening frame, now with the cloud side's area pulsing in time with the line.
   **Variants**: `elasticity-vs-scalability`, `cloud-cost-drivers`, `autoscaling-for-cost`.
   **Techniques**: chart, meter, boundary, failure, timer, side by side, dial, caption.
   **Review**: Keep — the staircase against a hugging area, with meters, is the sharpest contrast available; claims are sound.

### The five essential characteristics (NIST) (`nist-cloud-characteristics`)

**The aha**: Cloud isn't a place or a technology, it's a way of consuming computing — self-served, pooled, elastic, metered, reachable from anywhere. Take one away and it's just hosting.
**Misconception to defeat**: That virtualisation, or "someone else's computer", is what makes something cloud.
**Cast**: Five tiles around a central "Your workload" tile: On-demand self-service, Broad network access, Resource pooling, Rapid elasticity, Measured service. A label above that reads "Cloud".
**Opening frame**: All five tiles lit green around the workload tile, label reading "Cloud". _"Five traits, together."_
**Story**:

1. Self-service: a button is clicked, no approval step, the workload tile appears instantly. _"No ticket. You click, it exists."_
2. Broad network access: phone, laptop and tablet icons all reach the tile the same way. _"Reachable the same way, from anywhere."_
3. Resource pooling: zoom out — the tile is one slice of a shared pool, other tenants' tiles around it. _"Carved from one shared pool."_
4. Rapid elasticity: tiles multiply and shrink as a demand line beneath wobbles. _"Grows and shrinks in minutes."_
5. Measured service: a meter under the tile ticks per use. _"Metered, like a utility."_
6. Switch elasticity off: tiles freeze at a fixed count despite the demand line still wobbling; the label above flips from "Cloud" to "Hosting". _"Take one away, and it's just hosting."_
   **The moment**: The label flip in beat 6 — nothing else changes except one trait switching off, and the word underneath changes with it.
   **Interaction**: Toggle each of the five characteristics off in turn and watch the label flip between "Cloud" and "Hosting".
   **Ending**: All five switched back on, label settled on "Cloud".
   **Variants**: `on-premises-vs-cloud`, `resource-pooling-and-multi-tenancy`, `elasticity-vs-scalability`, `pay-as-you-go`, `portal-cli-sdk-api`.
   **Techniques**: appear / disappear, zoom, meter, toggle, restyle, caption.
   **Review**: Keep — the label flip when one trait is switched off is the right moment; the five names and definitions match NIST SP 800-145.

### Resource pooling and multi-tenancy (`resource-pooling-and-multi-tenancy`)

**The aha**: You share physical machines with strangers, and the isolation is enforced in software; pooling is what makes the cloud cheap and instant, and also why a noisy neighbour can occasionally steal performance.
**Misconception to defeat**: That a cloud VM is a private machine, not a slice of a shared one.
**Cast**: One grey physical host box holding three tenant tiles (blue, green, orange), each inside its own dashed isolation boundary (the hypervisor). Off to the side, a lone "Dedicated" tile on its own host.
**Opening frame**: Host box, three calm tenant tiles inside their dashed boundaries. _"Three tenants, one machine."_
**Story**:

1. A new tenant tile is requested and appears inside the shared host instantly. _"A slice of someone else's hardware, on demand."_
2. Zoom into a boundary: the hypervisor layer separates each tile's memory and CPU. _"Isolation is software — the hypervisor, the virtual network, access rules."_
3. The orange tenant spikes its CPU load; the host's shared CPU meter maxes out; the blue tenant's own small meter dips, untouched by anything it did. _"A noisy neighbour can nibble your performance."_
4. The "Dedicated" tile sits alone on its own host, its coin meter noticeably higher. _"Pay more, skip the pool."_
5. Zoom back out: the one host becomes a whole data hall of hosts, each packed with tenant tiles, utilisation high, cost per tile tiny. _"Pooling is what makes it cheap and instant."_
   **The moment**: Beat 3 — the blue tenant's performance meter dipping purely because of the orange tenant's spike, inside the same box.
   **Interaction**: Drag a load slider on one tenant and watch another tenant's meter react; toggle pooled vs dedicated and compare cost.
   **Ending**: Pool settled, all tiles calm, cost per tile small.
   **Variants**: `nist-cloud-characteristics`, `dedicated-hosts-and-bare-metal`, `shared-responsibility-model`.
   **Techniques**: boundary, zoom, meter, restyle, dial, caption.
   **Review**: Improved — beat 5 no longer implies hundreds of tenants on one host; now a hall of hosts.

### Elasticity vs scalability (`elasticity-vs-scalability`)

**The aha**: Scalability is the ability to handle more load by adding resources; elasticity is adding and removing them automatically, so capacity follows demand down as well as up.
**Misconception to defeat**: That "it can scale" means it's elastic — a system can scale and still sit at its peak size forever.
**Cast**: One demand line along the bottom; two capacity areas shaded over identical copies of it, labelled "Scalable, not elastic" and "Elastic". A coin meter under each.
**Opening frame**: Both areas matching the line closely, calm. _"Same demand, two systems."_
**Story**:

1. Demand spikes sharply; both capacity areas grow to cover it (left: an engineer icon adds capacity by hand; right: it happens automatically). _"Both can handle more."_
2. Demand falls back down. Left ("Scalable, not elastic"): the capacity area stays at the peak height, a wide idle gap opens under it, the coin meter keeps ticking at the peak rate. _"It can grow. Nobody told it to shrink."_
3. Right ("Elastic"): the capacity area drops right behind the line, hugging it tightly again; its coin meter drops with it. _"It follows demand down, too."_
4. Freeze side by side on the idle gap (left) against the tight hug (right), the two coin meters now far apart.
   **The moment**: The same demand drop, one system stuck high and wasting, the other tracking down and saving, in the same frame.
   **Interaction**: A dial that reshapes the demand curve (spike, steady, seasonal); watch both capacity areas respond differently each time.
   **Ending**: The elastic side settles into a loop, hugging a new demand wobble.
   **Variants**: `on-premises-vs-cloud`, `autoscaling-for-cost`, `compute-options-compared`.
   **Techniques**: chart, meter, side by side, dial, caption.

## 2. Service models and responsibility

**Review**: Improved — beat 1 shows the non-elastic side growing by hand, so "scalable" is not mistaken for "automatic".

### IaaS, PaaS and SaaS (`iaas-paas-saas`)

**The aha**: Each step up the stack hands another layer to the provider — less control, less work, faster start. The question to ask of any service is "which layers do I still own?"
**Misconception to defeat**: That IaaS/PaaS/SaaS is about size or price rather than which layers you manage.
**Cast**: The ten-layer responsibility stack (facility → identity/access), shown as four columns side by side: On-premises, IaaS, PaaS, SaaS. A slider above spanning the four.
**Opening frame**: On-premises column, all ten layers blue. _"Everything, yours."_
**Story**:

1. Slide to IaaS: facility, network, servers, storage and virtualisation turn grey; OS, runtime, app, data and identity/access stay blue. _"Rent the hardware up through virtualisation."_
2. Slide to PaaS: OS and runtime also turn grey; only app, data and identity/access stay blue. _"Rent a platform that runs your code."_
3. Slide to SaaS: app turns grey too; data and identity/access stay blue. _"Rent finished software. You still manage your data and your users."_
4. Rewind and sweep the slider end to end with all four columns visible at once: the line between blue and grey climbs steadily upward as the model changes.
   **The moment**: The full sweep in beat 4 — one column's blue layers visibly eroding upward as the slider moves, with nothing else on screen changing.
   **Interaction**: Drag the slider yourself between the four models and watch the layers recolour live.
   **Ending**: Rests wherever the viewer leaves the slider, the blue/grey boundary line held steady.
   **Variants**: `serverless-computing`, `containers-as-a-service`, `managed-vs-self-managed`, `shared-responsibility-model`, `compute-options-compared`.
   **Techniques**: layers, restyle, dial, side by side, caption.
   **Review**: Keep — layer splits for IaaS, PaaS and SaaS are correct and the slider sweep is the right moment.

### Serverless (`serverless-computing`)

**The aha**: Serverless still has servers; you never see, size or patch them, and when nothing runs you pay nothing.
**Misconception to defeat**: That "serverless" means no servers exist, or that it's the same as PaaS.
**Cast**: A dashed curtain hiding facility through runtime (all grey). Above it, one small floating tile, "your function code" (blue). A request counter and a coin meter below.
**Opening frame**: Curtain down, one blue code tile floating above it, idle, meter at $0. _"Nothing running, nothing billed."_
**Story**:

1. No requests: the tile sits flat, no instance visible anywhere, meter stays at $0.
2. A request token arrives: behind the curtain a hidden instance flickers into existence just long enough to run it, then vanishes; the meter ticks up by a sliver (billed for requests and run time). _"A server appears and disappears. You never touch it."_
3. A hundred requests arrive at once: a hundred silhouettes flicker behind the curtain simultaneously; the meter rises in proportion. _"It scales itself, even to zero."_
4. The curtain lifts briefly to show the provider's fleet of grey machines, then drops. _"Someone sizes and patches those. Not you."_
5. Beside it, a PaaS tile stays lit and billed even with zero requests. _"A typical PaaS app: always on, always billed. Serverless: billed only while it runs."_
6. One slow request shows a brief "cold start" timer before the silhouette responds. _"The trade: occasional cold starts, strict time limits."_
   **The moment**: Beat 2 — the instance appearing and disappearing in exact lockstep with the single request, proving it was a real server, just invisible and momentary.
   **Interaction**: Fire a burst of requests and watch instance count and the meter respond; toggle the PaaS comparison on and off.
   **Ending**: Returns to idle, meter at $0, curtain down.
   **Variants**: `iaas-paas-saas`, `containers-as-a-service`, `managed-vs-self-managed`, `compute-options-compared`, `pay-as-you-go`.
   **Techniques**: layers, boundary, token, meter, side by side, timer, toggle, caption.
   **Review**: Improved — PaaS comparison hedged to "typical" (some PaaS scales to zero) and billing says requests plus run time, not only per request.

### Containers as a service (CaaS) (`containers-as-a-service`)

**The aha**: CaaS sits between IaaS and PaaS: you own the image, the provider owns more and more of what runs it — the less cluster you can see, the closer it is to serverless.
**Misconception to defeat**: That CaaS is just "Kubernetes", with one fixed amount of what you manage.
**Cast**: A spectrum bar: self-run cluster on IaaS — managed Kubernetes — serverless containers — PaaS. A container image tile ("your image", blue) constant throughout. Beneath it, a cluster-visibility panel that shrinks moving right.
**Opening frame**: Leftmost position: a full cluster of VM nodes (blue), the image tile sitting on top. _"You run the whole cluster."_
**Story**:

1. Move to managed Kubernetes: the control plane greys out, provider-run; the worker nodes stay blue, still yours to patch, upgrade and size (standard mode). _"The provider runs the brain. You still run the nodes."_
2. Move to serverless containers: the nodes themselves grey out and disappear from view; only the image tile remains, floating (Fargate, Cloud Run and Container Apps work this way; "autopilot" Kubernetes modes hide the nodes too). _"No nodes to see at all."_
3. Slide one step further to a PaaS tile: now the platform builds and runs it for you, often just a code push. _"Keep going, and it's PaaS."_
4. Reverse all the way back: the full node cluster reappears, blue, with patch and upgrade tasks ticking on each one. _"Own the cluster, own the toil."_
   **The moment**: Beat 2 — the entire node layer vanishing while the same image tile keeps running unchanged underneath it.
   **Interaction**: Drag the spectrum slider and watch which layer (control plane, nodes, none) is visible and blue at each stop.
   **Ending**: Rests on serverless containers, the image tile alone.
   **Variants**: `iaas-paas-saas`, `serverless-computing`, `compute-options-compared`.
   **Techniques**: layers, restyle, dial, zoom, side by side, caption.
   **Review**: Improved — worker-node duty qualified as standard mode (autopilot modes hide nodes), PaaS step no longer implies PaaS cannot take images.

### Managed vs self-managed services (`managed-vs-self-managed`)

**The aha**: Managed services remove the "undifferentiated heavy lifting" of patching, backups, failover and scaling, in exchange for less control, less tuning, and usually a higher unit price.
**Misconception to defeat**: That "managed" means someone else does the work for free, or that self-managed is always cheaper.
**Cast**: Two identical database tiles, "Self-managed (on a VM)" and "Managed service", each with a task checklist beside it: patch OS, apply DB updates, configure backups, handle failover, scale storage. A coin meter under each.
**Opening frame**: Both serving the same query token, checklists plain. _"Same database, two ways to run it."_
**Story**:

1. A patch releases: self-managed's "patch OS" item lights urgent red, a small engineer icon has to act; managed's same item is already ticked, handled behind a curtain. _"Patches: you do it, or they do."_
2. The disk fills up: self-managed needs a manual resize, a brief downtime flash; managed resizes itself without interruption. _"Scaling: manual, or automatic."_
3. The primary fails: self-managed's token queue backs up until the engineer intervenes, a long timer running; managed (its high-availability option switched on, shown as a standby tile) fails over automatically in a minute or two. _"Failover: wait for a human, or automatic."_
4. Both coin meters are compared: managed's bill ticks higher per hour, but an engineer-hours meter beside self-managed ticks too. _"A higher unit price. Less work. Count both."_
5. A tuning panel: self-managed's knobs are all exposed; managed's are mostly locked. _"And less control to tune it your way."_
   **The moment**: Beat 3 — the identical failure, one system stalled waiting on a human, the other healed in seconds on its own.
   **Interaction**: Trigger "disk full", "patch due" or "primary fails" and compare each side's response time.
   **Ending**: Both stable again; self-managed's checklist shows real work pending, managed's sits quietly ticked.
   **Variants**: `iaas-paas-saas`, `serverless-computing`, `shared-responsibility-model`.
   **Techniques**: contents, failure, timer, meter, side by side, spotlight, caption.
   **Review**: Improved — failover is a minute or two with HA enabled (not seconds, not automatic by default), and the cost beat now counts engineer hours so "self-managed is always cheaper" is actually defeated.

### Shared responsibility model (`shared-responsibility-model`)

**The aha**: The line of who secures what moves with the service model, but your data, your identities and your access settings are always yours.
**Misconception to defeat**: "The provider handles security", or that a provider's compliance certificate covers your side of the line too.
**Cast**: The ten-layer responsibility stack with a horizontal "responsibility line" that slides up and down it. Three stack instances side by side: IaaS, PaaS, SaaS. A red breach icon that can strike any layer.
**Opening frame**: IaaS stack, the line sitting between virtualisation (grey) and OS (blue). _"The provider secures below the line. You secure above it."_
**Story**:

1. A breach hits the unpatched OS layer, on the customer's side: red spreads upward through runtime, app and data. _"Below the line, their problem. Above it, yours."_
2. Switch to PaaS: the line slides up past OS and runtime, both now grey. A misconfigured app layer breach still spreads, because app is still blue. _"The line moves up... but never past your data and access."_
3. Switch to SaaS: the line sits just below data and identity/access, almost everything else grey. A weak password at the identity/access layer, or a public-sharing setting on the data, still lets an attacker in. _"Even on SaaS, your users and your data are always yours."_
4. A "certified ISO 27001 / SOC 2" banner appears, but only over the grey layers, stopping exactly at the line. _"Certifications cover their layer, not yours."_
5. Typical causes light up above the line: a public storage bucket, a stolen credential, an over-broad role. _"Incidents usually start above the line."_
   **The moment**: Beat 3 — on SaaS, with almost the whole stack grey, the breach still gets in through the thin blue sliver that's left, proving the provider can't close that gap for you.
   **Interaction**: Slide between IaaS, PaaS and SaaS, and try the breach at different layers to see which side it lands on.
   **Ending**: Rests on SaaS, the thin blue sliver ("your data, your access") spotlit.
   **Variants**: `iaas-paas-saas`, `managed-vs-self-managed`, `cloud-provider-sla`.
   **Techniques**: layers, restyle, dial, failure, spotlight, boundary, caption.

## 3. Deployment models

**Review**: Improved — dropped the unsourced breach statistic for named typical causes; SaaS beat notes your configuration (sharing settings) is also yours.

### Public, private, hybrid (and community) cloud (`cloud-deployment-models`)

**The aha**: The deployment model is about who the infrastructure serves and where it runs, not the technology; hybrid means two distinct environments bound together so data and workloads can move between them, not just "some things on-premises, some in the cloud".
**Misconception to defeat**: That having anything on-premises and anything in the cloud makes it "hybrid".
**Cast**: Four zones: Public (a shared cloud icon full of different tenant tiles), Private (a cloud icon with a boundary around one tenant only), Community (a cloud icon shared by a small cluster of similar organisation icons), Hybrid (an on-premises building and a public cloud icon joined by a thick two-way pipe).
**Opening frame**: The four zones laid out side by side, calm. _"Four ways to deploy."_
**Story**:

1. Public: many differently-coloured tenant tiles pop in and out inside the shared cloud icon. _"Open to anyone, multi-tenant."_
2. Private: one tenant's tiles only, inside a drawn boundary that can sit on-premises or hosted off-premises. _"Built for one organisation, wherever it runs, and run like a cloud (self-service, elastic)."_
3. Community: a few similar organisation icons share one cloud icon, boundary drawn around just them. _"Shared by organisations with common needs."_
4. Hybrid: the on-premises building and the cloud icon share one identity badge and one management-plane icon; a workload tile moves across the connecting pipe. _"One identity, one management plane, workloads that can move."_
5. Contrast: the same two boxes with the pipe cut, separate identity badges each side, the workload tile stuck on its own side, label "Not hybrid — just some on-premises, some cloud."
   **The moment**: Beat 4 against beat 5 — the same on-premises building and cloud icon, once joined (the workload crosses freely) and once merely adjacent (it can't move at all).
   **Interaction**: Toggle the pipe between connected and disconnected and watch whether the workload tile can cross.
   **Ending**: Rests on true hybrid, the workload mid-crossing.
   **Variants**: `multi-cloud`, `vendor-lock-in`, `distributed-cloud-edge`, `iaas-paas-saas`.
   **Techniques**: boundary, contents, token, exchange, side by side, toggle, caption.
   **Review**: Improved — hybrid defined as distinct environments bound together (NIST), private cloud must behave like a cloud, removed the odd "without re-authenticating".

### Multi-cloud (`multi-cloud`)

**The aha**: Much multi-cloud is accidental; deliberate multi-cloud buys leverage, best-of-breed services or resilience, at the cost of lowest-common-denominator designs, duplicated skills and egress bills.
**Misconception to defeat**: That multi-cloud is always a deliberate strategy, or that it's free to move data between providers.
**Cast**: Three provider cloud icons (A, B, C). An organisation building connected to each by a pipe of its own.
**Opening frame**: The building connected only to Cloud A, single-coloured, calm. _"One provider, to start."_
**Story**:

1. A second team signs up to Cloud B independently (a new dashed pipe, unplanned); an acquisition brings Cloud C along with it (a third pipe, labelled "inherited"). _"Much multi-cloud isn't planned. It accumulates."_
2. A deliberate case: a workload tile is split by design, one piece on A for cheap GPU, one on B for a particular database. _"Best-of-breed, or negotiating leverage."_
3. A data token tries to move from A to B: a toll gate appears at A's exit (not B's entrance) and the coin meter ticks; sending it back would pay B's exit toll. _"Leaving a cloud costs a toll. Entering is free."_
4. A feature only A and C support greys out on the shared workload because B lacks it. _"Designed for the weakest link."_
5. Three separate engineer icons, one trained per cloud. _"And the skills, duplicated."_
   **The moment**: Beat 3 — the toll gate charging for every cross-cloud data move, exactly where the "the cloud is infinite" intuition breaks down.
   **Interaction**: Toggle between "accidental" and "deliberate" framing; click the egress toll and watch the coin meter tick.
   **Ending**: Three pipes settled, cost and skill overlays visible as the price of the arrangement.
   **Variants**: `cloud-deployment-models`, `vendor-lock-in`, `data-transfer-costs`.
   **Techniques**: boundary, token, meter, spotlight, toggle, caption.
   **Review**: Improved — egress is charged on leaving a provider, entering is free (was "each way"); "most" softened to "much" multi-cloud being accidental.

### Vendor lock-in and portability (`vendor-lock-in`)

**The aha**: Lock-in is a dial, not a yes or no: every higher-level managed service saves work today and raises the switching cost tomorrow.
**Misconception to defeat**: That lock-in is something you either have or avoid entirely, rather than a trade made one service at a time.
**Cast**: A gauge labelled "Lock-in", Low to High. A workload tile built from swappable blocks: portable (open standard, green) or proprietary (provider-specific, amber).
**Opening frame**: Workload built entirely from green blocks, gauge at Low. _"Open standards: easy to leave."_
**Story**:

1. One block is swapped for a proprietary managed queue: the gauge ticks up slightly; a small badge reads "−2 weeks build time". (Swapping in a managed Postgres instead barely moves the gauge: managed is not the same as locked in.) _"Convenient. And it costs a little freedom."_
2. Another block swaps for a proprietary database with a unique API: the gauge ticks further; a thick anchor chain draws from the workload to the provider icon. _"Each layer up raises the exit price."_
3. The whole workload is dragged toward a second provider icon: the chain snaps taut, the proprietary blocks cannot move without a rewrite (red flash, rebuild-cost badge), the portable blocks slide across easily. _"Open layers move. Proprietary ones don't."_
4. The gauge sits near High; a callout singles out the data itself as the heaviest anchor of all.
5. Final caption: "The goal isn't zero lock-in. It's choosing it knowingly."
   **The moment**: Beat 3 — dragging the whole workload and watching only the portable blocks make the crossing while the proprietary ones snap back on their chains.
   **Interaction**: Swap each block between portable and proprietary and watch the gauge and chain weight change; then try the migration drag.
   **Ending**: Rests on a deliberately mixed workload, gauge at a moderate level.
   **Variants**: `cloud-deployment-models`, `multi-cloud`, `data-gravity`, `managed-vs-self-managed`.
   **Techniques**: dial, restyle, token, meter, failure, caption.
   **Review**: Improved — added that managed does not mean locked in (managed Postgres vs a proprietary queue); proprietary blocks need a rewrite rather than "refuse".

### Distributed cloud and edge (`distributed-cloud-edge`)

**The aha**: You can take the cloud to where the data or the latency budget is, and still run it with the same APIs, tools and bill as a region.
**Misconception to defeat**: Confusing this with edge locations, which only cache and route — they don't run your compute.
**Cast**: The shared world map's region cluster, plus small outposts elsewhere — a factory, a hospital, a ship — each holding a tiny rack with the same cloud branding as the region. One unified control panel lists everything.
**Opening frame**: The main region cluster on the map, calm, listed in the control panel. _"The cloud, in its regions."_
**Story**:

1. A factory far from any region needs millisecond latency for a robot-arm control loop: a tiny rack appears on the factory floor, same branding as the region. _"The cloud, shipped to the factory floor."_
2. The control panel lists the factory rack right alongside regional resources — one login, one bill line — with a thin tether to its parent region, where its control plane lives. _"Same APIs, same tools, same bill."_
3. Sensor data loops locally inside the factory rack instead of travelling to the distant region; the latency meter stays tiny. _"Processed where the data is born."_
4. A hospital (data residency) and a ship (no reliable connectivity) each get their own small outpost, each still listed in the one control panel. _"Wherever the data or the latency budget needs it."_
5. A contrast inset lights up a plain edge-location dot on the map: "Not this — that's caching, not compute."
   **The moment**: Beat 2 — the single control panel listing a factory-floor rack right next to a region, making "same APIs" literal rather than a claim.
   **Interaction**: Click each outpost to see why it exists there; toggle the edge-location contrast on and off.
   **Ending**: The control panel shows the region plus three outposts, one unified list.
   **Variants**: `cloud-deployment-models`, `regions-and-zones`, `edge-locations-and-pops`, `data-residency-and-sovereignty`.
   **Techniques**: boundary, contents, token, zoom, spotlight, toggle, caption.

## 4. Global infrastructure

**Review**: Improved — outposts shown tethered to a parent region where the control plane lives.

### Regions and availability zones (`regions-and-zones`)

**The aha**: Zones fail independently (separate power, cooling and network), so spreading across them survives a data-centre failure cheaply; spreading across regions survives a regional disaster but adds distance, cost and consistency problems.
**Misconception to defeat**: That a region is one data centre, or that any redundancy is equally cheap.
**Cast**: The shared world map. One region is a rounded cluster holding three zone buildings; a second region sits far away on the map. A latency ruler can be drawn between them. A workload tile starts inside a single zone.
**Opening frame**: One region cluster, three zone buildings, all calm. The workload tile sits only in Zone 1. _"One region, three zones."_
**Story**:

1. Zone 1 flashes red (a power failure); the workload tile inside greys out completely. _"One zone, one point of failure."_
2. Rewind: the workload is cloned into Zones 2 and 3 as well, all inside the same region, linked by a short low-latency loop (about 1–2 ms). Zone 1 fails again; the other two copies keep serving without a noticeable blip. _"Zones fail independently. Spread across them, survive losing one, for a small latency and cross-zone traffic cost."_
3. The whole region cluster flashes red; all three zone copies grey out together. _"Lose the region, lose everything in it."_
4. Rewind again: a fourth copy is added in the distant second region. The latency ruler shows real distance ("+40 ms") and a caption notes writes must now reach both. Region A fails entirely; Region B's copy keeps going. _"A second region survives a regional disaster, at distance, cost and consistency's price."_
   **The moment**: Beat 2 against beat 3 — the zone-spread resilience that just worked completely fails the instant the whole region goes, motivating why a second region is ever needed.
   **Interaction**: Choose a deployment (one zone, three zones, two regions) and a failure (zone, region) and watch what survives, plus the latency ruler's reading.
   **Ending**: Settles on three zones within one region as the default sensible state.
   **Variants**: `zonal-regional-global-resources`, `edge-locations-and-pops`, `choosing-a-region`, data's `storage-redundancy-levels`.
   **Techniques**: boundary, clone, failure, choice, meter, caption.
   **Review**: Improved — fixed "sub-millisecond" (about 1–2 ms) and "almost no cost" (cross-zone traffic is billed).

### Edge locations and points of presence (`edge-locations-and-pops`)

**The aha**: Users connect to the nearest edge, not to the region; content can be served from there, and the rest of the trip rides the provider's private backbone instead of the public internet. You don't deploy VMs to an edge location.
**Misconception to defeat**: Thinking edge locations are small regions you can deploy compute to.
**Cast**: The world map with one distant region cluster and dozens of small dots scattered across cities. A user icon in a city with no nearby region. Two distinct line styles: a squiggly "public internet" line and a clean "private backbone" line.
**Opening frame**: A user icon beside its nearest lit dot, the distant region faint in the corner. _"A dot in every city, a region in a few."_
**Story**:

1. The user requests a cached image: a token takes a short public-internet hop to the nearest dot and is served instantly from a cache there. _"Users connect to the nearest edge, not the region."_
2. A request for something not cached continues past the dot, but now on the clean private-backbone line all the way to the region, skipping the public squiggle entirely. _"From there, the provider's own private backbone, not the open internet."_
3. A VM icon dropped onto the dot bounces off, red. _"No VMs at the edge: caching, DNS, DDoS filtering, small edge functions, a backbone on-ramp."_
4. Zoom out: hundreds of dots against a handful of region clusters. _"Far more numerous than regions."_
   **The moment**: Beat 2 — the visible switch from the squiggly public-internet line to the clean private-backbone line partway through the same request.
   **Interaction**: Click a city to see its nearest edge light up; try dropping a VM on a dot to see it bounce.
   **Ending**: The full request path lit end to end, short public hop then long private backbone.
   **Variants**: `regions-and-zones`, `distributed-cloud-edge`, `zonal-regional-global-resources`.
   **Techniques**: boundary, token, path trace, restyle, failure, spotlight, caption.
   **Review**: Improved — caption no longer says nothing runs at the edge: small edge functions do, VMs do not.

### Zonal, regional and global resources (`zonal-regional-global-resources`)

**The aha**: A resource's scope tells you which failure takes it out and what you must replicate yourself: zonal dies with its zone, regional services are spread across zones by the provider, global ones span regions. Check the exact setting, because some regional-scope services (managed databases) run in one zone until you turn on high availability.
**Misconception to defeat**: Assuming every managed service is already zone-redundant.
**Cast**: The region cluster with its zones, plus a "global" layer floating above the whole map. Three tiles: a VM pinned inside one zone, an object-storage tile spanning all the region's zones, an identity/DNS tile hovering above the entire map.
**Opening frame**: All three tiles calm in place at their natural scope. _"Three resources, three scopes."_
**Story**:

1. Zone 1 fails: the VM tile greys out completely, gone. The storage tile, already replicated by the provider across Zones 2 and 3, keeps a green dot lit there. _"Zonal dies with its zone."_
2. A managed-database tile, regional in name but running in one zone (HA off), greys out with Zone 1; with HA on, a standby in Zone 2 takes over. _"Regional scope isn't always zone-redundant. Check."_
3. The whole region fails: the storage tile, which never left the region, now greys fully. The identity/DNS tile, hovering above the whole map, stays lit, serving requests routed elsewhere. _"Global: rarely fails, but when it does, everywhere feels it at once."_
4. Each tile ends labelled with its scope and what takes it out: zone, region, everywhere. _"Know the scope before the outage does."_
   **The moment**: Beat 1 — the same zone failure, the VM gone instantly, the storage barely blinking, because they sit at different scopes.
   **Interaction**: Pick a resource (zonal, regional, global) and a failure level (zone, region) to see it survive or die.
   **Ending**: All three resources shown with their scope labelled plainly beside them.
   **Variants**: `regions-and-zones`, data's `storage-redundancy-levels`, `composite-sla`.
   **Techniques**: boundary, failure, choice, spotlight, caption.
   **Review**: Improved — regional scope does not guarantee zone redundancy (single-zone managed databases); replaced the vague second-VM beat and the empty caption-only beat.

### Choosing a region (`choosing-a-region`)

**The aha**: Region choice trades latency, law, price and features, and it's sticky because data is slow and costly to move later; distance is physics, at best roughly 1 ms of round trip per 100 km.
**Misconception to defeat**: That the right region is simply the nearest one.
**Cast**: The world map with several candidate region clusters. A business location pinned. A checklist panel: latency, law/residency, price, features, carbon. A ruler converting distance to milliseconds.
**Opening frame**: The business location pinned, three candidate regions highlighted at different distances. _"Which one?"_
**Story**:

1. A ruler stretches to the nearest region: "500 km → ~5 ms"; to a farther one: "8,000 km → ~80 ms". _"Distance is physics: at best ~1 ms round trip per 100 km. Real routes are longer."_
2. The nearest region is crossed out: it lacks a required certification or data law. _"Legal requirements can rule out the nearest region."_
3. The remaining candidates show different price tags for the same service. _"The same service, priced differently by region."_
4. One candidate loses a needed feature (a specific accelerator) and is crossed off too. _"Not every region has everything."_
5. The final pick is made. Later, an attempt to move the now-large data store elsewhere shows a slow, heavy drag with a toll meter ticking. _"Pick well — moving data later is slow and costly."_
   **The moment**: Beat 2 — the nearest, cheapest-looking region crossed out by a legal requirement, defeating "just pick the closest".
   **Interaction**: Adjust weight sliders for latency, law, price and features and watch which region "wins".
   **Ending**: Rests on the chosen region, checklist all green.
   **Variants**: `regions-and-zones`, `data-residency-and-sovereignty`, `data-gravity`, `cloud-cost-drivers`.
   **Techniques**: boundary, meter, dial, failure, spotlight, caption.
   **Review**: Improved — 1 ms per 100 km is a best case, real routes are longer.

### Data residency and sovereignty (`data-residency-and-sovereignty`)

**The aha**: Choosing a region gives residency, not sovereignty — data held in-country can still be reachable by the provider's own staff or a foreign legal order unless keys, operations and support are also under local control.
**Misconception to defeat**: "The data is in our country, so we're sovereign."
**Cast**: A region cluster drawn inside a country's border outline. A data tile inside it. Outside the border, a provider HQ icon in another country, reached by a dashed admin-access line. A "foreign court order" icon that can travel the same line.
**Opening frame**: The data tile inside the border, calm. _"Data residency: it's stored here."_
**Story**:

1. A foreign court-order token reaches the provider's HQ, which is compelled to reach into the region along the dashed admin line, straight through the border wall. _"Residency didn't stop it — the access line stayed open."_
2. A provider support-staff icon abroad reaches the same tile along the same line, legitimately, for support. _"The provider's own staff, wherever they sit, can often still reach it."_
3. A "sovereign cloud" layer is added: the encryption key moves to a local key icon the provider can't read, operations and support staff sit inside the border, and the operator answers to local law. The order still arrives but yields only ciphertext. _"Sovereignty: keys, operations, support and jurisdiction, kept local too."_
4. Two labels sit side by side: "Compliant, data's in-country" (line still open) and "Sovereign" (line cut).
   **The moment**: Beat 1 — the foreign order walking straight through the country border via the line that residency never addressed.
   **Interaction**: Toggle the admin line open or severed and watch whether the foreign order reaches the data.
   **Ending**: Rests on the sovereign configuration, the admin line cut at the border and the key held locally.
   **Variants**: `choosing-a-region`, `shared-responsibility-model`, `regions-and-zones`.
   **Techniques**: boundary, token, path trace, toggle, restyle, caption.

## 5. Compute options

**Review**: Improved — sovereignty is keys, operations, support and jurisdiction; the order still arrives but yields only ciphertext, rather than "bouncing" off a wall.

### Compute options compared (`compute-options-compared`)

**The aha**: It's a spectrum of control against convenience: moving from bare metal toward functions hands over more of the stack, scales faster and finer, and bills closer to actual use, but accepts more constraints.
**Misconception to defeat**: That there's one "best" compute option rather than a fit for each workload.
**Cast**: A spectrum bar — bare metal, VMs, containers on your own VMs, serverless containers, PaaS, functions — with a thin responsibility-stack sliver under each showing its blue/grey split (facility to servers are grey even for bare metal; only the hypervisor layer is absent). Above, two meters: scaling speed, billing granularity. A constraints panel that fills up moving right.
**Opening frame**: Bare metal on the far left, sliver blue from the OS up; functions on the far right, sliver almost entirely grey. _"Same code. Six ways to run it."_
**Story**:

1. Step to VMs: the virtualisation layer turns grey (the provider's hypervisor); the scaling-speed meter shows minutes. _"Provisioned in minutes, not procured in weeks."_
2. Step to containers on your own VMs: the image carries the runtime, starts in seconds, and many share a VM whose OS is still yours. _"Faster, denser, same host to patch."_
3. Step to serverless containers or PaaS: the host OS and runtime grey out; scaling nears its maximum, including to zero; billing is per second of use. _"Hands over more, scales itself."_
4. Step to functions: only "your code" stays blue; scaling is milliseconds; billing reads "per request and per millisecond". _"Pay closest to actual use."_
5. The constraints panel, empty at bare metal, fills with warning chips (cold starts, time limits, less customisation) as the spectrum moves right. _"More convenience, more constraints."_
   **The moment**: Beat 4 — both meters near their maximum at exactly the point the constraints panel is fullest, the trade-off made explicit in one frame.
   **Interaction**: Drag along the spectrum and watch the sliver, the two meters and the constraints panel update together.
   **Ending**: Rests on a caption: "Pick the highest abstraction that fits."
   **Variants**: `iaas-paas-saas`, `virtual-machines`, `containers-as-a-service`, `serverless-computing`.
   **Techniques**: layers, dial, meter, restyle, caption.
   **Review**: Improved — bare metal is not all blue (provider still owns facility to servers), VMs already bill per second, so granularity gains moved to serverless and functions; functions bill per request and duration.

### Virtual machines (`virtual-machines`)

**The aha**: One physical host runs many isolated VMs; you control a whole OS and must patch it, you pay while it runs whether busy or idle, and it boots in minutes rather than the weeks it takes to buy hardware.
**Misconception to defeat**: That a VM is somehow lighter-weight than "a real computer" rather than a full OS you still have to run.
**Cast**: One physical host box with a hypervisor layer, three or four VM tiles on top, each with its own OS icon, vCPU count, memory bar, disk icon and NIC. A boot timer. A coin meter per VM.
**Opening frame**: The host box, hypervisor layer, one VM tile booting. _"A computer, carved from a computer."_
**Story**:

1. The VM boots: a timer counts "90 seconds", then the OS icon lights ready. _"Minutes to boot, not weeks to buy."_
2. Three more VM tiles spin up on the same host, each isolated by the hypervisor beneath. _"One physical host, many isolated VMs."_
3. One VM sits idle overnight; its coin meter ticks at the same rate as when it was busy. _"You pay while it runs, busy or not."_
4. A security patch releases: each VM's OS icon needs updating individually; one is missed and flashes red. _"You own the OS. You patch it, or nobody does."_
5. Zoom into one VM: vCPU, memory, disk and NIC each labelled "yours to configure".
   **The moment**: Beat 3 — the meter ticking identically whether the VM's load graph is flat or spiking, the core "you pay for the box, not the work" idea.
   **Interaction**: Toggle a VM idle or busy and watch the meter (not) change; trigger the patch event and see which VM was missed.
   **Ending**: All VMs patched, green, meters still ticking.
   **Variants**: `instance-types-and-sizes`, `compute-options-compared`, `dedicated-hosts-and-bare-metal`.
   **Techniques**: layers, boundary, timer, meter, failure, zoom, caption.
   **Review**: Keep — the identical meter busy or idle is the right moment; claims correct.

### Instance families and sizes (`instance-types-and-sizes`)

**The aha**: Choose the family for the bottleneck before the size; the wrong family means paying for resources the workload never touches.
**Misconception to defeat**: That bigger is simply better, regardless of what the workload actually needs more of.
**Cast**: A row of family shapes — general purpose, compute-optimised, memory-optimised, storage-optimised, accelerated/GPU, burstable — each with size steps S/M/L/XL that roughly double resources and price. A workload with its own usage profile (CPU-hungry, memory-light) sits above, unassigned.
**Opening frame**: The workload above the row, family shapes waiting. _"A workload, and six shapes to put it in."_
**Story**:

1. Dropped onto memory-optimised: to get enough vCPUs it must take a size loaded with memory; the memory bar sits mostly empty, the CPU bar is pegged red, and the price tag is high. _"Wrong family: paying for memory it never touches."_
2. Dragged instead onto compute-optimised: the same vCPUs with far less memory, the memory bar sensibly full, CPU with headroom, and the price lower. _"Right family first."_
3. Step through sizes S → M → L within compute-optimised: CPU, memory and price roughly double each step; the workload's own usage line is shown against each, picking the smallest size with headroom. _"Then size to the load."_
4. Final side by side: wrong-family-right-size against right-family-right-size, the second cheaper and faster.
   **The moment**: Beat 1 — a workload with its CPU pegged while its memory bar sits almost empty, in a family chosen for the wrong bottleneck.
   **Interaction**: Drag the workload onto different families and watch which resource bottlenecks; step through sizes with a dial.
   **Ending**: The workload settles on the correctly fitted family and size.
   **Variants**: `virtual-machines`, `compute-options-compared`, `rightsizing`.
   **Techniques**: contents, meter, dial, failure, side by side, caption.
   **Review**: Improved — "throttles" became "pegged" (throttling is burstable-only) and the family penalty is shown as memory dragged along with vCPUs.

### Dedicated hosts and bare metal (`dedicated-hosts-and-bare-metal`)

**The aha**: Paying more to step out of the shared pool, usually for per-core licensing, compliance that demands physical isolation, or workloads that need the raw hardware.
**Misconception to defeat**: Confusing a dedicated host with a reservation discount — one sets aside hardware, the other just discounts a price.
**Cast**: The shared pool (one host box, three tenant tiles) on the left. On the right, two alternatives: "Dedicated host" (one host, hypervisor still present, only one tenant, other slots visibly empty and crossed out) and "Bare metal" (a host with no hypervisor layer at all, the tenant directly on hardware).
**Opening frame**: The shared pool with three tenants on the left; the two alternatives empty, waiting, on the right. _"Three ways to get a server."_
**Story**:

1. A licence badge appears on a workload: "$/core, must know physical cores." _"Some licences are counted per physical core — pooling muddies that."_
2. The workload moves to "Dedicated host": only this tenant occupies the host now, other tenant slots visibly empty and crossed out; the hypervisor is still there underneath; the coin meter bills the whole host, used or not. This also satisfies "no other customers on my hardware". _"No other tenants — but still virtualised underneath."_
3. A new need appears (run its own hypervisor, or use raw hardware features): it moves to "Bare metal" and the provider's hypervisor layer disappears entirely, the tenant sitting directly on hardware, a whole machine still billed. _"Bare metal: no provider hypervisor at all."_
4. A "Reserved instance" tile appears beside the dedicated host with a caption: "Not the same as this — that's a billing discount, not hardware set aside."
   **The moment**: Beat 2 — the empty, crossed-out tenant slots inside the dedicated host, visually proving nobody else is in there, unlike the shared pool.
   **Interaction**: Toggle between shared, dedicated and bare metal, and watch the hypervisor's presence and the cost meter change.
   **Ending**: Rests on the pool-to-dedicated-to-bare-metal row, cost meters rising left to right.
   **Variants**: `resource-pooling-and-multi-tenancy`, `byol-vs-license-included`, `commitment-discounts`, `virtual-machines`.
   **Techniques**: boundary, contents, restyle, meter, toggle, caption.

## 6. Resource organisation and governance

**Review**: Improved — bare metal motivated by own hypervisor or raw hardware (a dedicated host already satisfies no-shared-hardware); both bill the whole machine.

### Resource hierarchy (`resource-hierarchy`)

**The aha**: Access, policies and budgets set high in the tree are inherited by everything beneath, so the tree's shape is your governance design.
**Misconception to defeat**: That hierarchy is just folders for tidiness, with no effect on what actually happens to the resources inside.
**Cast**: Nested frames: Organisation outermost, two Account/Subscription frames inside it, a couple of Group frames inside each, resource tiles inside those (AWS has no group level: accounts hold resources directly; Azure adds resource groups, Google folders and projects). A policy or budget badge that can be pinned at any frame and visibly drips down to everything nested below it.
**Opening frame**: The full nested tree, calm, resource tiles plain. _"A tree, four levels deep."_
**Story**:

1. A "required tag" policy is pinned at the Organisation frame: it trickles down through every Account, Group and resource tile beneath it, each picking up a small tag icon. _"Pin it at the top, it reaches everything."_
2. The same policy pinned instead on just one Account: only resources inside that account and its groups pick up the tag; the sibling account's resources stay plain. _"Pin it lower, it reaches less."_
3. A budget meter pinned at a Group frame sums only the resources nested inside that group, ignoring siblings. _"Budgets follow the nesting too."_
4. A resource tile (or, in AWS, a whole account) is dragged from one Group frame into another; its inherited policies and budget instantly swap to match its new parent. _"Move something, and its rules move with it."_
5. Zoom out on the whole tree with several policies pinned at different levels, each one's reach shown as a tinted region cascading downward, overlapping where more than one applies.
   **The moment**: Beat 4 — dragging a single resource tile into a different frame and watching its rules change instantly, with no other action taken.
   **Interaction**: Pin a policy badge at any level and watch which resources light up; drag resources between frames.
   **Ending**: A settled tree, each level showing which policies and budgets apply, tints cascading cleanly downward.
   **Variants**: `multi-account-strategy`, `policy-guardrails`, `tagging-and-labels`, `landing-zone`.
   **Techniques**: boundary, contents, move, spotlight, meter, caption.
   **Review**: Improved — noted that AWS has no group level and moves accounts, not resources.

### Accounts as boundaries (multi-account strategy) (`multi-account-strategy`)

**The aha**: The account is the strongest wall the cloud gives you — it bounds blast radius, permissions, quotas and the bill. In one shared account, one mistake or one leaked key can reach everything.
**Misconception to defeat**: That resource groups or folders are enough of a boundary on their own.
**Cast**: One large Account frame holding Dev, Test and Prod resource tiles mixed together with no inner wall; beside it, three separate Account frames, each a thick wall. A "payer" account above with billing arrows converging into it.
**Opening frame**: One shared Account frame, Dev/Test/Prod tiles all inside, no inner wall. _"One wall, around everything."_
**Story**:

1. A leaked API key token appears among the Dev tiles and crawls freely across to Test and then Prod, red flashes spreading, nothing stopping it. _"One mistake, and it can reach anything inside the wall."_
2. Rewind: the shared account splits into three separate walled Accounts — Dev, Test, Prod — each with its own quota meter and permission set. _"Split by workload, environment or team."_
3. The same leaked key, dropped in Dev, hits the Dev account's wall immediately; it cannot cross into Test or Prod, except through a deliberate door (a cross-account role). _"The account is the strongest wall the cloud gives you."_
4. The three accounts' billing arrows converge into one payer account above, a single consolidated coin meter. _"Many accounts, one bill."_
5. A "vending machine" icon stamps out a brand-new, pre-walled account automatically when a team asks for one. _"Handed out by an automated process, not hand-built each time."_
   **The moment**: Beat 1 against beat 3 — the identical leaked key, unstoppable in the shared account, stopped cold the instant real walls exist.
   **Interaction**: Drop the leaked-key token into different account layouts and watch it spread or get contained.
   **Ending**: Rests on three separate walled accounts, the token contained in one, billing consolidated above.
   **Variants**: `resource-hierarchy`, `landing-zone`, `policy-guardrails`.
   **Techniques**: boundary, token, failure, meter, toggle, spotlight, caption.
   **Review**: Improved — the wall has deliberate doors (cross-account roles), so "cannot cross" is no longer absolute.

### Tags and labels (`tagging-and-labels`)

**The aha**: Tags are how a bill line becomes "team X's product Y in production"; without consistent, enforced tags, a large share of spend has no owner.
**Misconception to defeat**: That tagging can be cleaned up later, once it matters.
**Cast**: A pile of resource tiles, some carrying coloured tag chips (owner, cost centre, environment, application), many bare and grey with a question mark. A monthly bill below, broken into slices.
**Opening frame**: A mixed pile, half tagged, half bare. _"Some tagged, some not."_
**Story**:

1. The bill renders: tagged resources slot neatly into named slices ("Team Payments: $400", "Team Search: $220"); untagged resources pile into one grey "Unknown: $1,900" slice, bigger than any named one (misspelt tags like "payments" and "Payments " split into extra slices). _"No tag, no owner on the bill."_
2. A "require tags on creation" policy is pinned above the pile (the same drip mechanic as the resource hierarchy): a new tile without the required tags bounces at creation (or inherits them from its parent), so new tiles always carry chips; old bare ones stay grey. _"Enforce it at creation..."_
3. An attempt to tag everything retroactively shows an engineer icon clicking through hundreds of bare tiles, a long timer running, many still missed. _"...because tagging afterwards never finishes."_
4. Over several months the "Unknown" slice shrinks as creation-time tagging takes hold, leaving only a small residual sliver from old resources.
   **The moment**: Beat 1 — the oversized grey "Unknown" slice dwarfing the neat named slices, making invisible ownership visible for the first time.
   **Interaction**: Tag or untag a resource and watch the bill slices resize live; toggle the creation-time policy on and off.
   **Ending**: The bill is mostly named slices, with a tiny residual "Unknown" sliver.
   **Variants**: `resource-hierarchy`, `cost-allocation`, `policy-guardrails`.
   **Techniques**: contents, meter, restyle, timer, spotlight, caption.
   **Review**: Improved — a require-tags policy denies untagged creation (or inherits), it does not invent tags; added inconsistent-spelling slices.

### Policies and guardrails (`policy-guardrails`)

**The aha**: Guardrails let teams self-serve safely — the platform makes the wrong thing impossible or visible instead of a ticket queue approving every change, and preventive guardrails bind even account administrators.
**Misconception to defeat**: That guardrails are the same as permissions, or that an administrator is exempt from them.
**Cast**: A policy badge ("no public storage") pinned at the Organisation frame. Two lanes: Prevent (deny) and Detect (audit/flag). A ticket-queue lane off to the side for contrast.
**Opening frame**: The policy badge pinned, calm. _"A rule, set once, at the top."_
**Story**:

1. An engineer tries to create a storage resource with public access on: the action bounces immediately at the badge, red flash, "denied". _"Prevent: the wrong thing is impossible."_
2. A different policy, set to Detect: the same public resource is created, but instantly flagged and shown on an audit dashboard. _"Detect: the wrong thing is visible, not blocked."_
3. A remediation automation reaches in and flips the flagged resource's setting back to private; the flag clears. _"Fix: or just correct it automatically."_
4. An account administrator tries the same forbidden action and bounces off exactly the same wall, no exception; the only way through is changing the rule at the level above. _"Preventive guardrails bind even account administrators."_
5. Beside it, a ticket-queue lane shows a request waiting on a human approver with a long timer, contrasted against the instant guardrail check. _"Self-serve safely, without the queue."_
   **The moment**: Beat 4 — the administrator's own attempt bouncing off the same wall as anyone else's, the detail people don't expect.
   **Interaction**: Toggle a policy between Prevent, Detect and Remediate, and try the forbidden action as a regular user and then as an admin.
   **Ending**: The organisation frame shown with several policy badges pinned, requests either clean or quickly flagged.
   **Variants**: `resource-hierarchy`, `multi-account-strategy`, `landing-zone`.
   **Techniques**: boundary, failure, restyle, timer, toggle, caption.
   **Review**: Improved — binds account administrators; only the level above can change the rule.

### Landing zone (`landing-zone`)

**The aha**: A landing zone is the foundations laid once by a platform team, so every new workload lands somewhere already secure, connected, monitored and billed correctly.
**Misconception to defeat**: That a landing zone is just one well-configured account, rather than a repeatable foundation underneath many.
**Cast**: The nested-frame hierarchy plus shared foundations drawn once at the Organisation level: an identity provider icon, a shared network hub, a central logging funnel, a security tooling badge, policy badges, and an automated "vending" conveyor that stamps out new pre-wired Account frames.
**Opening frame**: The Organisation frame with its foundations already built but no workload accounts yet; the vending conveyor idle. _"The foundations, laid first."_
**Story**:

1. A new team requests a workspace: the conveyor stamps out a fresh Account frame, already connected to the identity provider, the network hub and the logging funnel, policy badges immediately tinting it. _"A new account, already connected, already governed."_
2. The team drops their first resource tile into the pre-wired account: it's instantly tagged, instantly logged (a token flows to the logging funnel), instantly covered by policy. _"It lands somewhere already secure, connected, monitored, billed."_
3. Contrast: without a landing zone, a team starts from a bare Account frame and has to wire identity, network, logging and policy by hand, a long checklist with a long timer, one step skipped and a security gap flashing. _"Without it, every team reinvents the foundations, and some skip a step."_
4. Several more teams go through the vending conveyor in quick succession, each landing cleanly and consistently.
   **The moment**: Beat 3 against beats 1–2 — the long, error-prone manual checklist contrasted directly against the instant, clean, vended result.
   **Interaction**: Click "vend new account" repeatedly for a consistent, instant setup; toggle to the "no landing zone" path to watch the manual checklist run instead.
   **Ending**: Rests on several pre-wired accounts hanging neatly off the shared foundations.
   **Variants**: `resource-hierarchy`, `multi-account-strategy`, `policy-guardrails`, `cloud-adoption-framework`.
   **Techniques**: boundary, contents, token, clone, move, failure, timer, side by side, caption.
   **Review**: Keep — the vended-versus-manual contrast is the right moment; claims correct.

### Quotas and service limits (`quotas-and-limits`)

**The aha**: The cloud feels infinite, but every account has ceilings; a quota is permission, not reserved capacity, and an unraised quota can block a scale-out or a failover at the worst moment.
**Misconception to defeat**: That a quota guarantees you the capacity, or that the cloud has no ceilings at all.
**Cast**: An Account frame with a resource type (say, vCPUs) and a quota gauge beside it: "Used: 40 / Limit: 50", a ceiling line drawn above current usage. The shared demand line pushes capacity up against it.
**Opening frame**: Usage comfortably under the ceiling, calm. _"Room to grow, for now."_
**Story**:

1. Demand rises; the account scales capacity to match, usage climbing toward the ceiling. _"The cloud feels infinite..."_
2. Usage hits exactly 50: further scale-out requests bounce, red, right as demand keeps climbing past what capacity can follow. _"...until an account hits its ceiling."_
3. A support ticket requests an increase to 200; a timer runs hours to days before the ceiling line finally moves up. _"Soft limits can be raised, but not instantly."_
4. A different resource shows a ceiling that cannot move at all, however many tickets are raised, its increase button crossed out. _"Hard limits can't be raised at all."_
5. A "reserved capacity" tile is added: it guarantees machines exist for you, yet still ticks the quota gauge up. _"A quota is permission, not capacity. A reservation is the guarantee. You need both."_
6. A regional failover tries to spin up replacement capacity in a backup region, but that region's quota is still at its small default (quotas are per region), and the failover stalls mid-crisis. _"An unraised quota can block a failover at the worst moment."_
**The moment**: Beat 6 — the failover stalling specifically because nobody pre-raised the quota in the backup region, the quiet trap the concept warns about.
**Interaction**: Push the demand dial up against the ceiling and watch requests bounce; try raising a soft limit versus a hard one.
**Ending**: The ceiling raised ahead of time in both regions, the failover succeeding cleanly next time.
**Variants**: `resource-hierarchy`, `multi-account-strategy`, `commitment-discounts`, `budgets-and-anomaly-alerts`.
**Techniques**: boundary, meter, failure, timer, dial, spotlight, caption.
</content>

</invoke>
**Review**: Improved — a capacity reservation still counts against the quota (was shown as exempt); quotas are per region.
