/* ============================================================
   Striate — server/validator.js
   Strict schema validation for Striate v0.3 AI responses.
   Validates every required field, plus new WorkoutX exercises
   and sleep optimization schema.
============================================================ */

const VALID_SCHEDULE_TYPES = new Set(['meal', 'workout', 'rest', 'study', 'sleep', 'habit', 'other']);
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);

function validateRecommendation(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Response is not an object' };
  }

  // 1. summary
  if (typeof data.summary !== 'string' || !data.summary.trim()) {
    return { valid: false, error: 'Invalid summary string' };
  }

  // 2. readinessScore
  if (typeof data.readinessScore !== 'number' || isNaN(data.readinessScore)) {
    return { valid: false, error: 'Invalid readinessScore number' };
  }
  if (data.readinessScore < 0 || data.readinessScore > 10) {
    return { valid: false, error: 'readinessScore out of bounds (0-10)' };
  }

  // 3. todaySchedule
  if (!Array.isArray(data.todaySchedule)) {
    return { valid: false, error: 'todaySchedule is not an array' };
  }
  for (const item of data.todaySchedule) {
    if (!item || typeof item !== 'object') {
      return { valid: false, error: 'todaySchedule item is not an object' };
    }
    if (typeof item.time !== 'string' || typeof item.title !== 'string' || typeof item.detail !== 'string') {
      return { valid: false, error: 'todaySchedule item missing required string fields' };
    }
    if (!VALID_SCHEDULE_TYPES.has(item.type)) {
      return { valid: false, error: `todaySchedule item has invalid type: ${item.type}` };
    }
  }

  // 4. workout
  if (data.workout !== null && typeof data.workout !== 'undefined') {
    if (typeof data.workout !== 'object' || Array.isArray(data.workout)) {
      return { valid: false, error: 'workout must be null or an object' };
    }
    if (typeof data.workout.title !== 'string' || typeof data.workout.detail !== 'string' || typeof data.workout.durationMinutes !== 'number') {
      return { valid: false, error: 'workout object missing title, detail, or durationMinutes' };
    }
    // Validate optional exercises array from WorkoutX
    if (data.workout.exercises !== undefined && data.workout.exercises !== null) {
      if (!Array.isArray(data.workout.exercises)) {
        return { valid: false, error: 'workout.exercises must be an array' };
      }
      for (const ex of data.workout.exercises) {
        if (!ex || typeof ex !== 'object') {
          return { valid: false, error: 'workout.exercises item must be an object' };
        }
        if (typeof ex.name !== 'string') {
          return { valid: false, error: 'workout.exercises item missing name string' };
        }
      }
    }
  }

  // 5. nutrition
  if (data.nutrition !== null && typeof data.nutrition !== 'undefined') {
    if (typeof data.nutrition !== 'object' || Array.isArray(data.nutrition)) {
      return { valid: false, error: 'nutrition must be null or an object' };
    }
    if (typeof data.nutrition.title !== 'string' || typeof data.nutrition.detail !== 'string') {
      return { valid: false, error: 'nutrition object missing title or detail' };
    }
  }

  // 6. sleep
  if (data.sleep !== null && typeof data.sleep !== 'undefined') {
    if (typeof data.sleep !== 'object' || Array.isArray(data.sleep)) {
      return { valid: false, error: 'sleep must be null or an object' };
    }
    if (typeof data.sleep.title !== 'string' || typeof data.sleep.detail !== 'string') {
      return { valid: false, error: 'sleep object missing title or detail' };
    }
  }

  // 7. habits
  if (!Array.isArray(data.habits)) {
    return { valid: false, error: 'habits is not an array' };
  }
  for (const h of data.habits) {
    if (!h || typeof h !== 'object' || typeof h.title !== 'string' || typeof h.detail !== 'string') {
      return { valid: false, error: 'habits item missing title or detail string' };
    }
  }

  // 8. explanation
  if (typeof data.explanation !== 'string' || !data.explanation.trim()) {
    return { valid: false, error: 'explanation must be a non-empty string' };
  }

  // 9. thingsToAvoid
  if (!Array.isArray(data.thingsToAvoid) || !data.thingsToAvoid.every((s) => typeof s === 'string')) {
    return { valid: false, error: 'thingsToAvoid must be an array of strings' };
  }

  // 10. whyChanged
  if (data.whyChanged !== null && typeof data.whyChanged !== 'string') {
    return { valid: false, error: 'whyChanged must be null or string' };
  }

  // 11. followUpQuestion
  if (data.followUpQuestion !== null && typeof data.followUpQuestion !== 'string') {
    return { valid: false, error: 'followUpQuestion must be null or string' };
  }

  // 12. confidence & confidenceNote
  if (!VALID_CONFIDENCE.has(data.confidence)) {
    return { valid: false, error: `invalid confidence level: ${data.confidence}` };
  }
  if (typeof data.confidenceNote !== 'string' || !data.confidenceNote.trim()) {
    return { valid: false, error: 'confidenceNote must be a non-empty string' };
  }

  // 13. sevenDayPlan
  if (!Array.isArray(data.sevenDayPlan)) {
    return { valid: false, error: 'sevenDayPlan is not an array' };
  }
  for (const dayItem of data.sevenDayPlan) {
    if (
      !dayItem || typeof dayItem !== 'object' ||
      typeof dayItem.day !== 'string' ||
      typeof dayItem.focus !== 'string' ||
      typeof dayItem.mainAction !== 'string' ||
      typeof dayItem.note !== 'string'
    ) {
      return { valid: false, error: 'sevenDayPlan item missing day, focus, mainAction, or note' };
    }
  }

  // 14. structuredData
  if (!data.structuredData || typeof data.structuredData !== 'object') {
    return { valid: false, error: 'structuredData must be an object' };
  }

  return { valid: true };
}

module.exports = { validateRecommendation };
