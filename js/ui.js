/* ============================================================
   Striate — ui.js
   Shared UI helpers: chip selectors, scale groups, 5-tab 
   navigation bar, guards, formatting, icons, and escaping.
============================================================ */

const UI = (() => {
  // ==========================================
  // CHIP GROUPS (Single & Multi)
  // ==========================================

  function initChipGroups(root = document) {
    root.querySelectorAll('.chip-group[data-name]:not([data-multi])').forEach((group) => {
      group.removeEventListener('click', handleSingleChipClick); 
      group.addEventListener('click', handleSingleChipClick);
    });
  }

  function handleSingleChipClick(e) {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    e.preventDefault(); 

    const group = e.currentTarget;
    group.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
    chip.classList.add('selected');
    group.dataset.value = chip.dataset.value;
    group.dispatchEvent(new CustomEvent('chipchange', { bubbles: true }));
  }

  function initMultiChipGroups(root = document) {
    root.querySelectorAll('.chip-group[data-multi]').forEach((group) => {
      group.removeEventListener('click', handleMultiChipClick);
      group.addEventListener('click', handleMultiChipClick);
    });
  }

  function handleMultiChipClick(e) {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    e.preventDefault(); 

    const group = e.currentTarget;
    const val = chip.dataset.value;

    if (val === 'none') {
      group.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
      chip.classList.add('selected');
    } else {
      const noneChip = group.querySelector('.chip[data-value="none"]');
      if (noneChip) noneChip.classList.remove('selected');
      chip.classList.toggle('selected');
    }

    const values = [...group.querySelectorAll('.chip.selected')].map((c) => c.dataset.value);
    group.dataset.value = JSON.stringify(values);
    group.dispatchEvent(new CustomEvent('chipchange', { bubbles: true }));
  }

  function chipValue(name, root = document) {
    const g = root.querySelector(`.chip-group[data-name="${name}"]`);
    if (!g || !g.dataset.value) return null;
    
    if (g.hasAttribute('data-multi')) {
      try { return JSON.parse(g.dataset.value); } catch(e) { return []; }
    }
    return g.dataset.value;
  }

  function setChipValue(name, value, root = document) {
    const g = root.querySelector(`.chip-group[data-name="${name}"]`);
    if (!g || value == null) return;

    const valuesToSet = Array.isArray(value) ? value : [value];

    valuesToSet.forEach(val => {
      const safeVal = String(val).replace(/"/g, '\\"');
      const chip = g.querySelector(`.chip[data-value="${safeVal}"]`);
      if (chip && !chip.classList.contains('selected')) {
        chip.click();
      }
    });
  }

  // ==========================================
  // SCALE GROUPS (Ratings, 1-10 scales, etc.)
  // ==========================================

  function initScaleGroups(root = document) {
    root.querySelectorAll('.scale-group[data-name]').forEach((group) => {
      group.removeEventListener('click', handleScaleClick);
      group.addEventListener('click', handleScaleClick);
    });
  }

  function handleScaleClick(e) {
    const item = e.target.closest('.chip'); // Works perfectly with your HTML
    if (!item) return;
    e.preventDefault(); 

    const group = e.currentTarget;
    const allItems = Array.from(group.querySelectorAll('.chip'));
    
    // Clear previous states
    allItems.forEach((i) => {
      i.classList.remove('selected');
      i.classList.remove('filled');
    });
    
    // Set the clicked item as selected
    item.classList.add('selected');

    // Add 'filled' class to all items before the selected one
    const selectedIndex = allItems.indexOf(item);
    allItems.forEach((i, index) => {
      if (index < selectedIndex) {
        i.classList.add('filled');
      }
    });

    // Update value and fire event
    group.dataset.value = item.dataset.value;
    group.dispatchEvent(new CustomEvent('scalechange', { bubbles: true }));
  }

  function scaleValue(name, root = document) {
    const g = root.querySelector(`.scale-group[data-name="${name}"]`);
    return g ? (g.dataset.value || null) : null;
  }

  function setScaleValue(name, value, root = document) {
    const g = root.querySelector(`.scale-group[data-name="${name}"]`);
    if (!g || value == null) return;

    const safeVal = String(value).replace(/"/g, '\\"');
    const item = g.querySelector(`.chip[data-value="${safeVal}"]`);
    
    if (item && !item.classList.contains('selected')) {
      item.click();
    }
  }

  // ==========================================
  // APP NAVIGATION & HELPERS
  // ==========================================

  function renderTabbar(active) {
    const tabs = [
      { id: 'today', href: 'today.html', icon: 'fa-bolt', label: 'Today' },
      { id: 'checkin', href: 'check-in.html', icon: 'fa-circle-check', label: 'Check-in' },
      { id: 'calendar', href: 'history.html', icon: 'fa-calendar-days', label: 'Calendar' },
      { id: 'stats', href: 'stats.html', icon: 'fa-chart-simple', label: 'Stats' },
      { id: 'info', href: 'info.html', icon: 'fa-circle-info', label: 'Info' },
    ];
    const nav = document.createElement('nav');
    nav.className = 'tabbar';
    nav.setAttribute('aria-label', 'Main navigation');
    nav.innerHTML = `<div class="tabbar-inner">${tabs.map((t) => `
      <a class="tab ${t.id === active ? 'active' : ''}" href="${t.href}" ${t.id === active ? 'aria-current="page"' : ''}>
        <i class="fa-solid ${t.icon}" aria-hidden="true"></i><span>${t.label}</span>
      </a>`).join('')}</div>`;
    document.body.appendChild(nav);
  }

  function requireProfile() {
    if (!Store.getProfile()) {
      window.location.replace('onboarding.html');
      return false;
    }
    return true;
  }

  function formatDate(dateKey) {
    if (!dateKey) return 'Unknown';
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const today = Store.todayKey();
    if (dateKey === today) return 'Today';
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function confidenceBadge(level) {
    const map = {
      high: ['badge-high', 'High confidence'],
      medium: ['badge-medium', 'Medium confidence'],
      low: ['badge-low', 'Low confidence'],
    };
    const [cls, label] = map[level] || ['badge-neutral', 'Unknown confidence'];
    return `<span class="badge ${cls}"><i class="fa-solid fa-signal" aria-hidden="true"></i>${label}</span>`;
  }

  function scheduleTypeIcon(type) {
    const map = {
      meal: 'fa-utensils',
      workout: 'fa-dumbbell',
      rest: 'fa-couch',
      study: 'fa-book',
      sleep: 'fa-moon',
      habit: 'fa-circle-check',
      other: 'fa-clock',
    };
    return map[type] || 'fa-circle-dot';
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  return {
    // Chips
    initChipGroups, initMultiChipGroups, chipValue, setChipValue,
    // Scales
    initScaleGroups, scaleValue, setScaleValue,
    // Utils
    renderTabbar, requireProfile, formatDate, confidenceBadge,
    scheduleTypeIcon, esc,
  };
})();