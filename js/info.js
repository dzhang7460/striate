/* ============================================================
   Striate — info.js
   Info & Legend tab controller.
   Explains readiness, confidence, AI adaptation, safety rules,
   and hooks up shortcut buttons to Profile & Debug Console.
============================================================ */

(function () {
  if (!UI.requireProfile()) return;
  UI.renderTabbar('info');
  if (typeof StriateDebug !== 'undefined') StriateDebug.init();

  const debugBtn = document.getElementById('debug-toggle-btn');
  const openDebugBtn = document.getElementById('open-debug-btn');

  if (debugBtn && typeof StriateDebug !== 'undefined') {
    debugBtn.addEventListener('click', () => StriateDebug.open());
  }
  if (openDebugBtn && typeof StriateDebug !== 'undefined') {
    openDebugBtn.addEventListener('click', () => StriateDebug.open());
  }
})();
