# Knowledge Management System Implementation Plan

**Goal:** Build a containerized knowledge system that stores uploaded text/image files, uses Claude to generate searchable metadata on upload, and supports keyword search over that metadata.

**Architecture:** Single full-stack Node/TypeScript container. Express serves a JSON API and the built React/Vite frontend. Metadata lives in a built-in `node:sqlite` database; uploaded files live on disk. On upload, Claude (vision) generates a description, tags, and keywords that power keyword search.

**Tech Stack:** Node 26, TypeScript, Express, `node:sqlite` (built-in), multer, `@anthropic-ai/sdk` (Claude `claude-sonnet-5`), React, Vite, Docker.

## Global Constraints

- **Runtime:** Node.js ≥ 22 (uses built-in `node:sqlite`); developed on Node 26. Server runs via `tsx` (no compile step).
- **No native modules.** Do not add `better-sqlite3` or any package needing node-gyp. Persistence is the built-in `node:sqlite` `DatabaseSync`.
- **AI model:** default `claude-sonnet-5`, overridable via `ANTHROPIC_MODEL`. All Anthropic access goes through `@anthropic-ai/sdk` (never raw fetch).
- **Structured AI output:** use `output_config.format` (json_schema) so metadata parses reliably.
- **Graceful degradation:** if the AI call fails or no API key is set, uploads still succeed with empty metadata and `ai_generated=false`. The app must be demoable without a key.
- **All persistent state under `DATA_DIR`** (default `./data`): `knowledge.db` + `uploads/`. This dir is the container volume mount point; never write state elsewhere.
- **Config via env:** `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `PORT` (default 3000), `DATA_DIR` (default `./data`).
- **Out of scope:** auth, authorization, multi-user, rate limiting, production security.
- **ESM everywhere** (`"type": "module"`); use `import.meta.url` for paths, never `__dirname`.

---

## File Structure

```
knowledge-management-system/
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── types.ts          # shared types: Asset, GeneratedMetadata
│       ├── config.ts         # env-derived config (paths, port, model, key presence)
│       ├── db.ts             # node:sqlite open + schema + insert/list/get
│       ├── search.ts         # pure query-token ranking over assets
│       ├── ai.ts             # Claude metadata generation (image/text)
│       ├── routes.ts         # Express router: upload/list/search/get/raw/health
│       └── index.ts          # bootstrap: config, static client, routes, listen
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api.ts            # typed fetch wrapper + Asset type
│       ├── styles.css
│       └── components/
│           ├── UploadPanel.tsx
│           ├── SearchBar.tsx
│           ├── Gallery.tsx
│           └── AssetDetail.tsx
├── Dockerfile
├── .dockerignore
├── .env.example
└── README.md
```

Search logic (`search.ts`) is deliberately pure and I/O-free so it is unit-tested directly. Everything else is verified by an end-to-end manual run described in the final task.

---

## Task 1: Server scaffold + config + health endpoint

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/src/config.ts`, `server/src/index.ts`, `.env.example`

**Interfaces:**
- Produces: `config` object `{ port: number; dataDir: string; uploadsDir: string; dbPath: string; model: string; hasApiKey: boolean }` from `config.ts`.
- Produces: Express app listening on `config.port` with `GET /api/health` → `{ status: "ok", ai: boolean }`.

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "knowledge-management-system-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.68.0",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "multer": "^1.4.5-lts.1",
    "nanoid": "^5.0.9"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.10.5",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create `server/src/config.ts`**

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const here = path.dirname(fileURLToPath(import.meta.url));
// project root = server/ (src/..)
const serverRoot = path.resolve(here, "..");

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(serverRoot, "..", "data");

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dataDir,
  uploadsDir: path.join(dataDir, "uploads"),
  dbPath: path.join(dataDir, "knowledge.db"),
  model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
  hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
};
```

- [ ] **Step 4: Create `.env.example`**

```
ANTHROPIC_API_KEY=your-key-here
ANTHROPIC_MODEL=claude-sonnet-5
PORT=3000
DATA_DIR=./data
```

- [ ] **Step 5: Create `server/src/index.ts` (health only for now)**

```ts
import fs from "node:fs";
import express from "express";
import { config } from "./config.ts";

fs.mkdirSync(config.uploadsDir, { recursive: true });

const app = express();

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ai: config.hasApiKey });
});

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
```

- [ ] **Step 6: Install deps and run**

Run: `cd server && npm install`
Expected: installs with no node-gyp/native build errors.

- [ ] **Step 7: Verify health endpoint**

Run: `cd server && (npm start &) && sleep 2 && curl -s localhost:3000/api/health && echo && kill %1`
Expected: `{"status":"ok","ai":false}` (or `"ai":true` if a key is set), and a `data/uploads` dir now exists.

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/tsconfig.json server/src/config.ts server/src/index.ts .env.example
git commit -m "feat: server scaffold with config and health endpoint"
```

---

## Task 2: Types + database module

**Files:**
- Create: `server/src/types.ts`, `server/src/db.ts`

**Interfaces:**
- Produces `types.ts`:
  ```ts
  export type AssetKind = "image" | "text";
  export interface Asset {
    id: string; kind: AssetKind; originalName: string; storedName: string;
    mimeType: string; sizeBytes: number; createdAt: string;
    description: string; tags: string[]; keywords: string[];
    extractedText: string; aiGenerated: boolean;
  }
  export interface GeneratedMetadata { description: string; tags: string[]; keywords: string[]; }
  ```
- Produces `db.ts`: `insertAsset(asset: Asset): void`, `listAssets(): Asset[]`, `getAsset(id: string): Asset | undefined`. Rows are stored with tags/keywords as JSON strings and `aiGenerated` as 0/1; these functions convert to/from the `Asset` shape so consumers only see `Asset`.

- [ ] **Step 1: Create `server/src/types.ts`**

```ts
export type AssetKind = "image" | "text";

export interface Asset {
  id: string;
  kind: AssetKind;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  description: string;
  tags: string[];
  keywords: string[];
  extractedText: string;
  aiGenerated: boolean;
}

export interface GeneratedMetadata {
  description: string;
  tags: string[];
  keywords: string[];
}
```

- [ ] **Step 2: Create `server/src/db.ts`**

```ts
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import type { Asset } from "./types.ts";

const db = new DatabaseSync(config.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    keywords TEXT NOT NULL DEFAULT '[]',
    extracted_text TEXT NOT NULL DEFAULT '',
    ai_generated INTEGER NOT NULL DEFAULT 0
  );
`);

interface Row {
  id: string; kind: string; original_name: string; stored_name: string;
  mime_type: string; size_bytes: number; created_at: string;
  description: string; tags: string; keywords: string;
  extracted_text: string; ai_generated: number;
}

function rowToAsset(r: Row): Asset {
  return {
    id: r.id,
    kind: r.kind as Asset["kind"],
    originalName: r.original_name,
    storedName: r.stored_name,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
    description: r.description,
    tags: JSON.parse(r.tags),
    keywords: JSON.parse(r.keywords),
    extractedText: r.extracted_text,
    aiGenerated: r.ai_generated === 1,
  };
}

export function insertAsset(a: Asset): void {
  db.prepare(`
    INSERT INTO assets (id, kind, original_name, stored_name, mime_type,
      size_bytes, created_at, description, tags, keywords, extracted_text, ai_generated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    a.id, a.kind, a.originalName, a.storedName, a.mimeType,
    a.sizeBytes, a.createdAt, a.description, JSON.stringify(a.tags),
    JSON.stringify(a.keywords), a.extractedText, a.aiGenerated ? 1 : 0,
  );
}

export function listAssets(): Asset[] {
  const rows = db.prepare(`SELECT * FROM assets ORDER BY created_at DESC`).all() as unknown as Row[];
  return rows.map(rowToAsset);
}

export function getAsset(id: string): Asset | undefined {
  const row = db.prepare(`SELECT * FROM assets WHERE id = ?`).get(id) as unknown as Row | undefined;
  return row ? rowToAsset(row) : undefined;
}
```

- [ ] **Step 3: Smoke-test db round-trip**

Run:
```bash
cd server && node --input-type=module -e "
import { insertAsset, listAssets, getAsset } from './src/db.ts';
" 2>&1 | head -5
```
Note: `node` cannot import `.ts` directly; instead verify via tsx:
```bash
cd server && npx tsx -e "
import { insertAsset, listAssets, getAsset } from './src/db.ts';
insertAsset({ id:'a1', kind:'text', originalName:'n.txt', storedName:'s.txt', mimeType:'text/plain', sizeBytes:1, createdAt:new Date().toISOString(), description:'d', tags:['t'], keywords:['k'], extractedText:'hello', aiGenerated:true });
console.log('get:', getAsset('a1'));
console.log('count:', listAssets().length);
"
```
Expected: prints the asset with `tags:['t']`, `aiGenerated:true`, and `count: 1`. (Creates `data/knowledge.db`.)

- [ ] **Step 4: Reset test db so it doesn't pollute the demo**

Run: `rm -f data/knowledge.db`
Expected: file removed (schema is recreated on next start).

- [ ] **Step 5: Commit**

```bash
git add server/src/types.ts server/src/db.ts
git commit -m "feat: add asset types and node:sqlite database module"
```

---

## Task 3: Search module (pure, unit-tested)

**Files:**
- Create: `server/src/search.ts`, `server/src/search.test.ts`

**Interfaces:**
- Consumes: `Asset` from `types.ts`.
- Produces: `searchAssets(assets: Asset[], query: string): Asset[]` — returns assets whose searchable text matches at least one query token, ranked by descending match score. Empty/whitespace query returns `[]`.

- [ ] **Step 1: Write the failing test `server/src/search.test.ts`**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { searchAssets } from "./search.ts";
import type { Asset } from "./types.ts";

function asset(partial: Partial<Asset>): Asset {
  return {
    id: "x", kind: "image", originalName: "f", storedName: "s",
    mimeType: "image/png", sizeBytes: 1, createdAt: "2026-01-01T00:00:00Z",
    description: "", tags: [], keywords: [], extractedText: "", aiGenerated: true,
    ...partial,
  };
}

test("empty query returns nothing", () => {
  assert.deepEqual(searchAssets([asset({})], "   "), []);
});

test("matches 'black hair' image via description", () => {
  const img = asset({ id: "img", description: "A portrait of a woman with black hair" });
  const other = asset({ id: "other", description: "a sunset over the sea" });
  const results = searchAssets([img, other], "black hair");
  assert.equal(results[0].id, "img");
  assert.equal(results.length, 1);
});

test("matches 'document' in both an image and a text file", () => {
  const img = asset({ id: "img", tags: ["document", "paper"] });
  const txt = asset({ id: "txt", kind: "text", extractedText: "please sign the document" });
  const results = searchAssets([img, txt], "document");
  const ids = results.map((r) => r.id).sort();
  assert.deepEqual(ids, ["img", "txt"]);
});

test("ranks more matches higher", () => {
  const strong = asset({ id: "strong", description: "black cat", keywords: ["cat", "black"] });
  const weak = asset({ id: "weak", description: "a black car" });
  const results = searchAssets([weak, strong], "black cat");
  assert.equal(results[0].id, "strong");
});

test("search is case-insensitive", () => {
  const a = asset({ id: "a", description: "Black Hair" });
  assert.equal(searchAssets([a], "BLACK").length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test --experimental-strip-types src/search.test.ts 2>&1 | tail -20`
Expected: FAIL — cannot find module `./search.ts`.

- [ ] **Step 3: Write `server/src/search.ts`**

```ts
import type { Asset } from "./types.ts";

/** Lowercased blob of every searchable field on an asset. */
function searchableText(a: Asset): string {
  return [
    a.originalName,
    a.description,
    a.tags.join(" "),
    a.keywords.join(" "),
    a.extractedText,
  ]
    .join(" ")
    .toLowerCase();
}

function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

/**
 * Rank assets by how well they match the query.
 * Score = (# distinct tokens that appear) * 10 + (total occurrences).
 * The token-coverage term dominates so an asset matching more of the query
 * always outranks one that merely repeats a single token.
 */
export function searchAssets(assets: Asset[], query: string): Asset[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const scored = assets.map((asset) => {
    const text = searchableText(asset);
    let distinct = 0;
    let occurrences = 0;
    for (const token of tokens) {
      const n = countOccurrences(text, token);
      if (n > 0) distinct += 1;
      occurrences += n;
    }
    return { asset, score: distinct * 10 + occurrences, matched: distinct > 0 };
  });

  return scored
    .filter((s) => s.matched)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.asset);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test --experimental-strip-types src/search.test.ts 2>&1 | tail -20`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/search.ts server/src/search.test.ts
git commit -m "feat: add pure keyword search ranking with tests"
```

---

## Task 4: AI metadata module

**Files:**
- Create: `server/src/ai.ts`

**Interfaces:**
- Consumes: `config` (`model`, `hasApiKey`), `GeneratedMetadata` from `types.ts`.
- Produces: `generateImageMetadata(base64: string, mediaType: string): Promise<GeneratedMetadata>` and `generateTextMetadata(text: string): Promise<GeneratedMetadata>`. Both resolve to `{ description: "", tags: [], keywords: [] }` on any failure or when no API key is configured (never throw).

- [ ] **Step 1: Create `server/src/ai.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.ts";
import type { GeneratedMetadata } from "./types.ts";

const EMPTY: GeneratedMetadata = { description: "", tags: [], keywords: [] };

const client = config.hasApiKey ? new Anthropic() : null;

const METADATA_SCHEMA = {
  type: "object",
  properties: {
    description: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
  },
  required: ["description", "tags", "keywords"],
  additionalProperties: false,
} as const;

const IMAGE_PROMPT =
  "Describe this image for a searchable knowledge base. In `description`, " +
  "write 1-3 sentences covering the main subject, notable objects, any " +
  "documents or visible text, dominant colors, and visible attributes of any " +
  "people (e.g. hair color, clothing). Provide `tags` (broad categories) and " +
  "`keywords` (specific searchable terms) as lowercase arrays.";

const TEXT_PROMPT =
  "Summarize this text file for a searchable knowledge base. In `description`, " +
  "write 1-3 sentences on what it is about. Provide `tags` (broad topics) and " +
  "`keywords` (specific searchable terms) as lowercase arrays. Text follows:\n\n";

async function callClaude(content: Anthropic.MessageParam["content"]): Promise<GeneratedMetadata> {
  if (!client) return EMPTY;
  try {
    const res = await client.messages.create({
      model: config.model,
      max_tokens: 1024,
      output_config: { format: { type: "json_schema", schema: METADATA_SCHEMA } },
      messages: [{ role: "user", content }],
    });
    const textBlock = res.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return EMPTY;
    const parsed = JSON.parse(textBlock.text) as GeneratedMetadata;
    return {
      description: parsed.description ?? "",
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    };
  } catch (err) {
    console.error("AI metadata generation failed:", err);
    return EMPTY;
  }
}

export function generateImageMetadata(base64: string, mediaType: string): Promise<GeneratedMetadata> {
  return callClaude([
    { type: "image", source: { type: "base64", media_type: mediaType as "image/png", data: base64 } },
    { type: "text", text: IMAGE_PROMPT },
  ]);
}

export function generateTextMetadata(text: string): Promise<GeneratedMetadata> {
  // Cap the amount of text sent to keep requests bounded.
  const clipped = text.slice(0, 20000);
  return callClaude(TEXT_PROMPT + clipped);
}
```

- [ ] **Step 2: Type-check the file**

Run: `cd server && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Verify graceful no-key behavior**

Run:
```bash
cd server && ANTHROPIC_API_KEY= npx tsx -e "
import { generateTextMetadata } from './src/ai.ts';
console.log(await generateTextMetadata('hello world'));
"
```
Expected: prints `{ description: '', tags: [], keywords: [] }` (no throw, no network call).

- [ ] **Step 4: Commit**

```bash
git add server/src/ai.ts
git commit -m "feat: add Claude metadata generation with graceful fallback"
```

---

## Task 5: Routes — upload, list, search, get, raw

**Files:**
- Create: `server/src/routes.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `db.ts`, `ai.ts`, `search.ts`, `config`, `types.ts`, `nanoid`, `multer`.
- Produces: `router` (Express Router) mounted at `/api` with `POST /assets`, `GET /assets`, `GET /assets/search`, `GET /assets/:id`, `GET /assets/:id/raw`. Also keeps `GET /health`.

- [ ] **Step 1: Create `server/src/routes.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import express from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { config } from "./config.ts";
import { insertAsset, listAssets, getAsset } from "./db.ts";
import { searchAssets } from "./search.ts";
import { generateImageMetadata, generateTextMetadata } from "./ai.ts";
import type { Asset, AssetKind } from "./types.ts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function classify(mimeType: string): AssetKind | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("text/")) return "text";
  return null;
}

export const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", ai: config.hasApiKey });
});

router.get("/assets", (_req, res) => {
  res.json(listAssets());
});

router.get("/assets/search", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  res.json(searchAssets(listAssets(), q));
});

router.get("/assets/:id", (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) return res.status(404).json({ error: "not found" });
  res.json(asset);
});

router.get("/assets/:id/raw", (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) return res.status(404).json({ error: "not found" });
  const filePath = path.join(config.uploadsDir, asset.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "file missing" });
  res.type(asset.mimeType);
  res.sendFile(filePath);
});

router.post("/assets", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "no file uploaded" });

  const kind = classify(file.mimetype);
  if (!kind) {
    return res.status(400).json({ error: `unsupported file type: ${file.mimetype}` });
  }

  const id = nanoid();
  const ext = path.extname(file.originalname);
  const storedName = `${id}${ext}`;
  fs.writeFileSync(path.join(config.uploadsDir, storedName), file.buffer);

  let metadata = { description: "", tags: [] as string[], keywords: [] as string[] };
  let extractedText = "";
  if (kind === "image") {
    metadata = await generateImageMetadata(file.buffer.toString("base64"), file.mimetype);
  } else {
    extractedText = file.buffer.toString("utf-8");
    metadata = await generateTextMetadata(extractedText);
  }

  const aiGenerated =
    metadata.description !== "" || metadata.tags.length > 0 || metadata.keywords.length > 0;

  const asset: Asset = {
    id,
    kind,
    originalName: file.originalname,
    storedName,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    createdAt: new Date().toISOString(),
    description: metadata.description,
    tags: metadata.tags,
    keywords: metadata.keywords,
    extractedText,
    aiGenerated,
  };
  insertAsset(asset);
  res.status(201).json(asset);
});
```

- [ ] **Step 2: Rewrite `server/src/index.ts` to mount the router and serve the client build**

```ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { config } from "./config.ts";
import { router } from "./routes.ts";

fs.mkdirSync(config.uploadsDir, { recursive: true });

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, "..", "..", "client", "dist");

const app = express();

app.use("/api", router);

// Serve the built frontend if present (production/container).
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
```

- [ ] **Step 3: Type-check**

Run: `cd server && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: End-to-end API test without a key (graceful path)**

Run:
```bash
cd server && rm -f ../data/knowledge.db && (ANTHROPIC_API_KEY= npm start &) && sleep 2 \
  && printf 'the quarterly document mentions black hair dye sales' > /tmp/note.txt \
  && curl -s -F "file=@/tmp/note.txt;type=text/plain" localhost:3000/api/assets \
  && echo "---LIST---" && curl -s localhost:3000/api/assets \
  && echo "---SEARCH document---" && curl -s "localhost:3000/api/assets/search?q=document" \
  && echo && kill %1
```
Expected: upload returns a 201 asset JSON with `aiGenerated:false` and `extractedText` containing the note; list has 1 item; search for `document` returns that asset (matches via `extractedText` even without AI).

- [ ] **Step 5: Reset demo db**

Run: `rm -f data/knowledge.db data/uploads/*`
Expected: clean state.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes.ts server/src/index.ts
git commit -m "feat: add asset routes (upload, list, search, get, raw) and static serving"
```

---

## Task 6: Client scaffold (Vite + React + TS)

**Files:**
- Create: `client/package.json`, `client/tsconfig.json`, `client/tsconfig.node.json`, `client/vite.config.ts`, `client/index.html`, `client/src/main.tsx`, `client/src/App.tsx`, `client/src/styles.css`

**Interfaces:**
- Produces: a Vite dev server on port 5173 proxying `/api` → `http://localhost:3000`, rendering a placeholder `App` that fetches and shows `/api/health`.

- [ ] **Step 1: Create `client/package.json`**

```json
{
  "name": "knowledge-management-system-client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.3",
    "vite": "^6.0.7"
  }
}
```

- [ ] **Step 2: Create `client/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
```

- [ ] **Step 3: Create `client/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `client/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "skipLibCheck": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `client/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Knowledge Management System</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `client/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 7: Create placeholder `client/src/App.tsx`**

```tsx
import { useEffect, useState } from "react";

export default function App() {
  const [ai, setAi] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setAi(d.ai))
      .catch(() => setAi(null));
  }, []);
  return (
    <main>
      <h1>Knowledge Management System</h1>
      <p>AI configured: {ai === null ? "unknown" : String(ai)}</p>
    </main>
  );
}
```

- [ ] **Step 8: Create minimal `client/src/styles.css`**

```css
:root { color-scheme: light dark; font-family: system-ui, sans-serif; }
body { margin: 0; }
main { max-width: 1100px; margin: 0 auto; padding: 24px; }
```

- [ ] **Step 9: Install and verify build**

Run: `cd client && npm install && npm run build`
Expected: `client/dist/index.html` and assets are produced with no errors.

- [ ] **Step 10: Commit**

```bash
git add client/package.json client/vite.config.ts client/tsconfig.json client/tsconfig.node.json client/index.html client/src/main.tsx client/src/App.tsx client/src/styles.css
git commit -m "feat: client scaffold with Vite React TS and health check"
```

---

## Task 7: Client API wrapper + full UI

**Files:**
- Create: `client/src/api.ts`, `client/src/components/UploadPanel.tsx`, `client/src/components/SearchBar.tsx`, `client/src/components/Gallery.tsx`, `client/src/components/AssetDetail.tsx`
- Modify: `client/src/App.tsx`, `client/src/styles.css`

**Interfaces:**
- Produces `api.ts`: `Asset` type (mirrors server), `listAssets(): Promise<Asset[]>`, `searchAssets(q: string): Promise<Asset[]>`, `uploadAsset(file: File): Promise<Asset>`, `rawUrl(id: string): string`.
- Components consume `Asset` and the api functions; `App` composes them.

- [ ] **Step 1: Create `client/src/api.ts`**

```ts
export interface Asset {
  id: string;
  kind: "image" | "text";
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  description: string;
  tags: string[];
  keywords: string[];
  extractedText: string;
  aiGenerated: boolean;
}

export async function listAssets(): Promise<Asset[]> {
  const r = await fetch("/api/assets");
  if (!r.ok) throw new Error("failed to list assets");
  return r.json();
}

export async function searchAssets(q: string): Promise<Asset[]> {
  const r = await fetch(`/api/assets/search?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("search failed");
  return r.json();
}

export async function uploadAsset(file: File): Promise<Asset> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch("/api/assets", { method: "POST", body: form });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? "upload failed");
  }
  return r.json();
}

export function rawUrl(id: string): string {
  return `/api/assets/${id}/raw`;
}
```

- [ ] **Step 2: Create `client/src/components/UploadPanel.tsx`**

```tsx
import { useState } from "react";
import { uploadAsset } from "../api.ts";

export function UploadPanel({ onUploaded }: { onUploaded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadAsset(file);
      }
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="upload-panel">
      <label className="upload-btn">
        {busy ? "Uploading…" : "Upload files"}
        <input
          type="file"
          multiple
          accept="image/*,text/*,.txt,.md"
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
          hidden
        />
      </label>
      <span className="hint">Images or text files</span>
      {error && <span className="error">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 3: Create `client/src/components/SearchBar.tsx`**

```tsx
export function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="search-bar"
      type="search"
      placeholder="Search knowledge… (e.g. black hair, document)"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
```

- [ ] **Step 4: Create `client/src/components/Gallery.tsx`**

```tsx
import type { Asset } from "../api.ts";
import { rawUrl } from "../api.ts";

export function Gallery({ assets, onSelect }: { assets: Asset[]; onSelect: (a: Asset) => void }) {
  if (assets.length === 0) {
    return <p className="empty">No assets yet. Upload an image or text file to get started.</p>;
  }
  return (
    <div className="gallery">
      {assets.map((a) => (
        <button key={a.id} className="card" onClick={() => onSelect(a)}>
          {a.kind === "image" ? (
            <img src={rawUrl(a.id)} alt={a.description || a.originalName} loading="lazy" />
          ) : (
            <div className="text-thumb">TXT</div>
          )}
          <div className="card-body">
            <div className="card-name">{a.originalName}</div>
            <div className="card-desc">{a.description || (a.aiGenerated ? "" : "No AI metadata")}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create `client/src/components/AssetDetail.tsx`**

```tsx
import { useEffect, useState } from "react";
import type { Asset } from "../api.ts";
import { rawUrl } from "../api.ts";

export function AssetDetail({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    if (asset.kind === "text") {
      fetch(rawUrl(asset.id))
        .then((r) => r.text())
        .then(setText)
        .catch(() => setText("(failed to load text)"));
    }
  }, [asset]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>×</button>
        <h2>{asset.originalName}</h2>
        {asset.kind === "image" ? (
          <img className="detail-img" src={rawUrl(asset.id)} alt={asset.description} />
        ) : (
          <pre className="detail-text">{text}</pre>
        )}
        <section className="meta">
          <h3>Description</h3>
          <p>{asset.description || "—"}</p>
          <h3>Tags</h3>
          <p>{asset.tags.length ? asset.tags.join(", ") : "—"}</p>
          <h3>Keywords</h3>
          <p>{asset.keywords.length ? asset.keywords.join(", ") : "—"}</p>
          {!asset.aiGenerated && <p className="note">AI metadata was not generated for this asset.</p>}
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Rewrite `client/src/App.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import type { Asset } from "./api.ts";
import { listAssets, searchAssets } from "./api.ts";
import { UploadPanel } from "./components/UploadPanel.tsx";
import { SearchBar } from "./components/SearchBar.tsx";
import { Gallery } from "./components/Gallery.tsx";
import { AssetDetail } from "./components/AssetDetail.tsx";

export default function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Asset | null>(null);

  const refresh = useCallback(async () => {
    const data = query.trim() ? await searchAssets(query) : await listAssets();
    setAssets(data);
  }, [query]);

  useEffect(() => {
    refresh().catch(() => setAssets([]));
  }, [refresh]);

  return (
    <main>
      <header className="app-header">
        <h1>Knowledge Management System</h1>
      </header>
      <div className="controls">
        <UploadPanel onUploaded={refresh} />
        <SearchBar value={query} onChange={setQuery} />
      </div>
      <Gallery assets={assets} onSelect={setSelected} />
      {selected && <AssetDetail asset={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
```

- [ ] **Step 7: Append component styles to `client/src/styles.css`**

```css
.app-header h1 { font-size: 1.5rem; }
.controls { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 20px; }
.upload-panel { display: flex; gap: 8px; align-items: center; }
.upload-btn { background: #2563eb; color: #fff; padding: 8px 14px; border-radius: 8px; cursor: pointer; }
.upload-btn input:disabled + * { opacity: .6; }
.hint { color: #888; font-size: .85rem; }
.error { color: #dc2626; font-size: .85rem; }
.search-bar { flex: 1; min-width: 240px; padding: 8px 12px; border-radius: 8px; border: 1px solid #ccc; }
.empty { color: #888; }
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.card { text-align: left; border: 1px solid #ddd; border-radius: 10px; overflow: hidden; background: none; cursor: pointer; padding: 0; }
.card img { width: 100%; height: 150px; object-fit: cover; display: block; }
.text-thumb { width: 100%; height: 150px; display: grid; place-items: center; background: #f1f5f9; color: #64748b; font-weight: 700; }
.card-body { padding: 10px; }
.card-name { font-weight: 600; font-size: .9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-desc { color: #666; font-size: .8rem; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: grid; place-items: center; padding: 20px; }
.modal { background: Canvas; color: CanvasText; border-radius: 12px; max-width: 800px; width: 100%; max-height: 90vh; overflow: auto; padding: 24px; position: relative; }
.close { position: absolute; top: 12px; right: 16px; font-size: 1.5rem; background: none; border: none; cursor: pointer; color: inherit; }
.detail-img { max-width: 100%; border-radius: 8px; }
.detail-text { white-space: pre-wrap; background: #f8fafc; color: #0f172a; padding: 12px; border-radius: 8px; max-height: 300px; overflow: auto; }
.meta h3 { margin: 12px 0 4px; font-size: .8rem; text-transform: uppercase; color: #64748b; }
.note { color: #b45309; font-size: .85rem; }
```

- [ ] **Step 8: Type-check and build**

Run: `cd client && npx tsc --noEmit && npm run build`
Expected: no type errors; `client/dist` rebuilt.

- [ ] **Step 9: Commit**

```bash
git add client/src
git commit -m "feat: full client UI (upload, search, gallery, detail)"
```

---

## Task 8: Dockerfile + .dockerignore + README

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `README.md`

**Interfaces:**
- Produces: a runnable image that builds the client, installs server deps, and runs the server serving the built client from one container on `PORT`.

- [ ] **Step 1: Create `.dockerignore`**

```
**/node_modules
**/dist
data
.git
*.log
.env
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
# ---- Stage 1: build the client ----
FROM node:22-slim AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

# ---- Stage 2: runtime (server + built client) ----
FROM node:22-slim AS runtime
WORKDIR /app

# server deps
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install

# server source + built client
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

ENV PORT=3000
ENV DATA_DIR=/data
VOLUME /data
EXPOSE 3000

WORKDIR /app/server
CMD ["npm", "start"]
```

Note: base image is `node:22-slim` (LTS) rather than 26; `node:sqlite` is available on Node 22 and this avoids depending on a bleeding-edge tag. If a `node:26` tag is preferred later it is a drop-in change.

- [ ] **Step 3: Create `README.md`**

````markdown
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

## Run locally (dev)

```bash
# terminal 1 — backend
cd server && npm install && ANTHROPIC_API_KEY=sk-... npm run dev

# terminal 2 — frontend (proxies /api to the backend)
cd client && npm install && npm run dev
# open http://localhost:5173
```

## Run with Docker

```bash
docker build -t kms .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-... -v kms-data:/data kms
# open http://localhost:3000
```

Data (DB + uploads) persists in the `kms-data` volume.

## API

| Method | Path                    | Purpose                       |
|--------|-------------------------|-------------------------------|
| POST   | `/api/assets`           | Upload a file (multipart `file`) |
| GET    | `/api/assets`           | List all assets               |
| GET    | `/api/assets/search?q=` | Keyword search                |
| GET    | `/api/assets/:id`       | Single asset + metadata       |
| GET    | `/api/assets/:id/raw`   | Serve the file bytes          |
| GET    | `/api/health`           | Health + whether AI is configured |

## Tests

```bash
cd server && node --test --experimental-strip-types src/search.test.ts
```

## AI tools used during development

- Claude (Anthropic) — used at runtime to generate asset metadata, and used via
  Claude Code as a development assistant to design and implement this project.
````

- [ ] **Step 4: Build the image**

Run: `docker build -t kms .`
Expected: builds successfully through both stages.

- [ ] **Step 5: Run the container and smoke-test**

Run:
```bash
docker run -d -p 3000:3000 --name kms-test kms && sleep 3 \
  && curl -s localhost:3000/api/health && echo \
  && curl -s localhost:3000/ | grep -o "<title>[^<]*</title>" \
  && docker rm -f kms-test
```
Expected: health returns `{"status":"ok","ai":false}`; the root serves the client HTML title.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile .dockerignore README.md
git commit -m "feat: dockerize app and add README"
```

---

## Task 9: End-to-end verification with a real API key

**Files:** none (verification only)

- [ ] **Step 1: Start the app with a key**

Run (dev mode is fine): backend with `ANTHROPIC_API_KEY` set, frontend via `npm run dev`, open `http://localhost:5173`.
Expected: page loads, gallery empty.

- [ ] **Step 2: Upload an image with black hair**

Action: upload a photo of a person with black hair through the UI.
Expected: after a moment it appears in the gallery with a generated description; the detail view shows tags/keywords mentioning hair/portrait.

- [ ] **Step 3: Upload a text file mentioning a document**

Action: upload a `.txt` file whose content references a "document".
Expected: appears in the gallery with a generated description.

- [ ] **Step 4: Verify the assignment's example searches**

Action: search `black hair`, then `document`.
Expected: "black hair" returns the portrait image; "document" returns both the text file and (if applicable) any image containing a document.

- [ ] **Step 5: Verify persistence**

Action: restart the server, reload the page.
Expected: previously uploaded assets are still listed (DB + files persisted under `DATA_DIR`).

- [ ] **Step 6: Final commit / tag**

```bash
git add -A
git commit -m "chore: verified end-to-end" --allow-empty
```

---

## Self-Review Notes

- **Spec coverage:** upload (Task 5/7), viewing/gallery+detail (Task 7), AI metadata on upload (Task 4/5), keyword smart-search incl. both PDF examples (Task 3 tests + Task 9), containerized deploy (Task 8), git repo (throughout), README with AI-tools section (Task 8). All spec sections map to a task.
- **Graceful degradation** (spec error-handling) covered in Task 4 (AI fallback) and verified in Task 5 Step 4 without a key.
- **Storage under one `DATA_DIR`** enforced in config (Task 1) and used everywhere; volume in Task 8.
- **No native modules:** only `node:sqlite`; verified importable on Node 26 before planning.
