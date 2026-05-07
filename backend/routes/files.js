const express = require("express");
const { REPLICATION_FACTOR } = require("../config");
const { verifyFileReplicas } = require("../services/storageVerify");

function truthyVerify(q) {
  return q === "1" || q === "true" || q === "yes";
}

function metadataReplicaExtents(f) {
  const lens = (f.chunks || []).map((c) => (Array.isArray(c.nodes) ? c.nodes.length : 0));
  if (!lens.length) return { maxReplicasInMetadata: 0, minReplicasInMetadata: 0 };
  return {
    maxReplicasInMetadata: Math.max(...lens),
    minReplicasInMetadata: Math.min(...lens),
  };
}

function createFilesRouter({ metadata, save, chunkDeleter }) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    if (!truthyVerify(req.query.verify)) {
      const files = Object.entries(metadata.files).map(([fileId, f]) => ({
        fileId,
        fileName: f.fileName,
        sizeBytes: f.sizeBytes,
        chunkCount: f.chunks.length,
        createdAt: f.createdAt,
        ...metadataReplicaExtents(f),
      }));
      return res.json({
        files,
        policy: { replicationFactor: REPLICATION_FACTOR },
      });
    }

    const removed = [];
    const filesOut = [];

    const ids = Object.keys(metadata.files);
    for (const fileId of ids) {
      const f = metadata.files[fileId];
      if (!f) continue;

      const report = await verifyFileReplicas(f);

      if (report.allChunksHaveZeroReplicas) {
        delete metadata.files[fileId];
        removed.push({
          fileId,
          fileName: f.fileName,
          reason: "all_chunks_missing_from_storage",
        });
        continue;
      }

      filesOut.push({
        fileId,
        fileName: f.fileName,
        sizeBytes: f.sizeBytes,
        chunkCount: f.chunks.length,
        createdAt: f.createdAt,
        storageStatus: report.storageStatus,
        readable: report.readable,
        replicasPresent: report.replicasPresent,
        replicasTotal: report.replicasTotal,
        ...metadataReplicaExtents(f),
      });
    }

    if (removed.length) save();

    res.json({
      files: filesOut,
      policy: { replicationFactor: REPLICATION_FACTOR },
      storageSync: { removed, verifiedAt: new Date().toISOString() },
    });
  });

  router.get("/:fileId", async (req, res) => {
    const { fileId } = req.params;
    const file = metadata.files[fileId];
    if (!file) return res.status(404).json({ error: "File not found" });

    if (!truthyVerify(req.query.verify)) {
      return res.json({
        fileId,
        fileName: file.fileName,
        sizeBytes: file.sizeBytes,
        createdAt: file.createdAt,
        chunks: file.chunks,
        policy: { replicationFactor: REPLICATION_FACTOR },
        ...metadataReplicaExtents(file),
      });
    }

    const report = await verifyFileReplicas(file);

    if (report.allChunksHaveZeroReplicas) {
      delete metadata.files[fileId];
      save();
      return res.status(404).json({
        error: "File removed — all chunk replicas missing from storage",
        removed: true,
        fileId,
        fileName: file.fileName,
      });
    }

    res.json({
      fileId,
      fileName: file.fileName,
      sizeBytes: file.sizeBytes,
      createdAt: file.createdAt,
      chunks: report.enrichedChunks,
      storageStatus: report.storageStatus,
      readable: report.readable,
      replicasPresent: report.replicasPresent,
      replicasTotal: report.replicasTotal,
      verifiedAt: new Date().toISOString(),
      policy: { replicationFactor: REPLICATION_FACTOR },
      ...metadataReplicaExtents(file),
    });
  });

  router.delete("/:fileId", async (req, res) => {
    const { fileId } = req.params;
    const file = metadata.files[fileId];
    if (!file) return res.status(404).json({ error: "File not found" });

    let results = [];
    if (typeof chunkDeleter === "function") {
      results = await chunkDeleter(file);
    }

    delete metadata.files[fileId];
    save();

    const failed = results.filter((r) => r.status === "rejected").length;
    res.json({
      ok: true,
      fileId,
      chunkDeletesAttempted: results.length,
      chunkDeletesFailed: failed,
    });
  });

  return router;
}

module.exports = { createFilesRouter };
