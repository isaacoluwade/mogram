# AWS part 2: stage-3 review summary

**Verdicts (32 plans)**: 1 Keep, 31 Improved, 0 Rethought, 0 Merged.

## Most important changes

- Lambda event source mappings: a failed stream batch is reprocessed whole (records 1 and 2 run
  again), not "retried from 3"; added bisect versus partial-batch reporting.
- Block Public Access: a new public policy is rejected at save time, not "accepted but blocked".
- t3 instances default to Unlimited credit mode (surplus billed, not throttled); the throttling
  beat now toggles Standard versus Unlimited. m7g is not cheaper than m6g: better value, not price.
- ASG instance refresh does not terminate "only after new is healthy" by default; it keeps a min
  healthy line. ELB health checks must be enabled for the ASG to replace a broken app.
- RDS Multi-AZ instance failover is about 1 to 2 minutes, not "under a minute".
- DynamoDB multi-Region strong consistency rejects one concurrent writer rather than choosing a
  winner; Aurora DSQL pays at commit, not on every statement.
- S3 Object Lock: "soft delete" is not an S3 feature; governance mode now shows the same attacker
  winning, which is the reason to pick compliance mode.
- S3 archive classes need a restore request before any GET works; first EBS snapshot is full.
- Hybrid transfer: showed the arithmetic (100 TB at 100 Mbps is about 93 days) and replaced
  "ship a device" with Data Transfer Terminal now that Snowball is closed.
- Misconceptions named but never defeated now have beats: versioning is not a backup (version-id
  delete), replication is not a backup (bad writes replicate), read replicas and standbys are not
  backups (a `DROP TABLE` replicates), "reserved means warm", FSx for Lustre for a Windows share,
  ECS versus Kubernetes names, "managed means AWS chose your schema".
- Added the third capacity setting (ECS Managed Instances, EKS Auto Mode) to the container grid.

## Patterns for the platform

- The same-event-run-against-several-variants layout (one rack failure, one delete, one
  simultaneous edit, one node kill) carried most of these plans; the platform needs a "replay this
  trigger on every panel" control.
- Deadlines and clocks are everywhere: failover timers, Init bars, retention calendars, restore
  waits, URL and credential expiry. A shared timer widget with named, overlaid clocks (two clocks
  racing, shorter wins) covers presigned URLs, Object Lock and Lambda idle recycle.
- Meters with a hard line (connection ceiling, per-partition throughput, subnet IPs, concurrency
  fence) recur; one gauge with a configurable red line and a "pile-up" state is enough.
- Unit calculators (RCU/WCU rounding, bandwidth over size) work as a live formula next to the
  item; the platform needs a formula chip that updates as sliders move.
- Toggles that change what a lane means (Standard/Unlimited, governance/compliance, Block Public
  Access on/off, bisect on/off) are a first-class primitive: same cast, different outcome.
- Decision-tree plans (compute, containers, files, databases) all end by showing "several leaves
  lit at once"; a path-lighting tree that supports multi-select is needed.
- A failed-action bounce ("bounces off the boundary", "refused") is the most common failure
  animation after red-flash-and-grey; it should be a named effect.
