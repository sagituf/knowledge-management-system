import assert from "node:assert/strict";
import test from "node:test";
import { classifyUpload } from "./mime.ts";

test("supported image types classify as image", () => {
  for (const t of ["image/jpeg", "image/png", "image/gif", "image/webp"]) {
    assert.equal(classifyUpload(t), "image");
  }
});

test("unsupported image types are rejected (null)", () => {
  for (const t of ["image/avif", "image/heic", "image/svg+xml", "image/bmp", "image/tiff"]) {
    assert.equal(classifyUpload(t), null);
  }
});

test("text types classify as text", () => {
  assert.equal(classifyUpload("text/plain"), "text");
  assert.equal(classifyUpload("text/markdown"), "text");
});

test("other types are rejected (null)", () => {
  assert.equal(classifyUpload("application/pdf"), null);
  assert.equal(classifyUpload("application/json"), null);
});
