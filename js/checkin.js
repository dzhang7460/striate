/* ============================================================
   Striate — checkin.js
   Daily check-in → generate recommendation → save → /today
============================================================ */

(function () {
  if (!UI.requireProfile()) return;

  UI.initChipGroups();
  UI.initScaleGroups();
  UI.renderTabbar('checkin');

  const profile = Store.getProfile();
  const submitBtn = document.getElementById('submit-btn');
  const msg = document.getElementById('validation-msg');
  const customTimeInput = document.getElementById('checkin-custom-time');

  document.getElementById('date-label').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  if (Store.getTodayEntry()) {
    document.getElementById('already-note').classList.remove('hidden');
  }

  // Default dedicated time from profile memory.
  UI.setChipValue('dedicatedWorkoutTime', profile?.dedicatedWorkoutTime || '5-6 PM');

  document.addEventListener('chipchange', (e) => {
    if (e.target.dataset.name === 'dedicatedWorkoutTime') {
      const value = UI.chipValue('dedicatedWorkoutTime');
      if (customTimeInput) {
        customTimeInput.classList.toggle('hidden', value !== 'custom');
      }
    }
  });

  // Give the optional constraint a default value.
  const constraintGroup = document.querySelector('.chip-group[data-name="specialConstraint"]');
  if (constraintGroup && !constraintGroup.dataset.value) {
    constraintGroup.dataset.value = 'none';
  }

  function validate() {
    const required = [
      ['sleep', 'Log how much you slept last night.'],
      ['sleepQuality', 'Rate your sleep quality (1–5).'],
      ['energy', 'Rate your energy (1–5).'],
      ['soreness', 'Rate your soreness (1–5).'],
      ['mood', 'Rate your mood (1–5).'],
      ['bedtimeConsistency', 'Log how close you were to your target bedtime.'],
      ['screenCutoff', 'Log whether you cut off screens before bed.'],
      ['timeAvailable', 'Pick how much time you have today.'],
      ['dedicatedWorkoutTime', 'Pick a dedicated workout time today.'],
    ];

    for (const [name, text] of required) {
      if (!UI.chipValue(name) && !UI.scaleValue(name)) return text;
    }

    return null;
  }

  submitBtn.addEventListener('click', async () => {
    const error = validate();
    if (error) {
      msg.textContent = error;
      msg.classList.remove('hidden');
      msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    msg.classList.add('hidden');

    let dedicatedWorkoutTime = UI.chipValue('dedicatedWorkoutTime') || '5-6 PM';
    if (dedicatedWorkoutTime === 'custom') {
      dedicatedWorkoutTime = customTimeInput?.value.trim() || profile?.dedicatedWorkoutTime || '5-6 PM';
    }

    const checkin = {
      sleep: UI.chipValue('sleep'),
      sleepQuality: Number(UI.scaleValue('sleepQuality') || UI.chipValue('sleepQuality')),
      bedtimeConsistency: UI.chipValue('bedtimeConsistency'),
      screenCutoff: UI.chipValue('screenCutoff'),
      energy: Number(UI.scaleValue('energy') || UI.chipValue('energy')),
      soreness: Number(UI.scaleValue('soreness') || UI.chipValue('soreness')),
      mood: Number(UI.scaleValue('mood') || UI.chipValue('mood')),
      timeAvailable: UI.chipValue('timeAvailable'),
      dedicatedWorkoutTime,
      specialConstraint: UI.chipValue('specialConstraint') || 'none',
      extraNote: document.getElementById('note-input').value.trim(),
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Building today\'s plan…';

    try {
      const prevEntry = Store.getLastEntryBefore(Store.todayKey());
      const entryCount = Store.getEntries().filter((item) => item.date !== Store.todayKey()).length + 1;
      const recentCompletions = Store.getRecentCompletions(7);
      const recentSleepLogs = Store.getRecentSleepLogs(7);
      const weeklyReview = Store.getWeeklyReviewSummary();
      const recentAdvice = Store.getRecentAdviceHistory(8);

      const recommendation = await Coach.generate(profile, checkin, prevEntry, entryCount, {
        recentCompletions,
        recentSleepLogs,
        recentAdvice,
        weeklyReview,
        prevCompletion: Store.getCompletionLog(prevEntry ? prevEntry.date : null),
      });

      Store.saveEntry(checkin, recommendation);
      window.location.href = 'today.html';
    } catch (err) {
      console.error('[Striate CheckIn] Error generating plan:', err);
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Get today\'s plan <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
      msg.textContent = 'Something went wrong generating your plan. Please try again.';
      msg.classList.remove('hidden');
    }
  });
})();
