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

## Bug 7 — Multi-statement queries rejected

**Severity**: low (purely client-side splitting needed)
**Reproducer**:
```js
await pool.query(`CREATE TABLE foo (a INT); CREATE INDEX foo_a ON foo (a);`);
```
**Observed**: `Multiple statements not supported in single query`.
**Expected**: Postgres' simple-query protocol allows semicolon-separated
statements in a single message; our schema bootstrap relied on it. Easy
client-side fix (split into separate `pool.query` calls), but it means
you cannot paste a multi-statement DDL block.

## Bug 8 — Parameterised SELECT crashes node-pg

**Severity**: blocker for any client that uses prepared statements
**Reproducer**:
```js
await pool.query("SELECT COUNT(*) FROM pings WHERE week_bucket = $1", ["2026-18"]);
// → TypeError: Cannot read properties of undefined (reading 'name')
//   at /app/node_modules/pg-pool/index.js:45:11
```
**Observed**: any SELECT that passes parameters via the extended-query
protocol returns a malformed RowDescription (missing `name` field on a
column descriptor), crashing node-pg's parser. INSERT with parameters
works because no rows are returned.
**Expected**: parameterised SELECT is the default path for every PG
client (node-pg, psycopg, JDBC, asyncpg). This affects far more than
TypeORM — any prepared-statement code-path is broken.

## Bug 9 — `COUNT(DISTINCT col) WHERE x = $1` returns 0

**Severity**: probably the same root as Bug #8 (extended protocol)
**Reproducer**: same query as Bug #8 but with literal `WHERE … = '2026-18'`
returns the correct count `1`; with `$1` placeholder it returns `0`. Not a
parser crash this time — silent miscount.

## Bug 10 — Column alias dropped on aggregate expressions

**Severity**: medium (silently breaks any code that reads result columns by alias)
**Reproducer**:
```js
const r = await pool.query("SELECT COUNT(*) AS xyzzy FROM pings");
// r.fields[0].name === 'count', not 'xyzzy'
// r.rows[0]   === { count: '1' }, not { xyzzy: '1' }
```
**Expected**: `AS xyzzy` should rename the column in both the
RowDescription metadata and the JSON shape. PostgreSQL does this; Nano
silently ignores the alias on aggregates.

A constant alias works (`SELECT 42 AS the_answer` → returns
`{the_answer: '42'}`); only aggregate-result columns drop the rename.

## Bug 11 — `SELECT col FROM t` returns the entire row

**Severity**: high (data-shape contract is violated)
**Reproducer**:
```js
const r = await pool.query("SELECT dashboard_version FROM pings");
// returns { week_bucket, hash, dashboard_version, heliosdb_version, received_at } per row
```
**Expected**: column projection should return *only* the listed columns.
Returning the whole row triples-or-more the wire payload and breaks any
code that doesn't pre-allowlist its expected fields.

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
| 7 | Multi-statement queries rejected | low | no |
| 8 | Parameterised SELECT crashes node-pg | **blocker** | yes (every prepared-statement client) |
| 9 | `COUNT(DISTINCT) WHERE = $1` returns 0 | high | yes (silent miscount) |
| 10 | Column alias dropped on aggregates | medium | breaks alias-by-key result reading |
| 11 | `SELECT col FROM t` returns all columns | high | data-shape contract violated |

Bugs 7–11 were uncovered while building the (much simpler) telemetry
receiver against HeliosDB-Nano. The receiver lives at
[`~/telemetry/`](../../telemetry) and runs in production today —
documenting that even a small, hand-rolled SQL workload trips multiple
protocol-level issues, and that the dashboard's TypeORM bootstrap
(Bug #4) is the tip of the iceberg.

## Path forward

The dashboard's `docker-compose.yml` retains the HeliosDB service definition under a `heliosdb` profile so a single `docker compose --profile heliosdb up -d heliosdb` brings it back up for retesting. When the upstream blockers above are fixed (especially #4), the swap is one `DB_HOST` flip plus rerunning the schema migration — TypeORM does the rest.

Until then, the recommended-and-default tier reverts to `postgres:15-alpine`, which the README, install guide, and migration plan have been updated to reflect.
