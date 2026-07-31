# Striate — v0.3

An honest, adaptive daily AI coach for **fitness beginners and returning athletes**. Striate features a **sleep-first core loop**, server-side **WorkoutX exercise library integration**, a searchable exercise library, **sport-specific soccer athletic mode**, preference memory, and clear reasoning without chatbot fluff.

**Personality contract:** direct, evidence-based, non-flattering, realistic about uncertainty. When confidence is low or data is missing, the coach says so instead of pretending.

---

## New in v0.3 (WorkoutX, Sleep Core Loop, Soccer Mode, & Preference Memory)

1. **Server-Side WorkoutX Exercise Integration (`server/workoutx.js`)**:
   - Integrates with `https://api.workoutxapp.com` via server-side API key (`WORKOUTX_API_KEY`), never exposing credentials to frontend code.
   - Normalizes exercises into clean standardized objects (`id`, `name`, `bodyPart`, `target`, `equipment`, `effortLevel`, `mechanics`, `force`, `isUnilateral`, `gifUrl`, `instructions`, `formTips`, `alternatives`, `caloriesPerMinute`).
   - Supports paginated responses (`{ total, count, data: [...] }`) and all query filters (`bodyPart`, `target`, `equipment`, `name`, `effortLevel`, `mechanics`, `force`, `isUnilateral`, `sortMethod`, `sortOrder`, `limit`, `offset`).
   - In-memory caching with 30-minute TTL for rapid search and filter responses.
   - Robust local curated fallback database of ~22 real exercises (including soccer agility and bedtime mobility) so the app and search never break if offline or unconfigured.

2. **Searchable Exercise Library Page (`/exercise-library.html` or `/exercises`)**:
   - Mobile-first search bar with keyword search and one-tap filter chips (`Body part`, `Equipment`, `Difficulty`) + reset filter button.
   - Interactive exercise cards with thumbnails, difficulty badges, and metadata.
   - **Exercise Detail Drawer (`/exercise/:id`)**: Surfaces full animated GIF, step-by-step instructions, form safety tips, calories/min, and alternatives.
   - **"Use this in a workout" action**: One tap saves the exercise to the user's profile preferences memory, so Striate AI prioritizes incorporating it into future workouts.

3. **Sleep-First Core Loop & Adaptation (`rec.sleep`, `todaySchedule`)**:
   - Sleep schedule optimization is Striate's primary core loop.
   - Tracks **Target Bedtime** (`sleepSchedule`) and **Target Wake-up Time** (`wakeTimeTarget`).
   - Schedules explicit **Bedtime Consistency**, **30–45 minute Phone & Device Cutoff**, and **Bedtime Wind-down Routine** blocks in `todaySchedule`.
   - Adapts training intensity when sleep is low (`<6h`): switches heavy lifting to an active recovery walk and calming mobility to restore circadian alertness.

4. **Sport-Specific Mode (Soccer Athletic Performance)**:
   - Added `Soccer / Athletic Performance` primary goal with focus areas (`Speed & Agility`, `Plyometrics`, `Athletic Strength`, `Tendon / Isometric`, `Match Conditioning`, `Technical Drills`).
   - Selects soccer-specific performance exercises (`Pogo Jumps`, `Lateral Skater Bounds`, `Spanish Squat isometric holds for patellar tendon health`, `Nordic Hamstring Curls`).

5. **Memory, Personalization & Feedback Control**:
   - **Preference Memory**: Remembers saved `preferredExercises` and automatically weaves up to 2 of them into the daily workout routine.
   - **Low-Friction Plan Correction ("Too Demanding / Annoying?")**: Users can click `[Adjust / Correct this plan]` on Today's recommendation to correct unrealistic or annoying suggestions. Feedback is stored in `dislikedSuggestions` and the AI adapts immediately without repeating rejected items.

6. **Anti-Hallucination AI Coaching Pipeline (`/api/coach`)**:
   - Before querying Gemini, the backend calls `workoutx.shortlistExercises(profile, checkin)` to select 10–15 relevant candidate exercises based on available equipment, beginner difficulty, injury constraints, and goal.
   - Instructs Gemini to build `workout.exercises` ONLY from the candidate shortlist.
   - Generates specific, concrete workout checklists: `sets × reps`, `rest` intervals, and one concise `formCue` per movement, with clickable `[View]` buttons to open the library drawer.

---

## API Routes & Endpoints

### Backend Routes (`server.js`)
- `GET /api/health` — Status check for server, AI model, and WorkoutX configuration.
- `GET /api/exercises/search` — Search and filter WorkoutX exercises (supports query filters).
- `GET /api/exercises/bodyPartList` — Standardized list of body parts.
- `GET /api/exercises/targetList` — Standardized list of target muscles.
- `GET /api/exercises/:id` — Get single normalized exercise by ID.
- `POST /api/coach` — Generate daily AI recommendation using WorkoutX shortlist candidate exercises.

### Frontend Routes & Clean URL Mapping
- `/today` (`today.html`) — Today's curated schedule, concrete workout routine, sleep core loop, and completion tracker.
- `/check-in` (`check-in.html`) — 7-question daily check-in with dedicated workout time input.
- `/exercises` or `/exercise-library` (`exercise-library.html`) — Searchable Exercise Library with detail drawer.
- `/exercise/:id` — Deep-links to open a specific exercise in the detail drawer.
- `/calendar` or `/history` (`history.html`) — Monthly calendar grid & editable schedule logs.
- `/stats` (`stats.html`) — Streaks, weekly completion progress, 7-day averages & trends.
- `/info` (`info.html`) — Guide to readiness, confidence, AI rules, and developer tools.

---

## Running Locally

### 1. With Node.js Backend (Recommended — Enables Gemini AI API & WorkoutX)
```bash
npm start
# Server runs at http://localhost:3000
```
To enable Google AI Studio / Gemini API & WorkoutX:
```bash
export GEMINI_API_KEY="your-gemini-api-key"
export WORKOUTX_API_KEY="your-workoutx-api-key"
npm start
```
*Note: If `WORKOUTX_API_KEY` is not set, `server/workoutx.js` automatically uses a curated local library of ~22 real exercises so the app and search remain 100% functional.*

### 2. Static Server / Offline Mode (Local Fallback Rules Engine)
You can serve the folder with any static web server (e.g., `python3 -m http.server`). If `/api/coach` is unavailable, `Coach.generate()` automatically falls back to the local deterministic rules engine with zero UI breakage.

### 3. Running Automated Tests
```bash
npm test
# Runs 14 comprehensive testable scenarios covering completion logs, low sleep (sleep core loop), low time, injury, AI failure, malformed JSON, WorkoutX normalization, anti-hallucination shortlist, soccer athletic mode, and preference memory.
```

---

## Acceptance Criteria & Test Verification
- **14/14 Automated Tests Pass**: `npm test` verifies schema validation, WorkoutX client normalization, shortlisting without hallucination, soccer athletic mode, sleep-first core loop targets, and preference memory retention.
- **Security**: No hardcoded API keys or secrets in frontend or backend code; all keys read exclusively from environment variables on the server.
