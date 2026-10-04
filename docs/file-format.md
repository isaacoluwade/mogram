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
theme: midnight # canvas theme preset (default midnight)
background: "#101418" # optional: a colour, or a gradient (below)
grid: "#ffffff26" # optional grid colour; the default follows the background
libraries: [aws, generic, tools] # libraries offered in the editor (default: all)
ports: # only in nested diagrams: port name → inner element
  web: ingress
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

## Architecture

```yaml
containers:
  east_us:
    type:
      region # container style preset (region, vnet, subnet, resource-group,
      # cluster, availability-zone, vpc, namespace, box)
    label: East US
  vnet:
    type: vnet
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
