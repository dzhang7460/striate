/* ============================================================
   Striate — today.js
   Renders today's curated schedule, concrete workout routine
   (sets, reps, rest, form cues), sleep-first core loop,
   workout completion tracker, 7-day plan, and preference feedback.
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
  const drawerRoot = document.getElementById('exercise-detail-drawer-root');
  const feedbackRoot = document.getElementById('feedback-modal-root');
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

  // Concrete Exercises List HTML (from WorkoutX / Local engine)
  const exercisesList = (rec.workout?.exercises || []);
  const hasPreferred = Store.getPreferredExercises().length > 0;
  const exercisesHtml = exercisesList.map((ex) => `
    <div class="exercise-card" data-id="${esc(ex.id || '')}" style="margin-bottom:8px; padding:12px;">
      <div class="exercise-card-info">
        <div class="row between">
          <strong class="exercise-card-title" style="font-size:15px;">${esc(ex.name)}</strong>
          <span class="badge badge-high" style="font-size:11px;">${esc(ex.sets)} sets × ${esc(ex.reps)}</span>
        </div>
        <div class="row mt-1" style="gap:8px; flex-wrap:wrap;">
          <span class="badge badge-neutral" style="font-size:11px;"><i class="fa-solid fa-clock"></i> Rest ${esc(ex.rest || '60s')}</span>
          ${ex.bodyPart ? `<span class="badge badge-neutral" style="font-size:11px;">${esc(ex.bodyPart)}</span>` : ''}
          <span class="faint" style="font-size:12px;"><i class="fa-solid fa-circle-info" style="color:var(--accent);"></i> ${esc(ex.formCue || 'Controlled tempo')}</span>
        </div>
      </div>
      <button class="btn-ghost view-ex-btn" data-id="${esc(ex.id || '')}" style="padding:4px 8px; font-size:12px; white-space:nowrap;" title="View in Library">
        View <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
  `).join('');

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

    <!-- Sleep-First Core Loop Target Card -->
    <section class="card mt-3" style="border-color:rgba(125, 179, 240, 0.4); background:rgba(125, 179, 240, 0.05);" id="sleep-core-loop-card">
      <div class="row between mb-1">
        <p class="kicker" style="color:var(--blue); margin-bottom:0;"><i class="fa-solid fa-moon"></i> Sleep-First Core Loop</p>
        <span class="badge badge-neutral" style="font-size:11px;">Target: ${esc(profile.sleepSchedule || '22:00')} Bedtime</span>
      </div>
      <strong style="font-size:15px; color:var(--text);">${esc(rec.sleep?.title || 'Consistent Bedtime & Wind-down')}</strong>
      <p class="small muted mt-1">${esc(rec.sleep?.detail || 'Aim for 7–8 hours of consistent sleep tonight.')}</p>
      <div class="row mt-2" style="gap:8px; flex-wrap:wrap;">
        <span class="badge" style="background:var(--surface-2); color:var(--blue);"><i class="fa-solid fa-clock"></i> Wake: ${esc(rec.sleep?.targetWakeTime || profile.wakeTimeTarget || '7:00 AM')}</span>
        <span class="badge" style="background:var(--surface-2); color:var(--text-dim);"><i class="fa-solid fa-mobile-screen-button"></i> 30m phone cutoff</span>
      </div>
    </section>

    <!-- Workout Routine Card (Specific & Concrete) -->
    <section class="card card-accent mt-3" id="workout-routine-card">
      <div class="row between mb-1">
        <p class="kicker accent" style="margin-bottom:0;">Today's Workout Routine</p>
        <div class="row" style="gap:6px;">
          ${rec.workout?.type ? `<span class="badge badge-neutral" style="font-size:11px; text-transform:uppercase;">${esc(rec.workout.type)}</span>` : ''}
          <span class="badge badge-high">${esc(rec.workout?.durationMinutes || 30)} min</span>
        </div>
      </div>
      <p class="rec-main-action">${esc(rec.workout ? rec.workout.title : (rec.mainAction || 'Active Recovery Walk'))}</p>
      <p class="small muted mt-1 mb-2">${esc(rec.workout ? rec.workout.detail : (rec.detail || 'Follow today\'s beginner routine.'))}</p>
      
      ${hasPreferred ? `
        <div class="callout mb-2" style="background:var(--accent-dim); color:var(--accent); border:1px solid rgba(211,243,78,0.25); font-size:13px;">
          <i class="fa-solid fa-star"></i> <strong>Memory active:</strong> Incorporating your saved preferred exercises.
        </div>
      ` : ''}

      ${exercisesHtml ? `
        <div class="exercises-list mt-2">
          <p class="kicker mb-1">Exercise Checklist (${exercisesList.length} movements)</p>
          ${exercisesHtml}
        </div>
      ` : ''}
    </section>

    <!-- Today's Curated Schedule Timeline -->
    <section class="card mt-2" id="today-schedule-card">
      <div class="row between mb-1">
        <p class="kicker" style="margin-bottom:0;">Today's Curated Schedule</p>
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

    <!-- Why & Explanation + Adjust Plan Action -->
    <section class="card mt-2" id="explanation-card">
      <div class="row between mb-1">
        <p class="kicker" style="margin-bottom:0;">Why This Plan</p>
        <button class="btn-ghost" id="adjust-plan-btn" style="padding:4px 8px; font-size:12px; color:var(--amber);">
          <i class="fa-solid fa-sliders"></i> Too demanding / Annoying?
        </button>
      </div>
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

  // Render Completion Tracker
  renderCompletionTracker();

  // Hook up exercise detail drawer buttons
  main.querySelectorAll('.view-ex-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (id) openExerciseModal(id);
    });
  });

  // Hook up "Too demanding / Annoying?" feedback button
  const adjustBtn = document.getElementById('adjust-plan-btn');
  adjustBtn?.addEventListener('click', () => {
    openFeedbackModal();
  });

  function renderCompletionTracker() {
    const container = document.getElementById('completion-tracker-content');
    if (!container) return;
    const existingLog = Store.getCompletionLog(entry.date);
    const wTitle = rec.workout ? rec.workout.title : (rec.mainAction || 'Today\'s Workout');

    if (existingLog) {
      const statusMap = {
        completed: ['Completed ✅', 'var(--accent)', 'fa-circle-check'],
        partial: ['Partially Completed ⚠️', 'var(--amber)', 'fa-circle-exclamation'],
        skipped: ['Skipped ❌', 'var(--red)', 'fa-circle-xmark'],
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
          <button class="btn-ghost" id="edit-completion-btn" style="padding:6px 10px; font-size:13px;">Edit Log</button>
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
      <p class="kicker" style="margin-bottom:4px;">Workout Completion Log</p>
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

  // Open Exercise Detail Drawer
  async function openExerciseModal(id) {
    let exercise = null;
    try {
      const res = await fetch(`/api/exercises/${encodeURIComponent(id)}`);
      if (res.ok) {
        const json = await res.json();
        exercise = json.data;
      }
    } catch {}

    if (!exercise && Coach.localEngine) {
      // Find in local routine / fallback
      const match = (rec.workout?.exercises || []).find((e) => e.id === id) || {
        id,
        name: id,
        bodyPart: 'full body',
        target: 'general',
        equipment: 'body weight',
        effortLevel: 'beginner',
        instructions: ['Perform with smooth, controlled form.'],
      };
      exercise = match;
    }

    if (!exercise) return;

    const isPref = Store.isPreferredExercise(exercise.id);
    const instructionsHtml = (exercise.instructions || ['Perform with controlled form']).map((ins) => `
      <li style="margin-left:18px; margin-bottom:6px; font-size:14px;">${esc(ins)}</li>
    `).join('');

    drawerRoot.innerHTML = `
      <div class="exercise-drawer-content">
        <div class="row between mb-2">
          <div>
            <span class="kicker" style="margin-bottom:2px;">${esc(exercise.bodyPart || 'General')} · ${esc(exercise.target || 'Full body')}</span>
            <h2 style="font-size:20px;">${esc(exercise.name)}</h2>
          </div>
          <button class="btn-ghost" id="close-today-drawer-btn" style="padding:6px 10px; font-size:16px;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        ${exercise.gifUrl ? `<img class="exercise-drawer-gif" src="${esc(exercise.gifUrl)}" alt="${esc(exercise.name)}" onerror="this.style.display='none'">` : ''}

        <div class="row mb-2" style="flex-wrap:wrap; gap:6px;">
          <span class="badge badge-neutral"><i class="fa-solid fa-dumbbell"></i> ${esc(exercise.equipment || 'body weight')}</span>
          <span class="badge ${exercise.effortLevel === 'beginner' ? 'badge-high' : 'badge-medium'}">${esc(exercise.effortLevel || 'beginner')}</span>
        </div>

        <p class="kicker mt-2">Instructions</p>
        <ol class="mt-1 mb-3">${instructionsHtml}</ol>

        <button class="btn ${isPref ? 'btn-secondary' : 'btn-primary'}" id="today-use-ex-btn">
          <i class="fa-solid ${isPref ? 'fa-check' : 'fa-plus'}"></i>
          <span>${isPref ? '✅ Saved to Preferred Exercises' : 'Save to Preferred Exercises'}</span>
        </button>
      </div>
    `;

    drawerRoot.classList.remove('hidden');
    document.getElementById('close-today-drawer-btn')?.addEventListener('click', () => {
      drawerRoot.classList.add('hidden');
    });

    document.getElementById('today-use-ex-btn')?.addEventListener('click', () => {
      if (!Store.isPreferredExercise(exercise.id)) {
        Store.savePreferredExercise(exercise);
        UI.showToast(`Saved "${exercise.name}" to your preferred exercises!`);
        drawerRoot.classList.add('hidden');
      } else {
        UI.showToast(`"${exercise.name}" is already in your preferences.`);
      }
    });
  }

  // Open "Adjust / Correct this plan" feedback modal
  function openFeedbackModal() {
    feedbackRoot.innerHTML = `
      <div class="exercise-drawer-content">
        <div class="row between mb-2">
          <h2 style="font-size:19px;"><i class="fa-solid fa-sliders" style="color:var(--amber);"></i> Adjust Today's Recommendation</h2>
          <button class="btn-ghost" id="close-feedback-btn" style="padding:6px 10px; font-size:16px;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <p class="small muted mb-2">Striate AI remembers your feedback so it won't repeat suggestions that don't fit.</p>

        <span class="label">Why doesn't this plan fit today?</span>
        <div class="chip-group mb-2" data-name="dislikeReason">
          <button class="chip" data-value="Too demanding / Annoying">Too demanding / Annoying</button>
          <button class="chip" data-value="Not realistic for my schedule">Not realistic for my schedule</button>
          <button class="chip" data-value="Prefer different exercises">Prefer different exercises</button>
          <button class="chip" data-value="Need more sleep focus">Need more sleep focus</button>
        </div>

        <input type="text" id="feedback-custom-note" placeholder="Optional specific correction..." style="margin-bottom:14px;">

        <button class="btn btn-primary" id="save-feedback-btn">
          <i class="fa-solid fa-check"></i> Save Feedback &amp; Adapt Plan
        </button>
      </div>
    `;

    feedbackRoot.classList.remove('hidden');
    UI.initChipGroups(feedbackRoot);

    document.getElementById('close-feedback-btn')?.addEventListener('click', () => {
      feedbackRoot.classList.add('hidden');
    });

    document.getElementById('save-feedback-btn')?.addEventListener('click', () => {
      const reason = UI.chipValue('dislikeReason', feedbackRoot) ||
                     document.getElementById('feedback-custom-note')?.value.trim() ||
                     'Too demanding / Annoying';
      Store.addDislikedSuggestion(reason);
      UI.showToast(`Feedback remembered: "${reason}". Striate AI will adapt.`);
      feedbackRoot.classList.add('hidden');
      // Re-normalize and update Today's view to reflect reduced/adapted intensity
      location.reload();
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
