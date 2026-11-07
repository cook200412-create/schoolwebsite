import { ApplyForm } from '@/features/admissions/apply-form';
import { PageHero } from '@/components/site/page-hero';
import { getSettings } from '@/lib/site';

export const metadata = { title: 'Apply for Admission' };
export const revalidate = 60;

export default async function ApplyPage() {
  const s = await getSettings();
  return (
    <>
      <PageHero eyebrow="Online application">Apply for admission</PageHero>
      <section className="container section">
      <div className="mx-auto max-w-3xl"><ApplyForm defaultYear={s.academicYear} /></div>
    </section>
    </>
  );
}
