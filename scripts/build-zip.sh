#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

version="$(node -p "require('./manifest.json').version")"
archive="gmail-markdown-v${version}.zip"

zip -FS "$archive" \
  manifest.json \
  background.js \
  contentScript.js \
  threadCopy.js \
  injector.js \
  html2md.js \
  marked.min.js \
  emoji.js \
  turndown.js \
  themes.css \
  options.html \
  options.js \
  options.css \
  icons/icon.png \
  icons/icon16.png \
  icons/icon48.png \
  icons/icon128.png

printf '%s\n' "$archive"
