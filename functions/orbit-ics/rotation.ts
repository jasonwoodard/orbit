export type Variant = '2D' | '3D';
export type Role = 'p1' | 'p2';

/**
 * ISO 8601 week number, verbatim from docs/orbit-tech-plan.md.
 * Do not substitute Date.getWeek() or similar non-standard methods.
 */
export function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3
    + ((week1.getDay() + 6) % 7)) / 7) + 1;
}

export function getWeekParity(date: Date): 'A' | 'B' {
  return getISOWeek(date) % 2 === 1 ? 'A' : 'B';
}

// Keyed by Date#getDay(): 1=Mon .. 6=Sat. Sunday (0) is intentionally absent.
const PATTERNS: Record<Variant, Record<'A' | 'B', Partial<Record<number, Role>>>> = {
  '2D': {
    A: { 1: 'p1', 2: 'p1', 3: 'p2', 4: 'p2', 5: 'p1', 6: 'p1' },
    B: { 1: 'p2', 2: 'p2', 3: 'p1', 4: 'p1', 5: 'p2', 6: 'p2' },
  },
  '3D': {
    A: { 1: 'p1', 2: 'p1', 3: 'p1', 4: 'p2', 5: 'p2', 6: 'p2' },
    B: { 1: 'p2', 2: 'p2', 3: 'p2', 4: 'p1', 5: 'p1', 6: 'p1' },
  },
};

export function getPrimaryRole(date: Date, variant: Variant): Role | null {
  const day = date.getDay();
  if (day === 0) return null;
  const parity = getWeekParity(date);
  return PATTERNS[variant][parity][day] ?? null;
}

export function getPrimary(date: Date, p1: string, p2: string, variant: Variant): string | null {
  const role = getPrimaryRole(date, variant);
  if (role === null) return null;
  return role === 'p1' ? p1 : p2;
}
