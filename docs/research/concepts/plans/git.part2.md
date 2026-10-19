# Git plans, part 2

Stage 2 plans for groups 7–12 of [`catalog/git.md`](../catalog/git.md): collaborating on hosted
Git, branching workflows, history hygiene and releases, investigating history, large repositories
and repository structure, and hooks and attributes. Part 1 covers groups 1–6 with the same visual
language: commits are small circles on horizontal lanes, time flowing left to right, labelled with
a short id and message; a branch is a coloured name tag pointing at a commit; HEAD is a small
marker attached to the branch tag, or to a commit when detached; a remote is a second, framed copy
of the graph labelled "origin" above the local one; the working tree, index and repository are
three side-by-side trays when files matter; a rewritten commit is a copy with a new id (`C3'`).
Hosted-Git ideas add people and checks around the graph: author and reviewer figures, and CI
checks as small gates turning ✓ green or ✗ red.

Elements this file adds, kept the same in every plan (reviewed in stage 3, so nothing here means
two things):

| Element               | Looks like                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Merge base            | A commit circled by a thin ring labelled "merge base" (part 1's three-way triangle has it as a corner). Never a flag: flags are refs.                  |
| Tag                   | Part 1's gold-star tag on the same flag pole as a branch (`git-refs`); it never moves.                                                                 |
| Pull request          | A framed "PR #42" panel above the graph, pinned by a dashed line to the branch tip, holding the diff, reviewer stamps, check gates and a merge button. |
| Tested-on marker      | A small bracket under main showing which main commit a check ran against; a ruler measures how far main has moved since.                               |
| Branch protection     | A shield around a branch tag, with its rules clipped to it; refused pushes bounce off it.                                                              |
| Feature flag          | A small on/off switch beside a commit (Delivery's `feature-flags`), never a flag shape.                                                                |
| Throwaway test branch | A dashed lane holding a temporary combination (main + A + B) that CI builds and then discards.                                                         |

## Collaborating on hosted Git

### Pull request / merge request (`git-pull-request`)

**The aha**: A pull request isn't part of Git; it's a window the host opens onto your branch,
showing only what changed since the branch split off, updating with every push, and merging for
you when it's approved.
**Misconception to defeat**: That a PR is a Git feature (or related to `git pull`), stored in the
repository alongside the commits.
**Cast**: Main as a teal lane; an orange `feature` branch off the merge-base ring. A host frame
("GitHub") above the graph holding the PR #42 panel: diff pane, reviewer figure, CI gate, merge
button, and a dashed pin to the branch tip.
**Opening frame**: Main 1–2–3, `feature` pushed with A, B off commit 3; the host frame empty.
**Story**:

1. The author clicks "Open pull request": the panel appears in the host frame, pinned to B.
   Caption "A PR watches your branch."
2. A and B light up between the ring and the tip; main dims; the diff pane fills with just their
   changes. Caption "Only what changed since you split off."
3. The CI gate spins amber, then turns ✓ green. Caption "Checks run on every push."
4. The author pushes C: the pin slides to C, the diff grows, the gate re-spins. Caption "Push
   again, and the PR updates."
5. A teammate's commits 4 and 5 land on main; the ring stays on 3, so the diff doesn't change.
   Caption "Main moving on doesn't clutter it."
6. A reviewer approves; Merge is pressed: the host creates merge commit M on main (or squashes or
   rebases, `git-pr-merge-methods`), and the panel closes.

**The moment**: Beat 2 at half speed: the branch's commits lit, everything else dimmed — a PR is
a filtered view of a branch, not a separate thing.
**Interaction**: Move main forward and see the diff hold until you merge main into the branch;
clone the repository and find no PR in it.
**Ending**: The host frame fades; the local graph keeps M and the commits, and no trace of #42.
Caption "The PR lived on the host. Git kept the commits."
**Variants**: `git-code-review`, `git-pr-merge-methods`, `git-ancestry-and-ranges`,
`git-fork` (Git); `pull-request-checks` (Delivery).
**Techniques**: lanes, appear/disappear, move, spotlight, restyle, boundary, caption.
**Review**: Improved — the ending now proves the PR lives on the host, not in Git (the stated
misconception was never shown); "until you fetch" corrected (only merging or rebasing main into
the branch moves the base); the diff lights the branch's commits, not "main"; merge-base ring.

### Code review (`git-code-review`)

**The aha**: Review is a conversation that ends in a verdict, and the verdict gates the merge; but
an approval is given to one version of the code, so a push after approval either resets it or
slips past it unreviewed.
**Misconception to defeat**: That an approval covers "the PR" from then on, rather than the commit
it was given on; or that review is just another automated check.
**Cast**: The PR #42 panel over C5, its merge button; a reviewer figure with a magnifying glass;
comment bubbles anchored to diff lines; a green approval stamp tethered to the commit it was given
on; a rule switch "dismiss stale approvals".
**Opening frame**: Tip at C5, the diff open, merge button grey "review required".
**Story**:

1. The glass sweeps the diff; two bubbles pin to lines; the reviewer submits "Request changes"
   and the merge button locks red. Caption "Review is a gate…"
2. The author replies in one thread and pushes a fix, C6; both bubbles resolve. Caption "…and a
   conversation."
3. Approval: the stamp's tether clips to C6; the merge button turns green. Caption "Approved: this
   version."
4. The author pushes a "small tweak", C7. Switch on: the tether snaps, the stamp falls, the button
   locks again. Caption "New code, new review."
5. Replay with the switch off: the stamp stays tethered to C6, the button stays green, and C7 is
   merged; its lines arrive on main outlined red, never read. Caption "Off: unreviewed code rides
   an old approval."

**The moment**: Beats 4 and 5 side by side at half speed: the same C7 push, the stamp falling in
one and staying green in the other while unread code walks through.
**Interaction**: Push after approval with the switch on or off; also try "require approval of the
most recent push" and see who is allowed to approve C7.
**Ending**: Holds on the stamp tethered to one commit. Caption "An approval is for one version."
**Variants**: `git-pull-request`, `git-branch-protection`, `git-codeowners`,
`git-required-status-checks`, `git-stacked-pull-requests`.
**Techniques**: spotlight, restyle, move, toggle, side by side, failure, caption.
**Review**: Improved — the gate is now shown (request changes locks merge), and the switch-off
case shows the real risk: GitHub still counts the old approval, so C7 merges unreviewed (the
draft had it merely "stale" and unapproved).

### Merge commit vs squash vs rebase merge (`git-pr-merge-methods`)

**The aha**: All three buttons ship the same code but leave three different shapes on main: every
commit plus a join, one commit per PR, or rewritten copies in a straight line. You're choosing
what history you'll read later.
**Misconception to defeat**: That the merge button's options are cosmetic and leave "the same
history".
**Cast**: Three identical columns, each main 1–2–3–4 with a PR branch c1, c2, c3 off 3, headed
"Merge commit", "Squash and merge", "Rebase and merge"; an unlit "same code" tick under each.
**Opening frame**: Three identical unmerged graphs, each with its PR panel showing the same diff.
**Story**:

1. Column 1: merge commit M lands with parent lines to 4 and c3; c1–c3 stay in main's history.
   Caption "Every commit, plus a join."
2. Column 2: one new commit S lands holding the whole diff; c1–c3 fade, left off main. Caption "One
   commit per PR."
3. Column 3: c1′, c2′, c3′ are copied onto 4 with new ids, no merge commit. Caption "Copies, in a
   straight line."
4. All three "same code" ticks light together; the three shapes sit side by side. Caption "Same
   code. Three histories."
5. Follow-up: the branch isn't deleted and gets c4. Column 1's new PR shows only c4. Columns 2 and
   3 hold copies, not c1–c3, so Git doesn't know the branch merged: their PRs show c1–c4 again,
   and rebasing column 2's branch replays c1–c3 onto S and a conflict card bursts. Caption
   "Squashed or rebased? Delete the branch."

**The moment**: Beat 4 at half speed: three ticks lighting at once under three different shapes —
the choice is about history, never the result.
**Interaction**: Pick a method per PR across several PRs and watch main's shape build up; run
`git bisect` on each and see it land on a single commit or a whole squashed PR.
**Ending**: Three mains labelled "complete", "one per PR", "linear, rewritten". Caption "Choose the
history you'll want to read."
**Variants**: `git-merge-vs-rebase` (Git), `git-interactive-rebase` (Git), `git-linear-history`,
`git-atomic-commits`; GitLab's semi-linear method (merge commit, but only when a fast-forward was
possible).
**Techniques**: side by side, clone, restyle, move, failure, caption.
**Review**: Improved — corrected the follow-up beat: rebase-merge also leaves only copies on main,
so it doesn't continue "cleanly" either (only a merge commit does); the moment moved to the
same-code/three-shapes reveal, which is the aha; bisect added to the interaction.

### Branch protection and rulesets (`git-branch-protection`)

**The aha**: Plain Git lets anyone with write access rewrite any branch; protection moves the rules
onto the server, so they can't be skipped, even by accident.
**Misconception to defeat**: Confusing this with client-side hooks (skippable) or plain repository
permissions (who can write at all, not what writes are allowed).
**Cast**: Main's branch tag with a shield drawn around it, a rule list clipped to the shield
("require PR", "require 2 approvals", "require checks", "no force-push", "no delete"), and a
developer figure at a terminal with ordinary write access.
**Opening frame**: Main in an `origin` frame, unprotected, no shield; the developer's push,
force-push and delete actions sit ready and unobstructed beside it.
**Story**:

1. The developer force-pushes a stale main: teammates' commits 5 and 6 vanish from origin.
   Caption "With write access, anyone can rewrite main."
2. An admin draws the shield around main's tag; rules clip on, some from this repository, one
   stacked on from an organisation-wide ruleset. Caption "Rules live on the server."
3. The same force-push bounces off the shield: red ✗, "force-push not allowed". Caption "Now
   the server refuses it."
4. The developer opens a PR instead; it clears each rule in turn (PR ✓, approvals ✓, checks ✓)
   before the shield lets the merge through. Caption "Every rule, every time."
5. Beside the shield, a local hook (from `git-hooks`) is skipped with `--no-verify` while the
   shield stands firm. Caption "Client hooks can be skipped. This can't."

**The moment**: Beat 3, the bounce at half speed — the same command that erased work in beat 1,
refused by the server before anything changes.
**Interaction**: Toggle individual rules and try force-push, delete and direct push; add a second
ruleset and see that where rules overlap, the strictest applies; give yourself bypass and watch
the shield let you through.
**Ending**: Holds on the shielded main, all rules green, the developer routed through a PR. Caption
"Plain Git trusts everyone with write access. The server doesn't have to."
**Variants**: `git-required-status-checks`, `git-codeowners`, `git-linear-history`,
`git-signed-commits`, `git-force-push` (Git), `git-hooks`; Azure Repos branch policies (Azure).
**Techniques**: boundary, failure, restyle, toggle, caption.
**Review**: Improved — rulesets (folded into this row by the catalog) now appear: stacked rule
sets, strictest wins, bypass in the interaction; beat 1 shows whose work is lost; ending caption
sharpened.

### Required status checks (`git-required-status-checks`)

**The aha**: A green check only proves your commit passed against the base it was tested with;
"require up to date" retests against the newest base, at the cost of rerunning constantly.
**Misconception to defeat**: Believing a green check on a PR guarantees it will be fine when merged,
however long ago it ran.
**Cast**: Main as a teal lane; a PR branch that adds a call to `getUser()`; a row of named check
gates under the PR ("build", "tests"); the tested-on bracket under the main commit the checks ran
against, with a ruler to main's tip; a "required" padlock on the merge button; a CI-runs meter.
**Opening frame**: The bracket on main's tip, both gates green, the merge button unlocked.
**Story**:

1. A teammate's PR lands first, renaming `getUser` to `fetchUser`; main moves two commits ahead.
   The bracket stays put, the ruler reads "2 behind", the gates stay green. Caption "Green… against
   an old main."
2. Merged anyway: main's own build goes red, "getUser is not defined". Caption "Passed alone.
   Broke together."
3. Rewind. "Require branches to be up to date" switches on: the button locks while the ruler reads
   more than 0. The author clicks Update branch, main is merged in, the checks rerun on the new
   commit and fail; the bug is fixed on the branch first. Caption "Retested against today's main."
4. Three green PRs, strict mode on: A merges, B and C fall behind and rerun; B merges, C reruns
   again. The meter reads 6 runs for 3 merges, each author waiting their turn. Caption "Safe, but
   everyone keeps rerunning."

**The moment**: Beat 2 at half speed: green gates above a red main, the ruler that warned of it
lit.
**Interaction**: Toggle strict mode and merge several PRs in a row; watch the run meter climb as
roughly n²/2 and the last author update over and over.
**Ending**: Holds on the rerun pile. Caption "Solving this for real needs a queue."
**Variants**: `git-merge-queue`, `git-pull-request`, `git-branch-protection`;
`pull-request-checks`, `continuous-integration` (Delivery).
**Techniques**: lanes, meter, failure, restyle, toggle, caption.
**Review**: Improved — a concrete break (rename vs new call) replaces the abstract "red crack";
"retested" now shows the real mechanism (the author updates the branch, checks rerun on a new
commit); the treadmill is counted (6 runs for 3 merges) so the hand-off to the merge queue lands.

### CODEOWNERS (`git-codeowners`)

**The aha**: A CODEOWNERS file maps paths to the people who know them, so touching a path pulls in
its owners as reviewers, and branch protection can make their approval mandatory, even for edits
to the ownership file itself.
**Misconception to defeat**: That it controls who can write to those paths (that's permissions;
CODEOWNERS only routes review), or that the most specific pattern wins.
**Cast**: A file tree (`api/`, `billing/`, `billing/legacy/`, `frontend/`); a CODEOWNERS card with
ordered rows (`/billing/ @finance`, `/billing/legacy/ @payments-old`, `/frontend/ @ui`,
`/.github/CODEOWNERS @admins`); a PR #42 panel whose changed files collect owner avatars.
**Opening frame**: The tree and the CODEOWNERS card side by side, no PR yet.
**Story**:

1. A PR touches `billing/invoice.ts` and `frontend/button.tsx`: traces run file → matching row →
   avatar, and @finance and @ui appear as requested reviewers. Caption "Touch a path, get its
   owners."
2. A PR touches `billing/legacy/tax.ts`: two rows match; the lower one, `/billing/legacy/`,
   wins. Caption "The last matching line wins."
3. What if someone appends `* @everyone` at the bottom? Every trace snaps to that line; @finance
   and @ui drop off every PR. The line is undone. Caption "Order matters, not specificity."
4. A PR edits CODEOWNERS itself: its own row fires, @admins is pulled in. Caption "Even the rules
   are owned."
5. Branch protection's shield turns on "require code owner review": the merge waits for @finance
   and @ui specifically, not any two approvals. Caption "Their approval, not just anyone's."

**The moment**: Beat 3 at half speed: one careless line at the bottom silently rerouting every
review — "last match wins" as a consequence you see, not a rule to memorise.
**Interaction**: Change which files a PR touches and watch avatars arrive; drag rows up and down
and watch ownership move.
**Ending**: Holds on a PR with exactly the right owners required and stamped. Caption "Reviews go to
the people who own the code."
**Variants**: `git-branch-protection`, `git-code-review`, `git-monorepo-vs-polyrepo`.
**Techniques**: path trace, spotlight, restyle, caption.
**Review**: Improved — patterns fixed (`/billing/*` doesn't match `billing/legacy/…`, so the
draft's overlap couldn't happen); the moment is now the classic failure, a catch-all appended at
the bottom overriding every owner, which proves position beats specificity; "requested" vs
"required" reviewers separated.

### Merge queue / merge train (`git-merge-queue`)

**The aha**: Two PRs can each pass alone and still break main together. A merge queue tests each PR
on top of main plus every PR ahead of it, building those combinations itself and in parallel, so
main stays green without every author rebasing and rerunning by hand.
**Misconception to defeat**: That green PRs are safe to merge in any order (auto-merge), or that a
queue just merges PRs one at a time (it tests the combinations, several at once).
**Cast**: Main as a teal lane. Three approved PR cards, each green against yesterday's main: A
renames `getUser` to `fetchUser`, B adds a call to `getUser`, C touches docs. A queue track, and
throwaway test branches drawn as dashed lanes, each labelled with its stack (`main+A`).
**Opening frame**: Three green cards beside main, each with a tested-on bracket at the same old
commit; the queue track empty.
**Story**:

1. Without a queue, auto-merge: A lands, B lands; main's build goes red, "getUser is not defined".
   Caption "Both green. Together: broken."
2. Rewind. A, B, C join the queue; three dashed test branches build at once: `main+A`,
   `main+A+B`, `main+A+B+C`. Nobody touches their branch. Caption "Each tested with everything
   ahead of it."
3. `main+A` ✓: A merges; main's tip advances. Caption "Pass, and it merges."
4. `main+A+B` ✗ "getUser is not defined": B's card is ejected back to its author with the error;
   its dashed branch is discarded and main never sees it. Caption "Fails together: caught before
   main."
5. The branch behind B is rebuilt without it, `main+A+C`, ✓; C merges. Caption "Those behind are
   retested without it."

**The moment**: Beat 4 beside beat 1 at half speed: the same red build, in a throwaway branch
instead of on main.
**Interaction**: Reorder the queue or pick which PR breaks; set how many test branches build at
once and compare the time with `git-required-status-checks`' rerun treadmill.
**Ending**: Main green with A and C landed in order; B parked with its error. Caption "Test what
will actually land."
**Variants**: `git-required-status-checks`, `git-pull-request`; GitLab merge trains (same idea);
`merge-queue` (Delivery, the same concept from the pipeline side).
**Techniques**: lanes, contents, side by side, failure, move, restyle, caption.
**Review**: Rethought — the draft's contrast was wrong ("require up to date" does catch the
collision; its cost is reruns, so the failure on main belongs to auto-merge), and its one-at-a-time
slot hid that queues build combinations in parallel; it also failed the last PR, so "those behind
are retested" was never shown. Now a concrete break, parallel stacks, a mid-queue ejection.

### Stacked pull requests (`git-stacked-pull-requests`)

**The aha**: A big change can ship as a chain of small PRs, each based on the branch below it, so
each shows only its own layer and all can be reviewed at once; the cost is replaying the layers
above whenever a lower one changes, which is why it needs tooling.
**Misconception to defeat**: That you must wait for one PR to merge before building on it, or that
branches cut from branches stay in sync by themselves.
**Cast**: Main as a teal lane; three short branches stacked like stairs, `part-1` (c1) off main,
`part-2` (c2) off c1, `part-3` (c3) off c2; a PR panel over each whose base arrow points at the
branch below and whose diff meter reads ~200 lines.
**Opening frame**: Left, a ghost "one big PR: 600 lines" panel with a reviewer and a long scroll;
right, the same change as three stacked panels of 200 lines each.
**Story**:

1. PR1 opens against main; the author keeps building, PR2 on `part-1`, PR3 on `part-2`, without
   waiting. Each panel lights only its own commit. Caption "Each PR shows only its layer."
2. Three reviewers read the three panels at the same time. Caption "Reviewed in parallel, not in
   turn."
3. Review asks for a change in PR1; c1 is amended to c1′. c2 and c3 still sit on the old c1, now
   faded. Caption "Change a lower layer…"
4. A restack (`git rebase --update-refs`, or a stacking tool) replays c2 and c3 onto c1′ in one
   motion; all three branch tags jump together. Caption "…and everything above is replayed."
5. PR1 merges; PR2 retargets to main and restacks; then PR2, then PR3. Caption "Merge bottom-up."

**The moment**: Beat 4 at half speed: the branch tags jumping onto new copies together, a cascade
that would otherwise be one manual rebase per branch.
**Interaction**: Amend any layer and restack, or rebase each branch by hand and see what happens
if you forget one.
**Ending**: Main holds c1′, c2′, c3′ landed in order. Caption "Big changes, small reviews."
**Variants**: `git-interactive-rebase` and `git-rebase` (Git), `git-pull-request`,
`git-code-review`, `git-pr-merge-methods`.
**Techniques**: lanes, clone, move, restyle, side by side, caption.
**Review**: Improved — the restack trigger is now a lower layer changing in review (the draft's
"dangling link after merge" isn't what happens when PR1 merges with a merge commit), parallel
review is shown, and the 600-line opening makes "one big PR" the visible wrong model.

## Branching workflows

### Feature branch workflow (`git-feature-branch-workflow`)

**The aha**: Branches keep main stable and give every change a place for review and CI, but the
longer a branch lives, the more that delay costs at merge time.
**Misconception to defeat**: Assuming any branch-per-feature setup is automatically safe, regardless
of how long a branch lives.
**Cast**: Main as a teal lane; four coloured feature branches peeling off, each with a small age
timer, a PR panel and a check gate.
**Opening frame**: Main with four branches freshly cut, timers at zero, main's commits all green.
**Story**:

1. Each branch commits and opens a PR. One branch's check goes ✗ red; the fix lands on the branch
   and it turns green; main never sees the red. Caption "Broken work stays on its branch."
2. Three merge back within a day, each a small bump on main's unbroken green line. Caption
   "Main only gets reviewed, tested work."
3. The fourth stays open; its timer climbs from hours to a week while main keeps moving, and
   a ruler between its branch point and main's tip stretches, filling with other people's commits.
   Caption "Meanwhile, main moves on."
4. It finally merges: conflict cards burst wherever its edits meet those intervening commits.
   Caption "The longer it waits, the more it collides with."

**The moment**: Beats 3 into 4, slowed down on the stretching ruler turning into a burst of
conflicts — the delay itself, made visible as distance.
**Interaction**: Dial the branch's lifetime from hours to weeks and watch the commits it missed,
and the conflicts at merge time, grow.
**Ending**: Holds on the short branches merged cleanly beside the long one tangled in conflicts.
Caption "Short branches, quick merges."
**Variants**: `git-trunk-based-development`, `git-github-flow`, `git-gitflow`, `git-pull-request`,
`git-merge-conflict` (Git).
**Techniques**: lanes, timer, move, failure, dial, caption.
**Review**: Improved — the benefit half of the aha is now shown, not asserted (a red check caught
on a branch while main stays green), so the cost in beats 3–4 lands against something.

### Trunk-based development (`git-trunk-based-development`)

**The aha**: Everyone integrates small changes into one shared branch at least daily, hiding
unfinished work behind switches instead of on branches, so integration never piles up and trunk
is always releasable. That is what continuous integration actually means.
**Misconception to defeat**: That trunk-based means "no code review" (short-lived branches still
go through quick PRs), or that unfinished features can't be merged.
**Cast**: Side by side, the same five features over one week (Mon–Fri ruler). Top, "long branches":
the long-branch scene from `git-feature-branch-workflow`. Bottom, "trunk-based": one main lane,
branches that live a few hours, and feature-flag switches beside unfinished work. Under each panel
a meter, "unintegrated work".
**Opening frame**: Both panels on Monday at the same commit, both meters at zero.
**Story**:

1. Bottom: a branch lives three hours, gets a quick PR review, merges; half a feature lands behind
   a switch set off, and main stays green. Caption "Small, reviewed, merged the same day."
2. All week: bottom's meter is a low sawtooth, emptying every day; top's meter climbs steadily as
   five branches drift from main. Caption "Integrate daily, and nothing piles up."
3. Friday, top: the branches merge; the meter's whole week of drift lands at once in a pile of
   conflict cards, main red. Caption "Or integrate it all at once."
4. Friday, bottom: a switch flips on and the finished feature goes live, with no merge at all.
   Caption "Turning a feature on isn't a merge."

**The moment**: The Friday split-screen at half speed: top's meter dumping a week of drift into
conflicts, bottom's sitting near zero as a switch flips.
**Interaction**: Dial branch lifetime from hours to weeks and watch the meter's shape go from
sawtooth to ramp, and Friday from calm to conflicts.
**Ending**: Both meters as charts over the week, sawtooth beside ramp. Caption "Continuous
integration means integrating, continuously."
**Variants**: `git-feature-branch-workflow`, `git-github-flow`, `git-release-branches`;
`feature-flags`, `continuous-integration` (Delivery).
**Techniques**: side by side, lanes, meter, chart, restyle, failure, dial, caption.
**Review**: Improved — added the "unintegrated work" meter (sawtooth vs ramp), which shows why
daily integration is safer instead of asserting it; the misconception "no code review" is now
answered on screen (beat 1's quick PR); the false ending ("top is red more often than green")
replaced.

### GitHub flow (`git-github-flow`)

**The aha**: For continuously deployed software, one long-lived branch plus short-lived feature
branches through a PR is enough — no develop or release branch to keep in sync.
**Misconception to defeat**: Confusing this with GitFlow's extra branches, or treating it as
identical to trunk-based development.
**Cast**: Main as a teal lane with a rocket marker on the commit that's deployed, and a counter
"long-lived branches: 1". Short orange branches with PR panels. For the contrast, GitFlow's five
lanes, dimmed.
**Opening frame**: Main's tip with the rocket on it, labelled "always deployable".
**Story**:

1. Branch from main, commit, open a PR. Caption "Branch from main."
2. Review and checks pass on the PR; some teams first deploy the branch itself (a dashed rocket on
   its tip). Caption "Review, test, maybe deploy the branch."
3. Merge: the rocket moves to the new tip and the branch tag is deleted. Caption "Merge, deploy,
   delete the branch."
4. The same change traced through both models side by side: GitHub flow, branch → main (one merge,
   hours); GitFlow, feature → develop → release → main (three merges, days). The counter reads 1
   beside GitFlow's 2. Caption "No develop branch, no release branch to sync."

**The moment**: Beat 4 at half speed: two path traces for one change, one short hop beside a long
relay through three branches.
**Interaction**: Toggle "deploy branch before merge" to see the dashed rocket; dial branch
lifetime under a day and the caption notes it now also counts as trunk-based development.
**Ending**: Main's tip with the rocket, branches merged and gone. Caption "One branch, always ready
to ship."
**Variants**: `git-trunk-based-development`, `git-gitflow`, `git-feature-branch-workflow`,
`git-pull-request`.
**Techniques**: lanes, move, path trace, side by side, dial, caption.
**Review**: Improved — the moment was "the rocket never moving", which isn't an event; it's now a
path-trace race of one change through GitHub flow vs GitFlow, and the interaction shows how
GitHub flow relates to trunk-based development (the other half of the misconception).

### GitFlow (`git-gitflow`)

**The aha**: GitFlow fits software that ships numbered versions and supports several at once; for
continuously delivered services its long-lived branches slow integration, which is why its own
author now steers teams elsewhere.
**Misconception to defeat**: Treating GitFlow as the default, modern way to use branches.
**Cast**: Five stacked lanes: main (releases only, each with a gold-star tag), develop
(integration), feature branches off develop, a release branch cut from develop, a hotfix branch cut
from main, with faint arrows for the prescribed merge paths (feature→develop; release→main and
develop; hotfix→main and develop).
**Opening frame**: All five lanes idle, arrows faint, "the paths you're meant to follow."
**Story**:

1. Two feature branches merge into develop over a week; develop accumulates. Caption "Features
   integrate into develop, not main."
2. A release branch cuts from develop to stabilise; fixes land there, then it merges into both main
   (tagged v1.4.0) and back into develop. Caption "Release branches merge two ways."
3. An urgent hotfix cuts from main, fixes, merges into both main (tagged v1.4.1) and develop — which
   has already moved on, so the merge has to reconcile with unrelated new work. Caption "Hotfixes
   merge two ways too."
4. Zoomed out, the full lane diagram is busy with crossing double-merge arrows. A quote card:
   "a legacy Git workflow" (Atlassian), and the author's own 2020 note recommending a simpler flow
   for continuous delivery. Caption "Built for versioned releases. Heavy for continuous delivery."

**The moment**: Beat 4's zoomed-out tangle of double-merge arrows, the complexity shown all at once
after the viewer has felt each one land individually.
**Interaction**: Skip the hotfix's merge into develop and cut the next release: v1.5.0 ships the bug
again. Toggle "continuous delivery" and watch develop and the extra merge arrows fade into GitHub
flow's single line.
**Ending**: Holds on the tangled diagram, then dissolves into the single-branch GitHub flow shape.
Caption "Built for versions. Simplify if you ship continuously."
**Variants**: `git-github-flow`, `git-release-branches`, `git-trunk-based-development`, `git-tags`.
**Techniques**: lanes, move, path trace, toggle, failure, caption.
**Review**: Improved (light) — the approach is right (feel each double merge, then see the tangle);
added the failure GitFlow's double merges exist to prevent (skip one and the fix is lost next
release) to the interaction, attributed the quote and the author's note, tags drawn as part 1's
gold stars, techniques corrected (no boundary is drawn).

### Release branches and backporting (`git-release-branches`)

**The aha**: Fix on trunk first, then cherry-pick the fix down to each release that needs it; fixing
only on a release branch means the bug comes back in the next release.
**Misconception to defeat**: Confusing this with GitFlow's release branches (which merge back
wholesale) or with environment branches.
**Cast**: Trunk as the top lane; two release lanes cut from earlier points, `release/1.0` and
`release/2.0`, each carrying a gold-star tag on the commit that shipped (`v1.0.0`, `v2.0.0`), while
trunk keeps moving right past both.
**Opening frame**: Trunk running on; two release lanes branching off below it, each ending at its
release tag.
**Story**:

1. A bug is found in 2.0: the fix lands on trunk first, as a normal commit. Caption "Fix forward, on
   trunk."
2. The same commit is cherry-picked (a clone, new id) onto `release/2.0`, tagged v2.0.1. Caption
   "Then backport the fix down."
3. The identical commit is cherry-picked again onto `release/1.0`, tagged v1.0.1 — two clones of one
   fix now live in two lanes. Caption "Backport to every release that needs it."
4. Contrast: a careless fix applied only to `release/2.0`, skipping trunk. A new `release/3.0` later
   cuts from trunk — the bug is still there, unpatched, red ✗. Caption "Fix only on the branch, and
   it comes back."
5. 1.0's support ends; `release/1.0` is deleted — its tag `v1.0.1` stays, so the shipped code is still
   findable. Caption "The branch can go. The tag stays."

**The moment**: Beat 4's bug reappearing in a brand-new release — proof that skipping trunk doesn't
just risk repetition, it guarantees it eventually.
**Interaction**: Choose "fix on trunk then backport" or "fix on release branch only," then cut a new
release and see whether the bug is present.
**Ending**: Trunk clean, every affected release patched, the deleted branch's tag still standing;
fixes only ever flow down, and no merge arrow runs from a release lane back up to trunk. Caption
"Upstream first, then backport."
**Variants**: `git-gitflow`, `git-cherry-pick` (Git), `git-tags`, `git-semantic-versioning`,
`git-environment-branches`.
**Techniques**: lanes, clone, token, failure, toggle, caption.
**Review**: Improved (light) — the plan was already sharp (the bug resurfacing in a new release is
the right failure); tags now sit on the commits that shipped rather than at the cut point, beat 5
got its caption, and the ending shows release branches never merge back (the GitFlow confusion).

### Environment branches (GitLab flow) (`git-environment-branches`)

**The aha**: Environment branches make "what's deployed where" readable in Git, but each
environment is built from its own branch, so one shortcut leaves production running code no other
environment has run; promoting one unchanged build through every environment avoids that.
**Misconception to defeat**: That environment branches are release branches, or that merging the
same commits down means every environment runs the same thing.
**Cast**: Three stacked lanes, main, staging, production, each with a "running here" marker and a
small build box it was built into; promotion arrows from main down to staging down to production.
**Opening frame**: All three lanes at the same commit, markers aligned, three identical build boxes.
**Story**:

1. Main gets three commits; merging main into staging promotes them, and staging builds its own
   box. Caption "Promote by merging down."
2. Staging merges into production, which builds again. Caption "One environment at a time."
3. An urgent fix H is committed straight onto production, skipping main and staging. Caption "A
   hotfix that skips a step…"
4. The next promotion runs main → staging → production: production now runs the new work plus H,
   a combination staging never ran, and main still lacks H. Production's build box outlines red.
   Caption "…and production runs what staging never tested."
5. Side by side: one build, `v1.8.0`, slides unchanged through staging and production; the hotfix
   goes to main first and becomes `v1.8.1`, which takes the same path. Caption "One build,
   promoted: nothing to drift."

**The moment**: Beat 4 at half speed: production's red-outlined box, a build no other environment
ever ran, appearing one merge after the shortcut.
**Interaction**: Toggle "upstream first" (GitLab flow's own rule: fix on main, then promote) and
watch the drift never appear; toggle it off and count how many promotions until it surfaces.
**Ending**: Holds on the drifted three-lane picture beside the one build flowing through. Caption
"Branches per environment drift. One promoted build can't."
**Variants**: `git-release-branches`, `git-gitflow`; `environment-promotion`,
`build-once-deploy-many`, `gitops-environment-promotion` (Delivery).
**Techniques**: lanes, move, token, toggle, side by side, failure, caption.
**Review**: Improved — "drift" is now concrete (production running a hotfix-plus-new-work build
staging never ran, main missing the fix) instead of abstract dashed lines; each branch's separate
build is drawn, which is why the promoted-artifact contrast matters; upstream-first in the
interaction; the muddled ending caption replaced.

## History hygiene and releases

### Linear history (`git-linear-history`)

**The aha**: A straight line is easier to read, bisect and revert, but it erases when and how
parallel work actually came together; teams choose it on purpose and enforce it on the server.
**Misconception to defeat**: Assuming "clean history" always means linear, or that it's the automatic
result of using Git correctly.
**Cast**: Two mains side by side, each with the same three features landing. Left: "merge commits
allowed". Right: "linear history required", main's tag inside the protection shield. Under each, a
`git log --oneline` panel that prints as commits land.
**Opening frame**: Both sides, three feature branches about to land.
**Story**:

1. Left: each feature merges with a merge commit, leaving a fork-and-rejoin bump; the log panel
   interleaves feature commits with "Merge pull request #12" lines. Caption "Shows that parallel
   work happened."
2. Right: the same three features land by rebase or squash; main stays one flat row and the log
   reads as a plain list. Caption "One line. Which branch? No longer recorded."
3. Bisect on both: on the left it steps into feature-branch commits main never ran on its own;
   on the right every step is a commit main actually had. Caption "Easier to bisect."
4. One feature must be undone: the left needs `revert -m 1` on its merge (and the re-merge trap of
   `git-revert-merge-commit`); the right reverts that feature's squashed commit. Caption "Easier to
   revert, too."
5. On the right, a push carrying a merge commit bounces off the shield: "linear history required".
   Caption "Chosen on purpose, enforced by the server."

**The moment**: Beat 2 at half speed: the same features that made three bumps on the left landing
as a flat row, both log panels side by side.
**Interaction**: Toggle "require linear history" and try to merge a feature the merge-commit way;
watch it bounce. Switch bisect to `--first-parent` on the left and see it walk main only.
**Ending**: Both final mains side by side, one textured with history, one flat and simple. Caption
"Pick the shape your team will read later."
**Variants**: `git-pr-merge-methods`, `git-branch-protection`, `git-bisect`,
`git-merge-vs-rebase` and `git-revert-merge-commit` (Git).
**Techniques**: side by side, lanes, contents, restyle, move, failure, toggle, caption.
**Review**: Improved — beat 3's claim that bisect "has to pick a parent at each merge" was wrong
(it walks merges automatically); the real cost is wandering into side-branch commits, now shown,
with `--first-parent` in the interaction. Added `git log` panels, since reading the log is where
people meet linear history.

### Atomic commits and good messages (`git-atomic-commits`)

**The aha**: One logical change per commit, each one building, with a message that says why: then
review, bisect, revert and cherry-pick can each take exactly one change.
**Misconception to defeat**: That a commit is just a save point ("wip", "fix"), or that squashing
those into one commit per PR fixes it.
**Cast**: The same three changes (input validation, cursor pagination, docs) cut two ways. Top,
"save points": "wip", "fix", "more fixes", "actually fix it", each holding scraps of all three,
two that don't build. Bottom, "atomic": "Add input validation", "Switch pagination to cursors",
"Document the new endpoint". Tool icons under both: review glasses, bisect magnifier, revert arrow.
**Opening frame**: Both lanes with the same code at the tip, the three changes colour-coded: the
top's commits mixed stripes, the bottom's solid colours.
**Story**:

1. Review: on top the glasses wander, each commit half of everything; on bottom one comment per
   commit, each message saying what and why. Caption "One change, one review."
2. A pagination bug is reported. Bisect on top skips the two broken commits and ends on "wip", a
   stripe of everything; on bottom every step builds and it lands on the pagination commit.
   Caption "Bisect needs commits that build."
3. Revert: on top, reverting "wip" also pulls out half the validation and the build breaks, red ✗;
   on bottom, reverting the pagination commit removes exactly that. Caption "Revert takes a whole
   commit, so make it one change."
4. The top lane is squashed into one commit: it builds now, but bisect and revert can only take all
   three changes together. Caption "Squashing hides the mess. It doesn't split it."

**The moment**: Beat 3 side by side at half speed: the same tool, one red build, one clean lift.
**Interaction**: Drag commit boundaries over the same diff (save points, one squash, atomic) and
watch review, bisect, revert and cherry-pick succeed or fail.
**Ending**: The bottom lane, every tool lit green; a blame chip on a pagination line opens its
commit message, "why" included. Caption "One change, one commit, one reason."
**Variants**: `git-pr-merge-methods`, `git-bisect`, `git-blame`, `git-code-review`,
`git-interactive-rebase` and `git-cherry-pick` (Git).
**Techniques**: side by side, lanes, restyle, failure, path trace, caption.
**Review**: Improved — beat 3 misdescribed revert (it reverts exactly one commit's diff; the harm
is that a mixed commit carries good work with it); the story now defeats the stated misconception
(a squash beat) instead of ignoring it; colour-coded stripes make "mixed" visible; cherry-pick moved
to the interaction to keep one idea per beat.

### Signed commits and tags (`git-signed-commits`)

**The aha**: Author name and email are plain text anyone can set; a signature proves which key made
the commit, and the host shows "Verified" only when that key is registered to the person named.
**Misconception to defeat**: Confusing this with content hashing (proves integrity, not identity) or
push authentication (proves who uploaded, not who authored).
**Cast**: A commit with a plain-text author label, dashed to suggest "just text", and the host's
avatar beside it. A wax-seal icon that appears only when signed, stamped with its key. A key
registry panel on the host: "Alice: 🔑A".
**Opening frame**: Two commits on a lane, both labelled "Alice", both showing Alice's avatar.
**Story**:

1. Rewind to how the second was made: Mallory sets `user.name "Alice"` and `user.email
alice@co.com`, then commits. The host matches the email and shows Alice's avatar. Caption
   "Anyone can type any name."
2. Alice's real commit: she signs with her key, a seal with 🔑A stamps on; the host checks it
   against the registry, it matches, "Verified". Caption "A signature proves which key signed it."
3. Mallory signs too, with her own key 🔑M: a seal appears, but it doesn't match Alice's registered
   key. "Unverified". Caption "Not just any seal: the named person's."
4. An annotated tag `v1.4.0` gets the same treatment, its own seal beside the hash it already has.
   Caption "Same idea, on releases."

**The moment**: Beats 2 and 3 side by side at half speed: two commits that both say Alice, both
sealed, only one key matching the registry.
**Interaction**: Toggle signing on and off, swap keys, and turn on vigilant mode (unsigned commits
claiming to be you marked "Unverified"); require signed commits on main's shield and watch
Mallory's push bounce.
**Ending**: Holds on a lane where only seals matching the registry carry "Verified", whatever the
author labels say. Caption "The seal proves the key. The name is just text."
**Variants**: `git-content-addressing` (Git), `git-tags`, `git-remote-authentication` (Git),
`git-branch-protection`; supply-chain provenance (Security).
**Techniques**: restyle, spotlight, side by side, toggle, caption.
**Review**: Improved — the impostor now gets Alice's real avatar on the host (what actually
happens) and, in beat 3, signs with the wrong key: the seal alone isn't enough, the key has to
belong to the person named, which is the actual check; vigilant mode and required signatures added
to the interaction.

### Tags and tagging releases (`git-tags`)

**The aha**: Unlike branches, tags never move: they mark exactly what shipped, a fixed point you
can build, compare or roll back to forever.
**Misconception to defeat**: Confusing tags with branches, or with the host's "Releases" page built
on top of them.
**Cast**: Main's lane with its teal branch tag riding the tip, and part 1's gold-star tag `v1.4.0`
planted on one commit: the same flag shape, a different habit (`git-refs`). An `origin` frame above.
**Opening frame**: Main with the branch tag at the tip and `v1.4.0` a couple of commits back.
**Story**:

1. Three commits land; the branch tag slides forward each time; the star stays put, the gap
   between them widening. Caption "Branches move. Tags never do."
2. A lightweight tag (bare star) and an annotated tag (a star with a card: tagger, date, message,
   optional seal) are planted at a later commit, `v1.5.0`. Caption "A bare name, or an object
   with its own details."
3. `git push`: origin gets the commits but no stars. `git push origin v1.5.0`: the star appears
   in origin, and the host's Releases page builds on it. Caption "Tags are pushed separately."
4. Someone needs exactly 1.4.0: HEAD detaches onto the star's commit, untouched by anything since.
   Caption "A fixed point to build or roll back to."
5. `git describe` on a commit three past `v1.5.0` prints `v1.5.0-3-ga1b2c3d`, a small ruler
   counting the steps. Caption "Any commit, named by its nearest tag."

**The moment**: Beat 1 at half speed: the same flag shape, one sliding and one standing still, the
gap between them growing.
**Interaction**: Add commits and watch the branch slide while the stars stay; jump to any star and
see the frozen snapshot; push with and without the tag.
**Ending**: Holds on main with several stars behind the branch tag. Caption "Tags mark what
shipped. Branches mark what's next."
**Variants**: `git-refs` and `git-detached-head` (Git), `git-release-branches`,
`git-signed-commits`, `git-semantic-versioning`.
**Techniques**: move, restyle, appear/disappear, caption.
**Review**: Improved — tags drawn as part 1's gold stars (the draft introduced a new flag shape);
added the most common real surprise, that `git push` leaves tags behind; `git describe` output fixed
(hashes are lowercase hex, `g` + abbreviated id); beats 1 and 2 merged, they were one idea.

### Semantic versioning (`git-semantic-versioning`)

**The aha**: A version number is a promise about compatibility: PATCH fixes, MINOR adds without
breaking, MAJOR breaks the public API. So consumers can take PATCH and MINOR automatically and
treat a MAJOR bump as a migration.
**Misconception to defeat**: That a version is just a count, like a build number or a date, or that
"2.0" means "big new features".
**Cast**: The library's commit lane with gold-star release tags; a version plate with three slots,
MAJOR.MINOR.PATCH; commit-message cards arriving above the lane (`fix:`, `feat:`, `feat!:`). On the
right, a consumer app whose dependency `^1.4.2` is drawn as a bracket on a number line from 1.4.2
up to, not including, 2.0.0.
**Opening frame**: Tag `v1.4.2` on the lane, the plate reading 1.4.2, the consumer inside the
bracket.
**Story**:

1. `fix: crash on empty cart` → PATCH ticks: tag `v1.4.3`. Inside the bracket, so the consumer's
   next update takes it ✓. Caption "PATCH: a fix. Safe to take."
2. `feat: export to CSV` → MINOR ticks, PATCH resets: `v1.5.0`. Still inside; the consumer's old
   calls still work ✓. Caption "MINOR: something new, nothing broken."
3. `feat!: remove v1 API` → MAJOR ticks, the others reset: `v2.0.0` stops at the bracket's edge.
   The consumer stays on 1.5.0, a "migration needed" card waiting. Caption "MAJOR: breaking. You
   opt in."
4. A `0.9.0` plate appears with a warning stripe. Caption "Below 1.0: anything can change."
5. The cards file themselves into a changelog under Fixes, Features and Breaking. Caption "The
   commit messages decide the number."

**The moment**: Beat 3 at half speed: two versions slid into the bracket, the third stops at its
edge, the number itself telling the consumer to stop.
**Interaction**: Feed in fix, feat and breaking commits and watch the tag and changelog compute;
ship a breaking change as `1.6.0` and watch it slip inside the bracket and break the consumer.
**Ending**: The plate at 2.0.0, the consumer safely on 1.5.0, the changelog beside them. Caption
"The number is a promise, not a count."
**Variants**: `git-tags`, `git-release-branches`, `git-atomic-commits`; `semantic-versioning` and
`automated-dependency-updates` (Delivery).
**Techniques**: restyle, boundary, contents, token, failure, caption.
**Review**: Improved — replaced the auto-update switch that "flips itself off" (nothing works that
way) with the consumer's declared range as a bracket, which is the real mechanism that lets PATCH
and MINOR in and keeps MAJOR out; versions are now tags on the lane; the dishonest-bump failure
added to the interaction. Delivery's `semantic-versioning` plan covers the same concept: one of
the two should be merged into the other in stage 4.

## Investigating history

### Ancestry references and commit ranges (`git-ancestry-and-ranges`)

**The aha**: Most "what's on this branch?" questions are reachability questions: `main..feature`
is what a merge would bring in. But the dots change meaning in `git diff`, where three dots
compare from the merge base, which is exactly what a PR shows.
**Misconception to defeat**: That `..` and `...` mean the same thing in `log` and in `diff`.
**Cast**: Main (teal, with an older merge commit M in its past) and feature (orange) diverging
from a commit ringed "merge base", each with three commits since. A tray of notation chips
(`HEAD~3`, `M^2`, `main..feature`, `main...feature`) that light exactly the commits they name; a
diff pane below.
**Opening frame**: The two lanes diverged from the ring, chips in the tray, nothing lit.
**Story**:

1. `HEAD~3` walks back three first-parent steps from feature's tip and lands on the ring; `M^2`
   takes M's second parent arrow instead. Caption "Relative names: count back, or pick a parent."
2. `git log main..feature`: feature's three commits light; main's stay dim. Caption "Two dots:
   what feature has that main doesn't."
3. `git log main...feature`: both sides' three light. Caption "Three dots: either side, not both."
4. Switch to `diff`. `git diff main..feature` compares the two tips: main's new commits appear in
   the pane as red removals you never made. `git diff main...feature` compares the ring to
   feature's tip: only your changes. Caption "In diff, the dots mean something else."
5. The PR panel from `git-pull-request` slides in: its diff matches the three-dot pane exactly.
   Caption "That's the diff a PR shows."

**The moment**: Beat 4 at half speed: the same two names, two dots vs three, one pane full of
phantom removals and one showing just your work.
**Interaction**: Add commits to either side, move the merge base by merging main in, and watch
each chip's lit set and the two diff panes update.
**Ending**: Holds on the three-dot diff beside the PR panel. Caption "Ranges ask: what can I reach
from here?"
**Variants**: `git-commit-dag` and `git-merge-three-way` (Git), `git-pull-request`, `git-bisect`.
**Techniques**: path trace, spotlight, restyle, side by side, caption.
**Review**: Improved — the story never showed the trap its moment promised: `git diff main..feature`
(tip to tip, main's work shown as removals) is now set against `diff main...feature` (from the
merge base); `HEAD~`/`HEAD^` folded into one beat; merge base drawn as a ring.

### Blame and searching history (`git-blame`)

**The aha**: Blame finds the commit that last touched each line, not why it changed (that's the
commit message and its PR) and not who "wrote the feature"; a reformatting commit can hide the
real history unless it's skipped.
**Misconception to defeat**: Thinking blame assigns fault, or shows "who wrote this feature" rather
than "who last changed this line."
**Cast**: A file with numbered lines, each line's margin showing a commit-id chip and author avatar,
tinted by age; a search bar for the pickaxe (`-S`/`-G`) and for `log -L`.
**Opening frame**: A file, every line annotated with its last-touch chip, varied authors.
**Story**:

1. Clicking a line expands its chip into the full commit, message and PR link included. Caption
   "Blame finds the commit. The message explains it."
2. A mass reformatting commit touches every line at once: every chip flips to that one commit and
   author, erasing the real history underneath. Caption "One formatting pass hides everyone."
3. The reformat's id is listed in `.git-blame-ignore-revs` and blame runs with it: chips snap back
   to the real prior authors. Caption "Skip listed commits, see through them."
4. A pickaxe search for `applyDiscount` lights only the commit that added the name and the one that
   removed it, skipping the dozens that merely edited nearby lines. Caption "Find when a string
   appeared or vanished."
5. `log -L` on one function shows a mini-lane of just that function's own edits over time.
   Caption "Follow one function's whole story."

**The moment**: Beat 2 into 3 — real history vanishing under one reformat commit, then reappearing
the instant the ignore file is applied.
**Interaction**: Run the reformat commit, toggle the ignore file on and off (hosts such as GitHub
read it too), and watch the chips flip.
**Ending**: Holds on the file with chips restored to real authorship. Caption "Blame finds commits,
not culprits."
**Variants**: `git-bisect`, `git-atomic-commits`, `git-ancestry-and-ranges`.
**Techniques**: spotlight, restyle, toggle, path trace, caption.
**Review**: Improved (light) — the approach holds (the reformat-and-restore moment is the right
one); the pickaxe beat no longer muddles a "renamed function" with commits that "moved it"
(`-S` finds where the count of a string changes), the ignore file is named as hosts read it, and
chips are tinted by age.

### Bisect (`git-bisect`)

**The aha**: Binary search finds the one commit that introduced a bug in about log₂(n) tests —
around ten across a thousand commits — as long as every commit builds and holds one change.
**Misconception to defeat**: Thinking you have to check every commit one by one, or confusing bisect
with blame (who last touched a line, not when behaviour broke).
**Cast**: A long, compressed lane of commits with a ruler of ids; a green "good" marker far left,
a red "bad" marker far right, the search band between them; detached HEAD jumping to each
midpoint; a test counter. A dimmed second lane for a one-by-one scan.
**Opening frame**: 1,000 commits, good at 1 (last release), bad at 1000 (today), band spanning all.
**Story**:

1. HEAD jumps to commit 500; the test runs, ✓ good; the good marker moves to 500 and the band
   halves to 500–1000. Caption "Test the midpoint."
2. HEAD jumps to 750, ✗ bad; the bad marker moves down, the band halves to 500–750. Counter: 2.
   Caption "Each answer throws away half."
3. The band keeps halving: 3, 4, 5… The dimmed lane below tests 1, 2, 3, one per round.
4. Test 10: the band is one commit, spotlit, `731 is the first bad commit`. Counter "10 tests,
   1,000 commits"; the scan below has reached commit 10, with 721 to go. Caption "About ten tests,
   not hundreds."
5. `git bisect run ./test.sh` replays the search with a script icon in place of the tester: the
   same halving, no pauses. Caption "Or let a script answer."

**The moment**: Beat 4 at half speed: the spotlit culprit and the counter at 10, above a scan that
has barely started.
**Interaction**: Dial history from 100 to 100,000 commits and watch bisect's count grow by one per
doubling (17 at 100,000) while the scan's grows with the size; mark some commits unbuildable and
see bisect have to skip them.
**Ending**: Holds on the single, spotlit commit — the bug's true origin. Caption "Halve the search,
every time."
**Variants**: `git-blame`, `git-atomic-commits`, `git-linear-history`, `git-detached-head` and
`git-revert` (Git).
**Techniques**: path trace, spotlight, meter, side by side, dial, caption.
**Review**: Improved — the comparison lane was inconsistent (a scan "at 40" after bisect's 10
tests); both now run one test per round, so the scan is at 10 with 721 to go. Markers replace
flags (flags are refs), HEAD's detaching is shown, the dial gives real numbers, and skipping
unbuildable commits links to atomic commits.

## Large repositories and repository structure

### Monorepo vs polyrepo (`git-monorepo-vs-polyrepo`)

**The aha**: A monorepo makes a cross-project change atomic and dependencies visible; a polyrepo
isolates ownership but turns the same change into a coordinated release across many repositories.
**Misconception to defeat**: Confusing this with monolith vs microservices, a deployment question,
not a storage one.
**Cast**: Side by side. Left, "Monorepo": one repo boundary containing `web/`, `api/`,
`shared-lib/`, sharing one commit lane. Right, "Polyrepo": three repo boundaries, `web`, `api`,
`shared-lib`, each with its own lane, linked by dependency arrows labelled with versions (`web` →
`shared-lib v2.3`). Under every project on both sides, its own deploy rocket.
**Opening frame**: Both sides with the same three projects and six separate deploy rockets; a
breaking change to `shared-lib` is needed by both consumers.
**Story**:

1. Left: one commit changes `shared-lib/` and updates `web/` and `api/` to match; one PR, one
   review, CI tests all three together. Below, the three services still deploy on their own.
   Caption "One commit, every consumer updated."
2. Right: the same change is three PRs in three repositories: `shared-lib` merges and tags v2.4,
   then `web` bumps its arrow, then `api`, each on its own schedule, along a time ruler. Caption
   "One change, three repositories, in order."
3. Left: the lane fills with unrelated teams' commits; sparse checkout, affected-only builds and the
   CODEOWNERS card appear as the tooling that keeps it workable. Caption "Scale needs tooling."
4. Right: `api` never bumps; months later its arrow still reads v2.3, two versions behind. Caption
   "Isolation can mean drift."

**The moment**: Beat 2 against beat 1 at half speed: one commit on the left, a staggered chain
stretched along the time ruler on the right, for the same change.
**Interaction**: Make a shared-library change and watch it land as one commit or as a chain of PRs;
grant a contractor access to `api` only and see which side can do that per repository.
**Ending**: Holds on both final states, one current and coupled, one independent but drifting, the
six deploy rockets unchanged. Caption "Where code lives, not how it's deployed."
**Variants**: `git-submodules`, `git-codeowners`, `git-sparse-checkout`, `git-partial-clone`;
`monorepo-affected-builds` (Delivery); service boundaries (Architecture).
**Techniques**: side by side, boundary, lanes, token, move, caption.
**Review**: Improved — the stated misconception (monolith vs microservices) was never shown; deploy
rockets under every project on both sides now make it "storage, not deployment"; polyrepo access
isolation added to the interaction (half the trade-off was missing); paths and repository names
separated.

### Submodules (`git-submodules`)

**The aha**: A submodule pins one exact commit of another repository inside yours, not a branch —
updating it means checking out a new commit inside and committing that new pointer in the parent.
**Misconception to defeat**: Confusing this with subtree (which copies the code in) or with a
package-manager dependency.
**Cast**: A parent repo boundary with a special "gitlink" entry in its tree, drawn as a small framed
window showing a miniature commit lane belonging to a wholly separate repo, pinned to one circled,
highlighted commit.
**Opening frame**: The parent repo, the gitlink window showing the submodule pinned at commit `s3`.
**Story**:

1. The submodule's own repo, shown full-size, gets new commits `s4`, `s5` from its own maintainers;
   the parent's gitlink window doesn't change, still pointing at `s3`. Caption "The parent only
   records one pointer."
2. A developer goes into the submodule directory and checks out `s5`; the window's highlighted
   commit moves. Caption "Update means checking out a new commit inside it..."
3. Back in the parent, this shows up as a one-line diff, "submodule pointer: s3 → s5," which is then
   committed. Caption "...then committing the new pointer here."
4. A teammate clones the parent normally: the gitlink window appears empty, a "?" where the
   submodule's content should be, until they run `git submodule update --init` (or clone with
   `--recurse-submodules`), and it fills in with `s5`'s content. Caption "Clones need an extra
   step."

**The moment**: Beat 1 — the submodule advancing in its own universe while the parent's window stays
frozen, making "a pointer, not a live copy" unmistakable.
**Interaction**: Advance the submodule's own history and watch the parent's gitlink stay put until
someone deliberately updates and commits the new pointer.
**Ending**: Holds on parent and submodule each at a stable, explicitly pinned pairing. Caption "One
repo, pinned to one commit of another."
**Variants**: `git-subtree`, `git-monorepo-vs-polyrepo`, `git-detached-head` (Git: a submodule
sits on a detached HEAD after an update).
**Techniques**: boundary, zoom, token, move, caption.
**Review**: Improved (light) — kept the approach: beat 1's frozen pointer is the right moment and
the story is economical; corrected beat 4 (an existing clone needs `git submodule update --init`;
`--recurse-submodules` belongs on the clone command).

### Subtree (`git-subtree`)

**The aha**: A subtree really copies another project's files, and optionally its history, into a
folder of your repository, so clones and builds need nothing special; the cost is that syncing
with the other project later is a deliberate merge or split.
**Misconception to defeat**: Confusing this with submodules (a pointer, not a copy) or with copying
files by hand, which loses history.
**Cast**: The parent repo boundary and its lane; the other project, `lib`, as its own framed lane
above. For contrast, `git-submodules`' gitlink window, dimmed, in a second panel.
**Opening frame**: The parent repo and the separate `lib` repo with its history, about to be
pulled in.
**Story**:

1. `git subtree add --prefix=vendor/lib` slides `lib`'s files into the parent at `vendor/lib`,
   solid, and its history joins the parent's lane through one merge commit. Caption "The code and
   its history come inside."
2. Side by side, a fresh clone of each parent: the subtree one has `vendor/lib` filled in at once;
   the submodule one shows its "?" window until an extra command runs. Caption "Nothing special to
   clone or build."
3. `lib` ships new commits upstream; `git subtree pull` merges just those into `vendor/lib` as
   one visible merge commit. Caption "Syncing is a deliberate merge."
4. A local fix made inside `vendor/lib` is pulled out with `git subtree split` into its own lane,
   ready to send upstream. Caption "Split changes back out to contribute."

**The moment**: Beat 2 at half speed: two fresh clones, one complete and one with a "?" hole —
the absence of a problem made visible by setting it beside the problem.
**Interaction**: Toggle `--squash` on the add and watch `lib`'s history fold into one commit;
toggle "submodule" vs "subtree" for the same library and clone both.
**Ending**: Holds on `vendor/lib` fully present, part of the parent's own history. Caption "Really
there, not just pointed at."
**Variants**: `git-submodules`, `git-monorepo-vs-polyrepo`, `git-merge-strategies` (Git, the
`subtree` strategy).
**Techniques**: boundary, move, clone, side by side, toggle, caption.
**Review**: Improved — the moment relied on remembering the sibling plan's "?" window; beat 2 now
puts both clones side by side so it works on its own; `--squash` (the "optionally its history" in
the aha) moved into the interaction.

### Git LFS (`git-lfs`)

**The aha**: Every clone holds every version of every tracked file, which explodes with large
binaries; LFS commits tiny pointer files instead and keeps the real bytes on a separate store,
downloading only the versions you check out. It has to be set up before the files are committed.
**Misconception to defeat**: Confusing this with partial clone (on-demand fetching of any object) or
`.gitignore` (which excludes files entirely rather than storing them elsewhere).
**Cast**: A commit lane; an "LFS store" shelf beside the remote; large files as heavy blocks,
pointer files as small cards tethered to their block on the shelf; a meter, "every clone
downloads".
**Opening frame**: Three versions of a 2 GB `intro.mp4` committed the plain way: three heavy blocks
inside history, the meter at 6 GB.
**Story**:

1. Rewind. `git lfs track "*.mp4"` writes a rule into `.gitattributes`; now committing the video
   stores a three-line card (zoom: `oid sha256:4d7a…`, `size 2147483648`) and the block goes to
   the shelf. Caption "Commit a pointer, not the file."
2. Three versions later: three cards in history, three blocks on the shelf. Caption "History holds
   pointers. The shelf holds the bytes."
3. A clone: the cards arrive at once; only the checked-out version's block flies from the shelf.
   Meter: 2 GB, not 6. Caption "Only what you check out downloads."
4. Back to the opening's repo: tracking set up now changes nothing already committed; the blocks
   stay in history until `git lfs migrate` rewrites it (new ids, `git-filter-repo`'s ripple).
   Caption "Too late means a history rewrite."
5. A design file is `git lfs lock`ed: a padlock appears for everyone else. Caption "Binaries can't
   merge, so lock them."

**The moment**: Beat 1 at half speed: the 2 GB block sliding off to the shelf, leaving a
three-line card in the commit.
**Interaction**: Turn tracking on before or after committing a large file; check out older
versions and watch their blocks fly in.
**Ending**: Holds on a repo of small cards beside a shelf doing the heavy lifting. Caption "Light
repo, heavy shelf."
**Variants**: `git-partial-clone`, `git-shallow-clone`, `git-attributes-line-endings`,
`git-filter-repo` (Git).
**Techniques**: toggle, meter, move, restyle, token, zoom, caption.
**Review**: Improved — beat 1 shrank an already-committed video by toggling tracking, which LFS
can't do and which beat 4 then contradicted; the story now starts from the problem, reruns with LFS
set up first, and keeps "too late" as its own beat; the pointer file's real contents and the
`.gitattributes` link added.

### Shallow clone (`git-shallow-clone`)

**The aha**: `--depth N` downloads only the latest N commits: ideal when a build needs one snapshot,
but every command that reads history (log, blame, describe, finding a merge base) stops dead at
the cut.
**Misconception to defeat**: Confusing this with partial clone (full history, file contents fetched
on demand) or sparse checkout (full history, partial working tree).
**Cast**: `origin`'s full lane stretching off-screen to the left, with a gold-star tag `v2.3.0`
thirty commits back. A CI runner box below. The shallow clone as a short lane ending at a cliff
edge labelled "grafted: no parents beyond here". A download meter.
**Opening frame**: Origin's long lane; a CI job about to check out with GitHub Actions' default,
`fetch-depth: 1`.
**Story**:

1. The clone brings down one commit of one branch; its parent arrow dangles off the cliff. The
   meter shows a sliver of the full size. Caption "Just the latest snapshot."
2. Build and tests run on it, done in seconds. Caption "Perfect for a one-off build."
3. `git log` prints one commit, marked `(grafted)`, and stops at the cliff. Caption "History stops
   at the cut."
4. The release step runs `git describe` to name the version: it walks left looking for `v2.3.0`,
   reaches the cliff, `fatal: No names found`. The changed-files step can't find the merge base
   with main either. Caption "Anything that reads history fails."
5. Two fixes: `fetch-depth: 0` (full history; the cliff vanishes, the meter jumps), or
   `git fetch --deepen=50`, pushing the cliff back just past the tag. Caption "Fetch only as deep as
   you need."

**The moment**: Beat 4 at half speed: `describe` walking left and stopping at the cliff, the tag it
needed visible just beyond it on origin.
**Interaction**: Dial the depth from 1 to full and watch which steps pass (build, log, describe,
merge base) against the download meter.
**Ending**: Holds on the short lane and its cliff beside the full remote. Caption "Depth trades
history for speed."
**Variants**: `git-partial-clone`, `git-sparse-checkout`, `git-tags`, `git-ancestry-and-ranges`;
`ci-runners` (Delivery).
**Techniques**: boundary, failure, meter, dial, caption.
**Review**: Improved — the generic blame-hits-the-wall beat became the failure people actually
meet: a CI job on the default depth of 1 whose `git describe` or merge-base step fails; the ending
gives both fixes; the draft's "pushing the cliff back, expensively" (unclear) is gone.

### Partial clone (`git-partial-clone`)

**The aha**: Blobless or treeless clones keep every commit but leave out file contents, fetching
them from the remote on demand when a command actually needs them.
**Misconception to defeat**: Confusing this with shallow clone, which cuts history itself rather than
file contents.
**Cast**: A local lane with every commit present, no cliff — but each commit's blob icons are drawn
as dashed outlines, "known to exist, not yet downloaded." The remote, a solid framed "origin" panel
above, holds everything.
**Opening frame**: Just after `git clone --filter=blob:none`: every commit present, the tip's files
solid (the checkout fetched them), every older blob a dashed outline.
**Story**:

1. `git log` runs across the full lane perfectly, every commit and its metadata present, no wall
   anywhere. Caption "Full history, right away."
2. `git checkout` an old commit: only the blobs it needs fly down from origin and fill in solid;
   everything else stays outlined. Caption "Files download only when you check them out."
3. `git blame` walking back through history sends a round-trip arrow to origin for each old
   version it needs: noticeably slower than in a full clone, but it gets there. Caption "Reads
   history, fetches content as it goes."
4. A `--filter=tree:0` variant shows even directory trees ghosted, fetched on demand too. Caption
   "Can go lighter: tree:0 too."
5. Recap beside shallow clone's cliff-edge picture: nothing here is ever truly missing, just not yet
   downloaded. Caption "Not cut off. Just not downloaded yet."

**The moment**: Beat 2, specific blobs flying down and solidifying exactly when checked out — "on
demand" made literal, right next to shallow clone's wall for contrast.
**Interaction**: Check out different commits and watch which blobs fly in; compare the round-trip
cost against a full clone and a shallow clone.
**Ending**: Holds on a full, outlined lane with only the checked-out commit's files solid. Caption
"Every commit, content fetched as needed."
**Variants**: `git-shallow-clone`, `git-lfs`, `git-sparse-checkout`, `git-object-store` (Git).
**Techniques**: side by side, token, restyle, path trace, caption.
**Review**: Improved (light) — the dashed "known but not downloaded" outline is the right picture
and the shallow-clone contrast is well placed; corrected two details: a blobless clone downloads
the tip's files at checkout (the opening showed none), and blame in a blobless clone can be
markedly slower, not "slightly".

### Sparse checkout (`git-sparse-checkout`)

**The aha**: The repository can hold everything while your working tree shows only the directories
you chose — every commit still records the whole tree, just not all of it checked out to disk.
**Misconception to defeat**: Confusing this with partial clone (what's downloaded) or with
submodules.
**Cast**: Two of part 1's trays side by side: the repository tray holding four project folders
(`web/`, `api/`, `mobile/`, `shared/`) and the working tree tray, which mirrors whatever is
checked out. A disk meter under the working tree.
**Opening frame**: A normal checkout: both trays full of the same four folders, the disk meter
high.
**Story**:

1. `git sparse-checkout set web shared`: `api/` and `mobile/` lift out of the working tree tray
   (top-level files stay) while the repository tray doesn't change; the disk meter drops. Caption
   "Only what you chose is on disk."
2. A teammate's commit touching `api/` is fetched: it lands in the repository tray's full tree;
   the working tree still has no `api/`. Caption "Every commit still records the whole tree."
3. `git log` on the full history works normally, unaffected by what's checked out. Caption "History
   isn't limited by what's checked out."
4. A small "+partial clone" badge appears: paired together, the repository tray itself stops holding
   full blob content for the unchosen folders too, saving disk both ways. Caption "Often paired with
   partial clone in huge monorepos."

**The moment**: Beat 1 at half speed: the working tree tray shrinking to two folders while the
repository tray beside it stays untouched and full — "stored" and "checked out" split apart.
**Interaction**: Add or remove folders from the sparse-checkout set and watch the working tree tray
gain or lose them instantly, with the repository tray never changing.
**Ending**: Holds on a lean working tree tray beside a full repository tray. Caption "See your
slice. The repo still has it all."
**Variants**: `git-partial-clone`, `git-shallow-clone`, `git-monorepo-vs-polyrepo`, `git-three-areas`
(Git).
**Techniques**: contents, meter, toggle, caption.
**Review**: Improved (light) — the moment promised a "shrinking" tray but the opening had it empty;
it now starts from a full checkout so the shrink happens; cone-mode command syntax corrected (and
top-level files noted); disk meter added.

## Hooks and attributes

### Git hooks (`git-hooks`)

**The aha**: Client-side hooks give fast local feedback but aren't cloned and can be skipped;
anything that truly must be enforced belongs on the server instead.
**Misconception to defeat**: That a committed lint hook enforces anything, or that hooks are the
same as CI pipelines or host webhooks and Actions (events on the host, not Git).
**Cast**: The developer's machine (a laptop boundary) with a `.git/hooks` folder whose script icons
sit on the commit and push paths (`pre-commit`, `commit-msg`, `pre-push`); the server's boundary
with its own slots on the path a push arrives by (`pre-receive`, `update`, `post-receive`).
**Opening frame**: Both boundaries, hook slots empty, a commit about to be made.
**Story**:

1. A `pre-commit` lint script drops into the local slot. The developer commits; the script runs
   first, finds a lint error, blocks the commit, red ✗. Caption "Fast, local feedback."
2. `git commit --no-verify`: the same error, but the commit walks straight past the hook. Caption
   "But skippable…"
3. A teammate clones fresh: their `.git/hooks` folder is empty. Caption "…and not cloned: hooks live
   outside history."
4. The bad commit is pushed; at the server boundary `pre-receive` runs the same check and the push
   bounces, red ✗, with no flag to skip it. On hosted Git the same slot is filled by push rules,
   rulesets and required checks. Caption "Server-side, it can't be skipped."
5. After `post-receive`, a webhook arrow leaves the server for an external CI system, clearly
   outside both hook folders. Caption "Webhooks and Actions: a different mechanism."

**The moment**: Beat 2 against beat 4 at half speed: the same check waved past with `--no-verify`
locally, then holding the line at the server boundary.
**Interaction**: Toggle `--no-verify` on a local commit, then push and see whether the server
catches it; set `core.hooksPath` to a committed folder and see that teammates still have to opt in.
**Ending**: Holds on the server's hook as the gate, local hooks as a convenience. Caption "Local
hooks help you. Server hooks hold the line."
**Variants**: `git-branch-protection`, `git-required-status-checks`, `git-attributes-line-endings`;
`ci-cd-pipeline` (Delivery).
**Techniques**: boundary, failure, toggle, path trace, caption.
**Review**: Improved (light) — the story was right; added that hosted Git fills the server slot
with push rules, rulesets and required checks (custom `pre-receive` hooks exist only on
self-managed servers), and that a committed hooks folder still needs each person to opt in;
trimmed.

### .gitattributes and line endings (`git-attributes-line-endings`)

**The aha**: Windows writes CRLF line endings and macOS and Linux write LF; leave that to each
person's settings and one machine can rewrite every line of a file. A `.gitattributes` rule in the
repository normalises to LF on commit for everyone, so diffs show only real changes.
**Misconception to defeat**: That this is about `.gitignore`, or that each developer setting
`core.autocrlf` correctly is the fix.
**Cast**: A file with its line endings drawn (LF: a down-arrow; CRLF: down, then left). The
repository boundary; Windows and macOS machines, each with a personal `core.autocrlf` dial; a PR
diff pane.
**Opening frame**: The repository holds `app.js` with LF endings; the Windows machine's dial reads
`false` (no conversion), its editor set to CRLF.
**Story**:

1. On Windows the editor saves `app.js` with CRLF; the developer changes one line and commits. With
   no conversion, every line's arrow flips as the file enters the repository. Caption "One
   machine's settings…"
2. The PR diff pane: every line red and green, the one real change buried. Caption "…turn a
   one-line change into a whole-file diff."
3. Rewind. `.gitattributes` with `* text=auto` and `*.sh text eol=lf` is committed inside the
   repository boundary; both personal dials dim. Caption "A rule in the repo beats each person's
   setting."
4. The same edit: on commit Git normalises to LF, so the repository's arrows don't flip; Windows
   still gets CRLF on disk. The diff shows one line. Caption "Stored as LF, checked out the way each
   OS likes."
5. `*.png binary` is added: images pass through untouched. Caption "Binary files: never converted."

**The moment**: Beat 2 beside beat 4 at half speed: the same one-line edit as a wall of red and
green, then as one line.
**Interaction**: Toggle `.gitattributes` and each dial and see which combinations produce
whole-file diffs; run a CRLF `.sh` script in a Linux container and watch it fail until `eol=lf`.
**Ending**: Holds on the repository's LF arrows, both personal dials dimmed under the shared file.
Caption "Line endings are a repository rule, not a personal preference."
**Variants**: `git-ignore` (Git), `git-lfs`, `git-snapshots-not-diffs` (Git).
**Techniques**: restyle, toggle, spotlight, side by side, caption.
**Review**: Improved — beat 1's cause was wrong: `core.autocrlf=true` converts back to LF on commit,
so it doesn't produce whole-file diffs; the culprit is a machine with conversion off committing
CRLF. Beat 1 now shows that, beat 4 says what `text=auto` actually does on each side, and the
interaction adds the classic `.sh` failure that `eol=lf` exists for.
