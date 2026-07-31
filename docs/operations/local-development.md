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

The deterministic unit/component/API suite uses synthetic MSW data. The browser suite intercepts only the documented `/api/v1` surface and checks authenticated routing, recommendation behavior, URL-backed filters, mandatory responsive widths, data-rich analytics/record layouts, and WCAG 2.2 AA serious/critical findings across primary destinations. Its screenshots are written into `test-results/` for CI review. Install Chromium once with `npx playwright install chromium` if the local Playwright cache is empty.

## Backend contract workflow

`contracts/backend-openapi-v1.yaml` is the accepted Web snapshot. `npm run api:check` regenerates into a temporary directory and fails on drift. `npm run api:coverage` also fails if a snapshot operation has neither a production call site nor an explicit exception in `contracts/backend-api-coverage.json`, or when an exception becomes stale. The only current exceptions are the three media-write operations blocked by the approved missing authorized media-read contract. An intentional update must reference a backend commit whose committed OpenAPI file exactly matches its worktree:

```powershell
npm run api:snapshot -- <backend-commit>
npm run api:generate
npm run api:check
```

The generator applies one documented compatibility correction to the backend's broken chat `422` schema reference. Recommendation success values are widened only at the route boundary until the backend contract is corrected.

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
