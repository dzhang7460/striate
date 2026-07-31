/* ============================================================
   Striate — coach.js
   Adaptive recommendation engine for Striate v0.3.
   - Integrates WorkoutX exercises & shortlisting (/api/coach)
   - Builds concrete workout routines (sets, reps, rest, form cues)
   - Sleep-First Core Loop & Sleep-Focused Daily Plans
   - Sport-Specific Mode (Soccer performance & athletic agility)
   - Long-term Memory & Preference retention (preferredExercises,
     dislikedSuggestions adaptation)
   - Automatic fallback to local rules engine with full routine tables
============================================================ */

const Coach = (() => {
  let provider = 'auto'; // 'auto' | 'local' | 'llm'

  // ---------- Curated Beginner Exercise Templates (with full WorkoutX exercise routines) ----------
  const EXERCISE_TEMPLATES = {
    beginner_gym_full_body: {
      id: 'beginner_gym_full_body',
      title: 'Beginner Gym Full Body',
      durationMinutes: 45,
      type: 'strength',
      action: 'Do a 45-minute full-body basics session at the gym',
      detail: '3 sets each: goblet squat (8–12), dumbbell bench press (8–12), lat pulldown (8–12). Pick weights where you could do 2 more reps with good form.',
      why: 'Full-body basics build overall strength efficiently for beginners without overwhelming recovery.',
      exercises: [
        { id: 'wx-002', name: 'Goblet Squat', sets: 3, reps: '8–12', rest: '90s', formCue: 'Keep dumbbell tight to chest; knees track over toes', bodyPart: 'legs', target: 'quadriceps', gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-017', name: 'Dumbbell Bench Press', sets: 3, reps: '8–12', rest: '90s', formCue: 'Feet flat on floor, elbows tucked at ~45 degrees', bodyPart: 'chest', target: 'pectorals', gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-018', name: 'Lat Pulldown (Gym Machine)', sets: 3, reps: '8–12', rest: '90s', formCue: 'Pull bar to upper chest without swinging torso', bodyPart: 'back', target: 'lats', gifUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-007', name: 'Forearm Plank', sets: 3, reps: '30 sec hold', rest: '60s', formCue: 'Brace core and glutes; straight line from ears to heels', bodyPart: 'core', target: 'rectus abdominis', gifUrl: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=400&q=80' }
      ]
    },
    beginner_home_full_body: {
      id: 'beginner_home_full_body',
      title: 'Beginner Home Full Body',
      durationMinutes: 35,
      type: 'strength',
      action: 'Do a 35-minute full-body session at home',
      detail: '3 rounds: bodyweight squats (10–15), push-ups (5–12, incline if needed), glute bridges (12–15), plank (20–30s). Rest 90s between rounds.',
      why: 'Simple bodyweight movements stimulate all major muscle groups safely at home.',
      exercises: [
        { id: 'wx-001', name: 'Bodyweight Squat', sets: 3, reps: '10–15', rest: '60s', formCue: 'Chest up, drive through heels', bodyPart: 'legs', target: 'quadriceps', gifUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-003', name: 'Standard Push-up', sets: 3, reps: '5–12', rest: '60s', formCue: 'Core braced, elbows at 45 degree angle', bodyPart: 'chest', target: 'pectorals', gifUrl: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-006', name: 'Glute Bridge', sets: 3, reps: '12–15', rest: '60s', formCue: 'Squeeze glutes at top, do not over-arch lower back', bodyPart: 'glutes', target: 'gluteus maximus', gifUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-007', name: 'Forearm Plank', sets: 3, reps: '30 sec hold', rest: '60s', formCue: 'Tuck tailbone slightly to engage lower abs', bodyPart: 'core', target: 'rectus abdominis', gifUrl: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=400&q=80' }
      ]
    },
    soccer_performance: {
      id: 'soccer_performance',
      title: 'Soccer Performance & Agility',
      durationMinutes: 40,
      type: 'soccer',
      action: 'Do a 40-minute soccer performance & agility session',
      detail: '3 rounds: Pogo Jumps (30s), Lateral Skater Bounds (10/side), Spanish Squat (45s hold), Nordic Hamstring Curl (6-8 reps).',
      why: 'Builds soccer-specific ankle stiffness, lateral agility, patellar tendon health, and eccentric hamstring strength to prevent match injuries.',
      exercises: [
        { id: 'wx-011', name: 'Pogo Jumps (Ankle Stiffness)', sets: 3, reps: '30 sec', rest: '45s', formCue: 'Rapid ankle bounces off balls of feet, minimal knee bend', bodyPart: 'calves', target: 'gastrocnemius', gifUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-012', name: 'Lateral Skater Bounds', sets: 3, reps: '10 / side', rest: '60s', formCue: 'Stick each single-leg landing softly for balance', bodyPart: 'legs', target: 'abductors', gifUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-013', name: 'Spanish Squat (Tendon Isometric)', sets: 3, reps: '45 sec hold', rest: '60s', formCue: 'Shins vertical against band tension; great for knee tendon health', bodyPart: 'legs', target: 'patellar tendon', gifUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-014', name: 'Nordic Hamstring Curl', sets: 3, reps: '6–8 reps', rest: '90s', formCue: 'Resist forward fall slowly with hamstrings for 3-4 seconds', bodyPart: 'legs', target: 'hamstrings', gifUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80' }
      ]
    },
    low_time_fallback: {
      id: 'low_time_fallback',
      title: '10-Minute Habit Protector',
      durationMinutes: 10,
      type: 'strength',
      action: 'Do a 10-minute minimum: 3 rounds of squats + push-ups + plank',
      detail: '3 rounds: 10 squats, 5–10 push-ups (incline if needed), 20-second plank. No warm-up needed at this intensity. Done in ~10 minutes.',
      why: 'On a busy day, preserving the habit is more important than workout volume.',
      exercises: [
        { id: 'wx-001', name: 'Bodyweight Squat', sets: 3, reps: '10 reps', rest: '30s', formCue: 'Controlled tempo, full depth', bodyPart: 'legs', target: 'quadriceps', gifUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-004', name: 'Incline Push-up', sets: 3, reps: '8–10 reps', rest: '30s', formCue: 'Hands on bench/counter, core braced', bodyPart: 'chest', target: 'pectorals', gifUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-007', name: 'Forearm Plank', sets: 3, reps: '20 sec hold', rest: '30s', formCue: 'Breathe steadily, hips level', bodyPart: 'core', target: 'rectus abdominis', gifUrl: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=400&q=80' }
      ]
    },
    recovery_day: {
      id: 'recovery_day',
      title: 'Active Recovery Walk & Mobility',
      durationMinutes: 20,
      type: 'recovery',
      action: 'Take a recovery day: 15–20 minute easy walk + bedtime mobility',
      detail: 'Keep it genuinely easy — you should be able to breathe comfortably and hold a conversation the whole time. No lifting today.',
      why: 'Training hard when under-recovered slows down progress. Gentle movement promotes blood flow and recovery.',
      exercises: [
        { id: 'wx-010', name: 'Brisk Outdoor Walk', sets: 1, reps: '15–20 min', rest: '0s', formCue: 'Conversational pace, upright posture', bodyPart: 'cardio', target: 'cardiovascular system', gifUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-022', name: 'Gentle Mobility & Wind-down Stretch', sets: 1, reps: '5–10 min', rest: '0s', formCue: 'Slow nasal exhalations to activate recovery before bed', bodyPart: 'full body', target: 'mobility', gifUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80' }
      ]
    },
    upper_body_basics: {
      id: 'upper_body_basics',
      title: 'Upper Body Basics',
      durationMinutes: 30,
      type: 'strength',
      action: 'Do a 30-minute upper body basics session',
      detail: '3 sets each: dumbbell or incline push-ups (8–12), dumbbell one-arm rows (8–12/side), overhead reach or shoulder press (8–10). Rest 90s between sets.',
      why: 'Focuses on posture and upper body strength while allowing lower body joints to recover.',
      exercises: [
        { id: 'wx-017', name: 'Dumbbell Bench Press', sets: 3, reps: '8–12', rest: '90s', formCue: 'Press steadily over chest, control the descent', bodyPart: 'chest', target: 'pectorals', gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-005', name: 'Dumbbell One-Arm Row', sets: 3, reps: '8–12 / side', rest: '90s', formCue: 'Neutral spine, pull dumbbell toward hip', bodyPart: 'back', target: 'lats', gifUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-009', name: 'Dumbbell Overhead Press', sets: 3, reps: '8–10', rest: '90s', formCue: 'Brace core, do not over-arch lower back', bodyPart: 'shoulders', target: 'anterior deltoid', gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80' }
      ]
    },
    lower_body_basics: {
      id: 'lower_body_basics',
      title: 'Lower Body Basics',
      durationMinutes: 35,
      type: 'strength',
      action: 'Do a 35-minute lower body basics session',
      detail: '3 sets each: goblet squats (8–12), glute bridges (12–15), reverse lunges (8/side). Keep reps slow and controlled.',
      why: 'Builds leg strength and stability with beginner-friendly joint angles.',
      exercises: [
        { id: 'wx-002', name: 'Goblet Squat', sets: 3, reps: '8–12', rest: '90s', formCue: 'Keep dumbbell close to chest', bodyPart: 'legs', target: 'quadriceps', gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-016', name: 'Dumbbell Romanian Deadlift', sets: 3, reps: '8–12', rest: '90s', formCue: 'Hinge hips backward, keep dumbbells tight to shins', bodyPart: 'legs', target: 'hamstrings', gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-008', name: 'Reverse Lunge', sets: 3, reps: '8 / side', rest: '90s', formCue: 'Step backward softly, torso upright', bodyPart: 'legs', target: 'quadriceps', gifUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80' }
      ]
    },
    light_cardio_walk: {
      id: 'light_cardio_walk',
      title: 'Light Cardio / Walk Day',
      durationMinutes: 25,
      type: 'cardio',
      action: 'Do 25 minutes of light cardio or brisk walking',
      detail: 'Walk fast enough that talking takes slight effort, or cycle at an easy pace. If you have stairs, add 3 calm ascents at the end.',
      why: 'Improves daily energy and aerobic base without muscle soreness.',
      exercises: [
        { id: 'wx-010', name: 'Brisk Outdoor Walk', sets: 1, reps: '25 min', rest: '0s', formCue: 'Deep rhythmic breathing, tall posture', bodyPart: 'cardio', target: 'cardiovascular system', gifUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=400&q=80' }
      ]
    },
  };

  // ---------- Signal extraction ----------

  function readSignals(profile, checkin) {
    const sleepMap = { '<5': 4, '5-6': 5.5, '6-7': 6.5, '7-8': 7.5, '8+': 8.5 };
    const timeMap = { '0-15': 12, '15-30': 25, '30-45': 40, '45-60': 55, '60+': 70 };
    return {
      sleepHrs: sleepMap[checkin.sleep] ?? 7,
      energy: Number(checkin.energy) || 3,       // 1–5
      soreness: Number(checkin.soreness) || 1,   // 1–5
      mood: Number(checkin.mood) || 3,           // 1–5
      minutes: timeMap[checkin.timeAvailable] ?? 40,
      dedicatedTime: checkin.dedicatedWorkoutTime || profile.dedicatedWorkoutTime || '5-6 PM',
      constraint: checkin.specialConstraint || 'none',
      hasInjuryFlag:
        checkin.specialConstraint === 'injury' ||
        /injur|pain|hurt/i.test(checkin.extraNote || ''),
      hasProfileInjury: !!(profile.injuryNotes || '').trim(),
      goal: profile.goal || 'general',
      experience: profile.experienceLevel || 'new',
      equipment: profile.equipment || [],
      wakeTimeTarget: profile.wakeTimeTarget || '7:00 AM',
      sleepSchedule: profile.sleepSchedule || '22-23',
      extraNote: checkin.extraNote || '',
      preferredExercises: profile.preferences?.preferredExercises || [],
      dislikedSuggestions: profile.preferences?.dislikedSuggestions || [],
    };
  }

  function readiness(s) {
    let score = 5;
    score += (s.sleepHrs - 7) * 1.2;
    score += (s.energy - 3) * 1.0;
    score -= (s.soreness - 1) * 1.1;
    score += (s.mood - 3) * 0.5;
    return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  }

  function goalLabel(goal) {
    return {
      strength: 'building strength',
      muscle: 'building muscle',
      fat_loss: 'losing fat',
      fitness: 'general fitness',
      energy: 'more daily energy',
      soccer: 'soccer performance & athletic agility',
    }[goal] || 'general fitness';
  }

  // ---------- Schedule Generator (Sleep-First Core Loop) ----------

  function generateTimeBlocks(s, workoutBlock, isRestDay, profile = {}) {
    const timeVal = s.dedicatedTime || '5-6 PM';
    let workoutStart = '5:00 PM';
    let workoutEnd = '6:00 PM';

    if (timeVal.includes('7-8 AM')) {
      workoutStart = '7:00 AM';
      workoutEnd = '8:00 AM';
    } else if (timeVal.includes('12-1 PM')) {
      workoutStart = '12:15 PM';
      workoutEnd = '1:00 PM';
    } else if (timeVal.includes('30-after-school') || timeVal.includes('30 min after')) {
      workoutStart = '3:45 PM';
      workoutEnd = '4:30 PM';
    } else if (timeVal.includes('6-7 PM')) {
      workoutStart = '6:00 PM';
      workoutEnd = '7:00 PM';
    } else if (timeVal.includes('5-6 PM')) {
      workoutStart = '5:00 PM';
      workoutEnd = '6:00 PM';
    } else {
      workoutStart = '5:30 PM';
      workoutEnd = '6:15 PM';
    }

    const wakeTime = s.wakeTimeTarget || '7:00 AM';
    const bedtimeStr = profile.sleepSchedule === 'before-22' ? '9:30 PM' :
                       profile.sleepSchedule === '22-23' ? '10:00 PM' :
                       profile.sleepSchedule === '23-24' ? '11:00 PM' : '10:30 PM';
    const windDownStr = profile.sleepSchedule === 'before-22' ? '9:00 PM' :
                        profile.sleepSchedule === '22-23' ? '9:30 PM' : '10:15 PM';

    const blocks = [];
    blocks.push({
      time: wakeTime,
      title: 'Wake-Up Target & Morning Hydration',
      detail: `Rise at your ${wakeTime} target. Drink a glass of water immediately to start circadian alertness.`,
      type: 'habit',
    });

    blocks.push({
      time: '7:45 AM',
      title: 'Morning Fuel',
      detail: 'Eat a balanced breakfast with 20–30g of protein.',
      type: 'meal',
    });

    if (s.constraint === 'exam' || s.constraint === 'busy') {
      blocks.push({
        time: '9:00 AM — 12:00 PM',
        title: 'Deep Focus Block',
        detail: `Prioritize your ${s.constraint === 'exam' ? 'exam prep and studies' : 'highest priority task'}. Keep water close by.`,
        type: 'study',
      });
    } else {
      blocks.push({
        time: '12:30 PM',
        title: 'Midday Meal & Check-in',
        detail: 'Have a nourishing lunch and take a 5-minute walk to clear your head.',
        type: 'meal',
      });
    }

    if (isRestDay || !workoutBlock) {
      blocks.push({
        time: `${workoutStart} — ${workoutEnd}`,
        title: 'Active Recovery Walk',
        detail: '15–20 minutes of light outdoor walking or gentle stretching. Protect your recovery.',
        type: 'rest',
      });
    } else {
      blocks.push({
        time: `${workoutStart} — ${workoutEnd}`,
        title: workoutBlock.title || 'Today\'s Workout',
        detail: workoutBlock.detail || 'Follow today\'s curated beginner session.',
        type: 'workout',
      });
    }

    blocks.push({
      time: '7:00 PM',
      title: 'Post-Session Meal',
      detail: `Eat a protein-rich meal to support ${goalLabel(s.goal)} and muscular repair.`,
      type: 'meal',
    });

    blocks.push({
      time: windDownStr,
      title: 'Screens Off & Bedtime Wind-Down',
      detail: 'Disconnect from phones and bright devices 30–45 minutes before bed. Perform gentle breathing or mobility.',
      type: 'sleep',
    });

    blocks.push({
      time: bedtimeStr,
      title: 'Target Bedtime Sleep Block',
      detail: `In bed by ${bedtimeStr} for 7–8 hours of consistent sleep to optimize tomorrow's readiness.`,
      type: 'sleep',
    });

    return blocks;
  }

  // ---------- 7-Day Plan Generator ----------

  function generateSevenDayPlan(profile) {
    const g = profile?.goal || 'general';
    const isSoccer = g === 'soccer';
    return [
      {
        day: 'Day 1 (Today)',
        focus: isSoccer ? 'Soccer Agility & Strength' : 'Primary Training',
        mainAction: isSoccer ? '40-min soccer performance & plyometric basics' : 'Curated beginner session based on today\'s check-in',
        note: 'Adapted to your sleep, energy, and dedicated time window.',
      },
      {
        day: 'Day 2',
        focus: 'Active Recovery & Sleep',
        mainAction: '20-minute conversational walk + bedtime wind-down focus',
        note: 'Allows muscle protein synthesis without adding fatigue.',
      },
      {
        day: 'Day 3',
        focus: isSoccer ? 'Tendon Isometric & Strength' : 'Strength Basics',
        mainAction: isSoccer ? 'Spanish squats, Nordic hamstring curls, leg strength' : 'Full-body or upper-body beginner session',
        note: 'Build on consistent movement patterns with moderate reps.',
      },
      {
        day: 'Day 4',
        focus: 'Habit & Mobility',
        mainAction: '15-minute mobility work or light outdoor walk',
        note: 'Mid-week check on sleep consistency and soreness.',
      },
      {
        day: 'Day 5',
        focus: isSoccer ? 'Speed & Agility' : 'Strength Basics',
        mainAction: isSoccer ? 'Pogo jumps, lateral bounds, core stability' : 'Full-body or lower-body beginner session',
        note: 'Maintain form quality even as fatigue accumulates.',
      },
      {
        day: 'Day 6',
        focus: isSoccer ? 'Match Conditioning' : 'Cardio Base',
        mainAction: isSoccer ? 'Technical intervals & outdoor runs' : '25-minute brisk walk or easy cycling',
        note: 'Low-impact cardiovascular conditioning.',
      },
      {
        day: 'Day 7',
        focus: 'Review & Rest',
        mainAction: 'Complete rest or optional gentle stretching',
        note: 'Review weekly consistency and plan next week\'s bedtime routine.',
      },
    ];
  }

  // ---------- "Why this changed" vs previous day ----------

  function explainChange(s, prevEntry, prevCompletion) {
    if (!prevEntry) return null;
    const p = prevEntry.checkin;
    const diffs = [];
    const pe = Number(p.energy), ps = Number(p.soreness);

    if (prevCompletion) {
      if (prevCompletion.status === 'completed') {
        diffs.push('you completed yesterday\'s workout');
      } else if (prevCompletion.status === 'skipped') {
        diffs.push(`yesterday's workout was skipped${prevCompletion.reason ? ` (${prevCompletion.reason})` : ''}`);
      } else if (prevCompletion.status === 'partial') {
        diffs.push('you did a partial session yesterday');
      }
    }

    if (p.sleep) {
      const sleepMap = { '<5': 4, '5-6': 5.5, '6-7': 6.5, '7-8': 7.5, '8+': 8.5 };
      const prevH = sleepMap[p.sleep] ?? 7;
      if (s.sleepHrs - prevH >= 1) diffs.push('you slept more than yesterday');
      else if (prevH - s.sleepHrs >= 1) diffs.push('you slept less than yesterday');
    }
    if (!Number.isNaN(pe)) {
      if (s.energy - pe >= 1) diffs.push('your energy is up');
      else if (pe - s.energy >= 1) diffs.push('your energy is down');
    }
    if (!Number.isNaN(ps)) {
      if (s.soreness - ps >= 1) diffs.push('you\'re more sore');
      else if (ps - s.soreness >= 1) diffs.push('you\'re less sore');
    }
    if (s.constraint !== 'none' && s.constraint !== (p.specialConstraint || 'none')) {
      diffs.push(`today has a "${s.constraint}" constraint`);
    }
    if (s.preferredExercises && s.preferredExercises.length > 0) {
      diffs.push('incorporating your saved preferred exercises');
    }
    if (s.dislikedSuggestions && s.dislikedSuggestions.length > 0) {
      diffs.push('adapted based on your previous plan feedback');
    }

    if (diffs.length === 0) {
      return 'Your check-in looks similar to last time, so today follows the same training progression.';
    }
    return `Compared to your last check-in, ${diffs.join(', ')} — so today's schedule and intensity were adjusted accordingly.`;
  }

  // ---------- Local Rule Engine (v0.3) ----------

  function localEngine(profile, checkin, prevEntry, entryCount, context = {}) {
    const s = readSignals(profile, checkin);
    const r = readiness(s);
    const prevCompletion = context.prevCompletion || null;

    let template = EXERCISE_TEMPLATES.beginner_gym_full_body;
    let summary = '';
    let confidence = 'high';
    let confidenceNote = '';
    let explanation = '';
    let thingsToAvoid = [];
    let caution = null;
    let isRestDay = false;
    let followUpQuestion = null;

    // 1) Injury signals override everything.
    if (s.hasInjuryFlag) {
      isRestDay = true;
      template = null;
      summary = `You flagged pain or an injury. Readiness doesn't matter today — safety does.`;
      explanation = 'Training through sharp or joint pain is how beginners turn a minor strain into a chronic injury. Skipping one session costs you almost nothing; training through pain can cost months.';
      confidence = 'low';
      confidenceNote = 'Low confidence — I cannot assess an injury from a check-in. Treat this as a default-to-safe suggestion, not medical advice.';
      caution = 'Sharp, persistent, or worsening pain means see a doctor or physio. This is not medical advice.';
      thingsToAvoid = [
        'Do not train the affected area or test if it still hurts under load.',
        'Avoid high-intensity intervals or sudden jumping movements.',
        'Do not ignore sharp or joint pain.'
      ];
    }
    // 2) Very poor recovery: short sleep AND low energy -> Sleep-First Core Loop.
    else if (s.sleepHrs < 6 && s.energy <= 2) {
      isRestDay = true;
      template = EXERCISE_TEMPLATES.recovery_day;
      summary = `Short sleep (${checkin.sleep}h) and low energy (${s.energy}/5). Sleep consistency is your primary focus today.`;
      explanation = 'Training hard on under 6 hours of sleep with low energy produces a low-quality workout and digs a recovery hole. An active recovery walk and bedtime wind-down routine keep your momentum while restoring your circadian rhythm.';
      confidence = 'high';
      confidenceNote = 'High confidence — the evidence on short sleep and injury risk is consistent, and your inputs point toward recovery first.';
      thingsToAvoid = [
        'Avoid heavy lifting or pushing near failure today.',
        'Avoid caffeine within 8 hours of your target bedtime.',
        'Do not use phones or screens 30–45 minutes before bed tonight.'
      ];
    }
    // 3) High soreness.
    else if (s.soreness >= 4) {
      const canTrain = s.energy >= 3;
      if (canTrain) {
        template = EXERCISE_TEMPLATES.light_cardio_walk;
        summary = `You're quite sore (${s.soreness}/5) but energy is okay. This is normal as your muscles adapt.`;
        explanation = 'High soreness indicates a strong stimulus from your last session. Light movement speeds recovery by promoting blood flow without adding new muscular fatigue.';
        confidence = 'medium';
        confidenceNote = 'Medium confidence — soreness is an approximate signal. If the pain is sharp or one-sided in a joint, treat it as an injury flag.';
        thingsToAvoid = ['Avoid heavy eccentric lifting on sore muscle groups.', 'Do not skip meals — protein is essential for repair.'];
      } else {
        isRestDay = true;
        template = EXERCISE_TEMPLATES.recovery_day;
        summary = `High soreness (${s.soreness}/5) and low energy (${s.energy}/5). Your body is asking for a day off.`;
        explanation = 'Both recovery indicators are down. Rest is not falling behind — it is when the muscle adaptation from your previous sessions actually takes place.';
        confidence = 'high';
        confidenceNote = 'High confidence — when soreness is high and energy is low, rest reliably outperforms training for beginners.';
        thingsToAvoid = ['Do not force a gym session today.', 'Avoid dehydrating beverages.'];
      }
    }
    // 4) Almost no time today or busy constraint.
    else if (s.minutes <= 15 || s.constraint === 'exam' || s.constraint === 'busy') {
      template = EXERCISE_TEMPLATES.low_time_fallback;
      summary = `Tight day (~${s.minutes} min available)${s.constraint !== 'none' ? ` with a "${s.constraint}" constraint` : ''}. Preserve the habit without zeroing out.`;
      explanation = 'On a busy or deadline-heavy day, the objective is habit preservation, not peak performance. A 10-minute session keeps your momentum intact without adding stress.';
      confidence = 'high';
      confidenceNote = 'High confidence in the habit-preservation approach. The exact exercises matter less than showing up for 10 minutes.';
      thingsToAvoid = [
        'Do not adopt an "all or nothing" mindset.',
        'Avoid scrolling social media during your scheduled workout block.'
      ];
    }
    // 5) Normal day -> Goal / Sport-Specific (Soccer) & Preference-aware template selection
    else {
      const hasGym = s.equipment.includes('gym');
      const hasDumbbells = s.equipment.includes('dumbbells');
      const strongDay = r >= 6.0;

      if (s.goal === 'soccer') {
        template = EXERCISE_TEMPLATES.soccer_performance;
      } else if (hasGym) {
        template = EXERCISE_TEMPLATES.beginner_gym_full_body;
      } else if (hasDumbbells) {
        template = EXERCISE_TEMPLATES.upper_body_basics;
      } else {
        template = EXERCISE_TEMPLATES.beginner_home_full_body;
      }

      if (prevCompletion && prevCompletion.status === 'completed') {
        summary = `Strong momentum: yesterday's workout completed and readiness is ${r}/10 today.`;
        explanation = `You completed your last session, and today's check-in shows solid readiness (${r}/10). ${template.title} remains the most reliable path toward ${goalLabel(s.goal)}.`;
      } else if (prevCompletion && prevCompletion.status === 'skipped') {
        summary = `Fresh start after yesterday's skipped session. Readiness is ${r}/10 today.`;
        explanation = `Missing one session is normal; what matters is resuming the habit today. We scheduled this session at ${s.dedicatedTime} to make starting low-friction.`;
        followUpQuestion = prevCompletion.reason ? null : 'What was the main reason yesterday\'s workout slipped?';
      } else {
        summary = strongDay
          ? `Solid readiness today (${r}/10): sleep and energy are in your favor.`
          : `Middling readiness (${r}/10). Good enough for consistent work, not a day to push limits.`;
        explanation = strongDay
          ? `Your inputs show good recovery, making today ideal for quality work toward ${goalLabel(s.goal)}.`
          : `Your signals are moderate, so follow today's template at 80% effort. Consistency beats occasional heroics.`;
      }

      confidence = strongDay ? 'high' : 'medium';
      confidenceNote = strongDay
        ? 'High confidence — for beginners and returning athletes, consistent basics is the most evidence-backed strategy.'
        : 'Medium confidence — your signals are mixed, so this represents a steady middle path.';
      thingsToAvoid = [
        'Avoid changing exercises set-to-set; stick to the basics.',
        'Do not skip warm-up sets if lifting weights.'
      ];
    }

    if (entryCount <= 1) {
      confidenceNote += ' Note: As one of your first check-ins, recommendations will become more personalized as your completion logs build.';
      if (confidence === 'high') confidence = 'medium';
    }

    if (s.hasProfileInjury && !s.hasInjuryFlag) {
      const note = `You noted in your profile: "${profile.injuryNotes.trim()}". Do not load this area with any pain.`;
      caution = caution ? caution + ' ' + note : note;
      if (!thingsToAvoid.includes(note)) thingsToAvoid.push(note);
    }

    // Weave preferred exercises into the workout routine if user saved any
    let finalExercises = template ? [...(template.exercises || [])] : [];
    if (s.preferredExercises && s.preferredExercises.length > 0 && finalExercises.length > 0) {
      // Add up to 2 preferred exercises to the routine if not already present
      s.preferredExercises.slice(0, 2).forEach((pref) => {
        if (!finalExercises.some((ex) => ex.id === pref.id || ex.name.toLowerCase() === pref.name.toLowerCase())) {
          finalExercises.unshift({
            id: pref.id || 'wx-custom',
            name: pref.name,
            sets: 3,
            reps: '10–12 reps',
            rest: '60–90s',
            formCue: 'Perform with smooth, controlled form',
            bodyPart: pref.bodyPart || 'full body',
            target: pref.target || 'general',
            gifUrl: pref.gifUrl || 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80',
          });
        }
      });
    }

    const whyChanged = explainChange(s, prevEntry, prevCompletion);

    const workoutObj = template ? {
      title: template.title,
      detail: template.detail,
      durationMinutes: template.durationMinutes,
      type: template.type || 'strength',
      exercises: finalExercises,
    } : null;

    const todaySchedule = generateTimeBlocks(s, workoutObj, isRestDay, profile);
    const sevenDayPlan = generateSevenDayPlan(profile);

    return {
      summary,
      readinessScore: r,
      todaySchedule,
      workout: workoutObj,
      nutrition: {
        title: 'Protein & Hydration Focus',
        detail: `Aim for 20–30g of protein at your next meal to support ${goalLabel(s.goal)}. Drink water with every meal.`,
      },
      sleep: {
        title: `Sleep Target (${profile?.sleepSchedule || '22:00'} Bedtime)`,
        detail: 'Aim for 7–8 hours of quality sleep tonight to maximize muscular and mental recovery.',
        targetBedtime: profile?.sleepSchedule === 'before-22' ? '21:30' : '22:30',
        targetWakeTime: profile?.wakeTimeTarget || '07:00 AM',
        windDownAction: 'Disconnect from phones 30-45 minutes before bed; perform gentle mobility or breathing.',
      },
      habits: [
        {
          title: 'Bedtime Consistency & Wind-Down',
          detail: 'Set an alarm for your 30-minute phone cutoff before bed tonight.',
        },
        {
          title: 'Dedicated Workout Window',
          detail: `Protect your ${s.dedicatedTime} slot from scheduling conflicts today.`,
        }
      ],
      explanation,
      thingsToAvoid,
      whyChanged,
      followUpQuestion,
      confidence,
      confidenceNote,
      sevenDayPlan,
      structuredData: {
        signals: s,
        readiness: r,
        engine: 'local-rules-v0.3',
        templateId: template ? template.id : 'none',
      },
      // Backward-compat v0.1 fields:
      mainAction: workoutObj ? workoutObj.title : 'Take a recovery day: easy walk only',
      detail: workoutObj ? workoutObj.detail : '15–20 minutes of light outdoor walking.',
      supportAction: `Protect your ${s.dedicatedTime} time slot and get protein at dinner.`,
      reason: explanation,
      caution,
    };
  }

  // ---------- Normalization & Backward Compatibility ----------

  function normalizeRecommendation(rec, profile, checkin, prevEntry, context = {}) {
    if (!rec || typeof rec !== 'object') {
      return localEngine(profile, checkin, prevEntry, context.entryCount || 1, context);
    }

    const s = readSignals(profile || {}, checkin || {});
    const r = typeof rec.readinessScore === 'number' ? rec.readinessScore : readiness(s);

    let workoutObj = rec.workout;
    if (!workoutObj && rec.mainAction && !/rest|recovery/i.test(rec.mainAction)) {
      workoutObj = {
        title: rec.mainAction,
        detail: rec.detail || '',
        durationMinutes: 30,
        type: 'strength',
        exercises: [],
      };
    }

    // Ensure exercises array exists and has well-formed items
    if (workoutObj) {
      if (!Array.isArray(workoutObj.exercises) || workoutObj.exercises.length === 0) {
        // Build default exercises list from known template or general basics
        const tMatch = Object.values(EXERCISE_TEMPLATES).find((t) => t.title === workoutObj.title);
        workoutObj.exercises = tMatch ? [...tMatch.exercises] : [
          { id: 'wx-002', name: 'Goblet Squat', sets: 3, reps: '10–12', rest: '90s', formCue: 'Keep weight close to chest', bodyPart: 'legs', target: 'quadriceps', gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80' },
          { id: 'wx-003', name: 'Standard Push-up', sets: 3, reps: '8–12', rest: '60s', formCue: 'Brace core and glutes', bodyPart: 'chest', target: 'pectorals', gifUrl: 'https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=400&q=80' },
          { id: 'wx-007', name: 'Forearm Plank', sets: 3, reps: '30 sec hold', rest: '60s', formCue: 'Breathe steadily, hips level', bodyPart: 'core', target: 'rectus abdominis', gifUrl: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=400&q=80' }
        ];
      }
    }

    const todaySchedule = Array.isArray(rec.todaySchedule) && rec.todaySchedule.length > 0
      ? rec.todaySchedule
      : generateTimeBlocks(s, workoutObj, !workoutObj, profile);

    const sevenDayPlan = Array.isArray(rec.sevenDayPlan) && rec.sevenDayPlan.length > 0
      ? rec.sevenDayPlan
      : generateSevenDayPlan(profile);

    const thingsToAvoid = Array.isArray(rec.thingsToAvoid)
      ? rec.thingsToAvoid
      : (rec.caution ? [rec.caution] : []);

    const habits = Array.isArray(rec.habits) && rec.habits.length > 0
      ? rec.habits
      : (rec.supportAction ? [{ title: 'Daily Habit', detail: rec.supportAction }] : [{ title: 'Bedtime Consistency', detail: 'Disconnect from screens 30 minutes before bed.' }]);

    const explanation = rec.explanation || rec.reason || 'Curated recommendation based on your profile and check-in signals.';

    return {
      summary: rec.summary || 'Your state today',
      readinessScore: r,
      todaySchedule,
      workout: workoutObj || null,
      nutrition: rec.nutrition || {
        title: 'Daily Nutrition',
        detail: `Prioritize protein and whole foods to support ${goalLabel(s.goal)}.`,
      },
      sleep: rec.sleep || {
        title: `Sleep Target (${profile?.sleepSchedule || '22:00'} Bedtime)`,
        detail: 'Aim for 7–8 hours of consistent sleep tonight.',
        targetBedtime: profile?.sleepSchedule === 'before-22' ? '21:30' : '22:30',
        targetWakeTime: profile?.wakeTimeTarget || '07:00 AM',
        windDownAction: 'Disconnect from phones 30-45 minutes before bed; perform gentle mobility.',
      },
      habits,
      explanation,
      thingsToAvoid,
      whyChanged: rec.whyChanged !== undefined ? rec.whyChanged : explainChange(s, prevEntry, context.prevCompletion),
      followUpQuestion: rec.followUpQuestion || null,
      confidence: ['high', 'medium', 'low'].includes(rec.confidence) ? rec.confidence : 'medium',
      confidenceNote: rec.confidenceNote || 'Medium confidence — recommendation based on your check-in.',
      sevenDayPlan,
      structuredData: rec.structuredData || { signals: s, readiness: r, engine: 'normalized' },
      // Backward-compat v0.1 fields:
      mainAction: workoutObj ? workoutObj.title : (rec.mainAction || 'Active Recovery Walk'),
      detail: workoutObj ? workoutObj.detail : (rec.detail || 'Light easy walk.'),
      supportAction: habits[0] ? habits[0].detail : (rec.supportAction || ''),
      reason: explanation,
      caution: rec.caution || (thingsToAvoid.length > 0 ? thingsToAvoid.join(' ') : null),
    };
  }

  // ---------- LLM API Caller ----------

  async function callLLM(profile, checkin, prevEntry, entryCount, context = {}) {
    try {
      if (typeof Store !== 'undefined' && Store.logDebug) {
        Store.logDebug('AI-Request', 'Requesting recommendation from /api/coach', { profile, checkin, entryCount });
      }
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, checkin, prevEntry, entryCount, context }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data && data.ok && data.recommendation) {
        if (typeof Store !== 'undefined' && Store.logDebug) {
          Store.logDebug('AI-Response', 'Successful Gemini API response', data.recommendation);
        }
        return normalizeRecommendation(data.recommendation, profile, checkin, prevEntry, { ...context, entryCount });
      } else {
        throw new Error(data?.error || 'AI response indicated fallback or missing data');
      }
    } catch (err) {
      if (typeof Store !== 'undefined' && Store.logDebug) {
        Store.logDebug('AI-Fallback', `AI unavailable or validation failed (${err.message}). Activating local fallback rules engine.`);
      }
      return localEngine(profile, checkin, prevEntry, entryCount, context);
    }
  }

  // ---------- Public Generate API ----------

  async function generate(profile, checkin, prevEntry, entryCount, context = {}) {
    if (provider === 'llm' || provider === 'auto') {
      return callLLM(profile, checkin, prevEntry, entryCount, context);
    }
    await new Promise((r) => setTimeout(r, 600));
    const raw = localEngine(profile, checkin, prevEntry, entryCount, context);
    return normalizeRecommendation(raw, profile, checkin, prevEntry, { ...context, entryCount });
  }

  return {
    generate,
    normalizeRecommendation,
    localEngine,
    getTemplates: () => EXERCISE_TEMPLATES,
    get provider() { return provider; },
    set provider(v) { provider = v; },
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Coach;
}
