# Role – Permission Matrix

Legend: **F** full, **R** read, **O** own/linked records only, **A** assigned classes only, **–** none.

| Module | Super Admin | School Admin | Principal | Teacher | Parent | Student | Accountant | Librarian | Transport | Adm. Officer |
|---|---|---|---|---|---|---|---|---|---|---|
| Users & roles | F | R | – | – | – | – | – | – | – | – |
| System settings / website CMS | F | F | R | – | – | – | – | – | – | – |
| Audit logs | F | R | R | – | – | – | – | – | – | – |
| Students | F | F | R | A (R) | O (R) | O (R) | R (fees) | R (name/class) | R (transport) | create from admission |
| Parents | F | F | R | A (R contact) | O | – | R | – | – | create |
| Teachers / Staff | F | F | R | O | – | – | – | – | – | – |
| Classes / Sections / Subjects | F | F | R | R | R | R | R | – | – | R |
| Admissions | F | F | R | – | O (own application) | – | R | – | F | F |
| Attendance | F | F | R | A (mark/edit same day) | O (R) | O (R) | – | – | – | – |
| Attendance correction | F | F | – | – | – | – | – | – | – | – |
| Timetable | F | F | R | R (own) | O (R) | O (R) | – | – | – | – |
| Homework / Assignments | R | R | R | A (F) | O (R) | O (R, submit) | – | – | – | – |
| Examinations (create/config) | F | F | R | – | – | – | – | – | – | – |
| Marks entry | – | F | – | A (own subjects) | – | – | – | – | – | – |
| Result approval / publish | F | F | F | – | – | – | – | – | – | – |
| Results view | F | F | F | A | O (published) | O (published) | – | – | – | – |
| Fee structure | F | F | R | – | O (R) | – | F | – | – | – |
| Payments / receipts | R | R | R | – | O (pay, R) | – | F | – | – | – |
| Refunds | F | – | – | – | – | – | F (request) → Admin approve | – | – | – |
| Library | R | R | R | R | O (R) | O (R) | – | F | – | – |
| Transport | R | R | R | – | O (R) | – | R | – | F | – |
| Announcements | F | F | F | A (class) | O (R) | O (R) | – | – | F (transport) | F (admission) |
| Messages | F | F | F | A | O (authorised staff) | – | – | – | – | – |
| Leave applications | F | F | F (approve staff) | O (apply) / A (approve student) | O (submit for child) | – | – | – | – | – |
| Reports & exports | F | F | F | A | – | – | F (finance) | F (library) | F (transport) | F (admissions) |

## Permission keys

`resource:action` strings, e.g. `students:read`, `students:write`, `attendance:mark`,
`attendance:correct`, `marks:enter`, `results:publish`, `fees:configure`, `payments:verify`,
`settings:write`, `audit:read`. The mapping role → permissions is defined once in
`backend/src/config/permissions.ts` and mirrored into the `Roles` / `Permissions` collections by the seed script,
so Super Admin can adjust it at runtime.

## Ownership rules (enforced in services, not UI)

1. `Parent` access to a student requires `student._id ∈ parent.children`.
2. `Student` access requires `student.user == req.user.id`.
3. `Teacher` access to a class requires an entry in `teacher.assignments` for (class, section[, subject]).
4. Published results only: parents/students never see `draft` or `approved-unpublished` results.
5. Published results are immutable; changes require a *reopen* by Principal with an audit reason.
