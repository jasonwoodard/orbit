import { getPrimaryRole, type Variant } from './rotation';

const DOMAIN = 'orbit.jasonwoodard.com';
const FOLD_LENGTH = 75;

export interface IcsOptions {
  p1: string;
  p2: string;
  me?: 1 | 2;
  variant: Variant;
  now?: Date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// RFC 5545 §3.3.11 TEXT escaping. Also collapses real line breaks so a
// user-supplied name can't inject extra content lines into the feed.
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// RFC 5545 §3.1 line folding.
function foldLine(line: string): string {
  if (line.length <= FOLD_LENGTH) return line;
  let result = line.slice(0, FOLD_LENGTH);
  let rest = line.slice(FOLD_LENGTH);
  while (rest.length > 0) {
    result += '\r\n ' + rest.slice(0, FOLD_LENGTH - 1);
    rest = rest.slice(FOLD_LENGTH - 1);
  }
  return result;
}

export function buildIcs(options: IcsOptions): string {
  const { p1, p2, me, variant, now = new Date() } = options;
  const start = addDays(now, -7);
  const end = addMonths(now, 12);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ORBIT Approach//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
  ];

  if (me === 1 || me === 2) {
    const subscriberName = me === 1 ? p1 : p2;
    lines.push(`X-WR-CALNAME:${escapeText(`ORBIT — ${subscriberName}`)}`);
  }
  lines.push(`X-WR-CALDESC:${escapeText('The ORBIT Approach rotation schedule')}`);
  lines.push('REFRESH-INTERVAL;VALUE=DURATION:PT12H');

  for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
    const role = getPrimaryRole(day, variant);
    if (role === null) continue;

    const name = role === 'p1' ? p1 : p2;
    const transp = me !== undefined && role === `p${me}` ? 'OPAQUE' : 'TRANSPARENT';
    const dtstart = formatDate(day);
    const dtend = formatDate(addDays(day, 1));

    lines.push('BEGIN:VEVENT');
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
    lines.push(`SUMMARY:${escapeText(`Primary : ${name}`)}`);
    lines.push(`TRANSP:${transp}`);
    lines.push(`UID:orbit-${dtstart}@${DOMAIN}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return lines.map(foldLine).join('\r\n') + '\r\n';
}
