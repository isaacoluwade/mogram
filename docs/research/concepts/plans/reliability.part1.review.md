# Reliability part 1: stage-3 review summary

37 plans reviewed: 24 Improved, 10 Keep, 3 Merged, 0 Rethought. (The first four plans were reviewed
by an earlier reviewer; the other 33 here.)

Merged (owned elsewhere): `hedged-requests` and `load-shedding` (Scaling), `control-plane-vs-data-plane`
(Fundamentals). Each review line lists what the owner should borrow; one fix flagged for Scaling:
its hedge fires at p95 but shows "+1% calls" (p95 means about +5%, +1% needs p99).

## Most important changes

- `idempotency-key`: now includes Messaging's new-key-per-retry bug, the stored original response,
  the "can't tell a retry by its contents" misconception and the lost-replies dial, plus the
  concurrent retry (409) and same-key-different-body (422) cases.
- `retry-storm`: "retries: 3" meant 243 calls only if it were three tries; badges now read "tries: 3"
  and the dial shows the 4-tries case (1,024).
- `thundering-herd`: a 10 s blip strands about 1,000 requests, not 6,000; now it drops 6,000
  connections, and the jitter dial shows the spread needed to get under capacity.
- `circuit-breaker`: a dead dependency fails instantly and wouldn't fill the pool; it now hangs.
  Added probes in half-open, trip rules and a fallback.
- `deadline-propagation`: nested 5 s timeouts expire together, so "C busy at 12 s" was wrong; the
  waste now comes from queues plus a fresh clock at each hop.
- `retry-backoff-jitter`: specified full jitter (random between 0 and the doubling ceiling), added a
  cap and give-up; removed the false "same total waiting".
- `shuffle-sharding`: checkable combinatorics (40 customers, 28 pairs, 10 hit vs about 2), why
  one-worker overlap survives, and a dial to real scale (C(100,5) = 75 million; Route 53 about 7 trillion).
- `static-stability`: gauge figures mixed share of peak with utilisation; now 56% to 83%.
- `self-healing`: recovery times made honest (40 s, about a minute).
- `blast-radius`: the deploy now goes to cell 2 first, plus Security's stolen-credential reading as a closing beat.
- `single-point-of-failure`: the config store is read on every request, so killing it really fails the servers.
- `slow-is-the-new-down`, `overload-and-goodput`, `redundancy-n-plus-1`, `cell-based-architecture`,
  `bulkhead`, `constant-work`, `health-check-fail-open`: each gained the missing precondition or cost.

## Patterns for the platform

- **Meters and charts over time** are in nearly every plan: utilisation gauges, goodput versus throughput,
  error rate, a request-count histogram. A meter that can show a formula under it (the nines and
  composite plans) is needed, as is one that animates an area staying constant while its shape changes (jitter).
- **Side by side with a toggle** is the main device: the same fault replayed with one thing changed
  (timeout, jitter, breaker, bulkhead, cells). The platform wants a "replay with one variable flipped"
  feature, with rewind, and synchronised timelines for both sides.
- **Thread or slot pools** (contents inside a box that fill, free and jam) recur in timeouts, fail-slow,
  breaker, bulkhead, fail fast; so do queues with patience rings (ghost requests).
- **Fan-out trees with a counter** (retry storm) and **sets and combinations** (shuffle sharding) need
  generated layouts rather than hand drawing.
- **Failure injection by click, plus a health dot that can disagree with a client's view** (gray failure,
  health checks) needs two parallel views of one scene.
- **Fault-domain frames** (host, rack, zone, cell) nested and highlighted as the blast boundary.
- **A dial that recomputes live numbers** (nines, tries over layers, combinations) appears in a dozen plans.
- **Illustrative numbers** (times to notice, recovery times) should be marked as such in the render.
