'use strict';
/* Today: the main working screen. List and timeline render the same day data. */
(function () {
  const HOUR = 64;
  const K = HOUR / 60;

  /* ---------- suggested next task ---------- */
  P.suggestCandidates = () => {
    const today = P.today(), now = Date.now(), nowMin = P.nowMin();
    const timed = P.timedOn(today);
    const win = P.windowFor(today);
    const nextItem = timed.find((i) => i.start > now && (i.kind !== 'session'));
    const nextAt = nextItem ? nextItem.s : win && win[1] > nowMin ? win[1] : null;
    const gap = nextAt != null ? nextAt - nowMin : null;
    const out = [];
    const add = (task, occDate) => {
      const reasons = []; let score = 0;
      const ss = P.state.sessions.filter((s) => s.taskId === task.id);
      const cur = ss.find((s) => s.start <= now && s.end > now);
      const soon = ss.find((s) => s.start > now && s.start - now <= 30 * P.MIN);
      const later = ss.find((s) => s.start > now && P.local(s.start).date === today);
      if (cur) { score += 100; reasons.push(`Its work session is on now, until ${P.fmtTime(cur.end)}.`); }
      else if (soon) { score += 60; reasons.push(`A session for it starts at ${P.fmtTime(soon.start)}.`); }
      else if (later) { score += 5; reasons.push(`It has a session later today at ${P.fmtTime(later.start)}.`); }
      const passed = !cur && ss.find((s) => s.end <= now && P.local(s.start).date === today);
      if (passed) { score += 15; reasons.push(`Its session at ${P.fmtTime(passed.start)} today has passed and it’s still open.`); }
      if (task.deadline) {
        const k = P.diffDays(today, task.deadline.date);
        if (k <= 0) { score += 50; reasons.push(k < 0 ? `Its deadline was ${P.relDate(task.deadline.date).toLowerCase()}.` : `It’s due today${task.deadline.time != null ? ' at ' + P.fmtMin(task.deadline.time) : ''}.`); }
        else if (k === 1) { score += 40; reasons.push('It’s due tomorrow.'); }
        else if (k <= 3) { score += 25; reasons.push(`It’s due ${P.relDate(task.deadline.date)}.`); }
        else if (k <= 7) { score += 10; reasons.push(`It’s due within a week (${P.relDate(task.deadline.date)}).`); }
      }
      const pr = { high: 20, medium: 10, low: 3, none: 0 }[task.priority];
      if (pr) { score += pr; reasons.push(`It’s ${task.priority} priority.`); }
      if (occDate) { score += 12; reasons.push('It’s a repeating task due today.'); }
      else if (task.plannedDate === today) { score += 15; reasons.push('You planned it for today.'); }
      else if (task.plannedDate && task.plannedDate < today) { score += 8; reasons.push(`You planned it for ${P.relDate(task.plannedDate).toLowerCase()}.`); }
      const est = occDate && task.recurrence.duration ? task.recurrence.duration : task.estimate;
      if (gap != null && gap > 0) {
        const at = P.fmtMin(nextAt);
        if (est && est <= gap) { score += 8; reasons.push(`Your ${P.fmtDur(est)} estimate fits in the ${P.fmtDur(gap)} before ${at}.`); }
        else if (est) { score -= 5; reasons.push(`It’s estimated at ${P.fmtDur(est)}, more than the ${P.fmtDur(gap)} before ${at}. A 5-minute start still fits.`); }
        else reasons.push(`No estimate yet, so this only suggests a 5-minute start. You have ${P.fmtDur(gap)} before ${at}.`);
      } else if (!est) reasons.push('No estimate yet, so this only suggests a 5-minute start.');
      out.push({ task, occDate, score, reasons, est });
    };
    for (const t of P.state.tasks) {
      if (!P.isOpen(t) || t.list === 'someday') continue;
      if (P.isSeries(t)) { if (P.occursOn(t, today) && !P.occDone(t, today)) add(t, today); continue; }
      const hasToday = P.state.sessions.some((s) => s.taskId === t.id && s.end > now && P.local(s.start).date === today);
      const dlSoon = t.deadline && P.diffDays(today, t.deadline.date) <= 7;
      if ((t.plannedDate && t.plannedDate <= today) || hasToday || dlSoon) add(t, null);
    }
    return out.sort((a, b) => b.score - a.score || a.task.createdAt - b.task.createdAt);
  };
  P.suggestion = () => {
    const c = P.suggestCandidates();
    if (P.ui.suggestPick) {
      const t = P.task(P.ui.suggestPick);
      if (P.isOpen(t)) {
        const found = c.find((x) => x.task.id === t.id) || { task: t, occDate: P.isSeries(t) ? P.today() : null, reasons: [], est: t.estimate };
        return Object.assign({}, found, { reasons: ['You chose this one.', ...found.reasons], picked: true });
      }
      P.ui.suggestPick = null;
    }
    return c.find((x) => !P.ui.suggestSkip.includes(x.task.id)) || null;
  };
  function nextCard() {
    const s = P.suggestion();
    if (!s) return '';
    const t = s.task;
    const step = P.h.nextStepOf(t);
    return `<section class="pt-next" aria-labelledby="next-h">
      <div class="pt-row next-top"><p class="pt-eyebrow">${P.mark(16)}Suggested next</p>${t.deadline ? `<span class="pt-chip pt-chip--deadline">${P.ico('flag', 'pt-ico--sm')}Due ${P.esc(P.relDate(t.deadline.date).replace(/^(Today|Tomorrow|Yesterday)$/, (m) => m.toLowerCase()))}</span>` : ''}</div>
      <div><h3 id="next-h"><button class="linkbtn on-hero" data-act="openTask" data-id="${t.id}" ${s.occDate ? `data-date="${s.occDate}"` : ''}>${P.esc(s.occDate ? P.occTitle(t, s.occDate) : t.title)}</button></h3>
      <p class="pt-muted body-sm">${[t.projectId ? P.esc(P.projectName(t.projectId)) : '', s.est ? `Estimated ${P.fmtDur(s.est)}` : 'No estimate'].filter(Boolean).join(' · ')}</p></div>
      <p class="pt-step">${P.ico('right')}<span>${step ? P.esc(step) : 'No next step yet. Break it down to find one small action.'}</span></p>
      <div class="pt-row next-actions">
        <button class="pt-btn pt-btn--primary" data-act="start5" data-id="${t.id}" ${s.occDate ? `data-date="${s.occDate}"` : ''}>${P.ico('play')}Start 5 min</button>
        <button class="pt-btn pt-btn--secondary" data-act="breakdown" data-id="${t.id}">${P.ico('steps')}Break down</button>
      </div>
      <div class="next-foot"><details class="why"><summary>Why this task?</summary><ul>${s.reasons.map((r) => `<li>${P.esc(r)}</li>`).join('')}</ul><p>Suggestions never change your plan. Pick any task you like.</p></details>
        <button class="pt-btn pt-btn--quiet next-pick" data-act="chooseAnother">Pick another</button></div>
    </section>`;
  }
  P.act.chooseAnother = () => P.open('choose', {});
  P.ov.choose = {
    type: 'dialog', title: () => 'Choose a task to start',
    render() {
      const c = P.suggestCandidates();
      const ids = new Set(c.map((x) => x.task.id));
      const rest = P.state.tasks.filter((t) => P.isOpen(t) && t.list !== 'someday' && !P.isSeries(t) && !ids.has(t.id));
      const row = (t, why) => `<li class="pickrow"><span><b>${P.esc(t.title)}</b>${why ? `<span class="pt-muted body-sm">${P.esc(why)}</span>` : ''}</span><button class="pt-btn pt-btn--secondary sm" data-act="pickSuggest" data-id="${t.id}">Choose</button></li>`;
      return `<div class="stack"><p class="pt-muted body-sm">This only changes the suggestion card. Your plan stays the same.</p>
        ${c.length ? `<h3 class="pt-eyebrow">For today</h3><ul class="plain">${c.map((x) => row(x.task, x.reasons[0])).join('')}</ul>` : ''}
        ${rest.length ? `<h3 class="pt-eyebrow">Other open tasks</h3><ul class="plain">${rest.slice(0, 40).map((t) => row(t, '')).join('')}</ul>` : ''}
        ${!c.length && !rest.length ? '<p>No open tasks yet.</p>' : ''}</div>`;
    },
  };
  P.act.pickSuggest = (el) => { P.ui.suggestPick = el.dataset.id; P.close(); P.render(); };

  /* ---------- timeline (shared with Planner day view) ---------- */
  function layoutCols(items) {
    const cols = []; let cluster = []; let clusterEnd = -1;
    const flush = () => { const n = Math.max(1, ...cluster.map((c) => c._col + 1)); cluster.forEach((c) => { c._n = n; }); cluster = []; };
    for (const it of items) {
      if (it.s >= clusterEnd && cluster.length) { flush(); cols.length = 0; }
      let c = cols.findIndex((end) => end <= it.s);
      if (c < 0) { c = cols.length; cols.push(it.e); } else cols[c] = it.e;
      it._col = c; cluster.push(it); clusterEnd = Math.max(clusterEnd, it.e);
    }
    if (cluster.length) flush();
  }
  P.hourRange = (ds, items) => {
    const win = P.windowFor(ds) || [9 * 60, 18 * 60];
    let a = Math.min(win[0], ...items.map((i) => i.s), 8 * 60), b = Math.max(win[1], ...items.map((i) => i.e), 19 * 60);
    return [Math.floor(a / 60), Math.min(24, Math.ceil(b / 60))];
  };
  P.h.lane = (ds, opts = {}) => {
    const info = P.dayInfo(ds, { from: ds === P.today() ? P.nowMin() : null });
    const items = info.items.map((i) => Object.assign({}, i));
    const [h0, h1] = opts.range || P.hourRange(ds, items);
    layoutCols(items);
    const top = (m) => (m - h0 * 60) * K;
    let html = '';
    if (info.win) {
      const w = info.win;
      html += `<div class="tl-off" style="top:0;height:${Math.max(0, top(w[0]))}px"></div><div class="tl-off" style="top:${top(w[1])}px;bottom:0"></div>`;
      for (const b of P.state.prefs.breaks) if (b.end > b.start) html += `<div class="tl-break" style="top:${top(b.start)}px;height:${(b.end - b.start) * K}px"><span>${P.esc(b.label)}</span></div>`;
    } else html += `<div class="tl-off" style="top:0;bottom:0"></div>`;
    if (opts.free !== false) {
      for (const g of info.gaps) {
        if (g[1] - g[0] < 30) continue;
        html += `<div class="pt-tl__free" style="top:${top(g[0]) + 2}px;height:${(g[1] - g[0]) * K - 4}px"><span>${P.fmtDur(g[1] - g[0])} free</span>${opts.compact ? '' : `<button class="pt-btn pt-btn--secondary" data-act="slotAdd" data-date="${ds}" data-min="${g[0]}">${P.ico('plus', 'pt-ico--sm')}Use</button>`}</div>`;
      }
    }
    for (const i of items) {
      const h = Math.max(30, (i.e - i.s) * K - 3);
      const n = i._n || 1;
      const left = `calc(8px + (100% - 8px) * ${i._col / n})`, width = `calc((100% - 8px) / ${n} - 3px)`;
      html += `<div class="pt-tl__block tl-block ${h < 46 ? 'is-short' : ''}" style="top:${top(i.s) + 1}px;height:${h}px;left:${left};width:${width};right:auto" ${i.kind === 'session' ? `data-drag="${i.id}"` : ''}>${P.h.item(i, { noTag: opts.compact || n > 1 || h < 46 })}${i.kind === 'session' && !opts.noResize ? '<span class="tl-resize" aria-hidden="true"></span>' : ''}</div>`;
    }
    for (const t of P.deadlinesOn(ds)) if (t.deadline.time != null) html += `<div class="tl-dl" style="top:${top(t.deadline.time)}px"><button data-act="openTask" data-id="${t.id}">${P.ico('flag', 'pt-ico--sm')}${P.esc(t.title)} due</button></div>`;
    if (ds === P.today()) { const nm = P.nowMin(); if (nm >= h0 * 60 && nm <= h1 * 60) html += `<div class="pt-tl__now" style="top:${top(nm)}px">${opts.compact ? '' : `<b>${P.fmtMin(nm)}</b>`}</div>`; }
    if (opts.slots) for (let h = h0; h < h1; h++) html += `<button class="tl-slot" tabindex="-1" style="top:${(h - h0) * HOUR}px" data-act="slotAdd" data-date="${ds}" data-min="${h * 60}" aria-label="Add at ${P.fmtMin(h * 60)}, ${P.fmtDate(ds)}"></button>`;
    return `<div class="pt-tl__lane tl-lane" data-date="${ds}" data-h0="${h0}" style="height:${(h1 - h0) * HOUR}px">${html}</div>`;
  };
  P.h.hours = (h0, h1) => { let s = ''; for (let h = h0; h < h1; h++) s += `<div class="pt-tl__hour">${P.fmtMin(h * 60)}</div>`; return s; };
  P.h.timeline = (ds, opts = {}) => {
    const items = P.timedOn(ds);
    const r = P.hourRange(ds, items);
    return `<div class="pt-tl tl" role="group" aria-label="Timeline for ${P.fmtDate(ds, { weekday: 'long', day: 'numeric', month: 'long' })}"><div class="tl-hours">${P.h.hours(r[0], r[1])}</div>${P.h.lane(ds, Object.assign({ range: r }, opts))}</div>`;
  };
  P.act.slotAdd = (el) => P.open('slotMenu', { date: el.dataset.date, min: +el.dataset.min });
  P.ov.slotMenu = {
    type: 'dialog', title: (p) => `Add at ${P.fmtMin(p.min)}, ${P.relDate(p.date).toLowerCase()}`,
    render: (p) => `<div class="stack menu">
      <button class="pt-btn pt-btn--secondary left" data-act="slotGo" data-k="schedule">${P.ico('play')}Schedule an existing task</button>
      <button class="pt-btn pt-btn--secondary left" data-act="slotGo" data-k="new">${P.ico('plus')}New task with a session</button>
      <button class="pt-btn pt-btn--secondary left" data-act="slotGo" data-k="appt">${P.ico('lock')}New appointment</button></div>`,
  };
  P.act.slotGo = (el) => {
    const p = P.top().props; P.close();
    if (el.dataset.k === 'schedule') P.open('session', { date: p.date, start: p.min });
    else if (el.dataset.k === 'new') P.openQuick({ session: { date: p.date, start: p.min, dur: 30 } });
    else P.open('appt', { date: p.date, start: p.min });
  };

  /* ---------- daybar ---------- */
  P.h.daybar = (ds) => {
    const isToday = ds === P.today();
    const info = P.dayInfo(ds, { from: isToday ? P.nowMin() : null });
    if (!info.win) return `<div class="pt-daybar"><div class="pt-daybar__pie" style="background:var(--surface-raised)"></div><div class="pt-daybar__text"><span>${P.DAY_NAMES[P.dow(ds)]} isn’t a planning day.</span><span class="pt-muted body-sm">Change planning hours in <a href="#prefs">Settings</a>.</span></div></div>`;
    const full = P.dayInfo(ds);
    const pct = full.available ? Math.min(100, Math.round(full.planned / full.available * 100)) : 0;
    const longest = info.gaps.reduce((a, g) => Math.max(a, g[1] - g[0]), 0);
    return `<div class="pt-daybar"><div class="pt-daybar__pie" style="background:conic-gradient(var(--logo) 0 ${pct}%, var(--surface-raised) ${pct}% 100%)" aria-hidden="true"></div>
      <div class="pt-daybar__text"><span><b>${P.fmtDur(full.planned)}</b> planned · ${info.total ? `${P.fmtDur(info.total)} free${isToday ? ' left' : ''}` : isToday && P.nowMin() >= info.win[1] ? 'planning hours are over' : 'no free time left'}</span>
      <div class="pt-daybar__track" role="img" aria-label="${pct}% of planning hours scheduled"><div class="pt-daybar__fill" style="width:${pct}%"></div></div>
      <span class="pt-muted caption">${longest ? `Longest gap ${P.fmtDur(longest)} · ` : ''}planning ${P.fmtMin(info.win[0])}–${P.fmtMin(info.win[1])}, breaks excluded</span></div></div>`;
  };

  /* ---------- week strip ---------- */
  P.h.week = (ds, act) => {
    const ws = P.weekStart(ds, P.state.prefs.weekStart);
    const today = P.today();
    let cells = '';
    for (let k = 0; k < 7; k++) {
      const d = P.addDays(ws, k);
      const has = P.timedOn(d).length || P.flexibleOn(d).length || P.deadlinesOn(d).length;
      cells += `<button class="pt-day ${d === today ? 'is-today' : ''}" data-act="${act}" data-date="${d}" ${d === ds ? 'aria-current="date"' : ''} aria-label="${P.fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}${d === today ? ', today' : ''}${has ? ', has plans' : ''}">${P.fmtDate(d, { weekday: 'short' })}<b>${+d.slice(8)}</b>${has ? '<span class="pt-dot"></span>' : '<span class="pt-dot is-none"></span>'}</button>`;
    }
    return `<div class="weekbar"><button class="pt-btn pt-btn--icon pt-btn--quiet" data-act="${act}" data-date="${P.addDays(ds, -7)}" aria-label="Previous week">${P.ico('left')}</button>
      <div class="pt-week" role="group" aria-label="Week of ${P.fmtDate(ws, { day: 'numeric', month: 'long' })}">${cells}</div>
      <button class="pt-btn pt-btn--icon pt-btn--quiet" data-act="${act}" data-date="${P.addDays(ds, 7)}" aria-label="Next week">${P.ico('right')}</button></div>`;
  };

  /* ---------- Today view ---------- */
  P.views.today = (r) => {
    const today = P.today();
    if (r.query.get('date') && P.isDs(r.query.get('date'))) P.ui.date = r.query.get('date');
    const ds = P.ui.date || today;
    const isToday = ds === today;
    const timed = P.timedOn(ds);
    const flex = P.flexibleOn(ds);
    const dls = P.deadlinesOn(ds);
    const done = P.completedOn(ds);
    const view = P.ui.todayView;
    const earlier = isToday ? P.earlierPlanned(today) : [];
    const missed = isToday ? P.missedOccurrences() : [];
    const emptyDay = !timed.length && !flex.length && !dls.length;

    const flexRows = flex.map((f) => P.h.taskRow(f.task, {
      occDate: f.kind === 'occ' ? f.date : null, noProject: false,
      trailing: f.kind === 'task' ? `<button class="pt-btn pt-btn--quiet sm row-act" data-act="newSession" data-task="${f.task.id}" data-date="${ds}" aria-label="Schedule a session for ${P.esc(f.task.title)}">${P.ico('calendarPlus', 'pt-ico--sm')}<span class="hide-sm">Schedule</span></button>` : '',
    })).join('');
    const dateOnlyDl = dls.filter((t) => t.deadline.time == null);
    const schedList = [...timed.map((i) => ({ s: i.s, html: P.h.item(i) })), ...dls.filter((t) => t.deadline.time != null).map((t) => ({ s: t.deadline.time, html: P.h.deadline(t) }))].sort((a, b) => a.s - b.s);

    const notices = [];
    if (earlier.length) notices.push(`<button class="notice" data-act="carryOpen">${P.ico('planner')}<span>${P.plural(earlier.length, 'task')} planned for earlier days ${earlier.length === 1 ? 'isn’t' : 'aren’t'} done. Keep, reschedule or defer.</span>${P.ico('right')}</button>`);
    if (missed.length) notices.push(`<button class="notice" data-act="missedOpen">${P.ico('repeat')}<span>${P.plural(missed.length, 'repeating task day')} from the last two weeks ${missed.length === 1 ? 'wasn’t' : 'weren’t'} marked. Review them.</span>${P.ico('right')}</button>`);

    return `<div class="page today">
      <header class="page-h">
        <div><p class="pt-eyebrow">${P.fmtDate(ds, { weekday: 'long' })}${isToday ? '' : ` · ${P.esc(P.relDate(ds))}`}</p><h1 class="title-1 day-title">${P.fmtDate(ds, { day: 'numeric', month: 'long' })}</h1></div>
        <div class="pt-row">
          ${!isToday ? `<button class="pt-btn pt-btn--secondary" data-act="todayDate" data-date="${today}">${P.ico('today')}Back to today</button>` : ''}
          <div class="pt-seg" role="group" aria-label="View">
            <button aria-pressed="${view === 'list'}" data-act="todayView" data-v="list">${P.ico('list', 'pt-ico--sm')}List</button>
            <button aria-pressed="${view === 'timeline'}" data-act="todayView" data-v="timeline">${P.ico('timeline', 'pt-ico--sm')}Timeline</button>
          </div>
          ${isToday ? `<button class="pt-btn pt-btn--secondary" data-act="adjustToday">${P.ico('adjust')}<span>Adjust<span class="hide-sm"> today</span></span></button>` : ''}
        </div>
      </header>
      <div class="today-top">${P.h.week(ds, 'todayDate')}${P.h.daybar(ds)}</div>
      <div class="today-grid">
        <div class="stack-lg">
          ${isToday ? nextCard() : ''}
          <div class="pt-row"><button class="pt-btn pt-btn--quiet" data-act="planFromInbox" data-date="${ds}">${P.ico('inbox')}Plan from Inbox</button></div>
          ${notices.join('')}
        </div>
        <div class="stack-lg">
        ${emptyDay ? P.h.empty(isToday ? 'Nothing planned for today yet' : 'Nothing planned for this day', 'Add a task, or pick something from your Inbox.', `${!P.lessonsAvailable || P.hasLessons() ? '' : `<button class="pt-btn pt-btn--secondary" data-act="loadLessons">${P.ico('planner')}Add my college lessons</button>`}<button class="pt-btn pt-btn--primary" data-act="quickAdd" data-date="${ds}">${P.ico('plus')}Add task</button><button class="pt-btn pt-btn--secondary" data-act="planFromInbox" data-date="${ds}">${P.ico('inbox')}Plan from Inbox</button>`) : ''}
        ${dateOnlyDl.length ? `<section class="stack-sm" aria-label="Deadlines">${dateOnlyDl.map(P.h.deadline).join('')}</section>` : ''}
        ${view === 'list' ? `
          ${schedList.length ? `<section class="stack-sm" aria-labelledby="sch-h"><h2 class="pt-section-h" id="sch-h">Schedule <small>${P.plural(timed.length, 'item')}</small></h2>${schedList.map((x) => x.html).join('')}</section>` : ''}
        ` : `
          ${!emptyDay || timed.length ? `<section aria-labelledby="tl-h"><h2 class="pt-section-h" id="tl-h">Timeline <small>Tap a free gap to use it</small></h2>${P.h.timeline(ds, { slots: true })}</section>` : ''}
        `}
        ${flex.length ? `<section class="pt-card flexcard" aria-labelledby="flex-h"><h2 class="pt-section-h" id="flex-h">Flexible <small>Planned for this day, no time reserved</small></h2><div>${flexRows}</div></section>` : ''}
        ${done.length ? `<details class="done-sec" ${P.ui.completedOpen ? 'open' : ''} data-ui-toggle="completedOpen"><summary><h2 class="pt-section-h">Completed <small>${done.length}</small></h2></summary>
          <div>${done.map((f) => P.h.taskRow(f.task, { occDate: f.kind === 'occ' ? f.date : null })).join('')}</div></details>` : ''}
        </div>
      </div>
    </div>`;
  };
  document.addEventListener('toggle', (e) => { const d = e.target; if (d.dataset && d.dataset.uiToggle) P.ui[d.dataset.uiToggle] = d.open; }, true);
  P.act.todayDate = (el) => { P.ui.date = el.dataset.date; P.ui.suggestSkip = []; if (location.hash.includes('date=')) location.hash = '#today'; else P.render(); };
  P.act.todayView = (el) => { P.ui.todayView = el.dataset.v; P.saveUi(); P.render(); };

  /* ---------- earlier planned work: keep, reschedule or defer ---------- */
  P.act.carryOpen = () => P.open('carry', {});
  P.ov.carry = {
    type: 'dialog', title: () => 'Work planned for earlier days',
    render(p, o) {
      const list = P.earlierPlanned(P.today());
      if (!o.state.c) o.state.c = {};
      if (!list.length) return '<p>Everything from earlier days is handled.</p>';
      return `<div class="stack"><p class="pt-muted body-sm">Nothing moves until you choose. Keep leaves the task on its original day.</p>
        <ul class="plain">${list.map((t) => `<li class="pickrow"><span><b>${P.esc(t.title)}</b><span class="pt-muted body-sm">Planned ${P.esc(P.relDate(t.plannedDate).toLowerCase())}</span></span>
        <select aria-label="What to do with ${P.esc(t.title)}" data-chg="carry" data-id="${t.id}">${P.h.opts([['keep', 'Keep as is'], ['today', 'Plan for today'], ['tomorrow', 'Plan for tomorrow'], ['nextweek', 'Plan for next week'], ['someday', 'Move to Someday'], ['clear', 'Remove the day']], o.state.c[t.id] || 'keep')}</select></li>`).join('')}</ul></div>`;
    },
    foot: (p, o) => `<button class="pt-btn pt-btn--secondary" data-act="closeOv" data-ov-id="${o.id}">Cancel</button><button class="pt-btn pt-btn--primary" data-act="carryApply">Apply</button>`,
  };
  P.chg.carry = (el) => { P.top().state.c[el.dataset.id] = el.value; };
  P.act.carryApply = () => {
    const c = P.top().state.c; P.close();
    const ch = Object.entries(c).filter(([, v]) => v !== 'keep');
    if (!ch.length) return;
    const today = P.today();
    P.commit(`Updated ${P.plural(ch.length, 'task')} from earlier days.`, () => {
      for (const [id, v] of ch) {
        const t = P.task(id);
        if (v === 'today') t.plannedDate = today;
        if (v === 'tomorrow') t.plannedDate = P.addDays(today, 1);
        if (v === 'nextweek') t.plannedDate = P.addDays(P.weekStart(today, P.state.prefs.weekStart), 7);
        if (v === 'someday') { t.list = 'someday'; t.plannedDate = null; }
        if (v === 'clear') t.plannedDate = null;
      }
    });
  };
  P.act.missedOpen = () => P.open('missed', {});
  P.ov.missed = {
    type: 'dialog', title: () => 'Unmarked repeating tasks',
    render() {
      const m = P.missedOccurrences();
      if (!m.length) return '<p>All recent days are marked.</p>';
      return `<div class="stack"><p class="pt-muted body-sm">These stay here for review and never pile onto Today. Marking one day doesn’t change other days.</p>
        <ul class="plain">${m.map((x) => `<li class="pickrow"><span><b>${P.esc(P.occTitle(x.task, x.date))}</b><span class="pt-muted body-sm">${P.esc(P.relDate(x.date))}</span></span><span class="pt-row"><button class="pt-btn pt-btn--secondary sm" data-act="toggleOcc" data-id="${x.task.id}" data-date="${x.date}">Done</button><button class="pt-btn pt-btn--quiet sm" data-act="skipOcc" data-id="${x.task.id}" data-date="${x.date}">Skip</button></span></li>`).join('')}</ul></div>`;
    },
    foot: () => `<button class="pt-btn pt-btn--secondary" data-act="skipAllMissed">Skip all</button>`,
  };
  P.act.skipAllMissed = () => {
    const m = P.missedOccurrences(); P.close();
    P.commit(`Skipped ${P.plural(m.length, 'day')}.`, () => { for (const x of m) P.setOcc(x.task.id, x.date, { status: 'skipped', at: Date.now() }); });
  };
})();
