import { describe, expect, it } from 'vitest';
import { buildIcs } from '../ics';

const NOW = new Date('2026-06-15T00:00:00');

function parseEvents(ics: string) {
  const blocks = ics.split('BEGIN:VEVENT').slice(1);
  return blocks.map((block) => {
    const get = (prop: string) => {
      const match = block.match(new RegExp(`${prop}[^:]*:([^\r\n]*)`));
      return match ? match[1] : undefined;
    };
    return {
      dtstart: get('DTSTART'),
      dtend: get('DTEND'),
      summary: get('SUMMARY'),
      transp: get('TRANSP'),
      uid: get('UID'),
    };
  });
}

describe('buildIcs — §2.1 required calendar properties', () => {
  it('includes required VCALENDAR properties', () => {
    const ics = buildIcs({ p1: 'Alice', p2: 'Bob', variant: '2D', now: NOW });
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//ORBIT Approach//Calendar Feed//EN');
    expect(ics).toContain('CALSCALE:GREGORIAN');
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT12H');
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
  });
});

describe('buildIcs — §2.2 / §2.7 required event properties', () => {
  it('each event has DTSTART, DTEND = DTSTART+1, SUMMARY, UID, TRANSP', () => {
    const ics = buildIcs({ p1: 'Alice', p2: 'Bob', variant: '2D', now: NOW });
    const events = parseEvents(ics);
    expect(events.length).toBeGreaterThan(0);
    for (const ev of events) {
      expect(ev.dtstart).toMatch(/^\d{8}$/);
      expect(ev.dtend).toMatch(/^\d{8}$/);
      expect(ev.summary).toMatch(/^Primary : (Alice|Bob)$/);
      expect(ev.uid).toBe(`orbit-${ev.dtstart}@orbit.jasonwoodard.com`);
      expect(['OPAQUE', 'TRANSPARENT']).toContain(ev.transp);

      const start = new Date(
        `${ev.dtstart!.slice(0, 4)}-${ev.dtstart!.slice(4, 6)}-${ev.dtstart!.slice(6, 8)}T00:00:00`,
      );
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const expectedEnd = `${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, '0')}${String(
        end.getDate(),
      ).padStart(2, '0')}`;
      expect(ev.dtend).toBe(expectedEnd);
    }
  });
});

describe('buildIcs — §2.3 TRANSP / busy-free behavior', () => {
  it('me=1: OPAQUE when p1 is primary, TRANSPARENT otherwise', () => {
    const ics = buildIcs({ p1: 'Alice', p2: 'Bob', me: 1, variant: '2D', now: NOW });
    for (const ev of parseEvents(ics)) {
      if (ev.summary === 'Primary : Alice') expect(ev.transp).toBe('OPAQUE');
      if (ev.summary === 'Primary : Bob') expect(ev.transp).toBe('TRANSPARENT');
    }
  });

  it('me=2: OPAQUE when p2 is primary, TRANSPARENT otherwise', () => {
    const ics = buildIcs({ p1: 'Alice', p2: 'Bob', me: 2, variant: '2D', now: NOW });
    for (const ev of parseEvents(ics)) {
      if (ev.summary === 'Primary : Bob') expect(ev.transp).toBe('OPAQUE');
      if (ev.summary === 'Primary : Alice') expect(ev.transp).toBe('TRANSPARENT');
    }
  });

  it('me omitted: all events TRANSPARENT', () => {
    const ics = buildIcs({ p1: 'Alice', p2: 'Bob', variant: '2D', now: NOW });
    for (const ev of parseEvents(ics)) {
      expect(ev.transp).toBe('TRANSPARENT');
    }
  });
});

describe('buildIcs — §2.4 X-WR-CALNAME', () => {
  it('names the calendar after both parents, regardless of me', () => {
    const withMe = buildIcs({ p1: 'Alice', p2: 'Bob', me: 1, variant: '2D', now: NOW });
    expect(withMe).toContain('X-WR-CALNAME:ORBIT (Alice | Bob)');

    const withoutMe = buildIcs({ p1: 'Alice', p2: 'Bob', variant: '2D', now: NOW });
    expect(withoutMe).toContain('X-WR-CALNAME:ORBIT (Alice | Bob)');
  });
});

describe('buildIcs — §2.5 window coverage', () => {
  it('spans from 7 days before now through 12 months forward, no Sundays', () => {
    const ics = buildIcs({ p1: 'Alice', p2: 'Bob', variant: '2D', now: NOW });
    const events = parseEvents(ics);
    const dates = events.map((ev) => ev.dtstart!).sort();

    const sevenDaysBefore = new Date(NOW);
    sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
    const earliestExpected = `${sevenDaysBefore.getFullYear()}${String(sevenDaysBefore.getMonth() + 1).padStart(
      2,
      '0',
    )}${String(sevenDaysBefore.getDate()).padStart(2, '0')}`;

    const in364Days = new Date(NOW);
    in364Days.setDate(in364Days.getDate() + 364);
    const latestFloor = `${in364Days.getFullYear()}${String(in364Days.getMonth() + 1).padStart(2, '0')}${String(
      in364Days.getDate(),
    ).padStart(2, '0')}`;

    expect(dates[0] <= earliestExpected).toBe(true);
    expect(dates[dates.length - 1] >= latestFloor).toBe(true);

    for (const ev of events) {
      const y = Number(ev.dtstart!.slice(0, 4));
      const m = Number(ev.dtstart!.slice(4, 6)) - 1;
      const day = Number(ev.dtstart!.slice(6, 8));
      expect(new Date(y, m, day).getDay()).not.toBe(0);
    }
  });
});

describe('buildIcs — §2.6 UID determinism', () => {
  it('produces identical UIDs across two builds for the same day', () => {
    const icsA = buildIcs({ p1: 'Alice', p2: 'Bob', variant: '2D', now: NOW });
    const icsB = buildIcs({ p1: 'Alice', p2: 'Bob', variant: '2D', now: NOW });
    const uidsA = parseEvents(icsA).map((e) => e.uid);
    const uidsB = parseEvents(icsB).map((e) => e.uid);
    expect(uidsA).toEqual(uidsB);
    expect(new Set(uidsA).size).toBe(uidsA.length);
  });
});

describe('buildIcs — text escaping / injection safety', () => {
  it('escapes commas, semicolons, and backslashes', () => {
    const ics = buildIcs({ p1: 'A,B;C\\D', p2: 'Bob', variant: '2D', now: NOW });
    expect(ics).toContain('A\\,B\\;C\\\\D');
  });

  it('a name containing raw CRLF + a fake END:VEVENT cannot inject a bogus content line', () => {
    const ics = buildIcs({ p1: 'Evil\r\nEND:VEVENT', p2: 'Bob', variant: '2D', now: NOW });
    const lines = ics.split('\r\n');
    const beginCount = lines.filter((l) => l === 'BEGIN:VEVENT').length;
    const endCount = lines.filter((l) => l === 'END:VEVENT').length;
    expect(beginCount).toBeGreaterThan(0);
    expect(endCount).toBe(beginCount);
  });
});

describe('buildIcs — hours window', () => {
  it('without hours, events stay all-day (VALUE=DATE)', () => {
    const ics = buildIcs({ p1: 'Alice', p2: 'Bob', variant: '2D', now: NOW });
    const [event] = parseEvents(ics);
    expect(event.dtstart).toMatch(/^\d{8}$/);
    expect(ics).toContain('DTSTART;VALUE=DATE:');
  });

  it('with hours, events become floating local DATE-TIME for the given window', () => {
    const ics = buildIcs({
      p1: 'Alice',
      p2: 'Bob',
      variant: '2D',
      now: NOW,
      hours: { startHour: 7, startMinute: 0, endHour: 20, endMinute: 0 },
    });
    const [event] = parseEvents(ics);
    expect(event.dtstart).toMatch(/^\d{8}T070000$/);
    expect(event.dtend).toMatch(/^\d{8}T200000$/);
    // Same calendar day, floating (no Z suffix, no TZID).
    expect(event.dtstart!.slice(0, 8)).toBe(event.dtend!.slice(0, 8));
    expect(ics).not.toContain('DTSTART;VALUE=DATE:');
    expect(event.dtstart).not.toMatch(/Z$/);
  });

  it('honors a custom window and applies it to every event regardless of TRANSP', () => {
    const ics = buildIcs({
      p1: 'Alice',
      p2: 'Bob',
      me: 1,
      variant: '2D',
      now: NOW,
      hours: { startHour: 6, startMinute: 30, endHour: 21, endMinute: 45 },
    });
    const events = parseEvents(ics);
    expect(events.length).toBeGreaterThan(0);
    for (const ev of events) {
      expect(ev.dtstart).toMatch(/T063000$/);
      expect(ev.dtend).toMatch(/T214500$/);
    }
    // TRANSP is still governed purely by me/role, unaffected by hours.
    expect(events.some((ev) => ev.transp === 'OPAQUE')).toBe(true);
    expect(events.some((ev) => ev.transp === 'TRANSPARENT')).toBe(true);
  });

  it('UID stays date-only regardless of the hours window', () => {
    const allDay = buildIcs({ p1: 'Alice', p2: 'Bob', variant: '2D', now: NOW });
    const timed = buildIcs({
      p1: 'Alice',
      p2: 'Bob',
      variant: '2D',
      now: NOW,
      hours: { startHour: 7, startMinute: 0, endHour: 20, endMinute: 0 },
    });
    const [allDayEvent] = parseEvents(allDay);
    const [timedEvent] = parseEvents(timed);
    expect(allDayEvent.uid).toBe(timedEvent.uid);
  });
});
