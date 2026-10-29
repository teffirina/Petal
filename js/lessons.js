'use strict';
/* One-tap lessons for the public build: reads college-lessons.ics placed next to index.html by the owner. */
(function () {
  P.lessonsAvailable = true;
  P.hasLessons = () => P.state.calendars.some((c) => c.name === 'College lessons');
  P.act.loadLessons = async () => {
    let text;
    try {
      const res = await fetch('college-lessons.ics', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      text = await res.text();
    } catch (e) {
      P.toast('No lessons file found on this site yet. Upload college-lessons.ics to the repo first.');
      return;
    }
    const cal = P.state.calendars.find((c) => c.name === 'College lessons');
    const file = new File([text], 'college-lessons.ics', { type: 'text/calendar' });
    P.chg.icsFile({ files: [file], dataset: { cal: cal ? cal.id : '' }, value: '' });
  };
})();
