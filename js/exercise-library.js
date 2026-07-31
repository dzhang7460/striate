/* ============================================================
   Striate — exercise-library.js
   Searchable Exercise Library Page Controller.
   - Searches & filters WorkoutX exercises via /api/exercises/search
   - Mobile-first low-friction search UX with filter chips
   - Graceful client-side fallback when offline / static hosting
   - Exercise Detail Drawer with "Use this in a workout" action
     that saves to user's profile memory & preferences
============================================================ */

(function () {
  if (!UI.requireProfile()) return;
  UI.renderTabbar('exercises');
  if (typeof StriateDebug !== 'undefined') StriateDebug.init();

  const debugBtn = document.getElementById('debug-toggle-btn');
  if (debugBtn && typeof StriateDebug !== 'undefined') {
    debugBtn.addEventListener('click', () => StriateDebug.open());
  }

  const searchInput = document.getElementById('exercise-search-input');
  const resetBtn = document.getElementById('reset-filters-btn');
  const resultsList = document.getElementById('exercise-results-list');
  const countLabel = document.getElementById('exercise-count-label');
  const drawerRoot = document.getElementById('exercise-detail-drawer-root');
  const esc = UI.esc;

  UI.initChipGroups();

  let searchTimeout = null;

  async function loadExercises() {
    resultsList.innerHTML = `
      <div class="card text-center" style="padding:40px 20px;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size:24px; color:var(--accent);"></i>
        <p class="small muted mt-2">Loading exercises...</p>
      </div>
    `;

    const name = searchInput.value.trim();
    const bodyPart = UI.chipValue('bodyPartFilter');
    const equipment = UI.chipValue('equipmentFilter');
    const effortLevel = UI.chipValue('effortFilter');

    const params = new URLSearchParams();
    if (name) params.set('name', name);
    if (bodyPart && bodyPart !== 'all') params.set('bodyPart', bodyPart);
    if (equipment && equipment !== 'all') params.set('equipment', equipment);
    if (effortLevel && effortLevel !== 'all') params.set('effortLevel', effortLevel);

    let data = [];
    try {
      const res = await fetch(`/api/exercises/search?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      data = json.data || [];
    } catch (err) {
      console.warn('[Striate Exercise Library] API fetch failed, using local fallback database:', err.message);
      data = filterLocalFallback(name, bodyPart, equipment, effortLevel);
    }

    renderResults(data);
  }

  function filterLocalFallback(name, bodyPart, equipment, effortLevel) {
    const list = Coach.getTemplates ? Object.values(Coach.getTemplates()).map((t) => ({
      id: t.id,
      name: t.title,
      bodyPart: 'full body',
      target: 'general',
      equipment: 'body weight',
      effortLevel: 'beginner',
      instructions: [t.detail],
      gifUrl: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80',
    })) : [];

    // Combine with local mock library if available via fetch / window
    return list.filter((e) => {
      if (name && !e.name.toLowerCase().includes(name.toLowerCase())) return false;
      if (bodyPart && bodyPart !== 'all' && !e.bodyPart.includes(bodyPart)) return false;
      if (equipment && equipment !== 'all' && !e.equipment.includes(equipment)) return false;
      if (effortLevel && effortLevel !== 'all' && e.effortLevel !== effortLevel) return false;
      return true;
    });
  }

  function renderResults(list) {
    countLabel.textContent = `${list.length} exercise${list.length === 1 ? '' : 's'}`;

    if (list.length === 0) {
      resultsList.innerHTML = `
        <div class="card text-center" style="padding:40px 20px;">
          <i class="fa-solid fa-dumbbell" style="font-size:30px; color:var(--text-faint);"></i>
          <h2 class="mt-2">No exercises found</h2>
          <p class="muted small mt-1">Try searching a different name or clearing your filters.</p>
          <button class="btn btn-secondary mt-3" id="empty-reset-btn" style="width:auto; margin:0 auto; padding:10px 18px;">Reset filters</button>
        </div>
      `;
      document.getElementById('empty-reset-btn')?.addEventListener('click', resetAllFilters);
      return;
    }

    resultsList.innerHTML = list.map((e) => {
      const isPref = Store.isPreferredExercise(e.id);
      return `
        <div class="exercise-card" data-id="${esc(e.id)}">
          <img class="exercise-card-thumb" src="${esc(e.gifUrl || 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80')}" alt="${esc(e.name)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80'">
          <div class="exercise-card-info">
            <div class="row between">
              <strong class="exercise-card-title">${esc(e.name)}</strong>
              ${isPref ? '<span class="badge badge-high" style="font-size:10px;">★ Saved</span>' : ''}
            </div>
            <div class="exercise-card-meta">
              <span class="badge badge-neutral">${esc(e.bodyPart)}</span>
              <span class="badge badge-neutral">${esc(e.equipment)}</span>
              <span class="badge ${e.effortLevel === 'beginner' ? 'badge-high' : 'badge-medium'}">${esc(e.effortLevel)}</span>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right muted" style="font-size:14px;"></i>
        </div>
      `;
    }).join('');

    resultsList.querySelectorAll('.exercise-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const match = list.find((item) => item.id === id);
        if (match) openExerciseDrawer(match);
      });
    });
  }

  function openExerciseDrawer(exercise) {
    const isPref = Store.isPreferredExercise(exercise.id);
    const instructionsHtml = (exercise.instructions || []).map((ins, i) => `
      <li style="margin-left:18px; margin-bottom:6px; font-size:14px; line-height:1.4;">${esc(ins)}</li>
    `).join('');

    const tipsHtml = (exercise.formTips || []).map((tip) => `
      <li style="margin-left:18px; margin-bottom:4px; font-size:13px; color:var(--amber);">${esc(tip)}</li>
    `).join('');

    const altHtml = (exercise.alternatives || []).map((a) => `
      <span class="badge badge-neutral" style="font-size:12px;">${esc(a)}</span>
    `).join(' ');

    drawerRoot.innerHTML = `
      <div class="exercise-drawer-content">
        <div class="row between mb-2">
          <div>
            <span class="kicker" style="margin-bottom:2px;">${esc(exercise.bodyPart)} · ${esc(exercise.target)}</span>
            <h2 style="font-size:20px; color:var(--text);">${esc(exercise.name)}</h2>
          </div>
          <button class="btn-ghost" id="close-drawer-btn" style="padding:6px 10px; font-size:16px;" title="Close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <img class="exercise-drawer-gif" src="${esc(exercise.gifUrl)}" alt="${esc(exercise.name)}" onerror="this.src='https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=400&q=80'">

        <div class="row mb-2" style="flex-wrap:wrap; gap:6px;">
          <span class="badge badge-neutral"><i class="fa-solid fa-dumbbell"></i> ${esc(exercise.equipment)}</span>
          <span class="badge ${exercise.effortLevel === 'beginner' ? 'badge-high' : 'badge-medium'}">${esc(exercise.effortLevel)}</span>
          ${exercise.mechanics ? `<span class="badge badge-neutral">${esc(exercise.mechanics)}</span>` : ''}
          ${exercise.force ? `<span class="badge badge-neutral">${esc(exercise.force)}</span>` : ''}
          ${exercise.caloriesPerMinute ? `<span class="badge badge-neutral">~${exercise.caloriesPerMinute} kcal/min</span>` : ''}
        </div>

        <p class="kicker mt-2">Instructions</p>
        <ol class="mt-1 mb-2">${instructionsHtml}</ol>

        ${tipsHtml ? `
          <p class="kicker mt-2" style="color:var(--amber);"><i class="fa-solid fa-triangle-exclamation"></i> Form Cues &amp; Safety</p>
          <ul class="mt-1 mb-2">${tipsHtml}</ul>
        ` : ''}

        ${altHtml ? `
          <p class="kicker mt-2">Alternatives</p>
          <div class="row mb-3" style="flex-wrap:wrap; gap:6px;">${altHtml}</div>
        ` : ''}

        <!-- "Use this in a workout" action -->
        <div class="row" style="gap:10px;">
          <button class="btn ${isPref ? 'btn-secondary' : 'btn-primary'}" id="use-exercise-btn" style="flex:1;">
            <i class="fa-solid ${isPref ? 'fa-check' : 'fa-plus'}"></i>
            <span>${isPref ? '✅ Saved to Preferred Exercises' : 'Use this in a workout'}</span>
          </button>
          ${isPref ? `
            <button class="btn btn-secondary" id="remove-exercise-btn" style="width:auto; color:var(--red); padding:12px 14px;" title="Remove from preferred">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;

    drawerRoot.classList.remove('hidden');

    document.getElementById('close-drawer-btn')?.addEventListener('click', closeDrawer);
    drawerRoot.addEventListener('click', (e) => {
      if (e.target === drawerRoot) closeDrawer();
    });

    const useBtn = document.getElementById('use-exercise-btn');
    useBtn?.addEventListener('click', () => {
      if (!Store.isPreferredExercise(exercise.id)) {
        Store.savePreferredExercise(exercise);
        UI.showToast(`Saved "${exercise.name}"! Striate AI will include it in your workouts.`);
        openExerciseDrawer(exercise);
        loadExercises();
      } else {
        UI.showToast(`"${exercise.name}" is already saved in your preferences.`);
      }
    });

    const removeBtn = document.getElementById('remove-exercise-btn');
    removeBtn?.addEventListener('click', () => {
      Store.removePreferredExercise(exercise.id);
      UI.showToast(`Removed "${exercise.name}" from preferred exercises.`);
      openExerciseDrawer(exercise);
      loadExercises();
    });
  }

  function closeDrawer() {
    drawerRoot.classList.add('hidden');
  }

  function resetAllFilters() {
    searchInput.value = '';
    UI.setChipValue('bodyPartFilter', 'all');
    UI.setChipValue('equipmentFilter', 'all');
    UI.setChipValue('effortFilter', 'all');
    loadExercises();
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadExercises, 250);
  });

  resetBtn.addEventListener('click', resetAllFilters);

  document.addEventListener('chipchange', (e) => {
    if (['bodyPartFilter', 'equipmentFilter', 'effortFilter'].includes(e.target.dataset.name)) {
      loadExercises();
    }
  });

  // Check URL param for deep linking
  const urlId = new URLSearchParams(location.search).get('id');
  if (urlId) {
    loadExercises().then(async () => {
      try {
        const res = await fetch(`/api/exercises/${encodeURIComponent(urlId)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data) openExerciseDrawer(json.data);
        }
      } catch {}
    });
  } else {
    loadExercises();
  }
})();
