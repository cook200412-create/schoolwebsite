import { GraduationCap } from 'lucide-react';
import { PageHero } from '@/components/site/page-hero';
import Link from 'next/link';
import { Card } from '@/components/ui/kit';
import { fetchPublic } from '@/lib/api';

export const metadata = { title: 'Faculty' };
export const revalidate = 60;

export default async function FacultyPage() {
  const list = (await fetchPublic<any[]>('/teachers/public')) ?? [];
  return (
    <>
      <PageHero eyebrow="Our teachers">Faculty</PageHero>
      <section className="container section">
      {list.length ? (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <li key={t._id}>
              <Link href={`/faculty/${t._id}`}><Card className="h-full transition hover:-translate-y-1 hover:shadow-lift">
                <div className="flex items-center gap-4">
                  {t.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.photoUrl} alt={t.name} className="h-16 w-16 rounded-2xl object-cover" />
                  ) : <span className="grid h-16 w-16 place-items-center rounded-2xl bg-navy-800 text-gold-300"><GraduationCap /></span>}
                  <div><h2 className="font-sans text-lg font-semibold">{t.name}</h2><p className="text-sm text-slate-600">{t.designation}</p></div>
                </div>
                {t.specialization && <p className="mt-3 text-sm"><b>Specialization:</b> {t.specialization}</p>}
                {t.experienceYears != null && <p className="text-sm text-slate-600">{t.experienceYears} years of experience</p>}
              </Card></Link>
            </li>
          ))}
        </ul>
      ) : <p className="mt-8 rounded-2xl border border-dashed border-navy-200 bg-navy-50/50 p-6 text-slate-600">Faculty profiles will be published here by the school administration.</p>}
    </section>
    </>
  );
}
