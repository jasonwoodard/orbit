# ORBIT ICS Feed — Function Reference

Technical reference for the deployed Cloud Function. This is the API contract: parameters, response format, error behavior, and worked examples.

For a friendlier walkthrough that builds your personal subscription URL for you, use `orbit-user-guide.html` instead. For the rotation rules themselves, see `orbit-core.md`.

---

## Endpoint

```
GET https://orbit.jasonwoodard.com/
```

Custom domain, mapped via Cloud Run domain mapping to the `orbitics` service (project `jw-orbit`, region `us-central1`). The underlying Cloud Run URL (`https://orbitics-lvfps3j5mq-uc.a.run.app/`) still works and returns identical output, but `orbit.jasonwoodard.com` is the canonical endpoint to share.

## Parameters

| Parameter | Required | Default | Values | Notes |
|---|---|---|---|---|
| `p1` | Yes | — | Any non-empty string | Name of the first parent; owns odd ISO weeks (Week A) |
| `p2` | Yes | — | Any non-empty string | Name of the second parent; owns even ISO weeks (Week B) |
| `me` | No | — | `1` or `2` | Marks that parent's Primary days as busy (`OPAQUE`) instead of free (`TRANSPARENT`) |
| `variant` | No | `2D` | `2D` or `3D` | Block-length variant (see `orbit-core.md`) |
| `hours` | No | off (all-day) | see below | Renders events as a timed local window instead of an all-day banner |

Any other value for `variant` or `me` (missing, malformed, out of range) is silently ignored and falls back to the default — the request still succeeds.

### `hours` grammar

`hours` is independent of `me` — it only ever controls event *shape* (all-day vs. timed), never busy/free. It's resolved in three tiers:

| `hours` value | Resolves to |
|---|---|
| absent, `""`, `0`, `false`, `no`, `off` | **off** — all-day event (today's default) |
| `1`, `true`, `yes`, `on` | **on**, default window `07:00`–`20:00` |
| `HHMM-HHMM` or `HH:MM-HH:MM`, valid (0–23h, 0–59m, start strictly before end) | **on**, that exact window, e.g. `hours=0630-2145` |
| anything else unparseable (bad hour/minute, end ≤ start, garbage) | falls back to **off** |

Events are emitted as **floating local time** (no `Z` suffix, no `TZID`) — each subscriber's calendar renders the time in whatever timezone that calendar is currently set to, so no timezone parameter is needed.

## Responses

### Success — `200 OK`

```
Content-Type: text/calendar; charset=utf-8
```

Body is an RFC 5545 iCalendar document covering **7 days before today through 12 months forward**, one event per active day (Monday–Saturday; Sunday is never included) — all-day by default, or a timed window when `hours` is on.

### Error — `400 Bad Request`

Returned when `p1` or `p2` is missing or empty. Plain text body, e.g.:

```
Missing required parameter(s): p1 and p2 are both required.
```

## Event format

Each `VEVENT`:

| Property | Value |
|---|---|
| `DTSTART` / `DTEND` | All-day (`;VALUE=DATE:YYYYMMDD`, `DTEND` = `DTSTART` + 1 day) by default; floating local `YYYYMMDDTHHMMSS` for both when `hours` resolves to a window |
| `SUMMARY` | `Primary : {name}` — the resolved `p1`/`p2` name for that day |
| `TRANSP` | `OPAQUE` if that day's Primary matches `me`, otherwise `TRANSPARENT` — governed entirely by `me`, unaffected by `hours` |
| `UID` | `orbit-{YYYYMMDD}@orbit.jasonwoodard.com` — always date-only regardless of `hours`, so re-subscribing, refreshing, or toggling `hours` never creates duplicates |

Calendar-level properties: `X-WR-CALNAME` is always set to `ORBIT ({p1} | {p2})`, regardless of whether `me` is supplied, and `REFRESH-INTERVAL;VALUE=DURATION:PT12H` tells clients how often to poll.

Note: Google Calendar's "Subscribe from URL" often ignores `X-WR-CALNAME` on the initial add and shows the raw URL as the calendar name instead — you may need to rename it manually in Calendar settings after subscribing.

## Example requests

**Shared/display feed, no busy-free:**
```bash
curl "https://orbit.jasonwoodard.com/?p1=Alice&p2=Bob"
```

**Alice subscribing (her Primary days show as busy), 2D variant:**
```bash
curl "https://orbit.jasonwoodard.com/?p1=Alice&p2=Bob&me=1"
```
```
HTTP/2 200
content-type: text/calendar; charset=utf-8

BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ORBIT Approach//Calendar Feed//EN
CALSCALE:GREGORIAN
X-WR-CALNAME:ORBIT (Alice | Bob)
X-WR-CALDESC:The ORBIT Approach rotation schedule
REFRESH-INTERVAL;VALUE=DURATION:PT12H
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260914
DTEND;VALUE=DATE:20260915
SUMMARY:Primary : Bob
TRANSP:TRANSPARENT
UID:orbit-20260914@orbit.jasonwoodard.com
END:VEVENT
...
END:VCALENDAR
```

**Bob subscribing, 3D variant:**
```bash
curl "https://orbit.jasonwoodard.com/?p1=Alice&p2=Bob&me=2&variant=3D"
```

**Alice subscribing with a timed window instead of all-day, default `07:00`–`20:00`:**
```bash
curl "https://orbit.jasonwoodard.com/?p1=Alice&p2=Bob&me=1&hours=1"
```
```
BEGIN:VEVENT
DTSTART:20260914T070000
DTEND:20260914T200000
SUMMARY:Primary : Bob
TRANSP:TRANSPARENT
UID:orbit-20260914@orbit.jasonwoodard.com
END:VEVENT
```

**Custom window (early-riser family, 6:30am–9:45pm):**
```bash
curl "https://orbit.jasonwoodard.com/?p1=Alice&p2=Bob&me=1&hours=0630-2145"
```

**Missing a required parameter:**
```bash
curl -i "https://orbit.jasonwoodard.com/?p1=Alice"
```
```
HTTP/2 400
content-type: text/plain; charset=utf-8

Missing required parameter(s): p1 and p2 are both required.
```

## Subscribing in Google Calendar

Settings → Add calendar → From URL → paste the full request URL (with your own `p1`, `p2`, `me`, `variant`, and `hours`). Google Calendar polls on its own schedule (roughly every 12–24 hours); there's no way to force an immediate refresh from the subscriber side.

## Source

Implementation lives in `functions/orbit-ics/`: `rotation.ts` (day-assignment logic), `ics.ts` (RFC 5545 builder), `index.ts` (HTTP handler). See `orbit-tech-plan.md` for the full technical spec and `orbit-test-plan.md` for the test cases this behavior is verified against.
