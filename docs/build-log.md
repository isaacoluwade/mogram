# Build log

Chronological record of how Mogram was built: what was done at each step, how it was verified,
and which decisions were made (decisions are detailed in `decisions.md`).

## Step 0 — Research and planning (2026-10-03)

**Read the PRD end to end.** Extracted every requirement into `requirements.md` with IDs
(ED, IC, PR, SC, CA, TO, NE, FI, SH, EX, AC, UX) so work and tests can be traced back to it.

**Studied the sample app** (`sample-app/`): Next.js 16 + React 19 + Tailwind v4 + Clerk +
Supabase, design tokens bridged into Tailwind, security headers in `next.config.ts`, a
`proxy.ts` auth gate, feature CSS files. Patterns kept: tokens bridged into Tailwind, security
headers, server-only modules. Patterns improved on: business logic mixed into one giant
`lib/` folder (Mogram separates a pure `@mogram/core` package and feature folders), per-feature
CSS files (Mogram keeps visual decisions inside UI primitives), no tests (Mogram tests every rule).

**Analysed all 80 screenshots** in capture order; notes per screenshot with an implementation
plan are in `research/screenshot-notes.md`:

- 01–33 Cloudairy board editor: floating-card chrome, bottom creation toolbar with shortcut
  letters, right-hand tool rail, background popover, version history, export bar with aspect
  presets, shape library browser, share dialog.
- 34–41 Ilograph: breadcrumbs, perspective tabs, click-to-expand resources, walkthrough with
  deep-linked steps and focus dimming.
- 42–80 Eden: marketing site, pricing, comparison pages, marketplace, creator store, downloads,
  sign-in.

**Extracted Eden's design system from source.** Pixel sampling of the screenshots matched
Tailwind's neutral scale, so Eden's live CSS and HTML were fetched (`eden.so`) and read. The hero
contains a real HTML mock of the Eden app, which gave exact app-chrome classes (sidebar, rows,
chips, segmented control, search, cards). Result: `research/eden-design-system.md` — fonts
(Inter body, Geist 500 headings, Instrument Sans wordmark), tokens (`page #0a0a0a`, `card #141414`,
`surface #1a1a1a`, borders `white/8` and `white/4`, text `#f5f5f5 / #a3a3a3 / #737373`, brand green
`#5c9776`), radii, shadows, motion curves and component recipes.

**Checked the environment.** Node 23.9, pnpm, npm registry reachable, Docker installed but daemon
stopped, Homebrew Postgres 14 installed but stopped. Latest packages checked on npm (Next 16.3.8,
React 19.3, Tailwind 4.3, zod 4.6, Better Auth 1.7, Drizzle 0.45, PGlite 0.5, Vitest 5,
Playwright 1.63). TypeScript 7 is current but typescript-eslint supports `<6.1`, so 5.9.3 is pinned.

**Decided the architecture** (`architecture.md`, decisions D-1 to D-14): Next.js 16 monorepo, a
pure `@mogram/core` package, custom SVG renderer driven by one clock, YAML documents as the source
of truth with comment-preserving commands, PGlite locally and Postgres in production, Better Auth
email codes, REST route handlers, Tailwind v4 restricted to Eden tokens, Radix + cva primitives.

**Wrote the file-format contract** (`file-format.md`) and the engineering standards every change
(and every agent) must follow (`engineering-standards.md`).

## Step 1 — Monorepo and `@mogram/core` (2026-10-03)

**Workspace.** pnpm workspace (`apps/*`, `packages/*`; `sample-app/` deliberately excluded) with
Turborepo delegating `build`, `lint`, `typecheck`, `test`, `check:ui` to each package. Strict
`tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax`). Prettier, EditorConfig, `.gitignore` for build output, local data and env
files.

**`@mogram/core`** — pure TypeScript, only dependency `yaml`. Purity is enforced two ways: the
`src` tsconfig has no ambient types (no DOM, no Node), and ESLint forbids `window`, `document`,
`Date.now()` and `Math.random()`. Tests get Node types through a separate `tsconfig.test.json`.
Lint uses `typescript-eslint` strict type-checked rules.

| Module     | What it does                                                                                                                                                 | Requirements                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| `model`    | Types in PRD vocabulary; name rules, humanised labels (`web_vm` → "Web VM"), unique names; project paths                                                     | FI-1                              |
| `presets`  | State, flow, motion, container style, canvas theme data. Colours are Eden's own tints                                                                        | PR-1…PR-6, ED-8, ED-14            |
| `format`   | YAML → model with positions; single-file and folder mode; one namespace across files; plain-language errors with file, line and "Did you mean"; never throws | FI-6…FI-11, FI-16                 |
| `layout`   | Grid units → pixels, positions relative to parent, container auto-size, traffic-ordered auto-placement of unpinned elements, group outlines, z-order         | ED-9…ED-15, ED-23                 |
| `routing`  | Orthogonal routing around obstacles (sparse ruler grid + A* with bend cost), hand-bent waypoints, curved and straight styles, path sampling, route cache     | ED-17, ED-18                      |
| `state`    | Base → scene → viewer layers, cascade, softened worst-wins roll-up, endpoint blocking, `backup_for` rerouting                                                | SC-1…SC-4, SH-3, journeys 2 and 8 |
| `timeline` | Motion and flow as pure functions of `t`; all periods divide 4s; scene transition easing; colour mixing; story playback                                      | PR-7, PR-9, SC-7, SC-9            |
| `tours`    | Start, main path, reachable steps, cursor with history for Back, branching                                                                                   | TO-3, TO-6, TO-7                  |
| `nested`   | Lazy loader, loop detection naming the folders, port checks, stubs, breadcrumbs, per-instance state                                                          | NE-1…NE-14                        |
| `edit`     | Every editing command, writing YAML with minimal diffs                                                                                                       | ED-*, FI-3, FI-5, FI-12…FI-14     |

**Decision — minimal-diff writing (D-15).** Re-printing a YAML document with the `yaml` library
keeps comments and order but normalises spacing (inline comment gaps, brace padding), which turns
a one-line change into a noisy diff. Instead each edit prints the document before and after with
the same options, diffs those prints (Myers), and applies only the changed lines to the original
text; untouched lines keep their exact bytes. Tests prove that moving an element, changing a scene
line, or adding a property each produce a one-line diff on a hand-written file with odd spacing,
quotes and comments.

**Bugs found by tests and fixed.**

- Waypoint routes entered the target by running along its edge. `routeThrough` now leaves and
  enters perpendicular to each side and keeps the previous direction at corners.
- The patcher indexed the wrong side of the before/after diff (caught by the type checker).
- Nested point lists printed as `[ [30, 10] ]`; the normaliser now tightens them.

**Verification.** `pnpm typecheck`, `eslint .` and `vitest run`: 86 tests across format, layout and
routing (including a 60-element performance check), state, timeline (every preset proven to loop
seamlessly over 4s), tours and nested diagrams, and edit commands.

## Step 2 — `@mogram/icons` (2026-10-03)

The icon catalogue as data: 638 official Azure architecture icons, 67 generic glyphs (users,
browsers, phones, servers, databases, queues, …) and 48 tool logos (Kubernetes, Redis, Grafana,
Prometheus, Fluentd, …), each with a stable id (`azure/virtual-machine`), category and aliases.
One search ranks across every library (`vm` → Virtual Machine) (IC-1 … IC-3, IC-5). Libraries
are data, so AWS or GCP can be added later without code (IC-7). A build script copies the SVGs
into the app's `public/icons` (`scripts/sync-assets.mjs` runs before `dev` and `build`).
Later in the build, short ids such as `azure/aks` (used in the PRD's own examples) were mapped
to catalogue ids (D-24). Verified by 67 tests (catalogue integrity, search ranking, lookup).

## Step 3 — Web foundation (2026-10-03)

Next.js 16 app with Tailwind v4 restricted to Eden's tokens (`styles/tokens.css`, default palette
removed, D-8), Inter/Geist/Instrument Sans/Geist Mono self-hosted (D-10), and the design-system
primitives in `components/ui` (button hierarchy, icon buttons with required tooltips, chips,
segmented control with a sliding thumb, menus, dialogs, select, switch, slider, panel, sidebar,
badge, empty and status pages) built on Radix + cva (D-9). `pnpm check:ui` fails the build on raw
colours outside the design system. Security headers in `next.config.ts` and a per-request CSP
nonce in `src/proxy.ts`.

## Step 4 — Backend: database, accounts and the REST API (2026-10-03)

Drizzle schema and migrations for users, sessions, verification codes, diagrams and revisions;
PGlite locally (zero setup), any Postgres via `DATABASE_URL` (D-5). Better Auth with email
one-time codes (D-6); a development mailbox so sign-in works without an email provider. REST
route handlers with zod contracts shared by client and server (D-7): create, list, read, save with
optimistic concurrency (409 on a stale version), rename, delete, duplicate, share settings,
revisions and restore, public share reads. Ownership is checked on every route and private
diagrams answer 404 (AC-5). SVG files are sanitised on the server. Verified first with curl, later
by 16 route-handler tests against in-memory PGlite (`test/api.test.ts`).

## Step 5 — The renderer (2026-10-03)

One SVG per diagram (D-3), driven by a single clock (PR-9): `buildScene` turns the parsed
diagram, layout, routes and resolved state into a scene model; every animated value is a pure
function of `t` (`frames.ts`), so the live canvas, thumbnails and exports always match. Icons are
drawn as `data:` images (safe for uploads, identical in exports). Scene changes tween numeric
"looks" over 600ms (SC-7). Container roll-up is shown quietly (a small badge, not a red frame).
Checked visually on the Checkout template's normal, outage and spike scenes.

## Step 6 — The editor (2026-10-03)

A Zustand store per editor instance holds the files (the document), history (file snapshots),
selection, tool, camera and in-progress gestures; every gesture commits one YAML command on
pointer-up, so one gesture is one undo step and one small diff (D-4, D-15). Built: pan/zoom with
wheel and pinch, select/marquee/shift-click, move with snapping and reparenting into containers,
resize, connect by dragging, bend connections with waypoint handles, text/label/zone/container
tools, copy/cut/paste/duplicate, align/distribute, group, z-order (ED-23), context menu,
keyboard shortcuts (ED-7), inline label editing. Panels: icon library with search and SVG upload
(IC-4), inspector with presets behind "Advanced" (ED-20, ED-21, PR-8), card editor (CA-2, CA-3),
YAML code panel with live diagnostics (FI-15, FI-16), scene strip with thumbnails (SC-6) and
playback (SC-9), tour authoring by clicking elements (TO-9), breadcrumbs for nested levels.

## Step 7 — Export (2026-10-03)

`features/export`: a static render at time `t` with Inter and Geist embedded as `@font-face`,
rasterised through a canvas. PNG (optional transparency), JPEG, SVG, GIF (encoded in a Web Worker
with `gifenc`, looping forever) and animated WebP (each frame encoded by the browser, then muxed
into VP8X/ANIM/ANMF chunks by `webp-mux.ts`). Area presets (fit, 1:1, 4:5, 16:9, 4:3), scale,
loop-this-scene or play-all-scenes, 10/20/25 fps; every loop is exactly 4s (or 4s per scene), so
files loop seamlessly (EX-7). The dialog shows a live preview of the exact frame.

## Step 8 — Dialogs and the editor shell (2026-10-03)

Share (local drafts explain where they live and offer "Save to my account"; cloud diagrams get
access, link, "what if" switch, reset link and a deep-link builder), keyboard shortcuts generated
from the same table as the key handler, version history with preview and restore, and "Open
files". The shell places Eden-style floating chrome: bars top-left/right, tools top-centre (bottom
below 1024px), library left, inspector/code/tours right, scenes bottom-centre, zoom bottom-left;
panels become bottom sheets on phones, and only one side panel opens below 1100px.

## Step 9 — Persistence (2026-10-03)

Browser drafts in IndexedDB (files and thumbnails in separate stores), the cloud host with
autosave, version tracking and a conflict banner ("Load newer" / "Keep mine"), thumbnails
rendered after saves (D-22), `beforeunload` protection, and a final save when the editor closes.
Draft → account upload signs in first when needed.

## Step 10 — The viewer (2026-10-03)

`features/viewer` (D-23): pan/zoom, cards that zoom the camera beside them (CA-1), card links that
ride the connection's route (CA-4), tours whose camera follows the traffic path between steps
(TO-2) with scene changes (TO-3), branching choices (TO-6), explore mode with "Back to step"
(TO-7) and present mode (fullscreen, keyboard-driven, a start panel listing tours) (TO-8), nested
zoom where the icon grows into the inner diagram (NE-6) with breadcrumbs and Escape (NE-8),
faded stubs for the parent's neighbours carrying the parent's traffic (NE-5, NE-7), viewer
"what if" states when the owner allows them (SH-3), and deep links kept in the URL (SH-4).

## Step 11 — Pages (2026-10-03)

Landing page in Eden's marketing structure (two-tone typed headline, checklist, a live diagram
that plays its scenes, four numbered feature sections with live visuals, template cards, closing
CTA, footer with a trademark notice), sign-in matching Eden's "Enter the garden" screen, the
dashboard in Eden's app shell (floating sidebar, page header, search with a segmented filter,
marketplace-style diagram cards, live template cards), `/security`, `/docs/format` (D-29),
not-found pages (including a share-specific one that never reveals whether a diagram exists), and
error pages.

## Step 12 — Templates and diagram quality (2026-10-03)

Three templates beyond blank: a three-tier web app (scenes, cards, a branching tour), microservices
on AKS (a nested `aks/` folder with ports, scenes reaching inside it, a tour that dives in) and
region failover (a whole region going down with traffic rerouting through `backup_for`). Rendering
them exposed overlapping connections at busy elements, fixed by spreading ends along shared sides
(D-25). Each template is checked by a test for diagnostics and catalogue icons.

## Step 13 — Testing (2026-10-03)

- `@mogram/core`: 95 tests. `@mogram/icons`: 67. Web unit, component and route-handler tests: 73.
- Playwright, against the running app in the installed Chrome (D-30): 37 journeys across editor,
  editing, export, viewer, cloud and pages, plus every page at 390, 834, 1280 and 1440px (no
  sideways scroll, no console errors) — 66 tests in total. Screenshots of every page and state are
  written to `docs/screenshots/` (63 images).

**Bugs the tests found, all fixed with a test that fails without the fix:**

- Connecting by dragging never connected, and double-click didn't open nested diagrams: the
  canvas captured the pointer on press, so every event targeted the canvas (D-26).
- Tour authoring wrote steps as a single inline map with empty placeholder entries; it now writes
  the documented block format (D-27).
- New connections were written in block style inside files whose connections are one-liners
  (D-27).
- Zips made on macOS opened one folder too deep, because their `__MACOSX` folder defeated the
  folder-root detection.
- The share viewer's server-rendered SVG didn't match the client's first render (the animation
  clock differs); animated canvases now render after hydration.
- Tablets opened both side panels, leaving no canvas and squeezing the scene strip; the zoom-to-fit
  ignored open panels; the scene strip didn't shrink.
- Card bodies read from markdown files kept a blank first line.
- The production build traced the whole project because of the database path; production CSP sent
  `upgrade-insecure-requests` even over plain HTTP.

## Step 14 — Production build (2026-10-03)

`next build` completes with no warnings. The full browser suite (editor, editing, export,
viewer, pages — 62 tests) was run against `next start` with the production CSP
(`E2E_BASE_URL=http://localhost:3200`); all pass, including the GIF worker under
`worker-src 'self' blob:`.

## Step 15 — Four reviews, and what they changed (2026-10-03)

Four independent reviews were run against the finished app, each by a separate agent: security,
code quality, visual fidelity to Eden (every page at 390, 834, 1280 and 1440px, measured against
Eden's own HTML and CSS), and a hands-on QA pass through every editor and viewer function. Every
finding was either fixed with a test or recorded as a decision with its reason. The working list
lived in the session's review checklist; the outcomes are below.

**Security** (`docs/security.md`, D-35): auth narrowed to the five endpoints Mogram uses; a
per-address sign-in throttle in Postgres that rotating IPs can't get around; per-IP limits only
trust a configured proxy header; request bodies capped while streaming (413); cross-site writes
refused (403); development conveniences only on a non-production localhost; the server refuses to
start without its secret or email key; YAML/markdown capped at the 1 MB the parser reads; drag
payloads validated; the diff writer bounded so a huge paste can't stall the tab.

**Editor and viewer behaviour** (QA findings):

- Z-order reworked (D-31): containers are stacking contexts, the paint order follows them, moves
  step exactly one place, and moves that would change nothing are disabled. Arrange is also in
  the inspector, and ⌘⌥] / ⌘⌥[ work by physical key.
- The hover halo no longer steals clicks from an element drawn on top of the hovered one.
- YAML with a syntax error keeps the last good diagram on screen, with a banner (D-32).
- Long-press on touch opens the menu for what was pressed; one finger pans; the phone toolbar
  keeps Undo/Redo in reach; sheets keep the selection visible; phones fit at a readable zoom
  (D-34).
- Breadcrumbs moved out from under the library panel; closing Code or Tours brings the inspector
  back.
- A quick flick still moves; containers can't be shrunk below their contents; colour dragging is
  one undo step; `#fff` is accepted; Escape leaves present mode; ⌘-wheel zooms ~22% per notch.
- New scenes are selected by the name they were given (D-37); tours can't loop back by clicking;
  connection labels stay off component names (D-41).

**Code quality:** autosave failures reported (permanent errors not retried, 401 explained); the
save-to-account race closed; every unhandled promise found and handled, then enforced by
type-aware lint (D-42); the icon cache joins loads in flight and retries failures; GIF export has
a bounded queue, honest progress and cancellation; per-instance SVG ids; reduced motion paused by
default but playable (D-33); heavy parts loaded on demand (D-39); panel sizes shared between CSS
and TypeScript; dead code and three unused dependencies removed; database writes for create and
restore made transactional, and restore brings the name back.

**Visual fidelity to Eden** (D-21): the landing page's lighting, headline sizes, checklist,
eyebrows, product frames, white pill calls to action, footer and doc pages; the sign-in page's
measured spacing, dimmed pill and grain; segmented controls, chips, sidebar rows, dialogs with
pinned actions, shortcut rows, edge fades on scrolling strips and larger touch targets. A
`cn()` drift test now keeps every size token known to tailwind-merge, after one new token silently
dropped a text colour.

**Structure:** editor-only panels and dialogs moved inside the editor feature, drafts became a
feature of their own, and lint now enforces the boundaries (D-43); the 1,189-line YAML reader was
split into section readers, the 1,074-line inspector into one file per inspector, and the canvas
gestures' geometry into its own module; duplicated logic (nested-level walks, scene stepping,
phone width) now lives in one place each; unchecked casts were replaced with type guards; the
first version of a diagram is always kept in history (D-44); the server checks its configuration
at start-up (D-45); alert banners share a `Banner` primitive.

**Accessibility:** the viewer works from the keyboard (D-40); icon-only buttons on phones have
names; export progress is a real progressbar; code-panel file tabs use the tabs primitive (arrow
keys); compact inputs show focus.

**Verification at the end of this step:**

- `pnpm lint`, `pnpm typecheck`, `pnpm check:ui`, `pnpm format:check`: clean.
- Unit, component and route tests: `@mogram/core` 130, `@mogram/icons` 70, web 138 — 338 in total.
- Browser suite (9 spec files): 93 tests against the development server; the 89 that don't need
  the development mailbox also against `next start` with the production CSP. Each fix above has a
  browser, component or unit test; the phone fit's minimum zoom is covered at the `fitBox` level
  and seen in the phone screenshots. The hover-halo test was checked to fail without its fix, and
  fixed sleeps in the suite were replaced with waits on real state where one exists.
- `next build`: no warnings. A production start without `RESEND_API_KEY` stops with a clear
  error, as intended.
- Screenshots in `docs/screenshots/`: 79.

## Step 16 — AWS, Google Cloud and Kubernetes icons (2026-10-03)

**What was there.** The Azure library came from Microsoft's pinned V24 download and was cleaned
properly, but 142 icons Microsoft files only under "other" or "new icons" (Container Apps, Private
Endpoints, Prometheus among them) sat in a catch-all section. They now have their Azure product
areas; six codenames with no public product remain in Other (D-50).

**New libraries** (D-46), each from the vendor's own download, pinned by hash and cleaned by the
same pipeline as Azure:

- **AWS** (807): the July 2026 Architecture Icons package, with services at their 48px size,
  resources, general icons, group icons and category icons, in AWS's 24 categories. AWS's short
  names and vendor-free slugs (`aws/s3`, `aws/lambda`) (D-48). The single-colour general icons
  and the dark-square AWS Cloud, logo and Marketplace icons follow the canvas theme instead of
  shipping light and dark copies (D-49).
- **Google Cloud** (230): Google's current system, with 19 core product icons and 26 category
  icons, plus every product Google's guide lists, drawn with its category's icon as Google
  directs. The retired two-tone icons are left out (D-47).
- **Kubernetes** (39): the community icon set at a pinned commit, named after Kubernetes kinds.

Each library ships a `LICENSE-NOTICE.md` quoting its vendor's terms, and the site footer names
each trademark. The cleaner gained Inkscape and Illustrator handling (text styles, filters, link
wrappers, editor namespaces, empty groups) and two glyph conversions. The generated catalogue is
split into chunks so TypeScript can still check it, and a glyph list lets the canvas colour any
library's glyphs, not just generic ones.

**Motion.** Nothing per icon is needed or wanted: the PRD keeps motion on the whole icon, and
every preset (pulse, bounce, rotate, shake, glow) and every state look applies to the tile, so
all 1,829 icons animate the same way. A browser test plays each motion on an AWS icon. Rotate
still turns vendor artwork; the legal flag in D-20 now covers AWS and Google Cloud too.

**Editor.** The library panel lists each library as a chip (two rows, all visible), offers the
libraries a diagram's `libraries:` setting names, opens on the cloud the diagram is drawn in, and
ranks that cloud's icons first in search. Three templates use the new libraries: a serverless API
on AWS (with AWS group icons on its containers), an event pipeline on Google Cloud and a web app
on Kubernetes. Session reads are no longer counted by the auth rate limit, which a busy page (or
an office sharing an IP) could exhaust.

**Verification at the end of this step:**

- `pnpm lint`, `pnpm typecheck`, `pnpm check:ui`, `pnpm format:check`: clean.
- Unit, component and route tests: `@mogram/core` 130, `@mogram/icons` 103, web 150 — 383 in
  total. The icon tests check every shipped SVG in every library (safe, no editor leftovers,
  glyphs only in `currentColor`, ids scoped and resolvable) and every template parses with no
  diagnostics at all.
- Every new icon was also drawn in Chrome on a light and a dark canvas: none broken.
- Browser suite (10 spec files): 100 tests against the development server; the 96 that don't
  need the development mailbox also against `next start` with the production CSP. The new
  `providers` spec covers the default library per diagram, search and add across providers,
  every motion preset on an AWS icon, glyph colouring on container headers, the `libraries:`
  setting and the template gallery.
- `next build`: no warnings. The catalogue chunk is 42 KB compressed and loads only when the
  library opens.
- Screenshots in `docs/screenshots/`: 86.

## Step 17 — Fields that save as you type, a grid for every background (2026-10-04)

- **Inspector spacing.** A connection's From and To fields touched; stacked field rows now share
  the same spacing as the Advanced section's (`FieldStack`).
- **Saving.** Text fields save as you type, one undo step per visit, Escape to take it back, and
  names are checked as they are typed (D-51). Clicking the canvas mid-word no longer loses the
  text.
- **Grid and custom backgrounds** (D-52): the grid shows on every theme and on any custom colour,
  and a custom colour picks its own light or dark palette so labels stay readable.
- Browser tests type the way people do, without pressing Enter, and check the field still has
  focus when the rename lands; the grid test checks the dot colour on a dark theme, a light theme
  and a light custom colour.

## Step 18 — Colours, sticky notes, a quick-edit bar, nested zoom and preview (2026-10-04)

- **Colour** (D-53): one paint model for every colour — hex with optional opacity, or a linear or
  radial gradient — and one Canva-style picker: search by name or hex (Enter takes the first
  match), colours in this diagram, recents, eyedropper, solid and gradient tabs with five styles,
  a custom editor with opacity, and full palettes and gradient groups behind "See all". The
  background takes gradients; the grid takes its own colour and opacity.
- **Sticky notes and rich text** (D-54): a Sticky note tool (N) places a note and opens it for
  typing in place; notes and free text take `**bold**`, `*italic*` and lists, plus font (Inter,
  Geist, Instrument Sans, Geist Mono), size (notes fit their words automatically), bold, italic,
  alignment and colours. Notes resize like zones. Exports embed the fonts a diagram uses.
- **Quick-edit bar** (D-55) over the selection: fill, font, size, emphasis, alignment, list and
  text colour for notes and text; state, motion, colour and "open nested" for components; flow
  for connections; tone for labels and zones; and a More menu.
- **Nested diagrams** (D-56): going in and out is one continuous zoom through the component's
  tile, in the editor and the viewer; "Back to <parent>" (and Escape) is always in sight,
  including in present mode. In the editor the top diagram's scenes now reach nested levels as in
  the viewer, and states set inside are written to the top scene by path.
- **Checkout looked broken**: the scaling state's ring crossed the ghost tiles behind it; the ring
  now encloses the whole stack and the badge sits on its corner.
- **Preview** (D-57): a Preview button (Shift+P) opens the viewer at the level and scene being
  edited, marked "Preview" with "Back to editor".
- **Navigation review**: sign-in now offers "Continue without an account"; a preview's logo says
  where it goes; the tours panel inside a nested level explains that tours belong to the top
  diagram and links back; Breadcrumbs gained the back button.

**Verification at the end of this step:**

- `pnpm lint`, `pnpm typecheck`, `pnpm check:ui`, `pnpm format:check`: clean.
- Unit, component and route tests: `@mogram/core` 159, `@mogram/icons` 103, web 169 — 431 in
  total. New: paint and palette parsing, sticky notes (format, edits, sizing, ink), nested-zoom
  geometry, rich-text parsing and layout.
- Browser suite (15 spec files): 117 tests against the development server; the 113 that don't
  need the development mailbox also against `next start`. New specs: `notes`, `colors`,
  `nested`, `navigation`.
- `next build`: no warnings.
- Screenshots in `docs/screenshots/`: 104.

## Step 19 — The editor rebuilt from a study of draw.io (2026-10-04)

**Studied draw.io's source** (`drawio/`, cloned locally): its architecture, connectors, shapes
and library, format panel, menus and commands, canvas gestures and document workflow, each
written up with file and line references in `docs/research/drawio/01`–`07`, measured against
Mogram (`00`) and turned into a plan of six milestones (`08-gap-analysis.md`). Every item in it
is now done.

- **M1 — Connectors** (D-59 – D-63): arrowheads per end from a curated set (filled, outline, ER
  ends) with a size; line pattern, width, rounded or sharp corners and line jumps; bends on every
  route, added by dragging a segment's midpoint and removed when they do nothing; fixed ends and
  label places in the layout; bends follow moved elements; dropping a component on a connection
  splits it.
- **M2 — Commands** (D-64, D-65): one registry of commands behind the keyboard, the context menu
  for each kind of selection, the command palette (⌘K or /), the Diagram menu and the shortcuts
  list; Find (⌘F); lock; paste in place; copy and paste style; copy as image; resize with keys.
- **M3 — Inspector** (D-66): Element, Style and Arrange tabs remembered per mode; folding
  sections remembered per kind; true mixed values; position and size fields; an All properties
  grid; a resizable panel.
- **M4 — Shapes and library** (D-67, D-71): eleven outlines from one geometry registry (drawn,
  hit-tested, connected and exported the same way), tones, fill, outline, corners, shadow,
  opacity and label styling; one adjustable measure per shape with a diamond handle; Shapes,
  Containers and Annotations first in the library, with search across shapes and icons.
- **M5 — Canvas** (D-68, D-70): alignment, spacing and size guides; hover arrows that add a
  connected copy; quick add by double-click; copy by dragging; a minimap; locking; a touch
  threshold.
- **M6 — The document** (D-69, D-70): undo returns to the level of the change; links and data
  on any element, with `%key%` placeholders and diagram-wide data; PNG and SVG exports that open
  again as the diagram; PDF; Tidy up; one preferences store; Find across nested diagrams; named
  styles.
- **Organisation** (D-72): the quick bar declared in one table per kind of selection, with "More
  in inspector"; big library sections draw their tiles as they scroll in.

Bugs found on the way and fixed: a selected shape's resize handles sat under its own hover ring;
"?" opened the palette through the "/" key's physical-key fallback; right-clicking a bend
dropped the selection; the quick bar covered a connection's end tiles; typed and arrow-stepped
positions merged into one undo step; the minimap's view could fall off the map.

**Verification at the end of this step:**

- `pnpm lint`, `pnpm typecheck`, `pnpm check:ui`, `pnpm format:check`: clean.
- Unit, component and route tests: `@mogram/core` 205, `@mogram/icons` 104, web 191 — 500 in
  total. New: bend following, copied and named styles, locking, every property, shapes and their
  handles, links, data and placeholders, tidy up, command keys and the registry, smart guides,
  editable exports, preferences, the quick-bar table.
- Browser suite (20 spec files): 163 tests against the development server and the same 163
  against `next start` with fresh throwaway secrets and its own database (the cloud spec, which
  needs the development mailbox, runs separately). New specs: `commands`, `inspector`, `shapes`,
  `canvas`, `document`; `connectors` grew with jumps, following and splitting.
- `next build`: no warnings.
- Screenshots in `docs/screenshots/`: 130.

## Step 20 — Canvas themes with real variety, and a cleaner colour picker (2026-10-04)

- **Colour picker.** The selected swatch's ring was cut off under the search field (the colours
  scrolled in a box with no padding at the top); the box now pads inside, and the panel uses one
  spacing throughout. Gradient swatches showed a second shape inside the circle: their 1px
  border let the gradient repeat underneath, so the rim showed its other end. Swatches, the
  gradient style previews and every swatch face now paint their colour once across the whole
  shape and draw the outline as an inset ring over it (D-73).
- **Canvas themes** (D-73): 20 new themes beside the 10 that stay — Slate; Ocean, Teal, Plum,
  Wine, Olive; Aurora, Twilight, Sunset, Lagoon, Nebula; Blueprint, Chalkboard; Sky, Mint,
  Blush, Lilac, Butter, Dawn, Seafoam — each with its own tiles, borders, lines and labels. The
  Canvas tab shows ten with real variety, each tile previewing a node, a line and a label in the
  theme's colours; "See all" shows all thirty by family, with names, in place.

**Verification at the end of this step:**

- `pnpm lint`, `pnpm typecheck`, `pnpm check:ui`, `pnpm format:check`: clean.
- Unit tests: `@mogram/core` 207, `@mogram/icons` 104, web 191 — 502. New: every theme's labels
  and muted text readable on every colour of its background; every theme in one family; a
  featured set that spans every family.
- Browser suite: 164 tests against the development server (new: "See all" shows every theme
  by family, and a theme picked there joins the first row).
- Screenshots in `docs/screenshots/`: 132.

## Step 21 — A grid that shows the snap grid, and the picker beside the inspector (2026-10-04)

- **Grid** (D-74): every mark is a snap point, in two levels: single cells from 75% zoom up
  (fading out by 60%) and a stronger mark every 10 cells, on the round numbers the Arrange tab,
  the position hint and the YAML use. Zoomed out, only the 10-cell marks remain and the grid
  eases lighter, so a small diagram isn't buried in dots. Dots or lines (like draw.io's), chosen
  in the Canvas tab. Shown by default, and both choices remembered in the browser rather than
  the file.
- **Colour picker** opens beside the inspector, level with its button, instead of over the
  inspector's own controls. In development, Radix's anchor was being taken back by a re-attached
  trigger, so the anchor is renewed each time the picker opens.
- **Custom backgrounds** are named: "Brown · custom", or the preset gradient's name.

**Verification at the end of this step:**

- `pnpm lint`, `pnpm typecheck`, `pnpm check:ui`, `pnpm format:check`: clean.
- Unit tests: `@mogram/core` 207, `@mogram/icons` 104, web 196 — 507. New: grid levels (single
  cells from 75%, fading by 60%; 10-cell marks never closer than 16px; lighter zoomed out),
  grid preferences.
- Browser suite: 165 tests against the development server. New: dots or lines with every line
  on the 8px grid, remembered after a reload; the picker beside the inspector; the custom
  background's name.
- Screenshots in `docs/screenshots/`: 133.

## Step 22 — The library, reorganised; containers by cloud (2026-10-04)

- **Alignment** (D-75): the title bar is as wide as the library below it (they were 269 and
  288 px), and the library's list is padded inside its scrolling area, so its first row and its
  focus ring no longer sit under the search field.
- **Library** (D-75): search across everything, grouped by library; Recent (added lately, then
  what the diagram uses); Basics with Shapes, Containers, Notes and Generic tabs; and Icons, one
  library at a time from a menu (Uploaded is one of them, with the upload button), each
  category a row with a glimpse of its icons that opens in place. The eight filter pills are
  gone. Tiles share one size and wrap long names to two lines.
- **Containers by cloud** (D-75): cloud-neutral kinds named the way the diagram's cloud names
  them, in its nesting order, with the cloud's official group icons. `network` replaces `vnet`
  and `vpc` (both still read); `cloud`, `account`, `public-subnet`, `private-subnet`,
  `security-group`, `scaling-group` and `on-premises` are new. The templates use the new names.

**Verification at the end of this step:**

- `pnpm lint`, `pnpm typecheck`, `pnpm check:ui`, `pnpm format:check`: clean.
- Unit tests: `@mogram/core` 213, `@mogram/icons` 104, web 196 — 513. New: names, icons and
  nesting order per cloud; `vnet` and `vpc` read as `network`; a diagram's cloud from its
  settings or its icons; a new container written with its cloud's icon.
- Browser suite: 166 tests against the development server. New: AWS containers in AWS's names
  and order, a VPC added with its group icon, Azure's names for the same kinds, and the title
  bar lined up with the library; the provider tests drive the library menu and open categories.
- Screenshots in `docs/screenshots/`: 134.

## Step 23 — Version history and the assistant (2026-10-04)

Agreed with the product owner first (plan: `docs/plans/ai-and-history.md`).

- **Version history** (D-76): a panel on the right with versions by day, each with what changed
  ("Added Payments API · removed 1"), who made it and a thumbnail; one version per working
  session; an earlier version on the canvas, read-only, with its changes drawn over it (against
  the version before, or since then) and a banner to restore it (as a new version on top), copy
  it or go back; Bring back for selected elements or scenes; named versions, kept for good;
  drafts keep history in the browser and take it to the account. New core: `@mogram/core/diff`
  and `restoreElements`. Database: revisions gain name, source, label, changes and
  `restored_from_at` (migration 0002).
- **Architecture review** (D-77): `@mogram/core/lint`, shown as Suggestions in the diagram's
  inspector; the templates pass it.
- **The assistant** (D-78 … D-81): a tab beside the Library (✨, ⌘J) that builds and changes the
  diagram with you. Provider-neutral server (Claude, DeepSeek, OpenAI and compatible APIs, and a
  scripted provider), a cached briefing (the whole file format and an example), tools mapped to
  core edits (new `insertYaml` and `nestElements`) with every change checked, questions with
  options and previews, plans, change cards with Show and Undo, selection and @mentions as
  context, Stop, Follow, and the canvas glowing where it works. A turn is one undo step and one
  version; the person's edits wait meanwhile. "Describe what you want to build" on the diagrams
  page starts a diagram the assistant builds. `pnpm eval:ai` measures any provider. Database:
  `ai_usage` (migration 0003), tokens only.
- **Phones**: both top bars fit at 390 px again (the diagram menu was under the right-hand bar);
  Export moves into the diagram menu there, and the save status is shortened.

**Verification at the end of this step:**

- `pnpm lint`, `pnpm typecheck`, `pnpm check:ui`, `pnpm format:check`: clean.
- Unit tests: `@mogram/core` 229, `@mogram/icons` 104, web 233 — 566. New: what changed between
  versions and bringing things back; history rules; the review's rules; adding YAML snippets
  and nesting; the tools (refused breaks, unknown icons with the closest real ones, asking
  before big removals, replay matching the server); providers' wire formats and streams; the
  turn loop (changes, questions, plans, a refused change fixed, stop, provider failure); the
  route; limits; scripted evaluations; a turn as one undo step.
- Browser suite: 180 tests against the development server (scripted assistant); 175 against a
  production build (`next start`, everything but the `cloud` journeys, which need the
  development mailbox). New: version history for drafts and the cloud, a draft's history going
  to the account, suggestions, the assistant (one undo step and one version, questions answered
  by number, plan then build, edits waiting and Stop, pointing at things, describe a diagram).
- Real model calls weren't run: this environment has no provider key. `pnpm eval:ai` runs them
  once one is set.
- Screenshots in `docs/screenshots/`: 140.

## Step 24 — Capacity, scaling and concepts (2026-10-05)

Agreed with the product owner first (plan: `docs/plans/capacity-and-concepts.md`): scaling
shown from what the diagram says, which anyone can set up on their own elements, not a
one-off animation.

- **Capacity in the format** (D-82): `scale` (copies between a least and a most, or sizes with
  cores, memory and disks), `capacity`, `routing`, `hit` and `queue` on components; `traffic`
  and `share` on connections; and in scenes, `users_to_lb: 5x`, shares, hit rates, and copies or
  a size to hold at. Plain-language diagnostics; written back readably (`3x`, `70%`, a size per
  line); the version diff names them.
- **The engine** (`@mogram/core/capacity`): traffic through the graph (load balancers split,
  calls copy, caches pass only misses, queues hold what their consumers can't take, backups
  take over, down elements pass nothing), the copies or size each element needs, and overload
  from load, as part of state resolution. Traffic is relative: a connection's `traffic`
  multiplies what it carries. A deterministic timeline turns each new plan into motion: copies
  start one after another and leave after a cool-down, newest first; a resize restarts the
  machine and its traffic waits.
- **Drawing**: a scale set (copies with the element's own icon in a frame that grows and shrinks
  inside a faint outline of its most, a ring and a tick as each starts, traffic fanning out to
  every copy, a load bar each); a container holding only it grows and shrinks with it. A machine
  for scaling up (cores light up, memory fills, disks slide in, a restart, a dashed ceiling at
  its largest size). Load bars, queue backlogs and cache hit rates on ordinary components; dots
  follow the traffic. Layout reserves room for the most copies and the largest size. The same
  in the editor, the viewer, thumbnails and exports.
- **Inspector**: Scaling (off, out, up; copies, target, sizes with presets for virtual machines,
  databases and tiers, add and remove sizes) and Traffic (routing, what it handles, cache hit
  rate, queue) on components; Traffic (level, share) on connections. With a scene selected,
  traffic, shares and hit rates are that scene's, and copies or a size can be held there.
- **The inspector explains the scene**: Scaling opens with what the current scene does to the
  element — the traffic reaching it, the copies or size it runs at and why (or that it's at its
  largest and overloaded), and which connection the scene makes busier, one click away; the
  size in use is marked. Under State, where the choice applies (this scene or every scene) and
  why the canvas may show something else (overloaded by its load).
- **Traffic slider** in the editor and, for viewers allowed "what if", in the viewer: 0× to 10×,
  never saved; the viewer's Reset brings it back.
- **Concepts** (D-83): a `concept:` section (summary and roles) makes any diagram a concept. Nine
  built in (horizontal and vertical scaling, autoscaling, scale up vs out, load balancing,
  caching, failover, queue load levelling, canary release). In the library, each opens into a
  dialog that plays its scenes; Apply to your diagram (parts filled from the selection or
  look-alikes), Insert the example, or Open it as a new diagram. Your own concepts: Make it a
  concept in the Diagram inspector, or Make a concept from the selection; drafts and account
  diagrams with a `concept:` section appear under Yours. Roles follow renames and deletes.
- **The assistant**: `set_scaling` and `apply_concept` tools, capacity values in `update_scene`
  and `update_elements`, the format's new sections in its briefing, and a scripted scenario.

**Verification at the end of this step:**

- `pnpm lint`, `pnpm typecheck`, `pnpm check:ui`, `pnpm format:check`: clean. `next build`: no
  warnings.
- Unit tests: `@mogram/core` 267, `@mogram/icons` 104, web 236 — 607. New: capacity in the
  format and written back; the engine (splits, calls, caches, queues, backups, containers,
  relative traffic, a seeded property test that splits never invent or lose traffic and copies
  stay within their bounds); the timeline (staggered starts, cool-down, cancelled starts, resizes);
  scaling presets; concepts (all nine read cleanly and every scene changes something; applying
  to scale out and up, a failover standby joined, keeping what's set and merging scenes,
  refusals, suggestions from the selection; inserting with fresh names; the concept section,
  renames and deletes); the assistant's `set_scaling`, `apply_concept` and scene capacity.
- Browser suite: 188 tests against the development server; 183 against a production build
  (`next start`, everything but the five `cloud` journeys, which need the development mailbox).
  New: a scale set and a machine through a spike and back; the inspector (scaling, sizes,
  presets, traffic, values held in a scene); the traffic slider in the editor and the viewer;
  concepts (watch, apply from the selection, insert, search, your own from a selection, open as
  a new diagram, offered from the account); the assistant setting up scaling.
- Screenshots in `docs/screenshots/`: 154.

## Step 25 — Traffic on the arrow (2026-10-05)

Agreed with the product owner after using Step 24 (plan: `docs/plans/traffic-patterns.md`):
showing scaling took a scaling setting, a scene and switching scenes; "how much traffic" lived in
five places; the floating traffic slider added complexity. Now traffic belongs on the arrow and
can rise and fall on its own (D-84).

- **Traffic patterns in the format**: `traffic: waves` (quiet for half of each cycle, busy for the
  other half), `traffic: bursts` (quiet, with a short burst), or
  `{ pattern, high, low, every }`; `traffic: 2x` stays the steady level. Plain-language
  diagnostics (an unknown pattern with did-you-mean, cycles kept between 4 s and 120 s, quiet and
  busy swapped); written back as briefly as it can be; the version diff names it.
- **Behaviour**: the plan follows the pattern at each change of phase, and the capacity timeline
  follows the plan lazily from the time asked about, so copies start as a wave rises and drain as
  it falls, cycle after cycle, the same in the editor, the viewer, thumbnails and exports, however
  often the picture is drawn (a tab left in the background catches up). An animated export with a
  pattern lasts whole cycles of it and of every motion, starting from its second time round, so
  it loops; capacity counts as something that moves, so GIF and WebP are offered.
- **One Traffic section on the arrow**: flow, how much (Steady, Waves or Bursts, with quiet and
  busy levels and the cycle), a scene's hold-at level, and its share of a split. Dot speed and
  density move to Style as look only. In a diagram that models capacity an idle arrow carries its
  traffic, so it shows as Traffic (in the inspector and the quick bar) and Idle isn't offered.
- **The inspector says what happens over the cycle**: "Traffic reaching it rises and falls
  between 1× and 5×. It runs 2 copies when quiet and 8 when busy (63%)", with the arrow that
  sets it one click away; under State, when busy traffic overloads it.
- **Plain words for the settings**: what one copy takes moved into Scaling ("Each copy takes
  1×"); a component's other traffic settings became **Requests** ("Sends to" all or one of the
  next steps, "Cache" answers, "Queue"), and every field has a line saying what it means. The
  readout says why something stops short of its most copies ("That's all it needs: it would use
  all 12 only with more than 7.7× reaching it").
- **Scaling up without restarts**: a machine grows (or shrinks) smoothly into its new size over a
  second, taking traffic all the while; the restart, its spinner and the pause in traffic are
  gone.
- **The traffic slider is gone** from the editor and the viewer, with its plumbing.
- **Concepts**: horizontal scaling, vertical scaling, autoscaling, scale up vs out, caching and
  queue load levelling use patterns, so their previews play on their own; failover, canary,
  load balancing, a cold cache and vertical scaling's ceiling keep their scenes. Applying a
  concept brings its pattern to where traffic enters on its way to the picked elements.
- **The assistant**: patterns in `update_elements`, the briefing and tool descriptions; the
  scripted scenario now gives the arrow waves instead of adding scenes.

**Verification at the end of this step:**

- `pnpm lint`, `pnpm typecheck`, `pnpm check:ui`, `pnpm format:check`: clean. `next build`: no
  warnings.
- Unit tests: `@mogram/core` 274, `@mogram/icons` 104, web 236 — 614. New: patterns read, written
  and diagnosed; the moments they change; the plans when quiet and busy, and a scene's level
  holding an arrow steady; a scale set growing and shrinking cycle after cycle; the same picture
  however often it's asked for, and after a long gap; concepts telling their story with patterns
  and bringing them when applied; the assistant's pattern-aware tools.
- Browser suite: 190 tests against the development server; 185 against a production build
  (`next start`, everything but the five `cloud` journeys, which need the development mailbox).
  New: waves on an arrow scaling a set out and back in with no scenes (editor and viewer), the
  inspector's Traffic section and its account of the cycle, an animated export of waves lasting
  whole cycles (120 frames for 6 s waves at 10 a second); concepts and the assistant with
  patterns. The traffic slider's journeys are gone with it.
- Screenshots in `docs/screenshots/`: 155.

## Step 26 — A concept library that holds hundreds (2026-10-05)

Agreed with the product owner (plan: `docs/plans/concept-library.md`): concepts sat in the
building-blocks library as a flat list with cut-off summaries, no previews and no grouping —
fine for nine, not for the hundreds planned (networking, Azure, AWS, Git…). This step is the
structure and the UI; adding concepts comes later (D-85).

- **Filed by topic and platform**: `concept:` takes `topic` (ten, from scaling to Git and
  architecture patterns), `platform` (any, Azure, AWS, Google Cloud, Kubernetes) and `tags`,
  with did-you-mean warnings for a mistyped topic or platform. A concept with parts is a
  **pattern** you apply; one without is an **explainer** you insert or open.
- **`@mogram/concepts`**: one `.mogram.yaml` per concept under `content/<topic>/`, the nine moved
  there; a generated catalog that lists, filters and searches without loading any diagram;
  diagrams loaded a topic at a time; search that ranks titles, then tags, then the rest. Its test
  refuses a concept that doesn't read cleanly, tell its story or sit under its topic, and a
  catalog that's out of date.
- **A Concepts tab**: the left panel is now Library (building blocks only) · Concepts ·
  Assistant. Search, Yours and Recently used (two by two), and topics with counts that open into
  the topic, with Browse all on the Topics heading.
  Concepts show as small cards, two to a row, each drawing its diagram as it comes into view and
  playing while the pointer is over it. A View menu command and the collapsed panel's rail open
  it.
- **Browse all**: a gallery with topics down the side (a select on phones), search, a count, and
  a grid of larger cards with the summary. Opening one shows the concept window over the
  gallery; using it closes both.
- **Filters only when they'd change something**: a platform filter appears once some concepts
  are a platform's own, listing only those platforms with counts ("AWS (3)"), opening on the
  diagram's cloud and showing that platform's own first (general concepts always show); Apply /
  Explain appears once there are both kinds. With the nine general patterns today, neither
  shows.
- **The concept window** says the topic, platform and where it comes from; an explainer offers
  Insert and Open only. **Apply to your elements** lists what will change as the parts are
  picked ("Web scales out, 1 to 8 copies", "Traffic on Shoppers → App gateway rises and falls…"),
  worked out by applying the concept to a copy, so the list and the result can't disagree; when
  Apply can't run yet it says why. The same lines are the message after applying, now covering
  routing, queues, shares and backups too.
- **The Diagram inspector's Concept section** sets the topic, platform and tags, and says which
  kind the concept is.
- **The assistant**: `find_concepts` searches the catalog (by words, topic, platform) and returns
  ids with their parts; `apply_concept` takes an id, and the server sends the concept's file
  with the change, so the browser replays it without the library in the editor's bundle.
- **Smaller things**: the Library's and Concepts' search placeholders no longer cut off; a
  dialog's footer (the concept window, Export, rename and delete) no longer rides up over the
  space above it, leaving that space under its buttons.

**Verification at the end of this step:**

- `pnpm lint`, `pnpm typecheck`, `pnpm check:ui`, `pnpm format:check`: clean. `next build`: no
  warnings.
- Unit tests: `@mogram/core` 274, `@mogram/icons` 104, `@mogram/concepts` 6, web 245 — 629. New:
  topics, platforms and tags read, written and diagnosed; what a concept is (`conceptInfo`); the
  catalog (every concept valid, filed under its topic, up to date; search order; lazy loading);
  browsing (platform, topic, yours, recently used, kind, search, counts, loading once); the
  assistant finding concepts and refusing unknown ids.
- Browser suite: 192 tests against the development server; 187 against a production build
  (`next start`, everything but the five `cloud` journeys, which need the development mailbox).
  New or changed: the Concepts tab (platform from the diagram, a topic's cards, Recently used,
  search), the gallery (topics, search, kind, using a concept from it), topic and tags in the
  inspector, an explainer of your own, an account concept under Yours, and both on a phone.
- Screenshots in `docs/screenshots/`: 160.
