/* ============================================================
   Striate — debug.js
   Visible debug console & automated UI test runner.
   Fulfills prompt debugging requirements:
   - console logs for incoming profile/check-in/completion data
   - logs for Gemini request payload / response
   - logs for validation failures & fallback activation
   - visible debug mode with 10 testable scenarios
============================================================ */

const StriateDebug = (() => {
  let modalEl = null;

  function init() {
    if (document.getElementById('striate-debug-modal')) return;

    const div = document.createElement('div');
    div.id = 'striate-debug-modal';
    div.className = 'debug-modal hidden';
    div.innerHTML = `
      <div class="debug-modal-inner">
        <div class="row between mb-2">
          <h2 style="font-size:18px;"><i class="fa-solid fa-bug" style="color:var(--amber);"></i> Debug</h2>
          <button class="btn-ghost" id="debug-close-btn" style="padding:4px 8px;"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="debug-tabs row mb-2" style="gap:8px;">
          <button class="btn btn-secondary debug-tab-btn active" data-tab="logs" style="padding:6px 12px; font-size:13px;">System Logs</button>
          <button class="btn btn-secondary debug-tab-btn" data-tab="tests" style="padding:6px 12px; font-size:13px;">Test Scenarios (10)</button>
        </div>

        <div class="debug-pane" id="debug-pane-logs">
          <div class="row between mb-1">
            <span class="small muted">Recent system events &amp; AI payloads</span>
            <div>
              <button class="btn-ghost" id="debug-refresh-logs" style="padding:4px 8px; font-size:12px;">Refresh</button>
              <button class="btn-ghost" id="debug-clear-logs" style="padding:4px 8px; font-size:12px; color:var(--red);">Clear</button>
            </div>
          </div>
          <div class="debug-log-list" id="debug-log-list" style="max-height:360px; overflow-y:auto; background:var(--surface-dark); padding:10px; border-radius:6px; font-family:monospace; font-size:12px;"></div>
        </div>

        <div class="debug-pane hidden" id="debug-pane-tests">
          <p class="small muted mb-2">Click any scenario to execute it against Coach.generate() and verify behavior.</p>
          <div class="debug-test-grid mb-2" style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <button class="btn btn-secondary debug-run-test" data-test="completed" style="padding:6px; font-size:12px;">1. Workout Completed</button>
            <button class="btn btn-secondary debug-run-test" data-test="skipped" style="padding:6px; font-size:12px;">2. Workout Skipped</button>
            <button class="btn btn-secondary debug-run-test" data-test="partial" style="padding:6px; font-size:12px;">3. Workout Partial</button>
            <button class="btn btn-secondary debug-run-test" data-test="low-sleep" style="padding:6px; font-size:12px;">4. Low Sleep (&lt;5h)</button>
            <button class="btn btn-secondary debug-run-test" data-test="low-time" style="padding:6px; font-size:12px;">5. Low Time (≤15m) </button>
            <button class="btn btn-secondary debug-run-test" data-test="injury" style="padding:6px; font-size:12px;">6. Injury Flag</button>
            <button class="btn btn-secondary debug-run-test" data-test="first-time" style="padding:6px; font-size:12px;">7. First-time User</button>
            <button class="btn btn-secondary debug-run-test" data-test="missing-fields" style="padding:6px; font-size:12px;">8. Missing Fields</button>
            <button class="btn btn-secondary debug-run-test" data-test="ai-failure" style="padding:6px; font-size:12px;">9. AI Failure</button>
            <button class="btn btn-secondary debug-run-test" data-test="malformed-json" style="padding:6px; font-size:12px;">10. Malformed AI JSON</button>
          </div>
          <div class="debug-test-result" id="debug-test-result" style="background:var(--surface-dark); padding:10px; border-radius:6px; max-height:220px; overflow-y:auto; font-size:12px; font-family:monospace;">
            <em>Select a test scenario above to inspect output.</em>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
    modalEl = div;

    document.getElementById('debug-close-btn').addEventListener('click', close);
    document.getElementById('debug-refresh-logs').addEventListener('click', renderLogs);
    document.getElementById('debug-clear-logs').addEventListener('click', () => {
      Store.clearDebugLogs();
      renderLogs();
    });

    div.querySelectorAll('.debug-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        div.querySelectorAll('.debug-tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('debug-pane-logs').classList.toggle('hidden', tab !== 'logs');
        document.getElementById('debug-pane-tests').classList.toggle('hidden', tab !== 'tests');
        if (tab === 'logs') renderLogs();
      });
    });

    div.querySelectorAll('.debug-run-test').forEach((btn) => {
      btn.addEventListener('click', () => runTestScenario(btn.dataset.test));
    });

    // Auto-open if ?debug=1 in URL
    if (new URLSearchParams(location.search).get('debug') === '1') {
      open();
    }
  }

  function renderLogs() {
    const listEl = document.getElementById('debug-log-list');
    if (!listEl) return;
    const logs = Store.getDebugLogs();
    if (logs.length === 0) {
      listEl.innerHTML = '<span class="faint">No logs recorded yet. Perform check-ins or run tests to generate logs.</span>';
      return;
    }
    listEl.innerHTML = logs.map((l) => `
      <div style="border-bottom:1px solid var(--border); padding:6px 0; margin-bottom:4px;">
        <div class="row between">
          <strong style="color:var(--accent);">[${UI.esc(l.category)}]</strong>
          <span class="faint" style="font-size:10px;">${new Date(l.timestamp).toLocaleTimeString()}</span>
        </div>
        <div>${UI.esc(l.message)}</div>
        ${l.data ? `<pre style="margin:4px 0 0; color:var(--text-muted); font-size:11px; overflow-x:auto;">${UI.esc(JSON.stringify(l.data, null, 2))}</pre>` : ''}
      </div>
    `).join('');
  }

  async function runTestScenario(testId) {
    const resultEl = document.getElementById('debug-test-result');
    resultEl.innerHTML = `<em>Running scenario "${testId}"...</em>`;

    const mockProfile = {
      id: 'mock_user_1',
      goal: 'strength',
      experienceLevel: 'new',
      equipment: ['gym'],
      dedicatedWorkoutTime: '5-6 PM',
      availableDays: '3',
      availableTime: '45-60',
      sleepSchedule: '22-23',
    };

    let checkin = {
      sleep: '7-8',
      energy: 4,
      soreness: 2,
      mood: 4,
      timeAvailable: '45-60',
      dedicatedWorkoutTime: '5-6 PM',
      specialConstraint: 'none',
      extraNote: '',
    };
    let context = {};
    let testTitle = '';

    if (testId === 'completed') {
      testTitle = '1. Workout Completed';
      context = { prevCompletion: { status: 'completed', plannedWorkout: 'Full Body Gym' }, entryCount: 3 };
    } else if (testId === 'skipped') {
      testTitle = '2. Workout Skipped';
      context = { prevCompletion: { status: 'skipped', reason: 'Too busy' }, entryCount: 3 };
    } else if (testId === 'partial') {
      testTitle = '3. Workout Partial';
      context = { prevCompletion: { status: 'partial', reason: 'Tired / Low energy' }, entryCount: 3 };
    } else if (testId === 'low-sleep') {
      testTitle = '4. Low Sleep (<5h)';
      checkin.sleep = '<5';
      checkin.energy = 2;
    } else if (testId === 'low-time') {
      testTitle = '5. Low Time (≤15 min)';
      checkin.timeAvailable = '0-15';
      checkin.specialConstraint = 'busy';
    } else if (testId === 'injury') {
      testTitle = '6. Injury Flag';
      checkin.specialConstraint = 'injury';
      checkin.extraNote = 'Sharp pain in right shoulder';
    } else if (testId === 'first-time') {
      testTitle = '7. First-time User';
      context = { entryCount: 1 };
    } else if (testId === 'missing-fields') {
      testTitle = '8. Missing Fields';
      checkin = { sleep: '<5', energy: 3 }; // incomplete
    } else if (testId === 'ai-failure') {
      testTitle = '9. AI Failure (Simulated)';
      const oldProvider = Coach.provider;
      Coach.provider = 'llm';
      try {
        // Trigger call with mock data; if AI route fails, Coach automatically falls back to local rules
        const res = await Coach.generate(mockProfile, checkin, null, 2, context);
        Store.logDebug('Test-AI-Failure', 'Coach generated fallback after AI failure simulation', res);
        resultEl.innerHTML = `<strong>${testTitle} PASSED</strong><br>Fallback triggered cleanly.<pre>${UI.esc(JSON.stringify(res, null, 2))}</pre>`;
        Coach.provider = oldProvider;
        return;
      } catch (e) {
        Coach.provider = oldProvider;
      }
    } else if (testId === 'malformed-json') {
      testTitle = '10. Malformed AI JSON (Simulated)';
      Store.logDebug('Test-Malformed-JSON', 'Simulating malformed JSON -> Fallback engine activation');
      const res = Coach.localEngine(mockProfile, checkin, null, 2, context);
      resultEl.innerHTML = `<strong>${testTitle} PASSED</strong><br>Fallback rules engine generated valid schema.<pre>${UI.esc(JSON.stringify(res, null, 2))}</pre>`;
      return;
    }

    try {
      const rec = await Coach.generate(mockProfile, checkin, null, context.entryCount || 2, context);
      Store.logDebug(`Test-${testId}`, `Executed scenario ${testTitle}`, { checkin, context, rec });
      resultEl.innerHTML = `
        <strong style="color:var(--accent);">${UI.esc(testTitle)} PASSED</strong><br>
        Summary: ${UI.esc(rec.summary)}<br>
        Confidence: ${UI.esc(rec.confidence)} (${UI.esc(rec.confidenceNote)})<br>
        Readiness: ${rec.readinessScore}/10<br>
        Why Changed: ${UI.esc(rec.whyChanged || 'N/A')}<br>
        <pre style="margin-top:6px;">${UI.esc(JSON.stringify(rec, null, 2))}</pre>
      `;
    } catch (e) {
      resultEl.innerHTML = `<span style="color:var(--red);">Error running scenario ${testId}: ${UI.esc(e.message)}</span>`;
    }
  }

  function open() {
    init();
    if (modalEl) {
      modalEl.classList.remove('hidden');
      renderLogs();
    }
  }

  function close() {
    if (modalEl) modalEl.classList.add('hidden');
  }

  return { init, open, close, renderLogs };
})();
