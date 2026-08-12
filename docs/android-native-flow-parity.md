# Android native-client parity audit

Backend authority: `foodmind-backend/src/main/resources/openapi/openapi.yaml`. Both clients are checked against the same 83-operation contract.

## Feature mapping

| Android addition | Web result |
| --- | --- |
| Recommendation home, ordered candidates, local “try another” | Already covered by Home and recommendation detail routes using `/recommendations/*`. |
| Cooking recipe selection and selection dock | Added `/cooking/recipes` with search, categories, 1..N selection, servings/time controls, API-limit validation, responsive cards, and an inset-safe dock. |
| Recipe library and editor | Both clients use server-owned `/recipes` create/read/update/delete/search operations. Android no longer falls back to device-local recipe drafts. |
| Inventory | Both clients provide list/filter, create, detail, update, and archive operations backed by `/inventory/lots`. |
| Shopping lists | Both clients provide list/filter, create, detail, item update, and completion operations backed by `/shopping-lists`. |
| Recipe import | Both clients provide import submission, question/answer, confirmation, and terminal session rendering backed by `/recipe-imports`. |
| Cooking plan and executable checklist | Existing real `/cooking-plans/*` flow retained; added per-session step completion, accessible progress semantics, reset, and an explicit non-persistence disclaimer. |
| Groups and group feed | Existing Web group workspace is a superset: create, join fallback, detail, members, invite, feed, share, edit, archive, remove/leave. |
| Explore and authorised content detail | Existing Web Explore grid/search/preview, permission note, catalogue detail, and Want to Try flows already cover it. |
| Combined history | Existing history and food/drink record flows already cover it. |
| Dashboard and weekly recap | Existing backend-owned analytics routes already cover it without client-side metric recomputation. |
| Chat | Existing standalone grounded chatbot covers sessions, messages, references, source search, and archive. |
| Login/session/network safety | Existing Web auth keeps access tokens in memory, uses the backend refresh-cookie flow, single-flights refresh, clears private query cache, attaches correlation IDs, and exposes offline/error states. |
| Five root destinations | Mobile navigation now matches Home, Groups, Explore, Saved, and Me. Add Record remains a header action rather than crowding the root bar. |

## Contract enforcement

The canonical backend contract includes `/recipes` CRUD and `recipeIds` in cooking generation requests. Web `api:check` verifies the snapshot hash, the exact locked backend commit, the current backend source, and regenerated TypeScript. Web `api:coverage` fails unless all 83 operations have production consumers and has no exemptions.

Android `apiGenerate`, `apiCheck`, and `apiCoverage` generate Kotlin contract artifacts from the same OpenAPI source and fail on source, Retrofit-operation, or DTO-schema drift. Release builds also reject missing, insecure, or placeholder API origins.
