const express = require("express");
const { createNodesRouter } = require("./nodes");
const { createFilesRouter } = require("./files");
const { createTransferRouter } = require("./transfer");

function createRoutes(ctx) {
  const router = express.Router();

  router.use(
    "/nodes",
    createNodesRouter({
      storageNodes: ctx.config.storageNodes,
      nodeHealth: ctx.nodeHealth,
      healthPingIntervalMs: ctx.config.healthPingIntervalMs,
      replicationFactor: ctx.config.replicationFactor,
    })
  );

  router.use(
    "/",
    createTransferRouter({
      metadata: ctx.metadata,
      save: ctx.save,
      chunkSizeBytes: ctx.config.chunkSizeBytes,
      replicationFactor: ctx.config.replicationFactor,
      getHealthyNodes: ctx.nodeHealth.getHealthyNodes,
      pickReplicaNodes: ctx.pickReplicaNodes,
      isNodeHealthy: (url) => Boolean(ctx.nodeHealth.get(url)?.healthy),
    })
  );

  router.use("/files", createFilesRouter({ metadata: ctx.metadata, save: ctx.save, chunkDeleter: ctx.chunkDeleter }));

  return router;
}

module.exports = { createRoutes };

