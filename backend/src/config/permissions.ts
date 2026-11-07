export const ROLES = [
  'super_admin', 'school_admin', 'principal', 'teacher', 'parent', 'student',
  'accountant', 'librarian', 'transport_manager', 'admission_officer',
] as const;
export type RoleName = (typeof ROLES)[number];

export const STAFF_ROLES: RoleName[] = ['super_admin', 'school_admin', 'principal', 'teacher', 'accountant', 'librarian', 'transport_manager', 'admission_officer'];

const ADMIN = [
  'users:read', 'users:write', 'roles:read', 'settings:write', 'audit:read', 'cms:write',
  'students:read', 'students:write', 'parents:read', 'parents:write', 'teachers:read', 'teachers:write',
  'staff:read', 'staff:write', 'academics:read', 'academics:write',
  'admissions:read', 'admissions:write', 'attendance:read', 'attendance:mark', 'attendance:correct',
  'timetable:read', 'timetable:write', 'homework:read', 'exams:read', 'exams:write', 'marks:enter', 'results:read', 'results:publish',
  'fees:read', 'fees:configure', 'payments:read', 'payments:record', 'refunds:approve',
  'library:read', 'transport:read', 'announcements:write', 'announcements:read', 'messages:use', 'leave:approve', 'reports:read', 'reports:finance',
  'complaints:manage', 'remarks:read',
];

export const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  super_admin: ['*'],
  school_admin: ADMIN.filter((p) => !['users:write', 'roles:read'].includes(p)).concat(['users:read']),
  principal: [
    'users:read', 'audit:read', 'students:read', 'parents:read', 'teachers:read', 'staff:read', 'academics:read', 'admissions:read',
    'attendance:read', 'timetable:read', 'homework:read', 'exams:read', 'results:read', 'results:publish',
    'fees:read', 'payments:read', 'library:read', 'transport:read', 'announcements:write', 'announcements:read', 'messages:use', 'leave:approve', 'reports:read', 'reports:finance',
    'complaints:manage', 'remarks:read',
  ],
  teacher: [
    'students:read', 'academics:read', 'attendance:read', 'attendance:mark', 'timetable:read', 'homework:read', 'homework:write',
    'exams:read', 'marks:enter', 'results:read', 'announcements:read', 'announcements:class', 'messages:use', 'leave:apply', 'leave:approve-student', 'reports:read', 'library:read', 'remarks:write',
  ],
  parent: [
    'students:own', 'attendance:own', 'timetable:own', 'homework:own', 'results:own', 'fees:own', 'payments:own', 'announcements:read',
    'messages:use', 'leave:apply', 'library:own', 'transport:own', 'academics:read', 'complaints:own', 'remarks:own',
  ],
  student: ['students:own', 'attendance:own', 'timetable:own', 'homework:own', 'homework:submit', 'results:own', 'announcements:read', 'library:own', 'academics:read', 'remarks:own'],
  accountant: ['students:read', 'parents:read', 'academics:read', 'fees:read', 'fees:configure', 'payments:read', 'payments:record', 'refunds:request', 'reports:read', 'reports:finance', 'announcements:read'],
  librarian: ['students:read', 'library:read', 'library:write', 'announcements:read', 'reports:read'],
  transport_manager: ['students:read', 'transport:read', 'transport:write', 'announcements:read', 'announcements:write', 'reports:read'],
  admission_officer: ['admissions:read', 'admissions:write', 'students:read', 'students:write', 'parents:write', 'parents:read', 'academics:read', 'announcements:read', 'reports:read'],
};

export const hasPermission = (perms: string[], needed: string) => perms.includes('*') || perms.includes(needed);
