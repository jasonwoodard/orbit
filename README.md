# ORBIT — Our Rotation, Both In Turn

A fortnightly lead parent rotation, plus a calendar feed that keeps it visible without anyone having to remember it.

---

## Just use it

Build your personal calendar link and subscribe in Google Calendar — no reading required:

**→ [jasonwoodard.github.io/orbit/orbit-user-guide.html](https://jasonwoodard.github.io/orbit/orbit-user-guide.html)**

---

## What ORBIT is

ORBIT answers one question every day: *which parent is Primary today?* Primary owns the day end to end — drop-off through pickup and everything in between. The other parent is present but off the hook.

- **Primary owns the day.** No ambiguity about who's running things.
- **Blocks are the unit.** Each parent gets contiguous stretches of free days, not scattered singles — long enough for real rest or real work.
- **Equity is structural.** Over any two-week cycle, both parents carry the exact same number of Primary days. Nobody's keeping score because the score is always tied.
- **Grace is the coverage rule.** Sick, traveling, unavailable — the other parent covers, no tracking, no IOU.
- **The schedule is always knowable.** Any day, months out, has a named Primary — driven by nothing more than the ISO week number's odd/even parity.

It comes in two block-length variants — **ORBIT-2D** (2-day blocks) and **ORBIT-3D** (3-day blocks) — switchable per season with no reconfiguration.

Full spec — principles, both variants' day-by-day patterns, swapping, and the categorical rules for holidays/sick days/travel/etc. — lives in **[`docs/orbit-core.md`](docs/orbit-core.md)**.

---

## What's in this repo

| Path | What it is |
|---|---|
| `docs/orbit-core.md` | The definitive rotation spec — principles, patterns, categoricals |
| `docs/orbit-calendar-feed-prd.md` | Product requirements for the ICS feed |
| `docs/orbit-tech-plan.md` | Hosting decisions (incl. which GCP products are in play), repo structure, technical spec |
| `docs/orbit-test-plan.md` | Test cases for rotation logic, ICS output, and parameter handling |
| `docs/orbit-ics-function.md` | Function reference — endpoint, parameters, response format, worked examples |
| `docs/orbit-user-guide.html` | Interactive setup guide (served via GitHub Pages) — the link above |
| `functions/orbit-ics/` | The Cloud Function itself — the ICS feed endpoint |

---

## The ICS feed

Built and deployed. `functions/orbit-ics/` is a Cloud Function that generates the ORBIT rotation as a subscribable iCalendar feed on every request — no database, no cron job, no static file to regenerate.

**Endpoint:** `https://orbit.jasonwoodard.com/`

For the full parameter reference (`p1`, `p2`, `me`, `variant`, `hours`, `tz`), response format, and worked `curl` examples, see **[`docs/orbit-ics-function.md`](docs/orbit-ics-function.md)**. For the hosting decisions and which GCP products back it, see **[`docs/orbit-tech-plan.md`](docs/orbit-tech-plan.md)**.

Most people won't need any of that — the [user guide](https://jasonwoodard.github.io/orbit/orbit-user-guide.html) builds the URL for you.

---

*Part of The ORBIT Approach — Our Rotation, Both In Turn*
