# ORBIT — Technical Plan

**Version:** 1.0  
**Status:** Draft  
**Companion document:** ORBIT-calendar-feed-PRD.md

---

## Scope

This plan covers two deliverables:

1. **The ICS feed** — a dynamic HTTP endpoint that generates the iCalendar rotation schedule on demand
2. **The user guide** — a static HTML page that helps each parent build their personal feed URL and add it to Google Calendar

**Out of scope:** A hosted website for the ORBIT project. The user guide is a self-contained file, not a site. No web presence beyond functional endpoints is planned at this time.

---

## 1. The ICS Feed — Hosting

### Decision: Google Cloud Functions gen2

GCP is the established provider for this project. Using it for the feed avoids introducing a new vendor relationship and keeps IAM, billing, and deployment tooling in one place.

### Options Considered

| Option | Verdict | Notes |
|---|---|---|
| **Google Cloud Functions gen2** | **Chosen** | Existing GCP account; consistent vendor; standard Node/TypeScript toolchain |
| **Cloudflare Workers** | Rejected | No cold-start advantage at GCal's 24h refresh cadence; would require a new account |
| **Vercel** | Rejected | Excellent DX but adds a third vendor with no meaningful benefit at this traffic level |
| **GitHub Actions + static ICS** | Disqualified | A static file cannot be dynamically parameterized; staleness risk is fundamental, not fixable |

Expected traffic: **2–6 requests/day** (two subscribers, GCal refresh cadence ~every 12–24h, plus occasional manual refreshes). All options cost $0 at this volume.

---

## 2. The User Guide — Hosting

### Decision: GitHub Pages

The user guide (`orbit-cal-user-guide.html`) is a single self-contained HTML file with no server-side logic. Its value is shareability — any family adopting ORBIT needs a URL to send, not a file to attach. GitHub Pages serves it free, deploys on every push to `main`, and requires no additional tooling.

The guide is served from the `docs/` directory, which is also where GitHub Pages is pointed. No separate repo or branch needed.

DNS unification (`orbit.example.com` serving both the guide and the feed) is deferred. The simpler path — guide on `github.io`, feed on its Cloud Function URL — is correct for v1.

---

## 3. Repository Structure

```
orbit/
  README.md                         ← project overview + quick-start
  ORBIT.md                          ← definitive rotation spec
  functions/
    orbit-ics/
      index.ts                      ← Cloud Function HTTP entry point
      rotation.ts                   ← ORBIT-2D / ORBIT-3D day logic
      ics.ts                        ← RFC 5545 ICS string builder
      package.json
      tsconfig.json
  docs/                             ← GitHub Pages root
    ORBIT-calendar-feed-PRD.md      ← feed product requirements
    orbit-tech-plan.md              ← this document
    orbit-cal-user-guide.html       ← interactive URL builder / setup guide
    ORBIT-infographic.html          ← print-ready 8.5×11 cheat sheet
```

Notes:
- `docs/` serves double duty as the GitHub Pages root and the home for all project documentation. No separate `infographic/` folder.
- `functions/` is the only non-doc top-level subfolder.

---

## 4. Technical Specification

### Stack

- **Runtime:** Node.js (TypeScript), Cloud Functions gen2 HTTP trigger
- **Host:** Google Cloud (dedicated project), proxied via custom subdomain
- **Repo:** GitHub, under `functions/orbit-ics/`

### ICS structure

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ORBIT Approach//Calendar Feed//EN
CALSCALE:GREGORIAN
X-WR-CALNAME:ORBIT — Alice
X-WR-CALDESC:The ORBIT Approach rotation schedule
REFRESH-INTERVAL;VALUE=DURATION:PT12H
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260901
DTEND;VALUE=DATE:20260902
SUMMARY:Primary : Alice
TRANSP:OPAQUE
UID:orbit-20260901@orbit.example.com
END:VEVENT
...
END:VCALENDAR
```

Notes:
- `X-WR-CALNAME` includes the subscriber's name (e.g. `ORBIT — Alice`) when `me` is supplied
- `REFRESH-INTERVAL` set to 12 hours — fast enough to catch same-day corrections
- `UID` is deterministic (`orbit-{date}@{domain}`) — ensures GCal deduplicates correctly on refresh rather than creating duplicate events
- `SUMMARY` uses the subscriber's resolved name (e.g. `Primary : Alice` or `Primary : Bob`)
- `DTEND` is the following day (iCal all-day event convention)

### ISO week computation

Use the standard ISO 8601 week number. In JavaScript:

```typescript
function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3
    + ((week1.getDay() + 6) % 7)) / 7) + 1;
}

const isWeekA = (date: Date) => getISOWeek(date) % 2 === 1; // odd = p1 starts
```

### Error handling

- Missing `p1` or `p2` → return `400 Bad Request` with plain text error
- Invalid `variant` → silently default to `2D`
- Invalid `me` → silently omit busy/free behavior (treat as unset)

---

## 5. Build Sequence

1. **Repo** — Create the GitHub repo, push existing files into the structure above
2. **Pages** — Enable GitHub Pages on the repo pointing at `docs/`. User guide is live immediately at the GitHub Pages URL.
3. **GCP project** — Create a new GCP project for ORBIT (clean separation from other GCP work)
4. **Function skeleton** — Scaffold `functions/orbit-ics/` with TypeScript; local test with `functions-framework`
5. **Rotation logic** — Implement and unit-test `rotation.ts` (ISO week, 2D/3D day assignment)
6. **ICS builder** — Implement `ics.ts`; verify output against RFC 5545 with a live calendar client
7. **Deploy** — `gcloud functions deploy` to a staging URL; end-to-end test with GCal subscription
8. **DNS** — Add subdomain CNAME pointing at the Cloud Run service URL

Steps 1–3 are a morning. Steps 4–7 are the real work. Step 8 is a DNS record and five minutes.

Deployment is manual from local for v1. CI/CD is a later nicety.

---

*Part of The ORBIT Approach — Our Rotation, Both In Turn*
