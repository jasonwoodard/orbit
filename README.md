# ORBIT — Our Rotation, Both In Turn

A fortnightly family scheduling system and its calendar integration.

---

## What's in this repo

| Path | What it is |
|---|---|
| `ORBIT.md` | The definitive rotation spec — principles, patterns, categoricals |
| `docs/ORBIT-calendar-feed-PRD.md` | Product requirements for the ICS feed |
| `docs/orbit-tech-plan.md` | Hosting decisions, repo structure, build sequence, technical spec |
| `docs/orbit-test-plan.md` | Test cases for rotation logic, ICS output, and parameter handling |
| `docs/orbit-cal-user-guide.html` | Interactive setup guide (served via GitHub Pages) |
| `docs/ORBIT-infographic.html` | Print-ready 8.5×11 rotation cheat sheet |
| `functions/orbit-ics/` | Cloud Function — the ICS feed endpoint |

---

## The two deliverables

### 1. ICS feed — `functions/orbit-ics/`

A dynamic HTTP endpoint that generates the ORBIT rotation as a subscribable iCalendar feed. Add the URL to Google Calendar once; the schedule appears automatically and updates indefinitely.

**Endpoint:** `GET https://orbit.example.com/orbitcal.ics`

| Parameter | Required | Default | Description |
|---|---|---|---|
| `p1` | Yes | — | Name of the first parent (owns odd ISO weeks) |
| `p2` | Yes | — | Name of the second parent (owns even ISO weeks) |
| `me` | No | — | `1` or `2` — which parent is subscribing; enables busy/free blocking |
| `variant` | No | `2D` | `2D` or `3D` — block length variant |

**Example URLs:**

```
# Alice subscribing, 2D (default)
https://orbit.example.com/orbitcal.ics?p1=Alice&p2=Bob&me=1

# Bob subscribing, 3D variant
https://orbit.example.com/orbitcal.ics?p1=Alice&p2=Bob&me=2&variant=3D

# Shared/display feed, no busy/free
https://orbit.example.com/orbitcal.ics?p1=Alice&p2=Bob
```

### 2. User guide — `docs/orbit-cal-user-guide.html`

A self-contained interactive HTML page that walks each parent through building their personal feed URL. Hosted via GitHub Pages. No backend required — URL construction is pure client-side JavaScript.

**Live at:** `https://jasonwoodard.github.io/orbit/orbit-cal-user-guide.html`

---

## Quick orientation

**The rotation rule:**

- `p1` (Alice) owns all **odd ISO weeks** (Week A)
- `p2` (Bob) owns all **even ISO weeks** (Week B)
- Sunday is always outside the rotation

**ORBIT-2D block assignment (Mon–Sat):**

| Day | Odd week (A) | Even week (B) |
|---|---|---|
| Mon | p1 | p2 |
| Tue | p1 | p2 |
| Wed | p2 | p1 |
| Thu | p2 | p1 |
| Fri | p1 | p2 |
| Sat | p1 | p2 |

**ORBIT-3D block assignment (Mon–Sat):**

| Day | Odd week (A) | Even week (B) |
|---|---|---|
| Mon | p1 | p2 |
| Tue | p1 | p2 |
| Wed | p1 | p2 |
| Thu | p2 | p1 |
| Fri | p2 | p1 |
| Sat | p2 | p1 |

See `ORBIT.md` for the full spec.

---

## Stack

- **Feed:** Node.js / TypeScript, Google Cloud Functions gen2, HTTP trigger
- **User guide:** Static HTML, GitHub Pages (`docs/` directory)
- **No database** — all state is derived from URL parameters and the ISO week number

---

## Build sequence

See `docs/orbit-tech-plan.md` § Build Sequence for the full step-by-step. In brief:

1. Enable GitHub Pages on this repo pointing at `docs/` — user guide is immediately live
2. Create a new GCP project for ORBIT
3. Scaffold `functions/orbit-ics/` with TypeScript
4. Implement and test `rotation.ts` and `ics.ts`
5. Deploy to Cloud Functions gen2
6. Point a custom subdomain at the Cloud Run service URL

---

## Project documents

- **ORBIT.md** — start here to understand the system
- **docs/ORBIT-calendar-feed-PRD.md** — what the feed does and why
- **docs/orbit-tech-plan.md** — how it's built and where it lives
- **docs/orbit-test-plan.md** — what to verify before shipping

---

*Part of The ORBIT Approach — Our Rotation, Both In Turn*
