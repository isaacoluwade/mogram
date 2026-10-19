# Networking plans, part 2

Stage 2 plans for `catalog/networking.md` groups 5 to 8, in catalog order. These groups share the
visual language set for the whole area: hosts are small computers or servers labelled with their
IP address; a packet is a small envelope with visible header fields; layers are horizontal strata;
routers are round junctions with a routing table card; the internet is a cloud in the middle;
time-ordered exchanges (DNS lookups, HTTP requests, TLS handshakes) are ladder diagrams — each
party a vertical lifeline with its name on top, messages as slanted arrows travelling down the
page in order (time flows downward), the current one highlighted, with what's being carried (a
query, a certificate, a key share) riding the arrow; DNS servers are a chain of labelled boxes
(resolver, root, TLD, authoritative) and caches are small boxes with visible entries whose TTL
rings drain; latency is visible as how long an arrow takes to cross; a certificate is a card with a
chain of signatures up to a root.

## 5. DNS

### DNS resolution end to end (`dns-resolution`)

**The aha**: A single lookup is a chain of referrals passed down from the root, but almost every real query is answered from a cache partway along that chain, not by walking the whole thing.
**Misconception to defeat**: That DNS is one request to one server that already knows the answer.
**Cast**: A ladder with three lifelines (Browser, OS stub resolver, Recursive resolver) and a column of three boxes the recursive resolver visits: Root, .com TLD, example.com authoritative. Each DNS box shows a small cache table with TTL rings. The query `www.example.com?` rides every arrow.
**Opening frame**: All lifelines idle, the recursive resolver's cache empty. Caption: "example.com has never been looked up."
**Story**:

1. Browser asks the stub resolver; stub checks its tiny local cache (empty) and the hosts file, then forwards to the recursive resolver. Caption: "First stop: the OS, then the resolver."
2. Recursive resolver has nothing cached. It asks Root: "who handles .com?" Root answers with the .com TLD's address — a referral, not the answer. Caption: "Root doesn't know the site. It knows who does."
3. Recursive resolver asks the TLD: "who handles example.com?" TLD answers with the authoritative server's address. Caption: "Another referral, one level down."
4. Recursive resolver asks the authoritative server: "what's the A record?" It answers with the IP and a TTL of 300s. A TTL ring appears on the recursive resolver's cache entry and starts draining. Caption: "The authoritative server actually knows."
5. The answer rides back up through stub to Browser. The three upstream exchanges (root, TLD, authoritative) light up together and are labelled "3 lookups, once." The resolver now caches the answer for 300s and also the .com and example.com server addresses (their own, longer TTLs).
6. A second browser asks the same resolver for `www.example.com` seconds later. It is answered straight from the resolver's cache — root, TLD and authoritative stay grey. Caption: "Same name again: one hop, from cache."
7. A third browser asks for `mail.example.com`, a name never looked up. The resolver skips root and TLD (it remembers who serves example.com) and asks only the authoritative server. Caption: "New name, same zone: the top of the chain is skipped."
   **The moment**: Beat 6 against beats 1–5: the full referral chain happens once, then collapses to a single cached hop while the TTL ring is still full; beat 7 shows the cache also shortens chains it can't fully answer.
   **Interaction**: Step through the ladder one arrow at a time. A "flush caches" button resets every TTL ring to empty and forces the full chain to run again on the next query.
   **Ending**: Three ladders side by side: "cold" (three lookups), "new name" (one lookup), "cached" (none), same destination.
   **Variants**: `recursive-vs-authoritative-dns`, `dns-ttl-and-caching`, `dns-zones-and-delegation`.
   **Techniques**: exchange, token, contents, timer, spotlight, side by side, caption.
   **Review**: Improved — fixed the cast count (it said five lifelines but drew six parties) and "4 round trips"; added the new-name beat (mail.example.com) so "answered from a cache partway along the chain" is shown, not just the full-hit case. Alternative weighed: a map of "who knows what", worse because the ladder is the area's shared language. Checked: stub → recursive → root → TLD → authoritative referral order, resolver caches NS/glue for .com and example.com with their own TTLs.

### Recursive resolvers vs authoritative servers (`recursive-vs-authoritative-dns`)

**The aha**: An authoritative server owns the one true answer for its zone; a recursive resolver only holds a copy with an expiry date, fetched on someone's behalf.
**Misconception to defeat**: Treating "the DNS server" as one undifferentiated thing, or assuming a resolver's answer is as current as the source.
**Cast**: Two labelled boxes side by side. Left, "Authoritative: example.com zone", holding a record table with no TTL ring (it's the source). Right, "Recursive resolver (1.1.1.1 / 8.8.8.8 / VPC resolver)", holding a cache entry with a TTL ring. A client lifeline below both.
**Opening frame**: Authoritative shows `www → 203.0.113.10`; resolver's cache is empty. Caption: "One owns the record. One will hold a copy."
**Story**:

1. Client asks the resolver; resolver has nothing, asks authoritative, gets the answer, caches it with a TTL ring, hands it to the client. Caption: "The resolver does the legwork and keeps a copy."
2. An admin edits the authoritative record to `203.0.113.99` — it changes instantly, no ring, no delay. Caption: "The source updates immediately."
3. The client asks again, immediately: the resolver's TTL ring is still mostly full, so it answers from cache with the _old_ address, 203.0.113.10. Caption: "But the cached copy doesn't know yet."
4. The TTL ring drains to empty; the resolver's entry greys out and is discarded.
5. The client asks once more: the resolver, now empty, re-asks authoritative and gets 203.0.113.99. Caption: "Only once the TTL expires does the copy catch up."
6. Role contrast: asked directly about `google.com`, the authoritative box answers REFUSED (it only knows its own zone); the same question to the resolver sets it off to find out. Caption: "Authoritative: owns its zone, nothing else. Resolver: knows nothing, will find out."
   **The moment**: Beat 3, slowed: the authoritative answer has already changed, yet the client gets stale data purely because a copy exists between them.
   **Interaction**: Edit the authoritative record and watch the resolver keep answering the old value until its TTL ring empties; drag the TTL slider to see the lag shrink or grow.
   **Ending**: Resolver's cache matches authoritative, ring full again on the new value; the two boxes labelled "owns" and "fetches".
   **Variants**: `dns-resolution`, `dns-ttl-and-caching`, `dns-zones-and-delegation`.
   **Techniques**: contents, timer, token, restyle, side by side, dial, caption.
   **Review**: Improved — added the REFUSED/fetch beat so the "two different roles" half of the misconception is defeated on screen, not only the staleness half. Alternative weighed: leading with the role contrast and staleness second; worse, since stale data is the memorable failure. Checked: authoritative edits are served immediately, resolvers serve cached data until TTL, authoritative servers do not recurse.

### DNS zones and delegation (`dns-zones-and-delegation`)

**The aha**: The namespace is a tree of delegations — whoever holds the NS records for a name controls that name, and they can hand off a branch of it to someone else entirely.
**Misconception to defeat**: That one organization or one server serves all of a domain, including its subdomains.
**Cast**: A tree: root at top, `.com` below it, `example.com` below that, and `dev.example.com` as a branch off it. Each node is a box holding an NS record card pointing down to its child's servers. `dev.example.com`'s box sits inside a different coloured boundary, "Team B's cloud account."
**Opening frame**: The tree fully drawn, every NS card visible, pointing down the chain; the registrar shown setting example.com's NS records at the .com level. Caption: "Each zone's NS records say who answers for it."
**Story**:

1. A query for `www.example.com` walks root → .com → example.com, each NS card lighting as it's followed. Caption: "Follow the NS records down."
2. Spotlight `example.com`'s zone file: it has NS records delegating `dev.example.com` to Team B's name servers (`ns1.teamb.net`; a glue address record would only be needed if the name server's own name sat inside dev.example.com). `www` is just a record in the same zone, with no delegation. Caption: "A parent can delegate a branch to someone else's servers. Not every subdomain is one."
3. A query for `api.dev.example.com` now walks root → .com → example.com → (follow the delegation) → Team B's servers, crossing the coloured boundary. Caption: "The chain leaves the parent's own infrastructure entirely."
4. Team B adds a new record on their own servers — no request to the parent, no coordination. Caption: "Whoever holds dev's NS records controls dev, full stop."
   **The moment**: Beat 3, when the query chain visibly crosses into a different account's boundary mid-lookup, proving delegation is a real handoff of control, not just naming convention.
   **Interaction**: Click any NS card to re-point a delegation to a different server set and watch the next query follow the new path.
   **Ending**: The tree with the Team B branch highlighted in its own colour, chain intact.
   **Variants**: `dns-resolution`, `private-dns-zones`, `recursive-vs-authoritative-dns`.
   **Techniques**: layers, path trace, boundary, token, spotlight, caption.
   **Review**: Improved — corrected the glue claim (needed only for in-zone name server names), added that `www` is a record not a delegation (zone vs subdomain confusion in the catalog), and the registrar-sets-NS-at-the-TLD fact. Alternative weighed: a postal-forwarding metaphor; worse than the real tree because the boundary-crossing query is the proof. Checked: referral chain via NS records, control follows NS ownership.

### DNS record types (`dns-record-types`)

**The aha**: Each record type answers a different question about a name — A/AAAA for an address, CNAME for an alias, MX for mail, TXT for arbitrary text, NS for delegation — and a CNAME can't share its slot with anything else.
**Misconception to defeat**: Treating "a DNS record" as one thing, or expecting a CNAME to work at the bare domain apex.
**Cast**: A zone file card for `example.com`, drawn as a stack of rows, each row a different coloured record type: A, AAAA, CNAME, MX, TXT, SRV, NS, SOA, CAA (PTR lives in a separate reverse zone). Each row has a mini icon showing what it answers (a signpost for A, a mail icon for MX, a document for TXT).
**Opening frame**: The stack fully populated, each row glowing its own colour. Caption: "One name, many kinds of answer."
**Story**:

1. A browser query lights the A row only: "www → 203.0.113.10." Caption: "Want an address? A (or AAAA for IPv6)."
2. A mail server query lights the MX row: "who handles mail for example.com?" Caption: "Want to send mail? MX."
3. A verification tool queries TXT: a long string ("v=spf1 ...") lights up. Caption: "Arbitrary text: SPF, DKIM, domain proof."
4. A service client looks up SRV `_sip._tcp.example.com` and gets "host sip1.example.com, port 5060". Caption: "Need a host and a port? SRV."
5. Try to add a CNAME row at the bare apex (`example.com` itself): it collides with the A row and with the SOA and NS rows every apex must have, and all flash red, "conflict." Caption: "A CNAME can't coexist with anything else at that name."
6. Move the attempted CNAME to `www.example.com` instead: it sits fine, pointing at `example.net`; the browser's address bar still says www.example.com (unlike an HTTP redirect). Caption: "At a subdomain, no problem. An alias to another name, not a redirect."
7. A provider's "ALIAS" / "flattened CNAME" row appears at the apex, behaving like a CNAME but reported as A. Caption: "Providers invented alias records just to cover the apex."
   **The moment**: Beat 5, the visible conflict when a CNAME tries to sit next to another record — the rule becomes a thing you watch fail, not a thing you're told.
   **Interaction**: Click a record type to see which real-world query lights it; try adding a CNAME anywhere and see where it's allowed.
   **Ending**: The full stack, CNAME correctly placed at `www`, apex alias in its place.
   **Variants**: `dns-resolution`, `dns-zones-and-delegation`.
   **Techniques**: contents, token, spotlight, failure, caption.
   **Review**: Improved — added SRV (was in the catalog but absent), named the real reason the apex can't hold a CNAME (it must hold SOA and NS), and showed CNAME is not a redirect. Alternative weighed: a phone-book metaphor; worse, as the red conflict teaches the rule. Checked: record purposes, CNAME exclusivity, ALIAS/ANAME flattening answering as A.

### DNS TTL and caching (`dns-ttl-and-caching`)

**The aha**: "DNS propagation" isn't a thing travelling anywhere — it's just old cached answers expiring on their own schedules, one TTL ring at a time.
**Misconception to defeat**: That a DNS change "propagates" outward like a wave, reaching everyone at the same moment.
**Cast**: One authoritative record card at the centre, and five cache boxes around it belonging to different holders: a browser, an OS, a corporate resolver, 8.8.8.8, and a long-running app that resolved once at startup (a JVM configured with `networkaddress.cache.ttl=-1`, or a pool of open connections) — each with its own TTL ring, drained at a different point.
**Opening frame**: All five caches full and in sync with the authoritative record, rings at random fill levels. Caption: "Five copies, five clocks."
**Story**:

1. The authoritative record changes instantly (an IP update). Caption: "The source changes right away."
2. Nothing else changes yet — all five caches still show the old value, each ring still partly full. Caption: "Every cache is still showing yesterday's answer."
3. The browser's ring (TTL 60s) empties first; it re-queries and updates. Caption: "Short TTL: catches up fast."
4. The long-running app's entry has no ring at all: it never re-resolves until restarted, so it keeps using the old address. Caption: "Some clients don't even watch the clock."
5. One by one, over minutes, the remaining rings drain and update — never simultaneously. Caption: "That staggered catch-up is what people call 'propagation.'"
6. Negative caching: earlier, a lookup for `new.example.com` returned "doesn't exist" (NXDOMAIN) and each resolver cached that too, for the zone's SOA negative TTL. Now the record is created, yet those resolvers keep saying "doesn't exist" until that ring drains. Caption: "'Doesn't exist' is cached too."
7. Rewind: lower the TTL to 5s well _before_ the change (at least one old TTL ahead, so caches holding the old long TTL have expired), then change the record: all rings drain almost together. Caption: "Plan for it: drop the TTL first, and wait out the old one."
   **The moment**: Beat 4, the client with no ring at all — the moment a "normal" assumption about DNS breaks visibly — then beat 6's cached "doesn't exist" for the second surprise.
   **Interaction**: Dial the TTL before a change and watch how synchronized (or not) the catch-up is; toggle the long-running app's "re-resolves" flag.
   **Ending**: All rings eventually aligned on the new value, timestamps showing how far apart they each updated.
   **Variants**: `dns-resolution`, `recursive-vs-authoritative-dns`.
   **Techniques**: timer, contents, restyle, dial, side by side, caption.
   **Review**: Improved — added negative caching (required by the catalog, missing); replaced the "JVM caches forever" claim, which is only true with a security manager or an explicit -1 setting (default is 30 s), with an accurate long-running-client case; fixed the "lower TTL first" beat (you must wait out the old TTL). Alternative weighed: a rumour-spreading "wave" animation to refute propagation; worse than five clocks, which show there is no wave. Checked: TTL semantics, SOA-based negative TTL (RFC 2308).

### DNS-based traffic routing (GeoDNS, GSLB) (`dns-traffic-routing`)

**The aha**: Authoritative DNS can hand different clients different answers by location or health, but it only steers at lookup time and can't do anything once a connection is already open.
**Misconception to defeat**: That DNS routing reacts instantly, or that it sees the actual end user rather than their resolver.
**Cast**: One authoritative server for `app.example.com`, with three backend regions (US, EU, APAC) each a small server box with a health light. Three client lifelines in different locations, each going through their own recursive resolver.
**Opening frame**: Three clients, three resolvers, one authoritative server, three healthy regions. Caption: "One name, several possible answers."
**Story**:

1. The EU client's resolver queries; the authoritative server, seeing the resolver's location, answers with the EU region's IP. Caption: "Nearest (or best) region, by the resolver's location."
2. An EU user whose public resolver's query happens to leave from a US node gets the US IP: the authoritative server only sees the resolver's address. A resolver that sends EDNS Client Subnet (the user's network prefix) fixes this; many don't. Caption: "It sees the resolver, not always the person."
3. The APAC region's health light turns red after a few failed health checks. The authoritative server starts answering new queries with the EU IP instead. Caption: "Unhealthy region: stop handing it out."
4. A client that resolved APAC _before_ the failure holds a cached answer with a live TTL: it keeps sending to the dead IP, timing out, until its cache expires and it asks again. Caption: "Cached answers don't know. DNS can't reach into a connection."
   **The moment**: Beat 4: fresh lookups flow to EU while the client with the cached APAC answer keeps hitting the dead region — the failover only exists at lookup time, and only as fast as the TTL.
   **Interaction**: Fail a region and watch which clients reroute immediately (fresh lookups) versus which keep going (cached TTL, open connections); adjust TTL to change how long the stale group lasts.
   **Ending**: All fresh lookups routed around the dead region; the stale client still stuck until its TTL drains.
   **Variants**: `dns-resolution`, `dns-ttl-and-caching`, `anycast` (the contrast: no TTL), `split-horizon-dns`.
   **Techniques**: token, spotlight, failure, timer, caption.
   **Review**: Improved — rewrote the muddled VPN beat into the real resolver-location limitation plus EDNS Client Subnet; fixed the moment (an open connection to a dead region is not "unaffected", it simply fails, and DNS cannot move it). Alternative weighed: weighted-routing canary; a good variant but less contrastive with anycast. Checked: location/health/weight policies, TTL-bound failover.

### Split-horizon DNS (`split-horizon-dns`)

**The aha**: The same name can correctly mean two different addresses, depending on which network is asking — there's no single "real" answer.
**Misconception to defeat**: Assuming a name resolves to one true IP everywhere, so a "works here, fails there" result must be a bug.
**Cast**: One authoritative setup for `app.example.com` split into two views: "Internal view" (reachable only from inside the corporate network/VPC) answering with a private IP, and "External view" (the internet) answering with a public IP. Two client lifelines: one inside a boundary labelled "Office/VPC", one outside on "the internet."
**Opening frame**: Both views shown stacked, same name, two different IP cards. Caption: "One name. Two legitimate answers."
**Story**:

1. The office client, inside the boundary, queries and gets the private IP straight to the internal load balancer. Caption: "Ask from inside: get the private address."
2. The internet client, outside the boundary, queries the exact same name and gets the public IP, routed through the internet-facing load balancer. Caption: "Ask from outside: get the public one."
3. An employee at home asks for `wiki.example.com`, a name that exists only in the internal view. Their home resolver asks the public servers, which have no such record: NXDOMAIN, while colleagues in the office resolve it fine. Caption: "Works in the office, fails from home: not a bug, a different horizon."
4. The employee connects to the VPN, which also pushes the corporate resolver as their DNS server; the next query goes there and returns the internal view. Caption: "The view depends on which resolver you ask, and where it sits."
   **The moment**: Beats 1 and 2 against beat 3: the same name gives a private address, a public address, then no answer at all, depending on vantage point — each correct, reframing the "mystery" as expected behaviour.
   **Interaction**: Drag a client across the boundary line and watch which view answers its next query.
   **Ending**: Two views side by side, each consistently serving its own side of the boundary.
   **Variants**: `dns-resolution`, `private-dns-zones`, `dns-traffic-routing`.
   **Techniques**: boundary, side by side, token, move, caption.
   **Review**: Improved — beat 3 gave the home user the public IP yet claimed they couldn't reach "the backend behind the private IP", which they never receive; now the realistic failure is an internal-only name returning NXDOMAIN, and the VPN fix is correctly the pushed corporate resolver, not an abstract boundary. Alternative weighed: caller-ID analogy; worse than the visible two cards. Checked: views are selected by the resolver or source network that asks, not by user identity.

### Private DNS zones (`private-dns-zones`)

**The aha**: A private zone only answers queries from the networks explicitly linked to it — the same name is simply invisible, not just wrong, anywhere else.
**Misconception to defeat**: Expecting a private zone to work like split-horizon DNS automatically, or assuming any VPC in the account can use it.
**Cast**: A private zone box "internal.example.com" sitting inside the cloud's built-in resolver. Three VPC boundaries: VPC-A and VPC-B each with a dashed "linked" line to the zone; VPC-C with no line at all. A client lifeline in each VPC.
**Opening frame**: The zone linked to VPC-A and VPC-B only, VPC-C unlinked and greyed at the link point. Caption: "Linked networks only."
**Story**:

1. Client in VPC-A queries `db.internal.example.com`; the link line lights, the private zone answers with a private IP. Caption: "Linked: it resolves."
2. Client in VPC-B, peered to VPC-A but _not_ linked to the zone, queries the same name: no answer, NXDOMAIN — even though it can reach VPC-A's IPs just fine over the peering. Caption: "Peered isn't linked. The zone doesn't know this network."
3. Admin adds a link from VPC-B to the zone; the dashed line appears, and the same query now resolves. Caption: "Link it, and now it answers."
4. Client in VPC-C (never linked) asks its own built-in resolver, and a laptop on the internet asks a public resolver: both get NXDOMAIN, because the name exists only in the private zone. Caption: "Not linked, or off the internet: the name doesn't exist."
   **The moment**: Beat 2, the surprising failure: network reachability (peering) and DNS visibility (zone linking) are shown as two separate permissions, and having one doesn't grant the other.
   **Interaction**: Toggle the link between the zone and each VPC, and the peering line separately, and watch which clients can resolve and which can connect.
   **Ending**: Link VPC-C too and its client resolves; the internet laptop still gets nothing.
   **Variants**: `split-horizon-dns`, `dns-zones-and-delegation`, `private-endpoint-dns`.
   **Techniques**: boundary, contents, token, failure, toggle, caption.
   **Review**: Improved — beat 4 put a VPC client "on the internet" (VPC-C is a VPC, so it asks its own resolver and gets NXDOMAIN); the ending now links VPC-C and keeps the internet client out; interaction toggles peering and linking independently so the two-permissions point is tried, not told. Alternative weighed: framing as a private phone directory; the same idea, less checkable than link lines. Checked: Route 53 private hosted zone VPC association and Azure Private DNS virtual network links work per network; peering does not share zones.

### Hybrid DNS and conditional forwarding (`hybrid-dns-forwarding`)

**The aha**: The cloud's built-in resolver only answers queries from inside its own network, so each direction across the cloud/on-premises boundary needs its own reachable endpoint and its own forwarding rule.
**Misconception to defeat**: Assuming one VPN or interconnect automatically makes names resolve in both directions.
**Cast**: Two boundaries side by side: "On-premises" with its own DNS server, and "Cloud VPC" with its built-in resolver. A tunnel between them. Inside the VPC boundary, two small endpoint boxes: "Inbound endpoint" and "Outbound endpoint." A forwarding-rule card sits by each DNS server naming which zones go where.
**Opening frame**: On-prem DNS server and cloud resolver, tunnel connected, no forwarding rules yet. Caption: "A tunnel connects the networks. It doesn't connect their DNS."
**Story**:

1. An on-premises machine queries `app.cloud.example.com`: its own DNS server has no rule for that zone and fails. Caption: "On-prem DNS doesn't know this cloud zone exists."
2. Add a conditional-forward rule on the on-prem server: "cloud.example.com → Inbound endpoint." The same query now travels through the tunnel to the Inbound endpoint, which asks the cloud resolver, and the answer returns. Caption: "On-prem forwards the zone to a reachable cloud endpoint."
3. A cloud VM queries `server.onprem.example.com`: the cloud resolver has no rule either, and fails, symmetrically. Caption: "The cloud resolver only answers its own network — on-prem is just as invisible to it."
4. Add the matching rule in the cloud: "onprem.example.com → Outbound endpoint → on-prem DNS server." The query now succeeds in the other direction. Caption: "Each direction needs its own endpoint and its own rule."
5. Both rules work. Then a private endpoint is added in the cloud, with its name in a new private zone (such as `privatelink.blob.core.windows.net`). It resolves from the cloud but fails from on-premises, because the on-prem server forwards only `cloud.example.com`; the new zone needs its own rule. Caption: "Rules are per zone: the usual reason hybrid DNS 'half works.'"
   **The moment**: Beat 3's symmetric failure, mirroring beat 1 — proving the gap isn't about connectivity (the tunnel works) but about two independent, direction-specific DNS rules.
   **Interaction**: Toggle each of the two forwarding rules independently and watch which direction of query succeeds.
   **Ending**: Both rules on, both directions resolving through their respective endpoints.
   **Variants**: `private-dns-zones`, `dns-zones-and-delegation`, `private-endpoint-dns`.
   **Techniques**: boundary, path trace, token, failure, toggle, caption.
   **Review**: Improved — beat 5 contradicted itself ("both rules in place" yet "only the cloud-side rule exists"); it now shows the real trap, a new private zone with no matching on-prem rule. Alternative weighed: a single bidirectional "DNS tunnel" diagram; worse, since it hides exactly the per-direction, per-zone rules that cause the failure. Checked: cloud resolvers (VPC resolver, Azure 168.63.129.16) answer only from inside their network, so inbound endpoints and outbound rules are each needed; forwarding asks, delegation hands over authority.

### DNSSEC (`dnssec`)

**The aha**: DNSSEC proves an answer came from the real zone and wasn't altered in transit — it authenticates, it doesn't encrypt or hide anything.
**Misconception to defeat**: Confusing DNSSEC with privacy (DoH/DoT) or with TLS certificates.
**Cast**: The same root → TLD → authoritative chain as `dns-resolution`, but each zone now holds a public key (DNSKEY) and signs its records (RRSIG seals); the parent zone holds a DS record, a fingerprint of the child's key, signed by the parent. Threads from each DS down to the child key form a visible chain from the root, whose key the resolver already holds (the trust anchor). A resolver lifeline with a "validating" badge.
**Opening frame**: The chain of boxes, each sealed, each seal's thread running up to the parent's DS record, all the way to the root. Caption: "Every answer is signed. Each parent vouches for its child's key."
**Story**:

1. A validating resolver asks the authoritative server for a record; the answer arrives plus its RRSIG seal. Caption: "The answer comes with a signature."
2. The resolver checks the seal against the zone's public key, then matches that key to the DS record in the parent (itself signed), walking up to the root key it already trusts. Caption: "Trust is chained, link by link, to a root it already trusts."
3. An attacker on the path swaps the IP in the answer; the RRSIG no longer matches the altered data. The resolver rejects it outright, no answer at all. Caption: "Tampered? The seal breaks, and the resolver returns an error (SERVFAIL) rather than a lie."
4. Meanwhile, a packet sniffer still reads the plaintext query itself — "what name was asked" is fully visible. Caption: "DNSSEC never hid the question — just proved the answer."
5. A zone admin lets a signature expire; even an honest, untampered record now fails validation and the domain disappears for validating resolvers. Caption: "A broken signature breaks the domain, not just a warning."
   **The moment**: Beat 3, side by side with beat 4: the tampered answer is rejected (authenticity), while the plain-text query sails past unencrypted the whole time (no confidentiality) — the two halves of the misconception, broken at once.
   **Interaction**: Tamper with an answer and watch validation fail; separately, toggle "encrypt the query" to show it's a different, independent feature (DoH/DoT) layered on top.
   **Ending**: The sealed chain intact, a tampered answer rejected beside it, the query still readable on the wire.
   **Variants**: `dns-resolution`, `pki-chain-of-trust` (Security; same "chain to a trusted root" shape, different thing being trusted).
   **Techniques**: layers, path trace, token, failure, spotlight, caption.
   **Review**: Improved — the cast had the DS record on the child pointing up; it lives in the parent and fingerprints the child's key, which is the direction of trust. Named the resolver's failure (SERVFAIL) and the trust anchor; fixed the variant id to Security's `pki-chain-of-trust`. Alternative weighed: a wax-seal-on-letter metaphor; kept the seals but with the real chain. Checked: RRSIG/DNSKEY/DS, signature expiry breaks validation, no confidentiality (DoH/DoT separate).

## 6. HTTP and application protocols

### What happens when you open a URL (`http-request-lifecycle`)

**The aha**: Before a single line of your application code runs, the client has already spent several separate round trips just getting set up — DNS, TCP, TLS — and each one is a different place things can fail or be slow.
**Misconception to defeat**: That "it's slow" or "it's broken" automatically means the server-side code is the problem.
**Cast**: A horizontal timeline from a Browser lifeline on the left to a Server lifeline on the right, the internet cloud between them, with named segments laid end to end: DNS lookup, TCP handshake, TLS handshake, HTTP request, server processing, response. A stopwatch above the whole timeline. Illustrative numbers, client 100 ms round trip from the server: DNS 30 ms (resolver nearby), TCP 100, TLS 1.3 100, request and response 100 plus 20 of server processing.
**Opening frame**: The full timeline drawn but blank, each segment an empty bracket with a label and no duration yet. Caption: "Six separate steps on a first visit."
**Story**:

1. DNS segment fills first, taking a visible sliver of the stopwatch. Caption: "First: turn the name into an address."
2. TCP handshake segment fills next — one round trip across the cloud. Caption: "Then: open a connection."
3. TLS handshake segment fills — another round trip. Caption: "Then: prove who the server is, and agree on keys."
4. HTTP request and response segments fill — the actual ask and answer. Caption: "Only now does your request go out."
5. "Server processing" is spotlit alone: 20 ms of a 350 ms bar. Caption: "Your code: 20 ms of 350."
6. Repeat visit: DNS is cached and the connection is reused, so those three segments vanish (120 ms left, 20 of it server time). Then a CDN edge 20 ms away replaces the far server for the setup steps. Caption: "Cache the name, reuse the connection, terminate closer."
   **The moment**: Beat 5, the direct visual comparison of "server processing" against the full bar — proving most of the wait happened before the server ever touched the request.
   **Interaction**: Click any segment to zoom into its own ladder diagram (DNS, TCP, or TLS); drag a distance dial to scale the round trip and watch the setup segments grow while server time stays fixed; toggle "cold" vs "warm".
   **Ending**: Cold and warm timelines stacked: 350 ms against 120 ms, the same 20 ms of server code in both.
   **Variants**: `dns-resolution`, `tcp-handshake`, `tls-handshake`, `cdn`.
   **Techniques**: lanes, timer, spotlight, side by side, toggle, caption.
   **Review**: Improved — the old ending claimed server processing becomes "the dominant slice" when warm, which no number supports; the plan now carries concrete figures that add up (30+100+100+120 = 350 ms cold; 100+20 = 120 warm). Added the distance dial. Alternative weighed: a package-tracking metaphor; worse than a measured bar. Checked: TCP 1 RTT, TLS 1.3 1 RTT, DNS cached on repeat visits.

### HTTP requests and responses (`http-request-response`)

**The aha**: HTTP is stateless and self-contained — each request carries everything the server needs to answer it, and the method itself carries meaning that other software relies on.
**Misconception to defeat**: That HTTP "remembers" anything between requests on its own, or that methods are just arbitrary labels.
**Cast**: A single request card and response card side by side. Request: method badge (GET), URL bar (scheme/host/port/path/query segments colour-coded), a stack of header rows, an optional body tray. Response: status badge, header rows, body tray.
**Opening frame**: An empty request card, each field labelled but blank. Caption: "Everything the server needs, in one package."
**Story**:

1. A GET request fills in: method "GET", URL `https://shop.example.com:443/items?id=42`, each URL segment lighting as it's named. Caption: "Scheme, host, port, path, query — all present, all explicit."
2. The request flies to the server; the server reads it cold, no memory of any prior request, and still answers correctly because nothing was assumed. Caption: "Stateless: this request alone is enough."
3. A second request, PUT, with a body tray full of JSON, flies over; a repeat of the exact same PUT lands with the same end state both times. Caption: "PUT is idempotent — repeating it changes nothing further."
4. A proxy intercepts a GET and safely retries it after a timeout without asking anyone; the same proxy refuses to auto-retry a POST. Caption: "Methods carry a contract other software trusts."
5. The response card fills: status 200, `Content-Type: application/json`, `Cache-Control: max-age=60`, a JSON body. Caption: "The response answers in the same self-contained way."
   **The moment**: Beat 4, the proxy's differing behaviour on GET vs POST — made visible and automatic, not asserted — shows that method semantics aren't decoration.
   **Interaction**: Swap the method badge (GET/POST/PUT/DELETE) and watch which ones the proxy is willing to retry automatically.
   **Ending**: Request and response cards both fully lit, side by side, nothing missing from either.
   **Variants**: `http-status-codes`, `http-versions`, `rest-graphql-grpc`.
   **Techniques**: contents, spotlight, token, side by side, caption.
   **Review**: Keep — the aha (stateless, self-contained, methods carry a contract) is the real core; the GET-retried / POST-not beat shows that contract operating rather than asserting it. Alternative weighed: a letter-in-an-envelope metaphor, worse because the retry contrast is checkable behaviour. Checked: GET is safe and idempotent, PUT and DELETE idempotent, POST and PATCH not; clients and proxies (nginx by default) retry only idempotent requests; URL parts and example headers correct.

### HTTP status codes (`http-status-codes`)

**The aha**: The first digit says who has to act (client, server, or follow a redirect), and behind a proxy or load balancer a 502/503/504 is usually generated by the balancer about its upstream, so look at the hop in front of your code first.
**Misconception to defeat**: Reading every 5xx as "my app crashed," or confusing 401 with 403 and 502 with 504.
**Cast**: A response card with a large three-digit status badge and a coloured class ring around it: 1xx grey, 2xx green, 3xx blue, 4xx amber, 5xx red. Behind the server, a chain: Client → Load balancer → App server.
**Opening frame**: Five sample badges laid out by class, each ring-coloured. Caption: "The first digit says who has to act."
**Story**:

1. 200 lights green: the app answered normally. Caption: "2xx: it worked."
2. 404 lights amber on a typo'd path: the client asked for something that doesn't exist. Caption: "4xx: the client's problem."
3. 401 vs 403 contrasted: 401 fires when credentials are missing or invalid (and it says how to authenticate); 403 fires when the caller is identified but not allowed. Caption: "401: who are you? 403: I know who you are, and no."
4. Redirects: `http://shop.example.com` returns 301 (moved permanently) and the browser stores it, skipping the hop next time; a "sale page" returns 302 (temporary) and is re-asked each time. Caption: "301: remember this. 302: just for now."
5. Health checks mark every backend unhealthy; the load balancer returns 503 itself, never reaching an app. Caption: "503: no healthy upstream, said by the balancer."
6. The app server hangs, and the load balancer's timeout expires: 504. Caption: "504: the upstream was too slow."
7. The app crashes mid-reply, or sends something that isn't valid HTTP: 502. Caption: "502: the upstream answered badly, or not at all."
   **The moment**: Beats 5–7, each 5xx badge appearing physically at the load balancer's lifeline while the app server sits untouched or dead behind it — relocating blame from "my code" to "the hop in front of it."
   **Interaction**: Break the app server three different ways (mark it unhealthy, hang it, corrupt its response) and watch which status code the load balancer produces each time.
   **Ending**: The chain with the correct status code sitting at the correct hop for each failure mode.
   **Variants**: `http-request-response`, `l4-vs-l7-load-balancing`, `reverse-proxy`.
   **Techniques**: restyle, spotlight, path trace, failure, choice, caption.
   **Review**: Improved — added 301 vs 302 (required, absent); 401 now "missing or invalid credentials", not "none sent"; a freshly killed app typically yields 502 (connection refused), while 503 means every backend is marked unhealthy, so beat 4 was fixed; the aha no longer overclaims (apps can send 503/500 too). Alternative weighed: a restaurant-order metaphor; worse than badges at the hop where they originate. Checked: 401/403, 301/302/307/308 semantics, 502/503/504 as balancers generate them.

### HTTP/1.1 vs HTTP/2 vs HTTP/3 (`http-versions`)

**The aha**: Methods, headers and status codes never change across versions — what changes is how requests share the wire: many connections, then one multiplexed connection, then one connection whose streams don't block each other.
**Misconception to defeat**: Thinking HTTP/2 or HTTP/3 is "a different protocol" with different verbs, or that upgrading automatically fixes everything.
**Cast**: Three side-by-side columns, same page to load (one HTML plus eleven assets), same browser and server. HTTP/1.1: six separate TCP lifelines. HTTP/2: one TCP lifeline carrying the streams, drawn as coloured lanes. HTTP/3: one QUIC-over-UDP lifeline carrying the same streams as independent lanes.
**Opening frame**: All three columns at rest, same six requests queued identically on each. Caption: "Same page. Same requests. Different wires."
**Story**:

1. HTTP/1.1 column: six connections open (each paying its own TCP + TLS setup); each carries one request at a time, so the other six requests queue behind them, and a slow response holds up the one behind it. Caption: "HTTP/1.1: about six connections, one request at a time on each."
2. HTTP/2 column: one connection, one TLS handshake, all twelve requests sent at once as interleaved streams. Caption: "HTTP/2: one connection, many streams."
3. Drop one packet on the HTTP/2 connection: every stream stalls, because TCP must deliver bytes in order underneath. Caption: "One lost packet: every stream waits."
4. HTTP/3 column: one QUIC connection over UDP (found through Alt-Svc or an HTTPS DNS record after a first visit), same streams, independent at the transport level. Drop one packet: only the stream it belonged to stalls. Caption: "HTTP/3: one lost packet stalls only its own stream."
5. Scoreboard under 1% loss: HTTP/1.1 slowest, HTTP/2 mid, HTTP/3 fastest. Dial loss to 0%: HTTP/2 and HTTP/3 nearly tie (HTTP/3 only saves a setup round trip, since QUIC folds TCP and TLS together). Caption: "The gap grows with loss."
   **The moment**: Beats 3 and 4, side by side: the identical dropped packet freezes everything in HTTP/2 but only one stream in HTTP/3 — because QUIC gives each stream independent delivery instead of one shared ordered pipe.
   **Interaction**: Drag a "packet loss %" dial and watch all three finish times diverge; pick which single stream loses a packet in HTTP/3.
   **Ending**: Three finish times on one scoreboard, same page, same network, different protocol machinery.
   **Variants**: `tcp-vs-udp`, `head-of-line-blocking`, `quic`, `tls-handshake`.
   **Techniques**: side by side, lanes, stream, failure, dial, meter, caption.
   **Review**: Improved — "one HTML plus five assets" never queued on six connections, so HTTP/1.1's one-request-at-a-time cost was invisible and the beat text was garbled; now eleven assets. Beat 5 no longer implies HTTP/3 always wins (equal at 0% loss except one RTT of setup); added how H3 is discovered. Alternative weighed: motorway lanes vs single-file; the same idea, less precise than dropped-packet lanes. Checked: ALPN negotiates h2, TCP in-order delivery stalls all streams, QUIC streams independent.

### HTTP caching headers (`http-caching`)

**The aha**: The origin server decides what every cache along the path is allowed to store and for how long, purely through response headers — and "no-cache" means "check with me first," not "don't store."
**Misconception to defeat**: Reading no-cache as "never store this" (that's no-store), or thinking a 304 skips the round trip.
**Cast**: Origin server on the right, a shared cache (CDN/proxy) in the middle, a browser on the left. Each response card shows its `Cache-Control`, `ETag` and `Vary` headers prominently.
**Opening frame**: Browser and cache both empty. Caption: "The origin sets the rules. Everyone downstream obeys them."
**Story**:

1. Origin answers with `Cache-Control: public, max-age=60` and an ETag; the shared cache stores a copy, stamped with its own 60s TTL ring. Caption: "Public and cacheable: store it, for 60 seconds."
2. A second client's request within 60s is answered straight from the shared cache — the origin is never touched. Caption: "A hit never leaves the cache."
3. After the 60s ring drains, the entry goes stale. The cache doesn't discard it: it sends the ETag back as `If-None-Match` asking "still good?" The origin replies 304 Not Modified, body omitted, and the ring refills. Caption: "304 saves the body, not the trip."
4. A different resource carries `Cache-Control: no-cache`: the cache stores it, but its ring is empty from the start, so every request revalidates (304 each time). Beside it, `no-store`: the cache refuses to keep any copy. Caption: "no-cache: store it, ask first. no-store: don't keep it."
5. A third response carries `Vary: Accept-Encoding`; two requests differing only in that header get stored as two separate cache entries. Caption: "Vary splits the cache by whichever header it names."
   **The moment**: Beat 4, the no-cache entry sitting in the cache yet asking the origin on every request, side by side with no-store's empty slot: the header's name misleads, and the two behaviours are finally distinct.
   **Interaction**: Swap `Cache-Control` values (`no-cache`, `no-store`, `max-age=N`) on one response and watch what the shared cache does on the next two requests.
   **Ending**: Cache holding a fresh, revalidated entry; the no-store resource still empty beside it.
   **Variants**: `dns-ttl-and-caching` (same TTL-ring idea, different layer), `cdn`.
   **Techniques**: contents, timer, token, failure, side by side, caption.
   **Review**: Improved — beat 3 mixed up two things (revalidation after max-age expiry vs the meaning of no-cache) and the moment sat on the wrong beat; split them: expiry then 304 (saves the body, not the trip), then no-cache vs no-store side by side. Alternative weighed: a milk-carton "best before" metaphor; worse than rings with real headers. Checked: If-None-Match/304, no-cache = revalidate before reuse, no-store = do not store, Vary splits cache entries.

### HTTP cookies (`http-cookies`)

**The aha**: Cookies are how state rides on top of stateless HTTP — but it's the browser, not your code, that decides when to attach one, which is exactly what makes cross-site request forgery possible.
**Misconception to defeat**: Thinking the server "remembers" the client, or that a cookie is just like any other piece of request data your code controls.
**Cast**: Server on the right with a `Set-Cookie` card (name/value, Domain, Path, Expires, Secure, HttpOnly, SameSite badges). Browser on the left holding a small cookie jar. Two site tabs open in the browser: `bank.example.com` and `evil.example.net` (a different site: SameSite compares registrable domains, so a sibling subdomain like evil.example.com would count as same-site and not be blocked).
**Opening frame**: Empty jar, no cookie set yet. Caption: "HTTP forgets everything. Cookies are the patch."
**Story**:

1. Server responds to a login with `Set-Cookie: session=abc123; Secure; HttpOnly; SameSite=Lax`; the jar gains one labelled cookie. Caption: "The server hands over a cookie..."
2. Every later request to `bank.example.com` automatically carries that cookie in its headers — the browser attaches it without being asked by any code. Scope chips light up: Domain and Path decide which URLs get it; Max-Age or Expires decide when the jar throws it away (without either it vanishes when the browser session ends). Caption: "...and the browser attaches it automatically, to matching URLs, until it expires."
3. The user opens `evil.example.net` in another tab; its page tries to submit a form to `bank.example.com`. Because SameSite=Lax blocks it on a cross-site POST, the cookie is withheld and the forged request arrives without the session. Caption: "SameSite: don't attach the cookie to a cross-site request like this."
4. Flip SameSite to None on the same cookie and repeat: the forged POST now sails through _with_ the session cookie attached, succeeding as if the real user clicked it. Caption: "Without SameSite's restriction, the browser would've helped the attacker."
5. A script on `bank.example.com` itself tries to read `document.cookie`: HttpOnly blocks it. Caption: "HttpOnly: not even your own page's JavaScript can touch it."
   **The moment**: Beats 3–4 side by side — the exact same forged form submission from `evil.example.net`, blocked under SameSite=Lax and succeeding under SameSite=None — making CSRF a thing you watch happen, not a warning you're told about.
   **Interaction**: Toggle SameSite (Strict/Lax/None) and HttpOnly and watch which forged or script-based attempt succeeds.
   **Ending**: The jar holding one cookie, the forged cross-site request bounced, Lax or Strict in place.
   **Variants**: `cors-same-origin-policy` (Security), `http-request-response`.
   **Techniques**: contents, token, failure, toggle, side by side, caption.
   **Review**: Improved — a real technical slip: the attacker page was `evil.example.com` and the target `bank.example.com`, which are the same site, so SameSite=Lax would NOT block the forged POST; moved the attacker to a different registrable domain. Added Domain/Path/Expiry scoping (catalog attributes). Alternative weighed: a cloakroom-ticket metaphor; worse because the CSRF replay is the point. Checked: Lax withholds on cross-site POST but allows top-level GET navigation, SameSite=None needs Secure, HttpOnly blocks document.cookie.

### CORS and the same-origin policy (`cors`)

**The aha**: CORS is enforced by the browser alone — the request usually still reaches the server and gets a real response; what CORS controls is whether the browser's own page is allowed to _read_ that response.
**Misconception to defeat**: Believing CORS is a server-side security wall, or that curl and other backends respect it.
**Cast**: A browser tab on `shop.example.com` running a script, a target server at `api.example.com`, and a curl terminal below both hitting the same endpoint. A browser-only "read gate" sits between the response and the script.
**Opening frame**: Script about to call `fetch('https://api.example.com/data')`. Caption: "Different origin: scheme, host or port differs."
**Story**:

1. curl calls the same endpoint directly: response arrives, body printed in full, no gate anywhere. Caption: "curl doesn't care about origins. It just reads the response."
2. The browser's script makes the same request: it physically reaches the server, which processes it and sends back a full response — visible travelling all the way to the browser. Caption: "The request gets there. The server answers normally."
3. At the browser's read gate, no `Access-Control-Allow-Origin` header is present: the gate slams shut and the script's `fetch` throws an error — but the response already arrived and, for a GET with side effects, already happened server-side. Caption: "The browser blocks the script from _reading_ it. The call itself already landed."
4. Server adds `Access-Control-Allow-Origin: https://shop.example.com`; the gate now opens and the script receives the data. Caption: "Opt in, and the browser lets the page read it."
5. A non-simple request (custom header, PUT) triggers an OPTIONS preflight first, asking permission before the real request is even sent. Caption: "Preflight: ask before trying, for anything beyond the basics."
   **The moment**: Beat 3, the response visibly arriving at the browser and only then being blocked at the read gate — separating "did the request happen" from "can the page see the answer," which is the whole misconception in one frame.
   **Interaction**: Toggle the `Access-Control-Allow-Origin` header on and off and watch the gate open or shut on an otherwise identical, already-delivered response.
   **Ending**: Gate open, script holding the data; curl's terminal, unaffected throughout, shown one more time for contrast.
   **Variants**: `http-cookies`, `http-request-response`.
   **Techniques**: boundary, token, failure, side by side, toggle, caption.
   **Review**: Merged — owned by Security (`cors-same-origin-policy` in `plans/security.part2.md`). That plan should borrow: the curl-beside-the-browser contrast (curl gets the body, no gate) as the opening, since it makes "the browser enforces it" visible; the response travelling all the way to the browser before the read gate slams (Security's beat 1 only says it); the OPTIONS preflight beat for non-simple requests, which Security lacks; and the "origin = scheme + host + port" line in the opening frame. Security's beat 4 (reflected origin with credentials) is better than anything here and stays.

### Server-Sent Events (SSE) (`server-sent-events`)

**The aha**: When only the server needs to push updates, an ordinary HTTP response that simply never finishes is enough — no protocol upgrade, and it reconnects itself if it drops.
**Misconception to defeat**: Assuming any server push needs WebSockets, or that SSE is just repeated polling.
**Cast**: Client and server lifelines joined by one HTTP connection, `Content-Type: text/event-stream`, drawn as a pipe that stays open instead of closing after one response. Events appear as small tokens riding down the open pipe, each stamped with an id.
**Opening frame**: Client has just sent one GET; response headers arrived (200, text/event-stream) but the body is still "open." Caption: "One request. The response never ends."
**Story**:

1. A progress event rides the open pipe to the client: `data: 42%`, id `7`. Caption: "The server writes an event whenever it has one."
2. Contrast inset: a polling client repeats full GET/response round trips every second, each with its own headers and handshake overhead, visibly more arrows for the same information. Caption: "Polling: ask again and again. SSE: stay on the line."
3. The network drops mid-stream (red flash on the pipe); the client's EventSource reconnects on its own, sending `Last-Event-ID: 7`. Caption: "Built-in reconnect, after a short delay, sending the last id it saw."
4. The server reads `Last-Event-ID: 7`, replays what it kept after that id, and carries on from event 8 (it must buffer recent events to do this; the browser only supplies the id). Caption: "Resume, if the server keeps a short memory."
5. The same open-pipe pattern is shown passing cleanly through an ordinary reverse proxy and over HTTP/2, no special "upgrade" step anywhere. Caption: "Just HTTP. No protocol switch (but proxies mustn't buffer it)."
   **The moment**: Beat 3, the self-healing reconnect carrying its own resume point — the detail that makes SSE more than "polling with a long request."
   **Interaction**: Kill the connection at any point and watch the reconnect and resume happen automatically; compare arrow-count against the polling inset at different update rates.
   **Ending**: The pipe open and quiet, ready for the next event, id counter holding its place.
   **Variants**: `websockets`, `http-versions`.
   **Techniques**: stream, token, failure, side by side, caption.
   **Review**: Improved — "nothing replayed, nothing lost" overclaimed: EventSource only sends Last-Event-ID, the server must keep and replay events; added the proxy-buffering caveat and reconnect delay. Alternative weighed: leading with the WebSocket comparison; worse, since polling is the misconception to defeat. Checked: text/event-stream, EventSource auto-reconnect, works over HTTP/2.

### WebSockets (`websockets`)

**The aha**: After the upgrade handshake, a WebSocket is no longer request/response at all — either side can send at any time over the same long-lived connection, so load balancers and clients both need a different plan for it.
**Misconception to defeat**: Thinking WebSockets are "just another HTTP request," or confusing them with SSE's one-way stream.
**Cast**: Client and server lifelines. First segment: an ordinary HTTP request with `Upgrade: websocket`, answered `101 Switching Protocols`. Second segment: the same connection redrawn as a plain two-way pipe with framed messages flowing in both directions, no more request/response pairing.
**Opening frame**: The HTTP upgrade request sitting on the lifeline, unanswered. Caption: "It starts as an ordinary request..."
**Story**:

1. Server answers `101 Switching Protocols`; the ladder's request/response arrows dissolve into a single open two-way pipe. Caption: "...and then the rules change completely."
2. The server sends a message with no request preceding it; the client sends one a moment later, unprompted, overlapping in time. Caption: "Either side, any time — not a question-and-answer anymore."
3. A load balancer in front picks backend A when the upgrade arrives; after the 101 the connection is just a pipe, so every message for its whole lifetime goes to A (L4 or L7 alike; an L7 balancer must also support the Upgrade). Caption: "Long-lived and stateful: it sticks to one backend."
4. The app deploys a new version; backend A is terminated mid-conversation. The pipe breaks (red flash); the client's reconnect logic opens a fresh connection, which lands on backend B via a fresh upgrade handshake. Caption: "Scaling or deploying drops it. The client needs a reconnect plan."
5. An idle minute: the balancer's idle timeout (often 60 s to 4 min) cuts the silent pipe; periodic ping/pong frames from either side keep it alive. Caption: "Silence looks dead to the network: send pings."
6. Contrast inset, shrunk: SSE's one-way pipe beside this one's two-way pipe. Caption: "SSE: server to client only. WebSockets: both ways."
   **The moment**: Beat 3, the connection's permanent pin to one backend through the load balancer — the detail that trips up people who think of it as "just HTTP requests, some load balancer will sort it out."
   **Interaction**: Kill the pinned backend mid-session and watch the reconnect land somewhere new; compare against the SSE inset's one-way arrows.
   **Ending**: A fresh pipe open on the new backend, messages flowing both ways again.
   **Variants**: `server-sent-events`, `http-versions`, `l4-vs-l7-load-balancing`.
   **Techniques**: exchange, stream, restyle, failure, path trace, side by side, caption.
   **Review**: Improved — beat 3 said an L4 balancer pins the connection, implying L7 would not; any balancer pins an upgraded WebSocket, so the qualifier is gone and L7 only needs Upgrade support. Added the idle-timeout beat with ping/pong (catalog mentions idle timeouts). Alternative weighed: a phone call vs letters analogy; the ladder dissolving into a pipe shows it better. Checked: 101 Switching Protocols, RFC 6455, full duplex.

### REST vs GraphQL vs gRPC (`rest-graphql-grpc`)

**The aha**: The three differ in who shapes the response and what the network actually sees — REST's many cacheable URLs, GraphQL's one endpoint shaped by the client's query, and gRPC's typed binary calls pinned to one long-lived HTTP/2 connection.
**Misconception to defeat**: Treating all three as interchangeable "ways to call an API" with no structural difference.
**Cast**: Three columns, same task: fetch a user and their last 3 orders. REST column: three separate GET requests to three URLs. GraphQL column: one POST to one endpoint carrying a query describing exactly those fields. gRPC column: one typed method call, binary payload, over a single persistent HTTP/2 connection.
**Opening frame**: Three columns at rest, same data need, three different shapes of request already visible. Caption: "Same question. Three different conversations."
**Story**:

1. REST column: GET `/users/42`, then GET `/users/42/orders`, then GET `/orders/99/items` — three round trips, each cacheable, each URL meaningful to any cache on the path. Caption: "Resources, by URL. Cacheable by any proxy that understands HTTP."
2. GraphQL column: one POST to `/graphql` with a query naming exactly `user.name, user.orders(last:3){id,total}`; one round trip, over-fetching avoided — but it's a POST, so shared HTTP caches see nothing to cache. Caption: "One round trip, exactly the fields asked for — invisible to HTTP caches."
3. gRPC column: a typed `GetUserWithOrders(42)` call, compact binary frame, riding one already-open HTTP/2 connection alongside other concurrent calls as separate streams. Caption: "Typed, compact, and fast between services that both speak gRPC."
4. Put an L4 load balancer in front of each: REST's separate short connections spread normally across backends; gRPC's one long-lived HTTP/2 connection pins every call on it to a single backend, exactly like `websockets`. Caption: "gRPC's efficiency has a cost: one connection, one backend, unless the balancer understands L7."
5. A browser tries to call the gRPC service directly: it can't speak raw gRPC, so a gRPC-Web translation layer is needed in front. Caption: "Browsers need a translator gRPC doesn't give them for free."
   **The moment**: Beat 4, the same L4-pinning problem from `websockets` recurring here for a completely different protocol — showing it's a property of "one long connection carrying many calls," not of any one technology.
   **Interaction**: Pick which of the three fetches the same data and compare round-trip count, cacheability, and payload size on one scoreboard.
   **Ending**: Scoreboard: REST (3 round trips, cacheable), GraphQL (1 round trip, right-sized, uncached), gRPC (1 call, smallest payload, pinned connection).
   **Variants**: `http-request-response`, `l4-vs-l7-load-balancing`, `websockets`.
   **Techniques**: side by side, token, meter, path trace, caption.
   **Review**: Merged — owned by Architecture (`api-styles` in `plans/architecture.part2.md`). That plan should borrow: the same-task framing (fetch a user and last 3 orders) so the three are compared on identical work; the round-trip count and cacheability scoreboard (REST 3 cacheable, GraphQL 1 POST that HTTP caches skip, gRPC 1 binary call); the L4-pinning beat (one long HTTP/2 connection sticks to one backend unless the balancer is L7, which also answers its "gRPC is just HTTP/2" misconception); and gRPC-Web for browsers. Fix to avoid on borrowing: GraphQL is not always POST (GET is allowed) but is mostly POSTed in practice.

## 7. TLS and security in transit

### HTTPS and what TLS protects (`https-and-tls`)

**The aha**: TLS hides the URL path, headers and body — but an eavesdropper still sees the IP addresses, the port, the hostname (via SNI), and the timing and sizes of everything that crosses the wire.
**Misconception to defeat**: That HTTPS makes a connection invisible, hiding which site you're visiting.
**Cast**: A client and server lifeline with the internet cloud between them, and a watcher icon ("network observer") sitting beside the cloud. The HTTP request travels inside a locked envelope; around the envelope, several fields stay unlocked and visible: destination IP, port 443, the SNI hostname, packet sizes over time.
**Opening frame**: The locked envelope mid-flight, with the unlocked outer fields clearly legible beside it. Caption: "Locked inside. Some things stay outside the lock."
**Story**:

1. Just before the connection, the watcher sees the DNS lookup for shop.example.com (plain unless DoH/DoT), then reads the outer fields: "destination 203.0.113.10, port 443, hostname shop.example.com" (the SNI). Caption: "The observer already knows which site this is."
2. The watcher tries to open the envelope: the lock holds, path/headers/body stay hidden. Caption: "The path, headers and body are locked away."
3. A sequence of requests shown as a stream of envelope sizes and timings, no content, but the watcher reads a shape in them — "load homepage, then image, then checkout" — purely from sizes and gaps. Caption: "Even sizes and timing leak a shape."
4. A user types `shop.example.com` with no scheme and the first request goes out over plain HTTP, envelope open, where an attacker could strip the upgrade to HTTPS. After one HTTPS visit, HSTS appears as a sticky note on the browser: "always use HTTPS for this site." Preload lists build it in before any visit. Caption: "HSTS closes that weak first hop, from the second visit on."
5. A toggle swaps SNI for Encrypted Client Hello: the hostname field blurs out, leaving only the IP. Caption: "ECH hides the name, but only helps when the IP is shared by many sites."
   **The moment**: Beat 1, the watcher confidently reading the hostname and destination straight off the outside of a "secure" connection — directly contradicting the common belief that HTTPS makes browsing private from observers.
   **Interaction**: Toggle ECH on/off to see the SNI field appear or blur; scrub through a session's envelope-size stream to see what shape leaks without content.
   **Ending**: The locked envelope still travelling, the outer fields still legible beside it.
   **Variants**: `tls-handshake`, `sni`, `pki-chain-of-trust` (Security).
   **Techniques**: boundary, spotlight, stream, toggle, caption.
   **Review**: Improved — HSTS cannot close the first plain-HTTP visit by itself (it is learned over HTTPS; only preload covers a first visit), so beat 4 now says so; added the plaintext DNS lookup the observer also sees; ECH helps only when the IP is shared. Alternative weighed: a postcard-versus-sealed-envelope metaphor; the outer fields on the envelope are exactly that, kept. Checked: TLS gives confidentiality, integrity and server authentication; SNI/IP/port/size/timing visible.

### TLS handshake (`tls-handshake`)

**The aha**: Slow asymmetric cryptography is used briefly just to authenticate the server and agree on keys; everything after that runs on fast symmetric encryption — and TLS 1.3 does the whole setup in one round trip instead of TLS 1.2's two.
**Misconception to defeat**: Confusing the TLS handshake with the TCP handshake, or thinking certificate checking is the whole handshake.
**Cast**: A ladder: Client and Server lifelines, below a completed TCP handshake (drawn thin, already done). TLS 1.2's version of the handshake on the left (two round trips), TLS 1.3's on the right (one round trip), side by side. A small key icon appears once session keys are derived.
**Opening frame**: Both ladders poised at "TCP already connected," TLS not yet started. Caption: "TCP is open. Now prove identity and agree on keys."
**Story**:

1. TLS 1.2 side: ClientHello down, ServerHello + certificate + key exchange back up (round trip 1), then client's key exchange and Finished down, server's Finished back (round trip 2). Caption: "TLS 1.2: two round trips before data flows."
2. TLS 1.3 side, same moment: ClientHello goes down already carrying a key share (the client's half of a Diffie-Hellman exchange, guessed for a group the server likely supports). ServerHello returns the server's key share, so both can derive keys; the certificate and the server's Finished follow already encrypted. The client's Finished and its first HTTP request go down together. Caption: "TLS 1.3: key shares in the first flight, so one round trip."
3. Zoom into the certificate step on either side: client checks the chain back to a trusted root (link to `pki-chain-of-trust`), and the server signs the handshake to prove it holds the key (CertificateVerify). Caption: "Authentication happens here, briefly."
4. Once keys are derived, every later message switches from the asymmetric lock icon to a fast symmetric padlock icon. Caption: "Key exchange got you the keys. Symmetric carries the data."
5. A returning client resumes a prior session: 0-RTT, sending encrypted application data in the very first flight, before the handshake even finishes. A caution flag appears: "replayable — only safe for idempotent requests." Caption: "Resumption: data in the first flight, with a catch."
   **The moment**: Beat 2 directly beside beat 1 — the same cryptographic job finishing in one round trip instead of two, which is the entire reason TLS 1.3 matters for latency.
   **Interaction**: Step each version's handshake one message at a time; toggle 0-RTT resumption and see the replay warning appear.
   **Ending**: Both ladders at rest, data flowing symmetrically encrypted; the RTT count displayed under each (2 vs 1 vs 0).
   **Variants**: `tcp-handshake`, `pki-chain-of-trust` (Security), `https-and-tls`, `quic`.
   **Techniques**: exchange, side by side, token, restyle, spotlight, caption.
   **Review**: Improved — beat 2 claimed the server's first reply "can already carry data"; the point of 1.3 is key shares in the ClientHello and ServerHello, so one round trip finishes the handshake and the client's request rides with its Finished. Now shows the key shares (the mechanism the aha needs), CertificateVerify, and encrypted certificate. Alternative weighed: a lock-and-paint-mixing colour analogy for key exchange; good but longer. Checked: 1.2 = 2 RTT, 1.3 = 1 RTT, 0-RTT replayable (RFC 8446).

### Certificates and the chain of trust (`certificate-chain-of-trust`)

**The aha**: Trust doesn't live in the certificate itself — it lives in an unbroken chain of signatures from the leaf certificate up through intermediates to a root the client already trusts, and a missing intermediate breaks that chain for strict clients even when it works in a browser.
**Misconception to defeat**: Thinking a certificate is "trusted" by itself, or that encryption and authentication are the same claim.
**Cast**: A vertical stack of signature cards: Root CA (pre-installed in the client's trust store, drawn as a small vault icon), Intermediate CA, Leaf certificate (`shop.example.com`, SANs, validity dates). Each card's bottom edge is a signature that visibly matches a seal on the card below it.
**Opening frame**: All three cards stacked and sealed, root already glowing inside the client's trust store. Caption: "Trust starts at a root the client already has."
**Story**:

1. The client receives the Leaf and Intermediate from the server; it checks the Leaf's signature against the Intermediate's key — match, seal glows. Caption: "Leaf signed by Intermediate: check."
2. It checks the Intermediate's signature against the Root it already holds locally — match, seal glows, the chain is now unbroken top to bottom. Caption: "Intermediate signed by a Root I already trust: check."
3. It checks the names (SANs) and validity dates on the Leaf against the site being visited. Caption: "Right names, right dates."
4. The server is reconfigured to send only the Leaf, omitting the Intermediate. In a browser, a cached or auto-fetched copy of the Intermediate quietly fills the gap and the chain still completes. In curl, no such fallback exists — the chain visibly breaks mid-stack and the connection is refused. Caption: "A missing intermediate: browsers often paper over it. curl, Java, Go don't."
5. A self-signed certificate is tried: no Intermediate, no path to any Root the client holds — the chain simply has nowhere to go, and the connection is refused everywhere. Caption: "Self-signed: no path to a trusted root at all."
   **The moment**: Beat 4, the same missing-intermediate server behaving differently in a browser versus curl — this is the real-world failure that the "it works for me" reports are usually about.
   **Interaction**: Remove the Intermediate from what the server sends and switch the client between "browser" (lenient) and "curl" (strict) to see the chain complete or break.
   **Ending**: The full stack sealed top to bottom, client accepting the connection.
   **Variants**: `tls-handshake`, `sni`, `dnssec` (same chain-to-a-trusted-root shape, different subject).
   **Techniques**: layers, path trace, token, failure, side by side, caption.
   **Review**: Merged — owned by Security (`pki-chain-of-trust` in `plans/security.part2.md`). That plan should borrow: the missing-intermediate beat (server sends only the leaf; browsers often fill the gap from a cached or fetched intermediate, curl, Java and Go refuse), which is the failure people actually hit and Security's plan lacks; the SAN-name and validity-date check as its own beat (the chain is not the whole check); the client-side "browser vs curl" toggle. Security's root-compromise beat and its opening trust store of many roots are better than this plan's and stay.

### Server Name Indication (SNI) (`sni`)

**The aha**: The client names the hostname it wants in the very first handshake message, in plaintext, before any certificate is chosen — which is how one IP address serves many sites with different certificates, and how firewalls can filter HTTPS by domain.
**Misconception to defeat**: Confusing SNI with the HTTP Host header, or expecting a shared load balancer to "just know" which certificate to use.
**Cast**: One IP address, one load balancer box holding a shelf of certificate cards: `shop.example.com`, `blog.example.com`, `api.example.com`. A client's ClientHello message, with a visible "SNI: shop.example.com" field, as the very first arrow in the TLS handshake.
**Opening frame**: The shelf of certificates, the ClientHello poised, unsent. Caption: "One IP. Three sites behind it. Which certificate?"
**Story**:

1. ClientHello arrives, SNI field spotlit: "shop.example.com." The load balancer reads it before anything else happens and pulls the matching certificate off the shelf. Caption: "Named before any encryption even starts."
2. The handshake completes with the right certificate; only now does the actual HTTP request, with its own Host header, travel — inside the now-encrypted channel. Caption: "Host header comes later, and it's encrypted. SNI came first, in the clear."
3. A client deliberately omits SNI: the load balancer falls back to a default certificate, and the client's hostname check fails against it — a name-mismatch error. Caption: "No SNI: you get whatever's default, and it probably won't match."
4. A corporate firewall, watching only the SNI field (never decrypting anything), blocks every ClientHello naming `blog.example.com` while letting `shop.example.com` through. Then ECH turns on: the real name travels encrypted inside the hello and the firewall sees only the shared front name. Caption: "Firewalls can filter HTTPS by domain from this one plaintext field, until ECH."
   **The moment**: Beat 2, the explicit before/after across the encryption boundary — SNI unencrypted and first, Host header encrypted and later — which is the exact distinction people get backwards.
   **Interaction**: Toggle SNI on/off on the ClientHello and watch which certificate gets served; toggle the firewall filter and ECH and watch which ClientHellos get through.
   **Ending**: Handshake complete on the right certificate, Host header travelling safely inside the encrypted channel.
   **Variants**: `tls-handshake`, `certificate-chain-of-trust`, `tls-termination`.
   **Techniques**: spotlight, token, path trace, failure, toggle, caption.
   **Review**: Improved — added ECH to the firewall beat (the catalog lists it as a confusable and the focus calls for it), so "plaintext hostname" is shown with its modern exception. Alternative weighed: a hotel front desk asking "which guest?" before handing a key; same idea, less precise than the actual ClientHello field. Checked: SNI is in the ClientHello before certificate selection, Host header is inside the encrypted channel, missing SNI yields default certificate and name mismatch.

### TLS termination, passthrough and re-encryption (`tls-termination`)

**The aha**: Whoever terminates TLS can see and route on the decrypted HTTP and must hold the certificate — passthrough keeps encryption end to end but limits the balancer to blind L4 decisions, and re-encryption buys both at the cost of managing certificates twice.
**Misconception to defeat**: Assuming "it's encrypted" means encrypted for the whole trip, or that any proxy in the path can read HTTP headers for free.
**Cast**: Client, Load balancer, Backend — three lifelines. Three versions of the same middle hop, selected by a toggle: Termination (lock icon opens at the balancer, plain HTTP continues to backend), Passthrough (lock icon stays shut all the way to the backend), Re-encryption (lock opens at the balancer, a new lock closes again before the backend).
**Opening frame**: Client's encrypted request approaching the balancer, mode set to "Termination." Caption: "Three ways to handle the lock at this hop."
**Story**:

1. Termination mode: the lock opens at the balancer; it reads the HTTP path and headers in plain sight, routes by them, and forwards plain HTTP to the backend, so the last hop crosses the private network unencrypted. The backend also no longer sees the client address. Caption: "The balancer sees everything, needs the certificate, and the last hop is plain."
2. Switch to Passthrough: the lock stays shut the whole way; the balancer forwards the encrypted bytes untouched, routing only by IP, port or the SNI name in the ClientHello, blind to any HTTP content. Caption: "Encrypted end to end, but routing sees only L4 info and the SNI."
3. Switch to Re-encryption: the lock opens at the balancer (it reads and routes on HTTP), then a _new_ lock closes before the backend, so the backend also only ever sees an encrypted connection arriving. Caption: "Both: L7 routing, and nothing in the clear on either hop — two certificates to manage."
4. A certificate expires on the balancer in Termination mode: new connections fail right there, the backend never even knows a problem exists. In Re-encryption mode, the _backend's_ certificate can expire independently, failing only the second leg. Caption: "Two separate certificates, two separate ways to break."
   **The moment**: The three-way toggle landing back on Re-encryption, with both locks visible at once — making concrete exactly what's being paid for (two certificates, two handshakes) to get both L7 visibility and end-to-end encryption.
   **Interaction**: Toggle between the three modes on the same request and see what the balancer can route on, and what the backend sees arriving.
   **Ending**: All three modes shown stacked for comparison, same client request, three different internal pictures.
   **Variants**: `sni`, `l4-vs-l7-load-balancing`, `mtls`.
   **Techniques**: toggle, side by side, path trace, restyle, spotlight, caption.
   **Review**: Improved — passthrough is not blind to names (an L4 balancer can route on the SNI), fixed; added the cleartext last hop and lost client IP of termination, the real costs people overlook. Alternative weighed: a customs-checkpoint metaphor (open the box / seal it again); the lock icon is the same idea and ties to the TLS cards. Checked: terminate/passthrough/re-encrypt definitions, each side holds its own certificate when re-encrypting.

### Mutual TLS (mTLS) (`mtls`)

**The aha**: Ordinary TLS answers "is this really the server?"; mTLS also makes the server ask "is this an allowed client?" — at the connection level, before a single request is read, so identity travels with the connection itself rather than with IP addresses.
**Misconception to defeat**: Thinking client identity in mTLS is the same kind of thing as an API key or bearer token.
**Cast**: Client and Server lifelines. Two certificate cards this time: Server's (as in `certificate-chain-of-trust`) and, new, a Client certificate with its own chain to a trusted root. The handshake ladder shows an extra step: "server requests client certificate."
**Opening frame**: Ordinary TLS handshake in progress, server certificate already verified. Caption: "So far: only the server has proven who it is."
**Story**:

1. Server sends an extra message: "CertificateRequest." Caption: "mTLS adds a step: now prove who _you_ are."
2. Client sends its own certificate card up the ladder plus a signature (CertificateVerify) that only the holder of its private key can make; server checks the chain to a root it trusts, as in `pki-chain-of-trust` (Security) but in the other direction. Caption: "Certificate plus proof of the private key. Verified the same way, reversed."
3. Both checks complete before a single HTTP request exists; the connection itself is now labelled "client: payment-service, server: ledger-service" — identity sits on the connection, not on any request field. Caption: "Identity settled at the connection, not per request."
4. A different client with no client certificate, or an expired one, is refused: the server sends a TLS alert and closes (a TLS 1.3 client may only see this on its first read) — no HTTP request, not even a 401, ever gets to run. Caption: "Refused before anything is read — not an app-layer rejection."
5. Contrast inset: a bearer token is copied from a log and replayed from another machine: accepted. A copied client certificate file replayed without its private key: refused. Caption: "A token works for whoever holds it. A certificate needs its private key."
   **The moment**: Beat 4, the rejection happening at the handshake, with no HTTP exchange ever occurring — showing mTLS enforcement sits a full layer below where API keys or bearer tokens are checked.
   **Interaction**: Remove or expire the client certificate and watch the handshake itself fail; compare against a bearer-token flow where the same bad credential fails only after a full connection and request.
   **Ending**: Both certificate chains verified, connection labelled with both identities, ready for requests.
   **Variants**: `pki-chain-of-trust` (Security), `mutual-tls` (Security's take), `tls-handshake`, `tls-termination`, `east-west-vs-north-south`.
   **Techniques**: exchange, token, side by side, failure, spotlight, caption.
   **Review**: Improved — added the proof of key possession (a certificate is public, so presenting it proves nothing alone) and made the token contrast a replay the viewer can watch fail, replacing "checked after the connection is open", which is true but invisible; softened "handshake fails" to the TLS 1.3 reality (alert seen on first read). Borrowed from Security's `mutual-tls`: the one-way TLS opener and the impostor lifeline. Alternative weighed: a two-way ID-badge door; same idea, kept the ladder. Checked: CertificateRequest, client chain validated by server, no HTTP read before refusal.

## 8. Proxies, edge and load balancing

### Reverse proxy (`reverse-proxy`)

**The aha**: Clients think the proxy _is_ the server — it acts on the servers' behalf, and that one position in front of them is where TLS, routing, caching and protection get added without touching the apps themselves.
**Misconception to defeat**: Confusing a reverse proxy with a forward proxy, or picturing it as just a dumb relay.
**Cast**: Client on the left, a reverse proxy box in the middle labelled only with the public hostname, three backend servers behind it (App A, App B, App C) each with a private IP never shown to the client. The client's view literally stops at the proxy's box.
**Opening frame**: Client's request arrow pointed at the proxy's box, backends drawn faded behind it as "not visible from here." Caption: "The client sees one thing. It's actually fronting three."
**Story**:

1. The request arrives at the proxy; it terminates TLS right there (lock opens), and reads the path. Caption: "It acts as the server — handles TLS so the apps don't have to."
2. By path, `/images/*` is routed to App B while `/api/*` goes to App A — the client never chose a backend, the proxy decided. Caption: "Routes by host or path to whichever backend should answer."
3. A repeat request for `/images/logo.png` is served straight from the proxy's own cache, App B never even notified. Caption: "Can answer without bothering the backend at all."
4. App A starts erroring under load; the proxy stops sending it traffic and shifts everything to App C, invisibly to the client. Caption: "Can protect and hide backend trouble."
5. Labels on the proxy box cycle through: "load balancer," "API gateway," "CDN edge," "Kubernetes ingress" — all the same reverse-proxy shape wearing different names. Caption: "Different names. Same position, same job."
   **The moment**: Beat 5, the relabelling — showing that four things people treat as separate technologies are the same mechanism viewed from different angles.
   **Interaction**: Relabel the box and watch its job description change while its position and behaviour stay identical; break a backend and watch traffic reroute.
   **Ending**: The box labelled plainly "reverse proxy," three backends behind it, none visible from the client's side.
   **Variants**: `forward-proxy`, `l4-vs-l7-load-balancing`, `cdn`, `tls-termination`.
   **Techniques**: boundary, spotlight, path trace, restyle, failure, caption.
   **Review**: Keep — the aha (the proxy is the server as far as the client can tell, and that position is where TLS, routing, cache and protection are added) is the catalog's core, and the relabelling beat defeats "dumb relay" by showing four products as one mechanism. Alternative weighed: starting from the forward-proxy mirror image; worse here because `forward-proxy` already ends on that pairing and a first-time viewer needs one shape before its opposite. Checked: TLS termination, path routing, caching, passive health shifting; no number or protocol claim to fault.

### Forward proxy (`forward-proxy`)

**The aha**: A forward proxy acts for the _clients_, a reverse proxy for the _servers_ — the same kind of software, sitting on opposite sides of the conversation, and that single difference in position explains everything else about how each is used.
**Misconception to defeat**: Mixing up which side a forward proxy sits on, or expecting it to work like NAT.
**Cast**: Side by side with `reverse-proxy`'s diagram, mirrored: many clients (laptops in an office, behind a boundary) all configured to send outbound traffic through one forward proxy box, which then reaches out to the open internet. A PAC-file/HTTP_PROXY setting icon sits on each client.
**Opening frame**: Office boundary holding several clients, each with an explicit "proxy: 10.0.0.5:3128" setting, proxy box at the edge, internet beyond. Caption: "Every client points at it on purpose."
**Story**:

1. A client requests `http://news.example.com`; instead of going straight to the internet, the request is sent to the forward proxy first, which then fetches it on the client's behalf. Caption: "The client asks its proxy, not the destination, directly."
2. The proxy checks the URL against a blocklist; a request for a banned site bounces right there, never reaching the internet. The client never resolved the destination name itself: the proxy does. Caption: "Filter before it leaves. The proxy does the lookup."
3. An HTTPS request arrives as `CONNECT news.example.com:443`: the proxy sees the host and port (enough to block by domain) but not the path, then relays encrypted bytes blindly — unless it intercepts TLS with its own certificate, which clients must be told to trust. Caption: "HTTPS: a blind tunnel that still names its destination, unless TLS interception is added."
4. Every one of these clients' requests, whatever their original IP, egresses to the internet carrying the proxy's single IP address. Caption: "One shared face to the outside world."
5. Side by side with `reverse-proxy`'s mirrored diagram: identical box shape, arrows now flowing the opposite direction and purpose. Caption: "Same software shape. Opposite side of the conversation."
6. A client's NO_PROXY setting is misconfigured, routing an internal-only call out through the proxy anyway; the call fails trying to reach an address the proxy can't resolve. Caption: "A classic break: internal traffic that should skip the proxy, doesn't."
   **The moment**: Beat 5, the direct mirror-image comparison with `reverse-proxy` — same shape, reversed direction, which is the cleanest way to stop confusing the two.
   **Interaction**: Toggle TLS interception on/off to see whether the proxy can read inside HTTPS; misconfigure NO_PROXY and watch an internal call fail.
   **Ending**: The mirrored side-by-side of forward and reverse proxy, held together as the ending frame.
   **Variants**: `reverse-proxy`, `nat-gateway`.
   **Techniques**: boundary, path trace, side by side, failure, spotlight, caption.
   **Review**: Improved — beat 3 implied an HTTPS proxy sees nothing; it sees the CONNECT host and port, so domain filtering works without interception but URL-path filtering does not (beat 2 had claimed URL filtering for all traffic). Added that the proxy resolves names. Alternative weighed: a hotel concierge who makes calls for guests; the mirrored reverse-proxy diagram is sharper because it fixes the one thing confused. Checked: HTTP_PROXY/PAC, CONNECT tunnel, shared egress IP, NO_PROXY failure.

### Content delivery network (CDN) (`cdn`)

**The aha**: Moving both content _and_ connection setup physically close to users removes most of the round-trip time and most of the origin's load — what gets cached, and for how long, is entirely set by the origin's own caching headers.
**Misconception to defeat**: Thinking a CDN just "caches files," ignoring that it also moves TLS and TCP setup near the user.
**Cast**: A world map. One origin server, far away (client to origin round trip 200 ms). A ring of edge points of presence (PoPs) scattered around the globe near clusters of client dots. One PoP, zoomed, shows a small cache with entries and TTL rings, and an optional "origin shield" tier behind it.
**Opening frame**: A client in one region, origin in another, a long straight line between them, latency number large. Caption: "Without a CDN: every request crosses the world."
**Story**:

1. A dynamic, uncacheable request is sent through the nearest PoP (reached by anycast or DNS steering). TCP and TLS are set up with the PoP, 20 ms away; the PoP forwards over an already-warm connection to the origin. The latency number falls from about 600 ms (DNS, TCP, TLS and request across the ocean) to about 260 ms, with no caching involved. Caption: "Setup happens next door. The edge keeps the long link warm."
2. The PoP's cache has the asset already (TTL ring still full): answered in about 60 ms (20 ms setup plus one short round trip), origin untouched. The origin counter reads "requests seen: 4 of 10,000". Caption: "A cache hit never leaves the edge."
3. A different PoP, cold cache, misses: it fetches from the origin once (the first request costs about 230 ms) — optionally through an origin-shield tier that merges misses from many PoPs (`origin-shield`) — stores it, and serves the next users at 15 ms with its own TTL ring started. Caption: "A miss goes back once, then it's cached here too."
4. The origin's `Cache-Control: max-age=3600` header is spotlit as the thing deciding that TTL ring's size — change the header, change how long every PoP keeps it. Caption: "The origin sets the rule. Every edge obeys it."
5. Content changes at the origin; a PoP's TTL ring is still mostly full and keeps serving the old version until it's purged or a new versioned URL is used. Caption: "Stale until expiry, purge, or a new URL."
   **The moment**: Beat 1, the latency number collapsing the instant the request target moves from "origin, far away" to "PoP, nearby" — isolated from caching entirely, to show connection proximity alone is half the win.
   **Interaction**: Click or drag a client to any city and read its stopwatch and the origin counter; purge a PoP's cache and watch the next request fall through; a pull/push toggle (push pre-loads every edge so even the first request hits).
   **Ending**: Client dots worldwide, each served by their nearest PoP, origin quiet in the background.
   **Variants**: `reverse-proxy`, `anycast`, `http-caching`, `dns-traffic-routing`, `origin-shield`, `edge-compute`, `static-content-hosting`, `global-load-balancing` (the contrast: it routes users, it doesn't copy content). Platform versions: Azure Front Door, Amazon CloudFront, Cloud CDN.
   **Techniques**: boundary, contents, timer, meter, path trace, toggle, caption.
   **Review**: Improved — kept the networking framing (connection setup moves too, so beat 1 isolates proximity from caching) but added the numbers that make it checkable (600 ms vs 260 ms uncached: 3 round trips of 200 ms plus DNS, against 3 of 20 ms plus one warm 200 ms leg to the origin) and borrowed from Scaling's plan: the origin counter, clickable cities with stopwatches, the pull/push toggle and the cross-links. Alternative weighed: Scaling's cache-hit-only story ("distance is latency"); worse here because it hides the TLS/TCP half. Checked: edge terminates TLS, cache TTL from Cache-Control, purge or versioned URL.

### Anycast (`anycast`)

**The aha**: One IP address, announced from many locations at once through BGP — the internet's own routing simply carries each user's packets to whichever announcing site is closest in network terms, with no DNS change and no TTL to wait for if a site drops out.
**Misconception to defeat**: Confusing anycast with GeoDNS (different IPs for different locations), or thinking one address can only live in one place.
**Cast**: A world map. Three sites, each announcing the _exact same_ IP address (`192.0.2.1`) into BGP, drawn as identical address cards radiating from each site. Client dots in several regions, each with a routed path to whichever site is "nearest" by the BGP path, not geography.
**Opening frame**: Three sites, identical address card at each, three client dots each already connected along a short path to their nearest announcing site. Caption: "Same address. Three places. The network sorts out which one."
**Story**:

1. A client in Europe sends a packet to `192.0.2.1`; BGP's path selection, done purely on routing distance, delivers it to the site with the best BGP path, usually the nearest, though BGP chooses by policy and path length, not milliseconds. Caption: "The network picks the nearest announcer — no lookup involved."
2. A client in Asia sends to the _same_ address; it lands at the Asian site instead, automatically. Caption: "Same destination address, different physical place, depending on who's asking."
3. Contrast inset: GeoDNS, where a _name_ resolves to _different IP addresses_ depending on location — spotlighted side by side against anycast's one address, many locations. Caption: "GeoDNS: different addresses. Anycast: same address, everywhere."
4. The European site fails and withdraws its BGP announcement (the address card vanishes there). Once routers converge (seconds to a minute), the European client's packets arrive at the next-nearest site, with no DNS change and no TTL involved. A TCP connection that was mid-flight resets; the client reconnects. Caption: "Withdraw the route and traffic moves. No TTL, but not instant."
   **The moment**: Beat 4, the rerouting with zero DNS or TTL involvement at all, directly contrasted against `dns-traffic-routing`'s TTL-bound failover — the clean way to show what makes anycast different.
   **Interaction**: Fail any one of the three sites and watch its traffic silently redistribute to the others; toggle the GeoDNS inset to compare mechanisms side by side.
   **Ending**: Two sites still announcing, all client traffic landing correctly, no DNS entry anywhere having changed.
   **Variants**: `dns-traffic-routing`, `bgp`, `cdn`.
   **Techniques**: path trace, failure, side by side, spotlight, caption.
   **Review**: Improved — "traffic shifts immediately" overstated BGP convergence (seconds to a minute) and "nearest" ignored that BGP picks by policy and path, not latency; added that open TCP connections reset on a route change, the known cost. Alternative weighed: a hotline number that rings the nearest office; same idea, the map with identical address cards is clearer. Checked: same prefix announced from many sites, contrast with GeoDNS, withdrawal needs no DNS change.

### L4 vs L7 load balancing (`l4-vs-l7-load-balancing`)

**The aha**: An L4 balancer forwards connections by IP and port alone, blind to the payload; an L7 balancer terminates the connection and reads each HTTP request, routing per-request at the cost of doing far more work — and long-lived connections behind an L4 balancer stick to one backend for life.
**Misconception to defeat**: Thinking "load balancing" is one algorithm, or that L7's extra routing power is free.
**Cast**: Same client, same three backends, two side-by-side balancer boxes: "L4" (a simple switchboard reading only IP:port) and "L7" (a box that opens each envelope, reads path/headers, then reseals and forwards). Several requests from the same client connection shown as a stream.
**Opening frame**: Both balancers idle, three backends behind each, client about to send a sequence of requests over one connection. Caption: "Same traffic. Two different depths of look."
**Story**:

1. L4 side: the connection's 5-tuple is hashed once to backend B; every request on this connection, whatever its content, rides to B for the connection's entire life. Caption: "L4 decides per connection — and never looks inside it."
2. L7 side: the connection terminates at the balancer; each request is opened, read, and routed individually — request 1 to `/cart` goes to A, request 2 to `/checkout` on the _same client connection_ goes to C. Caption: "L7 decides per request — because it can actually read them."
3. A long-lived gRPC connection (HTTP/2 with many calls) is placed on the L4 side: it pins to one backend for its whole life. On the L7 side, each call is a separate stream the balancer can spread across backends. A WebSocket is the exception: after the upgrade it is one pipe, pinned on either side (`websockets`). Caption: "Long-lived connections expose the trade plainly."
4. A CPU meter appears over each balancer: L4's barely moves (it never parses payload); L7's climbs visibly, because terminating TLS and parsing HTTP on every request costs real work. Caption: "L7's power costs CPU. L4's speed costs blindness."
5. The client's real IP: a pass-through L4 balancer forwards the packet unchanged, so it arrives intact; an L7 balancer (or an L4 one that proxies the connection) shows the backend its own IP unless `X-Forwarded-For` or the PROXY protocol is used. Caption: "Terminating a connection also means replacing the source IP."
   **The moment**: Beat 2 against beat 1, the exact same client connection — pinned to one backend on L4, split across backends per request on L7 — the cleanest possible demonstration of what "L4" and "L7" actually mean in practice.
   **Interaction**: Send the same multi-request client connection through each balancer and watch where each request lands; toggle the CPU meters to compare cost.
   **Ending**: Both balancers side by side, L4's single pinned arrow beside L7's fanned-out arrows to all three backends.
   **Variants**: `reverse-proxy`, `websockets`, `rest-graphql-grpc`, `client-ip-preservation`, `tls-termination`.
   **Techniques**: side by side, path trace, spotlight, meter, caption.
   **Review**: Improved — beat 3 implied L7 redistributes WebSocket traffic (an upgraded WebSocket is one pinned pipe either way; HTTP/2 gRPC calls can be spread); beat 5 assumed all L4 keeps the client IP, true only for pass-through, not proxy-mode L4. Alternative weighed: a mail sorter that reads the address vs one that reads the letter; the same connection through both is sharper. Checked: per-connection vs per-request routing, TLS termination cost at L7.

### Preserving the client IP behind proxies (`client-ip-preservation`)

**The aha**: Any hop that terminates a connection replaces the source IP with its own — so logs, rate limits and IP allow-lists downstream must read a forwarded header instead, and should only trust it when their own proxy is the one that set it.
**Misconception to defeat**: Expecting the backend to see the real client IP automatically, or trusting a forwarded header from just anyone.
**Cast**: Client (`198.51.100.7`) → L7 proxy (terminates, new IP `10.0.0.5`) → Backend. A packet's source-IP field is spotlit at each hop. A header row `X-Forwarded-For: 198.51.100.7` rides inside the request itself, separate from the packet's own source field.
**Opening frame**: Client's packet, source IP `198.51.100.7`, approaching the proxy. Caption: "The real client address, so far."
**Story**:

1. The proxy terminates the connection and opens a _new_ one to the backend; the packet's source-IP field now reads the proxy's own address, `10.0.0.5` — the original is gone from the packet itself. Caption: "Terminate a connection, and the packet's source IP is simply overwritten."
2. The proxy writes the original address into an `X-Forwarded-For` header of the request instead. Caption: "The real address survives — but only as data inside the message now."
3. The backend's rate limiter, naively reading the packet's source IP, sees only `10.0.0.5` for every single client and rate-limits everyone together as if they were one caller. Caption: "Read the wrong field, and every client looks identical."
4. Fix: the rate limiter reads `X-Forwarded-For` instead (or the standard `Forwarded` header) — correctly separates clients again. Caption: "Read the header the proxy actually set."
5. An attacker sends a request through the proxy with their own `X-Forwarded-For: 10.0.0.1`. The proxy appends the real address after it (`10.0.0.1, 203.0.113.9`). A backend that takes the first, leftmost entry believes the forgery; the entry its own proxy appended (the right end) is the one to trust. A direct request that bypasses the proxy shows the same flaw. Caption: "Clients can write that header too. Trust only what your own proxy added."
6. Contrast inset: at L4, the PROXY protocol carries the original address alongside the connection itself, outside the payload, without needing the backend to parse headers at all. Caption: "L4's alternative: a small preamble, not a header."
   **The moment**: Beat 5, the forged header sailing through purely because the backend trusted it unconditionally — the realistic failure mode, not an abstract warning.
   **Interaction**: Toggle which field the rate limiter reads (packet source vs forwarded header) and watch clients merge or separate; send a forged header directly, bypassing the proxy, and watch it succeed until the backend is told which hop to trust.
   **Ending**: Backend correctly reading the proxy-set header, forged direct attempts rejected because the proxy's hop is the only one it trusts.
   **Variants**: `nat`, `l4-vs-l7-load-balancing`, `reverse-proxy`.
   **Techniques**: token, spotlight, restyle, failure, side by side, caption.
   **Review**: Improved — XFF is a header, not "the request body"; the forgery beat now covers the more common case (a client-supplied value passing through the proxy, where taking the leftmost entry is the bug) as well as the bypass case, with the rule: trust the entry your own proxy appended. Alternative weighed: a postmark analogy; the field-by-field packet view is more exact. Checked: XFF appends, Forwarded (RFC 7239), PROXY protocol at L4.

### Service discovery (`service-discovery`)

**The aha**: In dynamic environments, IP addresses are disposable — services call a stable name, and something resolves it to whichever instances are currently healthy at call time, not whenever it was last looked up.
**Misconception to defeat**: Thinking a service's address is fixed, or that service discovery is just DNS with extra steps.
**Cast**: A registry box in the middle holding a live table: service name → list of instance addresses, each with a health-check pulse. Several instance boxes around it, appearing and disappearing (scaling, deploys, crashes). A caller on the left asking for "orders-service."
**Opening frame**: Registry table with three healthy instances listed under "orders-service," each pulsing green. Caption: "A name, backed by a live, changing list."
**Story**:

1. A new instance starts, registers itself, passes its first health check, and appears in the table. Caption: "New instance: added once it's actually healthy."
2. The caller asks for "orders-service" (client-side discovery): queries the registry directly, gets the current list, picks one. Caption: "Ask the registry yourself, then choose."
3. Contrast: the caller instead goes through a load balancer or DNS name in front, which consults the registry on its behalf (server-side discovery). Caption: "Or let something in front do the asking for you."
4. An instance crashes without deregistering. Its health check fails three times in a row (a visible countdown, say 3 x 5 s), then the registry removes it; a few calls in that window fail and are retried on survivors. Caption: "Health checks keep the list honest, after a few missed beats."
5. Contrast inset: a DNS-based version of the same idea. The same health countdown runs first, then the removal must still drain through the caller's cached answer, a second TTL ring (30 s). Caption: "DNS-based discovery is simple, but adds TTL staleness on top of the health delay."
   **The moment**: Beat 5 against beat 4: two timers stacked (health check, then TTL) against one, showing the real cost of choosing DNS as the discovery mechanism.
   **Interaction**: Kill an instance and compare when a registry-based caller versus a DNS-based caller stops sending it traffic; dial the health interval and the TTL.
   **Ending**: Registry table showing only healthy instances, the dead one's entry gone.
   **Variants**: `dns-resolution`, `dns-ttl-and-caching`, `l4-vs-l7-load-balancing`.
   **Techniques**: contents, token, timer, failure, side by side, caption.
   **Review**: Improved — "removed before the caller's next request" promised an impossible zero-delay; a crash is only noticed after the health-check interval times its failure threshold. The honest contrast is one timer (registry) against two stacked timers (health, then DNS TTL). Alternative weighed: a phone-book vs switchboard-operator metaphor; the live table with pulses is more faithful. Checked: client-side vs server-side discovery, health-driven registration, DNS caching staleness.

### East-west vs north-south traffic (`east-west-vs-north-south`)

**The aha**: North-south traffic crosses your environment's edge; east-west flows between services inside it — and in a microservice system, most traffic is east-west, invisible to any perimeter firewall or edge load balancer that only watches the edge.
**Misconception to defeat**: Assuming a strong edge/perimeter defence covers all the traffic that matters.
**Cast**: A boundary drawn around a cluster of services. North-south arrows cross the boundary's top edge (users from the internet, going in and out) through a visible edge load balancer. East-west arrows run sideways between services _inside_ the boundary, with no device drawn in their path at all.
**Opening frame**: The boundary, an edge load balancer sitting squarely on its top edge, a few internal services scattered inside with no visible gatekeeper between them. Caption: "One edge, watched closely. An interior, not watched at all."
**Story**:

1. A user's request crosses north-south, through the edge load balancer, which inspects, routes and logs it. Caption: "Everything crossing the edge passes through here."
2. That request, once inside, triggers service A calling service B, which calls service C — all east-west, all inside the boundary, none of these arrows touching the edge load balancer at all. Caption: "Most of the actual work never crosses the edge again."
3. A traffic meter totals north-south versus east-west volume over a minute: east-west dwarfs north-south, often by many times over. Caption: "In a microservice system, most traffic is east-west."
4. Service B is compromised; it calls service C directly, sideways, with nothing in its path to stop or even notice it — the edge load balancer, still watching only the top boundary, sees nothing. Caption: "The edge never sees this at all."
5. Internal rules are added: a segment rule allows only A to reach C, and a sidecar on each service enforces mTLS identity and policy on every east-west arrow. B's call to C is now refused. Caption: "Segmentation and meshes exist to police the traffic the edge can't see. mTLS proves who; policy decides who may."
   **The moment**: Beat 4, the compromised service's lateral call sailing past completely unwatched while the edge load balancer, elsewhere in the frame, keeps calmly inspecting unrelated north-south traffic — showing exactly what a perimeter-only defence misses.
   **Interaction**: Toggle the internal segment rule and the sidecar mTLS separately on the internal services, and watch whether the lateral call from the compromised service sails through, is identified but still allowed, or is refused.
   **Ending**: Every east-west arrow passing through a checkpoint, B's lateral call refused, the edge load balancer still watching only its own boundary.
   **Variants**: `l4-vs-l7-load-balancing`, `network-segmentation`, `mtls`.
   **Techniques**: boundary, path trace, meter, failure, toggle, caption.
   **Review**: Improved — the fix jumped straight to a mesh, implying mTLS alone stops the compromised service, which it would only identify; added the segmentation rule and allow-policy so the refusal is earned, and the interaction separates the two layers. Alternative weighed: a building with a guarded front door and unlocked interior rooms; the boundary diagram says the same and keeps the area's visual language. Checked: definitions of north-south and east-west, east-west volume dominating in microservice systems (commonly reported, not a fixed ratio).
