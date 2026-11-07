import { Card } from '@/components/ui/kit';
import { PageHero } from '@/components/site/page-hero';
import { getSettings } from '@/lib/site';

export const metadata = { title: 'Facilities' };
export const revalidate = 60;

export default async function FacilitiesPage() {
  const s = await getSettings();
  const list = s.facilities ?? [];
  return (
    <>
      <PageHero eyebrow="Campus">School facilities</PageHero>
      <section className="container section">
      {list.length ? (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((f) => (<li key={f.slug} id={f.slug}><Card className="h-full scroll-mt-24"><h2 className="text-xl font-bold">{f.title}</h2><p className="mt-2 text-slate-600">{f.description || 'Details coming soon.'}</p></Card></li>))}
        </ul>
      ) : <p className="mt-8 rounded-2xl border border-dashed border-navy-200 bg-navy-50/50 p-6 text-slate-600">Facilities are listed here once confirmed by the school administration.</p>}
    </section>
    </>
  );
}
