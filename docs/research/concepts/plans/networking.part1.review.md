# Networking part 1: review summary

31 plans reviewed: **29 Improved, 1 Keep, 1 Merged, 0 Rethought.**

- Keep: `ip-address`.
- Merged: `control-plane-vs-data-plane` (owned by Fundamentals; it should borrow the stale-routes caveat, the management-plane distinction and a router as a second example).

## Most important changes

- `routing-table`: the "more specific" row (10.0.1.128/25) did not contain the destination 10.0.1.50; now 10.0.1.0/26.
- `tcp-reliability`: only two duplicate ACKs were possible with segments 1-5 yet "three" was captioned; now six segments, and a real tail-loss contrast.
- `tcp-handshake`: the first byte reaches the server at 240 ms (the client is ready at 160 ms), not 160 ms; TLS stacking added.
- `bgp`: the "different AS-path lengths" were equal, so policy-over-distance was unprovable; now a shorter provider path loses to a customer route. RPKI added.
- `bgp-path-selection`: the "less-specific prefix" shortcut was drawn in the wrong direction.
- `cidr-and-subnetting`: summary maths fixed (four blocks fill a /25), the ending no longer claims a fully subdivided /24, and 254-vs-251 shown.
- `ip-address-planning`: the identical-address packet replaced by the real failure (the local route swallows it).
- `nat`: the "inbound hits :40001 and finds no row" slip fixed; DNAT now shows NAT is not a firewall.
- `snat-port-exhaustion`: a private-IP database destination replaced by a public API; the 64,000 / 60 s = ~1,000 connections/s arithmetic added.
- `overlay-networks`: wrong "controller turns broadcasts into unicast" claim replaced (hosts answer ARP locally, other broadcast dropped); the outer header (UDP 4789, VNI) shown.
- `tcp-flow-control`: link pinned at 50 Mbit/s so the numbers add up; a real zero-window flow-control moment added.
- `mac-and-arp`: R1's own ARP on the far side was missing; TTL nuance admitted.
- `tcp-connection-teardown`: TIME_WAIT pile moved to the client/NAT that actually runs out of ports; an instant "connection refused" RST used against silence.

Pattern across the area: misconceptions were named in the "Misconception" line but not defeated by a beat in about half the plans (osi, encapsulation, public-vs-private, default-gateway, routing-table, static-vs-dynamic, nat, tcp-handshake, tcp-keepalive, quic); each now has one.

## Patterns for the platform

- **Ladder diagrams** with a running clock (handshake, DORA, teardown, QUIC, keepalive): lifelines, slanted timed arrows, a clock that can be dragged (RTT).
- **Packet with editable header bands**: stacked, wrapped, peeled and rewritten per hop (encapsulation, MAC/ARP, tunneling, overlays, NAT). The band stack is the core object; the IP band and Ethernet band are separately addressable.
- **Table cards beside devices** with row matching and a live highlight (routing, NAT, ARP, IPAM, host table), editable by the viewer, including shuffling.
- **Dial driving a live formula** (CIDR slider, window / RTT, ports / hold time, prepending length) with the working numbers shown.
- **Scalar charts over round trips** (cwnd sawtooth, throughput) overlaying alternatives (Reno vs BBR).
- **Split-screen same-fault comparison** (MTU with and without ICMP, static vs dynamic, HTTP/2 vs HTTP/3, NAT vs firewall) with one shared failure injected on both sides.
- **Timers that fire silently** (NAT idle, lease, TIME_WAIT, RTO) and a "fast-forward" control.
- **Bit-level address view**: 32 bits with a draggable prefix divider, 256-square blocks, and summary highlighting.
- **Boundary boxes with identical contents** (private ranges, tenants with the same CIDR) viewed in logical and physical modes.
