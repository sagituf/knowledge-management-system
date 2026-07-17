# Knowledge Management System — Design

**Date:** 2026-07-17
**Context:** Junior home assignment. Build a knowledge system for collecting and
looking up text files and images, using an AI service to generate searchable
metadata on upload. Judged on engineering approach, not production readiness.
~5h effort. Auth, authorization, scalability, and production-grade security are
explicitly out of scope.

## Goals (from the assignment)

1. **File upload** — upload text or image files; uploaded assets are viewable in
   the system.
2. **Smart search** — search assets by their properties. Examples that must work:
   - "black hair" → images containing black hair, or text files that include or
     reference the text.
   - "document" → images that contain documents, plus text files containing or
     referencing the term.
3. **AI-generated metadata** — on upload, an AI service generates searchable
   metadata (description, tags, keywords). Metadata is stored and powers search.
4. **Production system** — uploaded to git, deployed online as a containerized
   application.

## Non-goals

Authentication, authorization, multi-user, scalability, and production-grade
security. No semantic/vector search (keyword matching over AI metadata is
sufficient for the assignment's examples).

## Architecture

Single full-stack container, Node/TypeScript.

- **Backend:** Express (TypeScript, run via `tsx` — no separate build step).
  Exposes a JSON API and serves the built frontend as static files.
- **Frontend:** React + Vite + TypeScript, built to static assets served by
  Express.
- **Storage:** Node's **built-in `node:sqlite`** module (`DatabaseSync`) — no
  native module to compile, which matters on Node 26 where prebuilt native
  binaries may be unavailable. DB file at `data/knowledge.db`; uploaded files
  under `data/uploads/`. The entire `data/` directory is the persistence unit
  and the container volume mount point.
- **AI:** `@anthropic-ai/sdk`, Claude `claude-opus-4-8` with vision. Model is
  configurable via the `ANTHROPIC_MODEL` env var.

Rationale for single container: simplest artifact to build, run locally, and
deploy within the time budget; the assignment wants one containerized app.

## Data model

`assets` table:

| column          | type    | notes                                    |
|-----------------|---------|------------------------------------------|
| id              | TEXT PK | nanoid                                    |
| kind            | TEXT    | `image` \| `text`                         |
| original_name   | TEXT    | name the user uploaded                    |
| stored_name     | TEXT    | filename on disk under `data/uploads/`    |
| mime_type       | TEXT    |                                           |
| size_bytes      | INTEGER |                                           |
| created_at      | TEXT    | ISO 8601                                  |
| description     | TEXT    | AI-generated                              |
| tags            | TEXT    | JSON array of strings                     |
| keywords        | TEXT    | JSON array of strings                     |
| extracted_text  | TEXT    | full text for text files; empty for images|
| ai_generated    | INTEGER | 1 if AI produced metadata, else 0         |

## Components (units, each with one purpose)

- `db.ts` — opens `node:sqlite`, creates the schema, and exposes typed insert /
  list / get / search functions. Owns all SQL. Consumers never write SQL.
- `ai.ts` — given a file (image bytes or text content), calls Claude and returns
  `{ description, tags, keywords }`. Owns all Anthropic SDK usage and the
  prompts. Degrades gracefully: on any failure returns empty metadata and the
  caller marks `ai_generated=false`.
- `search.ts` — tokenizes a query and ranks assets by term matches across
  `description + tags + keywords + extracted_text + original_name`. Pure,
  testable, no I/O.
- `routes.ts` — Express routes; wires uploads (multer) → storage → `ai.ts` →
  `db.ts`, and read/search/serve endpoints. No business logic beyond wiring.
- `index.ts` — app bootstrap: config, static serving of the client build, mounts
  routes, starts the server.
- Frontend: `App.tsx` (layout + state), `UploadPanel`, `SearchBar`, `Gallery`,
  `AssetDetail`, `api.ts` (typed fetch wrapper).

## Upload flow

1. `POST /api/assets` (multipart) receives a file. Accept common image types
   (png, jpg, gif, webp) and text types (`text/*`, e.g. `.txt`, `.md`).
2. Save the file to `data/uploads/<stored_name>`.
3. Generate metadata via `ai.ts`:
   - **Image:** base64-encode → Claude vision → structured JSON
     `{description, tags, keywords}`. Prompt instructs the model to note objects,
     any documents or visible text in the image, colors, and people attributes
     (e.g. hair color) so queries like "black hair" and "document" match.
   - **Text:** read file content → Claude → `{description, tags, keywords}`. The
     raw text is stored as `extracted_text` and is also searchable.
4. Insert the row and return the created asset.
5. **Graceful degradation:** if the AI call fails, the asset is still stored with
   `ai_generated=false` and empty metadata; upload never hard-fails.

Structured JSON from Claude is obtained via `output_config.format` (json_schema)
for reliable parsing.

## Search

`GET /api/assets/search?q=...`. Tokenize the query on whitespace; for each token,
case-insensitively match against a per-asset searchable blob (`description`,
`tags`, `keywords`, `extracted_text`, `original_name`). Score = number of tokens
matched (with a small bonus for multiple occurrences); return assets with score
> 0, ranked descending. This directly satisfies both assignment examples.

## API

| method | path                    | purpose                              |
|--------|-------------------------|--------------------------------------|
| POST   | `/api/assets`           | upload a file (multipart)            |
| GET    | `/api/assets`           | list all assets (gallery)            |
| GET    | `/api/assets/search?q=` | ranked search results                |
| GET    | `/api/assets/:id`       | single asset + metadata              |
| GET    | `/api/assets/:id/raw`   | serve the file bytes (image/text)    |
| GET    | `/api/health`           | health + whether AI is configured    |

## UI

- **Gallery grid** of all assets: image thumbnails, text files as cards showing
  name + description snippet.
- **Search bar** filters the gallery via the search endpoint.
- **Upload panel** (file picker/drag-drop) with progress/result feedback.
- **Detail view** (modal or route): full image or text content, plus the AI
  description, tags, and keywords.

## Error handling

- Upload of an unsupported type → 400 with a clear message.
- AI failure → asset stored with `ai_generated=false` (surfaced subtly in the UI).
- Missing/invalid `ANTHROPIC_API_KEY` → `/api/health` reports AI unavailable;
  uploads still succeed (metadata empty) so the app is demoable without a key.

## Testing / verification

- `search.ts` is pure and unit-testable against sample assets, including the two
  assignment example queries.
- End-to-end manual verification: upload one image + one text file, confirm
  metadata is generated, confirm both example-style searches return them, confirm
  the detail view renders.

## Deployment

- Multi-stage Dockerfile: stage 1 builds the client (`vite build`); stage 2 is a
  slim Node runtime that runs the server (`tsx`) and serves the client build.
- Config via env: `ANTHROPIC_API_KEY` (secret), `ANTHROPIC_MODEL` (optional),
  `PORT`, `DATA_DIR`.
- Persistence: mount a volume at `data/`. On volume-supporting hosts
  (Render / Railway / Fly.io) data survives redeploys; on serverless hosts
  (Cloud Run) storage is ephemeral — acceptable for a demo. Host chosen later;
  code is host-agnostic.
- `README.md` documents setup, the API, and — per the assignment — the AI tools
  used during development.

## Open item

- **Deployment host** — decided after the app runs locally. Does not affect the
  code.
