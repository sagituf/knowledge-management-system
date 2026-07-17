import type { AssetKind } from "./types.ts";

/**
 * Image MIME types Claude's vision API accepts. An image outside this set can be
 * stored but would fail metadata generation, so we reject it at upload instead of
 * silently storing an un-searchable asset.
 */
export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

/**
 * Classify an uploaded file by MIME type, or return null if it is not a
 * supported image or a text file.
 */
export function classifyUpload(mimeType: string): AssetKind | null {
  if (SUPPORTED_IMAGE_TYPES.includes(mimeType)) return "image";
  if (mimeType.startsWith("text/")) return "text";
  return null;
}
