# AWS plans, part 3

Stage 2 plans for `catalog/aws.md` groups 10 to 17, in catalog order. They use AWS's shared visual
language: real service icons and names; AWS's nesting drawn as nested frames (organization ›
accounts; region › VPC › AZs › subnets); a message as a small envelope travelling along an arrow
and a queue as a tube of envelopes; envelope encryption as a small data key locking the data and
itself locked by a big KMS key that never leaves KMS; "X vs Y" comparisons sending the same traffic
or task through each option side by side; "which service do I use" as a short question path whose
answers light the matching service; cost as a coin meter; DR strategies on a shared timeline with
RPO (data lost, before the disaster) and RTO (downtime, after) as visible spans.

## Messaging and integration

### SQS standard vs FIFO queues (`aws-sqs-standard-vs-fifo`)

**The aha**: In FIFO, the message group ID is the unit of ordering and of parallelism: one group is handled in order, one message at a time; different groups run side by side.
**Misconception to defeat**: That FIFO means one global line, or that a standard queue delivers each message exactly once and in order.
**Cast**: Two tubes of coloured envelopes (Standard on top, FIFO below), each feeding a row of consumer boxes. FIFO envelopes carry a small tag "group: A/B/C" and a number.
**Opening frame**: Both tubes holding envelopes numbered 1 to 6 in three colours, consumers idle.
**Story**:

1. Standard: three consumers grab envelopes at once; 4 finishes before 2, and envelope 3 shows up twice (a duplicate ghost). _"Fast, nearly unlimited, but order and duplicates are on you."_
2. A tick "idempotent consumer" turns the duplicate ghost into a harmless no-op. _"Make the consumer safe to repeat."_
3. FIFO: envelopes now carry group tags. One consumer takes A1; A2 and A3 behind it go grey and locked, and stay locked even if A1 fails, until A1 is deleted or its visibility timeout ends. _"One group, one at a time."_
4. Consumers 2 and 3 pick up B1 and C1 at the same moment. _"Other groups don't wait."_
5. A1 is deleted; A2 unlocks. A duplicate A1 sent within 5 minutes is stopped at the door by its dedup ID. _"Same ID inside 5 minutes: dropped."_
6. Everything in one group (all "group: 1"): one consumer works while two sit idle. _"One group means no parallelism."_ A small meter shows the price of order: Standard "nearly unlimited", FIFO 300 messages/s per API action (3,000 with batching), higher in high-throughput mode.
   **The moment**: Beat 6, the idle consumers: ordering was purchased with parallelism, and the group ID is the dial.
   **Interaction**: Reassign envelopes to groups (one group, per-customer groups) and watch throughput and order change.
   **Ending**: FIFO tube with many groups, all consumers busy, each lane in order.
   **Variants**: `aws-sqs-visibility-timeout-and-dlq`; `aws-sns-sqs-fan-out` (SNS FIFO topics); Kinesis shards in `aws-kinesis-vs-firehose-vs-msk`.
   **Techniques**: contents, token, lanes, side by side, restyle, spotlight, caption.
   **Review**: Improved — added the FIFO throughput limits to beat 6 (the cost of ordering was only implied), and made beat 3 show that a failing message blocks its whole group while other groups carry on. Weighed a "one lane vs many lanes" road metaphor; the envelope tubes already show it and carry the duplicate/dedup facts the road cannot. Checked: at-least-once and best-effort order on Standard, 5-minute dedup window, group ID as ordering and parallelism unit.

### SQS visibility timeout, long polling and dead-letter queues (`aws-sqs-visibility-timeout-and-dlq`)

**The aha**: Receiving a message only hides it for a while; if you don't delete it before the timer ends, it comes back, and a message that keeps failing is moved aside to a dead-letter queue.
**Misconception to defeat**: That receiving a message removes it from the queue.
**Cast**: A queue tube; a consumer; a circular visibility timer on the in-flight envelope; a second tube labelled DLQ with a receive-count badge on each envelope; a polling arrow.
**Opening frame**: A tube of five envelopes, a consumer, a 30 s timer unstarted.
**Story**:

1. Consumer receives envelope A; it dims in the tube and a 30 s ring starts. _"Hidden, not gone."_
2. The consumer finishes at 20 s and deletes it; the envelope vanishes for good. _"Delete is the real ack."_
3. Envelope B: processing takes 45 s. The ring hits zero, B brightens and a second consumer takes it; both now work on B. _"Timeout too short: processed twice."_
4. The timeout dial is raised past processing time; the replay runs cleanly. _"Longer than the work (Lambda: 6x function timeout)."_
5. Envelope C crashes the consumer every time. Its badge ticks 1, 2, 3 (maxReceiveCount = 3); when it would be received a fourth time it slides into the DLQ tube instead, keeping its original age, so the DLQ needs longer retention. _"A poison message is set aside, not retried forever."_
6. Redrive arrow carries it back once fixed. _"Fix, then redrive."_
7. Side inset: short polling samples only some servers, so it can return empty while messages exist, and each empty call costs a coin; long polling waits up to 20 s on one call. _"Wait on the line: fewer empty calls."_
   **The moment**: Beat 3, the duplicated envelope appearing exactly as the ring empties.
   **Interaction**: Drag the processing time and the timeout; watch for duplicate work.
   **Ending**: Healthy queue, DLQ holding one flagged envelope with an alarm bell.
   **Variants**: `aws-sqs-standard-vs-fifo`; Lambda event source mapping.
   **Techniques**: contents, timer, token, meter, dial, failure, caption.
   **Review**: Improved — fixed the maxReceiveCount slip (a message moves when it would be received more than 3 times, not on the third receive), added DLQ retention and why short polling returns false empties. Kept the ring-empties-as-duplicate moment: the alternative of leading with the DLQ is a less common cause of confusion than "received means gone". Checked: 6x Lambda timeout guidance, 20 s long polling, redrive.

### SNS topics and SNS-to-SQS fan-out (`aws-sns-sqs-fan-out`)

**The aha**: SNS broadcasts and retries briefly but keeps no backlog; SQS remembers but can't broadcast. Put a queue behind each subscriber and every consumer gets its own durable copy.
**Misconception to defeat**: That SNS holds messages until subscribers are ready.
**Cast**: An SNS topic hub on the left; subscribers on the right: Lambda, an HTTPS endpoint, email, and three SQS queues feeding Billing, Shipping, Analytics.
**Opening frame**: A topic with Billing, Shipping and Analytics subscribed directly as HTTPS endpoints.
**Story**:

1. Order envelope published; three copies fan out. _"One publish, every subscriber."_
2. Shipping's endpoint is down: SNS retries a few times on its delivery policy, then drops the copy (unless a subscription DLQ catches it); Billing and Analytics got theirs. _"SNS retries, then forgets."_ (rewind)
3. A queue tube is inserted in front of each consumer. Publish again; Shipping is down, but its copy waits in its tube. _"A queue per consumer: a durable buffer."_
4. Shipping comes back and drains its tube at its own pace; Analytics, slow, has a longer tube. _"Each at its own speed."_
5. Filter policies appear on the subscriptions: an envelope tagged "type: refund" reaches only Billing. _"Filter at the topic."_
   **The moment**: Beat 3, the same outage replayed with the tube in place, nothing lost.
   **Interaction**: Toggle each consumer up or down and publish; see who loses what with and without queues.
   **Ending**: Fan-out with filters, three tubes at different fill levels.
   **Variants**: `aws-sqs-vs-sns-vs-eventbridge`; `aws-eventbridge`.
   **Techniques**: token, contents, failure, side by side, toggle, restyle, caption.
   **Review**: Improved — "SNS doesn't store" was too strong: SNS retries per a delivery policy and can use a subscription DLQ, it just keeps no durable per-consumer backlog; beat 2 now says so, and the opening frame names the subscriber type. Alternative framing (mailing list vs mailboxes) is no sharper than the tubes. Checked: filter policies, one queue per consumer, SNS FIFO topics as variant.

### SQS vs SNS vs EventBridge (`aws-sqs-vs-sns-vs-eventbridge`)

**The aha**: A queue is one group of workers sharing a backlog; a topic copies a message to everyone now; a bus routes each event by its contents to whoever cares.
**Misconception to defeat**: That they are three flavours of the same thing, so any will do.
**Cast**: Left: a producer sending the same "order placed" envelope into three lanes at once (SQS tube, SNS hub, EventBridge bus). Right: a question path along the top.
**Opening frame**: Three lanes, each with its icon, one envelope waiting at the producer.
**Story**:

1. SQS lane: the envelope enters a tube; three identical workers compete, exactly one takes it. _"One worker gets it. Backlog."_
2. SNS lane: the envelope splits into three copies, all arriving at once. _"Everyone gets a copy. Now."_
3. EventBridge lane: the envelope is opened to show JSON; rules read it ("detail-type = OrderPlaced, total > 100") and send it only to two of five targets. _"Routed by what it says."_
4. Switch off every consumer and send again. The SQS tube still holds the envelope; SNS and EventBridge retry for a while (EventBridge up to 24 h), then give up. _"Only the queue remembers."_
5. The question path appears: "Many workers sharing a backlog?" lights SQS. "Same message to many, immediately?" lights SNS. "Route by content, many sources and SaaS?" lights EventBridge. "Stream you can replay?" points out to Kinesis. "Existing AMQP/JMS/MQTT app?" lights Amazon MQ. _"Pick by the question, not the logo."_
6. A combined diagram: EventBridge → SNS → SQS ×3, each doing its part. _"They stack."_
   **The moment**: Beat 5, each question lighting exactly one icon.
   **Interaction**: Choose a scenario ("thumbnail jobs", "alert the team", "react to an S3 upload") and the path walks itself to the answer.
   **Ending**: The question path at rest, five answers dimmed, last-chosen lit.
   **Variants**: `aws-sns-sqs-fan-out`, `aws-eventbridge`, `aws-kinesis-vs-firehose-vs-msk`.
   **Techniques**: side by side, token, contents, spotlight, choice, path trace, caption.
   **Review**: Improved — added an outage beat so the three differ on durability, not just routing shape (the most common real-world wrong pick: SNS or EventBridge assumed to hold messages), renumbered. Checked: SNS attribute filters vs EventBridge JSON content patterns, pull vs push, Amazon MQ and Kinesis as the exits.

### EventBridge buses, rules, Pipes and Scheduler (`aws-eventbridge`)

**The aha**: Producers publish facts without knowing who listens; rules on the bus decide who receives them. Pipes connect one source to one target; Scheduler replaces cron servers.
**Misconception to defeat**: That the producer must be wired to each consumer.
**Cast**: A central event bus bar; producers on the left (S3, an app, Stripe-like SaaS); rule cards on the bus with patterns; targets on the right (Lambda, Step Functions, SQS). Below: a Pipe (source, filter, enrichment, target) and a Scheduler clock.
**Opening frame**: An empty bus with three producers and three targets, no wires between them.
**Story**:

1. The app emits "OrderPlaced" onto the bus. Nothing receives it. _"Facts, with no addressee."_
2. A rule appears with a pattern; the event matches and a copy goes to Lambda. _"A rule routes it."_
3. A second rule on the same event routes a copy to Step Functions; a third rule doesn't match and stays quiet. Then a fourth target is added live while the producer icon stays untouched. _"Add consumers without touching the producer."_
4. Pipe: SQS → filter → enrich (Lambda) → Step Functions, drawn as one straight tube with four stations. _"Point-to-point glue, no code."_
5. Scheduler: a calendar card "every weekday 08:00, one-off 14 Mar" fires an envelope into a target. _"Cron without a server."_
   **The moment**: Beat 3, a consumer added with the producer untouched.
   **Interaction**: Edit a rule's pattern and see which events still match.
   **Ending**: Bus with three rules, a pipe beneath, and a clock ticking.
   **Variants**: `aws-sqs-vs-sns-vs-eventbridge`; `aws-step-functions`; archive and replay.
   **Techniques**: token, contents, boundary, spotlight, toggle, timer, caption.
   **Review**: Improved — merged the old beats 3 and 4, which made the same point twice, so the producer-untouched moment lands once and the plan gets shorter. Checked: pattern-matched rules (up to 5 targets per rule), Pipes four stages (source, filter, enrichment, target), Scheduler one-off and recurring. Archive and replay stay a variant.

### Kinesis Data Streams vs Data Firehose vs MSK (`aws-kinesis-vs-firehose-vs-msk`)

**The aha**: Streams are a replayable log for your own consumers; Firehose is a pipe that delivers into storage after a buffer; MSK is Kafka when you want its APIs. Partition key picks the shard, and the shard keeps the order.
**Misconception to defeat**: That a stream is a queue where reading removes the record.
**Cast**: A Kinesis stream drawn as three horizontal shard lanes with record positions; two consumers with bookmarks; a Firehose pipe with a buffer bucket ending at S3; a Kafka icon.
**Opening frame**: Records labelled with keys (user-1, user-2, user-3) waiting at a producer.
**Story**:

1. Records hash by partition key into lanes; all of user-1's records land on shard 1, in order. _"Key, shard, order: within one shard only."_
2. Two consumers read the same lane at different positions; reading removes nothing. _"Each consumer has its own bookmark."_
3. A consumer's bookmark slides back to yesterday and replays. _"Rewind. Records stay for 24 h to 365 days."_
4. A hot key piles onto one shard, its bar goes red. _"Hot key, hot shard."_
5. Firehose: records pour into a buffer that flushes when it hits a size or a time (defaults 5 MB or 300 s, tunable down to near-zero), then drops a batch file into S3. _"Delivery, not replay. Wait for the buffer."_
6. MSK: the same lanes relabelled topic/partition, with Kafka tooling icons around. _"Same idea, Kafka's own APIs."_
   **The moment**: Beat 3, the bookmark moving backwards, impossible in a queue.
   **Interaction**: Drag the bookmark of a consumer; change the number of shards and watch a key's lane.
   **Ending**: Three options at rest with a one-line "use when" under each.
   **Variants**: `aws-sqs-vs-sns-vs-eventbridge`; `aws-sqs-standard-vs-fifo`.
   **Techniques**: lanes, token, stream, contents, meter, timer, side by side, dial, caption.
   **Review**: Improved — the "1 MB or 60 s" buffer was not Firehose's default (5 MB / 300 s for S3, configurable), and beat 1 now says order holds per shard only. Kept the backwards bookmark as the moment: the alternative of contrasting with SQS directly is already carried by that single beat. Checked: 1 MB/s and 1,000 records/s in, 2 MB/s out per shard, 24 h to 365 days retention, hot key.

### Step Functions: Standard vs Express workflows (`aws-step-functions`)

**The aha**: The workflow lives in the state machine, not scattered through code, so retries, waits and branches are visible; Standard is for long, auditable runs, Express for huge volumes of short ones.
**Misconception to defeat**: That a chain of Lambdas calling each other is orchestration.
**Cast**: A state-machine graph: Validate → Choice → Charge (Retry badge) → Ship, with Catch to Refund. A history strip below. A Standard/Express panel pair.
**Opening frame**: Three Lambdas chained by hand in code, a tangle of try/catch labels.
**Story**:

1. The same logic redrawn as a state machine: boxes and arrows replace code. _"The flow, drawn."_
2. An execution token runs; each state lights green as it passes. _"Every step recorded."_
3. Charge fails; the Retry badge counts 1, 2, 3 with growing back-off gaps, then succeeds. _"Retries are config."_
4. Another run fails permanently; Catch routes to Refund. _"Failure paths are explicit."_
5. A Wait state holds a token for 3 days (a calendar flips). _"Can wait for days or a human."_
6. Split: Standard (up to 1 year, exactly-once, full history, priced per transition) vs Express (up to 5 min, at-least-once for async, huge rate, priced per request plus duration). Thousands of tiny tokens stream through Express. _"Business process vs event firehose."_
   **The moment**: Beat 3, the retry badge replacing what would have been nested code.
   **Interaction**: Click any past state to see its input and output.
   **Ending**: The graph with a finished green run and the Standard/Express split labelled.
   **Variants**: `aws-eventbridge` (Pipes target); Lambda durable functions as the code-first option; `aws-lambda-concurrency`.
   **Techniques**: token, restyle, contents, timer, side by side, path trace, zoom, caption.
   **Review**: Improved — Express is billed by requests and duration, not "per run". Kept the retry-badge moment; the alternative (lead with Standard vs Express) would bury the orchestration idea the catalog calls the point. Checked: Standard up to a year and exactly-once, Express up to 5 minutes, Retry back-off, Catch, Wait.

### API Gateway: REST vs HTTP vs WebSocket APIs (`aws-api-gateway`)

**The aha**: Every request is walked through the same pipeline (authorise, throttle, transform, integrate, transform back), and stages are separate deployed snapshots.
**Misconception to defeat**: That API Gateway is just a URL in front of Lambda.
**Cast**: A client on the left; a pipeline of stations inside an API Gateway frame; integrations on the right (Lambda, HTTP backend, DynamoDB); a stage selector (dev, prod).
**Opening frame**: Client, API Gateway box, Lambda; one dashed line.
**Story**:

1. A request opens the box into five stations. _"More than a pass-through."_
2. Authorise: Cognito/Lambda authorizer stamps it; a request without a token bounces with a 401. _"Who are you?"_
3. Throttle: a bucket gauge fills; a burst past the limit gets 429s (default 10,000 requests/s, burst 5,000, per account per Region). _"How many?"_
4. Transform + integrate: the request is reshaped and sent to Lambda; the response is reshaped back. _"Reshape both ways."_
5. Stages: dev and prod stacks show different versions and settings from the same API. _"Stage = deployed snapshot."_
6. Three cards compare REST (full features, caching, usage plans), HTTP (cheaper, simpler, lower latency), WebSocket (two-way, connection ID). On the WebSocket card the request arrow becomes two-way: the server can push to a stored connection ID. _"Pick the fewest features you need."_
7. A shortcut: client straight to a Lambda function URL. _"One function? Maybe no gateway at all."_
   **The moment**: Beat 3, the burst turning into 429s at the throttle station.
   **Interaction**: Raise the request rate and watch the throttle station.
   **Ending**: Full pipeline with a request travelling through all stations, stage label on top.
   **Variants**: `aws-lambda-concurrency`; `aws-elb-alb-vs-nlb-vs-gwlb`; `aws-cloudfront-distributions`.
   **Techniques**: token, zoom, layers, meter, dial, side by side, failure, caption.
   **Review**: Improved — gave the throttle numbers and the 401-versus-429 contrast, and rewrote the unclear "sender-side line" in beat 6. Kept the burst-to-429 moment over an auth-first moment, because throttling is the visible surprise. Checked: REST vs HTTP feature split, WebSocket connection IDs, stages, function URL shortcut.

## Observability and operations

### CloudWatch metrics, logs and alarms (`aws-cloudwatch`)

**The aha**: Logs become metrics (through filters or embedded metric format), and metrics become actions (through alarms).
**Misconception to defeat**: That CloudWatch can see everything about an EC2 instance on its own.
**Cast**: A Lambda and an EC2 instance emitting log lines; a Logs panel; a metrics chart; an alarm card with threshold line; an action bell (SNS, Auto Scaling).
**Opening frame**: An EC2 instance with a small CPU gauge only; a Logs panel and chart empty.
**Story**:

1. Lambda log lines stream into a Logs group. _"Logs: raw lines."_
2. A metric filter highlights lines containing "ERROR"; each hit adds a point to a chart "ErrorCount". _"Lines counted into a metric."_
3. An alarm card sits on the chart with a threshold line; the line is crossed for 3 of 5 periods; the card flips to ALARM and an SNS bell rings. _"Metric crosses line, alarm acts."_
4. EC2: CPU, network and disk I/O appear (seen from outside the VM), but a "Memory" gauge is a blank question mark. _"The hypervisor can't see inside the OS."_
5. The CloudWatch agent is installed inside the instance; memory and disk-used gauges fill in. _"The agent reports from inside."_
   **The moment**: Beat 3, a log line becoming a point and then a ringing bell. Beats 4-5 add the second lesson: the blank memory gauge getting filled by the agent.
   **Interaction**: Drag the alarm threshold and watch when it would have fired.
   **Ending**: Pipeline Logs → Metric → Alarm → Action, fully lit.
   **Variants**: `aws-x-ray-tracing`; `aws-cloudtrail-vs-cloudwatch-vs-config`.
   **Techniques**: stream, chart, token, meter, dial, restyle, zoom, caption.
   **Review**: Improved — the moment pointed at the EC2 gauge, which is the sub-lesson, while the aha is the logs to metric to alarm to action chain; the moment now sits on beat 3. Alternative (open on the blind EC2 gauge) is a better hook but would make the misconception the story. Checked: metric filter, alarm M-of-N datapoints, agent for memory and disk-used, hypervisor-level CPU/network/disk I/O.

### X-Ray and distributed tracing on AWS (`aws-x-ray-tracing`)

**The aha**: One trace ID passed through every hop stitches a single request's journey together; sampling means not every request is traced.
**Misconception to defeat**: That separate logs from each service are enough to follow one request.
**Cast**: A chain: API Gateway → Lambda → SQS → Lambda → DynamoDB. A waterfall timeline below. A sampling dial.
**Opening frame**: Five services, each with a separate pile of unrelated log lines.
**Story**:

1. A request enters carrying a tag "trace 1-58a..." (the X-Amzn-Trace-Id header) that rides along each arrow. _"One ID, every hop."_
2. As it passes, each service adds a coloured bar to a waterfall below, nested like segments and subsegments. _"Each hop reports its slice."_
3. One bar (DynamoDB) is long and red; the service map above shows that node in red. _"The slow hop, found."_
4. A thousand requests stream; the default rule traces the first request each second plus 5% of the rest; the others pass grey. _"Sampling: a rule, not all."_
5. The SQS hop: the tag hops across the queue in the AWSTraceHeader system attribute, so the trace continues. _"It survives async hops too."_
6. Instrumentation inset: the X-Ray SDKs are in maintenance (end of support Feb 2027); new code emits OpenTelemetry through ADOT, with CloudWatch Application Signals on top, and the same trace picture appears. _"Same trace, OpenTelemetry in."_
   **The moment**: Beat 3, the red bar on the waterfall mapped to the red node.
   **Interaction**: Change the sampling rate and see traces thin out and the bill fall.
   **Ending**: Service map with latency and error rates on each node.
   **Variants**: `aws-cloudwatch`; tracing generally in the observability area.
   **Techniques**: token, path trace, lanes, chart, dial, zoom, caption.
   **Review**: Improved — added the catalog's instrumentation change (X-Ray SDKs in maintenance, OpenTelemetry/ADOT the path), fixed the SQS carrier (the AWSTraceHeader system attribute, not user message attributes) and replaced "1 in 20" with the real default sampling rule. Kept the red bar-to-red node moment; the alternative of starting from the service map hides how the map is built.

### CloudTrail trails and events (`aws-cloudtrail`)

**The aha**: Every AWS action is an API call by an identity, and CloudTrail records who did what, when and from where; reads of S3 objects are only logged if you turned data events on beforehand.
**Misconception to defeat**: That CloudTrail records everything, including who read an object, by default.
**Cast**: A ledger of event rows (time, who, action, source IP). Identities on the left (a user, a role, a service) calling the console, CLI and SDK into an AWS API gate. An S3 bucket for the trail with a digest.
**Opening frame**: Several identities and a closed gate marked "AWS API".
**Story**:

1. A user deletes a security group via the console; a ledger row appears: "alice, DeleteSecurityGroup, 10:42, 203.0.113.5". _"Who, what, when, from where."_
2. A role from CI and a service call; rows pile up. Management events are on by default (90 days in Event history). _"Management events, by default."_
3. Someone reads s3://payroll/file.csv. No row. _"Object reads: not logged."_
4. Data events switched on for that bucket; the next read creates a row; the earlier read stays missing. _"Turn it on before you need it."_
5. A trail copies rows to S3 for years. Each log file gets a signed digest; one file is edited and its digest check goes red. _"Validation proves nothing was altered."_
   **The moment**: Beat 4, the missing row that can never be recovered.
   **Interaction**: Toggle data events, make a read and see whether a row appears.
   **Ending**: Ledger with a gap highlighted where data events were off.
   **Variants**: `aws-cloudtrail-vs-cloudwatch-vs-config`; `aws-iam-policy-evaluation-logic`.
   **Techniques**: token, contents, toggle, failure, timer, caption.
   **Review**: Keep — the missing row that can never be recovered is the sharpest possible defeat of "CloudTrail records everything". Weighed a security-camera metaphor (records everything it was pointed at) and rejected it as less precise than the ledger plus toggle. Checked: management events on by default with 90 days in Event history, data events off and paid, signed digest files for log file validation, org trail and Lake left to the narration.

### AWS Config rules, conformance packs and remediation (`aws-config`)

**The aha**: Config is a time machine and compliance checker for resource state; detection can trigger automatic remediation.
**Misconception to defeat**: That Config prevents bad configurations (it records and evaluates; it doesn't block).
**Cast**: A security group card with a timeline scrubber; rules ("no 0.0.0.0/0 on port 22") as small judges; a compliance badge; an SSM remediation arrow (with EventBridge as an optional trigger).
**Opening frame**: A security group card at today's state, scrubber at right.
**Story**:

1. Scrubber dragged back: last Tuesday's version shows port 22 closed; today's shows open to 0.0.0.0/0, the diff highlighted. _"What did it look like then?"_
2. A rule card evaluates today's state; badge turns NON_COMPLIANT. _"And is it allowed now?"_
3. A conformance pack bundles 30 rules over many resources; a dashboard colours resources. _"Packs of rules, org-wide."_
4. The rule's remediation action runs an SSM Automation that closes the port (EventBridge can trigger custom responses too); the badge returns to COMPLIANT. _"Detection plus fix."_
5. Reminder strip: the port was already open for minutes before; Config told after, not before; stopping it up front is a service control policy's job, and who opened it is CloudTrail's. _"Detects, doesn't prevent."_
   **The moment**: Beat 4, the loop closing by itself.
   **Interaction**: Scrub the timeline of a resource.
   **Ending**: A compliant card with a visible history trail.
   **Variants**: `aws-cloudtrail-vs-cloudwatch-vs-config`; service control policies as the preventive layer.
   **Techniques**: lanes, restyle, token, path trace, side by side, caption.
   **Review**: Improved — remediation is a native Config action that runs SSM Automation (EventBridge is optional), and beat 5 now defeats the prevent misconception explicitly by pointing at SCPs for prevention and CloudTrail for the actor. Alternative (open on the compliance badge) loses the time-machine hook. Checked: configuration items, rule evaluation, conformance packs, aggregators.

### CloudTrail vs CloudWatch vs Config (`aws-cloudtrail-vs-cloudwatch-vs-config`)

**The aha**: Three questions, three services: Is it healthy? CloudWatch. Who changed it? CloudTrail. What changed, and is it allowed? Config.
**Misconception to defeat**: That they all "monitor AWS" and overlap.
**Cast**: One security group on screen with an incident bell; three detective cards beside it; a question path.
**Opening frame**: A web app whose requests suddenly fail; a bell rings; three icons waiting.
**Story**:

1. "Is the app healthy?" lights CloudWatch: an error-rate line spikes. _"Symptoms: CloudWatch."_
2. "Who did it?" lights CloudTrail: a ledger row "bob, RevokeSecurityGroupIngress, 09:58". _"Actor: CloudTrail."_
3. "What changed, and is it allowed?" lights Config: before/after diff of the group's rules and a red NON_COMPLIANT on the rule "web SG allows 443 from the load balancer". _"State and compliance: Config."_
4. Three clues stacked on one timeline: at 09:58 the change (Config) and the actor (CloudTrail), at 09:59 the symptom (CloudWatch). _"One incident, three views."_
5. Quiz mode: "Who deleted the bucket?" "Was the SG ever open to the world?" "Is CPU high?" each routes to its service. _"Ask the right one."_
   **The moment**: Beat 4, the same incident visible in three different coloured layers.
   **Interaction**: Choose a question and watch the matching service light up.
   **Ending**: Three icons with their one question each.
   **Variants**: `aws-cloudwatch`, `aws-cloudtrail`, `aws-config`.
   **Techniques**: spotlight, choice, path trace, lanes, side by side, caption.
   **Review**: Improved — beat 3 showed NON_COMPLIANT with no rule that a revoked ingress would violate, so it now names one; beat 4 no longer implies the actor and the change happen at different times (the symptom follows). Kept the single-incident, three-layers moment over a pure quiz: one story shows the services complement rather than overlap. Checked: all three one-line questions.

### Systems Manager: running fleets without SSH (`aws-systems-manager`)

**The aha**: Instances dial out to Systems Manager, so operators reach them through IAM and audited sessions instead of SSH keys, port 22 and a bastion.
**Misconception to defeat**: That you must open inbound access to administer an instance.
**Cast**: Left: the old way (admin, bastion, key, port 22 open, a lock icon broken). Right: SSM agent on instances in a private subnet with no inbound rules, an SSM service cloud, an IAM check, a session log.
**Opening frame**: An admin and a private instance with a dashed question mark between.
**Story**:

1. Old way: arrows open through a bastion; port 22 lit red; a key file on a laptop. _"Keys, bastion, open port."_
2. Reset. The instance's SSM agent, using an instance role, opens an outbound HTTPS line to the SSM service (through a NAT or VPC endpoints, since the subnet is private). Inbound rules: none. _"The instance calls out."_
3. The admin signs in with IAM, clicks Start session; the IAM check passes; a terminal opens through the service. _"Access is a permission."_
4. Every keystroke is copied to a session log (S3 or CloudWatch). _"Audited by default."_
5. Run Command fans a patch out to 200 instances tagged env=prod; Patch Manager ticks them green. _"A fleet at once."_
6. A footnote card: need real SSH? EC2 Instance Connect Endpoint. _"Alternative for real SSH."_
   **The moment**: Beat 2, an instance with zero inbound rules still reachable.
   **Interaction**: Revoke the IAM permission and watch the session fail.
   **Ending**: Sealed instances with a session log scrolling.
   **Variants**: `aws-secrets-manager-vs-parameter-store` (Parameter Store lives here); `aws-vpc-endpoints-and-privatelink`.
   **Techniques**: boundary, token, exchange, side by side, toggle, caption.
   **Review**: Improved — the outbound line now shows what makes it work in a private subnet (instance role, NAT or VPC endpoints), the part learners trip over. Kept the zero-inbound-rules moment; the alternative of a bastion-vs-SSM race is already in beats 1-2. Checked: Session Manager logging to S3/CloudWatch, Run Command by tag, Patch Manager, EC2 Instance Connect Endpoint.

## Security and data protection

### KMS keys and envelope encryption (`aws-kms-envelope-encryption`)

**The aha**: KMS encrypts keys, not your data. A small data key locks the data; the KMS key (which never leaves KMS) locks the data key; to read, you ask KMS to unwrap the data key, and that call is permission-checked and logged.
**Misconception to defeat**: That KMS holds your data, or that your data is encrypted straight under the KMS key.
**Cast**: A big gold KMS key inside a sealed KMS vault frame; an app; a file; a small data key (plain, glowing) and its locked twin; a CloudTrail ledger; an IAM check gate.
**Opening frame**: A file, an app, and a sealed KMS vault with a big key inside.
**Story**:

1. The app asks KMS for a data key (GenerateDataKey). Two copies come out: a plaintext data key and the same key locked by the KMS key. _"Two copies: open and sealed."_
2. The app locks the file with the plaintext key, then discards that key from memory. _"Encrypt locally, forget the key."_
3. The sealed data key is stored right next to the encrypted file. The big key never moves. _"The KMS key never leaves KMS."_
4. Later: the app sends the sealed key to KMS; the IAM and key-policy gate checks; KMS returns the plaintext key; the file opens. A ledger row is written. _"Read = a logged, checked call."_
5. An attempt without permission is stopped at the gate; the file stays a locked blob. _"No permission, no data."_
6. Side note: sending a 5 KB file straight to KMS bounces at a 4 KB limit. _"Direct encrypt: 4 KB max."_
7. Rotation: the big key turns into a new version; old files still open, none re-encrypted. _"Rotate the key, not the data."_
   **The moment**: Beat 3, a locked file and a locked key side by side, with the big key never leaving its vault.
   **Interaction**: Revoke the app's decrypt permission and watch an already-stored file become unreadable.
   **Ending**: Encrypted file with sealed key, vault intact, ledger row visible.
   **Variants**: `aws-kms-key-policies-and-custody`; `aws-s3-encryption-options`; the general envelope-encryption concept in the security area.
   **Techniques**: boundary, clone, token, exchange, restyle, failure, caption.
   **Review**: Keep — the locked file beside its locked key, with the big key never moving, is the clearest picture of why KMS "encrypts keys, not data". Weighed a bank safe-deposit metaphor (rejected: it implies KMS stores your data) and starting from the 4 KB limit (a good failure, kept as beat 6 where it explains why envelopes exist). Checked: GenerateDataKey returns plaintext and wrapped copies, 4 KB Encrypt cap, Decrypt is IAM and key-policy checked and logged, rotation keeps old key material so data is not re-encrypted.

### KMS key policies, grants and key custody (`aws-kms-key-policies-and-custody`)

**The aha**: Whoever controls the key policy controls the data, even across accounts; a cross-account decrypt needs both the key policy and the caller's IAM policy to say yes. Custody choices trade convenience for control.
**Misconception to defeat**: That IAM alone decides who can use a KMS key; it only counts when the key policy lets it.
**Cast**: Two account frames, A (key owner) and B (caller); a key with a policy document; caller's role with an IAM policy; two gates in series. A custody ladder at right.
**Opening frame**: Account B's role pointing at Account A's key, a closed gate between.
**Story**:

1. One account: the default key policy says "this account's IAM policies may use the key". A role's IAM allow for kms:Decrypt works. _"The key policy delegates to IAM."_
2. Delete that delegating statement: the same IAM allow now does nothing; only principals named in the key policy get in. _"No delegation, IAM ignored."_
3. Cross-account: B's role has an IAM allow, but A's key policy doesn't name B: refused. Reverse it: A's policy names B, but B's role has no IAM allow: stopped at B's gate. Both open: decrypt succeeds, a ledger row appears. _"Both sides must allow."_
4. A grant: a short-lived, narrow pass handed to a service (EBS) for one task, then retired. _"Grants for services, temporary."_
5. The key is scheduled for deletion (7 to 30 day waiting period) and then deleted: everything encrypted under it goes grey for good. A key policy naming no one can be fixed only through AWS Support. _"Lose the key, lose the data."_
6. Custody ladder: AWS-generated material, imported material (you keep a copy), custom key store (CloudHSM), external key store (key outside AWS). Control rises, convenience falls. _"More control, more work."_
   **The moment**: Beat 3, two separate gates both needing to open.
   **Interaction**: Toggle the delegation statement, the key-policy allow and the IAM allow, and see whether the call succeeds (truth table).
   **Ending**: Custody ladder with cross-account gates both open.
   **Variants**: `aws-kms-envelope-encryption`; `aws-cross-account-access`; `aws-identity-vs-resource-policies`.
   **Techniques**: boundary, toggle, token, failure, layers, side by side, caption.
   **Review**: Improved — the misconception was wrong in the common case (in one account the default key policy delegates to IAM, so IAM alone works); beats 1-2 now show delegation and its removal, then cross-account needs both sides. Beat 5 now shows deletion/lock-out instead of repeating the removed-statement idea. Alternative (two padlocks only) is kept inside beat 3. Checked: both policies needed cross-account, grants, key deletion window 7-30 days, custody options.

### Secrets Manager vs Parameter Store (`aws-secrets-manager-vs-parameter-store`)

**The aha**: Rotation is the dividing line: credentials that should change automatically go in Secrets Manager; configuration and static values go in Parameter Store.
**Misconception to defeat**: That the two are interchangeable and the cheaper one will do for everything.
**Cast**: An app and an RDS database; two shelves labelled Secrets Manager and Parameter Store; a rotation Lambda; a CloudTrail ledger; a coin meter for cost.
**Opening frame**: An app with a password hard-coded in code (red alert), a database.
**Story**:

1. The password is pulled out of code into a secret; the app fetches it at runtime, a ledger row logs each read. _"Out of code, and audited."_
2. Secrets Manager: a clock ring hits 30 days; the rotation Lambda sets a new password on the database and updates the secret; the app's next fetch gets the new one. _"Rotates itself."_
3. Parameter Store: a config value (`/app/prod/feature-x = on`, `/app/max-conn = 50`) in a hierarchy tree; free standard tier; SecureString encrypted with KMS. _"Config and static values."_
4. Parameter Store with a DB password: still works, but the clock ring just sits there; the password stays the same for two years. _"No built-in rotation."_
5. Costs: a coin drips per secret per month in Secrets Manager, none for standard parameters. _"Rotation is what you pay for."_
6. Decision: "Needs automatic rotation or cross-region replica?" lights Secrets Manager; otherwise Parameter Store. _"Does it rotate?"_
   **The moment**: Beat 2 beside beat 4, the rotating ring versus the frozen one.
   **Interaction**: Fast-forward time and watch each store's secret change or not.
   **Ending**: Two shelves, the decision question between them.
   **Variants**: `aws-kms-envelope-encryption`; `aws-systems-manager`.
   **Techniques**: side by side, timer, token, meter, contents, choice, caption.
   **Review**: Keep — the rotating ring beside the frozen one is the real dividing line, and the coin drip in beat 5 explains the price. Weighed a cost-first comparison (Parameter Store free, Secrets Manager per secret) and rejected it as it makes the cheaper choice look sensible. Checked: Secrets Manager rotation (Lambda or managed for RDS) and per-secret monthly billing, Parameter Store hierarchy, free standard tier, SecureString under KMS, no native rotation, CloudTrail audits reads.

### AWS Certificate Manager and Private CA (`aws-acm-certificates`)

**The aha**: An ACM certificate lives in one Region and attaches to an AWS front door where TLS ends; DNS validation makes renewal automatic; imported certificates you renew yourself.
**Misconception to defeat**: That a public ACM certificate can simply be copied onto an EC2 instance or used from any Region.
**Cast**: Region frames (eu-west-1, us-east-1); an ALB, CloudFront, API Gateway; certificate cards with expiry rings; Route 53 with a CNAME validation record.
**Opening frame**: A browser, a padlock, an ALB in eu-west-1 with a certificate attached.
**Story**:

1. The certificate sits on the ALB; HTTPS from the browser ends there, then plain or re-encrypted traffic goes inside. _"TLS ends at the front door."_
2. Request a cert for example.com; ACM shows a CNAME to add; Route 53 adds it with one click; status Pending → Issued. _"DNS proves you own it."_
3. The expiry ring runs down; ACM renews silently because the CNAME is still there. _"Renewal: no one does anything."_
4. Try attaching the eu-west-1 cert to CloudFront: refused; a copy requested in us-east-1 attaches. _"CloudFront wants us-east-1."_
5. An imported certificate: its ring runs down, no renewal, an alert turns red. (An exportable public certificate can sit on an instance, but then the key has left ACM and each renewal must be redeployed.) _"Imported or exported: your job."_
6. Private CA: an internal root signs certificates for internal services, a monthly coin meter. _"Your own CA, for private names."_
   **The moment**: Beat 4, the refusal at the Region boundary.
   **Interaction**: Choose a service and Region for a certificate and see if it attaches.
   **Ending**: Padlocks on each front door, rings healthy, the imported one flagged.
   **Variants**: `aws-cloudfront-distributions`; `aws-elb-alb-vs-nlb-vs-gwlb`; TLS in networking.
   **Techniques**: boundary, token, timer, failure, restyle, caption.
   **Review**: Improved — the misconception was out of date because exportable public certificates exist (catalog); the story now says standard ACM certificates stay inside AWS front doors and exported or imported ones are your job to renew and deploy. Kept the Region-boundary refusal as the moment. Checked: DNS validation CNAME renewal, CloudFront needs us-east-1, TLS terminates at the front door, Private CA for internal names.

### AWS security services: GuardDuty, Inspector, Macie, Security Hub, Detective (`aws-security-services-map`)

**The aha**: Each service answers one question: detect threats (GuardDuty), find weaknesses (Inspector), find sensitive data (Macie), aggregate and prioritise (Security Hub), investigate (Detective). Turn each on once for the organisation; findings flow to EventBridge for automatic response.
**Misconception to defeat**: That they are overlapping "security scanners" and one is enough.
**Cast**: An organization frame with many account frames; a delegated-admin account; five service tiles each with its question; a findings funnel; an EventBridge → Lambda response.
**Opening frame**: An organization of accounts, a plain workload in one, five tiles greyed.
**Story**:

1. A crypto-mining pattern from an EC2 instance contacting a bad IP: GuardDuty lights, a finding "Threat". _"Detect: someone is acting badly."_
2. An instance with an unpatched library: Inspector lights, a finding "Vulnerability". _"Weaknesses: something is exposed."_
3. A bucket with card numbers: Macie lights, "Sensitive data". _"What data is where."_
4. All findings flow into Security Hub, sorted by severity. Two layers are labelled: Security Hub CSPM (posture checks against standards such as CIS) and the 2025 Security Hub (correlates findings into exposures). _"One prioritised list."_
5. A finding opens in Detective: a graph of the user, IPs and API calls around it. _"Investigate: how did this happen?"_
6. Toggle "enable for the organization": a delegated admin turns every account's tiles on at once. _"On once, everywhere."_
7. A finding triggers EventBridge → Lambda that isolates the instance. _"Findings can act."_
   **The moment**: Beat 4, five different coloured findings landing in one list.
   **Interaction**: Pick a scenario (leaked key, public bucket, vulnerable image) and see which tile responds.
   **Ending**: The five tiles each with their single question.
   **Variants**: `aws-organizations`; `aws-eventbridge`; `aws-config`.
   **Techniques**: boundary, spotlight, token, stream, zoom, toggle, choice, caption.
   **Review**: Improved — added the Security Hub split (CSPM versus the new exposure-correlating Security Hub) the catalog flags, which the plan had flattened into one box. Kept five tiles each with one question: an alternative "kill chain" layout would blur the one-question-per-service point. Checked: GuardDuty inputs, Inspector scope (EC2, ECR, Lambda), Macie is S3, delegated admin, EventBridge response.

### Cognito user pools vs identity pools (`aws-cognito-user-pools-vs-identity-pools`)

**The aha**: A user pool answers "who is this user?" for your app and issues tokens; an identity pool answers "which AWS role does this user get?" and issues AWS credentials.
**Misconception to defeat**: That Cognito has one login service, so "identity" and "user" pools are the same.
**Cast**: A user and browser; a User Pool (directory with sign-in, MFA, social login); an Identity Pool (role mapper); an API Gateway with Cognito authorizer; S3 and DynamoDB; JWT and credential cards.
**Opening frame**: A browser with a sign-in form; two Cognito halves labelled by question.
**Story**:

1. The user signs in (password + MFA, or Google); the user pool hands back a JWT. _"Who are you? A token."_
2. Path A: the JWT goes to API Gateway; its Cognito authorizer verifies it and lets the call reach Lambda. _"Often this is all you need."_
3. Path B: the JWT goes to the identity pool; it exchanges it, through STS, for temporary AWS credentials tied to a role. _"Which role do you get?"_
4. The browser uses those credentials directly on one S3 prefix; a call to another prefix is denied by the role. _"Browser to S3, scoped by role."_
5. Guest user: the identity pool gives a guest role with fewer rights. _"Even anonymous gets a role."_
   **The moment**: Beat 3, a JWT becoming a role's temporary credentials.
   **Interaction**: Switch the user's group and watch the role (and reachable buckets) change.
   **Ending**: Two paths, pools labelled by their questions.
   **Variants**: `aws-iam-roles-and-sts`; `aws-iam-federation`; `aws-api-gateway`.
   **Techniques**: token, exchange, side by side, path trace, restyle, failure, caption.
   **Review**: Keep — the JWT turning into role credentials (beat 3) is the exact difference, and beat 2 shows the common case where no identity pool is needed. Weighed a passport-versus-visa metaphor; the real token and credential cards are more precise. Checked: user pool issues ID/access/refresh JWTs, API Gateway Cognito authorizer, identity pool exchanges tokens for STS credentials, guest role, role per group.

## Reliability and disaster recovery

### Multi-AZ design on AWS (`aws-multi-az-design`)

**The aha**: Design to lose one AZ without needing to scale: capacity already waiting in the survivors, and no path that crosses AZs where it needn't.
**Misconception to defeat**: That spreading across AZs is enough; the survivors must already hold the load.
**Cast**: A region with three AZ frames, each with a subnet, instances, a NAT gateway. A load gauge per AZ. An ARC zonal shift button.
**Opening frame**: Three AZs each at 66% load (nine instances, three each).
**Story**:

1. AZ-C fails (greys). Two AZs jump from 66% to about 100% (3 x 66 / 2 = 99) and requests queue. _"Spread, but too tight."_
2. Reset: the same work spread over four instances per AZ (twelve, about 50% each); AZ-C fails; AZ-A and B rise to about 75% and everything keeps serving. _"Static stability: capacity is already there."_
3. The trap: AZ-A and B's instances route outbound through one NAT in AZ-C; it goes down and both lose internet. _"A hidden dependency across AZs."_
4. Fix: a NAT per AZ, each subnet uses its own, zonal endpoints. Same failure: nothing else breaks. _"Keep paths inside the AZ."_
5. A "gray" failure: AZ-C is impaired, not dead. Operators press Zonal shift; traffic drains from AZ-C within a minute or two and the shift auto-expires. _"Drain the sick AZ."_
   **The moment**: Beat 3-4, one hidden NAT breaking two healthy AZs, then the fix.
   **Interaction**: Fail any AZ and any NAT, and set the starting load.
   **Ending**: Three self-contained AZ lanes, one drained.
   **Variants**: `aws-application-recovery-controller`; `aws-rds-multi-az-vs-read-replicas`; `aws-vpc-anatomy`.
   **Techniques**: boundary, failure, meter, dial, side by side, restyle, caption.
   **Review**: Improved — made the numbers add up (nine instances at 66% each lose a third and land at about 99%; twelve instances at about 50% land at about 75%), and softened the drain time from "seconds" to a minute or two since zonal shift works through DNS and load balancer routing. Kept the hidden-NAT beats as the moment; the alternative of leading with zonal shift hides the design-ahead lesson. Checked: static stability, per-AZ NAT, zonal shift as the gray-failure tool.

### AWS Backup and point-in-time recovery (`aws-backup`)

**The aha**: A backup only counts once it has left the blast radius (another account or Region, locked) and a restore has been tested; point-in-time restores make a new resource, never rewinding the original.
**Misconception to defeat**: That having snapshots means being protected, and that PITR rewinds the database in place.
**Cast**: A backup plan card (schedule, retention, lifecycle) covering RDS, EBS, DynamoDB, EFS by tag; a vault; a second vault in another account and Region with a lock; a restore test.
**Opening frame**: Four resources with a tag "backup=daily", one policy card with a clock.
**Story**:

1. The plan picks up every resource with the tag; recovery points land in a vault. _"One policy, many services."_
2. A ransomware attacker with access to the account deletes the vault. All backups vanish. _"Same account, same blast radius."_
3. Rewind: a copy rule sends each point to a vault in a second account and Region, with Vault Lock (WORM). The delete attempt is refused. _"Copy it out and lock it."_
4. A restore test: a point is restored to a throwaway resource, a green check "restore tested". _"Untested = hope."_
5. PITR on RDS (within a 1 to 35 day window): a timeline scrubber to 10:41; the result is a new instance with a new endpoint beside the old one; the app string must change. _"PITR makes a new resource."_
   **The moment**: Beat 2 against 3: the same attack, the lock holds.
   **Interaction**: Pick a restore time on the timeline and see the new database appear.
   **Ending**: Two vaults, one locked, restore history ticked.
   **Variants**: `aws-dr-strategies`; `aws-s3-versioning`; `aws-s3-object-lock`.
   **Techniques**: boundary, token, failure, toggle, lanes, restyle, caption.
   **Review**: Improved — added the PITR retention window (RDS up to 35 days) so the scrubber has visible bounds. Kept the same-attack-twice contrast (beat 2 against 3) as the moment; alternative of leading with the restore test is less visceral. Checked: tag-based plan, copy to another account and Region, Vault Lock WORM, PITR creates a new instance with a new endpoint.

### DR strategies on AWS (`aws-dr-strategies`)

**The aha**: Each tier buys a lower RTO and RPO at a higher always-on cost; failover should use data-plane switches, and the DR Region needs its quotas raised beforehand.
**Misconception to defeat**: That DR means backups, or that DR capacity can be created on demand in an outage.
**Cast**: Four rows on one timeline (Backup & restore, Pilot light, Warm standby, Multi-site active/active), each with primary and DR Region boxes, a disaster marker, RPO span before and RTO span after, and a coin meter.
**Opening frame**: Four rows, disaster marker at "T", all empty.
**Story**:

1. Backup & restore: backups ship occasionally; at T, a long RPO bar (hours) before and a long RTO bar (hours) after as infrastructure is rebuilt. Coin meter: tiny. _"Cheapest, slowest."_
2. Pilot light: data replicates continuously; compute is off. At T the app servers are switched on; RPO minutes, RTO tens of minutes. _"Core running, rest off."_
3. Warm standby: a small copy runs; at T it scales up. RTO minutes. Meter: medium. _"Small but alive."_
4. Multi-site: both Regions serve; at T, traffic shifts; RPO near zero, RTO seconds. Meter: double. _"Nothing to start, twice the bill."_
5. The failover switch: pulling a lever (Route 53 health check / ARC routing control) works; a second row tries clicking the console, which is greyed by the outage. _"Use the data plane, not the control plane."_
6. A quota gauge in the DR Region at default limit: the scale-up stalls at the cap. Raised beforehand, it passes. _"Quotas in DR too."_
   **The moment**: Beat 4, the four rows' RPO and RTO bars and cost meters side by side on one timeline.
   **Interaction**: Drag an RTO target and see which tiers still qualify, with their cost.
   **Ending**: All four rows frozen at T with lengths and cost labelled.
   **Variants**: `aws-application-recovery-controller`; `aws-multi-region-databases`; `aws-service-quotas`; DR concepts in the reliability area.
   **Techniques**: lanes, side by side, meter, timer, failure, dial, toggle, caption.
   **Review**: Keep — four rows on one timeline with RPO before and RTO after and a coin meter makes the trade-off visible at once. Weighed a per-tier story (four separate diagrams) and rejected it because the comparison is the point. Checked: RPO/RTO ordering across tiers (hours, tens of minutes, minutes, near zero), multi-site costing roughly double, data-plane failover via Route 53 health checks or ARC routing controls, and quotas raised in the DR Region beforehand.

### Amazon Application Recovery Controller (ARC) (`aws-application-recovery-controller`)

**The aha**: Failover should be a pre-built, tested switch on the data plane, not a sequence of console clicks during an outage; zonal shift is the "drain this AZ" button.
**Misconception to defeat**: That failover means running a runbook when things are already breaking.
**Cast**: Two Regions (Primary, Standby) with cells; routing controls drawn as physical switches; a Route 53 health check fed by the switch; a pre-flight checklist; a Region switch plan (ordered failover steps); a zonal shift button across three AZs.
**Opening frame**: Primary serving, Standby idle, two switches (On, Off).
**Story**:

1. Before any outage: a checklist compares primary and standby capacity, quotas and configs; one reads red, then green. The switches and a Region switch plan (ordered failover steps) are built and rehearsed. _"Prepare the switch before you need it."_
2. Outage in primary; the console control plane greys out. The routing-control switch (served by a five-Region cluster) still works. _"The switch lives on the data plane."_
3. Flip: primary off, standby on; the Route 53 health checks follow; traffic shifts. _"Failover = flip a switch."_
4. A safety rule blocks turning both off. _"Guardrails against a wrong flip."_
5. Zonal shift: AZ-B is impaired; the button shifts the load balancer away for a chosen time and it auto-expires. _"Drain this AZ."_
   **The moment**: Beat 2-3, a switch that works while the console is down.
   **Interaction**: Flip the switches and see where traffic goes; try violating the safety rule.
   **Ending**: Standby serving, a green checklist.
   **Variants**: `aws-dr-strategies`; `aws-multi-az-design`; `aws-route53-routing-policies`.
   **Techniques**: toggle, failure, boundary, stream, restyle, timer, caption.
   **Review**: Improved — the catalog describes ARC as zonal shift, routing controls and Region switch plans, so the "readiness board" opening was recast as a rehearsed pre-flight check plus a Region switch plan; flagged for the writer to confirm any readiness check availability. Kept the switch-works-while-console-is-down moment; alternative (runbook versus switch side by side) is carried by beat 2. Checked: routing controls on a five-Region cluster, safety rules, zonal shift auto-expiry.

### Service quotas and API throttling (`aws-service-quotas`)

**The aha**: Quotas are a design input: they cap scaling, a DR Region on defaults can't absorb production, and one noisy workload in a shared account uses everyone's limits.
**Misconception to defeat**: That cloud capacity is unlimited and available the moment you ask.
**Cast**: Account frames (quotas are per account, per Region) with quota gauges (EC2 vCPUs, Lambda concurrency, API request rate); a request stream; 429/throttle badges; a DR region copy.
**Opening frame**: Account with a vCPU gauge: 800 of 1,000 used.
**Story**:

1. Autoscaling asks for 400 more vCPUs; the gauge hits the cap and the launch fails "VcpuLimitExceeded". _"Scaling stops at the quota."_
2. A DR Region account with the same default quota: production fails over, the gauge caps at a fraction of what's needed, and a raise request takes time, not seconds. _"DR on defaults can't carry production."_
3. In a shared account, a batch job's Lambda burst fills the concurrency gauge; the checkout function is throttled (429). _"A noisy neighbour in the same account."_
4. Split into separate accounts, each with its own gauge; the batch job fills only its own (inside one account, reserved concurrency walls off a function). _"Accounts = separate limits."_
5. API throttling: a burst of calls against a rate limit gets rejected; retries with exponential back-off and jitter space out and succeed. _"Back off, jitter, retry."_
   **The moment**: Beat 3-4, the same burst throttling checkout in one account and harming nothing in two.
   **Interaction**: Raise a quota request; run a burst with and without back-off.
   **Ending**: Separate accounts with their own gauges, DR raised in advance.
   **Variants**: `aws-lambda-concurrency`; `aws-dr-strategies`; `aws-organizations`.
   **Techniques**: meter, boundary, stream, failure, side by side, dial, caption.
   **Review**: Improved — quotas are per account and per Region, a raise is a request not an instant action, and reserved concurrency is the in-account alternative to splitting accounts. Kept the same-burst-in-one-account versus two-accounts contrast as the moment. Checked: 800 + 400 vCPU exceeds 1,000, VcpuLimitExceeded, Lambda 429 throttling, SDK exponential backoff with jitter.

## Cost

### EC2 purchasing options (`aws-ec2-purchasing-options`)

**The aha**: Purchasing options change the bill; capacity reservations guarantee the hardware. They are separate levers, layered by predictability.
**Misconception to defeat**: That a Savings Plan (or a Regional Reserved Instance) guarantees capacity.
**Cast**: A usage chart over a day; a coloured stack: base layer (commitment), middle (On-Demand), spiky top (Spot); a coin meter; a capacity-reservation shelf.
**Opening frame**: A usage curve with a flat floor and spiky top, entirely painted On-Demand with a high coin meter.
**Story**:

1. The floor is repainted with a Savings Plan commitment (1 or 3 years); the meter falls. _"Steady baseline: commit."_
2. The middle band stays On-Demand: pay by second, no promise. _"Unsure demand: On-Demand."_
3. Interruptible work (batch, CI) on top turns into Spot at a steep discount; spot capacity shown across three instance types and AZs. _"Interruptible: Spot."_
4. A 2-minute interruption notice; the job checkpoints and moves to another type. _"Spread types, react to the notice."_
5. Capacity test: a Savings Plan holder asks for an instance in a constrained AZ and is told "insufficient capacity"; an On-Demand Capacity Reservation (or the older zonal Reserved Instance) guarantees it but charges whether used. _"Discount ≠ guarantee."_
   **The moment**: Beat 5, the committed customer not getting hardware.
   **Interaction**: Slide the commitment level and watch waste (unused commitment) against savings.
   **Ending**: Three-layer stack with meter at a low bill and a reservation tick.
   **Variants**: `aws-cost-management-tools`; `aws-ec2-instance-types`; cost in fundamentals.
   **Techniques**: layers, chart, meter, dial, failure, side by side, caption.
   **Review**: Improved — "Reserved Instance guarantees nothing" was too broad: zonal RIs do reserve capacity, Regional RIs and Savings Plans do not; beat 5 and the misconception now say so. Kept the committed customer being refused hardware as the moment; alternative (a cost-only layer cake) misses the independence of discount and guarantee. Checked: Spot up to 90% off with a 2-minute notice, Savings Plans 1 or 3 years, per-second On-Demand.

### AWS cost visibility and control tools (`aws-cost-management-tools`)

**The aha**: You can't allocate what you haven't tagged; budgets only warn unless an action is attached; rightsize before committing.
**Misconception to defeat**: That setting a budget caps spending.
**Cast**: A bill split into resources; tag chips; a Cost Explorer chart by tag; a Budget bar with alert and action; a rightsizing panel.
**Opening frame**: A single bar "AWS bill $48,000", unsplit.
**Story**:

1. Tags "team=checkout" added to resources, but the chart still shows "untagged". _"Tags aren't enough."_
2. Cost allocation tag activated in Billing; from the next day the bar splits by team (not backdated unless backfilled). _"Activate it, then it counts."_
3. A Budget with a $40k line: the bar crosses it, an email goes out; spending continues. _"A budget warns."_
4. Attach a budget action (apply a deny policy / stop instances); at 100% the action fires and the growth stops, a little late because billing data refreshes a few times a day. _"An action stops it."_
5. Rightsizing: an m5.4xlarge at 8% CPU shrinks to m5.large, the meter drops to an eighth. Then a Savings Plan sized to the new baseline. _"Shrink first, then commit."_
6. Cost Anomaly Detection flags a spike. _"Catch the surprise early."_
   **The moment**: Beat 3-4, the line crossed with no effect until an action is attached.
   **Interaction**: Choose the order (commit then rightsize vs rightsize then commit) and see wasted commitment.
   **Ending**: Bill split by team with a budget line and an action wired.
   **Variants**: `aws-ec2-purchasing-options`; `aws-data-transfer-costs`.
   **Techniques**: meter, chart, restyle, toggle, side by side, caption.
   **Review**: Improved — fixed a number slip (m5.4xlarge to m5.large is an eighth of the price, not half), added that tags are not backdated and that Budget actions lag the data. Kept the line-crossed-with-no-effect moment; alternative (a tooling tour) lacks a misconception to defeat. Checked: tag activation, budget alerts versus actions, rightsizing before commitment, Cost Anomaly Detection.

### AWS data transfer pricing (`aws-data-transfer-costs`)

**The aha**: The architecture sets the bill: chatty cross-AZ traffic, S3 traffic via NAT, and serving downloads straight from EC2 are the classic surprises.
**Misconception to defeat**: That moving data inside AWS is free and only "internet out" costs money.
**Cast**: A region with two AZs, a private subnet, a NAT gateway, S3, an internet gateway, CloudFront. Each arrow carries a price tag and a coin drip.
**Opening frame**: A diagram with no price tags and a monthly coin meter at $0.
**Story**:

1. Traffic into AWS: free (green arrow). _"In is free."_
2. Chatty service A (AZ-a) calls B (AZ-b) millions of times: arrows between AZs drip coins both directions. _"Cross-AZ costs per GB."_
3. Co-locating the pair in one AZ stops the drip (with a note that availability is traded). _"Keep traffic in the AZ where safe."_
4. A private instance reading S3 through the NAT gateway: coin drip from NAT processing per GB. _"NAT charges for every GB."_
5. A gateway endpoint to S3 rewires the arrow around the NAT: the drip stops. _"Gateway endpoint: free path."_
6. Large downloads served from EC2 to the internet: a heavy egress drip. Putting CloudFront in front: EC2-to-CloudFront transfer is free, cache hits never leave the edge, and the edge price per GB is lower. _"Egress through CloudFront."_
   **The moment**: Beat 5, one small box added and the heavy drip dying.
   **Interaction**: Rewire each arrow and see the meter change.
   **Ending**: Optimised diagram with cheap arrows, the meter far lower.
   **Variants**: `aws-vpc-endpoints-and-privatelink`; `aws-internet-gateway-vs-nat-gateway`; `aws-cloudfront-distributions`.
   **Techniques**: boundary, stream, meter, side by side, move, caption.
   **Review**: Improved — beat 6 now explains why CloudFront is cheaper (origin-to-CloudFront transfer free, cache hits skip origin egress) rather than only a lower per-GB price. Kept the gateway-endpoint beat as the moment; alternative (a price table) loses the architecture-drives-bill point. Checked: in free, cross-AZ charged each way, NAT per-GB processing, gateway endpoints free.

## Delivery and infrastructure as code

### CloudFormation stacks, change sets, drift and StackSets (`aws-cloudformation-stacks`)

**The aha**: CloudFormation owns what it created. Edit it by hand and you get drift; some property changes replace the resource, so read the change set before applying; StackSets carry guardrails into every account.
**Misconception to defeat**: That a change set applies the change, and that an update always edits in place.
**Cast**: A template card; a stack frame holding resources (a bucket, a database, an instance); a change set preview card with Add/Modify/Replace badges; a drift detector; an organization of accounts for StackSets.
**Opening frame**: A template becoming a stack of three resources.
**Story**:

1. Template deployed; the stack creates resources in dependency order, green ticks. _"A template makes a stack."_
2. Someone changes the instance's security group in the console. Drift detection marks the resource DRIFTED, with the diff. _"Changed outside the stack."_
3. Edit the template; create a change set. A preview card lists: bucket Modify, instance Modify, database **Replace** in red (a property that can only be set at creation). Nothing has changed yet. _"A change set is a preview."_
4. Zoom into Replace: the old database fades, a new one with a new ID appears empty. _"Replace: new ID, data gone."_
5. UpdateReplacePolicy Retain (or Snapshot) added: the old database stays behind when it is replaced. (DeletionPolicy is the twin that guards deletes.) _"Retain protects data."_
6. Execute the change set; the stack updates. On failure, the stack rolls back. _"Execute is a separate step."_
7. StackSets: one template pushed to 40 accounts in a grid; each lights up. _"Guardrails to every account."_
   **The moment**: Beat 3-4, a plain-looking edit previewing as "Replace".
   **Interaction**: Change a property and see whether the change set says Modify or Replace.
   **Ending**: Stack, change set history and the grid of accounts all green.
   **Variants**: `aws-cdk`; `aws-organizations`; infrastructure as code in the delivery area.
   **Techniques**: boundary, clone, restyle, zoom, side by side, toggle, caption.
   **Review**: Improved — fixed a technical slip: keeping the old resource on replacement is UpdateReplacePolicy; DeletionPolicy only applies on delete (the catalog's "DeletionPolicy Retain protects data" is the shorthand). Added why a Replace happens. Kept the plain-edit-previews-as-Replace moment; alternative (drift first) is already beat 2. Checked: change set only previews, execute is separate, rollback on failure, StackSets to many accounts.

### AWS CDK (`aws-cdk`)

**The aha**: CDK is code that generates CloudFormation; deployment, rollback and drift are still CloudFormation's.
**Misconception to defeat**: That CDK is a different deployment engine that replaces CloudFormation.
**Cast**: A TypeScript file on the left; a synth arrow; a CloudFormation template on the right; a stack; constructs shown as nested boxes (L1, L2, L3).
**Opening frame**: Five lines of code and a long, grey YAML sketch.
**Story**:

1. A loop in code over three environments expands into three buckets in the template. _"Loops and types."_
2. `bucket.grantRead(fn)` expands into the policy statements in the YAML. _"One line wires up IAM."_
3. Construct levels zoom: L1 raw resource, L2 sensible defaults, L3 whole patterns. _"Reusable components."_
4. `cdk synth` writes the template; `cdk diff` previews it; `cdk deploy` (after a one-time bootstrap stack) hands it to CloudFormation, which does the work. _"CDK stops at the template."_
5. A failed deploy: CloudFormation rolls back and drift detection still lives in CloudFormation. _"Rollback and drift: CloudFormation's."_
6. SAM: a shorter template using Transform, expanded by CloudFormation. _"SAM is a transform."_
   **The moment**: Beat 2, one line unfolding into pages of YAML.
   **Interaction**: Edit the code and watch the template change.
   **Ending**: Code → template → stack with CloudFormation highlighted at the end.
   **Variants**: `aws-cloudformation-stacks`.
   **Techniques**: clone, zoom, token, layers, side by side, caption.
   **Review**: Improved — added the one-time bootstrap and `cdk diff`, which learners hit first. Kept one-line-to-pages-of-YAML as the moment; alternative (CDK vs Terraform) belongs to the delivery area. Checked: synth to CloudFormation, L1/L2/L3 constructs, grantRead expands to IAM, SAM is a transform.

### CodePipeline, CodeBuild and CodeDeploy (`aws-codepipeline`)

**The aha**: A pipeline is a chain of stages; each action takes artifacts from S3 and produces new ones, and cross-account deploys work by assuming roles in the target accounts.
**Misconception to defeat**: That the three Code services are one tool.
**Cast**: Stages left to right: Source (repo) → Build (CodeBuild) → Test → Deploy (CodeDeploy/CloudFormation); an S3 artifact bucket below with box labels; account frames for Tooling, Staging, Production; a role-assumption arrow.
**Opening frame**: Four stage boxes joined, a commit about to arrive.
**Story**:

1. A commit triggers Source; a zip lands in the artifact bucket. _"Output artifact: stored in S3."_
2. CodeBuild starts a throw-away container, reads buildspec.yml, runs, and puts a new artifact back. Labels: CodePipeline orchestrates, CodeBuild builds, CodeDeploy deploys. _"Each action: artifact in, artifact out."_
3. A failing test turns the Test stage red; later stages stay waiting. _"A failure stops the chain."_
4. A manual approval gate before Production. _"Human gate."_
5. Deploy to Production lives in another account: the pipeline's role assumes a deploy role there (STS arrow); the artifact is decrypted with a shared KMS key. _"Cross-account = assume a role."_
6. A footnote: CodeCommit is GA again (Nov 2025). _"Source can be CodeCommit, GitHub, or others."_
   **The moment**: Beat 5, the arrow into another account's frame via assumed role.
   **Interaction**: Break a stage and see which ones are skipped.
   **Ending**: Green pipeline, artifacts listed in the bucket.
   **Variants**: `aws-codedeploy-deployment-types`; `aws-cross-account-access`; CI/CD in the delivery area.
   **Techniques**: lanes, token, contents, boundary, failure, exchange, caption.
   **Review**: Improved — beat 2 now gives each of the three services its own job on screen, which is what defeats "one tool". Kept the cross-account assumed-role moment; alternative (a single end-to-end run) is the ending. Checked: artifacts via S3, approval action, cross-account roles with a shared customer-managed KMS key, CodeCommit GA again (Nov 2025).

### CodeDeploy deployment types (`aws-codedeploy-deployment-types`)

**The aha**: Lambda versions are immutable and an alias is a movable pointer that can split traffic by weight, which is how canary works; rollback just moves the pointer back.
**Misconception to defeat**: That deploying means overwriting running code.
**Cast**: A Lambda function with version boxes v1, v2; an alias "prod" arrow with a weight dial; an ALB with blue and green target groups (EC2/ECS); a CloudWatch alarm.
**Opening frame**: Alias `prod` pointing at v1, traffic flowing.
**Story**:

1. v2 is published beside v1; nothing changes for users. _"Versions never change."_
2. Canary 10% for 5 minutes: the alias splits 90/10; a small stream goes to v2. _"A slice first."_
3. The alarm watches errors; v2's errors rise, it trips, and the alias returns to 100% v1. _"Rollback = move the pointer."_
4. Retry with a healthy v2: 10% → wait → 100%. _"Then everything."_
5. Compare linear (10% every minute) and all-at-once on tiny graphs. _"Choose the pace."_
6. EC2/ECS: for EC2 an in-place rolling update overwrites instances, or blue/green swaps in a new set; with blue and green target groups, the listener flips traffic to green and blue stays for rollback. _"Same idea at the listener."_ ECS now also has built-in blue/green.
   **The moment**: Beat 3, the alarm flipping the pointer back.
   **Interaction**: Pick canary, linear or all-at-once and inject an error.
   **Ending**: Alias at 100% v2, v1 kept as a fallback.
   **Variants**: `aws-elastic-beanstalk-deployment-policies`; `aws-codepipeline`; release strategies in the delivery area.
   **Techniques**: token, move, stream, dial, failure, side by side, chart, caption.
   **Review**: Improved — beat 6 now includes the in-place option (the one case where code is overwritten, so the misconception is honestly bounded). Kept the alarm-flips-pointer-back moment; alternative (a table of all configurations) lacks drama. Checked: Canary10Percent5Minutes, Linear10PercentEvery1Minute, all-at-once, alias weights, ECS blue/green through listeners, rollback on alarms.

### Elastic Beanstalk environments and deployment policies (`aws-elastic-beanstalk-deployment-policies`)

**The aha**: Each policy trades speed against capacity and safety: all at once has downtime, rolling lowers capacity, rolling with additional batch keeps it, immutable deploys to a fresh ASG, and a URL swap is full blue/green.
**Misconception to defeat**: That "deploy" has one behaviour.
**Cast**: Five panels of four instances each (v1 blue squares, v2 green), a capacity gauge and a time bar under each panel.
**Opening frame**: Five panels, four v1 instances each, 100% gauges.
**Story**:

1. All at once: all four flip to v2 together; gauge drops to 0 during the update. _"Fastest, with downtime."_
2. Rolling: two at a time; the gauge sits at 50%. _"Capacity dips."_
3. Rolling with additional batch: two extra instances join first; the gauge stays at 100%. _"Capacity kept, small extra cost."_
4. Immutable: a fresh ASG of four v2 appears beside the old; once healthy they swap in. If they fail, the new ASG is simply deleted. _"Safest in one environment."_
5. Blue/green: a whole second environment; swap CNAMEs; both URLs flip. _"Full blue/green, instant rollback."_ A footnote adds traffic splitting: immutable plus a percentage of traffic sent to the new fleet first.
6. A failure is injected in each panel: all-at-once and rolling leave a half-broken fleet; immutable and blue/green fall back clean.
   **The moment**: Beat 6, the same failure across five panels.
   **Interaction**: Pick a policy and inject a failure mid-deploy.
   **Ending**: Five panels with speed, capacity, safety ticks.
   **Variants**: `aws-codedeploy-deployment-types`; `aws-auto-scaling-groups`.
   **Techniques**: side by side, meter, restyle, failure, lanes, timer, caption.
   **Review**: Improved — added the fifth Beanstalk policy (traffic splitting) the plan omitted. Kept the same-failure-in-five-panels moment; alternative (animating one policy at a time) hides the comparison. Checked: all at once downtime, rolling dips capacity, additional batch keeps it, immutable fresh ASG, blue/green via CNAME swap.

## AI and machine learning

### Amazon Bedrock (`aws-bedrock`)

**The aha**: You call a model, not a server: pay per token, route across Regions for capacity, reserve throughput only for steady load, and your data stays in your account boundary.
**Misconception to defeat**: That using a foundation model means provisioning GPU servers, or that prompts train the model.
**Cast**: An app sending a prompt; a Bedrock gateway with a model catalogue (Claude, Nova, Llama…); a token counter with coins; inference profile spanning three Regions; model units for provisioned throughput; a boundary around "your account".
**Opening frame**: An app, a Bedrock box with model logos, and no servers.
**Story**:

1. A prompt travels in; a response streams back; a token counter ticks input and output. _"Billed per token."_
2. Swap the model ID: the same call hits another model. _"Switch models by changing a string."_
3. Region eu-west-1 reaches its limit; the cross-Region inference profile sends overflow to eu-central-1 and eu-north-1. _"Spare capacity next door."_
4. A steady 24/7 workload buys model units: a reserved slot appears with flat monthly coins. An overnight job uses batch inference at a discount instead. _"Provisioned: reserved capacity."_
5. The prompt and output stay inside the account boundary; a lock marks "not used to train models". _"Your data stays yours."_
6. A priority service tier: the same token costs more for faster response. _"Tiers trade price for latency."_
   **The moment**: Beat 1-2, the whole thing happens without any server in the picture.
   **Interaction**: Dial token volume and compare on-demand versus provisioned cost.
   **Ending**: Call path with the boundary around it.
   **Variants**: `aws-bedrock-vs-sagemaker`; RAG, agents and guardrails in the AI area.
   **Techniques**: token, meter, boundary, side by side, dial, stream, caption.
   **Review**: Improved — added batch inference, the third billing mode in the catalog next to on-demand and provisioned. Kept the no-server-in-the-picture moment; alternative (EC2 GPU versus API cost race) belongs to the Bedrock vs SageMaker plan. Checked: per-token billing, model ID swap, cross-Region inference profiles, model units, data not used to train, service tiers.

### Bedrock vs SageMaker AI (`aws-bedrock-vs-sagemaker`)

**The aha**: Start on Bedrock (prompting, RAG); move to SageMaker when you must change model behaviour beyond Bedrock's customisation or control cost and latency at the infrastructure level.
**Misconception to defeat**: That they are competing products, or that SageMaker is always the serious choice.
**Cast**: A staircase of control: bottom steps prompting, RAG, fine-tuning on Bedrock; top steps SageMaker training, custom containers, instance choice. A question path on the left. A model import arrow.
**Opening frame**: A staircase labelled "more control, more work", with an app at the bottom.
**Story**:

1. "Can prompting solve it?" yes: Bedrock call. _"Prompt first."_
2. "Needs your documents?" RAG on Bedrock (Knowledge Bases). _"Then RAG."_
3. "Needs model changed beyond that?" Bedrock customisation (fine-tuning, distillation). _"Still Bedrock."_
4. "Own training code, own architecture, own GPUs, strict latency or cost per instance?" Climb to SageMaker; a training job on GPU instances and an endpoint. _"Now you run the infrastructure."_
5. An arrow brings a SageMaker-trained model back into Bedrock through custom model import. _"They connect."_
6. A bar compares effort versus control for each step. _"Climb only when you must."_
   **The moment**: Beat 4, the sudden appearance of GPUs and endpoints you now own.
   **Interaction**: Choose a requirement and the staircase highlights the first step that meets it.
   **Ending**: Staircase with the chosen step lit and the import arrow dotted.
   **Variants**: `aws-bedrock`; `aws-sagemaker-inference-options`.
   **Techniques**: layers, choice, path trace, spotlight, side by side, caption.
   **Review**: Keep — a staircase of control with the GPUs-and-endpoints you now own appearing at the top is a sharper contrast than a feature table, and the import arrow defeats "competing products". Weighed a two-column comparison and rejected it for hiding the order to try things in. Checked: Bedrock covers prompting, Knowledge Bases RAG and customisation; SageMaker AI for training, custom containers and instance control; custom model import back into Bedrock.

### SageMaker AI inference options (`aws-sagemaker-inference-options`)

**The aha**: Match the endpoint to the traffic: real-time for steady low-latency, serverless for spiky small requests, async for long or large ones, batch for whole datasets.
**Misconception to defeat**: That every model should sit on a real-time endpoint.
**Cast**: Four lanes, each with a traffic pattern chart on the left (steady, spiky with idle gaps, large payloads, a whole file), an endpoint box, a cost meter.
**Opening frame**: Four traffic patterns with unlabelled endpoints.
**Story**:

1. Steady stream: a real-time endpoint always on, instant answers, meter runs constantly. _"Always on, always fast."_
2. Spiky: the same endpoint idles 90% of the time, wasting coins. Serverless scales to zero and back, with a brief cold start on the first request. _"Pay only when it's used; accept a cold start."_
3. A 1 GB payload taking 8 minutes: real-time (25 MB payloads, 60 s) refuses it, and serverless (4 MB, 60 s) would too. Async (up to 1 GB, up to an hour) queues the request, processes it and drops the result in S3, scaling to zero when idle. _"Long or large: queue it."_
4. A nightly 10 million-row file: batch transform spins instances up, scores everything, shuts down. _"Whole dataset: batch."_
5. Question path: "Needs an answer in milliseconds?" "Idle most of the time?" "Big or slow?" "Whole dataset?" _"Choose by traffic."_
   **The moment**: Beat 2, the idle endpoint burning coins next to the serverless one at zero.
   **Interaction**: Shape the traffic curve and watch which option is cheapest.
   **Ending**: Four lanes matched to their traffic.
   **Variants**: `aws-bedrock-vs-sagemaker`; `aws-lambda-execution-and-cold-starts`.
   **Techniques**: lanes, chart, meter, side by side, dial, choice, caption.
   **Review**: Improved — added the payload and time limits (real-time 25 MB/60 s, serverless 4 MB/60 s, async 1 GB/1 hour) that actually decide the choice, and fixed beat 3 so it says why real-time and serverless fail. Kept the idle-endpoint-versus-zero moment; alternative (a pure decision tree) lacks the cost image. Checked: cold start on serverless, async scales to zero, batch transform over S3.

## Migration and analytics

### The 7 Rs of migration and AWS's migration tools (`aws-migration-strategies-7rs`)

**The aha**: Each workload gets its own R based on its value and the effort; most estates start with rehost and replatform and refactor later; same-engine database moves need only DMS, changed engines also need schema conversion.
**Misconception to defeat**: That migration means one approach for the whole data centre ("lift and shift").
**Cast**: A data centre with a portfolio of workloads (an old ERP, a web app, a mail server, a database, a dead app); seven destination lanes (Retire, Retain, Rehost, Relocate, Repurchase, Replatform, Refactor); tools icons (Application Migration Service, DMS, Schema Conversion Tool).
**Opening frame**: A grid of seven workloads (dead app, mainframe, mail server, web app, VMware cluster, Oracle database, ERP monolith), each with a value/effort tag, and seven closed doors.
**Story**:

1. Each workload gets sorted in turn: the dead app → Retire; the mainframe with licence limits → Retain; mail server → Repurchase (SaaS). _"Not everything moves."_
2. The web app → Rehost: a copy of the server lifts into EC2 through Application Migration Service replication. _"As-is, fast."_
3. VMware cluster → Relocate to VMware Cloud on AWS or Amazon EVS. _"Hypervisor move."_
4. Oracle → RDS Oracle (Replatform): DMS replication keeps both in sync, then cut over. _"Same engine: DMS is enough."_
5. Same database, other route, Oracle → Aurora PostgreSQL: a schema-conversion station appears before DMS. _"New engine: convert the schema too."_
6. ERP monolith → Refactor into services: a long bar, high effort, high payoff. _"Biggest effort, biggest reward."_
7. Chart: most workloads on the left of an effort axis; refactor later. _"Start easy, refactor later."_
   **The moment**: Beat 1-6, the same estate leaving by seven different doors.
   **Interaction**: Drag a workload between lanes and see effort and benefit change.
   **Ending**: Portfolio mapped to doors.
   **Variants**: `aws-hybrid-storage-and-data-transfer`; `aws-multi-region-databases`.
   **Techniques**: lanes, move, clone, token, side by side, meter, choice, caption.
   **Review**: Improved — the opening said six workloads while the story moves seven; it now shows seven workloads and seven doors so each R gets exactly one, with the Aurora case a variant of the Oracle one. Added Amazon EVS beside VMware Cloud on AWS for Relocate. Kept the estate-leaving-by-seven-doors moment; alternative (a decision tree) is weaker than seeing one estate split. Checked: MGN replication for rehost, DMS homogeneous vs heterogeneous with schema conversion, AWS Transform for assessment.

### Data lakes on S3: Glue, Athena and Lake Formation (`aws-s3-data-lake`)

**The aha**: Storage and compute are separate: a catalog turns files into tables any engine can query, so you store once and pay per query; partitioning and columnar formats keep Athena fast and cheap.
**Misconception to defeat**: That querying needs a database holding the data.
**Cast**: An S3 bucket of folders and files; a Glue crawler and Data Catalog (table definitions); Athena as a query box; Lake Formation as a permissions layer; a "bytes scanned" coin meter.
**Opening frame**: A bucket of raw CSV files in folders, no tables.
**Story**:

1. A Glue crawler samples files and writes a table definition into the Data Catalog. The files are untouched. _"A catalog gives files a schema."_
2. Athena runs SELECT; it reads the catalog and scans the files directly; the meter counts bytes scanned. _"Pay per data scanned."_
3. Query on a full CSV: scans 1 TB; meter jumps (Athena charges about $5 per TB scanned: $5). _"Expensive, slow."_
4. Convert to Parquet (or Iceberg tables on S3): columns stored together; the same query touches two columns and scans 40 GB, about $0.20. _"Columnar: read only what you need."_
5. Partition by date (folders `dt=2026-10-09`): the query with a one-day filter skips about nineteen of every twenty folders. Scan 2 GB, about a cent. _"Partitions: skip folders."_
6. A second engine (EMR or Redshift Spectrum) queries the same table. _"One copy, many engines."_
7. Lake Formation: a column-level grant hides an email column from analyst B. _"One place for permissions."_
   **The moment**: Beat 3 to 5, the scan meter dropping from 1 TB to 2 GB for the same answer.
   **Interaction**: Toggle CSV/Parquet and partitions and watch bytes scanned and cost.
   **Ending**: Bucket, catalog and engines, a small meter.
   **Variants**: `aws-purpose-built-databases`; data lake and warehouse concepts in the data area.
   **Techniques**: contents, zoom, meter, side by side, toggle, dial, boundary, caption.
   **Review**: Improved — put dollar figures on the meter (about $5/TB scanned) so 1 TB, 40 GB and 2 GB read as cost, and named Iceberg beside Parquet as the catalog does. Kept the 1 TB to 2 GB drop as the moment; alternative (database versus lake) is a different concept. Checked: crawler writes catalog only, Athena reads files in place, columnar and partitions cut scans, Lake Formation column grants.
