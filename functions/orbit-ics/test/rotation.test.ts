import { describe, expect, it } from 'vitest';
import { getISOWeek, getPrimary, getPrimaryRole } from '../rotation';

const P1 = 'Alice';
const P2 = 'Bob';

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

describe('getISOWeek', () => {
  // docs/orbit-test-plan.md §1.1 — pre-verified anchors
  it.each([
    ['2026-01-05', 2],
    ['2026-01-12', 3],
  ])('%s is ISO week %i', (iso, week) => {
    expect(getISOWeek(d(iso))).toBe(week);
  });

  // §4.2 — ISO week 1 can start in late December of the prior year
  it('2025-12-29 is ISO week 1 of 2026', () => {
    expect(getISOWeek(d('2025-12-29'))).toBe(1);
  });

  // §4.1 — a year with 53 ISO weeks; week 53 is always odd
  it('2026-12-28 is ISO week 53', () => {
    expect(getISOWeek(d('2026-12-28'))).toBe(53);
  });
});

describe('§1.1 anchor table — ORBIT-2D and ORBIT-3D', () => {
  const anchors: Array<{ date: string; day: string; primary2D: 'p1' | 'p2'; primary3D: 'p1' | 'p2' }> = [
    { date: '2026-01-05', day: 'Mon', primary2D: 'p2', primary3D: 'p2' },
    { date: '2026-01-06', day: 'Tue', primary2D: 'p2', primary3D: 'p2' },
    { date: '2026-01-07', day: 'Wed', primary2D: 'p1', primary3D: 'p2' },
    { date: '2026-01-08', day: 'Thu', primary2D: 'p1', primary3D: 'p1' },
    { date: '2026-01-09', day: 'Fri', primary2D: 'p2', primary3D: 'p1' },
    { date: '2026-01-10', day: 'Sat', primary2D: 'p2', primary3D: 'p1' },
    { date: '2026-01-12', day: 'Mon', primary2D: 'p1', primary3D: 'p1' },
    { date: '2026-01-13', day: 'Tue', primary2D: 'p1', primary3D: 'p1' },
    { date: '2026-01-14', day: 'Wed', primary2D: 'p2', primary3D: 'p1' },
    { date: '2026-01-15', day: 'Thu', primary2D: 'p2', primary3D: 'p2' },
    { date: '2026-01-16', day: 'Fri', primary2D: 'p1', primary3D: 'p2' },
    { date: '2026-01-17', day: 'Sat', primary2D: 'p1', primary3D: 'p2' },
  ];

  it.each(anchors)('$date ($day) — 2D: $primary2D', ({ date, primary2D }) => {
    const expected = primary2D === 'p1' ? P1 : P2;
    expect(getPrimary(d(date), P1, P2, '2D')).toBe(expected);
  });

  it.each(anchors)('$date ($day) — 3D: $primary3D', ({ date, primary3D }) => {
    const expected = primary3D === 'p1' ? P1 : P2;
    expect(getPrimary(d(date), P1, P2, '3D')).toBe(expected);
  });
});

describe('Sunday exclusion', () => {
  it.each(['2D', '3D'] as const)('%s: Sunday always returns null', (variant) => {
    // 2026-01-04, 2026-01-11 and 2026-01-18 are Sundays
    expect(getPrimaryRole(d('2026-01-04'), variant)).toBeNull();
    expect(getPrimaryRole(d('2026-01-11'), variant)).toBeNull();
    expect(getPrimaryRole(d('2026-01-18'), variant)).toBeNull();
  });
});

describe('two-week equity', () => {
  it.each(['2D', '3D'] as const)('%s: p1 and p2 each get 6 primary days over one A+B cycle', (variant) => {
    // 2026-01-05 (Mon, week B) through 2026-01-17 (Sat, week A) — one full B+A cycle
    let p1Count = 0;
    let p2Count = 0;
    for (let i = 0; i < 14; i++) {
      const date = new Date('2026-01-05T00:00:00');
      date.setDate(date.getDate() + i);
      const role = getPrimaryRole(date, variant);
      if (role === 'p1') p1Count++;
      if (role === 'p2') p2Count++;
    }
    expect(p1Count).toBe(6);
    expect(p2Count).toBe(6);
  });
});

describe('§4.4 within-week seam', () => {
  it('2D: Tue and Wed of Week A have different primaries', () => {
    expect(getPrimaryRole(d('2026-01-13'), '2D')).toBe('p1'); // Tue, week A
    expect(getPrimaryRole(d('2026-01-14'), '2D')).toBe('p2'); // Wed, week A
  });

  it('3D: Wed and Thu of Week A have different primaries', () => {
    expect(getPrimaryRole(d('2026-01-14'), '3D')).toBe('p1'); // Wed, week A
    expect(getPrimaryRole(d('2026-01-15'), '3D')).toBe('p2'); // Thu, week A
  });
});

describe('§4.5 fortnightly seam (Sat -> following Mon)', () => {
  it('2D: Week A Sat is p1, Week B Mon is p2', () => {
    expect(getPrimaryRole(d('2026-01-17'), '2D')).toBe('p1'); // Sat, week A (3)
    expect(getPrimaryRole(d('2026-01-19'), '2D')).toBe('p2'); // Mon, week B (4)
  });

  it('3D: Week A Sat is p2, Week B Mon is p2', () => {
    expect(getPrimaryRole(d('2026-01-17'), '3D')).toBe('p2'); // Sat, week A (3)
    expect(getPrimaryRole(d('2026-01-19'), '3D')).toBe('p2'); // Mon, week B (4)
  });
});
