# Data, part 2: review summary

34 plans: **20 Improved, 14 Keep, 0 Rethought, 0 Merged**. (27 verdicts were written by the earlier
reviewer, 7 by this one, all in the storage-engines section.) Data's own ids
(`consistent-hashing`, `split-brain`, `n-plus-one-queries`) are kept and polished; the better ideas
from scaling's consistent-hashing and reliability's split-brain were already borrowed.

## Most important changes

- `split-brain`: concrete double booking, then a separate rewind where a paused leader never counted votes, which motivates fencing; three-way cut and witness borrowed from reliability.
- `consistent-hashing`: fixed a wrong failover direction (keys go to the next node clockwise); "keys moved" counters make the moment numeric.
- `linearizability`: the fix in beat 5 was wrong (a majority read can still return 0); now the read writes back to a majority first.
- `range-vs-hash-partitioning`: range bands became days with an open-ended newest range, so sequential keys really hit one partition.
- `query-execution-plan`: the SQL filtered `city` on a table without it; now plans (seek plus nested loop, scan plus hash join) match the query, and estimated vs actual rows need EXPLAIN ANALYZE.
- `write-ahead-log`: added the in-memory page, which the crash empties, so the log's necessity is visible.
- `b-tree-vs-lsm-tree`: LSM writes now include their own log; compaction shows rewritten bytes.
- `composite-and-covering-indexes`: the "several single-column indexes" misconception is now actually shown; clustered secondary indexes hold the clustering key.
- `database-indexes`: row counter (a million rows against about 20 steps); index count fixed (table plus six).
- `n-plus-one-queries`: the loop is visible as code; each query is fast, so no slow-query log shows it.
- `database-connection-pooling`: reason for the cap; the pooler funnelling many instances is the real serverless fix; a bigger pool stops helping.

## Patterns for the platform

- **Two panels / ghost runs** (side by side, rewind): nearly every plan contrasts the same input under two designs or replays a history with one change; needs synchronised dual timelines and a "rewind and branch" step.
- **Receipts and rows as contents**: acknowledged writes, versions and lost writes appear as small tokens that persist, turn red, or have no matching row. A shared "receipt" element with states.
- **Rings, ranges and shard maps**: partitions as a ring or bands, keys as dots that move to a new owner; counters of keys moved; failure of a node recolouring its range.
- **Dials driving a scenario**: skew, timeout, write share, page size, pool size, statistics; the model must recompute the animation, not just replay it.
- **Cost meters beside the win**: indexes, replicas, pools and LSM compaction each show their price in a meter next to the gain; keep meters first-class.
- **Estimated vs actual** and **history diagrams** (dots and lines for linearizability): a few plans need small purpose-built chart types.
- **Failure injection and "crash now"**: the viewer must be able to trigger a failure at any beat and have the system recover correctly.
