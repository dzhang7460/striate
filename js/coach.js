/* ============================================================
   Striate — coach.js
   Adaptive recommendation engine for Striate v0.2.
   - Supports Gemini API backend route (/api/coach) with automatic
     fallback to local deterministic rules engine.
   - Curated beginner exercise templates.
   - Schedule-aware curation using dedicated workout time.
   - Adapts to completion logs, fatigue, constraints, and injuries.
   - Standardizes output to the strict v0.2 JSON schema.
============================================================ */

const Coach = (() => {
  let provider = 'auto'; // 'auto' | 'local' | 'llm'

  // ---------- Curated Beginner Exercise Templates ----------
  const EXERCISE_TEMPLATES = {
    beginner_gym_full_body: {
      id: 'beginner_gym_full_body',
      title: 'Beginner Gym Full Body',
      durationMinutes: 45,
      action: 'Do a 45-minute full-body basics session at the gym',
      detail: '3 sets each: leg press or goblet squat (8–12), chest press machine (8–12), seated row (8–12). Pick weights where you could do 2 more reps with good form. Record your weights.',
      why: 'Full-body basics build overall strength efficiently for beginners without overwhelming recovery.',
    },
    beginner_home_full_body: {
      id: 'beginner_home_full_body',
      title: 'Beginner Home Full Body',
      durationMinutes: 35,
      action: 'Do a 35-minute full-body session at home',
      detail: '3 rounds: 10–15 squats, 5–12 push-ups (incline on a table/counter if needed), 12–15 glute bridges, 20–30s plank. Rest 90s between rounds.',
      why: 'Simple bodyweight movements stimulate all major muscle groups safely at home.',
    },
    low_time_fallback: {
      id: 'low_time_fallback',
      title: '10-Minute Habit Protector',
      durationMinutes: 10,
      action: 'Do a 10-minute minimum: 3 rounds of squats + push-ups + plank',
      detail: '3 rounds: 10 squats, 5–10 push-ups (incline if needed), 20-second plank. No warm-up needed at this intensity. Done in ~10 minutes.',
      why: 'On a busy day, preserving the habit is more important than workout volume.',
    },
    recovery_day: {
      id: 'recovery_day',
      title: 'Active Recovery Walk',
      durationMinutes: 20,
      action: 'Take a recovery day: 15–20 minute easy walk only',
      detail: 'Keep it genuinely easy — you should be able to breathe comfortably and hold a conversation the whole time. No lifting today.',
      why: 'Training hard when under-recovered slows down progress. Gentle movement promotes blood flow and recovery.',
    },
    upper_body_basics: {
      id: 'upper_body_basics',
      title: 'Upper Body Basics',
      durationMinutes: 30,
      action: 'Do a 30-minute upper body basics session',
      detail: '3 sets each: dumbbell or incline push-ups (8–12), dumbbell one-arm rows (8–12/side), overhead reach or shoulder press (8–10). Rest 90s between sets.',
      why: 'Focuses on posture and upper body strength while allowing lower body joints to recover.',
    },
    lower_body_basics: {
      id: 'lower_body_basics',
      title: 'Lower Body Basics',
      durationMinutes: 35,
      action: 'Do a 35-minute lower body basics session',
      detail: '3 sets each: goblet squats (8–12), glute bridges (12–15), reverse lunges (8/side). Keep reps slow and controlled.',
      why: 'Builds leg strength and stability with beginner-friendly joint angles.',
    },
    light_cardio_walk: {
      id: 'light_cardio_walk',
      title: 'Light Cardio / Walk Day',
      durationMinutes: 25,
      action: 'Do 25 minutes of light cardio or brisk walking',
      detail: 'Walk fast enough that talking takes slight effort, or cycle at an easy pace. If you have stairs, add 3 calm ascents at the end.',
      why: 'Improves daily energy and aerobic base without muscle soreness.',
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
      extraNote: checkin.extraNote || '',
    };
  }

  // Readiness: honest composite, 0–10.
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
    }[goal] || 'general fitness';
  }

  // ---------- Schedule Generator ----------

  function generateTimeBlocks(s, workoutBlock, isRestDay) {
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

    const blocks = [];
    blocks.push({
      time: '7:30 AM',
      title: 'Morning Fuel & Hydration',
      detail: 'Drink a glass of water first thing. Eat a balanced breakfast with protein.',
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
      detail: `Eat a protein-rich meal to support ${goalLabel(s.goal)} and muscle recovery.`,
      type: 'meal',
    });

    blocks.push({
      time: '10:00 PM',
      title: 'Screens Off & Wind-down',
      detail: 'Dim lights and disconnect from screens 30 minutes before bed for higher sleep quality.',
      type: 'sleep',
    });

    return blocks;
  }

  // ---------- 7-Day Plan Generator ----------

  function generateSevenDayPlan(profile) {
    const g = profile?.goal || 'general';
    return [
      {
        day: 'Day 1 (Today)',
        focus: 'Primary Training',
        mainAction: 'Curated beginner session based on today\'s check-in',
        note: 'Adapted to your sleep, energy, and dedicated time window.',
      },
      {
        day: 'Day 2',
        focus: 'Active Recovery',
        mainAction: '20-minute conversational walk + hydration focus',
        note: 'Allows muscle protein synthesis without adding fatigue.',
      },
      {
        day: 'Day 3',
        focus: 'Strength Basics',
        mainAction: 'Full-body or upper-body beginner session',
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
        focus: 'Strength Basics',
        mainAction: 'Full-body or lower-body beginner session',
        note: 'Maintain form quality even as fatigue accumulates.',
      },
      {
        day: 'Day 6',
        focus: 'Cardio Base',
        mainAction: '25-minute brisk walk or easy cycling',
        note: 'Low-impact cardiovascular conditioning.',
      },
      {
        day: 'Day 7',
        focus: 'Review & Rest',
        mainAction: 'Complete rest or optional gentle stretching',
        note: 'Review weekly consistency and plan next week\'s workout time.',
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

    if (diffs.length === 0) {
      return 'Your check-in looks similar to last time, so today follows the same training progression.';
    }
    return `Compared to your last check-in, ${diffs.join(', ')} — so today's schedule and intensity were adjusted accordingly.`;
  }

  // ---------- Local Rule Engine (v0.2) ----------

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
    // 2) Very poor recovery: short sleep AND low energy.
    else if (s.sleepHrs < 6 && s.energy <= 2) {
      isRestDay = true;
      template = EXERCISE_TEMPLATES.recovery_day;
      summary = `Short sleep (${checkin.sleep}h) and low energy (${s.energy}/5). Your recovery is the bottleneck today, not your workout.`;
      explanation = 'Training hard on under 6 hours of sleep with low energy produces a low-quality workout and digs a recovery hole. An easy walk keeps the habit alive while letting your central nervous system recover.';
      confidence = 'high';
      confidenceNote = 'High confidence — the evidence on short sleep and injury risk is consistent, and your inputs point the same direction.';
      thingsToAvoid = [
        'Avoid heavy lifting or pushing near failure today.',
        'Avoid caffeine within 8 hours of bedtime tonight.',
        'Do not stay up late catching up on screen time.'
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
    // 5) Normal day → select beginner template based on equipment & completion history.
    else {
      const hasGym = s.equipment.includes('gym');
      const hasDumbbells = s.equipment.includes('dumbbells');
      const strongDay = r >= 6.0;

      if (hasGym) {
        template = EXERCISE_TEMPLATES.beginner_gym_full_body;
      } else if (hasDumbbells) {
        template = EXERCISE_TEMPLATES.upper_body_basics;
      } else {
        template = EXERCISE_TEMPLATES.beginner_home_full_body;
      }

      // If yesterday was completed, add encouraging progression tone
      if (prevCompletion && prevCompletion.status === 'completed') {
        summary = `Strong momentum: yesterday's workout completed and readiness is ${r}/10 today.`;
        explanation = `You completed your last session, and today's check-in shows solid readiness (${r}/10). Full-body basics remain the most reliable path toward ${goalLabel(s.goal)}.`;
      } else if (prevCompletion && prevCompletion.status === 'skipped') {
        summary = `Fresh start after yesterday's skipped session. Readiness is ${r}/10 today.`;
        explanation = `Missing one session is normal; what matters is resuming the habit today. We scheduled this session at ${s.dedicatedTime} to make starting low-friction.`;
        followUpQuestion = prevCompletion.reason ? null : 'What was the main reason yesterday\'s workout slipped?';
      } else {
        summary = strongDay
          ? `Solid readiness today (${r}/10): sleep and energy are in your favor.`
          : `Middling readiness (${r}/10). Good enough for consistent work, not a day to push limits.`;
        explanation = strongDay
          ? `Your inputs show good recovery, making today ideal for quality basics toward ${goalLabel(s.goal)}.`
          : `Your signals are moderate, so follow today's template at 80% effort. Consistency beats occasional heroics.`;
      }

      confidence = strongDay ? 'high' : 'medium';
      confidenceNote = strongDay
        ? 'High confidence — for beginners, consistent full-body basics is the most evidence-backed strategy.'
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

    const whyChanged = explainChange(s, prevEntry, prevCompletion);

    const workoutObj = template ? {
      title: template.title,
      detail: template.detail,
      durationMinutes: template.durationMinutes,
    } : null;

    const todaySchedule = generateTimeBlocks(s, workoutObj, isRestDay);
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
        title: `Target Bedtime: ${profile?.sleepSchedule || 'Usual Bedtime'}`,
        detail: 'Aim for 7–8 hours of quality sleep tonight to maximize muscular and mental recovery.',
      },
      habits: [
        {
          title: 'Daily Hydration',
          detail: 'Drink a glass of water immediately after completing your check-in.',
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
        engine: 'local-rules-v0.2',
        templateId: template ? template.id : 'none',
      },
      // Backward-compat v0.1 fields for older renderers:
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
      };
    }

    const todaySchedule = Array.isArray(rec.todaySchedule) && rec.todaySchedule.length > 0
      ? rec.todaySchedule
      : generateTimeBlocks(s, workoutObj, !workoutObj);

    const sevenDayPlan = Array.isArray(rec.sevenDayPlan) && rec.sevenDayPlan.length > 0
      ? rec.sevenDayPlan
      : generateSevenDayPlan(profile);

    const thingsToAvoid = Array.isArray(rec.thingsToAvoid)
      ? rec.thingsToAvoid
      : (rec.caution ? [rec.caution] : []);

    const habits = Array.isArray(rec.habits) && rec.habits.length > 0
      ? rec.habits
      : (rec.supportAction ? [{ title: 'Daily Habit', detail: rec.supportAction }] : [{ title: 'Hydration', detail: 'Drink water with every meal.' }]);

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
        title: `Sleep Target (${profile?.sleepSchedule || '22:00'})`,
        detail: 'Aim for 7–8 hours of consistent sleep tonight.',
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
    // Simulate brief "thinking" so the transition feels deliberate
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
