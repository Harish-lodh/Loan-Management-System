# Deploying for multiple NBFCs (single server, low cost)

One codebase, one build, one Linux server. Each NBFC gets its **own database, own env file, own backend
process and own subdomain**. Data never mixes between NBFCs. You (the vendor) have a `SUPER_ADMIN`
login in every instance that the NBFC's staff cannot see or edit.

```
                 nbfca.yourlms.in        nbfcb.yourlms.in
                        │                        │
            ┌───────────▼────────────────────────▼───────────┐
            │ Nginx + Let's Encrypt (free SSL)                │
            │   /          -> frontend/dist (shared build)    │
            │   /backend/  -> 127.0.0.1:<tenant port>          │
            ├─────────────────────────────────────────────────┤
            │ PM2: lms-nbfca (3001)   lms-nbfcb (3002)        │
            │      ENV_FILE=/etc/lms/tenants/<code>.env       │
            ├─────────────────────────────────────────────────┤
            │ MySQL: lms_nbfca   lms_nbfcb                    │
            │ Files: /var/lib/lms/<code>/storage              │
            └─────────────────────────────────────────────────┘
```

Everything here is free software. The only costs are the server (Oracle Cloud free tier, or ~₹500–1000/month
for a 2–4 GB VPS in an India region) and a domain.

## 1. One-time server setup (Ubuntu 22.04/24.04)

```bash
sudo apt update && sudo apt install -y nginx mysql-server git certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm install -g pm2
pm2 startup systemd        # run the command it prints, so tenants restart after a reboot

sudo mysql_secure_installation
sudo git clone <your-repo-url> /opt/lms && cd /opt/lms
npm ci
npm --workspace backend run build
VITE_API_URL=/backend npm --workspace frontend run build
```

Point a wildcard DNS record `*.yourlms.in` (or one record per NBFC) at the server's IP.

Store the platform-wide secrets once (readable by root only):

```bash
sudo mkdir -p /etc/lms && sudo tee /etc/lms/platform.env >/dev/null <<'EOF'
MYSQL_ROOT_PASSWORD=...
SUPER_ADMIN_EMAIL=you@yourcompany.in
SUPER_ADMIN_PASSWORD=...          # 10+ chars, letters and numbers
CERTBOT_EMAIL=you@yourcompany.in  # optional, enables automatic HTTPS
EOF
sudo chmod 600 /etc/lms/platform.env
```

## 2. Onboard a new NBFC (about 10 minutes)

```bash
cd /opt/lms
sudo -E deploy/scripts/new-tenant.sh NBFCA nbfca.yourlms.in 3001 "Alpha Finance" admin@alphafin.in 9876543210
```

The script creates the database and a DB user, writes `/etc/lms/tenants/nbfca.env` with fresh secrets,
runs migrations, creates the organization plus your `SUPER_ADMIN` and the NBFC's first `ADMIN`
(`npm run tenant:init`), starts `lms-nbfca` in PM2, configures Nginx and, if `CERTBOT_EMAIL` is set, HTTPS.
It prints the NBFC admin's temporary password at the end.

Use a new port for every NBFC (3001, 3002, ...). Put each NBFC's own Easebuzz/Digio keys in its env file,
or have their admin enter them under **Configuration → Providers**, then `pm2 restart lms-<code>`.

**Back up every tenant env file somewhere safe.** `CREDENTIALS_ENCRYPTION_KEY` encrypts customer PAN and
provider secrets; if it is lost, that data cannot be decrypted.

## 3. Ship an update to all NBFCs

```bash
cd /opt/lms && deploy/scripts/deploy-update.sh            # or: deploy-update.sh v1.4.0
```

Builds once, then runs each tenant's migrations and restarts it. If one tenant's migration fails, that
tenant is not restarted and the script exits non-zero so you can look at it.

## 4. Backups

```bash
sudo crontab -e
0 2 * * * /opt/lms/deploy/scripts/backup.sh >> /var/log/lms-backup.log 2>&1
```

Each night the script dumps every tenant database, archives its files and copies its env file into
`/var/backups/lms`, keeping 14 days. To keep a copy off the server, configure `rclone` (Google Drive gives
15 GB free) and set `RCLONE_REMOTE=gdrive:lms-backups` in the crontab line.

Restore one tenant:

```bash
gunzip -c /var/backups/lms/nbfca-<stamp>/db.sql.gz | mysql -u root -p lms_nbfca
tar -xzf /var/backups/lms/nbfca-<stamp>/storage.tar.gz -C /var/lib/lms/nbfca/storage
pm2 restart lms-nbfca
```

## Roles inside each instance

| Role | Can do |
|---|---|
| `SUPER_ADMIN` (you) | Everything. Hidden from the NBFC's staff list; NBFC admins cannot edit or deactivate it. Created only by `tenant:init`. |
| `ADMIN` | Everything for their NBFC: staff, configuration, providers, all loan work. |
| `CREDIT_OFFICER` | Customers, capture applications, approve/reject. |
| `OPERATIONS` | Customers, capture applications, agreements, eSign, eNACH, disbursement. |
| `COLLECTIONS` | Repayments, mark EMIs paid, send payment links. |
| `VIEWER` | Read-only. |

Maker-checker is on by default: whoever captured an application cannot approve it
(`MAKER_CHECKER_ENABLED=false` turns it off, e.g. for a one-person pilot).

## Useful commands

```bash
pm2 ls                         # all tenants and their status
pm2 logs lms-nbfca             # live logs for one NBFC
ENV_FILE=/etc/lms/tenants/nbfca.env npm --workspace backend run tenant:init -- --reset-passwords
                               # re-run onboarding and reset the two bootstrap passwords from the env file
```

## When to grow

| Signal | Move to |
|---|---|
| RAM regularly above 80%, or 5+ NBFCs | Bigger VPS, or MySQL on its own server |
| Uploaded files above ~50 GB | S3 / Cloudflare R2 (only `StorageService` changes) |
| An NBFC wants its own server or cloud | Same scripts on their machine; one tenant there |
| Deploys getting error-prone | Docker (free) using the same env files |
