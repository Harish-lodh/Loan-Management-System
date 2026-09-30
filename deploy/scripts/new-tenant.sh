#!/usr/bin/env bash
# Onboard a new NBFC on this server: database, env file, first users, PM2 process and Nginx site.
#
# Usage:
#   sudo -E deploy/scripts/new-tenant.sh <CODE> <DOMAIN> <PORT> "<Org Name>" <nbfc-admin-email> <nbfc-admin-phone>
#
# Example:
#   sudo -E deploy/scripts/new-tenant.sh NBFCA nbfca.yourlms.in 3001 "Alpha Finance" admin@alphafin.in 9876543210
#
# Required environment (export before running, or put in /etc/lms/platform.env):
#   MYSQL_ROOT_PASSWORD   MySQL root password (used only to create the tenant database and user)
#   SUPER_ADMIN_EMAIL     your vendor login, created in every tenant
#   SUPER_ADMIN_PASSWORD  your vendor password (10+ chars, letters and numbers)
# Optional:
#   APP_DIR (default /opt/lms)   LMS_ETC (default /etc/lms)   LMS_DATA (default /var/lib/lms)
#   CERTBOT_EMAIL                 if set, a Let's Encrypt certificate is requested for the domain

set -euo pipefail

[[ -f /etc/lms/platform.env ]] && set -a && source /etc/lms/platform.env && set +a

CODE="${1:?tenant code required, e.g. NBFCA}"
DOMAIN="${2:?domain required}"
PORT="${3:?backend port required, e.g. 3001}"
ORG_NAME="${4:?organization name required}"
ADMIN_EMAIL="${5:?NBFC admin email required}"
ADMIN_PHONE="${6:?NBFC admin phone required}"

CODE="$(echo "$CODE" | tr '[:lower:]' '[:upper:]')"
[[ "$CODE" =~ ^[A-Z0-9_]{2,20}$ ]] || { echo "Tenant code must be 2-20 letters, digits or _"; exit 1; }
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "Port must be a number"; exit 1; }

APP_DIR="${APP_DIR:-/opt/lms}"
LMS_ETC="${LMS_ETC:-/etc/lms}"
LMS_DATA="${LMS_DATA:-/var/lib/lms}"
code_lower="$(echo "$CODE" | tr '[:upper:]' '[:lower:]')"
DB_NAME="lms_${code_lower}"
DB_USER="lms_${code_lower}"
ENV_FILE="${LMS_ETC}/tenants/${code_lower}.env"
STORAGE_DIR="${LMS_DATA}/${code_lower}/storage"
PM2_NAME="lms-${code_lower}"

: "${MYSQL_ROOT_PASSWORD:?export MYSQL_ROOT_PASSWORD}"
: "${SUPER_ADMIN_EMAIL:?export SUPER_ADMIN_EMAIL}"
: "${SUPER_ADMIN_PASSWORD:?export SUPER_ADMIN_PASSWORD}"

if [[ -f "$ENV_FILE" ]]; then
  echo "Tenant ${CODE} already exists (${ENV_FILE}). Refusing to overwrite."
  exit 1
fi
if grep -rqs "^PORT=${PORT}$" "${LMS_ETC}/tenants/" 2>/dev/null; then
  echo "Port ${PORT} is already used by another tenant."
  exit 1
fi

rand_hex() { openssl rand -hex "$1"; }
DB_PASSWORD="$(rand_hex 24)"
ADMIN_PASSWORD="Nbfc$(rand_hex 6)9"

echo "==> Creating database ${DB_NAME}"
mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "==> Writing ${ENV_FILE}"
mkdir -p "${LMS_ETC}/tenants" "${STORAGE_DIR}"
umask 077
cat > "$ENV_FILE" <<ENV
PORT=${PORT}
CORS_ORIGINS=https://${DOMAIN}
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_DATABASE=${DB_NAME}
JWT_SECRET=$(rand_hex 48)
JWT_REFRESH_SECRET=$(rand_hex 48)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12
ANNUAL_INTEREST_RATE=12
CREDENTIALS_ENCRYPTION_KEY=$(rand_hex 32)
STORAGE_PATH=${STORAGE_DIR}
ENABLE_SCHEDULER=true
MAKER_CHECKER_ENABLED=true
TENANT_ORG_CODE=${CODE}
TENANT_ORG_NAME=${ORG_NAME}
TENANT_ORG_LEGAL_NAME=${ORG_NAME}
SUPER_ADMIN_EMAIL=${SUPER_ADMIN_EMAIL}
SUPER_ADMIN_PASSWORD=${SUPER_ADMIN_PASSWORD}
NBFC_ADMIN_NAME=${ORG_NAME} Admin
NBFC_ADMIN_EMAIL=${ADMIN_EMAIL}
NBFC_ADMIN_PHONE=${ADMIN_PHONE}
NBFC_ADMIN_PASSWORD=${ADMIN_PASSWORD}
EASEBUZZ_ENV=sandbox
EASEBUZZ_KEY=
EASEBUZZ_SALT=
DIGIO_CLIENT_ID=
DIGIO_CLIENT_SECRET=
DOQUFY_API_KEY=
ENV
umask 022

echo "==> Running migrations and tenant bootstrap"
cd "$APP_DIR"
ENV_FILE="$ENV_FILE" npm --workspace backend run db:migrate
ENV_FILE="$ENV_FILE" npm --workspace backend run tenant:init

echo "==> Starting ${PM2_NAME} on port ${PORT}"
ENV_FILE="$ENV_FILE" pm2 start backend/dist/main.js --name "$PM2_NAME" --time --max-memory-restart 400M
pm2 save

echo "==> Configuring Nginx for ${DOMAIN}"
sed -e "s#__CODE__#${code_lower}#g" -e "s#__DOMAIN__#${DOMAIN}#g" -e "s#__PORT__#${PORT}#g" -e "s#__APP_DIR__#${APP_DIR}#g" \
  "$APP_DIR/deploy/nginx/tenant.conf.template" > "/etc/nginx/sites-available/lms-${code_lower}.conf"
ln -sf "/etc/nginx/sites-available/lms-${code_lower}.conf" "/etc/nginx/sites-enabled/lms-${code_lower}.conf"
nginx -t
systemctl reload nginx

if [[ -n "${CERTBOT_EMAIL:-}" ]]; then
  echo "==> Requesting SSL certificate"
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect
fi

cat <<DONE

Tenant ${CODE} is live at https://${DOMAIN}
  NBFC admin login : ${ADMIN_EMAIL}
  Temporary password: ${ADMIN_PASSWORD}   (share securely; ask them to change it under Profile)
  Your login       : ${SUPER_ADMIN_EMAIL}
  Env file         : ${ENV_FILE}   (back this up: it holds the encryption key)
DONE
