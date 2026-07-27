# Web Local Development

## Prerequisites

- Git
- A Node.js version supported by the committed Vite version
- npm
- A running or mocked FoodMind backend

The team should pin the Node.js version before CI is finalised.

## Install

Use the lockfile:

```powershell
npm ci
```

Do not use `npm install` in CI because it may rewrite dependency resolution.

## Configure

Create `.env.local`:

```text
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_APP_ENV=local
```

`.env.local` is local-only. Never place credentials or internal service addresses in it.

## Run

```powershell
npm run dev
```

Vite prints the actual local URL. Do not assume a fixed port if it is already occupied.

## Validate

```powershell
npm run lint
npm run build
```

When test tooling is introduced, the repository should also provide:

```text
npm run test
npm run test:coverage
npm run test:e2e
```

Do not add these scripts until they execute real checks.

## Backend Modes

### Real backend

Use the local Spring Boot URL for integrated development.

### Mocked contract

Use fixtures verified against the committed OpenAPI contract when the backend is unavailable. Mock handlers must reproduce:

- Success responses
- Validation errors
- Authentication failure
- Forbidden access
- Empty results
- Recommendation fallback
- Internal-service unavailable states

Mocks must not become a separate undocumented API design.

## Browser Checks

Before a Pull Request:

- Test a supported Chromium browser.
- Test keyboard-only interaction.
- Check responsive widths.
- Confirm no secret or internal URL appears in the production bundle.
- Confirm network errors have a recoverable state.
- Confirm console output contains no token or personal data.

## Production Build

```powershell
npm run build
```

The generated `dist/` directory is build output and is not committed. Deployment should build from a reviewed commit.

## Troubleshooting

### API requests fail

- Check `VITE_API_BASE_URL`.
- Confirm it includes `/api/v1` according to the selected convention.
- Confirm backend CORS permits the local Web origin.
- Check browser network logs for the backend error code.

### Authentication repeatedly expires

- Confirm the backend token lifetime.
- Check system time.
- Ensure concurrent requests share the same session strategy.
- Clear stale local development data.

### Build succeeds locally but fails in CI

- Use `npm ci`.
- Pin the Node version.
- Check case-sensitive import paths.
- Confirm no source depends on an untracked local file.
