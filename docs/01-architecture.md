# System Architecture – Sri Satya Sai Vidyanikethan Smart School Platform

## 1. Overview

```
 Browser / Mobile  ──HTTPS──►  Next.js frontend (Vercel)
                                   │  fetch (credentials: include)
                                   ▼
                          Express API (Render / Railway)  ──►  MongoDB Atlas
                             │      │       │
                             │      │       └─► Cloudinary (images, documents)
                             │      └─► Transactional email (SMTP / provider)
                             └─► Razorpay (orders + signed webhooks)
                                 Firebase Cloud Messaging (optional push)
```

* **Modular monolith** backend: one deployable, strict internal modules
  (`routes → controllers → services → models`).
* **Frontend** is a separate Next.js (App Router) app. Public pages are server-rendered
  and read configurable content from the API (`/api/settings/public`) with safe defaults.
  Portal pages (`/portal/*`) are client-authenticated via HTTP-only cookies.
* **Shared types** live in `shared/types` and are imported by both sides.

## 2. Backend layering

| Layer | Responsibility |
|-------|----------------|
| `routes/` | URL → middleware chain → controller. Declares the roles allowed. |
| `middleware/` | `authenticate`, `authorize(...permissions)`, `validate(zod)`, rate limiters, CSRF, error handler, upload filters. |
| `controllers/` | HTTP only: parse request, call service, shape response. |
| `services/` | Business rules, transactions, ownership checks (parent↔child, teacher↔class). |
| `models/` | Mongoose schemas, indexes, soft-delete plugin. |
| `validators/` | Zod schemas, one file per module. |
| `utils/` | `ApiError`, `asyncHandler`, response envelope, logger, pagination. |

Response envelope (all endpoints):

```json
{ "success": true, "data": {...}, "meta": { "page": 1, "limit": 20, "total": 120 } }
{ "success": false, "error": { "code": "FORBIDDEN", "message": "...", "details": [...] } }
```

## 3. Authentication & session design

* Passwords hashed with **argon2id**.
* **Access token** (JWT, 15 min) + **refresh token** (opaque random, 7 days, hashed in DB,
  rotated on every use, reuse detection revokes the family). Both in `HttpOnly; Secure; SameSite=Lax` cookies.
* **CSRF**: double-submit token (`csrf` cookie + `X-CSRF-Token` header) on all state-changing requests; CORS locked to the frontend origin.
* Login throttling: IP rate limit + per-account lockout (5 failures → 15 min).
* Password reset: single-use, hashed, 30-min tokens delivered by email.

## 4. Authorization

Permission-based RBAC (see `02-role-permission-matrix.md`). Roles map to permission sets;
every protected route declares `authorize('students:read')` etc. On top of RBAC,
**ownership rules** are enforced in services:

* Parent → only students linked via `Parent.children`.
* Student → only own record.
* Teacher → only classes/sections/subjects present in their `Teacher.assignments`.

## 5. Payments

1. Accountant/Parent creates a **Razorpay order** server-side for specific fee items; a `Payment` record is stored as `created` with a unique `transactionId` and an idempotency key.
2. The frontend checkout result is **never trusted**. Payment becomes `success` only when the signed **webhook** (`X-Razorpay-Signature`, HMAC-SHA256 over the raw body) is verified, inside a MongoDB transaction that also updates the fee ledger and generates the receipt number.
3. Webhook handler is idempotent (event id stored). A reconciliation job compares `created` payments to Razorpay's API.

## 6. Data protection (India – DPDP Act 2023 aligned)

* Verifiable **parental consent** captured at admission (stored with timestamp, IP, version of policy).
* Photographs of identifiable students only published when `photoConsent = true`.
* Private documents stored as Cloudinary `authenticated` assets, served via short-lived signed URLs after an ownership check.
* Audit log for every read/modify of sensitive records; data export/erasure workflow for guardians.
* Minimal data collection; retention schedule documented in `docs/07-data-protection.md` (Phase 8).

## 7. Deployment topology

* Frontend → Vercel (`NEXT_PUBLIC_API_URL`).
* Backend → Render/Railway (Dockerless Node build: `npm run build && npm start`), `/api/health`.
* DB → MongoDB Atlas (M10+ for transactions/backups; IP allow-list + dedicated DB user).
* Backups → Atlas continuous backup + weekly `mongodump` script in `scripts/`.
