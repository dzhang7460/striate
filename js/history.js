/* ============================================================
   Striate — history.js
   Collapsible list of past check-ins + recommendations.
============================================================ */

(function () {
  if (!UI.requireProfile()) return;
  UI.renderTabbar('history');

  const list = document.getElementById('history-list');
  const countEl = document.getElementById('history-count');
  const entries = Store.getEntries();
  const esc = UI.esc;

  countEl.textContent = entries.length === 0
    ? ''
    : `${entries.length} check-in${entries.length === 1 ? '' : 's'} saved on this device.`;

  if (entries.length === 0) {
    list.innerHTML = `
      <section class="card text-center" style="padding: 40px 24px;">
        <i class="fa-solid fa-clock-rotate-left" style="font-size: 30px; color: var(--text-faint);" aria-hidden="true"></i>
        <h2 class="mt-2">Nothing here yet</h2>
        <p class="muted small mt-1">Your daily check-ins and recommendations will show up here.</p>
        <a class="btn btn-primary mt-3" href="check-in.html">Do today's check-in</a>
      </section>`;
    return;
  }

  list.innerHTML = entries.map((e, i) => {
    const c = e.checkin, r = e.recommendation;
    const constraint = c.specialConstraint && c.specialConstraint !== 'none'
      ? ` · <span style="color: var(--amber);">${esc(c.specialConstraint)}</span>` : '';
    return `
    <details class="history-item" ${i === 0 ? 'open' : ''}>
      <summary>
        <div class="row between">
          <strong>${UI.formatDate(e.date)}</strong>
          ${UI.confidenceBadge(r.confidence)}
        </div>
        <p class="faint mt-1" style="font-size:13px;">
          Sleep ${esc(c.sleep)}h · Energy ${esc(c.energy)}/5 · Soreness ${esc(c.soreness)}/5 · Mood ${esc(c.mood)}/5${constraint}
        </p>
        <p class="small mt-1" style="font-weight:600;">${esc(r.mainAction)}</p>
      </summary>
      <div class="hi-body stack-sm">
        <p class="small muted">${esc(r.summary)}</p>
        <div><p class="kicker" style="margin-bottom:2px;">Why</p><p class="small muted">${esc(r.reason)}</p></div>
        <div><p class="kicker" style="margin-bottom:2px;">Supporting habit</p><p class="small muted">${esc(r.supportAction)}</p></div>
        ${r.caution ? `<div><p class="kicker" style="margin-bottom:2px;">Caution</p><p class="small" style="color: var(--amber);">${esc(r.caution)}</p></div>` : ''}
        ${c.extraNote ? `<div><p class="kicker" style="margin-bottom:2px;">Your note</p><p class="small muted">"${esc(c.extraNote)}"</p></div>` : ''}
      </div>
    </details>`;
  }).join('');
})();
