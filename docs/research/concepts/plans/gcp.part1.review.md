# Google Cloud plans, part 1: review summary

**Verdicts (33 plans)**: 31 Improved, 2 Keep (`gcp-private-service-connect`, `gcp-network-service-tiers`),
0 Rethought, 0 Merged.

## Most important changes

- `gcp-iam-roles`: Owner was bound on a bucket, but basic roles can't be granted on a resource; the frame is now a project.
- `gcp-organization-policy`: "no IAM check runs" was wrong (IAM passes, then the constraint blocks), the sibling project could not escape an org-level constraint, and the named deny-policy confusion is now defeated by a contrast beat.
- `gcp-service-accounts`: Service Account User permits attaching the account to something you run, not calling APIs as it; service-agent role removal succeeds and breaks the service rather than bouncing.
- `gcp-vpc-peering`: A's packet never reaches B's edge; A has no route to C, so the moment is the missing table row.
- `gcp-network-connectivity-center`: the hub is a route-exchange hub, not a data-path box; packets now go direct (same control-plane lesson as Cloud Router).
- `gcp-vpc-routing`: the regional/global dynamic routing mode is a VPC setting, not a Cloud Router one.
- `gcp-cloud-dns-private-hybrid`: the `35.199.192.0/19` gotcha belongs to the forwarding-zone direction, not the inbound policy.
- `gcp-cloud-interconnect`: a single connection has no SLA; 99.9% needs two, 99.99% four across two metros.
- `gcp-backup-dr`: snapshots survive disk deletion; the weakness is same project, same admins.
- `gcp-lb-anatomy`: backend buckets hang off the URL map, not a backend service.
- `gcp-proxy-vs-passthrough-lb`: the layer 4/7 misconception was never shown; added a 2x2 grid with the proxy Network LB.
- `gcp-application-default-credentials`: the `gcloud auth login`-only failure replaces a beat that never defeated the misconception.
- Smaller: SSO signs in an account that already exists (`gcp-cloud-identity`); auto mode's real flaw is range collision (`gcp-global-vpc`); Cloud CDN added to the ALB plan; Adaptive Protection proposes rules (`gcp-cloud-armor`); NAT exhaustion is per destination; HA VPN failover is minute-scale, not seconds.

## Patterns for the platform

- **Binding ribbons that inherit** (fainter copies on descendants, greyed and read-only below the source) appear in nine plans, in IAM, org policy, firewall policy and tags; needs a first-class "bind with propagation" with distinct colours per layer (IAM, org policy, deny, tags).
- **Ordered gates**: a request walking a stack of checks and stopping at one (IAM then org policy; PAB, deny, allow; firewall priority stack; ADC search list; LB chain). One reusable "pipeline with stop point" component would serve all.
- **Routing tables as visible state**: peering, NCC, Cloud Router and DNS all turn on a row appearing or missing in a table. Packets should be drawn as following table rows, with control plane (rows) and data plane (packets) visibly separate.
- **Resource-scope frames**: map, region, zone, global VPC, project frames needing zoom and stretch ("frame grows to include a new region").
- **Failure injection and countdowns**: flash a zone red, expire a token, retention timer, 30-day delete, TTL. A shared timer/failure vocabulary.
- **Side-by-side with a synced token** against AWS or a "wrong model" is used in most networking plans.
- **Meters per entity** (NAT ports per VM, quotas per project, SLA meter, latency/cost meters).
