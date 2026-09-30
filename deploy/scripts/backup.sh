#!/usr/bin/env bash
# Nightly backup of every NBFC: database dump + uploaded files + env file (holds the encryption key).
# Cron example (02:00 daily):
#   0 2 * * * /opt/lms/deploy/scripts/backup.sh >> /var/log/lms-backup.log 2>&1
#
# Optional off-server copy: configure an rclone remote (e.g. Google Drive) and set RCLONE_REMOTE=gdrive:lms-backups

set -euo pipefail

LMS_ETC="${LMS_ETC:-/etc/lms}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/lms}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M)"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
shopt -s nullglob

for env_file in "${LMS_ETC}"/tenants/*.env; do
  code="$(basename "$env_file" .env)"
  # Read only the variables we need from the tenant env file.
  get() { grep -E "^$1=" "$env_file" | head -1 | cut -d= -f2-; }
  db_name="$(get DB_DATABASE)"
  db_user="$(get DB_USERNAME)"
  db_pass="$(get DB_PASSWORD)"
  storage="$(get STORAGE_PATH)"
  target="${BACKUP_DIR}/${code}-${STAMP}"
  mkdir -p "$target"

  echo "[$(date)] ${code}: dumping ${db_name}"
  MYSQL_PWD="$db_pass" mysqldump -u"$db_user" --single-transaction --routines --no-tablespaces "$db_name" | gzip > "${target}/db.sql.gz"
  if [[ -n "$storage" && -d "$storage" ]]; then
    tar -czf "${target}/storage.tar.gz" -C "$storage" .
  fi
  cp "$env_file" "${target}/tenant.env"
  chmod -R go-rwx "$target"
done

echo "[$(date)] pruning backups older than ${KEEP_DAYS} days"
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+${KEEP_DAYS}" -exec rm -rf {} +

if [[ -n "${RCLONE_REMOTE:-}" ]]; then
  echo "[$(date)] syncing to ${RCLONE_REMOTE}"
  rclone sync "$BACKUP_DIR" "$RCLONE_REMOTE" --max-age 2d
fi
echo "[$(date)] backup complete"
