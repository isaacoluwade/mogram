# Networking part 3: review summary

25 plans reviewed: **23 Improved, 2 Merged, 0 Keep, 0 Rethought.**
Merged: `zero-trust-network-access` (to Security's `ztna-vs-vpn`), `latency-bandwidth-throughput`
(to Scaling's `latency-vs-throughput`). `bastion-host` is kept here and folds in Security's
better beats (before/after port scan, session recording).

## Most important changes

- `vpc-route-tables`: removed a false beat (a subnet could not reach another subnet in the same
  VPC "for lack of a row"; the implicit local route always allows it) and corrected "/24 beats /16".
- `security-groups`: the plan blocked outbound traffic as if that were the default (AWS allows all
  outbound by default); now the outbound list is explicitly emptied, and allow-only is taught.
- `hub-and-spoke`: the spoke-to-spoke routes belong in the spokes' route tables (next hop the hub
  firewall), not in the hub's table.
- `stateful-firewall`: asymmetric return was shown as harmless; now the firewall's row sticks at
  SYN_SENT and later packets are dropped, and a stateless side-by-side defeats "stateful is better".
- `point-to-site-vpn`: clients get addresses from a separate client pool, not the VPC range.
- `service-endpoints`: replaced "ping the service" (storage doesn't answer ping) with "connect to the
  same public address and be refused by the rule".
- `private-endpoint-dns`: a hard-coded private IP fails TLS and hostname routing immediately; it
  doesn't "work today".
- `private-endpoints`: per-resource mapping is Azure's; AWS interface endpoints map to a service.
- `bastion-host`: only agent-based tools (Session Manager) are outbound-only; Azure Bastion and IAP
  still have a managed listening front door.
- `round-trip-time`: the 230 ms figure mixed viewpoints; now 2 RTT (180 ms) before the request,
  3 RTT (270 ms) to the first byte. The "1 ms per 100 km" label is round trip.
- `packet-loss-and-jitter`: recovery after loss is congestion avoidance, not slow start.
- `ping-and-traceroute`: TTL lives in the packet, not the router; a "silent hop" doesn't send
  time-exceeded rather than "drops ICMP".
- `network-troubleshooting-by-layer`: added timeout vs refused; reachability doesn't show listening.
- `flow-logs`: REJECT rows have bytes; added the aggregation delay and the NACL signature
  (ACCEPT inbound, REJECT on the reply).
- `transit-gateway`: replaced the misleading cost ticker with link count (6 peerings vs 4
  attachments) and added a beat that shows it does not inspect.
- `vpc-peering`: routes are needed on both sides; non-overlapping CIDRs.

## Patterns for the platform

- **Route-table cards as the main actor.** Nine of these plans turn on one row in a route table
  (add, remove, move the card to another subnet, longest prefix wins). It needs a table element
  with row-level highlight, add/remove/reorder, and packets that follow the matched row.
- **Rule lists with first-match, plus state.** Security groups, NACLs, firewalls and flow logs all
  need an ordered rule card, a state table, and packets that tick or bounce. One reusable "filter"
  element with a stateful/stateless switch would serve four plans.
- **The same packet, two outcomes.** Most moments are an identical packet resolved differently by
  one changed thing. The platform wants a cheap "replay with a change" control.
- **Ladders with a time scale.** RTT, IKE, TCP state and TTL probes need a ladder diagram whose
  vertical axis is real time (distance sets slope) and with totals that recompute.
- **Meters tied to a cause.** Congestion dial to throughput and latency; loss dial to the window;
  jitter dial to the buffer.
- **Absences as evidence.** Flow logs (missing row), traceroute (`* * *`) and "refused vs timeout"
  all teach by what does not appear, so the log and probe elements must be able to show a gap.
- **Platform differences.** Several concepts differ by cloud (private endpoints, bastion, Azure's
  default outbound access, NSG flow logs). A small "in AWS / in Azure" caption slot beats forking
  the plan.
