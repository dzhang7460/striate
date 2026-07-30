# Striate — v0.1

An honest, adaptive daily coach for **fitness beginners**. One 60-second check-in → one realistic recommendation for today, with the reason, a confidence level, and an explanation of why the plan changed since yesterday.

**Personality contract:** direct, evidence-based, non-flattering. When confidence is low or data is missing, the coach says so instead of pretending.

## Currently completed features (v0.1 core loop)

1. **Landing page** — headline, trust principles (honest / adaptive / beginner-friendly / no fluff), single Start CTA. Detects returning users and routes them to check-in / today.
2. **Onboarding** (4 steps, ~90s, progress bar): age range, height/weight, goal, experience, available days, session length, bedtime, equipment (multi-select), optional injury notes. Also serves as **profile editing** via `onboarding.html?edit=1` (Profile tab).
3. **Daily check-in** — sleep, energy (1–5), soreness (1–5), mood (1–5), time available, unusual constraint (exam / busy / travel / injury / sick), optional note. One entry per day (re-submitting replaces today's plan).
4. **Recommendation ("Today")** — state summary + check-in badges, one main action with concrete how-to, reason, one supporting habit, confidence badge (high/medium/low) with an honest confidence note, caution callout when relevant, and a **"why this changed"** diff vs. the previous check-in.
5. **History** — collapsible per-day cards with date, check-in stats, main action, reason, supporting habit, caution, and the user's note. Capped at 90 days.

## Entry URIs

| Path | Purpose |
|---|---|
| `index.html` | Landing (adapts CTA for returning users) |
| `onboarding.html` | Profile setup · `?edit=1` = edit existing profile |
| `check-in.html` | Daily check-in form |
| `today.html` | Today's recommendation (empty state if no check-in yet) |
| `history.html` | Past check-ins + recommendations |

All app pages redirect to onboarding if no profile exists. App pages share a fixed bottom tab bar (Today / Check-in / History / Profile).

## Stack & architecture

Static site (this platform hosts static HTML/CSS/JS, so Next.js was adapted to a no-build equivalent with the same routes and data model):

- Vanilla ES6 + custom CSS design system (dark, calm, athletic; Inter + Space Grotesk, Font Awesome via CDN)
- Mobile-first: 480px shell, 46–54px touch targets, chip/scale selectors instead of dropdowns, safe-area-aware tab bar

```
index.html / onboarding.html / check-in.html / today.html / history.html
css/style.css        design system (tokens, chips, cards, badges, tabbar)
js/store.js          persistence layer (localStorage; swap for API later)
js/coach.js          recommendation engine + LLM plug point
js/ui.js             shared helpers (chip groups, tabbar, guards, escaping)
js/onboarding.js · js/checkin.js · js/today.js · js/history.js   page controllers
```

## Data models (localStorage)

- `striate_profile_v1` → `{ id, ageRange, heightCm, weightKg, goal, experienceLevel, availableDays, availableTime, sleepSchedule, equipment[], injuryNotes, createdAt }`
- `striate_entries_v1` → array of `{ id, date, createdAt, checkin{ sleep, energy, soreness, mood, timeAvailable, specialConstraint, extraNote }, recommendation{ summary, mainAction, detail, supportAction, reason, confidence, confidenceNote, caution, whyChanged, structuredData } }`

## Recommendation engine (`js/coach.js`)

`Coach.generate(profile, checkin, prevEntry, entryCount) → Promise<recommendation>` — a stable contract the UI never needs to change for.

Local rule engine (v0.1) priority order: **injury/pain flags → very poor recovery (short sleep + low energy) → high soreness → almost no time (10-min fallback) → adaptive training day** (workout picked from goal + equipment + minutes, trimmed when the 0–10 readiness composite is middling). Honesty behaviors: confidence downgraded on first check-ins ("limited data about you"), injury advice always marked low-confidence + not-medical-advice, `whyChanged` computed from the real diff vs. the previous day.

**Plugging in an LLM later:** set `Coach.provider = 'llm'` and implement `callLLM()` — `buildPrompt()` already produces a system prompt demanding strict JSON in the exact recommendation shape, and the local engine remains the fallback.

## Run locally

No build step. Serve the folder with any static server (`python3 -m http.server` or VS Code Live Server) and open `index.html` — or use this project's preview. Note: `file://` works but a server is recommended so localStorage keys are origin-scoped. To reset all data: run `Store.clearAll()` in the console (or clear site data).

## Not yet implemented (deliberately out of scope for v0.1)

- Real LLM-backed recommendations (plug point ready), backend sync/accounts, weekly progress trends, post-workout "did you do it?" follow-up, units toggle (imperial), i18n. Excluded by design: streaks, social, notifications, wearables, calorie DB, payments.

## Recommended next steps

1. Wire `callLLM()` to a real endpoint; keep the rule engine as fallback + validator.
2. Add a lightweight "done / skipped" follow-up on yesterday's plan to feed adherence back into recommendations.
3. Simple 7-day readiness sparkline on History.
4. Export/import data (JSON) before any backend work.
