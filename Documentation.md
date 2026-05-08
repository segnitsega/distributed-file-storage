# Distributed File Sharing System Documentation
## Table of Contents

1. Introduction  
2. Problem Statement and Objectives  
   - 2.1 Problem Statement  
   - 2.2 Core Objectives  
   - 2.3 Non-Goals  
3. System Overview  
   - 3.1 Key Runtime Defaults  
   - 3.2 Primary APIs  
4. High-Level Architecture  
   - 4.1 Logical Diagram  
   - 4.2 Communication Pattern  
   - 4.3 Why This Architecture Works  
5. Design Principles  
6. Distributed Systems Concepts Mapping  
   - 6.1 Replication Model  
   - 6.2 Fault Tolerance Model  
   - 6.3 Consistency Model  
   - 6.4 Synchronization and Coordination  
   - 6.5 Availability and Partition Tolerance  
   - 6.6 Failure Modes and Recovery Behavior  
   - 6.7 Durability and Data Integrity  
   - 6.8 Scalability Characteristics  
7. Component Documentation  
   - 7.1 Master Node  
   - 7.2 Storage Node  
   - 7.3 Frontend  
8. Data Model and Metadata Design  
   - 8.1 Metadata File  
   - 8.2 Schema  
   - 8.3 Metadata Lifecycle  
   - 8.4 Chunk Identity  
9. Detailed API Documentation  
   - 9.1 `GET /nodes/status`  
   - 9.2 `GET /files`  
   - 9.3 `POST /upload`  
   - 9.4 `GET /download/:fileId`  
   - 9.5 `DELETE /files/:fileId`  
10. End-to-End Workflows  
      - 10.1 Upload Workflow  
      - 10.2 Download Workflow  
      - 10.3 Delete Workflow  
11. Fault Tolerance and Reliability  
      - 11.1 Node Health Monitoring  
      - 11.2 Replica Retry on Read  
      - 11.3 Upload Admission Control  
      - 11.4 Best-Effort Rollback  
      - 11.5 Persistence Safety  
12. Environment Variables and Configuration  
      - 12.1 Master Variables  
      - 12.2 Storage Node Variables  
      - 12.3 Frontend Configuration  
13. Setup and Installation Guide  
      - 13.1 Prerequisites  
      - 13.2 Install Dependencies  
      - 13.3 Create Data Directories  
14. Running the System (Windows and Linux/macOS)  
      - 14.1 Linux/macOS Commands  
      - 14.2 Windows PowerShell Commands  
      - 14.3 Verification Checklist  
15. Frontend User Guide  
      - 15.1 Upload  
      - 15.2 Download  
      - 15.3 Delete  
      - 15.4 Node Status Interpretation  
16. Observability and Operations  
      - 16.1 Logs  
      - 16.2 Operational Health Checks  
      - 16.3 Useful Manual Checks  
      - 16.4 Incident Handling Basics  
17. Performance and Scalability Notes  
      - 17.1 Current Behavior  
      - 17.2 Scaling Strategy  
      - 17.3 Potential Bottlenecks  
      - 17.4 Optimization Ideas  
      - 17.5 Capacity Planning Guidance  
      - 17.6 Performance Measurement Plan  
18. Security Considerations  
      - 18.1 Implemented Safeguards  
      - 18.2 Security Gaps  
      - 18.3 Recommended Hardening  
19. Testing Strategy  
      - 19.1 Existing Tests  
      - 19.2 Manual Test Cases  
      - 19.3 Automated Testing Suggestions  
      - 19.4 Example Test Matrix  
      - 19.5 Data Integrity Validation Procedure  
20. Deployment Guidance  
      - 20.1 Development Deployment  
      - 20.2 Multi-Host Deployment  
      - 20.3 Production Checklist  
      - 20.4 Containerization Blueprint  
      - 20.5 Backup and Restore Strategy  
      - 20.6 Zero-Downtime Improvement Path  
21. Known Limitations  
      - 21.1 Operational Risk Notes  
22. Future Enhancements  
      - 22.1 Reliability  
      - 22.2 Security  
      - 22.3 Performance  
      - 22.4 Product Features  
      - 22.5 Architectural Evolution Roadmap  
23. Appendix (Examples and Quick Reference)
      - 23.1 Quick API cURL Examples  
      - 23.2 Example Metadata Record  
      - 23.3 Quick Troubleshooting Table  
      - 23.4 Quick Command Reference  
      - 23.5 Deep Technical Appendix  

---
## 1) Introduction

This project implements a **distributed file sharing/storage system** that stores uploaded files as fixed-size chunks across multiple storage nodes. Instead of saving one complete file in one location, the master server splits each file into parts and replicates each part across multiple storage nodes. This approach improves reliability and provides a foundation for scaling out storage capacity.

The system contains two major layers:

- A **backend layer** composed of:
  - One **Master Node** (orchestrator, metadata owner, API gateway)
  - Multiple **Storage Nodes** (chunk persistence and retrieval)
- A **frontend layer**:
  - A React web application for upload/download/delete and node health visibility

The implementation focuses on simplicity and educational clarity while still including core distributed system behaviors such as health checks, replication, and retry logic.

---
## 2) Problem Statement and Objectives

### 2.1 Problem Statement

Traditional single-server file storage systems can fail if that server becomes unavailable. They also become difficult to scale as storage and traffic grow. The project addresses this by distributing file chunks across independent storage nodes and keeping replicas to survive node failures.

### 2.2 Core Objectives

1. Allow users to upload and download files through a single master endpoint.
2. Split files into fixed-size chunks for easier distribution.
3. Store each chunk on more than one storage node (replication).
4. Maintain metadata mapping file IDs to chunk IDs and their node locations.
5. Track node health and avoid unhealthy nodes during uploads.
6. Retry alternate replicas during download if a node is unavailable.
7. Provide a simple frontend for operational visibility and user actions.

### 2.3 Non-Goals (Current Version)

- User authentication/authorization
- End-to-end encryption at rest
- Dynamic rebalancing and self-healing replication repair
- Multi-master metadata service
- Cloud-native orchestration (Kubernetes) out of the box

---

## 3) System Overview

The system uses a **master-worker architecture**:

- The **Master Node** receives upload requests, splits files into 1 MB chunks, replicates chunks to storage nodes, and records metadata.
- **Storage Nodes** are lightweight HTTP services storing binary chunk files in local directories.
- The **Frontend** communicates only with the master API and does not interact directly with storage nodes.

### 3.1 Key Runtime Defaults

- Master port: `8080`
- Storage ports: `8081`, `8082`, `8083` (default list)
- Chunk size: `1 MB`
- Replication factor: `2`
- Health check interval: `5 seconds`

### 3.2 Primary APIs

- Upload file: `POST /upload`
- Download file: `GET /download/:fileId`
- List files: `GET /files`
- Delete file: `DELETE /files/:fileId`
- Nodes status: `GET /nodes/status`
- Storage node health: `GET /health`

---

## 4) High-Level Architecture

### 4.1 Logical Diagram (Text)

User Browser (React UI)  
-> Master Node (Express API + Metadata + Chunk Orchestration)  
-> Storage Node A (chunk files)  
-> Storage Node B (chunk files)  
-> Storage Node C (chunk files)

During upload, each chunk is written to two nodes. During download, the master fetches chunks in order and tries replicas if needed.

### 4.2 Communication Pattern

- Frontend <-> Master: JSON APIs + file upload form data + download stream
- Master <-> Storage Nodes: HTTP binary chunk transfer (`PUT`, `GET`, `DELETE`)
- Master <-> Metadata: local JSON file (`metadata.json`)

### 4.3 Why This Architecture Works

- Centralized metadata simplifies request routing.
- Decentralized chunk storage reduces single-point data concentration.
- Replication improves read availability when one node fails.
- HTTP makes components easy to run and test independently.

---

## 5) Design Principles

1. **Simplicity first**: clear, understandable code path for educational and project use.
2. **Loose coupling**: storage nodes expose minimal APIs and stay stateless about file-level context.
3. **Deterministic chunk IDs**: SHA-256 hash per chunk.
4. **Fail-soft behavior**: graceful handling when some nodes are down.
5. **Operational visibility**: health status endpoint and UI node status panel.
6. **Safe persistence writes**: metadata and chunks are written via temporary file and rename strategy.

---

## 6) Distributed Systems Concepts Mapping

This section explicitly maps core distributed systems theory to the behavior of the current implementation.

### 6.1 Replication Model

The system uses **synchronous write replication at application level** for each chunk:

- Replication factor is fixed at `2`.
- During upload, a chunk is written to two selected healthy nodes before considering that chunk successful.
- Metadata stores chunk replica locations (`nodes[]`) and retrieval order is driven by this mapping.

Implications:

- Better read availability under single-node failures.
- Higher write cost (`2x` chunk writes).
- No background repair yet when replicas are degraded.

### 6.2 Fault Tolerance Model

Fault tolerance is achieved through:

- Redundant chunk placement (replicas).
- Continuous health checks every 5 seconds.
- Excluding unhealthy nodes from new writes.
- Replica fallback during reads.

Current tolerance level:

- Tolerates failure of one replica node for a chunk (if the second replica remains available).
- Cannot tolerate loss of both replica locations for the same chunk.

### 6.3 Consistency Model

The current system follows a **single-writer metadata model** with practical, operation-level consistency:

- Master is the only metadata writer.
- On successful upload, metadata is written after chunk replicas are stored.
- Reads are consistent with the metadata currently on disk.

This behaves close to **read-after-write consistency** for successful operations through the same master instance, but it is not a formally distributed consensus-backed strong consistency system.

Potential inconsistency windows:

- Partial upload failure before cleanup completes.
- Chunk state and metadata divergence during crash scenarios.

### 6.4 Synchronization and Coordination

Synchronization is lightweight and centralized in the master:

- Node health is synchronized through periodic heartbeat-style polling (`/health`).
- Replica placement uses a shared round-robin index in master process memory.
- Chunk ordering is coordinated by metadata `index` during download reconstruction.

Because there is only one master instance in this version, no inter-master synchronization protocol (like Raft/Zab/Paxos) is needed yet.

### 6.5 Availability and Partition Tolerance

From a CAP perspective:

- The design prefers **availability for reads** when at least one chunk replica remains reachable.
- Upload availability is intentionally reduced when healthy nodes are fewer than replication factor to prevent under-replicated writes.
- Under network partition, behavior depends on which components remain reachable from the master.

In short:

- Read path: best-effort availability with replica retry.
- Write path: safety-first admission control (requires enough healthy nodes).

### 6.6 Failure Modes and Recovery Behavior

Typical failure modes and distributed behavior:

1. **One storage node down**  
   - New uploads can continue if at least two healthy nodes remain.
   - Downloads succeed if each chunk still has one reachable replica.

2. **Two storage nodes down**  
   - Uploads fail with `503`.
   - Downloads may fail if required replicas are unavailable.

3. **Master restart**  
   - Metadata reloads from `metadata.json`.
   - Cluster resumes without reindexing.

4. **Metadata loss/corruption**  
   - Chunk files may exist but logical file mapping is lost.
   - Requires backup-based recovery.

### 6.7 Durability and Data Integrity

Durability mechanisms:

- Chunk writes: temp file then rename on storage node.
- Metadata writes: temp file then rename on master.
- Chunk IDs derived from SHA-256 hash of bytes (content-derived identity).

Integrity note:

- End-to-end file integrity can be validated by comparing source and downloaded SHA-256 hashes.

### 6.8 Scalability Characteristics

Horizontal scaling exists only for storage capacity and IO at storage-node layer:

- Add nodes and include them in `STORAGE_NODES`.
- Master remains centralized and becomes the main coordination bottleneck.

Scalability roadmap for full distributed maturity:

- External metadata store.
- Multi-master architecture with consensus.
- Automated rebalance and replica repair.

---

## 7) Component Documentation

### 7.1 Master Node (`backend/master.js`)

The master node performs orchestration and serves as the system control plane.

#### Responsibilities

- Accept file uploads with `multer` memory storage.
- Split uploaded file buffer into 1 MB chunks.
- Compute SHA-256 chunk ID for every chunk.
- Select replica nodes from currently healthy nodes.
- Upload chunk replicas in parallel.
- Persist file metadata to disk.
- Serve download stream by reconstructing ordered chunks.
- Delete file metadata and request chunk replica deletion.
- Maintain node health map with periodic pings.

#### Internal Data Structures

- `metadata.files[fileId]` -> file metadata object
- `nodeHealth` map -> `{ healthy, lastCheckedAt, lastError }`

#### Important Constants

- `CHUNK_SIZE_BYTES = 1MB`
- `REPLICATION_FACTOR = 2`
- `HEALTH_PING_INTERVAL_MS = 5000`

### 7.2 Storage Node (`backend/storage-node.js`)

Storage nodes provide chunk-level durability.

#### Responsibilities

- Validate chunk ID format (`64 hex chars`)
- Save chunk binary payload to local file
- Stream chunk back to caller
- Delete chunk file
- Report health (`/health`)

#### File Write Safety

Chunk writes use temp files followed by rename. This reduces risk of exposing partial files if write is interrupted.

### 7.3 Frontend (`frontend/src/App.js`)

The React UI gives a minimal but useful operator interface.

#### Features

- Select and upload a file.
- List uploaded files with:
  - Name
  - File ID
  - Size
  - Chunk count
- Download file by ID.
- Delete file by ID.
- Display healthy vs total storage node count.
- Auto-refresh files and node status every 5 seconds.

#### UX Behavior Notes

- Upload button disabled when no file selected.
- Errors shown in a visible error panel.
- Manual refresh button available in addition to polling.

---

## 8) Data Model and Metadata Design

### 8.1 Metadata File

Path default: `backend/metadata.json`  
Override with: `METADATA_PATH`

### 8.2 Schema (Conceptual)

```json
{
  "files": {
    "<fileId>": {
      "fileName": "example.pdf",
      "sizeBytes": 1234567,
      "createdAt": "2026-05-07T20:00:00.000Z",
      "chunks": [
        {
          "index": 0,
          "chunkId": "<sha256hex>",
          "nodes": ["http://localhost:8081", "http://localhost:8082"]
        }
      ]
    }
  }
}
```

### 8.3 Metadata Lifecycle

- Created/updated after successful upload.
- Read during list/download/delete operations.
- Updated after delete completion.
- Stored on local disk, not a separate database.

### 8.4 Chunk Identity

Each chunk ID is SHA-256 digest of chunk bytes. This gives content-based identifiers and strict naming compatibility.

---
## 9) Detailed API Documentation

Base URL (master): `http://localhost:8080`

### 9.1 `GET /nodes/status`

Returns health snapshot of configured storage nodes.

#### Response (200)

```json
{
  "nodes": [
    {
      "url": "http://localhost:8081",
      "healthy": true,
      "lastCheckedAt": 1746650000000
    }
  ],
  "checkedEveryMs": 5000
}
```

### 9.2 `GET /files`

Lists uploaded files known to metadata.

#### Response (200)

```json
{
  "files": [
    {
      "fileId": "uuid",
      "fileName": "sample.txt",
      "sizeBytes": 1200,
      "chunkCount": 1,
      "createdAt": "2026-05-07T21:00:00.000Z"
    }
  ]
}
```

### 9.3 `POST /upload`

Uploads a file in multipart/form-data under field name `file`.

#### Request

- Content type: `multipart/form-data`
- Field: `file`

#### Success Response (201)

```json
{
  "fileId": "uuid",
  "fileName": "archive.zip",
  "sizeBytes": 5340000,
  "chunkCount": 6
}
```

#### Common Errors

- `400`: missing `file` field
- `503`: not enough healthy nodes for replication
- `500`: chunk distribution failure

### 9.4 `GET /download/:fileId`

Returns binary stream with `Content-Disposition` filename attachment.

#### Success

- Status: `200`
- Content type: `application/octet-stream`

#### Errors

- `404`: file ID not found
- `500`: chunk retrieval failure (all replicas failed for a required chunk)

### 9.5 `DELETE /files/:fileId`

Deletes metadata and requests replica chunk deletion.

#### Success Response (200)

```json
{
  "ok": true,
  "fileId": "uuid",
  "chunkDeletesAttempted": 8,
  "chunkDeletesFailed": 0
}
```

#### Error

- `404`: file not found

---

## 10) End-to-End Workflows

### 10.1 Upload Workflow

1. User selects file in UI and submits.
2. Frontend sends multipart request to `/upload`.
3. Master verifies enough healthy nodes (`>= 2`).
4. Master generates `fileId` (UUID).
5. File is split into 1 MB chunks.
6. For each chunk:
   - Compute SHA-256 `chunkId`
   - Pick two healthy nodes (round robin)
   - Upload chunk to both nodes in parallel
7. Master stores metadata for file and chunks.
8. Master returns upload result to frontend.
9. UI refreshes file list and node status.

### 10.2 Download Workflow

1. User clicks download for a file.
2. Browser requests `/download/:fileId`.
3. Master loads file metadata and sets download headers.
4. For each chunk (ordered by index):
   - Try replica node 1 if healthy
   - If failed, try replica node 2
   - Write chunk bytes to response stream
5. Master ends stream after final chunk.
6. Browser saves file using server filename header.

### 10.3 Delete Workflow

1. User clicks delete.
2. Frontend sends `DELETE /files/:fileId`.
3. Master reads chunk list from metadata.
4. Master issues replica chunk delete requests.
5. Master removes file from metadata.
6. Response includes delete attempts and failures.

---

## 11) Fault Tolerance and Reliability

### 11.1 Node Health Monitoring

- Master pings `/health` on each storage node every 5 seconds.
- Health map is used by upload and download paths.
- Unhealthy nodes are excluded from upload replica selection.

### 11.2 Replica Retry on Read

During download, if one replica fetch fails, master attempts the other replica. This protects reads from single-node failures when at least one replica remains available.

### 11.3 Upload Admission Control

If fewer than replication-factor healthy nodes exist, uploads are rejected with `503` to avoid under-replicated data.

### 11.4 Best-Effort Rollback

If upload fails after some chunks were already stored, master attempts cleanup by deleting uploaded replicas for chunks recorded so far.

### 11.5 Persistence Safety

- Metadata writes: write temporary JSON file then rename.
- Chunk writes: write temporary chunk file then rename.

This lowers corruption risk versus direct overwrite writes.

---

## 12) Environment Variables and Configuration

### 12.1 Master Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Master service port |
| `STORAGE_NODES` | `http://localhost:8081,http://localhost:8082,http://localhost:8083` | Comma-separated storage node URLs |
| `METADATA_PATH` | `backend/metadata.json` | Metadata JSON file path |
| `MAX_UPLOAD_BYTES` | `1073741824` (1 GB) | Maximum upload size |

### 12.2 Storage Node Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8081` | Storage node port |
| `DATA_DIR` | `data/node-<PORT>` | Chunk storage directory |
| `NODE_ID` | `node-<PORT>` | Node identifier for logs |

### 12.3 Frontend Configuration

- `frontend/package.json` uses `"proxy": "http://localhost:8080"`.
- Frontend expects master API accessible on localhost port 8080 in development.

---
## 13) Setup and Installation Guide

### 13.1 Prerequisites

- Node.js 18+ recommended (for native `fetch` in backend)
- npm 9+ recommended
- 5 terminals (3 storage nodes + 1 master + 1 frontend)
- Available ports: `3000`, `8080`, `8081`, `8082`, `8083`

### 13.2 Install Dependencies

From project root:

```bash
cd backend
npm install
cd ../frontend
npm install
```

### 13.3 Create Data Directories (Optional)

Storage nodes can create directories automatically, but you can pre-create:

```bash
mkdir -p data/node1 data/node2 data/node3
```

On Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force data/node1, data/node2, data/node3
```

---

## 14) Running the System (Windows and Linux/macOS)

### 14.1 Linux/macOS Commands

Terminal 1:

```bash
PORT=8081 DATA_DIR=./data/node1 NODE_ID=node1 node backend/storage-node.js
```

Terminal 2:

```bash
PORT=8082 DATA_DIR=./data/node2 NODE_ID=node2 node backend/storage-node.js
```

Terminal 3:

```bash
PORT=8083 DATA_DIR=./data/node3 NODE_ID=node3 node backend/storage-node.js
```

Terminal 4:

```bash
node backend/master.js
```

Terminal 5:

```bash
cd frontend
npm start
```

### 14.2 Windows PowerShell Commands

Terminal 1:

```powershell
$env:PORT="8081"; $env:DATA_DIR="./data/node1"; $env:NODE_ID="node1"; node .\backend\storage-node.js
```

Terminal 2:

```powershell
$env:PORT="8082"; $env:DATA_DIR="./data/node2"; $env:NODE_ID="node2"; node .\backend\storage-node.js
```

Terminal 3:

```powershell
$env:PORT="8083"; $env:DATA_DIR="./data/node3"; $env:NODE_ID="node3"; node .\backend\storage-node.js
```

Terminal 4:

```powershell
node .\backend\master.js
```

Terminal 5:

```powershell
cd .\frontend
npm start
```

### 14.3 Verification Checklist

1. Open `http://localhost:3000`
2. Confirm node health card shows 3 healthy nodes
3. Upload a small file
4. Confirm file appears in list
5. Download and verify content
6. Delete file and confirm list update

---
## 15) Frontend User Guide

### 15.1 Upload

- Click file input and select file.
- Click **Upload**.
- Wait for file list refresh.

### 15.2 Download

- Locate desired file row.
- Click **Download**.
- Browser downloads from master endpoint.

### 15.3 Delete

- Click **Delete** on target file row.
- UI refreshes list on success.

### 15.4 Node Status Interpretation

- Green status: healthy node reachable by master.
- Red status: master cannot reach node.
- Uploads require at least 2 healthy nodes.

---

## 16) Observability and Operations

### 16.1 Logs

Current logging is console-based:

- Master logs startup and configured storage URLs.
- Storage node logs startup with node ID and data directory.

### 16.2 Operational Health Checks

- Node-level: `GET http://localhost:8081/health`
- System-level: `GET http://localhost:8080/nodes/status`

### 16.3 Useful Manual Checks

- Verify metadata file updates after upload/delete.
- Verify chunk files created in each node data directory.
- Stop one node and test download fallback behavior.

### 16.4 Incident Handling Basics

If uploads fail:

1. Check `/nodes/status`
2. Ensure at least 2 healthy nodes
3. Verify port conflicts are not present
4. Verify storage node processes are running

---

## 17) Performance and Scalability Notes

### 17.1 Current Behavior

- Chunking allows large-file handling in bounded unit operations.
- Replication doubles write operations per chunk.
- Download reconstructs chunks sequentially.

### 17.2 Scaling Strategy

1. Start additional storage node instances.
2. Include their URLs in `STORAGE_NODES`.
3. Restart master with new configuration.

### 17.3 Potential Bottlenecks

- Master is a centralized control/data routing point.
- Metadata in local JSON file is not ideal for high concurrency.
- Upload buffering in memory (`multer.memoryStorage`) can limit very large-file throughput.

### 17.4 Optimization Ideas

- Stream upload chunking instead of full in-memory buffer.
- Move metadata to persistent DB (PostgreSQL, Redis, etc.).
- Add replication repair worker for unhealthy replica replacement.
- Add caching for frequently downloaded chunk metadata.

### 17.5 Capacity Planning Guidance

For class projects and demos, the current defaults are acceptable. For larger testing and realistic usage, estimate resource requirements before deployment.

#### Storage Capacity Estimate

Because replication factor is 2, raw storage used in nodes is approximately:

`Total Stored Bytes ~= Uploaded Bytes x 2`

Example:

- User data uploaded: `100 GB`
- Replica factor: `2`
- Required total node disk (excluding metadata/log overhead): `~200 GB`

Add at least 20-30% free space headroom for safe operation and temporary files.

#### Memory Capacity Estimate (Current Upload Model)

Uploads are handled in memory (`multer.memoryStorage`), so per-upload memory usage is roughly equal to file size plus processing overhead.

If multiple large uploads happen simultaneously, RAM pressure rises quickly. This is the strongest reason to move to stream-based ingestion for production.

#### Throughput Estimate

Upload throughput is constrained by:

1. Master read speed and chunking overhead
2. Network speed from master to storage nodes
3. Disk write performance at each storage node
4. Replication factor (writes multiplied by replica count)

Download throughput is constrained by:

1. Sequential chunk retrieval from replicas
2. Network from storage nodes to master
3. Master response stream speed to client

---

### 17.6 Performance Measurement Plan (Recommended)

To report performance in an academic or project report, use a repeatable method:

1. Prepare test files: 1 MB, 10 MB, 100 MB, 500 MB
2. Run each test 5 times and average results
3. Measure:
   - upload latency
   - download latency
   - delete latency
   - success/failure count under node failure
4. Repeat with:
   - all nodes healthy
   - one node down
5. Record node CPU, memory, and disk usage

Suggested report table:

| File Size | Upload Avg (ms) | Download Avg (ms) | Delete Avg (ms) | Nodes Healthy | Notes |
|---|---:|---:|---:|---|---|
| 1 MB | - | - | - | 3/3 | baseline |
| 10 MB | - | - | - | 3/3 | baseline |
| 100 MB | - | - | - | 3/3 | baseline |
| 100 MB | - | - | - | 2/3 | one node down |

---
## 18) Security Considerations

### 18.1 Implemented Safeguards

- Chunk ID validation on storage nodes prevents path traversal.
- File size upload limit via `MAX_UPLOAD_BYTES`.
- CORS middleware enabled for frontend development.
- Temporary-file write pattern reduces incomplete write exposure.

### 18.2 Security Gaps (Current)

- No authentication and authorization.
- No transport encryption (plain HTTP).
- No malware scanning or file type restriction.
- No rate limiting or abuse protection.
- No signed URLs or access control on downloads/deletes.

### 18.3 Recommended Hardening

1. Add JWT/session authentication.
2. Add role-based authorization for delete/admin actions.
3. Enable HTTPS with reverse proxy (Nginx/Caddy).
4. Add request throttling and per-IP upload controls.
5. Add audit logs for upload/download/delete events.

---

## 19) Testing Strategy

### 19.1 Existing Tests

- Frontend includes CRA test scaffold and testing-library dependencies.
- Current default test file may require update to match current UI text.

### 19.2 Manual Test Cases

1. Upload small text file and verify download integrity.
2. Upload file larger than 1 MB and verify chunk count > 1.
3. Stop one storage node and verify:
   - Existing file download still works (if replica available)
   - New uploads fail if healthy nodes < 2
4. Delete file and verify chunk file cleanup.
5. Restart master and verify metadata persistence.

### 19.3 Automated Testing Suggestions

- Unit tests:
  - chunking utility
  - node selection logic
  - metadata load/save behavior
- Integration tests:
  - upload->download->delete full flow
  - failure injection (node down)
- Frontend tests:
  - upload form interaction
  - file list rendering
  - error UI rendering

### 19.4 Example Test Matrix

| Test ID | Category | Scenario | Expected Result |
|---|---|---|---|
| T-01 | Upload | Upload small file (<1 MB) | Success, 1 chunk, 2 replicas |
| T-02 | Upload | Upload medium file (5 MB) | Success, multiple chunks, metadata saved |
| T-03 | Upload | Missing file field | HTTP 400 |
| T-04 | Upload | Only 1 healthy node | HTTP 503 |
| T-05 | Download | Download existing file, all nodes healthy | Full file returned correctly |
| T-06 | Download | One replica node down | Download succeeds via alternate replica |
| T-07 | Download | File ID not found | HTTP 404 |
| T-08 | Delete | Delete existing file | Metadata removed, chunk deletion attempted |
| T-09 | Delete | Delete already deleted file | HTTP 404 |
| T-10 | Node API | Invalid chunk ID format | HTTP 400 on storage node |

### 19.5 Data Integrity Validation Procedure

For stronger verification in documentation/report:

1. Before upload, compute source file SHA-256 hash.
2. Upload and then download same file.
3. Compute SHA-256 hash of downloaded file.
4. Compare both hashes.

If hashes match, end-to-end integrity is confirmed for that test case.

---
## 20) Deployment Guidance

### 20.1 Development Deployment

- Run all services on one machine with separate ports.
- Use frontend development server proxy to master.

### 20.2 Multi-Host Deployment (Simple)

1. Deploy storage nodes on separate hosts.
2. Expose each storage node on reachable URL.
3. Set master `STORAGE_NODES` to those URLs.
4. Expose master behind reverse proxy.
5. Serve frontend build as static assets.

### 20.3 Production Checklist

- Process management (PM2/systemd/container runtime)
- HTTPS termination
- Centralized logs
- Health monitoring and alerting
- Metadata backup strategy
- Firewall rules for internal node traffic

### 20.4 Containerization Blueprint

This project can be containerized into:

- 1 container: master
- N containers: storage nodes
- 1 container: frontend static build or dev server

Recommended network model:

- Internal network for master <-> storage nodes
- External access only to frontend and master API gateway
- Restrict direct storage node exposure unless required

Volume mapping:

- Master volume: metadata file persistence
- Storage node volumes: chunk directories

### 20.5 Backup and Restore Strategy

Current system requires two layers of backup:

1. `metadata.json` backup (master index)
2. Node chunk directory backup

Restore order:

1. Restore chunk directories to storage nodes.
2. Restore `metadata.json` on master.
3. Start services and validate with random file downloads.

If metadata and chunk data are inconsistent, some downloads may fail.

### 20.6 Zero-Downtime Improvement Path

Current version is not fully zero-downtime ready. A practical roadmap:

1. Introduce load balancer in front of master replicas.
2. Move metadata to shared transactional data store.
3. Use rolling restart for storage nodes.
4. Add health/readiness checks to deployment platform.

---
