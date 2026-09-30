# Loan Management Platform

A staff-operated loan management system for NBFCs. Each NBFC gets its own instance (own database, own
subdomain); borrowers are customer records managed by NBFC staff and never sign in.

It includes a NestJS REST API, MySQL with TypeORM migrations, JWT access and refresh tokens, role-based
permissions with maker-checker, customer (CIF) management with encrypted PAN, configurable loan products
(versions, dynamic fields, eligibility rules, workflows), agreement templates, eSign (Digio/Doqufy),
eNACH, disbursement, Easebuzz payment collection, repayment tracking with a nightly overdue job,
notifications, admin analytics, Swagger docs, and a tamper-evident audit log.

## Tech Stack

- Backend: NestJS, TypeORM, MySQL 8, JWT, bcrypt, class-validator, @nestjs/schedule
- Frontend: React, React Router, Tailwind CSS, Axios, Recharts
- Security: role permissions, maker-checker, AES-256-GCM encryption for PAN and provider secrets
- Audit: SHA-256 chained audit log with integrity verification

## Project Structure

```text
backend/src/
  admin/            dashboard, staff management, application review, repayments
  audit-log/        hash-chained audit trail
  auth/             login, refresh, logout, /auth/me (returns effective permissions)
  common/           role-permissions, guards, tenancy scope, PII crypto
  customers/        borrower records (CIF)
  database/         entities, migrations, seed.ts (demo), tenant-init.ts (production onboarding)
  jobs/             nightly jobs (overdue EMIs)
  lending-platform/ products, partners, providers, configurable applications, documents, eSign/eNACH/disbursement
  loans/            EMI and schedule calculations, simple approve/reject
  payments/         Easebuzz payment links and webhooks
  repayments/       repayment status and overdue handling
  storage/          local file storage (swap for S3 later)
  tenant/           public branding endpoint for the shared frontend
frontend/src/       staff portal
deploy/             Nginx template and scripts for running many NBFCs on one server
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create the backend environment file and fill in the DB password and `CREDENTIALS_ENCRYPTION_KEY`:

```bash
cp backend/.env.example backend/.env
```

3. Start MySQL 8 and create a database named `loan_management`.

4. Run migrations and load demo data:

```bash
npm run db:migrate
npm run db:seed
```

5. Start both apps:

```bash
npm run dev
```

Backend: `http://localhost:3000` (Swagger at `/api/docs`). Frontend: `http://localhost:5173`
(set `VITE_API_URL` in `frontend/.env` to the backend URL).

## Demo Accounts (from `db:seed`)

| Role | Email | Password |
|---|---|---|
| Super admin (vendor) | `superadmin@demo.bank` | `Super@12345` |
| NBFC admin | `admin@demo.bank` | `Admin@12345` |
| Credit officer | `credit@demo.bank` | `Credit@12345` |
| Operations | `staff@demo.bank` | `Staff@12345` |
| Collections | `collections@demo.bank` | `Collect@12345` |

Demo customers: Maya Sharma (`CUSDEMO0001`) and Arjun Mehta (`CUSDEMO0002`).

## Roles

| Role | Access |
|---|---|
| `SUPER_ADMIN` | Platform vendor. Everything, across organizations. Hidden from NBFC staff lists and cannot be edited by NBFC admins. Created only by `tenant:init`. |
| `ADMIN` | NBFC administrator: staff, configuration, providers and all loan work. |
| `CREDIT_OFFICER` | Customers, capture applications, approve/reject. |
| `OPERATIONS` | Customers, capture applications, agreements, eSign, eNACH, disbursement. |
| `COLLECTIONS` | Repayments, mark EMIs paid, payment links. |
| `VIEWER` | Read-only. |

Permissions live in `backend/src/common/auth/role-permissions.ts`. The staff member who captured an
application cannot approve it (maker-checker, `MAKER_CHECKER_ENABLED`).

## Running for Multiple NBFCs

See [deploy/README.md](deploy/README.md). In short: one server, one build, and per NBFC a database, an env
file (`ENV_FILE=/etc/lms/tenants/<code>.env`), a PM2 process and a subdomain. `deploy/scripts/new-tenant.sh`
onboards an NBFC; `npm run tenant:init` (run by that script) creates the organization, your
`SUPER_ADMIN` and the NBFC's first `ADMIN`.

## Commands

```bash
npm --workspace backend run start:dev
npm --workspace backend run build
npm --workspace backend test
npm --workspace backend run db:migrate
npm --workspace backend run db:seed        # demo data (local only)
npm --workspace backend run tenant:init    # production onboarding, reads TENANT_* / SUPER_ADMIN_* / NBFC_ADMIN_*
npm --workspace frontend run dev
npm --workspace frontend run build
```

## API Overview

Auth: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`

Staff profile: `GET /users/profile`, `PATCH /users/profile`, `PATCH /users/profile/password`

Tenant (public): `GET /tenant/branding`

Customers: `GET /api/v1/customers`, `POST /api/v1/customers`, `GET /api/v1/customers/:id`, `PATCH /api/v1/customers/:id`

Admin:
- `GET /admin/dashboard`
- `GET /admin/loan-applications`, `GET /admin/loan-applications/:id`
- `PATCH /admin/loan-applications/:id/approve`, `PATCH /admin/loan-applications/:id/reject`
- `GET /admin/repayments`, `PATCH /admin/repayments/:id/status`
- `GET /admin/staff-users`, `POST /admin/staff-users`, `PATCH /admin/staff-users/:id`

Configurable lending:
- `GET|POST /api/v1/organizations`, `GET|POST /api/v1/products`, `POST /api/v1/products/:id/publish`
- `GET /api/v1/products/:id/application-schema`
- `GET|POST /api/v1/partners`, `POST /api/v1/partners/:id/products`
- `POST /api/v1/loan-applications` (with `customerId`, or `applicant.fullName` + `applicant.phone` for a new customer)
- `POST /api/v1/loan-applications/:id/submit`, `/approve`, `/reject`, `/advance`
- `POST /api/v1/loan-applications/:id/agreements/generate`, `/esign/initiate`, `/enach/initiate`, `/disbursements`
- `POST /api/v1/repayments/:id/collect`
- Webhooks: `POST /api/v1/webhooks/{esign|enach|disbursement}/:providerCode`, `POST /api/v1/webhooks/payment/:providerCode`

Audit logs: `GET /audit-logs`, `GET /audit-logs/verify`

## Notes

- Money columns are `DECIMAL`; the API still returns them as numbers.
- PAN is stored encrypted with a keyed hash for duplicate checks; only the masked value is ever returned.
- Keep `CREDENTIALS_ENCRYPTION_KEY` stable and backed up. Changing or losing it makes encrypted PAN and provider secrets unreadable.
- Migration `1758500000000-CustomersAndStaffRoles` moves existing borrower users into `customers` (same ids), maps old roles (`ADMIN` without an organization becomes `SUPER_ADMIN`, `USER` becomes `OPERATIONS`), and converts money columns to `DECIMAL`. Back up the database before running it on existing data.
- If a local database already has tables but an empty `migrations` table, TypeORM will try to replay the initial migrations. Baseline the migration history or migrate a fresh database.
