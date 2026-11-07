'use client';

import { ClipboardCheck, Home, Phone, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { MobileTabBar } from './mobile-tabbar';

const TABS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/admissions', label: 'Admissions', icon: ClipboardCheck },
  { href: '/contact', label: 'Contact', icon: Phone },
];

/** Defined in a client module so icon components never cross the server→client boundary. */
export function SiteTabBar() {
  const { user } = useAuth();
  const account = user ? { href: '/portal/dashboard', label: 'My portal', icon: UserRound } : { href: '/login', label: 'Login', icon: UserRound };
  return <MobileTabBar tabs={[...TABS, account]} onMore={() => window.dispatchEvent(new Event('site:menu'))} />;
}