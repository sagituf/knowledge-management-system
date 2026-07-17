# Knowledge Management System

Upload text files and images; the system uses Claude to generate searchable
metadata (description, tags, keywords) on upload, and supports keyword search
over that metadata.

## Features

- Upload text or image files
- On upload, Claude (vision) generates a description, tags, and keywords
- Keyword search over generated metadata + text content
  - e.g. "black hair" finds matching images and text; "document" finds images
    containing documents and text files mentioning the term
- Gallery + detail view of all assets

## Tech stack

- Backend: Node.js + TypeScript + Express, run via `tsx`
- Storage: built-in `node:sqlite` (metadata) + local disk (files), under `DATA_DIR`
- AI: Anthropic Claude (`claude-sonnet-5` by default) via `@anthropic-ai/sdk`
- Frontend: React + Vite + TypeScript
- Packaging: single Docker container

## Configuration

Set via environment (see `.env.example`):

| Variable            | Default            | Purpose                                  |
|---------------------|--------------------|------------------------------------------|
| `ANTHROPIC_API_KEY` | (none)             | Enables AI metadata. Without it, uploads still work but metadata is empty. |
| `ANTHROPIC_MODEL`   | `claude-sonnet-5`  | Claude model used for metadata           |
| `PORT`              | `3000`             | HTTP port                                |
| `DATA_DIR`          | `./data`           | Where the DB and uploads are stored      |

Without an API key the app still runs and is fully browsable — uploads simply
store the file with empty metadata (`aiGenerated: false`), and search falls back
to matching filenames and (for text files) the file contents.

## Run locally (dev)

Two processes — the Vite dev server proxies `/api` to the backend.

```bash
# terminal 1 — backend
cd server && npm install && ANTHROPIC_API_KEY=sk-... npm run dev

# terminal 2 — frontend
cd client && npm install && npm run dev
# open http://localhost:5173
```

## Run locally (production-style, single process)

The server serves the built frontend, so one process handles everything.

```bash
cd client && npm install && npm run build   # produces client/dist
cd ../server && npm install && ANTHROPIC_API_KEY=sk-... npm start
# open http://localhost:3000
```

## Run with Docker

```bash
docker build -t kms .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-... -v kms-data:/data kms
# open http://localhost:3000
```

Data (SQLite DB + uploaded files) persists in the `kms-data` volume, so it
survives container restarts and redeploys.

## API

| Method | Path                    | Purpose                           |
|--------|-------------------------|-----------------------------------|
| POST   | `/api/assets`           | Upload a file (multipart `file`)  |
| GET    | `/api/assets`           | List all assets                   |
| GET    | `/api/assets/search?q=` | Keyword search                    |
| GET    | `/api/assets/:id`       | Single asset + metadata           |
| GET    | `/api/assets/:id/raw`   | Serve the file bytes              |
| GET    | `/api/health`           | Health + whether AI is configured |

## How search works

On upload, Claude produces a `description`, `tags`, and `keywords` for each
asset (for text files, the raw text is stored too). Search tokenizes the query
and ranks assets by how many query terms appear across
`description + tags + keywords + extracted_text + original_name`
(case-insensitive), so a query like `black hair` surfaces an image Claude
described as containing black hair, and `document` surfaces both an image of a
document and a text file that mentions the word.

## Tests

The search ranking is pure and unit-tested:

```bash
cd server && node --test src/search.test.ts
```

## AI tools used during development

- **Claude (Anthropic)** — used at runtime to generate asset metadata
  (`claude-sonnet-5` with vision), and used via **Claude Code** as a development
  assistant to design, plan, and implement this project.
