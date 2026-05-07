#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="$ROOT_DIR/backend/storage-node.js"

mkdir -p "$ROOT_DIR/data"

pids=()

cleanup() {
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

for i in $(seq 1 5); do
  port=$((8080 + i))
  data_dir="$ROOT_DIR/data/node$i"
  mkdir -p "$data_dir"

  echo "[start-nodes] starting node$i on :$port (dir: $data_dir)"
  PORT="$port" DATA_DIR="$data_dir" NODE_ID="node$i" node "$APP" &
  pids+=("$!")
done

echo "[start-nodes] started ${#pids[@]} nodes (8081-8085). Ctrl+C to stop."
wait

