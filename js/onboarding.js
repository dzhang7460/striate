/* ============================================================
   Striate — onboarding.js
   4-step onboarding flow. Also serves as "edit profile"
   when opened with ?edit=1 (prefills saved values).
============================================================ */

(function () {
  const TOTAL_STEPS = 4;
  let step = 1;

  const isEdit = new URLSearchParams(location.search).get('edit') === '1' && !!Store.getProfile();

  const steps = [...document.querySelectorAll('.onb-step')];
  const fill = document.getElementById('progress-fill');
  const count = document.getElementById('step-count');
  const nextBtn = document.getElementById('next-btn');
  const backBtn = document.getElementById('back-btn');
  const msg = document.getElementById('validation-msg');

  UI.initChipGroups();
  UI.initMultiChipGroups();

  // Prefill in edit mode
  if (isEdit) {
    const p = Store.getProfile();
    UI.setChipValue('ageRange', p.ageRange);
    UI.setChipValue('goal', p.goal);
    UI.setChipValue('experienceLevel', p.experienceLevel);
    UI.setChipValue('availableDays', p.availableDays);
    UI.setChipValue('availableTime', p.availableTime);
    UI.setChipValue('sleepSchedule', p.sleepSchedule);
    (p.equipment || []).forEach((eq) => {
      const chip = document.querySelector(`.chip-group[data-name="equipment"] .chip[data-value="${CSS.escape(eq)}"]`);
      if (chip && !chip.classList.contains('selected')) chip.click();
    });
    document.getElementById('height-input').value = p.heightCm || '';
    document.getElementById('weight-input').value = p.weightKg || '';
    document.getElementById('injury-input').value = p.injuryNotes || '';
    document.querySelector('h1').textContent = 'Edit profile';
  }

  function showStep(n) {
    step = n;
    steps.forEach((s) => s.classList.toggle('hidden', Number(s.dataset.step) !== n));
    fill.style.width = `${(n / TOTAL_STEPS) * 100}%`;
    count.textContent = `Step ${n} of ${TOTAL_STEPS}`;
    nextBtn.textContent = n === TOTAL_STEPS ? (isEdit ? 'Save profile' : 'Finish setup') : 'Continue';
    hideError();
    window.scrollTo({ top: 0 });
  }

  function showError(text) {
    msg.textContent = text;
    msg.classList.remove('hidden');
  }
  function hideError() { msg.classList.add('hidden'); }

  function validateStep(n) {
    if (n === 1) {
      if (!UI.chipValue('ageRange')) return 'Pick an age range.';
      const h = Number(document.getElementById('height-input').value);
      const w = Number(document.getElementById('weight-input').value);
      if (!h || h < 100 || h > 250) return 'Enter a height between 100 and 250 cm.';
      if (!w || w < 30 || w > 300) return 'Enter a weight between 30 and 300 kg.';
    }
    if (n === 2) {
      if (!UI.chipValue('goal')) return 'Pick a primary goal.';
      if (!UI.chipValue('experienceLevel')) return 'Pick your experience level.';
    }
    if (n === 3) {
      if (!UI.chipValue('availableDays')) return 'Pick how many days you can train.';
      if (!UI.chipValue('availableTime')) return 'Pick a typical session length.';
      if (!UI.chipValue('sleepSchedule')) return 'Pick your usual bedtime.';
    }
    if (n === 4) {
      const eq = JSON.parse(document.querySelector('.chip-group[data-name="equipment"]').dataset.value || '[]');
      if (eq.length === 0) return 'Select your equipment access (or "None / bodyweight").';
    }
    return null;
  }

  function finish() {
    const equipment = JSON.parse(document.querySelector('.chip-group[data-name="equipment"]').dataset.value || '[]');
    Store.saveProfile({
      ageRange: UI.chipValue('ageRange'),
      heightCm: Number(document.getElementById('height-input').value),
      weightKg: Number(document.getElementById('weight-input').value),
      goal: UI.chipValue('goal'),
      experienceLevel: UI.chipValue('experienceLevel'),
      availableDays: UI.chipValue('availableDays'),
      availableTime: UI.chipValue('availableTime'),
      sleepSchedule: UI.chipValue('sleepSchedule'),
      equipment,
      injuryNotes: document.getElementById('injury-input').value.trim(),
    });
    window.location.href = isEdit ? 'today.html' : 'check-in.html';
  }

  nextBtn.addEventListener('click', () => {
    const err = validateStep(step);
    if (err) { showError(err); return; }
    if (step < TOTAL_STEPS) showStep(step + 1);
    else finish();
  });

  backBtn.addEventListener('click', () => {
    if (step > 1) showStep(step - 1);
    else window.location.href = isEdit ? 'today.html' : 'index.html';
  });

  showStep(1);
})();
