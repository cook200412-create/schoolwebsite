import { fetchPublic } from '@/lib/api';
import { PageHero } from '@/components/site/page-hero';

export const metadata = { title: 'Gallery' };
export const revalidate = 60;

const CATS = ['campus', 'classroom', 'sports', 'annual-day', 'cultural', 'trips', 'competitions'];

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const cat = CATS.includes(category ?? '') ? category : undefined;
  const items = (await fetchPublic<any[]>(`/public/gallery${cat ? `?category=${cat}` : ''}`)) ?? [];
  return (
    <>
      <PageHero eyebrow="Gallery">Life at school</PageHero>
      <section className="container section">
      <nav aria-label="Gallery categories" className="mt-6 flex flex-wrap gap-2">
        {[undefined, ...CATS].map((c) => (
          <a key={c ?? 'all'} href={c ? `/gallery?category=${c}` : '/gallery'} className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize ${c === cat ? 'bg-navy-800 text-white' : 'bg-white text-slate-600 shadow-card hover:bg-navy-50'}`}>{c ? c.replace('-', ' ') : 'All'}</a>
        ))}
      </nav>
      {items.length ? (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {items.map((g) => (
            <li key={g._id} className="overflow-hidden rounded-2xl bg-white shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.url} alt={g.caption ?? g.category} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              {g.caption && <p className="p-3 text-sm text-slate-600">{g.caption}</p>}
            </li>
          ))}
        </ul>
      ) : <p className="mt-8 rounded-2xl border border-dashed border-navy-200 bg-navy-50/50 p-6 text-slate-600">Photos are published here after review and parental consent.</p>}
    </section>
    </>
  );
}
