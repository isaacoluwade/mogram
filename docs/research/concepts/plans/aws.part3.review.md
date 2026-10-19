# AWS part 3, stage-3 review summary

Verdicts (38 plans): Keep 6, Improved 32, Rethought 0, Merged 0.

Keep: KMS envelope encryption, CloudTrail, Secrets Manager vs Parameter Store, Cognito pools, DR strategies, Bedrock vs SageMaker.

## Most important changes

- CloudFormation: keeping the old resource on replacement is `UpdateReplacePolicy`, not `DeletionPolicy`.
- KMS key policies: the misconception was wrong in the common case (the default key policy delegates to IAM). Beats now show delegation, its removal, then cross-account needing both sides.
- ACM: exportable public certificates exist, so "cannot be installed on EC2" was out of date.
- SNS fan-out: SNS retries per a delivery policy; the claim "SNS doesn't store" now reads "retries, then forgets".
- SQS DLQ: a message moves when it would be received more than maxReceiveCount times, not on the third receive.
- X-Ray: added the SDK-maintenance / OpenTelemetry (ADOT) path from the catalog; the SQS carrier is the AWSTraceHeader system attribute; real default sampling rule.
- Kinesis/Firehose: buffer defaults are 5 MB / 300 s, not 1 MB / 60 s.
- Number fixes: Multi-AZ load maths now adds up (3 x 66 / 2 = 99; twelve instances at about 50% give 75%); m5.4xlarge to m5.large is an eighth of the price, not half; 7 Rs opening said six workloads while seven move.
- Security Hub split (CSPM vs new Security Hub) added; EC2 purchasing: zonal RIs do reserve capacity.
- EventBridge: duplicate beats merged. SQS vs SNS vs EventBridge: added an outage beat so durability is a contrast.
- ARC: the "readiness board" is not in the catalog's description of ARC (zonal shift, routing controls, Region switch plans); recast as a pre-flight check and a Region switch plan. Writer should confirm whether readiness checks are still offered.

## Patterns for the platform

- Same-input-through-each-option lanes (queue/topic/bus, REST/HTTP/WebSocket, deploy policies, DR tiers, inference endpoints) recur in more than a third of the plans: needs a "parallel lanes with shared input" layout and synchronised failure injection.
- Gauges with thresholds and units (quotas, throttles, load per AZ, scan bytes, coin meters) are everywhere; they need numeric meters tied to a dial the viewer controls.
- Truth-table toggles (KMS policies, ACM service by Region, data events) want a small "switches to outcome" widget.
- Before/after rewinds (SNS outage replay, ransomware vault, same-attack-twice) need a rewind-and-replay primitive.
- Region and account frames with a refusal at the boundary (ACM, KMS, cross-account pipelines) need a boundary that can block a token visibly.
- Decision paths ("which service") need a question path that lights a destination.
- Time-aware items: expiry rings, timers, visibility timeouts, scheduler clocks.
