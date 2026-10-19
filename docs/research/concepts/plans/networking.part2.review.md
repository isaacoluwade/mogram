# Networking part 2: review summary

Verdicts (34 plans): 29 Improved, 2 Keep, 0 Rethought, 3 Merged (`cors`, `certificate-chain-of-trust`, `rest-graphql-grpc`).

## Most important changes

- `http-cookies`: attacker site was `evil.example.com` against `bank.example.com`, which is the same site, so SameSite=Lax would not block the forged POST. Moved to a different registrable domain.
- `tls-handshake`: the "server's reply already carries data" claim replaced by the real mechanism (key shares in ClientHello/ServerHello, encrypted certificate, client Finished plus request together).
- `http-caching`: split expiry-revalidation (304 saves the body, not the trip) from `no-cache` vs `no-store`; the moment moved to the right beat.
- `hybrid-dns-forwarding`: beat 5 contradicted itself; now shows per-zone forwarding rules (a new privatelink zone with no on-prem rule).
- `dnssec`: DS record direction fixed (lives in the parent, fingerprints the child key).
- `http-request-lifecycle`: ending claimed server time becomes dominant when warm; added numbers that add up (350 ms cold, 120 ms warm, 20 ms server).
- `http-status-codes`: added 301 vs 302; 401 means missing or invalid credentials; killed app gives 502, all-unhealthy gives 503.
- `dns-ttl-and-caching`: added negative caching; the "JVM caches forever" claim corrected; wait out the old TTL before changing.
- `https-and-tls`: HSTS cannot close the first plain-HTTP visit alone (preload does); added the plaintext DNS lookup.
- `websockets`, `l4-vs-l7-load-balancing`: any balancer pins an upgraded WebSocket; L7 can spread HTTP/2 gRPC calls; L4 keeps client IP only in pass-through mode.
- `client-ip-preservation`, `service-discovery`, `anycast`, `split-horizon-dns`, `private-dns-zones`: factual or logical slips fixed (leftmost XFF entry, health-check delay, BGP convergence, internal-only NXDOMAIN, VPC-C is not "the internet").
- `cdn`: borrowed Scaling's origin counter, clickable stopwatches, pull/push toggle and links; added numbers for the connection-setup half.

## Patterns for the platform

- Ladder diagrams with a visible round-trip count and labelled per-step milliseconds recur in DNS, TLS, HTTP and CDN plans; the numbers need to be computed from one latency model so they add up.
- TTL rings and countdown timers are the single most reused element (DNS, HTTP cache, CDN, service discovery); stacked timers (health check then TTL) need support.
- Toggles that change one setting and re-run the same scenario (SameSite, no-cache vs no-store, termination mode, mTLS on/off, rule on/off per direction) are the main interaction.
- "Which party answered" markers (a status badge or IP appearing at a specific hop) carry the 5xx, split-horizon and client-IP plans.
- Boundaries that gate a decision (DNS views, private zone links, forwarding rules, read gates, trust stores) need a "who is asking from where" input.
- A shared latency/loss simulation (loss dial, distance dial) would serve http-versions, lifecycle, CDN and TCP plans.
