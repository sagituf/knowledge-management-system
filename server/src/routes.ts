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

// Convert multer errors (e.g. file exceeds the size limit) to 400 JSON so the
// client sees a structured error instead of Express's default HTML 500.
router.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});
