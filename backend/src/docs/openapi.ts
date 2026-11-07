/** Compact OpenAPI 3 description generated from an endpoint table (kept next to the routers it documents). */
type Row = [method: string, path: string, summary: string, auth: 'public' | 'session'];

const rows: Row[] = [
  ['get', '/health', 'Health check', 'public'],
  ['post', '/auth/register', 'Parent self-registration (consent required)', 'public'],
  ['post', '/auth/login', 'Login (sets HTTP-only cookies)', 'public'],
  ['post', '/auth/refresh', 'Rotate refresh token', 'public'],
  ['post', '/auth/logout', 'Logout', 'public'],
  ['post', '/auth/forgot-password', 'Request password reset email', 'public'],
  ['post', '/auth/reset-password', 'Reset password with token', 'public'],
  ['get', '/auth/me', 'Current user & permissions', 'session'],
  ['post', '/auth/change-password', 'Change password', 'session'],
  ['get', '/users', 'List users', 'session'], ['post', '/users', 'Create user with temporary password', 'session'],
  ['patch', '/users/{id}', 'Update role / status', 'session'], ['delete', '/users/{id}', 'Soft-delete user', 'session'],
  ['get', '/roles', 'List roles & permissions', 'session'], ['put', '/roles/{name}', 'Edit role permissions (Super Admin)', 'session'],
  ['get', '/students', 'List students (scoped by role)', 'session'], ['post', '/students', 'Create student', 'session'],
  ['get', '/students/{id}', 'Student profile (ownership enforced)', 'session'], ['patch', '/students/{id}', 'Update student', 'session'],
  ['post', '/students/import', 'CSV import', 'session'], ['get', '/students/export', 'CSV export', 'session'],
  ['post', '/students/promote', 'Promote students', 'session'], ['post', '/students/{id}/transfer', 'Transfer student', 'session'],
  ['post', '/students/{id}/archive', 'Archive student', 'session'], ['get', '/students/{id}/id-card', 'ID card PDF', 'session'],
  ['get', '/parents', 'List parents', 'session'], ['get', '/parents/me/children', 'My children', 'session'], ['post', '/parents/{id}/link-student', 'Link a child to a parent', 'session'],
  ['get', '/teachers', 'List teachers', 'session'], ['get', '/teachers/public', 'Public faculty directory', 'public'], ['put', '/teachers/{id}/assignments', 'Assign classes/subjects', 'session'],
  ['post', '/admissions/enquiries', 'Admission/contact enquiry', 'public'], ['post', '/admissions/applications', 'Submit application (multipart)', 'public'],
  ['get', '/admissions/track/{applicationNumber}', 'Track application (needs phone)', 'public'], ['get', '/admissions', 'List applications', 'session'],
  ['patch', '/admissions/{id}/status', 'Update status', 'session'], ['post', '/admissions/{id}/notes', 'Add internal note', 'session'],
  ['post', '/admissions/{id}/interview', 'Schedule interview', 'session'], ['post', '/admissions/{id}/convert', 'Convert to student (transaction)', 'session'],
  ['get', '/admissions/{id}/letter', 'Admission letter PDF', 'session'],
  ['post', '/attendance/mark', 'Mark attendance (no duplicates)', 'session'], ['get', '/attendance/class', 'Class attendance for a date', 'session'],
  ['get', '/attendance/student/{id}', 'Student attendance & percentage', 'session'], ['patch', '/attendance/{id}/correct', 'Correct attendance (audited)', 'session'],
  ['get', '/attendance/report/monthly', 'Monthly report (json/csv)', 'session'],
  ['post', '/leave', 'Apply for leave', 'session'], ['get', '/leave', 'List leave', 'session'], ['patch', '/leave/{id}/decide', 'Approve/reject leave', 'session'],
  ['post', '/examinations', 'Create examination', 'session'], ['post', '/examinations/{id}/marks', 'Enter marks', 'session'],
  ['post', '/examinations/{id}/submit', 'Submit for approval', 'session'], ['post', '/examinations/{id}/approve', 'Approve', 'session'],
  ['post', '/examinations/{id}/publish', 'Publish to parents', 'session'], ['post', '/examinations/{id}/reopen', 'Reopen with reason', 'session'],
  ['get', '/results/student/{id}', 'Student results (published only for parents/students)', 'session'],
  ['get', '/results/student/{id}/marksheet.pdf', 'Marksheet PDF', 'session'], ['get', '/results/class/{examId}/rankings', 'Class rankings', 'session'],
  ['post', '/fees/structures', 'Create fee structure', 'session'], ['post', '/fees/assign', 'Assign fees', 'session'], ['get', '/fees/student/{studentId}', 'Student fee ledger', 'session'],
  ['post', '/payments/orders', 'Create gateway order (idempotent)', 'session'], ['post', '/payments/offline', 'Record offline payment', 'session'],
  ['post', '/payments/webhook/razorpay', 'Razorpay webhook (HMAC verified)', 'public'], ['get', '/payments/{id}/receipt.pdf', 'Receipt PDF', 'session'],
  ['post', '/payments/{id}/refund-request', 'Request refund', 'session'], ['post', '/payments/{id}/refund-decision', 'Approve/reject refund', 'session'],
  ['post', '/homework', 'Create homework', 'session'], ['post', '/homework/{id}/submit', 'Submit homework', 'session'],
  ['post', '/assignments', 'Create assignment', 'session'], ['post', '/assignments/{id}/submit', 'Submit assignment', 'session'],
  ['get', '/timetable/section/{sectionId}', 'Section timetable', 'session'],
  ['get', '/announcements/public', 'Public announcements', 'public'], ['post', '/announcements', 'Create announcement', 'session'],
  ['get', '/notifications', 'My notifications', 'session'], ['post', '/messages', 'Send message (relationship restricted)', 'session'],
  ['post', '/library/issue', 'Issue book', 'session'], ['post', '/library/return/{issueId}', 'Return book (fine)', 'session'],
  ['post', '/transport/assign', 'Assign students to route', 'session'],
  ['get', '/reports/dashboard', 'Dashboard counters', 'session'], ['get', '/reports/fee-collection', 'Collections (json/csv/pdf)', 'session'],
  ['get', '/settings/public', 'Public site settings', 'public'], ['put', '/settings', 'Update settings', 'session'],
];

const paths: Record<string, Record<string, unknown>> = {};
for (const [method, path, summary, auth] of rows) {
  (paths[path] ??= {})[method] = {
    summary, tags: [path.split('/')[1]],
    security: auth === 'public' ? [] : [{ cookieAuth: [] }],
    responses: { '200': { description: 'OK' }, '401': { description: 'Unauthenticated' }, '403': { description: 'Forbidden' }, '422': { description: 'Validation error' } },
  };
}

export const openApiSpec = {
  openapi: '3.0.3',
  info: { title: 'Sri Satya Sai Vidyanikethan – School API', version: '1.0.0', description: 'All responses use { success, data, meta } / { success:false, error }. Unsafe requests with cookie auth need the X-CSRF-Token header (value of the csrf_token cookie).' },
  servers: [{ url: '/api' }],
  components: { securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' } } },
  paths,
};
