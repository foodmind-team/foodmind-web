# FoodMind Web Git, Testing, and Delivery Plan

## 1. Delivery principles

- Use GitHub Flow independently in `foodmind-web`.
- Keep `master` as the protected default branch.
- Do not introduce `develop`.
- Every branch starts from current `origin/master` and has one linked issue.
- Prefer complete vertical slices over layer-only work.
- Keep branches short-lived and reviewable.
- Use the backend OpenAPI snapshot as a reviewed input, not an informal copy.
- Merge only green, reviewed, deployable work.
- Squash merge and delete the branch.
- Never mix backend, docs-repository, Android, intelligence, or ML changes into a
  Web pull request.

## 2. Issue design

### 2.1 Issue size

Target 0.5–2 engineering days per issue. Split an issue when:

- it spans unrelated routes;
- it introduces more than one major data flow;
- it is likely to exceed approximately 500 net production lines, excluding
  generated files and tests;
- part can be independently tested and released;
- it has a backend dependency that would block unrelated UI work.

### 2.2 Required issue sections

```markdown
## Outcome
What the user can complete when this issue closes.

## Source
- Proposal use case:
- Product clarification:
- Architecture decision:

## Backend contract
- Backend commit:
- Operations:
- Schemas/enums:
- Known gap:

## Acceptance criteria
- [ ] User-visible behavior
- [ ] Loading/empty/error/permission/offline behavior
- [ ] Responsive and keyboard behavior
- [ ] Tests and evidence

## Out of scope
Explicitly excluded behavior.

## Dependencies
Parent issue/PR, backend issue, environment requirement.
```

Every acceptance criterion must be observable. Avoid criteria such as “clean
code” without a measurable review gate.

## 3. Branch workflow

### 3.1 Starting a branch

Confirm the Web worktree is clean:

```powershell
git status --short --branch
git fetch origin
git switch master
git pull --ff-only origin master
git switch -c feature/<short-kebab-name>
```

Branch prefixes:

| Prefix | Use |
|---|---|
| `feature/` | user-visible behavior |
| `fix/` | defect correction |
| `chore/` | tooling, dependencies, generated contract, deployment |
| `test/` | test-only coverage or harness work |
| `docs/` | documentation-only work |

Good examples:

```text
chore/frontend-foundation
feature/auth-profile-preferences
feature/recommendation-feedback
fix/record-version-conflict
test/uc04-recommendation-e2e
docs/frontend-operations
```

Do not use:

- names containing personal initials only;
- issue titles with spaces;
- `feature/all-frontend`;
- a branch based on an unmerged unrelated branch without documenting the stack.

### 3.2 Stacked changes

Avoid stacking when work can wait for the parent to merge. When unavoidable:

1. State the parent PR in the child PR.
2. Keep child commits separate.
3. Do not ask for final child review until the parent merges.
4. Rebase the child onto `origin/master`.
5. Re-run every quality gate.
6. Update screenshots and contract evidence if the rebase changes behavior.

No merge commits are added to feature branches.

## 4. Commit workflow

### 4.1 When to commit

Commit when a coherent unit:

- type-checks;
- passes its targeted tests;
- has no debug code;
- leaves public interfaces internally consistent;
- is independently understandable in review.

Examples of suitable units:

- typed API client and error mapping;
- an accessible shared field component plus tests;
- one route’s successful/empty/error states;
- one mutation flow plus cache invalidation tests;
- contract snapshot plus regenerated schema;
- proxy behavior plus focused integration tests.

Do not commit:

- red compilation;
- placeholder test skips;
- unexplained generated diffs;
- unrelated formatting;
- `.env.local`, tokens, credentials, or private origins;
- build output or editor metadata;
- “WIP” changes directly to `master`.

### 4.2 Commit messages

Use Conventional Commits:

```text
<type>(<scope>): <imperative summary>
```

Types:

- `feat`
- `fix`
- `test`
- `chore`
- `docs`
- `refactor`
- `ci`
- `perf`

Preferred scopes:

- `web`
- `api`
- `auth`
- `profile`
- `records`
- `groups`
- `recommendations`
- `saved`
- `explore`
- `cooking`
- `chat`
- `analytics`
- `a11y`
- `deploy`

Examples:

```text
chore(api): snapshot backend OpenAPI contract
feat(auth): restore web session from refresh cookie
feat(records): add optimistic concurrency handling
feat(recommendations): cycle returned candidates locally
fix(groups): retain forbidden feed state
test(chat): cover revoked source references
ci(web): verify generated API types
perf(web): lazy load analytics charts
docs(deploy): document backend origin configuration
```

Use a body when the reason, compatibility effect, or contract choice is not
obvious. Reference the issue in the body or PR rather than putting only an issue
number in the subject.

### 4.3 Pre-commit checks

Run at minimum:

```powershell
git status --short
git diff
npm run lint
npm run typecheck
npm run test -- --run <target>
git diff --staged
```

Before staging, inspect sibling repositories if the workspace root was used for
any command. Stage exact paths rather than relying on `git add .` in a dirty
workspace.

## 5. Push and rebase policy

Push:

- after the first green logical commit;
- after a meaningful integrated checkpoint;
- at the end of the work session;
- before requesting review.

First push:

```powershell
git push -u origin <branch>
```

Before Ready for review:

```powershell
git fetch origin
git rebase origin/master
npm run validate
git push --force-with-lease
```

`--force-with-lease` is allowed only on the author’s own rebased branch. Never
force-push `master` or a branch another contributor is actively using without
coordination.

## 6. Pull request sequence

The sequence below is ordered by usable dependency. Each row may be split into
smaller PRs when the issue-size rule requires it.

| PR | Branch | Deliverable | Depends on |
|---:|---|---|---|
| 0 | backend contract PR | recommendation success/fallback schema correction | none |
| 1 | `chore/frontend-foundation` | router, Query, Tailwind tokens, forms, typed API, proxy, tests, CI | PR 0 contract |
| 2 | `feature/auth-profile-preferences` | real session, protected routes, profile/preferences | PR 1 |
| 3 | `feature/records-history` | food/drink lifecycle, history, ETag conflict | PR 2 |
| 4 | `feature/groups-saved` | groups, invitations, feed, Want to Try | PRs 2–3 |
| 5 | `feature/recommendation-vertical-slice` | context, generate, candidates, feedback, sharing, history | PRs 2 and 4 |
| 6 | `feature/explore-search` | authorized Explore/Search and saving | PR 4 |
| 7 | `feature/cooking-plans` | manual ingredient generation/history | PR 2 |
| 8 | `feature/chat-grounding` | sessions, references, messages, unavailable sources | PR 6 |
| 9 | `feature/dashboard-recap` | metrics, charts, tables, recap | PRs 3 and 5 |
| 10 | `test/web-acceptance` | UC01–UC09 E2E, responsive snapshots, accessibility | PRs 2–9 |
| 11 | `chore/web-release` | headers, environment, dual deploy, UAT, runbook | PR 10 |

### 6.1 PR 1 commit outline

```text
chore(web): pin runtime and add application dependencies
chore(api): snapshot and generate backend contract
feat(api): add typed client and error handling
feat(auth): add session state foundation
feat(web): add route and query providers
feat(web): establish design tokens and shared states
feat(deploy): add same-origin backend proxy
test(web): add component and API test harness
ci(web): add frontend quality gates
docs(web): update local development workflow
```

### 6.2 Recommendation PR commit outline

```text
feat(recommendations): add context form
feat(recommendations): generate and recover sessions
feat(recommendations): present ordered candidates
feat(recommendations): add accept and reject feedback
feat(recommendations): add true re-recommendation
feat(groups): share selected recommendation
test(recommendations): cover decision loop
```

Keep local “Try another” in the candidate presentation commit. Tests must prove
it does not generate a network request.

## 7. Pull request lifecycle

### 7.1 Draft timing

Open a Draft PR after the first end-to-end path is visible. A Draft PR should
already contain:

- linked issue;
- current scope;
- backend contract reference;
- implementation checklist;
- known blockers.

Do not wait until all code is complete; early contract and architecture review
reduces rework.

### 7.2 Ready-for-review gate

Mark Ready only when:

- acceptance criteria are complete;
- branch is rebased on current `origin/master`;
- CI is green;
- contract and generated files match;
- responsive screenshots exist;
- accessibility checks have been run;
- environment and deployment effects are documented;
- no temporary skip, mock-only behavior, or unsupported UI is hidden;
- preview smoke test passes.

### 7.3 Review requirements

- At least one approving reviewer.
- All required checks green.
- Every conversation resolved.
- Contract changes reviewed by a backend-aware reviewer.
- Authentication/proxy changes receive an explicit security review.
- No self-merge while required evidence is missing.

### 7.4 Merge and cleanup

- Squash merge.
- Squash title follows Conventional Commits.
- Delete the remote branch.
- Update local `master` using fast-forward only.
- Verify the post-merge preview.
- Close the issue only after its deployed acceptance path works.

## 8. Pull request template

Add `.github/pull_request_template.md` during foundation implementation:

```markdown
## Summary

## Linked work
- Closes:
- Proposal use case(s):
- Parent PR:

## User experience
- Primary path:
- Loading:
- Empty:
- Error/offline:
- Permission/unavailable:
- Fallback:

## Backend contract
- Backend commit:
- OpenAPI version:
- Snapshot SHA-256:
- Operations:
- Schema/enum changes:
- Known limitations:

## Visual evidence
| Mobile 360 | Tablet 768 | Desktop 1440 |
|---|---|---|
| image | image | image |

## Accessibility
- [ ] Keyboard path completed
- [ ] Visible focus/focus restoration
- [ ] Screen-reader names/live messages
- [ ] Reduced motion
- [ ] Automated scan

## Verification
| Check | Result |
|---|---|
| `npm run api:check` | |
| `npm run lint` | |
| `npm run typecheck` | |
| `npm run test:coverage` | |
| `npm run build` | |
| `npm run test:e2e` | |

## Security and privacy
- Browser-exposed environment variables:
- Server-only environment variables:
- Authentication/session impact:
- Personal-data/logging review:

## Deployment
- Preview:
- Configuration changes:
- Migration:
- Rollback:

## Out of scope / follow-up

## Reviewer checklist
- [ ] Contract behavior matches backend
- [ ] Unsupported features are not implied
- [ ] Tests cover the important failure modes
- [ ] Screenshots match the reviewed commit
- [ ] Documentation is current
```

## 9. Continuous integration

### 9.1 Required scripts

Foundation work introduces real scripts:

```text
dev
build
preview
lint
typecheck
api:generate
api:check
test
test:coverage
test:e2e
validate
```

`validate` runs contract check, lint, type check, coverage tests, and production
build. Do not define a script until its command performs a real check.

### 9.2 PR workflow

On pull requests and pushes to `master`:

1. Checkout with immutable dependency cache.
2. Install pinned Node and run `npm ci`.
3. Run `npm run api:check`.
4. Run lint.
5. Run TypeScript type check.
6. Run unit/component/API tests with coverage.
7. Run production build.
8. Run deterministic Playwright smoke tests against MSW.
9. Scan dependencies and tracked output for secrets.
10. Publish coverage and Playwright reports.

Cancel an older in-progress run for the same branch.

### 9.3 Coverage gate

Repository minimum:

- statements: 80%;
- lines: 80%;
- functions: 80%;
- branches: 75%.

Critical modules:

- auth/session;
- shared HTTP client;
- API error mapping;
- idempotency;
- recommendation decision flow.

These target at least 90% statements and branch coverage. Coverage is not a
substitute for scenario tests.

### 9.4 Scheduled/manual workflow

Nightly or release-candidate workflow:

- provision or select seeded staging backend;
- run real-backend E2E;
- run browser accessibility sweep;
- run visual regression;
- run dependency/security scan;
- optionally run passive web security scanning against staging;
- publish an evidence bundle labeled with frontend and backend commits.

External infrastructure failure does not make an ordinary component PR red, but
it blocks release.

## 10. Test architecture

### 10.1 Test layers

| Layer | Tool | Purpose |
|---|---|---|
| Unit | Vitest | pure mapping, formatting, validation, idempotency |
| Component | Testing Library | accessible behavior and UI states |
| API integration | MSW | exact HTTP adapter behavior |
| Accessibility | axe + manual keyboard | WCAG regressions |
| Browser smoke | Playwright + MSW | deterministic routing and core paths |
| Real integration | Playwright + Spring/PostgreSQL | actual contract/session behavior |
| Visual | Playwright screenshots | stable responsive layouts |

### 10.2 Fixture rules

- Copy shapes from the accepted OpenAPI examples or backend tests.
- Validate fixtures against generated types at compile time.
- Include only synthetic data.
- Model permission and unavailable behavior, not just happy paths.
- Keep IDs deterministic.
- Keep time under explicit test control.
- Do not create a mock-only field or endpoint.

### 10.3 Required shared-client tests

- bearer header from memory;
- `credentials: include`;
- unique correlation ID;
- caller-supplied correlation retained on retry;
- API error envelope and field mapping;
- `204` without JSON;
- request abortion;
- safe query retry;
- no mutation retry;
- single-flight refresh;
- one retry after refresh;
- no recursive auth refresh;
- logout cache cancellation/removal;
- safe return URL validation.

### 10.4 Idempotency and concurrency tests

- same pending recommendation retry uses the same key and payload;
- changed recommendation context uses a new key;
- true re-recommendation uses a new key and parent session;
- cooking retry uses the original key;
- feedback double click creates one request;
- record update sends exact quoted `If-Match`;
- record conflict retains draft and does not overwrite cache.

## 11. UC01–UC09 acceptance matrix

### UC01 — account and preferences

- register with valid values;
- invalid field mapping;
- login failure;
- refresh after page reload;
- concurrent `401` requests share one refresh;
- edit profile/preferences;
- logout and logout-all clear private cache;
- direct protected route returns after login.

### UC02 — records

- create food and drink records;
- list and filter history using URL state;
- open direct detail route;
- edit with ETag/version;
- recover from stale-version conflict;
- delete with confirmation;
- group-visible option appears only for authorized groups.

### UC03 — groups

- empty group index;
- create;
- invitation token shown once and copied;
- join by token;
- view members and feed;
- permission-denied edit/member removal;
- recommend for group;
- share a selected recommendation;
- no poll/vote control appears.

### UC04 — recommendation generation

- personal context;
- group context;
- constraints and budget;
- lead candidate is first returned candidate;
- candidate type and backend reasons visible;
- model success;
- deterministic fallback success;
- no valid candidate;
- upstream unavailable;
- direct session recovery.

### UC05 — recommendation feedback

- Try another changes local index and sends no request;
- Accept uses displayed candidate;
- Reject requires enum reason;
- re-recommend records request event and creates child session;
- later rating and would-again use related record when available;
- duplicate feedback conflict is clear;
- dashboard/history invalidation occurs.

### UC06 — cooking

- one and many manual ingredients;
- validation at ingredient/serving limits;
- result with available and to-buy ingredients;
- warnings and ordered steps;
- fallback;
- no valid recipe;
- direct detail and history recovery;
- no automatic pantry claim.

### UC07 — chat

- create and archive session;
- attach permitted Search/Explore/Saved references;
- send and paginate messages;
- render Search/Summary/Compare/Navigation/Out-of-Scope route;
- fallback, unsupported, and failed statuses;
- revoked source becomes unavailable without leaking content.

### UC08 — analytics

- date/grouping URL state;
- counts and ratings;
- separate currency series;
- cuisine and feedback distributions;
- null/empty remains No data;
- chart table/text alternatives;
- valid weekly recap;
- empty weekly recap.

### UC09 — parity and responsive support

- same validation and permission outcomes as Android/backend;
- core paths at 360, 768, and 1440 px;
- keyboard-only completion;
- no horizontal overflow;
- reduced motion;
- direct-route refresh;
- supported Chromium release.

## 12. Accessibility acceptance

Automated:

- no serious/critical axe result on core routes;
- form inputs have accessible names;
- dialogs have names and managed focus;
- live status exists for asynchronous operations;
- charts expose a table/summary.

Manual:

- complete core flow without pointer;
- inspect visible focus;
- zoom to 200%;
- test mobile reflow;
- verify error focus and descriptions;
- confirm no color-only status;
- confirm screen-reader order matches visual order;
- enable reduced motion.

## 13. Security acceptance

- no access/refresh token in browser storage;
- refresh cookie forwarded through same-origin proxy;
- no open-proxy path;
- no private origin in JavaScript bundle;
- no authenticated API caching at proxy/CDN;
- CSP and anti-framing headers;
- safe referrer policy;
- no `dangerouslySetInnerHTML`;
- no personal data in console, CI artifact, screenshot, or telemetry;
- source URL opens with safe link attributes;
- dependency scan has no accepted high-severity issue without documented review;
- external object upload has no FoodMind Authorization header.

## 14. Performance gates

Initial release targets:

- initial JavaScript at or below 180 KB gzip;
- each lazy feature chunk at or below 120 KB gzip unless approved;
- route-level lazy loading for Explore, Cooking, Chat, and Analytics;
- deployed mobile Lighthouse Performance at least 85;
- Accessibility and Best Practices at least 95;
- LCP no worse than 2.5 seconds under the agreed demo profile;
- CLS no worse than 0.1;
- no avoidable full-page refetch when navigating back to cached data.

Bundle exceptions require a PR note explaining the dependency, alternatives,
and lazy-loading decision.

## 15. Deployment workflow

### 15.1 Environments

| Environment | Host | Access | Backend |
|---|---|---|---|
| local | Vite | developer | local or explicit mock |
| preview | existing Sites project | owner/private | staging |
| production demo | Vercel | public HTTPS | production-demo |

Both hosted environments:

- build the same reviewed commit;
- use server-only `FOODMIND_BACKEND_ORIGIN`;
- expose only `/api/v1` to browser code;
- apply the same security headers;
- use no personal production data.

### 15.2 Preview per PR

After CI build:

1. Deploy preview from the PR commit.
2. Run login/bootstrap and route smoke.
3. Check static deep-link fallback.
4. Check proxy cookie and error forwarding.
5. Attach URL and screenshots to the PR.

### 15.3 Release candidate

Freeze frontend commit, backend commit, OpenAPI hash, and seeded data version.
Do not change any of them during UAT without restarting the affected evidence.

Run:

- complete frontend validation;
- full backend tests with Docker/Testcontainers;
- real-backend UC01–UC09 E2E;
- accessibility review;
- security review;
- performance review;
- dual-host smoke;
- demo rehearsal.

### 15.4 Rollback

- Keep the immediately previous successful Sites/Vercel version deployable.
- A frontend rollback deploys the previous immutable frontend commit.
- Never roll back to a frontend whose contract snapshot is incompatible with
  the active backend.
- For a backend rollback, use the compatibility statement in both releases.
- Record rollback owner and result in the release issue.

### 15.5 Release

After UAT approval:

1. Merge the release PR.
2. Verify the `master` build.
3. Deploy private Sites preview.
4. Deploy public Vercel demo.
5. Run post-deploy smoke.
6. Tag `web-v0.1.0`.
7. Publish release notes with frontend/backend commits and known limitations.

## 16. UAT evidence

Evidence record:

```text
Environment:
Frontend commit:
Backend commit:
OpenAPI SHA-256:
Seed dataset:
Browser/device:
Tester:
Date/time/time zone:
Use case:
Expected:
Actual:
Result:
Issue:
Screenshot/video:
```

Use only synthetic/demo identities and data. Redact tokens, cookies, internal
origins, invitation tokens, email addresses not created for testing, and trace
details that expose infrastructure.

## 17. Four-week milestone map

### Week 1 — contract and foundation

- close recommendation contract mismatch;
- pin runtime and dependencies;
- generate typed contract;
- implement proxy, API client, router, Query, design tokens, and tests;
- implement authentication, profile, and preferences.

Exit: authenticated user reaches protected shell using a real backend.

### Week 2 — core decision data

- food/drink records and history;
- groups, invitations, feed;
- Want to Try;
- recommendation fallback vertical slice.

Exit: user records experience, joins a group, generates, selects, and shares a
backend recommendation.

### Week 3 — complete product breadth

- agent result/failure states;
- recommendation feedback and re-recommendation;
- Explore/Search;
- Cooking;
- Chat;
- Dashboard/recap.

Exit: UC01–UC08 feature behavior exists behind reviewed APIs.

### Week 4 — release quality

- UC01–UC09 E2E;
- accessibility and responsive fixes;
- security/performance;
- full backend integration;
- preview and public-demo deployment;
- UAT, release notes, and demo rehearsal.

Exit: `web-v0.1.0` accepted and deployable.

## 18. Final release checklist

### Contract

- [ ] Backend commit and OpenAPI hash frozen
- [ ] `api:check` passes
- [ ] Recommendation status mismatch closed
- [ ] Known gaps documented

### Product

- [ ] UC01–UC09 pass
- [ ] Home recommendation action is first-viewport dominant
- [ ] Try another sends no generate request
- [ ] Unsupported MVP features are absent
- [ ] Photos use placeholders

### Quality

- [ ] Lint/type/build green
- [ ] Coverage thresholds pass
- [ ] Deterministic and real-backend E2E pass
- [ ] Accessibility acceptance passes
- [ ] Performance budgets pass or have approved exceptions

### Security

- [ ] Same-origin proxy verified
- [ ] Tokens/storage/logs reviewed
- [ ] Headers verified
- [ ] Dependency and secret scans pass
- [ ] Demo data contains no real personal data

### Delivery

- [ ] PR approved and conversations resolved
- [ ] Release notes complete
- [ ] Rollback version confirmed
- [ ] Sites preview succeeds
- [ ] Vercel public demo succeeds
- [ ] Post-deploy smoke succeeds
- [ ] `web-v0.1.0` tag created
