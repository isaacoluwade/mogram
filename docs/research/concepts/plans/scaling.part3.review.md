# Scaling, part 3: review summary

Covers `scaling.part3.md` (27 plans: doing less work per request, protecting capacity, capacity
planning and testing). An earlier reviewer finished the first 15; the last 12 were reviewed in a
second pass.

## Verdicts

| Verdict   | Count |
| --------- | ----- |
| Keep      | 1     |
| Improved  | 24    |
| Rethought | 0     |
| Merged    | 2     |

Merged: `n-plus-one-queries` (Data owns; borrow list in the review line) and `backpressure`
(Messaging owns; borrow list in the review line). `queue-load-levelling` is kept here and
Messaging's `queue-based-load-leveling` is the same concept: one should merge into the other in
`tools/catalog.py`. Reliability's `overload-and-goodput` likewise duplicates `overload`.

## Most important changes

- Numbers that did not add up were fixed: non-blocking I/O (CPU against in-flight), quotas (a
  daily quota exhausted in 21 minutes, not at 16:00), window rate limiting (a self-contradicting
  timeline), capacity planning (50,000 users at 2 req/s), right-sizing (quarter-size box with
  memory "still spare"), and headroom (the survivor ending sat at 100%, the failure it warns about).
- Rate limiting family: 429 versus 503 and Retry-After are now distinguished (throttling, load
  shedding, admission control); token bucket gets worst-case burst (size plus refill), leaky
  bucket "never above the rate" and the `nodelay` link, fixed versus sliding windows a corrected
  boundary burst.
- `queue-load-levelling` takes Messaging's side-by-side crash and equal-area shading.
- `load-shedding` gets the ghost-request image from Reliability and the priority-label point.
- Testing plans: stress test recovery is shown as a backlog of abandoned requests, soak test
  draws the rising sawtooth floor, spike test has a pass criterion, load test holds at the target.

## Patterns for the platform

- Meters and gauges dominate: load bars, depth meters, cost meters, stacked-by-tenant bars, with
  threshold lines (SLA, limit, headroom) that must be drawable over a live meter.
- Two-lane side by side under one identical stimulus (spike, zone failure, same traffic mix), with
  a toggle to flip between them, is the commonest move: it needs synchronised playback and shared
  dials.
- Charts over time with a ghost/baseline line, shaded area between two lines, and linked
  highlights between a chart and a queue or bucket on screen.
- Requests as dots with size (cost), colour (tenant, priority) and a patience ring or stopwatch
  that drains, which makes "served too late" visible.
- Fast-forward clocks and time-compressed sequences (soak, quotas, capacity planning, windows).
- A dial that drives the whole scene (load, seats, headroom, zone count, lead time) is the
  preferred interaction; "make C spike" style buttons come second.
- A reusable bucket primitive (tokens in, tokens out, fill level) serves token bucket, leaky
  bucket and retry budgets.
