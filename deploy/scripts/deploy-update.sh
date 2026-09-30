#!/usr/bin/env bash
# Roll out a new version to every NBFC on this server.
# Builds once, runs each tenant's migrations, then restarts each tenant process.
#
# Usage: deploy/scripts/deploy-update.sh [git-ref]   (default: origin/main)

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/lms}"
LMS_ETC="${LMS_ETC:-/etc/lms}"
REF="${1:-origin/main}"

cd "$APP_DIR"
echo "==> Fetching ${REF}"
git fetch --all --prune
git checkout --detach "$REF"

echo "==> Installing and building"
npm ci
npm --workspace backend run build
VITE_API_URL=/backend npm --workspace frontend run build

shopt -s nullglob
failed=()
for env_file in "${LMS_ETC}"/tenants/*.env; do
  code="$(basename "$env_file" .env)"
  echo "==> ${code}: migrating"
  if ENV_FILE="$env_file" npm --workspace backend run db:migrate; then
    echo "==> ${code}: restarting"
    ENV_FILE="$env_file" pm2 restart "lms-${code}" --update-env
  else
    echo "!!  ${code}: migration failed, process NOT restarted (still on the previous build in memory)"
    failed+=("$code")
  fi
done
pm2 save

if (( ${#failed[@]} )); then
  echo "Update finished with failures: ${failed[*]}"
  exit 1
fi
echo "All tenants updated to $(git rev-parse --short HEAD)"
