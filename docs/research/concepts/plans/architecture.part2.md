# Architecture plans, part 2

Stage 2 plans for `catalog/architecture.md` groups 5 to 10, in catalog order, reviewed in stage 3.
They use the area's shared visual language (continued from part 1): services are rounded boxes,
each with a small database cylinder attached when it owns its data; a monolith is one large box
whose internal modules are tiles; teams are small groups of figures in a colour matching the parts
they own; requests are dots travelling along arrows; domain boundaries are softly coloured
regions; an API gateway is a gate at the edge, clients on the left, services behind it on the
right; a sidecar is a small box clipped to the side of its service; change over time (migration,
growth) uses a timeline strip along the bottom; tenants are colour-coded figures whose data and
requests carry their colour. Review adds one convention for the whole area: every plan shows
its **cost** in a fixed place (a small red "price tag" meter or card at the lower right), because
architecture is trade-offs and a benefit shown without its price is advertising.

`service-discovery` falls in this share's Integration and edge group but is owned by Networking,
so it is skipped here (noted again at the end of the first group).

No new technique was needed beyond the vocabulary in the README (including `split / merge` and
`scrub`, introduced in `plans/data.part1.md` and reused here).

## Integration and edge

### API gateway (`api-gateway`)

**The aha**: Clients see one stable address and API while the services behind it stay free to split, move and change; a gateway does more than spread load across copies of one thing — it routes between different services and owns cross-cutting concerns like auth and rate limiting.
**Misconception to defeat**: "It's just a load balancer in front of the services."
**Cast**: Left, three client icons (web, mobile, partner). Centre, a gate spanning the full height with lanes labelled "auth", "rate limit", "TLS". Right, five service boxes (some with db cylinders) in a region behind the gate. Lower right, the price tag meter: "+1 hop".
**Opening frame**: Clients left, the gate with its three lanes, five different services behind it.
**Story**:

1. A request dot passes through the auth lane (turns green), then the rate-limit lane (a meter ticks), and arrives at Orders. _"One address, many services."_
2. Side by side: a plain load balancer sends identical copies of ONE service (same box, three clones); the gateway routes by path to DIFFERENT services. _"Not the same job."_
3. Orders clones into Orders-v1 and Orders-v2 behind the gate; the gate reroutes requests with no change visible to clients. _"Services move; the address doesn't."_
4. The price: a latency tick for the extra hop, and the gate shown as a single box all traffic needs; it duplicates into three instances behind a load balancer. _"One more hop, and it must never be the single point of failure."_
5. A "pricing rules" tile creeps into the gate; the gate swells and reddens, labelled "the gate becomes a new monolith." _"Keep business logic out of it."_
   **The moment**: Beat 3 — the reroute behind the gate, invisible from the client side.
   **Interaction**: Drag a backend service to a new position behind the gate; the client's request still lands correctly.
   **Ending**: The gate stands lean, clean lanes only, three instances; the pricing tile is removed.
   **Variants**: `gateway-routing`, `gateway-aggregation`, `gateway-offloading`, `backends-for-frontends`; `service-mesh` as the inside-the-system counterpart.
   **Techniques**: boundary, token, side by side, restyle, move, meter, clone, caption.
   **Review**: Improved — removed the "shut gate with padlock" opening (it read as "blocked"); added the cost beat (extra hop, single point of failure, so run it redundant) since the original showed only benefits; the load-balancer contrast now uses clones vs different boxes so the misconception is visibly defeated.

### Gateway routing (`gateway-routing`)

**The aha**: A gateway maps one public path, host or header to the right backend service, so routing changes by editing a table, without touching any client.
**Misconception to defeat**: That this is load balancing — spreading load across copies of one service, rather than choosing between different services.
**Cast**: A gate holding a visible routing table (path → service): `/orders → Orders`, `/users → Users`, `/cart → Cart`. Clients to the left.
**Opening frame**: The table with three rows, each a line into a different service box.
**Story**:

1. A request to `/orders` is traced straight to the Orders box. _"The path picks the service."_
2. A new row is added, `/cart → Cart-v2` (a clone of Cart); the old row is struck through; cart traffic shifts over. _"Change the table, not the client."_
3. Header-based variant: the same path `/checkout`, but a `beta: true` header routes to Checkout-canary; shown side by side with the plain request's route. _"Same URL, different route."_
4. Contrast: a load balancer sends one path to three identical copies of Orders in round robin; this gateway sends different paths to different services. Price tag: a wrong row misroutes every client at once. _"Routing is now configuration; test it like code."_
   **The moment**: Beat 2 — the swap happens by editing the table alone, traced live as traffic moves.
   **Interaction**: Edit the routing table's `/cart` row and watch requests reroute to the new version; point it at a nonexistent service and watch every cart request fail, which teaches the table is critical config.
   **Ending**: The table rests on its updated row, traffic flowing to Cart-v2.
   **Variants**: `api-gateway`, `gateway-aggregation`; delivery's canary and ring deployment reuse this routing.
   **Techniques**: path trace, token, side by side, restyle, caption.
   **Review**: Improved — added the cost (a bad row misroutes everyone, so the table is production config) and a failing interaction; weighed starting with the load-balancer contrast, but the table edit is the more distinctive first image, and the contrast is kept in beat 4. Facts checked: path/host/header routing is standard L7 gateway behaviour.

### Gateway aggregation (`gateway-aggregation`)

**The aha**: One client request fans out to several services inside the datacentre and comes back as a single combined response, trading many slow round trips over a bad network for one.
**Misconception to defeat**: That this is the same as the client calling each service directly.
**Cast**: A mobile client far left, joined to the gate by a long thin "slow" pipe (100 ms per round trip). The gate, then three services (Product, Price, Reviews) right, each reached by short fast pipes (5 ms).
**Opening frame**: One long slow pipe from the mobile client to the gate, three short fast pipes from the gate onward.
**Story**:

1. Without aggregation: the client makes three separate calls over the slow pipe; a timer climbs with each round trip to about 300 ms. _"Three slow round trips."_
2. Side by side, with aggregation: one call over the slow pipe; the gate fans three tokens out over the fast pipes in parallel; the timer reads about 110 ms (100 slow plus the slowest 5 to 10 ms inside, not their sum). _"One slow trip; the fast ones run in parallel."_
3. Zoom into the gate: three response cards merge into one JSON card before the single trip back.
4. The price: Reviews hangs; the gate waits on its slowest member, so the whole response stalls. The gate answers after a timeout with Reviews missing, marked "partial". _"The aggregate is only as fast as its slowest part; decide what a partial answer looks like."_
   **The moment**: The side-by-side timers — three long trips against one.
   **Interaction**: A dial for "round-trip latency" grows the gap between the two timers as it rises; a switch makes Reviews slow and shows the timeout and partial response.
   **Ending**: The merged response card travels back alone over the slow pipe.
   **Variants**: `api-composition` (the same idea for data reads inside the backend); `backends-for-frontends`.
   **Techniques**: side by side, token, stream, timer, zoom, dial, failure, caption.
   **Review**: Improved — put real numbers on the timers (they now add up: 3 x 100 vs 100 + max(5..10)); added the slowest-member / partial-response cost that the original omitted. Weighed framing it as "chatty client vs chunky call"; the timers already say that more directly.

### Gateway offloading (`gateway-offloading`)

**The aha**: Shared cross-cutting work — TLS, auth, rate limiting, compression — moves out of every service's own code and into the gate once, done the same way for every language.
**Misconception to defeat**: That a sidecar does this; a sidecar is per instance, offloading is centralised at the edge.
**Cast**: Before: three services, each carrying its own cross-cutting tile, subtly different (one is missing rate limiting). After: a gate with one tile, services left plain. A second "internal" arrow from service to service.
**Opening frame**: Three services, three slightly mismatched tiles baked in.
**Story**:

1. Spotlight each tile: all slightly different, one missing a check entirely. _"Every service re-implements it, a little differently."_
2. The tiles lift off each service and merge into a single tile on the gate; requests now pass the one tile before reaching the plain services. _"Done once, at the gate."_
3. The price: Orders calls Users directly from inside, skipping the gate; no auth tile on that path, the call goes through unchecked (red). _"Offloading protects only traffic that goes through the gate."_
4. Inset: the sidecar alternative, a box clipped to each service, labelled "sidecar: per instance. This: once, at the edge." It covers the internal call too, at the price of one box per instance.
   **The moment**: Beat 2, the tiles lifting and merging into one.
   **Interaction**: Toggle before/after to compare duplicated against centralised concerns; add an internal call and see whether it is covered.
   **Ending**: The gate holds one consistent tile; the services are simpler; the internal gap is marked as the thing a mesh closes.
   **Variants**: `api-gateway`; `sidecar-pattern` as the per-instance approach, `service-mesh` for internal traffic.
   **Techniques**: move, restyle, spotlight, side by side, toggle, failure, caption.
   **Review**: Improved — added the real limit (internal calls bypass the gate, so zero-trust still needs service-level checks or a mesh); that also defeats the sidecar misconception with something concrete rather than a bare inset.

### Backends for frontends (`backends-for-frontends`)

**The aha**: Give each kind of client its own backend, shaped to exactly what it needs, instead of forcing every client through one general-purpose API.
**Misconception to defeat**: That one general-purpose API (or one shared gateway with one response shape) can serve every client well.
**Cast**: Three clients — Web, Mobile, Partner — each a distinct colour. Before: all three hit one generic API box. After: three BFF boxes, each colour-matched to its client, all calling the same underlying services. Price tag: "3 things to build and run".
**Opening frame**: All three clients wired into one generic API box.
**Story**:

1. Mobile's response is a huge JSON blob with most fields dimmed, unused. _"One API, the wrong shape for everyone."_
2. The generic API splits (clone, then restyle) into Web-BFF, Mobile-BFF and Partner-BFF, each coloured like its client.
3. Each BFF calls the same services (Orders, Users) but shapes the answer differently — Mobile-BFF returns a tiny card, Web-BFF a richer one. _"Each client gets its own shape."_
4. The price: the same "totals calculation" tile now appears in all three BFFs, one slightly different (red). _"Shared logic drifts. Push it down into a service, not into the BFFs."_
5. Each BFF sits inside a region coloured like its client's team: the team that builds the frontend also owns its BFF.
   **The moment**: Beat 1 against beat 3 — the bloated one-size response next to the trim, client-shaped one.
   **Interaction**: Toggle between clients and watch each one's tailored response shape.
   **Ending**: Three colour-matched BFFs, each thin, each owned by its frontend team.
   **Variants**: `api-gateway` (often sits in front of the BFFs), `micro-frontends`, `gateway-aggregation`.
   **Techniques**: split / merge, restyle, clone, boundary, toggle, spotlight, caption.
   **Review**: Improved — the old misconception ("confusing it with a gateway") was never defeated on screen and isn't the real error; replaced with the true wrong picture, one API for all, and added the duplication cost with a visible drifting tile. Weighed a pure before/after; the cost beat is what makes it honest.

### Gatekeeper (`gatekeeper-pattern`)

**The aha**: A thin, hardened host at the edge validates and sanitizes every request but holds no secrets or direct data access itself; only the trusted back end behind it can reach the real data, so a breach of the exposed part gets an attacker nothing.
**Misconception to defeat**: Confusing it with gateway offloading or a web application firewall — the point here is separating exposure from privilege.
**Cast**: An internet client left. A plain Gatekeeper box at the edge, no key icon. A Trusted back end with a key icon and a db cylinder, inside a shaded trust boundary reachable only from the Gatekeeper over an internal channel.
**Opening frame**: Gatekeeper outside the boundary; back end and data inside.
**Story**:

1. A malicious request hits the Gatekeeper; it validates, strips a bad field, and forwards only the cleaned request. _"Validate, sanitize, forward only what's safe."_
2. The Gatekeeper is compromised (red flash, flips to "owned"). It holds no keys; it reaches for the boundary and bounces off, since only the back end has credentials. _"Even owned, it has nothing to steal."_
3. Contrast: a design with validation inside the back end that also faces the internet. Compromise it and the red flash spreads straight to the cylinder. _"Exposed and privileged: that's the mistake."_
4. The price: a latency tick for the extra hop, and one more component to run and keep patched; a tiny caption, "limits the damage, doesn't stop the attack".
   **The moment**: Beat 2 — a breached Gatekeeper, empty-handed, next to the data it can never touch.
   **Interaction**: Toggle "compromise the Gatekeeper" against "compromise the back end directly" and see which one loses data.
   **Ending**: Gatekeeper breached but harmless; the trust boundary intact.
   **Variants**: `valet-key`; security's WAF and access tokens sit beside it.
   **Techniques**: boundary, failure, token, toggle, side by side, spotlight, caption.
   **Review**: Improved — "forwards a clean token" was ambiguous (tokens mean credentials elsewhere); now forwards a cleaned request. Added the honest limit and cost, since the pattern reduces blast radius rather than preventing attack. Facts checked against the Azure pattern: the gatekeeper has no access to credentials or keys; the trusted host does.

### API styles: REST, gRPC, GraphQL (`api-styles`)

**The aha**: The three differ in who shapes the response and what the network sees: REST is many cacheable URLs anyone can call, GraphQL is one endpoint shaped by the client's query, gRPC is typed binary calls on one long-lived HTTP/2 connection. Choose by who is calling, because each buys something with a price.
**Misconception to defeat**: Treating them as interchangeable syntaxes for the same thing, or gRPC as "just HTTP/2".
**Cast**: Three columns, one task: fetch a user and their last 3 orders. REST: three GETs to three URLs, each a full JSON card with some fields dimmed. GraphQL: one POST to `/graphql` carrying a query naming the fields. gRPC: one typed `GetUserWithOrders(42)` call, a compact binary token, a `.proto` contract pinned beside it, on one open HTTP/2 connection. Under each, a price tag. (Merged with Networking's `rest-graphql-grpc`, whose same-task framing and gRPC pinning beat are used here.)
**Opening frame**: Three columns at rest, same data need, three different shapes of request already visible. _"Same question. Three conversations."_
**Story**:

1. REST: three round trips, `/users/42`, `/users/42/orders`, `/orders/99/items`; each response stamped "cacheable" because the URL is the cache key. _"Resources by URL. Any cache on the path can help."_ Price: more round trips and unused fields.
2. GraphQL: one POST, exactly `{name, orders(last:3){id,total}}`; the card comes back trimmed beside REST's fat one. Price: it's a POST to one URL, so shared HTTP caches see nothing to cache, and a deep query can be expensive for the server. _"The client decides the shape; the cache can't see it."_
3. gRPC: a small binary frame on one open connection, typed from the `.proto`. Put an L4 load balancer in front: REST's connections spread across backends, gRPC's one long-lived connection pins every call to one backend. A browser tries it directly and needs a gRPC-Web translator. _"Fast and typed between services; harder at the edge."_
4. A scoreboard: round trips, payload size, cacheable, browser-friendly, who it's for. Public partners point at REST; varied mobile and web clients at GraphQL; internal service-to-service at gRPC.
   **The moment**: Beat 2 — GraphQL's trimmed card beside REST's full one for the same data, with the cache icon crossed out only on GraphQL.
   **Interaction**: Pick the consumer (public partner, mobile app, internal service) and watch the scoreboard highlight the best fit and its price; add or remove fields in the GraphQL query and watch the card resize.
   **Ending**: The scoreboard with every style's gain and cost visible side by side.
   **Variants**: `api-gateway` (where these meet clients; a gateway can translate between them), `api-versioning`, `gateway-aggregation`.
   **Techniques**: side by side, token, meter, path trace, contents, dial, choice, caption.
   **Review**: Rethought — the original listed only strengths and claimed "microseconds", which is not a property of the style. Rebuilt on Networking's same-task framing (three GETs vs one query vs one typed call), with each style's price (caching, query cost, pinned connection, browser support) and a choose-by-consumer interaction. Facts checked: gRPC runs over HTTP/2 with protobuf; GraphQL is normally a single POST endpoint; L4 balancing pins a long-lived HTTP/2 connection; browsers need gRPC-Web.

### API versioning and compatibility (`api-versioning`)

**The aha**: Independently deployed services can't upgrade every caller at once, so changes should be additive by default, and a breaking change runs old and new side by side until callers have moved.
**Misconception to defeat**: Confusing this with the deployable's own semver, or assuming any new field breaks old clients (or that no change can).
**Cast**: One Orders API with v1 and v2 live (shown as `/v1/orders`, `/v2/orders`; header or media-type versioning would be the same picture with a different tag). Three callers: Client-A (tolerant reader), Client-B (on v2), Client-C (strict parser that rejects unknown fields).
**Opening frame**: Both versions live into the same service, clients unaware of each other.
**Story**:

1. A `discount` field is added to the response: tolerant Client-A ignores it and keeps working; strict Client-C breaks on the unknown field (red). _"Additive is usually safe, if callers ignore what they don't know."_
2. A breaking change: `total` is renamed `amount`. Added fields can ride along; a rename can't, so v2 ships beside v1, and a translation layer keeps both served from one service. _"Break it, and you need a second version."_
3. A timeline strip: v1's traffic meter shrinks as callers migrate, a deprecation notice with a sunset date on it; v1 stays until the meter reads zero or the date passes and stragglers break (red). _"Run both; the old one fades, it isn't pulled."_
4. The price: two versions to test, secure and support for the whole overlap period.
   **The moment**: Beat 3 — v1 isn't pulled; it visibly shrinks to zero on the timeline before it disappears.
   **Interaction**: Drag Client-A from v1 to v2 and watch v1's usage meter drop; try removing v1 early and watch the clients still on it break.
   **Ending**: The v1 line fades to nothing; only v2 remains, serving everyone.
   **Variants**: Messaging's `event-schema-evolution`; delivery's `expand-contract-migration`; `api-styles`.
   **Techniques**: lanes, token, timer, meter, side by side, failure, caption.
   **Review**: Improved — beat 2 was incoherent ("tolerant reader ignores a field removed from v1"); a tolerant reader ignores added unknown fields, and removing or renaming is what breaks. Now shows an additive change harming a strict client, a true breaking change, and a sunset date beside "zero usage" (real public APIs rarely wait for zero). Added the two-versions cost.

### Synchronous call chains (`synchronous-call-chain`)

**The aha**: When a request passes through several services in sequence, their latencies add and their availabilities multiply down, so one slow or down link stalls or breaks the whole chain.
**Misconception to defeat**: Believing retries in a mesh fix a long chain; they hide the coupling, and can multiply the load on the failing link.
**Cast**: A request dot travelling through five chained services (A→B→C→D→E), each tagged with a latency (50 ms) and an availability (99.9%).
**Opening frame**: The dot at A, the chain of five laid out, each tagged 99.9% / 50 ms.
**Story**:

1. The dot travels the chain; a running latency meter at the top climbs to 250 ms. _"Latencies add."_
2. The five availabilities multiply live into a shrinking bar: 0.999 to the fifth is about 99.5%, shown as about 3.6 hours of downtime a month against 43 minutes for one service. _"Availabilities multiply down."_
3. D turns slow (hatched, yellow); the whole chain's response balloons even though A, B, C and E are fine, and callers upstream hold open connections waiting. _"One slow link stalls everyone behind it."_
4. D fails; every hop retries 3 times, so D receives 3 x 3 x 3 = 27 attempts from one user request. The retry meter spikes and D, now overloaded, stays down. _"Retries at every level multiply the load; they don't remove the dependency."_
5. Inset: D called asynchronously through a queue; the chain's response no longer waits on it.
   **The moment**: Beat 3 — a single slow hop visibly dragging down an otherwise healthy chain, then beat 4's retries piling on top.
   **Interaction**: Drag any one service's latency slider and watch the total latency and the availability bar respond live; toggle retries per hop and watch the load on D.
   **Ending**: The availability bar settles near 99.5%, well below any single service's own number.
   **Variants**: Reliability's `composite-availability`; messaging's async alternatives (`async-request-reply`, `webhooks`); `distributed-monolith`.
   **Techniques**: token, path trace, meter, chart, failure, dial, caption.
   **Review**: Improved — the retry misconception was named but never shown; beat 4 now shows retries multiplying load at the failing link (per-hop retry counts multiply down a chain). Numbers checked: 0.999^5 = 0.99501; five serial 50 ms hops = 250 ms. Added the caveat that multiplying assumes independent failures and every hop required.

### Service mesh (`service-mesh`)

**The aha**: A layer of proxies beside every service handles service-to-service traffic — mTLS, retries, timeouts, traffic splitting, telemetry — consistently, moved out of each service's code and into the platform, at the price of more moving parts and extra latency.
**Misconception to defeat**: Confusing it with an API gateway (a gate at the edge where outside traffic enters) or with a NetworkPolicy (packets only, L3/L4).
**Cast**: Four services in a region, each with a small proxy box clipped to its side (the data plane); a control plane box above, connected to every proxy by dashed config lines. Price tag: a latency meter and a "proxies to run" count. (Merged with Containers' `k8s-service-mesh`; its mTLS-bounce, NetworkPolicy contrast and latency-cost beats are borrowed.)
**Opening frame**: Four services with their proxies; the control plane dimly connected to all four.
**Story**:

1. Service A calls Service B: the call goes A's proxy → B's proxy → B, a padlock on the hop; a plaintext call from a rogue pod bounces off B's proxy. _"Every hop goes proxy to proxy, encrypted, with identity."_
2. The control plane pushes a rule ("90% to B-v1, 10% to B-v2, retry on 503, timeout 2 s") down the dashed lines to every proxy at once; traffic splits accordingly. _"One change, applied everywhere."_
3. B-v2 returns a 503; A's proxy retries once and the retry lands on a healthy instance; A's code never knows. _"Resilience lives in the proxy."_
4. The price: a latency meter ticks up for the two extra proxy hops. The control plane goes dark; existing proxies keep routing with the last rules they received, but no new rule can be pushed. _"Data plane carries traffic; control plane only configures it."_
5. Inset: three layers side by side: NetworkPolicy sees packets (L3/L4); the mesh sees calls between services (east-west); the gateway sits at the edge (north-south).
   **The moment**: Beat 2 — one push fanning out identically to every proxy at once; beat 4's dark control plane with traffic still flowing is the memorable proof of the split.
   **Interaction**: Push a new traffic-split rule from the control plane and watch the stream ratio shift across all proxies; switch off the control plane and see traffic keep flowing.
   **Ending**: Steady state, every hop proxy-to-proxy, padlocked, telemetry pulsing on each proxy, latency cost ticking beside it.
   **Variants**: `sidecar-pattern`, `ambassador-pattern`; reliability's `retry-backoff-jitter`, `circuit-breaker`; containers' `k8s-mesh-sidecar-vs-ambient` (ambient mode shares a proxy per node instead of one per pod).
   **Techniques**: boundary, exchange, token, stream, restyle, failure, meter, side by side, caption.
   **Review**: Improved — beat 3 had a retry "rerouting to B-v1", which a retry doesn't decide (the split rule does); now a retry to a healthy instance. Added the cost beat (latency, proxies to run) and the control-plane-down beat to make data plane vs control plane visible, and borrowed the rogue-pod mTLS bounce and NetworkPolicy contrast from `k8s-service-mesh`. Weighed leading with the gateway contrast; the three-layer inset is clearer than a two-way one.

### Sidecar (`sidecar-pattern`)

**The aha**: A helper process deployed next to each service instance, sharing its host and deployment lifecycle, adds a capability — logging, proxying, config — without touching or recompiling the app, whatever language it's written in.
**Misconception to defeat**: Confusing it with a separate shared service; a sidecar is per instance, scheduled, scaled and removed with its app.
**Cast**: Three service+sidecar pairs in different languages (Java, Python, Go tags), each pair inside one dashed boundary labelled "one pod / one deployable unit", each sidecar doing the same job.
**Opening frame**: Three pairs, different languages, identical sidecar boxes.
**Story**:

1. Each app writes a log line to a local socket or file; its sidecar ships it onward. _"Same sidecar, any language."_
2. Scale out from 3 to 4: the new instance appears as a pair, app and sidecar together; delete one instance and both vanish. Beside it, a shared logging service stays up regardless. _"Per instance: they are placed, scaled and removed together."_
3. A sidecar is removed from one pair: that service instantly loses "ship logs" while the app keeps working. _"Remove it, lose the capability, not the app."_
4. The price: a memory meter shows the sidecar's cost multiplied by every instance; an inset shows a shared library baked into the app, which needs a rebuild per language, as the alternative the sidecar replaces.
   **The moment**: Beat 2 — a new instance arriving as a pair and a deleted one leaving as a pair, against the standalone shared service that doesn't move.
   **Interaction**: Click to remove or re-attach a sidecar on a running service and watch the capability disappear or return; scale the replicas and watch the sidecar cost grow with them.
   **Ending**: Three pairs again, sidecars present, logs flowing, memory meter showing the cost.
   **Variants**: `ambassador-pattern`, `adapter-container-pattern`, `service-mesh`.
   **Techniques**: boundary, lanes, restyle, failure, appear / disappear, meter, side by side, caption.
   **Review**: Improved — beat 2 claimed a crashed app and its sidecar restart "at the exact same instant", which is false in Kubernetes (a crashed container restarts alone; the shared fate is scheduling, scaling and deletion of the pod). Rebuilt that beat on scale-out and delete, and added the per-instance resource cost.

### Ambassador (`ambassador-pattern`)

**The aha**: An ambassador is a sidecar that makes outbound calls on the app's behalf, so a legacy or many-language app gets retries, circuit breaking and TLS without any change to its own code.
**Misconception to defeat**: Confusing it with an API gateway — that's inbound and shared; this is outbound and per instance.
**Cast**: A legacy app box ("unchanged since 2003") with an ambassador clipped to its side. The app calls `localhost:9000` in plain HTTP; the ambassador reaches across a boundary to a flaky external API over TLS.
**Opening frame**: app → localhost → ambassador → boundary → external API, the API drawn slightly hazy.
**Story**:

1. The app sends a plain request to localhost, unaware anything else exists. _"The app just calls localhost."_
2. The external API fails once (red flash); the ambassador retries with backoff and succeeds on the second try — the app only ever sees one clean response. _"Retries happen outside the app."_
3. The external API demands a newer TLS configuration; the ambassador is updated, the legacy app, which can't do TLS at all, stays untouched. _"Upgrade connectivity without touching legacy code."_
4. The price: the app now depends on a proxy that must be running; and a retried `POST /charge` that isn't idempotent is charged twice (red). _"Only retry what is safe to repeat."_
5. Inset: the gateway is a shared front door for many clients coming in; the ambassador is outbound, one per instance, going out.
   **The moment**: Beat 2 — the retry absorbed invisibly, the app's view staying a single clean call.
   **Interaction**: Toggle the external API between healthy and flaky and watch the ambassador absorb the difference; mark the call non-idempotent and watch retries cause a duplicate.
   **Ending**: The app content and unaware; the ambassador visibly having done the work.
   **Variants**: `sidecar-pattern`, `adapter-container-pattern`, `api-gateway` as the contrast, `service-mesh` (an ambassador on every service).
   **Techniques**: boundary, token, failure, timer, restyle, side by side, caption.
   **Review**: Improved — added the real hazard of hiding retries (non-idempotent calls repeat) and the dependency cost; the inbound/outbound inset stays. Claims checked: Azure/Burns ambassador is a per-instance outbound proxy offering retry, circuit breaking and TLS, matching the cast.

### Adapter (container pattern) (`adapter-container-pattern`)

**The aha**: An adapter sidecar converts an app's non-standard logs, metrics or health output into the shape the rest of the platform expects, standardizing it at the edge of the instance instead of rewriting the app.
**Misconception to defeat**: Confusing it with the anti-corruption layer, which translates domain models between systems, not operational output, or with the GoF adapter.
**Cast**: Three apps, each emitting a different native format (plaintext logs, a custom metrics format, a nonstandard health check), each with an adapter clipped to its side, and one uniform platform surface beyond them expecting one standard shape.
**Opening frame**: Three apps, three different native outputs, three adapters, one uniform platform surface.
**Story**:

1. App1's raw log line is reshaped into structured JSON by its adapter before it leaves the instance. _"Translate the output, not the app."_
2. App2's odd metrics format passes through its adapter and comes out identical in shape to App1's and App3's — side by side, now indistinguishable. _"Three shapes in, one shape out."_
3. The platform's dashboard queries all three the same way. Inset: an anti-corruption layer renames and re-models a customer between two domains; the adapter only reformats the same facts. _"Same meaning, new format."_
4. Someone bypasses the adapter on App3; its card in the dashboard turns garbled while the others stay clean. A note: the adapter is one more container to build, run and keep in step with the app's format.
   **The moment**: Beat 2 — three different native shapes converging into one identical shape once each has passed through its adapter.
   **Interaction**: Toggle each adapter on or off and watch that app's dashboard card become legible or garbled.
   **Ending**: All three adapters on, dashboard uniform and clean.
   **Variants**: `sidecar-pattern`, `ambassador-pattern`, `anti-corruption-layer`; observability's log aggregation and health-check conventions.
   **Techniques**: restyle, side by side, toggle, contents, spotlight, caption.
   **Review**: Improved — the ACL/GoF misconception was named but never defeated; beat 3 now carries the contrast (reformat vs re-model), and a cost note was added. Weighed using "universal travel adapter" as the metaphor; the three-into-one convergence already carries it without a cliche.

### Micro frontends (`micro-frontends`)

**The aha**: Splitting the UI itself into independently built and deployed pieces, each owned end to end by the team that owns its matching backend, extends microservice independence all the way to what the user sees.
**Misconception to defeat**: Confusing it with a shared component library — shared code means every consumer rebuilds when it changes; micro frontends share a page, not a build.
**Cast**: A browser window split into regions — header (Team Nav, blue), product list (Team Catalog, green), cart widget (Team Checkout, orange) — each region's small coloured team below it, each backed by a service of the same colour. A page-weight meter lower right.
**Opening frame**: The composed page, three coloured regions, three matching backend services below.
**Story**:

1. Team Checkout deploys a new cart widget alone; only the orange region updates, blue and green untouched. _"One team ships; the rest don't even redeploy."_
2. Contrast: with a shared button library, a new library version forces all three teams to rebuild and redeploy to pick it up; with micro frontends, each region updates on its own schedule.
3. Zoom into composition: each region's bundle arrives separately and slots into place at runtime (or at the edge), assembled rather than built as one app.
4. The price: orange's button has a different corner radius from green's, and each region ships its own copy of the UI framework, so the page-weight meter rises. _"Consistency and weight take deliberate work."_
   **The moment**: Beat 1 — only one coloured region updating while the rest of the page sits static.
   **Interaction**: Trigger a deploy on any one team's region and watch only that slice refresh; then change the shared library and watch the others have to follow.
   **Ending**: The composed page, three regions, each independently current.
   **Variants**: `backends-for-frontends`, `conways-law`.
   **Techniques**: boundary, restyle, token, clone, meter, side by side, spotlight, caption.
   **Review**: Improved — the shared-library misconception was named but not defeated; beat 2 now shows the library version forcing every team to rebuild. Added the real costs (duplicated runtime weight, visual drift). Alternative weighed: a straight "monolith frontend vs split" contrast; the library contrast is the sharper confusion to clear, so the monolith contrast was dropped for economy.

## Migration and modernization

### Strangler fig (`strangler-fig`)

**The aha**: A legacy system is replaced gradually behind a facade that routes one capability at a time to new services, so the old system shrinks to nothing while users never see a single big cutover.
**Misconception to defeat**: That it's a big-bang rewrite, or the same thing as lift-and-shift.
**Cast**: Left, a large ageing monolith box. Centre, a facade/router. Right, space that fills with new service boxes over time. A timeline strip along the bottom shows two stacked bands, legacy (grey) and new (colour), like a vine overtaking a tree, plus a thin "cost of running both" line.
**Opening frame**: Month 0 on the timeline — the legacy band fills the whole height, the new band is zero, everything routes to the monolith.
**Story**:

1. The facade routes `GET /invoices` to a brand-new Invoices service; the legacy band thins slightly, the new band thickens. _"Route one capability to new, at a time."_
2. The same happens for `GET /customers`; the bands shift again. _"Each cutover is small and reversible."_
3. A new route misbehaves; the facade reroutes it straight back to the untouched monolith code, then forward again once fixed. _"You can always route back."_
4. Beside it, a faint big-bang rewrite: a long flat line of cost with zero value until one cliff-edge cutover. The strangler delivers value from month 1, but its cost line humps: two systems, a facade and data sync to run until the end. _"Pay for both, for a while."_
5. Scrubbed forward to month 18: the legacy band is a sliver; at the end it hits zero, the monolith box disappears, and the cost line drops.
   **The moment**: Scrubbing the timeline and watching the vine-like overtake, grey shrinking as colour grows, with never a single flip.
   **Interaction**: Scrub the timeline and watch the routing table and band widths move together; route a capability back to legacy and watch the bands respond.
   **Ending**: The legacy band at zero, gone; all new services, the facade optionally retired.
   **Variants**: `branch-by-abstraction` (the same idea inside a codebase); `anti-corruption-layer`; `database-decomposition`; delivery's `shadow-deployment`.
   **Techniques**: lanes, move, path trace, clone, restyle, scrub, failure, chart, caption.
   **Review**: Improved — added the cost line (two systems and a facade run until the end, and data has to be kept in step) and the visible big-bang contrast that defeats the misconception; lift-and-shift is left to `rehost` in Fundamentals rather than forced into this story. The route-back beat is accurate because legacy code stays untouched until it is switched off.

### Branch by abstraction (`branch-by-abstraction`)

**The aha**: Replace a component inside a codebase in small, always-releasable steps on the main branch — introduce an abstraction, build the new version behind it, switch callers over, then delete the old one — instead of a long-lived feature branch.
**Misconception to defeat**: Confusing it with the strangler fig, which works at the system's edge rather than inside one codebase; or assuming it needs a branch, when it deliberately avoids one.
**Cast**: One module's tiles: Callers, an Abstraction interface, and an Old implementation beneath it. A single "main" timeline of commit dots along the bottom, no forks. A green "shippable" check that stays lit.
**Opening frame**: Caller → Old directly, inside one module, one commit on main.
**Story**:

1. Commits insert the Abstraction and move callers onto it one at a time; behaviour unchanged. _"Step one: introduce the seam. Ships today."_
2. A New implementation appears behind the Abstraction, incomplete, switched off by a flag, built over several more commits. _"Build the new one behind the seam."_
3. The flag flips from Old to New; calls now route to New, with Old still present but dimmed. A flip back is one more commit. _"Switching is one commit, and reversible."_
4. Final commits delete Old, then the Abstraction if it no longer earns its place. The price: for a time there are two implementations to keep passing tests, and someone must remember to delete the loser (a stale "Old" tile glows as tech debt).
5. An inset contrasts a long feature branch diverging for weeks and merging in one risky commit (a red flash at the merge) with this unbroken single line.
   **The moment**: Beat 3 — the toggle flip is one ordinary commit on the unbroken main line, no branch, no big-bang merge.
   **Interaction**: Step through the commits one at a time; a green checkmark stays lit the whole way, showing the app is shippable at every step.
   **Ending**: New implementation only, Old gone, one clean line of commits.
   **Variants**: `strangler-fig`; delivery's `feature-flags`.
   **Techniques**: contents, toggle, appear / disappear, lanes, side by side, failure, caption.
   **Review**: Improved — corrected the first step (callers move onto the abstraction before the new version exists), made the switch a reversible flag rather than a one-way commit, and added the real cost (two implementations, forgotten cleanup). Alternative weighed: leading with the feature-branch horror; kept as the closing inset because the clean line is the better first image.

### Splitting the monolith's database (`database-decomposition`)

**The aha**: Splitting a monolith's shared database is the hard part of decomposition, because joins, foreign keys and transactions are hidden dependencies that have to move into application logic before the tables can really separate.
**Misconception to defeat**: Thinking decomposition is finished once the application code is split into services, while the tables stay shared.
**Cast**: One shared database cylinder holding Orders and Customers tables, joined by a visible foreign-key chain. Two service boxes, Orders-service and Customers-service, both wired to the same cylinder.
**Opening frame**: Both services pointing at one cylinder, the FK chain linking the two tables inside it.
**Story**:

1. A query in Orders-service does a SQL join straight across the FK chain. _"The join is the real coupling."_
2. Step one, split the schema inside the same database: each service owns its own tables; the cross-table FK is snipped and the join becomes a call to Customers-service's API. _"The join moves out of the database and into code."_
3. Step two, the cylinder splits (split / merge) into two, each wired only to its own service. A sync job keeps a read-only copy of customer names in Orders' database for reports; a timeline strip shows its lifetime shrinking to zero. _"Temporary bridges, not permanent shortcuts."_
4. The price: a checkout that used to be one `BEGIN … COMMIT` across both tables now spans two databases; a failure between the writes leaves half an order (red). It needs a compensating step (saga) instead. _"Atomic transactions stop at the database boundary."_
5. The sync job disappears; both databases stand independent.
   **The moment**: Beat 2 — the FK chain snipping and the join rerouting through an API call, the moment the "easy" code split meets the hard data split.
   **Interaction**: Try a direct SQL join across the split cylinders and watch it fail; route the same request through the API instead and watch it succeed (slower, with a latency tick).
   **Ending**: Two independent cylinders, no FK chain, each with only its own service.
   **Variants**: `database-per-service`, `shared-database`; data's `change-data-capture`, `database-sharding`, messaging's `saga-pattern`.
   **Techniques**: split / merge, path trace, failure, stream, lanes, restyle, caption.
   **Review**: Improved — added the cost that people miss most, loss of cross-table transactions (consistency now needs sagas), and the safer two-step order (split the schema first, then the database). Cleaned up the muddled "sync copy for old reports" beat. Weighed starting from the transaction instead of the join; the join is the more visible first coupling.

## Code structure inside a service

### Hexagonal architecture (ports and adapters) (`hexagonal-architecture`)

**The aha**: Business logic sits at the centre and talks to the world only through ports it defines; adapters plug into those ports for whatever technology is driving it or being driven, so the core never knows which one it is.
**Misconception to defeat**: Confusing it with layered architecture, where the business layer depends on the data layer beneath it, rather than the data code depending on the core's port.
**Cast**: A hexagon labelled "Domain logic" with labelled port sockets around its edges ("run use case" on the driving side; "save order" and "notify" on the driven side). Adapter boxes of different shapes plug into those sockets: an HTTP adapter, a test-harness adapter, a SQL adapter, a queue adapter.
**Opening frame**: The hexagon with three ports, an HTTP adapter and a SQL adapter currently plugged in.
**Story**:

1. An HTTP token enters through "run use case," the core runs (a gear turns), and exits through "save order" into the SQL adapter, writing to a db cylinder. _"Driving adapters push in; driven adapters are called out to."_
2. The HTTP adapter is unplugged and a test-harness adapter plugged in; the same core logic runs identically on a scripted token. _"Swap what drives it; the core doesn't change."_
3. The SQL adapter is swapped for an in-memory one on "save order"; the core writes to a list, itself unchanged.
4. Contrast inset: a layered stack with the business layer sitting on the data layer (it imports the database code), beside the hexagon where the SQL adapter imports the core's port interface, never the reverse. The price: an extra interface and a mapping step for every port, which is wasted effort for plain CRUD. _"The arrow points at the core."_
   **The moment**: Beat 2 — the core running the identical turning-gear animation no matter which adapter is plugged in.
   **Interaction**: Swap adapters on either port and watch the core logic run unchanged.
   **Ending**: The hexagon core untouched through several different adapter configurations.
   **Variants**: `clean-architecture`; delivery's testability benefits.
   **Techniques**: boundary, token, toggle, side by side, restyle, caption.
   **Review**: Improved — the old inset said nothing "depends on a direction", which is wrong: adapters depend on the core's ports. Now the inset shows who imports whom, and the mapping cost is named. Weighed a "mains-socket" metaphor; the swappable adapters already carry it. Not to be confused with `adapter-container-pattern`, which is an unrelated sidecar.

### Clean / onion architecture (`clean-architecture`)

**The aha**: Concentric rings put entities at the centre and frameworks, UI and databases on the outside, and source-code dependencies point inward only, so business rules never import, and outlive, any framework or database, even though the running program calls outward to them.
**Misconception to defeat**: Confusing it with n-tier, where the database sits at the bottom and everything depends downward onto it; and thinking "dependency points inward" means "calls only go inward".
**Cast**: Four concentric rings — Entities, Use cases, Interface adapters, Frameworks & drivers. A solid arrow type for "calls at runtime" and a dashed type for "imports at compile time". The outer ring shows a named framework and database icon.
**Opening frame**: The four rings, all dashed import arrows inward, the outer ring showing "Framework X" and "Database Y."
**Story**:

1. A request enters from the outer ring and flows in to a use case (solid arrows inward). The use case needs to save, so it calls `OrderRepository`, an interface it owns; the solid call arrow goes OUT to the SQL implementation in the outer ring, but the dashed import arrow points back IN. _"Control flows out; the dependency still points in."_
2. Entities at the centre are inspected and hold no reference anywhere to Framework X or SQL; the core ring stays visually clean. _"The centre never imports the outside."_
3. Framework X is replaced by Framework Z; the ripple stops at the outer rings, entities and use cases don't flicker. _"Replace the outside; the inside doesn't notice."_
4. Contrast inset: n-tier as a ladder with a dependency arrow running all the way down to the database. The price: more interfaces, mapping between each ring's models, and more files than a simple app needs. _"Worth it when the rules outlive the tools."_
   **The moment**: Beat 1 — the run-time call arrow leaving the use case while the compile-time arrow turns back inward: dependency inversion in a single picture.
   **Interaction**: Swap any outer-ring technology and watch how far inward the change ripples; flip a toggle to make a use case import the database directly and watch the dashed arrow point outward, flagged red.
   **Ending**: The rings settle with new outer technology and the same unchanged core.
   **Variants**: `hexagonal-architecture`; `n-tier-architecture` as the contrast.
   **Techniques**: layers, path trace, restyle, side by side, spotlight, toggle, caption.
   **Review**: Rethought — the original beat 1 ("calls flow in; so do dependencies") is wrong, because the use case calls the database outward; the whole idea is the inversion of that dependency. Rebuilt around two arrow types (runtime call vs source dependency) so the moment is the inversion, and added the interface/mapping cost. Weighed pitching it as hexagonal with rings; the arrows contrast is what distinguishes it from the n-tier picture people already hold.

## Cloud-native and operational principles

### Twelve-factor app (`twelve-factor-app`)

**The aha**: Apps that follow twelve simple rules — config in the environment, stateless processes, disposability, and the rest — can be deployed anywhere, scaled by adding processes, and replaced at any moment, which is exactly what cloud platforms assume.
**Misconception to defeat**: Treating "cloud-native" or "twelve-factor" as a framework or tool to install.
**Cast**: One app box with twelve small badges around its border, lighting up one at a time. Beside it, a platform drawn as a grid of identical process slots.
**Opening frame**: The app, all twelve badges dim, beside an empty platform grid.
**Story**:

1. "Config" lights: a value moves from a hardcoded string inside the app to an injected environment variable; the same build sits unchanged across dev, staging and prod, shown side by side. _"Config lives outside the code."_
2. The old way: the app keeps sessions in its own memory; one instance is killed and its users are logged out (red). Then "Processes (stateless)" lights: the same app keeps sessions in a backing service; kill one instance and nothing is lost. _"State goes in a backing service."_
3. "Concurrency" lights: to handle more load, the platform simply adds slots, three more identical processes. "Disposability" lights: a new instance is ready in seconds and shuts down cleanly on a stop signal. _"Scale by adding processes."_
4. "Logs" lights: log lines stream to stdout, and the platform collects them; the app never opens a log file.
5. All twelve badges lit. Price tag: the rules forbid local disk state, sticky sessions and hand-edited servers, so a legacy app can take real work to comply.
   **The moment**: Beat 2 — killing a process instance and watching nothing break, after watching it break the other way.
   **Interaction**: Kill any running instance and watch it respawn; move the whole app from the dev grid to the prod grid unchanged.
   **Ending**: The app running identically across three environments, all badges lit.
   **Variants**: `cattle-vs-pets`; scaling's `stateless-vs-stateful`; delivery's `build-once-deploy-many`, `environment-parity`.
   **Techniques**: contents, clone, failure, stream, timer, side by side, spotlight, caption.
   **Review**: Improved — beat 3 captioned "scale by adding processes" under "Disposability", but scaling out is factor VIII (concurrency); the two are now separate. Added the failure case first so statelessness is earned, and the cost (legacy apps resist). Twelve factors listed and checked against 12factor.net: codebase, dependencies, config, backing services, build/release/run, processes, port binding, concurrency, disposability, dev/prod parity, logs, admin processes. Weighed a checklist montage; the break-then-fix version teaches more than twelve flashes.

### Cattle vs pets (`cattle-vs-pets`)

**The aha**: Treat servers as interchangeable, numbered cattle that get destroyed and replaced when sick, never as named pets nursed back to health by hand.
**Misconception to defeat**: "It's fine to log in and patch this one problem by hand, just this once."
**Cast**: Left, "Pets" — three servers with name tags and slightly different patch levels. Right, "Cattle" — three servers with only number tags, visually identical, built from one template image above them. A separate data volume attached to the cattle.
**Opening frame**: Both herds side by side, Pets named and uneven, Cattle numbered and uniform.
**Story**:

1. Pet "Max" gets sick; an engineer SSHes in and manually fixes it, on a long timer (about 90 minutes). _"Pets get nursed by hand."_
2. Cattle instance "04" gets sick; no one logs in. It's destroyed and a fresh "04" clones from the template in about 90 seconds. Its data volume was never on the server and reattaches. _"Cattle get replaced, from the template. State lives elsewhere."_
3. A dotted line traces every cattle instance back to one golden image; the pets have no shared template and have drifted apart (patch levels diverge).
4. A config change needs visiting all three pets by hand, against one edit to the cattle template that every instance then respawns from.
5. The price: the cattle side needed the template, automation and externalised state built first; a database server is genuinely harder to treat as cattle, and a replaced sick instance is evidence gone unless logs and a snapshot were taken. _"Cattle is an investment, not a free lunch."_
   **The moment**: Beat 2's instant destroy-and-reclone, set beside beat 1's slow manual fix, on a shared timeline.
   **Interaction**: Kill any cattle instance and watch it respawn automatically; try the same on a pet and nothing happens without the manual-fix animation.
   **Ending**: The cattle herd healthy and uniform; the pets herd shown as the slower, riskier way.
   **Variants**: `twelve-factor-app`; delivery's `immutable-infrastructure`, `golden-image`.
   **Techniques**: side by side, failure, clone, appear / disappear, timer, restyle, caption.
   **Review**: Improved — the original made it look free; added the prerequisite (state must live outside the instance), the stateful-workload limit and the lost-evidence cost, and put numbers on the timers. Weighed a "disposable vs repaired" framing; the cattle/pets image is the one engineers already use, and keeping it aids recall.

### Fallacies of distributed computing (`fallacies-of-distributed-computing`)

**The aha**: Every arrow between two boxes is a real network call that can be slow, fail or be intercepted; most cloud design patterns exist to compensate for one of eight false assumptions people make about networks.
**Misconception to defeat**: Drawing an arrow between two services as if it behaved like an in-process function call.
**Cast**: Two service boxes, A and B, joined by a simple arrow. A row of eight assumption cards along the top ("the network is reliable," "latency is zero," "bandwidth is infinite," "the network is secure," "topology doesn't change," "there is one administrator," "transport cost is zero," "the network is homogeneous"), all checked green.
**Opening frame**: A → B, a clean simple arrow, all eight cards checked.
**Story**:

1. The arrow is zoomed into: inside it is a path of cables, routers and a flaky switch that the simple arrow was hiding. _"That arrow is a whole network."_
2. The "reliable" card flips red as the switch drops a packet and A's call times out. _"It fails."_
3. The "latency is zero" card flips red as a timer shows the round trip taking 80 ms against under a microsecond for a function call. _"It's slow."_
4. The "secure" card flips red as an eavesdropper taps the arrow mid-path. _"It can be intercepted."_
5. The other five flip in a quick sweep, each with a one-picture proof: a 50 MB payload (bandwidth), B's address changes after a redeploy (topology), B belongs to another team who patch it (administrator), an egress bill (transport cost), a Java service sends XML to a Go one (homogeneous).
6. Zoomed back out, each flipped card gets the icon of the pattern that compensates for it: retry for reliability, caching for latency, mTLS for security. _"Most patterns here exist because of one flipped card."_
   **The moment**: Beat 1 — zooming into the "simple" arrow to find a whole unreliable network hiding inside it.
   **Interaction**: Click any of the eight cards to flip it and see which pattern responds.
   **Ending**: All eight cards flipped to their honest, red state, each paired with its compensating pattern.
   **Variants**: `synchronous-call-chain`, `service-mesh`; reliability's `partial-failure`, `retry-backoff-jitter`.
   **Techniques**: zoom, failure, timer, token, contents, spotlight, caption.
   **Review**: Improved — the story flipped three cards but the ending claimed eight; beat 5 now flips the other five so the ending is earned. Checked the list (reliable, zero latency, infinite bandwidth, secure, topology doesn't change, one administrator, zero transport cost, homogeneous network: eight). Added the point that the cure is designing for the network, not avoiding it. Weighed a single failing call as the whole story; the zoom beat is the more memorable discovery.

### External configuration store (`external-configuration-store`)

**The aha**: Move configuration out of the deployed package and into a central store the app reads, and can refresh, at runtime, so settings change without a redeploy and the same build runs everywhere with different config.
**Misconception to defeat**: Confusing it with a secret store (this holds non-secret settings) or with environment variables (local to one process, not shared).
**Cast**: Three identical app instances, each with a small config slot, wired by dashed lines to a central Config Store holding key:value rows and a version history.
**Opening frame**: Three instances, slots dim, dashed lines to the store, which holds the current rows.
**Story**:

1. On startup each instance pulls the current rows into its slot; all three show `maxRetries: 3`. _"Same build, config pulled from outside."_
2. A row is edited centrally to `maxRetries: 5`; seconds later all three slots update, with no redeploy. Beside it, config baked into the package: a new build and redeploy for all three, on a much slower timer. _"Change it once, centrally."_
3. The price: a mistaken edit, `maxRetries: -1`, reaches all three at once and they misbehave together (red); the store's version history lets it be rolled back in one click, and a staged rollout would have caught it on one instance first. The store itself goes down: instances keep running on their cached last-known values. _"One edit hits everyone: version it, stage it, cache it."_
4. A secret, `dbPassword`, is shown attempting to go into the same store; it's redirected into a separate, locked Secret Store with its own key icon. _"Secrets belong somewhere else."_
   **The moment**: Beat 2 — one edit rippling live to three running instances with no redeploy.
   **Interaction**: Edit a row centrally and watch the refresh ripple through; push a bad value and roll it back; drop a secret in and watch it redirect to the secret store.
   **Ending**: Three instances in sync with the store, the secret store standing apart beside it.
   **Variants**: `twelve-factor-app`; security's secret stores and vaults; Azure App Configuration and AWS AppConfig are examples.
   **Techniques**: contents, stream, timer, side by side, restyle, boundary, failure, caption.
   **Review**: Improved — the original was all upside. Added the real danger of central config (one bad value reaches every instance at once) with rollback, staged rollout and cached fallback when the store is down. Noted that apps must actually re-read the value (poll or subscribe) for a live refresh. Weighed leading with the redeploy pain; kept it as a side-by-side in beat 2.

### Quarantine (`quarantine-pattern`)

**The aha**: Nothing from outside goes straight into production; external assets sit in a quarantine area to be scanned first, and only a vetted copy is promoted to the trusted source the workload is allowed to pull from.
**Misconception to defeat**: Mistaking a vulnerability scan alone, with no gate that blocks promotion, for the same thing.
**Cast**: Left, "Upstream" sending packages inward. Centre, a fenced Quarantine pen with a scanner. Right, a Trusted source that the workload is wired to exclusively, with no direct line from Upstream.
**Opening frame**: A package arriving from Upstream into the Quarantine pen; the Trusted source empty; the workload wired only to Trusted source.
**Story**:

1. The scanner sweeps the package and stamps it pass (green) or fail (red). _"Scanned before it goes anywhere near production."_
2. A passing package is promoted into the Trusted source; the workload, still wired only there, pulls the clean copy. _"Only the vetted copy is reachable."_
3. A failing package, flagged with a malware icon, stays in the pen and is rejected; it never reaches the Trusted source or the workload. _"A fail is a wall, not a warning."_
4. Side by side: scan-only (the scanner flags it red, but the pipe to production is open and the package flows through anyway) against the quarantine (the pipe is physically absent). A workload wired directly to Upstream bounces off. _"There's no other way in."_
5. The price: a new upstream fix waits in the pen while it is scanned, and a package that passes is only "no known problem", not proof of safety (a zero-day slips through). _"Slower updates, and not a guarantee."_
   **The moment**: Beat 4 — the same red scan result, with one path letting the package through and one stopping it.
   **Interaction**: Drop in a package as either clean or malicious and watch whether it reaches the trusted source; try the direct-bypass line and see it blocked.
   **Ending**: The Trusted source holding only vetted packages, the pen empty again.
   **Variants**: Security's supply-chain scanning; delivery's artifact promotion.
   **Techniques**: boundary, token, restyle, failure, move, path trace, side by side, caption.
   **Review**: Improved — the misconception (scan without a gate) was not defeated by the old beats; beat 4 now compares scan-only against a blocked path. Added the costs (delay, scanners miss unknown issues). Dropped the "times out" detail, since a failed package is rejected, not timed out.

## Multi-tenancy and deployment topologies

### Multitenancy (SaaS) (`multitenancy`)

**The aha**: One deployment serves many customers at once, each kept apart from the others, so every layer has to know whose request it's handling and keep that tenant's data and performance separate.
**Misconception to defeat**: Confusing it with "many users" — many users within ONE tenant is normal; multitenancy means many separate tenants sharing infrastructure.
**Cast**: One shared app box (services plus db cylinder). Three colour-coded tenants, each a small group of figures (a company with several users), each request dot carrying its tenant's colour.
**Opening frame**: Three coloured tenant groups, each with several users and a queued request, one shared app ahead.
**Story**:

1. Red's request carries a "tenant: red" tag through every hop, so its db query returns only red-tinted rows from a cylinder holding all three colours mixed together. Several red users share that one tag. _"A tenant is a customer, not a user."_
2. The classic bug: a query without the tenant filter returns blue rows to red (red leak, alarm). The fix: the filter is added at one shared layer, not left to each query. _"Every layer checks whose request this is."_
3. Blue sends an unusually heavy request that spikes shared CPU; Green's normal request right after is visibly delayed. _"Shared infrastructure, shared risk."_
4. A contrast gives each tenant a fully separate stack — three app boxes — and Blue's spike no longer touches Green, but a cost meter triples.
   **The moment**: Beat 3 — Blue's spike stalling Green's unrelated request in the shared model.
   **Interaction**: Dial up Blue's request size and watch Green's latency respond in the shared model; switch to separate stacks and watch the dial stop affecting Green.
   **Ending**: Back in the shared model, all three colours flowing, cost lower than the separated alternative.
   **Variants**: `tenancy-models`, `deployment-stamps`; scaling's `noisy-neighbour`.
   **Techniques**: token, contents, spotlight, meter, side by side, toggle, dial, failure, caption.
   **Review**: Improved — the "many users" misconception wasn't visible; tenants are now groups of users. Added the most memorable multitenancy failure, the missing tenant filter leaking data, alongside the noisy neighbour, so both costs of sharing show. Weighed leading with the leak; the noisy neighbour is the better moment for the shared-versus-separate cost trade.

### Silo, pool and bridge models (`tenancy-models`)

**The aha**: Isolation is a spectrum chosen per component — silo gives each tenant dedicated resources, pool shares resources among everyone, and bridge mixes the two by tier or by service.
**Misconception to defeat**: Treating it as one all-or-nothing choice for the whole system rather than a per-component decision.
**Cast**: A system of three component rows — API, Compute, Database. Each row can show tenant figures (red, blue, green) either each with a dedicated instance, all sharing one, or split by a visible tier line. Two meters per row: "isolation" (more is better) and "cost and ops effort" (more is worse).
**Opening frame**: All three rows pooled, one shared box per row, all three colours flowing through each.
**Story**:

1. The Database row switches to silo and splits into three cylinders, one per tenant; the cost meter rises sharply, and a release that used to touch one database now touches three. _"Silo: dedicated, at a price."_
2. The API row switches to bridge: a tier line splits Premium tenants (red, blue) onto their own instances while Free (green) stays pooled.
3. Compute stays pooled, the cheapest row, but Blue's spike still stalls Green here, as before.
4. Zoomed out, each row carries its meters: silo high isolation and high cost, pool low and low, bridge between.
   **The moment**: Beat 4 — the same system using three different models for its three components at once, proving the spectrum is chosen per component.
   **Interaction**: Toggle each row independently between silo, pool and bridge and watch its own meters move.
   **Ending**: A mixed configuration — silo database, bridge API, pooled compute — meters balanced.
   **Variants**: `multitenancy`, `deployment-stamps`; data's multi-tenant data isolation.
   **Techniques**: contents, toggle, split / merge, meter, boundary, caption.
   **Review**: Improved — the original meters said "high on both axes" for silo, which reads as good-and-bad at once; now one axis is isolation (up is good) and one is cost and ops effort (up is bad). Added the operational cost of silos (many stacks to release to). Terms checked against the AWS SaaS lens (silo, pool, bridge). Alternative weighed: a single stack choice; the per-row independence is the aha, so kept.

### Deployment stamps (`deployment-stamps`)

**The aha**: When one deployment of the whole stack hits its limits, grow by adding another complete copy rather than making the existing one bigger; a routing layer sends each tenant to the stamp that holds them.
**Misconception to defeat**: Confusing it with scale units (a bundle inside ONE deployment) or with more instances behind a load balancer; a stamp includes its own data store.
**Cast**: A router at the edge with a lookup table (tenant → stamp), kept outside every stamp. Below, Stamp 1 and Stamp 2, each a full copy of the app with its own db cylinder and a capacity meter, each holding some coloured tenants.
**Opening frame**: The router, Stamp 1 holding Red and Blue at 60%, Stamp 2 empty, the table showing `Red → 1`, `Blue → 1`.
**Story**:

1. New tenant Green signs up; the table gains `Green → 2` and Green's requests flow to the otherwise identical Stamp 2. _"New tenant, go to a stamp with room."_
2. More tenants arrive until both stamps are near full; the next signup finds no room, so Stamp 3 is cloned from the template, services and a fresh database together. _"Out of room? Add a whole new stamp."_
3. Blue is moved from Stamp 1 to Stamp 3 to even the load: their rows are carried across as a token and the table updates to `Blue → 3`; this is a deliberate migration, not automatic.
4. Stamp 2 sits inside a separate region boundary because Green needs data residency there.
5. The price: each stamp carries its own baseline cost even when half empty; a release must be rolled out to every stamp (one at a time, which also limits a bad release to one stamp); and the routing table is the one shared piece everything depends on.
   **The moment**: Beat 2 — a whole new stamp, services and a fresh database together, cloning into existence as the scale-out unit.
   **Interaction**: Add a new tenant and watch the router assign it to whichever stamp has room; drag a tenant between stamps and watch their data move with them.
   **Ending**: Three full stamps, the lookup table complete, each tenant living in exactly one.
   **Variants**: `tenancy-models`, `geode-pattern`; reliability's `cell-based-architecture` (the same topology as a blast-radius tool).
   **Techniques**: clone, token, move, meter, boundary, contents, caption.
   **Review**: Improved — the old beat 2 created Stamp 3 while Stamp 2 was empty, which contradicted "grow when full"; both stamps now fill first. Added the costs (idle baseline, release fan-out, routing table as the shared dependency) and the point that a rollout stamp-by-stamp doubles as a safe canary. Weighed a plain "copy-paste the whole app" framing; the router and table are what make the stamps usable.

### Geode (`geode-pattern`)

**The aha**: Identical copies of the back end are deployed in every region over globally replicated, multi-write data, so there is no home region — any geode can serve any user, with low latency and no promotion step if one region is lost.
**Misconception to defeat**: Confusing it with deployment stamps, where each stamp owns a subset of tenants, or expecting a failover step like active-passive.
**Cast**: A world map with four geode boxes, each a full stack plus db cylinder, interconnected by a mesh of bidirectional sync lines. User figures scattered near their nearest geode. A global router above the map.
**Opening frame**: Four geodes on the map, a mesh of sync lines between all of them, users routed to whichever is nearest.
**Story**:

1. A European user writes data to the nearest geode; the write streams out along the mesh to the other three. _"Write anywhere, it replicates everywhere."_
2. An Asian user reads the same item a moment later: the Asia geode still shows the old value for a beat (replication lag), then updates. Two users write the same item in two regions at once; a conflict rule (last writer wins) picks one. _"Nearby and fast, but not instantly consistent."_
3. The Europe geode fails; the global router's health probe stops sending traffic there and the European user's next request goes to the next-nearest healthy geode. No replica is promoted, no data is restored. _"No home region to fail over from."_
4. A contrast inset shows deployment stamps, where a failed stamp's tenants can't simply be served by another stamp without a data migration. Price tag: four full copies to pay for, and data-residency rules may forbid replicating everything everywhere.
   **The moment**: Beat 3 — a whole region failing and the user barely noticing, rerouted to the next-nearest geode with nothing extra required.
   **Interaction**: Fail any geode on the map and watch nearby users silently re-route; a dial for replication lag shows how stale a far-away read can be.
   **Ending**: Three healthy geodes, the failed one greyed out, every user still served.
   **Variants**: `deployment-stamps`; reliability's `active-active-vs-active-passive`, `multi-region-deployment`.
   **Techniques**: boundary, stream, token, failure, side by side, dial, caption.
   **Review**: Improved — the original promised an instant fresh read in Asia and "no DNS change", both overclaims (multi-write replication is eventually consistent and conflicts need a rule; a global router must still stop sending traffic to a dead region, which DNS-based routers do with TTL delay). Rewrote the lag and failure beats and added cost and data-residency limits. Weighed showing only the failure; the lag/conflict beat is the honest price of "write anywhere".

### Compute resource consolidation (`compute-resource-consolidation`)

**The aha**: Packing several tasks or services into one compute unit instead of giving each its own gets higher utilization and lower cost, at the price of isolation — one noisy or failing task can affect the rest.
**Misconception to defeat**: Confusing it with a monolith; consolidation is about hosting and placement, not code structure, and the packed services can be entirely unrelated.
**Cast**: Before, five unrelated services, each on its own VM, utilization around 15%. After, one VM of the same size containing all five as packed tiles, utilization about 75%. A cost meter, and five small load graphs.
**Opening frame**: Five services, five separate VMs, utilization meters around 15%.
**Story**:

1. The five VMs merge into tiles inside one VM; 5 x 15% of a VM is 75%, so utilization jumps to about 75% and the cost meter drops to a fifth. _"Pack them together: higher utilization, lower cost."_
2. The load graphs show why it works: each service peaks at a different time, so the sum stays under 100%. Move two services whose peaks coincide into the same VM and the sum hits 100% and clips (red). _"Pack services that don't peak together."_
3. One tile develops a memory leak, swelling and tinting red; because it shares the VM's memory pool, a neighbouring tile starts getting starved, dimming and slowing. _"One noisy task starves its neighbours."_
4. Tasks that scale and deploy together are grouped on one VM; a task with a very different lifecycle moves onto its own consolidated VM. An inset contrasts the bulkhead pattern, which deliberately gives each task its own partition to prevent exactly this starvation. _"Group by lifecycle and scaling needs."_
   **The moment**: Beat 3 — one leaking tile visibly starving its packed neighbour.
   **Interaction**: Make any tile "noisy" and watch neighbours in the same VM get starved; move a tile to its own VM and watch the starving stop.
   **Ending**: Thoughtfully grouped VMs, utilization high, the leaking task isolated onto its own unit.
   **Variants**: `tenancy-models`; reliability's `bulkhead` as the opposite pressure; scaling's `noisy-neighbour`.
   **Techniques**: side by side, meter, chart, restyle, failure, move, dial, caption.
   **Review**: Improved — the numbers didn't add up (five VMs at 15% merged into a "larger" VM at 80%; five 15% loads fit about 75% of one same-sized VM). Added the missing condition, uncorrelated peaks, which is the real reason consolidation works, and the lost headroom. Weighed opening on the starvation failure; leading with the saving keeps the cost-versus-benefit order honest.

## Architecture decisions

### Trade-offs in architecture (`architecture-trade-offs`)

**The aha**: Every architectural choice buys some qualities by giving up others; there's no universal best practice, only the best fit for a situation, so the honest answer names what's being optimized for, what's given up, and why.
**Misconception to defeat**: Expecting a single "best practice" answer that's always right.
**Cast**: A balance scale with two labelled ends, "Consistency" and "Availability," captioned "during a network partition". Two candidate architectures side by side, A leaning consistency and B leaning availability, each a small system diagram. A scenario card above them.
**Opening frame**: The scale balanced, both architectures unlabelled, a scenario card reading "A payments system during a network partition."
**Story**:

1. The scenario plays on Architecture A: a partition splits it; A refuses writes on the minority side to stay consistent, the scale tipping to "Consistency," a red "unavailable" flag appearing. _"Never show a wrong balance."_
2. The same scenario plays on Architecture B beside it: it keeps accepting writes on both sides, the scale tipping to "Availability," but a reconciliation conflict appears once the partition heals. _"Stay open, reconcile later."_
3. The scenario card is swapped to "A product catalog browse page" and replayed: now B's choice looks obviously better, while A's refusal looks needlessly strict. _"Same architectures, different situation, different right answer."_
4. A trade-off card under each, in three lines that become an ADR: optimizes for, gives up, because. A footnote: this choice only bites during a partition; the rest of the time both are fine.
   **The moment**: Beat 3 — the exact same two architectures swapping which one looks right the instant the scenario changes.
   **Interaction**: Choose a scenario card from a small deck and watch which architecture's trade-off looks better for it.
   **Ending**: Both architectures left standing, neither "best," each with its trade-off card pinned beside it.
   **Variants**: `architecture-characteristics`, `microservice-premium`, `architecture-decision-records`.
   **Techniques**: side by side, meter, choice, failure, caption.
   **Review**: Improved — kept the swap-the-scenario core but labelled the scale "during a partition" (consistency versus availability is only forced then) and made the closing card the same three lines an ADR records. Facts checked: a CP system refuses minority-side writes; an AP system accepts both and reconciles. Weighed using microservices vs monolith as the pair; CAP is the sharper, quicker contrast, and `microservice-premium` already covers the other.

### Architecture characteristics (quality attributes) (`architecture-characteristics`)

**The aha**: Functional requirements say what to build; the architecture characteristics you prioritize decide which style to use, and since none of them can be maximized all at once, picking the few that matter most is the real decision.
**Misconception to defeat**: Treating "scalable, available, secure, maintainable and cheap, all maximized" as an achievable requirements list.
**Cast**: A six-axis radar chart (Scalability, Deployability, Performance, Fault isolation, Simplicity, Cost efficiency). Three architecture style icons — Monolith, Microservices, Serverless — each with its own shape ready to overlay. A caption on the chart: "illustrative judgments".
**Opening frame**: An empty radar chart, six axes labelled, three style icons waiting beside it.
**Story**:

1. Monolith's shape is drawn: strong on Simplicity, Performance (in-process calls) and Cost efficiency at small scale; weak on independent Scalability, Deployability and Fault isolation. _"Every style scores differently."_
2. Microservices' shape overlays in a second colour: the reverse, strong Scalability, Deployability and Fault isolation, weak Simplicity, Performance and Cost. _"Gains here, costs there."_
3. Three axes (Scalability, Deployability, Fault isolation) are dragged to "must maximize"; Microservices' shape fills those. Swap the priorities to Simplicity, Performance, Cost and the Monolith wins instead. _"Pick your axes first, then the shape that fills them."_
4. An attempt to max all six axes at once on one architecture distorts the shape impossibly, flagged red. _"You can't maximize all of them."_
   **The moment**: Beat 3 — the same two overlaid shapes swapping winners the moment the priority axes change.
   **Interaction**: Pick which axes matter most and watch which architecture's shape wins for that priority set; Serverless can be toggled in as a third shape.
   **Ending**: The radar chart with chosen priority axes highlighted, the better-fitting shape left on top.
   **Variants**: `architecture-trade-offs`; fundamentals' Well-Architected pillars.
   **Techniques**: chart, side by side, spotlight, choice, caption.
   **Review**: Improved — the old story claimed Microservices fill Security and Availability better, which isn't generally true (more services mean more attack surface, and chained calls lower availability). Replaced the axes with ones the styles genuinely differ on, showed the winner flipping with the priorities, and labelled the shapes as judgments, not measurements. Weighed a bar chart for scores; the radar's lopsided shapes make "gains here, costs there" visible at a glance.

### Architecture decision records (ADRs) (`architecture-decision-records`)

**The aha**: A short, numbered record of one significant decision — context, decision, consequences — outlives the people who made it; a changed decision gets a new record that supersedes the old one, never an edit.
**Misconception to defeat**: Confusing it with a design doc or wiki page that gets silently edited in place and goes stale.
**Cast**: A numbered stack of cards, ADR-001, ADR-002, ADR-003, each with fields: status, context, decision, consequences. A system diagram beside the stack that changes shape as decisions accumulate.
**Opening frame**: ADR-001 on top: "Use a shared database, because it's faster to ship with a small team." Consequences: "Schema changes will need cross-team coordination as teams grow." The diagram shows services sharing one cylinder.
**Story**:

1. Months later the shared schema starts breaking teams (red flashes on the diagram), as ADR-001's own consequences predicted; a new card, ADR-002, is written: "Supersedes ADR-001. Decision: split to database per service." _"A new decision, not an edit."_
2. ADR-001 is stamped "Superseded by ADR-002" and stays in the stack, still readable. _"The old reasoning stays visible."_
3. A new engineer reads the stack top to bottom and immediately understands why the system has separate databases, and why it once didn't, without asking anyone.
4. A contrast inset shows a wiki page for the same decision being silently overwritten, the old text vanishing with no trace. Price tag: someone has to write each record and judge which decisions are significant enough; a stack of 400 trivial ones hides the 20 that matter.
   **The moment**: Beat 2 — ADR-001 staying in place, stamped superseded rather than erased.
   **Interaction**: Click any ADR to read its fields; try to "edit" one and get redirected to writing a new one instead.
   **Ending**: A growing, readable stack, the diagram's current shape explained by the latest undeleted chain of decisions.
   **Variants**: `c4-model`, `fitness-functions`, `architecture-trade-offs`.
   **Techniques**: contents, appear / disappear, restyle, side by side, spotlight, caption.
   **Review**: Improved — made ADR-001's recorded consequences the thing that predicts the later pain (so the record visibly pays off), used the standard fields (status, context, decision, consequences), and added the honest cost (writing effort, noise). Weighed a "git blame for decisions" metaphor; the superseded stamp is simpler.

### C4 model (`c4-model`)

**The aha**: Different audiences need different levels of detail, so the C4 model zooms through four levels — context, containers, components, code — each one zooming into exactly one box from the level above, in one consistent notation.
**Misconception to defeat**: Confusing it with UML, which is far larger, or a C4 "container" with a Docker container; it's any separately runnable unit, such as a web app, an API or a database.
**Cast**: Four nested frames, like a camera zooming in: System Context (one box, a couple of external systems); Containers (the same box opened to Web App, API, Database); Components (the API opened to Orders Controller, Service, Repository); Code (one component opened to a class diagram). An audience strip beside each level: everyone / developers and ops / developers.
**Opening frame**: Level 1, a single "Online Store" box with a Customer figure and an external "Payment Provider" beside it, meaningful on its own.
**Story**:

1. The system box opens into Level 2, the same box now showing its three containers inside, the Customer and Payment Provider still correctly attached. _"Zoom into the box, same notation."_
2. The API container opens into Level 3, revealing its internal components.
3. One component opens into Level 4, a class diagram, noted as optional and rarely drawn by hand.
4. Zoomed back out to Level 1, it still stands alone. The audience strip shows who each level is for. The price: diagrams drift from the code unless generated from a model; a caption "diagrams as code" keeps them current. _"Four levels, one model, drawn for who's reading."_
   **The moment**: Beat 1 — the same box literally opening into its own more detailed diagram, rather than a separate, disconnected picture.
   **Interaction**: Click any box to zoom into it, if a more detailed level exists, or zoom back out.
   **Ending**: Resting at Level 2, Containers, the most commonly used level, with either zoom direction still available.
   **Variants**: `architecture-decision-records`.
   **Techniques**: zoom, boundary, contents, spotlight, caption.
   **Review**: Improved — the "different audiences" half of the aha had no beat; added the audience strip, and the drift cost with the diagrams-as-code answer (Mogram's own idea). Facts checked: four levels (context, container, component, code), level 4 optional, a C4 container is a separately running application or data store. Weighed a map-zoom metaphor; the same box opening is already the map metaphor.

### Architectural fitness functions (`fitness-functions`)

**The aha**: A fitness function is an automated check, run on every change, that verifies the system still meets a chosen architecture characteristic — protecting architecture decisions the way tests protect behaviour.
**Misconception to defeat**: Confusing it with a unit test, which checks behaviour, not architecture-level properties like which modules may import which.
**Cast**: A CI pipeline of stages — Build, Unit tests, Fitness functions, Deploy. The Fitness functions stage holds two checks: "UI must not import Database directly" and "p95 response time < 200 ms under load test." Below, the actual module tiles (UI, Service, Database) and a latency chart.
**Opening frame**: The pipeline, four stages, a commit about to enter Build.
**Story**:

1. A commit passes Build and Unit tests with green checks, though it adds a line in which UI imports Database directly. _"Unit tests check behaviour..."_
2. At the Fitness functions stage, the import-graph check finds that line, skipping Service; the check fails red and the pipeline halts before Deploy. _"...fitness functions check the shape."_
3. The offending import is removed, UI routed back through Service; the check reruns, passes green, and the commit proceeds to Deploy.
4. The second check: a load test in the pipeline pushes the p95 chart over budget on a later commit and halts it; the same check can run against production as a continuous monitor. The price: each rule is code someone writes and keeps current, and a wrong rule blocks good changes.
   **The moment**: Beat 2 — the import graph catching a structural violation automatically, before any human review, the same way a failing test stops a bug.
   **Interaction**: Introduce a forbidden import and watch the pipeline halt; remove it and watch the pipeline pass.
   **Ending**: The pipeline green end to end, the import graph clean, the latency chart under budget.
   **Variants**: `architecture-decision-records`; delivery's pipeline gates.
   **Techniques**: lanes, path trace, failure, chart, meter, caption.
   **Review**: Improved — beat 1 now shows the unit tests passing the same commit the fitness check rejects (so the contrast with unit tests is visible, not just stated); the latency check moved to a load-test stage, since a live chart on production belongs to monitoring. Added the maintenance cost. Weighed naming tools (ArchUnit, dependency-cruiser); left out as they date quickly.

### Microservice premium (when microservices pay off) (`microservice-premium`)

**The aha**: Microservices impose a real extra cost in distributed operations, deployment automation and monitoring that only pays off once complexity, team count, or the need for independent scaling is high enough; for simple systems a monolith is more productive.
**Misconception to defeat**: "Microservices always scale better, so bigger is always better."
**Cast**: A two-axis chart, "System and organizational complexity" against "Productivity," with two curves: Monolith (starts high, declines as complexity grows) and Microservices (starts lower, the premium, but declines far more slowly). A caption on the chart: "illustrative, not measured". An itemised premium bill beside it.
**Opening frame**: Both curves faint, a "you are here" marker at low complexity, where Monolith sits clearly higher.
**Story**:

1. At low complexity, a small three-person team beside the monolith is productive and simple; beside microservices, the same team is mostly busy with pipelines, tracing and on-call. The premium bill itemises it: deployment automation, monitoring, service discovery, distributed data. _"At low complexity, the premium isn't paid back."_
2. The marker drags rightward: Monolith's curve bends down as teams collide inside its tiles (collision flashes), while Microservices' curve, past its early dip, stays flatter. _"As complexity rises, the monolith's cost rises faster."_
3. The two curves cross, marked "this is where microservices start paying off." A second caption: where the crossing sits depends on the team's skill and the domain; nobody knows the exact point in advance.
4. A contrast inset shows "monolith first": a monolith with firm internal module boundaries already drawn, ready to be pulled out as services when the marker crosses.
   **The moment**: Beat 3 — the curves crossing, a concrete point where the "always better" claim fails before it and holds after it.
   **Interaction**: Drag the complexity marker left and right and watch which curve sits on top, and by how much; the premium bill grows with the number of services.
   **Ending**: The marker left at the crossing point, both curves visible, the modular-monolith path highlighted as the bridge between them.
   **Variants**: `modular-monolith`, `architecture-trade-offs`.
   **Techniques**: chart, dial, spotlight, failure, side by side, caption.
   **Review**: Improved — added the itemised premium bill (what the cost actually is) and labelled the curves as illustrative: the original chart is an argument, not data, and the crossing point is unknowable in advance. Weighed a cost-only "tax meter"; the crossing-curves chart carries the "when" that a meter can't.

Note: `service-discovery` is owned by Networking and is skipped from this share.
**Review**: Merged — owned by Networking; nothing in this file. It should borrow the "gateway routes by a table that changes without clients knowing" picture from `gateway-routing`.
