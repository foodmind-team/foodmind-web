# Web local development

## Prerequisites

- Node.js 24, as pinned by `.node-version` and `package.json#engines`
- npm and Git
- FoodMind Backend, normally at `http://localhost:8080`

## Install and configure

```powershell
npm ci
Copy-Item .env.example .env.local
```

`.env.local` is ignored. `FOODMIND_BACKEND_ORIGIN` is read only by Vite's development server; it is intentionally not prefixed with `VITE_` and cannot enter browser code. `VITE_APP_ENV` is a non-secret display label.

## Run

```powershell
npm run dev
```

The UI calls `/api/v1` on the Vite origin. Vite forwards those requests to the configured backend, including cookies, bearer headers, idempotency keys, and `If-Match`.

## Validate

```powershell
npm run validate
npm run test:e2e
```

The deterministic unit/component suite uses synthetic MSW data. The Playwright suite is the fast browser regression gate; release acceptance additionally runs the documented manual real-stack scenario without route interception. It checks authenticated routing, recommendation behavior, backend-selected chat routing, the credential-free media lifecycle, URL-backed filters, responsive widths, data-rich analytics/record layouts, and WCAG 2.2 AA serious/critical findings. Screenshots are written into `test-results/` for CI review. Install Chromium once with `npx playwright install chromium` if the local Playwright cache is empty.

## Backend contract workflow

`contracts/backend-openapi-v1.yaml` is the accepted Web snapshot. `npm run api:check` verifies the snapshot SHA-256, its exact backend commit and path, the current sibling backend OpenAPI source, and regenerated TypeScript. `npm run api:coverage` fails if any of the 83 snapshot operations lacks a production call site or if an exception is added; the current exception list is empty. An intentional update must reference a backend commit whose committed OpenAPI file exactly matches its worktree:

```powershell
npm run api:snapshot -- <backend-commit>
npm run api:generate
npm run api:check
```

The generator applies one documented compatibility correction to the backend's legacy chat `422` schema reference. Recommendation enums and nullable lifecycle fields are generated directly from the corrected backend contract; route code must not widen them with manual casts.

## Production build

```powershell
npm run build
npm run preview
```

`dist/` contains the static application and the Cloudflare Worker-compatible server entry. The server entry adds SPA fallback, security headers, and a closed same-origin API proxy. The Vercel function implements the same proxy boundary for the documented demo target.

## Troubleshooting

- `502 UPSTREAM_UNAVAILABLE`: set `FOODMIND_BACKEND_ORIGIN` and confirm the backend is running.
- Repeated sign-in: confirm refresh-cookie domain, `Secure`/`SameSite` settings, backend Web origin, and local system time.
- Contract drift: update from an explicit backend commit; never edit generated `schema.ts`.
- Stale private data after auth changes: use the in-app logout flow; it clears memory session and the private Query cache.
