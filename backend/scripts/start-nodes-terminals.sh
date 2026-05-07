#!/usr/bin/env bash
# Launch each storage node in its own terminal window (for fault-tolerance demos).
# Usage:
#   cd backend && npm run start:nodes:terminals
# Optional:
#   TERMINAL_EMULATOR=gnome-terminal  # force a specific launcher (see list below)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="$ROOT_DIR/backend/storage-node.js"

mkdir -p "$ROOT_DIR/data"

if [[ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]]; then
  :
else
  echo "[start-nodes-terminals] No DISPLAY/WAYLAND detected; use a desktop session or run: npm run start:nodes" >&2
  exit 1
fi

# gnome-terminal: use -- separately; run node then keep shell open on exit
launch_gnome_terminal() {
  local title="$1" i="$2" port="$3" data_dir="$4"
  gnome-terminal --title="$title" -- bash --noprofile --norc -c \
    "cd $(printf %q "$ROOT_DIR") && export PORT=$(printf %q "$port") DATA_DIR=$(printf %q "$data_dir") NODE_ID=$(printf %q "node$i") && \
     echo '=== $title ===' && echo \"PORT=\$PORT NODE_ID=\$NODE_ID\" && node $(printf %q "$APP") || true; \
     echo ''; read -r -p 'Node stopped. Press Enter to close...' _"
}

launch_konsole() {
  local title="$1" i="$2" port="$3" data_dir="$4"
  konsole --title "$title" -e bash --noprofile --norc -c \
    "cd $(printf %q "$ROOT_DIR") && export PORT=$(printf %q "$port") DATA_DIR=$(printf %q "$data_dir") NODE_ID=$(printf %q "node$i") && \
     echo '=== $title ===' && node $(printf %q "$APP") || true; read -r -p 'Press Enter to close...' _"
}

launch_xfce4_terminal() {
  local title="$1" i="$2" port="$3" data_dir="$4"
  local inner
  inner="cd $(printf %q "$ROOT_DIR") && export PORT=$(printf %q "$port") DATA_DIR=$(printf %q "$data_dir") NODE_ID=$(printf %q "node$i") && \
     echo '=== $title ===' && node $(printf %q "$APP") || true; read -r -p 'Press Enter to close...' _"
  xfce4-terminal --title="$title" -e "bash --noprofile --norc -c $(printf %q "$inner")"
}

launch_xterm() {
  local title="$1" i="$2" port="$3" data_dir="$4"
  xterm -title "$title" -e bash --noprofile --norc -c \
    "cd $(printf %q "$ROOT_DIR") && export PORT=$(printf %q "$port") DATA_DIR=$(printf %q "$data_dir") NODE_ID=$(printf %q "node$i") && \
     echo '=== $title ===' && node $(printf %q "$APP"); echo; read -r -p 'Press Enter to close...' _"
}

launch_alacritty() {
  local title="$1" i="$2" port="$3" data_dir="$4"
  alacritty --title "$title" -e bash --noprofile --norc -c \
    "cd $(printf %q "$ROOT_DIR") && export PORT=$(printf %q "$port") DATA_DIR=$(printf %q "$data_dir") NODE_ID=$(printf %q "node$i") && \
     echo '=== $title ===' && node $(printf %q "$APP") || true; read -r -p 'Press Enter to close...' _"
}

pick_launcher() {
  if [[ -n "${TERMINAL_EMULATOR:-}" ]]; then
    echo "$TERMINAL_EMULATOR"
    return
  fi
  for c in gnome-terminal konsole xfce4-terminal xterm alacritty kitty; do
    if command -v "$c" &>/dev/null; then
      echo "$c"
      return
    fi
  done
  echo ""
}

LAUNCHER="$(pick_launcher)"
if [[ -z "$LAUNCHER" ]]; then
  echo "[start-nodes-terminals] No supported terminal found. Install one of: gnome-terminal, konsole, xfce4-terminal, xterm, alacritty, kitty" >&2
  echo "Or set TERMINAL_EMULATOR to the full command name." >&2
  exit 1
fi

echo "[start-nodes-terminals] Using terminal: $LAUNCHER"
echo "[start-nodes-terminals] Opening 5 windows (ports 8081–8085). Close a window to kill that node."

for i in $(seq 1 5); do
  port=$((8080 + i))
  data_dir="$ROOT_DIR/data/node$i"
  mkdir -p "$data_dir"
  title="Storage node$i :$port"

  case "$LAUNCHER" in
    gnome-terminal) launch_gnome_terminal "$title" "$i" "$port" "$data_dir" ;;
    konsole)       launch_konsole "$title" "$i" "$port" "$data_dir" ;;
    xfce4-terminal) launch_xfce4_terminal "$title" "$i" "$port" "$data_dir" ;;
    xterm)         launch_xterm "$title" "$i" "$port" "$data_dir" ;;
    alacritty)     launch_alacritty "$title" "$i" "$port" "$data_dir" ;;
    kitty)
      kitty --title "$title" -d "$ROOT_DIR" bash --noprofile --norc -c \
        "export PORT=$(printf %q "$port") DATA_DIR=$(printf %q "$data_dir") NODE_ID=$(printf %q "node$i") && \
         echo '=== $title ===' && node $(printf %q "$APP") || true; read -r -p 'Press Enter to close...' _"
      ;;
    *)
      echo "[start-nodes-terminals] Unsupported TERMINAL_EMULATOR=$LAUNCHER" >&2
      exit 1
      ;;
  esac
  sleep 0.15
done

echo "[start-nodes-terminals] Done. Start the master in another terminal: cd backend && npm run dev"
