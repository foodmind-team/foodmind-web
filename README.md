# FoodMind Web

FoodMind Web is the responsive React client for the FoodMind decision loop: record and share experience, generate a grounded recommendation, decide, and feed the outcome back into future choices. The application implements the current Spring Boot `/api/v1` contract and keeps authorization and business rules on the backend.

## Included capabilities

- Memory-only access-token authentication with cookie-backed, single-flight refresh
- Profile and complete preference management
- Food and drink record history, creation, detail, editing, deletion, and ETag conflict recovery
- Trusted groups, invitations, members, authorised feeds, recommendation sharing, and Want to Try
- Recommendation context, ordered candidates, feedback, fallback disclosure, and true re-recommendation
- Authorised Explore and Search with permission-safe unavailable states
- Manual-ingredient cooking plans and cooking history
- Grounded chat sessions, references, messages, comparison, summary, and navigation responses
- Backend-owned dashboard metrics and weekly recaps with accessible text/table alternatives
- Responsive navigation, URL-backed filters, offline/error/empty states, keyboard focus, and reduced motion

Not included: public follower feeds, polls, ordering, payment, maps, photo uploads, inferred pantry inventory, or browser access to private service origins.

## Stack

React 19, TypeScript, Vite, React Router, TanStack Query, React Hook Form with Zod, Tailwind CSS tokens, Recharts, typed OpenAPI, Vitest, Testing Library, MSW, axe, and Playwright.

## Start locally

Use Node 24 (also pinned in `.node-version`), start the backend on port 8080, then:

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

The browser always calls same-origin `/api/v1`. Vite reads the server-only `FOODMIND_BACKEND_ORIGIN` value and proxies those calls; no backend origin is compiled into browser JavaScript.

## Quality commands

```powershell
npm run api:check
npm run api:coverage
npm run lint
npm run typecheck
npm test -- --run
npm run test:coverage
npm run build
npm run test:e2e
npm run validate
```

`api:check` confirms that the generated types match the committed OpenAPI snapshot and lock metadata. `api:coverage` proves that every backend operation has either a production consumer or an approved, documented contract blocker. `validate` runs both API gates, lint, type, test coverage, and the production build. Playwright is a separate deterministic browser gate.

## API contract

The immutable snapshot is in `contracts/backend-openapi-v1.yaml`; its backend commit and SHA-256 are recorded alongside it. Refresh tokens and CSRF companions returned by the compatibility response are deliberately not persisted. Access tokens exist only in module memory, while the browser forwards the backend's HttpOnly refresh cookie through the same-origin proxy.

To intentionally update the snapshot, first commit the backend contract and then run:

```powershell
npm run api:snapshot -- <backend-commit>
npm run api:generate
```

## Documentation

- [Implementation plan](docs/planning/web-frontend-development-plan.md)
- [Backend integration](docs/planning/backend-api-integration-plan.md)
- [Testing and delivery](docs/planning/git-testing-and-delivery-plan.md)
- [Frontend architecture](docs/architecture/frontend-architecture.md)
- [Local development](docs/operations/local-development.md)
- [Security review](docs/operations/security-review.md)
