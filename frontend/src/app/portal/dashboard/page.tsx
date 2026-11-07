'use client';

import { CalendarCheck, GraduationCap, Inbox, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Alert, Card, Empty, PageHeader, PageLoader, Stat, money } from '@/components/ui/kit';
import { ROLE_LABEL } from '@/features/portal/nav';
import { ParentStudentDashboard } from '@/features/portal/family-dashboard';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';

const NAVY = '#12326a';
const SKY = '#0ea5e9';
const GOLD = '#d9ad26';

function Chart({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card>
      <h2 className="mb-3 font-sans text-base font-semibold">{title}</h2>
      <div className="h-64 w-full"><ResponsiveContainer>{children}</ResponsiveContainer></div>
    </Card>
  );
}

export default function Dashboard() {
  const { user, can } = useAuth();
  const staff = can('reports:read');
  const dash = useApi<any>(staff ? '/reports/dashboard' : null);
  const trend = useApi<{ month: string; percentage: number }[]>(can('attendance:read') ? '/reports/attendance-trend' : null);
  const enroll = useApi<{ byClass: { class: string; count: number }[] }>(can('students:read') ? '/reports/enrollment' : null);
  const fees = useApi<{ period: string; total: number }[]>(can('reports:finance') ? '/reports/fee-collection?by=month' : null);
  const funnel = useApi<{ byStatus: { status: string; count: number }[]; conversionRate: number; total: number }>(can('admissions:read') ? '/reports/admission-funnel' : null);

  if (!user) return null;
  const d = dash.data ?? {};
  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(' ')[0]}`} subtitle={ROLE_LABEL[user.role]} />
      {!staff && <ParentStudentDashboard />}
      {staff && (dash.loading ? <PageLoader /> : dash.error ? <Alert>{dash.error}</Alert> : (
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {d.students !== undefined && <Stat label="Students" value={d.students} icon={<GraduationCap size={20} />} />}
            {d.teachers !== undefined && <Stat label="Teachers" value={d.teachers} icon={<Users size={20} />} />}
            {d.staff !== undefined && <Stat label="Staff" value={d.staff} icon={<Users size={20} />} />}
            {d.classes !== undefined && <Stat label="Classes" value={d.classes} />}
            {d.attendanceToday && <Stat label="Attendance today" value={d.attendanceToday.percentage === null ? '—' : `${d.attendanceToday.percentage}%`} hint={`${d.attendanceToday.total} marked`} icon={<CalendarCheck size={20} />} />}
            {d.feeCollectionThisMonth && <Stat label="Collected this month" value={money(d.feeCollectionThisMonth.total)} hint={`${d.feeCollectionThisMonth.count} payments`} icon={<Wallet size={20} />} />}
            {d.pendingFees && <Stat label="Pending fees" value={money(d.pendingFees.pending)} />}
            {d.admissions && <Stat label="New applications" value={d.admissions.submitted ?? 0} hint={`${d.admissions.under_review ?? 0} under review`} icon={<Inbox size={20} />} />}
            {d.vehicles !== undefined && <Stat label="Vehicles" value={d.vehicles} />}
            {d.library && <Stat label="Books issued" value={d.library.issued} hint={`${d.library.books} titles`} />}
          </div>

          {(d.pendingLeaves > 0 || d.examsAwaitingApproval > 0 || d.admissions?.submitted > 0) && (
            <Card>
              <h2 className="mb-2 font-sans text-base font-semibold">Pending tasks</h2>
              <ul className="grid gap-1 text-sm">
                {d.pendingLeaves > 0 && <li><Link className="text-sky-700 hover:underline" href="/portal/leave">{d.pendingLeaves} leave request(s) awaiting decision</Link></li>}
                {d.examsAwaitingApproval > 0 && <li><Link className="text-sky-700 hover:underline" href="/portal/exams">{d.examsAwaitingApproval} examination(s) awaiting approval/publishing</Link></li>}
                {d.admissions?.submitted > 0 && <li><Link className="text-sky-700 hover:underline" href="/portal/admissions">{d.admissions.submitted} new admission application(s)</Link></li>}
              </ul>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {trend.data && (trend.data.length ? (
              <Chart title="Monthly attendance %">
                <LineChart data={trend.data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis domain={[0, 100]} /><Tooltip /><Line type="monotone" dataKey="percentage" stroke={NAVY} strokeWidth={2} /></LineChart>
              </Chart>) : <Empty>No attendance recorded yet.</Empty>)}
            {enroll.data && (enroll.data.byClass.length ? (
              <Chart title="Enrollment by class">
                <BarChart data={enroll.data.byClass}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="class" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill={SKY} radius={[6, 6, 0, 0]} /></BarChart>
              </Chart>) : null)}
            {fees.data && (fees.data.length ? (
              <Chart title="Monthly fee collection (₹)">
                <BarChart data={fees.data.map((f) => ({ ...f, rupees: f.total / 100 }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis /><Tooltip /><Bar dataKey="rupees" fill={GOLD} radius={[6, 6, 0, 0]} /></BarChart>
              </Chart>) : <Empty>No payments recorded yet.</Empty>)}
            {funnel.data && (funnel.data.total ? (
              <Chart title={`Admission pipeline · conversion ${funnel.data.conversionRate}%`}>
                <BarChart data={funnel.data.byStatus} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="status" width={120} /><Tooltip /><Bar dataKey="count" fill={NAVY} radius={[0, 6, 6, 0]} /></BarChart>
              </Chart>) : null)}
          </div>

          {Array.isArray(d.recentActivity) && (
            <Card>
              <h2 className="mb-3 font-sans text-base font-semibold">Recent activity</h2>
              <ul className="divide-y text-sm">
                {d.recentActivity.map((a: any) => <li key={a._id} className="flex justify-between gap-3 py-2"><span><b>{a.actor?.name ?? 'System'}</b> · {a.action}</span><time className="text-slate-500">{new Date(a.createdAt).toLocaleString('en-IN')}</time></li>)}
              </ul>
            </Card>
          )}
        </div>
      ))}
    </>
  );
}
