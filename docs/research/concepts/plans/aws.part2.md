# AWS plans, part 2

Stage 2 plans for `catalog/aws.md` groups 6 to 9, in catalog order. They use AWS's shared visual
language: real service icons and names; AWS's nesting drawn as nested frames (region › VPC ›
Availability Zone › subnet); a request as a dot travelling along an arrow; Lambda concurrency as a
row of execution-environment boxes that light up per request, cold ones showing a start-up timer;
a DynamoDB table as separate small cylinders (partitions), each labelled by key and carrying a
capacity bar; S3 storage classes as shelves at growing distance from the desk (Standard near,
Glacier Deep Archive far), each far shelf with a retrieval timer; an "X vs Y" comparison sending
the same traffic or task through each option side by side; a "which service do I use" choice as a
short question path whose answers light the matching service; cost as a coin meter or coin counter.

## EC2 and Auto Scaling

### EC2 instance families and naming (`aws-ec2-instance-types`)

**The aha**: An instance type's code names the bottleneck you're buying for (CPU, memory, disk,
network or accelerator), not a generic "bigger or smaller".
**Misconception to defeat**: Sizing by sticker price or familiarity instead of matching the family
letter to the actual bottleneck.
**Cast**: A card "m7g.xlarge" at top, breaking into labelled chips: family, generation, options,
size. Four gauges beside it: CPU, Memory, Disk, Network.
**Opening frame**: The bare string "m7g.xlarge", inert.
**Story**:

1. The string splits into chips as each part is circled: m = general purpose, 7 = generation,
   g = Graviton (Arm), xlarge = size. _"Letters, not just a size."_
2. A workload appears, "video transcoding, CPU-bound": the CPU gauge pulses and a c7g.2xlarge
   card slides in, family letter swapped to c. _"Compute-optimised."_
3. Another workload, "in-memory cache, RAM-hungry": swaps to r7g.2xlarge; the memory gauge towers
   over CPU. _"Memory-optimised."_
4. A t3.micro runs a bursty site: a CPU-credit meter drains as load spikes. A toggle shows the two
   credit modes: Standard, where the instance visibly slows to its baseline once credits hit zero,
   and Unlimited (the default for t3), where it keeps going and a surplus-credit charge appears on
   the bill. _"t-family runs on borrowed CPU: throttled or billed once the credits are spent."_
5. m6g.xlarge and m7g.xlarge sit side by side, the same price band: the newer generation scores
   visibly higher. _"Newer generation, same family: more work per dollar."_
   **The moment**: Beat 4, the credit meter hitting zero and the instance either slowing or the bill
   climbing — the surprise sizing-by-price misses.
   **Interaction**: Pick a workload by bottleneck and watch the matching family light up; drag a
   generation slider and watch price and performance move together.
   **Ending**: Rests on the four gauges, the chosen family lit, the credit trap called out.
   **Variants**: `aws-auto-scaling-groups`, `aws-ec2-placement-groups`; Savings Plans instance
   families.
   **Techniques**: contents, restyle, meter, token, side by side, toggle, dial, caption.
   **Review**: Improved — beat 4 claimed t3 simply throttles, but t3 defaults to Unlimited mode (it
   bursts and bills surplus credits; only Standard mode, and t2, throttle), so the beat now toggles
   both; beat 5 said the newer generation "costs less", but m7g lists slightly above m6g, so it now
   claims better performance per dollar. Weighed a "restaurant menu" framing for the family letters;
   the four bottleneck gauges are more direct. Checked: m/c/r letters, g = Graviton, Nitro
   generations.

### Placement groups (`aws-ec2-placement-groups`)

**The aha**: A placement group trades blast radius for network speed: cluster packs instances
together for speed, spread keeps them apart for isolation, partition gives rack-awareness to
distributed systems.
**Misconception to defeat**: That a placement group is about Availability Zones, not about physical
racks inside one.
**Cast**: Three panels, Cluster / Spread / Partition, each one AZ containing a faint grid of racks.
Instances are small boxes dropped onto racks.
**Opening frame**: Three empty AZ panels, rack grid lines faint.
**Story**:

1. Cluster: five instances drop onto neighbouring racks in one tight network segment; a thick,
   short cable lights between them, "lowest latency, highest per-flow throughput". _"Packed close
   for speed."_
2. The shared hardware in the cluster panel fails (red flash); all five instances grey out
   together. _"...and share the risk."_
3. Spread: five instances drop, each forced onto a different rack (max 7 per AZ). One rack fails;
   only one instance greys, the other four stay lit. _"One per rack, isolated."_
4. Partition: racks grouped into P1, P2, P3, each holding several instances under a
   Kafka/HDFS-style workload. One partition's racks fail together; the others keep running.
   _"Whole groups fail together, by design, so the app can route around a lost one."_
   **The moment**: The same rack failure, run three times side by side, with wildly different blast
   radii — five down, one down, one partition down.
   **Interaction**: Choose a strategy, then fail a rack and watch how many instances go dark.
   **Ending**: Three panels at rest, failure already run, each showing its own blast radius.
   **Variants**: `aws-ec2-instance-types`; `aws-vpc-anatomy` for the AZ nesting.
   **Techniques**: boundary, contents, failure, side by side, spotlight, caption.
   **Review**: Improved — "sub-millisecond" is not a documented promise, so the cluster beat now says
   lowest latency and highest per-flow throughput; the cluster failure is "shared hardware", since
   AWS only says cluster raises correlated-failure risk, not that it is one rack. Kept the
   three-panels-one-failure framing over a table of limits because the blast-radius contrast is the
   whole concept. Checked: spread max 7 running instances per AZ per group, partitions (up to 7 per
   AZ) on separate racks, cluster limited to one AZ, and the misconception (racks, not AZs) is
   defeated by drawing every panel inside a single AZ.

### Auto Scaling groups and launch templates (`aws-auto-scaling-groups`)

**The aha**: An ASG's first job is self-healing — replacing what dies; scaling the count up or
down is the second job.
**Misconception to defeat**: That an ASG is only about handling load, so a quietly lost instance in
an otherwise-healthy fleet gets forgotten.
**Cast**: A boundary "ASG: desired 3, min 2, max 5" spanning two AZ frames, instances stamped from
one launch template card (AMI, type, user data, role). A target group below with health ticks.
**Opening frame**: Three instances running, split across two AZs, desired = 3, all green.
**Story**:

1. One instance in AZ-A fails a health check (red flash, greys); the target group's ELB check is
   switched on in the ASG so it counts, not just the EC2 status check. _"A health check fails..."_
2. The ASG stamps a fresh instance straight into AZ-A from the template; it boots, runs user data,
   joins the target group. _"...and the ASG just replaces it. No one paged."_
3. Traffic thickens on the inbound arrow; a scaling policy fires and the ASG stamps two more,
   desired ticks 3→5 across both AZs. _"Now it scales — the second job."_
4. A new template version appears; an instance refresh replaces instances in small batches,
   never letting healthy capacity drop below a "min healthy 90%" line. _"Rolling, never below the
   line."_
5. Inset: a warm pool of already-initialised, stopped instances; the next spike pulls one from the
   pool and only has to start it, instead of booting and running user data cold. _"A warm pool
   skips the wait."_
   **The moment**: Beat 1→2, the replacement appearing in the same breath as the failure — before any
   scaling conversation starts.
   **Interaction**: Kill an instance and watch replacement; drag desired capacity and watch AZ
   balance; toggle a lifecycle hook to pause termination for draining.
   **Ending**: Fleet back at desired, evenly spread, all green.
   **Variants**: `aws-asg-scaling-policies`, `aws-ecs-anatomy` (same reconciler idea for tasks).
   **Techniques**: boundary, contents, clone, failure, restyle, token, caption.
   **Review**: Improved — beat 4 said old instances terminate "only after new is healthy"; by default
   instance refresh terminates then launches, governed by min healthy percentage (launch-before-
   terminate is opt-in), so it now draws the min-healthy line; beat 1 now makes clear that ELB health
   checks must be switched on or only EC2 status checks count (the usual reason a broken app is never
   replaced); the warm pool is "initialised, then stopped", not merely "booted". Weighed a
   thermostat-style framing for the self-healing; the instant same-AZ replacement is sharper.
   Checked: desired 3→5 across two AZs balances 3/2, launch templates hold AMI/type/user data/role.

### EC2 Auto Scaling policies (`aws-asg-scaling-policies`)

**The aha**: Target tracking is a thermostat holding one metric steady; the other policy types
exist for what a thermostat handles badly — asymmetric breaches, a schedule you already know, or a
spike you can see coming from history.
**Misconception to defeat**: That every policy reacts the same way, or that scaling in is as fast
as scaling out.
**Cast**: An ASG box with an instance-count bar. Four lanes: Target tracking (a dial at "CPU 50%"),
Step scaling (a staircase of alarm bands), Scheduled (a calendar with a pinned time), Predictive (a
forecast curve ahead of the actual-load line).
**Opening frame**: Four lanes idle, instance count flat at 3.
**Story**:

1. Target tracking: CPU climbs past 50%; capacity is added in proportion to the overshoot, nudging
   CPU back down, like a thermostat. _"Holds one number steady."_
2. Step scaling: CPU crosses three bands, lightly over, way over, critical; each adds a bigger
   jump at once. _"Bigger breach, bigger jump."_
3. Scheduled: the calendar hits "9am Mon–Fri"; capacity jumps before any metric moves. _"Acts on
   the clock."_
4. Predictive: a forecast built from last week rises ahead of the solid actual-load line; capacity
   is already up before load arrives. _"Acts on history, ahead of the spike."_
5. Load falls back. Target tracking releases capacity cautiously (scale-in arrows shallower than
   scale-out, a cooldown timer beside them); the step policy drops only as far as its own scale-in
   bands say. _"Target tracking scales in deliberately slower, so a dip doesn't yo-yo the fleet;
   step policies scale in only as you wrote them."_
   **The moment**: Beat 5, the asymmetric slopes — steep out, shallow in — on the same chart.
   **Interaction**: Dial the metric for target tracking; feed the same load spike to each policy and
   compare how fast and how far it reacts.
   **Ending**: Four lanes at rest with different final heights for the same spike.
   **Variants**: `aws-auto-scaling-groups`; Application Auto Scaling for ECS/DynamoDB;
   `aws-lambda-concurrency` as a different mechanism with the same intent.
   **Techniques**: dial, meter, chart, timer, side by side, caption.
   **Review**: Improved — beat 5 implied all four policies scale in slowly; only target tracking is
   built to be conservative on the way down (step policies do what you configure), so the beat now
   separates them; target tracking in beat 1 sizes proportionally rather than "small steps". Weighed
   a fifth "simple scaling" lane; it is legacy and would add noise. Checked: predictive scaling
   forecasts from history (needs about a day of data, looks up to 14 days back, forecasts ahead),
   scheduled acts by clock, step bands map to step sizes, warmup and cooldown prevent thrash.

## Choosing compute; containers and serverless

### Choosing AWS compute (`aws-compute-service-choice`)

**The aha**: It's a single dial from full control to full abstraction, EC2 at one end, Lambda at
the other, and most real systems sit at several points on it at once, not one.
**Misconception to defeat**: That there's one right answer, or that more managed always wins
because it's less work.
**Cast**: A horizontal ladder, most control (left) to least (right): EC2 — Lightsail — Elastic
Beanstalk — ECS/EKS (on EC2 or Fargate) — Lambda — Batch. Under each rung, two meters: "ops burden"
and "limits accepted".
**Opening frame**: The ladder flat, EC2 lit at far left, _"you patch the OS."_
**Story**:

1. Spotlight slides to Lightsail: ops burden drops a notch, control drops with it — fixed-price,
   fixed-shape servers. _"Less to manage, less you can change."_
2. Elastic Beanstalk: a managed platform wraps EC2 (toggle: or EKS in Cluster Mode); deploys and
   scaling are handled. _"A platform on top, not instead of."_
3. ECS/EKS: a container boundary replaces the instance boundary; ops burden splits into
   "orchestrator" and "capacity" sub-meters.
4. Lambda: instances disappear; a "15 min" limit chip appears, ops burden bottoms out; a note shows
   Managed Instances sharing one warm environment across several requests for steady load. A
   2-hour job dropped on Lambda bounces off the chip. _"Least to run, most limits."_
5. Batch sits off to the side, borrowing capacity from EC2 or Fargate but queuing and sizing jobs
   for you; the bounced 2-hour job lands here. _"Borrows from either end."_
6. Zoom out: one real architecture lights several rungs at once — a web tier on ECS/Fargate, a
   nightly job on Batch, a webhook on Lambda. _"Most systems live at more than one point."_
   **The moment**: Beat 6, one system lighting several rungs at once — the ladder isn't a single
   choice.
   **Interaction**: Drag the spotlight along the ladder, reading the two meters at each stop; toggle
   Beanstalk between EC2 and EKS Cluster Mode.
   **Ending**: The zoomed-out architecture, several rungs lit, labelled by what runs where.
   **Variants**: `aws-container-service-choice`, `aws-lambda-execution-and-cold-starts`.
   **Techniques**: dial, spotlight, meter, boundary, caption.
   **Review**: Improved — "more managed always wins" was named but never defeated: beat 4 now has a
   long job bouncing off Lambda's 15-minute limit and beat 5 lands it on Batch, so the limit meter
   visibly costs something; the legacy App Runner stays off the ladder per the October 2026 catalog.
   Weighed a decision-tree framing; the control-to-abstraction ladder plus the multi-rung ending is
   truer to "most systems use several". Checked: Lambda 15-minute cap, Beanstalk on EC2 or EKS
   Cluster Mode, Batch runs on EC2/Fargate, Managed Instances' multi-request environments.

### ECS vs EKS, EC2 vs Fargate (`aws-container-service-choice`)

**The aha**: Two independent dials, not one choice: who schedules the containers (ECS or EKS) and
where they physically run (EC2 you manage, or Fargate with no visible nodes) — four real
combinations.
**Misconception to defeat**: Treating orchestrator and capacity as one axis, or assuming Fargate is
just "serverless ECS".
**Cast**: A 2×2 grid, rows ECS/EKS, columns EC2/Fargate. Each cell holds a running task or pod;
EC2 columns show a node box beneath it, Fargate columns show the task floating with no node drawn.
**Opening frame**: The empty grid, axes "Orchestrator ↕" and "Capacity ↔".
**Story**:

1. ECS+EC2 fills: a task lands on a visible, SSH-able EC2 instance. _"AWS-native scheduler,
   instances you manage."_
2. ECS+Fargate fills: the same task appears with a ghost outline where the node would be.
   _"Same scheduler, no nodes to patch."_
3. EKS+EC2 fills: a pod lands on a node group running full Kubernetes; a DaemonSet icon sits on the
   node, only possible here. _"Portable Kubernetes — DaemonSets and GPUs need a real node."_
4. EKS+Fargate fills: a pod floats with no node; the DaemonSet icon from beat 3 is crossed out.
   _"Kubernetes API, no nodes — but no DaemonSets, no GPUs."_
5. A middle column slides in between EC2 and Fargate: ECS Managed Instances (ECS row) and EKS Auto
   Mode (EKS row). Real EC2 nodes are drawn, but AWS patches and replaces them; the GPU and
   DaemonSet icons return. _"Nodes AWS runs for you: the middle setting."_
6. A cost-per-vCPU meter ticks up as the spotlight moves EC2→Fargate in either row. _"No nodes
   costs more per vCPU."_
   **The moment**: Beat 4's crossed-out DaemonSet — the concrete thing Fargate's abstraction actually
   removes.
   **Interaction**: Click a cell to see what you can and can't do there; drag workload size and watch
   EC2-vs-Fargate cost lines cross.
   **Ending**: The full grid, all four cells lit, each with its one-line trade-off.
   **Variants**: `aws-compute-service-choice`, `aws-ecs-anatomy`, `aws-eks-on-aws`.
   **Techniques**: side by side, contents, boundary, meter, spotlight, caption.
   **Review**: Improved — the capacity axis had only two settings, but the catalog's current answer
   has three (you-managed EC2, AWS-managed EC2 via ECS Managed Instances / EKS Auto Mode, Fargate);
   beat 5 adds the middle column, which also sharpens the Fargate lesson (the lost DaemonSets and
   GPUs are about Fargate, not about "managed"). Weighed a decision tree; two orthogonal axes defeat
   "orchestrator = capacity" better. Checked: Fargate has no GPUs and no DaemonSets; EKS-on-Fargate
   and ECS-on-Fargate both exist, which defeats "Fargate is serverless ECS".

### ECS clusters, task definitions, tasks and services (`aws-ecs-anatomy`)

**The aha**: The service is a reconciler watching a target number of running tasks, stamped from
one task-definition blueprint, and it keeps nudging reality back to that number across AZs.
**Misconception to defeat**: Confusing the task definition (the blueprint) with a task (one running
copy), or expecting ECS to map one-for-one onto a Kubernetes Deployment and Pod.
**Cast**: A task-definition card (image, CPU/memory, ports, roles, logging) at top. Below, an
outer "cluster" frame (a logical grouping, with no machines of its own) holding a
"service: desired 3" boundary over two AZ frames, each with tasks stamped from the card, each
wearing its own ENI/security-group tag (awsvpc networking). A load balancer with a target group
beneath.
**Opening frame**: Service at "desired 3", three tasks running, evenly spread, all healthy.
**Story**:

1. The card is stamped three times into running tasks, each with its own IP badge, distinct from
   the host. _"Each task gets its own network identity."_
2. One task in AZ-A crashes and disappears; the service notices the drop and immediately stamps a
   replacement into AZ-A. _"A reconciler: it just restores the count."_
3. A new task-definition revision (v2) appears; a rolling deployment brings up one v2 task,
   registers it healthy, drains and removes one v1 task, cycling through all three. _"Rolling
   deploy — or built-in blue/green, swapping the target group at once."_
4. Zoom into the capacity layer underneath: a capacity-provider chip switches between EC2, Fargate,
   Fargate Spot and Managed Instances; tasks land the same way regardless. _"Where they run is a
   separate knob."_
5. A Kubernetes overlay toggles on: task definition ≈ pod spec, task ≈ pod, service ≈ Deployment
   plus Service; the task definition card shows v1, v2 as immutable numbered revisions. _"Close
   cousins, not twins."_
   **The moment**: Beat 2, the replacement appearing within the same breath as the crash — the
   service never "decided" to scale, it closed a gap.
   **Interaction**: Kill a task and watch replacement; step through a deployment one task at a time;
   switch the capacity provider and watch tasks land on a different substrate.
   **Ending**: Service back at desired, v2 everywhere, all healthy.
   **Variants**: `aws-container-service-choice`, `aws-auto-scaling-groups`, `aws-eks-on-aws`.
   **Techniques**: contents, clone, failure, restyle, boundary, toggle, caption.
   **Review**: Improved — the title promised "clusters" but the cast never drew one, so there is now
   a cluster frame that owns no machines; the Kubernetes confusion was named but never shown, so a
   toggled overlay (beat 5) maps the names and shows revisions are immutable. Weighed opening on the
   blueprint-versus-copy pair alone; opening on a healthy service keeps the reconciler as the star.
   Checked: built-in blue/green (2025), rolling deploys start new before draining old, awsvpc gives
   each task an ENI and security group, capacity providers include Managed Instances.

### What EKS adds to Kubernetes (`aws-eks-on-aws`)

**The aha**: EKS runs the control plane for you across AZs, but every pod becomes a real citizen of
your VPC, eating a subnet IP, and IAM — not a kubeconfig alone — is the front door to the API
server.
**Misconception to defeat**: Thinking pods are invisible to VPC tooling, or that EKS removes
upgrade responsibility.
**Cast**: A region frame with a dim "EKS control plane" band across AZs (managed, greyed inside).
Below, a VPC frame with subnets, each with a ticking-down free-IP count. A data-plane selector:
Managed node groups / Self-managed / Karpenter / Fargate / Auto Mode. An IAM badge gates the API
server door.
**Opening frame**: The control-plane band quiet above a VPC with plenty of free subnet IPs.
**Story**:

1. A request hits the API server door; an IAM badge (access entry) is checked before kubectl is
   allowed through. _"IAM is the front door, before RBAC even applies."_
2. A pod schedules onto a node; the VPC CNI hands it a real subnet IP (a tick disappears from the
   counter), visible to flow logs; a toggle ("security groups for pods") gives it a security group
   of its own instead of the node's. _"Pods are VPC citizens — they consume real IPs."_
3. Dozens more pods schedule fast; the free-IP counter races to zero and new pods stall, "no IPs
   available". _"Undersized subnets starve scheduling, not CPU."_
4. Toggle data plane to Fargate: nodes disappear, pods float; toggle to Karpenter: nodes appear and
   vanish sized exactly to pending pods. _"You still choose where pods actually run."_
5. A version banner ticks forward on a fixed calendar: 14 months of standard support, then 12 of
   paid extended support, then an automatic upgrade; "upgrade due" flags the control-plane band
   and the node layer beneath it. _"Managed control plane. Non-optional calendar."_
   **The moment**: Beat 3, pods stalling on IP exhaustion while CPU and memory sit calm — the opposite
   of what people expect to run out first.
   **Interaction**: Dial subnet size (or prefix delegation) and watch pods-before-stall; switch
   data-plane modes and watch the node layer appear and disappear.
   **Ending**: Healthy pods, full IP counters, next upgrade date pinned.
   **Variants**: `aws-container-service-choice`, `aws-eks-pod-identity-vs-irsa`, `aws-vpc-anatomy`.
   **Techniques**: boundary, contents, meter, toggle, restyle, timer, caption.
   **Review**: Improved — beat 2 implied every pod gets its own security group; that is an opt-in
   feature (by default pods use the node's), so it is now a toggle; beat 5 had no numbers, so the
   calendar now shows standard then extended support then forced upgrade, and flags that nodes and
   add-ons are yours unless Auto Mode manages them (this defeats "EKS removes upgrade work"). Weighed
   leading with the managed control plane; opening on a quiet control plane over a roomy VPC makes
   the beat-3 IP exhaustion land as the surprise. Checked: IAM access entries precede RBAC, VPC CNI
   pod IPs and prefix delegation, Karpenter sizes nodes to pending pods.

### Lambda execution environments and cold starts (`aws-lambda-execution-and-cold-starts`)

**The aha**: A cold start is the one-time Init phase of a brand-new microVM — download code, start
the runtime, run top-level code — and that environment is then kept warm and reused, so the
expensive part happens once, not every request.
**Misconception to defeat**: Thinking every invocation pays the cold-start cost, or that code
outside the handler re-runs each time.
**Cast**: A row of execution-environment boxes (microVMs), grey when empty. A request queue feeding
dots toward them. Each built box shows two zones, Init (code outside the handler, e.g. a DB
connection) and Invoke (the handler).
**Opening frame**: An empty row, one request dot approaching.
**Story**:

1. The dot arrives, no warm box exists; a new box spins up: a timer runs "download code → start
   runtime → run init code" (a DB-connection line drawn once), then Invoke runs the handler. One
   long bar: cold start plus handler. _"Cold: the whole Init phase, paid once."_
2. A second dot lands in the _same_ box seconds later; Init is skipped entirely, straight to
   Invoke, the earlier DB connection reused. _"Warm: reused environment, reused connections."_
3. A burst of ten dots arrives at once; since one box handles one request at a time, several new
   boxes spin up in parallel, each paying its own cold start. _"Concurrency, not request count,
   decides how many cold starts."_
4. The memory slider rises; the Init and Invoke bars visibly shorten (CPU scales with memory), and
   the cost meter dips, then climbs once the bars stop shrinking. _"More memory, more CPU: often
   faster, sometimes cheaper."_
5. Inset: a SnapStart box skips straight from a saved snapshot to Invoke, no runtime boot at all.
   _"Skip Init by resuming a snapshot."_
   **The moment**: Beat 2, the second dot landing in the same box and skipping the whole Init bar.
   **Interaction**: Fire single requests versus a burst and count cold versus warm landings; drag the
   memory slider and watch the Init bar's length.
   **Ending**: A steady-state row of warm boxes, new dots landing warm, Init bars dark; then traffic
   stops, an idle timer runs, the boxes fade out, and the next lone dot meets a cold start again.
   _"Warm is borrowed time, not a guarantee."_
   **Variants**: `aws-lambda-concurrency`, `aws-lambda-invocation-models`; contrast with Fargate task
   start time.
   **Techniques**: contents, timer, token, restyle, dial, caption.
   **Review**: Improved — the ending implied warm environments last forever, but Lambda recycles idle
   ones at times it does not promise, so the loop now ends with the fade and a fresh cold start; the
   memory caption said "less cost", which is only sometimes true (price per ms rises with memory), so
   the cost meter now shows a minimum. Weighed leading with SnapStart as the fix; it stays an inset
   since the concept is the mechanism. Checked: one environment serves one request at a time, burst
   concurrency drives parallel cold starts, top-level code runs once per environment, SnapStart
   restores a snapshot instead of running Init.

### Lambda concurrency: reserved vs provisioned (`aws-lambda-concurrency`)

**The aha**: Concurrency is just how many boxes are busy right now out of a shared account pool;
reserved concurrency fences a guaranteed, capped slice for free, while provisioned concurrency pays
to keep some of that slice pre-warmed so nobody hits a cold start.
**Misconception to defeat**: Thinking reserved concurrency means warm boxes (it's a limit and
guarantee, not warmth), or that provisioned concurrency scales rather than just pre-paying for a
fixed amount of warmth.
**Cast**: A bracket "account pool: 1,000" of boxes shared by many functions. A fence around a
slice "reserved: 50" for one function. Inside, some boxes tinted gold, "provisioned: 10 —
pre-warmed, billed even idle", with a coin meter beside them.
**Opening frame**: The full 1,000-box pool, unfenced, requests from several functions landing
anywhere.
**Story**:

1. A fence closes around 50 boxes for "checkout-fn": other functions can't spill into them, and
   checkout-fn can never exceed 50. The 50 are empty grey slots, not running environments: its
   first request still pays an Init timer. _"A ceiling and a guarantee. Free, and not warm."_
2. Ten of the 50 tint gold, built and warm before any request arrives; the coin meter ticks at
   zero traffic. _"Pre-warmed, and billed for warm, not just used."_ A small auto-scaling icon
   beside the gold group shows it moves only if you attach a schedule or target.
3. Fifteen requests arrive at once: the ten gold boxes answer instantly, no Init bar; the next five
   hit the Init timer in ordinary reserved boxes. _"Provisioned skips cold starts, up to how many
   you paid for."_
4. A 51st request bounces off the fence, a 429 appears to a synchronous caller, who must handle
   it; an inset shows an async event or SQS message quietly retried later instead of dropped.
   _"Past the fence: throttled. Sync callers see it; async sources retry."_
5. Inset: a "Managed Instances" box shows several request dots sharing one environment at once,
   unlike the one-request-per-box rule everywhere else. _"A different model, for steady load."_
   **The moment**: Beat 2's coin meter ticking at zero traffic — the exact point "guarantee" (free)
   and "pre-warmed" (paid) stop being the same thing.
   **Interaction**: Dial reserved and provisioned sizes independently; fire a burst past the fence and
   watch the 429s.
   **Ending**: Fence and gold boxes at rest, coin meter steady, caption contrasting free ceiling
   against paid warmth.
   **Variants**: `aws-lambda-execution-and-cold-starts`, `aws-lambda-invocation-models`,
   `aws-asg-scaling-policies`.
   **Techniques**: boundary, contents, restyle, meter, token, failure, dial, caption.
   **Review**: Improved — "reserved means warm" was named but the fenced boxes looked identical to the
   gold ones; beat 1 now draws them as empty slots that still pay Init, so beat 2's coin meter marks
   the real difference. The beat-4 429 only reaches synchronous callers (async sources retry), and
   provisioned concurrency is fixed unless you attach auto scaling, so both are stated. Weighed a
   "restaurant reservation vs staff on shift" metaphor; the box fence is already concrete. Checked:
   1,000 default account pool, provisioned is carved out of reserved/unreserved capacity and never
   exceeds it, spillover beyond provisioned runs on ordinary on-demand environments, Managed
   Instances serve several requests per environment.

### Lambda invocation: synchronous, asynchronous, event source mappings (`aws-lambda-invocation-models`)

**The aha**: Who retries a failure, and where it ends up, depends entirely on how Lambda was
invoked — the caller, Lambda itself, or the poller — and that fact tells you where to look when
something fails silently.
**Misconception to defeat**: Assuming Lambda always retries the same way, or not knowing one bad
stream record can block an entire shard.
**Cast**: Three lanes. Sync: a caller (API Gateway) holding its breath. Async: a caller fires and
walks away, with an internal queue between caller and function. Event source mapping: a poller
reads a stream source (SQS, Kinesis, DynamoDB Streams) in batches.
**Opening frame**: Three lanes idle, each with its source on the left, the function on the right.
**Story**:

1. Sync lane: a request travels to the function, which fails (red flash); the error flies straight
   back to the caller. _"The caller sees the failure and decides."_
2. Async lane: a request drops into the internal queue, then fails; it's retried twice
   automatically (a minute, then two, apart), then routed to an on-failure destination or DLQ, or
   dropped if neither is set; the original caller already walked away. _"Lambda retries, then
   hands off — the caller never knows."_
3. Event source mapping: a batch of five records is read from one shard; record 3 fails. The whole
   batch, records 1 and 2 (already done) included, goes back and is processed again, over and
   over; later records wait behind it. _"One bad record blocks its shard, and repeats the good
   ones..."_
4. A "bisect batch on error" toggle flips on: the batch halves repeatedly until the bad record is
   alone and the good ones proceed; "report batch item failures" instead resumes from record 3.
   _"...unless you bisect, or report which items failed."_
5. For SQS specifically: the failed batch isn't deleted, so after its visibility timeout it
   reappears, until the queue's own DLQ takes it. _"Failure just means the message comes back."_
   **The moment**: Beat 3, good records 4 and 5 sitting stuck behind one bad record — the
   shard-blocking behaviour nobody expects.
   **Interaction**: Pick a lane and a failure point, watch where the retry happens and who finds out;
   toggle batch bisection on the stream lane.
   **Ending**: All three lanes resolved: sync's caller informed, async's DLQ holding the failure, the
   stream shard unblocked.
   **Variants**: `aws-lambda-concurrency`, `aws-sqs-visibility-timeout-and-dlq`,
   `aws-dynamodb-streams`, `aws-step-functions`.
   **Techniques**: lanes, token, failure, contents, toggle, caption.
   **Review**: Improved — beat 3 said the batch "retries from 3", but without partial-batch reporting
   Lambda reprocesses the whole batch, so records 1 and 2 run again (the duplicate-processing surprise
   is now on screen, and the fix is "report item failures"); async now notes events are dropped when
   no destination or DLQ is set; SQS failures end in the queue's DLQ, not a Lambda setting. Weighed
   a "who picks up the phone" metaphor for the three lanes; the lanes already carry it. Checked:
   two async retries with 1- then 2-minute gaps, bisect semantics, DLQ vs destination.

### Lambda in a VPC, and RDS Proxy (`aws-lambda-in-a-vpc`)

**The aha**: Putting Lambda in a VPC is about reaching private things, not about security, and the
real danger is thousands of concurrent environments each opening their own database connection at
once.
**Misconception to defeat**: Believing VPC attachment "secures" the function, or that it keeps
internet access automatically.
**Cast**: A VPC frame with private subnets holding Hyperplane ENIs. A Lambda function outside, a
dashed line borrowing those ENIs to reach inside. An RDS instance inside with a connection-count
meter. An internet cloud outside, reachable only via a NAT or endpoint path.
**Opening frame**: The function outside the VPC, a blocked line to the private RDS instance.
**Story**:

1. The function attaches to the VPC: a dashed line grows through a shared Hyperplane ENI into the
   private subnet, now reaching RDS directly. The ENI is created once, at attach time, not on each cold start.
   _"A path in, nothing more."_
2. The function calls an external API: the line out to the internet is blocked, no route, until a
   NAT gateway or VPC endpoint is drawn in. _"Attached isn't still-has-internet."_
3. Concurrency spikes to 500: 500 environments each open a direct connection to RDS, whose small
   instance allows roughly 100 (the meter's red line); new connections start failing. _"Serverless scale, hitting a
   very non-serverless fixed resource."_
4. An RDS Proxy box inserts between the functions and RDS: 500 environments now share a small pool
   of real connections; the meter drops to safe. _"Pools connections — and speeds up failover
   too."_
   **The moment**: Beat 3's meter redlining — the surprise of serverless scale against a fixed
   database connection limit.
   **Interaction**: Dial concurrency up and watch the RDS connection meter with and without the Proxy;
   toggle the NAT/endpoint route on and off.
   **Ending**: RDS Proxy in place, connection meter steady under a high concurrency dial.
   **Variants**: `aws-lambda-concurrency`, `aws-vpc-endpoints-and-privatelink`,
   `aws-rds-multi-az-vs-read-replicas`.
   **Techniques**: boundary, token, meter, failure, toggle, dial, caption.
   **Review**: Improved — the connection limit was unquantified ("redlines" at what?), so the meter
   now has a concrete small-instance ceiling (limits scale with instance memory); beat 1 stops
   viewers carrying over the old "VPC makes cold starts slow" folklore (Hyperplane ENIs are made at
   attach time). Weighed leading with RDS Proxy alone; the surprise of serverless scale meeting a
   fixed limit needs the failing run first. Checked: attached functions have no internet without
   NAT or endpoints (and no public IP), Proxy multiplexes connections and shortens failover, VPC
   attachment is reachability, not protection.

## Storage

### S3 buckets, objects and keys (`aws-s3-fundamentals`)

**The aha**: S3 is a flat key-to-value store over HTTP: no rename, no append, no editing a byte in
place; every write replaces the whole object, and a "folder" is only slashes in a name.
**Misconception to defeat**: Treating S3 like a networked file system with real directories and
in-place edits.
**Cast**: A bucket as a wide flat tray. Objects as cards: a key on top (`2024/june/beach.jpg`), a
byte blob, a size tag. A client box on the left over an HTTPS line. A file-explorer overlay for
contrast.
**Opening frame**: An explorer view: folders `2024` › `june` › `beach.jpg`.
**Story**:

1. The explorer collapses into a flat tray of cards; the slashes in each key glow. _"No folders —
   one flat list of keys."_
2. The client PUTs a 6 GB video; the card appears only once upload completes, shown split into
   numbered multipart chunks reassembling into one card. _"Big objects go up as parts."_
3. The client tries "change byte 512 of log.txt": the token bounces, red. Then it GETs the whole
   object, edits locally, PUTs the whole thing back; the old card swaps for the new. _"No edits in
   place. Replace the whole object."_
4. `LIST prefix=2024/june/` lights only the matching cards, the rest dim. _"A folder is a prefix
   filter."_
5. Zoom out: the tray stretches to millions of dots; meters read "11 nines durability", "strong
   read-after-write — the GET right after a PUT always sees it". _"A key-value store wearing a
   file-system costume."_
   **The moment**: Beat 3, the in-place edit bouncing — the one fact that breaks the file-system
   picture.
   **Interaction**: Type a key prefix to filter the list; try "edit in place" and watch it bounce every
   time.
   **Ending**: Flat list, one prefix lit, "key-value store over HTTP".
   **Variants**: `aws-s3-storage-classes-and-lifecycle`, `aws-ebs-volumes-and-snapshots`,
   `aws-file-storage-choice` (S3 Files adds a file-system door; Express One Zone directory buckets
   add append and rename, a footnote only).
   **Techniques**: toggle, contents, token, failure, spotlight, zoom, meter, caption.
   **Review**: Keep — weighed opening on the S3 console's fake folders versus a "locker with name
   tags" metaphor; the explorer-collapses-to-flat-tray opening attacks the real misconception head
   on and the bounced byte-edit is a one-beat proof. Checked: single PUT tops out at 5 GB so a 6 GB
   upload must be multipart (objects up to 5 TB), the object appears only when the upload completes,
   strong read-after-write on all GET/LIST since Dec 2020, eleven nines durability, prefixes as
   filters; no-append/no-rename is true for general-purpose buckets (hence the footnote).

### S3 storage classes and lifecycle rules (`aws-s3-storage-classes-and-lifecycle`)

**The aha**: The colder the shelf, the less you pay to keep an object and the more you pay, and
wait, to read it back; lifecycle rules walk objects down the shelves automatically by age.
**Misconception to defeat**: Picking a class by how "important" the data is instead of how often
it's read; forgetting colder classes carry minimum durations and minimum sizes.
**Cast**: Shelves at growing distance from a desk: Standard (near) · Intelligent-Tiering ·
Standard-IA · One Zone-IA · Glacier Instant Retrieval · Glacier Flexible Retrieval · Glacier Deep
Archive (far, in a vault), plus Express One Zone closest of all. Retrieval timer and minimum-
duration tag on each far shelf.
**Opening frame**: One object on Standard, bill showing "store: high, read: cheap, wait: none".
**Story**:

1. The object is read 1,000×/month on Standard; the bill stays flat and cheap-per-read. _"Read a
   lot: stay near."_
2. Move it to Glacier Deep Archive: storage cost drops to a sliver. A GET bounces ("restore
   first"); a restore request starts a clock of 12 hours (standard) before a temporary copy is
   readable, plus a retrieval fee. _"Cheapest to keep, slowest and dearest to read."_
3. Delete it at day 60: a "minimum duration: 180 days" penalty chip charges anyway; a second chip
   notes the 128 KB minimum billable size on the IA classes. _"Leave early, pay anyway."_
4. An Intelligent-Tiering object sits untouched for 30 days (slides to its infrequent tier), then
   is read (jumps back to frequent) with no rule written, no retrieval fee and no minimum
   duration, only a small per-object monitoring fee. _"Watches access, moves it for you."_
5. A lifecycle rule ("IA after 30d → Glacier after 180d → delete after 7y") runs fast-forward over
   a pile of ageing objects, each sliding down the shelves on schedule.
   **The moment**: Beat 2's clock, 12 hours between GET and data — the number that makes "cheap" and
   "free" different questions.
   **Interaction**: Dial "reads per month" and watch the cheapest shelf shift with it; edit the
   lifecycle rule's day thresholds and watch the pile redistribute.
   **Ending**: Pile settled across shelves by actual access pattern, bill flat.
   **Variants**: `aws-s3-fundamentals`, `aws-s3-versioning`, `aws-hybrid-storage-and-data-transfer`.
   **Techniques**: contents, move, meter, timer, token, dial, spotlight, caption.
   **Review**: Improved — beat 2 said a GET "succeeds after 12 hours", but an archived object cannot be
   read at all until a restore request creates a temporary copy, so the GET now bounces first (a
   sharper moment); beat 4 now gives Intelligent-Tiering's real 30-day first step and its monitoring
   fee; beat 3 gains the 128 KB minimum-size chip the misconception mentions. Weighed a coffee-pantry-to-warehouse metaphor; the desk-and-shelves framing already
   does it. Checked: minimum durations (30 days IA and One Zone-IA, 90 Glacier IR/Flexible, 180 Deep
   Archive, none for Intelligent-Tiering), Deep Archive standard retrieval 12 hours, Express One Zone
   single-digit-millisecond and single-AZ.

### S3 versioning and delete markers (`aws-s3-versioning`)

**The aha**: With versioning on, a delete doesn't erase anything, it stacks a delete marker on
top, so "deleted" comes back the moment the marker is removed; but every version sits there being
billed.
**Misconception to defeat**: Thinking versioning is a backup system, or that switching it off
undoes what it already protected.
**Cast**: An object card stack, v1–v3 fanned behind the current version. A "DELETE MARKER" card
that can sit on top. A switch Versioning: off / on / suspended, drawn so "off" is unreachable once
clicked on. A GB-billed meter.
**Opening frame**: `config.json` v3 on top, versioning off, meter at "1 object billed".
**Story**:

1. An overwrite with versioning off: v3's contents vanish, nothing left behind. _"Off: an overwrite
   is just gone."_
2. Flip versioning on; the same overwrite slides v3 down and drops v4 on top, nothing lost. _"On:
   the old one waits underneath."_
3. Delete the object: a DELETE MARKER drops on top of the stack; GETs now 404. _"A delete is one
   more marker."_
4. Remove the marker (a delete naming the marker's own version id): v4 reappears, untouched.
   _"Undelete: pull the marker off."_ Then a delete naming v4's version id erases it for good,
   no marker. _"Only a version-id delete is permanent: versioning is an undo, not a backup."_
5. Try to switch versioning back to off: the switch refuses, landing only on "suspended". _"You can
   suspend it. You can't undo it."_
6. The meter climbs as every version is billed; a lifecycle rule (inset) expires old noncurrent
   versions to bring it back down.
   **The moment**: Beat 3, the delete marker landing on an untouched stack — "deleted" turning out to
   mean "hidden".
   **Interaction**: Overwrite, delete and undelete buttons with the switch in different positions; try
   switching versioning off and watch it refuse.
   **Ending**: Object restored, marker removed, stack and meter both visible.
   **Variants**: `aws-s3-storage-classes-and-lifecycle`, `aws-s3-object-lock`, `aws-s3-replication`,
   `aws-ebs-volumes-and-snapshots`.
   **Techniques**: toggle, layers, clone, move, timer, disappear, meter, caption.
   **Review**: Improved — "versioning is not a backup" was named but never shown; beat 4 now ends with
   a version-id delete permanently erasing v4 (the reason MFA delete and Object Lock exist). Weighed
   a recycle-bin metaphor: it is right for the marker and wrong for the permanent delete, so the
   stack-with-marker visual stays. Checked: overwrite with versioning off is lost, enabled
   versioning can only be suspended, a plain delete adds a marker and GET then returns 404, billing
   covers noncurrent versions, lifecycle expiry of noncurrent versions.

### S3 replication: CRR and SRR (`aws-s3-replication`)

**The aha**: Replication only copies new writes going forward, asynchronously, and by design does
not copy deletes, so the replica survives even a malicious or accidental delete on the source.
**Misconception to defeat**: Thinking replication is a backup, that it copies what's already in
the bucket, or that it's instant.
**Cast**: A source bucket (Region A) and a destination (Region B for CRR, or another bucket in the
same Region for SRR), both versioned. Objects as cards; a dashed timer line between the buckets,
"async, usually seconds, minutes without RTC".
**Opening frame**: Source full of 1,000 existing objects, destination empty, replication just
switched on.
**Story**:

1. Switch replication on: the existing 1,000 objects stay put. _"Only new objects replicate. The
   backlog needs Batch Replication."_
2. A new object lands in the source and streams across to the destination seconds later. _"New
   writes, copied asynchronously."_
3. Replication Time Control toggles on, a "15-minute SLA" badge appears, a progress bar tracks the
   copy against that promise. _"A time guarantee, for a fee."_
4. Someone deletes an object from the source (red flash, a delete marker lands); the destination's
   copy sits untouched. _"Deletes don't replicate by default — the replica survives you."_
   Then someone overwrites a source object with garbage: that one crosses over as a new version
   (older versions remain). _"Bad writes replicate. That's why it isn't a backup."_
5. Inset: replicate into another storage class or another account, the destination card landing on
   a colder shelf or inside a different account boundary.
   **The moment**: Beat 4, the source object gone and red while the destination sits calm right beside
   it.
   **Interaction**: Toggle RTC and watch the SLA bar; delete a source object and watch the destination
   not react.
   **Ending**: Source changed, destination holding the safety net. _"Survives a delete. Copies a bad
   write. Not a backup."_
   **Variants**: `aws-s3-versioning`, `aws-s3-object-lock`, `aws-multi-region-databases`.
   **Techniques**: boundary, stream, timer, failure, toggle, caption.
   **Review**: Improved — the misconception "replication is a backup" was only half defeated (deletes
   are skipped, but overwrites and corruption replicate), so beat 4 adds the garbage overwrite; the
   source "delete" is now a delete marker (versioning is required on both buckets), and the ending
   quote is softened to match. Weighed a "photocopier" metaphor; two side-by-side buckets reacting
   differently to the same delete is sharper. Checked: only new objects replicate (Batch Replication
   for the backlog), delete markers are not replicated by default and version-id deletes never are,
   RTC gives a 15-minute SLA for a fee, cross-account and cross-class are supported.

### S3 Object Lock (WORM) (`aws-s3-object-lock`)

**The aha**: Compliance-mode retention is deliberately irreversible, nobody, not even root, can
shorten it or delete the locked version before it expires, and that's exactly what makes it hold up
against ransomware and regulators.
**Misconception to defeat**: Thinking soft delete, MFA delete or "read-only" permissions give the
same protection; an admin can always flip those off.
**Cast**: Two buckets with the same invoice cards. Left: "Versioning + MFA delete + permissions". Right: cards
in a glass case, "LOCKED until 2033 · compliance mode". An attacker figure wearing an admin/root
badge.
**Opening frame**: Twin buckets, identical invoices, the badge hovering over both.
**Story**:

1. The attacker, as admin, removes the permission on the left, turns MFA delete off with stolen
   credentials, deletes every version by id. All gone. _"Admin rights undo ordinary
   protections."_
2. Same attacker, same actions on the right: deleting a locked version bounces off the glass,
   shorten retention refused, remove Object Lock refused. (A plain delete only adds a marker; the
   locked version stays.) _"No one can undo this. Not even root."_
3. A new invoice drops into the right bucket; GET works freely. _"Write once, read many — not
   read-never."_
4. Governance mode, toggled instead: an ordinary user's delete bounces, but the admin attacker
   succeeds by holding the bypass-governance-retention permission and sending the bypass header.
   _"Overridable, by design, for the few who need it. A stolen admin is one of them."_
5. The calendar runs to 2033; the glass case opens on its own. _"Time-based retention just
   expires."_
6. A different card wears a LEGAL HOLD tag with no end date; 2033 passes and it's still locked
   until legal removes the tag by hand.
   **The moment**: Beat 2, the identical attacker succeeding on the left and failing completely on
   the right.
   **Interaction**: Play the attacker against either bucket, governance versus compliance mode
   toggled, and try every override.
   **Ending**: Right bucket intact, left empty, compliance-mode case still locked.
   **Variants**: `aws-s3-versioning`, `aws-s3-replication`; legacy Glacier Vault Lock as a footnote.
   **Techniques**: boundary, toggle, failure, timer, caption.
   **Review**: Improved — the left bucket's "soft delete" is not an S3 feature (the real ordinary
   protections are versioning, MFA delete and permissions), so it is relabelled and the attacker now
   deletes by version id; the "delete bounces" beat is clarified (a plain delete just adds a marker
   even on a locked bucket; it is the version that cannot be removed); governance mode now shows the
   same attacker winning, which is the honest reason to choose compliance. Weighed a safe-deposit
   box metaphor; the identical-attacker twin buckets are stronger. Checked: versioning is required,
   governance needs s3:BypassGovernanceRetention plus a header, compliance cannot be shortened or
   removed by anyone including root, legal hold has no end date and is independent of retention.

### S3 access control: bucket policies, ACLs, Block Public Access (`aws-s3-access-control`)

**The aha**: Block Public Access is a circuit breaker that overrides everything else; while it's
on, even a bucket policy granting `Principal: *` has zero effect.
**Misconception to defeat**: Believing a permissive policy or public ACL makes a bucket public
regardless of account settings; not knowing ACLs are disabled by default now.
**Cast**: A bucket with a pinned policy ("Allow s3:GetObject to Principal: *"). A red breaker
switch, "Block Public Access", at account and bucket level. A public-internet figure trying to
reach in. An access point as a side door with its own narrow policy.
**Opening frame**: Breaker ON (default), an older policy already reads `*`, the internet figure
blocked at the breaker, not the policy. Principals inside the account pass untouched: the breaker
only watches "public" access.
**Story**:

1. The request reaches the breaker first and bounces there, red, never reaching the policy. _"BPA
   checks first."_
2. Flip the breaker off: the same request passes the breaker, reaches the `*` policy, succeeds.
   _"Only now does the permissive policy do anything."_
3. Flip the breaker back on and try to save a new public-reading policy: the save itself is
   rejected (Block Public Policy). A policy that predates the breaker stays on file but is
   ignored for outsiders (Restrict Public Buckets). _"Refuses new public policies, silences old
   ones."_
4. Toggle to legacy ACLs: greyed out, "disabled by default (Bucket Owner Enforced)"; any grant via
   ACL is rejected. _"ACLs are legacy. Policies only."_
5. An access point is added: a second door with its own narrower policy and network-origin
   restriction, used by one application without touching the main policy.
   **The moment**: Beat 1 versus beat 2, the identical `*` policy doing nothing, then everything,
   purely because of one switch elsewhere.
   **Interaction**: Toggle Block Public Access at each level and watch the same request succeed or
   fail; try to attach an ACL and watch the rejection.
   **Ending**: Breaker back on, policy still permissive but inert. _"The switch that matters most."_
   **Variants**: `aws-s3-presigned-urls`, `aws-s3-fundamentals`, `aws-vpc-endpoints-and-privatelink`.
   **Techniques**: boundary, toggle, failure, spotlight, caption.
   **Review**: Improved — beat 3 said a new public policy is "accepted by IAM", but with Block Public
   Access on (the default for new buckets) the save is rejected outright, and an already-attached
   public policy is silently ignored for outsiders; both are now shown, and the opening frame explains
   how a `*` policy coexists with the breaker. Weighed a bouncer-versus-guest-list metaphor; the
   breaker and unchanged-policy contrast already carries it. Checked: ACLs off by default (Bucket
   owner enforced, April 2023), BPA exists at account and bucket level, access points have their own
   policies and network-origin restriction.

### S3 presigned URLs (`aws-s3-presigned-urls`)

**The aha**: A presigned URL borrows the signer's own permissions for a limited time and one
operation; it isn't a separate grant, so if the signer's credentials expire first, the URL dies
with them.
**Misconception to defeat**: Thinking a presigned URL is itself a permission, independent of who
signed it.
**Cast**: A server (the signer) holding temporary credentials with a visible expiry countdown. It
generates a URL card, "GET object.pdf · SigV4 · expires in 10 min". A browser client receives only
the URL. The S3 object sits behind a gate.
**Opening frame**: Server with credentials expiring in 55 minutes, about to sign a URL for a
browser upload.
**Story**:

1. The server signs a URL for "PUT upload.jpg", good for 10 minutes, and hands only the URL to the
   browser, no keys travel. _"Carries a signature, not the credentials."_
2. The browser PUTs the file straight to S3, bypassing the server for the heavy transfer. _"Direct
   to S3 — the server isn't a relay."_
3. At 11 minutes, the browser tries again: the gate checks the embedded expiry and refuses. _"A
   dead link, after expiry."_
4. A URL signed with 8 minutes left on the signer's credentials is handed out with a 10-minute
   window, but it dies at minute 8, when the credentials run out, not minute 10. _"Can't outlive
   the credentials that signed it."_
5. Side by side: a public bucket (anyone, forever) versus this URL (one object, one operation, one
   short window).
   **The moment**: Beat 4, the URL's own clock not being the real deadline — the signer's credential
   expiry quietly cuts it short.
   **Interaction**: Dial the URL's requested expiry and the signer's credential expiry independently
   and see which governs; try the URL after each deadline; revoke the signer's permission and watch
   an unexpired URL die.
   **Ending**: A successful upload within the window, a dead link after it.
   **Variants**: `aws-s3-access-control`, `aws-iam-roles-and-sts`, `aws-cloudfront-distributions`.
   **Techniques**: timer, token, failure, side by side, caption.
   **Review**: Improved — added to the interaction a third kill switch, revoking the signer's
   permission, which also kills the URL immediately, since the URL is checked against the signer's
   rights at use time; this is the cleanest proof that it is not a separate grant. Weighed a
   hotel-key-card metaphor; the dual clock (URL expiry vs credential expiry) is more specific and
   stays. Checked: SigV4, one method on one object, expiry is the shorter of the requested time and
   the signing credentials' lifetime for temporary credentials (long-lived IAM user keys allow up
   to 7 days), the heavy transfer goes straight to S3.

### S3 encryption options (`aws-s3-encryption-options`)

**The aha**: The real question isn't whether it's encrypted, almost everything defaults to yes,
it's who holds the key and who can see every time it's used; moving to SSE-KMS trades transparency
for an audit trail and an extra permission check.
**Misconception to defeat**: Thinking encryption-at-rest is one on/off setting, or that KMS is just
"more secure" rather than "more accountable, and slower and pricier".
**Cast**: Four lanes, the same object through a lock: SSE-S3 (AWS holds the key, invisible),
SSE-KMS (a KMS key with a visible kms:Decrypt gate and a CloudTrail line per use), SSE-C (customer
supplies the key with every request, disabled by default on new buckets), Client-side (already
encrypted before it arrives; S3 never sees plaintext).
**Opening frame**: Four identical plaintext objects about to enter their lanes.
**Story**:

1. SSE-S3: the object disappears into the lock and reappears encrypted, no extra step, no
   separate key-use record. _"Default since 2023. Transparent."_
2. SSE-KMS: the object also passes a kms:Decrypt gate, and CloudTrail records each KMS use; a
   "bucket key" toggle checks the gate far less often (fewer calls, fewer receipts, a lower KMS
   bill). _"A second lock, and a receipt each time."_
3. SSE-C: the client must present its own key with every request; a new-bucket banner shows this
   lane disabled by default since April 2026. _"You hold the key, and prove it every call."_
4. Client-side: the object arrives already scrambled; the lock drawn here does nothing more.
   _"AWS never sees plaintext, encrypted or not."_
5. Side-by-side meters: SSE-S3 cheapest and silent, SSE-KMS pricier with a climbing log counter,
   SSE-C and client-side carrying the most key-management burden.
   **The moment**: Beat 2's CloudTrail line appending on every read, the thing SSE-S3 simply doesn't
   produce.
   **Interaction**: Pick a lane and read the object repeatedly, watching for a log line; toggle the
   bucket key and watch the KMS call count drop.
   **Ending**: All four lanes at rest, each object encrypted, only the audit trail differing.
   **Variants**: `aws-ebs-volumes-and-snapshots`, `aws-s3-access-control`.
   **Techniques**: contents, restyle, boundary, chart, toggle, side by side, caption.
   **Review**: Improved — "no log entry" for SSE-S3 was too strong (S3 data events can still be
   logged); the difference is the per-use key record, so the wording is now "no separate key-use
   record"; the bucket key beat now states the trade (fewer calls, but also fewer receipts). Weighed
   collapsing the four lanes into a single "who holds the key" slider; four lanes with one object
   each make the key holder visible, so they stay. Checked: SSE-S3 default since January 2023,
   SSE-C off by default on new buckets since April 2026 (per catalog), kms:Decrypt is the extra
   permission check, client-side keeps plaintext from AWS entirely, DSSE-KMS omitted as a footnote.

### EBS volumes, snapshots and instance store (`aws-ebs-volumes-and-snapshots`)

**The aha**: An EBS volume is pinned to one AZ, so snapshots, Regional and incremental, are the
only way data crosses an AZ or Region boundary, and they're literally what AMIs are made of.
**Misconception to defeat**: Thinking a volume can attach anywhere, that a snapshot is a full copy
every time, or confusing instance store (ephemeral) with EBS (persistent).
**Cast**: AZ-A with an instance plugged into a gp3 volume. AZ-B, empty, wanting the same data. A
snapshot shelf at the Region level holding incremental snapshot cards (only changed blocks shaded).
An instance-store strip drawn on the instance box itself, separate from the volume.
**Opening frame**: AZ-B's instance reaching for AZ-A's volume and bouncing off, "wrong AZ".
**Story**:

1. AZ-B's instance tries to attach directly: the cable refuses at the AZ boundary. _"A volume lives
   in one AZ. Full stop."_
2. A first snapshot is taken: every written block copies up to the Regional shelf. After some
   writes, a second snapshot copies only the changed blocks (the rest of its card points back at
   the first); deleting the first doesn't break the second. _"Incremental and Regional, above the
   AZ line."_
3. The snapshot builds a new volume in AZ-B; AZ-B's instance attaches successfully. _"This is how
   data crosses AZs."_
4. The same snapshot copies to another Region and is baked into an AMI card. _"What an AMI is made
   of."_
5. Contrast: the instance stops; its instance-store strip empties, while its attached EBS volume
   stays lit, data intact. _"Instance store: gone on stop. EBS: persists."_
6. A meter shows gp3 holding a flat 3,000 IOPS baseline regardless of size, next to io2 Block
   Express scaling IOPS with a provisioned dial, next to st1/sc1 as wide, slow throughput bars.
   **The moment**: Beat 1's refusal at the AZ boundary, the single fact that explains everything that
   follows.
   **Interaction**: Try attaching across AZs and watch it refuse; snapshot and rebuild in another AZ;
   stop the instance and watch instance store empty while EBS persists.
   **Ending**: AZ-B instance running on its new volume, snapshot shelf holding the lineage.
   **Variants**: `aws-s3-fundamentals`, `aws-file-storage-choice`, `aws-resource-scope`.
   **Techniques**: boundary, failure, clone, token, contents, meter, dial, caption.
   **Review**: Improved — beat 2 let viewers think every snapshot copies only changed blocks, but the
   first one copies everything written; it now shows first then second, and that deleting an older
   snapshot never breaks a newer one (the surprising and useful consequence of "incremental"). Weighed
   leading with instance store versus EBS; the cross-AZ refusal explains more of the concept. Checked:
   gp3 3,000 IOPS baseline independent of size, io2 Block Express provisioned IOPS with Multi-Attach,
   st1/sc1 are throughput HDDs, snapshots Regional and copyable across Regions and accounts, AMIs
   reference snapshots, instance store is wiped on stop.

### EFS vs FSx vs S3 Files (`aws-file-storage-choice`)

**The aha**: Pick by protocol and workload, not by what's newest: Linux/NFS goes to EFS,
Windows/SMB+AD goes to FSx for Windows, HPC-over-S3 scratch goes to FSx for Lustre, lift-and-shift
NetApp goes to ONTAP, and "stay in S3 but let tools see a file system" goes to S3 Files.
**Misconception to defeat**: Treating all "managed file storage" as interchangeable, or picking
FSx for Lustre for a plain Windows share.
**Cast**: A question path with five end points, each lighting the matching icon: Linux/NFS → EFS;
Windows/AD/SMB → FSx for Windows; HPC reading/writing S3 → FSx for Lustre; migrating NetApp ONTAP
→ FSx for ONTAP; data must stay in S3 but a tool needs a path → S3 Files.
**Opening frame**: The tree collapsed, a root box "I need shared file storage."
**Story**:

1. Click "Linux app, many instances mounting NFS": the path lights to EFS; a lifecycle-tiering bar
   shows cold files sliding to a cheaper tier automatically. _"Elastic NFS, Regional, tiers
   itself."_
2. Click "Windows app needing a domain-joined SMB share": path lights to FSx for Windows, an
   Active Directory icon plugged in beside it. _"SMB with real AD integration."_
3. Click "HPC cluster chewing through an S3 training set": path lights to FSx for Lustre, linked
   directly to an S3 bucket, data streaming both ways at speed. _"Scratch space built for S3."_
4. Click "moving an existing NetApp filer as-is": path lights to FSx for ONTAP, carrying over the
   same snapshot, clone and replication icons the on-prem NetApp used.
5. Click "must stay in S3, but my tool only speaks file paths": path lights to S3 Files, a thin NFS
   layer sitting on top of an S3 bucket. _"The data's still S3 — this is just a door onto it."_
6. The misconception run: a Windows client's SMB mount is dragged onto EFS and onto FSx for Lustre;
   both bounce ("no SMB", "Linux clients only"), then it snaps onto FSx for Windows. _"Wrong
   protocol, no mount."_ (FSx for OpenZFS joins ONTAP as the other enterprise-NAS option.)
   **The moment**: The tree lighting a single, different path for each answer; there's no generic
   best, only a matching service.
   **Interaction**: Click through the question path and watch exactly one path light each time; a
   protocol toggle narrows the choices live.
   **Ending**: The full tree, all five end points visible, the lit path faint for comparison.
   **Variants**: `aws-ebs-volumes-and-snapshots`, `aws-s3-fundamentals`,
   `aws-hybrid-storage-and-data-transfer`.
   **Techniques**: choice, spotlight, contents, path trace, caption.
   **Review**: Improved — "FSx for Lustre for a plain Windows share" was named as the misconception
   but never shown, so beat 6 makes the wrong mount bounce; OpenZFS is acknowledged alongside ONTAP.
   Weighed a "which plug fits" protocol-socket framing (NFS, SMB, Lustre sockets); it is the same
   idea as the question path, which is kept for consistency with the other choice plans. Checked: EFS
   is NFS for Linux and not supported from Windows, FSx for Lustre is Linux-client only and links to
   S3, FSx for Windows is SMB with Active Directory, ONTAP carries snapshots/clones/replication,
   S3 Files is an NFS door onto S3 (April 2026, built on EFS).

### Storage Gateway, DataSync and moving data into AWS (`aws-hybrid-storage-and-data-transfer`)

**The aha**: Gateways are for ongoing hybrid access, your app keeps its usual protocol, backed by
AWS storage with a local cache; DataSync is for actually moving data, once or on a schedule; and
online versus physical transfer is pure bandwidth arithmetic.
**Misconception to defeat**: Thinking a gateway "migrates" data rather than continuously serving
it, or picking physical transfer without doing the bandwidth math.
**Cast**: An on-premises app talking its native protocol into a Storage Gateway box with a local
cache, behind it an arrow to AWS storage (S3/FSx/EBS snapshots). Separately, a DataSync box with a
one-shot or scheduled arrow into AWS. A calculator panel: dataset size divided by link bandwidth
versus a flat device-shipping time.
**Opening frame**: The on-prem app writing locally through the gateway's cache, most files already
synced to S3 behind it.
**Story**:

1. The app writes a file; it lands in the local cache instantly, then uploads to S3 behind the
   scenes; reading a cold file shows a brief fetch-back into cache. _"The app never changes its
   habits — the gateway is the hybrid part."_
2. DataSync is pointed at a whole share: a sync job copies and verifies the dataset into S3 or EFS,
   then finishes, no ongoing serving. _"Moves data. Doesn't serve it afterward."_
3. A Transfer Family box takes an SFTP connection from a partner and lands files straight onto
   S3/EFS, no gateway or client software needed by the partner.
4. The calculator: 100 TB over a 100 Mbps link computes to about 93 days even at full line rate
   (100 × 10¹² × 8 bits ÷ 10⁸ bits/s); beside it, a physical transfer computes to days to a couple
   of weeks whatever the size. Multipart upload and Transfer Acceleration use the link better but
   can't widen it. _"Do the arithmetic before choosing a wire."_
5. A faded Snowball icon sits crossed out, "closed to new customers (existing users only)"; the
   current physical option is Data Transfer Terminal, where you bring your own storage to an AWS
   site to upload at high speed. A dialled-up link (1 Gbps: about 9 days) flips the answer back.
   **The moment**: Beat 4, the calculator flipping the "obvious" online choice into the losing one
   purely on bandwidth times time.
   **Interaction**: Dial dataset size and link bandwidth and watch the online-versus-device transfer
   times cross over.
   **Ending**: The calculator settled on whichever method wins for the dialled numbers.
   **Variants**: `aws-s3-fundamentals`, `aws-file-storage-choice`, `aws-direct-connect-vs-vpn`.
   **Techniques**: contents, stream, timer, dial, side by side, caption.
   **Review**: Improved — "roughly 100 days" is 93 at 100% utilisation and the plan showed no working,
   so the arithmetic is on screen; "shipping a device" can't be the headline physical option while
   Snowball is closed to new customers (Data Transfer Terminal, a site you visit, replaces it), so
   beat 5 states that and shows a 1 Gbps link flipping the result (about 9 days) to make the
   calculator the point. Weighed splitting gateway from DataSync into two concepts; the
   serve-versus-move contrast is the aha and fits one plan. Checked: File and Volume gateways cache
   locally and upload asynchronously, DataSync verifies copies, Transfer Family speaks SFTP/FTPS/AS2.

## Databases

### RDS Multi-AZ vs read replicas (`aws-rds-multi-az-vs-read-replicas`)

**The aha**: Multi-AZ is for availability, same endpoint, a synchronous standby takes over on
failure; read replicas are for read scaling and DR, separate endpoints, asynchronous, lag, manual
promotion; production systems typically need both, for different reasons.
**Misconception to defeat**: Calling a read replica "the backup", or thinking the Multi-AZ standby
is readable in the simple deployment, or that failover is instant.
**Cast**: Left, "Multi-AZ instance deployment": a primary in AZ-A with one endpoint, a standby in
AZ-B labelled "not readable", a thin synchronous line between them. Centre, "Multi-AZ DB cluster":
primary plus two readable standbys. Right, "Read replica": primary with a separate endpoint in
another AZ or Region, an asynchronous line with a lag meter.
**Opening frame**: All three patterns side by side, same primary, different companions.
**Story**:

1. Multi-AZ instance: the primary fails (red flash); a failover timer runs for roughly one to two
   minutes, then DNS for the same endpoint repoints to the standby, now primary. The app never
   changed its connection string. _"Same endpoint. The standby takes over. Not instantly."_
2. Try reading the old standby before failover: refused, "not readable". _"That capacity just sits
   idle, insuring you."_
3. Multi-AZ DB cluster variant: the same failure happens, but a reader endpoint was already serving
   some read traffic from the two standbys, and the failover timer is shorter (typically under
   35 seconds). _"The cluster variant lets you use that capacity."_
4. Read replica: the app deliberately sends reporting queries to the replica's own endpoint; a lag
   meter shows it seconds behind. _"Different endpoint, on purpose, slightly behind."_
5. The primary fails; the replica does not automatically take over. A manual "promote" button must
   be clicked, after which it becomes a standalone writable primary with its own endpoint.
   _"Replicas don't fail over. You promote them."_
6. A `DROP TABLE` runs on the primary: it flows to the standby and the replica within moments.
   _"Neither is a backup. Backups and point-in-time restore are."_
   **The moment**: Beat 5, the promote button sitting unclicked while the primary is down, read
   replicas need a human, Multi-AZ doesn't.
   **Interaction**: Fail the primary under each pattern and watch what happens automatically versus
   what needs a click; dial replica lag.
   **Ending**: Multi-AZ already recovered, the read replica still waiting to be promoted, side by
   side.
   **Variants**: `aws-aurora-architecture`, `aws-multi-region-databases`, `aws-in-memory-caching-options`.
   **Techniques**: side by side, failure, timer, meter, choice, caption.
   **Review**: Improved — "under a minute" is wrong for the instance deployment (AWS says about 60 to
   120 seconds; the DB cluster variant is typically under 35), which matters because the plan
   promised to defeat "failover is instant"; the replica-as-backup misconception was also never shown,
   so beat 6 replicates a bad statement to both. Weighed splitting into two concepts; the
   three-patterns-one-failure layout is the comparison, so it stays one plan. Checked: standby not
   readable in instance mode, readable in cluster mode, read replicas asynchronous with separate
   endpoints and manual promotion, cross-Region replicas supported.

### Aurora architecture (`aws-aurora-architecture`)

**The aha**: Because every reader shares the same distributed storage volume as the writer, adding
a reader copies zero data, and failover is just a promotion, seconds, not a restore.
**Misconception to defeat**: Thinking Aurora replicas work like RDS read replicas, separate copies
that must catch up, or that durability comes from the instance.
**Cast**: A shared storage volume drawn as six small cylinders across three AZs (two per AZ),
"write quorum 4 of 6 · read quorum 3 of 6". Above it, a writer and up to 15 readers, each a thin
line straight down into the same six cylinders, no separate copies per reader.
**Opening frame**: One writer, two readers, all three lines converging on the same six cylinders.
**Story**:

1. A write lands on 4 of 6 cylinders (quorum) before being acknowledged; the other 2 catch up
   shortly after. _"Durability lives in the storage layer, before the write even returns."_
2. A third reader is added: no data copies anywhere, just a new line drops onto the same six
   cylinders; it only warms its cache, with milliseconds of lag. _"Adding a reader copies
   nothing."_
3. The writer fails (red flash, instance box only, cylinders untouched); one reader is promoted to
   writer in seconds to a minute, its line simply changes role. _"Failover is a promotion, not a
   restore."_
4. A clone is created: a new cluster whose cylinders are copy-on-write pointers back to the
   originals, instant, only diverging pages actually copy.
5. Serverless v2 inset: an ACU meter scales smoothly down as load drops, can pause at zero after
   idle (resuming takes seconds), and climbs back as load returns, the storage layer below
   unaffected. _"Compute scales independently of storage."_
   **The moment**: Beat 3, the instance box going red while all six cylinders stay calm and lit, the
   failure that would sink RDS doesn't touch Aurora's data layer at all.
   **Interaction**: Add or remove readers and watch whether storage reacts; fail the writer and time
   the promotion; drag the serverless ACU dial.
   **Ending**: New writer promoted, same six cylinders, readers reattached.
   **Variants**: `aws-rds-multi-az-vs-read-replicas`, `aws-multi-region-databases`.
   **Techniques**: contents, boundary, clone, failure, meter, dial, caption.
   **Review**: Improved — "instantly caught up" overstated it (a new reader skips any data copy but
   still has a small cache lag); the zero-scaling inset now says it is a pause with a short resume,
   not free elasticity. Weighed side-by-side against RDS Multi-AZ; that contrast already lives in
   the sibling plan and this one is stronger as a pure "storage is the database" picture. Checked:
   six copies, two per AZ, three AZs; write quorum 4 of 6, read quorum 3 of 6; up to 15 readers;
   failover is a reader promotion; clones are copy-on-write; Serverless v2 in ACUs.

### Aurora Global Database vs DynamoDB global tables vs Aurora DSQL (`aws-multi-region-databases`)

**The aha**: It's a choice of where writes are allowed to happen: one Region writes and the rest
read (Aurora Global), every Region writes and conflicts resolve after the fact (DynamoDB global
tables), or every Region writes with strong consistency enforced upfront at a latency cost (Aurora
DSQL).
**Misconception to defeat**: Treating all three as interchangeable "multi-region databases", or
expecting free global writes with no trade-off.
**Cast**: Three Region maps side by side, Region A and Region B. Aurora Global: a thick one-way
arrow A→B, "typically under a second behind", a crown on A. DynamoDB global tables: two-way
arrows, both crowned, a conflict icon where the same item is touched in both. Aurora DSQL: two-way
arrows plus a handshake on every write, both crowned, a latency meter.
**Opening frame**: Three maps at rest, each already showing its arrow pattern.
**Story**:

1. Aurora Global: a write lands in A, streams one-way to B; B's app tries to write and is refused,
   "read-only here" (unless write forwarding is on, which quietly sends it back to A, paying the
   distance). _"Write global: one Region writes, the rest read."_
2. The same item is edited in both Regions within the same second on the global-tables map: both
   succeed locally and instantly, then a "last writer wins" badge resolves which sticks and the
   loser's edit silently vanishes. _"Write local: conflicts resolved after, one edit lost."_
3. Toggle global tables to multi-Region strong consistency (a three-Region set, one can be a
   witness): the same simultaneous edit now waits on a cross-Region round trip, and one writer is
   told "conflict, retry" instead of silently losing. _"Or pay latency to be told, not
   overwritten."_
4. Aurora DSQL map: reads and statements run locally; at COMMIT every transaction waits for a
   cross-Region handshake, and a conflicting one is rejected for retry. Its latency meter sits
   visibly higher than the other two at rest. _"Strong consistency everywhere, paid at every
   commit."_
5. Region A fails on all three maps: Aurora Global needs someone to click promote; DynamoDB global
   tables keep taking writes in B unassisted; Aurora DSQL keeps taking writes in B too, already
   consistent.
   **The moment**: Beat 2 versus beat 4, the same simultaneous edit resolved instantly-but-arbitrated
   on one map and slowly-but-decisively on another.
   **Interaction**: Fire a simultaneous write at both Regions on each map; fail Region A and see which
   system needs a human.
   **Ending**: Three maps, failure already run, promote clicked only on the Aurora Global map.
   **Variants**: `aws-aurora-architecture`, `aws-rds-multi-az-vs-read-replicas`,
   `aws-dynamodb-keys-and-partitions`.
   **Techniques**: side by side, exchange, token, failure, meter, toggle, caption.
   **Review**: Improved — beat 3 said the strongly consistent mode tells you "which won"; it actually
   rejects one concurrent writer with a conflict error rather than resolving it, so the beat now shows
   the rejection and the beat-2 lost edit is made explicit (the real contrast: silently overwritten
   vs told); beat 4 said every write handshakes, but DSQL pays at commit (reads and statements are
   local, and conflicts are optimistic); write forwarding on Aurora Global is noted so "refused" isn't
   read as absolute. Weighed a three-row table of consistency/latency/failover; the same-edit,
   three-outcome run is stronger. Checked: Global's typical sub-second lag and manual promotion,
   global tables last-writer-wins default, DSQL active-active with a witness Region.

### DynamoDB keys, partitions and access patterns (`aws-dynamodb-keys-and-partitions`)

**The aha**: The partition key decides which physical partition an item lands on and how much of
the table's total capacity that item can ever use, so a hot key throttles no matter how much
capacity you've bought.
**Misconception to defeat**: Designing keys around entities like a relational primary key instead
of around access patterns; thinking more capacity fixes a hot partition.
**Cast**: A table as several small cylinders, each capped at roughly 3,000 RCU and 1,000 WCU, and
splitting in two as it nears about 10 GB (a trigger, not a hard cap).
A hash function routes each item's partition key to one cylinder. A sort key, when present, orders
items within one cylinder.
**Opening frame**: Five evenly sized cylinders, items spread roughly evenly, capacity bars mid-way.
**Story**:

1. An item with partition key `user#4471` and sort key `order#2024-10-01` is hashed to cylinder 3,
   slotting in order among that user's other orders. _"Partition key picks the cylinder, sort key
   orders what's inside."_
2. A Query for "user#4471, orders after Oct 1" reads straight from cylinder 3 alone. _"One
   partition key, fast."_
3. A Scan sweeps every cylinder, start to finish, far slower and pricier. _"The whole table, every
   time."_
4. A bad design uses `status: pending` as the partition key: nearly every item piles onto one
   cylinder, redlining, while the other four sit nearly empty. _"Low-cardinality key: one hot
   cylinder, however much total capacity you buy."_
5. Capacity is doubled for the whole table: the hot cylinder's bar still redlines at its own
   per-partition ceiling, the extra capacity piling up unused on the idle cylinders. _"More
   capacity doesn't rebalance a bad key."_
6. Redesign back to `user#4471`: items spread evenly, all bars calm. Inset: a single-table design
   shares one partition key across related item types so one Query fetches them all.
   **The moment**: Beat 5, capacity doubled, the redline unmoved, the clearest proof that key design,
   not capacity, is the real lever.
   **Interaction**: Pick a partition-key strategy and feed realistic traffic; try doubling capacity on
   a hot-key design and watch nothing improve.
   **Ending**: Evenly spread cylinders, all calm, the hot-key version crossed out beside it.
   **Variants**: `aws-dynamodb-capacity-modes`, `aws-dynamodb-gsi-vs-lsi`, `aws-dynamodb-streams`.
   **Techniques**: contents, token, meter, failure, side by side, spotlight, caption.
   **Review**: Improved — the cast called 10 GB a cap per partition; DynamoDB splits partitions as they
   grow, so size is a split trigger (the per-partition throughput limits are the real ceiling, and
   one single hot item cannot be split at all), now drawn as a cylinder dividing; beat 5 now says why
   extra capacity doesn't help (the hot partition's own ceiling) instead of "landed on the empty
   cylinders". Weighed a library-card-catalogue metaphor; the capacity-doubling-with-no-effect proof
   is more memorable. Checked: 3,000 RCU / 1,000 WCU per partition, sort key orders within a partition
   key, Query reads one partition key and Scan reads all, single-table design, adaptive capacity helps
   at the margins but cannot lift the ceiling.

### DynamoDB capacity: provisioned RCU/WCU vs on-demand (`aws-dynamodb-capacity-modes`)

**The aha**: A capacity unit is spent on item size and consistency, not on "a query"; an 8 KB
strongly consistent read costs 2 RCUs, and a transaction costs double whatever it touches.
**Misconception to defeat**: Thinking RCU/WCU map one-to-one to a request, or that on-demand is
always pricier (it's cheaper for spiky, unpredictable traffic).
**Cast**: Two meters. Provisioned: dials for RCU and WCU with an auto-scaling band. On-demand: a
per-request coin counter that scales freely. A sample item (8 KB) with consistency and transaction
toggles.
**Opening frame**: Provisioned dials at "10 RCU, 5 WCU", on-demand counter idle at zero.
**Story**:

1. A 4 KB item, eventually consistent read: costs 0.5 RCU. _"1 RCU = one 4 KB strongly consistent
   read, or two eventually consistent."_
2. Same item, strongly consistent: now a full 1 RCU. _"Consistency has a price."_
3. Grow to 8 KB, strongly consistent: 2 RCUs, rounding up per 4 KB. A 1.5 KB write beside it costs
   2 WCUs, rounding up per 1 KB. _"Size rounds up."_
4. Toggle "transaction": the same read now pulls 4 RCUs, double. _"Transactional reads and writes
   cost double."_
5. A sudden 50x spike hits the provisioned dial: requests beyond it throttle (after a short burst
   allowance) until auto scaling catches up. Switched to on-demand, the coin counter climbs with
   it and throttling is rare (traffic more than doubling its previous peak in minutes can still
   brush limits). _"No dial to outgrow — but pay per request, always."_
6. A steady, predictable week under both modes: on-demand's running total ends higher. _"Steady
   and known: provisioned is cheaper."_
   **The moment**: Beat 4, the chip count silently doubling the instant "transaction" is toggled, the
   exact surprise that blows up capacity math.
   **Interaction**: Toggle size, consistency and transaction independently; feed the same spike to
   both modes and compare throttling and final cost.
   **Ending**: A two-column summary, provisioned's dial and on-demand's coin counter, each lit for the
   traffic shape it suits.
   **Variants**: `aws-dynamodb-keys-and-partitions`, `aws-asg-scaling-policies`,
   `aws-aurora-architecture`.
   **Techniques**: meter, dial, toggle, chart, timer, side by side, caption.
   **Review**: Improved — beat 5 promised on-demand means "no throttling", which is too strong (very
   sudden jumps beyond double the previous peak can throttle), and the plan only counted reads, so
   beat 3 adds the write rounding (per 1 KB). Numbers check: 4 KB eventual = 0.5 RCU, 4 KB strong =
   1, 8 KB strong = 2, 8 KB strong transactional = 4. Weighed a water-tank metaphor for capacity; a
   literal item-by-item unit calculator is clearer and matches how people get surprised. Checked:
   1 WCU = 1 KB write, transactions cost double, on-demand dearer for steady load and a better
   fit for spiky load.

### DynamoDB GSIs vs LSIs (`aws-dynamodb-gsi-vs-lsi`)

**The aha**: A GSI is really a second table, its own partition key, sort key and capacity, kept
eventually consistent; an LSI is a second sort order inside the same partition, strongly
consistent, but declared up front and capped at 10 GB per partition key.
**Misconception to defeat**: Thinking of either as a relational index (a pointer into the same
row), or that a GSI is free to add anytime with no capacity consideration.
**Cast**: A base table (cylinders by user-id). Beside it, a GSI as a fully separate set of
cylinders (different partition key, e.g. `status`), connected by a thin sync arrow with a lag
badge. Below one base cylinder, an LSI as a second sort-ordered list sharing the exact same
cylinder.
**Opening frame**: Base table alone, items sorted by user-id.
**Story**:

1. A GSI "by status" is added after the table already has data: new cylinders appear, slowly
   filling as the sync arrow streams every existing item across. _"Added anytime, because it's
   really a new table, built after the fact."_
2. A write lands on the base table; a moment later the same item appears in the GSI. A query on the
   GSI right after the write still shows the old value. _"Eventually consistent, a real, visible
   gap."_
3. The GSI's own capacity is undersized; it throttles under load even though the base table's
   capacity is fine, and that throttling pushes back on writes to the base table too. _"Starve it,
   and it can slow the base table too."_
4. Contrast: the LSI shares the very same cylinder as its base item, just a different sort order,
   spending the base table's capacity (no capacity bar of its own), with a strongly consistent
   read option unavailable on the GSI. _"Same partition, different order, and strongly
   consistent."_
5. Try adding an LSI to a running table: refused, "must be created with the table". Grow one base
   partition's LSI data past 10 GB: a cap warning appears.
   **The moment**: Beat 2's visible lag, a GSI showing an older value a split-second after the base
   table already has the new one.
   **Interaction**: Write to the base table and watch the GSI catch up with a delay; starve the GSI's
   capacity and watch the base table's writes slow too.
   **Ending**: Base table, GSI and LSI all settled and consistent, lag badge faded to zero.
   **Variants**: `aws-dynamodb-keys-and-partitions`, `aws-dynamodb-capacity-modes`,
   `aws-dynamodb-streams`.
   **Techniques**: contents, stream, timer, meter, failure, side by side, caption.
   **Review**: Improved — beat 4 now shows the LSI drawing on the base table's capacity while the GSI
   has its own bar, completing the "own capacity" half of the contrast that beat 3 starts; beat 2's
   lag is the plan's moment and is kept. Weighed leading with the LSI (same cylinder, simple) before
   the GSI; the GSI-is-a-second-table reveal is the bigger surprise, so the order stays. Checked: GSI
   any time, eventually consistent only, own keys and capacity, throttled GSI back-pressures base
   writes; LSI same partition key, strongly consistent option, creation-time only, 10 GB per
   partition-key value.

### DynamoDB Streams (`aws-dynamodb-streams`)

**The aha**: Every write to the table automatically becomes an ordered event on that item's shard,
so you can react without ever writing the same data twice, but a 24-hour window and per-shard
ordering mean a stuck consumer blocks only its own shard, and only for a day.
**Misconception to defeat**: Confusing Streams with global tables (replication) or with polling the
table; not realising order is per-item, not table-wide.
**Cast**: The base table's cylinders, each trailing a thin "stream" ribbon, a time-ordered log of
change records (KEYS_ONLY / NEW_IMAGE / OLD_IMAGE / BOTH). A Lambda consumer reads from the
ribbons. A 24-hour fading tail on each.
**Opening frame**: Table quiet, ribbons empty, consumer idle.
**Story**:

1. An item is updated; a MODIFY record (old and new image) appears at the head of that item's
   shard ribbon and a Lambda invocation fires off it, while a greyed "poll the table" loop beside
   it is crossed out. _"Every write becomes an event, no polling."_
2. Two different items change on two different shards; their invocations fire independently and in
   parallel. _"Order holds within a shard, not across the table."_
3. The consumer errors on one record: that shard stalls, later records on the same shard pile up
   behind it, while other shards flow freely. _"A failing consumer blocks only its own shard."_
4. The stalled records' age ticks toward the ribbon's 24-hour fade; at 24 hours the unprocessed
   tail vanishes for good. _"Streams only hold 24 hours."_
5. Inset: a Kinesis Data Streams for DynamoDB ribbon stretches far longer, with more concurrent
   consumers, than the native 24-hour ribbon. _"Need longer retention? Route to Kinesis."_
   **The moment**: Beats 3–4, one shard's events piling up and ageing toward the cliff while
   neighbouring shards flow normally.
   **Interaction**: Break the consumer on purpose and watch one shard back up while others don't;
   scrub the 24-hour fade timer forward and watch records disappear.
   **Ending**: Consumer fixed, backed-up shard draining, all ribbons flowing again.
   **Variants**: `aws-dynamodb-keys-and-partitions`, `aws-lambda-invocation-models`, `aws-eventbridge`.
   **Techniques**: stream, contents, failure, timer, lanes, caption.
   **Review**: Improved — "not polling the table" was named but never shown (now crossed out in beat
   1); the global-tables confusion is dropped from the misconception because replication has its own
   plan and showing it here would dilute the shard story. Weighed a conveyor-belt metaphor; the
   ribbon with a fading tail already combines ordering and the 24-hour cliff. Checked: 24-hour
   retention, four view types, per-partition shards with per-item ordering, a Lambda consumer error
   retries and blocks only its shard, Kinesis Data Streams for DynamoDB extends retention (up to 365
   days) and consumers.

### ElastiCache, DAX and MemoryDB (`aws-in-memory-caching-options`)

**The aha**: Pick by what happens when a node dies: Memcached loses that node's data, Valkey or
Redis fails over to a replica that already had it, and MemoryDB keeps it through a durable
transaction log even if every node restarts.
**Misconception to defeat**: Treating all in-memory caches as equally disposable, or thinking DAX
is a general-purpose cache rather than DynamoDB-specific.
**Cast**: Four lanes holding the same key, each with a red "node dies" button. Memcached: one node,
no replica. Valkey/Redis: primary plus replica, async replication line. MemoryDB: primary plus
replica plus a durable transaction log underneath both. DAX: sits in front of a DynamoDB table
icon specifically.
**Opening frame**: Four lanes, all holding the same key, all healthy.
**Story**:

1. Memcached: the node dies (red flash), the data is simply gone, nothing else held a copy. _"No
   replication. Dies, it's gone."_
2. Valkey/Redis: the primary dies, the replica, already synced, takes over within seconds. _"Replica
   takes over. Multi-AZ failover."_
3. Push further: both Valkey/Redis nodes restart at once, a full outage; everything written since
   the last snapshot (if snapshots are on) is gone, because replication copies memory, not a
   log. _"Survives one node dying, not the whole cluster going dark."_
4. MemoryDB: both nodes die; the durable transaction log underneath survives untouched, and a fresh
   node rebuilds straight from it. _"Built to be the primary store, not just a cache."_
5. DAX: a request for a DynamoDB item hits DAX first, a fast cache hit (writes go through DAX to
   the table; a strongly consistent read skips the cache); point the app straight at DynamoDB
   instead and the request still succeeds, just slower. _"Only ever sits in front of DynamoDB."_
   **The moment**: Beat 3 versus beat 4, the identical "kill everything" button leaving Valkey/Redis
   empty and MemoryDB intact.
   **Interaction**: Press "kill node" then "kill everything" on each lane and watch what survives.
   **Ending**: Four lanes at rest, each captioned with exactly what it lost to a full outage.
   **Variants**: `aws-dynamodb-keys-and-partitions`, `aws-rds-multi-az-vs-read-replicas`,
   `aws-purpose-built-databases`.
   **Techniques**: contents, failure, stream, side by side, caption.
   **Review**: Improved — beat 3 claimed Valkey/Redis loses data with "nothing durable", but snapshots
   can restore to their last point, so the loss is "since the last snapshot"; beat 5 said "remove DAX
   and it still works", but the app must be repointed at DynamoDB (DAX is a separate endpoint and
   client), and DAX's strongly consistent reads bypass its cache. Weighed three lanes without DAX
   (a pure durability story); DAX stays because the misconception (a general cache) is real. Checked:
   Memcached no replication, Valkey/Redis Multi-AZ failover to an async replica, MemoryDB durable
   multi-AZ transaction log, DAX write-through.

### Purpose-built databases on AWS (`aws-purpose-built-databases`)

**The aha**: AWS deliberately offers a different engine for each data shape and access pattern;
the skill isn't knowing every service, it's starting from your access pattern and consistency
needs and letting that pick the engine, and most real systems end up using several at once.
**Misconception to defeat**: Reaching for one familiar database, usually relational, for
everything; thinking "managed" means AWS chose the schema and sizing too.
**Cast**: A question path branching by data shape, each lighting one icon: rows and joins → RDS or
Aurora (or Aurora DSQL for distributed strong consistency); simple key-to-item at huge scale →
DynamoDB; JSON documents → DocumentDB; wide-column → Keyspaces; graph traversal → Neptune;
sub-millisecond lookups → ElastiCache or MemoryDB; time-stamped metrics → Timestream;
warehouse-scale analytics → Redshift; full-text or log search → OpenSearch; vector similarity →
pgvector, OpenSearch or S3 Vectors.
**Opening frame**: The path collapsed, a root box, "what does my data look like, and how do I
query it?"
**Story**:

1. Click "rows with relationships and transactions": the path lights to RDS or Aurora. _"Managed
   doesn't mean someone else decided your schema."_
2. Click "huge scale, simple lookups by key": the path lights to DynamoDB, the RDS branch dimming
   beside it. _"Different shape, different engine."_
3. One architecture builds up live: an e-commerce app lights RDS (orders), DynamoDB (sessions),
   ElastiCache (hot product cache), OpenSearch (search) and Redshift (nightly analytics), five
   branches lit on one system at once. _"Most real systems light up several branches, not one."_
4. Hovering Neptune, Timestream and Keyspaces each shows one sentence on the narrow case it's built
   for: graph traversal, time-series compression, Cassandra-compatible wide-column. _"Narrow tools
   for narrow shapes."_
5. Back on the RDS branch, a "schema?" and "instance size?" chip stay lit with a "you" tag. _"AWS
   patches and backs up. You still design."_
   **The moment**: Beat 3, one architecture lighting five engines at once, the opposite of "pick a
   database for the company".
   **Interaction**: Click through the path for a stated workload and watch which engine lights; build
   the e-commerce example branch by branch.
   **Ending**: The five-branch diagram at rest, each service labelled with the one job it's doing.
   **Variants**: `aws-dynamodb-keys-and-partitions`, `aws-rds-multi-az-vs-read-replicas`,
   `aws-in-memory-caching-options`.
   **Techniques**: choice, spotlight, contents, path trace, caption.
   **Review**: Improved — the "managed means AWS chose the schema and sizing" misconception had no
   beat that defeated it, so beat 5 leaves the schema and size chips tagged "you". Weighed building the
   whole plan around the e-commerce example, opening with five engines already lit; it overwhelms a
   newcomer, so the question path stays first and the example is the payoff. Checked: Aurora DSQL
   and S3 Vectors are current (2025–26); Timestream's original LiveAnalytics engine closed to new
   customers in 2025 while Timestream for InfluxDB remains, so its hover sentence should say
   "time-series (InfluxDB)". Not changed in the catalog list, flagged for the platform stage.
