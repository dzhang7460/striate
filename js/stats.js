/* ============================================================
   Striate — stats.js
   Mobile-readable stats page showing:
   - check-in streak & recent activity
   - workouts completed this week (visual pill track)
   - average readiness, sleep, soreness, energy
   - current goal & simple trend indicators
   - coach insight based on recent data
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
  const esc = UI.esc;

  const goalLabels = {
    strength: 'Get stronger',
    muscle: 'Build muscle',
    fat_loss: 'Lose fat',
    fitness: 'General fitness',
    energy: 'More daily energy',
  };

  const experienceLabels = {
    new: 'Completely new',
    some: 'Tried a bit before',
    returning: 'Returning after a break',
  };

  // Calculate Check-in Streak
  function computeStreak(entriesList) {
    if (entriesList.length === 0) return 0;
    let streak = 0;
    const todayStr = Store.todayKey();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yestStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

    const hasToday = entriesList.some((e) => e.date === todayStr);
    const hasYesterday = entriesList.some((e) => e.date === yestStr);

    if (!hasToday && !hasYesterday) return 0;

    let checkDate = new Date(hasToday ? todayStr : yestStr);
    while (true) {
      const dStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (entriesList.some((e) => e.date === dStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  // Calculate This Week's Completions (Monday to Sunday)
  function getThisWeekCompletions() {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // 1 = Monday, 7 = Sunday
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1);

    const weekDays = [];
    const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    let completedCount = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const comp = completions.find((c) => c.date === dStr);
      const entry = entries.find((e) => e.date === dStr);

      let status = 'future';
      let symbol = '-';
      if (d > now && dStr !== Store.todayKey()) {
        status = 'future';
        symbol = '';
      } else if (comp) {
        if (comp.status === 'completed') {
          status = 'completed';
          symbol = '✅';
          completedCount++;
        } else if (comp.status === 'partial') {
          status = 'partial';
          symbol = '⚠️';
        } else if (comp.status === 'skipped') {
          status = 'skipped';
          symbol = '❌';
        }
      } else if (entry) {
        status = 'rest';
        symbol = '🔵';
      }

      weekDays.push({ label: dayNames[i], date: dStr, status, symbol });
    }
    return { completedCount, weekDays };
  }

  // Calculate 7-Day Averages
  function computeAverages() {
    const last7 = entries.slice(0, 7);
    if (last7.length === 0) {
      return { readiness: 0, sleep: 0, soreness: 0, energy: 0, count: 0 };
    }

    const sleepMap = { '<5': 4, '5-6': 5.5, '6-7': 6.5, '7-8': 7.5, '8+': 8.5 };
    let sumR = 0, sumSleep = 0, sumSore = 0, sumEnergy = 0;

    last7.forEach((e) => {
      const r = typeof e.recommendation?.readinessScore === 'number'
        ? e.recommendation.readinessScore
        : 6.5;
      sumR += r;
      sumSleep += sleepMap[e.checkin.sleep] || 7;
      sumSore += Number(e.checkin.soreness) || 1;
      sumEnergy += Number(e.checkin.energy) || 3;
    });

    const count = last7.length;
    return {
      readiness: Math.round((sumR / count) * 10) / 10,
      sleep: Math.round((sumSleep / count) * 10) / 10,
      soreness: Math.round((sumSore / count) * 10) / 10,
      energy: Math.round((sumEnergy / count) * 10) / 10,
      count,
    };
  }

  const streak = computeStreak(entries);
  const { completedCount, weekDays } = getThisWeekCompletions();
  const avg = computeAverages();

  // Generate simple trend indicators
  const readinessTrend = avg.readiness >= 7.5 ? '↑ Solid recovery base' : avg.readiness >= 5 ? '→ Stable baseline' : '↓ Recovery need high';
  const sleepTrend = avg.sleep >= 7 ? '↑ Above 7h average' : '↓ Below 7h goal';
  const soreTrend = avg.soreness <= 2 ? '↓ Low soreness' : '↑ High adaptation soreness';

  // Coach Insight
  let insightText = '';
  if (avg.count === 0) {
    insightText = 'Do your first daily check-in to see average readiness and sleep trends here.';
  } else if (avg.sleep < 6.5) {
    insightText = `Your average sleep is ${avg.sleep}h over the last ${avg.count} check-ins. Boosting sleep closer to 7+ hours is the highest-leverage way to accelerate recovery and reduce muscle soreness.`;
  } else if (completedCount >= 3) {
    insightText = `You've completed ${completedCount} sessions this week. Excellent consistency! For beginners, 3 consistent days per week builds sustainable strength without systemic fatigue.`;
  } else {
    insightText = `Your average readiness is ${avg.readiness}/10 with soreness at ${avg.soreness}/5. Your body is adapting steadily — keep showing up for your scheduled time window.`;
  }

  container.innerHTML = `
    <!-- Top Profile & Goal Banner -->
    <section class="card row between mb-3">
      <div>
        <p class="kicker" style="margin-bottom:2px;">Current Goal</p>
        <strong style="font-size:16px; color:var(--accent);">${esc(goalLabels[profile.goal] || profile.goal)}</strong>
        <div class="faint mt-1">${esc(experienceLabels[profile.experienceLevel] || 'Beginner')} · ${esc(profile.availableDays)} days/wk target</div>
      </div>
      <a href="onboarding.html?edit=1" class="btn btn-secondary" style="width:auto; padding:8px 12px; font-size:13px; min-height:40px;">
        <i class="fa-solid fa-pen"></i> Edit
      </a>
    </section>

    <!-- This Week Activity Card -->
    <section class="card mb-3" id="week-activity-card">
      <div class="row between mb-1">
        <div>
          <p class="kicker" style="margin-bottom:0;">This Week's Activity</p>
          <strong style="font-size:20px;">${completedCount} workout${completedCount === 1 ? '' : 's'} completed</strong>
        </div>
        <div class="text-center">
          <span class="badge badge-high"><i class="fa-solid fa-fire"></i> ${streak}-day streak</span>
        </div>
      </div>
      <div class="week-pills mt-2">
        ${weekDays.map((d) => `
          <div class="week-pill">
            <span>${d.label}</span>
            <div class="week-pill-bar ${d.status}" title="${d.date}: ${d.status}">${d.symbol}</div>
          </div>
        `).join('')}
      </div>
    </section>

    <!-- 7-Day Averages Grid -->
    <section class="card mb-3" id="averages-card">
      <div class="row between mb-1">
        <p class="kicker" style="margin-bottom:0;">Last 7 Days Averages</p>
        <span class="faint" style="font-size:11px;">Based on ${avg.count} check-in${avg.count === 1 ? '' : 's'}</span>
      </div>
      <div class="stats-grid">
        <div class="stat-box">
          <p class="kicker" style="margin-bottom:4px;">Avg Readiness</p>
          <div class="stat-val">${avg.readiness} <span class="stat-unit">/ 10</span></div>
          <div class="stat-trend" style="color:${avg.readiness >= 7 ? 'var(--accent)' : 'var(--amber)'};">${readinessTrend}</div>
        </div>
        <div class="stat-box">
          <p class="kicker" style="margin-bottom:4px;">Avg Sleep</p>
          <div class="stat-val">${avg.sleep} <span class="stat-unit">hrs</span></div>
          <div class="stat-trend" style="color:${avg.sleep >= 7 ? 'var(--accent)' : 'var(--amber)'};">${sleepTrend}</div>
        </div>
        <div class="stat-box">
          <p class="kicker" style="margin-bottom:4px;">Avg Soreness</p>
          <div class="stat-val">${avg.soreness} <span class="stat-unit">/ 5</span></div>
          <div class="stat-trend" style="color:${avg.soreness <= 2 ? 'var(--accent)' : 'var(--amber)'};">${soreTrend}</div>
        </div>
        <div class="stat-box">
          <p class="kicker" style="margin-bottom:4px;">Avg Energy</p>
          <div class="stat-val">${avg.energy} <span class="stat-unit">/ 5</span></div>
          <div class="stat-trend" style="color:var(--blue);">→ Consistent energy</div>
        </div>
      </div>
    </section>

    <!-- Coach Insight Card -->
    <section class="card card-accent" id="stats-insight-card">
      <div class="row between mb-1">
        <p class="kicker accent" style="margin-bottom:0;"><i class="fa-solid fa-lightbulb"></i> Coach Insight</p>
      </div>
      <p class="small mt-1">${esc(insightText)}</p>
    </section>
  `;
})();
