# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Dashboard is a web-based GUI wrapper for Claude Code and Claude Flow CLI tools. It's a full-stack TypeScript monorepo with three npm workspaces: `frontend`, `backend`, and `shared`.

## Common Commands

```bash
# Install all workspace dependencies
npm install

# Start dev infrastructure (PostgreSQL + Redis + Adminer)
npm run docker:up

# Run database migrations
npm run db:migrate

# Start all dev servers (frontend :3000, backend :5000, Adminer :8080)
npm run dev

# Build all workspaces
npm run build

# Run all tests across workspaces
npm test

# Run tests for a specific workspace
npm run test --workspace=frontend
npm run test --workspace=backend

# Run a single test file (frontend uses Vitest, backend uses Jest)
npx vitest run path/to/test.ts          # frontend
npx jest path/to/test.ts                # backend

# E2E tests (Playwright - Chromium, Firefox, WebKit, mobile)
cd tests && npx playwright test

# Lint and format
npm run lint
npm run format

# Type checking
npm run typecheck
```

## Architecture

### Monorepo Layout

- **`frontend/`** — React 18 + Vite + TypeScript. Uses Zustand (auth state with localStorage persistence), React Query (server state, 5min stale time), Socket.io-client (real-time CLI output). UI: Tailwind CSS, Monaco Editor, xterm.js, Recharts, react-arborist.
- **`backend/`** — Express + TypeORM + PostgreSQL + Redis. JWT auth (15min access + 7d refresh tokens, Redis-backed blacklist). Bull queues (cli-commands, voice-transcription, scheduled-tasks). Winston logging, Prometheus metrics, Zod validation.
- **`shared/`** — Shared TypeScript interfaces (`types.ts`), Zod validation schemas (`schemas.ts`), and constants (`constants.ts`) including API routes, WebSocket events, and config limits.
- **`infrastructure/`** — Docker Compose configs. Dev stack: PostgreSQL 15, Redis 7, Adminer.
- **`tests/`** — Playwright E2E tests across 5 browser projects.

### Key Data Flow: CLI Sessions

1. API request creates a `CLISession` entity in PostgreSQL
2. `ClaudeWrapperService` spawns a `claude` or `claude-flow` child process
3. stdout/stderr streamed via EventEmitter → `CLIOutputParserService` → `CLIGateway`
4. `CLIGateway` broadcasts parsed output over Socket.io `/cli` namespace to subscribed rooms (`session:{id}`)
5. Inactive sessions auto-cleaned after 30 minutes

### WebSocket Authentication

Socket.io connections authenticate via JWT in the handshake. The `/cli` namespace handles session subscriptions with room-based routing.

### Frontend API Layer

Axios client with request interceptor (attaches JWT) and response interceptor (auto-refreshes on 401). All API calls go through `/api/v1`.

### Database Entities (7)

User, Project, Session, Task, CLISession, Activity, ScheduledTask — managed by TypeORM with migration support.

## Testing

- **Frontend**: Vitest + Testing Library. Coverage thresholds: 85% statements, 80% branches, 85% functions/lines.
- **Backend**: Jest + ts-jest + Supertest. Coverage thresholds: 80% statements, 75% branches, 80% functions/lines.
- **E2E**: Playwright with 2 retries in CI, traces on retry, screenshots on failure.

## TypeScript Configuration

Base tsconfig uses ES2022 target, strict mode, bundler module resolution. Frontend adds path aliases: `@/*` → `src/*`, `@shared/*` → shared types.

## Pre-commit

Husky + lint-staged runs ESLint fix and Prettier on staged `.{js,jsx,ts,tsx}` files, and Prettier on `.{json,md}` files.
