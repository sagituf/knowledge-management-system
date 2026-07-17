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

const parsedPort = Number(process.env.PORT ?? 3000);

export const config = {
  port: Number.isNaN(parsedPort) ? 3000 : parsedPort,
  dataDir,
  uploadsDir: path.join(dataDir, "uploads"),
  dbPath: path.join(dataDir, "knowledge.db"),
  model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
  hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
};
