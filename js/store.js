/* ============================================================
   Striate — store.js
   Simple localStorage persistence layer for v0.1.
   Swap these functions for API calls later without touching UI.
   ============================================================

   Data model:
   profile: {
     id, ageRange, heightCm, weightKg, goal, experienceLevel,
     availableDays, availableTime, sleepSchedule, equipment[],
     injuryNotes, createdAt
   }
   entry: {
     id, date (YYYY-MM-DD), createdAt,
     checkin: { sleep, energy, soreness, mood, timeAvailable,
                specialConstraint, extraNote },
     recommendation: { summary, mainAction, supportAction, reason,
                       confidence, confidenceNote, caution,
                       whyChanged, structuredData }
   }
============================================================ */

const Store = (() => {
  const PROFILE_KEY = 'striate_profile_v1';
  const ENTRIES_KEY = 'striate_entries_v1';

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
    return profile;
  }

  // ---- Entries (check-in + recommendation pairs) ----
  function getEntries() {
    try {
      return JSON.parse(localStorage.getItem(ENTRIES_KEY)) || [];
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
    // One entry per day: a new check-in today replaces today's entry.
    const filtered = entries.filter((e) => e.date !== date);
    filtered.unshift(entry);
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(filtered.slice(0, 90)));
    return entry;
  }

  function getTodayEntry() {
    return getEntries().find((e) => e.date === todayKey()) || null;
  }

  function getLastEntryBefore(date) {
    return getEntries().find((e) => e.date < date) || null;
  }

  function clearAll() {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(ENTRIES_KEY);
  }

  return {
    getProfile, saveProfile,
    getEntries, saveEntry, getTodayEntry, getLastEntryBefore,
    todayKey, clearAll,
  };
})();
