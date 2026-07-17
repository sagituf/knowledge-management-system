import assert from "node:assert/strict";
import test from "node:test";
import { classifyUpload, isSupportedImageType } from "./mime.ts";

test("all image types classify as image (including ones the AI can't read)", () => {
  for (const t of ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/heic"]) {
    assert.equal(classifyUpload(t), "image");
  }
});

test("text types classify as text", () => {
  assert.equal(classifyUpload("text/plain"), "text");
  assert.equal(classifyUpload("text/markdown"), "text");
});

test("non-image/non-text types are rejected (null)", () => {
  assert.equal(classifyUpload("application/pdf"), null);
  assert.equal(classifyUpload("application/json"), null);
});

test("isSupportedImageType reflects Claude-vision support", () => {
  for (const t of ["image/jpeg", "image/png", "image/gif", "image/webp"]) {
    assert.equal(isSupportedImageType(t), true);
  }
  for (const t of ["image/avif", "image/heic", "image/svg+xml", "image/bmp"]) {
    assert.equal(isSupportedImageType(t), false);
  }
});
