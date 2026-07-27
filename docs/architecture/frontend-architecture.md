# Web Frontend Architecture

## Goals

- Present all confirmed FoodMind business capabilities in a responsive browser UI.
- Keep backend-owned rules and data authoritative.
- Isolate features so team members can work independently.
- Make loading, error, permission, and fallback states visible and testable.
- Maintain behavioural parity with Android without forcing identical layouts.

## Layer Model

```text
Routes and page composition
          ↓
Feature components and hooks
          ↓
Feature API adapters
          ↓
Shared HTTP client
          ↓
Spring Boot /api/v1
```

### `app`

Owns application-level composition:

- Router
- Query client
- Authentication provider
- Error boundary
- Theme or design-system provider
- Application bootstrap

It must not become a storage location for feature logic.

### `features`

Each feature owns:

- Pages
- Feature-specific components
- Query and mutation hooks
- Request/response adapters
- Form schema adapters
- Feature tests

Feature folders should expose a deliberate public surface. Avoid deep imports into another feature.

### `components`

Shared components are reusable and presentation-focused:

- `ui`: fields, buttons, dialogs, typography, chart wrappers
- `layout`: navigation, responsive shells, section layouts
- `feedback`: loading, error, empty, unavailable, and fallback messages

Shared components do not make API calls.

### `lib`

Use for stable cross-cutting adapters:

- HTTP client and error parsing
- Authentication/session integration
- Shared validation helpers

Do not put feature-specific business rules in `lib`.

## Server-State Flow

```text
Component
  → feature query hook
  → API adapter
  → shared HTTP client
  → backend
  → typed response
  → query cache
  → rendered state
```

Rules:

- Preserve backend error codes.
- Keep DTO-to-view-model mapping near the feature boundary.
- Do not silently replace server errors with empty arrays.
- Display explicit fallback metadata for recommendations.
- Avoid optimistic updates for permission-sensitive operations unless rollback is reliable.

## Form Strategy

- The backend remains the final validator.
- Client validation provides immediate, matching feedback.
- Map backend field errors back to the exact input.
- Preserve the user's values after recoverable failure.
- Disable duplicate submissions while a command is active.
- Use idempotency support when the backend contract provides it.

## Recommendation UI

The recommendation page must represent:

- Context submitted by the user
- Personal, Exploratory, and Group-inspired cards
- Grounded reason text and reason-code-derived badges
- Model or fallback status
- Accept, reject, and re-recommend actions
- Rejection reason and later-rating workflows

The UI must not infer a reason from a numeric model score.

## Chatbot UI

- Chatbot is for authorised platform search, summary, comparison, and navigation.
- It does not become the UI entry point for recommendation or cooking.
- Source references remain visible and navigable.
- Inaccessible or removed references show a permission-safe unavailable state.
- Unsupported answers must not be rendered as confirmed facts.

## Analytics UI

Backend responses define metrics. The client selects appropriate accessible visual forms:

- Bar chart for frequency and outcomes
- Line chart for spending trends
- Donut or equivalent for cuisine distribution
- Summary cards for mean rating and acceptance

Every chart requires a textual summary and an empty state.

## Error Taxonomy

The UI should distinguish:

- Validation error
- Authentication expired
- Forbidden
- Resource no longer available
- Network unavailable
- Backend unavailable
- Agent unavailable with deterministic recommendation fallback
- Inference unavailable with fallback metadata
- Unexpected error

Never reveal raw upstream or stack-trace text.

## Cross-Client Parity

Parity means:

- Same use cases
- Same backend contract
- Same validation semantics
- Same permission outcomes
- Same metric values
- Same feedback events

Parity does not require identical screen layout or navigation.
