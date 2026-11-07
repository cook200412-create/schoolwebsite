# Development Roadmap

| Phase | Scope | Exit criteria |
|---|---|---|
| ✅ 1 | Setup, design system, MongoDB connection, env config, public homepage | `npm run dev` runs both apps; homepage renders; `/api/health` OK |
| ✅ 2 | Auth (login/register/reset), RBAC, protected routes, CSRF, rate limits | Auth + authorization tests pass |
| ✅ 3 | Students, parents, teachers, classes, admissions (public form → admin approve → student) | Admission e2e works |
| ✅ 4 | Attendance, timetable, homework, exams, results, PDF marksheets | Teacher→parent result flow works |
| ✅ 5 | Fees, Razorpay + webhooks, receipts, library, transport, staff | Webhook idempotency tests pass |
| ✅ 6 | Announcements, notifications, messaging, calendar | Notifications delivered in-app + email |
| ✅ 7 | Analytics (Recharts), PDF/CSV exports | Dashboards read real aggregates |
| ✅ 8 | Hardening, perf, mobile QA, test suites, deployment docs | All acceptance criteria green |

# UI Page Map

## Public
`/` Home · `/about` · `/academics` · `/admissions` (info) · `/admissions/apply` · `/admissions/track` ·
`/facilities` (anchored sections) · `/faculty` + `/faculty/[id]` · `/gallery` · `/results` ·
`/news` · `/contact` · `/login` · `/forgot-password` · `/reset-password`

## Portal (`/portal`) — implemented as one shell whose menu is filtered by permissions
(`/portal/dashboard`, `students`, `admissions`, `attendance`, `leave`, `timetable`, `homework`, `exams`, `results`, `fees`, `library`, `transport`, `announcements`, `messages`, `notifications`, `reports`, `manage/[classes|sections|subjects|academic-years|events|teachers|staff|gallery|achievements]`, `users`, `settings`, `audit`). The role-specific sections below describe what each role sees.

* Admin – overview, users, roles, settings, CMS, audit
* `/portal/principal` – analytics, leave approval, reports
* `/portal/teacher` – classes, attendance, homework, marks, timetable, messages
* `/portal/parent` – children switcher, attendance, results, homework, fees/pay, leave, messages
* `/portal/student` – profile, timetable, attendance, results, homework
* `/portal/accountant` – fee structures, collections, receipts, reports
* `/portal/librarian` – books, issue/return, fines
* `/portal/transport` – vehicles, routes, assignments
* `/portal/admissions` – applications pipeline, interviews, convert to student
