# Messaging plans, part 2

## Delivery guarantees and duplicates

### Delivery guarantees (at-most-once, at-least-once, exactly-once) (`delivery-guarantees`)

**The aha**: The guarantee comes down to one choice: does the consumer ack before the work or after it?
**Misconception to defeat**: That a delivery guarantee is a broker feature picked from a menu, and "exactly-once" is what you get by default.
**Cast**: Two identical lanes, stacked. Each has a queue tube (left) holding one envelope "#7 Charge $20", a consumer box (middle) with a three-step strip beneath it, and a database cylinder (right) with a "charges" table. The top strip reads "receive → ack → work", the bottom "receive → work → ack". A playhead dot moves along each strip.
**Opening frame**: Both lanes at rest, #7 in each queue, both tables empty. Lane labels: "Ack first" and "Ack last".
**Story**:

1. Both consumers take #7; the envelope moves into the consumer, leaving a faint locked outline in the queue. Caption: "Same message. Only the order differs."
2. Top: the playhead reaches "ack"; a tick travels back and the outline in the queue vanishes. Bottom: the playhead reaches "work"; a row "#7 $20" appears in the table.
3. Both consumers crash at the same point, between their second and third steps (red flash, grey). Slow motion.
4. Restart. Top: the queue is empty and so is the table; a "LOST" stamp lands on it. Caption: "At-most-once: may be lost, never repeated."
5. Bottom: the lock expires, #7 reappears and is processed again; a second "#7 $20" row appears in amber. Caption: "At-least-once: never lost, may repeat."
6. A third lane slides in: "work → ack" with a "seen #7?" check before the work. On redelivery the check lights, nothing is written, it acks. Caption: "Exactly-once effect = at-least-once + dedupe."

**The moment**: Beats 4 and 5 side by side: the identical crash, opposite damage. One empty table, one doubled.
**Interaction**: Drag a crash marker anywhere along each strip and replay. Every position gives one of three outcomes (fine, lost, duplicated), which shows the guarantee is about where the ack sits relative to the work.
**Ending**: Three lanes frozen on their tables (no row, two rows, one row), labelled "at-most-once", "at-least-once", "effectively once". Caption: "Most brokers default to the middle one. Expect duplicates." Loops.
**Variants**: `message-acknowledgement`, `consumer-offsets` (the same choice with offset commits), `exactly-once-processing`, `idempotent-consumer`.
**Techniques**: side by side, lanes, token, contents, failure, spotlight, dial, caption.
**Review**: Improved — the crash point is pinned (between the second and third steps) so "the same crash" is unambiguous, and the ending now says most brokers default to at-least-once, the catalog's practical takeaway. Weighed a three-position guarantee dial; the ack-position strips show the mechanism behind the names, so they stay.

### Exactly-once and why it's hard (`exactly-once-processing`)

**The aha**: A sender can't tell a lost message from a lost reply, so it has to resend; "exactly-once" really means at-least-once plus deduplication, inside a boundary the system controls.
**Misconception to defeat**: That exactly-once delivery is a setting a broker can switch on across a network.
**Cast**: Two rows. Each has a sender (left) with a timer, a fog band (middle) labelled "network" where things can vanish, and a receiver (right) with a ledger cylinder. The message is an envelope "Pay #42"; the reply is a tick.
**Opening frame**: Both rows identical: senders holding "Pay #42", empty ledgers, fog between.
**Story**:

1. Row A: the envelope enters the fog and vanishes (a small red puff). The sender's timer runs out. Caption: "No reply."
2. Row B: the envelope arrives, "Paid #42" appears in the ledger, and the tick heading back vanishes in the fog. The timer runs out. Caption: "No reply."
3. A curtain slides over the right half of both rows, leaving only the senders. Caption: "From the sender's side, these are identical." A footnote names it: the Two Generals problem.
4. Two buttons appear on each sender: "Resend" and "Give up". Resend plays: row B's ledger gets a second "Paid #42" (amber). Give up plays: row A's ledger stays empty (red). Caption: "Resend risks a duplicate. Giving up risks a loss."
5. Each receiver gains a small "seen IDs" card. Both senders resend: row A pays once; row B finds #42 on the card, skips the work and re-sends the tick. Caption: "Always resend. Let the receiver dedupe."
6. A boundary draws round the receiver and its ledger, labelled "effectively once, in here". An email API sits outside it. Caption: "Side effects outside need their own dedupe."

**The moment**: Beat 3, the curtain: two different realities collapse into one picture, which is exactly the sender's problem.
**Interaction**: One row, curtain down: the network secretly loses either the message or the reply. The viewer chooses resend or give up, then the curtain lifts. Over a few rounds no choice is always right, until dedupe is switched on and "resend" always is.
**Ending**: Both ledgers with exactly one row, the boundary drawn, the email API outside it.
**Variants**: `delivery-guarantees`, `message-deduplication`, `idempotent-consumer`, `idempotency-key`, `stream-exactly-once`; Reliability's `partial-failure` (the same curtain).
**Techniques**: side by side, token, failure, timer, spotlight, choice, boundary, contents, caption.
**Review**: Improved — the interaction now hides which loss happened (the network picks in secret), so the viewer really is in the sender's seat instead of choosing with hindsight; names the Two Generals problem the catalog folds in here; links Reliability's `partial-failure`, which uses the same curtain. Weighed a single row with a coin-flip network; the two-row curtain is the sharper first-watch picture, so it stays.

### Exactly-once in stream processing (transactions) (`stream-exactly-once`)

**The aha**: Kafka-style transactions commit the output records and the input offset as one unit, so after a crash either both count or neither does.
**Misconception to defeat**: That "exactly-once" in Kafka covers everything the processor touches, including database writes and API calls.
**Cast**: Input log (left, cells 0–5, consumer offset marker at 3), processor box (middle), output log (right). A downstream reader on the far right wearing a "read_committed" badge. An external database below the processor, outside everything.
**Opening frame**: Offset marker at 3; cells 3–5 unread; the output log holds two committed cells.
**Story**:

1. No transactions: the processor reads record 3, appends "out 3" to the output, then crashes (red flash) before moving the offset. It restarts at 3 and appends "out 3" again. Caption: "Output written, progress not: a duplicate."
2. Rewind. A dashed box opens around the output log's tail and the offset marker. The processor reads 3 and appends "out 3" as a hatched, pending cell; a ghost offset marker appears at 4. The reader's view skips hatched cells. Caption: "Begin transaction."
3. Crash. The box turns red and the transaction aborts: the ghost marker vanishes (the offset is still 3), and the hatched cell stays in the log but is struck through, "aborted". The reader steps over it. Caption: "Abort: neither the output nor the progress counts."
4. Restart and redo: hatched "out 3", ghost marker at 4, then "Commit". The box flashes green and, in the same frame, the cell turns solid and the marker snaps to 4. The reader now sees "out 3". Caption: "Commit: output and offset together."
5. Spotlight the external database: on the aborted attempt the processor also wrote a row there, and it's still there, now twice. Caption: "Outside the log, you still need idempotency."

**The moment**: Beat 4's single frame where the output cell solidifies and the offset marker moves at once, against beat 1 where they drifted apart.
**Interaction**: A crash button usable at any point in the cycle; however it's timed, output and offset end up both committed or both discarded. A read_committed toggle: switched off, the reader also reads the struck-through cell, a duplicate it should never have seen.
**Ending**: One live "out 3" beside one struck-through attempt, the offset at 4, the external table's duplicate row dimmed under a note.
**Variants**: `exactly-once-processing`, `consumer-offsets`, `message-deduplication` (the idempotent producer), `stateful-stream-processing`, `transactional-outbox`.
**Techniques**: contents, boundary, restyle, failure, spotlight, toggle, caption.
**Review**: Improved — corrected the abort: aborted records aren't deleted, they stay in the log behind an abort marker and `read_committed` is what hides them. That's how Kafka works, and it's the only reading under which the read_committed toggle means anything. The opening of the transaction is folded into one beat. Weighed a database-style "both or neither" bracket alone; showing the offset as a ghost marker inside the same box is what makes the input side visible, so it stays.

### Durable delivery and publisher confirms (`guaranteed-delivery`)

**The aha**: A send is done only when the broker confirms the message is safely stored; until then the producer keeps it and retries, and those retries are where duplicates come from.
**Misconception to defeat**: That once `send()` returns, the message is safe.
**Cast**: Producer (left) with a small tray labelled "unconfirmed". Broker (middle) with a memory chip and a disk cylinder, two smaller replica brokers beneath it. Queue contents shown inside the broker.
**Opening frame**: Producer holding envelope #1; broker memory and disk empty; replicas idle.
**Story**:

1. Fire-and-forget: the producer sends #1 and instantly crosses it off. The envelope sits in the broker's memory. Caption: "Sent and forgotten."
2. The broker crashes (red flash, grey) and restarts. Memory is empty, and so is the disk. The producer still shows a happy tick. Caption: "Gone, and nobody knows."
3. Durable, with confirms: #2 leaves the producer but a copy stays in its tray with a timer. At the broker it drops onto the disk, copies travel to both replicas, the replicas tick, and only then does a confirm tick travel back. The tray empties. Caption: "Done means stored, on disk and on replicas."
4. The same crash as beat 2 hits the broker. A replica is promoted, still holding #2. Caption: "Same crash. This time it survives."
5. #3 is stored and replicated, but its confirm tick vanishes on the way back. The tray timer runs out and the producer resends #3. The queue now holds #3 twice, the second in amber. Caption: "No confirm? Resend. Hence duplicates."

**The moment**: Beat 2 against beat 4: the identical crash, the message gone in one and safe in the other. The tray and the replicas are the whole difference.
**Interaction**: A dial for the producer's acks setting (none, leader, all replicas) and a "crash the leader" button. With none or leader-only, a crash before replication loses the message; with all, a replica takes over still holding it.
**Ending**: The promoted replica holding #2; #3 twice in the queue, with a pointer to `idempotent-consumer`.
**Variants**: `message-deduplication`, `idempotent-consumer`, `message-acknowledgement` (the consumer's end), `transactional-outbox`; named variants for Kafka `acks=all` with `min.insync.replicas` and RabbitMQ publisher confirms.
**Techniques**: token, contents, timer, failure, side by side, restyle, dial, caption.
**Review**: Improved — added the missing beat: the same broker crash as beat 2, now survived on a replica. The moment becomes one crash with two outcomes, and the ending (a promoted replica) no longer depends on something only the interaction showed. Weighed a registered-post metaphor (the receipt is the confirm); the tray already is that receipt, so no metaphor is needed.

### Idempotent consumer (`idempotent-consumer`)

**The aha**: With at-least-once delivery duplicates are certain, so make the handler safe to run twice: record the message ID in the same transaction as the change, or use operations that don't compound.
**Misconception to defeat**: That duplicates are a rare edge case the broker takes care of.
**Cast**: Queue (left) with envelope "m-17: debit $30". Consumer (middle). Database (right) with two tables: "accounts" (balance $100, also shown as a meter) and "processed" (message IDs).
**Opening frame**: Balance $100, "processed" empty, m-17 waiting.
**Story**:

1. Naive consumer: m-17 arrives, the balance drops to $70, and the consumer crashes before acking (red flash). Caption: "Work done, never acked."
2. m-17 comes back with a "delivery 2" badge. The balance drops to $40 and the meter turns red. Caption: "Same message, charged twice."
3. Rewind with an idempotent consumer. Zoom in: one transaction bracket holds two writes, "balance −30" and "insert m-17 into processed". Both rows change in one flash. Crash before the ack.
4. m-17 returns. The consumer looks it up; the m-17 row in "processed" glows. It skips the work and acks. The balance stays $70. Caption: "Seen it: skip, then ack."
5. A side card: "subtract 30" against "set balance to 70", each applied twice: $40 against $70. Caption: "Or make the operation repeat-safe."

**The moment**: Beat 4: the glowing row and a balance that doesn't move, set against beat 2's double drop.
**Interaction**: A "send duplicate" button fires m-17 again and again at a naive and an idempotent consumer side by side; one balance falls each time, the other doesn't. A toggle, "record the ID outside the transaction", lets the viewer crash between the two writes and watch a duplicate slip through, which is why the ID and the change commit together. A "two copies at once" button (as after a lock expiry) shows why the ID is the table's key: both copies start, only one commit succeeds, the other rolls back.
**Ending**: Side by side after three duplicates: naive −$20, idempotent $70.
**Variants**: `transactional-inbox`, `idempotency-key`, `message-deduplication`, `delivery-guarantees`, `visibility-timeout`.
**Techniques**: side by side, zoom, contents, meter, boundary, failure, spotlight, toggle, caption.
**Review**: Improved — beat 1's caption said the ack was "lost" when the consumer never sent it. The interaction adds two copies arriving at once, which look-up-then-skip can't stop but a unique key on the message ID can. Weighed a lift-button metaphor for idempotence; the double-charged balance is the more memorable failure, so it stays.

### Idempotency keys (`idempotency-key`)

**The aha**: The client picks one key and reuses it on every retry; the server stores each key with its result, so a retried "charge card" returns the original answer instead of charging again.
**Misconception to defeat**: That a timeout means the request didn't happen, so a retry is harmless; or that the server can spot a retry by its contents.
**Cast**: Client app (left) with a "Pay $50" button and a timer. Payment API (right) with a card ledger and a "keys" table (key → stored response). Requests are envelopes "POST /charge" with a coloured key tag.
**Opening frame**: The client about to pay; empty ledger; empty keys table.
**Story**:

1. No key: the request arrives, the ledger gets "$50", and the response is lost on the way back (red X). The client's timer runs out. Caption: "Timed out. Did it work?"
2. The client retries; the ledger gets a second "$50". Caption: "The retry charged again."
3. Rewind. The client mints a key, "9f3a" (an orange tag), once. The server checks "keys": absent. It charges and stores "9f3a → 200, ch_1". The response is lost again.
4. The retry carries the same orange tag. The lookup hits the stored row (it glows), the ledger isn't touched, and the stored response comes back: "200, ch_1". Caption: "Same key, same answer, one charge."
5. Contrast: a client that mints a new key per retry. The tag changes colour, the lookup misses, and the ledger shows two charges. Caption: "A new key per retry protects nothing."

**The moment**: Beat 4: the same-coloured tag on both trips, the lookup hitting, and a ledger that stays still.
**Interaction**: A dial for how many responses get lost; retry as often as you like and the ledger keeps one charge. A toggle switches between "reuse key" and "new key per retry".
**Ending**: One charge, one stored key, the client showing "Paid".
**Variants**: `idempotent-consumer`, `webhooks` (`webhook-id`), `message-deduplication`, `correlation-id` (looks similar, prevents nothing); Reliability's `retry-backoff-jitter`.
**Techniques**: token, exchange, contents, failure, timer, spotlight, side by side, toggle, dial, caption.
**Review**: Merged — owned by Reliability (its plan is in `reliability.part1.md`). The owner's plan should borrow four things from this one: the "new key per retry" failure (beat 5), the commonest real bug; the server returning the stored original response ("200, ch_1"), not just declining to act; the misconception that a server can recognise a retry by its contents; and the lost-responses dial. Neither plan shows a retry arriving while the first attempt is still running (the key is held: 409 Conflict) or the same key reused with a different body (rejected, 422 in the IETF draft); one interaction in the owner's plan could cover both.

### Dual-write problem (`dual-write-problem`)

**The aha**: Saving to the database and publishing to the broker are two separate writes, and a crash between them leaves one done and the other not.
**Misconception to defeat**: That two lines next to each other in one function happen together, or that a try/catch makes them atomic.
**Cast**: Order service (left of centre) with a short code card: "1 db.save(order)", "2 broker.publish(OrderPlaced)", line 2 wrapped in "try … catch: retry". A database cylinder below the service, a broker queue to its right, Shipping on the far right.
**Opening frame**: The code card with its cursor before line 1; empty database and queue; Shipping idle.
**Story**:

1. Happy path: line 1 runs and "Order 42" appears in the database; line 2 runs and an OrderPlaced envelope reaches Shipping, which packs a box. Caption: "Two writes. Usually both happen."
2. Rewind. Line 1 runs; the row appears. The cursor moves into the gap between the lines and slows. The service crashes (red flash, grey), and the catch block greys out with it: a dead process runs no catch.
3. The database has Order 42; the queue is empty; Shipping waits forever. A "never shipped" tag hangs off the row. Caption: "Saved, never announced."
4. Swap the lines, publish first. The envelope goes out and Shipping packs; the crash comes before the save. The database is empty, and Shipping holds a box for an order that doesn't exist (a ghost outline). Caption: "Announced, never saved."
5. Both end states side by side, labelled "lost event" and "phantom event". A broken link appears between the database and the broker. Caption: "No transaction covers both. Make the database the only write."

**The moment**: Beat 2's slowed crash in the gap between the lines, then the database and the broker visibly disagreeing.
**Interaction**: Drag the crash marker anywhere along the code (before, between, after) and flip the line order. Only "between" breaks, in either order, and there is always a "between".
**Ending**: The two broken states side by side, with an arrow to `transactional-outbox`.
**Variants**: `transactional-outbox`, `transactional-inbox`; Data's `change-data-capture` and `two-phase-commit`.
**Techniques**: code step (new: a short code listing whose current line highlights in step with the diagram), side by side, failure, contents, token, spotlight, dial, caption.
**Review**: Improved — the misconception names try/catch, but nothing on screen defeated it. The code card now wraps the publish in a catch-and-retry, and the crash greys the catch out with everything else. Weighed a third variant, publishing inside the database transaction before commit; flipping the line order already shows the phantom event, so it stays out.

## Events and event-driven architecture

### Event-driven architecture (`event-driven-architecture`)

**The aha**: Producers announce facts without knowing who listens, so new behaviour is added by adding a subscriber; the cost is a flow that isn't written down in any one place.
**Misconception to defeat**: That services must call each other, so every new feature means editing the caller; or that event-driven simply means microservices.
**Cast**: Two panels under one label, "the same microservices". Left, "calls": an Order service with direct arrows to Payment, Inventory and Email. Right, "events": the same Order service publishing to an event bus (centre), with Payment, Inventory and Email subscribed. Order has a small code card in each panel.
**Opening frame**: Both panels idle with the same four services; on the left the arrows leave Order, on the right they leave the bus.
**Story**:

1. Left: Order calls Payment and waits for the reply, calls Inventory and waits, calls Email and waits; a timer on Order runs throughout. Caption: "Calls: Order knows everyone and waits on everyone."
2. Right: Order publishes "OrderPlaced" once; three copies leave the bus together and Order goes idle at once. Caption: "Events: announce and move on."
3. A new requirement, "Loyalty points", arrives in both panels. Left: a new line lands in Order's code card, highlighted red, with a "redeploy Order" badge. Right: Loyalty subscribes to the bus, and Order's card is untouched, badged green "no change". Caption: "New behaviour = new subscriber."
4. Email goes down (grey) in both. Left: the call fails and so does the order. Right: Email's copy waits in its queue; the order went through. Caption: "A down consumer doesn't fail the producer."
5. The cost, on the right: Payment now emits PaymentTaken and Shipping reacts to it. A question appears, "What happens after an order?", and the answer has to be traced hop by hop through subscriptions. Caption: "The flow lives nowhere in particular."

**The moment**: Beat 3: the red redeploy on the left beside the untouched producer on the right.
**Interaction**: "Add a subscriber" and "take a service down" buttons that act on both panels at once, with a counter of edits made to Order.
**Ending**: The right panel with five subscribers. Caption: "Order has never heard of Loyalty."
**Variants**: `publish-subscribe`, `events-vs-commands`, `choreography-vs-orchestration`, `event-notification`, `event-carried-state-transfer`; Architecture's `event-sourcing` and `cqrs`.
**Techniques**: side by side, token, exchange, appear, restyle, failure, timer, path trace, caption.
**Review**: Improved — the misconception says event-driven isn't the same as microservices, but nothing showed it; both panels now sit under "the same microservices", so the left panel itself proves microservices can be entirely synchronous. Weighed a phone-calls vs noticeboard metaphor; the red redeploy badge beside the untouched producer is more concrete, so the system view stays.

### Event notification (thin events) (`event-notification`)

**The aha**: A thin event only says what changed and which item; consumers that need the details call the source back, so they still depend on it being up.
**Misconception to defeat**: That publishing events automatically decouples consumers from the producer.
**Cast**: Order service (left) with its database; broker (centre); Shipping and Analytics (right). The event is a deliberately tiny envelope: "OrderShipped · id 42".
**Opening frame**: The tiny envelope beside the Order service, whose database shows a rich order row (address, items, totals).
**Story**:

1. Order publishes the tiny envelope; copies reach Shipping and Analytics. Caption: "Order 42 changed."
2. Both consumers call back to Order, "GET /orders/42", and a full order card returns to each. The callback arrows run right to left, against the flow. Caption: "Need details? Ask the source."
3. A burst of 100 events; 200 callbacks swarm back into Order, whose load meter climbs. Caption: "Every event becomes a read on the source."
4. Order goes down (red flash, grey). A new event is already queued; Shipping receives it, calls back, and fails. Shipping stalls. Caption: "Source down: the event alone isn't enough."
5. Order recovers and changes order 42 again before Analytics calls back; Analytics gets version 3, not the version 2 the event announced. Caption: "And you read today's state, not the event's."

**The moment**: Beat 2: the callback arrows turning round and heading back to the producer, showing a dependency the event diagram hid.
**Interaction**: A thin/fat toggle shared with `event-carried-state-transfer`: same scene, same outage, and the viewer sees which consumers keep working.
**Ending**: Freeze with the callback arrows highlighted. Caption: "Small events, hidden dependency."
**Variants**: `event-carried-state-transfer`, `events-vs-commands`, `claim-check` (also sends a reference, not the data), `webhooks` (thin webhook payloads).
**Techniques**: token, exchange, path trace, meter, failure, toggle, caption.
**Review**: Keep — callback arrows turning round against the flow are the clearest picture of the dependency a thin event hides, and beat 5 (reading today's state, not the event's) is a real subtlety most explanations miss. Weighed thin and fat side by side throughout; the shared toggle with `event-carried-state-transfer` gives that comparison without doubling every scene.

### Event-carried state transfer (fat events) (`event-carried-state-transfer`)

**The aha**: Fat events carry the state itself, so consumers keep their own copy and never call back; the price is duplicated data that is only eventually consistent.
**Misconception to defeat**: That this is event sourcing, or that the copies are always current.
**Cast**: Customer service (left) with a database row "Customer 7 · 12 Elm St". Broker (centre). Shipping (right) with its own small table, "customers (copy)", holding the same row. Events are large envelopes with their fields visible.
**Opening frame**: The source row and the copy both reading "12 Elm St", joined by a faint dotted line labelled "copy".
**Story**:

1. Customer 7 moves: the source row changes to "9 Oak Ave", and an envelope "AddressChanged · 7 · 9 Oak Ave · city · postcode" is published. Caption: "The event carries the data."
2. It reaches Shipping and the copy row updates. Caption: "Consumers keep their own copy."
3. Shipping needs the address for a parcel: a short arrow into its own table, and no arrow leaves Shipping. Caption: "No callback."
4. Customer service goes down (red flash, grey). Shipping keeps labelling parcels. Caption: "The source can be down."
5. Customer service recovers and Customer 7 moves again, to "3 Pine Rd"; the event is slow in transit. For a moment the source says Pine and the copy says Oak, both rows amber, a stopwatch counting the gap. The event lands and they match. Caption: "Copies lag: eventually consistent."
6. A storage meter appears beside every consumer that keeps a customer copy. Caption: "Same data, stored many times."

**The moment**: Beat 4, against the same outage in `event-notification`: here the consumer keeps working with the source greyed out.
**Interaction**: The shared thin/fat toggle, and a dial for event delay that stretches the stale window in beat 5.
**Ending**: Both rows matching. Caption: "Independence, paid for in copies."
**Variants**: `event-notification`, `log-compaction` (a compacted topic as the full copy for new consumers), `stream-table-duality`; Architecture's `event-sourcing` and `cqrs`; Data's `strong-vs-eventual-consistency`.
**Techniques**: contents, token, failure, timer, restyle, meter, toggle, dial, caption.
**Review**: Keep — the same outage as `event-notification` with the opposite result is exactly the right moment, and the stopwatch on the stale window makes "eventually consistent" something you watch rather than read. The event-sourcing confusion is left to the variant link on purpose: showing it would be a second idea. Weighed a cache metaphor; the copy table is the real thing and needs no analogy.

### Domain events vs integration events (`domain-vs-integration-events`)

**The aha**: Internal domain events stay inside the service; a translator at its edge publishes stable, versioned integration events, so the internals can change without breaking anyone.
**Misconception to defeat**: That every event a service raises internally should be published as it is.
**Cast**: A large boundary box, "Ordering service". Inside, Cart, Pricing and Checkout components exchange small, many-coloured internal envelopes ("ItemAdded", "DiscountApplied", "OrderSubmitted"). On the boundary edge, a translator gate. Outside, a public topic and two subscribers, Shipping and Billing.
**Opening frame**: Busy inside, calm outside; the gate is the only opening in the boundary.
**Story**:

1. Internal events zip between the components. Caption: "Domain events: the service talking to itself."
2. "OrderSubmitted" reaches the gate and comes out as a different envelope, "OrderPlaced v1 · orderId · total · items", wearing a contract badge. It goes to the topic, then to Shipping and Billing. Caption: "Integration event: the public contract."
3. The team refactors: "DiscountApplied" becomes "PromotionRedeemed", internal envelopes change shape and colour, and the gate gets a small update. Outside, OrderPlaced v1 looks exactly the same; Shipping and Billing stay green. Caption: "Change the inside freely."
4. A second panel slides in: the same service with no gate, publishing its internal events raw. The same refactor runs, and Billing, which consumed "DiscountApplied", turns red: "unknown event". Caption: "Leak internals, and every refactor breaks someone."

**The moment**: Beats 3 and 4 side by side: the identical refactor, green outside on one side and red on the other.
**Interaction**: A "refactor internals" button and a toggle between "translate at the edge" and "publish raw".
**Ending**: The gated service with churn inside and a steady stream of identical v1 envelopes outside.
**Variants**: `event-schema-evolution`, `schema-registry`, `message-transformation`, `transactional-outbox` (often where integration events are written); Architecture's `bounded-context` and `domain-driven-design`.
**Techniques**: boundary, token, restyle, side by side, toggle, failure, caption.
**Review**: Improved — fixed a dangling link: Architecture has no `domain-events`; the boundary drawn here is a `bounded-context`, so that and `domain-driven-design` are the neighbours. The plan itself stays: the identical refactor, green outside one boundary and red outside the other, is the sharpest contrast available. Weighed a kitchen-and-menu metaphor; a boundary with one gate already reads that way.

### Event schema evolution and versioning (`event-schema-evolution`)

**The aha**: Producers and consumers upgrade at different times and old events stay in the log, so every change must be readable by consumers you haven't upgraded and by events already written.
**Misconception to defeat**: That it works like API versioning, where you update both sides and only live callers matter.
**Cast**: A log (centre) of numbered cells, each event showing its fields as labelled stripes ("id", "amount"). A producer (left) and Consumers A and B (right), each wearing a version badge. Under the scene, a deploy lane: a timeline marking when each one upgraded.
**Opening frame**: Cells 0–4, all v1 (blue stripes); producer, A and B all on v1.
**Story**:

1. The producer deploys v2 (marked on the deploy lane), adding an optional "currency" field. Cells 5–6 carry an extra stripe. A, still on v1, reads cell 5, ignores the stripe: green tick, and a "forward compatible" badge. Caption: "Add an optional field: old readers ignore it."
2. B upgrades to v2 and reads old cell 2, which has no currency; it fills in the default "USD": green, and a "backward compatible" badge. Caption: "New readers handle old events."
3. The producer deploys v3, renaming "amount" to "total". Cell 7 has no "amount". A reads it: red flash, crash. Caption: "Rename or remove: old readers break."
4. A new Consumer C starts from offset 0 and reads across v1, v2 and v3 cells, its path hopping colours. Caption: "Old events live on. You'll read them again."
5. The fix: the producer publishes the new shape as a new event type, "PaymentRecorded.v2", alongside v1 until every consumer has moved. Caption: "Breaking change? New type, run both."

**The moment**: Beat 3: two greens, then a red, with the deploy lane showing why: the producer moved and A hadn't.
**Interaction**: A change picker (add an optional field, add a required field, remove a field, rename, change a type), each tried on three readers: an old consumer on new events, a new consumer on old events, and a replay from the start. The viewer builds the compatibility table by hand.
**Ending**: The grid the viewer built: one row per change, columns backward, forward and full; "add optional" green across, "rename" red across.
**Variants**: `schema-registry`, `domain-vs-integration-events`, `cloudevents`, `retention-and-replay`; Data's `expand-contract-migration`; Delivery's `contract-testing`; Architecture's `api-versioning` (the contrast).
**Techniques**: contents, restyle, lanes, failure, path trace, choice, caption.
**Review**: Improved — beats 1 and 2 now attach "forward compatible" and "backward compatible" at the moment each happens; before, the terms first appeared in the ending grid with nothing to hang on. The ending grid is described correctly (a rename fails every column, not one cell), and a dangling link was fixed (`consumer-driven-contracts` → Delivery's `contract-testing`, plus `api-versioning` for the misconception). Weighed an API-versioning panel beside the log; beat 4's replay already shows what API versioning never has to face.

### Schema registry and event contracts (`schema-registry`)

**The aha**: The registry checks each new schema version against a compatibility rule before the producer can use it, so a breaking change is rejected before it reaches any consumer.
**Misconception to defeat**: That schema problems are found by consumers at runtime, or that this is a database migration tool.
**Cast**: Producer (left), topic (centre), consumers (right). Above the topic, a registry drawn as a filing cabinet with a drawer "orders: v1" and a rule badge "BACKWARD (default)". Envelopes carry a tiny ID stamp and a compact binary body.
**Opening frame**: The registry holding v1 (schema #21); the producer about to send.
**Story**:

1. The producer asks the registry for its schema's ID and gets "#21". The envelope it sends carries just "#21" and a compact body. Caption: "Messages carry an ID, not the schema."
2. A consumer reads "#21", fetches schema 21 once, caches it and decodes. Caption: "Readers look the schema up."
3. The producer team adds an optional field and registers v2. The registry runs its check (a checklist ticks down), passes it, and issues "#22". Caption: "Compatible: accepted."
4. Next they change "amount" from a number to text and try to register v3. The check fails; the registration bounces back to the producer stamped "incompatible", and the send never happens. Consumers stay green. Caption: "Breaking change stopped at the source."
5. A second panel with no registry: the same v3 message goes straight onto the topic and a consumer expecting a number crashes. Caption: "Without the gate, consumers find out."

**The moment**: Beat 4 beside beat 5: a red bounce at the producer against a red crash at the consumer.
**Interaction**: A dial for the compatibility mode (BACKWARD, FORWARD, FULL, NONE) and a picker for the change; the viewer sees which combinations are accepted, and that the mode decides who must upgrade first (removing a required field passes BACKWARD, so consumers go first, but fails FORWARD).
**Ending**: The cabinet with v1 and v2 filed and v3 struck through.
**Variants**: `event-schema-evolution`, `cloudevents`, `message-anatomy`; AsyncAPI as a follow-on.
**Techniques**: exchange, token, boundary, contents, failure, side by side, dial, choice, caption.
**Review**: Improved — fixed a technical error. Under BACKWARD, the default, removing a field (even a required one) is allowed, so beat 4's "remove a required field" would have been accepted. The rejected change is now a type change (number to text), which fails every mode except NONE and also crashes the old consumer in beat 5's panel. The interaction now says the mode decides who upgrades first. Weighed showing the check as a CI step rather than at send time; the bounce at the producer is the more visible gate.

## Flow control and load

### Queue-based load leveling (`queue-based-load-leveling`)

**The aha**: A queue turns a spike into a backlog, so the service works at its own steady rate and can be sized for average load; the price is that work waits.
**Misconception to defeat**: That the service must be sized for peak, or that adding a queue makes processing faster.
**Cast**: Two lanes. Top: a web front end streaming straight into a service with a capacity meter "10/s". Bottom: the same front end into a queue tube, then the same service. Under each lane, a chart of arrivals (thin line) and work done (thick line).
**Opening frame**: Both lanes at a calm 5/s; both charts flat.
**Story**:

1. A spike: arrivals jump to 50/s for ten seconds, and the thin line spikes in both charts.
2. Top: envelopes pile into the service, its meter goes red, it crashes (red flash, grey) and requests bounce back red. Caption: "Direct: the spike hits the service."
3. Bottom: the same spike piles into the tube, which fills while a depth meter climbs. The service keeps working at 10/s. Caption: "Queued: the spike becomes a backlog."
4. The spike ends. The tube drains steadily, and the bottom chart's thick line stays flat at 10/s long after the thin line drops. The areas under the two lines shade equal. Caption: "Same work, spread out."
5. The last envelope of the spike carries a stopwatch: "waited 40 s". Caption: "Work waits: fine for an invoice, not for a login."

**The moment**: Beat 4's chart: a spiky line in, a flat line out, and the queue depth rising and falling between them.
**Interaction**: Dials for spike height, spike length and service rate. If average arrivals exceed the service rate, the backlog never drains: leveling only buys time, and past that you need more consumers.
**Ending**: Both charts frozen: dropped requests on top, a backlog hump and zero drops below. Caption: "A 10/s service survived a 50/s spike."
**Variants**: `backpressure`, `consumer-lag`, `competing-consumers`, `async-request-reply` (how the caller gets its answer later); Scaling's `queue-load-levelling` (the same concept, see review), `autoscaling` and `littles-law`; Architecture's `web-queue-worker`.
**Techniques**: side by side, stream, contents, meter, chart, failure, timer, dial, caption.
**Review**: Improved — dropped beat 6: the service "shrinking to average" was vague, and the 10/s service surviving a 50/s spike already proves the point, which the ending now says. The stopwatch now says when leveling fits (an invoice can wait, a login can't), borrowed from Scaling's plan, and is pinned to the last envelope of the spike, the one that really waits 40 s. Flag: Scaling catalogues the same concept as `queue-load-levelling` (already shipped), under a different id that `tools/catalog.py` doesn't reconcile; one of the two should merge into the other. Weighed Scaling's opener (size for the peak and pay for idle servers); the side-by-side crash is the sharper contrast, so it stays.

### Backpressure (`backpressure`)

**The aha**: When a stage can't keep up it tells the stage before it to slow down, so the slowest stage sets the pace; without that, overload piles up in a buffer until something bursts.
**Misconception to defeat**: That a bigger (or unbounded) buffer solves overload.
**Cast**: A three-stage pipeline: Source (fast), Transform, and Sink (a database writer, 20/s). Buffers between stages are tubes, each with a memory meter. Slow-down signals are amber pulses (never red: this is the system working) that travel right to left, against the flow.
**Opening frame**: The pipeline flowing evenly at a low rate.
**Story**:

1. The source speeds up to 100/s. The buffer before the sink grows, its tube stretching longer and longer as its memory meter climbs. Caption: "No backpressure: the buffer just grows."
2. The meter hits red; the sink stage crashes (red flash) and the buffered envelopes scatter and fade. Caption: "Until it bursts, and takes the backlog with it."
3. Rewind. The tubes now have a fixed length, "max 10". The sink's buffer fills; a pulse travels back to Transform, which pauses. Its buffer fills; the pulse travels on to Source, which slows to 20/s. Slow motion. Caption: "Full buffer: push back."
4. Steady state: every stage flows at 20/s, buffers hold steady, meters flat. Caption: "The slowest stage sets the pace."
5. A quick row of three insets: credits travelling upstream ("send me 5 more"), a producer blocked on a full buffer, an HTTP 429 at the front door. Caption: "Same idea, different signals."
6. The pulse reaches the users at the very front. Caption: "At the edge, someone waits, or work is shed."

**The moment**: Beat 3: the pulse hopping upstream stage by stage until the source visibly slows.
**Interaction**: A backpressure on/off toggle and a dial for sink speed; the memory meters either level off or climb to a crash. With backpressure off, a buffer-size dial shows a bigger buffer only moves the crash later.
**Ending**: The pipeline flowing at the sink's rate, every meter flat.
**Variants**: `push-vs-pull-delivery` (pull as built-in backpressure), `consumer-prefetch`, `queue-based-load-leveling`; Scaling's `rate-limiting`, `throttling`, `load-shedding` and `admission-control`.
**Techniques**: stream, contents, meter, token, failure, side by side, toggle, dial, caption.
**Review**: Improved — the slow-down pulse was red, which this area reserves for crashes; it's now amber, so backpressure reads as the system working, not failing. Added a buffer-size dial, borrowed from Scaling's own `backpressure` plan (which should be marked Merged, since this area owns the id): a bigger buffer only delays the crash, the direct answer to the misconception. Weighed a motorway ramp-meter metaphor; the pipeline is the real thing and the backward pulse already carries the idea.

### Prefetch and consumer concurrency (`consumer-prefetch`)

**The aha**: Prefetch is how many unacked messages a consumer holds at once: too few and workers sit idle between round trips, too many and one worker hoards messages the others could have done.
**Misconception to defeat**: That a higher prefetch is always faster.
**Cast**: A queue (left) with 12 envelopes. Three consumers (right), each with a "hand" of slots showing the messages it holds, and a work area. Under each consumer, a timeline lane: solid while it works, grey while it waits. A round-trip latency label on the links.
**Opening frame**: Twelve envelopes queued, a prefetch dial at 1, three empty hands.
**Story**:

1. Prefetch 1: each consumer takes one, works, acks, then waits for the next to cross the link. The lanes are striped with grey gaps. Caption: "Prefetch 1: idle between every message."
2. The dial turns to 4. Hands fill; while one message is worked on, the next is ready. The lanes go solid and a throughput meter rises. Caption: "A few in hand: no waiting."
3. The dial turns to 50, and consumer 1 happens to connect first: its hand swallows all twelve. Consumers 2 and 3 arrive to an empty queue and sit with empty hands and grey lanes. Caption: "Too many: one hoards, the rest starve."
4. Consumer 1 hits a slow message. Lock timers on the messages in its hand tick down; the last few expire (red), reappear in the queue and are delivered again elsewhere. Caption: "Held past the lock: delivered twice."
5. Separately, a concurrency dial on one consumer: at 10 parallel calls the fragile database it writes to turns red; at 3 it stays green. Caption: "Cap concurrency to protect what's downstream."

**The moment**: Beat 3: one consumer with an overflowing hand beside two with nothing, the unfairness obvious at a glance.
**Interaction**: Dials for prefetch (1–50), processing time and concurrency, with the per-consumer lanes and the throughput meter responding live, so the viewer can find the sweet spot. An "add a consumer" button: at prefetch 50 the newcomer finds nothing to do, which is how autoscaled workers end up idle.
**Ending**: A small prefetch, three solid lanes, no expired locks.
**Variants**: `competing-consumers`, `visibility-timeout`, `backpressure`, `push-vs-pull-delivery`, `consumer-lag`.
**Techniques**: dial, contents, lanes, meter, timer, failure, token, caption.
**Review**: Improved — made the hoarding beat accurate. With all three consumers connected, brokers deal messages round-robin to whoever has room, so nobody simply "grabs all twelve"; hoarding happens when one consumer fills its buffer before the others arrive. That is also why autoscaled workers can find nothing to do, now an interaction. Weighed a card-dealing metaphor (hand size); the hand of slots already is one, so it stays.

## Distributed transactions and workflows

### Transactional outbox (`transactional-outbox`)

**The aha**: Write the business change and the outgoing message into the same database in one transaction, and let a relay publish it afterwards; nothing is lost or invented, at worst it's sent twice.
**Misconception to defeat**: That publishing straight after the commit is good enough, or that the outbox is event sourcing.
**Cast**: Order service; a database with two tables, "orders" and "outbox"; a relay (a small pump) between the database and the broker; the broker; Shipping (right). A small inset in the corner replays the `dual-write-problem` crash.
**Opening frame**: The inset showing the dual write's two broken end states, and the main scene with an empty outbox table.
**Story**:

1. A transaction bracket wraps both tables. "Order 42" appears in orders and "OrderPlaced 42" in outbox, in the same flash. Commit: the bracket flashes green. Caption: "One transaction: the order and the message."
2. The service crashes right after the commit (red, grey). The outbox row is still there. Caption: "Crash now? The message is safe in the database."
3. Replay with the crash mid-transaction: neither row appears. Caption: "Or neither happens. Never just one."
4. The relay scans the outbox, picks up the row, publishes the envelope, then ticks the row "sent". Shipping receives it.
5. The relay crashes after publishing but before ticking. It restarts and publishes 42 again; Shipping gets an amber duplicate and its dedupe check drops it. Caption: "The relay may resend. Consumers must be idempotent."
6. The pump is swapped for a reader tailing the database's change log. Caption: "Poll the table, or tail the log."

**The moment**: Beat 1: two rows appearing under one bracket in one flash, right beside the inset where the crash split them.
**Interaction**: A crash button the viewer can press at any moment; the outcome is always consistent, at worst a duplicate. A relay toggle: polling or log tailing.
**Ending**: Shipping with one effect, the inset crossed out, and the sent outbox rows swept away while the orders table stays. Caption: "The outbox is a mailbox, not a history."
**Variants**: `dual-write-problem`, `transactional-inbox`, `idempotent-consumer`; Data's `change-data-capture`; Architecture's `event-sourcing` (contrast).
**Techniques**: boundary, contents, token, failure, side by side, toggle, restyle, caption.
**Review**: Improved — the misconception names event sourcing, but nothing on screen separated the two; the ending now sweeps away sent outbox rows while the orders table stays the source of truth ("a mailbox, not a history"). Weighed a letter-in-the-out-tray metaphor; the table literally is that tray, so the system view stays.

### Transactional inbox (`transactional-inbox`)

**The aha**: The receiver stores each incoming message, keyed by its ID, in an inbox table in one local transaction before acking, then works from the inbox; duplicates bounce off the key and nothing acked is lost.
**Misconception to defeat**: That acking after processing is enough on its own.
**Cast**: Laid out as the outbox's mirror image: broker (left), Billing service, and a database with "inbox" (message ID, status) and "invoices" tables. A dimmed copy of the outbox scene sits on the far left so the symmetry shows.
**Opening frame**: Outbox (dimmed, left) → broker → inbox (lit, right), captioned "sending side / receiving side".
**Story**:

1. Message m-9 arrives. In one transaction Billing inserts "m-9 · received" into the inbox; then it acks (a tick travels back). Caption: "Store it, then ack."
2. A worker takes the inbox row and, in a second transaction, writes the invoice and marks the row "done". Caption: "Work from the inbox."
3. Crash after storing, before the ack. The broker redelivers m-9; the insert hits the existing key and the row flashes. Billing acks and drops it. Caption: "Seen this ID: ignore it."
4. Crash after the ack, before the work. On restart the worker finds "m-9 · received" and finishes it. Caption: "Acked but not done? Still in the inbox."
5. The dimmed outbox lights up and the whole pipeline glows end to end. Caption: "Outbox to send, inbox to receive."

**The moment**: Beat 3, the duplicate bouncing off the stored key, then the full mirror reveal in beat 5.
**Interaction**: Crash and "send duplicate" buttons usable at any point; whatever the timing, each message is processed once and never lost.
**Ending**: Outbox → broker → inbox, every row ticked.
**Variants**: `transactional-outbox`, `idempotent-consumer`, `message-acknowledgement`.
**Techniques**: side by side, contents, boundary, failure, token, spotlight, caption.
**Review**: Keep — laying it out as the outbox's mirror makes the idea land at a glance, and the two crash points (before the ack, after the ack) each show one half of what the inbox buys: dedupe, and a durable hand-off. Weighed folding it into `idempotent-consumer`; beat 4 (acked but not yet done) is what the inbox adds, so it earns its own plan.

### Saga (`saga`)

**The aha**: Across services you can't lock and roll back, so a saga commits local steps one after another and, if a later step fails, runs compensating steps backwards; meanwhile everyone can see the in-between states.
**Misconception to defeat**: That one ACID transaction can span the services, so a failure leaves everything as if it never happened.
**Cast**: Four columns, Order, Payment, Inventory and Shipping, each with its own small database. A progress strip across the top. A customer icon in the corner watching an order status badge.
**Opening frame**: Four services and four databases; the status badge empty.
**Story**:

1. A large dashed box tries to wrap all four databases, labelled "one transaction?", then cracks and fades. Caption: "No transaction spans services."
2. Order commits "Order 42 · PENDING" (green tick) and sends a message on. Caption: "Step 1: a local commit."
3. Payment commits "Charge $50" and sends a message on. Caption: "Step 2: another."
4. Inventory: out of stock. Red flash. Caption: "Step 3 fails. Steps 1 and 2 are already committed."
5. Compensations run right to left in amber: Payment adds a new row, "Refund $50", beneath the charge (which stays); Order changes to "CANCELLED". Caption: "Undo by doing: refund, cancel."
6. Spotlight the customer icon: during beats 2–4 it saw "PENDING" and a $50 charge on its card. Caption: "In between, others see partial state."

**The moment**: Beat 5: compensation travelling backwards, and the payment table keeping both the charge and the refund. History is added to, not erased.
**Interaction**: Choose which step fails (1–4) and watch exactly the earlier steps compensate, in reverse order. A toggle shows an imaginary rollback (rows erased) against compensation (rows added).
**Ending**: Four consistent databases: order cancelled, charge and refund, stock untouched, nothing shipped.
**Variants**: `compensating-transaction`, `choreography-vs-orchestration`, `durable-execution`, `routing-slip`, `transactional-outbox`; Data's `two-phase-commit`.
**Techniques**: lanes, token, path trace, contents, failure, spotlight, choice, toggle, caption.
**Review**: Keep — the cracking "one transaction?" box defeats the misconception in the first beat, the payment table keeping both the charge and the refund is the right moment, and the customer's view of the in-between states covers the cost most explanations skip. Weighed a trip-booking scenario; `compensating-transaction` uses that one, and keeping the order flow here lets the two plans divide the work.

### Choreography vs orchestration (`choreography-vs-orchestration`)

**The aha**: In choreography each service reacts to the last event, loose but with the flow written nowhere; in orchestration one orchestrator sends commands, so the flow is explicit and easy to change, at the cost of a central component.
**Misconception to defeat**: That this is about container orchestration, or that choreography is always the more decoupled choice.
**Cast**: Two panels with the same four services (Order, Payment, Inventory, Shipping). Left: the services around an event bus. Right: an orchestrator in the centre holding a step checklist, with spokes out to each service.
**Opening frame**: Both panels idle, labelled "choreography" and "orchestration".
**Story**:

1. Left: OrderPlaced → Payment reacts and emits PaymentTaken → Inventory reacts and emits StockReserved → Shipping. The path hops from service to service. Caption: "Each reacts to the last event."
2. Right: the orchestrator sends "Charge" to Payment and gets a reply, then "Reserve", then "Ship", ticking its checklist. Caption: "One conductor sends commands."
3. "Where is the flow written?" Left: four subscription snippets light up, one in each service. Right: one checklist lights up. Caption: "Spread out, or in one place."
4. Add a fraud check before payment. Both panels gain a Fraud service. Left: Payment must switch from listening for OrderPlaced to FraudCleared, a red edit mark on an existing service. Right: one line is inserted in the checklist and no existing service changes. Caption: "Change the flow: edit the services, or edit the conductor."
5. Inventory stalls. Left: the chain just stops, and nothing notices. Right: the orchestrator's timer fires, "Inventory timed out", and it retries. Caption: "Who notices when it stops?"
6. Spotlight the orchestrator with every arrow running through it. Caption: "The price: one component that knows the whole flow."

**The moment**: Beat 3: scattered lights on the left against one lit checklist on the right.
**Interaction**: "Add a step" and "stall a step" buttons that act on both panels at once, with a count of services edited.
**Ending**: Side by side, labelled "loose, implicit" and "explicit, central".
**Variants**: `saga`, `durable-execution`, `routing-slip`, `event-driven-architecture`, `events-vs-commands`.
**Techniques**: side by side, path trace, token, exchange, spotlight, timer, failure, caption.
**Review**: Improved — beat 4 said two services change under choreography, but Fraud is new in both panels; the edit that matters is Payment re-subscribing to FraudCleared, so the beat now counts existing services edited, one against none. Weighed the dance-and-conductor metaphor the names come from; the orchestrator's checklist already plays the conductor, so no extra metaphor is needed.

### Compensating transaction (`compensating-transaction`)

**The aha**: A finished step can't be erased, only countered by a new action; compensations can fail too, so they must be retryable and idempotent, and some steps can't be undone at all.
**Misconception to defeat**: That compensating is a rollback that makes the step disappear.
**Cast**: A trip booking: Flight, Hotel and Car services, each with a ledger, plus an Email lane holding sent emails.
**Opening frame**: Flight "Booked F-3" and Hotel "Booked H-7" in their ledgers; a "Trip confirmed!" email already sent; Car pending.
**Story**:

1. Car fails (red flash). Caption: "The trip can't complete."
2. An eraser sweeps toward the Flight and Hotel rows, then is crossed out. Caption: "You can't erase a committed step."
3. Hotel's ledger gets a new row under the booking, "Cancel H-7"; Flight's gets "Refund F-3, less $50 fee". Both originals stay visible. Caption: "Counter it: cancel, refund."
4. Flight's refund call errors (red). A backoff timer runs, and the retry, carrying the same idempotency key, succeeds; the ledger shows one refund, not two. Caption: "Compensations fail too. Retry them safely."
5. The Email lane: "Trip confirmed!" can't be unsent, so a second email follows, "Sorry, your trip was cancelled". Caption: "Some steps can only be apologised for."

**The moment**: Beat 3: the ledgers getting longer, not shorter, beside the crossed-out eraser.
**Interaction**: Choose which step fails and see which compensations run; a toggle makes a compensation keep failing, showing retries and finally a "needs a human" flag.
**Ending**: Each ledger holding an action and its counter-action, two emails, and a note: "Put steps you can't undo last."
**Variants**: `saga`, `idempotency-key`, `durable-execution`, `routing-slip`; Reliability's `retry-backoff-jitter`.
**Techniques**: contents, side by side, failure, timer, restyle, choice, toggle, caption.
**Review**: Keep — the crossed-out eraser and ledgers that grow instead of shrinking make "counter, don't erase" unmistakable, and the refund with a fee, the idempotent retry and the email that can't be unsent cover every catalog point in five beats. Weighed reusing the saga's order flow; the trip has a step that truly can't be undone, which the order flow lacks.

### Workflow engines and durable execution (`durable-execution`)

**The aha**: Workflow code reads as ordinary sequential code, but the engine records each step's result; after a crash it replays the code against that history, skipping finished steps, and carries on at the same line, even days later.
**Misconception to defeat**: That a long-running process needs a server staying alive the whole time, or has to be built from queues, state tables and cron jobs.
**Cast**: A code card (left): `charge(card)`, `reserve(items)`, `sleep(3 days)`, `sendReminder()`, `ship()`. A worker box (centre) that runs it. An event history (right): a vertical list the engine appends to. Payment, Inventory and Shipping services along the bottom.
**Opening frame**: The code card, an idle worker, an empty history.
**Story**:

1. Line 1 highlights; the worker calls Payment, and "charge → ch_1" is appended to the history. Line 2 does the same with Inventory. Caption: "Every step's result is recorded."
2. Line 3: a timer card appears in the history and the worker fades out completely. A calendar flicks through three days, and meanwhile the machine the worker ran on crashes (red, grey). Caption: "Waiting costs nothing: nothing is running."
3. The timer fires; a fresh worker appears and runs the code from the top. Line 1 doesn't call Payment: a ghost arrow fetches "ch_1" from the history instead. Line 2 the same. The highlight lands on line 4. Slow motion. Caption: "Replay: finished steps come from history, not real calls."
4. Line 4 makes a real call, which is recorded. Line 5 fails; the engine retries with backoff (timer badges) until it succeeds. Caption: "Retries and timers come from the engine."
5. An inset shows the do-it-yourself version: queues, a state table, a cron job and a retry table in a tangle of arrows. Caption: "Instead of building this."

**The moment**: Beat 3: the code running again while its calls short-circuit into the history, Payment not charged twice, and the highlight arriving exactly where it left off.
**Interaction**: A "kill the worker" button: finished steps are never called again, but a step killed mid-call is retried, so steps should be idempotent. Scrubbing the history moves the code highlight. A "break determinism" button adds `if (random() > 0.5)` before line 2; on replay the code no longer matches the history and the engine stops: "non-deterministic".
**Ending**: All five lines ticked, a full history beside them.
**Variants**: `saga`, `choreography-vs-orchestration`, `compensating-transaction`, `scheduled-messages`, `idempotency-key`; engine versions: Temporal, Azure Durable Functions and Logic Apps, AWS Step Functions, Google Cloud Workflows.
**Techniques**: code step, contents, token, failure, timer, spotlight, side by side, dial, caption.
**Review**: Improved — corrected the interaction's promise of "no repeated calls" wherever the worker is killed: a step killed mid-call has no recorded result and is retried (Temporal activities are at-least-once), so steps still need to be idempotent. Added a "break determinism" button, which turns the main rule of workflow code into something to break rather than a lecture. Folded the crash beat into the waiting beat to pay for it. Weighed a game save-point metaphor; the history list already is the save file.

### Routing slip (`routing-slip`)

**The aha**: The message carries its own itinerary; each step does its work, ticks its line and forwards the message to the next address, so there's no orchestrator and no step knows what comes after it.
**Misconception to defeat**: That steps in a sequence need either a central orchestrator or services wired to each other's events.
**Cast**: Four services scattered around the canvas, not in a line: Validate, Enrich, Price, Store. The message is an envelope with a slip clipped to it: a short numbered list of addresses.
**Opening frame**: The envelope at the entry with a blank slip; the services idle.
**Story**:

1. At the entry, the slip is written: "1 Validate, 2 Enrich, 3 Price, 4 Store". Caption: "The route is decided once, at the start."
2. The envelope travels to Validate, which does its work, ticks line 1, reads line 2 and forwards it. Caption: "Each step reads the next stop off the slip."
3. On through Enrich and Price, ticking as it goes. Zoom into Price: its only routing logic is "forward to slip.next". Caption: "No step knows what comes after it."
4. A second envelope enters with a shorter slip, "Validate, Store", and takes a different path through the same, unchanged services. Caption: "Different slip, different route, same services."
5. Store fails on the first envelope. Each ticked line left an undo note ("Price: release quote Q-9"); the envelope travels back along the ticked steps, running each note. Caption: "The slip can carry the way back too."

**The moment**: Beat 4: two envelopes taking different paths through identical services, with the slip as the only difference.
**Interaction**: Edit the slip (reorder, add or remove lines) and send a message; the path changes and no service does.
**Ending**: Both slips fully ticked, both paths drawn faintly.
**Variants**: `choreography-vs-orchestration`, `saga`, `compensating-transaction`, `content-based-router`.
**Techniques**: token, contents, path trace, zoom, side by side, failure, choice, caption.
**Review**: Keep — two envelopes taking different paths through unchanged services, with the slip as the only difference, is the cleanest proof that the route travels with the message, and scattering the services stops viewers reading wiring into the layout. Weighed an airline baggage tag; the slip is already a physical metaphor, and the undo notes in beat 5 extend it naturally.

## Conversations: request-reply, correlation and callbacks

### Request-reply over messaging (`request-reply-messaging`)

**The aha**: A request carries a reply-to address and a correlation ID; the responder answers to that address and the requester matches replies to requests, so you get answers over messaging but must handle waiting, timeouts and late replies yourself.
**Misconception to defeat**: That messaging is one-way only, or that a request over messaging behaves just like an HTTP call.
**Cast**: Requester (left) with its own small reply queue beside it, "replies-A", and a "pending" list. Request queue (centre). Responder (right). Envelopes show two header fields, "reply-to" and "corr".
**Opening frame**: Empty queues and an empty pending list.
**Story**:

1. The requester sends "reply-to: replies-A · corr: 7". A pending card "7 · waiting" appears with a timer. Caption: "The request says where to reply."
2. It sends another, corr 8, and a second pending card appears. Caption: "Several in flight, each tracked by ID."
3. The responder answers 8 first: it reads the reply-to field (highlighted) and sends the reply to replies-A. Then 7. Each reply snaps onto its pending card by matching colour. Caption: "Replies come back in any order; the ID matches them."
4. Request 9 meets a slow responder. Its timer runs out, the card turns red, "9 · timed out", and the requester moves on. Caption: "No reply in time: give up."
5. Reply 9 arrives later and finds no card; it drops into a "late" tray. Caption: "Late replies need a plan too."

**The moment**: Beat 3: replies arriving out of order and each snapping onto the right pending card by its colour.
**Interaction**: Dials for responder delay and requester timeout; matches, timeouts and late replies shift as they change.
**Ending**: An empty pending list and one envelope in the late tray.
**Variants**: `correlation-id`, `async-request-reply`, `sync-vs-async-communication`, `scatter-gather`, `message-anatomy`.
**Techniques**: token, exchange, contents, timer, restyle, failure, dial, caption.
**Review**: Keep — replies arriving out of order and snapping onto the right pending card is the whole mechanism in one picture, and the timeout and the late-reply tray show the costs the catalog names. Weighed an HTTP call alongside for contrast; `sync-vs-async-communication` already does that, so the plan rightly spends its time on matching.

### Correlation ID (`correlation-id`)

**The aha**: One ID, copied from the first message onto every message, reply and log line that follows from it, ties a conversation back together across queues and services; a causation ID records which message caused which.
**Misconception to defeat**: That it's the same as a message ID (new on every message) or an idempotency key (which prevents repeats).
**Cast**: A flow: API → queue → Order → topic → Payment and Inventory, then Payment → Email. Each envelope carries a message ID (new at each hop), a purple correlation tag "c-42" and a small causation pointer. Beneath, a log panel with lines from every service.
**Opening frame**: The flow idle; the log panel already busy with lines in many colours from other requests.
**Story**:

1. A request enters at the API and a purple tag, "c-42", is minted (or kept, if the caller sent one). Caption: "Minted once, at the start."
2. Order publishes OrderPlaced: a new message with a new message ID, the purple tag copied across. The topic fans it out, and Payment's and Inventory's messages each get new IDs and the same tag. Caption: "New message, new ID, same correlation ID."
3. Inventory's message waits ten minutes in a queue (a timer) while the API request has long since returned. Caption: "Across a queue there's no open call to follow. Only the tag."
4. Filter the log panel on c-42: every other colour dims, the purple lines line up across services and minutes, and the path lights up in the flow above. Caption: "One ID, the whole conversation."
5. Causation pointers draw arrows from each message to its parent, forming a tree: OrderPlaced → PaymentTaken → EmailSent, and OrderPlaced → StockReserved. Caption: "Causation ID: who caused whom."

**The moment**: Beat 4: the thread pulled out of the noise intact across a fan-out and a ten-minute wait.
**Interaction**: Click any envelope or log line to light up its conversation. A toggle makes one service forget to copy the tag, orphaning everything after that hop. A "dedupe on correlation ID" toggle makes Payment drop a later OrderAmended (also c-42) as a "duplicate": same conversation isn't same message.
**Ending**: The purple thread traced end to end, with the causation tree beside it.
**Variants**: `request-reply-messaging`, `message-anatomy`, `idempotency-key` (contrast); Observability's `correlation-ids` (the log-filter lesson for synchronous calls), `distributed-tracing` and `w3c-trace-context`.
**Techniques**: token, clone, contents, spotlight, path trace, timer, choice, toggle, failure, caption.
**Review**: Improved — refocused on what messaging adds. The noisy-log moment duplicated Observability's `correlation-ids` plan, so the story now shows the async part: new message IDs at every hop and through a fan-out, and a ten-minute queue wait with no open call to follow, where the tag is the only link. The idempotency-key confusion, named but never shown, is now an interaction: deduping on the correlation ID drops a real message. Weighed a parcel-tracking-number metaphor; the purple tag already reads as one.

### Asynchronous request-reply over HTTP (202 + polling) (`async-request-reply`)

**The aha**: For long work, the API answers 202 Accepted straight away with a status URL, and the client checks back at the pace the server suggests until the work is done, so no connection is held and nothing times out.
**Misconception to defeat**: That the request must stay open until the work finishes, so the fix is a longer timeout.
**Cast**: A sequence diagram with three vertical lanes, Client, API and Worker (with a queue between API and Worker), time running downward. A status table beside the API: "job 17 · status".
**Opening frame**: The three lanes, the client about to send "POST /reports".
**Story**:

1. The wrong way: the POST opens a long glowing bar down the Client lane while the Worker runs for two minutes. At 30 s a gateway timer expires: "504". The work finishes later and its result has nowhere to go. Caption: "Hold the line? Something times out first."
2. The right way: the API queues the job, writes "17 · queued" and answers at once, "202 Accepted · Location: /status/17 · Retry-After: 10". The bar is a short blip. Caption: "Accepted. Check back here."
3. The Worker picks up job 17 ("running, 40%"). After 10 s the client sends "GET /status/17" and gets "running, 40%". Caption: "Poll at the pace the server asks."
4. The job finishes. The next poll returns "303 See Other → /reports/17" and the client fetches the result. Caption: "Done: here's the result."
5. Optional: instead of polling, the Worker POSTs to a callback URL the client supplied. Caption: "Or ask to be called back."

**The moment**: Beats 1 and 2 as two sequence diagrams side by side: one long bar ending in a 504, against a column of short blips.
**Interaction**: Dials for job length and Retry-After change the number of polls; a toggle swaps polling for a callback.
**Ending**: The short-blip diagram with the result fetched, the long-bar diagram greyed out beside it.
**Variants**: `request-reply-messaging`, `webhooks`, `queue-based-load-leveling`, `durable-execution` (engines that expose status URLs); Architecture's `web-queue-worker`.
**Techniques**: lanes, exchange, timer, meter, side by side, failure, dial, toggle, caption.
**Review**: Keep — two sequence diagrams, one long bar ending in a 504 and one column of short blips, is the sharpest contrast available, and the protocol details (202 with Location and Retry-After, then a 303 to the result) are right. Weighed a restaurant-pager metaphor; the sequence diagram is what developers will draw themselves, so it stays.

### Webhooks (`webhooks`)

**The aha**: A webhook is the provider pushing an event to your URL over plain HTTP; the receiver must verify the signature, reject old timestamps, reply fast, process later, and expect retries, which it dedupes by event ID.
**Misconception to defeat**: That a webhook is a trusted, one-time call you can handle inline before responding.
**Cast**: Provider (left) with a registered-URL card and a retry schedule. Your endpoint (right): a gate (signature and timestamp check), then a small queue, a worker and a "seen IDs" list. An attacker figure at the lower left.
**Opening frame**: The provider holding event "evt_1 · payment.succeeded", your URL on its card, your endpoint empty.
**Story**:

1. A quick contrast: your app polling "anything new?" over and over, mostly hearing "no". It stops, and the provider POSTs when the event happens. Caption: "Don't ask. Get told."
2. The POST arrives with headers "webhook-id: evt_1", a timestamp and a signature. At the gate a key icon matches: green. Caption: "Check it's really them."
3. The endpoint drops evt_1 into its queue and replies 200 in milliseconds; the worker handles it afterwards. Caption: "Reply fast, work later."
4. The wrong way: an endpoint doing the work inline takes 15 s. The provider's timer expires, it marks the delivery failed, and it retries. Caption: "Too slow counts as failed."
5. The retried evt_1 arrives; the "seen IDs" list already holds it, and it glows. Ignored, 200. Caption: "Same ID: already handled."
6. The attacker sends a forged POST and the gate rejects it. Then it replays a captured genuine one: valid signature, but a timestamp two hours old. Rejected. Caption: "Forged or replayed: rejected."

**The moment**: Beats 4 and 5: a slow handler causing a retry, and the seen-IDs list catching it.
**Interaction**: Four switches: verify signature, check timestamp, reply before processing, dedupe by ID. Turning any one off lets its failure through: a forged event, a replay, a retry, a double charge.
**Ending**: All four switches on and green; evt_1 processed once.
**Variants**: `push-vs-pull-delivery`, `idempotency-key`, `idempotent-consumer`, `event-notification` (thin webhook payloads), `async-request-reply`; Security's `api-authentication-methods` (signed requests, HMAC).
**Techniques**: token, exchange, boundary, contents, timer, failure, side by side, toggle, caption.
**Review**: Improved — fixed a dangling link: Security has no message-signing concept, and HMAC webhook signatures sit under `api-authentication-methods`. The plan stays: four switches, each letting through its own failure (forgery, replay, retry, double charge), map the catalog's four obligations one to one, and the replay attack correctly needs a valid signature with an old timestamp. Weighed cutting beat 1's polling contrast; it's the only place the plan says what a webhook is for, so it stays.

## Integration patterns: routing and transformation

### Content-based router (`content-based-router`)

**The aha**: Senders publish to one place and a router reads each message and decides where it goes, usually exactly one destination, so adding a destination changes the router, not the senders.
**Misconception to defeat**: That this is subscription filtering, where each subscriber decides and one message can reach many.
**Cast**: Three senders (left) → one inbound channel → a router (a diamond) with a readable rule card ("region = EU → EU queue", "region = US → US queue", "else → review") → three queues and their consumers (right). Envelope colour shows region.
**Opening frame**: The rule card readable; blue (EU) and red (US) envelopes waiting at the senders.
**Story**:

1. An envelope enters the router; a magnifier passes over its "region: EU" header, the EU rule row lights, and the envelope takes that path. Caption: "Read it, pick one path."
2. A stream of mixed envelopes, each going to exactly one queue. Caption: "One message, one destination."
3. A new region: an APAC queue appears and a rule row is added to the card. The senders stay frozen, badged "no change". Caption: "New destination: change the router, not the senders."
4. A second panel: a topic with three subscriptions, each holding its own filter, and no rule card anywhere. One envelope matches two filters and is copied to both. Caption: "Filtering: each subscriber chooses for itself."
5. A brief variant: the router sends one message to a chosen list of two queues. Caption: "A recipient list picks several."

**The moment**: Beat 3: one row added to the rule card while every sender stays still.
**Interaction**: Edit the rules and send envelopes with different headers; a router/filtering toggle on the same messages shows one rule card deciding against each subscriber deciding.
**Ending**: Four queues, each holding only its region's colour.
**Variants**: `message-filtering`, `exchange-bindings`, `routing-slip`, `splitter`; platform versions such as EventBridge rules.
**Techniques**: token, path trace, contents, appear, side by side, clone, choice, toggle, caption.
**Review**: Improved — the contrast with filtering now rests on who decides (one rule card, or each subscriber for itself) instead of one destination against many, which beat 5's recipient list contradicted; the aha says "usually one destination" to match. Weighed a post-room sorting-desk metaphor; the rule card is that desk and stays readable.

### Splitter (`splitter`)

**The aha**: Splitting one big message into many small ones lets them run in parallel, but each piece must carry its parent's ID and "i of n" so it can be put back together.
**Misconception to defeat**: That splitting is just chopping a message up, or that it's the same as a claim check.
**Cast**: One fat envelope, "Order 88 · 20 lines", visibly bulging. A splitter (a cutter). A queue and three workers. A ghosted aggregator on the far right.
**Opening frame**: Worker 1 grinding through the fat envelope with a slow progress bar; workers 2 and 3 idle.
**Story**:

1. Worker 1 crawls on while the others wait. Caption: "One big message, one worker."
2. Rewind: the envelope goes through the splitter and peels into 20 small envelopes, each stamped "Order 88 · 3/20". Caption: "Split into pieces."
3. The pieces queue and all three workers take them; a throughput meter jumps. Pieces finish out of order, 3/20 before 1/20. Caption: "In parallel, in any order."
4. Spotlight the stamps. A toggle strips them: the pieces reach the aggregator blank, under question marks, "Which order? How many?" With the stamps back, the aggregator counts "20 of 20". Caption: "Each piece carries its order and its number."

**The moment**: Beats 2 and 3: one fat envelope becoming a swarm, and the meter jumping as idle workers join in.
**Interaction**: A dial for the number of workers; a toggle for stamping the pieces.
**Ending**: All 20 pieces arriving at the ghosted aggregator, counted "20/20", handing off to `aggregator`.
**Variants**: `aggregator`, `scatter-gather`, `competing-consumers`, `message-ordering`, `claim-check` (contrast).
**Techniques**: split / merge (new: one element breaks into parts, or parts combine into one), token, contents, meter, spotlight, toggle, dial, caption.
**Review**: Keep — one fat envelope peeling into a swarm while idle workers join in shows the benefit, stripping the stamps shows the cost in the same scene, and the hand-off to the ghosted aggregator links the pair. Weighed showing the claim-check contrast on screen; `claim-check`'s own plan serves that confusion better, so the link is enough.

### Aggregator (`aggregator`)

**The aha**: Collecting related messages needs stored state, grouped by correlation ID, and a rule for when to stop waiting, because some parts never arrive.
**Misconception to defeat**: That collecting replies is trivial, or that it's the same as windowed aggregation over a stream.
**Cast**: Small incoming envelopes in two colours (purple = order 88, green = order 91), stamped "i of n". The aggregator is a box with one bin per colour, showing filled slots. A rule card: "all parts, or 30 s". Output on the right.
**Opening frame**: Empty bins; the rule card visible.
**Story**:

1. Parts arrive interleaved and drop into bins by colour; slots fill: purple 2/5, green 1/3. Caption: "Group by correlation ID."
2. Green reaches 3/3; the bin squeezes into one envelope, "Order 91 · 3 parts", which leaves. Caption: "All in: emit one message."
3. Purple stops at 4/5, and a timer on its bin runs down. Caption: "One part is missing."
4. Time's up: the bin emits "Order 88 · partial 4/5" in amber. Caption: "Stop waiting: send what you have, flagged."
5. The missing part arrives late and finds no bin; it drops into a "late" tray. Caption: "Late parts need a rule too."
6. The aggregator crashes while holding a bin. With state only in memory, the bin vanishes; with stored state, it reappears on restart. Caption: "The bins are state: keep them safe."

**The moment**: Beats 3 and 4: the timer on an incomplete bin, and the decision to emit a partial result.
**Interaction**: Choose the completion rule (count, timeout, end marker); dials for the timeout and for how often parts go missing.
**Ending**: An output stream of complete and partial messages, a few late parts in the tray.
**Variants**: `splitter`, `scatter-gather`, `correlation-id`, `stream-windowing` (contrast), `stateful-stream-processing`.
**Techniques**: split / merge, contents, timer, restyle, failure, choice, dial, caption.
**Review**: Keep — one bin per correlation ID with a timer on the incomplete one makes "stored state plus a rule for when to stop" concrete, and the partial result, the late part and the crash cover every catalog point. Weighed a jigsaw metaphor; the bins already read that way, and the timer is exactly what a jigsaw lacks.

### Scatter-gather (`scatter-gather`)

**The aha**: Asking several parties in parallel and combining the answers makes you as slow as the slowest reply you wait for, so you set a deadline and a rule for partial results.
**Misconception to defeat**: That it's fan-out (which sends and collects nothing), or that a parallel request is as fast as the fastest party.
**Cast**: Requester (left) asking "best price?"; three suppliers, A, B and C (right); an aggregator back at the requester. Under the scene, a time axis with one lane per supplier, where a bar grows until that supplier replies.
**Opening frame**: The request ready, three suppliers, empty lanes.
**Story**:

1. The request clones into three and they travel in parallel. Caption: "Ask everyone at once."
2. A replies at 80 ms ($12) and B at 120 ms ($10); their bars stop. C's bar keeps growing. Caption: "Replies arrive at their own speed."
3. Waiting for all: the answer comes only at 2,000 ms, when C finally replies. A total-latency bar matches C's bar exactly. Caption: "You're as slow as the slowest."
4. Rewind with a 200 ms deadline, drawn as a vertical line across the lanes. At the line the aggregator takes the best so far, B's $10, and answers. C's reply arrives later and greys out. Caption: "Deadline plus best-so-far: fast, maybe partial."
5. A small inset: fan-out, with arrows going out and nothing coming back. Caption: "Fan-out sends. Scatter-gather also collects."

**The moment**: Beat 4: the deadline line cutting through C's long bar, with the answer already on its way.
**Interaction**: Drag each supplier's latency and the deadline; pick the rule (wait for all, first N, best by the deadline).
**Ending**: The lanes with the cut line and the answer: "$10 in 200 ms".
**Variants**: `aggregator`, `fan-out`, `request-reply-messaging`, `splitter`; Scaling's `tail-latency` and `hedged-requests`.
**Techniques**: clone, split / merge, token, lanes, timer, spotlight, side by side, dial, choice, caption.
**Review**: Keep — the time-axis lanes make "as slow as the slowest" measurable, the deadline line cutting through C's bar is a strong moment, and the fan-out inset settles the usual confusion in one beat. Weighed asking three shops for a quote as a metaphor; suppliers with prices already are that story.

### Claim check (`claim-check`)

**The aha**: Put the big payload in blob storage and send only a small reference through the broker; the consumer redeems it, at the cost of a second fetch and of cleaning up old payloads.
**Misconception to defeat**: That compressing or chunking the message is the natural fix.
**Cast**: Producer (left) holding an oversized envelope, "video · 50 MB". The broker's queue (centre) with a narrow mouth labelled "max 256 KB". Object storage (a bucket) below the queue. Consumer (right). The reference is a small cloakroom ticket.
**Opening frame**: The huge envelope next to the tiny queue mouth, obviously too big to fit.
**Story**:

1. The producer pushes the envelope at the queue; it jams at the mouth and bounces back red. Compressing it barely helps (video is already compressed: 50 MB becomes 48). Caption: "Too big for the broker, even squeezed."
2. The producer drops the payload into the bucket and gets back a ticket, "blob/v-77". Caption: "Store the bulk, keep the ticket."
3. A small envelope carrying the ticket slips through the queue. Caption: "Send only the claim check."
4. The consumer takes the ticket to the bucket and pulls out the payload; a small timer shows the extra fetch. Caption: "Redeem it on the other side."
5. Without cleanup, processed payloads pile up in the bucket and a cost meter climbs; with a cleanup rule, old ones are swept away. Caption: "Someone has to clear the cloakroom."

**The moment**: Beat 3: a tiny envelope zipping through the mouth the big one couldn't pass.
**Interaction**: A payload-size dial: below the limit messages go straight through, above it the claim check kicks in. A cleanup toggle drives the cost meter. A "chunk it" button cuts the video into 200 pieces instead, each needing its sequence number, all of them arriving and a reassembly step.
**Ending**: The queue full of small tickets, the bucket holding the payloads.
**Variants**: `message-anatomy`, `event-notification` (also sends a reference, not the data), `splitter` (contrast); Data's `object-storage`; platform versions such as the SQS Extended Client and Service Bus large messages.
**Techniques**: split / merge, token, contents, failure, timer, meter, dial, toggle, caption.
**Review**: Improved — the misconception (just compress or chunk it) is now answered on screen: compressing an already-compressed video barely shrinks it (beat 1), and a "chunk it" button shows 200 pieces that must all arrive and be put back together. Weighed a plain pointer arrow instead of the cloakroom ticket; the ticket is more memorable and makes "someone has to clear the cloakroom" land.

### Message translation and enrichment (`message-transformation`)

**The aha**: Transform messages at the edges (translate, enrich, filter, normalise into one shape), so each system keeps its own format and a change in one system means changing one translator.
**Misconception to defeat**: That every consumer should understand every producer's format, or that this is the same as schema evolution.
**Cast**: Three sources (left) with different envelope shapes: CRM (square, XML), web shop (round, JSON), partner (striped, CSV). Three consumers (right). Between them, small stations: one translator per source, an enricher with a lookup database, and a content filter.
**Opening frame**: The wrong model first: every consumer containing three little parsers, nine in all, with lines crossing.
**Story**:

1. The partner changes its format; all three consumers turn red. Caption: "Every consumer parses every format."
2. Rewire: each source passes through its own translator, and every envelope comes out in one canonical shape, "Customer". Each consumer now holds one parser. Caption: "Translate at the edge, into one shape."
3. The enricher sees a message without "loyalty tier", looks it up in its database and adds the field; a new stripe appears on the envelope. Caption: "Enrich: add what's missing."
4. Before the analytics consumer, a filter strips "card number"; the field slides off and dissolves. Caption: "Filter: remove what they shouldn't see."
5. The partner changes format again. One translator gets a wrench; everything downstream stays green. Caption: "One format changes, one translator changes."

**The moment**: Beat 5 against beat 1: one red translator instead of three red consumers, with a counter reading "parts changed: 1" against "3".
**Interaction**: A "change a source's format" button and a canonical-model toggle; the counter shows how many parts have to change.
**Ending**: The tidy pipeline, every consumer receiving canonical, enriched, filtered envelopes.
**Variants**: `domain-vs-integration-events`, `event-schema-evolution` (contrast), `content-based-router`, `stream-connectors` (single message transforms); Architecture's `pipes-and-filters`.
**Techniques**: side by side, restyle, token, contents, failure, meter, toggle, caption.
**Review**: Keep — opening on the wrong model (nine parsers) and ending on "parts changed: 1 against 3" makes the payoff countable, and enrich and filter are short beats for patterns the catalog bundles into this concept. Weighed a travel-plug-adapter metaphor; the translators already read as adapters.
