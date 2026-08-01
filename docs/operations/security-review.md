# Frontend security review

Reviewed against the implementation planning pack on 2026-07-31.

## Session and request boundary

- Access tokens exist only in module memory; no token is written to local or session storage.
- Refresh and logout use same-origin `/api/v1` with `credentials: include` and a backend-owned HttpOnly cookie.
- Concurrent authentication failures share one refresh request. A protected request is retried once, after which private state is cleared.
- Safe return paths reject absolute, protocol-relative, and scheme-bearing values.
- Correlation IDs are unique unless supplied by the caller and are retained across retry.

## Proxy and browser boundary

- Browser JavaScript contains only `/api/v1`; the server-only backend origin is never exposed as a `VITE_` value.
- Both proxy implementations construct upstream URLs from a configured origin plus the incoming `/api/v1` path. User-controlled upstream origins are not accepted.
- Hop-by-hop headers are removed, redirects are manual, and authenticated responses use `Cache-Control: no-store`.
- CSP, anti-framing, referrer, content-type, and permissions headers are applied to static and API responses.
- Source links use safe external-link attributes, and no backend text is rendered with `dangerouslySetInnerHTML`.

## Media storage boundary

- Record images are limited client-side and server-side to JPEG, PNG, or WebP files of at most 5 MB.
- The browser computes the SHA-256 declaration, requests a short-lived instruction from the backend, uploads only to the returned URL with the returned headers, and finalises through `/api/v1`.
- Direct storage requests use `credentials: omit`, do not pass the FoodMind bearer token, and reject redirects.
- Signed upload URLs are held only in the active call stack and are never persisted or logged. A failed transfer triggers best-effort deletion while the backend remains responsible for stale PENDING cleanup.
- Because the backend exposes no authorised media-read URL, the client provides a pre-save local preview and lifecycle status without pretending it can render the saved asset after reload.

## Dependency advisory review

The lockfile resolves patched `minimatch` and `brace-expansion` versions for the OpenAPI generator. The current npm audit reports the React Router `GHSA-qwww-vcr4-c8h2` advisory, which applies to React Server Components action handling. FoodMind Web is a Vite client-side SPA: it does not use React Router framework mode, RSC, server actions, route actions, or an RSC request handler. React Router 7.18.2 is the newest registry release on the review date; npm's proposed downgrade reintroduces multiple applicable redirect/XSS/DoS advisories. The residual advisory is therefore non-reachable in this architecture and should be removed by upgrading once a fixed release exists.

No exception applies to critical vulnerabilities or to a future advisory reachable by the SPA runtime.
