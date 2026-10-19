# Architecture part 2: review summary

**Verdicts (35 plans)**: 33 Improved, 2 Rethought (`api-styles`, `clean-architecture`), 0 Keep. Plus one Merged stub (`service-discovery`, owned by Networking, not a plan in this file).

`api-styles` and `service-mesh` stay owned here; Networking's `rest-graphql-grpc` and Containers' `k8s-service-mesh` merge into them (same-task framing, gRPC connection pinning, gRPC-Web, rogue-pod mTLS bounce, NetworkPolicy contrast, latency cost, ambient-mode link).

## Most important changes

- `clean-architecture`: the old "calls flow in, so do dependencies" was wrong; rebuilt around two arrow types (runtime call vs source dependency) so the dependency inversion is the moment.
- `sidecar-pattern`: a crashed app does not restart its sidecar in Kubernetes; shared fate is scheduling, scaling and deletion. Beat rebuilt.
- `api-versioning`: the tolerant-reader beat was incoherent; now an additive change breaks a strict client, a rename needs a second version, sunset beside zero-usage.
- `api-styles`: rebuilt as one task in three styles, with each style's price and choose-by-consumer interaction.
- `synchronous-call-chain`: retry misconception now defeated (retries multiply load at the failing hop); arithmetic checked.
- `service-mesh`: data plane keeps working when the control plane is dark; retry no longer "reroutes".
- `deployment-stamps`, `geode-pattern`, `compute-resource-consolidation`: contradictions or overclaims fixed (stamp created while another was empty; instant fresh reads and "no DNS change"; utilization arithmetic).
- `architecture-characteristics`: removed the false claim that microservices are better at security and availability.
- `database-decomposition`: added the lost cross-database transactions (sagas).
- Cost made visible everywhere (hop and single point of failure for gateway, config blast radius, premium bill, idle baseline per stamp).

## Patterns for the platform

- A persistent "price tag" slot in the layout (a meter or card for the cost of the pattern), used by nearly every plan here.
- Two kinds of arrow on one diagram (runtime call vs compile-time dependency; data plane vs control plane; north-south vs east-west).
- Side-by-side with a synchronized shared timeline and live-computed meters (latency adds, availability multiplies, utilization sums).
- Fan-out of one edit to many instances (control-plane push, config store, routing table), with a "bad value hits all" failure mode.
- Clone-whole-stack (stamps, geodes, versions side by side) with a lookup table and a capacity meter.
- A timeline strip with traffic bands that shrink to zero (strangler fig, API versions, migration bridges).
- Zoom into an element, including nested frames that keep their context (C4, the gateway, the arrow in the fallacies).
- Chart with a draggable marker and a clearly labelled "illustrative" tag (microservice premium, characteristics radar).
