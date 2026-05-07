const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { deleteChunkFromNode, getChunkFromNode, putChunkToNode } = require("../nodes/storageClient");

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function createTransferRouter({
  metadata,
  save,
  chunkSizeBytes,
  replicationFactor,
  getHealthyNodes,
  pickReplicaNodes,
  isNodeHealthy,
}) {
  const router = express.Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES || 1024 * 1024 * 1024) },
  });

  router.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Missing file field 'file'" });

    const healthy = getHealthyNodes();
    if (healthy.length < replicationFactor) {
      return res.status(503).json({ error: "Not enough healthy storage nodes", healthyNodes: healthy.length });
    }

    const fileId = uuidv4();
    const fileName = req.file.originalname || "file";
    const buf = req.file.buffer;

    const chunks = [];
    try {
      for (let offset = 0, idx = 0; offset < buf.length; offset += chunkSizeBytes, idx++) {
        const chunkBuf = buf.subarray(offset, Math.min(offset + chunkSizeBytes, buf.length));
        const chunkId = sha256Hex(chunkBuf);
        const nodes = pickReplicaNodes(replicationFactor);
        if (!nodes || nodes.length !== replicationFactor) {
          throw new Error(`Invalid replica pick: expected ${replicationFactor}, got ${nodes?.length ?? 0}`);
        }

        await Promise.all(nodes.map((n) => putChunkToNode(n, chunkId, chunkBuf)));
        chunks.push({ index: idx, chunkId, nodes });
      }

      metadata.files[fileId] = {
        fileName,
        sizeBytes: buf.length,
        createdAt: new Date().toISOString(),
        chunks,
      };
      save();
      res.status(201).json({ fileId, fileName, sizeBytes: buf.length, chunkCount: chunks.length });
    } catch (e) {
      // Best-effort cleanup
      const seen = new Map();
      for (const c of chunks) seen.set(c.chunkId, c.nodes);
      await Promise.allSettled(
        Array.from(seen.entries()).flatMap(([chunkId, nodes]) => nodes.map((n) => deleteChunkFromNode(n, chunkId)))
      );
      res.status(500).json({ error: "Upload failed", detail: e?.message || String(e) });
    }
  });

  router.get("/download/:fileId", async (req, res) => {
    const { fileId } = req.params;
    const file = metadata.files[fileId];
    if (!file) return res.status(404).json({ error: "File not found" });

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${String(file.fileName).replaceAll('"', "")}"`);

    try {
      for (const c of file.chunks.sort((a, b) => a.index - b.index)) {
        let lastErr = null;
        for (const nodeUrl of c.nodes) {
          if (!isNodeHealthy(nodeUrl)) continue;
          try {
            const chunkBuf = await getChunkFromNode(nodeUrl, c.chunkId);
            res.write(chunkBuf);
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
          }
        }
        if (lastErr) throw lastErr;
      }
      res.end();
    } catch (e) {
      if (res.headersSent) return res.destroy(e);
      res.status(500).json({ error: "Download failed", detail: e?.message || String(e) });
    }
  });

  return router;
}

module.exports = { createTransferRouter };

