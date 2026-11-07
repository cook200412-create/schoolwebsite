import { Clock, Facebook, Instagram, Mail, MapPin, Phone, Youtube } from 'lucide-react';
import Link from 'next/link';
import type { PublicSettings } from '@shared/types';
import { Logo } from './logo';

const COLS = [
  { title: 'School', links: [['About us', '/about'], ['Academics', '/academics'], ['Facilities', '/facilities'], ['Faculty', '/faculty'], ['Gallery', '/gallery']] },
  { title: 'Admissions', links: [['Apply online', '/admissions/apply'], ['Track application', '/admissions/track'], ['Admission process', '/admissions'], ['News & events', '/news'], ['Contact', '/contact']] },
  { title: 'Parents', links: [['Parent login', '/login'], ['Create parent account', '/register'], ['Forgot password', '/forgot-password'], ['Results & achievements', '/results']] },
];

export function SiteFooter({ s }: { s: PublicSettings }) {
  const social = [[s.social?.facebook, Facebook, 'Facebook'], [s.social?.instagram, Instagram, 'Instagram'], [s.social?.youtube, Youtube, 'YouTube']] as const;
  return (
    <footer className="mt-auto bg-navy-950 text-navy-100">
      <div className="container grid gap-10 py-14 lg:grid-cols-[1.4fr_2fr_1.3fr]">
        <div>
          <Logo name={s.schoolName} short={s.shortName} light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-navy-200">{s.tagline}</p>
          <div className="mt-5 flex gap-3">
            {social.filter(([u]) => u).map(([u, Icon, label]) => <a key={label} href={u as string} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-gold-400 hover:text-navy-950"><Icon size={18} /></a>)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLS.map((c) => (
            <div key={c.title}>
              <h3 className="font-sans text-sm font-semibold uppercase tracking-widest text-gold-300">{c.title}</h3>
              <ul className="mt-4 grid gap-2.5 text-sm">{c.links.map(([l, h]) => <li key={h}><Link href={h} className="text-navy-200 transition hover:text-white">{l}</Link></li>)}</ul>
            </div>
          ))}
        </div>
        <div>
          <h3 className="font-sans text-sm font-semibold uppercase tracking-widest text-gold-300">Contact</h3>
          <ul className="mt-4 grid gap-3 text-sm">
            {s.address && <li className="flex gap-3"><MapPin size={17} className="mt-0.5 shrink-0 text-gold-300" />{s.address}</li>}
            {s.phone && <li className="flex gap-3"><Phone size={17} className="mt-0.5 shrink-0 text-gold-300" /><a href={`tel:${s.phone.replace(/\s/g, '')}`}>{s.phone}</a></li>}
            {s.email && <li className="flex gap-3"><Mail size={17} className="mt-0.5 shrink-0 text-gold-300" /><a href={`mailto:${s.email}`} className="break-all">{s.email}</a></li>}
            {s.officeTimings && <li className="flex gap-3"><Clock size={17} className="mt-0.5 shrink-0 text-gold-300" />{s.officeTimings}</li>}
            {!s.address && !s.phone && !s.email && <li className="text-navy-300">Contact details are configured by the school office.</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-2 py-5 text-xs text-navy-300 sm:flex-row">
          <p>© {new Date().getFullYear()} {s.schoolName}. All rights reserved.</p>
          <p>Student data is protected · Parental consent required for all records</p>
        </div>
      </div>
    </footer>
  );
}
