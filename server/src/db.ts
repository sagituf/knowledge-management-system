import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.ts";
import type { Asset } from "./types.ts";

// Ensure the data directory exists before opening the database. This module is
// imported (and runs) before index.ts's body, so a fresh environment with an
// empty/absent DATA_DIR would otherwise fail with "unable to open database file".
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

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

/** Delete an asset row. Returns true if a row was removed. */
export function deleteAsset(id: string): boolean {
  const info = db.prepare(`DELETE FROM assets WHERE id = ?`).run(id);
  return info.changes > 0;
}

/** Overwrite an asset's AI-generated metadata (used when re-evaluating). */
export function updateAssetMetadata(
  id: string,
  m: { description: string; tags: string[]; keywords: string[]; aiGenerated: boolean },
): void {
  db.prepare(
    `UPDATE assets SET description = ?, tags = ?, keywords = ?, ai_generated = ? WHERE id = ?`,
  ).run(m.description, JSON.stringify(m.tags), JSON.stringify(m.keywords), m.aiGenerated ? 1 : 0, id);
}
