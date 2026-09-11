#!/usr/bin/env bash
# Launch the extension in a VS Code Extension Development Host, with esbuild/tsc
# watching in the background so source edits rebuild automatically.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

npm run watch &
code --extensionDevelopmentPath="$(pwd)"
