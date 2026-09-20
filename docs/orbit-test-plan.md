# ORBIT — Test Plan

**Version:** 1.0  
**Status:** Draft  
**Companion documents:** ORBIT-calendar-feed-PRD.md, orbit-tech-plan.md

---

## Scope

This plan covers the ICS feed endpoint (`functions/orbit-ics/`). It does not cover the user guide HTML page, which has no server-side logic.

Tests are organized into five areas:

1. Rotation logic (`rotation.ts`)
2. ICS output structure (`ics.ts`)
3. Parameter handling
4. Edge cases
5. End-to-end (GCal subscription)

---

## 1. Rotation Logic

These tests validate `rotation.ts` — the core day-assignment function. Tests should run without an HTTP server (pure unit tests).

### 1.1 ORBIT-2D: Week A (odd ISO week)

Use a known odd ISO week. ISO week 1 of 2026 begins Mon 29 Dec 2025.

| Date | Expected primary | Notes |
|---|---|---|
| 2026-01-05 (Mon) | p1 | Week 2 is even → Week B; p2 starts → Mon is p2. **Wait — check the week number.** |

> **Setup note for implementer:** Confirm the ISO week number for each test date before writing assertions. The easiest reference: `new Intl.DateTimeFormat('en', { week: 'narrow' })` is not standard — use the `getISOWeek()` function from the tech plan directly.

Use these anchor dates (pre-verified):

| Date | ISO week | Parity | Day | Expected primary (2D) | Expected primary (3D) |
|---|---|---|---|---|---|
| 2026-01-05 (Mon) | 2 | Even = B | Mon | p2 | p2 |
| 2026-01-06 (Tue) | 2 | Even = B | Tue | p2 | p2 |
| 2026-01-07 (Wed) | 2 | Even = B | Wed | p1 | p2 |
| 2026-01-08 (Thu) | 2 | Even = B | Thu | p1 | p1 |
| 2026-01-09 (Fri) | 2 | Even = B | Fri | p2 | p1 |
| 2026-01-10 (Sat) | 2 | Even = B | Sat | p2 | p1 |
| 2026-01-12 (Mon) | 3 | Odd = A | Mon | p1 | p1 |
| 2026-01-13 (Tue) | 3 | Odd = A | Tue | p1 | p1 |
| 2026-01-14 (Wed) | 3 | Odd = A | Wed | p2 | p1 |
| 2026-01-15 (Thu) | 3 | Odd = A | Thu | p2 | p2 |
| 2026-01-16 (Fri) | 3 | Odd = A | Fri | p1 | p2 |
| 2026-01-17 (Sat) | 3 | Odd = A | Sat | p1 | p2 |

### 1.2 Sunday is always excluded

| Date | Expected result |
|---|---|
| Any Sunday | No event generated |

Verify: the output ICS contains no event with `DTSTART` on a Sunday.

### 1.3 Two-week equity check

Over any complete Mon–Sat / Mon–Sat pair (one Week A + one Week B), p1 and p2 each appear exactly 6 times as Primary.

- ORBIT-2D: p1 days = 6, p2 days = 6 ✓
- ORBIT-3D: p1 days = 6, p2 days = 6 ✓

---

## 2. ICS Output Structure

These tests validate that `ics.ts` produces RFC 5545–compliant output.

### 2.1 Required calendar properties

The response body must contain all of the following:

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ORBIT Approach//Calendar Feed//EN
CALSCALE:GREGORIAN
REFRESH-INTERVAL;VALUE=DURATION:PT12H
END:VCALENDAR
```

### 2.2 Required event properties (each VEVENT)

| Property | Required value |
|---|---|
| `DTSTART;VALUE=DATE` | Date in `YYYYMMDD` format |
| `DTEND;VALUE=DATE` | Exactly one day after `DTSTART` |
| `SUMMARY` | `Primary : {name}` (exact format, no variation) |
| `UID` | `orbit-{YYYYMMDD}@{domain}` (deterministic) |
| `TRANSP` | `OPAQUE` or `TRANSPARENT` (see §2.3) |

### 2.3 TRANSP / busy-free behavior

| Condition | Expected TRANSP |
|---|---|
| `me=1`, this day's primary is p1 | `OPAQUE` |
| `me=1`, this day's primary is p2 | `TRANSPARENT` |
| `me=2`, this day's primary is p2 | `OPAQUE` |
| `me=2`, this day's primary is p1 | `TRANSPARENT` |
| `me` not supplied | `TRANSPARENT` (all events) |

### 2.4 Calendar name (`X-WR-CALNAME`)

| Condition | Expected value |
|---|---|
| `me=1`, `p1=Alice` | `ORBIT — Alice` |
| `me=2`, `p2=Bob` | `ORBIT — Bob` |
| `me` not supplied | `ORBIT` (or omit the property — either is acceptable) |

### 2.5 Window coverage

The feed must include events from **7 days before today** through **12 months forward**, exclusive of Sundays.

- Verify the earliest event date is ≤ today − 7 days.
- Verify the latest event date is ≥ today + 364 days.
- Verify no event falls on a Sunday.

### 2.6 UID determinism

Request the feed twice on the same day. Every event UID in the second response must match the corresponding UID from the first response exactly. No duplicate events in a single response.

### 2.7 DTEND convention

For each event, `DTEND` must be exactly `DTSTART + 1 day`. This is the iCal all-day event convention (exclusive end date).

---

## 3. Parameter Handling

### 3.1 Required parameters

| Request | Expected response |
|---|---|
| Missing `p1` | `400 Bad Request`, plain-text error message |
| Missing `p2` | `400 Bad Request`, plain-text error message |
| Missing both `p1` and `p2` | `400 Bad Request` |
| Both `p1` and `p2` present | `200 OK`, valid ICS |

### 3.2 Optional parameters — `variant`

| `variant` value | Expected behavior |
|---|---|
| `2D` | ORBIT-2D block assignment |
| `3D` | ORBIT-3D block assignment |
| Omitted | Defaults to `2D` |
| `invalid` | Silently defaults to `2D` |
| `2d` (lowercase) | Implementation choice: accept or default; document which |

### 3.3 Optional parameters — `me`

| `me` value | Expected behavior |
|---|---|
| `1` | Busy/free enabled for p1 |
| `2` | Busy/free enabled for p2 |
| Omitted | All events TRANSPARENT |
| `3` (out of range) | Silently omit busy/free (treat as unset) |
| `alice` (string) | Silently omit busy/free |

### 3.4 Name values

| `p1` / `p2` value | Expected behavior |
|---|---|
| Plain ASCII string | Appears verbatim in `SUMMARY` |
| String with spaces (e.g. `Mary Jo`) | Appears in SUMMARY; URL-encoded in the URL |
| Empty string | Treat as missing → `400 Bad Request` |
| Very long string (>100 chars) | Implementation choice: truncate or accept; document which |

### 3.5 Content-Type header

Every successful response must include:

```
Content-Type: text/calendar; charset=utf-8
```

---

## 4. Edge Cases

### 4.1 ISO week year boundary — week 53

Some years have 53 ISO weeks (years where Jan 1 is Thursday, or leap years where Jan 1 is Wednesday). Week 53 is always odd → Week A.

- **Test date:** 2026-12-28 (Mon) — verify ISO week number and correct primary assignment.
- Confirm the implementation uses ISO 8601 week numbering, not `Date.getWeek()` or similar non-standard methods.

### 4.2 ISO week 1 of new year

ISO week 1 is the week containing the first Thursday of the year. This can start in late December of the prior year.

- **Test date:** 2025-12-29 (Mon) — this is ISO week 1 of 2026 (odd → Week A). Verify p1 is Primary.
- **Test date:** 2026-12-28 (Mon) — check ISO week number; may be week 53 of 2026 (odd → Week A) or week 1 of 2027.

### 4.3 Year boundary in the feed window

When the feed is requested in late December, the 12-month lookahead crosses into the following year. Verify:
- Events are generated correctly across the year boundary.
- ISO week parity is computed from the actual ISO week number, not the calendar year.

### 4.4 ORBIT-2D / ORBIT-3D seam

At the boundary between blocks within a week, verify no day is assigned to both parents or to neither.

- ORBIT-2D: Wed is the first day of p2's block in Week A. Tue and Wed must have different primaries.
- ORBIT-3D: Thu is the first day of p2's block in Week A. Wed and Thu must have different primaries.

### 4.5 ORBIT-2D / ORBIT-3D fortnightly seam

At the week boundary (Sat → following Mon), verify:
- Week A Sat and Week B Mon have the correct (and expected-to-differ) primaries.

| Variant | Week A Sat | Week B Mon |
|---|---|---|
| 2D | p1 | p2 |
| 3D | p2 | p2 |

---

## 5. End-to-End (GCal Subscription)

These tests require a live deployment and a Google Calendar account. Run them once after initial deploy and after any change to the ICS output format.

### 5.1 Subscription

- Subscribe to the feed URL in Google Calendar using "From URL."
- Verify events appear on the correct days within ~24 hours.
- Verify event titles match `Primary : {name}` exactly.

### 5.2 Busy/free reflection

- Subscribe with `me=1`.
- Open Google Calendar's "Meet with…" or scheduling assistant.
- Verify that p1's Primary days appear as busy and non-Primary days appear as free.

### 5.3 Variant switch

- Subscribe with `variant=2D`.
- Update the subscription URL to `variant=3D`.
- Wait for GCal to refresh (up to 24 hours, or force a refresh).
- Verify the event pattern updates correctly — no duplicate events.

### 5.4 Refresh

- Request the feed directly (browser or `curl`).
- Verify `REFRESH-INTERVAL;VALUE=DURATION:PT12H` is present.
- Verify the response is fast (< 500ms).

### 5.5 ICS validator

Run the feed output through an RFC 5545 validator (e.g. [iCalendar Validator](https://icalendar.org/validator.html)) before declaring the feed production-ready.

---

## Test tooling

- Unit tests for `rotation.ts`: Jest (or Vitest) — no HTTP server needed
- Integration tests for the full endpoint: `functions-framework` local server + `node-fetch` or `curl`
- End-to-end: manual, as described in §5

---

*Part of The ORBIT Approach — Our Rotation, Both In Turn*
