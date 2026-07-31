# FoodMind Web Frontend Development Plan

## 1. Outcome and success criteria

Build a responsive production-quality React web application around the FoodMind
decision loop:

```text
Record/share
  -> Generate
  -> Filter and rank
  -> Explain
  -> Choose, reject, or request again
  -> Rate
  -> Analyse
```

The application is successful when:

- UC01–UC09 from the proposal are usable from a supported desktop or mobile
  browser;
- the recommendation action is the dominant Home action and displays one lead
  candidate at a time;
- all persistent data comes from the Spring backend under `/api/v1`;
- Web and Android have matching use cases, validation semantics, permission
  outcomes, feedback events, and metric values;
- every data-dependent screen has loading, empty, error, permission, unavailable,
  and offline behavior;
- the application meets the accessibility, security, testing, and deployment
  gates in `git-testing-and-delivery-plan.md`;
- no browser bundle or log contains an access token, refresh token, internal
  service address, or sensitive personal data.

## 2. Verified starting point

### 2.1 Current Web repository

The current repository is a Vite/React/TypeScript prototype:

- `src/App.tsx` is a monolithic, static component with manual section state.
- `src/App.css` contains the complete prototype visual system.
- generation, navigation, saving, group activity, and profile behavior currently
  use fake timers or local sample data;
- there is no router, typed HTTP layer, authentication provider, server-state
  cache, form framework, charting library, or automated test runner;
- lint and production build pass at the planning baseline;
- `.openai/hosting.json` links the repository to the existing private Sites
  project;
- the current build creates a Cloudflare Worker-compatible
  `dist/server/index.js`.

The prototype is a visual reference, not a data contract.

### 2.2 Current backend

The Spring backend has implemented modules for:

- authentication and refresh sessions;
- current-user profile and preferences;
- catalogue reference data and details;
- food and drink records plus combined history;
- groups, membership, invitation joining, group feed, and recommendation shares;
- recommendations, fallback, feedback, and history;
- Want to Try, Search, and authorized Explore;
- cooking generation and history;
- grounded chat sessions, references, and messages;
- dashboard metrics and weekly recap;
- media upload creation, finalization, and deletion.

The frontend must use:

`foodmind-backend/src/main/resources/openapi/openapi.yaml`

as its HTTP schema input. Backend controller, service, and test code must be
checked when the schema appears ambiguous.

### 2.3 Design direction to preserve

Keep and formalize:

- forest green, lime, coral, and warm-paper surfaces;
- strong display typography and calm body copy;
- large, rounded, tactile cards;
- restrained CSS shapes and Lucide icons rather than decorative illustration;
- bottom navigation on mobile and persistent labeled navigation on larger
  screens;
- Eat out & delivery as the default Home mode;
- Cooking one mode switch away;
- a single prominent Generate action in the first Home viewport;
- one lead recommendation with transparent reasons.

Remove or correct:

- the notification bell, because no notification API exists;
- group polls/votes, because they are outside MVP and have no endpoint;
- automatic pantry and expiry claims;
- fake public-community content in Explore;
- fake photo or media rendering;
- local-only saved state;
- no-op buttons and simulated network delays.

## 3. Technology decisions

### 3.1 Runtime and build

- Keep React, TypeScript, Vite, npm, and the current lockfile.
- Pin the Node version supported by the installed Vite release in
  `.node-version`, `package.json#engines`, and CI.
- Keep the existing Cloudflare Worker-compatible Sites build.
- Add a Vercel configuration/function only for the documented public demo path.
- Retain strict TypeScript. Do not weaken `noUnusedLocals`,
  `noUnusedParameters`, or bundler module resolution.

### 3.2 Required application libraries

Add compatible, lockfile-pinned versions of:

- React Router for routing and route boundaries;
- TanStack Query for server state;
- Tailwind CSS with its Vite integration;
- React Hook Form and Zod for forms;
- `openapi-typescript` and `openapi-fetch` for API typing;
- Recharts for analytics;
- Vitest, React Testing Library, user-event, jest-dom, MSW, and axe for
  automated component work;
- Playwright for browser acceptance testing.

Do not add Redux. Local UI state belongs in route/component state; server state
belongs in TanStack Query; shareable view state belongs in URL parameters.

### 3.3 Target source structure

```text
src/
  app/
    providers/
      AppProviders.tsx
      AuthProvider.tsx
      QueryProvider.tsx
    router/
      router.tsx
      route-error-boundary.tsx
      protected-route.tsx
  components/
    ui/
    layout/
    feedback/
  features/
    auth/
    profile/
    catalogue/
    records/
    groups/
    recommendations/
    saved/
    explore/
    cooking/
    chat/
    analytics/
  lib/
    api/
      client.ts
      errors.ts
      generated/schema.ts
      idempotency.ts
      query-keys.ts
    auth/
    format/
    validation/
  routes/
  test/
    fixtures/
    mocks/
    setup.ts
contracts/
  backend-openapi-v1.yaml
  backend-openapi-v1.lock.json
e2e/
```

Rules:

- A feature owns its API adapter, view-model mapping, hooks, forms, feature
  components, and feature tests.
- Shared UI components never call the API.
- `lib` contains only stable cross-cutting infrastructure.
- One feature may import another feature only through an explicit public export.
- Generated API types are never edited manually.
- Backend DTO-to-view-model mapping stays close to the feature boundary.

## 4. Application shell and route specification

### 4.1 Public routes

| Route | Screen | Behavior |
|---|---|---|
| `/login` | Login | Email/password login, session bootstrap, field errors, safe return URL |
| `/register` | Registration | Display name, email, password, time zone, WEB client |

An authenticated user visiting a public auth route is redirected to a validated
same-origin return path or `/`.

### 4.2 Protected routes

| Route | Screen | Primary data |
|---|---|---|
| `/` | Recommendation Home | current user, preferences, groups, recommendation form/session |
| `/recommendations/:sessionId` | Recommendation detail | recommendation session |
| `/history` | Combined record history | `/history` |
| `/records/new` | Record composer | catalogue, groups |
| `/records/:recordType/:id` | Record detail | food or drink detail |
| `/records/:recordType/:id/edit` | Record editor | detail, ETag/version |
| `/groups` | Group index | group list |
| `/groups/join` | Join group | invitation token |
| `/groups/:groupId` | Group workspace | detail, members, feed |
| `/explore` | Authorized discovery | Explore cursor feed |
| `/saved` | Want to Try | saved list |
| `/cooking` | Cooking input/history | manual ingredients, cooking history |
| `/cooking/:planId` | Cooking result | plan detail |
| `/chat` | Chat session index | sessions |
| `/chat/:sessionId` | Grounded conversation | session, references, messages |
| `/dashboard` | Analytics dashboard | metric rows |
| `/weekly-recaps/:weekStart` | Weekly recap | recap response |
| `/me` | Account hub | current user and useful destinations |
| `/me/preferences` | Preference editor | user preferences, reference data |
| `/catalogue/:sourceType/:sourceId` | Catalogue detail | meal, place, or product |

Unknown routes render a branded not-found page. Protected routes wait for session
bootstrap rather than briefly rendering private content.

### 4.3 Persistent navigation

Primary destinations are always labeled:

1. Home
2. Groups
3. Explore
4. Saved
5. Me

Mobile uses a fixed bottom navigation with safe-area padding. Desktop uses a
left rail or compact top-level navigation without changing destination names.
History, Dashboard, Chat, and Preferences are secondary destinations exposed
from Me and contextual actions.

### 4.4 Home modes

The Home header contains:

- Eat out & delivery — selected by default and linked to `/`;
- Cooking — navigates to `/cooking`.

The switch changes route; it does not retain incompatible hidden form state.
Browser Back restores the previous mode naturally.

## 5. Design system and responsive behavior

### 5.1 Tokens

Move the current palette and spacing decisions into semantic Tailwind theme
tokens:

- `forest`: brand and high-emphasis surfaces;
- `leaf`: secondary brand;
- `lime`: primary highlight;
- `coral`: warm accent and selected moments;
- `paper`: page background;
- `surface`: raised cards;
- `ink`: primary text;
- semantic `success`, `warning`, `danger`, `info`, and `muted`.

Also define:

- three typography roles: display, heading, body;
- compact and comfortable control sizes;
- card, input, pill, and dialog radii;
- focus ring and keyboard offset;
- low, medium, and overlay shadows;
- standard transition durations;
- a zero-motion alternative.

Colors may be refined for contrast, but the palette character must remain.

### 5.2 Shared components

Build components in this order:

1. `Button`, `IconButton`, `TextLink`
2. `Input`, `TextArea`, `Select`, `Checkbox`, `RadioGroup`
3. `MultiSelect`, `RatingInput`, `MoneyInput`, `DateTimeInput`
4. `Card`, `Badge`, `Avatar`, `Divider`
5. `Dialog`, `ConfirmDialog`, `Toast`, `LiveRegion`
6. `Skeleton`, `EmptyState`, `ErrorState`, `OfflineState`
7. `ForbiddenState`, `UnavailableCard`, `FallbackBanner`
8. `AppShell`, `PageHeader`, `ModeSwitch`, `PrimaryNav`
9. Accessible chart wrapper and data-table fallback

Each component requires keyboard behavior, focus treatment, disabled and busy
states, and at least one component test before broad use.

### 5.3 Breakpoints

- Mobile: 320–639 px
- Tablet: 640–1023 px
- Desktop: 1024 px and above

Mandatory review widths are 360, 768, and 1440 px. The Home Generate action must
be visible without scrolling at 360 px in the default mode.

### 5.4 Accessibility

- Meet WCAG 2.2 AA contrast.
- Use native elements before ARIA.
- Keep primary navigation and form labels visible.
- Use at least 44 by 44 px touch targets.
- Preserve meaningful heading order.
- Restore focus after dialogs and failed submissions.
- Announce asynchronous completion and errors in a live region.
- Never encode status using color alone.
- Respect `prefers-reduced-motion`.
- Give charts a text summary and accessible table.
- Do not insert backend text with `dangerouslySetInnerHTML`.

## 6. Feature implementation specification

### 6.1 Authentication

Build:

- silent session bootstrap;
- register;
- login;
- refresh;
- logout current session;
- logout all sessions;
- protected-route handling;
- session-expired return-to-login flow.

Access tokens live only in memory. Refresh is cookie-backed and single-flight.
The API integration plan defines the exact retry algorithm.

Required states:

- first visit while session is checked;
- anonymous;
- authenticated;
- invalid credentials;
- field validation error;
- expired session;
- rate limited;
- backend unavailable;
- offline.

### 6.2 Profile and preferences

`/me` presents identity and links to Preferences, History, Dashboard, Recap, and
Chat. It must not display fabricated learning counts.

The preference form uses catalogue reference data and supports the exact backend
fields and enums. Preserve values after recoverable failures and map backend
field errors to their exact controls.

### 6.3 Food and drink records

Use a shared record shell with type-specific sections:

- food record fields;
- drink record fields;
- rating and would-eat/drink-again fields where supported;
- price/currency;
- consumed time;
- visibility: Private or an authorized group.

Support create, list/history, detail, update, and delete. Put filters, page, size,
sort, and record type in URL search parameters.

Update behavior:

- include the exact quoted record version in `If-Match`;
- show conflict details and a Reload latest action on `409`;
- never overwrite silently;
- do not offer clearing of optional fields until the backend defines explicit
  clear semantics.

Media controls remain hidden in the first release because the backend has no
authorized media-read/download response for rendering uploaded assets.

### 6.4 Groups

Group index:

- group cards from the user’s group list;
- Create group;
- Join with invitation token;
- empty and error states.

Group workspace:

- group name, description, status, and allowed edit action;
- members and authorized member removal;
- invitation creation with one-time copy warning;
- cursor-paginated feed;
- Recommend for this group;
- share a selected recommendation.

There is no poll/voting UI. Group permissions come only from backend outcomes;
do not infer administrator rights from client-maintained state.

### 6.5 Recommendation decision loop

Home form fields:

- optional group;
- meal type;
- budget and currency;
- area;
- latitude/longitude only when the user deliberately supplies location;
- distance;
- mood;
- requested time;
- allergens;
- dietary preferences;
- maximum spice;
- cleanliness constraint.

The first viewport summarizes the current context and has one prominent Generate
button. It must not show a list of restaurants before a session exists.

Generation result:

- display backend status and fallback status;
- order candidates exactly as returned;
- show the first as the lead;
- show candidate type: Personal, Exploratory, or Group-inspired;
- render server reason codes as controlled badges;
- render the backend explanation as plain text;
- show price, area/place, meal, and availability fields that are actually
  present;
- never derive a reason from a score.

“Try another”:

- increments a local candidate index;
- stays inside the current ordered candidate array;
- makes no API request;
- becomes disabled when no additional candidate exists.

Feedback:

- Accept sends `ACCEPTED` for the displayed candidate;
- Reject requires a documented rejection reason and sends `REJECTED`;
- later rating sends `LATER_RATED` when a related record is available;
- would-eat-again sends `WOULD_EAT_AGAIN`;
- submit buttons remain disabled while the idempotent command is active.

True re-recommendation:

1. Send `RERECOMMEND_REQUESTED` for the current session.
2. Generate a new session with the old `sessionId` as `parentSessionId`.
3. Use a new idempotency key.
4. Navigate to the new session.

The current backend cannot read previously submitted feedback. The UI may keep
confirmation in the active query cache but must not persist or fabricate it
after reload. Duplicate/conflict responses become a clear already-recorded
message.

### 6.6 Explore, Search, and Want to Try

Explore is authorized, not public. Supported types:

- `GROUP_RECORD`
- `CURATED_PRODUCT`
- `CURATED_PLACE`

Supported visibility:

- `GROUP`
- `CURATED`

Use cursor pagination. Persist type/topic filters in the URL. Use deterministic
FoodMind visual placeholders when `imageReference` is absent.

Search uses `/search` and has a debounced query. It is not merged into the
Explore cache. Results link to record, meal, product, or place detail based on
source type.

Save mapping:

- `GROUP_RECORD` -> `FOOD_RECORD`
- `CURATED_PRODUCT` -> `FOOD_PRODUCT`
- `CURATED_PLACE` -> `PLACE`

Want to Try is backend-owned. If `sourceAvailable` is false, retain the card and
label it unavailable; do not delete it automatically.

### 6.7 Cooking

Only manual ingredient entry is promised:

- 1–30 ingredient rows;
- serving count;
- optional maximum minutes;
- optional budget/currency;
- dietary preferences;
- allergens.

Result screen:

- status and fallback banner;
- recipe name and explanation;
- ingredient quantities and `AVAILABLE`/`TO_BUY`;
- ordered steps;
- warnings;
- serving and time summary;
- history navigation.

Do not claim pantry synchronization or expiry detection.

### 6.8 Grounded chat

Desktop: session list plus active conversation.  
Mobile: session list and conversation as distinct route views.

Support:

- session creation;
- list and detail;
- archive;
- add authorized references;
- message send;
- cursor-paginated history;
- source cards and unavailable source state.

Render documented routes visibly:

- Search
- Summary
- Compare
- Navigation
- Out of Scope

Render response status:

- succeeded;
- fallback succeeded;
- unsupported;
- failed.

Recommendation and Cooking keep dedicated entry points; Chat must not silently
invoke those workflows.

### 6.9 Dashboard and recap

Use backend metric rows without recomputing business values.

| Metric family | Primary visualization |
|---|---|
| Food/drink counts | grouped bars |
| Mean rating | KPI plus sample count |
| Spending | one line per currency |
| Cuisine distribution | donut plus table |
| Repeat frequency | KPI/trend |
| Acceptance/rejection | grouped bars |
| Rejection reasons | ranked bars |
| Would-eat-again | KPI/outcome bars |
| Selected candidate type | distribution bars |

Rules:

- null and `empty: true` remain “No data,” never zero;
- currencies are never combined;
- date range and grouping are URL parameters;
- every chart includes a textual summary and table;
- weekly recap uses the backend week-start date exactly.

## 7. Codex implementation procedure

Codex must follow this loop for every issue:

### Step 1: establish scope

- Read the issue and acceptance criteria.
- Identify relevant UC and proposal section.
- Read the relevant operation, schemas, backend DTO/controller/service, and
  backend tests.
- Record contract questions in the issue before writing a workaround.
- Check `git status` in every sibling repository and modify only
  `foodmind-web`.

### Step 2: establish branch and contract

- Fetch `origin`.
- Branch from the latest protected default branch.
- If the backend API changed, update the committed OpenAPI snapshot, lock, and
  generated types first.
- Run `api:check` before feature code so later TypeScript failures identify
  contract use accurately.

### Step 3: implement a vertical slice

Implement in this order:

1. route and permission guard;
2. API adapter using generated types;
3. query/mutation hook;
4. view-model mapper;
5. loading, empty, error, permission, offline, and success states;
6. form/interaction;
7. MSW fixtures copied from the contract;
8. component tests;
9. E2E happy path or critical failure path.

Do not scaffold the entire feature before connecting one complete flow.

### Step 4: validate continuously

- Run the nearest test after each coherent file group.
- Run type checking before committing an API adapter.
- Exercise slow and failed network behavior.
- Inspect 360, 768, and 1440 px layouts.
- Complete keyboard-only behavior.
- Check reduced motion and live announcements.
- Check browser logs and storage for sensitive data.

### Step 5: prepare the change

- Remove debugging and unused code.
- Review unstaged and staged diffs.
- Confirm generated artifacts match the contract hash.
- Run the full PR quality gate.
- Commit one logical green unit at a time.
- Push and update the Draft PR evidence.

### Step 6: close the slice

- Resolve review feedback with new focused commits.
- Rebase on current `origin/master`.
- Re-run CI and deployment smoke tests.
- Squash merge.
- Delete the branch and update local `master`.

## 8. Delivery order

| Order | Slice | Dependency | Exit result |
|---:|---|---|---|
| 0 | Contract gates | backend OpenAPI | recommendation enums corrected; origins and UAT data agreed |
| 1 | Foundation | none | router, query, design tokens, API client, proxy, test harness, CI |
| 2 | Auth/profile/preferences | foundation | real protected application session |
| 3 | Records/history | auth, catalogue | complete record lifecycle and concurrency handling |
| 4 | Groups/Saved | auth, records | group workspace and server-owned shortlist |
| 5 | Recommendations | groups, preferences | complete recommendation decision loop |
| 6 | Explore/Search | groups, Saved | authorized discovery and save actions |
| 7 | Cooking | preferences | manual-ingredient generation and history |
| 8 | Chat | Search/Explore/Saved | grounded session/reference workflow |
| 9 | Dashboard/recap | records/feedback | accessible backend-owned metrics |
| 10 | Hardening/release | all | UC01–UC09, security, accessibility, performance, UAT |

## 9. Definition of Done

A feature is complete only when:

- all documented acceptance behavior is implemented;
- every API call uses generated types and the shared client;
- all required UI states are implemented;
- no unsupported capability is implied;
- targeted unit/component/API tests pass;
- required E2E coverage passes;
- responsive and keyboard review is complete;
- accessibility scan has no serious or critical issue;
- new UI copy is product-specific and permission-safe;
- no secret or private backend origin reaches the bundle;
- documentation and environment examples are updated;
- CI is green and review comments are resolved.

Passing build alone is not completion.

## 10. Assumptions and known constraints

- `master` remains the protected default branch.
- Vercel is the formal public demo host; the existing Sites project remains the
  private preview host.
- Both deployments use the same reviewed source commit.
- The browser always calls a same-origin `/api/v1`.
- The backend remains the authority for permissions, reasons, ranking, feedback,
  and metrics.
- Refresh is cookie-backed; access tokens are memory-only.
- Photos use placeholders until the backend exposes an authorized read contract.
- Optional record fields cannot be cleared through PATCH until the backend
  defines clear semantics.
- Submitted recommendation feedback cannot be reconstructed after reload until a
  feedback projection/read API exists.
- The current prototype visual direction is retained, but its fake data and
  unsupported controls are not.
