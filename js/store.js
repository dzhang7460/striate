/* ============================================================
   Striate — store.js
   Simple localStorage persistence layer for v0.3.
   Supports Profile (with Memory & Preferences), Entries,
   Workout Completion Logs, and System Debug Logs.
   ============================================================ */

const Store = (() => {
  const PROFILE_KEY = 'striate_profile_v1';
  const ENTRIES_KEY = 'striate_entries_v1';
  const COMPLETIONS_KEY = 'striate_completions_v1';
  const DEBUG_LOGS_KEY = 'striate_debug_logs_v1';

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayKey() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // ---- Profile ----
  function getProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY));
    } catch { return null; }
  }

  function saveProfile(data) {
    const existing = getProfile() || {};
    const profile = {
      id: existing.id || uid(),
      createdAt: existing.createdAt || Date.now(),
      ...existing,
      ...data,
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    logDebug('Profile', 'Saved user profile', profile);
    return profile;
  }

  // ---- Preference & Memory Helpers ----
  function getPreferredExercises() {
    const p = getProfile();
    return p?.preferences?.preferredExercises || [];
  }

  function isPreferredExercise(id) {
    const list = getPreferredExercises();
    return list.some((e) => e.id === id);
  }

  function savePreferredExercise(exercise) {
    const p = getProfile() || {};
    const prefs = p.preferences || {};
    const list = prefs.preferredExercises || [];
    if (!list.some((e) => e.id === exercise.id)) {
      list.push({
        id: exercise.id,
        name: exercise.name,
        bodyPart: exercise.bodyPart,
        target: exercise.target,
        addedAt: Date.now(),
      });
      prefs.preferredExercises = list;
      saveProfile({ ...p, preferences: prefs });
      logDebug('Memory', `Added preferred exercise: ${exercise.name}`, exercise);
    }
    return list;
  }

  function removePreferredExercise(id) {
    const p = getProfile() || {};
    const prefs = p.preferences || {};
    const list = (prefs.preferredExercises || []).filter((e) => e.id !== id);
    prefs.preferredExercises = list;
    saveProfile({ ...p, preferences: prefs });
    logDebug('Memory', `Removed preferred exercise ID: ${id}`);
    return list;
  }

  function addDislikedSuggestion(reason) {
    const p = getProfile() || {};
    const prefs = p.preferences || {};
    const list = prefs.dislikedSuggestions || [];
    list.push({
      reason: String(reason).trim(),
      date: todayKey(),
    });
    prefs.dislikedSuggestions = list.slice(-20); // keep last 20 feedback items
    saveProfile({ ...p, preferences: prefs });
    logDebug('Memory', `Logged disliked suggestion feedback: "${reason}"`);
    return list;
  }

  // ---- Completions ----
  function getCompletionsMap() {
    try {
      return JSON.parse(localStorage.getItem(COMPLETIONS_KEY)) || {};
    } catch { return {}; }
  }

  function getCompletionLog(date = todayKey()) {
    const map = getCompletionsMap();
    return map[date] || null;
  }

  function saveCompletionLog(date, data) {
    const map = getCompletionsMap();
    const existing = map[date] || {};
    const logEntry = {
      id: existing.id || uid(),
      date,
      recordedAt: Date.now(),
      plannedWorkout: data.plannedWorkout || existing.plannedWorkout || 'Workout',
      status: data.status, // 'completed' | 'partial' | 'skipped'
      reason: data.reason || null,
      note: data.note || null,
    };
    map[date] = logEntry;
    localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(map));
    logDebug('Completion', `Logged workout status for ${date}: ${data.status}`, logEntry);
    return logEntry;
  }

  function getRecentCompletions(days = 7) {
    const map = getCompletionsMap();
    return Object.values(map)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, days);
  }

  function getAllCompletions() {
    const map = getCompletionsMap();
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
  }

  // ---- Entries (check-in + recommendation pairs) ----
  function getEntries() {
    try {
      const entries = JSON.parse(localStorage.getItem(ENTRIES_KEY)) || [];
      const compMap = getCompletionsMap();
      return entries
        .map((e) => ({
          ...e,
          completionLog: compMap[e.date] || null,
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
    } catch { return []; }
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
    const filtered = entries.filter((e) => e.date !== date);
    filtered.unshift(entry);
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(filtered.slice(0, 90)));
    logDebug('CheckIn', `Saved entry for ${date}`, { checkin, recommendation });
    return entry;
  }

  function getTodayEntry() {
    return getEntries().find((e) => e.date === todayKey()) || null;
  }

  function getLastEntryBefore(date) {
    const entries = getEntries();
    return entries.find((e) => e.date < date) || null;
  }

  // ---- Debugging Logs ----
  function logDebug(category, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[Striate Debug][${category}] ${message}`, data || '');
    try {
      const logs = getDebugLogs();
      logs.unshift({ id: uid(), timestamp, category, message, data });
      localStorage.setItem(DEBUG_LOGS_KEY, JSON.stringify(logs.slice(0, 50)));
    } catch {
      // Ignore storage limit errors for debug logs
    }
  }

  function getDebugLogs() {
    try {
      return JSON.parse(localStorage.getItem(DEBUG_LOGS_KEY)) || [];
    } catch { return []; }
  }

  function clearDebugLogs() {
    localStorage.removeItem(DEBUG_LOGS_KEY);
  }

  function clearAll() {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(ENTRIES_KEY);
    localStorage.removeItem(COMPLETIONS_KEY);
    localStorage.removeItem(DEBUG_LOGS_KEY);
  }

  return {
    getProfile, saveProfile,
    getPreferredExercises, isPreferredExercise, savePreferredExercise, removePreferredExercise,
    addDislikedSuggestion,
    getEntries, saveEntry, getTodayEntry, getLastEntryBefore,
    getCompletionLog, saveCompletionLog, getRecentCompletions, getAllCompletions,
    logDebug, getDebugLogs, clearDebugLogs,
    todayKey, clearAll,
  };
})();
