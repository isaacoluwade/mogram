# Git plans, part 2: review (stage 3)

Review of the 31 plans in [`git.part2.md`](git.part2.md) (catalog groups 7–12: hosted Git, branching
workflows, history hygiene and releases, investigating history, large repositories, hooks and
attributes). Each plan was checked against the six questions in the
[README](../README.md#review-stage-3) and carries its verdict on its last line.

## Verdicts

| Verdict   | Count | Plans                                                                                                                                                    |
| --------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep      | 0     |                                                                                                                                                          |
| Improved  | 30    | 7 of them light (accuracy or a missing caption, approach unchanged): GitFlow, release branches, blame, submodules, partial clone, sparse checkout, hooks |
| Rethought | 1     | Merge queue                                                                                                                                              |
| Merged    | 0     | No Git id is in `tools/catalog.py`'s `OWNERS`                                                                                                            |

No plan was kept as it was. The drafts had good instincts for structure but often made a technical
claim that's wrong, or named a misconception the story never showed.

## Most important changes

- **Merge queue (rethought).** The draft's central contrast was wrong: it showed "require branches up
  to date" letting a collision onto main, but strict mode does catch it (its cost is reruns). The
  failure on main now belongs to auto-merge, combinations build in parallel as they really do, and a
  PR fails mid-queue so "those behind are retested without it" is actually shown.
- **.gitattributes.** The draft blamed `core.autocrlf=true` for whole-file diffs, but that setting
  converts back to LF on commit and prevents them. The cause is now a machine with conversion off
  committing CRLF.
- **PR merge methods.** The draft said rebase-merge lets you keep using the branch cleanly. It
  doesn't: like squash, it puts copies on main, so only a merge commit keeps the originals.
- **CODEOWNERS.** `/billing/*` doesn't match subdirectories, so the draft's "last match wins" overlap
  couldn't happen. The moment is now the classic failure: a `*` line appended at the bottom silently
  overriding every owner, which proves that position wins, not specificity.
- **Code review.** With "dismiss stale approvals" off, the draft showed the approval going "stale".
  In fact GitHub still counts it, so the unreviewed push merges. That's the failure now shown.
- **Signed commits.** The impostor now signs with her own key and still gets "Unverified": the key
  has to belong to the person named. Setting `--author` alone wouldn't work, because the committer
  would still be the impostor and her own signature would verify.
- **Ancestry and ranges.** The plan promised the `..` vs `...` trap but never showed it. Now
  `git diff main..feature` (main's work shown as phantom removals) sits beside `diff main...feature`.
- **Atomic commits, linear history, bisect, LFS, semver.** Each had a wrong or inconsistent beat. The
  atomic-commits draft said revert "drags part of two commits out", the linear-history draft said
  bisect "has to pick a parent at merges", the bisect numbers contradicted themselves, LFS shrank an
  already-committed file and then said that needs a rewrite, and semver used a self-flipping switch
  where the real mechanism is a dependency range (now a bracket).
- **Misconceptions put on screen.** Six plans named a misconception and never showed it. Fixes: the
  PR ending shows a clone with no PR in it; monorepo and polyrepo both get deploy rockets under every
  project; trunk-based development shows a quick PR review plus an "unintegrated work" meter
  (sawtooth vs ramp); atomic commits gets a squash beat; stacked PRs opens on the 600-line PR;
  GitHub flow's moment becomes a path-trace race against GitFlow.
- **One visual language.** In the draft, "flag" meant a branch, a tag, the merge base, the base a
  check ran against, and a feature flag. The file's intro now has an element table: merge base =
  ring, tag = part 1's gold star, tested-on = bracket and ruler, feature flag = on/off switch,
  throwaway test branch = dashed lane, plus the PR panel and protection shield.

## Cross-area duplicates to resolve

`tools/catalog.py` only catches duplicates that share an id, so it misses these:

- `git-merge-queue` and Delivery's `merge-queue` are the same concept, and after this review the two
  plans are nearly the same story. Keep one and point to it from the other.
- `git-semantic-versioning` and Delivery's `semantic-versioning` have the same problem. This review
  moved the Git plan onto Delivery's range bracket, so either plan can absorb the other.
- `git-required-status-checks` overlaps Delivery's `pull-request-checks`. They're distinct enough to
  keep (stale base and the rerun treadmill vs. CI testing the would-be merge), but they should link
  to each other.

The same concrete break, a rename of `getUser` to `fetchUser` landing while another PR adds a call
to `getUser`, now drives required checks, the merge queue and Delivery's two plans. Keep using it, so
viewers see one example across the series.

## Patterns for the platform (stage 4)

What these 31 stories keep needing, roughly in order of how often:

1. **A real commit-graph primitive.** Lanes, commits and parent arrows with automatic layout; ref
   tags (branch, gold-star tag, `origin/…`, HEAD) that slide between commits; clones with primed ids;
   originals that fade but stay. Almost every plan needs it, and authors should declare graph
   operations (commit, merge, rebase, cherry-pick) rather than draw them. Bisect needs it compressed
   to 1,000 commits.
2. **Annotations bound to graph elements.** A merge-base ring, a tested-on bracket and a ruler that
   counts commits behind, a bisect search band, a shallow clone's cliff edge, a highlighted range
   set. They have to follow the layout and recompute their numbers as the graph changes.
3. **Same start, two outcomes.** Over 20 of the 31 plans run one scenario twice: with and
   without a rule, merge vs squash vs rebase, LFS before vs after. This needs a scenario fork (clone
   the scene state, apply different steps, show side by side or as a replay). Delivery already uses
   "replay"; it should join the technique vocabulary.
4. **Stories as functions of settings.** Most interactions flip a policy (dismiss stale approvals,
   strict mode, require linear history, upstream first, `--squash`, depth) and re-run the story. So
   a story has to be steps over a model with parameters, not fixed keyframes.
5. **Text that prints as the story runs.** `git log --oneline`, red and green diff panes, the
   CODEOWNERS file with traced rows, terminal errors (`fatal: No names found`), the LFS pointer's
   three lines. About a dozen plans need a code or text panel with line-level highlighting and diff
   colouring, linked to graph elements.
6. **Host panels pinned to the graph.** The PR panel, check gates, approval stamps tethered to a
   commit, the merge button's locked, green and red states, the protection shield that bounces
   pushes. These are small state machines attached to graph elements by a tether.
7. **Derived meters.** CI runs (6 for 3 merges), bisect's test count, clone download size,
   unintegrated work over a week, diff line counts. They should be computed from the scenario, so
   dials and toggles update them honestly.
8. **Containers with contents.** Repository, working tree, LFS shelf, origin frame, laptop and server
   boundaries, with items moving between them, shared with part 1's three trays.
