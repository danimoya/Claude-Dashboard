# Claude Dashboard

> Web-based GUI for Claude Code, Claude-B, and any tmux-attached interactive CLI.

A self-hosted control panel for AI-assisted development: live tmux pane streaming with hotkeys, a [Claude-B](https://github.com/danimoya/Claude-B) background-agent inbox/transcript view, project workspaces with file browser + Monaco editor, and 2FA-gated settings — backed by a single encrypted [HeliosDB-Nano](https://github.com/Dimensigon/HDB-HeliosDB-Nano) data tier.

## Security note — HTTPS-only, opt-in telemetry

This dashboard exposes a shell of your machine to the network: tmux panes, the Claude-B inbox, project files, and (without 2FA, for first login) the API keys you'll later store in `/settings`. **It is designed to run behind TLS only.** The recommended deployment terminates SSL at Nginx Proxy Manager (NPM) with auto-renewing Let's Encrypt certs and forwards plaintext only on a Docker-internal network. Plaintext on the public internet is not a supported configuration.

A first-run setup wizard at `/setup` walks you through the admin user, optionally enrolls 2FA, and asks — explicitly — whether you want to enable two **independent** features that are off by default:

- **Submit weekly install pings** — sends exactly `{installation_id, dashboard_version, heliosdb_version, timestamp}`. No IP, no username, no host metadata. The receiver hashes `(client_ip, installation_id)` with a weekly-rotating salt and only retains the hash, so duplicate installs are deduplicated without anyone holding a re-identifiable address. Full schema and retention live at `/telemetry`.
- **Check for updates** — pure `GET` against a public JSON feed; the client sends nothing.

Both default to **off**, both can be toggled independently any time from `/telemetry`, and both are documented at `/telemetry` alongside the exact JSON payload that would be sent. Receiver source — including the schema, salt-rotation cron, and audit changelog — at [github.com/danimoya/telemetry](https://github.com/danimoya/telemetry).

If you've just cloned this repo onto a fresh server, see [`docs/install.md`](docs/install.md) — it includes a copy-pasteable bootstrap prompt that an AI agent (Claude Code, Codex) can execute end-to-end: Docker, NPM with auto-SSL, HeliosDB-Nano, and the dashboard itself, in that order.

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Docker** ≥ 24 with `docker compose`
- **tmux** running on the host (the container reuses the host's socket)
- **A domain with an A record pointed at the server** — required for TLS issuance.
- **Claude-B daemon** (`cb`) on the host if you want the background-agent UI ([install instructions](#claude-b-integration) below).

## Quick start

```bash
git clone https://github.com/danimoya/Claude-Dashboard.git
cd Claude-Dashboard

cp .env.example .env       # then edit secrets
docker compose up -d --build
```

By default the stack ships with PostgreSQL 15 + Redis 7 — the legacy combination — so it boots immediately. The **recommended path for new deployments** swaps both for a single [HeliosDB-Nano](https://github.com/Dimensigon/HDB-HeliosDB-Nano) container: one 47 MB binary, AES-256-GCM encryption at rest for 2FA secrets and bcrypt-hashed backup codes, native PostgreSQL wire protocol so TypeORM keeps working without code changes. See [`docs/heliosdb-migration.md`](docs/heliosdb-migration.md) for the rationale and the migration plan.

For the full server-bootstrap flow with auto-SSL, see [`docs/install.md`](docs/install.md). For local development without Docker, see [`docs/development-setup.md`](docs/development-setup.md). For day-2 operations, see [`docs/deployment.md`](docs/deployment.md).

## Architecture

Three npm workspaces under one repo:

```
claude-dashboard/
├── frontend/          React 18 + Vite + TypeScript + Tailwind + xterm.js
├── backend/           Express + TypeORM + Socket.IO + Bull
├── shared/            Shared TS types + Zod schemas
├── infrastructure/    docker-compose dev stack
├── docs/              Architecture, deployment, perf, testing
├── scripts/           Admin helpers (e.g., 2fa-admin.sh)
└── tests/             Playwright E2E
```

Backend: JWT auth (15-min access + 7-day refresh, Redis-backed blacklist), TypeORM with auto-sync entities, Bull queues (cli-commands / voice-transcription / scheduled-tasks), Winston, Prometheus metrics, Zod validation. Frontend: Zustand for auth state, React Query for server state, Socket.IO client for live tmux + CLI streams.

## Roadmap

What works today, what's queued.

### Working

| Area | Status | Notes |
|---|---|---|
| **Auth + JWT refresh** | ✅ | Access/refresh tokens, Redis-backed blacklist, rate limit. |
| **Projects + file browser + Monaco** | ✅ | `/projects/:id` workspace; bind-mounted projects directory. |
| **Tmux pane streaming** | ✅ | `/cli` lists host sessions, click to attach. Live `capture-pane -e` over Socket.IO `/tmux`, ANSI-color rendered. |
| **Tmux pane quick-jump** | ✅ | Per-window buttons in the top bar; tooltip shows running command. |
| **Tmux send-keys** | ✅ | Curated keysets per detected tool: Claude Code, Codex, generic shell. Cycle-Modes button (⇧Tab) emphasized. |
| **Auto tmux per project** | ✅ | New projects get a slug-named host tmux session rooted at the project path. |
| **Claude-B integration** | ✅ | Sessions list, full transcript view, send prompts, kill sessions. WS proxy for live output. |
| **Claude-B mailbox inbox** | ✅ | HTML/markdown render of `resultFull`, filters (all/unread/read), per-message + bulk delete. |
| **2FA on /settings** | ✅ | TOTP (RFC 6238), QR enrollment, 8 backup codes, step-up token (10 min). CLI override via `scripts/2fa-admin.sh`. |
| **Voice input + prompt enhancement** | ✅ | Speechmatics + OpenAI/Anthropic backends. |
| **Scheduled tasks** | ✅ | Bull-backed cron with quota tracking. |
| **Prometheus metrics + Winston** | ✅ | `/metrics` endpoint, structured logs. |
| **Docker compose deploy** | ✅ | One image, host tmux socket bind-mounted. |
| **HTTPS-only via NPM + Let's Encrypt** | ✅ | Public traffic terminates at Nginx Proxy Manager; the app container has no public port. See [`docs/install.md`](docs/install.md). |
| **First-run setup wizard** | ✅ | `/setup` — admin user, optional 2FA enrollment hint, two opt-in toggles (telemetry ping + update check) both **off by default**. |
| **Anonymous opt-in telemetry** | ✅ | `/telemetry` shows the exact 4-field JSON payload, the salted-hash dedupe scheme, and the 90-day retention policy. Receiver source at [github.com/danimoya/telemetry](https://github.com/danimoya/telemetry). |

### Planned / Nice-to-have

- **HeliosDB-Nano default data tier** — collapse the legacy Postgres + Redis into a single 47 MB encrypted-at-rest binary. Recommended for new deployments today; the migration guide is in [`docs/heliosdb-migration.md`](docs/heliosdb-migration.md). Default in the next compose template.
- **HeliosDB CodeKB MCP integration** — out-of-the-box wiring so the dashboard's tmux-attached AI agents query an indexed knowledge base of the repo instead of grepping ([heliosdb-codekb-mcp](https://github.com/dimensigon/heliosdb-codekb-mcp)).
- **Tmux split-pane create/kill from UI** — currently you can attach + send keys but not create new windows/panes from the dashboard.
- **Tmux session sharing / multi-cursor** — read-only spectator mode for handoffs.
- **Background-agent scheduling UI** — surface the existing scheduler entity in the frontend.
- **Per-project secrets vault** — encrypted env file editor with 2FA-gated read.
- **OAuth providers** — GitHub / Google login alongside username/password.

## Common commands

```bash
# Install
npm install

# Run all dev servers (frontend :3000, backend :5000)
npm run dev

# Build everything
npm run build

# Tests
npm test                                  # all workspaces
npm run test --workspace=frontend
npm run test --workspace=backend
cd tests && npx playwright test           # E2E

# Lint + format + typecheck
npm run lint
npm run format
npm run typecheck

# 2FA admin override
./scripts/2fa-admin.sh status <username>
./scripts/2fa-admin.sh disable <username>
```

## Claude-B integration

The dashboard's **Background Tasks** view is a thin client over the [Claude-B (`cb`)](https://github.com/danimoya/Claude-B) daemon — a background-agent wrapper around Claude Code that supports fire-and-forget prompts, persistent sessions, an inbox of completed tasks, and a Telegram bridge so you can follow long-running runs from your phone.

### Install Claude-B on the host

```bash
# Easiest path:
curl -fsSL https://claude-b.foor.tech/install | sh

# Then start the daemon (systemd unit auto-installed):
sudo systemctl enable --now cb-daemon.service
cb -s     # verify: list sessions
```

The dashboard discovers `cb` on `host.docker.internal:3847` (REST + WebSocket). The `CB_API_URL` env var in `.env` controls this; default works for the bundled compose file.

### Telegram bridge (optional)

When `cb` is wired to Telegram, completed sessions ping you with a `resultPreview`, a voice summary (OpenAI TTS), and inline buttons to reply. Voice notes back are transcribed (Whisper) and routed to the right session. Setup is two commands:

```bash
# 1. Create a bot with @BotFather, copy the token, then:
cb --telegram <BOT_TOKEN>

# 2. (Optional) wire the Stop hook so live tmux panes also notify Telegram:
#    add to ~/.claude/settings.json:
#    "hooks": { "Stop": [{ "hooks": [{ "type":"command","command":"$HOME/Claude-B/bin/cb-notify.sh" }] }] }
cb --telegram-status
```

The dashboard's Inbox renders the same `resultFull` markdown that Telegram shows, so the two surfaces stay in sync.

## Documentation

- [docs/install.md](docs/install.md) — fresh-server bootstrap (Docker + NPM + HeliosDB + this stack), with a paste-into-an-agent prompt
- [docs/heliosdb-migration.md](docs/heliosdb-migration.md) — single-database deployment with HeliosDB-Nano (encryption at rest, native PG wire, retires Redis)
- [docs/heliosdb-bugs.md](docs/heliosdb-bugs.md) — current upstream gaps blocking the HeliosDB-Nano default; the swap is gated on these
- `/telemetry` (live page in the running dashboard) — exact JSON payload, retention policy, two independent toggles
- [docs/architecture.md](docs/architecture.md) — system architecture, data flow, entities
- [docs/repository-update-guide.md](docs/repository-update-guide.md) — routine change, deploy, smoke-test, and publish checklist
- [docs/deployment.md](docs/deployment.md) — day-2 operations
- [docs/development-setup.md](docs/development-setup.md) — local dev quick-start
- [docs/testing-strategy.md](docs/testing-strategy.md) — Vitest + Jest + Playwright matrix
- [docs/performance-optimization-strategy.md](docs/performance-optimization-strategy.md) — perf budgets and tactics

### Related projects

- [HeliosDB-Nano](https://github.com/Dimensigon/HDB-HeliosDB-Nano) — embedded encrypted database powering the recommended single-DB deployment ([crate](https://crates.io/crates/heliosdb-nano)).
- [HeliosDB CodeKB MCP](https://github.com/dimensigon/heliosdb-codekb-mcp) — MCP server that indexes this repository against HeliosDB-Nano so Claude Code / Codex / Cursor can answer code questions with 200-byte tool results instead of 50 KB file dumps. Optional but a meaningful token saving when the dashboard's tmux panes drive AI agents ([crate](https://crates.io/crates/heliosdb-codekb-mcp)).
- [Claude-B](https://github.com/danimoya/Claude-B) — background-agent daemon that powers `/tasks`.

## Contributing

1. Fork
2. `git checkout -b feature/<name>`
3. Commit (Husky + lint-staged run ESLint + Prettier on staged files)
4. PR

## License

[Apache License 2.0](LICENSE).

Built with [Claude Code](https://www.anthropic.com/claude) and [Claude-B](https://github.com/danimoya/Claude-B).
