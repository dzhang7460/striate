# Striate — v0.2

An honest, adaptive daily AI coach for **fitness beginners**. One 60-second check-in → a schedule-aware curated plan for today, workout completion feedback, a 7-day adaptive plan, and clear reasoning without chatbot fluff.

**Personality contract:** direct, evidence-based, non-flattering, realistic about uncertainty. When confidence is low or data is missing, the coach says so instead of pretending.

## New in v0.2

1. **Workout Completion Tracking**:
   - One-tap completion logging on Today's plan (`Completed ✅`, `Partially completed ⚠️`, `Skipped ❌`) with optional reason and notes.
   - Feeds back into tomorrow's recommendation (maintains/progresses when completed; simplifies/protects momentum when skipped or partial).
   - Editable across any past day in the Calendar & Logs view.
2. **Dedicated Workout Time Input**:
   - Set typical workout time window in profile onboarding (Step 3: e.g. `7–8 AM`, `5–6 PM`, `30 min after work/school`, `Custom time`).
   - Adjustable per day during the daily check-in.
   - Used by the schedule-aware engine to curate daily time blocks.
3. **Refined Stats Page (`stats.html`)**:
   - Check-in streak and consistency indicator.
   - 7-day weekly activity tracker (visual pill track for Monday–Sunday).
   - Rolling 7-day averages for Readiness, Sleep, Soreness, and Energy with trend arrows.
   - Adaptive Coach Insight based on recent sleep and completion consistency.
4. **Calendar & Logs Page (`history.html`)**:
   - Interactive month calendar grid with visual status markers (`Completed`, `Partial`, `Skipped`, `Check-in / Rest`).
   - Clicking a calendar day jumps to that day's editable schedule log.
5. **Info / Legend Page (`info.html`)**:
   - Clear, non-technical explanation of Readiness (0–10), Confidence levels (`High`, `Medium`, `Low`), AI adaptation rules, safety guidelines, and shortcuts to Edit Profile and Developer Tools.
6. **Server-Side Google AI Studio / Gemini API Integration (`/api/coach`)**:
   - Server-side AI service (`server/gemini.js`) using environment variables (`GEMINI_API_KEY`, `GEMINI_MODEL`) to protect API keys.
   - Strict JSON schema validation (`server/validator.js`) before rendering.
   - Automatic graceful fallback to the local deterministic rules engine if AI is unavailable or validation fails.
7. **Curated Beginner Exercise Templates**:
   - `Beginner Gym Full Body`, `Beginner Home Full Body`, `10-Minute Habit Protector`, `Active Recovery Walk`, `Upper Body Basics`, `Lower Body Basics`, `Light Cardio / Walk Day`.
8. **Visible Debug Console & Test Suite (`?debug=1` or 🐛 Debug button)**:
   - Live system logs for profile/check-in/completion events, Gemini payloads, and fallback activation.
   - 10 one-click automated UI test scenarios and a Node.js test runner (`npm test`).

## Entry URIs & Navigation (5-Tab Bar)

| Tab | Path | Purpose |
|---|---|---|
| **Today** | `today.html` | Today's curated schedule, workout completion tracker, 7-day plan, and reasoning |
| **Check-in** | `check-in.html` | 7-question low-friction check-in with dedicated workout time input |
| **Calendar** | `history.html` | Monthly calendar grid & editable schedule logs |
| **Stats** | `stats.html` | Streaks, weekly completion progress, 7-day averages & trends |
| **Info** | `info.html` | Non-technical guide to readiness, confidence, AI rules, and developer tools |
| **Profile** | `onboarding.html?edit=1` | Accessible via header shortcut or Info page |

## Running Locally

### 1. With Node.js Backend (Recommended — Enables Gemini AI API & Server-side validation)
```bash
npm start
# Server runs at http://localhost:3000
```
To enable Google AI Studio / Gemini API:
```bash
export GEMINI_API_KEY="your-api-key-here"
export GEMINI_MODEL="gemini-1.5-flash" # optional, defaults to gemini-1.5-flash
npm start
```

### 2. Static Server / Offline Mode (Local Fallback Rules Engine)
You can serve the folder with any static web server (e.g., `python3 -m http.server`). If `/api/coach` is unavailable, `Coach.generate()` automatically falls back to the local deterministic rules engine with zero UI breakage.

### 3. Running Automated Tests
```bash
npm test
# Runs 10 testable scenarios covering completion logs, low sleep, low time, injury, AI failure, and malformed JSON.
```

## Data Models (localStorage)

- `striate_profile_v1` → `{ id, ageRange, heightCm, weightKg, goal, experienceLevel, availableDays, availableTime, sleepSchedule, dedicatedWorkoutTime, equipment[], injuryNotes, createdAt }`
- `striate_entries_v1` → Array of daily `{ id, date, createdAt, checkin, recommendation }` objects.
- `striate_completions_v1` → Dict by date of workout completion logs `{ id, date, plannedWorkout, status: 'completed' | 'partial' | 'skipped', reason, note, recordedAt }`.
- `striate_debug_logs_v1` → Rolling buffer of system logs and AI payloads for visible debugging.
