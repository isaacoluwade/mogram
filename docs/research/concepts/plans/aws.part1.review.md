# AWS part 1: review summary

33 plans reviewed: 27 Improved, 4 Rethought, 2 Keep, 0 Merged.

## Most important changes

- `aws-scps-and-rcps` (Rethought): the SCP gate now shows the standing `FullAWSAccess` Allow (SCPs need an Allow, not an "implicit pass"); the no-Allow case uses `GetObject`, not an already-denied action; RCPs, half the title, finally get a beat.
- `aws-account-and-root-user` (Rethought): centralized root access deletes member root credentials and lends short-lived root sessions; the old plan "routed the keys" to the management account.
- `aws-cross-account-access` (Rethought, beats 3-5): a resource policy alone does not admit a cross-account caller; the ExternalId story is now the real confused-deputy attack (another customer supplies your role ARN).
- `aws-eks-pod-identity-vs-irsa` (Rethought): by default pods can reach the node role, so the opening shows the leak instead of a bounce.
- `aws-data-perimeter`: stolen credentials from our own role are stopped by the network gate, not a "foreign org" gate; exfiltration to an outside bucket added.
- `aws-iam-policy-evaluation-logic`: Deny is caught by the first, explicit-deny scan; SCP/RCP gates no longer "implicitly pass".
- `aws-resource-scope`: global services keep serving when a Region fails but their control planes lean on us-east-1; snapshot vs AMI fixed.
- `aws-internet-gateway-vs-nat-gateway`: egress-only IGW added; NAT failure layouts compare single zonal, per-AZ zonal and regional NAT correctly.
- `aws-global-accelerator-vs-cloudfront`: contrast is DNS-TTL failover vs static-IP failover, not "CloudFront relies on DNS".
- `aws-centralized-traffic-inspection`: appliance mode pins a flow to one AZ's path, not an exact endpoint.
- Several named-but-undefeated misconceptions got a beat or were dropped (IAM users counter in Identity Center and federation, Client VPN laptop, CloudTrail ledger, security group left standing in WAF and inspection).

## Patterns for the platform

- Gate-row evaluation (request card through ordered gates, stamp and blackout on Deny) is reused by SCPs, RCPs, evaluation logic, data perimeters and policy anatomy; it needs per-gate state (open / narrows / denies / unreached).
- "Same input, one switch flipped" side-by-sides (identical packet, request or name) carry most of the moments; toggles must re-run the same animation.
- Counters and ledgers as proof objects ("IAM users: 0", flow-log rows, CloudTrail rows, 10 vs 5 peerings) defeat misconceptions better than captions.
- Nested frames (Org > OU > Account; Region > VPC > AZ > subnet) must refuse illegal drops (snap back, bounce).
- Timers on credentials and TTLs recur everywhere; one reusable countdown element serves STS, DNS and Route 53.
- Failure injection per frame (AZ, Region, us-east-1) with per-resource survival rules.
- Plans mixing 3+ ideas (resource scope, NAT, compute credentials) run long; the platform may want a "chapter" split rather than a longer single run.
