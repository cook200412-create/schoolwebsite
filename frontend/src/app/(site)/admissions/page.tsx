import Link from 'next/link';
import { PageHero } from '@/components/site/page-hero';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/kit';
import { getSettings } from '@/lib/site';

export const metadata = { title: 'Admissions' };
export const revalidate = 60;

const STEPS = [['Apply online', 'Fill in the application and upload documents.'], ['Review', 'The admissions team verifies your documents.'], ['Interview', 'Eligible applicants are invited for an interaction.'], ['Decision', 'You are notified by email of approval, waitlist or required documents.'], ['Enrolment', 'Approved applicants receive a parent portal account.']];

export default async function AdmissionsPage() {
  const s = await getSettings();
  return (
    <>
      <PageHero eyebrow="Admissions">Join {s.schoolName}</PageHero>
      <section className="container section">
      <p className="mt-3 max-w-2xl text-lg text-slate-600">{s.admissionOpen ? s.admissionBanner : 'Admissions are currently closed. You may still submit an enquiry.'}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" variant="gold"><Link href="/admissions/apply">Start application</Link></Button>
        <Button asChild size="lg" variant="outline"><Link href="/admissions/track">Track application</Link></Button>
        <Button asChild size="lg" variant="ghost"><Link href="/contact">Ask a question</Link></Button>
      </div>
      <ol className="mt-12 grid gap-4 md:grid-cols-5">
        {STEPS.map(([t, d], i) => (<li key={t}><Card className="h-full"><span className="grid h-9 w-9 place-items-center rounded-full bg-navy-800 font-bold text-gold-300">{i + 1}</span><h2 className="mt-3 font-sans text-base font-semibold">{t}</h2><p className="mt-1 text-sm text-slate-600">{d}</p></Card></li>))}
      </ol>
      <p className="mt-8 text-sm text-slate-500">Documents needed: birth certificate, previous academic record (if applicable) and a recent photograph. Eligibility and fee details are provided by the school office.</p>
    </section>
    </>
  );
}
