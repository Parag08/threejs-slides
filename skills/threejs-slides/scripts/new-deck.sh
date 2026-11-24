#!/usr/bin/env bash
# Scaffold a new threejs-slides deck.
#   bash new-deck.sh <output-dir> [--theme nebula|ember|aurora|paper|mono] [--title "Deck title"]
#                    [--subtitle "..."] [--kicker "..."]
# Creates <output-dir>/index.html and <output-dir>/lib/ (runtime copy). Refuses to overwrite index.html.
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-}"; shift || true
[ -z "$OUT" ] && { echo "usage: new-deck.sh <output-dir> [--theme name] [--title text] [--subtitle text] [--kicker text]" >&2; exit 1; }

THEME="nebula"; TITLE="Untitled deck"; SUBTITLE="A presentation that moves."; KICKER="$(date +%B\ %Y)"
while [ $# -gt 0 ]; do
  case "$1" in
    --theme) THEME="$2"; shift 2;;
    --title) TITLE="$2"; shift 2;;
    --subtitle) SUBTITLE="$2"; shift 2;;
    --kicker) KICKER="$2"; shift 2;;
    *) echo "unknown option: $1" >&2; exit 1;;
  esac
done

case "$THEME" in
  nebula) FONTS='https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400..700&family=JetBrains+Mono:wght@400;600&display=swap';;
  ember)  FONTS='https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Figtree:wght@400..700&family=IBM+Plex+Mono:wght@400;600&display=swap';;
  aurora) FONTS='https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400..700&family=Space+Mono:wght@400;700&display=swap';;
  paper)  FONTS='https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400..600&family=Public+Sans:wght@400..700&family=IBM+Plex+Mono:wght@400;600&display=swap';;
  mono)   FONTS='https://fonts.googleapis.com/css2?family=Archivo:wght@400..800&family=JetBrains+Mono:wght@400;600&display=swap';;
  *) echo "unknown theme: $THEME (nebula|ember|aurora|paper|mono)" >&2; exit 1;;
esac

mkdir -p "$OUT/lib"
if [ -e "$OUT/index.html" ]; then echo "refusing to overwrite $OUT/index.html" >&2; exit 1; fi
cp "$SKILL_DIR/assets/runtime/"* "$OUT/lib/"

# escape for sed replacement (& / \ and |)
esc() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/[&|\\]/\\&/g'; }
sed -e "s|{{THEME}}|$(esc "$THEME")|g" \
    -e "s|{{TITLE}}|$(esc "$TITLE")|g" \
    -e "s|{{SUBTITLE}}|$(esc "$SUBTITLE")|g" \
    -e "s|{{KICKER}}|$(esc "$KICKER")|g" \
    -e "s|{{FONTS}}|$(esc "$FONTS")|g" \
    "$SKILL_DIR/assets/template/index.html" > "$OUT/index.html"

echo "Created $OUT/index.html (theme: $THEME)"
echo "Preview:  python3 -m http.server 8000 --directory \"$OUT\"   then open http://localhost:8000"
