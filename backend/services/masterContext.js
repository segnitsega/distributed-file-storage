const {
  CHUNK_SIZE_BYTES,
  REPLICATION_FACTOR,
  HEALTH_PING_INTERVAL_MS,
  STORAGE_NODES,
  METADATA_PATH,
} = require("../config");

const { loadMetadata, saveMetadata } = require("../metadata/store");
const { createNodeHealth, startHealthPolling } = require("../nodes/health");
const { createReplicaPicker } = require("../nodes/replication");
const { deleteChunkFromNode } = require("../nodes/storageClient");

function createMasterContext() {
  const metadata = loadMetadata(METADATA_PATH);
  function save() {
    saveMetadata(METADATA_PATH, metadata);
  }

  const nodeHealth = createNodeHealth(STORAGE_NODES);
  startHealthPolling({ storageNodes: STORAGE_NODES, nodeHealth, intervalMs: HEALTH_PING_INTERVAL_MS });

  const { pickReplicaNodes } = createReplicaPicker(nodeHealth.getHealthyNodes);

  async function chunkDeleter(file) {
    const unique = new Map(); // chunkId -> nodes[]
    for (const c of file.chunks) unique.set(c.chunkId, c.nodes);
    return await Promise.allSettled(
      Array.from(unique.entries()).flatMap(([chunkId, nodes]) => nodes.map((n) => deleteChunkFromNode(n, chunkId)))
    );
  }

  return {
    config: {
      chunkSizeBytes: CHUNK_SIZE_BYTES,
      replicationFactor: REPLICATION_FACTOR,
      healthPingIntervalMs: HEALTH_PING_INTERVAL_MS,
      storageNodes: STORAGE_NODES,
    },
    metadata,
    save,
    nodeHealth,
    pickReplicaNodes,
    chunkDeleter,
  };
}

module.exports = { createMasterContext };

