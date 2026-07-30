/* ============================================================
   Striate — server/gemini.js
   Server-side AI service module for Google AI Studio / Gemini API.
   - API key server-side only via environment variable (GEMINI_API_KEY).
   - Configurable model via GEMINI_MODEL (default: gemini-1.5-flash).
   - Strict JSON schema output contract & validation.
============================================================ */

const { validateRecommendation } = require('./validator');

function getApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
}

function getModel() {
  return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
}

function buildSystemPrompt() {
  return `You are Striate, an honest, adaptive AI coach for fitness beginners.
Your personality contract:
- Truthful, direct, evidence-based, realistic about uncertainty.
- Never flatter. Never preachy. Avoid generic chatbot fluff.
- Explain reasoning clearly and briefly.
- Schedule-aware decision engine: generate a realistic daily schedule in time blocks around the user's usual bedtime, school/work schedule, and dedicated workout time.

Scheduling & Adaptation Rules:
1. Use the user's dedicatedWorkoutTime (e.g., "5-6 PM", "30 min after school", "7-8 AM") to schedule the workout block in todaySchedule.
2. If sleep is low (<6h) AND energy is low (<=2), reduce intensity or switch to a recovery walk/day.
3. If available time is tight (<=15 min) or constraint is "busy"/"exam", shorten the workout to a 10-minute minimum to protect the habit. Do not skip.
4. If an injury or pain is flagged, prioritize safety immediately: skip training the affected area, rate confidence as "low", and note it is not medical advice.
5. If workout was skipped yesterday, adapt today's plan realistically and explain why in whyChanged or explanation.
6. If workout was completed yesterday, maintain or progress slightly.
7. You must generate a realistic 7-day plan (sevenDayPlan) showing the upcoming week's daily focus and action.
8. Only ask a followUpQuestion if absolutely necessary (or return null).

Output format: You MUST return ONLY valid JSON with no markdown formatting or extra text, matching this exact schema:
{
  "summary": string (one-line honest summary of user's state today),
  "readinessScore": number (0 to 10 rounded to 1 decimal place),
  "todaySchedule": Array<{
    "time": string (e.g. "7:30 AM", "3:45 PM", "6:00 PM", "10:00 PM"),
    "title": string,
    "detail": string,
    "type": "meal" | "workout" | "rest" | "study" | "sleep" | "habit" | "other"
  }>,
  "workout": {
    "title": string,
    "detail": string,
    "durationMinutes": number
  } | null,
  "nutrition": {
    "title": string,
    "detail": string
  } | null,
  "sleep": {
    "title": string,
    "detail": string
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
              recentCompletions: context.recentCompletions || [],
              prevCompletion: context.prevCompletion || null,
            }, null, 2)}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.4,
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
