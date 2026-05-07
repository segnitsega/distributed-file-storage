const path = require("path");

const PORT = Number(process.env.PORT || 8000);
const CHUNK_SIZE_BYTES = 1024 * 1024; // 1MB
const REPLICATION_FACTOR = Number(process.env.REPLICATION_FACTOR || 3);
const HEALTH_PING_INTERVAL_MS = 5000;

/** How many storage node URLs the master tracks (default 5 → 8081–8085). */
const STORAGE_NODE_COUNT = Math.min(
  64,
  Math.max(1, Number(process.env.STORAGE_NODE_COUNT || 5)),
);
const STORAGE_BASE_PORT = Number(process.env.STORAGE_BASE_PORT || 8081);

let STORAGE_NODES;
if (process.env.STORAGE_NODES) {
  const list = process.env.STORAGE_NODES.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length > STORAGE_NODE_COUNT) {
    console.warn(
      `[config] STORAGE_NODES lists ${list.length} URLs; using the first ${STORAGE_NODE_COUNT} only. Set STORAGE_NODE_COUNT larger if you really run more nodes.`,
    );
  }
  STORAGE_NODES = list.slice(0, STORAGE_NODE_COUNT);
} else {
  STORAGE_NODES = Array.from(
    { length: STORAGE_NODE_COUNT },
    (_, i) => `http://localhost:${STORAGE_BASE_PORT + i}`,
  );
}

const METADATA_PATH =
  process.env.METADATA_PATH || path.join(__dirname, "metadata.json");

module.exports = {
  PORT,
  CHUNK_SIZE_BYTES,
  REPLICATION_FACTOR,
  HEALTH_PING_INTERVAL_MS,
  STORAGE_NODE_COUNT,
  STORAGE_BASE_PORT,
  STORAGE_NODES,
  METADATA_PATH,
};
