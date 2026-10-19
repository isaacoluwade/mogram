# Data plans, part 3: review summary

33 plans (groups 9-13 of `catalog/data.md`). An earlier reviewer finished the first 14 before being
interrupted; the remaining 19 were reviewed in this pass.

## Verdict counts

| Verdict   | Count | Plans                                                                         |
| --------- | ----- | ----------------------------------------------------------------------------- |
| Keep      | 4     | `data-lakehouse`, `partitioned-tables`, `data-quality-checks`, `backup-types` |
| Improved  | 26    | all others except those below                                                 |
| Rethought | 2     | `etl-vs-elt`, `expand-contract-migration`                                     |
| Merged    | 1     | `stream-windowing` (owned by Messaging)                                       |

## Most important changes

- `schema-compatibility`: backward and forward were swapped in beats 1 and 2; fixed, with labelled arrows, "full", and registry modes.
- `expand-contract-migration`: rebuilt on the rename with the big-bang failure first, instance-to-column wires, a "v1 instances" counter gating contract, and a backfill that runs after old writers are gone (borrowed from delivery's plan).
- `watermarks-late-data`: the watermark is now derived from event times (newest seen minus tolerance); the old run contradicted itself.
- `online-schema-change`: `ADD COLUMN` is instant on modern MySQL and PostgreSQL; the example is now a type change that really rewrites.
- `change-data-capture`: log readers are at-least-once, so the crash beat shows a harmless repeat applied by key, not "nothing twice".
- `storage-snapshots`: "copy-on-write" caption didn't match the picture; "not a backup" scoped to snapshots in the same pool (cloud disk snapshots live apart).
- `schema-migrations`: tools don't diff the live schema; the failure is now the next script colliding with a hand-made change.
- `database-migration-cutover`: CDC starts from a log position noted before the copy; cutover gated on zero lag; reverse sync kept for rollback.
- `backup-vs-replication`: added a failover beat so replication is shown doing its real job; the vault is immutable with separate access.
- `lambda-vs-kappa-architecture`: kappa's replay is a second job writing a new table, switched over once caught up.
- `incremental-load`: late commits stamped before the mark, fixed by overlap plus upsert; mark advances only after a successful load.
- `data-pipeline-orchestration`: DAG now fans in; the retry arithmetic (half the rows re-inserted but total doubled) fixed.
- `stream-windowing` marked Merged. For Messaging's plan to borrow: the burst sliced by tumbling windows versus caught whole by a session window, the per-window total meter, and "sliding" = "hopping" terminology.

## Patterns for the platform

- **Scrub** (drag a marker through recorded history) carries version slider, PITR, backfill sweep, replay: it needs a scene that can be rewound to any recorded state.
- **Side by side with a toggle** is in nearly every plan (two designs, same input, different outcome); it needs two synchronised scenes driven by one event script.
- **Rewind and replay**: show the failure, rewind, show the fix (naive retry vs idempotent, reuse a tag vs fresh tag, no lineage check vs check). One-shot "undo to a marked beat".
- **Meters and charts tied to a simulation**: bytes read, files opened, latency, backlog, cost lines. They must come from the scene state, not be hand-animated, or dials and interactions will disagree with the picture.
- **Logs and chains as first-class objects**: commit cards, WAL, backup chains, migration ledgers, table logs; "restore needs these cards in order" is traced with path highlights.
- **Time axes with several clocks**: event time vs processing time, window boxes, watermark lines, high-water marks.
- **Rows vs columns, files vs table**: strips, bundles of vertical strips, ghost (uncommitted) elements; a shared vocabulary for physical layout.
- **Gate with a checklist and quarantine** (quality checks) and **cutover switch** (migration) are small reusable stateful widgets.
- Several plans have an interaction that injects a fault (kill a worker, corrupt a backup box, drop a call); the platform needs failure injection that the story can also script.
