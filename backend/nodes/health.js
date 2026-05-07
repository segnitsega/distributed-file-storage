function createNodeHealth(storageNodes) {
  const nodeHealth = new Map(); // url -> { healthy: boolean, lastCheckedAt: number, lastError?: string }
  for (const url of storageNodes) nodeHealth.set(url, { healthy: false, lastCheckedAt: 0 });

  function get(url) {
    return nodeHealth.get(url);
  }

  function set(url, value) {
    nodeHealth.set(url, value);
  }

  function toStatusArray() {
    return storageNodes.map((url) => ({
      url,
      ...(nodeHealth.get(url) || { healthy: false, lastCheckedAt: 0 }),
    }));
  }

  function getHealthyNodes() {
    return storageNodes.filter((u) => nodeHealth.get(u)?.healthy);
  }

  return { get, set, toStatusArray, getHealthyNodes };
}

async function pingNode(url, nodeHealth) {
  const now = Date.now();
  try {
    const res = await fetch(`${url}/health`, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    nodeHealth.set(url, { healthy: true, lastCheckedAt: now });
  } catch (e) {
    nodeHealth.set(url, { healthy: false, lastCheckedAt: now, lastError: e?.message || String(e) });
  }
}

async function pingAllNodes(storageNodes, nodeHealth) {
  await Promise.all(storageNodes.map((u) => pingNode(u, nodeHealth)));
}

function startHealthPolling({ storageNodes, nodeHealth, intervalMs }) {
  void pingAllNodes(storageNodes, nodeHealth);
  return setInterval(() => {
    void pingAllNodes(storageNodes, nodeHealth);
  }, intervalMs);
}

module.exports = {
  createNodeHealth,
  pingNode,
  pingAllNodes,
  startHealthPolling,
};

