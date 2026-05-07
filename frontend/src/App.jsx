import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

function formatBytes(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

async function jsonOrThrow(res) {
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg = (data && (data.error || data.detail)) || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function shortId(id) {
  if (!id) return "";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function nodePortLabel(url) {
  try {
    const u = new URL(url);
    return u.port || (u.protocol === "https:" ? "443" : "80");
  } catch {
    return url;
  }
}

function StorageStatusPill({ status }) {
  if (!status) return null;
  const map = {
    ok: { cls: "PillStorageOk", label: "All replicas present" },
    degraded: { cls: "PillStorageWarn", label: "Some replicas missing" },
    unreadable: { cls: "PillStorageBad", label: "Cannot rebuild file" },
  };
  const x = map[status];
  if (!x) return null;
  return <span className={`Pill ${x.cls}`}>{x.label}</span>;
}

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [error, setError] = useState("");
  const [expandedFileId, setExpandedFileId] = useState(null);
  const expandedFileIdRef = useRef(null);
  const [fileDetails, setFileDetails] = useState({}); // fileId -> { loading, data?, error?, syncing? }
  const [syncBanner, setSyncBanner] = useState(null); // { type, text }
  const [lastVerified, setLastVerified] = useState(null);
  const [cluster, setCluster] = useState(null); // from GET /nodes/status
  const [policy, setPolicy] = useState(null); // from GET /files policy.replicationFactor

  useEffect(() => {
    expandedFileIdRef.current = expandedFileId;
  }, [expandedFileId]);

  const rf = cluster?.replicationFactor ?? policy?.replicationFactor ?? 3;
  const configuredNodes = nodes.length;
  const storagePortMin = cluster?.storagePortMin;
  const storagePortMax = cluster?.storagePortMax;

  const healthyCount = useMemo(() => nodes.filter((n) => n.healthy).length, [nodes]);

  async function refreshExpandedDetail(fileId, { showLoading = false } = {}) {
    if (!fileId) return;

    setFileDetails((p) => {
      const prev = p[fileId];
      const shouldSpinner = Boolean(showLoading && !prev?.data);
      return {
        ...p,
        [fileId]: { ...prev, loading: shouldSpinner, syncing: Boolean(!shouldSpinner && prev?.data) },
      };
    });
    try {
      const res = await fetch(`/files/${encodeURIComponent(fileId)}?verify=1`);
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // ignore
      }
      if (res.status === 404) {
        if (data?.removed) {
          setFileDetails((p) => {
            const next = { ...p };
            delete next[fileId];
            return next;
          });
          if (expandedFileIdRef.current === fileId) {
            setExpandedFileId(null);
          }
          setSyncBanner({
            type: "warn",
            text: `“${data.fileName || fileId}” removed from the catalog — all chunk replicas are gone from storage.`,
          });
          return;
        }
        setFileDetails((p) => {
          const next = { ...p };
          delete next[fileId];
          return next;
        });
        if (expandedFileIdRef.current === fileId) setExpandedFileId(null);
        return;
      }
      if (!res.ok) {
        throw new Error((data && (data.error || data.detail)) || text || `HTTP ${res.status}`);
      }
      if (data?.policy) setPolicy(data.policy);
      setFileDetails((p) => ({ ...p, [fileId]: { loading: false, syncing: false, data } }));
    } catch (e) {
      setFileDetails((p) => ({ ...p, [fileId]: { loading: false, syncing: false, error: e?.message || String(e) } }));
    }
  }

  async function refresh() {
    setError("");
    const [filesRes, nodesRes] = await Promise.all([
      fetch("/files?verify=1", { method: "GET" }),
      fetch("/nodes/status", { method: "GET" }),
    ]);
    const filesJson = await jsonOrThrow(filesRes);
    const nodesJson = await jsonOrThrow(nodesRes);

    setFiles(filesJson.files || []);
    setNodes(nodesJson.nodes || []);
    setCluster(nodesJson.cluster ?? null);
    if (filesJson.policy) setPolicy(filesJson.policy);
    if (filesJson.storageSync?.verifiedAt) {
      setLastVerified(filesJson.storageSync.verifiedAt);
    }

    const removed = filesJson.storageSync?.removed || [];
    if (removed.length > 0) {
      const names = removed.map((r) => r.fileName || r.fileId).join(", ");
      setSyncBanner({
        type: "warn",
        text: `Removed from catalog (all chunks missing on every replica): ${names}`,
      });
      removed.forEach((r) => {
        setFileDetails((p) => {
          const next = { ...p };
          delete next[r.fileId];
          return next;
        });
      });
      if (removed.some((r) => r.fileId === expandedFileIdRef.current)) {
        setExpandedFileId(null);
      }
    }

    const exp = expandedFileIdRef.current;
    if (exp) {
      await refreshExpandedDetail(exp, { showLoading: false });
    }
  }

  useEffect(() => {
    refresh().catch((e) => setError(e?.message || String(e)));
    const t = setInterval(() => {
      refresh().catch((e) => setError(e?.message || String(e)));
    }, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!syncBanner) return;
    const t = setTimeout(() => setSyncBanner(null), 12000);
    return () => clearTimeout(t);
  }, [syncBanner]);

  async function loadFileDetail(fileId) {
    if (!fileId) return;
    setFileDetails((p) => ({ ...p, [fileId]: { loading: true, syncing: false } }));
    try {
      const res = await fetch(`/files/${encodeURIComponent(fileId)}?verify=1`);
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        // ignore
      }
      if (res.status === 404) {
        if (data?.removed) {
          setFileDetails((p) => {
            const next = { ...p };
            delete next[fileId];
            return next;
          });
          setExpandedFileId(null);
          setSyncBanner({
            type: "warn",
            text: `“${data.fileName || fileId}” removed from the catalog — all chunk replicas are gone from storage.`,
          });
          await refresh().catch(() => {});
          return;
        }
        setFileDetails((p) => {
          const next = { ...p };
          delete next[fileId];
          return next;
        });
        setExpandedFileId(null);
        await refresh().catch(() => {});
        return;
      }
      if (!res.ok) {
        throw new Error((data && (data.error || data.detail)) || text || `HTTP ${res.status}`);
      }
      if (data?.policy) setPolicy(data.policy);
      setFileDetails((p) => ({ ...p, [fileId]: { loading: false, syncing: false, data } }));
    } catch (e) {
      setFileDetails((p) => ({ ...p, [fileId]: { loading: false, syncing: false, error: e?.message || String(e) } }));
    }
  }

  async function onUpload(e) {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const res = await fetch("/upload", { method: "POST", body: fd });
      const uploaded = await jsonOrThrow(res);
      setSelectedFile(null);
      await refresh();
      if (uploaded?.fileId) {
        setExpandedFileId(uploaded.fileId);
        await loadFileDetail(uploaded.fileId);
      }
    } catch (e2) {
      setError(e2?.message || String(e2));
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(fileId) {
    if (!fileId) return;
    setError("");
    try {
      const res = await fetch(`/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
      await jsonOrThrow(res);
      setFileDetails((p) => {
        const next = { ...p };
        delete next[fileId];
        return next;
      });
      if (expandedFileId === fileId) setExpandedFileId(null);
      await refresh();
    } catch (e) {
      setError(e?.message || String(e));
    }
  }

  return (
    <div className="App">
      <div className="Container">
        <div className="Header">
          <h1>Distributed File Storage</h1>
          <div className="HeaderActions">
            <div className="Muted">
              Cluster:{" "}
              <strong>{configuredNodes} nodes</strong> ({rf} replicas per chunk) ·{" "}
              <span className={`Pill ${healthyCount >= rf ? "PillOk" : "PillBad"}`}>
                {healthyCount}/{configuredNodes} reachable
              </span>
            </div>
            <button className="Btn BtnGhost" type="button" onClick={() => refresh().catch((e) => setError(e.message))}>
              Refresh
            </button>
          </div>
        </div>

        <div className="Grid">
          <div className="Card CardMain">
            <h2>Upload a file</h2>
            <div className="Stack">
              <form onSubmit={onUpload} className="Row">
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                />
                <button className="Btn BtnPrimary" type="submit" disabled={!selectedFile || uploading}>
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                <div className="Hint">
                  Chunks are 1MB · each chunk copied to <strong>{rf}</strong> of <strong>{configuredNodes}</strong> nodes.
                  Disk check every ~2.5s.
                </div>
              </form>
            </div>

            {lastVerified ? (
              <div className="Muted" style={{ marginTop: 6, fontSize: 12 }}>
                Last storage scan: {new Date(lastVerified).toLocaleString()}
              </div>
            ) : null}

            {syncBanner ? (
              <div className={syncBanner.type === "warn" ? "SyncBanner SyncBannerWarn" : "SyncBanner"}>{syncBanner.text}</div>
            ) : null}

            {error ? <div className="Err">{error}</div> : null}

            <div className="FileCard">
              <h2>Files</h2>
              {files.length === 0 ? (
                <div className="Muted">No files uploaded yet.</div>
              ) : (
                files.map((f) => {
                  const expanded = expandedFileId === f.fileId;
                  const detail = fileDetails[f.fileId];
                  const chunks = detail?.data?.chunks || null;

                  const metaMaxReplicas =
                    expanded && typeof detail?.data?.maxReplicasInMetadata === "number"
                      ? detail.data.maxReplicasInMetadata
                      : typeof f.maxReplicasInMetadata === "number"
                        ? f.maxReplicasInMetadata
                        : undefined;
                  const metaSlotsMismatch =
                    typeof metaMaxReplicas === "number" && metaMaxReplicas !== rf && metaMaxReplicas > 0;

                  const displayStatus =
                    expanded && detail?.data?.storageStatus ? detail.data.storageStatus : f.storageStatus;
                  const rp =
                    expanded && typeof detail?.data?.replicasPresent === "number"
                      ? detail.data.replicasPresent
                      : f.replicasPresent;
                  const rt =
                    expanded && typeof detail?.data?.replicasTotal === "number"
                      ? detail.data.replicasTotal
                      : f.replicasTotal;
                  const readable =
                    expanded && typeof detail?.data?.readable === "boolean" ? detail.data.readable : f.readable !== false;
                  const chunksOnDisk =
                    expanded && Array.isArray(chunks)
                      ? chunks.filter((c) => (typeof c.presentCount === "number" ? c.presentCount > 0 : false)).length
                      : null;
                  return (
                    <div key={f.fileId} className="FileCard">
                      <div className="FileTitleRow">
                        <div>
                          <div className="FileName">{f.fileName}</div>
                          <div className="Muted Mono">{shortId(f.fileId)}</div>
                          <div className="Row" style={{ marginTop: 8 }}>
                            <StorageStatusPill status={displayStatus} />
                            {detail?.syncing && chunks ? (
                              <span className="Muted" style={{ fontSize: 12 }}>
                                Updating…
                              </span>
                            ) : null}
                            {typeof rp === "number" && typeof rt === "number" ? (
                              <span className="Muted" style={{ fontSize: 12 }}>
                                chunk replicas on disk: {rp}/{rt}
                              </span>
                            ) : !displayStatus ? (
                              <span className="Muted" style={{ fontSize: 12 }}>
                                waiting for disk check…
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="FileActions">
                          {readable ? (
                            <a className="Btn" href={`/download/${encodeURIComponent(f.fileId)}`}>
                              Download
                            </a>
                          ) : (
                            <span className="Btn BtnMuted" title="At least one chunk has no replica on disk — download would fail">
                              Download
                            </span>
                          )}
                          <button
                            className="Btn"
                            type="button"
                            onClick={() => {
                              const next = expanded ? null : f.fileId;
                              setExpandedFileId(next);
                              if (next) loadFileDetail(next);
                            }}
                          >
                            {expanded ? "Hide details" : "View details"}
                          </button>
                          <button className="Btn BtnDanger" type="button" onClick={() => onDelete(f.fileId)}>
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="KvGrid">
                        <div className="Kv">
                          <span>Size</span>
                          <span>{formatBytes(f.sizeBytes)}</span>
                        </div>
                        <div className="Kv">
                          <span>Chunks</span>
                          <span>
                            {chunksOnDisk != null ? (
                              <>
                                <strong>{chunksOnDisk}</strong>
                                <span className="Muted"> present on disk</span>
                                <span className="Muted"> · </span>
                                <strong>{chunks.length}</strong>
                                <span className="Muted"> in catalog</span>
                              </>
                            ) : (
                              f.chunkCount
                            )}
                          </span>
                        </div>
                        <div className="Kv">
                          <span>Created</span>
                          <span className="Mono Small">{f.createdAt ? new Date(f.createdAt).toLocaleString() : "-"}</span>
                        </div>
                        <div className="Kv">
                          <span>Replicas</span>
                          <span>
                            {metaSlotsMismatch ? (
                              <>
                                Policy: <strong>{rf}</strong> per chunk · metadata lists up to{" "}
                                <strong>{metaMaxReplicas}</strong> target node(s) per chunk (
                                <span className="Muted">legacy upload — re-upload to align</span>)
                              </>
                            ) : (
                              <>
                                {rf} per chunk (of {configuredNodes} nodes)
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {expanded ? (
                        <div className="ChunkBox">
                          {detail?.loading && !chunks ? (
                            <div className="Muted">Loading chunk + storage probe…</div>
                          ) : detail?.error ? (
                            <div className="Err">{detail.error}</div>
                          ) : chunks ? (
                            <div className="Stack">
                              {metaSlotsMismatch ? (
                                <div className="SyncBanner SyncBannerWarn" style={{ marginBottom: 0 }}>
                                  This file was uploaded under an older replication layout. The table below checks every URL
                                  still recorded in catalog metadata ({metaMaxReplicas} per chunk), not only the current policy (
                                  {rf}).
                                </div>
                              ) : null}
                              <div className="Row">
                                <span className="Muted">Live replica presence (HEAD per node)</span>
                                <StorageStatusPill status={detail.data?.storageStatus} />
                              </div>
                              <div className="TableScroll">
                                <table className="Table TableChunkReplicas">
                                  <thead>
                                    <tr>
                                      <th scope="col">#</th>
                                      <th scope="col">chunkId</th>
                                      <th scope="col">replicas on nodes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {chunks
                                      .slice()
                                      .sort((a, b) => a.index - b.index)
                                      .map((c) => (
                                        <tr key={`${f.fileId}-${c.chunkId}-${c.index}`}>
                                          <td className="Mono TableCellIndex">{c.index}</td>
                                          <td className="Mono Small TableCellChunkId">{c.chunkId}</td>
                                          <td className="TableCellReplicas">
                                            {Array.isArray(c.replicas) ? (
                                              <div className="ReplicaCell">
                                                {c.replicas.map((r) => (
                                                  <span
                                                    key={r.url}
                                                    className={`ReplicaBadge ${r.present ? "ReplicaBadgeOn" : "ReplicaBadgeOff"}`}
                                                    title={r.url}
                                                  >
                                                    :{nodePortLabel(r.url)} {r.present ? "✓" : "✗"}
                                                  </span>
                                                ))}
                                              </div>
                                            ) : (
                                              <span className="Mono Small">
                                                {Array.isArray(c.nodes) ? c.nodes.join(", ") : "-"}
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <div className="Muted">No chunk details available.</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="Card CardNodes">
            <h2>Storage nodes ({configuredNodes} configured)</h2>
            <table className="Table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => (
                  <tr key={n.url}>
                    <td>
                      <code>{n.url}</code>
                    </td>
                    <td>
                      <span className={`Pill ${n.healthy ? "PillOk" : "PillBad"}`}>{n.healthy ? "healthy" : "down"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="Muted" style={{ marginTop: 10 }}>
              Uploads need at least {rf} reachable nodes.
              {typeof storagePortMin === "number" && typeof storagePortMax === "number" ? (
                <> Node ports in this run: {storagePortMin}–{storagePortMax}.</>
              ) : (
                <> Default dev layout: ports 8081–{8080 + configuredNodes}.</>
              )}{" "}
              Deleting a chunk file under <code className="Mono">data/node*</code> shows as missing on the next disk scan
              (~2.5s).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
