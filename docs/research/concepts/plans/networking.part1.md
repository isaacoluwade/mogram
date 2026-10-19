# Networking plans, part 1

Stage 2 plans for `catalog/networking.md` groups 1 to 4, in catalog order. These plans share one
visual language with parts 2 and 3 of this area: hosts are small computers or servers with their
IP address as a label; a packet is a small envelope whose header fields are visible (src, dst,
port, TTL) and can be wrapped in an outer envelope (encapsulation) and unwrapped hop by hop;
layers are horizontal strata (application at the top, physical at the bottom) that a packet
descends on send and climbs on receive; routers are round junctions with a small routing-table
card beside them, the matching row lit; the internet is a cloud in the middle; time-ordered
exchanges (handshakes, request/response) are ladder diagrams, each party a vertical lifeline with
its name on top, messages as slanted arrows travelling down the page in order (time flows
downward), the current one highlighted; loss is a packet bursting mid-flight; latency is visible
as how long an arrow takes to cross. A subnet or network is drawn as a boundary box; a routing or
NAT table is a small card of rows beside the device that owns it, with the matching or active row
glowing; a meter or dial shows a changing number (throughput, port count, window size, cost) and
can usually be dragged by the viewer to see cause and effect live.

No new technique was needed for this part; everything maps onto the vocabulary in the README.

## 1. Models and packets

### OSI and TCP/IP layer models (`osi-model`)

**The aha**: Each layer does one job and only talks to the layers directly above and below it;
"L4" and "L7" say how deep a device looks into traffic, and that decides what it can route or
filter on.
**Misconception to defeat**: That OSI is what's actually running (it's a teaching model) and that
layers 5 and 6 are separate real protocols you'd meet in the wild.
**Cast**: Two full 7-layer stacks (laptop, server) joined by a wire at Physical. Beside them, a slimmer 4-layer TCP/IP stack with dashed lines showing which OSI layers fold into which: layers 5, 6 and 7 into one Application box, layers 1 and 2 into one Link box.
**Opening frame**: Laptop and server, each a 7-layer stack, wired only at the bottom. _"Every
device runs the same stack."_
**Story**:

1. A packet appears at the laptop's Application layer, captioned "GET /page", and descends, gaining a header band at each layer. _"Each layer adds its own header."_
2. It crosses the wire at Physical.
3. It climbs the server's stack, shedding bands in reverse, until the bare payload reaches Application. _"The receiver climbs back up, unwrapping as it goes."_
4. A switch appears mid-wire, lit only through Data Link. _"A switch reads only layer 2."_
5. A router replaces it, lit through Network. _"A router reads up to layer 3."_
6. Side by side: an L4 device lit to Transport ("sees IPs and ports") and an L7 device lit to Application ("sees the URL and headers").
7. The 7-layer stack fades into the slimmer 4-layer one: Session and Presentation melt into Application (TLS and HTTP both sit in that one box), Physical and Data Link merge into Link. _"OSI teaches it in seven; the internet runs it in four. There is no 'session protocol' to find."_
   **The moment**: Beat 6, the two devices lit to different ceilings on the identical stack — depth
   of inspection shown directly as height.
   **Interaction**: Click a device (switch, router, L4 balancer, L7 proxy) to see how high its lit
   layers reach and what it can decide on.
   **Ending**: The L4 and L7 devices side by side, each lit to its own ceiling, full header stack
   visible beneath.
   **Variants**: `encapsulation`, `control-plane-vs-data-plane`, `mac-and-arp`.
   **Techniques**: layers, token, restyle, spotlight, side by side, caption.
   **Review**: Improved — cast and beat 7 now show layers 5 and 6 dissolving into Application (the misconception was named but never defeated on screen), and beat 6's L4 device now "sees IPs and ports" (ports alone is wrong). Weighed a build-up-one-layer-at-a-time framing; worse, since the lit-to-a-ceiling contrast is the memorable part. Checked: L2 switch, L3 router, L4 = IP+port, L7 = URL/headers.

### Packets and encapsulation (`encapsulation`)

**The aha**: Each layer wraps the payload in its own header on the way down, and each device
along the path only reads the header for its own layer.
**Misconception to defeat**: Confusing encapsulation (each layer adds its own header around the data) with tunneling (a whole finished packet becomes the payload of another).
**Cast**: One host's 4-layer stack. A payload envelope "GET /page". A switch, a router, a
destination server as waypoints.
**Opening frame**: The envelope sits bare at Application. _"Just the data, so far."_
**Story**:

1. Descending to Transport, a band wraps it: "TCP: src port 51234, dst port 443." _"Transport header: ports."_
2. Descending to Internet, another band: "IP: src 10.0.1.5, dst 93.4.2.1." _"Network header: addresses."_
3. Descending to Link, the outermost band: "Ethernet: src/dst MAC." _"Link header: this hop only."_
4. At a switch, only the outer band is read and the frame is forwarded unopened. _"The switch reads the outside wrapper only."_
5. At a router, the Ethernet band is peeled off, the IP band read, and a fresh Ethernet band wrapped for the next hop. _"The router opens one layer deeper, and re-wraps it."_
6. At the destination, bands peel off in reverse until the bare payload reaches Application. _"The receiver unwraps in reverse order."_
7. A meter ticks: "payload 1400 B + headers 54 B (14 Ethernet + 20 IP + 20 TCP)." _"Every packet pays this overhead, every time."_
8. Contrast: a whole finished packet, bands and all, drops into the payload of a new outer packet. _"Wrapping a whole packet is something else: tunneling."_
   **The moment**: Beat 5 — the router opening exactly one band and re-wrapping a fresh one, one
   layer deeper than the switch.
   **Interaction**: Step wrap/unwrap one layer at a time; toggle which device touches the packet to
   see how many bands it opens.
   **Ending**: Bare payload restored at the destination's Application layer, overhead meter settled.
   **Variants**: `osi-model`, `tunneling`, `mac-and-arp`.
   **Techniques**: layers, token, contents, restyle, spotlight, meter, caption.
   **Review**: Improved — added beat 8 so the encapsulation-vs-tunneling misconception is defeated on screen, and the overhead meter now adds up (14+20+20 = 54). Weighed Russian-doll nesting as the lead image; worse for this plan because it blurs into tunneling. Checked: switch reads L2, router rewrites L2 and reads L3, receiver unwraps in reverse.

### MAC addresses and ARP (`mac-and-arp`)

**The aha**: IP gets a packet across networks; MAC gets it across one hop. The IP addresses stay the same end to end while the frame's MACs are rewritten at every router, and ARP only ever reaches your own subnet.
**Misconception to defeat**: Thinking MAC addresses matter the whole way, or confusing switches
(forward by MAC) with routers (forward by IP).
**Cast**: Host A (IP 10.0.1.5, MAC AA), a switch, router R1 (10.0.1.1 with MAC BB facing A, MAC CC facing B), Host B (IP 10.0.2.9, MAC DD) on another subnet. A packet with an inner IP band (addresses fixed) and an outer Ethernet band (rewritten each hop).
**Opening frame**: Host A knows B's IP but not its MAC, and B sits across a router. _"ARP only reaches your own subnet, so A never asks for B's MAC."_
**Story**:

1. A sees 10.0.2.9 is off-subnet, so it asks for its gateway instead: broadcast "Who has 10.0.1.1?"; R1 answers "MAC BB". _"ARP: broadcast on the local link, cache the answer."_
2. A sends: IP band (src 10.0.1.5, dst 10.0.2.9) and Ethernet band src AA, dst BB. The switch in between forwards the frame untouched. _"Addressed to the router's MAC, but to B's IP."_
3. R1 strips the Ethernet band, reads the IP band, then ARPs on B's side for 10.0.2.9 ("DD") and wraps a new frame (src CC, dst DD). The IP addresses are untouched; only TTL ticks down by one. _"The router rewrites the frame; the addresses don't change."_
4. At Host B, the MAC matches and it accepts. Spotlight: the same IP band beside its two different Ethernet bands. _"Same IP addresses, two different frames."_
5. A second router is added; the Ethernet band is rewritten again, the IP band still identical. _"Switch: forwards the frame. Router: replaces it."_
   **The moment**: Beat 4 — the IP header frozen since departure while the Ethernet header is
   already on its second incarnation.
   **Interaction**: Add more hops and watch the Ethernet band rewritten every time while the IP band
   never changes; trigger ARP to see the broadcast and cached answer.
   **Ending**: The full path as a strip of Ethernet-band versions under one unbroken IP band.
   **Variants**: `encapsulation`, `default-gateway`, `routing-table`.
   **Techniques**: token, contents, restyle, spotlight, path trace, caption.
   **Review**: Improved — the old plan skipped R1's own ARP for B (so the frame's second hop appeared from nowhere) and the opening question mark was unreadable; now ARP is shown on both sides, the switch-vs-router misconception is on screen (beats 2 and 5), and the TTL decrement is admitted so "IP header never changes" is accurate (addresses never change). Weighed leading with the switch's MAC table; worse, ARP is the surprise. Checked: ARP is broadcast and same-subnet only.

### MTU, MSS and fragmentation (`mtu-and-fragmentation`)

**The aha**: MTU is the biggest packet a link will carry (MSS is the TCP payload that fits: MTU minus 40 bytes of IP and TCP headers). When ICMP is blocked, Path MTU Discovery fails silently, so small requests work and big ones just hang.
**Misconception to defeat**: That MTU is about bandwidth, not packet size.
**Cast**: Sender, receiver, three links of different MTU (1500, 1400 through a tunnel, 1500). A
packet drawn as a bar whose width shows byte count.
**Opening frame**: Sender and receiver, three links, each with its MTU ruler shown. _"Every link
has a size limit."_
**Story**:

1. A 1500-byte packet (40 B headers + 1460 B data, "Don't Fragment" set) crosses the first link fine. _"MTU 1500: biggest packet this link carries, headers included."_
2. At the tunnel link (ruler 1400) the bar doesn't fit; the router drops it and an ICMP "fragmentation needed, MTU 1400" bounces back. _"Path MTU Discovery: the network tells you to shrink."_
3. The sender resends at 1400 (MSS 1360); it fits everywhere now. _"Resized once, works from then on."_
4. Aside: with DF clear, the router would split the packet into two fragments, reassembled only at the destination. _"Fragments are slow, and losing one loses the whole packet. TCP sets DF instead."_
5. Rewind: same scenario, but a firewall swallows the ICMP reply (red flash). The sender keeps retransmitting 1500-byte packets that silently vanish at the tunnel. _"No ICMP, no warning, it just hangs."_
6. Side by side: a short request (handshake and GET both under 1400) succeeds instantly on the blocked path; a large transfer hangs forever. _"Small requests work. Big ones don't. Looks like nothing's wrong."_
7. Fix: MSS clamping at the tunnel entrance rewrites the MSS in the SYN to 1360. _"Tell them the right size before they try."_
   **The moment**: Beats 5-6: identical setup, only ICMP blocked, and the same large transfer goes from fine to hangs-forever while small requests are unaffected.
   **Interaction**: Toggle "block ICMP" and watch the large-transfer outcome flip; drag the tunnel's
   MTU and watch the clamp value follow.
   **Ending**: MSS clamp in place, large transfer completing even with ICMP still blocked.
   **Variants**: `encapsulation`, `tunneling`, `tcp-flow-control`.
   **Techniques**: meter, token, failure, side by side, dial, caption.
   **Review**: Improved — added fragmentation (it was in the title but never shown), put numbers on MSS (1400 - 40 = 1360) so the clamp adds up, and explained why small requests survive (they fit under 1400). Weighed a pipe-width metaphor; worse, it feeds the exact bandwidth misconception to defeat. Checked: DF + ICMP type 3 code 4, MSS = MTU - 40, black-hole symptom.

### Tunneling (`tunneling`)

**The aha**: A tunnel is an envelope inside an envelope — the outer header crosses the network in
between, and the inner packet arrives as if the two ends were directly wired together.
**Misconception to defeat**: That tunneling means encryption (a VPN is a tunnel plus encryption
and authentication; GRE has none).
**Cast**: Site A and Site B, private IPs, separated by the internet cloud. A packet addressed
192.168.1.5 → 192.168.2.9. A larger outer envelope.
**Opening frame**: Site A and Site B, internet cloud between them, a "no route for 192.168.x"
sign. _"Private addresses can't cross the internet directly."_
**Story**:

1. A host at Site A sends to 192.168.2.9; it reaches Site A's gateway.
2. The gateway wraps the entire original packet inside a new outer envelope, addressed public IP to public IP. _"The whole original packet becomes the payload."_
3. The outer envelope crosses the cloud normally, routed on public IPs only. _"The internet only ever sees the outer envelope."_
4. At Site B's gateway the outer envelope is stripped and the inner packet delivered with its addresses and ports intact. _"Unwrapped, it arrives as if the two sites were one network."_
5. Side by side: a GRE tunnel (plain envelope) versus an IPsec tunnel (a lock icon on it). _"Some tunnels encrypt. Others, like GRE, don't."_
6. A meter shows the outer header eating into the link's MTU (GRE adds 24 bytes: 1500 becomes 1476 for the inner packet; IPsec adds more). _"Every tunnel costs some MTU."_
   **The moment**: Beats 2-4: the complete original packet disappearing inside the outer envelope and reappearing, with its addresses and ports untouched, at the far gateway.
   **Interaction**: Toggle the lock icon to see encryption is separate from tunneling; drag the
   outer header's size and watch the inner MTU shrink.
   **Ending**: Both networks shown as if directly cabled, the cloud and the tunnel still visible
   underneath as the real path.
   **Variants**: `overlay-networks`, `encapsulation`, `mtu-and-fragmentation`.
   **Techniques**: boundary, contents, token, side by side, meter, caption.
   **Review**: Improved — beat 4 no longer claims "byte-for-byte identical" (the inner TTL drops at each gateway) and the MTU meter now has a real number (GRE: 20 B outer IP + 4 B GRE = 24). Weighed leading with a VPN, but that fuses tunnel and encryption, the very misconception to defeat; the lock toggle keeps them apart. Checked: GRE unencrypted, IPsec encrypted, tunnel costs MTU.

### Overlay networks (VXLAN, GENEVE) (`overlay-networks`)

**The aha**: Your VPC isn't wires. The provider wraps your packets in a VXLAN/GENEVE-style header and ships them across a shared physical fabric, which is why different tenants can reuse the same CIDR.
**Misconception to defeat**: Confusing VXLAN overlays with VLANs (L2 segmentation of one physical
network) or with VPN tunnels.
**Cast**: A physical "underlay" fabric of racks shared by many tenants. Two tenant VPCs, Blue and
Green, both labelled 10.0.0.0/16, floating above the same hosts. Packets carry a VXLAN ID (VNI).
**Opening frame**: Physical fabric underneath, two identically-addressed tenant clouds floating
above it. _"Same address range. Different tenants."_
**Story**:

1. A VM in Tenant Blue sends to another VM in Blue, on a different rack. _"Looks like a direct wire..."_
2. Zoomed into the physical host: the packet is wrapped in a new outer packet, host IP to host IP, carried over UDP 4789, with a VXLAN header "VNI 5001". It crosses the shared fabric. _"...but it's wrapped and shipped across shared hardware."_
3. Simultaneously, Tenant Green sends a packet with the same inner IPs, wrapped "VNI 7002", across the same fabric and even the same link. _"The VNI keeps them apart, even with identical IPs."_
4. A meter: "VXLAN: ~16 million segments (24-bit ID)" beside "VLAN: 4,094 (12-bit ID)." _"Why clouds use overlays, not VLANs, at this scale."_
5. A VM in Blue sends an ARP broadcast: the host answers it locally from its own map, and other broadcast or multicast is simply dropped. _"The fabric has no real broadcast. The host fakes the answers."_
   **The moment**: Beat 3 — two tenants' identical-IP packets crossing the exact same physical wire
   side by side, kept apart only by an invisible VNI.
   **Interaction**: Toggle "logical view" (two clean VPC clouds) versus "physical view" (one shared
   fabric with VXLAN-tagged packets).
   **Ending**: The physical view — one fabric, many overlapping tenant overlays, each kept apart by
   its VNI.
   **Variants**: `tunneling`, `ip-address-planning`, `public-vs-private-ip`.
   **Techniques**: boundary, token, contents, zoom, side by side, meter, toggle, caption.
   **Review**: Improved — beat 2 now shows the outer header (host IPs, UDP 4789, VNI) so it is visibly an encapsulation, and beat 5's wrong claim (an overlay controller turning broadcasts into unicast copies) is replaced by what clouds actually do (answer ARP locally, drop other broadcast). Weighed a shipping-containers metaphor; the shared-wire contrast in beat 3 is sharper. Checked: 24-bit VNI = 16,777,216 IDs, 12-bit VLAN = 4,094 usable.

### Control plane vs data plane (`control-plane-vs-data-plane`)

**The aha**: The data plane keeps forwarding packets even when the control plane is down — a
cloud API outage stops you changing routes, but existing traffic keeps flowing.
**Misconception to defeat**: Confusing this with the management plane (admin access to devices),
or assuming an API outage stops traffic.
**Cast**: A router split into "Control plane: decides routes" (a brain, a routing-table card) and
"Data plane: forwards packets" (a conveyor of packets). A cloud API icon above, wired only to the
control plane.
**Opening frame**: Both halves green, API connected, packets flowing steadily on the conveyor.
_"Two separate jobs, same box."_
**Story**:

1. An admin calls the API to add a route; the request reaches only the control plane, which
   updates its table. _"Changing a route touches only the control plane."_
2. Packets keep crossing the conveyor the whole time. _"Forwarding never stops for this."_
3. The API flashes red, "Outage"; the control plane greys out — no new routes possible. _"The
   control plane is down."_
4. The conveyor keeps moving packets on the last known table. _"Existing traffic keeps flowing
   on the last known routes."_
5. A request to create a new load balancer during the outage bounces off the greyed control
   plane. _"You just can't change anything right now."_
6. The API recovers; the control plane reconnects.
   **The moment**: Beats 3–4 — the control plane visibly dead while the conveyor never even slows
   down.
   **Interaction**: A button "kill the control plane API" greys the brain but leaves the conveyor
   running; try adding a route during the outage and watch it bounce.
   **Ending**: Control plane restored, conveyor having never stopped.
   **Variants**: `routing-table`, `bgp`, `static-vs-dynamic-routing`.
   **Techniques**: boundary, failure, stream, restyle, spotlight, caption.
   **Review**: Merged — owned by Fundamentals (plans/fundamentals.part2.md). This plan's router split (a brain card beside a packet conveyor, the API wired only to the brain) is the clearest picture of "same box, two jobs", and its "last known table" caption is already borrowed. The owner should also borrow: (1) the stale-routes caveat, that the data plane keeps forwarding on old routes but also cannot reroute around a new failure until the control plane returns (link to static-vs-dynamic-routing); (2) naming the management plane (admin access to the box) as the thing it is not; (3) a router icon as the second example beside the VM, since it makes the idea protocol-independent.

## 2. IP addressing

### IP addresses (`ip-address`)

**The aha**: An IP address is a location on a network, not an identity — it has two parts,
network then host, and the prefix length decides where that boundary falls.
**Misconception to defeat**: Treating an IP address as an identity that sticks to a machine
forever, like a MAC or a hostname.
**Cast**: 10.0.1.25 written as 32 bits in four octets, with a vertical divider (initially at /24)
splitting it into a blue "network" part and an orange "host" part.
**Opening frame**: 10.0.1.25/24: "10.0.1" blue, ".25" orange. _"Network, then host."_
**Story**:

1. Three more hosts appear (10.0.1.5, .9, .200), sharing the same blue network part. _"Same
   network part: neighbours."_
2. A fifth host, 10.0.2.5, has a different blue part and sits on separate ground. _"Different
   network part: not a neighbour, even though it's close by."_
3. The divider slides to /16: now "10.0" is network; 10.0.2.5 and 10.0.1.25 suddenly share it.
   _"Move the boundary, and who's 'local' changes."_
4. The divider slides back to /24. _"The boundary is a choice, drawn by the prefix length."_
5. A MAC address beside a host stays fixed as the host moves to a different network, while the
   IP's network part updates to match. _"A MAC follows the card. An IP describes where it plugs
   in."_
   **The moment**: Beat 3 — sliding one divider changes which hosts count as local without moving
   anything else.
   **Interaction**: Drag the network/host divider and watch the grouping change live.
   **Ending**: Divider back at /24, four hosts grouped by shared network part.
   **Variants**: `cidr-and-subnetting`, `public-vs-private-ip`, `mac-and-arp`.
   **Techniques**: boundary, move, restyle, side by side, caption.
   **Review**: Keep — the divider sliding from /24 to /16 earns the "boundary is a choice" aha with one moving part. Alternative weighed: a postal-address (street, number) metaphor; it is what the divider already shows, minus the interactivity. Checked: 10.0.1.25/24 puts .5/.9/.200 on-network and 10.0.2.5 off; at /16 "10.0" covers 10.0.1.25 and 10.0.2.5; four hosts at the ending; MAC fixed while IP network part follows the host.

### Public vs private IP addresses (`public-vs-private-ip`)

**The aha**: Millions of networks reuse the same private ranges, so a private address only means
something inside its own network; reaching the internet needs NAT to translate it to a public
one.
**Misconception to defeat**: That a private address is itself a security feature (it hides
nothing; rules do).
**Cast**: Several unrelated boundary boxes (different offices), each with a host at
192.168.1.10. The internet cloud in the middle, public addresses only. A NAT gateway at each
box's edge.
**Opening frame**: Three unrelated boxes, each a host at 192.168.1.10, none connected. _"Same
address. Three different machines."_
**Story**:

1. Host A tries sending straight onto the internet addressed to a private range; it goes nowhere. _"Private addresses are never routed on the internet."_
2. Host A sends to a public site instead; at the edge, NAT rewrites the source to Box 1's public IP. _"NAT translates it to something the internet can route back to."_
3. Side by side, Box 2's host, also 192.168.1.10, does the same through its own NAT, getting its own public IP; both coexist. _"They never collide: the internet never sees the private address."_
4. A ruler shows the three RFC 1918 blocks: 10.0.0.0/8, 172.16.0.0/12 (172.16 to 172.31) and 192.168.0.0/16. Beside them flash the special ranges: loopback 127.0.0.1, link-local 169.254.x.x (the cloud metadata service) and carrier-grade NAT 100.64.0.0/10. _"Reserved for private use: reuse them anywhere."_
5. Reachability test: a host with a public IP but a deny-all rule can't be reached; a host with a private IP behind a port-forward rule can. _"Reachable or not is decided by routes and rules, not by the address."_
6. A cost meter ticks for a public IPv4 address, billed per hour, next to private ranges, free inside the box. _"Public IPv4 is scarce, and billed."_
   **The moment**: Beat 3 — two unrelated hosts with the identical private address both reaching the
   internet at once through their own NAT, never seeing each other.
   **Interaction**: Add more boxes with the same private range and watch them coexist; send a
   private-addressed packet straight onto the internet and watch it bounce.
   **Ending**: Internet cloud showing only public addresses, every private range tucked inside its
   own box.
   **Variants**: `nat`, `ip-address-planning`, `ipv4-vs-ipv6`.
   **Techniques**: boundary, token, restyle, failure, side by side, meter, spotlight, caption.
   **Review**: Improved — added the RFC 1918 ranges themselves (never named before; /12 spans 172.16-172.31) and a beat that defeats "private = secure" by showing a public-but-denied host and a private-but-forwarded one. Weighed a postal-code framing; the identical-address-twice opening is more memorable. Checked: 127/8, 169.254/16 metadata, 100.64/10, AWS/Azure/GCP charge for public IPv4.

### CIDR notation and subnetting (`cidr-and-subnetting`)

**The aha**: Each extra prefix bit halves the block: a /24 is 256 addresses, a /28 is 16. Clouds reserve 5 of every subnet on AWS and Azure (4 on Google Cloud), so a /28 gives only 11 usable addresses there.
**Misconception to defeat**: Confusing CIDR notation with the dotted subnet mask
(255.255.255.0 is /24, just written differently), or assuming address count scales with the
prefix number instead of halving.
**Cast**: A bar of 256 small squares, 10.0.0.0/24, with the dotted mask 255.255.255.0 beside it. A prefix slider from /16 to /30. Two counters: "classic usable" (minus network and broadcast) and "cloud usable". Five squares permanently greyed as reserved.
**Opening frame**: 10.0.0.0/24, 256 squares, mask 255.255.255.0. Counters: "classic 254", "cloud 251" (5 greyed). _"/24 = 256 addresses. The usable count is always less."_
**Story**:

1. Slide to /25: the bar splits into two 128-square halves, mask now 255.255.255.128; one half's cloud counter reads 123. _"+1 bit: half the size. Same thing as the mask, written shorter."_
2. Slide to /26: each half halves again (64 squares). _"Each bit, half again."_
3. Slide to /28: a 16-square block, 5 reserved, counter "11 usable". _"A /28: 16 addresses, 11 you can actually use (12 on Google Cloud)."_
4. Zoom out: the lower half of the /24 is carved unevenly (VLSM): a /26 for servers, a /27, two /28s. _"Subnets don't have to be equal sizes."_
5. The four blocks fill exactly 10.0.0.0/25 and a single summary route lights up over all of them. _"Contiguous blocks summarize into one route."_
   **The moment**: Beat 3: the counter dropping from 256 to 16 to 11. The gap between "16 addresses" and "11 you can use" is the misconception to kill.
   **Interaction**: Drag the prefix slider and watch block size and usable count update live; draw
   VLSM splits of different sizes inside one /24.
   **Ending**: The lower half of the /24 split into right-sized VLSM blocks and summarized as one 10.0.0.0/25 route; the upper half 10.0.0.128/25 still free.
   **Variants**: `ip-address`, `ip-address-planning`, `routing-table`.
   **Techniques**: boundary, meter, dial, restyle, move, caption.
   **Review**: Improved — fixed arithmetic: the old beat 5 summarized "three" blocks into a /25 (a /26, /27 and two /28 is four blocks, 64+32+16+16 = 128) and the ending claimed a fully subdivided /24 when only half was; added the 254-vs-251 usable contrast and the dotted mask so "CIDR vs subnet mask" is on screen. Weighed a pizza-slicing metaphor; the 256-square bar is more exact. Checked: /25 = 128-5 = 123, /28 = 16-5 = 11, GCP reserves 4.

### IP address planning and overlap (`ip-address-planning`)

**The aha**: Two networks with overlapping ranges can't be routed together directly — plan
non-overlapping ranges for every VPC, region and site before building, because re-addressing
later means rebuilding.
**Misconception to defeat**: Confusing subnetting (carving up one block you already own) with
planning (allocating distinct blocks across the whole estate).
**Cast**: A map of boundary boxes: VPC-Prod (10.0.0.0/16), VPC-Dev (10.1.0.0/16), on-prem HQ
(10.2.0.0/16), and a mistakenly-planned VPC-New (also 10.0.0.0/16). Dashed peering/VPN lines. An
IPAM ledger of allocated blocks.
**Opening frame**: Three boxes, non-overlapping ranges, clean peering lines already connecting
them. _"Every block planned up front, no overlaps."_
**Story**:

1. VPC-New appears, assigned 10.0.0.0/16 without checking the ledger, identical to VPC-Prod's. _"Nobody checked what was already taken."_
2. Peering VPC-New to VPC-Prod: the dashed line snaps red, "overlapping CIDR", and the request is refused (AWS and Azure both reject it). _"Two networks can't be routed together if their ranges overlap."_
3. Even with a workaround link, a packet from VPC-New to 10.0.5.5 never leaves: VPC-New's route table says 10.0.0.0/16 is local, so it lands on its own 10.0.5.5. _"Which 10.0.5.5 do you mean?"_
4. Fixes appear with cost icons: re-address VPC-New entirely, or bolt on NAT/private-link workarounds. _"Fix it after the fact, and it's expensive either way."_
5. Rewind: VPC-New is instead assigned 10.3.0.0/16, checked against the ledger first. The peering line connects cleanly.
   **The moment**: Beats 2-3: the peering line snapping red and the packet landing on its own side, showing overlap breaks routing outright, not just complicates it.
   **Interaction**: Assign a new network's CIDR by dragging it onto the map; the ledger flags a
   clash in red before you can connect it to anything.
   **Ending**: Four boxes, all distinct ranges, every peering line clean, ledger reconciled.
   **Variants**: `cidr-and-subnetting`, `overlay-networks`, `routing-table`.
   **Techniques**: boundary, failure, token, spotlight, caption.
   **Review**: Improved — beat 3 was wrong as drawn (a packet from 10.0.5.5 to 10.0.5.5 has no meaning); the real failure is that the sender's route table treats the whole range as local, so the packet never leaves. Peering is refused rather than going red afterwards. Weighed a duplicate-street-names-in-one-city framing; the ledger clash is more actionable. Checked: AWS/Azure reject overlapping peering, 10.3.0.0/16 disjoint from 10.0/10.1/10.2.

### Ports, sockets and the 5-tuple (`ports-and-sockets`)

**The aha**: The IP gets you to the machine, the port gets you to the program — and the client's
random ephemeral source port is what lets thousands of connections share one machine and one
server address.
**Misconception to defeat**: Thinking a port number proves the protocol (443 is convention, not
proof it's HTTPS).
**Cast**: A server at 93.4.2.1 with labelled doors (443, 22, 53). A client at 10.0.1.5 with an
ephemeral port pool (32768–60999). Each connection stamped as a 5-tuple card.
**Opening frame**: Server with three doors, one client. _"A port picks the program on that
machine."_
**Story**:

1. The client opens door 443: a card stamps TCP, 10.0.1.5:51234, 93.4.2.1:443. _"A socket is IP:port. The IP finds the machine, the port finds the program."_
2. A second tab opens another connection to 443, stamping a different source port, 51235. _"Same destination, different source port: a distinct connection."_
3. Thousands of these cards fan out from one client, differing only by source port, all landing at 93.4.2.1:443. Each server reply is matched back to the right tab by its card. A meter: ephemeral pool 32768-60999, about 28,000 ports. _"Only the source port varies. About 28,000 connections to one destination."_
4. A firewall reads only the 5-tuple cards, never the payload. _"This is what firewalls and NAT track."_
5. A service listens on port 443 but isn't actually TLS; a client expecting HTTPS gets garbage. _"The port number is a convention. Nothing enforces it."_
   **The moment**: Beat 3 — the wall of near-identical 5-tuple cards, differing only by one
   ephemeral number, which is the whole reason one machine holds thousands of simultaneous
   connections.
   **Interaction**: Open more connections and watch new cards stamp with incrementing ports; connect
   to a port running the "wrong" protocol and watch it fail.
   **Ending**: A wall of 5-tuple cards, server doors labelled, ephemeral pool ticking upward.
   **Variants**: `tcp-handshake`, `nat`, `snat-port-exhaustion`.
   **Techniques**: contents, token, meter, spotlight, failure, caption.
   **Review**: Improved — defined socket (the 'socket' half of the title was never shown), made the replies find the right connection by tuple, and put the pool size on the meter (32768-60999 is ~28,232 ports), which sets up snat-port-exhaustion. Weighed an apartment-building (IP = building, port = flat) metaphor; it is already the 'doors' cast. Checked: 5-tuple = protocol, src/dst IP, src/dst port; Linux ephemeral range.

### IPv4 vs IPv6 (`ipv4-vs-ipv6`)

**The aha**: IPv6 has so many addresses (2^128, about 3.4 x 10^38) that NAT isn't needed: every host gets a globally routable address, and only firewalls decide who can reach it.
**Misconception to defeat**: Believing IPv6 is inherently "more secure," or that NAT is itself a
security feature.
**Cast**: Side by side. Left, IPv4: a host behind a NAT gateway sharing a scarce public address.
Right, IPv6: a host with 2001:db8::1, no NAT, facing the internet cloud directly behind a
firewall.
**Opening frame**: Left crowded behind one shared address; right open, host–firewall–cloud.
_"IPv4 is scarce. IPv6 isn't."_
**Story**:

1. Left: three more hosts share the one public IP through NAT's table, ports ticking up. _"IPv4: share one address, many hosts."_
2. Right: three more hosts each get their own full address, no sharing. _"IPv6: everyone gets their own."_
3. The same unsolicited probe is sent at both hosts. Left: dropped, NAT has no row. Right, firewall on: dropped, no rule allows it. Then the right firewall is toggled off and the probe reaches the host. _"Same result, different cause. On IPv6 the firewall does the job NAT only seemed to do."_
4. A host self-configures with SLAAC, picking its address from the advertised prefix, plus an automatic link-local address. _"IPv6 hosts can self-configure."_
5. Happy Eyeballs: a client races IPv4 and IPv6 attempts at once; whichever connects first wins. _"Dual-stack: try both, use whichever answers first."_
6. An "egress-only gateway": outbound flows out, a probing inbound attempt bounces. _"Outbound-only, like NAT, without translating anything."_
   **The moment**: Beat 3: one identical probe, dropped on the IPv4 side for lack of a NAT row and on the IPv6 side only because a firewall rule says so; remove that rule and the host is exposed.
   **Interaction**: Toggle the IPv6 firewall; race Happy Eyeballs repeatedly and see which tends to
   win.
   **Ending**: IPv4 crowded behind one address, IPv6 spacious with firewalls doing the gatekeeping.
   **Variants**: `public-vs-private-ip`, `nat`, `dhcp`.
   **Techniques**: side by side, token, contents, toggle, failure, caption.
   **Review**: Improved — the old moment showed IPv6 exposed with no matching IPv4 comparison, so the "NAT is not security" lesson was implied; now the same probe hits both and the cause of each drop is explicit. Added the address-space number. Weighed leading with the address-size gap (32 vs 128 bits drawn to scale); worse, the NAT/firewall contrast is the practical lesson. Checked: SLAAC, link-local, Happy Eyeballs, AWS egress-only internet gateway.

### DHCP (`dhcp`)

**The aha**: A machine boots knowing nothing; DHCP's four-step exchange (DORA) tells it its own
address, its gateway, and its DNS servers in one go.
**Misconception to defeat**: Thinking a cloud "static" private IP isn't delivered by DHCP (it
still is), or confusing DHCP with DNS.
**Cast**: A fresh host with no address, a DHCP server, a ladder diagram for Discover, Offer,
Request, Acknowledge.
**Opening frame**: Host with "??? . ??? . ??? . ???," DHCP server waiting, both lifelines empty.
_"A machine boots knowing nothing."_
**Story**:

1. Host (address 0.0.0.0) broadcasts "DISCOVER: anyone offering an address?" to 255.255.255.255. _"D - Discover: shouted to everyone."_
2. Server replies "OFFER: 10.0.1.25, gateway 10.0.1.1, DNS 10.0.1.2, lease 24h." _"O - Offer: here's a proposal."_
3. Host broadcasts "REQUEST: I'll take that one." (broadcast, so any other server knows its offer was declined). _"R - Request: confirming the choice."_
4. Server replies "ACK"; the host's address field fills in, a 24h lease timer starts. _"A - Acknowledge: it's yours, for now."_
5. The lease timer runs down; at halfway the host quietly asks the same server to renew, and the timer resets. _"Leases expire, and quietly renew."_
6. Cutaway to a cloud VM: the same ladder runs invisibly the instant it boots, handing out the IP you "assigned" plus the provider's DNS resolver. _"Even a cloud 'static' private IP arrives this way."_
7. Someone hand-sets the OS network settings, bypassing DHCP, and forgets the gateway and DNS: neighbours still answer, nothing else does. _"Override it by hand, and every field DHCP supplied is yours to get right."_
   **The moment**: Beat 6 — the same four-letter ladder replaying silently inside a simple "assign a
   static IP" click.
   **Interaction**: Step through DORA one message at a time; let the lease expire without renewal.
   **Ending**: Host fully configured, lease timer ticking quietly in the background.
   **Variants**: `dns-resolution`, `default-gateway`, `ip-address`.
   **Techniques**: exchange, token, timer, contents, caption.
   **Review**: Improved — beat 7 overclaimed (hand-set settings only lose what you forget to fill in); added the real Discover source/destination (0.0.0.0 to 255.255.255.255), why Request is also a broadcast, and renewal at the halfway mark. Weighed a 'new employee badge' metaphor; DORA ladders are already the clearest. Checked: DORA order, lease carries IP/mask/gateway/DNS, cloud DHCP delivers the assigned IP.

## 3. Routing and NAT

### Default gateway (`default-gateway`)

**The aha**: A host makes one decision per packet — is the destination inside my subnet, or do I
hand it to the gateway — and a wrong mask or gateway gives the classic "I can reach my neighbours
but nothing else."
**Misconception to defeat**: Confusing "default gateway" (the device) with "default route" (the
0.0.0.0/0 table entry pointing at it), or with the internet gateway.
**Cast**: A host at 10.0.1.25/24, its subnet a boundary box with neighbours (10.0.1.5, .9) and a
gateway router at the edge (10.0.1.1). Outside, a distant host and the internet cloud.
**Opening frame**: Host, boundary box, gateway at the edge, distant host and cloud outside. _"One
box. One exit."_
**Story**:

1. Host sends to neighbour 10.0.1.9: a token travels directly, never touching the gateway. _"Same subnet? Deliver directly."_
2. Host sends to 10.0.2.50 (outside the box): it first ARPs for the gateway's MAC, then the token detours through the gateway. _"Not my subnet? Hand it to the gateway."_
3. Zoom into the host's own tiny table: "10.0.1.0/24 - on this link" and "0.0.0.0/0 - via 10.0.1.1". Labels: the router is the default gateway; the 0.0.0.0/0 row is the default route. _"The gateway is the device. The default route is the row that points at it."_
4. Break it: a too-narrow mask (/28, which makes the host's subnet 10.0.1.16-31) reads neighbour 10.0.1.9 as "outside"; local traffic wrongly detours through the gateway. _"Wrong mask: local traffic takes the long way, or fails."_
5. Break it differently: the gateway address itself is wrong; local traffic still works, but everything external vanishes. _"Wrong gateway: neighbours fine, nothing else works."_
   **The moment**: Beat 5 — local traffic working perfectly while every external attempt vanishes,
   isolating exactly the symptom people debug blind.
   **Interaction**: Dial the subnet mask and the gateway address independently and watch which
   traffic breaks.
   **Ending**: Mask and gateway corrected, local and external traffic both flowing.
   **Variants**: `routing-table`, `mac-and-arp`, `cidr-and-subnetting`.
   **Techniques**: boundary, token, path trace, zoom, failure, dial, caption.
   **Review**: Improved — added the host's two-row table (beat 3) so gateway vs default route is defeated on screen rather than only named, and the ARP-for-gateway step linking to mac-and-arp; the /28 breakage now states why .9 falls outside (10.0.1.16-31). Weighed starting from the symptom ("ping neighbour OK, ping internet fails"); that reveals the answer too early, so the decision comes first. Checked: one mask check per packet, wrong mask vs wrong gateway symptoms.

### Routing tables and longest prefix match (`routing-table`)

**The aha**: Routing happens hop by hop — each router only knows its next step — and when several
routes match, the most specific prefix always wins, whatever order they're listed in.
**Misconception to defeat**: Confusing routes (where traffic goes) with firewall rules (whether
it's allowed).
**Cast**: A router with a table card: 10.0.0.0/16 → R2, 10.0.1.0/24 → R3, 0.0.0.0/0 → R1. A
packet addressed to 10.0.1.50.
**Opening frame**: Router, table card, packet arriving. _"Which row wins?"_
**Story**:

1. The destination 10.0.1.50 is checked against each row; all three match. Each flashes briefly. _"Three rows match. Only one wins."_
2. The /24 row (most specific) locks in, glowing; the packet exits via R3. _"Longest prefix match: the most specific row always wins."_
3. The table rows are shuffled into a different order; the same /24 row still wins. _"Order in the table doesn't matter."_
4. A new row, 10.0.1.0/26 (covers .0 to .63, so it includes .50), is added; it wins instead. _"A /24 beats a /16; a /26 beats a /24."_
5. The packet's journey continues to R3, which has its own smaller table and makes its own decision. _"Hop by hop. No router knows the whole route."_
6. A packet with no specific match falls through to 0.0.0.0/0. _"The default route: everything else's parachute."_
7. A firewall icon beside R3 drops the packet anyway. _"A route says where. A firewall says whether."_
   **The moment**: Beats 2–3 — shuffling the row order and watching the exact same row win anyway.
   **Interaction**: Add, remove and reorder rows; type a destination and watch the match highlight
   live.
   **Ending**: Table settled, most specific row lit, packet already gone to the next hop's table.
   **Variants**: `default-gateway`, `static-vs-dynamic-routing`, `bgp`.
   **Techniques**: contents, spotlight, restyle, path trace, zoom, caption.
   **Review**: Improved — beat 4 was wrong: 10.0.1.128/25 covers .128-.255, so it would not match 10.0.1.50 and could not win; now 10.0.1.0/26 (.0-.63). Added beat 7 so routes-vs-firewall is defeated on screen. Weighed a map-zoom metaphor (country, city, street); the shuffle test is more convincing. Checked: all three rows match 10.0.1.50, longest prefix wins, default route 0.0.0.0/0.

### Static vs dynamic routing (`static-vs-dynamic-routing`)

**The aha**: Static routes are simple and predictable but blind to failure; dynamic routing
protocols learn the network and route around a dead link by themselves.
**Misconception to defeat**: Confusing static/dynamic routing with static/dynamic IP addresses.
**Cast**: Two routers, R1 and R2, with two parallel links, A and B. Side by side: a static
scenario (hand-typed table row) and a dynamic one (OSPF/BGP icon, learned table).
**Opening frame**: Both scenarios identical, traffic on Link A, Link B idle, a small tag reading "routes, not addresses". _"Two links. One in use."_
**Story**:

1. Static side: the row "via Link A" is typed in by a hand icon. _"A human wrote this row. It never changes itself."_
2. Link A fails somewhere in the middle (the router's own port still shows up). Static side: the row still reads "via Link A"; traffic keeps vanishing. _"Static doesn't notice."_
3. Dynamic side, same failure: neighbour messages stop arriving, a timer expires, the routing icon exchanges a few updates and the table changes to "via Link B"; traffic reroutes after a few seconds. _"Dynamic notices and reroutes, by itself."_
4. Side by side, frozen: static still dead, dynamic flowing again. _"Same failure, two very different outcomes."_
5. A cloud variant: routes learned over BGP from an on-premises router appear automatically, tagged "propagated", instead of typed by hand.
   **The moment**: Beat 4's freeze — identical failure, one side permanently broken until a human
   intervenes, the other already recovered.
   **Interaction**: Break Link A on each side independently and watch the tables diverge.
   **Ending**: Dynamic side rerouted and stable; static side still waiting for a human.
   **Variants**: `routing-table`, `bgp`, `control-plane-vs-data-plane`.
   **Techniques**: side by side, failure, restyle, exchange, caption.
   **Review**: Improved — beat 2 now makes the failure one a static route can't see (a mid-path break; a directly cut cable would drop the route), beat 3 shows detection plus a realistic few seconds, and the opening tag defeats the static/dynamic-IP mix-up. Weighed a GPS-vs-paper-map framing; the frozen split screen is harsher and clearer. Checked: OSPF inside, BGP between, cloud BGP route propagation.

### BGP and autonomous systems (`bgp`)

**The aha**: BGP is the internet's postal agreement — each autonomous system tells its neighbours
"send traffic for these addresses to me," and routes are chosen by policy and payment, not
distance.
**Misconception to defeat**: Confusing BGP (between organisations) with interior protocols like
OSPF, or with DNS (names, not paths).
**Cast**: Boundary boxes labelled AS 100, 200, 250, 300, 400, 900, loosely connected. AS 100 holds 203.0.113.0/24. AS 900 pays AS 400 (its provider) and is paid by AS 300 (its customer); a small policy card sits beside it.
**Opening frame**: A handful of AS boxes, AS 100 holding the prefix. _"Tens of thousands of these
boxes make up the internet."_
**Story**:

1. AS 100 announces "I can reach 203.0.113.0/24" to AS 200. _"An announcement: 'send traffic for this range to me.'"_
2. AS 200 passes it on, and every AS adds its own number to the path as it forwards. AS 900 hears two versions: 400-200-100 and 300-250-200-100. _"Each hop adds itself to the path and passes it on."_
3. The shorter path (3 ASes via 400) is the obvious pick. _"Shortest path wins?"_
4. The policy card flips: 400 is AS 900's provider (it pays), 300 is its customer (it earns). AS 900 prefers the longer route via 300. _"Policy decides, not distance. Customers before peers before providers."_
5. AS 100 fat-fingers an announcement claiming 8.8.8.0/24; it spreads exactly like beat 1, and nearby ASes start sending that traffic to the wrong place. _"One wrong announcement can take a service off the internet."_
6. A signed record (RPKI) says only the real owner may originate 8.8.8.0/24; networks that check it drop the bogus route. _"Defences exist now, but each network has to opt in."_
   **The moment**: Beats 3-5: the shortest path rejected for a longer, better-paying one, then a bogus announcement propagating through the very same mechanism.
   **Interaction**: Toggle which path wins via the policy card; trigger the bad announcement and
   watch it spread.
   **Ending**: The bogus announcement withdrawn or filtered, the legitimate 203.0.113.0/24 paths settling back.
   **Variants**: `bgp-path-selection`, `routing-table`, `static-vs-dynamic-routing`.
   **Techniques**: boundary, exchange, path trace, spotlight, failure, caption.
   **Review**: Improved — the old beat 3 said two paths had "different AS-path lengths" while the drawn paths (300-200-100, 400-200-100) were equal, so policy-over-distance was unprovable; now one path is genuinely shorter and loses to a customer route (local preference beats path length). Added RPKI so beat 5 isn't "nothing can stop it" in 2026. Weighed a postal-treaties framing (kept as the aha); the leak beat is the memorable part. Checked: path vector, AS-path prepended per hop, hijack mechanics.

### Steering traffic with BGP (active/passive) (`bgp-path-selection`)

**The aha**: You control your outbound path directly (local preference) but can only politely
ask for your inbound path (prepending, MED) — the usual design is one link active, the other
passive, never by hiding behind a less-specific route.
**Misconception to defeat**: Confusing BGP path steering with load balancing (ECMP spreads flows
by hash across equal paths, not by load).
**Cast**: Your AS (on premises) with two redundant links to the cloud, a dedicated Interconnect and a VPN, both announcing 203.0.113.0/24 identically.
**Opening frame**: Both links announcing identically, flows split between them by hash. _"Two equal paths. No control yet."_
**Story**:

1. Both links announce the same prefix, so the cloud sends flows over both (ECMP: spread by flow hash, not by load). Then a local-preference tag on the Interconnect route makes all your outbound traffic take it. _"Outbound is yours to set directly."_
2. The same trick tried on the VPN's outgoing announcement has no effect on others' inbound choices (local preference never leaves your AS). _"You can't just declare your inbound preference."_
3. Instead, the VPN's announcement gets AS-path prepending, your AS number stamped three extra times, making it look artificially longer. _"Prepending: make the path you don't want look longer."_
4. Inbound traffic now mostly arrives via Interconnect, VPN sitting passive. _"Active/passive: one path preferred both ways."_
5. The Interconnect fails; inbound and outbound both shift to the VPN, which was always real and ready. _"The passive path was never fake, just less attractive."_
6. A tempting shortcut is crossed out: the primary advertises a /23 while the VPN advertises the /24. Everything flows over the VPN, the opposite of intent. _"The more specific prefix wins before any attribute is looked at."_
   **The moment**: Beats 2-3: outbound preference working by local edit alone, while inbound preference requires making yourself look worse to others.
   **Interaction**: Set local preference for outbound directly; adjust prepending length and watch
   inbound share shift.
   **Ending**: Interconnect active both ways, VPN fully passive but already proven to fail over.
   **Variants**: `bgp`, `routing-table`.
   **Techniques**: path trace, restyle, meter, failure, caption.
   **Review**: Improved — beat 6's shortcut was drawn in the wrong direction (a less-specific prefix on the primary would lose, not force traffic there), now shown failing for the right reason; the cast now names the cloud as the other end, and ECMP is made visible in beat 1 so the load-balancing misconception is on screen. Weighed one big attribute-ladder diagram of the whole decision process; too much for one idea. Checked: local preference stays inside an AS, prepending/MED are requests, cloud routers already prefer interconnect over VPN for equal prefixes.

### NAT: SNAT, DNAT and PAT (`nat`)

**The aha**: Outbound NAT makes many hosts look like one; inbound NAT (DNAT) makes one address
stand in front of many — and because translation state is only created by outbound traffic, an
unsolicited inbound connection has nowhere to go.
**Misconception to defeat**: Thinking NAT is a firewall (it only rewrites headers; the
"can't-be-called-in" effect is a side effect of needing existing state, not a security policy).
**Cast**: A NAT device at a boundary with a translation-table card (private IP:port, public IP:port, and the remote endpoint, per flow). Private hosts inside, the internet outside.
**Opening frame**: NAT device, empty table, no flows yet. _"No flows yet, no table entries."_
**Story**:

1. Host A (10.0.1.5:51234) sends outbound to 93.4.2.1:443; the source is rewritten to 203.0.113.9:40001, and a row is stamped. _"SNAT: outbound, many become one, and PAT keeps their flows apart by port."_
2. The response from 93.4.2.1:443 arrives addressed to 203.0.113.9:40001; the NAT consults the table and rewrites the destination back. _"The table remembers who asked."_
3. Host B does the same, getting row 40002; both share the public IP without colliding. _"One public face, many private hosts."_
4. An unsolicited connection from 198.51.100.7 to 203.0.113.9:40001 (or to :22) matches no row and is dropped. _"No matching row, no way in."_
5. Contrast: DNAT. An inbound connection to a public virtual IP has its destination rewritten to a private backend (port forwarding, a load balancer's VIP). Unsolicited traffic now gets in. _"DNAT: one address in front of many. NAT lets you in when a row says so; it isn't a policy."_
   **The moment**: Beat 4, then beat 5: the unsolicited connection bouncing off an empty table, looks like a firewall, and then the DNAT rule showing the same box letting strangers in.
   **Interaction**: Send outbound traffic from different hosts and watch rows appear; try an
   unsolicited inbound connection and watch it find nothing.
   **Ending**: Table full of active rows, each response matched correctly, the unsolicited attempt
   still outside.
   **Variants**: `nat-gateway`, `snat-port-exhaustion`, `public-vs-private-ip`.
   **Techniques**: contents, token, restyle, failure, caption.
   **Review**: Improved — beat 4 claimed an inbound packet to :40001 "finds no row" although that very row exists; the row also pins the remote endpoint (93.4.2.1:443), so a stranger doesn't match it; and beat 5 now lets unsolicited traffic in via DNAT, which is what defeats "NAT is a firewall". Weighed a hotel-switchboard metaphor (one number, many rooms); the table card is more exact. Checked: SNAT/DNAT/PAT definitions, state created by outbound traffic.

### NAT gateway (private subnet egress) (`nat-gateway`)

**The aha**: Private subnet plus NAT gateway means "can call out, can't be called in" — and it's
also a cost and throughput choke point, since every byte is processed, billed, and uses one of a
finite number of source ports.
**Misconception to defeat**: Confusing the NAT gateway (one-way, outbound-only) with an internet
gateway (two-way, for resources with public IPs).
**Cast**: A private subnet of instances with no public IPs, a NAT gateway at its edge; a separate
public subnet with an internet gateway for contrast. Meters: throughput, byte cost, ports in use.
**Opening frame**: Private subnet, NAT gateway at the edge, public subnet with internet gateway
beside it. _"Two different doors."_
**Story**:

1. Route tables appear: the private subnet's 0.0.0.0/0 points at the NAT gateway, the public subnet's 0.0.0.0/0 at the internet gateway. An instance in the private subnet calls an external API through the NAT gateway and succeeds. _"Outbound: fine. Public or private is just a route."_
2. The internet tries to reach that instance: it has only a private address, and the NAT gateway's public IP has no row for this connection, so it is dropped. _"Inbound: nowhere to go."_
3. Contrast: an instance in the public subnet with its own public IP, reached via the internet gateway, accepts an unsolicited inbound connection (if its rules allow). _"Internet gateway: two-way. NAT gateway: one-way."_
4. Every byte through the NAT gateway ticks a cost meter upward (an hourly charge plus per-GB processing). _"It's not free to use: every byte is metered."_
5. Dozens of instances calling the same destination funnel through a limited pool of source ports (about 55,000 per destination per public IP on AWS, 64,512 on Azure); the usage meter climbs toward its ceiling. _"A shared, finite pool of ports: a capacity choke point."_
   **The moment**: Beat 3's side-by-side — identical unsolicited inbound attempt, one door open, one
   closed, nothing else different.
   **Interaction**: Toggle private+NAT-gateway versus public+internet-gateway for the same instance
   and watch inbound reachability flip; add traffic and watch the meters climb.
   **Ending**: Private subnet calling out freely, cost meter ticking, inbound still closed.
   **Variants**: `nat`, `snat-port-exhaustion`, `default-gateway`.
   **Techniques**: boundary, token, side by side, failure, meter, toggle, caption.
   **Review**: Improved — the route-table rows (private 0.0.0.0/0 to NAT, public 0.0.0.0/0 to IGW) now carry the real distinction; beat 2's inbound attempt could never have targeted a private-IP instance, so it now stops at the NAT's public IP; ceilings given per cloud. Weighed an airlock/one-way-valve metaphor; the side-by-side with the same inbound attempt is more honest. Checked: AWS NAT gateway lives in a public subnet and bills hourly plus per GB, ~55,000 connections per destination per IP, Azure 64,512 SNAT ports per IP.

### SNAT port exhaustion (`snat-port-exhaustion`)

**The aha**: Every outbound flow through a NAT to the same destination needs its own source port
on the shared public IP, roughly 64,000 per public IP per destination — workloads opening many
short connections run out, and it looks like random timeouts under load.
**Misconception to defeat**: Confusing this with per-host ephemeral port exhaustion, or with the
destination rate-limiting you.
**Cast**: A NAT gateway, one public IP, a port meter (0 to about 64,000) for connections to one destination (a payment API at 198.51.100.20:443). Many client instances behind it.
**Opening frame**: Port meter near zero, a handful of active connections. _"Plenty of ports, for
now."_
**Story**:

1. A burst of instances each open, call and close a connection to the API; each burns a port briefly. _"Every flow to that destination needs its own port."_
2. A closed connection doesn't release its port immediately: the NAT keeps the mapping for about a minute (TIME_WAIT-like) in case stray packets arrive. _"Closed connections still hold their port for a while."_
3. Under heavy load, new connections open faster than old ones release; the meter climbs toward 64,000. The sustained limit is roughly 64,000 ports / 60 s, about 1,000 new connections per second. _"Open faster than you release, and the meter only goes up."_
4. The meter hits its ceiling; a new connection fails to get a port at all, timing out from the app's point of view. _"Looks like random timeouts under load. It's arithmetic."_
5. Three fixes, side by side: "Reuse connections" (meter falls), "Add more public IPs" (ceiling raises), "Private endpoint" (bypasses NAT entirely). _"Fix it with fewer flows, more headroom, or skip NAT."_
   **The moment**: Beat 4: the meter pinned at its ceiling and a healthy-looking request failing for no visible reason, making the "random timeout" countable (~1,000 new connections per second per destination).
   **Interaction**: Dial the connection-open rate and watch the meter climb and spill over; try each
   fix and watch the meter respond.
   **Ending**: Connection pooling applied, meter settled low and stable, no more failures.
   **Variants**: `nat-gateway`, `nat`, `tcp-connection-teardown`, `ports-and-sockets`.
   **Techniques**: meter, token, timer, failure, dial, side by side, caption.
   **Review**: Improved — the destination was a private database (10.50.1.1:5432), which a NAT gateway doesn't reach in the first place; it is now a public API. Added the rate arithmetic (64,000 ports held about 60 s is ~1,000 new connections per second) that turns the mystery into a number, and corrected whose timer holds the port (the NAT's mapping, not the client's TIME_WAIT). Weighed a parking-lot-with-lingering-cars metaphor; the live meter does the same job. Checked: ~64,512 ports/IP on Azure, ~55,000 on AWS.

## 4. Transport

### TCP vs UDP (`tcp-vs-udp`)

**The aha**: TCP trades latency for certainty (handshakes, retransmissions, ordering); UDP gives
raw speed and leaves loss handling to the app — which is why QUIC builds its own reliability on
top of UDP instead of using TCP.
**Misconception to defeat**: "UDP is unreliable, so it's bad" — it's a deliberate choice, not a
lesser protocol.
**Cast**: Side by side. Left, TCP: client/server lifelines with a visible handshake before data,
then an ordered numbered stream. Right, UDP: lifelines, no handshake, unnumbered independent
packets fired immediately.
**Opening frame**: Both sides at rest, nothing sent. _"Same job: get data from A to B."_
**Story**:

1. TCP: SYN, SYN-ACK, ACK play out (one round trip) before the client may send data. _"TCP: pay a round trip before byte one."_
2. UDP, same moment: the first datagram is already sent and received. _"UDP: no setup. Just send."_
3. TCP: packet 3 of 5 bursts mid-flight. Packets 4 and 5 sit buffered, unordered, waiting; only once 3 is retransmitted do 3, 4, 5 release together. _"TCP: lost one, and the rest wait for it."_
4. UDP, same loss: packet 3 is gone forever; 4 and 5 are delivered immediately, with a gap. _"UDP: lost one, the rest just keep coming."_
5. Side by side: a voice call on the UDP side keeps talking smoothly through the gap; a file download on the TCP side pauses, then catches up. _"Which matters more: never missing a byte, or never stopping?"_
6. A third lifeline fades in: QUIC, running over UDP but with its own numbering and retransmission built in. _"QUIC: UDP's speed, with reliability added on top."_
   **The moment**: Beats 3–4, side by side — the identical lost packet freezes one side completely
   and is shrugged off by the other.
   **Interaction**: Drop a packet on each side independently; swap which app sits on which protocol.
   **Ending**: TCP's stream complete and gap-free; UDP's stream complete but with a visible gap.
   **Variants**: `tcp-handshake`, `tcp-reliability`, `quic`, `head-of-line-blocking`.
   **Techniques**: side by side, exchange, token, failure, restyle, caption.
   **Review**: Improved — beat 1 no longer implies data can't flow until 1 RTT passes from the server's view (the client may send right after SYN-ACK), and beat 6 no longer says QUIC's reliability is "the app layer" (it is a transport protocol, in user space). Weighed a phone-call vs postcard metaphor; the identical-loss split screen in beats 3-4 is stronger and already defeats "UDP is just bad" via the voice call. Checked: TCP ordering stalls behind a loss, UDP datagrams independent.

### TCP three-way handshake (`tcp-handshake`)

**The aha**: Every new TCP connection costs one full round trip before the first byte of data
flows — why distant servers and one-connection-per-request designs are slow, and why reusing
connections avoids paying it again.
**Misconception to defeat**: Confusing this with the TLS handshake (separate, layered on top) or
with HTTP keep-alive.
**Cast**: A ladder diagram, client and server lifelines, a round-trip clock (80ms one-way, 160ms
round trip), three slanted arrows.
**Opening frame**: Two bare lifelines, clock at 0ms. _"Nothing sent yet. The clock starts now."_
**Story**:

1. Client sends SYN (sequence x, a random starting number); the arrow takes 80ms. _"SYN: 'let's talk, starting from sequence x.'"_
2. Server replies SYN-ACK (ack x+1, its own sequence y); another 80ms. _"SYN-ACK: 'got it, and here's my sequence, y.'"_
3. Client replies ACK (ack y+1). The client's clock reads 160ms: only now may it send its first byte, which arrives at the server at 240ms. _"ACK: connection open."_
4. The clock freezes at 160ms beside "0 bytes delivered". _"160ms spent, zero data delivered."_
5. A TLS ladder starts only after the TCP one ends and adds another round trip of its own. _"TLS is a separate handshake, stacked on top."_
6. Zoom out: a page opening six new connections pays this 160ms six times in parallel, and a distant server (300ms round trip) pays more every time. _"Far away? Pay more, every time, per connection."_
7. A second request reuses the already-open connection (HTTP keep-alive); the 160ms is skipped entirely. _"Reuse the connection, skip the toll."_
   **The moment**: Beat 4 — the clock frozen at 160ms with "0 bytes delivered" right beside it.
   **Interaction**: Drag the round-trip-time clock and watch the handshake's total cost scale;
   toggle new versus reused connection for a second request.
   **Ending**: Connection open, clock still showing the 160ms toll, first data packet crossing.
   **Variants**: `tcp-vs-udp`, `tls-handshake`, `tcp-connection-teardown`.
   **Techniques**: exchange, timer, caption.
   **Review**: Improved — the old beat 4 claimed the server's application sees the first byte at 160ms; it is the client that is ready at 160ms and the first data reaches the server at 240ms. Added beat 5 so "this isn't TLS" is defeated on screen, and named keep-alive as the reuse mechanism. Weighed a phone-ringing metaphor ("hello?" / "hello" / "can you hear me?"); the live clock is more convincing. Checked: SYN seq x, SYN-ACK seq y ack x+1, ACK ack y+1, RTT = 2 x 80ms.

### TCP reliability and retransmission (`tcp-reliability`)

**The aha**: Reliability is built from numbering, acknowledging and resending over a network that
freely loses and reorders packets — and the price is that one lost packet delays everything
behind it.
**Misconception to defeat**: Confusing a TCP retransmission with an application-level retry (an
HTTP client's own timeout).
**Cast**: A sender streaming numbered segments (1-6; real TCP numbers bytes, segments keep it readable), a receiver with a reorder buffer, ACKs travelling back, a timeout clock.
**Opening frame**: Segments 1-6 queued, buffer empty. _"Numbered, ready to send."_
**Story**:

1. Segments 1 and 2 arrive and are acknowledged ("ACK 3": next one expected). _"Acknowledge what's arrived, up to here."_
2. Segment 3 bursts (lost); 4, 5 and 6 arrive fine but sit buffered, withheld from the app. _"4, 5 and 6 are here, but stuck waiting for 3."_
3. Each arrival of 4, 5 and 6 sends another "ACK 3": three duplicate ACKs pile up. _"Three duplicate ACKs: something specific is missing."_
4. The sender retransmits 3 immediately, without waiting for the timer. _"Fast retransmit: don't wait if the pattern's obvious."_
5. Segment 3 arrives; 3, 4, 5, 6 release to the application together. _"Now the gap is filled, everything releases at once."_
6. Contrast: the last segment (6) is lost instead. Nothing follows it, so no duplicate ACKs; the sender waits out the full timeout clock, visibly slower. _"No pattern? Wait for the timeout."_
7. A caption on the app: it saw only a delay, never the loss. _"The app never knew. An HTTP client's own timeout is a separate, much longer clock."_
   **The moment**: Beats 2-5: segments 4, 5 and 6 sitting idle the entire time 3 is missing, then all four releasing in the same instant 3 arrives.
   **Interaction**: Choose which segment to drop and whether duplicate ACKs trigger fast retransmit
   or the full timeout.
   **Ending**: All six segments delivered in order, buffer empty, the application having seen only a pause.
   **Variants**: `tcp-vs-udp`, `tcp-congestion-control`, `head-of-line-blocking`.
   **Techniques**: token, contents, timer, failure, exchange, caption.
   **Review**: Improved — beat 3 was wrong: with only segments 4 and 5 behind the loss there are two duplicate ACKs, but fast retransmit needs three; segment 6 was added so the numbers work, and the "no duplicates" contrast is now a genuine tail loss. Added beat 7 to defeat the retransmission-vs-app-retry mix-up. Weighed a lost-parcel postal analogy; the idle buffer is the sharper image. Checked: cumulative ACK, 3 dup ACKs trigger fast retransmit, RTO fallback.

### TCP flow control and window size (`tcp-flow-control`)

**The aha**: Throughput can never exceed window ÷ round-trip time — a 64 KB window over a 100ms
path caps a transfer at about 5 Mbit/s, however fast the link actually is.
**Misconception to defeat**: Confusing flow control (protects the receiver's buffer) with
congestion control (protects the network).
**Cast**: A sender, a receiver whose application reads from a buffer gauge (64 KB), an advertised window value, a throughput meter, a round-trip-time dial, and a link capacity of 50 Mbit/s.
**Opening frame**: Buffer empty, window 64 KB, nothing sent. _"The receiver sets the limit: 64 KB
in flight, no more."_
**Story**:

1. The sender sends up to 64 KB unacknowledged, then stops; the gauge fills toward 64 KB. _"Never more than the window, unacknowledged."_
2. An ACK arrives, the gauge drops, more room opens. The receiving app then slows down: the buffer fills, the advertised window shrinks toward 0 and the sender pauses. _"Flow control: the receiver says how much room it has left."_
3. The app recovers. The RTT dial is turned from 10ms to 100ms; the throughput meter, near the 50 Mbit/s link speed before (64 KB / 10 ms is about 52), drops sharply to about 5 Mbit/s though the link is unchanged. _"Same window, longer round trip: throughput collapses."_
4. A formula card: "Throughput <= window / RTT," filled live: 64 KB / 100 ms = about 5 Mbit/s. _"The bandwidth-delay product: the hard ceiling."_
5. The window is widened (window scaling, agreed in the handshake) to 1 MB; at the same RTT, throughput jumps back to the link's real 50 Mbit/s. _"Window scaling: lift the ceiling to match the distance."_
   **The moment**: Beat 3 — turning only the RTT dial, touching nothing about the link's actual
   speed, and watching throughput collapse anyway.
   **Interaction**: Drag the RTT dial and the window-size dial independently and watch throughput
   respond to both.
   **Ending**: Window scaled to match the RTT, throughput meter pinned near the link's real
   capacity.
   **Variants**: `tcp-congestion-control`, `tcp-handshake`, `mtu-and-fragmentation`.
   **Techniques**: meter, dial, contents, chart, caption.
   **Review**: Improved — added the actual flow-control moment (a slow reader shrinking the window to zero) so flow-vs-congestion is shown, not just named; pinned the link at 50 Mbit/s so "near full speed at 10 ms" is true (64 KB / 10 ms is ~52 Mbit/s; on a faster link it would not be) and the 1 MB window (84 Mbit/s ceiling) visibly hits the link limit. Weighed a pipe-with-a-hose metaphor; the RTT dial with an unchanged link is more surprising. Checked: 65,536 x 8 / 0.1 s = 5.2 Mbit/s.

### TCP congestion control and slow start (`tcp-congestion-control`)

**The aha**: A new connection starts slow and needs several round trips to reach full speed, and
because loss is read as congestion, lossy links get throttled hard — which is why fewer round
trips matters more than raw bandwidth.
**Misconception to defeat**: Confusing congestion control (protects the network, reacts to loss)
with flow control (protects the receiver's buffer).
**Cast**: A sender's congestion-window meter starting small (~10 segments), a receiver-window marker (large, for contrast), a chart of window size over round trips, a link capacity ceiling drawn above at about 60 segments.
**Opening frame**: Window at 10 segments, chart empty, ceiling far above. _"A brand new connection
starts cautious."_
**Story**:

1. Round trip 1: 10 segments sent and acked; the window doubles to 20. _"Slow start: double the window every round trip..."_
2. Round trips 2-3: doubles to 40, then 80; the chart curves upward, accelerating. _"...as long as nothing's lost."_
3. The window crosses the ceiling (60); a segment is lost. The chart drops sharply (Reno halves, CUBIC cuts about 30%), then climbs again slowly, by small additive steps. _"Loss = read as congestion. Back off hard, recover slowly."_
4. The sender may send only the smaller of this window and the receiver's advertised one. _"Two limits: the network's (this) and the receiver's (flow control)."_
5. The chart settles into a repeating sawtooth: climb, hit the ceiling, drop, climb again. _"This sawtooth is TCP probing for the ceiling, forever."_
6. A BBR line overlays the same chart, rising to the ceiling and holding steady, barely dipping on the same loss event. _"BBR estimates the ceiling directly, instead of bumping into it."_
7. Side by side: a 100 KB response on a new connection needs about 3 round trips just in slow start (14.6 + 29 + 58 KB), versus the same data over an already-open, warmed-up connection sent at once. _"Fewer round trips wins more than more bandwidth."_
   **The moment**: Beat 3's sharp drop right as the chart was accelerating fastest — "doing better"
   (bigger window) directly causing "doing worse" (loss, then halving).
   **Interaction**: Let the connection run and watch the sawtooth repeat; toggle Reno/CUBIC versus
   BBR; shorten the connection's lifetime and see how much of the ceiling it reaches.
   **Ending**: Chart settled into a steady sawtooth near the ceiling, BBR's smoother line visible
   above for comparison.
   **Variants**: `tcp-flow-control`, `tcp-reliability`, `tcp-handshake`.
   **Techniques**: chart, meter, failure, side by side, caption.
   **Review**: Improved — added numbers that check out (IW10 doubling: 14.6, 29, 58 KB cumulative to ~102 KB in 3 round trips), corrected "window halved" for CUBIC (about 30% cut), and added beat 4 (sender uses the smaller of cwnd and receiver window) so the flow-vs-congestion misconception is defeated on screen. Weighed a road-traffic-merging metaphor; the chart is the idea. Checked: IW10, slow start doubling, AIMD, BBR.

### TCP teardown, reset and TIME_WAIT (`tcp-connection-teardown`)

**The aha**: Closing is a negotiation, not an instant — each side closes its own direction with
FIN/ACK, while an RST means something actively refused or killed the connection, and silence just
means something dropped it.
**Misconception to defeat**: Confusing a timeout (no answer at all) with a refusal (an explicit
RST).
**Cast**: A ladder diagram, each direction of the connection as a separate arrow (so it can be
half closed). A TIME_WAIT badge that attaches to whichever side closes first.
**Opening frame**: Connection fully open, both directions flowing. _"A two-way street, about to
close."_
**Story**:

1. Client sends FIN (closing only its send direction); server ACKs. The client-to-server arrow fades; server-to-client can keep flowing. _"Half closed: client's done sending, server can still reply."_
2. The server finishes its own sending, sends its own FIN; client ACKs. Fully closed. _"Each side closes its own direction, in its own time."_
3. A TIME_WAIT badge attaches to the client (closed first), a 60-second countdown. _"The side that closed first waits, in case a stray packet with this exact 5-tuple shows up."_
4. Contrast ladder: a SYN to a closed port is answered instantly with a sharp jagged RST. _"RST: an explicit refusal. 'Connection refused' (mid-stream: 'reset by peer')."_ No TIME_WAIT.
5. Third ladder: a request met with silence, no FIN, no RST, no ACK, a clock ticking until it times out on its own. _"Silence isn't a refusal. Something just dropped it."_
6. Zoom out: a client or NAT making thousands of short connections to one server shows a pile of TIME_WAIT badges, each holding a source port for 60 seconds. _"Thousands of short connections, thousands of held ports."_
   **The moment**: The three ladders side by side: same ending (no connection), three completely different stories (graceful FIN, instant RST, silence), distinguishable only by what's on the wire.
   **Interaction**: Choose which teardown to play (FIN, RST, silence) and watch the TIME_WAIT badge
   appear only for the first.
   **Ending**: All three ladders resting side by side, same end state, visibly different paths there.
   **Variants**: `tcp-handshake`, `tcp-keepalive-and-idle-timeouts`, `snat-port-exhaustion`.
   **Techniques**: exchange, timer, restyle, side by side, failure, caption.
   **Review**: Improved — beat 6 put the TIME_WAIT pile on a busy server, but the port-exhaustion danger lands on whoever closes first and reuses source ports to one destination (a client or NAT); beat 4 now uses the everyday RST (a closed port, "connection refused") against silence (firewall drop), the exact timeout-vs-refused distinction in the misconception. Weighed three separate mini-plans; the side-by-side is the point. Checked: FIN/ACK half-close, 60 s TIME_WAIT on Linux, RST skips TIME_WAIT.

### Keepalives and idle timeouts (`tcp-keepalive-and-idle-timeouts`)

**The aha**: Cloud NAT gateways, load balancers and firewalls silently drop flows idle for a few
minutes, far sooner than the OS's own 2-hour keepalive default — so an idle pooled connection
dies without telling either end, and the next request on it just hangs or resets.
**Misconception to defeat**: Confusing TCP keepalive (detecting a dead peer) with HTTP keep-alive
(reusing one connection for several requests — same name, different thing).
**Cast**: A client, a connection pool holding an idle connection (labelled "HTTP keep-alive: reuse"), a NAT gateway with an idle-timeout clock (350s), a server, and a separate OS keepalive clock (2h, and only if the app switched keepalive on) on the client.
**Opening frame**: An open, idle connection, both clocks at zero. _"Idle. Two very different
clocks are running."_
**Story**:

1. Time fast-forwards; the NAT's 350-second clock reaches zero first and silently removes its table row. _"The NAT just forgets about it. Quietly."_
2. The pooled connection sits there looking perfectly fine to both ends. _"As far as either end knows, it's still open."_
3. The OS keepalive clock, only about six minutes into its two-hour countdown, hasn't fired. _"The default keepalive is nowhere close to catching this."_
4. The app pulls the connection from the pool to reuse it and sends a request; it has nowhere to go, hanging or coming back as an RST. _"The next request on it just hangs, or gets reset."_
5. Fix: TCP keepalive probes (empty packets, labelled differently from the pool's reuse) every 60s, well under the NAT's 350, refresh its row before it can expire. _"Keep it under the shortest timeout on the path, and it never goes idle long enough to matter."_
   **The moment**: Beats 1–3 — the NAT's clock firing silently while the OS keepalive clock is barely
   minutes into a two-hour wait.
   **Interaction**: Drag the keepalive interval above or below the NAT's idle timeout and watch
   whether the connection survives; fast-forward time to see the NAT row expire.
   **Ending**: Keepalive interval set under the NAT's timeout, the pool staying healthy indefinitely.
   **Variants**: `nat-gateway`, `tcp-connection-teardown`, `head-of-line-blocking`.
   **Techniques**: timer, failure, token, meter, dial, caption.
   **Review**: Improved — labelled the pool's reuse as HTTP keep-alive and the probes as TCP keepalive on screen so the same-name misconception is defeated visibly; noted the OS default is both 2 hours and off unless the app enables it. Weighed a bar-tab-closed-without-telling-you metaphor; the two clocks side by side are the exact mechanism. Checked: AWS NAT gateway 350 s (resets on later use), Azure 4 min default, Linux tcp_keepalive_time 7200 s.

### Head-of-line blocking (`head-of-line-blocking`)

**The aha**: Multiplexing at the application layer doesn't help if the transport underneath is
still one ordered pipe — only giving each stream its own independent delivery (QUIC) removes the
blocking.
**Misconception to defeat**: Confusing head-of-line blocking (data waiting behind a stuck item)
with plain congestion (the network being full).
**Cast**: Three scenarios stacked. HTTP/1.1: one connection, one request at a time, a queue
behind it. HTTP/2: one TCP connection carrying interleaved streams (different colours). HTTP/3:
several independent streams.
**Opening frame**: All three side by side, each with four requests (A, B, C, D). _"Three ways to
share one connection."_
**Story**:

1. HTTP/1.1: A is slow; B, C, D sit queued behind it, untouched. _"One at a time. A slow one blocks everyone behind it."_
2. HTTP/2: A, B, C, D interleave as separate streams inside one connection, all progressing. _"Multiplexed: many streams, one connection."_
3. A single packet carrying a fragment of stream B is lost. TCP must deliver bytes in order, so the whole pipe stalls: A, C and D's data has arrived but is held back. A bandwidth meter beside it sits almost empty. _"One lost packet stalls every stream behind it, on a link that isn't even full."_
4. HTTP/3: the same loss happens, but only stream B's delivery pauses; A, C, D keep flowing without interruption. _"QUIC: each stream delivers independently. One loss, one stall."_
5. Side by side freeze-frame: HTTP/2 fully stalled versus QUIC with three streams flowing and only one paused. _"Same loss. Multiplexing at the app layer isn't enough; the transport has to support it too."_
   **The moment**: Beats 3–4 — identical single packet loss, one architecture freezing everything,
   the other isolating the damage to one stream.
   **Interaction**: Choose which stream loses a packet and watch HTTP/2 versus HTTP/3 stall
   differently; toggle HTTP/1.1 in for comparison.
   **Ending**: QUIC's streams fully recovered and flowing, HTTP/2's frame still mid-stall for
   contrast.
   **Variants**: `quic`, `http-versions`, `tcp-reliability`.
   **Techniques**: lanes, token, failure, side by side, spotlight, caption.
   **Review**: Improved — added an idle bandwidth meter in beat 3 so head-of-line blocking is visibly not congestion (the pipe is empty yet everything waits). Weighed a supermarket-queue metaphor (HTTP/1.1) ; it only covers beat 1, whereas the loss-in-the-pipe is the surprising case. Checked: HTTP/1.1 sequential per connection, HTTP/2 over one TCP stalls on loss, HTTP/3 per-stream recovery.

### QUIC (`quic`)

**The aha**: QUIC folds the transport and TLS handshakes into one round trip (zero on
resumption), gives every stream independent delivery, and survives a phone switching from Wi-Fi
to cellular because it identifies connections by an ID, not by IP and port.
**Misconception to defeat**: Confusing QUIC (the transport, RFC 9000) with HTTP/3 (the HTTP
mapping on top of it), or thinking it's just plain UDP.
**Cast**: Client and server lifelines. Side by side: a "TCP + TLS" ladder (two stacked
handshakes) versus a "QUIC" ladder (one combined handshake). A connection-ID badge instead of an
IP:port pair. Multiple independent streams inside one QUIC connection.
**Opening frame**: Two ladders side by side, both at rest. _"Same goal: a secure connection,
ready for data."_
**Story**:

1. A small stack for each: HTTP/3 on QUIC on UDP versus HTTP/2 on TLS on TCP. QUIC contains its own streams, loss recovery and TLS 1.3 and runs in user space. _"QUIC is the transport. HTTP/3 is just what rides on it."_
2. TCP+TLS: SYN/SYN-ACK/ACK (one round trip), then, only after, the TLS 1.3 handshake begins its own exchange (another round trip). _"TCP, then TLS, stacked: two round trips."_
3. QUIC, same moment: a single combined handshake carries both transport setup and TLS 1.3 key exchange, one round trip. _"QUIC: folded into one round trip."_
4. On a repeat visit (resumption), the request goes out with the very first message, zero extra round trips. _"Resumption: 0-RTT. Data from message one (safe only for repeatable requests)."_
5. Inside the connection, several streams run independently; one stream's packet loss stalls only that stream. _"Independent streams: built in, not bolted on."_
6. The client's phone switches from Wi-Fi to cellular mid-connection; its IP changes entirely, but the connection-ID badge stays fixed and the data keeps flowing. _"Identified by connection ID, not IP and port: survives a network change."_
7. A corporate firewall blocks UDP 443; the QUIC attempt fails and the client transparently falls back to TCP+TLS. _"Where UDP is blocked, it falls back."_
   **The moment**: Beat 5 — the IP address visibly changing mid-connection while the connection ID
   stays fixed and data keeps flowing, something TCP's IP:port identity could never survive.
   **Interaction**: Toggle new connection versus resumption and see the round-trip count change;
   trigger a Wi-Fi-to-cellular switch; drop a packet on one stream and see only that stream pause.
   **Ending**: QUIC connection stable, streams flowing independently, connection ID unchanged despite
   the network having changed twice.
   **Variants**: `tcp-vs-udp`, `head-of-line-blocking`, `tcp-handshake`, `http-versions`.
   **Techniques**: exchange, lanes, token, restyle, failure, timer, caption.
   **Review**: Improved — added a stack beat so "QUIC is not HTTP/3, and not plain UDP" is defeated on screen (it was only in the cast), and a replay caveat on 0-RTT. Weighed building the story around migration alone (the best moment, and kept as such); the handshake saving is the reason people deploy it, so it leads. Checked: TCP+TLS 1.3 = 2 RTT, QUIC = 1 RTT, 0-RTT on resumption, connection IDs, UDP 443 fallback, RFC 9000.
