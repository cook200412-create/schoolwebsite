'use client';

import { ChevronDown, LogIn, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PublicSettings } from '@shared/types';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Logo } from './logo';

const MAIN = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/academics', label: 'Academics' },
  { href: '/admissions', label: 'Admissions' },
];
const CAMPUS = [
  { href: '/facilities', label: 'Facilities' },
  { href: '/faculty', label: 'Faculty' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/results', label: 'Results & Achievements' },
];
const TAIL = [
  { href: '/news', label: 'News' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader({ s }: { s: PublicSettings }) {
  const [open, setOpen] = useState(false);
  const [campus, setCampus] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => { setOpen(false); setCampus(false); }, [pathname]);
  // the bottom tab bar's "More" tab opens this drawer
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener('site:menu', h);
    return () => window.removeEventListener('site:menu', h);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const link = (l: { href: string; label: string }) => (
    <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined}
      className={cn('relative whitespace-nowrap rounded-lg px-2.5 py-2 text-[15px] font-medium xl:px-3 transition-colors hover:text-navy-900', active(l.href) ? 'text-navy-900 after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded after:bg-gold-400' : 'text-slate-600')}>
      {l.label}
    </Link>
  );
  const campusActive = CAMPUS.some((c) => active(c.href));

  return (
    <header className="sticky top-0 z-40 shadow-[0_1px_0_rgba(8,26,59,.06)]">
      {/* main bar */}
      <div className="border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="container flex h-[68px] items-center justify-between gap-4 lg:h-[76px]">
          <div className="shrink-0"><Logo name={s.schoolName} short={s.shortName} /></div>

          <nav aria-label="Main" className="hidden items-center gap-0.5 xl:flex">
            {MAIN.map(link)}
            <div className="relative" onMouseEnter={() => setCampus(true)} onMouseLeave={() => setCampus(false)}>
              <button aria-haspopup="menu" aria-expanded={campus} onClick={() => setCampus((v) => !v)} onBlur={(e) => { if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setCampus(false); }}
                className={cn('flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-2 text-[15px] font-medium hover:text-navy-900 xl:px-3', campusActive ? 'text-navy-900' : 'text-slate-600')}>
                Campus life <ChevronDown size={15} className={cn('transition', campus && 'rotate-180')} />
              </button>
              {campus && (
                <div role="menu" className="absolute left-0 top-full w-56 pt-2">
                  <div className="rounded-2xl border border-slate-100 bg-white p-2 shadow-lift">
                    {CAMPUS.map((c) => <Link key={c.href} role="menuitem" href={c.href} className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-navy-50 hover:text-navy-900">{c.label}</Link>)}
                  </div>
                </div>
              )}
            </div>
            {TAIL.map(link)}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link href={user ? '/portal/dashboard' : '/login'} className="hidden items-center gap-2 whitespace-nowrap rounded-xl border border-navy-200 px-4 py-2.5 text-sm font-semibold text-navy-800 transition hover:bg-navy-50 xl:inline-flex"><LogIn size={16} /> {user ? <span>My portal</span> : <><span className="2xl:hidden">Portal login</span><span className="hidden 2xl:inline">Parent / Staff login</span></>}</Link>
            <Link href="/admissions/apply" className="hidden whitespace-nowrap rounded-xl bg-gold-400 px-5 py-2.5 text-sm font-bold text-navy-950 shadow-card transition hover:bg-gold-300 sm:inline-block">Apply now</Link>
          </div>
        </div>
      </div>

      {/* mobile drawer: slides in from the right over a blurred backdrop */}
      <div className={cn('fixed inset-0 z-50 xl:hidden', open ? 'visible' : 'invisible')} aria-hidden={!open}>
        <button aria-label="Close menu backdrop" tabIndex={-1} onClick={() => setOpen(false)}
          className={cn('absolute inset-0 bg-navy-950/40 backdrop-blur-sm transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')} />
        <aside id="mobile-menu" role="dialog" aria-modal="true" aria-label="Site menu"
          className={cn('absolute right-0 top-0 flex h-full w-[84%] max-w-sm flex-col overflow-y-auto border-l border-white/15 bg-gradient-to-b from-navy-900/90 via-navy-900/85 to-navy-950/90 text-white shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out', open ? 'translate-x-0' : 'translate-x-full')}>
          <div className="flex items-center justify-between px-5 pb-2 pt-5">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">Menu</span>
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X size={20} /></button>
          </div>
          <nav aria-label="Mobile" className="grid gap-1 px-3 py-2">
            {[...MAIN, ...CAMPUS, ...TAIL].map((l, i) => (
              <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined} style={{ transitionDelay: open ? `${i * 25}ms` : '0ms' }}
                className={cn('flex items-center justify-between rounded-xl px-4 py-3 text-[17px] font-medium transition-all duration-300', open ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0',
                  active(l.href) ? 'bg-white/10 text-gold-300' : 'text-sky-100 hover:bg-white/10 hover:text-white')}>
                {l.label}
                {active(l.href) && <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />}
              </Link>
            ))}
          </nav>
          <div className="mt-auto grid gap-3 p-5">
            <Link href="/admissions/apply" className="rounded-xl bg-gold-400 py-3.5 text-center font-bold text-navy-950 shadow-lg">Apply for admission</Link>
            <Link href={user ? '/portal/dashboard' : '/login'} className="flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 py-3.5 text-center font-semibold text-white"><LogIn size={17} /> {user ? 'My portal' : 'Parent / Staff login'}</Link>
            {(s.phone || s.email) && <p className="pt-1 text-center text-xs text-navy-200">{[s.phone, s.email].filter(Boolean).join(' · ')}</p>}
          </div>
        </aside>
      </div>
    </header>
  );
}
