/* ============================================================
   Striate — checkin.js
   Daily check-in form → generate recommendation → save → /today
============================================================ */

(function () {
  if (!UI.requireProfile()) return;

  UI.initChipGroups();
  UI.renderTabbar('checkin');

  // Header date
  document.getElementById('date-label').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  // Note if already checked in today
  if (Store.getTodayEntry()) {
    document.getElementById('already-note').classList.remove('hidden');
  }

  // The "none" default chip needs its group value set.
  const constraintGroup = document.querySelector('.chip-group[data-name="specialConstraint"]');
  constraintGroup.dataset.value = 'none';

  const submitBtn = document.getElementById('submit-btn');
  const msg = document.getElementById('validation-msg');

  function validate() {
    const required = [
      ['sleep', 'How did you sleep last night?'],
      ['energy', 'Rate your energy (1–5).'],
      ['soreness', 'Rate your soreness (1–5).'],
      ['mood', 'Rate your mood (1–5).'],
      ['timeAvailable', 'How much time do you have today?'],
    ];
    for (const [name, text] of required) {
      if (!UI.chipValue(name)) return text;
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

    const checkin = {
      sleep: UI.chipValue('sleep'),
      energy: Number(UI.chipValue('energy')),
      soreness: Number(UI.chipValue('soreness')),
      mood: Number(UI.chipValue('mood')),
      timeAvailable: UI.chipValue('timeAvailable'),
      specialConstraint: UI.chipValue('specialConstraint') || 'none',
      extraNote: document.getElementById('note-input').value.trim(),
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Building today\'s plan…';

    try {
      const profile = Store.getProfile();
      const prevEntry = Store.getLastEntryBefore(Store.todayKey());
      const entryCount = Store.getEntries().filter((e) => e.date !== Store.todayKey()).length + 1;
      const recommendation = await Coach.generate(profile, checkin, prevEntry, entryCount);
      Store.saveEntry(checkin, recommendation);
      window.location.href = 'today.html';
    } catch (e) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Get today\'s plan <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
      msg.textContent = 'Something went wrong generating your plan. Please try again.';
      msg.classList.remove('hidden');
    }
  });
})();
