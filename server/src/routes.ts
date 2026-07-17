import fs from "node:fs";
import path from "node:path";
import express from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { config } from "./config.ts";
import { insertAsset, listAssets, getAsset, deleteAsset } from "./db.ts";
import { searchAssets } from "./search.ts";
import { generateImageMetadata, generateTextMetadata } from "./ai.ts";
import { classifyUpload, isSupportedImageType, SUPPORTED_IMAGE_TYPES } from "./mime.ts";
import type { Asset } from "./types.ts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

/** True when the AI returned any usable metadata. */
function hasMetadata(m: { description: string; tags: string[]; keywords: string[] }): boolean {
  return m.description !== "" || m.tags.length > 0 || m.keywords.length > 0;
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

// Force a download (Content-Disposition: attachment) with the original filename.
router.get("/assets/:id/download", (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) return res.status(404).json({ error: "not found" });
  const filePath = path.join(config.uploadsDir, asset.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "file missing" });
  res.download(filePath, asset.originalName);
});

router.post("/assets", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "no file uploaded" });

  const kind = classifyUpload(file.mimetype);
  if (!kind) {
    return res.status(400).json({
      error: `unsupported file type: ${file.mimetype}. Only text files and images are accepted.`,
    });
  }

  const id = nanoid();
  const ext = path.extname(file.originalname);
  const storedName = `${id}${ext}`;
  fs.writeFileSync(path.join(config.uploadsDir, storedName), file.buffer);

  let metadata = { description: "", tags: [] as string[], keywords: [] as string[] };
  let extractedText = "";
  // Reason to surface in the description when no AI metadata could be produced.
  let unavailableReason = "";

  if (kind === "image") {
    if (isSupportedImageType(file.mimetype)) {
      metadata = await generateImageMetadata(file.buffer.toString("base64"), file.mimetype);
    } else {
      unavailableReason = `Cannot generate AI metadata: the AI can't read ${file.mimetype} images (supported formats: ${SUPPORTED_IMAGE_TYPES.join(", ")}). Re-upload in one of those formats to get a description.`;
    }
  } else {
    extractedText = file.buffer.toString("utf-8");
    metadata = await generateTextMetadata(extractedText);
  }

  const aiGenerated = hasMetadata(metadata);
  if (!aiGenerated && !unavailableReason) {
    unavailableReason = "AI metadata could not be generated (the AI service was unavailable).";
  }

  const asset: Asset = {
    id,
    kind,
    originalName: file.originalname,
    storedName,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    createdAt: new Date().toISOString(),
    // On failure, store the reason in the description so it's visible on the asset.
    description: aiGenerated ? metadata.description : unavailableReason,
    tags: metadata.tags,
    keywords: metadata.keywords,
    extractedText,
    aiGenerated,
  };
  insertAsset(asset);
  res.status(201).json(asset);
});

router.delete("/assets/:id", (req, res) => {
  const asset = getAsset(req.params.id);
  if (!asset) return res.status(404).json({ error: "not found" });
  // Remove the stored file (best-effort), then the DB row.
  fs.rmSync(path.join(config.uploadsDir, asset.storedName), { force: true });
  deleteAsset(asset.id);
  res.status(204).end();
});

// Convert multer errors (e.g. file exceeds the size limit) to 400 JSON so the
// client sees a structured error instead of Express's default HTML 500.
router.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});
