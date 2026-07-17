import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { config } from "./config.ts";
import { router } from "./routes.ts";

fs.mkdirSync(config.uploadsDir, { recursive: true });

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, "..", "..", "client", "dist");

const app = express();

app.use("/api", router);

// Unknown /api/* routes get a JSON 404 (not the SPA fallback below).
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not found" });
});

// Serve the built frontend if present (production/container).
// A pattern-less fallback (no "*") serves index.html for client-side routes and
// works under both Express 4 and 5.
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
