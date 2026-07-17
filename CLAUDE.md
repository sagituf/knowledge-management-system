# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A knowledge system: upload text/image files, Claude generates searchable metadata
(description/tags/keywords) on upload, and keyword search runs over that metadata.
Single full-stack container — an Express (TypeScript) server exposes a JSON API
under `/api` and also serves the built React/Vite client. Design and plan live in
`docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Commands

Run from `server/` or `client/` as noted. There is no root-level package.json.

```bash
# Dev (two processes): Vite dev server proxies /api -> localhost:3000
cd server && npm install && npm run dev      # backend on :3000 (tsx watch)
cd client && npm install && npm run dev      # frontend on :5173

# Production-style single process (server serves the built client):
cd client && npm run build                   # produces client/dist
cd server && npm start                        # serves API + client/dist on :3000

# Tests (the only test suite — the pure search module):
cd server && node --test src/search.test.ts   # runs this one file
# Node >=24 strips TypeScript types natively; no flag needed.

# Type-check (no emit):
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit

# Docker (single container):
docker build -t kms .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-... -v kms-data:/data kms
```

Config via env (see `.env.example`; real values go in `server/.env`, git-ignored):
`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-5`), `PORT` (3000),
`DATA_DIR` (default `./data`).

## Architecture & non-obvious constraints

**Storage is the built-in `node:sqlite` module — never add `better-sqlite3` or any
native module.** `node:sqlite` (`DatabaseSync`) is unflagged only on Node >=24;
Node 22 needs `--experimental-sqlite`. The Docker image therefore pins
`node:24-slim` — do not downgrade it. All persistent state lives under `DATA_DIR`
(`knowledge.db` + `uploads/`); that directory is the container volume mount point,
so never write app state anywhere else.

**Module-load ordering:** `db.ts` opens the database at import time, which runs
*before* `index.ts`'s body. So `db.ts` creates the data directory itself
(`fs.mkdirSync(path.dirname(config.dbPath))`) — without that, a fresh/empty
`DATA_DIR` crashes on startup with "unable to open database file". Keep it.

**Upload data flow** (`routes.ts` `POST /api/assets`): classify mime into
`image`/`text` → write file to `uploads/` → call `ai.ts` → insert via `db.ts`.
`ai.ts` (`generateImageMetadata` / `generateTextMetadata`) calls Claude with
`output_config.format` (json_schema) and **degrades gracefully**: on any error, a
refusal, or a missing API key it returns empty metadata rather than throwing, and
`aiGenerated` is derived from whether metadata came back. This is a deliberate
requirement — uploads must succeed without a key. `ai.ts` also casts the request
params because the installed `@anthropic-ai/sdk` types don't yet include
`output_config`; keep `output_config` in the runtime request.

**Search** (`search.ts`) is pure and I/O-free (hence the only unit-tested module).
Semantics: **AND** — every whitespace token in the query must appear (case-
insensitive substring) across `description + tags + keywords + extracted_text +
original_name`; results are ranked by total occurrences. Changing to OR would
re-introduce false positives (e.g. "black hair" matching a "hair"-only asset).

**Data shape must stay in sync across the boundary:** the `Asset` interface is
defined twice — `server/src/types.ts` and `client/src/api.ts` — and the server
serializes `tags`/`keywords` as JSON arrays. Change both when the shape changes.

**ESM + explicit extensions:** everything is ESM (`"type": "module"`); imports use
explicit `.ts`/`.tsx` extensions (required by Node type-stripping / tsx / Vite),
so both tsconfigs set `allowImportingTsExtensions` + `noEmit`. Use `import.meta.url`
for paths, never `__dirname`.

**Serving/routing:** `index.ts` mounts the `/api` router, returns JSON 404 for
unknown `/api/*` paths, then (if `client/dist` exists) serves static assets with a
pattern-less SPA fallback. All AI access goes through `@anthropic-ai/sdk` (never
raw fetch); default model `claude-sonnet-5`.
