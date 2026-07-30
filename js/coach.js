/* ============================================================
   Striate — coach.js
   Recommendation generation layer.

   Public API:
     Coach.generate(profile, checkin, prevEntry, entryCount)
       -> Promise<recommendation>

   recommendation shape (stable contract for the UI):
   {
     summary:        string   // one-line honest read of user's state
     mainAction:     string   // the one thing to do today
     detail:         string   // concrete how-to for the main action
     supportAction:  string   // one small supporting habit
     reason:         string   // why this recommendation
     confidence:     'high' | 'medium' | 'low'
     confidenceNote: string   // honest note about certainty
     caution:        string|null
     whyChanged:     string|null  // vs previous day
     structuredData: object   // raw signals, kept for future LLM/audit
   }

   To plug in a real LLM later:
     1. Set Coach.provider = 'llm'
     2. Implement callLLM() to POST buildPrompt(...) to your endpoint
        and parse the JSON response into the shape above.
     The UI never changes.
============================================================ */

const Coach = (() => {
  let provider = 'local'; // 'local' | 'llm'

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
      constraint: checkin.specialConstraint || 'none',
      hasInjuryFlag:
        checkin.specialConstraint === 'injury' ||
        /injur|pain|hurt/i.test(checkin.extraNote || ''),
      hasProfileInjury: !!(profile.injuryNotes || '').trim(),
      goal: profile.goal || 'general',
      experience: profile.experienceLevel || 'new',
      equipment: profile.equipment || [],
    };
  }

  // Readiness: crude but honest composite, 0–10.
  function readiness(s) {
    let score = 5;
    score += (s.sleepHrs - 7) * 1.2;
    score += (s.energy - 3) * 1.0;
    score -= (s.soreness - 1) * 1.1;
    score += (s.mood - 3) * 0.5;
    return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  }

  // ---------- Content helpers ----------

  function goalLabel(goal) {
    return {
      strength: 'building strength',
      muscle: 'building muscle',
      fat_loss: 'losing fat',
      fitness: 'general fitness',
      energy: 'more daily energy',
    }[goal] || 'general fitness';
  }

  function pickWorkout(s, minutes) {
    const hasGym = s.equipment.includes('gym');
    const hasDumbbells = s.equipment.includes('dumbbells');
    const bodyweightOnly = !hasGym && !hasDumbbells;

    const short = minutes <= 25;

    if (s.goal === 'fat_loss' || s.goal === 'energy') {
      if (short) {
        return {
          action: `Do a ${minutes}-minute brisk walk or easy intervals`,
          detail: 'Walk fast enough that talking takes effort. If you have stairs, add 5 rounds up and down at the end.',
        };
      }
      return {
        action: `Do ${minutes} minutes: 10-min brisk walk + full-body circuit`,
        detail: bodyweightOnly
          ? '3 rounds: 10 squats, 8 incline push-ups (use a table or wall), 20-second plank. Rest 60–90s between rounds.'
          : '3 rounds: 10 goblet squats, 8 dumbbell rows per side, 20-second plank. Rest 60–90s between rounds.',
      };
    }

    // strength / muscle / general fitness
    if (short) {
      return {
        action: `Do one focused ${minutes}-minute basics block`,
        detail: bodyweightOnly
          ? '3 rounds: 8–12 squats, 5–10 push-ups (knees are fine), 20-second plank. Slow reps, full range. Stop 2 reps before failure.'
          : '3 rounds: 8–10 goblet squats, 8–10 floor presses or push-ups, 8 rows per side. Stop 2 reps before failure.',
      };
    }
    if (hasGym) {
      return {
        action: `Do a ${minutes}-minute full-body basics session`,
        detail: '3 sets each: leg press or goblet squat (8–12), chest press machine (8–12), seated row (8–12). Pick weights you could do 2 more reps with. Write down what you used.',
      };
    }
    return {
      action: `Do a ${minutes}-minute full-body session at home`,
      detail: bodyweightOnly
        ? '3 sets each: squats (10–15), push-ups (5–12, incline if needed), hip hinges/glute bridges (12–15), plank (20–40s). Rest ~90s between sets.'
        : '3 sets each: goblet squats (8–12), dumbbell press or push-ups (8–12), one-arm rows (8–12/side). Rest ~90s between sets.',
    };
  }

  // ---------- Local rule engine ----------

  function localEngine(profile, checkin, prevEntry, entryCount) {
    const s = readSignals(profile, checkin);
    const r = readiness(s);
    const sd = { signals: s, readiness: r, engine: 'local-rules-v1' };

    let rec;

    // 1) Injury signals override everything.
    if (s.hasInjuryFlag) {
      rec = {
        summary: `You flagged pain or an injury. Readiness doesn't matter today — safety does.`,
        mainAction: 'Skip training the affected area today',
        detail: 'If the pain is sharp, gets worse with movement, or involves a joint, do not train through it. Gentle walking is fine if pain-free. If it persists more than a few days, see a professional — an app cannot diagnose you.',
        supportAction: 'Note exactly where it hurts and what movement triggers it, so you can track whether it improves.',
        reason: 'Training through pain is how beginners turn a small issue into a lost month. Missing one session costs you almost nothing.',
        confidence: 'low',
        confidenceNote: 'Low confidence — I can\'t assess an injury from a check-in. Treat this as a default-to-safe suggestion, not medical advice.',
        caution: 'This is not medical advice. Sharp, persistent, or worsening pain means see a doctor or physio.',
      };
    }
    // 2) Very poor recovery: bad sleep AND low energy.
    else if (s.sleepHrs < 6 && s.energy <= 2) {
      rec = {
        summary: `Short sleep (${checkin.sleep}h) and low energy. Your recovery is the bottleneck today, not your workout.`,
        mainAction: 'Take a recovery day: 15–20 minute easy walk only',
        detail: 'Keep it genuinely easy — you should be able to hold a conversation the whole time. No lifting today.',
        supportAction: `Set a hard "screens off" time 30 minutes before your usual bedtime tonight (${profile.sleepSchedule || 'your normal time'}).`,
        reason: 'Training hard on under 6 hours of sleep with low energy gives you a worse workout and worse recovery. The walk keeps the habit alive without digging the hole deeper. Tonight\'s sleep is the highest-value thing you can do for your goal.',
        confidence: 'high',
        confidenceNote: 'High confidence — the evidence on sleep and training quality is consistent, and your inputs point the same direction.',
        caution: null,
      };
    }
    // 3) High soreness.
    else if (s.soreness >= 4) {
      const canTrain = s.energy >= 3;
      rec = canTrain ? {
        summary: `You're quite sore (${s.soreness}/5) but energy is okay. Normal for a beginner — your body is adapting.`,
        mainAction: 'Do 20–30 minutes of light movement, not a hard session',
        detail: 'Easy walk, gentle cycling, or light bodyweight movement for muscles that are NOT sore. No pushing near failure today.',
        supportAction: 'Drink water with each meal and get protein at your next two meals (eggs, yogurt, chicken, beans — whatever is easy).',
        reason: 'Soreness this high means the last session was a big stimulus. Light movement speeds recovery slightly and keeps the habit; another hard session now mostly just adds fatigue.',
        confidence: 'medium',
        confidenceNote: 'Medium confidence — soreness is a rough signal. If it\'s one-sided or joint pain rather than muscle ache, treat it as an injury flag instead.',
        caution: 'Muscle soreness on both sides = normal. Sharp or one-sided joint pain = stop and reassess.',
      } : {
        summary: `High soreness (${s.soreness}/5) and low energy. Your body is asking for a day off.`,
        mainAction: 'Rest today. A 10-minute walk if you feel like it, nothing more',
        detail: 'Rest is not falling behind — it\'s when the adaptation from your last session actually happens.',
        supportAction: 'Aim for a full night of sleep tonight; it\'s the single biggest recovery lever you have.',
        reason: 'Both your recovery signals are down. Training today would be low quality and slow down the recovery you need.',
        confidence: 'high',
        confidenceNote: 'High confidence — when soreness is high and energy is low, rest reliably beats training for beginners.',
        caution: null,
      };
    }
    // 4) Almost no time today.
    else if (s.minutes <= 15) {
      rec = {
        summary: `Tight day (~${s.minutes} min available)${s.constraint !== 'none' ? ` with a "${s.constraint}" constraint` : ''}. That's fine — don't zero out.`,
        mainAction: 'Do a 10-minute minimum: 3 rounds of squats + push-ups + plank',
        detail: '3 rounds: 10 squats, 5–10 push-ups (incline if needed), 20-second plank. No warm-up needed at this intensity. Done in ~10 minutes.',
        supportAction: 'Decide now the exact time slot you\'ll use — e.g. "right after I get home". Vague plans die on busy days.',
        reason: 'On a day like this the goal is not fitness gains, it\'s keeping the habit unbroken. A 10-minute session preserves momentum; a skipped day makes tomorrow\'s decision harder.',
        confidence: 'high',
        confidenceNote: 'High confidence in the approach. The specific exercises matter less than doing something short and scheduled.',
        caution: null,
      };
    }
    // 5) Normal day → actual training, adapted to readiness.
    else {
      const w = pickWorkout(s, r >= 6 ? s.minutes : Math.min(s.minutes, 30));
      const strongDay = r >= 6.5;
      rec = {
        summary: strongDay
          ? `Solid readiness today (${r}/10): sleep and energy are on your side.`
          : `Middling readiness (${r}/10). Good enough to train, not a day to push limits.`,
        mainAction: w.action,
        detail: w.detail,
        supportAction: s.mood <= 2
          ? 'Mood is low: commit only to the first 10 minutes. If you still feel bad after that, stop — that counts.'
          : `Eat a protein-containing meal within a couple of hours after the session — it supports ${goalLabel(s.goal)}.`,
        reason: strongDay
          ? `Your check-in shows decent sleep, energy ${s.energy}/5 and low soreness, so today is worth using for real training toward ${goalLabel(s.goal)}. As a ${s.experience === 'new' ? 'beginner' : 'returning trainee'}, simple full-body basics beat any clever program.`
          : `Your signals are mixed, so the plan is trimmed: same basics, slightly less volume. Consistency at 80% beats occasional heroics.`,
        confidence: strongDay ? 'high' : 'medium',
        confidenceNote: strongDay
          ? 'High confidence — for beginners, full-body basics done consistently is the most evidence-backed path. The exact exercises are flexible.'
          : 'Medium confidence — your inputs are mixed, so this is a reasonable middle path, not a precision plan.',
        caution: s.constraint === 'travel' ? 'Traveling: swap any equipment moves for the bodyweight versions and keep it simple.' :
                 s.constraint === 'exam' || s.constraint === 'busy' ? 'Busy day: if the session slips, fall back to the 10-minute version rather than skipping.' : null,
      };
    }

    // Honest note when we have almost no history.
    if (entryCount <= 1) {
      rec.confidenceNote += ' Also: this is one of your first check-ins, so I\'m working from limited data about you. Recommendations get sharper as your history builds.';
      if (rec.confidence === 'high') rec.confidence = 'medium';
    }

    // Profile injury note carries into cautions.
    if (s.hasProfileInjury && !s.hasInjuryFlag) {
      const note = `You noted: "${profile.injuryNotes.trim()}". Avoid anything that loads that area with pain.`;
      rec.caution = rec.caution ? rec.caution + ' ' + note : note;
    }

    rec.whyChanged = explainChange(s, prevEntry);
    rec.structuredData = sd;
    return rec;
  }

  // ---------- "Why this changed" vs previous day ----------

  function explainChange(s, prevEntry) {
    if (!prevEntry) return null;
    const p = prevEntry.checkin;
    const diffs = [];
    const pe = Number(p.energy), ps = Number(p.soreness);
    if (p.sleep) {
      // compare mapped hours
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
      return 'Your check-in looks similar to last time, so the plan follows the same logic as your previous recommendation.';
    }
    return `Compared to your last check-in, ${diffs.join(', ')} — so today's plan was adjusted accordingly.`;
  }

  // ---------- LLM plug point (not active in v0.1) ----------

  function buildPrompt(profile, checkin, prevEntry) {
    return {
      system:
        'You are Striate, an honest fitness coach for beginners. Be direct, concise, realistic. ' +
        'Never flatter. Never overpromise. State uncertainty plainly. ' +
        'Return ONLY JSON with keys: summary, mainAction, detail, supportAction, reason, ' +
        'confidence (high|medium|low), confidenceNote, caution (string|null), whyChanged (string|null).',
      user: JSON.stringify({ profile, checkin, previousEntry: prevEntry }),
    };
  }

  async function callLLM(profile, checkin, prevEntry, entryCount) {
    // Implement when an LLM endpoint is available:
    //   const prompt = buildPrompt(profile, checkin, prevEntry);
    //   const res = await fetch(LLM_ENDPOINT, {...});
    //   return validate(JSON.parse(...));
    // Fallback keeps the app working:
    return localEngine(profile, checkin, prevEntry, entryCount);
  }

  // ---------- Public ----------

  async function generate(profile, checkin, prevEntry, entryCount) {
    if (provider === 'llm') return callLLM(profile, checkin, prevEntry, entryCount);
    // Simulate brief "thinking" so the transition feels deliberate, not jarring.
    await new Promise((r) => setTimeout(r, 700));
    return localEngine(profile, checkin, prevEntry, entryCount);
  }

  return { generate, buildPrompt, get provider() { return provider; }, set provider(v) { provider = v; } };
})();
