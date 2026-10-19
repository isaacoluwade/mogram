# Data part 1: review summary

Reviewed `data.part1.md` (38 plans). An earlier reviewer was interrupted after 24 plans (through `search-engine-database`); the remaining 14 (`vector-database` onward) were reviewed in this pass, and the earlier verdicts left untouched.

## Verdict counts

| Verdict   | Count |
| --------- | ----- |
| Keep      | 7     |
| Improved  | 30    |
| Rethought | 0     |
| Merged    | 1     |

Improved includes two "links only" edits (`immutable-storage-worm`, `time-series-database`). Merged: `durability-vs-availability` (owned by Reliability; theirs should borrow the eleven-nines reading, the "bought with" cards and the year-strip ending).

## Most important changes

- `vector-database`: the keyword-search failure was fake ("kitten" appears in "kitten diet"); wording now has no overlap.
- `isolation-levels`: adds lost update to the lower-level replays, default-level markers per vendor, Oracle's "serializable" being snapshot, and a "your default is not the safe one" ending.
- `write-skew`: serializable detection now draws a cycle of two read-write dependencies, not one arrow; `FOR UPDATE` can't guard rows that don't exist (phantom-style cases).
- `lost-update`: adds the database-level fix (PostgreSQL repeatable read aborts; MySQL's does not).
- `mvcc`: version labels use transaction ids not clock times; writers still block writers, so MVCC is not optimistic locking; long readers cause bloat.
- `two-phase-commit`: only participants that have not voted can abort alone; in-doubt escape hatches (log, heuristic outcome); replicated coordinator as the fix.
- `database-deadlock`: victim is chosen by the database, detection timing is real (about 1 s PostgreSQL, 5 s SQL Server).
- `distributed-sql`: region latency is a range; Aurora DSQL is not the same machinery as Spanner/CockroachDB.
- `acid-transactions`, `serializability`, `optimistic-vs-pessimistic-locking`: the named misconceptions (ACID C vs CAP C, linearizability, MVCC) are now answered on screen.

## Patterns for the platform

- Concurrency anomalies share one machine: bands on a timeline, dots for reads and writes, pencil vs ink values, padlocks, hatched waiting, a scrub playhead and a toggle for the protection (level, lock, compare-and-set). Build it once; about 12 plans reuse it.
- A grid of levels by anomalies, filled by replaying cells, plus vendor tabs that reshuffle a row in place.
- Version stacks (cards under a row) with per-transaction visibility lines, and a wait-for graph drawn beside the bands.
- Message-sequence lanes with timers (2PC, distributed SQL), where killing any node at any beat is the interaction.
- Side-by-side with a dial that flips the winner (optimistic vs pessimistic, vector recall vs speed, tenancy slider).
- Meters tied to a dial (throughput, latency, recall, cost) recur across storage, databases and transactions.
