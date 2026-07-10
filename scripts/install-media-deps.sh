#!/usr/bin/env bash
# Install and verify server-side media processing tools for Hill Images.
#
# Required by image processing:
#   ffmpeg         general transcode/compress pipeline
#   heif-convert   HEIC/HEIF color-safe normalization before WebP
#   dcraw          DNG/RAW normalization before WebP
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "This script must run as root. Re-run with sudo, or run it from a root SSH session." >&2
  exit 1
fi

if [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  . /etc/os-release
else
  echo "Cannot detect OS: /etc/os-release is missing." >&2
  exit 1
fi

case "${ID:-}" in
  debian|ubuntu)
    ;;
  *)
    if [[ " ${ID_LIKE:-} " != *" debian "* && " ${ID_LIKE:-} " != *" ubuntu "* ]]; then
      echo "Unsupported OS '${ID:-unknown}'. Install these packages manually: ffmpeg libheif-examples dcraw" >&2
      exit 1
    fi
    ;;
esac

export DEBIAN_FRONTEND=noninteractive

echo "==> installing media dependencies"
apt-get update
apt-get install -y ffmpeg libheif-examples dcraw

echo "==> verifying commands"
missing=0
for cmd in ffmpeg heif-convert dcraw; do
  if path="$(command -v "$cmd")"; then
    echo "ok: $cmd -> $path"
  else
    echo "missing: $cmd" >&2
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

echo "==> media dependencies are ready"
