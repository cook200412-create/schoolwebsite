import { Card } from '@/components/ui/kit';
import { PageHero } from '@/components/site/page-hero';
import { fetchPublic } from '@/lib/api';
import { getSettings } from '@/lib/site';

export const metadata = { title: 'Academics' };
export const revalidate = 60;

const LEVELS: Record<string, string> = { 'pre-primary': 'Pre-primary', primary: 'Primary', middle: 'Middle', secondary: 'Secondary' };

export default async function AcademicsPage() {
  const [s, a] = await Promise.all([getSettings(), fetchPublic<any>('/public/academics')]);
  const classes: any[] = a?.classes ?? [];
  const c = a?.content ?? {};
  const grouped = Object.keys(LEVELS).map((k) => ({ k, items: classes.filter((x) => x.level === k) })).filter((g) => g.items.length);
  const blocks = [['Curriculum & philosophy', c.philosophy], ['Teaching methodology', c.methodology], ['Examination system', c.examinationSystem]].filter(([, v]) => v);
  return (
    <>
      <PageHero eyebrow="Academics">Learning at {s.shortName ?? s.schoolName}</PageHero>
      <section className="container section">
      {a?.academicYear && <p className="mt-2 text-slate-600">Academic year {a.academicYear}</p>}
      {grouped.length ? grouped.map((g) => (
        <div key={g.k} className="mt-10">
          <h2 className="text-2xl font-bold">{LEVELS[g.k]} section</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((cl) => (
              <li key={cl.name}><Card className="h-full"><h3 className="text-lg font-bold">Class {cl.name}</h3>{cl.description && <p className="mt-1 text-sm text-slate-600">{cl.description}</p>}{cl.curriculum && <p className="mt-2 text-sm"><b>Curriculum:</b> {cl.curriculum}</p>}</Card></li>
            ))}
          </ul>
        </div>
      )) : <p className="mt-8 rounded-2xl border border-dashed border-navy-200 bg-navy-50/50 p-6 text-slate-600">Class and curriculum details will appear here once published by the school administration.</p>}
      {!!a?.subjects?.length && <div className="mt-10"><h2 className="text-2xl font-bold">Subjects</h2><ul className="mt-4 flex flex-wrap gap-2">{a.subjects.map((x: any) => <li key={x.code} className="rounded-full bg-sky-100 px-4 py-1.5 text-sm font-medium text-sky-800">{x.name}</li>)}</ul></div>}
      <div className="mt-10 grid gap-6 md:grid-cols-2">{blocks.map(([t, v]) => <Card key={t as string}><h2 className="text-xl font-bold">{t}</h2><p className="mt-2 whitespace-pre-line text-slate-600">{v}</p></Card>)}</div>
    </section>
    </>
  );
}
