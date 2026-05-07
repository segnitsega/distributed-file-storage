function createReplicaPicker(getHealthyNodes) {
  let rrIndex = 0;

  function pickReplicaNodes(count) {
    const want = Number(count);
    const healthy = getHealthyNodes().filter(Boolean);
    if (!Number.isFinite(want) || want < 1 || healthy.length < want) return null;

    const picked = [];
    for (let k = 0; k < want; k++) {
      const idx = (rrIndex + k) % healthy.length;
      picked.push(healthy[idx]);
    }
    rrIndex = (rrIndex + want) % Math.max(healthy.length, 1);
    return picked;
  }

  return { pickReplicaNodes };
}

module.exports = { createReplicaPicker };
