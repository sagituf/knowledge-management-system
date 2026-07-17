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

// Serve the built frontend if present (production/container).
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
