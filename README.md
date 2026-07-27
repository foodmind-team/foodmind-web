# FoodMind Web

FoodMind Web is the responsive browser client for FoodMind. It presents the same business capabilities as the native Android application and consumes only the public Spring Boot API.

> **Current status:** Vite/React scaffold plus directory framework. The FoodMind screens, routing, API integration, query management, charts, and tests described below are not yet implemented.

## Responsibilities

The Web client is responsible for:

- Authentication screens and client-side session handling
- Preference and profile forms
- Food and drink record workflows
- Personal history
- Trusted groups, group feeds, and Want to Try
- Recommendation context forms and result cards
- Recommendation feedback
- Cooking-plan input and results
- FoodMind Chatbot interactions
- Dashboard and weekly recap presentation
- Responsive layout, accessibility, and browser UX

The Web client is not responsible for:

- Authoritative business rules
- Permission decisions
- Recommendation filtering or scoring
- Analytics calculations
- Agent or inference-service calls
- Storing secrets

## Technology Direction

Currently installed:

- React
- TypeScript
- Vite
- Oxlint

Planned by the canonical FoodMind design:

- React Router
- TanStack Query
- Tailwind CSS
- Recharts
- A component-testing framework and Mock Service Worker

Dependencies should be introduced only with the feature that uses them.

## System Boundary

```text
Browser
  → FoodMind Web
  → HTTPS Spring Boot /api/v1
  → Backend-owned domain, security, Agent, ML, and persistence flows
```

The browser must never receive Agent-service URLs, inference-service URLs, database credentials, AWS secrets, or internal service tokens.

## Repository Structure

```text
foodmind-web/
├── .github/workflows/        # CI/CD workflows
├── docs/
│   ├── architecture/         # Frontend architecture
│   └── operations/           # Local development and deployment notes
├── e2e/
│   ├── fixtures/
│   └── specs/
├── public/                   # Static public assets
└── src/
    ├── app/
    │   ├── providers/        # Global providers
    │   └── router/           # Route configuration and guards
    ├── components/
    │   ├── ui/               # Reusable visual primitives
    │   ├── layout/           # Page shells and navigation
    │   └── feedback/         # Loading, error, and empty states
    ├── features/
    │   ├── auth/
    │   ├── profile/
    │   ├── records/
    │   ├── groups/
    │   ├── recommendations/
    │   ├── cooking/
    │   ├── chat/
    │   └── analytics/
    ├── lib/
    │   ├── api/
    │   ├── auth/
    │   └── validation/
    ├── routes/
    ├── styles/
    ├── test/
    │   ├── fixtures/
    │   └── mocks/
    └── types/
```

## Feature Boundaries

Each feature owns its page components, feature-specific components, hooks, request adapters, and tests. Shared components must remain domain-neutral.

| Feature | Intended scope |
| --- | --- |
| `auth` | Login, registration, protected-route entry |
| `profile` | User profile and preference management |
| `records` | Food/drink create, edit, details, and history |
| `groups` | Group membership, feed, visibility, and Want to Try |
| `recommendations` | Context input, three result cards, and feedback |
| `cooking` | Ingredient/time/budget input and structured plan |
| `chat` | Sessions, messages, references, summary, and comparison |
| `analytics` | Dashboard charts and weekly recap |

Features should communicate through backend data and stable shared abstractions, not by importing another feature's internal components or query cache keys.

## API Contract

- Base path: `/api/v1`
- Contract owner: `foodmind-backend`
- Contract source: committed backend OpenAPI document
- Authentication: JWT bearer token
- Errors: stable backend error codes and field errors
- Dates and timestamps: ISO 8601
- IDs: opaque strings

The Web client must not recalculate backend-owned values such as recommendation eligibility, acceptance rate, spending totals, or cuisine distribution.

## Environment Variables

Only variables prefixed with `VITE_` are exposed to browser code.

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Public Spring Boot base URL |
| `VITE_APP_ENV` | `local`, `staging`, or `production-demo` label |

Do not place secrets in Vite environment variables. Values compiled into the bundle are public.

## Local Development

```powershell
npm ci
npm run dev
```

Quality checks:

```powershell
npm run lint
npm run build
```

The repository does not yet have a test script. Add one alongside the selected test framework rather than documenting tests that do not exist.

See [local development](docs/operations/local-development.md).

## State Management Rules

- TanStack Query should own remote server state.
- Component state should own temporary interaction state.
- URL state should represent shareable filters and navigation state.
- Do not copy server responses into a second global store without a demonstrated need.
- Query keys are stable and feature-owned.
- Mutation success invalidates only the affected queries.

## Authentication Rules

- Prefer an agreed secure token-storage strategy based on the backend contract.
- Never log access tokens.
- Clear session state after authentication failure.
- Route guards improve UX but do not provide security; backend checks remain authoritative.
- Do not decode a JWT and treat its unverified contents as permission proof.

## UI and Accessibility

- Every form field has a visible label and associated error.
- Keyboard navigation works for forms, dialogs, menus, and Chatbot controls.
- Loading, empty, error, and offline states are explicit.
- Recommendation types are conveyed by text, not colour alone.
- Charts include text summaries and accessible labels.
- Responsive behaviour is tested at mobile, tablet, and desktop widths.
- Food safety and hygiene language must remain decision-support language, not a guarantee.

## Testing Strategy

- Unit tests for pure formatting and validation adapters
- Component tests for forms, cards, and state transitions
- Query tests with mocked network responses
- Accessibility checks for core pages
- Contract fixtures generated from or verified against OpenAPI
- End-to-end tests for UC-01 through UC-09
- Permission/error-state scenarios shared with Android UAT

## Contribution Workflow

1. Link the work to an Issue and acceptance criteria.
2. Confirm the backend OpenAPI version.
3. Implement inside the owning feature.
4. Include loading, empty, error, and success states.
5. Add or update tests.
6. Run lint, type checking, tests, and production build.
7. Open a reviewed Pull Request.

Do not copy backend or Android implementation code into this repository.

## Further Reading

- [Frontend architecture](docs/architecture/frontend-architecture.md)
- [Local development](docs/operations/local-development.md)
