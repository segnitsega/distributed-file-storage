const fs = require("fs");

function loadMetadata(metadataPath) {
  try {
    const raw = fs.readFileSync(metadataPath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.files && typeof parsed.files === "object") return parsed;
  } catch {
    // ignore
  }
  return { files: {} };
}

function saveMetadata(metadataPath, metadata) {
  const tmp = `${metadataPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(metadata, null, 2));
  fs.renameSync(tmp, metadataPath);
}

module.exports = { loadMetadata, saveMetadata };

