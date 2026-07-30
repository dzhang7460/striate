/* ============================================================
   Striate — today.js
   Renders today's recommendation (the main event) or an
   empty state prompting a check-in.
============================================================ */

(function () {
  if (!UI.requireProfile()) return;
  UI.renderTabbar('today');

  document.getElementById('date-label').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  const main = document.getElementById('today-main');
  const entry = Store.getTodayEntry();

  if (!entry) {
    main.innerHTML = `
      <section class="card text-center" style="padding: 40px 24px;" id="empty-state">
        <i class="fa-solid fa-circle-check" style="font-size: 32px; color: var(--text-faint);" aria-hidden="true"></i>
        <h2 class="mt-2">No plan yet today</h2>
        <p class="muted small mt-1">Do your check-in and I'll build today's recommendation from it. Takes about a minute.</p>
        <a class="btn btn-primary mt-3" href="check-in.html">Start check-in</a>
      </section>`;
    return;
  }

  const rec = entry.recommendation;
  const c = entry.checkin;
  const esc = UI.esc;

  const checkinChips = [
    `<span class="badge badge-neutral">Sleep ${esc(c.sleep)}h</span>`,
    `<span class="badge badge-neutral">Energy ${esc(c.energy)}/5</span>`,
    `<span class="badge badge-neutral">Soreness ${esc(c.soreness)}/5</span>`,
    `<span class="badge badge-neutral">Mood ${esc(c.mood)}/5</span>`,
    c.specialConstraint && c.specialConstraint !== 'none'
      ? `<span class="badge badge-medium">${esc(c.specialConstraint)}</span>` : '',
  ].join(' ');

  main.innerHTML = `
    <section id="state-summary">
      <p class="kicker">Your state today</p>
      <p class="small muted">${esc(rec.summary)}</p>
      <div class="row mt-1" style="flex-wrap: wrap; gap: 6px;">${checkinChips}</div>
    </section>

    <section class="card card-accent mt-3" id="main-recommendation">
      <div class="row between mb-1">
        <p class="kicker accent" style="margin-bottom:0;">Do this today</p>
        ${UI.confidenceBadge(rec.confidence)}
      </div>
      <p class="rec-main-action">${esc(rec.mainAction)}</p>
      ${rec.detail ? `<p class="small muted mt-1">${esc(rec.detail)}</p>` : ''}
      <hr class="divider">
      <p class="kicker">Why</p>
      <p class="small">${esc(rec.reason)}</p>
    </section>

    <section class="card" id="support-action">
      <p class="kicker">One supporting habit</p>
      <p class="small">${esc(rec.supportAction)}</p>
    </section>

    ${rec.caution ? `
    <div class="callout callout-caution mt-2" id="caution-note" role="note">
      <strong><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Caution:</strong> ${esc(rec.caution)}
    </div>` : ''}

    <section class="card" id="confidence-note" style="margin-top:12px;">
      <p class="kicker">How sure is this?</p>
      <p class="small muted">${esc(rec.confidenceNote)}</p>
      ${rec.whyChanged ? `<hr class="divider"><p class="kicker">Why this changed</p><p class="small muted">${esc(rec.whyChanged)}</p>` : ''}
    </section>

    <a class="btn btn-secondary mt-3" href="check-in.html" id="redo-link">Redo today's check-in</a>
    <p class="faint text-center mt-2">General guidance for healthy beginners — not medical advice.</p>
  `;
})();
