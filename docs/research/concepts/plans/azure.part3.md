# Azure plans, part 3

Stage 2 plans for `catalog/azure.md` groups 8–15 (Messaging and integration; Monitoring;
Security; Global infrastructure, reliability and business continuity; Cost; Infrastructure as
code and delivery; Hybrid and migration; AI on Azure), in catalog order.

Shared visual language used throughout (consistent with parts 1–2): real Azure service icons and
names drawn from the icon set (Service Bus, Event Grid, Event Hubs, Logic Apps, API Management,
Azure Monitor, Log Analytics, Application Insights, Key Vault, App Configuration, Defender for
Cloud, Sentinel, Backup, Site Recovery, Bicep, Azure DevOps/GitHub Actions, Arc, Migrate,
Foundry); Azure's nesting (tenant > subscription > resource group > resource; a VNet's zones; a
Foundry resource's deployments) drawn as nested frames; requests and messages travelling along
arrows as small tokens — a dot for a generic request, a small envelope for a discrete event or
command, a denser moving stream for telemetry/throughput; an "X vs Y" comparison puts the same
traffic or task through each option side by side with the difference highlighted or, where only
one scenario is needed, toggled between the two; a "which service do I use" decision is a short
question path (**choice**) whose answers light the matching service, used for messaging's
classic Service Bus vs Event Grid vs Event Hubs; cost is a coin meter that ticks with usage, or a
chart climbing over a month; a region pair is two linked regions on a map joined by a dashed
line; a security/governance boundary (RBAC, Policy, a vault's data plane) is drawn as a second
frame or lock around the resource it governs, separate from the resource's own outline.

No new technique was needed for this part; every plan below uses names from the vocabulary in
`README.md` (particularly **choice** for decision paths, **boundary** for Azure's nesting and
governance edges, **toggle** and **side by side** for comparisons, and **meter**/**chart** for
cost).

## Messaging and integration

### Choosing messaging: Service Bus vs Event Grid vs Event Hubs vs Storage Queues (`azure-messaging-decision`)

**The aha**: What the message _is_ — a command, a fact, or a stream — decides the service; the four aren't rival flavours of the same queue.
**Misconception to defeat**: That all four are interchangeable "queues" and picking one is about performance or habit, not the message's nature.
**Cast**: Four Azure service icons (Storage Queues, Service Bus, Event Grid, Event Hubs) sit dim at the leaves of a branching question path. One example payload, "Order #4821 shipped," sits above, asked about three different ways. Each icon carries a one-line trait chip that appears when lit.
**Opening frame**: The four icons dim, side by side, under one question: "What is this message?"
**Story**:

1. The payload becomes a question: "Must exactly one worker handle this?" Yes. A second fork: "Do you need ordering, transactions, a dead-letter queue?" Yes — Service Bus lights (chips: "ordering, DLQ, transactions"). Caption: "A command that must not be lost."
2. Same fork, answer No ("just a cheap to-do list, messages under 64 KB"): Storage Queues lights instead (chips: "64 KB, no ordering, no DLQ, pennies"). Caption: "A command, kept simple."
3. Reset. Reframed: "Did something just happen that others might care about?" Yes — Event Grid lights; an envelope fans out to three subscribers. Caption: "A fact."
4. Reset. Reframed: "Is this one reading in a continuous stream, thousands a second, to be analysed or replayed?" Yes — Event Hubs lights; a dense stream flows in, read by two consumer groups. Caption: "A stream."
5. All four lit together, each with its shape — ticket, ticket (cheaper), broadcast, ribbon.
6. One real system chains them: Event Grid announces "order placed" → a Function puts a command on Service Bus → fulfilment reads it → Event Hubs carries the telemetry for analytics. Caption: "Real systems chain them."
   **The moment**: Beat 5 — the same payload taking four different shapes depending only on the question answered.
   **Interaction**: Choice — the viewer answers the branching questions and watches the right icon light. A "trick payload" button offers a message ambiguous between two services (e.g. a "status changed" notice, fact or command?) and still makes you pick one.
   **Ending**: The chained system, all four icons visible and named, none greyed out. "Different jobs, often one pipeline."
   **Variants**: `azure-service-bus`, `azure-event-grid`, `azure-event-hubs`; messaging's general queue-vs-pub/sub-vs-stream decision.
   **Techniques**: choice, path trace, token, stream, contents, side by side, spotlight, caption.
   **Review**: Improved — Storage Queues was a parenthesis in beat 1 although the title names four services; it now has its own lit leaf and its real limits (64 KB, no ordering, no dead-letter queue). Weighed using four different payloads instead of one; rejected, because one payload re-asked is what makes "the message's nature decides" visible. Checked: Event Grid is push (or pull on namespaces) for discrete events; Event Hubs is partitioned stream with consumer groups.

### Service Bus: queues, topics, sessions and dead-lettering (`azure-service-bus`)

**The aha**: Peek-lock means a message isn't gone until the consumer says "done" — a crash, a retry and a poison message are all handled by that one lock.
**Misconception to defeat**: That receiving a message deletes it immediately, the way a simpler queue might.
**Cast**: A Service Bus queue holding three numbered envelopes. A consumer box. A padlock in the consumer's colour with a 30-second ring. A delivery-count badge. A bin beside the queue labelled "dead-letter subqueue."
**Opening frame**: Queue with three envelopes, consumer idle.
**Story**:

1. The consumer peek-locks envelope #1 — a padlock appears; the envelope stays in the queue but is invisible to any other receiver. Caption: "Locked, not deleted."
2. It processes and calls Complete — the envelope vanishes. Caption: "Only now is it gone."
3. Reset: the consumer locks #2, then crashes (red flash). The lock ring runs out (default 30 s), the padlock drops, #2 reappears with delivery count 2. Caption: "Crash: the lock expires, the message comes back."
4. It fails again and again; the count ticks 3… up to the max (default 10), then #2 slides into the dead-letter bin, tagged "MaxDeliveryCountExceeded". Caption: "Poison message: not lost, set aside for a human."
5. Split view: a topic fans each envelope to two filtered subscriptions; elsewhere, envelopes tagged with session ID "customer-7" queue into one ordered lane held by a single receiver. Caption: "Topics fan out; sessions keep one customer's messages in order."
   **The moment**: Beats 3–4 — the message surviving a crash and repeated failure without being lost, ending in the dead-letter bin instead of oblivion.
   **Interaction**: Step through delivery; crash the consumer at any point; dial the max delivery count and watch when the bin catches it. A "receive-and-delete" switch shows the same crash losing the message, the contrast peek-lock exists to remove.
   **Ending**: Queue empty, dead-letter bin holding the one poison message, a human icon reaching for it.
   **Variants**: `azure-messaging-decision`, `azure-event-grid`; messaging's dead-lettering, fifo-ordering.
   **Techniques**: contents, token, restyle, timer, failure, zoom, toggle, caption.
   **Review**: Improved — added the receive-and-delete contrast so the misconception is defeated on screen rather than only asserted, and the real defaults (30 s lock, max delivery 10). Weighed opening with a pub/sub topic; worse, because the lock is the one idea a newcomer lacks. Checked: dead-letter reasons include max delivery count and TTL; sessions give FIFO per session ID.

### Event Grid: topics, subscriptions, filters and delivery (`azure-event-grid`)

**The aha**: Event Grid delivers a small notice that something happened, not the data itself — sources publish once, and every subscriber reacts within seconds without the source knowing or caring who's listening.
**Misconception to defeat**: That it stores events for readers to come back to (like a queue or Event Hubs), or that adding a reaction means changing the source.
**Cast**: A source icon (Blob Storage), an Event Grid system topic drawn as a small broadcast tower, three handler icons (Function, webhook, Logic App) each reached by a dashed line ending in a filter chip. The event card holds a few fields (type, subject, a blob URL) — visibly smaller than the file.
**Opening frame**: Blob storage idle, tower idle, no handlers subscribed.
**Story**:

1. A file lands; a small "BlobCreated" card (type, subject, URL — not the file) pops out and hits the tower. Caption: "Something happened."
2. The tower checks its subscription list — empty — the card dissolves. Caption: "No one's listening yet. Nothing breaks, nothing is kept."
3. A Function subscribes with a filter (type = BlobCreated, subject starts with "/photos"). A new blob lands; the card matches, travels to the Function, lights green. Caption: "Subscribe by filter, not by asking the source."
4. A webhook (filtered to "/logs") is added live, with zero change to the blob storage icon. A "/logs" blob lands; only the webhook lights. Caption: "Add a reaction without touching the source."
5. A handler fails (red flash); retries tick up with backoff; after the limit the card drops into a dead-letter blob. Caption: "Retried, then dead-lettered — pushed, never queued for later."
   **The moment**: Beat 4 — a new reaction appearing while the source icon stays completely unchanged.
   **Interaction**: Add or remove subscriptions and filters live; drop events of different types and subjects and watch which handlers light.
   **Ending**: The tower with several live, filtered subscriptions, the source untouched throughout.
   **Variants**: `azure-messaging-decision`, `azure-event-hubs`, `azure-service-bus`.
   **Techniques**: token, appear / disappear, spotlight, path trace, failure, caption.
   **Review**: Improved — "doesn't carry data" overstated it (events do carry a small payload), so the aha and card now say a notice with a pointer, not the data; the misconception wrongly called Event Hubs a queue, fixed. Weighed contrasting with Service Bus topics on screen; left to the decision plan. Checked: no-subscriber events are dropped, retries then blob dead-lettering, system topic for Azure sources; pull delivery on namespaces noted only in the catalog.

### Event Hubs: partitions, consumer groups and capture (`azure-event-hubs`)

**The aha**: Consumers don't take events away, they move their own bookmark along a stream that stays — so many readers can replay the same data at their own pace.
**Misconception to defeat**: That reading removes the event, the way a queue's receive does.
**Cast**: A long append-only ribbon split into labelled partitions (0–3), each with a growing trail of dots. Two consumer groups below, each with its own coloured bookmark on the ribbon, and a "retention: 7 days" tag at the ribbon's old end. A Blob/Data Lake icon beside the ribbon with a Capture pipe.
**Opening frame**: A ribbon with dots already laid down; two bookmarks at clearly different points.
**Story**:

1. New events are appended at the far end, partitioned by key — "device-12" always lands in the same partition. Caption: "Append-only, ordered per partition."
2. Group A's bookmark advances dot by dot, checkpointing its offset to storage. Caption: "Each reader tracks its own place."
3. Group B, far behind, reads older dots A already passed — same ribbon. Caption: "Many readers, same stream, independent pace."
4. Group B crashes (red flash); on restart it resumes from its last checkpoint. Caption: "A crash doesn't lose your place."
5. Capture quietly copies every event into Blob files as it arrives. The oldest dots then fade past retention; a late consumer rewinding hits the fade — but the Blob copy remains. Caption: "Replay within retention; Capture keeps the rest."
6. Side by side with Service Bus: an envelope vanishing once completed, versus a dot staying on the ribbon after being read. Caption: "Reading isn't removing."
   **The moment**: Beat 3 — two bookmarks sitting at different points on one unbroken ribbon.
   **Interaction**: Scrub a consumer's bookmark along the ribbon; add a third consumer group; dial the partition count and watch the cap on parallel readers (one active reader per partition per group).
   **Ending**: A ribbon full of dots, three bookmarks at three points, Capture files alongside.
   **Variants**: `azure-messaging-decision`, `azure-service-bus`, `azure-event-grid`.
   **Techniques**: stream, token, move, contents, side by side, failure, timer, caption.
   **Review**: Improved — Capture is in the title but was never shown; folded into the retention beat (7 days is the Standard-tier maximum, longer on Premium/Dedicated). Weighed opening with the Service Bus contrast; worse, since the ribbon with two bookmarks is self-explanatory and the contrast works better as the closer. Checked: checkpoints are written by the consumer to storage; ordering is only per partition; consumer groups are independent readers.

### Logic Apps: Consumption vs Standard (`azure-logic-apps`)

**The aha**: A Logic App is a flowchart of connector calls you configure, not code you write — the trigger starts it and each action just plugs into another system.
**Misconception to defeat**: That it's "serverless code" like Functions, or that Consumption and Standard are just pricing tiers of the same thing.
**Cast**: A designer canvas: a trigger box wired to action boxes, each showing a connector logo. Two versions side by side: "Consumption" (floating on a shared cloud icon, thin outline) and "Standard" (boxed inside a VNet boundary, thicker outline).
**Opening frame**: An empty canvas — a trigger box, nothing connected yet.
**Story**:

1. Three action boxes are wired trigger → action1 → action2 → action3, each showing a connector icon and configured fields, no code. Caption: "A workflow, wired, not written."
2. A real event fires the trigger; a token runs along the wires, lighting each box, a "200 OK" badge trailing it. Caption: "Each action just calls another system."
3. Split: left (Consumption), the canvas floats on the shared cloud, a coin ticking per action run. Right (Standard), the same canvas sits inside a VNet boundary, billed by a steady hosting-plan meter. Caption: "Shared, billed per action — or yours, inside your network."
4. On the Standard side, a second unrelated workflow runs beside it inside the same app. Caption: "Many workflows, one app."
5. Contrast inset: a code orchestrator (Durable Functions) holding custom logic and unit tests, calling a Logic App for the "send to Salesforce" step. Caption: "Mostly calling systems: Logic Apps. Mostly your own logic: code. They call each other."
   **The moment**: Beat 3 — the same canvas rendered twice, one billed by the tick, one living inside a boundary.
   **Interaction**: Step through a run action by action; toggle Consumption/Standard and watch the billing visual change.
   **Ending**: The Standard canvas with two workflows inside its boundary, meter steady rather than ticking.
   **Variants**: `azure-durable-functions`, `azure-functions-triggers-bindings`, `azure-api-management`.
   **Techniques**: path trace, token, side by side, boundary, meter, toggle, caption.
   **Review**: Improved — beat 5 claimed the designer "can't express loops", which is false (for-each and until exist); the contrast is now custom logic and testability. Weighed leading with the Consumption/Standard split; worse, because "workflow of connectors" must land first. Checked: Consumption is multitenant per-action billing; Standard is single-tenant on the Functions runtime with VNet integration and many workflows per app.

### API Management: gateway, products, subscriptions and policies (`azure-api-management`)

**The aha**: APIM sits between callers and real backends as one policy layer, so what you publish (versions, keys, limits) is separate from what actually serves the request.
**Misconception to defeat**: That it's just a reverse proxy, or the same job as Application Gateway or Front Door.
**Cast**: Left, three clients with subscription keys. Centre, the APIM gateway as a gate with four labelled policy stages: Inbound, Backend, Outbound, On-error. Right, two real backends (v1, v2) behind the gate. A "Product" box grouping the published API that clients subscribe to.
**Opening frame**: A client's request heading toward the gate; backends out of view behind it.
**Story**:

1. A request with a valid key enters: the key matches a Product subscription; Inbound policies run — JWT check, a rate-limit meter ticks — and it is routed to backend v1. The client never sees v1's address. Caption: "One published surface, real backends hidden."
2. A client without a valid key is refused at the gate, before any policy or backend. Caption: "No subscription, no entry."
3. The response flows back through Outbound: a policy strips an internal header and reshapes the JSON. Caption: "Responses get rewritten too."
4. v1 throws an error; On-error returns a clean client-facing message, not a stack trace. Caption: "Backends fail; the published API needn't look broken."
5. Contrast inset: Front Door and Application Gateway as pipes that route and shield traffic by URL and path, with no notion of products, keys or per-API policy. Caption: "They move traffic. APIM governs the API."
6. Zoom out: one policy line changes the backend from v1 to v2; the Product and every client key stay untouched. Caption: "Backends change underneath; the contract clients hold doesn't."
   **The moment**: Beat 6 — a backend swapped invisibly behind an unchanged published contract.
   **Interaction**: Toggle a policy (rate limit, JWT check) on or off and send test requests to see which get through.
   **Ending**: The gate between clients and backends, policy stages lit in sequence, v2 now serving.
   **Variants**: `azure-load-balancing-decision`, `azure-front-door`, `azure-application-gateway`.
   **Techniques**: token, path trace, boundary, zoom, failure, meter, side by side, caption.
   **Review**: Improved — beat 1 routed to v2 and beat 5 then "swapped v1 for v2" (a contradiction with the cast); it now starts on v1. The misconception about Application Gateway/Front Door was named but never beaten, so a contrast beat was added; the key check now happens at the gate rather than as an inbound policy. Weighed leading with the swap; worse, because it needs the gate first. Checked: policy sections and scopes, products/subscription keys.

## Monitoring

### Azure Monitor: metrics, logs and where data comes from (`azure-monitor-data-platform`)

**The aha**: Some signals exist automatically (platform metrics, the Activity log); others don't exist at all until you route them — so "the logs weren't there" during an incident is usually a missing setting, not an outage.
**Misconception to defeat**: That "Azure Monitor" is one thing that captures everything, or that it's the same thing as Log Analytics.
**Cast**: A small app: a Key Vault and the VM that reads it. Five labelled taps: Platform metrics (green, always flowing; 93 days), Activity log (green, always flowing), Resource logs (grey, capped — on the Key Vault), Guest OS data (grey, needs the Azure Monitor Agent — on the VM), App telemetry (grey, needs Application Insights — in the app). Destinations: a metrics store and a Log Analytics workspace cylinder.
**Opening frame**: Two green taps streaming into the destinations, three grey taps capped off.
**Story**:

1. Incident: a secret is read by someone unexpected (red flash). The green taps show data throughout — a metric spike, an Activity entry "role assignment created". Caption: "Automatic signals: always there."
2. Someone asks "who read that secret, and when?" The resource-logs tap is capped; the workspace holds nothing. Caption: "No diagnostic setting, no resource logs. Ever."
3. Rewind: a diagnostic setting is switched on before the incident, piping the Key Vault's AuditEvent logs into the workspace. Replay the same incident — now the read appears with caller and time. Caption: "Flip the switch before you need it."
4. The agent attaches to the VM (guest OS tap flows); Application Insights is added to the app (telemetry flows) — all five taps lit. Caption: "Each grey tap needs its own switch."
   **The moment**: Beat 2 against beat 3 — the identical incident replayed, once silent where the logs should be, once captured, purely because of a setting switched earlier.
   **Interaction**: Toggle each grey tap on or off before running the incident replay and see what's recoverable afterward.
   **Ending**: All five taps flowing into the right destinations, labelled "set up before the incident, not after."
   **Variants**: `azure-log-analytics-kql`, `azure-monitor-data-collection`, `azure-application-insights`, `azure-monitor-alerts`.
   **Techniques**: stream, toggle, failure, timer, spotlight, caption.
   **Review**: Improved — a VM has no resource logs (those belong to PaaS resources like Key Vault), so the tap sat on the wrong resource; the scenario is now "who read the secret?", which is also a question people actually ask. Weighed the "five taps" against a plain metrics-vs-logs split; the taps carry the catalog's real point (what's automatic vs opt-in) better. Checked: 93-day platform metrics, Activity log automatic, agent for guest OS.

### Log Analytics workspaces and KQL (`azure-log-analytics-kql`)

**The aha**: A workspace is a queryable database of log tables, and KQL pipes data through stages left to right, each one narrowing what the next stage sees.
**Misconception to defeat**: That it's just a search box, or that a query is one SQL-style statement rather than a pipeline.
**Cast**: A workspace cylinder holding named tables (AppRequests, AppExceptions, AzureActivity), each a stack of rows. A query bar typed left to right: `AppRequests | where DurationMs > 500 | summarize count() by Name`. A results pane.
**Opening frame**: The workspace with full tables, an empty query bar, empty results.
**Story**:

1. Type `AppRequests` — all rows of that table highlight, the rest dims. Caption: "Start from one table."
2. Add `| where DurationMs > 500` — most rows grey out, a handful stay lit. Caption: "Each pipe narrows what flows to the next stage."
3. Add `| summarize count() by Name` — the survivors collapse into a small grouped result. Caption: "Reshape what's left."
4. Side panel: the same table under three plans — Analytics (full price, full KQL), Basic (cheaper ingestion, limited queries, pay per query), Auxiliary (cheapest, for rarely read data); a query using a join against a Basic table shows a "restricted" badge. Caption: "The table's plan decides what you can do with it, and what it costs."
5. Two tables joined on operation ID merge matching rows into one result row. Caption: "Correlate across tables once they share an ID."
   **The moment**: Beat 2 — rows visibly thinning at each pipe stage, the shape of the query made physical.
   **Interaction**: Build the query one clause at a time and watch rows filter or collapse live; swap a table's plan and see the badge change.
   **Ending**: The full pipeline lit end to end, a small result on screen.
   **Variants**: `azure-monitor-data-platform`, `azure-application-insights`, `azure-sentinel`.
   **Techniques**: contents, spotlight, path trace, restyle, caption.
   **Review**: Improved — the query used `duration` and `name`, but workspace tables name them `DurationMs` and `Name`; fixed. Weighed building the query as a SQL-to-KQL side by side; worse, since the thinning rows already defeat the "one statement" idea. Checked: AppRequests table, three table plans, tables as the unit of retention/plan.

### Getting data in: diagnostic settings, Azure Monitor Agent and data collection rules (`azure-monitor-data-collection`)

**The aha**: Collection is opt-in per destination, and filtering at the diagnostic setting or data collection rule is the cheapest place to drop data nobody will ever query.
**Misconception to defeat**: That turning on monitoring is one global switch, or that the old Log Analytics agent still collects VM data.
**Cast**: A Key Vault and a VM, each with raw signal leaving it. A diagnostic setting drawn as a valve on the Key Vault's stream; a data collection rule (DCR) as a filter funnel on the VM's Azure Monitor Agent stream. A retired "Log Analytics agent" icon, greyed with "retired Aug 2024". Destinations: workspace, storage account, Event Hubs.
**Opening frame**: Both streams flowing freely off-screen into nothing — no valve, no destination.
**Story**:

1. A diagnostic setting on the Key Vault picks the "AuditEvent" category, routed to the workspace; the stream narrows to that one type. Caption: "Pick what leaves, and where it goes."
2. The same setting also sends to Event Hubs, in parallel. Caption: "One resource, several destinations at once."
3. The VM's stream hits the DCR funnel: a filter drops noisy, low-value rows before the workspace, shown falling away. The retired agent icon sits crossed out beside the Azure Monitor Agent. Caption: "Filter before it's stored and billed. The old agent is gone."
4. A transform in the DCR rewrites a field in flight (redacts a column); dots change colour mid-funnel. Caption: "Shape the data on the way in."
5. Azure Policy deploys the same diagnostic setting across 50 resources, all valves opening together. Caption: "At scale, Policy turns the valve for you."
   **The moment**: Beat 3 — the discarded dots falling away before the workspace.
   **Interaction**: Toggle filters in the DCR and watch volume and a cost meter drop; add or remove destinations from the diagnostic setting.
   **Ending**: Valve and funnel configured, two clean streams landing where chosen, cost meter below the unfiltered start.
   **Variants**: `azure-monitor-data-platform`, `azure-log-analytics-kql`, `azure-policy`.
   **Techniques**: stream, token, meter, restyle, caption.
   **Review**: Improved — the "old agent no longer works" half of the misconception was named but never shown; it now appears crossed out in beat 3. Note for the builder: diagnostic settings choose categories, only DCR transforms drop rows, which the two devices (valve vs funnel) already encode. Weighed one combined stream; worse, the valve/funnel split is the teaching. Checked: AMA plus DCRs, multiple destinations, Policy DeployIfNotExists at scale.

### Application Insights and distributed tracing (`azure-application-insights`)

**The aha**: One operation ID stitches every call a single user action makes across every service, turning "it's slow somewhere" into the exact dependency that's slow.
**Misconception to defeat**: That it's just another log table separate from tracing, or that it only watches the front end.
**Cast**: A user click on the left. Three services in a row (Web App, API, and a SQL database the API calls). Each call carries a token stamped with the same operation ID. An "application map" beneath: nodes with latency on the edges.
**Opening frame**: A click sitting idle, services dim, no token yet.
**Story**:

1. The user clicks; a token (operation ID "7f3a") leaves the Web App, reaches the API, which calls the database; each hop is timestamped, the database hop recorded by the API as a dependency. Caption: "One click, one ID, carried through every hop."
2. The database call runs long — its segment stretches and turns red while the other hops stay short and green. Caption: "The slow hop stands out on its own timeline."
3. Zoom into it: an exception, with its stack trace, hangs off the same operation ID. Caption: "The exception belongs to the same transaction, not a separate log."
4. Switch to the application map: three nodes, the database edge thick and red. Caption: "Across many users, the same weak link lights up."
5. An availability test — a synthetic token from a world-map location, on a timer — fails; a red pin appears. Caption: "Watched from outside too, around the clock."
   **The moment**: Beat 2 — the one stretched, reddened segment in an otherwise fast transaction.
   **Interaction**: Click any hop for detail; replay several transactions; drag a "database load" dial and watch the map update.
   **Ending**: The application map with one edge still red, the rest green. "The exact dependency, not 'somewhere'."
   **Variants**: `azure-log-analytics-kql`, `azure-monitor-alerts`; observability's distributed tracing.
   **Techniques**: token, path trace, spotlight, restyle, zoom, failure, timer, caption.
   **Review**: Improved — a database doesn't emit telemetry itself; the slow hop is the API's recorded dependency call, now drawn that way. Weighed starting from the application map and drilling down; worse, because the map's meaning comes from first seeing one traced click. Checked: operation ID, dependencies/exceptions in one transaction, availability tests, data stored in the workspace.

### Alerts, action groups and alert processing rules (`azure-monitor-alerts`)

**The aha**: Detection, notification and routing are three separate, reusable layers — a rule finds the problem, an action group says who to tell, and a processing rule can change the routing without touching either.
**Misconception to defeat**: That an alert rule contains its own notification logic, so changing who gets paged means editing every rule.
**Cast**: A metric chart feeding an alert rule box with a threshold line. The rule fires an alert record (shown in an "Alerts" list) and calls a shared action group (email, SMS, webhook). An alert processing rule sits between the fired alert and the action groups, with a maintenance-window clock on it.
**Opening frame**: The metric flat, under the threshold; rule and action group idle.
**Story**:

1. The metric crosses the threshold — the rule lights red, an alert appears in the list, a token heads to the action group. Caption: "The rule only decides: breached or not."
2. The action group fans out to email, SMS and a webhook at once. Caption: "One action group, several channels, reused."
3. A second, unrelated rule (a log query) fires and reuses the same action group with no new wiring. Caption: "Many rules, one notification setup."
4. A maintenance window opens; the same breach happens again. The alert still lands in the list, but the processing rule stops the token before the action group. Caption: "Still recorded, no one paged — routing changed, rule and group untouched."
5. The window ends; the next breach reaches the action group normally.
   **The moment**: Beat 4 — the identical breach from beat 1, now logged but silently absorbed before anyone is paged.
   **Interaction**: Fire a breach manually; toggle the maintenance window; rewire which action group a rule uses.
   **Ending**: Two rules sharing one action group, a processing rule ready to intercept, nothing hard-wired together.
   **Variants**: `azure-monitor-data-platform`, `azure-health-and-advisor`, `azure-defender-for-cloud`.
   **Techniques**: token, restyle, path trace, timer, failure, caption.
   **Review**: Improved — the cast put the processing rule downstream of the action groups; it acts on fired alerts before actions run, and the alert itself is still recorded (only actions are suppressed). Weighed showing 200 rules being re-pointed to prove "no editing"; heavier and no clearer than one suppressed breach. Checked: metric/log/Activity log/Service Health signal types, action group channels, processing rules for maintenance.

### Service Health vs Resource Health vs Azure status vs Advisor (`azure-health-and-advisor`)

**The aha**: "Is it Azure or us?" has two places to look (Service Health for your slice of a wider event, Resource Health for this one resource); Advisor is a separate, ongoing "could this be better" check, not an incident tool.
**Misconception to defeat**: Lumping all four into one status page, or expecting Advisor to explain an outage.
**Cast**: Four panels side by side: Azure status (public world map, no login), Service Health (filtered to the subscription's services and regions), Resource Health (one VM with a health light), Advisor (recommendation cards across five pillars: reliability, security, performance, cost, operations). A VM in the middle.
**Opening frame**: All four panels calm, VM healthy.
**Story**:

1. A single host fails under the VM (red flash). Only Resource Health goes red, with a reason "platform-initiated reboot". Service Health and Azure status stay green. Caption: "Just this resource — not a wider Azure event."
2. A regional storage incident hits many customers. Resource Health on the VM again reads "unavailable"; now Service Health shows the incident for your regions and Azure status shows the banner everyone sees. Caption: "Your slice of a bigger event."
3. An alert pre-set on Resource Health and Service Health had already paged someone — a token to a phone, stamped before the first support call. Caption: "Alerting on these beats users reporting it."
4. A calm day: Advisor flags "This VM is under-utilized; resize or shut down." No red anywhere. Caption: "Advisor isn't about outages at all."
   **The moment**: Beat 1 against beat 2 — the same VM down, Service Health silent the first time and lit the second, which is exactly the "is it Azure or us?" answer.
   **Interaction**: Trigger either failure and watch which panels light; browse Advisor's five pillar tabs with nothing broken.
   **Ending**: Four panels at rest, each clearly owning a different question.
   **Variants**: `azure-monitor-alerts`, `azure-defender-for-cloud`; fundamentals' cloud provider SLA.
   **Techniques**: failure, restyle, spotlight, side by side, token, caption.
   **Review**: Improved — a single failed host would not appear in Service Health or on the public status page, so the old chain of three panels all lighting was wrong; the plan now contrasts a one-resource failure with a regional incident, which is the real diagnostic. Weighed a decision tree ("start where?"); the side-by-side panels already do that without words. Checked: five Advisor pillars, scoping of each panel.

## Security

### Key Vault: secrets, keys and certificates (`azure-key-vault`)

**The aha**: Apps hold a pointer and an identity, never the secret itself — the vault holds the value, and rotating it happens in one place without redeploying anything.
**Misconception to defeat**: That Key Vault stores secrets for convenience the way a config file would, or that owning the vault resource lets you read what's inside it.
**Cast**: A vault icon (a locked safe) holding labelled cards: a DB password (secret), a signing key, a certificate. An app box with a managed identity badge. The app's config shows not a password but a reference, `@Microsoft.KeyVault(SecretUri=…)`.
**Opening frame**: The app's config showing the reference; the vault closed, contents unseen.
**Story**:

1. The app starts; its managed identity badge glows and asks the vault for the named secret — no credential typed anywhere. Caption: "The identity is the credential."
2. An RBAC check at the vault's door: does this identity hold "Key Vault Secrets User"? Green tick, the value is handed over. Caption: "Access is checked at the data plane."
3. A second identity — an Owner of the vault resource with no data-plane role — makes the same ask and bounces. It can grant itself a role, but that is a logged control-plane act. Caption: "Owning the vault isn't reading inside it."
4. An operator rotates the DB password: the old card swaps for a new version; the app's next fetch gets it, nothing in its config changes. Caption: "Rotate once, here — not everywhere it's used."
5. A key and a certificate: the app asks the vault to sign — the key never leaves, only the signature returns; a certificate renews itself before expiry. Caption: "Keys do the work inside; certificates renew."
6. A secret is deleted by mistake; soft delete holds it recoverable, purge protection stops even an Owner emptying it early. Caption: "Deletion isn't instant."
   **The moment**: Beat 3 — the Owner bouncing at the data-plane door, the control-plane/data-plane split made concrete.
   **Interaction**: Swap which identity makes the request and see allow or deny; rotate a secret and watch the app's next call pick it up.
   **Ending**: The app running normally after a rotation it never noticed, the vault closed again.
   **Variants**: `azure-control-plane-vs-data-plane`, `azure-managed-identity`, `azure-app-configuration`, `azure-encryption-key-management`.
   **Techniques**: boundary, token, restyle, failure, spotlight, caption.
   **Review**: Improved — dropped the unprovable "never written to disk", fixed the reference syntax, and corrected beat 3: an Owner can't read but can assign itself a role, so the honest lesson is "separate, and audited". Keys and certificates (in the title) now get a beat. Weighed a story built only on rotation; worse than the Owner bounce, which defeats the sharper misconception. Checked: RBAC default for new vaults (catalog), soft delete/purge protection.

### App Configuration and feature flags (`azure-app-configuration`)

**The aha**: Settings and feature flags are decoupled from deployments — flipping a flag or changing a value for some users happens without shipping code; secrets still live in Key Vault.
**Misconception to defeat**: That feature flags are just booleans redeployed with the app, or that App Configuration replaces Key Vault.
**Cast**: An App Configuration store with key-value rows labelled by environment, a feature-flag row with a percentage dial, and a row that is just a Key Vault reference pointing at the vault icon beside it. One running app instance below, serving two users: Ava and Ben.
**Opening frame**: The instance running with "new-checkout: off"; Ava and Ben both see the old checkout.
**Story**:

1. The dial moves "new-checkout" to 10% — no deployment icon appears anywhere. Caption: "A flag change, not a release."
2. The running app refreshes (a short poll or a push notice), and the same instance now serves Ava the new checkout and Ben the old one. Caption: "Same code, same instance — different users."
3. The dial moves to 100%; Ben flips too, no restart. Caption: "Dynamic refresh: running apps notice."
4. A new setting row holds a Key Vault reference, not the password; the app resolves it through the vault. Caption: "Secrets stay in Key Vault — this only points."
5. A snapshot freezes the whole set of values, "known-good, Tuesday"; the app can be pointed back at it. Caption: "Roll an entire configuration back at once."
   **The moment**: Beats 2–3 — two users on one already-running instance seeing different things, then converging, with no deploy arrow anywhere.
   **Interaction**: Drag the percentage dial and watch Ava and Ben flip; in the store, try a plain-text password row and a reference row and see which one leaves the secret in the vault.
   **Ending**: The flag at 100%, both users aligned, no deployment ever shown.
   **Variants**: `azure-key-vault`, `azure-app-service-deployment-slots`; delivery's feature flags.
   **Techniques**: dial, toggle, restyle, token, caption.
   **Review**: Improved — the old plan showed two instances behaving differently, but targeting is per user, not per instance; it now shows two users on one instance. Also removed the invented "password is auto-redirected to a vault reference". Weighed framing around "release vs deploy"; kept as the caption of beat 1. Checked: percentage filters, dynamic refresh (polling or push), Key Vault references, snapshots.

### Encryption at rest: platform keys, customer-managed keys and Managed HSM (`azure-encryption-key-management`)

**The aha**: A customer-managed key doesn't encrypt your data "more" — it gives you an off switch: revoke or delete the key and the service can no longer read your data, even though the same AES runs underneath.
**Misconception to defeat**: That a customer-managed key (CMK) is stronger encryption, or that it replaces the platform's own encryption rather than wrapping it.
**Cast**: A data disk with a small, automatic lock (Microsoft-managed key). A key store holding the customer key, shown as two options: Key Vault, and Managed HSM (single-tenant hardware, FIPS 140-3 Level 3). A line from the CMK wrapping the disk's own data encryption key, labelled "key encrypting key."
**Opening frame**: The disk encrypted by default, its lock small and automatic, no vault yet.
**Story**:

1. CMK is turned on: a line from the vault's key wraps the disk's data encryption key in a second, visible lock. Caption: "Your key wraps the data key — the data's AES underneath doesn't change."
2. A read: the service uses its managed identity to ask the vault to unwrap the data key, decrypts, serves. Caption: "Access quietly checks in with your key."
3. The operator revokes the CMK; the wrapping line turns red. Once the service's cached copy of the key lapses (minutes, not an instant) reads bounce — the same bytes become unreadable. Caption: "Revoke the key: the data stays, nobody can read it."
4. Inset: the same revoke on a Microsoft-managed-key disk does nothing — there is no customer key. Caption: "No customer key, no off switch."
5. The CMK's home swaps from Key Vault to Managed HSM; nothing about the wrapping changes, only who holds the hardware and its assurance level. Caption: "Where the key lives is a separate choice."
   **The moment**: Beat 3 — the disk's bytes unchanged on screen while access dies once the key is revoked.
   **Interaction**: Toggle CMK on or off, revoke the key, and watch reads succeed or bounce; compare against the Microsoft-managed path, which has no revoke option.
   **Ending**: The CMK revoked, the disk's data intact but unreadable until the key is restored.
   **Variants**: `azure-key-vault`; security's envelope encryption; `azure-defender-for-cloud`.
   **Techniques**: boundary, token, toggle, failure, side by side, caption.
   **Review**: Improved — "the next read bounces" overstated it (services cache the unwrapped key, so revocation takes effect after a delay); Managed HSM, named in the title, now gets a beat; the encryption-at-host vs Azure Disk Encryption inset (ADE retires 15 Sep 2028) was off the point and was dropped to a cast footnote. Weighed leading with "two keys" diagram only; worse than showing the off switch. Checked: envelope wrapping, managed identity access, platform keys default.

### Microsoft Defender for Cloud: posture (CSPM) and workload protection (`azure-defender-for-cloud`)

**The aha**: Defender for Cloud does two separate jobs — posture (what's misconfigured, before anything happens) and workload protection (what's being attacked, right now) — and the second is paid per resource type.
**Misconception to defeat**: Treating it as one antivirus-style product, or confusing it with Azure Policy (which enforces rules) or Sentinel (which correlates across everything).
**Cast**: A dashboard split in two. Left, "Posture": a secure score gauge and flagged resources — free foundational CSPM, with a "Defender CSPM" paid upgrade tag on attack paths. Right, "Workload protection": the same resources wearing shield icons per plan, raising threat alerts.
**Opening frame**: Left half lit, secure score 62%, several resources flagged; right half dim, shields not yet on.
**Story**:

1. Posture scans continuously: a storage account flags "public access enabled" — no attack, just a risk, with a fix button. Caption: "What could go wrong, before it does."
2. Turning on the Storage plan puts a shield on that account; nothing else about the resource changes. Caption: "A paid plan, resource type by resource type."
3. An attack happens: the shielded storage account flashes and a threat alert fires with severity and a response. An unshielded VM under a similar attack stays silent. Caption: "Protection has to be on to see an attack."
4. With the paid Defender CSPM upgrade, an attack-path view chains an internet-facing VM, a weak credential and a sensitive database into one risk. Caption: "The paid posture tier shows the chain, not just single flaws."
5. A connector pulls in an AWS account's resources to the same dashboard. Caption: "One pane, several clouds."
   **The moment**: Beat 3 — the identical attack landing on a shielded resource (loud alert) and an unshielded one (silence), side by side.
   **Interaction**: Toggle a workload protection plan on a resource and re-run the same simulated attack; click a posture flag to see its fix.
   **Ending**: The secure score climbing as flags are fixed, shields lit on protected resources.
   **Variants**: `azure-policy`, `azure-sentinel`, `azure-encryption-key-management`.
   **Techniques**: meter, toggle, failure, spotlight, path trace, side by side, caption.
   **Review**: Improved — the old plan put attack paths on the free posture side and claimed only workload protection costs extra; attack paths need the paid Defender CSPM plan, so the free/paid line is now drawn correctly. Weighed a three-box Policy / Defender / Sentinel comparison; that belongs in the Sentinel plan. Checked: free foundational CSPM score, paid per-resource plans, multicloud connectors.

### Microsoft Sentinel (`azure-sentinel`)

**The aha**: Each security product sees its own slice; Sentinel's value is correlating across all of them and third parties, which is also where its cost comes from.
**Misconception to defeat**: That Sentinel is "Defender for Cloud but for logs," or that it replaces the individual Defender products instead of sitting across them.
**Cast**: Three isolated sources, each raising its own red flag: Entra ID Protection, Defender for Cloud, and a third-party firewall sending CEF logs. Below, a Log Analytics workspace with Sentinel on top, connectors feeding all three. An analytics rule box and an incident card.
**Opening frame**: Three isolated alerts, each visible only on its own dashboard, no line between them.
**Story**:

1. One attacker ripples through all three: a risky Entra sign-in, a Defender for Cloud alert, a firewall deny burst from the same IP. Caption: "Each product sees its own slice."
2. All three feed Sentinel's workspace as rows, landing side by side. Caption: "Same workspace underneath, pulled from everywhere."
3. A KQL analytics rule joins them on a shared identity and IP within a time window — they collapse into one incident: "Likely account compromise — 3 sources, 1 story." Caption: "Correlation turns three alerts into one incident."
4. An automation rule fires a Logic Apps playbook: the account is disabled. Caption: "Then it can act, not just alert."
5. A cost meter ticks as connectors and retention grow — workspace ingestion plus Sentinel's own charge per GB. Caption: "Its power and its cost both come from the data."
   **The moment**: Beat 3 — three red flags merging into one incident card, something no single source could show.
   **Interaction**: Add or remove a connector and watch whether the incident still correlates; adjust retention and see the cost meter move.
   **Ending**: One incident card, resolved, with three source badges still on it; a note that the experience is moving to the Defender portal (Azure portal experience ends 31 Mar 2027).
   **Variants**: `azure-defender-for-cloud`, `azure-log-analytics-kql`, `azure-monitor-alerts`.
   **Techniques**: token, path trace, contents, meter, caption.
   **Review**: Improved — the old cast called Entra ID a "Defender product" and leaned on Defender XDR, which already correlates across Defender workloads, so "each Defender is isolated" was inaccurate; the third-party firewall makes Sentinel's cross-vendor value unmistakable. Added the Defender-portal move (catalog). Weighed a Policy / Defender / Sentinel three-way verdict; too much for 30 seconds. Checked: connectors, KQL rules to incidents, playbooks, ingestion cost.

## Global infrastructure, reliability and business continuity

### Availability zones (zonal vs zone-redundant) and region pairs (`azure-availability-zones-and-region-pairs`)

**The aha**: "Zonal" means you choose and spread resources across zones yourself; "zone-redundant" means Azure spreads them for you — a region pair is a relationship some services lean on, not an automatic failover for everything.
**Misconception to defeat**: Treating zones like availability sets in one datacenter, or assuming every region has a pair that automatically protects it.
**Cast**: A region boundary holding three zone boxes (1, 2, 3), each a separate datacenter with its own power, cooling and network. A second region far away, linked by a dashed "paired" line. A VM, a ZRS storage account, a Standard Load Balancer.
**Opening frame**: One region, three zone boxes, nothing placed yet.
**Story**:

1. A VM is pinned to Zone 1 (zonal). Zone 1's power fails (red flash); the VM goes down with it. Caption: "Zonal: you pick one. As safe as that one zone."
2. Reset: ZRS storage and a Standard Load Balancer are zone-redundant — copies spread across all three zones, none chosen by the user. Zone 1 fails again; they keep serving from Zones 2 and 3. Caption: "Zone-redundant: Azure spreads it, and it survives."
3. Inset: three zonal VMs, one per zone, behind the load balancer — Zone 1 fails and the other two serve. Caption: "Zonal means you do the spreading."
4. Pan out to the paired region on its dashed line, labelled "staggered updates, geo-replication target." A GRS storage account's second copy appears there. Caption: "Some services lean on the pair — it isn't automatic failover for everything."
5. A newer region appears with no dashed line. Caption: "Many regions have no pair. You pick your own secondary."
   **The moment**: Beat 1 against beat 2 — the identical zone failure taking one resource down and sparing another, purely by placement.
   **Interaction**: Toggle a resource between zonal and zone-redundant; fail any single zone and watch what survives.
   **Ending**: Zone-redundant resources untouched after Zone 1's failure, the lone pinned VM still dark.
   **Variants**: `azure-vm-availability-options`; data's storage redundancy levels; `azure-site-recovery`.
   **Techniques**: boundary, failure, toggle, restyle, side by side, caption.
   **Review**: Improved — a single zonal VM made "zonal" look like a mistake rather than a placement model; beat 3 now shows the proper zonal design (one per zone). Weighed adding "zone numbers are logical per subscription" (catalog); a footnote on the zone boxes' labels is enough, a full beat is not. Checked: zone-redundant list, pairs for staggered updates and geo-replication, newer regions unpaired.

### Sovereign clouds: Azure Government and Azure operated by 21Vianet (`azure-sovereign-clouds`)

**The aha**: A sovereign cloud isn't another region inside public Azure — it's a separate universe with its own identity authority and endpoints, so nothing crosses over by accident.
**Misconception to defeat**: Thinking "Azure Government" is a region you pick in the normal portal, like East US versus UK South.
**Cast**: Two separate boundaries side by side: "Public Azure" (familiar portal, its own Entra authority) and "Azure Government" (its own portal, its own authority, separate endpoints). A CLI tool and a Terraform file trying to cross between them.
**Opening frame**: A developer logged into Public Azure; Azure Government's boundary sitting apart, unconnected by any line.
**Story**:

1. The developer's token from Public Azure's authority is waved at Azure Government's door and bounces: "wrong authority." Caption: "A valid token from the other cloud means nothing here."
2. The same CLI pointed at the default endpoint fails against Azure Government; switched to that cloud, it succeeds. Caption: "Tools must be told which cloud they're talking to."
3. A new AI service appears in Public Azure; its Azure Government counterpart stays greyed, "not yet available." Caption: "Some services arrive late, or never."
4. A third boundary: "Azure operated by 21Vianet," the same separateness, a different operator, for China. Caption: "More than one of these exist."
5. Contrast inset: a public-Azure region inside the EU, labelled "just a region — not sovereign." Caption: "Data staying in a country isn't a sovereign cloud."
   **The moment**: Beat 1 — a valid token from one cloud refused outright by the other, because identity itself doesn't cross the boundary.
   **Interaction**: Try to "move" a resource or token between the boundaries and watch where it fails.
   **Ending**: Two boundaries sitting apart, each self-contained, no line connecting them.
   **Variants**: `azure-entra-id`, `azure-resource-hierarchy`; fundamentals' data residency.
   **Techniques**: boundary, failure, token, side by side, spotlight, caption.
   **Review**: Improved — "times out" in beat 2 was wrong (the call is refused as the wrong cloud/authority, not a network timeout); fixed. Weighed a map showing the clouds as islands; the two-boundary token bounce is sharper. Checked: separate Entra authority, ARM endpoints and catalog per cloud; Government for US public sector, 21Vianet in China.

### Azure Backup: vaults, policies and secure recovery (`azure-backup`)

**The aha**: Backup takes you back in time after deletion or ransomware — and it only works if an attacker who's taken over your subscription can't delete the backups too, which is what immutable vaults and multi-user authorization are for.
**Misconception to defeat**: That having backups automatically means they're safe from whoever compromised production.
**Cast**: A VM with data over a time strip (v1, v2, v3). A Recovery Services vault holding a recovery point at each. An attacker icon with Owner-level credentials. A soft-delete shield on the vault, then an "immutable" lock and a Resource Guard approver in a separate subscription.
**Opening frame**: The VM with v3 current, the vault holding v1–v3, no attacker yet.
**Story**:

1. Ransomware encrypts the VM's live data — v3 turns to noise. The vault's older recovery points sit untouched. Caption: "Backup takes you back — if the backups still exist."
2. Restoring v2 copies clean data back, overwriting the damage. Caption: "Back in time, not forward through the attack."
3. Reset: the attacker, holding Owner, first switches off soft delete on the vault, then deletes the recovery points before encrypting anything. Nothing is left to restore. Caption: "An attacker with your rights can delete the safety net too."
4. Immutable vault plus multi-user authorization are on: the same delete now needs approval from a Resource Guard the attacker's account doesn't control, and immutable points can't be removed early. The attempt bounces. Caption: "The backups need their own, harder-to-reach lock."
5. Contrast inset: with soft delete on (the default), an ordinary accidental delete is recoverable for 14 days. Caption: "Soft delete covers mistakes. MUA covers attackers."
   **The moment**: Beat 3 against beat 4 — the identical Owner-level delete on the vault, once succeeding and taking the restore plan with it, once refused.
   **Interaction**: Toggle immutable/MUA on the vault and replay the attacker's delete attempt; choose which recovery point to restore from along the timeline.
   **Ending**: The VM restored to v2, the remaining recovery points locked behind MUA, the delete attempt bounced.
   **Variants**: `azure-site-recovery`; data's storage redundancy levels and backup-vs-replication.
   **Techniques**: timer, failure, boundary, toggle, token, restyle, caption.
   **Review**: Improved — beat 3 let the attacker delete backups outright while beat 5 claimed soft delete protects them, a contradiction; the attacker now first disables soft delete, which is the real attack order, and the approver is a Resource Guard in a separate subscription. Weighed leading with the attacker rather than the restore; worse, since "back in time" must exist first. Checked: Recovery Services vault, immutability, MUA via Resource Guard, soft delete default.

### Azure Site Recovery (`azure-site-recovery`)

**The aha**: Site Recovery keeps a continuously-updated, ready-to-start copy of running machines in another region — and because it replicates faithfully, it copies corruption and deletions too, which is why it isn't backup.
**Misconception to defeat**: "Site Recovery is just backup in another region," or expecting it to undo a mistake the way Backup does.
**Cast**: A source region with a running VM. A target region with a dim, powered-off shadow VM continuously receiving changes. A recovery plan drawn as an ordered checklist (database, then app tier, then web). A failover button.
**Opening frame**: The source VM running; the target holding a dim shadow already mostly in sync.
**Story**:

1. A continuous stream of changes flows source to shadow, landing within minutes (RPO label: "minutes, not hours"). Caption: "Always catching up, never a scheduled job."
2. Someone deletes a file on the source. The stream carries the deletion to the shadow a moment later. Caption: "It replicates mistakes too — this isn't a safety net."
3. The source region fails entirely (red flash, region greys). The recovery plan runs in order — database group, then app tier, then web — and the shadow VMs power on. Caption: "A ready copy, started in order."
4. A test failover runs in an isolated network bubble alongside the real shadow, no impact on production. Caption: "Test the plan without using it for real."
5. The source recovers; "commit," then "re-protect" reverses the stream, then "fail back" brings traffic home. Caption: "Failover isn't one-way."
   **The moment**: Beat 2 — the deleted file calmly replicated to the "safe" copy, the exact thing backup would have stopped.
   **Interaction**: Trigger a source deletion and watch it propagate; run a test failover in its isolated bubble versus a real one.
   **Ending**: Traffic running from the target region, the recovery plan's checklist all ticked.
   **Variants**: `azure-backup`, `azure-availability-zones-and-region-pairs`; reliability's disaster recovery patterns.
   **Techniques**: stream, failure, timer, boundary, toggle, path trace, caption.
   **Review**: Improved — recovery plans order machine groups and scripts; they do not "do networking first", so beat 3 now orders database, app, web. Weighed running Backup and Site Recovery on the same deletion as one scene; stronger, but it duplicates `azure-backup`'s ending, so a cross-link caption is kept instead. Checked: RPO of minutes, test failover isolation, commit/re-protect/fail back, replication of deletions.

## Cost

### Pricing options: Reservations, savings plans, Azure Hybrid Benefit, Spot (`azure-pricing-options`)

**The aha**: Each discount trades flexibility for price, applied in a fixed order (reservations, then savings plans, then pay-as-you-go), and Spot's cheapness is rented against the risk of losing the VM with 30 seconds' notice.
**Misconception to defeat**: That all these discounts just "save money" the same way, or that Spot is simply a cheaper VM size.
**Cast**: Five coin meters, one per option, each showing price per hour: Pay-as-you-go (full), Reservation (lowest committed, tied to a VM family and region for 1 or 3 years), Savings plan (low, flexible across families and regions), Hybrid Benefit (a licence badge stacking on top), Spot (lowest, with a 30-second eviction badge).
**Opening frame**: Five meters at rest, one VM workload waiting to be billed.
**Story**:

1. The workload bills at pay-as-you-go: full coin flow. Caption: "The default: no commitment, full price."
2. A reservation is bought: the flow drops sharply, but a lock clamps around "VM family + region" for three years; moving to a different family loses the discount. Caption: "Biggest discount, least room to move."
3. Swap for a savings plan: a similar discount, the lock now reads "$/hour commitment", and the workload roams families and regions while the discount still applies. Caption: "A commitment to spend, not to a shape."
4. A Hybrid Benefit badge stacks on top, shaving off the Windows or SQL licence cost. Caption: "Licences you already own, reused."
5. The workload moves onto Spot: the meter drops to its lowest, a 30-second badge appears, capacity is reclaimed (red flash), the VM vanishing mid-task. Reservation and savings plan locks fall away: they don't apply to Spot. Caption: "Cheapest, can vanish — and no commitment discount stacks."
6. Recap stack: reservation applies first, savings plan next, pay-as-you-go for the rest. Caption: "They apply in this order, automatically."
   **The moment**: Beat 5 — the lowest meter paired with the VM vanishing mid-task, cheapness and interruptibility as one trade.
   **Interaction**: Choose a discount option and see its meter, lock and eviction risk; dial "interruptible? yes/no" to see whether Spot is sane here.
   **Ending**: A stable production workload on a savings plan, an interruptible batch job on Spot, side by side.
   **Variants**: `azure-cost-management`, `azure-vm-availability-options`.
   **Techniques**: meter, boundary, failure, timer, toggle, side by side, caption.
   **Review**: Improved — "tied to a VM type" was loose (reservations flex within a size family) and the plan implied Spot stacks with commitments; it does not. Weighed a decision tree (steady? flexible? interruptible?); the meters make the trade visible, and the interaction already gives the question. Checked: 1/3-year terms, 30-second Spot notice, application order, Hybrid Benefit licence reuse.

### Cost Management: scopes, cost analysis, budgets and allocation (`azure-cost-management`)

**The aha**: A budget only warns, it doesn't stop spending — accountability comes from scopes and tags designed into the resource hierarchy ahead of time, not from an alert arriving after the fact.
**Misconception to defeat**: That setting a budget caps spend, like a credit limit.
**Cast**: A resource hierarchy (management group, subscriptions, resource groups) with cost tags on resources ("team: payments"), one untagged. A budget box with a threshold line and an alert bell. A cost-analysis chart climbing over the month. A pricing calculator off to the side, "before you deploy."
**Opening frame**: The cost chart flat at the start of the month, the threshold drawn above it, the bell quiet.
**Story**:

1. Spending climbs; the chart crosses the threshold — some hours later (cost data lags) the bell rings and an email fires. Caption: "A budget notices, late. It doesn't brake."
2. The chart keeps climbing past the threshold, untouched. Caption: "Spending continues exactly as before."
3. Hierarchy view: resources tagged "team: payments" highlight across several resource groups; cost analysis filters to that tag. The untagged one falls in an "untagged" slice. Caption: "Who owns what comes from tags and scope, set up beforehand."
4. A separate anomaly alert flags a sudden spike unrelated to the threshold. Caption: "Anomalies are a different signal."
5. Inset: a budget wired to an action group can run automation, but only if someone built it. Caption: "A budget can trigger a brake — you have to build the brake."
6. Contrast inset: the pricing calculator estimating a hypothetical deployment, separate from cost analysis, which looks at what already happened.
   **The moment**: Beats 1–2 — the bell ringing while the spending line sails through the threshold without slowing.
   **Interaction**: Drag the budget threshold and watch only the bell's timing change, never the spend line; toggle tags on resources and watch cost analysis slice differently.
   **Ending**: A month-end chart well past the threshold, with a tag-filtered breakdown of who spent what.
   **Variants**: `azure-pricing-options`, `azure-resource-hierarchy`, `azure-policy`.
   **Techniques**: chart, meter, timer, spotlight, caption.
   **Review**: Improved — added that cost data and so budget alerts lag, that budgets can call action groups to automate a brake (otherwise "only warns" overclaims), and that untagged resources fall out of the tag view (tags aren't inherited by default). Weighed a "credit card limit vs smoke alarm" metaphor; the smoke alarm is already what beats 1–2 show. Checked: scopes (billing and resource), anomaly alerts, calculator vs cost analysis.

## Infrastructure as code and delivery

### ARM templates and Bicep (`azure-arm-templates-bicep`)

**The aha**: You describe the end state, not the steps — ARM works out the order from dependencies, and re-applying the same file is safe: what's already right is a no-op, and what-if shows the diff before you commit.
**Misconception to defeat**: Thinking of a template as a script that runs top to bottom, or Bicep as a different deployment engine rather than a syntax that compiles to the same ARM JSON.
**Cast**: A Bicep file with three resource blocks (a VNet, a subnet inside it, a VM referencing the subnet) with a dependency arrow. An arrow "compiles to" a denser ARM JSON block. ARM as an engine that takes the file and applies each resource to Azure. An empty Azure canvas beside it.
**Opening frame**: A Bicep file with three resource blocks, an empty Azure canvas beside it.
**Story**:

1. Deploy: ARM reads the references and builds VNet, then subnet, then VM — no one scripted the order. Caption: "Dependencies, inferred, not scripted."
2. Edit only the VM's size and redeploy. ARM sends all three resources again; VNet and subnet answer "already as described" and stay greyed, only the VM changes. Caption: "Re-apply the whole file — only the difference does anything."
3. Someone resizes the VM by hand (drift, the box changes colour). Re-running the unchanged file pushes it back. Caption: "The file wins; the portal change doesn't stick."
4. A what-if run first lists "Modify: VM size → Standard_D4; No change: VNet, subnet", touching nothing. Caption: "See the plan before it happens. No state file — Azure is the state."
5. A module block pulls in an Azure Verified Module instead of writing a subnet pattern from scratch. Caption: "Reuse the common shapes."
   **The moment**: Beat 3 — drift introduced by hand, silently corrected on the next deploy, proving the file is the source of truth.
   **Interaction**: Edit a field and preview the what-if diff before applying; introduce manual drift and watch it get reverted.
   **Ending**: Azure's state matching the file, what-if showing "no changes" on a repeat run.
   **Variants**: `azure-deployment-modes-and-stacks`, `azure-resource-manager`; delivery's infrastructure as code.
   **Techniques**: path trace, restyle, toggle, side by side, caption.
   **Review**: Improved — the plan said ARM "diffs desired against actual and calls only what differs"; ARM actually re-sends every resource and the providers no-op (what-if is the diff tool), so beat 2 and the aha were corrected; added the no-state-file point (the catalog's Terraform confusion). Weighed leading with the Terraform comparison; off the point. Checked: Bicep compiles to ARM JSON, auto dependencies, AVM modules.

### Deployment scopes, incremental vs complete mode, and deployment stacks (`azure-deployment-modes-and-stacks`)

**The aha**: ARM only adds and updates by default — removing a resource from the file does nothing in Azure unless you're in complete mode or using a deployment stack.
**Misconception to defeat**: Assuming deleting a line from the template deletes the resource in Azure, which is only true with complete mode or a stack.
**Cast**: A template file listing three resources (A, B, C) and a fourth (D) that exists in the resource group but isn't in the file. Two mode switches: Incremental (default) and Complete. A "deployment stack" wrapper around the deployed set.
**Opening frame**: The file listing A, B, C; the resource group holding A, B, C, D, with D highlighted as the odd one out.
**Story**:

1. Deploy incrementally: A, B, C are created or updated; D is left alone. Caption: "Incremental only adds and updates — it never looks at what you didn't list."
2. Remove C from the file; redeploy incrementally. C still sits in Azure. Caption: "Deleting it from the file didn't delete it from Azure."
3. Switch to complete mode with the trimmed file (A, B): a what-if preview first lists "Delete: C, D", then the real run deletes both, because complete mode removes anything in the group the file doesn't list. Caption: "Complete mode: the file is the whole truth — including what's missing."
4. Reset; wrap the deployment in a deployment stack tracking A, B, C as "mine", with a deny setting. Someone tries to delete B in the portal and is blocked. Caption: "A stack also guards what it manages against hand edits."
5. Remove B from the file under the stack; redeploy. The stack notices B is no longer listed and deletes it (or detaches it, by setting). Caption: "Stacks clean up like complete mode, but only what they manage — D is never touched."
   **The moment**: Beat 2 against beat 3 — the identical "remove C, redeploy" doing nothing in incremental mode and deleting resources in complete mode.
   **Interaction**: Toggle incremental and complete and watch the same edited file produce different results; try deleting or editing a managed resource under a stack's deny setting.
   **Ending**: A stack holding exactly A and B, C gone, D still alone, a deny setting visibly guarding the managed edge.
   **Variants**: `azure-arm-templates-bicep`, `azure-resource-locks`.
   **Techniques**: toggle, failure, boundary, side by side, restyle, caption.
   **Review**: Improved — the old beat 4 said a stack's deny setting blocks someone adding a new resource E; deny settings protect the resources the stack manages, they don't forbid new ones, so it now blocks a delete of B. Complete-mode's destructiveness gets a what-if preview, and the stack's scope is limited to what it manages (D survives). Weighed a pure two-column table; the toggle already does that. Checked: incremental default, complete deletes unlisted resources in the group, stack delete/detach and deny settings.

### Azure DevOps Pipelines vs GitHub Actions for deploying to Azure (`azure-devops-vs-github-actions`)

**The aha**: Either tool can deploy anything to Azure, and the Azure side is identical either way — an Entra workload identity with just enough RBAC, no stored secret — so the real choice is about where code, planning and security tooling already live.
**Misconception to defeat**: Thinking one is "better for Azure" because it's Microsoft's own product, or that a stored client-secret service connection is still the normal way to connect.
**Cast**: Two pipelines side by side. Left, "Azure DevOps": Boards, Repos, Pipelines (YAML stages/jobs), Artifacts, Test Plans around one icon, with a service connection to Azure. Right, "GitHub Actions": a workflow file beside the code, with an `azure/login` step. Both converge on one Entra workload identity badge and a resource group. The identity holds a "federated credential" tag naming who may use it.
**Opening frame**: Two separate pipelines, both pointed, unconnected yet, at the same resource group.
**Story**:

1. The Azure DevOps pipeline runs a deploy stage through a service connection using workload identity federation. Its short-lived token is matched to the identity's federated credential. Caption: "No stored secret — a federated identity."
2. The GitHub workflow runs on a push; `azure/login` presents a short-lived token naming the repo and environment, and the same match happens. Caption: "Same mechanism, different front door."
3. Both land on the identical resource group; the identity's role is scoped to that group, not Owner on the subscription. Caption: "Just enough access, either way."
4. Zoom out left: Boards, Repos, Artifacts, Test Plans bundled. Zoom out right: the workflow file in the same repo as the app. Caption: "The difference is the suite around the pipeline, not what reaches Azure."
5. A stored-secret service connection fades out on both sides, crossed out. Caption: "Secrets are the old way on both tools."
   **The moment**: Beats 2–3 — two differently-branded pipelines converging on the identical federated, least-privilege deployment.
   **Interaction**: Toggle between the two pipelines and watch the Azure-side steps stay identical; try wiring a stored secret instead and see it flagged as the weaker path.
   **Ending**: Both pipelines resting on the same Entra workload identity, resource group and scoped role.
   **Variants**: `azure-workload-identity-federation`, `azure-arm-templates-bicep`; delivery's CI/CD pipelines.
   **Techniques**: side by side, token, path trace, boundary, restyle, caption.
   **Review**: Improved — the federation was asserted but not shown; the federated-credential match (repo/environment claim) is now visible, which is the actual reason no secret is needed. Weighed a feature-grid comparison (environments, approvals, runners); worse, because the point is that the Azure side is identical. Checked: workload identity federation on both tools, `azure/login`, Azure DevOps suite contents.

## Hybrid and migration

### Azure Arc (`azure-arc`)

**The aha**: Once a machine outside Azure is projected into ARM, everything Azure already does with resources — RBAC, Policy, Defender, Monitor, Update Manager — just applies to it; Arc extends the reach of existing tools rather than adding new ones.
**Misconception to defeat**: That Arc moves or runs the workload in Azure, or that it's the same thing as a VPN or ExpressRoute connection.
**Cast**: An on-premises boundary holding a physical server and a Kubernetes cluster, each running where it is. An Arc agent on each. A thin outbound "control" line (not a VPN pipe) reaching up to ARM, where each appears as an ordinary resource in a resource group, beside real Azure VMs.
**Opening frame**: The on-premises server and cluster running locally, invisible to Azure; the ARM resource group holding only real Azure resources.
**Story**:

1. The Arc agent is installed on the server. A thin control line reaches up and a matching resource icon appears in the resource group — the server never moves. Caption: "Projected into ARM. Still running where it was."
2. An RBAC role assigned at the resource group gives someone "Reader" on the Arc server too, with zero Arc-specific setup. Caption: "RBAC doesn't know the difference."
3. A Policy with a machine-configuration effect reaches down the control line and installs a missing security baseline on the server. A tag Policy likewise stamps the server with "env: prod". Caption: "Policy remediation reaches outside Azure."
4. The Azure Monitor agent and Defender for Servers light up on the server as on a VM, landing in the same workspace. Caption: "Same monitoring, same security."
5. Contrast inset: the same server connected only by a VPN pipe, no Arc agent — reachable, but invisible to ARM; no RBAC, Policy or Monitor applies. Caption: "Connectivity isn't governance."
   **The moment**: Beat 5 against the rest — network connectivity alone does nothing for governance; the Arc agent is what makes ARM's tools apply.
   **Interaction**: Toggle the Arc agent on or off on the server and watch which Azure tools can see and act on it.
   **Ending**: The server and cluster as ordinary-looking icons in a resource group, policed and monitored like native resources.
   **Variants**: `azure-resource-hierarchy`, `azure-policy`, `azure-defender-for-cloud`.
   **Techniques**: boundary, path trace, toggle, restyle, spotlight, caption.
   **Review**: Improved — beat 2 claimed a resource-group tag is inherited by the Arc server; Azure tags don't inherit (only RBAC and Policy scope do), so it was replaced with a Policy that applies a tag. Weighed an "Arc vs Azure Local vs Migrate" triangle; too many ideas for one clip. Checked: outbound agent connection, machine configuration, Update Manager, Defender for Servers.

### Azure Migrate and migration tooling (`azure-migrate`)

**The aha**: Migration is discover, then assess, then move — the assessment's right-sizing and dependency map are what stop you lifting an oversized VM, or splitting two apps that constantly talk to each other, straight into the cloud.
**Misconception to defeat**: Treating migration as just "copy the VM to Azure," skipping straight to replicate and cutover.
**Cast**: An on-premises estate of several servers, one oversized (5% CPU), two joined by a thick "constant chatter" line. An Azure Migrate appliance doing discovery. An assessment report with right-sizing and a dependency map. A replicate-and-cutover arrow at the end.
**Opening frame**: The on-premises estate, unassessed, an appliance just installed, nothing discovered yet.
**Story**:

1. The appliance scans the estate: utilization streams up for every server, and the chatter line between two servers is traced out. Caption: "Discover what's really there, and what talks to what."
2. The assessment runs: the oversized server's measured usage yields a right-sized recommendation at a fraction of the size, with a cost estimate. Caption: "Not 'the same size' — the size it needs."
3. Someone migrates just one of the two chatty servers alone — the dependency line stretches across the cloud boundary, a latency warning flashing. Caption: "Split a tight dependency, pay for it in latency."
4. The plan is corrected: both move together in one wave. Caption: "The map tells you what moves together."
5. Replication begins, a stream from on-premises to Azure; cutover happens on schedule; the dependency line is short again inside one region. Caption: "Discover, assess, then move — in that order."
6. Small closing inset: databases go through Database Migration Service, terabytes through Data Box — the same hub, other tools.
   **The moment**: Beat 3 — the dependency line stretched thin and flashing across a half-migrated estate.
   **Interaction**: Drag servers into a migration wave and watch dependency lines stretch or stay short; adjust the oversized server's utilization and watch the recommended size change.
   **Ending**: The estate moved in correctly-grouped waves, dependency lines short, right-sized VMs in Azure.
   **Variants**: `azure-site-recovery`, `azure-arc`; reliability and architecture's migration patterns.
   **Techniques**: stream, path trace, meter, failure, spotlight, caption.
   **Review**: Improved — the title promises "migration tooling" but only servers appeared; a closing inset names Database Migration Service and Data Box. Weighed a "7 Rs" decision (rehost, refactor…); that is the architecture area's concept and would dilute this one. Checked: appliance discovery, performance-based right-sizing, dependency analysis, replicate then cutover.

## AI on Azure

### Microsoft Foundry: resource, projects and model deployments (`azure-foundry-resource-model`)

**The aha**: A model from the catalog isn't callable until it's deployed, by name, into your Foundry resource with a quota — and it's the resource, not the model, where networking, identity, RBAC and Policy actually apply.
**Misconception to defeat**: Treating a model like a public API you just call with a key, the way the plain OpenAI API feels; confusing the model catalog with a deployment.
**Cast**: A model catalog shelf (GPT, an open model, a partner model, each a card). A Foundry resource box with a network boundary, an Entra RBAC badge and a Policy badge on its edge. Inside, an empty deployment slot with name, type and quota fields. A project holding an agent.
**Opening frame**: The catalog shelf full of model cards; the Foundry resource empty inside.
**Story**:

1. A model card is dragged into the slot and given a name ("gpt-main"), a deployment type and a quota. Only now does a callable endpoint appear, addressed by that deployment name. Caption: "Callable only once named and deployed here."
2. A client calls it: the request meets the resource's network boundary and RBAC (Entra identity, or a key) before it reaches the model. Caption: "Network rules and RBAC belong to the resource, not the model."
3. A Policy badge blocks a second deployment that violates an org rule (wrong region). Caption: "Policy governs the resource like any other."
4. Inside the resource, a project holds an agent (Foundry Agent Service) and evaluation files, scoped to this resource's identity and network. Caption: "Projects live inside the same boundary."
5. Contrast inset: the plain public OpenAI API as a bare endpoint with an API key, no boundary, no RBAC, no Policy.
   **The moment**: Beat 1 — the model card inert on the shelf versus a callable endpoint only once dropped into a named deployment slot.
   **Interaction**: Drag different model cards into the slot and watch quota and endpoint appear; call the resource with an identity that fails RBAC.
   **Ending**: The resource with one named deployment, a project with an agent, boundary, RBAC and Policy badges wrapping it.
   **Variants**: `azure-model-deployment-types`, `azure-managed-identity`, `azure-ai-content-safety`.
   **Techniques**: boundary, token, restyle, contents, zoom, caption.
   **Review**: Improved — the deployment now carries name, type and quota (the catalog's definition) and the call goes by deployment name, not model name; Entra auth is shown alongside keys. Weighed starting with a "hub vs project" diagram; worse for a newcomer. Checked: Foundry as the Azure resource that owns endpoint, networking, identity; projects for agents and evaluations; models via catalog.

### Model deployment types, quota and provisioned throughput (PTUs) (`azure-model-deployment-types`)

**The aha**: The deployment type trades along two axes at once — where inference may run versus price and availability, and steady latency (PTUs) versus flexible pay-per-token — chosen per deployment, not per model.
**Misconception to defeat**: Thinking "deployment type" is just a pricing tier, or confusing it with picking a model version.
**Cast**: A grid: rows for geography (Global, Data Zone US/EU/APAC, one region), columns for payment shape (Standard pay-per-token within a tokens-per-minute quota, Provisioned PTUs as reserved capacity, Batch at half price). One model card labelled with its version ("gpt-x v1") that can drop into any cell.
**Opening frame**: The model card outside the grid, all cells empty.
**Story**:

1. Drop it into "Global + Standard": requests consume a tokens-per-minute quota meter; the cheapest cell, "gets new models first." Caption: "Cheapest and first — but global means processing anywhere."
2. Drag it into "Data Zone EU + Standard": a boundary appears around the EU; same pay-per-token meter, different quota. The version label never changes. Caption: "Same model, same money model, narrower geography."
3. Drag into "Global + Provisioned": instead of a quota meter, a fixed reserved block; under identical load the latency chart stays flat, where the Standard cell's wobbles. Caption: "Pay for steady, not pay-as-you-go."
4. Push load past the PTU block's capacity — requests return 429s until a "spillover to Standard" toggle reroutes the overflow. Caption: "A full provisioned deployment can spill over — if you let it."
5. Drag into "Batch": a 24-hour timer, requests gather and process at half price. Caption: "Not for a live conversation."
   **The moment**: Beat 3 — the two latency charts side by side under identical load, one flat, one wobbling.
   **Interaction**: Drag the model card between cells and watch the meter, latency and geography boundary change; push load past the PTU ceiling and toggle spillover.
   **Ending**: A production deployment in a PTU cell with spillover enabled, latency flat as load spikes.
   **Variants**: `azure-foundry-resource-model`, `azure-ai-content-safety`.
   **Techniques**: boundary, meter, chart, toggle, failure, side by side, caption.
   **Review**: Improved — the model version label now stays fixed across cells so "deployment type isn't the version" is visible, which the old plan only stated. Weighed splitting residency and billing into two plans; one grid with two axes is the point. Checked: Global/Data Zone/regional, Standard TPM quota, PTU 429s and spillover, Batch at half price within 24 hours, quota per subscription/region/model.

### Content filters and guardrails (Azure AI Content Safety) (`azure-ai-content-safety`)

**The aha**: The model is wrapped, not trusted — filters run on the way in and the way out of every deployment, and a "filtered" result is a normal outcome the app has to handle, not an exception.
**Misconception to defeat**: Believing the model "knows better" and refuses things itself, or that filtering is a one-time setup rather than something running on every call.
**Cast**: A model deployment box with two checkpoints: "Prompt Shields / input classifiers" before, "output classifiers / groundedness / protected material" after. A request token, a response token. Severity threshold dials per category (hate, sexual, violence, self-harm).
**Opening frame**: A request token before the input checkpoint, model idle, thresholds at default.
**Story**:

1. A benign request passes input untouched, the model answers, output passes untouched. Caption: "Most traffic: invisible."
2. A jailbreak prompt arrives; Prompt Shields stops it at input — the model icon never lights, and the app gets a rejected request. Caption: "Some things never reach the model."
3. A borderline request passes input, the model answers, but the output scores above the violence threshold: the response is replaced and marked content_filter. Caption: "The model answered; the answer didn't get through."
4. The app branches on both outcomes — rejected input and a filtered output — rather than crashing or showing raw text. Caption: "Filtered is a normal outcome your app expects."
5. A threshold dial is dragged one way and a blocked response now passes; the other way, a fine response blocks. Caption: "Thresholds are set per deployment, per category."
   **The moment**: Beat 2 against beat 3 — one blocked before the model ever runs, the other after it already produced an answer.
   **Interaction**: Dial each category's severity threshold and send test prompts; toggle Prompt Shields on or off.
   **Ending**: The app handling a filtered flag gracefully, both checkpoints visibly still active.
   **Variants**: `azure-foundry-resource-model`, `azure-model-deployment-types`.
   **Techniques**: boundary, token, dial, failure, toggle, spotlight, caption.
   **Review**: Improved — the old plan treated every block as a flag in a normal response; in practice a blocked prompt comes back as a rejected request (an error), while a blocked completion is a flagged finish reason, so the app must handle both and beats 2–4 now say so. Weighed a "layers of defence" cutaway with the model alignment layer; the model-alignment confusion is better handled by the dials. Checked: four harm categories, Prompt Shields, per-deployment configuration, protected material and groundedness.

### Azure AI Search for retrieval-augmented generation (`azure-ai-search-rag`)

**The aha**: RAG answers live or die on retrieval — hybrid search plus a semantic re-rank finds the right chunk that pure vector search misses, and security filters decide what each user is even allowed to retrieve.
**Misconception to defeat**: Thinking "add a vector database" is the whole job, or that retrieval quality stops mattering once you have a good model.
**Cast**: A document pipeline feeding an index: documents chunked and embedded, each chunk with a vector dot and keyword terms and an access-list field. A query offering a keyword path (BM25) and a vector path into the index, converging into a "reciprocal rank fusion" funnel, a "semantic ranker" re-ordering the top results, then the model receiving the survivors as "grounding chunks."
**Opening frame**: Documents already indexed as chunks, each with keyword and vector representations; a query sitting unsent.
**Story**:

1. The query goes by the vector path alone: it returns semantically similar chunks that miss an exact term the user needed, shown dim, "missed". Caption: "Vector search alone can miss the obvious match."
2. The same query goes by keyword and vector at once; reciprocal rank fusion merges the two ranked lists and the missed chunk surfaces. Caption: "Hybrid search catches what either alone would drop."
3. The semantic ranker re-scores the fused results against the question — a chunk ranked fourth jumps to first. Caption: "Re-rank by meaning, not just the fusion score."
4. A security filter built from the asker's groups is applied inside the search itself: a relevant chunk from a document this user can't see never makes the candidate list, so the top results are still full. Caption: "Retrieval respects who's asking."
5. The surviving chunks go to the model, which answers using only them; swapping in a deliberately bad set visibly degrades the answer though the model didn't change. Caption: "The answer is only as good as what got retrieved."
6. Agentic retrieval splits a complex question into two sub-queries, each through the same pipeline, results combined.
   **The moment**: Beat 5 — the identical model producing a visibly worse answer purely because the retrieved chunks were swapped.
   **Interaction**: Toggle vector-only versus hybrid versus hybrid-plus-re-rank and compare which chunks surface; toggle the security filter on or off for a restricted user.
   **Ending**: A good answer grounded in the top, security-filtered, re-ranked chunks, the full pipeline visible end to end.
   **Variants**: `azure-foundry-resource-model`; AI's vector search and RAG pipeline; data's vector databases.
   **Techniques**: path trace, token, spotlight, side by side, restyle, caption.
   **Review**: Improved — the security filter sat after ranking, as if trimming results; it is a query-time filter, and applying it afterwards would leave top-k holes, so it now runs inside the search. Weighed opening with the bad-answer failure; the plan's order (retrieve better, then see the effect) reads better but beat 5 stays the moment. Checked: BM25 plus vector, RRF, semantic ranker, agentic retrieval, integrated chunking/embedding.
