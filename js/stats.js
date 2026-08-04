/* ============================================================
   Striate — stats.js
   Simple weekly review + progress summary.
   No streak system. No bloated dashboard.
============================================================ */

(function () {
  if (!UI.requireProfile()) return;

  UI.renderTabbar('stats');
  if (typeof StriateDebug !== 'undefined') StriateDebug.init();

  const debugBtn = document.getElementById('debug-toggle-btn');
  if (debugBtn && typeof StriateDebug !== 'undefined') {
    debugBtn.addEventListener('click', () => StriateDebug.open());
  }

  const container = document.getElementById('stats-content');
  const profile = Store.getProfile();
  const entries = Store.getEntries();
  const completions = Store.getAllCompletions();
  const sleepLogs = Store.getRecentSleepLogs(14);
  const weeklyReview = Store.getWeeklyReviewSummary();
  const esc = UI.esc;

  const goalLabels = {
    strength: 'Get stronger',
    muscle: 'Build muscle',
    fat_loss: 'Lose fat',
    fitness: 'General fitness',
    energy: 'More daily energy',
    soccer: 'Soccer / athletic',
  };

  function averageReadiness() {
    const recent = entries.slice(0, 7);
    if (!recent.length) return 0;
    return Math.round((recent.reduce((sum, item) => sum + (Number(item.recommendation?.readinessScore) || 0), 0) / recent.length) * 10) / 10;
  }

  function averageSleepQuality() {
    const recent = sleepLogs.slice(0, 7);
    if (!recent.length) return 0;
    return Math.round((recent.reduce((sum, item) => sum + (Number(item.sleepQuality) || 0), 0) / recent.length) * 10) / 10;
  }

  function recentPlanShifts() {
    return entries
      .slice(0, 4)
      .map((item) => item.recommendation?.whyChanged)
      .filter(Boolean);
  }

  function weeklyCompletionText() {
    if (!weeklyReview.totalLoggedSessions) return 'No workout completions logged yet this week.';
    return `${weeklyReview.completed} completed · ${weeklyReview.partial} partial · ${weeklyReview.skipped} skipped`;
  }

  function saveWeeklyReview() {
    const win = document.getElementById('weekly-win-input')?.value.trim() || '';
    const friction = document.getElementById('weekly-friction-input')?.value.trim() || '';
    const keepMethod = document.getElementById('weekly-method-input')?.value.trim() || '';

    Store.saveWeeklyReviewNote(weeklyReview.weekKey, { win, friction, keepMethod });
    if (keepMethod) Store.addTrainingMethod(keepMethod, 'weekly-review');
    if (friction) Store.setScheduleNotes(friction);
    UI.showToast('Weekly review saved. Striate will use it next time.');
    location.reload();
  }

  const planShifts = recentPlanShifts();
  const savedMethods = Store.getTrainingMethods();
  const reviewNote = weeklyReview.note || { win: '', friction: '', keepMethod: '' };

  container.innerHTML = `
    <section class="card mb-3">
      <div class="row between" style="align-items:flex-start;">
        <div>
          <p class="kicker" style="margin-bottom:2px;">Current direction</p>
          <strong style="font-size:18px; color:var(--accent);">${esc(goalLabels[profile.goal] || profile.goal)}</strong>
          <div class="faint mt-1">Sleep-first daily planning · real exercise references · remembered preferences</div>
        </div>
        <a href="onboarding.html?edit=1" class="btn btn-secondary" style="width:auto; padding:8px 12px; min-height:40px; font-size:13px;">
          <i class="fa-solid fa-pen"></i> Edit
        </a>
      </div>
    </section>

    <section class="card mb-3">
      <div class="row between mb-1">
        <p class="kicker" style="margin-bottom:0;">This week</p>
        <span class="badge badge-neutral">${esc(weeklyReview.weekKey)}</span>
      </div>
      <strong style="font-size:20px; display:block;">${esc(weeklyCompletionText())}</strong>
      <p class="small muted mt-1">${esc(weeklyReview.consistencySummary)}</p>
      ${weeklyReview.topBlocker ? `<p class="faint mt-2">Main blocker: ${esc(weeklyReview.topBlocker)}</p>` : ''}
    </section>

    <section class="card mb-3">
      <div class="row between mb-1">
        <p class="kicker" style="margin-bottom:0;">Useful signals</p>
        <span class="faint">Last 7 days</span>
      </div>
      <div class="stats-grid">
        <div class="stat-box">
          <p class="kicker" style="margin-bottom:4px;">Avg readiness</p>
          <div class="stat-val">${esc(averageReadiness())}<span class="stat-unit"> / 10</span></div>
          <div class="stat-trend" style="color:${averageReadiness() >= 7 ? 'var(--accent)' : 'var(--amber)'};">${averageReadiness() >= 7 ? 'Enough recovery to train normally' : 'Recovery still needs protecting'}</div>
        </div>
        <div class="stat-box">
          <p class="kicker" style="margin-bottom:4px;">Avg sleep</p>
          <div class="stat-val">${esc(weeklyReview.avgSleep || 0)}<span class="stat-unit"> hrs</span></div>
          <div class="stat-trend" style="color:${weeklyReview.avgSleep >= 7 ? 'var(--accent)' : 'var(--amber)'};">${weeklyReview.avgSleep >= 7 ? 'Closer to the target' : 'Still below the target window'}</div>
        </div>
        <div class="stat-box">
          <p class="kicker" style="margin-bottom:4px;">Sleep quality</p>
          <div class="stat-val">${esc(averageSleepQuality())}<span class="stat-unit"> / 5</span></div>
          <div class="stat-trend" style="color:${averageSleepQuality() >= 3.5 ? 'var(--accent)' : 'var(--amber)'};">${averageSleepQuality() >= 3.5 ? 'Sleep quality is usable' : 'Quality is still dragging next-day output'}</div>
        </div>
        <div class="stat-box">
          <p class="kicker" style="margin-bottom:4px;">Check-ins</p>
          <div class="stat-val">${esc(weeklyReview.checkIns)}<span class="stat-unit"> this week</span></div>
          <div class="stat-trend" style="color:var(--blue);">Daily data improves adaptation</div>
        </div>
      </div>
    </section>

    <section class="card mb-3">
      <p class="kicker">Coach memory</p>
      <p class="small muted">Saved methods and constraints that should keep showing up in future recommendations.</p>
      <div class="chip-group mt-2">
        ${savedMethods.length
          ? savedMethods.slice(0, 8).map((item) => `<span class="chip selected" style="min-height:auto; padding:6px 10px; font-size:12px;">${esc(item.name || item)}</span>`).join('')
          : '<span class="faint">No saved methods yet.</span>'}
      </div>
      <p class="faint mt-2">Avoided exercises: ${esc(Store.getAvoidedExercises().length)}</p>
    </section>

    <section class="card mb-3">
      <p class="kicker">Recent plan changes</p>
      ${planShifts.length
        ? planShifts.map((item) => `<div class="callout callout-info mb-1">${esc(item)}</div>`).join('')
        : '<p class="small muted">No “why changed” notes yet. They will appear once your plan starts adapting over multiple days.</p>'}
    </section>

    <section class="card card-accent">
      <p class="kicker accent">Weekly review</p>
      <p class="small muted">Keep this short. The goal is to give next week’s plans more reality and less guesswork.</p>

      <div class="field mt-2" style="margin-bottom:14px;">
        <label for="weekly-win-input">What actually worked?</label>
        <textarea id="weekly-win-input" rows="2" placeholder="e.g. walking after class, earlier phone cutoff, 25-minute dumbbell sessions">${esc(reviewNote.win || '')}</textarea>
      </div>

      <div class="field" style="margin-bottom:14px;">
        <label for="weekly-friction-input">What felt unrealistic or annoying?</label>
        <textarea id="weekly-friction-input" rows="2" placeholder="e.g. too much setup, evening sessions ran too late">${esc(reviewNote.friction || '')}</textarea>
      </div>

      <div class="field" style="margin-bottom:14px;">
        <label for="weekly-method-input">Method to keep using next week</label>
        <input type="text" id="weekly-method-input" value="${esc(reviewNote.keepMethod || '')}" placeholder="e.g. walking, machines, short circuits">
      </div>

      <button class="btn btn-primary" id="save-weekly-review-btn">Save weekly review</button>
    </section>
  `;

  document.getElementById('save-weekly-review-btn')?.addEventListener('click', saveWeeklyReview);
})();
