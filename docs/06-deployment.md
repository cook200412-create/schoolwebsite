# Deployment guide

Topology: **Vercel** (Next.js) → same-origin `/api/*` rewrite → **Render/Railway** (Express) → **MongoDB Atlas**. Images/documents: **Cloudinary**. HTTPS everywhere (Vercel and Render terminate TLS; HSTS is sent by Helmet in production).

## 1. MongoDB Atlas
1. Create a **M10+ cluster** (transactions and continuous backup require a replica set / paid tier).
2. Database user with `readWrite` on the `ssv_school` database only. Network access: allow the API host's egress IPs (or Render's static outbound IPs); never `0.0.0.0/0` in production.
3. Enable **Cloud Backup** (point-in-time recovery) and alerts. Copy the SRV connection string → `MONGODB_URI`.

## 2. Backend (Render – see `render.yaml`)
| Variable | Notes |
|---|---|
| `NODE_ENV=production` | enables Secure cookies, hides stack traces |
| `MONGODB_URI` | Atlas SRV string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | ≥32 random chars each (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `CLIENT_ORIGINS` | exact frontend origin(s), e.g. `https://school.example.org` – **the browser's Origin header is checked even when using the proxy** |
| `CLIENT_URL` | used in emails (reset links) |
| `SMTP_*`, `MAIL_FROM` | transactional email (Brevo/SES/SendGrid SMTP). Without it emails are only logged |
| `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` | start with **test mode** keys |
| `CLOUDINARY_*` | when set, private documents are stored as `authenticated` assets; otherwise local `UPLOAD_DIR` (ephemeral on Render – attach a disk or configure Cloudinary) |

Build `npm ci && npm run build`, start `npm start`, health check `GET /api/health` (503 when the DB is down).

**First Super Admin** (once, from a Render shell or locally with production env):
```bash
ADMIN_EMAIL=head@school.org ADMIN_NAME="School Head" npm run create-admin
```
Then create all other users from *Portal ▸ Users & roles*. Never run `npm run seed` in production (it refuses unless `ALLOW_DEMO_SEED=true`).

## 3. Razorpay
1. Dashboard ▸ Webhooks ▸ add `https://<api-host>/api/payments/webhook/razorpay`, secret = `RAZORPAY_WEBHOOK_SECRET`, events `payment.captured`, `order.paid`, `payment.failed`.
2. Fees are credited **only** by the verified webhook (HMAC-SHA256 of the raw body, event-id idempotency, amount check). The checkout success callback never changes the ledger.
3. Switch to live keys only after completing Razorpay KYC and a full test-mode pass.

## 4. Frontend (Vercel)
Project root `frontend/`. Environment variable: `API_URL=https://<api-host>/api` (used by the build-time rewrite and server components). No secrets are exposed to the browser. The `/api/*` rewrite keeps auth cookies first-party (`SameSite=Lax`). If you ever call the API cross-site instead, set `COOKIE_SAMESITE=none` on the API (requires HTTPS).

## 5. Release checklist
- [ ] `cd backend && npm test && npm run build`  — 81 integration tests
- [ ] `cd frontend && npm test && npm run build`
- [ ] Atlas backup enabled; `scripts/backup.sh` scheduled weekly (cron/GitHub Action) and a restore rehearsed
- [ ] Privacy policy + consent wording reviewed by the school/legal counsel
- [ ] Facilities / faculty / gallery published only after confirmation + consent
- [ ] Razorpay webhook delivering (Dashboard ▸ Webhooks ▸ recent deliveries 200)
- [ ] Error monitoring (below) and uptime check on `/api/health`

## 6. Monitoring & operations
* **Errors:** add Sentry (`@sentry/node` in `src/server.ts`, `@sentry/nextjs` in the frontend) with a PII-scrubbing `beforeSend`; never send student names/IDs.
* **Uptime:** UptimeRobot/BetterStack on `GET /api/health`.
* **Logs:** Render log drains; the API logs requests via morgan (`combined`). Audit trail lives in the `auditlogs` collection (*Portal ▸ Audit log*).
* **Backups:** Atlas continuous backup + `scripts/backup.sh`; keep ≥12 weekly archives encrypted off-site.
* **Dependency hygiene:** `npm audit` monthly; Dependabot on both packages.
