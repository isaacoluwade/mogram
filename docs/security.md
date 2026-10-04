# Security

How Mogram protects diagrams and the people who use it (AC-5, AC-6, AC-7). The user-facing
version of this page is `/security` in the app; this document is for developers and reviewers,
with pointers to the code and tests that enforce each rule.

## 1. Where diagrams live

| Where                   | What                                                                | Who can read it                                       |
| ----------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| The browser (IndexedDB) | Drafts made without an account: files and a thumbnail               | Only that browser profile. Never sent to the server.  |
| Postgres                | Users, sessions, verification codes (hashed), diagrams, revisions   | The owner, through the API, after an ownership check. |
| Share links (`/s/…`)    | The latest saved version of a diagram whose owner turned sharing on | Anyone with the link, read-only.                      |
| The person's computer   | Downloaded `.mogram.yaml`, zips, and exports (made in the browser)  | Them.                                                 |

Drafts are stored by `features/drafts/drafts.ts` in two IndexedDB databases (files,
thumbnails) so a thumbnail write can never race a save of the files.

## 2. Accounts and sessions

- **Email one-time codes, no passwords** (D-6, `server/auth/auth.ts`). Six digits, expire after
  10 minutes, 5 attempts, stored hashed (`storeOTP: "hashed"`), a code works once.
- **Only the auth endpoints Mogram uses are served** (`server/auth/handler.ts`): send a code, sign
  in with a code, read the session, sign out, and the health check. Every other Better Auth path
  (password sign-up, email change, OTP check without sign-in…) answers 404.
- **Per-address throttle** (`server/auth/throttle.ts`): at most 5 code emails and 10 sign-in
  attempts per email address per 15 minutes, whatever IP they come from, so rotating
  `X-Forwarded-For` doesn't help. It's one atomic upsert in Postgres (`auth_throttle`), keyed by a
  SHA-256 of the scope and address, so the table never stores an address. Over the limit is 429
  with `Retry-After: 900`.
- **Per-client rate limits** (Better Auth): 5 code emails and 10 sign-in attempts per minute per
  client IP, 60 requests per minute overall on `/api/auth/*` (off only under `NODE_ENV=test`).
  Reading the session (`/api/auth/get-session`, called by every page) is exempt: it is cheap and
  reveals nothing, and counting it would lock out people sharing an office IP.
  IP limits are only as good as the IP: set `TRUSTED_IP_HEADER` (the header your proxy sets, e.g.
  `x-real-ip`) or `TRUSTED_PROXIES` (CIDRs allowed to append to `x-forwarded-for`). With neither
  set outside local development, IP tracking is off rather than trusting a header anyone can send,
  and the per-address throttle above still applies.
- **Request bodies are capped while streaming** (`server/http.ts`): reading stops and the request
  gets 413 as soon as it passes 6 MB (16 KB for auth), so an oversized body is never buffered.
- **Sessions** are httpOnly cookies with the `mogram` prefix, `Secure` whenever `APP_URL` is
  https, 30-day expiry refreshed daily. Better Auth checks the `Origin` of state-changing requests
  against `APP_URL` (`trustedOrigins`).
- **Secrets**: `BETTER_AUTH_SECRET` is required everywhere except local development
  (`server/env.ts` refuses to start without it). "Local development" means `NODE_ENV` isn't
  `production` **and** `APP_URL` is `localhost`, `127.0.0.1` or `[::1]`, so a staging deployment
  run with a development build still needs real secrets. Nothing secret uses `NEXT_PUBLIC_`.
- **Development-only surfaces**: the mailbox at `/api/dev/mailbox` (recent sign-in codes, so local
  sign-in works without an email provider) and `/dev/canvas` exist only in local development as
  defined above; everywhere else they answer 404.
- **Configuration is checked at start-up** (`src/instrumentation.ts` → `server/env.ts`): outside
  local development the server refuses to start without `BETTER_AUTH_SECRET` or `RESEND_API_KEY`.
  Codes are sent in the background (so a response never reveals whether an address exists), so a
  missing email key would otherwise fail silently while people wait for a code. Empty `KEY=` lines
  count as unset. Tested in `test/env.test.ts`.

Tests: `test/api.test.ts` (wrong code rejected, a code works once, unauthenticated requests 401,
unused auth endpoints 404, the per-address throttle holds while `X-Forwarded-For` rotates,
oversized bodies 413, cross-site writes 403, a restore brings the name back).

## 3. Authorization

- Every diagram query is scoped by owner (`server/diagrams/service.ts`). A diagram that exists but
  belongs to someone else returns **404**, exactly like one that doesn't exist, so ids can't be
  probed (AC-5). Malformed ids (not UUIDs) are 404 before touching the database.
- Revisions, sharing, duplication and deletion all go through the same ownership check.
- Saves use optimistic concurrency: `baseVersion` must match or the server answers 409 with the
  current version, so two tabs never silently overwrite each other (AC-4).
- **Cross-site writes are refused** (`fromThisSite` in `server/http.ts`): every state-changing app
  route rejects requests with `Sec-Fetch-Site: cross-site`, or with an `Origin` that is neither
  `APP_URL` nor the request's own origin (403 `cross_site`). Cookies are `SameSite=Lax` as well;
  this is the second lock.
- Creating a diagram and restoring a version each write the diagram and its revision in one
  transaction, so a failure never leaves a diagram without history. Restoring brings back the
  name with the files, since renames are written into the YAML.

Tests: "hides one person's diagram from everyone else with a 404, never a 403", "saves with
optimistic concurrency" in `test/api.test.ts`; the two-tab conflict journey in `e2e/cloud.spec.ts`.

## 4. Share links

- The id is 128 random bits (`randomBytes(16)`, base64url, 22 characters), unrelated to the
  diagram id or owner. Malformed ids are rejected by shape before a query.
- Turning sharing off makes the link 404 immediately; "Reset link" issues a new id and the old one
  stops working. Turning sharing back on brings back the **same** link (the dialog says so), so a
  link sent earlier works again; reset it to make sure it doesn't.
- The public response contains only the name, files, the "what if" setting and the update time —
  no owner, ids or versions. It is `Cache-Control: no-store` and `X-Robots-Tag: noindex`; the page
  sets `robots: noindex` and `referrer: no-referrer`.
- "What if" changes made by viewers stay in their browser and are never sent anywhere.

Tests: "share links" in `test/api.test.ts`; `e2e/cloud.spec.ts` checks the link works signed out
and returns the not-found page after the owner makes the diagram private.

## 5. Input validation and limits

Every request body is parsed with a strict zod schema (`lib/api/contracts.ts`; unknown keys are
rejected). Limits: names ≤ 120 characters, ≤ 500 files, paths ≤ 200 characters with a
conservative character set and no `.`/`..` segments, ≤ 2 MB per file and ≤ 1 MB per YAML or
markdown file (the most the parser reads), ≤ 5 MB per diagram, thumbnails ≤ 250 KB, request
bodies ≤ 6 MB. Files are typed by extension: YAML/markdown/text as text, images only as base64
data URLs, SVG only after sanitising, anything else refused.

YAML parsing (`packages/core/src/format/yaml-read.ts`) refuses files over 1 MB and documents that
use more than 50 aliases, so a "billion laughs" file (aliases of aliases expanding exponentially)
is rejected before it can exhaust memory. Opening files from the computer applies the same path
and size rules, drops hidden files and `__MACOSX` entries, and never takes in a path that climbs
out of the folder (`features/files/open.ts`, tested in `open.test.ts`).

The minimal-diff writer (`packages/core/src/edit/diff.ts`) bounds its search at 2,000 changed
lines (memory grows with the square of that); texts further apart are written whole instead, so
pasting a huge unrelated file can't stall the tab.

Data dragged onto the canvas is checked before use (`features/editor/dnd.ts`): any page or
extension can put data under Mogram's drag type, so anything but `{ type, label }` strings of
sane length is ignored.

## 6. Untrusted content

- **Uploaded SVG icons** are sanitised with DOMPurify's SVG profile on upload and again on the
  server, refusing any SVG that references remote content (`href`/`src`/`url()` to anything but
  `#…`). Icons are only ever drawn as `<image>` data URLs, where scripts can't run (IC-4).
- **Card markdown** is rendered by `react-markdown` with `skipHtml`; link URLs are limited to
  http(s), mailto, in-diagram `#name` links and relative project paths; external links open with
  `rel="noopener noreferrer nofollow"`; images are https URLs or files in the diagram folder.
  Tested in `features/cards/markdown.test.tsx`. One privacy note for authors: an https image in a
  card is loaded from its host when someone opens the card, so that host sees the viewer's IP
  address (as with any web page). Images stored in the diagram folder don't leave Mogram.
- **Catalogue icons** come from vendor downloads pinned by SHA-256 (Microsoft, AWS, Google, and a
  Kubernetes commit checked against one manifest hash), so a changed or tampered download fails the
  build. Every SVG is rebuilt by the catalogue script and must pass `assertSafe`: no scripts, event
  handlers, `foreignObject`, images, links or references outside the file. Tests check every
  shipped file again.
- **Icons are only fetched when they exist**: an icon type is turned into a URL only if it is in
  the catalogue (`isCatalogIcon` in `@mogram/icons`), so YAML being typed never becomes a stream
  of requests for files that don't exist.
- **Labels, names and YAML text** are only ever rendered as React text nodes (no
  `dangerouslySetInnerHTML` anywhere; `react/no-danger` is an ESLint error).
- **Thumbnails** are accepted only as PNG/JPEG/WebP base64 data URLs; anything else is dropped.

## 7. The page

Per-request Content Security Policy with a fresh nonce (`src/proxy.ts`):

```
default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:;
media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

plus `upgrade-insecure-requests` when served over HTTPS, and `'unsafe-eval'` only in development
(React's dev tooling). Styles allow inline attributes because React and SVG rendering set style
attributes; style injection can't run code. Other headers (`next.config.ts`): `nosniff`,
`X-Frame-Options: DENY`, strict-origin referrer policy, a restrictive Permissions-Policy, COOP
`same-origin`, HSTS. The end-to-end suite runs against a production build with this policy
(`E2E_BASE_URL`), including the GIF/WebP export worker.

## 8. Exports

PNG, JPEG, SVG, GIF and animated WebP are produced entirely in the browser: the diagram is
rendered to SVG with embedded fonts, rasterised to a canvas, and encoded (GIF in a Web Worker).
Nothing is uploaded to export.

## 9. Reporting and review

Each release gets a security review against this document (findings and fixes are recorded in
`build-log.md`). Dependencies are pinned to exact versions in `package.json`.
