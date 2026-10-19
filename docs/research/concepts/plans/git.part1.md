# Git plans, part 1

Stage 2 plans for the first six groups of [`catalog/git.md`](../catalog/git.md): Git's model,
recording changes, branching and merging, rewriting history, undoing and recovering, and remotes
and syncing. A companion file covers the remaining groups with the same visual language.

## Shared visual language

Every diagram reads **left to right**: time flows forward, so right is later and left is earlier.
Motion to the left means going back — undo, reset, a revert's effect, a walk into the reflog.

**Elements**

| Element                             | Looks like                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commit                              | A small circle on a horizontal lane, labelled with a short id (`a1f3`) and, when there's room, its message underneath. New commits enter from the right edge of the lane.                                                                                                                                                                                                                                                                                                               |
| Parent link                         | A solid arrow from a commit back to its parent(s); two arrows meeting at one commit mark a merge.                                                                                                                                                                                                                                                                                                                                                                                       |
| Branch                              | A coloured name tag (teal `main`, orange `feature`, …) on a short flag pole, planted on the commit it points to.                                                                                                                                                                                                                                                                                                                                                                        |
| HEAD                                | A small white marker clipped to the top of a branch tag; it rides with the tag. Detached, it clips directly onto a commit circle instead, with no tag underneath.                                                                                                                                                                                                                                                                                                                       |
| Working tree / index / repository   | Three side-by-side trays, left to right, whenever individual files matter. Each tray holds a full set of file chips (the index is the whole proposed next commit, not a list of changes). A chip is orange in the working tree when it differs from the index, and green in the index when it differs from the last commit; plain means "same as the tray to its right". `add` copies a chip rightward, `commit` turns the index's set into a new commit circle in the repository tray. |
| Object store (blob / tree / commit) | Nested boxes revealed on zoom beneath a commit: a commit box points to one tree box, which points to blob boxes (files) and smaller tree boxes (subdirectories), each stamped with its short hash. Identical blobs are drawn once, with lines fanning in from every commit that shares them.                                                                                                                                                                                            |
| Rewritten commit                    | A copy of the original circle, offset nearby, stamped with a primed id (`C3'`). Primes are reserved for copies: commits that merely live on another branch get letters (A, B, C) or their own numbers.                                                                                                                                                                                                                                                                                  |
| Unreachable commit                  | A pale outline that stays on the lane: no branch, tag or HEAD reaches it any more (after a rebase, an amend, a reset, or leaving a detached HEAD). A dashed line from the reflog can still point at it; it turns solid again the moment a ref points at it.                                                                                                                                                                                                                             |
| Reflog                              | A ledger strip beneath the lane listing every position a ref has held (`HEAD@{0}`, `HEAD@{1}`, …), newest on top; a dashed line can point from an entry up to the faded commit it names.                                                                                                                                                                                                                                                                                                |
| Remote (`origin`)                   | A second, framed copy of the graph labelled `origin`, drawn above the local one. A remote-tracking ref (`origin/main`) is a dimmer-coloured tag inside the local frame, separate from the local branch tag.                                                                                                                                                                                                                                                                             |
| Conflict                            | A commit or merge point bursts open into a torn-paper card showing `<<<<<<<`, the two competing lines and `>>>>>>>`; it blocks the lane until resolved.                                                                                                                                                                                                                                                                                                                                 |
| Fork                                | A second remote frame, a different tint, linked to the first by a thin line labelled `upstream`.                                                                                                                                                                                                                                                                                                                                                                                        |

**Captions** sit bottom centre, one short line, appearing with their beat. **The moment** runs at
half speed with everything but the key elements dimmed. Side-by-side panels always start from the
identical graph, so only the one difference stands out.

No new technique is needed for this file: a rewrite's "fade but stay" is a **restyle** (colour,
opacity), and every other mechanism is covered by the vocabulary in the README.

## Git's model: how history is stored

### Distributed version control (`git-distributed-version-control`)

**The aha**: Your clone is a complete repository, the whole history, so you can commit, branch and read history offline; "the server" is just the copy your team agreed to treat as the source of truth.
**Misconception to defeat**: Git works like SVN or TFVC: history lives on the server, and your machine holds only a checked-out copy of the files.
**Cast**: Side by side, the same setup: a server frame on top, two laptops below, a cable from each laptop to the server. Left, "centralized (SVN)": only the server holds a commit lane; the laptops hold just trays of files. Right, "Git": the server and both laptops each hold the same five-commit lane.
**Opening frame**: Left: one lane, at the top. Right: three identical lanes. Caption "Where does the history live?"
**Story**:

1. A laptop commits. Left: the commit travels up the cable to the server's lane. Right: it lands on the laptop's own lane; nothing crosses. Caption "Git commits locally."
2. Scissors cut every cable. Caption "Offline."
3. Left: the laptop's commit, log and branch buttons grey out, red. Right: the laptop commits, branches, and walks `log` back to commit 1. Caption "Commit, branch, log, diff: all offline."
4. Both servers go dark. Left: the history goes with them. Right: a laptop pushes its lane to a fresh server, the new `origin`. Caption "The server is just the copy you agreed on."

**The moment**: beat 3 at half speed: the same cut cable, the left laptop frozen, the right one carrying on.
**Interaction**: Cut and restore the cables and try commit, log, branch and push on either side: on the Git side only push waits for the network.
**Ending**: Right panel only: three equal lanes, one labelled `origin` purely by agreement. Caption "Every clone is a complete repository."
**Variants**: `git-clone`, `git-commit`, `git-push`.
**Techniques**: side by side, lanes, contents, clone, failure, toggle, boundary, caption.
**Review**: Rethought — the plan never showed the wrong model, only Git with the network crossed out; now the centralized model runs beside Git through the same cut cable, and a lost server makes "the server is just a copy" (half the catalog's aha, previously missing) visible.

### Snapshots, not diffs (`git-snapshots-not-diffs`)

**The aha**: Each commit is a complete picture of every file, not a patch; unchanged files are simply pointed at again, and diffs are worked out on demand by comparing two pictures.
**Misconception to defeat**: A commit stores only what changed, like a diff or a patch.
**Cast**: Side by side, the same three commits. Left, "if Git stored patches": each commit holds a +/− card of what changed. Right, "Git": each commit, zoomed open, points at a full set of blobs (`README`, `app.js`, `logo.svg`).
**Opening frame**: Commit 1 in both panels: a "+ all three files" card, and three blobs. So far they look the same.
**Story**:

1. Commit 2 edits only `app.js`. Left: a card, "app.js: line 4 changed". Right: commit 2 points at a new `app.js` blob and at the SAME `README` and `logo.svg` blobs as commit 1. Caption "Every commit is a complete picture."
2. Commit 3 edits only `README`; two of its three lines land on blobs that already exist. Caption "Unchanged files: the same blob, pointed at again."
3. Check out commit 3. Left: cards 1, 2 and 3 replay in order to rebuild the files. Right: commit 3's blobs drop into the working tree in one step. Caption "Checkout reads one snapshot. Nothing is replayed."
4. `git diff 1 3`: the two sets line up; `logo.svg`, the same blob in both, is skipped at a glance, and only the files that differ are compared. Caption "Diffs are computed when you ask."

**The moment**: beat 3 at half speed: the left panel grinding through three patches while the right paints commit 3 in one step.
**Interaction**: Scrub to any commit in both panels: the patch side's replay chain grows with every commit, Git's checkout stays one step. Edit one file across many commits and count how few new blobs appear.
**Ending**: Right panel alone: three full sets, mostly sharing blobs. Caption "Whole pictures, stored cheaply by sharing."
**Variants**: `git-object-store`, `git-content-addressing`, `git-packfiles` (where deltas really appear, as storage).
**Techniques**: side by side, zoom, contents, path trace, restyle, caption.
**Review**: Rethought — the old plan only asserted "not a patch" with a crossed-out icon (a beat that changed nothing) and named a blob `C1` alongside commit `C1`; it now runs a patch model beside Git so the replay-versus-one-step checkout is seen, and adds the on-demand diff the catalog's aha calls for.

### The object store: blobs, trees, commits (`git-object-store`)

**The aha**: A commit is a tiny pointer to one tree; the tree fans out to blobs and subtrees. Filenames live in the tree, not in the blob.
**Misconception to defeat**: The working-tree view of folders and files; or that a commit directly contains the changed files.
**Cast**: A zoomed object-store view beneath a commit lane: commit box → tree box → labelled arrows to blob boxes and nested tree boxes, each stamped with its short hash.
**Opening frame**: One commit box, opened to show its few lines of text (`tree 8d2c`, `parent 3e7a`, author, date, message) and no files at all; a single arrow runs down to one unopened tree box. Caption "A commit holds no files."
**Story**:

1. The tree opens, fanning into named arrows: "README.md", "src/", one to a blob, one to a subtree. The blob box holds only content, no name. Caption "Trees name things; blobs don't."
2. "src/" opens into another tree, fanning to more blobs. Caption "Directories are trees of trees."
3. A second commit, made after renaming README.md to README2.md with identical content: it gets a new tree, whose arrow now reads README2.md, landing on the SAME blob box. Caption "A rename is a new name in a tree, not a new blob."
4. A spotlight on that blob lights every tree, in both commits, with an arrow pointing to it. Caption "One blob, stored once, pointed at by every tree that needs it."

**The moment**: beat 3: the rename producing zero new blobs, just a new tree with a new label on the same arrow, directly against "Git tracks renames."
**Interaction**: Rename, move, edit and copy a file in turn, and see which actions create a new blob (edits only) and which create only new trees (renames, moves, identical copies).
**Ending**: The full nested object graph sits visible beneath the commit lane, like a tiny filesystem Git built itself.
**Variants**: `git-content-addressing`, `git-snapshots-not-diffs`, `git-packfiles`, `git-tags` (the fourth object kind, the annotated tag).
**Techniques**: zoom, contents, path trace, spotlight, caption.
**Review**: Improved — the opening now opens the commit itself (a few lines of text, no files), which defeats "a commit contains the changed files" in the first frame; fixed the claim that a rename only relabels an arrow (it makes a new tree) and the interaction's matching error; replaced a story-time "hover" with a spotlight.

### Content addressing (object hashes) (`git-content-addressing`)

**The aha**: An object's name IS a hash of its content, so one changed byte changes every id up the chain — nothing can be edited silently.
**Misconception to defeat**: Hashes are arbitrary version numbers, or random ids Git hands out.
**Cast**: A lane of three commits (`f0e1`, `29bc`, `d4a7`), each recording its parent's id. Beneath the first, zoomed open: its tree `8d2c` and one blob `a1f3` holding the text "hello". Every id is stamped large on its box.
**Opening frame**: The lane and the open chain at rest, every id stable.
**Story**:

1. One character of the blob changes ("hello" → "hellO"): its id recomputes from `a1f3` to `7c90`, flashing red. Caption "An object's name is computed from its content."
2. The tree names the blob by id, so the tree's id changes; the commit names the tree, so the commit's id changes. Two more boxes flash red, bottom to top. Caption "The change ripples up…"
3. The ripple turns right: commit 2 records commit 1's id as its parent, so its own id changes, then commit 3's. Caption "…and forward through every later commit."
4. Two unrelated commits each contain a file reading "hello"; both point at the one `a1f3` box. Caption "Same content, same id: stored once."
5. Someone edits a stored blob's bytes behind Git's back: the content no longer hashes to its name, and a warning triangle appears. Caption "Tampering shows."

**The moment**: beats 2–3 in slow motion: one keystroke recolouring the blob, its tree, its commit and then every commit after it.
**Interaction**: Edit the blob's text, or only an old commit's message, and watch which ids recompute: a message edit leaves trees and blobs alone but still changes every later commit.
**Ending**: Holds on the settled lane, all new ids. Caption "Editing history makes new commits; it never edits in place."
**Variants**: `git-object-store`, `git-rebase`, `git-amend`, `git-signed-commits` (a hash proves integrity, not who wrote it).
**Techniques**: lanes, zoom, restyle, path trace, spotlight, caption.
**Review**: Improved — the ripple stopped at the commit, which misses why history can't be edited silently; it now carries on through the parent ids into every later commit, the reason amend and rebase must make new commits. The interaction is corrected to match: a message edit does change every later commit's id.

### The commit graph (DAG) (`git-commit-dag`)

**The aha**: History is a graph of backward-only links; a branch's history is everything reachable by walking parent arrows from its tip.
**Misconception to defeat**: History is a single ordered timeline of versions.
**Cast**: A lane of commits as circles, with arrows pointing left, back to parents only.
**Opening frame**: A straight line of four commits under a `main` tag, each arrow pointing to the one before it.
**Story**:

1. A `feature` tag starts at commit 2 and grows its own commits 5, 6 on a lane above. Caption "Branches share commits, then diverge."
2. A spotlight walks back from `feature`'s tip along the arrows: 6, 5, 2, 1 light up; 3 and 4 stay dark. Caption "A branch's history: everything reachable from its tip."
3. `feature` is merged into `main`: commit 7 appears with two arrows, back to 4 and to 6. Caption "A merge commit has two parents."
4. The same walk from `main`'s tip 7 now forks at the merge and lights every commit, 5 and 6 included. Caption "Merging makes feature's commits part of main's history."
5. The commits' timestamps shuffle out of order; the shape and the walk don't change. Caption "Order comes from the links, not the clock."

**The moment**: beat 4 against beat 2: the same backward walk, first stopping short of 3 and 4, then, through the merge's second arrow, reaching everything.
**Interaction**: Click any commit to light its own reachable set; click a merge commit to see both parent walks fan out.
**Ending**: The full DAG glows once, then settles. Caption "History is links, not a line."
**Variants**: `git-refs`, `git-merge-three-way`, `git-ancestry-and-ranges`.
**Techniques**: lanes, path trace, spotlight, appear/disappear, caption.
**Review**: Improved — "reachable" was shown only from the merge tip, where everything lights and nothing is excluded; a first walk from `feature`'s tip now leaves 3 and 4 dark, so the second walk through the merge visibly gains them.

### Refs: names for commits (`git-refs`)

**The aha**: Branches, tags and remote-tracking refs are the same mechanism — a name pointing at a commit — differing only in who moves them and when.
**Misconception to defeat**: Branches, tags and `origin/main` are different kinds of objects.
**Cast**: Three coloured tags on the same commit: teal `main` (branch), gold star `v1.0` (tag), grey dashed `origin/main` (remote-tracking) — identical flag shapes, different colours and borders.
**Opening frame**: All three tags planted on the same commit `f0e1`.
**Story**:

1. Zoom into the flags: each is just a name and a commit id, `refs/heads/main → f0e1`, `refs/tags/v1.0 → f0e1`, `refs/remotes/origin/main → f0e1`, three identical one-line cards. Caption "Three kinds of name. One mechanism."
2. A new local commit lands: the teal `main` flag slides to the new tip, its card's id rewritten. The others stay put. Caption "A branch moves when you commit."
3. `git fetch` runs: the grey dashed flag slides to the remote's new tip. Caption "A remote-tracking ref moves when you fetch."
4. Commits and fetches come and go; the gold tag never moves. Caption "A tag stays put."

**The moment**: beat 1's zoom: three things people think of as different turning out to be the same one-line card, then beats 2–3 showing the same slide with different triggers.
**Interaction**: Commit, fetch and tag in any order and watch only the matching flag move. Delete a branch: its card goes, its commits stay (pale, if nothing else reaches them).
**Ending**: Three flags on three different commits. Caption "One mechanism, three habits."
**Variants**: `git-head`, `git-remote-tracking-branches`, `git-tags`, `git-branch`.
**Techniques**: zoom, contents, move, restyle, caption.
**Review**: Improved — "one mechanism" was only implied by similar slides; a zoom now shows all three as the same name-and-id card, which is the whole aha. The deletion beat, which removed the checked-out `main` (Git refuses) and contradicted the three-flag ending, moved to the interaction.

### HEAD and switching branches (`git-head`)

**The aha**: HEAD means "where you are." Committing moves the branch (and HEAD rides along); switching rewrites the files on disk to match the target.
**Misconception to defeat**: HEAD is always the newest commit, or the tip of main.
**Cast**: A `main` lane (commits 1, 2, 3, 6) and a `feature` lane above it branching from 2 (commits 4, 5), HEAD clipped to whichever tag is current, plus the working-tree and index trays below.
**Opening frame**: HEAD clipped to `main` on commit 6, the newest commit; `feature`'s tag sits unmarked on 5.
**Story**:

1. `git switch feature`: HEAD unclips, slides across, and clips onto `feature`'s tag on 5, an older commit than 6; the index and working-tree trays repaint to commit 5's snapshot. Caption "Switching moves HEAD and rewrites your files to match."
2. A commit is made: `feature`'s tag slides forward to 7; HEAD, still clipped, comes along. Caption "Committing moves the branch. HEAD rides along."
3. With an uncommitted edit to `app.js`, which differs between the branches, `git switch main` is refused, red, and HEAD stays put. (An edit to `README`, identical on both, would simply have ridden along.) Caption "A switch won't overwrite uncommitted work."

**The moment**: beat 1: HEAD's clip visibly detaching, travelling and reattaching on a commit that isn't the newest, synced with the trays repainting.
**Interaction**: Make an edit, then try switching: carried along when the file is the same on both branches, refused when it would be overwritten. Type `HEAD~1` or `HEAD~2` to light the commit counted back from wherever HEAD sits.
**Ending**: HEAD settled on `feature`, trays matching. Caption "HEAD: where you are, not what's newest."
**Variants**: `git-detached-head`, `git-branch`, `git-three-areas`, `git-ancestry-and-ranges`.
**Techniques**: lanes, move, restyle, contents, failure, caption.
**Review**: Improved — `HEAD^2` was drawn on a commit that isn't a merge (it would be an error), and the revision syntax belongs to `git-ancestry-and-ranges`, so it moved to the interaction as `HEAD~n`; HEAD now lands on a commit older than the newest, so the misconception is actually contradicted; only the index and working tree repaint on a switch, not the repository.

### Detached HEAD (`git-detached-head`)

**The aha**: You can look around and even commit with HEAD on a bare commit, but with no branch tag to carry those commits forward, they become unreachable the moment you switch away.
**Misconception to defeat**: Detached HEAD is an error, or means lost or corrupted work.
**Cast**: The same lane; HEAD clipped directly onto a commit circle with no flag underneath — drawn with a faint dashed outline to show it isn't anchored to a name.
**Opening frame**: `main`'s tag and HEAD together on commit 5, the normal case.
**Story**:

1. `git checkout v1.2` (a tag on commit 3): HEAD unclips from `main` and clips bare onto commit 3, no flag underneath. Caption "Detached: HEAD points straight at a commit. Nothing is broken."
2. A new commit 3a appears, HEAD clipped to it, but no tag follows; 3a sits as an island on a short lane above 3. Caption "You can still commit here."
3. `git switch main`: HEAD slides back onto `main`'s flag. Commit 3a, with nothing pointing at it, fades to a pale outline, while Git's own warning scrolls past: "you are leaving 1 commit behind". Caption "Switch away, and nothing points at it."
4. The reflog ledger lists `HEAD@{1}` = 3a, a dashed line pointing up to the faded commit. Caption "Still there, until garbage collection, if you find it in the reflog."

**The moment**: beat 3's fade: the island becomes unreachable at the exact instant HEAD leaves it, because no branch was ever there to hold it.
**Interaction**: Before switching away, run `git switch -c experiment`: a flag plants on 3a and it stops fading. Also try the everyday ways in (checking out a tag, a bisect step, a CI checkout) and see HEAD detach each time.
**Ending**: Holds on the faded island commit with its reflog thread. Caption "No branch, no safety net but the reflog."
**Variants**: `git-head`, `git-reflog`, `git-bisect`, `git-tags`.
**Techniques**: restyle, move, appear/disappear, path trace, caption.
**Review**: Improved — the first caption now says plainly that nothing is broken (the named misconception was never addressed); Git's real warning appears at the fade; the interaction names the fix (`switch -c`) and the everyday ways people end up detached.

### Packfiles and the transfer protocol (`git-packfiles`)

**The aha**: Git compresses related objects into packs and, when syncing, sends only what the other side is missing — so a second fetch is tiny.
**Misconception to defeat**: Every fetch or push re-sends the whole repository; or that packing is the same thing as the snapshot model.
**Cast**: Two repository frames, "origin" above and "yours" below, each a shelf of object boxes beside its commit lane. A pack icon (a tied bundle), a size meter on the wire between them, and speech-bubble messages for the negotiation.
**Opening frame**: Both shelves hold loose, unpacked objects; origin's lane is two commits ahead of yours.
**Story**:

1. Time-lapse: loose objects gather into one tied bundle; versions of the same file are redrawn as one full box plus thin delta slivers. Caption "Packing stores similar objects as deltas, to save space."
2. A fetch begins. Your side says "want: origin's tip" and "have: `d4a7`", your latest commit. Since an id covers all history behind it, that one "have" vouches for everything below it on your shelf. Caption "Negotiate: wants and haves."
3. Origin packs only the objects you lack, two commits' worth, and one small bundle crosses; the meter barely moves beside a crossed-out ghost of the whole shelf. Caption "Only what's missing crosses the wire."
4. A second fetch, one new commit later: an almost-empty pack crosses. Caption "A second fetch is tiny."

**The moment**: beat 3: a sliver crossing the wire beside the crossed-out ghost of the whole shelf.
**Interaction**: Let the remote run ahead by 1, 10 or 1,000 commits, then fetch, and watch the pack size scale with what's missing, never with the size of the repository.
**Ending**: Both shelves equal, almost nothing sent on the latest sync. Caption "Snapshots stay the model; packing and the protocol keep it cheap."
**Variants**: `git-content-addressing`, `git-clone`, `git-shallow-clone`, `git-partial-clone`.
**Techniques**: contents, exchange, token, meter, boundary, caption.
**Review**: Improved — the negotiation is now right (the client names commits it has, not every object hash, and one "have" vouches for the whole history behind it, tying back to content addressing); origin sits above per the shared language; added the **exchange** technique the wants/haves dialogue needs.

## Recording changes

### Working tree, index (staging area), repository (`git-three-areas`)

**The aha**: A change moves working tree → index → repository in stages you control, down to a single hunk — a commit never just grabs whatever's on disk.
**Misconception to defeat**: Committing takes whatever files currently exist on disk.
**Cast**: Three trays left to right: working tree, index, repository (a commit lane). The first two each hold a full set of chips `a`, `b`, `c` (orange: differs from the index; green: differs from the last commit). Two magnifying glasses, `git diff` and `git diff --staged`.
**Opening frame**: All chips plain, both trays matching the last commit. Caption "Three copies of your files."
**Story**:

1. You edit `a`, and `b` in two places: both turn orange in the working tree. Caption "Working tree: the files you edit."
2. `git add a`: the new `a` is copied into the index, green there, plain on disk. Caption "Index: the next commit, being assembled."
3. `git add -p b`: `b` splits into its two hunks and only hunk 2 is copied across. `b` is now green in the index AND orange on disk. Caption "Stage part of a file, down to the hunk."
4. `git commit`: the index's set becomes a new commit and the index goes plain. Hunk 1 of `b` stays orange on disk, left out. Caption "Commit takes the index, not the disk."
5. The glasses settle over the gaps: `git diff` over the orange, `git diff --staged` over the green. Caption "status and diff compare the trays in pairs."

**The moment**: beat 4 at half speed: the commit lands holding `a` and half of `b`, while the other half sits orange on disk, plainly not included.
**Interaction**: Edit several files, stage whole files or single hunks, and commit; see exactly which changes reach the commit and which stay behind.
**Ending**: The new commit on the lane; the leftover hunk still orange on disk. Caption "You decide what a commit contains."
**Variants**: `git-commit`, `git-stash`, `git-reset-modes`.
**Techniques**: contents, move, restyle, zoom, caption.
**Review**: Improved — the index was drawn as a list of staged changes, which is wrong (it's a full snapshot) and breaks the reset plan that repaints it; trays now hold full sets, with orange and green meaning exactly what `git diff` and `git diff --staged` show. The moment moves to the commit that leaves a hunk behind, which defeats "commit takes what's on disk" directly.

### Commit (`git-commit`)

**The aha**: A commit is entirely local — nothing leaves your machine — and it's never edited, only replaced by a new commit.
**Misconception to defeat**: Committing shares the change (confusing it with push); or a commit can be edited in place.
**Cast**: Index tray, the local repository lane inside a laptop boundary, and an `origin` frame above, holding the same commits 1–3.
**Opening frame**: The index holds the next snapshot, one file staged (green); both lanes end at commit 3. Caption "Ready to commit."
**Story**:

1. `git commit`: the index's snapshot is sealed into a new circle, 4, and its card shows what it records: the snapshot, parent 3, author, time, message, and the id `9b1e` computed from all of it. Origin doesn't change. Caption "A commit happens only on your machine."
2. The branch tag slides onto 4. Caption "The current branch moves forward."
3. A pencil reaches for 4's message and is refused, red. Instead `commit --amend` makes 4' with a new id; 4 fades but stays, threaded to the reflog. Caption "Never edited. Replaced."
4. `git push` carries 4' up to origin; it's the first time anything crosses. Caption "Nothing leaves until you push."

**The moment**: beat 1's still origin beside the new commit, then beat 3's refused pencil beside the copy-and-fade that actually happens.
**Interaction**: Commit several times and watch origin stay frozen until you push; try editing a commit (blocked), then amend it and watch the real mechanism.
**Ending**: Origin and local both end at 4'. Caption "Local until pushed. Replaced, never edited."
**Variants**: `git-three-areas`, `git-amend`, `git-push`, `git-content-addressing`.
**Techniques**: move, clone, contents, restyle, failure, boundary, caption.
**Review**: Improved — the push carried "commits 1–4'" to an origin that should already hold 1–3; origin now starts with them and receives only 4'. The new commit's card shows what a commit records, the id computed from it, which sets up "never edited" instead of asserting it.

### .gitignore (`git-ignore`)

**The aha**: Ignore rules only hide untracked files from Git's radar; a file already committed stays tracked, and anything ever committed is still in history after you ignore it.
**Misconception to defeat**: Adding a pattern to `.gitignore` removes or hides a file that's already committed.
**Cast**: A working-tree tray with chips above a commit lane; a `.gitignore` card listing patterns; a `git status` panel. Untracked chips are dim grey with a "?" badge, tracked chips solid.
**Opening frame**: Two env files: `local.env`, untracked (dim, "?"), and `prod.env`, committed weeks ago (solid). Both appear in the status panel.
**Story**:

1. `*.env` is added to `.gitignore`: `local.env`'s "?" badge disappears and it drops out of the status panel. Caption "Ignore rules hide untracked files."
2. The same pattern matches `prod.env` too, but nothing happens: still solid, still tracked, and its next edit still shows in status. Caption "Already tracked? Ignoring does nothing."
3. `git rm --cached prod.env` stops tracking it (the file stays on disk), but scrubbing the lane back finds its contents untouched in the old commit. Caption "It's still in history."
4. A red "ROTATE ME" stamp lands on that old commit. Caption "A committed secret needs rotating, not ignoring."

**The moment**: beat 2: one pattern, two matching files; one vanishes from Git's view, the other doesn't flinch. Beat 3's scrub then shows the deeper problem.
**Interaction**: Add patterns and test them against untracked and tracked files; `rm --cached` a tracked one and scrub back to find it still there.
**Ending**: Holds on the lane with the old commit flagged red. Caption "Ignore keeps new files out. It can't erase old ones."
**Variants**: `git-filter-repo`, `git-attributes-line-endings`.
**Techniques**: contents, restyle, spotlight, path trace, caption.
**Review**: Improved — the story was broken: the `*.env` pattern could never match `secret.txt`, so beat 2 proved nothing. Two `.env` files (one untracked, one committed) now make the same pattern hit both with different results, which is the misconception's exact test; `rm --cached` now says the file stays on disk.

### Stash (`git-stash`)

**The aha**: A stash is a temporary, unshared commit kept off to the side, so you can switch context with a clean tree and bring it back later, possibly on another branch.
**Misconception to defeat**: A stash is a commit on the branch (it isn't pushed or shared); or it's the same as a worktree.
**Cast**: Working-tree tray with modified chips, the commit lane above it, and a shelf off to the side, inside the laptop boundary. Each stash on the shelf is a wrapped commit circle, tagged `stash@{n}`, with a thin thread back to the commit it was made on.
**Opening frame**: Two orange (modified) chips in the working tree, HEAD on `feature`; the shelf is empty.
**Story**:

1. `git stash` wraps the two chips (staged and unstaged alike) into a commit circle, `stash@{0}`, that lands on the shelf, not on the branch; the working tree goes clean. Caption "Uncommitted work, set aside as a commit."
2. HEAD switches to `main`; the parcel stays on the shelf, its thread still leading to `feature`'s commit. Caption "A stash isn't tied to one branch."
3. `git stash pop` unwraps it onto `main`'s files: one chip collides and a conflict card opens. The parcel stays on the shelf until you resolve and drop it. Caption "Reapplying can conflict."
4. An older parcel at the back of the shelf gathers dust. Caption "Old stashes are easy to forget."

**The moment**: beat 1's instant clean-up: orange chips vanishing from the tree and reappearing, wrapped, as a commit on the shelf.
**Interaction**: Stash on one branch, switch, and pop: it applies cleanly or conflicts depending on what the new branch touched. Leave an untracked file in the tree and stash: it stays behind unless you use `stash -u`. Try pushing: the shelf never leaves the laptop.
**Ending**: One dusty parcel left on the shelf. Caption "A stash is a commit nobody else will ever see."
**Variants**: `git-three-areas`, `git-worktrees`, `git-merge-conflict`.
**Techniques**: contents, move, restyle, failure, boundary, caption.
**Review**: Improved — the parcels are now drawn as wrapped commits threaded to their base, so the ending's "a stash is a commit" is shown, not just said; corrected that a conflicting `pop` keeps the stash (verified on Git 2.42); added the untracked-files gotcha and the local-only boundary to the interaction.

### Worktrees (`git-worktrees`)

**The aha**: A worktree checks out a second branch alongside the first, sharing one object store, with no stashing or re-cloning — but each branch lives in only one worktree at a time.
**Misconception to defeat**: A worktree is a second clone; or it's the same as a stash.
**Cast**: One repository on top (the object store and refs, drawn as the commit graph with `main` and `feature` lanes); working-tree trays hang below it on dashed lines, each with its own index and HEAD marker.
**Opening frame**: One tray, HEAD on `main`, a long build running in it (a progress bar creeping). Caption "Mid-build, a PR on feature needs review."
**Story**:

1. `git worktree add ../review feature`: a second tray appears on its own dashed line to the same repository, HEAD on `feature`, files filled in. The first tray's progress bar never pauses. Caption "A second working tree. Same repository."
2. A fix committed in the review tray lands on `feature`'s lane in the shared graph, and `git log feature` in the first tray shows it at once. Caption "One object store, one set of refs: nothing to sync."
3. Switching the first tray to `feature` as well is refused, red: it's already checked out in the review tray. Caption "A branch lives in one worktree at a time."
4. `git worktree remove ../review`: the tray disappears; the fix stays on `feature`. Caption "Remove the tree; the history stays."

**The moment**: beats 1–2: the build running on untouched while a second branch appears beside it, then a commit there showing up instantly in the first tray.
**Interaction**: Add worktrees for several branches and commit in each; try checking out one branch twice (blocked); compare a ghost second clone, which copies every object again and sees the fix only after a push and a fetch.
**Ending**: Two trays side by side under one shared graph. Caption "Parallel work, one history."
**Variants**: `git-stash`, `git-clone`, `git-head`.
**Techniques**: lanes, boundary, contents, failure, appear/disappear, caption.
**Review**: Improved — beat 4 put both trays' commits on "the SAME single lane, interleaved by time", which is wrong (they land on their own branches); now a commit made in one worktree appears instantly in the other's log, the real proof of a shared repository and the clean contrast with a second clone. The uninterrupted build makes "no stashing" visible.

## Branching and merging

### Branch (`git-branch`)

**The aha**: A branch is a cheap, movable label, not a copy of the code — creating and deleting them costs almost nothing, and deleting a merged branch loses no commits.
**Misconception to defeat**: Branching copies the whole codebase, like Subversion or copying a folder; or it's the same as a fork.
**Cast**: A commit lane with one tag `main`, and a disk-cost meter beside it. A ghost "copy the folder" duplicate of the project stands by for the contrast.
**Opening frame**: `main` on commit 5; the meter reads the project's size, 120 MB.
**Story**:

1. `git branch feature` plants a second flag on the SAME commit 5: no new commits, nothing copied. The meter ticks up by 41 bytes, a commit id and a newline. Beside it the ghost folder copy would add 120 MB, and is crossed out. Caption "A branch is a 41-byte pointer, not a copy."
2. Three more branches appear in a blink, all on commit 5, fanned out; the meter barely moves. Caption "Create them freely."
3. `feature` gains two commits; only its flag moves forward with them. Caption "Each commit carries the flag forward."
4. `feature` is merged into `main` and its flag is deleted; its two commits stay exactly where they are, reachable from `main`. Caption "Deleting a merged branch loses nothing."

**The moment**: beat 1's 41-byte tick against the ghost's 120 MB: "cheap label" proved with a number, not an adjective.
**Interaction**: Create and delete branches and watch the meter; delete a merged one and confirm its commits are still there.
**Ending**: `main`'s lane with the old feature commits folded in, no flag left but every commit intact. Caption "Branches: labels, not copies."
**Variants**: `git-refs`, `git-fork`, `git-merge-fast-forward`.
**Techniques**: appear/disappear, move, meter, side by side, restyle, caption.
**Review**: Improved — the wrong model (a folder copy) arrived last as a crossed-out ghost after the point was made; it now sits beside the first branch with real numbers (Pro Git's 41 bytes against the project's size), and a beat shows the flag riding forward with each commit.

### Fast-forward merge (`git-merge-fast-forward`)

**The aha**: When the target hasn't moved since a branch split off, "merging" just slides its pointer forward — there's nothing to combine, so history stays a straight line.
**Misconception to defeat**: Every merge creates a merge commit.
**Cast**: A single lane. `main` at commit 3; `feature` ahead at commit 6 (commits 4, 5, 6 added only on feature).
**Opening frame**: `main` behind, `feature` ahead on the same straight lane, no divergence. Caption "main hasn't moved since feature split off."
**Story**:

1. A spotlight traces the path from `main`'s commit 3 forward to 6: one unbroken line, nothing on `main` that `feature` lacks. Caption "Nothing to combine."
2. `git merge feature` on `main`: the `main` flag slides forward past 4 and 5 and lands on 6 beside `feature`'s flag. No new commit appears. Caption "Fast-forward: main just catches up."
3. Side by side, from the same start: `git merge --no-ff feature` creates merge commit 7 with two parents, 3 and 6, so 4–6 sit on a visible bump above the line. Caption "--no-ff records that a branch existed."

**The moment**: beat 2's slide: a "merge" that adds no new shape to the graph, just a moved flag.
**Interaction**: Toggle "allow fast-forward" and merge again: either the flag slides, or a two-parent merge commit appears. Add one commit to `main` first and the fast-forward option disappears.
**Ending**: The two panels side by side: flags together on 6, or the bump closed by merge commit 7. Caption "A straight line isn't always a real merge."
**Variants**: `git-merge-three-way`, `git-rebase`, `git-branch`, `git-pr-merge-methods`.
**Techniques**: move, spotlight, side by side, restyle, toggle, caption.
**Review**: Improved — fixed a factual error: the `--no-ff` merge commit was drawn with a single parent (6); it has two (3 and 6), which is the whole point of the record. Merged the two near-identical opening beats into a spotlight that shows why there is nothing to combine, and made the `--no-ff` contrast a side by side from the same start.

### Three-way merge and the merge commit (`git-merge-three-way`)

**The aha**: Git merges by comparing three snapshots — the common ancestor and each side's tip — so only lines both sides changed differently actually conflict.
**Misconception to defeat**: A merge compares only the two tips directly, like a two-way diff.
**Cast**: A fork from commit 3 into `main` (4, 5) and `feature` (A, B), with a triangle highlight connecting base 3, ours 5, theirs B. Below, three small file cards for `config`, one per corner of the triangle.
**Opening frame**: The diverged branches, the triangle drawn faintly, `git merge feature` typed on `main`.
**Story**:

1. Only the two tip cards show: line 10 reads `retries = 5` on `main` and `retries = 3` on `feature`. A "?" hovers between them. Caption "Two tips alone can't say who changed what."
2. The base card slides in and the triangle lights solid: base says `retries = 3`. So only `main` changed it, and main's line is taken, no conflict. Caption "The base shows who changed it. One side? Take it."
3. Line 20: the base says `timeout = 10`, `main` made it 30, `feature` made it 60. Both changed it, differently: a conflict card opens with both versions. Caption "Both changed it, differently: Git asks you."
4. Once resolved, merge commit M appears with TWO parent arrows, to 5 and to B; neither branch is rewritten. Caption "The merge commit joins both histories."

**The moment**: beats 1–2 at half speed: the "?" between two disagreeing tips dissolving the instant the base appears.
**Interaction**: Edit the same line on one side, on both sides identically, or on both sides differently, and see which merges cleanly and which conflicts.
**Ending**: The merge commit with its two parents, both branches intact beneath it. Caption "ours, theirs, and what they both started from."
**Variants**: `git-merge-fast-forward`, `git-merge-conflict`, `git-merge-strategies`.
**Techniques**: spotlight, contents, path trace, failure, caption.
**Review**: Improved — the plan said "three, not two" without ever showing why two isn't enough; a new opening beat shows two disagreeing tips that can't tell who changed the line, resolved the moment the base appears. Feature's commits were renamed A, B because primes (`5'`) mean rewritten copies in this area, and the default conflict card no longer claims to show the base (only the diff3 style does).

### Merge conflicts (`git-merge-conflict`)

**The aha**: A conflict is Git refusing to guess — you decide the final content, you can always back out, and the same thing happens during rebase, cherry-pick, revert and stash pop too.
**Misconception to defeat**: A conflict is an error, or a broken merge.
**Cast**: The diverged `main` and `feature` from `git-merge-three-way`, with `config` bursting into a torn card: `<<<<<<< HEAD`, main's `timeout = 30`, `=======`, feature's `timeout = 60`, `>>>>>>> feature`.
**Opening frame**: Merge in progress, the torn card open on `config`, the would-be merge commit dashed and paused.
**Story**:

1. The torn card sits open; every other file merged cleanly and shows a solid green check. Caption "Git stopped. Nothing is broken."
2. A fork in the road: resolve, or back out. First, `git merge --abort`: the card and the dashed commit vanish, and the lane is exactly as it was before. Caption "You can always back out."
3. Rewind and resolve instead: a hand edits the card down to the final text; `git add` staples it shut; `git commit` turns the dashed merge commit solid. Caption "Or decide the final version, then commit."
4. A small reel shows the identical torn card during a rebase, a cherry-pick, a revert and a stash pop. Caption "Same stop, four more commands."

**The moment**: beat 1: the torn card sitting calmly beside everything else green; stopping, not breaking.
**Interaction**: Resolve the conflict, or abort and watch the lane snap back to its pre-merge state. Try a conflict where one side edited a file the other deleted.
**Ending**: Holds on the completed merge commit, solid. Caption "Git never guesses for you."
**Variants**: `git-conflict-resolution`, `git-merge-three-way`, `git-cherry-pick`, `git-revert`, `git-stash`.
**Techniques**: failure, contents, restyle, choice, caption.
**Review**: Improved — "you can always back out" is half the catalog's aha but lived only in the interaction; `--abort` is now a story beat beside the resolve path, and the resolve beat's captions are tightened.

### Conflict resolution techniques (`git-conflict-resolution`)

**The aha**: Seeing the base, not just "ours" versus "theirs", turns guessing into reasoning about intent — and during a rebase, "ours" and "theirs" swap meaning, because your commits are being replayed onto theirs.
**Misconception to defeat**: "Ours" always means my branch, in a merge and a rebase alike.
**Cast**: A torn conflict card with an "ours" panel and a "theirs" panel, room for a base panel to slide in between, and a mode label: "merge" or "rebase". You are on `feature` throughout.
**Opening frame**: You ran `git merge main` on `feature`. The card reads "ours = feature (you)": `timeout = 10` plus a new line `retries = 3`; "theirs = main": `timeout = 30`.
**Story**:

1. A "?" hovers: keep yours with its retries, or main's 30? Caption "Two sides alone: you're guessing."
2. With `merge.conflictStyle = zdiff3`, a base panel slides in: `timeout = 10`. Now it's plain: main changed the timeout, you added retries. The card resolves to `timeout = 30` plus `retries = 3`. Caption "The base shows what each side meant."
3. For a whole file such as a lockfile, `git checkout --ours` keeps your version outright. Caption "Or take one side for a whole file."
4. Same branch, same conflict, but via `git rebase main`: the labels swap. "ours" is now main, the base your commits are replayed onto; "theirs" is your own commit. The same `--ours` now grabs main's version, not yours. Caption "In a rebase, ours and theirs swap."
5. Later the identical conflict appears again and resolves itself: `rerere` replays the recorded resolution. Caption "Resolve once; rerere remembers."

**The moment**: beat 2 at half speed: the base sliding in and the "?" becoming an obvious answer that keeps both sides' intent.
**Interaction**: Toggle the base panel on several conflicts; toggle merge and rebase on the same file and watch where "ours", "theirs" and `--ours` point.
**Ending**: The resolved card with its base panel. Caption "See the base. Know whose side is whose."
**Variants**: `git-merge-conflict`, `git-merge-strategies` (for `-X ours` / `-X theirs`), `git-rebase`.
**Techniques**: contents, toggle, spotlight, restyle, caption.
**Review**: Improved — fixed a real error: the "swap" didn't swap (merge was labelled ours = main and rebase ours = main too); the viewer now stays on `feature` and runs `git merge main` versus `git rebase main`, where "ours" really flips from yours to main's, and `--ours` grabs a different side. The base beat now resolves a concrete conflict two panels can't; dropped `-X theirs` (misdescribed as per file; it belongs to `git-merge-strategies`).

### Merge strategies (`git-merge-strategies`)

**The aha**: `-s ours` throws away the other branch's changes entirely, while `-X ours` only breaks ties inside conflicting hunks — they sound alike but work at wildly different scales.
**Misconception to defeat**: `-s ours` and `-X ours` are the same setting at different strengths.
**Cast**: Side by side panels, the identical starting fork (main at 5, feature at B; feature changed three files, one with a hunk that genuinely conflicts). Left "-s ours", right "-X ours".
**Opening frame**: Both panels show the same fork, about to merge feature into main.
**Story**:

1. Left: the merge commit appears with two parents, but every file in the result matches main exactly; feature's changes to all three files are silently absent. Caption "-s ours: record the merge, keep our tree, full stop."
2. Right: feature's changes merge into all three files as usual; only the one conflicting hunk is decided automatically, for main. Caption "-X ours: only breaks ties inside conflicts."
3. Counters overlay: left "feature's changes kept: 0 of 3 files"; right "3 of 3 files merged, 1 conflicting hunk decided for main". Caption "Same word, very different blast radius."
4. A third, dimmed panel runs the default (`ort`, no options): it merges the same three files and stops on the one real conflict for you to decide. Caption "The default is almost always right."

**The moment**: the counters side by side: everything of feature's gone, versus one hunk decided, from options that read almost identically.
**Interaction**: Toggle between `-s ours`, `-X ours` and the default on the same conflicted fork and watch how much of feature survives.
**Ending**: Three small merge commits lined up, visibly different trees. Caption "-s ours drops their side. -X ours breaks ties."
**Variants**: `git-merge-three-way`, `git-conflict-resolution`, `git-pr-merge-methods`.
**Techniques**: side by side, meter, restyle, toggle, caption.
**Review**: Improved — corrected `-X ours`: it decides conflicting hunks, not a whole conflicting file, so feature's non-conflicting edits in that file still merge; counters reworded to match. The ending caption ("read the letter before the flag") was a riddle; it now states the difference.

## Rewriting history

### Rebase (`git-rebase`)

**The aha**: Rebase doesn't move your commits onto the new base — it copies them there with new ids, and the originals are left behind, still reachable through the reflog.
**Misconception to defeat**: Rebase relocates the existing commits.
**Cast**: `main` at 1-2-3-4-5; `feature` branched off 3 with its own commits A, B, C, each showing its short id (`a1f3`, …).
**Opening frame**: `main`: 1-2-3-4-5. `feature` tag on A-B-C, branched at 3; main has moved on to 4 and 5 since the split.
**Story**:

1. `git rebase main` on `feature`: A's change is lifted off as a token and applied on top of 5, where a NEW circle A' is born with a new id. The original A stays exactly where it was, still solid, still parented to 3. Caption "A copy, not a move."
2. B and C follow, one at a time: B' on A', C' on B'. For a moment two complete versions of the work sit on screen, old row and new row. Caption "Replayed, one by one."
3. The `feature` tag jumps from C to C'. With nothing pointing at them any more, A, B and C fade to pale outlines. Caption "The branch now points at the copies."
4. The reflog ledger lists `feature@{1}` = C, a dashed line running up to the pale original. Caption "The originals are still there, just unlabelled."

**The moment**: beat 1 in slow motion: the original staying put while an entirely new circle is born on a different parent. Not a slide; a birth.
**Interaction**: Step through the rebase commit by commit and watch each copy appear; then undo it with `git reset --hard feature@{1}` and watch the tag jump back to the untouched originals.
**Ending**: `feature` a straight continuation of `main`'s tip via A', B', C'; the old A, B, C pale but present, reflog-reachable. Caption "Same work, new ids, straight line."
**Variants**: `git-merge-vs-rebase`, `git-rebase-golden-rule`, `git-reflog`, `git-content-addressing`, `git-cherry-pick`.
**Techniques**: clone, token, restyle, move, path trace, caption.
**Review**: Improved — originals faded one by one as copies were made, but in Git they stay reachable (the branch still points at C) until the tag moves; now they fade together when it jumps, consistent with "pale = unreachable", which also shows both versions coexisting. The interaction's undo makes "originals still there" useful, not just visible.

### Merge vs rebase (`git-merge-vs-rebase`)

**The aha**: Same final code, different history — merge is non-destructive but adds a joining commit, rebase rewrites ids for a linear story.
**Misconception to defeat**: Merge and rebase produce different results in the code; or they're interchangeable regardless of who else has the commits.
**Cast**: Side by side, the identical starting fork (main 1-2-3-4-5, feature 3-A-B-C). Left "merge", right "rebase".
**Opening frame**: Both panels, identical fork, unresolved.
**Story**:

1. Left: `git merge feature` on `main` creates merge commit M with two parents, closing a diamond. Caption "Merge: history exactly as it happened."
2. Right: `git rebase main` on `feature`, then a fast-forward of `main`: A', B', C' chain onto 5, the originals fade, and `main` slides to C'. One straight line. Caption "Rebase: rewritten onto the new base."
3. A diff overlay compares the two tips' files: IDENTICAL, in green. Caption "Same code either way."
4. The ids light up: left, A, B, C still read `a1f3`, `29bc`, `d4a7`; right, every one is new. A teammate's copy of the branch still matches the left panel, not the right. Caption "Merge keeps ids. Rebase replaces them."
5. A banner: "Shared with others? Merge. Still only yours? Rebase freely."

**The moment**: beat 3's identical-content flash, proving the choice is about the shape of history, never the result; beat 4 then shows what the straight line costs.
**Interaction**: Toggle which approach runs on the identical fork and compare shapes and ids directly.
**Ending**: Two different-shaped lanes, the same green tip. Caption "Same code, different story."
**Variants**: `git-rebase`, `git-merge-three-way`, `git-rebase-golden-rule`, `git-pr-merge-methods`, `git-linear-history`.
**Techniques**: side by side, clone, restyle, spotlight, toggle, caption.
**Review**: Improved — beat 4 repeated the shapes the viewer had just watched form; it now lights the ids, the actual trade-off (rebase replaces them, so others' copies no longer match), which is what beat 5's advice rests on.

### The golden rule of rebasing (`git-rebase-golden-rule`)

**The aha**: Rewrite commits others have already built on, and their old copies collide with your new ones the moment they pull — rewrite only what's still yours alone.
**Misconception to defeat**: Rebasing is always risky; or it's fine to rewrite a branch once it's pushed, as long as you're careful.
**Cast**: The `origin` frame above two laptops, "you" and "teammate". All three hold the same shared branch `feature` (A, B, C); the teammate has already built their own commit D on top of C.
**Opening frame**: Identical A, B, C everywhere; D sits only on the teammate's laptop, parented to C.
**Story**:

1. You rebase `feature` onto `main`: A', B', C' appear, the originals fade, and you force-push. Origin now holds the copies. Caption "You rewrite a shared branch…"
2. The teammate's laptop, untouched, still has the OLD A, B, C, with D standing on them. Caption "…but your teammate built on the old ones."
3. They pull: a merge brings A', B', C' in beside A, B, C. Six commits for three changes, and conflicts wherever the copies differ. Caption "Old and new collide."
4. They push: the old A, B, C ride back up to origin alongside the copies. Caption "And the commits you removed come back."
5. Contrast panel: the same rebase on a branch nobody else has fetched; no second copy exists, so nothing can collide. Caption "Unshared? Rewrite freely."

**The moment**: beat 3's doubled lane on the teammate's machine, six commits where there should be three, then beat 4 sending the duplicates back to everyone.
**Interaction**: Toggle "teammate has fetched: yes/no" and "teammate built on it: yes/no" before rebasing and see when the collision follows.
**Ending**: The clean, unshared case beside the tangled, shared one. Caption "Once it's shared, history should only grow."
**Variants**: `git-rebase`, `git-force-push`, `git-merge-vs-rebase`.
**Techniques**: side by side, clone, restyle, failure, toggle, caption.
**Review**: Improved — the rule is about commits others have built on, but the teammate had built nothing; they now have D on the old commits. The collision is described accurately (duplicates always; conflicts only where the copies differ) and a new beat shows the duplicates returning to origin on their next push, the cost that makes the rule stick.

### Interactive rebase (squash, fixup, reorder) (`git-interactive-rebase`)

**The aha**: Before anyone sees it, you can turn "wip, fix typo, oops" into a few meaningful commits — easier to review, revert and bisect.
**Misconception to defeat**: Interactive rebase is the same as a host's squash merge, or it only touches the last commit (confusing it with amend).
**Cast**: The messy branch lane, five commits: "add parser", "fix typo", "add tests", "debug prints", "fix parser edge case". Beside it, the to-do list `rebase -i` opens: one line per commit, oldest at the TOP (the reverse of `git log`), a verb before each. Under the list, a live preview lane of what will result.
**Opening frame**: The list, every line `pick`; the preview matches the messy lane. Caption "A to-do list, oldest first."
**Story**:

1. "fix typo" → `fixup`: in the preview it melts into "add parser" above it, its message discarded. Caption "fixup: fold in, drop the message."
2. "fix parser edge case" is dragged up under "fix typo" and set to `squash`: it folds into "add parser" too, and its message joins the combined message. Caption "Reorder, then squash: fold in, keep the message."
3. "debug prints" → `drop`: it vanishes from the preview. Caption "drop: gone."
4. The list runs top to bottom: the five messy circles fade, and two clean ones, "add parser" and "add tests", appear on the base with new ids. Caption "Five commits become two. All new ids."

**The moment**: beat 4: five messy circles fading as two clean, reviewable ones take their place.
**Interaction**: Change verbs (pick, reword, squash, fixup, drop) and drag lines, and watch the preview lane update before anything runs. Make a commit with `git commit --fixup=<id>` and run `rebase -i --autosquash`: the list arrives already arranged.
**Ending**: Two tidy commits where five messy ones were. Caption "Tidy before anyone else sees it."
**Variants**: `git-rebase`, `git-amend`, `git-pr-merge-methods`, `git-atomic-commits`.
**Techniques**: contents, clone, restyle, move, caption.
**Review**: Improved — fixed the to-do list order (Git lists oldest first, top to bottom; the plan had it reversed, which also broke "squash into the one above"); replaced a reorder beat with no purpose by a realistic one (moving a late fix up to the commit it fixes); autosquash moved to the interaction, and the moment is now the before/after the aha promises.

### Amending a commit (`git-amend`)

**The aha**: Amend doesn't edit the last commit, it swaps in a brand-new one with a new id — fine before pushing, but it splits your branch from the remote afterwards.
**Misconception to defeat**: Amend edits the existing commit in place.
**Cast**: A lane with commit 5 ("fix bug", id `a1f3`) just made, `main` and HEAD on it; the index tray; an `origin` frame above.
**Opening frame**: Commit 5 solid; a forgotten file sits orange in the working tree. Caption "Forgot a file."
**Story**:

1. The file is staged and `git commit --amend` runs: a new commit 5' (`7be2`) appears beside 5, holding the file too, with the same parent, 4. `main`'s tag slides onto it and 5 fades. A crossed-out pencil hovers over 5. Caption "A new commit, not an edit."
2. Side by side from here. Left, not yet pushed: origin never had 5, so nothing diverges, and the next push just works. Caption "Before pushing: free."
3. Right, 5 was already pushed: origin still holds 5, local holds 5'. They split at 4 ("1 ahead, 1 behind") and the next push is rejected. Caption "After pushing: your branch has split from origin."
4. Right: only a force-push, best with `--force-with-lease`, replaces 5 on origin. Caption "Publishing it needs a force-push."

**The moment**: beat 1 at half speed: the fade-and-appear beside the crossed-out pencil, ruling out in-place editing; beat 3 then shows what that means once origin has the old one.
**Interaction**: Amend a file, or only the message: either way a new id appears. Toggle "already pushed" and see whether the next push works or is rejected.
**Ending**: Both panels holding 5', 5 pale behind it. Caption "Amend swaps commits. It never edits them."
**Variants**: `git-commit`, `git-content-addressing`, `git-force-push`, `git-interactive-rebase`.
**Techniques**: restyle, clone, failure, side by side, toggle, caption.
**Review**: Improved — dropped the message-only amend beat, which repeated beat 1's mechanism (it's now in the interaction), and turned before/after pushing into a side by side from one start, showing the divergence ("1 ahead, 1 behind") that makes the push fail.

### Cherry-pick (`git-cherry-pick`)

**The aha**: Cherry-pick copies the one change a single commit introduced onto your current branch, as a new commit, without bringing anything else along.
**Misconception to defeat**: Cherry-pick merges the other branch, bringing its history along; or it moves the original commit across.
**Cast**: Two lanes: `main` on top with commits X, H, Y (X a new feature, H a bug fix, Y another feature), and `release/1.4` below, cut from `main` before them, which needs only the fix.
**Opening frame**: `main` with X, H, Y; `release/1.4` apart, HEAD on it, a bug icon on its tip.
**Story**:

1. `git cherry-pick H`: H is spotlighted and its diff against ITS parent X peels off as a small glowing token: just H's change. A ghost of H's whole snapshot, which would drag X's feature along, is crossed out. Caption "Only the change H introduced."
2. The token travels down and lands on `release/1.4` as a new commit H', parented to the release tip, with a new id; the bug icon clears. Caption "Applied as a new commit, right here."
3. X and Y stay on `main`, untouched; the release lane gained exactly one commit. Caption "Nothing else comes along."
4. If the two lanes are ever merged, both H and H' end up in one history: the same change twice, under two ids. Caption "The same change, recorded twice."

**The moment**: beat 1's extraction: one commit's diff peeling off as a token while its neighbours, and its snapshot, stay behind.
**Interaction**: Pick different commits off `main` and watch only that one's change land; pick one whose change depends on X and watch it conflict. Add `-x` to stamp "cherry picked from H" into the message.
**Ending**: `release/1.4` holds one small new commit; `main` is unchanged. Caption "A surgical copy, not a merge."
**Variants**: `git-release-branches`, `git-rebase` (a series of cherry-picks), `git-merge-three-way`.
**Techniques**: spotlight, token, clone, lanes, caption.
**Review**: Improved — the scenario (picking off a `hotfix` branch that carries unrelated commits onto `main`) is now the real one: backporting a fix from `main` to a release branch, matching `git-release-branches`. A crossed-out snapshot ghost shows why a diff, not the snapshot, is copied; the "twice in history" beat now describes when that actually happens (the branches meeting), not two picks onto separate branches.

### Rewriting all history (purging files, secrets) (`git-filter-repo`)

**The aha**: Purging something from history gives every later commit a new id, which means a coordinated force-push and a re-clone for everyone — and old copies survive elsewhere; for a leaked secret, rotate it first.
**Misconception to defeat**: Deleting the file in a new commit removes it from history; or `.gitignore` is enough.
**Cast**: A ten-commit lane on `origin`, with commit 3 adding a secret file whose blob glows red; every later snapshot still includes it. Around it, satellite boxes for teammates' clones, a fork and a CI cache, all holding the same history.
**Opening frame**: Commit 3's red blob, seven commits built on top, satellites holding the same history.
**Story**:

1. A naive new commit deletes the file. The lane grows, but scrubbing back finds commit 3's red blob untouched. Caption "Deleting it now doesn't erase it then."
2. First, rotate: a key icon turns the leaked secret from red to grey, "revoked", everywhere it appears, satellites included. Caption "Rotate first: make the leak worthless."
3. `git filter-repo` removes the file from every commit: 1 and 2 keep their ids, while 3 onwards fade and are replaced by 3', 4', … in a wave rippling rightward. Caption "Every commit from there on gets a new id."
4. A coordinated force-push replaces origin's history; teammates re-clone onto the new ids. Caption "Everyone has to move to the new history."
5. The fork and the cache still hold the old commit 3, its secret now grey and dead. Caption "Old copies survive. That's why you rotated first."

**The moment**: beat 3's rippling wave of new ids, rewriting the whole tail of history from one bad commit forward.
**Interaction**: Pick which commit introduced the file and watch how far the ripple reaches; skip the rotation and watch the surviving copies stay red.
**Ending**: The rewritten lane clean, the surviving satellites holding only a dead key. Caption "A rewrite is cleanup, not containment."
**Variants**: `git-ignore`, `git-reflog`, `git-force-push`, `git-content-addressing`.
**Techniques**: spotlight, clone, restyle, boundary, caption.
**Review**: Improved — the order was wrong: rotation was shown after the rewrite while its caption said "before"; it now comes first, so the surviving copies at the end are visibly harmless, which is the logic of "cleanup, not containment". The final beat now has a caption, and the satellites name the real places old history survives.

## Undoing and recovering

### Choosing how to undo (`git-undo-choices`)

**The aha**: The deciding question is "has anyone else seen this commit?" If not, rewrite it away. If it's shared, add a new commit that undoes it.
**Misconception to defeat**: `restore`, `reset` and `revert` are interchangeable because they sound similar; or using reset on pushed history.
**Cast**: A change's whole journey laid out left to right in the area's own pieces: working-tree tray, index tray, the local lane inside a laptop boundary, and `origin` beyond a bold dashed line labelled "shared". A red "mistake" marker travels along it; above it, a toolbox whose tools light or grey out.
**Opening frame**: The journey drawn, the marker in the working tree, the "shared" line clearly marked. Caption "Where's the mistake?"
**Story**:

1. Marker on an uncommitted edit: `restore` lights; the file chip returns to its last staged or committed version. Caption "Not committed: restore the file."
2. Marker on the last local commit: `commit --amend` and `reset` light; the commit fades and a fixed one, or nothing, takes its place. Caption "Committed, not pushed: rewrite it."
3. Marker on several local commits: `reset` and `rebase -i` light; the batch fades together. Caption "Still local: rewrite the batch."
4. The marker crosses the "shared" line into `origin`: every tool that fades commits greys out, and only `revert` stays lit. A new commit appears that undoes the mistake; nothing fades. Caption "Shared: add a commit that undoes it."

**The moment**: beat 4 at half speed: the marker crossing the line and the rewriting tools going dark together, because others now hold a copy.
**Interaction**: Drag the marker anywhere along the journey and see which tools light and what each does (fade versus new commit). Note: `restore` throws uncommitted edits away for good; the reflog can't bring them back.
**Ending**: The journey with the "shared" line glowing: rewrite on the left, revert on the right. Caption "Ask first: has anyone else seen it?"
**Variants**: `git-revert`, `git-reset-modes`, `git-amend`, `git-reflog`, `git-rebase-golden-rule`.
**Techniques**: choice, boundary, restyle, appear/disappear, caption.
**Review**: Improved — four doors in a flowchart made the deciding question one option among four; laying the cases along the change's own path (trays, local lane, origin) turns "has anyone else seen it?" into a line the marker visibly crosses, after which the rewriting tools go dark.

### Revert (`git-revert`)

**The aha**: Revert undoes a change by adding a new commit, not by removing the old one — safe on shared branches, and it leaves a record of both the mistake and the fix.
**Misconception to defeat**: Revert deletes or rewinds past the bad commit, confusing it with reset.
**Cast**: A lane of five commits, commit 3 flagged with a bug icon, 4 and 5 carrying good work (green); an `origin` frame above showing the same five, already shared.
**Opening frame**: Commit 3's bug icon visible in the middle of the lane; local and origin identical through 5.
**Story**:

1. `git revert 3` adds commit 6 at the tip, containing the exact opposite of commit 3's change. Commit 3 itself doesn't move, fade or change. Caption "A new commit that undoes an old one."
2. The code at 6: commit 3's change is gone, while 4 and 5's work is still there. Caption "Only that one change is undone."
3. Side by side, the wrong tool: `reset --hard 2` would slide the branch back past 3, 4 AND 5, losing the good work, and leave local and origin split. Caption "Not a rewind."
4. A push carries 6 to origin as a plain fast-forward. Caption "Safe to share: nothing was removed."

**The moment**: beat 3's side by side: revert removing one change from the middle of history, against reset discarding everything after it.
**Interaction**: Revert any commit and compare the code before and after; revert commit 6 itself to bring the change back; revert a commit whose lines were later edited and watch it conflict.
**Ending**: Six commits; scrubbing back still finds the bug in 3, and the fix in 6. Caption "History only grows."
**Variants**: `git-reset-modes`, `git-revert-merge-commit`, `git-undo-choices`.
**Techniques**: appear/disappear, restyle, side by side, path trace, caption.
**Review**: Improved — the named misconception (revert as a rewind, like reset) was never shown; a side by side now runs `reset` on the same lane, losing the good commits after the bug, while revert removes just the one change. Scrubbing back to the bug moved to the ending.

### Reset: soft, mixed, hard (`git-reset-modes`)

**The aha**: Reset is three steps of increasing reach — branch, then index, then working tree — and each mode stops at a different one; only hard can destroy uncommitted work.
**Misconception to defeat**: Reset is a single operation, equally dangerous regardless of mode.
**Cast**: Three stacked panels, soft, mixed (the default) and hard, each with the same branch tag, lane and three trays, and a "reach" bar showing how far its reset goes: branch, then index, then working tree.
**Opening frame**: All three panels identical: `main` on commit 5, a target commit 3 glowing further back, one uncommitted edit orange in the working tree.
**Story**:

1. Soft: `reset --soft 3`. Only the branch tag slides back to 3; commits 4 and 5 turn pale. The index still holds 5's files, now green (staged); the edit is untouched. Caption "Soft: move the branch. Stop."
2. Mixed: `reset --mixed 3`. The tag slides back and the index repaints to 3; the working tree keeps 5's files and the edit, all orange (unstaged). Caption "Mixed: the branch and the index."
3. Hard: `reset --hard 3`. Tag, index AND working tree repaint to 3. The edit, never committed, is shredded. Caption "Hard: your files too. Uncommitted work is gone."
4. A ledger slides in under each panel, still listing `main@{1}` = 5, so 5 (and 4 behind it) can come back. The shredded edit has no entry anywhere. Caption "Commits can come back. Uncommitted edits can't."

**The moment**: beat 3's shred, the one destructive visual, beneath soft's and mixed's calm repaints where the same edit still sits safely in a tray.
**Interaction**: Pick a mode and a target, run it, then try to get everything back: soft and mixed leave the work in a tray, hard leaves the commits in the reflog and the edit nowhere. Compare `git switch`: it moves HEAD, not the branch.
**Ending**: The three panels side by side, reach bars glowing. Caption "Each mode stops at a different tray."
**Variants**: `git-undo-choices`, `git-three-areas`, `git-reflog`, `git-revert`.
**Techniques**: move, contents, restyle, failure, side by side, caption.
**Review**: Improved — the opening had no uncommitted work, so hard's "shredding" had nothing to shred; an edit now sits in the working tree from the start, and the closing beat separates what the reflog can recover (commits 4 and 5, in every mode) from what nothing can (the edit). Ran the modes as stacked panels from one start, so the recap beat is no longer needed; corrected "any chip that only existed in the working tree" (untracked files survive `--hard`).

### Reverting a merge, and merging again (`git-revert-merge-commit`)

**The aha**: Reverting a merge removes the merged changes from the code, but the graph still records those commits as merged — merge the same branch again and nothing comes back, until you revert the revert.
**Misconception to defeat**: Reverting a merge is the same as reverting an ordinary commit, or it un-merges the branch.
**Cast**: `main` (…5) and `feature` (A, B, C) joined by merge commit M, whose two parent arrows are labelled 1 (5, main's side) and 2 (C, feature's side). A code panel shows which changes are live on `main`.
**Opening frame**: M solid, a bug icon on it; the code panel lists A, B, C's changes as live. Caption "The merge broke main."
**Story**:

1. `git revert -m 1 M`: commit R appears at main's tip, and A, B, C's changes drop out of the code panel. Caption "-m 1: keep main's side, undo what feature brought."
2. A spotlight walks back from R along the parent arrows: through M's second arrow it still reaches A, B and C. Caption "But A, B and C are still in main's history."
3. `feature` gains a fix, D, and is merged again as M2. The merge base is now C, so only D arrives; A–C's changes stay missing from the code panel. Caption "Merge it again: only D comes back."
4. The right way, from just after R: `git revert R` first (R' puts A–C's changes back), then merge `feature`, and D lands on top. The code panel shows everything. Caption "Revert the revert, then merge."

**The moment**: beat 3's eerily clean merge that brings back almost nothing, the spotlight of beat 2 explaining exactly why.
**Interaction**: After reverting the merge, try re-merging `feature` with and without reverting the revert first, and watch which changes land.
**Ending**: M → R → R' → merge, the code panel complete. Caption "Reverting a merge undoes the code, not the merge."
**Variants**: `git-revert`, `git-merge-three-way`, `git-commit-dag`, `git-reset-modes`.
**Techniques**: lanes, contents, path trace, spotlight, failure, caption.
**Review**: Improved — replaced an invented "merged?" status light with the area's own reachability walk, which shows the real reason the second merge brings nothing back; labelled M's parents so `-m 1` means something on screen; and showed the fix in its proper order (revert the revert, then merge) instead of after the failed merge.

### Reflog and recovering lost commits (`git-reflog`)

**The aha**: Almost nothing you've committed is ever truly lost — a bad reset, botched rebase or deleted branch can be undone by finding the old id in the reflog, but uncommitted work has no such safety net.
**Misconception to defeat**: `git log` shows this (it shows only reachable commits); or the reflog is a server-side backup.
**Cast**: The main lane above, a ledger strip below listing `HEAD@{0}`, `HEAD@{1}`, … newest on top, and a laptop boundary around everything with a crossed-out cloud icon.
**Opening frame**: `main` and HEAD on commit 7, an uncommitted edit orange in the working tree; the ledger's top row reads `HEAD@{0}` = 7.
**Story**:

1. `git reset --hard 3`: commits 4–7 fade to pale outlines, reachable from no branch, and the edit is shredded. A `git log` panel now shows only 1-2-3. Caption "log shows only what's reachable."
2. The ledger gains a row at the top; `HEAD@{1}` = 7 now, a dashed line running up to the pale commit. The shredded edit has no row. Caption "The reflog remembers every commit you've been on."
3. `git branch rescue HEAD@{1}`: a flag plants on 7, and 4–7 return to full colour at once. Caption "Point a branch at it. It's back."
4. Without the rescue: a timer runs about 30 days (the default for unreachable entries), the rows expire, and `git gc` sweeps the pale commits away. The laptop boundary pulses: origin never had any of this. Caption "Safe until garbage collection, and only on this machine."

**The moment**: beat 3: one command un-fading an entire lost sequence, proven recoverable, not gone.
**Interaction**: Break something (hard reset, delete a branch, botch a rebase), then scroll the ledger to find and restore it.
**Ending**: Back on the rescued lane, full colour, ledger calm. Caption "Lost, until you know where to look."
**Variants**: `git-detached-head`, `git-reset-modes`, `git-rebase`, `git-filter-repo`.
**Techniques**: restyle, path trace, appear/disappear, timer, boundary, caption.
**Review**: Improved — "uncommitted work has no such safety net" was in the aha but never shown; the reset now also shreds an edit that gets no ledger row. The garbage-collection beat is framed as the path not taken (it previously came after the rescue, contradicting the ending), with the real default (about 30 days for unreachable entries), and "reachable from any tag" is now "any branch".

## Remotes and syncing

### Clone and remotes (`git-clone`)

**The aha**: Cloning gives you your own independent, complete repository with a remote pointer named `origin` — you sync with others only when you explicitly fetch or push.
**Misconception to defeat**: Cloning is like downloading a zip of the current files; or it's the same as forking.
**Cast**: An `origin` frame on top with a full lane (five commits, `main` and `v1.0` tags). Below, side by side, two empty boxes on the same laptop: "Download ZIP" and "git clone".
**Opening frame**: Origin's frame full; both boxes empty. Caption "Two ways to get the code."
**Story**:

1. Left, "Download ZIP": only the files of commit 5 drop into a tray. No lane, no tags, no link back. Caption "A zip: today's files, nothing else."
2. Right, `git clone`: the ENTIRE lane, every commit and tag, copies into the box, and the default branch is checked out into the trays. Caption "A clone: the whole history."
3. Inside the clone, a card appears, `origin → https://github.com/acme/app.git`, and a dim `origin/main` tag sits beside your own `main`, both on 5. Caption "A remote is just a named URL."
4. Three local commits land in the clone; origin's frame doesn't change. Caption "Your own repository now. Syncing is up to you."

**The moment**: beats 1–2 side by side: a flat tray of files against a full lane landing all at once.
**Interaction**: Make local commits and watch origin stay frozen until you push; add a second remote (`upstream`) and see it is just another named URL.
**Ending**: The clone three commits ahead of origin, both copies of one history. Caption "After cloning, you sync only when you choose."
**Variants**: `git-distributed-version-control`, `git-remote-tracking-branches`, `git-fork`.
**Techniques**: side by side, boundary, clone, contents, restyle, caption.
**Review**: Improved — the zip contrast arrived as a crossed-out icon after the clone; it now runs side by side from the same origin, so the difference (files only versus the whole history) is seen, not stated. The remote is shown as what it is, a named URL.

### Remote-tracking branches and upstreams (`git-remote-tracking-branches`)

**The aha**: `origin/main` is a snapshot of the remote at your last fetch, not a live view — it moves only when you fetch, so "up to date" can be quietly stale.
**Misconception to defeat**: `origin/main` IS the branch on the remote, live and always current.
**Cast**: An `origin` frame above; a local box below with `main` and a dim `origin/main` tag, joined by a thin line labelled "upstream"; a `git status` panel beside the box.
**Opening frame**: Everything on commit 5: origin's `main`, your `main` and `origin/main`. Status reads "Your branch is up to date with 'origin/main'."
**Story**:

1. A teammate pushes 6 and 7: origin's `main` moves to 7. Your `origin/main` does NOT move. Caption "origin/main is a snapshot, not a live view."
2. Status still reads "up to date with 'origin/main'", word for word true and badly out of date, beside an origin that has visibly moved. Caption "Up to date with your last fetch."
3. `git fetch`: commits 6 and 7 download, the dim tag slides to 7, and status changes to "behind 'origin/main' by 2 commits". Caption "Only fetch moves it."
4. You make three commits on `main`; status reads "have diverged… 3 and 2 different commits each", counted from where the two lines split. Caption "Ahead and behind, since the split."

**The moment**: beat 2: the confident "up to date" message beside an origin that has already moved on.
**Interaction**: Let origin move without fetching and watch status stay wrong until a fetch; break the upstream link and watch status stop counting at all.
**Ending**: Status accurate after a fetch. Caption "origin/main knows only what your last fetch told it."
**Variants**: `git-fetch-vs-pull`, `git-clone`, `git-push`, `git-refs`.
**Techniques**: restyle, move, contents, meter, caption.
**Review**: Improved — the opening had origin already at 7, so beat 1's push had nothing left to do; it now starts in sync. The counter quotes `git status`'s real messages (whose literal truth is the joke), and the upstream link the concept is named for is drawn.

### Fetch vs pull (`git-fetch-vs-pull`)

**The aha**: Fetch is always safe, touching only remote-tracking refs; pull changes your own branch, by merging or rebasing — a choice worth making deliberately.
**Misconception to defeat**: Fetch and pull are basically the same command; or pull always just "gets the latest" cleanly.
**Cast**: An `origin` frame above, your box below with `main`, a dim `origin/main` tag and the working-tree tray. Four panels side by side, each starting from the same divergence, labelled `fetch`, `pull --no-rebase`, `pull --rebase`, `pull --ff-only`.
**Opening frame**: Shared commits 1–5. Origin has a teammate's X and Y on top of 5; your `main` has your own 6 and 7. Neither side has the other's work yet. Caption "Both sides have moved."
**Story**:

1. Fetch: X and Y download and only the dim `origin/main` tag slides to Y. Your `main`, HEAD and files don't move. Caption "Fetch touches nothing of yours."
2. Pull with merge: the same fetch, then a merge commit joins your 7 and their Y. Caption "Pull = fetch + merge…"
3. Pull with rebase: the same fetch, then your 6 and 7 are replayed onto Y as 6', 7'; the originals fade. Caption "…or fetch + rebase…"
4. Pull with fast-forward only: the same fetch, then a red refusal, because both sides moved and no fast-forward is possible. Your branch is untouched. Caption "…or refuse unless it's a fast-forward."

**The moment**: beat 1 beside beats 2–4: one panel where your branch never moved, three where pull reshaped it (or refused to).
**Interaction**: Pick a panel and run it; set `pull.rebase` or `pull.ff` and watch plain `git pull` follow it. With nothing set, recent Git stops on a divergence like this and asks you to choose.
**Ending**: The four results side by side. Caption "Fetch: look. Pull: change your branch."
**Variants**: `git-push`, `git-remote-tracking-branches`, `git-merge-vs-rebase`, `git-merge-fast-forward`.
**Techniques**: side by side, choice, move, clone, failure, caption.
**Review**: Improved — renamed origin's new commits X, Y (numbering 6, 7 locally and 8 on origin read as one sequence); added `--ff-only`'s refusal as the fourth outcome, the option that changes nothing; noted that current Git refuses to guess on a divergence when no default is set (checked on Git 2.42), which reinforces "choose deliberately".

### Push (`git-push`)

**The aha**: A rejected push means someone else got there first — the remote only accepts fast-forwards by default, so it never silently throws away commits it already has.
**Misconception to defeat**: Push always succeeds; or it overwrites the remote branch unconditionally.
**Cast**: An `origin` frame above with `main` at commit 5; a local box below with `main` at 6, your new commit, built on 5. In the contrast scene, a teammate's commit T (in their colour) also sits on origin's 5.
**Opening frame**: Local at 6, origin at 5: the simple case.
**Story**:

1. `git push` uploads 6 and asks origin to move `main` from 5 to 6, a fast-forward: accepted, green check. Caption "A normal push: the remote catches up."
2. Rewind: this time a teammate pushed T onto 5 first. Your 6 also sits on 5. Caption "Someone else pushed first."
3. Your push is rejected, red, "! [rejected] main -> main (fetch first)": moving origin's tag to 6 would drop T. Caption "Rejected: the remote won't lose T."
4. You fetch T, put your work on top of it (rebased as 6', or joined by a merge), and push again: a fast-forward from T, accepted. Caption "Integrate first, then push."

**The moment**: beat 3's red rejection, the remote protecting T from being silently erased, against beat 1's calm fast-forward.
**Interaction**: Toggle whether a teammate pushed first and see when push succeeds and when it's rejected. Create a tag and push: it stays behind until you push it by name.
**Ending**: Origin and local aligned after integrating. Caption "Push never overwrites silently. You have to ask for that."
**Variants**: `git-fetch-vs-pull`, `git-force-push`, `git-pull-request`.
**Techniques**: move, failure, toggle, caption.
**Review**: Improved — the teammate's commit was numbered 7 against your 6, reading as if it came after yours; it's now T, in the teammate's colour. The rejection quotes Git's real message, and the "tags are pushed separately" point from the catalog is in the interaction.

### Force-push and --force-with-lease (`git-force-push`)

**The aha**: Force-push publishes rewritten history on your own branch; `--force-with-lease` overwrites only what you've actually seen, so you don't erase a teammate's push by accident.
**Misconception to defeat**: Force-push is just "push, but it always works"; or it's always equally dangerous.
**Cast**: A local box with your freshly rebased `feature` (A', B', C'; the old A, B, C pale); an `origin` frame above; your dim `origin/feature` tag wearing a small padlock, the lease, that records where you last saw origin (C). Two panels side by side from here on: `--force` and `--force-with-lease`.
**Opening frame**: Local shows the rebase; origin still holds A, B, C; a plain push sits greyed out, rejected as not a fast-forward. Caption "Rewritten history needs a force-push."
**Story**:

1. Unseen by you, a teammate pushes D onto origin's C. Your `origin/feature` still says C. Caption "Someone pushed while you were rebasing."
2. Left, `git push --force`: origin's tag jumps straight to C'. D drops off origin along with A, B, C, and nobody is told. Caption "--force: overwrite whatever is there."
3. Right, `git push --force-with-lease`: the padlock checks first: is origin still at C, where you last saw it? It's at D, so the push is refused and the padlock snaps shut, red. Caption "--force-with-lease: overwrite only what you've seen."
4. Right: you fetch (the padlock now records D), rebase D onto C', and push with the lease again: accepted, D' safe on top. Caption "See it, include it, then overwrite."

**The moment**: beats 2–3 side by side: D silently vanishing on the left, D protected on the right.
**Interaction**: Toggle whether a teammate pushed first, and compare `--force` (always wins, sometimes destructively) with `--force-with-lease` (refuses when it should). Turn on an editor's background fetch: the lease is refreshed without you ever seeing D, and only `--force-if-includes` still catches it.
**Ending**: Origin holding A', B', C', D', nothing lost. Caption "The lease turns 'overwrite' into 'overwrite only what I've seen'."
**Variants**: `git-push`, `git-rebase-golden-rule`, `git-branch-protection`.
**Techniques**: side by side, restyle, failure, toggle, spotlight, caption.
**Review**: Improved — the first beat showed `--force` with no teammate push, which teaches nothing; both options now run side by side against the same unseen push, so the erasure and the refusal sit next to each other. Fixed the lease's ref (the branch is `feature`, the plan said `origin/main`) and added the background-fetch gap that `--force-if-includes` closes, from the catalog.

### Forks and the upstream remote (`git-fork`)

**The aha**: A fork lets anyone contribute without write access to the original — changes travel fork → pull request → maintainer's merge, and you keep the fork current by fetching from `upstream`.
**Misconception to defeat**: A fork is the same as a clone (it's server-side, under your own account); or it's confused with a branch.
**Cast**: A host boundary at the top holding the maintainer's "original" frame and, once created, "your fork" in a different tint beside it. Your laptop below, with remotes `origin` (→ fork) and `upstream` (→ original).
**Opening frame**: Only the original, its lane at commit 10, padlocked: you can't write to it. Your laptop is empty.
**Story**:

1. "Fork": the original's lane is copied, server side, into a new frame under your account; nothing touches your laptop. Caption "A fork: a copy on the server, under your account."
2. You clone your fork (`origin`), then `git remote add upstream` pointing at the original. Caption "Clone your fork; add the original as upstream."
3. You commit and push to `origin`: only the fork's frame changes. A dashed pull-request arrow arcs from the fork to the original. Caption "Push to your fork, then propose."
4. The maintainer reviews and merges: the original's lane gains your commit. Caption "Only a maintainer's merge changes the original."
5. Weeks later, `git fetch upstream` brings the original's new commits down; you merge them and push to `origin`. Caption "Keep your fork current from upstream."

**The moment**: beat 3's pull-request arc between two separate server-side frames: visibly not the same repository, bridged only by a reviewed proposal.
**Interaction**: Push to `origin` and then to `upstream`: the fork accepts, the original refuses (no write access) until a maintainer merges your pull request.
**Ending**: The original ahead with your merged work, the fork caught up via your laptop. Caption "A fork: your own copy, with a way back by pull request."
**Variants**: `git-clone`, `git-pull-request`, `git-remote-tracking-branches`.
**Techniques**: boundary, clone, token, path trace, failure, caption.
**Review**: Improved — the fork itself was never created on screen, so "a fork is server-side, unlike a clone" wasn't shown; a first beat now copies the repository inside the host boundary while the laptop stays empty. The padlock makes "without write access" visible, and the interaction no longer implies you can push to the original.

### Authenticating to remotes: SSH and HTTPS (`git-remote-authentication`)

**The aha**: Git itself has no accounts — the host authenticates the connection, so "permission denied" is about the URL scheme and the credential your helper or SSH agent offers, not about Git.
**Misconception to defeat**: Git logs you in with a username and password of its own; or the commit's author name and email is a form of authentication.
**Cast**: A local box with the remote's URL on a card; two pipes up to the `origin` frame, which sits behind a lock inside the host's boundary. The HTTPS pipe runs through a credential helper holding a token; the SSH pipe through an SSH agent holding a private key, whose public half is registered on the host. Off to the side, the commit's author line, `Name <email>`, connected to nothing.
**Opening frame**: Both pipes greyed out; origin's lock shut.
**Story**:

1. The URL card reads `https://github.com/acme/app.git`: the HTTPS pipe lights, the helper hands over a token, and the host's lock clicks open, green. Caption "HTTPS: a token, from a credential helper."
2. The card flips to `git@github.com:acme/app.git`: the SSH pipe lights instead; the agent proves it holds the private key matching the host's public key, and the lock opens. Caption "SSH: a key pair, offered by your agent."
3. A wrong or expired credential on either pipe: the lock flashes red, "Permission denied", from the host's side of the boundary, beside a crossed-out "Git login" ghost. Caption "Git has no accounts. The host decides."
4. The author line is changed to anyone's name and committed; neither pipe notices. Caption "The author line proves nothing. Signing does."

**The moment**: beat 3's red lock, coming squarely from the host, beside the crossed-out "Git login" ghost.
**Interaction**: Flip the URL between its two forms and see which credential is asked for; break each credential; set any author name and see nothing stop it.
**Ending**: Origin unlocked via whichever pipe the URL chose. Caption "The URL picks the gate. The host decides who gets through."
**Variants**: `git-push`, `git-signed-commits`, `git-fork`.
**Techniques**: choice, boundary, failure, path trace, toggle, caption.
**Review**: Improved — the SSH pipe was labelled `ssh://`, but the form people actually meet is `git@github.com:org/repo.git`; both real URL forms now drive which pipe lights. SSH is described correctly (the agent proves it holds the private key matching the host's public key, rather than "keys match"), and the author-line beat is now something that happens, not a static label.
