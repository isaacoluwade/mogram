# Messaging plans, part 1: review (stage 3)

Reviewed: all 44 plans in `messaging.part1.md`, against `catalog/messaging.md` and the sibling part 2. An
earlier reviewer was interrupted after the first 36 plans; the last 8 (`stream-connectors` through
`stream-table-duality`) were reviewed in a second pass.

## Verdicts

| Verdict   | Count | Plans                                                           |
| --------- | ----- | --------------------------------------------------------------- |
| Keep      | 0     | None; every plan needed at least one fix.                       |
| Improved  | 42    | All except the two below.                                       |
| Rethought | 2     | `message-acknowledgement`, `priority-queue`                     |
| Merged    | 0     | Messaging's ids here are all its own (`stream-windowing` kept). |

## Most important changes

- `visibility-timeout`: a late ack is refused as "lock lost", and the side effect already ran twice; added lock renewal.
- `consumer-groups` and `consumer-rebalancing`: fixed a wrong partition assignment; eager rebalancing freezes everyone, cooperative does not; storms come from overrunning the poll deadline, not missed heartbeats.
- `consumer-offsets`: offsets are written by the consumer and stored by Kafka; one commit covers a batch (unlike an ack).
- `log-compaction`: survivors keep offsets, the newest segment is not compacted, tombstones linger.
- `watermarks`: the old dial conflated watermark delay with allowed lateness; now the delay sets when the window first closes, lateness only governs corrections.
- `stateful-stream-processing`: restoring a changelog and restarting from an unrelated offset double counts; state and offset are now committed as a pair.
- `stream-table-duality`: the "lockstep" beat is replaced by wipe-and-replay, which proves the claim; "stream = history" corrected to "changes".
- `stream-joins`: a table is bounded by keys, not time; co-partitioning by join key shown; old output is not recomputed when the table changes.
- `stream-connectors`: offsets give a harmless replay of the last write only with an idempotent sink, not "no reprocessing".
- `event-time-vs-processing-time`: consistent timestamps, ingestion time added, hand-off to `watermarks`.
- `stream-processing`: the event-handler misconception is now shown (a handler sees three failed logins one at a time).

## Patterns for the platform

- Two-panel "same input, different design" runs (queue vs log, push vs pull, event time vs processing time, handler vs standing query) are the area's workhorse; they need synchronised playback of one event across panels.
- A log of numbered cells with several independent offset markers, and group-coloured ovals, appear in over a dozen plans; this wants to be one reusable component with commit, lag and rebalance states.
- Time axes with sliding markers (watermark, windows, TTL rings, lease countdowns) recur; one timeline primitive with windows and a movable watermark would serve streaming, TTL and visibility plans.
- Failure injection at a chosen instant (crash before or after ack, commit, checkpoint) is the interaction almost everywhere; a "crash here" control that replays from the chosen point is worth building once.
- Counters and ledgers (double charge, rows, delivery counts) make duplicates and losses countable; keep them on screen rather than captions.
