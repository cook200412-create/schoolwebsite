export type RoleName =
  | 'super_admin'
  | 'school_admin'
  | 'principal'
  | 'teacher'
  | 'parent'
  | 'student'
  | 'accountant'
  | 'librarian'
  | 'transport_manager'
  | 'admission_officer';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { page?: number; limit?: number; total?: number };
}
export interface ApiFailure {
  success: false;
  error: { code: string; message: string; details?: unknown };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface Facility {
  slug: string;
  title: string;
  description?: string;
  icon?: string;
  confirmed?: boolean;
}

export interface PublicSettings {
  schoolName: string;
  shortName?: string;
  tagline?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  officeTimings?: string;
  mapEmbedUrl?: string;
  social?: { facebook?: string; instagram?: string; youtube?: string; x?: string };
  admissionOpen?: boolean;
  admissionBanner?: string;
  academicYear?: string;
  principal?: { name?: string; message?: string; photoUrl?: string };
  vision?: string;
  mission?: string;
  stats?: { label: string; value: string }[];
  facilities?: Facility[];
}

export interface PublicAnnouncement {
  _id: string;
  title: string;
  body: string;
  category: string;
  publishedAt?: string;
}

export interface PublicEvent {
  _id: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  type: string;
}
