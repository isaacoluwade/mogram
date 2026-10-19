# Scaling part 1: review summary

Verdicts (36 plans): Keep 20, Improved 15, Rethought 0, Merged 1 (`consistent-hashing`, owned by Data).

## Most important changes

- `target-tracking`: the plan claimed step scaling only adds one copy per cycle (false). Reframed as a formula (5 x 80 / 50 = 8) against a hand-written band table, with a bigger surge that shows the table's limit.
- `autoscaling-flapping`: the numbers were impossible (adding one of two copies cannot take 66% to 58%). Rebuilt on eight copies with the real 1/N arithmetic (66 -> 59 -> 66) and a wide-gap replay that lands at 62%.
- `scaling-metrics`: beat 2 had cheap pings lowering the request count; fixed so cheap traffic over-scales and costly traffic under-scales. The transcoder lane's wrong signal made explicit.
- `global-load-balancing`: failover was instant; added DNS TTL lag versus anycast.
- `health-checks`: added fail-open behaviour when every target looks unhealthy.
- `load-balancing`: a crash fails in-flight requests; showed a blip rather than zero effect.
- `round-robin`: heavy requests now line up on server 2 via every-third-request rotation (consecutive turns were impossible).
- `ip-hash`: "almost everyone" became 3 in 4 (N/(N+1)).
- `cache-hit-ratio`: the moment now says misses halve, then fall fivefold.
- `cache-layers`: browser added to stale copies (the one you cannot purge).
- `locality-of-reference`: caveat on the stylised 92% and a temporal-locality sentence.
- `reverse-proxy-cache`, `cooldown`, `predictive-scaling`, `warm-pool`: precision on rules, warm-up, history needs, pool cost.
- `consistent-hashing`: Data's plan should borrow the hash-mod-N replay with a "keys moved" counter (about 75% vs about 25%), virtual nodes last, and the removal beat.

## Patterns for the platform

- Replay with one variable changed shows up in nearly every plan (cooldown, flapping, stateless, cold cache, scheduled scaling); it needs deterministic, seedable event streams.
- A scale set frame whose copies carry load bars, with clone/appear/disappear and a chart strip of copy count against traffic.
- Real arithmetic on screen (ratio, 1/N, N/(N+1), miss rate); numbers should be computed by the simulation, not hand-drawn, or they drift (as flapping's did).
- Dials and toggles that change a policy (metric, thresholds, algorithm, cache on/off) while the same traffic stream replays.
- Request dots with cost (size) and a stopwatch label, plus in-flight stacks per server (round robin, least connections, draining).
- Ghost curves for history and forecast; two-lane side-by-side comparisons with a shared chart.
- Failure injection (fail a server, a region, the database) with visible in-flight loss, not a magic reroute.
