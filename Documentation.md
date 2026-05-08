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
