# Decision log

Each decision records the context, what was chosen, what was rejected and why. Newest last.
Decisions are referenced from code comments as `D-<n>` where a reader might otherwise wonder
"why is it done this way?".

---

### D-1 · Next.js 16 (App Router) + React 19 + TypeScript 5.9 (2026-10-03)

**Context.** Mogram needs a marketing site, auth, a dashboard, a heavy client-side editor, a
public server-rendered viewer, and its own backend (PRD: "Mogram runs on its own backend and
database from the first release").
**Decision.** One Next.js 16 app serves all of it: Server Components for reads, route handlers for
the REST API, client components for the editor.
**Rejected.** Vite SPA + separate API server: two deployables, no SSR for share links.
**Note.** TypeScript is pinned to 5.9.3. TypeScript 7 (the Go port) is current on npm, but
`typescript-eslint` supports `<6.1`, and Next's type-check uses the JS compiler API.

### D-2 · pnpm workspace + Turborepo with a pure `@mogram/core` package

**Context.** The PRD's phase 2 brings Mogram into developer tools (CLI, VS Code extension, GitHub
app). All of them need the exact same parser, validator, state rules and layout as the web app.
**Decision.** Everything that defines what a diagram _is_ lives in `packages/core` with zero DOM
or React dependencies, fully unit-tested. The web app depends on it.
**Rejected.** Keeping logic inside the Next app: it would couple the file format to React and
make the phase 2 tools a rewrite.

### D-3 · Custom SVG renderer instead of React Flow / canvas libraries

**Context.** Requirements include nested auto-sizing containers with positions in grid units
relative to the parent, orthogonal routing around obstacles, a single shared animation clock,
camera tours that ride connection paths, and frame-exact GIF/WebP export.
**Decision.** A purpose-built SVG renderer driven by geometry computed in `@mogram/core`. Every
visual is a pure function of (model, resolved state, `t`), so the live canvas, thumbnails and
exports share one implementation.
**Rejected.** React Flow: excellent for node editors, but its DOM-node model fights relative grid
units, nested auto-size, deterministic frame export and camera-path tours. Konva/Pixi: weaker text
rendering, no native SVG export, harder accessibility.

### D-4 · YAML text is the source of truth; edits are YAML document commands

**Context.** PRD: "Hand edits survive. Comments and the order of entries are preserved when
Mogram saves." and "one line diffs for one line changes".
**Decision.** The persisted state is a map of file paths to text. Edits are commands that modify
`yaml` `Document` ASTs in place and re-stringify, preserving comments and order. The model is
always re-derived from the text. Undo/redo stores text snapshots.
**Rejected.** Serialising a model to YAML on save: would drop comments and reorder keys.

### D-5 · Embedded Postgres (PGlite) locally, Postgres in production, Drizzle ORM

**Context.** The app must run on localhost with zero setup. Docker is installed but its daemon is
not running; a Homebrew Postgres 14 exists but is stopped. Production needs real Postgres.
**Decision.** `getDb()` returns Drizzle over PGlite (data in `apps/web/.data/pglite`) when
`DATABASE_URL` is unset, and Drizzle over `node-postgres` when it is set. Same schema, same
migrations. The PGlite instance is a process-wide singleton.
**Rejected.** SQLite (different SQL dialect from production), requiring Docker (setup friction).

### D-6 · Better Auth with email one-time codes

**Context.** Eden's sign-in is "enter your email, then the code". Security is a first-release
requirement; hand-rolled auth is a common source of bugs.
**Decision.** Better Auth (Drizzle adapter) with the email-OTP plugin, httpOnly session cookies and
built-in rate limiting. In development, codes are printed to the server log and kept in an
in-memory dev mailbox (`/api/dev/mailbox`, disabled in production) so end-to-end tests can sign in.
Production sends email through Resend when `RESEND_API_KEY` is set.
**Rejected.** Clerk (external service, keys required), Auth.js (weaker email-OTP story),
custom sessions (unnecessary risk).

### D-7 · REST route handlers for client mutations

**Context.** The editor is a long-lived client app that autosaves with conflict detection; phase 2
tools (CLI, VS Code, GitHub app) need an API anyway.
**Decision.** One documented REST API under `/api/*` (zod-validated contracts shared with the
client) backed by a server service layer. Server Components call the same services for reads.
**Rejected.** Server Actions for editor saves: not callable by external tools, awkward for
`409` conflict handling and autosave queues. Mixing both patterns would be inconsistent.

### D-8 · Tailwind v4 with Eden tokens only; default palette removed

**Context.** "Strict UI discipline" and an exact Eden match.
**Decision.** `@theme` removes Tailwind's default colours (`--color-*: initial`) and defines only
Eden's tokens (see `research/eden-design-system.md`). Visual decisions live in
`components/ui`; a `check:ui` script fails the build if feature code uses raw hex/rgb colours or
arbitrary colour utilities.
**Rejected.** CSS modules per feature (drift), a third-party theme (would not match Eden).

### D-9 · Radix primitives + class-variance-authority for UI components

Accessible behaviour (focus management, keyboard support, ARIA) comes from Radix (`radix-ui`);
styling is ours, expressed as variants with `cva` and merged with `tailwind-merge`.

### D-10 · Fonts: Inter (UI), Geist (headings), Instrument Sans (wordmark), Geist Mono (code)

Exactly Eden's stack (verified from Eden's CSS). Self-hosted from `@fontsource-variable/*` through
`next/font/local`, so builds don't depend on Google at build time and export can embed the same
Inter file into SVG/PNG/GIF output for pixel-identical text.

### D-11 · Diagram geometry constants

- Grid unit = 8px. Every stored coordinate is an integer number of units.
- Component footprint 12×12 units (96×96px): 56px icon tile at the top, label below.
  Connections attach to the icon tile, routing avoids the whole footprint.
- Container: 4-unit header (label), 3-unit padding; auto-size = children + padding; minimum
  20×12 units. Child positions are relative to the container's top-left corner.
- Group outline: 12px outside its members' footprints, dashed, no stored position.

### D-12 · State rules (PRD gaps filled)

- PRD lists healthy, degraded, down, scaling, overloaded, and its own scene example uses
  `active`. Mogram ships all six; `active` marks the side currently serving traffic.
- Severity order: healthy < active < scaling < degraded < overloaded < down.
- Roll-up (PRD: "worst state inside wins") reports the worst child, with `down` softened to
  `degraded` at the parent ("breaking something inside shows the parent as degraded"). Authors can
  set `rollup: best` (redundant children) or `rollup: none` on a container.
- Cascade: an effectively-down container or nested-diagram owner makes every descendant down.
- Precedence: ancestor cascade > the element's own state (scene, else base) > roll-up.
- A connection whose source or target is effectively down shows `blocked` unless its state is
  set explicitly. A connection with `backup_for: <connection>` switches from `idle` to `rerouted`
  when that connection is blocked. This is what makes PRD journey 8 ("break a component and watch
  traffic reroute") work without scripting.

### D-13 · Seamless animation periods

All preset periods are in {0.25, 0.5, 1, 2, 4} seconds, so every combination repeats exactly every 4s.
Traffic dots move exactly one dot spacing per period, so the pattern repeats regardless of path
length. Export loop length = 4s (or the least common multiple of periods actually in use).

### D-14 · Routes

`/` landing · `/sign-in` · `/diagrams` dashboard · `/draft/[id]` local editor · `/edit/[id]`
cloud editor · `/s/[shareId]` public viewer · `/security` · `/docs/format`. Deep links are query
parameters: `?scene=&card=&tour=&step=&level=`.

### D-15 · Minimal-diff YAML writing

**Context.** FI-5 requires comments and order to survive saves; the PRD's journey 6 expects a
one-line diff for a one-line change. The `yaml` library preserves comments but normalises spacing
when it prints, so whole-file re-printing creates noisy diffs.
**Decision.** Three-way line patch: print the edited document before and after the change with
identical options, diff the two prints, and splice only the changed lines into the original text
(aligned with a whitespace-insensitive line match). Changed lines use Mogram's canonical style
(`{ at: [2, 6] }`, `[a, b]`); everything else keeps its original bytes.
**Rejected.** Whole-file re-print (noisy diffs); hand-written CST surgery (far more code and edge
cases for the same result).

### D-16 · Breadcrumbs name the instance

Breadcrumbs show the label of the component that was opened, not the nested diagram's own name,
so "Payments" and "Orders" stay distinguishable when both open the same shared blueprint (NE-13).

### D-17 · `opens:` may point at any folder in the project

Nested diagrams are usually subfolders, but the PRD's reuse case (many services opening one shared
blueprint) needs sibling folders too (`../service`). Paths outside the project or to the
diagram's own folder are rejected, and loops are detected and explained (NE-2).

### D-18 · Local development on port 3100

Port 3000 was already in use on the build machine by another project, which must not be
disturbed. `pnpm dev` and `pnpm start` use 3100; `APP_URL` defaults to `http://localhost:3100`.

### D-19 · ESLint 9 with Next's config for the web app; strict type-checked rules for packages

`eslint-config-next` 16 targets ESLint 9, so the web app uses ESLint 9 with Next's core-web-vitals
and TypeScript configs (which include the React Compiler rules: no setState in effects, no refs
during render). `@mogram/core` and `@mogram/icons` use `typescript-eslint`'s strict type-checked
rules. Hook-rule findings were fixed in code (keyed remounts, `useDraft`, `useSyncExternalStore`)
rather than suppressed.

### D-20 · Azure icons: official artwork, shown unaltered (legal flag)

Mogram ships Microsoft's Azure architecture icons (IC-1). Microsoft's terms allow them in
architecture diagrams but ask that the artwork isn't modified or distorted. Mogram never edits the
SVGs: state looks are drawn around the tile (rings, badges, desaturation of the whole tile) and
motion presets move the whole icon. **Rotate, bounce and shake on Azure icons should be reviewed
against Microsoft's terms before a commercial launch**; if needed, those three presets can be
limited to generic and uploaded icons with a one-line change in `@mogram/core/presets`. The site
footer carries a trademark notice. The same flag now covers the AWS and Google Cloud icons (D-46);
each library's `LICENSE-NOTICE.md` quotes its vendor's terms.

### D-21 · Brand: Eden's visual language, Mogram's own mark

"Same branding as Eden" is applied as Eden's design language — tokens, typography, components,
grain and gradients — not Eden's name or logo. Mogram's mark (two nodes joined by a path with a
traffic dot) sits in Eden's squircle logo tile. The app's wordmark uses Instrument Sans like Eden's
app; the marketing site sets it in Geist 500 like Eden's site. Marketing pages follow Eden's
measured recipes: radial "lighting" behind sections, a 1px gradient hairline around product shots,
eyebrows in dimmed Geist, 1120px content (1320px hero), and the sign-in page's dimmed pill.

### D-22 · Thumbnails are small JPEGs rendered in the browser

Dashboard thumbnails are 480×300 JPEG data URLs rendered with the export pipeline a few seconds
after a save. SVG thumbnails were rejected: they embed icons as `data:` images, which the server's
SVG sanitiser rightly refuses, and they are larger. The server accepts only PNG/JPEG/WebP data
URLs. Drafts keep thumbnails in a separate IndexedDB store so they never race a save.

### D-23 · A separate viewer with a controller that owns the camera

The viewer (share links, previews, present mode) has its own store and a `ViewerController` that
performs every camera movement: cards (CA-1, CA-4), tours (TO-1 … TO-11), nested zoom (NE-6) and
deep links (SH-4). Each operation supersedes the previous one, so quick clicks never leave the
camera half-way. Scenes always belong to the top diagram (NE-14); a nested level's state is
resolved by passing each level's scene and "what if" entries down the chain of instances.
Rejected: reusing the editor store, which would have mixed editing state into a read-only page.

### D-24 · Short icon ids

The PRD writes `azure/aks`; the catalogue's id is `azure/kubernetes-services`. `@mogram/icons` maps
common short ids (`azure/aks`, `azure/vm`, `azure/front-door`, …) to catalogue ids for rendering,
leaving the YAML exactly as written. Every target is checked against the catalogue by a test.

### D-25 · Connections sharing a side are spread along it

After routing, ends that share a side of the same element are spread along that side: each starts
where its line would naturally meet the side (so straight lines stay straight), then a
least-squares placement (pool-adjacent-violators) keeps them 12px apart and in order. Without it,
several connections drew on top of each other near a busy element.

### D-26 · Pointer capture starts with a drag, not a press

Capturing the pointer on press retargeted click and double-click events to the canvas, which broke
double-click to open a nested diagram and connection targeting. The editor and viewer now capture
only once a gesture really drags, and the connect gesture finds its target with
`document.elementFromPoint`.

### D-27 · New YAML follows the file's own style

New components, containers, connections and groups are written as one-line `{ … }` maps when every
existing entry in that section is one, and in block style otherwise. Tours are always block style,
as documented; the first step is recorded as `start:` and each later step as the previous step's
`next:`, with no placeholder entries.

### D-28 · Renames write the YAML name

The dashboard's rename changes the `name:` in the YAML as well as the database name, as a new
version, so the editor and dashboard always agree. A thumbnail update is metadata only and doesn't
create a version.

### D-29 · One file-format specification

`/docs/format` renders `docs/file-format.md`, turned into a module at build time
(`scripts/sync-assets.mjs` → `src/generated/file-format.ts`), so the public page and the
repository document can never drift apart.

### D-30 · Browser tests use the installed Chrome

Playwright's own Chromium download is blocked on this network, so Playwright runs the installed
Chrome (`channel: "chrome"`). `E2E_BASE_URL` points the same suite at a production build to check
the strict production CSP.

### D-31 · Z-order: every container is a stacking context

`z` orders siblings (the file format says so), and a container's `z` carries everything inside it,
as frames do in Figma. The renderer draws in one paint order (`paintOrder` in core): per level,
highlight zones, then each child container followed by all of its contents, then groups,
connections, components and text, each sorted by `z` and document order. A connection is drawn in
the innermost container holding both ends. Before this, components were sorted globally, so
bringing a region to front left its neighbour's components on top of it. Moves are planned by
`planZOrder`: front/back move to the end, forward/backward move one place past the next sibling,
and the new values are chosen to write as few `z` keys as possible (preferring to change the moved
element and to return values to 0). A move that changes nothing is disabled in menus and the
inspector, and makes no undo step. Rejected: one global `z` per kind, which would let a child
draw below its own container.

### D-32 · YAML that doesn't parse yet keeps the last diagram that did

While text typed in the code panel has a syntax error, the canvas keeps showing the last version
that parsed (with a banner naming the file and line) instead of going blank mid-word. Canvas edits
wait until it's fixed, because editing a stale model would write into files that no longer match
it. Opening broken files from the computer has no earlier version to fall back on, so that shows
what the files say.

### D-33 · Reduced motion pauses, and stays the person's choice

With "reduce motion" on, diagrams start paused (traffic, pulses, overload) and the camera cuts
instead of gliding. A visible "Play motion" button (and `M`) still lets people watch the motion
that explains the architecture. Previously motion was locked off with no way to turn it on.

### D-34 · Touch screens

One finger on empty canvas pans (drag-to-select needs a mouse or pen); a long press opens the menu
for what was pressed; phones keep Select, Connect, Text, Undo and Redo in the toolbar and move the
rest into "More tools"; opening a panel sheet moves the selection above it; and fitting never
zooms out past 55%, so labels stay readable and the rest is a pan away.

### D-35 · Sign-in hardening

Only the five auth endpoints Mogram uses are served. Codes are limited per email address in the
database (5 sends and 10 attempts per 15 minutes) in addition to Better Auth's per-IP limits, and
IP-based limits only trust a header the deployment names (`TRUSTED_IP_HEADER` or
`TRUSTED_PROXIES`). "Local development" — where the fallback secret, the dev mailbox and
`/dev/canvas` exist — means a non-production build _and_ a localhost `APP_URL`.

### D-36 · Icons are requested only if the catalogue has them

`@mogram/icons` ships a compact list of every icon id (33 KB, 11 KB compressed, for about 1,800
icons; generated with the catalogue and checked against it by a test). `iconUrl` returns a URL only for listed ids, so half-typed or
unknown types show the "missing icon" placeholder without a request.

### D-37 · Story commands report the name they gave

`addScene`, `renameScene`, `addTour` and `updateTour` return the final (de-duplicated) name as
`EditResult.named`, separate from `select`, which is only for canvas elements. The scene strip and
tours panel select what was created by that name instead of guessing it.

### D-38 · Containers don't push their neighbours

Dropping an element into a container grows the container around it; neighbouring containers stay
where they are, as in other free-form canvases. Any overlap that results is visible and can be
arranged with z-order (D-31). Rejected: automatic re-layout of pinned neighbours, which would move
things the author placed by hand.

### D-39 · Heavy editor parts load when first used

CodeMirror (the code panel), the export dialog (encoders, static rendering) and version history
are loaded with `next/dynamic` the first time they're opened, so the editor's first load carries
only what drawing needs.

### D-40 · The viewer works from the keyboard

In the viewer, every component (and any container or connection with a card) is a keyboard stop:
Tab moves between them, Enter or Space does what a click does, and the camera follows focus. The
SVG is a `group` there rather than an `img`, so assistive tech sees the buttons inside.

### D-41 · Connection labels stay off component names

A connection's label pill goes at the point along its path nearest the middle that doesn't cover a
component's icon or name or another label (`labelPosition` in core); when every point is covered,
the middle.

### D-42 · Promises are checked by the linter

The web app uses type-aware `no-floating-promises` and `no-misused-promises`: every promise is
awaited, handled, or handed off explicitly with `void` after its errors are dealt with. Failures
that used to vanish (library catalogue, clipboard, sign-out, downloads, thumbnail backfill) now
show a message or retry.

### D-43 · Feature boundaries are enforced

Panels and dialogs that need the editor's store (inspector, library, tours, export and share
dialogs) live inside `features/editor`, and ESLint stops any other feature importing the editor;
only its routes do. Drafts (used by the editor, viewer and dashboard) became their own feature,
and `components/`, `lib/` and `styles/` can't import features at all. This removed every
circular dependency between features.

### D-44 · The first version is always kept

Saves by the same person within five minutes still merge into one version, so history stays
readable, but never into the first version (as created, duplicated or imported). Without this, a
template edited straight away lost its original for good.

### D-45 · Configuration is checked when the server starts

`src/instrumentation.ts` validates the environment once at start-up. Outside local development a
missing `BETTER_AUTH_SECRET` or `RESEND_API_KEY` stops the server with a clear message, instead of
failing on the first sign-in (codes are sent in the background, so that failure would be silent).
Empty `KEY=` lines count as unset, so copying `.env.example` as it is works locally.

### D-46 · AWS, Google Cloud and Kubernetes icons, built the way Azure's are (IC-7)

**Context.** The PRD: "AWS and Google Cloud follow Azure." The catalogue was built for this:
libraries are rows in `LIBRARIES`, icons are files, and one search covers them all.
**Decision.** Each vendor has a builder in `packages/icons/scripts/lib/` that reads its official
download, pinned by SHA-256 (`vendor.ts`), cleans every SVG with the same pipeline as Azure's
(styles to attributes, ids scoped to the icon, editor noise removed, checked for anything unsafe)
and files it under the vendor's own categories. AWS: the quarterly Architecture Icons package,
services at their 48px size, resources, general icons, group icons and category icons (807).
Google Cloud: see D-47 (230). Kubernetes: the community icon set from kubernetes/community at a
pinned commit, fetched file by file because GitHub's zip archives are not byte-stable, and checked
against one manifest hash (39). Ids are `aws/…`, `gcp/…` and `k8s/…`.
**Rejected.** Third-party icon packs (diagrams.net stencils, npm packages): unofficial, often
out of date, and with no clear licence for the artwork.
**Note.** Motion needs nothing per icon: the PRD keeps motion on the whole icon ("Animating parts
inside an icon is out of scope"), and the renderer applies every preset to the tile, so every
icon in every library moves the same way. `rotate` still turns the artwork, which D-20 flags.

### D-47 · Google Cloud follows Google's 2025 icon system

Google replaced about 250 product icons with 19 core product icons and 26 category icons; its
product icons guide files every other product under a category and says to draw it with that
category's icon, and that the older two-tone console icons "should not be used as of 2026". Mogram
does exactly that: core products have their own icons, and each product the guide lists has its
own entry (so `pubsub` finds Pub/Sub, labelled correctly) drawn with its category's icon. The
legacy icons are not shipped.

### D-48 · AWS names: AWS's own short forms, slugs without the vendor word

AWS's file names spell some services out ("Amazon Simple Storage Service"), but AWS and every
architecture diagram call them "Amazon S3". Seventeen such services use AWS's short form, and the
long name stays a search alias. Slugs drop "Amazon"/"AWS" (`aws/s3`, `aws/lambda`), and every AWS
icon is also found by its name without the vendor word. Resource icons are named so the service
isn't said twice ("AWS Lambda Function", not "AWS Lambda Lambda Function"); a resource icon that
would take a service's name is marked "(resource)".

### D-49 · Single-colour vendor icons follow the canvas theme

AWS ships its general icons (User, Database, …) and three dark-square icons (AWS Cloud, its logo,
Marketplace) twice, once for light backgrounds and once for dark. Mogram keeps one file: general
icons become `currentColor` glyphs, and the dark squares draw the square in the theme colour with
the white mark cut out of it, which reproduces whichever copy AWS made for the background. Which
icons are glyphs is generated into `ids.generated.ts` (`iconKind`), so the canvas no longer assumes
only `generic/` icons are glyphs.

### D-50 · Azure icons Microsoft leaves in "other" are filed by hand; the panel follows the diagram

Microsoft's V24 download files 142 icons only under "other" or "new icons", including Container
Apps, Private Endpoints and Prometheus. A table in `azure.ts` gives each its Azure product area;
only six codenames with no public product stay in Other, and a table entry that stops applying
fails the build. In the editor, the library panel offers the libraries a diagram's `libraries:`
setting names (all by default), opens on the cloud the diagram is drawn in, and search ranks that
cloud's icons first among equally good matches.

### D-51 · Inspector fields save as you type

Text fields used to save only on Enter or when focus left them, and a click on the canvas changes
the selection before the browser moves focus, so a half-typed label or name could be dropped.
Fields now save a moment (400 ms) after typing pauses, as well as on leaving the field or Enter,
and the canvas takes focus from a field before it handles a press. Everything saved during one
visit to a field is one undo step, and Escape takes the visit back. A name is checked while it is
typed: one that isn't valid yet, or is already used, isn't saved, and the reason shows under the
field instead of an error message per keystroke. Each save is bound to the element the text was
typed for, so a selection that changes mid-word can't move the text to another element. The two
path fields (a card's markdown file, a nested diagram folder) still save only when left, since
each half-typed path points somewhere real.

### D-52 · The grid and custom backgrounds follow the actual background

Grid dots were a fixed 7–8% white or black, about 1.15:1 against the canvas, so they nearly
disappeared, most of all on gradients. They are now worked out from the background: white on
dark, black on light, at the lowest opacity that reaches 1.45:1 against every colour the
background passes through (`gridColorFor` in `@mogram/core/presets`). A custom background colour
also sets light or dark from the colour itself, so a light colour on a dark theme gets dark text,
lines and grid; where the theme's text can't reach WCAG AA on the colour (pure red, mid grey),
labels turn pure black or white, which always can.

### D-53 · One colour model and one picker for every colour

Backgrounds, sticky notes, element colours and the grid share a paint model in
`@mogram/core/presets`: a hex colour (with optional opacity as `#rrggbbaa`) or a linear or radial
gradient of 2–6 stops, written in the file in CSS syntax so it reads as what it is. The picker
follows Canva's: search by name or hex, the colours already in the diagram, recent colours, an
eyedropper where the browser has one, solid and gradient tabs with five gradient styles, and a
custom editor with hue, saturation, brightness and opacity. Defaults are a short row each; the
full palette (Tailwind's, MIT) and the gradient groups (cool, warm, monochromatic, vivid) are
behind "See all", so the panel stays small until someone wants more.

### D-54 · Sticky notes and rich text are Markdown-ish, written as plain text

A note or free text is stored as the words someone would type in a plain-text note: `**bold**`,
`*italic*`, `- ` and `1. ` lists. The file stays readable and diffable, there is no separate
rich-text model to keep in step, and the in-place editor is a text area laid exactly over the
words in their own font, size and colour, which saves as you type like the inspector (D-51). The
markers show while typing and render once done; ⌘B, ⌘I and the bar's B, I and list buttons add
or remove them around the selection. Whole-text bold, italic, font, size, alignment and colour are
settings (`bold: true`, `font: mono`), so a note's look changes without touching its words. Notes
fit their words automatically (largest size that fits without splitting a word) unless a size is
set. Fonts are the four the app already ships, and exports embed only the ones a diagram uses.
Rejected: a WYSIWYG editor (contenteditable), which would need its own document model and would
make the file hard to read.

### D-55 · A quick-edit bar over the selection

The edits people make most — a note's colour, font and size; a component's state and motion; a
connection's flow — appear in a small bar above whatever is selected (below it near the top
edge), as in Miro and FigJam, so they don't need the inspector. It shows only what suits the
selection, follows the current scene (a state set in a scene is that scene's), hides while
dragging, and its "More" menu holds duplicate, order, delete and "All properties" (opens the
inspector). It shares its controls with the inspector, so both always change the same keys.

### D-56 · Going into a nested diagram is one continuous zoom

Entering a nested diagram used to swap levels (editor) or cut between two moves with a blank
moment in between (viewer). Both now draw the two levels at once during one camera move: the
inner diagram is placed inside the component's tile, scaled to fit, and the camera zooms about
the one screen point both levels agree on, in log space, so it reads as a straight push in.
The tile opens as a frame that grows to fill the view, then the parent fades away; the last frame
is exactly the inner level on its own, so handing over to the canvas is seamless. Leaving runs
the same move backwards to where the camera was before going in. Reduced motion cuts instead.
The way out is always in sight: "Back to <parent>" (also Escape) sits under the top bar, in the
viewer, the editor and present mode alike, and the breadcrumbs jump further.

The editor now shows nested levels as the viewer does: the top diagram's scenes stay selected
going in and reach the level by path (NE-14), the scene strip says whose scenes they are, and
a state chosen inside a nested diagram in a scene is written to the top diagram's scene as
`aks.checkout: degraded`. Tours also belong to the top diagram, so the tours panel inside a
nested level points back there.

### D-57 · Preview, not just present

The editor's top bar has Preview (Shift+P), which opens the viewer at the level and scene being
edited, exactly as people with the link will see it, labelled "Preview" with "Back to editor".
Present stays beside it for full-screen showing.

### D-58 · Templates are real Mogram files

Each template is a folder in `apps/web/src/features/templates/` laid out exactly like the project
it starts: `web-app/mogram.yaml` and its card files, `aks/mogram.yaml` with the nested
`aks/aks/mogram.yaml`, and so on, so they can be read, edited and diffed as Mogram files, or
opened with "Open files…". They used to be strings inside TypeScript. `files.ts` imports them as
text: a three-line local loader (`scripts/text-loader.cjs`) in `turbopack.rules`, scoped to that
folder, and a matching Vite plugin for the unit tests. Turbopack's built-in `raw` module type was
tried first; its import came back undefined. Prettier leaves the folders alone, so they stay
exactly as written.

### D-59 · Connections draw the way draw.io's do, written in plain words

The research in `docs/research/drawio/02-connectors.md` set what a connection needs: arrowheads
per end (19 of them, from plain open arrows to ER notation, filled and outline), their size, a
line pattern, width, sharp or rounded corners and line jumps. They are separate keys on the
connection (`arrows`, `arrow_size`, `line`, `width`, `corners`, `jumps`) rather than draw.io's
style string, and each is written only when it differs from the default. `direction` keeps
supplying the arrowheads when `arrows` isn't written, so older files draw as before. The line
stops at a filled arrowhead's base instead of running through it, dashes scale with the width,
and the traffic dots run beneath the arrowheads over any pattern. Reversing a connection swaps
its ends, bends, fixed ends and label place, so the picture keeps its shape and the arrowheads
turn with the flow (draw.io leaves the markers where they were; we decided against that).

### D-60 · Every route takes bends, and bends that do nothing go away

`via` used to work only for orthogonal routes. Now a straight line is a polyline through its
bends, a curve passes through them (Catmull-Rom turned into Béziers), and an orthogonal line
treats them as its corners, with each end leaving from the side that lines up with its nearest
bend. Editing follows draw.io: handles on the ends, on every bend and faded "add" handles between
them; orthogonal lines get a handle on each segment that slides it sideways; dragging a line that
isn't selected edits it straight away. Bends snap to the grid; Shift keeps a drag to one axis,
Alt keeps a bend that falls in line. A bend dragged back into line is removed, and a segment
slid back to where the router would put it removes `via` altogether, so the file only holds
bends that change the picture. Escape cancels any of these drags.

### D-61 · Fixed ends and label places live in the layout

Dragging an end onto one of an element's 16 connection points fixes it there (`from_anchor`,
`to_anchor`: a name such as `left` or `[x, y]` fractions); onto the element's middle it floats
again. Onto another element it reconnects; with Ctrl/Cmd it copies. The label can be dragged
along and beside its line (`label: { at, offset }`). These are geometry, like `via`, so they sit
in the connection's layout entry and the definition stays about meaning.

### D-62 · Bends follow the elements they join

draw.io leaves bends where they were when a shape moves unless the edge has `followTerminals`,
and stale bends are the most common "my arrow looks broken" moment there. Here following is the
default and there is no switch: moving, nudging, aligning, distributing, resizing or fitting a
container rewrites the bends of the connections it touches in the same undo step, and the drag
previews it. Straight and curved lines keep each bend's place along the line between the ends
and its distance from it; orthogonal lines stay square, the first and last runs moving with their
element and the runs between sharing the shift by how far along they are.

### D-63 · Dropping a component on a connection puts it in between

Drag one component (or drop one from the library) onto a connection and the line highlights; on
release the connection ends at the component and a copy carries on to the original target, with
the same flow and look but no label or card. The original keeps its name, label and any scene
entries, since scenes refer to it by name. Bends before the component stay with the first part,
those after go to the second, and any under it are dropped. Alt or Shift drops without splitting.

### D-64 · One command registry behind keys, menus, the palette and the shortcuts list

Keys, the right-click menu, the quick bar's More menu, the diagram menu and the shortcuts dialog
were wired separately, which is how draw.io ended up with menu hints that don't match its keys
(05-ui-shell-commands §4.5). Each command is now defined once in
`features/editor/commands/registry.ts` with its label, keys, icon, when it applies and whether
it's checked; every surface reads it from there, and a unit test fails if two commands claim the
same keys. Context menus are built per selection when they open and hide what doesn't apply
(dropdowns show it greyed out); separators never lead, trail or double up; "Delete (3)" says how
many. A key the editor owns is kept from the browser even when nothing applies (⌘D never
bookmarks the page), except copy, which stays native in text fields, and Tab, which moves focus
when nothing is selected. ⌘R reverses the selected connection rather than reloading. A command
palette (⌘K or /) searches every command that applies, the icons to add, the diagram's elements,
nested diagrams and scenes, with recent commands first.

### D-65 · Find, lock, paste in place and copied styles

The commands draw.io users reach for most that Mogram lacked (05-ui-shell-commands §13.2):

- **Find** (⌘F) is a small panel under the top bar, not a dialog, so the canvas stays usable. It
  matches labels, YAML names, types and card text, steps through matches in reading order with
  Enter and Shift+Enter, and selects each one, moving the view only when it's off screen.
- **Lock** (⇧⌘L) writes `locked: true` beside the element's position in the layout: it's about
  editing the picture, not about the architecture. A locked element can still be selected,
  restyled and renamed, but dragging, nudging, aligning, resizing and deleting leave it alone,
  and its selection shows a padlock. Unlocking removes the key again.
- **Paste in place** (⇧⌘V) puts a copy exactly where the original was, as long as the
  clipboard still holds what was copied in this tab.
- **Copy style / paste style** (⌥⌘C, ⌥⌘V) copy how an element looks — colours, line and
  arrowheads, motion, typography — never what it is or says. Keys the source leaves at their
  default are removed from the targets, so they end up looking the same; between kinds only
  shared keys travel.
- **Copy as PNG / SVG** (⇧⌘C) puts the diagram, as it shows now, on the clipboard, using the
  same renderer as Export.
- **Resize with keys** (⌘ + arrows, Shift for 4 units) for containers, zones and notes, which
  never shrink a container below what it holds; **Fit to contents** for containers; **Show in
  YAML** opens the code panel with the element's line selected; **Select** connections,
  connected elements, children, parent, siblings, source and target; Tab steps through
  elements; F2 renames; ⇧⌘G ungroups.

### D-66 · The inspector is organised by concern, in tabs

The inspector was one long column per kind of element, its sections couldn't fold, and several
selected elements showed made-up values ("healthy", "idle") instead of theirs. Following
04-format-panel §16 it now has a header saying what's selected (kind, name and type, or a count
with chips that narrow a mixed selection to one kind) and tabs that are always in the same
order: **Element** (what it is and says: label, state, motion, flow, card, nesting, details),
**Style** (how it looks: colour, line and arrowheads, typography, tone, copy and paste style, and
an All properties grid of every key the element can take, editable as YAML) and **Arrange**
(where it sits: X and Y in grid units, width and height, which container holds it, order, align
and distribute, grouping and lock). With nothing selected the tabs are **Diagram** (problems,
name, files) and **Canvas** (theme, background, grid). Each mode remembers its last tab, and each
kind of element remembers which sections are open, in this browser only — never in the file.

Several selected elements get the same tabs. Each control shows the value they share, or nothing
pressed when they differ, and writes to every element it applies to; colour and line settings
work across kinds. Number fields step with ↑ and ↓ (Shift for 10), saving each step and folding
the steps into one undo; a typed value is its own step. The panel can be widened from its left
edge (280–420 px), remembered per browser.

### D-67 · Shapes are components drawn as outlines

draw.io's biggest gap compared with Mogram was the other way round: Mogram had only icon tiles.
Following 03-shapes-styles-library §5, there are now eleven shapes (rectangle, rounded, ellipse,
circle, diamond, cylinder, queue, cloud, hexagon, document, person) written under their own
`shapes:` section. In the model a shape is a component with a `shape` and a look, not a new kind:
it connects, nests in containers, carries state and motion (its state ring follows the
outline), takes a card or a nested diagram, and appears in scenes, tours, Find and the palette
with nothing written twice. The YAML still reads as what it is (`orders_db: cylinder`), and an
icon is never confused with an outline.

Every shape's geometry comes from one registry in `@mogram/core/presets/shapes.ts`: the outline,
detail strokes (a cylinder's lid) that cast no shadow, a sampled outline that connection ends stop
at (so a line meets a diamond's edge, not its bounding box), and the box its label wraps inside.
The look is a short typed vocabulary — `tone`, `fill`, `stroke`, `stroke_width`, `dash`,
`corner`, `shadow`, `opacity` and the text keys — rather than draw.io's free-form style string,
and every value has a theme-relative default, so an unstyled shape looks right on light and dark
canvases. A `blue` tone joined the palette for them. Shapes resize like containers, sit at the
top of the library (click to add one in the middle of the view with its label open for typing,
or drag it, onto a connection to put it in between, or with Alt onto the bare canvas), and their
Style tab edits the look.

### D-68 · Drawing fast: guides, connected copies, quick add

From 06-canvas-interactions §20, the canvas now does what makes draw.io quick to draw with:

- **Smart guides.** While moving, the moving bounds line up with their neighbours' edges and
  centres, or sit at an equal gap between two neighbours, and thin lines say so. Positions stay
  whole grid cells, so a guide only ever pulls a move by one cell; Alt moves without them. A
  small label under the element says where it will land, in grid units.
- **Connected copies.** Hovering a component or shape shows four arrows. A click adds a copy
  that way, 80 px off, connected from it, selected with its label open — or connects to what's
  already there; a drag draws a connection as before; Alt-click opens the quick-add picker for
  that spot. ⌥⇧ + arrow does the same from the keyboard.
- **Quick add.** Double-clicking empty canvas (or Alt-clicking an arrow) opens the command
  palette in "Add here" mode: a copy of the source, the shapes, and every icon by search; what's
  chosen goes exactly there, connected when it came from an arrow.
- **Copy by dragging.** Holding Ctrl/Cmd at the drop leaves the original and drops a copy.
- **Smaller things:** the selection box takes only what it encloses (Alt: what it touches); the
  container holding the selected element is outlined quietly; zoom buttons and keys step along a
  ladder that always includes 100%; Escape keeps a typed label (Shift+Escape puts it back); a
  minimap shows the whole diagram with the view outlined, and a press or drag on it moves the
  view.

New elements are written the way their neighbours are: `name: generic/service` or
`name: cylinder` when that's all they say, one-line maps for short entries and the first entry
of a section.

### D-69 · The document travels: links, data, editable images, PDF, tidy up

From 07-document-workflow §18:

- **Undo goes back to where the change was made.** Each undo step remembers its nested level;
  undoing a change made inside a nested diagram while looking at the top one goes back inside
  first and frames it, as draw.io's page switches are part of its undo history.
- **`link:` and `data:` on any element.** A link is a web page, a scene, a tour or `#another`
  element; viewers follow it with a click, after the element's card or nested diagram. `data:`
  holds named values (owner, cost centre, SLA) that the inspector edits as rows, the viewer's
  card lists, and hovering shows. Links are restricted to web and mail addresses; the rest are
  checked like draw.io's "page not found" and follow renames.
- **Exports you can open again.** PNG and SVG exports carry the diagram's files by default (a
  PNG text chunk, an SVG `<metadata>` element), so dropping the image on Open files gives the
  diagram back; a switch in the export dialog leaves them out. PDF export writes a one-page PDF
  the size of the diagram, holding a print-resolution image of it — written directly, with no
  PDF library — and exported SVGs make web links real links.
- **Tidy up** (⌘⌥T) re-runs Mogram's automatic placement on a container's contents or the whole
  diagram — sources left, destinations right, by their traffic — clears the bends between them
  and pins the result, as one undo step.
- **One preferences store.** Folded inspector sections, last tabs, the inspector's width, open
  library sections and recent icons and commands live in one versioned, typed object in the
  browser, shared live between tabs and migrated from the separate keys used before. None of it
  is ever written to a diagram.

### D-70 · Finishing M5 and M6: size guides, Find everywhere, placeholders, named styles

The leftovers of the draw.io study (08-gap-analysis):

- **Size guides.** Resizing snaps the width or height to a sibling's within one grid cell, and
  marks every element with that size (a bar above for width, beside for height), as draw.io's
  resize guides do. Only the sides being dragged snap; Alt turns it off. A selected element's
  handles are drawn above its hover ring, so they can always be grabbed.
- **Touch and pen.** A press must travel 12 px before it becomes a drag (4 px with a mouse).
- **Find looks everywhere.** Find searches the diagram and every nested diagram below it (a
  folder opened by several components once, by its first way in); this level's matches come
  first, and stepping to one in another level goes straight there and says which.
- **Placeholders.** `%key%` in a label, text, note or connection label shows a value from the
  element's `data:`, its containers', the diagram's new top-level `data:`, or the built-ins
  (`name`, `type`, `diagram`, `date`), in that order — draw.io's lookup, without its opt-in
  flag: an unknown token stays as written, so nothing written today changes. The diagram's data
  has its own section under Diagram settings.
- **Named styles.** `styles:` names looks that elements take with `style:`; their own keys win.
  The keys a style may hold are exactly the look keys copy/paste style uses, now kept in one
  list in the format code. Styles are read before any element so they work across files, and a
  mistake inside one is reported once, at the style, however many elements use it. The editor
  makes a style from an element, applies one to a selection, and pushes an element's own
  changes into its style or drops them. Notes and text keep `style:` for their text style
  rather than overloading it.

### D-71 · Shape handles: one adjustable measure per shape, as a plain key

draw.io's yellow handles (03-shapes-styles-library P1-2) adjust one style value per shape. Mogram
does the same for the shapes that have a measure worth adjusting — `corner` (rectangle,
rounded), `lid` (cylinder, queue), `slant` (hexagon) and `wave` (document) — each a plain px key
beside `corner`, never a generic "size" whose meaning changes with the shape. The shape registry
says, per shape, which key it has, its own value for a box, the most it can take, where the
handle sits and what a handle position means, so the canvas handle, the inspector field, the
outline and the connection ends all read one definition. A drag edits live as one undo step;
Escape puts the value back, and dragging back to the shape's own value removes the key (FI-3).
The keys are look keys: copy/paste style and named styles carry them.

### D-72 · The quick bar is declared; big libraries draw as they scroll

- **One table for the bar.** What the quick bar offers for each kind of selection — elements,
  connections, text and notes, zones — is a list of control ids in one place, with dividers. A
  control declares what it edits in the selection (a mixed selection's state control edits its
  components and containers, its flow control its connections) and where it continues in the
  inspector. The bar draws each with the same pieces and actions as the inspector, so nothing
  exists only in the bar and undo labels match. The research's full version — one schema
  rendering the inspector too — would rewrite every inspector for little gain to anyone using
  it; the table gives the parts that show: a consistent bar and the deep link.
- **More in inspector.** The bar's "…" menu ends with it: the inspector opens on the tab and
  section of the bar's first control, unfolded and scrolled into view (draw.io has no such link).
- **Library tiles a page at a time.** A folded section draws nothing; an open one draws 48
  tiles, then the next 48 as its end comes within 240 px of view, like draw.io's virtual
  thumbnails. Opening AWS (800 icons) or typing a search stays instant.

### D-73 · Thirty canvas themes with real variety, and swatches drawn cleanly

- **More themes, none removed.** Six of the ten themes were near-black, so the picker read as
  shades of black. Twenty were added — Slate; Ocean, Teal, Plum, Wine, Olive; the Aurora,
  Twilight, Sunset, Lagoon and Nebula gradients; Blueprint and Chalkboard; Sky, Mint, Blush,
  Lilac, Butter, Dawn and Seafoam — each a whole theme: background, tinted tiles and borders,
  lines and labels. A test holds every theme to readable labels (4.5:1) and muted text (3:1) on
  every colour its background passes through, and to a grid that shows on all of them.
- **Shown like the tones.** The Canvas tab shows ten themes, one or two from each family, as
  tiles previewing a node, a line and a label in the theme's own colours; the theme in use is
  always among them. "See all" opens every theme by family with names, in place, like the colour
  picker's; picking there applies at once and stays, so several can be tried in a row.
- **Swatches.** A swatch's outline is now an inset ring over its colour instead of a border its
  gradient repeated under (the far end of a gradient showing in the rim read as a square inside
  the circle). The colour picker pads inside its scrolling area, so the selected swatch's ring is
  never cut off under the search field, and its sections share one spacing.

### D-74 · The grid shows the snap grid exactly: dots or lines, on by default

Everything snaps to 8px cells whether or not the grid is shown, and every position in a file is
counted in those cells, so the grid is a measuring tool, not decoration.

- **Every mark is a snap point, in two levels.** Single cells show from 75% zoom up (so a
  diagram fitted to the window still shows every snap point), fading out by 60%. Below that only
  the 10-cell marks remain, drawn like single cells, every 100 cells once 10 would come closer
  than 16px; and the whole grid eases lighter from 50% down to 10%. A first version stepped
  through 2 and 5 cells to keep marks 6–15px apart at every zoom, which made a zoomed-out view
  as dense as a zoomed-in one around a diagram a fraction of the size. Before either, dots were
  drawn every 16px at 100%, so half the snap points had none.
- **A stronger mark every 10 cells,** not draw.io's 4, so they fall on the round numbers you
  read and type: the Arrange tab's X and Y, the position hint while dragging, and `at:` in the
  YAML (`at: [30, 6]` sits on the third major line). The grid is anchored at 0,0, and since
  elements inside containers are placed in whole cells from their container's corner, every
  element sits on it.
- **Dots or lines.** Dots are the quiet default; lines (faint minor lines, stronger major ones,
  like draw.io's) suit precise layout and the Blueprint and Chalkboard themes. Both use the
  Canvas tab's colour and opacity; minor lines are drawn fainter than dots, because lines cover
  far more of the canvas. Zoomed out, the 10-cell lines left on their own keep 70% of their
  strength: any fainter and they all but vanish on a dark canvas on a standard-density screen.
- **On by default, and personal.** With snapping always on, showing the grid is the honest
  default (the PRD had it off; changed at the user's request). Whether it's shown and its style
  are remembered in each person's browser and never written to the file; its colour stays in
  the file because it belongs with the diagram's background. The cell size is fixed: changing
  it would change what every number in every file means.
- **The colour picker opens beside the inspector,** level with the button that opened it,
  instead of beside the button and over the panel's own controls. A custom background is named
  ("Brown · custom", or the gradient's name) so it's clear it replaces the theme.

### D-75 · The library, reorganised; containers named for the diagram's cloud

- **One column.** The title bar is as wide as the library below it, and the library's list is
  padded inside its scrolling area so its first row never sits under the search field.
- **Search, Recent, Basics, Icons.** Eight filter pills in two rows mixed a scope (All), clouds,
  a platform (Kubernetes), icon sets every diagram needs (Generic, Tools) and uploads (Mine) —
  and only filtered part of the panel. Now: search across everything (results grouped by
  library, the one being browsed and those in use first, after any matching shapes and
  containers); Recent (what was added lately, then what the diagram already uses); Basics, one
  section switched between Shapes, Containers, Notes and Generic icons; and Icons, one library at
  a time chosen from a menu (uploads are one of them, with the upload button), each category a
  row with a glimpse of its icons that opens in place with a way back — the colour picker's and
  theme gallery's "See all" pattern instead of a 25-row accordion.
- **Containers by cloud.** The clouds name the same things differently (VNet, VPC and VPC
  network are one thing; subscription, account and project nearly so) and some things exist on
  one cloud only (resource groups on Azure; public and private subnets, security groups on
  AWS). Their nesting differs too: AWS subnets are zonal, Google Cloud networks are global.
  Containers are now cloud-neutral kinds — `network` replaces `vnet` and `vpc` (both still read)
  and `cloud`, `account`, `public-subnet`, `private-subnet`, `security-group`, `scaling-group`
  and `on-premises` are new — named and ordered for the diagram's cloud in the library and the
  inspector, and given the cloud's official group icon when added. Colours stay Mogram's, one
  per kind, so containers look alike across clouds and themes.

### D-76 · Version history: sessions, versions people can read, and nothing lost

- **One version per working session.** Saving every keystroke as a version would bury the ones
  that matter, so a save joins the version being edited until five minutes pass without saving
  or thirty minutes in all (`lib/history/rules.ts`, shared by the server and drafts). Named
  versions, assistant turns, restores and the first version are never joined.
- **Versions say what changed, by name.** Every element, scene and tour has a name, so Mogram
  can say "Added Payments API · removed 1 · moved 2" instead of "line 42 changed"
  (`@mogram/core/diff`), worked out once when the version is saved.
- **Looking is read-only, restoring is a new version.** Choosing a version shows it on the
  canvas, read-only, with what changed in it (or since it) drawn over it: added in green,
  changed in amber, removed as red dashed ghosts. Restore puts it on top as a new version, so
  the version it replaced is still there; Bring back takes only selected elements or scenes
  (`restoreElements`), with the children and connections that went with them.
- **Drafts too.** A draft keeps the same history in this browser (IndexedDB) and takes it along
  when it's saved to an account.
- **Kept for good when named.** Everything from the last day, then one an hour for a month and
  one a day after that; named versions always.

### D-77 · Architecture review: what parses but an architect wouldn't draw

`@mogram/core/lint` reviews a diagram for what's valid YAML but probably not meant: a subnet
outside any network, containers nested the wrong way round for the diagram's cloud, an AWS
subnet outside an Availability Zone when the diagram has zones, icons from two clouds,
components nothing connects to, empty containers. The rules are deliberately cautious (only for
a known cloud where orders differ; inventories without connections aren't flagged; resource
groups and boxes nest any way), every finding says why and what usually fixes it, and the
templates are tested to pass. Findings show as Suggestions in the diagram's inspector and go
back to the assistant after each of its changes.

### D-78 · The assistant doesn't depend on one model vendor

Mogram talks to models through one small interface (`server/ai/providers`): Claude through
Anthropic's Messages API, any OpenAI-compatible API (DeepSeek, OpenAI and the many that copy
it), and a scripted provider that runs the whole loop from scripts for tests and demos. The
server chooses from its environment; nothing in the browser knows which. Each turn picks a
fast model for small edits and questions and a strong one for building, planning and reviewing
(Auto), or the person chooses. Model quality is measured, not assumed: `pnpm eval:ai` runs
realistic requests against any provider and checks the results (parses, passes review, right
icons, nested and connected properly).

The briefing — how to work with the person, the whole file format, an example diagram — is the
same for every turn, so providers cache it (marked for Claude's prompt caching; automatic for
DeepSeek and OpenAI), and each turn only adds the diagram and the request.

### D-79 · Tools are core edits; the server runs the model, the browser replays the changes

The model changes diagrams only through tools that map onto the same core edits the canvas
uses (`lib/ai/tools.ts`): add a YAML snippet (`insertYaml`, names kept as written), update,
remove, rename, move into a container, arrange, scenes, settings, a whole file, plus
`ask_user` and `propose_plan`, which end the turn. Every change is checked before it counts: a
change that would add a parse error, or an icon Mogram doesn't have (with the closest real ones
named), is refused with the reason, and the review's new findings go back with each success.
Removing more than eight elements needs the person's agreement first.

The model runs on the server (keys never reach the browser) and each accepted change streams to
the browser, which applies the same deterministic `applyOp`, so the canvas changes as the model
works; at the end the server's files are the truth if anything drifted.

### D-80 · A turn is one undo step and one version, and the person's edits wait

While the assistant works, the person can look, select and pan but not edit (their edits,
undo and redo say why and wait), so nothing is lost when the turn's changes land. The person's
own changes are saved as their own version first; the whole turn is then one undo step (Undo on
its card, or ⌘Z) and one version named by the request, with ✨ in the history. What it touches
glows violet on the canvas, and Follow selects it as it goes.

### D-81 · What the assistant sees, keeps and costs

A turn sends the diagram's files, what's selected and the request to the model provider through
Mogram's server; earlier turns go as text only. The server records tokens and how each turn
ended, never the prompt or the diagram; the conversation is kept in the person's browser.
Signing in is required unless the server allows otherwise, with a per-minute burst limit and a
daily allowance per person.

### D-82 · Capacity is a model, not an animation

Scaling is shown from what the diagram says, never scripted per picture: how elements scale
(`scale`: copies between a least and a most, or sizes), what one copy handles (`capacity`), and
what they do with traffic (`routing`, `hit`, `queue`), plus traffic on connections. A pure engine
(`@mogram/core/capacity`) works out, for each moment, the traffic every part carries and the
copies or size each needs to stay near its target, as part of state resolution: past its limits
something is overloaded because of its load. Anything that changes the moment — a scene, the
traffic slider, an edit — changes the plan, and a deterministic timeline turns plans into motion
(copies start one after another and are removed after a cool-down; a machine grows smoothly into a
new size — at first a resize restarted it and paused its traffic, removed on 2026-10-05 at the
product owner's request), so the editor, viewers, thumbnails and exports all show the same thing.

- **Traffic is relative.** 1× is normal; a connection's `traffic` multiplies what it would
  otherwise carry, so a scene's `users_to_lb: 5x` is a spike that flows on through everything
  after it, and one written for one diagram means the same in another.
- **Room is reserved.** A scale set keeps room for its most copies and a machine for its largest
  size, so the layout never jumps while it scales; the frame grows and shrinks inside a faint
  outline of that room, which shows how far it can go.
- **The drawing explains the kind of scaling.** Out: more copies of the same icon in a frame,
  traffic fanning out to each, a load bar per copy. Up: the tile opens into a machine whose
  cores, memory and disks grow and shrink smoothly, up to a ceiling.

### D-83 · Concepts are diagrams with roles, and applying one is generic

A concept (horizontal scaling, caching, failover…) is an ordinary diagram with a `concept:`
section: a summary and the roles its elements play. Nothing knows any particular concept:
applying one copies what its role elements do with traffic onto the elements picked for them
(never over what they already have), joins them the way the concept joins its roles, and brings
its scenes along, aimed at the picked elements — more traffic where people enter the concept
becomes more traffic where it enters the person's diagram on its way there. So the nine built-in
concepts and any a person writes (a draft or account diagram with a `concept:` section, made
from the Diagram inspector or from a selection) work the same way, in the library, the editor and
the assistant (`apply_concept`, `set_scaling`).

### D-84 · Traffic belongs on the arrow, and can rise and fall on its own

Using capacity (D-82) showed that scaling was hard to set up and "how much traffic" lived in five
places: a connection's flow, its dot speed and density, its traffic level, scene lines and a
floating traffic slider. Now an arrow's Traffic says it all — whether it flows, how much
(steady, or **waves** and **bursts** that rise and fall on their own) and its share of a split —
and the dots follow it; speed and density are only how the dots look (Style). A pattern is a
step function of the clock, so the plan changes at known moments and the capacity timeline
follows them lazily from the time asked about: the editor, the viewer, thumbnails and exports
agree, a tab left in the background catches up, and an animated export lasts whole cycles and
loops. The traffic slider is gone. Scenes stay for moments (an outage, a rollback, Black Friday
held at 5×), where a scene's level holds an arrow steady; showing scaling needs none. Built-in
concepts use patterns for load and scenes for moments.

### D-85 · Concepts are filed by topic and platform, in a library of their own

Concepts sat in the building-blocks library as a flat list: fine for nine, not for the hundreds
planned (networking, Azure, AWS, Git…). Agreed with the product owner on 2026-10-05:

- **Filed, not just listed.** Every concept has a **topic** (scaling, reliability, networking,
  security, data, messaging, containers, delivery, git, architecture) and a **platform** (any,
  Azure, AWS, Google Cloud, Kubernetes), plus free **tags** for search. The lists are fixed in
  `@mogram/core/presets`, so a typo is a warning naming the closest one rather than a new shelf.
- **Two kinds.** A concept with roles is a **pattern**, applied to your own elements; one
  without is an **explainer**, inserted or opened as it is. Nothing else differs, so an
  explainer becomes a pattern by naming parts.
- **A package of their own.** `@mogram/concepts` holds one `.mogram.yaml` per concept under
  `content/<topic>/`. A generated catalog (id, title, summary, topic, platform, tags, kind,
  parts) lists, filters and searches them without loading any; the diagrams load a topic at a
  time, when one is opened or a preview scrolls into view. A test refuses a concept that doesn't
  read cleanly, tell its story or sit under its topic, and a catalog that's out of date.
- **Their own tab and a gallery.** The left panel is Library (building blocks only), Concepts
  and the assistant. The Concepts tab searches and lists yours and the recently used ones above
  topics with counts; Browse all opens a gallery with topics down the side and a preview of
  each. Filters appear only when they'd change something: a platform filter once some concepts
  are a platform's own (listing only those platforms, opening on the diagram's cloud, its own
  first; general concepts always show), and Apply / Explain once there are both kinds.
- **The assistant searches, it isn't told.** `find_concepts` searches the catalog, and
  `apply_concept` takes an id; the server sends the concept's file with the change, so the
  browser replays it without the whole library in the editor's bundle.

Adding concepts, and scenes that show, hide or move elements (for Git), come later.
