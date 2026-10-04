# Mogram

Animated, stateful architecture diagrams that you build like a design, explain with cards and
tours, share with a link, and keep in your repository as clean YAML.

- Product requirements: `Mogram Product Requirements Document (1).md`
- Documentation: [`docs/`](docs/README.md) — requirements with evidence, architecture, decisions,
  the file format, security, engineering standards and the build log.
- Screenshots of every page and state: [`docs/screenshots/`](docs/screenshots)

## Run it

Requirements: Node 20.19+ and pnpm 10.

```sh
pnpm install
pnpm --filter @mogram/web dev        # http://localhost:3100
```

No configuration is needed locally: data is stored in an embedded Postgres (PGlite) under
`apps/web/.data/`, and sign-in codes are printed in the server log and shown at
`/api/dev/mailbox`. Anywhere else (a production build, or any host that isn't localhost) the
server refuses to start without `BETTER_AUTH_SECRET` and `RESEND_API_KEY`, and behind a proxy it
needs `TRUSTED_IP_HEADER` or `TRUSTED_PROXIES` for per-IP rate limits; see
`apps/web/.env.example` and `docs/security.md`.

## Check it

```sh
pnpm lint && pnpm typecheck && pnpm check:ui && pnpm test   # all packages
pnpm --filter @mogram/web test:e2e                          # browser journeys (uses installed Chrome)
pnpm --filter @mogram/web build                             # production build
```

`E2E_BASE_URL=http://localhost:3200 pnpm --filter @mogram/web test:e2e` runs the browser suite
against another server, such as `next start` on a production build. The `cloud` journeys sign in
through the development mailbox, so they run against local development only.

## Update the icons

The icon catalogue is generated and committed, so the app and tests never need the network.
To adopt a new vendor release, change its pinned URL and SHA-256 in
`packages/icons/scripts/lib/` (`azure.ts`, `aws.ts`, `gcp.ts`, `kubernetes.ts`) and run:

```sh
pnpm --filter @mogram/icons build:catalog
```

Downloads are cached in `packages/icons/vendor/` (not committed) and checked against their hash.
Behind a TLS-inspecting proxy, point `NODE_EXTRA_CA_CERTS` at the proxy's root certificate.

## Layout

| Path             | What                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `apps/web`       | The Next.js app: marketing, sign-in, dashboard, editor, viewer and REST API                |
| `packages/core`  | `@mogram/core`: the file format and every diagram rule, pure TypeScript                    |
| `packages/icons` | `@mogram/icons`: Azure, AWS, Google Cloud, Kubernetes, generic and tool icons, with search |
| `docs`           | Requirements, architecture, decisions, security, build log, research                       |
| `sample-app`     | Reference app supplied with the brief (kept locally, not in git)                           |
