# Sri Satya Sai Vidyanikethan – Smart School Management Platform

Monorepo: `frontend/` (Next.js 15 App Router, Tailwind, React Hook Form + Zod, Recharts) · `backend/` (Express + Mongoose, TypeScript) · `shared/types` · `docs/` · `scripts/`.

## What is built (all 8 phases)
* **Public website:** home, about, academics, admissions (info, online application with document upload, status tracking), facilities (confirmed only), faculty + profiles, gallery (consent-gated), results & achievements, news/events, contact enquiry form.
* **Portal (role-based, all data from MongoDB):** Super Admin, School Admin, Principal, Teacher, Parent, Student, Accountant, Librarian, Transport Manager, Admission Officer — dashboards with Recharts, students, admissions pipeline → student + parent account, attendance & leave, timetable, homework/assignments, exams → marks → approve → publish → marksheet PDF, fees → Razorpay order → verified webhook → receipt PDF, refunds, library, transport, announcements, notifications, messaging, reports/CSV/PDF exports, users & role permissions, school settings/CMS, audit log.
* **Security:** argon2id, HTTP-only rotating-refresh sessions, CSRF, RBAC + ownership rules on every API, rate limits, upload magic-byte checks, audit logs. See `docs/07-security-and-data-protection.md`.
* **Tests:** 81 backend integration tests (real MongoDB replica set in memory) + 14 frontend tests. See "Known limitations" in the security doc.

## Run it in one minute (no database install needed)
Requires Node 20+.
```bash
cd backend && npm install && npm run dev:memory     # API on :5000, in-memory MongoDB, fictional demo data
```
```bash
cd frontend && npm install && npm run dev           # site on :3000 (copy .env.example to .env.local if the API is elsewhere)
```
Demo logins (password `Demo@12345678`): `parent@demo.school`, `teacher@demo.school`, `student@demo.school`, `school.admin@demo.school`, `super.admin@demo.school`, `principal@demo.school`, `accountant@demo.school`, `librarian@demo.school`, `transport.manager@demo.school`, `admission.officer@demo.school`.
The parent sees *Rahul Kumar* (Class 8, 341/400 = 85.25 %) and *Ananya Reddy* — fictional records.

## Run with a real database
```bash
cd backend
cp .env.example .env            # set MONGODB_URI (Atlas or local replica set), JWT secrets (≥32 chars), CLIENT_ORIGINS
npm install
npm run seed                    # optional fictional demo data (dev only)
npm run dev                     # http://localhost:5000/api/health   ·   Swagger: /api/docs
```
Transactions need a replica set (Atlas always is; for local mongod run it with `--replSet`).
Production bootstrap: `ADMIN_EMAIL=... npm run create-admin`.

## Checks
```bash
cd backend  && npm test && npm run build      # 81 tests
cd frontend && npm test && npm run build      # 14 tests
```

## Needs your configuration (not invented)
School address/phone/email/map, logo & hero image, principal's message, facilities (tick *confirmed*), faculty (tick *public*), gallery (with guardian consent), classes/sections/subjects, fee structures; **external accounts:** MongoDB Atlas, Cloudinary, SMTP email provider, Razorpay (test mode first), Firebase (push — not wired).

## Docs
`docs/01-architecture.md` · `02-role-permission-matrix.md` · `03-database-design.md` · `04-api-specification.md` · `05-roadmap-and-page-map.md` · `06-deployment.md` · `07-security-and-data-protection.md`
