# Scaling plans, part 2: review summary

26 plans. Verdicts: Keep 3, Improved 21, Rethought 0, Merged 2 (`cdn` to Networking, `latency-percentiles` to Observability).
The first 13 caching/edge plans were reviewed earlier (Keep 3, Improved 9, Merged 1); this pass covered the 13 performance-maths plans (Improved 12, Merged 1).

## Most important changes

- `bottleneck`: beat 3 claimed throughput would rise to 200 while render capped it at 150; the next-slowest stage sets the ceiling, so the chart now climbs to 150 and render starts at 150.
- `littles-law`: a wrong caption (doubling W from 0.2 s at 10/s gives 4, not 20) fixed; the pool example now shows a slow dependency doubling W against a fixed pool.
- `utilisation-vs-latency`: wait and total time were mixed; the chart now plots total response time (2x, 3.3x, 10x, 100x at 50/70/90/99%), and a steady-arrivals switch shows the curve needs random arrivals.
- `hedged-requests`: "+1%" load was inconsistent with a p95 trigger (about 5%); B's time is counted from the hedge; the loser is cancelled; added correlated slowness and writes cautions and the 1% x 1% reason it works.
- `tail-latency`: demo runs 1,000 times so the tally really sits near 63%; added the n sweep, the "each backend must be 99.99% fast" flip side and a wait-for-90 switch.
- `latency-percentiles` (Merged): its numbers were impossible (a p99 of 1,900 ms drags the average well above 103 ms); fixed to about 130 ms; Observability should borrow the ranked-row move, the heavy-user 63% fact and a "don't average percentiles" caution.
- `concurrency-vs-parallelism`: "thousands per second" on one core with 2 ms of CPU each is impossible (about 500/s, about 100 in flight); the CPU-bound beat now covers event loops and time-slicing.
- `latency-numbers`: "ten to a thousand times" was wrong for the 5x rung; added the human-time rescale (1 s memory read means 17 days for the ocean).
- `critical-path`: pushes profile past the tie so the bold path hops to settings and gains stop at 45 ms.
- `latency-vs-throughput`: car counts didn't match the 10 s trip; added a big-file switch since bandwidth does speed up large transfers.
- `cdn` (Merged): Networking's plan should borrow the origin "requests seen" counter, per-city first-request vs repeat cost, and the pull/push toggle.

## Patterns for the platform

- Live arithmetic: a formula beside the picture that recomputes as dials move (L = lambda x W, 1 - 0.99^n, 1 / (f + (1-f)/N), W / (1 - utilisation)). Needs a small expression readout bound to dials.
- Dials that sweep a parameter while a chart point traces a curve (queueing, Amdahl, tail fan-out, TTL load vs age).
- Stopwatches on tokens and side-by-side lanes for before/after (hedging, SWR, coalescing, CDN).
- Counters at a shared resource (database, origin) that prove "the backend only saw N".
- Dependency graph with a computed longest path that re-highlights as durations change (critical path, bottleneck queues).
- Random sampling with a seeded generator and a running tally (dice per backend, bursty arrivals), with a "steady" switch to show that randomness is the cause.
- Time-scale switching (real units to human time) and slow motion for the decisive beat.
- A map with arcs whose length is latency, shared by CDN, shield and edge compute.
