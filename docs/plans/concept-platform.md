# Plan: Mogram as a platform for explaining

Stage 4 of the concept work (`docs/research/concepts/README.md`). Stages 1–3 produced 1,293
concepts, a plan for each (the best animated explanation, written as if any tool could draw it;
1,326 plans, since 33 concepts were planned by two areas before being merged), and a review of
every plan. This document works out what Mogram needs so those stories can be told: the fewest
tools, each general, that combine into all of them.

The test is Photoshop's: a small set of tools used a thousand ways, so the product feels like one
thing. A feature that serves one concept is a failure of this plan.

This is the second version. The first was reviewed independently by expressing ten plans in its
format and checking it against the code (`concept-platform.review.md`); §11 says what changed.

## 1. What the plans ask for

Counted from the **Techniques** line of all 1,326 plans (`tools/techniques.py`):

| Technique          | Plans | What it is                                                   |
| ------------------ | ----- | ------------------------------------------------------------ |
| caption            | 99%   | words for each beat, appearing with it                       |
| failure            | 56%   | something breaks visibly                                     |
| side by side       | 50%   | two versions compared at once                                |
| token              | 48%   | a labelled thing travels along a path                        |
| restyle            | 45%   | an element changes look, state or label                      |
| contents           | 43%   | things inside an element: a queue's messages, a table's rows |
| meter              | 39%   | a number, bar or gauge changing                              |
| spotlight          | 35%   | some elements emphasised, the rest dimmed                    |
| toggle             | 32%   | the viewer switches between two states                       |
| timer              | 28%   | time passing visibly: a lease, a TTL, a cool-down            |
| dial               | 28%   | the viewer changes a number and sees the effect              |
| boundary           | 26%   | a region drawn around things                                 |
| path trace         | 22%   | the route something takes is highlighted                     |
| choice             | 14%   | the viewer picks what happens next                           |
| lanes              | 13%   | parallel rows: branches, transactions, a time axis           |
| move               | 11%   | an element changes place                                     |
| stream             | 11%   | continuous flow whose rate shows volume                      |
| chart              | 11%   | a value drawn over time                                      |
| clone              | 10%   | an element is copied and the copy changes                    |
| appear / disappear | 10%   | an element enters or leaves                                  |
| zoom               | 8%    | into an element to see inside                                |
| exchange           | 7%    | an ordered back-and-forth between parties                    |
| layers             | 3%    | a stack of layers                                            |

"Replay" and "rewind" are named by 4% of plans and used by far more: a quarter of stories run
the same scenario again with one thing changed.

What the reviewers added, area after area (`plans/*.review.md`):

1. **Stories are functions of settings, not fixed frames.** Most interactions flip a policy or
   move a number and expect the story to change.
2. **The same start, two outcomes.** Half of all plans run one scenario twice: without the idea
   and with it. Side by side, or rewound and replayed.
3. **Numbers must be computed.** The commonest error found in review was arithmetic.
4. **Things keep their identity as they travel.** A message, an artifact with its seal, a commit.
5. **A few arrangements recur everywhere**: queues and trays with things in them, gates that
   stamp ✓ or ✗, ladders of messages, stacks of layers, crowds, ledgers, timelines with spans.
6. **Failure is the best teacher**, and viewers want to cause it.

## 2. What Mogram has, and the gap

`docs/research/concepts/mogram-today.md` has the detail. Mogram draws elements, boundaries,
streams of traffic, states (including failure) and nested zoom; scenes switch between whole
states; tours step through elements and dim the rest; and a capacity model computes traffic,
scaling and overload from the diagram, the same in the editor, the viewer and exports (D-82,
D-84). In the viewer, "What if it were…" already lets someone take an element down and watch the
model answer.

The gap is **time and small things**. Nothing appears or changes place. There are no small
things with identity. There is no ordered story with words. Nothing shows a number except load.
The viewer can pick a scene and poke a state, and nothing else.

## 3. Principles

1. **Few tools, each general.** No commit-graph widget, no Kubernetes widget, no responsibility
   stack. Those are made from the general tools.
2. **Everything is still an element in one file.** A token is a small shape. A queue is a
   container that arranges what's in it. A caption is text on a step. Every new idea is a key on
   something that already exists.
3. **A model where there can be one** (D-82). What the capacity model can compute, it computes:
   nobody animates a scale-out. Everywhere else a story sets states step by step, and §8 is
   honest about what that costs.
4. **Derived, not typed.** A number on screen is a value or a formula, never retyped per step.
5. **The geometry stays still.** A diagram is laid out once, with room for everything it will
   ever show. Steps change what's there, how it looks, and where small things are. Nothing
   unrelated ever shifts, and routes never jump.
6. **One way to say each thing.**

## 4. The tools

Six. Three exist today and are extended.

| Tool                  | Today                                             | Becomes                                                                    |
| --------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| **Elements**          | components, shapes, containers, connections, text | + a card, a meter, marks; any element can start hidden or be a copy        |
| **Layouts**           | free placement                                    | + containers that arrange what's in them; things that ride on other things |
| **Values & controls** | `data:` shown in labels                           | + formulas; dials, toggles and picks for the viewer                        |
| **Stories**           | (scenes played in order; tours)                   | named runs of steps with captions                                          |
| **Scenes**            | a state per element                               | named sets of any change                                                   |
| **The model**         | traffic, scaling, failover                        | unchanged; runs on whatever the story has made                             |

### 4.1 One vocabulary for change: `set`

Scenes and steps both say "these differ, like this". A `set` names things and gives each its new
value: a word, or keys.

```yaml
set:
  db_primary: down # a state, as today
  app_to_db: blocked # a flow, as today
  users_to_lb: 5x # traffic, as today
  banner: shown # presence: shown | faded | hidden
  msg7: { on: worker_a } # its place
  row: { label: "likes: 11" } # what it says
  gate2: { mark: cross, tone: rose } # how it's marked
  lease_left: [30, 0] # a value, here running from 30 to 0
```

What a `set` can change, and nothing else: `state`, `flow`, `motion`; the capacity numbers
(`traffic`, `share`, `hit`, `copies`, `size`); presence; `label`; `tone` (shapes); `mark`; place
(`in`, `on`, `cell`, `at`, `span`); and values. It can't change what a thing is: its kind,
shape, look, connection ends, card or link.

A **scene** is a named `set`. A **step** is a `set` with a caption.

### 4.2 Elements

- **Presence.** `show: hidden` on an element: it isn't there until a step or scene makes it
  `shown`.
- **Three levels of presence**: `shown`, `faded` (still there, pale: an unreachable commit, a
  retired version) and `hidden` (absent: the model doesn't see it, and it isn't counted).
  Presence cascades: what's inside a hidden container, riding on a hidden thing, or connected to
  one, is hidden too.
- **Copies.** `like: other` copies another element's kind, look, label, size and data (once, not
  as a live link; not its place or connections). Shown, it grows out of the original. On a
  **container**, `like:` copies everything inside too, each addressed by path (`after.web`), so
  "the same start, twice" is true by construction.
- **Marks.** `mark: check | cross | warn | lock | key | clock | star | question`: a small sign
  at the element's corner, opposite its state badge. A mark means nothing to the model.
- **Two new shapes**: `card`, a thing with fields (a JWT's claims, a packet's header, a row),
  whose fields can be lit; and `meter` (§4.4). Later: `code` (lines of text, with lines lit) and
  `chart`.
- **Not new shapes**: a token is a small rounded shape, a message a small envelope icon, one of a
  crowd a small circle. They're entries in the library's new **Explain** group, sized by their
  words. A branch name or an offset marker is today's label pill, riding on something.

### 4.3 Layouts

**A container can arrange what's in it** (`layout:`). Its children then need no positions, and
its contents can change.

| Layout     | Arranges children                                                                                                       | Makes                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `row`      | left to right, in file order                                                                                            | a queue, a pipeline, a log, a lane                                                                    |
| `column`   | top to bottom (`gap: none` for flush layers)                                                                            | a ledger, a ranked list, a stack                                                                      |
| `grid`     | in columns, or at a written `cell: [col, row]`                                                                          | a table, a crowd, a commit graph                                                                      |
| `axis`     | at a value (`at: 500`) or across a span (`span: [500, 750]`) on a scale it declares; `round: true` bends it into a ring | a timeline with spans and a "now", key ranges, windows and watermarks, a trace waterfall, a hash ring |
| `sequence` | as parties with lifelines; the connections between them are messages down the page, in file order                       | a ladder: TLS, OAuth, TCP, DNS                                                                        |

- A layout container **keeps room for the most it ever holds** in any story or scene, as a scale
  set keeps room for its most copies. When something leaves a `row` or `column` the rest close
  up inside that room; the container and everything around it stay put.
- A container can **look like something**: `shape: queue | cylinder | …` draws it as that shape
  and not as a frame with a header.
- `sequence` is the one layout that owns its connections (they aren't routed; they're rows). It
  is specified and built last.

**A thing can ride on another** (`on:`): a branch name on a commit, a message at a consumer, a
breaker on an arrow (`on:` a connection, with `along: 50%`). Riders sit beside what they ride on
and go where it goes.

**Place.** A thing placed by a layout (in a layout container, or riding) can change place: a
step sets its `in` or `on`, and it travels there, along the connection between the two places
when there is one (either way along it), straight otherwise, above everything it crosses. A thing
placed freely on the canvas never moves in a story. So: the same `msg7` in the queue, on the
arrow, at the worker.

### 4.4 Values and controls

`data:` values already show in labels as `%key%`.

- **Formulas.** `budget_left: "= 1 - errors / allowed"`. Arithmetic, comparisons, `min`, `max`,
  `round`, `floor`, `ceil`, `log2`, `if(…)`. They read other values and controls.
- **The model can be read**, by what's shown: `load(web)`, `copies(web)`, `traffic(a_to_b)`,
  `count(queue)` (shown things directly in or on it).
- **The model can be driven**: a connection's `traffic` and `share` and a component's `capacity`
  and `hit` can be formulas. Turn up a dial and the scale set grows, because that's what the
  model computes. (A formula that feeds the model can't read it; no loops.)
- **Meters** show a value against a `max`, as a bar, a ring (a timer), a number, or dots (N of M:
  a crowd with some tinted). A meter can have a `limit` it turns amber and red at.
- **Controls** are what the viewer can touch:

  ```yaml
  controls:
    rps: { dial: [1, 10], start: 2, unit: "×", label: Traffic } # sets a number
    retries: { toggle: retry_storm, label: Retries } # turns a scene on; 1 or 0 in formulas
    model: { pick: [on_prem, iaas, paas, saas], label: Model } # one of these scenes
    burst: { button: send_burst, label: Send a burst } # plays a story (§4.5)
  ```

  A control's value belongs to the viewer: a step can't set it.

### 4.5 Stories

```yaml
stories:
  main:
    - say: A consumer takes message 7. It's leased to them, not deleted.
    - set: { msg7: { on: worker_a }, lease: shown, lease_left: [30, 20] }
      focus: [worker_a, lease]
    - say: The same again, but the work is slow. The lease runs out…
      rewind: start
      set: { msg7: { on: worker_a }, lease: shown, lease_left: [30, 0] }
      pace: slow
    - set: { msg7_again: shown }
    - say: …and a second consumer takes it too.
      set: { msg7_again: { on: worker_b } }
      choices:
        - { label: Renew the lease in time, play: renewed }
  renewed:
    - say: At 25 seconds the worker renews. One charge.
      set: { lease_left: [5, 30] }
```

- A **step** has a `set`, and optionally: `say` (its caption); `focus` (what stays bright while
  the rest dims); `zoom` (an element for the camera to frame, or a nested diagram to enter);
  `hold` (seconds it stays; may be a value); `pace: slow` (for the moment); `name`; `rewind`;
  `when`; `choices`.
- **Beats.** A step with `say` starts a beat. Steps after it with no `say` belong to that beat
  and play on by themselves, in order. The viewer moves by beat. So "A is copied, lands on main,
  and is stamped" is one caption and three things happening in turn.
- **Changes accumulate.** The picture at a step is the diagram plus every step before it.
- **`rewind: start`** (or a step's name) begins this step from that picture, with a quick fade
  marked ⟲, never by running things backwards. That's "the same again, with one thing changed".
- **`when: "= work > lease"`** leaves a step out unless the formula holds, so a dial can change
  what happens, not just what's printed. Changing a control replays the current beat.
- **`choices`** are buttons that play another named story from the current picture, then come
  back. A `button` control does the same from anywhere. That's branching, without jumps.
- The story a diagram plays is its first. **Tours** keep working; a later change reads them as
  stories that focus an element and show its card.

### 4.6 Scenes

Scenes keep their meaning (a state of the diagram the viewer can switch to) and gain the whole
of §4.1. With controls, they're also what a toggle or a pick turns on.

### 4.7 The model, and where it stops

The capacity model runs on whatever the story and scenes have made: a step that sets
`users_to_lb: 5x` doesn't animate a scale-out, the model scales out. That's the best kind of
story: true for any setting of any dial.

It sees components and connections. It doesn't see small things: a token travelling an arrow
isn't traffic, and a row of envelopes isn't a queue to it. A concept picks, per element, the
model's streams or the story's tokens. Its timing is its own, so stories _about_ a control loop
(lag, cool-down, flapping) are told with steps. And where its automatic rules would fight a story
(an arrow blocked because its end is `down`), what the story sets wins.

## 5. What the picture is

One definition, so the editor, the viewer, thumbnails and exports can't disagree.

**The picture is laid over in this order:** the diagram → the steps on the path so far → the
scenes that are on → the viewer's what-ifs → what the model derives (cascade, reroute, load).

- **The path** is the beats played: the first story from its start, with each `rewind` a cut and
  each chosen story run from where it was called. A step whose `when` is false isn't on the
  path. Scrubbing moves along the path.
- **Scenes on**: the one picked in the scene strip, then each toggle and pick in the order the
  controls are written. Later wins.
- **A scene laid over a step** doesn't change which steps ran; it changes the picture.
- **Time.** A step is its change (0.6 s, or 1.2 s when slow), then its hold. A ramp `[a, b]`
  runs across both. Stepping plays the step to its end. For exports, thumbnails and scrubbing
  each step has its written times and the model is run along the path from the start; live, the
  model keeps running on the real clock and agrees once settled.
- **Hidden means absent**: from the model, from `count()`, and from what a container needs room
  for only in the sense that room is kept for the most there ever is.
- **Values** are the diagram's (`data:` at the top level), plus controls. A label shows a value
  as it stands at the step; a meter moves with it.
- **File order is order**: of children in a `row`, `column` and `grid`, and of messages in a
  `sequence`. So the YAML reads the way the picture does.

## 6. Every technique, from the tools

| Technique          | Made from                                                          |
| ------------------ | ------------------------------------------------------------------ |
| caption            | a step's `say`                                                     |
| failure            | states, `blocked` flows, a `cross` mark; the viewer's what-if      |
| side by side       | a container and its `like:` copy, changed by the same steps        |
| token              | a small shape whose place changes; it travels along the connection |
| restyle            | `set` (state, label, tone, mark, faded)                            |
| contents           | a layout container holding small shapes                            |
| meter, timer       | a `meter`; a timer is a ring whose value runs across a step        |
| spotlight          | a step's `focus`                                                   |
| toggle, dial       | controls                                                           |
| boundary           | containers and groups (as today)                                   |
| path trace         | `focus` on the connections along the path, a beat at a time        |
| choice             | a step's `choices`; a `pick` control                               |
| lanes              | a `grid` with written cells; an `axis` when the lane is time       |
| move, clone        | `set` a new place; `like:` and `shown`                             |
| stream             | traffic on connections (as today)                                  |
| chart              | a `chart` (later); until then an `axis` with points                |
| appear / disappear | `hidden`, `shown`                                                  |
| zoom               | nested diagrams (as today); a step's `zoom`                        |
| exchange           | a `sequence` container                                             |
| layers             | a `column` with `gap: none`                                        |
| replay             | `rewind`; a toggle and `when`                                      |

## 7. Workflows and where they live

**Making a story (editor).** The dock at the bottom shows **Scenes** or **Story**. Story is a
row of beats: an _Opening_ tile, then one per beat with its caption, the steps inside it, and
**the list of what it changes** ("shows A′ · moves `feature` · fades A"), each with a ×. Select a
step and the canvas shows the picture there.

The rule has two halves, shown as two places:

- **What a thing is** (its shape and look, size, free position, connection ends, card, data,
  how it scales) always belongs to the diagram, whichever tile is selected.
- **What's happening to it** (shown, faded or hidden; its place; state, flow, label, mark, tone;
  traffic) belongs to the selected step. The inspector has one section for exactly these, **At
  this step**, and each field in it can be made the starting value.

On the canvas, with a step selected:

- **Add** something: it's hidden at the start and shown at this step. Before then it's a faint
  outline, so it can still be placed and styled.
- **Delete**: "Hide from here on" or "Delete everywhere".
- **Drag** a thing onto an element or into a layout container: it moves there at this step. Drag
  anything anywhere else: its position changes in the diagram, for every step.

A change that puts something back as it was removes the step's line. Undo goes back to the tile
the change was made on. Scenes work the same way.

**The inspector.** Containers gain **Layout** and **Shape**. Elements gain **Rides on**,
**Mark** and **Presence**. The Diagram inspector gains **Controls** beside Data.

**The library.** One new group, **Explain**: token, message, dot, card, meter, label.

**Watching** (viewer, previews, the concept window). A caption under the diagram, with previous,
next, play and a scrubber that moves by beat; the controls beside it; choices as buttons when a
beat offers them; scenes and what-ifs as today. Arrows and space on the keyboard.

**Exporting.** One image per beat; then an animated export with the captions drawn in.

**Concepts.** A concept plays its first story in the gallery and the concept window. Applying a
pattern brings its behaviour and scenes, as today, and not its story (a story is about the
concept's own cast). Inserting the example brings everything.

## 8. What we won't build, and what it costs

- **A general simulator.** Queues with real delivery semantics, feedback loops, random sampling,
  "crash it at any instant and recover correctly". Outside the capacity model, a story is states
  set step by step, and a control picks between them. From a sample of 40 plans: about four in
  five keep the beat that makes the idea click, two in five lose some or all of their
  interaction (it becomes a toggle, a button, or a second scripted run), and one in five has to
  be rethought. `axis`, `when` and meter limits bring back roughly half of that last fifth.
- **Many of one thing.** A hundred keys on a ring, a thousand requests in a dot plot. They become
  a dozen, or a count. Rules per element would be scripting.
- **Machines that run by themselves**: a breaker's cycle, congestion control, an autoscaler's
  loop. Scripted paths with a button or two.
- **Text the viewer types.** A claim, a query string, a selector.
- **Things that change size** (other than what the model scales).
- **Widgets for one area.** `sequence` is the one layout that earns an exception.
- **Keyframes.** A step's `set` is a keyframe of states; what's refused is curves and paths
  drawn by hand. `pace: slow` is the one concession.
- **Two diagrams in step, dragging in the viewer, maps, 3D, sound.**

**The risk this leaves.** Hand-set states can be quietly wrong: a meter that disagrees with the
picture was the commonest error in the plans, and the format doesn't forbid it. What reduces it:

- the model wherever it reaches, and formulas for every number shown;
- container copies, so two sides can't drift;
- a **story check** in the concept catalog's test: every meter shows a value or a formula; no
  number is typed in a caption that a value holds; every element is shown by some step; every
  step changes something; every story a choice plays exists and ends;
- each concept rendered beat by beat and read against its reviewed plan before it ships.

## 9. How it's built

All in `@mogram/core` first, so the editor, viewer, exports and assistant share it.

- **`format/`**: the new keys and sections, each with plain-language diagnostics.
- **`picture/`** (new): **one type for where we are** (the path, the controls, the scene picked,
  the what-ifs), replacing the `scene: string | null` that runs through the stores, the
  resolver, exports and links; and `pictureAt`, which returns a plain `Diagram` (changes folded
  in, hidden things gone, formulas worked out to numbers) so `resolveState`, `planCapacity` and
  the renderer stay as they are.
- **`values/`** (new): the formula language, safe and small.
- **`layout/`**: one layout of the diagram with everything shown and room reserved; slots for
  things placed by a layout, per picture; riders.
- **`edit/`**: commands for steps and controls, and "this change belongs to this step" for the
  properties of §7.
- **Canvas**: geometry and routes computed once; presence and looks from the picture; a layer
  above the containers for things in flight.
- **Viewer, editor, exports**: §7.

**Milestones.** Each is finished, documented and verified before the next. Ten reviewed plans
(the ones the review expressed) are written first as fixtures, failing, and are the acceptance
test: a milestone is done when the fixtures it's meant to carry play correctly.

- [x] **K0 The picture**: the position type (`Moment`) through the stores, resolver, exports
      and links, with no change in behaviour.
- [x] **K1 Change and presence**: `show: shown | faded | hidden`; the wider `set` in scenes
      (label, tone, mark); `pictureAt`. A scene can show and hide things.
- [x] **K2 Stories**: `stories:`; steps, beats, `say`, `focus`, `hold`, `pace`, `rewind`,
      `choices`; canonical time; the story bar in the viewer, previews and the concept window;
      the Story dock; exports of a step, of every beat, and animated with captions.
- [x] **K3 Layouts and place**: `row`, `column`, `grid`; reserved room; riders on elements and
      connections; changing place and travel; `like` on elements. _Not yet_: a container drawn
      as a shape; the Explain group in the library.
- [x] **K4 Values and controls**: formulas; values in `set` and runs; `meter`; `dial`, `toggle`
      and `pick`; `when`; traffic as a formula. _Not yet_: formulas for share, hit and capacity;
      run ends as formulas; dots; a `button`.
- [ ] **K5 Authoring** (partly): the dock, **At this step** (the Presence section), placing by
      drag and container layout are built. _Not yet_: add and delete rules on the canvas;
      controls, values and meters in the inspector; `when`, `hold`, `rewind`, `focus` and
      choices in the dock.
- [ ] **K6 Two sides and branches** (partly): choices and pick are built. _Not yet_: `like` on
      a container; `button`.
- [ ] **K7 More arrangements** (partly): `on:` a connection is built. _Not yet_: `axis`;
      `sequence`; `card`.
- [ ] **K8 Finish** (partly): animated export with captions and the story check are built.
      _Not yet_: `code` and `chart`; tours as stories; the assistant's tools.
- [ ] **K9 Concepts**: 2 of 1,293 authored (`blue-green-deployment`, `visibility-timeout`);
      topics cover the sixteen areas.

Work paused on 2026-10-09 after K4. [Where it stands, and how to carry on](concept-platform-status.md)
has the detail: what each milestone still needs, the order to take it in, and how to author and
check a concept.

## 10. Decisions this records

- The dial brings back "how much traffic" as something a viewer sets, which D-84 removed. The
  difference: it's a control a concept declares, bound to a value the model reads, not a slider
  on every diagram.
- "Story" becomes the name of a named run of steps. Scenes played in order (today's `story`
  in the code and the export option) is renamed "playing the scenes".
- Geometry is fixed for the life of a story. A thing placed freely never moves in one.

## 11. What the second review changed

The first version was reviewed against ten plans expressed in its format and against the code
(`concept-platform.review.md`). Nine of its ten recommendations are taken in full; the last is
taken in part.

| Was                                                 | Is                                                                      | Why                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| The picture left to the build                       | §5, and one position type built first                                   | 45 open questions; `pictureAt` is their answers                          |
| A step is a beat                                    | Steps without `say` continue the beat                                   | 51 beats needed 92 steps; merged, they teach the wrong thing             |
| Layout before and after each step, tweened          | One layout, room reserved, only placed things move                      | Routes can't be tweened; D-82 already chose this                         |
| Side by side typed twice                            | `like:` on a container                                                  | Half of all plans; nothing kept the two starts the same                  |
| `when` cut; dials change printed numbers            | `when` on any formula; meter limits; formulas into the model            | Thresholds crossed by a dial are a whole kind of story                   |
| "The scene workflow you know"                       | **At this step**, three canvas rules, a change list                     | Today that workflow covers four properties                               |
| `stack`; `chip`, `envelope`, `dot`, `tag` as shapes | `column` with no gap; library presets; the label pill                   | Special cases; pays for `axis`, riding on connections, shaped containers |
| `show`/`hide`/`move`/`values`/`trace`; `badge`      | One `set`, with presence as words and values by name; `mark`            | One way to say each thing                                                |
| `choices` jumping to steps; a single `story:`       | Named `stories:`; choices and buttons play one                          | No jumps; inserting a concept can't collide with a story                 |
| The model "runs on everything"                      | §4.7 says where it stops; the viewer's what-if is kept                  | Tokens aren't traffic                                                    |
| Tools in dependency order; concepts last            | Fixtures first; a dock with the first stories; concepts as tools arrive | The format should meet a real concept before K1, not at K6               |

Taken in part: the review's first-release cut left out formulas into the model, `when`,
`sequence` and container copies. They're kept, in later milestones (K4, K6, K7), because the
1,293 concepts need them and this plan is for all of them.
