# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

InvenTree is an inventory management system with:
- a Django backend in `src/backend/InvenTree`
- a React/Vite frontend SPA in `src/frontend`
- invoke-based developer workflows defined in `tasks.py`

The backend serves both the REST API and the frontend shell. The frontend is a SPA mounted under `settings.FRONTEND_URL_BASE`, while `/api/` exposes DRF endpoints.

## Common commands

Run most project tasks from the repository root via `invoke`.

### Backend setup and development
- Install backend dependencies: `invoke install`
- Install dev dependencies and pre-commit hooks: `invoke setup-dev`
- Run database migrations: `invoke migrate`
- Start Django dev server: `invoke server`
- Start background worker (Django Q): `invoke worker`
- Open Django shell: `invoke shell`
- Create admin user: `invoke superuser`

### Frontend setup and development
- Install frontend dependencies: `invoke frontend-install`
- Start frontend dev server: `invoke frontend-server`
- Build frontend assets: `invoke frontend-build`
- Compile frontend translations: `invoke frontend-compile`

### Tests
- Run backend test suite: `invoke test`
- Run a single backend test module/class/method: `invoke test --runtest=company.test_api` or `invoke test --runtest=part.tests.test_views.SomeTestCase.test_method`
- Keep the test DB: `invoke test --keepdb`
- Run frontend Playwright UI test runner: `invoke frontend-test`
- Prepare test data / environment: `invoke setup-test`

### Linting / formatting / checks
- Run pre-commit checks across the repo: `pre-commit run --all-files`
- Run Python formatter: `ruff format --preview src/backend/InvenTree`
- Run Python lint autofixes: `ruff check --fix --preview src/backend/InvenTree`
- Run frontend checks with Biome: `pre-commit run biome-check --all-files`

### Static assets / translations / docs
- Collect static files: `invoke static`
- Rebuild translations: `invoke translate`
- Serve docs locally: `invoke docs-server`
- Build docs artifacts: `invoke build-docs`

## Architecture

### Backend
- Django entrypoint is `src/backend/InvenTree/manage.py`.
- Main Django settings live in `src/backend/InvenTree/InvenTree/settings.py`. The file explicitly says runtime configuration should come from `config.yaml` rather than editing settings directly.
- Top-level URL routing is in `src/backend/InvenTree/InvenTree/urls.py`.
  - `/api/` aggregates app-specific API modules from domains like `build`, `company`, `order`, `part`, `stock`, `users`, etc.
  - auth, schema, version, license, and search endpoints are also wired there.
  - non-API traffic is handed to the web SPA URLs, with catch-all redirects back to the frontend.
- SPA/web URL handling is in `src/backend/InvenTree/web/urls.py`.
  - Django serves `web/index.html` for the SPA shell.
  - there is a compatibility layer redirecting legacy server-rendered routes into SPA routes.
- Plugin URL integration is in `src/backend/InvenTree/plugin/urls.py`.
  - plugin routes are dynamically mounted under `/plugin/<slug>/...` when plugin URL support is enabled.
- Background jobs use Django Q; the developer entrypoint is `invoke worker`.

### Frontend
- Frontend entrypoint is `src/frontend/src/main.tsx`.
  - It bootstraps global browser settings from `window.INVENTREE_SETTINGS` injected by Django.
  - It exposes React / Mantine / Lingui globals for plugin-facing UI integrations.
  - It redirects `/` to the configured frontend base URL.
- The main app split starts in `src/frontend/src/views/MainView.tsx`.
  - It initializes API defaults.
  - It chooses between `DesktopAppView` and `MobileAppView` based on viewport and user preference.
- The desktop SPA shell is in `src/frontend/src/views/DesktopAppView.tsx`.
  - It wraps the app with `ApiProvider`, `ThemeContext`, and `BrowserRouter`.
  - Router basename comes from `getBaseUrl()`, so route generation must respect the configured frontend base path.
- Shared API client setup is in `src/frontend/src/App.tsx`.
  - Axios is configured for cookie/session auth and CSRF headers.
  - TanStack Query is the shared query client.
- Client-side persisted UI/session state is managed with Zustand stores, e.g. `src/frontend/src/states/LocalState.tsx`.
  - host selection, language, theme, widget layouts, navigation state, and mobile preference live there.
  - some local state updates patch the user profile back to the backend via the shared Axios instance.
- API + query context wiring is in `src/frontend/src/contexts/ApiContext.tsx`.

### Cross-cutting patterns
- Backend and frontend are tightly coupled through the SPA shell plus `window.INVENTREE_SETTINGS`; when changing host/base-url/auth/bootstrap behavior, inspect both Django web views and frontend bootstrap code.
- `tasks.py` is the authoritative workflow entrypoint for local development. Prefer documented `invoke` tasks over inventing ad-hoc commands.
- The repo uses Ruff for Python formatting/linting, Biome for frontend checks, and pre-commit to orchestrate repository-wide validation.
- Frontend translations use Lingui (`extract` / `compile` scripts in `src/frontend/package.json`).
- The frontend package `src/frontend` is also published as `@inventreedb/ui`, and its public types/components are intended for plugin UI integrations.

## Practical notes for changes
- Prefer reading `tasks.py` before changing developer workflows; many useful commands are wrapped there.
- If a change affects routing, inspect both Django URL configuration and frontend router/base-url handling.
- If a change affects plugins, check both backend plugin registry/URL behavior and frontend plugin-facing globals.
- Do not edit Django settings for deployment-specific behavior when the same setting is expected to come from `config.yaml` or injected runtime configuration.
