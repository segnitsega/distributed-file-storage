const path = require("path");
const { createStorageNodeApp } = require("./nodes/storageNodeApp");

const PORT = Number(process.env.PORT || 8081);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data", `node-${PORT}`);
const NODE_ID = process.env.NODE_ID || `node-${PORT}`;

const app = createStorageNodeApp({ dataDir: DATA_DIR });

app.listen(PORT, () => {
  console.log(`[storage-node] ${NODE_ID} listening on :${PORT} (dir: ${DATA_DIR})`);
});

