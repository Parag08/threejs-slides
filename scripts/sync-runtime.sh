#!/usr/bin/env bash
# Copy the skill's runtime into every example deck (run after editing assets/runtime/).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
for d in "$ROOT"/examples/*/; do
  mkdir -p "$d/lib" && cp "$ROOT"/skills/threejs-slides/assets/runtime/* "$d/lib/" && echo "synced $d"
done
