# Web Frontend Architecture

## Goals

- Present all confirmed FoodMind business capabilities in a responsive browser UI.
- Make the recommendation decision the primary home-screen job while keeping Cooking one mode switch away.
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

### `routes`

Each lazy route module owns:

- Pages
- Feature-specific components
- Query and mutation hooks
- Request/response adapters
- Form schema adapters
- Feature tests

Route modules share only presentation-neutral components and stable `lib` adapters. They do not import another route module's internals.

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
- Personal history and authorised trusted-group signals
- The lead candidate as the single primary result
- Personal, Exploratory, and Group-inspired alternatives returned in the same ordered candidate set
- Grounded reason text and reason-code-derived badges
- Model or fallback status
- Accept, reject, and re-recommend actions
- Rejection reason and later-rating workflows

The UI must not infer a reason from a numeric model score.

The backend contract still returns up to three intentionally different candidates. The
home screen initially spotlights the highest-ranked candidate and lets the user move to
another returned candidate without silently starting a new recommendation session.

## Application Shell and Discovery

- The top-level mode switch contains **Eat out & delivery** and **Cooking**.
- Recommendation mode is selected by default and owns the strongest call to action.
- Persistent labeled navigation contains Home, Groups, Explore, Saved, and Me.
- Groups is the shared decision workspace for membership, authorised history, and sharing a result. Polls and voting are not part of the current contract.
- Explore uses an image-led post grid, but its data remains limited to authorised group-visible records and curated platform content.
- Public/follower feeds, public internet restaurant search, ordering, and payment remain outside the MVP.
- The Cooking mode reads manually supplied or backend-provided pantry context; it must not imply automatic inventory capture.

## Chatbot UI

- Chatbot is for authorised platform search, summary, comparison, and navigation.
- Users ask in natural language; the backend selects and returns the supported route unless an advanced caller explicitly supplies one.
- It does not become the UI entry point for recommendation or cooking.
- Source references remain visible and navigable.
- Inaccessible or removed references show a permission-safe unavailable state.
- Unsupported answers must not be rendered as confirmed facts.

## Record media UI

- The client follows the backend-owned create, direct PUT, finalise, and delete lifecycle.
- The object-storage request receives only the returned allow-listed headers and never the FoodMind bearer token.
- A local object URL may preview the selected image before save; it is revoked when no longer needed and never persisted.
- Saved records show attachment status only until the backend supplies an authorised read/download contract.

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
