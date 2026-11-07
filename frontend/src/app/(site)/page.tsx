import {
  ArrowRight, BellRing, BookOpenCheck, CalendarDays, CheckCircle2, ClipboardCheck, FileSearch, GraduationCap, Heart, LifeBuoy, LogIn, Megaphone,
  MapPin, MessageSquareText, ShieldCheck, Sparkles, Target, Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { fetchAnnouncements, fetchEvents } from '@/lib/api';
import { getSettings } from '@/lib/site';
import { formatDate } from '@/lib/utils';

export const revalidate = 60;

function HeroArt() {
  return (
    <svg viewBox="0 0 480 360" className="h-auto w-full" role="img" aria-label="Illustration of the school campus">
      <defs>
        <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bae6fd" /><stop offset="1" stopColor="#f0f9ff" /></linearGradient>
        <linearGradient id="g-roof" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1b4382" /><stop offset="1" stopColor="#081a3b" /></linearGradient>
      </defs>
      <rect width="480" height="360" rx="28" fill="url(#g-sky)" />
      <circle cx="392" cy="68" r="30" fill="#f4de8c" /><circle cx="392" cy="68" r="44" fill="#f4de8c" opacity=".25" />
      <g fill="#fff" opacity=".9"><ellipse cx="90" cy="80" rx="40" ry="12" /><ellipse cx="120" cy="72" rx="28" ry="10" /><ellipse cx="330" cy="120" rx="34" ry="10" /></g>
      <path d="M0 300 Q120 270 240 292 T480 285 V360 H0Z" fill="#dcf3e4" /><path d="M0 325 Q140 300 260 318 T480 312 V360 H0Z" fill="#c5e9d2" />
      <rect x="70" y="150" width="340" height="150" fill="#fff" /><rect x="70" y="150" width="340" height="10" fill="#e2e8f0" />
      <rect x="185" y="100" width="110" height="200" fill="#f8fafc" /><polygon points="172,104 240,52 308,104" fill="url(#g-roof)" />
      <rect x="238" y="28" width="3" height="28" fill="#0c2552" /><polygon points="241,28 262,35 241,42" fill="#d9ad26" />
      <circle cx="240" cy="132" r="14" fill="#fff" stroke="#d9ad26" strokeWidth="3" />
      <rect x="216" y="210" width="48" height="90" rx="4" fill="#12326a" /><path d="M240 210 v90" stroke="#fff" strokeWidth="2" opacity=".5" />
      {[92, 128, 160, 320, 352, 384].map((x) => <rect key={`a${x}`} x={x - 14} y="178" width="28" height="34" rx="3" fill="#4a79bd" />)}
      {[92, 128, 160, 320, 352, 384].map((x) => <rect key={`b${x}`} x={x - 14} y="236" width="28" height="34" rx="3" fill="#4a79bd" />)}
      <g><rect x="196" y="258" width="88" height="8" rx="2" fill="#d9ad26" opacity=".95" /></g>
      <g><rect x="40" y="250" width="6" height="50" fill="#92400e" /><circle cx="43" cy="236" r="26" fill="#4ade80" /><circle cx="30" cy="248" r="16" fill="#22c55e" /></g>
      <g><rect x="436" y="256" width="6" height="44" fill="#92400e" /><circle cx="439" cy="244" r="22" fill="#4ade80" /></g>
    </svg>
  );
}

const QUICK = [
  { href: '/admissions/apply', icon: ClipboardCheck, title: 'Apply online', text: 'Start a new admission application' },
  { href: '/admissions/track', icon: FileSearch, title: 'Track application', text: 'Check your admission status' },
  { href: '/login', icon: LogIn, title: 'Parent login', text: 'Attendance, results, fees & more' },
  { href: '/news', icon: Megaphone, title: 'News & circulars', text: 'Latest school announcements' },
];

const FEATURES = [
  { icon: BellRing, title: 'Instant attendance alerts', text: 'Parents are notified the moment a child is marked absent.' },
  { icon: BookOpenCheck, title: 'Results & marksheets', text: 'Published results and downloadable marksheets for every exam.' },
  { icon: MessageSquareText, title: 'Teacher remarks', text: 'Read your child’s teacher feedback and progress notes online.' },
  { icon: Wallet, title: 'Online fee payment', text: 'View dues, pay securely and download receipts any time.' },
  { icon: LifeBuoy, title: 'Complaints & support', text: 'Raise a concern with the school and follow it until resolved.' },
  { icon: ShieldCheck, title: 'Private & secure', text: 'Role-based access: you only ever see your own children’s data.' },
];

export default async function HomePage() {
  const [s, announcements, events] = await Promise.all([getSettings(), fetchAnnouncements(4), fetchEvents(4)]);
  const facilities = s.facilities ?? [];

  return (
    <>
      {s.admissionOpen && (
        <Link href="/admissions/apply" className="block bg-gold-400 text-navy-950 transition hover:bg-gold-300">
          <div className="container flex items-center justify-center gap-2 py-2 text-center text-sm font-semibold">
            <Sparkles size={16} className="shrink-0" /><span>{s.admissionBanner ?? 'Admissions are open.'}</span><span className="hidden underline underline-offset-4 sm:inline">Apply now →</span>
          </div>
        </Link>
      )}

      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-navy-900 text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_85%_-10%,rgba(56,189,248,.28),transparent),radial-gradient(40rem_26rem_at_0%_110%,rgba(217,173,38,.18),transparent)]" />
        <div aria-hidden className="absolute inset-0 -z-10 opacity-[.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="container grid items-center gap-10 pb-28 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_.95fr] lg:pb-32 lg:pt-20">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-gold-200">
              <GraduationCap size={14} /> Welcome{s.academicYear ? ` · Academic year ${s.academicYear}` : ''}
            </span>
            <h1 className="mt-5 text-[2.35rem] font-bold leading-[1.1] !text-white sm:text-5xl lg:text-[3.4rem]">{s.schoolName}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-navy-100">{s.tagline}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/admissions/apply" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gold-400 px-7 text-base font-bold text-navy-950 shadow-lift transition hover:bg-gold-300">Apply for admission <ArrowRight size={18} /></Link>
              <Link href="/login" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-7 text-base font-semibold text-white backdrop-blur transition hover:bg-white/20">Parent login</Link>
            </div>
            <ul className="mt-8 grid gap-2 text-sm text-navy-100 sm:grid-cols-2">
              {['Value-based education', 'Parent-connected learning', 'Safe, private student data', 'Transparent fees & results'].map((t) => <li key={t} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-gold-300" />{t}</li>)}
            </ul>
          </div>
          <div className="relative animate-fade-up [animation-delay:120ms]">
            <div className="rounded-[2rem] bg-white/10 p-2.5 ring-1 ring-white/20 backdrop-blur">
              {s.heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.heroImageUrl} alt={`${s.schoolName} campus`} className="aspect-[4/3] w-full rounded-3xl object-cover" />
              ) : <HeroArt />}
            </div>
            <div className="absolute -bottom-5 left-3 hidden items-center gap-3 rounded-2xl bg-white p-3.5 pr-5 text-navy-900 shadow-lift sm:flex">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Heart size={20} /></span>
              <div className="leading-tight"><p className="text-sm font-bold">Parent portal</p><p className="text-xs text-slate-500">Results · fees · remarks</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS overlapping hero */}
      <section className="container relative z-10 -mt-16">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK.map(({ href, icon: Icon, title, text }) => (
            <li key={href}>
              <Link href={href} className="group flex h-full items-center gap-4 rounded-2xl bg-white p-5 shadow-lift ring-1 ring-slate-100 transition hover:-translate-y-1">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-600 transition group-hover:bg-navy-800 group-hover:text-gold-300"><Icon size={22} /></span>
                <span><span className="block font-sans text-base font-semibold text-navy-900">{title}</span><span className="block text-sm text-slate-500">{text}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ABOUT + PRINCIPAL */}
      <section className="section">
        <div className="container grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="eyebrow">About our school</span>
            <h2 className="text-3xl font-bold sm:text-4xl">A school that grows character along with knowledge</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">{s.mission}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/about" className="inline-flex h-11 items-center gap-2 rounded-xl bg-navy-800 px-6 text-sm font-semibold text-white hover:bg-navy-700">Read more <ArrowRight size={16} /></Link>
              <Link href="/academics" className="inline-flex h-11 items-center rounded-xl border border-navy-200 px-6 text-sm font-semibold text-navy-800 hover:bg-navy-50">Academics</Link>
            </div>
          </div>
          {s.principal?.message ? (
            <figure className="relative rounded-3xl bg-gradient-to-br from-navy-50 to-sky-50 p-7 sm:p-9">
              <span aria-hidden className="absolute -top-4 left-8 font-serif text-7xl leading-none text-gold-400">“</span>
              <blockquote className="pt-4 font-serif text-lg leading-relaxed text-navy-900 sm:text-xl">{s.principal.message}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                {s.principal.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.principal.photoUrl} alt={s.principal.name ?? 'Principal'} className="h-12 w-12 rounded-full object-cover" />
                ) : <span className="grid h-12 w-12 place-items-center rounded-full bg-navy-800 text-gold-300"><GraduationCap size={22} /></span>}
                <span className="leading-tight"><b className="block text-navy-900">{s.principal.name}</b><span className="text-sm text-slate-500">Principal</span></span>
              </figcaption>
            </figure>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {[['Vision', s.vision, Target], ['Mission', s.mission, Heart]].map(([t, b, Icon]: any) => <div key={t} className="card"><Icon className="text-gold-500" /><h3 className="mt-3 text-xl font-bold">{t}</h3><p className="mt-2 text-sm text-slate-600">{b}</p></div>)}
            </div>
          )}
        </div>
      </section>

      {/* FEATURES */}
      <section className="section bg-slate-50">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow justify-center">Parent-connected school</span>
            <h2 className="text-3xl font-bold sm:text-4xl">Everything about your child, in one place</h2>
            <p className="mt-3 text-slate-600">One secure parent account for every child — attendance, results, teacher remarks, fees and direct communication with the school.</p>
          </div>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="card transition hover:-translate-y-1 hover:shadow-lift">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-navy-800 text-gold-300"><Icon size={22} /></span>
                <h3 className="mt-4 font-sans text-lg font-semibold">{title}</h3><p className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* VISION / MISSION (when principal message exists) */}
      {s.principal?.message && (
        <section className="section">
          <div className="container grid gap-6 md:grid-cols-2">
            {[['Our Vision', s.vision, Target], ['Our Mission', s.mission, Heart]].map(([t, b, Icon]: any) => (
              <article key={t} className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-card">
                <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold-400 to-sky-400" />
                <Icon className="text-gold-500" size={28} /><h2 className="mt-3 text-2xl font-bold">{t}</h2><p className="mt-3 text-slate-600">{b}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* FACILITIES – only when confirmed */}
      {facilities.length > 0 && (
        <section className="section bg-slate-50">
          <div className="container">
            <span className="eyebrow">Campus</span><h2 className="text-3xl font-bold sm:text-4xl">School facilities</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {facilities.map((f) => (
                <li key={f.slug}><Link href={`/facilities#${f.slug}`} className="card block h-full transition hover:-translate-y-1 hover:shadow-lift"><h3 className="text-lg font-bold">{f.title}</h3>{f.description && <p className="mt-2 text-sm text-slate-600">{f.description}</p>}</Link></li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* NEWS + EVENTS */}
      <section className="section">
        <div className="container grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="mb-5 flex items-end justify-between"><h2 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl"><Megaphone className="text-gold-500" /> Latest announcements</h2><Link href="/news" className="text-sm font-semibold text-sky-700 hover:underline">View all</Link></div>
            <ul className="grid gap-3">
              {announcements?.length ? announcements.map((a) => (
                <li key={a._id} className="card !p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">{a.category.replace('-', ' ')} · {formatDate(a.publishedAt)}</p>
                  <h3 className="mt-1 font-sans text-base font-semibold">{a.title}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-600">{a.body}</p>
                </li>
              )) : <li className="rounded-2xl border border-dashed border-navy-200 p-6 text-sm text-slate-500">No announcements yet.</li>}
            </ul>
          </div>
          <div>
            <h2 className="mb-5 flex items-center gap-2 text-2xl font-bold sm:text-3xl"><CalendarDays className="text-gold-500" /> Upcoming events</h2>
            <ul className="grid gap-3">
              {events?.length ? events.map((e) => (
                <li key={e._id} className="card flex gap-4 !p-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-navy-800 text-center leading-none text-white"><span><span className="block text-xl font-bold">{new Date(e.startsAt).getDate()}</span><span className="block text-[10px] uppercase tracking-wider text-gold-300">{formatDate(e.startsAt, { month: 'short' })}</span></span></div>
                  <div className="min-w-0"><h3 className="font-sans text-base font-semibold">{e.title}</h3>{e.location && <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} />{e.location}</p>}</div>
                </li>
              )) : <li className="rounded-2xl border border-dashed border-navy-200 p-6 text-sm text-slate-500">No upcoming events.</li>}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-navy-900 to-navy-700 py-14 text-white">
        <div className="container flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div><h2 className="text-3xl font-bold !text-white">Ready to join our school family?</h2><p className="mt-2 text-navy-100">Apply online in minutes or talk to the school office.</p></div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/admissions/apply" className="inline-flex h-12 items-center justify-center rounded-xl bg-gold-400 px-7 font-bold text-navy-950 hover:bg-gold-300">Apply online</Link>
            <Link href="/contact" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-7 font-semibold hover:bg-white/20">Contact us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
