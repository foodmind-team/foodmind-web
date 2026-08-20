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

## Configuration

| Variable | Required for | Notes |
| --- | --- | --- |
| `VITE_APP_ENV` | Local environment label | Use `local` for development |
| `FOODMIND_BACKEND_ORIGIN` | Vite proxy | Usually `http://localhost:8080` |
| `FOODMIND_MEDIA_ORIGIN` | Browser-accessible private media | Must be one exact HTTPS virtual-hosted S3 origin; omit it when media is disabled |

Copy `.env.example`; do not commit `.env.local`. Production middleware rejects invalid media origins rather than widening the browser content-security policy.

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
