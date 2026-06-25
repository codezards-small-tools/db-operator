#!/usr/bin/env bash
set -euo pipefail

echo "== DB Operator Linux GUI dependencies =="
echo "Trying system install (requires sudo)..."
echo

if command -v apt-get >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  PACKAGES=(
    libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1
    libasound2 libpango-1.0-0 libcairo2 x11-apps
  )

  if ! apt-cache show libasound2 >/dev/null 2>&1; then
    PACKAGES=("${PACKAGES[@]/libasound2/libasound2t64}")
  fi

  sudo apt-get update
  sudo apt-get install -y "${PACKAGES[@]}"
  echo "System packages installed."
  exit 0
fi

echo "sudo not available — using user-local install (no root required)..."
node "$(dirname "$0")/setup-linux-deps-user.mjs"
