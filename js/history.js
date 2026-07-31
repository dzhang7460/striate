/* ============================================================
   Striate — history.js (Calendar & Logs)
   - Interactive calendar grid showing daily completion status.
   - Editable schedule history and workout completion logs.
============================================================ */

(function () {
  if (!UI.requireProfile()) return;
  UI.renderTabbar('calendar');
  if (typeof StriateDebug !== 'undefined') StriateDebug.init();

  const debugBtn = document.getElementById('debug-toggle-btn');
  if (debugBtn && typeof StriateDebug !== 'undefined') {
    debugBtn.addEventListener('click', () => StriateDebug.open());
  }

  const list = document.getElementById('history-list');
  const countEl = document.getElementById('history-count');
  const gridEl = document.getElementById('calendar-grid');
  const monthLabel = document.getElementById('calendar-month-label');
  const esc = UI.esc;

  const entries = Store.getEntries();
  const allCompletions = Store.getAllCompletions();
  const compMap = {};
  allCompletions.forEach((c) => { compMap[c.date] = c; });

  countEl.textContent = entries.length === 0 && allCompletions.length === 0
    ? ''
    : `${entries.length} check-in${entries.length === 1 ? '' : 's'} · ${allCompletions.length} completion log${allCompletions.length === 1 ? '' : 's'}`;

  // Render Calendar Grid for current month
  function renderCalendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    monthLabel.textContent = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Monday = 0, Sunday = 6
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const headers = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    let html = headers.map((h) => `<div class="calendar-day-header">${h}</div>`).join('');

    for (let i = 0; i < startDayOfWeek; i++) {
      html += `<div class="calendar-day" style="opacity:0.25;"></div>`;
    }

    const todayStr = Store.todayKey();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateKey === todayStr;
      const comp = compMap[dateKey];
      const entry = entries.find((e) => e.date === dateKey);

      let dotClass = '';
      if (comp) {
        if (comp.status === 'completed') dotClass = 'completed';
        else if (comp.status === 'partial') dotClass = 'partial';
        else if (comp.status === 'skipped') dotClass = 'skipped';
      } else if (entry) {
        dotClass = 'checked';
      }

      html += `
        <div class="calendar-day ${isToday ? 'today' : ''}" data-date="${dateKey}" title="${dateKey}: ${comp ? comp.status : entry ? 'Checked in' : 'No data'}">
          <span class="calendar-day-num">${d}</span>
          ${dotClass ? `<span class="calendar-status-dot ${dotClass}"></span>` : '<span style="height:8px;"></span>'}
        </div>
      `;
    }

    gridEl.innerHTML = html;

    gridEl.querySelectorAll('.calendar-day[data-date]').forEach((cell) => {
      cell.addEventListener('click', () => {
        const d = cell.dataset.date;
        const targetEl = document.getElementById(`log-entry-${d}`);
        if (targetEl) {
          targetEl.open = true;
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetEl.style.outline = '2px solid var(--accent)';
          setTimeout(() => { targetEl.style.outline = 'none'; }, 2000);
        } else {
          alert(`No log recorded for ${d}. Check-ins start from Today.`);
        }
      });
    });
  }

  // Render Log List
  function renderList() {
    if (entries.length === 0 && allCompletions.length === 0) {
      list.innerHTML = `
        <section class="card text-center" style="padding: 40px 24px;">
          <i class="fa-solid fa-calendar-days" style="font-size: 30px; color: var(--text-faint);" aria-hidden="true"></i>
          <h2 class="mt-2">Nothing logged yet</h2>
          <p class="muted small mt-1">Your daily check-ins and workout completion logs will show up here.</p>
          <a class="btn btn-primary mt-3" href="check-in.html">Do today's check-in</a>
        </section>`;
      return;
    }

    // Create a unified list of dates that have an entry or completion log
    const dateSet = new Set([...entries.map((e) => e.date), ...Object.keys(compMap)]);
    const sortedDates = [...dateSet].sort((a, b) => b.localeCompare(a));

    list.innerHTML = sortedDates.map((date, i) => {
      const e = entries.find((item) => item.date === date);
      const c = compMap[date];
      const checkin = e ? e.checkin : null;
      const rec = e ? e.recommendation : null;

      let statusBadge = '<span class="badge badge-neutral">Checked in</span>';
      if (c) {
        if (c.status === 'completed') statusBadge = '<span class="badge badge-high">Completed ✅</span>';
        else if (c.status === 'partial') statusBadge = '<span class="badge badge-medium">Partial ⚠️</span>';
        else if (c.status === 'skipped') statusBadge = '<span class="badge badge-low">Skipped ❌</span>';
      }

      const title = rec ? (rec.workout ? rec.workout.title : (rec.mainAction || 'Workout')) : (c ? c.plannedWorkout : 'Workout');
      const reason = c ? c.reason : null;
      const note = (c && c.note) ? c.note : (checkin && checkin.extraNote ? checkin.extraNote : null);

      return `
      <details class="history-item" id="log-entry-${date}" ${i === 0 ? 'open' : ''}>
        <summary>
          <div class="row between">
            <strong>${UI.formatDate(date)}</strong>
            <div class="row" style="gap:6px;">
              ${statusBadge}
              ${rec ? UI.confidenceBadge(rec.confidence) : ''}
            </div>
          </div>
          ${checkin ? `
          <p class="faint mt-1" style="font-size:13px;">
            Sleep ${esc(checkin.sleep)}h · Energy ${esc(checkin.energy)}/5 · Soreness ${esc(checkin.soreness)}/5 · Mood ${esc(checkin.mood)}/5
          </p>` : ''}
          <p class="small mt-1" style="font-weight:600;">${esc(title)}</p>
        </summary>
        <div class="hi-body stack-sm">
          ${rec ? `<p class="small muted">${esc(rec.summary || rec.explanation || '')}</p>` : ''}
          ${reason ? `<div><p class="kicker" style="margin-bottom:2px; color:var(--amber);">Reason</p><p class="small muted">${esc(reason)}</p></div>` : ''}
          ${note ? `<div><p class="kicker" style="margin-bottom:2px;">User note</p><p class="small muted">"${esc(note)}"</p></div>` : ''}
          
          <!-- Editable Log Bar -->
          <div class="card mt-2" style="background:var(--surface-2); padding:12px;">
            <div class="row between">
              <span class="small" style="font-weight:600;">Completion Status</span>
              <button class="btn-ghost edit-log-btn" data-date="${date}" style="padding:4px 8px; font-size:12px;">Edit Log <i class="fa-solid fa-pen"></i></button>
            </div>
            <div class="edit-log-form hidden mt-2" id="edit-form-${date}">
              <div class="completion-buttons">
                <button class="btn-status ${c?.status === 'completed' ? 'active' : ''}" data-status="completed" data-date="${date}">✅ Done</button>
                <button class="btn-status ${c?.status === 'partial' ? 'active' : ''}" data-status="partial" data-date="${date}">⚠️ Partial</button>
                <button class="btn-status ${c?.status === 'skipped' ? 'active' : ''}" data-status="skipped" data-date="${date}">❌ Skipped</button>
              </div>
              <input type="text" id="reason-input-${date}" class="mt-1" placeholder="Reason (if skipped/partial)" value="${esc(reason || '')}">
              <input type="text" id="note-input-${date}" class="mt-1" placeholder="Optional note..." value="${esc(note || '')}">
              <div class="row between mt-2">
                <button class="btn btn-secondary cancel-edit-btn" data-date="${date}" style="min-height:38px; font-size:13px; width:auto;">Cancel</button>
                <button class="btn btn-primary save-edit-btn" data-date="${date}" style="min-height:38px; font-size:13px; width:auto;">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      </details>`;
    }).join('');

    // Attach edit events
    list.querySelectorAll('.edit-log-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.date;
        const formEl = document.getElementById(`edit-form-${d}`);
        formEl?.classList.toggle('hidden');
      });
    });

    list.querySelectorAll('.cancel-edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.date;
        const formEl = document.getElementById(`edit-form-${d}`);
        formEl?.classList.add('hidden');
      });
    });

    list.querySelectorAll('.save-edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.date;
        const formEl = document.getElementById(`edit-form-${d}`);
        let selectedStatus = 'completed';
        formEl.querySelectorAll('.btn-status').forEach((b) => {
          if (b.classList.contains('active')) selectedStatus = b.dataset.status;
        });
        const rInput = document.getElementById(`reason-input-${d}`);
        const nInput = document.getElementById(`note-input-${d}`);
        Store.saveCompletionLog(d, {
          status: selectedStatus,
          reason: rInput?.value.trim() || null,
          note: nInput?.value.trim() || null,
        });
        compMap[d] = Store.getCompletionLog(d);
        renderCalendar();
        renderList();
      });
    });

    list.querySelectorAll('.btn-status[data-date]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.date;
        const formEl = document.getElementById(`edit-form-${d}`);
        formEl.querySelectorAll('.btn-status').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  renderCalendar();
  renderList();
})();
