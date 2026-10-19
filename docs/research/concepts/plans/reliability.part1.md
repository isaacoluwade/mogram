# Reliability plans, part 1

Stage 2 plans for groups 1–5 of [the reliability catalog](../catalog/reliability.md); groups 6–12
are in part 2. Shared visual language: services are rounded boxes with a small health dot (green,
amber, red); requests are dots travelling along arrows, and a failed request turns red and bursts;
clients sit on the left; zones and regions are framed areas; a failure is a red flash and the
element greying out; time-based ideas use a timeline strip along the bottom with a moving playhead;
availability and error numbers are small meters; a circuit breaker is a switch on the arrow.

One technique is added to the vocabulary: **metaphor**, a physical analogy drawn beside the
system (a ball between two valleys, a ship's watertight compartments), used only where the
analogy carries the idea better than the system can. Part 2 adds **span** and **rewind**; plans
here that replay the same failure with one thing changed list rewind too.

## 1. Foundations: vocabulary and availability math

### Availability vs reliability vs resilience (`availability-reliability-resilience`)

**The aha**: Availability asks "does it answer?", reliability asks "is the answer right, and in time?", and resilience is what keeps both true while parts break.

**Misconception to defeat**: "Up" means "working", and all three words just mean uptime.

**Cast**: A client on the left; an "Orders" service on the right drawn as a frame around two instances, A and B, each with a health dot. Requests are blue dots; each response returns carrying a tick, or a red cross for a wrong answer. Two meters top right: "Available" (share of requests answered) and "Reliable" (share answered correctly and in time).

**Opening frame**: Requests flowing to both instances, every response a tick, both meters at 100%.

**Story**:

1. Instance A starts returning a wrong total: one response in five comes back as "total: £0". Every health dot stays green. Available holds at 100%; Reliable drops to 80%. Caption: "Up, but wrong."
2. Fix that. Now A answers some requests in 9 seconds; the client's patience ring empties first and the late answer bursts on arrival. Reliable dips again; Available doesn't move. Caption: "Up, but too slow to use."
3. Kill instance A: red flash, grey. Nothing reroutes, so half the requests burst against the dead box. Both meters fall. Caption: "Not resilient."
4. Rewind and kill A again. This time traffic shifts to B within a second; both meters dip and refill. Caption: "Resilient: parts break, the meters hold."

**The moment**: Beat 1, frozen: a green health dot beside a "£0" answer. The dashboard says up; the user says broken.

**Interaction**: Fault buttons ("Wrong answers", "Slow down A", "Kill A") and a failover toggle. Wrong and slow answers move only Reliable; a kill moves both, and the toggle decides whether it moves them for more than a second.

**Ending**: Both meters full, the three words stacked beside them: "Available: it answers. Reliable: it answers right, in time. Resilient: it keeps doing both while parts break."

**Variants**: `durability-vs-availability`, `nines-of-availability`, `gray-failure`, `sli-slo-sla`.

**Techniques**: token, meter, restyle, timer, failure, rewind, toggle, choice, caption.

**Review**: Improved — the interaction claimed each fault moves a different meter, but wrong and slow answers both move only Reliable; it now says so, and lists rewind. The system framing beats a restaurant metaphor here because the green health dot beside a "£0" answer is the point.

### Durability vs availability (`durability-vs-availability`)

**The aha**: Durability is "will my data still exist?"; availability is "can I reach it right now?"; each can fail while the other holds.

**Misconception to defeat**: "Eleven nines of durability" means the storage is always up; or a store that always answers can't lose data.

**Cast**: A client on the left; a storage service on the right drawn as a front door (an API box with a health dot) with three zones behind it (framed areas), each holding a copy of "photo.jpg" as a small document icon. The service's label, as a typical object store publishes it: "durability 99.999999999% · availability 99.99%". Two meters: "Durable: does the photo exist?" and "Available: can I fetch it?".

**Opening frame**: A read travels to the front door, one copy answers, the photo returns. Both meters full. Caption: "Two numbers, seven nines apart."

**Story**:

1. The front door fails: red flash, grey. Reads burst with "503". Available drops to 0. Caption: "Can't reach it."
2. Zoom through the dead front door: all three copies sit intact, glowing. Durable stays at 100%. The eleven nines pulse and gain a note: "store 10 million objects, expect to lose one every 10,000 years. Nothing about uptime." Caption: "Every copy is safe. Nobody can reach them."
3. Cut to a second store: one copy on one disk, behind a front door that never goes down. Reads succeed; Available 100%.
4. The disk fails (red flash) and is swapped within seconds; the front door stays green throughout. The next read returns "404: not found". Available is back at 100%; Durable drops to 0 and stays there. Caption: "Back up in seconds. The photo is gone for good."

**The moment**: The two stores side by side at their worst: intact copies nobody can reach, and a green front door returning 404. The two meters point opposite ways.

**Interaction**: Buttons "Lose the front door" and "Lose a disk", and a copies dial (1, 2, 3, or "3 in one zone"). With three copies in separate zones, losing a disk never moves Durable; with "3 in one zone", losing the zone does. Losing the front door always moves Available, never Durable.

**Ending**: Both meters, each with a card: "Durability, bought with: copies across failure domains, checksums, erasure coding." "Availability, bought with: redundant front doors, zones, failover." Caption: "Measured differently, bought differently. You need both."

**Variants**: `availability-reliability-resilience`, `replication-is-not-backup`, `fault-domains`, `nines-of-availability`; `erasure-coding`, `storage-redundancy-levels` (data).

**Techniques**: zoom, contents, boundary, token, failure, meter, side by side, dial, choice, caption.

**Review**: Improved — merged Data's plan in: the service now carries both published numbers (eleven nines of durability, four of availability), which defeats the misconception in the opening frame; the eleven nines get a concrete meaning (one object in 10 million every 10,000 years, S3's own gloss); the ending gains Data's "bought with" cards. Kept this plan's second store, the green front door returning 404, which Data's lacks and which shows the other direction.

### The nines and downtime budgets (`nines-of-availability`)

**The aha**: Each extra nine cuts the allowed downtime tenfold, and by four or five nines there isn't time for a person to respond.

**Misconception to defeat**: 99.9% and 99.99% are "basically the same", so each nine is a small step.

**Cast**: A long horizontal bar for one year, Jan to Dec, filled green; downtime is a red slice. A grey "human response" bar drawn at the same scale: page, wake, log in, diagnose, fix, about 30 minutes. A small cost meter on the right.

**Opening frame**: The year bar at 99%: a red block of 3.65 days, clearly visible. Caption: "99%: 3.7 days down a year."

**Story**:

1. The red block splits into ten equal pieces; nine turn green. Caption: "99.9%: 8.8 hours a year." The cost meter climbs a step.
2. The remaining sliver is now too thin to see, so zoom into it until it is as wide as the first block was (a scale label reads "now showing 8.8 hours"). It splits into ten; nine turn green. Caption: "99.99%: 53 minutes." The cost meter climbs a bigger step.
3. Zoom and split once more. Caption: "99.999%: 5 minutes a year." The cost steps keep growing.
4. Stack the three slices as rows, each drawn the same width at its own zoom, and lay the human bar against each one at the matching scale. At 99.9% it's a sliver: 17 incidents fit. At 99.99% it fills more than half: one incident fits, a second overruns the year. At 99.999% it is almost six times longer than the slice and juts out, flashing. Caption: "No time for a person."
5. Swap in an "automatic failover: 30 s" bar. It fits inside the five-nines slice ten times. Caption: "At this level, recovery has to be automatic."

**The moment**: The human bar overhanging the five-nines slice like a plank too long for its shelf.

**Interaction**: A nines dial (90% to 99.999%) showing downtime per year, month and week; a "time to recover" slider showing how many incidents fit in each budget.

**Ending**: The ladder of rows, each a tenth of the one above, with a 30-day month beside each year: 99% 3.7 days (7.2 hours), 99.9% 8.8 hours (43 minutes), 99.99% 53 minutes (4.3 minutes), 99.999% 5 minutes (26 seconds). The human bar is ruled across all of them.

**Variants**: `error-budget`, `sli-slo-sla`, `composite-availability`, `mttr-mtbf-mttd`, `self-healing`.

**Techniques**: meter, zoom, restyle, move, lanes, dial, caption.

**Review**: Improved — fixed "two incidents use the year" at four nines (53 minutes holds one 30-minute incident; the second overruns) and added the monthly figures, which are what SLO windows use. Checked: 8.76 h, 52.6 min, 5.26 min a year; 17 incidents fit at three nines; 30 s fits ten times in five nines. The tenfold zoom beats a plain table because each nine visibly costs the same tenfold cut.

### Composite availability: serial vs parallel (`composite-availability`)

**The aha**: Chained dependencies pile up their downtime, so your ceiling sits below every part's; only redundant copies raise it, and only when they fail at different times.

**Misconception to defeat**: The whole system is about as available as the average, or the weakest, of its parts.

**Cast**: A client on the left, then a chain of three boxes: "Web 99.9%", "API 99.9%", "DB 99.9%". Under each box, its own year bar: green, with red slices for its outages scattered at different dates. Under the chain, an empty "end to end" year bar and a meter.

**Opening frame**: The chain and its three year bars, each with about nine hours of red at different places in the year.

**Story**:

1. A request travels the chain; the DB greys for a moment and the request bursts. Caption: "Any link down, the request fails."
2. The red slices fall out of all three bars onto the end-to-end bar, each landing at its own date. It ends up with three times the red. Meter: 99.7%, with the sum written under it: "0.999 × 0.999 × 0.999". A ghost label "average or weakest part: 99.9%" appears and is struck through. Caption: "In series, multiply."
3. Add two more dependencies; more red falls in. Meter: 99.5%. Caption: "Every hard dependency lowers your ceiling."
4. New scene: two copies of "DB 99%" side by side, both feeding the end-to-end bar. Their red slices sit at different dates, and red falls through only where both bars are red at the same moment: almost nowhere. Meter: 99.99%, written "1 − (0.01 × 0.01)". Caption: "In parallel, both must fail at once."
5. The copies now share a power feed: copy B's slices slide along until they line up with copy A's, and all the red falls through. Meter back to 99%. Caption: "Only if they fail at different times."

**The moment**: The two drops compared: in series every slice falls through; in parallel only the overlaps do.

**Interaction**: Add or remove dependencies, double any box, set each box's availability with a dial, and flip a "shared power" toggle for the copies. The sum under the meter rewrites itself as the diagram changes.

**Ending**: The original chain with the DB doubled; the meter reads about 99.8%. Caption: "In series, multiply the availabilities. In parallel, multiply the chances of failing. Only independent copies raise the ceiling."

**Variants**: `nines-of-availability`, `correlated-failure`, `single-point-of-failure`, `critical-vs-noncritical-dependencies`.

**Techniques**: lanes, move, meter, token, failure, side by side, toggle, dial, caption.

**Review**: Improved — the arithmetic now appears under the meter as the slices fall (a product in series, 1 − the product of the failure chances in parallel), so the picture teaches the formula; the ghost label covers "the weakest part" too, which the misconception names; the ending caption says exactly what multiplies. Checked: 0.999³ ≈ 99.7%, 0.999⁵ ≈ 99.5%, 1 − 0.01² = 99.99%, and 99.9% × 99.9% × (1 − 0.001²) ≈ 99.8%.

### Single point of failure (SPOF) (`single-point-of-failure`)

**The aha**: Trace a request end to end and ask of each thing "if only this dies, does everything stop?"; the answer is often something nobody drew.

**Misconception to defeat**: "We doubled the servers, so there's no single point of failure."

**Cast**: Clients on the left, a load balancer, three app servers, a database primary with a replica. Request dots flow through. A crosshair cursor (the "kill test") that visits each element. Badges: green "survives", red "SPOF".

**Opening frame**: The architecture as a team would draw it. Caption: "Looks redundant."

**Story**:

1. A path trace lights one request's route end to end.
2. The crosshair kills an app server: red flash, grey. Traffic flows to the other two. Badge: "survives". It kills the database primary: the replica takes over. "Survives."
3. It kills the load balancer. Every request bursts. Badge: "SPOF". Caption: "If only this dies, everything stops."
4. Restore. Dashed outlines fade in for things nobody drew: a config store all three app servers read on every request, a single DNS provider, one TLS certificate ("expires 3 Mar"), and a person icon, "only Sam has the admin password". The traced route now runs through each of them.
5. Kill the config store. All three "redundant" app servers start failing in the same frame. Badge: "SPOF". The expired certificate and the DNS provider follow, quickly.
6. Each SPOF gains a partner: a second load balancer, a second DNS provider, certificate auto-renewal, a second admin. The dashed boxes turn solid.

**The moment**: Beat 5: three app servers dying together because they share a config store that wasn't on the diagram.

**Interaction**: Click any element to kill it and see its badge; a "show what nobody drew" toggle.

**Ending**: The full diagram, every badge green. Caption: "Draw everything a request touches. Kill each, one at a time." A smaller caption: "A bottleneck slows everything; a SPOF stops it."

**Variants**: `redundancy-n-plus-1`, `correlated-failure`, `failure-mode-analysis`, `composite-availability`.

**Techniques**: path trace, failure, choice, appear / disappear, restyle, token, toggle, caption.

**Review**: Improved — the config store was read "at start-up", so killing it would not have stopped running servers; it is now read on every request, which makes beat 5 true. Weighed a pure kill-each-box checklist; the invisible, undrawn dependencies (config, DNS, certificate, one person) are the real lesson and stay as the turn.

### Redundancy: N, N+1, N+2, 2N (`redundancy-n-plus-1`)

**The aha**: Redundancy counts capacity, not boxes: it only works if the survivors can carry the load.

**Misconception to defeat**: Two servers means redundant, however busy they are.

**Cast**: Clients on the left feeding a stream labelled "peak: 120". Servers drawn as boxes, each holding a tank-style load gauge with a line at 100%; each server can carry 100.

**Opening frame**: Two servers, each tank 60% full. Caption: "Two servers. Redundant?"

**Story**:

1. Kill server 1: red flash, grey. Its stream swings to server 2. Slow down as the level rises past the line and overflows; requests burst; server 2 flashes red. Caption: "The survivor would need 120%. Two is N: just enough."
2. Three servers at 40%. Kill one; the other two rise to 60%. Caption: "N+1: survives one failure."
3. Still three. A wrench takes one down for patching; the other two sit at 60%. Then one of them fails, and the last needs 120%: overflow. Caption: "But not a failure during maintenance."
4. Four servers at 30%. Patch one, lose another: the two left run at 60%. Caption: "N+2: survives a failure during maintenance."
5. Two framed sets of two, each set able to carry the whole peak alone. Set A fails entirely; set B rises to 60% per server. Caption: "2N: a complete second copy."

**The moment**: Beat 1: the overflowing tank. The spare server dies from the very load it was there to absorb.

**Interaction**: Dials for server count and peak load; click servers to kill or patch them. The tanks show whether the survivors fit the peak.

**Ending**: Four rows (N, N+1, N+2, 2N), each labelled with what it survives (nothing, one failure, a failure during maintenance, a whole side) and what it costs in servers: 2, 3, 4, 4 here. A note: "2N matches N+2 only at this size; as N grows, 2N costs double, and is what survives losing a whole site." Caption: "Count the capacity left after the failure."

**Variants**: `static-stability`, `multi-az-deployment`, `cascading-failure`; autoscaling (scaling).

**Techniques**: meter, stream, failure, boundary, lanes, dial, choice, caption.

**Review**: Improved — added the cost per row and the note that 2N equals N+2 only at four servers, so viewers don't read 2N as "the same as N+2". Checked every gauge: two at 60% leave a survivor needing 120%; three at 40% become 60% after one loss; four at 30% become 60% after two. The overflowing tank beats a table of formulas.

### Correlated failures (`correlated-failure`)

**The aha**: Copies that share something fail together: three replicas with the same bad config are one replica.

**Misconception to defeat**: Three replicas means three independent chances to stay up.

**Cast**: A load balancer and three replica boxes. Under each replica hangs a short stack of tags: rack, zone, software version, config version, certificate expiry. A meter: "independent copies".

**Opening frame**: Three green replicas, every tag stack identical: "Rack 4 · Zone A · v2.3 · config #81 · cert exp 3 Mar". Meter: 3.

**Story**:

1. The "Rack 4" tag lights up on all three and a line ties them together. Rack 4 loses power: one red flash, and all three grey at once. The meter falls to 1 and the three boxes fuse into one outline. Caption: "Shared rack: one failure."
2. Spread them: tags change to Racks 4, 7, 9 and Zones A, B, C. Fail Rack 4: one replica greys, two serve. Caption: "Different racks, different fates."
3. A config push "#82 (bad)" leaves the config store as three tokens, reaching all three replicas at the same moment. All three crash together, on three racks in three zones. The "#82" tags glow as the shared thread. Caption: "Same change everywhere, same failure everywhere."
4. Replay as a staged push: #82 reaches one replica, it crashes, the push stops. Two stay green. Caption: "Change one at a time."
5. One more shared tag: the certificate. The playhead on the timeline reaches 3 Mar and all three fail together. The tags change to staggered expiries with auto-renewal.

**The moment**: The meter falling from 3 to 1 the instant a shared tag lights, as three boxes fuse into one.

**Interaction**: Toggles for what the replicas share (rack, zone, version, config, certificate) and a button to fail each shared thing. The meter counts truly independent copies.

**Ending**: Three replicas with every tag different; the staged push left one red and two green. Caption: "Three copies count as three only when nothing makes them fail together."

**Variants**: `fault-domains`, `single-point-of-failure`, `composite-availability`, `blast-radius`; canary (delivery).

**Techniques**: contents, spotlight, restyle, failure, token, meter, lanes, toggle, choice, caption.

**Review**: Keep — the tag stack makes the hidden sharing visible and the meter falling from 3 to 1 is the memorable moment; it also ties back to `composite-availability` (copies multiply only when independent). The shared software version and certificate cover the failures that spreading across racks and zones can't fix.

### Fault domains and update domains (`fault-domains`)

**The aha**: Where you place copies decides what you survive: spread across racks and you survive a rack; across zones and you survive a zone.

**Misconception to defeat**: Any three copies are safe; or "fault domain" just means availability zone.

**Cast**: Nested framed areas: a region holding zones A, B and C; each zone holding racks (tall boxes with a power icon); each rack holding hosts. Three replicas as squares of one colour. Update domains as faint numbered stripes (UD 0, 1, 2) running across the hosts.

**Opening frame**: The nested frames, labelled from the inside out: "host, rack, zone, region: things that fail together."

**Story**:

1. All three replicas on one host. The host fails (red flash); all three grey. Caption: "Spread across nothing."
2. Three hosts in one rack. The rack's power fails: the rack frame flashes and everything inside greys. Caption: "A rack failure still gets them all."
3. Three racks in zone A. A rack fails: one replica lost, two serve. Then all of zone A goes dark: all three lost. Caption: "Survives a rack, not a zone."
4. One rack in each of three zones. Zone A fails: one lost. Caption: "The domain you spread across decides what you survive."
5. Planned maintenance: a highlight sweeps through UD 0, then 1, then 2, rebooting the hosts it covers. Replicas all in UD 0 reboot together; spread across UD 0, 1 and 2, only one is down at a time. Caption: "Update domains: the same rule for planned downtime."

**The moment**: The failure frame growing with each step (host, rack, zone) while the replicas hop one level wider, always just out of its reach.

**Interaction**: Drag replicas onto hosts, then press "fail host", "fail rack", "fail zone" or "run maintenance" and count the survivors.

**Ending**: One replica per zone, each in a different update domain, beside a summary: "Across racks: survive a rack. Across zones: survive a zone. Across update domains: survive maintenance."

**Variants**: `correlated-failure`, `multi-az-deployment`, `multi-region-deployment`; Azure availability sets and zones (platform files).

**Techniques**: boundary, move, failure, spotlight, restyle, choice, caption.

**Review**: Keep — the widening failure frame with the replicas always one level wider is a clear escalation and answers "fault domain just means zone" directly. Update domains are Azure's term (AWS and Kubernetes do the same with rolling updates and disruption budgets), and the plan already frames it as "the same rule for planned downtime".

### Blast radius (`blast-radius`)

**The aha**: You can't prevent every failure, but you choose how far each one spreads.

**Misconception to defeat**: Reliability means preventing failures; or blast radius is the same as severity.

**Cast**: A grid of 100 small user dots on the left, each wired to what serves it; the service area on the right. A failure drawn as a red ring expanding from where it starts. A meter: "users affected".

**Opening frame**: One big service serving all 100 users, every dot green.

**Story**:

1. A bad deploy lands. The ring expands from the service and nothing stops it; all 100 users turn red. Meter: 100. Caption: "One service, one blast."
2. Same users, same capacity, now split into four framed cells of 25 users each. The same bad deploy goes to cell 2 first. The ring expands and stops at the cell wall, which flashes as it holds. Meter: 25.
3. Twenty cells, and the deploy goes to one cell first. The ring stops at a cell of 5; the rollout halts. Meter: 5. Caption: "Same failure. Smaller blast."
4. Spotlight the walls in turn, each labelled: "zones", "cells", "bulkheads", "staged rollout". Caption: "Each of these exists to shrink this number."
5. One red user dot zooms to show "can't check out" beside the meter. Caption: "Severity: how bad. Blast radius: how many."
6. The same ring, drawn around a stolen credential instead of a bad deploy, hits the same walls: separate accounts, narrow scopes. Caption: "Faults and attackers spread the same way."

**The moment**: The same ring, replayed three times, hitting a wall sooner each time, while the meter reads 100, 25, 5.

**Interaction**: A cells dial (1 to 20) and a "first rollout stage" dial; press "bad deploy" and read the meter.

**Ending**: Twenty cells, one red, 95 users green. Caption: "You didn't stop the failure. You chose how far it went."

**Variants**: `cell-based-architecture`, `bulkhead`, `shuffle-sharding`, `multi-az-deployment`; canary (delivery); the security reading (a stolen credential) is beat 6.

**Techniques**: boundary, failure, restyle, meter, spotlight, zoom, dial, caption.

**Review**: Improved — beat 2 said the deploy "lands in cell 2" with no reason it skips the others; it now goes to cell 2 first, which is what a staged rollout means. Borrowed Security's reading (the same ring around a stolen credential, stopped by separate accounts and narrow scopes) as a closing beat, so one plan serves both areas. The 100, 25, 5 replay beats a single diagram because the number is the lesson.

### Failure mode analysis (FMA) (`failure-mode-analysis`)

**The aha**: Reliability design starts by asking "how will this break, and what will users see?", and ends in a ranked list of risks to design for and test.

**Misconception to defeat**: Reliability means adding replicas everywhere; or failure analysis is something you do after an outage.

**Cast**: A checkout flow across the top: Browser, CDN, API, Payments, Database, and a Card processor outside a dashed boundary (external). Below it, an empty worksheet: Component | How it fails | Likelihood | Users see | Detect | Mitigate.

**Opening frame**: The flow and the empty worksheet. Caption: "Before building: how will checkout break?"

**Story**:

1. The tempting shortcut first: every box gets a second copy and a cost meter climbs, but a red question mark stays on the card-processor link. Caption: "Replicas everywhere? Not yet." Undo.
2. A checkout request is traced along the flow.
3. Spotlight the API. Failure cards fan out of it: "crash", "overload", "bad config", "zone loss". Each card slides into the worksheet as a row, its "Users see" cell filling in ("error at Pay").
4. The spotlight moves on: Database ("primary fails", "slow queries"), Card processor ("times out", "returns errors"), CDN ("certificate expires"). The worksheet grows.
5. Each row gets likelihood and impact scores, and the rows physically re-sort by risk. Top of the list: "Card processor slow: checkout hangs". Caption: "Rank by what users would see."
6. Mitigations pin to the top three rows and onto the diagram: a timeout and circuit breaker on the processor link, failover on the database, auto-renewal on the certificate.

**The moment**: The re-sort in beat 5, landing at the top a risk that no replica would have fixed.

**Interaction**: Click any component to open its failure cards; drag a row's likelihood and watch the ranking change.

**Ending**: The flow with three mitigations pinned, beside the ranked list. Caption: "A ranked list to design for, and to test." An arrow points on to `chaos-engineering`.

**Variants**: `chaos-engineering`, `fault-injection`, `single-point-of-failure`, `critical-vs-noncritical-dependencies`, `blameless-postmortem` (the after-the-fact cousin).

**Techniques**: path trace, spotlight, appear / disappear, contents, move, meter, choice, dial, caption.

**Review**: Keep — the shortcut-then-undo in beat 1 states the misconception, and the re-sort landing a risk no replica would fix (a slow third party) at the top is the right moment. Matches the Azure Well-Architected failure-mode-analysis method (components, failure modes, likelihood, impact, detection, mitigation).

## 2. How things fail

### Failure modes: crash, omission, slow, wrong (`failure-modes`)

**The aha**: A crash is the friendly failure; the dangerous ones keep answering, so good designs turn them into crashes.

**Misconception to defeat**: Failure means the server is down.

**Cast**: Four lanes, one per mode, each with a client on the left, a service box with a health dot, and a monitor eye above the box. Under each lane, a "time to notice" timer.

**Opening frame**: Four identical healthy lanes, labelled down the side Crash, Omission, Slow, Wrong, with an arrow beside them: "harder to detect".

**Story**:

1. Crash: the box flashes red and greys; requests bounce off at once; the health dot is red; the load balancer routes around it. The timer stops at 2 s. Caption: "Crash: obvious, quick to route around."
2. Omission: the box stays green; one request in ten fades out mid-arrow and never comes back. The eye sees nothing; the timer keeps running. Caption: "Drops some. Passes its checks."
3. Slow: the box stays green; dots crawl; the clients' patience rings empty. The timer runs into minutes. Caption: "Answers. Eventually."
4. Wrong: the box stays green and answers promptly, but some answers carry a corrupted value (a jagged dot, "balance: −£4,000") that travels on into the next service. The timer runs into days. Caption: "Looks perfect. Is wrong."
5. In the slow and wrong lanes, a self-check appears inside the box: a watchdog stopwatch, a checksum. When it trips, the process exits on purpose: red flash, grey, routed around within seconds, exactly like lane 1. Their timers stop. Caption: "Turn bad answers into crashes."

**The moment**: Lane 4 against lane 1: a green box sending a fast, wrong answer onward, beside a crashed box already routed around. Then the slow and wrong lanes choosing to crash.

**Interaction**: Pick a mode for one service and see which monitors notice and how long they take; a "self-check" toggle converts it into a crash.

**Ending**: Four lanes, all routed around, every timer stopped at seconds. Caption: "The crash is the failure you want."

**Variants**: `gray-failure`, `slow-is-the-new-down`, `fail-fast`, `partial-failure`.

**Techniques**: lanes, token, failure, timer, restyle, toggle, choice, caption.

**Review**: Keep — four lanes against a shared "harder to detect" arrow makes the ranking visible at once, and ending with the self-check turning slow and wrong into a crash gives the design lesson (fail fast). The "time to notice" timers are illustrative, not measured, and should read as such.

### Partial failure (`partial-failure`)

**The aha**: A timed-out call has a third outcome besides success and failure: unknown.

**Misconception to defeat**: A call either worked or it didn't.

**Cast**: A Shop service on the left; a Payments service on the right with a ledger inside. One request dot, "charge £50". Five stations marked along the round trip: send, deliver, process, reply, reply delivered. A stopwatch on the Shop. A curtain that can drop over everything right of the Shop.

**Opening frame**: The request waiting at the Shop, the five stations labelled, the ledger empty.

**Story**:

1. Happy path: the dot passes all five stations; the ledger gains "£50 charged"; the reply returns; the Shop shows a tick. Caption: "Success."
2. The curtain drops. From now on we see only what the Shop sees.
3. Two runs play side by side behind the curtain. In each, the dot leaves and nothing returns; both stopwatches run out; both Shops show "?". Caption: "From here, identical."
4. The curtain lifts on both runs. Run 1: the dot burst on the way out; the ledger is empty. Run 2: the ledger says "£50 charged", and it was the reply that burst on the way back. Caption: "Same timeout. Different truth."
5. The Shop must choose. Retry: run 2's ledger gains a second £50. Don't retry: run 1's order is never paid. Caption: "Retry and maybe charge twice; don't, and maybe lose the order."

**The moment**: The curtain lifting in beat 5: two identical question marks over two different ledgers.

**Interaction**: Click any station to cut the call there. Wherever it's cut after leaving the Shop, the Shop sees the same "?", while the ledger shows what really happened.

**Ending**: Three outcome tiles, Success, Failure and Unknown, the last one largest. Caption: "Every network call has three outcomes." An arrow points on to `idempotency-key`.

**Variants**: `idempotency-key`, `timeouts`, `retry-backoff-jitter`, `gray-failure`.

**Techniques**: token, exchange, contents, failure, timer, spotlight, side by side, choice, caption.

**Review**: Improved — beats 3 and 4 were the same animation twice; the two runs now play side by side behind the curtain, so "identical" is seen rather than told and the story is a beat shorter. Weighed a lost-letter metaphor; the ledger beside the Shop shows the unknowable thing directly.

### Gray failure (`gray-failure`)

**The aha**: Your monitoring and your users can disagree; judge health from the client's side and act on it, for example by draining the zone.

**Misconception to defeat**: Green health checks mean a healthy service.

**Cast**: Clients on the left; a load balancer; three zones (framed A, B, C) with two hosts each. A health checker sends small probe dots to "/health" on each host along dotted lines. Two dashboards: "Health checks" (a dot per host) and "What clients see" (an error meter per zone).

**Opening frame**: Probes and requests both flowing; both dashboards green.

**Story**:

1. Zone B's network starts dropping 5% of real requests: now and then a request dot bursts inside B. The probe dots, small and quick, keep coming back green. Caption: "Something's wrong in B."
2. The screen splits. Left, "What monitoring sees": every host green. Right, "What users see": zone B's error meter at 5%, red. Caption: "Differential observability."
3. The load balancer trusts its probes and keeps sending a third of the traffic to B. The errors continue.
4. B's client-side error meter crosses its threshold. Automation drains B: the arrows into it fade, traffic spreads over A and C, their gauges rise a little, and B's error meter falls to zero. Caption: "Act on what users see: drain first, diagnose later."

**The moment**: Beat 2, slowed down: a probe dot sailing through B untouched while a real request beside it bursts.

**Interaction**: A toggle between the monitor's view and the user's view of the same moment, and a "Drain zone B" button.

**Ending**: B drained and labelled "drained, investigating", its health-check dots still green. Caption: "It still passes its health check."

**Variants**: `region-evacuation`, `shallow-vs-deep-health-checks`, `failure-modes`, `partial-failure`.

**Techniques**: boundary, token, side by side, toggle, meter, spotlight, restyle, caption.

**Review**: Keep — the probe dot sailing through while a real request bursts beside it is the sharpest picture of differential observability (the term from the Microsoft Research gray-failure paper, which is also where "act on the client's view" comes from). Draining on client-side error rate with headroom elsewhere is correct; `region-evacuation` covers the bigger version.

### Fail-slow: slow is the new down (`slow-is-the-new-down`)

**The aha**: A dead dependency fails fast; a slow one holds your threads until you run out and go down too.

**Misconception to defeat**: Slow is better than down, and slowness is only a latency problem.

**Cast**: Two rows with the same set-up: clients on the left; an API service with a pool of 10 thread slots drawn inside it; a database on the right. A request lights a slot amber while it waits on the database. Neither API sets a timeout shorter than 30 s. Each API has a pool meter and a health dot, and also serves "/profile", which never touches the database.

**Opening frame**: Both rows healthy: requests take a slot for 50 ms and give it back; both pools at 2/10.

**Story**:

1. Top row: the database dies (red flash, grey). Calls fail in a millisecond, slots free at once, and the API returns quick errors for orders while still serving /profile. The pool stays at 2/10. Caption: "Dead: fails in a millisecond."
2. Bottom row: the database turns slow (amber, 30-second answers). Each order request takes a slot and holds it. Slots fill one by one: 4, 7, 10.
3. Slow motion as the last slot fills. A /profile request arrives, needing no database at all, finds no free slot, and bursts. The API's dot goes red. Caption: "Slow: holds your threads until you're out."
4. The bottom API is now slow to its own callers, and the clients' slots begin filling too. The amber spreads left. Caption: "Slowness spreads."

**The moment**: Both rows frozen together: the API whose dependency died is green; the API whose dependency is alive but slow is down.

**Interaction**: A latency dial for the database (1 ms to 30 s) and a kill toggle. The pool meter climbs with latency; killing the database barely moves it.

**Ending**: Top green, bottom red. Caption: "Slow is the new down." An arrow points on to `timeouts`.

**Variants**: `timeouts`, `bulkhead`, `circuit-breaker`, `cascading-failure`.

**Techniques**: side by side, contents, token, meter, timer, failure, dial, toggle, caption.

**Review**: Improved — the rows only differ if no short timeout exists, which the cast now states (otherwise `timeouts` is the fix, and the arrow at the end points there). The /profile request that needs no database but still dies is the right moment: slowness takes away what the failing part never touched.

## 3. Overload and how failure spreads

### Cascading failure (`cascading-failure`)

**The aha**: Failure travels along load and dependencies, so the fixes are the ones that stop it spreading.

**Misconception to defeat**: A big outage is many things breaking independently, or all at once.

**Cast**: Clients on the left; a load balancer; four servers, each with a load gauge and a 100% line; a database behind them. A timeline strip along the bottom where each failure leaves a mark under the moving playhead.

**Opening frame**: Four servers at 80%. Caption: "Four servers, 80% each."

**Story**:

1. Server 1 crashes: red flash, grey, first mark on the timeline. Its stream splits across the other three; their gauges climb to 107%.
2. Server 2 goes first: latency rises, its health check times out, the load balancer drops it. Slow motion on the gauge crossing the line. Second mark.
3. The last two must carry 160% each. Both tip over within seconds: marks three and four. Every request bursts.
4. The timeline zooms out: four marks spread over 50 seconds. Caption: "Not four failures. One failure, travelling."
5. The other route: the database slows (amber); the servers' requests pile up waiting on it, then the clients' do. Amber moves right to left. Caption: "It travels along dependencies too."
6. Replay with headroom: four servers at 60%. Losing one puts the rest at 80%, and the timeline gets a single mark. Replay at 80% with load shedding: survivors refuse the excess at the door (small red puffs) but stay green.

**The moment**: The two timelines stacked: four marks marching across one, a single mark on the other.

**Interaction**: A starting-load dial (40–90%), click any server to kill it, and toggles for load shedding and timeouts. Viewers find the tipping point.

**Ending**: The replay that held: one grey server, three busy green ones. Caption: "Stop the spread: headroom, timeouts, shedding, breakers, bulkheads."

**Variants**: `overload-and-goodput`, `load-shedding`, `circuit-breaker`, `bulkhead`, `slow-is-the-new-down`, `correlated-failure` (simultaneous, not spreading).

**Techniques**: meter, stream, failure, lanes, side by side, dial, toggle, choice, caption.

**Review**: Keep — the two stacked timelines (four marks against one) are the right contrast, and the numbers hold: 320% of one server's load over three is 107%, over two is 160%; four at 60% leaves 80%. Headroom is the first defence, which is why `redundancy-n-plus-1` comes before this.

### Overload and goodput collapse (`overload-and-goodput`)

**The aha**: An overloaded server that accepts everything serves almost nobody; refusing some work early keeps it serving the rest.

**Misconception to defeat**: A server busy at full throughput is doing useful work.

**Cast**: Clients on the left; a server with a queue in front (dots in a line) and a worker. Each request dot wears a patience ring that drains while it waits: the client's 2-second timeout. Two meters, "Throughput" (finished per second) and "Goodput" (finished while someone was still waiting), and a small chart of both over time.

**Opening frame**: Light load: a short queue, rings barely touched, the two meters equal.

**Story**:

1. Load rises past capacity. The queue lengthens, and rings drain further before each dot reaches the worker. Caption: "Past capacity, the queue grows."
2. A ring runs out while its dot is still queued. At the client, the waiting icon vanishes: they've given up. The dot stays in the queue as a hollow ghost.
3. Slow down: the worker picks up a ghost, works on it for the full time, and sends the answer back to an empty seat, where it fades. Caption: "Working for nobody."
4. Soon the queue is mostly ghosts. Throughput stays at maximum; goodput falls toward zero. On the chart the two lines split apart. Caption: "Busy. Useless."
5. Same load, second server: when its queue is full, new arrivals get an instant "503" that bounces back in a millisecond. Its queue is capped at what the worker can drain well inside the 2 seconds, so every dot it takes in still has time on its ring. Goodput holds at capacity. Caption: "Refuse some. Serve the rest."

**The moment**: Beat 3: the worker labouring over a ghost and posting the answer to an empty seat while the throughput meter reads 100%.

**Interaction**: An offered-load dial (50–200% of capacity) and a "refuse early" toggle; the chart traces goodput against load.

**Ending**: The final chart, load along the bottom and goodput up the side: "accept everything" climbs and then collapses; "refuse early" climbs and holds flat. Caption: "Accepting everything serves almost nobody."

**Variants**: `load-shedding`, `fail-fast`, `deadline-propagation`, `metastable-failure`, `retry-storm`.

**Techniques**: contents, timer, token, restyle, meter, chart, side by side, dial, toggle, caption.

**Review**: Improved — beat 5 said the queue was "full" without saying full of what; a queue is only a cure if its length is sized so the wait stays under the client's timeout (a long queue just breeds more ghosts), so the cap is now tied to the 2-second ring. The worker serving a ghost to an empty seat beats a plain throughput curve.

### Retry storms and retry amplification (`retry-storm`)

**The aha**: Retries multiply through layers: three tries at each of five layers is 243 calls at the bottom, landing on the service that's failing because of load.

**Misconception to defeat**: Retries are always harmless, and each layer's retry setting is its own business.

**Cast**: A chain from left to right: Client, A, B, C, D, Database. Each caller wears a badge, "tries: 3" (one try and two retries). The database has a load gauge, and under it a counter: "calls from one click".

**Opening frame**: One request crossing the chain to the database and back. Counter: 1.

**Story**:

1. A rare, random error at the database: D retries once and succeeds. Caption: "A rare failure: retry helps."
2. Now the database is overloaded, its gauge in the red. One click. D tries three times; all fail. C, seeing D fail, calls D three times, and each of those tries three more. The calls fan out like a tree, branching at every layer and thickening toward the database. Slow down so each level's branching is visible while the counter jumps: 3, 9, 27, 81, 243.
3. The whole fan lands on the gauge. Caption: "One click. 243 calls. On the thing failing from load."
4. Fix one: retry at one layer only. The badges on Client to C flip to "tries: 1"; only D keeps 3. The tree collapses to three branches. Counter: 3.
5. Fix two: a retry budget on D, drawn as a small bucket that refills with successes and allows retries up to 10% of traffic. During the overload the bucket runs dry and retries stop.
6. Fix three: the database answers "overloaded, back off", and callers pause instead of retrying.

**The moment**: The tree unfolding in beat 2 as the counter races to 243.

**Interaction**: Dials for tries per layer (1–5) and number of layers (1–6); the counter shows tries to the power of layers (4 tries over 5 layers is 1,024). A "retry budget" toggle.

**Ending**: Side by side: the 243-branch tree, and a single-layer retry inside a budget averaging at most 1.1 calls per click. Caption: "Retry at one layer, within a budget, and back off when told."

**Variants**: `retry-backoff-jitter`, `thundering-herd`, `metastable-failure`, `circuit-breaker`, `load-shedding`.

**Techniques**: token, clone, path trace, meter, contents, side by side, dial, toggle, caption.

**Review**: Improved — "retries: 3" was ambiguous: three retries make four attempts and 1,024 calls, not 243. The badge now reads "tries: 3" and the interaction shows the 1,024 case. Checked the budget: retries capped at 10% of traffic means at most 1.1 calls per click (the SRE-book rule). The unfolding tree is better than a formula.

### Thundering herd (`thundering-herd`)

**The aha**: Synchronisation is the enemy: load a service handles easily over a minute flattens it when it all arrives in one second.

**Misconception to defeat**: A herd is about too much traffic.

**Cast**: A column of clients on the left (each icon stands for 100, 6,000 in all); one service with a capacity of 300 requests a second. Above, a histogram of arrivals per second with capacity drawn as a dashed line. A timeline strip with a playhead along the bottom.

**Opening frame**: Requests spread evenly across the minute; the histogram is a low, flat band well under the line. Caption: "6,000 requests a minute. Easy."

**Story**:

1. The service blips for 10 seconds (red flash) and drops all 6,000 connections at once. Every client's reconnect timer shows the same "retry in 5 s".
2. The playhead reaches 15 s: all 6,000 requests arrive in the same second. The histogram becomes one tall spike far above the line, and the service falls over again. Caption: "Same load. All at once."
3. They all wait 5 seconds again, and the spike repeats. The service never gets up.
4. Two insets show other herds: a popular cache key expiring so every request misses together, and a job scheduled at 00:00 on every host.
5. Add jitter: each client's timer shows a different random wait. Slow down as the spike melts sideways into a wide, low hump under the line. The area of the shape stays the same. Caption: "Same total. Different shape."
6. In the cache inset, a thousand identical misses merge into a single request to the database while the rest wait for its answer.

**The moment**: The spike melting into a hump in beat 5, visibly the same area, sinking beneath the capacity line.

**Interaction**: A jitter dial (0–30 s) that reshapes the histogram live (6,000 clients over 30 s is 200 a second, under the 300 line; over 10 s it still overshoots), and a "coalesce" toggle for the cache inset.

**Ending**: The low hump under the line, the service green. Caption: "Don't reduce the load. De-synchronise it."

**Variants**: `retry-backoff-jitter`, `retry-storm`, `metastable-failure`; cache stampede (scaling).

**Techniques**: chart, lanes, timer, token, failure, restyle, dial, toggle, caption.

**Review**: Improved — the numbers disagreed: a 10-second blip strands about 1,000 requests, not 6,000. It now drops 6,000 connections, so all of them retry together, and the jitter dial states the spread needed to get under the line. Spike-to-hump with the area unchanged is the right moment; jitter belongs here and in `retry-backoff-jitter`, with the herd as the problem.

### Metastable failure (`metastable-failure`)

**The aha**: Removing the trigger doesn't end the outage, because a feedback loop keeps the load above capacity; you have to break the loop.

**Misconception to defeat**: Once the spike passes, the system recovers on its own.

**Cast**: Clients on the left; a service with a capacity line; a loop arrow curving from the service back to the clients, labelled "timeouts become retries". Organic requests are blue dots, retries orange. A chart below of organic load, total load, capacity and goodput. Beside it, a landscape with two valleys, "healthy" and "stuck", and a ball resting in "healthy".

**Opening frame**: Load at 70% of capacity, everything green, the ball in the healthy valley. Caption: "Fine for months at 70%."

**Story**:

1. A switch labelled "trigger" flips on: a 20-second spike. Total load crosses capacity; some requests time out.
2. Timed-out requests come back round the loop as orange retries: more load, more timeouts, more retries. The loop arrow thickens. The ball is shoved up the hill.
3. The trigger flips off. On the chart, organic load drops back to 70%, but total load stays at 130%, held up by the orange stream. Goodput is near zero. The ball tips over the crest and settles in "stuck". Caption: "Trigger gone. Outage isn't."
4. Hold. Nothing changes; the chart runs flat and high. Caption: "The same load it handled yesterday."
5. Break the loop: shed load and pause retries, shown as scissors cutting the loop arrow. Total load drops below capacity, timeouts stop, and the ball rolls back over the hill into "healthy".
6. Retries return under a budget; the loop stays thin.

**The moment**: Beat 3: the trigger switching off while the chart stays high and the ball stays in the bad valley. Same input, two stable states.

**Interaction**: A trigger button with a duration dial (short triggers recover by themselves; long ones get stuck), a retries toggle, and a "shed 30%" button.

**Ending**: The whole chart (calm, spike, long plateau, cut, recovery) with the ball home. Caption: "Break the loop to get back."

**Variants**: `retry-storm`, `cascading-failure`, `load-shedding`, `thundering-herd`; cache stampede (scaling).

**Techniques**: chart, stream, token, path trace, metaphor (new), toggle, dial, caption.

**Review**: Keep — the two-valley ball is the one place the analogy beats the system, because it shows two stable states for the same input; the chart under it proves the same thing with real quantities. Retries are the commonest sustaining loop (others: cold caches, GC pauses, queue backlogs), and the plan names its loop plainly. Matches the Bronson et al. definition.

### Poison pill (query of death) (`poison-pill`)

**The aha**: The input that kills one replica kills them all, so redundancy doesn't help; stop it travelling and lock it away.

**Misconception to defeat**: It's a load problem or a bad deploy, and more replicas will ride it out.

**Cast**: Clients on the left, a load balancer, four identical replicas. Normal requests are blue dots; the poison pill is a dark, jagged dot labelled "query of death". An inset on the right: a queue with one consumer. A quarantine box with a lock.

**Opening frame**: Blue dots spreading across four green replicas. Caption: "Four replicas."

**Story**:

1. The pill arrives and the load balancer sends it to replica 1. Red flash, grey.
2. The request failed, so it's retried. The pill hops to replica 2: crash. Replica 3: crash. Replica 4: crash. A path trace follows it, leaving a line of grey boxes behind. Slow down on each identical crash. Counter: "1 request, 4 crashes."
3. The replicas restart, and the retried pill takes them down again. Caption: "Same code, same input, same crash."
4. In the inset, the pill sits at the head of a queue. The consumer takes it, crashes, restarts, takes it again. Every message behind it waits.
5. Replay with defences: after two crashes tied to the same request, retries stop, and the pill is moved into the quarantine box (a dead-letter queue, for messages) and locked. One replica crashed and restarts; the other three never notice.

**The moment**: The trail of grey boxes behind the hopping pill, redundancy turned into four chances to crash; then the same pill locked away after one.

**Interaction**: "Send the pill", with toggles for a retry limit and quarantine, and a crash counter.

**Ending**: Four green replicas, the pill in its locked box, the queue flowing again. Caption: "Redundancy can't protect you from the input. Quarantine the input."

**Variants**: `shuffle-sharding`, `cell-based-architecture`, `correlated-failure`; dead-letter queue (messaging).

**Techniques**: token, path trace, failure, contents, move, toggle, side by side, caption.

**Review**: Keep — redundancy turned into four chances to crash is the memorable inversion, and the quarantine ending is the real fix. The queue inset is the same bug in messaging. Shuffle sharding (later) is the other defence, and this plan already points to it.

## 4. Resilience patterns for calls between services

### Timeouts (`timeouts`)

**The aha**: Without a timeout, one slow dependency can hold every thread you have; with one, slowness becomes a quick error you can handle.

**Misconception to defeat**: No timeout is safer because it lets slow work finish; a timeout means giving up on the work itself.

**Cast**: A client, an API service with a ten-slot thread pool drawn inside it, and a database. A latency chart above the database with marks at p50, p99 and p99.9. The API→DB arrow carries a clock badge.

**Opening frame**: Requests flowing, the database answering in 100 ms, the pool at 2/10. The arrow's clock badge reads "∞". Caption: "No timeout set."

**Story**:

1. The database's latency climbs (the chart's line rising past p99.9). Calls wait; slots turn amber one by one and don't free.
2. Slow motion as the tenth slot fills. New requests queue outside the pool and burst. The API's own health dot turns red. Caption: "One slow dependency, every thread gone."
3. Side by side: the same slowdown, but now the arrow's clock reads "400 ms", set just above the chart's p99.9 line. A call that outlives it is cut: red flash on the call itself, the slot frees at once, the API returns a quick error. Caption: "Cutting the call doesn't undo it at the database" — a small ghost dot keeps travelling on the far side, tying back to `partial-failure`.
4. A dial drags the clock across the chart: set below p50, healthy calls get cut as false failures; set far above p99.9, the pool still fills before anything trips.

**The moment**: The two pools frozen at the same instant: one fully amber and jammed, the other cycling cleanly with the occasional quick red cut.

**Interaction**: A timeout dial plotted against the latency chart, and a toggle for timeout on/off; watch the pool meter and the error rate trade off.

**Ending**: Pool healthy, clock at 400 ms. Caption: "A timeout turns hanging into a fast, handleable error." An arrow points on to `deadline-propagation`.

**Variants**: `deadline-propagation`, `circuit-breaker`, `retry-backoff-jitter`, `slow-is-the-new-down`, `partial-failure`.

**Techniques**: chart, contents, timer, meter, failure, side by side, dial, toggle, caption.

**Review**: Keep — the jammed pool beside the cycling one is the whole argument, and the dial across the latency chart teaches how to choose the number (just above p99.9 of healthy latency; a timeout below p50 would turn healthy calls into false errors). The ghost dot at the database ties the timeout to `partial-failure`: cutting the call does not undo it.

### Retries with exponential backoff and jitter (`retry-backoff-jitter`)

**The aha**: Backoff gives a struggling service room to recover; jitter turns synchronised waves of retries into a steady trickle.

**Misconception to defeat**: Retrying is always harmless, and retrying faster fixes things sooner.

**Cast**: A column of clients calling a flaky service with a load gauge. Each client has a small ladder of wait rungs (attempt 1, 2, 3…, a cap, then "give up") and a "do not retry" badge for non-transient errors.

**Opening frame**: One client, one failed call, gauge low. Caption: "A rare, transient error."

**Story**:

1. Retry with no wait: the client hammers the call every millisecond; a tight burst of red bounces off the gauge, which stays pinned high. Caption: "Retrying every millisecond."
2. Fixed backoff: wait rungs 100, 200, 400, 800 ms, doubling. The gauge gets breathing room between attempts and the call succeeds. Caption: "Backoff gives it room."
3. Now 50 clients fail together and all use the same fixed rungs: every client's wait lands on the same millisecond, so the gauge spikes at each rung in turn instead of settling. Caption: "Synced waits still hit together."
4. Full jitter: each client waits a random time between zero and its rung (rung 3: anywhere from 0 to 400 ms). Slow down as the spikes melt into a smooth, low stream and the gauge settles. Caption: "Same retries. Spread out."
5. A 400 "bad request" arrives wearing a "do not retry" badge; the retry loop skips it on sight. Caption: "Only transient errors get retried."

**The moment**: The rung-aligned spikes beside the smoothed jittered stream, same 50 clients, same failure.

**Interaction**: Toggles for backoff and jitter, and a client-count dial; watch the gauge.

**Ending**: Gauge low and steady, the call through. Caption: "Backoff recovers it. Jitter spreads the recovery out."

**Variants**: `thundering-herd`, `retry-storm`, `circuit-breaker`, `idempotency-key`, `timeouts`.

**Techniques**: timer, lanes, stream, meter, token, failure, dial, toggle, caption.

**Review**: Improved — jitter is now specified as full jitter (a random wait between zero and the doubling ceiling, the AWS Architecture Blog result that beat equal and decorrelated jitter on total calls), the ladder has a cap and a give-up rung, and the caption no longer claims "same total waiting" (full jitter halves the average wait). Weighed folding in the retry budget; it belongs in `retry-storm`, which this plan's gauge sets up.

### Idempotency keys for safe retries (`idempotency-key`)

**The aha**: The client picks one key per intended action and reuses it on every retry; the server stores each key with its result, so a retried "charge £50" returns the original answer instead of charging again.

**Misconception to defeat**: A timeout means the request didn't happen, so a retry is harmless; or the server can spot a retry by its contents (two £50 charges might be two coffees).

**Cast**: A client with a "Pay £50" button and a timer; a Payments service with a ledger and a dedup table ("key → request fingerprint, result"). Requests are envelopes carrying a coloured key tag in a header, "Idempotency-Key: abc123". A dial for "replies lost".

**Opening frame**: "Charge £50, key abc123" arrives; the ledger gains "+£50", the table stores abc123 with its result, the reply returns a tick.

**Story**:

1. Without a key: the reply is cut off mid-flight (the `partial-failure` curtain), the client sees "?" and retries. The ledger gains a second "+£50". Caption: "Same request. Charged twice."
2. Rewind. The client mints key abc123 once, before the first attempt. The server finds no row, charges, and stores "abc123 → 200, ch_1". The reply is cut off again.
3. The retry carries the same tag. The lookup hits the stored row (it glows), the ledger doesn't move, and the stored reply returns: "200, ch_1". Caption: "Same key, same answer, one charge."
4. The commonest bug: a client that mints a new key per retry. The tag changes colour, the lookup misses, the ledger shows two charges. Caption: "A new key per retry protects nothing."
5. Two edge cases, one flash each. A retry arrives while the first attempt is still running: the row is marked "in progress" and the retry gets "409 Conflict: try later". The same key reused with a different amount (£80): rejected with "422", because the stored fingerprint differs. Caption: "Same key means same request."
6. Zoom on the row's life: created on the first attempt, matched by retries, expiring after a retention window (hours to days).

**The moment**: Beat 3: the same-coloured tag on both trips, the lookup glowing, and a ledger that stays still. Beside it, beat 1's ledger at £100.

**Interaction**: A "replies lost" dial and a retry button; with the key reused the ledger stays at £50 however many replies are lost. Toggles switch "reuse key" and "new key per retry", and two extra buttons send a concurrent duplicate and a different-body duplicate.

**Ending**: One charge, one stored key, the client showing "Paid". Caption: "Doing it twice must equal doing it once." An arrow points back to `partial-failure`.

**Variants**: `partial-failure`, `retry-backoff-jitter`, `timeouts`; `idempotent-consumer`, `message-deduplication`, `webhooks` (messaging).

**Techniques**: token, contents, exchange, failure, timer, spotlight, zoom, side by side, toggle, dial, caption.

**Review**: Improved — borrowed from Messaging's plan: the new-key-per-retry bug, the stored original response (not just declining to act), the "can't tell a retry by its contents" misconception, and the lost-replies dial; added the two cases neither plan showed (a concurrent retry gets 409, the same key with a different body gets 422, as in Stripe's behaviour and the IETF Idempotency-Key header draft). Weighed a lift-button metaphor for idempotence; the double-charged ledger is the more memorable failure.

### Circuit breaker (`circuit-breaker`)

**The aha**: Stop hammering something that's down; failing fast saves your own threads and lets traffic come back by itself.

**Misconception to defeat**: A circuit breaker is just a retry limit, or once it opens the dependency is cut off for good.

**Cast**: A caller with a thread pool, a switch drawn on the arrow to a dependency (closed: green, calls flow; open: red, calls blocked locally; half-open: amber, a trickle through), and a failure counter on the switch.

**Opening frame**: Switch closed, calls flowing, dependency green.

**Story**:

1. The dependency stops answering (red flash, grey). The switch stays closed; calls still leave the caller and each waits out its 2-second timeout before bursting, filling the caller's own pool. Caption: "Closed: still hammering a dead thing."
2. The failure counter on the switch fills (five in a row, or an error rate over, say, 50% of the last 20 calls) and it flips to open: red. Calls now fail instantly inside the caller, never leaving. The pool empties. Caption: "Open: fail fast, no more hammering."
3. A cool-down timer runs under the open switch.
4. It elapses; the switch flips to half-open, amber: a few trial calls are let through as probes while the rest still fail instantly.
5. Branch: the probes succeed and the switch closes, full flow resumes; or one fails and the switch reopens, cool-down restarts. The open state also hands callers a fallback (cached or default answer) instead of a bare error.

**The moment**: The caller's pool at the same instant under two traces: jammed red behind a closed switch, versus empty beside a glowing red open one.

**Interaction**: Kill or revive the dependency; dials for the failure threshold and cool-down length; watch the switch cycle.

**Ending**: Switch closed, dependency green. Caption: "Closed, open, half-open: stop, wait, test."

**Variants**: `retry-backoff-jitter`, `bulkhead`, `fail-fast`, `slow-is-the-new-down`.

**Techniques**: restyle, contents, timer, side by side, failure, dial, toggle, caption.

**Review**: Improved — beat 1 had a dead dependency filling the pool, but a dead one fails in a millisecond (that is `slow-is-the-new-down`); it now stops answering, so each call waits out its timeout and the pool fills. Added the two common trip rules, probes in half-open (one or a few, not full traffic) and the fallback. The three-state switch on the arrow is the right picture; the electrical metaphor isn't needed.

### Bulkhead (`bulkhead`)

**The aha**: A failure should flood one compartment, not sink the ship.

**Misconception to defeat**: More servers means isolation; or a circuit breaker on the slow call is enough by itself.

**Cast**: A ship cross-section (metaphor) beside an API service with a single shared ten-slot thread pool serving two call types, "checkout" and "recommendations".

**Opening frame**: One shared pool, slots lit for both call types mixed together; the ship drawn as one open hull.

**Story**:

1. The recommendations dependency turns slow. Its calls hold slots (amber) and slowly fill the entire shared pool, including slots checkout needed. Checkout calls queue outside and burst. The ship's hull floods edge to edge and lists. Caption: "One compartment. One leak sinks it."
2. Side by side: the pool is split into two bulkheads, seven slots for checkout, three for recommendations. The ship gains a wall down the middle.
3. The same slowdown: recommendations' three slots jam, but checkout's seven stay free and keep serving. The ship's recommendations compartment floods; the wall holds; the ship lists only slightly and stays upright.
4. Caption on the holding wall: "A failure should flood one compartment, not sink the ship."

**The moment**: The ship sinking beside the ship holding steady, one flooded room, paired at the same moment.

**Interaction**: A dial splitting the pool between call types, a shared/bulkheaded toggle, and a button to slow the dependency. Idle slots in one compartment stay idle while the other queues, which is the cost of isolation.

**Ending**: Bulkheaded pool, recommendations jammed, checkout green. Caption: "Separate pools, so one dependency can't drain the rest."

**Variants**: `circuit-breaker`, `cell-based-architecture`, `slow-is-the-new-down`, `fail-fast`.

**Techniques**: metaphor, contents, boundary, failure, side by side, dial, toggle, caption.

**Review**: Improved — added the price of the bulkhead (idle slots can't be borrowed), so it doesn't look free. The ship earns its place here: the wall and the flooded room explain the name and the isolation in one glance, and the pools show the real mechanism beside it. Same story as `slow-is-the-new-down`, now with the cure.

### Fail fast and bounded queues (`fail-fast`)

**The aha**: A request that will fail should fail in a millisecond, not after holding resources for thirty seconds.

**Misconception to defeat**: Queueing everything is safer than rejecting it; fail fast is just another name for timeouts.

**Cast**: A caller, an API with a queue in front (a growing line of dots) and a memory meter, and a required dependency currently dead.

**Opening frame**: The dependency dies (red flash, grey); the queue in front of the API starts to grow.

**Story**:

1. Each new request is admitted anyway, in case the dependency returns. The queue grows: 10, 50, 200 dots; the memory meter climbs. Each one times out after 30 seconds, its patience ring draining the whole way, and only then bursts. Caption: "Thirty seconds to learn what we already knew."
2. The memory meter redlines; the API itself crashes under the weight of its own queue. Caption: "Overload became an outage."
3. Side by side: the same dead dependency, now flagged down, so new requests are rejected the instant they arrive, with a cheap error, before entering the queue. A hard cap on the queue (20) rejects anything beyond it too.
4. The queue stays small or empty; the memory meter stays flat; the API keeps answering everything else.

**The moment**: The two memory meters at the same dead dependency: one racing to redline over 30 seconds, the other flat at zero from the first second.

**Interaction**: Toggles for "reject known-down dependencies" and a queue cap, plus a cap-size dial; watch memory and time-to-error.

**Ending**: Flat meter, small queue. Caption: "Fail in a millisecond, not after holding resources for thirty seconds."

**Variants**: `circuit-breaker`, `load-shedding`, `overload-and-goodput`, `cascading-failure`.

**Techniques**: contents, meter, timer, failure, side by side, dial, toggle, caption.

**Review**: Keep — the two memory meters over the same dead dependency make the case without words. A bounded queue plus rejection of known-down calls (a breaker's job) is the right pairing; the difference from `timeouts` is that a timeout still spends the 30 seconds, which beat 1 shows.

### Deadline propagation (`deadline-propagation`)

**The aha**: Pass the remaining time budget down the call chain, so nobody keeps working on a request the caller already gave up on.

**Misconception to defeat**: A timeout at each hop adds up to the same thing as one shared deadline.

**Cast**: A chain, Client → A → B → C → D, each hop with its own local timeout badge (5 s). A budget ring, drawn once at the client, travels right with the request, shrinking as it goes.

**Opening frame**: The client sends a request carrying "5 s left"; the ring is full.

**Story**:

1. Without propagation: the client's ring empties at 5 s and the user leaves, but the request waited in a queue at each hop and A, B, C and D each started a fresh 5 s clock when they picked it up. They keep working: C is still busy at second 12, D at second 18, spending capacity on a request nobody is waiting for. Caption: "The user left. Nobody told the chain."
2. Side by side: the ring itself travels hop to hop as a shrinking label, "4.5 s… 2 s… 0 s". The moment it hits zero at any hop, that hop cancels its own work and tells the next hop not to start; a hop that sees less time left than it needs (0.4 s for a 1 s job) refuses to begin. All four boxes grey out together, in the same frame the client's ring empties.
3. Caption: "Not four timeouts. One clock, carried along."

**The moment**: Four independent clocks ticking out of sync against the single ring stopping every hop at once.

**Interaction**: Toggle propagation on or off; compare each hop's actual work time against the client's real wait.

**Ending**: The chain cancels in lockstep, capacity freed immediately. Caption: "Pass the remaining time down the chain, don't restart it at each hop."

**Variants**: `timeouts`, `overload-and-goodput`, `fail-fast`.

**Techniques**: timer, token, move, path trace, side by side, toggle, caption.

**Review**: Improved — with a 5 s timeout at every hop, nested calls all expire together near 5 s, so "C busy at 12 s" was wrong; the waste now comes from queueing plus a fresh clock at each hop's pickup, which is the real failure. Added the refuse-to-start rule. The shrinking ring is carried as time remaining, as gRPC does with its timeout header.

### Hedged requests (`hedged-requests`)

**The aha**: A little extra load buys a large cut in tail latency, because one slow replica no longer decides how slow the request is.

**Misconception to defeat**: Hedging is just a retry, or it doubles the load on the system.

**Cast**: A client and two read replicas of the same service, each with its own latency. A histogram of response times with a p95 line marked, and a long tail to its right.

**Opening frame**: The client reads from replica A only; most calls are fast, one in twenty is very slow, stacking up the histogram's tail.

**Story**:

1. A request lands on a slow instant of A; the dot crawls. The histogram's tail stretches, and the client waits the whole way.
2. Side by side, same moment: hedging is on. The client sends to A as before, but if nothing has answered by the p95 line, a duplicate is also sent to B. Whichever answers first is highlighted; the other fades, crossed through.
3. Redraw the histogram: the tail is sheared off, almost everything now finishes near p95. A small counter ticks up: "+5% calls". Caption: "5% more load buys off the tail."
4. Caution beat: hedging is tried on a write. Two identical charges land before the warning "idempotent reads only" flashes across the screen, pointing back to `idempotency-key`.

**The moment**: The sheared-off tail beside the tiny "+5%" counter, proving how cheap the trade is.

**Interaction**: A hedge-delay dial (p50 to p99) trading extra load against tail latency; toggle hedging on or off.

**Ending**: A tight histogram, small extra-load counter. Caption: "One slow replica no longer decides how slow the request is."

**Variants**: `retry-backoff-jitter` (waits for failure; hedging races ahead of it), `timeouts`, `deadline-propagation`.

**Techniques**: chart, token, clone, spotlight, side by side, dial, toggle, caption.

**Review**: Merged — owned by Scaling (plan in `scaling.part2.md`). Scaling's plan should borrow three things from this one: the caution beat (hedge only idempotent reads, never a write, pointing at `idempotency-key`), the explicit cancellation of the losing request, and the "a hedge races a reply, a retry waits for a failure" contrast. One fix for Scaling: it fires the hedge at p95 yet shows "+1% backend calls"; a p95 trigger sends about 5% extra (as here), and +1% needs a p99 trigger.

### Load shedding (`load-shedding`)

**The aha**: Serving 80% of requests well beats serving 100% badly; shed early and cheaply, and drop the least important traffic first.

**Misconception to defeat**: Shedding is the same as crashing, or it only means limiting one customer's rate.

**Cast**: A server nearing capacity with a queue; requests tagged gold ("checkout"), silver ("browse"), bronze ("analytics ping"); a goodput meter, as in `overload-and-goodput`.

**Opening frame**: All three priorities flowing, server at 70%, goodput at 100%.

**Story**:

1. Load climbs past capacity. Without shedding, every priority is still admitted and queued; goodput collapses toward zero behind a wall of ghost requests nobody is waiting for. Caption: "Accept everything, serve almost nobody."
2. Side by side: shedding on. As the server nears capacity it rejects bronze at the door with an instant, cheap error, before any work is spent — small red puffs right at entry, not after queueing.
3. Load keeps climbing; silver starts being shed too, cheaply, at the door. Gold is never shed.
4. The goodput meter for gold and silver stays flat and high even as offered load climbs far past capacity; the puffs absorb the excess. Caption: "Shed early, shed cheap, shed the least important first."

**The moment**: The flat, high goodput line beside the collapsing one, same offered-load curve underneath both.

**Interaction**: A load dial and a priority-threshold dial (shed below gold, below silver, or none); watch goodput and the shed puffs.

**Ending**: Server busy but healthy, a steady trickle of cheap rejections. Caption: "Serving fewer well beats serving everyone badly."

**Variants**: `overload-and-goodput`, `fail-fast`, `circuit-breaker`; rate limiting, throttling (scaling).

**Techniques**: contents, meter, chart, token, restyle, side by side, dial, toggle, caption.

**Review**: Merged — owned by Scaling (plan in `scaling.part3.md`). Scaling's plan is the better base (the flash-sale spike with well-behaved clients, the cost zoom, the priority-versus-random toggle). It should borrow from this one: three tiers rather than two so the viewer sees the order of shedding (least important first, the critical tier last), the cap that shedding happens before any work is spent, and the goodput meter shared with `overload-and-goodput`. Shed load should also exempt health checks and recovery traffic.

### Health checks: shallow vs deep (`shallow-vs-deep-health-checks`)

**The aha**: Shallow checks miss broken instances; deep checks can fail the whole fleet at once when a shared dependency blips.

**Misconception to defeat**: A health check just confirms the process is running, and deeper is always safer.

**Cast**: A load balancer, four instances each wired to a shared database, each wearing two badges: "shallow" (process ping) and "deep" (also checks the database).

**Opening frame**: All four green on both badges, database healthy.

**Story**:

1. Instance 2's own code deadlocks; its process still runs. The shallow badge stays green while real requests to it burst. Caption: "Shallow: still looks fine." The load balancer keeps sending it traffic.
2. Side by side, same fault: the load balancer trusts the deep badge, which also checks whether the instance can actually serve. Instance 2's deep badge goes red at once; traffic is routed around it. Caption: "Deep: checks what matters."
3. A new fault: the shared database blips for three seconds. All four deep badges, which ping it, go red together. The load balancer pulls all four out at once — a total outage, though every instance is fine. Caption: "Deep, but shared: one blip fails everyone."
4. Fix: the per-instance check keeps only what's local; the shared database is watched separately and only drains instances if it's truly dead.

**The moment**: All four badges flashing red together on one shared blip, the exact failure a better split avoids.

**Interaction**: Toggle the fault type (local deadlock vs shared blip) against shallow or deep checking; watch how many instances get pulled.

**Ending**: Four green instances, the database "watched separately". Caption: "Check what's local deeply. Treat shared dependencies differently." An arrow points on to `health-check-fail-open`, for what the balancer should do when every check fails at once anyway.

**Variants**: `gray-failure`, `health-check-fail-open`, `self-healing`; liveness and readiness probes (containers).

**Techniques**: restyle, side by side, spotlight, failure, toggle, caption.

**Review**: Improved — added the arrow to `health-check-fail-open`, since beat 3 (all four pulled together) is exactly its trigger. The two failures (a local deadlock a shallow check misses, a shared blip a deep check overreacts to) are the right pair; "local deep, shared separate" matches the AWS Builders' Library guidance on health checks.

### Failing open on health checks (`health-check-fail-open`)

**The aha**: When everything fails a check at the same moment, the check is more likely wrong than the fleet; fail open, and cap how much automation can remove at once.

**Misconception to defeat**: If health checks say everyone is unhealthy, the safe answer is to send traffic nowhere.

**Cast**: A load balancer with five targets and a "healthy targets" counter. A green "actually fine" tag quietly stays on each target as a tell that the fleet, not the check, is wrong.

**Opening frame**: 5/5 healthy, traffic flowing evenly.

**Story**:

1. A bug in the probe itself starts marking targets unhealthy one by one: 4/5, 3/5, 2/5, 1/5, 0/5, badges flipping red while each target's quiet "actually fine" tag stays lit.
2. Without fail-open, at 0/5 the load balancer obeys literally and routes to nothing. Every request bursts against an empty table. Caption: "Zero healthy targets, zero traffic sent. An outage caused by the check."
3. Side by side: the fail-open rule fires at 0/5 — route to all five anyway, as if the check didn't exist. Traffic resumes to the targets that were fine all along. Caption: "Nobody passed. Send it everywhere instead of nowhere." A footnote: real balancers act earlier, Envoy's panic threshold defaults to 50% healthy, and AWS load balancers send to all targets when none is healthy.
4. A second guard: automated replacement is capped at 20% of the fleet per cycle. A bad rollout tries to replace all five at once; the cap stops it at one and pages a person instead. Caption: "Limit what automation can do in one moment."

**The moment**: The empty routing table, every request bursting into a void, beside the fail-open table calmly serving five "unhealthy" targets that were never actually down.

**Interaction**: Toggle fail-open on or off; a "max replaced per cycle" dial; break the probe and watch the outcome.

**Ending**: Caption: "When everything fails at once, the check is probably the thing that's broken."

**Variants**: `shallow-vs-deep-health-checks`, `self-healing`, `fail-fast`.

**Techniques**: restyle, contents, meter, failure, side by side, toggle, dial, caption.

**Review**: Improved — added the footnote that real balancers fail open before zero (a panic threshold), so the 0/5 cliff isn't read as the rule. The empty table beside the calmly serving one is the right moment, and the 20%-per-cycle cap is a separate, correct guard. Fail-open only helps when the targets really are fine; the tell tags are the viewer's knowledge, which the caption says plainly.

### Self-healing and automated recovery (`self-healing`)

**The aha**: Recovery built into the platform takes seconds; recovery that waits for a person takes minutes to hours — but give the automation limits so it can't make things worse.

**Misconception to defeat**: Self-healing means the problem is fixed, not just routed around; or it's the same thing as autoscaling.

**Cast**: A fleet behind a load balancer and a small "healer" icon watching health dots. Two timeline strips, one for a human-driven recovery, one for an automated one.

**Opening frame**: All green, healer idle.

**Story**:

1. Instance 2 crashes (red, grey). Timeline A: the dot stays red while a page goes out, someone wakes, logs in, diagnoses, restarts it by hand — the strip stretches to "14 minutes", a human figure walking through each stage.
2. Side by side, timeline B: the healer sees the red dot within a couple of health-check cycles and restarts the instance itself. Strip: "40 seconds" (a few health-check cycles, then a restart).
3. A worse case: the database primary dies. Timeline A: a person promotes the replica by hand, "22 minutes". Timeline B: the healer promotes it automatically, "about a minute".
4. Caution beat: a gray failure tricks the healer into thinking five instances are unhealthy at once; it starts replacing all five. A cap (echoing `health-check-fail-open`) stops it at one, flashing "limit: 20% per cycle", and pages a person instead. Caption: "Give it limits so it can't make things worse."

**The moment**: The two timeline strips at wildly different scales, 14 minutes against 40 seconds, for the identical crash.

**Interaction**: Toggle automated healing on or off; trigger different failures and watch the timeline and the guard rail.

**Ending**: Caption: "Instances are disposable. Replace them in seconds — but cap what the healer can do alone."

**Variants**: `automatic-vs-manual-failover`, `failover`, `health-check-fail-open`, `mttr-mtbf-mttd`.

**Techniques**: lanes, timer, restyle, failure, side by side, toggle, caption.

**Review**: Improved — "8 seconds" and "12 seconds" were too quick for health-check intervals (typically 5–30 s, two or three failures to trip) and managed database failover (tens of seconds to a couple of minutes); now 40 seconds and about a minute. The gap with a person at 14 and 22 minutes is still the point, and the guard-rail beat keeps it from sounding like magic. The numbers are illustrative.

## 5. Fault isolation architecture

### Cell-based architecture (`cell-based-architecture`)

**The aha**: A bug, bad deploy or overload takes out one cell's customers instead of everyone; the routing layer has to stay simpler and more reliable than anything it routes to.

**Misconception to defeat**: Cells are just sharding, or just running more instances of the same thing.

**Cast**: A thin routing layer box at the top ("which cell is this customer in?"), and four cell boxes beneath it, each a complete stack (load balancer, app, database) serving its own fixed, coloured slice of customers.

**Opening frame**: Four cells, customers evenly coloured and routed, everything green.

**Story**:

1. First, the wrong shape: the same system drawn as one shared stack. A bad deploy lands and the whole thing greys out top to bottom; every customer dot turns red. Caption: "One system, one blast."
2. Side by side: the cells version. The identical bad deploy, rolled out one cell at a time, reaches cell 2 first and is stopped there. Cell 2's full stack greys out, its customers turn red. Cells 1, 3 and 4 stay untouched, still serving their colours. Caption: "One cell, one blast — everyone else unaffected."
3. Zoom on the routing layer, drawn thinner than any cell, labelled "must be more reliable than anything it routes to." A crack opens in it instead of a cell: every customer loses routing at once, an outage bigger than any single cell could cause. Caption: "The router is the one shared thing left."

**The moment**: One cell greying out as a complete block beside three cells still green and serving, same bad deploy, wildly different reach.

**Interaction**: Click a cell to break it (bad deploy, overload); toggle between "one shared system" and "cells" for the identical fault.

**Ending**: One grey cell, three green, the routing layer thin and solid. Caption: "Complete, independent copies that share nothing."

**Variants**: `blast-radius`, `shuffle-sharding`, `bulkhead`, `multi-region-deployment`.

**Techniques**: boundary, contents, failure, spotlight, side by side, choice, caption.

**Review**: Improved — the bad deploy hit cell 2 "alone" with no reason; cells get changes one at a time, so the deploy now stops at the first cell, which is how a cell turns into a rollout stage. The router crack in beat 3 is the honest cost and stays. Beyond sharding: each cell is a complete, independent copy, which is why a cell's database isn't shared.

### Shuffle sharding (`shuffle-sharding`)

**The aha**: Plain sharding puts a noisy customer's neighbours in the same failure; shuffle sharding makes it very unlikely any other customer shares both of its workers.

**Misconception to defeat**: Shuffle sharding is just sharding with extra randomness, or more workers alone means more isolation.

**Cast**: Eight worker boxes in a row; 40 customer tokens, each wired to a pair of workers by two lines.

**Opening frame**: Plain sharding: customers grouped into fixed blocks of two workers (customers 1–10 on workers 1, 2; 11–20 on 3, 4; and so on). All green.

**Story**:

1. One customer in the 1,2 block sends a poisonous query (as in `poison-pill`); it kills workers 1 and 2. Every other customer in that block of ten loses service too. Caption: "Plain sharding: share a block, share its fate."
2. Side by side: shuffle sharding. Each customer gets a random pair drawn from all eight workers instead of a fixed block — the lines below the row look tangled rather than neatly blocked.
3. The same poisonous customer, now assigned workers {3, 7}, kills them. Highlight every other customer who also holds both 3 and 7: a scattered handful, not a block. A counter compares the two: "Plain sharding: 10 customers hit. Shuffle sharding: 2" (8 choose 2 is 28 pairs, so about 1.4 other customers share any pair). A customer sharing only one of the two workers survives: its client retries on its other worker. Caption: "Only a customer sharing both workers is hit, and that's rare."

**The moment**: The same eight-worker grid, two highlighted blasts side by side: a clean block of ten red dots against two scattered ones lost in a sea of green.

**Interaction**: Dials for worker count and workers per customer, recomputing how many combinations exist; click a customer to poison its workers and count who's hit.

**Ending**: The dial turned up: 100 workers, 5 each, is 75 million combinations (Route 53 uses 4 of 2,048, about 7 trillion). Caption: "Spread each customer's risk thin, and across a different combination than its neighbours."

**Variants**: `cell-based-architecture`, `poison-pill`, `correlated-failure`.

**Techniques**: contents, path trace, spotlight, meter, side by side, dial, choice, caption.

**Review**: Improved — made the combinatorics checkable (40 customers, 28 pairs, so 10 hit against about 2), added why customers sharing just one worker survive (they retry on the other), and the dial to real scale (C(100,5) = 75,287,520; Route 53's 4 of 2,048 gives about 7.3 trillion). Eight workers alone looks like a modest gain; the dial is what makes the aha land.

### Static stability (`static-stability`)

**The aha**: Recovery that has to launch instances, call APIs or change DNS during a failure depends on things that may be failing too; pre-provision so nothing has to happen.

**Misconception to defeat**: As long as autoscaling can add capacity fast enough, spare capacity sitting idle is waste.

**Cast**: Three zones, each running instances enough for 60% of peak load, with a utilisation gauge; a "control plane" cloud icon off to the side (launch instance, change DNS record) with its own health dot.

**Opening frame**: Three zones sharing the peak, each carrying a third of it: gauges at 56% (a third of peak on capacity for 60%). Caption: "Capacity for a lost zone, already running."

**Story**:

1. Zone B fails (red flash, grey). Its load shifts instantly to A and C — nothing to launch, nothing to call. Their gauges rise from 56% to 83% (half of peak on capacity for 60%), inside what they were already built for. Caption: "Already there. Nothing to launch."
2. Side by side: zones sized only for today's load, each gauge near 90%. Zone B fails. Covering the load now needs a call to the control plane: "launch more instances in A and C."
3. The same regional event that took zone B has also strained the control plane; its health dot ambers. The launch calls queue, retry, time out. Caption: "The thing you need during the failure may be failing too."
4. A and C, still sized for only their own load, tip over waiting for capacity that never arrives in time (the overflow from `redundancy-n-plus-1`).

**The moment**: The same zone failure at the same instant: one side settling cleanly at 50%, the other stuck waiting on a degraded control plane while its survivors overflow.

**Interaction**: Toggle "pre-provisioned" against "launch on demand"; kill a zone, and a button to degrade the control plane.

**Ending**: Two zones steady at 50%, one grey. Caption: "Pre-provision the capacity, pre-place the data, so recovery does nothing new." A small price tag: a third of the capacity idles on a normal day.

**Variants**: `redundancy-n-plus-1`, `control-plane-vs-data-plane`, `multi-az-deployment`, `failover`.

**Techniques**: meter, boundary, failure, restyle, side by side, toggle, caption.

**Review**: Improved — the old gauge figures mixed share of peak with utilisation (a zone sized for 50% of peak would sit at 67%, then 100%). Now: zones built for 60% of peak, a third of peak each (56%), half each after losing one (83%). Weighed a pure N+1 framing; the plan's difference is that nothing runs at failure time, which the side by side shows. Ending says it is paid for in idle capacity.

### Control plane vs data plane in recovery (`control-plane-vs-data-plane`)

**The aha**: Build recovery from actions the data plane already knows how to do; a failover that needs a control-plane call can fail exactly when the provider is having a bad day.

**Misconception to defeat**: "The cloud is down" is one thing, not two systems with very different reliability.

**Cast**: Two stacked layers: a control plane (a thin panel labelled "create, configure: launch an instance, change a route, update a DNS record") above a data plane (a thick, always-on highway labelled "ongoing work: serve traffic, answer DNS queries").

**Opening frame**: Both calm — a request flows along the highway while a routine config change passes through the panel above it.

**Story**:

1. A large regional event hits. The panel reddens and jams: everyone reaching for the same levers at once (an echo of `thundering-herd`). Caption: "Everyone reaching for the same levers."
2. The highway underneath keeps flowing untouched the whole time — it doesn't care that the control room is in chaos. Caption: "Simpler, and usually still up."
3. A failover plan that needs a new control-plane object ("create a DNS record for the standby") is attempted during the jam; the call queues, retries, times out. The failover stalls. Caption: "Needs the jammed panel, fails exactly when you need it."
4. Side by side: a different plan, built entirely on the data plane — a weighted DNS record that already existed, just dialled from 0% to 100%. It flips in seconds, panel untouched.

**The moment**: The jammed panel beside the calm highway at the same instant, one failover plan stuck on the panel, the other gliding through the highway.

**Interaction**: Toggle which failover plan runs (needs a new object vs dials an existing one); a control-plane load dial that jams the panel under stress.

**Ending**: Caption: "Build recovery from actions the data plane already knows how to do."

**Variants**: `static-stability`, `dns-failover`, `failover`.

**Techniques**: lanes, boundary, failure, restyle, side by side, toggle, dial, caption.

**Review**: Merged — owned by Fundamentals (plan in `plans/fundamentals.part2.md`). Fundamentals' plan has the clean definition and the best misconception beat (the VM keeps serving while the management API is down, and a replacement can't be created). It should borrow from this one: the recovery lesson (a failover that needs a new control-plane object fails when the provider is stressed; one that only dials an existing weighted DNS record from 0% to 100% does not), the jammed panel (everyone reaching for the same levers at once), and a closing arrow to `static-stability`. Keep in Fundamentals the caution that the data plane is usually, not always, unaffected.

### Constant work (`constant-work`)

**The aha**: A system that does the same work in a crisis as on a quiet day can't be overloaded by the crisis; sudden bursts of change are what break many control systems.

**Misconception to defeat**: Pushing only what changed is always more efficient, and therefore always better.

**Cast**: A config pusher feeding many targets, with a work meter below it tracing flat or spiky.

**Opening frame**: The "delta" version: on a quiet day it sends only changes — one change today, work meter near zero.

**Story**:

1. A big incident forces every target's configuration to change at once. The delta pusher's work meter spikes far beyond its normal range; it chokes on the burst, and some targets never get the update, exactly when it matters. Caption: "The crisis is the burst. It wasn't built for one."
2. Side by side: the "constant work" version, which always re-pushes the full configuration to every target, every cycle, whether anything changed or not. Its work meter is a flat line, quiet day or crisis.
3. The same incident hits. Nothing about the pusher's behaviour changes — it was already doing full pushes every cycle; only the content of what it pushes is different now. The meter stays flat through the incident. Caption: "Same work, every cycle. The crisis is invisible to it."
4. A second example: a health-check sweeper that checks every target every cycle, not just the ones that changed. When 90% of targets suddenly go bad, its workload doesn't move at all — only its results do.

**The moment**: The two work meters through the identical incident: one spiking off the chart, the other an undisturbed flat line.

**Interaction**: Toggle "delta" against "constant work"; trigger an incident of adjustable size and watch each meter.

**Ending**: The flat meter, with its price tagged: quiet days cost as much as the peak, because the system is sized once for the worst case. Caption: "Do the same work always, and a crisis has nothing extra to break."

**Variants**: `thundering-herd`, `cascading-failure`, `self-healing`.

**Techniques**: chart, stream, meter, failure, side by side, toggle, dial, caption.

**Review**: Improved — added the cost (constant work spends the peak's effort all the time, which is why it suits small, bounded state such as configuration and health), so it doesn't read as free. The flat line against the spike is the right moment, and the examples (full-state push, a sweeper checking everything) are the ones in the AWS Builders' Library piece on constant work.
