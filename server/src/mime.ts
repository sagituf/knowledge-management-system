import type { AssetKind } from "./types.ts";

/** Image MIME types Claude's vision API can read. */
export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

/** True when Claude vision can process this image type. */
export function isSupportedImageType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(mimeType);
}

/**
 * Classify an uploaded file as an image or text asset, or null if it is neither.
 * All image types are accepted for storage; whether the AI can describe a given
 * image is a separate check (see isSupportedImageType).
 */
export function classifyUpload(mimeType: string): AssetKind | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("text/")) return "text";
  return null;
}
