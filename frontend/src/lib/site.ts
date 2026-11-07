import type { PublicSettings } from '@shared/types';
import { fetchPublicSettings } from './api';

/** Fallbacks used only when the API is unreachable or not yet configured. */
export const DEFAULT_SETTINGS: PublicSettings = {
  schoolName: 'Sri Satya Sai Vidyanikethan',
  shortName: 'SSSV',
  tagline: 'Education in human values – nurturing character, knowledge and service.',
  admissionOpen: true,
  admissionBanner: 'Admissions are open for the upcoming academic year.',
  vision: 'To nurture confident, compassionate and capable young people who serve society with integrity.',
  mission: 'To provide a safe, inclusive and joyful learning environment grounded in strong values, academic excellence and holistic development.',
  facilities: [],
  stats: [],
};

export async function getSettings(): Promise<PublicSettings> {
  const s = await fetchPublicSettings();
  return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
}

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/academics', label: 'Academics' },
  { href: '/admissions', label: 'Admissions' },
  { href: '/facilities', label: 'Facilities' },
  { href: '/faculty', label: 'Faculty' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/news', label: 'News' },
  { href: '/contact', label: 'Contact' },
] as const;
