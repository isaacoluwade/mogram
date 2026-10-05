# Plan: traffic patterns on the arrow

Agreed with the product owner on 2026-10-05, after using capacity and concepts (Step 24). The
feedback: showing scaling took three things (scaling on the element, a scene that changes
traffic, switching scenes), "how much traffic" was set in five places, and the floating traffic
slider added complexity. Principle: **traffic belongs on the arrow, and it can change over time on
its own**; scenes are for moments (an outage, a rollback), not for load.

## The format

```yaml
connections:
  users_to_lb:
    from: users
    to: lb
    traffic: { pattern: waves, high: 5x, low: 1x, every: 10s } # or just `traffic: waves`
  orders_to_queue:
    from: orders
    to: queue
    traffic: { pattern: bursts, high: 5x, low: 0.5x, every: 12s }
  steady_line: { from: a, to: b, traffic: 2x } # steady, as before
```

- **steady** (a level, `traffic: 2x`), **waves** (quiet for half the cycle, busy for the other
  half), **bursts** (quiet, with a short spike once a cycle). Defaults: waves 1× to 5× every 10 s;
  bursts 0.5× to 5× every 12 s.
- A scene's `users_to_lb: 5x` still holds the arrow at a level for that moment.

## Behaviour

- The plan follows the pattern: at each change of phase the capacity timeline heads for the new
  plan, so copies start as a wave rises and drain as it falls (with the usual start-up and
  cool-down), and machines resize. Evaluated lazily from the time asked about, so the editor, the
  viewer, thumbnails and exports agree; animated exports with a pattern last one cycle and loop.
- Dots follow the traffic level, so the arrow visibly gets busier and quieter.

## Milestones

- [x] **P1 Core**: patterns in the format (read, write, diagnostics, diff), the engine's traffic at
      a time, the timeline advancing through phase changes; tests.
- [x] **P2 Drawing and exports**: canvases, viewer, thumbnails and exports follow patterns;
      animated exports loop one cycle.
- [x] **P3 One Traffic section on the arrow**: flow, pattern (steady, waves, bursts with high, low
      and cycle), level and share in one place; dot speed and density move to Style as look only.
      The inspector's readout describes the range ("2 copies when quiet, 8 when busy").
- [x] **P4 Remove the traffic slider** from the editor and the viewer (and its plumbing).
- [x] **P5 Concepts use patterns** where traffic changes over time (scaling, autoscaling, scale up
      vs out, queues); scenes stay for moments (failover, canary, load balancing, cold cache, a
      ceiling). Applying a concept brings its patterns to where traffic enters.
- [x] **P6 Assistant, docs, tests, screenshots, full verification.**
