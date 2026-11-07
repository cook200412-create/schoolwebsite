import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/kit';
import { fetchPublic } from '@/lib/api';

export const revalidate = 60;

export default async function TeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await fetchPublic<any>(`/teachers/public/${id}`);
  if (!t) notFound();
  return (
    <section className="container section">
      <Link href="/faculty" className="text-sm font-semibold text-sky-700 hover:underline">← All faculty</Link>
      <div className="mt-6 grid gap-8 md:grid-cols-[260px_1fr]">
        {t.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.photoUrl} alt={t.name} className="aspect-square w-full rounded-3xl object-cover shadow-lift" />
        ) : <div className="aspect-square w-full rounded-3xl bg-gradient-to-br from-navy-700 to-navy-900" />}
        <div>
          <h1 className="text-4xl font-bold">{t.name}</h1>
          <p className="mt-1 text-lg text-slate-600">{t.designation}</p>
          {t.bio && <p className="mt-4 whitespace-pre-line">{t.bio}</p>}
          <Card className="mt-6"><dl className="grid gap-2 text-sm">
            {t.specialization && <div className="flex justify-between"><dt className="text-slate-500">Specialization</dt><dd className="font-medium">{t.specialization}</dd></div>}
            {t.experienceYears != null && <div className="flex justify-between"><dt className="text-slate-500">Experience</dt><dd className="font-medium">{t.experienceYears} years</dd></div>}
            {!!t.qualifications?.length && <div className="flex justify-between gap-4"><dt className="text-slate-500">Qualifications</dt><dd className="text-right font-medium">{t.qualifications.join(', ')}</dd></div>}
            {!!t.classesHandled?.length && <div className="flex justify-between gap-4"><dt className="text-slate-500">Classes</dt><dd className="text-right font-medium">{t.classesHandled.join(', ')}</dd></div>}
          </dl></Card>
        </div>
      </div>
    </section>
  );
}
