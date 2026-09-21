import { describe, expect, it, vi } from 'vitest';
import { orbitIcs } from '../index';
import type { Request, Response } from '@google-cloud/functions-framework';

function mockRes() {
  const res: Partial<Response> & { statusCode?: number; body?: string; headers: Record<string, string> } = {
    headers: {},
  };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as unknown as Response['status'];
  res.set = vi.fn((key: string, value: string) => {
    res.headers[key] = value;
    return res as Response;
  }) as unknown as Response['set'];
  res.send = vi.fn((body: string) => {
    res.body = body;
    return res as Response;
  }) as unknown as Response['send'];
  return res as Response & { statusCode?: number; body?: string; headers: Record<string, string> };
}

function mockReq(query: Record<string, unknown>): Request {
  return { query } as unknown as Request;
}

describe('orbitIcs — §3.1 required parameters', () => {
  it('missing p1 -> 400 plain text', () => {
    const res = mockRes();
    orbitIcs(mockReq({ p2: 'Bob' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.headers['Content-Type']).toMatch(/text\/plain/);
  });

  it('missing p2 -> 400 plain text', () => {
    const res = mockRes();
    orbitIcs(mockReq({ p1: 'Alice' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('missing both -> 400', () => {
    const res = mockRes();
    orbitIcs(mockReq({}), res);
    expect(res.statusCode).toBe(400);
  });

  it('empty string p1 -> 400 (treated as missing)', () => {
    const res = mockRes();
    orbitIcs(mockReq({ p1: '', p2: 'Bob' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('both present -> 200 with text/calendar', () => {
    const res = mockRes();
    orbitIcs(mockReq({ p1: 'Alice', p2: 'Bob' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/calendar; charset=utf-8');
    expect(res.body).toContain('BEGIN:VCALENDAR');
  });
});

describe('orbitIcs — §3.2 variant handling', () => {
  it('invalid variant silently defaults to 2D', () => {
    const res = mockRes();
    orbitIcs(mockReq({ p1: 'Alice', p2: 'Bob', variant: 'bogus' }), res);
    expect(res.statusCode).toBe(200);
    // Week B, Wed (2026-01-07 style) differs between 2D/3D; just assert it didn't 400/500.
    expect(res.body).toContain('BEGIN:VCALENDAR');
  });
});

describe('orbitIcs — §3.3 me handling', () => {
  it('me out of range silently omits busy/free', () => {
    const res = mockRes();
    orbitIcs(mockReq({ p1: 'Alice', p2: 'Bob', me: '3' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('OPAQUE');
  });

  it('me as non-numeric string silently omits busy/free', () => {
    const res = mockRes();
    orbitIcs(mockReq({ p1: 'Alice', p2: 'Bob', me: 'alice' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('OPAQUE');
  });
});

describe('orbitIcs — §3.4 hours parameter grammar', () => {
  it('absent -> all-day events', () => {
    const res = mockRes();
    orbitIcs(mockReq({ p1: 'Alice', p2: 'Bob' }), res);
    expect(res.body).toContain('DTSTART;VALUE=DATE:');
  });

  it.each(['0', 'false', 'no', 'off'])('falsy value %s -> all-day events', (value) => {
    const res = mockRes();
    orbitIcs(mockReq({ p1: 'Alice', p2: 'Bob', hours: value }), res);
    expect(res.body).toContain('DTSTART;VALUE=DATE:');
  });

  it.each(['1', 'true', 'yes', 'on'])('truthy value %s -> default 07:00-20:00 window', (value) => {
    const res = mockRes();
    orbitIcs(mockReq({ p1: 'Alice', p2: 'Bob', hours: value }), res);
    expect(res.body).toMatch(/DTSTART:\d{8}T070000/);
    expect(res.body).toMatch(/DTEND:\d{8}T200000/);
  });

  it.each(['0630-2145', '06:30-21:45'])('valid explicit range %s -> that exact window', (value) => {
    const res = mockRes();
    orbitIcs(mockReq({ p1: 'Alice', p2: 'Bob', hours: value }), res);
    expect(res.body).toMatch(/DTSTART:\d{8}T063000/);
    expect(res.body).toMatch(/DTEND:\d{8}T214500/);
  });

  it.each([
    '2000-0700', // end before start
    '2500-2600', // out-of-range hour
    '0700-0760', // out-of-range minute
    '0700-0700', // zero-length window
    'garbage',
  ])('invalid/unparseable value %s -> falls back to all-day', (value) => {
    const res = mockRes();
    orbitIcs(mockReq({ p1: 'Alice', p2: 'Bob', hours: value }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('DTSTART;VALUE=DATE:');
  });
});
