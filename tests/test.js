/* ============================================================
   Striate — tests/test.js
   Automated test suite covering the 10 required testable cases:
   1. workout completed
   2. workout skipped
   3. workout partially completed
   4. low sleep
   5. low time
   6. injury
   7. first-time user
   8. missing fields
   9. AI failure
   10. malformed AI JSON
============================================================ */

const assert = require('assert');
const Coach = require('../js/coach');
const { validateRecommendation } = require('../server/validator');

console.log('============================================================');
console.log(' Starting Striate v0.2 Automated Test Suite');
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

const baseProfile = {
  id: 'test_user_1',
  goal: 'strength',
  experienceLevel: 'new',
  equipment: ['gym'],
  dedicatedWorkoutTime: '5-6 PM',
  availableDays: '3',
  availableTime: '45-60',
  sleepSchedule: '22-23',
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
  assert.ok(normalized.explanation.includes('missing one session is normal') || normalized.summary.includes('Fresh start'), 'Should provide encouraging adaptive guidance');
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

// 4. Low sleep
test('4. Low Sleep (<6h sleep + low energy) -> recovery walk & sleep guidance', () => {
  const checkin = { ...baseCheckin, sleep: '<5', energy: 2 };
  const rec = Coach.localEngine(baseProfile, checkin, null, 3, {});
  const normalized = Coach.normalizeRecommendation(rec, baseProfile, checkin, null, {});
  assert.strictEqual(validateRecommendation(normalized).valid, true);
  assert.ok(/recovery|walk|rest/i.test(normalized.mainAction) || normalized.workout?.title.includes('Recovery'), 'Main action must switch to recovery');
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
test('9. AI Failure -> fallback rules engine produces valid output', async () => {
  // Simulate AI failure by testing that localEngine output passes strict validation
  const rec = Coach.localEngine(baseProfile, baseCheckin, null, 2, {});
  const normalized = Coach.normalizeRecommendation(rec, baseProfile, baseCheckin, null, {});
  const val = validateRecommendation(normalized);
  assert.strictEqual(val.valid, true, `Fallback engine output must be valid: ${val.error}`);
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

console.log('\n============================================================');
console.log(` Test Results: ${passedCount} Passed, ${failedCount} Failed`);
console.log('============================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
