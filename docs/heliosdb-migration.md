# Single-database deployment with HeliosDB-Nano

Status: recommended path for new deployments.

This document is the technical rationale for the dashboard's recommended data tier — **one [HeliosDB-Nano](https://github.com/Dimensigon/HDB-HeliosDB-Nano) process** (47 MB, embedded mode over a Unix socket) — instead of the legacy `postgres + redis` pair. It collapses two services into one, encrypts data at rest with AES-256-GCM, ships TLS and SCRAM-SHA-256 out of the box, and trims the running footprint of a Claude-Dashboard install to roughly a third of what it was.

## TL;DR

| Today (legacy) | Recommended |
|---|---|
| `claude-dashboard-db` (postgres:15-alpine, ~80 MB) | `heliosdb` — single 47 MB binary |
| `claude-dashboard-redis` (redis:7-alpine, ~30 MB) | (folded in: cache + queue migrate to SQL) |
| Two healthchecks, two volumes, two TCP services | One process, one volume, one Unix socket |
| App-level encryption only (TypeORM `select: false`) | **AES-256-GCM at rest** for the entire data file |
| TLS optional, has to be wired by hand | **TLS + SCRAM-SHA-256 in-process**, no sidecar |
| Postgres-only schema, Redis on the side | One SQL surface — backups, migrations, observability all in one place |

The wire is unchanged: HeliosDB-Nano speaks **PostgreSQL v3.0 protocol natively**, so TypeORM, the existing 7 entities, `synchronize: true`, and every query in the codebase keep working with a connection-string change.

## Why Nano (not Full)

[HeliosDB-Nano](https://crates.io/crates/heliosdb-nano) is the embedded edition of HeliosDB. It's the right fit for a dashboard:

- **One binary, no orchestration.** Drop it into the existing Compose file or run it inside the dashboard container itself. No replica set, no sentinel, no separate cache layer to keep coherent.
- **Embedded / Unix-socket mode.** `--pg-socket-dir /tmp` skips the loopback TCP stack. Lower latency than `postgres + redis` over loopback, and the socket file lives inside the container's namespace — nothing on a public port.
- **Encryption at rest as a first-class option** (`--features encryption`, default in published binaries). The 2FA secret column, the bcrypt-hashed backup-code column, the `apiKeys` JSONB blob — all benefit from a kernel-opaque, AES-256-GCM-sealed page store. We keep the column-level `select: false` discipline; HeliosDB adds defence-in-depth underneath.
- **HNSW + GraphRAG-ready.** The same database that holds users and sessions can hold embeddings for any future feature (semantic search over notifications, RAG over the project file tree). One backup, one access policy.
- **Apache 2.0 license** — same as this dashboard. License-aligned, no GPL drag.

The Full edition exists for clusters and multi-protocol gateways. The dashboard is a single-tenant tool: Nano is the right shape.

## What this stack actually uses

A protocol-level inventory of the Postgres + Redis surface area in `backend/`:

### PostgreSQL (TypeORM)

- 7 entities: `User`, `Project`, `Session`, `Task`, `CLISession`, `Activity`, `ScheduledTask`
- `synchronize: true` — schema generated from decorators at boot
- Types: `uuid`, `varchar`, `text`, `int`, `boolean`, `timestamp`, `jsonb` (User.apiKeys, User.preferences, User.twofaBackupCodes, Project.metadata)
- SQL: PK, FK with `ON DELETE CASCADE`, unique constraints, defaults, `CreateDateColumn`/`UpdateDateColumn` (`DEFAULT now()`), TypeORM migrations table

All of this maps 1:1 onto HeliosDB-Nano's PostgreSQL surface — UUID, JSONB, foreign keys, triggers, CTEs, window functions, `INSERT … RETURNING`, `ON CONFLICT`. No code changes.

### Redis

- **JWT blacklist** (`tokenBlacklist.service.ts`): `SET key TTL`, `EXISTS`, `DEL`
- **Bull queues** (`config/queue.ts`): three queues — `cli-commands`, `voice-transcription`, `scheduled-tasks`
- **Cache service** (`cache.service.ts`): generic `GET`/`SET` with TTL

Bull is Redis-only by design, and Nano speaks PG/MySQL but not RESP, so the migration consolidates both Redis use-cases into the same SQL store:

- **JWT blacklist → SQL table** with an `expires_at` column and a partial index. Same semantics, ~30 LoC service rewrite.
- **Generic cache → SQL table** with TTL eviction, or removed entirely if the call site can be made stateless. Most usages already had short TTLs.
- **Bull → [`pg-boss`](https://github.com/timgit/pg-boss)** — battle-tested, PG-backed job queue with the same job-state machine Bull provides (states, retries, delays, scheduling, cron). Drop-in for our three queues; the worker code stays nearly identical because we already wrap Bull behind `addCLIJob` / `getJobStatus`.

The net: one storage system, one backup, one set of metrics, one auth surface. The Redis hop disappears.

## Security posture you get for free

The dashboard's threat model assumes the box is on the public internet. Three doors slam shut by adopting Nano:

1. **Disk encryption (AES-256-GCM).** With `--features encryption` and a passphrase from the host's keyring (or `--key-file`), the on-disk pages are sealed. A stolen volume snapshot is unreadable. This is the layer beneath TypeORM's `select: false`, not a replacement for it — the secrets stay encrypted even when the SQL filter is bypassed (e.g., a backup tool reads the data file directly).

2. **2FA & login secrets, properly cold.** `User.twofaSecret`, `User.twofaBackupCodes` (bcrypt-hashed), `User.passwordHash`, and the `apiKeys` JSONB live behind:
   - column-level `select: false` (existing)
   - **AES-256-GCM at rest** (new, via Nano)
   - **TLS + SCRAM-SHA-256** on the wire (new, native; no `stunnel` or sidecar)

   The 10-minute step-up token and the JWT signing keys are environment-scoped; they never touch the data file.

3. **No exposed Redis.** Redis on a public host is a recurring CVE target — even when bound to localhost, container networking can leak it. Removing it removes the blast radius.

## Performance posture

From `Helios/Full/docs/PERF_VS_POSTGRESQL.md` (HeliosDB-Full v7.2 vs Postgres 14, both via psycopg2 over loopback, 1k-row synthetic table — Nano shares the same storage engine):

| Operation | HeliosDB | Postgres 14 | Delta |
|---|---|---|---|
| Point lookup | 75 µs | 132 µs | 1.8× |
| Full scan SELECT | 323 µs | 859 µs | 2.7× |
| Single-row INSERT | 75 µs | 481 µs | 6.4× |
| UPDATE WHERE | 83 µs | 466 µs | 5.6× |
| Mixed OLTP | 82 µs | 271 µs | 3.3× |

For the dashboard's load profile (single user, infrequent writes, occasional queue traffic) the win is dominated by the **complexity reduction**, not raw throughput. The latency headroom is there if the deployment grows.

## Token economy: HeliosDB CodeKB MCP

A Claude-Dashboard install also unlocks an unrelated efficiency win: **[`heliosdb-codekb-mcp`](https://github.com/dimensigon/heliosdb-codekb-mcp)** ([crate](https://crates.io/crates/heliosdb-codekb-mcp)). It's an MCP stdio server that embeds Nano as a Rust library and exposes LSP-shaped + GraphRAG tools (`helios_lsp_definition`, `helios_lsp_references`, `helios_graphrag_search`, `helios_ast_diff`, …) over plain JSON-RPC.

In practice this means Claude Code, Codex, Cursor, Aider — anything MCP-aware running inside one of the dashboard's tmux panes — can answer "where is `tmuxService.capturePane` defined?" or "what calls `addCLIJob`?" with a 200-byte tool result instead of a 50 KB file dump. Per-session token spend on a typical refactor drops materially. It's optional, opt-in, and reuses the same HeliosDB binary you already run.

Setup is one command per indexed source-tree:

```bash
heliosdb-codekb-mcp init --source ~/Claude-DashBoard --mode co-located
# then register the MCP server in Claude Code's settings
```

`docs/architecture.md` and the project tree become a queryable knowledge base; the dashboard's tmux panes inherit it automatically.

## Migration plan

Phased, reversible, no downtime for an existing install if you keep the legacy services running until the final cutover.

### Phase 1 — Provision Nano alongside

Add the service to `docker-compose.yml`. It doesn't replace anything yet; it stands up on a different port so the existing schema can be dumped and reloaded.

```yaml
heliosdb:
  image: heliosdb/nano:latest
  container_name: claude-dashboard-heliosdb
  restart: unless-stopped
  command:
    - start
    - --data-dir=/var/lib/heliosdb
    - --auth=scram-sha-256
    - --password=${DB_PASSWORD}
    - --tls-cert=/certs/cert.pem
    - --tls-key=/certs/key.pem
    - --features=encryption
    - --pg-socket-dir=/run/heliosdb
    - --port=5432
  environment:
    HELIOSDB_ENCRYPTION_KEY: ${HELIOSDB_ENCRYPTION_KEY}   # 32-byte key from your secret manager
  volumes:
    - heliosdb_data:/var/lib/heliosdb
    - heliosdb_socket:/run/heliosdb
    - ./infrastructure/certs:/certs:ro
  networks:
    - internal
```

### Phase 2 — Migrate the schema

```bash
pg_dump -h claude-dashboard-db -U claude claude_dashboard \
  | psql "postgres:///?host=/run/heliosdb&user=claude&password=${DB_PASSWORD}"
```

TypeORM's `synchronize: true` handles incremental drift on the next boot.

### Phase 3 — Migrate Redis usage

- **Blacklist**: replace `tokenBlacklist.service.ts` with a `TokenBlacklist` entity + a small Postgres-backed service (`expires_at` column, partial index, sweep job).
- **Cache**: replace `cache.service.ts` with a `Cache` entity using the same shape. Or remove call-sites that no longer need a cache.
- **Bull → pg-boss**: swap `bull` for `pg-boss` in `config/queue.ts`. The `addCLIJob` / `getJobStatus` wrappers absorb the API differences. Bull's worker handlers map onto pg-boss `subscribe()` callbacks.

### Phase 4 — Cut over

Point the app at the Nano service:

```yaml
DB_HOST: /run/heliosdb        # Unix socket — no TCP at all
DB_PORT: ""                   # libpq: empty port + Unix path = socket connection
# REDIS_HOST and REDIS_PORT removed.
```

Stop and remove the legacy `postgres` and `redis` services. The dashboard now runs on a single data process.

## What you're choosing not to do

- **Stay on Postgres + Redis**: still fully supported. The dashboard works as it did before; this document is purely about the simpler, encrypted, single-binary alternative.
- **Use Nano in pure embedded library mode**: the dashboard is a Node.js app, so it talks to Nano over PG wire (Unix socket). Linking Nano as a library makes sense for the Rust-native consumers (`heliosdb-codekb-mcp` does this); for our Node backend, Unix-socket PG is the right interface.

## References

- HeliosDB-Nano — https://github.com/Dimensigon/HDB-HeliosDB-Nano · [crate](https://crates.io/crates/heliosdb-nano)
- HeliosDB CodeKB MCP — https://github.com/dimensigon/heliosdb-codekb-mcp · [crate](https://crates.io/crates/heliosdb-codekb-mcp)
- Local source: [`/home/app/Helios/Nano`](../../Helios/Nano), [`/home/app/Helios/heliosdb-codekb-mcp`](../../Helios/heliosdb-codekb-mcp)
- Performance numbers: `Helios/Full/docs/PERF_VS_POSTGRESQL.md`
- pg-boss — https://github.com/timgit/pg-boss (PG-backed job queue used to retire Bull)
