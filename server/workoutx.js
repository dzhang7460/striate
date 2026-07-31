/* ============================================================
   Striate — server/workoutx.js
   Backend WorkoutX API Service Module.
   - Server-side only (reads WORKOUTX_API_KEY).
   - Supports all required WorkoutX endpoints & query filters.
   - Normalizes exercises into clean standardized objects.
   - In-memory caching for speed & reliability.
   - Robust local curated fallback exercise database.
   - Intelligent exercise shortlisting for Striate AI Coach.
============================================================ */

const BASE_URL = 'https://api.workoutxapp.com';

// In-memory cache with 30 minute TTL
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

function getApiKey() {
  return process.env.WORKOUTX_API_KEY || process.env.WORKOUT_X_KEY || null;
}

// ---------- Curated Local Exercise Library (Fallback & Offline source of truth) ----------
const LOCAL_EXERCISES = [
  {
    id: 'wx-001',
    name: 'Bodyweight Squat',
    bodyPart: 'legs',
    target: 'quadriceps',
    equipment: 'body weight',
    effortLevel: 'beginner',
    mechanics: 'compound',
    force: 'push',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Stand with feet shoulder-width apart, toes slightly pointed out.',
      'Lower your hips back and down as if sitting into a chair.',
      'Keep your chest up and knees tracking over your toes.',
      'Drive through your heels to return to standing.'
    ],
    secondaryMuscles: ['glutes', 'hamstrings', 'calves'],
    caloriesPerMinute: 6.5,
    formTips: ['Keep heels flat on the floor', 'Do not let knees collapse inward'],
    alternatives: ['Goblet Squat', 'Box Squat']
  },
  {
    id: 'wx-002',
    name: 'Goblet Squat',
    bodyPart: 'legs',
    target: 'quadriceps',
    equipment: 'dumbbell',
    effortLevel: 'beginner',
    mechanics: 'compound',
    force: 'push',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Hold a dumbbell vertically against your chest with both hands.',
      'Stand with feet slightly wider than shoulder-width.',
      'Squat down until your thighs are parallel to the floor.',
      'Push through your feet to stand back up.'
    ],
    secondaryMuscles: ['glutes', 'core', 'upper back'],
    caloriesPerMinute: 7.5,
    formTips: ['Keep the dumbbell close to your chest', 'Elbows track inside knees at bottom'],
    alternatives: ['Bodyweight Squat', 'Leg Press']
  },
  {
    id: 'wx-003',
    name: 'Standard Push-up',
    bodyPart: 'chest',
    target: 'pectorals',
    equipment: 'body weight',
    effortLevel: 'beginner',
    mechanics: 'compound',
    force: 'push',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Start in a high plank position with hands slightly wider than shoulders.',
      'Keep your body in a straight line from head to heels.',
      'Lower your chest until it is an inch above the floor.',
      'Push through your palms to return to the starting position.'
    ],
    secondaryMuscles: ['triceps', 'anterior deltoids', 'core'],
    caloriesPerMinute: 6.0,
    formTips: ['Do not let your hips sag', 'Keep elbows at a 45-degree angle from your torso'],
    alternatives: ['Incline Push-up', 'Dumbbell Bench Press']
  },
  {
    id: 'wx-004',
    name: 'Incline Push-up',
    bodyPart: 'chest',
    target: 'pectorals',
    equipment: 'body weight',
    effortLevel: 'beginner',
    mechanics: 'compound',
    force: 'push',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Place your hands on an elevated surface like a table, bench, or counter.',
      'Step your feet back into a plank position.',
      'Lower your chest to the elevated edge with controlled speed.',
      'Press back up to straight arms.'
    ],
    secondaryMuscles: ['triceps', 'shoulders'],
    caloriesPerMinute: 5.0,
    formTips: ['The higher the surface, the easier the push-up', 'Keep core braced throughout'],
    alternatives: ['Standard Push-up', 'Wall Push-up']
  },
  {
    id: 'wx-005',
    name: 'Dumbbell One-Arm Row',
    bodyPart: 'back',
    target: 'lats',
    equipment: 'dumbbell',
    effortLevel: 'beginner',
    mechanics: 'compound',
    force: 'pull',
    isUnilateral: true,
    gifUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Place one knee and one hand on a bench for support.',
      'Hold a dumbbell in your free hand with arm hanging straight.',
      'Pull the dumbbell up toward your hip, keeping elbow close to your side.',
      'Lower the dumbbell under control.'
    ],
    secondaryMuscles: ['biceps', 'rear deltoids', 'rhomboids'],
    caloriesPerMinute: 6.5,
    formTips: ['Keep your spine neutral', 'Pull with your back muscle, not just your arm'],
    alternatives: ['Seated Cable Row', 'Resistance Band Row']
  },
  {
    id: 'wx-006',
    name: 'Glute Bridge',
    bodyPart: 'glutes',
    target: 'gluteus maximus',
    equipment: 'body weight',
    effortLevel: 'beginner',
    mechanics: 'isolation',
    force: 'push',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Lie on your back with knees bent and feet flat on the floor, hip-width apart.',
      'Brace your core and squeeze your glutes.',
      'Drive through your heels to lift your hips until your thighs and torso form a straight line.',
      'Pause at the top, then lower down slowly.'
    ],
    secondaryMuscles: ['hamstrings', 'lower back'],
    caloriesPerMinute: 5.0,
    formTips: ['Do not over-arch your lower back at the top', 'Squeeze glutes hard at peak contraction'],
    alternatives: ['Hip Thrust', 'Single-Leg Glute Bridge']
  },
  {
    id: 'wx-007',
    name: 'Forearm Plank',
    bodyPart: 'core',
    target: 'rectus abdominis',
    equipment: 'body weight',
    effortLevel: 'beginner',
    mechanics: 'isometric',
    force: 'static',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Rest on your forearms and toes, with elbows directly beneath your shoulders.',
      'Keep your body in a straight line from ears to ankles.',
      'Brace your core, squeeze your glutes and quads.',
      'Hold the position without letting your hips sag or hike up.'
    ],
    secondaryMuscles: ['transverse abdominis', 'shoulders', 'glutes'],
    caloriesPerMinute: 4.5,
    formTips: ['Breathe steadily', 'Tuck your tailbone slightly to engage lower abs'],
    alternatives: ['High Plank', 'Dead Bug']
  },
  {
    id: 'wx-008',
    name: 'Reverse Lunge',
    bodyPart: 'legs',
    target: 'quadriceps',
    equipment: 'body weight',
    effortLevel: 'beginner',
    mechanics: 'compound',
    force: 'push',
    isUnilateral: true,
    gifUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Stand tall with feet hip-width apart.',
      'Step backward with one foot and lower your rear knee toward the floor.',
      'Keep your front knee directly over your front ankle.',
      'Push through your front foot to return to standing.'
    ],
    secondaryMuscles: ['glutes', 'hamstrings', 'calves'],
    caloriesPerMinute: 7.0,
    formTips: ['Keep torso upright', 'Step back far enough so both knees form 90-degree angles'],
    alternatives: ['Forward Lunge', 'Split Squat']
  },
  {
    id: 'wx-009',
    name: 'Dumbbell Overhead Press',
    bodyPart: 'shoulders',
    target: 'anterior deltoid',
    equipment: 'dumbbell',
    effortLevel: 'beginner',
    mechanics: 'compound',
    force: 'push',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Stand or sit holding dumbbells at shoulder height with palms facing forward.',
      'Brace your core and keep feet planted.',
      'Press the dumbbells straight up overhead until arms are extended.',
      'Lower slowly back to shoulder height.'
    ],
    secondaryMuscles: ['triceps', 'upper chest', 'core'],
    caloriesPerMinute: 6.0,
    formTips: ['Do not arch your lower back excessively', 'Press overhead, not forward'],
    alternatives: ['Seated Dumbbell Press', 'Pike Push-up']
  },
  {
    id: 'wx-010',
    name: 'Brisk Outdoor Walk',
    bodyPart: 'cardio',
    target: 'cardiovascular system',
    equipment: 'body weight',
    effortLevel: 'beginner',
    mechanics: 'aerobic',
    force: 'cardio',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Walk at a pace where you can breathe deeply and hold a conversation.',
      'Swing your arms naturally and maintain an upright posture.',
      'Roll from heel to toe with each step.'
    ],
    secondaryMuscles: ['calves', 'hamstrings', 'core'],
    caloriesPerMinute: 5.5,
    formTips: ['Keep posture tall', 'Breathe rhythmically in through nose and out through mouth'],
    alternatives: ['Stationary Cycling', 'Easy Jog']
  },
  // --- Soccer & Athletic Performance Exercises ---
  {
    id: 'wx-011',
    name: 'Pogo Jumps (Ankle Stiffness & Agility)',
    bodyPart: 'calves',
    target: 'gastrocnemius',
    equipment: 'body weight',
    effortLevel: 'intermediate',
    mechanics: 'plyometric',
    force: 'push',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Stand with feet hip-width apart and knees slightly bent.',
      'Bounce rapidly off the balls of your feet using mostly ankle movement.',
      'Keep ground contact time as short as possible.',
      'Use your arms rhythmically for timing.'
    ],
    secondaryMuscles: ['soleus', 'achilles tendon', 'core'],
    caloriesPerMinute: 9.0,
    formTips: ['Think elastic springs, not deep squats', 'Minimal knee bend during landing'],
    alternatives: ['Jump Rope', 'Box Hops']
  },
  {
    id: 'wx-012',
    name: 'Lateral Skater Bounds (Soccer Agility)',
    bodyPart: 'legs',
    target: 'abductors',
    equipment: 'body weight',
    effortLevel: 'intermediate',
    mechanics: 'plyometric',
    force: 'push',
    isUnilateral: true,
    gifUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Stand on your right leg with your knee slightly bent.',
      'Push off laterally to your left, landing softly on your left foot.',
      'Absorb the landing by bending your left knee and hip.',
      'Push off immediately back to the right side.'
    ],
    secondaryMuscles: ['gluteus medius', 'quadriceps', 'hamstrings'],
    caloriesPerMinute: 9.5,
    formTips: ['Stick each landing for half a second before bounding back', 'Keep chest over toes'],
    alternatives: ['Lateral Shuttle Run', 'Side Lunges']
  },
  {
    id: 'wx-013',
    name: 'Spanish Squat (Tendon Isometric)',
    bodyPart: 'legs',
    target: 'patellar tendon',
    equipment: 'bands',
    effortLevel: 'beginner',
    mechanics: 'isometric',
    force: 'static',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Anchor a heavy resistance band behind your upper calves around a sturdy post.',
      'Step back so the band holds tension against your calves.',
      'Sit back into a squat with shins vertical.',
      'Hold the isometric position at 70–90 degrees of knee bend for 30–45 seconds.'
    ],
    secondaryMuscles: ['quadriceps', 'glutes'],
    caloriesPerMinute: 6.0,
    formTips: ['Keep shins completely vertical', 'Great for knee tendon health and soccer recovery'],
    alternatives: ['Wall Sit', 'Bodyweight Squat Hold']
  },
  {
    id: 'wx-014',
    name: 'Nordic Hamstring Curl (Eccentric Soccer Strength)',
    bodyPart: 'legs',
    target: 'hamstrings',
    equipment: 'body weight',
    effortLevel: 'intermediate',
    mechanics: 'isolation',
    force: 'pull',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Kneel on a soft pad while a partner or anchor holds your ankles down.',
      'Keep your body straight from knees to shoulders.',
      'Lower your torso forward as slowly as possible using only your hamstrings.',
      'Catch yourself with your hands on the floor, then push back up.'
    ],
    secondaryMuscles: ['glutes', 'calves'],
    caloriesPerMinute: 7.0,
    formTips: ['Resist the forward fall for at least 3-4 seconds', 'Essential for preventing soccer sprint injuries'],
    alternatives: ['Stability Ball Hamstring Curl', 'Romanian Deadlift']
  },
  {
    id: 'wx-015',
    name: 'Calf Raise (Single or Double Leg)',
    bodyPart: 'calves',
    target: 'gastrocnemius',
    equipment: 'body weight',
    effortLevel: 'beginner',
    mechanics: 'isolation',
    force: 'push',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Stand on a flat surface or the edge of a step.',
      'Rise up onto the balls of your feet as high as possible.',
      'Pause at the peak contraction for 1 second.',
      'Lower your heels back down under control.'
    ],
    secondaryMuscles: ['soleus', 'achilles tendon'],
    caloriesPerMinute: 4.5,
    formTips: ['Do not bounce at the bottom', 'Full range of motion from bottom stretch to top squeeze'],
    alternatives: ['Seated Calf Raise', 'Jump Rope']
  },
  {
    id: 'wx-016',
    name: 'Dumbbell Romanian Deadlift (RDL)',
    bodyPart: 'legs',
    target: 'hamstrings',
    equipment: 'dumbbell',
    effortLevel: 'beginner',
    mechanics: 'compound',
    force: 'pull',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Stand holding dumbbells in front of your thighs, knees slightly bent.',
      'Hinge at your hips, pushing your butt backward while keeping your spine flat.',
      'Lower dumbbells to mid-shin level until you feel a hamstring stretch.',
      'Squeeze your glutes to stand back upright.'
    ],
    secondaryMuscles: ['glutes', 'lower back', 'core'],
    caloriesPerMinute: 7.0,
    formTips: ['Do not round your lower back', 'Keep dumbbells close to your shins'],
    alternatives: ['Glute Bridge', 'Kettlebell Swing']
  },
  {
    id: 'wx-017',
    name: 'Dumbbell Bench Press',
    bodyPart: 'chest',
    target: 'pectorals',
    equipment: 'dumbbell',
    effortLevel: 'beginner',
    mechanics: 'compound',
    force: 'push',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Lie back on a bench holding dumbbells at chest level.',
      'Press the dumbbells straight up over your chest.',
      'Lower the dumbbells slowly until elbows reach 90 degrees.',
      'Press back to full arm extension.'
    ],
    secondaryMuscles: ['triceps', 'anterior deltoid'],
    caloriesPerMinute: 6.5,
    formTips: ['Keep feet planted firmly on the floor', 'Elbows tucked at ~45 degrees'],
    alternatives: ['Standard Push-up', 'Chest Press Machine']
  },
  {
    id: 'wx-018',
    name: 'Lat Pulldown (Gym Machine)',
    bodyPart: 'back',
    target: 'lats',
    equipment: 'gym',
    effortLevel: 'beginner',
    mechanics: 'compound',
    force: 'pull',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Sit at a lat pulldown machine and grip the wide bar with palms facing away.',
      'Pull the bar down toward your upper chest while leaning slightly back.',
      'Squeeze your shoulder blades together at the bottom.',
      'Return the bar slowly to arms extended.'
    ],
    secondaryMuscles: ['biceps', 'rhomboids', 'rear deltoids'],
    caloriesPerMinute: 6.0,
    formTips: ['Do not swing your torso to pull the weight', 'Drive elbows straight down to your sides'],
    alternatives: ['Dumbbell One-Arm Row', 'Assisted Pull-up']
  },
  {
    id: 'wx-019',
    name: 'Leg Press Machine',
    bodyPart: 'legs',
    target: 'quadriceps',
    equipment: 'gym',
    effortLevel: 'beginner',
    mechanics: 'compound',
    force: 'push',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Sit in the leg press machine with feet shoulder-width apart on the sled.',
      'Release the safety catch and bend your knees to lower the sled.',
      'Stop before your lower back lifts off the pad.',
      'Push through your whole foot to extend your legs without locking knees.'
    ],
    secondaryMuscles: ['glutes', 'hamstrings'],
    caloriesPerMinute: 7.5,
    formTips: ['Do not lock your knees at the top', 'Keep lower back pressed against the seat'],
    alternatives: ['Goblet Squat', 'Bodyweight Squat']
  },
  {
    id: 'wx-020',
    name: 'Dead Bug (Core Stability)',
    bodyPart: 'core',
    target: 'rectus abdominis',
    equipment: 'body weight',
    effortLevel: 'beginner',
    mechanics: 'isolation',
    force: 'pull',
    isUnilateral: true,
    gifUrl: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Lie on your back with arms extended toward the ceiling and knees bent at 90 degrees.',
      'Press your lower back flat against the floor.',
      'Slowly lower your right arm and left leg toward the floor simultaneously.',
      'Return to center and repeat on the opposite diagonal.'
    ],
    secondaryMuscles: ['transverse abdominis', 'hip flexors'],
    caloriesPerMinute: 4.5,
    formTips: ['Lower back must remain glued to the floor', 'Move slowly and deliberately'],
    alternatives: ['Forearm Plank', 'Bird Dog']
  },
  {
    id: 'wx-021',
    name: 'Bird Dog (Spine & Core Balance)',
    bodyPart: 'core',
    target: 'erector spinae',
    equipment: 'body weight',
    effortLevel: 'beginner',
    mechanics: 'isolation',
    force: 'pull',
    isUnilateral: true,
    gifUrl: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Start on all fours with hands under shoulders and knees under hips.',
      'Brace your core and extend your right arm forward and left leg backward.',
      'Hold parallel to the floor for 2 seconds.',
      'Return to all fours and switch sides.'
    ],
    secondaryMuscles: ['glutes', 'shoulders', 'lower back'],
    caloriesPerMinute: 4.0,
    formTips: ['Keep hips level throughout the movement', 'Reach for length, not height'],
    alternatives: ['Dead Bug', 'Forearm Plank']
  },
  {
    id: 'wx-022',
    name: 'Gentle Mobility & Wind-down Stretch',
    bodyPart: 'full body',
    target: 'mobility',
    equipment: 'body weight',
    effortLevel: 'beginner',
    mechanics: 'isolation',
    force: 'static',
    isUnilateral: false,
    gifUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80',
    instructions: [
      'Perform gentle cat-cow stretches on all fours for 60 seconds.',
      'Move into a child\'s pose stretch, breathing deeply through your nose.',
      'Finish with gentle hamstring and hip flexor stretches.',
      'Focus on slow exhalations to activate the parasympathetic nervous system.'
    ],
    secondaryMuscles: ['lower back', 'hamstrings', 'hip flexors'],
    caloriesPerMinute: 3.0,
    formTips: ['No sharp pain or forcing stretches', 'Ideal for bedtime wind-down and sleep routine'],
    alternatives: ['Brisk Outdoor Walk', 'Foam Rolling']
  }
];

// ---------- Normalization Function ----------
function normalizeExercise(raw) {
  if (!raw || typeof raw !== 'object') return null;

  return {
    id: String(raw.id || raw.exerciseId || raw._id || 'wx-' + Math.random().toString(36).slice(2, 8)),
    name: String(raw.name || raw.title || 'Unnamed Exercise').trim(),
    bodyPart: String(raw.bodyPart || raw.category || 'full body').toLowerCase(),
    target: String(raw.target || raw.targetMuscle || raw.muscle || 'general').toLowerCase(),
    equipment: String(raw.equipment || 'body weight').toLowerCase(),
    effortLevel: String(raw.effortLevel || raw.difficulty || 'beginner').toLowerCase(),
    mechanics: raw.mechanics ? String(raw.mechanics).toLowerCase() : undefined,
    force: raw.force ? String(raw.force).toLowerCase() : undefined,
    isUnilateral: Boolean(raw.isUnilateral || raw.unilateral || false),
    gifUrl: raw.gifUrl || raw.image || 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80',
    instructions: Array.isArray(raw.instructions)
      ? raw.instructions.map(String)
      : (typeof raw.instructions === 'string' ? [raw.instructions] : ['Perform exercise with controlled form.']),
    secondaryMuscles: Array.isArray(raw.secondaryMuscles) ? raw.secondaryMuscles.map(String) : [],
    caloriesPerMinute: typeof raw.caloriesPerMinute === 'number' ? raw.caloriesPerMinute : 6.0,
    formTips: Array.isArray(raw.formTips) ? raw.formTips.map(String) : [],
    alternatives: Array.isArray(raw.alternatives) ? raw.alternatives.map(String) : [],
  };
}

// ---------- Local Filtering Helper ----------
function filterLocalExercises(query = {}) {
  let list = LOCAL_EXERCISES.map(normalizeExercise);

  if (query.name) {
    const q = String(query.name).toLowerCase();
    list = list.filter((e) => e.name.toLowerCase().includes(q));
  }
  if (query.bodyPart && query.bodyPart !== 'all') {
    const b = String(query.bodyPart).toLowerCase();
    list = list.filter((e) => e.bodyPart.includes(b));
  }
  if (query.target && query.target !== 'all') {
    const t = String(query.target).toLowerCase();
    list = list.filter((e) => e.target.includes(t));
  }
  if (query.equipment && query.equipment !== 'all') {
    const eq = String(query.equipment).toLowerCase();
    list = list.filter((e) => e.equipment.includes(eq));
  }
  if (query.effortLevel && query.effortLevel !== 'all') {
    const ef = String(query.effortLevel).toLowerCase();
    list = list.filter((e) => e.effortLevel === ef);
  }
  if (query.mechanics && query.mechanics !== 'all') {
    list = list.filter((e) => e.mechanics === String(query.mechanics).toLowerCase());
  }
  if (query.force && query.force !== 'all') {
    list = list.filter((e) => e.force === String(query.force).toLowerCase());
  }
  if (query.isUnilateral !== undefined && query.isUnilateral !== '') {
    const uni = String(query.isUnilateral) === 'true';
    list = list.filter((e) => e.isUnilateral === uni);
  }

  // Sorting
  if (query.sortMethod === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (query.sortMethod === 'bodyPart') {
    list.sort((a, b) => a.bodyPart.localeCompare(b.bodyPart));
  }
  if (query.sortOrder === 'desc') {
    list.reverse();
  }

  const offset = Number(query.offset) || 0;
  const limit = Number(query.limit) || 20;
  const total = list.length;
  const data = list.slice(offset, offset + limit);

  return { total, count: data.length, data };
}

// ---------- API Callers (with fallback) ----------

async function fetchWorkoutX(endpoint, params = {}) {
  const apiKey = getApiKey();
  const url = new URL(BASE_URL + endpoint);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') {
      url.searchParams.set(k, String(v));
    }
  });

  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`[Striate WorkoutX] Cache HIT for ${endpoint}`);
    return cached.data;
  }

  if (!apiKey) {
    console.log(`[Striate WorkoutX] WORKOUTX_API_KEY not set. Serving local normalized library for ${endpoint}`);
    return handleLocalEndpoint(endpoint, params);
  }

  try {
    console.log(`[Striate WorkoutX] API Request: GET ${url.pathname}${url.search}`);
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-WorkoutX-Key': apiKey,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(4000), // 4s timeout to avoid slow hangs
    });

    if (!res.ok) {
      console.warn(`[Striate WorkoutX] API returned HTTP ${res.status}. Falling back to local library.`);
      return handleLocalEndpoint(endpoint, params);
    }

    const json = await res.json();
    const normalizedResponse = parseAndNormalizeApiResponse(endpoint, json, params);
    cache.set(cacheKey, { timestamp: Date.now(), data: normalizedResponse });
    return normalizedResponse;
  } catch (err) {
    console.warn(`[Striate WorkoutX] Request failed (${err.message}). Falling back to local library.`);
    return handleLocalEndpoint(endpoint, params);
  }
}

function parseAndNormalizeApiResponse(endpoint, json, params) {
  if (endpoint === '/v1/exercises/bodyPartList') {
    const list = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : ['chest', 'back', 'legs', 'shoulders', 'glutes', 'core', 'cardio']);
    return { ok: true, data: list.map(String) };
  }
  if (endpoint === '/v1/exercises/targetList') {
    const list = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : ['pectorals', 'lats', 'quadriceps', 'hamstrings', 'gluteus maximus', 'anterior deltoid', 'rectus abdominis', 'cardiovascular system', 'patellar tendon']);
    return { ok: true, data: list.map(String) };
  }

  // Handle single exercise view /v1/exercises/exercise/:id
  if (endpoint.startsWith('/v1/exercises/exercise/')) {
    const item = json?.data || json;
    const normalized = normalizeExercise(item);
    return { ok: true, data: normalized };
  }

  // Handle list/search endpoints
  const rawList = Array.isArray(json)
    ? json
    : (Array.isArray(json?.data) ? json.data : (Array.isArray(json?.exercises) ? json.exercises : []));

  const total = json?.total || rawList.length;
  const data = rawList.map(normalizeExercise).filter(Boolean);

  return { total, count: data.length, data };
}

function handleLocalEndpoint(endpoint, params) {
  if (endpoint === '/v1/exercises/bodyPartList') {
    const bodyParts = [...new Set(LOCAL_EXERCISES.map((e) => e.bodyPart))].sort();
    return { ok: true, data: bodyParts };
  }
  if (endpoint === '/v1/exercises/targetList') {
    const targets = [...new Set(LOCAL_EXERCISES.map((e) => e.target))].sort();
    return { ok: true, data: targets };
  }
  if (endpoint.startsWith('/v1/exercises/exercise/')) {
    const id = endpoint.split('/').pop();
    const match = LOCAL_EXERCISES.find((e) => e.id === id) || LOCAL_EXERCISES[0];
    return { ok: true, data: normalizeExercise(match) };
  }
  if (endpoint.startsWith('/v1/exercises/name/')) {
    const nameParam = decodeURIComponent(endpoint.split('/').pop());
    return filterLocalExercises({ ...params, name: nameParam });
  }
  if (endpoint.startsWith('/v1/exercises/bodyPart/')) {
    const bp = decodeURIComponent(endpoint.split('/').pop());
    return filterLocalExercises({ ...params, bodyPart: bp });
  }
  if (endpoint.startsWith('/v1/exercises/target/')) {
    const tg = decodeURIComponent(endpoint.split('/').pop());
    return filterLocalExercises({ ...params, target: tg });
  }
  if (endpoint.startsWith('/v1/exercises/equipment/')) {
    const eq = decodeURIComponent(endpoint.split('/').pop());
    return filterLocalExercises({ ...params, equipment: eq });
  }

  // Default search & list
  return filterLocalExercises(params);
}

// ---------- Public API wrappers for endpoints ----------

async function searchExercises(params = {}) {
  return fetchWorkoutX('/v1/exercises/search', params);
}

async function getExerciseById(id) {
  return fetchWorkoutX(`/v1/exercises/exercise/${encodeURIComponent(id)}`);
}

async function getBodyPartList() {
  return fetchWorkoutX('/v1/exercises/bodyPartList');
}

async function getTargetList() {
  return fetchWorkoutX('/v1/exercises/targetList');
}

// ---------- AI Coach Shortlisting Function ----------

async function shortlistExercises(profile = {}, checkin = {}) {
  const goal = profile.goal || 'general';
  const userEquip = Array.isArray(profile.equipment) ? profile.equipment : ['bodyweight'];
  const hasGym = userEquip.includes('gym');
  const hasDumbbells = userEquip.includes('dumbbells');
  const hasBands = userEquip.includes('bands');
  const timeAvail = checkin.timeAvailable || '30-45';
  const isShortTime = timeAvail === '0-15' || timeAvail === '15-30' || checkin.specialConstraint === 'busy' || checkin.specialConstraint === 'exam';

  // Check injury flags
  const injuryNote = `${profile.injuryNotes || ''} ${checkin.extraNote || ''}`.toLowerCase();
  const hasKneeInjury = /knee|patell|quad|leg/i.test(injuryNote);
  const hasShoulderInjury = /shoulder|overhead|deltoid/i.test(injuryNote);
  const hasBackInjury = /back|lumbar|spine/i.test(injuryNote);

  // Check if sleep is <6h or flagged as main issue -> include mobility and light cardio
  const sleepHrsStr = checkin.sleep || '7-8';
  const isLowSleep = sleepHrsStr === '<5' || sleepHrsStr === '5-6' || Number(checkin.energy) <= 2;

  // Retrieve candidate exercises from WorkoutX search / local library
  const result = await searchExercises({ limit: 40 });
  let pool = result.data || [];

  // Filter out injured areas
  pool = pool.filter((e) => {
    if (hasKneeInjury && (e.bodyPart === 'legs' || /squat|lunge|jump|bound/i.test(e.name))) return false;
    if (hasShoulderInjury && (/overhead|press|shoulder/i.test(e.name) || e.bodyPart === 'shoulders')) return false;
    if (hasBackInjury && (/deadlift|rdl|swing/i.test(e.name))) return false;
    return true;
  });

  // Filter by user equipment
  pool = pool.filter((e) => {
    const eq = (e.equipment || 'body weight').toLowerCase();
    if (hasGym) return true;
    if (eq.includes('body weight') || eq.includes('bodyweight') || eq === 'none') return true;
    if (hasDumbbells && eq.includes('dumbbell')) return true;
    if (hasBands && eq.includes('band')) return true;
    return false;
  });

  // Goal & Sport-specific (Soccer) prioritization
  const shortlisted = [];

  // 1. Always prioritize user's preferred exercises from profile memory
  const prefIds = new Set((profile.preferences?.preferredExercises || []).map((p) => p.id));
  pool.forEach((e) => {
    if (prefIds.has(e.id)) {
      shortlisted.push({ ...e, isUserPreferred: true });
    }
  });

  // 2. Goal-based curation
  pool.forEach((e) => {
    if (prefIds.has(e.id)) return; // already added
    if (goal === 'soccer') {
      // Soccer mode: speed/agility, plyometrics, tendon isometric, lower body strength, core
      if (/pogo|skater|spanish|nordic|squat|lunge|calf|plank|bug/i.test(e.name) || e.bodyPart === 'legs' || e.bodyPart === 'core') {
        shortlisted.push(e);
      }
    } else if (isLowSleep) {
      // Sleep-first adaptation: active recovery walk, mobility, gentle compounds
      if (/walk|stretch|mobility|glute bridge|plank/i.test(e.name) || e.bodyPart === 'cardio' || e.bodyPart === 'core') {
        shortlisted.push(e);
      }
    } else if (goal === 'strength' || goal === 'muscle') {
      if (/squat|push-up|row|bench|press|deadlift|pulldown/i.test(e.name) && !isShortTime) {
        shortlisted.push(e);
      } else if (shortlisted.length < 12) {
        shortlisted.push(e);
      }
    } else {
      // General fitness / fat loss / energy
      if (shortlisted.length < 12) {
        shortlisted.push(e);
      }
    }
  });

  // Deduplicate and cap to 12-15 items so we don't overflow AI context
  const unique = [];
  const seen = new Set();
  shortlisted.forEach((e) => {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      unique.push(e);
    }
  });

  // If pool was very restrictive, pad with safe bodyweight basics
  if (unique.length < 6) {
    LOCAL_EXERCISES.forEach((e) => {
      if (!seen.has(e.id) && unique.length < 10) {
        seen.add(e.id);
        unique.push(normalizeExercise(e));
      }
    });
  }

  console.log(`[Striate WorkoutX] Shortlisted ${unique.length} candidate exercises for AI Coach (Goal: ${goal}, LowSleep: ${isLowSleep})`);
  return unique.slice(0, 14);
}

module.exports = {
  fetchWorkoutX,
  searchExercises,
  getExerciseById,
  getBodyPartList,
  getTargetList,
  shortlistExercises,
  normalizeExercise,
  LOCAL_EXERCISES,
  getApiKey,
};
