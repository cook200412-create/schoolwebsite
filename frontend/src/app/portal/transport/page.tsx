'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, Card, DataTable, Empty, Field, Input, Modal, PageHeader, PageLoader, money } from '@/components/ui/kit';
import { ChildPicker, StudentPicker } from '@/features/portal/shared';
import { useApi } from '@/hooks/use-api';
import { useAuth } from '@/hooks/use-auth';
import { api, errorMessage } from '@/lib/client';

function Manager() {
  const vehicles = useApi<any[]>('/vehicles?limit=50');
  const routes = useApi<any[]>('/routes?limit=50');
  const [assign, setAssign] = useState<any | null>(null);
  const roster = useApi<any[]>(assign ? `/transport/routes/${assign._id}/students` : null);
  const [student, setStudent] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [vOpen, setVOpen] = useState(false);
  const [v, setV] = useState({ registrationNumber: '', type: 'Bus', capacity: 40, driverName: '', driverPhone: '' });
  return (
    <>
      {msg && <div className="mb-3"><Alert tone="info">{msg}</Alert></div>}
      <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-bold">Vehicles</h2><Button size="sm" onClick={() => setVOpen(true)}>Add vehicle</Button></div>
      {vehicles.loading ? <PageLoader /> : <DataTable rows={vehicles.data ?? []} columns={[{ key: 'registrationNumber', label: 'Registration' }, { key: 'type', label: 'Type' }, { key: 'capacity', label: 'Seats' }, { key: 'd', label: 'Driver', render: (r) => `${r.driver?.name ?? '—'} ${r.driver?.phone ?? ''}` }]} />}
      <h2 className="mb-2 mt-8 text-lg font-bold">Routes</h2>
      <DataTable rows={routes.data ?? []} columns={[{ key: 'name', label: 'Route' }, { key: 'v', label: 'Vehicle', render: (r) => r.vehicle?.registrationNumber ?? '—' }, { key: 's', label: 'Stops', render: (r) => r.stops?.length ?? 0 }, { key: 'monthlyFee', label: 'Monthly fee', render: (r) => money(r.monthlyFee) }, { key: 'a', label: '', render: (r) => <Button size="sm" variant="outline" onClick={() => { setAssign(r); setStudent(''); }}>Students</Button> }]} />
      <Modal open={!!assign} onClose={() => setAssign(null)} title={`Route: ${assign?.name ?? ''}`}>
        <div className="grid gap-3"><StudentPicker value={student} onChange={(id) => setStudent(id)} />
          <Button disabled={!student} onClick={async () => { try { await api('/transport/assign', { body: { routeId: assign._id, studentIds: [student] } }); setStudent(''); roster.reload(); } catch (e) { setMsg(errorMessage(e)); } }}>Assign to route</Button>
          <ul className="text-sm">{(roster.data ?? []).map((s) => <li key={s._id} className="flex justify-between border-b py-2"><span>{s.firstName} {s.lastName} · {s.class?.name}-{s.section?.name}</span><button className="text-red-600" onClick={async () => { await api('/transport/assign', { body: { routeId: null, studentIds: [s._id] } }); roster.reload(); }}>Remove</button></li>)}</ul>
        </div>
      </Modal>
      <Modal open={vOpen} onClose={() => setVOpen(false)} title="Add vehicle">
        <form className="grid gap-3" onSubmit={async (e) => { e.preventDefault(); try { await api('/vehicles', { body: { registrationNumber: v.registrationNumber, type: v.type, capacity: v.capacity, driver: { name: v.driverName, phone: v.driverPhone } } }); setVOpen(false); vehicles.reload(); } catch (er) { setMsg(errorMessage(er)); setVOpen(false); } }}>
          <Field label="Registration number"><Input required value={v.registrationNumber} onChange={(e) => setV({ ...v, registrationNumber: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Type"><Input value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })} /></Field><Field label="Capacity"><Input type="number" value={v.capacity} onChange={(e) => setV({ ...v, capacity: Number(e.target.value) })} /></Field><Field label="Driver name"><Input value={v.driverName} onChange={(e) => setV({ ...v, driverName: e.target.value })} /></Field><Field label="Driver phone"><Input value={v.driverPhone} onChange={(e) => setV({ ...v, driverPhone: e.target.value })} /></Field></div>
          <Button>Save vehicle</Button>
        </form>
      </Modal>
    </>
  );
}

function Family() {
  const [child, setChild] = useState('');
  const info = useApi<any>(child ? `/transport/student/${child}` : null);
  return (
    <>
      <div className="mb-4"><ChildPicker value={child} onChange={setChild} /></div>
      {info.loading ? <PageLoader /> : !info.data ? <Empty>No school transport is assigned to this student.</Empty> : (
        <Card><h2 className="font-sans text-lg font-semibold">{info.data.name}</h2><p className="text-sm text-slate-600">Bus: {info.data.vehicle?.registrationNumber ?? '—'}</p>
          <ol className="mt-3 grid gap-1 text-sm">{(info.data.stops ?? []).sort((a: any, b: any) => a.order - b.order).map((s: any) => <li key={s.order} className="flex justify-between rounded-lg bg-navy-50/60 px-3 py-2"><span>{s.order}. {s.name}</span><span>{s.pickupTime}</span></li>)}</ol>
          <p className="mt-3 text-xs text-slate-500">For safety, live vehicle location is not shown.</p></Card>
      )}
    </>
  );
}

export default function TransportPage() {
  const { can } = useAuth();
  return <><PageHeader title="Transport" />{can('transport:write') ? <Manager /> : can('transport:own') ? <Family /> : <Empty>Transport is managed by the transport manager.</Empty>}</>;
}
