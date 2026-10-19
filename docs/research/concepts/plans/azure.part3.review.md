# Azure part 3 review

Verdicts (32 plans): Keep 0, Improved 32, Rethought 0, Merged 0.

## Most important changes

- Messaging decision: Storage Queues now has its own lit leaf and limits (64 KB, no ordering, no DLQ); the choice reads as four, not three.
- Monitor data platform: resource logs moved from a VM (which has none) to a Key Vault, with the "who read the secret?" incident.
- Service Health: a single host failure is Resource Health only; a regional incident is what lights Service Health and Azure status.
- Event Grid: carries a small notice, not the data; Event Hubs no longer called a queue.
- API Management: beat 1 routed to v2 and beat 5 "swapped to v2"; now v1 to v2. Added the Front Door/App Gateway contrast.
- Key Vault: an Owner can't read but can grant itself a role (logged); not "bounces forever".
- App Configuration: targeting is per user, so one instance serves two users (not two instances differing).
- Defender for Cloud: attack paths are the paid Defender CSPM tier, not free posture.
- Sentinel: not a "Defender product" set; a third-party CEF source shows cross-vendor correlation.
- Encryption: revocation isn't instant (cached keys); Managed HSM got a beat.
- Backup: attacker disables soft delete first; approver is a Resource Guard.
- Site Recovery: recovery plans order machine groups, not networking.
- ARM/Bicep: ARM re-applies the whole file and providers no-op; what-if is the diff.
- Deployment stacks: deny settings guard managed resources, they don't block new ones.
- Arc: resource-group tags are not inherited; Policy applies the tag.
- Content safety: blocked prompts come back as a rejected request, blocked output as a flagged finish reason.
- AI Search: the security filter is a query-time filter, not a post-trim.
- KQL: column names DurationMs/Name; Logic Apps: designer does have loops (contrast reworded).

## Patterns for the platform

- Replay of the identical incident with one setting toggled (monitor, backup, pricing, deployment modes) is the dominant "moment"; needs a snapshot/rewind-and-replay mechanism.
- Same traffic through two configurations side by side (deployment types, Standard vs PTU latency, shielded vs unshielded).
- Boundary frames with badges (RBAC, Policy, network, deny settings) around a resource, and a token bouncing at the data-plane door.
- Decision-path (choice) lighting leaf icons; tokens with distinct shapes (dot, envelope, stream).
- Meters with lag (cost data, key-cache expiry) and timers (lock ring, retention fade).
- Ranked-list pipelines with reordering and filtering stages (RAG, KQL row-thinning).
