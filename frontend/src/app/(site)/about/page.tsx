import { getSettings } from '@/lib/site';
import { PageHero } from '@/components/site/page-hero';

export const metadata = { title: 'About Us' };
export const revalidate = 60;

export default async function AboutPage() {
  const s = await getSettings();
  return (
    <>
      <PageHero eyebrow="About us">{s.schoolName}</PageHero>
      <section className="container section">
      <p className="mt-4 max-w-2xl text-lg text-slate-600">{s.tagline}</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <article className="card border-t-4 border-t-gold-400"><h2 className="text-2xl font-bold">Vision</h2><p className="mt-3">{s.vision}</p></article>
        <article className="card border-t-4 border-t-gold-400"><h2 className="text-2xl font-bold">Mission</h2><p className="mt-3">{s.mission}</p></article>
      </div>
      {s.principal?.message && (
        <article className="card mt-6">
          <h2 className="text-2xl font-bold">Principal&apos;s message</h2>
          <p className="mt-3">{s.principal.message}</p>
          <p className="mt-3 font-semibold text-navy-800">{s.principal.name}</p>
        </article>
      )}
      {([['Our history', (s as any).academicContent?.history], ['Educational philosophy', (s as any).academicContent?.philosophy], ['Infrastructure', (s as any).academicContent?.infrastructure]] as const).filter(([, v]) => v).map(([t, v]) => (
        <article key={t} className="card mt-6"><h2 className="text-2xl font-bold">{t}</h2><p className="mt-3 whitespace-pre-line">{v}</p></article>
      ))}
    </section>
    </>
  );
}
