/* ============================================================
   Striate — coach.js
   Adaptive recommendation engine for Striate.
   - Sleep-first daily schedule
   - Memory + progression aware
   - WorkoutX-compatible exercise references
   - Honest, low-friction coaching
============================================================ */

const Coach = (() => {
  let provider = 'auto'; // 'auto' | 'local' | 'llm'

  const EXERCISE_TEMPLATES = {
    beginner_gym_full_body: {
      id: 'beginner_gym_full_body',
      title: 'Gym Full-Body Basics',
      durationMinutes: 40,
      type: 'strength',
      trainingMethod: 'Gym machines',
      detail: '3 quality sets each. Nothing fancy. Keep 1–2 reps in reserve and stop short of grindy reps.',
      exercises: [
        { id: 'wx-002', exerciseId: 'wx-002', name: 'Goblet Squat', sets: 3, reps: '8-12', rest: '90s', formCue: 'Keep the weight close and let knees track naturally.', bodyPart: 'legs', target: 'quadriceps', equipment: 'dumbbell', gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-017', exerciseId: 'wx-017', name: 'Dumbbell Bench Press', sets: 3, reps: '8-12', rest: '90s', formCue: 'Lower under control and keep feet planted.', bodyPart: 'chest', target: 'pectorals', equipment: 'dumbbell', gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-018', exerciseId: 'wx-018', name: 'Lat Pulldown (Gym Machine)', sets: 3, reps: '8-12', rest: '90s', formCue: 'Drive elbows down without leaning back hard.', bodyPart: 'back', target: 'lats', equipment: 'gym', gifUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-020', exerciseId: 'wx-020', name: 'Dead Bug (Core Stability)', sets: 2, reps: '8 / side', rest: '45s', formCue: 'Keep lower back pinned to the floor.', bodyPart: 'core', target: 'rectus abdominis', equipment: 'body weight', gifUrl: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=400&q=80' },
      ],
    },
    beginner_home_full_body: {
      id: 'beginner_home_full_body',
      title: 'Home Full-Body Basics',
      durationMinutes: 30,
      type: 'strength',
      trainingMethod: 'Dumbbell basics',
      detail: '2–3 rounds. Keep setup minimal and stop while form is still clean.',
      exercises: [
        { id: 'wx-001', exerciseId: 'wx-001', name: 'Bodyweight Squat', sets: 3, reps: '10-15', rest: '60s', formCue: 'Sit down and stand up with your whole foot planted.', bodyPart: 'legs', target: 'quadriceps', equipment: 'body weight', gifUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-004', exerciseId: 'wx-004', name: 'Incline Push-up', sets: 3, reps: '8-12', rest: '60s', formCue: 'Keep ribcage tucked and body in one line.', bodyPart: 'chest', target: 'pectorals', equipment: 'body weight', gifUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-006', exerciseId: 'wx-006', name: 'Glute Bridge', sets: 3, reps: '12-15', rest: '60s', formCue: 'Squeeze glutes at the top, don’t arch your back.', bodyPart: 'glutes', target: 'gluteus maximus', equipment: 'body weight', gifUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-007', exerciseId: 'wx-007', name: 'Forearm Plank', sets: 2, reps: '20-30 sec', rest: '45s', formCue: 'Brace abs and keep hips level.', bodyPart: 'core', target: 'rectus abdominis', equipment: 'body weight', gifUrl: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=400&q=80' },
      ],
    },
    dumbbell_strength: {
      id: 'dumbbell_strength',
      title: 'Dumbbell Strength Basics',
      durationMinutes: 35,
      type: 'strength',
      trainingMethod: 'Dumbbell basics',
      detail: 'Simple dumbbell work. Full-body stimulus, minimal exercise variety.',
      exercises: [
        { id: 'wx-002', exerciseId: 'wx-002', name: 'Goblet Squat', sets: 3, reps: '8-12', rest: '90s', formCue: 'Stay tall and let elbows travel inside knees.', bodyPart: 'legs', target: 'quadriceps', equipment: 'dumbbell', gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-005', exerciseId: 'wx-005', name: 'Dumbbell One-Arm Row', sets: 3, reps: '8-12 / side', rest: '75s', formCue: 'Pull toward your hip, not your shoulder.', bodyPart: 'back', target: 'lats', equipment: 'dumbbell', gifUrl: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-009', exerciseId: 'wx-009', name: 'Dumbbell Overhead Press', sets: 2, reps: '8-10', rest: '75s', formCue: 'Brace hard and avoid leaning back.', bodyPart: 'shoulders', target: 'anterior deltoid', equipment: 'dumbbell', gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-016', exerciseId: 'wx-016', name: 'Dumbbell Romanian Deadlift (RDL)', sets: 3, reps: '8-12', rest: '90s', formCue: 'Push hips back and keep dumbbells close.', bodyPart: 'legs', target: 'hamstrings', equipment: 'dumbbell', gifUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=400&q=80' },
      ],
    },
    low_time_fallback: {
      id: 'low_time_fallback',
      title: '10-Minute Minimum Dose',
      durationMinutes: 10,
      type: 'strength',
      trainingMethod: 'Short circuits',
      detail: 'This is not a heroic workout. It is the minimum useful session so the habit doesn’t disappear.',
      exercises: [
        { id: 'wx-001', exerciseId: 'wx-001', name: 'Bodyweight Squat', sets: 2, reps: '10', rest: '30s', formCue: 'Smooth reps. No rush.', bodyPart: 'legs', target: 'quadriceps', equipment: 'body weight', gifUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-004', exerciseId: 'wx-004', name: 'Incline Push-up', sets: 2, reps: '6-10', rest: '30s', formCue: 'Pick a height where reps stay clean.', bodyPart: 'chest', target: 'pectorals', equipment: 'body weight', gifUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-020', exerciseId: 'wx-020', name: 'Dead Bug (Core Stability)', sets: 2, reps: '6 / side', rest: '30s', formCue: 'Exhale as the leg extends.', bodyPart: 'core', target: 'rectus abdominis', equipment: 'body weight', gifUrl: 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=400&q=80' },
      ],
    },
    recovery_day: {
      id: 'recovery_day',
      title: 'Sleep-First Recovery Day',
      durationMinutes: 20,
      type: 'recovery',
      trainingMethod: 'Walking',
      detail: 'Keep today easy on purpose. Walking and gentle mobility are enough when sleep or recovery is poor.',
      exercises: [
        { id: 'wx-010', exerciseId: 'wx-010', name: 'Brisk Outdoor Walk', sets: 1, reps: '15-20 min', rest: '0s', formCue: 'Keep the pace conversational.', bodyPart: 'cardio', target: 'cardiovascular system', equipment: 'body weight', gifUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-022', exerciseId: 'wx-022', name: 'Gentle Mobility & Wind-down Stretch', sets: 1, reps: '5-8 min', rest: '0s', formCue: 'Long exhale, zero strain.', bodyPart: 'full body', target: 'mobility', equipment: 'body weight', gifUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80' },
      ],
    },
    light_cardio_walk: {
      id: 'light_cardio_walk',
      title: 'Walk + Reset',
      durationMinutes: 25,
      type: 'cardio',
      trainingMethod: 'Walking',
      detail: 'Useful when energy is okay but recovery is not great. Move, don’t grind.',
      exercises: [
        { id: 'wx-010', exerciseId: 'wx-010', name: 'Brisk Outdoor Walk', sets: 1, reps: '25 min', rest: '0s', formCue: 'Nasal breathing if comfortable.', bodyPart: 'cardio', target: 'cardiovascular system', equipment: 'body weight', gifUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=400&q=80' },
      ],
    },
    soccer_performance: {
      id: 'soccer_performance',
      title: 'Soccer Agility + Strength',
      durationMinutes: 35,
      type: 'soccer',
      trainingMethod: 'Soccer footwork',
      detail: 'Plyometric quality matters more than volume. Stop when contacts get sloppy.',
      exercises: [
        { id: 'wx-011', exerciseId: 'wx-011', name: 'Pogo Jumps (Ankle Stiffness & Agility)', sets: 3, reps: '20 sec', rest: '45s', formCue: 'Quick off the floor. Minimal knee bend.', bodyPart: 'calves', target: 'gastrocnemius', equipment: 'body weight', gifUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-012', exerciseId: 'wx-012', name: 'Lateral Skater Bounds (Soccer Agility)', sets: 3, reps: '8 / side', rest: '60s', formCue: 'Stick the landing before the next rep.', bodyPart: 'legs', target: 'abductors', equipment: 'body weight', gifUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-013', exerciseId: 'wx-013', name: 'Spanish Squat (Tendon Isometric)', sets: 3, reps: '30-45 sec', rest: '60s', formCue: 'Keep shins vertical and tension steady.', bodyPart: 'legs', target: 'patellar tendon', equipment: 'bands', gifUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80' },
        { id: 'wx-014', exerciseId: 'wx-014', name: 'Nordic Hamstring Curl (Eccentric Soccer Strength)', sets: 2, reps: '4-6', rest: '90s', formCue: 'Control the lowering phase as long as possible.', bodyPart: 'legs', target: 'hamstrings', equipment: 'body weight', gifUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=400&q=80' },
      ],
    },
  };

  const EXERCISE_POOL = Object.values(EXERCISE_TEMPLATES)
    .flatMap((template) => template.exercises)
    .reduce((acc, exercise) => {
      if (!acc.some((item) => item.id === exercise.id)) acc.push(exercise);
      return acc;
    }, []);

  const SLEEP_MAP = { '<5': 4, '5-6': 5.5, '6-7': 6.5, '7-8': 7.5, '8+': 8.5 };
  const TIME_MAP = { '0-15': 12, '15-30': 25, '30-45': 40, '45-60': 55, '60+': 70 };
  const BEDTIME_PENALTY = { on_target: 0, '30_late': 0.25, '60_late': 0.6, '90_late': 1.0, irregular: 1.2 };

  function labelList(items = []) {
    return items
      .map((item) => typeof item === 'string' ? item : item?.name)
      .filter(Boolean);
  }

  function goalLabel(goal) {
    return {
      strength: 'building strength',
      muscle: 'building muscle',
      fat_loss: 'fat loss',
      fitness: 'general fitness',
      energy: 'daily energy',
      soccer: 'soccer performance',
    }[goal] || 'general fitness';
  }

  function parseClock(label) {
    const match = String(label || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let hours = Number(match[1]) % 12;
    const minutes = Number(match[2]);
    const meridian = match[3].toUpperCase();
    if (meridian === 'PM') hours += 12;
    return hours * 60 + minutes;
  }

  function formatClock(totalMinutes) {
    let mins = Number(totalMinutes);
    while (mins < 0) mins += 1440;
    mins %= 1440;
    const hours24 = Math.floor(mins / 60);
    const minutes = mins % 60;
    const meridian = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = ((hours24 + 11) % 12) + 1;
    return `${hours12}:${String(minutes).padStart(2, '0')} ${meridian}`;
  }

  function shiftClock(label, deltaMinutes) {
    const parsed = parseClock(label);
    if (parsed == null) return label;
    return formatClock(parsed + deltaMinutes);
  }

  function bedtimeTarget(signals) {
    if (signals.sleepSchedule === 'before-22') return '9:45 PM';
    if (signals.sleepSchedule === '22-23') return '10:30 PM';
    if (signals.sleepSchedule === '23-24') return '11:15 PM';
    if (signals.sleepSchedule === 'after-24') return '12:15 AM';
    if (signals.wakeTimeTarget === '6:00 AM') return '10:00 PM';
    if (signals.wakeTimeTarget === '8:00 AM') return '11:00 PM';
    return '10:45 PM';
  }

  function dedicatedWindow(label) {
    const value = String(label || '5-6 PM');
    if (value.includes('7-8 AM')) return ['7:00 AM', '8:00 AM'];
    if (value.includes('12-1 PM')) return ['12:15 PM', '1:00 PM'];
    if (value.includes('30-after-school') || /after school|after work/i.test(value)) return ['3:45 PM', '4:30 PM'];
    if (value.includes('6-7 PM')) return ['6:00 PM', '7:00 PM'];
    if (value.includes('5-6 PM')) return ['5:00 PM', '6:00 PM'];

    const times = value.match(/\d{1,2}:\d{2}\s*(?:AM|PM)/gi);
    if (times?.length >= 2) return [times[0].toUpperCase(), times[1].toUpperCase()];
    if (times?.length === 1) return [times[0].toUpperCase(), shiftClock(times[0].toUpperCase(), 45)];
    return ['5:30 PM', '6:15 PM'];
  }

  function normalizeExercise(exercise = {}) {
    return {
      exerciseId: String(exercise.exerciseId || exercise.id || ''),
      id: String(exercise.id || exercise.exerciseId || ''),
      name: String(exercise.name || 'Exercise'),
      sets: exercise.sets ?? 3,
      reps: exercise.reps ?? '8-12',
      rest: String(exercise.rest || '60s'),
      formCue: String(exercise.formCue || 'Controlled form.'),
      bodyPart: String(exercise.bodyPart || 'general'),
      target: String(exercise.target || 'general'),
      equipment: String(exercise.equipment || 'body weight'),
      gifUrl: String(exercise.gifUrl || 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80'),
    };
  }

  function readSignals(profile = {}, checkin = {}) {
    const preferredExercises = Array.isArray(profile.preferences?.preferredExercises)
      ? profile.preferences.preferredExercises
      : [];
    const avoidedExercises = Array.isArray(profile.preferences?.avoidedExercises)
      ? profile.preferences.avoidedExercises
      : [];
    const dislikedSuggestions = Array.isArray(profile.preferences?.dislikedSuggestions)
      ? profile.preferences.dislikedSuggestions
      : [];
    const trainingMethods = Array.isArray(profile.preferences?.trainingMethods)
      ? profile.preferences.trainingMethods
      : [];

    return {
      sleepHrs: SLEEP_MAP[checkin.sleep] ?? 7,
      sleepQuality: Number(checkin.sleepQuality) || 3,
      bedtimeConsistency: checkin.bedtimeConsistency || 'on_target',
      screenCutoff: checkin.screenCutoff || 'some',
      energy: Number(checkin.energy) || 3,
      soreness: Number(checkin.soreness) || 2,
      mood: Number(checkin.mood) || 3,
      minutes: TIME_MAP[checkin.timeAvailable] ?? 40,
      dedicatedTime: checkin.dedicatedWorkoutTime || profile.dedicatedWorkoutTime || '5-6 PM',
      constraint: checkin.specialConstraint || 'none',
      hasInjuryFlag:
        checkin.specialConstraint === 'injury' ||
        /injur|pain|hurt|sharp|swollen/i.test(checkin.extraNote || ''),
      hasProfileInjury: !!String(profile.injuryNotes || '').trim(),
      goal: profile.goal || 'fitness',
      experience: profile.experienceLevel || 'new',
      equipment: Array.isArray(profile.equipment) ? profile.equipment : [],
      wakeTimeTarget: profile.wakeTimeTarget || '7:00 AM',
      sleepSchedule: profile.sleepSchedule || '22-23',
      deviceCutoffMinutes: Number(profile.deviceCutoffMinutes || profile.preferences?.deviceCutoffMinutes || 30) || 30,
      extraNote: checkin.extraNote || '',
      preferredExercises,
      avoidedExercises,
      dislikedSuggestions,
      trainingMethods,
      scheduleNotes: String(profile.preferences?.scheduleNotes || '').trim(),
      coachingConstraints: String(profile.preferences?.coachingConstraints || '').trim(),
    };
  }

  function readiness(signals) {
    let score = 5.2;
    score += (signals.sleepHrs - 7) * 0.95;
    score += (signals.sleepQuality - 3) * 0.65;
    score += (signals.energy - 3) * 0.9;
    score -= (signals.soreness - 2) * 0.75;
    score += (signals.mood - 3) * 0.35;
    score -= BEDTIME_PENALTY[signals.bedtimeConsistency] || 0;
    if (signals.screenCutoff === 'no') score -= 0.45;
    else if (signals.screenCutoff === 'some') score -= 0.15;
    return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  }

  function isPoorSleep(signals) {
    return (
      signals.sleepHrs < 6.5 ||
      signals.sleepQuality <= 2 ||
      signals.bedtimeConsistency === '90_late' ||
      signals.bedtimeConsistency === 'irregular'
    );
  }

  function recentFrictionFeedback(signals) {
    return (signals.dislikedSuggestions || []).find((item) =>
      /annoy|unrealistic|too demanding|not realistic|too much|too long/i.test(String(item.reason || item.note || ''))
    ) || null;
  }

  function usesMethod(signals, keyword) {
    return labelList(signals.trainingMethods).some((name) => name.toLowerCase().includes(keyword));
  }

  function cloneTemplate(template) {
    return template
      ? {
          ...template,
          exercises: (template.exercises || []).map((exercise) => ({ ...exercise })),
        }
      : null;
  }

  function pickTemplate(signals, score, prevCompletion, weeklyReview) {
    const hasGym = signals.equipment.includes('gym');
    const hasDumbbells = signals.equipment.includes('dumbbells');
    const poorSleep = isPoorSleep(signals);
    const friction = recentFrictionFeedback(signals);

    if (signals.goal === 'soccer' && !poorSleep && signals.minutes >= 30) {
      return cloneTemplate(EXERCISE_TEMPLATES.soccer_performance);
    }

    if (signals.minutes <= 15 || signals.constraint === 'busy' || signals.constraint === 'exam') {
      return cloneTemplate(EXERCISE_TEMPLATES.low_time_fallback);
    }

    if (poorSleep || (signals.energy <= 2 && signals.soreness >= 3)) {
      return cloneTemplate(EXERCISE_TEMPLATES.recovery_day);
    }

    if (signals.soreness >= 4) {
      return cloneTemplate(EXERCISE_TEMPLATES.light_cardio_walk);
    }

    if (usesMethod(signals, 'walking') && score < 6.6) {
      return cloneTemplate(EXERCISE_TEMPLATES.light_cardio_walk);
    }

    if (hasGym && (usesMethod(signals, 'machine') || !hasDumbbells)) {
      return cloneTemplate(EXERCISE_TEMPLATES.beginner_gym_full_body);
    }

    if (hasDumbbells) {
      return cloneTemplate(EXERCISE_TEMPLATES.dumbbell_strength);
    }

    let template = cloneTemplate(EXERCISE_TEMPLATES.beginner_home_full_body);

    if ((weeklyReview?.skipped || 0) >= 2 || friction) {
      template = cloneTemplate(EXERCISE_TEMPLATES.low_time_fallback);
    }

    if (prevCompletion?.status === 'skipped' && signals.minutes < 35) {
      template = cloneTemplate(EXERCISE_TEMPLATES.low_time_fallback);
    }

    return template;
  }

  function findReplacementExercise(exercise, avoidedIds, usedIds, allowCardio = true) {
    return EXERCISE_POOL
      .map(normalizeExercise)
      .find((candidate) => {
        if (!candidate.id || avoidedIds.has(candidate.id) || usedIds.has(candidate.id)) return false;
        if (!allowCardio && candidate.bodyPart === 'cardio') return false;
        if (exercise.bodyPart && candidate.bodyPart === exercise.bodyPart) return true;
        if (exercise.target && candidate.target === exercise.target) return true;
        return false;
      }) || null;
  }

  function trimForReality(template, signals) {
    if (!template) return null;
    const friction = recentFrictionFeedback(signals);
    const scheduleNotes = String(signals.scheduleNotes || '').toLowerCase();
    const needsTrim = friction || /too long|too much setup|complicated|annoy/i.test(scheduleNotes);
    if (!needsTrim) return template;

    const trimmedExercises = (template.exercises || []).slice(0, Math.min(3, template.exercises.length));
    return {
      ...template,
      title: template.type === 'recovery' ? template.title : `${template.title} — trimmed`,
      durationMinutes: Math.max(10, Math.min(template.durationMinutes, signals.minutes, template.durationMinutes - 10)),
      detail: `This is a shorter version because you previously said longer or more annoying plans were unrealistic. ${template.detail}`,
      exercises: trimmedExercises,
    };
  }

  function applyMemoryToWorkout(template, signals) {
    if (!template) return null;

    const avoidedIds = new Set((signals.avoidedExercises || []).map((item) => String(item.id || '')));
    const preferred = (signals.preferredExercises || []).map(normalizeExercise).filter((item) => item.id || item.name);
    let exercises = (template.exercises || []).map(normalizeExercise);

    // Remove avoided exercises and swap if possible.
    const usedIds = new Set();
    exercises = exercises.reduce((list, exercise) => {
      if (exercise.id && avoidedIds.has(exercise.id)) {
        const replacement = findReplacementExercise(exercise, avoidedIds, usedIds, template.type !== 'strength');
        if (replacement) {
          usedIds.add(replacement.id);
          list.push(replacement);
        }
        return list;
      }
      usedIds.add(exercise.id);
      list.push(exercise);
      return list;
    }, []);

    // Weave in 1–2 preferred exercises if they aren't avoided.
    preferred.slice(0, 2).forEach((exercise) => {
      if (!exercise.id || avoidedIds.has(exercise.id)) return;
      if (exercises.some((item) => item.id === exercise.id || item.name.toLowerCase() === exercise.name.toLowerCase())) return;
      exercises.unshift({
        ...exercise,
        exerciseId: exercise.id,
        sets: 2,
        reps: exercise.bodyPart === 'cardio' ? '10-15 min' : '8-12',
        rest: exercise.bodyPart === 'cardio' ? '0s' : '60-90s',
        formCue: exercise.formCue || 'Use the version you already know you can do cleanly.',
      });
    });

    if (signals.minutes <= 20 && exercises.length > 3) {
      exercises = exercises.slice(0, 3);
    }

    return {
      ...template,
      durationMinutes: Math.min(template.durationMinutes, signals.minutes > 0 ? Math.max(signals.minutes, template.durationMinutes) : template.durationMinutes),
      exercises,
    };
  }

  function whyChanged(signals, prevEntry, prevCompletion) {
    if (!prevEntry) return null;

    const notes = [];
    const prevCheckin = prevEntry.checkin || {};
    const prevSleep = SLEEP_MAP[prevCheckin.sleep] ?? 7;
    const prevQuality = Number(prevCheckin.sleepQuality) || 3;

    if (prevCompletion?.status === 'completed') notes.push('you completed yesterday\'s workout');
    if (prevCompletion?.status === 'partial') notes.push('you only got a partial session done yesterday');
    if (prevCompletion?.status === 'skipped') notes.push(`yesterday\'s workout was skipped${prevCompletion.reason ? ` (${prevCompletion.reason})` : ''}`);

    if (signals.sleepHrs < prevSleep - 0.75) notes.push('sleep dropped versus your last check-in');
    else if (signals.sleepHrs > prevSleep + 0.75) notes.push('sleep improved versus your last check-in');

    if (signals.sleepQuality < prevQuality) notes.push('sleep quality was worse');
    else if (signals.sleepQuality > prevQuality) notes.push('sleep quality was better');

    if (signals.energy < (Number(prevCheckin.energy) || 3)) notes.push('energy is lower');
    if (signals.soreness > (Number(prevCheckin.soreness) || 2)) notes.push('soreness is higher');
    if (signals.constraint !== 'none' && signals.constraint !== (prevCheckin.specialConstraint || 'none')) notes.push(`today includes a ${signals.constraint} constraint`);
    if ((signals.avoidedExercises || []).length) notes.push('exercises you asked to avoid were filtered out');
    if ((signals.trainingMethods || []).length) notes.push('saved training method preferences were used');
    if (recentFrictionFeedback(signals)) notes.push('the plan was trimmed because you said longer or more annoying plans were unrealistic');

    if (!notes.length) {
      return 'Nothing major changed from your last check-in, so the plan stayed on the same progression path.';
    }

    return `Recommendations changed because ${notes.join(', ')}.`;
  }

  function buildSleepObject(signals, poorSleep) {
    const targetBedtime = bedtimeTarget(signals);
    const targetWakeTime = signals.wakeTimeTarget || '7:00 AM';
    const cutoff = shiftClock(targetBedtime, -signals.deviceCutoffMinutes);
    return {
      title: poorSleep ? 'Sleep recovery is the main priority tonight' : 'Protect tonight\'s sleep window',
      detail: poorSleep
        ? 'Your sleep inputs were not good enough to justify a hard session. The next win is a consistent bedtime, device cutoff, and easier evening pace.'
        : 'A stable bedtime is part of the training plan, not a bonus habit. Treat it like a scheduled block.',
      targetBedtime,
      targetWakeTime,
      windDownAction: `Screens off by ${cutoff}. Use that window for low-light, easy movement, or reading instead of stimulation.`,
      deviceCutoffTime: cutoff,
    };
  }

  function generateTimeBlocks(signals, workout, options = {}) {
    const poorSleep = !!options.poorSleep;
    const isRestDay = !!options.isRestDay;
    const targetBedtime = bedtimeTarget(signals);
    const screenCutoffTime = shiftClock(targetBedtime, -signals.deviceCutoffMinutes);
    const windDownTime = shiftClock(targetBedtime, -Math.max(15, signals.deviceCutoffMinutes - 10));
    const wakeTime = signals.wakeTimeTarget || '7:00 AM';
    const [workoutStart, workoutEnd] = dedicatedWindow(signals.dedicatedTime);

    const blocks = [
      {
        time: wakeTime,
        title: 'Wake target + bright light',
        detail: 'Get up close to the same time and get 5–10 minutes of daylight or bright light early. That is part of fixing sleep inconsistency.',
        type: 'habit',
      },
      {
        time: shiftClock(wakeTime, 45),
        title: 'Breakfast or first protein hit',
        detail: 'Keep the first meal simple. Protein early helps make the day less chaotic later.',
        type: 'meal',
      },
    ];

    if (poorSleep) {
      blocks.push({
        time: '1:30 PM',
        title: 'Caffeine cutoff check',
        detail: 'Avoid using a late caffeine rescue if you want tonight to improve. It solves this hour and damages the next day.',
        type: 'habit',
      });
    } else if (signals.constraint === 'exam' || signals.constraint === 'busy') {
      blocks.push({
        time: '12:30 PM',
        title: 'Protect the minimum viable day',
        detail: 'Keep food and water simple. The goal is to arrive at your training block without decision fatigue.',
        type: 'habit',
      });
    } else {
      blocks.push({
        time: '12:30 PM',
        title: 'Midday reset',
        detail: 'Stand up, walk briefly, and eat something that doesn’t leave you half-asleep later.',
        type: 'meal',
      });
    }

    if (isRestDay || !workout) {
      blocks.push({
        time: `${workoutStart} — ${workoutEnd}`,
        title: 'Recovery block',
        detail: poorSleep
          ? 'Keep it to an easy walk or gentle mobility. Recovery quality matters more than forcing output today.'
          : 'Keep the body moving lightly and stop before it feels like training.',
        type: 'rest',
      });
    } else {
      blocks.push({
        time: `${workoutStart} — ${workoutEnd}`,
        title: workout.title,
        detail: workout.detail,
        type: 'workout',
      });
    }

    blocks.push({
      time: '7:00 PM',
      title: 'Dinner and downshift',
      detail: poorSleep
        ? 'Eat enough, avoid a second stimulant push, and start lowering the day\'s pace.'
        : 'Eat a normal protein-rich meal and avoid turning the evening into a second workday.',
      type: 'meal',
    });

    blocks.push({
      time: screenCutoffTime,
      title: 'Screen / device cutoff',
      detail: `Phones off or parked by ${screenCutoffTime}. If that feels annoying, that probably means it matters.`,
      type: 'sleep',
    });

    blocks.push({
      time: windDownTime,
      title: 'Wind-down routine',
      detail: poorSleep
        ? 'Low light, easy stretching, reading, or breathing. The point is to remove stimulation, not do more productivity.'
        : 'Keep the last stretch of the day boring on purpose so sleep is easier to start.',
      type: 'sleep',
    });

    blocks.push({
      time: targetBedtime,
      title: 'Target bedtime',
      detail: `Aim to be in bed by ${targetBedtime} and keep wake time near ${wakeTime} tomorrow.`,
      type: 'sleep',
    });

    return blocks;
  }

  function generateSevenDayPlan(profile = {}, weeklyReview = null) {
    const goal = profile.goal || 'fitness';
    const isSoccer = goal === 'soccer';
    const note = weeklyReview?.topBlocker
      ? `Main friction lately: ${weeklyReview.topBlocker}. Keep next week simpler than your ideal version.`
      : 'Keep the schedule simple enough that you can actually repeat it.';

    return [
      { day: 'Day 1 (Today)', focus: 'Sleep-first schedule', mainAction: 'Do today\'s plan and protect the bedtime block.', note: 'The daily schedule is the anchor, not just the workout.' },
      { day: 'Day 2', focus: isSoccer ? 'Recovery + touches' : 'Recovery + walk', mainAction: isSoccer ? 'Easy touches, mobility, and sleep consistency' : 'Easy walk or mobility and consistent wake time', note },
      { day: 'Day 3', focus: isSoccer ? 'Agility or lower-body quality' : 'Main training day', mainAction: isSoccer ? 'Short quality soccer session' : 'Return to your main lift pattern or full-body basics', note: 'Add quality, not random variety.' },
      { day: 'Day 4', focus: 'Sleep cleanup', mainAction: 'Hit the same wake time and repeat screen cutoff', note: 'Sleep inconsistency compounds fast.' },
      { day: 'Day 5', focus: isSoccer ? 'Strength support' : 'Second useful workout', mainAction: isSoccer ? 'Strength + tendon support' : 'Short repeat of basics with clean form', note: 'Keep at least 1–2 reps in reserve.' },
      { day: 'Day 6', focus: 'Low-friction movement', mainAction: 'Walk, mobility, or a short minimum dose session', note: 'This day exists to protect consistency when life gets messy.' },
      { day: 'Day 7', focus: 'Weekly review', mainAction: 'Review what was realistic, what got skipped, and what sleep did to training quality', note: 'Adjust the plan to real life before the next week starts.' },
    ];
  }

  function localEngine(profile, checkin, prevEntry, entryCount, context = {}) {
    const signals = readSignals(profile, checkin);
    const score = readiness(signals);
    const poorSleep = isPoorSleep(signals);
    const prevCompletion = context.prevCompletion || null;
    const weeklyReview = context.weeklyReview || null;
    const friction = recentFrictionFeedback(signals);

    let template = null;
    let summary = '';
    let explanation = '';
    let confidence = 'medium';
    let confidenceNote = '';
    let thingsToAvoid = [];
    let followUpQuestion = null;
    let caution = null;
    let isRestDay = false;

    if (signals.hasInjuryFlag) {
      isRestDay = true;
      template = null;
      summary = 'Pain or injury was flagged. Today is not a training-quality problem; it is a safety problem.';
      explanation = 'Do not turn a maybe-minor pain issue into a longer problem by testing it under load. Skip the workout and reduce variables.';
      confidence = 'low';
      confidenceNote = 'Low confidence — a check-in cannot assess an injury. This is a safe default, not medical advice.';
      thingsToAvoid = [
        'Do not load the painful area to see if it improves mid-session.',
        'Avoid impact, max effort, or compensating around pain.',
        'If pain is sharp, worsening, or joint-specific, get actual medical guidance.',
      ];
      caution = 'This is not medical advice.';
    } else if (poorSleep && signals.energy <= 3) {
      isRestDay = true;
      template = cloneTemplate(EXERCISE_TEMPLATES.recovery_day);
      summary = `Sleep was not good enough for a normal session (${checkin.sleep} hours, quality ${signals.sleepQuality}/5). Recovery gets priority.`;
      explanation = 'When sleep is poor, forcing intensity usually gives you a mediocre workout and a worse next day. An easier schedule is not quitting; it is the correct adaptation.';
      confidence = 'high';
      confidenceNote = 'High confidence — short or low-quality sleep is one of the cleanest reasons to reduce intensity.';
      thingsToAvoid = [
        'Do not try to “make up” bad sleep with a hard workout.',
        'Avoid caffeine late enough to interfere with tonight\'s bedtime block.',
        'Avoid keeping screens in hand once the cutoff starts.',
      ];
    } else if (signals.soreness >= 4 && signals.energy <= 3) {
      isRestDay = true;
      template = cloneTemplate(EXERCISE_TEMPLATES.light_cardio_walk);
      summary = `Recovery is lagging: soreness is ${signals.soreness}/5 and energy is ${signals.energy}/5.`;
      explanation = 'High soreness plus mediocre energy is a bad trade for a real training session. Move enough to recover, not enough to dig deeper.';
      confidence = 'high';
      confidenceNote = 'High confidence — recovery signals are pointing in the same direction.';
      thingsToAvoid = [
        'Avoid heavy eccentric work for the sore area.',
        'Do not chase sweat just to feel productive.',
      ];
    } else {
      template = pickTemplate(signals, score, prevCompletion, weeklyReview);
      template = trimForReality(template, signals);
      template = applyMemoryToWorkout(template, signals);

      if (template?.type === 'recovery' || template?.type === 'cardio') {
        isRestDay = template.type === 'recovery';
      }

      if (template?.id === 'low_time_fallback') {
        summary = `Life looks crowded today, so the plan is intentionally small.`;
        explanation = 'A short session you actually do is better than a bigger plan you skip. This is workload control, not a motivational slogan.';
        confidence = 'high';
        confidenceNote = 'High confidence — minimum useful work is the right move when time or mental bandwidth is tight.';
        thingsToAvoid = [
          'Do not wait for a perfect hour to appear.',
          'Avoid adding extra exercises just because the session feels “too easy.”',
        ];
      } else if (template?.type === 'soccer') {
        summary = `Recovery is good enough for real soccer quality work today.`;
        explanation = 'The session emphasizes agility, tendon resilience, and hamstring protection instead of random conditioning. That is the useful work for soccer, not generic exhaustion.';
        confidence = score >= 7 ? 'high' : 'medium';
        confidenceNote = 'Confidence is solid, but plyometric quality matters more than volume. Stop when contacts get sloppy.';
        thingsToAvoid = [
          'Avoid turning agility work into a fatigue contest.',
          'Do not add random extra sprints if landing quality drops.',
        ];
      } else if (template?.type === 'cardio' || template?.type === 'recovery') {
        summary = 'Today is more about restoring rhythm than forcing output.';
        explanation = 'Walking or mobility keeps the day useful while lowering recovery cost. That makes more sense than pretending every day should be a push day.';
        confidence = 'medium';
        confidenceNote = 'Medium confidence — low-intensity work is broadly safe, but your exact recovery need is still estimated from check-in data.';
        thingsToAvoid = [
          'Avoid secretly converting the recovery work into training intensity.',
          'Do not use the easier plan as permission to stay up later tonight.',
        ];
      } else {
        summary = score >= 7
          ? `Readiness is decent (${score}/10). You do not need a hype speech — just a clean session.`
          : `Readiness is workable (${score}/10). Good enough for useful training, not a max-effort day.`;
        explanation = `Today\'s plan matches your goal of ${goalLabel(signals.goal)}, your available setup, and the preferences you\'ve already saved. Simple basics remain the fastest path forward.`;
        confidence = (score >= 7 || prevCompletion?.status === 'completed') ? 'high' : 'medium';
        confidenceNote = confidence === 'high'
          ? 'High confidence — the combination of usable recovery and basic exercises is usually the right call here.'
          : 'Medium confidence — recovery is okay but not perfect, so the plan stays moderate.';
        thingsToAvoid = [
          'Avoid adding random extras because the session feels too basic.',
          'Do not take early sets to failure and ruin the rest of the workout.',
        ];
      }
    }

    if (friction && template && template.type !== 'recovery') {
      explanation += ` I also trimmed it because you previously said: “${friction.reason}.”`;
    }

    if (signals.hasProfileInjury && !signals.hasInjuryFlag) {
      const note = `Profile limitation noted: ${String(profile.injuryNotes || '').trim()}. Avoid pain-provocation in that area.`;
      thingsToAvoid.push(note);
      caution = caution ? `${caution} ${note}` : note;
    }

    if ((signals.avoidedExercises || []).length) {
      const avoidedNames = labelList(signals.avoidedExercises).slice(0, 3).join(', ');
      explanation += ` Avoided exercises were filtered out (${avoidedNames}).`;
    }

    if ((signals.trainingMethods || []).length) {
      const methods = labelList(signals.trainingMethods).slice(0, 3).join(', ');
      explanation += ` Saved method preferences in play: ${methods}.`;
    }

    if (entryCount <= 1) {
      confidence = confidence === 'high' ? 'medium' : confidence;
      confidenceNote += ' This is still one of your first check-ins, so personalization is limited until more sleep and completion data exists.';
    }

    if (prevCompletion?.status === 'skipped' && !prevCompletion.reason) {
      followUpQuestion = 'What was the main reason the last session got skipped?';
    }

    const workout = template
      ? {
          title: template.title,
          detail: template.detail,
          durationMinutes: Math.min(template.durationMinutes, Math.max(10, signals.minutes || template.durationMinutes)),
          type: template.type,
          exercises: (template.exercises || []).map(normalizeExercise),
        }
      : null;

    const todaySchedule = generateTimeBlocks(signals, workout, { poorSleep, isRestDay });
    const sleep = buildSleepObject(signals, poorSleep);
    const habits = [
      {
        title: 'Sleep cutoff',
        detail: `Start device cutoff by ${sleep.deviceCutoffTime || shiftClock(sleep.targetBedtime, -signals.deviceCutoffMinutes)} and keep the last part of the night boring.`,
      },
      {
        title: 'Dedicated training block',
        detail: `Protect ${signals.dedicatedTime} as the time you either train or do the minimum useful recovery block.`,
      },
    ];

    if (poorSleep) {
      habits.unshift({
        title: 'Morning light and consistent wake time',
        detail: `Wake near ${signals.wakeTimeTarget} and get light exposure early. That matters more than squeezing more effort out of today.`,
      });
    }

    return {
      summary,
      readinessScore: score,
      todaySchedule,
      workout,
      nutrition: {
        title: poorSleep ? 'Keep food simple' : 'Protein + hydration baseline',
        detail: poorSleep
          ? 'Do not make the day harder by under-eating and then raiding snacks late. Eat normally and get protein in early.'
          : `Get protein with your next meal and enough total food to support ${goalLabel(signals.goal)}.`,
      },
      sleep,
      habits,
      explanation,
      thingsToAvoid: [...new Set(thingsToAvoid)],
      whyChanged: whyChanged(signals, prevEntry, prevCompletion),
      followUpQuestion,
      confidence,
      confidenceNote,
      sevenDayPlan: generateSevenDayPlan(profile, weeklyReview),
      structuredData: {
        signals,
        readiness: score,
        engine: 'local-rules-v2',
        poorSleepMode: poorSleep,
        templateId: template?.id || 'none',
        memoryApplied: {
          preferredExercises: labelList(signals.preferredExercises),
          avoidedExercises: labelList(signals.avoidedExercises),
          trainingMethods: labelList(signals.trainingMethods),
        },
      },
      mainAction: workout ? workout.title : 'Recovery only',
      detail: workout ? workout.detail : 'Reduce load and protect sleep.',
      supportAction: habits[0]?.detail || '',
      reason: explanation,
      caution,
    };
  }

  function normalizeRecommendation(rec, profile, checkin, prevEntry, context = {}) {
    if (!rec || typeof rec !== 'object') {
      return localEngine(profile, checkin, prevEntry, context.entryCount || 1, context);
    }

    const signals = readSignals(profile || {}, checkin || {});
    const score = typeof rec.readinessScore === 'number' ? rec.readinessScore : readiness(signals);
    const poorSleep = isPoorSleep(signals);

    const normalizeExercises = (list) => Array.isArray(list)
      ? list.map(normalizeExercise).filter((item) => item.id || item.name)
      : [];

    let workout = rec.workout && typeof rec.workout === 'object'
      ? {
          title: String(rec.workout.title || rec.mainAction || 'Workout'),
          detail: String(rec.workout.detail || rec.detail || ''),
          durationMinutes: Number(rec.workout.durationMinutes || 30),
          type: String(rec.workout.type || 'strength'),
          exercises: normalizeExercises(rec.workout.exercises),
        }
      : null;

    if (!workout && rec.mainAction && !/rest|recovery|injury/i.test(String(rec.mainAction))) {
      workout = {
        title: String(rec.mainAction),
        detail: String(rec.detail || ''),
        durationMinutes: 30,
        type: 'strength',
        exercises: [],
      };
    }

    if (workout && workout.exercises.length === 0) {
      const localFallback = localEngine(profile, checkin, prevEntry, context.entryCount || 1, context).workout;
      workout.exercises = localFallback?.exercises || [];
    }

    const sleep = rec.sleep && typeof rec.sleep === 'object'
      ? {
          title: String(rec.sleep.title || 'Protect sleep'),
          detail: String(rec.sleep.detail || ''),
          targetBedtime: String(rec.sleep.targetBedtime || bedtimeTarget(signals)),
          targetWakeTime: String(rec.sleep.targetWakeTime || signals.wakeTimeTarget || '7:00 AM'),
          windDownAction: String(rec.sleep.windDownAction || `Screens off ${signals.deviceCutoffMinutes} minutes before bed.`),
          deviceCutoffTime: rec.sleep.deviceCutoffTime || shiftClock(String(rec.sleep.targetBedtime || bedtimeTarget(signals)), -signals.deviceCutoffMinutes),
        }
      : buildSleepObject(signals, poorSleep);

    const habits = Array.isArray(rec.habits) && rec.habits.length
      ? rec.habits.map((item) => ({ title: String(item.title || 'Habit'), detail: String(item.detail || '') }))
      : [
          { title: 'Sleep cutoff', detail: `Start device cutoff ${signals.deviceCutoffMinutes} minutes before bed.` },
          { title: 'Dedicated training block', detail: `Protect ${signals.dedicatedTime}.` },
        ];

    const explanation = String(rec.explanation || rec.reason || 'Curated recommendation based on your profile and check-in.');
    const thingsToAvoid = Array.isArray(rec.thingsToAvoid)
      ? rec.thingsToAvoid.map(String)
      : rec.caution ? [String(rec.caution)] : [];

    return {
      summary: String(rec.summary || 'Today\'s plan'),
      readinessScore: score,
      todaySchedule: Array.isArray(rec.todaySchedule) && rec.todaySchedule.length
        ? rec.todaySchedule.map((item) => ({
            time: String(item.time || ''),
            title: String(item.title || ''),
            detail: String(item.detail || ''),
            type: String(item.type || 'other'),
          }))
        : generateTimeBlocks(signals, workout, { poorSleep, isRestDay: !workout || /recovery/i.test(workout.type) }),
      workout,
      nutrition: rec.nutrition && typeof rec.nutrition === 'object'
        ? { title: String(rec.nutrition.title || 'Nutrition'), detail: String(rec.nutrition.detail || '') }
        : { title: 'Protein + hydration baseline', detail: `Eat enough to support ${goalLabel(signals.goal)}.` },
      sleep,
      habits,
      explanation,
      thingsToAvoid,
      whyChanged: rec.whyChanged !== undefined ? rec.whyChanged : whyChanged(signals, prevEntry, context.prevCompletion),
      followUpQuestion: rec.followUpQuestion || null,
      confidence: ['high', 'medium', 'low'].includes(rec.confidence) ? rec.confidence : 'medium',
      confidenceNote: String(rec.confidenceNote || 'Recommendation based on a limited set of self-reported inputs.'),
      sevenDayPlan: Array.isArray(rec.sevenDayPlan) && rec.sevenDayPlan.length
        ? rec.sevenDayPlan.map((day) => ({
            day: String(day.day || ''),
            focus: String(day.focus || ''),
            mainAction: String(day.mainAction || ''),
            note: String(day.note || ''),
          }))
        : generateSevenDayPlan(profile, context.weeklyReview),
      structuredData: rec.structuredData && typeof rec.structuredData === 'object'
        ? rec.structuredData
        : { signals, readiness: score, engine: 'normalized' },
      mainAction: workout ? workout.title : String(rec.mainAction || 'Recovery only'),
      detail: workout ? workout.detail : String(rec.detail || 'Protect recovery.'),
      supportAction: habits[0]?.detail || String(rec.supportAction || ''),
      reason: explanation,
      caution: rec.caution || (thingsToAvoid.length ? thingsToAvoid.join(' ') : null),
    };
  }

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
      if (data?.ok && data.recommendation) {
        if (typeof Store !== 'undefined' && Store.logDebug) {
          Store.logDebug('AI-Response', 'Successful Gemini API response', data.recommendation);
        }
        return normalizeRecommendation(data.recommendation, profile, checkin, prevEntry, { ...context, entryCount });
      }

      throw new Error(data?.error || 'AI response missing recommendation');
    } catch (error) {
      if (typeof Store !== 'undefined' && Store.logDebug) {
        Store.logDebug('AI-Fallback', `AI unavailable (${error.message}). Using local rules.`);
      }
      return localEngine(profile, checkin, prevEntry, entryCount, context);
    }
  }

  async function generate(profile, checkin, prevEntry, entryCount, context = {}) {
    if (provider === 'llm' || provider === 'auto') {
      return callLLM(profile, checkin, prevEntry, entryCount, context);
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
    const raw = localEngine(profile, checkin, prevEntry, entryCount, context);
    return normalizeRecommendation(raw, profile, checkin, prevEntry, { ...context, entryCount });
  }

  return {
    generate,
    normalizeRecommendation,
    localEngine,
    getTemplates: () => EXERCISE_TEMPLATES,
    get provider() { return provider; },
    set provider(value) { provider = value; },
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Coach;
}
