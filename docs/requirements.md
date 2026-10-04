# Requirements traceability

Every requirement in the PRD (`Mogram Product Requirements Document (1).md`) has an ID here.
Code, tests and screenshots reference these IDs so nothing is lost between the document and
the product. Status is updated as work lands (see `build-log.md`).

Legend: ☐ not started · ◐ in progress · ☑ done and tested. Evidence names the test or artefact
that proves it (e2e = `apps/web/e2e`, core = `packages/core/test`).

## ED — Editor

| ID    | Requirement                                                                                      | Status | Evidence                                                |
| ----- | ------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------- |
| ED-1  | Infinite canvas with smooth pan and zoom                                                         | ☑      | e2e editor overview; wheel, pinch and hand tool         |
| ED-2  | Library panel to drag icons onto the canvas                                                      | ☑      | e2e "adds an icon from the library"                     |
| ED-3  | Undo and redo                                                                                    | ☑      | e2e undo/redo; store test                               |
| ED-4  | Copy and paste                                                                                   | ☑      | e2e "copy and paste"                                    |
| ED-5  | Multi-select (shift-click, marquee)                                                              | ☑      | e2e shift-click and marquee                             |
| ED-6  | Align and distribute                                                                             | ☑      | e2e "align left from the inspector"                     |
| ED-7  | Keyboard shortcuts                                                                               | ☑      | e2e shortcuts dialog; `shortcuts.ts` table              |
| ED-8  | Canvas themes: solid colours and gradients, light and dark, chosen from presets                  | ☑      | e2e "changes the canvas background theme"; core presets |
| ED-9  | 8px grid snaps silently, hidden unless turned on; positions always whole numbers                 | ☑      | core layout tests; grid contrast tests; e2e (D-52)      |
| ED-10 | Positions stored in grid units relative to parent container (moving a VNet changes one line)     | ☑      | core edit tests (one-line diffs)                        |
| ED-11 | Elements without a position are auto-placed and unpinned; dragging pins                          | ☑      | core layout tests (auto-placement)                      |
| ED-12 | Containers nest (region, VNet, subnet, resource group, cluster)                                  | ☑      | e2e container tool; core layout tests                   |
| ED-13 | Containers auto-size to children + padding; size saved only after manual resize                  | ☑      | e2e resize saves size; core layout tests                |
| ED-14 | Container look comes from a per-type preset; nothing visual saved unless overridden              | ☑      | core presets; renderer                                  |
| ED-15 | Groups: dashed boundary around chosen members across containers; no position                     | ☑      | e2e grouping                                            |
| ED-16 | Connections drawn by dragging element to element                                                 | ☑      | e2e "the connect tool draws a connection"               |
| ED-17 | Connections auto-routed around other elements                                                    | ☑      | core routing tests                                      |
| ED-18 | Connection path saved only if bent by hand                                                       | ☑      | e2e "bending a connection"; core routing                |
| ED-19 | Connection can attach to a named port on a nested diagram                                        | ☑      | core nested tests; AKS template                         |
| ED-20 | Inspector: type, name, state, presets, card, file                                                | ☑      | e2e state; fields save as typed (D-51); screenshots     |
| ED-21 | Advanced preset settings behind an "Advanced" section                                            | ☑      | inspector "Advanced" sections                           |
| ED-22 | Decorative free text, labels and highlight zones, stored with layout                             | ☑      | e2e text tool; core edit tests                          |
| ED-23 | Z-order: bring forward / send backward / to front / to back (user request)                       | ☑      | e2e "brings an element to the front"; core edit tests   |
| ED-24 | Background can be changed (user request; covered by ED-8 + custom colour)                        | ☑      | e2e theme change; custom colour palette (D-52)          |
| ED-25 | Sticky notes with rich text (bold, italic, lists), font, size, alignment, colours (user request) | ☑      | e2e notes; core notes tests (D-54)                      |
| ED-26 | Quick-edit bar over the selection with edits specific to the element (user request)              | ☑      | e2e quick bar; screenshots (D-55)                       |
| ED-27 | Custom colours, opacity and gradients with presets; grid colour and opacity (user request)       | ☑      | core paint tests; picker screenshots (D-53)             |
| ED-28 | Preview the diagram as viewers see it, from where you are editing (user request)                 | ☑      | e2e navigation: Preview, Shift+P (D-57)                 |

## IC — Icons

| ID   | Requirement                                                                          | Status | Evidence                                                                    |
| ---- | ------------------------------------------------------------------------------------ | ------ | --------------------------------------------------------------------------- |
| IC-1 | Official Azure architecture icon set                                                 | ☑      | icons catalogue tests (638 Azure icons); "other" re-filed (D-50)            |
| IC-2 | Generic icons (users, browsers, phones, servers, databases, queues, …)               | ☑      | icons catalogue (67 generic)                                                |
| IC-3 | Tool logos (Kubernetes, Redis, Grafana, Prometheus, Fluentd, …)                      | ☑      | icons catalogue (48 tool logos)                                             |
| IC-4 | Upload any SVG; saved in `icons/` folder, referenced by path                         | ☑      | e2e SVG upload; sanitiser tests                                             |
| IC-5 | One search across all libraries, matching names and aliases (`vm` → Virtual Machine) | ☑      | icons search tests; e2e `s3`, `pubsub`                                      |
| IC-6 | Every preset works on every icon, including uploaded ones                            | ☑      | renderer draws presets around any icon; e2e every motion on an AWS icon     |
| IC-7 | More libraries: AWS and Google Cloud follow Azure, as data                           | ☑      | AWS (807), Google Cloud (230), Kubernetes (39) (D-46 … D-49); e2e providers |

## PR — Presets and motion

| ID   | Requirement                                                                                       | Status | Evidence                                                  |
| ---- | ------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------- |
| PR-1 | State presets: healthy, degraded, down, scaling, overloaded (+ active, used by PRD scene example) | ☑      | core state tests                                          |
| PR-2 | Flow presets: traffic, slow, blocked, rerouted, idle                                              | ☑      | core state and timeline tests                             |
| PR-3 | Motion presets: pulse, bounce, rotate, shake, glow (whole icon)                                   | ☑      | core timeline tests                                       |
| PR-4 | Container style preset per container type                                                         | ☑      | core presets                                              |
| PR-5 | Canvas theme presets                                                                              | ☑      | core presets; e2e theme                                   |
| PR-6 | Each state preset has a complete built-in look (one click)                                        | ☑      | core presets                                              |
| PR-7 | Flow presets animate along routed path; options for direction, speed, density                     | ☑      | core timeline tests; inspector options                    |
| PR-8 | Advanced options (colour, intensity, speed) behind Advanced                                       | ☑      | inspector "Advanced"                                      |
| PR-9 | One shared clock; durations divide evenly (1, 2, 4 s) so loops are seamless                       | ☑      | core timeline tests (every preset loops in 4s); one clock |

## SC — State and scenes

| ID    | Requirement                                                                       | Status | Evidence                                             |
| ----- | --------------------------------------------------------------------------------- | ------ | ---------------------------------------------------- |
| SC-1  | Every component, container and connection has a state; default normal             | ☑      | core state tests                                     |
| SC-2  | Change state by clicking an element and picking a preset                          | ☑      | e2e state from the inspector                         |
| SC-3  | Container down cascades to everything inside                                      | ☑      | core state tests; failover template                  |
| SC-4  | State rolls up to containers; worst wins by default; author can override the rule | ☑      | core state tests                                     |
| SC-5  | Scene = named snapshot recording only differences from normal                     | ☑      | core format and edit tests                           |
| SC-6  | Scene strip of thumbnails; add, rename, duplicate, reorder                        | ☑      | e2e scene strip, new scene                           |
| SC-7  | Switching scenes animates every change automatically                              | ☑      | 600ms transitions in editor, viewer, previews        |
| SC-8  | Looping motion keeps running inside each scene                                    | ☑      | core timeline                                        |
| SC-9  | Play runs through scenes in order                                                 | ☑      | scene playback (editor, viewer, export "All scenes") |
| SC-10 | Scenes can change elements inside nested diagrams by path (`aks.ingress`)         | ☑      | viewer levels test; AKS scenes                       |

## CA — Cards

| ID   | Requirement                                                                                      | Status | Evidence                            |
| ---- | ------------------------------------------------------------------------------------------------ | ------ | ----------------------------------- |
| CA-1 | Clicking an element with a card zooms the camera and opens the card beside it; closing zooms out | ☑      | e2e "cards zoom the camera"         |
| CA-2 | Title + markdown body (formatting, links, code, images)                                          | ☑      | markdown component tests            |
| CA-3 | Inline text in the diagram file, or a path to a markdown file (`docs/web-vm.md`)                 | ☑      | markdown tests (file cards)         |
| CA-4 | Card links to another element's card; camera moves along the connection when one exists          | ☑      | viewer `followLink` rides the route |
| CA-5 | Cards hidden until opened; quiet indicator on elements with a card                               | ☑      | card indicator on tiles             |
| CA-6 | A card belongs to its element; every tour reuses it                                              | ☑      | tours reuse cards (card panel)      |
| CA-7 | Every card has a deep link                                                                       | ☑      | e2e card deep link                  |

## TO — Tours

| ID    | Requirement                                                                        | Status | Evidence                               |
| ----- | ---------------------------------------------------------------------------------- | ------ | -------------------------------------- |
| TO-1  | Start a tour: camera zooms to first element and opens its card                     | ☑      | e2e tour                               |
| TO-2  | Next / arrow key moves the camera along the connection's routed path               | ☑      | e2e tour; camera rides the routed path |
| TO-3  | Each step can switch the scene                                                     | ☑      | e2e tour choice with scene             |
| TO-4  | Closing the tour zooms out to the full diagram                                     | ☑      | e2e tour exit                          |
| TO-5  | Tours cross into nested diagrams                                                   | ☑      | e2e tour into AKS                      |
| TO-6  | Branching: a step offers choices, each with its own next step and scene            | ☑      | e2e tour choices; core tours tests     |
| TO-7  | Explore mode: self-paced, wander off, resume where you left                        | ☑      | viewer explore mode ("Back to step")   |
| TO-8  | Present mode: fullscreen, no editing UI, keyboard-driven                           | ☑      | e2e present mode                       |
| TO-9  | Authoring by clicking elements in order in a tour panel; add choices; no scripting | ☑      | e2e "authoring a tour"; core test      |
| TO-10 | Many tours per diagram, listed for viewers                                         | ☑      | viewer tours menu; tours panel         |
| TO-11 | Every tour step has a deep link                                                    | ☑      | deep-link tests; e2e tour URL          |

## NE — Nested diagrams and zoom

| ID    | Requirement                                                                | Status | Evidence                                           |
| ----- | -------------------------------------------------------------------------- | ------ | -------------------------------------------------- |
| NE-1  | A subfolder is its own diagram; a component opens it with `opens:`         | ☑      | core nested tests; e2e nested editing              |
| NE-2  | Nesting to any depth; loops refused with an explanation naming the folders | ☑      | core nested tests (loops named)                    |
| NE-3  | Nested diagram declares named ports mapping to inner elements              | ☑      | core nested tests                                  |
| NE-4  | Parent connections attach to ports by name (`aks.web`)                     | ☑      | core nested tests; AKS template                    |
| NE-5  | Inside, parent neighbours appear as faded stubs at the edge, labelled      | ☑      | e2e stubs; levels test                             |
| NE-6  | Zoom: icon grows into a frame, camera pushes in, inner diagram fades up    | ☑      | one continuous zoom, editor and viewer (D-56)      |
| NE-7  | Traffic dot can follow flow through into the nested diagram                | ☑      | stubs carry the parent traffic (viewer and editor) |
| NE-8  | Breadcrumbs; Escape zooms out one level                                    | ☑      | e2e "Back to …", breadcrumbs, Escape               |
| NE-9  | Every level has its own deep link                                          | ☑      | e2e `level=` deep link                             |
| NE-10 | Nested diagrams load lazily                                                | ☑      | viewer loads levels on first visit                 |
| NE-11 | Parent component down → everything inside its nested diagram down          | ☑      | core state tests; levels test                      |
| NE-12 | Something broken inside → parent component shows degraded                  | ☑      | core state tests                                   |
| NE-13 | Many components can open the same folder (blueprint); state per instance   | ☑      | core nested tests                                  |
| NE-14 | Scenes belong to the diagram telling the story                             | ☑      | levels test; e2e nested scenes in the editor       |

## FI — Files and repositories

| ID    | Requirement                                                                           | Status | Evidence                                               |
| ----- | ------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| FI-1  | Human names, never random IDs                                                         | ☑      | core format tests                                      |
| FI-2  | Presets referenced by name, never expanded                                            | ☑      | core edit tests                                        |
| FI-3  | Only non-default values written                                                       | ☑      | core edit tests; e2e tour YAML                         |
| FI-4  | Architecture at the top; coordinates in a layout section or file                      | ☑      | core format and edit tests                             |
| FI-5  | Hand edits survive: comments and entry order preserved on save                        | ☑      | core edit tests; e2e YAML comment kept                 |
| FI-6  | `.mogram` and `.mogram.yaml` supported; save as `.mogram.yaml`; default `mogram.yaml` | ☑      | core format tests; e2e open file                       |
| FI-7  | Single file or folder; every Mogram file in a folder adds to the diagram              | ☑      | core format tests                                      |
| FI-8  | `mogram.yaml` marks the folder and holds settings                                     | ☑      | core format tests                                      |
| FI-9  | Unique names across files; duplicate error names both files                           | ☑      | core format tests                                      |
| FI-10 | Single file: layout at the bottom; folder: `layout.mogram.yaml`                       | ☑      | core format and edit tests                             |
| FI-11 | Subfolders are nested diagrams; `docs/` for card markdown; `icons/` for uploads       | ☑      | core format tests; AKS template                        |
| FI-12 | New elements land in the file of their container, else `mogram.yaml`                  | ☑      | core edit tests                                        |
| FI-13 | Inspector shows each element's file, with "move to file"                              | ☑      | inspector file row and "move to file"; core edit tests |
| FI-14 | Mogram never reshuffles elements between files                                        | ☑      | core edit tests                                        |
| FI-15 | Edit YAML directly; Mogram picks up changes                                           | ☑      | e2e YAML editing                                       |
| FI-16 | Invalid files show plain-language errors pointing at file and line                    | ☑      | e2e YAML problem; core diagnostics tests               |

## SH — Sharing and the viewer

| ID   | Requirement                                                                               | Status | Evidence                        |
| ---- | ----------------------------------------------------------------------------------------- | ------ | ------------------------------- |
| SH-1 | Share link opens the live interactive diagram, no sign-up                                 | ☑      | e2e cloud share journey         |
| SH-2 | Viewer: pan/zoom, open cards, step/play scenes, take tours (explore/present), nested zoom | ☑      | e2e viewer suite                |
| SH-3 | Advanced share option lets viewers change state (off by default)                          | ☑      | e2e "what if"; API test         |
| SH-4 | Deep links to scene, card, tour step, nested level                                        | ☑      | e2e deep links; deep-link tests |
| SH-5 | Share link always shows the latest saved version                                          | ☑      | API test (latest save)          |

## EX — Export

| ID   | Requirement                                             | Status | Evidence                                |
| ---- | ------------------------------------------------------- | ------ | --------------------------------------- |
| EX-1 | PNG (default static), optional transparent background   | ☑      | e2e PNG (signature checked)             |
| EX-2 | JPEG                                                    | ☑      | e2e JPEG                                |
| EX-3 | SVG                                                     | ☑      | e2e SVG (fonts embedded, no scripts)    |
| EX-4 | GIF when the diagram has animation                      | ☑      | e2e GIF (GIF89a, loops)                 |
| EX-5 | Animated WebP (advanced)                                | ☑      | e2e animated WebP; muxer tests          |
| EX-6 | Loop the current scene, or play through scenes in order | ☑      | export dialog "This scene / All scenes" |
| EX-7 | Seamless loops                                          | ☑      | 4s loops; GIF and WebP loop forever     |
| EX-8 | Export the top level or any nested level                | ☑      | export uses the current level           |

## AC — Accounts, pricing and trust

| ID   | Requirement                                                                     | Status | Evidence                                                                |
| ---- | ------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| AC-1 | Editor works with no account                                                    | ☑      | e2e drafts without an account                                           |
| AC-2 | Without an account: open Mogram files from the computer, download work as files | ☑      | e2e open file; downloads                                                |
| AC-3 | Account needed for cloud save, share links, uploaded icons in the cloud         | ☑      | e2e cloud journey; API tests                                            |
| AC-4 | Own backend and database                                                        | ☑      | API tests; e2e conflict                                                 |
| AC-5 | Diagrams private by default until shared                                        | ☑      | API tests (404 for others, private by default)                          |
| AC-6 | Clear explanation of where diagrams are stored and who can see them             | ☑      | `/security` page; share dialog notes                                    |
| AC-7 | Security is a first-release requirement                                         | ☑      | docs/security.md; API, sanitiser and markdown tests; production CSP run |

## UX — Non-functional (from the build brief)

| ID   | Requirement                                                           | Status | Evidence                                   |
| ---- | --------------------------------------------------------------------- | ------ | ------------------------------------------ |
| UX-1 | UI matches Eden: branding, feel, colour, gradients                    | ☑      | docs/screenshots; design review            |
| UX-2 | Works on all screen sizes                                             | ☑      | e2e pages at 390/834/1280/1440             |
| UX-3 | No broken pages or functions                                          | ☑      | 66 e2e journeys, no console errors         |
| UX-4 | Diagram editing is smooth: move, arrange, z-order, background, export | ☑      | e2e move, z-order, background, export      |
| UX-5 | Clean, secure codebase with strict UI discipline                      | ☑      | lint, typecheck, check:ui, security review |
| UX-6 | Every feature tested and screenshotted                                | ☑      | docs/screenshots (every page and state)    |
