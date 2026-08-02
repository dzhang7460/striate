/* ============================================================
   Striate — checkin.js
   Daily check-in form → generate recommendation → save → /today
============================================================ */

(function () {
  if (!UI.requireProfile()) return;

  UI.initChipGroups();
  UI.initScaleGroups();
  UI.renderTabbar('checkin');

  // Header date
  document.getElementById('date-label').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  // Note if already checked in today
  if (Store.getTodayEntry()) {
    document.getElementById('already-note').classList.remove('hidden');
  }

  // Pre-select dedicatedWorkoutTime from profile if available
  const profile = Store.getProfile();
  const defaultTime = profile && profile.dedicatedWorkoutTime ? profile.dedicatedWorkoutTime : '5-6 PM';
  const timeChipGroup = document.querySelector('.chip-group[data-name="dedicatedWorkoutTime"]');
  if (timeChipGroup) {
    const matchingChip = timeChipGroup.querySelector(`.chip[data-value="${CSS.escape(defaultTime)}"]`);
    if (matchingChip) {
      matchingChip.click();
    } else {
      const defaultChip = timeChipGroup.querySelector(`.chip[data-value="5-6 PM"]`);
      if (defaultChip) defaultChip.click();
    }
  }

  const checkinCustomInput = document.getElementById('checkin-custom-time');
  document.addEventListener('chipchange', (e) => {
    if (e.target.dataset.name === 'dedicatedWorkoutTime') {
      const val = UI.chipValue('dedicatedWorkoutTime');
      if (checkinCustomInput) {
        checkinCustomInput.classList.toggle('hidden', val !== 'custom');
      }
    }
  });

  // The "none" default chip needs its group value set.
  const constraintGroup = document.querySelector('.chip-group[data-name="specialConstraint"]');
  if (constraintGroup) {
    constraintGroup.dataset.value = 'none';
  }

  const submitBtn = document.getElementById('submit-btn');
  const msg = document.getElementById('validation-msg');

  function validate() {
    const required = [
      ['sleep', 'How did you sleep last night?'],
      ['energy', 'Rate your energy (1–5).'],
      ['soreness', 'Rate your soreness (1–5).'],
      ['mood', 'Rate your mood (1–5).'],
      ['timeAvailable', 'How much time do you have today?'],
      ['dedicatedWorkoutTime', 'Pick a dedicated workout time today.'],
    ];
    for (const [name, text] of required) {
      // FIX: Fail only if it is missing BOTH a chip value AND a scale value
      if (!UI.chipValue(name) && !UI.scaleValue(name)) return text;
    }
    return null;
  }

  submitBtn.addEventListener('click', async () => {
    const err = validate();
    if (err) {
      msg.textContent = err;
      msg.classList.remove('hidden');
      msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    msg.classList.add('hidden');

    let dedicatedTime = UI.chipValue('dedicatedWorkoutTime') || '5-6 PM';
    if (dedicatedTime === 'custom') {
      dedicatedTime = checkinCustomInput?.value.trim() || '5-6 PM';
    }

    const checkin = {
      sleep: UI.chipValue('sleep'),
      energy: Number(UI.scaleValue('energy') || UI.chipValue('energy')), 
      soreness: Number(UI.scaleValue('soreness') || UI.chipValue('soreness')),
      mood: Number(UI.scaleValue('mood') || UI.chipValue('mood')),
      timeAvailable: UI.chipValue('timeAvailable'),
      dedicatedWorkoutTime: dedicatedTime,
      specialConstraint: UI.chipValue('specialConstraint') || 'none',
      extraNote: document.getElementById('note-input').value.trim(),
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Building today\'s plan…';

    try {
      const profile = Store.getProfile();
      const prevEntry = Store.getLastEntryBefore(Store.todayKey());
      const entryCount = Store.getEntries().filter((e) => e.date !== Store.todayKey()).length + 1;
      const recentCompletions = Store.getRecentCompletions(7);
      const recommendation = await Coach.generate(profile, checkin, prevEntry, entryCount, {
        recentCompletions,
        prevCompletion: Store.getCompletionLog(prevEntry ? prevEntry.date : null)
      });
      Store.saveEntry(checkin, recommendation);
      window.location.href = 'today.html';
    } catch (e) {
      console.error('[Striate CheckIn] Error generating plan:', e);
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Get today\'s plan <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
      msg.textContent = 'Something went wrong generating your plan. Please try again.';
      msg.classList.remove('hidden');
    }
  });
})();