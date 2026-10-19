# Networking plans, part 3

Stage 2 plans for `catalog/networking.md` groups 9 to 12, in catalog order. They use the shared
networking language (also used by parts 1 and 2): hosts are small computers or servers with their
IP address as a label; a packet is a small envelope with visible header fields (src, dst, port);
routers are round junctions with a routing-table card, the matching row lighting up; the internet
is a cloud; a cloud virtual network is a large framed area with its CIDR on the frame, subnets as
smaller labelled frames inside it, public ones edged in one colour and private in another, route
tables as small cards attached to subnets, gateways as doorways in the network's frame (internet
gateway, NAT gateway, VPN gateway); firewall rules are a short rule list beside the thing they
guard, with the matching rule lighting up and the packet ticking ✓ or bouncing ✗; an on-premises
data centre is a building on the left; time-ordered exchanges are ladder diagrams (vertical
lifelines, slanted arrows travelling down in order). No new technique was needed; every plan below
draws only on the vocabulary in `README.md`.

`network-segmentation` is owned by Security and is skipped here.

## Cloud virtual networks

### Virtual private cloud (VPC, VNet) (`vpc`)

**The aha**: A VPC is your own network, built entirely in software, inside someone else's data centre — isolated from the outside by default, with nothing able to go in or out until you deliberately add gateways, routes and rules.
**Misconception to defeat**: That a VPC is a VPN, or that it's just an account/subscription boundary.
**Cast**: A large frame labelled "VPC · 10.0.0.0/16", sealed solid on every side, sitting inside a lighter shaded region labelled "region / account". Two empty, dashed subnet frames inside it.
**Opening frame**: The sealed frame with its CIDR label, no doors anywhere, two blank subnet outlines inside. _"Your own network. Nothing crosses the edge yet."_
**Story**:

1. The two subnet frames fill in as `10.0.1.0/24` and `10.0.2.0/24`, sub-frames of the `/16`, each with a host. A packet from one host to the other crosses inside the frame at once, ticking ✓ along the built-in `10.0.0.0/16 → local` row. _"Carve it into subnets. Inside, they already reach each other."_
2. A packet from the first host aimed at the internet hits the sealed frame wall and bounces ✗. _"No gateway, no path — however good the rules are."_
3. A doorway (internet gateway) opens in the frame; the subnet's route-table card gains a row, `0.0.0.0/0 → igw`; the host gets a public IP tag. The same packet now ticks ✓ through the door.
4. Pull back to show the account/region boundary around several VPCs, dashed. A token tries to cross from one VPC to another with no path drawn at all, and stops. _"An account isn't a network. A VPC isn't a tunnel, either: it is the network itself."_
   **The moment**: Beat 2 into beat 3 — the identical packet, unreachable then reachable, purely because the frame gained a door and the subnet gained a route. Isolation is the default; every bit of outside connectivity is a deliberate addition.
   **Interaction**: Add or remove the internet gateway and its route; watch the packet's fate flip.
   **Ending**: The frame with its one door, route card lit, host reachable. _"Your own network — until you open a door."_
   **Variants**: `public-vs-private-subnets`, `vpc-route-tables`, `internet-gateway`, `vpc-peering`. The door vocabulary is AWS's; in Azure a VNet gets default outbound internet access without any gateway, so the cleaner frame there is "inbound closed until you add a public IP".
   **Techniques**: boundary, appear / disappear, token, failure, restyle, contents, caption.

**Review**: Improved — added the implicit local route (subnets in one VPC already reach each other, which beat 3 and `vpc-route-tables` rely on), made the VPN-vs-VPC misconception explicit on screen, and flagged the Azure difference. Facts checked: new VPCs have no internet path until an IGW plus a route plus a public IP; the local route cannot be removed. Alternative weighed: opening with "house with no doors"; the sealed frame already is that picture.

### Public vs private subnets (`public-vs-private-subnets`)

**The aha**: Public or private isn't a label stuck on a subnet at creation — it's decided by its route table: a route to an internet gateway makes it public, its absence makes it private.
**Misconception to defeat**: That subnets are born public or private, like a fixed attribute.
**Cast**: A VPC frame with two subnets side by side, each with a route-table card. One edge turns amber (public), the other blue (private), per the shared colour convention.
**Opening frame**: Two identical grey subnet frames, both route cards holding only the implicit local route. _"Same shape. What makes one public?"_
**Story**:

1. Subnet A's card gains a row, `0.0.0.0/0 → igw-1`. Its edge recolours amber. _"A route to the internet gateway — now it's public."_
2. A host in A gets a public IP tag. Subnet B's card still shows only the local route; its edge is blue.
3. A host in B tries to reach the internet directly: no matching row, the packet bounces ✗ at the subnet edge. _"Private doesn't mean blocked — it means no path out, yet."_
4. Drag the route-table card from A onto B: B turns amber, A turns blue, hosts and all. Then delete A's row instead: its public-IP host can no longer get out either. _"Public is the route table, not a label from creation."_
5. Settle into the standard layout: load balancer and NAT gateway in the amber subnet, app and database behind them in the blue one.
   **The moment**: Beat 4 — one route row moved or removed, and the whole subnet's colour and reachability flip together, proving "public" lives in the route table. A public IP alone, with no route, gets nothing.
   **Interaction**: Toggle the `0.0.0.0/0` row, or swap the cards between subnets; watch colour and packet fate update live.
   **Ending**: The standard two-tier layout, amber subnet fronting blue. _"Public and private are routes, not real estate."_
   **Variants**: `vpc`, `vpc-route-tables`, `internet-gateway`, `nat-gateway`.
   **Techniques**: restyle, toggle, token, failure, contents, caption.

**Review**: Improved — beat 4 now swaps the route-table card between subnets (a sharper proof than deleting a row alone) and says outright that a public IP without the route is useless. Facts checked: AWS "public subnet" is defined by an IGW route; NAT gateways sit in public subnets; load balancers face the internet from public subnets. Alternative weighed: a security-group-based framing; worse, because SGs filter and never create the path.

### Cloud route tables (`vpc-route-tables`)

**The aha**: Each subnet is associated with a route table that is its own map of the world — two subnets in one VPC can behave completely differently, and the most specific matching row wins, which is how you force one range through a firewall.
**Misconception to defeat**: That one routing table governs the whole VPC, or that the VPC needs a row for its own subnets.
**Cast**: A VPC frame with three subnets (A, B, C), each carrying its own route-table card (destination → next hop rows), every card starting with the locked `10.0.0.0/16 → local` row. A firewall appliance box off to the side, and an on-premises network cloud.
**Opening frame**: Three subnets, three different cards. _"Each subnet reads its own map."_
**Story**:

1. Subnet A gets `0.0.0.0/0 → igw`; a packet to the internet lights that row and leaves.
2. Subnet B's card instead reads `0.0.0.0/0 → nat-gateway`. The same destination, a different door. _"Same VPC, same destination, a different route."_
3. Subnet C gets a specific row above its default, `203.0.113.0/24 → firewall-appliance`. A packet to `203.0.113.5` lights that row and detours through the firewall before continuing; a packet to any other internet address skips it via the default row. _"Longest prefix wins: a /24 beats the /0 default. That's how you force one range through inspection."_
4. A packet from B to a host in A matches the local row, which sits on every card and cannot be deleted, and goes straight across with no gateway involved. Then a packet from B to `192.168.4.7` (on-premises) matches nothing and is dropped at B's edge. _"Local is automatic. Everything else needs a row."_
   **The moment**: Beat 3 — two destinations from the same subnet, resolved by two different rows, one detoured through inspection and one not, showing route tables decide the path, not the firewall's mere presence.
   **Interaction**: Add, remove or reorder rows and watch packets re-route live; add an overlapping more-specific route and see it win (order on the card never matters, only prefix length).
   **Ending**: Three subnets, three different behaviours, one VPC. _"The VPC doesn't route — its subnets' tables do."_
   **Variants**: `public-vs-private-subnets`, `internet-gateway`, `nat-gateway`, `network-firewall`.
   **Techniques**: contents, token, path trace, restyle, caption.

**Review**: Improved — fixed a real error: the old beat 4 had a subnet "D" (not in the cast) unable to reach subnet A "because no row", but every subnet in a VPC reaches the others through the implicit local route. Replaced with local vs missing on-prem route. Also corrected the caption ("/24 beats /16 beats default" mixed in the local /16 that is not in play) to longest-prefix wins. Alternative weighed: one table with a subnet picker; the three cards side by side show the misconception directly.

### Internet gateway (`internet-gateway`)

**The aha**: The gateway translates addresses one-to-one at the VPC's edge — the instance itself never sees its own public IP.
**Misconception to defeat**: That the instance "has" the public IP the same way it has its private one.
**Cast**: A VPC frame with a doorway labelled "IGW". A host inside shows only its private IP; a public-IP tag floats outside the frame, next to the door, not on the host.
**Opening frame**: Host showing `10.0.1.5`; a tag `203.0.113.20` sitting at the door. _"The host only knows its private address."_
**Story**:

1. The host sends a packet, src `10.0.1.5`. At the door it's rewritten: src becomes `203.0.113.20`. _"Outbound: swapped as it passes."_
2. The reply, addressed to `203.0.113.20`, arrives at the door and is rewritten back to `10.0.1.5` before delivery. _"Return: swapped back."_
3. Peek inside the host's own network interface settings: only `10.0.1.5` appears. _"The machine never sees its own public address."_
4. A second host with no public-IP tag, or with a tag but no route: its packet reaches the subnet edge and bounces ✗. _"Needs both — a public IP and a route."_
5. Side by side with a NAT gateway's door, which only ever opens outward: an inbound packet aimed at it is refused, while the same packet reaches the IGW host (the security group allows it) fine. _"Internet gateway: two-way. NAT gateway: one-way."_
   **The moment**: Beat 3 — looking inside the host and finding no trace of the public address at all; the translation belongs entirely to the gateway.
   **Interaction**: Send a packet inbound to the IGW host (allowed) and the same packet toward a NAT gateway (refused).
   **Ending**: Host and door, two IPs, one translation happening between them. _"The address the internet sees isn't the one the host sees."_
   **Variants**: `vpc`, `public-vs-private-subnets`, `nat`, `nat-gateway`. In Azure and GCP the same one-to-one translation happens in the platform with no named gateway; the guest OS still only holds the private IP.
   **Techniques**: token, restyle, side by side, failure, caption.

**Review**: Improved — switched the example public IP to the documentation range 203.0.113.0/24, clarified that beat 3 is the operating system's interface config (instance metadata can still report the public IP), and made beat 5 say the inbound reach still needs a security-group allow. Facts checked: IGW does 1:1 NAT for IPv4 only, needs both public IP and route; NAT gateway is outbound-initiated. Alternative weighed: leading with the NAT contrast; it is a different idea, so it stays last as a contrast.

### Security groups (`security-groups`)

**The aha**: Stateful means you write the rule only for the direction that opens the connection — the reply is let back automatically, no matching rule needed. Security groups only ever allow; anything not allowed is denied.
**Misconception to defeat**: That security-group rules need entries for both directions, like a stateless filter, or that you can write a "deny" in one.
**Cast**: A host with a rule-list card ("security group: web-sg"), one inbound row: "Allow TCP 443 from 0.0.0.0/0", and an outbound list that has had its default allow-all row removed (shown empty). A client outside, and a small connection-state table beside the host.
**Opening frame**: Host's rule card, one inbound row, empty outbound list. _"One rule, one direction."_
**Story**:

1. The client's SYN to port 443 checks the card, row lights ✓, passes. A new row opens in the state table: "client:51342 ↔ host:443, open." _"Matches the rule — and the group remembers it's a conversation now."_
2. The server's reply, src port 443, leaves although the outbound list is empty — it sails through because the state table already expects it. _"Statefulness lets the reply out for free."_
3. An unrelated inbound attempt on port 22 matches no row and bounces ✗; a new outbound connection from the host on port 9000 also bounces (outbound is empty here). _"No allow row, no entry. Only allows exist; the rest is denied."_ (A note shows that by default new groups allow all outbound.)
4. The rule's source is changed from an IP range to another group's name, "app-sg". A new instance tagged app-sg spins up; its traffic is allowed immediately, no rule edit. _"Rules can follow a role, not just an address."_
   **The moment**: Beat 2 — the reply leaving through a door with an empty outbound list, purely because the state table remembers the question.
   **Interaction**: Toggle "what if it were stateless?" to watch the reply get dropped until a matching outbound rule is written by hand (this previews `network-acls`; a real security group has no such mode).
   **Ending**: The open state-table row, one inbound rule doing the work of two. _"Write the open; the reply is free."_
   **Variants**: `network-acls`, `vpc`, `stateful-firewall`. Azure NSGs and GCP firewall rules are also stateful but support deny rules and priorities.
   **Techniques**: contents, token, restyle, failure, toggle, caption.

**Review**: Improved — fixed a default-behaviour error: the old beat 3 showed outbound port 9000 blocked with "no outbound rows", but a default AWS group allows all outbound, so the plan now explicitly empties the outbound list and notes the default. Added "allow-only" (no deny rows), which is the other defining difference from NACLs, and made the stateless toggle honest (a preview, not a real SG mode). Alternative weighed: starting from the NACL failure; that is the NACL plan's job.

### Network ACLs (stateless subnet filters) (`network-acls`)

**The aha**: Stateless means the return packet is a brand-new packet needing its own rule — allowing a request in says nothing about letting the reply out.
**Misconception to defeat**: That NACLs behave like security groups, just attached one level higher.
**Cast**: A subnet frame with an ordered NACL card on its boundary, with separate Inbound and Outbound tabs (numbered rows, lowest number evaluated first; an implicit final deny `*`). A host inside, a client outside. This is a custom NACL: the default one allows everything.
**Opening frame**: The subnet edge with one inbound allow row, number 100, and an empty outbound tab. _"Ordered rules. No memory."_
**Story**:

1. The client's SYN to port 443 arrives; inbound row 100 lights ✓, passes to the host. _"Inbound 443: allowed."_
2. The host's reply, to the client's ephemeral port, leaves; every outbound row is checked top to bottom, none matches, it falls to the implicit deny and bounces ✗. _"The reply is a new packet. Nothing remembers the request."_
3. Add outbound row 110: "Allow TCP 1024–65535 to 0.0.0.0/0". The same reply now lights 110 ✓ and leaves.
4. Side by side: the identical exchange through a security group instead, one rule doing both directions. _"Same job, twice the rules."_
5. Insert inbound row 90, "deny 443 from one bad IP", above row 100: that IP's packets now hit 90 first and die, even though 100 would have allowed them. _"Lowest number wins — order is the logic."_
   **The moment**: Beat 2 — the reply bouncing at a boundary that let the request straight through seconds earlier. The classic NACL outage.
   **Interaction**: Add or remove the outbound ephemeral-range row; reorder two rows and see which wins. Send a packet between two hosts inside the same subnet: the NACL never sees it (it only guards the subnet boundary).
   **Ending**: Both rows in place, the full exchange ticking ✓ both ways. _"Stateless: say both halves out loud."_
   **Variants**: `security-groups`, `stateful-firewall`, `vpc-route-tables`, `flow-logs`.
   **Techniques**: contents, token, failure, side by side, path trace, caption.

**Review**: Improved — split the card into inbound and outbound lists (row 110 lives in the outbound list, which the old card didn't show), stated that the default NACL allows all while a custom one denies all, and added the "same-subnet traffic never crosses it" interaction. Facts checked: lowest number first, first match wins, implicit `*` deny, ephemeral ranges (1024–65535 covers NAT gateways and all OSes). Alternative weighed: a customs-officer analogy; the ladder of rows is more exact.

### VPC peering and non-transitivity (`vpc-peering`)

**The aha**: Peering is one-to-one and non-transitive — A↔B and B↔C never adds up to A↔C.
**Misconception to defeat**: That peering is transitive, like roads meeting through a shared town.
**Cast**: Three VPC frames, A (10.1.0.0/16), B (10.2.0.0/16), C (10.3.0.0/16), non-overlapping. A peering line between A–B, a separate one between B–C. No line at all between A and C. Route-table cards at each VPC.
**Opening frame**: A—B peered, B—C peered, A and C unconnected. _"A↔B. B↔C. What about A↔C?"_
**Story**:

1. Routes are added on both sides, `10.2.0.0/16 → pcx-AB` in A and `10.1.0.0/16 → pcx-AB` in B. A host in A reaches a host in B directly over the A–B line, ticks ✓. _"Peering needs a route at each end."_
2. A host in B reaches a host in C over the B–C line, ticks ✓. _"Two direct paths, side by side."_
3. A host in A sends toward C's CIDR: it checks A's route table, finds no route to C — only to B. The packet dies right there, never reaching B at all. A label "not transitive" appears as it fades red.
4. Add a route in A pointing C's range at the A–B peering connection anyway: the packet now crosses to B, then is dropped at the peering connection, which only carries traffic whose source and destination both belong to the two peered VPCs. _"Even with a route, the link won't relay a third network's traffic."_
5. Replace both peerings with a transit gateway hub: the same packet now routes A → hub → C and arrives. _"What peering can't do, a hub can."_
   **The moment**: Beat 3 into beat 4 — the packet dying at its own VPC's edge for want of a route, then, with a forced route, dying at the peering link instead. Two layers of "no" for a path that only exists in the viewer's head.
   **Interaction**: Try to route A→C through B by adding routes and watch it still fail; swap in a transit gateway and watch it succeed.
   **Ending**: A, B, C around a hub, all three reachable. _"What peering can't do, a hub can."_
   **Variants**: `hub-and-spoke`, `transit-gateway`, `vpc`. Also: peered VPCs cannot have overlapping CIDRs. Azure VNet peering is also non-transitive, but there a firewall in the middle with routes pointing at it can relay (see `hub-and-spoke`).
   **Techniques**: boundary, token, path trace, failure, spotlight, caption.

**Review**: Improved — added the route entries at both ends (peering needs them and the old plan showed none), non-overlapping CIDRs, and restated the "even with a route" beat as the packet crossing and being dropped by the link, which matches AWS's documented edge-to-edge limit. Facts checked: non-transitive, no edge-to-edge routing, routes needed both sides. Alternative weighed: a social "friend of a friend" metaphor; the packet dying is more concrete, so it is kept.

### Hub-and-spoke network topology (`hub-and-spoke`)

**The aha**: Centralize what's shared and inspect it once; spokes reach each other only if traffic is deliberately steered through something in the hub that forwards it.
**Misconception to defeat**: That spokes can reach each other once they're both connected to the hub.
**Cast**: A hub VPC frame in the centre holding a firewall icon, a VPN doorway and a bastion. Three spoke VPC frames around it, each with one line to the hub and a route-table card. No lines between spokes.
**Opening frame**: Hub with its shared boxes, three spokes, no spoke-to-spoke lines anywhere. _"Everything shared lives once, in the middle."_
**Story**:

1. Spoke 1's host sends toward the internet; the spoke's route table sends `0.0.0.0/0` to the hub firewall, so the packet travels the spoke–hub line, through the firewall (rule lights ✓), out the hub's internet gateway.
2. Spoke 2's host tries to reach spoke 3's host: spoke 2's table has no row for spoke 3, and the two spokes are only peered to the hub, which doesn't relay by itself. The packet dies at spoke 2's edge. _"Connected to the hub is not connected to each other."_
3. A row is added in spoke 2's table (and spoke 3's, for the reply): the other spoke's CIDR `→ hub firewall`. The same packet now travels spoke 2 → hub firewall → spoke 3, inspected en route. _"The hub forwards only if you steer traffic to it."_
4. A new spoke 4 joins with one line and one default row; it immediately gets the same firewall and the same inspected path to every other spoke that has a matching row.
5. The hub's firewall fails (red flash): every spoke-to-spoke and spoke-to-internet packet bounces ✗ at the hub. _"One door is also one point of failure."_
   **The moment**: Beat 2 into beat 3 — spoke-to-spoke traffic going from no path to an inspected path the instant spoke route tables point at the hub firewall.
   **Interaction**: Add or remove the spokes' rows for each other; fail the hub and watch every spoke lose its shared path at once.
   **Ending**: Four spokes around one hub, every path threading through it. _"One door, everything shared behind it."_
   **Variants**: `vpc-peering`, `transit-gateway`, `network-firewall`. A transit gateway or Azure Virtual WAN hub can replace the hand-built firewall-as-router.
   **Techniques**: boundary, path trace, token, failure, restyle, caption.

**Review**: Improved — fixed where the routes live: the old beat 3 put spoke CIDRs in the hub's table, but with peered spokes it is the spokes' route tables (user-defined routes in Azure) that must send other spokes' ranges to the hub firewall, which then forwards. Also made the failure beat state the single-point-of-failure cost. Alternative weighed: a wheel-and-spokes hub-airport metaphor; the route card is the true mechanism, so kept literal.

### Transit gateway (cloud transit router) (`transit-gateway`)

**The aha**: A transit gateway is a routed hub connecting many networks transitively, using its own route tables to decide who may reach whom.
**Misconception to defeat**: That it's just convenient peering, or that it inspects traffic like a firewall.
**Cast**: A round "TGW" hub icon with two named route-table cards, "prod" and "dev". Four VPCs (prod-app, prod-db, dev-app, shared-services) each attached by a spoke line, plus a VPN attachment and an on-premises building.
**Opening frame**: TGW with its two table cards, four VPCs and a VPN attached. _"One router. Many networks. Its own routing logic."_
**Story**:

1. prod-app reaches prod-db: the "prod" table (associated with prod-app's attachment) has a route to prod-db's attachment, so the TGW forwards it, ticks ✓. Each VPC's own route table also points the other ranges at the TGW. _"Transitive — through the hub, not a direct peering."_
2. dev-app sends toward prod-db: reaches the TGW, but the "dev" table (associated with dev-app's attachment) has no route there — only to dev's own ranges and shared-services. It is dropped inside the hub itself. _"Different attachments, different tables, different reach."_
3. Both tables hold a route to shared-services, so prod-app and dev-app both reach it, and shared-services' own table has routes back to both. _"Routes in both directions, or the reply dies."_
4. A malicious packet from prod-app to prod-db passes through the TGW untouched: the hub forwards by route, it doesn't inspect. _"It routes. It doesn't look inside."_
5. prod-app reaches on-premises over the VPN attachment, via a route in the same "prod" table. A counter shows 6 peerings needed for four VPCs against 4 attachments here.
   **The moment**: Beat 2 — dev-app's packet dying inside the hub itself, not at a VPC edge, because its own route table simply has no path there. The hub both connects and deliberately withholds.
   **Interaction**: Move an attachment between the "prod" and "dev" tables and watch which spokes it can suddenly, or no longer, reach.
   **Ending**: Four VPCs and a VPN around the TGW, two colour-coded tables showing who reaches whom. _"A router in the middle, with rules about who it routes for."_
   **Variants**: `vpc-peering`, `hub-and-spoke`, `network-firewall`. Azure Virtual WAN and Google Network Connectivity Center play the same role.
   **Techniques**: contents, path trace, token, failure, restyle, meter, caption.

**Review**: Improved — replaced the "cost ticker" with a count of links (the TGW is not cheaper per gigabyte than peering, so a cost claim would mislead), added a beat that defeats the "it inspects" misconception (the old plan named it but never showed it), and made the return routes explicit. Facts checked: n(n−1)/2 = 6 peerings for 4 VPCs; each attachment is associated with exactly one TGW route table; routes can be propagated or static. Alternative weighed: showing only the hub; the VPC-side route rows are needed to be accurate.

### Bastion host (jump box) (`bastion-host`)

**The aha**: Send all admin access through one audited, locked-down door instead of giving every machine a public IP — and the best door has no listening port at all.
**Misconception to defeat**: That a bastion is the same thing as a VPN — network-wide access versus one watched hop; and that any jump box is automatically safe.
**Cast**: A VPC frame; a private subnet inside with several hosts, none with public IPs. A bastion host in a public subnet with its own rule card and a scrolling log strip beneath it. An admin on the left and an attacker scanning the internet.
**Opening frame**: An admin outside, private hosts dark with no public IPs, the bastion as the one marked doorway. _"One way in. Everything else is dark."_
**Story**:

1. The admin tries to reach a private host directly: it has no public IP, so no path exists at all. _"Nothing to attack from outside."_
2. The admin connects to the bastion instead; its rule card's row (SSH from the office IP range) lights ✓; the log strip gains a line, "admin connected, 14:02." From the bastion, a second hop to a private host logs "admin → host-3, 14:03." _"Every hop after the door is on the record."_
3. The attacker scans the internet: the bastion's open port 22 answers and credential guessing begins (hammering ✗ at the rule card and keys). _"A visible port is something to attack, even when hardened."_
4. Swap in the modern version: the bastion's inbound port disappears; an agent on each host dials outbound to a managed service (AWS Session Manager style), and the admin signs in through their identity with the session recorded. (Azure Bastion and Google IAP are managed front doors instead: no public IPs on targets, but the front door itself still listens, behind identity.) _"The best door isn't hardened. It's absent."_
5. Side by side with a VPN: the VPN admits the laptop to the whole private subnet at once; the bastion admits the admin to one audited hop at a time.
   **The moment**: Beat 3 against beat 4 — the same scanning attacker finding an open port, then finding nothing.
   **Interaction**: Toggle between a classic bastion (open port 22) and the outbound-only agent; run the port scanner each time, and try connecting from an IP off the allow-list.
   **Ending**: Private subnet fully dark, one logged door, the log strip scrolling. _"Every admin session, one door, every hop on the record."_
   **Variants**: `point-to-site-vpn`, `zero-trust-network-access`, `security-groups`.
   **Techniques**: boundary, token, failure, contents, restyle, toggle, side by side, caption.

**Review**: Improved — folded in the better ideas from Security's merged `bastion-host` plan (the attacker port-scan before/after as the moment, and session recording); corrected the "managed version" claim: only agent-based tools such as AWS Session Manager are truly outbound-only, while Azure Bastion and Google IAP still have a managed listening front door. A bastion logs per-hop only when session logging is configured, now implied by "recorded". Alternative weighed: ending with the VPN contrast; kept as a closing beat since it is a misconception, but the scan is the more memorable failure.

## Hybrid connectivity and private access

### Site-to-site VPN (IPsec) (`site-to-site-vpn`)

**The aha**: It's a private path built from encrypted tunnels over the public internet — convenient, but its performance depends entirely on that internet path underneath.
**Misconception to defeat**: That it behaves like a dedicated, guaranteed-bandwidth private line.
**Cast**: An on-premises building on the left with a VPN device, the internet cloud in the middle, a VPN gateway doorway in a VPC frame on the right. Two tunnel lines, primary and secondary, through the cloud, each labelled "IPsec".
**Opening frame**: Building, cloud, VPC, two dashed tunnels drawn through the cloud. _"Two networks, joined by tunnels through the public internet."_
**Story**:

1. A ladder diagram between the two gateways shows the IKE exchange negotiating keys, then the tunnel turning solid. _"Agreeing on keys first."_
2. A packet from an on-premises host travels inside the tunnel — an envelope inside an envelope, the outer header carrying the two gateways' public addresses and marked "ESP", the encrypted inner packet carrying the real private addresses.
3. It surfaces at the VPC gateway, is decapsulated, and is delivered to a cloud host with both original private addresses intact. _"The two networks route to each other, as if directly wired."_
4. A traffic-jam icon appears along the internet cloud beneath the tunnel: the tunnel's throughput meter drops and latency ticks up, with no VPN setting touched. A per-tunnel ceiling (about 1.25 Gbps on AWS) is marked on the meter. _"The tunnel's speed is only as good as the internet underneath it."_
5. The primary tunnel fails (red flash); a short dead-peer-detection timer runs, then traffic moves onto the secondary. _"Two tunnels, so one can fail. Not instantly, though."_
   **The moment**: Beat 4 — the tunnel's own meters sagging purely because the internet underneath it got busy, dispelling the "dedicated line" myth.
   **Interaction**: Drag an "internet congestion" dial and watch the throughput and latency meters respond; fail one tunnel and watch failover.
   **Ending**: Both tunnels shown, one active, one standby, packets flowing. _"Private addressing, public path."_
   **Variants**: `point-to-site-vpn`, `dedicated-interconnect`, `tunneling`.
   **Techniques**: exchange, token, stream, meter, timer, failure, caption.

**Review**: Improved — failover is no longer "instant" (it waits for dead-peer detection or BGP timers, seconds to a minute), the ESP envelope now names the outer vs inner addresses, and the per-tunnel throughput ceiling is on the meter. Facts checked: IKEv2 negotiates, ESP encapsulates in tunnel mode, two tunnels per connection, about 1.25 Gbps per AWS tunnel. Alternative weighed: a "tunnel through a mountain" metaphor; worse, because the mountain hides that the road beneath is shared and public.

### Point-to-site (client) VPN (`point-to-site-vpn`)

**The aha**: A client VPN puts the whole device "inside" the network — once connected, it can reach whatever the routes and rules allow, which is almost always broader than the one thing it needed.
**Misconception to defeat**: That it only grants access to the specific resource someone had in mind.
**Cast**: A laptop on the left with a VPN client icon. A VPC frame on the right holding an app server, a database and admin tools. A connect/disconnect toggle.
**Opening frame**: Laptop disconnected; the whole VPC dimmed from its point of view. _"Before connecting: none of it is reachable."_
**Story**:

1. The laptop authenticates (certificate, RADIUS or identity-provider icon lights ✓) and connects; it gets a new private IP from the VPN's client address pool, a separate range that the VPC routes back to.
2. The laptop reaches the app server, ticks ✓. _"That's what it needed."_
3. Without any extra step, the laptop also reaches the database and the admin tools — all three light up, because nothing in the routes or rules tells them apart. _"It also reaches everything else the network allows."_
4. A security-group rule is tightened to admit the VPN pool to the app server only: the other two go dark again. _"You can narrow it. But now you are writing per-app access by hand."_
5. Side by side: swap the VPN for a ZTNA connection reaching only the app server by design — the database and admin tools stay dim, no rules edited. Split versus full tunnel shown as a one-line toggle: which of the laptop's own traffic goes through the tunnel.
   **The moment**: Beat 3 — the database and admin tools lighting up unrequested, when only the app server was ever asked for.
   **Interaction**: Toggle split/full tunnel; swap VPN for ZTNA and watch reachability narrow to one app.
   **Ending**: The laptop's full reach into the VPC beside the ZTNA panel's single lit app. _"In the network, or at one door of it."_
   **Variants**: `site-to-site-vpn`, `zero-trust-network-access`, `bastion-host`.
   **Techniques**: token, restyle, toggle, side by side, spotlight, caption.

**Review**: Improved — fixed a factual error (a client does not get an IP "inside the VPC's range"; AWS Client VPN and Azure P2S assign addresses from a separate client pool that must not overlap the network), and replaced the split/full-tunnel beat, which was about a different question (what traffic goes in the tunnel), with the tighten-the-rules beat that actually serves the aha. Alternative weighed: leading with the ZTNA contrast; it needs the wide-reach picture first, so it stays last.

### Dedicated interconnect (`dedicated-interconnect`)

**The aha**: It bypasses the internet entirely for predictable latency and bandwidth, but it isn't encrypted by default, and it takes days to weeks to provision — plan the redundancy yourself.
**Misconception to defeat**: That "private" means "encrypted", or that it's as quick to set up as a VPN.
**Cast**: An on-premises building connected by a solid physical line straight to a "provider edge" box, bypassing the internet cloud icon entirely, then into the VPC via a doorway. A provisioning calendar; a greyed-out padlock beside the cable. Names: ExpressRoute, Direct Connect, Cloud Interconnect.
**Opening frame**: The straight physical line, the internet cloud sitting unused off to the side. _"A physical circuit. The public internet isn't involved."_
**Story**:

1. Side by side with a site-to-site VPN: the VPN's packet wobbles through the internet cloud, its latency meter jittering; the interconnect's packet runs the straight line, latency meter steady. _"Steady, not magic: it still has distance."_
2. The padlock beside the cable stays open; a packet travels in plain. _"Private path, not private content — add MACsec or IPsec yourself."_
3. A calendar flips forward days to weeks while the circuit is ordered, cross-connected and BGP comes up, beside the VPN's setup finishing in minutes in the same frame.
4. The single cable snaps (red flash); all traffic stops, with no fallback VPN configured. _"One circuit, one point of failure."_
5. Redo with a second circuit to a different location plus a VPN as backup: the first cable snaps again, but BGP withdraws its routes and traffic moves. _"Redundancy is your job, not the circuit's."_
   **The moment**: Beat 4 — the one physical line snapping and everything going dark at once, caused by nothing "network-y" at all, just one real-world link.
   **Interaction**: Toggle VPN vs. interconnect and watch the latency meter's steadiness; fail the one circuit and see if a backup exists.
   **Ending**: Two circuits into two edge locations, a steady latency meter. _"Fast and steady — but plan the backup yourself."_
   **Variants**: `site-to-site-vpn`, `bgp`.
   **Techniques**: side by side, meter, timer, failure, restyle, caption.

**Review**: Improved — softened "low" latency to "steady" (a circuit is more predictable than the internet, not exempt from distance), changed provisioning to days to weeks (partner/hosted connections are quicker than dedicated ports), and named the BGP step that makes failover happen. Facts checked: not encrypted by default, MACsec available on some dedicated ports, one circuit is a single point of failure. Alternative weighed: leading with the cost contrast; predictability is the truer reason to buy it.

### Private endpoints (Private Link) (`private-endpoints`)

**The aha**: A private endpoint gives one specific resource a private IP inside your network, so its public door can shut completely, without opening a path to anything else like it.
**Misconception to defeat**: That it's the same as a service endpoint, or that it connects you to "the service" broadly.
**Cast**: A subnet with a network-interface icon, "pe-storage · 10.0.1.9", wired by a dashed private-link line to one resource card, "storage-account-7 (and only this one)". Sibling resource cards of the same type sit nearby, unconnected. Drawn in Azure terms, where the endpoint maps to one resource instance.
**Opening frame**: The endpoint's dashed line reaching exactly one resource among several similar ones. _"A private IP, wired to one resource — and only that one."_
**Story**:

1. A host sends a request to `10.0.1.9`; it's forwarded over the private-link fabric straight to storage-account-7.
2. The same host tries a request aimed at sibling storage-account-8: no wire exists from this endpoint to it; the request has nowhere to go. _"Exfiltration to a neighbour has no path."_
3. storage-account-7's public network access is switched off (red). The private path keeps ticking ✓, unaffected.
4. A peered VPC and an on-premises network over a VPN both reach the same endpoint's IP.
5. Side by side: a service endpoint instead — a tagged private path that lands on a still-public address, and storage-account-8 remains reachable the same way, since the mapping is "the whole service," not one resource.
   **The moment**: Beat 2 — the request to the sibling resource finding literally no wire. The strongest proof that it's mapped to one resource, not a tunnel to the service.
   **Interaction**: Switch the target resource's public access on and off, watch only the private path keep working; compare against the service-endpoint variant.
   **Ending**: Public door shut, the private wire alone carrying traffic. _"One address, for one resource, inside your network."_
   **Variants**: `service-endpoints`, `private-endpoint-dns`, `vpc-peering`. In AWS, a PrivateLink interface endpoint is a private IP for a whole service (S3, an API), narrowed to chosen resources with an endpoint policy; the public service is not "closed" by it. The per-resource claim is Azure's.
   **Techniques**: token, path trace, side by side, restyle, failure, caption.

**Review**: Improved — scoped the per-resource claim to Azure and noted that AWS interface endpoints map to a service and need an endpoint policy to narrow them, which is a real cross-cloud difference the old plan hid. Facts checked: private endpoint = NIC with private IP, reachable from peered/VPN networks, public access can be disabled; service endpoints cover every resource of that type. Alternative weighed: a "key to one room vs key to the building" metaphor; the missing wire in beat 2 shows the same thing without words.

### Service endpoints (`service-endpoints`)

**The aha**: Traffic takes a private path tagged with your subnet's identity, but it still lands on the service's public address — the mapping covers the whole service, not one resource, and on-premises can't use it.
**Misconception to defeat**: Treating it as the same thing as a private endpoint.
**Cast**: A subnet tagged "service endpoint: enabled" (not a NIC inside it), a dashed path along the provider's backbone to the service's address, which keeps a public globe icon. A firewall rule card on the service: "Allow subnet-A". An Azure feature; AWS's closest cousin is the S3/DynamoDB gateway endpoint (a route-table entry).
**Opening frame**: The subnet's tag, the dashed line, the service's globe icon still lit. _"A tagged private path — to a public address."_
**Story**:

1. A host's request leaves tagged "from subnet-A" and travels the provider backbone, not the open internet. A DNS lookup from the host still returns the service's public IP. _"The address never became private."_
2. The service's rule card lights "Allow subnet-A" ✓ — allowed by the subnet identity, not an IP.
3. An internet host connects to the same public address: the connection reaches the service, which checks its rule card and refuses, ✗ (HTTP 403). _"Reachable address, refused by the rule. It is still public."_ Remove the rule and it answers.
4. An on-premises host, routed in over a VPN, tries the same request: it carries no subnet tag to offer, the service's firewall has nothing to match, it bounces ✗. _"Doesn't work from on-premises."_
5. Side by side with private endpoints: one NIC wired to one resource, versus this subnet-wide tag reaching every resource of that type, including other customers' accounts unless a policy restricts it.
   **The moment**: Beat 3 — an internet host connecting straight to the "privately accessed" service's address. The address never left public; only the rule decides.
   **Interaction**: Toggle the service endpoint on the subnet and watch the firewall rule stop matching; try the request from an on-premises host and watch it fail.
   **Ending**: The dashed backbone path lit, the globe icon still glowing on the service. _"Private path. Public address underneath."_
   **Variants**: `private-endpoints`, `vpc-route-tables`.
   **Techniques**: token, path trace, restyle, failure, side by side, caption.

**Review**: Improved — fixed beat 3: services such as storage don't answer ping, and with a subnet rule an internet caller is refused by the service, so the proof is "the address still resolves and accepts a connection, then the rule says no". Added the DNS lookup showing a public IP, the AWS gateway-endpoint cousin, and the cross-tenant reach. Alternative weighed: leading with private-endpoint comparison; the plan for `private-endpoints` already does that.

### Private endpoint DNS (`private-endpoint-dns`)

**The aha**: A private endpoint only works if DNS actually sends clients to it — the same public hostname has to resolve differently depending on where you ask, or traffic lands on the (now closed) public address.
**Misconception to defeat**: That hard-coding the private IP into the connection string is the fix.
**Cast**: A client inside the VPC; a private DNS zone linked to the VPC ("privatelink.blob... → 10.0.1.9"); a separate public DNS chain (CNAME → public IP, now behind a closed door); a certificate icon on the service.
**Opening frame**: A client about to resolve the hostname, two chains drawn: one to the linked private zone, one to the public internet's answer. _"Same name. Which answer does it get?"_
**Story**:

1. The client's query reaches the cloud resolver, which checks zones linked to this network, finds the private zone, answers `10.0.1.9`.
2. The client connects to `10.0.1.9`; the certificate, issued for the public hostname, still validates, because the client used the name, not the raw IP.
3. An on-premises client, not linked to the private zone, falls through to the public CNAME chain and gets the public IP — now closed. It bounces ✗. _"Wrong horizon, old answer, blocked door."_
4. Someone "fixes" it by hard-coding `10.0.1.9` into the connection string: the client sends no matching hostname, the certificate check fails (name mismatch) and the service, which routes by hostname, can't tell which account is wanted. ✗ _"Skip DNS and TLS skips the name it needs."_
5. The real fix: an on-premises forwarding rule sends this zone's queries to the VPC's inbound resolver endpoint; the on-premises client now resolves the same private answer.
   **The moment**: Beat 3 — the exact same request from the exact same client, differing only in where it asked DNS, landing on a door that's shut. Most "private endpoint doesn't work" tickets are this.
   **Interaction**: Toggle which network a client's query originates from; toggle the public endpoint's door open or closed.
   **Ending**: The forwarding rule in place, both clients landing on `10.0.1.9`. _"Private access runs through DNS, same as everything else."_
   **Variants**: `private-endpoints`, `private-dns-zones`, `hybrid-dns-forwarding`.
   **Techniques**: path trace, token, failure, restyle, exchange, caption.

**Review**: Improved — corrected beat 4: a hard-coded private IP does not "work today" over HTTPS, because the certificate and the service's hostname routing need the name; the old "breaks only when the IP changes" claim was also weak, since private endpoint IPs are stable. Facts checked: privatelink zone linked to the VNet, CNAME to privatelink name on the public chain, inbound resolver endpoint for on-premises forwarding (Azure DNS Private Resolver, Route 53 Resolver). Alternative weighed: a phone-book metaphor; two chains is exact.

## Firewalls and network access control

`network-segmentation` is owned by Security — skipped here.

### Stateful vs stateless filtering (`stateful-firewall`)

**The aha**: A stateful device judges a connection once and remembers it, letting the reply back automatically — but it must see both directions on the same device, or it breaks. A stateless filter has no memory, so it needs a rule for each direction but doesn't care which path packets take.
**Misconception to defeat**: That stateful is simply "better" than stateless, missing the symmetric-routing requirement it depends on.
**Cast**: A firewall box between a client and server, with a connection-state table beside it (5-tuple, state). Two possible return paths: back through the same firewall, or around it via a second router. A second, stateless filter box with a plain two-row rule list.
**Opening frame**: Client, firewall, server in a line, state table empty. _"Judge the connection once, remember it."_
**Story**:

1. The client's SYN passes the firewall's rule (lights ✓); a row opens in the state table, "SYN_SENT."
2. The server's SYN-ACK returns through the same firewall; it matches the state row, not a fresh rule lookup, updates to ESTABLISHED, passes.
3. Every later packet of the flow is waved through on the state match alone.
4. The return path is redrawn through a second router that bypasses the firewall. The SYN-ACK reaches the client, but the firewall's row is stuck in SYN_SENT; when the client's next packet (ACK, then data) arrives at the firewall, the entry doesn't match an established flow and it is dropped ✗. The flow stalls. _"Half the conversation never saw the firewall. It never saw the handshake finish."_
5. Side by side, the stateless filter with two rules (allow request, allow reply) on the same asymmetric path: both directions are judged per packet, so the flow works wherever the packets go. _"No memory: more rules, no path dependency."_
   **The moment**: Beat 4 — the connection that worked a moment ago stalling the instant the return path skips the firewall, the stateful device's own memory turning against it.
   **Interaction**: Toggle symmetric vs. asymmetric routing on the return path and watch the state table and the outcome change; flip between stateful and stateless.
   **Ending**: Both directions back through the same firewall, one full state row, traffic flowing. _"One memory. Both directions have to use it."_
   **Variants**: `security-groups`, `network-acls`, `network-firewall`.
   **Techniques**: contents, token, path trace, exchange, failure, side by side, toggle, caption.

**Review**: Improved — the old beats 4–5 showed the reply "arriving unchecked", which isn't a failure (nothing blocked it) and never showed the stateless alternative the title promises. Now the harm is shown correctly (the firewall sees SYN but never SYN-ACK, so later packets are out of state and dropped), and a stateless side-by-side defeats "stateful is just better". Alternative weighed: a doorman who remembers faces; the state table already is that, with the flaw visible.

### Network firewalls and central inspection (`network-firewall`)

**The aha**: A central firewall only sees traffic you actively route to it — its presence in the VPC inspects nothing by itself, and it adds to per-instance rules rather than replacing them.
**Misconception to defeat**: That adding a network firewall to a VPC automatically inspects everything inside it.
**Cast**: A hub subnet holding a firewall appliance with its own rule list (FQDN filters, signatures). Two spoke subnets, each with a route-table card.
**Opening frame**: The firewall box sitting in the hub; both spokes' route tables show only local and default-to-gateway routes, no mention of the firewall. _"It's there. Is anything routed to it?"_
**Story**:

1. A packet leaves spoke 1 for the internet via its own `0.0.0.0/0 → igw` route, never touching the firewall at all. _"Present, but not in the path. Nothing inspected."_
2. Spoke 1's route table is rewritten: `0.0.0.0/0` now points at the firewall's endpoint. The same packet detours through it, a rule row lights, then it continues to the gateway. _"A route is what makes it central."_
3. The firewall's FQDN rule blocks a bad destination: a packet aimed there, now routed through, is caught and bounces ✗ — the same attempt from spoke 2, not yet re-routed, sails straight past untouched.
4. Zoom on spoke 1's host: it still carries its own security-group rule card, checked independently. The return traffic is shown coming back through the same firewall, not around it. _"A second, central check — not a replacement. And both directions must pass it."_
   **The moment**: Beat 3 — the identical malicious request blocked from one spoke and sailing untouched from the other, because only one of them had been routed through.
   **Interaction**: Toggle which spokes' route tables point at the firewall; watch which spokes' traffic it can actually see and block.
   **Ending**: Both spokes routed through, the firewall's and the hosts' own rules shown stacked. _"Visibility is a route. Protection is layered, not swapped."_
   **Variants**: `hub-and-spoke`, `security-groups`, `vpc-route-tables`, `stateful-firewall`. Forced tunnelling (sending internet-bound traffic to on-premises for inspection) is the same route trick.
   **Techniques**: contents, path trace, token, failure, restyle, caption.

**Review**: Improved — dropped the forced-tunnelling beat (the same "route to inspection" idea told twice; now a variant note) and used the room for return-path symmetry, which ties to `stateful-firewall`. The "route makes it central" story and the spoke-1 vs spoke-2 moment are already the right proof. Facts checked: AWS Network Firewall and Azure Firewall inspect only traffic routed to their endpoints/next hop; security groups stay in force. Alternative weighed: a security-guard-in-the-lobby picture; worse, because a guard "sees" automatically whereas the point is that routing doesn't.

### Zero-trust network access (ZTNA) (`zero-trust-network-access`)

**The aha**: A VPN admits you to the network; ZTNA admits you to one application at a time, checked on every request — being "inside" stops meaning "trusted."
**Misconception to defeat**: That ZTNA is just a fancier VPN, or that being on the corporate network is itself a form of access.
**Cast**: A user with a device on the left. Three application icons on the right, each with an outbound-only line to a broker in the middle — no inbound port drawn on any app. The broker checks identity, device and context.
**Opening frame**: Three apps, no inbound ports anywhere, only outbound lines to the broker. _"Nothing is listening for a connection to come in."_
**Story**:

1. The user requests app-1 through the broker: identity ✓, device posture ✓, context ✓, all light green, then the request is stitched through app-1's outbound connector. _"Checked before every single request, not once at login."_
2. The same user, not granted app-2, is refused at the broker — never reaching app-2's connector at all. _"Admitted to one app. Not the network behind it."_
3. Side by side: a VPN client instead, connecting the user into the subnet; all three apps light up simultaneously the moment the tunnel is up, with no per-app check drawn. _"In once, reach everything the routes allow."_
4. The user's device posture changes mid-session (malware flashed red); the broker drops the connection to app-1 immediately, without waiting for a reconnect. _"Trust isn't a one-time ticket."_
5. An outside attacker scans the apps' public IPs directly: nothing answers anywhere. _"No open door to find in the first place."_
   **The moment**: Beat 3 — the VPN's single connect lighting all three apps at once beside ZTNA's deliberate, one-at-a-time grants.
   **Interaction**: Toggle VPN vs. ZTNA and watch how many apps light up per connection; flip the device-posture flag mid-session and watch ZTNA react.
   **Ending**: The broker's three checkmarks, one app lit, two dark. _"Trust nothing by location. Check everything, every time."_
   **Variants**: `point-to-site-vpn`, `bastion-host`.
   **Techniques**: boundary, token, restyle, side by side, failure, spotlight, caption.

**Review**: Merged — owned by Security (`ztna-vs-vpn`, `plans/security.part2.md`). The kept plan should borrow from this one: the posture-change-mid-session drop (beat 4) and the "check on every request, not at login" caption, which Security's plan lacks. Checked here: connectors are outbound-only in most products (not all), and posture re-evaluation is real. Security's stolen-session replay is the sharper moment, so this plan's side-by-side adds nothing the owner needs beyond those two beats.

## Performance and troubleshooting

### Latency vs bandwidth vs throughput (`latency-bandwidth-throughput`)

**The aha**: A pipe's width (bandwidth) and its length (latency) are independent — more bandwidth doesn't make a small request arrive sooner, and most web traffic is latency-bound, not bandwidth-bound.
**Misconception to defeat**: That "faster internet" (a bigger bandwidth number) always makes pages feel faster.
**Cast**: A pipe between a client and server, with two dials above it: "bandwidth" (pipe width) and "latency" (pipe length, with a distance ruler). A small packet and a large file ready to send.
**Opening frame**: A short, narrow pipe, both dials at modest values. _"Two separate knobs."_
**Story**:

1. Widen the pipe (bandwidth up), length unchanged: the large file's transfer-time meter drops sharply. _"More bandwidth: the big file arrives sooner."_
2. Send the small packet through the same widened pipe: its arrival-time meter barely moves. _"It was never waiting on width."_
3. Reset bandwidth, stretch the pipe's length instead (latency up): the packet's and the file's first-byte time both grow.
4. A realistic page — one HTML file plus fifty small chained requests — keeps a high load time even with the pipe maximally wide, because each small request pays the distance again. _"A chatty page pays latency fifty times over."_
5. A combined readout: cranking bandwidth to maximum barely moves the page's load time; halving latency nearly halves it.
   **The moment**: Beats 2–3 together — the same small packet barely reacting to a hundredfold bandwidth increase, then clearly reacting to a latency increase, isolating which knob governs typical traffic.
   **Interaction**: Two independent dials, bandwidth and latency, with a "time to arrive" readout split by request size.
   **Ending**: Both dials shown with the page-load meter beneath, the latency dial highlighted as the one that moved it. _"Width and length. Don't confuse them."_
   **Variants**: `round-trip-time`, `tcp-congestion-control`, `http-request-lifecycle`.
   **Techniques**: dial, meter, side by side, caption.

**Review**: Merged — owned by Scaling (`latency-vs-throughput`, `plans/scaling.part2.md`). Technical notes for the kept plan: this plan's title promises throughput but never shows it; Scaling's toll counter (cars finished per minute) does, so keep that. Borrow from here: (1) the network-specific "chatty page pays the distance fifty times" beat and the page-load readout, which make the point for real traffic; (2) throughput is not bandwidth: achieved TCP throughput is capped by window size over RTT (bandwidth-delay product) and by loss, so a long, fat pipe can sit mostly empty. Correct the pipe claim in beat 3 too: a huge single file is eventually bandwidth-bound, but TCP slow start makes latency matter for its first seconds. Scaling's "big file" switch already handles the bandwidth side well.

### Round-trip time (RTT) (`round-trip-time`)

**The aha**: Every setup step — TCP, TLS, each sequential call — costs one more round trip, so a chatty design across a long distance is slow no matter the bandwidth.
**Misconception to defeat**: That "slow" always means "not enough bandwidth."
**Cast**: A ladder diagram, client on the left, a distant server on the right, a distance label on the gap ("9,000 km ≈ 90 ms round trip, about 1 ms per 100 km of fibre"). Slanted arrows travel down between the lifelines.
**Opening frame**: Two bare lifelines, the distance label between them, no arrows yet. _"Light in fibre: about 1 ms of round trip for every 100 km."_
**Story**:

1. One arrow down, one arrow back up, bracketed "1 RTT ≈ 90 ms." _"Round trip: there and back."_
2. A TCP handshake (SYN, SYN-ACK: 1 RTT) then a TLS 1.3 handshake (1 RTT more) stack on top, each bracketed: 2 RTT, 180 ms, before the first request byte can even leave. The request and response add a third, so the first byte of the page arrives at 270 ms.
3. Five sequential API calls stack below, each its own request/reply pair on the open connection: five more round trips, 450 ms. _"Chatty code pays per call."_
4. Side by side: the same five calls batched into one request — one round trip instead of five, 90 ms. A second ladder reuses the connection, so no handshakes are paid at all. _"Batch the calls. Reuse the connection."_
5. The server lifeline moves closer (distance shrinking to "80 km ≈ 1 ms"): every bracket shrinks proportionally, same number of trips, far less total time.
   **The moment**: Beats 3–4 — the identical five calls, one ladder tall and slow, one short and fast, with bandwidth never entering the picture.
   **Interaction**: Scrub the ladder's distance; toggle sequential vs. batched calls and watch the total recompute.
   **Ending**: A short ladder, one batched round trip, a small total-time label. _"Count the trips, not the megabits."_
   **Variants**: `latency-bandwidth-throughput`, `tcp-handshake`, `tls-handshake`, `quic`.
   **Techniques**: exchange, lanes, meter, side by side, dial, caption.

**Review**: Improved — fixed the arithmetic, which mixed viewpoints: "TCP 1.5 round trips plus TLS 1 = 230 ms before data" is the server's view; from the client the request can leave after 2 RTT (180 ms) and the first byte arrives at 3 RTT (270 ms). Also fixed the opening caption ("1 ms per 100 km, both ways" read as one-way; it is 1 ms of round trip per 100 km, i.e. light in fibre at about 200,000 km/s) and added connection reuse. Alternative weighed: a postal-delay metaphor; the ladder with counted brackets is exact.

### Packet loss and jitter (`packet-loss-and-jitter`)

**The aha**: A little loss costs TCP a lot, because every lost packet triggers a retransmission and a congestion back-off; jitter barely matters for downloads but ruins real-time media, which buffers to smooth it out.
**Misconception to defeat**: Treating loss and jitter as the same kind of problem as plain latency — just "noise."
**Cast**: A stream of numbered packets flowing from server to client. Two receivers side by side, one downloading a file, one on a video call, each with its own buffer bar.
**Opening frame**: Packets 1–10 flowing evenly, both buffers calm. _"A steady stream — for now."_
**Story**:

1. Packet 4 vanishes mid-path. The download side notices the gap, a cloned "4 (retransmit)" is resent, and a congestion-window meter beside the sender visibly drops by about half. _"One lost packet: a resend, and the sender throttles itself."_
2. The meter then climbs back one step per round trip (congestion avoidance), a slow ramp compared with the drop. _"It backs off fast, and climbs back slowly."_
3. Switch to jitter: the same ten packets arrive with wildly uneven gaps instead of evenly spaced. _"Not lost — just arriving unevenly."_
4. The download's buffer bar barely reacts (it waits for everything, in order, eventually). The call's buffer bar empties faster than it refills, and the video freezes, red flash. _"Downloads can wait. Real-time can't."_
5. A jitter buffer is added before playback, absorbing the uneven arrivals at the cost of a little added delay. A late packet that misses even this buffer is simply skipped: a call never retransmits.
   **The moment**: Beat 4 — the identical jittery stream leaving one receiver untouched and starving the other, same network event, opposite consequence depending on what's listening.
   **Interaction**: A "loss %" dial driving the congestion-window meter; a "jitter" dial driving the call's buffer bar and freeze.
   **Ending**: The jitter buffer in place, the call smooth, a small added-delay label. _"Different symptom, different cure."_
   **Variants**: `tcp-congestion-control`, `tcp-reliability`, `latency-bandwidth-throughput`.
   **Techniques**: stream, token, meter, failure, dial, spotlight, caption.

**Review**: Improved — fixed a protocol slip: the recovery after a single loss found by duplicate ACKs is congestion avoidance (linear, about one segment per RTT), not slow start (exponential, used after a timeout or at connection start); the drop is roughly halving. Added that real-time media doesn't retransmit. Alternative weighed: splitting loss and jitter into two plans; they share the "same event, opposite consequence by receiver" contrast, so one plan is right.

### Ping and traceroute (`ping-and-traceroute`)

**The aha**: Ping answers "can I reach it, and how far?"; traceroute answers "where does the path go, and where does it stop?" — and both ride on ICMP, which is often dropped without the real service being down.
**Misconception to defeat**: That a failed ping, or a traceroute full of asterisks, proves the service or the path is broken.
**Cast**: A client, a chain of three routers (round junctions), a destination server. Each probe packet carries a visible TTL counter in its header that ticks down at every router.
**Opening frame**: Client, three routers, server, nothing sent yet. _"Two tools. Different questions."_
**Story**:

1. Ping: an ICMP echo travels straight through all three routers to the server and an echo reply comes straight back, landing a round-trip-time number. _"Reachable, and this far away."_
2. Traceroute: a probe with TTL=1 hits router 1, whose counter reaches 0; the router discards it and replies "time exceeded," revealing itself. TTL=2 and 3 reveal routers 2 and 3 in turn; TTL=4 finally reaches the server. Each hop lights in sequence with its own round-trip time. _"Each hop outs itself by how far the packet got before dying."_
3. The middle router is set to ignore the expiry (it won't send "time exceeded"): that hop shows `* * *`, but the probes still pass through it to reach later hops. _"A silent hop, not necessarily a dead path."_
4. The server itself blocks ICMP: ping times out with no reply, while a separate HTTPS request to it, drawn alongside, succeeds and ticks ✓. _"No ping reply. The website up the whole time."_
   **The moment**: Beat 4 — the website answering normally while ping times out, the clearest break of "ping fails means it's down."
   **Interaction**: Toggle ICMP blocking at any router or at the destination, and watch ping and traceroute react while a real request keeps succeeding.
   **Ending**: The full hop chain revealed, one asterisked hop, the service check still ticking ✓. _"Don't let ICMP speak for the whole path."_
   **Variants**: `network-troubleshooting-by-layer`, `round-trip-time`. Note for the build: Linux traceroute sends UDP probes by default and Windows tracert sends ICMP echo; the expiry reply is ICMP either way.
   **Techniques**: token, path trace, lanes, failure, side by side, caption.

**Review**: Improved — the TTL belongs to the packet, not the router (the old cast gave each router a counter), and "a router set to drop ICMP" would also eat later hops' replies on their way back, so beat 3 now says the router merely doesn't send time-exceeded. Facts checked: TTL decrement and ICMP Time Exceeded, TTL=4 reaches a server behind three routers. Alternative weighed: a postal tracking-number metaphor; the dying packet shows the mechanism itself.

### Troubleshooting connectivity layer by layer (`network-troubleshooting-by-layer`)

**The aha**: Walk up the stack one layer at a time — name, route and reachability, port and rule, TLS, then HTTP — and read what the symptom itself says before changing anything.
**Misconception to defeat**: Guessing and changing things at random ("it's probably DNS," restart it) instead of testing each layer in order.
**Cast**: A vertical checklist ladder the viewer walks down: "Name resolves?" → "Route exists, host reachable?" → "Port open, rule allows?" → "TLS succeeds?" → "HTTP responds?", each rung with its own tool icon (nslookup, traceroute, a TCP connect test, openssl, curl), and a client-to-server diagram behind it that lights progressively.
**Opening frame**: All five rungs grey, a single failing request at the bottom with a red X and no diagnosis. _"Something failed. Where?"_
**Story**:

1. Rung 1 (name lookup): resolves to an IP, lights ✓. _"The name is fine."_
2. Rung 2 (reachability): a path exists and the host is up (a ping may be blocked, so a TCP attempt is the real test), lights ✓. _"A path exists."_
3. Rung 3 (port and rule): the connection attempt times out — no reply at all, flashes red; a magnifying glass lands on the subnet's rule card, revealing a missing inbound row. Beside it, a second possible outcome, "connection refused" (an instant reset: the host answered, nothing is listening on that port). _"Timeout: something dropped it silently. Refused: it got there and nobody home."_
4. Fixed and replayed: rung 3 lights ✓; rung 4 (TLS) fails instead, with a certificate name mismatch. _"Not a timeout — an answer with a reason. The network is fine; the certificate isn't."_
5. The certificate is fixed; rung 4 lights ✓; rung 5 (HTTP) returns a clean 200. All five rungs glow, the original red X turns green.
   **The moment**: Beats 3 vs. 4 — a timeout, a refusal and a TLS error all look like "it didn't work," but point at completely different fixes, diagnosed correctly in sequence.
   **Interaction**: Pick which layer to test next, or let a scenario auto-fail at a chosen layer and practise reading the symptom (timeout, refused, certificate error, 5xx) before it's revealed. Guessing a fix at the wrong rung changes nothing.
   **Ending**: All five rungs green, the request ticking ✓. _"Climb it in order. The failure point names the fix."_
   **Variants**: `ping-and-traceroute`, `dns-resolution`, `flow-logs`, `tcp-connection-teardown`.
   **Techniques**: lanes, path trace, spotlight, failure, restyle, choice, caption.

**Review**: Improved — beat 2 claimed "something's listening", which reachability can't show, and the plan left out the key port-level distinction the whole ladder rests on, timeout (dropped) vs refused (reset, nobody listening); both are now on rung 3. Rung 2 also notes that ping can be blocked, linking to `ping-and-traceroute`. Alternative weighed: a decision-tree flowchart; the ladder you walk is simpler and keeps order.

### Flow logs (`flow-logs`)

**The aha**: Flow logs answer "did it arrive, and did a rule let it through?" — the fastest way to tell a routing problem from a security-rule problem, without needing payloads.
**Misconception to defeat**: Treating flow logs as the same thing as packet capture, or assuming "rejected" and "never arrived" look alike in them.
**Cast**: A network interface with a flow-log stream into a table (src, dst, port, protocol, bytes, packets, action). A client sending several different requests toward it. A small clock showing the aggregation window.
**Opening frame**: Interface quiet, log table empty. _"Every flow, logged. No payloads."_
**Story**:

1. An allowed request logs a row: "203.0.113.5 → 10.0.1.5:443, TCP, 1,240 bytes, ACCEPT." The row appears after the aggregation window (a minute or ten) elapses. _"Got there, and was let through."_
2. A request blocked by a security group logs: "198.51.100.9 → 10.0.1.5:22, TCP, 1 packet, 40 bytes, REJECT," the packet shown bouncing off the rule card right beside it. _"Arrived, and a rule said no."_
3. A request aimed at an address with no route logs nothing at all here, because it never arrived at an interface to be judged. A caption points at the absence: "Nothing logged — check the route, not the rule." _"The silence itself is the diagnosis."_
4. Side by side: the REJECT row (fix the security group or NACL) versus the missing row (fix the route table) — the same user complaint, two different fixes, told apart instantly by the log. A request with ACCEPT inbound but REJECT on the reply is the NACL signature.
5. Someone asks "what was actually sent?" — the table has no answer, only bytes and packets. A packet-capture icon appears as the tool for that question.
   **The moment**: Beat 3 — reading an empty log as the clue, the least intuitive, most useful habit in troubleshooting with flow logs.
   **Interaction**: Fire three requests (allowed, rule-blocked, unroutable) and watch which rows appear where, or don't.
   **Ending**: Three outcomes side by side — an ACCEPT row, a REJECT row, and a blank log with the route table circled. _"Read the rows, and read the gaps."_
   **Variants**: `network-acls`, `security-groups`, `ping-and-traceroute`, `network-troubleshooting-by-layer`. Azure's NSG flow logs are being retired in favour of virtual network flow logs, but the rows read the same.
   **Techniques**: contents, token, failure, side by side, spotlight, timer, caption.

**Review**: Improved — a REJECT row isn't "0 bytes" (AWS records the rejected packets and their bytes), so beat 2 now shows one packet, 40 bytes; added that logs arrive after an aggregation window (an empty log can also mean "not yet"), and that an ACCEPT-then-REJECT pair is the NACL signature, tying to `network-acls`. Facts checked: flow logs record metadata, not payloads; an unroutable packet never reaches an interface. Alternative weighed: leading with the NACL case; the empty-log clue is a more memorable, more surprising lesson.
