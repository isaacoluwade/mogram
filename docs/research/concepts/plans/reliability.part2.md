# Reliability plans, part 2

Groups 6–12 of `catalog/reliability.md`, in catalog order. Shared visual language (same as part
1): services are rounded boxes with a small health dot (green, amber, red); requests are dots
travelling along arrows, and a failed request turns red and bursts; clients sit on the left;
zones and regions are framed areas; a failure is a red flash and the element greying out;
time-based ideas use a timeline strip along the bottom with a moving playhead; availability and
error numbers are small meters, and an error budget is a bar that drains; people are small
figures with role badges.

Two techniques are added to the vocabulary here, because none of the existing ones fit:

| Technique | Means                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------- |
| span      | a labelled bracket over a stretch of a timeline: data lost, downtime, time to detect                  |
| rewind    | the story runs back to an earlier frame and replays with one thing changed (same failure, with a fix) |

## Dependencies and degradation

### Critical vs non-critical dependencies (`critical-vs-noncritical-dependencies`)

**The aha**: A flow should only fail when something it truly can't finish without fails; give it a way past everything else and those outages stop being yours.

**Misconception to defeat**: Every arrow out of a service is equally load-bearing, so if any dependency is down, the page is down.

**Cast**: Client (left), Checkout service (centre) with a success-rate meter above it, and four dependencies on the right: Payments, Inventory, Recommendations, Reviews. A small checkout screen beside the client shows what the user sees.

**Opening frame**: Checkout with four identical grey arrows to four green services. Caption: "Checkout calls four services."

**Story**:

1. A request dot leaves the client, fans out along all four arrows, returns. The screen shows "Order placed" with a "You might also like" strip. Caption: "Every order touches all four."
2. Recommendations fails (red flash, grey). The next request's call to it bursts, and the whole request bursts at Checkout. Screen: error page. Meter drops. Caption: "Recommendations is down, so checkout is down?"
3. The arrows are reclassified one by one: Payments and Inventory thicken into solid lines badged "must have"; Recommendations and Reviews become dashed, badged "nice to have", each gaining a small timeout clock and an "or: empty" tag. Caption: "For each one ask: can the order finish without it?"
4. **Rewind** to the same failure. The Recommendations call bursts, but Checkout carries on; the request returns green. Screen: "Order placed", with the strip empty. Meter stays high. Caption: "Soft dependency down: order still placed."
5. Payments fails. The request bursts at Checkout. Caption: "Hard dependency down: no order."
6. A ceiling readout under Checkout: four solid arrows at 99.9% each capped it at 99.6%; two cap it at 99.8%. Caption: "Keep the must-have list short."

**The moment**: Beat 4 against beat 2: the same red Recommendations, once with an error page and once with a finished order and an empty strip.

**Interaction**: Click any dependency to break it; click an arrow to switch it between hard and soft. The meter shows that failure only travels along the solid arrows. A "slow, not down" option on Recommendations: with its timeout removed, even the dashed arrow holds Checkout's threads and drags it down, which teaches that "soft" is code, not a label.

**Ending**: Two solid arrows, two dashed; Recommendations grey; client green; ceiling at 99.8%.

**Variants**: `composite-availability`, `graceful-degradation`, `fallback-vs-failover`, `circuit-breaker`, `timeouts`, `slow-is-the-new-down`.

**Techniques**: token, failure, restyle, rewind, meter, choice, caption.

**Review**: Improved — "soft" is now shown as a mechanism (a timeout and an empty default), not just a relabelled arrow, and the interaction's "slow, not down" case proves it; a ceiling readout (99.6% to 99.8%) ties the idea to `composite-availability`. Weighed a "cut the arrows with scissors" game; the rewind of the identical failure is the clearer contrast, so it stays.

### Graceful degradation (`graceful-degradation`)

**The aha**: A service has more states than up and down; decide in advance what the reduced version looks like, so a failure costs a feature instead of the whole page.

**Misconception to defeat**: Availability is a light switch: all up or all down.

**Cast**: A product page (the user's view) on the left, built from tiles: product photo and price, "Add to cart", reviews, recommendations, a personalised banner. Backend services on the right, each joined to its tile by a thin line: Catalog, Cart, Reviews, Recommendations, Personalisation. A five-step level meter at the top: Full, Reduced, Core, Read-only, Down.

**Opening frame**: The full page, every service green, meter at Full.

**Story**:

1. The wrong model first: Reviews fails and the whole page is replaced by a "500" error. Caption: "No plan: one part fails, the whole page goes." **Rewind**.
2. Reviews fails again. Only its tile changes, to a quiet "Reviews unavailable". Meter: Reduced. Caption: "Hide what's broken."
3. Personalisation fails. The banner swaps to a generic one from cache (a small cache badge). Caption: "Serve something simpler."
4. Recommendations fails. Its tile folds away and the page closes the gap. Meter: Core. Caption: "Drop what's optional."
5. Cart's database stops taking writes. "Add to cart" greys out with "Browsing only for now"; the rest of the page stays. Meter: Read-only. Caption: "Read-only beats down."
6. Caption: "Four things broken. Users can still find the product."

**The moment**: A final split: the "500" page on the left, the degraded but useful page on the right, under the same four grey services.

**Interaction**: Break or restore services in any order; each failure triggers its pre-decided reduced tile. Teaches that every degraded state was designed, not improvised.

**Ending**: Services recover one by one, tiles return, meter climbs back to Full, and it loops.

**Variants**: `critical-vs-noncritical-dependencies`, `kill-switch`, `load-shedding`, `fallback-vs-failover`.

**Techniques**: failure, restyle, disappear, meter, side by side, rewind, choice, caption.

**Review**: Improved — fixed the count (four things fail, not three, once the read-only database is included), gave beat 4 its meter level and caption so the ladder steps visibly, and made the read-only failure Cart's database. Weighed telling it as a dimmer switch beside a light switch; the real product page is more concrete and the level meter already carries the dimmer idea.

### Fallback vs failover (`fallback-vs-failover`)

**The aha**: Failover moves work to another copy of the same thing, which runs every day; fallback switches to a different mechanism that only runs during failures, so it's the least-tested code you own.

**Misconception to defeat**: Fallback and failover are the same, and a fallback is a free safety net.

**Cast**: Two panels. Left, "Failover": Prices service → Primary DB and Replica DB (same shape, same colour). Right, "Fallback": Prices service → Pricing API, plus a differently shaped, dashed box "Local price file". Under each alternative, a counter: Replica "served 1.2M reads today"; Price file "last ran: 14 months ago", the box faintly dusty.

**Opening frame**: Both panels serving from their primary, counters visible. Caption: "Two ways to survive the same outage."

**Story**:

1. Left: the primary fails; traffic moves to the replica, which is already busy. Caption: "Failover: another copy of the same thing."
2. Right: the Pricing API fails; traffic swings to the price file. Caption: "Fallback: a different mechanism."
3. Slow down and zoom into the price file as it runs for the first time in 14 months: its path lights up, the file is out of date (prices from last year), and the full load hits its cold disk at once. Its meter spikes, red flash. Caption: "It hardly ever runs, so nobody knows it still works."
4. Right panel ends worse than it would have with a plain error. Left panel stays green. Caption: "The fallback made it worse."
5. The fix: the price file becomes a cache read on every request, always warm; its counter flips to "ran 3M times today". Caption: "Prefer alternatives that run every day."

**The moment**: The "14 months ago" counter beside "1.2M today", and the fallback breaking the moment it lights up.

**Interaction**: Toggle "exercise the fallback daily" on the right, then break the Pricing API. Off: it fails. On: it holds.

**Ending**: Both panels green, both counters showing daily use.

**Variants**: `failover`, `graceful-degradation`, `active-active-vs-active-passive`, `dr-testing`.

**Techniques**: side by side, failure, path trace, meter, zoom, toggle, restyle, caption.

**Review**: Keep — the "14 months ago" counter beside "1.2M today" is exactly the Builders' Library argument against fallback, and the fix (make the alternative run every day) is the right lesson. Weighed using a second payment provider as the fallback; stale prices show "worse than an error" more plainly, so the price file stays.

### Kill switches (`kill-switch`)

**The aha**: A kill switch is a lever built and tested before the incident, so turning something off takes seconds instead of a code change and a deploy.

**Misconception to defeat**: Mid-incident we'll just ship a quick fix.

**Cast**: Web app box calling three features: Search suggestions, Recommendations, Image resizing. A small "Runtime config" panel (top right) with one lever per feature, each tagged "last tested". An on-call figure. An error-rate meter. Two timeline lanes along the bottom: "No lever" and "Lever".

**Opening frame**: App green, all levers ON, meter low.

**Story**:

1. Recommendations turns amber and slow; requests through the app start bursting red; the meter climbs. Caption: "One feature is dragging down every page."
2. "No lever" lane: the playhead walks through labelled steps, "write fix", "review", "build", "deploy", with a 40-minute span. The meter stays red throughout. Caption: "No lever: 40 minutes of errors."
3. "Lever" lane, same start: the figure flips Recommendations OFF. A config token travels to the app; the Recommendations arrow goes dashed and grey; requests turn green. Span: 30 seconds. Caption: "Lever: one flip, 30 seconds."
4. Spotlight the lever's tag: "last tested: Tuesday game day". Caption: "Built before the incident, and tested."
5. Recommendations recovers; the figure flips it back ON.

**The moment**: The two lanes stacked, a 40-minute red span above a 30-second one.

**Interaction**: Flip any lever and see the page lose that feature but keep working. One lever is tagged "never tested": flipping it throws errors of its own, which teaches why levers need testing too.

**Ending**: Lever back ON, app green, both spans still visible on the lanes.

**Variants**: `graceful-degradation`, `load-shedding`, `runbook`, `game-day`, `feature-flags` (delivery).

**Techniques**: toggle, token, lanes, span, failure, meter, spotlight, choice, caption.

**Review**: Keep — the 40-minute span above the 30-second span is an unmistakable moment, and the "never tested" lever in the interaction covers the catalog's "test the levers" point. Weighed a fire-alarm-pull-station metaphor; the two lanes already show the lever existing in advance, so the metaphor would only add a picture. Linked Delivery's `feature-flags` by id.

## Zones, regions and failover

### Multi-AZ deployment (`multi-az-deployment`)

**The aha**: Copies spread across zones that fail independently survive the most common large failure, losing a whole data centre, as long as the other zones have room for the lost zone's load.

**Misconception to defeat**: Three servers are redundant even when they share one building.

**Cast**: Clients on the left; a load balancer; a region frame. Inside it, zone frames, each with its own small power and network icons. Web servers with health dots; a database primary and a synchronous replica (a short, solid replication line). A load meter on each zone.

**Opening frame**: One zone frame holding three web servers and the database. Caption: "Three servers. One building."

**Story**:

1. The zone's power icon flickers out: red flash across the frame, everything greys. Requests burst. Caption: "Shared power, shared fate."
2. **Rewind**. The servers slide apart into three zone frames, AZ 1–3, each getting its own power and network icon; the database primary sits in AZ 1 with its replica in AZ 2. Caption: "Separate buildings in one region: own power, own network, a few miles apart."
3. Requests stream through the load balancer, a third to each zone; meters read 40%. Caption: "Every zone serves."
4. AZ 1 fails: red flash, grey. A handful of in-flight requests burst. The load balancer stops sending there; streams thicken to AZ 2 and 3; meters climb to 60%. The replica in AZ 2 is promoted automatically within a minute or two, and because it was synchronous, no committed write is lost. Caption: "Lose a zone: the others carry on."
5. Clients go green again. Caption: "A blip, not an outage."

**The moment**: The same power cut twice: one grey building, then two of three buildings still serving.

**Interaction**: Click any zone to take it down. Dial the normal load per zone: above about 66%, losing a zone pushes the survivors past 100% and their meters go red, which teaches why each zone needs headroom.

**Ending**: AZ 1 grey, AZ 2 and 3 at 60%, all clients green. Caption: "Plan for the zone you'll lose."

**Variants**: `multi-region-deployment`, `fault-domains`, `redundancy-n-plus-1`, `static-stability`, `region-evacuation`; `regions-and-zones` (fundamentals).

**Techniques**: boundary, move, rewind, failure, stream, meter, dial, caption.

**Review**: Improved — the database failover no longer happens "in seconds" with "users didn't notice": managed multi-AZ promotion takes from tens of seconds to a couple of minutes, so the story now shows a brief blip and says why no data is lost (synchronous replication). Dropped the second misconception (multi-AZ vs multi-region), which no beat defeated; beat 2's caption now places the zones inside one region instead. Weighed opening on three zones and failing one; the shared-building rewind makes "independent" visible first, so it stays.

### Multi-region deployment (`multi-region-deployment`)

**The aha**: Multi-region survives losing a whole region, but replication that far is asynchronous, so the newest writes can be lost, and the cost and latency are real; zones already cover most failures.

**Misconception to defeat**: Multi-region is multi-AZ further apart: a free upgrade with no data loss.

**Cast**: Clients on the left; a global router (globe icon); two region frames, East and West, each holding three small zone frames and a database. A long replication arrow from East's database to West's, with write tokens moving slowly along it and a "lag 800 ms" label. Cost and latency meters at the top.

**Opening frame**: Both regions serving their nearby clients, writes crawling along the long arrow. Caption: "Two regions, far apart."

**Story**:

1. A zone inside East fails; East absorbs it alone. Caption: "Most failures stay inside one region."
2. A write lands in East and its token sets off along the long arrow to West, visibly slower than the short sync lines inside each region. Caption: "Across regions, copies arrive later."
3. Slow down: East fails entirely (red flash over the region frame). Two write tokens are still mid-arrow; their clients already hold "✓ saved" receipts. The tokens burst and the receipts turn red. A counter: "2 writes lost". Caption: "Lose the region, lose what was in transit."
4. The global router swings East's clients to West; their dots travel a longer path; the latency meter rises. Caption: "West serves everyone, a little slower."
5. The cost meter shows roughly double. Caption: "It survives a region. You pay for it."

**The moment**: The freeze on the two tokens bursting mid-arrow: data loss made visible.

**Interaction**: Toggle replication between async and sync. Sync: no tokens are lost, but every write waits for the long round trip and the latency meter jumps. Also "take East down".

**Ending**: West serving all clients, East grey, "2 writes lost" pinned to the arrow.

**Variants**: `multi-az-deployment`, `active-active-vs-active-passive`, `dns-failover`, `rpo-vs-rto`, `dr-strategies`; `geo-replication`, `sync-vs-async-replication` (data).

**Techniques**: boundary, token, failure, spotlight, path trace, meter, toggle, caption.

**Review**: Improved — the lost writes now carry the clients' "✓ saved" receipts, so the loss is of writes users were told were safe, not just bytes in flight; linked Data's replication plans. Weighed a map with real distances (and a 60–70 ms coast-to-coast round trip) as the frame; the long, slow arrow carries the same point with less to read, and the sync toggle shows the round-trip cost.

### Active-active vs active-passive (`active-active-vs-active-passive`)

**The aha**: Active-active sites all serve every day, so there's no switch to throw and every site is proven; active-passive is simpler to write data to, but its standby is only as good as its last test.

**Misconception to defeat**: A standby that's switched on and replicating will work when you need it.

**Cast**: Two panels. Left "Active-active": router → Site A and Site B, both streaming traffic, a two-way data arrow between them. Right "Active-passive": router → Site A streaming, Site B dim with a "standby" badge and a one-way replication arrow. Each site shows a version tag. Timeline strip at the bottom.

**Opening frame**: Both panels running. Caption: "Same two sites, run two ways."

**Story**:

1. Left: traffic splits 50/50, both sites lit. Right: everything to A, B dim. Captions: "Both serve every day." / "One serves; one waits."
2. The playhead runs through months. Right panel: A's tag goes v41 → v47; B's stays v41, and an expired-certificate icon appears on it. Nothing notices, because nothing touches B. Left: both tags move together. Caption: "An unused standby drifts."
3. Site A fails in both panels at once (red flash).
4. Left: the router just stops sending to A; B already takes traffic; the stream thickens with only a few in-flight requests lost, and B's meter rises to a level it was sized for. Caption: "Nothing to switch on, if B has room for it all."
5. Right: the failover switch is thrown; B wakes, and its first requests burst on the expired certificate. Caption: "The standby was only as good as its last test."
6. The price of the left panel: two users book the same seat in A and B at the same moment; a conflict marker on the two-way arrow. Caption: "Active-active: data written in two places can clash."

**The moment**: Beat 3 to 5: the same failure, one panel flowing straight on, the other stalling and then failing.

**Interaction**: Toggle "test the standby monthly" on the right: drift is caught and fixed, and the failover succeeds.

**Ending**: Both panels with a one-line verdict under each: "No switch; must handle conflicts" and "Simple writes; test the standby".

**Variants**: `failover`, `multi-region-deployment`, `dr-warm-standby`, `dr-strategies`, `dr-testing`, `redundancy-n-plus-1`; `write-conflict-resolution` (data).

**Techniques**: side by side, stream, lanes, restyle, meter, failure, toggle, caption.

**Review**: Improved — active-active's "no gap" now carries its condition (each site must have room for the whole load; a 50/50 split at 70% each would overflow), and a few in-flight requests are honestly lost. The drift beat and the double-booked seat already cover both halves of the catalog's idea. Weighed a relay race (baton handover) for active-passive; the expired certificate on an untouched standby is the truer failure.

### Failover (`failover`)

**The aha**: Failover is a chain, detect, decide, redirect, and your real recovery is the time that chain takes plus whatever data hadn't reached the standby.

**Misconception to defeat**: The standby takes over the instant the primary dies, losing nothing.

**Cast**: Clients on the left; a Traffic manager; Primary (top right) and Standby (bottom right) with health dots; an asynchronous replication arrow Primary → Standby carrying write tokens; health-check pings from the traffic manager to the primary. Timeline strip at the bottom with three empty segments: Detect, Decide, Redirect.

**Opening frame**: Requests flowing to Primary, pings returning ticks, writes copying to Standby.

**Story**:

1. A ghost version plays first: the primary dies and traffic jumps to the standby in the same frame. Caption: "What we imagine." It fades.
2. The real one: Primary fails (red flash, grey). A write token that had just left it bursts on the arrow. A red tick marks the failure on the timeline. Requests to the primary burst. Caption: "The primary dies."
3. Pings go out and get no answer: "miss 1, 2, 3". The Detect segment fills (30 s) while requests keep bursting. Caption: "Detect: three missed health checks."
4. The standby's label flips to "Primary" after a brief catch-up spinner. The Decide segment fills (15 s). Caption: "Decide: promote the standby."
5. The traffic manager's arrow swings to the new primary, but some clients still hold the old address and keep bursting for a while. The Redirect segment fills (60 s). Caption: "Redirect: point traffic at it."
6. Requests turn green. Two spans appear: after the red tick, "down: 1 min 45 s"; before it, "lost: last 2 s of writes". Caption: "Real recovery: the chain's time, plus the data that never arrived."

**The moment**: The three segments filling one after another on the timeline, then the two spans bracketing the failure, set against the ghost's zero-width switch.

**Interaction**: Dials for health-check interval, misses before failover and DNS TTL: the downtime span grows and shrinks. Toggle sync or async replication: the data-lost span disappears or returns.

**Ending**: New primary serving, old primary grey, timeline showing both spans; loops to normal.

**Variants**: `failback`, `automatic-vs-manual-failover`, `dns-failover`, `heartbeat-failure-detection`, `split-brain`, `rpo-vs-rto`.

**Techniques**: token, failure, lanes, span, timer, restyle, path trace, side by side, dial, toggle, caption.

**Review**: Improved — the replication arrow is now explicitly asynchronous (that is why writes are lost, and the sync toggle only makes sense with it), and the two spans are named for what they measure: the down span is the achieved recovery time and the lost span the data loss, ready to be compared with `rpo-vs-rto` targets. The numbers hang together (30 + 15 + 60 s = 1 min 45 s). Weighed a relay-handover metaphor; the ghost instant switch against the real three-segment chain is the sharper contrast, so it stays.

### Failback (`failback`)

**The aha**: Failback isn't failover run in reverse — the old primary has to catch up to everything the standby wrote while it was gone before it can serve again, so it's planned and unhurried, not a quick flip.

**Misconception to defeat**: Once the old primary is healthy again, switch traffic back to it right away.

**Cast**: Old primary (recovering, amber health dot) and new primary (the former standby, green, serving) with a reversed replication arrow between them carrying catch-up tokens, and a "divergence: 1,400 writes behind" gap meter. Clients on the left. A timeline strip.

**Opening frame**: New primary serving everyone; old primary sits recovered but idle, gap meter reading 1,400.

**Story**:

1. The old primary's health dot turns green. Caption: "Healthy again — but not caught up."
2. The wrong move first: traffic is flipped straight back to it. A client's order from minutes ago doesn't exist there; the response bursts red. Caption: "Too soon: it answers from stale data." **Rewind**.
3. The right move: first, the 2 s of writes the old primary held but never sent are set aside (discarded or reviewed, never silently merged). Then a reversed replication arrow streams the missed writes from the new primary into the old one; the gap meter counts down, 1,400 → 0, visibly slower than failover's clock. Caption: "Catch up first."
4. At zero, a brief read-only pause (a small freeze icon) lets the last writes settle.
5. Traffic cuts over in a planned window, a second small failover; the old primary's label flips back to "Primary", the new one back to "Standby". A side note: "or never: the new primary can simply stay primary."

**The moment**: The burst at beat 2 next to the clean, patient countdown at beat 3 — same recovered primary, two outcomes.

**Interaction**: A dial for "writes since failover" — a bigger number stretches the countdown and the wait before failback is safe.

**Ending**: Roles swapped back, gap meter at zero, both sides in sync. Caption: "Failback waits for the data to catch up."

**Variants**: `failover`, `automatic-vs-manual-failover`, `split-brain`, `dr-testing`.

**Techniques**: restyle, meter, rewind, failure, timer, dial, caption.

**Review**: Improved — added the half the plan missed: the old primary may hold acknowledged writes the standby never received, so catching up is not just copying forward; those are set aside before it rejoins. Failback is now shown as a second, planned failover, with the option of not failing back at all. Weighed opening on the burst alone; the stale-read burst followed by the patient countdown is still the clearest contrast.

### Automatic vs manual failover (`automatic-vs-manual-failover`)

**The aha**: Every failover costs some data and some downtime, so a false alarm is an outage of its own; a common split is automatic within a zone, a person gating the decision across regions.

**Misconception to defeat**: Faster is always better, so automate every failover.

**Cast**: Two lanes, "Automatic" and "Manual", each with a primary, a standby and health pings; an on-call figure stands beside the manual lane.

**Opening frame**: Both lanes healthy and identical.

**Story**:

1. A real failure: the primary dies in both lanes (red flash, twice).
2. Automatic lane: failover fires within a minute, green again. Manual lane: the pager goes off, the figure wakes, logs in and checks; a longer red span (timer, about 10 minutes) before the same failover. Caption: "Real failure: automatic is faster."
3. Now a false alarm instead: a brief network blip, pings miss, the primary is actually fine. The automatic lane fails over anyway (a real outage of tens of seconds, and recent writes at risk), then the primary answers again, so it fails back, then blips again and flips once more: the labels flicker Primary/Standby/Primary. Caption: "Flapping on a false alarm: each flip costs downtime."
4. Manual lane, same blip: the on-call figure checks, sees the primary is fine, does nothing. No disruption. Then a cooldown timer is added to the automatic lane ("no second failover for 10 minutes") and the flapping stops. Caption: "Automatic needs brakes."
5. Now a real, large failure (a whole region) hits the manual lane: the figure takes a few deliberate minutes (timer) before pulling the trigger, once certain.

**The moment**: The automatic lane's labels flickering back and forth beside the manual lane's single, unhurried decision — on the same false alarm.

**Interaction**: A dial for false-alarm rate makes the automatic lane flap more often; toggle each lane's failure type between zone-level and region-level to see where each mode fits.

**Ending**: A hybrid shown underneath: automatic within a region, a person gating failover between regions. Caption: "Match the mode to how sure the signal is."

**Variants**: `failover`, `failback`, `heartbeat-failure-detection`, `region-evacuation`.

**Techniques**: lanes, failure, restyle, timer, toggle, dial, caption.

**Review**: Improved — the original only showed manual's upside; beat 2 now shows its price (a person takes minutes to respond), so the trade is two-sided. Flapping is shown with its cost (each flip is a real outage) and the standard remedy, a cooldown, so the lesson is "automate with brakes", not "automation is bad". Weighed a thermostat metaphor; the identical false alarm on two lanes is the more memorable failure.

### DNS and global traffic failover (`dns-failover`)

**The aha**: DNS answers are cached for their TTL, so DNS failover takes minutes and is never instant; anycast or a global load balancer moves traffic without waiting on anyone's cache.

**Misconception to defeat**: Changing a DNS record redirects traffic immediately.

**Cast**: Clients on the left, each with a small resolver cache showing a TTL countdown; a DNS record pointing at Site A; Site A and Site B.

**Opening frame**: Clients resolved to Site A, caches holding that answer, TTL counting down from 300 s.

**Story**:

1. Site A fails (red flash, grey). A health checker misses a few checks, then the DNS record is switched to Site B. A "detect" span precedes the change. Caption: "First detect, then the record changes."
2. But the clients' caches still say Site A; their requests keep bursting against the dead site. Zoom on one client's countdown, still ticking.
3. As each client's TTL reaches zero, it re-resolves, gets Site B, and turns green — staggered across the countdown window, not all at once.
4. Caption: "Full cutover takes detection plus up to a TTL — and some resolvers hold on longer than they're told to."
5. Side by side: an anycast / global load balancer version of the same failure. The client keeps the same address, so no cache holds a stale answer; once the health check trips, the edge simply stops routing to A and every client turns green within seconds, together. Caption: "Same address, new route: nothing cached to wait out."

**The moment**: The staggered trickle of clients turning green against the countdown, set beside anycast's single, instant flip.

**Interaction**: Dial the TTL — shorter cuts the straggle but raises query load; toggle between DNS failover and anycast for the same failure.

**Ending**: All clients on Site B, the countdown spent at zero, the anycast panel long since settled.

**Variants**: `failover`, `multi-region-deployment`, `region-evacuation`.

**Techniques**: timer, token, failure, restyle, side by side, dial, caption.

**Review**: Improved — DNS failover now includes the detection delay before the record even changes (so the TTL is only part of the wait), and anycast is no longer instant in the same frame: it still needs a health check to trip, but it needs no cache to expire, so it takes seconds rather than minutes. Weighed showing a lowered TTL as the main fix; the dial already shows its cost (more queries) and that stragglers remain.

### Zone and region evacuation (`region-evacuation`)

**The aha**: Mitigate first, diagnose later — draining an impaired zone takes a minute and turns a confusing gray failure into a non-event, long before anyone understands the cause.

**Misconception to defeat**: You need to know what's wrong before you can act on it.

**Cast**: A region of three zones; AZ-2 is gray-failing (amber, quietly dropping some requests) while its health checks all pass; an engineer figure at a drain control; a dashboard of green checks beside a rising error meter.

**Opening frame**: AZ-2 amber, error meter creeping up, health dashboard entirely green — the mismatch sitting in plain sight.

**Story**:

1. Users are affected; the dashboard insists everything is fine. Caption: "Gray failure: the dashboard and the users disagree."
2. The tempting path: the engineer starts digging through logs first. A timer runs; the error meter stays bad for many minutes. Caption: "Diagnosing first costs time." **Rewind**.
3. Instead, the engineer pulls the "drain AZ-2" lever (built beforehand, like a kill switch). Traffic reroutes to AZ-1 and AZ-3 within the minute; their load meters rise but stay under 100% because there was headroom; the error meter drops to normal — while AZ-2's health dashboard still shows green and a badge reads "cause: unknown".
4. Caption: "Mitigated in a minute. Investigate after."
5. Later, the cause is found (a failing disk) and fixed; AZ-2 is brought back gradually, drain lifted.

**The moment**: The error meter recovering immediately beside the "cause: unknown" badge — fixed before it's even understood.

**Interaction**: A "drain this zone" button works at any point, cause known or not; toggle "diagnose first" to replay the slower path.

**Ending**: All zones green, drain lifted, caption: "Practise this until it's routine."

**Variants**: `multi-az-deployment`, `gray-failure`, `automatic-vs-manual-failover`, `failover`.

**Techniques**: failure, meter, token, timer, rewind, spotlight, caption.

**Review**: Improved — the drain only works if the surviving zones can take the load, so beat 3 now shows their meters rising but staying under 100% (the headroom lesson from `multi-az-deployment`), and the lever is shown as built in advance, like `kill-switch`. Weighed a cleaner "dashboard says green" opening with no gray failure; the dashboard-versus-users mismatch is the reason mitigation must not wait for diagnosis, so it stays.

## Coordination: who's alive, who's in charge

### Heartbeats and failure detection (`heartbeat-failure-detection`)

**The aha**: You can never know a node is dead, only that you've stopped hearing from it; the timeout you pick trades fast detection against false alarms.

**Misconception to defeat**: A missed heartbeat means the node is dead.

**Cast**: Node A and Node B exchanging a heartbeat pulse every interval; a missed-pulse counter on B; a timeout dial.

**Opening frame**: Regular pulses ticking across, counter at 0.

**Story**:

1. Normal pulses arrive, one per second.
2. A network blip delays one pulse; the counter ticks to 1, then the pulse arrives and the counter resets. Caption: "A miss isn't death."
3. Node A actually crashes (red flash). Pulses stop; the counter climbs, 1, 2, 3; at the threshold B marks A dead. Caption: "Suspected, not known."
4. **Rewind** to the same gap, drawn from B's side only: A is behind a curtain, so the frames B sees are identical. This time A was merely stalled (a long pause, not a crash). The silence outlasts the threshold, so B declares A dead; then A wakes and its pulses resume, proving B wrong. Caption: "The same silence, twice: a crash, then a stall. B can't tell."
5. Dial the timeout shorter: the stall now gets wrongly declared dead more often. Dial it longer: the real crash takes longer to notice.

**The moment**: The identical gap in the pulses playing out two different true stories, side by side, with the timeout deciding which one B believes.

**Interaction**: Dial the timeout; toggle whether the hidden truth is "dead" or "just slow", and watch which one the dial gets right.

**Ending**: A timeout settled on, caption: "Short: fast but jumpy. Long: patient but slow."

**Variants**: `failover`, `split-brain`, `leader-election`, `gray-failure`.

**Techniques**: token, timer, dial, toggle, restyle, side by side, caption.

**Review**: Improved — beat 4 contradicted itself (a pulse resuming "just as" B declared A dead, yet B declaring anyway); it is now a clean false positive: the silence outlasts the threshold, B declares A dead, and A wakes up alive. The curtain over A makes "B only sees silence" literal, which is the aha. Weighed an adaptive (phi-accrual) detector; it refines the dial but would bury the core point, so it stays out. The failover plan now has this to link to for why its "three misses" are a guess.

### Split brain (`split-brain`)

**The aha**: "I can't see the primary" doesn't mean the primary is dead — failover needs a tie-breaker, and only the side holding a majority may act as primary.

**Misconception to defeat**: If a replica can't reach the primary, it's safe for the replica to take over.

**Cast**: A primary and a replica joined by a network link that can be cut, plus a small third "witness" node for quorum; clients writing to whichever side thinks it's primary.

**Opening frame**: Primary and replica connected, one write path, both green.

**Story**:

1. The link is cut (a visible break, scissors icon) — a network partition.
2. The replica, unable to reach the primary, promotes itself. Now both sides are green and both accept writes; two clients write what should be the same record, and a conflict marker appears where the two versions would collide. Caption: "Split brain: both sides think they're in charge."
3. **Rewind**, witness node added. On the same partition, each side asks the witness for a vote; only the side that can still reach a majority (two of three) stays primary, and the minority side fences itself, its write path greying out.
4. Caption: "Only the majority may act as primary."

**The moment**: The diverged conflict marker of beat 2 beside the calmly fenced minority of beat 3 — the same partition, a tie-breaker the only difference.

**Interaction**: Toggle the quorum rule on or off; drag the partition to split the three nodes differently (2–1 or 1–1–1) and see which side, if any, keeps serving.

**Ending**: The link heals, a single primary remains, the fenced side resyncs and rejoins.

**Variants**: `leader-election`, `heartbeat-failure-detection`, `failover`, `failback`.

**Techniques**: failure, restyle, contents, toggle, choice, caption.

**Review**: Merged — owned by Data (`plans/data.part2.md`, "Split brain and fencing"), whose plan is stronger: concrete double-booked seat, the paused-leader fencing rewind, the 3-way cut. Worth borrowing from this one: (1) on healing, show the minority side's diverged writes being discarded or reconciled, with their clients' receipts turning red, so the cost of the partition is visible, not just the ending resync; (2) one line that fencing can also be done to the node (cut its power or storage access) rather than only by a token check; (3) the two-node case: with only a primary and a replica, a 1-1 split leaves no majority, which is why the witness exists.

### Leader election (`leader-election`)

**The aha**: A leader is a single point of failure you can replace automatically — a lease that expires gets re-granted, and a fencing token stops a leader that was only paused, not dead, from acting after it's lost the lease.

**Misconception to defeat**: Once elected, a leader stays leader until it crashes.

**Cast**: Three worker nodes around a central lease lock; one holds a "Leader" badge and a lease with a countdown and a fencing-token number (#7); the other two watch.

**Opening frame**: Node A holds the lease, badge "Leader", countdown refreshing just before it would expire.

**Story**:

1. Normal renewal: A's countdown nears zero, A renews and the countdown resets; the token stays #7, because it is still the same leadership term. Caption: "Renewed before it runs out."
2. A crashes (red flash) mid-cycle; its countdown keeps draining, untouched.
3. At zero the lease is free; B and C race for it, B wins, and a new term begins with token #8. The "Leader" badge moves to B. Caption: "A new leader, automatically."
4. Twist: A wasn't dead, only paused (a long GC-style stall). It wakes believing it's still leader, still holding token #7 and a countdown it never saw expire, and tries to write to a shared resource. The resource, which has already seen #8, checks the token and sees #7 is older, and refuses A's write — a red burst labelled "stale token refused". Caption: "Fencing stops the old leader from acting."

**The moment**: A's write bouncing off the resource because its token is one behind — the lease alone wasn't what stopped it.

**Interaction**: Toggle whether A "crashed" or "merely paused" for the same gap; crash current leader at any time.

**Ending**: B steady as leader, A's stale attempt rejected and discarded.

**Variants**: `split-brain`, `heartbeat-failure-detection`, `self-healing`.

**Techniques**: contents, token, timer, restyle, failure, toggle, spotlight, caption.

**Review**: Improved — fixed the token logic: a fencing token increases only when leadership changes hands, not on each renewal (the old plan bumped it to #8 on renewal and #9 for B, which would let a renewal look like a new leader). Now A holds #7 throughout, B's new term is #8, and A's stale write carrying #7 is refused. Weighed a stricter "A's own clock says the lease expired" version; the pause is exactly the case where A's clock can't be trusted, so the token is the point. The lease and election mechanics (consensus underneath) belong to Data's `split-brain` and consensus plans.

## Reliability targets (SRE)

### SLI, SLO and SLA (`sli-slo-sla`)

**The aha**: The SLI measures what users actually experienced, the SLO is the internal target you engineer to, and the SLA is the looser contractual promise with a penalty attached.

**Misconception to defeat**: These are three names for "uptime".

**Cast**: Three nested lines on one chart: SLI (a live ratio of good events to valid events), SLO (a target line at 99.9% over a 28-day window), SLA (a lower line at 99.5% with a "$ service credit" tag). A CPU meter sits apart, flat and irrelevant.

**Opening frame**: All three lines visible; the SLI fluctuates just above the SLO, which sits above the SLA.

**Story**:

1. Zoom into the SLI as request dots pass: a green tick for good (fast, correct), a red cross for bad; the ratio ticks over live. Caption: "The SLI: what users actually experienced."
2. Pull back to the 28-day window: as long as the SLI line stays above the SLO line, the target is met. Caption: "The SLO: the goal you engineer to."
3. A bad week dips the SLI below the SLO — still above the SLA further down. Caption: "Missed the goal. The contract's still fine."
4. A worse stretch dips the SLI below the SLA too; the "$ service credit" tag lights up. Caption: "The SLA: what you owe for missing it."
5. Throughout, the CPU meter sits flat and green. Caption: "CPU was fine the whole time — that's not what any of these measure."

**The moment**: The line crossing the SLO first (an internal alarm) and, much lower, the SLA later (an external penalty) — two different lines, two different consequences.

**Interaction**: Dial the SLO and SLA targets; toggle the latency threshold that decides "good" and watch the SLI line move.

**Ending**: All three lines settled, SLI comfortably above both, caption recapping the three words.

**Variants**: `error-budget`, `nines-of-availability`, `error-budget-burn-rate`.

**Techniques**: chart, meter, lanes, zoom, dial, toggle, caption.

**Review**: Improved — gave the lines numbers (SLO 99.9%, SLA 99.5%) so "looser" is concrete, and called the SLA remedy a service credit, which is what cloud SLAs actually pay, rather than a vague penalty. The CPU meter staying green is kept as the sharpest rebuttal to "it's all uptime". Weighed one request followed through all three layers; the chart with two differently-consequential lines is the clearer contrast.

### Error budget (`error-budget`)

**The aha**: 100% is the wrong target — the error budget is the unreliability your SLO allows, spent on change, and when it's gone, reliability work comes before new features.

**Misconception to defeat**: More reliability is always better, so aim for zero errors.

**Cast**: A horizontal bar, "Error budget: 43 min / month", that drains as it's spent; a feature team shipping releases along a track; a policy card: "Budget at 0: features freeze."

**Opening frame**: Full budget bar, a release token queued on the track.

**Story**:

1. A release ships; it causes a few minor errors; the bar drains a little. Caption: "Shipping costs some budget."
2. A string of releases drains it steadily — a chart shows the bar falling across the month.
3. A real incident spikes the drain fast, the bar dropping sharply to near-empty.
4. The bar hits zero and flashes red; the policy card flips to "Features frozen", and the release track gates shut on the next queued token.
5. The team shifts to reliability work instead, shipping only urgent fixes; the bar stays at zero, a calendar-month budget does not refill early, and the rest of the month is a quiet climb toward the reset.

**The moment**: The bar hitting empty in the same frame the release gate slams shut.

**Interaction**: Dial how aggressively the team ships and watch the budget drain faster; toggle the freeze policy off and see the bar run negative before a bigger incident follows.

**Ending**: A new month, the bar resets full. Caption: "Not zero errors — spending the budget on purpose."

**Variants**: `sli-slo-sla`, `error-budget-burn-rate`, `nines-of-availability`.

**Techniques**: meter, chart, token, lanes, toggle, dial, failure, caption.

**Review**: Improved — the bar no longer "slowly refills" during quiet time: a calendar-month budget only resets at the month's end (a rolling window recovers as old errors age out, which should be a caption if shown). The freeze now lets urgent fixes through, as in the SRE policy. The 43 min figure checks out (0.1% of 30 days is 43.2 min). Weighed opening on 100% as the wrong target; the drain to a gate slamming shut is a more memorable moment.

### Burn rate (`error-budget-burn-rate`)

**The aha**: Judge incidents by how fast they burn the error budget, not by the momentary error rate — a fast burn pages someone now, a slow one becomes a ticket, and a blip that barely touches the budget wakes nobody.

**Misconception to defeat**: Any elevated error rate deserves the same urgent page.

**Cast**: The error-budget bar from `error-budget`, plus a speedometer-style burn-rate dial (1× exhausts the budget exactly at the window's end; 14.4× burns 2% of a 30-day budget in an hour, all of it in about two days) and a pager icon and ticket icon.

**Opening frame**: Budget nearly full, dial at 1×, pager silent.

**Story**:

1. A tiny blip raises errors slightly; the dial ticks to 2×; the budget barely moves. Caption: "Barely dents the month. Nobody wakes up."
2. **Rewind**. A bigger failure swings the dial to 14.4×; the bar visibly loses 2% in an hour; the pager fires. Caption: "2% of the month's budget gone in one hour."
3. A "time to exhaust" readout side by side: 14.4× is empty in about 2 days, 6× in 5 days, 2× in 15 days, 1× exactly at the month's end. Caption: "Rate decides how long you have."
4. Two slower cases: 6× sustained for 6 hours (5% gone) still pages, but less urgently; 1× sustained for 3 days (10% gone) only files a ticket. Caption: "Slow burn: handle it in working hours, not at 3 a.m."

**The moment**: The same small bump in the raw error-rate chart producing three different responses, once the burn-rate dial — not the raw number — is read.

**Interaction**: Dial the burn rate and watch the outcome switch between nothing, a ticket and a page; toggle the alerting window (1 hour vs 6 hours vs 3 days) to see fast and slow burns both get caught; a short window (5 minutes) alongside the long one lets the alert clear soon after the fix.

**Ending**: Dial back at 1×, budget steady, caption recapping the three outcomes.

**Variants**: `error-budget`, `sli-slo-sla`, `incident-lifecycle`.

**Techniques**: meter, dial, chart, timer, toggle, caption.

**Review**: Improved — fixed a real error: the caption said a month's budget goes in an hour at 14.4×; it is 2% in an hour and the whole budget in about 2 days (720 h / 14.4 = 50 h). Also aligned the tiers with the SRE Workbook's multi-window alerts: 14.4× over 1 h and 6× over 6 h page, 1× over 3 days is a ticket (the old plan had 6× as ticket-only), and added the short companion window. Weighed a fuel-gauge metaphor; the dial plus a time-to-empty readout already carries it.

### MTTD, MTTR and MTBF (`mttr-mtbf-mttd`)

**The aha**: Availability rises when you fail less often (MTBF) or recover faster (MTTR), and recovery is usually the cheaper lever — halving MTTR is worth as much as doubling MTBF.

**Misconception to defeat**: Reliability is mostly about preventing failures.

**Cast**: A timeline strip of repeating cycles, up (green span), down (red span, split into Detect / Acknowledge / Recover sub-spans), up again; a formula bar: "Availability ≈ MTBF / (MTBF + MTTR)".

**Opening frame**: Several cycles, long green spans, short red ones, availability meter high.

**Story**:

1. Spotlight one down span and zoom into its sub-spans — Detect, Acknowledge, Recover — each timed. The first is bracketed "MTTD: time to detect"; all three together, from the failure to service restored, are the MTTR. Caption: "MTTR: average time to recover, detection included."
2. Pull back and average the green spans between failures into the MTBF. Caption: "MTBF: average time between failures."
3. Both feed the formula bar; the meter reads 99.5%.
4. Two experiments side by side: halve the MTTR (down spans shrink) — meter rises to 99.75%. Double the MTBF instead (up spans stretch, same down spans) — meter rises to about the same 99.75%. Caption: "Same gain, two different levers."
5. Caption: "Recovery is usually the cheaper lever." A small footnote on the down spans: one slow outlier among the short ones. "A mean hides the long ones."

**The moment**: The two experiments landing on the same meter value from opposite directions.

**Interaction**: Dial MTTR and MTBF independently and watch the timeline and the meter redraw.

**Ending**: Short down spans, high meter, the formula shown solved.

**Variants**: `nines-of-availability`, `failover`, `incident-lifecycle`, `rpo-vs-rto`.

**Techniques**: lanes, span, zoom, meter, dial, side by side, caption.

**Review**: Improved — MTTD was in the title but never appeared; it is now the first sub-span, and MTTR is defined to include detection (the usual SRE use, since users suffer from the first minute). The arithmetic checks out (99.5% to 99.75% either way, because unavailability is roughly MTTR/MTBF), and a footnote warns that means hide outliers. Weighed a "which lever is cheaper" cost meter; the same-meter-from-opposite-sides moment is cleaner and the cost claim stays a caption.

## Incidents and operations

### Incident lifecycle (`incident-lifecycle`)

**The aha**: Mitigate first, find the cause later — rolling back or draining a zone buys back users while the investigation keeps going underneath.

**Misconception to defeat**: Service can't be restored until the root cause is found and fixed.

**Cast**: A timeline strip with five stages — Detect, Triage & declare (severity badge), Mitigate, Resolve, Review — above a service health meter.

**Opening frame**: Service green, stages empty, playhead at the start.

**Story**:

1. The meter drops; a "time to detect" span stretches until a monitor flags an alert and the playhead enters Detect.
2. Triage stamps a severity (SEV2) and opens a shared incident doc.
3. The wrong path first: skip straight to finding the root cause, a magnifying glass over logs, while the meter stays low for a long red span. Caption: "Diagnosing while still down costs users."
4. **Rewind** to Triage. The right path: Mitigate — a quick rollback or drain — and the meter recovers in a short red span, while an "investigating" lane continues underneath, unhurried.
5. Resolve: the real cause is found and properly fixed. Review: the postmortem doc is stamped closed.

**The moment**: The two red spans compared — long while chasing the cause first, short when mitigating first.

**Interaction**: Choose "mitigate first" or "diagnose first" at Triage and compare the resulting downtime span.

**Ending**: Meter green, all five stages ticked, postmortem closed.

**Variants**: `incident-command`, `blameless-postmortem`, `mttr-mtbf-mttd`, `kill-switch`.

**Techniques**: lanes, span, meter, failure, choice, side by side, caption.

**Review**: Improved — the clock now starts when users are hurt, not when the alert fires, so the detection delay is visible (ties to `mttr-mtbf-mttd`). Mitigate is defined by example (rollback, drain) as stopping user pain, distinct from Resolve. Weighed a hospital-triage metaphor; the two red spans compared is the stronger, more concrete moment.

### Incident command roles (`incident-command`)

**The aha**: With clear roles, the people fixing things aren't also answering questions, and nobody makes conflicting changes — the commander delegates rather than debugs.

**Misconception to defeat**: Everyone free jumps in to help, and whoever is most senior just takes over.

**Cast**: A shared incident doc at the centre; four figures with role badges — Incident commander (IC), Operations lead, Communications lead, Scribe; stakeholders and a status page off to the side.

**Opening frame**: An incident just declared, all four figures converging, badges appearing.

**Story**:

1. The wrong model first: everyone, including the IC, dives into the logs at once. Two changes collide — Ops and a helper both restart the same service — a conflict spark; the status page sits unchanged while stakeholders ping everyone directly. **Rewind**.
2. The IC steps back to coordinate, not fix, and delegates: "Ops, drain zone 2"; "Comms, update the status page"; "Scribe, log the timeline."
3. Ops makes one change at a time, each logged by the Scribe; Comms posts updates and the stakeholder pings redirect to Comms instead of Ops.
4. When Ops asks for help, the IC pulls in one specialist and gives them a clear task, keeping the group on one thread. The role is about the job, not rank: when the shift ends, the IC says "you have command" and a badge passes to a more junior figure.

**The moment**: The collision spark of beat 1 beside the clean, single-threaded sequence of beats 2–3, under the same incident.

**Interaction**: Assign roles by clicking figures; remove the IC and watch the coordination collapse again.

**Ending**: Incident resolved, the doc complete with a timeline, all four badges checked off.

**Variants**: `incident-lifecycle`, `on-call`, `blameless-postmortem`.

**Techniques**: contents, restyle, spotlight, rewind, side by side, caption.

**Review**: Improved — the misconception names seniority taking over, so beat 4 now shows an explicit handover of the IC badge, which also teaches that the IC role is assigned, not earned by rank. Reworded the vague "specialist when asked for". The roles follow the common Incident Command System model (command, operations, communications, plus a scribe/planning role); Google's fourth role is planning, so the Scribe may appear under that name elsewhere. Weighed a pit-crew metaphor; the collision spark against the clean single thread is more direct.

### On-call (`on-call`)

**The aha**: On-call is sustainable only when pages are rare and actionable — every page should mean a user is affected and a person must act now.

**Misconception to defeat**: More alerts means better coverage, so page on anything that might matter.

**Cast**: A pager beside a primary on-call figure, a secondary figure behind on an escalation ladder, a shift calendar strip, a "pages this shift" counter.

**Opening frame**: A calm shift, the calendar showing the rotation, counter at 0.

**Story**:

1. A flood of noisy alerts arrives; the counter climbs fast and the figure droops, worn down; most pings turn out to need no action, each stamped so. Caption: "Alert fatigue: too many non-actionable pages."
2. **Rewind**. Alerts are curated down to ones tied to real user impact; the counter stays low, each page carries a clear action, and the figure handles one or two calmly. Caption: "About two per 12-hour shift."
3. A real page arrives; the primary doesn't respond in time (a timer runs out) and it escalates automatically to the secondary. Caption: "Escalation catches a missed page."
4. The shift ends; the calendar hands off cleanly to the next figure with a short note.

**The moment**: The same figure, worn down under the flood and calm under the curated load, in the same week.

**Interaction**: Dial alert sensitivity and watch pages-per-shift and the figure's state change; toggle escalation on and off.

**Ending**: The calendar rolls to the next shift, counter reset, handoff note visible.

**Variants**: `incident-command`, `toil`, `runbook`, `error-budget-burn-rate`.

**Techniques**: contents, restyle, timer, dial, toggle, lanes, caption.

**Review**: Keep — the same worn-down figure beside the calm one is the right contrast, "about two per 12-hour shift" matches Google's SRE guidance, and the escalation beat covers the missed page. Weighed a firefighter-station metaphor; it adds nothing the pager and calendar don't show.

### Blameless postmortem (`blameless-postmortem`)

**The aha**: Outages come from systems that let a mistake through, rarely from one person, and there's usually several holes lining up, not a single root cause.

**Misconception to defeat**: Find who caused it and make sure they don't do it again.

**Cast**: A stack of barrier layers (Swiss-cheese style) with gaps, a failure token that has passed through all of them, and a postmortem doc with sections: Timeline, Impact, Contributing factors, What went well, Action items.

**Opening frame**: The failure token resting past every layer, having gotten through.

**Story**:

1. The wrong model first: a spotlight lands on the engineer who pushed the change, stamped "their fault". The doc gets written defensively; the only action item is "be more careful". **Rewind**.
2. Instead, trace the token back through the layers it passed: a test that didn't catch it, a review that didn't catch it, a canary watched too briefly, an alert too slow to fire.
3. The engineer is brought into the doc as the expert on what they saw: "what made this the sensible move at the time?" Each gap becomes a contributing factor with an owned action item — extend the canary wait, add the missing test, tighten the alert — ownership attached to fixes, not blame to people. Caption: "Blameless is not accountability-free: fixes have owners."
4. Caption: "No single root cause. Several holes lined up."

**The moment**: The four-layer view with the token's path through every gap, replacing the single spotlighted person.

**Interaction**: Click any layer to see its action item; toggle "blame view" against "systems view" to compare what each produces.

**Ending**: The gaps patched, action items checked off over the following weeks.

**Variants**: `incident-lifecycle`, `failure-mode-analysis`, `runbook`.

**Techniques**: layers, token, spotlight, rewind, toggle, contents, caption.

**Review**: Improved — added the usual objection answered on screen: blameless does not mean nobody is accountable, so the engineer becomes the key witness and every fix gets an owner. The Swiss-cheese framing stays; it shows "several holes lined up" better than a fault-tree or five-whys chain, which tend to push toward one root cause.

### Runbooks and playbooks (`runbook`)

**The aha**: A runbook moves expertise out of one person's head so whoever is on call can act quickly — and a runbook followed the same way every time is a candidate for automation.

**Misconception to defeat**: An experienced on-call doesn't need documentation.

**Cast**: An alert linked to a runbook (a checklist: check this, run that, escalate if still red); two on-call figures, one "veteran", one in their first week.

**Opening frame**: The alert fires; both figures' pagers buzz.

**Story**:

1. The new figure, no runbook: a confusion bubble, random attempts, a long timer, an eventual escalation after real delay. Caption: "No runbook: the expertise lives in one head."
2. **Rewind**. Same alert, same new figure, but it links to a runbook: steps light up one at a time — check disk, run the restart script, escalate if still red — resolved quickly. Caption: "A runbook moves the expertise to the page."
3. Zoom on the runbook's history log: the same three steps, unchanged, run eleven times.
4. Caption: "Run the same way every time? Automate it." The steps collapse into a single "auto-remediate" action that now fires itself without paging anyone.

**The moment**: The two timers side by side — long and confused versus short and guided — for the same alert, the same junior responder.

**Interaction**: Toggle "has a runbook" for an alert; click "automate this runbook" once its run count is high enough.

**Ending**: The alert resolves itself, no page sent, the history log still ticking.

**Variants**: `on-call`, `toil`, `self-healing`, `blameless-postmortem`.

**Techniques**: contents, timer, restyle, rewind, side by side, toggle, caption.

**Review**: Improved — fixed an inconsistency (the checklist had three steps, the log "five"), and the automation beat now reads as one idea: steps that never change are code waiting to be written. Kept the junior-responder framing; the misconception is "experts don't need docs", and the same alert with and without the page answers it. A stale runbook is the risk, which `game-day` covers.

### Toil (`toil`)

**The aha**: Toil grows in step with traffic but the team doesn't, so unless it's engineered away it crowds out the work that would make the system more reliable.

**Misconception to defeat**: Busy on-call work is just the job; it doesn't need reducing.

**Cast**: An engineer with a time-pie split into "Toil" and "Engineering work"; a traffic meter climbing over months; a checklist of toil's qualities (manual, repetitive, automatable, reactive, no lasting value).

**Opening frame**: A small toil slice, a large engineering slice, traffic meter at baseline.

**Story**:

1. Traffic climbs over months; the toil slice grows with it, unprompted, eating into the engineering slice.
2. A sample task — manually restarting a stuck job — is checked against the qualities list: manual, repetitive, automatable, reactive, no lasting value, all yes. Badge: "This is toil."
3. The toil slice crosses a red 50% line marked "SRE cap"; the engineering slice shrinks to a sliver; a second meter, "reliability work done", flatlines.
4. Caption: "Past the cap, nothing gets more reliable — there's no time left to make it so."
5. The restart task is automated (an auto-remediate token, echoing `runbook`); the toil slice shrinks back under the cap even as traffic keeps climbing, and the reliability-work meter starts moving again.

**The moment**: The toil slice crossing the cap exactly as the reliability-work meter goes flat beside it.

**Interaction**: Dial traffic growth and watch the toil slice grow; click "automate" on any toil task to shrink it.

**Ending**: Toil held below the cap despite rising traffic, thanks to automation outpacing growth.

**Variants**: `on-call`, `runbook`, `self-healing`.

**Techniques**: meter, contents, dial, restyle, caption.

**Review**: Keep — the cap crossing in the same frame as the reliability-work meter flatlining is the point, and the qualities list matches Google's definition (manual, repetitive, automatable, tactical, no enduring value, grows with the service); the 50% cap is the SRE book's figure. Weighed a hamster-wheel metaphor; the pie plus the flatlined meter shows the cost more precisely.

## Testing resilience

### Chaos engineering (`chaos-engineering`)

**The aha**: You don't really know your redundancy, timeouts and failover work until you break something on purpose — a controlled experiment with a hypothesis, not random breakage, stopped the moment steady state drifts.

**Misconception to defeat**: Chaos engineering means randomly breaking things in production to see what happens.

**Cast**: A service with a steady-state business metric charted (orders placed per minute); a control group and an experiment group of instances side by side; a hypothesis card: "Losing one AZ won't move steady state."

**Opening frame**: Both groups healthy, the chart flat, the hypothesis card pinned before anything happens.

**Story**:

1. Caption: "Write the hypothesis first."
2. A limited blast radius is drawn: a boundary around 5% of traffic, as the experiment group, with a matching 5% control group left alone.
3. The fault — losing the instances in one AZ — is injected only for the experiment group; the control group is untouched.
4. Both charts run side by side: control flat, experiment also flat. Caption: "No difference. Confidence earned."
5. A bigger run — two AZs lost, a wider slice of traffic — and the experiment's chart dips below the control's, crossing a preset abort line. Caption: "Steady state drifted — stop." A STOP control fires (or the abort line trips it), the fault reverts, the chart recovers. The weakness is logged.

**The moment**: The two charts overlapping cleanly in the first run and splitting apart in the second — the experiment's result, visible at a glance.

**Interaction**: Choose the fault and the blast radius; a STOP button that always reverts the fault immediately, part of the design, not an afterthought.

**Ending**: The hypothesis card stamped "confirmed" or "disproved — fixed", the found weakness patched before the next, larger test.

**Variants**: `fault-injection`, `game-day`, `dr-testing`, `blast-radius`.

**Techniques**: boundary, chart, side by side, failure, spotlight, choice, caption.

**Review**: Improved — the blast radius and the fault were tangled (an AZ and 5% of traffic at once); now the blast radius is the traffic slice and the fault is the AZ loss, with control and experiment groups matching the Principles of Chaos Engineering. Added the automatic abort line so "stop when steady state drifts" is a design, not a reaction. Weighed opening with the random "monkey" the misconception imagines; the hypothesis-first order already contrasts with it and keeps the plan short.

### Fault injection (`fault-injection`)

**The aha**: Inject the failures your failure mode analysis predicted, smallest first, and watch the user-facing metric — not just whether the process restarted.

**Misconception to defeat**: Fault injection means killing a process and checking it comes back up.

**Cast**: A menu of fault buttons — kill process, add latency, drop packets, fill disk, cut a dependency; the target service with a health dot; a user-facing metric meter beside an internal "process up?" indicator.

**Opening frame**: Service healthy, both indicators green, menu untouched.

**Story**:

1. "Kill process" fires; the process indicator flips red then green quickly as it restarts. Caption: "Process recovered. Did users notice?" The user meter shows a small dip during the restart.
2. "Add latency" fires on a dependency instead; the process indicator stays green throughout, nothing crashed — but the user meter sinks steadily as requests queue and time out. Caption: "Nothing crashed. Users still suffered."
3. The lesson lands: process-up is not the same as user impact.
4. Faults are worked through smallest first, from a ranked failure mode analysis list, each checked off once its real impact is measured and accepted or fixed.

**The moment**: A green "process up" dot sitting beside a sinking user-impact meter.

**Interaction**: Pick any fault from the menu and watch both indicators; a checklist from a failure mode analysis, ticking off as each predicted fault is tried.

**Ending**: Every predicted fault tried, checklist complete, both indicators now reliably tracking real impact.

**Variants**: `chaos-engineering`, `game-day`, `failure-mode-analysis`.

**Techniques**: choice, meter, restyle, spotlight, contents, caption.

**Review**: Keep — a green "process up" dot beside a sinking user meter is the sharpest version of the idea, and the faults listed are the real menu. It correctly treats fault injection as the technique, with `chaos-engineering` as the experiment around it. Weighed killing a database for a bigger bang; added latency is the quieter failure people do not test, so it stays.

### Game days (`game-day`)

**The aha**: Game days test people and process as well as systems — the stale runbook, the access nobody has, the alert that never fires.

**Misconception to defeat**: A game day is the same thing as automated chaos testing.

**Cast**: A calendar marked "Game day"; a team of figures around a scenario card ("Region X is down"); a scoreboard of surprises found.

**Opening frame**: The calendar flips to the marked day, the team gathers, the scenario card flips face-up.

**Story**:

1. The scenario plays out, as a simulated failure (a red flash on staging) or a tabletop walk-through (figures narrating "what would you do?").
2. A figure reaches for the runbook — it names a service renamed last year. A "stale" stamp lands on the scoreboard.
3. A figure tries to open the DR console — permission denied. "No access" lands on the scoreboard.
4. An alert that should fire for this scenario stays silent. "Never fired" lands on the scoreboard.
5. The team works through the friction anyway, roles echoing `incident-command`, and resolves the scenario, slower than hoped.
6. Debrief: each scoreboard item becomes an owned fix — update the runbook, grant the access, fix the alert.

**The moment**: The scoreboard filling with surprises no code review or chaos test would have caught — all about people and process.

**Interaction**: Pick the scenario (region loss, data corruption, a key person unavailable) and see different surprises surface each time.

**Ending**: The scoreboard clears by the next game day; the same scenario now runs smoothly.

**Variants**: `chaos-engineering`, `incident-command`, `runbook`, `dr-testing`.

**Techniques**: contents, restyle, spotlight, choice, caption.

**Review**: Keep — the scoreboard of people-and-process surprises (stale runbook, missing access, silent alert) is the differentiator from automated chaos, and the scenario picker varies what surfaces. The scenario can be a tabletop or a live fault injection, which keeps it distinct from, and complementary to, `fault-injection`. Weighed an on-call "wheel of misfortune" roleplay; it is one format of the same idea.

### Disaster recovery testing (`dr-testing`)

**The aha**: An untested DR plan is a hope — test until the measured RTO and RPO actually meet the targets, because backups that won't restore and standby sites that have drifted are the usual surprises.

**Misconception to defeat**: Having backups and a documented DR plan means you're covered.

**Cast**: A DR plan with target numbers (RTO: 1 h, RPO: 15 min); a backup store; a standby site; a stopwatch; a "measured" results panel beside the "target" one.

**Opening frame**: The plan pinned with its targets, the backup store full of green icons, the standby dim.

**Story**:

1. A restore is tried from an old backup and fails partway — a corrupted file, red flash. Caption: "Never tested. Just hoped."
2. **Rewind**. Backups are tested on a schedule, each restore verified against real data; a bad one is caught and replaced before it's ever needed.
3. A full drill: failover to the standby is triggered for real; the stopwatch starts.
4. The standby, drifted from production (an older config, a missing feature flag), stumbles; the stopwatch runs past the 1-hour target line into red.
5. Caption: "Drift is the usual surprise." The drift is fixed — the standby's config synced continuously from production — and the drill reruns: the stopwatch stops at 40 minutes, under target, green.
6. The restored data is checked for its newest record: the gap to the disaster is the measured RPO, 9 minutes against the 15-minute target. Failback is drilled too, and both measured numbers are written into the "measured" panel beside the targets.

**The moment**: The stopwatch overshooting the RTO line on the first real drill, then landing comfortably under it once drift is fixed.

**Interaction**: Run a drill any time; toggle "standby kept in sync" against "standby untouched for months" and watch the stopwatch's outcome change.

**Ending**: The measured panel matching or beating every target, dated "last tested: today".

**Variants**: `rpo-vs-rto`, `dr-strategies`, `chaos-engineering`, `failback`, `replication-is-not-backup`.

**Techniques**: contents, timer, failure, restyle, rewind, toggle, caption.

**Review**: Improved — the stopwatch only measured RTO, though the title and targets name both numbers; the drill now also measures RPO from the newest restored record. Everything else holds: an untested restore and a drifted standby are the two classic surprises, and the over-then-under stopwatch is a clear moment. Weighed a fire-drill metaphor; the plan already works as one.

## Disaster recovery

### RPO vs RTO (`rpo-vs-rto`)

**The aha**: Two clocks on one timeline — RPO looks back from the disaster at how much work disappears, RTO looks forward at how long until you're back — and lowering either costs more.

**Misconception to defeat**: RPO and RTO are two names for the same thing, "downtime".

**Cast**: One timeline strip with a marked disaster point (a red flash) and a playhead; a **span** bracket to its left labelled "RPO: data lost", and one to its right labelled "RTO: downtime", each drawn against a dashed target bracket it must fit inside (RPO and RTO are targets; what a real disaster produces is the measured version); a cost meter.

**Opening frame**: The timeline flowing normally, writes ticking along as small dots, no disaster yet.

**Story**:

1. The disaster hits — a red flash at a point on the timeline. Caption: "The moment everything stops."
2. Looking left: the last good checkpoint sits some distance before the disaster. The span between it and the disaster is bracketed, "RPO: data lost", and the writes inside that span fade, lost for good.
3. Looking right: recovery work ticks along — restore, rebuild, cutover — until service is back; the span from the disaster to that point is bracketed "RTO: downtime".
4. Both spans highlighted together on the same timeline. Caption: "Two clocks, one disaster."
5. Dial each span shorter — tighter backups shrink the RPO span, a faster recovery process shrinks the RTO span — and the cost meter climbs each time. Caption: "Lowering either costs more."

**The moment**: The two brackets sitting on either side of the same red point, looking in opposite directions.

**Interaction**: Dial backup frequency (the RPO span) and recovery speed (the RTO span) independently and watch the cost meter respond to each.

**Ending**: Both spans narrow, the cost meter high, caption recapping the two clocks.

**Variants**: `ha-vs-dr`, `dr-strategies`, `failover`, `mttr-mtbf-mttd`.

**Techniques**: span, failure, timer, dial, meter, spotlight, caption.

**Review**: Improved — RPO and RTO are targets, but the brackets showed only outcomes; they now sit inside dashed target brackets, which also sets up `dr-testing` (measured against target). The definitions are right (RPO looks back, RTO looks forward) and the two-brackets-around-one-point moment is the best contrast. Weighed two separate clocks as stopwatches; one shared timeline makes "different things, same disaster" clearer.

### High availability vs disaster recovery (`ha-vs-dr`)

**The aha**: HA keeps you running through common failures automatically, in seconds to a minute or two; DR restores you after rare, large events through a planned process — and HA doesn't replace DR, because a synchronous replica copies a bad delete just as fast as a good write.

**Misconception to defeat**: If you're highly available, you don't need a separate DR plan.

**Cast**: Two panels. Left, "HA": primary and replica joined by a synchronous line, with an automatic failover arrow. Right, "DR": a production region and a DR region, a plan document with a "last tested" date, a manually gated process.

**Opening frame**: Both panels healthy and connected.

**Story**:

1. Left: an instance dies; the replica takes over within a minute or so, no person involved. Caption: "Common failure. Automatic. Minutes at most."
2. Right: nothing is happening. Caption: "DR waits for something HA can't fix."
3. A bad delete lands on the primary by mistake. On the left, the synchronous line replicates it to the replica instantly; both copies are now empty, both red. Caption: "HA just protected two empty copies."
4. On the right, the DR plan is invoked: a point-in-time backup from before the mistake is pulled, and production is rebuilt from it over a planned, timed process. Caption: "DR: a process, not instant, back to a moment that still has the data."
5. A verdict, side by side: "HA: a blip, but it replicates the damage too." / "DR: minutes to hours, for what HA can't undo: a bad delete, or the loss of the whole region."

**The moment**: The same bad delete spreading instantly through HA's synchronous line, set against DR's backup restoring to before it happened.

**Interaction**: Toggle "HA only" against "HA and DR" and fire the bad-delete fault; only the DR path recovers the data.

**Ending**: Both panels healthy again, caption affirming both are needed, for different failures.

**Variants**: `rpo-vs-rto`, `dr-strategies`, `replication-is-not-backup`, `failover`.

**Techniques**: side by side, failure, token, timer, restyle, toggle, caption.

**Review**: Improved — HA's failover is "a minute or so", not "seconds" (consistent with `multi-az-deployment` and `failover`), and the verdict now names both things DR is for: data damage that replication copies, and losing the whole site HA lives in. Weighed a seatbelt-versus-insurance metaphor; the bad delete racing through the synchronous line is the more memorable failure.

### DR strategies: from backups to multi-site (`dr-strategies`)

**The aha**: The four DR strategies trade cost against RTO and RPO, from cheapest and slowest to priciest and near-instant — choose per workload, not one setup for everything.

**Misconception to defeat**: There's one "right" DR setup; pick the fanciest one you can afford.

**Cast**: Four stacked rows, one timeline each, all sharing the same disaster point and RPO/RTO spans from `rpo-vs-rto`: Backup and restore, Pilot light, Warm standby, Multi-site active-active. A cost meter beside each row.

**Opening frame**: All four rows at rest, cost meters at their respective heights — shortest for backup and restore, tallest for multi-site — no disaster yet.

**Story**:

1. The same disaster strikes all four rows in one red flash across the stack.
2. Row 1: nothing exists in the DR region yet; a long RTO span unfolds as infrastructure is built from code, then data restored. The longest downtime of the four, the cheapest meter.
3. Row 2: data was already live there (a small glowing core) but compute must be switched on and scaled; a shorter, but real, RTO span.
4. Row 3: a scaled-down copy was already serving a trickle; it just scales up; a short RTO span.
5. Row 4: already serving everyone; the span is barely visible.
6. The RPO spans are compared too: hours for backup and restore (set by backup frequency), seconds to minutes for pilot light and warm standby (replication lag), near zero for multi-site. Each row's RTO label reads: hours / tens of minutes / minutes / near zero.
7. Small note on the last row: "Still needs backups: replication copies mistakes" (see `replication-is-not-backup`). Caption: "Same disaster, four outcomes — match the row to what the workload can afford to lose and to pay."

**The moment**: The four RTO spans stacked and shrinking row by row as the cost meters grow.

**Interaction**: Pick a workload ("internal reporting" versus "checkout") and see which row's downtime and cost it can actually live with.

**Ending**: All four rows recovered, spans and costs left on screen for comparison.

**Variants**: `rpo-vs-rto`, `dr-backup-and-restore`, `dr-pilot-light`, `dr-warm-standby`, `active-active-vs-active-passive`.

**Techniques**: lanes, span, timer, meter, failure, side by side, choice, caption.

**Review**: Improved — the four rows now carry the AWS whitepaper's figures as labels (RTO hours / tens of minutes / minutes / near zero; RPO hours down to near zero) so the ladder is readable at a glance, and the multi-site row notes it still needs backups. The ordering (cost up, RTO and RPO down) is correct. Weighed revealing the rows one at a time; the single red flash across all four is the better "same disaster, four outcomes" moment.

### Backup and restore (DR strategy) (`dr-backup-and-restore`)

**The aha**: Cheapest, but recovery takes hours because the whole environment has to be built before any data can be restored into it, and it only works if the infrastructure is defined as code.

**Misconception to defeat**: Having backups means you can recover quickly.

**Cast**: An empty DR region (just a faint outline); a backup store holding data snapshots, infrastructure-as-code templates and images, with copies kept outside the production region (backups stored only in the failed region would go down with it); a build-then-restore pipeline.

**Opening frame**: Production running normally at home; the DR region empty; backups accumulating steadily.

**Story**:

1. Disaster strikes production — red flash, the whole region greys.
2. The DR region is still empty. Caption: "Nothing is running here yet."
3. Infrastructure-as-code templates fire: network, servers, database appear one at a time, a progress bar climbing.
4. Only once the environment exists does the data restore begin from the latest snapshot — a second progress bar, data flowing in.
5. A **span** stretches under both steps, labelled "RTO: hours" — visibly the longest of the four strategies.
6. Without infrastructure as code, the build stage stalls indefinitely instead — a stuck progress bar, a confused engineer. Caption: "Only works if the infrastructure is code."

**The moment**: The empty region filling in two visibly sequential stages, build then restore, showing why this strategy can't be fast.

**Interaction**: Toggle infrastructure-as-code on and off and watch the build stage succeed or stall; dial backup frequency to move the RPO span.

**Ending**: The DR region fully built, restored and serving; the "hours" span left on screen.

**Variants**: `dr-strategies`, `rpo-vs-rto`, `replication-is-not-backup`, `dr-testing`.

**Techniques**: boundary, contents, timer, span, failure, toggle, caption.

**Review**: Improved — the backup store is now drawn with a cross-region copy; otherwise the story would quietly assume backups survive the region they were taken in. The RPO span is the age of the newest copied snapshot, which the backup-frequency dial moves. Build-then-restore as two visible stages stays the key moment. Weighed a packing-and-moving-house metaphor; the empty region filling in stages is plainer.

### Pilot light (`dr-pilot-light`)

**The aha**: The data is always live, like a gas pilot light, but recovery still means switching compute on and scaling it up — until then, it can't serve a single request.

**Misconception to defeat**: Because the data is already replicating, failover is instant.

**Cast**: Production, serving; a DR region, dim, holding only a small glowing "pilot light" (a continuously updated database) and no running app servers.

**Opening frame**: Production serving all traffic; the pilot light glowing steadily, writes streaming into it continuously.

**Story**:

1. Disaster strikes production — red flash, grey.
2. The DR region's pilot light is fully caught up, current to seconds before the disaster, zoomed in to show it — but no servers surround it. Caption: "The data's ready. Nothing is serving it."
3. App servers appear one by one, booting into the DR region, then scale up to handle full load — a **span** labelled "RTO: tens of minutes".
4. Once scaled, traffic cuts over; the region goes from dim to fully lit.
5. Caption: "Always live underneath. Never instant on top."

**The moment**: The glowing, fully current pilot light sitting beside a region with nothing to serve it — readiness and usability shown as two separate things.

**Interaction**: Dial how much compute is pre-provisioned, from none up toward warm-standby levels, and watch the RTO span shrink as the strategy slides toward warm standby.

**Ending**: The DR region fully lit and serving, the RTO span shown.

**Variants**: `dr-warm-standby`, `dr-strategies`, `static-stability`, `rpo-vs-rto`.

**Techniques**: boundary, token, stream, timer, span, failure, dial, zoom, caption.

**Review**: Keep — readiness and usability shown as separate things (a current database with nothing to serve it) is exactly the pilot-light idea, and the dial sliding toward warm standby places it on the ladder. Matches the AWS definition (data live, compute off, RTO tens of minutes). Weighed a gas-stove picture; the glowing core already is the metaphor.

### Warm standby (`dr-warm-standby`)

**The aha**: Unlike pilot light it serves requests right away, so it's easy to test continuously — the remaining risk is depending on a scale-up action succeeding during the disaster itself.

**Misconception to defeat**: Warm standby means it's already at full strength, just waiting.

**Cast**: Production serving most traffic; a DR region, lit but small, already carrying a thin trickle of real traffic (5%), its own health dot green; a "scale up" control-plane action icon.

**Opening frame**: Production at 95%, the DR region already serving 5%, both green.

**Story**:

1. Caption: "Already serving — just small." The 5% trickle is proof it works, tested continuously without anyone trying.
2. Disaster strikes production — red flash, grey.
3. Once traffic is rerouted (the same detect-and-redirect chain as `failover`), the DR region takes it without a cold start since it was already live — but it's sized for 5%, so its meter spikes toward overload, a red warning, as 100% lands on it.
4. A scale-up API call fires to grow its capacity to match — a **span**, "RTO: minutes" — most of it this scale-up, not a cold start.
5. A twist: the scale-up call itself is slow or fails, echoing `control-plane-vs-data-plane`; the overload meter stays red longer than planned. Caption: "The risk: a control-plane action, during the disaster."
6. Once scaled, the region settles, serving everyone comfortably.

**The moment**: The brief overload spike the instant full traffic lands on a "warm" but undersized standby, before scale-up catches up.

**Interaction**: Toggle "scale-up succeeds quickly" against "scale-up is slow or fails" and watch the overload meter's recovery differ. A third option, "pre-scale to 100%", removes the scale-up from the disaster path altogether (at higher cost): the region never goes red.

**Ending**: The DR region at full strength serving everyone, the RTO span shown as mostly scale-up time.

**Variants**: `dr-pilot-light`, `dr-strategies`, `static-stability`, `control-plane-vs-data-plane`, `active-active-vs-active-passive`.

**Techniques**: stream, meter, failure, timer, span, toggle, spotlight, caption.

**Review**: Improved — "instantly absorbs" ignored the redirect step (now linked to `failover`'s chain), and the interaction gained a pre-scale option that shows the standard remedy (static stability: no control-plane call during the disaster) and its cost. The overload spike and the failing scale-up are the right moments. Weighed a dial from 5% to 100% instead; the toggle makes the dependency on a scale-up call clearer.

### Replication is not backup (`replication-is-not-backup`)

**The aha**: Replication copies every change almost instantly, including mistakes; a backup is a separate point-in-time copy you can restore to before the damage — which is why you need both.

**Misconception to defeat**: A replicated database is a backed-up database.

**Cast**: A primary database with a synchronous replication arrow to a replica, their contents identical; separately, a shelf of dated backup snapshots (yesterday, two days ago, three days ago).

**Opening frame**: Primary and replica showing identical table contents; the backup shelf holding a few snapshots.

**Story**:

1. A normal write lands on the primary and replicates to the replica within milliseconds; both update together. Caption: "Replication: every change, copied instantly."
2. Disaster: a mistaken DROP TABLE hits the primary. Caption: "Watch the replica." The drop replicates too, just as fast — the replica's contents vanish in the same frame as the primary's. Caption: "The mistake replicated too."
3. Caption: "Replication protects against losing a machine. Not against this."
4. Cut to the backup shelf: yesterday's snapshot sits untouched, isolated, dated before the mistake. It's pulled and restored into a recovery copy, then the transaction log is replayed up to the second before the DROP (point-in-time recovery), contents reappearing intact. Without the log, today's writes since the snapshot would be gone. Caption: "A backup: a separate copy, from before."
5. A final split screen: primary and replica both still empty on the left, the restored copy intact on the right.

**The moment**: The drop appearing on the replica in the very same frame as the primary — replication offering zero protection against this kind of mistake.

**Interaction**: Toggle the fault between "lose a machine" (replication saves the day, the replica takes over fine) and "bad delete" (only the backup shelf saves it).

**Ending**: A restored copy serving, the shelf relabelled "versioned, isolated, point-in-time", caption recapping both are needed.

**Variants**: `ha-vs-dr`, `durability-vs-availability`, `dr-testing`, `dr-backup-and-restore`.

**Techniques**: contents, token, failure, toggle, side by side, spotlight, caption.

**Review**: Improved — restoring "yesterday's snapshot" alone would lose a day of writes, so beat 4 now replays the log to just before the DROP (point-in-time recovery), which also ties to RPO. The same-frame drop on the replica remains the unmistakable moment. Weighed a photocopier-versus-filing-cabinet metaphor; the live DROP is more concrete.
