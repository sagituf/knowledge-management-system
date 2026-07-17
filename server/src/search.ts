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
 * Return assets that contain EVERY query token (AND semantics), ranked by
 * relevance. Score = (# distinct tokens that appear) * 10 + (total occurrences);
 * since matches must contain all tokens, ranking is effectively by how often the
 * terms occur across the asset's searchable fields.
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
    // AND semantics: an asset matches only if EVERY query token appears in it.
    // This keeps a two-word query like "black hair" from surfacing an asset
    // that merely contains "hair". Occurrences still drive ranking among matches.
    return { asset, score: distinct * 10 + occurrences, matched: distinct === tokens.length };
  });

  return scored
    .filter((s) => s.matched)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.asset);
}
