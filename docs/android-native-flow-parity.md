# Android native-client parity audit

Source reviewed: `foodmind-android` commit `c115fcc2cfcb3118f36649e6181a68c709f1a905` (`feat(android): integrate native client flows`). Backend authority: `foodmind-backend/src/main/resources/openapi/openapi.yaml` on backend `master`.

## Feature mapping

| Android addition | Web result |
| --- | --- |
| Recommendation home, ordered candidates, local “try another” | Already covered by Home and recommendation detail routes using `/recommendations/*`. |
| Cooking recipe selection and selection dock | Added `/cooking/recipes` with search, categories, 1..N selection, servings/time controls, API-limit validation, responsive cards, and an inset-safe dock. |
| Recipe library and editor | Added `/saved/recipes`, create/edit/delete routes, ingredient and step editors, and account-separated device-local persistence. |
| Cooking plan and executable checklist | Existing real `/cooking-plans/*` flow retained; added per-session step completion, accessible progress semantics, reset, and an explicit non-persistence disclaimer. |
| Groups and group feed | Existing Web group workspace is a superset: create, join fallback, detail, members, invite, feed, share, edit, archive, remove/leave. |
| Explore and authorised content detail | Existing Web Explore grid/search/preview, permission note, catalogue detail, and Want to Try flows already cover it. |
| Combined history | Existing history and food/drink record flows already cover it. |
| Dashboard and weekly recap | Existing backend-owned analytics routes already cover it without client-side metric recomputation. |
| Chat | Existing standalone grounded chatbot covers sessions, messages, references, source search, and archive. |
| Login/session/network safety | Existing Web auth keeps access tokens in memory, uses the backend refresh-cookie flow, single-flights refresh, clears private query cache, attaches correlation IDs, and exposes offline/error states. |
| Five root destinations | Mobile navigation now matches Home, Groups, Explore, Saved, and Me. Add Record remains a header action rather than crowding the root bar. |

## Contract decision

The Android commit declares `/recipes` CRUD and sends `recipeIds` in its cooking request, but neither exists in the current backend OpenAPI contract. The Android implementation itself falls back to in-memory demo drafts when those calls fail.

The Web implementation therefore does not call undocumented endpoints and does not label local data as server-persisted. Recipe drafts are explicitly device-local and namespaced by authenticated user ID. When cooking begins, their ingredient lines are scaled to the requested servings and sent through the supported `POST /cooking-plans/generate` contract with a stable idempotency key. This preserves the native workflow without inventing backend capability.
