# Repository Update Guide

Use this checklist when changing and redeploying Claude Dashboard. The goal is
to keep updates scoped, reproducible, and easy to roll back.

## 1. Start From A Known State

```bash
git status -sb
git fetch origin main
git checkout -b codex/<short-description>
```

- Do not work over unrelated local changes. If the tree is mixed, stage only
  the files that belong to the update.
- Do not commit `.env`, generated logs, database dumps, or local build output.
- Keep secrets in environment variables or the deployment host, never in git.

## 2. Make The Change

- Follow the existing workspace layout: `frontend/`, `backend/`, `shared/`,
  `docs/`, `scripts/`, and `infrastructure/`.
- Prefer existing hooks, services, routes, and component patterns before adding
  new abstractions.
- Keep deploy-facing changes compatible with the single container in
  `docker-compose.yml`: nginx serves the frontend and proxies API/Socket.IO to
  the Node backend on port `5000`.
- For tmux work, remember the app talks to the host socket mounted at
  `/tmp/tmux-1001/default` and usually drops to `TMUX_HOST_UID`.

## 3. Run Focused Checks

Run the checks that match the files changed. Useful defaults:

```bash
npm run build --workspace=shared
npm run build --workspace=backend
cd frontend && npx vite build
```

When frontend type-level behavior changes, also run:

```bash
npm run build --workspace=frontend
```

If a check fails because of pre-existing issues, record the exact failure in
the commit or PR notes and still run the closest deploy-equivalent check. Do
not hide new failures.

## 4. Rebuild And Deploy The App Container

For the production Docker stack:

```bash
docker compose up -d --build app
docker ps --filter name=claude-dashboard --format '{{.Names}}\t{{.Status}}'
docker exec claude-dashboard sh -c 'tail -80 /tmp/backend.log'
```

This rebuilds only the app image and leaves Postgres/Redis data volumes in
place.

## 5. Smoke Test The Running Instance

At minimum, verify the API and the feature you changed:

```bash
curl -fsS https://<domain>/api/v1/setup/status
```

For tmux or Socket.IO work, also verify:

- the browser can list `/sessions`;
- at least one tmux pane renders output;
- pane streaming still works when websocket upgrade succeeds;
- pane streaming has an acceptable fallback when websocket upgrade is blocked.

For deployment config changes, check the reverse proxy still forwards:

- `/api/` to the backend;
- `/socket.io/` with upgrade headers;
- SPA routes back to `index.html`.

## 6. Commit And Publish

```bash
git status -sb
git diff --check
git add <explicit files>
git commit -m "<short imperative summary>"
git push -u origin "$(git branch --show-current)"
```

Open a pull request for review unless the operator explicitly asked for a
direct push to a protected release branch. In the PR or handoff note, include:

- what changed;
- why it changed;
- checks run;
- deployment or rollback notes;
- any known unrelated check failures.

## 7. Rollback

If a deployment misbehaves:

```bash
git revert <commit>
docker compose up -d --build app
docker exec claude-dashboard sh -c 'tail -80 /tmp/backend.log'
```

If the container itself fails to start, inspect `docker logs claude-dashboard`
and rebuild from the last known good commit.
