# Data plans, part 2

Groups 5 to 8 of `catalog/data.md`, in catalog order, in the shared data language of parts 1 and 3:
a database is a cylinder with a few visible `key: value` rows, clients are small boxes on the left,
replication is rows streaming between copies, partitions are cylinders labelled by key range, and
a failure is a red flash, then the element greys out. Conventions this part adds: the leader wears
a crown; a replication log is a strip of numbered entries, and each copy wears a badge with the
last entry it applied; an out-of-date value is amber and a wrong one red; a client keeps a
"✓ saved" receipt for each acknowledged write, and the receipt turns red if that write is later
lost; histories are client lanes with each operation drawn as a bar from request to reply.

One technique is added to the vocabulary: **drag**, where the viewer moves something directly
(draws a cut across the network, slides a read along the timeline) and the diagram re-checks the
outcome live. It differs from **dial** (a number) and **choice** (picking what happens next).
`n-plus-one-queries` also uses **code trace** from scaling part 3.

## Replication and failover

### Leader-follower replication (`leader-follower-replication`)

**The aha**: One node takes every write and ships its change log, in order, to the followers. With only one writer there are no conflicts, and the price is that followers trail behind.
**Misconception to defeat**: That replicas are equal peers that each take writes, or that each holds part of the data. Every copy holds all the data, and only one accepts writes.
**Cast**: Three cylinders side by side: a "Leader" (gold outline, small crown) and two "Followers", each showing `ana: 100`, `ben: 40`, `cy: 7`. Under the leader, a change-log strip of numbered entries; on each follower, a badge "applied to #41". Clients on the left: two writers (pen icon) and three readers (eye icon). Arrows labelled "log" run from the leader to each follower.
**Opening frame**: Three identical cylinders, all badges at #41. Caption: "Three copies of the same data. Only one takes writes."
**Story**:

1. A writer sends `ben = 55` to the leader. The row updates and log entry "#42 ben=55" appears. Caption: "Every write goes to the leader."
2. Entry #42 travels down each log arrow; each follower applies it and its badge ticks to #42. Caption: "Followers replay the leader's log, in order."
3. The second writer aims `cy = 8` at a follower. The token bounces off with a "read-only" stamp and is redirected to the leader. Caption: "Followers refuse writes."
4. Slow motion: `cy = 8` and `cy = 9` reach the leader together. It slots them as #43 and #44; both followers apply #43 then #44 and end at `cy: 9`. A ghost follower applies the same two writes the other way round, ends at `cy: 8` in red, and fades. Caption: "One writer, one order, so every copy ends the same."
5. Read tokens fan out to all three copies. Caption: "Any copy can serve reads."
6. `ana = 120` lands as #45, and the token heading to follower 2 crawls. A reader at follower 2 gets `ana: 100` in amber. Caption: "The price: followers trail behind."

**The moment**: Beat 4. The ghost that applied the same two writes in the other order holds a different value; the real followers, replaying the leader's numbered log, can't. Spotlight the three logs lined up one above the other.
**Interaction**: Send a write to any node (followers redirect it). Slow follower 2 with a dial and watch it trail. Kill a follower and the others carry on; kill the leader and reads carry on but writes stop until a follower is promoted (`database-failover`).
**Ending**: All badges back at the same number with identical rows; loops.
**Variants**: `sync-vs-async-replication`, `replication-lag`, `read-replicas`, `database-failover`, `multi-leader-replication`, `leaderless-replication`; platform: RDS Multi-AZ standby vs read replicas (AWS), Azure SQL readable secondaries.
**Techniques**: contents, token, stream, restyle, spotlight, failure, dial, caption.
**Review**: Improved — beat 4 had nothing to contrast with, so "one writer decides the order" didn't land; a ghost follower now applies the same two writes in the other order and ends wrong. Killing the leader (writes stop, reads don't) added to the interaction as the bridge to failover.

### Synchronous vs asynchronous replication (`sync-vs-async-replication`)

**The aha**: Sync says "saved" only after a replica has the write, so nothing acknowledged is lost but every write waits. Async says "saved" at once and ships the change afterwards, so a crash can lose the last few writes.
**Misconception to defeat**: "Once the database says saved, my data is on every copy." With async, "saved" means saved on one machine.
**Cast**: Two panels side by side, "Synchronous" and "Asynchronous". Each has a client on the left with a stopwatch, a leader cylinder, and a replica cylinder further right (gap labelled "5 ms away"). Rows are orders: `#101: paid`. Under each panel, a timeline strip (time left to right) where two marks will land: "client told saved" and "replica has it".
**Opening frame**: Both panels identical, every copy holding `#101: paid`. Caption: "Same write, two ways to copy it."
**Story**:

1. Both clients send `#102: paid`; both leaders write it.
2. Sync: the client's hourglass spins while the row travels to the replica and "got it" comes back; only then does "✓ saved" reach the client (stopwatch 12 ms). Async: "✓ saved" returns at once (2 ms), and the row leaves for the replica afterwards. Caption: "Sync: saved on both. Async: saved on the leader."
3. On the timeline strips, sync's "replica has it" mark lands before "told saved"; async's lands after, and the gap between them shades red: "risk window".
4. Writes #103 to #105 stream in. Async acknowledges each fast; two rows are visibly in flight on the wire.
5. Both leaders crash: red flash, grey out, and each replica is promoted. Sync's replica has #103 to #105. On the async side the in-flight rows fade mid-wire, and the client's receipts for #104 and #105 turn red. Caption: "Acknowledged, then lost."
6. Sync's own failure: its replica stalls and greys out. The client's hourglass spins on and writes stop. Caption: "Sync: if the replica stalls, so do writes."

**The moment**: Beat 5, slowed. The async client holds receipts for rows that no longer exist anywhere; on the sync side every receipt matches a row.
**Interaction**: A "replica distance" dial (same rack 1 ms to another region 70 ms) stretches sync's stopwatch and async's risk window together. A "crash the leader" button works at any moment and counts the acknowledged writes lost.
**Ending**: Two scorecards: Sync "12 ms per write · 0 lost", Async "2 ms per write · 2 lost".
**Variants**: `replication-lag`, `database-failover`, `geo-replication`, `strong-vs-eventual-consistency`, `rpo-vs-rto` (reliability); semi-synchronous replication (one sync replica, the rest async).
**Techniques**: side by side, token, timer, lanes, failure, contents, dial, meter, caption.
**Review**: Keep — the receipts that outlive their rows (beat 5) are the memorable failure, sync's own stall (beat 6) keeps it a trade rather than a winner, and the numbers are consistent (5 ms away, 12 ms vs 2 ms). Weighed a single panel with a toggle; side by side is better because the two clocks run at once.

### Replication lag (`replication-lag`)

**The aha**: Lag grows under load, and it shows up as specific bugs users notice: their own write vanishes, data appears then disappears, an answer shows before its question.
**Misconception to defeat**: "Lag is just network latency, a few milliseconds nobody notices."
**Cast**: A leader cylinder holding comments; two followers, F1 and F2, positioned along a time ruler beneath them (seconds behind the leader), so lag is literally distance. A lag meter on each follower and a conveyor of log entries from the leader to each one. On the left, Ana with a phone showing what she sees.
**Opening frame**: F1 just behind the leader on the ruler, F2 slightly further. Caption: "Followers apply the leader's changes a little later."
**Story**:

1. A load spike: F2's meter climbs from 0.1 s to 4 s and F2 slides right along the ruler, stretching its conveyor. Caption: "Under load, milliseconds become seconds."
2. Ana posts "Nice!" to the leader and reloads; her read is routed to F2. Her comment is still riding F2's conveyor, and her phone shows nothing. Caption: "Your own write vanishes."
3. Ana refreshes twice: F1 answers (3 comments), then F2 (2 comments). Her phone's count goes 3, then 2. Caption: "Data appears, then disappears."
4. Below, two small shard pairs. Ben asks "Lunch?" (stored on a shard whose follower lags) and Cy replies "Yes!" (a shard whose follower is fresh). Dee's phone shows "Yes!" with nothing above it. Caption: "The answer arrives before the question."
5. Load drops; F2 slides back beside F1, and Ana's comment and Ben's question appear. Caption: "It catches up. Eventually."

**The moment**: Beat 2, slowed. Ana's read reaches F2 while her comment sits four seconds back on the conveyor. Spotlight the distance between where her write is and where her read looked.
**Interaction**: A load dial sets F2's lag. A "reload" button routes Ana's read to a random follower, so she sees her comment or not depending on luck and lag: the bug is intermittent and grows with lag.
**Ending**: Everything caught up, with three labels naming the fixes: read-your-writes, monotonic reads, consistent prefix reads.
**Variants**: `read-your-writes`, `read-replicas`, `causal-consistency`, `bounded-staleness`, `consumer-lag` (messaging).
**Techniques**: lanes, stream, meter, token, path trace, spotlight, contents, dial, caption.
**Review**: Keep — lag drawn as distance on a ruler makes "behind" literal, and each beat names one user-visible anomaly. Beat 4 correctly needs two shards (one ordered log keeps prefixes consistent), which is extra cast but true; the ending hands off cleanly to `read-your-writes`.

### Read replicas (`read-replicas`)

**The aha**: Read replicas multiply read capacity, not write capacity: every write still lands on the primary and is replayed on every replica, and a replica's answer may be slightly old.
**Misconception to defeat**: "Add replicas to scale the database", writes included. Also, a read replica mistaken for the standby that takes over in a failover.
**Cast**: A primary cylinder (product rows `sku 1: $10`) with a load meter. Clients on the left send blue read tokens (eye icon) and orange write tokens (pen icon) through a router. Empty slots to the right for replicas, each with a load meter. Bottom right, a small chart of read capacity and write capacity against the number of replicas.
**Opening frame**: The primary alone at 95%, blue tokens queuing in front of it. Caption: "Nine reads for every write, and one server drowning."
**Story**:

1. Replica 1 appears as a clone of the primary and rows stream across. The router sends half the blue tokens to it; the primary drops to 60%. Caption: "A replica takes reads."
2. Replicas 2 and 3 appear. Reads spread over four nodes, the primary falls to 30%, and the chart's read line climbs. Caption: "Each replica adds read capacity."
3. Writes increase. Every orange token goes to the primary, then fans out as three replay arrows, and each replica's meter rises with it. Caption: "Writes don't spread. Every replica replays every write."
4. Replica 4 is added: the read meters fall, the primary's write load doesn't move, and the chart's write line stays flat.
5. `sku 1 = $12` lands on the primary; a read hits replica 3 before the row arrives and returns `$10` in amber. Caption: "And an answer may be a moment old."
6. A dashed cylinder appears beside the primary, taking the stream but no reads. Caption: "A standby is for failover, not for load."

**The moment**: Beat 4. A replica is added and only the read side responds; the flat write line beside the rising read line makes it unmistakable.
**Interaction**: An "add replica" button and a write-share dial (10% to 70%). For read-heavy traffic replicas help a lot; for write-heavy traffic almost nothing changes.
**Ending**: The chart alone: read capacity rising, write capacity flat. Caption: "Replicas scale reads. Sharding scales writes."
**Variants**: `leader-follower-replication`, `replication-lag`, `read-your-writes`, `database-sharding`, `scaling-reads-vs-writes` (scaling); platform: RDS read replicas vs Multi-AZ standby (AWS), Azure SQL readable secondaries.
**Techniques**: clone, appear, token, stream, meter, chart, dial, contents, caption.
**Review**: Keep — the read line climbing beside a flat write line is the whole idea in one picture, and the write-share dial lets viewers find where replicas stop helping. Both misconceptions are defeated on screen (writes replayed everywhere; the standby that takes no reads).

### Multi-leader replication (`multi-leader-replication`)

**The aha**: When every region accepts writes, writes are fast and local everywhere, but the same record can now change in two places at once, so a conflict rule is mandatory.
**Misconception to defeat**: "Multi-leader is leader-follower with more leaders: more capacity, no new problems."
**Cast**: Two region boundaries, "Europe" and "US East", each with a leader cylinder and its own local clients. A long link between them labelled "80 ms round trip". One shared row: `doc title: "Draft"`. Beneath, one timeline lane per region (time left to right) with writes as dots.
**Opening frame**: Two leaders, both showing `title: Draft`. Caption: "Two leaders, one per region. Both accept writes."
**Story**:

1. A European client writes `title: Plan`. Its local leader acknowledges in 3 ms; the change then crosses the ocean, visibly slowly, and the US applies it. Caption: "Writes are local and fast. The other region hears later."
2. A brief ghost of single-leader, with the only leader in US East: the same European write has to cross the ocean and back, and the stopwatch reads 85 ms. Caption: "With one leader, half the world waits."
3. Europe writes `title: Plan A` while the US writes `title: Plan B`; two dots land at the same point on the lanes. Both leaders acknowledge locally.
4. Slow motion: the two changes cross mid-ocean, passing each other.
5. Each region applies the incoming write over its own. Europe ends with "Plan B", the US with "Plan A". Both rows flash amber. Caption: "Same record, changed in two places. Who wins?"
6. A "conflict rule" box appears between the regions (here: last write wins). Both rows settle on "Plan B"; "Plan A" drops beside the US leader, tagged "discarded". Caption: "Every multi-leader system needs a conflict rule."

**The moment**: Beats 4 and 5. The two writes cross in slow motion and each region ends up holding the other's value: the copies have swapped instead of agreeing.
**Interaction**: A "write in both regions at once" button, and a link-latency dial. The overlap window in which writes conflict is shaded on the lanes; it widens with distance, so conflicts get more likely.
**Ending**: Converged rows with the discarded write still lying beside them. Caption: "Fast everywhere, and conflicts are now your problem."
**Variants**: `write-conflict-resolution`, `leaderless-replication`, `geo-replication`; offline-first apps (each device is a leader); platform: Cosmos DB multi-region writes (Azure), DynamoDB global tables (AWS).
**Techniques**: boundary, token, timer, lanes, side by side, restyle, spotlight, dial, caption.
**Review**: Improved — the link is now labelled "80 ms round trip" and the single-leader ghost reads 85 ms (it had counted the crossing twice, 160 ms, and disagreed with `geo-replication`). The rest stays: two writes crossing mid-ocean and leaving each region with the other's value is the sharpest picture of a conflict.

### Leaderless replication (`leaderless-replication`)

**The aha**: With no leader, a write goes to several replicas at once and a read asks several; consistency comes from overlapping sets plus repair, and there is nothing to fail over because no node is special.
**Misconception to defeat**: "Some node must be in charge", or that leaderless is the same as multi-leader (many leaders that each own the write and copy it on).
**Cast**: Three equal replica cylinders, R1, R2, R3, in a row, none with a crown. Each row carries a version: `cart: [book] v1`. A client on the left with a line to each replica and an ack counter. Top right, a small inset of a leader-follower pair for contrast.
**Opening frame**: Three identical cylinders, all at v1. Caption: "No leader. The client talks to the replicas directly."
**Story**:

1. The client writes `cart: [book, pen] v2`; three tokens fan out at once. R1 and R2 acknowledge; R3 is down (greyed) and misses it. The counter reads "2 of 3 ✓". Caption: "Write to all, succeed when enough answer."
2. R3 comes back, still holding v1 in amber. Caption: "R3 missed the write. Nobody told it."
3. A read asks all three. Answers come back v2, v2, v1; the client keeps the highest version. Caption: "Read from several. Newest version wins."
4. The client sends v2 back to R3, which updates. Caption: "Read repair: the reader fixes the stale copy."
5. In the background, R1 and R3 compare fingerprints of their rows and sync a key nobody has read. Caption: "Anti-entropy repairs what nobody reads."
6. R1 fails (red flash, greys out). Reads and writes carry on with R2 and R3 without a pause. In the inset, killing the leader stops writes while a new one is elected. Caption: "No failover. Nothing special died."

**The moment**: Beat 6, as a contrast: the same failure stops the leader-follower inset while the leaderless row doesn't skip a beat.
**Interaction**: Click any replica to kill or revive it, and send writes and reads. As long as enough replicas answer, reads return the newest value, and the viewer watches repairs happen.
**Ending**: All three at v2, still no crown anywhere. Caption: "No leader to lose."
**Variants**: `quorum-reads-writes`, `write-conflict-resolution`, `multi-leader-replication`, `consistent-hashing`, `wide-column-store`.
**Techniques**: token, contents, failure, restyle, exchange, side by side, choice, caption.
**Review**: Keep — the crownless row beside a leader-follower inset makes "nothing special to lose" a direct contrast, and read repair and anti-entropy each get one beat showing who fixes what. Technically sound (versions, repair, no election); the overlap arithmetic is rightly left to `quorum-reads-writes`.

### Quorum reads and writes (`quorum-reads-writes`)

**The aha**: With N copies, if each write reaches W of them and each read asks R of them, and W + R > N, the two sets must overlap, so every read reaches at least one copy with the latest write.
**Misconception to defeat**: That a quorum is a majority vote that decides the truth, or that reading from 2 of 3 is luck. It's arithmetic: the sets can't avoid each other.
**Cast**: Three replica cylinders, A, B, C, each `x: 5 (v7)`. A client on the left. The write set is drawn as orange rings, the read set as blue rings. Top: "N = 3, W = 2, R = 2" and "W + R = 4 > 3 ✓". Small meters: write latency, read latency, failures tolerated.
**Opening frame**: Three cylinders at v7 with the formula above. Caption: "Three copies. Write to two, read from two."
**Story**:

1. The client writes `x = 9 (v8)`. A and B get it (orange rings); C is slow and doesn't. Acknowledged at two.
2. A read asks B and C (blue rings). B returns v8, C returns v7; the client keeps v8. B, ringed in both colours, glows. Caption: "The read and write sets share a copy."
3. The blue rings slide through every possible pair: A+B, A+C, B+C. Each pair contains A or B, and the shared copy glows every time. Caption: "Any two of three overlap any other two."
4. The dials drop to W = 1, R = 1; the formula turns red. A write reaches only A; a read asks only C and returns v7 in amber. Caption: "No overlap, no guarantee."
5. W = 3, R = 1: writes wait for the slowest copy and fail if any is down; reads are fast. Then W = 1, R = 3: the reverse. The meters swing. Caption: "W and R trade write speed against read speed."
6. Two writes land concurrently on overlapping sets; a read returns two versions, flagged amber. Caption: "Overlap doesn't settle concurrent writes or sloppy quorums."

**The moment**: Beat 3. The read set sweeps through every position and can never escape the write set: a pigeonhole argument, shown.
**Interaction**: Dials for N (3 to 5), W and R; click a replica to kill it; a "read" button picks replicas at random. With W + R > N every read is fresh; without it some are stale; each setting shows how many failures it survives.
**Ending**: Back to N = 3, W = 2, R = 2 with the overlap glowing. Caption: "The overlap is the whole trick."
**Variants**: `leaderless-replication`, `consensus-raft-paxos`, `strong-vs-eventual-consistency`; Cassandra consistency levels (ONE, QUORUM, ALL).
**Techniques**: dial, boundary, spotlight, contents, token, meter, failure, caption.
**Review**: Keep — sweeping the read set through every pair and watching it never escape the write set proves the pigeonhole argument instead of asserting it; the maths (W + R > N, failures tolerated) is right, and beat 6 honestly marks where the guarantee ends.

### Write conflict resolution (`write-conflict-resolution`)

**The aha**: Last-write-wins keeps the write with the later timestamp and silently throws the other away, trusting clocks that drift. Detecting the conflict and merging, or using a CRDT, keeps everyone's change.
**Misconception to defeat**: "The database sorts conflicts out properly, and the write that really happened later wins."
**Cast**: Two writable replicas, "Phone" and "Laptop", each holding `list: [milk]`, each with a wall clock; the laptop's clock carries a "+3 s fast" tag. A true-time ruler along the bottom. Later, three result panels side by side: "Last write wins", "Detect and merge", "CRDT".
**Opening frame**: Both copies `[milk]`, clocks visible, the link between them dashed (disconnected). Caption: "Two copies, both writable, briefly cut off."
**Story**:

1. The laptop adds bread at true time 12:00:01; its fast clock stamps it 12:00:04. A dot lands on the ruler.
2. The phone adds eggs at true time 12:00:02, stamped 12:00:02. Its dot lands later on the ruler. Caption: "Eggs really happened second."
3. Reconnect; both versions meet in the middle. Last write wins compares stamps, 12:00:04 beats 12:00:02, and keeps `[milk, bread]`. `[milk, eggs]` drops into a bin with no error raised. Caption: "Last write wins, by a clock that was wrong."
4. Detect and merge: each version carries a version vector, `{phone 1, laptop 0}` and `{phone 0, laptop 1}`. Neither includes the other, so both are kept as "concurrent" siblings, then merged into `[milk, bread, eggs]`. Caption: "Notice the conflict, then merge."
5. CRDT: the list is a set that merges by union. The two changes are applied in both orders on two mini-copies, and both end at `[milk, bread, eggs]`. Caption: "A CRDT merges the same way in any order."

**The moment**: Beat 3, slowed. The eggs fall into the bin silently, while the ruler shows they were the later write.
**Interaction**: A laptop clock-skew dial (minus 5 s to plus 5 s). Last write wins flips which write it keeps as the dial moves; the merge and CRDT results never change. A choice of strategy replays the reconnect.
**Ending**: Three panels side by side: `[milk, bread]` with eggs in red, and `[milk, bread, eggs]` twice. Caption: "Last write wins is simple because it throws work away."
**Variants**: `multi-leader-replication`, `leaderless-replication`, `lost-update`, `optimistic-vs-pessimistic-locking`; platform: Cosmos DB conflict resolution policies (Azure), DynamoDB global tables (AWS).
**Techniques**: side by side, timer, lanes, contents, token, disappear, dial, choice, caption.
**Review**: Keep — a fast laptop clock making last-write-wins bin the write that really came second is the most memorable failure available, and the skew dial shows LWW always discards one write while merge and CRDT never change. Version vectors and the set-union CRDT are stated correctly.

### Database failover (`database-failover`)

**The aha**: Failover is a bet made on a timeout: too short causes needless failovers, too long means downtime. With async replication, the promoted replica may also be missing writes clients were told were saved.
**Misconception to defeat**: "Failover is instant and lossless: the replica simply takes over." Also confused with restoring from a backup.
**Cast**: A primary cylinder with a crown and a replica beside it, joined by an async stream with a few rows in flight. Clients on the left reach the primary through an endpoint box `db.prod`. A watchdog receives heartbeat pulses from the primary and has a timeout ring (30 s). A downtime counter and a "writes lost" counter.
**Opening frame**: The primary serving, heartbeats pulsing, the replica a couple of rows behind. Caption: "A primary, a replica, and a watchdog listening for heartbeats."
**Story**:

1. The primary crashes: red flash, greys out. Heartbeats stop, client requests return red errors, and the downtime counter starts.
2. The watchdog's timeout ring fills, fast-forwarded but visible. Caption: "Dead, or just slow? Wait out the timeout."
3. The ring completes. The crown moves to the replica, and the `db.prod` arrow swings from the old primary to it. Requests succeed again; downtime stops at 35 s. Caption: "Promote the replica, point clients at it."
4. Spotlight: the two rows that were in flight vanished with the primary. The clients' "✓ saved" receipts for them turn red; "writes lost: 2". Caption: "Acknowledged writes can be lost."
5. Reset with a 2 s timeout. The primary pauses briefly (amber, heartbeats skip). The watchdog fails over anyway; then the old primary wakes up still wearing its crown. Caption: "Too short: failovers for a hiccup, and a second leader."

**The moment**: Beat 4. The new primary's rows sit next to the clients' receipts, and two receipts have no matching row.
**Interaction**: A "kill primary" button, a timeout dial (1 to 60 s), a "hiccup" button (pause the primary for 5 s), and a sync/async toggle. The viewer finds the timeout trade-off for themselves and sees lost writes drop to zero with sync.
**Ending**: The replica crowned, the old primary grey and tagged "rebuild as replica", counters showing downtime and writes lost. Caption: "Failover buys uptime with a timeout, and maybe some data."
**Variants**: `split-brain`, `sync-vs-async-replication`, `consensus-raft-paxos`, `backup-vs-replication`, `failover`, `automatic-vs-manual-failover`, `heartbeat-failure-detection`, `rpo-vs-rto` (reliability); platform: Azure SQL failover groups, RDS Multi-AZ (AWS).
**Techniques**: failure, timer, move, token, meter, spotlight, dial, toggle, caption.
**Review**: Keep — the two receipts with no matching row are the failure people don't expect, the timeout dial makes both costs discoverable, and beat 5 hands off to `split-brain` without explaining it. Numbers hang together (30 s timeout, 35 s downtime).

### Split brain and fencing (`split-brain`)

**The aha**: A node can't tell "the others are dead" from "I'm cut off", so it may lead only with a majority behind it, and storage must turn away a deposed leader by checking a fencing token.
**Misconception to defeat**: "If I can't reach the leader, the leader is dead", so it's safe to take over.
**Cast**: Three nodes in a triangle, A (crown, badge "token 1"), B and C, joined by network lines, each with a thought bubble. A shared storage cylinder below, reachable by all three, with `seat 12A: free` and a note "highest token seen: 1". Clients on the left, some reaching A, some reaching B and C, each keeping its receipts.
**Opening frame**: A leading with its crown, every link healthy. Caption: "One leader, holding the right to write."
**Story**:

1. The network splits: the lines between A and the others turn dashed red. A's bubble says "B and C died?"; B's and C's say "A died?". Caption: "Same silence, opposite stories."
2. Without protection: B and C elect B, and a second crown appears while A keeps its own. A client through A books `seat 12A: Ana` and gets "✓"; a client through B books it for Ben and gets "✓", and the row flips to Ben. Ana's receipt turns red. Caption: "Two leaders, two ✓ for one seat: split brain."
3. Rewind, majority rule on. A can count only itself, 1 of 3: its crown comes off and it refuses writes. B gathers 2 of 3 and is crowned with token 2. Caption: "Only a majority may lead."
4. Rewind once more. This time A froze (a pause icon: a long garbage-collection stall) just before the split, so it never counted anything. It wakes still crowned and sends a write carrying token 1. Storage, which has seen token 2 from B, stamps it "stale token, rejected". Caption: "A paused leader doesn't know it was replaced. The token does."
5. The network heals; A rejoins as a follower and learns token 2.

**The moment**: Beat 2 against beat 3: two crowns and a red receipt, then the same split replayed with majority voting, where A's crown is forced off.
**Interaction**: The viewer draws a cut anywhere across the network lines: only a side holding 2 of 3 keeps a leader, and with all three cut apart nobody leads. A "majority rule" toggle brings split brain back; a "freeze the leader" button triggers the fencing check.
**Ending**: One crown, one booking, storage showing "highest token: 2". Caption: "A majority to lead, a token to fence the old leader out."
**Variants**: `consensus-raft-paxos`, `database-failover`, `leader-election` (leases) and `heartbeat-failure-detection` (reliability); a two-node cluster needs a third "witness" vote to have a majority at all.
**Techniques**: boundary, failure, restyle, token, contents, toggle, drag, spotlight, caption.
**Review**: Improved — beat 2 now shows the double booking concretely (both leaders write one shared row, it flips to Ben, Ana's ✓ turns red); beat 4 is a separate rewind in which A was paused and never counted votes, the one case majority voting can't catch, so fencing is motivated instead of tacked on. Borrowed from reliability's plan: the three-way cut where nobody leads, and the witness for two-node clusters.

### Consensus (Raft, Paxos) (`consensus-raft-paxos`)

**The aha**: Any two majorities share at least one node, so two leaders can never both commit. With 2f+1 nodes the group survives f failures and keeps a single agreed log.
**Misconception to defeat**: "Consensus means every node must agree, or be up." Also confused with quorum reads and two-phase commit.
**Cast**: Five servers in a ring, S1 to S5, each with a log strip of cells beneath it (`x=1`, `y=2`, `z=3`). The leader has a crown and a term number. Each follower has a small election timer ring. A counter: "acks: 0 of 5, need 3".
**Opening frame**: S1 leading in term 3, all five logs identical. Caption: "Five servers keep one shared log."
**Story**:

1. A client sends `x = 4` to S1. S1 appends it as a hollow cell and sends it out. S2 and S3 acknowledge; S4 and S5 are slow. At 3 of 5 the cell fills solid. Caption: "Committed once a majority has it."
2. S1 fails: red flash, greys out. S4, which missed `x = 4`, times out first and asks for votes. S5 says yes; S2 and S3 refuse, "my log is newer". 2 of 5: no crown. Caption: "A server missing committed entries can't win."
3. The commit majority {S1, S2, S3} is shaded. Then each majority S4 could gather from the servers still up, {S4, S5, S2} and {S4, S5, S3}, is shaded in turn: every one contains S2 or S3, the very servers refusing. Caption: "Any two majorities share a server."
4. S2 times out, asks, and wins with S3 and S4: crown, term 4. Its log still holds `x = 4`.
5. S1 returns as a follower. A cut isolates S4 and S5: S1, S2 and S3 keep committing, while S5 starts an election and tops out at 2 votes. Caption: "A minority can't elect a leader or commit anything."
6. The cut heals. Servers then fail one at a time: with two down, three remain and progress continues; at the third, writes stall behind an hourglass, but nothing wrong is committed. Caption: "Five servers survive two failures. Then they stop rather than lie."

**The moment**: Beat 3. However S4 draws its majority, it overlaps the commit majority, and the overlap is exactly where the committed entry lives and where the stale candidate is turned away (the same sweep as `quorum-reads-writes`).
**Interaction**: Click servers to kill or revive them, draw cuts across the ring, and set the cluster size (3, 4, 5, 7). A counter shows failures tolerated, revealing that four servers survive only one failure, the same as three.
**Ending**: One crown, identical committed logs. Caption: "Majorities overlap, so history has one version."
**Variants**: `split-brain`, `quorum-reads-writes`, `two-phase-commit`, `distributed-sql`, `leader-election` (reliability); etcd in the Kubernetes control plane.
**Techniques**: contents, token, timer, restyle, boundary, spotlight, failure, drag, dial, meter, caption.
**Review**: Improved — beat 3 shaded "the majority S4 needed" as if it were one fixed set; it now sweeps every majority S4 could gather, each containing S2 or S3, which is the actual argument and matches the quorum plan's sweep. Raft details checked (votes refused to a less up-to-date log, terms, a minority can't elect, four servers tolerate one failure).

### Geo-replication (`geo-replication`)

**The aha**: A copy in another region survives the loss of a whole region and serves nearby users, but the distance forces a choice: wait for the far copy on every write, or risk losing the last writes on failover.
**Misconception to defeat**: "Geo-replication is zone redundancy, just further away", or "the geo copy is my backup."
**Cast**: A faint map with two region boundaries, "East US" (primary cylinder plus two small zone copies inside it) and "West Europe" (secondary cylinder). Rows stream across the ocean along a link labelled "80 ms round trip". A user figure on each continent with a stopwatch. A sync/async toggle.
**Opening frame**: Both regions holding data, rows streaming eastward with a visible delay. Caption: "A second copy, a whole region away."
**Story**:

1. One zone in East US fails (red flash); the other zones carry on. Then the whole East US boundary flashes red and greys out, zone copies included, and West Europe is promoted to serve both users. Caption: "Zones survive a datacenter. Only another region survives a region."
2. Rewind to just before the failure, split into two panels. Async: writes acknowledged in 5 ms, about a second's worth of rows on the ocean link. Sync: each write waits the 80 ms round trip, and the link carries nothing unconfirmed.
3. East US dies in both panels. Async's in-flight rows blink out and their receipts turn red: "last ~1 s of writes lost". Sync's copy has everything. Caption: "Slow writes, or possible loss. Distance makes you choose."
4. The European user reads from West Europe: 5 ms instead of 85 ms, slightly behind. Caption: "And reads come from next door."
5. A `DROP TABLE` in East US streams across and empties West Europe too. Caption: "It copies mistakes. It isn't a backup."

**The moment**: Beat 3: the same instant in both panels, one link empty and safe, the other carrying rows that vanish, with the stopwatches showing what each paid.
**Interaction**: The sync/async toggle, a distance dial (neighbouring regions 10 ms to the far side of the world 250 ms), and a "lose East US" button. Sync's write latency balloons with distance; async's loss window widens.
**Ending**: West Europe serving both users; scoreboard: async "5 ms writes, ~1 s lost", sync "85 ms writes, 0 lost". Caption: "Across regions, most systems choose async and accept the window."
**Variants**: `storage-redundancy-levels`, `sync-vs-async-replication`, `database-failover`, `backup-vs-replication`, `multi-region-deployment` and `rpo-vs-rto` (reliability); platform: Azure SQL active geo-replication and failover groups, GRS and RA-GRS (Azure), Aurora Global Database and DynamoDB global tables (AWS).
**Techniques**: boundary, stream, failure, side by side, toggle, timer, dial, caption.
**Review**: Improved — the zone failure and the promotion merged into one beat, the lost writes now use the area's red receipts, and the ending says which way real systems usually choose (async; Azure SQL geo-replication, GRS and Aurora Global Database all are). Kept the `DROP TABLE` beat because "the geo copy is my backup" is the stated misconception.

## Consistency models and trade-offs

### CAP theorem (`cap-theorem`)

**The aha**: Network partitions will happen, so the real choice is what each side does during one: refuse some requests to stay consistent, or answer with possibly stale data to stay available.
**Misconception to defeat**: "Pick any two of three", as if you could take consistency and availability and opt out of partitions. Also, CAP's C is not ACID's C.
**Cast**: Two replica cylinders, "Toronto" and "Vancouver", joined by a network line, each holding `seats left: 1` (the last concert seat). Two client figures on the left: Ana, connected to Toronto, and Ben, connected to Vancouver. At the end, a C-A-P triangle.
**Opening frame**: Both copies at 1, the link healthy. Caption: "Two copies of the same data, kept in step over a network."
**Story**:

1. Ana buys at Toronto; the change streams to Vancouver and both show 0. Reset to 1. Caption: "With the network up, you get both: correct and available."
2. The link is cut: red flash, then dashed. Caption: "Then the network splits. It will."
3. Ben asks Vancouver for the seat. Vancouver can't reach Toronto. At this instant the screen splits into two panels.
4. Left, "Choose consistency": Toronto, which holds the primary copy, sells to Ana; Vancouver can't check with it, so it tells Ben "Can't confirm, try later", a red token. Caption: "Refuse, and stay correct."
5. Right, "Choose availability": Vancouver sells to Ben with "✓" while Toronto sells to Ana with "✓". Each copy shows 0 and each thinks it sold the last seat. Caption: "Answer, and risk being wrong."
6. The link heals. Left: Vancouver catches up, and Ben's retry gets an honest "sold out". Right: the copies compare notes, find two receipts for one seat, and one receipt turns red: "refund".
7. The C-A-P triangle appears; the C-A edge fades with the note "only if the network never fails". Caption: "C here means every read sees the latest write. Not ACID's C."

**The moment**: Beats 4 and 5: the same request at the same instant, answered with an error on one side and with a confident, wrong "✓" on the other.
**Interaction**: The viewer cuts the network, chooses "refuse" or "answer anyway" for Vancouver, sends Ben's request, then heals the link to see what the choice cost.
**Ending**: Both outcomes side by side. Caption: "During a partition, be right or be up. Otherwise, CAP says nothing."
**Variants**: `pacelc`, `strong-vs-eventual-consistency`, `linearizability`, `split-brain`, `acid-transactions` (the other C).
**Techniques**: failure, boundary, side by side, choice, token, contents, restyle, caption.
**Review**: Improved — the consistent panel left Ana's purchase out, which made consistency look free; now Toronto sells to Ana there too, so after healing Ben gets an honest "sold out" on one side and a refund on the other. He loses the seat either way; the difference is being told the truth. Weighed a bank-balance framing; the last concert seat is more vivid and makes "available" visibly mean "confidently wrong".

### PACELC (`pacelc`)

**The aha**: Even when nothing is broken, consistency costs latency: replicas must coordinate on every request, so you pay for strong consistency all the time, not only during partitions.
**Misconception to defeat**: "CAP covers it. With no partition, you get consistency and speed for free."
**Cast**: The CAP scene again: Toronto and Vancouver replicas 60 ms apart, their link green throughout. A decision tree across the top: "Partition?", yes: "Availability or Consistency", else: "Latency or Consistency". A client on the left with a stopwatch. Below, two small latency charts side by side, "Consistent" and "Fast".
**Opening frame**: The tree above the healthy link. Caption: "CAP covers the rare bad day. What about every other day?"
**Story**:

1. The "yes" branch lights: the link cuts and the CAP choice replays in miniature, then the link heals. The "else" branch lights. Caption: "No partition. Still a choice."
2. Consistent write: Toronto receives `x = 5` and waits while it travels to Vancouver and back before replying. Stopwatch 65 ms. Caption: "Consistent: wait for the other copy. Every time."
3. Fast write: Toronto replies at once, 5 ms, and the change follows. A reader at Vancouver 20 ms later gets the old `x`, in amber. Caption: "Fast: answer now. The other copy catches up."
4. A hundred requests run. The consistent chart sits flat at 65 ms; the fast chart at 5 ms, with a stale-read counter ticking beside it. The link stays green throughout. Caption: "Nothing is broken, and you pay on every request."
5. A 2×2 grid appears: rows PA and PC, columns EL and EC, with examples: PA/EL "Cassandra, Dynamo-style stores"; PC/EC "Spanner, etcd".

**The moment**: Beat 4: two charts running side by side under a green link. The consistency tax is constant, not something that only appears in an outage.
**Interaction**: A distance dial (same city 1 ms to across an ocean 150 ms) lifts the consistent chart and leaves the fast one alone; a toggle sends the same request either way.
**Ending**: The 2×2 grid. Caption: "If Partitioned: Availability or Consistency. Else: Latency or Consistency."
**Variants**: `cap-theorem`, `strong-vs-eventual-consistency`, `sync-vs-async-replication`, `geo-replication`; platform: Cosmos DB consistency levels (Azure), Spanner (Google Cloud).
**Techniques**: side by side, chart, timer, token, toggle, dial, restyle, caption.
**Review**: Keep — two latency charts running under a green link make the "else" branch impossible to miss, the distance dial shows the tax scaling with distance, and the 2×2 examples match Abadi's classification (Dynamo-style PA/EL, Spanner PC/EC). Builds directly on the CAP scene.

### Strong vs eventual consistency (`strong-vs-eventual-consistency`)

**The aha**: Strong means that once a write is acknowledged, every reader sees it. Eventual means the copies agree some time after writes stop, with no deadline, so a read can be stale for any length of time: fine for a like count, dangerous for a balance.
**Misconception to defeat**: "Eventually means a few milliseconds, so it's harmless." Also confused with weak isolation levels, which are about concurrent transactions, not copies.
**Cast**: Two panels side by side. Left, "Likes": three replica cylinders with `likes: 41`. Right, "Balance": three replica cylinders with `balance: $100`. Clients on the left. Under each panel, a lane (time left to right) with reads and writes as dots, and a "stale for" timer.
**Opening frame**: Both panels with every copy agreeing. Caption: "Write once. When does every copy show it?"
**Story**:

1. Strong mode, balance panel: Ana withdraws $100. The write reaches the copies before "✓" comes back. Every read after the ✓, at any copy, returns $0: green dots on the lane. Caption: "Strong: after the ✓, nobody sees the old value."
2. Eventual mode: the same write is acknowledged by one copy and spreads afterwards. A read at the third copy just after the ✓ returns $100 in amber, and the "stale for" timer starts. Caption: "Eventual: the copies agree, eventually."
3. The third copy slows under load and the timer runs on: 0.3 s, 5 s, 40 s. Caption: "Eventually has no deadline."
4. Both panels during the staleness. Likes: a reader sees 41 instead of 42, a shrug, nothing breaks. Balance: Ana withdraws again through the stale copy, which still shows $100; the merged result is −$100, in red. Caption: "Fine for likes. Dangerous for money."
5. Writes stop; every copy converges and the timers stop.

**The moment**: Beat 4: the same kind of stale read in both panels, harmless on the left and an overdraft on the right.
**Interaction**: A strong/eventual toggle, a replica-delay dial, and a "read now" button that picks a random copy. With eventual, stale reads come and go with the delay; with strong they never appear, and every write's stopwatch runs longer.
**Ending**: Both panels converged, labelled "strong: always current, slower" and "eventual: fast, sometimes old". Caption: "Choose per piece of data."
**Variants**: `linearizability`, `read-your-writes`, `bounded-staleness`, `causal-consistency`, `cap-theorem`, `isolation-levels` (the common confusion); platform: Cosmos DB's five consistency levels (Azure), S3 strong read-after-write (AWS).
**Techniques**: side by side, toggle, timer, lanes, token, contents, dial, restyle, caption.
**Review**: Keep — the same stale read shown harmless (likes) and costly (an overdraft) answers "when does it matter?", and the "stale for" timer running to 40 s defeats "eventually means milliseconds". Weighed a single-panel version; it loses the per-data choice the ending asks for.

### Linearizability (`linearizability`)

**The aha**: The system behaves as if there were one copy and every operation took effect at a single instant during its call. Once anyone has seen the new value, nobody can see the old one again.
**Misconception to defeat**: That careful replication automatically makes reads current, and the mix-up with serializability, which is about transactions rather than one value in real time.
**Cast**: A history diagram: three horizontal client lanes, A (writer), B and C (readers), with real time running left to right. Each operation is a bar from request to reply, labelled `write x=1`, `read → 1`, `read → 0`. Above, three replica cylinders, R1 to R3, each `x: 0`. A vertical "now" line sweeps to the right.
**Opening frame**: Empty lanes and three replicas at 0. Caption: "Three clients. Time runs left to right. Each bar is one request, from send to reply."
**Story**:

1. A's long `write x=1` bar starts. As the now-line moves, R1 changes to 1; R2 and R3 haven't yet.
2. B reads from R1 during A's write and gets 1. B's bar ends.
3. After B's bar has ended, C reads from R3 and gets 0. The bar flashes red. Caption: "C saw the old value after B saw the new one."
4. A dot is placed in each bar where the operation "really happened". The write's dot must come before B's, because B saw 1; C's must come after B's, because C started after B finished; but C read 0, so its dot must come before the write's. The line through the dots is forced to double back, drawn in red. Caption: "No single-copy story fits."
5. Replay on a linearizable system: before B's read returns 1, it makes sure a majority holds 1 (R2 updates too). C's read asks a majority, which must include a copy with 1, and returns 1. The dots now sit write, B, C in order, and one straight line runs through them. Caption: "As if there were one copy, changing at one instant."
6. Why it matters: a lock row says "owner: Ana". On the broken system a second node reads "free" and takes the lock too. Caption: "Locks, leader election and unique usernames depend on this."

**The moment**: Beats 4 and 5: the line through the dots doubling back in red, then running straight in green.
**Interaction**: The viewer drags C's read bar along the time axis and picks which replica it hits; the diagram checks live, showing a straight green line when a single-copy order exists and a red zig-zag when none does. The rule becomes visible: overlapping operations may fall either way, but an operation that starts after another has finished can never see older data.
**Ending**: The clean history with its straight line. Caption: "Once anyone sees the new value, everyone does."
**Variants**: `serializability` (the contrast), `sequential-consistency`, `strong-vs-eventual-consistency`, `consensus-raft-paxos`, `split-brain`; platform: Spanner external consistency (Google Cloud).
**Techniques**: lanes, contents, restyle, path trace, drag, choice, spotlight, caption.
**Review**: Improved — beat 5's fix was wrong: with only R1 holding 1, a majority read of R2 and R3 still returns 0. The replay now has B's read write 1 back to a majority before answering (the ABD approach), so C's majority read must overlap it; that is a real linearizable read and reuses the quorum overlap. The dots-and-line history check is kept: it is the clearest way to show "no single-copy order exists".

### Sequential consistency (`sequential-consistency`)

**The aha**: All clients see all operations in one agreed order that keeps each client's own order, but that order can run behind real time: the same story for everyone, possibly late.
**Misconception to defeat**: "If everyone agrees on the order, everyone must be up to date." That's linearizability.
**Cast**: The history diagram from linearizability: client lanes A, B, C, D with real time left to right and operations as bars. Above, an "agreed order" strip: one row of cards that every client reads from, with a marker per client showing how far along it is.
**Opening frame**: The lanes, an empty strip, and four markers at its start. Caption: "Everyone reads the same story. Not necessarily on the same page."
**Story**:

1. A writes `x=1`, then `x=2` (two bars on A's lane). Cards "x=1" and "x=2" append to the strip in that order.
2. B reads at time 5 and gets 2; its marker is past both cards. C reads at time 6, later in real time, and gets 1; its marker sits between them. A faint red "not linearizable" ghost appears and fades. Caption: "C is behind B in time, but reading the same story."
3. The bars lift off the lanes and slide into one line: `x=1`, C's read, `x=2`, B's read. A's own order is kept; a green tick. Caption: "One order everyone agrees on, keeping each client's own order."
4. A new history: A writes `y=1` while B writes `y=2`. C reads 1 then 2; D reads 2 then 1. The cards try to form one line and can't; they turn red. Caption: "What's forbidden is disagreeing about the order."
5. A three-rung ladder: linearizable ("one story, on time"), sequential ("one story, maybe late"), causal ("related events in order"). The middle rung glows.

**The moment**: Beat 3: the bars lift off real time and fall into a single line where C's read comes before `x=2`, though it happened after it. The clock order bends; the story order holds.
**Interaction**: A "must respect real time" toggle. The same history turns red with it on (linearizable) and green with it off (sequential): the only difference between the two models is the clock.
**Ending**: The ladder with the middle rung lit. Caption: "Same story for everyone. The story may run behind the clock."
**Variants**: `linearizability`, `causal-consistency`, `strong-vs-eventual-consistency`.
**Techniques**: lanes, move, contents, toggle, restyle, layers, spotlight, caption.
**Review**: Keep — bars lifting off real time into one agreed line, and the "must respect real time" toggle flipping the same history red and green, isolate the single difference from linearizability. Both histories are correct (beat 2 sequential but not linearizable; beat 4 forbidden because C and D disagree on the order).

### Causal consistency (`causal-consistency`)

**The aha**: If one operation could have caused another, as a reply is caused by its question, everyone sees them in that order; unrelated operations may appear in any order. It's the strongest model that can stay available during a network partition.
**Misconception to defeat**: "If you want availability, eventual consistency is all you get", or that causal is another word for eventual.
**Cast**: A chat app on two replicas in two regions, joined by a link. Ana asks, Ben replies, Dee reads along, each with a phone. When Ben replies, a curved arrow is drawn from "Yes!" back to "Lunch?": the causal link. Two panels side by side, "Eventual" and "Causal"; in the causal panel, region 2 has a dashed waiting tray.
**Opening frame**: Both regions with an empty chat. Caption: "A question, its answer, and someone reading along."
**Story**:

1. Ana posts "Lunch?" in region 1. Ben, also in region 1, sees it and replies "Yes!"; the causal arrow draws between them.
2. Eventual panel: the two messages travel to region 2 separately, and "Yes!" arrives first. Dee's phone shows "Yes!" alone. Caption: "Eventual: the answer can arrive before the question."
3. Causal panel: "Yes!" carries a tag, "after: Lunch?". Region 2 parks it in the waiting tray until "Lunch?" arrives, then shows both in order. Caption: "Causal: a reply waits for what it replies to."
4. Cy posts "Nice weather" from region 2, unrelated, with no arrow. Two readers see it in different positions relative to the lunch messages, and both are allowed. Caption: "Unrelated messages may appear in any order."
5. The link between regions is cut (red, dashed). Each client keeps to its own region; both regions keep accepting and showing posts, and replies there still wait for their questions. Caption: "And it keeps working when the network splits."

**The moment**: Beats 2 and 3 side by side: an orphan "Yes!" on the eventual phone, while on the causal side the same "Yes!" sits visibly in the waiting tray.
**Interaction**: A dial for the delay on the question's path: the eventual phone shows orphan replies more often, the causal phone just shows the pair a little later. A "cut the network" button shows both regions staying available.
**Ending**: Dee's two phones side by side, the causal one in the right order. Caption: "Keep cause before effect. Let the rest float."
**Variants**: `strong-vs-eventual-consistency`, `read-your-writes`, `sequential-consistency`, `replication-lag`, `cap-theorem`; platform: Cosmos DB session and consistent prefix levels (Azure).
**Techniques**: side by side, token, contents, path trace, boundary, dial, timer, caption.
**Review**: Keep — the orphan "Yes!" against the same reply parked in a waiting tray is the anomaly and the fix in one glance, unrelated posts floating freely keep it distinct from sequential, and beat 5 shows the availability claim with clients sticking to their region, the condition the claim depends on.

### Read-your-writes (session guarantees) (`read-your-writes`)

**The aha**: Users rarely need everything globally fresh; they need to see their own actions, and never see time go backwards. Per-session guarantees fix those visible bugs cheaply.
**Misconception to defeat**: "To fix 'my comment disappeared' we need strong consistency everywhere."
**Cast**: The replication-lag scene: a leader, a fresh follower F1 and a lagging follower F2 on a time ruler. Ana on the left with a phone and a session badge that rides along with every request. Ben, another user, reading from F2. A load meter on the leader.
**Opening frame**: The bug from replication lag: Ana's comment missing from her phone. Caption: "Ana posts, reloads, and her comment is gone."
**Story**:

1. Ana posts "Nice!" again. The leader replies with its log position, #42, and her badge updates: "my last write: #42". Caption: "Each write comes back with a position in the log."
2. Ana reloads and the read goes to F2, which is at #40. F2 compares 40 with 42 and holds its reply while its counter ticks 41, 42, then answers with the comment. Caption: "Read-your-writes: a copy answers Ana only once it has her write."
3. After a read from F1, Ana's badge also records "seen up to #44". Her next read lands on F2, at #43, and is redirected to F1. Caption: "Monotonic reads: never go back in time."
4. Ben reads from F2 and doesn't see Ana's comment yet. Nothing flags. Caption: "Ben is a moment behind, and would never notice."
5. Cost, side by side: "strong everywhere" sends every read to the leader and its meter goes red; "session guarantees" constrain only Ana's few reads and the meter stays low.

**The moment**: Beat 2, slowed: F2 checks Ana's badge, #42, against its own #40 and holds the reply until its counter reaches 42.
**Interaction**: A session-guarantees toggle and a "reload" button. Off, the comment sometimes vanishes and counts go backwards; on, never, while the leader's meter barely moves. A lag dial sharpens the difference.
**Ending**: Ana's phone always showing her comment; Ben's view a moment behind. Caption: "Your own writes, always. Everyone else's, soon."
**Variants**: `replication-lag`, `causal-consistency`, `strong-vs-eventual-consistency`, `sticky-sessions` (scaling); platform: Cosmos DB session consistency (Azure).
**Techniques**: token, contents, timer, meter, toggle, path trace, side by side, dial, caption.
**Review**: Keep — opening on the bug from `replication-lag` and fixing it with a log position carried in a session badge is concrete and correct (wait or redirect until the copy has #42), and the cost beat answers "why not just make everything strong?".

### Bounded staleness (`bounded-staleness`)

**The aha**: Reads may lag behind writes, but never by more than a stated bound, a number of versions or seconds, which turns "eventually" into a number you can reason about and promise.
**Misconception to defeat**: "Stale is stale": that bounded staleness is just eventual consistency with a nicer name.
**Cast**: Two panels side by side, "Eventual" and "Bounded (at most 5 versions)". In each, a leader cylinder whose `score` row ticks through versions v1, v2, v3…, and a replica in another region. Between them, a ruler measuring the gap in versions; in the bounded panel it's an elastic leash marked at 5. Writing clients on the left, a reader by each replica, and a staleness chart under each panel.
**Opening frame**: Both replicas two versions behind. Caption: "Replicas lag. How far is allowed?"
**Story**:

1. Steady writes: both replicas trail by one or two versions; both charts stay low.
2. The replicas slow under load. Eventual: the gap grows to 5, 15, 60 versions and the ruler runs off the panel. Caption: "Eventual: no limit on how far behind."
3. Bounded: the gap reaches 5 and the leash pulls taut, amber then red. New writes queue at the leader behind an hourglass until the replica catches up. Caption: "At the limit, writes wait for the copy to catch up."
4. The reader by the bounded replica gets "score v15" with a badge: "at most 5 versions behind". Caption: "Every read comes with a promise."
5. The charts: eventual's staleness line spikes off the top; bounded's meets a flat ceiling at 5.

**The moment**: Beat 3: the leash pulls taut and the leader visibly stops to wait. The bound is enforced, not hoped for.
**Interaction**: A dial for the bound (versions or seconds) and a replica-slowness dial: a tighter bound means more write stalls, a looser one staler reads.
**Ending**: The two charts, one spiking, one capped. Caption: "Eventual, with a number on it."
**Variants**: `strong-vs-eventual-consistency`, `replication-lag`, `pacelc`; platform: Cosmos DB bounded staleness (Azure), Spanner bounded-staleness reads (Google Cloud).
**Techniques**: side by side, chart, meter, timer, dial, restyle, stream, caption.
**Review**: Keep — the leash pulling taut and the leader stopping to wait shows the bound is enforced, which is what separates it from eventual; throttling writes at the limit matches Cosmos DB's documented behaviour, and the capped chart is the right ending.

## Partitioning and sharding

### Sharding (horizontal partitioning) (`database-sharding`)

**The aha**: Splitting one dataset's rows across several nodes by a shard key is how a database scales writes and storage past one machine, and the shard key decides which queries stay cheap: a query without it has to ask every shard.
**Misconception to defeat**: That sharding is more copies, like replication. Each shard holds different rows, not the same ones.
**Cast**: One "orders" cylinder with a write meter and a disk meter. Clients on the left sending tokens. Later, three shard cylinders, each holding a different slice of orders, behind a router box with a shard map (`hash(order_id)` → shard 1, 2 or 3). A small inset of three replicas, each holding every row, for contrast.
**Opening frame**: The single cylinder, both meters pegged red, write tokens queuing at its edge. Caption: "One machine can't take any more writes."
**Story**:

1. The cylinder splits into three shards by order ID, and the router appears between clients and shards. The inset shows three replicas, every copy full. Caption: "Sharding: each machine gets different rows. Replication: each gets all of them."
2. Writes resume: new orders land about a third on each shard, and every shard's meters sit at a third. Caption: "Writes and storage, split three ways."
3. `get order 1042`: the router hashes the ID and sends the token straight to shard 2. Caption: "With the shard key: straight to one shard."
4. `orders for customer 7` has no order ID, so the router can't tell where they live: one arrow becomes three, and the replies are merged. Caption: "Without it: ask every shard, merge the answers."
5. Shard 2 fails: only its third of the orders goes dark, while shards 1 and 3 keep answering. Caption: "Lose a shard, lose its slice. So each shard is also replicated."

**The moment**: Beat 3 against beat 4: the same router sends one arrow when the query carries the key and three when it doesn't.
**Interaction**: Choose the shard key (order ID or customer ID) and run a set of queries: the viewer sees which become single-shard and which scatter, and that changing the key just swaps which queries are cheap. Kill a shard and see which queries still work.
**Ending**: Three steady shards, the router's map glowing. Caption: "The shard key decides everything."
**Variants**: `vertical-vs-horizontal-partitioning`, `range-vs-hash-partitioning`, `hot-partition`, `consistent-hashing`, `shard-rebalancing`, `local-vs-global-secondary-indexes`, `multi-tenant-data-isolation`, `read-replicas` (scales reads only); platform: Azure Cosmos DB physical partitions, DynamoDB partitions (AWS).
**Techniques**: split / merge, contents, meter, token, side by side, failure, choice, caption.
**Review**: Improved — the opening frame showed the finished shards, so the problem never appeared; it now opens on the overloaded single machine and splits it. The replication inset defeats the misconception up front, the write payoff comes before the query beats, the shard-failure beat now says why shards are replicated, and the confusing "callback" beat is gone. The shard map is a hash rather than `% 3`, which `consistent-hashing` shows breaking; the interaction lets the viewer change the shard key.

### Horizontal, vertical and functional partitioning (`vertical-vs-horizontal-partitioning`)

**The aha**: Horizontal splitting spreads rows, vertical splitting spreads columns, and functional splitting spreads by business area: three different cuts, solving three different problems.
**Misconception to defeat**: That "partitioning" always means splitting rows for scale. The same data can be cut by columns instead, or along team and service lines.
**Cast**: One database cylinder opened to show three tables: a wide "Users" (`id, name, email, last_login, ssn, bio (2 KB), avatar (500 KB)`), "Orders" and "Inventory". Each cut is first drawn as a dashed knife line, then made. An I/O meter beside each result.
**Opening frame**: The open database, a size meter on Users showing most of its bytes are `bio` and `avatar`. Caption: "One database, three ways to cut it."
**Story**:

1. Horizontal: a dashed line runs across Users between rows, and it splits into Shard A (users 1–1000) and Shard B (users 1001–2000) on two machines. Caption: "Horizontal: split the rows. For scale."
2. Vertical: a dashed line runs down Users between columns, and it splits into a slim hot table (`id, name, email, last_login`) and a cold one (`id, bio, avatar`). A login query reads only the slim table and its I/O meter barely moves; on the unsplit table the same query's meter spikes, dragging blobs it never needed. Caption: "Vertical: split the columns. Hot fields away from heavy ones."
3. `ssn` is cut out the same way into its own narrow table behind a stricter permission boundary. Caption: "Vertical also fences off what needs tighter access."
4. Functional: dashed lines run between the tables, and Users, Orders and Inventory move into three databases inside three team boundaries. A query that joined Users to Orders locally now calls across a boundary. Caption: "Functional: split by business area. For teams and services."

**The moment**: Beat 2: the same login query, a calm meter on the slim table against a spiking one on the wide table, shows a cut is chosen for a problem, not applied by default.
**Interaction**: Toggle between the three cuts and run a "login" query and a "full profile" query against each, watching which meter moves and which query now needs a join or a cross-service call.
**Ending**: The three results side by side, each labelled with what it solves and what it costs: "scale · cross-shard queries", "I/O and access · a join to rebuild the row", "team ownership · no local joins". Caption: "Pick the cut for the problem."
**Variants**: `database-sharding`, `multi-tenant-data-isolation`, `columnar-storage` (vertical splitting taken to the limit); microservices database-per-service (architecture).
**Techniques**: split / merge, contents, meter, boundary, side by side, toggle, caption.
**Review**: Improved — the cast was a single table, so the functional split appeared from nowhere; the opening now shows a database of three tables, each cut is drawn first as a dashed line in its own direction (across rows, down columns, between tables), `ssn` is in the cast before it's used, and the ending names each cut's price as well as its purpose.

### Range vs hash partitioning (`range-vs-hash-partitioning`)

**The aha**: Range partitioning keeps neighbouring keys together, so a range scan is cheap, but a sequential key like a timestamp sends every new write to the newest range. Hash partitioning spreads writes evenly but scatters a range scan across every partition.
**Misconception to defeat**: That one scheme is simply "better". Each wins exactly the case the other loses.
**Cast**: An events table keyed by `event_time`. Two panels, "Range" and "Hash", each with four partition cylinders and load meters. Range's are labelled by day (`Mon`, `Tue`, `Wed`, `Thu →`, the last open-ended); hash's are labelled `hash % 4 = 0…3`, each holding events from every day. A 2×2 scorecard (writes, scans) between the panels.
**Opening frame**: Both panels, a "now" marker on Thursday. Caption: "Same events table, split two ways."
**Story**:

1. Thursday's events stream in, in time order. Range: every new key falls in `Thu →`, which pegs red while the other three idle. Hash: writes scatter, four meters rising together. Scorecard: writes go to hash. Caption: "Range: every new write hits the newest range."
2. Query "Tuesday 09:00–10:00": range reads one partition, one token. Hash asks all four and merges. Scorecard: scans go to range. Caption: "Range: a scan reads one partition. Hash: all of them."
3. Query one event by its exact key: both go straight to one partition. Caption: "Point lookups are cheap either way."
4. Swap the key to a random UUID: range's bands relabel as UUID ranges and the hot spot disappears, but "Tuesday 09:00–10:00" is no longer a key range and must ask all four. Caption: "A sequential key breaks range. A time scan breaks hash."

**The moment**: Beats 1 and 2 on the scorecard: the same table, and each scheme takes exactly the cell the other loses.
**Interaction**: Choose a key (timestamp, UUID, user ID) and a query (time-range scan, point lookup) and watch which panel's meters and arrows light up.
**Ending**: The filled scorecard: "Range: cheap scans, hot newest range" and "Hash: even writes, scattered scans." Caption: "Many stores do both: hash to pick the partition, sort by range inside it."
**Variants**: `database-sharding`, `hot-partition`, `consistent-hashing`, `partitioned-tables`, `wide-column-store` (hash the partition key, sort by the clustering key); platform: DynamoDB partition and sort keys (AWS).
**Techniques**: contents, meter, token, side by side, choice, caption.
**Review**: Improved — the range bands were six-hour slices of one day, which made "all today's writes pile into partition 4" untrue (the hot spot would walk through each band); bands are now days with an open-ended newest range, which is how sequential keys really hit range partitioning. A scorecard turns the moment into "each wins the other's losing cell", and the ending gives the common real answer (hash, then range within).

### Hot partitions and data skew (`hot-partition`)

**The aha**: A system is only as fast as its busiest partition, and adding nodes doesn't help until the key itself changes.
**Misconception to defeat**: That scaling out always spreads load evenly. A bad key concentrates it however many nodes you add.
**Cast**: Four partition cylinders keyed by post ID, each with a load meter and a throughput cap line. One holds the like counter `post_42: likes`. Clients on the left.
**Opening frame**: Four partitions, meters level. Caption: "Load spread evenly. For now."
**Story**:

1. Post 42 goes viral: a flood of "like" writes all routes to the partition holding that one key. Its meter hits the cap and turns red while the other three stay low; extra likes bounce back "throttled". Caption: "One key, all the traffic."
2. A fifth partition is added and keys are redistributed, but `post_42` is still one key on one partition. Its meter stays red; the new partition idles. Caption: "More nodes. Same hot key, same bottleneck."
3. Salting: the counter becomes `post_42#1` to `post_42#4`, spread over four partitions, and each like picks one at random. The meters even out. Reading the total now asks all four and adds them up. Caption: "Split the key, and the load splits with it. Reads pay a little."
4. The same skew in a batch job: a join where one key holds 90% of the rows, so one worker's progress bar crawls long after the other three finish. Caption: "One hot key, one slow task."

**The moment**: Beat 2: the new, empty partition idling beside the still-pegged hot one, proof that scaling out alone didn't help.
**Interaction**: Pick a key distribution (uniform, one viral post, a few very popular keys) and a node count: the busiest partition caps throughput whatever the node count, until salting is switched on.
**Ending**: Four level meters, the salted sub-keys labelled beneath the once-hot partition. Caption: "Fix the key, not just the node count."
**Variants**: `range-vs-hash-partitioning`, `consistent-hashing`, `database-sharding`, `shard-rebalancing` (splitting a hot range), `spark-execution-model` (skewed joins); platform: per-partition throughput limits in DynamoDB (AWS) and Cosmos DB (Azure).
**Techniques**: contents, meter, token, restyle, failure, choice, dial, caption.
**Review**: Improved — the cast already had four partitions, so "a fourth is added" is now a fifth; the hot key is now a viral like counter, a write-heavy key where salting genuinely spreads the load (a salted read-heavy item would need copying), and salting's cost, summing the sub-keys on read, is shown instead of hidden. Throttling at a per-partition cap makes the failure visible.

### Consistent hashing (`consistent-hashing`)

**The aha**: Put nodes and keys on a ring and give each key to the next node clockwise: adding or removing a node then moves only that node's share of the keys, about 1/N, instead of most of them as with "hash mod N".
**Misconception to defeat**: That it's just a better hash function. It's about what happens when the node count changes, and it's a placement technique that sharded databases, caches and load balancers all use.
**Cast**: A circular ring with three nodes, N1, N2, N3, at fixed points, and 100 key dots round it, each coloured by its owner with a faint line running clockwise to it. Beside it, a strip "hash(key) mod 3" sending the same 100 keys to three boxes. A "keys moved" counter under each, and a load meter per node.
**Opening frame**: The ring in three coloured arcs. Caption: "Each key belongs to the next node clockwise."
**Story**:

1. A new key drops onto the ring; its line runs clockwise to N2 and it takes N2's colour. Caption: "To find a key's node, walk clockwise."
2. N4 joins between N1 and N2. Only the dots between N1 and N4 change colour, from N2 to N4; the counter reads "moved: 25 of 100". Caption: "A new node takes keys from one neighbour only."
3. The strip becomes mod 4: dots fly between boxes, "moved: 75 of 100". Caption: "Mod N reshuffles most keys."
4. N2 fails (red flash, greys out). Its dots flow to the next node clockwise, N3, and nothing else moves, but N3's load meter doubles. Caption: "Losing a node moves only its keys, all onto one neighbour."
5. Virtual nodes: each physical node becomes several points scattered round the ring. The arcs even out, and when a node fails now, its many small arcs spread over every survivor. Caption: "Many points per node: even shares, and a failure's load spreads out."

**The moment**: Beat 2 against beat 3: the same event, one node arriving, moves 25 keys on the ring and 75 in the strip.
**Interaction**: Add or remove nodes and watch exactly which dots change colour on both counters; a node-count dial shows the gap widening (10 → 11 nodes: about 9 keys moved on the ring, 91 in the strip); a virtual-nodes toggle evens out the arcs and spreads a failure's load.
**Ending**: Four nodes with interleaved virtual points, arcs even, most dots never having moved. Caption: "Add a node, move its share. Nothing else."
**Variants**: `range-vs-hash-partitioning`, `shard-rebalancing`, `leaderless-replication`, `database-sharding`, `hot-partition`; scaling's `ip-hash` and `sticky-sessions`; Cassandra and Dynamo token rings, cache clients (memcached's ketama).
**Techniques**: contents, path trace, restyle, failure, meter, side by side, toggle, dial, caption.
**Review**: Improved — fixed an error: when N2 failed its keys went to N4, which sits before it; they go to N3, next clockwise. "Keys moved" counters make the moment a number (25 against 75 of 100 for three to four nodes, 9 against 91 at ten to eleven), and virtual nodes now show their bigger benefit, spreading a failed node's load over all survivors instead of doubling one neighbour. Borrowed from scaling's plan: key-to-node lines, and "a placement technique, not a database".

### Shard rebalancing (`shard-rebalancing`)

**The aha**: Rebalancing moves live partitions between nodes while traffic keeps flowing; a good scheme moves as little as possible and never lets two nodes own a partition at once.
**Misconception to defeat**: That adding a node means re-dividing all the data, or pausing traffic while it moves.
**Cast**: Three nodes holding 16 fixed partitions between them (P1–P16, each a hash range of keys), and a fourth, empty node joining on the right. A router in the middle with a shard map (partition → node). Clients send tokens through the router.
**Opening frame**: Three nodes holding 5, 5 and 6 partitions, the new node empty. Caption: "Sixteen partitions, three nodes, and a new one holding nothing."
**Story**:

1. The router picks P16 to move from Node 3 to Node 4. Its rows stream across while Node 3 keeps serving reads and writes. Caption: "Move a whole partition, live."
2. A write for P16 arrives mid-move: the router still sends it to Node 3, which applies it and relays it to the copy on Node 4. Caption: "Mid-move, the old owner answers and relays new writes."
3. The copy catches up; writes to P16 pause for a blink, the map entry flips to Node 4, and Node 3's copy is deleted. Caption: "One flip. Never two owners at once."
4. Three more partitions trickle across until every node holds 4. No key changed partition; only the map's node column changed. Caption: "Keys stay in their partitions. Partitions change nodes."
5. Contrast inset: a scheme that places keys by `hash(key) mod nodes` recomputes for four nodes, and most rows set off at once, streams crossing everywhere. Counters: "4 of 16 partitions moved" against "~75% of rows moved". Caption: "The wrong scheme moves almost everything to add one node."

**The moment**: Beat 3: the single flip of the shard map. Before it Node 3 answers, after it Node 4 does, and there is no instant where both or neither does.
**Interaction**: Add or remove nodes and watch which partitions move; send a write mid-move, or a read from a client holding the old map after the flip (Node 3 answers "moved → Node 4" and the client retries), and see it land correctly either way.
**Ending**: Four nodes with four partitions each, the shard map settled. Caption: "Move a few whole partitions, with one owner at every instant."
**Variants**: `consistent-hashing`, `database-sharding`, `hot-partition` (splitting a hot partition), `database-failover`, `autoscaling` (scaling); dynamic splitting (HBase regions, MongoDB chunks); platform: Cosmos DB and DynamoDB partition splits.
**Techniques**: contents, stream, move, token, restyle, spotlight, side by side, meter, caption.
**Review**: Improved — made the key design explicit (many more partitions than nodes; keys never change partition, only the map does), replaced the weak misconception ("like taking a backup") with the real one, added a stale-map redirect to the interaction so "never routed to the wrong place" is shown rather than claimed, gave the inset counters, and replaced the unclear ending ("never by guessing again").

### Local vs global secondary indexes (`local-vs-global-secondary-indexes`)

**The aha**: A local secondary index lives inside each partition and keeps writes cheap, but a lookup by it must ask every partition. A global secondary index is itself partitioned by the indexed value, so a lookup goes straight to one partition, at the cost of every write possibly reaching a second partition, and a lagging index.
**Misconception to defeat**: That an index is an index wherever it lives. Where it's partitioned changes both what a write costs and what a lookup costs.
**Cast**: Three main partitions of an orders table, sharded by `order_id`. Each order carries a `status` field. Two panels: "Local index" shows a small status index inside each of the three partitions; "Global index" shows a separate set of index partitions, keyed by `status` instead.
**Opening frame**: Three order partitions, status values scattered through all of them. Caption: "Find orders by status. Two ways to index it."
**Story**:

1. Local panel: each partition builds its own status index over its own rows. A new order writes to one partition and updates only that partition's local index — one hop. Caption: "Local: the write stays inside its partition."
2. Query "status = shipped": the router has no idea which partition holds shipped orders, so it asks all three local indexes and merges the results. Caption: "Local lookup: ask everyone."
3. Global panel: the index itself is partitioned by status, so "shipped" entries from all three order partitions live together in one index partition. A query for "shipped" goes straight there. Caption: "Global lookup: one partition, done."
4. But a new order written to order-partition 2 must also update the global index, which lives on a different, status-partitioned node: a second write across the network, arriving a moment after the first. Caption: "Global: every write also touches the index's own partition. And it lags."
5. A query against the global index right after a status change returns the order's old status for a moment, amber, then catches up. Caption: "A targeted lookup, at the price of a stale index."
   **The moment**: Beat 2 against beat 3, side by side: one lookup fanning out to three partitions, the other landing on exactly one.
   **Interaction**: Toggle local/global, write an order and immediately query its status, and watch whether the write is one hop or two, and whether the lookup scatters or lands precisely.
   **Ending**: Two scorecards: "Local: cheap writes, scatter-gather reads" and "Global: targeted reads, costlier and lagging writes."
   **Variants**: `database-sharding`, `database-indexes`, `replication-lag`; platform: DynamoDB global secondary indexes (AWS), Cosmos DB indexing.
   **Techniques**: contents, token, stream, side by side, toggle, spotlight, caption.
   **Review**: Keep — one lookup fanning out to three partitions beside one landing on exactly one is the trade in a glance, and beats 4 and 5 show the global index's two costs (an extra cross-partition write, a lagging read). Technically right, and the platform note correctly names only DynamoDB's GSIs (its LSIs need the partition key, so they don't scatter).

## Storage engines and query performance

### Database indexes (`database-indexes`)

**The aha**: An index is an extra sorted structure that maps a column's values to row locations, so the database can jump straight to matching rows, but every write has to update it too, so you index what you query, not everything.
**Misconception to defeat**: That adding an index is free, or that the database automatically gets fast at everything once one exists.
**Cast**: A table "Users" of unsorted rows (`id, email, signup_date`). Beside it, a thin sorted strip: an index on `email`, each entry an email value with an arrow pointing to its row's position in the table. A query bar. A write-cost meter under the table and a second one under the index.
**Opening frame**: Table alone, no index. Caption: "Find the user with email `ana@x.com`."
**Story**:

1. Query without an index (the table holds a million rows, shown as a long scrolling column): a scan token crawls down the rows checking each email, lighting them red, and only reaches the match near the bottom; since the database can't know the email is unique, it keeps going to the end. Counter: "1,000,000 rows read". Caption: "No index: check every row."
2. The email index appears, built once by sorting all emails and recording where each row lives. Caption: "An index: the same values, sorted, with a pointer back."
3. The same query is answered by narrowing the sorted strip in a few jumps (halving, as in a tree) and following one arrow straight to the row. Counter: "about 20 steps". Caption: "Jump to it instead of scanning for it."
4. A new user signs up: the row is added to the table, and the new email must also be slotted into its sorted place in the index. Both meters tick. Caption: "Every write updates the table, and every index on it."
5. Five more indexes are added, on columns nobody queries; one insert now touches the table and all six indexes, its write meter climbing while those five never pay for themselves. Caption: "Index what you query, not everything."
   **The moment**: Beat 3 against beat 1: the crawling red scan (a million rows read) versus about twenty quick jumps straight to the row, run side by side on the same query.
   **Interaction**: Toggle the index on and off and run the same lookup, watching the scan versus the jump; add indexes on unused columns and watch the write meter climb with no query ever benefiting.
   **Ending**: One useful index, lookups fast, writes paying a small, worthwhile cost. Caption: "Index the reads that matter."
   **Variants**: `composite-and-covering-indexes`, `b-tree-vs-lsm-tree`, `query-execution-plan`, `relational-model`.
   **Techniques**: contents, token, spotlight, path trace, meter, toggle, caption.
   **Review**: Improved — the scan now shows a row counter (a million rows against about 20 steps), which makes the gap a number instead of a feeling; the unused-index beat said six structures were updated, but the table plus the email index plus five more is seven (now table plus six indexes), and "shifting neighbours" is gone because real indexes are trees that slot an entry in, not arrays that shift. Weighed a book-index metaphor; the animated sorted strip is the same idea, drawn from the actual data.

### Composite, covering and clustered indexes (`composite-and-covering-indexes`)

**The aha**: Column order in a composite index matters, only a query that matches its leftmost columns can use it, and a covering index that holds every column a query needs answers without ever touching the table.
**Misconception to defeat**: That several single-column indexes do the same job as one spanning the columns together, or that an index is always a separate structure from the table.
**Cast**: An Orders table (`customer_id, order_date, status, total`). A composite index strip ordered by `(customer_id, order_date)`. A separate covering index strip holding `(customer_id, order_date, total)`. A clustered variant where the table's own rows are shown re-sorted by `customer_id`.
**Opening frame**: The composite strip, entries grouped by customer, then by date within each customer. Caption: "Ordered by customer, then date, within each customer."
**Story**:

1. Query "orders for customer 7, by date": jumps straight to customer 7's group in the strip, already in date order. Caption: "Matches the leftmost columns: fast."
2. Query "orders on 2026-03-02, any customer": the strip is no help, dates are only sorted within each customer, not overall, so the database has to read the whole strip or table. Caption: "Skip the leftmost column, and the order breaks."
3. Two separate single-column indexes, `customer_id` and `order_date`, face the query "customer 7 on 2026-03-02": each narrows to a long list (customer 7's 400 orders; that day's 9,000 orders), and the database must pick one and filter the rest, or intersect both lists. The composite strip lands on the few matching entries directly. Caption: "Two separate indexes are not one combined index."
4. Covering strip: the same lookup for customer 7 returns `total` directly from the index entries (carried along as an extra column, not part of the sort order), without a single arrow back to the table. The table stays dark; only the strip lights. Caption: "Covering: every column the query needs is already here."
5. Without covering, the same query lights the strip, then follows an arrow back to the table for `total` on every matching row, extra hops, highlighted. Caption: "Without it: one more trip per row."
6. Clustered: the table's own rows reorder by `customer_id`, so the table is the index, and there can be only one such order. A second index (on `status`) now holds `customer_id` in each entry, to find its row in the clustered order. Caption: "Clustered: the table itself is sorted by the key."
   **The moment**: Beat 4 against beat 5, the same query, one version never leaving the index, the other hopping back to the table on every row.
   **Interaction**: Reorder the composite index's columns and try different queries to see which still jump straight in and which fall back to a scan; toggle "covering" to see the extra hops appear or vanish.
   **Ending**: The covering strip glowing alone, answering fully. Caption: "Order the columns for your queries. Cover them, and skip the table."
   **Variants**: `database-indexes`, `query-execution-plan`, `b-tree-vs-lsm-tree`.
   **Techniques**: contents, path trace, spotlight, toggle, restyle, caption.
   **Review**: Improved — the stated misconception (several single-column indexes do the same job) was never shown; new beat 3 pits two separate indexes against the composite on one query. Fixed the clustered beat: secondary indexes on a clustered table hold the clustering key rather than a physical position, and only one clustering order exists. Covering columns are noted as carried payload, not part of the sort, and "falls back to a scan" is softened since some engines can skip-scan.

### B-tree vs LSM-tree (`b-tree-vs-lsm-tree`)

**The aha**: A B-tree updates a page in place on every write; an LSM-tree buffers writes in memory and flushes them as new sorted files, turning random writes into sequential ones, at the cost of merging those files back together later and checking several of them on a read.
**Misconception to defeat**: That one is simply the modern, faster version of the other. Each trades write speed against read simplicity differently.
**Cast**: Two panels. "B-tree": a balanced tree of fixed pages on disk, each page a box of sorted keys. "LSM-tree": an in-memory buffer (memtable), beneath it a stack of immutable sorted files (SSTables) on disk, each with a small Bloom-filter badge.
**Opening frame**: Both holding the same keys, `a:1 … z:26`. Caption: "Same data, two ways to store it."
**Story**:

1. B-tree: a write to `m` walks down to the page holding `m` and rewrites that page in place on disk. Caption: "B-tree: find the page, update it in place."
2. LSM-tree: the same write is added to the in-memory memtable, plus one quick append to a log on disk (the write-ahead log, so a crash can't lose it). A dozen more writes land the same way, instantly. Caption: "LSM: buffer in memory. Writes are nearly free."
3. The memtable fills and flushes as a new sorted file, SSTable 4, stacking on the others, written as one sequential sweep, not scattered pages; the log it covered is discarded. Caption: "Flush as one sequential file."
4. A read for `m`: on the B-tree, one walk down the tree to the exact page. On the LSM-tree, it must check the memtable, then SSTable 4, then 3, then 2, each file's Bloom filter quickly saying "not here" until one says "maybe," and that file is opened. Caption: "LSM reads may check several files."
5. Background compaction: SSTables 1–3 merge into one, discarding old overwritten versions of keys; the disk meter shows every byte being rewritten, the CPU meter rises while this runs, and the file count drops to two. Caption: "Compaction cleans up later, rewriting data, using CPU and I/O."
   **The moment**: Beat 1 against beat 2, the same single write, one jumping to a disk page immediately, the other landing in memory and leaving, with the real work deferred.
   **Interaction**: Fire a burst of random writes at both and compare their write-latency meters; then read a key and watch the B-tree's one jump versus the LSM-tree's file-by-file check, Bloom filters skipping most of them.
   **Ending**: Scorecards: "B-tree: steady reads and writes" and "LSM-tree: fast writes, compaction running behind."
   **Variants**: `database-indexes`, `write-ahead-log`, `wide-column-store`, `key-value-store`.
   **Techniques**: contents, token, meter, path trace, restyle, side by side, caption.
   **Review**: Improved — the LSM write skipped its durability log (a memtable alone loses data in a crash), so beats 2 and 3 now show the sequential log append and its discard after the flush, which also links to `write-ahead-log`. Compaction now shows rewritten bytes, the real cost of the trade, instead of only CPU. Kept the side-by-side single write as the moment; weighed a "random vs sequential disk head" framing, which dates the picture for SSDs.

### Write-ahead log (WAL) (`write-ahead-log`)

**The aha**: Durability comes from the log, not the tables: once a change's log entry is on disk, the commit survives a crash, even if the actual data page hasn't been touched yet.
**Misconception to defeat**: That a "commit" means the table's own storage has already been safely written. It's the log that's guaranteed; the table catches up afterwards.
**Cast**: A client on the left. A memory box holding a cached copy of the data page. A log strip of numbered entries (append-only) and, separately, the actual data pages on disk. A "commit" stamp. A disk-crash switch. A recovery process icon.
**Opening frame**: An empty log, a data page showing `balance: 100`. Caption: "A log, and the real pages it describes."
**Story**:

1. The client sends `balance = 80`. The cached copy in memory changes to `80`, and entry "#1: balance=80" appends to the log and is flushed to disk; only then does "✓ committed" return to the client. The data page on disk hasn't changed, greyed. Caption: "Log it and flush it. That's the commit."
2. Later, the data page on disk quietly updates to `80` (at a checkpoint), catching up to the log. One sequential append was enough to commit; the scattered page writes can wait and be batched. Caption: "The page is written after, in its own time."
3. Rewind to just after beat 1: power fails, the disk-crash switch flips red, the memory box empties, then the machine restarts. The data page on disk still reads `100`; the log still holds entry "#1". Caption: "Crash before the page is written. Did the write survive?"
4. Recovery runs: it reads the log from the last checkpoint, finds entry "#1", and replays it onto the page, which becomes `80`. Caption: "Replay the log. The commit holds."
5. Two more uses light up beside the log: an arrow to "replica" (the same entries stream out as replication) and an arrow to "CDC consumer" (the same entries feed a change-capture pipeline). Caption: "The same log also drives replication and change capture."
   **The moment**: Beat 3 into beat 4: the page still shows the old value right after a crash, and replay from the log alone brings it back to what was promised.
   **Interaction**: A "crash now" button that can be pressed at any beat; recovery always replays correctly from whatever is in the log, never from what's in the (possibly stale) pages.
   **Ending**: Log and page back in agreement at `80`. Caption: "The log is the source of truth for what happened."
   **Variants**: `b-tree-vs-lsm-tree`, `change-data-capture`, `point-in-time-restore`, `leader-follower-replication`.
   **Techniques**: contents, token, failure, timer, path trace, stream, caption.
   **Review**: Improved — the cast had no memory, so "the page hasn't updated" wasn't true to how engines work (the change lands in a cached page, and it is the disk copy that lags); the memory box now empties in the crash, which is exactly what makes the log necessary. Beat 2 now says why the order is worth it (one sequential append commits; scattered page writes are deferred and batched), and the crash is a rewind rather than an unexplained jump. The checkpoint, replay and replication/CDC claims were already right.

### Query execution plans (`query-execution-plan`)

**The aha**: SQL says what you want; the optimizer decides how to get it, choosing scans or index seeks and a join order based on statistics it keeps about the tables, and when those statistics are stale, or an index is missing, that choice can turn a millisecond query into a full scan.
**Misconception to defeat**: That a query runs exactly as written, top to bottom, the way the SQL reads.
**Cast**: A query `SELECT … FROM customers JOIN orders ON … WHERE customers.city = 'Paris'`. Below it, two candidate plan trees the optimizer is weighing: Plan A (index seek on `customers.city`, then for each match a nested-loop lookup of that customer's orders by index) and Plan B (scan both tables once, hash join). A statistics panel: "customers: 2M rows, city='Paris': ~500 rows (estimate)". A stopwatch.
**Opening frame**: The query text above two ghostly candidate plans. Caption: "The database must choose how to run this."
**Story**:

1. The optimizer checks its statistics: few Paris customers expected. It picks Plan A, solidifying while Plan B fades. The index seek jumps to the matching rows, stopwatch 4 ms. Caption: "Good statistics, good plan."
2. EXPLAIN ANALYZE is run (plain EXPLAIN shows only the estimates; ANALYZE also runs the query): the chosen plan appears as a tree, index seek, then nested-loop join, with estimated vs actual row counts side by side on each node, matching closely. Caption: "EXPLAIN shows the plan chosen, and ANALYZE what really happened."
3. After a bulk load, Paris holds 1.8M of the 2M customers, but statistics weren't refreshed and still say "~500". The optimizer, trusting the stale number, again picks Plan A. The seek-and-lookup now repeats 1.8M times, one random jump after another, crawling, stopwatch to 4,000 ms. Caption: "Stale statistics, wrong plan, for the same query."
4. Statistics are refreshed (ANALYZE); the optimizer re-plans, now picking Plan B's scan and hash join, which reads each table once, sequentially, and finishes in 90 ms. Caption: "A full scan can beat a bad seek."
5. The `city` index is dropped entirely: Plan A is no longer even an option, and only Plan B remains on the board. For a rare city, that same Plan B would now be the slow one. Caption: "No index, no seek. The choice is gone."
   **The moment**: Beat 3, the estimated-vs-actual row counts on the EXPLAIN tree diverging wildly, 500 estimated, 1.8M actual, pinpointing exactly why the plan went wrong.
   **Interaction**: Edit the statistics number and watch the optimizer pick a different plan for the identical query and data (the crossover is a few percent of the table); toggle the index and watch a plan disappear from consideration.
   **Ending**: Fresh statistics, the right plan chosen, EXPLAIN's estimates matching reality. Caption: "The optimizer is only as good as what it believes about the data."
   **Variants**: `database-indexes`, `composite-and-covering-indexes`, `n-plus-one-queries`, `b-tree-vs-lsm-tree`.
   **Techniques**: contents, restyle, timer, path trace, meter, spotlight, caption.
   **Review**: Improved — the query filtered on `city` but the index and plans were on `orders`, which has no city, so Plan A and Plan B didn't match the SQL; the query now filters `customers` and the plans are a seek plus nested loop against a scan plus hash join. Estimated vs actual rows need EXPLAIN ANALYZE, not plain EXPLAIN, so beat 2 says so. The stale-statistics story is framed as a bulk load, which is when it really happens, and beat 5 notes that the right plan depends on the data.

### N+1 query problem (`n-plus-one-queries`)

**The aha**: Loading a list with one query and then looping to fetch each item's details turns a single page into a hundred round trips, and the latency adds up per item, not per page.
**Misconception to defeat**: That an ORM's convenient `order.customer` is just a property access, free, rather than a hidden query across the network.
**Cast**: A web server box on the left, a database cylinder on the right, a network pipe between them with a per-trip latency badge "~5 ms". A page template: "Order #1 — Customer: ?", repeated for 100 orders. A small code panel on the server: `for order in orders: show(order.customer.name)`.
**Opening frame**: The template with 100 blank "Customer: ?" slots. Caption: "Render 100 orders, each with its customer's name."
**Story**:

1. One query fetches the 100 orders in a single round trip, 5 ms. The template fills in order numbers and totals, customer slots still blank. Caption: "Query 1: get the orders."
2. The code loops over the 100 orders; for each one, `order.customer.name` quietly fires its own query across the pipe. One token crosses, 5 ms, fills in a name; then the next, and the next, the counter ticking 1, 2, 3 … 100, each one waiting for the last. Caption: "...and one more query per order. 100 round trips."
3. The total latency meter climbs past 500 ms while the database's own time per query stays a fraction of a millisecond, so a slow-query log shows nothing wrong; most of the time is the round trip itself, paid over and over. Caption: "101 queries instead of 1. Each is fast; the trips add up."
4. Fix with a join: one query asks for orders and customers together; a single result set returns with every name already attached. Latency meter: 8 ms. Caption: "One join, one trip, done."
5. Fix with batching (an ORM's "eager loading"): a second query asks for all 100 customers at once with `WHERE id IN (…)`, filling every slot in one more round trip. Two trips, latency meter: 10 ms. Caption: "Or ask for all of them together."
   **The moment**: Beat 2's counter ticking to 100, each tick a full round trip, laid directly beside beat 4's single trip doing the same job.
   **Interaction**: A "page size" dial (10 to 1,000 orders); the lazy-loading latency scales with it one-for-one, while the joined version barely moves.
   **Ending**: Two latency bars side by side: 500+ ms versus under 10 ms, same result. Caption: "Batch it, or join it, never loop it."
   **Variants**: `query-execution-plan`, `database-connection-pooling`, `relational-model` (joins).
   **Techniques**: token, stream, meter, dial, side by side, caption.
   **Review**: Improved — the loop is now visible as code, since the whole problem is that it hides inside `order.customer.name`, and beat 3 adds the trap that makes N+1 survive in production: every individual query is fast, so no slow query shows up. Batching is tied to the ORM term (eager loading) and its `IN (…)` shape. Numbers hold (101 x 5 ms is about 505 ms; the 5 ms is an illustrative cross-network trip, same-region is often under 1 ms but 100 of them still add up). Weighed opening on the finished 500 ms page; blank slots filling one by one is clearer.

### Database connection pooling (`database-connection-pooling`)

**The aha**: Opening a database connection is slow and every database caps how many it will accept, so a pool keeps a handful open and hands them out to requests as they come and go, instead of opening and closing one per request.
**Misconception to defeat**: That a new connection is cheap, like opening a file, or that a connection pool is the same thing as a thread pool.
**Cast**: A database cylinder with a connection-limit badge "max: 100". A row of request boxes arriving on the left. Without a pool: each request opens its own direct line to the database (a handshake exchange: TCP, auth, TLS) then closes it. With a pool: a pool box sits between requests and the database, holding a fixed row of already-open connections.
**Opening frame**: No pool, one request mid-handshake with the database, a stopwatch at 40 ms before its query even runs. Caption: "Before the query: a whole handshake."
**Story**:

1. 50 requests arrive together, each opening its own connection: 50 handshakes fire at once, the database's connection count climbs toward 100. Caption: "Each request pays the handshake cost."
2. A burst of 200 requests arrives; connections pile past the "max: 100" badge and the database refuses the new ones ("too many connections"), red flashes, even though most just want a quick query. The limit exists because each open connection costs the database memory (and, in PostgreSQL, a whole process). Caption: "The database has a limit. Exceed it, and new requests fail."
3. Pool version: 10 connections sit open and idle in the pool box from the start. A request borrows one (an instant handoff, no handshake), runs its query, and returns it to the pool. Caption: "Borrow an open connection, use it, give it back."
4. The same 200-request burst arrives: requests queue briefly for one of the 10 connections rather than each opening their own; the database's connection count never passes 10. Caption: "Ten connections, two hundred requests, no refusals."
5. A serverless function scaled out to hundreds of instances, each with a pool of its own (or one connection) and no shared state: every instance opens its own connection, and under load the database's limit is hit again within seconds. A pooler (PgBouncer, RDS Proxy) slides in between, and the hundreds of client lines funnel into ten server connections. Caption: "Many instances, many pools. A pooler in front shares one."
   **The moment**: Beat 2 against beat 4, the same 200-request burst, one version flooding the database past its limit, the other borrowing from ten calmly.
   **Interaction**: A pool-size dial and a concurrent-requests dial; watch the database's connection count and refusal rate respond to each, and see refusals vanish once the pool is in place. Turn the pool size far up and the wait doesn't improve: a database with a few cores gains nothing from hundreds of busy connections, so small and busy beats big.
   **Ending**: The pool box steadily recycling its 10 connections under load, the database's count flat. Caption: "A few warm connections, shared, beat one each."
   **Variants**: `n-plus-one-queries`, `query-execution-plan`; scaling's `autoscaling` and serverless cold starts (architecture); platform: RDS Proxy (AWS), PgBouncer.
   **Techniques**: contents, exchange, token, meter, failure, dial, caption.
   **Review**: Improved — the cap now has a reason (each connection costs the database memory, a process in PostgreSQL), so it isn't an arbitrary badge; the serverless beat's caption, three claims long, is now one, and it shows the pooler funnelling many client lines into ten server connections, the real fix, since a per-instance pool alone still multiplies by instance count. The pool-size dial now teaches that a bigger pool stops helping. The 40 ms handshake opening and the 200-request contrast are kept.
