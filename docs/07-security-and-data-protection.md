# Security & data-protection notes

## Implemented controls
| Area | Control |
|---|---|
| Passwords | argon2id; policy ≥10 chars with upper/lower/digit; admin-created accounts get one-time temporary passwords with forced change |
| Sessions | 15-min JWT access token + rotating 7-day refresh token (hashed in DB, family revocation on reuse), all in HTTP-only cookies; password change/reset revokes every session |
| Brute force | per-IP rate limits on auth routes; account lock after 5 failures (15 min); same error + timing for unknown emails |
| CSRF | double-submit token enforced for every unsafe request that carries session cookies; CORS restricted to `CLIENT_ORIGINS` |
| AuthZ | permission-based RBAC checked in **every** route (`authorize()`), plus ownership rules in services (parent↔child, teacher↔section/subject, student↔self). Out-of-scope IDs return 404 so records can't be probed |
| Input | Zod validation on every body/query, unknown fields stripped (no mass-assignment); Mongo operators can't be injected through validated fields; CSV formula-injection neutralised on export |
| Uploads | allow-list (PDF/JPG/PNG), 5 MB cap, **magic-byte verification**, random server-side names, stored privately (Cloudinary `authenticated` or 0600 local files), downloaded only through an access-checked endpoint, `Cache-Control: no-store` |
| Payments | webhook HMAC verification on the raw body, event-id idempotency, amount check, MongoDB transactions, over-payment guard, unique transaction/receipt numbers, refunds need a second approver. No card data is ever stored |
| Results | immutable once approved/published; changes need a reasoned *reopen* by leadership and are audited |
| Audit | `auditlogs` records logins, student views, attendance/marks changes, approvals, payments, refunds, settings, role edits, downloads |
| Headers | Helmet (HSTS, nosniff, frameguard, …) on the API; security headers on the frontend; no secrets in the client bundle |
| Privacy by design | transport live-location is never exposed; public gallery/achievements require guardian-consent flags; facilities, faculty and results are unpublished until confirmed |

## Indian data-protection alignment (DPDP Act 2023 – to be confirmed with counsel)
* **Verifiable parental consent** is captured at registration and at admission (timestamp, IP, policy version) and stored with the record.
* **Purpose limitation / minimisation:** only fields needed for admission, academics, fees and safety are collected.
* **Children's data:** no behavioural tracking or advertising; student photos are public only with confirmed consent.
* **Rights:** guardians can request correction/erasure — implement as an administrative workflow (soft-delete + anonymisation job) before go-live; retention schedule to be set by the school.
* **Breach response:** keep the audit log and backups; define a 72-hour internal notification process.

## Known limitations / follow-ups (be honest before go-live)
1. **No end-to-end browser (Playwright/Cypress) tests** are included; the end-to-end journey is covered over HTTP in `backend/test/e2e.test.ts` and UI behaviour by component tests. Add Playwright before launch.
2. **FCM push notifications:** tokens can be registered (`POST /notifications/fcm-token`) but sending requires a Firebase service account and a sender worker — not wired.
3. **Cloudinary and live Razorpay flows** are implemented against their documented APIs but were **not exercised against the real services** (no credentials). Test-mode verification is required.
4. **Timetable editor UI** is read-only in the portal; periods are managed through `PUT /timetable/section/:id/day/:n`.
5. **Pre-primary-to-secondary content** (classes, history, facilities, faculty, gallery) is intentionally empty until the school supplies it.
6. Data-erasure/retention automation and a legal review of the privacy policy text are still open.
