# The Mogram file format (version 1)

A Mogram diagram is plain YAML that reads like a description of the architecture. The canvas
writes it; people can read, review and edit it by hand. This page is the contract the parser and
writer implement (`packages/core/src/format`).

## Files

| File                      | Purpose                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------ |
| `mogram.yaml`             | Default diagram file. In a folder, marks the folder as a diagram and holds settings. |
| `<prefix>.mogram.yaml`    | Additional diagram files (`checkout.mogram.yaml`). Same contents as `.mogram`.       |
| `<prefix>.mogram`         | Identical contents, alternative extension. Mogram saves `.mogram.yaml` by default.   |
| `layout.mogram.yaml`      | Coordinates only (folder mode).                                                      |
| `docs/*.md`               | Card markdown.                                                                       |
| `icons/*.svg`             | Uploaded icons.                                                                      |
| `<subfolder>/mogram.yaml` | A nested diagram.                                                                    |

**Single-file mode** — a folder with one Mogram file. Layout sits at the bottom of that file.
**Folder mode** — a folder with `mogram.yaml` plus other Mogram files (or a `layout.mogram.yaml`).
Every Mogram file in the folder adds to the same diagram, the way Terraform treats `.tf` files.
Subfolders are never merged; they are nested diagrams.

## Names

Elements are named by people: `web_vm`, `db_primary`. A name starts with a letter and contains
letters, digits, `_` or `-` (max 64). Components, containers, groups, connections and decorations
share one namespace across all files of a diagram; a duplicate is an error that names both files.
Scenes and tours have their own namespaces. Display labels default to the humanised name
(`web_vm` → "Web VM"); set `label:` only when you want something else.

## Settings (`mogram.yaml` or the single file)

```yaml
mogram: 1 # format version
name: Checkout # diagram title (default: folder/file name)
description: Payments and order flow
concept: { summary: …, topic: …, roles: … } # makes the diagram a concept (see Concepts)
theme: midnight # canvas theme preset (default midnight)
background: "#101418" # optional: a colour, or a gradient (below)
grid: "#ffffff26" # optional grid colour; the default follows the background (the grid's
# style, dots or lines, and whether it's shown are each person's own setting, not the file's)
libraries: [aws, generic, tools] # libraries offered in the editor (default: all)
ports: # only in nested diagrams: port name → inner element
  web: ingress
data: { env: prod, owner: platform team } # values any label can show (see Links and data)
```

Colours are hex: `#5c9776`, or with opacity as two more digits, `#5c977680` (50%). A background
may also be a CSS-style gradient of 2 to 6 colours, each with an optional position:

```yaml
background: "linear-gradient(135deg, #431043, #d34681)"
background: "radial-gradient(at 50% 0%, #1e3a8a, #020617)"
background: "radial-gradient(ellipse 120% 80% at 50% 0%, #161616 0%, #0a0a0a 70%)"
```

Put gradients in quotes: in YAML, ` #` starts a comment, so an unquoted gradient loses its
colours (Mogram says so if it happens). Text, lines and the grid follow the background's
lightness, so a light gradient on a dark theme still reads well.

The 30 themes, by family (each sets the background and the tiles, lines, labels and grid that go
with it):

| Family          | Themes                                                              |
| --------------- | ------------------------------------------------------------------- |
| Dark            | `midnight` (default), `graphite`, `spotlight`, `slate`              |
| Deep colours    | `ocean`, `forest`, `teal`, `dusk`, `plum`, `wine`, `ember`, `olive` |
| Vivid gradients | `aurora`, `twilight`, `sunset`, `lagoon`, `nebula`                  |
| Drafting        | `blueprint`, `chalkboard`                                           |
| Light           | `paper`, `snow`, `mist`, `sand`                                     |
| Pastel          | `sky`, `mint`, `blush`, `lilac`, `butter`, `dawn`, `seafoam`        |

## Architecture

```yaml
containers:
  east_us:
    type: region # container kind (below); default box
    label: East US
  vnet:
    type: network
    in: east_us # parent container
  web_subnet:
    type: subnet
    in: vnet
    rollup: worst # worst (default) | best | none

components:
  web_vm:
    type: azure/virtual-machine # icon: azure/…, aws/…, gcp/…, k8s/…, generic/…, tool/…, or icons/my.svg
    in: web_subnet
    card: docs/web-vm.md # or inline markdown text, or {title, body} / {title, file}
    motion: pulse # pulse | bounce | rotate | shake | glow
  aks:
    type: azure/kubernetes-services
    opens: ./aks # nested diagram folder

groups:
  web_scale_set:
    label: Scale set
    members: [web_vm_1, web_vm_2]

connections:
  gateway_to_aks:
    from: app_gateway
    to: aks.web # port "web" on the nested diagram that aks opens
    flow: traffic # traffic | slow | blocked | rerouted | idle (default idle)
    label: HTTPS
  app_to_replica:
    from: app
    to: db_replica
    backup_for: app_to_primary # turns "rerouted" when app_to_primary is blocked
```

### Container kinds

Containers are cloud-neutral kinds that each cloud names its own way. The editor names them for
the diagram's cloud — the first one `libraries:` names, else the one most of its icons come from
— and a container added from the library takes that cloud's official group icon (`icon:`).

| Kind                | Azure             | AWS                   | Google Cloud           | Meaning                                  |
| ------------------- | ----------------- | --------------------- | ---------------------- | ---------------------------------------- |
| `cloud`             | Azure             | AWS Cloud             | Google Cloud           | The provider's boundary                  |
| `account`           | Subscription      | AWS account           | Project                | Billing and ownership                    |
| `resource-group`    | Resource group    | —                     | —                      | A management folder, not a network       |
| `region`            | Region            | Region                | Region                 | A cloud region                           |
| `availability-zone` | Availability zone | Availability Zone     | Zone                   | A separate zone within a region          |
| `network`           | Virtual network   | VPC                   | VPC network            | A private network                        |
| `subnet`            | Subnet            | —                     | Subnet                 | Addresses inside a network               |
| `public-subnet`     | —                 | Public subnet         | —                      | A subnet with a route to the internet    |
| `private-subnet`    | —                 | Private subnet        | —                      | A subnet with no route from the internet |
| `security-group`    | —                 | Security group        | —                      | A firewall around the servers inside it  |
| `scaling-group`     | VM scale set      | Auto Scaling group    | Managed instance group | Servers that grow and shrink with load   |
| `on-premises`       | On-premises       | Corporate data center | On-premises            | Your own data centre                     |
| `cluster`           | AKS cluster       | EKS cluster           | GKE cluster            | A Kubernetes cluster                     |
| `namespace`         | Namespace         | Namespace             | Namespace              | A namespace inside a cluster             |
| `box`               | Box               | Box                   | Box                    | A plain boundary (the default)           |

"—" marks a kind that cloud doesn't use, which the library doesn't offer for it (it still
reads). The library lists each cloud's kinds in its usual nesting: AWS subnets live inside one
zone (Region › VPC › Availability Zone › subnet); Azure and Google Cloud subnets span their
region, and a Google Cloud VPC network is global, so it holds regions. `vnet` and `vpc`, from
before there was one network kind, still read as `network`.

Optional element keys (written only when they differ from the default):

| Key         | Applies to                          | Values (default first)                               |
| ----------- | ----------------------------------- | ---------------------------------------------------- |
| `state`     | components, containers              | healthy, active, scaling, degraded, overloaded, down |
| `motion`    | components                          | none, pulse, bounce, rotate, shake, glow             |
| `intensity` | components                          | normal, low, high                                    |
| `speed`     | components, connections             | normal, slow, fast                                   |
| `color`     | components, containers, connections | any `#rrggbb` (advanced)                             |
| `direction` | connections                         | forward, reverse, both                               |
| `density`   | connections                         | normal, low, high                                    |
| `route`     | connections                         | orthogonal, curved, straight                         |
| `icon`      | containers                          | an icon reference shown in the header                |

### Shapes

A shape is a component drawn as a geometric outline instead of an icon: it connects, nests,
carries state, motion and a card, and appears in scenes and tours like any component. Shapes are
written under their own `shapes:` section; `name: cylinder` is short for `{ shape: cylinder }`.

```yaml
shapes:
  checkout_api: { shape: rounded, label: Checkout API, in: web_subnet }
  orders_db: { shape: cylinder, label: Orders, tone: blue, shadow: true }
  fraud_check: { shape: diamond, label: Fraud check?, tone: amber, bold: true }
  legacy_crm:
    shape: rectangle
    fill: "#f5f5f5" # a colour or a gradient
    stroke: "#666666" # or none
    stroke_width: 2
    dash: dashed
    corner: 8
    opacity: 80
    text_color: "#1f2937"
```

| Key                                            | Values (default first)                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `shape`                                        | `rectangle`, `rounded`, `ellipse`, `circle`, `diamond`, `cylinder`, `queue`, `cloud`, `hexagon`, `document`, `person` |
| `tone`                                         | `neutral`, `blue`, `green`, `amber`, `orange`, `rose`, `violet`: fill, outline and words together                     |
| `fill`                                         | from the tone, or a colour or gradient                                                                                |
| `stroke`                                       | from the tone, a colour, or `none`                                                                                    |
| `stroke_width`                                 | 1.5, or 0–8                                                                                                           |
| `dash`                                         | `solid`, `dashed`, `long-dash`, `dotted`, `dash-dot`                                                                  |
| `corner`                                       | the shape's own (0, or 12 for `rounded`), or a radius in px                                                           |
| `lid`                                          | `cylinder`, `queue`: the shape's own (12 px, less when small), or a depth in px                                       |
| `slant`                                        | `hexagon`: the shape's own (20 px, less when narrow), or how far the sides slant in, in px                            |
| `wave`                                         | `document`: the shape's own (12 px, less when short), or the wavy edge's depth in px                                  |
| `shadow`                                       | `false`, `true`                                                                                                       |
| `opacity`                                      | 100, or 0–100                                                                                                         |
| `font`, `font_size`, `bold`, `italic`, `align` | as for text; labels are centred                                                                                       |
| `text_color`                                   | from the tone, or a colour                                                                                            |

Selecting a shape with one of these measures shows an amber diamond handle that drags it, as
draw.io's yellow handles do; the inspector's Style tab has the same number. Values beyond what
the shape can draw are held to the most it can (half the box for corners and slants).

Shapes also take every component key (`label`, `in`, `state`, `motion`, `intensity`, `speed`,
`color` for the state colour, `card`, `opens`). Their size lives in the layout like a container's
(`orders_db: { at: [30, 6], size: [10, 12] }`); without one they take their kind's default.

### Links and data

Any element — component, shape, container, group, connection, text or note — can link somewhere
and carry its own named values:

```yaml
components:
  payments_api:
    type: azure/app-service
    link: https://runbooks.example.com/payments # opens in a new tab
    data: { owner: payments, cost_centre: 4410, sla: 99.95, pci: true }
  ledger_db:
    type: azure/sql-database
    link: "#payments_api" # another element; or scene:region_outage, tour:checkout
```

A viewer's click follows the link (after the element's card or nested diagram, which come
first); the card shows the data and the link. Only `https://`, `http://` and `mailto:` web links
are accepted. A link to an element, scene or tour that doesn't exist is a warning, and renaming
an element keeps `#links` to it pointing at it. Data values are text, numbers or true/false.

A label, text, note or connection label can show a value with a `%key%` placeholder:

```yaml
data: { env: prod } # the diagram's own values, for every label
containers:
  vnet: { type: vnet, data: { region: eastus } }
components:
  payments_api:
    type: azure/app-service
    label: "%owner% API (%env%, %region%)" # shows "payments API (prod, eastus)"
    in: vnet
    data: { owner: payments }
```

The key is looked up in the element's own `data:`, then in each container around it, then in
the diagram's `data:`, then among the built-ins: `%name%` (the element's YAML name), `%type%`,
`%diagram%` (the diagram's name) and `%date%` (today, as 2026-10-04). A token that finds nothing
stays as written, so a lone `%` is safe; `%%` writes one `%`. The file keeps the tokens — editing
the label edits them — and the canvas, exports, viewer and card show the values.

### Named styles

A look used again and again can be named once under `styles:` and given to elements with
`style:`:

```yaml
styles:
  critical: { tone: rose, stroke_width: 2, shadow: true, color: "#f43f5e" }
  async: { line: dashed, arrows: open }
shapes:
  payments: { shape: rounded, style: critical }
  refunds: { shape: rounded, style: critical, tone: amber } # its own keys win
components:
  ledger: { type: azure/sql-database, style: critical } # takes the colour
connections:
  payments_to_refunds: { from: payments, to: refunds, style: async }
```

A style holds look keys only — what a shape, component, container or connection takes for how it
looks (the tables here), never what it is, where it sits or what it says. Each element takes the
keys that mean something for its kind, so one style can serve shapes and connections alike; its
own keys win over its style's. Styles can sit in any file of a folder diagram and are used from
any other. Notes and text keep `style:` for their text style (`title`, `heading`, `body`…).

In the editor, the Style tab's **Named style** section gives the selection a style, makes a new
one from how an element looks now, and — when an element has changes of its own — either pushes
them into the style (every element with it follows) or drops them (Reset).

### How a connection looks

All optional, and written only when they differ from the default (ED-29):

```yaml
connections:
  api_to_db:
    from: api
    to: db
    arrows: { start: diamond-outline, end: block } # or just the end: arrows: block
    arrow_size: 9 # or { start: 6, end: 10 }; 2–20, default 7
    line: dashed # solid | dashed | long-dash | dotted | dash-dot, or a dash list [8, 3, 2, 3]
    width: 2 # 0.5–8 px, default 1.5
    corners: sharp # rounded (default) | sharp
    jumps: arc # none (default) | arc | gap: hop over connections drawn before this one
```

| Key          | Values (default first)                                                                                                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `arrows`     | `none`, `open`, `classic`, `classic-outline`, `block`, `block-outline`, `async`, `oval`, `oval-outline`, `diamond`, `diamond-outline`, `dash`, `cross`, `er-one`, `er-mandatory-one`, `er-many`, `er-one-many`, `er-zero-one`, `er-zero-many` |
| `arrow_size` | 7, or 2–20 per end                                                                                                                                                                                                                            |
| `line`       | `solid`, `dashed`, `long-dash`, `dotted`, `dash-dot`, or a list of dash and gap lengths in px                                                                                                                                                 |
| `width`      | 1.5, or 0.5–8                                                                                                                                                                                                                                 |
| `corners`    | `rounded`, `sharp`                                                                                                                                                                                                                            |
| `jumps`      | `none`, `arc`, `gap`                                                                                                                                                                                                                          |

Without `arrows`, `direction` decides them: `forward` puts an open arrow at the end, `reverse` at
the start and `both` at both ends. Traffic dots run over any line pattern.

## Icons

A component's `type` and a container's `icon` name an icon from Mogram's catalogue as
`<library>/<icon>`, or an SVG in the diagram's `icons/` folder by path.

| Library      | Prefix     | Examples                                                              |
| ------------ | ---------- | --------------------------------------------------------------------- |
| Azure        | `azure/`   | `azure/virtual-machine`, `azure/kubernetes-services`                  |
| AWS          | `aws/`     | `aws/lambda`, `aws/s3`, `aws/application-load-balancer`, `aws/region` |
| Google Cloud | `gcp/`     | `gcp/cloud-run`, `gcp/bigquery`, `gcp/pub-sub`                        |
| Kubernetes   | `k8s/`     | `k8s/pod`, `k8s/deployment`, `k8s/service`                            |
| Generic      | `generic/` | `generic/users`, `generic/database`                                   |
| Tool logos   | `tool/`    | `tool/redis`, `tool/kubernetes`                                       |

Common short forms work too and are kept as written: `azure/aks`, `azure/vm`, `aws/alb`,
`gcp/gcs`, `k8s/svc`, `k8s/pvc`. The `libraries` setting names libraries by prefix or name (`aws`,
`gcp` or `google-cloud`, `k8s` or `kubernetes`, `tools`); names Mogram doesn't know are ignored.

## Scenes

A scene records only what differs from normal.

```yaml
scenes:
  region_outage:
    db_primary: down
    app_to_primary: blocked
    db_replica: active
    aks.ingress: degraded # an element inside a nested diagram, by path
  traffic_spike:
    web_vm: { state: overloaded, motion: shake }
```

The base state (no scene) is shown as **Normal**. Scene order is the order of keys.

Scenes belong to the top diagram, the one people open: they reach inside nested diagrams by path
(`aks.ingress`), so one scene tells the whole story at every level. A nested diagram's own
`scenes:` are used only when that folder is opened on its own. In the editor, choosing a state
inside a nested diagram while a scene is selected writes the path line into the top diagram's
scene.

## Capacity

How much traffic each part carries, and what scales to meet it. Traffic is relative: **1×** is
normal. It starts at elements nothing feeds (people, clients, schedulers) and flows along the
connections. Most elements pass it to every next element (a call); load balancers, gateways,
front doors and ingresses send each request to **one** of them, evenly or by share.

```yaml
components:
  lb: { type: azure/load-balancers } # sends each request to one of the next
  web:
    type: azure/virtual-machine
    scale: { min: 2, max: 8 } # scales out: between 2 and 8 copies
    capacity: 1x # what one copy handles at 100% (default 1x)
  db:
    type: azure/sql-database
    scale: # scales up: smallest first
      target: 60% # the load it's kept near (default 70%)
      sizes:
        - { name: S2, cpu: 2, memory: 8, disks: 1 }
        - { name: S4, cpu: 4, memory: 16, disks: 2 }
        - { name: S8, cpu: 8, memory: 32, disks: 4, capacity: 3x }
  cache: { type: azure/cache-redis, hit: 80% } # answers 80% itself; misses go on
  orders: { type: aws/sqs } # a queue: holds what its consumers can't take yet
connections:
  users_to_lb: { from: users, to: lb, traffic: waves } # busy, then quiet, on a loop
  lb_to_canary: { from: lb, to: canary, share: 10% } # its share of the split
  api_to_cache: { from: api, to: cache, traffic: 2x } # twice what it would otherwise carry
scenes:
  black_friday: # a moment: held at five times as much, and on through everything after
    users_to_lb: 5x
    cache: { hit: 20% } # a cold cache
    web: { copies: 3 } # held at 3 copies, whatever the traffic
    db: { size: S2 } # held at a size
```

| Key        | On                       | Means                                                                                                                                                                   | Default                                 |
| ---------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `scale`    | components               | `{ min, max, target }` scales out (up to 24 copies); `{ sizes, target }` scales up (up to 8 sizes). Each size takes twice the traffic of the one before unless it says. | doesn't scale                           |
| `capacity` | components               | Traffic one copy (or the first size) handles at 100%, like `2x`. Its load is shown.                                                                                     | `1x`                                    |
| `routing`  | components               | `split`: each request to one next element. `copy`: to every one.                                                                                                        | `split` for load balancers and gateways |
| `hit`      | components, scene lines  | The share a cache answers itself; only the misses go on.                                                                                                                | none                                    |
| `queue`    | components               | Holds what its consumers can't take yet; they work through it.                                                                                                          | `true` for queues, buses and streams    |
| `traffic`  | connections, scene lines | A steady level that multiplies what it carries (`5x` is five times as much, `0x` nothing), or a pattern (below). A scene's `users_to_lb: 5x` holds it at that level.    | `1x`                                    |
| `share`    | connections, scene lines | Its share when its source splits; the rest is shared evenly among those without one.                                                                                    | even                                    |
| `copies`   | scene lines              | Holds something that scales out at this many copies.                                                                                                                    | automatic                               |
| `size`     | scene lines              | Holds something that scales up at this size.                                                                                                                            | automatic                               |

Sizes are names (`sizes: [Small, Medium, Large]`) or `{ name, cpu, memory, disks, capacity }`
(memory in GB); a size without a name is named by what it has ("4 vCPU · 16 GB"). Shapes don't
scale.

Something that scales out runs enough copies to keep each near its target, between its least and
most; something that scales up uses the smallest size that keeps it under its target. Past its
most copies or its largest size, it is **overloaded** once its load passes 100%. Changes take
time, the same everywhere the diagram is shown: new copies start after a moment, one after
another; copies are removed after a cool-down, newest first, once their traffic has stopped; a
machine grows (or shrinks) smoothly into a new size over a second, taking traffic all the while.

How it's drawn: something that scales out is a **scale set** — its copies, each with the
element's own icon, in a frame that grows and shrinks inside a faint outline of the most it can
hold. Copies start (a ring fills, then a green tick) and stop (they dim, then go); traffic fans
out to every running copy, and each has a load bar. A container that holds only that component
is its scale set and grows and shrinks with it. Something that scales up opens into a
**machine**: as it grows its cores light up, memory fills and disks slide in (and the other way
as it shrinks); the dashed outline around it is its largest size. Queues fill as work waits, caches show their hit rate, and the dots along a
connection follow how much it carries.

### Traffic patterns

Traffic on an arrow can rise and fall on its own, so what it reaches scales out and back in (or
up and down) again and again, with no scenes:

```yaml
connections:
  users_to_lb: { from: users, to: lb, traffic: waves }
  orders_to_queue:
    from: orders
    to: queue
    traffic: { pattern: bursts, high: 8x, low: 0.5x, every: 20s }
```

| Pattern  | What it does                                                | Default          |
| -------- | ----------------------------------------------------------- | ---------------- |
| `steady` | One level (`traffic: 2x` is short for it)                   | `1x`             |
| `waves`  | Quiet for the first half of each cycle, busy for the second | 1× to 5×, 10 s   |
| `bursts` | Quiet, with a short burst (the last quarter of each cycle)  | 0.5× to 5×, 12 s |

`high` is the busy level and `low` the quiet one, each a multiple of what the arrow would
otherwise carry; `every` is the cycle, from 4 s to 120 s (long enough for copies to start and
leave). The dots along the arrow follow the traffic. Patterns run the same in the editor, the
viewer and thumbnails; an animated export lasts a whole number of cycles and loops. Scenes are
for moments — an outage, a rollback, a cold cache, Black Friday held at 5× — and a scene that
gives an arrow a level holds it there while the scene is shown.

## Tours

```yaml
tours:
  request_flow:
    title: How a request flows
    start: web_vm
    steps:
      web_vm:
        next: storage
      storage:
        choices:
          Normal read: cdn
          Region outage:
            next: db_replica
            scene: region_outage
```

A step is keyed by the element it visits (a nested path like `aks.ingress` dives into a nested
diagram). A step has `next`, `choices`, or neither (end of tour), and may set `scene`. The camera
travels along the connection between consecutive steps when one exists. Cards supply the text.

## Concepts

A concept is a diagram that explains an idea others can reuse: horizontal scaling, caching,
failover, how DNS resolves. It's an ordinary diagram whose traffic and scenes tell the story,
with a `concept:` section saying what it explains, where it's filed, and which of its elements
play the parts:

```yaml
name: Horizontal scaling
concept:
  summary: Run more copies of a service as traffic grows and fewer as it falls.
  topic: scaling # where it's filed (below)
  platform: any # any (the default) | azure | aws | gcp | kubernetes
  tags: [autoscaling, vm, load balancer] # extra words search finds it by
  roles:
    app: What scales out # an element in this diagram: the part it plays
    lb: { label: What spreads the traffic, optional: true }
```

- **topic**: `scaling` (Scaling & performance), `reliability`, `networking`, `security`
  (Security & identity), `data` (Data & storage), `messaging` (Messaging & events),
  `containers` (Containers & Kubernetes), `delivery`, `git`, or `architecture` (Architecture
  patterns). Concepts without one are listed under Other.
- **platform**: a concept about one platform's own services (Azure Front Door, AWS Auto Scaling
  groups) names it; a general idea leaves it out.
- **Two kinds.** With `roles` it's a **pattern**: applied to your own elements. Without, it's an
  **explainer**: inserted or opened as it is.

Concepts are under **Concepts** in the editor's left panel: Mogram's own, and every diagram of
yours (a draft in this browser, or in your account) that has a `concept:` section. They're
listed by topic and found by search, with yours and the ones used lately first; once some
concepts are a platform's own, a platform filter shows that platform's first (general concepts
always show). **Browse all** opens a gallery with a preview of each. Opening one plays its story. From there:

- **Apply to your elements**, in a diagram you already have: pick the elements that play its
  parts (what's selected is filled in), and the window lists what will change before you apply
  ("Web scales out, 1 to 8 copies"). Nothing new is drawn but a missing connection. Each picked
  element takes on what its part does with traffic — `scale`, `capacity`, `routing`, `hit`,
  `queue` — unless it already has its own. Picked elements are joined the way the concept joins
  its parts (a missing connection is added, and a `backup_for` follows). The concept's traffic
  patterns and scenes come along: traffic that rises and falls where people enter the concept
  rises and falls where traffic enters your diagram on its way to what you picked (unless that
  arrow already has traffic of its own), and scenes merge into scenes of the same name, a line
  about a part becoming a line about the element picked for it.
- **Insert the example** (the way in for an empty diagram): adds the whole concept beside your
  diagram, under fresh names where they're taken, with its scenes.
- **Open** it as a diagram of its own.

An explainer offers only the last two.

## Layout

Coordinates are kept out of the way: at the bottom of the single file, or in
`layout.mogram.yaml`. Units are grid cells of 8px, relative to the parent container's top-left.

```yaml
layout:
  vnet: { at: [2, 6], size: [60, 30] } # size only after a manual resize
  web_vm: [4, 6] # short form for { at: [4, 6] }
  db_primary: { at: [30, 6], z: 2 } # z-order among siblings
  app_to_primary:
    { via: [[24, 10], [24, 18]] } # hand-bent path (grid units, relative to
    # the innermost container holding both ends)
  api_to_db:
    from_anchor: right # fix an end to a point on its element: a name or [x, y] fractions
    to_anchor: [0, 0.25] # top, bottom, left, right, top-left … or [0–1, 0–1]
    label: { at: 0.3, offset: 2 } # 0–1 along the line, grid cells to its left (+) or right (−)
  firewall: { at: [40, 6], locked: true } # can't be moved, resized or deleted until unlocked
  decorations:
    title: { text: Checkout, style: title, at: [0, -8] }
    legacy: { label: Legacy, tone: amber, at: [40, 2], in: vnet }
    hot_path: { zone: Hot path, at: [2, 4], size: [30, 14], in: vnet, tone: rose }
    follow_ups: # a sticky note
      note: |
        **Follow-ups**
        - Rate limit the API
        - Move sessions to Redis
      fill: "#bfdbfe" # default yellow; a gradient works too
      at: [64, 4]
      size: [22, 18] # default [22, 18]
```

An element without a layout entry is placed automatically and shown as unpinned; dragging it
writes its position.

A connection's `via` points are the corners of an orthogonal line, or the points a straight
or curved line passes through. They are removed again when the line runs where the router
would put it anyway, and they follow the elements at either end when those move. Without
`from_anchor` / `to_anchor` an end floats to whichever side faces the other end; `label: 0.5`
is the short form of `{ at: 0.5 }`.

### Text and sticky notes

Decorations carry no architectural meaning. Free text (`text:`) and sticky notes (`note:`) are
written like a short Markdown note: `**bold**`, `*italic*`, and lines starting `- ` or `1. ` make
lists. Write several lines with `|`. Both take the same typography settings, all optional:

| Key         | Values                                 | Default                                                     |
| ----------- | -------------------------------------- | ----------------------------------------------------------- |
| `font`      | `inter`, `geist`, `instrument`, `mono` | Geist for titles and headings, Inter otherwise              |
| `font_size` | 6–200 (px), or `auto`                  | the text style's size; a note fits its words to itself      |
| `bold`      | `true` / `false`                       | `false` (makes all the words bold)                          |
| `italic`    | `true` / `false`                       | `false`                                                     |
| `align`     | `left`, `center`, `right`              | `left`                                                      |
| `color`     | hex colour                             | from the tone (text), dark or white against the fill (note) |

A note also takes `fill` (a colour or gradient) and `size`. Exports embed the fonts a diagram
uses, so text looks the same in a PNG or SVG as on screen.

## Validation

Problems are reported in plain language with the file and line:

```
compute.mogram.yaml:14 — "web_vm" is inside "web_subnett", but there is no container with that name.
                         Did you mean "web_subnet"?
```

Errors stop only the broken part; everything else keeps rendering.

A concept's role that names something that isn't a component or container in the diagram is
reported the same way; an unknown topic or platform is a warning naming the closest one (and is
left out until fixed); and capacity that can't apply (copies on something that doesn't scale out,
a size it doesn't have, traffic on a component) is ignored with a warning.

Beyond what's valid, the editor's **Suggestions** (the diagram's inspector) review the
architecture: a subnet outside any network, containers nested the wrong way round for the
diagram's cloud, an AWS subnet outside an Availability Zone when the diagram has zones, icons
from two clouds, components nothing connects to, empty containers. They're advice, never errors:
the file is fine as written.
