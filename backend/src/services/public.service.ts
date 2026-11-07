import { Announcement } from '../models/Announcement';
import { Event } from '../models/Event';
import { SchoolSettings } from '../models/SchoolSettings';

/** Public-safe projection of school settings (confirmed facilities only). */
export async function getPublicSettings() {
  const doc = await SchoolSettings.findOne({ key: 'default' }).lean();
  if (!doc) return null;
  const { _id, __v, key, createdAt, updatedAt, ...rest } = doc as Record<string, any>;
  return { ...rest, facilities: (rest.facilities ?? []).filter((f: any) => f.confirmed) };
}

export const getPublicAnnouncements = (limit = 6) =>
  Announcement.find({ isPublished: true, audience: 'public', deletedAt: null })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .select('title body category publishedAt')
    .lean();

export const getUpcomingEvents = (limit = 6) =>
  Event.find({ isPublic: true, deletedAt: null, startsAt: { $gte: new Date() } })
    .sort({ startsAt: 1 })
    .limit(limit)
    .select('title description startsAt endsAt location type')
    .lean();
