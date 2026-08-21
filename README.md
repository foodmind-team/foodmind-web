# FoodMind Web

FoodMind Web is the responsive browser client for recording food experiences, receiving grounded recommendations, deciding what to eat, and feeding outcomes back into the product. It consumes the public FoodMind Backend contract and keeps business rules and authorisation on the server.

## Live demo

Try the deployed application at [https://13.229.2.154.sslip.io/](https://13.229.2.154.sslip.io/). This is the public Web entry point; API requests remain on the same HTTPS origin under `/api/v1`.

## Features

- Authentication, profile and preference management
- Food and drink records, history, optional record images, and optimistic-concurrency recovery
- Trusted groups, authorised Explore and Search, recommendation sharing, and Want to Try
- Recommendation, cooking-plan, grounded-chat, dashboard, and weekly-recap journeys
- Responsive, keyboard-accessible UI with explicit loading, empty, offline, and error states

## Prerequisites

- Node.js `24.16.x` (see `package.json` and `.node-version`)
- npm
- A running FoodMind Backend at `http://localhost:8080` for live development

## Quick start

```bash
git clone https://github.com/foodmind-team/foodmind-web.git
cd foodmind-web
cp .env.example .env.local
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

`FOODMIND_BACKEND_ORIGIN` is read by Vite's development proxy. Browser code calls same-origin `/api/v1`, so do not put a private Agent or inference-service URL into the frontend configuration. For local HTTP authentication, set the Backend's `WEB_COOKIE_SECURE=false` and allow the Vite origin in `WEB_ALLOWED_ORIGINS`.

## Local deployment

For the complete product, start the Backend through
[FoodMind Infrastructure](https://github.com/foodmind-team/foodmind-infra)
first. Wait until `http://localhost:8080/actuator/health/readiness` returns
`UP`; the Web app is then started separately and proxies only to that Backend.

```powershell
# In foodmind-infra, after copying .env from .env.example:
docker compose up --build -d --wait

# In a separate foodmind-web checkout:
Set-Location ..\foodmind-web
Copy-Item .env.example .env.local
# Keep FOODMIND_BACKEND_ORIGIN=http://localhost:8080 in .env.local.
npm ci
npm run dev
```

Open the Vite address shown in the terminal, normally
`http://localhost:5173`. The browser requests same-origin `/api/v1`; Vite
forwards those calls to the Backend. Do not add database, MinIO, Chatbot,
Cooking, Recommendation, or Inference URLs to `.env.local`.

If port `5173` is in use, run `npm run dev -- --port <unused-port>` and add
that exact origin to the Backend's `WEB_ALLOWED_ORIGINS` for a Backend-only
setup. Use `npm run build && npm run preview` for a local production-style
check, and stop Vite with `Ctrl+C`; stop the integrated dependencies from the
Infra checkout with `docker compose down`.

## Configuration

| Variable | Required for | Notes |
| --- | --- | --- |
| `VITE_APP_ENV` | Local environment label | Use `local` for development |
| `FOODMIND_BACKEND_ORIGIN` | Vite proxy | Usually `http://localhost:8080` |
| `FOODMIND_MEDIA_ORIGIN` | Browser-accessible private media | Must be one exact HTTPS virtual-hosted S3 origin; omit it when media is disabled |

Copy `.env.example`; do not commit `.env.local`. Production middleware rejects invalid media origins rather than widening the browser content-security policy.

## API configuration and credentials

Create `.env.local` from `.env.example` and configure only public origins:

```dotenv
VITE_APP_ENV=local
FOODMIND_BACKEND_ORIGIN=http://localhost:8080
# Leave blank when media is disabled; otherwise use one exact HTTPS S3 origin.
FOODMIND_MEDIA_ORIGIN=https://<approved-media-host>
```

`FOODMIND_BACKEND_ORIGIN` is consumed by the Vite development proxy, while the
browser continues to call same-origin `/api/v1`. There is intentionally no
frontend API key, Agent token, database credential, OneMap token, LLM key, or
S3 secret configuration. Login and refresh credentials are issued and held by
the Backend as HttpOnly cookies; private integrations remain server-side.

For a different local Vite port, add that exact browser origin to the Backend's
`WEB_ALLOWED_ORIGINS`. Do not prefix a secret with `VITE_`: every `VITE_`
variable is bundled into client code.

## API contract

[`contracts/backend-openapi-v1.yaml`](contracts/backend-openapi-v1.yaml) is the committed Backend contract snapshot. After an intentional Backend contract update, refresh it before changing client behaviour:

```bash
npm run api:snapshot -- <backend-commit>
npm run api:generate
```

The API check and coverage check guard the snapshot, generated types, and declared consumer coverage.

## Commands

```bash
npm run dev                 # development server
npm run validate            # contract, lint, type, unit, coverage, and build gates
npm run security:check      # CSP and frontend security checks
npm run test:e2e            # deterministic Playwright browser suite
npm run test:e2e:real       # real-stack browser suite; requires local services
npm run build && npm run preview
```

## Repository layout

```text
src/          Routes, components, services, stores, hooks, and tests
contracts/    Versioned Backend OpenAPI snapshot and metadata
e2e/          Deterministic Playwright tests
e2e-real/     Real-stack Playwright journeys
scripts/      Contract, security, bundle, and build checks
docs/         Architecture, operations, security, UX, and planning notes
```

## Contributing

Use the typed Backend contract instead of duplicating business rules in the browser. Keep accessible labels and keyboard flows intact, add tests for user-visible changes, and run `npm run validate`, `npm run security:check`, and the relevant E2E suite before a pull request.

## Security

Access tokens stay in memory and refresh credentials remain HttpOnly cookies. Never add service tokens, cloud credentials, or private runtime URLs to browser code.

## License

No open-source license is currently included in this repository. Obtain permission from the maintainers before redistributing or reusing the code.
