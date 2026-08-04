/* ============================================================
   Striate — store.js
   Local persistence for Striate.
   - Profile + coach memory
   - Entries + recommendation history
   - Workout completions
   - Sleep logs
   - Weekly review notes
   - Debug logs
============================================================ */

const Store = (() => {
  const KEYS = {
    profile: 'striate_profile_v2',
    profileLegacy: 'striate_profile_v1',
    entries: 'striate_entries_v2',
    entriesLegacy: 'striate_entries_v1',
    completions: 'striate_completions_v2',
    completionsLegacy: 'striate_completions_v1',
    sleepLogs: 'striate_sleep_logs_v2',
    weeklyReviews: 'striate_weekly_reviews_v2',
    debugLogs: 'striate_debug_logs_v2',
    debugLogsLegacy: 'striate_debug_logs_v1',
  };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function readKey(key, fallback = null, legacyKey = null) {
    const current = localStorage.getItem(key);
    if (current != null) return safeParse(current, fallback);

    if (legacyKey) {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy != null) {
        localStorage.setItem(key, legacy);
        return safeParse(legacy, fallback);
      }
    }

    return fallback;
  }

  function writeKey(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function todayKey() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function dateFromKey(dateKey) {
    const [y, m, d] = String(dateKey || todayKey()).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  function weekStartKey(dateKey = todayKey()) {
    const date = dateFromKey(dateKey);
    const day = date.getDay() || 7; // Monday = 1
    date.setDate(date.getDate() - day + 1);
    const p = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  }

  function defaultPreferences() {
    return {
      preferredExercises: [],
      avoidedExercises: [],
      dislikedSuggestions: [],
      trainingMethods: [],
      scheduleNotes: '',
      coachingConstraints: '',
      previousRecommendations: [],
      deviceCutoffMinutes: 30,
    };
  }

  function normalizeExerciseMemory(exercise = {}) {
    return {
      id: String(exercise.id || exercise.exerciseId || '').trim(),
      name: String(exercise.name || 'Unnamed exercise').trim(),
      bodyPart: String(exercise.bodyPart || '').trim(),
      target: String(exercise.target || '').trim(),
      equipment: String(exercise.equipment || '').trim(),
      gifUrl: String(exercise.gifUrl || '').trim(),
      addedAt: exercise.addedAt || Date.now(),
    };
  }

  function ensureProfileShape(profile) {
    if (!profile || typeof profile !== 'object') return null;
    const prefs = {
      ...defaultPreferences(),
      ...(profile.preferences || {}),
    };

    prefs.preferredExercises = Array.isArray(prefs.preferredExercises)
      ? prefs.preferredExercises.map(normalizeExerciseMemory).filter((item) => item.id || item.name)
      : [];

    prefs.avoidedExercises = Array.isArray(prefs.avoidedExercises)
      ? prefs.avoidedExercises.map(normalizeExerciseMemory).filter((item) => item.id || item.name)
      : [];

    prefs.dislikedSuggestions = Array.isArray(prefs.dislikedSuggestions)
      ? prefs.dislikedSuggestions.map((item) => ({
          id: item.id || uid(),
          reason: String(item.reason || item.note || '').trim(),
          note: String(item.note || '').trim(),
          date: item.date || todayKey(),
          createdAt: item.createdAt || Date.now(),
          trainingMethod: item.trainingMethod ? String(item.trainingMethod).trim() : '',
        })).filter((item) => item.reason)
      : [];

    prefs.trainingMethods = Array.isArray(prefs.trainingMethods)
      ? prefs.trainingMethods.map((item) => {
          if (typeof item === 'string') {
            return {
              id: item.toLowerCase().replace(/\s+/g, '-'),
              name: item,
              source: 'legacy',
              addedAt: Date.now(),
            };
          }
          return {
            id: item.id || String(item.name || '').toLowerCase().replace(/\s+/g, '-'),
            name: String(item.name || '').trim(),
            source: item.source || 'custom',
            addedAt: item.addedAt || Date.now(),
          };
        }).filter((item) => item.name)
      : [];

    prefs.previousRecommendations = Array.isArray(prefs.previousRecommendations)
      ? prefs.previousRecommendations.map((item) => ({
          id: item.id || uid(),
          date: item.date || todayKey(),
          summary: String(item.summary || '').trim(),
          workoutTitle: String(item.workoutTitle || '').trim(),
          explanation: String(item.explanation || '').trim(),
          whyChanged: item.whyChanged ? String(item.whyChanged) : '',
          createdAt: item.createdAt || Date.now(),
        })).filter((item) => item.summary || item.workoutTitle || item.explanation)
      : [];

    return {
      id: profile.id || uid(),
      createdAt: profile.createdAt || Date.now(),
      ...profile,
      preferences: prefs,
    };
  }

  // ---- Profile ----
  function getProfile() {
    return ensureProfileShape(readKey(KEYS.profile, null, KEYS.profileLegacy));
  }

  function saveProfile(data) {
    const existing = getProfile() || {};
    const merged = ensureProfileShape({
      ...existing,
      ...data,
      preferences: {
        ...defaultPreferences(),
        ...(existing.preferences || {}),
        ...((data && data.preferences) || {}),
      },
    });

    writeKey(KEYS.profile, merged);
    logDebug('Profile', 'Saved user profile', merged);
    return merged;
  }

  function getPreferences() {
    return getProfile()?.preferences || defaultPreferences();
  }

  function updatePreferences(patch = {}) {
    const profile = getProfile() || {};
    const updated = {
      ...defaultPreferences(),
      ...getPreferences(),
      ...patch,
    };
    saveProfile({ ...profile, preferences: updated });
    return getPreferences();
  }

  // ---- Training methods / preference memory ----
  function getTrainingMethods() {
    return getPreferences().trainingMethods || [];
  }

  function addTrainingMethod(name, source = 'custom') {
    const trimmed = String(name || '').trim();
    if (!trimmed) return getTrainingMethods();

    const prefs = getPreferences();
    const next = [...(prefs.trainingMethods || [])];
    const exists = next.some((item) => item.name.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      next.unshift({
        id: trimmed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        name: trimmed,
        source,
        addedAt: Date.now(),
      });
      updatePreferences({ trainingMethods: next.slice(0, 20) });
      logDebug('Memory', `Added training method: ${trimmed}`);
    }
    return getTrainingMethods();
  }

  function removeTrainingMethod(idOrName) {
    const needle = String(idOrName || '').trim().toLowerCase();
    const next = getTrainingMethods().filter((item) => {
      return item.id.toLowerCase() !== needle && item.name.toLowerCase() !== needle;
    });
    updatePreferences({ trainingMethods: next });
    logDebug('Memory', `Removed training method: ${idOrName}`);
    return next;
  }

  function getPreferredExercises() {
    return getPreferences().preferredExercises || [];
  }

  function isPreferredExercise(id) {
    const needle = String(id || '').trim();
    return getPreferredExercises().some((item) => item.id === needle);
  }

  function savePreferredExercise(exercise) {
    const normalized = normalizeExerciseMemory(exercise);
    if (!normalized.id && !normalized.name) return getPreferredExercises();

    const next = [...getPreferredExercises()];
    if (!next.some((item) => item.id === normalized.id || item.name.toLowerCase() === normalized.name.toLowerCase())) {
      next.unshift(normalized);
      updatePreferences({ preferredExercises: next.slice(0, 30) });
      logDebug('Memory', `Added preferred exercise: ${normalized.name}`, normalized);
    }
    return getPreferredExercises();
  }

  function removePreferredExercise(id) {
    const needle = String(id || '').trim();
    const next = getPreferredExercises().filter((item) => item.id !== needle);
    updatePreferences({ preferredExercises: next });
    logDebug('Memory', `Removed preferred exercise: ${needle}`);
    return next;
  }

  function getAvoidedExercises() {
    return getPreferences().avoidedExercises || [];
  }

  function isAvoidedExercise(id) {
    const needle = String(id || '').trim();
    return getAvoidedExercises().some((item) => item.id === needle);
  }

  function saveAvoidedExercise(exercise) {
    const normalized = normalizeExerciseMemory(exercise);
    if (!normalized.id && !normalized.name) return getAvoidedExercises();

    const next = [...getAvoidedExercises()];
    if (!next.some((item) => item.id === normalized.id || item.name.toLowerCase() === normalized.name.toLowerCase())) {
      next.unshift(normalized);
      updatePreferences({
        avoidedExercises: next.slice(0, 40),
        preferredExercises: getPreferredExercises().filter((item) => item.id !== normalized.id),
      });
      logDebug('Memory', `Added avoided exercise: ${normalized.name}`, normalized);
    }
    return getAvoidedExercises();
  }

  function removeAvoidedExercise(id) {
    const needle = String(id || '').trim();
    const next = getAvoidedExercises().filter((item) => item.id !== needle);
    updatePreferences({ avoidedExercises: next });
    logDebug('Memory', `Removed avoided exercise: ${needle}`);
    return next;
  }

  function addDislikedSuggestion(reason, meta = {}) {
    const trimmed = String(reason || '').trim();
    if (!trimmed) return getPreferences().dislikedSuggestions || [];

    const next = [...(getPreferences().dislikedSuggestions || [])];
    next.unshift({
      id: uid(),
      reason: trimmed,
      note: String(meta.note || '').trim(),
      trainingMethod: String(meta.trainingMethod || '').trim(),
      date: meta.date || todayKey(),
      createdAt: Date.now(),
    });

    updatePreferences({ dislikedSuggestions: next.slice(0, 30) });
    logDebug('Memory', `Logged disliked suggestion: ${trimmed}`, meta);
    return getPreferences().dislikedSuggestions || [];
  }

  function setScheduleNotes(text) {
    updatePreferences({ scheduleNotes: String(text || '').trim() });
    return getPreferences().scheduleNotes;
  }

  function setCoachingConstraints(text) {
    updatePreferences({ coachingConstraints: String(text || '').trim() });
    return getPreferences().coachingConstraints;
  }

  function setDeviceCutoffMinutes(minutes) {
    const value = Math.max(15, Math.min(90, Number(minutes) || 30));
    updatePreferences({ deviceCutoffMinutes: value });
    return value;
  }

  function appendPreviousRecommendation(date, recommendation = {}) {
    const prefs = getPreferences();
    const next = [...(prefs.previousRecommendations || [])];
    next.unshift({
      id: uid(),
      date,
      summary: String(recommendation.summary || '').trim(),
      workoutTitle: String(recommendation.workout?.title || recommendation.mainAction || '').trim(),
      explanation: String(recommendation.explanation || recommendation.reason || '').trim(),
      whyChanged: recommendation.whyChanged ? String(recommendation.whyChanged).trim() : '',
      createdAt: Date.now(),
    });
    updatePreferences({ previousRecommendations: next.slice(0, 40) });
    return getPreferences().previousRecommendations || [];
  }

  function getRecentAdviceHistory(limit = 10) {
    return (getPreferences().previousRecommendations || []).slice(0, limit);
  }

  // ---- Sleep logs ----
  function getSleepLogsMap() {
    return readKey(KEYS.sleepLogs, {}) || {};
  }

  function getSleepLog(date = todayKey()) {
    if (!date) return null;
    return getSleepLogsMap()[date] || null;
  }

  function saveSleepLog(date, data = {}) {
    if (!date) return null;
    const map = getSleepLogsMap();
    const existing = map[date] || {};
    map[date] = {
      id: existing.id || uid(),
      date,
      recordedAt: Date.now(),
      sleep: data.sleep || existing.sleep || null,
      sleepHoursLabel: data.sleep || existing.sleepHoursLabel || null,
      sleepQuality: Number(data.sleepQuality || existing.sleepQuality || 0) || null,
      bedtimeConsistency: data.bedtimeConsistency || existing.bedtimeConsistency || null,
      screenCutoff: data.screenCutoff || existing.screenCutoff || null,
      targetBedtime: data.targetBedtime || existing.targetBedtime || null,
      targetWakeTime: data.targetWakeTime || existing.targetWakeTime || null,
      readinessScore: typeof data.readinessScore === 'number' ? data.readinessScore : existing.readinessScore,
    };
    writeKey(KEYS.sleepLogs, map);
    logDebug('Sleep', `Saved sleep log for ${date}`, map[date]);
    return map[date];
  }

  function getRecentSleepLogs(days = 7) {
    return Object.values(getSleepLogsMap())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, days);
  }

  // ---- Completions ----
  function getCompletionsMap() {
    return readKey(KEYS.completions, {}, KEYS.completionsLegacy) || {};
  }

  function getCompletionLog(date = todayKey()) {
    if (!date) return null;
    return getCompletionsMap()[date] || null;
  }

  function saveCompletionLog(date, data) {
    const map = getCompletionsMap();
    const existing = map[date] || {};
    const logEntry = {
      id: existing.id || uid(),
      date,
      recordedAt: Date.now(),
      plannedWorkout: data.plannedWorkout || existing.plannedWorkout || 'Workout',
      status: data.status,
      reason: data.reason || null,
      note: data.note || null,
    };
    map[date] = logEntry;
    writeKey(KEYS.completions, map);
    logDebug('Completion', `Logged workout status for ${date}: ${data.status}`, logEntry);
    return logEntry;
  }

  function getRecentCompletions(days = 7) {
    return Object.values(getCompletionsMap())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, days);
  }

  function getAllCompletions() {
    return Object.values(getCompletionsMap()).sort((a, b) => b.date.localeCompare(a.date));
  }

  // ---- Entries ----
  function getEntries() {
    const entries = readKey(KEYS.entries, [], KEYS.entriesLegacy) || [];
    const compMap = getCompletionsMap();
    return entries
      .map((entry) => ({
        ...entry,
        completionLog: compMap[entry.date] || null,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function saveEntry(checkin, recommendation) {
    const entries = getEntries();
    const date = todayKey();
    const entry = {
      id: uid(),
      date,
      createdAt: Date.now(),
      checkin,
      recommendation,
    };

    const filtered = entries.filter((item) => item.date !== date);
    filtered.unshift(entry);
    writeKey(KEYS.entries, filtered.slice(0, 120));

    saveSleepLog(date, {
      sleep: checkin.sleep,
      sleepHoursLabel: checkin.sleep,
      sleepQuality: checkin.sleepQuality,
      bedtimeConsistency: checkin.bedtimeConsistency,
      screenCutoff: checkin.screenCutoff,
      targetBedtime: recommendation?.sleep?.targetBedtime || null,
      targetWakeTime: recommendation?.sleep?.targetWakeTime || null,
      readinessScore: recommendation?.readinessScore,
    });

    appendPreviousRecommendation(date, recommendation);
    logDebug('CheckIn', `Saved entry for ${date}`, { checkin, recommendation });
    return entry;
  }

  function getTodayEntry() {
    return getEntries().find((entry) => entry.date === todayKey()) || null;
  }

  function getLastEntryBefore(date) {
    if (!date) return null;
    return getEntries().find((entry) => entry.date < date) || null;
  }

  // ---- Weekly review ----
  function getWeeklyReviewNotesMap() {
    return readKey(KEYS.weeklyReviews, {}) || {};
  }

  function getWeeklyReviewNote(weekKey = weekStartKey()) {
    return getWeeklyReviewNotesMap()[weekKey] || null;
  }

  function saveWeeklyReviewNote(weekKey, data = {}) {
    const key = weekKey || weekStartKey();
    const map = getWeeklyReviewNotesMap();
    map[key] = {
      id: map[key]?.id || uid(),
      weekKey: key,
      recordedAt: Date.now(),
      win: String(data.win || '').trim(),
      friction: String(data.friction || '').trim(),
      keepMethod: String(data.keepMethod || '').trim(),
    };
    writeKey(KEYS.weeklyReviews, map);
    logDebug('WeeklyReview', `Saved weekly review for ${key}`, map[key]);
    return map[key];
  }

  function getWeeklyReviewSummary(referenceDate = todayKey()) {
    const startKey = weekStartKey(referenceDate);
    const startDate = dateFromKey(startKey);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const entries = getEntries().filter((item) => {
      const date = dateFromKey(item.date);
      return date >= startDate && date <= endDate;
    });

    const completions = getAllCompletions().filter((item) => {
      const date = dateFromKey(item.date);
      return date >= startDate && date <= endDate;
    });

    const sleepLogs = getRecentSleepLogs(30).filter((item) => {
      const date = dateFromKey(item.date);
      return date >= startDate && date <= endDate;
    });

    const sleepMap = { '<5': 4, '5-6': 5.5, '6-7': 6.5, '7-8': 7.5, '8+': 8.5 };
    const completed = completions.filter((item) => item.status === 'completed').length;
    const partial = completions.filter((item) => item.status === 'partial').length;
    const skipped = completions.filter((item) => item.status === 'skipped').length;
    const avgSleep = sleepLogs.length
      ? Math.round((sleepLogs.reduce((sum, item) => sum + (sleepMap[item.sleep] || 0), 0) / sleepLogs.length) * 10) / 10
      : 0;
    const avgQuality = sleepLogs.length
      ? Math.round((sleepLogs.reduce((sum, item) => sum + (Number(item.sleepQuality) || 0), 0) / sleepLogs.length) * 10) / 10
      : 0;

    const blockerCounts = {};
    completions.forEach((item) => {
      if (!item.reason) return;
      blockerCounts[item.reason] = (blockerCounts[item.reason] || 0) + 1;
    });
    const topBlocker = Object.entries(blockerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const note = getWeeklyReviewNote(startKey);

    return {
      weekKey: startKey,
      completed,
      partial,
      skipped,
      totalLoggedSessions: completions.length,
      checkIns: entries.length,
      avgSleep,
      avgQuality,
      topBlocker,
      note,
      adviceSeen: getRecentAdviceHistory(7),
      trainingMethods: getTrainingMethods(),
      consistencySummary: entries.length === 0
        ? 'No check-ins yet this week.'
        : completed >= 3
          ? 'Consistency is decent. Keep the plan simple next week.'
          : skipped >= 2
            ? 'The plan is slipping. Reduce friction before adding intensity.'
            : 'You are building data. Keep showing up for the scheduled block.',
    };
  }

  // ---- Debugging ----
  function logDebug(category, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[Striate Debug][${category}] ${message}`, data || '');
    try {
      const logs = getDebugLogs();
      logs.unshift({ id: uid(), timestamp, category, message, data });
      writeKey(KEYS.debugLogs, logs.slice(0, 80));
    } catch {
      // Ignore storage issues.
    }
  }

  function getDebugLogs() {
    return readKey(KEYS.debugLogs, [], KEYS.debugLogsLegacy) || [];
  }

  function clearDebugLogs() {
    localStorage.removeItem(KEYS.debugLogs);
    localStorage.removeItem(KEYS.debugLogsLegacy);
  }

  function clearAll() {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  }

  return {
    getProfile,
    saveProfile,
    getPreferences,
    updatePreferences,
    getTrainingMethods,
    addTrainingMethod,
    removeTrainingMethod,
    getPreferredExercises,
    isPreferredExercise,
    savePreferredExercise,
    removePreferredExercise,
    getAvoidedExercises,
    isAvoidedExercise,
    saveAvoidedExercise,
    removeAvoidedExercise,
    addDislikedSuggestion,
    setScheduleNotes,
    setCoachingConstraints,
    setDeviceCutoffMinutes,
    getRecentAdviceHistory,
    getEntries,
    saveEntry,
    getTodayEntry,
    getLastEntryBefore,
    getCompletionLog,
    saveCompletionLog,
    getRecentCompletions,
    getAllCompletions,
    getSleepLog,
    saveSleepLog,
    getRecentSleepLogs,
    getWeeklyReviewNote,
    saveWeeklyReviewNote,
    getWeeklyReviewSummary,
    logDebug,
    getDebugLogs,
    clearDebugLogs,
    todayKey,
    weekStartKey,
    clearAll,
  };
})();
