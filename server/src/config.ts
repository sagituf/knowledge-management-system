import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const here = path.dirname(fileURLToPath(import.meta.url));
// project root = server/ (src/..)
const serverRoot = path.resolve(here, "..");

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(serverRoot, "..", "data");

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dataDir,
  uploadsDir: path.join(dataDir, "uploads"),
  dbPath: path.join(dataDir, "knowledge.db"),
  model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
  hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
};
