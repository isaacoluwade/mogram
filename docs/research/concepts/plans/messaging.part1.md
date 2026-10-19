# Messaging plans, part 1

## Shared visual language

Messages are small labelled envelopes that travel along arrows, coloured by type or key.
Producers sit on the left, consumers on the right, the broker or topic in the middle. A queue
is a horizontal tube holding envelopes in order; taking one off deletes it. A topic or log is a
row of numbered cells, each consumer tracking its own offset marker along the row; reading
never deletes a cell. Acknowledgements are small ticks travelling back against the flow. A
database is a cylinder with a few visible rows. A crash is a red flash and the element greying
out. Where two systems or two choices need comparing, they sit side by side so the same event
can be watched landing differently in each.

Conventions shared with part 2: a message taken but not yet acked leaves a faint locked outline
in its slot, and a lease on it is a countdown ring. A duplicate is drawn in amber; lost work is
a red ghost outline. A topic's partitions are stacked rows of cells, and a consumer group is a
coloured oval around its members, with its offset markers in the same colour. "Rewind" replays
the same scene with one thing changed.

## Communication styles and vocabulary

### Synchronous vs asynchronous communication (`sync-vs-async-communication`)

**The aha**: Async doesn't make anything faster: it removes the need for the receiver to be up right now, and the price is that the sender no longer gets the answer straight away.
**Misconception to defeat**: That this is `async`/`await` in code, which frees a thread in one process but still fails if the other side is down.
**Cast**: Two lanes. Top, "sync": Checkout → Payment, a stopwatch on Checkout. Bottom, "async": Checkout → queue tube → Payment. A customer with a speech bubble at each Checkout; the envelope is "Charge $20".
**Opening frame**: Both lanes idle, Payment up in both, stopwatches at zero.
**Story**:

1. Top: Checkout sends "Charge $20" and freezes, stopwatch running, until "OK" returns at 2 s. Caption: "Sync: send, then wait."
2. Bottom: Checkout drops the envelope in the tube and serves the next customer at once. Caption: "Async: hand it off, carry on."
3. Payment goes down (grey) in both. Top: the next call fails at once, a red X, the bubble reads "Error". Bottom: the envelope waits, and when Payment returns it drains the tube. Caption: "Receiver down: sync fails, async waits."
4. The price: the top bubble says "Paid"; the bottom one says "We'll email you". Caption: "But no answer in hand."
5. A thin third lane: `await payment.charge()` with Payment down. The thread is free while it waits, and the call still fails red. Caption: "`await` frees your thread, not your dependency."

**The moment**: Beat 3: the same outage, a red X in one lane and a patiently waiting envelope in the other.
**Interaction**: Toggle Payment up or down at any moment; a counter in each lane tallies failed orders.
**Ending**: Top lane "2 failed"; bottom lane "0 failed", its customer still holding "We'll email you".
**Variants**: `message-broker`, `message-queue`, `async-request-reply` and `request-reply-messaging` (getting the answer later).
**Techniques**: side by side, lanes, token, timer, failure, toggle, caption.
**Review**: Improved — added the catalog's other half (the sender gives up the immediate answer) and replaced the vague code-line beat with one showing `await` still failing against a down service.

### Message broker (`message-broker`)

**The aha**: A broker is a middleman that stores messages, so producers and consumers never talk to each other directly and never need to be online at the same time.
**Misconception to defeat**: That a broker is a kind of load balancer; a load balancer forwards requests as they arrive and stores nothing.
**Cast**: Two lanes of the same shape. Top: Producer → load balancer (a hollow splitter) → Consumer. Bottom: Producer → Broker (a box with a disk icon and a visible stack of envelopes) → Consumer. Envelopes "#1" to "#3".
**Opening frame**: Both lanes idle, consumers up, the broker empty. Every arrow runs through the middle box; none joins producer to consumer.
**Story**:

1. Both producers send #1. Top: it passes straight through. Bottom: it lands in the broker's stack, then moves on. Caption: "Both sit in the middle."
2. Both consumers go offline (grey); the producers send #2 and #3. Top: each fails at the splitter, "502", nothing kept. Bottom: they stack up in the broker. Caption: "A load balancer forwards. A broker keeps."
3. The consumers return. Top: #2 and #3 are simply gone. Bottom: the broker delivers them in turn. Caption: "Delivered when someone's ready."
4. Bottom: a second producer connects and the consumer is swapped for a fresh instance; nobody is reconfigured, because each side only knows the broker. Caption: "Each side only knows the broker."

**The moment**: Beat 2: the same outage, "502" bouncing off the top lane while envelopes calmly pile up in the broker below.
**Interaction**: Toggle producers and consumers on and off; the broker's stack absorbs every outage, the top lane loses what's sent during one.
**Ending**: The broker empty, all three delivered; the top lane showing two lost, labelled "forward only, store nothing".
**Variants**: `message-queue`, `publish-subscribe`, `sync-vs-async-communication`, `guaranteed-delivery`; Scaling's `load-balancing` (contrast).
**Techniques**: side by side, contents, token, failure, toggle, caption.
**Review**: Improved — fixed a contradictory opening frame, ran the load-balancer contrast in step with the broker so one outage shows both, and replaced a non-beat ("no direct line is drawn") with one showing each side only knows the broker.

### Message anatomy (headers, body, IDs) (`message-anatomy`)

**The aha**: Brokers route, dedupe, expire and dead-letter messages by reading the headers, never the body, so the headers decide what the infrastructure can do for you.
**Misconception to defeat**: That the payload is the message and headers are incidental metadata.
**Cast**: One envelope in two zones: a sealed grey body ("payload: the broker can't read this") and a row of bright outer tags: `message-id: m-81`, `routing-key: orders.eu`, `ttl: 30s`, `delivery-count: 0`, `content-type: application/json`, `correlation-id: c-42`. A broker with four small stations: router, dedupe, expiry, dead-letter.
**Opening frame**: The envelope at rest, body sealed, tags legible.
**Story**:

1. The router reads only `routing-key` (the tag glows) and sends the envelope down the "EU" path. Caption: "Routed by a tag."
2. A resend with the same `message-id: m-81` arrives; dedupe matches the tag and drops it. Caption: "Deduplicated by a tag."
3. On another envelope the `ttl` tag counts to zero while it waits; it's stamped "expired" and removed. Caption: "Expired by a tag."
4. A consumer keeps failing one envelope. The broker itself bumps `delivery-count` each time, and at 5 moves it to the DLQ. Caption: "Some tags the broker writes itself."
5. A consumer opens a body at last, and arbitrary JSON spills out. Caption: "Only the consumer reads the payload."

**The moment**: Beats 1–4 in a row: four infrastructure decisions, each lighting one tag, while the body stays sealed throughout.
**Interaction**: Edit any tag's value and watch the envelope reroute, get dropped as a duplicate, expire sooner or dead-letter; the body never changes.
**Ending**: The envelope at the consumer, body open, each tag labelled with the station that used it.
**Variants**: `cloudevents`, `message-ttl`, `message-deduplication`, `dead-letter-queue`, `correlation-id`, `content-based-router`.
**Techniques**: contents, zoom, spotlight, timer, path trace, caption.
**Review**: Improved — added deduplication by message ID (in the aha but never shown), concrete header values, and a beat showing the broker writes some headers (delivery count) itself.

### Events vs commands vs messages (`events-vs-commands`)

**The aha**: Both are messages. A command asks one named receiver to do something and can be refused; an event announces a fact that already happened, to whoever is listening.
**Misconception to defeat**: Calling every message "an event", including ones the sender secretly needs one particular service to act on.
**Cast**: Order service (left) holding two envelopes of the same shape: "ChargeCard" (imperative, addressed "to: Payment") and "OrderPlaced" (past tense, no address). One path leads through a queue to Payment; the other through a topic to Email and Analytics. A dimmed Shipping waits off to the side.
**Opening frame**: The two envelopes side by side in Order's hand, identical but for their names and the address line. Caption: "Both are messages."
**Story**:

1. "ChargeCard" travels to Payment, which replies in red: "Declined: card expired". Caption: "A command: one receiver, who can say no."
2. "OrderPlaced" goes to the topic and copies reach Email and Analytics. Nothing comes back, and Order isn't waiting. Caption: "An event: a fact, already true."
3. Shipping subscribes; the next OrderPlaced reaches it too, and Order's code is untouched. Caption: "The publisher doesn't know who listens."
4. The trap: Order publishes "OrderPlaced" but starts a timer, waiting for "PaymentTaken". Payment unsubscribes; the timer runs out and Order fails. Caption: "If the publisher needs one reaction, it's a command in disguise."

**The moment**: Beat 4: removing one listener breaks the "event's" publisher, which a real event could never do.
**Interaction**: Remove any receiver or subscriber. If the sender breaks, the message was a command, whatever its name.
**Ending**: Three cards with their tells: command (imperative, one owner, can refuse), event (past tense, any listeners, nobody refuses), disguised command (named like an event, needs one reaction).
**Variants**: `event-driven-architecture`, `event-notification`, `publish-subscribe`, `message-queue`, `choreography-vs-orchestration`.
**Techniques**: side by side, token, exchange, timer, failure, spotlight, caption.
**Review**: Improved — opens on "both are messages" (the envelope), and replaces the vague "InventoryShouldReserve" trap with a test the viewer can run: remove a listener, and if the sender breaks, it was a command.

### Messaging protocols (AMQP, MQTT, Kafka) (`messaging-protocols`)

**The aha**: The wire protocol is separate from the broker: one broker can speak several, one product can speak another's protocol, and some guarantees, like MQTT's QoS, live in the protocol itself.
**Misconception to defeat**: That a protocol and a broker are one thing ("RabbitMQ is AMQP", "only Kafka speaks Kafka").
**Cast**: One broker with three sockets, AMQP, MQTT and STOMP, as RabbitMQ has. Clients: an order service, a battery-powered sensor, a browser dashboard. Frames drawn at their real relative size: AMQP's large and many-fielded, MQTT's tiny.
**Opening frame**: Broker idle, sockets empty, clients waiting.
**Story**:

1. The order service plugs into AMQP and sends a richly headed message; an ack comes back. Caption: "AMQP: rich enterprise messaging."
2. The sensor plugs into MQTT and sends a tiny packet, "21.5 °C", at QoS 0: one arrow, no reply. Caption: "MQTT: tiny packets for devices."
3. The QoS dial on the packet turns to 1: PUBLISH, then PUBACK. Then to 2: PUBLISH, PUBREC, PUBREL, PUBCOMP. Caption: "The guarantee is part of the protocol."
4. Both messages land in one queue inside the broker; the dashboard, on STOMP, reads the sensor's value. Caption: "Different doors, one broker."
5. A Kafka client connects to Azure Event Hubs, badged "not Kafka", and works unchanged. Caption: "A protocol isn't a product."

**The moment**: Beat 3: the handshake growing from one arrow to four as the dial on the message turns, the broker unchanged.
**Interaction**: Move a client to another socket and watch its frames and guarantees change while the broker's insides don't.
**Ending**: Three frame shapes converging on one queue; the Kafka client alongside on Event Hubs.
**Variants**: `message-broker`, `message-anatomy`, `cloudevents`, `delivery-guarantees` (QoS 0, 1, 2 as at-most, at-least and exactly once, per hop).
**Techniques**: exchange, dial, contents, side by side, caption.
**Review**: Improved — replaced a broker speaking AMQP, MQTT and Kafka (no common broker does) with real pairings (RabbitMQ's sockets; Event Hubs speaking Kafka), spelled out the QoS handshakes, and aimed the misconception at what the story defeats.

### CloudEvents (`cloudevents`)

**The aha**: A common envelope (`id`, `source`, `type`, `specversion`) lets any router or function handle events from any producer by reading the same few attributes, without understanding each payload.
**Misconception to defeat**: That CloudEvents standardises the payload; it standardises only the metadata around it.
**Cast**: Three producers with incompatible native messages: GitHub (`X-GitHub-Event: push`), a billing system (`{"kind": "invoice.paid"}`), an IoT hub (`eventType=Telemetry`). A router (centre) and three functions (right).
**Opening frame**: The wrong model: the router holding three little parsers, each digging for "what kind of event is this?" in a different place.
**Story**:

1. A fourth producer arrives and the router needs a fourth parser, highlighted red. Caption: "Every producer says 'type' differently."
2. Each message is wrapped in the same envelope, `type: com.github.push`, `source: /repos/acme/api`, `id: A234`, `specversion: 1.0`, with its original body nested inside, untouched. Caption: "Same envelope, any payload."
3. The parsers fall away. The router keeps one rule set that reads `type` and `source` off every envelope and routes them all. Caption: "One router, no payload code."
4. Another producer arrives already wearing the envelope; the router handles it at once. Caption: "New producer, zero new code."
5. One envelope is peeled open: inside, the original, inconsistent payload. Caption: "The payload is still its own problem."

**The moment**: Beat 4 against beat 1: a new producer slotting straight in where one used to cost a new parser.
**Interaction**: Drag any payload into a CloudEvents wrapper and the router handles it; take the wrapper off and it needs a parser again.
**Ending**: Five producers, one router with one rule set, the peeled envelopes showing how different the insides still are.
**Variants**: `message-anatomy`, `schema-registry`, `event-schema-evolution`, `message-transformation`; platform versions such as Event Grid's CloudEvents schema.
**Techniques**: contents, appear / disappear, zoom, side by side, spotlight, caption.
**Review**: Improved — opens on the costly "before" (a parser per producer) so the zero-code moment has something to beat, and uses real attribute values.

## Message queues

### Message queue (point-to-point) (`message-queue`)

**The aha**: A queue is a buffer where each message is handled by exactly one consumer and then removed, so whoever asks for work never waits for whoever does it.
**Misconception to defeat**: That a queue works like a topic (everyone gets a copy) or a log (messages stay after being read).
**Cast**: Producer (left), a horizontal tube holding envelopes "resize photo 1" to "3", Consumer (right).
**Opening frame**: Three envelopes in the tube, front to back; the consumer idle.
**Story**:

1. The producer drops "resize photo 4" in at the back and goes straight back to its own work. Caption: "Dropped off. The producer doesn't wait."
2. The consumer takes photo 1 from the front and resizes it, and the envelope is gone from the tube: not greyed, not kept. Caption: "Handled once, then removed."
3. A second consumer joins. Both reach for the front; photo 2 goes to one and photo 3 to the other, never both. Caption: "One message, one consumer."

**The moment**: Beat 2: the envelope disappearing completely once it's handled.
**Interaction**: Add consumers and watch messages split between them rather than duplicate; pause them and watch the tube hold the backlog.
**Ending**: A small triptych over the same envelope: queue (gone after one consumer), topic (copied to every subscriber), log (still there, two readers' markers past it). Caption: "Gone, copied, kept."
**Variants**: `competing-consumers`, `publish-subscribe`, `event-streaming`, `queue-vs-log`, `message-acknowledgement` (what "handled" means precisely).
**Techniques**: contents, token, side by side, caption.
**Review**: Improved — concrete jobs, a cut non-beat, and an ending triptych (queue, topic, log) that defeats both confusions the catalog names instead of only the topic one.

### Competing consumers (`competing-consumers`)

**The aha**: To go faster, add workers behind one queue: each message goes to just one of them and a crashed worker's message goes to another, but jobs no longer finish in the order they arrived.
**Misconception to defeat**: That more consumers on a queue means every consumer gets every message, as in pub/sub.
**Cast**: One queue tube with envelopes 1–6 ("resize photo"). Consumer A, later joined by B and C. A single "done" rail (right) where jobs line up in the order they finish. A throughput meter.
**Opening frame**: A alone, working slowly, meter "1/s", new envelopes arriving at the back faster than it clears them.
**Story**:

1. B and C join. Each takes the next envelope: 1 to A, 2 to B, 3 to C. The meter reads 3/s and the backlog shrinks. Caption: "Add workers, go faster."
2. B finishes 2 quickly and takes 4 while A is still on 1. Caption: "Whoever's free takes the next one."
3. C crashes mid-3 (red flash). Unacked, 3 returns to the front of the tube, and A takes it after finishing 1. Caption: "A crash doesn't lose the work."
4. The done rail reads 2, 4, 1, 5, 3, 6. Caption: "Faster, but no longer in order."

**The moment**: Beat 4: the scrambled done rail, straight after beat 3 proved nothing was lost.
**Interaction**: Add or remove consumers; the meter rises until the queue runs dry, and the done rail scrambles more.
**Ending**: All six done, 3 wearing an amber "delivered twice" badge, the rail visibly out of order.
**Variants**: `message-queue`, `consumer-prefetch`, `message-ordering`, `visibility-timeout`, `idempotent-consumer` (3 was partly run twice); Scaling's `horizontal-scaling`.
**Techniques**: contents, token, failure, meter, lanes, caption.
**Review**: Improved — opens on one slow worker so "add workers, go faster" is shown rather than asserted, puts completions on one shared rail so the scramble reads at a glance, and corrects the ending: message 3 was delivered twice, not exactly once.

### Acknowledgements (ack, nack, reject) (`message-acknowledgement`)

**The aha**: Receiving a message doesn't remove it: the broker keeps its place until the consumer gives a verdict (ack to delete, nack to retry, reject to give up), and a crash, which says nothing, counts as "not done".
**Misconception to defeat**: That a message is gone once a consumer receives it; or that this is the publisher-confirm tick.
**Cast**: Queue tube holding "#7 Charge $20", a DLQ below it, a dimmed producer far left. A consumer with three buttons: ack ✓, nack ↺, reject ✗.
**Opening frame**: #7 in the queue, the consumer idle.
**Story**:

1. The consumer takes #7; it leaves the tube, but a faint locked outline stays in its slot. Caption: "Received isn't removed."
2. Work done, the consumer presses ack; a tick travels back and the outline vanishes. Caption: "Ack: done, delete it."
3. Rewind. The card API times out; the consumer presses nack, and #7 returns to the queue wearing "delivery 2". Caption: "Nack: put it back, try again."
4. Rewind. #7's body is garbled; the consumer presses reject and #7 drops into the DLQ. Caption: "Reject: don't retry this one."
5. Rewind. The consumer crashes mid-work (red flash) without pressing anything. The outline brightens and #7 comes back. Caption: "Silence counts as 'not done'."
6. A dimmed tick runs broker → producer: "publisher confirm, the other end". Caption: "A different tick."

**The moment**: Beat 5: the consumer dies and the message survives, because only an ack deletes.
**Interaction**: Pick the verdict (ack, nack, reject, crash) at any point. An "auto-ack on receive" toggle makes the outline vanish on arrival, so the same crash loses #7: when you ack decides lost or repeated.
**Ending**: Four outcomes side by side: deleted, requeued, dead-lettered, requeued after a crash.
**Variants**: `delivery-guarantees` (when to ack), `visibility-timeout`, `message-redelivery`, `dead-letter-queue`, `guaranteed-delivery` (publisher confirms).
**Techniques**: contents, token, restyle, failure, toggle, side by side, caption.
**Review**: Rethought — the old plan replayed `delivery-guarantees` (ack before vs after the work) and its moment set a crash against a beat with no crash; this one teaches what the catalog names (ack, nack, reject, and silence) and hands the timing question to `delivery-guarantees` through the toggle.

### Visibility timeout / peek-lock (`visibility-timeout`)

**The aha**: Receiving a message leases it rather than deleting it: it's hidden from others for a set time, and if the lease runs out before the ack, it reappears and someone else does the work again.
**Misconception to defeat**: That a received message stays locked for as long as you need it, or that this timer is the message's TTL.
**Cast**: Queue tube with "#7 Charge $20", consumers A and B, a charges ledger (right). A taken message leaves an outline with a countdown ring, "30 s".
**Opening frame**: #7 in the tube, A and B idle, the ledger empty.
**Story**:

1. A receives #7; its slot becomes a locked outline, the ring counting down from 30 s, and B polls and sees nothing. A acks at 10 s and the outline vanishes. Caption: "Leased, not deleted, until the ack."
2. Rewind. A's work is slow; the ring hits zero at 30 s and #7 reappears, unlocked. Caption: "Lease expired: it's back."
3. B receives it and starts charging too while A is still working. Caption: "Two consumers, same message."
4. A finishes at 40 s and acks: refused, "lock lost". B acks: deleted. The ledger holds two $20 charges, the second amber. Caption: "The work ran twice."
5. Rewind. At 25 s A renews and the ring refills; A finishes, acks, one charge. Caption: "Set the lease above the worst case, or renew it."

**The moment**: Beat 3: both consumers working on the same envelope, a direct result of the ring hitting zero a beat earlier.
**Interaction**: Dials for lease length and processing time, and a renew toggle; cross the dials to trigger a second delivery.
**Ending**: Two ledgers side by side: two charges without renewal, one with.
**Variants**: `message-ttl` (TTL runs while a message waits unread; the lease, once it's taken), `message-acknowledgement`, `consumer-prefetch`, `idempotent-consumer`; SQS visibility timeout, Service Bus peek-lock, Pub/Sub ack deadline.
**Techniques**: timer, contents, restyle, failure, dial, toggle, side by side, caption.
**Review**: Improved — corrected the late ack (it is refused as "lock lost", and by then the side effect has already happened twice), made the damage concrete with a ledger, and added lock renewal, the catalog's other remedy.

### Poison message (`poison-message`)

**The aha**: Some messages fail every time, and without a retry limit one of them loops forever, wasting consumers and, where order matters, blocking everything behind it.
**Misconception to defeat**: That every failure is transient, so enough retries will get it through.
**Cast**: An ordered (FIFO) queue tube: "#41 qty: 'ten'" at the front with jagged edges, five healthy envelopes behind it, each with a small waiting clock. A consumer with a delivery-count badge and an error card. A DLQ below, dimmed.
**Opening frame**: The queue flowing, delivery count 0.
**Story**:

1. #40 fails with "DB timeout", comes back, and succeeds on its second delivery. Caption: "Transient: a retry fixes it."
2. #41 fails parsing, "invalid qty", and comes back with the same error: count 2, 3, 4. Caption: "Poison: same message, same error, every time."
3. No limit: the count spins past 50 while the five behind it sit frozen, their clocks climbing. Caption: "In an ordered queue, everything behind it waits."
4. Rewind with a limit of 5: at count 5, #41 is lifted into the DLQ, tagged "invalid qty". Caption: "Retry limit: move it aside."
5. The five behind it flow at once. Caption: "The line moves again."

**The moment**: Beat 3: five healthy messages frozen behind one that will never succeed, its counter spinning.
**Interaction**: A retry-limit dial (none, 3, 5, 10) and an ordered/unordered toggle. Unordered, healthy messages flow around #41, but a consumer still burns time on it every few seconds.
**Ending**: #41 in the DLQ with its reason; the queue flowing.
**Variants**: `dead-letter-queue`, `message-redelivery`, `message-ordering`, `stream-partitions` (a poison record stalls its whole partition); Reliability's `poison-pill`.
**Techniques**: contents, token, failure, timer, spotlight, toggle, dial, caption.
**Review**: Improved — added the transient-failure contrast the misconception needs, and made explicit that blocking happens only where order is kept (the old plan froze the queue without saying why).

### Dead-letter queue (DLQ) (`dead-letter-queue`)

**The aha**: The DLQ moves failed messages aside, with the reason, so the main flow keeps moving; but a DLQ nobody watches is silent data loss.
**Misconception to defeat**: That the DLQ is a retry queue the system re-consumes automatically, or that dead-lettering is the same as deleting.
**Cast**: Main queue tube (top) feeding a consumer; a side tube below, "DLQ", each entry wearing a reason tag. A depth meter on the DLQ and a closed eye beside it. An "orders shipped" counter far right.
**Opening frame**: The main queue flowing, the DLQ empty, the eye closed.
**Story**:

1. Three messages drop into the DLQ, each with its reason: "max deliveries: 5", "expired", "rejected: bad schema". Caption: "Moved aside, with a reason."
2. The main flow keeps moving and the shipped counter keeps climbing. Caption: "The rest keep flowing."
3. A calendar flips through three weeks. The DLQ fills to 40, the eye still closed. Zoom on one entry: "Order 512 · never shipped", and a customer complaint pops up beside it. Caption: "Nobody's watching: 40 orders quietly lost."
4. An alert on DLQ depth fires and the eye opens. An engineer reads the reasons, fixes the schema bug, and redrives the entries into the main queue, where they succeed. Caption: "Alert, inspect, fix, redrive."

**The moment**: Beat 3: the zoom from a tidy side tube to "never shipped", turning a quiet backlog into lost orders.
**Interaction**: Toggle the depth alert. A "redrive before fixing" button sends entries straight back, where they fail and land in the DLQ again, which is why it isn't an automatic retry queue.
**Ending**: The DLQ empty, the main queue flowing, an alert rule pinned to the DLQ.
**Variants**: `poison-message`, `message-redelivery`, `message-ttl`, `message-acknowledgement` (reject); Observability's `alert-rules`.
**Techniques**: contents, token, spotlight, zoom, meter, timer, toggle, caption.
**Review**: Improved — shows all three ways in (max deliveries, expiry, reject) instead of repeating `poison-message`, makes "silent data loss" concrete as unshipped orders, and lets the viewer see why redriving before a fix just loops.

### Redelivery and delayed retry (`message-redelivery`)

**The aha**: Retrying a failed message at once hammers a struggling dependency; delayed retry tiers park it for longer each time, giving the dependency room to recover while other messages keep flowing.
**Misconception to defeat**: That this is a caller's retry loop around a synchronous call; here the broker holds the waiting message and the consumer is free.
**Cast**: Queue, consumer, and a downstream Inventory API with a health meter. Three side tubes, "retry in 10 s", "1 min", "10 min", then a DLQ. The failing message: "#88 reserve stock", with a delivery-count badge.
**Opening frame**: Inventory's meter green, the queue flowing.
**Story**:

1. Inventory degrades (amber). #88 fails, is nacked and redelivered instantly; it fails again, and again, its count racing up. Caption: "Immediate retry: no time to recover."
2. Every message now fails the same way, and the retries pile onto Inventory; its meter drops to red and the queue behind stalls. Caption: "Hammering a struggling dependency."
3. Rewind with tiers. #88 fails and moves to "retry in 10 s", and the consumer goes straight on to the next message. Caption: "Parked by the broker. The consumer moves on."
4. It fails again after 10 s and moves to "1 min". Meanwhile Inventory's meter climbs back to green, and on the next try #88 succeeds. Caption: "Longer waits, room to recover."

**The moment**: Beat 2 against beats 3–4: a red meter under rapid hammering, then the main queue flowing while #88 waits in a side tube.
**Interaction**: Toggle immediate or tiered retry, and dial how long Inventory stays degraded; outlast every tier and #88 ends in the DLQ.
**Ending**: Inventory green, #88 done after two waits; a dimmed inset of the immediate-retry run, still red.
**Variants**: `poison-message`, `dead-letter-queue`, `scheduled-messages` (how a tier delays), `message-acknowledgement`; Reliability's `retry-backoff-jitter` and `retry-storm`.
**Techniques**: meter, contents, timer, failure, side by side, toggle, dial, caption.
**Review**: Improved — the misconception is now defeated in the story (the broker parks the message and the consumer moves on), the DLQ in the cast is reachable, and it links to Reliability's retry storm.

### Message TTL / expiration (`message-ttl`)

**The aha**: Some messages are worthless once late, so a time-to-live drops them before any consumer can act on stale data.
**Misconception to defeat**: That a message waits safely for as long as it takes; or that TTL is the visibility timeout (which starts only when a consumer takes the message).
**Cast**: Two lanes, each a queue and a slow consumer, both holding "Price quote: $42 · valid 10 s". The bottom envelope wears a countdown ring, "TTL 10 s"; the top has none. A customer card at each consumer.
**Opening frame**: Both quotes waiting, both consumers busy elsewhere, the ring at 10 s.
**Story**:

1. The ring counts down while both consumers are busy. Caption: "A clock on the message, running while it waits."
2. At 0 the bottom envelope greys and vanishes, stamped "expired", before anyone touches it. Caption: "Too late to be useful: dropped."
3. Top: the consumer reaches its quote 40 s late, after the price has moved to $47, and charges the customer $42. The charge flashes red. Caption: "Without TTL, stale data gets used."
4. Bottom: the next expired quote goes to the DLQ instead of vanishing. Caption: "Or dead-letter it, to see what expired."

**The moment**: Beats 2 and 3: the same slow consumer, one stale quote never reaching it, the other acted on.
**Interaction**: Dials for TTL and consumer delay; cross them to see messages expire unread.
**Ending**: Bottom lane clean, one quote in its DLQ; the top lane's wrong charge flagged red.
**Variants**: `visibility-timeout`, `retention-and-replay` (drops by age whether read or not), `scheduled-messages`, `dead-letter-queue`; Scaling's `cache-ttl`.
**Techniques**: timer, contents, failure, side by side, dial, spotlight, caption.
**Review**: Improved — runs the with- and without-TTL cases side by side on the same slow consumer, so the moment is one comparison instead of two scenes, and the misconception now says which clock TTL is.

### Delayed and scheduled messages (`scheduled-messages`)

**The aha**: The broker can act as a durable timer: "send this reminder in 24 hours" survives crashes and restarts without a sleeping thread or a cron job.
**Misconception to defeat**: That a delay needs a process that stays alive (a `sleep`) or a cron job polling a table; or that this is a recurring schedule (it fires once).
**Cast**: Two lanes. Top: an app process holding a reminder inside a `sleep(24h)` bubble. Bottom: a producer, a broker with a holding area beside its queue, and a consumer. The envelope: "Remind Sam · deliver 09:00 tomorrow", with a countdown.
**Opening frame**: Hour 0 in both lanes: the top reminder asleep in its process, the bottom one in the broker's holding area, invisible to the consumer.
**Story**:

1. Bottom: the producer hands the envelope to the broker and is done. Caption: "Send now, deliver later."
2. Hour 6: a deploy restarts both apps (red flash, grey, back). Top: the sleeping reminder is gone with its process. Bottom: the countdown never flickers. Caption: "The broker holds the timer, not your process."
3. Hour 24: the bottom envelope moves from the holding area into the queue and the consumer sends the reminder. Caption: "Invisible until its time, then delivered."
4. Top: nothing happens. Sam is never reminded. Caption: "A sleeping thread doesn't survive a restart."

**The moment**: Beat 2: one restart wiping the top reminder while the bottom countdown runs on untouched.
**Interaction**: Restart either app at any point; the bottom delivery time never moves.
**Ending**: Sam's phone showing the reminder from the bottom lane; the top lane silent.
**Variants**: `message-ttl`, `durable-execution` (timers inside workflows), `message-redelivery` (delayed retry tiers use this); limits differ: SQS delays stop at 15 minutes, so a 24-hour wait needs Service Bus scheduled messages or EventBridge Scheduler.
**Techniques**: timer, contents, failure, side by side, caption.
**Review**: Improved — runs the sleeping-thread contrast in step with the broker so one restart shows both, and records a real limit (SQS delays stop at 15 minutes, so the 24-hour example needs Service Bus or EventBridge Scheduler).

### Priority queue (`priority-queue`)

**The aha**: Priority lets urgent work overtake routine work, but strict priority can starve the routine work; the usual cloud form is separate queues with their own consumer pools, so both keep moving.
**Misconception to defeat**: That priority is a stricter FIFO; it deliberately breaks arrival order, and "urgent first, always" can mean some work never runs.
**Cast**: Two panels over the same traffic. Left, "one queue, sorted": a tube where red "urgent" envelopes jump ahead of grey "routine" ones, with two consumers. Right, "two queues": a "high" tube with three consumers and a "low" tube with one. Each routine envelope carries a wait clock.
**Opening frame**: Both panels with the same few routine envelopes waiting, nothing urgent yet.
**Story**:

1. An urgent envelope arrives. Left: it jumps to the front. Right: it lands in "high", where an idle consumer takes it at once. Caption: "Urgent work overtakes routine work."
2. Urgent traffic keeps coming. Left: the consumers only ever take urgent envelopes, and the routine clocks climb past ten minutes: "starving". Caption: "Strict priority can starve the rest."
3. Right: the low tube's own consumer keeps working through routine work, slower, but its clocks keep resetting. Caption: "Separate queues, separate workers: everyone moves."
4. The urgent burst ends. Right: two high-pool consumers sit idle while the low tube still has a backlog. Caption: "The price: capacity set aside for urgent work."

**The moment**: Beats 2 and 3: the same urgent flood, routine clocks climbing on the left and resetting on the right.
**Interaction**: Dials for urgent traffic and for how many consumers each pool gets; watch the oldest routine wait on each side.
**Ending**: The right panel steady, both tubes moving; the left panel's oldest routine envelope still waiting, its clock red.
**Variants**: `message-ordering` (priority breaks arrival order), `competing-consumers`, `queue-based-load-leveling`.
**Techniques**: side by side, lanes, contents, timer, meter, dial, caption.
**Review**: Rethought — the old plan had low priority starving under separate queues with dedicated pools, the very setup that prevents starvation; starvation belongs to a single strict-priority queue, so the two designs now run side by side with the trade-off of each.

### Message ordering (FIFO vs best-effort) (`message-ordering`)

**The aha**: Strict order costs parallelism: keeping order means one at a time, so one slow message holds up everything behind it, and order only ever holds within one queue, partition or group.
**Misconception to defeat**: That a queue keeps order however many consumers read it; or that FIFO also means no duplicates (a separate guarantee FIFO queues often bundle).
**Cast**: Two lanes over one bank account's five messages: 1 "open", 2 "deposit $50", 3 "withdraw $30", 4 "deposit $10", 5 "statement". Top, "standard": three consumers pulling freely. Bottom, "FIFO": one message at a time. A balance card at the end of each lane.
**Opening frame**: Both tubes loaded 1–5 in order, both balances $0.
**Story**:

1. Top: three consumers take 1, 2 and 3 at once; "withdraw $30" finishes before "deposit $50" and the balance card flashes red, "declined: insufficient funds". Caption: "Parallel consumers scramble order."
2. Bottom: 1, then 2, then 3, strictly in turn, and the balance comes out right. Caption: "Strict order: one at a time."
3. Bottom: 3 hits a slow dependency and stalls for 30 s; 4 and 5, perfectly fine, sit frozen behind it, wait clocks climbing. Caption: "Head-of-line blocking."
4. Top, a fix after the fact: a resequencer at the lane's end holds 3 until 2 has passed. Caption: "Or restore order downstream, by buffering."

**The moment**: Beats 1 and 3: parallel scrambles the account, serial stalls it. The trade-off in two pictures.
**Interaction**: Dial message 3's processing time and watch 4 and 5 wait in lockstep; add consumers to the standard lane and watch scrambles multiply.
**Ending**: Top fast but reordered; bottom correct but stalled. A pointer: "Need order only per account? Give each account its own lane" → `message-groups`.
**Variants**: `message-groups`, `competing-consumers`, `partition-keys`, `stream-partitions`, `message-deduplication`; Networking's `head-of-line-blocking`.
**Techniques**: side by side, contents, timer, failure, caption.
**Review**: Improved — a bank account makes it obvious why order matters (a withdrawal declined because it overtook its deposit), the misconception now matches what the story shows, and the ending points at message groups.

### Message groups and sessions (sequential convoy) (`message-groups`)

**The aha**: Messages stay in order within their group (an order, a customer, a session) while different groups run in parallel, and the key you group by sets how much parallelism you get.
**Misconception to defeat**: That a queue must be either in order or parallel as a whole.
**Cast**: One queue with envelopes interleaved by customer colour, red (Ana), blue (Ben), green (Cy), numbered within each colour. Three consumer lanes; a lock icon shows which group each consumer holds.
**Opening frame**: Mixed colours in the tube, three idle lanes.
**Story**:

1. The broker gives red to consumer 1, blue to 2, green to 3; each lane takes only its colour, in order. Caption: "Each group: one at a time, in order."
2. Red 2 can't start until red 1 is acked. Caption: "In order where it matters."
3. Red 2 hits a slow dependency and red 3 waits, while blue and green keep flowing. Caption: "A slow message holds up only its own group."
4. Red finishes; consumer 1 is free and takes the next waiting group, purple. Caption: "Many groups; a free consumer takes the next."
5. Re-key by country: everything is "CA" or "US", so two lanes are busy and one consumer sits idle. Caption: "The key sets the parallelism."

**The moment**: Beat 3: red stalled while blue and green race on inside the same queue, against `message-ordering`'s fully frozen FIFO lane.
**Interaction**: Choose the group key (customer, order, country) on the same workload and watch how many lanes are busy and the longest wait.
**Ending**: Four colours done, each in its own order, finishing at different times.
**Variants**: `message-ordering`, `partition-keys` (the same idea on a log, with few fixed partitions instead of many dynamic groups), `competing-consumers`; Service Bus sessions, SQS FIFO message group IDs, Pub/Sub ordering keys.
**Techniques**: lanes, contents, token, timer, path trace, caption.
**Review**: Improved — the key's effect on parallelism (in the aha, but only in the interaction) is now a beat, head-of-line blocking is shown contained to one group, and the new group no longer conjures a fourth consumer.

### Broker-side duplicate detection (`message-deduplication`)

**The aha**: Broker-side dedup catches a producer's retried sends within a time window, but it can't stop a consumer seeing a message twice for other reasons, so consumers still need idempotency.
**Misconception to defeat**: That turning on duplicate detection means no duplicates anywhere.
**Cast**: Producer with an "unconfirmed" tray; a broker holding a "seen IDs · 5 min" list; a queue; a consumer with a charges ledger. The envelope: "m-1 · Charge $20".
**Opening frame**: The seen list and the ledger empty, the queue empty.
**Story**:

1. The producer sends m-1; its ID enters the seen list and the envelope lands in the queue. Caption: "First time: through."
2. The broker's confirm is lost on the way back, so the producer resends m-1. The broker finds the ID and drops the resend. Caption: "Caught: same ID, dropped."
3. Rewind. The producer crashes before the confirm and restarts six minutes later, resending its unconfirmed m-1. The ID has aged out of the list, and m-1 lands in the queue again (amber). Caption: "Outside the window: it gets through."
4. Separately, the consumer processes m-1 and crashes before acking; the broker redelivers it by a path the seen list never sees. The ledger shows $20 twice. Caption: "Dedup doesn't cover the consumer's side."

**The moment**: Beat 4: a duplicate arriving by a path dedup was never built to watch.
**Interaction**: Dials for the dedup window and for how long the producer stays down; a "crash the consumer" button.
**Ending**: One duplicate caught, two through by different routes, both pointing at `idempotent-consumer`.
**Variants**: `idempotent-consumer`, `message-acknowledgement`, `guaranteed-delivery` (where producer retries come from); SQS FIFO's 5-minute window, Service Bus duplicate detection, Kafka's idempotent producer (sequence numbers rather than a window).
**Techniques**: contents, token, timer, failure, spotlight, caption.
**Review**: Improved — replaced the implausible "resends out of habit" with a real cause (a producer restarting after the window), made the consumer-side duplicate visible as a double charge, and noted that Kafka dedupes by sequence number rather than a window.

## Publish/subscribe and broker routing

### Publish/subscribe (`publish-subscribe`)

**The aha**: One published message reaches every subscriber, each with its own copy, and adding a subscriber needs no change to the publisher.
**Misconception to defeat**: That it's a queue, where one message goes to one consumer.
**Cast**: Order service (publisher, left) with a one-line code card, `publish(OrderPlaced)`; a topic "orders" (centre, a small hub); subscribers Email and Analytics (right); Loyalty waiting, dimmed.
**Opening frame**: Topic idle, two subscribers attached, an OrderPlaced envelope about to be published.
**Story**:

1. Order publishes one envelope; at the topic it clones into two identical copies, one per subscriber. Caption: "One publish, a copy for every subscriber."
2. Loyalty subscribes. Order's code card stays the same, badged "no change". Caption: "Add a subscriber, publisher unchanged."
3. The next OrderPlaced clones into three. Caption: "New subscribers are simply included."
4. Inset: the same scene as a queue, the envelope going to just one of the three. Caption: "A queue picks one. A topic copies to all."

**The moment**: Beat 1: one envelope splitting into simultaneous identical copies.
**Interaction**: Add or remove subscribers and watch the copy count change while Order's code card never does.
**Ending**: Three subscribers, each holding its own copy of the same OrderPlaced.
**Variants**: `message-queue`, `topic-subscriptions`, `fan-out`, `message-filtering`, `event-driven-architecture`.
**Techniques**: clone, token, side by side, appear / disappear, caption.
**Review**: Improved — fixed the subscriber count (the ending had four, the story three), used real names, and put the publisher's unchanged code on screen so "no change to the publisher" is visible.

### Topics and durable subscriptions (`topic-subscriptions`)

**The aha**: Each subscription is effectively its own durable queue: a slow subscriber doesn't hold up the others, and a subscription only gets what's published after it exists.
**Misconception to defeat**: That subscriptions work like Kafka consumer groups, which all read one retained log and can start from the beginning.
**Cast**: One topic (centre) with three subscriptions hanging off it as separate backlog tubes, Email, Billing and Analytics, each with its own consumer and depth meter.
**Opening frame**: Three empty subscriptions, a message about to be published.
**Story**:

1. Message 1 is published and clones into all three tubes. Caption: "Each subscription: its own copy, its own backlog."
2. Analytics' consumer goes offline (grey); its tube fills while the other two drain. Caption: "A slow subscriber doesn't hold up the rest."
3. A fourth subscription, Audit, is created only now. Message 2 clones into all four, but Audit never gets message 1. Caption: "Only what's published after you subscribe."
4. Inset: a log, where a new consumer group starts at offset 0 and reads message 1. Caption: "A log could replay it. A subscription can't."
5. Analytics returns and drains its backlog at its own pace. Caption: "Each reads at its own speed."

**The moment**: Beats 3 and 4: the new subscription starting empty while the topic already has history, beside a log that can rewind.
**Interaction**: Create a subscription at any point in the timeline and see exactly which messages it gets and which it misses.
**Ending**: Four subscriptions at different depths, Audit missing message 1 for good.
**Variants**: `publish-subscribe`, `consumer-groups` (contrast), `fan-out`, `retention-and-replay`; Service Bus topic subscriptions, Pub/Sub subscriptions (which can seek back only if the topic retains messages).
**Techniques**: clone, contents, meter, failure, spotlight, side by side, caption.
**Review**: Improved — the misconception was named but never shown; an inset of a new consumer group rewinding to offset 0 now sits beside the empty new subscription.

### Fan-out (topic to queues) (`fan-out`)

**The aha**: Publishing once to a topic that feeds a queue per service combines pub/sub's reach with a queue's safety: every service gets a copy, and each buffers, retries and scales its copy on its own.
**Misconception to defeat**: That it's scatter-gather, which fans out and then collects replies; fan-out sends and collects nothing.
**Cast**: Order service publishing "OrderPlaced" to a topic that forwards into three queue tubes, Email, Billing and Warehouse, each with its own consumer.
**Opening frame**: Three empty queues, one consumer each, idle.
**Story**:

1. One publish; the topic drops a copy into each of the three queues. Caption: "Publish once, a queue per service."
2. Warehouse slows; its queue fills while Email and Billing drain. Caption: "Each queue buffers on its own."
3. Billing's consumer crashes mid-message (red flash); its copy returns to the Billing queue and is retried. Email and Warehouse never notice. Caption: "Each retries on its own."
4. Warehouse adds two consumers to its queue and catches up. Caption: "Each scales on its own."
5. Inset: scatter-gather, replies flowing back to the requester. Here no arrow ever returns to Order. Caption: "Fan-out sends. Nothing comes back."

**The moment**: Beat 2: one queue backing up while the other two sail through.
**Interaction**: Slow, crash or scale any one service; the other two never change.
**Ending**: Three queues drained at different times, none having waited on another.
**Variants**: `publish-subscribe`, `topic-subscriptions`, `competing-consumers`, `scatter-gather` (contrast), `queue-based-load-leveling`; SNS to SQS, Service Bus auto-forwarding, RabbitMQ fanout exchanges.
**Techniques**: clone, contents, token, failure, side by side, caption.
**Review**: Improved — replaced a repetitive last beat with "each scales on its own" (the third independence in the catalog's aha) and showed the scatter-gather contrast the misconception names.

### Subscription filtering (topic- and content-based) (`message-filtering`)

**The aha**: With filtering at the broker, each subscriber receives only the messages it asked for, instead of receiving everything and throwing most away.
**Misconception to defeat**: That it's a content-based router, which sends each message to exactly one destination; here each subscriber picks its own slice, and one message can match several.
**Cast**: A topic publishing envelopes tagged with attributes (region, type). Three subscriptions with filter badges: "region = EU", "type = refund", and Audit with none. A "delivered" counter on each subscription and a discard bin beside each consumer.
**Opening frame**: The topic about to publish a batch of 20 mixed envelopes, the filter badges greyed out.
**Story**:

1. Filters off: all three subscriptions receive all 20, and two consumers toss most into their bins. Counters: 20, 20, 20. Caption: "Without filters: receive everything, discard most."
2. Filters on. An EU order is checked against each badge: it passes "region = EU" and Audit, and skips "type = refund". Caption: "Only matching subscriptions get a copy."
3. An EU refund matches both "region = EU" and "type = refund" and lands in both. Caption: "One message can match several filters."
4. The batch replays: the counters read 6, 3, 20, and the bins stay empty. Caption: "Less delivered, less code, less cost."

**The moment**: Beat 3: one message landing in two filtered subscriptions, which a router could never do.
**Interaction**: Edit any filter live, as an attribute rule or a topic pattern such as `orders.*.eu`, and watch which envelopes it starts or stops receiving.
**Ending**: Three subscriptions holding exactly what matched, their counters beside the dimmed "20, 20, 20" from beat 1.
**Variants**: `content-based-router` (contrast), `topic-subscriptions`, `exchange-bindings` (pattern-matched keys), `cloudevents`; SNS filter policies, Service Bus SQL filters, EventBridge event patterns, Pub/Sub filters.
**Techniques**: contents, spotlight, meter, side by side, toggle, caption.
**Review**: Improved — replaced a non-beat ("the discard piles are still visible") with delivery counters that make the saving measurable, and brought in the topic-pattern form of filtering the catalog names.

### Exchanges, bindings and routing keys (`exchange-bindings`)

**The aha**: Routing is kept apart from storage: the exchange decides where a message goes and queues only hold it, so changing the bindings turns the same publish into point-to-point, broadcast or pattern-matched delivery.
**Misconception to defeat**: That an exchange is a place messages wait, like a Kafka topic; it stores nothing.
**Cast**: A producer publishing to an exchange drawn as a hollow routing box, never shown with contents. Queues beneath it, Billing, Audit and EU-team, each joined to it by a labelled binding line. A type switch on the exchange: direct, fanout, topic.
**Opening frame**: A direct exchange; Billing bound with key "orders.created".
**Story**:

1. The producer publishes with key "orders.created"; the message passes straight through the hollow exchange, along the matching binding, into Billing. Caption: "The exchange routes. The queue holds."
2. Switch to fanout: the same publish goes down every binding at once, a copy into each queue, key ignored. Caption: "Fanout: every bound queue."
3. Switch to topic, with bindings `orders.#` (Audit) and `*.*.eu` (EU-team). A message keyed `orders.created.eu` matches both. Caption: "Topic: match by pattern. `*` is one word, `#` is any number."
4. Publish with key "payments.failed". No binding matches; the envelope enters the exchange and fades away. Caption: "No match, no queue: it's gone."

**The moment**: Beat 4: a message vanishing inside the exchange, the proof that it stores nothing.
**Interaction**: Switch the exchange type and edit the bindings live; the same publish routes differently each time. An "alternate exchange" toggle catches unroutable messages in a queue instead of losing them.
**Ending**: Three exchange types side by side, routing the same message three ways; headers exchanges named as a fourth.
**Variants**: `publish-subscribe`, `fan-out`, `content-based-router`, `message-filtering`.
**Techniques**: path trace, contents, side by side, toggle, failure, caption.
**Review**: Improved — fixed a wrong match (`orders.*` can't match the three-word key `orders.created.eu`, since `*` is exactly one word), replaced the zoom into an empty box with an unroutable message vanishing, which proves "stores nothing", and fixed an ending that promised a fourth type never shown.

### Push vs pull delivery (`push-vs-pull-delivery`)

**The aha**: Pull lets each consumer set its own pace, which is built-in backpressure; push delivers fastest, but the broker only learns the endpoint is struggling from its failures, and must back off.
**Misconception to defeat**: That push is simply better because it's faster (or that this is about mobile push notifications).
**Cast**: Two lanes. Top, push: the broker calls the consumer's HTTPS endpoint. Bottom, pull: the consumer asks the broker "anything for me?". Each consumer has a load meter.
**Opening frame**: Both idle, one message waiting in each broker.
**Story**:

1. Top: the broker calls the endpoint the instant a message exists. Caption: "Push: lowest latency."
2. Bottom: the consumer polls, hears "nothing", polls again, and gets the message a visible gap later. Caption: "Pull: the consumer asks when ready."
3. A burst arrives and both consumers slow. Top: calls keep coming, the meter goes red, the endpoint answers 503. Caption: "Push can swamp a struggling endpoint."
4. Top: the broker sees the 503s and backs off, spacing out calls and retrying failures. Caption: "The broker learns from failures, then backs off."
5. Bottom: the slow consumer just asks less often; messages wait in the broker, the meter stays green. Caption: "Pull slows down without failing."
6. Bottom, long polling: each poll waits open until a message arrives, so delivery is nearly as quick as push. Caption: "Long polling: nearly as responsive."

**The moment**: Beats 3 and 5: the same burst, a red endpoint answering 503s against a calm consumer that simply asks less often.
**Interaction**: Dial consumer speed and burst size: push responds with errors and backoff, pull with a longer wait.
**Ending**: Push recovered after backing off, a few failed deliveries logged; pull calm throughout.
**Variants**: `backpressure`, `webhooks`, `consumer-prefetch`, `queue-based-load-leveling`; Pub/Sub push and pull, Event Grid push, SQS long polling.
**Techniques**: exchange, meter, timer, failure, side by side, dial, caption.
**Review**: Improved — the push lane now backs off as real push brokers do (learning from 503s) instead of piling calls up indefinitely, which is the catalog's "the broker must back off"; the misconception now targets "push is just better".

### Event mesh and messaging bridges (`event-mesh`)

**The aha**: Apps keep talking to their local broker while a bridge or mesh carries events across infrastructure boundaries, so you can migrate gradually or go global without rewriting producers or consumers.
**Misconception to defeat**: That it's an enterprise service bus (a central hub full of logic), or that every event goes everywhere.
**Cast**: Two different brokers, on-prem (square) and cloud (round), each with local producers and consumers, joined by a bridge pipe that reshapes envelopes as they cross. Later, three regional brokers (EU, US, APAC) in a triangle: the mesh.
**Opening frame**: The two brokers unconnected, local traffic flowing in each.
**Story**:

1. On-prem, a producer publishes "OrderPlaced"; only local consumers see it. Caption: "Apps talk to their local broker."
2. The bridge switches on: the event crosses the pipe, changes to the cloud broker's format, and reaches a cloud consumer. Caption: "A bridge relays across the boundary."
3. Migration: consumers move to the cloud one by one, each reading its new local broker while the bridge feeds them the on-prem producer's events. Then the producer moves and the bridge goes quiet. Caption: "Move one app at a time; nothing rewritten."
4. Zoom out to three regions. An event is published in EU; only APAC has a subscriber for it, so it travels EU → APAC and never to US. Caption: "A mesh sends events where subscribers are."

**The moment**: Beat 4: an event crossing the globe to the one region with a listener, while no producer or consumer knows the topology.
**Interaction**: Add or remove a subscriber in any region and watch which links light up.
**Ending**: Three regions connected, every app still talking only to its own local broker.
**Variants**: `message-broker`, `publish-subscribe`, `message-transformation`; Architecture's `service-mesh` (synchronous calls, contrast); Azure's Messaging Bridge pattern.
**Techniques**: boundary, token, path trace, zoom, restyle, toggle, caption.
**Review**: Improved — fixed a self-contradicting migration beat (the producer "moved to cloud" without changing broker), made the bridge join two different products as the catalog describes, trimmed it, and showed what makes a mesh a mesh: events travel only where there's a subscriber.

## Event streaming (logs)

### Event streaming (the append-only log) (`event-streaming`)

**The aha**: Reading a log doesn't delete anything: it's a shared history that many consumers read independently, each at its own pace, and can read again.
**Misconception to defeat**: That it's a queue, where consuming removes the message.
**Cast**: A log drawn as a row of numbered cells filled left to right ("0 page view", "1 add to cart", …). Two consumers with their own offset markers: Analytics (fast) and Recommendations (slow).
**Opening frame**: Cells 0–4 filled, both markers at cell 2.
**Story**:

1. A producer appends event 5; the row grows by one cell and 0–4 are untouched. Caption: "Appended, never deleted."
2. Analytics reads cell 2 and its marker moves to 3; cell 2 stays exactly where it was. Caption: "Reading doesn't remove anything."
3. Recommendations, still at 2, reads the same cell later, unaffected by Analytics having moved on. Caption: "Many readers, each at its own speed."
4. Analytics' marker is dragged back to 0 and it reads 0–5 again, identical to the first time. Caption: "And you can read it again."

**The moment**: Beats 2 and 3: the same cell read twice by two consumers, neither consuming it away.
**Interaction**: Drag either marker anywhere on the row and replay from there; add a third consumer that starts at 0.
**Ending**: Six cells, two markers at different places; a small inset of a queue, its consumed message gone, labelled "not this".
**Variants**: `message-queue` (contrast), `queue-vs-log`, `consumer-offsets`, `retention-and-replay`; Kafka topics, Event Hubs, Kinesis Data Streams.
**Techniques**: contents, token, path trace, dial, side by side, caption.
**Review**: Improved — fixed the ending's cell count (six, not eight), named the consumers so their different speeds read as different jobs, and added the queue contrast the misconception names.

### Queue vs log (broker vs stream) (`queue-vs-log`)

**The aha**: Choose a queue to share out tasks, with acks, retries and a DLQ per message; choose a log for an ordered history that many consumers read and replay. The line is blurring from both sides.
**Misconception to defeat**: That Kafka is "just a faster queue".
**Cast**: Side by side, the same five orders in each. Left: a queue tube with a DLQ beneath and two workers. Right: a log of numbered cells with consumer markers.
**Opening frame**: Both holding orders 1–5 at rest.
**Story**:

1. Both consume order 1. Left: acked, it vanishes. Right: the cell stays and a marker moves past it. Caption: "Queue: done means deleted. Log: done means a marker moved."
2. Order 3 fails every time. Left: just 3 is retried, then dead-lettered, while 4 and 5 flow on. Right: the marker is stuck at 3; the only choices are retry forever or commit past it and skip. Caption: "A queue tracks each message. A log tracks one position."
3. A new team wants every order. Left: orders 1 and 2 are already gone, and a new queue starts empty. Right: a new consumer starts at offset 0 and reads all five. Caption: "A log replays history for anyone."
4. The blur: Kafka share groups add per-record acks and locks to a log; RabbitMQ streams put a log inside a broker. Caption: "The line is blurring, from both sides."

**The moment**: Beat 2: the same bad message, retried alone on the left, freezing the whole position on the right.
**Interaction**: A "share group" toggle replays beat 2 on the log with per-record acks: 3 is retried alone while 4 and 5 go through.
**Ending**: Two verdict cards under the panels: "Tasks to share out → queue." "History many systems read → log."
**Variants**: `event-streaming`, `message-queue`, `consumer-offsets`, `poison-message`, `visibility-timeout` (share groups' acquisition lock), `retention-and-replay`.
**Techniques**: side by side, contents, token, toggle, restyle, caption.
**Review**: Improved — replaced an overloaded fourth beat with the operational contrast people get burned by (one failing message: retried alone in a queue, stalling the whole position in a log), added the "new team wants the history" beat, and ends on the decision.

### Partitions (`stream-partitions`)

**The aha**: Partitions are the unit of both parallelism and ordering: more partitions let more consumers read at once, but order holds only inside each partition, never across the topic.
**Misconception to defeat**: That a topic is one ordered log, or that adding consumers always adds speed.
**Cast**: A topic split into three partitions, each a row of cells on a different broker. Events carry their send number, 1–9, and their partition's colour. One consumer group, one consumer per partition; an output rail (right) where processed events line up.
**Opening frame**: Three empty partitions, three idle consumers.
**Story**:

1. Events 1–9 arrive and spread across the partitions: 1, 4, 7 / 2, 5, 8 / 3, 6, 9. Caption: "A topic is several independent logs."
2. Each consumer reads its own partition at once, three markers advancing together. Caption: "More partitions, more parallel reading."
3. The middle partition's consumer is slower. The rail reads 1, 3, 2, 4, 6, 7, 9, 5, 8: each colour still in sequence, the topic as a whole not. Caption: "Order holds only inside a partition."
4. A fourth consumer joins the group; with three partitions it gets none and sits idle. Caption: "No more busy consumers than partitions."

**The moment**: Beat 3: the scrambled rail with every colour still in its own order.
**Interaction**: Dial partitions and consumers independently; idle consumers appear whenever consumers outnumber partitions, and the rail's interleaving changes with consumer speeds.
**Ending**: Three partitions fully read, the fourth consumer idle and labelled, the rail colour-coded by partition.
**Variants**: `partition-keys` (how an event picks its partition), `consumer-groups`, `consumer-rebalancing`, `message-ordering`; Data's `database-sharding` (the same split applied to tables); Kinesis shards.
**Techniques**: lanes, contents, token, spotlight, dial, caption.
**Review**: Improved — numbered, colour-coded events and an output rail make "order only inside a partition" visible rather than asserted by a zoom.

### Partition keys and per-key ordering (`partition-keys`)

**The aha**: Same key, same partition, same order: pick as the key whatever must stay in order, and watch for a hot key overloading one partition.
**Misconception to defeat**: That any key will do; the key decides both what stays in order and how evenly the load spreads.
**Cast**: A producer sending events keyed by customer ID (coloured dots). A hash box, "hash(key) mod 3", between the producer and three partitions, each a row of cells with its own consumer and load meter.
**Opening frame**: Three empty partitions, the producer about to send a mixed stream.
**Story**:

1. A red event (customer 7) passes through the hash box and lands in partition 1; every later red event lands there too. Caption: "Same key, same partition."
2. Blue and green events land in partitions 2 and 3, each colour in order in its own lane. Caption: "So each customer's events stay in order."
3. Customer 7 is a huge account: red floods partition 1, whose meter goes red as its consumer falls behind while the others idle. Caption: "A hot key overloads one partition."
4. The producer switches to no key: events spread evenly, but customer 7's events now land in all three partitions, out of order relative to each other. Caption: "Even spread, no per-customer order."

**The moment**: Beat 3: one partition straining under a hot key while its siblings sit idle.
**Interaction**: Choose the key (customer, order, country, none) and watch load and ordering change together.
**Ending**: Customer-keyed partitions, uneven from the hot key, each customer's events in order within its lane.
**Variants**: `stream-partitions`, `message-groups` (the queue version, with many dynamic groups), `message-ordering`; Data's `hot-partition`.
**Techniques**: token, path trace, meter, lanes, dial, caption.
**Review**: Improved — the misconception now matches the story (the key decides both order and spread), the hash function is labelled, and it links to Data's hot partitions.

### Offsets and committing (`consumer-offsets`)

**The aha**: A log consumer's progress is one number per partition, not a mark on each record: commit it before processing and a crash loses records, commit after and a crash repeats them.
**Misconception to defeat**: That it works like per-message acks, where the broker deletes or marks each message as it's done.
**Cast**: A partition of cells 0–9 that never changes. A consumer, and beside it a small card, "committed: 3", which the consumer writes (Kafka stores it in an internal offsets topic). A crash button.
**Opening frame**: The card at 3, cells 0–9 present, the consumer about to read.
**Story**:

1. The consumer reads cell 3, processes it, then commits: the card turns to 4. No cell changes. Caption: "Progress is one number."
2. It reads 4–7 as a batch, processes them, and commits 8 in a single write. Caption: "One commit covers everything before it."
3. Rewind. It commits 8 as soon as it reads the batch, then crashes on 5 (red flash). On restart it resumes at 8; 5–7 become red ghosts, never processed. Caption: "Commit before processing: records lost."
4. Rewind. It processes 4–7, then crashes just before committing. On restart the card still says 4, and 4–7 run again (amber). Caption: "Commit after: records repeated."

**The moment**: Beats 3 and 4: the same crash, and where the commit sat decides "never" or "twice".
**Interaction**: Drag the crash point and the commit point along the batch; every combination lands on done, lost or repeated.
**Ending**: The card at 8, the log unchanged, two ghost strips beside it: "lost 5–7" and "repeated 4–7".
**Variants**: `event-streaming`, `message-acknowledgement` (contrast), `delivery-guarantees` (the same choice with acks), `consumer-groups`, `stream-exactly-once`.
**Techniques**: contents, meter, restyle, failure, dial, spotlight, caption.
**Review**: Improved — added the beat that separates offsets from acks (one commit covers a whole batch), corrected where offsets live (the consumer writes them; Kafka stores them), and replaced a non-beat inset with a moment comparing the two crashes.

### Consumer groups (`consumer-groups`)

**The aha**: Within a group, members split the partitions between them (competing consumers); across groups, every group reads everything (pub/sub). One mechanism gives you both.
**Misconception to defeat**: That each group gets its own stored copy, like a topic subscription; there is one log, and each group just keeps its own offsets on it.
**Cast**: One topic with four partitions (rows of cells). Two groups drawn as coloured ovals around their members: "billing" (purple, three members) and "analytics" (green, one member). Each group's offset markers sit on the partitions in its colour.
**Opening frame**: Billing's members own partitions 0 and 3, 1, and 2; analytics' single member owns all four. Purple and green markers on every partition.
**Story**:

1. A new event lands in partition 0. It goes to billing's member 1, that partition's owner, and separately to analytics' member. Caption: "Across groups: everyone sees everything."
2. Inside billing, member 2 never sees what member 1 reads. Caption: "Inside a group: each partition to one member."
3. Zoom on partition 0: one row of cells, a purple and a green marker at different positions, no copy anywhere. Caption: "One log, a set of markers per group."
4. A fourth member joins billing; partition 3 moves to it, so each member has one. Analytics doesn't notice. Caption: "Add members, up to the partition count."

**The moment**: Beat 1: the same event delivered once inside billing and, independently, to analytics.
**Interaction**: Add or remove members in either group and watch assignment shift inside that group only.
**Ending**: Both groups fully assigned, purple and green markers at different points on the same four rows.
**Variants**: `stream-partitions`, `competing-consumers`, `publish-subscribe`, `topic-subscriptions` (contrast), `consumer-rebalancing`, `consumer-offsets`.
**Techniques**: boundary, path trace, token, zoom, caption.
**Review**: Improved — fixed a wrong opening (three members sharing four partitions don't leave one unassigned; one member takes two) and added per-group offset markers on a single log, which is what defeats the "separate copy per group" misconception.

### Consumer group rebalancing (`consumer-rebalancing`)

**The aha**: When a group's membership changes, its partitions are reassigned: reading pauses while they move, the new owner redoes any uncommitted work, and frequent rebalances can stall the whole group.
**Misconception to defeat**: That it's like a load balancer re-routing requests, instant and stateless; here each partition carries progress that has to be handed over.
**Cast**: Three partitions, three consumers each owning one, offset markers advancing. A group coordinator icon. A throughput meter for the group.
**Opening frame**: Three consumers reading steadily, the meter flat and healthy.
**Story**:

1. Consumer 2 crashes (red flash). Its session times out and the coordinator starts an eager rebalance: every consumer drops its partitions and stops, and the meter falls to zero. Caption: "Eager rebalance: everyone stops."
2. Partition 2 goes to consumer 1, which resumes from the last committed offset, a few records behind where consumer 2 died, and processes them again (amber). Caption: "The new owner redoes uncommitted work."
3. Rewind, cooperative rebalancing: only partition 2 moves; consumers 1 and 3 keep reading, and the meter dips instead of dropping. Caption: "Cooperative: only what moves pauses."
4. Rewind, static membership: consumer 2 restarts within the timeout under the same member ID and gets its partition back with no rebalance. Caption: "Quick restart, same ID: no rebalance."
5. A slow consumer overruns its poll deadline, is kicked out, rejoins, is kicked out again; the meter saws towards zero. Caption: "Rebalance storms stall the group."

**The moment**: Beats 1 and 3: the same crash freezing everyone under eager rebalancing and only one partition under cooperative.
**Interaction**: Crash a consumer with the protocol set to eager or cooperative and static membership on or off, and compare what pauses.
**Ending**: The group stable, consumer 1 owning two partitions, a note: "reprocessed: 3 records".
**Variants**: `consumer-groups`, `stream-partitions`, `consumer-offsets`, `idempotent-consumer` (surviving the redo), `consumer-lag`.
**Techniques**: failure, timer, meter, toggle, spotlight, side by side, caption.
**Review**: Improved — "everyone freezes" is true only of eager rebalancing, so cooperative rebalancing now runs beside it, and the storm is caused by overrunning the poll deadline (heartbeats have their own thread) rather than by missed heartbeats.

### Consumer lag (`consumer-lag`)

**The aha**: Lag, how far a consumer trails the newest event, is the health signal of an asynchronous system and the metric to scale consumers on.
**Misconception to defeat**: That fast processing per message means the system is keeping up; each message can be quick while the backlog in front of it grows.
**Cast**: A topic of two partitions growing on the right as events append. One consumer reading both, its markers trailing, each gap labelled "lag: N". A chart of total lag beneath. A card on the consumer: "processing time: 50 ms".
**Opening frame**: Markers two cells behind on each partition, "lag: 4", the chart flat.
**Story**:

1. Events append steadily and the consumer keeps pace; the gaps hold and the chart stays flat. Caption: "Keeping up: lag stays flat."
2. A sale starts and events arrive faster than one consumer can handle. The gaps widen to 200 and the chart climbs; the newest event will wait 40 s to be read. Caption: "Falling behind: lag grows."
3. The processing-time card still reads 50 ms, green. Caption: "Each message is fast. The line in front isn't."
4. Lag crosses a threshold on the chart and an autoscaler adds a second consumer, which takes one partition. Caption: "Scale consumers on lag."
5. Two consumers work the backlog; the gaps shrink and the chart comes back down to flat. Caption: "Back to a healthy baseline."

**The moment**: Beats 2 and 3: the lag chart climbing while per-message processing time stays green.
**Interaction**: Dial producer rate and consumer count; extra consumers help only up to the partition count.
**Ending**: Lag back at baseline, two consumers, the chart showing the hump.
**Variants**: `consumer-offsets`, `queue-based-load-leveling` (queue depth is the queue's equivalent), `stream-partitions`; Scaling's `scaling-metrics`; Containers' `k8s-keda`.
**Techniques**: meter, chart, contents, dial, spotlight, caption.
**Review**: Improved — fixed two errors: with one partition the added consumer would have sat idle (now two partitions), and the inset claimed end-to-end latency stays constant as lag grows, when it's per-message processing time that stays flat.

### Retention and replay (`retention-and-replay`)

**The aha**: A log keeps events for a set period whether or not they've been read, so you can rewind a consumer to fix a bug and reprocess, or start a new one from the beginning to rebuild its data.
**Misconception to defeat**: That this is backup and restore, or message TTL; retention applies to the whole log, read or not.
**Cast**: A log of order events with a retention line at its left edge, "7 days", sliding right as cells age out. A consumer, Tax, writing a table of tax per order. A second consumer, Search, not yet started.
**Opening frame**: Cells for the last seven days; Tax's table full of rows.
**Story**:

1. Time passes; the retention line slides right and the oldest cells grey and vanish, read or not. Caption: "Kept for a period, read or not."
2. A bug: since Tuesday, Tax has used 5% instead of 13%, and those rows glow red. The code is fixed, Tax's marker is dragged back to Tuesday, and it replays; the red rows turn green one by one. Caption: "Fix the bug, replay from where it mattered."
3. Search starts with its marker at the oldest cell and reads the whole window, building its index from scratch. Caption: "A new consumer builds from history."
4. Someone tries to replay from three weeks ago; the marker bumps against the retention line: "before retention". Caption: "Only as far back as retention allows."

**The moment**: Beat 2: the same events read again days later, and the red rows turning green.
**Interaction**: Drag any marker inside or outside the retention window; set retention to hours, days or forever.
**Ending**: Tax's table all green, Search caught up, the retention line still advancing.
**Variants**: `event-streaming`, `consumer-offsets`, `log-compaction` (keeps by key instead of age), `message-ttl` (contrast), `stream-exactly-once`; Data's `change-data-capture`.
**Techniques**: timer, contents, token, dial, failure, restyle, caption.
**Review**: Improved — a concrete bug and an output table whose red rows turn green make "replay to fix" visible (the old moment promised a corrected result the scene never showed), and it's trimmed.

### Log compaction (`log-compaction`)

**The aha**: A compacted topic keeps at least the latest record for every key and drops the older ones, so it becomes a durable table of current values that stops growing once every key is present.
**Misconception to defeat**: That it's time-based retention, which drops old records whatever their key.
**Cast**: A log of seven cells, offsets 0–6, each a key and value ("user-7: Elm St", "user-9: Pine Rd", "user-7: Oak Ave", …), some users updated several times. A compaction sweep (a highlighted band). The newest end of the log, still being written, shaded differently.
**Opening frame**: The seven cells with their repeated keys.
**Story**:

1. The sweep passes over the older part of the log; earlier values for repeated keys grey and vanish. Survivors keep their offsets, leaving gaps, and read like a table, one row per user. Caption: "Only the newest value per key survives."
2. A new consumer starts at the beginning and loads every user's current address in one pass. Caption: "A table you can load whole, and it stops growing."
3. user-4 gets a tombstone, a crossed-out cell with a null value. The next sweep removes user-4's older record; the tombstone lingers so consumers see the delete, then goes too. Caption: "A tombstone deletes the key."
4. Inset: time-based retention drops the oldest cells by age, taking a user's only address with them. Caption: "Retention drops by age. Compaction drops by key."

**The moment**: Beat 1: several updates to one key collapsing to a single survivor beside untouched keys, the offsets keeping their gaps.
**Interaction**: Append updates to existing keys and watch old versions sweep away; send a tombstone and watch the key disappear.
**Ending**: One row per key, user-4 gone, the newest end of the log still holding duplicates not yet compacted.
**Variants**: `retention-and-replay` (contrast), `stream-table-duality`, `event-carried-state-transfer` (a compacted topic as the full copy), `stateful-stream-processing` (compacted changelogs).
**Techniques**: contents, restyle, spotlight, side by side, toggle, caption.
**Review**: Improved — added the details that keep it true (survivors keep their offsets; the newest segment isn't compacted yet, hence "at least the latest"; tombstones linger before they go), used concrete keys, and trimmed.

### Source and sink connectors (`stream-connectors`)

**The aha**: Connectors attach systems at either end of a stream without writing code. The stream sits in the middle, and offsets track what has been moved.
**Misconception to defeat**: Confusing connectors with stream processors, which transform data rather than just move it.
**Cast**: A database cylinder with a few `orders` rows, a source connector box (reading the database's transaction log, the usual way CDC works), the log in the middle, a sink connector box, a search index as destination. Each connector carries a small position marker.
**Opening frame**: Database with rows, log empty, index empty, both markers at the start.
**Story**:

1. A row is updated in the database; the source connector, reading the transaction log, appends a change event to the log and advances its own source position. Caption: "Database changes become events. No code."
2. A producer-written event lands in the next cell. The two cells look the same to any reader. Caption: "Just another event in the log."
3. The sink connector, a consumer with its own offset, reads both and writes matching documents into the index. Caption: "And out again. No code."
4. The sink crashes after writing a document but before committing its offset. It restarts at the committed offset and writes that document a second time; because the write is keyed by order ID, the index ends up unchanged. Caption: "Resumes from its offset. A replay is harmless if the write is an upsert."
5. Inset: a stream processor in the same slot reshapes events (joins, aggregates) on the way through. Caption: "Connectors move. Processors transform."

**The moment**: Beat 2: the database-born cell indistinguishable from the hand-produced one.
**Interaction**: Swap the source or sink system and watch the middle log stay unchanged.
**Ending**: Database and index in sync, no application code written, both markers level with the log.
**Variants**: `event-streaming`, `stream-processing` (contrast), `message-transformation` (single message transforms); Data's change data capture.
**Techniques**: token, contents, path trace, side by side, failure, caption.
**Review**: Improved — the crash beat now says what offsets really guarantee (a replay of the last write, harmless only with an idempotent write) instead of "neither reprocessing nor skipping", the source side gets its own position (the log position), and the CDC tap is named as log reading.

## Stream processing

### Stream processing (`stream-processing`)

**The aha**: Batch stores data and queries it later; stream processing turns that around. The query runs forever, data flows through it, and results update within seconds.
**Misconception to defeat**: That it is a simple event handler that treats each event on its own, with no running computation across events.
**Cast**: Two panels. Left, "batch": a table of `logins` queried on demand, producing one report. Right, "stream": a flowing log with a standing query in its path ("failed logins per IP") and a live result beside it.
**Opening frame**: Left: a complete, static table. Right: stream flowing, query already running, result empty.
**Story**:

1. Left: a query runs once, scans the whole table, and a minute later produces one report. Caption: "Batch: store first, query later."
2. Right: events arrive one by one and the result updates after nearly each. Caption: "Stream: the query is always running."
3. The same new login lands in both. Left: nothing until someone reruns the query. Right: the result ticks up within a second, unasked. Caption: "Right now, not next time someone asks."
4. Below the stream, a per-event handler sits beside the standing query. Three failed logins from one IP arrive. The handler sees each alone and forgets it; the query has remembered the earlier two and fires on the third. Caption: "A handler sees one event. A stream query remembers across them."

**The moment**: Beat 4: the same three events, one component that cannot tell and one that raises the alarm (this is complex event processing, one kind of stream processing).
**Interaction**: Add a row or event to both panels at once and compare how soon each reflects it.
**Ending**: Left's report stale until the next run; right's result current to the last event.
**Variants**: `event-streaming`, `stream-windowing`, `stateful-stream-processing` (where the remembering lives); Data's batch processing (contrast).
**Techniques**: side by side, stream, token, contents, caption.
**Review**: Improved — the misconception (event handlers) was named but never shown; the pattern-detection beat now doubles as that contrast, with the handler failing on the same three logins the query catches.

### Event time vs processing time (`event-time-vs-processing-time`)

**The aha**: Events arrive late and out of order, so grouping by when the processor saw them gives wrong answers. Correct results need the timestamp of when the thing actually happened.
**Misconception to defeat**: That this is clock skew between servers. It is about delay in the network and on devices, which is there even if every clock is perfect.
**Cast**: A phone generating taps with their true times, going offline for a stretch, then reconnecting. A processor with two hourly bar charts side by side: "by processing time" and "by event time".
**Opening frame**: Phone online, sending steadily, both charts agreeing.
**Story**:

1. At 2:10pm the phone goes offline. Taps keep happening and are stamped 2:10 to 2:55 on the device, but nothing is sent. Caption: "Offline, but things still happened."
2. At 3:05pm it reconnects and sends the stored taps in one burst, out of step with the live ones. Caption: "They all arrive now."
3. The processing-time chart drops the whole burst into the 3pm bar, which spikes. Caption: "Processing time: wrong hour."
4. The event-time chart reads each tap's own timestamp and puts them back in the 2pm bar. Caption: "Event time: the right hour, however late."
5. A question mark over the 2pm bar: the processor cannot know whether more stragglers are coming. Caption: "When is 2pm finished? Watermarks."

**The moment**: Beats 3 and 4: the same burst landing in the wrong hour on one chart and the right hour on the other.
**Interaction**: Dial how long the phone stays offline and watch the two charts diverge further.
**Ending**: Two hourly charts, one with a false spike at 3pm, one correct; ingestion time (when the broker stored it) shown as a third stamp on the envelope, equally wrong here.
**Variants**: `stream-windowing`, `watermarks`.
**Techniques**: timer, meter, chart, side by side, toggle, caption.
**Review**: Improved — timestamps made consistent (the old burst covered "2:00 to 3:00" yet arrived at 3:00 with an hour in which nothing was offline), added the cost of event time (you can't know when an hour is complete, handing off to `watermarks`) and the third timestamp, ingestion time, which the catalog defines and which fails the same way.

### Windowing (tumbling, hopping, sliding, session) (`stream-windowing`)

**The aha**: You can't count all the clicks on an endless stream, only the clicks per window, and the shape of the window decides which question you're answering.
**Misconception to defeat**: Confusing this with rate-limiting windows, which count requests to throttle them, not to analyse them.
**Cast**: A stream of click events flowing beneath a timeline, each with an event-time stamp. Three window shapes drawn above it in turn: tumbling, hopping, session. A result label for each.
**Opening frame**: The stream flowing, no windows drawn yet, a question: "how many clicks?".
**Story**:

1. Tumbling windows appear: 5-minute boxes back to back, each emitting its count when it ends, the next starting at zero. Caption: "Tumbling: fixed, non-overlapping. Clicks per 5 minutes."
2. Hopping windows replace them: 6 minutes long, starting every 2. One click is counted in three windows at once, highlighted in all three. Caption: "Hopping: overlapping. A smooth, moving count."
3. Session windows replace those: each user's box stretches while clicks keep coming and closes after a 3-minute gap. Caption: "Session: bounded by inactivity, not the clock."
4. The three results sit side by side over the identical stream, each labelled with its question. Caption: "Same clicks, three different questions."

**The moment**: Beat 2: one click inside three overlapping windows at once, which looks wrong until you see the count is meant to move smoothly.
**Interaction**: Dial window size and hop, or switch window type, and watch the counts change.
**Ending**: Three window types over one stream: "per 5 minutes", "last 6 minutes, every 2", "per visit".
**Variants**: `event-time-vs-processing-time`, `watermarks`, `stream-joins`; Scaling's rate-limiting windows (contrast). Sliding windows are hopping with a hop of one event or tick; some engines define them differently, so the plan draws hopping and names the sliding family in a caption.
**Techniques**: stream, contents, side by side, toggle, dial, caption.
**Review**: Improved — windows now have real sizes (a click in three windows needs size three times the hop), the three outputs are labelled with the different questions they answer rather than "three correct answers to how many clicks", and sessions are per user, as they are in practice.

### Watermarks and late data (`watermarks`)

**The aha**: A watermark trades latency for completeness. Waiting longer for stragglers makes results more correct but later.
**Misconception to defeat**: Confusing Kafka's high-water mark, a position in a log, with this watermark, a progress estimate in event time.
**Cast**: A window box (2:00 to 2:05) collecting events by event-time stamp. A watermark line sliding along the event-time axis, labelled "no events older than this are still coming", set a few seconds behind the newest event seen. A "late" tray to the side.
**Opening frame**: Window open, watermark trailing the newest event by a few seconds, a few events inside.
**Story**:

1. Events arrive, mostly in order. The watermark advances behind the newest event seen. An out-of-order event arrives before the watermark passes the window's end and is simply counted. Caption: "The watermark's best guess at what's done."
2. The watermark passes 2:05. The window closes and emits its count. Caption: "Window closes when the watermark passes its end."
3. A straggler stamped 2:04 arrives just after. It is within the allowed lateness, so the window reopens, counts it and emits a corrected result, replacing the first. Caption: "Within allowed lateness: counted, result corrected."
4. A second straggler arrives beyond the allowed lateness and goes to the late tray, not counted. Caption: "Too late: set aside."
5. Dial the watermark's delay up: the first straggler now lands before the close, so no correction is needed, but the first result comes out later. Dial down: results are quick but corrections or drops multiply. Caption: "More completeness, less speed."

**The moment**: Beat 5: one dial moving a straggler between "late" and "on time" while the answer slides later.
**Interaction**: Dial the watermark delay and the allowed lateness and watch stragglers move between counted, corrected and dropped.
**Ending**: Final window count confirmed, one event in the late tray, the latency cost labelled.
**Variants**: `stream-windowing`, `event-time-vs-processing-time`; Kafka's high-water mark (named contrast).
**Techniques**: timer, contents, dial, failure, toggle, caption.
**Review**: Improved — the old dial blurred two things (the watermark's delay sets when the window first closes; allowed lateness only governs corrections after), so turning up lateness was wrongly said to delay the final result; the plan now has both, and shows the real trade-off on the watermark delay. Engines vary (Kafka Streams uses a grace period on stream time, Flink a watermark), so captions stay generic.

### Stream joins (`stream-joins`)

**The aha**: A join on endless data needs a bound, a time window for two streams or a locally held table for lookups, or the state it keeps grows forever.
**Misconception to defeat**: Confusing this with SQL joins on tables at rest, which have a fixed, finite set of rows to match against.
**Cast**: Two scenes. Left, stream-stream: `clicks` and `impressions` streams, both keyed by ad ID so matching keys reach the same processor, with a 10-minute window box buffering recent events from each. Right, stream-table: an `orders` stream beside a local `customers` table kept current from its own changelog topic.
**Opening frame**: Left: two streams flowing, window box empty. Right: a stream flowing, the table populated.
**Story**:

1. Left: a click and its impression, same ad ID, 3 minutes apart. Each waits in the window buffer until its partner arrives, then they snap into one joined record. Caption: "Stream-stream: matched within a window."
2. Left: a click arrives whose impression was 40 minutes earlier. The impression was already dropped from the buffer, so no match forms and the click ages out. Caption: "Outside the bound: no match."
3. Right: an order arrives; the operator looks up its customer in the local table and emits the enriched order at once. Caption: "Stream-table: enrich from the current value."
4. Right: the customer's row changes. The next order shows the new value; the earlier order is not re-emitted. Caption: "Looked up at the moment the order arrives."
5. Dashed boxes: the window buffer is bounded by time, the table by one row per key; a crossed-out "buffer everything forever" box grows off screen. Caption: "State needs a bound."

**The moment**: Beat 2: a click with a partner that exists but fell outside the bound, making the price of bounding visible.
**Interaction**: Dial the window size and watch match rate and buffered state both rise together.
**Ending**: Both joins producing a steady stream of joined or enriched output, bounded state boxes drawn.
**Variants**: `stream-windowing`, `stream-table-duality`, `stateful-stream-processing`; Data's SQL joins (contrast).
**Techniques**: boundary, token, contents, dial, side by side, caption.
**Review**: Improved — the table's bound is now one row per key rather than "a time window" (a table isn't time-bounded), co-partitioning by join key is shown (it's why the join works at scale), an early-clicked-then-matched buffer replaces instant matching, and the stream-table beat records that old output is not recomputed when the table changes.

### Stateful stream processing and state stores (`stateful-stream-processing`)

**The aha**: State lives next to the processor for speed, and fault tolerance comes from restoring a checkpoint or changelog and replaying the input from the matching offset.
**Misconception to defeat**: Confusing this with calling an external database for every event.
**Cast**: A processor with a local state store (running counts per key), a changelog topic it backs the state up to, and the input stream with an offset marker. A commit point that records the changelog position and input offset together.
**Opening frame**: State store empty, changelog empty, offset at 0.
**Story**:

1. Events arrive; the local store updates in memory with no network hop. Caption: "State lives right next to the processor."
2. Each change is also written to the changelog topic, a compacted log with one latest value per key. Caption: "Backed up as it goes."
3. At the commit point, the changelog is flushed and the input offset saved as a pair. Caption: "State and offset are saved together."
4. The processor crashes after more events; the local store is wiped. Caption: "The fast copy is gone."
5. A fresh processor reads the changelog to rebuild the store, then resumes input from the committed offset, so the few events after the commit are processed again. Caption: "Rebuilt, then replayed forward from the matching offset."
6. Inset: a design calling an external database per event, a round trip on every lookup. Caption: "Instead of calling out every time."

**The moment**: Beats 4 and 5: the store wiped to nothing, then rebuilt to the same values from a backup that was never the primary copy.
**Interaction**: Crash the processor at any point and see how much changelog is read and how many input events are replayed.
**Ending**: Store rebuilt, matching pre-crash values, processing resumed at the committed offset; a note that without the pairing a replayed event could be counted twice (`stream-exactly-once`).
**Variants**: `stream-exactly-once`, `consumer-offsets`, `stream-joins`, `stream-table-duality`.
**Techniques**: contents, meter, failure, path trace, side by side, caption.
**Review**: Improved — added the commit point, because restoring state and restarting from an unrelated offset double counts the events in between; the pairing is the real mechanism the catalog's "matching offset" means. Noted that the changelog is compacted, which bounds the restore.

### Stream-table duality (`stream-table-duality`)

**The aha**: A table is the latest value per key from a stream of changes, and a stream is the changelog of a table. Each can be turned into the other.
**Misconception to defeat**: Confusing this with event sourcing, which is an architecture built on this idea, not the idea itself.
**Cast**: A changelog stream on the left (cells like "user-7: Elm St"), a table with one row per key on the right, a two-way arrow between them.
**Opening frame**: Stream with a few cells, table empty.
**Story**:

1. The arrow runs left to right: each cell upserts its key's row, overwriting the previous value. Caption: "Aggregate a stream into a table."
2. The arrow runs right to left: a row in the table is inserted, updated, then deleted; each change is emitted as a cell (the delete as a null value). Caption: "A table's changes are a stream."
3. The table is wiped. The stream is replayed from the start and the identical table reappears. Caption: "Replay the changes and the table is back."
4. Badges: over the table "materialized view"; over the stream "changelog". Caption: "This is CDC, compacted topics, materialized views."

**The moment**: Beat 3: a wiped table rebuilt exactly by replaying its changelog, proving the two are the same data.
**Interaction**: Edit a table row or append a stream cell and watch the other side follow; replay with a different cutoff to see the table at an earlier time.
**Ending**: Both views identical in meaning, labelled "stream = changes, table = current state".
**Variants**: `log-compaction`, `event-carried-state-transfer`, `stateful-stream-processing`; Architecture's event sourcing and CQRS.
**Techniques**: path trace, side by side, toggle, contents, caption.
**Review**: Improved — the old "live in lockstep" beat is replaced by a replay-rebuilds-the-table beat, which actually proves the claim; "stream = history" is corrected to "stream = changes" (a table kept only as latest values has lost the overwritten ones, unlike an event-sourced log), and deletes appear as null-valued changes.
