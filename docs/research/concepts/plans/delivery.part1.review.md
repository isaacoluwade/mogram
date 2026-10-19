# Delivery plans, part 1: review

Stage 3 review of [`delivery.part1.md`](delivery.part1.md): the 41 plans for continuous
integration and pipeline mechanics, testing and quality, continuous delivery and release
management, and release strategies. Each plan was checked against the six questions in the
[README](../README.md#review-stage-3), against [`catalog/delivery.md`](../catalog/delivery.md), and
for consistency with [part 2](delivery.part2.md). Every plan ends with its `**Review**` line.

## Verdicts

| Verdict   | Count |
| --------- | ----- |
| Keep      | 23    |
| Improved  | 18    |
| Rethought | 0     |
| Merged    | 0     |

No id in this file is owned by another area (`tools/catalog.py` `OWNERS`), so nothing was merged.
No plan needed a full rewrite: the approaches were sound. The problems were accuracy slips,
contradictions between beats, and misconceptions that were named but never shown.

## Most important changes

- **`zero-downtime-deployment`**: reordered so the strategy switch comes first. Rolling goes on
  in beat 1 and the error counter keeps climbing, which is the misconception ("blue/green or
  Kubernetes gives you zero downtime") visibly failing. Before, the strategy came last and the
  logic was muddled.
- **`canary` and `ab-testing`**: made routing consistent and true. The canary's router is now
  sticky (otherwise "1% of traffic = 1 user hurt" is false), and A/B says stickiness is required
  for an experiment but optional for a canary. Before, the two plans contradicted each other.
  The canary also gains a coal-mine bird badge for the name, and beat 1 shows the router sets
  the share, not one card in ten (the canary vs rolling distinction).
- **`container-image-pipeline`**: fixed a logic hole. Prod deployed by digest, so a moving
  `latest` tag couldn't have reached it. The tag slide is now a replay where prod deployed by tag.
- **`feature-flags`**: the aha now says what a flag decouples (switching on vs deploying); beat 1
  shows the code merged, which defeats the feature-branch misconception; the interaction shows
  the limit (a kill switch only covers the code it wraps).
- **`monorepo-affected-builds`**: path filters don't make apps "ship broken". They skip them, so
  the apps go untested and the break surfaces later. Now a replay showing that.
- **`pipeline-as-code`**: classic pipelines do keep an edit log, so the contrast is now review,
  reason and the link to the code, not "no history".
- **`reusable-pipeline-templates`**: the cast contradicted beat 1 (copies without the step still
  got its warning), and a "v2 → v3" bump wouldn't reach pinned teams. Version pinning is now the
  interaction's trade-off.
- **`dark-launch`**: beat 1 looked just like shadow's ghost copy into a bin, the confusion the
  plan exists to defeat. It now says nothing is copied and no second version exists.
- **`progressive-delivery`**: the interaction swaps what `Shift` moves (router weight, flag
  percentage, ring) under the same loop, so "it's just canary" is answered. It now lists part 2's
  `loop` technique.
- **Numbers that didn't add up**: `test-pyramid` (300 × 90 s e2e only fits in 45 min across ten
  machines), `rolling-update` (surge-first never drops below 6 of 6), `ci-runners` (three
  runners, five jobs: two wait).
- **Smaller additions**: `continuous-integration` gains an "unseen changes" tag so the hidden
  cost visibly piles up before Friday; `merge-queue` answers "why not require up-to-date
  branches?"; `deploy-vs-release` adds routing as the second way to separate the two;
  `build-once-deploy-many` says the dependency is a range resolved at build time.
- **Shared visual language**: the Users rule now says that behind a flag, figures are tinted by
  the behaviour they get, not by the server version. `deploy-vs-release`, `feature-flags` and
  `dark-launch` already worked that way. The release-strategies intro no longer claims every
  plan uses the traffic view.

## Patterns for the platform (stage 4)

- **Replay is the workhorse.** 18 of 41 plans rewind (⟲) and rerun with exactly one thing
  changed, and 8 show a faded "ghost" run, lane or panel alongside the real one. The platform
  needs a scenario that can be snapshotted, re-run with one parameter flipped, and shown next to
  its previous run in step.
- **Viewer switches are scenario parameters, not scenes.** 21 plans have toggles and 17 have
  dials ("stub side effects", "rebuild in deploy", the four zero-downtime switches, flake rate,
  bake time). Most change _what happens next_, so the story has to be recomputed from
  parameters. Swapping between pre-drawn end states isn't enough.
- **Numbers drive the picture.** Stopwatches, timers or clocks appear in 24 plans, and meters
  or counters in 25. Several errors found in review were arithmetic (Gantt totals, test-suite
  times, capacity floors). If concepts declare durations and counts as data and the platform
  computes the totals, these errors can't happen.
- **Identity that travels.** The sealed artifact (`9c2e`) moves across job walls, shelves and
  environment zones, and a rebuild must visibly get a new seal (6 plans). Elements need a
  stable identity, a visible fingerprint and the ability to move between containers.
- **Status propagates through a graph.** Step → job → stage → dependents turning red or dashed
  grey ("stop the line"), and gates that drop a bar. That needs graph-aware state propagation,
  not per-element styling.
- **The crowd is a population.** Release strategies tint 1 of 100 figures, a growing patch, or
  everyone. Sticky vs per-request assignment matters for accuracy. A crowd primitive with
  assignment rules (by share, by cohort, by flag) would serve canary, A/B, rings, flags and dark
  launch.
- **Lanes and time axes.** 14 plans use lanes, and half of those run along a day, week, month or
  year ruler or a Gantt axis. Lanes over time are a core layout, not a special case.
- **Lint the plan itself.** The most common flaw was a misconception named but never defeated
  by a beat (4 plans), followed by beats contradicting the cast. When concepts are authored,
  a check that each misconception maps to a beat would catch it.
- **Neighbours share moments by design.** The "same commit, two seals" contrast appears in
  `pipeline-artifacts`, `build-once-deploy-many`, `container-image-pipeline` and
  `environment-promotion`, each with a different cause (rebuild, version range, base image,
  branch per environment). One reusable "compare seals" component would serve all four.
- **Length.** These plans run about 280–430 words by raw count (field labels included), above
  the README's 150–300. The ten-field template seems to need about 300 words for a
  release-strategy story, so the guideline may want revisiting rather than enforcing.
