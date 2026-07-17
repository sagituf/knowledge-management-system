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

test("all query tokens must match (AND): 'black hair' excludes a 'hair'-only asset", () => {
  const woman = asset({ id: "woman", description: "woman with long black hair", keywords: ["black hair"] });
  const poodle = asset({ id: "poodle", description: "a brown poodle", keywords: ["curly hair dog"] });
  const results = searchAssets([poodle, woman], "black hair");
  assert.deepEqual(results.map((r) => r.id), ["woman"]);
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
