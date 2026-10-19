# Messaging & events: concept catalog

## Scope

**In:** how software components talk to each other without calling each other directly. That covers sync vs async
communication and the vocabulary of messages, events and commands. It covers message queues and their whole
lifecycle (acknowledgements, locks, retries, poison messages, dead-lettering, TTL, delay, priority, ordering,
grouping, deduplication) and publish/subscribe (topics, subscriptions, fan-out, filtering, push vs pull). Event
streaming on logs is in (partitions, keys, offsets, consumer groups, rebalancing, lag, retention, replay, compaction,
connectors), as is stream processing (time, windows, watermarks, joins, state). So are delivery guarantees and
duplicates (at-most/at-least/exactly-once, idempotency, the dual-write problem) and event-driven architecture with its
event styles and schema evolution. Flow control (load leveling, backpressure, prefetch) is in. The patterns that keep
state consistent across services are in: outbox, inbox, saga, choreography vs orchestration, compensation and
workflow engines. So are the conversation patterns (request-reply, correlation, 202-and-poll, webhooks) and the
Enterprise Integration routing and transformation patterns.

**Left to other areas:**

- **Data**: event sourcing's storage side, change data capture, replication, partitioning theory, eventual
  consistency, two-phase commit, batch analytics. Event sourcing and CQRS are listed here only as overlaps.
- **Architecture**: CQRS, microservices, serverless, pipes and filters, the ESB debate.
- **Reliability**: generic retry with backoff, circuit breaker.
- **Scaling**: rate limiting, throttling, autoscaling.
- **Observability**: distributed tracing.
- **Networking**: WebSockets, SSE.
- **Platform files**: each cloud's own messaging services (Service Bus sessions, SQS FIFO, Event Grid vs Event Hubs,
  EventBridge, Pub/Sub) are listed under Overlaps only.

Every concept here is `any` platform. The general idea lives here; each cloud's version lives in its platform file.

## Sources

Pattern catalogs and product documentation:

- Enterprise Integration Patterns, pattern catalog (Hohpe & Woolf):
  <https://www.enterpriseintegrationpatterns.com/patterns/messaging/toc.html>
- Apache Kafka documentation, Design section (persistence, push vs pull, consumer position, delivery semantics,
  transactions, share consumer, replication, log compaction, quotas): <https://kafka.apache.org/43/design/design/>
- Apache Kafka Streams core concepts (time, stream-table duality, windowing, state stores, exactly-once):
  <https://kafka.apache.org/43/streams/core-concepts/>
- KIP-98 Exactly Once Delivery and Transactional Messaging:
  <https://cwiki.apache.org/confluence/display/KAFKA/KIP-98+-+Exactly+Once+Delivery+and+Transactional+Messaging>
- KIP-932 Queues for Kafka (share groups), production-ready in Kafka 4.2:
  <https://cwiki.apache.org/confluence/spaces/KAFKA/pages/255070434/KIP-932+Queues+for+Kafka>,
  <https://kafka.apache.org/blog/2026/02/17/apache-kafka-4.2.0-release-announcement/>
- RabbitMQ tutorials (work queues, pub/sub, routing, topics, RPC, publisher confirms, streams, offset tracking):
  <https://www.rabbitmq.com/tutorials>
- RabbitMQ AMQP 0-9-1 concepts (exchanges, bindings, acks, prefetch, durability):
  <https://www.rabbitmq.com/tutorials/amqp-concepts>
- RabbitMQ reliability guide (consumer acks, publisher confirms, redelivery, idempotence):
  <https://www.rabbitmq.com/docs/reliability>
- microservices.io pattern language (communication style, transactional messaging, data management):
  <https://microservices.io/patterns/index.html>, idempotent consumer
  <https://microservices.io/patterns/communication-style/idempotent-consumer.html>
- Azure Architecture Center, Cloud Design Patterns catalog (competing consumers, queue-based load leveling, priority
  queue, claim check, sequential convoy, async request-reply, choreography, saga, compensating transaction,
  publisher-subscriber, idempotent consumer, messaging bridge): <https://learn.microsoft.com/en-us/azure/architecture/patterns/>
  - Sequential Convoy: <https://learn.microsoft.com/en-us/azure/architecture/patterns/sequential-convoy>
  - Messaging Bridge: <https://learn.microsoft.com/en-us/azure/architecture/patterns/messaging-bridge>
- Azure Architecture Center, Event-driven architecture style (pub/sub vs streaming, consumer variations, broker vs
  mediator topology, challenges):
  <https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven>
- Azure, Compare messaging services (events vs messages, discrete vs series):
  <https://learn.microsoft.com/en-us/azure/service-bus-messaging/compare-messaging-services>
- Amazon SQS developer guide (visibility timeout, retention, delay queues, long polling, DLQ/redrive, FIFO, message
  groups, deduplication, large messages):
  <https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-basic-architecture.html>
- Amazon EventBridge concepts (buses, rules, event patterns, input transformer, archive and replay, schema registry,
  API destinations): <https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is-how-it-works-concepts.html>
- AWS Prescriptive Guidance, Cloud design patterns (publish-subscribe, saga choreography/orchestration,
  scatter-gather, transactional outbox, event sourcing, retry with backoff):
  <https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/introduction.html>
- Google Cloud Pub/Sub subscriptions (pull/push/export, ack deadline, retention and seek, ordering keys,
  exactly-once delivery, dead-letter topics, retry policy):
  <https://docs.cloud.google.com/pubsub/docs/subscription-overview>
- CloudEvents specification v1.0 (CNCF): <https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md>
- Martin Fowler, "What do you mean by Event-Driven?" (event notification, event-carried state transfer, event
  sourcing, CQRS): <https://martinfowler.com/articles/201701-event-driven.html>
- Apache Flink, Timely stream processing (event time, watermarks, lateness, windows):
  <https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/>
- Confluent Schema Registry, schema evolution and compatibility:
  <https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html>
- Standard Webhooks specification (webhook-id, timestamps, signatures, retries):
  <https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md>
- Temporal, Workflows and durable execution: <https://docs.temporal.io/workflows>
- Martin Kleppmann, _Designing Data-Intensive Applications_, ch. 11 "Stream Processing" (outline checked):
  <https://www.oreilly.com/library/view/designing-data-intensive-applications/9781491903063/ch11.html>

Syllabi used to check coverage:

- AWS Certified Developer – Associate (DVA-C02) exam guide: event-driven, choreography, orchestration and fanout
  patterns; idempotency; sync vs async; loose coupling; retries and DLQs; event source mapping; subscription filter
  policies; streaming. <https://d1.awsstatic.com/training-and-certification/docs-dev-associate/AWS-Certified-Developer-Associate_Exam-Guide.pdf>
- Confluent Certified Developer for Apache Kafka (CCDAK) outline: fundamentals 23%, application development 28%,
  Streams 12%, Connect 15%, testing 8%, observability 13%.
  <https://oso.sh/blog/confluent-certified-developer-for-apache-kafka-study-guide/>
- Microsoft AZ-204 study guide, "Develop event-based solutions" and "Develop message-based solutions". The exam
  retired on July 31, 2026, but it's still a useful list of what an Azure developer was expected to know.
  <https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-204>

## Catalog

77 concepts: 12 tier 1, 44 tier 2, 21 tier 3.

### Communication styles and vocabulary

| id                          | Concept                                   | Tier | Platform | What it is                                                                                                                                                                                                                      | The idea to get across                                                                                                                                                                                                                  | Often confused with                                                                                            |
| --------------------------- | ----------------------------------------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| sync-vs-async-communication | Synchronous vs asynchronous communication | 1    | any      | Sync: the caller sends a request and waits for the answer (HTTP, gRPC). Async: the caller hands a message to a channel and carries on; the receiver handles it later.                                                           | Async removes temporal coupling. The receiver doesn't have to be up, fast or even exist when the sender acts, but the sender gives up the immediate answer.                                                                             | async/await in code, which is about threads in one process, not about whether the other side must be available |
| message-broker              | Message broker                            | 1    | any      | A server (RabbitMQ, Service Bus, SQS, Kafka, Pub/Sub) that accepts messages from producers, stores them and delivers them to consumers.                                                                                         | The broker is a middleman that holds messages, so producers and consumers never talk directly and never need to be online at the same time.                                                                                             | Load balancer or API gateway, which forward requests synchronously and store nothing                           |
| message-anatomy             | Message anatomy (headers, body, IDs)      | 2    | any      | A message is a body (the payload, opaque to the broker) plus headers and properties: message ID, content type, timestamp, correlation ID, TTL, routing key, delivery count.                                                     | Brokers route, filter, dedupe and expire messages by their headers without reading the body, so the headers decide what the infrastructure can do for you.                                                                              | The payload schema                                                                                             |
| events-vs-commands          | Events vs commands vs messages            | 2    | any      | "Message" is the envelope. A command asks one specific receiver to do something ("ChargeCard"). An event announces a fact that already happened ("OrderPlaced") to whoever cares. A document or query carries or asks for data. | A command is imperative, has one owner and can be refused. An event is past tense, belongs to its publisher, and the publisher doesn't know who listens. An event the sender secretly needs acted on is a "passive-aggressive command". | Calling every message an "event"                                                                               |
| messaging-protocols         | Messaging protocols (AMQP, MQTT, Kafka)   | 3    | any      | The wire protocols clients use with brokers: AMQP 0-9-1 and 1.0 for enterprise queuing, MQTT for lightweight device pub/sub with QoS 0/1/2, the Kafka protocol, and HTTP and STOMP.                                             | The protocol is separate from the broker. One broker can speak several, and some guarantees (MQTT QoS levels) are built into the protocol itself.                                                                                       | HTTP and WebSockets, which are request/response and connection protocols, not brokered messaging               |
| cloudevents                 | CloudEvents                               | 3    | any      | A CNCF standard event envelope: required `id`, `source`, `specversion`, `type`; optional `subject`, `time`, `datacontenttype`, `dataschema`; bindings for HTTP, AMQP, Kafka and MQTT in structured or binary mode.              | With a common envelope, any router, filter or function can handle events from any producer by reading the same few attributes, without understanding each payload.                                                                      | A payload schema (CloudEvents standardises only the metadata around the data)                                  |

### Message queues

| id                      | Concept                                         | Tier | Platform | What it is                                                                                                                                                                                                      | The idea to get across                                                                                                                                                                                              | Often confused with                                                                                                |
| ----------------------- | ----------------------------------------------- | ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| message-queue           | Message queue (point-to-point)                  | 1    | any      | A named buffer where producers put messages and consumers take them off. Each message goes to exactly one consumer.                                                                                             | The producer drops work off and leaves, and the message is removed once one consumer has handled it. Whoever asks for work no longer has to wait for whoever does it.                                               | A topic (every subscriber gets a copy); a log (messages stay after being read)                                     |
| competing-consumers     | Competing consumers                             | 1    | any      | Several instances of the same consumer read from one queue, and the broker hands each message to only one of them.                                                                                              | To go faster, add workers. The queue spreads messages across them and a crashed worker's message goes to another, but processing order is no longer guaranteed.                                                     | Pub/sub, where each subscriber gets every message                                                                  |
| message-acknowledgement | Acknowledgements (ack, nack, reject)            | 2    | any      | After processing, the consumer tells the broker "done" (ack) so it deletes the message, or "failed" (nack, abandon, reject) so it is redelivered or dead-lettered.                                              | The broker deletes a message only when told to, so if the consumer crashes before acking, the message comes back. Acking before or after the work decides whether you risk losing a message or processing it twice. | Publisher confirms (the broker acknowledging the producer); TCP acks                                               |
| visibility-timeout      | Visibility timeout / peek-lock                  | 2    | any      | On receive, the message is locked and hidden from other consumers for a set time rather than deleted (SQS visibility timeout, Service Bus peek-lock, Pub/Sub ack deadline), and reappears if not acked in time. | The consumer leases the message rather than removing it. If processing outlasts the lease, a second consumer gets it too, so set the timeout above worst-case processing time or renew the lock.                    | Message TTL (how long an unread message may wait in the queue)                                                     |
| poison-message          | Poison message                                  | 2    | any      | A message that fails every time it is processed (malformed data, a bug it triggers), so it keeps being redelivered.                                                                                             | Without a retry limit, one bad message loops forever, burns consumer time and, in an ordered queue, blocks every message behind it.                                                                                 | A transient failure, where the same message would succeed on retry                                                 |
| dead-letter-queue       | Dead-letter queue (DLQ)                         | 1    | any      | A side queue where the broker moves messages that hit the maximum delivery count, expired, or were explicitly rejected, together with the reason.                                                               | The DLQ quarantines failures so the main flow keeps moving and keeps them for inspection and redrive. A DLQ nobody watches is silent data loss.                                                                     | A retry queue (designed to be re-consumed automatically); deleting the message                                     |
| message-redelivery      | Redelivery and delayed retry                    | 2    | any      | A failed message comes back through a nack or an expired lock, with its delivery count incremented. Retries can be immediate, or delayed through retry queues or topics with growing delays before the DLQ.     | Immediate redelivery hammers a struggling dependency and, on a log, stalls the partition. Delayed retry tiers give the dependency time to recover while other messages keep flowing.                                | Client-side retry of a synchronous call (Reliability's retry with backoff)                                         |
| message-ttl             | Message TTL / expiration                        | 2    | any      | A time-to-live on a message or a whole queue, after which an unconsumed message is discarded or dead-lettered.                                                                                                  | Some messages are worthless once late (a price quote, a "ring the doorbell" signal). TTL drops them so consumers never act on stale data.                                                                           | Log retention (applies to the whole log whether read or not); visibility timeout                                   |
| scheduled-messages      | Delayed and scheduled messages                  | 2    | any      | A message sent now but invisible to consumers until a delay passes or a set time arrives (SQS delay queues and message timers, Service Bus scheduled messages, RabbitMQ delayed exchange).                      | The broker works as a durable timer. "Send a reminder in 24 hours" survives restarts without a cron job or a sleeping thread.                                                                                       | Recurring schedulers and cron; message TTL                                                                         |
| priority-queue          | Priority queue                                  | 2    | any      | Messages carry a priority: either one queue serves high-priority messages first, or separate queues per priority get different numbers of consumers.                                                            | Urgent work overtakes routine work, but low-priority work can starve. In the cloud the usual form is separate queues with dedicated consumer pools.                                                                 | FIFO ordering                                                                                                      |
| message-ordering        | Message ordering (FIFO vs best-effort)          | 2    | any      | Standard queues deliver roughly in order at high throughput. FIFO queues guarantee first-in, first-out within a queue or group at lower throughput. A resequencer can restore order downstream.                 | Strict order costs parallelism. One slow or failing message holds up everything behind it (head-of-line blocking), and competing consumers reorder anyway, so order only ever holds within one partition or group.  | Exactly-once (FIFO queues often bundle dedup, but ordering and duplicates are separate problems)                   |
| message-groups          | Message groups and sessions (sequential convoy) | 2    | any      | Messages carry a group key (session ID, message group ID, ordering key). The broker locks each group to one consumer and delivers it in order, while different groups are processed in parallel.                | Messages stay in order where it matters and run in parallel everywhere else: each order or customer is a lane processed one at a time, and lanes scale out. The key chosen sets how much parallelism you get.       | Partition keys in streams (same idea on a log, but partitions are few and fixed while groups are many and dynamic) |
| message-deduplication   | Broker-side duplicate detection                 | 2    | any      | The broker remembers message IDs (or content hashes) for a window and drops a re-sent message with the same ID (SQS FIFO 5-minute window, Service Bus duplicate detection, Kafka idempotent producer).          | It catches producer retries (a resend after the broker's ack was lost), but only within the window, and it doesn't stop a consumer seeing a message twice, so consumers still need idempotency.                     | Idempotent consumer (dedup at the receiving end)                                                                   |

### Publish/subscribe and broker routing

| id                    | Concept                                           | Tier | Platform | What it is                                                                                                                                                                                                                                                          | The idea to get across                                                                                                                                                                                           | Often confused with                                                                                                 |
| --------------------- | ------------------------------------------------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| publish-subscribe     | Publish/subscribe                                 | 1    | any      | A publisher sends a message to a topic and every subscription receives its own copy. The publisher doesn't know who subscribes.                                                                                                                                     | One event can trigger many independent reactions, and adding a subscriber needs no change to the publisher.                                                                                                      | A message queue (one message, one consumer)                                                                         |
| topic-subscriptions   | Topics and durable subscriptions                  | 2    | any      | A topic is where messages are published. Each subscription is a named, durable, queue-like copy with its own backlog, filter and DLQ. An offline subscriber gets its messages later; a subscription created later misses what was sent before it existed.           | A subscription is effectively a queue. Each subscriber reads at its own pace, a slow one doesn't hold up the rest, and only subscriptions that exist at publish time receive the message.                        | Kafka consumer groups (all groups read one retained log and can start from the beginning)                           |
| fan-out               | Fan-out (topic to queues)                         | 2    | any      | Publish once to a topic that delivers into several queues, one per downstream service (SNS to SQS, Service Bus topic with auto-forward, RabbitMQ fanout exchange).                                                                                                  | Fan-out combines pub/sub's reach with a queue's safety: every service gets a copy, and each buffers, retries and scales its copy independently.                                                                  | Scatter-gather (fans out, then collects replies)                                                                    |
| message-filtering     | Subscription filtering (topic- and content-based) | 2    | any      | Subscribers declare what they want, either by topic or routing-key pattern (`orders.*.eu`) or by rules on attributes and content (SNS filter policies, Service Bus SQL filters, EventBridge event patterns, Pub/Sub filters).                                       | With filtering at the broker, consumers receive only relevant messages instead of receiving everything and discarding most, which saves cost and code.                                                           | Content-based router (each message goes to exactly one destination)                                                 |
| exchange-bindings     | Exchanges, bindings and routing keys              | 3    | any      | The AMQP 0-9-1 model (RabbitMQ): producers publish to an exchange, not a queue. Bindings connect exchanges to queues, and the exchange type (direct, fanout, topic, headers) decides which queues get a copy, by routing key or headers.                            | Routing is kept apart from storage: the exchange decides where messages go and queues only hold them. Changing the bindings makes the same publish point-to-point, broadcast or pattern-matched.                 | A Kafka topic (which stores messages; an exchange stores nothing)                                                   |
| push-vs-pull-delivery | Push vs pull delivery                             | 2    | any      | Pull: consumers ask the broker for messages, by polling or long polling (SQS, Kafka, Pub/Sub pull). Push: the broker calls the consumer (Pub/Sub push, Event Grid, webhooks, AMQP consumers).                                                                       | Pull lets each consumer set its own pace, which is built-in backpressure. Push gives the lowest latency, but the broker must back off when the endpoint struggles. Long polling makes pull nearly as responsive. | Mobile push notifications                                                                                           |
| event-mesh            | Event mesh and messaging bridges                  | 3    | any      | Linking brokers so messages flow between them. A messaging bridge relays between two different systems (MSMQ to Service Bus, on-premises to cloud). An event mesh is a network of brokers across regions and clouds that routes events to wherever subscribers are. | Apps keep talking to their local broker while the bridge or mesh carries events across infrastructure boundaries, so you can migrate gradually or go global without rewriting producers or consumers.            | Enterprise service bus (a central hub with transformation logic); service mesh (synchronous calls between services) |

### Event streaming (logs)

| id                   | Concept                               | Tier | Platform | What it is                                                                                                                                                                                                                                                              | The idea to get across                                                                                                                                                                                                                                                       | Often confused with                                                           |
| -------------------- | ------------------------------------- | ---- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| event-streaming      | Event streaming (the append-only log) | 1    | any      | Producers append events to a durable, ordered log (Kafka topic, Event Hubs, Kinesis stream). Consumers read it by position, and the events stay after being read.                                                                                                       | Reading doesn't delete anything. The log is a shared history that many consumers read independently, each at its own speed, and can read again.                                                                                                                              | A message queue (where consuming removes the message)                         |
| queue-vs-log         | Queue vs log (broker vs stream)       | 2    | any      | Queues (RabbitMQ, Service Bus, SQS) track each message and delete it on ack. Logs (Kafka, Kinesis, Event Hubs) keep everything for a retention period and let each consumer track its own offset.                                                                       | Choose a queue to distribute tasks with per-message acks, retries and DLQs. Choose a log for high-volume ordered history that many consumers replay. The line is blurring: Kafka share groups (4.2) add per-record acks to a log, and RabbitMQ streams add logs to a broker. | Treating Kafka as "just a faster queue"                                       |
| stream-partitions    | Partitions                            | 2    | any      | A topic is split into partitions (shards in Kinesis). Each partition is an independently ordered log that can live on a different broker.                                                                                                                               | Partitions are the unit of both parallelism and ordering. More partitions let more consumers read at once, but order holds only inside one partition, and a consumer group can't usefully have more members than partitions.                                                 | Database sharding (Data; the same idea applied to tables)                     |
| partition-keys       | Partition keys and per-key ordering   | 2    | any      | The producer sets a key (customer ID, device ID), and a hash of the key picks the partition, so all events with that key land in one partition, in order.                                                                                                               | Same key, same partition, same order. Pick as the key whatever must stay in order, and watch for a hot key overloading a single partition.                                                                                                                                   | Message groups (sessions in a queue)                                          |
| consumer-offsets     | Offsets and committing                | 2    | any      | Each record has a sequential offset within its partition. A consumer commits the offset it has processed up to, and resumes from there after a restart.                                                                                                                 | The consumer, not the broker, tracks progress, as one number per partition. Committing before processing risks losing records; committing after risks reprocessing them.                                                                                                     | Per-message acks, where the broker deletes each message                       |
| consumer-groups      | Consumer groups                       | 2    | any      | Consumers sharing a group ID split a topic's partitions between them, one consumer per partition. Different groups each read the whole stream independently.                                                                                                            | Within a group, members compete for partitions (competing consumers); across groups, every group sees everything (pub/sub). One mechanism gives you both.                                                                                                                    | Topic subscriptions (where the broker keeps a separate copy per subscription) |
| consumer-rebalancing | Consumer group rebalancing            | 3    | any      | When a consumer joins, leaves or dies, the group reassigns partitions among its members. Eager rebalancing stops everyone; cooperative rebalancing moves only some partitions; static membership avoids rebalances on quick restarts.                                   | Scaling out or a crash briefly pauses consumption and moves partitions, so the new owner may redo in-flight work. Frequent rebalances (slow consumers missing heartbeats) can stall a whole group.                                                                           | Load-balancer rebalancing                                                     |
| consumer-lag         | Consumer lag                          | 2    | any      | How far a consumer is behind the newest event in the stream (latest offset minus committed offset). For a queue, the equivalent is queue depth.                                                                                                                         | Lag is the health signal of an asynchronous system. Growing lag means consumers can't keep up, and it's the metric to autoscale consumers on (for example with KEDA).                                                                                                        | The latency of a single message                                               |
| retention-and-replay | Retention and replay                  | 2    | any      | A log keeps events up to a time or size limit (or forever) whether they've been read or not. A consumer can reset its offset to read again from any point.                                                                                                              | Because the history is kept, you can fix a bug and reprocess, start a new consumer from the beginning, or rebuild a downstream database from the stream.                                                                                                                     | Backup and restore; message TTL                                               |
| log-compaction       | Log compaction                        | 3    | any      | Instead of deleting by age, a compacted topic keeps at least the latest record for every key and removes older ones. A record with a null value (a tombstone) deletes the key.                                                                                          | The log becomes a durable table of latest values, which a new consumer can load in full and which stops growing once every key is present.                                                                                                                                   | Time-based retention (drops old records whatever their key)                   |
| stream-connectors    | Source and sink connectors            | 3    | any      | Pre-built adapters that move data into a stream from another system (database CDC, files, SaaS) or out of it (warehouse, search, object storage): Kafka Connect, Event Hubs Capture, Pub/Sub export subscriptions, EventBridge Pipes. EIP calls this a channel adapter. | Systems can be connected without writing code. The stream sits in the middle, connectors attach systems at either end, and offsets track what has been moved.                                                                                                                | Stream processors (which transform data rather than just move it)             |

### Stream processing

| id                            | Concept                                         | Tier | Platform | What it is                                                                                                                                                                                                                                                             | The idea to get across                                                                                                                                                                                                                 | Often confused with                                                             |
| ----------------------------- | ----------------------------------------------- | ---- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| stream-processing             | Stream processing                               | 2    | any      | Computations that run continuously over unbounded event streams (filter, transform, aggregate, detect patterns) and emit results as events arrive: Kafka Streams, Flink, Spark Structured Streaming, Stream Analytics, Dataflow.                                       | Batch stores data and queries it later. Stream processing turns that around: the query runs forever, data flows through it, and results update within seconds. Complex event processing (matching patterns across events) is one kind. | Batch processing (Data); simple event handlers that treat each event on its own |
| event-time-vs-processing-time | Event time vs processing time                   | 3    | any      | Event time is when something happened (a timestamp in the event). Processing time is when the processor sees it. Ingestion time is when the broker stored it.                                                                                                          | Events arrive late and out of order (a phone offline for an hour), so grouping by processing time gives wrong answers. Correct results need event time.                                                                                | Clock skew between servers                                                      |
| stream-windowing              | Windowing (tumbling, hopping, sliding, session) | 2    | any      | Cutting an infinite stream into finite buckets so it can be aggregated: tumbling windows (fixed, non-overlapping), hopping or sliding windows (overlapping), session windows (separated by gaps of inactivity).                                                        | You can't count all the clicks on an endless stream, only the clicks per window, and the shape of the window decides which question you're answering.                                                                                  | Rate-limiting windows (fixed and sliding window counters in Scaling)            |
| watermarks                    | Watermarks and late data                        | 3    | any      | A watermark is the processor's running estimate that no more events older than time T are coming. A window closes when the watermark passes its end; events arriving after that are late, and are either handled within an allowed lateness (grace period) or dropped. | A watermark trades latency for completeness. Waiting longer for stragglers makes results more correct but later.                                                                                                                       | Kafka's high-water mark (a position in a log, not progress in event time)       |
| stream-joins                  | Stream joins                                    | 3    | any      | Combining streams. A stream-stream join matches events from two streams within a time window (a click with its ad impression). A stream-table join enriches each event with the current value from a table (an order with its customer).                               | A join on endless data needs a bound, either a time window for two streams or a locally held table for lookups, or the state it keeps grows forever.                                                                                   | SQL joins on tables at rest                                                     |
| stateful-stream-processing    | Stateful stream processing and state stores     | 3    | any      | Operators that remember things across events (counts, windows, join tables) keep that state locally, partitioned like their input, and back it up to a changelog topic or checkpoints so it can be rebuilt after a failure.                                            | State lives next to the processor for speed. Fault tolerance comes from restoring the checkpoint or changelog and replaying the input from the matching offset.                                                                        | Calling an external database for every event                                    |
| stream-table-duality          | Stream-table duality                            | 3    | any      | A table is the latest value per key from a stream of changes, and a stream is the changelog of a table. Each can be turned into the other: aggregate a stream into a table, or emit a table's updates as a stream.                                                     | The same data has two views: the stream is the history and the table is the current state. This idea underlies CDC, compacted topics, materialized views and event sourcing.                                                           | Event sourcing (an architecture built on this idea)                             |

### Delivery guarantees and duplicates

| id                      | Concept                                                         | Tier | Platform | What it is                                                                                                                                                                                                                                                                                        | The idea to get across                                                                                                                                                                                                                                   | Often confused with                                                                    |
| ----------------------- | --------------------------------------------------------------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| delivery-guarantees     | Delivery guarantees (at-most-once, at-least-once, exactly-once) | 1    | any      | At-most-once: a message may be lost but never repeated. At-least-once: never lost but may be repeated. Exactly-once: each message takes effect once.                                                                                                                                              | It comes down to when you acknowledge. Ack before processing and a crash loses the message; ack after and a crash repeats it. Most brokers default to at-least-once.                                                                                     | Ordering guarantees                                                                    |
| exactly-once-processing | Exactly-once and why it's hard                                  | 2    | any      | A sender can't tell a lost message from a lost acknowledgement, so it must either resend (risking a duplicate) or not (risking loss). True exactly-once delivery across a network is impossible.                                                                                                  | Systems that advertise exactly-once deliver "effectively once": at-least-once delivery plus deduplication or idempotent processing, and only inside a boundary they control.                                                                             | Broker-side deduplication (helps, but only within a window and only inside the broker) |
| stream-exactly-once     | Exactly-once in stream processing (transactions)                | 3    | any      | In Kafka-style systems, idempotent producers (sequence numbers let the broker discard retried writes) combine with transactions that commit output records and input offsets atomically, and consumers read only committed data (`read_committed`).                                               | Read, process and write become one atomic unit, so after a crash either the outputs and the progress are both committed or neither is. This only holds while input and output are in the same log; side effects in other systems still need idempotency. | Exactly-once delivery to an external database or API                                   |
| guaranteed-delivery     | Durable delivery and publisher confirms                         | 2    | any      | Making sure a sent message isn't lost: persistent messages on durable, replicated queues, and the broker confirming to the producer only once the message is safely stored (publisher confirms, `acks=all` with a minimum number of in-sync replicas).                                            | A send is done only when the broker confirms it's durable, and fire-and-forget sends can vanish in a broker crash. The producer has to retry unconfirmed sends, and those retries are where duplicates come from.                                        | Consumer acks (the other end of the pipe)                                              |
| idempotent-consumer     | Idempotent consumer                                             | 1    | any      | A consumer built so that processing the same message twice has the same effect as processing it once, usually by recording processed message IDs in the same transaction as its state change, or by using operations that are naturally idempotent ("set balance to X" rather than "subtract X"). | With at-least-once delivery, duplicates are certain, so correctness has to live in the consumer. Make the handler safe to repeat rather than hoping the broker never repeats.                                                                            | Broker-side deduplication; retry logic                                                 |
| idempotency-key         | Idempotency keys                                                | 2    | any      | A unique key the client attaches to a request or message (an `Idempotency-Key` header, a `webhook-id`, a message ID) so the receiver can recognise a retry and return the original result instead of acting again.                                                                                | The client picks the key once and reuses it on every retry, and the server stores each key with its result. A "charge card" request retried after a timeout charges the card once.                                                                       | Correlation ID (links related messages but doesn't prevent repeats)                    |
| dual-write-problem      | Dual-write problem                                              | 2    | any      | A service updates its database and publishes a message as two separate operations, and a crash or failure between them leaves one done and the other not.                                                                                                                                         | You can't commit to a database and a broker atomically without distributed transactions, so you either lose the event or announce something that never happened. The outbox and CDC fix this by making the database write the only write.                | Distributed transactions and two-phase commit (Data)                                   |

### Events and event-driven architecture

| id                           | Concept                                   | Tier | Platform | What it is                                                                                                                                                                                                                                                                              | The idea to get across                                                                                                                                                                           | Often confused with                                                                 |
| ---------------------------- | ----------------------------------------- | ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| event-driven-architecture    | Event-driven architecture                 | 1    | any      | Services communicate by publishing events about what happened and reacting to each other's events through a broker, instead of calling each other directly.                                                                                                                             | Producers don't know their consumers, so new behaviour is added by adding a subscriber. The costs are eventual consistency, harder tracing, and flows that aren't written down in any one place. | Microservices (often event-driven, but can be entirely synchronous); event sourcing |
| event-notification           | Event notification (thin events)          | 2    | any      | An event that says only that something changed and which item ("Order 42 shipped"). Consumers call back to the source if they need the details.                                                                                                                                         | Events stay small and coupling stays low, but consumers depend on the source being available to fetch data, and the overall flow is implicit.                                                    | Event-carried state transfer                                                        |
| event-carried-state-transfer | Event-carried state transfer (fat events) | 2    | any      | Events carry the full relevant state ("Customer 7's address is now …"), so consumers keep their own local copy and never need to call back.                                                                                                                                             | Consumers no longer depend on the source's availability or latency. The price is duplicated data, larger events, and copies that are only eventually consistent.                                 | Event sourcing (events as the source of truth; this only replicates state)          |
| domain-vs-integration-events | Domain events vs integration events       | 3    | any      | Domain events describe something meaningful inside one service's model and are handled inside that service. Integration events are the published, versioned contract that other services consume.                                                                                       | Not every internal event should leak out. Translating internal domain events into stable public integration events lets a service change its internals without breaking subscribers.             | Events stored for event sourcing                                                    |
| event-schema-evolution       | Event schema evolution and versioning     | 2    | any      | Changing an event's structure while old and new producers and consumers coexist: backward, forward and full compatibility, additive changes, version fields, upcasting, and new event types for breaking changes.                                                                       | Producers and consumers deploy independently, and old events live on in logs, so every change must stay readable by consumers you can't upgrade at the same moment.                              | API versioning (synchronous APIs, where only live callers matter)                   |
| schema-registry              | Schema registry and event contracts       | 3    | any      | A service that stores versioned event schemas (Avro, Protobuf, JSON Schema), checks each new version against a compatibility rule, and lets messages carry a small schema ID instead of the whole schema. AsyncAPI documents channels and messages the way OpenAPI documents HTTP APIs. | The contract is enforced at publish time, so an incompatible schema change is rejected before it can break any consumer.                                                                         | Database schema migrations                                                          |

### Flow control and load

| id                        | Concept                           | Tier | Platform | What it is                                                                                                                                                             | The idea to get across                                                                                                                                                                                                                                      | Often confused with                                       |
| ------------------------- | --------------------------------- | ---- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| queue-based-load-leveling | Queue-based load leveling         | 1    | any      | A queue between a bursty producer and a slower service, so the service drains work at its own steady rate.                                                             | The queue absorbs a spike and turns it into backlog, so the service can be sized for average load rather than peak and doesn't fall over. The trade-off is that work waits.                                                                                 | Autoscaling (adds capacity; often combined with leveling) |
| backpressure              | Backpressure                      | 2    | any      | A downstream component signalling upstream to slow down when it can't keep up: bounded buffers, blocking, credit-based flow control, pull-based consumption, HTTP 429. | Without backpressure, overload just moves somewhere else: memory fills, queues grow forever. With it, the slowest stage sets the pace and the system stays stable.                                                                                          | Load shedding (dropping work); throttling                 |
| consumer-prefetch         | Prefetch and consumer concurrency | 3    | any      | How many unacknowledged messages a consumer holds at once (prefetch/QoS, max messages per receive) and how many it processes in parallel (max concurrent calls).       | Prefetch trades throughput against fairness and safety. Too low and workers sit idle between round trips; too high and one worker hoards messages others could take, or holds them past their lock. Capping concurrency also protects a fragile downstream. | API rate limiting                                         |

### Distributed transactions and workflows

| id                            | Concept                                | Tier | Platform | What it is                                                                                                                                                                                                                                                            | The idea to get across                                                                                                                                                                                 | Often confused with                                                                  |
| ----------------------------- | -------------------------------------- | ---- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| transactional-outbox          | Transactional outbox                   | 2    | any      | The service writes its business change and the outgoing message to an outbox table in the same database transaction. A relay (a polling publisher, or log tailing via CDC) then publishes the outbox rows to the broker.                                              | One local transaction makes the state change and the intent to publish atomic, so no event is lost or invented. Delivery becomes at-least-once, so consumers must be idempotent.                       | Event sourcing; CDC on its own (capturing table changes rather than designed events) |
| transactional-inbox           | Transactional inbox                    | 3    | any      | The consumer stores each incoming message, keyed by its ID, in an inbox table in the same transaction that acknowledges or processes it, and works from the inbox.                                                                                                    | It's the outbox's mirror on the receiving side. Deduplication and a durable hand-off happen in one local transaction, so redeliveries are ignored and nothing is acknowledged and then lost.           | Idempotent consumer (the inbox is one way to build one)                              |
| saga                          | Saga                                   | 2    | any      | A business transaction across several services, run as a sequence of local transactions, each triggering the next by message. If a step fails, compensating transactions undo the earlier steps.                                                                      | You can't lock rows across services, so a saga can't roll back; it does, and undoes if needed. Consistency is eventual, and other users can see the intermediate states.                               | Distributed transactions and two-phase commit                                        |
| choreography-vs-orchestration | Choreography vs orchestration          | 2    | any      | Choreography: each service reacts to events and emits its own, with no coordinator (the broker topology). Orchestration: a central orchestrator (process manager, workflow) sends commands to each service and tracks state (the mediator topology).                  | Choreography is loosely coupled, but the flow is invisible and cyclic dependencies creep in. Orchestration makes the flow explicit and easy to change and monitor, at the cost of a central component. | Kubernetes or container orchestration                                                |
| compensating-transaction      | Compensating transaction               | 2    | any      | An action that semantically undoes a completed step (refund the charge, release the reservation, send a cancellation) instead of rolling it back.                                                                                                                     | Completed steps can't be erased, only countered. Compensations can fail too, so they must be retryable and idempotent, and some steps (an email already sent) can't be compensated at all.             | Database rollback                                                                    |
| durable-execution             | Workflow engines and durable execution | 2    | any      | Engines (Temporal, AWS Step Functions, Azure Durable Functions, Logic Apps, Google Cloud Workflows) that run multi-step processes and persist each step's result in an event history, so a workflow resumes exactly where it was after a crash and can wait for days. | The code reads as sequential, but every step is recorded and replayed. Retries, timeouts, timers and compensation come from the engine instead of from queues and state tables you build yourself.     | Cron jobs and schedulers; CI/CD pipelines                                            |
| routing-slip                  | Routing slip                           | 3    | any      | The message carries its own itinerary. Each step does its work and forwards the message to the next address on the slip, optionally recording how to undo its work.                                                                                                   | Steps run in sequence without a central orchestrator, and no service needs to know what comes after it. The route is decided once, at the start.                                                       | Choreography (where the route is implicit in who subscribes to what)                 |

### Conversations: request-reply, correlation and callbacks

| id                      | Concept                                              | Tier | Platform | What it is                                                                                                                                                                                                           | The idea to get across                                                                                                                                                                                     | Often confused with                                  |
| ----------------------- | ---------------------------------------------------- | ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| request-reply-messaging | Request-reply over messaging                         | 2    | any      | The requester sends a message carrying a reply-to address (return address) and a correlation ID. The responder sends its answer to that reply queue, and the requester matches it up.                                | You can get a response over messaging and keep the buffering and decoupling, but the requester has to handle waiting, timeouts, and replies that arrive after it gave up.                                  | Synchronous RPC over HTTP                            |
| correlation-id          | Correlation ID                                       | 2    | any      | An identifier copied from a request or triggering message onto every reply, event and log entry that results from it, often alongside a causation ID that points to the immediate parent.                            | It ties a conversation back together across queues and services, both for matching replies to requests and for following one business transaction through an asynchronous flow.                            | Message ID (identifies one message); idempotency key |
| async-request-reply     | Asynchronous request-reply over HTTP (202 + polling) | 2    | any      | For long-running work behind an HTTP API, the server answers `202 Accepted` with a status URL. The client polls it, honouring `Retry-After`, until it reports done and points to the result, or receives a callback. | The HTTP request returns at once while the work runs in the background, avoiding timeouts and held connections. The client swaps a blocking call for a status check.                                       | Request-reply over messaging; webhooks               |
| webhooks                | Webhooks                                             | 1    | any      | An HTTP callback: when an event happens, the provider POSTs it to a URL the subscriber registered (GitHub, Stripe, Twilio).                                                                                          | Webhooks are push delivery over plain HTTP. The receiver must verify the signature, reject old timestamps, respond quickly and process asynchronously, and expect retries, so it deduplicates by event ID. | Polling an API; WebSockets                           |

### Integration patterns: routing and transformation

| id                     | Concept                            | Tier | Platform | What it is                                                                                                                                                                                                                                   | The idea to get across                                                                                                                                                                                                 | Often confused with                                                          |
| ---------------------- | ---------------------------------- | ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| content-based-router   | Content-based router               | 2    | any      | A component that inspects each message and sends it to one of several channels based on its content or headers (region, type, priority). A recipient list sends it to several chosen channels; a dynamic router learns its rules at runtime. | Senders publish to one place and the routing logic lives in one spot, so adding a destination changes the router, not the senders.                                                                                     | Subscription filtering (each subscriber decides; one message can go to many) |
| splitter               | Splitter                           | 3    | any      | Breaks one composite message (an order with 20 lines, a batch file) into individual messages that can be processed separately.                                                                                                               | Splitting turns one big unit of work into many small parallel ones, but each piece needs a correlation ID and sequence information so it can be put back together.                                                     | Claim check (keeps the payload whole but moves it aside)                     |
| aggregator             | Aggregator                         | 3    | any      | A stateful component that collects related messages by correlation ID until a completion condition (a count, a timeout, an end marker) and then emits one combined message.                                                                  | Waiting for all the parts needs stored state and a rule for when to stop waiting, because some parts may never arrive.                                                                                                 | Windowed aggregation in streams (bounded by time and continuous)             |
| scatter-gather         | Scatter-gather                     | 2    | any      | Sends a request to several recipients in parallel (quotes from suppliers, queries to search shards), then aggregates the replies into one result, usually with a timeout.                                                                    | Total latency becomes that of the slowest reply you wait for. A timeout and a rule for partial results stop one slow party from holding up the whole answer.                                                           | Fan-out (fire-and-forget, with nothing gathered)                             |
| claim-check            | Claim check                        | 2    | any      | Stores a large payload in blob or object storage and sends only a reference (the claim check) through the broker. The consumer uses it to fetch the payload.                                                                                 | Brokers are built for small messages (limits typically 256 KB to 1 MB, and cost grows with size). Moving the bulk to cheap storage keeps the message tiny, at the cost of a second fetch and cleaning up old payloads. | Compressing the message; chunking it into a message sequence                 |
| message-transformation | Message translation and enrichment | 3    | any      | Changing messages in transit. A translator converts formats between systems, an enricher adds missing data from a lookup, a content filter removes fields, and a normalizer maps many formats into one canonical data model.                 | Transforming at the edges keeps each system's format independent, so when one system changes its format, only one translator changes, not every consumer.                                                              | Schema evolution (changing one format over time)                             |

## Coverage check

### Enterprise Integration Patterns (65 patterns)

- **Integration styles.** Remote Procedure Invocation and Messaging → `sync-vs-async-communication`,
  `message-broker`. File Transfer and Shared Database are excluded: they're integration styles that don't use
  messaging and belong to Architecture or Data (shared database is the microservices anti-pattern).
- **Messaging systems.** Message Channel → `message-queue`, `publish-subscribe`. Message → `message-anatomy`.
  Message Router → `content-based-router`. Message Translator → `message-transformation`. Pipes and Filters is an
  overlap owned by Architecture. Message Endpoint is excluded: it's a code-level abstraction, not a cloud idea.
- **Messaging channels.**
  - Point-to-Point Channel → `message-queue`.
  - Publish-Subscribe Channel → `publish-subscribe`.
  - Dead Letter Channel → `dead-letter-queue`. Invalid Message Channel is folded into `dead-letter-queue`, since
    today's brokers dead-letter unparseable messages with a reason.
  - Guaranteed Delivery → `guaranteed-delivery`.
  - Channel Adapter → `stream-connectors`.
  - Messaging Bridge → `event-mesh`.
  - Message Bus is folded into `message-broker`; the ESB as an architecture is an overlap with Architecture.
  - Datatype Channel is folded into `cloudevents` and `schema-registry`: modern channels carry a type attribute
    rather than needing one channel per type.
- **Message construction.**
  - Command Message, Document Message and Event Message → `events-vs-commands`. A document message is close to
    `event-carried-state-transfer`.
  - Request-Reply and Return Address → `request-reply-messaging`.
  - Correlation Identifier → `correlation-id`.
  - Message Sequence is folded into `splitter` and `message-ordering`.
  - Message Expiration → `message-ttl`.
  - Format Indicator is folded into `cloudevents` (`datacontenttype`, `dataschema`) and `schema-registry`.
- **Message routing.**
  - Content-Based Router → `content-based-router`. Dynamic Router and Recipient List are folded into
    `content-based-router`.
  - Message Filter → `message-filtering`.
  - Splitter → `splitter`. Aggregator → `aggregator`. Scatter-Gather → `scatter-gather`.
  - Composed Message Processor (split, route, aggregate) is folded, as a combination of `splitter`,
    `content-based-router` and `aggregator`.
  - Resequencer is folded into `message-ordering`.
  - Routing Slip → `routing-slip`.
  - Process Manager → `choreography-vs-orchestration` (the orchestrator) and `durable-execution`.
  - Message Broker (EIP's hub-and-spoke meaning) → `message-broker`.
- **Message transformation.** Envelope Wrapper → `message-anatomy`, `cloudevents`. Content Enricher, Content Filter,
  Normalizer and Canonical Data Model → `message-transformation`. Claim Check → `claim-check`.
- **Messaging endpoints.**
  - Polling Consumer and Event-Driven Consumer → `push-vs-pull-delivery`.
  - Competing Consumers → `competing-consumers`. Message Dispatcher is folded into `competing-consumers`.
  - Selective Consumer → `message-filtering`.
  - Durable Subscriber → `topic-subscriptions`.
  - Idempotent Receiver → `idempotent-consumer`.
  - Transactional Client → `transactional-outbox`, `transactional-inbox`, `stream-exactly-once`.
  - Messaging Gateway, Messaging Mapper and Service Activator are excluded: they're code-structure patterns that
    hide messaging APIs from application code, with nothing to show at the level of a cloud diagram.
- **System management.** Wire Tap, Message History and Message Store are overlaps owned by Observability (tracing,
  auditing); `correlation-id` covers the linking idea here. Control Bus, Detour, Smart Proxy, Test Message and
  Channel Purger are excluded: they're niche operational patterns that rarely come up in cloud practice.

### Apache Kafka documentation (Introduction, Design, Streams, Connect)

- **Introduction.** Topics, partitions, offsets, consumer groups → `event-streaming`, `stream-partitions`,
  `consumer-offsets`, `consumer-groups`.
- **Design.**
  - Motivation, persistence, "constant time suffices", efficiency, end-to-end batch compression: excluded as broker
    internals (page cache, zero-copy). Batching as a throughput/latency trade-off belongs to Scaling.
  - Producer load balancing (semantic partitioning by key) → `partition-keys`. Asynchronous send is folded into
    `guaranteed-delivery`.
  - Push vs pull → `push-vs-pull-delivery`.
  - Consumer position → `consumer-offsets`. Offline data load → `retention-and-replay`.
  - Static membership → `consumer-rebalancing`.
  - Message delivery semantics → `delivery-guarantees`, `exactly-once-processing`. Using transactions, idempotent
    producer and transactional error handling → `stream-exactly-once`, `message-deduplication`.
  - The share consumer (share groups, KIP-932, production-ready in 4.2) → `queue-vs-log`, with acquisition locks
    covered by `visibility-timeout`.
  - Replication, ISR, unclean leader election, availability and durability guarantees: replication is owned by
    Data; the producer-facing part (`acks`, `min.insync.replicas`) is in `guaranteed-delivery`.
  - Log compaction (basics, guarantees, details, cleaner) → `log-compaction`.
  - Quotas: owned by Scaling (rate limiting and throttling); broker throttling as a form of backpressure is noted in
    `backpressure`.
- **Kafka Streams core concepts.**
  - Stream, processor and topology → `stream-processing`.
  - Event, processing and ingestion time → `event-time-vs-processing-time`.
  - Stream-table duality → `stream-table-duality`.
  - Aggregations and windowing with grace periods → `stream-windowing`, `watermarks`.
  - State stores → `stateful-stream-processing`.
  - Exactly-once processing → `stream-exactly-once`.
  - Out-of-order handling → `watermarks`.
- **Kafka Connect.** → `stream-connectors`. Single message transforms are folded into `message-transformation`.

### RabbitMQ tutorials and concepts

- **Tutorials.**
  - Hello World → `message-queue`.
  - Work Queues (round-robin dispatch, acks, prefetch, durability) → `competing-consumers`,
    `message-acknowledgement`, `consumer-prefetch`, `guaranteed-delivery`.
  - Publish/Subscribe → `publish-subscribe`, `fan-out`.
  - Routing and Topics → `exchange-bindings`, `message-filtering`.
  - RPC → `request-reply-messaging`, `correlation-id`.
  - Publisher Confirms → `guaranteed-delivery`.
  - Streams "Hello World" and Offset Tracking → `event-streaming`, `queue-vs-log`, `consumer-offsets`.
- **AMQP concepts.**
  - Exchanges (direct, fanout, topic, headers), bindings, routing keys → `exchange-bindings`.
  - Push vs pull consumers → `push-vs-pull-delivery`.
  - Acks and nacks → `message-acknowledgement`.
  - Prefetch → `consumer-prefetch`.
  - Durability → `guaranteed-delivery`.
  - Virtual hosts, connections and channels: excluded as client/broker plumbing.
- **Reliability guide.** The redelivered flag and idempotence → `message-redelivery`, `idempotent-consumer`.
  Quorum queue delivery limit → `poison-message`, `dead-letter-queue`.

### microservices.io

- **Communication style.** Remote Procedure Invocation and Messaging → `sync-vs-async-communication`. Domain-specific
  protocol → `messaging-protocols`. Idempotent Consumer → `idempotent-consumer`.
- **Transactional messaging.** Transactional outbox → `transactional-outbox`. Transaction log tailing and Polling
  publisher are folded into `transactional-outbox` as its two relay options; CDC itself is owned by Data.
- **Data management.**
  - Saga → `saga`, `choreography-vs-orchestration`, `compensating-transaction`.
  - Domain event → `domain-vs-integration-events`.
  - Event sourcing and CQRS: overlaps (see below).
  - Command-side replica is an application of `event-carried-state-transfer`.
  - API Composition, Database per Service and Shared Database: owned by Architecture and Data.
- **Reliable communication.** Circuit Breaker: owned by Reliability.

### Azure Architecture Center

- **Design patterns.**
  - Asynchronous Request-Reply → `async-request-reply`.
  - Choreography → `choreography-vs-orchestration`.
  - Claim Check → `claim-check`.
  - Compensating Transaction → `compensating-transaction`.
  - Competing Consumers → `competing-consumers`.
  - Idempotent Consumer → `idempotent-consumer`.
  - Messaging Bridge → `event-mesh`.
  - Priority Queue → `priority-queue`.
  - Publisher-Subscriber → `publish-subscribe`.
  - Queue-Based Load Leveling → `queue-based-load-leveling`.
  - Saga → `saga`.
  - Sequential Convoy → `message-groups`.
  - Scheduler Agent Supervisor is folded into `durable-execution`, with an overlap to Reliability.
  - CQRS and Event Sourcing: overlaps. Pipes and Filters: Architecture. Retry: Reliability. Throttling and Rate
    Limiting: Scaling. Materialized View: Data.
- **Event-driven architecture style.**
  - Pub/sub vs event streaming → `queue-vs-log`, `publish-subscribe`, `event-streaming`.
  - Simple event processing, basic event correlation, complex event processing and event stream processing →
    `event-driven-architecture`, `aggregator`, `stream-processing`.
  - Full vs key-only payloads → `event-carried-state-transfer`, `event-notification`.
  - Broker vs mediator topology → `choreography-vs-orchestration`.
  - The challenges it lists:
    - guaranteed delivery → `guaranteed-delivery`
    - ordering and exactly-once → `message-ordering`, `exactly-once-processing`
    - error handling and DLQs → `message-redelivery`, `dead-letter-queue`
    - data loss and client acknowledge mode → `message-acknowledgement`
    - observability through correlation IDs → `correlation-id`
    - request-response → `request-reply-messaging`
    - schema evolution → `event-schema-evolution`
- **Compare messaging services.** Events vs messages, and discrete vs series → `events-vs-commands`,
  `event-notification`, `event-streaming`. Choosing between Event Grid, Event Hubs and Service Bus belongs to
  Azure.

### AWS messaging guidance

- **SQS developer guide.**
  - Visibility timeout → `visibility-timeout`.
  - Retention period → `message-ttl`.
  - Delay queues and message timers → `scheduled-messages`.
  - Short vs long polling → `push-vs-pull-delivery`.
  - DLQ, redrive and `maxReceiveCount` → `dead-letter-queue`, `poison-message`.
  - FIFO vs standard → `message-ordering`.
  - Message group ID → `message-groups`.
  - Deduplication ID and window → `message-deduplication`.
  - In-flight messages → `visibility-timeout`.
  - At-least-once delivery → `delivery-guarantees`.
  - Large messages through S3 → `claim-check`.
- **SNS.** Fan-out to SQS → `fan-out`. Filter policies → `message-filtering`.
- **EventBridge.**
  - Event bus → `message-broker`, `content-based-router`.
  - Rules and event patterns → `message-filtering`.
  - Input transformer → `message-transformation`.
  - Archive and replay → `retention-and-replay`.
  - Schema registry and discovery → `schema-registry`.
  - Pipes → `stream-connectors`.
  - Scheduler → `scheduled-messages`.
  - API destinations → `webhooks`.
- **Kinesis.** Shards and partition keys → `stream-partitions`, `partition-keys`.
- **Prescriptive Guidance patterns.**
  - Publish-subscribe → `publish-subscribe`.
  - Saga choreography and orchestration → `saga`, `choreography-vs-orchestration`.
  - Scatter-gather → `scatter-gather`.
  - Transactional outbox → `transactional-outbox`.
  - Event sourcing: overlap. Retry with backoff: Reliability.
- **DVA-C02 exam guide.**
  - Event-driven, choreography, orchestration and fanout patterns → `event-driven-architecture`,
    `choreography-vs-orchestration`, `fan-out`.
  - Idempotency → `idempotent-consumer`, `idempotency-key`.
  - Sync vs async patterns and loose coupling → `sync-vs-async-communication`.
  - Retries and DLQs → `message-redelivery`, `dead-letter-queue`.
  - Subscription filter policies → `message-filtering`.
  - Data streaming → the event streaming group.
  - Event source mapping and Lambda destinations: AWS.

### Google Cloud Pub/Sub

- Pull, push and export subscriptions → `push-vs-pull-delivery`, `stream-connectors`.
- Ack deadline → `visibility-timeout`. Ack and nack → `message-acknowledgement`.
- Retention, seek and replay → `retention-and-replay`.
- Ordering keys → `message-groups`. Filtering → `message-filtering`.
- Exactly-once delivery → `exactly-once-processing`; how Pub/Sub implements it belongs to GCP.
- Dead-letter topics → `dead-letter-queue`. Retry policy with exponential backoff → `message-redelivery`.

### CloudEvents

Occurrence, event, producer, source, consumer, intermediary, context attributes, extensions, protocol bindings,
event formats, structured, binary and batch modes → `cloudevents`. The 64 KiB guidance is folded into
`claim-check`.

### Fowler, "What do you mean by Event-Driven?"

Event Notification → `event-notification`. Event-Carried State Transfer → `event-carried-state-transfer`. The
"passive-aggressive command" → `events-vs-commands`. Event Sourcing and CQRS: overlaps.

### Flink time concepts, Confluent schema evolution, Standard Webhooks, Temporal

- **Flink.** Event vs processing time, watermarks, lateness, window types → `event-time-vs-processing-time`,
  `watermarks`, `stream-windowing`.
- **Confluent.** BACKWARD, FORWARD, FULL and the TRANSITIVE variants → `event-schema-evolution`; the registry and
  schema IDs → `schema-registry`.
- **Standard Webhooks.** Signatures, `webhook-id`, timestamps, retries with backoff, thin vs full payloads →
  `webhooks`, `idempotency-key`, `event-notification`. HMAC as a primitive is owned by Security.
- **Temporal.** Workflows, deterministic replay, event history, activities, timers, signals → `durable-execution`.

### _Designing Data-Intensive Applications_, ch. 11

- **Transmitting event streams.** Messaging systems, and message brokers vs databases → `message-broker`,
  `queue-vs-log`. Partitioned logs → the event streaming group.
- **Databases and streams.**
  - Keeping systems in sync → `dual-write-problem`.
  - Change data capture: owned by Data.
  - Event sourcing: overlap.
  - State, streams and immutability → `stream-table-duality`.
- **Processing streams.**
  - Uses: complex event processing, stream analytics, maintaining materialized views → `stream-processing`.
  - Reasoning about time → `event-time-vs-processing-time`, `watermarks`.
  - Window types → `stream-windowing`.
  - Stream-stream and stream-table joins → `stream-joins`; table-table joins are folded into `stream-joins`.
  - Fault tolerance:
    - microbatching and checkpointing → `stateful-stream-processing`
    - atomic commit → `stream-exactly-once`
    - idempotence → `idempotent-consumer`

### CCDAK outline

- Fundamentals: the event streaming group, plus `guaranteed-delivery`.
- Application development:
  - offsets → `consumer-offsets`
  - serialization → `schema-registry`
  - ordering → `partition-keys`
  - reliability → `delivery-guarantees`
- Streams: the stream processing group.
- Connect: `stream-connectors`.
- Observability: `consumer-lag`.
- Testing: excluded; testing asynchronous systems belongs to Delivery.

### AZ-204 (retired July 31, 2026)

Event Grid, Event Hubs, Service Bus and Queue Storage are services, so they go to Azure. Every general concept
behind them is in this catalog.

### Deliberately left out or folded (not covered above)

- **Head-of-line blocking:** folded into `message-ordering` and `message-groups`, where it's the aha.
- **Long polling:** folded into `push-vs-pull-delivery`. The HTTP mechanics are Networking's.
- **Complex event processing:** folded into `stream-processing`. It's a kind of stream processing, not a separate
  mechanism.
- **The Two Generals problem:** folded into `exactly-once-processing` as the reason it's hard. Distributed-systems
  theory belongs to Data and Reliability.
- **Mobile push notifications (FCM, APNs, SNS mobile push):** excluded. They're product delivery channels, not a
  messaging concept.
- **Event storming and event modelling:** excluded. That's domain-design practice, which belongs to Architecture if
  anywhere.
- **Lambda and Kappa architectures:** owned by Data (analytics pipelines).
- **Message batching and compression:** owned by Scaling (the throughput vs latency trade-off).

## Overlaps

**Owned here, also at home elsewhere:**

| id                                                                                                                    | Also relevant to       | Why                                                                                         |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| `queue-based-load-leveling`                                                                                           | Scaling                | Buffering as an alternative or complement to scaling out                                    |
| `backpressure`, `consumer-prefetch`                                                                                   | Scaling, Reliability   | Overload protection                                                                         |
| `consumer-lag`                                                                                                        | Observability, Scaling | The key async health metric, and the trigger for queue-based autoscaling                    |
| `correlation-id`                                                                                                      | Observability          | The basis of distributed tracing across async hops                                          |
| `idempotent-consumer`, `idempotency-key`                                                                              | Reliability            | Retries are safe only if the operation is idempotent                                        |
| `dead-letter-queue`, `message-redelivery`, `poison-message`                                                           | Reliability            | Failure isolation                                                                           |
| `event-driven-architecture`, `saga`, `choreography-vs-orchestration`, `compensating-transaction`, `durable-execution` | Architecture           | Microservice and serverless design                                                          |
| `stream-processing`, `stream-windowing`, `stream-table-duality`, `log-compaction`                                     | Data                   | Real-time analytics, materialized views                                                     |
| `stream-partitions`, `partition-keys`                                                                                 | Data                   | Partitioning and hot partitions                                                             |
| `dual-write-problem`, `transactional-outbox`                                                                          | Data                   | Consistency, and CDC as the outbox relay                                                    |
| `webhooks`                                                                                                            | Security, Architecture | Security for HMAC signature verification and replay protection; Architecture for API design |
| `claim-check`                                                                                                         | Data                   | Object storage                                                                              |
| `message-anatomy`, `cloudevents`, `schema-registry`, `event-schema-evolution`                                         | Architecture           | API and contract design                                                                     |

**Owned elsewhere, referenced here:**

| Concept                                                                                                           | Owner                                      | Link to this area                                                                         |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Event sourcing                                                                                                    | Architecture (or Data); not cataloged here | The event log as the source of truth; builds on `event-streaming`, `stream-table-duality` |
| CQRS                                                                                                              | Architecture; not cataloged here           | Read models are often fed by events                                                       |
| Change data capture                                                                                               | Data                                       | Outbox relay, `stream-connectors`                                                         |
| Materialized view                                                                                                 | Data / Architecture                        | Built from streams                                                                        |
| Eventual consistency                                                                                              | Data                                       | The consequence of async messaging                                                        |
| Two-phase commit and distributed transactions                                                                     | Data                                       | What sagas and the outbox replace                                                         |
| Replication, ISR, quorum                                                                                          | Data                                       | Broker durability                                                                         |
| Retry with exponential backoff and jitter                                                                         | Reliability                                | `message-redelivery` is the messaging-specific side                                       |
| Circuit breaker                                                                                                   | Reliability                                | Pausing consumption when a dependency is down                                             |
| Scheduler Agent Supervisor                                                                                        | Reliability / Architecture                 | Folded into `durable-execution` here                                                      |
| Rate limiting, throttling, load shedding                                                                          | Scaling                                    | —                                                                                         |
| Autoscaling on queue length                                                                                       | Scaling (KEDA itself under Containers)     | —                                                                                         |
| Batch processing, Lambda and Kappa architectures                                                                  | Data                                       | —                                                                                         |
| Pipes and filters, microservices, database per service, serverless triggers, ESB vs "smart endpoints, dumb pipes" | Architecture                               | —                                                                                         |
| Distributed tracing                                                                                               | Observability                              | —                                                                                         |
| HMAC and message signing                                                                                          | Security                                   | —                                                                                         |
| WebSockets, server-sent events, HTTP long polling                                                                 | Networking                                 | —                                                                                         |

**Platform-specific services and features (belong to platform files):**

- **Azure (`azure.md`):**
  - Service Bus: queues, topics and subscriptions, sessions, peek-lock vs receive-and-delete, duplicate detection,
    transactions, auto-forwarding, scheduled messages, premium large messages.
  - Storage Queues vs Service Bus.
  - Event Grid: push delivery, CloudEvents schema, namespace topics with pull, MQTT broker.
  - Event Hubs: partitions, consumer groups, checkpointing, Capture, the Kafka endpoint.
  - Choosing Event Grid vs Event Hubs vs Service Bus.
  - Durable Functions, Logic Apps, Stream Analytics, Azure Functions messaging triggers.
- **AWS (`aws.md`):**
  - SQS standard vs FIFO (and high-throughput FIFO), redrive specifics, the Extended Client Library.
  - SNS: filter policies, FIFO topics, SNS+SQS fan-out.
  - EventBridge: buses, rules, Pipes, Scheduler, archive and replay, schema discovery, API destinations.
  - Kinesis Data Streams (shards, enhanced fan-out) vs Data Firehose; MSK; Amazon MQ.
  - Lambda event source mappings and destinations; Step Functions standard vs express.
- **Google Cloud (`gcp.md`):**
  - Pub/Sub: push, pull and export subscriptions, ordering keys, exactly-once delivery, seek and snapshots,
    filtering.
  - Pub/Sub vs Cloud Tasks; Eventarc; Workflows.
  - Dataflow / Apache Beam (windows, watermarks, triggers); Managed Service for Apache Kafka.
- **Kubernetes (`containers.md`):** KEDA queue and stream scalers, Knative Eventing (brokers and triggers), Kafka
  operators (Strimzi), Dapr pub/sub.
