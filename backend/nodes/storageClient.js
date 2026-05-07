async function putChunkToNode(nodeUrl, chunkId, chunkBuf) {
  const res = await fetch(`${nodeUrl}/chunks/${chunkId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: chunkBuf,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PUT ${nodeUrl} failed: HTTP ${res.status} ${text}`.trim());
  }
}

async function getChunkFromNode(nodeUrl, chunkId) {
  const res = await fetch(`${nodeUrl}/chunks/${chunkId}`, { method: "GET" });
  if (!res.ok) throw new Error(`GET ${nodeUrl} failed: HTTP ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function deleteChunkFromNode(nodeUrl, chunkId) {
  const res = await fetch(`${nodeUrl}/chunks/${chunkId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${nodeUrl} failed: HTTP ${res.status}`);
}

module.exports = {
  putChunkToNode,
  getChunkFromNode,
  deleteChunkFromNode,
};

