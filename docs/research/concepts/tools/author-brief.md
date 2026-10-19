# Brief: author Mogram concepts from reviewed plans

Mogram is a diagram tool that explains cloud ideas with short animated diagrams. A "concept" is
one YAML file that plays a story: steps with captions, things appearing, moving and changing.
You are writing concept files from plans that were researched and reviewed already. Repo root:
the repository root

## Read first (in this order)

1. `docs/file-format.md`: the sections "Architecture" (components, containers, connections),
   "Shapes", "Scenes" with "What a set can change", "Presence and marks", "Layouts",
   "Values, meters and controls", and "Stories". This is the whole vocabulary you have.
2. Two finished examples: `packages/concepts/content/delivery/blue-green-deployment.mogram.yaml`
   and `packages/concepts/content/messaging/visibility-timeout.mogram.yaml`.
3. For each concept you're given, its reviewed plan: find it with
   `grep -n '(\`<id>\`)' docs/research/concepts/plans/*.md` and read that section (The aha,
   Misconception, Cast, Opening frame, Story, The moment, Ending).

## What to write

One file per concept: `packages/concepts/content/<topic>/<id>.mogram.yaml`, where `<topic>` is
the one named for it below. It needs `mogram: 1`, `name:`, `description:` (one line, shown before
the story starts), and a `concept:` section with `summary:` (two sentences: the aha), `topic:`
(same as the folder) and `tags:` (4-6 search words). No `roles:` (these are explainers).

Tell the plan's story with `stories: main:`. Keep the plan's aha, its misconception being
defeated, and above all "the moment". Adapt freely to the tools that exist:

- Things appear with `show: hidden` then `set: { x: shown }`; `faded` for what's retired.
- States (`down`, `degraded`, `active`, `overloaded`), flows on connections (`traffic`,
  `blocked`, `rerouted`, `slow`, `idle`), `label`, `tone`, `mark` (check, cross, warn, lock,
  key, clock, star, question).
- Small things that travel: a shape `in:` a container with `layout: row|column|grid`, or riding
  `on:` an element; a step moves it with `{ on: other }` or `{ in: other_container }`. Give
  small shapes a size in `layout:` (e.g. `token: { size: [10, 4] }`); copies use `like:`.
- Numbers: `data:` values, formulas (`"= a / b * 100"`), a `shape: meter` (bar, ring, number)
  and a step that runs a value (`left: [30, 0]`). Never type a number in a caption or label
  that a value could hold: show it with a meter or `%name%`.
- "The same again, with one thing changed" is `rewind: start` or `rewind: <step name>`.
- `focus: [a, b]` dims everything else for a beat. `pace: slow` on the moment.
- Viewer controls only if the plan's interaction is essential and simple: `controls:` with a
  dial, toggle or pick (see the format doc). Otherwise leave interaction out.
  NOT available (don't use, don't invent keys): timelines/axes, sequence ladders, charts, code
  blocks, cards with fields, text the viewer types, copying a whole container, anything not in
  the format doc. If a plan leans on one of these, find the simplest honest picture with what
  exists; if it truly can't be told, skip that concept and say so in your report.

## Rules that are checked

- At most 12 beats (a beat is a step with `say`; steps without `say` continue the beat).
  Aim for 5-8.
- Every caption under 150 characters, plain words, no em dashes, said when the thing happens.
- Everything written with `show: hidden` must be shown by some step.
- One idea per concept. Every step changes something visible.
- Geometry: write a `layout:` section placing every freely placed element (`name: [x, y]` in
  grid units of 8 px; shapes can have `{ at: [x, y], size: [w, h] }`). Icon components are
  12 x 12 units; a default rectangle is 15 x 8. Leave at least 6 units between things; flow
  left to right; keep the whole diagram within about 90 x 50 units. Things inside a container
  with a layout, and riders, get no position. Reserve room: hidden things still take space.
- Icons: use `generic/...` types (generic/users, generic/server, generic/service,
  generic/database, generic/load-balancer, generic/cache, generic/queue, generic/dns,
  generic/storage, generic/function, generic/internet) or plain shapes (rectangle, rounded,
  cylinder, queue, cloud, hexagon, document, person, circle, diamond). If unsure an icon exists,
  use a shape.
- Technical accuracy matters more than anything: the plans were fact-checked; don't add claims
  they don't make.

## Check your work (required, per concept)

1. `cd packages/concepts && npx tsx scripts/check-one.ts content/<topic>/<id>.mogram.yaml`
   must print `OK:`. Fix every problem it prints.
2. Play it and look: from `apps/web` run
   `node ../../docs/research/concepts/tools/shots-yaml.mjs ../../packages/concepts/content/<topic>/<id>.mogram.yaml <YOUR_FOLDER>`
   (a dev server is already running on port 3100; do NOT start or stop servers, and never use
   port 3000). It prints each caption and saves `<id>-0.png` (opening) and one PNG per beat.
   Read the opening and the PNG of "the moment" (and one more if unsure) and fix what looks
   wrong: overlaps, things cut off, something that should be visible and isn't, an arrow
   through a box.
   Do NOT run `pnpm build:catalog`, do not edit generated files, do not touch any file other than
   your concept files, and do not commit or push anything with git.

## Report back

For each concept: its file, the number of beats, one line on how you adapted the plan, and
anything you couldn't show with the tools available (this list matters: it decides what gets
built next). Keep the whole report under 300 words.
