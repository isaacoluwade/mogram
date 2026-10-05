# Mogram architecture

Mogram is a web app for animated, stateful architecture diagrams whose source of truth is clean
YAML. This document explains how the codebase is organised and how data flows through it.
Individual choices and their reasons are recorded in `decisions.md`.

## 1. Repository layout

```
mogram/
├─ apps/
│  └─ web/                 Next.js 16 app: marketing, auth, dashboard, editor, viewer, REST API
├─ packages/
│  ├─ core/                @mogram/core: the file format and every diagram rule. Pure TypeScript,
│  │                       no DOM, no React. Reusable by a future CLI, VS Code extension, GitHub app.
│  ├─ icons/               @mogram/icons: icon catalogue (Azure, AWS, Google Cloud, Kubernetes,
│  │                       generic, tool logos), aliases, search, and the build script that
│  │                       turns each vendor's pinned download into the SVG assets.
│  └─ concepts/            @mogram/concepts: Mogram's concepts, one `.mogram.yaml` per concept
│                          under `content/<topic>/`; a generated catalog (what lists, filters
│                          and searches them without loading any), the diagrams loaded a topic
│                          at a time, and search (D-85).
├─ docs/                   Requirements, architecture, decisions, build log, research, file format
├─ sample-app/             Reference app supplied with the brief (not part of the workspace)
└─ screenshots/            Reference screenshots supplied with the brief
```

pnpm workspaces + Turborepo. Each package owns its scripts (`build`, `lint`, `typecheck`,
`test`); the root only delegates through `turbo run`.

## 2. The core idea: files in, pictures out

```
 files (path → text)                         ← the only persisted state
     │  parseProject()        @mogram/core/format
     ▼
 Diagram model (+ diagnostics with file:line)
     │  resolveState(scene)   @mogram/core/state      cascade, roll-up, backups, nested paths,
     │                                                 capacity (@mogram/core/capacity)
     │  computeLayout()       @mogram/core/layout     grid units → boxes, auto-size, auto-place
     │  routeConnections()    @mogram/core/routing    orthogonal routing around obstacles
     ▼
 Scene graph (absolute geometry + resolved visuals)
     │  render(t)             apps/web/features/canvas  SVG; t comes from one shared clock
     ▼
 Live canvas · thumbnails · SVG/PNG/JPEG/GIF/WebP export · share viewer
```

Edits never mutate the model. Every edit is a **command** in `@mogram/core/edit` that rewrites the
YAML `Document` objects (from the `yaml` library) so comments, key order and formatting written by
humans survive. The command returns new file texts; the model is re-derived from them. Undo/redo
is a stack of file-text snapshots, which is simple and always correct.

Transient interaction (dragging, resizing, drawing a connection) never touches YAML. It lives in an
"overrides" layer in the editor store and is committed as one command on pointer-up.

## 3. `@mogram/core` modules

| Module        | Responsibility                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `format/`     | YAML parsing with source positions, schema validation, plain-language diagnostics, single-file and folder projects, multi-file merge, duplicate-name detection, serialisation helpers                                                                        |
| `model/`      | Normalised types: components, containers, groups, connections, ports, scenes, tours, cards, layout, decorations, settings                                                                                                                                    |
| `presets/`    | Data for every preset family: state, flow, motion, container style, canvas theme. Durations in the {0.25, 0.5, 1, 2, 4}s set                                                                                                                                 |
| `state/`      | Effective state: base → scene override → ancestor cascade → roll-up → backup connections → nested instance paths                                                                                                                                             |
| `layout/`     | Grid units ↔ pixels, component and container geometry, auto-size, auto-placement of unpinned elements, group boundaries, z-order                                                                                                                             |
| `routing/`    | Orthogonal connector routing (sparse visibility grid + A* with bend penalty), manual waypoints, curved/straight styles, path sampling                                                                                                                        |
| `timeline/`   | Shared-clock maths, motion functions `f(t)`, flow dash offsets, scene transitions, story timelines for export                                                                                                                                                |
| `tours/`      | Tour graph, validation, traversal, choices                                                                                                                                                                                                                   |
| `nested/`     | Folder graph, `opens:` resolution, loop detection, ports, stubs, instance paths                                                                                                                                                                              |
| `capacity/`   | Traffic through the graph, copies and sizes for each moment (`planCapacity`), traffic patterns (`patterns.ts`), and the deterministic timeline that turns plans into motion, following patterns as time is asked about (`CapacityTimeline`); scaling presets |
| `concepts/`   | Applying or inserting any concept (`applyConcept`, `insertConcept`, `suggestBindings`) and what one is (`conceptInfo`, `conceptKind`); the concepts themselves are in `@mogram/concepts`                                                                     |
| `edit/`       | Commands: add/move/reparent/rename/delete elements, presets, scenes, tours, cards, layout, decorations, file moves, paste, scaling and capacity, concepts                                                                                                    |
| `model/names` | Label ↔ name conversion, unique-name generation (part of `model/`)                                                                                                                                                                                           |

## 4. `apps/web` structure

```
src/
├─ app/                          Routes only: load data on the server, compose features.
│  ├─ page.tsx                   Landing page                          (features/marketing)
│  ├─ sign-in/                   Email + one-time code                 (features/auth)
│  ├─ diagrams/                  Dashboard: cloud diagrams + drafts    (features/dashboard)
│  ├─ draft/new/                 New browser draft from a template
│  ├─ draft/[id]/  …/view        Draft editor (IndexedDB) and preview  (features/editor, viewer)
│  ├─ edit/[id]/   …/view        Cloud editor (owner only) and preview
│  ├─ s/[shareId]/               Public share viewer
│  ├─ security/  docs/format/    Long-form pages (the format page renders docs/file-format.md)
│  ├─ not-found, error, global-error
│  ├─ dev/canvas/                Renderer check, 404 in production
│  └─ api/                       REST: auth/*, diagrams, diagrams/[id]{,/share,/duplicate,
│                                /revisions{,/[rid]{,/restore}}}, share/[shareId], dev/mailbox
├─ components/ui/                Design-system primitives (Eden). The only place visual decisions live.
├─ components/screens.tsx        Full-page "loading" and "not available" screens
├─ features/
│  ├─ canvas/                    SVG renderer: scene model, frames f(t), clock, camera, icons,
│  │  └─ svg/                    nodes (component, container, connection, decorations, stubs)
│  ├─ editor/                    The editor, and everything only it uses
│  │  ├─ store/                  Zustand store per editor instance (document, history, gestures)
│  │  ├─ canvas/                 Editable canvas, pointer gestures, hit testing, overlays, menu
│  │  ├─ chrome/                 Top bars, toolbar, scene strip, zoom, breadcrumbs
│  │  ├─ library/  inspector/    Icon library panel; inspector, card editor, arrange
│  │  ├─ concepts/               The Concepts tab and the gallery (Browse all)
│  │  ├─ tours/  panels/         Tour authoring; the code panel
│  │  ├─ dialogs/                Export, share, history, shortcuts, open files
│  │  └─ persistence/            Hosts (browser draft / cloud), autosave, thumbnails
│  ├─ viewer/                    Read-only viewer: controller (cards, tours, nested zoom, deep
│  │                             links), camera motion, level geometry, chrome, card panel
│  ├─ drafts/                    Drafts in this browser (IndexedDB), used by editor, viewer, dashboard
│  ├─ concepts/                  Concepts on offer (Mogram's, your drafts', your account's), recently
│  │                             used, and browsing them by topic, platform, kind and search
│  ├─ cards/  code/              Markdown cards; the CodeMirror YAML editor
│  ├─ export/                    Static render, rasteriser, PNG/JPEG/SVG, GIF worker, WebP muxer
│  ├─ share/                     The deep-link format
│  ├─ files/                     Open from computer (files, folders, zips), download, names
│  ├─ dashboard/  marketing/     Dashboard; landing page, long-form page layout
│  ├─ auth/                      Sign-in form
│  └─ templates/                 Built-in diagrams, one folder of real Mogram files each
│                                (`aks/mogram.yaml`, `aks/aks/mogram.yaml`, …), imported as text
├─ server/                       server-only: env, db (Drizzle + PGlite/Postgres), auth, diagrams
│                                service + sanitising, email, HTTP helpers
├─ lib/                          Isomorphic: API contracts (zod) and typed client, auth client,
│                                small hooks (useDraft, useMounted, reduced motion), formatting
├─ generated/                    Build-time output (the file-format spec as a module); not edited
└─ styles/                       tokens.css (Eden tokens), globals.css, colours TS needs as literals
```

Rules that keep this clean (enforced by lint and review, see `engineering-standards.md`):

- `app/` files contain no business logic; they call `server/` services or render `features/`.
- Features depend downwards: `canvas` (rendering) is used by `editor`, `viewer`, `export` and
  previews. The editor is imported only by its routes (ESLint enforces it), so panels and dialogs
  that need the editor's store live inside `features/editor`. Pieces several features share
  (drafts, deep links, file names, templates) have their own feature folders, and
  `components/`, `lib/` and `styles/` can't import features at all.
- `server/*` is marked `server-only`, and ESLint forbids importing it outside `app/`, `server/`
  and tests.
- Only `components/ui` and `styles/` contain colour decisions (`pnpm check:ui`, which also covers
  the renderer). Diagram rendering draws with colours from `@mogram/core` presets and theme data;
  the one literal it needs lives in `styles/colors.ts`.

## 5. Rendering and animation

- The diagram is one SVG drawn in a single paint order (`paintOrder` in `@mogram/core/layout`,
  D-31). Every container is a stacking context: per level, back to front, highlight zones → each
  child container followed by everything inside it → group outlines → connections → components →
  text. Each band is sorted by `z` (`layout.<name>.z`, siblings only) and then document order, so
  a container's `z` carries its contents. A connection is drawn in the innermost container holding
  both ends. The canvas background is below everything; selection and handles above.
- Each SVG gets its own `<defs>` ids (`useId`), because several diagrams share a page (scene
  thumbnails, landing previews) and must not pick up each other's gradients or filters.
- Text is measured with a canvas in the same font the SVG uses; widths measured before the web
  fonts finish loading are thrown away and measured again (`useFontsVersion`).
- One `Clock` drives everything. Animated primitives register an update callback; a single
  `requestAnimationFrame` loop calls them with the same `t`, writing attributes through refs, so
  React does not re-render per frame.
- Every animation is a pure function of `t` from `@mogram/core/timeline`. Export calls the same
  functions with a fixed `t`, which is why GIFs loop seamlessly (all periods divide 4s).
- Traffic dots are a dashed stroke (`dasharray: 0 spacing`, round caps) whose `dashoffset` is
  driven by the clock: one attribute per connection per frame.
- Scene changes tween numeric "visual vectors" (ring colour, desaturation, dimming, glow,
  ghosting, dot opacity) over 600ms, also as a function of `t`.
- Capacity (D-82): each live canvas follows its resolved state with one `CapacityTimeline`
  (`features/canvas/capacity.ts`), updated when the plan changes and queried at the clock's `t`.
  Scale sets and machines (`fleet-node`, `machine-node`) draw from pure frame functions
  (`capacity-frames.ts`); still pictures use the settled plan, and animated exports run a
  timeline through the story's scene changes.

## 6. Persistence

| Where             | What                                                                                                        | When                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Browser IndexedDB | Drafts (files + name + times) and their thumbnails, in two separate databases                               | Always available, no account |
| Computer          | Open `.mogram.yaml` / `.mogram` files, a folder, or a `.zip`; download a single file or a zip of the folder | Any time                     |
| Postgres          | Users, sessions, codes (hashed), diagrams (working copy + version), revisions, share settings               | Signed-in cloud saves        |

Both editors share one host interface (`features/editor/persistence/host.tsx`): the browser host
autosaves drafts to IndexedDB after 400ms of quiet; the cloud host autosaves through the REST API
after 1.2s, keeps the version it was based on, and raises the conflict banner on a 409. A
thumbnail is rendered a few seconds after a save and stored separately, so it never delays a save.

Local development uses PGlite (embedded Postgres, persisted to `apps/web/.data/`). Production uses
any Postgres via `DATABASE_URL`. Same Drizzle schema and migrations for both.

Cloud saves use optimistic concurrency: every save sends the version it was based on; the server
rejects stale writes with `409` so two tabs can't silently overwrite each other. Revisions are
coalesced (one per author per 5 minutes) so history stays readable.

## 7. Security model

- Diagrams are private by default. A share link uses an unguessable 128-bit id and can be revoked.
  Private diagrams return `404` to everyone except the owner, so existence is never leaked.
- Every API input is validated with zod; every diagram route checks ownership.
- Auth: Better Auth with email one-time codes and httpOnly cookies, behind an allowlist of the
  endpoints Mogram uses, a per-address throttle in Postgres, and per-IP limits that only trust a
  configured proxy header (D-35). Write routes refuse cross-site requests.
- Content Security Policy with per-request nonces (set in `proxy.ts`), plus `frame-ancestors 'none'`,
  `nosniff`, strict referrer policy, permissions policy.
- User SVG icons are sanitised (DOMPurify SVG profile) on upload and on the server, and are only
  ever rendered as `<image>` data URIs, where scripts cannot run.
- Card markdown is rendered without raw HTML; link URLs are filtered.
- YAML parsing limits aliases and document size to prevent resource-exhaustion attacks.
