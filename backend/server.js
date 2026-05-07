const cors = require("cors");
const express = require("express");

const { PORT, STORAGE_NODES } = require("./config");
const { createMasterContext } = require("./services/masterContext");
const { createRoutes } = require("./routes");

function start() {
  const ctx = createMasterContext();

  const app = express();
  app.use(cors());
  app.use(createRoutes(ctx));

  return app.listen(PORT, () => {
    console.log(`[master] listening on :${PORT}`);
    console.log(`[master] storage nodes: ${STORAGE_NODES.join(", ")}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { start };

