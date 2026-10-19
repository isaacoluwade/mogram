# Observability plans, part 2

Stage 2 plans for the observability catalog, from "Monitoring methods" to the end, in catalog
order. They use the same visual language as part 1. **The house system** is four rounded boxes,
Web → API → DB, with API also calling Payments. Requests are dots that travel between the boxes
and turn red when they fail. Telemetry rises from services as small coloured signals: logs are
grey lines of text, metrics are blue numbers feeding a chart, and traces are violet spans drawn as
bars on a shared timeline (a waterfall). It all flows right to a collector or backend. Dashboards
are small panels. An alert is a bell that rings and a pager that buzzes. The on-call engineer is a
small figure who wakes up.

Two techniques are added to the vocabulary here, because nothing in the README covers them:

| Technique | Means                                                                                                          |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| regroup   | many items sort or merge themselves into piles by a key, with a count per pile (group by, dedupe, fingerprint) |
| share     | sizes show proportions of a whole: flame-graph box widths, a bill split by cost driver                         |

## Monitoring methods

### The four golden signals (`four-golden-signals`)

**The aha**: If you can only watch four things, watch latency, traffic, errors and saturation.
The first three describe what users are getting. Saturation shows how close you are to falling
over.

**Misconception to defeat**: That monitoring means graphing everything the system exposes, and
that one latency line tells you how users are doing. In fact fast failures make it look _better_.

**Cast**: The house system, with a crowd of user figures on the left sending dots into Web. Behind
it, a wall of 40 tiny grey graphs (GC pauses, heap, inode count…). Four larger panels: Traffic
(dots per second), Errors (a red count), Latency (a stopwatch and one line) and Saturation (a tank
drawn inside the API box: its worker pool, filling as work queues).

**Opening frame**: The system running, the 40-graph wall crowding the right. Caption: "You can
measure everything."

**Story**:

1. 36 graphs fade. Four slide forward and wire to the API with thin lines. "Start with these four."
2. The crowd doubles, the dot stream thickens and Traffic climbs. "Traffic: how much is asked."
3. The API's tank fills to 85% and dots wait at its door. "Saturation: how full the tightest
   resource is."
4. The tank overflows. Some dots turn red and bounce straight back, and Errors climbs. "Errors."
5. Slow down. The red dots come back in 3 ms, and the single Latency line _drops_. A puzzled "?"
   appears over it. "Things got worse. Latency got better?"
6. The line splits in two: success latency (rising) and failure latency (flat, near zero).
   "Measure failures separately."

**The moment**: Beat 5: the latency line improving while users fail, then splitting so the truth
shows.

**Interaction**: A "users" dial. Push traffic up and watch saturation fill first, then errors and
success latency follow. A toggle merges or splits latency by outcome.

**Ending**: The four panels in a 2×2 above the system, with Saturation marked as the one that moved
first. Caption: "Latency and errors: what users feel. Saturation: what's coming."

**Variants**: `red-method`, `use-method`, `latency-percentiles`, `monitoring-dashboards`.

**Techniques**: appear / disappear, stream, token, contents, meter, chart, restyle, dial, toggle,
caption.

**Review**: Keep — the fast-failure latency drop is the sharpest twist available and matches SRE
ch. 6; a "golden signals vs RED" side-by-side was weighed and left to `red-method`.

### The RED method (`red-method`)

**The aha**: Give every request-driven service the same three graphs, Rate, Errors and Duration, so
anyone on call can read any service and spot the odd one out.

**Misconception to defeat**: That every team needs its own bespoke dashboard, and that RED tells you
which resource inside a service is to blame.

**Cast**: The four house services (Web → API → DB, with API also calling Payments). Under each, a
strip of three small panels: R (blue requests per second), E (red errors per second) and D (a
latency distribution with p50 and p99 lines). A thin "door" on each service's left edge, where
requests are measured. The on-call figure.

**Opening frame**: The four services, each with a mismatched panel below: Web shows "page views",
API shows "CPU", Payments shows "widgets processed" and DB shows nothing. The figure squints at
Payments: "?". Caption: "Every team, a different dashboard."

**Story**:

1. The bespoke panels shrink away. One R/E/D strip appears under Web and is cloned under each of
   the others. "Same three graphs, every service."
2. Zoom to the API's door. Each dot crossing it ticks R, a red dot also ticks E, and every dot drops
   its time into D's distribution. "Measured at the door: the caller's view."
3. Payments slows. Its D lines climb, and so do API's and Web's, because they wait on it. Slow down.
   The strips read the same way, so the eye follows the red down the calls: Web waits on API, API
   on Payments, and Payments waits on nothing. DB, API's other dependency, stays flat. Spotlight
   Payments. "Same layout: the culprit stands out."
4. The figure points at Payments, then looks inside it. The box is dark, with a "?" on its CPU, pool
   and disk. "RED says which service. Not which resource." An arrow labelled "USE" points in.

**The moment**: Beat 3: identical strips side by side, the slowdown rippling back to the callers,
and the source obvious because every strip reads the same way.

**Interaction**: "Break a service": pick any service to slow down or fail, and see which strips
change, including callers whose Duration rises in sympathy.

**Ending**: The row of four identical strips with Payments spotlighted. Caption: "Rate. Errors.
Duration. For every service."

**Variants**: `four-golden-signals` (RED leaves out saturation), `use-method`,
`otel-collector-pipeline` (RED derived from spans), `ebpf-observability`.

**Techniques**: clone, token, meter, chart, side by side, zoom, spotlight, failure, choice, caption.

**Review**: Improved — beat 3 had Payments calling DB, which contradicts the house system (API
calls both); the culprit is now found by following the red down the real call chain to the one
red service whose dependencies are all calm.

### The USE method (`use-method`)

**The aha**: For every resource, check utilization, saturation and errors. Saturation (work
queuing) exposes a bottleneck even when average utilization looks comfortable.

**Misconception to defeat**: "It's only 55% busy, so it has headroom." Also, treating "high CPU" as
a diagnosis.

**Cast**: The API box opened into a floor plan of resources, each a counter with a waiting area in
front: CPU (four cores), memory (a bar), disk, network card, a worker thread pool (8 slots) and a
DB connection pool (5 slots). On the right, a checklist card with one row per resource and columns
U, S and E.

**Opening frame**: The API's RED Duration panel glowing red and the figure asking "API is slow.
Why?" The camera begins to zoom into the box.

**Story**:

1. Inside, the resources appear with dots flowing between them. "Every resource: Utilization,
   Saturation, Errors."
2. Walk the checklist, one row at a time. CPU: 60%, no queue, no errors, ✓. Memory, disk, network
   and the thread pool: ✓.
3. The connection pool's utilization gauge reads 55%, averaged over a minute. Slow down and drop to
   real time. Requests arrive in bursts: for two seconds all five slots are full and 12 dots line
   up behind them, then it empties. "55% busy on average. Still a queue."
4. Below it, two charts over the same minute: average utilization (flat at 55%) and queue length
   (spiking with each burst). A few queued dots run past their timeout and turn red, and the E cell
   fills.
5. The row lights up: "DB connection pool · U 55% · S 12 waiting · E timeouts". Zoom back out: the
   API's slow Duration now has its reason. "RED found the service. USE found the resource."

**The moment**: Beat 3: a gauge reading a calm 55% while a queue visibly forms in front of it.

**Interaction**: Two dials: "burstiness" (the same average load, with lumpier arrivals) and "pool
size". Average utilization barely moves while the queue appears or vanishes.

**Ending**: The completed checklist with one red row. Caption: "All three, for every resource."

**Variants**: `red-method`, `four-golden-signals`, `continuous-profiling`.

**Techniques**: zoom, contents, meter, chart, token, failure, spotlight, dial, caption.

**Review**: Keep — a calm 55% gauge beside a visible queue is Gregg's saturation point exactly, and
picking a software resource (the connection pool) over a disk shows the checklist finding what
nobody thought to look at.

### Business metrics and KPIs (`business-metrics`)

**The aha**: Every technical signal can be green while the business is broken. A metric of what the
system exists to do, such as orders per minute, catches it.

**Misconception to defeat**: That green latency, error and CPU panels mean the system is working.

**Cast**: The house system, with Web showing a tiny shop page that has a Buy button. A row of
technical panels (latency, error rate, CPU). One business panel, "Orders/min": a line inside a
shaded band labelled "usual for a Tuesday". Each completed order drops a coin into a jar beside
Payments.

**Opening frame**: All panels green, the orders line inside its band, coins dropping steadily.
Caption: "All green."

**Story**:

1. Users click Buy. Dots go Web → API → Payments → DB, a coin drops for each order, and Orders/min
   tracks the band.
2. A deploy marker, "v5.1", appears. On the shop page, the Buy button silently disappears (a CSS
   change).
3. Users keep arriving and browsing. Dots go Web → API and back as fast 200s, and latency, errors and
   CPU all stay green. But no dots reach Payments: its path empties and the jar stops. "Fast 200s.
   Zero errors."
4. Slow down. The Orders/min line falls out of its band towards zero. Spotlight three green panels
   beside one plunging line. "Nothing failed. Nothing sold."
5. The drop rings the bell and the on-call figure wakes. A manager figure glances at the same panel
   and gets it instantly: "We stopped selling."

**The moment**: Beat 4: every technical panel green next to the business line falling off a cliff.

**Interaction**: Pick a bug to inject: "hide the Buy button", "card processor declines everyone with
200 OK" or "promo code makes everything free". Each passes the technical panels, and each shows up
in orders or revenue.

**Ending**: The dashboard laid out again with Orders/min in the top row, above the technical panels.
Caption: "Measure what the system is for."

**Variants**: `four-golden-signals`, `thresholds-vs-anomaly-detection`, `change-events`,
`monitoring-dashboards`.

**Techniques**: token, stream, chart, appear / disappear, restyle, side by side, spotlight, choice,
caption.

**Review**: Keep — "nothing failed, nothing sold" is the right failure; the 200-OK decline was
weighed as the lead and kept in the interaction, since a vanished Buy button is more visible.

## Alerting

### Alert rules and the alert lifecycle (`alert-rules`)

**The aha**: An alert is a query with a timer and an address. It's checked on a schedule, must stay
true for a set time before it fires, and then goes to someone along with what to do.

**Misconception to defeat**: That an alert fires the instant a line is crossed, and that a red graph
is an alert.

**Cast**: An error-rate chart with a red threshold at 2%. A rule card: `checkout_error_rate > 2%`,
`for: 5m`, `severity: page`, `team: payments`, `runbook: …`. A state pill below the chart: OK
(grey), Pending (amber), Firing (red), Resolved (green). A pending timer ring. The bell, the pager
and the on-call figure.

**Opening frame**: The chart, the rule card, and the pill reading OK. Caption: "A rule: a query, a
condition, a wait, an address."

**Story**:

1. An evaluation tick sweeps the latest point once a minute. "Checked every minute."
2. A one-minute spike crosses the line. The pill turns Pending and the timer ring starts to fill,
   then the spike drops, the ring empties and the pill returns to OK. "A blip: pending, then
   nothing."
3. Errors rise and stay up. Pending again. Slow down as the ring fills tick by tick to 5 minutes.
   The pill turns Firing and the bell rings.
4. An envelope leaves the rule carrying its labels and text: "Checkout errors 4.1% (page, payments)
   → runbook". It reaches the pager, and the figure wakes and opens the runbook. "What's broken, how
   badly, what to do first."
5. The fix lands and the line falls below 2%. The pill turns Resolved, and a "resolved" envelope
   follows the same route.

**The moment**: Beats 2 and 3 back to back: the same crossing, once brief and ignored, once sustained
and firing, with the timer ring making the difference visible.

**Interaction**: A dial for the `for` duration (0, 5 or 30 minutes). At 0, every blip pages. At 30,
users suffer for half an hour before anyone knows. It teaches the trade between speed and false
alarms.

**Ending**: A state lane under the chart showing the whole history: OK, Pending (the blip), OK,
Pending, Firing, Resolved. Caption: "Query. Timer. Address."

**Variants**: `symptom-vs-cause-alerting`, `pages-vs-tickets`, `alert-routing-and-escalation`,
`slo-burn-rate-alerting`.

**Techniques**: chart, timer, restyle, token, lanes, dial, caption.

**Review**: Keep — pending-then-firing with a visible timer ring is the true Prometheus `for:` lifecycle, and the blip vs sustained pair makes the moment.

### Symptom-based vs cause-based alerting (`symptom-vs-cause-alerting`)

**The aha**: Page on what users experience, not on internal conditions that might hurt them. Causes
are endless and often harmless. Symptoms are few and always matter.

**Misconception to defeat**: That alerting on more internal conditions (CPU, nodes, queues) makes
you safer.

**Cast**: Two copies of the house system side by side, each with a night sky, a clock and an on-call
figure asleep. The left team's rules: "CPU > 90%", "node down", "queue > 1000", "disk > 80%". The
right team's rules: "checkout errors > 1%" and "checkout p99 > 2 s", with the cause metrics kept on
its dashboard instead.

**Opening frame**: Both systems at 03:00, both figures asleep. Labels: "Alert on causes" and "Alert
on symptoms".

**Story**:

1. 03:07: a batch job pushes the API's CPU to 95%. Users' dots still flow normally. On the left the
   bell rings; the figure wakes, finds nothing wrong and goes back to bed. On the right the figure
   sleeps while CPU climbs on the dashboard. "95% CPU. Users fine."
2. 03:40: one of three nodes dies and traffic shifts to the other two. Users are fine. The left
   figure wakes again; the right one sleeps.
3. 04:15: a cause nobody listed. Payments' TLS certificate expires and checkout dots turn red on
   both sides. Slow down. On the left, no rule matches, and there's silence while users fail. On
   the right, checkout errors cross 1%, the bell rings, and the figure wakes and finds the expired
   certificate on the dashboard. "The cause you didn't list. The symptom you always see."
4. A tally drops in. Left: 2 pages, 0 needed, 1 outage missed. Right: 1 page, 1 needed.

**The moment**: Beat 3: the left bell silent while dots turn red, the right bell ringing.

**Interaction**: "Inject a cause": a CPU spike, losing a node, a slow disk, an expired certificate,
a bad deploy or a DNS failure. Harmless causes page only the left team. Unlisted ones page only the
right.

**Ending**: The two tallies. Caption: "Page on symptoms. Keep causes on the dashboard to explain the
page."

**Variants**: `four-golden-signals`, `alert-fatigue`, `blackbox-vs-whitebox-monitoring`,
`slo-burn-rate-alerting`.

**Techniques**: side by side, timer, token, failure, restyle, meter, choice, caption.

**Review**: Keep — the unlisted-cause outage that only the symptom rule catches is the strongest argument, and the tallies match SRE ch. 6 / Rob Ewaschuk.

### Alert fatigue (`alert-fatigue`)

**The aha**: Every page nobody needed trains people to ignore the pager. Measure alerts by precision
and recall, and delete, demote or automate the noisy ones.

**Misconception to defeat**: "Better safe than sorry": an extra alert can't hurt.

**Cast**: The on-call figure with a pager, a week laid out as a lane (Monday to Sunday) and a
"response time" meter over the figure's head. Alert cards drop into the pager's inbox: grey ones
(flapping, duplicate, self-resolving, "disk 70%") and one red one. A scoreboard for precision (pages
that were real) and recall (real problems that paged).

**Opening frame**: Monday morning. The figure is alert, the pager is on the desk and the response
meter reads "1 min".

**Story**:

1. Monday: a page. The figure jumps up and checks, but it has already resolved itself. "Flapping."
2. The cards speed up through the week: the same alert five times, "disk 70%", a CPU blip, a nightly
   job that always recovers. The figure reacts more slowly each time: stands, then glances, then
   mutes. The meter climbs from 1 to 5 to 20 minutes, then reads "muted". The pager ends up under a
   pillow.
3. Friday, 02:00: the real one arrives, "checkout down". Slow down. Its card looks exactly like the
   forty before it. It sits unread while users' dots turn red. "The real page looked like all the
   others."
4. The scoreboard: 41 pages, 1 real, so precision is 2%. The real incident did page (recall 1 of 1), but
   nobody answered. "Low precision spends the trust that recall needs."
5. Rewind the week. Each grey card gets a stamp: "delete", "make it a ticket", "group duplicates" or
   "automate the fix" (a small robot restarts the job). The next week brings 2 pages, both real,
   and the meter falls back to 1 minute.

**The moment**: Beat 3: the real incident landing in a muted pager, looking just like the noise.

**Interaction**: Click each noisy card and choose its fate (delete, ticket, group, automate) to watch
precision climb and response time recover. Delete the wrong card, a rare but real alert, and recall
drops instead. Or turn a "noise per week" dial and watch trust decay.

**Ending**: Two weeks side by side: "41 pages, 1 real, ignored" and "2 pages, 2 real, answered in
1 min".

**Variants**: `pages-vs-tickets`, `alert-routing-and-escalation`, `symptom-vs-cause-alerting`,
`aiops`.

**Techniques**: lanes, contents, meter, restyle, failure, side by side, choice, dial, caption.

**Review**: Improved — beat 4 claimed recall 0 of 1, but the real incident did page; the failure is ignoring it, so the scoreboard now says precision 2% with recall intact, and deleting the wrong alert is what costs recall.

### Pages vs tickets (`pages-vs-tickets`)

**The aha**: Route alerts by how soon a human must act. A page interrupts now, a ticket waits for
working hours, and everything else is just a dashboard.

**Misconception to defeat**: That severity is how alarming something sounds, so every
critical-sounding alert goes to the pager.

**Cast**: A sorting chute with three exits: "Page: act in minutes" (a pager, a night sky, a sleeping
figure), "Ticket: act in days" (an inbox under a 9 a.m. sun) and "Dashboard: just look" (a panel,
no notification). Alert cards, each carrying a small chart.

**Opening frame**: The three labelled exits and an empty chute. Caption: "Sort by: how soon must
someone act?"

**Story**:

1. A card arrives: "Disk 80%". Its chart extends the slope: 1% a day, so full in 20 days. It drops
   into Ticket and the figure sleeps on. "Full in 20 days: a ticket."
2. Another card: "Disk 80%". Same headline. Slow down as its chart extends the slope: full in 30
   minutes. It drops into Page and the pager buzzes. The two cards sit side by side. "Same 80%.
   Different clock."
3. "CPU 70%, users fine" slides into Dashboard. No sound.
4. A quick run: "TLS cert expires in 14 days" goes to Ticket, "Checkout errors 5%" to Page, "Cache
   hit rate down 3%" to Dashboard.
5. The week's totals: 2 pages, 7 tickets, everything else on dashboards. The figure sleeps most
   nights.

**The moment**: Beat 2: two cards with identical text landing in different exits because of their
projected time to full.

**Interaction**: Drag the slope of the disk chart. The "full in…" readout changes, and the card
switches exits when the time to full drops below a few hours.

**Ending**: The three exits with their contents. Caption: "Severity is a deadline, not a feeling."

**Variants**: `alert-fatigue`, `alert-routing-and-escalation`, `multiwindow-multi-burn-rate-alerts`
(slow burns become tickets).

**Techniques**: side by side, chart, timer, token, contents, dial, caption.

**Review**: Keep — identical "Disk 80%" cards landing in different exits by time-to-full is the sharpest framing of severity as a deadline.

### Alert routing, grouping and escalation (`alert-routing-and-escalation`)

**The aha**: Rules decide whether an alert fires. Routing decides who hears it and how, turning a
flood into one message to the right team that can't quietly die.

**Misconception to defeat**: That every firing alert becomes its own notification to everyone.

**Cast**: On the left, alert envelopes with label tags (`alertname`, `cluster`, `team`). In the
middle, a sorting office: the notification system. On the right, three team pagers (Platform,
Payments, Web), each with a rotation of primary, secondary and team lead. A maintenance cone. An
acknowledgement timer ring.

**Opening frame**: The office between the alert sources and the three pagers, every figure asleep.
Caption: "Firing alerts come here first."

**Story**:

1. Without the office: a network fault in cluster east fires 200 "PodDown" alerts and one
   "NetworkDown". All 201 envelopes hit every pager, and all three teams wake under a pile.
   "Without routing." Rewind.
2. Group: the envelopes enter the office and their labels are read. The 200 PodDown envelopes stack
   into one bundle: "PodDown ×200, cluster east". "200 alerts, one message."
3. Inhibit: the NetworkDown envelope arrives and the PodDown bundle greys out beneath it. "The cause
   hides its side effects."
4. Silence: a DB alert from a planned upgrade hits the maintenance cone and stops. "Planned work
   stays quiet."
5. Route: NetworkDown's `team=platform` tag sends it down one chute, to Platform only. Payments and
   Web sleep on.
6. Escalate: Platform's primary pager buzzes, but the phone is face down. Slow down as the ring fills
   to 5 minutes with no acknowledgement. The page jumps to the secondary, who wakes and acknowledges.
   "No answer? Next person."

**The moment**: Beat 2: 200 envelopes collapsing into one bundle, while a counter of notifications
sent drops from 201 to 1.

**Interaction**: Toggles for grouping, inhibition, silences and escalation, with a counter showing
notifications delivered and who woke up. A "don't acknowledge" button.

**Ending**: The counter: "201 alerts → 1 page → acknowledged in 6 min". One figure awake.

**Variants**: `alert-rules`, `alert-fatigue`, `pages-vs-tickets`, `aiops`.

**Techniques**: token, regroup, restyle, path trace, timer, meter, toggle, caption.

**Review**: Keep — the 201 to 1 collapse, with group, inhibit, silence, route and escalate each as one beat, is faithful to Alertmanager plus an on-call rotation.

### Static thresholds vs anomaly detection (`thresholds-vs-anomaly-detection`)

**The aha**: A fixed line can't know that normal changes with the time of day. A learned band can,
but it fires on anything unusual, so use each where it fits.

**Misconception to defeat**: That one number defines "wrong", or that anomaly detection is simply
the smarter replacement.

**Cast**: A week-long chart of requests per minute, rising each afternoon and dipping each night. A
red horizontal threshold. A shaded grey "expected" band that follows the wave. A bell above the
chart. A second, flatter chart: error rate, with a 1% line.

**Opening frame**: The week of waves. Caption: "Busy afternoons, quiet nights."

**Story**:

1. A static rule: "alert if traffic < 500/min". Each night's dip crosses it, and the bell rings at
   02:00 every night. "One line can't follow a wave."
2. Wednesday, 14:00: an outage halves traffic, but the afternoon peak is high, so it stays above 500.
   Slow down: dots dropping, bell silent. "A real drop, above the line."
3. Switch to the learned band, built from past weeks. The night dips sit inside it. Wednesday's drop
   falls out of it, and the bell rings. "Expected range moves with the day."
4. Thursday: a marketing email sends a harmless spike out of the top of the band, and the bell rings
   for nothing. "Unusual isn't always bad."
5. Switch to the error-rate chart: no daily pattern, and an objective limit. Here the static 1% line
   is the right tool.

**The moment**: Beats 2 to 3: the same Wednesday drop, silent under the static line, caught by the
band.

**Interaction**: Drag the static line up or down. Catch Wednesday and it rings every night; stop the
nightly noise and it misses Wednesday. Toggle between line and band. A "send marketing email"
button.

**Ending**: Both charts, labelled "Patterned, no natural limit: band" and "Objective limit:
threshold".

**Variants**: `alert-rules`, `business-metrics`, `aiops`, `slo-burn-rate-alerting`.

**Techniques**: chart, toggle, side by side, dial, failure, choice, caption.

**Review**: Keep — the same Wednesday drop silent under the line and caught by the band, then the harmless marketing spike, gives an honest both-sides lesson.

### SLO burn-rate alerting (`slo-burn-rate-alerting`)

**The aha**: Alert on how fast the error budget is being spent, not on the raw error rate. The
question becomes "is this threatening our promise, and how soon?"

**Misconception to defeat**: "Page when the error rate goes above X%."

**Cast**: An error-budget tank at the top (a 99.9% SLO over 30 days, so 0.1% of requests may fail).
Below it, a 30-day timeline with a dashed diagonal from full to empty at day 30. A burn-rate
speedometer marked 1×, 6× and 14.4×. An error-rate chart with a naive red line at 1%. Two bells,
"error rate > 1%" and "burn rate".

**Opening frame**: A full tank and the dashed diagonal. Caption: "SLO 99.9%: 0.1% of requests may
fail this month."

**Story**:

1. Errors trickle at 0.1%. The speedometer reads 1×, and the tank drains exactly along the diagonal.
   "Burn rate 1: empty at day 30."
2. A blip: five minutes at 5% errors. The error-rate bell rings. The speedometer jumps to 50×, but
   only for five minutes, so the tank loses a sliver (about 0.6%). The burn-rate bell stays quiet.
   "Loud blip. Tiny dent."
3. A slow leak: 0.6% errors for hours, under the 1% line, so the error-rate bell stays silent. The
   speedometer settles at 6×. Slow down: a projection from the tank runs steeply to empty at day 5,
   and the burn-rate bell rings. "Quiet, but the month's budget is gone in five days."
4. A big outage: 14.4×, "2% of the budget in an hour". The burn-rate bell rings at once.
5. The tally: the error-rate bell paged for the blip and missed the leak. The burn-rate bell did the
   opposite.

**The moment**: Beat 3: a calm-looking error chart under its line while the tank's projection hits
empty at day 5.

**Interaction**: Dials for error rate and duration, with readouts for burn rate, budget spent, time
to empty, and which bell rings.

**Ending**: The tank with the blip and the leak marked on it. Caption: "Page when the promise is at
risk, not when a number twitches."

**Variants**: `multiwindow-multi-burn-rate-alerts`, `symptom-vs-cause-alerting`, `alert-rules`; the
error budget itself (Reliability). A follow-on for low-traffic services, where synthetic traffic
tops up the request count.

**Techniques**: meter, chart, timer, side by side, restyle, dial, caption.

**Review**: Improved — the slow leak was 0.5% (5×), which sits below the 6× paging tier of the next plan; it is now 0.6% (6×, empty at day 5). Blip maths (50×, about 0.6% of budget) and 14.4× = 2% per hour check out.

### Multiwindow, multi-burn-rate alerts (`multiwindow-multi-burn-rate-alerts`)

**The aha**: A long window proves the problem is significant, and a short window proves it's still
happening. Requiring both, at a few burn rates, pages fast for outages, catches slow burns, ignores
blips and stops soon after recovery.

**Misconception to defeat**: That one burn-rate threshold over one window is enough.

**Cast**: A burn-rate chart with a "now" cursor. Two brackets reach back from "now": a long one
(1 hour) and a short one (5 minutes, a twelfth as long). Each has a light that turns red when its
average burn rate exceeds 14.4×. An AND gate joins the two lights to a bell. A small table of tiers:
14.4× (1 h and 5 m) pages, 6× (6 h and 30 m) pages, 1× (3 days and 6 h) opens a ticket.

**Opening frame**: The cursor and both brackets on a calm chart, lights off. Caption: "Two windows,
looking back from now."

**Story**:

1. The long window alone. An outage starts and the 1 h light takes a while to turn red. The outage
   is fixed, but the window is still full of bad minutes, so the light stays red for up to an hour.
   The figure has finished fixing it and is still being paged. "Long window: slow to stop."
2. The short window alone. A two-minute blip turns the 5 m light red, and the pager buzzes for
   nothing. "Short window: jumpy."
3. Both, through the AND gate. The outage starts: the short light comes on at once, the long one
   once the outage counts, and the bell rings. The fix lands. Slow down: within five minutes the
   short light goes green, the long one stays red, the gate opens and the alert resolves. "Long: it
   matters. Short: it's still happening."
4. The three tiers play in turn. A big outage (14.4× or more) pages within minutes. A steady 6× burn pages
   once it has run for hours, because its long window is 6 h. A 1× leak over three days opens a ticket.

**The moment**: The recovery in beat 3: the long window still red, the short one green, the alert
off.

**Interaction**: Scrub "now" across a scenario (blip, outage, slow burn, recovery). Turn the short
window off to see the reset time stretch.

**Ending**: A five-row grid. Blip: ignored. Big outage: paged in minutes. Moderate burn: paged in
hours. Slow leak: ticket. Recovery: clears in five minutes. Caption: "Fast, thorough, quiet, quick to reset."

**Variants**: `slo-burn-rate-alerting`, `pages-vs-tickets`, `alert-rules`.

**Techniques**: chart, boundary, move, restyle, timer, toggle, choice, caption.

**Review**: Improved — "a 6× burn pages within the hour" was wrong (its long window is 6 h); now says hours, the ending grid gains a moderate-burn row, and the 14.4× 1h/5m, 6× 6h/30m, 1× 3d/6h tiers are confirmed.

### AIOps (`aiops`)

**The aha**: AIOps earns its keep by grouping and triage: it turns 300 alerts from one failure into
one incident with a likely culprit. It can't find causes in telemetry that was never collected.

**Misconception to defeat**: That AI will find the root cause of anything, in place of good
instrumentation.

**Cast**: The house system widened to ten services, with dependency lines between them (a service
map). A storm of alert cards. A box labelled "correlate" between the cards and the on-call figure.
A change lane at the bottom with a deploy marker on DB.

**Opening frame**: Ten healthy services, the correlate box idle, the figure asleep.

**Story**:

1. The DB slows. Within 90 seconds every service that touches it fires: timeouts, latency, errors,
   queue backlog. 300 cards rain towards the figure. "One failure. 300 alerts."
2. The correlate box catches them. Cards cluster by time (the same 90 seconds), by topology (all
   downstream of DB on the map) and by shared labels, and regroup into one incident card. "Same
   minute. Same dependency."
3. A path traces upstream along the map to the deepest alerting service, DB, and finds the deploy
   marker two minutes earlier. The card reads "Likely: DB, after deploy db-migration-42". One page
   reaches the figure.
4. A second scenario. Payments slows because an outside card network is slow, but Payments' outgoing
   calls were never instrumented, so that edge is drawn dark. Slow down: the box points at Payments
   with a "?" and stops. "It can only connect what was collected."
5. Instrument the outgoing call. The edge lights up with spans, and the card now reads "card network
   latency".

**The moment**: The collapse from 300 cards to one in beat 2, then the dark edge in beat 4 where the
reasoning stops.

**Interaction**: Toggle correlation on and off (300 notifications or 1). Toggle instrumentation on
any edge and watch the suggested culprit sharpen or blur.

**Ending**: One incident card with its culprit. Caption: "Grouping and triage, on top of good
telemetry."

**Variants**: `alert-routing-and-escalation`, `thresholds-vs-anomaly-detection`, `service-map`,
`change-events`.

**Techniques**: regroup, token, path trace, failure, restyle, toggle, spotlight, caption.

**Review**: Keep — the collapse of 300 cards to one, then the dark uninstrumented edge where the reasoning stops, states both the value and the limit.

## Checking from the outside: health, synthetics and real users

### Health checks and heartbeats (`health-checks-and-heartbeats`)

**The aha**: A health check asks "can you serve?" and catches things that answer badly. A heartbeat
reports "I'm alive" on a schedule and catches things that silently stop, because absence produces no
errors.

**Misconception to defeat**: That no errors means everything ran, and that a deeper health check is
a better one.

**Cast**: Top half: a load balancer in front of three API instances, sending `GET /healthz` and
getting ✓ or ✗ back. Bottom half: a nightly job (a clock and a gear) and a heartbeat monitor with a
25-hour countdown. A bell.

**Opening frame**: Both halves, the health checks returning ✓ and the countdown at 25:00:00.
Caption: "Ask, or be told."

**Story**:

1. Every 10 seconds the load balancer asks each instance, and ✓ comes back. Instance 2 hangs and its
   check times out: ✗. The load balancer stops sending it users and the dots reroute. "We ask. It
   answers badly. We stop sending."
2. At 01:00 the job runs, finishes and sends a beat to the monitor. The countdown resets. "It tells
   us, on schedule."
3. The next night, the job's host has been replaced and the cron entry is gone. Nothing runs. Slow
   down: the logs panel is empty, the error panel reads zero, and the countdown ticks to 00:00. The
   bell rings. "Nothing failed. Nothing ran. Only silence."
4. Back to the top. Each instance's `/healthz` now also checks the DB. The DB hiccups for five
   seconds, all three instances return ✗ at once, the load balancer removes them all, and every user
   is turned away. "Check only what this instance needs."
5. Last, the alerting system itself sends an always-firing "watchdog" heartbeat to an outside
   service. Alerting crashes, the beats stop, and the outside service pages. "Monitoring needs a
   heartbeat too."

**The moment**: Beat 3: empty logs and zero errors while the countdown runs out.

**Interaction**: Buttons: "hang an instance", "delete the cron", "make the check deep", "crash
alerting". Each shows which mechanism catches it, or makes things worse.

**Ending**: Two arrows side by side: "Health check: we ask →" and "← Heartbeat: it tells us".
Caption: "Bad answers and silence both get caught."

**Variants**: `blackbox-vs-whitebox-monitoring`, `synthetic-monitoring`; liveness vs readiness probes
(Containers); load-balancer health probes (Networking).

**Techniques**: exchange, token, timer, failure, path trace, choice, side by side, caption.

**Review**: Keep — silence-as-failure (empty logs, zero errors, countdown expiring) plus the deep-check cascade and the watchdog are all accurate and earn their beats.

### Black-box vs white-box monitoring (`blackbox-vs-whitebox-monitoring`)

**The aha**: Black-box monitoring sees what users see, even when your own telemetry is wrong or down.
White-box monitoring sees inside, to explain why and to warn before users notice.

**Misconception to defeat**: "Our internal metrics are green, so users are fine."

**Cast**: The house system inside a boundary labelled "your system", with telemetry rising to a
dashboard on the right. Outside the boundary on the left: real users, a DNS signpost, a TLS padlock,
and a probe robot that loads the site the way a user would, with a ✓/✗ light.

**Opening frame**: Users and the robot reaching the system through DNS and TLS. The dashboard is
green and the probe shows ✓. Caption: "An inside view and an outside view."

**Story**:

1. White-box warns first. Inside, saturation of the DB connection pool creeps up and the dashboard
   shows it, while the probe still shows ✓. "White-box: trouble coming."
2. Reset. A DNS change goes wrong. User dots reach the signpost and are sent to a dead address.
   Nothing reaches the boundary.
3. Slow down inside: traffic quietly falls, errors are at 0%, latency is excellent and CPU is idle.
   Every internal panel is green. "Inside: perfectly healthy."
4. The robot's next probe hits the same dead address: ✗, and the bell rings. "Outside: nobody can
   get in. Only the outside view sees it."
5. Both views together: the probe says _that_ users are hurting, and the dashboard says _why_ when
   the cause is inside.

**The moment**: Beats 3 and 4: a green dashboard beside users bouncing off a broken signpost, and the
robot catching it.

**Interaction**: Choose a fault: break DNS, expire the TLS certificate, break the telemetry pipeline
(the dashboard goes blank but the probe still works), or slowly saturate the DB (white-box warns
first).

**Ending**: Two panels: "Black-box: are users hurting?" and "White-box: why?". Caption: "You need
both."

**Variants**: `synthetic-monitoring`, `real-user-monitoring`, `health-checks-and-heartbeats`,
`symptom-vs-cause-alerting`.

**Techniques**: boundary, token, failure, side by side, spotlight, meter, choice, caption.

**Review**: Keep — the broken DNS signpost with an all-green dashboard is the right failure, and "probe says that, dashboard says why" matches the SRE book.

### Synthetic monitoring (uptime checks) (`synthetic-monitoring`)

**The aha**: Scripted robots walk your key paths on a schedule from around the world, so breakage is
found even when no users are around. But they only test what you scripted.

**Misconception to defeat**: That no complaints means it works, and that a ping to the homepage
proves checkout works.

**Cast**: A world-map strip with five probe robots (Toronto, London, Frankfurt, Singapore, São
Paulo). The house system, idle. A script of four steps: Home → Log in → Add to cart → Pay. A results
grid with a row per location and a column per 5-minute run. A clock reading 03:00.

**Opening frame**: Night over the map, and the system with no user dots. Caption: "3 a.m. No users."

**Story**:

1. Every five minutes each robot runs the script. A dot steps Home → Log in → Cart → Pay, and each
   step ticks ✓ with a time. The grid fills green, column by column. "Scripted users, on a
   schedule."
2. At 03:05, Singapore's cell goes red alone, because of its own network blip. The rule wants two or
   more locations, so nothing pages. "One location failing: probably the probe."
3. At 03:12 a config change breaks login. There are no real users, so no complaints and no user
   errors anywhere.
4. Slow down. The 03:15 column turns red in all five rows, at step 2. The bell rings, and the figure
   fixes it before the morning rush. "Broken at 3 a.m. Fixed before anyone noticed."
5. A rarely used gift-card page breaks. No script visits it, and the grid stays green. That page dims.
   "Only tests the paths you scripted."

**The moment**: Beat 4: a whole column going red while the city sleeps, set against beat 2's single
red cell.

**Interaction**: Choose what breaks (login, one probe's network, one region's CDN, the gift-card
page). A dial for "locations required to alert".

**Ending**: The grid with its red column and the recovery after it. Caption: "Proactive and steady.
Only as wide as the script."

**Variants**: `real-user-monitoring`, `blackbox-vs-whitebox-monitoring`,
`health-checks-and-heartbeats`.

**Techniques**: token, lanes, path trace, timer, failure, restyle, choice, dial, caption.

**Review**: Keep — one red cell vs a whole red column, plus the unscripted gift-card page, covers both the strength and the limit.

### Real user monitoring (RUM) (`real-user-monitoring`)

**The aha**: The backend's 50 ms is not what the user gets. RUM measures in real browsers and apps,
including everything outside your servers, sliced by device, browser and country.

**Misconception to defeat**: That server response time is the user's experience.

**Cast**: A backend panel, "API p95: 50 ms ✓". A page-load timeline drawn as lanes: DNS, connect,
TLS, server (a short violet bar), download, run JavaScript and render, with an LCP flag. Two users:
a laptop on office fibre near the data centre, and a mid-range phone on a slow mobile network on
another continent. RUM beacons flying to the collector. A breakdown grid by device and country.

**Opening frame**: The backend panel, green. Caption: "The backend says 50 ms."

**Story**:

1. Zoom out from the 50 ms server bar to the laptop's full page load: network legs, 50 ms of server,
   script, render. LCP at 1.2 s.
2. The same page on the phone. The network legs stretch, and download and JavaScript stretch most of
   all. The server bar is the same tiny 50 ms. Slow down and spotlight it inside a 6-second
   timeline. "Same 50 ms server. Six seconds for the user."
3. A snippet in the page sends a beacon home: LCP 6.1 s, INP 450 ms, device, country. Thousands of
   beacons fill the grid, and one cell, "mid-range Android, region X", glows red. "Measured where
   the user is."
4. A JavaScript error that happens in only one browser appears in the RUM panel. The backend never
   saw a request fail.
5. A new page with no visitors yet: its RUM row is blank. "Only sees where users are, after they hit
   it."

**The moment**: Beat 2: a 50 ms sliver inside a 6-second bar.

**Interaction**: Pick a device, network and location. The lanes stretch to match while the server
bar never changes. Toggle between "backend view" and "user view".

**Ending**: Side by side: "Backend p95: 50 ms" and "Users p75 LCP: 3.8 s; phones in region X: 6 s".

**Variants**: `synthetic-monitoring`, `latency-percentiles`, `blackbox-vs-whitebox-monitoring`,
`signal-correlation` (RUM linked to backend traces).

**Techniques**: zoom, lanes, spotlight, token, side by side, restyle, choice, toggle, caption.

**Review**: Keep — a 50 ms sliver inside a 6 s bar is the whole point; LCP/INP values and p75 reporting are consistent with Core Web Vitals.

## Dashboards

### Dashboards (`monitoring-dashboards`)

**The aha**: A good dashboard answers one known question at a glance and links down to the next
level of detail. It isn't a wall of graphs, and it isn't how you find out about outages.

**Misconception to defeat**: That more panels means more visibility, and that someone should watch
the dashboard to catch outages.

**Cast**: A dashboard frame beside the house system. Version A: 80 tiny graphs in no particular
order. Version B, titled "Is checkout healthy?": four panels (traffic, errors, latency, saturation)
plus Orders/min, each linking to a drill-down. The on-call figure's gaze drawn as a dotted path. A
stopwatch.

**Opening frame**: The 80-graph wall, with the gaze path starting to dart. Caption: "Is checkout
healthy?"

**Story**:

1. The gaze zigzags across 80 panels. The stopwatch runs to 40 seconds and a "?" stays over the
   figure. "80 graphs. No answer."
2. The wall regroups into version B, with the question as its title. One glance: Errors is red.
   The stopwatch reads 2 seconds. "One question, answered at a glance."
3. Click Errors and it zooms into a drill-down of errors by dependency, where Payments is red. Click
   again for Payments' own dashboard. "Overview, then detail."
4. Night. The screen glows in an empty room as an outage starts, and nobody sees it. The bell wakes
   the figure, who then opens the dashboard. "Alerts tell you. Dashboards show you."
5. A new question: "Is it only one tenant, on one build?" No panel has it. An arrow points to
   exploring raw events. "Dashboards answer the questions you knew to ask."

**The moment**: Beat 2: 80 panels collapsing to five, and the stopwatch dropping from 40 seconds to 2.

**Interaction**: A "find the problem" race: the same incident on the wall and on the overview,
timed. Panels can be clicked to drill down.

**Ending**: The overview with its drill-down links drawn as lines below it. Caption: "One question
per dashboard, and a link to the next."

**Variants**: `four-golden-signals`, `red-method`, `business-metrics`, `change-events`,
`monitoring-vs-observability`, `high-cardinality-analysis`.

**Techniques**: regroup, path trace, timer, zoom, side by side, spotlight, choice, caption.

**Review**: Keep — 40 s vs 2 s on the same incident, and the alerts-tell-dashboards-show beat, correct the wall-of-graphs misconception directly.

### Change events and deploy markers (`change-events`)

**The aha**: Most incidents start with a change. Putting every deploy, config change and flag flip
on the graph turns an hour of searching into a rollback decision.

**Misconception to defeat**: That incidents come out of nowhere and investigation has to start from
the logs.

**Cast**: The API's error-rate chart over two hours. A change lane beneath it with icons for a deploy
(a rocket), a config change (a gear), a feature flag (a switch) and scaling (stacked boxes). The
on-call figure and a stopwatch. Version colours: v4.1 blue, v4.2 orange.

**Opening frame**: The chart with a jump at 14:32 and no markers. Caption: "Errors jumped at 14:32.
What changed?"

**Story**:

1. Without markers, the figure flips between logs, chat and the deploy tool, and the stopwatch runs
   to 45 minutes. "Hunting for what changed." Rewind.
2. Changes appear in the lane as they happen: at 13:10 the "new-search" flag turns on; at 14:00 the
   API scales from 3 to 5; at 14:31:30 the deploy of API v4.2 begins. Each drops a vertical marker
   onto the chart. "Every change, recorded."
3. Slow down. The v4.2 marker sits 30 seconds before the jump. Spotlight both. "30 seconds after
   v4.2."
4. The error line splits by `service.version`: v4.1 flat, v4.2 high, the v4.2 share growing as the
   rollout spreads. "Only v4.2 fails."
5. A rollback marker appears and the line drops. The stopwatch reads 4 minutes.

**The moment**: Beat 3: the marker landing just before the jump, then the version split confirming
it.

**Interaction**: Drag change events along the lane to see what lines up. The 13:10 flag flip is a
red herring that doesn't. Toggle the version split.

**Ending**: The chart with all its markers. Caption: "Mark every change. Most incidents start with
one."

**Variants**: `monitoring-dashboards`, `signal-correlation`, `audit-logs-vs-application-logs`;
automated canary analysis (Delivery).

**Techniques**: chart, lanes, appear / disappear, spotlight, timer, restyle, toggle, choice, caption.

**Review**: Keep — the marker 30 s before the jump plus the version split, with a red-herring flag flip, is realistic and shows how to read markers critically.

## Profiling and kernel-level observability

### Continuous profiling (`continuous-profiling`)

**The aha**: Metrics say the service is busy and traces say which call is slow. Only a profile says
which function burned the time, and keeping profiles always on lets you compare before and after a
deploy.

**Misconception to defeat**: That tracing already shows where the time goes, and that profiling is a
one-off you do on your laptop.

**Cast**: The API box with three lenses above it: a metric panel ("CPU 80%"), a trace span ("GET
/search 400 ms", a single solid violet bar with nothing inside) and an empty flame-graph frame.
Inside the API, a call stack drawn as a tower of function names that changes as the code runs. A
camera-flash sampler. A fleet strip of instances and a timeline several days long.

**Opening frame**: The three lenses, the first two filled and the third empty with "Which code?".
Caption: "Busy, slow… where?"

**Story**:

1. The metric says "busy". The trace says "400 ms in search", but the span is one opaque bar.
   "Metrics: that. Traces: where. Not which line."
2. Zoom into the process. The stack tower flickers as functions call each other. The sampler flashes
   100 times a second, and each flash copies the tower into a pile. "Snapshot the stack, 100 times a
   second."
3. The pile merges into a flame graph in the third lens. One box is far wider than the rest:
   `compileRegex` under `parseQuery`, at 45%. Slow down. "45% of CPU: compiling the same regex on
   every request."
4. Zoom out. The sampler flashes on every instance, all day, with an overhead meter at a few percent at most.
   "Always on, everywhere, cheap."
5. A deploy marker: "v4.2". The flame graphs from before and after appear side by side. In the diff
   view, `encodeJson` has widened and turns red. "Compare before and after. No need to reproduce
   it."

**The moment**: Beat 3: the opaque 400 ms bar opening into a flame graph with one obviously wide
box.

**Interaction**: Pick any two time ranges to compare. Switch the profile type (CPU, memory
allocations, lock wait).

**Ending**: The three lenses in a row, each more specific: "CPU 80%" → "search 400 ms" →
"`compileRegex`, line 88". Caption: "Profiles name the line."

**Variants**: `flame-graph`, `ebpf-observability`, `telemetry-signals`, `use-method`.

**Techniques**: zoom, clone, share, side by side, meter, timer, restyle, toggle, caption.

**Review**: Improved — profiler overhead is now "a few percent at most" rather than a flat 1%, which holds for eBPF profilers but not every language agent.

### Flame graphs (`flame-graph`)

**The aha**: In a flame graph, width is how often a function was on the stack, and the x-axis is not
time. Look for the widest boxes along the top edge.

**Misconception to defeat**: Reading it like a trace waterfall, where left means earlier.

**Cast**: Ten sampled call stacks as vertical towers, each stamped with the time it was taken. An
area where they assemble into a flame graph, callers at the bottom and callees on top. A trace
waterfall for comparison, its axis labelled "time →".

**Opening frame**: A finished flame graph next to a waterfall. An arrow sweeps across the flame
graph from left to right, reading "first parse, then render…". Caption: "They look alike. They read
differently."

**Story**:

1. Rewind to the raw material. Ten stacks arrive in time order, interleaved:
   `main›handle›parse›regex` ×4, `main›handle›render›template` ×3, `main›handle›db.query` ×2,
   `main›gc` ×1.
2. Slow down. The towers slide into alphabetical order, dropping their timestamps, and identical
   frames fuse into wider boxes: one `main` across all ten, `handle` across nine. "Sorted by name
   and merged. Time order is gone."
3. Width labels appear: `regex` 40%, `template` 30%, `db.query` 20%, `gc` 10%. "Width = share of
   samples."
4. Reading it: `handle` is wide but covered by its children, so it's only calling. `regex` is wide
   with nothing above it, a plateau: the code that's actually running. Spotlight it. "Wide at the
   top: that's where the time goes."
5. Side by side with the waterfall. There, x is time and order matters. Here, the leftmost box isn't
   first. "x ≠ time."
6. A differential view of a new version: `template` widens and turns red, `db.query` narrows and
   turns blue. "Red got slower."

**The moment**: Beat 2: the timestamped samples reshuffling alphabetically and fusing, so the viewer
watches the time axis being thrown away.

**Interaction**: Click a box to zoom into its subtree. Toggles for the differential view and for
off-CPU (time spent waiting on locks and I/O instead of running).

**Ending**: The finished flame graph with the `regex` plateau spotlighted. Caption: "Width is time
spent. Left to right means nothing."

**Variants**: `continuous-profiling`, `distributed-tracing` (the waterfall),
`critical-path-analysis`.

**Techniques**: move, regroup, share, side by side, spotlight, zoom, toggle, caption.

**Review**: Keep — stacks reshuffling alphabetically and fusing is the honest way to show the time axis being discarded; 4/3/2/1 samples and the red-wider/blue-narrower diff convention are correct.

### eBPF-based observability (`ebpf-observability`)

**The aha**: Small programs in the kernel see every network call and system call, so you get
telemetry from any process in any language without changing or restarting it. But they see the
edges, not the business meaning inside.

**Misconception to defeat**: That eBPF replaces SDK instrumentation; or, the opposite, that you have
to change code to observe a process.

**Cast**: Two layers. On top, user space with three processes: the API (Go, with an OTel SDK),
Billing (a legacy C++ binary labelled "no source, can't restart") and a third-party cache. Below, a
kernel band holding the network stack and the system-call doorway. eBPF probes: small hooks that clip
onto the band. A collector on the right.

**Opening frame**: The three processes on the kernel band, Billing greyed out with its label.
Caption: "How do you see into what you can't change?"

**Story**:

1. Requests travel down through the kernel band to the network and back up, for every process.
   "Everything goes through the kernel."
2. A verifier gate checks each small program, then the hooks clip onto the band at socket reads,
   writes and connects. The processes keep running, and their uptime counters don't reset. "Load
   into the kernel. No code change, no restart."
3. Each dot passing a hook throws off telemetry. `POST /invoice 200 32 ms` becomes blue RED numbers
   and a violet span, a `SELECT …` becomes a DB span, and DNS lookups appear too. Even encrypted calls are readable, because the hooks sit on the TLS
   library's read and write calls, before encryption. Billing, untouched, gets its own RED panel. Slow down. "Any language. Any binary."
4. An overhead meter stays near 1%. "Safe and cheap."
5. Zoom into Billing. Inside, the code applies a "gold tier" discount, but the kernel only ever saw
   `POST /invoice 200`. Next door, the API's SDK spans carry `customer.tier=gold` and `cart.size=3`.
   "It sees the edges, not the meaning."

**The moment**: Beat 3: a legacy binary nobody can touch lighting up with metrics and spans.

**Interaction**: Toggle eBPF and the SDK independently on each process and compare the telemetry
that appears.

**Ending**: Two panels: "eBPF: every process, the edges" and "SDK: your code, the meaning". Caption:
"It complements SDKs. It doesn't replace them."

**Variants**: `auto-vs-manual-instrumentation`, `continuous-profiling`, `red-method`, `service-map`.

**Techniques**: layers, token, appear / disappear, zoom, meter, side by side, toggle, caption.

**Review**: Improved — added how encrypted traffic is still readable (uprobes on the TLS library, before encryption), since the kernel alone sees only ciphertext; the edges-not-meaning ending stands.

## Correlation and debugging in production

### Correlating logs, metrics and traces (`signal-correlation`)

**The aha**: With shared IDs and names, the signals become one path: from the metric that alerted,
to a slow trace, to the exact log lines for that span.

**Misconception to defeat**: Three tools in three tabs, lining up the same moment by timestamp.

**Cast**: Three panels side by side: a metrics chart (blue), a trace waterfall (violet) and a log
list (grey). The glue, as coloured tags: `trace_id 4bf9…`, `span_id 00f0…`,
`service.name=payments`, `service.version=4.2`. The on-call figure's cursor and a stopwatch.

**Opening frame**: Three disconnected panels, with the same service named three ways ("payments",
"pay-svc", "PaymentsAPI"). Caption: "One incident. Three tools."

**Story**:

1. Without links, the cursor hops between panels typing "14:02:00–14:03:00" and scrolling through
   thousands of log lines. The stopwatch runs to 30 minutes. "Hunting by timestamp." Rewind.
2. The glue arrives. Every log line gains a `trace_id` and `span_id`, the latency chart gains
   exemplar diamonds, and all three panels agree on `service.name` and `service.version`. "Shared
   IDs. Shared names."
3. The p99 chart spikes and the bell rings. The cursor clicks an exemplar diamond on the spike, and a
   thread draws to one trace. "From the metric to a real slow request."
4. In the waterfall the Payments span is long and red. Click it, and a thread draws to the log panel,
   now filtered to that span: three lines, the last reading "card network timeout after 2 s". Slow
   down. "From the trace to its exact log lines."
5. The whole path lights up: metric → trace → logs. The stopwatch reads 1 minute.

**The moment**: Beats 3 and 4: one continuous thread through three panels, set against the
30-minute timestamp hunt.

**Interaction**: Cut a link (no `trace_id` in the logs, or mismatched service names) and watch the
thread snap, sending the figure back to searching by timestamp.

**Ending**: The three panels joined by one lit path. Caption: "Weak alone. Strong together."

**Variants**: `exemplars`, `correlation-ids`, `otel-semantic-conventions`, `wide-events`.

**Techniques**: side by side, path trace, appear / disappear, timer, restyle, toggle, spotlight,
caption.

**Review**: Keep — exemplar diamond to trace to span-filtered logs, against the 30 min timestamp hunt, is the canonical path and is accurate.

### Wide events (canonical log lines) (`wide-events`)

**The aha**: Emit one rich event per request per service, carrying all its context, instead of many
thin log lines and pre-counted metrics. Then you can ask questions nobody planned for.

**Misconception to defeat**: That structured logging is enough, and that more log lines mean more
information.

**Cast**: A request dot passing through the API. Two lanes below it. "Thin": short grey log lines and
a counter (`checkouts_total`). "Wide": a single card with empty field slots, attached to the request
as it travels.

**Opening frame**: The dot entering the API, both lanes empty. Caption: "One request, two ways to
record it."

**Story**:

1. Thin: as the request runs, lines appear one at a time ("start", "user loaded", "cache miss", "db
   120 ms", "payment ok", "done") and get shuffled in among lines from 50 other requests. The
   counter ticks +1 and records nothing about who or what. "The context scatters."
2. Wide: replay the same request. The card rides along and each step fills a slot: route, user_id,
   tenant, build, flags, cart_size, cache_hit, db_ms, payment_ms, status, duration_ms. At the end
   it's emitted once, with 40 fields. "One event. All the context."
3. A question nobody planned: "Why are some checkouts slow?" On the thin side, the counter can't say,
   and the lines would need joining across millions. On the wide side, filter `duration_ms > 2000`
   and the slow cards pull forward. Slow down: on each, the same three fields light up:
   `tenant=acme`, `build=7f3c`, `flag new_tax=on`. "The slow ones have this in common."
4. From the stack of cards, arrows draw a blue rate chart and violet spans. "Metrics and traces can
   be derived from events."

**The moment**: Beat 3: the same three fields lighting up on every slow card.

**Interaction**: Ask your own question by grouping on any field. The wide side answers. The thin
side shows "not recorded" or "join required".

**Ending**: A single complete card beside a scattered heap of thin lines. Caption: "Keep the context
together."

**Variants**: `structured-logging`, `high-cardinality-analysis`, `monitoring-vs-observability`,
`telemetry-signals`.

**Techniques**: side by side, contents, token, regroup, spotlight, appear / disappear, choice,
caption.

**Review**: Keep — the same three fields lighting up on every slow card is the clearest demonstration of questions nobody planned for.

### High-cardinality debugging (the core analysis loop) (`high-cardinality-analysis`)

**The aha**: Real incidents are usually "one customer, on one shard, after one deploy". Slicing raw
events by high-cardinality fields and comparing the outliers with everything else finds that, where
metrics have already averaged it away.

**Misconception to defeat**: That the averaged metric shows the shape of the problem: "everything
got a bit slower".

**Cast**: An average-latency line. A latency heatmap (time across, latency up, cells shaded by count)
built from thousands of event dots, each carrying fields: `tenant`, `shard`, `build`, `endpoint`,
`host`, `user_id`. A comparison panel with paired bars for each field: outliers (orange) and baseline
(grey).

**Opening frame**: The average line, up 4%. Caption: "A bit slower. For everyone?"

**Story**:

1. The line unfolds into its raw events, which spread into a heatmap. Most sit at 80 ms. A thin band
   floats at 3 s. "Not everyone. Some requests."
2. Draw a box around the high band. Those dots turn orange and the rest grey. "Outliers vs
   baseline."
3. The comparison panel fills, field by field. `endpoint` looks the same in both groups, and so does
   `host`. Then `tenant`: 92% of outliers are `acme`, against 3% of the baseline. That field rises
   to the top. Slow down. "What do the slow ones have in common?"
4. Filter to `tenant=acme` and compare again. `shard=17` and `build=7f3c` (deployed at 14:00) rise to
   the top, and filter chips line up: "One tenant, one shard, after the 14:00 deploy."
5. Back to the metric. Its labels are only `service` and `status`. Adding `tenant` or `user_id` would
   multiply its series, so they grey out with a cost tag. "A cost in metrics. The whole point in
   events."

**The moment**: Beat 3: paired bars nearly identical for every field except one that jumps out.

**Interaction**: Draw any selection on the heatmap, and the panel ranks the fields that differ most.
Keep filtering until the cause is isolated.

**Ending**: The filter chips `tenant=acme · shard=17 · build=7f3c` above a heatmap that's now almost
all orange. Caption: "Slice. Compare. Repeat."

**Variants**: `wide-events`, `metric-cardinality`, `monitoring-vs-observability`,
`latency-percentiles`.

**Techniques**: chart, regroup, side by side, restyle, spotlight, choice, caption.

**Review**: Keep — paired outlier/baseline bars with one field jumping out is the truest picture of BubbleUp-style analysis; the cardinality cost beat is accurate.

### Error tracking (`error-tracking`)

**The aha**: Ten thousand error lines are usually a handful of bugs. Grouping them by fingerprint,
and tying each to the release that introduced it, turns a firehose into a prioritised bug list.

**Misconception to defeat**: That an error-rate graph, or scrolling through error logs, tells you
which bugs to fix.

**Cast**: A wall of stack traces scrolling down from the API and Web. A fingerprint stamp. Five issue
cards, each with a count, users affected, the release it was first seen in, and a sparkline. A
release lane with v4.1, v4.2 and v4.3.

**Opening frame**: "10,412 errors in the last hour" over the scrolling wall. Caption: "Where do you
start?"

**Story**:

1. Zoom in on three errors: "order 123 not found", "order 9876 not found", "order 55 not found".
   Different messages, the same stack. "Different text. Same bug."
2. Each error passes under the stamp. The variable parts are masked, the stack becomes a fingerprint,
   and errors with the same fingerprint fly into the same pile. Slow down as 10,412 errors settle
   into five piles. "10,412 errors. 5 bugs."
3. The piles become cards and sort by users affected. "TypeError in tax calc · 3,100 users · new in
   v4.2" is at the top, and "timeout in legacy export · 12 users · since v3.0" at the bottom.
4. On the release lane, the top card's sparkline starts exactly at v4.2. "Introduced by v4.2."
5. A card that was resolved in v4.1 reappears after v4.3 with a "Regressed" badge.

**The moment**: Beat 2: the firehose collapsing into five piles.

**Interaction**: Sort by count, users affected or newest. "Deploy a fix" drops a card's sparkline to
zero. "Deploy v4.3" reopens a regression.

**Ending**: The five cards in priority order. Caption: "A firehose becomes a bug list."

**Variants**: `structured-logging`, `change-events`, `signal-correlation`, `red-method`.

**Techniques**: regroup, zoom, contents, chart, lanes, restyle, choice, caption.

**Review**: Keep — 10,412 errors settling into five piles, then the release lane and a regression badge, covers fingerprinting and release tracking cleanly.

## Cost and data management

### The cost of observability (`observability-cost`)

**The aha**: Telemetry grows with traffic and with every new label and log line, and its bill can
rival the system's. The cheapest data is data you never send, so cut at the source and in the
pipeline, and keep errors, slow requests and SLIs at full fidelity.

**Misconception to defeat**: That telemetry is free, so you should keep everything "just in case".

**Cast**: The house system, its grey, blue and violet telemetry streams running through a pipeline
with valves into the backend. Two bill meters: "System" and "Observability". A stacked bar splitting
the observability bill by cost driver. Lever knobs at the source and along the pipeline.

**Opening frame**: The bills side by side: system $40k a month, observability $12k. Caption:
"Watching it costs money too."

**Story**:

1. Traffic doubles. Every stream thickens and the observability meter climbs. "It grows with
   traffic."
2. A developer adds `user_id` as a metric label, and one blue line fans out into thousands. Another
   leaves DEBUG logging on in a hot loop, and the grey stream floods. Slow down: the observability
   meter reaches $38k, almost level with the system's. "Every label and line adds up."
3. The bill splits into its stacked bar: indexing, volume ingested, series count (cardinality),
   retention, and queries and egress.
4. Pull the levers one at a time, each shrinking its slice: DEBUG off at the source; health-check
   logs dropped in the pipeline; `user_id` removed from the metric (it belongs on traces);
   successful traces sampled at 1 in 10 once complete (tail sampling), each one kept stamped "×10"; full-text indexing switched
   to labels only.
5. Meanwhile, error traces, slow traces and SLI metrics take a fast lane through the pipeline,
   untouched and outlined in gold. "Cut the routine. Keep what matters at full fidelity."

**The moment**: The bill catching the system's in beat 2, then beat 5: successful traffic thinning
while errors pass through whole.

**Interaction**: A dial for each lever, with a live bill. A "replay last week's incident" button
checks whether the data you'd need survived. Cutting too much fails it.

**Ending**: The bills side by side again, system $40k and observability $9k, with a checklist of
kept signals all green.

**Variants**: `trace-sampling`, `metric-cardinality`, `log-levels`, `telemetry-pipeline`,
`telemetry-retention-tiers`, `metric-aggregation-and-rollups`.

**Techniques**: stream, meter, share, side by side, path trace, restyle, dial, choice, caption.

**Review**: Improved — "keep errors and slow traces while sampling successes" needs tail sampling, so the sampling lever now says so.

### Retention tiers and downsampling (`telemetry-retention-tiers`)

**The aha**: Keep data at the resolution and price its age calls for: raw and fast for days of
debugging, rolled up and cheap for months of trends, archived for compliance, then deleted.

**Misconception to defeat**: That the only choices are keeping everything at full resolution forever
or deleting it after 30 days; and that retention is the same thing as backups.

**Cast**: A conveyor running left to right by age, through four zones with price tags: Hot (0–7
days, indexed, $$$$), Warm (7–90 days, $$), Cold (90 days to 13 months, $), then a shredder. Data as
blocks, dense at first. A separate lane below for audit logs, with a padlock. Two figures: an
engineer debugging and a planner looking at yearly trends.

**Opening frame**: The conveyor with its zones and prices, and one fresh block entering Hot. Caption:
"Data ages. Its job changes."

**Story**:

1. A day's block sits in Hot: 10-second points, every log line indexed. The engineer asks about last
   Tuesday's incident and the answer comes back in a second. "Debug with last week: raw and fast."
2. At day 7 the block compacts. Its 10-second points fuse into 5-minute rollups (min, max, sum,
   count), it shrinks to a thirtieth of its size, and it slides into Warm. Latency is kept as histograms,
   since an average of p99s would be meaningless. "Older: rolled up, cheaper."
3. At day 90 it compacts again into hourly points and moves to Cold. The planner asks "traffic this
   year vs last" and gets the answer from rollups. "Plan with last year: trends are enough."
4. At 13 months: the shredder.
5. Below, the audit lane moves on its own clock: full fidelity, locked, kept seven years. "Audit data
   follows its own rules." A backup icon stays off the conveyor: backups restore after a disaster;
   retention only decides how long to keep.
6. Slow down. Two cost bars side by side, "everything hot for 13 months" and "tiered", the second a
   small fraction of the first, with both figures' questions still answered.

**The moment**: Beat 6: a far smaller bill with the same questions still ticked off.

**Interaction**: A dial for each zone's length, with a live cost meter and a checklist: "debug last
week's incident", "year-on-year traffic", "who changed this IAM role three years ago", "find one
specific request from six months ago". The last passes only if raw data is kept that long, at a
cost.

**Ending**: The conveyor running in a steady state. Caption: "Raw for days. Rollups for months.
Archive for the rules."

**Variants**: `metric-aggregation-and-rollups`, `observability-cost`,
`audit-logs-vs-application-logs`; backups (Data).

**Techniques**: lanes, move, restyle, timer, meter, side by side, dial, caption.

**Review**: Improved — added that latency must be kept as histograms to survive rollups (averaged p99s are meaningless) and that retention is not backups, which the misconception named but the story never addressed.
