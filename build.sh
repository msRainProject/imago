#!/usr/bin/env bash
# Build the unified Hill Images binary.
#
# Pipeline:
#   1. Build the React frontend (npm run build → ../frontend/dist/)
#   2. Sync that dist into backend/web/dist/ so //go:embed picks it up
#   3. Cross-compile the Go binary for Linux AMD64 (or use $GOOS/$GOARCH)
#
# Usage:
#   ./build.sh                     # linux/amd64, default out: hill-images-linux
#   GOOS=darwin ./build.sh         # native mac build
#   ./build.sh hill-images-dev     # custom output name
#
# Result: a single self-contained binary. Drop it on a server with hill-images
# systemd unit + config.yaml + a writable data dir, and you're live — no
# nginx, no separate dist/ tree.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$HERE/frontend"
BACKEND_DIR="$HERE/backend"
EMBED_TARGET="$BACKEND_DIR/internal/web/dist"

# 1. Build the SPA.
echo "==> building frontend (npm run build)"
(cd "$FRONTEND_DIR" && npm run build)

# 2. Sync dist/ into backend/web/dist/ so //go:embed sees the latest files.
echo "==> syncing dist/ into backend/web/dist/ for embedding"
rm -rf "$EMBED_TARGET"
mkdir -p "$EMBED_TARGET"
cp -R "$FRONTEND_DIR/dist/." "$EMBED_TARGET/"

# 3. Cross-compile Go.
OUT="${1:-hill-images-linux}"
GOOS_VAL="${GOOS:-linux}"
GOARCH_VAL="${GOARCH:-amd64}"

echo "==> building Go binary ($GOOS_VAL/$GOARCH_VAL -> $OUT)"
(
  cd "$BACKEND_DIR"
  CGO_ENABLED=0 GOOS="$GOOS_VAL" GOARCH="$GOARCH_VAL" \
    go build -ldflags="-s -w" -o "$OUT" .
)

# 4. Print final size for sanity.
SIZE=$(du -h "$BACKEND_DIR/$OUT" | cut -f1)
echo "==> done. $OUT ($SIZE)"
echo "    Deploy with:"
echo "      rsync -av -e \"ssh -i ~/.ssh/mushan -o IdentitiesOnly=yes\" $HERE/scripts/install-media-deps.sh root@82.47.33.211:/home/www/hill-images/install-media-deps.sh"
echo "      ssh -i ~/.ssh/mushan -o IdentitiesOnly=yes root@82.47.33.211 'bash /home/www/hill-images/install-media-deps.sh'"
echo "      rsync -av -e \"ssh -i ~/.ssh/mushan -o IdentitiesOnly=yes\" $BACKEND_DIR/$OUT root@82.47.33.211:/home/www/hill-images/hill-images"
echo "      ssh -i ~/.ssh/mushan -o IdentitiesOnly=yes root@82.47.33.211 'systemctl restart hill-images'"
