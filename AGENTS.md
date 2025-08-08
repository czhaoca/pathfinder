# Repository Guidelines

## Project Structure & Module Organization
- Root workspaces: `backend` (Node/Express API, services) and `frontend` (React + Vite + TS).
- Docs and ops: `docs/`, `docker-compose.yml`, `nginx/`.
- Tests: `backend/tests/{unit,integration}/`, `frontend/tests/` plus component tests under `frontend/src`.
- Notables: MCP server in `backend/src/services/mcp-server.js`; API in `backend/src/api/`.

## Build, Test, and Development Commands
- Dev (both apps): `npm run dev` — runs backend and frontend concurrently.
- Backend: `npm run backend:dev|start|test|lint`.
- Frontend: `npm run frontend:dev|build|preview|test|lint`.
- Full test & lint: `npm test` and `npm run lint`.
- Docker (optional): `npm run dev:docker`, `npm run prod:docker`, `npm run docker:down`.
- Data setup (backend): `cd backend && npm run db:setup && npm run db:seed` (see `backend/src/database`).

## Coding Style & Naming Conventions
- Language: Backend JavaScript (Node 18+); Frontend TypeScript/React.
- Indentation: 2 spaces; prefer trailing commas; semicolons in TS.
- Linting: ESLint (`backend` and `frontend` configs); fix with `npm run backend:lint` / `frontend:lint`.
- Naming: camelCase for variables/functions; PascalCase for React components (e.g., `ProfileCard.tsx`); hooks start with `use*`.
- Files: colocate tests next to code or under `tests/` using `*.test.js|ts|tsx`.

## Testing Guidelines
- Backend: Jest (Node env). Run `npm run backend:test`; targeted: `test:unit`, `test:integration`.
- Frontend: Vitest + Testing Library (jsdom). Run `npm run frontend:test`; coverage: `npm --workspace frontend run test:coverage`.
- Coverage: minimum 80% (branches, lines, funcs) enforced by config.

## Commit & Pull Request Guidelines
- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, etc. Keep scope clear and present-tense.
- PRs: clear description, link issues (`#123`), include UI screenshots/GIFs for frontend, note DB changes.
- Requirements: CI green (tests + lint), updated docs when behavior or APIs change, small focused diffs.

## Security & Configuration Tips
- Never commit secrets. Start from `.env.example` in `backend/` and `frontend/`.
- Verify DB connectivity: `npm run backend:dev` then `npm --workspace backend run db:health`.
- Docker profiles: `development`, `production`, `nginx` available via `docker-compose` scripts.
