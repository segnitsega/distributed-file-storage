/**
 * Probe storage nodes for chunk presence (HEAD) and classify file storage health.
 */

async function headChunkOnNode(nodeUrl, chunkId, timeoutMs = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${nodeUrl}/chunks/${chunkId}`, {
      method: "HEAD",
      signal: controller.signal,
    });
    return { url: nodeUrl, present: res.ok, status: res.status };
  } catch {
    return { url: nodeUrl, present: false, status: 0 };
  } finally {
    clearTimeout(t);
  }
}

async function verifyFileReplicas(file) {
  const enrichedChunks = [];
  let replicasPresent = 0;
  let replicasTotal = 0;
  let anyChunkHasNoReplica = false;

  const sorted = file.chunks.slice().sort((a, b) => a.index - b.index);
  for (const c of sorted) {
    const nodes = Array.isArray(c.nodes) ? c.nodes : [];
    replicasTotal += nodes.length;
    const replicaResults = await Promise.all(nodes.map((url) => headChunkOnNode(url, c.chunkId)));
    const presentCount = replicaResults.filter((r) => r.present).length;
    replicasPresent += presentCount;
    if (presentCount === 0) anyChunkHasNoReplica = true;
    enrichedChunks.push({
      index: c.index,
      chunkId: c.chunkId,
      nodes: c.nodes,
      replicas: replicaResults,
      presentCount,
    });
  }

  const allChunksHaveZeroReplicas = enrichedChunks.length > 0 && enrichedChunks.every((ch) => ch.presentCount === 0);

  let storageStatus;
  if (allChunksHaveZeroReplicas) storageStatus = "gone";
  else if (anyChunkHasNoReplica) storageStatus = "unreadable";
  else if (replicasPresent === replicasTotal) storageStatus = "ok";
  else storageStatus = "degraded";

  const readable = !anyChunkHasNoReplica;

  return {
    enrichedChunks,
    replicasPresent,
    replicasTotal,
    allChunksHaveZeroReplicas,
    anyChunkHasNoReplica,
    storageStatus,
    readable,
  };
}

module.exports = {
  verifyFileReplicas,
};
