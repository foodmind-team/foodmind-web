# FoodMind Web Backend API Integration Plan

## 1. Purpose

This document defines how `foodmind-web` integrates with the implemented
Spring API. It is intentionally stricter than a list of endpoints: it fixes the
browser transport, authentication lifecycle, query ownership, mutation
semantics, UI error behavior, and known contract gaps.

Canonical schema:

```text
foodmind-backend/src/main/resources/openapi/openapi.yaml
```

Base path from the browser:

```text
/api/v1
```

The frontend must not call the private FastAPI intelligence service, database,
or object store except for the exact presigned object upload URL returned by the
backend.

## 2. Contract snapshot and generated client

### 2.1 Committed artifacts

Add:

```text
contracts/backend-openapi-v1.yaml
contracts/backend-openapi-v1.lock.json
src/lib/api/generated/schema.ts
```

The lock file contains:

```json
{
  "sourceRepository": "foodmind-backend",
  "sourcePath": "src/main/resources/openapi/openapi.yaml",
  "backendCommit": "<40-character SHA>",
  "openapiInfoVersion": "<info.version>",
  "sha256": "<snapshot SHA-256>",
  "generator": "openapi-typescript",
  "generatedAt": "<ISO-8601 UTC timestamp>"
}
```

### 2.2 Scripts

Provide:

```text
api:snapshot  copy/verify the accepted backend contract and write its lock
api:generate  generate schema.ts from the committed snapshot
api:check     regenerate to a temporary path and fail on a diff
```

`api:snapshot` must require an explicit backend commit argument. It must fail if
the backend worktree contract differs from that commit, preventing accidental
snapshots of unrelated local changes.

### 2.3 Contract-change rule

For every changed backend operation:

1. Backend PR updates OpenAPI and backend contract tests.
2. Backend PR merges.
3. Web issue records the merged backend SHA.
4. Web branch snapshots that exact contract.
5. Generated types update in the same commit as the snapshot and lock.
6. Web adapter and UI changes follow in later commits in the same PR or a
   dependent PR.

Do not hand-edit generated schemas or maintain parallel manual DTOs.

## 3. Browser transport and proxy

### 3.1 Why same-origin is mandatory

The WEB refresh flow uses secure HttpOnly cookies, including a refresh cookie
with a strict same-site policy. The backend does not currently expose a
complete direct cross-origin browser configuration. Therefore every normal
browser request uses the web origin:

```text
Browser -> https://web-origin/api/v1/** -> Web proxy -> Spring backend
```

This makes refresh cookies first-party to the web origin and removes CORS from
the browser-to-backend boundary.

### 3.2 Environment variables

Public:

```text
VITE_APP_ENV=local|preview|staging|production
```

Server-only:

```text
FOODMIND_BACKEND_ORIGIN=https://backend.example
```

Do not create `VITE_FOODMIND_BACKEND_ORIGIN`. Any `VITE_` value is considered
public and may be embedded in the browser bundle.

### 3.3 Local Vite proxy

Vite forwards `/api/v1/**` to `FOODMIND_BACKEND_ORIGIN`, defaulting only in local
development to `http://localhost:8080`.

The browser API client still uses `/api/v1`; switching between mock, local, and
hosted backends does not change feature code.

### 3.4 Sites and Vercel proxy behavior

The Sites worker and Vercel function/rewrite must implement the same behavior:

- only proxy `/api/v1` and child paths;
- obtain the upstream origin only from server configuration;
- preserve method, query, request body, and content type;
- preserve status and response body;
- forward multiple `Set-Cookie` values correctly;
- preserve `ETag`, `Location`, `Retry-After`, `X-Correlation-ID`, and trace
  headers;
- forward `If-Match`, `Idempotency-Key`, and `Authorization`;
- strip connection-specific/hop-by-hop headers;
- set no cache for authenticated responses;
- do not accept an upstream URL in query, path, body, or header;
- do not follow arbitrary redirects automatically;
- return a safe `502` envelope when the upstream cannot be reached;
- never expose upstream credentials or an internal stack trace.

The static asset handler continues to provide SPA fallback for HTML routes, but
must route `/api/v1/**` before static fallback.

### 3.5 Direct presigned upload

For a media upload:

1. Request upload metadata from `/media/uploads`.
2. PUT the file directly to the returned presigned URL.
3. Use exactly the returned object-store headers.
4. Do not add the FoodMind bearer token to the object-store request.
5. Finalize through `/media/{mediaAssetId}/finalise`.

Initial Web release keeps this UI disabled because there is no authorized
media-read URL for displaying the finished asset.

## 4. Shared HTTP client

### 4.1 Request construction

Every API request:

- uses base URL `/api/v1`;
- sets `credentials: "include"`;
- attaches `Authorization: Bearer <memory token>` when authenticated;
- attaches a new UUID `X-Correlation-ID` unless continuing the same logical
  retried request;
- serializes request bodies through the generated operation type;
- accepts JSON and preserves non-JSON empty responses;
- supports `AbortSignal`;
- never logs headers, cookies, request bodies, or full responses in production.

### 4.2 API error model

Parse the backend envelope:

```text
timestamp
status
code
message
path
traceId
fieldErrors[]:
  field
  code
  message
```

Map known codes:

| Backend code | UI behavior |
|---|---|
| `VALIDATION_ERROR` | form summary plus exact field messages |
| `MALFORMED_JSON` | safe form-level error; retain user input |
| `AUTHENTICATION_REQUIRED` | refresh once, otherwise login |
| `ACCESS_DENIED` | permission state; do not hide the reason as “empty” |
| `RESOURCE_NOT_FOUND` | not-found or unavailable-source state |
| `CONFLICT` | domain conflict; offer safe reload/review |
| `IDEMPOTENCY_CONFLICT` | explain that the command payload changed; create a new logical command |
| `RATE_LIMITED` | show retry guidance and respect `Retry-After` |
| `UPSTREAM_UNAVAILABLE` | recommendation/cooking/chat fallback or unavailable state |
| `INTERNAL_ERROR` | safe generic message and visible trace ID for support |

Unknown codes render a safe generic error and trace ID. Never display a raw
exception, database message, or upstream response.

### 4.3 Retry policy

Queries:

- no retry for `400`, `401` after refresh, `403`, `404`, or `409`;
- respect `Retry-After` on `429`;
- at most two exponential retries for transient network, `502`, `503`, or `504`;
- suspend retries while `navigator.onLine` is false.

Mutations:

- no automatic retry by default;
- allow a deliberate user Retry only for an idempotent command with its original
  key and byte-equivalent payload;
- never retry delete or normal PATCH automatically.

## 5. Authentication lifecycle

### 5.1 Registration and login

Registration includes:

- email;
- display name;
- password of at least the documented minimum;
- `clientType: "WEB"`;
- browser time zone;
- optional device label if exposed in the form.

Login includes:

- email;
- password;
- `clientType: "WEB"`;
- time zone/device label as required by the operation.

The authentication response may contain:

- access token and expiry;
- refresh token and expiry;
- CSRF token.

For a WEB client:

- store the access token only in the in-memory Auth provider;
- discard the response refresh token immediately;
- rely on the HttpOnly refresh cookie;
- do not put access, refresh, or CSRF tokens in local storage, session storage,
  IndexedDB, URLs, or logs.

### 5.2 Bootstrap

At application start:

1. Enter `checking` state.
2. Call `/auth/refresh` with `clientType: "WEB"`.
3. A `401` means anonymous and is silent.
4. On success, store the access token in memory.
5. Fetch `/users/me`.
6. Enter `authenticated`.
7. Only then render protected routes.

Public Login/Register may wait for bootstrap so a valid existing session is
redirected correctly.

### 5.3 Refresh algorithm

Use one module-level refresh promise:

```text
request receives first eligible 401
  -> if no refresh active, start refresh
  -> all concurrent requests await same promise
  -> on success, retry each original request once
  -> on failure, clear session and cache
```

Also schedule a best-effort proactive refresh about 60 seconds before the
reported access-token expiry. Re-check expiry when the document becomes visible
after being backgrounded. Timers are an optimization; the `401` path remains
authoritative.

Never refresh recursively for:

- registration;
- login;
- refresh;
- logout;
- logout-all;
- a request already marked as retried.

### 5.4 Logout

Current-session logout:

1. call `/auth/logout`;
2. clear token even if the network result is lost;
3. cancel active queries;
4. remove all user-scoped cache;
5. navigate to `/login`.

Logout-all uses `/auth/logout-all` and the same local cleanup.

Return URLs must be same-origin relative paths beginning with `/`. Reject
protocol-relative URLs and any value containing a different origin.

## 6. Pagination and URL ownership

### 6.1 Page pagination

Standard responses use:

```text
page
size
total
totalPages
hasNext
content/items
```

Page-indexed screens store `page`, `size`, filters, and sort in the URL. Reset
`page` to the first page whenever a filter changes.

### 6.2 Cursor pagination

Explore, Search, group feed, and chat messages use cursor behavior where
specified. Store filter/query fields in the URL but keep opaque cursors in query
page parameters, not user-editable state.

“Load more” must:

- remain keyboard accessible;
- preserve already loaded content;
- announce how many items were added;
- not interpret an absent cursor as an error.

## 7. Query-key contract

Central query-key factories:

```text
auth.current()
catalogue.reference()
catalogue.meal(id)
catalogue.place(id)
catalogue.product(id)
users.me()
users.preferences()
records.food.list(filters)
records.food.detail(id)
records.drink.list(filters)
records.drink.detail(id)
records.history(filters)
groups.list()
groups.detail(groupId)
groups.members(groupId)
groups.feed(groupId, filters)
recommendations.detail(sessionId)
recommendations.history(filters)
saved.list(filters)
search.results(query, filters)
explore.feed(filters)
cooking.detail(planId)
cooking.history(filters)
chat.sessions(filters)
chat.detail(sessionId)
chat.messages(sessionId)
dashboard.metrics(filters)
recaps.week(weekStart)
```

Query keys contain serializable normalized parameters. Remove `undefined`
properties and sort multi-value filters before constructing a key.

Default caching:

- catalogue reference data: long-lived for the session;
- current user/preferences/groups: short stale window;
- detail/history/feed data: immediately or shortly stale but cached for
  back-navigation;
- dashboard/recap: keyed by exact date/grouping parameters;
- no persistence across logout or browser restart.

## 8. Mutation rules

### 8.1 Idempotency

The following operations require an idempotency header:

- recommendation generation;
- recommendation feedback;
- cooking generation.

Create one UUID per logical command:

```text
same action + same payload + retry -> reuse key
changed form values -> new key
explicit new recommendation/plan -> new key
```

Store pending command data only in route/component memory. While a command is
pending, disable duplicate submission. If navigation interrupts an uncertain
command, offer a deliberate recovery action rather than silently creating
another command.

### 8.2 Optimistic concurrency

Food and drink PATCH:

- use the current version/ETag from the fetched record;
- send `If-Match: "\"<version>\""`;
- replace cached detail/list data only after success;
- on `409`, keep the user’s draft, fetch the latest server record separately,
  and offer Reload latest;
- do not provide a Force overwrite button.

Current PATCH treats omitted/null optional values as unchanged. Therefore the
first Web release does not expose controls that promise to clear an optional
value.

### 8.3 Cache invalidation

| Mutation | Required cache effect |
|---|---|
| Register/login | set auth token, fetch current user and preferences |
| Profile update | update `users.me`, invalidate dependent shell summaries |
| Preference update | update preferences; invalidate recommendation/cooking form context |
| Record create | invalidate matching list, history, dashboard, recap, authorized feed/Explore |
| Record update | replace detail; invalidate lists/history/dashboard/recap/feed |
| Record delete | remove detail; invalidate lists/history/dashboard/recap/feed |
| Group create/join/update | invalidate group list and affected detail |
| Invitation/member change | invalidate group detail/members/feed |
| Recommendation generate | seed detail cache and invalidate recommendation history |
| Feedback submit | update session-local state; invalidate history/dashboard/recap |
| Recommendation share | invalidate target group feed |
| Want to Try add/remove | update or invalidate Saved plus source-card state |
| Cooking generate | seed plan detail and invalidate cooking history |
| Chat create/archive | invalidate chat sessions |
| Add chat reference | invalidate chat detail/reference list |
| Send chat message | append/replace message data and invalidate session summary |
| Logout | cancel and remove all user-scoped queries |

Do not optimistically change permissions, membership, shares, or record writes.
Want to Try may optimistically toggle only if rollback restores the exact prior
entry and identifier.

## 9. Endpoint-to-feature matrix

### 9.1 Media

| Method | Path | Frontend use |
|---|---|---|
| POST | `/media/uploads` | future upload initialization |
| POST | `/media/{mediaAssetId}/finalise` | future upload completion |
| DELETE | `/media/{mediaAssetId}` | future abandoned/removed upload |

Release decision: no visible photo feature until an authorized read contract
exists.

### 9.2 Authentication and current user

| Method | Path | Screen/action |
|---|---|---|
| POST | `/auth/register` | Register |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | bootstrap and token renewal |
| POST | `/auth/logout` | current-session logout |
| POST | `/auth/logout-all` | account security action |
| GET | `/users/me` | app shell and Me |
| PATCH | `/users/me` | profile edit |
| GET | `/users/me/preferences` | recommendation/cooking/profile context |
| PUT | `/users/me/preferences` | preference editor |

### 9.3 Catalogue

| Method | Path | Screen/action |
|---|---|---|
| GET | `/catalogue/reference-data` | selects, enums, form options |
| GET | `/catalogue/meals/{id}` | meal detail |
| GET | `/catalogue/places/{id}` | place detail |
| GET | `/catalogue/products/{id}` | product detail |

Reference data is the source for UI options. Do not hard-code backend-managed
catalogue values in forms.

### 9.4 Food, drink, and history

| Method | Path | Screen/action |
|---|---|---|
| POST | `/food-records` | create food record |
| GET | `/food-records` | filtered food list |
| GET | `/food-records/{id}` | food detail/edit bootstrap |
| PATCH | `/food-records/{id}` | food update with `If-Match` |
| DELETE | `/food-records/{id}` | food deletion |
| POST | `/drink-records` | create drink record |
| GET | `/drink-records` | filtered drink list |
| GET | `/drink-records/{id}` | drink detail/edit bootstrap |
| PATCH | `/drink-records/{id}` | drink update with `If-Match` |
| DELETE | `/drink-records/{id}` | drink deletion |
| GET | `/history` | combined record history |

### 9.5 Groups

| Method | Path | Screen/action |
|---|---|---|
| POST | `/groups` | create group |
| GET | `/groups` | group index |
| GET | `/groups/{groupId}` | group workspace |
| PATCH | `/groups/{groupId}` | edit group |
| POST | `/groups/{groupId}/invitations` | create one-time invitation token |
| POST | `/group-invitations/join` | canonical token join flow |
| POST | `/groups/join` | alternate documented join operation if still retained |
| GET | `/groups/{groupId}/members` | member list |
| DELETE | `/groups/{groupId}/members/{userId}` | remove/leave as contract permits |
| GET | `/groups/{groupId}/feed` | authorized cursor feed |
| POST | `/groups/{groupId}/recommendation-shares` | share selected candidate |

The canonical join is `/group-invitations/join`. The retained `/groups/join`
compatibility alias is attempted only when the canonical route returns `404` or
`405`; a successful or domain-error response is never submitted twice.

### 9.6 Recommendations

| Method | Path | Screen/action |
|---|---|---|
| POST | `/recommendations/generate` | Home Generate and re-recommend |
| GET | `/recommendations/{sessionId}` | result/detail/recovery |
| POST | `/recommendations/{sessionId}/feedback` | accept, reject, request again, later rating, would-again |
| GET | `/recommendations/history` | history and Me |

Generation request may include:

- `parentSessionId`;
- `groupId`;
- `mealType`;
- `maxBudget` and `currency`;
- `area`, latitude/longitude, and maximum distance;
- `mood`;
- `requestedFor`;
- allergens, dietary rules, spice, and cleanliness constraints.

Candidate display uses:

- `candidateId`;
- meal/place identifiers and display data;
- area and price;
- `type`: `PERSONAL`, `EXPLORATORY`, or `GROUP_INSPIRED`;
- rank;
- reason codes;
- explanation.

Feedback events:

- `ACCEPTED`
- `REJECTED`
- `RERECOMMEND_REQUESTED`
- `LATER_RATED`
- `WOULD_EAT_AGAIN`

Use the exact rejection-reason enum from generated types.

### 9.7 Want to Try, Search, and Explore

| Method | Path | Screen/action |
|---|---|---|
| POST | `/want-to-try` | Save |
| GET | `/want-to-try` | Saved |
| DELETE | `/want-to-try/{id}` | Remove |
| GET | `/search` | debounced authorized search |
| GET | `/explore` | authorized discovery |

Want to Try source types:

- `FOOD_RECORD`
- `MEAL`
- `FOOD_PRODUCT`
- `PLACE`

An item with `sourceAvailable: false` remains visible as unavailable.

Explore types:

- `GROUP_RECORD`
- `CURATED_PRODUCT`
- `CURATED_PLACE`

Search sources:

- `FOOD_RECORD`
- `FOOD_PRODUCT`
- `PLACE`

### 9.8 Cooking

| Method | Path | Screen/action |
|---|---|---|
| POST | `/cooking-plans/generate` | manual ingredient Generate |
| GET | `/cooking-plans/{planId}` | plan detail/recovery |
| GET | `/cooking-plans/history` | cooking history |

Generation limits:

- 1–30 ingredients;
- servings within the schema bounds;
- optional minutes, budget, currency, dietary rules, and allergens.

Statuses:

- `SUCCEEDED`
- `FALLBACK_SUCCEEDED`
- `NO_VALID_RECIPE`
- `FAILED`

Ingredient availability:

- `AVAILABLE`
- `TO_BUY`

### 9.9 Chat

| Method | Path | Screen/action |
|---|---|---|
| POST | `/chat/sessions` | create session |
| GET | `/chat/sessions` | session index |
| GET | `/chat/sessions/{sessionId}` | session detail |
| DELETE | `/chat/sessions/{sessionId}` | archive |
| POST | `/chat/sessions/{sessionId}/references` | attach authorized source |
| POST | `/chat/sessions/{sessionId}/messages` | send message |
| GET | `/chat/sessions/{sessionId}/messages` | cursor history |

Route labels:

- `SEARCH`
- `SUMMARY`
- `COMPARE`
- `NAVIGATION`
- `OUT_OF_SCOPE`

Response statuses:

- `SUCCEEDED`
- `FALLBACK_SUCCEEDED`
- `UNSUPPORTED`
- `FAILED`

References removed or no longer visible render unavailable; the frontend must
not preserve previously fetched private content as if access still exists.

### 9.10 Dashboard and recap

| Method | Path | Screen/action |
|---|---|---|
| GET | `/dashboard` | analytics |
| GET | `/weekly-recaps/{weekStart}` | weekly recap |

Known metric codes:

- `FOOD_DRINK_COUNT`
- `FOOD_COUNT`
- `DRINK_COUNT`
- `MEAN_RATING`
- `SPENDING_TOTAL`
- `CUISINE_DISTRIBUTION`
- `REPEAT_FREQUENCY`
- `ACCEPTANCE_RATE`
- `REJECTION_RATE`
- `REJECTION_REASON`
- `WOULD_AGAIN_RATE`
- `RECOMMENDATION_WOULD_EAT_AGAIN_RATE`
- `SELECTED_CANDIDATE_TYPE`

Rows may include period, value, unit, currency, sample count, denominator,
`empty`, dimension, and label. Never replace `empty`/null with zero or aggregate
different currencies.

## 10. UI state matrix by HTTP result

| Result | Screen behavior |
|---|---|
| `200/201` | render/update data and announce success |
| `204` | complete action without parsing JSON |
| `400` validation | retain values, map fields, focus summary/first invalid control |
| `401` | one refresh/retry, then login |
| `403` | permission state, no data leakage |
| `404` primary route | not found |
| `404` linked source | unavailable-source card |
| `409` version | preserve draft and offer Reload latest |
| `409` idempotency | preserve result/context and require new logical action |
| `429` | rate-limit message and delayed retry action |
| `5xx` | safe recoverable error with trace ID |
| offline | offline state without destroying cached content |
| fallback success | show usable result plus fallback banner |
| no valid candidate/recipe | constraint-aware empty state; allow Edit context |

## 11. Security rules

- React text escaping is the default for all user/backend content.
- No `dangerouslySetInnerHTML`.
- No token storage outside memory/HttpOnly cookies.
- No authorization decision based on decoded JWT claims.
- No personal response cache across logout.
- No API request/response payload in analytics or error telemetry.
- Apply CSP, frame, referrer, content-type, and permissions headers at both
  hosting surfaces.
- Use `rel="noopener noreferrer"` for external new-window links.
- Validate local return URLs.
- Keep source-map access and production logging appropriate for the demo
  environment.
- Do not expose the private intelligence endpoint or backend credentials.
- A presigned object URL receives no FoodMind bearer token.

## 12. Contract gates and known gaps

### Gate A: recommendation statuses

The implementation can persist:

```text
status = SUCCEEDED
fallbackStatus = NOT_REQUIRED
```

The current OpenAPI recommendation response enums/summary do not fully describe
that successful path. Correct the backend OpenAPI and contract tests before
snapshot generation.

### Gate B: PATCH clearing

The backend cannot currently distinguish omitted optional values from a request
to clear those values. The UI does not expose clear behavior until the contract
defines it.

### Gate C: media reads

Upload/finalize/delete exist, but an authorized display/download URL does not.
Keep photos out of the first visible release and track a backend enhancement.

### Gate D: feedback projection

Feedback submission exists, but recommendation detail/history does not expose
previously submitted feedback. Keep confirmation in active memory only and
handle duplicates honestly.

### Gate E: deployment configuration

Before real integration testing, obtain:

- local backend origin;
- hosted staging/production backend origin;
- backend health readiness;
- seeded accounts/groups/catalogue/records;
- working HTTPS;
- Sites and Vercel server-only environment configuration.

### Gate F: complete backend verification

Run the full backend suite in a Docker/Testcontainers-capable environment before
release UAT. The planning baseline confirmed targeted recommendation tests but
could not complete the container-backed suite without Docker.
