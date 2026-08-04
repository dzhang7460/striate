/* ============================================================
   Striate — server/gemini.js
   Server-side Gemini integration.
   Gemini never sees WorkoutX directly; it only receives the
   backend-filtered shortlist.
============================================================ */

const { validateRecommendation } = require('./validator');

function getApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
}

function getModel() {
  return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
}

function buildSystemPrompt() {
  return `You are Striate, an honest and realistic daily health coach.

Personality contract:
- Direct, calm, specific.
- No generic wellness fluff.
- No fake certainty.
- If sleep is poor, say so clearly and reduce the workload.

CRITICAL ARCHITECTURE RULES:
1. WorkoutX access already happened on the backend. You do NOT have access to WorkoutX directly.
2. You MUST build the workout only from candidateExercises supplied in the prompt.
3. Every workout exercise must reference a real backend shortlist item using its real exerciseId.
4. If the shortlist is small, choose from it anyway. Do not invent exercise names.

SLEEP-FIRST RULES:
1. Sleep consistency is a first-class part of the plan.
2. Always include target bedtime, target wake time, wind-down action, and screen/device cutoff support.
3. If sleep hours are low, sleep quality is poor, bedtime drifted badly, or screen cutoff failed, reduce the next-day workload and explain why.
4. When sleep is poor, the schedule itself should change: easier workout, clearer evening cutoff, and honest coaching.

MEMORY RULES:
1. Respect saved trainingMethods, preferredExercises, avoidedExercises, injuries/limitations, scheduleNotes, and dislikedSuggestions.
2. If the user previously said a plan was annoying, unrealistic, or too demanding, adapt automatically.
3. Explain why recommendations changed when memory or prior completion changed the plan.
4. Keep the plan low-friction and centered on what to do today.

WORKOUT RULES:
1. Keep workouts realistic for available time.
2. If timeAvailable is <= 15 minutes, use 1-3 movements maximum.
3. Include real exerciseId references plus the matching canonical fields from the shortlist.
4. Each exercise item should include: exerciseId, id, name, sets, reps, rest, formCue, bodyPart, target, gifUrl.

Return ONLY valid JSON matching this schema:
{
  "summary": string,
  "readinessScore": number,
  "todaySchedule": Array<{"time": string, "title": string, "detail": string, "type": "meal" | "workout" | "rest" | "study" | "sleep" | "habit" | "other"}>,
  "workout": {
    "title": string,
    "detail": string,
    "durationMinutes": number,
    "type": "strength" | "cardio" | "recovery" | "soccer" | "mobility",
    "exercises": Array<{
      "exerciseId": string,
      "id": string,
      "name": string,
      "sets": number | string,
      "reps": number | string,
      "rest": string,
      "formCue": string,
      "bodyPart": string,
      "target": string,
      "gifUrl": string
    }>
  } | null,
  "nutrition": {"title": string, "detail": string} | null,
  "sleep": {"title": string, "detail": string, "targetBedtime": string, "targetWakeTime": string, "windDownAction": string} | null,
  "habits": Array<{"title": string, "detail": string}>,
  "explanation": string,
  "thingsToAvoid": string[],
  "whyChanged": string | null,
  "followUpQuestion": string | null,
  "confidence": "high" | "medium" | "low",
  "confidenceNote": string,
  "sevenDayPlan": Array<{"day": string, "focus": string, "mainAction": string, "note": string}>,
  "structuredData": object
}`;
}

function reconcileWorkoutWithShortlist(recommendation, shortlist = []) {
  if (!recommendation || typeof recommendation !== 'object') return recommendation;
  if (!recommendation.workout || !Array.isArray(recommendation.workout.exercises)) return recommendation;

  const byId = new Map(shortlist.map((exercise) => [String(exercise.id), exercise]));
  const byName = new Map(shortlist.map((exercise) => [String(exercise.name).trim().toLowerCase(), exercise]));

  const normalizedExercises = recommendation.workout.exercises
    .map((exercise) => {
      const rawId = String(exercise?.exerciseId || exercise?.id || '').trim();
      const rawName = String(exercise?.name || '').trim().toLowerCase();
      const match = byId.get(rawId) || byName.get(rawName);
      if (!match) return null;

      return {
        exerciseId: String(match.id),
        id: String(match.id),
        name: String(match.name),
        sets: exercise.sets ?? 3,
        reps: exercise.reps ?? '8-12',
        rest: String(exercise.rest || '60s'),
        formCue: String(exercise.formCue || match.formTips?.[0] || 'Use clean, controlled form.'),
        bodyPart: String(match.bodyPart || 'general'),
        target: String(match.target || 'general'),
        gifUrl: String(match.gifUrl || ''),
      };
    })
    .filter(Boolean);

  recommendation.workout.exercises = normalizedExercises;
  return recommendation;
}

async function callGemini(profile, checkin, prevEntry, entryCount, context = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const model = getModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${buildSystemPrompt()}\n\nUser Context:\n${JSON.stringify({
              profile,
              checkin,
              prevEntry,
              entryCount,
              candidateExercises: context.candidateExercises || [],
              recentCompletions: context.recentCompletions || [],
              recentSleepLogs: context.recentSleepLogs || [],
              prevCompletion: context.prevCompletion || null,
              weeklyReview: context.weeklyReview || null,
              recentAdvice: context.recentAdvice || [],
              preferences: profile.preferences || {},
            }, null, 2)}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Gemini API HTTP ${response.status}: ${errorText}`);
  }

  const responseJson = await response.json();
  const candidateText = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidateText) {
    throw new Error('Gemini API returned empty response candidates.');
  }

  let parsed;
  try {
    parsed = JSON.parse(candidateText);
  } catch (error) {
    throw new Error(`Failed to parse Gemini JSON output: ${error.message}`);
  }

  parsed = reconcileWorkoutWithShortlist(parsed, context.candidateExercises || []);

  if (parsed?.workout && Array.isArray(parsed.workout.exercises) && parsed.workout.exercises.length === 0) {
    throw new Error('Gemini returned workout exercises that did not match the shortlist.');
  }

  const validation = validateRecommendation(parsed);
  if (!validation.valid) {
    throw new Error(`Gemini output validation failed: ${validation.error}`);
  }

  return parsed;
}

module.exports = {
  callGemini,
  buildSystemPrompt,
  getApiKey,
  getModel,
};
