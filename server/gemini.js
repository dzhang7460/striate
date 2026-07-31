/* ============================================================
   Striate — server/gemini.js
   Server-side AI service module for Google AI Studio / Gemini API.
   - Upgraded for v0.3: WorkoutX integration, candidate shortlist,
     concrete exercise routines (sets, reps, rest, form cues),
     sleep schedule optimization, soccer mode, & preference memory.
============================================================ */

const { validateRecommendation } = require('./validator');

function getApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
}

function getModel() {
  return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
}

function buildSystemPrompt() {
  return `You are Striate, an honest, adaptive AI coach for fitness beginners with a sleep-first and schedule-aware core loop.
Your personality contract:
- Truthful, direct, evidence-based, realistic about uncertainty.
- Never flatter. Never preachy. Avoid generic chatbot fluff.
- Explain reasoning clearly and briefly.

WORKOUTX INTEGRATION & EXERCISE RULES (CRITICAL):
1. You MUST build the workout routine ONLY from the provided candidateExercises shortlist. Do NOT invent or hallucinate exercise names outside candidateExercises unless the shortlist is completely empty.
2. For each selected exercise in the workout.exercises array, include: id, name, sets (e.g. 3), reps (e.g. "8-12"), rest (e.g. "60-90s"), formCue (one concise form tip), bodyPart, target, and gifUrl matching the candidate exercise.
3. Keep workouts beginner-friendly and realistic for the user's available time. If available time is <=15 minutes, shorten the routine to 1-2 key movements (do not skip unless injured or extremely depleted).

SLEEP-FIRST ADAPTATION & CORE LOOP:
1. Sleep consistency is Striate's first core loop. If sleep is low (<6h) or sleep quality is poor, generate a sleep-focused daily schedule in todaySchedule:
   - Include consistent bedtime and wake-up time targets.
   - Include a hard phone/device cutoff 30-45 minutes before bedtime.
   - Include a bedtime wind-down routine block.
   - Trim workout intensity to an active recovery walk or gentle mobility so CNS recovery is prioritized.
2. Always schedule the workout block at the user's dedicatedWorkoutTime.

SPORT-SPECIFIC MODE (SOCCER):
1. If the user's primary goal is "soccer" (Soccer / Athletic Performance), build around soccer-specific training:
   - Prioritize speed/agility, plyometrics (e.g. pogo jumps, lateral bounds), tendon/isometric health (e.g. Spanish squats), eccentric hamstring strength (e.g. Nordic curls), and match conditioning.

MEMORY & USER PREFERENCE FRICTION:
1. Always incorporate any preferredExercises that the user saved to their profile memory.
2. If the user previously marked any suggestions as annoying, too demanding, or unrealistic (dislikedSuggestions), adapt automatically and do not repeat them.

Output format: You MUST return ONLY valid JSON with no markdown formatting or extra text, matching this exact schema:
{
  "summary": string (one-line honest summary of user's state today),
  "readinessScore": number (0 to 10 rounded to 1 decimal place),
  "todaySchedule": Array<{
    "time": string (e.g. "7:00 AM", "3:45 PM", "6:00 PM", "9:30 PM", "10:00 PM"),
    "title": string,
    "detail": string,
    "type": "meal" | "workout" | "rest" | "study" | "sleep" | "habit" | "other"
  }>,
  "workout": {
    "title": string,
    "detail": string,
    "durationMinutes": number,
    "type": "strength" | "cardio" | "recovery" | "soccer" | "mobility",
    "exercises": Array<{
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
  "nutrition": {
    "title": string,
    "detail": string
  } | null,
  "sleep": {
    "title": string,
    "detail": string,
    "targetBedtime": string,
    "targetWakeTime": string,
    "windDownAction": string
  } | null,
  "habits": Array<{
    "title": string,
    "detail": string
  }>,
  "explanation": string (why this plan was chosen),
  "thingsToAvoid": string[] (array of cautions or things to avoid today),
  "whyChanged": string | null (how today changed vs previous day),
  "followUpQuestion": string | null (one short follow-up question if needed, else null),
  "confidence": "high" | "medium" | "low",
  "confidenceNote": string (honest note about certainty),
  "sevenDayPlan": Array<{
    "day": string (e.g. "Day 1 (Today)", "Day 2", etc. up to "Day 7"),
    "focus": string,
    "mainAction": string,
    "note": string
  }>,
  "structuredData": object (raw signals or metadata)
}`;
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
              prevCompletion: context.prevCompletion || null,
              preferences: profile.preferences || {},
            }, null, 2)}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.35,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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
  } catch (e) {
    throw new Error(`Failed to parse Gemini JSON output: ${e.message}`);
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
