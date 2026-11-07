import { Card } from '@/components/ui/kit';
import { PageHero } from '@/components/site/page-hero';
import { fetchPublic } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'News and Announcements' };
export const revalidate = 60;

export default async function NewsPage() {
  const [items, events] = await Promise.all([fetchPublic<any[]>('/announcements/public?limit=50'), fetchPublic<any[]>('/events/public?limit=10')]);
  return (
    <>
      <PageHero eyebrow="News">News & announcements</PageHero>
      <section className="container section">
      <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <ul className="grid gap-4">
          {(items ?? []).length ? (items ?? []).map((a) => (<li key={a._id}><Card><p className="text-xs font-semibold uppercase tracking-wider text-sky-600">{a.category.replace('-', ' ')} · {formatDate(a.publishedAt)}</p><h2 className="mt-1 font-sans text-lg font-semibold">{a.title}</h2><p className="mt-2 whitespace-pre-line text-slate-600">{a.body}</p></Card></li>)) : <li className="text-slate-500">No announcements yet.</li>}
        </ul>
        <aside><h2 className="mb-3 text-xl font-bold">Upcoming events</h2><ul className="grid gap-3">{(events ?? []).length ? (events ?? []).map((e) => <li key={e._id}><Card className="!p-4"><p className="font-semibold">{e.title}</p><p className="text-sm text-slate-500">{formatDate(e.startsAt)}{e.location ? ` · ${e.location}` : ''}</p></Card></li>) : <li className="text-sm text-slate-500">No upcoming events.</li>}</ul></aside>
      </div>
    </section>
    </>
  );
}
