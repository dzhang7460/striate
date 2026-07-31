/* ============================================================
   Striate — today.js
   Renders today's curated schedule, workout completion tracker,
   explanation, 7-day plan, and confidence indicators.
============================================================ */

(function () {
  if (!UI.requireProfile()) return;
  UI.renderTabbar('today');
  if (typeof StriateDebug !== 'undefined') StriateDebug.init();

  const debugBtn = document.getElementById('debug-toggle-btn');
  if (debugBtn && typeof StriateDebug !== 'undefined') {
    debugBtn.addEventListener('click', () => StriateDebug.open());
  }

  document.getElementById('date-label').textContent =
    new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  const main = document.getElementById('today-main');
  const entry = Store.getTodayEntry();
  const profile = Store.getProfile();

  if (!entry) {
    main.innerHTML = `
      <section class="card text-center" style="padding: 40px 24px;" id="empty-state">
        <i class="fa-solid fa-circle-check" style="font-size: 32px; color: var(--text-faint);" aria-hidden="true"></i>
        <h2 class="mt-2">No plan yet today</h2>
        <p class="muted small mt-1">Do your check-in and I'll build today's curated schedule and recommendation. Takes about a minute.</p>
        <a class="btn btn-primary mt-3" href="check-in.html">Start check-in</a>
      </section>`;
    return;
  }

  const prevEntry = Store.getLastEntryBefore(entry.date);
  const rec = Coach.normalizeRecommendation(entry.recommendation, profile, entry.checkin, prevEntry, {
    prevCompletion: Store.getCompletionLog(prevEntry ? prevEntry.date : null)
  });
  const c = entry.checkin;
  const esc = UI.esc;

  const checkinChips = [
    `<span class="badge badge-neutral">Sleep ${esc(c.sleep)}h</span>`,
    `<span class="badge badge-neutral">Energy ${esc(c.energy)}/5</span>`,
    `<span class="badge badge-neutral">Soreness ${esc(c.soreness)}/5</span>`,
    `<span class="badge badge-neutral">Mood ${esc(c.mood)}/5</span>`,
    `<span class="badge badge-neutral"><i class="fa-solid fa-clock"></i> ${esc(c.dedicatedWorkoutTime || profile.dedicatedWorkoutTime || '5-6 PM')}</span>`,
    c.specialConstraint && c.specialConstraint !== 'none'
      ? `<span class="badge badge-medium">${esc(c.specialConstraint)}</span>` : '',
  ].join(' ');

  // Schedule blocks HTML
  const scheduleHtml = (rec.todaySchedule || []).map((b) => {
    const isWorkout = b.type === 'workout';
    const icon = UI.scheduleTypeIcon(b.type);
    return `
      <div class="timeline-block ${isWorkout ? 'workout-block' : ''}">
        <div class="timeline-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="timeline-content">
          <div class="timeline-time">${esc(b.time)}</div>
          <div class="timeline-title">${esc(b.title)}</div>
          <div class="timeline-detail">${esc(b.detail)}</div>
        </div>
      </div>
    `;
  }).join('');

  // Things to avoid HTML
  const avoidHtml = (rec.thingsToAvoid || []).map((t) => `
    <li style="margin-left: 18px; margin-bottom: 6px; font-size:13.5px; color:var(--amber);">
      ${esc(t)}
    </li>
  `).join('');

  // 7-day plan HTML
  const sevenDayHtml = (rec.sevenDayPlan || []).map((d, i) => `
    <div class="seven-day-item ${i === 0 ? 'is-today' : ''}">
      <div class="row between">
        <strong style="font-size:14px; color:${i === 0 ? 'var(--accent)' : 'var(--text)'};">${esc(d.day)}</strong>
        <span class="badge badge-neutral" style="font-size:11px;">${esc(d.focus)}</span>
      </div>
      <div class="small mt-1" style="font-weight:600;">${esc(d.mainAction)}</div>
      <div class="faint mt-1" style="font-size:12px;">${esc(d.note)}</div>
    </div>
  `).join('');

  main.innerHTML = `
    <!-- Top Summary -->
    <section id="state-summary">
      <div class="row between">
        <p class="kicker" style="margin-bottom:0;">Your state today</p>
        <span class="badge ${rec.readinessScore >= 7 ? 'badge-high' : rec.readinessScore >= 5 ? 'badge-medium' : 'badge-low'}">
          Readiness ${rec.readinessScore}/10
        </span>
      </div>
      <p class="small muted mt-1">${esc(rec.summary)}</p>
      <div class="row mt-1" style="flex-wrap: wrap; gap: 6px;">${checkinChips}</div>
    </section>

    <!-- Today's Schedule -->
    <section class="card card-accent mt-3" id="today-schedule-card">
      <div class="row between mb-1">
        <p class="kicker accent" style="margin-bottom:0;">Today's Schedule</p>
        ${UI.confidenceBadge(rec.confidence)}
      </div>
      <div class="schedule-timeline mt-2">
        ${scheduleHtml}
      </div>
    </section>

    <!-- Workout Completion Tracker Card -->
    <section class="card mt-2" id="completion-tracker-section">
      <div id="completion-tracker-content"></div>
    </section>

    <!-- Why & Explanation -->
    <section class="card mt-2" id="explanation-card">
      <p class="kicker">Why This Plan</p>
      <p class="small">${esc(rec.explanation)}</p>
      ${avoidHtml ? `
        <hr class="divider">
        <p class="kicker" style="color:var(--amber);"><i class="fa-solid fa-triangle-exclamation"></i> Things to Avoid</p>
        <ul style="margin-top:6px;">${avoidHtml}</ul>
      ` : ''}
    </section>

    <!-- Supporting Habits -->
    ${(rec.habits && rec.habits.length > 0) ? `
    <section class="card mt-2" id="habits-card">
      <p class="kicker">Supporting Habits</p>
      ${rec.habits.map((h) => `
        <div class="mb-1">
          <strong style="font-size:14px;">${esc(h.title)}</strong>
          <p class="small muted">${esc(h.detail)}</p>
        </div>
      `).join('')}
    </section>
    ` : ''}

    <!-- Follow-up Question (only when needed) -->
    ${rec.followUpQuestion ? `
    <section class="card mt-2" style="border-color:var(--blue);" id="followup-card">
      <p class="kicker" style="color:var(--blue);"><i class="fa-solid fa-circle-question"></i> Coach's Follow-up</p>
      <p class="small mb-2">${esc(rec.followUpQuestion)}</p>
      <div class="chip-group" data-name="followup-answer">
        <button class="chip" data-value="busy">Too busy / Schedule conflict</button>
        <button class="chip" data-value="tired">Low energy or sore</button>
        <button class="chip" data-value="other">Other reason</button>
      </div>
      <input type="text" id="followup-note" class="mt-1" placeholder="Optional brief explanation...">
      <button class="btn btn-secondary mt-1" id="save-followup-btn" style="min-height:44px; font-size:14px;">Save reply</button>
    </section>
    ` : ''}

    <!-- Confidence Note & Why Changed -->
    <section class="card mt-2" id="confidence-note">
      <p class="kicker">Confidence &amp; Certainty</p>
      <p class="small muted">${esc(rec.confidenceNote)}</p>
      ${rec.whyChanged ? `
        <hr class="divider">
        <p class="kicker">Why This Changed vs. Previous Day</p>
        <p class="small muted">${esc(rec.whyChanged)}</p>
      ` : ''}
    </section>

    <!-- 7-Day Plan Accordion -->
    <details class="card mt-2" id="seven-day-plan-card">
      <summary style="cursor:pointer; list-style:none; display:flex; align-items:center; justify-content:space-between; -webkit-tap-highlight-color:transparent;">
        <div>
          <p class="kicker" style="margin-bottom:2px;">Long-term Context</p>
          <strong style="font-size:16px;">Your Upcoming 7-Day Plan</strong>
        </div>
        <i class="fa-solid fa-chevron-down muted"></i>
      </summary>
      <div class="seven-day-list mt-2">
        ${sevenDayHtml}
      </div>
    </details>

    <a class="btn btn-secondary mt-3" href="check-in.html" id="redo-link">Redo today's check-in</a>
    <p class="faint text-center mt-2 mb-2">General guidance for healthy beginners — not medical advice.</p>
  `;

  // Render Completion Tracker inside #completion-tracker-content
  renderCompletionTracker();

  function renderCompletionTracker() {
    const container = document.getElementById('completion-tracker-content');
    if (!container) return;
    const existingLog = Store.getCompletionLog(entry.date);
    const wTitle = rec.workout ? rec.workout.title : (rec.mainAction || 'Today\'s Workout');

    if (existingLog) {
      const statusMap = {
        completed: ['Completed', 'var(--accent)', 'fa-circle-check'],
        partial: ['Partially Completed', 'var(--amber)', 'fa-circle-exclamation'],
        skipped: ['Skipped', 'var(--red)', 'fa-circle-xmark'],
      };
      const [label, color, icon] = statusMap[existingLog.status] || ['Logged', 'var(--text)', 'fa-circle-info'];
      container.innerHTML = `
        <div class="row between">
          <div>
            <p class="kicker" style="margin-bottom:2px;">Workout Completion Status</p>
            <strong style="font-size:15px; color:${color};"><i class="fa-solid ${icon}"></i> ${label}</strong>
            ${existingLog.reason ? `<div class="small muted mt-1">Reason: ${esc(existingLog.reason)}</div>` : ''}
            ${existingLog.note ? `<div class="faint mt-1">"${esc(existingLog.note)}"</div>` : ''}
          </div>
          <button class="chip" id="edit-completion-btn" style="padding:6px 10px; font-size:13px;">Edit Log</button>
        </div>
      `;
      document.getElementById('edit-completion-btn')?.addEventListener('click', () => {
        renderCompletionForm(existingLog);
      });
    } else {
      renderCompletionForm();
    }
  }

  function renderCompletionForm(prefillLog = null) {
    const container = document.getElementById('completion-tracker-content');
    if (!container) return;
    const wTitle = rec.workout ? rec.workout.title : (rec.mainAction || 'Today\'s Workout');
    container.innerHTML = `
      <p class="kicker" style="margin-bottom:4px;">Completion Log</p>
      <strong style="font-size:15px;">Did you complete "${esc(wTitle)}"?</strong>
      <div class="completion-buttons mt-1">
        <button class="btn-status" data-status="completed">✅ Completed</button>
        <button class="btn-status" data-status="partial">⚠️ Partial</button>
        <button class="btn-status" data-status="skipped">❌ Skipped</button>
      </div>
      <div id="completion-reason-box" class="hidden mt-2">
        <span class="label small">Reason (optional)</span>
        <div class="chip-group" data-name="completionReason">
          <button class="chip" data-value="Too busy / No time">Too busy</button>
          <button class="chip" data-value="Low energy / Sore">Low energy / Sore</button>
          <button class="chip" data-value="Pain / Injury">Pain / Injury</button>
          <button class="chip" data-value="Schedule conflict">Schedule conflict</button>
          <button class="chip" data-value="Other">Other</button>
        </div>
        <input type="text" id="completion-note-input" class="mt-1" placeholder="Optional note or details...">
      </div>
      <button class="btn btn-primary mt-2 hidden" id="save-completion-btn" style="min-height:44px; font-size:15px;">Save Workout Log</button>
    `;

    const statusBtns = container.querySelectorAll('.btn-status');
    const reasonBox = document.getElementById('completion-reason-box');
    const saveBtn = document.getElementById('save-completion-btn');
    let selectedStatus = prefillLog ? prefillLog.status : null;

    UI.initChipGroups(container);

    statusBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        statusBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        selectedStatus = btn.dataset.status;
        saveBtn.classList.remove('hidden');
        if (selectedStatus === 'partial' || selectedStatus === 'skipped') {
          reasonBox.classList.remove('hidden');
        } else {
          reasonBox.classList.add('hidden');
        }
      });
    });

    if (prefillLog) {
      const matchBtn = container.querySelector(`.btn-status[data-status="${prefillLog.status}"]`);
      if (matchBtn) matchBtn.click();
      if (prefillLog.reason) UI.setChipValue('completionReason', prefillLog.reason, container);
      const noteInput = document.getElementById('completion-note-input');
      if (noteInput && prefillLog.note) noteInput.value = prefillLog.note;
    }

    saveBtn?.addEventListener('click', () => {
      if (!selectedStatus) return;
      const reason = (selectedStatus === 'partial' || selectedStatus === 'skipped')
        ? UI.chipValue('completionReason', container) : null;
      const note = document.getElementById('completion-note-input')?.value.trim() || null;
      Store.saveCompletionLog(entry.date, {
        plannedWorkout: wTitle,
        status: selectedStatus,
        reason,
        note,
      });
      renderCompletionTracker();
    });
  }

  // Hook up follow-up answer button if present
  const saveFollowupBtn = document.getElementById('save-followup-btn');
  if (saveFollowupBtn) {
    saveFollowupBtn.addEventListener('click', () => {
      const answer = UI.chipValue('followup-answer') || document.getElementById('followup-note')?.value.trim();
      if (answer) {
        Store.saveCompletionLog(entry.date, {
          plannedWorkout: rec.workout ? rec.workout.title : 'Workout',
          status: 'skipped',
          reason: answer,
          note: document.getElementById('followup-note')?.value.trim() || null,
        });
        const followupCard = document.getElementById('followup-card');
        if (followupCard) {
          followupCard.innerHTML = `
            <p class="kicker" style="color:var(--accent);"><i class="fa-solid fa-check"></i> Follow-up Saved</p>
            <p class="small">Thanks for clarifying. Tomorrow's recommendation will adapt to this feedback.</p>
          `;
        }
      }
    });
  }
})();
