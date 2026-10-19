# Review: Mogram as a platform for explaining

An independent review of `docs/plans/concept-platform.md` (the plan), written before anything is
built. Read for it: the plan; `docs/research/concepts/README.md` and `mogram-today.md`;
`docs/file-format.md`; D-82 to D-85; the "patterns for the platform" section of all 38 reviewer
summaries; ten concept plans in full and thirty more skimmed (listed in F); and the engine
(`packages/core/src/model/types.ts`, `state/resolve.ts`, `layout/compute.ts`, `layout/paint.ts`,
`timeline/`, `capacity/timeline.ts`, `edit/story.ts`, `apps/web/src/features/canvas/scene.ts` and
`frames.ts`, `editor/use-editor-scene.ts`, `editor/chrome/scene-strip.tsx`, `viewer/`, `export/`).

**In short.** The principles are right, and the core idea (one `set` vocabulary shared by scenes
and steps, with identity kept by changing an element's place) is the right centre. The six tools
are close to the right six. But the plan is a vocabulary without semantics: almost every question
about what the picture _is_ at a given moment is open, and several answers the plan implies are
much harder against the code than §9 and §10 admit. Writing ten plans in the format showed four
things the tools can't do that most plans need: put changes in order inside one beat, start two
panels from one definition, let a number decide what happens, and place something by a value.
None of them needs a new special-purpose tool. The verdict is in G.

---

## A. Ten plans in the proposed format

### What I had to invent to write anything

The plan's examples leave these out, so each sketch below assumes them. They are the first list
of things to settle.

| #   | Assumed                                                             | Why it was needed                                                               |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| i1  | A step has `name:`                                                  | §4.5 uses `go: renewed` and `rewind: start`, and no step in the plan has a name |
| i2  | A step with no `say` belongs to the beat before it and plays on     | One beat is usually several changes in order (see below)                        |
| i3  | `{ shape: meter, as: bar/ring/number/dots, value: …, max: … }`      | §4.2 names the meter and gives no keys                                          |
| i4  | A ramp's ends can be values: `fails: [0, threshold]`                | Otherwise every ramp contradicts its dial                                       |
| i5  | `when: not pkce`                                                    | §4.5 shows only `when: retries`                                                 |
| i6  | `trace:` and `focus:` take lists of element names                   | §4.5 doesn't say what a trace is made of                                        |
| i7  | A scene's body stays the bare map of today (`outage: { db: down }`) | §4.1 calls a scene "a named `set`" and doesn't show one                         |
| i8  | Setting `on:` or `in:` replaces the other                           | §4.5 writes `msg7: { on: worker_a }` for something that was `in: queue`         |
| i9  | `move:` isn't used                                                  | It can't say whether the new place is `in:` or `on:`                            |
| i10 | A control and the value it sets share a name (`rps`)                | §4.4 uses `rps` both ways                                                       |

### A1. Merge vs rebase (`git-merge-vs-rebase`, `plans/git.part1.md`)

```yaml
name: Merge vs rebase
styles:
  parent: { route: straight }
  feat: { tone: violet }
containers:
  merge: { label: git merge, layout: grid }
  rebase: { label: git rebase, layout: grid }
shapes:
  # left panel: main 1–5 on row 0, feature A B C on row 1
  m1: { shape: chip, label: "1", in: merge, cell: [0, 0] }
  m2: { shape: chip, label: "2", in: merge, cell: [1, 0] }
  m3: { shape: chip, label: "3", in: merge, cell: [2, 0] }
  m4: { shape: chip, label: "4", in: merge, cell: [3, 0] }
  m5: { shape: chip, label: "5", in: merge, cell: [4, 0] }
  ma: { shape: chip, label: "A a1f3", in: merge, cell: [3, 1], style: feat }
  mb: { shape: chip, label: "B 29bc", in: merge, cell: [4, 1], style: feat }
  mc: { shape: chip, label: "C d4a7", in: merge, cell: [5, 1], style: feat }
  mm: { shape: chip, label: M, in: merge, cell: [6, 0], hidden: true }
  m_main: { shape: tag, label: main, on: m5 }
  m_feature: { shape: tag, label: feature, on: mc, style: feat }
  # right panel: the same fork written out again as r1–r5, ra, rb, rc, r_main, r_feature (10 lines)
  ra2: { like: ra, label: "A′ 7e02", cell: [5, 0], hidden: true }
  rb2: { like: rb, label: "B′ c91d", cell: [6, 0], hidden: true }
  rc2: { like: rc, label: "C′ 40aa", cell: [7, 0], hidden: true }
  same: { shape: rounded, label: "Same files ✓", tone: green, hidden: true }
connections:
  m2_m1: { from: m2, to: m1, style: parent } # and m3_m2, m4_m3, m5_m4, ma_m3, mb_ma, mc_mb
  mm_m5: { from: mm, to: m5, style: parent, hidden: true }
  mm_mc: { from: mm, to: mc, style: parent, hidden: true }
  # the same seven again for r*, then:
  ra2_r5: { from: ra2, to: r5, style: parent, hidden: true }
  rb2_ra2: { from: rb2, to: ra2, style: parent, hidden: true }
  rc2_rb2: { from: rc2, to: rb2, style: parent, hidden: true }
  tips: { from: mm, to: rc2, label: identical, hidden: true }
story:
  - say: "Merge: history exactly as it happened."
    show: [mm, mm_m5, mm_mc]
    set: { m_main: { on: mm } }
  - say: "Rebase: rewritten onto the new base."
    show: [ra2, ra2_r5]
  - show: [rb2, rb2_ra2]
  - show: [rc2, rc2_rb2]
  - set: { ra: { opacity: 30 }, rb: { opacity: 30 }, rc: { opacity: 30 }, r_feature: { on: rc2 } }
  - set: { r_main: { on: rc2 } } # the fast-forward
  - say: Same code either way.
    show: [same, tips]
    focus: [mm, rc2, same]
  - say: Merge keeps ids. Rebase replaces them.
    hide: [same, tips]
    focus: [ma, mb, mc, ra2, rb2, rc2]
  - say: "Shared with others? Merge. Still only yours? Rebase freely."
```

- **Couldn't express.** The two panels starting from the _same_ fork: the fork is written twice
  under two prefixes (10 shapes and 7 connections repeated), and nothing checks the copies agree.
  The originals' parent arrows fading with them (connections have no `opacity`).
- **Awkward.** Every commit's `cell` is worked out by hand, and a cherry-pick or one more commit
  renumbers the row. 19 connections each need `route: straight` (a style helps). Beat 2 is five
  steps, because clone, clone, clone, fade, slide is an order and a step has none.
- **Faked.** The diff overlay is a shape and a connection shown for one step. "The ids light up"
  is `focus`, which §4.5 says also moves the camera: framing six chips across two panels is fine,
  but beat 1's natural `focus: [merge]` would zoom away from the panel it's being compared with.
- **Dropped.** The teammate's copy that still matches the left panel (a third copy of the
  branch). The toggle, which side by side makes redundant.

### A2. Bisect (`git-bisect`, `plans/git.part2.md`)

```yaml
name: Bisect
data:
  n: 1000
  left: 1000 # commits that could still be the culprit
  tried: 0
  scanned: 0
  bisect_tests: "= ceil(log2(n))" # the formula language needs log2 and ceil
controls:
  n: { dial: [100, 100000], label: Commits } # three decades: the dial needs a log scale
containers:
  bisect: { label: git bisect, layout: column }
  scan: { label: One by one, layout: column }
shapes:
  suspects: { shape: meter, as: bar, value: left, max: n, label: "%left% suspects", in: bisect }
  counter: { shape: meter, as: number, value: tried, label: tests, in: bisect }
  head: { shape: tag, label: "HEAD (detached) at 500", on: suspects, hidden: true }
  verdict:
    { shape: chip, label: "731 is the first bad commit", tone: rose, in: bisect, hidden: true }
  scan_left: { shape: meter, as: bar, value: "= n - scanned", max: n, in: scan }
  scan_counter: { shape: meter, as: number, value: scanned, label: tests, in: scan }
  script: { shape: document, label: "./test.sh", on: bisect, hidden: true }
story:
  - say: Test the midpoint.
    show: [head]
    set: { head: { badge: check } }
    values: { left: [1000, 500], tried: 1, scanned: 1 }
  - say: Each answer throws away half.
    set: { head: { label: "HEAD at 750", badge: cross } }
    values: { left: [500, 250], tried: 2, scanned: 2 }
  - set: { head: { label: "HEAD at 625", badge: check } }
    values: { left: [250, 125], tried: 3, scanned: 3 }
  # six more of the same: 687 ✓, 718 ✓, 734 ✗, 726 ✓, 730 ✓, 732 ✗
  - say: About ten tests, not hundreds.
    show: [verdict]
    set: { head: { label: "HEAD at 731", badge: cross } }
    values: { left: 1, tried: 10, scanned: 10 }
    focus: [verdict, counter, scan_left]
  - say: Or let a script answer.
    rewind: start
    show: [script]
    values: { left: [1000, 1], tried: [0, 10] }
```

- **Couldn't express.** The picture itself: a lane of 1,000 commits with a ruler, a good marker
  and a bad marker that move, and a band between them that halves. Nothing in §4.3 places a thing
  _at 500 of 1,000_ or draws a span from 500 to 750. `grid` is discrete and written by hand, a
  rider has no position along what it rides, and `set` has no size. The sketch is a bar that
  halves: the arithmetic of the aha, without the search.
- **Awkward.** Ten steps for five beats, seven with nothing to say. The same nine lines repeated
  with different numbers, each typed by hand: exactly what "numbers must be computed" is against.
- **Faked.** HEAD's jump is a label that changes. The script's replay is one linear ramp, where
  the plan wants the same halving without pauses.
- **Dropped.** The dial's effect on the story (17 tests at 100,000 means 17 steps: a number can't
  make steps), so the dial only changes two printed numbers. Marking commits unbuildable.

### A3. Consumer groups (`consumer-groups`, `plans/messaging.part1.md`)

```yaml
name: Consumer groups
containers:
  topic: { label: "orders: one log", layout: column }
  p0: { label: P0, in: topic, layout: row }
  p1: { label: P1, in: topic, layout: row }
  p2: { label: P2, in: topic, layout: row }
  p3: { label: P3, in: topic, layout: row }
  billing: { label: "group: billing", layout: column, color: "#8b5cf6" }
  analytics: { label: "group: analytics", layout: column, color: "#22c55e" }
shapes:
  p0_0: { shape: chip, label: "0", in: p0 } # and p0_1 to p0_3, then four in each of p1 to p3
  p0_new: { shape: chip, label: "4", in: p0, tone: amber, hidden: true }
  b1: { shape: rounded, label: member 1, in: billing, tone: violet }
  b2: { shape: rounded, label: member 2, in: billing, tone: violet }
  b3: { shape: rounded, label: member 3, in: billing, tone: violet }
  b4: { shape: rounded, label: member 4, in: billing, tone: violet, hidden: true }
  a1: { shape: rounded, label: member 1, in: analytics, tone: green }
  b_off0: { shape: tag, label: billing, tone: violet, on: p0_3 } # one per group per partition:
  a_off0: { shape: tag, label: analytics, tone: green, on: p0_1 } # six more for p1 to p3
  to_b: { like: p0_new, hidden: true } # the event as billing reads it
  to_a: { like: p0_new, hidden: true } # and as analytics reads it
connections:
  p0_b1: { from: p0, to: b1 }
  p3_b1: { from: p3, to: b1 }
  p1_b2: { from: p1, to: b2 }
  p2_b3: { from: p2, to: b3 }
  p3_b4: { from: p3, to: b4, hidden: true }
  p0_a1: { from: p0, to: a1 } # and p1_a1, p2_a1, p3_a1
story:
  - say: "Across groups: everyone sees everything."
    show: [p0_new]
  - show: [to_b, to_a]
  - set: { to_b: { on: b1 }, to_a: { on: a1 } }
  - set: { b_off0: { on: p0_new } }
  - say: "Inside a group: each partition to one member."
    focus: [billing, p0_b1, p1_b2, p2_b3, p3_b1]
  - say: One log, a set of markers per group.
    focus: [p0, b_off0, a_off0]
  - say: Add members, up to the partition count.
    show: [b4, p3_b4]
    hide: [p3_b1]
```

- **Couldn't express.** The interaction: add or remove members and watch assignment shift. That
  is a rule (partitions spread over members), and the format has no rules. It can only be a
  `choice` control over hand-drawn scenes (`billing_1` … `billing_4`), each hiding members and
  arrows and showing others that exist only for that scene, which is what the reviewers warned
  about ("matching should be real logic, not hand-drawn", `containers.part1.review.md`).
- **Awkward.** One thing in two places. The event is read by both groups, so it's the original
  plus two `like:` copies, and copies travelling to the groups draw exactly the misconception the
  plan defeats ("each group gets its own stored copy"). Moving an assignment is a hide and a
  show of two connections, because a step can't re-point a connection's `to:`.
- **Faked.** The control's scenes and the story's last step fight: with `billing_3` chosen, step
  7 shows `b4` and the scene hides it again, so the step does nothing.
- **Dropped.** The interaction, in any honest form.

### A4. Saga (`saga`, `plans/messaging.part2.md`)

```yaml
name: Saga
containers:
  services: { layout: row }
  order: { label: Order, in: services, layout: column }
  payment: { label: Payment, in: services, layout: column }
  inventory: { label: Inventory, in: services, layout: column }
  shipping: { label: Shipping, in: services, layout: column }
  order_db: { label: orders, in: order, layout: column } # a box: a cylinder can't hold rows
  payment_db: { label: payments, in: payment, layout: column }
  inventory_db: { label: stock, in: inventory, layout: column }
  shipping_db: { label: shipments, in: shipping, layout: column }
groups:
  one_tx: { label: "one transaction?", members: [order_db, payment_db, inventory_db, shipping_db] }
components:
  customer: { type: generic/users, label: Customer }
shapes:
  order_svc: { shape: rounded, label: Order service, in: order } # and three more services
  order_row: { shape: card, label: "Order 42 · PENDING", in: order_db, hidden: true }
  charge_row: { shape: card, label: "Charge $50", in: payment_db, hidden: true }
  refund_row: { shape: card, label: "Refund $50", in: payment_db, tone: amber, hidden: true }
  stock_row: { shape: card, label: "Widget · 0 left", in: inventory_db }
  status: { shape: tag, label: "no order yet", on: customer }
  msg: { shape: envelope, label: order 42, on: order_svc, hidden: true }
  undo: { shape: envelope, label: undo, tone: amber, on: inventory_svc, hidden: true }
connections:
  order_to_payment: { from: order_svc, to: payment_svc }
  payment_to_inventory: { from: payment_svc, to: inventory_svc }
  inventory_to_shipping: { from: inventory_svc, to: shipping_svc }
controls:
  rollback: { toggle: imaginary_rollback, label: Pretend it could roll back }
scenes:
  imaginary_rollback:
    order_row: { hidden: true }
    charge_row: { hidden: true }
    refund_row: { hidden: true }
story:
  - say: No transaction spans services.
    set: { one_tx: { badge: cross } }
  - hide: [one_tx]
  - say: "Step 1: a local commit."
    show: [order_row, msg]
    set: { order_row: { badge: check }, status: { label: PENDING } }
  - set: { msg: { on: payment_svc } }
  - say: "Step 2: another."
    show: [charge_row]
    set: { charge_row: { badge: check } }
  - name: paid
    set: { msg: { on: inventory_svc } }
  - say: Step 3 fails. Steps 1 and 2 are already committed.
    set: { inventory_svc: { badge: cross, tone: rose }, msg: { hidden: true } }
    choices:
      - { label: What if shipping failed instead?, go: ship_fails }
  - say: "Undo by doing: refund, cancel."
    show: [undo]
  - set: { undo: { on: payment_svc } }
  - show: [refund_row]
  - set: { undo: { on: order_svc } }
  - set: { order_row: { label: "Order 42 · CANCELLED", tone: amber }, status: { label: CANCELLED } }
  - say: In between, others see partial state.
    focus: [customer, status]
  # the other failure. Nothing says the story above ends before this:
  - name: ship_fails
    rewind: paid
    say: Inventory reserves one. Then shipping fails.
    # and five or six more steps: three compensations, right to left
```

- **Couldn't express.** Where the main story ends. Steps are one list, a branch is more steps
  later in the list, and nothing stops Play running from "others see partial state" straight into
  `ship_fails`. A database that looks like one (a cylinder holding rows): `shape: cylinder` is a
  component and can't have children (`Component.parent` is a container, `model/types.ts:135`), so
  the databases are boxes.
- **Awkward.** Thirteen steps for six beats. Each extra failure point (the plan offers four) is
  five or six more steps written by hand. A token that appears and then leaves is two steps.
- **Faked.** The box "cracks": a cross badge, then hidden. Beat 6 says what the customer saw
  _earlier_; by then `status` reads CANCELLED, and a step can't show a past state without
  rewinding everything.
- **Dropped.** Two of the four failure points. The progress strip (four more chips, set by hand at
  every step).

This one works: the moment (the payment table keeps both the charge and the refund) is exactly
`show: [refund_row]` into a `column`, and the rollback toggle is a three-line scene.

### A5. Isolation levels (`isolation-levels`, `plans/data.part1.md`)

```yaml
name: Isolation levels
data:
  throughput: "= 100 - 22 * level" # a choice has no number in §4.4; this needs one
controls:
  level: { choice: [read_uncommitted, read_committed, snapshot, serializable], label: Level }
  vendor: { choice: [postgres, sql_server, mysql, oracle], label: Database }
containers:
  matrix: { layout: grid } # 6 columns by 5 rows, headers included
shapes:
  h_dirty: { shape: chip, label: Dirty read, in: matrix, cell: [1, 0] } # and 4 more headers
  l_ru: { shape: chip, label: Read uncommitted, in: matrix, cell: [0, 1] } # and 3 more
  ru_dirty: { shape: chip, label: "", in: matrix, cell: [1, 1] } # 20 cells in all
  default: { shape: tag, label: default, on: l_rc }
  speed: { shape: meter, as: bar, value: throughput, max: 100, label: Throughput }
scenes:
  read_uncommitted: { ru_dirty: { tone: rose, label: allowed } } # and 4 more cells
  read_committed: {} # 10 cells: this row and the one above, as a choice shows one scene at a time
  snapshot: {} # 15 cells
  serializable: {} # 20 cells
  postgres: { rr_lost: { tone: green, label: aborts }, default: { on: l_rc } }
  sql_server: { rr_phantom: { tone: rose, label: allowed }, default: { on: l_rc } }
  mysql: { rr_lost: { tone: rose, label: allowed }, default: { on: l_rr } }
  oracle: { ser_skew: { tone: rose, label: "allowed: it's snapshot" }, default: { on: l_rc } }
story:
  - say: "Weakest: even uncommitted data shows."
    scene: read_uncommitted
    focus: [l_ru, ru_dirty]
  - say: Each level up blocks another anomaly…
    scene: read_committed
  - say: …but not all of them.
    scene: snapshot
  - say: Strongest costs waits and retries.
    scene: serializable
  - say: Same name, different guarantees.
    scene: mysql
    focus: [l_rr, rr_dirty, rr_nonrep, rr_phantom, rr_lost, rr_skew]
```

- **Couldn't express.** The stage: a two-band area that _replays an anomaly_ each time the dial
  moves (three different anomalies in beat 2 alone). Each replay is three or four changes in
  order, and between replays the stage must empty while the grid stays filled. `rewind` resets
  the whole diagram, so there is no way to reset part of it. Faithfully, this plan is about thirty
  steps, most of them hiding chips. "Click any cell to replay that anomaly."
- **Awkward.** 50 lines of scene for a 20-cell table, because a `choice` shows one scene at a
  time and the table is cumulative. Level scenes and vendor scenes both set `rr_lost`; which wins
  isn't defined. A step that says `scene: read_committed` and a control that chooses the level
  are two owners of one thing.
- **Faked.** The level "dial" is a choice. The throughput formula needs the choice as a number.
- **Dropped.** The stage. That leaves the plain table of levels against anomalies, which is the
  alternative the reviewer weighed and rejected because it has no cause attached.

### A6. Consistent hashing (`consistent-hashing`, `plans/data.part2.md`)

```yaml
name: Consistent hashing
data:
  nodes: 3
  n3_load: 33
  ring_moved: "= round(100 / (nodes + 1))"
  mod_moved: "= round(100 * nodes / (nodes + 1))"
controls:
  nodes: { dial: [3, 10], label: Nodes before one joins }
  vnodes: { toggle: virtual_nodes, label: Virtual nodes }
containers:
  mod: { label: "hash(key) mod N", layout: row }
  box0: { label: "0", in: mod, layout: grid } # and box1, box2, and box3 hidden
shapes:
  ring: { shape: circle } # an outline; nothing can be placed "on the ring"
  n1: { shape: chip, label: N1, tone: blue } # each put on the circle by hand, in layout:
  n2: { shape: chip, label: N2, tone: green }
  n3: { shape: chip, label: N3, tone: amber }
  n4: { shape: chip, label: N4, tone: violet, hidden: true }
  k01: { shape: dot, tone: green } # 12 keys, not 100: each has a tone and a hand-made position
  k_new: { shape: dot, hidden: true }
  j01: { shape: dot, in: box0 } # the same 12 again for the mod strip
  ring_count: { shape: meter, as: dots, value: ring_moved, max: 100, hidden: true }
  mod_count: { shape: meter, as: dots, value: mod_moved, max: 100, hidden: true }
  load_n3: { shape: meter, as: bar, value: n3_load, max: 100, on: n3 }
story:
  - say: To find a key's node, walk clockwise.
    show: [k_new]
    set: { k_new: { tone: green } }
    trace: [k_new, n2]
  - say: A new node takes keys from one neighbour only.
    show: [n4, ring_count]
    set: { k04: { tone: violet }, k05: { tone: violet }, k06: { tone: violet } }
  - say: Mod N reshuffles most keys.
    show: [box3, mod_count]
    set: { j02: { in: box1 }, j03: { in: box2 }, j04: { in: box3 } } # and six more: 9 of 12
  - say: Losing a node moves only its keys, all onto one neighbour.
    set: { n2: down, k07: { tone: amber }, k08: { tone: amber }, k09: { tone: amber } }
    values: { n3_load: [33, 66] }
  - say: "Many points per node: even shares, and a failure's load spreads out."
    scene: virtual_nodes # nine more node marks shown and twelve keys recoloured, by hand
```

- **Couldn't express.** A ring: no layout places things round a circle, so 16 positions are
  computed by hand into `layout:`. Arcs coloured by owner. "Walk clockwise" as anything but a
  straight `trace`. A hundred keys: each key is a named element with a hand-set tone, and every
  beat re-tones or moves them one by one. Ownership is a rule (next node clockwise) and the
  format has no rules, so 100 keys is 100 lines per beat.
- **Awkward.** Twelve keys, stated twice (ring and strip). Beat 3 is nine `in:` changes.
- **Faked.** The counters are honest (`ring_moved` and `mod_moved` are formulas, so 25 against 75
  and 9 against 91 come out right as the dial moves) but the dots on the ring don't follow the
  dial. So the meters and the picture disagree as soon as the dial leaves 3: the error §1 item 3
  says the platform exists to prevent.
- **Dropped.** "Add or remove nodes and watch exactly which dots change colour." 88 of the keys.

### A7. Circuit breaker (`circuit-breaker`, `plans/reliability.part1.md`)

```yaml
name: Circuit breaker
data: { threshold: 5, cooldown: 30, fails: 0, busy: 2, busy_plain: 2, wait: 30 }
controls:
  threshold: { dial: [1, 10], label: Failures before it opens }
  cooldown: { dial: [5, 60], label: Cool-down, unit: s }
containers:
  with: { label: With a breaker, layout: row }
  without: { label: Without, layout: row }
shapes:
  caller: { shape: rounded, label: Caller, in: with }
  pool: { shape: meter, as: dots, value: busy, max: 8, label: threads waiting, on: caller }
  breaker: { shape: diamond, label: CLOSED, tone: green, in: with }
  fail_count: { shape: meter, as: number, value: fails, max: threshold, on: breaker }
  timer: { shape: meter, as: ring, value: wait, max: cooldown, on: breaker, hidden: true }
  dependency: { shape: rounded, label: Dependency, in: with }
  fallback: { shape: tag, label: cached answer, on: caller, hidden: true }
  caller2: { like: caller, in: without }
  pool2: { shape: meter, as: dots, value: busy_plain, max: 8, on: caller2 }
  dependency2: { like: dependency, in: without }
connections:
  call: { from: caller, to: breaker, flow: traffic }
  pass: { from: breaker, to: dependency, flow: traffic }
  call2: { from: caller2, to: dependency2, flow: traffic }
story:
  - say: "Closed: still hammering a dead thing."
    set: { dependency: degraded, dependency2: degraded, pass: slow, call2: slow }
    values: { busy: [2, 8], busy_plain: [2, 8], fails: [0, threshold] }
  - name: open
    say: "Open: fail fast, no more hammering."
    set: { breaker: { label: OPEN, tone: rose }, pass: blocked }
    show: [fallback]
    values: { busy: [8, 0] }
    focus: [pool, pool2]
  - show: [timer]
    values: { wait: [cooldown, 0] }
  - say: "Half-open: a few probes get through."
    hide: [timer]
    set: { breaker: { label: HALF-OPEN, tone: amber }, pass: slow }
    choices:
      - { label: The probes succeed, go: closes }
      - { label: A probe fails, go: open }
  - name: closes
    say: "Closed, open, half-open: stop, wait, test."
    set: { dependency: healthy, dependency2: healthy, pass: traffic, call2: traffic }
    values: { busy: 2, busy_plain: [8, 2], fails: 0 }
```

- **Couldn't express.** "Kill or revive the dependency and watch the switch cycle." A breaker is
  a small machine that moves by itself over time; a toggle turns on a scene, which is one still
  state. The switch _drawn on the arrow_: a rider on a connection isn't defined, so the breaker is
  a diamond between two arrows. What the picture is after `go: open` from the fourth step: steps
  one to two again, or everything so far plus step two's changes?
- **Awkward.** The system is written twice for the moment (two pools at the same instant). The
  dependency "stops answering" but can't be `down`: `resolve.ts:214` blocks every arrow into
  something down, and the beat's point is that calls keep leaving. So it's `degraded` with a
  `slow` flow, which reads as "a bit slow".
- **Faked.** Calls that fail instantly inside the caller are a `blocked` arrow. The pool is a
  number in a dots meter, not threads. The cool-down dial changes the ring's maximum; whether it
  changes how long the step takes isn't defined.
- **Dropped.** The interaction, except as two buttons at half-open.

### A8. Authorization code flow with PKCE (`oauth-authorization-code-pkce`, `plans/security.part1.md`)

```yaml
name: Authorization code flow with PKCE
controls:
  pkce: { toggle: pkce_on, label: PKCE } # must start on; a toggle starts off
containers:
  flow: { layout: sequence }
shapes:
  browser: { shape: rounded, label: Browser, in: flow }
  client: { shape: rounded, label: Client app, in: flow }
  auth: { shape: rounded, label: Authorization server, in: flow }
  token_ep: { shape: rounded, label: Token endpoint, in: flow }
  attacker: { shape: person, label: Attacker, in: flow, hidden: true }
  verifier: { shape: card, label: code_verifier, badge: lock, on: client, hidden: true }
  challenge: { shape: chip, label: "code_challenge = SHA-256(verifier)", on: client, hidden: true }
  code: { shape: chip, label: "code (one use)", on: auth, hidden: true }
  token: { shape: card, label: access token, on: token_ep, hidden: true }
  stolen: { like: code, on: attacker, hidden: true }
  implicit: { shape: document, label: "Implicit flow (removed): the token rode here", hidden: true }
connections:
  start: { from: client, to: browser, label: "sign in + code_challenge", hidden: true }
  authorize: { from: browser, to: auth, label: "/authorize?code_challenge=…", hidden: true }
  back: { from: auth, to: browser, label: "302 /callback?code=…", hidden: true }
  deliver: { from: browser, to: client, label: code, hidden: true }
  redeem: { from: client, to: token_ep, label: "code + code_verifier", hidden: true }
  issue: { from: token_ep, to: client, label: access token, hidden: true }
  replay: { from: attacker, to: token_ep, label: "code + ?", hidden: true }
  refuse: { from: token_ep, to: attacker, label: "400 invalid_grant", hidden: true }
  leak: { from: token_ep, to: attacker, label: access token, hidden: true }
scenes:
  pkce_on: {} # nothing: the scene that changes things is "off", and a toggle can't name that
story:
  - say: Send the hash, keep the secret.
    show: [verifier, challenge, start]
  - set: { challenge: { on: browser } }
  - say: User signs in at the AS.
    show: [authorize]
    set: { challenge: { on: auth } }
  - name: code_in_url
    say: Only a code travels in the open. Not a token.
    show: [code, back, implicit]
  - set: { code: { on: browser } }
  - show: [deliver]
    set: { code: { on: client } }
  - say: Now prove you're the one who started this.
    show: [redeem]
    set: { code: { on: token_ep }, verifier: { on: token_ep, badge: none } }
  - say: "Match confirmed: here's your token."
    show: [token, issue]
    set: { verifier: { badge: check }, challenge: { badge: check } }
  - set: { token: { on: client } }
  - say: A stolen code alone is useless.
    when: pkce
    rewind: code_in_url
    show: [attacker, stolen, replay, refuse]
    set: { stolen: { badge: cross } }
  - say: Without PKCE, the stolen code buys a token.
    when: not pkce
    rewind: code_in_url
    show: [attacker, stolen, replay, leak]
```

- **Couldn't express.** Where a rider sits in a ladder: `challenge: { on: browser }` should be on
  the browser's lifeline at the current message, not beside the box at the top. A payload riding
  an arrow across two hops: the client and the server have no connection between them, so the
  chip flies straight; two steps make it hop. A note on one lifeline ("user authenticates").
  A toggle that starts on.
- **Awkward.** Message order "in the order they're shown": the attack rewinds to `code_in_url`,
  which hides `deliver`, `redeem` and `issue` again, then shows `replay`. Do the attacker's
  messages take the rows the hidden ones had, or sit below three empty rows? The attacker's
  column appearing mid-story moves every lifeline unless room was kept for it.
- **Faked.** The inset is a document shape, placed by hand. Hashing and matching are badges.
- **Dropped.** Nothing important. With i1, i2 and i5 this plan fits, and `sequence` earns its
  place here: nine messages are nine connections and the ladder comes for free.

### A9. Rolling updates and rollback (`k8s-rolling-update-rollback`, `plans/containers.part1.md`)

```yaml
name: Rolling updates and rollback
data: { deadline: 600 }
containers:
  deployment: { label: "Deployment web · replicas: 4", layout: column }
  rs_v1: { label: ReplicaSet v1, in: deployment, layout: row }
  rs_v2: { label: ReplicaSet v2, in: deployment, layout: row }
  rs_v3: { label: ReplicaSet v3, in: deployment, layout: row, hidden: true }
shapes:
  surge: { shape: tag, label: "maxSurge: 1", on: deployment }
  unavailable: { shape: tag, label: "maxUnavailable: 0", on: deployment }
  a1: { shape: chip, label: v1, in: rs_v1, badge: check } # and a2, a3, a4
  b1: { shape: chip, label: v2, in: rs_v2, tone: violet, hidden: true } # and b2, b3, b4
  c1: { shape: chip, label: v3, in: rs_v3, tone: rose, hidden: true }
  clock: { shape: meter, as: ring, value: deadline, max: 600, on: deployment, hidden: true }
story:
  - say: Wait for Ready, not just Running.
    show: [b1]
  - set: { b1: { badge: check } }
  - hide: [a1]
  - show: [b2] # the cycle three more times: nine steps with nothing to say
  - set: { b2: { badge: check } }
  - hide: [a2]
  # … b3, a3, b4 …
  - say: Swapped, a few at a time. The old ReplicaSet is kept, at 0.
    hide: [a4]
    set: { rs_v1: { opacity: 40 } }
  - say: Kubernetes halts it. It doesn't roll it back.
    show: [rs_v3, c1, clock]
    set: { c1: { badge: cross } }
    values: { deadline: [600, 0] }
    hold: 6
  - set: { deployment: { badge: warn, label: "Deployment web · ProgressDeadlineExceeded" } }
  - say: "kubectl rollout undo: the same swap, in reverse."
    hide: [c1, clock]
    set:
      { rs_v3: { opacity: 40 }, deployment: { badge: none, label: "Deployment web · replicas: 4" } }
```

- **Couldn't express.** "Set maxSurge and maxUnavailable and watch the pace change": the numbers
  decide _which steps happen_ (with the 25% defaults a v1 pod leaves at once, alongside the
  surge), and a dial only sets a number. A repeat: "the cycle repeats until v1 is at 0" is nine
  more steps.
- **Awkward.** Fifteen steps for five beats. They can't be merged: showing three pods and hiding
  three in one step is "all at once", the misconception this plan exists to defeat. As pods hide,
  `rs_v1` shrinks and `rs_v2` grows; whether the deployment and everything below it jumps each
  time isn't defined. A ten-minute deadline shown as a ring needs a format (10:00), and
  containers have no `opacity`.
- **Faked.** Readiness is a badge that appears a step later.
- **Dropped.** The dials. The toggle for the 25% defaults (a second copy of the first twelve
  steps under `when:`).

Worth noting: the capacity model already draws copies booting (a ring, then a green tick) and
draining (`capacity/timeline.ts`). A scale set whose copies carried a version would tell beats
1–3 with no chips at all. The plan doesn't consider what the model could do for stories outside
traffic.

### A10. IAM policy evaluation logic (`aws-iam-policy-evaluation-logic`, `plans/aws.part1.md`)

```yaml
name: IAM policy evaluation
containers:
  row: { layout: row }
shapes:
  caller: { shape: person, label: alice, in: row }
  deny_scan: { shape: rectangle, label: Any explicit Deny?, in: row }
  rcp: { shape: diamond, label: RCP, in: row }
  scp: { shape: diamond, label: SCP, in: row }
  resource: { shape: rectangle, label: Resource policy, in: row }
  identity: { shape: rectangle, label: Identity policy, in: row }
  boundary: { shape: diamond, label: Permissions boundary, in: row }
  session: { shape: diamond, label: Session policy, in: row }
  rcp_rule: { shape: tag, label: "Allow *", on: rcp } # and scp_rule, identity_rule, boundary_rule
  scp_deny: { shape: tag, label: "Deny s3:*", tone: rose, on: scp, hidden: true }
  req: { shape: card, label: "s3:GetObject", on: caller }
  req_x: { like: req, label: "s3:GetObject · from another account", hidden: true }
  req_d: { like: req, hidden: true }
connections:
  c0: { from: caller, to: deny_scan } # and c1 to c6, gate to gate
controls:
  deny_in:
    { choice: [no_deny, deny_rcp, deny_scp, deny_identity, deny_boundary], label: Add a Deny }
  tight: { toggle: tight_boundary, label: Boundary excludes this action }
story:
  - say: Guardrails stay open until a rule narrows them.
    set: { req: { on: deny_scan } }
  - set: { req: { on: rcp }, rcp: { badge: check } }
  - set: { req: { on: scp }, scp: { badge: check } }
  - set: { req: { on: resource } }
  - say: Somewhere, a grant must say yes.
    set: { req: { on: identity, tone: green }, identity: { badge: check, tone: green } }
  - say: Boundaries and SCPs only shrink what was granted.
    set: { req: { on: boundary }, boundary: { badge: check } }
    focus: [identity_rule, boundary_rule, req]
  - set: { req: { on: session }, session: { badge: check } }
  - say: "No applicable Allow: denied by default."
    show: [req_x]
  - set: { req_x: { on: resource, badge: cross, opacity: 50 } }
  - say: One explicit Deny ends it. Nothing after matters.
    show: [scp_deny, req_d]
  - set: { req_d: { on: deny_scan, badge: cross }, deny_scan: { badge: cross, tone: rose } }
    trace: [deny_scan, scp_deny]
    focus: [deny_scan, req_d, scp_deny]
```

- **Couldn't express.** "In slow motion": a step has `hold` and no pace. The boundary clipping
  the identity policy's glow (an intersection drawn as a shape).
- **Awkward.** Eleven steps for five beats: a card passing three gates is three steps. `req_x` is
  "like `req`" and so grows out of it, but `req` is at the end of the row by then and the copy
  should start at the caller: does a copy take the original's first place, or where it is now?
  The Deny control is five scenes whose outcome (the first gate stops everything) is written by
  hand five times, and a Deny with a tight boundary is a combination nobody wrote.
- **Faked.** "The row behind it stays dark" is `focus` on the three things that matter.
- **Dropped.** Nothing important. A row, a card that rides from gate to gate and badges: this is
  the plan the tools fit best, and one row with three cards replaces the side by side.

### What the ten say together

| Plan               | Beats  | Steps  | Named elements           | Result                                            |
| ------------------ | ------ | ------ | ------------------------ | ------------------------------------------------- |
| Merge vs rebase    | 5      | 9      | about 62, half copies    | moment kept                                       |
| Bisect             | 5      | 11     | 7                        | numbers kept, picture lost                        |
| Consumer groups    | 4      | 7      | about 45                 | moment kept, interaction hand-drawn               |
| Saga               | 6      | 13     | about 25                 | kept (each further branch 5–6 more steps)         |
| Isolation levels   | 5      | 5      | about 32, 50 scene lines | table kept, the stage lost                        |
| Consistent hashing | 5      | 5      | about 45, placed by hand | numbers kept, ring faked, 12 keys for 100         |
| Circuit breaker    | 5      | 5      | about 14                 | kept, the cycle scripted                          |
| OAuth with PKCE    | 6      | 11     | about 20                 | kept                                              |
| Rolling update     | 5      | 15     | about 16                 | kept, dials lost                                  |
| IAM evaluation     | 5      | 11     | about 25                 | kept                                              |
| **Total**          | **51** | **92** |                          | 4 kept whole, 3 lose the interaction, 3 rethought |

Four findings, in order of how often they bit:

1. **A beat is not a step.** 51 beats became 92 steps. The plans say "every beat changes one
   thing", but one thing is usually three changes in order (appears, travels, is stamped), and
   §4.5 gives a step no order: everything in it happens at once. Nearly half the steps above (43
   of 92) have nothing to say.
2. **Side by side means writing it twice.** Three of the ten (and half of all plans, §1) repeat
   the cast under another prefix, and nothing keeps the two starts the same.
3. **Numbers can be shown but can't decide.** Formulas made every counter right. No dial changed
   what happened in any of the ten. In A6 the dial makes the meters contradict the picture.
4. **Nothing is placed by a value.** Bisect's band, the hash ring, and (from the wider sample)
   percentiles, watermarks, trace waterfalls and recovery spans all need "this thing sits at 500
   on a scale of 1,000".

---

## B. Tool by tool

### Do the six earn their place?

| Tool              | Verdict                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Elements          | Yes. Three of the five small shapes aren't new shapes (below). `card`, `tag`, `meter` are.   |
| Layouts           | `row`, `column`, `grid` and riders: yes. `stack` is an option, `sequence` is a special one.  |
| Values & controls | Yes, and it's the reviewers' first and third asks. As drafted it reaches only labels.        |
| Stories           | Yes. Missing: order within a beat, names, where a story ends, more than one story.           |
| Scenes            | Yes. Now doing three jobs (what-if, reusable `set`, a control's target); say which is which. |
| The model         | Yes, unchanged is right. Its reach is narrower than §4.7 says (below).                       |

### Special cases in disguise

- **`stack`** (3.5% of plans, almost all in fundamentals and containers) is a `column` with no gap
  and flush edges. Make it `layout: column` with `gap: none`, not a fifth layout. Nothing "moves
  through" a stack in the plan's version anyway (encapsulation wraps a packet per layer, which a
  stack doesn't do).
- **`sequence`** is the only layout that changes what a connection _is_: it stops being routed
  and becomes a row in a ladder, and the container draws lifelines. It serves networking and
  security (6.8% of plans). I'd keep it, because A8 shows nothing else composes into a ladder
  without two anchor dots per message. But it should be called what it is (the one layout that
  owns its connections), specified separately, and built last.
- **`envelope`** is an icon, **`chip`** is a small `rounded`, **`dot`** is a small `circle`.
  They're library entries (a size preset and an icon), not shape kinds. Five new values of
  `shape:` become two (`card`, `tag`).
- **`tag`** already half exists: a decoration can be `{ label: Legacy, tone: amber }`, a tone
  pill (`docs/file-format.md`, Layout). A tag is that pill with `on:` and a pointer. Two pills in
  one format is one too many.
- **`meter … as: dots`** "a crowd where 1 in 100 is tinted" is delivery's crowd. As "N of M" it's
  general enough (A6 and A7 used it). Sticky assignment, which the delivery review asked for, is
  not in it; fine.
- **`badge`** shares both its corner and its words with something that exists: every state
  already draws a badge (`presets/state.ts:33-63`: dot, plus, warn, bolt, cross). An element that
  is `down` with `badge: check` has two marks and the plan doesn't say where each goes.

### Missing, needed by many plans, and not composable from the six

1. **Order inside a beat.** See A. The smallest rule: a step with no `say` continues the beat
   before it and plays on by itself; the viewer's next and previous move by beat. No new key.
2. **One definition, two panels.** `like:` on a container should copy what's inside it, the
   copies addressed as `rebase.c3` the way scenes already address `aks.ingress`
   (`resolve.ts:104-119` splits entries by owner). Then "same start, two outcomes" is true by
   construction and A1 loses 17 lines. §8's "side by side is two containers in one diagram" can
   stand; it only needs the second container to be a copy and not a retyping.
3. **A condition on values.** `when:` takes "a control" (§4.5). It should take any formula
   (`when: "work > lease"`), and a meter should have a limit it turns amber or red at ("one
   gauge with a configurable red line", `aws.part2.review.md`). Without
   these a dial changes printed numbers only, and the plans whose moment is a threshold being
   crossed (visibility timeout, burn rate, watermarks, HPA) can't be told.
4. **Placing by value: an `axis` layout.** Children sit at `at: 500`, or span `[500, 750]`, on a
   scale the container declares, and both can be formulas. It serves bisect, percentiles,
   watermarks and windows, RPO and RTO spans, alert look-back windows, key ranges, CIDR blocks,
   Gantt and trace waterfalls, and (bent into a circle) the hash ring. Six reviewer summaries ask
   for it in different words: "timeline with a movable now cursor" (`observability.part2`, about
   a third of its plans), "timeline strip with named spans" (`reliability.part2`, "the second
   workhorse"), "time axes with sliding markers" (`messaging.part1`), "key-range bars"
   (`gcp.part2`), "ladders with a time scale" (`networking.part3`), "lanes over time are a core
   layout" (`delivery.part1`). It's a better fifth layout than `stack`.
5. **Things that hold things and still look like something.** "A queue is a container that lays
   out what's inside it" (§3), but a container is a frame with a header, and the shapes that look
   like a queue or a database (`shape: queue`, `cylinder`) are components that can't have
   children. Either a shape can take `layout:` and hold small things, or a container can take
   `shape:`. 43% of plans use contents, and most of them inside a queue, a table or a cache.
6. **A thing on a connection.** A breaker on the arrow, a gate on a path, a message "on the wire"
   (§4.3 names it as a place and never defines it), "which party answered" markers. `on:` should
   accept a connection, with an optional place along it.
7. **Pace.** `pace: slow` on a step. About one plan in ten slows or freezes its moment (a word
   match, see F). It's one word, not an easing curve.
8. **Many of one thing.** A hundred keys, a thousand commits, forty customers. I don't think this
   should be built (it leads straight to rules per element, which is scripting), but §8 should
   name it as a compromise. Today §8 doesn't mention it.

Three smaller ones: a way to say a story has ended before a branch begins; a toggle that starts
on; a button control ("send a burst", "flush caches": about 9% of plans mention one), which is a
control that plays a named beat; and a named "refused" effect, where a thing travels to a gate or
a boundary and bounces back (`aws.part2.review.md` calls it the commonest failure after
red-flash-and-grey, and a step can't send a thing somewhere and return it).

### Two ways to do one thing

| Pair                                                         | Suggest                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `show:`/`hide:` and `set: { x: { hidden: false } }`          | Keep `show`/`hide` in steps and scenes; `hidden` only on the element    |
| `in:` and `on:` as two keys a step may set                   | One place, two kinds; setting either replaces the other (i8)            |
| `move:` and `set: { x: { on: … } }`                          | Drop `move:`                                                            |
| A step's `choices` and the `choice` control                  | Rename one. They're unrelated, and §5 lists both under "choice"         |
| A step's `scene:` and a toggle turning a scene on            | A step's `scene:` only _includes_ that scene's changes (C4)             |
| `focus` dimming and `focus` moving the camera                | `focus` dims. The camera moves only when asked (`zoom: true`)           |
| `trace` and `focus` on connections                           | Say what `trace` adds (lighting in order), or drop it                   |
| `badge: "3"`, a number meter, `%key%` in a label             | A count is a meter or a label; `badge` takes marks only                 |
| `badge: cross`, `state: down`, `flow: blocked`, `tone: rose` | Say which means "failed" when (the model reacts only to state and flow) |
| `like:` and `style:`                                         | Say exactly what `like` copies, and that it isn't a live link           |
| `shape: queue` (the model fills it) and a `row` container    | See "the model", below                                                  |
| Scene playback, tours, and `story:`                          | Three things that play. Decide what Play means in the viewer            |

On the last: "story" already means something in the code and the product. `timeline/story.ts`,
`edit/story.ts`, `format/read-story.ts` and the export option `animation: "story"` all mean
_scenes played in order_ (and tours). A new `story/` folder and a new Story dock beside a Scenes
dock that also has a Play button need one of them renamed.

### Is "one vocabulary for change" regular?

Not yet. There are two kinds of key in a step and the plan doesn't separate them:

| Key                                 | In a step | In a scene      | Lasts                           |
| ----------------------------------- | --------- | --------------- | ------------------------------- |
| `set` (and `show`, `hide`)          | yes       | yes (it is one) | from here on                    |
| `values`                            | yes       | not offered     | from here on; a ramp needs time |
| `scene`                             | yes       | no              | "from here"; never off?         |
| `say`                               | yes       | no              | this step only                  |
| `focus`, `trace`                    | yes       | not offered     | this step only                  |
| `hold`, `rewind`, `when`, `choices` | yes       | no              | about the step itself           |

- A scene can't set a value, though a what-if is often a number ("Black Friday: `rps` 5"). A
  scene can't spotlight what it changed. Both make sense; neither is offered. And if a scene
  stays the bare map of today (i7), it has nowhere to put either: `show`, `values` and `focus`
  would read as element names.
- What a `set` may set is "anything that makes sense to change" (§4.1). That needs a list. From
  the ten: `state`, `flow`, `motion`, the capacity numbers, `label`, `tone`, `opacity`, `badge`,
  the place (`in`, `on`, `cell`), and for connections `to`/`from` (A3) and `label`. Not `shape`,
  `type`, `like`, `layout`, look keys, `card`, `link`. Open: `size` (22% of stories have something
  grow, shrink, thicken or thin, by a word match), `tone` and `opacity` on things that aren't shapes (components,
  containers and connections have neither today).
- `values` are named like diagram `data:`, but `%key%` is looked up on the element, then each
  container around it, then the diagram (`model/placeholders.ts:44-55`). Which of those does a
  step's `lease_left` set, and which does a formula read?

### The model's reach

§4.7 says the model "runs on whatever the story and scenes have made". It runs on components and
connections. It doesn't see small things: a chip travelling along an arrow isn't traffic, a `row`
of envelopes isn't a queue to it (`isQueue` is asked of a component, `capacity/plan.ts:79`), and
`count(queue)` and the model's backlog are different numbers about what the viewer will take to
be one queue. So there are two worlds, streams the model computes and tokens the story moves, and
a concept has to pick one per element. That's acceptable, and worth saying so authors know.

Where the model does reach, it's the best thing in the plan. Retry storm is `traffic: "= tries"`
on five arrows and the database's load comes out as tries to the power of layers, for any dial
setting. Canary and strangler fig are a `share`. None of that is scripted.

Two cautions. Its automatic rules can fight a story (A7: `down` blocks arrows that the story
needs to keep flowing). And its timing is fixed (`CAPACITY_TIMING`: react 0.5 s, boot 1 s,
cool-down 1.2 s) and it computes copies from demand directly, so the scaling plans that are
_about_ the loop (lag, cool-down, flapping, warm-up) can't use it and are scripted like any other.

---

## C. The semantics, pinned down

Each is a question that needs one answer before K1, because `diagramAt` is that answer written
as code. Where I'd lean is in brackets.

**The picture**

1. What is the picture a function of? §3.5 says files, place in the story, controls and time.
   With `choices` and `go:` the place is a _path_, not a number. With toggles, several scenes are
   on at once. The viewer's "what if" changes (SH-3, `viewer-store.ts:33`, in the card panel
   today) are a fourth input the plan doesn't mention. [The picture is: the diagram, then the
   steps on the path so far, then the scenes that controls have on, in the order the controls
   are written, then the viewer's what-ifs, then what the model derives (cascade, reroute, load,
   roll-up). Write that order down once.]
2. A story is at step 4 and a scene is toggled on. Is the scene laid over the picture at step 4
   (then a scene that hides what step 4 showed makes step 4 look broken, as in A3)? Does it change
   which steps ran (`when:`)? Does the change animate, and does the step replay? [Laid over.
   Steps whose `when` changed are re-derived from the start. The current beat replays from its
   beginning, because "toggles must re-run the same animation" (`aws.part1.review.md`).]
3. Two scenes on at once set the same element (A5). Which wins? [The control written later.]
4. A step's `scene: x`: does the toggle that owns `x` show as on? If the viewer turns it off,
   does the story's scene stay? How does a step turn a scene off? [A step's `scene:` only
   includes that scene's changes in the step, like writing them inline. It has nothing to do
   with controls and can't be turned off; it's undone by `rewind` like any change.]
5. Can a step set a control (`values: { rps: 5 }` where `rps` is a dial)? Then who owns the
   number after the viewer moves the dial, and after scrubbing back? [No. A step can't set a
   control. A value is either a control or a story value, not both.]

**Rewind, jumps and scrubbing**

6. `rewind: paid`: the picture after `paid`'s changes, or before them? Do values rewind? Do
   scenes that steps turned on? Do controls? [After. Yes. Yes. No.]
7. What does a rewind look like? If it's animated as a change like any other, tokens fly back
   down their arrows, which in A4 and visibility timeout looks like a real event (a message
   returning). [A rewind is its own transition: a quick cross-fade with a ⟲ mark, never travel.]
8. Scrubbing across a rewind: the scrubber is a line; is a rewound step simply the next stretch
   of it? [Yes. The line is the path, and a rewind is a cut on it.]
9. `go:` to an earlier step (A7's loop back to `open`): is the picture the diagram plus steps up
   to and including that step, or everything so far plus that step's changes? [The first. `go:`
   to a step always gives the picture that step gives when reached in order, so a named step
   means one picture.]
10. Where does a story end? After the last step of the main run, does Play fall into the first
    branch (A4)? What happens at the end of a branch? What does the scrubber show for branches
    not taken? [A step may have `end: true`, or branches live under the choice that leads to
    them. The scrubber shows the path taken, and choices appear as buttons at its end.]
11. Does Play stop at a step with `choices`? What does an export do there? [Stops. An export
    takes the main run and ends at the first choice.]
12. `when:` and step numbers: a step whose condition is false isn't applied; is it counted, shown
    in the scrubber, shown in the editor's dock? If the viewer is on step 6 and a control removes
    it, where are they? What if `go:` names a step that's currently off? [Not counted, not in the
    viewer's scrubber, shown in the dock with its condition. The viewer lands on the nearest
    earlier step. `go:` to a step that's off goes to the next one that's on.]
13. Do `say`, `focus` and `trace` carry over to a step that has none? [`say` does, within a beat
    (i2). `focus` and `trace` don't.]
14. Does the opening frame have a caption? Every plan has one ("Each key belongs to the next node
    clockwise"). [Start is step 0 and can have `say`.]

**Time**

15. How long is a step? §4.5 has `hold` ("how long it stays before playing on") and no length for
    the change itself. A scene change takes 0.6 s today (`SCENE_TRANSITION`). Does a ramp run
    across the change, the hold, or both? Can `hold` be a formula (A7's cool-down dial)? [A step
    is its change, 0.6 s, then its hold. A ramp runs across both. `hold` may be a value.]
16. When the viewer steps and doesn't play, does a ramp still run to its end? [Yes: stepping plays
    the step, then stops.]
17. Paused on a step for a minute, does the model keep running (patterns cycle, queues fill), as
    it does on a scene today? Then a chart "over the story's time" has two clocks. [The model
    runs live. Charts of model values show a rolling window; charts of story values show the
    path so far. Say they're two kinds.]
18. A ramp feeding the model (`traffic: "= rps"` while `rps` runs 1 to 5) changes the plan every
    frame. `CapacityTimeline.update` waits 0.5 s of sustained load before adding copies
    (`capacity/timeline.ts:15-36`), so a continuous ramp can keep resetting it. [Ramps into model
    inputs move in quarter-second steps.]
19. Looping: today every period divides 4 s so a GIF loops without a jump (`timeline/story.ts`,
    EX-7). With free `hold`s, does a story export loop? [The whole story is padded to a multiple
    of 4 s.]

**Hidden things, riders and places**

20. Is a hidden element absent, or invisible? For the model: does a hidden canary still take its
    10% share? For `count()`? For a container's size? [Absent from all three.]
21. A container is hidden: are its children? A host is hidden: are its riders? A connection whose
    end is hidden? [Yes to all, the way `down` cascades in `resolve.ts:158-183`.]
22. An element is `on:` something that a later step hides, or moves, or that the author deletes.
    [Hidden with it; moves with it; deleting the host is refused while it has riders, or drops
    them to the canvas with a diagnostic.]
23. Where do riders sit? Around the host, but on which side, in what order when there are four
    (A10), and can the author say? Do they count as obstacles for routing? On a connection, where
    along it? In a `sequence`, on the lifeline or at the header (A8)? On a scale set, which copy?
24. Setting `in:` to a container with no `layout`: where does the thing land? [Only containers
    with a layout accept arrivals; otherwise a diagnostic.]
25. Travel: "along the connection between the two places when there is one". Either direction
    (A4's compensation runs against the arrow)? Which one when there are two? When the place is a
    container and the connection is to something inside it? Over several hops (A8, A10)? How
    long, and does length matter? Two things going to one place in one step: together or
    staggered? Does a thing in flight draw above the containers it crosses (each container is its
    own stacking context, `layout/paint.ts:11-21`)?
26. `like:`: what's copied (shape, look, label, size, place, data)? Not connections or riders,
    presumably. A live link or a copy made once? "Grows out of the original": from where the
    original is now, or where it started (A10)? What if the original is hidden at that moment,
    or the copy isn't hidden at the start?

**Layouts**

27. Order of children in `row`, `column` and `grid`. [File order, always.] Then: a message that
    leaves a queue and comes back (visibility timeout) returns to its old slot, which is right
    for that story and wrong for "requeued at the back". Is there a way to say the other?
28. When a child hides or leaves, do the others shift? [In `row` and `column`, yes, they close
    up. In `grid` with written cells, no.] Does the container then shrink, and does everything
    around it move (A9)? [No: a container keeps room for the most it ever holds in the story, as
    a scale set keeps room for its most copies (D-82). This is the most important layout rule
    and the plan doesn't have it.]
29. `grid`: how many columns when none are written? Is `cell` `[column, row]` (§6's rebase
    implies it)? From 0? Can a child span cells? Row and column headings? Can a step set `cell`?
    Do connections between cells route round the other cells or run straight?
30. `row` and `column`: gap, alignment, wrapping, and what happens at 50 children.
31. `sequence`: "in the order they're shown" makes the ladder depend on the path (A8). Two
    messages shown in one step; one shown, hidden and shown again; ones visible from the start;
    a party that appears mid-story. [Message order is file order. Every message and party keeps
    its row and column whether shown or not. Then the YAML reads down the page like the ladder.]
    Also: return arrows, a note on one lifeline, a message to self.

**Values, formulas and controls**

32. What does `count(x)` count? Direct children or everything inside; riders too; hidden ones;
    connections and decorations? [Shown small things directly in or on it.] Is there a count of a
    kind ("rows that are amber")? Ledgers of duplicates are the commonest proof object.
33. What's in the formula language? Arithmetic and `round` at least; A2 needed `log2` and `ceil`,
    A6 a power, thresholds need comparisons. Units: is `5x` a number in a formula? What does a
    formula that fails show?
34. Can a formula that feeds the model read the model? `traffic: "= 2 * load(web)"` is a loop.
    [Model functions may be read only by values that are shown, never by model inputs.]
35. `load(web)` and `copies(web)`: the plan's settled number, or the timeline's as copies boot?
    If the timeline's, a label holding it changes every frame, and labels are measured and
    wrapped when the scene is built (`scene.ts:521-525`), with connection labels placed round
    them. [Live values only in meters, which have a fixed box. Labels take settled values.]
36. A value running `[30, 0]` shown in a label: same problem. Number format (10:00, 99.9%, $50)?
37. A `choice` in a formula: its position, or nothing (A5)? A toggle that starts on (A8)? A
    dial's starting value and step? Does a control's setting survive stepping, rewinding and
    reopening the link? Is it in the link (`deep-link.ts` has `scene` and a tour's `step` only)?
38. `when:` syntax: `not`, comparisons, two controls?

**Showing, exporting, applying**

39. Captions. Markdown (§6 uses backticks)? How long? Where on a phone, in a gallery preview, in
    a thumbnail? Read by a screen reader as they change?
40. Exported captions. The caption bar is page chrome; exports render the diagram's SVG
    (`export/export.ts`). [Captions are drawn into the frame, in a band below, with the embedded
    fonts.] What does an export do with controls [their starting values], `when`, and choices?
41. With reduced motion the clock starts paused. [A story still steps, without tweens.]
42. Nested diagrams. Scenes reach inside by path and tours dive in. Can a step set
    `aks.ingress`? Does `focus: aks.ingress` dive? Does a nested diagram's own `story:` play
    when it's opened from its parent? [Yes; yes; no, like its scenes.]
43. Tours "keep reading and playing". A tour is a graph keyed by element with cards
    (`tours/graph.ts`); a story is a list with captions. Two players in the viewer, or tours
    converted on read?
44. One diagram, one `story:`. Tours are named and there can be several. "Insert the example"
    brings a concept into a diagram that may already have a story. [`stories:`, named, like
    tours. It also gives the "chapters" and "extra beats behind a click" that `aws.part1` and
    `containers.part1` asked for.]
45. What does "Apply" do with a story? Applying maps roles to the person's elements and brings
    scenes, a line about a role becoming a line about the element picked (D-83). A story's steps
    are mostly about things that aren't roles (tokens, ledgers, meters), and its captions are
    prose about the concept's own cast. "Brings the story along where its steps are about the
    roles" leaves steps with captions that describe things not on screen. [Apply brings
    behaviour and scenes, as today, and never the story. Inserting the example brings it.]

---

## D. The editor workflow (§7)

### It isn't the workflow people already know

§3.6 and §7 say the rule stays the same: "pick a scene, change something, and the change belongs
to that scene". In the code that is true of four things. `setSceneEntry`
(`packages/core/src/edit/story.ts:165`) writes a state, a flow, a motion or capacity numbers, and
it's reached only from dedicated controls in the inspector ("State · Outage"). Everything else
(adding, deleting, dragging, relabelling, restyling) changes the diagram itself whichever scene
is selected: the canvas gestures don't look at the scene at all
(`editor/canvas/use-canvas-gestures.ts`). So "every edit belongs to the selected step" is a new
rule, it touches every command in `packages/core/src/edit/` and the assistant's tools, and
people's habit from scenes points the other way: they're used to rearranging and restyling freely
with a scene selected.

### Is "select a step, change something, it happens at that step" sound?

| Edit                            | Sound? | The trouble                                                                      |
| ------------------------------- | ------ | -------------------------------------------------------------------------------- |
| Change a state, flow, badge     | Yes    | This is today's rule                                                             |
| Add something                   | Mostly | It then exists in the file, hidden, and can't be seen or picked on earlier steps |
| Delete something                | No     | "Disappears here" and "remove it" are different wishes with one key              |
| Drag a small thing onto another | Yes    | A place change is what a step is for                                             |
| Drag anything else              | No     | Tidying the layout on step 3 mustn't become a move at step 3                     |
| Change a label                  | No     | Fixing a typo and "it says something else now" look identical                    |
| Change a colour                 | No     | `tone` could be a step's; fill, stroke and font can't (they're not in `set`)     |
| Change a base property          | No     | There's no way to do it without going back to Start                              |

Where people will be confused or lose work:

- **Edits that seem to vanish.** Someone restyles ten things with step 6 selected, clicks Start,
  and they're gone. Nothing was lost, but nothing shows where it went.
- **Typos that come back.** A label fixed at step 5 is still wrong at steps 3 and 4.
- **Ghosts.** Deleting at a step hides. After an afternoon the file holds thirty hidden elements
  nobody can see from Start.
- **The element added at step 3 and edited at step 5.** Under the plan's rule the edit is a
  change at step 5. If it was a correction, the element is now wrong for two steps and right
  after. Neither tile shows why.
- **Reordering and deleting steps.** Changes accumulate, so moving step 5 before step 3 can move
  a thing before it's shown, and deleting a step makes later ones jump.
- **Rewound steps and branches.** "Changes you make happen at step 5" when step 5 starts from
  step 2 needs saying on the canvas.

### The simplest rules I can find

1. **Two kinds of property, shown as two places in the inspector.** What a thing _is_ (its shape
   and look, size, free position, connection ends, card, link, data, how it scales) always
   belongs to the diagram, whatever tile is selected. What's _happening to it_ (shown or hidden,
   its place, state, flow, label, badge, tone, opacity, traffic numbers) belongs to the selected
   step. The inspector has one section, **At this step**, holding exactly those; everything
   outside it edits the diagram. This is today's "State · Outage" section grown, not a new idea.
   Each field in it has one action: "Make this the starting value".
2. **A thing lives from the step it was added at.** Adding at step 3 writes it hidden with a
   `show` in step 3. At that step, changing its label, tone or badge changes the element itself
   (there is no "before"). At a later step the same change is that step's.
3. **So: added at 3, edited at 5.** The edit happens at 5. To correct instead, go to step 3 or
   use "Make this the starting value". The tile for step 5 lists the change (rule 6), so it's
   never silent.
4. **Before it appears, a thing is a faint outline** on Start and earlier steps: selectable, so
   it can be placed and styled, with a toggle to hide outlines.
5. **Delete asks once what you mean, then remembers.** On a step: "Hide from here on" (the
   default) or "Delete everywhere". If the thing was added at this very step, it's deleted from
   the file. On Start, delete removes it from the file and from every step and scene, the way
   scene lines are cleaned up today (`edit/elements.ts:784`).
6. **Every tile lists its changes** ("shows A′ · moves `feature` · fades A"), each with a ×. This
   is how people find the ten restyles they made on step 6, and it's the undo for an edit made on
   the wrong tile. I think this list matters more than anything else in §7.
7. **Dragging.** Onto an element: it rides there from this step. Into a container that has a
   layout: it moves there from this step. Anywhere else: its position changes in the diagram, for
   every step. There's never an x and y that belong to a step.
8. **A change that makes a thing the same as it was before the step removes the step's line**,
   as `setSceneEntry` does now.
9. **Undo selects the tile the change was made on.**
10. **The same rules for scenes**, with "scene" for "step".

Also for §7: the dock needs to show beats and the steps inside them (rule i2), a condition chip
on `when` steps, and branches as indented runs; a step's values (name, from, to) need a place in
its inspector section; and the Start tile should say "Opening" and take a caption.

---

## E. Feasibility against the code

### Harder than the plan admits

1. **"From/to geometry and presence" isn't an extension of what's there.** The scene model has a
   `Pair` for exactly two things, state and flow (`canvas/scene.ts:72-75`, `84`, `239`).
   Everything else is single: one `box` per element, one routed `path` per connection, one paint
   order, one set of label places and obstacles, all from one layout and one set of routes
   (`use-editor-scene.ts`). `frames.ts` tweens colours and opacities between two states of the
   _same_ geometry. A step that moves things needs two layouts, two sets of routes, two paint
   orders and elements present in only one, in every node (`component-node`, `shape-node`,
   `connection-node`, `container-node`, `fleet-node`, `machine-node`, the decorations).
2. **Routes can't be tweened.** If a container resizes, its neighbours shift and unrelated
   connections re-route. The router is an obstacle-avoiding search (`routing/orthogonal.ts`,
   `heap.ts`); two routes with different bends have no in-between. They'd snap or cross-fade.
3. **"Steps are few (5–8) and results are cached" (§10).** The ten averaged nine steps, and the
   number of pictures is steps × `when` variants × scenes on × branches. Thumbnails in the dock
   today share one layout and one set of routes (`scene-strip.tsx:53-76`); per-step geometry
   means a layout and a routing per tile.
4. **Scrubbing against the capacity timeline.** The timeline isn't a function of the moment. It
   "heads for each new plan from the moment it arrives" and only moves forward
   (`capacity/timeline.ts:163-176`, `185`). The export handles this by walking it frame by frame
   from the start (`export/export.ts:434-458`). Scrubbing backwards, rewinding and jumping all
   need it rebuilt from Start along the path with each step's nominal times. That's doable (it's
   a handful of `apply` calls), but principle 5 as written ("anything can be scrubbed", "always
   agree") is only true if a story has canonical times and a live viewer who lingers is allowed
   to differ from the export until things settle.
5. **Several scenes at once.** There is one `scene: string | null` everywhere: both stores
   (`viewer-store.ts:18`), `resolveFor`, the controller, the export's scene list, thumbnails,
   deep links, tours. Toggles make it a set, and "the scene before" (for the transition) becomes
   "the picture before".
6. **Every edit command becomes step-aware** (D). 18 files in `packages/core/src/edit/`, and
   `apps/web/src/lib/ai/tools.ts`.
7. **Formulas and the model.** The model reads plain numbers off the parsed diagram
   (`Connection.traffic: number | null`, `FlowBehaviour.capacity`). Formulas that read the model
   and feed it can loop (C34). Values that change every frame can't live in labels (C35).
8. **Contents inside shapes** (B5) changes the tree: today only containers have children
   (`layout/compute.ts:121-126`), and `on:` adds a second tree (host to rider) that layout,
   paint order, hit-testing, selection, drag, find and the minimap all have to learn.
9. **`sequence`** bypasses the router, draws lifelines (a new drawn thing), and places connection
   labels its own way. It touches `routing/`, `scene.ts` and `paint.ts`, not just `layout/`.
10. **Captions in exports** have to be drawn into the SVG (C40). A story of nine steps at 4 s is
    36 s of GIF at the animated width cap.
11. **The dial is D-84 reversed.** D-84 removed the traffic slider because "how much traffic"
    lived in five places; `ResolveInput.traffic` is what's left of it (`resolve.ts:90`). A dial
    that drives `traffic` through a formula brings it back, authored per concept this time.
    That's fine, and the decision should be recorded as one.

### Build it differently

- **Keep the geometry still.** Lay out once, from the diagram with everything shown, and have
  each layout container keep room for the most it ever holds (C28). A step then changes only
  presence, looks, and the places of small things. Routes are computed once; a hidden connection
  fades and its route stays. Nothing unrelated ever moves. This is D-82's "room is reserved, so
  the layout never jumps", applied to stories, and it replaces "from/to geometry built from the
  diagram before and after a step" (§9) with one geometry plus places for small things. It
  removes items 1 to 3 above almost entirely.
- **`diagramAt` returns a plain `Diagram`**: formulas already worked out to numbers, hidden
  things removed, scene and step changes folded in. Then `resolveState`, `planCapacity` and the
  renderer stay as they are, which is what §4.7 wants. Geometry comes from the everything-shown
  diagram; state and presence from `diagramAt`.
- **One type for "where we are"** (path, controls, what-ifs) that replaces `scene: string | null`
  in the stores, `resolveFor`, the export and deep links, in K1, before anything else is built
  on the old one.
- **A layer above the containers** for things in flight, so a token crossing from one container
  to another isn't clipped by either.
- **Canonical story time** for exports, thumbnails and scrubbing; the live viewer runs the model
  on the real clock and agrees once settled.

### Milestone order

The order is right by dependency and wrong by risk. Three changes:

1. **Write the ten plans above (or better ones) as fixtures first**, in the format, failing. They
   are the acceptance test for each milestone, and they'd have caught everything in A before any
   code. K6 as drafted is the first time the format meets a real concept.
2. **A minimal Story dock ships with stories, not three milestones later.** K2 to K4 add format
   that the editor can't show; and "select a step, see the diagram at that step" is the tool an
   author debugs with. Tiles, a caption field, play, and the change list (D rule 6). The rest of
   K5 can wait.
3. **`on:` belongs with small shapes and layouts** (it's layout work), and `like:`'s "grows out
   of" belongs with animated steps. K1 as drafted is not small: "scenes can show, hide and move
   things" already needs all the canvas work.

A first release I'd cut to:

| In                                                                                   | Out, for later                                  |
| ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `hidden`, `show`, `hide`; the wider `set` (state, flow, label, tone, badge, opacity) | `sequence`, `axis`                              |
| `story:` with `say`, beats, `focus`, `hold`, `rewind`, `pace`                        | `choices` and branches; `when`                  |
| `row`, `column`, `grid`; riders; travel; `like`                                      | `chart`, `code`, the dots crowd                 |
| `meter`; formulas for what's shown; `dial` and `toggle`                              | Formulas into the model; `choice`               |
| Viewer: caption bar, step, play, scrub. Export: one image per step                   | Animated export with captions                   |
| The dock, "At this step", the change list                                            | Story on Apply; tours as stories; the assistant |

That set tells the main run of A4, A9 and A10, and A1 and A7 with their copies written out and
no branches.

---

## F. The §8 compromises

### Are they the right non-goals?

- **No general simulator: right, and understated.** "About a fifth of plans lose some
  interactivity" is low (below). More important, what's lost isn't only interaction. The
  reviewers' first pattern (§1 item 1, "stories are functions of settings") is met where the
  capacity model reaches and nowhere else. Everywhere else a story is states set by hand per
  step, and a control picks between hand-set states. §8 should say that plainly, and B3
  (conditions on values) is the cheap part of the gap that can be closed.
- **No widgets for one area: right.** `sequence` is the exception that's worth it. Hold the line
  on the commit graph; A1 was fine as a grid.
- **No keyframes: right, but be honest about what a step is.** `set` per step _is_ keyframing of
  states; what's refused is curves and hand-drawn paths. One enum is worth adding back: `pace`.
- **No two diagrams in step: fine as worded**, if a container can be a copy (B2).
- **No dragging in the viewer: right.** But the viewer already has something the plan leaves
  out: "What if it were…" on a card sets an element's state, and the model answers (cascade,
  `backup_for` reroute, load). That is failure injection, the reviewers' sixth pattern, already
  built and general. Keep it, layer it on top of stories (C1), and let a concept say which
  elements invite it.
- **Maps, 3D, sound: right.**
- **Missing from the list:** many of one thing (B8); things that change size; text the viewer
  types (JWT claims, an injected string, a label selector: 8% of plans ask to edit or type);
  machines that run by themselves (a breaker, an autoscaler's loop, TCP's window).

### What share of plans keep their moment

From 40 plans: the ten above and thirty skimmed (`visibility-timeout`, `lost-update`,
`two-phase-commit`, `token-bucket`, `retry-storm`, `canary`, `latency-percentiles`,
`iaas-paas-saas`, `commitment-discounts`, `git-three-areas`, `git-reflog`,
`container-image-layers`, `k8s-scheduler`, `k8s-service`, `dns-resolution`,
`tcp-congestion-control`, `json-web-token`, `sql-injection`, `cidr-and-subnetting`,
`autoscaling-cooldown`, `shuffle-sharding`, `error-budget-burn-rate`, `cqrs`, `event-sourcing`,
`strangler-fig`, `context-window`, `rag-pipeline`, `distributed-tracing`, `mvcc`, `watermarks`).
Each judged against the tools as drafted, with beats allowed (i2).

| Outcome                                              | Of 40 | Share     |
| ---------------------------------------------------- | ----- | --------- |
| Moment and interaction both kept                     | 15    | about 40% |
| Moment kept; the interaction lost or cut to a button | 17    | about 40% |
| Needs rethinking: the picture itself can't be made   | 8     | about 20% |

So about four in five keep the beat that makes it click, which is the number that matters most
and it's a good one. Two in five lose their interaction, twice what §8 says. Forty is 3% of the
plans, so read these as within fifteen points either way.

A cruder check over all 1,302 unmerged plans, by matching words in each plan's fields (my
script, not in the repo): not one plan has "Interaction: None". A third (33%) ask for something
free-form: dragging (12%), injecting a failure (12%), editing or typing (8%), adding or removing
things (7%). Half ask only for dials, toggles, choices or stepping. And only 3.5% of plans name a
control in **The moment** itself, which is why the moment survives even where the interaction
doesn't.

The eight that need rethinking: `git-bisect`, `isolation-levels`, `consistent-hashing`,
`latency-percentiles`, `commitment-discounts`, `shuffle-sharding`, `distributed-tracing`,
`watermarks`. With an `axis` and conditions on values (B3, B4) I'd expect five of those to come
back (`git-bisect`, `latency-percentiles` in part, `commitment-discounts`,
`distributed-tracing`, `watermarks`).

### The kinds of plan that suffer most

1. **Populations where each member matters**: a hash ring's keys, a dot plot of a thousand
   requests, forty customers on shuffled shards, a sticky crowd. They shrink to a dozen
   hand-placed things or to a count.
2. **Pictures placed by value**: timelines with spans and a moving "now", windows and watermarks,
   Gantt and trace waterfalls, demand curves with bands, key ranges. Cost (fundamentals),
   observability, streaming and disaster recovery lean on these.
3. **Machines that run by themselves**: autoscaling lag, cool-down and flapping, a breaker's
   cycle, congestion control, backpressure, leader election. The capacity model doesn't model
   feedback or latency, so these are scripted paths with a button or two.
4. **"Crash it anywhere"**: eight plans in `messaging.part2` alone, and most of data's
   replication and transaction plans. They become two or three scripted crash points, and the
   reviewers found that's exactly where the technical errors hide.
5. **A stage that replays cases**: isolation levels, failure modes, "which service" ladders.
   There's no way to reset part of a diagram.
6. **Thresholds crossed by a dial**: lease against work time, burn rate against a paging rule,
   lateness against a watermark. Until `when:` takes a formula.
7. **Text the viewer changes**: a claim, a query string, a label, a rule.

Least hurt: anything that's a row of gates with a card passing through (IAM, admission,
pipelines); ladders; tables that gain rows; stacks that change colour; and every concept the
capacity model can tell (scaling out, failover, canary, load levelling, retry amplification).

---

## G. Verdict

Ten changes before building, most important first.

1. **Write down what the picture is.** One page: the order things are laid over each other (the
   diagram, the steps on the path, the scenes controls have on, the viewer's what-ifs, what the
   model derives), and what position, `rewind`, `go`, `when`, scrubbing and a step's length
   mean. C lists 45 open questions; `diagramAt` is their answers. Built first without them, it
   gets rewritten at K2 and again at K4.
2. **Separate beats from steps.** A step with no `say` continues the beat before it; the viewer
   moves by beat. Ten plans with 51 beats needed 92 steps, and merging them teaches the wrong
   thing (a rolling update that happens all at once).
3. **Keep the geometry still.** Lay out once with everything shown and room reserved; only small
   things change place. Drop "from/to geometry built from the diagram before and after a step".
   The scene model has one geometry, routes can't be tweened, and D-82 already made this choice
   for scale sets.
4. **Let a container be a copy.** `like:` on a container copies what's in it, addressed by path.
   Half of all plans are side by side; today that's the cast typed twice with nothing keeping
   the two the same, which is the kind of drift the reviews kept finding.
5. **Let numbers decide, not only show.** `when:` takes any formula; meters have limits; a ramp's
   ends and a step's hold can be values; changing a control replays the current beat. Without
   this a dial changes two labels, and "stories are functions of settings" isn't met outside the
   capacity model.
6. **Give the editor one honest rule.** An "At this step" section for what's happening to a
   thing; everything else edits the diagram; three canvas rules for add, delete and drag; a list
   of changes on every tile. And stop describing it as the scene workflow people know: that
   covers four properties today.
7. **Trade tools, don't add them.** Add an `axis` layout (place by value), `on:` a connection,
   and shapes that can hold contents. Pay for them: `stack` becomes an option of `column`;
   `chip`, `dot` and `envelope` become library presets; `tag` becomes today's label pill with
   `on:`. Still six tools, five layouts and fewer shape kinds than the draft.
8. **One way to say each thing, and no name used twice.** Steps have names. `in` and `on` are one
   place. `show`/`hide` only. A step's `choices` and the `choice` control get different names. A
   step's `scene:` only includes. "Story" stops meaning both this and scene playback. `stories:`
   is a named map, so inserting a concept can't collide with a story that's already there.
9. **Say where the model stops, and keep the what-if.** Tokens aren't traffic; a row of envelopes
   isn't a queue to the model; `down` blocks arrows whether the story wants it or not. And the
   viewer's "What if it were…" is failure injection that already works: put it in the plan.
10. **Re-cut the milestones around real concepts.** The ten plans as failing fixtures before K1;
    a minimal dock with the first stories; `sequence`, `chart`, `code`, branches, formulas into
    the model and story-on-Apply out of the first release.

**The single biggest risk.** Outside what the capacity model computes, a story in this format is
states set by hand, step by step: keyframes without the curves. Nothing in the format stops a
concept's meters disagreeing with its picture or its controls (A6 does it in five beats), and
that was the commonest error the reviewers found in plans that were only prose. At roughly 60 to
90 lines and nine steps per concept, 1,293 concepts is on the order of a hundred thousand
hand-set lines, each of which can be quietly wrong. Changes 4 and 5 shrink that risk, and the
catalog test can check some of it (every value shown is a formula or a ramp between values;
every copy matches its original), but the plan should treat "how do we know a concept is still
true when a dial moves" as a design question now, not as authoring care later. The last reviewer
summary to arrive says the same from the other side: "several plans were wrong on one detail
that a faithful simulation would have exposed … a small state model per concept beats
hand-scripted beats" (`gcp.part3.review.md`).

### Small things

- The plan says 1,293 concepts and 1,326 plans; the research README says 1,309 concepts.
  `tools/techniques.py` counts 1,326 plans, of which 24 are marked merged.
- `mogram-today.md` says nothing dims for a tour. The viewer does dim: `focusOpacity`
  (`canvas/svg/render-context.ts:65`) fades everything outside the focus set to 22%. Spotlight
  is further along than the baseline says.
- §1's "replay / rewind 4%" undercounts, as the plan notes: 23% of stories use the words, and
  31% put something beside, inset or as a ghost.
- §4.5's example uses `go: renewed` and `rewind: start`, and no step in it has a name. They're
  the only examples of those keys.
