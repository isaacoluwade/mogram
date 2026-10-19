# Concept platform: where it stands, and how to carry on

Written 2026-10-09, when work paused. Read this first when picking the work up again. It says
what was asked for, what exists, what's left, and how to continue, with pointers to everything
else.

> **Parked on 2026-10-09.** The prompter (D-96, build log Step 29) and then the deck plan
> (`docs/mogram-decks/`) take precedence. Nothing below has changed since; pick it up from §6.

## 1. What was asked for

Research every major cloud concept (Git to Kubernetes to networking to security). Plan the best
animated explanation of each, without regard to what Mogram could do. Review every plan. Then
work out what Mogram needs as a platform to tell those stories with a few general tools (the
Photoshop test: few tools, used a thousand ways, no feature sprawl), review that plan, build it,
and validate it.

## 2. The five stages, and where each is

| Stage | What                                             | Status          | Where                                                            |
| ----- | ------------------------------------------------ | --------------- | ---------------------------------------------------------------- |
| 1     | Research: every concept, checked against syllabi | Done            | `docs/research/concepts/catalog/`, `CATALOG.md` (1,293 concepts) |
| 2     | A plan for each concept                          | Done            | `docs/research/concepts/plans/<area>.partN.md` (1,326 plans)     |
| 3     | Every plan reviewed                              | Done            | the same files (`**Review**:` lines), `*.review.md` summaries    |
| 4     | The platform plan, reviewed a second time        | Done            | `docs/plans/concept-platform.md`, `concept-platform.review.md`   |
| 5     | Build the platform, then the concepts            | **Partly done** | code; this document; `docs/build-log.md` Steps 27 and 28         |

Stage 5 is ten milestones (K0–K9, plan §9). K0–K4 are built and tested. K5–K8 are partly built.
K9 (authoring the concepts) has barely started: 2 of 1,293.

## 3. What's built

Everything below is in the working tree, **not committed** (the owner commits). Decisions are
D-86, D-87 and D-88 in `docs/decisions.md`; the format is in `docs/file-format.md` (Scenes →
"What a set can change", "Presence and marks", "Layouts", "Values, meters and controls",
"Stories"); requirements ST-1 … ST-14 are in `docs/requirements.md`.

**One vocabulary for change (K1).** A scene and a step of a story are both a _set_: lines that
say what differs for an element. A set can change state, flow, motion and the capacity numbers
(as before), and now `show` (shown, faded, hidden), `label`, `tone`, `mark`, where a placed
thing is (`in`, `on`, `cell`, `along`) and a value in `data:`.

**Stories (K2).** `stories:` holds named lists of steps (`say`, `set`, `focus`, `zoom`, `pace`,
`hold`, `name`, `rewind`, `choices`, `when`). A step with words starts a beat. Changes add up.
Rewind cuts back to the start or a named step. A choice plays another story and comes back.

**The picture (K0).** `pictureAt(diagram, moment)` in `@mogram/core/picture` is the one
definition of what's there: the diagram, then the steps played, then the scene picked and the
scenes the controls have on, with values worked out. It returns a plain `Diagram` with hidden
things gone, so the capacity model, layout and renderer needed no new cases. A `Moment` (scene,
story cursor, control values) replaced the bare scene name through the stores, resolver,
exports and links.

**Layouts and place (K3).** A container with `layout: row | column | grid` arranges its
children and keeps room for the most it ever holds. Things ride `on:` elements or connections.
`like:` copies an element. Only what a layout places can move; it travels along the connection
between the two places. Placed things are painted on top and never routed around.

**Values and controls (K4).** Formulas in `data:` (`= a / b * 100`), read by labels (`%name%`),
meters and steps. `shape: meter` as a bar, a ring (a timer) or a number, with a limit. A step can
set a value or run it (`[30, 0]`). `controls:` gives the viewer a dial, a toggle or a pick; a
dial can drive the capacity model (`traffic: "= rps"`); `when:` makes a step depend on values.

**Where people meet it.**

- _Viewer_: a story bar under the diagram (words, back, play, next, a mark per beat, choice
  buttons; arrow keys step, Space plays), a controls bar, and links like `?story=main&beat=3`.
- _Editor_: the dock under the canvas switches between Scenes and Story. Story shows beats as
  tiles and, for the beat picked, its caption, its steps, and a chip per change with a × to take
  it back. With a step (or scene) showing, state, flow, motion, traffic, presence, words, tone,
  mark and place picked for an element are recorded in that step, only where they differ from
  how the steps before left it. Hidden things are drawn faintly so they can be selected. The
  inspector has a Presence section (titled _At this step_ / _In <scene>_ when one is picked)
  and, for containers, _Arranges what's in it_. Dropping a placed thing into an arranging
  container or onto an element places it there.
- _Previews_ (gallery cards, the concept window, the landing page) play a diagram's story in a
  loop; the concept window shows the words.
- _Exports_: a still of the step showing with its words under it; every beat as an image,
  zipped; GIF and WebP that play the story at its own pace.

**Concepts.** Two authored from reviewed plans: `delivery/blue-green-deployment` (presence,
marks, focus, rewind) and `messaging/visibility-timeout` (a queue and a ledger that hold things,
a message that travels and is ridden by a timer ring, rewind). Topics now cover all areas
(`fundamentals`, `observability` and `ai` were added). The catalog build runs a story check: at
most 12 beats, captions under 150 characters, nothing hidden that's never shown.

## 4. How it's verified

At the pause (2026-10-09):

- `pnpm lint`, `pnpm typecheck`, `pnpm check:ui`, `pnpm format:check`: clean.
- Unit tests: `@mogram/core` 346, `@mogram/icons` 104, `@mogram/concepts` 6, web 247.
- End to end on the dev server: 199 journeys (192 from before, 7 for stories in
  `apps/web/e2e/stories.spec.ts`). The last full run passed 198; the one failure was a story
  journey's too-exact comparison, fixed and re-run with the other story journeys (7 of 7).
- **Not run since these changes**: `next build`, and the production e2e on port 3200.

New tests worth knowing: `packages/core/test/picture.test.ts` (stories, beats, rewind, choices,
`pictureAt`, timeline), `stories-edit.test.ts` (edit commands, set lines in steps),
`place.test.ts` (layouts, rooms, riders, copies), `values.test.ts` (formulas, meters, controls).

## 5. What's left

Milestones as in the plan (§9), with what's actually there.

| Milestone                 | Built                                                                                       | Not built                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K0 The picture            | All                                                                                         |                                                                                                                                                                                                                                               |
| K1 Change and presence    | All                                                                                         |                                                                                                                                                                                                                                               |
| K2 Stories                | All                                                                                         |                                                                                                                                                                                                                                               |
| K3 Layouts and place      | Row, column, grid; room; riders (elements and connections); travel; `like:` on elements     | A container drawn as a shape (`shape: queue`); the library's **Explain** group (token, message, dot presets, ready-made trays)                                                                                                                |
| K4 Values and controls    | Formulas; values in sets and runs; meters; dial, toggle, pick; `when`; traffic as a formula | Formulas for `share`, `hit` and `capacity`; run ends as formulas (`["= lease", 0]`); meters as dots (N of M); a `button` control that plays a story                                                                                           |
| K5 Authoring              | The Story dock; _At this step_; placing by drag; container layout in the inspector          | Canvas rules for add ("hidden until this step") and delete ("hide from here on"); controls, values and meter fields in the inspector; `when`, `hold`, `rewind`, `focus` and choices in the dock (YAML only today); editor preview of controls |
| K6 Two sides and branches | Choices; pick                                                                               | **`like:` on a container** (copies everything inside: "the same start, twice", which half of all plans use); `button`                                                                                                                         |
| K7 More arrangements      | Riding on a connection                                                                      | **`axis`** (place by value, spans, a "now" line, a ring); **`sequence`** (a message ladder: TLS, OAuth, TCP); **`card`** (a thing with fields)                                                                                                |
| K8 Finish                 | Animated export with captions; the story check                                              | The assistant's tools and briefing know nothing of stories, layouts or values; tours read as stories; `code` and `chart` shapes                                                                                                               |
| K9 Concepts               | 2 of 1,293; topics for all sixteen areas                                                    | The other 291 essential (tier 1) concepts, then tiers 2 and 3; mapping platform concepts (Azure, AWS, Google Cloud) to topics                                                                                                                 |

Smaller loose ends:

- The existing concepts (canary, caching, failover…) still tell their stories with scenes and
  traffic patterns. They work; they haven't been rewritten as stories with captions.
- `docs/research/concepts/mogram-today.md` describes Mogram before this work. It's the baseline
  the plan was measured against, so it's left as it was.
- The dock is narrow with both side panels open at 1440 px: three beat tiles show, the rest
  scroll.
- Things a layout places can't yet be un-placed from the canvas (use the YAML or All properties).
- In a step, a value's run shows on meters; a label using `%name%` shows the final number.

## 6. What to do next, in order

1. **Finish verifying**: `pnpm build` in `apps/web` (`next build`), then the production e2e (see
   §8), and fix anything they find. Then commit.
2. **`like:` on a container (K6).** The single most valuable missing tool: half the plans
   compare two versions of the same start. Design note: copy the container's children at parse
   time (in `format/parse.ts`, after `resolveParents`), naming them `<copy>_<child>` (dots mean
   nested diagrams, so a path like `after.web` would collide with `split()` in
   `state/resolve.ts` and the viewer's `splitTarget`); copy their layout entries and the
   connections between them; report name collisions.
3. **Teach the assistant (K8)**: tools to add a story, a step and a set line (`addStory`,
   `addStep`, `updateStep`, `setSceneEntry` with a step are all in `@mogram/core/edit`), and a
   paragraph in `apps/web/src/server/ai/briefing.ts`.
4. **Author tier 1 (K9)**, in batches, using `docs/research/concepts/tools/author-brief.md`
   (§7). Start with concepts whose plans need only what exists: presence, marks, states and
   flows, tokens and trays, meters, rewind. A first batch was chosen and not started:
   `dead-letter-queue`, `competing-consumers`, `publish-subscribe`, `idempotent-consumer`,
   `retry-backoff-jitter`, `circuit-breaker`, `dns-resolution`, `tcp-handshake`, `nat`,
   `https-and-tls`, `least-privilege`, `authentication-vs-authorization`, `git-three-areas`,
   `git-branch`, `git-merge-fast-forward`, `git-merge-three-way`, `rolling-update`,
   `feature-flags`, `leader-follower-replication`, `database-sharding`, `cache-ttl`,
   `rate-limiting`, `error-budget`, `shared-responsibility-model`. What the authors report they
   couldn't show decides what to build next.
5. **`sequence` and `axis` (K7)**, when the concepts that need them come up (handshakes and
   protocols; timelines, windows, hash rings).
6. **Authoring polish (K5)** and the **Explain** library group, so people other than YAML
   writers can build these.

## 7. How to author a concept

1. Find its reviewed plan: `grep -n '(\`<id>\`)' docs/research/concepts/plans/*.md`.
2. Write `packages/concepts/content/<topic>/<id>.mogram.yaml` following
   `docs/research/concepts/tools/author-brief.md` (the vocabulary, the rules that are checked,
   geometry). The two finished concepts are the examples.
3. Check it alone: `cd packages/concepts && npx tsx scripts/check-one.ts content/<topic>/<id>.mogram.yaml`.
4. Watch it: with the dev server running, from `apps/web`,
   `node ../../docs/research/concepts/tools/shots-yaml.mjs ../../packages/concepts/content/<topic>/<id>.mogram.yaml <a folder>`
   plays it in the viewer and saves a picture of the opening and of each beat. Read them against
   the plan.
5. `cd packages/concepts && pnpm build:catalog`, then `pnpm test` there.

## 8. Running and checking

- Dev server: `cd apps/web && AI_PROVIDER=scripted AI_ALLOW_ANONYMOUS=1 pnpm dev` (port 3100;
  port 3000 is not to be used).
- Any concept in the editor: `http://localhost:3100/draft/new?concept=<id>`; its viewer is
  `/draft/<draft id>/view`.
- All checks: `pnpm lint`, `pnpm typecheck`, `pnpm check:ui`, `pnpm format:check`, `pnpm test`
  (repo root); `cd apps/web && npx playwright test` (needs the dev server; uses installed
  Chrome).
- Production e2e: `next build`, then start on 3200 with a throwaway database and secrets
  (`PGLITE_DATA_DIR=<a new empty folder> APP_URL=http://localhost:3200 BETTER_AUTH_SECRET=$(openssl rand -hex 24) RESEND_API_KEY=re_placeholder_not_used AI_PROVIDER=scripted AI_ALLOW_ANONYMOUS=1 npx next start --port 3200`)
  and run `E2E_BASE_URL=http://localhost:3200 npx playwright test`. The five cloud journeys
  fail there at the development mailbox, as expected.
- The capacity e2e "a scale set grows for a spike" can miss its "starting" moment when the
  machine is busy; it passes on its own.

## 9. Where the code is

| What                                                     | Where                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Model types (Story, StoryStep, Control, Meter, Place…)   | `packages/core/src/model/types.ts`                                                                                                          |
| Reading sets, stories, controls                          | `packages/core/src/format/read-story.ts`; elements, `like:`, meters, layouts in `format/read.ts`                                            |
| Cross-checks and messages                                | `packages/core/src/format/parse.ts`                                                                                                         |
| Moment, story cursor, beats, rewind, choices             | `packages/core/src/picture/moment.ts`                                                                                                       |
| `pictureAt`                                              | `packages/core/src/picture/picture.ts`                                                                                                      |
| Values, controls, `when`                                 | `packages/core/src/picture/values.ts`; the formula language in `packages/core/src/values/`                                                  |
| A story's times                                          | `packages/core/src/picture/timeline.ts`                                                                                                     |
| Rooms, slots, riders (`placeAll`, `placeMovers`)         | `packages/core/src/layout/place.ts`, `layout/compute.ts`                                                                                    |
| Edit commands for stories and set lines                  | `packages/core/src/edit/stories.ts`, `edit/scenes.ts` (`setSceneEntry` takes a scene or a step)                                             |
| Scene model: presence, crossfade, travel, meters, settle | `apps/web/src/features/canvas/scene.ts`                                                                                                     |
| Drawing change, meters, marks                            | `apps/web/src/features/canvas/svg/presence.tsx`, `meter-node.tsx`, `glyphs.tsx`                                                             |
| Viewer: story playback, controls                         | `apps/web/src/features/viewer/controller.ts`, `story-bar.tsx`, `controls-bar.tsx`                                                           |
| Editor: dock, edits at a step, presence section          | `apps/web/src/features/editor/chrome/story-strip.tsx`, `actions.ts` (`editingSet`, `setInSet`, `placeAt`), `inspector/presence-section.tsx` |
| Exports                                                  | `apps/web/src/features/export/export.ts`                                                                                                    |
| The story check and one-file check                       | `packages/concepts/scripts/catalog.ts`, `scripts/check-one.ts`                                                                              |

Two things that surprise: "story" in the code used to mean playing the scenes in order; that is
now `timeline/scenes.ts` (`SCENE_HOLD`, `scenesAt`) and the export option `scenes`. And
`ResolvedState` carries the `picture` it was resolved from, which is how the renderer knows
what's there without every caller passing it.
