import type { ApiResponse, PublicAnnouncement, PublicEvent, PublicSettings } from '@shared/types';

/** Server-side base URL (can be an internal address in production). */
const BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';

async function getJson<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    const body = (await res.json()) as ApiResponse<T>;
    return body.success ? body.data : null;
  } catch {
    return null; // API offline → pages render with safe defaults
  }
}

export const fetchPublicSettings = () => getJson<PublicSettings>('/settings/public');
export const fetchAnnouncements = (limit = 4) => getJson<PublicAnnouncement[]>(`/announcements/public?limit=${limit}`);
export const fetchEvents = (limit = 4) => getJson<PublicEvent[]>(`/events/public?limit=${limit}`);

export const fetchPublic = <T,>(path: string, revalidate = 60) => getJson<T>(path, revalidate);
