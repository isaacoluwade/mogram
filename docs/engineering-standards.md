# Engineering standards

These rules apply to every change in this repository, whether written by a person or an agent.
A change that breaks one of them is not finished.

## 1. Boundaries

1. **`@mogram/core` is pure.** No DOM, no React, no Node-only APIs, no `Date.now()` or randomness
   inside logic (pass them in). Every exported function is unit-tested.
2. **Routes are thin.** Files in `apps/web/src/app` load data and compose features. No business
   rules, no styling decisions beyond layout composition.
3. **Server code is server-only.** Everything under `apps/web/src/server` starts with
   `import "server-only"`. Client code never imports it.
4. **Features own their folder.** `features/<name>` exposes a public `index.ts`. Other features
   import only from that file, never from internals.
5. **One way to do each thing.** REST route handlers for mutations from the client, Server
   Components for initial reads, zod contracts in `lib/api` shared by both sides.

## 2. UI discipline

1. All colours, radii, shadows, font sizes and motion curves come from `styles/tokens.css`
   (Eden's tokens). Tailwind's default palette is removed, so `bg-red-500` does not exist.
2. Only `components/ui/*` may contain raw visual decisions (exact alpha layers, shadows). Feature
   code composes primitives. `pnpm check:ui` fails on raw `#hex`, `rgb(`, `hsl(` or arbitrary
   colour utilities outside `components/ui`, `styles`, and diagram preset data in `@mogram/core`.
3. Every interactive element has a visible focus state, an accessible name, and a hit target of at
   least 28px in the editor chrome (Eden's row height is 30px) and 40px on touch layouts.
4. Icon-only buttons always have a tooltip and `aria-label`.
5. Every view handles four states: loading, empty, error, and data.
6. Respect `prefers-reduced-motion` everywhere, including diagram motion (paused by default for
   those users, with a visible play control).
7. Layouts work from 360px to 2560px wide. Test at 390, 834, 1280 and 1440.

## 3. TypeScript

1. `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` are on. No `any`; use
   `unknown` and narrow. No non-null assertions (`!`) except in tests.
2. Prefer discriminated unions over boolean flags. Exhaustive `switch` with `assertNever`.
3. Name things for what they mean in the PRD vocabulary: component, container, group,
   connection, preset, state, scene, card, tour, port, instance, layout.
4. Functions are small and do one thing. A file over ~300 lines is a signal to split.

## 4. React

1. Server Components by default; `"use client"` only where interaction needs it, as low in the
   tree as possible.
2. No async client components. Props crossing the server/client boundary are serialisable.
3. Don't sync derived state with effects; compute during render or with selectors.
4. Per-frame values (camera during a gesture, animation `t`) go through refs, never React state.
5. No components defined inside components. Compound components over boolean props.
6. Stores are created per editor instance (`createStore` + context), never module singletons.

## 5. Security

1. Validate every request body, query and param with zod. Reject unknown fields.
2. Check ownership on every diagram route. Private diagrams return `404`, not `403`.
3. Never render user HTML. Markdown without raw HTML; SVG uploads sanitised and rendered as images.
4. Secrets only in server env. Anything prefixed `NEXT_PUBLIC_` is public.
5. Limits on everything that a user controls: request size, file count, file size, YAML aliases,
   name length, upload size.

## 6. Testing

1. `@mogram/core`: unit tests for every rule, including the PRD examples verbatim.
2. Web: component tests for UI primitives and key hooks; route handler tests against an in-memory
   PGlite database.
3. End-to-end (Playwright): every PRD user journey, plus screenshots at the four widths above.
4. A bug fix comes with a test that fails without the fix.

## 7. Documentation

1. Non-obvious decisions get an entry in `docs/decisions.md` and a `D-<n>` reference at the code.
2. Comments explain _why_, not _what_. No commented-out code.
3. `docs/build-log.md` records each step: what was built, how it was verified, what changed.
