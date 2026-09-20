# ORBIT ICS Feed — Function Reference

Technical reference for the deployed Cloud Function. This is the API contract: parameters, response format, error behavior, and worked examples.

For a friendlier walkthrough that builds your personal subscription URL for you, use `orbit-cal-user-guide.html` instead. For the rotation rules themselves, see `orbit-core.md`.

---

## Endpoint

```
GET https://orbitics-lvfps3j5mq-uc.a.run.app/
```

This is the current Cloud Run URL (project `jw-orbit`, region `us-central1`). It will move to a custom subdomain once DNS is configured (see `orbit-tech-plan.md` § Build Sequence, step 8) — update this page when that happens.

## Parameters

| Parameter | Required | Default | Values | Notes |
|---|---|---|---|---|
| `p1` | Yes | — | Any non-empty string | Name of the first parent; owns odd ISO weeks (Week A) |
| `p2` | Yes | — | Any non-empty string | Name of the second parent; owns even ISO weeks (Week B) |
| `me` | No | — | `1` or `2` | Marks that parent's Primary days as busy (`OPAQUE`) instead of free (`TRANSPARENT`) |
| `variant` | No | `2D` | `2D` or `3D` | Block-length variant (see `orbit-core.md`) |

Any other value for `variant` or `me` (missing, malformed, out of range) is silently ignored and falls back to the default — the request still succeeds.

## Responses

### Success — `200 OK`

```
Content-Type: text/calendar; charset=utf-8
```

Body is an RFC 5545 iCalendar document covering **7 days before today through 12 months forward**, one all-day event per active day (Monday–Saturday; Sunday is never included).

### Error — `400 Bad Request`

Returned when `p1` or `p2` is missing or empty. Plain text body, e.g.:

```
Missing required parameter(s): p1 and p2 are both required.
```

## Event format

Each `VEVENT`:

| Property | Value |
|---|---|
| `DTSTART;VALUE=DATE` | The active day, `YYYYMMDD` |
| `DTEND;VALUE=DATE` | `DTSTART` + 1 day (iCal all-day convention) |
| `SUMMARY` | `Primary : {name}` — the resolved `p1`/`p2` name for that day |
| `TRANSP` | `OPAQUE` if that day's Primary matches `me`, otherwise `TRANSPARENT` |
| `UID` | `orbit-{YYYYMMDD}@orbit.jasonwoodard.com` — deterministic, so re-subscribing or refreshing never creates duplicates |

Calendar-level properties: `X-WR-CALNAME` is set to `ORBIT — {subscriber name}` when `me` is supplied (omitted otherwise), and `REFRESH-INTERVAL;VALUE=DURATION:PT12H` tells clients how often to poll.

## Example requests

**Shared/display feed, no busy-free:**
```bash
curl "https://orbitics-lvfps3j5mq-uc.a.run.app/?p1=Alice&p2=Bob"
```

**Alice subscribing (her Primary days show as busy), 2D variant:**
```bash
curl "https://orbitics-lvfps3j5mq-uc.a.run.app/?p1=Alice&p2=Bob&me=1"
```
```
HTTP/2 200
content-type: text/calendar; charset=utf-8

BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ORBIT Approach//Calendar Feed//EN
CALSCALE:GREGORIAN
X-WR-CALNAME:ORBIT — Alice
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
curl "https://orbitics-lvfps3j5mq-uc.a.run.app/?p1=Alice&p2=Bob&me=2&variant=3D"
```

**Missing a required parameter:**
```bash
curl -i "https://orbitics-lvfps3j5mq-uc.a.run.app/?p1=Alice"
```
```
HTTP/2 400
content-type: text/plain; charset=utf-8

Missing required parameter(s): p1 and p2 are both required.
```

## Subscribing in Google Calendar

Settings → Add calendar → From URL → paste the full request URL (with your own `p1`, `p2`, `me`, and `variant`). Google Calendar polls on its own schedule (roughly every 12–24 hours); there's no way to force an immediate refresh from the subscriber side.

## Source

Implementation lives in `functions/orbit-ics/`: `rotation.ts` (day-assignment logic), `ics.ts` (RFC 5545 builder), `index.ts` (HTTP handler). See `orbit-tech-plan.md` for the full technical spec and `orbit-test-plan.md` for the test cases this behavior is verified against.
