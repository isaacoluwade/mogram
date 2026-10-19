# Observability part 1: review summary

33 plans: **26 Improved, 7 Keep, 0 Rethought, 0 Merged.** (The three plans reviewed earlier,
`monitoring-vs-observability`, `telemetry-signals` and `telemetry-pipeline`, are included.)
`latency-percentiles` is owned here and was kept and polished.

## Most important changes

- `latency-percentiles`: arithmetic verified (mean 124 ms; p99 about 5 s); borrowed the heavy-user burst from the scaling plan (63% of 100-request sessions hit the tail); the time chart now shows the average creeping and only the p99 leaping once slow requests pass 1%.
- `w3c-trace-context`: `tracestate` ordering was wrong (new vendor entries go at the front, not the end); trust-boundary beat names both options (ignore the flag, or start a new trace).
- `otel-collector`: removed the overstated "apps wait" and "no retry" claims; the pain is now an app-side export queue that overflows, plus per-app credentials; tail sampling needs spans routed by trace ID.
- `percentiles-from-histograms`: interpolation corrected to 2.35 s and its even-spread assumption stated; `metric-aggregation-and-rollups` no longer calls a percentile a safe rollup.
- `pii-in-logs`: counter arithmetic fixed (a scrubber only protects copies downstream of it: 6 to 2, not 3).
- `distributed-tracing` and `baggage-propagation` used edges the house system doesn't have (Payments to DB; a DB-side outbound call); both now follow Web, API, Payments, DB.
- `critical-path-analysis` gained the flip: shave the critical path far enough and it moves to the other branch.
- `exemplars` and `trace-sampling` now tie together: an exemplar is only useful if its trace was kept.
- `push-vs-pull-collection`: push gateway (batch jobs, holds last value, is scraped) separated from outbound OTLP/remote-write push.
- `otel-collector-pipeline`: processor order (memory_limiter first, batch last) made correct.

## Patterns worth knowing for the platform

- **Linked highlight** (hover a span, its service lights; click an exemplar, a trace opens) appears in about a dozen plans. It needs a shared selection state across several panels.
- **Waterfall / Gantt with draggable durations** (distributed-tracing, critical-path, trace-span, auto-vs-manual) must recompute the end marker and the critical path live.
- **Sorted-dot distributions with a draggable percentile cursor** (latency-percentiles, percentiles-from-histograms) and **bucket bins that stack and merge**; bucket interpolation needs a visible "walk to the Nth item".
- **Multiplying series** (grid, extrusion, tiling zoom-out) in metric-time-series and metric-cardinality: an element that clones per label value, with a live counter and memory bar.
- **Hop-by-hop context chips** (trace ID, span ID, baggage, sampled flag) riding request dots, sealed and unsealed at boundaries; used in six plans. Toggling "this hop drops the chip" is the repeated failure.
- **Side-by-side replay**: the same incident under the wrong and right model (regex vs fields, lost vs absorbed hiccup, head vs tail). Needs two synchronised timelines driven by one scenario.
- **Configurable assembly lines** (Collector, telemetry pipeline) with reorderable stations, toggles and a destination switch.
- **Absence made visible**: dashed outlines for lines never written, ghost pods, holes in a gauge line, dangling traces.
- Shared meters recur: a cost meter, a series counter, a copies counter, a memory bar, a retention timer.
