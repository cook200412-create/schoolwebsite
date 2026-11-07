import { TrackForm } from '@/features/admissions/track-form';
import { PageHero } from '@/components/site/page-hero';

export const metadata = { title: 'Track Application' };

export default function TrackPage() {
  return (
    <>
      <PageHero eyebrow="Admissions">Track your application</PageHero>
      <section className="container section">
      <TrackForm />
    </section>
    </>
  );
}
