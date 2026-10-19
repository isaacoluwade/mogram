# Fundamentals plans, part 2

Stage 2 plans for `catalog/fundamentals.md` groups 7 to 12: driving the cloud, cloud economics,
pricing models, FinOps practice, cost optimisation levers, and frameworks/adoption/provider
promises. They share a visual language with the other fundamentals plans: the responsibility
stack is a column of layers, blue for "you manage" and grey for "provider manages"; global
infrastructure is a world map with regions as rounded clusters of 2–3 zone boxes and edge
locations as small dots; resources are small labelled tiles; organisational hierarchy is nested
frames (organisation › accounts › groups › resources); money is a coin meter that ticks up while
something runs — a resource that is idle but still running keeps ticking, so waste is always
visible, never implied; demand is a line over time along the bottom of a chart, capacity a
shaded area drawn over or under it. Cost and FinOps ideas are usually taught as lists; here each
one is staged as something that moves and makes its point rather than recited.

No new technique was needed for this part: the vocabulary in the README (meter, chart, token,
boundary, dial, timer, toggle, side by side, spotlight, path trace, lanes, contents, failure,
choice, zoom, stream, move, restyle, caption) covers every beat below — the coin meter is a
`meter`, a commitment band under a demand curve is a `chart` with a `boundary`, egress coins
dropping on a crossing are a `token`, and nested org frames are `boundary` drawn inside
`boundary`.

## Driving the cloud

### Portal, CLI, SDKs and APIs (`portal-cli-sdk-api`)

**The aha**: Portal, CLI, SDK and infrastructure-as-code are all clients of the same authenticated API — a console click and a line of code produce the identical call, logged the same way.
**Misconception to defeat**: That the portal is "the real cloud" and the other tools are developer shortcuts to it.
**Cast**: Centre, a cloud icon labelled "API" with a small padlock. Around it in a ring: Portal (browser window), CLI (terminal), SDK (code icon), IaC (template icon), each joined to the centre by a line. Below, a scrolling "Audit log" panel.
**Opening frame**: The four clients sit around the quiet API hub; the log is empty.
**Story**:

1. Click a button in Portal: a token "CreateVM" flies to the hub, then to a VM tile that appears. The log gains a line: "api.create_vm — portal — user@co."
2. Type `az vm create` in CLI: an identical token, the same VM tile pattern, a log line differing only in "via: cli."
3. The same happens from one highlighted line of SDK code and one line of an IaC template — four tokens, four clients, one destination.
4. Spotlight the hub while the four clients dim. _"Same endpoint, same auth, same record."_
5. Someone logs into the VM over SSH and changes it by hand: the token goes straight into the VM, skipping the hub. No log line, and the IaC template no longer matches the VM. _"Only calls through here are checked and logged."_
   **The moment**: Beat 5, the SSH token sneaking around the hub and leaving no log line, makes "use code for anything you'll do twice, and everything is audited" concrete by showing the one path that escapes it.
   **Interaction**: Pick a client and watch its token travel the same route to the same place; try the SSH bypass and see the gap it leaves in the log.
   **Ending**: Five rows of the log side by side — four identical in shape, one missing.
   **Variants**: `control-plane-vs-data-plane`; delivery's infrastructure-as-code.
   **Techniques**: token, spotlight, contents, path trace, caption.
   **Review**: Improved — beat 5 corrected: SSH edits the machine from inside (data plane), so the point is a missing log line and config drift from the template, not a cloud-API change that escaped logging.

### Control plane vs data plane (`control-plane-vs-data-plane`)

**The aha**: The control plane is "change what exists," the data plane is "the thing doing its job." They fail and scale separately, so a running resource usually keeps serving through a control-plane outage, and the safest recovery uses only what the data plane already does.
**Misconception to defeat**: That if you can't manage a resource, it must be down ("the cloud is down" is not one thing).
**Cast**: Two lanes. Top, "Control plane": a thin panel of buttons, Create, Resize, Delete. Bottom, "Data plane": a thick highway with a running VM tile serving request tokens, plus a second, already-running standby VM (dim) with a health-check badge. A dashed line links a control button to the VM.
**Opening frame**: Both lanes calm; a hand hovers over "Resize" while the VM quietly serves three tokens below.
**Story**:

1. Click "Resize": a token runs down to the VM; it changes size. _"Changing the VM: control plane."_
2. Meanwhile request tokens keep flowing through the VM, uninterrupted. _"Serving traffic: data plane."_
3. The control lane flashes red, "degraded"; Create, Resize and Delete grey out and bounce.
4. The data lane is untouched: the same tokens keep flowing on the last-known configuration. _"Running resources keep running."_
5. The primary VM then crashes. A replacement is needed, so someone presses Create: it bounces red. _"But you can't launch a new one to recover with."_
6. The health check on the standby, already running, sees the primary fail and traffic shifts to it on its own; no button is pressed. _"Recover with what already exists."_
7. Ending freeze: "healthy" on the data plane, "degraded" on the control plane, at the same instant.
   **The moment**: Beats 5 and 6 back to back: the same crash, one recovery stuck on a bouncing Create button, the other gliding through the data lane.
   **Interaction**: A "break control plane" toggle, then a "crash primary" button; choose recovery A (create a new VM) or B (fail over to the standby) and see which one works during the break.
   **Ending**: Holds on the side-by-side badges, traffic served by the standby.
   **Variants**: `portal-cli-sdk-api`; `static-stability`, `dns-failover`, `failover`; networking's routers (forwarding continues on the last-known table).
   **Techniques**: lanes, token, failure, restyle, side by side, toggle, caption.
   **Review**: Improved — owner plan; borrowed Reliability's "recover using only data-plane actions" as beats 5–6 and the choose-your-recovery interaction, plus Networking's "last-known configuration" caption. Reliability's weighted-DNS-dial version was dropped because changing a weight is itself an API call; a health-check-driven failover is the true data-plane action.

## Cloud economics

### CapEx vs OpEx (`capex-vs-opex`)

**The aha**: Cloud turns one big upfront purchase into a stream of small metered payments — the risk of guessing wrong shrinks, but now someone has to manage a bill that moves every month.
**Misconception to defeat**: That OpEx just means "cheaper."
**Cast**: Left, "On-premises": one tall bar at month 0, "$500k — buy servers," then 36 flat months. Right, "Cloud": a wavy row of small bars across the same months, each sized to that month's use. A demand line runs above both.
**Opening frame**: Both timelines unstarted; the CapEx bar poised to drop.
**Story**:

1. Month 0: the CapEx bar slams down to $500k. _"Pay it all now, own it, depreciate it."_
2. Months 1–12, on-prem: the demand line rises past the hardware's ceiling; a queue forms while a new order takes weeks to arrive. _"Guessed too low: wait for the next purchase."_
3. Cloud side, same demand line: the small bars rise with it automatically. _"Spend follows use."_
4. Month 20: demand drops on both. On-prem's paid-for servers sit idle; cloud's bars shrink back down. _"Spend can fall too."_
5. Running totals near month 30: the CapEx dot sits flat and already spent; cloud's cumulative line bends with demand and may even end above it. _"Not always cheaper — the risk moved."_
6. A "who manages this?" tag lands on the wavy cloud line. _"Now someone watches a bill that moves."_
   **The moment**: Beat 2, on-prem's flat ceiling blocking real demand while cloud's bars simply track it, at the identical month.
   **Interaction**: Drag a demand dial up and down; watch on-prem stay flat and blocked while cloud tracks it.
   **Ending**: Freezes with demand dropped and cloud's bars shrunk; the CapEx bar sits unmoved.
   **Variants**: `pay-as-you-go`, `total-cost-of-ownership`.
   **Techniques**: chart, meter, dial, boundary, caption.
   **Review**: Improved — on-prem can buy more but with lead time (not 'no spend possible'); beat 5 now shows cloud can end higher, defeating 'OpEx = cheaper' directly.

### Pay-as-you-go (consumption-based) pricing (`pay-as-you-go`)

**The aha**: "Pay for what you use" really means "pay for what's running" — a provisioned resource bills for as long as it exists (by the second or hour, depending on provider) whether busy or idle; only per-request services actually charge zero when idle.
**Misconception to defeat**: That nothing running means nothing charged, for every kind of resource.
**Cast**: Two tiles side by side, each with its own coin meter: "VM" and "Function." A demand line passes under both, flat-low with occasional spikes.
**Opening frame**: Both meters at zero, both tiles idle, demand flat and low.
**Story**:

1. Demand spikes: both tiles light up, process tokens, both meters tick up.
2. Demand falls back to flat: the VM tile stays lit, visibly "running," and its meter keeps ticking, coin by coin. _"Still running. Still billed."_
3. The Function tile goes fully dark, meter frozen. _"No requests, no charge."_
4. Stop (not delete) the VM: its compute meter freezes, but the attached disk's small meter keeps ticking. _"Stopped isn't gone."_
5. Fast-forward a long idle stretch: the running-VM comparison stack grows; the Function's stays at zero. _"Idle isn't free unless the billing model says so."_
   **The moment**: Beats 2–3, the same idle period, one meter still ticking and one frozen, side by side.
   **Interaction**: A demand dial dragged to zero and back; watch which meter keeps moving.
   **Ending**: Holds on the two meters after a long idle stretch — one stacked with coins, one empty.
   **Variants**: fundamentals' `serverless-computing`; `cost-of-idle`.
   **Techniques**: meter, chart, dial, restyle, side by side, caption.
   **Review**: Improved — billing is per second/hour of existence, not just 'hourly'; added the stopped-VM-still-pays-for-its-disk beat, the commonest surprise.

### Economies of scale (`economies-of-scale`)

**The aha**: A provider buys and builds at a scale no single customer could, so its cost per unit keeps falling — and part of that saving reaches customers as lower prices over time.
**Misconception to defeat**: That cloud prices are set by what your workload alone costs the provider.
**Cast**: Left, "You": a small stack of ten server boxes with a unit-cost tag. Right, "Provider": a vast warehouse of identical servers with a far smaller unit-cost tag. A price-history chart along the bottom, stepping downward over years.
**Opening frame**: Your small stack beside the huge warehouse, two very different unit-cost tags.
**Story**:

1. Zoom into the warehouse: thousands of identical tiles, custom racks, one huge power contract, labelled "bought once, shared by everyone." _"That volume lowers the unit cost."_
2. More customer logos feed demand into the warehouse; its unit-cost tag shrinks further. _"More customers, more volume, lower cost — for everyone."_
3. The price-history chart ticks down in dated steps, for one real service: S3 Standard storage, $0.15 per GB-month at launch in 2006, about $0.023 today. _"Some of that saving comes back as price cuts."_
4. Your ten-server stack's unit cost stays flat no matter how long you own it. A small note: cuts are uneven, and newer hardware (GPUs) can cost more. _"You can't buy your way to that curve alone."_
   **The moment**: Beat 3, the stepped price-history chart — a real downward staircase over years — makes the abstract claim a fact on screen.
   **Interaction**: None; a historical record, not a lever.
   **Ending**: Holds on the chart's lowest step, the warehouse glowing behind it.
   **Variants**: `capex-vs-opex`, `total-cost-of-ownership`, `pricing-models-compared`.
   **Techniques**: zoom, meter, chart, contents, caption.
   **Review**: Improved — replaced the vague 'dated steps' with one real, checkable price history and added the honest caveat that prices don't only fall.

### Total cost of ownership (TCO) (`total-cost-of-ownership`)

**The aha**: Comparing a VM's hourly price to a server's purchase price compares one line to a whole bill; count power, cooling, space, network, licences, staff and refresh cycles on both sides before calling a winner.
**Misconception to defeat**: Comparing only "hardware price" to "hourly rate."
**Cast**: Two columns, "On-premises" and "Cloud," built from stacked bars appearing one at a time: Hardware/Service, Power & cooling, Space, Network, Licences, Staff, Refresh cycle. A running total under each.
**Opening frame**: Both columns show only their first bar; on-prem looks cheaper.
**Story**:

1. Someone points at just the first bars: "cloud is 3x the price." _"The naive comparison."_
2. On-prem adds bars one by one — cooling, a data-centre room, network gear, licences, three salaries, a refresh bar every 5 years — growing tall, and the hardware bar is shaded mostly idle (typical utilisation is low). _"Now count everything."_
3. Cloud adds its own smaller bars: data transfer, support, migration, new skills. _"Hidden costs too — just fewer and smaller."_
4. Totals compare: on-prem now stands taller. _"A fuller picture often flips the answer."_
5. A second workload, flat and enormous and certain (a straight demand line): run for years, on-prem now dips below cloud. _"Steady, certain, huge: owning can still win."_
6. A small "repatriation" arrow points from cloud back to on-prem for that workload.
   **The moment**: Beat 4, the honest full columns reversing the beat-1 snap judgment.
   **Interaction**: Toggle the workload's demand shape — spiky/uncertain vs flat/huge — and watch which column wins.
   **Ending**: Holds at "spiky," cloud shorter.
   **Variants**: `capex-vs-opex`, `cloud-cost-drivers`.
   **Techniques**: contents, meter, chart, toggle, caption.
   **Review**: Improved — added low on-prem utilisation to the on-prem bars (a classic TCO driver) and hedged 'usually' to 'often'.

### What drives a cloud bill (`cloud-cost-drivers`)

**The aha**: Compute is rarely the whole story — small, easy-to-miss meters (NAT gateways, cross-zone traffic, log ingestion, idle IPs, old snapshots) grow quietly until they're a large slice of the bill.
**Misconception to defeat**: That the bill is basically "the VMs."
**Cast**: A receipt starting with one big line, "Compute — $4,000," that grows thin extra lines one at a time, each with its own icon: Storage, Requests, Data transfer, NAT gateway, Cross-zone traffic, Log ingestion, Unused IPs, Old snapshots.
**Opening frame**: The receipt shows only "Compute — $4,000," looking complete.
**Story**:

1. "Storage — $600" and "Requests — $90" (per-call API charges) slide in beneath it. _"Add what you keep, and how often you touch it."_
2. "Data transfer — $800" slides in, with a coin dropping each time a small animated line of data crosses a region boundary. _"Moving data costs too."_
3. Five more thin lines slide in quickly — NAT gateway $180, cross-zone traffic $120, log ingestion $150, idle IPs $60, old snapshots $140. _"Small on their own..."_
4. Those thin lines regroup into one highlighted block, $650, bigger than Storage. _"...large together, and easy to miss."_
5. The total recomputes to $6,140, visibly higher than "just compute" suggested.
   **The moment**: Beat 4, the regrouped "small" lines turning out to rival a major line item.
   **Interaction**: Click any thin line for a ten-second zoom on what it tracks (a NAT processing fee, an unloved snapshot).
   **Ending**: The full itemised receipt, the once-invisible lines now a visibly large shaded block.
   **Variants**: `data-transfer-costs`, `cost-of-idle`, `storage-tiering-for-cost`.
   **Techniques**: contents, appear/disappear, token, zoom, meter, caption.
   **Review**: Improved — added the missing 'requests' driver, fixed '4 more lines' that listed five, and gave the thin lines amounts that really do add up to more than Storage.

### Licence-included vs bring your own licence (`byol-vs-license-included`)

**The aha**: Software licences can cost more than the infrastructure under them, and because many price per core, the licence model shapes which instance you can afford to pick.
**Misconception to defeat**: That the hourly VM price is "the cost," and the OS/database licence is a footnote.
**Cast**: One VM tile with two stacked price tags, "Infrastructure" and "Licence" (the bigger one). A toggle: Licence-included / BYOL, with a certificate icon for a licence already owned.
**Opening frame**: VM tile, licence-included selected, the licence tag visibly dwarfing the infrastructure tag.
**Story**:

1. Raise the core count: both tags grow, but the per-core licence tag grows faster, soon 4x the infrastructure tag. _"Many licences are priced per core."_
2. Toggle to BYOL: the owned certificate (with eligible terms, e.g. Software Assurance for Azure Hybrid Benefit) slots into the VM; the licence tag disappears and the total drops sharply. _"Bring a licence you already own."_
3. A constraint appears (example): "owned licences cover 16 cores." Push past it: a red X blocks the resize. _"BYOL ties your choice to what you already hold."_
4. Side-by-side totals at a few sizes, owned licences assumed: the BYOL gap is small on a small VM and large on a big one. A last tile: no licence owned, so BYOL means buying one, and the gap closes. _"BYOL pays only if you already own it."_
   **The moment**: Beat 1, the licence tag outrunning the infrastructure tag as cores rise, making "the licence can cost more than the server" visible.
   **Interaction**: A core-count dial and the licence toggle; watch which is cheaper at each size.
   **Ending**: Holds on a large VM, BYOL selected, far below the licence-included total.
   **Variants**: `instance-types-and-sizes`, `dedicated-hosts-and-bare-metal`, `commitment-discounts`.
   **Techniques**: meter, dial, toggle, restyle, side by side, caption.
   **Review**: Improved — the old 'licence-included wins on small VMs' claim was unsupported; BYOL wins only when licences are already owned and eligible, which is now the closing beat. The 16-core limit is labelled as an example.

## Pricing models

### On-demand, committed and spot pricing (`pricing-models-compared`)

**The aha**: The same compute can be bought three ways — full price with no strings, a discount for committing to a floor, or a deep discount for capacity that can vanish — and a healthy estate uses all three at once.
**Misconception to defeat**: That "reserved" means a specific server set aside for you, or that one model must cover everything.
**Cast**: The shared demand-over-time chart. Under it, three shaded bands bottom to top: "Committed" (flat, cheapest), "On-demand" (the variable middle, full price), "Spot" (only the sharpest peaks, hatched: "can be taken back"). A price-per-unit scale beside each (committed: up to ~70% off list; on-demand: list; spot: up to ~90% off).
**Opening frame**: The bare demand curve, no bands yet.
**Story**:

1. A flat band fills under the curve's permanent floor, tinted as a discount, not a machine. _"Commit to the floor — a discount on spend, not a reserved server."_
2. The next band fills the variable middle at full price. _"On-demand for the part you're not sure about."_
3. The top band, hatched, fills only the sharp spikes. _"Spot for the bursts you can afford to lose."_
4. A spike exceeds the spot capacity line: that part flashes red and bounces up into the on-demand band. _"Spot can be reclaimed — have a fallback."_
5. Price tags beside each band, drawn to one scale, so the area under each band shows what it actually costs.
   **The moment**: Beat 5, the bands stacked by price with area-under-curve literally showing total spend, turning "price trades against flexibility" into a shape.
   **Interaction**: Drag the commitment band's height and watch on-demand compensate, and total cost update.
   **Ending**: Holds with all three bands filled, total cost displayed.
   **Variants**: `commitment-discounts`, `spot-instances`, `data-transfer-costs`. Platform: AWS RIs/Savings Plans/Spot, Azure Reservations/Spot VMs, GCP CUDs/Spot VMs.
   **Techniques**: chart, boundary, meter, dial, failure, caption.
   **Review**: Improved — attached real discount ranges to the three bands and reworded beat 1 so 'reserved' reads as a billing discount, answering the stated misconception.

### Commitment discounts (reservations, savings plans, committed use) (`commitment-discounts`)

**The aha**: A commitment is a bet on your future floor — you pay for it whether you use it or not, so commit to the baseline you're sure of, and track coverage (how much usage is discounted) separately from utilisation (how much of the commitment you're using).
**Misconception to defeat**: That a commitment reserves a specific machine, or that "committed" means it's safe to commit to the peak.
**Cast**: The demand curve with a flat commitment band drawn under it at a height set by a dial (savings plans and committed-use discounts commit to dollars per hour; reservations to a size and region). Two meters beside it: "Coverage" and "Utilisation."
**Opening frame**: Commitment band set too low, well under the baseline; both meters mid-range.
**Story**:

1. Raise the band with the dial to meet the baseline exactly: utilisation reads 100%, coverage rises. _"Committed to exactly the floor: full value."_
2. Push the band above the baseline: a grey gap opens between its top and the real curve on quiet days — "paid, unused." Utilisation drops. _"Commit above the floor: you pay for air."_
3. Fast-forward months of growth: the old band now sits comfortably under the new, higher baseline, no excess. _"Review and raise it as the floor rises."_
4. A 1-year/3-year term toggle: the discount ticks from about 35% to about 55% as the term lengthens (illustrative; real figures vary by provider and product), with a lock icon showing the money is committed regardless.
   **The moment**: Beat 2, the grey "paid, unused" gap appearing the instant the band overshoots the real baseline — waste made visible exactly like idle waste elsewhere.
   **Interaction**: The dial sets commitment height directly on the chart; coverage and utilisation update live.
   **Ending**: Holds at the band matched exactly to the baseline, both meters near 100%, no grey gap.
   **Variants**: `pricing-models-compared`; `quotas-and-limits` (discount vs capacity guarantee); `dedicated-hosts-and-bare-metal`.
   **Techniques**: chart, dial, meter, boundary, toggle, caption.
   **Review**: Improved — figures marked illustrative and set to a realistic 1-year to 3-year spread; added the dollars-per-hour versus size-and-region distinction.

### Spot and preemptible capacity (`spot-instances`)

**The aha**: Spot is cheap because the provider can take it back with almost no notice; it suits work that can be interrupted and checkpointed, and is dangerous for anything that can't be.
**Misconception to defeat**: That spot is just "a bigger discount" with no catch, or unreliable the way a flaky service is.
**Cast**: A spare-capacity pool on the right, dimmed tiles belonging to other tenants. A workload tile pulls a spot instance from it, a 70–90%-off tag visible. A short countdown appears when the provider wants it back (AWS 2 minutes; Azure and Google Cloud about 30 seconds).
**Opening frame**: A workload running cheaply on spot, discount tag showing, pool behind it.
**Story**:

1. The provider needs the capacity back: a "reclaim" notice flashes, a short timer starts (2 minutes on AWS, about 30 seconds on Azure and GCP). _"Taken back with short notice."_
2. Timer hits zero: the tile simply vanishes — not red-failed, reclaimed. _"Not a failure. Reclaimed."_
3. Contrast A: a stateless batch job had just finished a checkpoint before reclaim; a fresh spot tile resumes right after it elsewhere. _"Checkpointed work: barely notices."_
4. Contrast B: a database placed on spot by mistake is reclaimed mid-write; in-flight work is lost and the node is gone until rebuilt, flashing red. _"Stateful, uninterruptible work: dangerous here."_
5. A short "good fits" list appears beside the batch job: CI runners, rendering, data processing, extra scale-out nodes.
   **The moment**: Beats 3–4 side by side, the identical reclaim event landing completely differently depending on what's running.
   **Interaction**: Assign a workload to spot and trigger a reclaim; watch the outcome differ by workload type.
   **Ending**: Holds on the batch job's clean handoff after reclaim, discount tag still visible.
   **Variants**: `pricing-models-compared`; `commitment-discounts` (a discount for staying vs for being evictable).
   **Techniques**: timer, failure, contents, side by side, choice, caption.
   **Review**: Improved — the 2-minute warning is AWS only (Azure and GCP give about 30 seconds); softened the database failure to what actually happens (lost in-flight work, rebuild) rather than implied corruption.

### Data transfer (egress) costs (`data-transfer-costs`)

**The aha**: Bringing data in is usually free, but taking it out costs per GB — and so does moving it between zones and regions — so chatty, far-flung architectures pay a toll on every trip.
**Misconception to defeat**: Treating data transfer as a speed limit (bandwidth) rather than a price per GB.
**Cast**: A region boundary holding two zone clusters, a second region far away, the public internet outside everything, a client on it. A coin icon sits at each boundary crossing.
**Opening frame**: A quiet region holding data, no coins moving.
**Story**:

1. Data flows in from the internet client on a free lane, no coin. _"In: usually free."_
2. The client requests data out: a token travels out, a coin drops at the edge per GB (about $0.09 on the big three, after a small free allowance). _"Out: billed per GB."_
3. Two services in different zones of the same region talk constantly; each crossing drops a small coin too, thousands an hour piling into a real stack. _"Cross-zone talk: billed by AWS and GCP (about $0.01/GB), not by Azure."_
4. A request crosses to the distant region: a bigger coin drops per GB (about $0.02 on AWS), and the token's trip takes visibly longer. _"Cross-region: pay more, wait longer."_
5. A CDN/cache tile is inserted near the client; most requests are now served there and never reach the region — the coin-drop rate falls sharply. _"Serve from the edge, skip the toll."_
   **The moment**: Beat 3, the "free-feeling" internal chatter between zones dropping real coins — small each, the pile real.
   **Interaction**: Toggle chatty cross-zone design vs same-zone design and watch the coin-pile rate change; add the CDN tile and watch egress coins drop.
   **Ending**: Holds on the CDN-served state, coin-drop rate low, most tokens never leaving the edge.
   **Variants**: `edge-locations-and-pops`, `regions-and-zones`, `cloud-cost-drivers`.
   **Techniques**: token, boundary, meter, toggle, path trace, caption.
   **Review**: Improved — added real per-GB magnitudes and corrected 'cross-zone is billed' to be provider-specific.

## FinOps practice

### FinOps (`finops`)

**The aha**: FinOps isn't cost-cutting — it's getting engineering, finance and product to make spend decisions together, with timely data, so the bill tracks value instead of being managed after the fact.
**Misconception to defeat**: That FinOps is finance policing engineers' spend, or a synonym for "reduce the bill."
**Cast**: Three figures round a table — Engineering, Finance, Product — with a shared live dashboard between them, broken down by team and feature. A smaller "Central FinOps team" figure off to the side holding a toolbox, not a gavel.
**Opening frame**: Three figures facing away from each other, each with their own disconnected spreadsheet.
**Story**:

1. Finance's spreadsheet reads "Total spend: $2M ↑," nothing further, a frustrated arrow pointing at Engineering. _"The old way: a surprise bill, then blame."_
2. The shared dashboard appears between all three, live, broken down. _"Instead: one shared, timely view."_
3. Engineering, watching their own line rise, switches a service to a cheaper tier live on screen; the dashboard updates immediately. _"Engineers own what they build — including its cost."_
4. Product points at a feature whose cost-per-user is falling even as spend grows, and green-lights expanding it. _"Spend well, not just less."_
5. The central team hands out dashboards and policy, never sitting between Engineering and a decision. _"Central team enables; it doesn't gate."_
6. A small maturity dial ticks Crawl → Walk → Run as the loop repeats across quarters.
   **The moment**: Beat 4, spend rising while cost-per-user falls and the room choosing to grow it anyway — defeats "FinOps means cut costs."
   **Interaction**: A crawl/walk/run maturity dial that relabels how automated and cross-team the scene becomes.
   **Ending**: Holds on the shared dashboard, all three figures facing it together.
   **Variants**: `finops-lifecycle`, `unit-economics`, `cost-allocation`.
   **Techniques**: contents, meter, chart, dial, caption.
   **Review**: Keep — the cost-per-user-falls-while-spend-grows beat defeats 'FinOps = cutting'; personas, principles and crawl/walk/run match the FinOps Framework.

### FinOps lifecycle: inform, optimise, operate (`finops-lifecycle`)

**The aha**: It's a loop run again and again — see where the money goes, find efficiency, put the change into practice and govern it — not a one-time project, and different teams can be at different points in the loop at once.
**Misconception to defeat**: Treating a cost-cutting sprint as finished once savings land.
**Cast**: A circular track with three arcs — Inform (magnifying glass over a bill), Optimise (a wrench over a resource), Operate (a gear with a policy shield). Several dots on the track represent different teams.
**Opening frame**: One token sitting at Inform, the track otherwise still.
**Story**:

1. The token moves through Inform: a cost dashboard lights up, an owner tag attaches to an unlabelled resource, a forecast and budget line appear. _"See what's spent, by whom, and where it's heading."_
2. It enters Optimise: a VM shrinks a size, a commitment band appears under a demand curve. _"Find the efficiency."_
3. It enters Operate: a policy and an automation lock the new size in (an auto-shutdown schedule, a tag rule). _"Make it stick, and watch for drift."_
4. The token loops back to Inform — but a second team's token already sits at Optimise, and a third at Operate. _"Different teams, different laps, same loop."_
5. Months pass (fast-forward): the track shows a cloud of tokens continuously circling, never stopping at a finish line.
   **The moment**: Beat 4, several tokens on the same track at different arcs at once, breaking the idea of a single linear project with an end.
   **Interaction**: Click any team's token to see where it sits in the loop; fast-forward months and watch the tokens never converge to a stop.
   **Ending**: Holds on the wide shot of many tokens still circling.
   **Variants**: `finops`, `rate-vs-usage-optimization`, `cost-allocation`.
   **Techniques**: lanes, token, move, restyle, boundary, caption.
   **Review**: Improved — budgeting and forecasting belong to Inform in the FinOps Framework, so beat 3 now shows policy and automation instead of a budget alert.

### Cost allocation (`cost-allocation`)

**The aha**: One big bill becomes many owned bills by tracing every cost to the team, product or environment that caused it — shared costs need an agreed split rule, or they become everybody's problem and nobody's.
**Misconception to defeat**: That tags alone do this, or that unsplit shared costs can just be ignored.
**Cast**: One large unlabelled invoice. Below it, the resource-hierarchy frames (organisation › accounts › groups › resources), each resource tile carrying a small tag. A "shared costs" pile off to the side (networking, logging, platform team, support plan), untagged.
**Opening frame**: The single invoice, "$500,000 — total," nothing beneath it yet.
**Story**:

1. The invoice's line items fly down into their tagged resources, landing inside each team's frame. _"Trace each cost to its tag."_
2. Most of the bill resolves into clean per-team totals inside their frames. _"Now it's many owned bills."_
3. The shared-costs pile stays untagged, hovering outside every frame. _"But some costs belong to everyone."_
4. Three split-rule icons appear — Even, Proportional, Fixed. Picking Proportional divides the pile into slices sized by each team's own usage, sliding into their frames. _"Agree a rule, or it stays unowned."_
5. A handful of resources were never tagged at all; they sit outside every frame in a red "unallocated" zone, a visible leftover slice of the original invoice.
   **The moment**: Beat 5, the untagged leftover sitting outside every frame, red, proving untagged spend has no owner no matter how good the rest of the split was.
   **Interaction**: Choose the split rule for shared costs and watch the slices resize into each team's frame differently.
   **Ending**: Holds with most of the invoice absorbed into frames, a small red sliver remaining as the thing still to fix.
   **Variants**: `showback-vs-chargeback`, `tagging-and-labels`, `resource-hierarchy`.
   **Techniques**: boundary, move, contents, restyle, choice, caption.
   **Review**: Improved — shared pile now includes costs that can't carry a tag (support plans), reinforcing the 'tags alone aren't enough' misconception.

### Showback vs chargeback (`showback-vs-chargeback`)

**The aha**: Both show a team its own cost; only chargeback actually moves the money into their budget — showback is always worth doing, chargeback is the optional, heavier step on top.
**Misconception to defeat**: Thinking they're the same step, or that chargeback is just "showback, but stricter."
**Cast**: A team's allocated cost tile, "$40,000 this month," flowing into two possible paths side by side: "Report" (showback) and "Ledger / Budget debit" (chargeback).
**Opening frame**: The cost tile sitting above both unlabelled paths.
**Story**:

1. Sent down the Report path: a dashboard shows the team their $40,000; their actual finance budget line is untouched. _"Showback: here's what you cost."_
2. The same tile sent down the Ledger path instead: the team's real budget line visibly debits by $40,000, a journal entry appears. _"Chargeback: and now it's billed to you."_
3. Side-by-side freeze: both teams saw the identical number, but only one team's actual spending power just shrank.
4. A wobbly split rule (from cost allocation) feeding chargeback produces an angry team pointing at the ledger. _"Get allocation right first."_
   **The moment**: Beat 3, identical numbers, only one system state actually changed — isolating exactly what "formally billed" means versus "shown."
   **Interaction**: Toggle a resource between showback-only and chargeback-on; watch whether the finance ledger entry appears.
   **Ending**: Holds on the side-by-side: one dashboard, one dashboard-plus-debited-ledger.
   **Variants**: `cost-allocation`.
   **Techniques**: path trace, contents, side by side, toggle, caption.
   **Review**: Keep — the identical-number, different-system-state comparison isolates exactly what chargeback adds.

### Unit economics (`unit-economics`)

**The aha**: A rising bill can be good news — if cost per customer falls while the total grows with revenue, you're scaling efficiently; total spend alone can't tell growth from waste.
**Misconception to defeat**: "The bill went up" automatically meaning something is wrong.
**Cast**: Two stacked charts over the same months: top, "Total cloud spend" (rising); bottom, "Cost per customer" (falling). A customer-count ticks up beside them.
**Opening frame**: Both lines flat at month 0, customer count small.
**Story**:

1. Months pass: customer count climbs, total spend climbs steeply alongside it. _"The bill is going up."_
2. An alarm flashes over the total-spend chart: "cost crisis?" _"The obvious read."_
3. Cut to cost-per-customer underneath: it's been falling the whole time — each new customer served a little cheaper (caching, shared infrastructure, commitments). _"But look per customer."_
4. Overlay both charts on the same months: spend rising, per-customer cost falling — a scissors shape. _"Growing efficiently."_
5. Contrast case: both lines rise together, same total-spend shape as before, now genuinely bad. _"Same bill shape. Different story underneath."_
   **The moment**: Beat 4's scissors — total spend and per-customer cost diverging on the same timeline — turns the one-line alarm into the fuller, true picture.
   **Interaction**: Toggle between a "scaling well" and "scaling badly" dataset; the total-spend chart looks identical in both, only the per-unit line tells them apart.
   **Ending**: Holds on the scissors overlay, labelled "efficient growth."
   **Variants**: `finops`, `cost-estimation-and-forecasting`.
   **Techniques**: chart, meter, toggle, spotlight, caption.
   **Review**: Keep — the scissors overlay plus the identical-total toggle is the sharpest contrast available.

### Cost estimation and forecasting (`cost-estimation-and-forecasting`)

**The aha**: Cost is a design input, estimated while the architecture is still cheap to change, then forecast continuously so budgets and commitments rest on where spend is heading, not where it's been.
**Misconception to defeat**: Treating cost as something discovered after building, or a forecast as last month's number repeated.
**Cast**: Left, a blank architecture canvas being sketched (VM, database, load balancer boxes) with a running estimate total. Right, a forecast chart: an actual-spend solid line extending into a dashed projected line, a budget threshold marked.
**Opening frame**: An empty canvas, estimate total at $0.
**Story**:

1. Boxes are dragged on one at a time; the estimate climbs with each, before anything is built. _"Price the design before it's built."_
2. Swap the database for a pricier managed tier: the estimate jumps; the architect swaps back. _"Cheap to change now."_
3. Cut to the forecast chart: the solid actual line runs a few months, then a dashed line extends it using the recent trend, with a widening shaded range around it (forecasts are ranges). _"Forecast from what's really happening."_
4. A planned change (a feature launching next quarter) adds a step up partway along the dashed line. _"Fold in what's coming."_
5. The dashed line crosses the budget threshold two months out, an alert marker right at the crossing. _"See the overrun coming, not after the invoice."_
   **The moment**: Beat 5, the forecast line visibly crossing the budget line before the real spend gets there — "plan ahead" seen in advance.
   **Interaction**: Add or remove a planned future change and watch the dashed line and its crossing point move.
   **Ending**: Holds on the dashed line crossing the budget threshold, alert lit, still in the future.
   **Variants**: `total-cost-of-ownership`, `budgets-and-anomaly-alerts`.
   **Techniques**: chart, meter, dial, token, caption.
   **Review**: Improved — forecast drawn as a widening range rather than a single certain line.

### Budgets and cost anomaly alerts (`budgets-and-anomaly-alerts`)

**The aha**: A budget is an alarm, not a brake — spending keeps going past it unless something else is wired up to stop it; anomaly detection catches a sudden spike within hours instead of waiting for the invoice.
**Misconception to defeat**: Assuming a budget cap actually stops spending, the way a quota does.
**Cast**: The demand/spend chart with a horizontal "Budget: $10,000" line. A bell icon beside it. A shaded "usual pattern" band around the normal spend line, for anomaly detection.
**Opening frame**: Spend tracking comfortably under the budget line, bell quiet.
**Story**:

1. Spend climbs past the budget line; the bell rings, "80% of budget." _"An alarm fires..."_
2. Spend keeps climbing straight through the budget line, nothing resists it. _"...but nothing stops the spend."_
3. Contrast: a quota ceiling, dashed, drawn above the budget line — a request against it actually bounces red. _"That's a quota's job, not a budget's."_ Only an explicit budget action you wire up (stop resources, tighten permissions) can act.
4. The usual-pattern band around normal spend has a sharp spike punch through its ceiling — a leaked key mining cryptocurrency, an unfamiliar workload tile appearing from nowhere. _"An anomaly: not like usual."_
5. The anomaly alert fires within about a day (billing data itself lags by hours); a clock shows "~1d" beside invoice-only discovery's "30d," side by side. _"Caught in a day, not on the invoice."_
   **The moment**: Beat 2, spend sailing straight through the budget line unresisted right after the alarm rings — kills the idea that a budget enforces anything.
   **Interaction**: Set the budget threshold with a dial and watch only alert timing change, never the spend line's shape; trigger an anomaly and compare the fast alert to the slow month-end discovery.
   **Ending**: Holds on the ~1d-vs-30d side-by-side clocks.
   **Variants**: `quotas-and-limits`, `cost-and-usage-data`.
   **Techniques**: chart, meter, dial, timer, failure, side by side, caption.
   **Review**: Improved — cost data lags, so 'within the hour' was wrong (about a day); noted that budget actions are the opt-in way a budget can act.

### Cost and usage data (`cost-and-usage-data`)

**The aha**: The invoice total hides the story — line-item data, with commitments spread over the usage they covered and tags attached, is the real source of truth for allocation, showback and optimisation; FOCUS is what lets it mean the same thing across providers.
**Misconception to defeat**: That the monthly invoice total, or a dashboard's summary, is the data.
**Cast**: A single invoice line, "Total: $85,000." Below, zoomed in, a torrent of tiny line-item rows streaming past: resource id, hour, ListCost, BilledCost, EffectiveCost (FOCUS names), tags. A FOCUS stamp normalises rows from three differently-shaped provider exports.
**Opening frame**: The one-line invoice, looking complete.
**Story**:

1. Zoom into the invoice: it dissolves into thousands of hourly line-item rows streaming by. _"The real detail, line by line."_
2. One commitment-covered row shows ListCost $0.50, BilledCost $0 (the commitment is billed on its own line), EffectiveCost $0.20 (its price spread over the usage it covered), the gap shaded. _"Commitments spread over the usage they cover."_
3. Three provider logos export line items in three different shapes; FOCUS stamps and reshapes all three into one common row. _"One schema, so clouds compare."_
4. The stream feeds three downstream scenes at once: cost-allocation's frames lighting up by tag, a showback dashboard updating, a rightsizing recommendation appearing. _"Allocation, showback, optimisation: same source."_
   **The moment**: Beat 2, the same row at list, billed and effective (amortised) cost, the gap visibly shaded — makes "amortised" concrete, not an accounting term.
   **Interaction**: Filter the row stream by tag or resource and watch the downstream dashboards update from the same filtered set.
   **Ending**: Holds on the stream feeding all three downstream scenes simultaneously.
   **Variants**: `cost-allocation`, `budgets-and-anomaly-alerts`, `tagging-and-labels`.
   **Techniques**: zoom, stream, contents, meter, path trace, caption.
   **Review**: Improved — used FOCUS's real columns and showed billed cost of covered usage as zero, which is the actual reason amortised (effective) cost is needed.

## Cost optimisation levers

### Rate optimisation vs usage optimisation (`rate-vs-usage-optimization`)

**The aha**: Every cost is rate times quantity — pay less per unit, or use fewer units — and cutting usage first, then committing to the smaller baseline, beats locking a discount onto waste.
**Misconception to defeat**: That any discount or any cut is "optimisation," regardless of order.
**Cast**: An equation strip, "Cost = Rate × Usage," with a rectangle beneath it: width is Usage, height is Rate, area is total cost.
**Opening frame**: A wide, tall rectangle — high rate, high usage, large area.
**Story**:

1. A commitment lowers the rate first; the rectangle's height shrinks, area shrinks a little. _"Rate optimisation, applied first..."_
2. Reveal: a third of the width was idle or oversized resources, now shaded grey — the discount applied to that too. _"...but it just discounted the waste."_
3. Reset. This time idle and oversized resources are removed first; the width shrinks before any commitment. _"Usage optimisation first: shrink the quantity."_
4. The same commitment is applied to the now-narrower rectangle; the final area is visibly smaller than beat 2's outcome. _"Commit to the smaller, real baseline."_
5. Two final rectangles side by side: "discount-then-cut" vs "cut-then-discount" — identical operations, different order, different areas.
   **The moment**: Beat 5, the same two operations in different order producing different final areas — the exact point the concept makes.
   **Interaction**: Choose which lever to apply first and watch the final rectangle's area differ.
   **Ending**: Holds on the smaller final rectangle from "usage first."
   **Variants**: `finops-lifecycle`, `rightsizing`, `commitment-discounts`.
   **Techniques**: meter, chart, choice, spotlight, caption.
   **Review**: Keep — same two operations in opposite order giving different areas is exactly the claim.

### Rightsizing (`rightsizing`)

**The aha**: Most resources are sized for a guess, not for reality — weeks of real CPU, memory and I/O data, stepped down one size, roughly halves that line; it's continuous, because workloads change.
**Misconception to defeat**: That sizing is a one-time decision made correctly at launch.
**Cast**: A VM tile, "Size: 8 vCPU / 32 GB," CPU, memory and network meters underneath, all flat and low (CPU around 10%). A row of smaller sizes beneath it: 4 vCPU, 2 vCPU.
**Opening frame**: The 8 vCPU VM, utilisation reading a steady 8–12% over a multi-week strip.
**Story**:

1. The multi-week strip plays out, consistently low, never near capacity. _"Weeks of real data, not a guess."_
2. The VM shrinks one size, to 4 vCPU / 16 GB; utilisation rises to ~20% for the same workload and the price tag roughly halves. _"Step down one size."_
3. A second workload, genuinely spiky, occasionally touching 90%, is blocked from shrinking: "would throttle at peak." _"Size to the pattern, not just the average."_
4. Fast-forward months: the rightsized 4 vCPU VM's utilisation drifts upward as the workload grows, eventually passing what the old 8 vCPU box could have handled. _"Workloads change. Rightsizing isn't a one-time fix."_
5. The sizing recommendation re-triggers automatically at the new drift.
   **The moment**: Beat 2, the price tag visibly halving the instant the size steps down, utilisation rising to a healthier level in the same motion.
   **Interaction**: Scrub a time window (days/weeks/months) over the utilisation strip; too short a window recommends the wrong size, showing why enough data matters.
   **Ending**: Holds on the fast-forward drift, a new recommendation lighting up.
   **Variants**: `instance-types-and-sizes`, `cost-of-idle`, `autoscaling-for-cost`.
   **Techniques**: meter, chart, restyle, failure, caption.
   **Review**: Improved — 'Large/Medium' are not vCPU counts on any cloud, so sizes now read 8 to 4 vCPU; added memory and network meters (CPU alone gives the wrong size).

### Cost of idle and orphaned resources (`cost-of-idle`)

**The aha**: You pay for what's allocated, not what's used, and nothing reminds you it's there — idle VMs, unattached disks, old snapshots and forgotten test environments are the biggest, easiest waste to remove once tags show who can delete them.
**Misconception to defeat**: Assuming unused things are already free, or that someone would notice.
**Cast**: A room of tiles: a dark VM with no request tokens for weeks, a disk with no VM attached, a stack of old snapshot cards, an unused IP, a load balancer with nothing behind it, a VM tagged "test-env-mike." Each has its own coin meter, all quietly ticking.
**Opening frame**: All tiles present, every meter slowly rising, no activity tokens anywhere.
**Story**:

1. Time-lapse a month: every meter has climbed, several into a visible coin stack, despite zero tokens crossing any tile. _"Allocated. Not used. Billed anyway."_
2. Spotlight the unattached disk: its parent VM was deleted weeks ago; the disk never knew, and its meter never stopped. _"Orphaned: outlived the thing it belonged to."_
3. Spotlight "test-env-mike": a message pings Mike, "still need this?" No reply for days; the meter keeps rising. _"A tag means someone can be asked."_
4. An untagged tile has no owner to ping at all; it just keeps ticking, unaddressed. _"No owner, no conversation, no end."_
5. Mike finally replies "delete it"; the tile disappears, its meter freezes, struck through in the group's monthly total.
   **The moment**: Beat 1's time-lapse — a month of climbing meters with not one request token ever crossing the screen — the cleanest picture of "paid for, never used."
   **Interaction**: Click any idle tile to see how long it's been idle and who, if anyone, is tagged to answer for it; delete it and watch the meter freeze.
   **Ending**: Holds on the group's total bill shrinking visibly after cleanup.
   **Variants**: `rightsizing`, `tagging-and-labels`, `storage-tiering-for-cost`, `pay-as-you-go`.
   **Techniques**: meter, spotlight, timer, contents, failure, caption.
   **Review**: Keep — a month of climbing meters with no request tokens crossing the screen is the cleanest picture of the idea.

### Scheduling non-production off (`schedule-non-prod-off`)

**The aha**: A week has 168 hours and a working week about 50 — switching dev and test off outside working hours cuts their compute bill by about 70% with no change to the architecture, if nothing else (disks, commitments) keeps billing.
**Misconception to defeat**: That "it's just a dev box" means it costs little regardless of whether it's ever stopped.
**Cast**: A Monday-to-Sunday time strip with a shaded "working hours" band (8am–6pm, Mon–Fri, 50 hours). A non-prod VM tile above it with a coin meter and a small disk meter. A schedule rule: "Stop 6pm–8am, weekends."
**Opening frame**: The week strip, the VM running (lit, ticking) across the entire width, shaded and unshaded alike.
**Story**:

1. A full week plays with the VM always on; the meter climbs steadily; the final total reads "168 coin-hours."
2. Reset. Apply the schedule rule: every time the strip leaves the shaded band, the VM dims and its meter freezes; every re-entry relights it. _"Off outside the hours anyone's using it."_
3. The same week plays again; the meter only climbs during shaded bands; the final total reads "~50 coin-hours," side by side with beat 1's. _"Same dev box. Under a third of the bill."_
4. An engineer logging in at 11pm hits "wake it up"; the VM relights briefly outside its schedule, then returns to the rule afterward. _"Override when you need to; the rule resumes after."_
5. Catch: the stopped VM's disk meter keeps ticking, and a commitment covering this VM is still paid in full while it sleeps. _"Stopped compute stops; the rest doesn't. Schedule first, then commit."_
   **The moment**: Beat 3's side-by-side totals, "168" versus "~50" for the literal same box over the literal same week — the ~70% saving as a direct read, not a claimed statistic.
   **Interaction**: Drag the shaded working-hours band wider or narrower and watch the weekly total recompute.
   **Ending**: Holds on the two totals side by side, the gap between them highlighted.
   **Variants**: `autoscaling-for-cost`, `cost-of-idle`, `pay-as-you-go`.
   **Techniques**: chart, timer, meter, restyle, side by side, dial, caption.
   **Review**: Improved — made the numbers consistent (8-6 weekdays is 50 hours, saving about 70%) and added the catch that disks and commitments still bill.

### Autoscaling for cost (`autoscaling-for-cost`)

**The aha**: Provisioning for peak means paying for peak around the clock — the gap between flat peak-sized capacity and the real demand curve underneath is waste, and the savings come specifically from scaling back in, which deserves as much care as scaling out.
**Misconception to defeat**: Thinking autoscaling for cost is mainly about scaling up fast enough; the money is in scaling down.
**Cast**: The shared demand curve along the bottom with a flat "capacity" line above it. A coin meter tracks spend proportional to the shaded area under the capacity line, not the demand line.
**Opening frame**: Capacity flat at the day's peak, demand dipping low under it most of the day; the gap shaded grey, meter running fast.
**Story**:

1. The grey gap (capacity minus demand) fills most of the chart. _"Provisioned for peak, all day."_
2. Autoscaling switches on: capacity hugs the demand curve, rising and falling with it; the grey gap collapses to almost nothing. _"Capacity follows demand."_
3. Demand rises sharply; capacity follows promptly, no stalled requests. _"Scaling out is the easy half."_
4. Demand falls back just as sharply; capacity lags this time, staying high before finally stepping down — the grey gap briefly reappears. _"Scaling in needs just as much care."_
5. A tightened scale-in rule (shorter cooldown) replays the same fall; capacity now tracks down almost immediately, the gap barely appears. _"The savings live in scaling down fast and safely."_
   **The moment**: Beats 4–5, the same demand drop, one with a lagging scale-in leaving a lingering grey gap, one tracking straight down — isolates where the real savings come from.
   **Interaction**: A scale-in cooldown dial; shorten it and watch the grey waste gap shrink on every demand drop; shorten it too far and a brief dip makes capacity flap down and back up, so the cooldown has a floor.
   **Ending**: Holds on the tight scale-in run, capacity and demand nearly overlapping all day.
   **Variants**: fundamentals' `elasticity-vs-scalability`; `rightsizing`, `schedule-non-prod-off`.
   **Techniques**: chart, meter, dial, boundary, caption.
   **Review**: Improved — the dial now also shows the downside (flapping) so 'scale in fast' reads as 'fast but safe'.

### Storage tiering for cost (`storage-tiering-for-cost`)

**The aha**: Cold tiers are cheap to keep but expensive and slow to read, so the right tier depends on how often data is actually read, not how much there is or how important it feels — deleting data you don't need beats any tier.
**Misconception to defeat**: "Important data stays hot, old data goes cold," and colder is always cheaper.
**Cast**: Shelves at growing distance — Hot, Cool, Cold, Archive — each tagged "store $/GB" and "read $/GB," with a lifecycle-rule conveyor belt ageing files from shelf to shelf. A delete bin sits beside the belt.
**Opening frame**: A pile of files all on the Hot shelf, a monthly bill split into storage and read costs.
**Story**:

1. The conveyor belt switches on: files age by date, nudging automatically Hot → Cool → Cold → Archive over months, untouched by hand. _"A rule, not a chore."_
2. A heavily-read file (`logo.png`) gets nudged to Cool anyway, purely by age; its read-cost bar balloons as it keeps being fetched there at the higher per-read price. _"Age isn't the same as access pattern."_
3. An exception is added — "frequently-read files stay Hot regardless of age" — `logo.png` snaps back, its read-cost bar shrinking. Auto-tiering (S3 Intelligent-Tiering, Cloud Storage Autoclass) is shown doing the same by access. _"Tier by reads, not by birthday."_
4. An old tax file reaches Archive; a request for it hits a closed door, a "rehydrating" timer spins for hours, then a retrieval fee lands. _"Cheap to keep, costly and slow to fetch back."_
5. A batch of genuinely unneeded files drops straight into the delete bin instead of ageing down shelf by shelf; their bill stops, unless they were in a cold tier under its minimum stay (30 to 180 days), when an early-deletion charge lands. _"Not needed? Delete beats every tier."_
   **The moment**: Beat 2, a "cheaper" shelf producing a bigger total cost for a frequently-read file — the exact trap the misconception sets.
   **Interaction**: A "reads per month" dial on one file; the cheapest valid shelf lights up as the dial moves, including the delete bin at zero future reads.
   **Ending**: Holds on the dial at zero future reads, the delete bin glowing as the obviously cheapest choice.
   **Variants**: data's `object-storage`, `storage-lifecycle-policies`; `cost-of-idle`.
   **Techniques**: contents, move, meter, timer, dial, caption.
   **Review**: Improved — added minimum-duration and early-deletion fees (so delete isn't always instantly free) and the access-based auto-tiering alternative.

## Frameworks, adoption and provider promises

### Well-Architected pillars (`well-architected-pillars`)

**The aha**: The pillars pull against each other — more redundancy is more reliable and more expensive — so a well-architected design is a set of explicit, reviewed trade-offs for this workload's needs, not the maximum of everything at once.
**Misconception to defeat**: That "well-architected" means maxing out every pillar.
**Cast**: A radar chart with axes for Operational excellence, Security, Reliability, Performance, Cost optimisation, Sustainability (AWS's six; Azure's framework has five and folds sustainability in). Outward on an axis is better. A workload tile in the middle whose shape can be dragged.
**Opening frame**: A small, timid shape near the centre, every axis low and equal.
**Story**:

1. Drag Reliability's axis out to max: the shape stretches that way — and Cost optimisation's axis is pulled inward, automatically (more copies, more spend). _"Pull one pillar out..."_
2. Drag Cost optimisation back out to save money: Reliability snaps back in too (fewer redundant copies). _"...and another one moves."_
3. Two example workloads: a payments ledger, pulled hard toward Reliability and Security with Cost optimisation pulled in, "justified here"; an internal reporting tool, modest and balanced, "doesn't need the max." _"The right shape depends on the workload."_
4. A reviewer's checklist appears beside each shape: "Why this trade-off? Documented." _"Reviewed and explicit, not accidental."_
   **The moment**: Beats 1–2, dragging one axis and watching another move with it, unscriptable to ignore — the whole idea made physical.
   **Interaction**: Drag any axis and watch the shape and the others respond; try to max every axis at once and watch the Cost optimisation axis collapse to zero instead.
   **Ending**: Holds on the payments-ledger shape, deliberately lopsided, labelled "by design."
   **Variants**: `cloud-provider-sla`, `composite-sla`; each pillar's own area (reliability, security, scaling, observability).
   **Techniques**: meter, dial, side by side, caption.
   **Review**: Improved — on a radar chart 'cost' is better when high, so pulling Reliability out must pull Cost optimisation in (the old plan had it stretching); named which framework has six pillars.

### Cloud adoption framework (`cloud-adoption-framework`)

**The aha**: Moving to the cloud is an organisational change, not just a technical move — skills, operating model, governance and finance must change alongside the workloads, or the migration stalls no matter how good the architecture is.
**Misconception to defeat**: That adoption is "migrate the servers" and everything else follows automatically.
**Cast**: A road with Azure's CAF phases — Strategy, Plan, Ready (a landing zone being built), Adopt, Govern, Secure, Manage. Beside it, AWS's six CAF perspectives as lanes (Google's framework groups them as Learn, Lead, Scale, Secure): Business, People, Governance, Platform, Security, Operations, each with its own progress marker.
**Opening frame**: The Platform lane's marker far ahead of the rest, who sit at zero.
**Story**:

1. Workloads migrate down the road past Adopt while the People lane (skills, training) sits untouched. _"Tech moves fast..."_
2. A migrated workload arrives but stalls; nobody's trained to operate it, the Operations lane hasn't moved. A red "stalled" flag appears. _"...without the rest, it stalls."_
3. Rewind: this time all six lanes advance together, roughly in step, as the road's milestones pass. _"Adoption is all six lanes, together."_
4. The Governance lane reaching Ready unlocks workloads flowing smoothly past Adopt without the stall flag.
   **The moment**: Beat 2's stall flag, a perfectly migrated workload failing anyway because only one lane moved — the technical move was necessary but not sufficient.
   **Interaction**: Drag any lane's marker ahead of or behind the others and see whether workloads crossing Adopt stall.
   **Ending**: Holds on all six lanes level, workloads crossing cleanly.
   **Variants**: `landing-zone`, `well-architected-pillars`, `migration-strategies-7rs`.
   **Techniques**: lanes, chart, move, failure, dial, caption.
   **Review**: Improved — labelled which provider's framework the road and the lanes come from, since combining them unlabelled implies one standard.

### Migration strategies (the 7 Rs) (`migration-strategies-7rs`)

**The aha**: Each application gets its own R based on its value, risk and effort, and large migrations mostly rehost or replatform first, modernising afterward — refactoring during the move is the slowest, riskiest path.
**Misconception to defeat**: That one strategy fits the whole estate, or that refactoring on the way is "the proper way" to migrate.
**Cast**: A row of application tiles (a legacy monolith, an old test tool, a steady batch job, a growth product, a commercial CRM, a VMware cluster) above a sorting chute with seven bins: Retire, Retain, Rehost, Relocate, Repurchase, Replatform, Refactor, ordered roughly by rising effort.
**Opening frame**: All tiles unsorted above the chute, each with a tiny value/risk/effort readout.
**Story**:

1. The unused test tool drops into Retire. _"No value: turn it off."_
2. The steady, compliance-bound workload drops into Retain. _"Leave it where it is."_
3. The legacy monolith, under time pressure, drops into Rehost, lifted as-is onto new infrastructure. _"Lift and shift: fast, low risk, same code."_
4. The VMware cluster drops into Relocate, moved as-is to a cloud-hosted VMware service, VMs untouched. _"Relocate: move the platform, not the apps."_
5. The commercial CRM drops into Repurchase, swapped for a SaaS equivalent entirely. _"Buy, don't move."_
6. The growth product drops into Replatform first (a managed database swapped in) — then, months later, into Refactor, re-architected into smaller services. _"Modernise after landing, not during the move."_
7. A ghost version of the same growth product attempts Refactor directly during the original migration: the chute jams, its timeline stretching far longer than any other app's. _"Refactoring during the move: usually slowest, riskiest."_
   **The moment**: Beats 5–6, the same app modernised in two passes versus attempted in one slow, jammed pass — "sequence, not ambition."
   **Interaction**: Drag any app tile toward a bin for a one-line justification of whether that's a sensible fit.
   **Ending**: Holds on the growth product's two-pass timeline, shorter combined than the jammed single-pass ghost.
   **Variants**: `cloud-adoption-framework`; architecture's strangler fig and modernisation patterns.
   **Techniques**: contents, choice, move, timer, side by side, caption.
   **Review**: Improved — Relocate was in the chute but never shown; added a VMware cluster and beat for it, and hedged the refactor claim.

### Data gravity (`data-gravity`)

**The aha**: Large datasets pull applications toward them because moving data is slow and costly — the more it accumulates, the harder it is to move, so the data should usually decide where the compute runs, not the other way round.
**Misconception to defeat**: Thinking of data and compute as independently placeable, with distance a minor detail.
**Cast**: A growing sphere of data cards sitting in Region A. Application tiles orbit it at varying distances, each with a latency readout. A second region, Region B, far off, empty.
**Opening frame**: A modest data mass in Region A, one application orbiting close, latency low.
**Story**:

1. The data mass grows over a fast-forwarded year, visibly larger. _"Data accumulates."_
2. A new application is planned for Region B near new users instead; a token fetches what it needs from the Region A mass, a long trip, a coin dropping per GB each time. _"Pull the app away, and every request pays the toll."_
3. Moving the whole mass to Region B instead is costed: 10 PB over a 1 Gbps link is about 2.5 years (100 TB takes 9 days, 1 PB about 3 months), the link straining and glowing. _"Move the data instead? At this size, the network can't."_
4. A physical transfer-appliance icon (Azure Data Box, AWS Snowball) appears as the practical option, moving the mass offline between regions over weeks instead of years. _"At large enough scale, shipping disks beats the wire."_
5. The new application relocates to orbit Region A instead, latency dropping to near zero, no more coins.
   **The moment**: Beat 3's transfer-time estimate, "years," flatly stated for moving data that size over the network — makes gravity a hard physical fact, not a metaphor.
   **Interaction**: Grow the data mass with a dial and watch the network-transfer-time estimate climb non-linearly, crossing from feasible to "ship a truck instead."
   **Ending**: Holds on the application relocated next to the data mass, latency and egress both at zero.
   **Variants**: fundamentals' `vendor-lock-in`, `choosing-a-region`; `data-transfer-costs`.
   **Techniques**: meter, token, dial, timer, move, caption.
   **Review**: Improved — made the transfer-time claim checkable with real arithmetic and named the appliances; fixed 'key-value cards' which implied a database type.

### Provider SLAs (`cloud-provider-sla`)

**The aha**: An SLA is a refund promise, not an uptime guarantee — credits are a small slice of the bill, it covers only what's written, and the headline numbers usually require you to deploy redundantly yourself.
**Misconception to defeat**: Believing "99.99% SLA" means the service won't go down, or that it covers your actual availability.
**Cast**: A service tile with an "SLA: 99.9%" badge, a bill beside it with a tiny "credit" slice. A fine-print scroll: "applies only if deployed across zones."
**Opening frame**: The service tile running, SLA badge prominent, bill at full price.
**Story**:

1. The service goes down for an hour within a 30-day month, a downtime strip filling a sliver of it: 99.86%, under the 99.9% promise. _"An outage happens."_
2. A claim is filed (you must ask); the refund is a small credit slice, typically 10% of that service's monthly charge, applied to a later bill, nowhere near the hour's business cost. _"The SLA pays a credit, not your losses."_
3. The fine-print scroll unrolls: "99.99% requires multi-zone deployment." The viewer's own deployment is a single-zone Azure VM; the badge dims and re-reads "99.9% (your actual configuration)." _"The headline number has conditions."_
4. A separate "your own SLO" meter, set by the team, tracks actual measured uptime beside the provider's badge; the two numbers visibly diverge over the month. _"Your availability is your design's job."_
   **The moment**: Beat 3, the badge itself changing value when the fine print meets the viewer's real deployment — collapsing the gap between the marketing number and what it actually promises.
   **Interaction**: Toggle the deployment between single-zone and multi-zone and watch which SLA tier applies.
   **Ending**: Holds on the two meters side by side: provider SLA badge and the team's own measured SLO.
   **Variants**: `composite-sla`; reliability's SLI/SLO/error budgets.
   **Techniques**: meter, failure, contents, toggle, side by side, caption.
   **Review**: Improved — made the outage arithmetic explicit (1 hour is 99.86%), showed that credits are claimed, small and not cash, and grounded the single-vs-zone example in Azure VMs.

### Composite SLA (`composite-sla`)

**The aha**: Every dependency in a chain lowers the workload's total availability (multiply the chain's numbers), while independent redundant copies raise it (multiply their failure chances); you can never promise more than your weakest chain allows.
**Misconception to defeat**: Assuming the workload's availability equals its main or highest-SLA component.
**Cast**: Three service tiles in a chain, each badged 99.9%. Below, the same tile drawn twice side by side, as redundant copies instead of a chain.
**Opening frame**: The three-tile chain, a question mark over its overall number.
**Story**:

1. The three numbers multiply visibly (0.999 × 0.999 × 0.999 ticking through), landing at 99.7% — lower than any single link. _"In series: multiply down."_
2. A fourth dependency, one nobody thought was "part of the system," is added; the total drops further (99.6%). _"Every link you depend on counts."_
3. Switch scene: the same component twice, redundant and independent, now their failure chances multiply instead (0.001 × 0.001 = 0.000001), giving 99.9999% on paper. Then a shared dependency (same zone, one load balancer in front) joins them and the number collapses back toward 99.9%. _"In parallel: failure chances multiply — if they fail independently."_
4. A chain of three is rebuilt with one link duplicated in parallel; the overall number recomputes higher than the plain chain (99.80% vs 99.70%), lower than the fully-redundant ideal.
   **The moment**: Beat 1, watching the three familiar 99.9% badges multiply down to a worse 99.7% total live — defeats "just take the highest/main SLA" on the spot.
   **Interaction**: Add or remove links from the chain, and toggle any link between single and redundant-parallel, watching the composite number recompute each time.
   **Ending**: Holds on the mixed topology's final number, between the plain chain's and the fully redundant ideal's.
   **Variants**: `cloud-provider-sla`; reliability's redundancy and failover concepts.
   **Techniques**: chart, meter, side by side, dial, caption.
   **Review**: Improved — the parallel example used 99% components inside a 99.9% scene; rebuilt it on 99.9% badges and added the independence caveat, which is where real redundancy math goes wrong.

### Cloud sustainability and carbon awareness (`cloud-sustainability`)

**The aha**: The greenest resource is the one you don't run, so most cost optimisation is also carbon optimisation — but not identically, since a cheap region can sit on a dirty grid, and flexible work can shift to cleaner regions or hours.
**Misconception to defeat**: Assuming cost-optimised and carbon-optimised always mean the same thing, or that sustainability is entirely the provider's job.
**Cast**: The responsibility stack split in two: "Sustainability of the cloud" (grey, provider: efficient data centres, renewable power) and "Sustainability in the cloud" (blue, customer: utilisation, rightsizing, what's kept, when and where it runs). A world map with regions tinted by grid carbon intensity, and a day/night carbon-intensity wave over one region.
**Opening frame**: The responsibility stack split cleanly in two, both halves calm.
**Story**:

1. Zoom into the grey half: a data centre's efficiency meter, a renewable-power contract badge. _"The provider's half: how clean the facility is. A contract isn't the grid at that hour."_
2. Zoom into the blue half: an idle VM's coin meter ticks right beside a new carbon meter also ticking. _"Waste is carbon too, not just cost."_
3. The world map lights up, tinted by each local grid's carbon intensity (not by energy contracts): a cheap region sits on a grid tinted dark grey; a pricier region nearby sits on a green-tinted grid. _"Cheap and clean aren't the same map."_
4. A flexible batch job shifts its run time along the day/night carbon wave, landing on the greenest hour. _"Flexible work can shift to the cleanest hour."_
5. The same job also relocates to the green-tinted region instead of the cheap grey one, at a slightly higher price. _"Or the cleanest region, at a cost trade-off."_
   **The moment**: Beat 3, the price tag and the carbon tint pointing in opposite directions on the same map — the moment that separates "cheap" from "clean."
   **Interaction**: A time-of-day dial shows the carbon wave and lets a flexible job's run time be dragged onto it; a region picker shows price and carbon tint together.
   **Ending**: Holds on the batch job in its greenest hour and region, cost and carbon meters displayed together.
   **Variants**: `cost-of-idle`, `rightsizing`, `choosing-a-region`.
   **Techniques**: boundary, meter, chart, dial, zoom, caption.
   **Review**: Improved — separated grid carbon intensity from renewable-energy contracts, a common greenwashing gap, in the captions.
