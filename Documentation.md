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
