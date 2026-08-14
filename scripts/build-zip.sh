#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if [ ! -f vendor/marked.umd.js ]; then
  printf '%s\n' 'vendor/marked.umd.js is missing; run npm install or npm run vendor first.' >&2
  exit 1
fi

version="$(node -p "require('./manifest.json').version")"
archive="gmail-markdown-v${version}.zip"

zip -FS "$archive" \
  manifest.json \
  background.js \
  contentScript.js \
  commandBridge.js \
  markdownSecurity.js \
  html2md.js \
  emoji.js \
  turndown.js \
  vendor/marked.umd.js \
  themes.css \
  options.html \
  options.js \
  options.css \
  threadCopy.js \
  icons/icon.png \
  icons/icon16.png \
  icons/icon48.png \
  icons/icon128.png

printf '%s\n' "$archive"
