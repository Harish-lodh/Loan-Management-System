# Loan Management Platform

A portfolio-ready loan management web app for a small digital banking platform. It includes a NestJS REST API, MySQL with TypeORM migrations, JWT access and refresh tokens, role-based admin access, profile management, transparent loan scoring, EMI calculations, draft-to-review loan workflows, repayment tracking with overdue handling, notifications, admin analytics, Swagger docs, and a tamper-evident audit log.

The platform now includes a configurable lending-platform foundation: organization, product, partner, provider, product-version, dynamic application field, eligibility rule, workflow, agreement template, mock eSign, mock eNACH, mock disbursement, provider webhook, application snapshot, status transition, and repayment ledger records. Legacy `/loans/*` routes remain available, while configurable APIs use `/api/v1/*`.

## Tech Stack

- Backend: NestJS, TypeORM, MySQL, JWT, bcrypt, class-validator
- Frontend: React, React Router, Tailwind CSS, Axios, Recharts
- Auth: JWT access tokens with role-based USER and ADMIN access
- Audit: SHA-256 chained audit log with integrity verification

## Project Structure

```text
backend/
  src/
    database/
      entities/
      migrations/
      seed.ts
    admin/
    audit-log/
    auth/
    common/
    loans/
    notifications/
    repayments/
    users/
frontend/
  src/
    api/
    components/
    context/
    layouts/
    pages/
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create backend environment file:

```bash
cp backend/.env.example backend/.env
```

3. Start MySQL, create a database named `loan_management`, and update `backend/.env` if needed.

4. Run database migration and seed data:

```bash
npm run db:migrate
npm run db:seed
```

5. Start both apps:

```bash
npm run dev
```

Backend runs on `http://localhost:3000`.
Frontend runs on `http://localhost:5173`.
Swagger API docs are available at `http://localhost:3000/api/docs`.

## Demo Accounts

- Admin: `admin@demo.bank` / `Admin@12345`
- User: `maya@example.com` / `User@12345`
- User: `arjun@example.com` / `User@12345`

## Backend Commands

```bash
npm --workspace backend run start:dev
npm --workspace backend run build
npm --workspace backend test
npm --workspace backend run db:migrate
npm --workspace backend run db:seed
```

## Frontend Commands

```bash
npm --workspace frontend run dev
npm --workspace frontend run build
npm --workspace frontend run preview
```

## Major Modules

- `auth`: registration, login, JWT strategy, password hashing, `/auth/me`
- `auth`: registration, login, refresh tokens, logout, JWT strategy, password hashing, `/auth/me`
- `users`: profile updates, password changes, and safe user serialization
- `loans`: drafts, submission, review workflow, transparent risk scoring, EMI calculation, user loan views
- `lending-platform`: configurable organization, partner, product, provider, workflow, dynamic application, agreement, eSign, eNACH, disbursement, webhook, and ledger foundation
- `repayments`: repayment schedules, demo payment marking, overdue tracking, reminder metadata, status updates
- `notifications`: in-app notifications, unread filters, priorities, related action links, mark-all-read
- `admin`: analytics dashboards, paginated user management, loan review, repayment monitoring
- `audit-log`: blockchain-style chained audit records, search/pagination, and chain verification
- `database`: TypeORM configuration, MySQL entities, migrations, and seed data

## Assumptions

- This is a demo application, so payment collection is mocked by marking repayments as paid.
- Admin approval creates and activates a loan immediately, then generates the repayment schedule.
- The rule-based score is deterministic and intentionally transparent; higher scores mean lower lending risk.
- JWTs are stored in `localStorage` for demo convenience. A production app should prefer hardened cookie/session handling.
- The app does not integrate with real banking, KYC, credit bureau, or payment APIs.

## API Overview

Auth:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

Users:
- `GET /users/profile`
- `PATCH /users/profile`
- `PATCH /users/profile/password`

Loans:
- `POST /loans/apply`
- `POST /loans/drafts`
- `PATCH /loans/applications/:id`
- `POST /loans/applications/:id/submit`
- `GET /loans/my`
- `GET /loans/:id`
- `POST /loans/:id/calculate-emi`
- `GET /loans/:id/repayment-schedule`

Repayments:
- `GET /repayments/my`
- `POST /repayments/:id/mark-paid`

Notifications:
- `GET /notifications`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`

Admin:
- `GET /admin/dashboard`
- `GET /admin/users`
- `GET /admin/users/:id`
- `GET /admin/loan-applications`
- `GET /admin/loan-applications/:id`
- `PATCH /admin/loan-applications/:id/approve`
- `PATCH /admin/loan-applications/:id/reject`
- `GET /admin/repayments`
- `PATCH /admin/repayments/:id/status`

Configurable lending APIs:
- `POST /api/v1/organizations`
- `GET /api/v1/organizations`
- `POST /api/v1/products`
- `GET /api/v1/products`
- `POST /api/v1/products/:id/publish`
- `GET /api/v1/products/:id/application-schema`
- `POST /api/v1/partners`
- `POST /api/v1/partners/:id/products`
- `POST /api/v1/loan-applications`
- `POST /api/v1/loan-applications/:id/submit`
- `POST /api/v1/loan-applications/:id/approve`
- `POST /api/v1/loan-applications/:id/agreements/generate`
- `POST /api/v1/loan-applications/:id/esign/initiate`
- `POST /api/v1/loan-applications/:id/enach/initiate`
- `POST /api/v1/loan-applications/:id/disbursements`
- `POST /api/v1/webhooks/esign/:providerCode`
- `POST /api/v1/webhooks/enach/:providerCode`
- `POST /api/v1/webhooks/disbursement/:providerCode`

Audit logs:
- `GET /audit-logs`
- `GET /audit-logs/verify`

## Production-Style Enhancements

- Access tokens are short-lived and paired with stored hashed refresh tokens for session rotation and logout.
- Product and partner configuration is versioned and snapshotted on configurable application submission.
- Mock provider flows require signed webhook-style completion instead of direct client completion.
- Loan applications can be saved as drafts, submitted, moved into review, approved, or rejected with status history.
- Loan scoring returns category-level point breakdowns, ratios, strengths, and concerns.
- Repayments track overdue days, overdue timestamps, and reminder timestamps.
- Admin list screens support search, filters, and pagination.
- The frontend includes reusable loading, error, empty, pagination, score breakdown, and responsive table patterns.
- Backend unit tests cover EMI/scoring logic, repayment overdue utilities, audit hashing, and audit chain verification.
- Lending platform unit tests cover safe eligibility-rule execution and invalid workflow transition blocking.

## Migration Note

The new migration is additive. If a local database already has application tables but an empty `migrations` table, TypeORM will try to replay the initial migrations and fail with `Table 'users' already exists`. Baseline the existing migration history or migrate a fresh database before running `npm run db:migrate`.
# Loan-Management-System
