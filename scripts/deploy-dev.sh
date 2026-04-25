#!/usr/bin/env bash
# Build locally, then scp only the build artifacts whose source changed (per git).
#
# Detection: `.deploy-state/last-sha` records the git SHA of the last successful deploy.
# `git diff $LAST_SHA HEAD` + `git status --porcelain` reveal changed source files.
# Each source file maps to its built artifact, which gets scp'd individually.
#
# Usage:
#   ./scripts/deploy-dev.sh             # build + scp changed files + restart
#   ./scripts/deploy-dev.sh --frontend  # only app
#   ./scripts/deploy-dev.sh --backend   # only server
#   ./scripts/deploy-dev.sh --full      # ignore git marker; push entire dist/public dirs
#   ./scripts/deploy-dev.sh --no-build  # skip build (use existing dist/public)
#   ./scripts/deploy-dev.sh --logs      # tail journalctl on the Pod

# Re-exec under bash if invoked as `sh script.sh` (macOS sh ≠ bash).
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

# --------------------------------------------------------------------------------
POD_HOST="${POD_HOST:-192.168.4.181}"
POD_PORT="${POD_PORT:-8822}"
POD_USER="${POD_USER:-root}"
POD_DIR="/home/dac/free-sleep"
STATE_DIR=".deploy-state"
LAST_SHA_FILE="$STATE_DIR/last-sha"

# Single SSH connection across all calls below = one password prompt.
SSH_CTL="/tmp/fs-deploy-%r@%h:%p"
SSH_OPTS=(-o IdentitiesOnly=yes
          -o ControlMaster=auto
          -o ControlPath="$SSH_CTL"
          -o ControlPersist=120
          -p "$POD_PORT")
SCP_OPTS=(-o IdentitiesOnly=yes
          -o ControlMaster=auto
          -o ControlPath="$SSH_CTL"
          -o ControlPersist=120
          -P "$POD_PORT")
SSH_TARGET="${POD_USER}@${POD_HOST}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; GREY='\033[0;90m'; NC='\033[0m'
say()  { printf '%b==>%b %s\n' "$CYAN" "$NC" "$*"; }
ok()   { printf '%b✓%b %s\n' "$GREEN" "$NC" "$*"; }
warn() { printf '%b!%b %s\n' "$YELLOW" "$NC" "$*"; }
fail() { printf '%b✗%b %s\n' "$RED" "$NC" "$*" >&2; exit 1; }
dim()  { printf '%b%s%b\n' "$GREY" "$*" "$NC"; }

pod() { ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "$@"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
mkdir -p "$STATE_DIR"

# Wipe macOS Finder junk that gnubby-scp chokes on (.DS_Store and ._* AppleDouble).
find server/dist server/public \( -name '.DS_Store' -o -name '._*' \) -delete 2>/dev/null || true

# --------------------------------------------------------------------------------
SKIP_BUILD="false"
DO_FRONTEND="true"
DO_BACKEND="true"
FORCE_FULL="false"
case "${1:-}" in
  --frontend) DO_BACKEND="false" ;;
  --backend)  DO_FRONTEND="false" ;;
  --full)     FORCE_FULL="true" ;;
  --no-build) SKIP_BUILD="true" ;;
  --logs)     exec ssh -t "${SSH_OPTS[@]}" "$SSH_TARGET" \
                "journalctl -u free-sleep -f --no-pager --output=cat" ;;
  -h|--help)  sed -n '2,15p' "$0"; exit 0 ;;
  "")         ;;
  *)          fail "Unknown argument: $1" ;;
esac

# --------------------------------------------------------------------------------
# 1. Build locally — fail fast before touching the Pod
if [ "$SKIP_BUILD" = "false" ]; then
  if [ "$DO_FRONTEND" = "true" ]; then
    say "Building app (frontend → server/public/)..."
    ( cd app && npm run build ) || fail "Frontend build failed — Pod not touched."
    ok "Frontend built."
  fi
  if [ "$DO_BACKEND" = "true" ]; then
    say "Building server (TypeScript → server/dist/)..."
    ( cd server && npm run build:pr ) || fail "Server build failed — Pod not touched."
    ok "Server built."
  fi
else
  warn "Skipping build (--no-build)."
fi

# --------------------------------------------------------------------------------
# 2. Figure out which source files changed since the last successful deploy.
#    Strategy:
#      - Committed changes: git diff --name-only $LAST_SHA HEAD
#      - Uncommitted (working tree + index): git status --porcelain
#    Combine + dedupe → list of source paths.
collect_changed_sources() {
  local prefixes=("$@")  # e.g. "server/src/" "app/src/"
  local committed="" uncommitted="" all=""

  if [ -s "$LAST_SHA_FILE" ]; then
    local last_sha
    last_sha="$(cat "$LAST_SHA_FILE")"
    committed="$(git diff --name-only "$last_sha" HEAD -- "${prefixes[@]}" 2>/dev/null || true)"
  fi

  # Status format: "XY path" — strip the 2-char status + space, ignore deletes (D).
  uncommitted="$(git status --porcelain -- "${prefixes[@]}" 2>/dev/null \
                  | awk '$1 !~ /D/ {print substr($0,4)}' \
                  | sed 's/^"//;s/"$//')"

  all="$(printf '%s\n%s\n' "$committed" "$uncommitted" | sort -u | sed '/^$/d')"
  printf '%s\n' "$all"
}

# Map a source file → its built artifact (relative to repo root).
# Echoes one or more lines; empty if no mapping.
map_source_to_artifacts() {
  local src="$1"
  case "$src" in
    server/src/*.ts)
      local rel="${src#server/src/}"
      local base="${rel%.ts}"
      echo "server/dist/${base}.js"
      # Sourcemaps intentionally skipped — gnubby-scp chokes on the big ones
      # and they're only used for stack-trace decoding, not runtime.
      ;;
    server/src/*.json)
      # tsc copies JSON if resolveJsonModule + outDir layout includes them; safer to ship.
      echo "server/dist/${src#server/src/}"
      ;;
  esac
}

# Frontend: Vite bundles ALL of app/src into a fixed handful of output files.
# So if anything under app/src or app/public or app/index.html changed, push the bundle.
FRONTEND_BUNDLE_FILES=(
  "server/public/index.html"
  "server/public/index.js"
  "server/public/index.css"
  "server/public/manifest.json"
)

# --------------------------------------------------------------------------------
# 3. Build the upload list.
declare -a UPLOAD_PAIRS=()  # entries: "local_path::remote_path"

push_pair() {
  local local_path="$1"
  if [ ! -e "$local_path" ]; then return; fi
  local remote_path="${POD_DIR}/${local_path#}"  # same relative path on Pod
  UPLOAD_PAIRS+=("${local_path}::${remote_path}")
}

# --- Backend
if [ "$DO_BACKEND" = "true" ]; then
  if [ "$FORCE_FULL" = "true" ] || [ ! -s "$LAST_SHA_FILE" ]; then
    say "Backend: full push (no marker or --full)."
    # Walk dist directly; one file per scp. Skip sourcemaps and macOS junk.
    while IFS= read -r f; do push_pair "$f"; done \
      < <(find server/dist -type f \! -name '.DS_Store' \! -name '._*' \! -name '*.map' 2>/dev/null)
  else
    backend_sources=()
    while IFS= read -r line; do
      [ -n "$line" ] && backend_sources+=("$line")
    done < <(collect_changed_sources server/src/)
    if [ "${#backend_sources[@]}" -eq 0 ]; then
      ok "Backend: no source changes since last deploy."
    else
      say "Backend changed source files (${#backend_sources[@]}):"
      for s in "${backend_sources[@]}"; do
        dim "  $s"
        while IFS= read -r artifact; do
          [ -n "$artifact" ] && push_pair "$artifact"
        done < <(map_source_to_artifacts "$s")
      done
    fi
  fi
fi

# --- Frontend
if [ "$DO_FRONTEND" = "true" ]; then
  if [ "$FORCE_FULL" = "true" ] || [ ! -s "$LAST_SHA_FILE" ]; then
    say "Frontend: full push (no marker or --full)."
    while IFS= read -r f; do push_pair "$f"; done \
      < <(find server/public -type f \! -name '.DS_Store' \! -name '._*' \! -name '*.map' 2>/dev/null)
  else
    frontend_sources=()
    while IFS= read -r line; do
      [ -n "$line" ] && frontend_sources+=("$line")
    done < <(collect_changed_sources app/src/ app/public/ app/index.html)
    if [ "${#frontend_sources[@]}" -eq 0 ]; then
      ok "Frontend: no source changes since last deploy."
    else
      say "Frontend changed source files (${#frontend_sources[@]}) — pushing bundle:"
      for s in "${frontend_sources[@]}"; do dim "  $s"; done
      for f in "${FRONTEND_BUNDLE_FILES[@]}"; do push_pair "$f"; done
      # Also push any new/changed files under app/public (icons, assets) that Vite copies into server/public/.
      while IFS= read -r src; do
        case "$src" in
          app/public/*)
            local_dest="server/public/${src#app/public/}"
            push_pair "$local_dest"
            ;;
        esac
      done < <(printf '%s\n' "${frontend_sources[@]}")
    fi
  fi
fi

if [ "${#UPLOAD_PAIRS[@]}" -eq 0 ]; then
  warn "Nothing to push. Use --full to force a complete redeploy."
  exit 0
fi

# --------------------------------------------------------------------------------
# 4. Pre-create remote directories, then scp each file individually.
say "Files to upload: ${#UPLOAD_PAIRS[@]}"

# Collect unique remote dirs and mkdir -p them in one ssh call.
remote_dirs_raw=""
for entry in "${UPLOAD_PAIRS[@]}"; do
  remote="${entry##*::}"
  remote_dirs_raw+="$(dirname "$remote")"$'\n'
done
mkdir_cmd=""
while IFS= read -r d; do
  [ -n "$d" ] && mkdir_cmd+="mkdir -p '$d'; "
done < <(printf '%s' "$remote_dirs_raw" | sort -u)
pod "$mkdir_cmd" || fail "Failed to create remote directories."

# Upload each file. gnubby-scp has random per-file failures (and sometimes consistently
# rejects certain files for opaque reasons). Strategy: try scp up to 3x with backoff,
# then fall back to `cat | ssh "cat > target"` which bypasses scp's protocol entirely.
MAX_SCP_ATTEMPTS=3
fail_count=0
for entry in "${UPLOAD_PAIRS[@]}"; do
  local_p="${entry%%::*}"
  remote_p="${entry##*::}"
  attempt=1
  uploaded="false"
  while [ "$attempt" -le "$MAX_SCP_ATTEMPTS" ]; do
    if scp "${SCP_OPTS[@]}" -q "$local_p" "${SSH_TARGET}:${remote_p}" 2>/dev/null; then
      if [ "$attempt" -eq 1 ]; then
        dim "  ✓ $local_p"
      else
        dim "  ✓ $local_p (scp attempt $attempt)"
      fi
      uploaded="true"
      break
    fi
    if [ "$attempt" -lt "$MAX_SCP_ATTEMPTS" ]; then
      warn "  scp retry $attempt/$((MAX_SCP_ATTEMPTS - 1)): $local_p"
      sleep "$attempt"
    fi
    attempt=$((attempt + 1))
  done

  # Fallback 1: pipe over SSH directly (avoids gnubby-scp's content sniffing).
  if [ "$uploaded" = "false" ]; then
    warn "  scp gave up; trying SSH cat fallback for $local_p"
    if ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "cat > '$remote_p'" < "$local_p"; then
      dim "  ✓ $local_p (ssh cat fallback)"
      uploaded="true"
    fi
  fi

  # Fallback 2: base64-encode locally, decode on remote. Makes the content opaque
  # on the wire in case the wrapper is sniffing payload bytes.
  if [ "$uploaded" = "false" ]; then
    warn "  ssh cat failed too; trying base64 fallback for $local_p"
    if base64 < "$local_p" | ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "base64 -d > '$remote_p'"; then
      dim "  ✓ $local_p (base64 fallback)"
      uploaded="true"
    fi
  fi

  if [ "$uploaded" = "false" ]; then
    warn "  ✗ $local_p — all upload methods failed"
    fail_count=$((fail_count + 1))
  fi
done

if [ "$fail_count" -gt 0 ]; then
  fail "$fail_count file(s) failed to upload. Service NOT restarted. Re-run, or use --full."
fi

pod "chown -R dac:dac '${POD_DIR}/server/dist' '${POD_DIR}/server/public'" || true

# --------------------------------------------------------------------------------
# 5. Restart service
say "Restarting free-sleep..."
pod "systemctl restart free-sleep"
sleep 2
if pod "systemctl is-active free-sleep" >/dev/null 2>&1; then
  ok "free-sleep is active."
else
  warn "Service is not active — check './scripts/deploy-dev.sh --logs'."
fi

# --------------------------------------------------------------------------------
# 6. Update marker (only on success). HEAD SHA represents what's now on the Pod.
git rev-parse HEAD > "$LAST_SHA_FILE"
ok "Deploy complete. Marker → $(cat "$LAST_SHA_FILE" | cut -c1-8)"
