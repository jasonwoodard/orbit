# ORBIT Calendar Feed — Product Requirements Document

**Product:** ORBIT Approach iCalendar Feed
**Version:** 1.0
**Status:** Draft
**Companion document:** orbit-tech-plan.md

---

## Overview

A dynamically generated iCalendar (ICS) feed that publishes the ORBIT Approach rotation schedule as subscribable calendar events. Subscribers add the feed URL to Google Calendar (or any iCal-compatible client) once and the schedule appears automatically, updating indefinitely without any manual maintenance.

The feed answers one question: *who is Primary today?*

---

## Problem Statement

After one month of running ORBIT, the friction point is schedule legibility. The ISO week odd/even rule is correct and computable, but it requires a mental step that interrupts the day. A calendar feed makes the schedule ambient — visible at a glance in the tool both parents already check daily.

---

## Goals

- Primary ownership is visible in Google Calendar without any manual entry
- The feed is self-maintaining — no regeneration required when the calendar rolls forward
- Switching between ORBIT-2D and ORBIT-3D requires only a URL parameter change
- The feed is shareable with other families with their own names and configuration
- No swap tracking — the feed represents the standing pattern only

## Non-Goals

- Swap or exception tracking (handled verbally, outside the system)
- Historical data (feed is forward-looking only)
- Authentication or per-user accounts
- Native mobile app

---

## Users

**Primary:** Both parents, each subscribing to the same feed URL with different `me` parameters.

**Secondary:** Other families who adopt the ORBIT Approach and want a calendar feed — same function, different names via URL params.

---

## Functional Requirements

### Feed generation

- Returns a valid `text/calendar` (ICS) response on every HTTP GET
- Generates events from a rolling window: **7 days before today** through **12 months forward**
  - The 7-day lookback ensures events don't vanish from the calendar mid-week if the subscriber's client caches aggressively
- Regenerates dynamically on every request — no static file, no cron job
- Conforms to RFC 5545 (iCalendar specification)

### Events

- **One all-day event per active day** (Monday through Saturday)
- **No event on Sunday** — Sunday is outside the rotation
- Event covers the full calendar day (`DTSTART;VALUE=DATE` / `DTEND;VALUE=DATE`)
- Events are non-blocking by default; the `me` parameter overrides this (see below)

### Event title format

```
Primary : Alice
```
or
```
Primary : Bob
```

Simple, unambiguous, consistent. No abbreviation.

### `me` parameter — busy/free behavior

When `me` is supplied, the feed sets the iCal `TRANSP` property per event:

| Condition | TRANSP value | GCal behavior |
|---|---|---|
| This day's Primary matches `me` | `OPAQUE` | Shows as **busy** |
| This day's Primary does not match `me` | `TRANSPARENT` | Shows as **free** |
| `me` not supplied | `TRANSPARENT` | Always free (display only) |

This means scheduling tools correctly reflect that the Primary parent is unavailable on their primary days — without any manual blocking.

### Parameters

| Parameter | Required | Default | Values | Notes |
|---|---|---|---|---|
| `p1` | Yes | — | Any string | Name of the first parent (owns odd ISO weeks, e.g. `Alice`) |
| `p2` | Yes | — | Any string | Name of the second parent (owns even ISO weeks, e.g. `Bob`) |
| `me` | No | — | `1` or `2` | Which parent is subscribing; enables busy/free |
| `variant` | No | `2D` | `2D` or `3D` | Block length variant |

### Rotation logic

**Anchor:** `p1` (e.g. Alice) owns **odd ISO weeks**. `p2` (e.g. Bob) owns **even ISO weeks**. This is fixed — no configurable anchor needed.

**ORBIT-2D block assignment** (within each week, Mon–Sat):

| Day | Odd week (A) | Even week (B) |
|---|---|---|
| Mon | p1 | p2 |
| Tue | p1 | p2 |
| Wed | p2 | p1 |
| Thu | p2 | p1 |
| Fri | p1 | p2 |
| Sat | p1 | p2 |

**ORBIT-3D block assignment** (within each week, Mon–Sat):

| Day | Odd week (A) | Even week (B) |
|---|---|---|
| Mon | p1 | p2 |
| Tue | p1 | p2 |
| Wed | p1 | p2 |
| Thu | p2 | p1 |
| Fri | p2 | p1 |
| Sat | p2 | p1 |

### URL examples

```
# Alice subscribing, 2D variant (default)
https://orbit.example.com/orbitcal.ics?p1=Alice&p2=Bob&me=1

# Bob subscribing, 2D variant
https://orbit.example.com/orbitcal.ics?p1=Alice&p2=Bob&me=2

# Shared/display feed, no busy/free
https://orbit.example.com/orbitcal.ics?p1=Alice&p2=Bob

# 3D variant
https://orbit.example.com/orbitcal.ics?p1=Alice&p2=Bob&me=1&variant=3D
```

---

## Non-Functional Requirements

- **Response time:** < 500ms — the feed is pure computation, no I/O
- **Availability:** Best-effort; GCal caches feeds aggressively (typically refreshes every 24h), so brief downtime is tolerable
- **Cost:** Negligible — Cloud Functions gen2 free tier covers ~2M invocations/month; this feed will receive a handful of requests per day
- **No database:** All state is derived from the URL parameters and the current date
- **CORS:** Not required — iCal feed clients don't use CORS

---

## Technical Approach

- **Feed generation:** Dynamic HTTP endpoint — no static file, no cron job. All state derived from URL parameters and the current date.
- **Stack:** Node.js / TypeScript, Cloud Functions gen2. See `orbit-tech-plan.md` for hosting rationale, repository structure, and build sequence.
- **ICS conformance:** RFC 5545. Deterministic event UIDs ensure GCal deduplicates correctly on refresh.
- **No database:** The rotation is fully computable from the request parameters and ISO week number.

## User Guide

An interactive HTML setup guide (`orbit-cal-user-guide.html`) accompanies the feed. It walks each parent through building their personal feed URL via a four-step progressive form: names → which week type you start on → options (variant, busy/free) → the generated URL and GCal subscription instructions.

The guide is a self-contained static file. It requires no backend — URL construction is client-side JavaScript. It is hosted via GitHub Pages from the `docs/` directory of the repo.

The guide is the intended on-ramp for any family adopting the ORBIT Approach. It makes the parameterized URL approachable without requiring the subscriber to understand the underlying URL structure.

---

## Open Questions

1. **Variant switching UX:** When switching from 2D to 3D, should the existing calendar subscription be updated (URL param change) or should both feeds coexist? Recommend: one URL, change the `variant` param, GCal updates automatically on next refresh.
2. **Calendar color:** GCal allows subscribers to set a calendar color client-side. No server-side control needed or desired.

---

## Success Criteria

- Both parents can subscribe to the feed and see Primary ownership on every Mon–Sat without any manual calendar entry
- Switching from ORBIT-2D to ORBIT-3D requires only updating the `variant` parameter in the subscription URL
- A third family could use the feed by substituting their own names in the URL
- The feed requires zero maintenance once deployed

---

*Part of The ORBIT Approach — Our Rotation, Both In Turn*
