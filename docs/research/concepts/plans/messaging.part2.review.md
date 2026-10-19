# Messaging plans, part 2: review (stage 3)

Reviewed: all 33 plans in `messaging.part2.md` (delivery guarantees, events and EDA, flow control,
distributed transactions and workflows, conversations, integration patterns), checked against
`catalog/messaging.md`, the sibling `messaging.part1.md`, and the overlapping plans in Reliability,
Scaling and Observability.

## Verdicts

| Verdict   | Count | Plans                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep      | 12    | `event-notification`, `event-carried-state-transfer`, `transactional-inbox`, `saga`, `compensating-transaction`, `routing-slip`, `request-reply-messaging`, `async-request-reply`, `splitter`, `aggregator`, `scatter-gather`, `message-transformation`                                                                                                                                                                                                                    |
| Improved  | 20    | `delivery-guarantees`, `exactly-once-processing`, `stream-exactly-once`, `guaranteed-delivery`, `idempotent-consumer`, `dual-write-problem`, `event-driven-architecture`, `domain-vs-integration-events`, `event-schema-evolution`, `schema-registry`, `queue-based-load-leveling`, `backpressure`, `consumer-prefetch`, `transactional-outbox`, `choreography-vs-orchestration`, `durable-execution`, `correlation-id`, `webhooks`, `content-based-router`, `claim-check` |
| Rethought | 0     | None. Every approach was sound; the problems were accuracy and focus.                                                                                                                                                                                                                                                                                                                                                                                                      |
| Merged    | 1     | `idempotency-key` (owned by Reliability)                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Most important changes

- **`schema-registry`: technical error fixed.** Under BACKWARD, the default, removing a field is
  allowed, so the plan's "rejected" change would have been accepted. The rejected change is now a
  type change (number to text), which fails every mode except NONE and also crashes the old
  consumer in the no-registry panel.
- **`stream-exactly-once`: abort corrected.** Aborted output doesn't "dissolve". It stays in the log
  behind an abort marker, and `read_committed` is what hides it, which is also the only reading under
  which the plan's read_committed toggle made sense.
- **`durable-execution`: false promise removed.** "Kill the worker at any moment and no call
  repeats" is wrong. A step killed mid-call has no recorded result and is retried (activities are
  at-least-once), so steps must be idempotent. A "break determinism" interaction was added.
- **`consumer-prefetch`: hoarding made accurate.** With all consumers connected, brokers deal
  round-robin, so no consumer "grabs all twelve". Hoarding comes from one consumer filling its
  buffer before the others arrive, which is also why autoscaled workers can find nothing to do.
- **`guaranteed-delivery`: the missing beat.** The same broker crash now happens twice: it loses
  the fire-and-forget message and is survived on a replica after a confirm. The ending had shown a
  promoted replica the story never showed.
- **`correlation-id`: refocused.** Its log-filter moment duplicated Observability's
  `correlation-ids`. It now shows what async adds: new message IDs at every hop and through
  fan-out, and a ten-minute queue wait where the tag is the only link. Deduping on the correlation
  ID visibly drops a real message.
- **`exactly-once-processing`: a blind choice.** The interaction now hides which loss happened, so
  the viewer chooses resend or give up the way a real sender does, without hindsight.
- **Misconceptions named but never shown, now shown.** These were try/catch in `dual-write-problem`,
  "event-driven = microservices" in `event-driven-architecture`, event sourcing in
  `transactional-outbox`, compress/chunk in `claim-check`, and the idempotency-key confusion in
  `correlation-id`.
- **`backpressure`: the colour now matches the meaning.** The slow-down pulse was red, which this
  area reserves for crashes. It's now amber, so backpressure reads as the system working. A
  bigger-buffer dial was borrowed from Scaling's plan.
- **Dangling links fixed.** `domain-events` became Architecture's `bounded-context` and
  `domain-driven-design`. `consumer-driven-contracts` became Delivery's `contract-testing` and
  Architecture's `api-versioning`. "Security's message signing" became `api-authentication-methods`.

## Cross-area issues to resolve

- **`queue-based-load-leveling` (Messaging) and `queue-load-levelling` (Scaling, already shipped)
  are the same concept under two ids.** `tools/catalog.py` doesn't reconcile them, because the ids
  differ, and both areas have full plans. One should merge into the other. The shipped id probably
  survives, and Messaging's side-by-side crash and equal-area chart should be carried over.
- **`backpressure`** is owned here, but Scaling also has a full plan (`scaling.part3.md`). Its
  reviewer should mark it Merged. Its best idea (a bigger buffer only delays the crash) is now in
  this plan.
- **`idempotency-key`**: Reliability's plan should borrow this one's "new key per retry" failure,
  the stored original response, the "server can spot a retry by its contents" misconception and the
  lost-responses dial. Neither plan covers a concurrent retry (409) or the same key with a
  different body (422).
- **Shared moments across ids.** `delivery-guarantees` and part 1's `message-acknowledgement` share
  the ack-before/after crash, and `correlation-id` and Observability's `correlation-ids` share the
  log filter. Both pairs now lean on different angles, but stage 4 could build each shared scene
  once and reuse it.

## Patterns for the platform (stage 4)

1. **One failure, two outcomes, side by side** is this part's dominant moment: the same crash in
   two synchronised lanes (`delivery-guarantees`, `guaranteed-delivery`, `dual-write-problem`,
   `idempotent-consumer`, `schema-registry`, the thin/fat pair). The platform needs lanes driven by
   one clock, plus a failure that can be injected at a named point in both.
2. **"Crash it anywhere" interactions** appear in eight plans (delivery guarantees, durable
   delivery, idempotent consumer, dual write, stream transactions, outbox, inbox, durable
   execution). They need the concept to be a
   small faithful simulation (state, rules, an injectable crash), not keyframes. That's also where
   the technical errors hid, so the simulation's rules need checking like any other claim.
3. **Tables as proof.** Ledgers, processed-ID tables, outbox and inbox rows and key tables carry the
   verdict in most plans. The platform needs rows that appear, glow, turn amber as duplicates and
   get struck through as aborted, inside a database element.
4. **A transaction bracket over parts of several elements** (rows in two tables, a log's tail plus an
   offset marker), with commit (green, everything inside changes in one frame) and abort.
5. **A code step**: a short listing whose current line highlights in step with the diagram
   (`dual-write-problem`, `durable-execution`, `event-driven-architecture`).
6. **Tokens with several tags**: message ID, correlation ID, idempotency key, reply-to, "i of n".
   Tags must survive a clone while the message ID changes.
7. **Signals that travel backwards**: acks, confirms, callbacks and backpressure pulses. Colour
   has to carry meaning across the area: red only for failure, amber currently for both duplicates
   and "slow down". Stage 4 should settle that palette.
8. **A curtain** (hiding part of the scene to show one party's limited view) is used here and by
   Reliability's `partial-failure`. It's worth adding to the technique vocabulary.
9. **Replay under a switch**: most interactions re-run the same scenario with one rule changed
   (dedupe on/off, read_committed, key reuse, prefetch). The platform should model a scenario
   plus parameters, so one toggle re-runs it.
10. **Length**: plans run about 300 to 400 words, against the 150 to 300 target. The excess is
    mostly interaction detail that stage 4 will need anyway, so it was trimmed only where edits
    added words.
