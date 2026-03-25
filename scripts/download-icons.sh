#!/usr/bin/env bash
# Downloads flow icon assets from the flow-icons-zed repository.
# Run this once before building the plugin.
#
# Usage: ./scripts/download-icons.sh [theme]
#   theme: deep (default), dim, dawn, deep-light, dim-light, dawn-light

set -euo pipefail

THEME="${1:-deep}"
ICONS_DIR="src/main/resources/icons/flow"
REPO_BASE="https://raw.githubusercontent.com/BenjaminHalko/flow-icons-zed/main"

cd "$(dirname "$0")/.."

echo "Downloading Flow Icons (theme: $THEME) into $ICONS_DIR ..."
mkdir -p "$ICONS_DIR"

# Fetch the list of icons from the repo tree via GitHub API
ICON_LIST=$(curl -fsSL "https://api.github.com/repos/BenjaminHalko/flow-icons-zed/contents/icons/$THEME" \
  | grep '"name"' | sed 's/.*"name": "\(.*\)".*/\1/')

TOTAL=$(echo "$ICON_LIST" | wc -l | tr -d ' ')
echo "Found $TOTAL icon files."

COUNT=0
while IFS= read -r filename; do
  COUNT=$((COUNT + 1))
  dest="$ICONS_DIR/$filename"
  if [ -f "$dest" ]; then
    echo "  [$COUNT/$TOTAL] Skipping $filename (already exists)"
    continue
  fi
  echo "  [$COUNT/$TOTAL] Downloading $filename ..."
  curl -fsSL "$REPO_BASE/icons/$THEME/$filename" -o "$dest"
done <<< "$ICON_LIST"

echo ""
echo "Resizing icons to 16x16 ..."
for f in "$ICONS_DIR"/*.png; do
  sips -z 16 16 "$f" --out "$f" > /dev/null 2>&1
done

echo "Done! $TOTAL icons downloaded and resized to $ICONS_DIR"
echo "You can now build the plugin with: ./gradlew buildPlugin"
