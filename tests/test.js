/* ============================================================
   Striate — tests/test.js
   Automated test suite covering the required testable cases:
   1. workout completed
   2. workout skipped
   3. workout partially completed
   4. low sleep (Sleep-First Core Loop test)
   5. low time (≤15m habit protector)
   6. injury flag (safety override)
   7. first-time user
   8. missing fields
   9. AI failure fallback
   10. malformed AI JSON
   11. WorkoutX client normalization & filtering
   12. WorkoutX shortlist for AI coach (no hallucination)
   13. Soccer Sport-Specific mode (agility & plyometrics)
   14. Preference & Memory retention (preferredExercises)
============================================================ */

const assert = require('assert');
const Coach = require('../js/coach');
const { validateRecommendation } = require('../server/validator');
const workoutx = require('../server/workoutx');

console.log('============================================================');
console.log(' Starting Striate v0.3 Automated Test Suite');
console.log('============================================================\n');

let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failedCount++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failedCount++;
  }
}

const baseProfile = {
  id: 'test_user_1',
  goal: 'strength',
  experienceLevel: 'new',
  equipment: ['gym'],
  dedicatedWorkoutTime: '5-6 PM',
  availableDays: '3',
  availableTime: '45-60',
  sleepSchedule: '22-23',
  wakeTimeTarget: '7:00 AM',
  preferences: {
    preferredExercises: [],
    dislikedSuggestions: [],
  },
};

const baseCheckin = {
  sleep: '7-8',
  energy: 4,
  soreness: 2,
  mood: 4,
  timeAvailable: '45-60',
  dedicatedWorkoutTime: '5-6 PM',
  specialConstraint: 'none',
  extraNote: '',
};

async function runTests() {
  // 1. Workout completed
  test('1. Workout Completed -> maintain / progress slightly & schema valid', () => {
    const context = {
      prevCompletion: { status: 'completed', plannedWorkout: 'Full Body Gym' },
      entryCount: 3,
    };
    const rec = Coach.localEngine(baseProfile, baseCheckin, { date: '2026-07-29', checkin: baseCheckin }, 3, context);
    const normalized = Coach.normalizeRecommendation(rec, baseProfile, baseCheckin, null, context);
    assert.strictEqual(validateRecommendation(normalized).valid, true, 'Must pass strict schema validation');
    assert.ok(normalized.whyChanged.includes('completed'), 'whyChanged should reference completed session');
    assert.strictEqual(normalized.confidence, 'high');
  });

  // 2. Workout skipped
  test('2. Workout Skipped -> adapt plan, note skipped in whyChanged', () => {
    const context = {
      prevCompletion: { status: 'skipped', reason: 'Too busy / No time' },
      entryCount: 3,
    };
    const rec = Coach.localEngine(baseProfile, baseCheckin, { date: '2026-07-29', checkin: baseCheckin }, 3, context);
    const normalized = Coach.normalizeRecommendation(rec, baseProfile, baseCheckin, null, context);
    assert.strictEqual(validateRecommendation(normalized).valid, true);
    assert.ok(normalized.whyChanged.includes('skipped'), 'whyChanged should reference skipped session');
  });

  // 3. Workout partially completed
  test('3. Workout Partially Completed -> adapt schedule & acknowledge partial session', () => {
    const context = {
      prevCompletion: { status: 'partial', reason: 'Low energy / Sore' },
      entryCount: 3,
    };
    const rec = Coach.localEngine(baseProfile, baseCheckin, { date: '2026-07-29', checkin: baseCheckin }, 3, context);
    const normalized = Coach.normalizeRecommendation(rec, baseProfile, baseCheckin, null, context);
    assert.strictEqual(validateRecommendation(normalized).valid, true);
    assert.ok(normalized.whyChanged.includes('partial'), 'whyChanged should reference partial session');
  });

  // 4. Low sleep & Sleep-First Core Loop
  test('4. Low Sleep (<6h sleep + low energy) -> Sleep-First Core Loop & active recovery walk', () => {
    const checkin = { ...baseCheckin, sleep: '<5', energy: 2 };
    const rec = Coach.localEngine(baseProfile, checkin, null, 3, {});
    const normalized = Coach.normalizeRecommendation(rec, baseProfile, checkin, null, {});
    assert.strictEqual(validateRecommendation(normalized).valid, true);
    assert.ok(/recovery|walk|rest/i.test(normalized.mainAction) || normalized.workout?.title.includes('Recovery'), 'Main action must switch to recovery');
    assert.ok(normalized.sleep?.targetBedtime && normalized.sleep?.targetWakeTime, 'Must generate sleep-first core loop bedtime/wake targets');
    assert.strictEqual(normalized.confidence, 'high');
  });

  // 5. Low time
  test('5. Low Time (≤15m) -> 10-minute habit protector template', () => {
    const checkin = { ...baseCheckin, timeAvailable: '0-15', specialConstraint: 'busy' };
    const rec = Coach.localEngine(baseProfile, checkin, null, 3, {});
    const normalized = Coach.normalizeRecommendation(rec, baseProfile, checkin, null, {});
    assert.strictEqual(validateRecommendation(normalized).valid, true);
    assert.ok(normalized.workout?.durationMinutes === 10 || /10-minute/i.test(normalized.summary), 'Must select 10-minute fallback');
  });

  // 6. Injury
  test('6. Injury Flag -> safety override, low confidence, not medical advice', () => {
    const checkin = { ...baseCheckin, specialConstraint: 'injury', extraNote: 'Sharp knee pain' };
    const rec = Coach.localEngine(baseProfile, checkin, null, 3, {});
    const normalized = Coach.normalizeRecommendation(rec, baseProfile, checkin, null, {});
    assert.strictEqual(validateRecommendation(normalized).valid, true);
    assert.strictEqual(normalized.confidence, 'low', 'Confidence must be low for injuries');
    assert.ok(/not medical advice/i.test(normalized.caution || '') || /not medical advice/i.test(normalized.confidenceNote), 'Must state not medical advice');
    assert.strictEqual(normalized.workout, null, 'Workout block should be null on injury day');
  });

  // 7. First-time user
  test('7. First-time User (entryCount=1) -> medium confidence with honest note', () => {
    const rec = Coach.localEngine(baseProfile, baseCheckin, null, 1, {});
    const normalized = Coach.normalizeRecommendation(rec, baseProfile, baseCheckin, null, { entryCount: 1 });
    assert.strictEqual(validateRecommendation(normalized).valid, true);
    assert.notStrictEqual(normalized.confidence, 'high', 'Confidence should not be high on first check-in');
    assert.ok(/first check-in/i.test(normalized.confidenceNote), 'Must explain limited data on first check-in');
  });

  // 8. Missing fields
  test('8. Missing Fields -> client normalization handles incomplete input without crashing', () => {
    const checkin = { sleep: '<5', energy: 3 }; // Missing soreness, mood, timeAvailable
    const rec = Coach.localEngine(baseProfile, checkin, null, 2, {});
    const normalized = Coach.normalizeRecommendation(rec, baseProfile, checkin, null, {});
    assert.strictEqual(validateRecommendation(normalized).valid, true);
    assert.ok(typeof normalized.summary === 'string' && normalized.summary.length > 0);
  });

  // 9. AI failure
  test('9. AI Failure -> fallback rules engine produces valid output with full exercises list', () => {
    const rec = Coach.localEngine(baseProfile, baseCheckin, null, 2, {});
    const normalized = Coach.normalizeRecommendation(rec, baseProfile, baseCheckin, null, {});
    const val = validateRecommendation(normalized);
    assert.strictEqual(val.valid, true, `Fallback engine output must be valid: ${val.error}`);
    assert.ok(Array.isArray(normalized.workout.exercises) && normalized.workout.exercises.length > 0, 'Fallback routine must include concrete exercises array');
  });

  // 10. Malformed AI JSON
  test('10. Malformed AI JSON -> validator rejects malformed object & falls back cleanly', () => {
    const malformed = {
      summary: 123, // wrong type
      readinessScore: 'high', // wrong type
      todaySchedule: 'not an array', // wrong type
    };
    const val = validateRecommendation(malformed);
    assert.strictEqual(val.valid, false, 'Validator must reject malformed JSON');
    const fallback = Coach.normalizeRecommendation(null, baseProfile, baseCheckin, null, {});
    assert.strictEqual(validateRecommendation(fallback).valid, true, 'Fallback after malformed JSON must pass');
  });

  // 11. WorkoutX client normalization & search filtering
  await testAsync('11. WorkoutX Client Normalization & Search -> returns standardized exercise objects', async () => {
    const res = await workoutx.searchExercises({ name: 'squat', limit: 5 });
    assert.ok(res.count > 0 && res.total > 0, 'Should find squat exercises in library');
    const first = res.data[0];
    assert.ok(first.id && first.name && first.bodyPart && first.target && first.equipment && Array.isArray(first.instructions), 'Normalized exercise must contain all standard fields');
  });

  // 12. WorkoutX shortlist for AI coach
  await testAsync('12. WorkoutX Shortlist -> filters by equipment & difficulty without hallucinating names', async () => {
    const shortlist = await workoutx.shortlistExercises(baseProfile, baseCheckin);
    assert.ok(shortlist.length >= 4 && shortlist.length <= 15, 'Shortlist should contain 4–15 candidate exercises');
    shortlist.forEach((ex) => {
      assert.ok(ex.id && ex.name, 'Each shortlisted item must be a real normalized exercise');
    });
  });

  // 13. Soccer sport-specific mode
  test('13. Soccer Sport-Specific Mode -> builds soccer performance routine with agility/plyo/tendon exercises', () => {
    const soccerProfile = { ...baseProfile, goal: 'soccer' };
    const rec = Coach.localEngine(soccerProfile, baseCheckin, null, 3, {});
    const normalized = Coach.normalizeRecommendation(rec, soccerProfile, baseCheckin, null, {});
    assert.strictEqual(validateRecommendation(normalized).valid, true);
    assert.strictEqual(normalized.workout.type, 'soccer');
    assert.ok(normalized.workout.exercises.some((e) => /pogo|skater|spanish|nordic/i.test(e.name)), 'Must include soccer-specific plyometric or tendon isometric exercises');
  });

  // 14. Preference & Memory retention
  test('14. Preference & Memory Retention -> preferredExercises are woven into the generated routine', () => {
    const customExercise = {
      id: 'wx-test-custom',
      name: 'Custom Bulgarian Split Squat',
      bodyPart: 'legs',
      target: 'quadriceps',
    };
    const prefProfile = {
      ...baseProfile,
      preferences: {
        preferredExercises: [customExercise],
        dislikedSuggestions: [],
      }
    };
    const rec = Coach.localEngine(prefProfile, baseCheckin, null, 3, {});
    const normalized = Coach.normalizeRecommendation(rec, prefProfile, baseCheckin, null, {});
    assert.strictEqual(validateRecommendation(normalized).valid, true);
    assert.ok(normalized.workout.exercises.some((e) => e.name === 'Custom Bulgarian Split Squat'), 'Saved preferred exercise must be present in routine');
  });

  console.log('\n============================================================');
  console.log(` Test Results: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
