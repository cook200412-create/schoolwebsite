# API Specification (summary)

Base URL: `/api`. All routes except those marked **public** require an authenticated session cookie.
Machine-readable docs are served at `/api/docs` (Swagger UI) from `backend/src/docs/openapi.ts`.

| Module | Endpoints |
|---|---|
| **/health** (public) | `GET /health` |
| **/auth** | `POST /register` (parent self-registration via verified student link / admin invite) · `POST /login` · `POST /refresh` · `POST /logout` · `POST /forgot-password` · `POST /reset-password` · `GET /me` · `POST /change-password` |
| **/users** | CRUD, `PATCH /:id/role`, `PATCH /:id/status` |
| **/students** | CRUD, `POST /import` (CSV), `GET /export`, `POST /:id/transfer`, `POST /promote`, `POST /:id/archive`, `GET /:id/id-card` |
| **/parents** | CRUD, `POST /:id/link-student` |
| **/teachers** | CRUD, `PUT /:id/assignments` |
| **/classes**, **/subjects** | CRUD for classes, sections, subjects, academic years |
| **/admissions** | **public** `POST /enquiries`, `POST /applications`, `GET /track/:applicationNo`; staff: list/filter, `PATCH /:id/status`, `POST /:id/notes`, `POST /:id/interview`, `POST /:id/convert`, `GET /:id/letter` |
| **/attendance** | `POST /mark`, `GET /class`, `GET /student/:id`, `PATCH /:id/correct`, `GET /report/monthly` |
| **/examinations** | CRUD exams, subject config, `POST /:id/marks`, `POST /:id/submit`, `POST /:id/approve`, `POST /:id/publish` |
| **/results** | `GET /student/:id`, `GET /student/:id/marksheet.pdf`, `GET /class/:id/rankings` |
| **/fees** | structures CRUD, student ledger, concessions, late fees |
| **/payments** | `POST /orders`, `POST /offline`, `POST /webhook/razorpay` (public, signature-verified), `GET /:id/receipt.pdf`, refunds |
| **/homework**, **/assignments** | create/list/submit/review |
| **/timetable** | class timetable CRUD, teacher view |
| **/announcements** | CRUD + publish; **public** `GET /public` |
| **/notifications** | list, `PATCH /:id/read`, `POST /read-all`, FCM token registration |
| **/messages** | threads, send, mark read (relationship-restricted) |
| **/library** | books, categories, issue, return, fines |
| **/transport** | vehicles, drivers, routes, stops, assignments |
| **/reports** | analytics aggregates, CSV/PDF exports |
| **/settings** | **public** `GET /public`; admin `PUT /` , website content, faculty, facilities, gallery |

Conventions: `?page=&limit=&sort=&q=`; validation errors → `422` with `details[]`;
authz failures → `403`; unauthenticated → `401`; duplicates → `409`.
