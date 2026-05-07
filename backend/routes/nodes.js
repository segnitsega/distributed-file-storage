const express = require("express");

function storagePortRange(urls) {
  const ports = [];
  for (const u of urls) {
    try {
      const parsed = new URL(u);
      const p = Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
      if (Number.isFinite(p)) ports.push(p);
    } catch {
      // ignore
    }
  }
  if (ports.length !== urls.length || ports.length === 0) return {};
  return { storagePortMin: Math.min(...ports), storagePortMax: Math.max(...ports) };
}

function createNodesRouter({ storageNodes, nodeHealth, healthPingIntervalMs, replicationFactor }) {
  const router = express.Router();

  router.get("/status", (_req, res) => {
    res.json({
      nodes: nodeHealth.toStatusArray(),
      checkedEveryMs: healthPingIntervalMs,
      cluster: {
        configuredStorageNodes: storageNodes.length,
        replicationFactor: replicationFactor ?? 1,
        ...storagePortRange(storageNodes),
      },
    });
  });

  return router;
}

module.exports = { createNodesRouter };

