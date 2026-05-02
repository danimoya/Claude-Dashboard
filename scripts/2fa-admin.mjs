#!/usr/bin/env node
/**
 * 2FA admin utility — runs INSIDE the claude-dashboard container.
 *
 * Usage (container):
 *   node /app/scripts/2fa-admin.mjs status   <username>
 *   node /app/scripts/2fa-admin.mjs disable  <username>
 *   node /app/scripts/2fa-admin.mjs reset    <username>   # alias of disable
 *
 * Usage (host wrapper): ~/scripts/2fa-admin.sh <cmd> <username>
 *
 * Talks to Postgres directly via DB_* env vars (already set in the container).
 * Avoids loading the full TypeORM / Express bootstrap so it's fast and safe.
 */

import pg from 'pg';

const { DB_HOST, DB_PORT = '5432', DB_USER, DB_PASSWORD, DB_NAME } = process.env;

if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  console.error('FATAL: DB_* env vars not set. Run inside the dashboard container.');
  process.exit(2);
}

const [, , cmd, username] = process.argv;

if (!cmd || !username) {
  console.error('Usage: node 2fa-admin.mjs <status|disable|reset> <username>');
  process.exit(2);
}

const pool = new pg.Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
});

try {
  const { rows } = await pool.query(
    'SELECT id, username, "twofaEnabled" FROM users WHERE username = $1',
    [username]
  );
  if (rows.length === 0) {
    console.error(`No user named "${username}"`);
    process.exit(1);
  }
  const user = rows[0];

  if (cmd === 'status') {
    console.log(JSON.stringify({ username: user.username, enabled: !!user.twofaEnabled }, null, 2));
  } else if (cmd === 'disable' || cmd === 'reset') {
    await pool.query(
      'UPDATE users SET "twofaEnabled" = false, "twofaSecret" = NULL, "twofaBackupCodes" = NULL WHERE id = $1',
      [user.id]
    );
    console.log(`OK — 2FA cleared for "${username}". They can re-enroll from /settings.`);
  } else {
    console.error(`Unknown command: ${cmd}`);
    process.exit(2);
  }
} catch (err) {
  console.error('FAILED:', err?.message || err);
  process.exit(1);
} finally {
  await pool.end();
}
