import type { Request, Response } from '@google-cloud/functions-framework';
import { buildIcs, type HoursWindow } from './ics';
import type { Variant } from './rotation';

const DEFAULT_HOURS: HoursWindow = { startHour: 7, startMinute: 0, endHour: 20, endMinute: 0 };
const HOURS_RANGE_PATTERN = /^(\d{2}):?(\d{2})-(\d{2}):?(\d{2})$/;
const TRUTHY_HOURS = new Set(['1', 'true', 'yes', 'on']);
const FALSY_HOURS = new Set(['0', 'false', 'no', 'off']);

function parseVariant(value: unknown): Variant {
  return value === '3D' ? '3D' : '2D';
}

function parseMe(value: unknown): 1 | 2 | undefined {
  if (value === '1') return 1;
  if (value === '2') return 2;
  return undefined;
}

function isValidTime(hour: number, minute: number): boolean {
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

// `hours` grammar: absent/falsy -> off (all-day); truthy -> on with the
// default 07:00-20:00 window; a valid HHMM-HHMM (or HH:MM-HH:MM) range ->
// on with that exact window; anything else unparseable -> off.
function parseHours(value: unknown): HoursWindow | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === '' || FALSY_HOURS.has(normalized)) return undefined;
  if (TRUTHY_HOURS.has(normalized)) return DEFAULT_HOURS;

  const match = normalized.match(HOURS_RANGE_PATTERN);
  if (!match) return undefined;

  const [startHour, startMinute, endHour, endMinute] = match.slice(1).map(Number);
  if (!isValidTime(startHour, startMinute) || !isValidTime(endHour, endMinute)) return undefined;
  if (startHour * 60 + startMinute >= endHour * 60 + endMinute) return undefined;

  return { startHour, startMinute, endHour, endMinute };
}

export function orbitIcs(req: Request, res: Response): void {
  const { p1, p2, me, variant, hours } = req.query;

  if (typeof p1 !== 'string' || p1.length === 0 || typeof p2 !== 'string' || p2.length === 0) {
    res
      .status(400)
      .set('Content-Type', 'text/plain; charset=utf-8')
      .send('Missing required parameter(s): p1 and p2 are both required.');
    return;
  }

  const ics = buildIcs({
    p1,
    p2,
    me: parseMe(me),
    variant: parseVariant(variant),
    hours: parseHours(hours),
  });

  res.status(200).set('Content-Type', 'text/calendar; charset=utf-8').send(ics);
}
