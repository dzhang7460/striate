/* ============================================================
   Striate — ui.js
   Shared UI helpers: chip selectors, 5-tab navigation bar,
   guards, formatting, icons, and escaping.
============================================================ */

const UI = (() => {
  // Chip group behaves like a radio group.
// Chip group behaves like a radio group.
  function initChipGroups(root = document) {
    // FIX: Exclude [data-multi] so they don't receive single-select listeners
    root.querySelectorAll('.chip-group[data-name]:not([data-multi])').forEach((group) => {
      group.querySelectorAll('.chip').forEach((chip) => {
        chip.type = 'button';
        chip.addEventListener('click', () => {
          group.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
          chip.classList.add('selected');
          group.dataset.value = chip.dataset.value;
          group.dispatchEvent(new CustomEvent('chipchange', { bubbles: true }));
        });
      });
    });
  }

  // Multi-select chip group (for equipment / soccer focus).
  function initMultiChipGroups(root = document) {
    root.querySelectorAll('.chip-group[data-multi]').forEach((group) => {
      group.querySelectorAll('.chip').forEach((chip) => {
        chip.type = 'button';
        chip.addEventListener('click', () => {
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
        });
      });
    });
  }

  function chipValue(name, root = document) {
    const g = root.querySelector(`.chip-group[data-name="${name}"]`);
    return g ? g.dataset.value || null : null;
  }

  // Programmatically set chip values, supporting both single and multi-select
  function setChipValue(name, value, root = document) {
    const g = root.querySelector(`.chip-group[data-name="${name}"]`);
    if (!g || value == null) return;

    if (g.hasAttribute('data-multi')) {
      // FIX: Handle parsing an array or JSON string of multiple values
      let values = [];
      try {
        values = typeof value === 'string' ? JSON.parse(value) : value;
      } catch (e) {
        values = [value];
      }
      if (!Array.isArray(values)) values = [values];

      // Clear existing selections
      g.querySelectorAll('.chip').forEach((c) => c.classList.remove('selected'));
      
      // Select all provided values
      values.forEach((v) => {
        const chip = g.querySelector(`.chip[data-value=${CSS.escape(String(v))}]`);
        if (chip) chip.classList.add('selected');
      });
      
      g.dataset.value = JSON.stringify(values);
    } else {
      // Original single-select behavior
      const chip = g.querySelector(`.chip[data-value=${CSS.escape(String(value))}]`);
      if (chip) chip.click();
    }
  }

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

  // 5-tab bottom navigation bar for Striate v0.3
  function renderTabbar(active) {
    const tabs = [
      { id: 'today', href: 'today.html', icon: 'fa-bolt', label: 'Today' },
      { id: 'checkin', href: 'check-in.html', icon: 'fa-circle-check', label: 'Check-in' },
      { id: 'exercises', href: 'exercise-library.html', icon: 'fa-dumbbell', label: 'Exercises' },
      { id: 'calendar', href: 'history.html', icon: 'fa-calendar-days', label: 'Calendar' },
      { id: 'stats', href: 'stats.html', icon: 'fa-chart-simple', label: 'Stats' },
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

  // Redirect to onboarding if no profile exists yet.
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

  function showToast(message, duration = 3000) {
    const existing = document.getElementById('striate-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'striate-toast';
    toast.className = 'striate-toast';
    toast.innerHTML = `<i class="fa-solid fa-check-circle" style="color:var(--accent);"></i> <span>${esc(message)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return {
    initChipGroups, initMultiChipGroups, chipValue, setChipValue,
    initScaleGroups, scaleValue, setScaleValue,
    renderTabbar, requireProfile, formatDate, confidenceBadge,
    scheduleTypeIcon, esc, showToast,
  };
})();
