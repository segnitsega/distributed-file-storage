const express = require("express");
const fs = require("fs");
const path = require("path");

function ensureDirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeChunkId(chunkId) {
  // Chunk IDs are SHA-256 hex; keep it strict to avoid path traversal.
  if (!/^[a-f0-9]{64}$/i.test(chunkId)) return null;
  return chunkId.toLowerCase();
}

function createStorageNodeApp({ dataDir }) {
  ensureDirSync(dataDir);
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ status: "alive" });
  });

  app.put("/chunks/:chunkId", (req, res) => {
    const chunkId = safeChunkId(req.params.chunkId);
    if (!chunkId) return res.status(400).json({ error: "Invalid chunkId" });

    const outPath = path.join(dataDir, chunkId);
    const tmpPath = `${outPath}.tmp-${process.pid}-${Date.now()}`;

    const out = fs.createWriteStream(tmpPath);
    req.pipe(out);

    out.on("finish", () => {
      fs.rename(tmpPath, outPath, (err) => {
        if (err) return res.status(500).json({ error: "Failed to persist chunk" });
        res.status(201).json({ ok: true, chunkId });
      });
    });

    out.on("error", () => {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore
      }
      res.status(500).json({ error: "Failed to store chunk" });
    });
  });

  function statChunk(chunkId, res, withBody) {
    const filePath = path.join(dataDir, chunkId);
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        if (withBody) return res.status(404).json({ error: "Chunk not found" });
        return res.status(404).end();
      }
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Length", stat.size);
      if (withBody) fs.createReadStream(filePath).pipe(res);
      else res.end();
    });
  }

  app.head("/chunks/:chunkId", (req, res) => {
    const chunkId = safeChunkId(req.params.chunkId);
    if (!chunkId) return res.status(400).end();
    statChunk(chunkId, res, false);
  });

  app.get("/chunks/:chunkId", (req, res) => {
    const chunkId = safeChunkId(req.params.chunkId);
    if (!chunkId) return res.status(400).json({ error: "Invalid chunkId" });
    statChunk(chunkId, res, true);
  });

  app.delete("/chunks/:chunkId", (req, res) => {
    const chunkId = safeChunkId(req.params.chunkId);
    if (!chunkId) return res.status(400).json({ error: "Invalid chunkId" });

    const filePath = path.join(dataDir, chunkId);
    fs.unlink(filePath, (err) => {
      if (err && err.code !== "ENOENT") return res.status(500).json({ error: "Failed to delete chunk" });
      res.json({ ok: true, chunkId, deleted: !err });
    });
  });

  return app;
}

module.exports = { createStorageNodeApp };

