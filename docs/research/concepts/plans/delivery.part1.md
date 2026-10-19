# Delivery plans, part 1

Stage 2 plans for the first four groups of [`catalog/delivery.md`](../catalog/delivery.md):
continuous integration and pipeline mechanics, testing and quality, continuous delivery and
release management, and release strategies. Part 2 covers the remaining groups with the same
visual language.

## Shared visual language

Every delivery diagram reads **left to right, from the change to the user**. Moving right means
going forward. Anything moving right to left means going back: a rollback, or feedback returning
to a developer.

**Two standard layouts**

- **Pipeline view**: developers and the repo on the left, the pipeline as a horizontal conveyor
  in the middle, environment zones on the right (`dev`, `test`, `staging`, `prod`, in that
  order).
- **Traffic view**: a crowd of users on the left, a router in the middle, the running versions
  on the right. Every release strategy uses it.

**Elements**

| Element         | Looks like                                                                                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Developer       | Small figure at a laptop. Each developer's branch has an accent colour (teal, orange, pink), never a version or status colour.                                                                                                                  |
| Repo and `main` | Folder-shaped box labelled `repo`. `main` is a thick grey line; commits are dots on it, newest on the right.                                                                                                                                    |
| Change          | A commit dot becomes a small tag with a short hash (`a1f3`) when it enters the pipeline.                                                                                                                                                        |
| Pipeline        | A conveyor of stage boxes (`Build → Test → Deploy` …) on one track. The belt moves only while work moves.                                                                                                                                       |
| Status          | A ring around a stage, job or step: grey idle, amber spinning running, green ✓ passed, red ✗ failed, dashed grey skipped.                                                                                                                       |
| Gate / check    | A post on the track whose badge turns ✓ green or ✗ red; when closed, a bar drops across the track. A manual approval is a gate with a person icon and a stamp.                                                                                  |
| Stop the line   | Red ✗, the bar drops, the belt halts, everything downstream turns dashed grey.                                                                                                                                                                  |
| Artifact        | A cardboard package labelled with name and version (`shop 1.4.2`) and a round wax seal showing its digest (`9c2e`). Same seal means byte-identical; any rebuild gets a new seal. A container image is the same package drawn as stacked layers. |
| Runner          | Small machine box with a fan icon and a `workspace` tray holding file chips.                                                                                                                                                                    |
| Store / cache   | A shelf or cabinet with labelled slots or drawers.                                                                                                                                                                                              |
| Environment     | Dashed, labelled zone. `prod` is the largest, has a solid border and sits next to the user crowd. Its configuration is a sticky note pinned to the zone.                                                                                        |
| Instance        | Rounded server card filled with its version's colour and labelled (`v1`, `v2`).                                                                                                                                                                 |
| Versions        | **v1 blue** (current, stable), **v2 violet** (new). A bad v2 stays violet with a red ✗ badge and red cracks.                                                                                                                                    |
| Users           | A crowd of 50–100 small figures, each tinted the colour of the version serving them; behind a feature flag, the colour of the behaviour they get (old path blue, new path violet). A hurt user gets a red `!` bubble.                           |
| Requests        | Small dots streaming along paths. Density shows volume, colour shows which version served it, red dots are errors.                                                                                                                              |
| Router          | Rounded hexagon (`router` or `LB`) with a percentage on each outgoing path.                                                                                                                                                                     |
| Health meter    | Small vertical bar beside each version (error rate or latency) with a dashed red threshold line: green below, red above.                                                                                                                        |
| Feature flag    | Pill toggle labelled with the flag name: knob right and green when on, left and grey when off.                                                                                                                                                  |
| Time            | A stopwatch top right for elapsed time; a day ruler across the top for longer spans.                                                                                                                                                            |
| Rewind          | A ⟲ icon: the scene snaps back to an earlier frame and replays with one thing changed.                                                                                                                                                          |

**Captions** sit bottom centre, one short line, and appear with their beat. **Key moments** run
at half speed with everything else dimmed. **Failures** flash red and shake once, then hold
still so the viewer can look.

**New technique** used in these plans: **replay**: the same scenario runs again from a rewind
with exactly one thing changed (the fix, the other strategy, the missing safeguard), so that
one thing is visibly the whole difference.

## Continuous integration and pipeline mechanics

### Continuous integration (`continuous-integration`)

**The aha**: Merging small changes into main every day, each one built and tested on push, keeps every integration tiny; waiting turns integration into a big bang.
**Misconception to defeat**: "We do CI: a server builds every feature branch." Branches that are green on their own but unmerged for weeks aren't integrated at all.
**Cast**: Two stacked panels, each with `main` as a thick grey line and three developers (teal, orange, pink) whose branches peel off it. A small CI status ring sits on every branch and on `main`. Each top-panel branch carries an "unseen changes" tag: lines its teammates have changed that it hasn't merged. A day ruler (Mon–Fri) runs across the top; each panel has a conflict counter.
**Opening frame**: Top panel "Merge at the end", bottom panel "Merge every day". Both start Monday from the same commit; nothing has diverged yet.
**Story**:

1. The days tick. Top: three branches grow long, every CI ring green ✓, while each "unseen changes" tag climbs: 40, 120, 300 lines. Caption "Every branch green…"
2. Bottom: each developer makes a short branch and merges back within hours; each merge runs CI on `main` ✓. Caption "Merge small, merge often".
3. Bottom, Wednesday: one merge turns `main` red ✗. A "fix first" banner appears, the next merge waits, the teal developer pushes a fix in minutes, green again. Caption "Red main? Fix it first."
4. Top, Friday: all three branches merge at once and a week of unseen changes meets in one place. Overlapping edits collide, 14 conflict chips burst from the merge point, and `main` goes red and stays red into next week. Caption "…but never integrated."
5. Counters side by side: top 14 conflicts at once; bottom zero or one per merge, each fixed within the hour.

**The moment**: Beat 4 at half speed: three long green branches, their tags at 300 lines, meet and turn red together, while the bottom panel's `main` is an unbroken row of green dots.
**Interaction**: A dial "merge every: 2 hours / day / week / month". Conflict chips and time-to-green grow with the gap: integration cost grows with the time between merges.
**Ending**: Holds on both `main` lines, bottom all green, top a red pile-up. Caption "Integrate daily. Keep main working."
**Variants**: `ci-cd-pipeline`, `pull-request-checks`, `merge-queue`, `continuous-delivery-vs-deployment`; trunk-based development (Git).
**Techniques**: lanes, side by side, timer, restyle, failure, meter, dial, caption.
**Review**: Improved — added an "unseen changes" tag on each long branch, so the hidden cost visibly piles up while every ring is green instead of appearing from nowhere on Friday. Weighed a single-panel "conflicts grow with divergence" chart; the two-panel week is more concrete, and the dial already gives the curve.

### CI/CD pipeline (deployment pipeline) (`ci-cd-pipeline`)

**The aha**: Every change rides the same line of stages, cheap fast checks first and slow realistic ones later, and any failure stops the line before it reaches users.
**Misconception to defeat**: A pipeline is one build script that passes or fails as a whole.
**Cast**: Pipeline view. Stages `Build`, `Unit tests`, `Integration`, `Staging + acceptance`, `Prod`, each test box as wide as it is slow, with a duration under it (build 1 min, unit 1 min, integration 8 min, acceptance 15 min). A confidence bar rides above the travelling package. Prod zone with the user crowd, all blue.
**Opening frame**: The idle conveyor, durations visible, prod serving blue users. Caption "Every change takes this path."
**Story**:

1. A developer pushes; tag `a1f3` drops onto the belt; `Build` turns it into a sealed package. Caption "Build it once".
2. The package clears each stage in turn; the confidence bar fills in steps (25%, 50%, 80%); it lands in prod and users turn violet. Caption "Each stage adds confidence."
3. Change `b7e0` fails unit tests at minute 2: red ✗, the bar drops, downstream greys out, and a red arrow runs right to left back to the developer. Stopwatch "feedback: 2 min". Caption "Fail fast, fail cheap."
4. Change `c4d2` passes unit tests but fails acceptance in staging at minute 20: a bug only a realistic environment shows. The line stops there; prod users stay unaffected. Caption "Failures never reach users."
5. Ten changes stream through quickly; red ✗s pile up at different gates, and prod receives only the ones that cleared everything.

**The moment**: Beat 3: the bar slamming down two minutes in while prod's crowd stays untouched; the fast stage sits first precisely so this is cheap.
**Interaction**: Plant a bug (typo, broken API call, slow query) and see which stage catches it and how long the feedback takes. Then drag the 15-minute stage to the front: every failure now takes 15 minutes to report.
**Ending**: Loops as a steady stream of changes; most flow through, a few stop at gates. Caption "Only what passes everything ships."
**Variants**: `pipeline-stages-jobs-steps`, `test-pyramid`, `quality-gates`, `environment-promotion`, `continuous-delivery-vs-deployment`.
**Techniques**: token, meter, restyle, failure, timer, spotlight, replay, choice, caption.
**Review**: Keep — widths-as-durations plus the 2-minute and 20-minute failures show both halves of the idea (cheap first, realistic later, the line stops); a "funnel of changes" framing was weighed but loses the stage order, which is the point. Durations check out (1+1 min to the unit failure).

### Stages, jobs and steps (`pipeline-stages-jobs-steps`)

**The aha**: Steps in one job share one machine and its files; each job gets its own machine, so files cross job boundaries only as artifacts or outputs.
**Misconception to defeat**: The whole pipeline runs on one big shared disk, so a file built in one job is still there in the next.
**Cast**: Nested boundaries. Stage lanes `Build`, `Test`, `Deploy`. Job cards inside them (`build`; `unit` and `lint` side by side; `deploy`), each sitting on its own runner with a workspace tray. Steps as numbered rows inside each job card. Dependency arrows between jobs. An artifact shelf below the lanes.
**Opening frame**: The job graph: `build` → `unit` + `lint` → `deploy`, all grey.
**Story**:

1. Zoom into `build`: steps `checkout`, `install`, `compile` tick green in order; `compile` drops a `dist/` chip into the workspace tray. Caption "Steps share one machine."
2. Zoom out. `build`'s runner slides away and is wiped. Two fresh runners slide in for `unit` and `lint`, which start at the same moment. Caption "Each job gets a fresh machine."
3. `unit`'s step `run tests` reaches for `dist/`: the tray is empty. Red ✗ "dist/ not found". Job red, stage red, `deploy` dashed grey. Caption "Files don't follow you."
4. ⟲ Replay with two added steps: `build` ends with `upload artifact` (the chip becomes a parcel on the shelf); `unit` starts with `download artifact` (parcel to tray). Green. Caption "Pass files as artifacts."
5. In `lint`, step 2 exits with code 1: that step red, steps 3–4 skipped, job red. Caption "Any step exits non-zero: job fails."
6. Fix lint; `deploy` waits for both test jobs, then runs. Caption "Jobs wait on their dependencies."

**The moment**: Beat 2 into 3, half speed: the camera follows the `dist/` chip as its runner is wiped, then shows the new runner's empty tray.
**Interaction**: Toggle the upload/download steps; click any step to make it exit 1 and watch skip and fail propagate up through job, stage and dependents.
**Ending**: The full graph green, with the parcel the only thing that crossed between machines.
**Variants**: `pipeline-artifacts`, `pipeline-parallelism-matrix`, `ci-runners`, `ci-cd-pipeline`.
**Techniques**: zoom, boundary, contents, appear/disappear, token, failure, restyle, replay, toggle, caption.
**Review**: Keep — the wiped runner and the empty tray are exactly the misconception breaking, and the upload/download replay is the fix in one change. Weighed a "rooms and a mailroom" metaphor; the runner tray is already literal and reuses the area's runner element.

### Pipeline triggers (`pipeline-triggers`)

**The aha**: Different events start different runs that do different work: a pull request validates, a push to main makes something releasable, a schedule catches rot, and filters decide what doesn't run.
**Misconception to defeat**: "The pipeline runs on push": one trigger, one run that always does everything. Or that a trigger _is_ a webhook (it's only how the event arrives).
**Cast**: A column of event sources on the left: PR card, push-to-main commit dot, clock `02:00`, manual button, a small upstream pipeline, a new-package icon. One pipeline definition card `ci.yml` in the middle. On the right, run rows as lanes, each showing which stages light up: `build`, `test`, `scan`, `publish`, `deploy dev`.
**Opening frame**: Six unlit sources wired to the one definition. No runs yet.
**Story**:

1. A PR opens; an envelope labelled `webhook` carries the event in. A run row appears: `build` and `test` light; `publish` and `deploy` are dashed (skipped). A ✓ is posted back onto the PR card. Caption "PR: prove it before merge."
2. A merge pushes to main: a longer row, through `publish` (a package appears) and `deploy dev`. Caption "Main: make it releasable."
3. 02:00, no commits today: the nightly row runs the full suite plus a dependency scan, and goes red ✗: a library was found vulnerable overnight. Caption "Schedule: catch rot nobody touched."
4. The upstream library's pipeline finishes and starts this one. Caption "One pipeline can start another."
5. A push changes only `docs/README.md`. A path filter funnel (`paths: src/**`) catches the envelope and it fizzles; no row. Caption "Filters decide what doesn't run."

**The moment**: Beat 3: a red run on a day with zero commits. The code didn't change; the world did.
**Interaction**: Pick an event and a changed file and see which row appears (or doesn't); edit the branch and path filters and watch events get dropped.
**Ending**: The stacked rows show different shapes from one file: short PR runs, longer main runs, the full nightly.
**Variants**: `pull-request-checks`, `pipeline-as-code`, `monorepo-affected-builds`, `automated-dependency-updates`.
**Techniques**: lanes, token, restyle, failure, choice, appear/disappear, caption.
**Review**: Keep — one file, differently shaped run rows per event is the right picture, and the red nightly on a day with no commits is a memorable "the world changed" moment. Weighed a switchboard framing; the rows show _what work_ each trigger does, which a switchboard doesn't.

### Pipeline as code (`pipeline-as-code`)

**The aha**: The pipeline is a file in the repo, so a pipeline change travels in the same pull request as the code it builds, with a diff, a review, history and a revert.
**Misconception to defeat**: The pipeline is settings clicked into a CI website, living apart from the code.
**Cast**: Side by side. Left "Clicked": a CI web console window of dropdowns and checkboxes, floating outside the repo's boundary. Right "In the repo": the repo boundary containing `src/` and a file card `ci.yml`. Both run the same `Build → Test → Deploy` pipeline.
**Opening frame**: Both sides green. The only visible difference is where the configuration lives: outside the boundary or inside it.
**Story**:

1. A feature needs Node 22. Right: one PR card holds two diffs, `src/app.ts` and `ci.yml` (`node: 20` red, `node: 22` green). A reviewer approves; merge; the pipeline builds with 22. Caption "Code and pipeline change together."
2. Left: the code goes in a PR, but someone separately clicks the console's dropdown to 22. An old release branch that still needs 20 instantly goes red ✗. Caption "One setting for every branch."
3. A week later the deploy stage misbehaves. Right: `ci.yml`'s history scrolls out as a lane of commits, each with an author, a message and the PR it was reviewed in; click revert, the old file returns, green. Left: the console's change log says only "edited by admin, Tue": no review, no reason, no link to the code it served, and a grey "?" over "why?". Caption "History, review, revert."
4. Right: the old release branch carries its own `ci.yml` from its day and still builds as it did.

**The moment**: Beat 3 side by side: a reviewed, explained history on the right; an unexplained edit on the left.
**Interaction**: Make the same change in both worlds, then try to answer "who changed this, and why?" Only one side can.
**Ending**: The repo boundary holding code and pipeline together, both green. Caption "The pipeline is code."
**Variants**: `reusable-pipeline-templates`, `pipeline-stages-jobs-steps`, `infrastructure-as-code`.
**Techniques**: side by side, boundary, contents, restyle, lanes, failure, caption.
**Review**: Improved — corrected beat 3: classic pipelines (Azure DevOps, Jenkins with plugins) do keep an edit log, so the contrast is now review, reason and the link to the code, not "no history at all". Weighed making the release branch (beats 2 and 4) the moment; kept history/revert because it's the catalog's stated idea.

### Runners and agents (`ci-runners`)

**The aha**: Runners are separate machines that pull jobs from a queue one at a time; hosted ones are someone else's to maintain, while self-hosted ones sit in your network, reach private things, and are yours to patch.
**Misconception to defeat**: The CI server runs your build itself, or pushes work into machines.
**Cast**: Top: a cloud `CI service` holding a queue of five job cards. Bottom left: a boundary "Provider's cloud" with two hosted runners. Bottom right: a boundary "Your network" with a firewall edge, one self-hosted runner, a private database and a GPU box.
**Opening frame**: Queue full, runners idle, each with a small antenna.
**Story**:

1. Dotted "any work?" arrows go _outward_ from each runner to the CI service; the self-hosted one's passes out through its firewall, which needs no inbound opening. A job card drops into the first runner to ask, which turns amber. Caption "Runners ask for work. Nothing dials in."
2. Every runner takes one card; the last two jobs wait until one frees up. Caption "One job per runner."
3. A hosted runner finishes; the machine dissolves and a clean one appears in its place. Caption "Ephemeral: fresh machine, every job."
4. Job `migrate-db` needs the private database. On a hosted runner, its arrow stops at the firewall, red ✗. ⟲ Replay on the self-hosted runner: straight through, ✓. Caption "Self-hosted reaches private networks."
5. A "patch me" badge and a CVE warning appear on the self-hosted runner, and its tray still holds files from the last job. A wrench labelled "your team" hangs on it. Caption "…and you maintain it."

**The moment**: Beat 4: the same job on two runners, blocked at the firewall on one, straight through on the other.
**Interaction**: Drag jobs (plain build, needs GPU, needs private DB) onto a hosted or self-hosted runner and see which succeed.
**Ending**: The queue drains; hosted runners keep recycling, the self-hosted one keeps its maintenance badge.
**Variants**: `pipeline-stages-jobs-steps`, `pipeline-parallelism-matrix`, `pipeline-secrets`, `pipeline-oidc-federation`.
**Techniques**: contents, token, boundary, appear/disappear, failure, replay, restyle, choice, caption.
**Review**: Improved — beat 1 now says why pulling matters (the self-hosted runner only calls out, so the firewall needs no inbound hole), which links the misconception to beat 4; fixed the queue count (three runners, five jobs: two wait). Weighed a hosted-vs-self-hosted comparison table; the firewall replay is the stronger picture.

### Build and dependency caching (`build-caching`)

**The aha**: The cache key is a hash of the inputs: same lockfile, same key, skip the work; change the lockfile and the key changes, so the cache misses and rebuilds.
**Misconception to defeat**: The cache is a magic speed-up that might be stale, or the same thing as an artifact.
**Cast**: A runner with an empty `node_modules/` folder; a `package-lock.json` card; a small hashing funnel that prints a key tag; a cache cabinet whose drawers are labelled by key; the public package registry as a distant cloud; a stopwatch.
**Opening frame**: Run 1 about to start. The cabinet has no drawers.
**Story**:

1. The lockfile drops into the funnel; out comes key `7f3a`. The cabinet has no `7f3a` drawer: grey "miss". 800 package dots stream in from the registry. Stopwatch 3:00. After the job, the folder is filed into a new drawer `7f3a`. Caption "Miss: download, then save."
2. Run 2 changes only app code. Same lockfile, same key `7f3a`: the drawer opens and the folder lands in one block, ✓ "hit". Stopwatch 0:10. Caption "Same inputs, same key."
3. Run 3 bumps one dependency. One line of the lockfile changes; the key becomes `b21c`; miss, download, new drawer. Caption "Inputs changed, key changed."
4. A teammate's laptop and a second runner both reach into the same cabinet and hit. Caption "A remote cache is shared."
5. Beside the cabinet, an `artifacts` shelf receives the built package. Caption "Cache: inputs, for speed. Artifact: output, to ship."

**The moment**: Beat 3, half speed: one character changes in the lockfile, the key's text changes with it, and the lookup slides past the old drawer.
**Interaction**: Edit the lockfile or a source file and predict hit or miss; only the inputs that feed the key matter.
**Ending**: Three runs on a timeline with their times: 3:00, 0:10, 3:00.
**Variants**: `monorepo-affected-builds`, `pipeline-artifacts`, `ci-runners`.
**Techniques**: token, stream, contents, restyle, timer, choice, caption.
**Review**: Keep — the visible hash funnel makes "keyed by inputs" literal, and beat 3's one-character lockfile change answers the "might be stale" worry directly. Weighed adding restore-keys (partial fallback); left out as a second idea.

### Parallel jobs and matrix builds (`pipeline-parallelism-matrix`)

**The aha**: Jobs that don't depend on each other run at the same time, so wall-clock time is the longest path through the job graph, not the sum of all jobs.
**Misconception to defeat**: More jobs means a longer pipeline; or speeding up any job speeds up the run.
**Cast**: Time-axis lanes (a Gantt chart): bars `build` 2 min, `unit` 4 min, `lint` 1 min, `e2e` 8 min, `deploy` 1 min. A stopwatch. A matrix card `os: [linux, windows, mac] × node: [20, 22]`.
**Opening frame**: All bars end to end in one lane. Stopwatch 16 min. Caption "One after another: 16 min."
**Story**:

1. After `build`, `unit`, `lint` and `e2e` lift into their own lanes and start together; `deploy` waits for all three. Stopwatch drops to 11 min. Caption "Fan out, fan in."
2. A path trace lights `build → e2e → deploy`; `unit` and `lint` dim. Halving `lint` changes nothing on the stopwatch. Caption "The longest path sets the time."
3. `e2e` splits into four 2-minute shards on four runners. Stopwatch 7 min. The highlight jumps to `build → unit → deploy`. Caption "Shard the slow one."
4. The matrix card clones one `test` job into a 3×2 grid running at once; `windows / node 22` turns red ✗. Caption "One definition, six combinations."

**The moment**: Beats 2–3: the critical-path highlight jumping from `e2e` to `unit` once `e2e` is sharded.
**Interaction**: Drag bar lengths and shard counts; the stopwatch and highlighted path update live. A "max concurrent jobs: 2" dial makes bars queue, showing a concurrency limit is a separate thing.
**Ending**: The 7-minute chart over a faded ghost of the 16-minute one.
**Variants**: `pipeline-stages-jobs-steps`, `ci-runners`, `build-caching`, `monorepo-affected-builds`.
**Techniques**: lanes, timer, path trace, spotlight, clone, failure, dial, side by side, caption.
**Review**: Keep — the Gantt numbers are consistent (16 → 11 → 7 min) and the critical-path highlight jumping after sharding is the clearest possible proof of "longest path, not sum". Weighed splitting the matrix into its own beat sequence; it fits as the fourth beat because it's the same fan-out.

### Pipeline artifacts (`pipeline-artifacts`)

**The aha**: An artifact is a file a job publishes so later jobs, stages and people use exactly that file: the thing that was tested is the thing that gets deployed.
**Misconception to defeat**: Each later stage can just check out the code and build it again: same commit, same thing.
**Cast**: Pipeline view with three separate runners, `Build`, `Test` and `Deploy`, divided by walls (job boundaries). Below them, a shelf labelled `run #412`. The package `shop 1.4.2` with seal `9c2e`; a test-report clipboard; the prod zone.
**Opening frame**: Three machines behind their walls, an empty shelf, prod running the previous version.
**Story**:

1. `Build` compiles; the sealed package appears and drops onto the shelf. The runner disappears. Caption "Publish what you built."
2. `Test` lifts the package off the shelf and tests it; a ✓ stamps onto seal `9c2e`. It also files a test-report clipboard on the shelf. Caption "Later jobs use the same file."
3. `Deploy` takes the same package to prod; the prod instance now shows seal `9c2e` ✓. Caption "What you tested is what ships."
4. ⟲ Replay where `Deploy` rebuilds from source instead: a new package rolls out with seal `a77b`, no ✓, tagged "never tested". Caption "Rebuild = something untested."
5. A reviewer opens the clipboard from the shelf: artifacts are for people too. Caption "Reports and plans travel the same way."

**The moment**: Beat 4: seal `9c2e` with its test ✓ beside seal `a77b` with nothing, both claiming to be `shop 1.4.2`.
**Interaction**: Toggle "rebuild in deploy" and watch the prod seal change and lose its ✓.
**Ending**: The shelf holding package and report; prod showing `9c2e` ✓.
**Variants**: `artifact-repository`, `build-once-deploy-many`, `build-caching`, `pipeline-stages-jobs-steps`.
**Techniques**: token, boundary, contents, replay, side by side, toggle, restyle, caption.
**Review**: Improved — dropped "artifacts and caches are the same" from the misconception: no beat defeated it here, and `build-caching` beat 5 owns that contrast. Weighed folding this concept into `build-once-deploy-many` (both use the rebuilt-seal replay); kept separate because here the walls between runners and the run's shelf are the subject, and why a rebuild differs is left to that plan.

### Artifact repository and package feeds (`artifact-repository`)

**The aha**: Built packages are published once into a versioned store that never overwrites them, and the store proxies public registries so your builds keep working when the internet doesn't.
**Misconception to defeat**: It's another source-control system; or `1.4.3` can be quietly replaced with a fixed `1.4.3`.
**Cast**: A warehouse shelf `feed: shop` with version slots `1.4.0`, `1.4.1`, `1.4.2`, each holding a sealed package behind a small padlock. A pipeline on the left publishing; consumer builds on the right. A second section "proxied from npmjs" connected through an `upstream` door to a public registry cloud.
**Opening frame**: Three locked versions; a consumer build pulling `1.4.1`.
**Story**:

1. The pipeline publishes `1.4.3`; it slides into a new slot and the padlock clicks. Caption "Publish once."
2. Someone republishes `1.4.3` with a fix: the package bounces off, red ✗ "1.4.3 already exists". They publish `1.4.4`. A consumer pinned to `1.4.3` still gets the same seal. Caption "Never overwritten."
3. A build asks for `left-pad 1.3.0`; the request passes through the upstream door, and a copy lands on the proxy shelf on its way back. Caption "Upstream: cache public packages."
4. The public registry goes dark, and the package is unpublished there. The next build still turns green, served from the proxy shelf. Caption "Registry down? Builds still work."
5. A `@release` view label moves onto `1.4.4` after its tests pass; old unpromoted dev builds fade from the shelf. Caption "Promote with views, retire with retention."

**The moment**: Beat 4: the public cloud greyed out with a red ✗ while the build beside it stays green.
**Interaction**: A "take the registry down" toggle, and an "overwrite 1.4.3" button that always bounces.
**Ending**: Locked versions, a stocked proxy shelf, consumers green.
**Variants**: `pipeline-artifacts`, `semantic-versioning`, `container-image-pipeline`, `automated-dependency-updates`.
**Techniques**: contents, token, failure, restyle, toggle, appear/disappear, caption.
**Review**: Keep — padlocked slots and the bounced republish make immutability physical, and the green build beside a dark registry is the proxy's whole case. Weighed cutting beat 5 (views and retention) for economy; kept as one short beat because both are in the catalog row and AZ-400 tests them.

### Pull request validation checks (`pull-request-checks`)

**The aha**: CI runs on every pull request against the would-be merge result, and branch protection keeps the merge button locked until checks and reviews pass, so problems stop before main.
**Misconception to defeat**: The check tests your branch on its own; or that review alone keeps main safe.
**Cast**: Lanes: `main` and a teal feature branch. A PR card listing checks (`build`, `tests`, `review`) and a merge button. A shield on `main` (branch protection). A dashed ghost commit: the merge preview of branch + main's tip.
**Opening frame**: A three-commit branch with its PR open; checks pending; merge button greyed; shield glowing on `main`.
**Story**:

1. Since branching, `main` gained a commit renaming `getUser` to `fetchUser`. CI builds the ghost merge commit, not the branch. Caption "CI tests the would-be merge."
2. Side by side: "branch alone" ✓ (faded, not what runs) versus "merged result" ✗ "getUser is not defined". The `tests` check turns red. Caption "Your branch alone isn't enough."
3. The viewer's cursor tries the merge button; it shakes: "required check failed". Caption "Red check: merge blocked."
4. The developer pushes a fix; checks rerun on a fresh merge preview, green. A reviewer approves; the button turns green. Caption "Checks and review: unlocked."
5. Merge. `main`'s own CI ✓. Caption "Main stays green."

**The moment**: Beat 2: the same code, two answers. Only the merged result tells the truth.
**Interaction**: Turn "require checks" off in branch protection, merge the red PR, and watch `main` go red for everyone.
**Ending**: `main` as a row of green dots, the PR card marked merged.
**Variants**: `merge-queue`, `continuous-integration`, `pipeline-triggers`; branch protection (Git).
**Techniques**: lanes, side by side, restyle, failure, toggle, caption.
**Review**: Keep — "branch alone ✓, merged result ✗" is the exact misconception, and it's technically right (PR builds check out the merge ref). The `getUser → fetchUser` rename carries straight into `merge-queue`, where the same break arrives from a PR in flight. Weighed a reviewer-only counterfactual; the interaction's "require checks off" already covers it.

### Merge queue (`merge-queue`)

**The aha**: Two pull requests can each pass alone and still break main together; a merge queue tests each one on top of main plus everything queued ahead of it, the exact sequence that will land.
**Misconception to defeat**: If every PR's checks are green, merging them all is safe.
**Cast**: `main`; PR A (teal) renames `getUser` to `fetchUser` everywhere; PR B (orange) adds a new call to `getUser`. Both PR cards show green checks, tested against the same old tip. A queue track with slots, each slot showing the stack it tests (`main + A`, `main + A + B`).
**Opening frame**: Two green PR cards side by side, each with a thin line back to the same `main` commit.
**Story**:

1. Without a queue: A merges. B's checks are still green (from stale `main`), so B merges too. `main`'s CI: red ✗ "getUser is not defined"; everyone's work is blocked. Caption "Both green. Together: broken."
2. ⟲ Replay with a queue. A and B enter; the queue builds `main + A` and `main + A + B` at the same time. Caption "Test what will actually land."
3. `main + A` ✓, so A merges. `main + A + B` ✗, so B pops out of the queue and back to its author with the failure; `main` never sees it. Caption "B bounces. Main stays green."
4. B is fixed to call `fetchUser`, re-queued as B′: `main + A + B′` ✓, merged.

**The moment**: Beats 1 and 3 side by side: the same two PRs, `main` red without the queue and green with it.
**Interaction**: Add a third PR or reorder the queue; watch which stacks get built and which PR bounces. Swap the queue for "require branches to be up to date": also safe, but each PR must rebase and re-run in turn, and a clock shows how much later the same PRs land.
**Ending**: `main` green with A and B′ landed in order.
**Variants**: `pull-request-checks`, `continuous-integration`, `monorepo-affected-builds`.
**Techniques**: lanes, contents, side by side, replay, failure, move, choice, caption.
**Review**: Improved — the interaction now answers the obvious "why not just require up-to-date branches?": that's safe too, but serial; the queue builds the stacks in parallel. Weighed a busy-repo version with ten PRs; two PRs with one rename keeps the cause readable.

### Reusable pipeline templates (`reusable-pipeline-templates`)

**The aha**: Many pipelines call one shared template, so fixing or hardening it once fixes every pipeline that uses it.
**Misconception to defeat**: Copy-pasting good YAML between teams gives you the same thing.
**Cast**: Side by side. Left "Copy-paste": six team pipelines, each with its own copy of the build steps, already drifting (two run older versions of them, in slightly different orders). Right "Template": six team pipelines, each linked by a thin line to one central card `secure-build` owned by a platform team.
**Opening frame**: Both sides, twelve green pipelines.
**Story**:

1. A flaw is found in the shared build step (an outdated scanner that misses a class of vulnerabilities). A red warning appears on that step in all twelve pipelines. Caption "A fix is needed everywhere."
2. Right: the platform team edits the template once. A pulse runs down all six link lines; all six turn green together. Caption "Fix once, every pipeline inherits."
3. Left: the fix is applied by hand, one team at a time, over a day ruler. Four teams patch over two weeks; two never hear about it and stay red. Caption "Six copies, six fixes… maybe."
4. Right: one team plugs an extra `e2e` step into a marked extension slot of the template; the mandatory steps around it stay locked. Caption "Extend, don't copy."

**The moment**: Beats 2 and 3 running at once: one pulse finishing in seconds against a patchwork that never completes.
**Interaction**: Press "update template" and watch the pulse; pin one team to an exact old version and see it stay red until it moves up: a pin buys stability at the price of not inheriting fixes.
**Ending**: Right side six green, left side two still red.
**Variants**: `pipeline-as-code`, `devsecops-pipeline`, `platform-engineering`; `iac-modules` (the same idea for infrastructure).
**Techniques**: side by side, token, restyle, timer, failure, toggle, caption.
**Review**: Improved — fixed a contradiction: the old cast had two copies with no scan step, yet beat 1 warned all twelve; and "v2 → v3" in beat 2 would not reach teams pinned to v2. Now the template is unversioned in the story and pinning is the interaction's trade-off. Linked `iac-modules`. Weighed a single-panel version; the simultaneous pulse vs. patchwork is the moment and needs both sides.

### Affected builds in monorepos (`monorepo-affected-builds`)

**The aha**: The build tool follows the dependency graph: a change rebuilds the changed project and everything that depends on it, and everything else comes from cache.
**Misconception to defeat**: A monorepo means building everything on every change; or folder path filters do the same job.
**Cast**: A graph of project nodes: libraries `ui-kit` and `utils`; apps `web`, `admin`, `api`; `docs`. Arrows point from each app to the libraries it uses (`web → ui-kit`, `admin → ui-kit`, `web → utils`, `api → utils`). A cache cabinet; a stopwatch.
**Opening frame**: The graph with every node grey and a cached ✓. Caption "Six projects, one repo."
**Story**:

1. A ghost run: a change to `ui-kit` and every node rebuilds. Stopwatch 20 min. Caption "Build everything: 20 min."
2. The real run: `ui-kit` turns amber; a wave climbs back along the arrows to `web` and `admin`, which turn amber. `utils`, `api` and `docs` stay grey and collect "cache hit" chips. Stopwatch 6 min. Caption "Rebuild only what's affected."
3. ⟲ Replay with folder path filters instead (`apps/web/**`, `apps/admin/**`): the change is under `libs/ui-kit/`, so neither filter matches. `web` and `admin` are never rebuilt or tested against the new `ui-kit`, and a dashed crack waits in each for the next unrelated change to find. Caption "Folders don't know dependencies. Graphs do."
4. A change to `docs`: only `docs` lights. Stopwatch 1 min.
5. A developer's laptop pulls `utils`'s outputs straight from the shared cache. Caption "Shared cache: built once, anywhere."

**The moment**: Beat 2: the wave climbing exactly the arrows from `ui-kit` and stopping where they end.
**Interaction**: Click any node to "change" it and see its affected set and the run time.
**Ending**: The graph with the affected set green, the rest marked as cache hits.
**Variants**: `build-caching`, `pipeline-parallelism-matrix`, `pipeline-triggers`; monorepo vs polyrepo (Git).
**Techniques**: path trace, spotlight, restyle, timer, side by side, replay, choice, caption.
**Review**: Improved — beat 3 was wrong as written: a path filter skips `web` and `admin` entirely, so they don't "ship broken", they go untested, and the break surfaces later in someone else's change. Now a replay showing exactly that. Weighed opening on the path filter; the 20-minute ghost run is the more familiar pain to start from.

### Automated dependency updates (`automated-dependency-updates`)

**The aha**: A bot opens small, frequent pull requests that bump dependencies, and the pipeline tests each one like any other change, which is far safer than one giant yearly upgrade.
**Misconception to defeat**: The bot is a vulnerability scanner; or it's better to save upgrades for one big push.
**Cast**: Two lanes over a year (month ruler on top). Top "Bot": small PR cards from a robot avatar (`lodash 4.17.20 → 4.17.21`), each passing a CI gate onto `main`. Bottom "Once a year": a "versions behind" meter, and later one giant PR card.
**Opening frame**: January, both lanes current, meter at 0.
**Story**:

1. Weeks pass. Top: a bot PR every few days, CI ✓, auto-merged: a dotted line of small green merges. Bottom: the meter climbs, 12 behind, 40 behind. Caption "Small, steady bumps."
2. Top: `react 18 → 19` fails CI ✗ and waits for a human. One change, one obvious cause. Caption "Tests decide what auto-merges."
3. June: a vulnerability alert flashes on one package in both lanes. Top: the bot's fix PR lands the next day ✓. Bottom: the fix is three major versions ahead and can't be taken alone. Caption "The scanner finds it. The update fixes it."
4. December, bottom: one PR bumping 87 packages; CI red with 40 failures; tangled lines run from failures to suspects. Caption "Big upgrade, big unknown."

**The moment**: Beat 4 against beat 2: one failure with one suspect versus 40 failures and 87 suspects.
**Interaction**: A dial "update every: week / month / year" that resizes each PR and the tangle of failures.
**Ending**: Top a long dotted line of green; bottom a single red knot.
**Variants**: `small-batches`, `devsecops-pipeline`, `semantic-versioning`, `pull-request-checks`.
**Techniques**: lanes, side by side, meter, timer, failure, dial, caption.
**Review**: Keep — a year in two lanes is the right scale, and "one failure, one suspect" against "40 failures, 87 suspects" is the small-batches argument in miniature. Beat 3 separates bot from scanner cleanly. Weighed showing the bot's PR internals; unnecessary, since the CI gate is what matters.

### Container image build, push and promote (`container-image-pipeline`)

**The aha**: Build the image once, scan it, push it, then promote that same image through environments by its digest: never rebuild it, and never trust a tag to stay put.
**Misconception to defeat**: Each environment builds its own image; or a tag like `latest` always means the same image.
**Cast**: Pipeline view: `Build → Scan → Push`, then a registry shelf where each image is a stacked-layer package with seal `sha256:9c2e` and tags hang from it on hooks. Environment zones `dev`, `staging`, `prod`.
**Opening frame**: Dockerfile and source on the left, an empty registry, three empty zones.
**Story**:

1. `Build` stacks the layers and seals the image `9c2e`. `Scan` passes it under a magnifier ✓. `Push` puts it on the shelf, tags `1.4.2` and `latest` hanging from it. Caption "Build, scan, push."
2. `dev` deploys by the arrow label `@sha256:9c2e`; tests pass. The same image travels on to `staging` and then `prod`; the same seal shows in each zone. Caption "Promote the image, don't rebuild it."
3. ⟲ Replay where `prod` deployed `shop:latest` instead. A new, untested image `b71d` is pushed and tagged `latest`: the hook slides off `9c2e` onto `b71d`. A prod instance is rescheduled, pulls `:latest` and comes up as `b71d`; prod now runs two different images. Caption "Tags move. Digests don't."
4. A ghost lane rebuilds per environment: `staging` builds `c3a0` (the base image changed overnight), not the `9c2e` that `dev` tested. Caption "Rebuilt = untested."

**The moment**: Beat 3, half speed: the tag physically sliding from one image to another while a deployment quietly pulls the wrong one.
**Interaction**: A "push a new :latest" button, and a toggle between deploying by tag and by digest.
**Ending**: All three zones showing seal `9c2e`.
**Variants**: `build-once-deploy-many`, `environment-promotion`, `artifact-repository`, `devsecops-pipeline`; tags vs digests (Containers).
**Techniques**: layers, token, move, boundary, side by side, failure, replay, toggle, caption.
**Review**: Improved — fixed a logic hole: beat 2 deploys by digest, so a moving `latest` tag couldn't reach prod; beat 3 is now a replay where prod deployed by tag, and beat 1 hangs both tags so the hook has somewhere to slide from. Weighed dropping beat 4 (rebuild per environment) as a repeat of `build-once-deploy-many`; kept, short, because the overnight base-image change is the container-specific cause.

## Testing and quality in the pipeline

### Test pyramid in the pipeline (`test-pyramid`)

**The aha**: Many fast unit tests run first, fewer integration tests next, and a handful of slow end-to-end tests last, so most failures report in seconds instead of half an hour.
**Misconception to defeat**: More end-to-end tests mean more confidence, so a suite top-heavy with them (the "ice-cream cone") is the safest.
**Cast**: A pyramid built of test bricks: a wide base of 800 small `unit` bricks (5 ms each), a middle of 80 `integration` bricks (2 s), a peak of 8 `e2e` bricks (90 s). Beside it, the pipeline with three test stages. A stopwatch reading "first red at". Later, an upside-down cone built from the same kinds of brick.
**Opening frame**: The pyramid, each layer labelled with its count and per-test time, next to the empty stages.
**Story**:

1. Each layer slides into its stage: unit first, integration second, e2e last. Caption "Fastest tests run first."
2. A commit with a logic bug: the unit stage goes red at 0:40; a red arrow returns to the developer. Caption "Most bugs: caught in seconds."
3. A bug in how two services talk passes unit and is caught by integration at 4:00. A broken checkout flow passes both and is caught by e2e at 15:00. Caption "Each layer catches what the one below can't."
4. The pyramid flips into the cone: 50 unit, 30 integration, 300 e2e (spread over ten machines, still 45 minutes). The same logic bug slips through the thin unit layer and waits for an e2e test: first red at 35:00, and several e2e bricks blink red and green on unchanged code. Caption "Upside down: slow and flaky."
5. A separate later stage, `load test`, appears after staging. Caption "Slow non-functional tests run last."

**The moment**: Beats 2 and 4 side by side: the same bug, "first red at 0:40" versus "first red at 35:00".
**Interaction**: Drag bricks between layers to reshape the pyramid; total run time, time to first red and a flakiness meter update.
**Ending**: Pyramid and cone side by side with their two stopwatches.
**Variants**: `ci-cd-pipeline`, `quality-gates`, `flaky-tests`, `contract-testing`, `shift-left`.
**Techniques**: layers, move, side by side, timer, meter, failure, dial, caption.
**Review**: Improved — made the cone's numbers add up (300 × 90 s e2e only fits in ~45 min across ten machines) and said why the logic bug is late (the thin unit layer misses it). Dropped "the pyramid is about coverage" from the misconception: no beat defeated it. Weighed the "testing trophy" framing; the pyramid is what the catalog and the syllabi use, and the stopwatch contrast works for either.

### Quality gates (`quality-gates`)

**The aha**: A gate is a pass/fail rule the pipeline enforces (coverage, scan findings, smoke tests, live health), so "good enough to proceed" isn't decided by a tired person under deadline pressure.
**Misconception to defeat**: A quality gate is someone's approval, or a guideline you can talk your way past.
**Cast**: Pipeline view with gate posts between stages, each with a rule plate: `coverage ≥ 80%`, `critical vulns = 0`, `smoke tests pass`, `error rate < 1% for 10 min`. The travelling package carries a scorecard. A clock showing Friday 17:45 and a stressed figure with a speech bubble.
**Opening frame**: The conveyor with its four gates and readable rule plates.
**Story**:

1. The package reaches gate 1; its scorecard reads 84% against `≥ 80%`; the bar lifts ✓. Caption "Rules, checked by the pipeline."
2. Gate 2: the scan finds one critical vulnerability; the bar stays down ✗; the package stops. Caption "Break a rule: the line stops."
3. Friday 17:45. The stressed figure's bubble: "Just this once?" Nothing about the gate changes, and it has nowhere to stamp. The dependency is patched, a new package arrives and passes. Caption "No judgment calls at 5:45 on a Friday."
4. After deploy to staging, gate 3 pings key pages ✓. After deploy to prod, gate 4 watches the error-rate meter for 10 minutes; it crosses 1%; the gate sends a rollback arrow right to left. Caption "Gates run after deploy, too."

**The moment**: Beat 3: deadline pressure pushing on a gate that doesn't move.
**Interaction**: Dial the thresholds (coverage 70% to 90%) and watch which packages get through; press "fail the smoke test" to see the post-deploy gate act.
**Ending**: Only packages meeting every rule are in prod.
**Variants**: `deployment-approvals`, `test-pyramid`, `devsecops-pipeline`, `progressive-delivery`, `policy-as-code`.
**Techniques**: token, meter, restyle, failure, timer, dial, caption.
**Review**: Keep — readable rule plates, a gate that has nowhere to stamp under Friday pressure, and a post-deploy gate that rolls back: rule-not-judgment is unmistakable, and it separates gates from approvals. Weighed one gate only; the four show that gates span build, scan and live health.

### Contract testing (`contract-testing`)

**The aha**: A consumer and a provider each test against a shared contract on their own, so each can deploy independently with evidence it won't break the other, without a full end-to-end environment.
**Misconception to defeat**: Only an end-to-end environment with every service running can prove services work together.
**Cast**: Two panels. Top "E2E": a shared staging zone holding eight services, a queue of teams waiting to use it. Bottom "Contract": the `web` service (consumer) and the `orders` API (provider) far apart, a contract card between them listing `GET /orders/42 → { id, total }`, and a broker shelf.
**Opening frame**: Top: the crowded staging zone, two services already red. Bottom: two services that never touch, joined only by the card.
**Story**:

1. Top: `web`'s test needs all eight services up; an unrelated one is down, so it fails for nothing; the queue grows. Caption "E2E: everything up, everyone waiting."
2. Bottom: `web`'s tests run against a stand-in `orders` that records what `web` asks for and needs. Out comes the contract card, filed on the broker. Caption "The consumer writes down what it needs."
3. The `orders` pipeline pulls the card and replays the request against the real API: the response has `id` and `total` ✓. Caption "The provider proves it still delivers."
4. A developer renames `total` to `amount`. `orders`'s own unit tests pass ✓, but contract verification fails ✗ "web needs total". The `orders` pipeline stops before deploy. Caption "Break a caller: caught before deploy."
5. `web` and `orders` each deploy on their own schedule, the green card between them.

**The moment**: Beat 4: a breaking change caught inside the provider's own pipeline, with `web` not running anywhere.
**Interaction**: Edit the provider's response: add a field (still ✓), rename or remove one (✗). It shows what "compatible" means.
**Ending**: Two services shipping independently; top panel's queue still waiting.
**Variants**: `test-pyramid`, `pull-request-checks`, `semantic-versioning`; microservices (Architecture).
**Techniques**: side by side, exchange, contents, token, failure, choice, caption.
**Review**: Keep — accurate to consumer-driven contracts (mock provider records the pact, broker, provider verification), and the rename caught inside `orders`'s own pipeline with `web` running nowhere is the moment. The "add a field ✓, rename ✗" interaction teaches compatibility well. Weighed a schema-only (OpenAPI diff) framing; consumer-driven is the catalog's idea.

### Flaky tests (`flaky-tests`)

**The aha**: A test that passes and fails on the same code teaches people to ignore red, and once "just re-run it" is a habit, real failures get re-run past too.
**Misconception to defeat**: Flaky tests are harmless noise that a re-run takes care of.
**Cast**: A pipeline; a test card `checkout.spec` with a small die on it; a developer with a "re-run" button; a "trust in red" meter; a week ruler; later, a quarantine box.
**Opening frame**: Commit `a1f3` run three times in three rows: ✓, ✗, ✓. Caption "Same code. Different answer."
**Story**:

1. The die on `checkout.spec` rolls each run. Over the week, red builds come and go; each time the developer presses re-run and gets green. The trust meter drains. Caption "Re-run becomes a habit."
2. Thursday: a real bug lands and a _different_ test goes red. Same hand, same button: re-run, red, re-run, red. Someone overrides and merges. Caption "Real failures get re-run too."
3. The bug reaches prod; users get red `!` bubbles. Caption "Red stopped meaning stop."
4. ⟲ Replay the week with tracking on. A health panel lists tests that fail and pass on the same commit: `checkout.spec`, 8%. It moves into a quarantine box: it still runs but no longer blocks. A ticket is assigned; a race condition is fixed (a timing diagram straightens out); the test returns. The trust meter refills. Caption "Track, quarantine, fix."
5. Thursday's real bug goes red, and this time the line stops. Caption "Red means stop again."

**The moment**: Beat 2: the identical "re-run" click from beat 1, now on a real failure. The visual rhyme makes the danger obvious.
**Interaction**: A flake-rate dial (0–20%): watch how often a perfectly good commit goes red. An "insert real bug" button: can you tell it from a flake?
**Ending**: Empty quarantine, full trust meter, a red build that people believe.
**Variants**: `test-pyramid`, `quality-gates`, `continuous-integration`, `dora-metrics`.
**Techniques**: meter, restyle, lanes, failure, replay, contents, dial, caption.
**Review**: Keep — the identical re-run click on a real failure is a strong visual rhyme, and the replay shows the remedy (detect, quarantine, fix). Weighed opening on the escaped bug; starting from "same code, different answer" defines the term first.

## Continuous delivery and release management

### Continuous delivery vs continuous deployment (`continuous-delivery-vs-deployment`)

**The aha**: Both run the same automated pipeline to a production-ready artifact; the only difference is whether a person presses a button before production.
**Misconception to defeat**: They're different practices with different tooling; or "continuous delivery" means every change goes live, or is just CI.
**Cast**: Two identical pipelines stacked as lanes, `Build → Test → Staging → Prod`. Top lane "Continuous delivery": a big button with a person beside it just before `Prod`. Bottom lane "Continuous deployment": no button. A bracket under `Build → Test` labelled "continuous integration".
**Opening frame**: Two identical conveyors; a spotlight on the one spot where they differ.
**Story**:

1. One change enters both lanes; stages light green in lockstep. Caption "Same automation underneath."
2. Bottom: the package flows straight into `Prod`. Top: it stops at the button with a tag "ready to release". Caption "Delivery: always ready, waiting for a decision."
3. Top: a product owner presses the button on Tuesday at 10:00 and it goes live. Caption "A person decides when."
4. A few more changes. Bottom: each goes live as it passes. Top: they gather at the button; the next press ships them together.
5. A bad change fails tests in both lanes; both stop at the same gate. The button played no part. Caption "Tests stop bad changes, not the button."
6. Brackets settle: "continuous integration" under build and test; "continuous delivery" over the whole top lane; "continuous deployment" over the whole bottom lane.

**The moment**: Beat 2: two lanes identical until one spot, where one package waits and the other walks through.
**Interaction**: Toggle the button on or off. Nothing else in the picture changes, which is the point.
**Ending**: The two lanes with their brackets. Caption "One decision apart."
**Variants**: `continuous-integration`, `ci-cd-pipeline`, `deployment-approvals`, `deploy-vs-release`.
**Techniques**: lanes, side by side, spotlight, toggle, token, failure, boundary, caption.
**Review**: Keep — a true minimal pair: two identical lanes that differ only by the button, a toggle that changes nothing else, and beat 5 showing the tests, not the button, stop bad changes. Accurate on all three terms (CI bracketed under build and test). Weighed a single lane with a removable button; the side-by-side lockstep is what makes "one decision apart" visible.

### Environment promotion (`environment-promotion`)

**The aha**: One artifact moves forward through dev, test and prod, gaining confidence at each hop; only the environment and its configuration change, never the code.
**Misconception to defeat**: Each environment has its own branch (`dev`, `staging`, `main`), built separately.
**Cast**: Pipeline view's right side: zones `dev`, `staging`, `prod`, each with a config sticky note (`db: dev-db, replicas: 1` / `db: stg-db, replicas: 2` / `db: prod-db, replicas: 6`). Package `shop 1.4.2`, seal `9c2e`. A three-step confidence meter. A promote arrow between zones.
**Opening frame**: The package in `dev` with the dev note plugged into it; the other zones running the previous version.
**Story**:

1. In `dev`, tests pass; the meter fills one step. Caption "Same package, dev config."
2. Promote: the same package slides to `staging`; the dev note unplugs and the staging note plugs in. Tests pass; meter two steps. Caption "Only the config changes."
3. The next package, `1.4.3`, fails in `staging` ✗ and stops there; `prod` never sees it. Caption "No pass, no promotion."
4. `1.4.2` is promoted to `prod`; the prod note plugs in; meter full. The seal in prod is still `9c2e`. Caption "Prod runs what you tested."
5. ⟲ Replay with a branch per environment: three branches `dev`, `staging` and `main`, each built separately into seals `9c2e`, `41ab`, `d03f`. A hotfix lands only on `main`; a "branches differ by N commits" counter climbs. Caption "Branch per environment: three different builds."

**The moment**: Beats 4 and 5 side by side: one seal across three zones versus three seals.
**Interaction**: Press promote at each hop; make a test fail in `staging` and watch promotion stop.
**Ending**: `prod` running `9c2e` with the prod note.
**Variants**: `build-once-deploy-many`, `deployment-approvals`, `container-image-pipeline`, `environment-parity`, `gitops-environment-promotion`.
**Techniques**: token, boundary, contents, meter, failure, replay, side by side, lanes, caption.
**Review**: Keep — config notes unplugging and plugging in around one sealed package shows "only the config changes" literally, and the branch-per-environment replay defeats the stated misconception. Distinct from `build-once-deploy-many` (that plan explains why a rebuild differs; this one is the chain of hops). Weighed a stage-gate-only framing; the notes are the unique part.

### Build once, deploy many (immutable artifacts) (`build-once-deploy-many`)

**The aha**: Package once and deploy that identical, never-modified artifact everywhere, with configuration supplied from outside, because a rebuild for production is something nobody tested.
**Misconception to defeat**: Building the same commit twice gives the same thing; and it's fine to bake each environment's settings in at build time.
**Cast**: Two lanes. Top "Rebuild per environment", bottom "Build once". Commit `a1f3` at the left of both; it asks for `json-lib ^2.3` (any 2.3.x), resolved at build time. Zones `test` and `prod`; a package registry where `json-lib` sits at `2.3.0`; config sticky notes; a day ruler.
**Opening frame**: Monday. Both lanes build `a1f3` into seal `9c2e`, using `json-lib 2.3.0`, and it passes in `test`.
**Story**:

1. Overnight, `json-lib 2.3.1` is published, with a bug. The registry's label flips.
2. Tuesday, top: `a1f3` is rebuilt for prod and picks up `2.3.1`; the new package has seal `5e71`. Prod's error meter climbs; users get red `!`. Caption "Same commit, different build."
3. Bottom: `9c2e` itself moves from `test` to `prod`. Healthy. Caption "Tested bytes are shipped bytes."
4. Zoom into the top package: `API_URL=test.example.com` is baked inside, which is why it had to be rebuilt. Zoom into the bottom package: an empty socket; each zone's config note plugs in at deploy. Caption "Config outside, so one artifact fits everywhere."

**The moment**: Beat 2 against beat 3: two seals under one commit hash, and only one prod zone in trouble.
**Interaction**: Toggle "bake config into the build": the bottom lane is forced to rebuild per environment, and picks up the bad library too.
**Ending**: Bottom lane: `9c2e` in `test` and `prod`, each with its own note.
**Variants**: `environment-promotion`, `pipeline-artifacts`, `container-image-pipeline`, `environment-parity`, `immutable-infrastructure`.
**Techniques**: lanes, side by side, token, restyle, timer, zoom, failure, toggle, caption.
**Review**: Improved — the cast now says `a1f3` asks for a version range resolved at build time; without that, "a rebuild picks up 2.3.1" looks wrong to anyone who knows lockfiles. Weighed swapping the cause for a base-image change; `container-image-pipeline` already uses that, so the library keeps the two plans distinct.

### Approvals and environment checks (`deployment-approvals`)

**The aha**: Approvals and checks belong on the environment where the risk is, usually production, and the pipeline records them; everywhere else, changes should flow automatically.
**Misconception to defeat**: More sign-offs make it safer, so every stage needs one; or approvals are the same as quality gates.
**Cast**: Pipeline view with `dev`, `test` and `prod`. Only `prod` has a gatehouse with a checklist: `1 approver from release-managers`, `window Mon–Thu 09:00–16:00`, `change ticket linked`, `one deploy at a time`. An audit log scroll beside it.
**Opening frame**: Open roads into `dev` and `test`, a gatehouse in front of `prod`.
**Story**:

1. The package flows through `dev` and `test` with no stops. Caption "Low risk: flow automatically."
2. At the gatehouse a request goes to an approver, who sees the test results and approves. The log writes "approved by Priya, 14:02, run #412". Caption "Approve where the risk is, on the record."
3. Another package arrives Friday 18:30. The window check reads ✗ "outside window"; it waits, and the clock spins to Monday 09:00. Caption "Checks: timing, tickets, who."
4. Two runs reach the gatehouse together; the first takes a padlock, the second queues behind it. Caption "One deploy at a time."
5. ⟲ Replay with approvals on every environment: packages pile up at `dev` and `test`, a lead-time stopwatch balloons from hours to days, and the failure rate stays the same. Caption "Approvals everywhere: a queue, not safety."

**The moment**: Beat 5 against beat 1: the same flow, one gate versus three, and a pile-up that bought nothing.
**Interaction**: Toggle approval on each environment and watch lead time and queue length.
**Ending**: The audit log listing who deployed what, and when.
**Variants**: `quality-gates`, `lightweight-change-approval`, `continuous-delivery-vs-deployment`, `environment-promotion`.
**Techniques**: token, contents, timer, restyle, replay, side by side, toggle, caption.
**Review**: Keep — one gatehouse in front of `prod` with a readable checklist covers approvals, windows, tickets and the exclusive lock (all real Azure Pipelines / GitHub environment checks), and the approvals-everywhere replay makes "a queue, not safety" concrete. Weighed a CAB contrast; that belongs to `lightweight-change-approval`.

### Deployment vs release (`deploy-vs-release`)

**The aha**: Deploying puts new code on the servers; releasing lets users see it. Separate the two and deploys become boring and frequent, while the business picks when users get the feature.
**Misconception to defeat**: The moment code reaches production, users see it.
**Cast**: Traffic view: the prod zone with four instance cards, the user crowd, and a feature flag `new-checkout`. Two lanes along the top over a week ruler: "Deploys" and "Releases".
**Opening frame**: v1 (blue) on every card, every user blue, the flag off, both lanes empty.
**Story**:

1. Monday: a deploy. The cards turn violet (v2); inside each, the new checkout path is drawn dashed and dim. Every user stays blue. A tick lands in the Deploys lane only. Caption "Deployed: the code is on the servers."
2. Tuesday to Wednesday: three more small deploys, three more ticks. Users notice nothing. Caption "Deploys become boring."
3. Thursday 10:00, launch day: the flag flips on. The checkout path lights solid and the crowd turns violet. A tick lands in the Releases lane; the Deploys lane stays silent. Caption "Released: users can see it."
4. A conversion meter dips. The flag flips off; users return to blue in a second; the code stays deployed. A second Release tick. Caption "Un-release without un-deploying."

**The moment**: Beat 3: the Releases lane fires while the Deploys lane is silent. Two different events, at two different times.
**Interaction**: The flag toggle, and a percentage dial to release to part of the crowd.
**Ending**: Two lanes: many deploy ticks, two release ticks. A small inset shows blue/green's idle side, deployed and waiting for the router: the same split done with traffic instead of a flag. Caption "Deploy when ready. Release when wanted."
**Variants**: `feature-flags`, `dark-launch`, `canary`, `blue-green-deployment`, `continuous-delivery-vs-deployment`.
**Techniques**: lanes, toggle, restyle, timer, meter, dial, caption.
**Review**: Improved — the ending now adds a one-glance inset of routing as the second way to separate the two (the catalog names both), so viewers don't leave thinking deploy-vs-release means "feature flags". The two silent/firing lanes stay the moment. Users staying blue on v2 servers now matches the clarified Users rule (flag plans tint by behaviour). Weighed a blue/green-led version; the flag keeps deploy and release on the same servers, which is the cleaner proof.

### Semantic versioning (`semantic-versioning`)

**The aha**: MAJOR.MINOR.PATCH tells consumers whether an upgrade is safe (fixes, features, or breaking changes), and dependency ranges only work if authors honour it.
**Misconception to defeat**: Version numbers are just counters or marketing, like a build number.
**Cast**: A version plate `1.4.2` with three separate dials labelled MAJOR, MINOR, PATCH. A library on the left; a consumer app on the right whose dependency `^1.4.0` is drawn as a bracket on a number line from `1.4.0` up to `2.0.0`. Commit messages arriving as small cards (`fix:`, `feat:`, `feat!:`).
**Opening frame**: The plate at `1.4.2`, inside the bracket; the consumer happily on it.
**Story**:

1. `fix: crash on empty cart` → the PATCH dial ticks to `1.4.3`. Inside the bracket, so the consumer upgrades automatically ✓. Caption "PATCH: fixes. Safe."
2. `feat: export to CSV` → MINOR ticks to `1.5.0` and PATCH resets to 0. Inside the bracket; the consumer upgrades and its old calls still work ✓. Caption "MINOR: new features. Safe."
3. `feat!: remove v1 API` → MAJOR ticks to `2.0.0`; the others reset. Outside the bracket: the consumer stays on `1.5.0` until it chooses to move. Caption "MAJOR: breaking. You opt in."
4. ⟲ Replay where the author ships that same breaking change as `1.6.0`. Inside the bracket, it auto-upgrades, and the consumer turns red ✗. Caption "Ranges only work if authors are honest."
5. The commit cards file themselves into a changelog under Fixes, Features and Breaking. Beside it a CalVer plate `2026.10.0` appears. Caption "CalVer tells you when, not whether it's safe."

**The moment**: Beat 4: the bracket letting in a lie.
**Interaction**: Choose a commit type and see the bump; change the range from `^` to `~` and see which versions get in.
**Ending**: The plate at `2.0.0`, the consumer safely on `1.x`, the changelog beside them.
**Variants**: `artifact-repository`, `automated-dependency-updates`, `release-train`; tags (Git).
**Techniques**: restyle, boundary, contents, failure, replay, choice, caption.
**Review**: Keep — the caret range drawn as a bracket on a number line makes "what gets in" visible, and the dishonest `1.6.0` replay shows why the convention matters. Ranges are right (`^1.4.0` = ≥1.4.0 <2.0.0; `~` stops at 1.5.0). Weighed a "dependency hell" multi-library graph; one consumer and one library keep it to one idea.

### Release train (`release-train`)

**The aha**: Releases leave on a fixed schedule; whatever is ready boards, and anything late waits for the next train, so dates stay predictable and one late feature can't hold everything back.
**Misconception to defeat**: A release should wait until every planned feature is done; or a train is the same as continuous delivery.
**Cast**: A track across a date ruler with stations every two weeks (`Oct 1`, `Oct 15`, `Oct 29`). Feature cards A, B, C, D with progress bars. Below, a second lane "Release when everything's done" with a draggable release-date marker.
**Opening frame**: The `Oct 15` station with a train waiting. A and B at 100%, C at 60%.
**Story**:

1. Departure time: the train leaves on the dot with A and B aboard; C, at 80%, stays on the platform. Caption "Ready? Board. Late? Next train."
2. `Oct 29`: C and D board; the train leaves on time again. Caption "The dates don't move."
3. Bottom lane, same features: C slips, so the release marker slides right, `Oct 15 → Oct 22 → Nov 3`. A and B, done since early October, sit greying in a waiting area. Caption "Wait for all: dates slip, done work waits."
4. A spectrum ruler appears: "yearly big bang", then "release train", then "continuous delivery". The train sits in the middle. Caption "A step toward release on demand."

**The moment**: Beats 1 and 3 side by side: A and B shipping on time on the train, and stuck behind C in the other lane.
**Interaction**: Drag a feature's progress or delay it and see which train it catches; dial the cadence from monthly to weekly to "any time" and watch the train become continuous delivery.
**Ending**: Trains leaving like clockwork above the spectrum ruler.
**Variants**: `continuous-delivery-vs-deployment`, `small-batches`, `semantic-versioning`.
**Techniques**: lanes, timer, move, side by side, meter, dial, caption.
**Review**: Keep — the literal train is the concept's own metaphor, and A and B greying in the wait-for-all lane is the cost made visible; the cadence dial turning trains into continuous delivery links it onward. Weighed a calendar-only view; the platform and the left-behind card are more memorable.

## Release strategies

Most of these use the traffic view: users on the left, the router in the middle, versions on the
right, v1 blue and v2 violet. Rings, charts and the pipeline view appear where the idea needs
them (`ring-deployment`, `feature-flag-types`, `automated-canary-analysis`,
`rollback-vs-roll-forward`).

### Recreate deployment (`recreate-deployment`)

**The aha**: Stop every old instance, then start the new ones: the simplest strategy, and two versions never run at once, but users get downtime in the gap.
**Misconception to defeat**: That any deployment keeps serving while it swaps (confusing it with a rolling update).
**Cast**: Traffic view with four v1 cards. A request stream; a "site up" light on the router; a downtime stopwatch. Along the top, a version timeline lane with a bar per version.
**Opening frame**: Four blue cards, a steady blue stream, the whole crowd blue, the light green.
**Story**:

1. "Deploy v2": all four blue cards stop at once and grey out. Requests reach the router and bounce back as red dots; users get red `!`; the light turns red; the stopwatch starts. Caption "Stop everything old."
2. Four violet cards appear, each with a boot spinner; the stopwatch keeps running through 0:45. Caption "Start everything new."
3. Health checks pass; the stream resumes, violet; users turn violet; the stopwatch stops at 1:10. Caption "Downtime: 1 min 10 s."
4. The timeline lane above shows a blue bar, a red gap, a violet bar, never overlapping. Caption "Never two versions at once." A small note: worth it when versions can't coexist (an incompatible schema change, a single batch worker) or nobody's using it (a dev environment).

**The moment**: Beat 1: the stream bouncing off an empty router, with the stopwatch counting.
**Interaction**: A "v2 startup time" dial stretches the gap. A "time of day" toggle (3 a.m. vs noon) changes how many users hit it.
**Ending**: The timeline lane: blue, red gap, violet.
**Variants**: `rolling-update`, `blue-green-deployment`, `zero-downtime-deployment`.
**Techniques**: stream, restyle, failure, timer, lanes, dial, toggle, caption.
**Review**: Keep — requests bouncing off an empty router with a stopwatch running is the plainest picture of downtime, and the non-overlapping timeline states the one upside honestly, with when it's worth it. Weighed opening with a rolling update for contrast; that comparison belongs to `rolling-update` and `zero-downtime-deployment`.

### Rolling update (`rolling-update`)

**The aha**: Replace instances a batch at a time, waiting for health checks before the next batch, so there's no downtime and no second environment, but for a while old and new serve side by side and must be compatible.
**Misconception to defeat**: Users see only one version during the rollout; or a rolling update is a canary (rolling replaces capacity; a canary chooses exposure).
**Cast**: Traffic view with six v1 cards, each with a heartbeat icon. A capacity meter ("6 of 6 serving"), a version-mix bar under the cards, and one highlighted user, Sam, in the crowd.
**Opening frame**: Six blue cards, mix bar all blue, capacity full.
**Story**:

1. A violet card appears beside the six (capacity 7 of 6: the surge), boots, its heartbeat goes ✓, and the router adds it. One blue card drains and leaves. Caption "Add new, remove old, one batch at a time."
2. Batches repeat: 2 violet + 4 blue, 3 + 3. The mix bar shifts with each batch. Caption "Traffic share = instance share."
3. A path trace follows Sam: one request to a violet card, the next to a blue one. Caption "Old and new serve side by side."
4. v2 stores Sam's cart in a new format; Sam's next request lands on v1, which can't read it: red `!`. Caption "So they must be compatible."
5. ⟲ Replay with a v2 that fails its health check: the new card's heartbeat flatlines red, the rollout pauses, no more blue cards leave, capacity holds. Caption "Unhealthy? The rollout stops."
6. Rollback: violet cards are replaced by blue, batch by batch, right to left. Caption "Rolling back means rolling again."

**The moment**: Beats 3–4: Sam's requests alternating colours, then breaking on the format mismatch.
**Interaction**: Dials for batch size and surge (`maxSurge`, `maxUnavailable`): bigger batches finish faster but the capacity meter dips. A "make v2 unhealthy" toggle.
**Ending**: Six violet cards; the capacity meter's trace never dropped below 6 of 6, because each new card was added before an old one left.
**Variants**: `recreate-deployment`, `canary`, `blue-green-deployment`, `zero-downtime-deployment`, `expand-contract-migration`; Kubernetes Deployment rollout (Containers).
**Techniques**: stream, appear/disappear, restyle, meter, path trace, failure, replay, dial, toggle, caption.
**Review**: Improved — fixed the ending's capacity floor: with surge-first batches (add, then remove) capacity never drops below 6 of 6; the dip belongs to the `maxUnavailable` dial. Sam alternating versions, then breaking on the cart format, is the right moment and sets up `expand-contract-migration`. Weighed a version-mix chart over time; the single user's path is more human.

### Blue/green deployment (`blue-green-deployment`)

**The aha**: Bring the new version up as a full second environment, test it privately, then switch all traffic at once, so cutover and rollback are each one router flip, paid for with double capacity and a database both versions must work with.
**Misconception to defeat**: Blue/green is a gradual rollout like a canary; or a flip back always undoes everything.
**Cast**: Traffic view. A router with a big two-way lever. Two full environment zones stacked on the right, name badges `BLUE` and `GREEN` (names, not colours: the cards inside keep v1 blue and v2 violet). A shared database below both. A capacity-cost meter. A tester figure off to the side.
**Opening frame**: `BLUE` holds four v1 cards and all the traffic; `GREEN` is empty and dim; both zones are wired to the database.
**Story**:

1. Four v2 cards fill `GREEN`; the cost meter jumps to "2×". Caption "A full copy, alongside."
2. The tester's private dashed path reaches `GREEN`; smoke tests ✓. The crowd is still entirely on `BLUE`. Caption "Test it before anyone sees it."
3. The lever flips. In one frame, half speed, the whole stream jumps from `BLUE` to `GREEN`, and the crowd turns violet together. Caption "One switch. Everyone moves."
4. `GREEN`'s error meter climbs. The lever flips back; the stream returns to `BLUE`, still warm, instantly. Caption "Rollback: flip it back."
5. ⟲ Replay where v2's release also dropped a database column v1 reads. The flip back now lands on a `BLUE` that errors: red `!` everywhere. Caption "The database must suit both."
6. A good release: `BLUE` is drained and becomes the idle side for next time. The badges swap roles.

**The moment**: Beat 3: the entire stream leaping in one frame, the opposite of a canary's trickle.
**Interaction**: The lever itself; a "break v2" toggle; a "breaking migration" toggle that shows when the flip back stops helping.
**Ending**: `GREEN` live, `BLUE` idle and ready, the cost meter still reading 2×.
**Variants**: `canary`, `rolling-update`, `zero-downtime-deployment`, `expand-contract-migration`; deployment slots (Azure), CodeDeploy blue/green (AWS).
**Techniques**: boundary, stream, toggle, meter, path trace, failure, replay, caption.
**Review**: Keep — the lever moving the whole stream in one frame is the opposite of a canary's trickle, and the dropped-column replay correctly shows that the flip back only undoes the code, not the database. Name badges vs version colours is handled explicitly. Weighed DNS-based cutover; the router lever is truer to how it's usually done and avoids TTL caveats.

### Canary release (`canary`)

**The aha**: Send a small slice of real users to the new version first and watch it; if it's bad, only that slice was hurt, for minutes, and you pull it back.
**Misconception to defeat**: "It passed staging, so ship it to everyone." Also that a canary is an experiment (A/B) or an all-at-once switch (blue/green).
**Cast**: Traffic view. 100 user figures; a sticky router (each user stays on one version, so a slice of traffic is a slice of people); nine v1 cards and one v2 canary card with a small yellow bird badge, each group with a health meter. Above the router, a ladder `1% → 5% → 25% → 50% → 100%`. Top right, a "users hurt" counter and a stopwatch.
**Opening frame**: All 100 figures blue, a thick blue stream to stable, the canary idle, ladder at 0%, both meters green. Caption "Like a miner's canary: something small goes in first."
**Story**:

1. The router opens 1%: a thin violet stream peels off to the canary, and one figure turns violet. One card in ten, yet 1% of traffic: the router sets the share. Caption "1% of real users."
2. Both meters fill side by side through a 10-minute bake; the canary matches stable ✓. The ladder steps to 5%, then 25%, and the violet patch grows. Caption "Healthy? Widen the slice."
3. ⟲ Replay with a bad v2 (red cracks). At 1%, the canary meter crosses its threshold within two minutes; the one violet figure gets a red `!`. Caption "Bad release. 1% notice."
4. The router snaps the canary to 0%; the figure turns blue; the stopwatch stops at 4:00 with the counter at "1 user hurt". Caption "Rolled back in minutes."
5. A ghost panel alongside: the same bad v2 shipped to 100%. All 100 figures turn violet, then red `!`. Counter "100 users hurt". Caption "Without a canary: everyone."

**The moment**: Beats 3 and 5 frozen side by side: one red `!` among 99 blue figures, versus a crowd that's all red.
**Interaction**: A canary-share dial and a "make v2 bad" toggle. The counter switches to user-minutes hurt (share × time to notice), so a bigger first step or slower detection visibly costs more.
**Ending**: Ladder at 100% with the crowd violet, or rolled back with the counter at 1, depending on the toggle. Caption "Small slice, short time, small blast radius."
**Variants**: `progressive-delivery`, `automated-canary-analysis`, `ring-deployment`, `ab-testing`, `blue-green-deployment`, `rolling-update`; blast radius (Reliability).
**Techniques**: stream, meter, timer, replay, side by side, failure, spotlight, dial, toggle, caption.
**Review**: Improved — the router is now sticky, because "1 user hurt" is only true if 1% of traffic is 1% of people (`ab-testing` now agrees); beat 1 shows the router, not one card in ten, sets the share, separating canary from `rolling-update`; a bird badge and opening caption tie the name to the idea; trimmed every beat. Weighed opening on the 100% ghost; holding it to beat 5 makes the side-by-side the payoff.

### A/B testing vs canary (`ab-testing`)

**The aha**: Both split traffic, but they ask different questions: A/B asks "which is better?" against a business metric and needs days for significance; a canary asks "is it broken?" against health metrics and answers in minutes.
**Misconception to defeat**: They're the same thing, so one rollout can do both jobs.
**Cast**: Side by side, two traffic views that look nearly the same. Left "A/B test": a 50/50 split by cookie, variants A (blue) and B (violet), a conversion chart with confidence bars, a calendar in days. Right "Canary": a 5/95 split, stable and canary, an error-rate meter, a stopwatch in minutes.
**Opening frame**: Two near-identical split pictures. Caption "Same split. Different question."
**Story**:

1. Each panel gets its question as a heading: "Which is better?" and "Is it broken?".
2. Left: each user is assigned once and keeps their colour on every visit; a highlighted user walks back in and goes to B again. Right: stickiness is optional; the canary only needs its share of traffic. Caption "A/B: the same user must see the same variant."
3. Right: after 15 minutes the error meter matches stable; verdict ✓ "safe". Left: the conversion chart reads A 3.1%, B 3.3%, with overlapping confidence bars, "not significant yet". The calendar ticks; by day 14 the bars separate: B wins. Caption "Minutes versus weeks."
4. ⟲ Replay where one rollout tries to be both: v2 carries a bug _and_ the new design. The bug's errors push B's conversion down, so the experiment measures the bug, not the design; and the canary is held at 50% for two weeks "for the experiment", hurting half the users. Caption "Mix them and both answers go wrong."

**The moment**: Beat 3: the canary panel stamped ✓ while the A/B calendar still says day 2.
**Interaction**: A sample-size dial on the A/B side: more users narrow the confidence bars faster. Toggle the question per panel to see the metric and clock swap with it.
**Ending**: Two verdicts with their clocks: "15 min: safe" and "14 days: B converts better".
**Variants**: `canary`, `feature-flags`, `feature-flag-types`, `progressive-delivery`.
**Techniques**: side by side, stream, chart, meter, timer, replay, dial, toggle, caption.
**Review**: Improved — beat 2 said any request can land on the canary, which clashed with the `canary` plan's one-figure-per-user picture and overstated it (canaries may be sticky); it now says stickiness is _required_ for A/B and _optional_ for a canary, which is the true difference. The two-question headings and "minutes versus weeks" are the right frame. Weighed a single panel that switches modes; two near-identical panels make "same split, different question" visible at once.

### Shadow deployment (traffic mirroring) (`shadow-deployment`)

**The aha**: Copy live requests to the new version, compare its answers and throw them away: real production load and inputs with zero user impact, provided its side effects (writes, emails, payments) are stubbed out.
**Misconception to defeat**: Shadow is a canary (users served by the new version); or the same as a dark launch.
**Cast**: Traffic view with a mirror prism on the router. v1 serving; v2 behind a translucent "shadow" boundary. A comparator (a scale with a diff readout) and a bin. To the right, a payment service and an email service.
**Opening frame**: The stream to v1 and back; v2 idle in its shadow.
**Story**:

1. Mirroring on: at the prism each request dot splits in two, the solid one to v1 and a ghost copy to v2. Caption "Every request, copied."
2. v1's response goes back to the user. v2's response goes to the comparator, then into the bin. The readout: "match 99.2%", with mismatches listed. Caption "Users only ever get v1's answer."
3. v2's load meter climbs to real production levels; its latency meter crosses the threshold under real load. No user felt it. Caption "Real load. Zero user impact."
4. A mirrored checkout makes v2 call the payment service: a second charge card pops up, "charged twice" ✗. ⟲ Replay with v2's payment and email swapped for dashed stubs: the shadow call hits the stub and stops. Caption "Stub the side effects."

**The moment**: Beat 2: the forked request, the ghost answer dropping into the bin while the user gets only v1's reply.
**Interaction**: A "stub side effects" toggle (turn it off and watch the double charges); a mirror-percentage dial.
**Ending**: The comparator's match rate high, v2 proven under load, the crowd untouched and still blue.
**Variants**: `canary`, `dark-launch`, `automated-canary-analysis`; traffic mirroring at load balancers and meshes (Networking).
**Techniques**: stream, clone, boundary, meter, failure, replay, toggle, dial, caption.
**Review**: Keep — the forking request and the ghost answer dropping into the bin are exactly "real inputs, zero user impact", and the double charge is the memorable failure that makes stubbing obvious. Weighed adding a canary inset for contrast; `ab-testing` and `canary` already carry the traffic-split pictures, and the crowd staying blue throughout says it.

### Dark launch (`dark-launch`)

**The aha**: Deploy a feature to production and run it on real traffic, or for internal users only, while customers can't see it; prove it under real load and data, then make it visible on launch day.
**Misconception to defeat**: It's the same as shadow deployment (mirroring to a separate version); or it's the same as a feature flag (the flag is usually the mechanism; the dark launch is the practice).
**Cast**: Traffic view: one app version in prod whose cards contain a new `recommendations` box behind a curtain. The user crowd, with a few staff figures wearing badges. A flag `recs-visible` with an audience selector (nobody / staff / everyone). A load meter on the recommendations database.
**Opening frame**: The app serving customers; the recommendations box dim behind its curtain; flag set to nobody.
**Story**:

1. Every real page view also calls the recommendations engine in the background, a thin violet side-stream inside the live app, and the results are dropped behind the curtain. No copied requests and no second version: the new code runs for real, it just isn't shown. Caption "Real traffic, invisible to customers."
2. The load meter climbs to 90% and turns red. Nobody outside notices. The team adds a cache; the meter falls to 40%. Caption "Found before launch, not on launch day."
3. Audience set to staff: badge-wearing figures see the recommendations panel glow on their pages; customers see nothing new. A staff figure flags a bug; it's fixed. Caption "Insiders use it for real."
4. Launch day: audience set to everyone. The curtain lifts for the whole crowd. No deploy happens; the load meter stays where it was. Caption "Launch day: just flip it."

**The moment**: Beat 2: a red meter and a fix, with a calm customer crowd beside them.
**Interaction**: The audience selector (nobody / staff / everyone); a "remove the cache" toggle to see what launch day would have looked like.
**Ending**: Feature live for everyone, load meter steady.
**Variants**: `feature-flags`, `shadow-deployment`, `deploy-vs-release`, `ring-deployment`.
**Techniques**: stream, meter, boundary, spotlight, restyle, failure, toggle, caption.
**Review**: Improved — beat 1's side-stream into a hidden box looked almost identical to shadow's ghost copy into a bin, the very confusion the plan sets out to defeat; it now says outright that nothing is copied and no second version exists, so the new code is running for real inside the live app. Weighed a side-by-side with shadow; one sentence on screen is enough and keeps one idea.

### Feature flags (`feature-flags`)

**The aha**: A feature flag separates switching a feature on from deploying it: the code ships switched off, a runtime switch turns it on per user or percentage, and turning it off takes seconds, with no redeploy.
**Misconception to defeat**: A flag is a config value read once at startup; or unfinished work has to wait on a feature branch until it's ready.
**Cast**: A zoomed-in instance card showing a fork in the code, `if newCheckout`: the old path blue, the new path violet. Beside it a flag panel `new-checkout` with targeting (off / beta users / % of users / on). The user crowd, some figures with beta badges. A pipeline icon, idle. An error counter.
**Opening frame**: Flag off; every request dot takes the blue path; the crowd blue.
**Story**:

1. The new path is merged to `main` and deployed, but switched off; dots skip straight past it. Caption "Merged, shipped, switched off."
2. Target: beta users. The fork now decides per request: badge holders' dots take the violet path; their figures turn violet. Caption "On for some users."
3. The percentage dial moves to 10%, then 50%; the violet share of the crowd grows. The pipeline icon stays idle the whole time. Caption "No redeploy needed."
4. Errors spike on the violet path; red dots stream out. The flag flips off; within two seconds every dot takes the blue path and the counter flattens. Beside it, a ghost "rollback" lane runs a 15-minute redeploy while its error counter keeps climbing. Caption "Kill switch: seconds, not a redeploy."

**The moment**: Beat 4: two timers side by side, 0:02 and 15:00, with error counts to match.
**Interaction**: The toggle, the targeting rules and the percentage dial; a "break the new path" button, and a "break code outside the flag" button the switch can't help with: a kill switch covers only what it wraps.
**Ending**: Flag off, errors flat, the new code still deployed and waiting for its fix.
**Variants**: `feature-flag-types`, `deploy-vs-release`, `dark-launch`, `ab-testing`, `ring-deployment`, `rollback-vs-roll-forward`; App Configuration (Azure), AppConfig (AWS); trunk-based development (Git).
**Techniques**: zoom, path trace, stream, toggle, dial, failure, timer, side by side, caption.
**Review**: Improved — the aha now names what a flag decouples (switching on vs deploying) instead of listing features; beat 1 says the code is merged, which is what defeats the feature-branch half of the misconception; the interaction adds the honest limit (a kill switch only covers the code it wraps, so it doesn't replace rollback). Weighed leading with the kill switch; the gradual turn-on first makes the 0:02 vs 15:00 payoff land harder.

### Feature flag types and flag debt (`feature-flag-types`)

**The aha**: Release, experiment, ops and permission flags live for different lengths of time and change at different speeds, and release flags must be deleted once the feature ships, because every live flag doubles the paths to test.
**Misconception to defeat**: All flags are the same and can stay in the code forever.
**Cast**: A chart with "how long it lives" across (days to years) and "how often its value changes" up (per deploy to per request). Four flag cards: `new-checkout` (release), `button-test` (experiment), `disable-recs` (ops kill switch), `premium-reports` (permission). A toggle-router box. A branching path tree with a path counter.
**Opening frame**: The empty chart with its four regions faintly labelled.
**Story**:

1. Each card drops into its region: release (weeks, rarely changes), experiment (weeks, per user), ops (years, flipped in incidents), permission (years, per customer). Caption "Four kinds, four lifespans."
2. A request arrives carrying a user's context. The toggle router consults each flag's rule: permission by plan, experiment by cohort, release by percentage, ops by one global switch. Caption "A router decides every value."
3. The path tree grows: 1 flag, 2 paths; 2 flags, 4; 3, 8; 5, 32 leaves. A "paths to test" counter climbs. Caption "Each flag doubles the paths."
4. `new-checkout` has been at 100% for 90 days: an ageing sticker, its card fading to stale brown as it drifts out of its region. It's deleted: the card leaves, the `if` leaves the code, the tree halves. Caption "Shipped? Delete the release flag."

**The moment**: Beat 3 into 4: the tree doubling with every flag added, then halving on one deletion.
**Interaction**: Add or remove flags and watch the path count; drag a release flag's age forward until it's marked stale.
**Ending**: Three long-lived flags in their regions; the release flag gone.
**Variants**: `feature-flags`, `ab-testing`, `dark-launch`.
**Techniques**: chart, appear/disappear, clone, meter, restyle, timer, choice, caption.
**Review**: Keep — the longevity × dynamism chart is Hodgson's own model with the four categories placed correctly, and the path tree doubling then halving on one deletion makes "flag debt" a number you can see. Weighed a codebase-littered-with-ifs picture; the tree is more precise about why each flag costs.

### Ring deployment (`ring-deployment`)

**The aha**: Release to widening rings of people (the team, the company, early adopters, everyone) with bake time between rings, so slow-burning problems show up before the next, bigger, less forgiving ring.
**Misconception to defeat**: Rings are the same as canary percentages. Rings choose _who_; a canary chooses _how much traffic_.
**Cast**: Concentric rings around the release: Ring 0 "team (20)", Ring 1 "company (2,000)", Ring 2 "early adopters (50,000)", Ring 3 "everyone (5M)". Each ring labelled from "forgiving" (inner) to "unforgiving" (outer). A bake timer between rings. A memory meter.
**Opening frame**: All rings blue (v1); the v2 package at the centre.
**Story**:

1. v2 reaches Ring 0; the ring turns violet; a 24-hour bake timer runs. Caption "Start with people who forgive."
2. Ring 1 turns violet; its bake is 48 hours. At hour 30, the memory meter has crept past its threshold: a slow leak no short test would show. The rollout halts; Rings 2 and 3 stay blue. Caption "Bake time lets slow bugs surface."
3. The fixed `v2.1` restarts at Ring 0 and moves outward ring by ring, each bake shown, to Ring 3. Caption "Each ring bigger, each step earned."
4. A critical security fix takes a marked fast lane through the rings with one-hour bakes. Caption "Hotfixes: a defined fast path."
5. An inset canary panel: 5% of random requests. Caption "Rings pick who. A canary picks how much."

**The moment**: Beat 2: the leak appearing at hour 30, after a one-hour check would have said "fine", while the outer rings stay blue.
**Interaction**: A bake-time dial: shorten it and the leak escapes into Ring 2 or 3, with an "affected users" count to match.
**Ending**: All rings violet, with a log of each ring's bake.
**Variants**: `canary`, `progressive-delivery`, `feature-flags`, `dark-launch`.
**Techniques**: boundary, timer, meter, restyle, failure, dial, side by side, caption.
**Review**: Keep — concentric rings are the concept's own picture (a justified break from the traffic view), the hour-30 leak inside a 48-hour bake makes bake time earn its place, and the canary inset settles "who vs how much". Matches Microsoft's safe deployment practice, hotfix fast path included. Weighed linear stages; rings show audiences growing outward, which stages don't.

### Progressive delivery (`progressive-delivery`)

**The aha**: The rollout becomes a control loop: shift a step, measure health against thresholds, then advance or abort automatically, with no human watching dashboards.
**Misconception to defeat**: Progressive delivery is just another word for canary (the canary is the technique, progressive delivery automates the decision); or someone still has to watch and click.
**Cast**: Traffic view with v1 and v2. Above it, a loop of three nodes, `Shift → Measure → Decide`, with an arrow back to `Shift`. An SLI panel: `error rate < 1%`, `p99 < 300 ms`. A small controller robot at the router. An on-call engineer asleep in the corner.
**Opening frame**: The loop idle; v1 serving 100%.
**Story**:

1. `Shift` lights: the controller moves the router to 5% v2. Caption "Shift a step."
2. `Measure` lights: a 5-minute timer runs while both SLI meters fill, both under threshold. Caption "Measure against thresholds."
3. `Decide` lights ✓ and the loop goes round again: 20%, 50%, 100%. Each lap is ticked on the loop. The engineer sleeps through it. Caption "Advance on its own."
4. ⟲ Replay with a slower v2. At 20%, p99 crosses 300 ms. `Decide` lights ✗; the router snaps back to 0% in seconds; an alert goes out. The engineer wakes to a summary, not an outage. Caption "Abort on its own."
5. An inset: the manual version, a person squinting at graphs at 2 a.m.; they spot the rise and react after 40 minutes. Caption "Seconds, not 40 minutes."

**The moment**: Beat 4: the loop turning red and the router snapping back with no hand anywhere in the frame.
**Interaction**: Dial the thresholds and the step sizes; inject latency or errors into v2 and see where the loop aborts. Switch what `Shift` moves (router weight, flag percentage, next ring): the loop itself doesn't change, because the loop is the practice and the traffic trick is interchangeable.
**Ending**: The loop with its history: release 1 ✓ ✓ ✓ ✓, release 2 ✓ ✗.
**Variants**: `canary`, `automated-canary-analysis`, `ring-deployment`, `feature-flags`; SLOs (Reliability); `gitops-reconciliation` (another control loop).
**Techniques**: loop, stream, meter, timer, path trace, failure, replay, side by side, dial, caption.
**Review**: Improved — the story only ever drove a router weight, which left the "it's just canary" misconception half-standing; the interaction now swaps what `Shift` moves (weight, flag percentage, ring) under an unchanged loop. Added part 2's `loop` technique, which this plan draws, and linked the GitOps control loop. Weighed opening on the 2 a.m. manual inset; keeping the sleeping engineer as a running contrast leaves the loop centre stage.

### Automated canary analysis (`automated-canary-analysis`)

**The aha**: Judge the canary against a fresh baseline of the old version, started at the same time and given the same traffic, not against "before the deploy", because time of day and instance age otherwise distort the verdict.
**Misconception to defeat**: Compare the canary with the hour before the deploy, or with long-running production, or just alert on a fixed threshold.
**Cast**: Three groups: production v1 (large, uptime "14 days"), a baseline v1 (one fresh card), the canary v2 (one fresh card). The baseline and canary get equal small slices. A chart of error rate across a day with a natural lunchtime hump. A score dial from 0 to 100 with a pass line at 80.
**Opening frame**: The day chart with its lunchtime hump, and a canary marker about to start at 12:00.
**Story**:

1. Wrong way 1: the canary at 12:00 is compared with "before", at 09:00. Its error rate looks twice as high: false alarm ✗. It's just lunch traffic. Caption "Before vs after mixes in the clock."
2. Wrong way 2: the canary is compared with long-running production, whose caches are warm. The fresh canary looks slower for being new. Caption "Old vs new mixes in age."
3. Right way: a baseline v1 card starts at the same moment as the canary, with the same slice of traffic. Their two lines rise and fall together through lunch. Caption "Fresh baseline. Same time, same traffic."
4. Per metric, a statistical test compares the two: errors ✓, CPU ✓, p99 latency ✗ (the canary is consistently above). Score 67, under 80: fail, roll back. Caption "Score each metric, then a verdict."

**The moment**: Beat 3: two lines moving in lockstep through the lunchtime hump, then pulling apart only where v2 is really worse.
**Interaction**: Toggle the comparison (before/after, vs production, vs baseline) and watch false alarms appear and disappear; move the pass line.
**Ending**: The score dial with its verdict and the per-metric ticks.
**Variants**: `canary`, `progressive-delivery`, `ab-testing`; SLIs (Observability).
**Techniques**: chart, side by side, meter, timer, toggle, failure, caption.
**Review**: Keep — two wrong comparisons (clock, instance age) then the right one is exactly the SRE workbook's argument, and the score is internally consistent (2 of 3 metrics pass = 67, under 80), as Kayenta-style scoring works. The lockstep lines through the lunchtime hump are a strong moment. Weighed adding the statistics (Mann-Whitney); "a statistical test per metric" is the right depth.

### Rollback vs roll forward (`rollback-vs-roll-forward`)

**The aha**: After a bad deploy you either redeploy the last good version or push a fix through the pipeline; rolling back is fastest only if the old version still works with today's data, and a fast pipeline is what makes rolling forward safe.
**Misconception to defeat**: Rollback is always available and always safe; or reverting the commit is a rollback (it still has to be deployed).
**Cast**: Pipeline view, from the right. `prod` running a broken v2 (red cracks), its error meter red. An artifact shelf holding v1 (known good). The pipeline below. A database labelled with its schema version. A fork of two arrows, "roll back ←" and "roll forward →". A recovery stopwatch.
**Opening frame**: v2 broken in prod, users with red `!`, the fork waiting.
**Story**:

1. Roll back, case A (no schema change): v1 travels right to left from the shelf into prod; users recover; stopwatch 2:00. Caption "Rollback: redeploy the last good one."
2. ⟲ Replay, case B: v2 also ran a migration that split `name` into `first_name` and `last_name` and dropped `name`. v1 returns, queries `name`, and fails: red `!` again. Caption "Old code, new data: still broken."
3. Roll forward: a fix commit rides the pipeline (build ✓, test ✓, deploy ✓) in 12 minutes; `v2.1` lands; green. Caption "Roll forward: the fix goes through the pipeline."
4. Set the pipeline to 3 hours: the stopwatch keeps running and the error meter stays red the whole time. Caption "A fast pipeline makes forward safe."
5. A `git revert` commit appears and has to ride the same pipeline. Caption "A revert still needs a deploy."

**The moment**: Beat 2: the rolled-back v1 meeting today's schema and turning red. Rollback isn't a time machine for data.
**Interaction**: Choose rollback or roll forward, with toggles for "migration ran" and a pipeline-duration dial; the recovery stopwatch shows the result.
**Ending**: A small table of recovery times: rollback 2 min (no migration), rollback fails (migration), forward 12 min, forward 3 h.
**Variants**: `expand-contract-migration`, `database-migrations-in-pipeline`, `blue-green-deployment`, `feature-flags`, `dora-metrics`.
**Techniques**: choice, move, token, timer, failure, replay, dial, toggle, caption.
**Review**: Keep — the fork plus four recovery times give a fair answer ("it depends on data and pipeline speed"), and v1 failing against today's schema is the memorable reason rollback isn't a time machine. Right-to-left travel for rollback follows the area's rule. Weighed making it a pure race between the two arrows; the migration case is what people get wrong, so it must stay.

### Zero-downtime deployment (`zero-downtime-deployment`)

**The aha**: No single tool gives zero downtime; it takes several pieces together: a strategy other than recreate, health checks before traffic, draining in-flight requests before stopping, and versions that can run side by side.
**Misconception to defeat**: Blue/green or Kubernetes gives you zero downtime by itself.
**Cast**: A zoomed traffic view of one swap: the router, an old v1 card holding in-flight requests (dots with progress bars), a new v2 card booting. A "user-visible errors" counter. Along the side, four switches, in this order: `rolling or blue/green`, `readiness check`, `connection draining`, `backward compatible`.
**Opening frame**: All four switches off, so the strategy is recreate; the counter at 0.
**Story**:

1. Recreate: v1 stops, nothing serves until v2 is up, counter +40. Switch on `rolling or blue/green`: ⟲ something is always serving, yet the counter still climbs, +20, from three smaller holes. Caption "A strategy alone isn't zero downtime."
2. The router sends traffic to v2 while it's still booting: +12. Switch on `readiness check`: ⟲ the router waits for v2's ✓ before sending anything. Caption "No traffic until it's ready."
3. v1 is killed at once: three half-finished requests are cut mid-bar, +3. Switch on `connection draining`: ⟲ v1 gets no new requests, its in-flight bars complete, then it stops. Caption "Let in-flight requests finish."
4. A page served by v1 calls an API on v2 whose response changed: +5. Switch on `backward compatible`: ⟲ both versions understand each other, and a full rollout runs with the counter at 0 throughout. Caption "All four together: zero downtime."

**The moment**: Beat 1: the switch everyone expects to be the answer goes on, and the counter keeps climbing. Each later beat closes one of the holes it left, the snipped request bars of beat 3 most vividly.
**Interaction**: The four switches: turn any one off and rerun to see which errors return. Each piece closes a different gap.
**Ending**: All four on, a full rollout complete, the counter at 0.
**Variants**: `rolling-update`, `blue-green-deployment`, `recreate-deployment`, `expand-contract-migration`; Kubernetes readiness probes and graceful termination (Containers); connection draining (Networking).
**Techniques**: zoom, contents, stream, meter, failure, replay, toggle, caption.
**Review**: Improved — reordered so the strategy switch comes first: the old order fixed readiness, draining and compatibility during a swap that was implicitly already rolling, then "switched from recreate" at the end, which muddled the logic and never confronted the misconception. Now rolling goes on in beat 1 and errors keep coming (+12 +3 +5 = 20), which is the misconception visibly failing. Weighed a checklist-style ending; the counter at 0 is the better proof.
