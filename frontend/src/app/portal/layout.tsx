'use client';

import { LogOut, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MobileTabBar } from '@/components/site/mobile-tabbar';
import { PageLoader } from '@/components/ui/kit';
import { Logo } from '@/components/site/logo';
import { NAV, ROLE_LABEL } from '@/features/portal/nav';
import { useAuth } from '@/hooks/use-auth';
import { useApi } from '@/hooks/use-api';
import { cn } from '@/lib/utils';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, can, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { meta } = useApi<unknown[]>(user ? '/notifications?unread=true&limit=1' : null);

  useEffect(() => { if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`); }, [loading, user, router, pathname]);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (loading || !user) return <PageLoader />;
  const items = NAV.filter((n) => !n.perms || can(...n.perms));
  const PREFERRED = ['/portal/dashboard', '/portal/attendance', '/portal/results', '/portal/fees', '/portal/remarks', '/portal/students', '/portal/admissions', '/portal/announcements'];
  const tabs = PREFERRED.map((h) => items.find((i) => i.href === h)).filter((x): x is NonNullable<typeof x> => !!x).slice(0, 4);
  const isActive = (href: string) => pathname === href || (href !== '/portal/dashboard' && pathname.startsWith(href));
  const signOut = async () => { await logout(); router.replace('/login'); };
  const unread = (label: string) => label === 'Notifications' && !!meta?.unread;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* mobile top bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center border-b bg-white px-4 lg:hidden">
        <Logo name="SSSV Portal" short="SS" />
      </header>

      {/* mobile glass drawer (right side) */}
      <div className={cn('fixed inset-0 z-50 lg:hidden', open ? 'visible' : 'invisible')} aria-hidden={!open}>
        <button aria-label="Close menu backdrop" tabIndex={-1} onClick={() => setOpen(false)} className={cn('absolute inset-0 bg-navy-950/40 backdrop-blur-sm transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')} />
        <aside role="dialog" aria-modal="true" aria-label="Portal menu"
          className={cn('absolute right-0 top-0 flex h-full w-[84%] max-w-sm flex-col border-l border-white/15 bg-gradient-to-b from-navy-900/90 via-navy-900/85 to-navy-950/90 text-white shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out', open ? 'translate-x-0' : 'translate-x-full')}>
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <div className="min-w-0 leading-tight"><p className="truncate font-semibold">{user.name}</p><p className="text-xs text-gold-300">{ROLE_LABEL[user.role] ?? user.role}</p></div>
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X size={20} /></button>
          </div>
          <nav aria-label="Portal mobile" className="grid flex-1 content-start gap-1 overflow-y-auto px-3 py-2">
            {items.map(({ href, label, icon: Icon }, i) => (
              <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined} style={{ transitionDelay: open ? `${i * 20}ms` : '0ms' }}
                className={cn('flex items-center gap-3 rounded-xl px-4 py-3 text-[16px] font-medium transition-all duration-300', open ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0', isActive(href) ? 'bg-white/10 text-gold-300' : 'text-sky-100 hover:bg-white/10 hover:text-white')}>
                <Icon size={19} /> <span className="flex-1">{label}</span>
                {unread(label) && <span className="rounded-full bg-gold-400 px-2 text-xs font-bold text-navy-950">{meta?.unread}</span>}
              </Link>
            ))}
          </nav>
          <div className="p-5">
            <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 py-3.5 font-semibold text-white hover:bg-white/20"><LogOut size={17} /> Sign out</button>
          </div>
        </aside>
      </div>

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-white p-4 lg:flex">
        <Logo name="SSSV Portal" short="SS" />
        <nav aria-label="Portal" className="mt-6 grid flex-1 content-start gap-1 overflow-y-auto">
          {items.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}
              className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive(href) ? 'bg-navy-800 text-white' : 'text-slate-600 hover:bg-navy-50')}>
              <Icon size={18} /> <span className="flex-1">{label}</span>
              {unread(label) && <span className="rounded-full bg-gold-400 px-2 text-xs font-bold text-navy-950">{meta?.unread}</span>}
            </Link>
          ))}
        </nav>
        <div className="mt-4 rounded-xl bg-navy-50 p-3 text-sm">
          <p className="truncate font-semibold text-navy-900">{user.name}</p>
          <p className="text-xs text-slate-500">{ROLE_LABEL[user.role] ?? user.role}</p>
          <button onClick={signOut} className="mt-2 flex items-center gap-2 text-xs font-semibold text-red-600 hover:underline"><LogOut size={14} /> Sign out</button>
        </div>
      </aside>

      <main id="main" className="px-4 pb-28 pt-6 sm:px-6 lg:ml-64 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <MobileTabBar tabs={tabs} onMore={() => setOpen(true)} hideFrom="lg" label="Portal quick navigation" />
    </div>
  );
}
