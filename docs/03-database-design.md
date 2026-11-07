# Database Relationship Diagram

```mermaid
erDiagram
  User ||--o| Teacher : "is"
  User ||--o| Parent : "is"
  User ||--o| Student : "is"
  User ||--o| Staff : "is"
  User }o--|| Role : "has"
  Role }o--o{ Permission : "grants"

  Parent }o--o{ Student : "guardian of"
  AcademicYear ||--o{ Class : "contains"
  Class ||--o{ Section : "has"
  Section ||--o{ Student : "enrolls"
  Class ||--o{ Subject : "teaches"
  Teacher }o--o{ Section : "assigned (with Subject)"

  Admission ||--o| Student : "converts to"
  Student ||--o{ Attendance : "has"
  Section ||--o{ Attendance : "daily"
  Section ||--o{ Timetable : "weekly"
  Subject ||--o{ Timetable : "period"
  Teacher ||--o{ Timetable : "period"

  Examination ||--o{ ExamResult : "produces"
  Student ||--o{ ExamResult : "scores"
  Subject ||--o{ ExamResult : "in"

  FeeStructure ||--o{ Payment : "billed via"
  Student ||--o{ Payment : "pays"

  Teacher ||--o{ Homework : "assigns"
  Section ||--o{ Homework : "for"
  Homework ||--o{ Assignment : "has"
  Assignment ||--o{ AssignmentSubmission : "receives"
  Student ||--o{ AssignmentSubmission : "submits"

  User ||--o{ Notification : "receives"
  User ||--o{ Message : "sends / receives"
  Student ||--o{ LeaveApplication : "on"
  Book ||--o{ BookIssue : "issued as"
  Student ||--o{ BookIssue : "borrows"
  TransportRoute ||--o{ Vehicle : "served by"
  Student }o--o| TransportRoute : "rides"
  User ||--o{ AuditLog : "performs"
```

## Collections (33)

Users, Roles, Permissions, Students, Parents, Teachers, Staff, Classes, Sections, Subjects,
AcademicYears, Admissions, Attendance, Examinations, ExamResults, FeeStructures, Payments,
Homework, Assignments, AssignmentSubmissions, Timetables, Announcements, Notifications,
Messages, Events, LeaveApplications, Books, BookIssues, Vehicles, TransportRoutes,
Documents, AuditLogs, SchoolSettings.

## Cross-cutting conventions

* `timestamps: true` on every schema.
* Soft delete via `deletedAt` + `deletedBy` and a query helper that hides deleted rows by default.
* Unique constraints: `User.email`, `Student.admissionNumber`, `Admission.applicationNumber`,
  `Payment.transactionId`, `Attendance (student, date)`, `ExamResult (examination, student, subject)`,
  `Book.isbn`, `Admission` duplicate guard on (`studentName`, `dob`, `guardianPhone`, `academicYear`).
* Money stored as **integer paise**.
* Dates for attendance are stored as `YYYY-MM-DD` strings in IST to avoid timezone drift.
* Transactions used in: admission→student conversion, payment confirmation, promotion, refunds.
