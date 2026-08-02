/* ============================================================
   Striate — js/exercise-library.js
   Exercise Library page logic.
   - Uses existing HTML IDs from exercise-library.html
   - Fetches once per search/filter change
   - Reveals more exercises progressively on scroll
   - Supports all free WorkoutX query params
   - Handles gif/image fallback display
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
    isLoading: false,
    requestSeq: 0,
    observer: null,
    sentinel: null,
    advancedPanelReady: false,
  };

  const DEFAULTS = {
    bodyPart: 'all',
    equipment: 'all',
    effortLevel: 'all',
    target: '',
    mechanics: 'all',
    force: 'all',
    isUnilateral: 'all',
    sortMethod: 'popularityRank',
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
    let t = null;
    return (...args) => {
      window.clearTimeout(t);
      t = window.setTimeout(() => fn(...args), delay);
    };
  }

  function log(...args) {
    console.log('[Striate Exercise Library]', ...args);
  }

function normalizeExercise(raw) {
  if (!raw || typeof raw !== 'object') return null;

  return {
    id: String(raw.id || raw.exerciseId || raw._id || ''),
    name: String(raw.name || raw.title || 'Unnamed Exercise').trim(),
    bodyPart: String(raw.bodyPart || raw.category || 'full body').toLowerCase(),
    target: String(raw.target || raw.targetMuscle || raw.muscle || 'general').toLowerCase(),
    equipment: String(raw.equipment || 'body weight').toLowerCase(),
    effortLevel: String(raw.effortLevel || raw.difficulty || 'beginner').toLowerCase(),
    mechanics: raw.mechanics ? String(raw.mechanics).toLowerCase() : '',
    force: raw.force ? String(raw.force).toLowerCase() : '',
    isUnilateral: Boolean(raw.isUnilateral || raw.unilateral || false),
    gifUrl: raw.gifUrl || raw.imageUrl || raw.image || raw.thumbnail || '',
    imageUrl: raw.imageUrl || raw.image || raw.thumbnail || raw.gifUrl || '',
    instructions: Array.isArray(raw.instructions)
      ? raw.instructions.map(String)
      : (typeof raw.instructions === 'string' && raw.instructions.trim()
          ? [raw.instructions]
          : ['Perform the movement with control and good form.']),
    secondaryMuscles: Array.isArray(raw.secondaryMuscles) ? raw.secondaryMuscles.map(String) : [],
    caloriesPerMinute: typeof raw.caloriesPerMinute === 'number' ? raw.caloriesPerMinute : null,
    formTips: Array.isArray(raw.formTips) ? raw.formTips.map(String) : [],
    alternatives: Array.isArray(raw.alternatives) ? raw.alternatives.map(String) : [],
  };
  }

  function getActiveChipValue(groupName) {
    const group = qs(`.exercise-filter-group[data-name="${groupName}"]`);
    if (!group) return 'all';
    const selected = qs('.chip.selected', group);
    return selected?.dataset?.value || 'all';
  }

  function setActiveChipValue(groupName, value) {
    const group = qs(`.exercise-filter-group[data-name="${groupName}"]`);
    if (!group) return;
    qsa('.chip', group).forEach((chip) => {
      chip.classList.toggle('selected', chip.dataset.value === value);
    });
  }

  function buildAdvancedFilters() {
    if (state.advancedPanelReady) return;
    const searchBar = qs('.exercise-search-bar');
    if (!searchBar) return;

    const panel = document.createElement('details');
    panel.id = 'advanced-workoutx-filters';
    panel.className = 'mt-2';
    panel.innerHTML = `
      <summary style="cursor:pointer; font-weight:600; margin-bottom:10px;">Advanced filters</summary>
      <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:10px;">
        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Target</span>
          <input type="text" id="filter-target" placeholder="e.g. pectorals" style="min-height:44px;">
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Mechanics</span>
          <select id="filter-mechanics" style="min-height:44px;">
            <option value="all">All</option>
            <option value="compound">Compound</option>
            <option value="isolation">Isolation</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Force</span>
          <select id="filter-force" style="min-height:44px;">
            <option value="all">All</option>
            <option value="push">Push</option>
            <option value="pull">Pull</option>
            <option value="hold">Hold</option>
            <option value="carry">Carry</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Unilateral</span>
          <select id="filter-is-unilateral" style="min-height:44px;">
            <option value="all">All</option>
            <option value="true">Single-sided only</option>
            <option value="false">Two-sided only</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Sort method</span>
          <select id="filter-sort-method" style="min-height:44px;">
            <option value="popularityRank">Popularity</option>
            <option value="name">Name</option>
            <option value="bodyPart">Body part</option>
            <option value="target">Target</option>
            <option value="equipment">Equipment</option>
            <option value="effortLevel">Difficulty</option>
            <option value="mechanics">Mechanics</option>
            <option value="force">Force</option>
            <option value="caloriesBurnPerMin">Calories/min</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Sort order</span>
          <select id="filter-sort-order" style="min-height:44px;">
            <option value="ascending">Ascending</option>
            <option value="descending">Descending</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Language</span>
          <select id="filter-lang" style="min-height:44px;">
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
          <select id="filter-limit" style="min-height:44px;">
            <option value="20">20</option>
            <option value="40">40</option>
            <option value="60">60</option>
            <option value="100" selected>100</option>
          </select>
        </label>

        <label style="display:flex; flex-direction:column; gap:6px;">
          <span class="muted small">Offset</span>
          <input type="number" id="filter-offset" min="0" step="1" value="0" style="min-height:44px;">
        </label>
      </div>
    `;

    searchBar.insertAdjacentElement('afterend', panel);
    state.advancedPanelReady = true;
  }

  function getAdvancedControls() {
    return {
      target: qs('#filter-target')?.value?.trim() || DEFAULTS.target,
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
    const advanced = getAdvancedControls();
    return {
      name: (els.searchInput?.value || '').trim(),
      bodyPart: getActiveChipValue('bodyPartFilter'),
      equipment: getActiveChipValue('equipmentFilter'),
      effortLevel: getActiveChipValue('effortFilter'),
      target: advanced.target,
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

  function setLoading(isLoading) {
    state.isLoading = isLoading;
    if (els.countLabel) {
      els.countLabel.textContent = isLoading ? 'Loading…' : '';
    }
  }

  function renderEmptyState(message = 'No exercises found.') {
    els.resultsList.innerHTML = `
      <div class="card" style="padding:16px; border:1px solid rgba(255,255,255,.08); border-radius:16px;">
        <p style="margin:0 0 6px 0; font-weight:600;">${escapeHtml(message)}</p>
        <p class="muted small" style="margin:0;">Try clearing filters or searching a broader term.</p>
      </div>
    `;
    updateCountLabel();
  }

  function updateCountLabel() {
    if (!els.countLabel) return;
    const total = state.allExercises.length;
    const visible = Math.min(state.visibleCount, total);
    els.countLabel.textContent = total ? `${visible} / ${total}` : '';
  }

  function mediaHtml(ex) {
  const src = ex.gifUrl
  ? `/api/exercises/media?url=${encodeURIComponent(ex.gifUrl)}`
  : ex.imageUrl
    ? `/api/exercises/media?url=${encodeURIComponent(ex.imageUrl)}`
    : '';
  const fallbackLabel = ex.name ? escapeHtml(ex.name.slice(0, 2).toUpperCase()) : 'EX';

  if (!src) {
    return `
      <div style="width:100%; height:100%; display:grid; place-items:center; background:rgba(255,255,255,.06); color:rgba(255,255,255,.72); font-weight:700; font-size:18px;">
        ${fallbackLabel}
      </div>
    `;
  }

  return `
    <img
      src="${escapeHtml(src)}"
      alt="${escapeHtml(ex.name)}"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=&quot;width:100%;height:100%;display:grid;place-items:center;background:rgba(255,255,255,.06);color:rgba(255,255,255,.72);font-weight:700;font-size:18px;&quot;>${escapeHtml(fallbackLabel)}</div>'"
      style="width:100%; height:100%; object-fit:cover; display:block;"
    >
  `;
}

  function cardHtml(ex, index) {
    const badges = [
      ex.bodyPart,
      ex.equipment,
      ex.effortLevel,
      ex.mechanics ? ex.mechanics : '',
      ex.force ? ex.force : '',
      ex.isUnilateral ? 'single-sided' : '',
    ].filter(Boolean);

    return `
      <article
        class="card exercise-card"
        data-exercise-id="${escapeHtml(ex.id)}"
        data-index="${index}"
        style="display:grid; grid-template-columns:100px 1fr; gap:12px; align-items:start; padding:12px; border:1px solid rgba(255,255,255,.08); border-radius:18px; margin-bottom:12px; cursor:pointer;"
      >
        <div style="width:100px; height:100px; border-radius:14px; overflow:hidden; background:rgba(255,255,255,.05); flex:none;">
          ${mediaHtml(ex)}
        </div>

        <div style="min-width:0;">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
            <h3 style="margin:0; font-size:16px; line-height:1.25;">${escapeHtml(ex.name)}</h3>
            <span class="faint small" style="white-space:nowrap;">${escapeHtml(ex.effortLevel)}</span>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;">
            ${badges.map((b) => `<span class="chip selected" style="padding:4px 8px; font-size:12px;">${escapeHtml(b)}</span>`).join('')}
          </div>

          <p class="muted small" style="margin:8px 0 0 0;">
            Target: ${escapeHtml(ex.target)}
          </p>

          <p class="muted small" style="margin:6px 0 0 0;">
            ${escapeHtml((ex.instructions || []).slice(0, 1).join(' '))}
          </p>
        </div>
      </article>
    `;
  }

  function renderResults() {
    const visible = state.allExercises.slice(0, state.visibleCount);

    if (!visible.length) {
      renderEmptyState();
      ensureSentinelVisibility(false);
      return;
    }

    els.resultsList.innerHTML = visible.map((ex, i) => cardHtml(ex, i)).join('');
    updateCountLabel();
    ensureSentinelVisibility(state.visibleCount < state.allExercises.length);
  }

  function ensureSentinelVisibility(show) {
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
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    if (!state.sentinel || !('IntersectionObserver' in window)) return;

    state.observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (!first?.isIntersecting) return;
      loadMore();
    }, {
      root: null,
      rootMargin: '250px',
      threshold: 0.1,
    });

    state.observer.observe(state.sentinel);
  }

  function loadMore() {
    if (state.visibleCount >= state.allExercises.length) {
      ensureSentinelVisibility(false);
      return;
    }

    state.visibleCount = Math.min(state.visibleCount + state.pageSize, state.allExercises.length);
    renderResults();
  }

  function renderLoading() {
    els.resultsList.innerHTML = `
      <div class="card" style="padding:16px; border:1px solid rgba(255,255,255,.08); border-radius:16px;">
        <p style="margin:0; font-weight:600;">Loading exercises…</p>
        <p class="muted small" style="margin:6px 0 0 0;">Fetching WorkoutX results.</p>
      </div>
    `;
    if (els.countLabel) els.countLabel.textContent = '';
  }

  function renderSkeletons() {
    const placeholders = Array.from({ length: 6 }).map(() => `
      <div class="card" style="display:grid; grid-template-columns:100px 1fr; gap:12px; padding:12px; border:1px solid rgba(255,255,255,.08); border-radius:18px; margin-bottom:12px;">
        <div style="width:100px; height:100px; border-radius:14px; background:rgba(255,255,255,.06);"></div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div style="height:14px; width:60%; background:rgba(255,255,255,.06); border-radius:999px;"></div>
          <div style="height:12px; width:80%; background:rgba(255,255,255,.05); border-radius:999px;"></div>
          <div style="height:12px; width:70%; background:rgba(255,255,255,.05); border-radius:999px;"></div>
        </div>
      </div>
    `).join('');

    els.resultsList.innerHTML = placeholders;
    if (els.countLabel) els.countLabel.textContent = '';
  }

  function extractExerciseList(json) {
    if (!json) return [];
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.exercises)) return json.exercises;
    if (Array.isArray(json.results)) return json.results;
    return [];
  }

  async function fetchExercises() {
    const seq = ++state.requestSeq;
    const filters = buildFilters();
    const qs = buildQueryString(filters);

    setLoading(true);
    renderSkeletons();

    try {
      const res = await fetch(`/api/exercises/search${qs ? `?${qs}` : ''}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const json = await res.json().catch(() => null);

      if (seq !== state.requestSeq) return;

      if (!res.ok) {
        const msg = json?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const raw = extractExerciseList(json);
      const normalized = raw.map(normalizeExercise).filter(Boolean);

      state.allExercises = normalized;
      state.visibleCount = Math.min(state.pageSize, state.allExercises.length);

      renderResults();
      setupObserver();

      log(`Loaded ${state.allExercises.length} exercises`, filters);
    } catch (err) {
      log('Fetch failed:', err);
      if (seq !== state.requestSeq) return;

      state.allExercises = [];
      state.visibleCount = 0;
      renderEmptyState(`WorkoutX fetch failed: ${err.message}`);
    } finally {
      if (seq === state.requestSeq) setLoading(false);
    }
  }

  async function loadBodyPartChips() {
    const group = document.querySelector('.exercise-filter-group[data-name="bodyPartFilter"]');
    if (!group) return;

    try {
      const res = await fetch('/api/exercises/bodyPartList');
      const json = await res.json();
      const parts = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

      const labelMap = {
        'back': 'Back',
        'cardio': 'Cardio',
        'chest': 'Chest',
        'lower arms': 'Lower Arms',
        'lower legs': 'Lower Legs',
        'neck': 'Neck',
        'shoulders': 'Shoulders',
        'upper arms': 'Upper Arms',
        'upper legs': 'Upper Legs',
        'waist': 'Waist',
      };

      group.innerHTML = `
        <button class="chip selected" data-value="all">All</button>
        ${parts.map((part) => `
          <button class="chip" data-value="${part}">${labelMap[part] || part}</button>
        `).join('')}
      `;

      group.querySelectorAll('.chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          group.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
          chip.classList.add('selected');
          fetchExercises();
        });
      });
    } catch (err) {
      console.warn('[Striate Exercise Library] Failed to load body part chips:', err);
    }
  }

  function populateDrawer(ex) {
    const equipment = ex.equipment || 'body weight';
    const muscles = (ex.secondaryMuscles || []).length
      ? ex.secondaryMuscles.map(escapeHtml).join(', ')
      : 'N/A';

    const tips = (ex.formTips || []).length
      ? `<ul style="margin:8px 0 0 18px;">${ex.formTips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ul>`
      : '<p class="muted small" style="margin:8px 0 0 0;">No extra tips available.</p>';

    const alternatives = (ex.alternatives || []).length
      ? `<ul style="margin:8px 0 0 18px;">${ex.alternatives.map((alt) => `<li>${escapeHtml(alt)}</li>`).join('')}</ul>`
      : '<p class="muted small" style="margin:8px 0 0 0;">No listed alternatives.</p>';

    const instructions = (ex.instructions || []).length
      ? `<ol style="margin:8px 0 0 18px;">${ex.instructions.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`
      : '<p class="muted small" style="margin:8px 0 0 0;">No instructions available.</p>';

    const media = ex.gifUrl
      ? `<img src="${escapeHtml(ex.gifUrl)}" alt="${escapeHtml(ex.name)}" loading="lazy" decoding="async" style="width:100%; max-height:260px; object-fit:cover; border-radius:18px; margin-bottom:14px;">`
      : `<div style="width:100%; height:220px; border-radius:18px; margin-bottom:14px; background:linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,.04)); display:grid; place-items:center; color:rgba(255,255,255,.72); font-weight:700;">${escapeHtml(ex.name)}</div>`;

    els.drawerRoot.innerHTML = `
      <div class="drawer-backdrop" style="position:fixed; inset:0; background:rgba(0,0,0,.55); backdrop-filter:blur(6px);"></div>
      <div class="drawer-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(ex.name)}" style="position:fixed; left:0; right:0; bottom:0; max-height:88vh; overflow:auto; background:#0f1115; border-top-left-radius:22px; border-top-right-radius:22px; padding:16px; box-shadow:0 -10px 30px rgba(0,0,0,.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px;">
          <div>
            <h2 style="margin:0; font-size:20px;">${escapeHtml(ex.name)}</h2>
            <p class="muted small" style="margin:4px 0 0 0;">${escapeHtml(ex.bodyPart)} • ${escapeHtml(ex.target)} • ${escapeHtml(equipment)} • ${escapeHtml(ex.effortLevel)}</p>
          </div>
          <button class="btn btn-secondary" id="close-exercise-drawer" style="min-height:40px; width:auto;">Close</button>
        </div>

        ${media}

        <div class="row" style="flex-wrap:wrap; gap:8px; margin-bottom:12px;">
          <span class="chip selected">${escapeHtml(ex.bodyPart)}</span>
          <span class="chip selected">${escapeHtml(ex.equipment)}</span>
          <span class="chip selected">${escapeHtml(ex.effortLevel)}</span>
          ${ex.mechanics ? `<span class="chip selected">${escapeHtml(ex.mechanics)}</span>` : ''}
          ${ex.force ? `<span class="chip selected">${escapeHtml(ex.force)}</span>` : ''}
          ${ex.isUnilateral ? '<span class="chip selected">unilateral</span>' : ''}
        </div>

        <section style="margin-bottom:14px;">
          <h3 style="margin:0 0 8px 0; font-size:16px;">Instructions</h3>
          ${instructions}
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

        <section style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-bottom:8px;">
          <div class="card" style="padding:12px; border:1px solid rgba(255,255,255,.08); border-radius:14px;">
            <div class="faint small">Calories/min</div>
            <div style="font-weight:700;">${ex.caloriesPerMinute ?? 'N/A'}</div>
          </div>
          <div class="card" style="padding:12px; border:1px solid rgba(255,255,255,.08); border-radius:14px;">
            <div class="faint small">Media</div>
            <div style="font-weight:700;">${escapeHtml(ex.mediaType || 'none')}</div>
          </div>
        </section>
      </div>
    `;

    els.drawerRoot.classList.remove('hidden');

    const closeBtn = document.getElementById('close-exercise-drawer');
    const backdrop = els.drawerRoot.querySelector('.drawer-backdrop');

    const closeDrawer = () => {
      els.drawerRoot.classList.add('hidden');
      els.drawerRoot.innerHTML = '';
    };

    closeBtn?.addEventListener('click', closeDrawer);
    backdrop?.addEventListener('click', closeDrawer);
  }

  function handleResultClick(e) {
    const card = e.target.closest('[data-exercise-id]');
    if (!card) return;
    const id = card.dataset.exerciseId;
    const ex = state.allExercises.find((x) => x.id === id);
    if (!ex) return;
    populateDrawer(ex);
  }

  function wireChipGroups() {
    qsa('.exercise-filter-group .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const group = chip.closest('.exercise-filter-group');
        const groupName = group?.dataset?.name;
        if (!groupName) return;

        qsa('.chip', group).forEach((c) => c.classList.remove('selected'));
        chip.classList.add('selected');
        fetchExercises();
      });
    });
  }

  function wireAdvancedControls() {
    const ids = [
      '#filter-target',
      '#filter-mechanics',
      '#filter-force',
      '#filter-is-unilateral',
      '#filter-sort-method',
      '#filter-sort-order',
      '#filter-lang',
      '#filter-limit',
      '#filter-offset',
    ];

    ids.forEach((id) => {
      const el = qs(id);
      if (!el) return;
      const handler = id.includes('target') ? debounce(fetchExercises, 250) : fetchExercises;
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  function resetFilters() {
    if (els.searchInput) els.searchInput.value = '';
    setActiveChipValue('bodyPartFilter', 'all');
    setActiveChipValue('equipmentFilter', 'all');
    setActiveChipValue('effortFilter', 'all');

    const target = qs('#filter-target');
    const mechanics = qs('#filter-mechanics');
    const force = qs('#filter-force');
    const unilateral = qs('#filter-is-unilateral');
    const sortMethod = qs('#filter-sort-method');
    const sortOrder = qs('#filter-sort-order');
    const lang = qs('#filter-lang');
    const limit = qs('#filter-limit');
    const offset = qs('#filter-offset');

    if (target) target.value = DEFAULTS.target;
    if (mechanics) mechanics.value = DEFAULTS.mechanics;
    if (force) force.value = DEFAULTS.force;
    if (unilateral) unilateral.value = DEFAULTS.isUnilateral;
    if (sortMethod) sortMethod.value = DEFAULTS.sortMethod;
    if (sortOrder) sortOrder.value = DEFAULTS.sortOrder;
    if (lang) lang.value = DEFAULTS.lang;
    if (limit) limit.value = DEFAULTS.limit;
    if (offset) offset.value = DEFAULTS.offset;

    fetchExercises();
  }

  function wireControls() {
    if (els.searchInput) {
      els.searchInput.addEventListener('input', debounce(fetchExercises, 250));
    }

    if (els.resetBtn) {
      els.resetBtn.addEventListener('click', resetFilters);
    }

    if (els.resultsList) {
      els.resultsList.addEventListener('click', handleResultClick);
    }

    wireAdvancedControls();
  }

  function wireDebugButton() {
    if (!els.debugBtn) return;
    els.debugBtn.addEventListener('click', () => {
      const payload = {
        visibleCount: state.visibleCount,
        total: state.allExercises.length,
        filters: buildFilters(),
        advanced: getAdvancedControls(),
      };
      console.log('[Striate Exercise Library Debug]', payload);
      alert(`Debug:\nVisible: ${payload.visibleCount}\nTotal: ${payload.total}\nFilters logged in console.`);
    });
  }

  async function init() {
    if (!els.resultsList) return;

    buildAdvancedFilters();
    createSentinel();
    setupObserver();
    wireChipGroups();
    wireControls();
    wireDebugButton();

    // Ensure advanced panel controls are wired after insertion.
    wireAdvancedControls();

    // Load initial data.
    await loadBodyPartChips();
    fetchExercises();
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Render the navigation bar
    if (window.UI?.renderTabbar) {
      UI.renderTabbar('exercises');
    }

    // Chip helpers
    if (window.UI?.initChipGroups) {
      UI.initChipGroups(document);
    }
    if (window.UI?.initMultiChipGroups) {
      UI.initMultiChipGroups(document);
    }

    init();
  });
})();