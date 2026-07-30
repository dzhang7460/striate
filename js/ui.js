/* ============================================================
   Striate — ui.js
   Shared UI helpers: chip selectors, tab bar, guards, formatting.
============================================================ */

const UI = (() => {
  // Chip group behaves like a radio group.
  // <div class="chip-group" data-name="energy"> <button class="chip" data-value="3">...
  function initChipGroups(root = document) {
    root.querySelectorAll('.chip-group[data-name]').forEach((group) => {
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

  // Multi-select chip group (for equipment).
  // <div class="chip-group" data-name="equipment" data-multi>
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

  function setChipValue(name, value, root = document) {
    const g = root.querySelector(`.chip-group[data-name="${name}"]`);
    if (!g || value == null) return;
    const chip = g.querySelector(`.chip[data-value="${CSS.escape(String(value))}"]`);
    if (chip) chip.click();
  }

  // Bottom tab bar for the "app" pages.
  function renderTabbar(active) {
    const tabs = [
      { id: 'today', href: 'today.html', icon: 'fa-bolt', label: 'Today' },
      { id: 'checkin', href: 'check-in.html', icon: 'fa-circle-check', label: 'Check-in' },
      { id: 'history', href: 'history.html', icon: 'fa-clock-rotate-left', label: 'History' },
      { id: 'profile', href: 'onboarding.html?edit=1', icon: 'fa-user', label: 'Profile' },
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

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  return {
    initChipGroups, initMultiChipGroups, chipValue, setChipValue,
    renderTabbar, requireProfile, formatDate, confidenceBadge, esc,
  };
})();
