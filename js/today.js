/* ============================================================
   Striate — today.js
   Today view focused on:
   - sleep-first daily schedule
   - real workout exercises
   - memory + progression signals
   - honest adaptation
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
  const weeklyReview = Store.getWeeklyReviewSummary();

  if (!entry) {
    main.innerHTML = `
      <section class="card text-center" style="padding: 40px 24px;">
        <i class="fa-solid fa-circle-check" style="font-size:32px; color:var(--text-faint);"></i>
        <h2 class="mt-2">No plan yet today</h2>
        <p class="muted small mt-1">Do your check-in first. Striate will build a sleep-first schedule and today’s workout from that.</p>
        <a class="btn btn-primary mt-3" href="check-in.html">Start check-in</a>
      </section>
    `;
    return;
  }

  const prevEntry = Store.getLastEntryBefore(entry.date);
  const recommendation = Coach.normalizeRecommendation(entry.recommendation, profile, entry.checkin, prevEntry, {
    entryCount: Store.getEntries().length,
    prevCompletion: Store.getCompletionLog(prevEntry ? prevEntry.date : null),
    weeklyReview,
  });

  const checkin = entry.checkin;
  const esc = UI.esc;
  const poorSleep = recommendation.structuredData?.poorSleepMode;
  const trainingMethods = Store.getTrainingMethods();
  const preferredExercises = Store.getPreferredExercises();
  const avoidedExercises = Store.getAvoidedExercises();
  const topBlocker = weeklyReview?.topBlocker;

  function sleepLabel() {
    const parts = [
      `Sleep ${esc(checkin.sleep)}h`,
      `Quality ${esc(checkin.sleepQuality)}/5`,
      `Bedtime ${esc(checkin.bedtimeConsistency || 'n/a')}`,
      `Screens ${esc(checkin.screenCutoff || 'n/a')}`,
    ];
    return parts.map((item) => `<span class="badge badge-neutral">${item}</span>`).join(' ');
  }

  function readinessBadge(score) {
    const cls = score >= 7 ? 'badge-high' : score >= 5 ? 'badge-medium' : 'badge-low';
    return `<span class="badge ${cls}">Readiness ${score}/10</span>`;
  }

  function renderSchedule() {
    return (recommendation.todaySchedule || []).map((block) => `
      <div class="timeline-block ${block.type === 'workout' ? 'workout-block' : ''}">
        <div class="timeline-icon"><i class="fa-solid ${UI.scheduleTypeIcon(block.type)}"></i></div>
        <div class="timeline-content">
          <div class="timeline-time">${esc(block.time)}</div>
          <div class="timeline-title">${esc(block.title)}</div>
          <div class="timeline-detail">${esc(block.detail)}</div>
        </div>
      </div>
    `).join('');
  }

  function renderExercises() {
    const exercises = recommendation.workout?.exercises || [];
    if (!exercises.length) {
      return `
        <div class="callout callout-info mt-2">
          No workout block today. The useful work is recovery and sleep consistency.
        </div>
      `;
    }

    return exercises.map((exercise) => `
      <button class="exercise-card today-exercise-btn" data-id="${esc(exercise.exerciseId || exercise.id)}" style="width:100%; text-align:left; margin-bottom:8px; padding:12px; border-radius:14px; border:1px solid var(--border); background:var(--surface-2);">
        <div class="row between" style="align-items:flex-start; gap:10px;">
          <div style="min-width:0;">
            <strong class="exercise-card-title" style="font-size:15px; display:block;">${esc(exercise.name)}</strong>
            <div class="row mt-1" style="gap:6px; flex-wrap:wrap;">
              <span class="badge badge-high" style="font-size:11px;">${esc(exercise.sets)} sets × ${esc(exercise.reps)}</span>
              <span class="badge badge-neutral" style="font-size:11px;">ID ${esc(exercise.exerciseId || exercise.id)}</span>
            </div>
          </div>
          <span class="btn-ghost" style="padding:0; min-height:auto; color:var(--accent); white-space:nowrap;">Details <i class="fa-solid fa-chevron-right"></i></span>
        </div>
        <div class="row mt-1" style="gap:8px; flex-wrap:wrap;">
          ${exercise.bodyPart ? `<span class="badge badge-neutral" style="font-size:11px;">${esc(exercise.bodyPart)}</span>` : ''}
          ${exercise.target ? `<span class="badge badge-neutral" style="font-size:11px;">${esc(exercise.target)}</span>` : ''}
          <span class="faint" style="font-size:12px;">${esc(exercise.formCue || 'Controlled form.')}</span>
        </div>
      </button>
    `).join('');
  }

  function renderMemoryCard() {
    const methodBadges = trainingMethods.length
      ? trainingMethods.slice(0, 5).map((item) => `<span class="chip selected" style="min-height:auto; padding:6px 10px; font-size:12px;">${esc(item.name || item)}</span>`).join('')
      : '<span class="faint">No saved training methods yet.</span>';

    const avoidedList = avoidedExercises.length
      ? avoidedExercises.slice(0, 3).map((item) => esc(item.name)).join(', ')
      : 'None saved';

    return `
      <section class="card mt-2" id="coach-memory-card">
        <div class="row between mb-1">
          <p class="kicker" style="margin-bottom:0;">Coach Memory</p>
          <a class="btn-ghost" href="onboarding.html?edit=1" style="padding:4px 8px; font-size:12px; min-height:auto; width:auto;">Edit profile</a>
        </div>
        <p class="small muted">I’m remembering what you like, what you avoid, and what has already felt unrealistic.</p>

        <div class="mt-2">
          <p class="kicker" style="margin-bottom:6px;">Training methods</p>
          <div class="chip-group">${methodBadges}</div>
        </div>

        <div class="mt-2">
          <p class="kicker" style="margin-bottom:6px;">Avoided exercises</p>
          <p class="small muted">${avoidedList}</p>
        </div>

        <div class="mt-2">
          <p class="kicker" style="margin-bottom:6px;">Weekly reality check</p>
          <p class="small muted">${esc(weeklyReview?.consistencySummary || 'No weekly review yet.')}</p>
          ${topBlocker ? `<p class="faint mt-1">Most common blocker: ${esc(topBlocker)}</p>` : ''}
        </div>
      </section>
    `;
  }

  main.innerHTML = `
    <section id="state-summary">
      <div class="row between" style="align-items:flex-start;">
        <div>
          <p class="kicker" style="margin-bottom:0;">Today</p>
          <h1 style="font-size:24px; margin-top:4px;">Low-friction schedule</h1>
        </div>
        ${readinessBadge(recommendation.readinessScore)}
      </div>
      <p class="small muted mt-1">${esc(recommendation.summary)}</p>
      <div class="row mt-2" style="flex-wrap:wrap; gap:6px;">${sleepLabel()}</div>
    </section>

    <section class="card mt-3" style="border-color:rgba(125,179,240,0.4); background:rgba(125,179,240,0.05);">
      <div class="row between mb-1">
        <p class="kicker" style="color:var(--blue); margin-bottom:0;">Sleep-first mode</p>
        <span class="badge ${poorSleep ? 'badge-medium' : 'badge-neutral'}">${poorSleep ? 'Sleep was poor' : 'Sleep block protected'}</span>
      </div>
      <strong style="font-size:16px; display:block;">${esc(recommendation.sleep?.title || 'Protect sleep tonight')}</strong>
      <p class="small muted mt-1">${esc(recommendation.sleep?.detail || '')}</p>
      <div class="stats-grid mt-2" style="grid-template-columns:repeat(2,1fr);">
        <div class="stat-box">
          <p class="kicker" style="margin-bottom:4px;">Bedtime</p>
          <div class="stat-val" style="font-size:22px;">${esc(recommendation.sleep?.targetBedtime || '--')}</div>
          <div class="stat-trend">Wind-down before bed</div>
        </div>
        <div class="stat-box">
          <p class="kicker" style="margin-bottom:4px;">Wake time</p>
          <div class="stat-val" style="font-size:22px;">${esc(recommendation.sleep?.targetWakeTime || '--')}</div>
          <div class="stat-trend">Keep it consistent</div>
        </div>
      </div>
      <div class="callout callout-info mt-2">
        ${esc(recommendation.sleep?.windDownAction || 'Screens off before bed.')}
      </div>
    </section>

    <section class="card mt-2">
      <div class="row between mb-1">
        <p class="kicker" style="margin-bottom:0;">Today’s schedule</p>
        ${UI.confidenceBadge(recommendation.confidence)}
      </div>
      <div class="schedule-timeline mt-2">
        ${renderSchedule()}
      </div>
    </section>

    <section class="card card-accent mt-2">
      <div class="row between mb-1">
        <p class="kicker accent" style="margin-bottom:0;">Workout</p>
        ${recommendation.workout ? `<span class="badge badge-high">${esc(recommendation.workout.durationMinutes)} min</span>` : '<span class="badge badge-neutral">Recovery</span>'}
      </div>
      <p class="rec-main-action">${esc(recommendation.workout?.title || 'Recovery only')}</p>
      <p class="small muted mt-1">${esc(recommendation.workout?.detail || recommendation.detail)}</p>
      ${preferredExercises.length ? `
        <div class="callout mt-2" style="background:var(--accent-dim); color:var(--accent); border:1px solid rgba(211,243,78,0.25);">
          Memory active: preferred exercises are being considered in today’s plan.
        </div>
      ` : ''}
      <div class="mt-2">${renderExercises()}</div>
    </section>

    <section class="card mt-2" id="completion-tracker-section">
      <div id="completion-tracker-content"></div>
    </section>

    ${renderMemoryCard()}

    <section class="card mt-2">
      <div class="row between mb-1">
        <p class="kicker" style="margin-bottom:0;">Why this plan</p>
        <button class="btn-ghost" id="adjust-plan-btn" style="padding:4px 8px; font-size:12px; min-height:auto; width:auto; color:var(--amber);">
          <i class="fa-solid fa-sliders"></i> Unrealistic?
        </button>
      </div>
      <p class="small">${esc(recommendation.explanation)}</p>
      ${recommendation.thingsToAvoid?.length ? `
        <hr class="divider">
        <p class="kicker" style="color:var(--amber);">Things to avoid</p>
        <ul style="margin-top:6px;">
          ${recommendation.thingsToAvoid.map((item) => `<li style="margin-left:18px; margin-bottom:6px; color:var(--amber); font-size:13.5px;">${esc(item)}</li>`).join('')}
        </ul>
      ` : ''}
    </section>

    ${recommendation.habits?.length ? `
      <section class="card mt-2">
        <p class="kicker">Support habits</p>
        ${recommendation.habits.map((habit) => `
          <div class="mb-1">
            <strong style="font-size:14px;">${esc(habit.title)}</strong>
            <p class="small muted">${esc(habit.detail)}</p>
          </div>
        `).join('')}
      </section>
    ` : ''}

    ${recommendation.followUpQuestion ? `
      <section class="card mt-2" id="followup-card" style="border-color:var(--blue);">
        <p class="kicker" style="color:var(--blue);">Follow-up</p>
        <p class="small mb-2">${esc(recommendation.followUpQuestion)}</p>
        <div class="chip-group" data-name="followup-answer">
          <button class="chip" data-value="Too busy">Too busy</button>
          <button class="chip" data-value="Low energy / sore">Low energy / sore</button>
          <button class="chip" data-value="Plan felt unrealistic">Plan felt unrealistic</button>
        </div>
        <input type="text" id="followup-note" class="mt-1" placeholder="Optional quick note">
        <button class="btn btn-secondary mt-1" id="save-followup-btn" style="min-height:44px; font-size:14px;">Save reply</button>
      </section>
    ` : ''}

    <section class="card mt-2">
      <p class="kicker">Confidence and change log</p>
      <p class="small muted">${esc(recommendation.confidenceNote)}</p>
      ${recommendation.whyChanged ? `
        <hr class="divider">
        <p class="kicker">Why this changed</p>
        <p class="small muted">${esc(recommendation.whyChanged)}</p>
      ` : ''}
    </section>

    <details class="card mt-2">
      <summary style="cursor:pointer; list-style:none; display:flex; align-items:center; justify-content:space-between;">
        <div>
          <p class="kicker" style="margin-bottom:2px;">Seven-day context</p>
          <strong style="font-size:16px;">Simple week preview</strong>
        </div>
        <i class="fa-solid fa-chevron-down muted"></i>
      </summary>
      <div class="seven-day-list mt-2">
        ${(recommendation.sevenDayPlan || []).map((day, index) => `
          <div class="seven-day-item ${index === 0 ? 'is-today' : ''}">
            <div class="row between">
              <strong style="font-size:14px; color:${index === 0 ? 'var(--accent)' : 'var(--text)'};">${esc(day.day)}</strong>
              <span class="badge badge-neutral" style="font-size:11px;">${esc(day.focus)}</span>
            </div>
            <div class="small mt-1" style="font-weight:600;">${esc(day.mainAction)}</div>
            <div class="faint mt-1" style="font-size:12px;">${esc(day.note)}</div>
          </div>
        `).join('')}
      </div>
    </details>

    <a class="btn btn-secondary mt-3" href="check-in.html">Redo today’s check-in</a>
    <p class="faint text-center mt-2 mb-2">General guidance for healthy beginners — not medical advice.</p>
  `;

  renderCompletionTracker();
  wireExerciseButtons();
  wireFollowUp();
  document.getElementById('adjust-plan-btn')?.addEventListener('click', openFeedbackModal);

  function renderCompletionTracker() {
    const container = document.getElementById('completion-tracker-content');
    if (!container) return;

    const existing = Store.getCompletionLog(entry.date);
    const title = recommendation.workout?.title || 'Today’s plan';

    if (existing) {
      const statusMap = {
        completed: ['Completed ✅', 'var(--accent)', 'fa-circle-check'],
        partial: ['Partial ⚠️', 'var(--amber)', 'fa-circle-exclamation'],
        skipped: ['Skipped ❌', 'var(--red)', 'fa-circle-xmark'],
      };
      const [label, color, icon] = statusMap[existing.status] || ['Logged', 'var(--text)', 'fa-circle-info'];
      container.innerHTML = `
        <div class="row between" style="align-items:flex-start;">
          <div>
            <p class="kicker" style="margin-bottom:2px;">Completion log</p>
            <strong style="font-size:15px; color:${color};"><i class="fa-solid ${icon}"></i> ${label}</strong>
            ${existing.reason ? `<div class="small muted mt-1">Reason: ${esc(existing.reason)}</div>` : ''}
            ${existing.note ? `<div class="faint mt-1">${esc(existing.note)}</div>` : ''}
          </div>
          <button class="btn-ghost" id="edit-completion-btn" style="padding:4px 8px; font-size:12px; min-height:auto; width:auto;">Edit</button>
        </div>
      `;
      document.getElementById('edit-completion-btn')?.addEventListener('click', () => renderCompletionForm(existing));
      return;
    }

    renderCompletionForm();

    function renderCompletionForm(prefill = null) {
      container.innerHTML = `
        <p class="kicker" style="margin-bottom:4px;">Completion log</p>
        <strong style="font-size:15px;">Did you do “${esc(title)}”?</strong>
        <div class="completion-buttons mt-1">
          <button class="btn-status" data-status="completed">✅ Completed</button>
          <button class="btn-status" data-status="partial">⚠️ Partial</button>
          <button class="btn-status" data-status="skipped">❌ Skipped</button>
        </div>
        <div id="completion-reason-box" class="hidden mt-2">
          <div class="chip-group" data-name="completionReason">
            <button class="chip" data-value="Too busy">Too busy</button>
            <button class="chip" data-value="Low energy / sore">Low energy / sore</button>
            <button class="chip" data-value="Pain / injury">Pain / injury</button>
            <button class="chip" data-value="Plan felt unrealistic">Plan felt unrealistic</button>
          </div>
          <input type="text" id="completion-note-input" class="mt-1" placeholder="Optional quick note">
        </div>
        <button class="btn btn-primary mt-2 hidden" id="save-completion-btn" style="min-height:44px; font-size:15px;">Save log</button>
      `;

      UI.initChipGroups(container);
      const buttons = container.querySelectorAll('.btn-status');
      const reasonBox = document.getElementById('completion-reason-box');
      const saveBtn = document.getElementById('save-completion-btn');
      let selectedStatus = prefill?.status || null;

      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          buttons.forEach((item) => item.classList.remove('active'));
          button.classList.add('active');
          selectedStatus = button.dataset.status;
          saveBtn.classList.remove('hidden');
          reasonBox.classList.toggle('hidden', selectedStatus === 'completed');
        });
      });

      if (prefill) {
        const existingBtn = container.querySelector(`.btn-status[data-status="${prefill.status}"]`);
        if (existingBtn) existingBtn.click();
        if (prefill.reason) UI.setChipValue('completionReason', prefill.reason, container);
        const noteInput = document.getElementById('completion-note-input');
        if (noteInput) noteInput.value = prefill.note || '';
      }

      saveBtn?.addEventListener('click', () => {
        if (!selectedStatus) return;
        const reason = selectedStatus === 'completed' ? null : UI.chipValue('completionReason', container);
        const note = document.getElementById('completion-note-input')?.value.trim() || null;
        Store.saveCompletionLog(entry.date, {
          plannedWorkout: title,
          status: selectedStatus,
          reason,
          note,
        });
        renderCompletionTracker();
      });
    }
  }

  function wireExerciseButtons() {
    main.querySelectorAll('.today-exercise-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.id;
        if (id) openExerciseDrawer(id);
      });
    });
  }

  async function openExerciseDrawer(id) {
    let exercise = null;
    try {
      const res = await fetch(`/api/exercises/${encodeURIComponent(id)}`);
      if (res.ok) {
        const json = await res.json();
        exercise = json.data;
      }
    } catch {
      // fall through to local copy
    }

    if (!exercise) {
      exercise = (recommendation.workout?.exercises || []).find((item) => item.id === id || item.exerciseId === id) || null;
    }

    if (!exercise) return;

    const isPreferred = Store.isPreferredExercise(exercise.id || exercise.exerciseId);
    const isAvoided = Store.isAvoidedExercise(exercise.id || exercise.exerciseId);
    const imageUrl = exercise.gifUrl ? `/api/exercises/media?url=${encodeURIComponent(exercise.gifUrl)}` : '';
    const instructions = (exercise.instructions || ['Perform with controlled form.']).map((step) => `<li style="margin-left:18px; margin-bottom:6px; font-size:14px;">${esc(step)}</li>`).join('');

    drawerRoot.innerHTML = `
      <div class="exercise-drawer-content">
        <div class="row between mb-2" style="align-items:flex-start;">
          <div>
            <span class="kicker" style="margin-bottom:2px;">${esc(exercise.bodyPart || 'general')} · ${esc(exercise.target || 'general')}</span>
            <h2 style="font-size:20px;">${esc(exercise.name)}</h2>
            <p class="faint mt-1">ID ${esc(exercise.exerciseId || exercise.id)}</p>
          </div>
          <button class="btn-ghost" id="close-today-drawer-btn" style="padding:6px 10px; font-size:16px; min-height:auto; width:auto;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        ${imageUrl ? `<img class="exercise-drawer-gif" src="${esc(imageUrl)}" alt="${esc(exercise.name)}" onerror="this.style.display='none'">` : ''}

        <div class="row mb-2" style="flex-wrap:wrap; gap:6px;">
          ${exercise.equipment ? `<span class="badge badge-neutral">${esc(exercise.equipment)}</span>` : ''}
          ${exercise.bodyPart ? `<span class="badge badge-neutral">${esc(exercise.bodyPart)}</span>` : ''}
          ${exercise.target ? `<span class="badge badge-neutral">${esc(exercise.target)}</span>` : ''}
        </div>

        <p class="kicker">Instructions</p>
        <ol class="mt-1 mb-3">${instructions}</ol>

        <div class="row" style="gap:10px; flex-wrap:wrap;">
          <button class="btn ${isPreferred ? 'btn-secondary' : 'btn-primary'}" id="today-save-preferred-btn" style="flex:1; min-width:180px;">
            <i class="fa-solid ${isPreferred ? 'fa-check' : 'fa-plus'}"></i>
            ${isPreferred ? 'Saved to preferred' : 'Save to preferred'}
          </button>
          <button class="btn btn-secondary" id="today-avoid-btn" style="flex:1; min-width:180px; color:${isAvoided ? 'var(--red)' : 'var(--text)'}; border-color:${isAvoided ? 'rgba(240,113,108,0.4)' : 'var(--border-strong)'};">
            <i class="fa-solid ${isAvoided ? 'fa-ban' : 'fa-thumbs-down'}"></i>
            ${isAvoided ? 'Marked to avoid' : 'Avoid this exercise'}
          </button>
        </div>
      </div>
    `;

    drawerRoot.classList.remove('hidden');
    document.getElementById('close-today-drawer-btn')?.addEventListener('click', () => drawerRoot.classList.add('hidden'));

    document.getElementById('today-save-preferred-btn')?.addEventListener('click', () => {
      if (!Store.isPreferredExercise(exercise.id || exercise.exerciseId)) {
        Store.savePreferredExercise(exercise);
        UI.showToast(`Saved ${exercise.name} to preferred exercises.`);
      } else {
        UI.showToast(`${exercise.name} is already saved.`);
      }
      drawerRoot.classList.add('hidden');
      location.reload();
    });

    document.getElementById('today-avoid-btn')?.addEventListener('click', () => {
      if (!Store.isAvoidedExercise(exercise.id || exercise.exerciseId)) {
        Store.saveAvoidedExercise(exercise);
        UI.showToast(`Striate will avoid ${exercise.name} in future plans.`);
      } else {
        UI.showToast(`${exercise.name} is already marked to avoid.`);
      }
      drawerRoot.classList.add('hidden');
      location.reload();
    });
  }

  function openFeedbackModal() {
    feedbackRoot.innerHTML = `
      <div class="exercise-drawer-content">
        <div class="row between mb-2" style="align-items:flex-start;">
          <div>
            <h2 style="font-size:19px;">Adjust today’s plan</h2>
            <p class="small muted mt-1">Tell Striate what felt unrealistic so it stops repeating it.</p>
          </div>
          <button class="btn-ghost" id="close-feedback-btn" style="padding:6px 10px; font-size:16px; min-height:auto; width:auto;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <span class="label">What was the main problem?</span>
        <div class="chip-group mb-2" data-name="dislikeReason">
          <button class="chip" data-value="Too demanding">Too demanding</button>
          <button class="chip" data-value="Not realistic for my schedule">Not realistic for my schedule</button>
          <button class="chip" data-value="Need more sleep focus">Need more sleep focus</button>
          <button class="chip" data-value="Prefer different training method">Prefer different training method</button>
        </div>

        <span class="label">What would fit better instead?</span>
        <div class="chip-group mb-2" data-name="methodPreference">
          <button class="chip" data-value="Walking">Walking</button>
          <button class="chip" data-value="Gym machines">Gym machines</button>
          <button class="chip" data-value="Dumbbell basics">Dumbbell basics</button>
          <button class="chip" data-value="Short circuits">Short circuits</button>
          <button class="chip" data-value="Mobility">Mobility</button>
        </div>

        <input type="text" id="feedback-note-input" placeholder="Optional detail or custom method (e.g. 20-min walk after class)">

        <button class="btn btn-primary mt-2" id="save-feedback-btn">
          <i class="fa-solid fa-check"></i> Save memory
        </button>
      </div>
    `;

    feedbackRoot.classList.remove('hidden');
    UI.initChipGroups(feedbackRoot);

    document.getElementById('close-feedback-btn')?.addEventListener('click', () => feedbackRoot.classList.add('hidden'));
    document.getElementById('save-feedback-btn')?.addEventListener('click', () => {
      const reason = UI.chipValue('dislikeReason', feedbackRoot) || 'Plan felt unrealistic';
      const method = UI.chipValue('methodPreference', feedbackRoot) || '';
      const note = document.getElementById('feedback-note-input')?.value.trim() || '';

      Store.addDislikedSuggestion(reason, { note, trainingMethod: method, date: entry.date });
      if (method) Store.addTrainingMethod(method, 'feedback');
      if (note) {
        Store.setScheduleNotes(note);
        Store.setCoachingConstraints(note);
      }

      UI.showToast('Feedback saved. Tomorrow’s plan will adapt.');
      feedbackRoot.classList.add('hidden');
      location.reload();
    });
  }

  function wireFollowUp() {
    const saveBtn = document.getElementById('save-followup-btn');
    if (!saveBtn) return;

    UI.initChipGroups(document.getElementById('followup-card'));
    saveBtn.addEventListener('click', () => {
      const answer = UI.chipValue('followup-answer', document.getElementById('followup-card')) || document.getElementById('followup-note')?.value.trim();
      if (!answer) return;

      Store.saveCompletionLog(entry.date, {
        plannedWorkout: recommendation.workout?.title || 'Workout',
        status: 'skipped',
        reason: answer,
        note: document.getElementById('followup-note')?.value.trim() || null,
      });

      const card = document.getElementById('followup-card');
      if (card) {
        card.innerHTML = `
          <p class="kicker" style="color:var(--accent);">Saved</p>
          <p class="small">Got it. That will be used when the next recommendation changes.</p>
        `;
      }
      renderCompletionTracker();
    });
  }
})();
