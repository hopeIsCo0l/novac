#!/usr/bin/env bash
# Regenerates the PNG app icons from icons/icon.svg using headless Chrome.
# Usage: bash tools/make-icons.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHROME="${CHROME:-google-chrome}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

render() {
  local size="$1" out="$2" pad="$3"
  cat > "$TMP/page.html" <<HTML
<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:transparent}
  svg{display:block;width:${size}px;height:${size}px;padding:${pad}px}
</style></head>
<body>
$(cat "$ROOT/icons/icon.svg")
</body></html>
HTML
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --default-background-color=00000000 \
    --window-size="${size},${size}" \
    --screenshot="$ROOT/icons/$out" \
    "file://$TMP/page.html" >/dev/null 2>&1
  echo "icons/$out"
}

render 192 icon-192.png 0
render 512 icon-512.png 0
render 180 icon-180.png 0
render 512 icon-maskable-512.png 52
