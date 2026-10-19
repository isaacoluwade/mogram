# Observability part 2: review summary

Verdicts (28 plans): Keep 20, Improved 8, Rethought 0, Merged 0.

An earlier reviewer covered the first four plans (three Keep, one Improved: `red-method`). This pass
covered the remaining 24.

## Most important changes

- `slo-burn-rate-alerting`: the slow leak was 0.5% errors (5x), below the 6x paging tier of the
  multiwindow plan. It is now 0.6% (6x, budget empty at day 5), so the two plans agree.
- `multiwindow-multi-burn-rate-alerts`: "a 6x burn pages within the hour" was wrong (its long window
  is 6 h). Now "hours", and the ending grid has a moderate-burn row. Tiers 14.4x (1h/5m), 6x (6h/30m)
  and 1x (3d/6h) were confirmed.
- `alert-fatigue`: the scoreboard said recall 0 of 1, but the real incident did page. The failure is
  that it was ignored, so recall stays 1 of 1 and precision is 2%. Deleting the wrong alert is what
  costs recall.
- `observability-cost`: keeping errors and slow traces while sampling successes needs tail sampling;
  the lever now says so.
- `telemetry-retention-tiers`: latency is kept as histograms (averaged p99s are meaningless), and the
  "retention is not backups" misconception is now addressed in the story.
- `ebpf-observability`: added how encrypted traffic is readable (hooks on the TLS library).
- `continuous-profiling`: overhead is "a few percent at most", not a flat 1%.

## Patterns for the platform

- Timeline with a movable "now" cursor and look-back brackets (alert `for:`, burn-rate windows,
  retention ageing, change markers) recurs in about a third of the plans.
- Meter and gauge pairs where an average hides a spike (USE queue, burn rate, cost bills, overhead)
  need two charts over one time axis with shared scrubbing.
- Side-by-side twin systems running the same fault with different rules (symptom vs cause, thin vs
  wide events, raw vs tiered cost) need synchronised playback and a tally.
- Regroup (alerts to incident, errors to fingerprints, events to heatmap cells) and share (flame
  boxes, bill splits) are the two new techniques; both want counts that animate during the merge.
- Threaded highlight paths across panels (metric to trace to logs, service map culprit, drill-down)
  and "cut a link" toggles that snap the path.
- Many interactions are "inject a fault and see which tool catches it"; a reusable fault picker plus
  per-tool detection light would serve most of the area.
- Numeric consistency across sibling plans (burn-rate tiers, house topology Web to API to DB with
  API also calling Payments) is the most common source of error; worth a shared constants sheet.
