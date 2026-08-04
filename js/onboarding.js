/* ============================================================
   Striate — onboarding.js
   Onboarding + profile edit.
   - Sleep-first schedule preferences
   - Device cutoff preference
   - Training method memory
   - Realism / friction notes
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
  const customTimeInput = document.getElementById('custom-workout-time');
  const soccerFocusField = document.getElementById('soccer-focus-field');
  const trainingMethodsInput = document.getElementById('training-methods-input');
  const scheduleNoteInput = document.getElementById('schedule-note-input');

  UI.initChipGroups();
  UI.initScaleGroups();
  UI.initMultiChipGroups();

  document.addEventListener('chipchange', (e) => {
    if (e.target.dataset.name === 'dedicatedWorkoutTime') {
      const val = UI.chipValue('dedicatedWorkoutTime');
      if (customTimeInput) {
        customTimeInput.classList.toggle('hidden', val !== 'custom');
      }
    }

    if (e.target.dataset.name === 'goal') {
      const val = UI.chipValue('goal');
      if (soccerFocusField) {
        soccerFocusField.classList.toggle('hidden', val !== 'soccer');
      }
    }
  });

  function showError(text) {
    msg.textContent = text;
    msg.classList.remove('hidden');
  }

  function hideError() {
    msg.classList.add('hidden');
  }

  function selectedMultiValues(name) {
    const group = document.querySelector(`.chip-group[data-name="${name}"]`);
    if (!group) return [];
    try {
      const raw = JSON.parse(group.dataset.value || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function splitCsv(value) {
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function collectTrainingMethods() {
    const selected = selectedMultiValues('trainingMethods');
    const custom = splitCsv(trainingMethodsInput?.value || '');
    const combined = [...selected, ...custom];
    const seen = new Set();

    return combined
      .filter((name) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((name) => ({
        id: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        name,
        source: selected.includes(name) ? 'onboarding-chip' : 'custom',
        addedAt: Date.now(),
      }));
  }

  function prefillMultiChipGroup(name, values) {
    const group = document.querySelector(`.chip-group[data-name="${name}"]`);
    if (!group || !Array.isArray(values)) return [];

    const unmatched = [];
    group.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('selected'));

    values.forEach((value) => {
      const needle = typeof value === 'string' ? value : value?.name;
      if (!needle) return;
      const chip = group.querySelector(`.chip[data-value="${CSS.escape(String(needle))}"]`);
      if (chip) {
        chip.classList.add('selected');
      } else {
        unmatched.push(needle);
      }
    });

    group.dataset.value = JSON.stringify(
      [...group.querySelectorAll('.chip.selected')].map((chip) => chip.dataset.value)
    );

    return unmatched;
  }

  function showStep(n) {
    step = n;
    steps.forEach((section) => {
      section.classList.toggle('hidden', Number(section.dataset.step) !== n);
    });
    fill.style.width = `${(n / TOTAL_STEPS) * 100}%`;
    count.textContent = `Step ${n} of ${TOTAL_STEPS}`;
    nextBtn.textContent = n === TOTAL_STEPS
      ? (isEdit ? 'Save profile' : 'Finish setup')
      : 'Continue';
    hideError();
    window.scrollTo({ top: 0 });
  }

  function validateStep(n) {
    if (n === 1) {
      if (!UI.chipValue('ageRange')) return 'Pick an age range.';
      const height = Number(document.getElementById('height-input').value);
      const weight = Number(document.getElementById('weight-input').value);
      if (!height || height < 100 || height > 250) return 'Enter a height between 100 and 250 cm.';
      if (!weight || weight < 30 || weight > 300) return 'Enter a weight between 30 and 300 kg.';
    }

    if (n === 2) {
      if (!UI.chipValue('goal')) return 'Pick a primary goal.';
      if (!UI.chipValue('experienceLevel')) return 'Pick your experience level.';
    }

    if (n === 3) {
      if (!UI.scaleValue('availableDays')) return 'Pick how many days you can realistically train.';
      if (!UI.chipValue('availableTime')) return 'Pick a typical session length.';
      if (!UI.chipValue('sleepSchedule')) return 'Pick your usual bedtime.';
      if (!UI.chipValue('wakeTimeTarget')) return 'Pick a target wake-up time.';
      if (!UI.chipValue('deviceCutoffMinutes')) return 'Pick a realistic device cutoff before bed.';
      if (!UI.chipValue('dedicatedWorkoutTime')) return 'Pick a dedicated workout time window.';
    }

    if (n === 4) {
      const equipment = selectedMultiValues('equipment');
      if (equipment.length === 0) return 'Select your equipment access (or "None / bodyweight").';
    }

    return null;
  }

  function finish() {
    const existingProfile = Store.getProfile() || {};
    const equipment = selectedMultiValues('equipment');
    const trainingMethods = collectTrainingMethods();

    let soccerFocus = [];
    if (UI.chipValue('goal') === 'soccer' && soccerFocusField) {
      soccerFocus = selectedMultiValues('soccerFocus');
    }

    let workoutTime = UI.chipValue('dedicatedWorkoutTime') || '5-6 PM';
    let customWorkoutTimeNote = '';
    if (workoutTime === 'custom') {
      customWorkoutTimeNote = customTimeInput?.value.trim() || 'Evening';
      workoutTime = customWorkoutTimeNote;
    }

    const deviceCutoffMinutes = Number(UI.chipValue('deviceCutoffMinutes') || existingProfile.deviceCutoffMinutes || 30);

    Store.saveProfile({
      ...existingProfile,
      ageRange: UI.chipValue('ageRange'),
      heightCm: Number(document.getElementById('height-input').value),
      weightKg: Number(document.getElementById('weight-input').value),
      goal: UI.chipValue('goal'),
      soccerFocus,
      experienceLevel: UI.chipValue('experienceLevel'),
      availableDays: UI.scaleValue('availableDays'),
      availableTime: UI.chipValue('availableTime'),
      sleepSchedule: UI.chipValue('sleepSchedule'),
      wakeTimeTarget: UI.chipValue('wakeTimeTarget') || '7:00 AM',
      deviceCutoffMinutes,
      dedicatedWorkoutTime: workoutTime,
      customWorkoutTimeNote,
      equipment,
      injuryNotes: document.getElementById('injury-input').value.trim(),
      preferences: {
        ...(existingProfile.preferences || {}),
        trainingMethods,
        scheduleNotes: scheduleNoteInput?.value.trim() || '',
        deviceCutoffMinutes,
      },
    });

    window.location.href = isEdit ? 'today.html' : 'check-in.html';
  }

  function prefillProfile() {
    const profile = Store.getProfile();
    if (!profile) return;

    UI.setChipValue('ageRange', profile.ageRange);
    UI.setChipValue('goal', profile.goal);
    UI.setChipValue('experienceLevel', profile.experienceLevel);
    UI.setScaleValue('availableDays', profile.availableDays);
    UI.setChipValue('availableTime', profile.availableTime);
    UI.setChipValue('sleepSchedule', profile.sleepSchedule);
    UI.setChipValue('wakeTimeTarget', profile.wakeTimeTarget || '7:00 AM');
    UI.setChipValue('deviceCutoffMinutes', String(profile.deviceCutoffMinutes || profile.preferences?.deviceCutoffMinutes || 30));
    UI.setChipValue('dedicatedWorkoutTime', profile.dedicatedWorkoutTime || '5-6 PM');

    if (profile.goal === 'soccer' && soccerFocusField) {
      soccerFocusField.classList.remove('hidden');
      prefillMultiChipGroup('soccerFocus', profile.soccerFocus || []);
    }

    if (profile.dedicatedWorkoutTime === 'custom' && customTimeInput) {
      customTimeInput.classList.remove('hidden');
      customTimeInput.value = profile.customWorkoutTimeNote || '';
    }

    prefillMultiChipGroup('equipment', profile.equipment || []);
    const unmatchedMethods = prefillMultiChipGroup('trainingMethods', profile.preferences?.trainingMethods || []);

    document.getElementById('height-input').value = profile.heightCm || '';
    document.getElementById('weight-input').value = profile.weightKg || '';
    document.getElementById('injury-input').value = profile.injuryNotes || '';
    if (trainingMethodsInput) trainingMethodsInput.value = unmatchedMethods.join(', ');
    if (scheduleNoteInput) scheduleNoteInput.value = profile.preferences?.scheduleNotes || '';
    document.querySelector('h1').textContent = 'Edit profile';
  }

  if (isEdit) {
    prefillProfile();
  } else {
    UI.setChipValue('wakeTimeTarget', '7:00 AM');
    UI.setChipValue('deviceCutoffMinutes', '30');
    UI.setChipValue('dedicatedWorkoutTime', '5-6 PM');
  }

  nextBtn.addEventListener('click', () => {
    const error = validateStep(step);
    if (error) {
      showError(error);
      return;
    }

    if (step < TOTAL_STEPS) showStep(step + 1);
    else finish();
  });

  backBtn.addEventListener('click', () => {
    if (step > 1) showStep(step - 1);
    else window.location.href = isEdit ? 'today.html' : 'index.html';
  });

  showStep(1);
})();
