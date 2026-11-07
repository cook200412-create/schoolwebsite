import {
  Bell, BookOpen, Bus, CalendarCheck, CalendarDays, ClipboardList, FileText, GraduationCap, Landmark, LayoutDashboard, Library,
  LifeBuoy, Mail, Megaphone, MessageSquareText, Settings, ShieldCheck, Users, UserSquare2, Wallet, BarChart3, School, Inbox, Image as ImageIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavItem { href: string; label: string; icon: ComponentType<{ size?: number }>; perms?: string[] }

/** Items appear only when the signed-in role has one of `perms` (the API re-checks every call). */
export const NAV: NavItem[] = [
  { href: '/portal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portal/students', label: 'Students', icon: GraduationCap, perms: ['students:read', 'students:own'] },
  { href: '/portal/admissions', label: 'Admissions', icon: Inbox, perms: ['admissions:read'] },
  { href: '/portal/attendance', label: 'Attendance', icon: CalendarCheck, perms: ['attendance:mark', 'attendance:read', 'attendance:own'] },
  { href: '/portal/leave', label: 'Leave', icon: CalendarDays, perms: ['leave:apply', 'leave:approve'] },
  { href: '/portal/timetable', label: 'Timetable', icon: ClipboardList, perms: ['timetable:read', 'timetable:own'] },
  { href: '/portal/exams', label: 'Examinations', icon: FileText, perms: ['exams:write', 'marks:enter', 'results:publish'] },
  { href: '/portal/results', label: 'Results', icon: ShieldCheck, perms: ['results:own'] },
  { href: '/portal/fees', label: 'Fees', icon: Wallet, perms: ['fees:own', 'fees:read', 'fees:configure'] },
  { href: '/portal/transport', label: 'Transport', icon: Bus, perms: ['transport:own', 'transport:write', 'transport:read'] },
  { href: '/portal/announcements', label: 'Announcements', icon: Megaphone, perms: ['announcements:read'] },
  { href: '/portal/remarks', label: 'Teacher remarks', icon: MessageSquareText, perms: ['remarks:own', 'remarks:write', 'remarks:read'] },
  { href: '/portal/complaints', label: 'Complaints', icon: LifeBuoy, perms: ['complaints:own', 'complaints:manage'] },
  { href: '/portal/messages', label: 'Messages', icon: Mail, perms: ['messages:use'] },
  { href: '/portal/notifications', label: 'Notifications', icon: Bell },
  { href: '/portal/reports', label: 'Reports', icon: BarChart3, perms: ['reports:read'] },
  { href: '/portal/manage/classes', label: 'Academics setup', icon: School, perms: ['academics:write'] },
  { href: '/portal/manage/teachers', label: 'Teachers & staff', icon: UserSquare2, perms: ['teachers:write'] },
  { href: '/portal/manage/gallery', label: 'Website content', icon: ImageIcon, perms: ['cms:write'] },
  { href: '/portal/users', label: 'Users & roles', icon: Users, perms: ['users:read'] },
  { href: '/portal/settings', label: 'School settings', icon: Settings, perms: ['settings:write'] },
  { href: '/portal/audit', label: 'Audit log', icon: Landmark, perms: ['audit:read'] },
];

export const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', school_admin: 'School Administrator', principal: 'Principal', teacher: 'Teacher', parent: 'Parent', student: 'Student',
  accountant: 'Accountant', librarian: 'Librarian', transport_manager: 'Transport Manager', admission_officer: 'Admission Officer',
};
