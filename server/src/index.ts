import fs from "node:fs";
import express from "express";
import { config } from "./config.ts";

fs.mkdirSync(config.uploadsDir, { recursive: true });

const app = express();

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ai: config.hasApiKey });
});

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
