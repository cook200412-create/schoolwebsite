'use client';

import { Grid2x2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';

export interface Tab { href: string; label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }

/** App-style bottom navigation for phones (hidden from `hideFrom` breakpoint up). */
export function MobileTabBar({ tabs, onMore, hideFrom = 'xl', label = 'Quick navigation' }: { tabs: Tab[]; onMore?: () => void; hideFrom?: 'lg' | 'xl'; label?: string }) {
  const pathname = usePathname();
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
  const item = 'relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors';
  return (
    <nav aria-label={label} className={cn('fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_-12px_rgba(8,26,59,.25)] backdrop-blur', hideFrom === 'lg' ? 'lg:hidden' : 'xl:hidden')}>
      <ul className="mx-auto flex max-w-xl items-stretch">
        {tabs.map(({ href, label: l, icon: Icon }) => {
          const on = active(href);
          return (
            <li key={href} className="flex flex-1">
              <Link href={href} aria-current={on ? 'page' : undefined} className={cn(item, on ? 'text-navy-800' : 'text-slate-500 active:text-navy-800')}>
                {on && <span className="absolute inset-x-6 top-0 h-0.5 rounded-b bg-gold-400" />}
                <Icon size={24} strokeWidth={on ? 2.4 : 1.8} />
                <span>{l}</span>
              </Link>
            </li>
          );
        })}
        {onMore && (
          <li className="flex flex-1">
            <button onClick={onMore} className={cn(item, 'text-slate-500 active:text-navy-800')} aria-label="More options">
              <Grid2x2 size={24} strokeWidth={1.8} /><span>More</span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}
