import type { Request } from 'express';
import type { FilterQuery } from 'mongoose';
import { can } from '../middleware/auth';
import { Parent, Student, Teacher } from '../models/people';
import { ApiError } from '../utils/http';

/** Sections a teacher is allowed to work with (assignments + class-teacher role). */
export async function teacherSectionIds(userId: string): Promise<string[]> {
  const t = await Teacher.findOne({ user: userId, deletedAt: null }).lean();
  if (!t) return [];
  const ids = new Set<string>((t.assignments ?? []).map((a: any) => String(a.section)));
  if (t.classTeacherOf) ids.add(String(t.classTeacherOf));
  return [...ids];
}

export async function teacherSubjectsFor(userId: string, sectionId: string): Promise<string[]> {
  const t = await Teacher.findOne({ user: userId }).lean();
  return (t?.assignments ?? []).filter((a: any) => String(a.section) === sectionId).map((a: any) => String(a.subject));
}

export const parentChildIds = async (userId: string): Promise<string[]> => {
  const p = await Parent.findOne({ user: userId, deletedAt: null }).lean();
  return (p?.children ?? []).map(String);
};

/**
 * Mongo filter limiting Student queries to what the caller may see.
 * Returns null when the caller has no student access at all.
 */
export async function studentScope(req: Request): Promise<FilterQuery<any> | null> {
  const u = req.user!;
  if (u.role === 'teacher') return { section: { $in: await teacherSectionIds(u.id) } };
  if (can(req, 'students:read')) return {};
  if (u.role === 'parent') return { _id: { $in: await parentChildIds(u.id) } };
  if (u.role === 'student') return { user: u.id };
  return null;
}

export async function assertStudentAccess(req: Request, studentId: string) {
  const scope = await studentScope(req);
  if (!scope) throw ApiError.forbidden();
  // $and so a scope that constrains _id (parents) can never overwrite the requested id
  const student = await Student.findOne({ $and: [{ _id: studentId, deletedAt: null }, scope] });
  // 404 (not 403) so IDs of other families' children cannot be probed
  if (!student) throw ApiError.notFound('Student not found');
  return student;
}

export async function assertSectionAccess(req: Request, sectionId: string) {
  if (req.user!.role === 'teacher') {
    if (!(await teacherSectionIds(req.user!.id)).includes(sectionId)) throw ApiError.forbidden('Section not assigned to you');
  }
}
