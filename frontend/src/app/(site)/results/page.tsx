import { Card } from '@/components/ui/kit';
import { PageHero } from '@/components/site/page-hero';
import { fetchPublic } from '@/lib/api';

export const metadata = { title: 'Results and Achievements' };
export const revalidate = 60;

const TITLES: Record<string, string> = { academic: 'Academic achievements', topper: 'Toppers', award: 'Awards', competition: 'Competition achievements', statistic: 'Examination statistics' };

export default async function ResultsPage() {
  const items = (await fetchPublic<any[]>('/public/achievements')) ?? [];
  return (
    <>
      <PageHero eyebrow="Achievements">Results & achievements</PageHero>
      <section className="container section">
      <p className="mt-2 text-slate-600">Only results approved for publication are shown. Individual marksheets are private to families.</p>
      {items.length ? Object.keys(TITLES).map((k) => {
        const g = items.filter((i) => i.category === k);
        return g.length ? (
          <div key={k} className="mt-10"><h2 className="text-2xl font-bold">{TITLES[k]}</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{g.map((i) => <li key={i._id}><Card className="h-full"><h3 className="font-sans text-lg font-semibold">{i.title}</h3>{i.studentName && <p className="text-sm font-medium text-navy-700">{i.studentName}</p>}{i.year && <p className="text-xs text-slate-500">{i.year}</p>}{i.description && <p className="mt-2 text-sm text-slate-600">{i.description}</p>}</Card></li>)}</ul></div>
        ) : null;
      }) : <p className="mt-8 rounded-2xl border border-dashed border-navy-200 bg-navy-50/50 p-6 text-slate-600">Approved results and achievements will be published here.</p>}
    </section>
    </>
  );
}
