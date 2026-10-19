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
| `images/*`                | Pictures an `image` shows (any folder works).                                        |
| `code/*`                  | Files a `code` element shows (any folder works).                                     |
| `voice/*`                 | Recordings of a story's script, named by Mogram (see Stories).                       |

**Code files.** These are read as text, anywhere in a project, up to 200 KB each, never run and
never read as Mogram files: `.tf`, `.tfvars`, `.hcl`, `.sh`, `.bash`, `.zsh`, `.json`, `.toml`,
`.ini`, `.py`, `.go`, `.rs`, `.java`, `.c`, `.cpp`, `.h`, `.hpp`, `.cs`, `.rb`, `.js`, `.jsx`,
`.mjs`, `.cjs`, `.ts`, `.tsx`, `.html`, `.css`, `.scss`, `.sql`, `.diff`, `.patch`, `.log`,
`.txt`, and `Dockerfile`.

**Binary files.** A picture or a recording is held by the hash of its bytes (D-101). In the
project's files its path holds one line:

```
mogram-asset 1 sha256:<64 hex> <media type> <bytes>[ <width>x<height>][ <seconds>s][ skip=<seconds>]
```

`<width>x<height>` is a picture's size in pixels; `<seconds>s` is where a recording's voice ends
and `skip=` where it starts (the silence at either end isn't played). In a repository or a zip
the path is the file itself: Mogram writes the pointer when it opens the folder, and the bytes
when it downloads it. Media types: `image/png`, `image/jpeg`, `image/webp`, `image/gif`,
`audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/wav`, `audio/ogg`. SVG pictures are text, cleaned
as uploaded icons are. A picture written as a `data:` URL is still read.

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
page: 16:9 # optional: a fixed frame (see Page; default: none)
deck: { slides: [intro, flow] } # optional: makes the folder a deck (see Decks)
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

### Page

A diagram is as big as what's in it. Give it a page and it has a fixed frame instead, for a
slide, a video, or an export that has to come out at a known size (D-98).

| Value            | Cells                  | Pixels at 100% |
| ---------------- | ---------------------- | -------------- |
| `none` (default) | the diagram's contents |                |
| `16:9`           | 240 × 135              | 1920 × 1080    |
| `4:3`            | 180 × 135              | 1440 × 1080    |
| `1:1`            | 135 × 135              | 1080 × 1080    |
| `9:16`           | 135 × 240              | 1080 × 1920    |

The page's top-left corner is `[0, 0]`, and positions are in cells from there, as always. With
a page, the viewer fits the page to the screen (edge to edge when presenting), an export's
**Page** area is exactly the page, and a thumbnail shows the page. What lies outside the page
is off stage: the editor draws it dimmed, and nothing else draws it.

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

## Decks

```yaml
mogram: 1
name: Terraform Crash Course for Absolute Beginners
page: 16:9
theme: midnight
deck:
  frame: frame
  captions: off
  slides:
    - section: What Terraform is
    - title: { frame: false }
    - before_terraform
    - terraform_flow: { to: applied }
    - reading_a_plan: { title: What is Terraform about to do? }
    - section: State and drift
    - terraform_flow: { from: applied }
    - drift: { scene: tag_added }
```

| Key        | Values                                                                     | Default |
| ---------- | -------------------------------------------------------------------------- | ------- |
| `frame`    | A folder whose diagram is drawn under every slide                          | none    |
| `captions` | `on`, `off`: whether someone watching sees each beat's `say` to begin with | `on`    |
| `slides`   | The list, in order                                                         |         |

**An entry in `slides`** is one of:

- `- section: <title>`: a section starts here.
- `- <folder>`: a slide showing that folder's diagram and playing its first story.
- `- <folder>: { … }`: the same, with keys.

| Key     | Means                                                                                | Default            |
| ------- | ------------------------------------------------------------------------------------ | ------------------ |
| `story` | Which of the diagram's stories it plays                                              | the first          |
| `from`  | A step's `name`: begin with the picture as it stood once that step's beat had played | the story's start  |
| `to`    | A step's `name`: stop once that step's beat has played                               | the story's end    |
| `scene` | A scene laid over it throughout                                                      | none               |
| `title` | What the rail, the overview and exports call it                                      | the diagram's name |
| `frame` | `false`: this slide is drawn without the deck's frame                                | `true`             |
| `skip`  | `true`: kept in the file, not shown or counted                                       | `false`            |

- A folder is written relative to the deck's folder (`title`, `./title`, `../shared/checkout`) and must stay inside the project.
- The same folder can appear on several slides. When two next to each other show the same folder and story and the second's `from` is the first's `to`, the story carries on with no cut.
- A diagram with no story is a still slide.
- Slides are counted from 1, skipping the skipped. Sections aren't counted.
- A deck's own file holds settings, `styles:` and `deck:` only.
- Up to 400 slides.

**What a slide takes from the deck.** `page`, `theme`, `background` and `grid` unless it sets its own. `styles` and `data` are merged key by key, the slide's own winning.

**Built-in values**, for any label on a slide or in the frame, beside `%name%`, `%type%`, `%diagram%` and `%date%`:

| Token       | Shows                                   |
| ----------- | --------------------------------------- |
| `%deck%`    | The deck's name                         |
| `%section%` | The section the slide is in, or nothing |
| `%slide%`   | The slide's number                      |
| `%slides%`  | How many slides there are               |

A `data:` value of the same name wins, as with the other built-ins.

**Stories and scenes belong to the slide's diagram.** In a deck, each slide's diagram is "the top diagram, the one people open": its `stories:` play and its `scenes:` apply, and they reach into diagrams it opens by path. (Outside a deck this is unchanged.)

Messages:

- `Slide 3 is "terraform_flo", but no folder with that name holds a diagram. Did you mean "terraform_flow"?` (error; the slide is left out)
- `Slide 3 is "../../elsewhere", which is outside the project.` (error)
- `Slide 4 is "lesson_2", which is a deck. A deck's slides are diagrams.` (error)
- `Slide 3 plays "terraform_flow" from "aplied", but its story "main" has no step with that name. Did you mean "applied"?` (error; the slide plays the whole story)
- `Slide 5 stops at "applied", which comes before "drift", where it starts.` (error; the slide plays from "drift" to the end)
- `Slide 6 names the story "rollback", but "terraform_flow" has no story with that name.` (error)
- `"frame" is "frme", but no folder with that name holds a diagram.` (error; no frame)
- `"captions" should be on or off.`
- `"box" is an element in a deck's own file. A deck's file holds its settings and its slides; put "box" on a slide or in the frame.` (warning; ignored)
- `The deck has no slides yet.` (warning)
- `"deck" belongs in mogram.yaml. Mogram ignores it in slides.mogram.yaml.` (warning, as for other settings)

A link can open a deck part-way: `?slide=12&beat=3`, where `beat` counts within the slide's stretch. A deck in a folder is opened with `?root=<folder>`.

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

### Pictures and code

Two more values for `shape:`.

#### Image

```yaml
shapes:
  portal:
    shape: image
    src: images/storage-basics.png
    fit: contain
    corner: 10
    shadow: true
    parts:
      name_field: [0.36, 0.42, 0.50, 0.08]
      region: { area: [0.36, 0.60, 0.50, 0.08], show: hidden }
layout:
  portal: { at: [8, 22], size: [104, 72] }
```

| Key                                                   | Values (default first)                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src`                                                 | A picture in the project (required): `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`         |
| `fit`                                                 | `contain`, `cover`                                                                            |
| `corner`                                              | 8, or a radius in px                                                                          |
| `stroke`, `stroke_width`, `dash`, `shadow`, `opacity` | as for any shape (`stroke` defaults to `none`)                                                |
| `label`                                               | none. When written it is the caption under the picture and its description for screen readers |
| `parts`                                               | see Parts                                                                                     |

- Without a size in the layout it is 80 cells wide at the picture's own proportions (16:9 when they aren't known).
- It takes every component key (`in`, `show`, `card`, `link`, `data`, `mark`). It has no `tone`, `fill` or typography keys, and no `state` or `motion`.
- A GIF shows its first frame. An SVG is cleaned as an uploaded icon is.

Messages:

- `"portal" shows "images/portl.png", but there is no such file. Did you mean "images/portal.png"?` (error; drawn as a missing picture)
- `"portal" shows "notes.md", which isn't a picture Mogram can show. Use PNG, JPEG, WebP, GIF or SVG.`
- `"portal" is an image, so it needs "src", like src: images/portal.png.`
- `"fit" should be contain or cover.`

#### Code

```yaml
shapes:
  main_tf:
    shape: code
    file: code/main.tf
    lines: 1-7
    language: hcl
    title: main.tf
    numbers: true
    font_size: 22
    parts:
      name: 2
      required: 2-6
  plan:
    shape: code
    language: plan
    title: none
    text: |
      # azurerm_storage_account.storage must be replaced
      -/+ resource "azurerm_storage_account" "storage" {
            ~ name = "tfcoursedeveusabc12st" -> "tfdemodeveusabc12st" # forces replacement
          }

      Plan: 9 to add, 0 to change, 9 to destroy.
    parts:
      block: 1-4
      summary: { lines: 6, show: hidden }
```

| Key                                                             | Values (default first)                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `text` or `file`                                                | The lines, written in place (a block, `text: \|`), or a code file in the project. Exactly one of the two           |
| `lines`                                                         | All of it, or a slice like `12-31`. Line numbers stay the file's own                                               |
| `language`                                                      | From the file's extension, else `plain`. One of `hcl`, `console`, `plan`, `yaml`, `json`, `shell`, `diff`, `plain` |
| `title`                                                         | The file's name (nothing for `text:`), or words for the header, or `none` for no header                            |
| `numbers`                                                       | `false`, `true`: line numbers down the left                                                                        |
| `font_size`                                                     | 20, or 10–64 (px). The font is always the mono one                                                                 |
| `fill`, `stroke`, `stroke_width`, `corner`, `shadow`, `opacity` | as for any shape; the fill and stroke default to the theme's code panel                                            |
| `parts`                                                         | see Parts                                                                                                          |

- Every space, tab (shown as two spaces) and blank line is kept. Lines never wrap.
- Without a size in the layout it fits its text. With one, a line too long for it is cut with `…` and a suggestion says which.
- It takes `in`, `show`, `card`, `link`, `data` and `mark`. It has no `label`, `tone`, `state` or `motion`.

**Languages.**

| `language`              | Coloured as                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hcl`                   | block types, labels, attribute names, strings, numbers, comments                                                                                                                           |
| `console`               | a line starting `$ ` or `> ` is a command; the rest is its output. Colour codes in captured output are dropped                                                                             |
| `plan`                  | Terraform's plan: a line whose first mark is `+` is added, `-` removed, `~` changed, `-/+` or `+/-` replaced, `<=` read; `#` lines are comments; `Plan:` and `No changes.` are the summary |
| `yaml`, `json`, `shell` | keys, strings, numbers, comments, commands                                                                                                                                                 |
| `diff`                  | `+` and `-` lines                                                                                                                                                                          |
| `plain`                 | one colour                                                                                                                                                                                 |

Extensions: `.tf`, `.tfvars`, `.hcl` are `hcl`; `.yaml`, `.yml` are `yaml`; `.json` is `json`; `.sh`, `.bash` are `shell`; `.diff`, `.patch` are `diff`; everything else is `plain`. `console` and `plan` are always written.

Messages:

- `"main_tf" is code, so it needs "text" or "file", like file: code/main.tf.`
- `"main_tf" has both "text" and "file". Use one.`
- `"main_tf" shows "code/mian.tf", but there is no such file. Did you mean "code/main.tf"?`
- `"main_tf" shows lines 12-31 of "code/plan.txt", which has 20 lines.` (warning; shows what there is)
- `"lines" should be a line or a range, like 12 or 12-31.`
- `"language" is "terraform", which isn't one Mogram colours, so it is shown plain. Did you mean "hcl"?` (warning)
- Suggestion: `Line 14 of "plan" is wider than the element at this size, so its end is cut.`

### Parts

An element can name sub-areas of itself. Today that is `image` and `code`.

```yaml
parts:
  name: 2 # code: a line
  required: 2-6 # code: a range of lines
  summary: { lines: 31, show: hidden } # the long form, with how it starts
  name_field: [0.36, 0.42, 0.50, 0.08] # image: x, y, w, h, each 0–1 of the picture
  region: { area: [0.36, 0.60, 0.50, 0.08], show: faded }
```

| On      | Short form                     | Long form keys                  |
| ------- | ------------------------------ | ------------------------------- |
| `code`  | a line number, or `first-last` | `lines`, `show`, `tone`, `mark` |
| `image` | `[x, y, w, h]`                 | `area`, `show`, `tone`, `mark`  |

- A part's name follows the rules for any name and is unique within its element. Up to 64 parts an element.
- Parts can overlap.
- A code part's lines are the file's own numbers, whatever slice is shown.
- **A part is addressed `element.part`**: in a scene or a step's `set`, in `focus`, in `zoom`, and as an end of a connection.

```yaml
connections:
  same_thing: { from: portal.name_field, to: main_tf.name }
scenes:
  reviewed:
    main_tf.required: { mark: check }
stories:
  main:
    - say: The form tells you what Terraform will ask for.
      focus: [portal.name_field, main_tf.name]
    - set:
        plan.summary: shown
        main_tf.name: { tone: amber, mark: warn }
      zoom: plan.summary
```

**What a set can change on a part**

| Key    | Means                                                                   |
| ------ | ----------------------------------------------------------------------- |
| `show` | `shown`, `faded` or `hidden`. One word is enough: `plan.summary: shown` |
| `tone` | A wash of that colour behind the lines, or an outline round the region  |
| `mark` | A sign at the start of the first line, or at the region's corner        |

- `focus` on a part keeps it bright. The rest of its element dims along with everything else that isn't in focus.
- `zoom` on a part frames it.
- A connection that ends on a part attaches to the part's box.
- Hiding an element hides its parts. A hidden code part leaves its lines blank, so nothing below it moves.

**An element with parts can't open a nested diagram**, so `a.b` is a part when `a` has parts and a path into a nested diagram when `a` opens one.

Messages:

- `"main_tf" has parts, so it can't also open a nested diagram.` (error; `opens` is ignored)
- `In story "main", "main_tf.nam" names a part of "main_tf" that isn't there. Did you mean "name"?` (error; the line is ignored)
- `In scene "reviewed", "web.name" points inside "web", but "web" has no parts and doesn't open a nested diagram.` (replaces today's message for this case)
- `Part "summary" of "plan" is line 40, but "code/plan.txt" has 31 lines.` (warning)
- `Part "name_field" of "portal" should be four numbers from 0 to 1: x, y, width, height.`
- `A part can change "show", "tone" and "mark". "label" is ignored on "main_tf.name".` (warning)
- `Connection "same_thing" ends on "portal.nme_field", but "portal" has no part with that name.`

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

A scene is a named **set**: it records only what differs from normal.

```yaml
scenes:
  region_outage:
    db_primary: down
    app_to_primary: blocked
    db_replica: active
    aks.ingress: degraded # an element inside a nested diagram, by path
  traffic_spike:
    web_vm: { state: overloaded, motion: shake }
  sale:
    banner: shown # something that isn't there until this scene
    web_vm: { label: Web (busy), mark: warn }
```

The base state (no scene) is shown as **Normal**. Scene order is the order of keys.

Scenes belong to the top diagram, the one people open: they reach inside nested diagrams by path
(`aks.ingress`), so one scene tells the whole story at every level. A nested diagram's own
`scenes:` are used only when that folder is opened on its own. In the editor, choosing a state
inside a nested diagram while a scene is selected writes the path line into the top diagram's
scene.

### What a set can change

Scenes and the steps of a story (below) share one vocabulary. Each line names an element and
gives it one word, or keys:

| Key                                         | On                          | Means                                                             |
| ------------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| `state`                                     | components, containers      | `healthy`, `active`, `scaling`, `degraded`, `overloaded`, `down`  |
| `flow`                                      | connections                 | `traffic`, `slow`, `blocked`, `rerouted`, `idle`                  |
| `motion`                                    | components                  | `none`, `pulse`, `bounce`, `rotate`, `shake`, `glow`              |
| `traffic`, `share`, `hit`, `copies`, `size` | as in [Capacity](#capacity) | the numbers the capacity model works from                         |
| `show`                                      | anything but a group        | `shown`, `faded` or `hidden`                                      |
| `label`                                     | anything with words         | what it says                                                      |
| `tone`                                      | shapes, text                | its colour scheme                                                 |
| `mark`                                      | components, containers      | the sign at its corner, or `none`                                 |
| `in`, `on`, `cell`, `along`                 | things a layout places      | where it goes: see [Layouts](#layouts)                            |
| a number, `[30, 0]` or `= formula`          | a value in `data:`          | what the value becomes: see [Values](#values-meters-and-controls) |

One word is enough when it can only mean one thing: `db: down`, `a_to_b: blocked`,
`banner: shown`, `users_to_lb: 5x`. A set can't change what something _is_: its kind, shape,
style, size, place or what it connects.

### Presence and marks

`show:` says whether an element is there: `shown` (the default), `faded` (still there, drawn
pale: a commit nothing points at, a version being retired) or `hidden` (absent: nothing draws
it, and the capacity model doesn't see it). Written on an element, it's how the element
starts; in a set, it's what happens to it.

```yaml
shapes:
  lease: { label: Lease, show: hidden } # appears when a step or scene shows it
containers:
  green: { label: GREEN, show: faded }
```

What's inside a hidden container is hidden with it, and so is a connection with a hidden end;
`faded` carries the same way. The diagram is laid out once with everything shown, so nothing
shifts when something appears. In the editor, hidden things are drawn faintly so they can still
be selected and edited.

`mark:` puts a small sign at the corner of a component or container: `check`, `cross`, `warn`,
`lock`, `key`, `clock`, `star` or `question`. A mark means nothing to the capacity model; it's
for a gate that passed, a request refused, a secret held.

### Layouts

A container can arrange what's in it (D-87). Its children then need no positions, and a story
can move things in and out.

```yaml
containers:
  queue: { label: Queue, layout: row }
  ledger: { label: Charges, layout: column, gap: 1 }
  crowd: { layout: grid, columns: 4 }
shapes:
  msg: { shape: rounded, label: "#7", in: queue }
  again: { like: msg, in: queue, show: hidden } # a copy: same shape, look, label and data
  lease: { label: Lease, on: msg } # rides on the message, wherever it goes
  breaker: { label: Closed, on: app_to_db, along: 30% } # rides on an arrow
```

| Key       | Means                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `layout`  | On a container: `row` (left to right), `column` (top to bottom) or `grid`. Children are in file order. |
| `gap`     | Space between children, in grid units (2 unless written; `none` for flush layers).                     |
| `columns` | A grid's columns. Left out: from its written cells, or a block as square as it can be.                 |
| `cell`    | On a grid's child: its `[column, row]`, from 0. Left out: the next free cell.                          |
| `on`      | The element or connection something rides on: it sits above it (on a connection, on its line).         |
| `along`   | How far along the connection it rides on (`30%`). Left out: half-way.                                  |
| `like`    | A copy of another element of its kind: its type or shape, look, label, size and data. Not its place.   |

- **Room is kept.** A container with a layout is as big as the most it ever holds, in any step
  of any story or any scene, so it never resizes and nothing around it shifts. When something
  leaves a row, the rest close up inside that room.
- **Moving.** Only what a layout places can change place. In a set, `msg: { on: worker_a }` puts
  it on the worker; `msg: { in: done }` puts it in another container that arranges its contents.
  It travels there, along the connection between the two places when there is one. Things placed
  freely on the canvas never move in a story.
- **On top.** What a layout places is drawn over everything else, and routes never go round it.
- **Copies** (`like:`) grow out of what they copy when they're shown.
- Text can ride too (`layout.decorations.name: { label: main, on: commit_c }`), with no position
  of its own: a branch name on a commit.

### Values, meters and controls

A value in `data:` written as text starting with `=` is a formula (D-88): worked out, never
typed twice. Labels show it with `%name%`.

```yaml
data:
  allowed: 120
  errors: 30
  left: "= round((1 - errors / allowed) * 100)"
shapes:
  budget: { shape: meter, label: Error budget, value: left, max: 100, limit: 20, unit: "%" }
  timer: { shape: meter, as: ring, label: Lease, value: lease_left, max: 30, unit: " s" }
connections:
  users_to_lb: { from: users, to: lb, traffic: "= rps" } # a dial drives the capacity model
controls:
  rps: { dial: [1, 10], start: 2, step: 1, unit: "×", label: Traffic }
  retries: { toggle: retry_storm, label: Retries }
  model: { pick: [normal, paas, saas], label: Service model }
```

- **Formulas** take numbers, text in quotes, other values' names, `+ - * / %`, comparisons,
  `and`, `or`, `not`, and `min`, `max`, `round`, `floor`, `ceil`, `abs`, `log2`, `if(test, a, b)`.
  They can read the model: `load(web)`, `copies(web)`, `traffic(a_to_b)`, and `count(queue)`
  (what's in or on it now). A formula that feeds the model (a connection's `traffic`) can't
  read it back.
- **A set can change a value**: `errors: 90`, or run it across the step with `errors: [30, 90]`
  (a timer running down is `left: [30, 0]`).
- **A meter** is a shape that shows a `value` against a `max`: `as: bar` (the default), `ring`
  (a timer) or `number`. With a `limit` it turns amber near it and red at it; a limit in the
  lower half of the range is one not to fall to (a budget left).
- **Controls** are what the viewer can set. A **dial** is a number formulas read by its name; a
  **toggle** turns a scene on (and reads as 1 or 0); a **pick** chooses one of several scenes
  (`normal` is the diagram as it is). Scenes that controls turn on are laid over the scene picked,
  in the order the controls are written.
- **A step can depend on values**: `when: "= work > lease"` plays the step only while that
  holds, so a dial changes what happens, not just what's shown. Moving a control plays the story
  again to where it was.

## Stories

A story plays a diagram step by step, with words (D-86). Each step is a set, like a scene's,
and the picture at a step is the diagram plus every step before it.

```yaml
stories:
  main:
    - say: A full copy of the new version comes up beside the old one.
      set:
        green: shown
        v2: shown
    - say: Test it before anyone sees it.
      set: { tester: shown }
      focus: [tester, v2]
    - set: { v2: { mark: check } } # no words: carries on the beat above
    - say: One switch, and everyone moves at once.
      pace: slow
      name: switched
      set:
        router_to_blue: idle
        router_to_green: traffic
    - say: The same again, but this release also dropped a column the old version reads.
      rewind: switched
      set: { db: { mark: warn } }
      choices:
        - { label: Roll back anyway, play: rolled_back }
  rolled_back:
    - say: The switch back lands on a version that can't read its data.
      set: { v1: down }
```

| Key       | Means                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------- |
| `say`     | The caption. A step with `say` starts a **beat**; steps after it without one belong to that beat. |
| `script`  | What is spoken over the beat, for the prompter (D-96). Never drawn. Also starts a beat.           |
| `set`     | What changes: the same lines a scene takes.                                                       |
| `focus`   | Elements that stay bright while the rest dims, for this beat.                                     |
| `zoom`    | An element the camera frames, for this beat.                                                      |
| `pace`    | `slow`: the change takes twice as long, for the moment it all turns on.                           |
| `hold`    | Seconds the step stays once changed (`3s`). Left out: long enough to read its beat's words.       |
| `name`    | A name another step can rewind to.                                                                |
| `rewind`  | Begin this step from an earlier picture: `start`, or a step's `name`. A cut, not a replay.        |
| `choices` | Stories the viewer can play from here; when one ends, the story carries on.                       |

A caption on its own (`- Here is a web server.`) is a step that only says something.

`script` is the words you say aloud while the beat plays, up to 4,000 characters. The prompter
shows it (falling back to `say` when a beat has none), and a beat with a script holds for as
long as the script takes to say rather than as long as its caption takes to read.

- **Beats.** A viewer moves by beat: the words appear with the first step, and the wordless
  steps after it play on by themselves, in order. So "A is copied, lands on main, and is
  stamped" is one caption and three things happening in turn.
- **The first story** is the one a diagram plays. Others are played by a choice. A story a
  choice plays can rewind to a named step of the story that offered it.
- **Scenes still work.** A scene picked while a story plays is laid over the story's picture,
  key by key. The viewer's own "what if" changes go over both.
- **Stories belong to the top diagram**, like scenes, and reach into nested diagrams by path.
- **Timing.** A step is its change (0.6 s, or 1.2 s when slow), then its hold. Exports and
  previews follow these times; someone stepping through by hand moves on when they're ready.

In the viewer the words show in a bar under the diagram, with back, play and next (the arrow
keys step, Space plays), a mark for every beat, and a button for each choice. A link can open a
story part-way: `?story=main&beat=3`.

#### The voice

A beat's recording isn't written in the YAML (D-105). It's the file `voice/<key>.<ext>` in the
deck's folder (or the diagram's), where `<key>` is the script's first words and a hash of all of
them, lower-cased, with punctuation and accents dropped: `voice/the-plan-is-the-difference-3fa9c2d1.webm`.
Beside it, `voice/<key>.txt` holds the words it was recorded saying.

- Mogram writes these files when a beat is recorded in the Script window. Nobody names them.
- Moving a beat, reordering slides or renaming anything never loses a recording. Changing a word
  makes it out of date: the editor offers **Keep this recording**, which files it under the new
  words. Changing the words back finds it again. Punctuation and capitals don't matter.

| A beat                           | Lasts                                                                      |
| -------------------------------- | -------------------------------------------------------------------------- |
| with a recording                 | the recording, then 0.4 s; its wordless steps are spaced evenly through it |
| with a `script` and no recording | 0.4 s, then about 3.2 words a second                                       |
| with only `say`                  | the time it takes to read                                                  |

Playing a deck or a story by itself plays each beat's recording; stepping by hand plays none.
In a deck, a slide's opening picture holds 0.6 s, a still slide 4 s, and a cut takes 0.45 s.
A script is at most 4,000 characters, and a beat that takes more than about 25 seconds to say
earns a suggestion to split it.

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

Free text also takes `width`, 4–240 cells: it wraps at spaces to fit, its height follows, and
`align` works within it. Without one it's as wide as its longest line. A text whose `in:` is a
container that arranges its contents (`layout: column`, `row` or `grid`) is placed by it like
any other child and needs no `at`. `"width" only applies to text, so it is ignored on "zone".`
is a warning on anything else.

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
from two clouds, components nothing connects to, empty containers, something that sits outside
the page, a code line cut off at its element's size, and a beat that takes over 25 seconds to say.
They're advice, never errors: the file is fine as written.
