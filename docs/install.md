# Bootstrap a fresh server

The dashboard exposes a shell of your machine to the internet. **This stack is HTTPS-only by design** — every byte must traverse a TLS terminator before reaching the app. Skip this step and you are publishing your tmux sessions, your Claude-B inbox, your project workspace, and (without 2FA) the API keys you keep in `/settings`. Plaintext is not an option.

This document gives you two paths to get there: the **AI-driven** path (paste the prompt below into Claude Code or Codex and let the agent provision the box) and the **manual** path (the agent's recipe, written out step by step).

Either way, the end state is the same:

- **Docker** + **docker compose** for runtime.
- **Nginx Proxy Manager (NPM)** at `:81` admin / `:80` + `:443` public, doing automatic Let's Encrypt SSL with HTTP-01.
- **HeliosDB-Nano** as the dashboard's data tier (one binary, encrypted at rest, no separate Redis). See [heliosdb-migration.md](./heliosdb-migration.md) for the rationale.
- **Claude-Dashboard** running behind NPM with the `*.yourdomain.tld` subdomain proxied over HTTPS.

A reasonable target: a fresh Debian/Ubuntu LTS VM with sudo, ports 80/443 open to the world, port 81 open to your management IP only, and a domain you control with an A record pointing at the box.

---

## Path A — Hand the prompt to an agent

Paste the following into a Claude Code or Codex session running on the target machine (e.g., over SSH). The prompt is self-contained: the agent can run sudo commands, edit files, and verify each step before moving on.

````markdown
## Goal

Provision this freshly-cloned Claude-Dashboard repository on this host, end-to-end, so the dashboard runs at `https://<DOMAIN>/` over Let's Encrypt SSL with no plaintext fallback. The data tier is HeliosDB-Nano (single encrypted binary). Treat this box as internet-facing — anything you do here is a public-attack surface.

## Inputs you must collect from the user before doing anything

- `DOMAIN`: the FQDN that will resolve to this server (e.g. `dashboard.example.com`).
- `ADMIN_EMAIL`: where Let's Encrypt sends expiry warnings.
- `NPM_ADMIN_EMAIL` and an initial `NPM_ADMIN_PASSWORD` (at least 16 chars, generated, not reused).
- `DB_PASSWORD`: 24+ random chars, used by the dashboard to authenticate against HeliosDB.
- `HELIOSDB_ENCRYPTION_KEY`: 32 random bytes, base64-encoded. Will encrypt all on-disk data.
- `JWT_SECRET` and `JWT_REFRESH_SECRET`: 64 random bytes each, base64. Sign access + refresh tokens.

If the user has not yet pointed the DNS A record at this server's public IPv4 (and ideally AAAA at IPv6), stop and ask them to do that first. SSL issuance via HTTP-01 fails silently when DNS is wrong, and debugging that costs more than waiting five minutes for propagation.

## Steps

### 1. Verify the runtime

- Linux x86_64 or arm64. (`uname -m`)
- 2 GB RAM minimum, 10 GB free disk.
- Outbound HTTPS works (`curl -sSI https://acme-v02.api.letsencrypt.org/directory`).
- Ports 80 and 443 are reachable from the internet; port 81 is **not** (or is gated by firewall).

### 2. Install Docker

Use the upstream `get.docker.com` script. Add the invoking user to the `docker` group, log out + back in, and confirm `docker run hello-world` works without sudo.

### 3. Stand up NPM with auto-SSL

Create `/opt/npm/docker-compose.yml`:

```yaml
services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    container_name: npm
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "127.0.0.1:81:81"   # admin UI bound to loopback only
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    networks:
      - management-network

networks:
  management-network:
    external: true
```

Create the network (`docker network create management-network`), bring NPM up, log into `http://127.0.0.1:81` from an SSH tunnel (`ssh -L 81:127.0.0.1:81 …`), set the admin email + password from the inputs, and **delete the default admin account**.

### 4. Stand up HeliosDB-Nano

Create `/opt/heliosdb/docker-compose.yml`:

```yaml
services:
  heliosdb:
    image: heliosdb/nano:latest
    container_name: heliosdb
    restart: unless-stopped
    command:
      - start
      - --data-dir=/var/lib/heliosdb
      - --auth=scram-sha-256
      - --password=${DB_PASSWORD}
      - --features=encryption
      - --tls-cert=/certs/cert.pem
      - --tls-key=/certs/key.pem
      - --port=5432
    environment:
      HELIOSDB_ENCRYPTION_KEY: ${HELIOSDB_ENCRYPTION_KEY}
    volumes:
      - heliosdb_data:/var/lib/heliosdb
      - /opt/heliosdb/certs:/certs:ro
    networks:
      - management-network

volumes:
  heliosdb_data:

networks:
  management-network:
    external: true
```

The `certs/` directory should contain a private CA-signed certificate for *intra-network* TLS — the public-facing TLS terminates at NPM. Self-signed is fine here since only the dashboard container connects.

Optional but recommended: install the [`heliosdb-codekb-mcp`](https://crates.io/crates/heliosdb-codekb-mcp) MCP server on the host and register it with Claude Code's settings. It indexes this repository against the same HeliosDB engine and lets Claude/Codex answer "where is X defined?" with a 200-byte tool result instead of a 50 KB file dump.

### 5. Configure the dashboard's `.env`

In the cloned `Claude-DashBoard` directory:

- `cp .env.example .env` (create one if absent).
- Set `DB_HOST=heliosdb`, `DB_PORT=5432`, `DB_USER=claude`, `DB_PASSWORD=…`, `DB_NAME=claude_dashboard`.
- Leave Redis-related variables empty (the migration to HeliosDB removes them; if the legacy Bull code path is still present, run pg-boss instead — see `docs/heliosdb-migration.md`).
- Set `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `CB_API_URL` (`http://host.docker.internal:3847` if Claude-B runs on the host).

### 6. Bring up the dashboard

`docker compose up -d --build` from the repo root. Verify:

- `docker logs claude-dashboard --tail 30` shows "Server running on port 5000".
- `docker exec claude-dashboard tmux -V` confirms tmux is installed (the container needs it to attach to host sessions).

### 7. Wire NPM → dashboard over HTTPS

In NPM:

- Add a Proxy Host: domain `<DOMAIN>`, scheme `http`, forward host `claude-dashboard`, forward port `80`, **block common exploits ON**, **websockets support ON**.
- Under SSL: request a new Let's Encrypt cert, force-SSL ON, HSTS ON, **HTTP/2 support ON**. Email = `ADMIN_EMAIL`.
- Issue. Let's Encrypt's HTTP-01 challenge runs through NPM's :80 listener.

### 8. Lock the box down

- `ufw allow 22/tcp`, `ufw allow 80/tcp`, `ufw allow 443/tcp`, `ufw deny 81`, `ufw enable`.
- Confirm `/settings` requires login and (after first user enrolls) a TOTP code.
- Run a quick external check: `curl -sSI http://<DOMAIN>/` should 301-redirect to HTTPS. `curl -sSI https://<DOMAIN>/` should be `200` with `strict-transport-security` set.

### 9. Hand off

Give the user:
- The `<DOMAIN>` URL.
- The location of secrets (`.env`, `~/.npm-credentials`).
- The recovery command for 2FA: `./scripts/2fa-admin.sh disable <username>`.
- A reminder that the NPM admin port (81) is **not** internet-exposed — they must use an SSH tunnel.

Stop and report. Do not enable extra features (voice, scheduler) without explicit user instruction.
````

That prompt fits inside a single agent turn. Provide it the inputs in the first message and it will run end-to-end, asking for confirmation before any destructive step.

---

## Path B — Do it yourself

The same steps, condensed, for operators who'd rather drive.

### 1. Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER" && newgrp docker
docker run --rm hello-world
```

### 2. Network

```bash
docker network create management-network
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw deny 81
sudo ufw enable
```

### 3. NPM (Nginx Proxy Manager)

Drop the compose file from step 3 above into `/opt/npm/`, then `docker compose -f /opt/npm/docker-compose.yml up -d`. Tunnel to admin:

```bash
ssh -L 81:127.0.0.1:81 user@server
# browse http://127.0.0.1:81 — change default admin, set strong pw.
```

### 4. HeliosDB-Nano

Drop the compose file from step 4. Generate keys:

```bash
openssl rand -base64 32 > /opt/heliosdb/.encryption_key      # 32 bytes
chmod 600 /opt/heliosdb/.encryption_key
# self-signed intra-network cert
openssl req -x509 -nodes -days 3650 -newkey rsa:4096 \
  -keyout /opt/heliosdb/certs/key.pem \
  -out   /opt/heliosdb/certs/cert.pem \
  -subj "/CN=heliosdb"
```

Bring it up. The on-disk data is now AES-256-GCM-sealed; a stolen volume snapshot is unreadable without the key.

### 5. Dashboard

```bash
cd Claude-DashBoard
cp .env.example .env
# Fill DB_*, JWT_*, CB_API_URL, etc.
docker compose up -d --build
docker logs claude-dashboard --tail 30
```

### 6. Proxy host

In NPM, create a proxy host pointing `<DOMAIN>` → `claude-dashboard:80`, request a Let's Encrypt cert with **Force SSL** + **HSTS** + **HTTP/2** enabled, and verify in a browser.

### 7. Verification checklist

- `curl -I http://<DOMAIN>/` → `301 Moved Permanently` to `https://`.
- `curl -I https://<DOMAIN>/` → `200`, `strict-transport-security` header present.
- `https://<DOMAIN>/cli` lists your tmux sessions (after login).
- First user registers, then enrols 2FA from `/settings`. Backup codes saved offline.

If anything in this list fails, do **not** open the firewall further. The dashboard works behind a closed front door or it doesn't work at all.

## What you've got

- One TLS terminator (NPM) with auto-renewing certs.
- One encrypted data tier (HeliosDB-Nano, AES-256-GCM at rest, SCRAM-SHA-256 + TLS on the wire).
- One reverse-proxied app, with 2FA on the settings panel and live tmux pane streaming over WSS.
- Optional: HeliosDB CodeKB MCP indexing this repository for in-tmux LLM agents — same database, lower token bill.

For day-2 operations (logs, backups, secret rotation, emergency 2FA reset), see [deployment.md](./deployment.md). For the rationale behind the data tier, see [heliosdb-migration.md](./heliosdb-migration.md).
