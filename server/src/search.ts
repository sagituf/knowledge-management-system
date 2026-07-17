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
