# HeliosDB-Nano migration — bug report

Status: **Migration blocked**. The Claude-Dashboard remains on PostgreSQL 15 until the issues below are resolved upstream.

Per the migration directive ("don't implement workarounds, report bugs — HeliosDB should be a 100% drop-in replacement"), this is the unedited list of incompatibilities encountered when attempting a clean drop-in swap of `postgres:15-alpine` → `heliosdb-nano-v2:latest` (HeliosDB Nano 3.19.1) for the dashboard's TypeORM-backed schema.

The scope of the attempted migration was deliberately conservative: same wire protocol, same TypeORM entities, same `synchronize: true` startup path. No code changes to the application, just a `DB_HOST` flip in `docker-compose.yml`. Any of the bugs below was sufficient on its own to abort the migration; together they leave TypeORM (and any `information_schema`-aware client) unable to bootstrap.

## Repro environment

- **HeliosDB Nano**: `3.19.1` (image `heliosdb-nano-v2:latest`, started with `start --data-dir=/data --listen=0.0.0.0 --port=5432`)
- **Client**: `psql` from `postgres:15-alpine` and TypeORM 0.3.x via `node-postgres`
- **Network**: docker-compose internal bridge

## Bug 1 — `CREATE DATABASE` not implemented

**Severity**: medium (forces all tenants into the single built-in DB)
**Reproducer**:
```bash
psql -h heliosdb -U postgres -d postgres -c "CREATE DATABASE claude_dashboard_test;"
```
**Observed**:
```
ERROR:  Query execution error: Statement not yet supported:
  CreateDatabase { db_name: ObjectName([Ident { value: "claude_dashboard_test", ... }]),
                   if_not_exists: false, location: None, managed_location: None }
```
**Expected**: `CREATE DATABASE` is part of the PostgreSQL DDL spec and is the standard way to provision a per-tenant database.
**Workaround attempted**: none. Per directive, reported only.
**Side-effect**: Nano serves a single fixed database named `heliosdb` regardless of the connection's `database` parameter (see Bug 5).

## Bug 2 — `--auth scram-sha-256` rejects libpq's first message

**Severity**: high (blocks the recommended auth method for production)
**Reproducer**: start Nano with `--auth=scram-sha-256 --password=...`, then connect with any libpq-derived client (psql 15 / 16, node-postgres, asyncpg).
```
psql: error: connection to server ... failed:
FATAL:  Protocol error: Invalid SCRAM client-first-message
```
**Expected**: SCRAM-SHA-256 is the default password-based authentication mechanism for PostgreSQL since 14. libpq's framing should be accepted as-is.

## Bug 3 — `--auth password` rejects correct passwords

**Severity**: high (no usable password-based auth method remains after Bug 2)
**Reproducer**: start with `--auth=password --password=foobar`, connect with `PGPASSWORD=foobar`.
```
psql: error: ... FATAL:  Protocol error: Invalid password
```
**Expected**: cleartext-password auth (`AuthenticationCleartextPassword`) is straightforward and should accept the configured password.

After Bugs 2 + 3, the only auth method that lets a TypeORM client connect at all is `--auth=trust` — i.e., no authentication. Acceptable on a container-internal network, but unsuitable for production where defense-in-depth is required.

## Bug 4 — `information_schema.tables` not exposed

**Severity**: blocker (every PostgreSQL ORM startup probe fails)
**Reproducer**: any TypeORM `DataSource.initialize()` against Nano with `synchronize: true`, OR a manual:
```sql
SELECT * FROM information_schema.tables WHERE table_schema = 'public';
```
**Observed** (from the dashboard backend log):
```
query failed: SELECT * FROM "information_schema"."tables"
              WHERE "table_schema" = 'public' AND "table_name" = 'typeorm_metadata'
error: error: Query execution error: Table 'information_schema.tables' does not exist
QueryFailedError: Query execution error: Table 'information_schema.tables' does not exist
    at PostgresQueryRunner.hasTable (...)
    at RdbmsSchemaBuilder.build (...)
    at DataSource.synchronize (...)
    at DataSource.initialize (...)
```
**Expected**: `information_schema` is part of the SQL standard and is universally relied on by ORMs (TypeORM, Prisma, Drizzle, Sequelize, SQLAlchemy, JPA/Hibernate). Without it, no ORM can bootstrap a schema or run migrations.

This is the single biggest blocker. Even in `synchronize: false` mode the migrations table is loaded via `information_schema`.

## Bug 5 — Connection accepts arbitrary database names but always serves `heliosdb`

**Severity**: low (confusing UX; risk of silent cross-tenant reads if multiple apps share a Nano instance)
**Reproducer**:
```bash
psql -h heliosdb -d totally_made_up_db_name -c '\conninfo'
# → "You are connected to database 'totally_made_up_db_name'"
psql -h heliosdb -d totally_made_up_db_name -c "SELECT current_database();"
# →  current_database
#   ------------------
#    heliosdb
```
**Expected**: connecting to a non-existent database should return `FATAL: database "X" does not exist`, mirroring PostgreSQL behaviour. Silently routing every connection to the same single `heliosdb` DB makes multi-tenant deployments unsafe.

## Bug 6 — `pg_dump` restore stalls

**Severity**: medium (data migration path unavailable)
**Reproducer**:
```bash
docker exec postgres pg_dump -U claude --no-owner --no-privileges --schema=public claude_dashboard > dump.sql
psql -h heliosdb -U heliosdb -d heliosdb -f dump.sql
```
**Observed**: the `psql -f` command never returns; no error output, no `CREATE TABLE` statements appear in the connection state. After 60s+ the process is still hanging. This is consistent with one of the early `SET` directives in a `pg_dump` blocking; needs a finer-grained reproducer to localise.

## Summary

| Bug | Component | Severity | Blocks dashboard migration? |
|---|---|---|---|
| 1 | DDL: `CREATE DATABASE` | medium | no, but limits multi-tenant |
| 2 | Auth: `scram-sha-256` | high | yes (no secure auth) |
| 3 | Auth: `password` (cleartext) | high | yes |
| 4 | `information_schema.tables` | **blocker** | **yes** |
| 5 | Database name routing | low | no |
| 6 | `pg_dump` restore | medium | yes (no data migration path) |

## Path forward

The dashboard's `docker-compose.yml` retains the HeliosDB service definition under a `heliosdb` profile so a single `docker compose --profile heliosdb up -d heliosdb` brings it back up for retesting. When the upstream blockers above are fixed (especially #4), the swap is one `DB_HOST` flip plus rerunning the schema migration — TypeORM does the rest.

Until then, the recommended-and-default tier reverts to `postgres:15-alpine`, which the README, install guide, and migration plan have been updated to reflect.
