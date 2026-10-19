# Google Cloud plans, part 3

Stage 2 plans for `catalog/gcp.md` groups 12 to 18 (BigQuery; Messaging, events and pipelines;
Operations; Security and compliance; Cost; Delivery and infrastructure as code; AI and machine
learning), in catalog order. These plans share the visual language used across all three Google
Cloud parts: nesting drawn as nested frames (organization › folders › projects); real Google
Cloud names and icons throughout (BigQuery, Pub/Sub, Cloud Tasks, Eventarc, Dataflow, Cloud
Logging, Cloud KMS, Security Command Center, Cloud Build, Cloud Deploy, the Gemini Enterprise
Agent Platform); messages as small numbered envelopes travelling along arrows; BigQuery storage
as a flat tray of vertical column strips (Colossus) kept separate from BigQuery compute, worker
chips ("slots", the Dremel engine) that swarm only onto the columns and partitions a query
touches, with bytes scanned on a meter; a VPC Service Controls perimeter as a dashed fence around
a cluster of service icons that turns back any call crossing it, even with a valid credential;
"X vs Y" comparisons running the same task through both options side by side; "which service do
I use" questions as a short decision path whose answers light the matching service icon; and cost
as a coin meter. No new technique was needed; the existing vocabulary (especially boundary,
choice, meter and token) covers every idea in this part.

## BigQuery

### BigQuery: separation of storage and compute (`gcp-bigquery-architecture`)

**The aha**: BigQuery storage and compute are two different systems, sized and billed
independently, joined only at query time.
**Misconception to defeat**: That BigQuery is a database server you have to size, the way you'd
size a cluster.
**Cast**: Left, a wide tray of vertical column strips labelled by name (`order_id`, `customer`,
`total`, `ts`…), tag "storage · Colossus · 400 TB". Right, a loose pool of small worker chips
labelled "slots · Dremel". A thin line "Google's petabit network" joins them. A query box above,
a bytes-scanned meter below.
**Opening frame**: Full tray of columns, slot pool idle at the side, meter at zero. _"Data sits
here. Compute sits there."_
**Story**:

1. Type `SELECT name, total FROM orders`: only the `name` and `total` strips light up, the rest of
   the tray stays dim. _"A query only touches some columns."_
2. Slots peel off the pool and swarm onto the lit strips, each taking a slice in parallel.
   _"Thousands of slots, allocated for this query only."_
3. Results stream back over the network line into a result table; the slots drain back to the
   pool. _"Borrowed, then returned."_
4. Beside it, a fixed-size warehouse cluster sits lit all night, same size at 3am as at noon, its
   disks holding the data. _"A sized cluster holds the data and runs, and costs, even idle."_
5. The tray grows to petabytes and a second query fans out over thousands of slots; a bytes-scanned
   meter moves per query, a separate storage meter only with what is stored. _"Grow storage and
   compute separately."_
   **The moment**: Beat 4, side by side: the fixed cluster still burning cost at 3am against
   BigQuery between queries, where the compute meter sits at zero and only the tray remains.
   **Interaction**: Run a query and watch which columns light and how many slots swarm in; toggle
   "fixed cluster" to compare its always-on cost.
   **Ending**: Slot pool at rest, tray intact, meter showing only what was scanned.
   **Variants**: `gcp-bigquery-pricing-slots`, `gcp-bigquery-partitioning-clustering`; data's
   `columnar-storage`, `separating-storage-compute`.
   **Techniques**: contents, spotlight, stream, side by side, meter, zoom, caption.
   **Review**: Improved — weighed leading with the column-store point (read only `name` and `total`) and
   kept storage/compute separation as the lead since it is the catalog's aha and beat 1 already shows
   columns. Checked: Colossus storage, Dremel slots, Jupiter petabit network, on-demand compute that
   sits at zero between queries. Fixed beat 4 (the fixed cluster is the one whose disks hold the
   data, which is why it can't shrink) and beat 5 (storage and bytes-scanned are two separate
   meters, not one).

### BigQuery slots: on-demand vs capacity pricing (`gcp-bigquery-pricing-slots`)

**The aha**: On-demand bills by the bytes a query reads from a shared pool; capacity pricing
reserves slots so cost tracks time, not bytes, and becomes a performance knob.
**Misconception to defeat**: That "serverless" means free of any capacity question, or that
reserving slots is only about saving money.
**Cast**: A slot pool shared by many projects' query bars. A second, fenced-off pool labelled
"Reservation: prod · baseline 500 · autoscale up to 2,000 max". A coin meter and a stopwatch, side
by side.
**Opening frame**: Several project queries drawing slots from one shared pool; coin meter rising
with each query's TB scanned. _"On-demand: pay per byte read."_
**Story**:

1. A huge ad-hoc query lands and grabs a big share of the shared pool; a small dashboard query
   gets fewer slots and slows, stopwatch spinning. _"Shared means contention at peak."_
2. Switch to capacity: the dashboard's project is assigned a fenced reservation with baseline
   slots always ready. _"A reservation guarantees slots to a project."_
3. The same ad-hoc rush now can't touch the reservation; the dashboard runs at a steady pace. Coin
   meter stops moving with query size; a slot-hour meter ticks instead, baseline slots included
   even when idle. _"Cost now tracks slot time, not bytes. Idle baseline still costs."_
4. Autoscaling slots light up temporarily under a load spike in the reservation, then retract.
   _"Slots are now a dial, not just a bill."_
   **The moment**: Beat 3, the dashboard's query time flattening to the same duration regardless of
   how much the ad-hoc query reads, because it's no longer sharing.
   **Interaction**: Dial the reservation's baseline slots up and down and watch the dashboard query's
   duration change; switch pricing mode and watch which meter moves (bytes vs time).
   **Ending**: Two project lanes, one still metering bytes, one metering time against guaranteed
   slots.
   **Variants**: `gcp-bigquery-architecture`, `gcp-choose-data-processing`; cost's
   `pay-as-you-go-vs-reserved`.
   **Techniques**: contents, meter, dial, boundary, side by side, caption.
   **Review**: Improved — weighed "reservation = discount" as the lead and rejected it: the catalog's
   point is that slots become a performance knob. Fixed: on-demand queries share and slow down under
   fair scheduling rather than strictly queueing; baseline slots bill even when idle (so capacity is
   not automatically cheaper); the autoscale figure is a maximum. Note for the owner: the project
   that runs the job pays, not the one that owns the data.

### BigQuery partitioning and clustering (`gcp-bigquery-partitioning-clustering`)

**The aha**: `SELECT *` with `LIMIT 10` is not cheap: BigQuery still has to read every unpruned
partition and block before it can show you ten rows, unless partitioning and clustering let it
skip most of the table.
**Misconception to defeat**: That `LIMIT 10` or a `WHERE` clause on any column makes a query
cheap.
**Cast**: The BigQuery column tray from `gcp-bigquery-architecture`, now sliced into 31 daily
partitions (Mar 1, Mar 2…) with each partition further sliced into blocks sorted by `user_id`. A
bytes-scanned meter.
**Opening frame**: `SELECT * FROM events LIMIT 10`, the full tray lit end to end, meter reading
"2.1 TB". _"LIMIT 10 still reads everything."_
**Story**:

1. Add `WHERE event_date = '2026-03-02'`: only that day's partition lights; the other 30 dim to
   grey. Meter drops from 2.1 TB to "68 GB" (2.1 TB / 31 days). _"Filter on the partition column,
   and whole slabs are skipped before the query even runs."_
2. The dry-run estimate appears above the query box before running, same number. _"You can see
   the saving before you pay for it."_
3. Add `AND user_id = 'u881'` on a table clustered by `user_id`: inside that day's partition, only
   the matching blocks light. The dry run still says "up to 68 GB" (an upper bound); the real
   bytes billed after the run read "40 MB". _"Clustering prunes inside the partition, and the
   final bill shows it."_
4. Swap the filter to a non-partition, non-clustered column: the whole tray relights, meter back
   to "2.1 TB", LIMIT 10 or not. _"Filtering the wrong column buys nothing."_
   **The moment**: Beat 1 against the opening frame — same ten rows returned, 2.1 TB vs 68 GB
   scanned, from one added filter.
   **Interaction**: Edit the WHERE clause and watch the meter and the lit partitions update live
   before running.
   **Ending**: Tray mostly dark, meter low, ten rows on screen — proof that LIMIT never saved
   anything, the filter did.
   **Variants**: `gcp-bigquery-architecture`, `gcp-bigquery-pricing-slots`; data's
   `database-indexes`.
   **Techniques**: contents, spotlight, meter, dial, caption.
   **Review**: Improved — weighed leading with "fewer columns beat `SELECT *`" (already in
   `gcp-bigquery-architecture`) and kept the LIMIT misconception, which beats 1 and 4 defeat on
   screen. Fixed an arithmetic and structure slip: partitions were drawn monthly but the filter was
   a single day, so 2.1 TB to 68 GB did not add up; now 31 daily partitions. Also fixed the dry run:
   it is exact for partition pruning but only an upper bound for clustering, which shows up in the
   bytes billed after the run. Interaction could add the `require_partition_filter` option.

## Messaging, events and pipelines

### Pub/Sub topics and subscriptions (`gcp-pubsub-model`)

**The aha**: One topic can feed many independent subscriptions, each getting its own full copy of
every message, so adding a consumer never touches the publisher.
**Misconception to defeat**: That a message is consumed once and gone, like a queue.
**Cast**: A topic drawn as a funnel "orders-topic". Publishers on the left posting envelope
tokens into it. Below, subscription mailboxes, each with its own stack of pending envelopes and
an ack button. Messages are small numbered envelopes.
**Opening frame**: One publisher, the topic, one subscription mailbox with a stack. _"A publisher
posts; a subscription collects."_
**Story**:

1. The publisher posts envelope #1; it travels into the topic, then clones into the one
   subscription's stack. _"Each subscription gets a copy."_
2. A new mailbox "analytics-sub" is added beside the first, no change to the publisher. The
   publisher posts #2; it clones into both stacks now. _"Add a subscription, get every message,
   no code change upstream."_
3. Worker A pulls and acks envelope #2; it disappears from the first mailbox only, and still sits
   in analytics-sub's stack (#1 was never there: a new subscription sees only what is published
   after it exists). _"Each subscription tracks its own progress."_
4. The publisher posts #3. Worker A pulls it but doesn't ack before its deadline (a timer runs
   out); #3 reappears in A's stack, red, "redelivered". _"Unacked past the deadline: redelivered.
   At-least-once by default."_
5. A second worker joins the first mailbox: the remaining envelopes now split between the two
   workers (not copied), while analytics-sub still holds its own full set. Zoom: retention reads
   "7 days" for unacked messages. _"Many workers on one subscription share the load. Slow
   consumer, still safe for a week."_
   **The moment**: Beat 2, the second mailbox filling with its own full copy the instant it's
   attached — no new publisher code, no replay needed.
   **Interaction**: Add or remove subscriptions and watch new ones get only messages published after
   they existed; add workers to one subscription and watch them split, not copy; fail an ack and
   watch redelivery.
   **Ending**: Two mailboxes, independently drained, the topic unaffected.
   **Variants**: `gcp-pubsub-delivery-controls`, `gcp-pubsub-vs-cloud-tasks`, `gcp-eventarc`;
   messaging's `pub-sub-fan-out`, `at-least-once-delivery`.
   **Techniques**: token, clone, contents, timer, failure, appear / disappear, caption.
   **Review**: Improved — weighed contrasting with a classic queue first (one mailbox, message gone
   after read) and kept the add-a-subscription reveal, which defeats "consumed once" more
   directly. Fixed a beat that contradicted the cast: the original acked #1 and showed it still in
   analytics-sub, a subscription created after #1 was published. Added the other half of the
   catalog's aha (workers on one subscription share, subscriptions copy). Checked: 7-day default
   retention, at-least-once by default.

### Pub/Sub ordering keys, exactly-once delivery and dead-letter topics (`gcp-pubsub-delivery-controls`)

**The aha**: Each delivery guarantee is scoped narrowly — ordering per key, exactly-once per
region and pull-only — and a dead-letter topic is what stops one bad message from looping
forever.
**Misconception to defeat**: That turning on "exactly-once" or "ordering" makes the whole topic
behave that way everywhere.
**Cast**: A subscription mailbox split into lanes by ordering key (`user-7`, `user-9`). An
exactly-once switch. A retry counter chip on one envelope. A dead-letter topic mailbox off to the
side.
**Opening frame**: Envelopes arriving out of order across two key lanes, unsorted. _"By default,
no promised order."_
**Story**:

1. Turn on ordering (a setting on the subscription; publishers stamp each envelope with a key):
   envelopes in lane `user-7` queue strictly 1, 2, 3; lane `user-9` independently queues 1, 2.
   _"Ordering holds within a key, within a region — not across keys."_
2. Envelope #2 in `user-7` is malformed: every attempt fails, and #3 waits behind it in the same
   lane; `user-9`'s lane keeps moving. _"One stuck message blocks only its own key."_
3. #2's retry counter climbs, backoff lengthening each time; at the max attempts (default 5) it is
   rerouted to the dead-letter topic mailbox, and #3 immediately starts flowing. _"Max attempts
   reached: off to the dead-letter topic. The lane is unblocked."_
4. Switch on exactly-once (pull, same-region subscriber): an ack is confirmed with a success
   stamp, and a duplicate redelivery of that acked message bounces off an "already delivered"
   stamp; an envelope never acked still redelivers. _"Acked means not redelivered. Pull
   subscriptions, same region, and the subscriber must check the ack result."_
   **The moment**: Beat 2 into beat 3, the blocked lane next to the flowing one, then the poison
   envelope lifted out into the dead-letter mailbox and the stall ending. Ordering's cost is a
   stall, and the dead-letter topic is the way out.
   **Interaction**: Pick which guarantees are on; break one message (never ack it) and watch it
   either block its lane, retry with backoff, or land in the dead-letter topic depending on the
   settings.
   **Ending**: The dead-letter mailbox holding the one poison envelope, both key lanes flowing clean.
   **Variants**: `gcp-pubsub-model`, `gcp-pubsub-vs-cloud-tasks`; messaging's `ordered-delivery`,
   `dead-letter-queue`, `exactly-once-processing`.
   **Techniques**: lanes, token, timer, failure, restyle, caption.
   **Review**: Improved — weighed three independent mini-demos (the original shape) against one
   poison message that ties all three together; the combined story is sharper because the
   dead-letter topic is what ends the ordering stall. Checked: ordering is per key and per region,
   exactly-once is pull-only and same-region and needs the ack result checked, dead-letter default 5
   attempts (range 5 to 100), backoff via retry policy, the Pub/Sub service agent needs publish
   rights on the dead-letter topic (could be a small padlock on the mailbox). Removed the original
   beat order that showed dead-lettering without any tie to ordering.

### Pub/Sub vs Cloud Tasks (`gcp-pubsub-vs-cloud-tasks`)

**The aha**: Pick by whether the sender knows who should handle the work — Pub/Sub broadcasts a
fact to anyone interested, Cloud Tasks hands one specific job to one named endpoint under your
control.
**Misconception to defeat**: That they're interchangeable queue products, differing only in name.
**Cast**: A question card: "Does the sender know which handler should run this?" branching to two
icons. No: Pub/Sub (a funnel with many mailboxes). Yes: Cloud Tasks (a single queue feeding one
HTTP endpoint with a rate dial and a clock). The same task, "order placed", run through each side
by side.
**Opening frame**: The question card alone, both service icons dim. _"Pub/Sub or Cloud Tasks?"_
**Story**:

1. "Does the sender know which handler should run this?" — "No, anyone interested" lights
   Pub/Sub. The event clones into three subscription mailboxes (email, inventory, analytics)
   with zero coupling to the publisher. _"A fact for anyone interested: Pub/Sub."_
2. The same event rerouted: "Yes: exactly this endpoint, at a controlled rate, maybe later" lights
   Cloud Tasks. The event becomes a single task aimed at one HTTP endpoint,
   a rate-limit dial capped "10/sec", a scheduled-time clock set to "in 2 hours". _"A job for one
   handler, on your terms: Cloud Tasks."_
3. Side by side: Pub/Sub's three mailboxes filling instantly and independently vs Cloud Tasks'
   single lane metering out one task every 100ms to protect a fragile downstream API,
   deduplicated by task name.
4. A burst of 5,000 jobs aimed at the fragile API: pushed as events from a Pub/Sub push
   subscription, they arrive as fast as the endpoint will accept and it flashes red, overwhelmed
   (no per-endpoint rate cap; Pub/Sub only slows down once errors appear). The same burst as
   Cloud Tasks with the dial at 10/sec: a steady trickle, no flash. _"Pub/Sub delivers the
   fact. Cloud Tasks paces the job."_
   **The moment**: Beat 4, the same burst of work through each path — one knocks over the downstream
   API, the other protects it by design.
   **Interaction**: Choice: route the same event through either service and watch what happens to a
   fragile downstream endpoint; drag the Cloud Tasks rate dial.
   **Ending**: The question card restated with both icons now lit, one per answer path.
   **Variants**: `gcp-pubsub-model`, `gcp-choose-orchestration`; messaging's `queue-vs-pub-sub`.
   **Techniques**: choice, token, clone, side by side, dial, timer, failure, caption.
   **Review**: Improved — weighed the framing "queue vs broadcast" and kept the catalog's sharper
   one (does the sender know the handler: implicit vs explicit invocation). Fixed the question card,
   which asked different questions in the cast and in beat 1, and beat 4, which overstated things:
   a Pub/Sub pull subscriber can throttle itself, so the honest contrast is a push subscription with
   no per-endpoint rate cap against Cloud Tasks' rate dial. Checked: 10/sec = one task per 100 ms,
   dedupe by task name, scheduled time, retries.

### Eventarc (`gcp-eventarc`)

**The aha**: Eventarc lets you subscribe to "something happened" anywhere in Google Cloud — a
file landing in a bucket, an API call in the audit log — without wiring each service's own
notification mechanism by hand.
**Misconception to defeat**: That Eventarc is its own transport, separate from Pub/Sub, rather
than a layer that mostly rides on it.
**Cast**: A bucket (with a direct-event spout), a BigQuery job and a VM — the latter two with a
small "audit log" ribbon running past. A
trigger card: source → destination (a Cloud Run icon). Underneath the trigger, visible only on
zoom: a Pub/Sub topic doing the actual carrying.
**Opening frame**: A bucket, idle, a Cloud Run service, idle, nothing wired between them.
_"Something happens. Who hears about it?"_
**Story**:

1. Drop a trigger card "google.cloud.storage.object.v1.finalized → Cloud Run" between the bucket
   and the service. _"Subscribe to the event, not a custom webhook."_
2. A file lands in the bucket; a CloudEvents envelope appears, travels the trigger path, lands at
   Cloud Run, which spins up and processes it. _"Delivered as a standard CloudEvent."_
3. Zoom into the trigger path: underneath, a Pub/Sub topic and subscription are doing the
   carrying. _"Most of this rides on Pub/Sub."_
4. A second trigger: "audit log: any IAM policy change → Workflows", fed from Cloud Audit Logs
   (the ribbon), not a direct event. _"Audit-log triggers reach almost any API call. Reads
   need Data Access logs switched on."_
5. Three more trigger cards snap onto other service pairs, all built the same way.
   **The moment**: Beat 3's zoom-in, revealing the familiar Pub/Sub plumbing underneath what looked
   like a new transport.
   **Interaction**: Pick a source event and a destination from menus and watch the trigger card and
   CloudEvents envelope assemble.
   **Ending**: A small constellation of trigger cards linking services that never call each other
   directly.
   **Variants**: `gcp-pubsub-model`, `gcp-audit-logs`, `gcp-choose-orchestration`.
   **Techniques**: token, zoom, appear / disappear, path trace, caption.
   **Review**: Improved — weighed starting from the "wiring each service by hand" pain (several
   custom webhooks and notifications) and kept the zoom reveal, which defeats the "own transport"
   misconception directly. Fixed the trigger label (the real direct Cloud Storage event type is
   `google.cloud.storage.object.v1.finalized`), separated direct events from audit-log events (the
   cast gave every source an audit ribbon), and linked the Data Access logging dependency to
   `gcp-audit-logs`. Checked: CloudEvents format, "mostly Pub/Sub underneath", destinations Cloud
   Run, Cloud Run functions, GKE, Workflows.

### Scheduling and orchestration: Cloud Scheduler, Workflows, Managed Airflow (`gcp-choose-orchestration`)

**The aha**: Match the tool to the shape of the coordination — one timed trigger, a sequence of
API calls with error handling, or a many-dependency data pipeline — because each is billed and
operated differently.
**Misconception to defeat**: That any of the three is a general substitute for the others.
**Cast**: A question path with three outcomes, each lighting one icon: Cloud Scheduler (a clock
face), Workflows (a flowchart of boxes with arrows, YAML peeking out), Managed Service for Apache
Airflow (a grid of DAG nodes inside an always-on environment box).
**Opening frame**: The three icons dim, a task card "nightly report" waiting. _"What shape is the
coordination?"_
**Story**:

1. "Run this one HTTP call every night at 2am" lights Cloud Scheduler; the clock ticks to 2:00 and
   fires one token at an endpoint. _"One timed trigger."_
2. "Place an order: charge card, reserve stock, email receipt — retry each step, undo on
   failure" lights Workflows; YAML steps light in sequence, one step fails and retries with
   backoff, a parallel branch runs the email alongside the reservation. _"A sequence of calls,
   with error handling and state."_
3. "Nightly pipeline: 40 dependent jobs, backfill last week if one failed" lights Managed
   Airflow; its DAG grid lights node by node, the always-on environment box glows the whole time.
   _"Many dependencies and backfills — at the cost of an always-on environment."_
4. Wrong tool, on purpose: the three-step order process handed to Airflow lights the
   environment box to run five steps, hourly meter ticking. _"Right answer, wrong size."_ The
   40-job pipeline squeezed into one Workflows YAML grows into an unreadable list with no
   backfill. _"Not a substitute."_
5. A cost footnote under each: Scheduler near-free (a few free jobs, then cents per job), Workflows
   per-step, Airflow per-hour of the environment whether or not it's running a DAG.
   **The moment**: Beat 3's always-on glow, visibly costing even while idle, next to Workflows' and
   Scheduler's icons going fully dark between runs.
   **Interaction**: Choice: pick a task description and watch which icon lights and what it costs
   at rest.
   **Ending**: The tools chain rather than compete: Scheduler's clock fires a Workflows run, which
   calls a service. Idle states: dark, dark, dimly lit.
   **Variants**: `gcp-pubsub-vs-cloud-tasks`, `gcp-dataflow`, `gcp-cloud-build`; delivery's
   `workflow-orchestration`.
   **Techniques**: choice, timer, exchange, path trace, meter, caption.
   **Review**: Improved — weighed a decision-tree-only framing and added a wrong-tool beat because the
   original named "not substitutes" but never showed it. Checked: Workflows billed per step,
   Airflow is Managed Service for Apache Airflow (formerly Cloud Composer) with an always-on
   environment, Scheduler targets HTTP/Pub/Sub. Also changed the ending to show that Scheduler
   triggers Workflows, so the three are composed, not rivals. Beat 2's "roll back" is compensation
   steps you write in the YAML, not built-in; keep the caption as "undo on failure".

### Dataflow and the Apache Beam model (`gcp-dataflow`)

**The aha**: The same transforms run on bounded batch data and on an endless stream (only the
source changes), because Beam's windows and watermarks — not the code — decide when a chunk of
event-time is "done".
**Misconception to defeat**: That streaming needs different code from batch, or that data
arriving late is simply missed.
**Cast**: A pipeline diagram of transform boxes. Below it, a timeline with event time on one axis
and a watermark line sweeping right, lagging slightly behind the latest event-time seen. Windows
drawn as shaded vertical bands. A worker pool that grows and shrinks.
**Opening frame**: The pipeline diagram, a toggle reading "batch". _"One pipeline, read to the
end."_
**Story**:

1. Flip the toggle to "streaming": the source box swaps from a file to Pub/Sub, the transform
   boxes stay put and now sit above an unending stream of event tokens; the worker pool autoscales
   as the rate rises. _"Same transforms, now unbounded."_
2. A 5-minute window band shades on the event-time axis; tokens with timestamps inside it
   accumulate. _"Group by when it happened, not when it arrived."_
3. The watermark line (the pipeline's estimate of "no older events are still coming") sweeps past
   the window's right edge; the window fires and emits its result. _"The watermark decides a
   window is done."_
4. A token arrives late — its event-time stamp falls inside a window the watermark already
   passed. With the default (allowed lateness zero) it is dropped; with allowed lateness set to,
   say, 10 minutes, a late trigger fires and the window emits a corrected result. _"Late doesn't
   mean missed, if the pipeline allows for it."_
5. The worker pool shrinks back as the rate drops; shuffle state is shown living in a separate
   backend service, not on the workers.
   **The moment**: Beat 4, slowed — a stray late token arriving after its window closed, and the
   deliberate choice of what happens to it.
   **Interaction**: Drag a token's arrival time independent of its event-time stamp and watch
   whether it lands inside or outside its window; toggle batch/streaming on the same pipeline.
   **Ending**: The watermark line sweeping steadily rightward, windows closing behind it like a wake.
   **Variants**: `gcp-pubsub-model`, `gcp-managed-spark`, `gcp-choose-data-processing`; messaging's
   `stream-windows-watermarks`.
   **Techniques**: toggle, token, stream, lanes, timer, meter, spotlight, caption.
   **Review**: Improved — weighed leading with the late token (the sharpest failure) and kept the
   toggle opening, since the batch/stream equivalence is the catalog's aha. Fixed three slips:
   "unchanged code" overclaimed (the source and sink change, the transforms don't); the watermark
   is an estimate, not a fact; and what happens to late data is governed by allowed lateness plus
   triggers, not by the trigger alone (default lateness zero drops it). Interaction should show
   the dragged token landing before and after the watermark.

### Managed Service for Apache Spark and ephemeral clusters (`gcp-managed-spark`)

**The aha**: Because the data lives in Cloud Storage, not HDFS, a Spark cluster can be born for
one job and deleted when it finishes, instead of sitting permanently idle most of the day.
**Misconception to defeat**: That Spark on Google Cloud means a permanent Hadoop-style cluster
you keep running.
**Cast**: A Cloud Storage bucket holding the data, unaffected throughout. Beside it, a cluster
footprint that appears, works and disappears: a ring of worker nodes connecting to the bucket via
a thin "Cloud Storage connector" line instead of a disk icon. A clock showing "90 seconds" for
startup. A cost meter.
**Opening frame**: An empty lot where a cluster could be, bucket full of data beside it, meter at
zero. _"No cluster, until there's a job."_
**Story**:

1. A job submits; a ring of worker nodes materialises in about 90 seconds, each wired to the
   bucket by the connector line, not a local disk. _"Data stays in Cloud Storage. The cluster is
   just compute."_
2. A Spot-labelled secondary worker joins the ring, cheaper, slightly fainter. _"Add Spot workers
   for cheap, interruptible extra capacity."_
3. The job finishes; the entire ring fades out at once. _"Delete the cluster when the job is
   done."_
4. A permanent Hadoop cluster with its data on HDFS disks sits beside it, lit 24/7: utilisation
   bar mostly empty overnight, cost meter climbing. Try to delete it and its data goes dark with
   it. _"Data on the cluster's disks pins the cluster. A permanent cluster burns cost even idle."_
5. A second, differently-shaped ring appears for a different job, reads the same bucket, then
   also vanishes; a third job runs as a serverless Spark batch with no ring at all. _"Or skip the
   cluster entirely."_
   **The moment**: Beat 3 against beat 4 — the ephemeral ring vanishing completely versus the
   permanent cluster's cost meter that never stops.
   **Interaction**: Submit a job and watch the cluster spin up, work and tear down; toggle a Spot
   secondary worker on or off.
   **Ending**: Empty lot again, bucket intact, meter reading only the minutes the ring existed.
   **Variants**: `gcp-dataflow`, `gcp-choose-data-processing`, `gcp-data-transfer-options`.
   **Techniques**: appear / disappear, timer, meter, side by side, token, caption.
   **Review**: Improved — weighed "serverless Spark replaces clusters" as the lead and rejected it:
   the catalog's aha is that data in Cloud Storage is what frees the cluster, so beat 4 now shows the
   HDFS cluster that cannot be deleted. Checked: about 90-second startup, Cloud Storage connector
   instead of HDFS, Spot secondary workers (they hold no HDFS data, which is why they are safe to
   lose), current name Managed Service for Apache Spark (formerly Dataproc). Kept the interaction.

### Choosing a data processing service (`gcp-choose-data-processing`)

**The aha**: The deciding questions are whether it's streaming, whether there's existing Spark
code, and whether the builders write SQL, write code, or want a visual tool — and increasingly
the default answer is "load it into BigQuery and transform it with SQL."
**Misconception to defeat**: That more data always calls for a bigger, more specialised pipeline
tool.
**Cast**: A question path — "Streaming?" / "Existing Spark code?" / "SQL, code, or visual?" —
branching to six icons: BigQuery SQL (with Dataform), Dataflow, Managed Service for Apache Spark,
Cloud Data Fusion, Datastream, Pub/Sub. A raw data source at the top feeding whichever path
lights.
**Opening frame**: Raw data at the top, all six icons dim, the first question card showing.
_"Which tool fits the shape of the work?"_
**Story**:

1. "One-off batch load, SQL-literate team, no streaming logic" lights straight to BigQuery SQL +
   Dataform; data lands in a table, transforms run as scheduled SQL. _"Increasingly the default:
   land it, transform it with SQL."_
2. Same source, "streaming, with windowing logic SQL can't express" lights Dataflow; Beam
   pipeline boxes appear. _"Needs code-level stream logic."_
3. "Existing Spark jobs to lift and shift" lights Managed Service for Apache Spark; an ephemeral
   cluster ring appears briefly. _"Bring the Spark code you already have."_
4. "Non-engineers, connector-heavy, want drag-and-drop" lights Cloud Data Fusion; a visual
   pipeline canvas appears. _"A visual tool for connector-based ETL."_
5. "Continuously mirror a production database" lights Datastream, a CDC stream running
   continuously beside the untouched source database, landing in BigQuery.
6. Pub/Sub sits in front of the streaming path as its doorway, feeding Dataflow; it carries the
   events, it does not process them. _"Pub/Sub brings data in. It doesn't transform it."_
   **The moment**: The same raw data source lighting a different icon purely from how the three
   questions are answered, with BigQuery SQL as the path lit most often, even when a data-size
   slider is dragged up to petabytes (size alone never changes the answer).
   **Interaction**: Choice: answer the three questions and watch exactly one path light end to end;
   drag the data-size slider and watch the answer stay put.
   **Ending**: All six icons shown once, with the taken path still glowing.
   **Variants**: `gcp-dataflow`, `gcp-managed-spark`, `gcp-pubsub-model`; data's `etl-vs-elt`.
   **Techniques**: choice, path trace, spotlight, appear / disappear, caption.
   **Review**: Improved — weighed ranking tools by data size and rejected it; the catalog's three
   questions are the truer frame, and the original never defeated "more data needs a bigger tool".
   Added the size slider that changes nothing, and gave Pub/Sub (one of the six icons, never lit
   before) its beat. Checked: Dataform manages the SQL transforms in BigQuery, Datastream is CDC,
   Spark is for existing code, orchestrators (`gcp-choose-orchestration`) coordinate rather than
   process.

## Operations

### Google Cloud Observability: which tool answers which question (`gcp-observability-suite`)

**The aha**: Each Observability tool answers one distinct question, and a VM shows only what the
hypervisor sees until an Ops Agent is installed to report what's inside it.
**Misconception to defeat**: That "monitoring" is one tool, or that missing memory graphs mean
monitoring is broken.
**Cast**: Five tool icons in a row, each with its question label: Cloud Monitoring ("is it
healthy?"), Cloud Logging ("what happened?"), Cloud Trace ("where did the time go?"), Cloud
Profiler ("what's burning CPU?"), Error Reporting ("what's crashing?"). A VM below with a
hypervisor boundary and an Ops Agent toggle.
**Opening frame**: All five icons lit grey, the VM showing only CPU, network and disk I/O
(hypervisor-visible) with memory and disk-space graphs blank. _"Five tools. Five questions."_
**Story**:

1. A request slows down; Trace lights, a waterfall of spans shows which service ate 400ms of a
   420ms request. _"Where did the time go — Trace."_
2. The same service throws an exception; Error Reporting lights, grouping ten occurrences into
   one card. _"What's crashing — Error Reporting."_
3. A dashboard built on Monitoring shows latency and error-rate charts turning amber against an
   SLO line. _"Is it healthy — Monitoring."_
4. Flip the Ops Agent toggle on the VM: memory and disk-space graphs light up in Monitoring, and
   application logs start flowing into Logging — both blank before. _"The hypervisor sees CPU,
   network and disk I/O. The Ops Agent sees inside."_
5. Profiler lights beside a function-level flame graph pinpointing which function burns the CPU.
   _"Which code — Profiler."_
   **The moment**: Beat 4, the memory graph snapping from blank to populated the instant the Ops
   Agent switch flips — the missing graph was never a bug, just a missing agent.
   **Interaction**: Toggle the Ops Agent and watch which graphs appear; click each tool icon to see
   its one question answered.
   **Ending**: All five tools lit on a single incident, each contributing one fact.
   **Variants**: `gcp-log-router-sinks`, `gcp-audit-logs`; observability's `three-pillars`.
   **Techniques**: spotlight, toggle, chart, appear / disappear, caption.
   **Review**: Improved — weighed building it around one incident from alert to root cause and kept
   the five-questions grid, which is the catalog's point; the incident thread already runs through
   beats 1 to 3 and the ending. Fixed a technical slip: the hypervisor also sees disk I/O, so what
   is blank is disk space and memory (in-guest numbers). Checked the five tools and their
   questions, and the Ops Agent shipping logs as well as metrics. Opening state shows five tools,
   no mention of the order they light in, so the viewer is not taught a sequence that does not
   exist.

### Log Router, sinks and log buckets (`gcp-log-router-sinks`)

**The aha**: Routing is decided the instant a log is written — what no sink captures is gone for
good, so exclusion filters are how you stop paying for noise before it's ever stored.
**Misconception to defeat**: That logs can be filtered or exported after the fact, like querying
a database you can always go back to.
**Cast**: A stream of log entries flowing into a junction, "Log Router". Branching sinks lead to
a locked `_Required` bucket (400 days; Admin Activity and System Event audit logs only), a
`_Default` bucket (30 days; everything else, including Data Access logs), and custom
destinations (BigQuery, Cloud Storage, Pub/Sub, another project). Each sink carries its own
inclusion filter and an exclusion-filter gate on its pipe.
**Opening frame**: A stream of log entries approaching the junction, all destinations dim except
`_Required` and `_Default`. _"Every log entry passes through here, once."_
**Story**:

1. An admin-activity entry flows straight to `_Required`, past a padlock — it can't be excluded.
   _"Admin and system audit logs: always on."_
2. A noisy debug entry flows toward `_Default`; that sink's exclusion gate slams shut — the entry
   matches no other sink either, so it never lands anywhere and there is no storage charge.
   _"Excluded by every sink — never stored, never billed."_ (An entry excluded from one sink
   still reaches any other sink that includes it.)
3. A custom sink with its own inclusion filter diverts matching entries sideways into BigQuery,
   where a Log Analytics query runs SQL over them. _"A sink is a filtered copy, sent anywhere."_
4. An aggregated sink at the organization frame collects a copy from every child project's stream
   into one locked security project — project owners' own sink settings don't touch it. _"Central
   security logging that project owners can't switch off."_
5. A week later, someone asks for the excluded debug entries: nothing to show. _"What no sink
   kept is gone."_
   **The moment**: Beat 5 against beat 2 — the realisation that the "cheap" excluded log is
   unrecoverable, not just uncounted.
   **Interaction**: Toggle an exclusion filter and watch entries vanish before storage, with no way
   to retrieve them afterward.
   **Ending**: The junction mid-stream, each destination holding only what it was configured to
   catch.
   **Variants**: `gcp-audit-logs`, `gcp-observability-suite`; observability's `log-aggregation`.
   **Techniques**: stream, boundary, toggle, failure, token, caption.
   **Review**: Improved — weighed the "bouncer at the door" framing (one global filter) and rejected
   it as inaccurate: exclusion filters belong to individual sinks, which is why "gone for good"
   only holds when no sink keeps the entry. Fixed `_Required` (it holds Admin Activity and System
   Event audit logs only; Data Access logs go to `_Default`, which the audit-logs plan relies on) and
   moved the exclusion gate onto each sink. Checked: 400-day and 30-day retention, aggregated
   sinks at organization or folder, Log Analytics over BigQuery-linked buckets.

### Cloud Audit Logs (`gcp-audit-logs`)

**The aha**: Who changed a configuration is always recorded for free; who merely read sensitive
data is only recorded if you deliberately turn on Data Access logs for that service, because of
the volume.
**Misconception to defeat**: That all access to a resource is audited equally and automatically.
**Cast**: Four audit log categories as labelled trays: Admin Activity (green, "always on"), Data
Access (grey, "off by default"), System Event, Policy Denied. A BigQuery table with reader and
writer figures approaching it, and a Cloud Storage bucket `customer-exports` with a reader
figure.
**Opening frame**: The four trays, Admin Activity glowing, the other three dim. _"Admin actions:
always logged, free."_
**Story**:

1. An engineer changes a BigQuery table's IAM policy — an entry drops straight into Admin
   Activity with no setup. _"Configuration changes: automatic."_
2. An analyst downloads `customers.csv` from the Cloud Storage bucket: nothing happens in any
   tray. _"Reading sensitive data: not logged — yet."_ (Aside: BigQuery is the exception, its
   Data Access logs are on by default.)
3. An admin flips on Data Access logging for Cloud Storage specifically; the tray brightens. The
   same download now drops an entry: who, what object, when. _"Turn it on, selectively, because of
   volume."_
4. A flood of read entries fills the Data Access tray fast, a size warning appears ("potentially
   huge"), contrasted with Admin Activity's gentle trickle. _"That's why it's mostly off by
   default."_
5. A request blocked by a VPC Service Controls perimeter drops into the Policy Denied tray
   instead of succeeding or failing silently. _"Refused by a security policy — recorded too."_
   **The moment**: Beat 2 against beat 3 — the identical download logged nowhere, then logged
   everywhere, by one switch.
   **Interaction**: Toggle Data Access logging per service and watch which actions start leaving a
   trail.
   **Ending**: All four trays holding their respective entries from one short scenario.
   **Variants**: `gcp-log-router-sinks`, `gcp-vpc-service-controls`; security's `audit-logging`.
   **Techniques**: contents, toggle, appear / disappear, meter, caption.
   **Review**: Improved — weighed a "who changed it vs who looked at it" two-tray framing and kept
   the four trays (the catalog names all four). Fixed a factual contradiction: the original showed
   a BigQuery read going unlogged, but BigQuery Data Access logs are on by default; the scenario now
   uses Cloud Storage, with BigQuery named as the exception. Checked: Admin Activity, System Event
   and Policy Denied are on without setup; Data Access is configured per service; Policy Denied
   catches VPC Service Controls refusals. Interaction note: where entries land (`_Required` vs
   `_Default`) is `gcp-log-router-sinks`.

## Security and compliance

### Encryption key options: default, CMEK, Cloud HSM, Cloud EKM and CSEK (`gcp-encryption-key-options`)

**The aha**: Every option is a spectrum of who holds the key and who can pull the plug —
encryption itself is always on, the real choice is control.
**Misconception to defeat**: That unencrypted data is the baseline and these are ways to "add"
encryption.
**Cast**: A data object, always shown wrapped in a lock icon (encrypted by default). Below it, a
ladder of key holders: Google-managed (a Google-held key icon), CMEK (a Cloud KMS key ring you
own, software or Cloud HSM shield), Cloud EKM (a key icon sitting outside Google's boundary, in
an external vault), CSEK (a raw key handed over with the request, no storage).
**Opening frame**: The data object, locked, Google's key icon holding it. _"Already encrypted.
Who holds the key?"_
**Story**:

1. Step up to CMEK: the key moves into your own Cloud KMS key ring (key ring → key → version);
   disable the key, and the data object instantly greys out, unreadable, while still physically
   intact. _"Disable your key, and the data goes dark."_
2. Step to Cloud EKM: the key icon moves entirely outside Google's boundary into an external
   vault; a decrypt request now has to leave Google and get permission from that vault each
   time. _"Google can't decrypt without your external system saying yes."_
3. Step to CSEK (Cloud Storage and Compute Engine disks only): the raw key travels with every
   single request from the caller and Google never stores it; the next request without it fails
   outright. _"Lose the key, lose the data — nothing to fall back to."_
4. An audit log ribbon runs alongside the CMEK and EKM steps, recording each use of the key once
   Cloud KMS Data Access logs are on (see `gcp-audit-logs`).
   **The moment**: Beat 1 — a disabled CMEK key, one step away from Google, with the data object
   visibly grey, proving the key, not the data, is the control point.
   **Interaction**: Step along the ladder and, at each rung, try disabling or losing the key to see
   what happens to the data object.
   **Ending**: The ladder with CMEK's key disabled and the data dark, Google's physical copy of the
   bytes untouched underneath.
   **Variants**: `gcp-secret-manager`, `gcp-vpc-service-controls`; security's `envelope-encryption`.
   **Techniques**: boundary, toggle, restyle, path trace, caption.
   **Review**: Improved — weighed a lock-and-key-ownership picture (who holds the key, simpler) and
   kept the ladder with the "pull the plug" test at each rung, which makes control tangible.
   Checked: always-on default encryption, key ring to key to version, CMEK key disable makes data
   unreadable while bytes stay intact (destroy is scheduled with a delay, so the demo uses
   disable), EKM calls out to the external manager each time, CSEK is raw per-request and limited to
   Cloud Storage and Compute Engine. Fixed: the audit ribbon claim now notes the Data Access logs
   dependency, and CSEK's scope. Could add a small envelope zoom (data key wrapped by your key) as
   a link to security's `envelope-encryption`.

### Secret Manager (`gcp-secret-manager`)

**The aha**: A secret is a resource with its own IAM and audit trail, so rotating a credential
means adding a new version, not redeploying code with a hard-coded value.
**Misconception to defeat**: That secrets live safely enough baked into code or environment
variables, and that "rotating" means editing and redeploying.
**Cast**: A secret resource `db-password` holding a stack of versions (v1, v2, a `latest` tag
floating above the newest). A Cloud Run service fetching via its service account. An IAM lock on
the secret itself.
**Opening frame**: `db-password` v1, `latest` pointing to it, a Cloud Run service with no
credential baked in. _"A secret with its own guard."_
**Story**:

1. The Cloud Run service, as its service account, requests `latest`: a token travels to the
   secret, is checked against the IAM lock (Secret Manager Secret Accessor), passes, and returns
   v1's value, used in memory only. _"Fetched at runtime, by identity — never hard-coded."_
2. A second workload without the Accessor role tries the same fetch: bounces, red. _"IAM per
   secret, not a shared vault anyone can read."_
3. The password is rotated: v2 appears in the stack, `latest` slides up to point at it; v1 stays
   in the stack, retrievable by version if needed. _"Rotate by adding a version."_
4. The Cloud Run service, unchanged, fetches again later (at runtime through the API, or via a
   mounted file) and gets v2. _"No redeploy. No code change."_ A small aside: a secret exposed
   as an environment variable is read when an instance starts, so a new instance picks up v2.
5. An old deployment, shown for contrast, has the password typed directly into an environment
   variable visible in its console config. _"The alternative: baked in, and stuck until
   redeployed."_
   **The moment**: Beat 4 — the identical, unredeployed code receiving a different value simply
   because `latest` moved.
   **Interaction**: Add a new secret version and watch the next fetch pick it up without touching
   the workload.
   **Ending**: The version stack with `latest` on top, the workload quietly using whatever it points
   to.
   **Variants**: `gcp-encryption-key-options`, `gcp-application-default-credentials`; security's
   `secrets-management`.
   **Techniques**: contents, token, move, appear / disappear, boundary, caption.
   **Review**: Improved — weighed leading with the leaked-env-var failure (the "before") and kept
   the version stack first, because the new idea is the resource, not the old mistake (beat 5
   still shows the contrast). Checked: Secret Accessor role per secret, immutable versions,
   `latest` alias, v1 stays retrievable. Fixed a hidden assumption in beat 4: the new value reaches
   the workload only if it reads at runtime or at instance start; and production should usually pin
   a version number rather than `latest` so a bad rotation doesn't hit every instance at once
   (offer as an interaction toggle: pin vs latest).

### Identity-Aware Proxy and context-aware access (`gcp-identity-aware-proxy`)

**The aha**: Access is decided per request by who you are and what device you're on, so an app
behind IAP needs no VPN and no bastion host at all.
**Misconception to defeat**: That reaching an internal app requires being on the corporate
network.
**Cast**: A laptop (user "Dana") outside any network boundary, trying to reach an app server. In
front of the app, an IAP checkpoint checking identity plus context (device, location) against
Access Context Manager access levels. A faded, crossed-out VPN tunnel icon beside it, for
contrast.
**Opening frame**: Dana's laptop, open internet, the IAP checkpoint in front of the app, no VPN
icon present at all. _"No network to join."_
**Story**:

1. Dana's request arrives at IAP: identity checked (signed in as `dana@`), context checked
   (managed laptop, approved country) against an access level — both pass, green tick, the
   request proceeds to the app. _"Checked per request: who, and from what."_
2. The same request from an unmanaged personal laptop: identity passes, context fails the access
   level, the request bounces before reaching the app. _"Same person, wrong device — refused."_
3. An admin needs SSH into a private VM with no external IP: IAP TCP forwarding opens a tunnel
   through a firewall rule allowing only `35.235.240.0/20`, OS Login ties the SSH session to the
   admin's IAM identity. _"Even SSH goes through identity, not a bastion host."_
4. Catch: an attacker finds the app's direct address and skips the checkpoint. It works unless
   the app is locked to accept only IAP-fronted traffic (and verifies IAP's signed header); with
   that lock, the direct request bounces. _"IAP only protects the front door you force everyone
   through."_ The crossed-out VPN icon fades out.
   **The moment**: Beat 2 — the same identity denied purely on device and location, with no network
   membership involved on either side.
   **Interaction**: Change the laptop's context (managed/unmanaged, country) and watch the same
   identity pass or fail.
   **Ending**: Dana's laptop connected straight through the checkpoint, no tunnel anywhere in the
   picture.
   **Variants**: `gcp-vpc-service-controls`, `gcp-cloud-armor`; security's `zero-trust-access`.
   **Techniques**: boundary, choice, restyle, path trace, caption.
   **Review**: Improved — weighed a VPN-vs-IAP side by side as the main frame and kept the
   per-request checkpoint, with the VPN icon only as a faded contrast. Checked: access levels come
   from Access Context Manager (sold as Chrome Enterprise Premium, formerly BeyondCorp Enterprise),
   IAP TCP forwarding range `35.235.240.0/20`, OS Login ties SSH to IAM, web apps sit behind an
   Application Load Balancer, App Engine or Cloud Run. Replaced the empty last beat (a fading icon
   teaches nothing) with the real caveat: an app reachable around IAP is not protected by it.

### VPC Service Controls (`gcp-vpc-service-controls`)

**The aha**: A service perimeter stops a valid, stolen or insider credential from moving data
out, because it checks whether the call crosses the fence, whatever IAM says about the caller.
**Misconception to defeat**: That IAM alone is enough to stop data exfiltration — if you have a
valid credential, you can go anywhere your roles allow.
**Cast**: A dashed fence around a cluster of service icons (BigQuery, Cloud Storage) inside one
project frame. An insider figure holding a perfectly valid, green-ticked IAM credential. A second
project, outside the fence, with an empty bucket.
**Opening frame**: The fence around BigQuery and Cloud Storage inside the project; the insider's
credential glowing green, valid. _"A valid credential. A perimeter anyway."_
**Story**:

1. The insider copies a BigQuery table to a bucket inside the SAME perimeter: the data flows
   through, no problem — IAM says yes, and the destination is inside the fence. _"Inside the
   perimeter, IAM alone decides."_
2. The insider retargets the copy at the bucket in the OTHER project, outside the fence, still
   using the same valid credential: the call reaches the fence and bounces, red, "Policy Denied"
   — even though IAM would have allowed it. _"Outside the fence — blocked, whatever IAM says."_
3. Zoom on the fence: an access level plus a narrow ingress rule lets a trusted device in; an
   egress rule opens a one-way door out to one named project; a perimeter bridge (two-way)
   links to a second approved perimeter. _"The fence can have named doors."_
4. A dry-run mode runs the same scenario with the fence drawn but not yet enforcing — the blocked
   call is only logged, not stopped. _"Test the fence before trusting it."_
   **The moment**: Beat 2 — the identical valid credential and command, allowed a moment ago, now
   bouncing off the fence purely because of where it's pointed.
   **Interaction**: Drag the copy destination inside or outside the fence with the same credential
   and watch it pass or bounce; toggle dry-run.
   **Ending**: The fence intact, the insider's credential still valid, the data still inside.
   **Variants**: `gcp-identity-aware-proxy`, `gcp-firewall-rules-policies`, `gcp-assured-workloads`.
   **Techniques**: boundary, token, failure, toggle, spotlight, caption.
   **Review**: Improved — weighed a stolen-laptop-credential story and kept the insider copy: it
   makes "valid credential, still blocked" visible with one identical command. Fixed two slips: the
   perimeter does not ignore the caller (access levels and ingress/egress rules use identity and
   context), the point is that crossing the boundary is what is checked; and a perimeter bridge is
   two-way, so the one-way door is an egress rule. Checked: dry-run logs but does not block,
   violations logged as Policy Denied, perimeter covers Google API calls (not network packets).

### Security Command Center (`gcp-security-command-center`)

**The aha**: Security Command Center ranks findings by what an attacker could actually reach
across the whole organization, not as a flat list of misconfigurations.
**Misconception to defeat**: That a security dashboard is just a long list of flagged problems to
work through top to bottom.
**Cast**: An organization frame holding many project frames, each scattered with small warning
icons (misconfigurations, vulnerabilities, active threats). A ranked findings panel on the right.
An attack-path line connecting several low-looking findings into one chain reaching a high-value
database.
**Opening frame**: The org frame full of scattered warning icons, no order to them, panel empty.
_"Findings everywhere. Where to start?"_
**Story**:

1. Security Health Analytics sweeps the org, lighting each misconfiguration (an open bucket, an
   overly broad IAM grant) — dozens light up, looking equally urgent. _"A flat list of
   problems."_
2. An attack path simulation draws a line connecting three "minor" findings — the open bucket,
   the broad grant, a public VM — into one chain ending at a database the org has tagged as
   high-value. _"Individually minor. Chained, a path to the database."_ (Attack paths are a
   Premium and Enterprise tier feature, drawn only toward resources you mark high-value.)
3. That chained finding jumps to the top of the ranked panel, well above a dozen isolated,
   unreachable misconfigurations below it. _"Ranked by what's actually reachable — toxic
   combinations first."_
4. A threat detection finding (a VM calling a known-bad IP, pulled from logs) lights red
   alongside, distinct from the grey misconfiguration icons. _"Attacks in progress, not just
   weaknesses."_
   **The moment**: Beat 3 — three ordinary-looking findings visually collapsing into one chained,
   top-ranked risk, while louder-looking isolated findings sink down the list.
   **Interaction**: Click any finding to trace whether it's part of a chain reaching something
   valuable, or isolated.
   **Ending**: The ranked panel with the chained finding pinned at the top, the rest sorted beneath
   it.
   **Variants**: `gcp-vpc-service-controls`, `gcp-audit-logs`, `gcp-binary-authorization`.
   **Techniques**: spotlight, path trace, restyle, contents, caption.
   **Review**: Improved — weighed a "radar of attacks" framing and kept ranking by reachability,
   which is the catalog's aha and the only part a flat dashboard can't do. Checked: Security Health
   Analytics finds misconfigurations, threat detection is separate and log/VM/container based,
   attack path simulation and toxic combinations need Premium or Enterprise, and the "crown
   jewels" must be defined as high-value resources (added). Beat 1's "equally urgent" is a visual
   device, since findings carry severities; keep the dots the same size so the point is order, not
   severity.

### Binary Authorization (`gcp-binary-authorization`)

**The aha**: The platform itself refuses to run an image that skipped a required pipeline step,
by checking cryptographic proof — even someone holding valid deploy permissions can't bypass it.
**Misconception to defeat**: That vulnerability scanning or a careful team is enough to stop
unapproved code from running.
**Cast**: A container image with a row of attestation slots underneath it, labelled "built by
Cloud Build", "passed vulnerability scan", "QA approved" — each either stamped (signed
attestation) or empty. A GKE/Cloud Run admission gate in front of the cluster. A deploy figure
with valid IAM deploy rights.
**Opening frame**: An image with all three slots stamped, sailing through the admission gate into
the cluster. _"Every required step, proven."_
**Story**:

1. The deploy figure, with full deploy rights, tries to push a second image straight from their
   laptop, skipping the pipeline — its slots are all empty. The admission gate checks for signed
   attestations, finds none, and refuses, red, regardless of the figure's IAM role. _"Deploy
   rights aren't enough. The proof has to exist."_
2. A properly built image goes through the real pipeline: Cloud Build stamps its slot, then the
   vulnerability scanner stamps its slot, then QA stamps the last one; each stamp names the
   image's digest, so the same tag pointed at different bytes would carry no stamps. _"Signed
   proof of each step, tied to these exact bytes. A scan finds problems; an attestation lets the
   platform decide."_
3. Now admitted through the gate cleanly. _"Every attestation present — it runs."_
4. A break-glass override is used once with a visible audit entry, and a dry-run mode logs
   refusals without blocking them yet.
   **The moment**: Beat 1 — a fully authorized person's deploy bouncing off the gate for the same
   reason an attacker's would, because authorization and attestation are different checks.
   **Interaction**: Toggle which attestation slots are stamped and watch the gate's verdict change
   regardless of who's deploying.
   **Ending**: The gate open only for the fully-stamped image, the empty-slotted one still sitting
   outside.
   **Variants**: `gcp-cloud-build`, `gcp-cloud-deploy`, `gcp-security-command-center`; security's
   `software-supply-chain`.
   **Techniques**: contents, boundary, failure, restyle, toggle, caption.
   **Review**: Improved — weighed "rubber stamps on a passport" and kept the attestation slots,
   which is already that picture. Checked: applies to GKE and Cloud Run, signed attestations from
   named attestors, break-glass logs an audit entry, dry-run logs without blocking, continuous
   validation exists. Fixed beat 2, which said "that same image" was pushed after being refused:
   attestations are bound to an image digest, so the story now uses a properly built image and
   adds the vulnerability-scanning contrast the catalog names (scans find, attestations block).
   Beat 4 is two ideas (break-glass, dry-run) in one caption line; keep each to a one-second flash.

### Assured Workloads and sovereignty controls (`gcp-assured-workloads`)

**The aha**: Compliance becomes a property of where a project sits in the hierarchy — create it
under an Assured Workloads folder and the regime's guardrails apply automatically, instead of
configuring every control by hand.
**Misconception to defeat**: That meeting a compliance regime means manually checking a long
list of settings on each project.
**Cast**: An org frame with an ordinary folder beside a special "Assured Workloads: FedRAMP High"
folder, both able to hold projects. Inside the special folder, a halo of automatically-applied
org policy constraints (data location, allowed services). An Access Transparency log ribbon and
an Access Approval gate on Google-staff access.
**Opening frame**: An empty "Assured Workloads: FedRAMP High" folder, its halo of constraints
already glowing, waiting for a project. _"The guardrails exist before any project does."_
**Story**:

1. Create a new project in the ordinary folder: none of the regime's constraints apply; it can
   use any region, any service the org allows. _"Outside: the regime isn't enforced."_
2. Create the same kind of project in the Assured Workloads folder instead: the halo's
   constraints snap onto it instantly — allowed regions narrow to the ones named in the regime,
   disallowed services grey out. _"Inside: the regime's rules inherited automatically."_
3. Someone tries to create a resource in a disallowed region inside the special folder: refused,
   red, by the inherited org policy, not by a person checking a checklist. _"Enforced by the
   hierarchy, monitored for violations continuously."_
4. A Google support engineer needs to touch the project for a case: an Access Approval gate
   requires the customer to approve first; Access Transparency logs the access either way. _"Even
   Google's own staff access needs your approval."_
   **The moment**: Beat 2, the instant the halo's constraints lock onto the project the moment it
   crosses into the folder, with zero manual configuration.
   **Interaction**: Create a project in either folder and watch which operations become refused.
   **Ending**: The special folder holding several projects, all sharing one automatically-applied
   set of constraints, and a small note: "Guardrails, not a certificate: the workload still has
   its own part to do."
   **Variants**: `gcp-organization-policy`, `gcp-resource-hierarchy`, `gcp-audit-logs`.
   **Techniques**: boundary, move, restyle, failure, toggle, caption.
   **Review**: Improved — weighed a checklist-vs-folder contrast and kept the pre-existing halo,
   since "guardrails exist before the project" is the catalog's aha. Fixed the mechanic: projects
   are created inside the Assured Workloads folder (the original had the viewer drag projects across,
   which implies existing projects can be moved in with the regime applied), and added the shared
   responsibility caveat so the folder isn't read as automatic compliance. Checked: data location
   and allowed-service org policies, personnel-access controls, Access Approval asks first, Access
   Transparency logs either way, continuous violation monitoring. The `move` technique drops out.

## Cost

### Sustained use vs committed use discounts (`gcp-compute-discounts`)

**The aha**: Sustained use rewards usage after the fact with no action needed; committed use pays
more for promising usage in advance, whether or not you actually use it.
**Misconception to defeat**: That any discount requires signing up in advance, or that running
VMs steadily is free of choice.
**Cast**: Two VM lanes running through a month-long timeline. Left lane, unlabelled, a discount
meter climbing automatically as the month goes on. Right lane, a signed "1-year commitment: 50
vCPUs" contract above it, a coin meter ticking at a flat rate regardless of usage below.
**Opening frame**: Both lanes idle at month start, both meters at zero. _"Two ways to pay less."_
**Story**:

1. The left VM (an N1) runs continuously through the month with no action from anyone; its
   discount meter climbs on its own, reaching 30% off by month's end (20% on N2, N2D and C2).
   _"Sustained use: automatic, for running a lot of the month."_
2. The right VM, backed by the 1-year commitment, runs for only half the month; the coin meter
   still ticks at the full committed rate, unaffected by the gap. _"Committed use: you pay for
   the commitment, whether used or not."_
3. The left VM stops for two weeks mid-month; its month-end discount ends lower, because the
   discount depends on how much of the month it ran. _"Automatic also means it can fall away."_
4. Swap the left VM for a newer series (E2, N4, C3): its discount meter stays flat at zero even
   while running all month. _"Newer series: no sustained use discount at all. Commitments and Spot
   are the levers."_
   **The moment**: Beat 2 — the committed lane's meter ticking steadily through an idle stretch, the
   cost of a promise kept regardless of use.
   **Interaction**: Toggle each VM's uptime for the month and watch which meter moves and which
   doesn't.
   **Ending**: A side-by-side month-end summary: automatic discount earned vs committed cost paid
   regardless.
   **Variants**: `gcp-spot-vms`, `gcp-cloud-billing`; fundamentals' `reserved-vs-on-demand-pricing`.
   **Techniques**: meter, side by side, timer, toggle, caption.
   **Review**: Improved — weighed a "discount vs promise" two-contract framing and kept the
   month-long timeline, which makes "after the fact" vs "in advance" literal. Checked: 30% on N1,
   20% on N2/N2D/C2, none on E2, N4, C3 and later; commitments are paid whether used or not.
   Fixed the "resets lower" wording in beat 3 (the discount is a function of fraction of month run)
   and made the machine types explicit so the 30% figure and beat 4 no longer contradict.
   Spend-based commitments (Compute, GKE, Cloud Run) are worth one caption.

### Billing accounts, budgets and billing export (`gcp-cloud-billing`)

**The aha**: Billing runs parallel to the resource hierarchy — a project's folder doesn't decide
who pays, its billing account link does, and a budget only alerts, it never stops spending on its
own.
**Misconception to defeat**: That the folder a project sits in also controls its bill, or that
setting a budget caps spend.
**Cast**: An org frame with folders and projects nested as usual. A separate billing account box,
off to the side, connected to several projects by direct lines that cross folder boundaries
freely. A budget gauge with a threshold line. A Pub/Sub notification icon.
**Opening frame**: The folder tree on one side, the billing account box on the other, lines
crossing between them with no regard for which folder a project sits in. _"Two separate trees:
who governs it, and who pays for it."_
**Story**:

1. A project moves from Folder A to Folder B (its governance changes); its line to the billing
   account doesn't move at all. _"The folder didn't decide who pays. The link did."_
2. Spend on that project climbs past a budget's 80% threshold; the gauge turns amber and a
   Pub/Sub notification fires. _"A budget alerts…"_
3. Spend keeps climbing straight past 100%, the gauge red, resources still running unaffected.
   _"…it never stops spending by itself."_
4. The Pub/Sub notification is wired to a Cloud Run function that disables billing on the
   project, which actually halts the resources (and can destroy some). Cost data lags by hours,
   so a little more spend still lands first. _"Capping spend is something you build on top, and
   it is not instant."_
5. Billing export streams detailed, per-SKU cost rows into a BigQuery table; a query grouped by a
   cost label attributes spend to a team. _"Labels plus export: how spend gets attributed."_
   **The moment**: Beat 3 — the gauge pegged red while everything keeps running untouched,
   dispelling the idea that a budget is a cap.
   **Interaction**: Drag a project between folders and watch its billing line stay fixed; push
   spend past the threshold and watch nothing stop on its own.
   **Ending**: The budget gauge red, a labelled BigQuery export table below it breaking the same
   spend down by team.
   **Variants**: `gcp-compute-discounts`, `gcp-resource-hierarchy`; fundamentals'
   `cost-visibility-tagging`.
   **Techniques**: boundary, move, meter, toggle, stream, caption.
   **Review**: Improved — weighed the "smoke alarm, not sprinkler" metaphor and kept the pegged
   gauge with resources still running, which is more direct; the metaphor fits the caption. Checked:
   a project's billing link is independent of its folder, budgets alert on actual or forecast
   spend, Pub/Sub carries the notification, disabling billing halts resources, export goes to
   BigQuery, labels attribute cost. Fixed the old product name (Cloud Functions is now Cloud Run
   functions) and added that billing data lags, so automated caps overshoot. Beat 1 is a visible
   before/after, so keep it first.

## Delivery and infrastructure as code

### Cloud Build and Artifact Registry (`gcp-cloud-build`)

**The aha**: Any tool packaged as a container is a build step, and because the build runs as a
service account inside Google Cloud, it can push and deploy with no stored credentials anywhere.
**Misconception to defeat**: That a CI pipeline needs a dedicated server, or that pushing to a
registry needs a saved password or key.
**Cast**: A build config as a numbered list of container-image steps sharing one `/workspace`
volume. A trigger (a commit icon) kicking it off. At the end, Artifact Registry holding the built
image, an SLSA provenance tag attached. A service account badge worn by the whole pipeline.
**Opening frame**: The build config, steps numbered 1-2-3, each a plain container icon, trigger
idle, no server drawn anywhere (a build worker will appear for the run and vanish). _"A pipeline
is just images, run in order."_
**Story**:

1. A commit lands; step 1 (a "test" container) runs against the shared workspace volume, passes
   green. _"Step 1: any container that can test can be a step."_
2. Step 2 (a "build" container) compiles and writes an artifact into the same workspace. _"They
   all share one workspace."_
3. Step 3 (a plain push container, wearing the pipeline's service account badge) pushes the
   built image straight into Artifact Registry — no password prompt, no key file anywhere in the
   steps. _"Pushes as a service account. No stored credentials."_
4. A signed SLSA provenance record, stored alongside the image, lists exactly which steps
   produced it. _"Proof of how it was built, tied to the image."_
5. A vulnerability scan runs automatically against the stored image, flagging one finding without
   blocking the push.
   **The moment**: Beat 3 — the push succeeding with visibly nothing resembling a credential
   anywhere in the step, because the identity is the pipeline's own service account.
   **Interaction**: Reorder or swap a step's container image and watch the pipeline still run, since
   every step is just a container.
   **Ending**: The finished image sitting in Artifact Registry, provenance tag attached, pipeline
   idle again.
   **Variants**: `gcp-cloud-deploy`, `gcp-binary-authorization`, `gcp-iac-options`; delivery's
   `ci-pipeline-stages`.
   **Techniques**: contents, token, restyle, appear / disappear, caption.
   **Review**: Improved — weighed a "Cloud Build vs GitHub Actions runner" contrast and kept the
   steps-are-containers frame (it is the catalog's aha). The "CI needs a server" misconception was
   never defeated on screen, so the opening now shows no server and a worker that exists only for
   the run. Checked: shared `/workspace`, runs as a chosen service account (name it explicitly;
   the default account differs by project age), provenance is a record kept with the image rather
   than a label on it, Artifact Registry replaced Container Registry, scanning flags without
   blocking (which `gcp-binary-authorization` builds on).

### Cloud Deploy delivery pipelines (`gcp-cloud-deploy`)

**The aha**: The exact same release is promoted between environments, never rebuilt, so what
reaches production is provably what was tested in staging.
**Misconception to defeat**: That each environment gets its own build, ideally "the same" but
not actually identical.
**Cast**: A delivery pipeline drawn as a row of target boxes: dev → staging → prod. A release
card, created once, moving along the row (not being recreated). The card carries the image
digest (`sha256:a1b2c3…`), unchanged as it moves; per-target settings (replica counts, URLs)
differ and are drawn as a separate small tag on each target.
**Opening frame**: The release card sitting in dev, digest `a1b2c3` visible, staging and prod
empty. _"One release, built once."_
**Story**:

1. The release rolls out to dev; its rendered manifests (from Skaffold) deploy, hash `a1b2c3`
   stays stamped on the card. _"Rendered once, at creation."_
2. A promotion arrow moves the SAME card — not a copy, not a rebuild — from dev to staging; the
   hash is identical on arrival. _"Promoted, not rebuilt."_
3. At staging, an approval gate holds the card until a person clicks approve; then a canary phase
   deploys it to 10% of staging traffic first, verifies, then completes to 100%. _"Approvals and
   canaries, same unchanged release."_
4. The card promotes again to prod, hash still `a1b2c3`. _"What reaches production is exactly
   what staging tested."_
5. A rollback arrow points prod back at the previous release card, which redeploys its stored
   manifests with no rebuild. _"Rollback: redeploy the old release."_
   **The moment**: Beat 2 — the hash tag staying byte-for-byte identical as the card crosses from
   dev to staging, visibly the same object rather than a respawned one.
   **Interaction**: Promote the release along the row and watch the hash never change; trigger a
   rollback and watch it snap to the prior card.
   **Ending**: The release card resting in prod, same hash it had on day one, dev and staging
   showing it already passed through.
   **Variants**: `gcp-cloud-build`, `gcp-cloud-run-revisions-traffic`; delivery's
   `progressive-delivery`, `gitops`.
   **Techniques**: move, token, restyle, path trace, choice, caption.
   **Review**: Improved — weighed a "rebuild per environment" side by side and kept a single
   moving card (the contrast is implied by the identical digest). Fixed a precision slip: what
   stays identical is the release and its images (digest), while rendered manifests are produced
   for each target at release creation, so per-target settings legitimately differ. Rollback is a
   redeploy of a stored release, quick but not instant. Checked: targets in promotion order, Skaffold
   rendering, approvals, canary phases, verification. Cloud Deploy releases are built from images
   produced by `gcp-cloud-build`.

### Infrastructure as code on Google Cloud (`gcp-iac-options`)

**The aha**: Google has standardised on Terraform, so the real choice is who runs it (you, or Infrastructure Manager as a service), with Config Connector as the one different notation for teams that already live in Kubernetes.
**Misconception to defeat**: That Deployment Manager, Config Connector and Terraform are three competing IaC languages to pick between.
**Cast**: One Terraform configuration file at the centre. Two arrows from it to two ways of running it: "you run it" (a laptop or CI job running `terraform apply`, state in a Cloud Storage bucket) and "Infrastructure Manager" (Google-run Terraform with managed state, inside a Cloud Build-shaped box). Off to the side, Config Connector in its own colour: the same cloud resources drawn as Kubernetes YAML objects inside a cluster, a different notation rather than a third way to run the same file. A fourth, greyed-out box: "Deployment Manager — end of support Mar 31 2026, turned down 2027".
**Opening frame**: The Terraform file, two live arrows out, Config Connector set apart, the grey box crossed through. _"One standard. Several ways to use it."_
**Story**:

1. Follow the "you run it" arrow: `terraform apply` runs from a laptop or pipeline; the state file lives in a bucket you create and lock yourself. _"Yourself: simple, but you manage the state."_
2. Follow the Infrastructure Manager arrow: the same configuration is submitted to a managed service, which runs it via Cloud Build and keeps the state itself. _"Terraform as a service — Google manages the state and the run."_
3. Config Connector: a different file appears, Kubernetes YAML for the same bucket, and a controller in the cluster continuously reconciles it, the way a Deployment is. _"Not Terraform: Kubernetes objects, for teams who already run everything through Kubernetes."_
4. The Deployment Manager box, its support date already passed, shows its templates migrating (DM Convert) into the Terraform file at the centre. _"The old native option is retired — converted to Terraform, not replaced by a rival."_
   **The moment**: Beat 4 — the Deployment Manager templates visibly flowing INTO the Terraform file, making clear where everything converges.
   **Interaction**: Pick a run option and trace the same configuration through it; pick "my team lives in Kubernetes" and watch Config Connector light.
   **Ending**: The Terraform file at the centre with two live arrows out, Config Connector set apart for its audience, the fourth path closed off.
   **Variants**: `gcp-cloud-build`; delivery's `infrastructure-as-code`, `gitops`.
   **Techniques**: path trace, choice, restyle, caption.
   **Review**: Rethought — weighed the original "one file, three arrows" and rejected it: Config Connector does not run Terraform, it is Kubernetes YAML, so "one language, three ways to run it" was wrong. The aha is now two things (who runs Terraform; when to pick Kubernetes-native). Checked: Infrastructure Manager is Google-run Terraform executed by Cloud Build, Deployment Manager's end of support was March 31 2026 and it is turned down in 2027 (the original showed a countdown to a date already past in October 2026), DM Convert migrates to Terraform. Also fixed "state on the laptop's disk", which nobody recommends; remote state in a bucket is the real manual baseline. Dropped the timer technique.

### Apigee vs API Gateway (`gcp-apigee-vs-api-gateway`)

**The aha**: Choose by who the API's consumers are, not by traffic volume — API Gateway protects
your own backends, Apigee turns an API into a product other organizations sign up for.
**Misconception to defeat**: That the choice is about how much traffic the API handles, so
"bigger" APIs need Apigee.
**Cast**: Two front doors side by side, the same backend (a Cloud Run service) behind each. Left
door: "API Gateway" — simple, an OpenAPI spec sheet, an auth check, a quota dial. Right door:
"Apigee" — ornate, a developer portal with sign-up forms, API products with keys, a monetization
meter, an analytics dashboard.
**Opening frame**: One backend service, two doors drawn in front of it, both closed. _"Same
backend. Who's walking through?"_
**Story**:

1. An internal mobile app calls through API Gateway: OpenAPI spec checked, an auth token
   verified, a quota dial capped at 1000/day — straight through to the backend. _"Protects and
   routes to your own backend."_
2. The same backend, reached through Apigee instead: an external developer first visits a
   developer portal, signs up, picks an API product ("Basic" or "Premium"), gets an API key.
   _"Turns the API into a product, with plans."_
3. That developer's call goes through Apigee carrying their key; a monetization meter ticks per
   call against their plan, and an analytics dashboard logs their usage alongside every other
   subscriber's. _"Onboarding, plans, analytics — for consumers you don't manage directly."_
4. A volume meter is dragged from 100 to 100,000 requests a second against both doors: each
   scales and routes it (within its quotas), and neither door's special machinery lights. The
   internal batch caller gets no portal, plan or dashboard; the external partner gets all three
   at any volume. _"Volume alone doesn't decide it. Who the consumers are does."_
   **The moment**: Beat 4 — the volume meter swinging wide while the door choice never changes,
   showing traffic size was never the deciding factor.
   **Interaction**: Route the same call as an internal caller or an external signed-up developer
   and watch which door's machinery activates.
   **Ending**: Both doors open onto the same backend, one quiet, one busy with a portal full of
   subscribers.
   **Variants**: `gcp-load-balancer-family`, `gcp-cloud-run-networking`.
   **Techniques**: side by side, token, meter, contents, caption.
   **Review**: Improved — weighed "lightweight vs full" as the framing and kept consumers vs
   traffic, since the catalog is explicit. Beat 4 overclaimed ("API Gateway handles any volume fine"):
   it has quotas, and Apigee also scales, so the contrast is now a volume dial that changes nothing
   about the choice. Checked: API Gateway fronts Cloud Run, Cloud Run functions and App Engine via an
   OpenAPI spec with auth and quotas; Apigee adds API products and keys, portal, monetization,
   analytics and hybrid deployment. Cloud Endpoints is the older option, not shown.

## AI and machine learning

### Gemini Enterprise Agent Platform (formerly Vertex AI) and the build-or-buy ladder (`gcp-ai-build-options`)

**The aha**: Climb the ladder only as far as the problem demands — call a pre-trained API first,
ground or tune next, train custom only when the problem is truly unique to you — because each
rung adds data, skill and cost.
**Misconception to defeat**: That a serious AI feature needs a custom-trained model from the
start.
**Cast**: A vertical ladder, lowest to highest: "Pre-trained API" (Vision, Speech-to-Text),
"Foundation model by API", "Grounding / tuning with your data", "AutoML", "Custom training". A
task card at the bottom. A cost-and-effort meter rising alongside the ladder.
**Opening frame**: The task card ("classify support tickets") at the ladder's foot, effort meter
at zero. _"Start at the bottom."_
**Story**:

1. The task tries the pre-trained API rung first: the Natural Language API's fixed content
   categories come back instantly ("Computers & Electronics") but not the company's ticket types
   ("billing", "outage"). Effort meter barely moves. _"Call it. Fast, but its categories, not
   yours."_
2. Climb one rung to "foundation model by API": Gemini called directly with a prompt listing the
   company's ticket types — closer, still fast. _"A capable general model, by API."_
3. Still missing company-specific nuance: climb to "grounding / tuning" — the model is given the
   company's own ticket history as grounding data; accuracy visibly jumps on the meter, effort
   rises modestly. _"Ground or tune with your own data."_
4. The task is also tried on the AutoML and custom training rungs, each needing progressively
   more labelled data and ML skill, each adding much more to the cost/effort meter for a
   diminishing accuracy gain at the top.
5. The final choice settles at the tuning rung, not the top, because it was "good enough" there.
   _"The least effort that meets the need."_
   **The moment**: Beat 3 — the large accuracy jump from grounding for modest added effort, against
   the top rungs' small further gain for much more cost.
   **Interaction**: Drag the task up and down the ladder and watch accuracy and effort meters move
   at different rates per rung.
   **Ending**: The task card resting at the rung it actually needed, the higher rungs visibly
   unused.
   **Variants**: `gcp-gemini-api-front-doors`, `gcp-model-serving-options`,
   `gcp-agent-search-vector-search`; ai's `model-serving-ladder`.
   **Techniques**: meter, dial, path trace, spotlight, caption.
   **Review**: Improved — weighed a decision tree (data volume, skills, uniqueness) and kept the
   ladder with live meters, since "each rung adds data, skills and cost" is the aha and a ladder
   shows it. Fixed beat 1, where a generic pre-trained API "returned a decent answer" to a task it
   cannot do (its categories are fixed); the miss now teaches why the next rung exists. Checked
   names: Gemini Enterprise Agent Platform (formerly Vertex AI, April 2026), Model Garden, AutoML,
   custom training; the accuracy and effort curves are illustrative and should be labelled so.
   BigQuery ML (training with SQL where the data already is) could sit as a side rung.

### Gemini API on Agent Platform vs the Gemini Developer API (`gcp-gemini-api-front-doors`)

**The aha**: The same Gemini models are reached through two different contracts — prototype fast
with an API key, but production workloads that need IAM, residency or network controls belong on
the Google Cloud endpoint.
**Misconception to defeat**: That the two are different models, rather than two front doors onto
the same ones.
**Cast**: One Gemini model core in the middle. Two doors into it: left, "Gemini Developer API" —
a simple door, API key icon, Google AI Studio badge. Right, "Gemini API on Agent Platform" — a
heavier door inside a Google Cloud project frame, with IAM locks, a VPC Service Controls fence
nearby, a CMEK key icon, a provisioned throughput gauge.
**Opening frame**: The model core, both doors closed, each labelled with the identical model
name (the current Gemini model id). _"Same model. Two doors."_
**Story**:

1. A solo developer walks through the left door with just an API key, gets a response in seconds
   — no project, no IAM setup. _"Prototype fast: an API key, no infrastructure."_
2. That developer, now building for their company, tries to attach a VPC Service Controls fence
   and a CMEK key to the left door: both options are simply absent on that door. _"The developer
   door has no enterprise controls to attach."_
3. Switch to the right door, inside a Google Cloud project: the same prompt now passes through an
   IAM check, is covered by the perimeter fence, encrypted with the project's own CMEK key, and
   can reserve provisioned throughput for guaranteed latency. _"Same model, now with IAM,
   residency, network controls."_
4. The Google Gen AI SDK call is shown side by side for both doors: one line differs, how the
   client is created (an API key vs a project and location with Google Cloud credentials);
   the generate call below is identical. _"One SDK, either door. Moving is a small change."_
   **The moment**: Beat 2 — reaching for an enterprise control that simply isn't on the simple door,
   making the contract difference concrete rather than abstract.
   **Interaction**: Toggle which door a prompt goes through and watch which controls are available
   to attach.
   **Ending**: Both doors open onto the same model core, one bare, one wrapped in enterprise
   controls.
   **Variants**: `gcp-ai-build-options`, `gcp-model-serving-options`, `gcp-vpc-service-controls`.
   **Techniques**: boundary, toggle, side by side, path trace, caption.
   **Review**: Improved — weighed a feature checklist table and kept the "reach for a control that
   isn't on the door" beat; a missing option is more memorable than a row of ticks. Fixed the
   version-specific label "Gemini 2.x" (it dates quickly; use the current model id) and made the
   SDK claim precise (the client set-up differs, the call doesn't). Checked: IAM and service
   accounts, regional residency, VPC Service Controls, CMEK and provisioned throughput are
   Google Cloud endpoint features; the Developer API is the API-key and AI Studio route.

### Model Garden and paying for inference: pay-as-you-go, provisioned throughput, dedicated endpoints (`gcp-model-serving-options`)

**The aha**: There are three different ways to pay for inference — per token on shared capacity,
reserved throughput for predictable latency, or your own endpoint you fully control — chosen by
how predictable the traffic is and whether Google even offers the model as a service.
**Misconception to defeat**: That "serverless" inference has no capacity planning behind it at
all.
**Cast**: A Model Garden catalogue shelf (Google, partner and open models). Three payment lanes
below: "Pay-as-you-go" (a meter ticking per token, with standard/priority/flex tiers),
"Provisioned throughput" (a reserved capacity block, booked ahead), "Dedicated endpoint" (a
GPU/TPU box billed per node-hour, always running).
**Opening frame**: The catalogue shelf, three lanes empty below it. _"Same models. Three ways to
pay for running them."_
**Story**:

1. A bursty, unpredictable app calls a Google model as a service, pay-as-you-go: the meter ticks
   per token; at a sudden traffic spike, some requests return 429 because shared capacity is
   contended. _"Cheap to start — can throttle at peak."_
2. A latency-critical production app reserves provisioned throughput ahead of time: the reserved
   block stays ready at a flat rate, the 429s disappear even at the same spike. _"Reserved
   capacity, predictable latency, for a committed volume."_
3. An open model not offered as a service is deployed instead to a dedicated endpoint on its own
   GPU box: billed per node-hour whether a request arrives or not. _"Full control — you pay for
   idle accelerators too."_
4. Off to the side, a batch job with no latency requirement runs the same model as an offline
   batch prediction job instead, billed at a discounted per-token rate. _"If nobody is waiting,
   batch it."_ (A fourth option for the work, not a fourth way to serve live traffic.)
   **The moment**: Beat 1 against beat 2 — the identical spike causing 429s in one lane and nothing
   at all in the reserved lane, same model underneath.
   **Interaction**: Drag a traffic-spike slider and watch which lane throttles and which doesn't;
   toggle whether the model is Google-offered or must be self-hosted.
   **Ending**: Three lanes each metering differently — per token, per reserved block, per node-hour.
   **Variants**: `gcp-ai-build-options`, `gcp-ai-accelerators`, `gcp-gemini-api-front-doors`.
   **Techniques**: meter, dial, side by side, failure, choice, caption.
   **Review**: Improved — weighed a cost-per-million-token chart and kept the spike demo, since a 429
   vs none is felt, a price is not. Checked: standard, priority and flex tiers on pay-as-you-go,
   provisioned throughput reserves capacity ahead (traffic above it can overflow to pay-as-you-go),
   dedicated endpoints bill per node-hour while running, partner models such as Claude appear in
   Model Garden. Fixed beat 4: batch was called "far cheaper" with no basis; it is discounted and
   asynchronous, and is a separate axis (latency tolerance) from the three lanes.

### Agent Search vs Vector Search vs RAG Engine (`gcp-agent-search-vector-search`)

**The aha**: Buy the whole search experience (Agent Search) or build it from parts (Vector
Search embeddings you own); grounding either in a model is how answers come from your data
instead of the model's memory.
**Misconception to defeat**: That "search" and "RAG" are one thing, or that Vector Search alone
already answers questions.
**Cast**: Raw documents on the left. Two paths to the right: "Agent Search" — a single box
swallowing documents whole and emitting ranked results and grounded answers. "Vector Search" —
documents explicitly chunked, embedded (a step you control), and dropped as dots into a vector
index (ScaNN), with a nearest-neighbour query shown as a magnifying circle finding nearby dots.
"RAG Engine" sits above both, orchestrating retrieval into a model prompt, with a switch choosing
which backend it calls.
**Opening frame**: Raw documents, both paths empty, a question waiting ("what's our refund
policy?"). _"Buy it whole, or build it from parts."_
**Story**:

1. First, the raw question asked of the base model with no retrieval: a fluent, generic,
   unsourced answer. _"Without grounding, it answers from memory, not your documents."_
2. Send documents into Agent Search: parsing, chunking, embedding, ranking and access control all
   happen invisibly inside the box; the question comes back with ranked results and a grounded
   answer with citations. _"The whole pipeline, managed for you."_
3. Send the same documents down the Vector Search path: chunking is a visible step you configure,
   embeddings are dots you compute and own, dropped into the index; the question becomes a
   nearest-neighbour query finding the closest dots, which returns passages only, no answer yet.
   _"You own every step — chunking, embeddings, the index. Search returns passages."_
4. RAG Engine's switch is set to Vector Search: it takes those nearest dots, stuffs their text
   into a model prompt, and the model answers grounded on them. _"RAG Engine orchestrates
   retrieval into an answer, whichever backend it's pointed at."_
5. Flip RAG Engine's switch to Agent Search instead: the same orchestration now calls the managed
   box for its retrieved context. _"Same orchestrator, either backend."_
   **The moment**: Beat 1 against beat 4 — the same question, ungrounded vs grounded, showing
   exactly where the retrieved dots change the answer.
   **Interaction**: Toggle RAG Engine's backend switch between Agent Search and Vector Search;
   toggle grounding on or off for the base model.
   **Ending**: The question answered three ways side by side — generic, managed-grounded, and
   build-your-own-grounded.
   **Variants**: `gcp-ai-build-options`, `gcp-model-serving-options`; ai's `rag`, `vector-search`,
   `embeddings`.
   **Techniques**: contents, toggle, path trace, side by side, spotlight, caption.
   **Review**: Improved — weighed a build-vs-buy table and kept the paths, but moved the ungrounded
   answer to the front: the old order showed the fix before the problem, so the moment (beat 5
   against beat 3) had no setup. Also made explicit that Vector Search returns passages, not answers
   (the "Vector Search alone answers questions" misconception was named but never visibly
   defeated). Checked: Agent Search is the former Vertex AI Search, Vector Search is an ScaNN nearest-
   neighbour index over embeddings you compute, RAG Engine can sit over either backend per the
   catalog.

### Agent Runtime (formerly Vertex AI Agent Engine) (`gcp-agent-runtime`)

**The aha**: A production agent is a long-lived service with its own state, tools and identity,
and Agent Runtime supplies those pieces so you deploy agent code, not infrastructure.
**Misconception to defeat**: That deploying an agent is the same as deploying a stateless function
or container.
**Cast**: An agent built with the Agent Development Kit (or LangGraph), shown as a single code
box. Around it, pieces a bare Cloud Run container doesn't supply out of the box: a session store,
a memory store, an identity badge, an observability trace line. Agent Runtime drawn as a frame
that wraps around the code box, supplying all four automatically.
**Opening frame**: The agent code box alone, the four needed pieces drawn dim and absent beside
it. _"Just the agent's logic. What else does it need to run for real?"_
**Story**:

1. Drop the code box onto a bare Cloud Run container instead, with in-memory state: a user's
   second message lands on a different instance and has no memory of the first. _"A plain
   container keeps nothing between instances unless you build it."_
2. Same code box, now dropped inside the Agent Runtime frame: the session store lights up and the
   second message correctly recalls the first; next day, a new conversation still knows the user's
   preference, because the memory store lights up too. _"Session: this chat. Memory: across
   chats. Both supplied."_
3. The agent calls a tool that needs to act as something: an identity badge appears on the frame,
   giving the agent its own IAM identity to call that tool with, distinct from any user's. _"Agent
   identity, not borrowed from whoever's chatting."_
4. An observability trace line runs alongside every tool call and model call the agent makes,
   visible end to end. _"Built-in observability."_
5. A caption notes: "Cloud Run and GKE still work — you'd just build these four yourself."
   **The moment**: Beat 1 against beat 2 — the identical code box, amnesiac in one wrapper and
   coherent in the other.
   **Interaction**: Drop the same agent code box into either wrapper (bare container vs Agent
   Runtime) and chat with it across two turns.
   **Ending**: The agent code box sitting inside the Agent Runtime frame, all four supplied pieces
   glowing steadily.
   **Variants**: `gcp-ai-build-options`, `gcp-cloud-run-resource-types`; ai's `agent-memory-state`.
   **Techniques**: boundary, toggle, appear / disappear, path trace, caption.
   **Review**: Improved — weighed "serverless function vs long-lived service" and kept the
   same-code-two-wrappers contrast, since it holds the code constant. Fixed an unfair demo: a
   plain Cloud Run container can hold sessions if you wire up a store, so beat 1 now says
   in-memory state across instances (not that Cloud Run cannot), and the original's four named
   pieces had no beat for memory, now split from session in beat 2. Checked: Agent Runtime is the
   former Vertex AI Agent Engine, built with the Agent Development Kit or LangGraph, supplies
   sessions, memory, agent identity and observability; Cloud Run and GKE remain valid.

### GPUs vs TPUs and getting accelerator capacity (`gcp-ai-accelerators`)

**The aha**: TPUs often win on price-performance for large-scale training and serving with the
right frameworks, GPUs win on ecosystem breadth — but for both, the hard part is often getting
the hardware at all.
**Misconception to defeat**: That choosing an accelerator is only about raw speed, with capacity
always available on demand.
**Cast**: Two accelerator racks side by side: GPU rack (NVIDIA A/G-series icons, broad ecosystem
logos — PyTorch, generic frameworks). TPU rack (Google's own chips, joined by a visible
high-speed interconnect into one "pod", narrower framework logos — JAX, PyTorch/XLA, vLLM).
Below both, a capacity queue: on-demand, Spot, Reservation, and Dynamic Workload Scheduler
(flex-start queue, calendar mode).
**Opening frame**: Both racks idle, a training job waiting to be placed, capacity queue empty.
_"Which chip — and can you even get it?"_
**Story**:

1. The job, written in JAX, is placed on the TPU rack: chips link into one pod over the fast
   interconnect, the price-performance meter reads favourably for this large training run. _"TPUs:
   built for this kind of matrix maths, joined into pods."_
2. The same job, but needing a library only available on CUDA, is placed on the GPU rack instead,
   where ecosystem compatibility succeeds where TPU placement would have failed. _"GPUs: broader
   ecosystem, more portable."_
3. The job requests capacity on-demand: the queue shows "no capacity right now" for the busy GPU
   type. _"The hard part is often just getting the hardware."_
4. Switch to Dynamic Workload Scheduler, flex-start mode: the job waits in a queue, trading
   start-time flexibility, capacity frees up within a bounded wait, and it runs at a lower price
   than on-demand. _"Trade flexibility for capacity, and a better price."_
5. Calendar mode books a fixed future block of chips for a known date instead, shown as a
   reservation sitting on a calendar strip.
   **The moment**: Beat 3 against beat 4 — the same job stuck with "no capacity" on-demand, then
   successfully placed by simply agreeing to wait.
   **Interaction**: Choose a framework and a job size, watch which rack it's suited to, then choose a
   capacity mode and watch whether and how fast it gets placed.
   **Ending**: The job running inside a pod, the capacity queue showing which mode got it there.
   **Variants**: `gcp-spot-vms`, `gcp-model-serving-options`, `gcp-machine-families`.
   **Techniques**: side by side, path trace, timer, meter, choice, caption.
   **Review**: Keep — weighed a pure GPU-vs-TPU speed chart and a spec table; the capacity-queue
   framing is better because it shows the catalog's real point, that getting the hardware is often the
   hard part, and the beat 3 to beat 4 contrast (stuck, then placed by agreeing to wait) is a single
   clear moment. Checked: TPUs joined into pods by a high-speed interconnect, frameworks (JAX,
   PyTorch/XLA, vLLM) versus the CUDA ecosystem, Dynamic Workload Scheduler flex-start queues a request
   until capacity frees up at a lower price, calendar mode books fixed future dates, "often wins on
   price-performance" is correctly hedged. Numbers: none to add up. Misconception (speed only,
   always available) is defeated by beats 3 and 4.
