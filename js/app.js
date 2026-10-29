'use strict';
/* Boot. */
(function () {
  try {
    P.load();
  } catch (e) {
    document.getElementById('app').innerHTML = '<p style="padding:24px">Petal couldn’t start in this browser. Try reloading.</p>';
    throw e;
  }
  P.render({ routeChange: true });
  if (P.state.timer) P.recoverTimer();
  setTimeout(P.checkReminders, 1500);
  /* Keep the now line, free time and suggestions current without disturbing typing. */
  let lastDay = P.today();
  setInterval(() => {
    const a = document.activeElement;
    const typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    const day = P.today();
    if (day !== lastDay) { lastDay = day; if (P.ui.date && P.ui.date < day) P.ui.date = null; }
    if (!typing && !document.hidden && P.state.prefs.onboarded) P.render();
  }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && P.state.prefs.onboarded) P.render(); });
})();
