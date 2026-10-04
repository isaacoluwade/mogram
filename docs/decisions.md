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
