# Reliability part 2: review summary

36 plans: 28 Improved, 7 Keep, 1 Merged (`split-brain`, owned by Data), 0 Rethought.
Keep: `fallback-vs-failover`, `kill-switch`, `on-call`, `toil`, `fault-injection`, `game-day`, `dr-pilot-light`.

## Most important changes

- `error-budget-burn-rate`: wrong claim fixed (14.4x burns 2% of a 30-day budget in an hour, the whole budget in about 2 days, not "a month in an hour"); alert tiers aligned with the SRE Workbook (14.4x/1h and 6x/6h page, 1x/3d ticket).
- `leader-election`: fencing token no longer increments on renewal, only when leadership changes hands (A #7, B #8, A's stale write refused).
- `heartbeat-failure-detection`: beat 4 contradicted itself; now a clean false positive with A behind a curtain so B's frames are identical in both stories.
- `failback`: old primary may hold acknowledged writes the standby never got; they are set aside before catch-up, and "don't fail back at all" is an option.
- `error-budget`: budget no longer "refills" mid-month; freeze lets urgent fixes through.
- `dns-failover`: detection delay added before the TTL wait; anycast is seconds, not the same frame.
- `automatic-vs-manual-failover`: manual's cost (slow human response) now shown; flapping gets a cooldown fix.
- `replication-is-not-backup`: restore uses point-in-time recovery (snapshot plus log), not a day-old snapshot alone.
- `dr-backup-and-restore`: backups kept outside the failed region. `dr-warm-standby`: reroute step plus a pre-scale option (static stability). `dr-testing`: now measures RPO too. `rpo-vs-rto`: brackets drawn against dashed targets.
- `mttr-mtbf-mttd`: MTTD actually appears; `ha-vs-dr`: HA failover is "a minute or so", not seconds.
- `split-brain` Merged: Data should borrow the diverged minority writes being discarded on heal (with red receipts), node-level fencing as an alternative to tokens, and the 1-1 two-node case needing a witness. Reliability's `failover` plan is kept as its own best version (async arrow, detect/decide/redirect chain, two spans).

## Patterns for the platform

- Rewind (same failure, one thing changed) appears in about half the plans; it needs to be cheap: snapshot a scene, replay with a parameter diff.
- Timeline strip with named spans (detect, decide, redirect, RPO, RTO, MTTD) is the second workhorse; spans should be draggable/dialable and able to sit against a dashed target span.
- Two-lane or two-panel side by side with a shared failure event (one trigger, two outcomes).
- Dials that drive meters and spans live (TTL, timeout, burn rate, backup frequency), with outcome thresholds (nothing / ticket / page).
- Tokens that can be refused or burst (fencing tokens, write tokens in transit, receipts that turn red).
- Hidden truth toggles ("dead" vs "just slow", "crash" vs "pause") where the viewer's frames are identical.
- Capacity/headroom meters on zones and standbys recur (multi-AZ, evacuation, active-active, warm standby).
- Scoreboards/checklists and people figures with role badges (incident, on-call, game day, postmortem).
