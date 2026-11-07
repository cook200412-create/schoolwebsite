export interface ExamLike {
  subjects: { subject: any; maxMarks: number; passMarks: number }[];
  gradingScale: { min: number; grade: string }[];
}
export interface ResultLike { student: any; subject: any; marks: number; absent?: boolean }

export const gradeFor = (pct: number, scale: { min: number; grade: string }[]) =>
  [...scale].sort((a, b) => b.min - a.min).find((g) => pct >= g.min)?.grade ?? 'F';

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarize(exam: ExamLike, results: ResultLike[], names: Map<string, string>) {
  const subjects = exam.subjects.map((s) => {
    const r = results.find((x) => String(x.subject) === String(s.subject?._id ?? s.subject));
    const marks = r && !r.absent ? r.marks : 0;
    const failed = !r || !!r.absent || marks < s.passMarks;
    return {
      subjectId: String(s.subject?._id ?? s.subject),
      name: names.get(String(s.subject?._id ?? s.subject)) ?? 'Subject',
      marks, max: s.maxMarks, pass: s.passMarks, absent: !!r?.absent, entered: !!r, failed,
      grade: gradeFor((marks / s.maxMarks) * 100, exam.gradingScale),
    };
  });
  const total = subjects.reduce((a, s) => a + s.marks, 0);
  const max = subjects.reduce((a, s) => a + s.max, 0);
  const percentage = max ? round2((total / max) * 100) : 0;
  const failedSubjects = subjects.filter((s) => s.failed).map((s) => s.name);
  return { subjects, total, max, percentage, grade: gradeFor(percentage, exam.gradingScale), result: failedSubjects.length ? 'FAIL' : 'PASS', failedSubjects };
}

/** Competition ranking (1,2,2,4) by total marks among students who passed all entered subjects first. */
export function rank<T extends { total: number }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  return sorted.map((r, i) => ({ ...r, rank: i > 0 && sorted[i - 1].total === r.total ? (undefined as any) : i + 1 })).reduce<(T & { rank: number })[]>((acc, r) => {
    acc.push({ ...r, rank: r.rank ?? acc[acc.length - 1].rank });
    return acc;
  }, []);
}
