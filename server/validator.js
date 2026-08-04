/* ============================================================
   Striate — server/validator.js
   Strict validation for AI responses.
============================================================ */

const VALID_SCHEDULE_TYPES = new Set(['meal', 'workout', 'rest', 'study', 'sleep', 'habit', 'other']);
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);
const VALID_WORKOUT_TYPES = new Set(['strength', 'cardio', 'recovery', 'soccer', 'mobility']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateRecommendation(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, error: 'Response is not an object' };
  }

  if (!isNonEmptyString(data.summary)) {
    return { valid: false, error: 'Invalid summary string' };
  }

  if (typeof data.readinessScore !== 'number' || Number.isNaN(data.readinessScore)) {
    return { valid: false, error: 'Invalid readinessScore number' };
  }
  if (data.readinessScore < 0 || data.readinessScore > 10) {
    return { valid: false, error: 'readinessScore out of bounds (0-10)' };
  }

  if (!Array.isArray(data.todaySchedule)) {
    return { valid: false, error: 'todaySchedule is not an array' };
  }
  for (const item of data.todaySchedule) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { valid: false, error: 'todaySchedule item is not an object' };
    }
    if (!isNonEmptyString(item.time) || !isNonEmptyString(item.title) || !isNonEmptyString(item.detail)) {
      return { valid: false, error: 'todaySchedule item missing required string fields' };
    }
    if (!VALID_SCHEDULE_TYPES.has(item.type)) {
      return { valid: false, error: `todaySchedule item has invalid type: ${item.type}` };
    }
  }

  if (data.workout !== null && typeof data.workout !== 'undefined') {
    if (typeof data.workout !== 'object' || Array.isArray(data.workout)) {
      return { valid: false, error: 'workout must be null or object' };
    }
    if (!isNonEmptyString(data.workout.title) || !isNonEmptyString(data.workout.detail) || typeof data.workout.durationMinutes !== 'number') {
      return { valid: false, error: 'workout missing title/detail/durationMinutes' };
    }
    if (!VALID_WORKOUT_TYPES.has(data.workout.type)) {
      return { valid: false, error: `invalid workout.type: ${data.workout.type}` };
    }
    if (!Array.isArray(data.workout.exercises)) {
      return { valid: false, error: 'workout.exercises must be an array' };
    }
    for (const ex of data.workout.exercises) {
      if (!ex || typeof ex !== 'object' || Array.isArray(ex)) {
        return { valid: false, error: 'workout.exercises item must be an object' };
      }
      const exerciseId = ex.exerciseId || ex.id;
      if (!isNonEmptyString(exerciseId)) {
        return { valid: false, error: 'workout.exercises item missing exerciseId/id' };
      }
      if (!isNonEmptyString(ex.name) || !isNonEmptyString(String(ex.rest || '')) || !isNonEmptyString(String(ex.formCue || ''))) {
        return { valid: false, error: 'workout.exercises item missing required strings' };
      }
      if (!isNonEmptyString(ex.bodyPart) || !isNonEmptyString(ex.target) || !isNonEmptyString(ex.gifUrl)) {
        return { valid: false, error: 'workout.exercises item missing bodyPart/target/gifUrl' };
      }
      const hasSets = typeof ex.sets === 'number' || isNonEmptyString(String(ex.sets || ''));
      const hasReps = typeof ex.reps === 'number' || isNonEmptyString(String(ex.reps || ''));
      if (!hasSets || !hasReps) {
        return { valid: false, error: 'workout.exercises item missing sets/reps' };
      }
    }
  }

  if (data.nutrition !== null && typeof data.nutrition !== 'undefined') {
    if (typeof data.nutrition !== 'object' || Array.isArray(data.nutrition)) {
      return { valid: false, error: 'nutrition must be null or object' };
    }
    if (!isNonEmptyString(data.nutrition.title) || !isNonEmptyString(data.nutrition.detail)) {
      return { valid: false, error: 'nutrition object missing title/detail' };
    }
  }

  if (data.sleep !== null && typeof data.sleep !== 'undefined') {
    if (typeof data.sleep !== 'object' || Array.isArray(data.sleep)) {
      return { valid: false, error: 'sleep must be null or object' };
    }
    if (!isNonEmptyString(data.sleep.title) || !isNonEmptyString(data.sleep.detail)) {
      return { valid: false, error: 'sleep object missing title/detail' };
    }
    if (!isNonEmptyString(data.sleep.targetBedtime) || !isNonEmptyString(data.sleep.targetWakeTime) || !isNonEmptyString(data.sleep.windDownAction)) {
      return { valid: false, error: 'sleep object missing targetBedtime/targetWakeTime/windDownAction' };
    }
  }

  if (!Array.isArray(data.habits)) {
    return { valid: false, error: 'habits is not an array' };
  }
  for (const habit of data.habits) {
    if (!habit || typeof habit !== 'object' || !isNonEmptyString(habit.title) || !isNonEmptyString(habit.detail)) {
      return { valid: false, error: 'habits item missing title/detail string' };
    }
  }

  if (!isNonEmptyString(data.explanation)) {
    return { valid: false, error: 'explanation must be a non-empty string' };
  }

  if (!Array.isArray(data.thingsToAvoid) || !data.thingsToAvoid.every((item) => isNonEmptyString(item))) {
    return { valid: false, error: 'thingsToAvoid must be an array of strings' };
  }

  if (data.whyChanged !== null && typeof data.whyChanged !== 'string') {
    return { valid: false, error: 'whyChanged must be null or string' };
  }

  if (data.followUpQuestion !== null && typeof data.followUpQuestion !== 'string') {
    return { valid: false, error: 'followUpQuestion must be null or string' };
  }

  if (!VALID_CONFIDENCE.has(data.confidence)) {
    return { valid: false, error: `invalid confidence level: ${data.confidence}` };
  }
  if (!isNonEmptyString(data.confidenceNote)) {
    return { valid: false, error: 'confidenceNote must be non-empty string' };
  }

  if (!Array.isArray(data.sevenDayPlan)) {
    return { valid: false, error: 'sevenDayPlan is not an array' };
  }
  for (const dayItem of data.sevenDayPlan) {
    if (
      !dayItem || typeof dayItem !== 'object' || Array.isArray(dayItem) ||
      !isNonEmptyString(dayItem.day) ||
      !isNonEmptyString(dayItem.focus) ||
      !isNonEmptyString(dayItem.mainAction) ||
      !isNonEmptyString(dayItem.note)
    ) {
      return { valid: false, error: 'sevenDayPlan item missing required fields' };
    }
  }

  if (!data.structuredData || typeof data.structuredData !== 'object' || Array.isArray(data.structuredData)) {
    return { valid: false, error: 'structuredData must be an object' };
  }

  return { valid: true };
}

module.exports = { validateRecommendation };
