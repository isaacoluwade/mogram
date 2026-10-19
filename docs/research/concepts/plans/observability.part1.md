# Observability plans, part 1

Stage 2 plans for the observability catalog, from "Foundations" to "OpenTelemetry", in catalog
order. They share the visual language described at the top of part 2: **the house system** (Web →
API → DB, with API also calling Payments), requests as dots that turn red when they fail, grey log
lines, blue metric numbers and charts, violet spans on a waterfall, a bell and pager for alerts.
Two conventions start here: a trace ID shown as a short amber stamp (`7f3a`), and **linked
highlight** (a new technique, defined in `telemetry-signals`) in gold.

## Foundations

### Monitoring vs observability (`monitoring-vs-observability`)

**The aha**: Monitoring answers the questions you wrote down in advance. Observability lets you ask a new question about a failure nobody predicted, without shipping new code.

**Misconception to defeat**: "We have dashboards and alerts on everything (and a logs, a metrics and a tracing tool), so we'll see any problem."

**Cast**: Web → API → DB plus Payments, requests as white dots. Top right: a dashboard of three small panels, each titled with its pre-written question ("CPU > 80%?", "Errors > 1%?", "p99 > 500 ms?"), with a dashed threshold line and a bell. Bottom right: a query bar over a cloud of small event dots, one per request, each carrying fields (`app_version`, `currency`, `endpoint`).

**Opening frame**: Traffic flowing, all three panels green with ticks. "Monitoring" labels the panels, "Observability" labels the query bar.

**Story**:

1. DB CPU climbs. The CPU panel crosses its line, the bell rings, the pager buzzes. Caption: "A failure you predicted. Monitoring catches it."
2. Reset. Now checkouts from app v5.2 paying in CAD start failing at Payments (red dots). The overall error rate rises to 0.4%, under the 1% line. Every panel stays green. Caption: "A failure nobody predicted."
3. A support ticket arrives: "Checkout is broken for me." To answer it from the dashboard, a ghosted path appears: "add a metric → deploy → wait a day". Caption: "Monitoring only answers the questions it was built for."
4. The query bar types "failed checkouts, group by app_version". The event dots slide into bars; v5.2 is the only red one. Then "…and by currency": CAD. Caption: "Observability: ask a new question of data you already have."

**The moment**: Beat 4, slowed: thousands of dots sort themselves and one red bar stands alone, beside a dashboard that is still entirely green.

**Interaction**: Choose a failure. "DB overloaded": the dashboard catches it. "v5.2 + CAD fails": the dashboard stays green, and the viewer picks group-by fields until the failures separate from the rest.

**Ending**: Both halves side by side: the dashboard that caught the DB overload, and the query that found v5.2 + CAD. Caption: "Monitoring catches what you predicted. Observability explains what you didn't."

**Variants**: `telemetry-signals`, `high-cardinality-analysis`, `wide-events`, `monitoring-dashboards`.

**Techniques**: side by side, token, chart, failure, move, spotlight, choice, caption.

**Review**: Improved — the ending claimed the bell pointed at Payments, but no alert fired for the CAD failure; it now pairs the two halves truthfully. The misconception now names what the story defeats. Weighed "known vs unknown unknowns" as a framing; the green-dashboard-beside-a-red-bar contrast is sharper.

### The telemetry signals and when to use each (`telemetry-signals`)

**The aha**: Each signal answers a different question at a different cost: a metric says _that_ something changed, a trace says _where_, a log says _exactly what_, a profile says _which line_. You go from one to the next.

**Misconception to defeat**: Logs, metrics and traces are interchangeable "pillars": pick one, or treat them as three copies of the same data.

**Cast**: The four services. Rising from each: blue numbers into a metrics chart, violet span bars into a waterfall, grey text lines into a log panel, orange flame stacks into a profile panel. A deploy event is a small flag. The four panels stack on the right, each headed by its question ("Did something change?", "Where?", "What exactly?", "Which line of code?") and a cost tag from $ to $$$.

**Opening frame**: Traffic flowing. The four streams rise at visibly different thicknesses: metrics a thin trickle, logs a torrent.

**Story**:

1. A volume meter under each panel fills at its own rate. Caption: "Same system. Very different volume and cost."
2. A deploy flag, "Payments v4.2", drops onto the chart. Seconds later the latency line jumps and the bell rings. Caption: "Metric: something changed. Cheap enough to alert on."
3. Click the spike: one slow trace opens. Its Payments span is stretched, and Payments lights up in the diagram. Caption: "Trace: where in the request."
4. Click that span: its log lines appear, `fraud_check took 1,240 ms (rules=v2)`. Caption: "Log: exactly what happened."
5. Click Payments' profile: one wide box, `regex.match` inside `fraudScore()`. Caption: "Profile: which line of code."

**The moment**: As the viewer moves down the panels, a funnel counter on the left shrinks: "2 million requests → 1 trace → 1 log line → 1 function." Each signal narrows the one before it.

**Interaction**: Question cards to drop onto a panel: "Is checkout slower?", "Which service?", "Why did order 881 fail?", "What burns the CPU?". Dropping one on the wrong panel shows why it fails (the metric can't name the order).

**Ending**: The path metric → trace → log → profile drawn as one line through the four panels.

**Variants**: `signal-correlation`, `exemplars`, `change-events`, `continuous-profiling`, `distributed-tracing`.

**Techniques**: stream, meter, chart, linked highlight (new: selecting or hovering an element in one view lights its counterpart in another, such as a span and its service), zoom, path trace, choice, caption.

**Review**: Keep — four questions, four panels, one funnel that narrows from 2 million requests to one function; the wrong-panel drop in the interaction defeats the "interchangeable pillars" idea directly. Weighed a cost-only framing (metrics cheap, logs dear); the question-per-signal framing is what people need first.

### Telemetry pipeline (`telemetry-pipeline`)

**The aha**: Telemetry is data with a supply chain. A pipeline between your apps and your backends lets you enrich, scrub, sample and reroute it without touching application code.

**Misconception to defeat**: Apps talk straight to the backend, so changing anything about telemetry means changing every app.

**Cast**: The four services on the left emitting mixed grey, blue and violet signals. In the middle, once inserted, a conveyor with stations: a buffer, an enrich stamp, a scrub mask, a sampling sieve, a batch packer. On the right, Backend A and later Backend B. A cost meter and a "redeploys" counter.

**Opening frame**: Four services, each wired directly to Backend A, each wire tagged with that app's own settings card (endpoint, key, sample rate).

**Story**:

1. Caption: "Switch to Backend B." Every settings card has to be edited, and each service spins a redeploy icon. Counter: 4. Caption: "Without a pipeline, every change touches every app."
2. Rewind. The wires bend into one conveyor. Apps drop their telemetry into the buffer and immediately go back to work. Caption: "Apps hand off. The pipeline does the rest."
3. Stations light in turn. The stamp adds `region=eu`. The mask turns `card=4111…` into `****`. The sieve drops 90% of successful traces and keeps every red one, and the cost meter falls hard. The packer bundles crates. Captions: "Enrich", "Scrub", "Sample", "Batch".
4. Caption: "Switch to Backend B." One switch at the conveyor's end flips, and crates flow to both backends. Redeploys: 0.
5. Backend A goes dark. The buffer swells, apps carry on unaffected, and it drains when A returns. Caption: "The buffer absorbs the outage."

**The moment**: Beat 4 replays beside beat 1: the same request costs four redeploys on the left and one switch on the right.

**Interaction**: Toggle each station. With scrub off, card numbers land in the backend in red. With sampling off, the cost meter climbs. Flip the destination switch to any backend.

**Ending**: Steady state: apps → pipeline → two backends, cost meter low.

**Variants**: `otel-collector`, `otel-collector-pipeline`, `observability-cost`, `pii-in-logs`, `trace-sampling`, `log-aggregation`.

**Techniques**: stream, token, contents, restyle, meter, failure, side by side, toggle, caption.

**Review**: Improved — the cost meter no longer falls at the enrich and scrub stations (they add work, not savings); sampling now carries the drop. The opening wires carry per-app settings rather than a "Vendor A SDK", so the before-picture is a redeploy (config in every app), leaving the re-instrumentation story to `opentelemetry`. Beat 5 gained a caption.

## Logs

### Structured logging (`structured-logging`)

**The aha**: A log line is data, not prose. Fields can be filtered, counted and grouped; a sentence has to be parsed, and the parsing breaks silently when someone rewords it.

**Misconception to defeat**: Logs are messages for a human to read, and neat formatting makes them "structured".

**Cast**: Payments writing into two log panels side by side. Left, "Text": `Payment failed for order 123 after 840ms`. Right, "Structured": `{"event":"payment_failed","order_id":123,"latency_ms":840,"provider":"acme"}`. Above each, a small blue chart, "failed payments / min". On the left, a regex drawn as a fragile stencil.

**Opening frame**: The same failure written both ways, side by side. Caption: "Same event, written two ways."

**Story**:

1. Lines stream into both panels. A question appears: "How many payments failed, and how slow were they?"
2. Left: the regex `/Payment failed for order (\d+) after (\d+)ms/` slides over each line and punches out the numbers; the chart builds. Right: the query `event=payment_failed` simply lights the matching lines, and their fields line up into table columns. Caption: "Text: parse it. Structured: query it."
3. A deploy flag: someone rewords the message to `Order 124: payment failed (910 ms)`. New lines pass under the stencil unlit. The left chart drops to zero while Payments keeps flashing red. The right chart doesn't change. Caption: "Reword the sentence, and the regex breaks without a sound."
4. Right only: the table regroups by `provider`, and every failure sits under `acme`. Caption: "Fields can be filtered, counted and grouped."

**The moment**: Beat 3, slowed: the left chart falls to an "all clear" while the Payments box is still flashing red. A broken parser looks exactly like a recovery.

**Interaction**: Edit the text message's wording and watch which chart survives. Click any field on the right to group by it.

**Ending**: Right: a tidy table above a steady chart. Left: a broken stencil above a flat line.

**Variants**: `log-levels`, `wide-events`, `log-based-metrics`, `correlation-ids`, `otel-semantic-conventions`.

**Techniques**: side by side, stream, contents, spotlight, chart, failure, move, choice, caption.

**Review**: Keep — the silent regex failure (a broken parser that looks like a recovery) is the sharpest possible contrast with a queryable field, and the claims are right. Weighed a "grep vs SQL" framing; the reworded-message failure is more memorable.

### Log levels (`log-levels`)

**The aha**: A level is a volume dial set at the source. Run production at INFO and the DEBUG lines you'll want during an incident were never written. And ERROR should mean someone needs to act.

**Misconception to defeat**: "Everything is recorded, and I filter by level when I search." Also: an ERROR line is an alert.

**Cast**: API emitting grey log lines, each with a coloured level stripe (DEBUG pale, INFO grey, WARN amber, ERROR red). A dial on the API box, TRACE to FATAL. A gate at the service's edge where filtered lines dissolve. A log store on the right with a cost meter and a query bar.

**Opening frame**: Dial at INFO. API spits out many lines; most are DEBUG, which hit the gate and puff away. INFO, WARN and ERROR fly on to the store.

**Story**:

1. Turn the dial to DEBUG: the stream thickens tenfold and the cost meter races. Back to INFO. Caption: "The level is a volume dial."
2. 14:02: an ERROR arrives, `charge failed for order 881`. The engineer queries "every line for order 881, including DEBUG". The result shows dashed empty outlines where the DEBUG lines would be. Caption: "Dropped at the source. They never existed."
3. The two filters are compared: the gate at the service decides what exists; a sieve at the store only narrows what was kept. Caption: "A query can't bring back what was never written."
4. A flood of `ERROR cache miss` lines pushes the ERROR count to 4,000 an hour, and the real failure hides among them. They're restyled to INFO, and the ERROR panel drops to the one line that matters. Caption: "ERROR means a person should act."

**The moment**: Beat 2: the dashed outlines, absence made visible, right where the answer should be.

**Interaction**: Drag the dial. The cost meter moves with it, and beat 2's question returns either real DEBUG lines or empty outlines. The viewer feels the trade between cost and evidence.

**Ending**: Dial back at INFO, a clean store. Caption: "Choose the level before you need the line."

**Variants**: `structured-logging`, `observability-cost`, `alert-rules`, `pages-vs-tickets`.

**Techniques**: stream, dial, meter, appear / disappear, contents, restyle, spotlight, caption.

**Review**: Keep — the dashed empty outlines where DEBUG lines should be make "never written" visible, and the ERROR-flood beat separates a log level from an alert. Weighed a "radio volume knob" metaphor; the dial plus gate already is one.

### Log aggregation (`log-aggregation`)

**The aha**: Logs left on short-lived instances vanish with them and can't be searched together. Ship them to one place, and one query covers every replica, even the ones that no longer exist.

**Misconception to defeat**: "The logs are on the server. I'll SSH in and grep."

**Cast**: API scaled to four replicas (API-1 to API-4), each a small rounded box with a log file icon inside filling with grey lines. A node agent (a small collector shape) beside each. A central log store on the right with a search bar. A cursor for the engineer.

**Opening frame**: Four replicas, four separate little log files, nothing leaving any box.

**Story**:

1. A checkout fails. The cursor hops into API-1, greps for the error: nothing. API-2: nothing. Caption: "Logs live on each machine. Search them one by one."
2. Before it reaches API-3, the autoscaler scales in. API-3 fades out, taking its log file and the one red line inside it. Caption: "The machine is gone. So is the evidence."
3. Rewind. Apps write to stdout; each agent tails it and streams the lines to the store, stamping each with `pod` and `node`. Caption: "Ship every line to one place."
4. Same failure, and API-3 is scaled away again, but its lines are already in the store. One query, `service=api level=error`, returns lines from all four replicas, API-3's tagged "terminated". Caption: "One query. Every replica, even the ones that are gone."

**The moment**: Beats 2 and 4 side by side. The replica disappears in both; on the right, its red line survives under a ghost outline of the pod.

**Interaction**: "Kill a replica" in either mode. A replica-count dial from 4 to 40: the SSH path grows to 40 hops, while the query stays one.

**Ending**: The central store holding lines from five pods, two of them ghosts.

**Variants**: `telemetry-pipeline`, `otel-collector`, `correlation-ids`, `telemetry-retention-tiers`.

**Techniques**: contents, stream, appear / disappear, failure, path trace, spotlight, side by side, dial, caption.

**Review**: Keep — the replica vanishing with its evidence, replayed with a surviving ghost line, is the whole point, and the 4-to-40 dial makes the SSH path absurd. Weighed "black box flight recorder" as a metaphor; the replay is more direct.

### Correlation IDs (`correlation-ids`)

**The aha**: Stamp one ID on a request where it enters and write it into every log line. Then one filter puts that request's whole story back together across every service.

**Misconception to defeat**: "Just filter by user ID." That finds a person across many requests, not one request, and most downstream services never see it.

**Cast**: Web → API → Payments → DB with several request dots in flight. One central log stream on the right, scrolling fast with interleaved grey lines from every service, each tinted with its service's colour.

**Opening frame**: Busy traffic, the log stream a blur. Caption: "One failed checkout. Four services. Millions of lines."

**Story**:

1. Search "error": 40 lines from a dozen requests in the same second. Which belong to this checkout? Caption: "Timestamps don't tell you which lines go together."
2. Filter `user_id=42`: lines from three of that user's requests (browse, add to cart, checkout) jumbled together, and nothing from Payments or DB, which never knew the user. Caption: "A user ID finds the person, not the request."
3. Rewind. As a dot enters Web it gets an amber stamp, `7f3a` (a made-up short form: a real trace ID is 32 hex characters), unless the caller already sent one, in which case Web keeps it. At every hop the stamp rides along in a header, and the logging library copies it from the request context into every log line that service writes, as an amber `7f3a` chip. Caption: "Stamp the request at the door."
4. Filter `trace_id=7f3a`. Everything else dims; six lines slide out of the stream and stack in time order: Web `POST /checkout`, API `calling payments`, Payments `card declined: insufficient_funds`, API `returning 502`… Caption: "One filter. The whole story."

**The moment**: Beat 4, slowed: the blur dims, six lines from four services snap into one ordered column, and the same path lights up in the diagram.

**Interaction**: Click any dot to filter by its ID. Toggle "API forgets to pass the ID": Payments' and DB's lines lose their chips, and the story stops at API.

**Ending**: The reassembled story beside the lit path.

**Variants**: `context-propagation`, `w3c-trace-context`, `distributed-tracing`, `signal-correlation`.

**Techniques**: token, restyle, stream, spotlight, move, path trace, toggle, caption.

**Review**: Improved — beat 3 now says the logging library copies the ID from the request context (nobody types it by hand), that an incoming ID is kept rather than replaced, and that the short stamp stands in for a 32-hex trace ID, which is today's usual correlation ID. Weighed a "package tracking number" metaphor; the blur snapping into one column is stronger.

### PII and secrets in telemetry (`pii-in-logs`)

**The aha**: Telemetry is copied everywhere: agents, pipelines, vendors, backups, dashboards. A secret logged once is as good as published, so redact it at the source.

**Misconception to defeat**: "It's encrypted at rest", or "the pipeline scrubber will catch it."

**Cast**: Payments emitting one log line with red-highlighted fields: `email: ana@example.com`, `card: 4111 1111 1111 1111`, `token: eyJhbGci…`. Downstream: a node agent, the pipeline, a vendor backend, a backup tape, two dashboards, a crowd of engineer avatars. A lock icon for encryption. A counter: "copies showing the card".

**Opening frame**: The one red-flagged line leaving Payments.

**Story**:

1. The line travels right and is cloned at every hop: a copy stays in the agent's buffer, one on the pipeline's disk, one at the vendor, one on the backup, one in each dashboard. The counter climbs to 6. Caption: "Telemetry gets copied everywhere."
2. A lock snaps onto the backend: "encrypted at rest". Forty engineer avatars run queries, and each sees the card number in plain text. Caption: "Encrypted. Still readable by everyone who can query."
3. Retention timers appear on each copy: 7 days, 30 days, 1 year, 7 years. Caption: "And kept for years."
4. Add a pipeline scrubber. It masks the `card` field for everything after it (vendor, backup, dashboards go grey), but the copies made before it, in the agent's buffer and the pipeline's intake, still show the card, and the token buried in a free-text `message` slips past the masking rule entirely. The counter drops from 6 to 2, not 0, and the token stays visible downstream. Caption: "A scrubber is a backstop, not the plan."
5. Change Payments' code to log `card_last4: 1111` and no token. Replay: every clone downstream is grey. Counter: 0. Caption: "Redact at the source, and every copy is safe."

**The moment**: Beat 5 replays beat 1's fan of copies, red turning grey all at once as the counter drops to 0.

**Interaction**: Choose where to redact (nowhere, in the pipeline, at the source) and where the secret leaks (log line, span attribute, metric label, baggage), and watch the counter.

**Ending**: The clean fan of copies, counter at 0.

**Variants**: `telemetry-pipeline`, `baggage-propagation`, `audit-logs-vs-application-logs`, `otel-collector-pipeline`.

**Techniques**: clone, token, meter, timer, restyle, failure, choice, caption.

**Review**: Improved — the beat 4 counter arithmetic is now consistent (6 copies; a scrubber only helps copies downstream of it, so it drops to 2, and the free-text token still leaks). The fan of copies going grey in beat 5 stays the moment. Weighed a "you can't unring a bell" framing; the copy counter makes it measurable.

### Log-based metrics (`log-based-metrics`)

**The aha**: Count the matching log lines as they arrive and keep only the number. You get a cheap, fast time series you can alert on, and it outlives the logs it came from.

**Misconception to defeat**: "Run a log search every minute and alert on the result."

**Cast**: A grey log stream pouring into a large log store on the right. A small tally gate at the store's entrance with a pattern card, `event=payment_failed`. A blue chart and a bell above the store. A scan-cost meter. A retention timer on the store: "7 days".

**Opening frame**: Logs pouring into the store under an empty blue chart.

**Story**:

1. The old way: every minute a scanning beam sweeps the whole store, the cost meter ticks, and the answer arrives 40 seconds later. As the store grows, each sweep takes longer. Caption: "Re-scanning logs every minute: slow and costly."
2. The tally gate switches on. Each matching red line flicks the counter as it passes: 1, 2, 3. Every minute the count drops onto the chart as a blue point and the counter resets. Caption: "Count at ingest. Keep the number."
3. A threshold line appears on the chart. A burst of failures pushes a point over it, and the bell rings within seconds. The scan meter stays flat. Caption: "Alert on something only the logs knew."
4. The calendar flips forward. The retention timer runs out and week-old logs dissolve from the store, but the chart's points stay, a year long. Caption: "The logs expire. The metric stays."
5. A second gate pulls `latency_ms` out of each line into a latency chart. Caption: "Count lines, or measure a field."

**The moment**: Beat 4: the store empties behind the chart while the blue line runs on unbroken.

**Interaction**: Edit the pattern. The new metric starts at "now", and the chart to its left stays empty: a log-based metric only counts lines that arrive after you create it. Add a label pulled from the line: `provider` splits the series into a few; `user_id` shatters it (see `metric-cardinality`).

**Ending**: A small store holding a week of logs beneath a year-long chart.

**Variants**: `metric-time-series`, `structured-logging`, `alert-rules`, `telemetry-retention-tiers`, `observability-cost`.

**Techniques**: stream, meter, chart, timer, appear / disappear, choice, caption.

**Review**: Improved — the interaction now covers labels extracted from log fields, where log-based metrics inherit the cardinality trap. The tally gate and the store emptying behind an unbroken line carry the idea. Weighed starting from the retention angle; the slow, costly re-scan is the more relatable pain.

### Audit logs vs application logs (`audit-logs-vs-application-logs`)

**The aha**: They look alike but follow opposite rules. Application logs can be sampled, dropped and expired. Audit logs must be complete, tamper-evident, access-controlled and kept for years.

**Misconception to defeat**: An audit log is just another log stream, or the HTTP access log.

**Cast**: Two lanes rising from the services. Grey lane: application lines (`cache miss`, `retrying gateway`). Gold lane: audit records (`admin@co deleted customer 88 from 10.0.0.4 at 14:02`), each tied to the one before by a small chain link (the hash of the previous record, so an edit or a deletion breaks the chain). Two stores: "App logs", with a sampler, a 14-day timer and a crowd of readers; "Audit vault", with an append-only slot, a 7-year timer and two readers.

**Opening frame**: Both lanes merging into one shared stream. Caption: "They look alike."

**Story**:

1. Costs rise, so a sampler goes onto the shared stream and drops 90%. Nothing that matters is lost from the grey lane. Caption: "App logs: sample, drop, expire. Nobody minds."
2. The same sampler swallows a gold record. Later an auditor asks, "Who deleted customer 88?" The chain shows a gap where that record should be. Caption: "Mix them, and saving money breaks the audit trail."
3. Split the lanes. The gold lane goes to the vault, which only appends. Someone tries to edit a record, and the next chain link snaps red. Caption: "Audit: complete, append-only, tamper-evident."
4. Readers and timers appear: many engineers and 14 days for grey; two auditors and 7 years for gold. Caption: "Different readers. Different lifetimes."

**The moment**: Beat 2, slowed: the gap in the gold chain, right where the auditor's question points.

**Interaction**: Toggle "one stream / two streams", then apply sampling or 14-day retention. An "audit completeness" meter shows which settings break the trail.

**Ending**: Two lanes, two stores, and a rule card under each (Sample: yes / never. Edit: n/a / never. Readers: many / few. Keep: days / years).

**Variants**: `pii-in-logs`, `telemetry-retention-tiers`, `change-events`.

**Techniques**: lanes, contents, failure, timer, boundary, toggle, meter, caption.

**Review**: Improved — the chain link is now spelled out as a hash of the previous record, which is what makes a gap or an edit visible. The gap at the auditor's question is the moment. Weighed contrasting with the HTTP access log; the shared-stream sampler failure is a more memorable break.

## Metrics

### Metrics as labelled time series (`metric-time-series`)

**The aha**: A metric is a name plus labels, and every unique combination of label values is its own time series. Labels let you slice, and labels multiply what you store.

**Misconception to defeat**: A metric remembers each event (it keeps only a running number), or one metric is one line on a chart.

**Cast**: API with request dots passing through. On the box, a blue counter, `http_requests_total`. A chart on the right. Beneath it, a series list with one row and a sparkline per series, and a series counter.

**Opening frame**: API with a single blue number ticking upward, `1,204`. One line on the chart. Series: 1.

**Story**:

1. Each dot passing through bumps the number and vanishes. A ghost log line appears beside it and fades. Caption: "A metric keeps the count, not the requests."
2. Every 15 seconds a (time, value) point drops onto the chart. Caption: "A series: timestamped samples."
3. Add the label `status`. The number splits in two (`200`, `500`), the line clones into two lines, and the list grows to two rows. Caption: "A label splits it."
4. Add `region` (eu, us, ap). Each splits again: six numbers, six lines, six rows. Series: 6. Caption: "Every unique combination is its own series."
5. Query "500s by region": the three red lines light up, and `ap` is spiking. Caption: "Labels let you slice…" The series counter pulses. "…and they multiply what you store."

**The moment**: Beats 3 and 4: one line visibly splitting into two, then six, with the row count growing in step.

**Interaction**: Add and remove labels and change how many values each has; lines, rows and counter update. Click a row to spotlight its line.

**Ending**: Six lines, with `http_requests_total{status="500",region="ap"}` highlighted and its full name written out.

**Variants**: `metric-cardinality`, `metric-types`, `metric-aggregation-and-rollups`, `log-based-metrics`.

**Techniques**: meter, chart, clone, contents, token, appear / disappear, spotlight, choice, caption.

**Review**: Improved — fixed the garbled misconception line. The one-line-splitting-into-six is the right moment and the data model (name plus labels, samples at an interval) is accurate. Weighed a spreadsheet metaphor; the splitting lines show multiplication better.

### Metric types: counter, gauge, histogram, summary (`metric-types`)

**The aha**: Pick the type from the question. A counter only goes up and is graphed as a rate, a gauge is a snapshot, a histogram keeps the shape. The wrong type gives quietly wrong graphs.

**Misconception to defeat**: Counters and gauges are interchangeable, so a "requests since last scrape" gauge is fine.

**Cast**: Instruments on the API box: a counter as an odometer, a gauge as a needle (queue depth), a histogram as a row of buckets (≤100 ms, ≤250 ms, ≤500 ms, ≤1 s, +Inf), and a summary as a sealed box that prints "p99 = …". A scraper on the right with a 15-second timer. A chart under each instrument.

**Opening frame**: The four instruments in a row, each headed by its question: "How many so far?", "How much right now?", "How spread out?", "One quantile, precomputed".

**Story**:

1. Counter: the odometer climbs. Its raw chart is a ramp that mostly shows uptime. Apply `rate()` and the chart becomes requests per second. Caption: "Graph a counter as a rate."
2. The process restarts and the odometer drops to 0. `rate()` reads the drop as a reset, not a crash in traffic.
3. Side by side with a "requests since last scrape" gauge. A scrape fails (red X). The counter's next reading still includes the missed requests; the gauge's interval is simply gone, a shaded hole. Caption: "Counters survive missed scrapes."
4. Gauge: the queue-depth needle swings up and down. Caption: "A gauge is a snapshot."
5. Histogram: request dots drop into buckets by latency, each bucket a counter that only goes up (and, in Prometheus, counts everything at or under its bound, so the rows stack as a staircase). The shape has a long tail, while the summary prints its single number, `p99 = 480 ms`, worked out inside the app and fixed from then on. Caption: "A histogram keeps the shape. A summary keeps one answer." (Why that matters: `percentiles-from-histograms`.)

**The moment**: Beat 3, slowed: the same missed scrape leaves the counter's line whole and punches a hole in the gauge's.

**Interaction**: Buttons: "miss a scrape", "restart the process". A sorting game: drag a question ("queue length now?", "requests per second?", "p99 across the fleet?") onto an instrument and see the graph it produces, right or quietly wrong.

**Ending**: Each instrument above its correct graph.

**Variants**: `percentiles-from-histograms`, `latency-percentiles`, `push-vs-pull-collection`, `metric-time-series`.

**Techniques**: meter, chart, contents, timer, failure, side by side, choice, caption.

**Review**: Improved — beat 5 now says histogram buckets are counters (cumulative in Prometheus) and that the summary's number is precomputed in the app, setting up `percentiles-from-histograms`. The missed-scrape contrast (whole counter line, holed gauge line) stays the moment. Weighed starting with the four instruments equally; the counter-vs-gauge failure is the one people actually get wrong.

### Latency percentiles (p50, p95, p99) (`latency-percentiles`)

**The aha**: Averages hide pain. A 120 ms average can sit on top of 1–2% of requests waiting 5 seconds, and the p99 is what your unluckiest regular users get.

**Misconception to defeat**: Average latency describes what users experience.

**Cast**: A horizontal latency axis. 1,000 request dots that fall onto it as they finish, piling up like a dot plot. Markers for the average, p50, p95 and p99. Small user avatars on some dots. A time chart on the right.

**Opening frame**: A dashboard tile, "Avg latency 124 ms", in green.

**Story**:

1. Dots fall. Most pile up around 50 ms. Fifteen fall far to the right, slowly, at about 5 s. Caption: "1,000 requests."
2. The average marker settles at 124 ms, in the empty space between the pile and the stragglers. Caption: "The average describes nobody."
3. The dots line up in order. A slider walks along them: at the 500th, "p50 = 50 ms"; at the 950th, "p95 = 140 ms"; at the 990th, "p99 = 5 s". Caption: "p99: 99% of requests were faster than this."
4. Zoom out: at a million requests a day, those 15 in 1,000 become a crowd of 15,000 avatars. Then one avatar makes 100 requests in a session: a counter shows a 63% chance that at least one of them lands past p99 (1 − 0.99¹⁰⁰). Caption: "At scale, 1% is thousands of people. And the busiest users meet the tail most."
5. The time chart, one point per minute, each computed from that minute's requests: the average line creeps up a little while the p99 line leaps when Payments slows for one card type, because the slow share crosses 1%. Caption: "Watch the tail, not the average."

**The moment**: Beat 2: the average marker parked in a gap where no request landed, between a pile and a tail it misrepresents.

**Interaction**: "Make Payments slow for N% of requests" (0–5%): the average barely moves, the p99 leaps once N passes 1%. Drag the percentile slider along the sorted dots. A "fire 100 requests" button for the heavy user, repeatable.

**Ending**: The chart with both lines. Caption: "Averages hide pain."

**Variants**: `percentiles-from-histograms`, `metric-types`, `exemplars`.

**Techniques**: token, contents, move, meter, chart, zoom, dial, caption.

**Review**: Improved — owner of this id. Arithmetic checked (985 requests near 50 ms plus 15 at 5 s gives a mean of 124 ms; rank 990 is a straggler, so p99 is about 5 s). Borrowed from `scaling.part2` the heavy-user burst (63% of 100-request sessions hit the tail), and fixed the time chart: the average creeps, only the p99 leaps once slow requests pass 1%. The percentile is also now shown as computed per time window. Weighed a pure "line up the dots" framing as in the scaling plan; the 124 ms tile sitting in an empty gap is the sharper opening, so it stays.

### Percentiles from histograms (and why summaries don't aggregate) (`percentiles-from-histograms`)

**The aha**: You can't average percentiles. You can add histogram bucket counts, across instances and over time, and compute the percentile once at the end.

**Misconception to defeat**: The fleet's p99 is the average of each instance's p99.

**Cast**: Three API instances, A, B and C, with 1,000 requests each. A and B are healthy; on C, 300 requests take 2 s. Each instance can report either a summary badge ("p99 = …") or a row of five bucket bins (≤100 ms, ≤250 ms, ≤500 ms, ≤1 s, ≤2.5 s) holding counts. A dashboard tile on the right.

**Opening frame**: Three instances with badges: 100 ms, 100 ms, 2 s.

**Story**:

1. The badges float to the dashboard and are averaged: "Fleet p99: 733 ms." Caption: "Average the p99s…"
2. All 3,000 requests pour into one sorted line. 300 of them, 10% of the fleet, are slow, and the true p99 marker lands at 2 s. The 733 tile cracks. Caption: "…and you're off by almost three times."
3. Rewind. Each instance reports bucket counts instead. The three rows slide together and their bins stack: the counts simply add. Caption: "Bucket counts add up."
4. Walk the combined counts to the 2,970th request. It falls in the 1 s to 2.5 s bucket, 270 requests into its 300. Interpolating as if they were spread evenly across the bucket gives 1 + 0.9 × 1.5 = about 2.35 s. Caption: "Add first. Compute the percentile once, at the end."
5. Five-minute windows' buckets stack the same way. Caption: "Across instances, and across time."

**The moment**: Beats 2 to 4 side by side: the cracked "733 ms" on the left; on the right, the stacked bins giving about 2.35 s against a true 2 s (the error is the bucket's width, the price of not keeping every request).

**Interaction**: Shift traffic between instances and watch the averaged p99 and the true p99 drift apart. Move the bucket boundaries: coarse buckets give a vague estimate, and exponential (native) buckets close the gap.

**Ending**: The combined histogram with its p99 marker, beside the crossed-out average.

**Variants**: `latency-percentiles`, `metric-types`, `metric-aggregation-and-rollups`, `exemplars`.

**Techniques**: contents, move, meter, failure, side by side, dial, caption.

**Review**: Improved — numbers verified (mean of 100, 100, 2,000 ms is 733 ms; the true p99 is 2 s; interpolation lands at 2.35 s, not "about 2.3"), and the interpolation assumption (requests spread evenly inside a bucket) is now stated, so the estimate error is explained instead of mysterious. The cracked 733 ms tile beside the stacked bins is the moment. Weighed starting from "a summary can't be merged" in words; showing the wrong fleet number is more convincing.

### Metric cardinality and cardinality explosions (`metric-cardinality`)

**The aha**: Cardinality multiplies. 20 endpoints × 5 status codes × 50 pods is 5,000 series, and adding `user_id` makes it millions. Values without an upper bound belong in traces and logs.

**Misconception to defeat**: Adding a label adds a few more series (thinking in sums, not products).

**Cast**: A metric name block, `http_requests_total`. A rack of label switches beneath it: `endpoint` (20 values), `status` (5), `pod` (50), `user_id` (∞). A field of tiny blue cells, one per series. A series counter, the metrics backend's memory bar, and a cost meter.

**Opening frame**: No labels: one cell. Counter: 1.

**Story**:

1. Switch on `endpoint`: the cell becomes a row of 20. Counter: 20.
2. Switch on `status`: the row stacks into a 20 × 5 grid. Counter: 100. Caption: "Labels multiply."
3. Switch on `pod`: the grid extrudes into a block. Counter: 5,000. Caption: "20 × 5 × 50 = 5,000 series." (Cells only exist for combinations that actually occur, so the product is the ceiling.)
4. Switch on `user_id`. The block clones itself again and again; the camera pulls back as copies tile the screen; the counter races past a million; the memory bar goes red, and the backend runs out of memory or starts rejecting samples. Caption: "Add user_id: millions."
5. Drag the `user_id` switch off the metric and onto a violet span and a grey log line, where it sits as one field among many. The counter falls back to 5,000. Caption: "Unbounded values belong in traces and logs."

**The moment**: Beat 4, slowed: the zoom-out as the block tiles the screen, with the counter still racing.

**Interaction**: The switches, plus a value-count dial on each. "Add a label with user_id" is the obvious button to press. A "cardinality limit" toggle then shows the backend capping and dropping new series instead of falling over.

**Ending**: The 5,000-cell block, with `user_id` living on a span beside it.

**Variants**: `metric-time-series`, `high-cardinality-analysis`, `exemplars`, `observability-cost`.

**Techniques**: meter, clone, zoom, toggle, dial, failure, move, caption.

**Review**: Improved — the product is now flagged as a ceiling (only combinations that occur create series), and the failure mode reads "out of memory or rejecting samples" rather than implying graceful dropping. The tiling zoom-out is the moment; moving `user_id` onto a span closes the loop. Weighed a per-series price tag; the multiplying grid is clearer than money.

### Aggregation and rollups (`metric-aggregation-and-rollups`)

**The aha**: Aggregation only goes one way. Once you've summed away `pod` or rolled up to hourly points, that detail is gone for good, so keep raw data short-term, rollups long-term, and roll up with the right function.

**Misconception to defeat**: You can always drill back down later, and averaging averages is fine.

**Cast**: A chart with four thin blue lines, `pod=a` to `pod=d`; pod c has a short, sharp latency spike. A funnel labelled `sum by (service)`. A time compressor that squeezes 10-second points into 5-minute points. A retention strip: "raw: 15 days", "5-minute rollups: 1 year".

**Opening frame**: The four pod lines, pod c's spike obvious.

**Story**:

1. The four lines slide into the funnel and come out as one thicker line. Caption: "Sum away pod: one series."
2. The cursor clicks the merged line and asks "which pod?". The tooltip is dashed and empty. Caption: "You can't un-sum."
3. Across time: 10-second dots gather into 5-minute windows, and each window collapses into one point. Two versions side by side: with `avg`, pod c's spike flattens into a bump; with `max`, it survives. Caption: "Roll up with the right function."
4. A small guide appears: counters → sum their rates; latency → max, or add histogram buckets and compute the percentile at the end (never average percentiles); averages → only if weighted by their counts.
5. The calendar runs. Raw points older than 15 days fade; the rollups stretch back a year. Caption: "Raw for the short term. Rollups for the long term."

**The moment**: Beat 3: the same spike erased by `avg` and kept by `max`, side by side.

**Interaction**: Pick the rollup function and window size and watch the spike survive or vanish. Try "drill into pod" at different ages: it works on last week, not last year.

**Ending**: A year-long rollup line with only the last two weeks in raw detail.

**Variants**: `metric-time-series`, `telemetry-retention-tiers`, `percentiles-from-histograms`, `trace-sampling`.

**Techniques**: chart, move, appear / disappear, side by side, choice, dial, timer, caption.

**Review**: Improved — the beat 4 guide no longer says "a percentile" is a safe rollup for latency (percentiles can't be rolled up; add buckets or take the max) and says averages need weighting by count. The avg-vs-max spike contrast is the moment. Weighed a "photo resized, can't enlarge" metaphor; the dashed empty tooltip already shows loss.

### Push vs pull collection (scraping) (`push-vs-pull-collection`)

**The aha**: In pull, the monitor finds its targets and scrapes them, so a failed scrape is itself a signal. Push suits short-lived jobs and sources the monitor can't reach. Most setups use both.

**Misconception to defeat**: One is simply better than the other, or "push" means push notifications.

**Cast**: A scraper on the right with a target list fed by service discovery (rows: `api-1 up=1`…) and a 15-second timer ring. API pods, each with a small `/metrics` window of blue numbers. A batch job that lives for 10 seconds. A push gateway. A firewall boundary around one remote site.

**Opening frame**: Three API pods; the scraper's list shows three green rows.

**Story**:

1. A pod scales up and discovery adds a row. On each tick, the scraper reaches into every `/metrics` window and the numbers fly back. Caption: "Pull: the monitor finds targets and scrapes them."
2. api-2 hangs. Its scrape times out, its row turns red with `up=0`, and the bell rings. Caption: "A failed scrape is itself a signal."
3. The same thing with push: a pod that dies just goes quiet. Dead or idle? A question mark hangs over it. Caption: "In push, silence is ambiguous."
4. Back to pull: a batch job appears, runs and vanishes between two ticks. The scraper arrives at an empty spot. Caption: "Short-lived jobs vanish before the scrape."
5. The job pushes its final numbers to the push gateway as it exits, and the scraper pulls from the gateway, which holds the last value until someone deletes it. A serverless function and the firewalled site push outbound (OTLP or remote write to a collector), since nothing can reach in. Caption: "Push suits short-lived jobs and places you can't reach."

**The moment**: Beats 2 to 4 as a split screen: pull catches the hung pod but misses the job; push catches the job but can't tell death from silence.

**Interaction**: Buttons: "hang a pod", "run a 10-second job", "put a service behind a firewall". Switch between pull and push and see which catches what.

**Ending**: The hybrid: the scraper pulling from pods and the gateway, short-lived sources pushing.

**Variants**: `metric-types`, `health-checks-and-heartbeats`, `otel-collector`, `telemetry-pipeline`.

**Techniques**: exchange, timer, token, restyle, failure, appear / disappear, boundary, side by side, toggle, caption.

**Review**: Improved — beat 5 now separates the push gateway (batch jobs; it keeps the last value and is itself scraped) from outbound push of serverless and firewalled sources to a collector, which was blurred before. The split-screen of what each model catches is the moment. Weighed a mail analogy (collect vs deliver); the hung-pod and vanishing-job failures are more concrete.

### Exemplars (`exemplars`)

**The aha**: An exemplar pins one real trace ID beside a metric point, so you can click from "p99 spiked at 14:02" straight to a request that was slow at 14:02, without putting trace IDs in labels.

**Misconception to defeat**: "Just add `trace_id` as a metric label."

**Cast**: A blue p99 latency chart with a spike at 14:02, its histogram buckets behind it. Small violet diamonds (exemplars). A waterfall panel below. A series counter.

**Opening frame**: The spike, with a question beside it: "Which requests?"

**Story**:

1. Search traces from 14:00 to 14:05: 4,000 results, nearly all fast. Caption: "The metric says when. Not which."
2. The wrong fix: `trace_id` becomes a label. Every request creates a new series; the counter explodes and the chart dissolves into dust. Caption: "A label per request: a new series per request."
3. Rewind. As requests land in histogram buckets, each bucket keeps the trace ID of one recent request as a violet diamond, replacing the previous one. The series counter doesn't move. Caption: "Keep one example beside each number."
4. Diamonds sit on the chart, and the one on the 14:02 spike glows. Click it: a line swoops into the waterfall, which opens on a 4.8 s trace with a stretched Payments span, and Payments lights up in the diagram. Caption: "One click: from an aggregate to a real slow request." (The exemplar only helps if that trace was kept: the stamped request is one the sampler sampled.)

**The moment**: Beat 4, slowed: diamond → trace → service in one continuous motion.

**Interaction**: Hover diamonds on different points and buckets. Fast-bucket diamonds open fast traces; slow-bucket ones open slow traces.

**Ending**: The chart with its diamonds and one trace open beneath it.

**Variants**: `signal-correlation`, `metric-cardinality`, `distributed-tracing`, `percentiles-from-histograms`.

**Techniques**: chart, contents, meter, failure, zoom, linked highlight, spotlight, caption.

**Review**: Improved — added that an exemplar must point at a trace the sampler actually kept (otherwise the click lands on nothing), tying it to `trace-sampling`. The cardinality-explosion detour defeats the "make it a label" misconception directly. Weighed a pin-on-a-map framing; the diamond-to-waterfall swoop is already that.

## Distributed tracing

### Distributed tracing (`distributed-tracing`)

**The aha**: A trace turns "checkout is slow" into "checkout spent 1.8 of its 2 seconds waiting on the inventory service's third database call" — a waterfall of every call the request made.

**Misconception to defeat**: Tracing is just logging that happens to span several services, or a static diagram of what calls what.

**Cast**: Web → API → DB plus Payments, one request dot crawling through. On the right, a waterfall: a time axis across the top, horizontal violet bars underneath, one per span, nested by who called whom.

**Opening frame**: The dot mid-journey, an elapsed-time readout at 1.8 s climbing, the waterfall empty.

**Story**:

1. As the dot crosses each service boundary, it leaves behind a bar in the waterfall: Web's bar spans the whole width, API's nests inside it, and API's calls to DB and Payments nest inside that.
2. Two of API's bars start at the same x-position (parallel), two others start where the previous one ends (sequential). Caption: "The waterfall shows what ran at once, and what waited."
3. One bar is far longer than the rest: "API → DB, 3rd query, 1.3 s." It's spotlit, and the idle gap before it (time inside API with no child running) is shaded. Caption: "Not just what ran. Where the gaps are."
4. Hover that bar: DB lights up gold in the service diagram above. Hover DB in the diagram: its bars light up in the waterfall. Caption: "Hover a span, its service lights up."
5. Beside it, the same request's logs: a dozen lines with timestamps, no nesting, no durations, no way to tell what waited on what. Caption: "Logs say what happened. A trace says what waited on what."

**The moment**: Beat 3, slowed: the spotlighted bar and its idle gap, with the root bar's total (1.8 s) resolving into one named cause.

**Interaction**: Hover any span to light its service, or any service to light its spans. Scrub the time axis; drag a span's duration and watch bars above it shift.

**Ending**: The full waterfall beside the lit diagram, root duration labelled "what the user waited."

**Variants**: `trace-span`, `context-propagation`, `service-map`, `critical-path-analysis`, `w3c-trace-context`.

**Techniques**: token, move, contents, linked highlight, zoom, spotlight, path trace, caption.

**Review**: Improved — the slow bar was "Payments → DB", an edge the house system doesn't have (API calls DB and Payments); it is now "API → DB, 3rd query", the classic repeated-query pattern, and the hover pair follows. The idle-gap shading is defined, and beat 5 gained a caption. The 1.8 s resolving to one named bar is the moment. Weighed starting from the logs-only view; opening on the elapsed timer is stronger.

### Spans and parent/child relationships (`trace-span`)

**The aha**: A parent span ID is what turns spans recorded separately on different machines into one tree. The span with no parent is the root, and its duration is what the user experienced.

**Misconception to defeat**: A span is a log line with a start and end time.

**Cast**: Four span cards, one per service, each showing name, start/end, trace ID, its own span ID, a parent ID, a kind badge and a status dot. They float scattered, not yet connected.

**Opening frame**: Four cards sharing one trace ID (amber, `7f3a`) but positioned at random, unconnected: each was sent on its own when its span ended, so the children arrive first and the root last.

**Story**:

1. Zoom into one card's fields: trace ID shared by all four, span ID unique to this card, parent ID pointing at another card's span ID. Caption: "Trace ID says they belong together. Parent ID says how."
2. An arrow draws from each card's parent ID to the span ID it names. The cards snap along the arrows into a tree.
3. The one card with no parent ID glows gold at the top. Caption: "No parent: the root. Its duration is what the user waited."
4. DB's call fails; its status dot flips to red. Caption: "Kind says its role (server, client). Status says how it ended (error)."
5. Side by side: a log line with only a timestamp, no parent, no way to say which of three concurrent calls it belongs under.

**The moment**: Beat 2, the scatter of cards snapping into a tree the instant the arrows are drawn.

**Interaction**: Drag cards anywhere; the tree shape follows the arrows, not position. Delete one card's parent ID: its subtree detaches, orphaned.

**Ending**: The completed tree, root glowing, duration label matching the opening frame's elapsed time.

**Variants**: `distributed-tracing`, `context-propagation`, `span-links`, `w3c-trace-context`.

**Techniques**: contents, move, path trace, restyle, spotlight, toggle, caption.

**Review**: Improved — the opening frame now explains why the cards are scattered (spans are sent separately as they end, children before the root), and the beat 4 caption no longer mixes kind (server/client) with status (error). The cards snapping into a tree is the moment. Weighed building the tree by drawing the call stack; starting from scattered cards makes the parent ID the hero.

### Context propagation (`context-propagation`)

**The aha**: Tracing only works if every hop passes the context along. One service, proxy or queue that drops it splits the trace in two, and nothing can stitch it back together.

**Misconception to defeat**: The backend somehow figures out which spans belong together on its own.

**Cast**: Web → API → Payments → DB. A context chip (trace ID, current span ID, sampled flag) rides each request dot. Within a box, the chip passes hand to hand like a baton; between boxes, it's sealed into an envelope (HTTP headers) and unsealed on arrival.

**Opening frame**: A dot leaving Web, chip visible and glowing.

**Story**:

1. Inside Web, the baton passes function to function as the request is handled. Caption: "Within a process: a baton."
2. Crossing to API: the baton is sealed into an envelope, carried in the request, and unsealed on arrival — "inject", then "extract." A new span is created as API's child.
3. Same at every further hop: trace ID unchanged, a fresh span ID each time, caption "Every hop: inject, extract, new child."
4. Break it: Payments' HTTP client has no instrumentation, so no envelope goes out. DB starts a brand-new, unrelated trace ID. The waterfall splits into two disconnected trees.
5. Fix: instrument that one client. The envelope reappears, DB's span rejoins as API's grandchild, and the waterfall becomes one tree again.

**The moment**: Beat 4, slowed: one dropped envelope, and the single waterfall tearing into two unconnected pieces.

**Interaction**: Toggle instrumentation at any hop and watch the trace split or reunite.

**Ending**: An unbroken relay of chips across every hop, one tree in the waterfall.

**Variants**: `w3c-trace-context`, `correlation-ids`, `baggage-propagation`, `trace-span`.

**Techniques**: token, exchange, path trace, failure, toggle, caption.

**Review**: Keep — baton in-process, sealed envelope between processes (inject, extract, new child span), and the torn waterfall when one client drops it are all correct, and the repair rejoining as API's grandchild checks out. Weighed a relay-race metaphor with a dropped baton; the baton/envelope pair already is that.

### W3C Trace Context (`traceparent`) (`w3c-trace-context`)

**The aha**: A shared header format lets a request traced by one vendor's agent carry on through another's. Each hop keeps the trace ID and swaps in its own span ID as the new parent.

**Misconception to defeat**: "The trace ID" is enough; the exact header format and its rules (what changes, what doesn't, who to trust) don't matter.

**Cast**: An HTTP envelope at a boundary between Vendor A's agent (on Web) and Vendor B's agent (on API). Inside: `traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01` and `tracestate: vendorA=…`. A trust-boundary ring around API.

**Opening frame**: The envelope arriving at API, its `traceparent` string laid out as four labelled segments: version, trace-id, parent-id, flags.

**Story**:

1. Zoom into each segment as it's named. Caption: "Version. Trace ID. Parent ID. Sampled flag."
2. API extracts it, keeps the trace ID, and writes its own new span ID into the parent-id slot before sending onward. The string updates in place. Caption: "Trace ID never changes. Parent ID, every hop."
3. `tracestate` grows: Vendor A's entry stays, and Vendor B adds its own at the front of the list (a vendor that updates its entry moves it to the front too). Caption: "Vendor-specific data, carried without colliding."
4. An external caller sends `…-01` (sampled, forced). At the trust boundary around API, a toggle, "ignore incoming sampled flag here," is flipped on; API decides for itself (or starts a fresh trace ID) instead of letting any caller force expensive tracing on it.
5. Side by side: an old vendor-specific header (B3) arrives at API's boundary and is simply unreadable, a sealed envelope nobody can open — the chain breaks there instead.

**The moment**: Beat 2: the trace ID holding still while the parent-id field visibly rewrites itself, hop after hop.

**Interaction**: Edit the hex fields and see a validity check; toggle whether a boundary trusts an incoming sampled flag.

**Ending**: One `traceparent` flowing unbroken end to end across two vendors' agents.

**Variants**: `context-propagation`, `trace-sampling`, `baggage-propagation`, `correlation-ids`.

**Techniques**: contents, restyle, exchange, boundary, toggle, side by side, caption.

**Review**: Improved — fixed `tracestate` ordering: the spec adds a new vendor entry at the left, not the end. The trust-boundary beat now names both options (ignore the incoming flag, or start a new trace). Field layout (00, 32-hex trace-id, 16-hex parent-id, 01) is right, and the still trace ID beside the rewriting parent ID is the moment. Weighed a postal-forwarding metaphor; the live string is clearer.

### Baggage (`baggage-propagation`)

**The aha**: Baggage lets a service deep in the call chain know something only the edge knew, without changing every API signature in between. It travels in plain headers, though, and can leak.

**Misconception to defeat**: Baggage is the same as a span attribute (private, local, recorded) or the same as trace context (routing only, no app data).

**Cast**: Web, where a user avatar is marked "premium." A baggage chip, `tier=premium`, forms beside the trace-context chip and rides every hop to API, Payments and DB. A boundary gate at an external card processor that Payments calls.

**Opening frame**: Web, the premium avatar, the baggage chip forming.

**Story**:

1. The chip rides through API untouched; API doesn't need it, just carries it on. Caption: "Travels with the request. Nothing in between has to read it."
2. At Payments, code reads the chip and routes the request into a priority lane, then copies the value onto its own span as an attribute, `customer_tier=premium`, so it's recorded. Caption: "Baggage isn't recorded on its own. Copy it onto a span if you want it kept."
3. Without baggage: the same decision would need `tier` added as a parameter to every function signature from Web to Payments — shown as three APIs cracking open to add a field each.
4. Payments calls the external processor outside the trust boundary, and the chip keeps riding on that outgoing request. A gate, "strip baggage here," is off: the chip, plain text, leaves the boundary. Caption: "It isn't secret."
5. Switch the gate on: the chip is removed right at the boundary before anything crosses it.

**The moment**: Beat 3 versus beat 1: three API signatures cracked open on one side, a single untouched chip riding through on the other.

**Interaction**: Toggle the strip-baggage gate at the external boundary and watch the leak icon appear or vanish.

**Ending**: Baggage flowing cleanly to where it's used, stripped before it leaves the trust boundary.

**Variants**: `context-propagation`, `w3c-trace-context`, `trace-span`, `pii-in-logs`.

**Techniques**: token, path trace, boundary, toggle, contents, restyle, caption.

**Review**: Improved — the leak path was wrong (the chip rode "past DB" to an external processor, but Payments, not DB, makes the outbound call); the gate now sits on Payments' outgoing request. The not-recorded-until-copied beat and the cracked-signatures contrast are right. Weighed leading with the leak; the "who needs it?" payoff comes first for a reason.

### Span links (`span-links`)

**The aha**: Parent/child assumes one cause. Links keep each message's original trace reachable when an operation — a batch, a fan-in, a scheduled job — has many.

**Misconception to defeat**: Every span has exactly one parent, because that's all the diagrams ever show.

**Cast**: A producer sends 100 messages into a queue, each carrying its own trace ID (100 small coloured tails). A batch consumer later pulls all 100 at once and processes them in a single span.

**Opening frame**: 100 queued dots, each trailing its own thin trace tail, waiting.

**Story**:

1. Try parent/child: the consumer span picks one dot, the first in the batch, as its only parent. The other 99 traces visually detach and drift, dangling, disconnected from anything. Caption: "Parent/child assumes one cause. This batch has 100."
2. Rewind. Instead, the consumer span starts its own trace, and 100 dashed lines draw from it out to the 100 producer spans' contexts (trace ID plus span ID). Caption: "Links: a span can point to many causes, without forcing them into one tree."
3. Click any of the 100 original traces: its dashed link highlights into the consumer span, and that original trace opens intact, exactly as it would have on its own.
4. Click the consumer span: all 100 links light up at once, fanning out like a hand of cards.
5. A second example: a nightly batch job, triggered by many small events through the day, links back to each one the same way.

**The moment**: Beat 1's 99 dangling, unreachable traces against beat 2's clean web of 100 links, every one still openable.

**Interaction**: Click any producer dot or the consumer span to light the links between them.

**Ending**: The batch span with 100 faint links radiating outward, each one still leading somewhere.

**Variants**: `trace-span`, `distributed-tracing`, `context-propagation`.

**Techniques**: token, contents, path trace, linked highlight, failure, spotlight, caption.

**Review**: Improved — beat 2 now says what a link is (the consumer's own trace pointing at each producer's trace ID and span ID), so it is clear the batch is not forced under any one trace. The 99 dangling traces against 100 openable links is the moment. Weighed starting from a fan-in of three; 100 makes the parent/child failure obvious.

### Trace sampling: head vs tail (`trace-sampling`)

**The aha**: Head sampling decides the instant a request starts: cheap, consistent, blind. Tail sampling waits until a trace finishes, so it can keep the traces that turned out to matter, at the cost of a buffer that holds every span until then.

**Misconception to defeat**: Sampling is just "keep N% and drop the rest," with no difference in when the decision is made or what gets kept.

**Cast**: A stream of 1,000 request dots entering Web. A head sampler: a single gate right at the door, a dice icon, a chip stamped sampled=1 or 0 the instant a dot passes. A tail sampler, placed near the backend: a large buffer box, "holds every span until its trace completes," then a rule box.

**Opening frame**: 1,000 dots approaching the head sampler's gate.

**Story**:

1. The gate decides instantly: 10% get a green chip, 90% grey, the outcome fixed from the trace ID so every later hop agrees. Caption: "Decided before anyone knows what happens next."
2. One of the grey (unsampled) dots is about to fail badly three hops downstream. It fails; its trace was never going to be kept. No one will ever see it. Caption: "Including the one that mattered."
3. Rewind to tail sampling: every trace's spans flow fully into the buffer first. Only once each one completes does the rule box check it: "keep if error," "keep if slow," "else keep 5%." The same failing trace, now complete and red, is kept. Most fast green ones are dropped after the fact.
4. Size the two gates side by side: head is one small gate; tail needs a whole buffering tier with a memory meter climbing as traces accumulate, and every span of a trace must reach the same collector instance, so spans are routed by trace ID. Meanwhile the dropped traces still counted in the RED metrics, which are computed before sampling.
5. Kept traces carry their sample rate, `rate=0.1`, so counts can be scaled back up later.

**The moment**: Beats 2 and 3 side by side: the same failing trace, lost under head sampling, rescued under tail.

**Interaction**: Toggle head vs tail; dial the keep percentage and the slow threshold, and watch which traces survive.

**Ending**: Side by side summary: head — cheap, consistent, blind. Tail — complete, costs a buffering tier.

**Variants**: `w3c-trace-context`, `observability-cost`, `otel-collector-pipeline`, `exemplars`.

**Techniques**: dial, toggle, meter, contents, failure, side by side, spotlight, caption.

**Review**: Improved — beat 4 now names the real cost of tail sampling (all spans of a trace must land on the same instance, so routing by trace ID) and notes that error counts survive sampling because metrics are computed first. The same failing trace lost then rescued is the moment. Weighed adding probabilistic vs rule-based head sampling; it would be a second idea.

### Service maps (`service-map`)

**The aha**: A service map is drawn from what actually called what in the last hour, not from an architecture diagram someone drew once. It shows real blast radius and undocumented shortcuts.

**Misconception to defeat**: A service map is the same thing as the team's architecture diagram.

**Cast**: Left, a static "intended" diagram: clean boxes and arrows, including a dashed box, "Old Pricing Service (deprecated)." Right, the live house system, edges thickening with request rate and tinting with error rate as traffic actually flows.

**Opening frame**: Both sides still, side by side.

**Story**:

1. Traffic starts flowing on the right. The edge to "Old Pricing Service," present on the left, never lights up. Caption: "Nobody calls it. Nobody deleted the diagram either."
2. A new edge appears on the right with no match on the left: Web calling DB directly, bypassing API. Caption: "A shortcut nobody documented."
3. Payments turns red. Error colour spreads outward along the real edges that depend on it, to API, then to Web. Caption: "Blast radius, along edges that actually carry traffic. The deepest red node is the likely origin."
4. The map regenerates an hour later, slightly different, built fresh from the client and server spans seen since. Caption: "Rebuilt from traffic, not remembered from a meeting."

**The moment**: Beat 2, the undocumented Web→DB edge glowing on the live map directly beside a diagram that doesn't show it.

**Interaction**: Toggle "intended vs observed." Break any service and watch the blast radius spread along the live edges, not the drawn ones.

**Ending**: The live map alone, thickness and colour carrying rate and errors, the stale diagram faded behind it.

**Variants**: `distributed-tracing`, `red-method`, `critical-path-analysis`.

**Techniques**: side by side, stream, meter, restyle, failure, spotlight, toggle, caption.

**Review**: Improved — beat 3 now says how to read the red (the deepest failing node is the likely origin; upstream reds are victims), so the blast radius isn't mistaken for blame. The undocumented Web-to-DB edge beside the clean diagram is the moment. Weighed a "city map vs transit usage" metaphor; the side-by-side already makes it.

### Critical path analysis (`critical-path-analysis`)

**The aha**: Making a span faster only helps if it's on the critical path, the longest dependent chain that actually sets the end-to-end time. Work running in parallel with it doesn't count.

**Misconception to defeat**: "Fix the slowest span" or "fix whichever service spends the most total time."

**Cast**: A waterfall: API starts two calls at once, Call A (900 ms) and Call B (300 ms), running in parallel, then a final 200 ms step once both are done. Total trace: 1,100 ms.

**Opening frame**: The waterfall, end marker at 1,100 ms, both calls visibly starting together.

**Story**:

1. Try optimising B first: drag its bar down to 100 ms. The end marker doesn't move. Still 1,100 ms. Caption: "B ran in parallel. It was never on the clock."
2. Rewind. A bold path draws itself through the bars that actually determined the total: start → Call A → join → final step, skipping over B entirely. Caption: "The critical path."
3. Now drag Call A down to 400 ms instead. The end marker slides left immediately, to 600 ms. Caption: "This was on the clock."
4. Keep shaving Call A: at 300 ms it ties B, and below that the path flips to B, so the end marker stops improving (at A = 200 ms the total is 500 ms, set by B). Caption: "Fix the critical path and it moves."
5. Zoom out across many traces: a ranking panel tallies which service sits on the critical path most often — Payments 72%, DB 20%, others trailing. Caption: "Where to spend effort, fleet-wide."

**The moment**: Beats 1 and 3 side by side: one optimisation that changes nothing, one identical-looking optimisation that moves the end marker.

**Interaction**: Drag either call's duration and watch whether the end marker follows. Toggle "highlight critical path" on any trace.

**Ending**: The ranking panel, Payments on top, caption "optimise what's actually on the clock."

**Variants**: `distributed-tracing`, `trace-span`, `red-method`.

**Techniques**: path trace, spotlight, dial, move, chart, caption.

**Review**: Improved — numbers verified (900 + 200 = 1,100 ms; A at 400 gives 600 ms) and a new beat shows the critical path flipping to B once A drops below 300 ms, which is why you re-measure after each fix. The two identical-looking optimisations, one inert and one effective, stay the moment. Weighed "slowest span" as the foil; keeping the parallel-call foil.

## OpenTelemetry

### OpenTelemetry (OTel) (`opentelemetry`)

**The aha**: Instrument once with OpenTelemetry, send anywhere. Switching observability vendor becomes a configuration change, not a rewrite.

**Misconception to defeat**: OpenTelemetry is itself a backend you can log into and look at dashboards in.

**Cast**: The four services, each wrapped in an OTel SDK icon. All signals flow into a Collector box with an exporter dial, currently pointed at "Backend A."

**Opening frame**: Apps → Collector → Backend A, all green, Backend A's own dashboard showing data.

**Story**:

1. Point at the Collector: it's drawn as a plain pipe with nothing displayed inside it. Caption: "OTel doesn't store or show anything."
2. Turn the exporter dial to "Backend B," a different vendor's icon. No service changes. Within seconds, data is flowing into B's own dashboard instead. Caption: "A settings change, not a rewrite."
3. Side by side, the pre-OTel world: each service carries a vendor-specific SDK baked in. Switching vendors means re-instrumenting all four and a redeploy icon spins over each one.
4. Turn the dial to "both": two exporters configured at once, data fanning out to A and B simultaneously, still zero app changes.

**The moment**: Beat 2's silent switch, nothing moving in the diagram but the dial, set against beat 3's redeploy storm for the same switch under the old model.

**Interaction**: Drag the exporter dial among vendor icons, or select "fan out to two."

**Ending**: Apps unchanged; the Collector's dial pointed at any backend or combination.

**Variants**: `otel-api-vs-sdk`, `otel-collector`, `otel-collector-pipeline`, `otel-semantic-conventions`.

**Techniques**: restyle, toggle, side by side, failure, dial, caption.

**Review**: Keep — "the dial turns and nothing else moves" against a four-service redeploy storm is the cleanest statement of instrument-once-send-anywhere, and it keeps OTel firmly a pipe, not a backend. Weighed a universal-power-adapter metaphor; the real dial is more literal. The API/SDK split is left to `otel-api-vs-sdk`.

### OTel API vs SDK (`otel-api-vs-sdk`)

**The aha**: A library instrumented with the OTel API costs next to nothing for users who install no SDK, because without one the API is a no-op. The application, not the library author, decides what happens to the telemetry.

**Misconception to defeat**: Instrumentation code always "does something" the moment it runs.

**Cast**: A third-party library box with OTel API calls written into it ("start span," "record metric"), drawn as dashed call-outs into a socket. The application around it, where an SDK module either is or isn't plugged into that socket.

**Opening frame**: The library's calls firing repeatedly into an empty socket, each vanishing as a faint "no-op" ghost.

**Story**:

1. No SDK installed: the cost meter sits at zero no matter how often the library calls the API. Caption: "No SDK: the API is a no-op."
2. The application plugs in an SDK: a sampler (10%), a batch processor, an exporter pointed at Backend A, all configured here, not in the library. Caption: "The application decides."
3. The same unchanged library calls now produce real spans, flowing through the sampler, processor and exporter the app just set up.
4. The app changes its SDK configuration, sampler to 50%, exporter to Backend B, without touching one line of the library.
5. Contrast: a library that imports a vendor SDK directly forces that vendor's weight and choices onto every application that uses it, whether they want telemetry or not.

**The moment**: Beat 1's calls vanishing into nothing beside beat 3's identical calls now producing real spans, the library code unchanged throughout.

**Interaction**: Toggle "SDK installed" and watch the cost meter and span count. Adjust the SDK's sampler and exporter.

**Ending**: The library untouched from first frame to last; only the socket's contents changed.

**Variants**: `opentelemetry`, `auto-vs-manual-instrumentation`, `otel-collector`.

**Techniques**: appear / disappear, toggle, meter, contents, restyle, caption.

**Review**: Improved — "costs nothing" softened to "next to nothing" (a no-op call is still a call). The empty socket versus the same unchanged calls producing spans is the moment, and the library-bakes-in-a-vendor contrast is fair. Weighed a light-switch metaphor; the socket is a truer picture of API vs implementation.

### Automatic (zero-code) vs manual (code-based) instrumentation (`auto-vs-manual-instrumentation`)

**The aha**: Auto-instrumentation gives you the skeleton of every request in minutes, the edges where your code talks to the outside world. Only manual instrumentation adds the business meaning that actually explains a problem. Use both.

**Misconception to defeat**: "Automatic" means "complete."

**Cast**: The API box, bare at first. An auto-instrumentation agent wraps around it, drawing spans at every HTTP, database and messaging boundary with no code change. Inside, a developer's cursor manually adds one custom span and an attribute.

**Opening frame**: A bare API box, just deployed; a trace of it would be a single flat bar with nothing inside.

**Story**:

1. Flip on the agent, one config flag: spans for every incoming request, every outgoing query, every call to Payments appear automatically, nested in the waterfall. Caption: "Minutes to get the skeleton."
2. Zoom into one span: `GET /checkout`, `SELECT * FROM orders` — generic, no business detail. A question hangs over it: "why did this checkout fail?" Nothing answers it.
3. The developer adds one line, `span.setAttribute("cart_size", 7)`, and a custom child span, `applyDiscountRules`.
4. The same failing checkout, retraced: the custom span and `cart_size=7` reveal "discount rule crashed on an empty cart." Caption: "The skeleton, plus the meaning."
5. Side by side: auto alone has shape but no story; manual alone has story but gaping holes where the agent would've caught the HTTP and DB boundaries for free.

**The moment**: Beat 2's unanswered question against beat 4's answer, same trace shape, one attribute added.

**Interaction**: Toggle auto, manual, or both layers on the same trace and watch which spans and attributes appear.

**Ending**: The full trace, grey-bordered auto spans beneath coloured manual ones, captioned "the skeleton, plus the meaning."

**Variants**: `opentelemetry`, `otel-api-vs-sdk`, `ebpf-observability`, `otel-semantic-conventions`.

**Techniques**: appear / disappear, contents, zoom, side by side, toggle, spotlight, caption.

**Review**: Keep — skeleton from the agent, meaning from one `setAttribute` and one custom span, answers the same failing trace twice, and the code shown is correct. Weighed "scaffolding vs furniture"; the unanswered question hanging over a generic span is sharper.

### The OpenTelemetry Collector (`otel-collector`)

**The aha**: Apps hand telemetry off to a nearby collector and get straight back to work. The collector batches, retries, enriches, redacts, samples and routes, running as an agent next to each app, a central gateway, or both.

**Misconception to defeat**: The collector is just another name for the SDK, or is itself the backend.

**Cast**: Four services sending straight to a distant Backend, each with a small export queue (a bar that fills) and its own copy of the backend credentials. Then: an agent collector dropped beside each service, forwarding up to a gateway collector tier, which forwards on to Backend A and B.

**Opening frame**: Four direct wires to Backend A, each app's export queue nearly empty, each app holding its own key.

**Story**:

1. A network hiccup: the backend stops accepting for a minute. One app's small in-memory queue fills, and the overflow fades out, lost; that app is also spending its own memory and CPU on batching and retries. Caption: "Send straight to the backend, and every hiccup, retry and buffer is the app's problem."
2. Rewind. An agent collector appears beside each service. Apps now hand telemetry to their local agent in one quick local call, their queues stay empty. Caption: "Hand off locally. Get back to work."
3. Agents forward up to a gateway tier, which batches many small sends into fewer big ones, adds Kubernetes metadata, and buffers through the same hiccup, replayed: this time nothing is lost (until the gateway's buffer is also full, which is why it is sized).
4. The gateway also holds policy centrally: one set of credentials to reach Backend A, configured once instead of copied into every app; and it's the tier that can be made to see every span of a trace (agents route spans by trace ID to the same gateway instance), which is what makes tail sampling possible here.
5. The gateway routes: fan out to Backend A and B.

**The moment**: The same hiccup, lossy in beat 1, absorbed without a trace in beat 3.

**Interaction**: Trigger "network hiccup" with and without the agent-and-gateway tiers present. Toggle credentials between per-app and centralised.

**Ending**: Apps → agents → gateway → backends, a steady flow, no app ever waiting.

**Variants**: `opentelemetry`, `otel-collector-pipeline`, `telemetry-pipeline`, `otel-api-vs-sdk`.

**Techniques**: token, failure, appear / disappear, contents, boundary, toggle, caption.

**Review**: Improved — beats 1 and 2 claimed apps wait on the send and have "no retry logic", which overstates it (SDK exporters batch on a background thread and retry a little). The pain is now an app-side export queue that fills and overflows during an outage, plus per-app credentials and batching cost. Tail sampling now says spans are routed by trace ID to one gateway instance. The same hiccup, lossy then absorbed, stays the moment. Weighed a post-office metaphor; the queue meter is more literal.

### Collector pipelines: receivers, processors, exporters (`otel-collector-pipeline`)

**The aha**: The Collector's configuration is an assembly line per signal: receivers take data in, processors transform it, exporters send it on, and connectors can splice one pipeline's output into another. Changing what you collect means editing config, not redeploying services.

**Misconception to defeat**: The collector is one opaque blob, or just a log shipper with extra settings.

**Cast**: Three parallel assembly lines, one per signal (traces, metrics, logs), each with labelled stations: Receivers (OTLP, Prometheus scrape, filelog), Processors (batch, memory_limiter, attributes, filter, tail_sampling), Exporters (to Backend A, to Backend B). A connector is a side-pipe splicing the trace line into a new metrics line.

**Opening frame**: Three lanes running side by side, each entering at receivers and leaving at exporters.

**Story**:

1. Signals enter their receivers: violet spans via OTLP, blue numbers via a Prometheus scrape, grey lines via filelog, each tagged with its entry point.
2. Walk the trace lane's processors in the order they are listed, which is the order data meets them: memory_limiter first, capping how much the line can hold; an attributes processor stamps `region=eu`; a filter drops health-check spans; tail_sampling keeps the errors and slow ones; batch last, grouping spans into crates. Caption: "In, transform, out."
3. Exporters split the crates to Backend A and B per configuration.
4. A connector splices a wire from the trace lane's output into a brand-new metrics lane, deriving rate/error/duration straight from span data, no new application code anywhere. Caption: "Connectors join pipelines."
5. Swap one processor's rule by editing a single block of config. Nothing else on any lane changes, and no service redeploys.

**The moment**: Beat 4: a new metrics stream appearing out of a side-pipe spliced into an existing lane, with no new instrumentation in sight.

**Interaction**: Reorder processors in a lane and see the effect change (sampling before versus after redaction). Add or remove a connector.

**Ending**: The three-lane assembly line, one connector bridging two of them.

**Variants**: `otel-collector`, `opentelemetry`, `telemetry-pipeline`, `red-method`.

**Techniques**: contents, stream, restyle, path trace, toggle, caption.

**Review**: Improved — processors now run in the usual recommended order (memory_limiter first, batch last), since order is the thing the reorder interaction teaches. The connector (spanmetrics: exporter in one pipeline, receiver in another) splicing a new metrics lane from spans is the moment. Weighed a factory-tour framing without the connector; it is the part nobody guesses, so it stays.

### Semantic conventions and resource attributes (`otel-semantic-conventions`)

**The aha**: Shared names for the same thing, and for which service emitted it, are what make telemetry joinable across teams. Without them, no dashboard or query works across more than one service at a time.

**Misconception to defeat**: Tags are already standardised just because every team happens to use JSON.

**Cast**: Three services, each instrumented by a different team, each emitting a span for an HTTP call but naming the status field differently: Web's `status`, API's `http_code`, Payments' `statusCode`. A dashboard query, `status=500`, tries to span all three.

**Opening frame**: Three similar-looking spans, their field names highlighted in three different colours.

**Story**:

1. The query `status=500` lights up only Web's matching spans. API's and Payments' 500s sit dark, invisible to the exact same question. Caption: "Same thing. Three names. No query covers all of them."
2. One service never set a `service.name`: its spans show up as `unknown_service`, so the backend can't say which service they came from.
3. Rewind. All three teams adopt the convention, `http.response.status_code`, and every span gains resource attributes, set once per process by the SDK and stamped on everything it emits: `service.name`, `service.version`, `k8s.pod.name`. Caption: "Span attributes describe the call. Resource attributes describe who made it."
4. The same query now lights up matching spans across all three services at once, and a vendor's out-of-the-box dashboard works immediately, no custom mapping.
5. A small "shared names, agreed once" card sits beside the now-identical fields.

**The moment**: Beat 1's query lighting one of three services against beat 4's identical query lighting all three.

**Interaction**: Toggle each service's field naming between custom and conventional, and watch the cross-service query's hit count change.

**Ending**: Three spans, one shared field name highlighted across all of them, the query matching every one.

**Variants**: `structured-logging`, `opentelemetry`, `signal-correlation`, `service-map`.

**Techniques**: contents, restyle, spotlight, toggle, side by side, caption.

**Review**: Improved — the nameless span now shows the real default (`unknown_service`), and beat 3 adds the span-attribute vs resource-attribute distinction (the call vs who made it), which the title promised. One query lighting one service, then all three, is the moment. Weighed an "everyone spells the address differently" metaphor; the live query is more convincing.
