# Google Cloud plans, part 3: review summary

Verdicts (33 plans): Keep 1, Improved 31, Rethought 1, Merged 0.

## Most important changes

- `gcp-iac-options` (rethought): Config Connector is Kubernetes YAML, not a way to run the Terraform file, so "one file, three arrows" was wrong. Also the Deployment Manager countdown pointed at March 2026, a date already past.
- `gcp-audit-logs`: the scenario showed a BigQuery read going unlogged, but BigQuery Data Access logs are on by default; moved to Cloud Storage and named BigQuery as the exception.
- `gcp-log-router-sinks`: exclusion filters belong to each sink (an entry excluded from one still reaches another that includes it), and `_Required` holds only Admin Activity and System Event logs.
- `gcp-bigquery-partitioning-clustering`: monthly partitions with a single-day filter did not add up (2.1 TB to 68 GB); now 31 daily partitions, and the dry run is an upper bound for clustering.
- `gcp-pubsub-model`: beat 3 showed a message in a subscription created after it was published; fixed, and added workers-share-a-subscription.
- `gcp-pubsub-delivery-controls`: one poison message now ties ordering stall, retries and the dead-letter topic together.
- `gcp-vpc-service-controls`: perimeter bridges are two-way (one-way doors are egress rules); the perimeter checks boundary crossing, not "not who".
- `gcp-dataflow`: late data depends on allowed lateness plus triggers; "unchanged code" became "same transforms, swapped source".
- Smaller fixes: the vpc/gateway/Apigee volume claim, Binary Authorization attestations bound to image digest, Assured Workloads projects are created inside the folder, Cloud Deploy digest vs per-target rendering, Cloud Functions renamed Cloud Run functions, ungrounded answer moved first in the search plan, memory split from session in the Agent Runtime plan.

## Patterns for the platform

- Many plans are "same task through two options side by side with one meter each"; a reusable twin-lane layout with a shared input (burst, query, spike) would serve most of them.
- Decision paths (question card lighting an icon) appear in about ten plans; one component with a path-trace and idle-cost footnote covers them.
- Meters come in several flavours (bytes scanned, coins, slot-hours, 429 counts, digests that must stay equal); they should be bindable to events, not scripted.
- A nested boundary with named doors (perimeters, folders, sinks, IAP checkpoints) recurs; it needs per-door rules and a dry-run state.
- Per-key lanes and per-sink pipes with filters (ordering keys, log sinks, partitions) need a "filter gate on a pipe" primitive.
- Toggle-driven interactions that change what logs or entries exist (Data Access logs, exclusion filters) are the best way to teach "recorded vs not"; they need a persistent audit tray.
- Several plans were wrong on one detail that a faithful simulation would have exposed (a subscription's message set, a log's destination); a small state model per concept beats hand-scripted beats.
