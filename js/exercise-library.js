/* ============================================================
   Striate — exercise-library.js
   - Real exercise browsing with WorkoutX-backed filters
   - Dynamic chips from API-supported values
   - Deep-linkable detail drawer
   - Save preferred / avoid exercise memory
============================================================ */

(() => {
  'use strict';

  const els = {
    searchInput: document.getElementById('exercise-search-input'),
    resetBtn: document.getElementById('reset-filters-btn'),
    resultsList: document.getElementById('exercise-results-list'),
    countLabel: document.getElementById('exercise-count-label'),
    drawerRoot: document.getElementById('exercise-detail-drawer-root'),
    debugBtn: document.getElementById('debug-toggle-btn'),
  };

  const state = {
    allExercises: [],
    visibleCount: 12,
    pageSize: 12,
    requestSeq: 0,
    observer: null,
    sentinel: null,
    metadataLoaded: false,
  };

  const DEFAULTS = {
    bodyPart: 'all',
    target: 'all',
    equipment: 'all',
    effortLevel: 'all',
    mechanics: 'all',
    force: 'all',
    isUnilateral: 'all',
    sortMethod: 'name',
    sortOrder: 'ascending',
    lang: 'en',
    limit: '100',
    offset: '0',
  };

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function debounce(fn, delay = 250) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function normalizeExercise(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      exerciseId: String(raw.exerciseId || raw.id || raw._id || ''),
      id: String(raw.id || raw.exerciseId || raw._id || ''),
      name: String(raw.name || raw.title || 'Unnamed Exercise').trim(),
      bodyPart: String(raw.bodyPart || raw.category || 'unknown').toLowerCase(),
      target: String(raw.target || raw.targetMuscle || raw.muscle || 'general').toLowerCase(),
      equipment: String(raw.equipment || 'body weight').toLowerCase(),
      effortLevel: String(raw.effortLevel || raw.difficulty || 'beginner').toLowerCase(),
      mechanics: raw.mechanics ? String(raw.mechanics).toLowerCase() : '',
      force: raw.force ? String(raw.force).toLowerCase() : '',
      isUnilateral: Boolean(raw.isUnilateral || raw.unilateral || false),
      gifUrl: String(raw.gifUrl || raw.imageUrl || raw.image || raw.thumbnail || ''),
      instructions: Array.isArray(raw.instructions)
        ? raw.instructions.map(String)
        : typeof raw.instructions === 'string' && raw.instructions.trim()
          ? [raw.instructions]
          : ['Perform with control and stop if form breaks down.'],
      secondaryMuscles: Array.isArray(raw.secondaryMuscles) ? raw.secondaryMuscles.map(String) : [],
      caloriesPerMinute: typeof raw.caloriesPerMinute === 'number' ? raw.caloriesPerMinute : null,
      formTips: Array.isArray(raw.formTips) ? raw.formTips.map(String) : [],
      alternatives: Array.isArray(raw.alternatives) ? raw.alternatives.map(String) : [],
    };
  }

  function buildAdvancedFilters() {
    if (qs('#advanced-workoutx-filters')) return;
    const bar = qs('.exercise-search-bar');
    if (!bar) return;

    const panel = document.createElement('details');
    panel.id = 'advanced-workoutx-filters';
    panel.className = 'mt-2';
    panel.innerHTML = `
      <summary style="cursor:pointer; font-weight:600; margin-bottom:10px;">Advanced filters</summary>
      <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:10px;">
        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Mechanics</span>
          <select id="filter-mechanics">
            <option value="all">All</option>
            <option value="compound">Compound</option>
            <option value="isolation">Isolation</option>
            <option value="isometric">Isometric</option>
            <option value="plyometric">Plyometric</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Force</span>
          <select id="filter-force">
            <option value="all">All</option>
            <option value="push">Push</option>
            <option value="pull">Pull</option>
            <option value="static">Static</option>
            <option value="cardio">Cardio</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Unilateral</span>
          <select id="filter-is-unilateral">
            <option value="all">All</option>
            <option value="true">Single-sided only</option>
            <option value="false">Two-sided only</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Sort method</span>
          <select id="filter-sort-method">
            <option value="name">Name</option>
            <option value="bodyPart">Body part</option>
            <option value="target">Target</option>
            <option value="equipment">Equipment</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Sort order</span>
          <select id="filter-sort-order">
            <option value="ascending">Ascending</option>
            <option value="descending">Descending</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Language</span>
          <select id="filter-lang">
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="es">Spanish</option>
            <option value="de">German</option>
            <option value="zh-SG">Chinese (SG)</option>
            <option value="zh-HK">Chinese (HK)</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Limit</span>
          <select id="filter-limit">
            <option value="20">20</option>
            <option value="40">40</option>
            <option value="60">60</option>
            <option value="100" selected>100</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Offset</span>
          <input type="number" id="filter-offset" min="0" step="1" value="0">
        </label>
      </div>
    `;

    bar.insertAdjacentElement('afterend', panel);
  }

  function activeChipValue(groupName) {
    const group = qs(`.exercise-filter-group[data-name="${groupName}"]`);
    const selected = group?.querySelector('.chip.selected');
    return selected?.dataset?.value || 'all';
  }

  function setActiveChip(groupName, value) {
    const group = qs(`.exercise-filter-group[data-name="${groupName}"]`);
    if (!group) return;
    qsa('.chip', group).forEach((chip) => {
      chip.classList.toggle('selected', chip.dataset.value === value);
    });
  }

  function currentAdvancedFilters() {
    return {
      mechanics: qs('#filter-mechanics')?.value || DEFAULTS.mechanics,
      force: qs('#filter-force')?.value || DEFAULTS.force,
      isUnilateral: qs('#filter-is-unilateral')?.value || DEFAULTS.isUnilateral,
      sortMethod: qs('#filter-sort-method')?.value || DEFAULTS.sortMethod,
      sortOrder: qs('#filter-sort-order')?.value || DEFAULTS.sortOrder,
      lang: qs('#filter-lang')?.value || DEFAULTS.lang,
      limit: qs('#filter-limit')?.value || DEFAULTS.limit,
      offset: qs('#filter-offset')?.value || DEFAULTS.offset,
    };
  }

  function buildFilters() {
    const advanced = currentAdvancedFilters();
    return {
      name: (els.searchInput?.value || '').trim(),
      bodyPart: activeChipValue('bodyPartFilter'),
      target: activeChipValue('targetFilter'),
      equipment: activeChipValue('equipmentFilter'),
      effortLevel: activeChipValue('effortFilter'),
      mechanics: advanced.mechanics,
      force: advanced.force,
      isUnilateral: advanced.isUnilateral,
      sortMethod: advanced.sortMethod,
      sortOrder: advanced.sortOrder,
      lang: advanced.lang,
      limit: advanced.limit,
      offset: advanced.offset,
    };
  }

  function buildQueryString(filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      const str = String(value).trim();
      if (!str || str === 'all') return;
      params.set(key, str);
    });
    return params.toString();
  }

  function updateCountLabel() {
    if (!els.countLabel) return;
    const total = state.allExercises.length;
    const visible = Math.min(state.visibleCount, total);
    els.countLabel.textContent = total ? `${visible} / ${total}` : '';
  }

  function renderSkeletons() {
    els.resultsList.innerHTML = Array.from({ length: 5 }).map(() => `
      <div class="card" style="display:grid; grid-template-columns:100px 1fr; gap:12px; padding:12px; border-radius:18px; margin-bottom:12px;">
        <div style="width:100px; height:100px; border-radius:14px; background:rgba(255,255,255,.06);"></div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div style="height:14px; width:55%; background:rgba(255,255,255,.06); border-radius:999px;"></div>
          <div style="height:12px; width:85%; background:rgba(255,255,255,.05); border-radius:999px;"></div>
          <div style="height:12px; width:70%; background:rgba(255,255,255,.05); border-radius:999px;"></div>
        </div>
      </div>
    `).join('');
    if (els.countLabel) els.countLabel.textContent = '';
  }

  function renderEmptyState(message = 'No exercises found.') {
    els.resultsList.innerHTML = `
      <div class="card" style="padding:16px;">
        <p style="margin:0 0 6px 0; font-weight:600;">${escapeHtml(message)}</p>
        <p class="muted small" style="margin:0;">Try clearing filters or broadening the search.</p>
      </div>
    `;
    updateCountLabel();
    ensureSentinel(false);
  }

  function mediaUrl(exercise) {
    return exercise.gifUrl
      ? `/api/exercises/media?url=${encodeURIComponent(exercise.gifUrl)}`
      : '';
  }

  function mediaHtml(exercise) {
    const src = mediaUrl(exercise);
    const fallbackLabel = escapeHtml((exercise.name || 'EX').slice(0, 2).toUpperCase());
    if (!src) {
      return `<div style="width:100%;height:100%;display:grid;place-items:center;background:rgba(255,255,255,.06);font-weight:700;">${fallbackLabel}</div>`;
    }
    return `
      <img
        src="${escapeHtml(src)}"
        alt="${escapeHtml(exercise.name)}"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=&quot;width:100%;height:100%;display:grid;place-items:center;background:rgba(255,255,255,.06);font-weight:700;&quot;>${fallbackLabel}</div>'"
        style="width:100%;height:100%;object-fit:cover;display:block;"
      >
    `;
  }

  function cardHtml(exercise) {
    const badges = [exercise.bodyPart, exercise.target, exercise.equipment, exercise.effortLevel]
      .filter(Boolean)
      .slice(0, 4);

    return `
      <article class="card exercise-library-card" data-exercise-id="${escapeHtml(exercise.id)}" style="display:grid;grid-template-columns:100px 1fr;gap:12px;align-items:start;padding:12px;border-radius:18px;margin-bottom:12px;cursor:pointer;">
        <div style="width:100px;height:100px;border-radius:14px;overflow:hidden;background:rgba(255,255,255,.05);">
          ${mediaHtml(exercise)}
        </div>
        <div style="min-width:0;">
          <div class="row between" style="align-items:flex-start;gap:10px;">
            <div style="min-width:0;">
              <h3 style="margin:0;font-size:16px;line-height:1.25;">${escapeHtml(exercise.name)}</h3>
              <p class="faint mt-1">ID ${escapeHtml(exercise.id)}</p>
            </div>
            <span class="badge badge-neutral" style="font-size:11px;white-space:nowrap;">${escapeHtml(exercise.effortLevel)}</span>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
            ${badges.map((badge) => `<span class="chip selected" style="padding:4px 8px;font-size:12px;min-height:auto;">${escapeHtml(badge)}</span>`).join('')}
          </div>
          <p class="muted small" style="margin:8px 0 0 0;">${escapeHtml((exercise.instructions || [])[0] || 'Tap for full details.')}</p>
        </div>
      </article>
    `;
  }

  function renderResults() {
    const visible = state.allExercises.slice(0, state.visibleCount);
    if (!visible.length) {
      renderEmptyState();
      return;
    }
    els.resultsList.innerHTML = visible.map(cardHtml).join('');
    updateCountLabel();
    ensureSentinel(state.visibleCount < state.allExercises.length);
  }

  function ensureSentinel(show) {
    if (!state.sentinel) return;
    state.sentinel.style.display = show ? 'block' : 'none';
  }

  function createSentinel() {
    if (state.sentinel) return;
    state.sentinel = document.createElement('div');
    state.sentinel.id = 'exercise-scroll-sentinel';
    state.sentinel.style.cssText = 'height:1px;width:100%;';
    els.resultsList.insertAdjacentElement('afterend', state.sentinel);
  }

  function setupObserver() {
    if (state.observer) state.observer.disconnect();
    if (!state.sentinel || !('IntersectionObserver' in window)) return;

    state.observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      if (state.visibleCount >= state.allExercises.length) {
        ensureSentinel(false);
        return;
      }
      state.visibleCount = Math.min(state.visibleCount + state.pageSize, state.allExercises.length);
      renderResults();
    }, { rootMargin: '240px', threshold: 0.1 });

    state.observer.observe(state.sentinel);
  }

  function extractList(json) {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.exercises)) return json.exercises;
    return [];
  }

  function renderFilterGroup(groupName, values, formatter) {
    const group = qs(`.exercise-filter-group[data-name="${groupName}"]`);
    if (!group) return;

    const current = activeChipValue(groupName);
    const items = Array.from(new Set(values.map(String).filter(Boolean)));
    group.innerHTML = `
      <button class="chip ${current === 'all' ? 'selected' : ''}" data-value="all">All</button>
      ${items.map((value) => `
        <button class="chip ${current === value ? 'selected' : ''}" data-value="${escapeHtml(value)}">${escapeHtml(formatter ? formatter(value) : value)}</button>
      `).join('')}
    `;

    qsa('.chip', group).forEach((chip) => {
      chip.addEventListener('click', () => {
        qsa('.chip', group).forEach((item) => item.classList.remove('selected'));
        chip.classList.add('selected');
        fetchExercises();
      });
    });
  }

  function formatLabel(value) {
    return String(value)
      .split(/[_\s-]+/)
      .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
      .join(' ');
  }

  async function loadMetadata() {
    if (state.metadataLoaded) return;

    try {
      const [bodyPartRes, targetRes, sampleRes] = await Promise.all([
        fetch('/api/exercises/bodyPartList'),
        fetch('/api/exercises/targetList'),
        fetch('/api/exercises/search?limit=100'),
      ]);

      const [bodyPartJson, targetJson, sampleJson] = await Promise.all([
        bodyPartRes.json(),
        targetRes.json(),
        sampleRes.json(),
      ]);

      const bodyParts = Array.isArray(bodyPartJson?.data) ? bodyPartJson.data : [];
      const targets = Array.isArray(targetJson?.data) ? targetJson.data : [];
      const sampleExercises = extractList(sampleJson).map(normalizeExercise).filter(Boolean);
      const equipments = [...new Set(sampleExercises.map((item) => item.equipment).filter(Boolean))].sort();

      renderFilterGroup('bodyPartFilter', bodyParts, formatLabel);
      renderFilterGroup('targetFilter', targets, formatLabel);
      renderFilterGroup('equipmentFilter', equipments, formatLabel);
      state.metadataLoaded = true;
    } catch (error) {
      console.warn('[Striate Exercise Library] Failed to load metadata:', error);
    }
  }

  async function fetchExercises() {
    const seq = ++state.requestSeq;
    const filters = buildFilters();
    const query = buildQueryString(filters);
    renderSkeletons();

    try {
      const res = await fetch(`/api/exercises/search${query ? `?${query}` : ''}`, {
        headers: { 'Accept': 'application/json' },
      });
      const json = await res.json().catch(() => null);
      if (seq !== state.requestSeq) return;
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      state.allExercises = extractList(json).map(normalizeExercise).filter(Boolean);
      state.visibleCount = Math.min(state.pageSize, state.allExercises.length);
      renderResults();
      setupObserver();
    } catch (error) {
      if (seq !== state.requestSeq) return;
      state.allExercises = [];
      state.visibleCount = 0;
      renderEmptyState(`Couldn’t load exercises: ${error.message}`);
    }
  }

  async function fetchExerciseById(id) {
    const existing = state.allExercises.find((item) => item.id === id);
    if (existing) return existing;

    const res = await fetch(`/api/exercises/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return normalizeExercise(json?.data || json);
  }

  function updateLibraryUrl(exerciseId = null) {
    const nextPath = exerciseId ? `/exercise/${encodeURIComponent(exerciseId)}` : '/exercise-library';
    history.replaceState({ exerciseId }, '', nextPath);
  }

  function closeDrawer() {
    els.drawerRoot.classList.add('hidden');
    els.drawerRoot.innerHTML = '';
    updateLibraryUrl(null);
  }

  function drawerActionButtons(exercise) {
    const isPreferred = Store.isPreferredExercise(exercise.id);
    const isAvoided = Store.isAvoidedExercise(exercise.id);

    return `
      <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:14px;">
        <button class="btn ${isPreferred ? 'btn-secondary' : 'btn-primary'}" id="save-pref-btn" style="flex:1; min-width:180px;">
          <i class="fa-solid ${isPreferred ? 'fa-check' : 'fa-plus'}"></i>
          ${isPreferred ? 'Saved to preferred' : 'Save to preferred'}
        </button>
        <button class="btn ${isAvoided ? 'btn-secondary' : 'btn-secondary'}" id="save-avoid-btn" style="flex:1; min-width:180px; border-color:${isAvoided ? 'rgba(240,113,108,0.45)' : 'var(--border-strong)'}; color:${isAvoided ? 'var(--red)' : 'var(--text)'};">
          <i class="fa-solid ${isAvoided ? 'fa-ban' : 'fa-thumbs-down'}"></i>
          ${isAvoided ? 'Marked as avoid' : 'Avoid in future plans'}
        </button>
      </div>
    `;
  }

  function populateDrawer(exercise) {
    const instructions = (exercise.instructions || []).map((step) => `<li>${escapeHtml(step)}</li>`).join('');
    const tips = (exercise.formTips || []).length
      ? `<ul style="margin:8px 0 0 18px;">${exercise.formTips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>`
      : '<p class="muted small" style="margin:8px 0 0 0;">No extra form tips available.</p>';
    const alternatives = (exercise.alternatives || []).length
      ? `<ul style="margin:8px 0 0 18px;">${exercise.alternatives.map((alt) => `<li>${escapeHtml(alt)}</li>`).join('')}</ul>`
      : '<p class="muted small" style="margin:8px 0 0 0;">No alternatives listed.</p>';
    const muscles = (exercise.secondaryMuscles || []).length
      ? exercise.secondaryMuscles.map(escapeHtml).join(', ')
      : 'N/A';

    els.drawerRoot.innerHTML = `
      <div class="drawer-backdrop" style="position:fixed; inset:0; background:rgba(0,0,0,.55); backdrop-filter:blur(6px);"></div>
      <div class="drawer-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(exercise.name)}" style="position:fixed; left:0; right:0; bottom:0; max-height:88vh; overflow:auto; background:#0f1115; border-top-left-radius:22px; border-top-right-radius:22px; padding:16px; box-shadow:0 -10px 30px rgba(0,0,0,.35);">
        <div class="row between" style="align-items:flex-start; gap:12px; margin-bottom:12px;">
          <div>
            <h2 style="margin:0; font-size:20px;">${escapeHtml(exercise.name)}</h2>
            <p class="muted small" style="margin:4px 0 0 0;">ID ${escapeHtml(exercise.id)} · ${escapeHtml(exercise.bodyPart)} · ${escapeHtml(exercise.target)} · ${escapeHtml(exercise.equipment)}</p>
          </div>
          <button class="btn btn-secondary" id="close-exercise-drawer" style="min-height:40px; width:auto;">Close</button>
        </div>

        <div style="width:100%; max-height:260px; border-radius:18px; overflow:hidden; background:rgba(255,255,255,.05); margin-bottom:14px;">
          ${mediaHtml(exercise)}
        </div>

        <div class="row" style="flex-wrap:wrap; gap:8px; margin-bottom:12px;">
          <span class="chip selected">${escapeHtml(exercise.bodyPart)}</span>
          <span class="chip selected">${escapeHtml(exercise.target)}</span>
          <span class="chip selected">${escapeHtml(exercise.equipment)}</span>
          <span class="chip selected">${escapeHtml(exercise.effortLevel)}</span>
          ${exercise.isUnilateral ? '<span class="chip selected">unilateral</span>' : ''}
        </div>

        <section style="margin-bottom:14px;">
          <h3 style="margin:0 0 8px 0; font-size:16px;">Instructions</h3>
          <ol style="margin:8px 0 0 18px;">${instructions}</ol>
        </section>

        <section style="margin-bottom:14px;">
          <h3 style="margin:0 0 8px 0; font-size:16px;">Form tips</h3>
          ${tips}
        </section>

        <section style="margin-bottom:14px;">
          <h3 style="margin:0 0 8px 0; font-size:16px;">Secondary muscles</h3>
          <p class="muted small" style="margin:0;">${muscles}</p>
        </section>

        <section style="margin-bottom:14px;">
          <h3 style="margin:0 0 8px 0; font-size:16px;">Alternatives</h3>
          ${alternatives}
        </section>

        ${drawerActionButtons(exercise)}
      </div>
    `;

    els.drawerRoot.classList.remove('hidden');
    updateLibraryUrl(exercise.id);

    const closeBtn = document.getElementById('close-exercise-drawer');
    const backdrop = els.drawerRoot.querySelector('.drawer-backdrop');
    closeBtn?.addEventListener('click', closeDrawer);
    backdrop?.addEventListener('click', closeDrawer);

    document.getElementById('save-pref-btn')?.addEventListener('click', () => {
      if (!Store.isPreferredExercise(exercise.id)) {
        Store.savePreferredExercise(exercise);
        UI.showToast(`Saved ${exercise.name} to preferred exercises.`);
      } else {
        UI.showToast(`${exercise.name} is already saved.`);
      }
      populateDrawer(exercise);
    });

    document.getElementById('save-avoid-btn')?.addEventListener('click', () => {
      if (!Store.isAvoidedExercise(exercise.id)) {
        Store.saveAvoidedExercise(exercise);
        UI.showToast(`Striate will avoid ${exercise.name} in future plans.`);
      } else {
        UI.showToast(`${exercise.name} is already marked to avoid.`);
      }
      populateDrawer(exercise);
    });
  }

  async function maybeOpenDeepLinkedExercise() {
    const match = window.location.pathname.match(/\/exercise\/([^/]+)$/);
    if (!match) return;
    try {
      const exercise = await fetchExerciseById(decodeURIComponent(match[1]));
      if (exercise) populateDrawer(exercise);
    } catch (error) {
      console.warn('[Striate Exercise Library] Failed to load deep-linked exercise:', error);
    }
  }

  function handleResultClick(event) {
    const card = event.target.closest('[data-exercise-id]');
    if (!card) return;
    const id = card.dataset.exerciseId;
    const exercise = state.allExercises.find((item) => item.id === id);
    if (!exercise) return;
    populateDrawer(exercise);
  }

  function wireFilterGroups() {
    qsa('.exercise-filter-group .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const group = chip.closest('.exercise-filter-group');
        qsa('.chip', group).forEach((item) => item.classList.remove('selected'));
        chip.classList.add('selected');
        fetchExercises();
      });
    });
  }

  function wireAdvancedControls() {
    ['#filter-mechanics', '#filter-force', '#filter-is-unilateral', '#filter-sort-method', '#filter-sort-order', '#filter-lang', '#filter-limit', '#filter-offset']
      .forEach((selector) => {
        const element = qs(selector);
        if (!element) return;
        const handler = selector === '#filter-offset' ? debounce(fetchExercises, 200) : fetchExercises;
        element.addEventListener('input', handler);
        element.addEventListener('change', handler);
      });
  }

  function resetFilters() {
    if (els.searchInput) els.searchInput.value = '';
    setActiveChip('bodyPartFilter', 'all');
    setActiveChip('targetFilter', 'all');
    setActiveChip('equipmentFilter', 'all');
    setActiveChip('effortFilter', 'all');

    const controls = {
      '#filter-mechanics': DEFAULTS.mechanics,
      '#filter-force': DEFAULTS.force,
      '#filter-is-unilateral': DEFAULTS.isUnilateral,
      '#filter-sort-method': DEFAULTS.sortMethod,
      '#filter-sort-order': DEFAULTS.sortOrder,
      '#filter-lang': DEFAULTS.lang,
      '#filter-limit': DEFAULTS.limit,
      '#filter-offset': DEFAULTS.offset,
    };

    Object.entries(controls).forEach(([selector, value]) => {
      const element = qs(selector);
      if (element) element.value = value;
    });

    fetchExercises();
  }

  function wireControls() {
    els.searchInput?.addEventListener('input', debounce(fetchExercises, 250));
    els.resetBtn?.addEventListener('click', resetFilters);
    els.resultsList?.addEventListener('click', handleResultClick);
    wireAdvancedControls();

    if (els.debugBtn) {
      els.debugBtn.addEventListener('click', () => {
        console.log('[Striate Exercise Library Debug]', {
          filters: buildFilters(),
          loaded: state.allExercises.length,
        });
        alert('Exercise library debug details were logged to the console.');
      });
    }
  }

  async function init() {
    if (window.UI?.renderTabbar) UI.renderTabbar('exercises');

    buildAdvancedFilters();
    createSentinel();
    setupObserver();
    wireFilterGroups();
    wireControls();
    await loadMetadata();
    await fetchExercises();
    await maybeOpenDeepLinkedExercise();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
