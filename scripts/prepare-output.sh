#!/usr/bin/env bash
set -euo pipefail

# The checkout is untrusted data. Never follow its links when publishing reports.
output="${1:?workspace is required}/coral-output"
if [[ -L "$output" || ( -e "$output" && ! -d "$output" ) ]]; then
  echo '::error::coral-output must be a real directory' >&2
  exit 1
fi
mkdir -p -- "$output"
unsafe_entry=$(find "$output" ! -type d ! -type f -print -quit)
if [[ -n "$unsafe_entry" ]]; then
  echo '::error::coral-output must contain only regular files and directories' >&2
  exit 1
fi
for file in graph.json base.json; do
  if [[ -e "$output/$file" && ! -f "$output/$file" ]]; then
    echo "::error::coral-output/$file must be a regular file" >&2
    exit 1
  fi
done
if [[ -e "$output/html" && ! -d "$output/html" ]]; then
  echo '::error::coral-output/html must be a directory' >&2
  exit 1
fi
