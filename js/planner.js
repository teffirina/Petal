'use strict';
/* Planner: day, week and month. Every action works through buttons and forms; dragging is an optional shortcut. */
(function () {
  const HOUR = 64;
  P.views.planner = (r) => {
    const today = P.today();
    const v = ['day', 'week', 'month'].includes(r.sub) ? r.sub : P.ui.plannerView;
    P.ui.plannerView = v;
    if (r.query.get('date') && P.isDs(r.query.get('date'))) P.ui.plannerDate = r.query.get('date');
    const ds = P.ui.plannerDate || today;
    const step = v === 'day' ? 1 : v === 'week' ? 7 : 0;
    const prev = step ? P.addDays(ds, -step) : P.addMonths(ds, -1);
    const next = step ? P.addDays(ds, step) : P.addMonths(ds, 1);
    const ws = P.weekStart(ds, P.state.prefs.weekStart);
    const label = v === 'day' ? P.fmtDate(ds, { weekday: 'long', day: 'numeric', month: 'long' })
      : v === 'week' ? `${P.fmtDate(ws, { day: 'numeric', month: 'short' })} – ${P.fmtDate(P.addDays(ws, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`
        : P.fmtDate(ds, { month: 'long', year: 'numeric' });
    const body = v === 'day' ? dayView(ds) : v === 'week' ? weekView(ws) : monthView(ds);
    return `<div class="page planner planner--${v}">
      <header class="page-h">
        <div><p class="pt-eyebrow">Planner</p><h1 class="title-1">${P.esc(label)}</h1></div>
        <div class="pt-seg" role="group" aria-label="Planner view">
          ${['day', 'week', 'month'].map((k) => `<button aria-pressed="${v === k}" data-act="plView" data-v="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}
        </div>
      </header>
      <div class="pl-tools">
        <div class="pt-row">
          <button class="pt-btn pt-btn--icon pt-btn--secondary" data-act="plDate" data-date="${prev}" aria-label="Previous ${v}">${P.ico('left')}</button>
          <button class="pt-btn pt-btn--secondary" data-act="plDate" data-date="${today}">Today</button>
          <button class="pt-btn pt-btn--icon pt-btn--secondary" data-act="plDate" data-date="${next}" aria-label="Next ${v}">${P.ico('right')}</button>
          <label class="sr" for="plJump">Go to date</label><input id="plJump" type="date" class="datejump" value="${ds}" data-chg="plJump">
        </div>
        <div class="pt-row">
          <button class="pt-btn pt-btn--primary" data-act="newSession" data-date="${v === 'day' ? ds : ''}">${P.ico('play')}Schedule task</button>
          <button class="pt-btn pt-btn--secondary" data-act="newTaskWithSession" data-date="${v === 'day' ? ds : today}">${P.ico('plus')}Task + session</button>
          <button class="pt-btn pt-btn--secondary" data-act="newAppt" data-date="${v === 'day' ? ds : today}">${P.ico('lock')}Appointment</button>
        </div>
      </div>
      <p class="legend" aria-label="Legend"><span class="lg lg--session">${P.ico('play', 'pt-ico--sm')}Work session</span><span class="lg lg--appointment">${P.ico('lock', 'pt-ico--sm')}Appointment</span><span class="lg lg--routine">${P.ico('repeat', 'pt-ico--sm')}Routine</span><span class="lg lg--deadline">${P.ico('flag', 'pt-ico--sm')}Deadline</span><span class="lg lg--imported">${P.ico('lock', 'pt-ico--sm')}Imported</span></p>
      ${body}
      <p class="pt-muted body-sm hint">${P.ico('info', 'pt-ico--sm')} Open any block to change its date, time or length. With a mouse you can also drag a session or its bottom edge.</p>
    </div>`;
  };
  P.act.plView = (el) => { P.ui.plannerView = el.dataset.v; P.saveUi(); P.go('#planner-' + el.dataset.v); };
  P.act.plDate = (el) => { P.ui.plannerDate = el.dataset.date; P.render(); };
  P.chg.plJump = (el) => { if (P.isDs(el.value)) { P.ui.plannerDate = el.value; P.render(); } };
  P.act.plOpenDay = (el) => { P.ui.plannerDate = el.dataset.date; P.ui.plannerView = 'day'; P.go('#planner-day'); };
  P.act.newTaskWithSession = (el) => P.openQuick({ session: { date: el.dataset.date || P.today(), start: null, dur: 30 } });

  function gapsText(ds) {
    const isToday = ds === P.today();
    const info = P.dayInfo(ds, { from: isToday ? P.nowMin() : null });
    if (!info.win) return '<p class="pt-muted body-sm">Not a planning day.</p>';
    if (!info.gaps.length) return '<p class="pt-muted body-sm">No usable gaps left in planning hours.</p>';
    return `<ul class="plain gaps">${info.gaps.map((g) => `<li><span class="time">${P.fmtMin(g[0])}–${P.fmtMin(g[1])}</span><span>${P.fmtDur(g[1] - g[0])}</span><button class="pt-btn pt-btn--quiet sm" data-act="slotAdd" data-date="${ds}" data-min="${g[0]}">Use</button></li>`).join('')}</ul>`;
  }
  function dayView(ds) {
    const flex = P.flexibleOn(ds);
    const dls = P.deadlinesOn(ds).filter((t) => t.deadline.time == null);
    return `<div class="pl-day">
      <div class="stack-lg">
        ${dls.length ? `<div class="stack-sm">${dls.map(P.h.deadline).join('')}</div>` : ''}
        ${P.h.timeline(ds, { slots: true })}
      </div>
      <aside class="stack-lg">
        ${P.h.daybar(ds)}
        <section class="pt-card stack-sm" aria-labelledby="gap-h"><h2 class="pt-section-h" id="gap-h">Usable gaps <small>15 min or more</small></h2>${gapsText(ds)}</section>
        <section class="pt-card stack-sm" aria-labelledby="pfl-h"><h2 class="pt-section-h" id="pfl-h">Flexible <small>No time reserved</small></h2>
          ${flex.length ? flex.map((f) => P.h.taskRow(f.task, { occDate: f.kind === 'occ' ? f.date : null, trailing: f.kind === 'task' ? `<button class="pt-btn pt-btn--quiet sm row-act" data-act="newSession" data-task="${f.task.id}" data-date="${ds}">Schedule</button>` : '' })).join('') : `<p class="pt-muted body-sm">Nothing planned without a time.</p>`}
          <button class="pt-btn pt-btn--quiet left" data-act="planFromInbox" data-date="${ds}">${P.ico('inbox')}Plan from Inbox</button>
        </section>
      </aside>
    </div>`;
  }
  function weekView(ws) {
    const days = [...Array(7)].map((_, k) => P.addDays(ws, k));
    let h0 = 24, h1 = 0;
    for (const d of days) { const r = P.hourRange(d, P.timedOn(d)); h0 = Math.min(h0, r[0]); h1 = Math.max(h1, r[1]); }
    const today = P.today();
    const head = days.map((d) => {
      const info = P.dayInfo(d, { from: d === today ? P.nowMin() : null });
      const dls = P.deadlinesOn(d);
      const flex = P.flexibleOn(d).length;
      return `<div class="wk-head ${d === today ? 'is-today' : ''}">
        <button class="wk-day" data-act="plOpenDay" data-date="${d}" ${d === today ? 'aria-current="date"' : ''}><span>${P.fmtDate(d, { weekday: 'short' })}</span><b>${+d.slice(8)}</b></button>
        <span class="wk-free">${info.win ? `${P.fmtDur(info.total)} free` : 'Off'}</span>
        ${flex ? `<span class="wk-flex">${P.plural(flex, 'flexible task')}</span>` : ''}
        ${dls.map((t) => `<button class="wk-dl" data-act="openTask" data-id="${t.id}">${P.ico('flag', 'pt-ico--sm')}<span>${P.esc(t.title)}</span></button>`).join('')}
      </div>`;
    }).join('');
    return `<div class="wk-scroll"><div class="wk">
      <div class="wk-corner"></div>${head}
      <div class="tl-hours">${P.h.hours(h0, h1)}</div>
      ${days.map((d) => P.h.lane(d, { range: [h0, h1], slots: true, compact: true, free: false })).join('')}
    </div></div>`;
  }
  function monthView(ds) {
    const ms = P.monthStart(ds);
    const start = P.weekStart(ms, P.state.prefs.weekStart);
    const n = P.daysInMonth(ds);
    const end = P.addDays(ms, n - 1);
    const weeks = Math.ceil((P.diffDays(start, end) + 1) / 7);
    const today = P.today();
    const names = [...Array(7)].map((_, k) => `<div class="mo-name" aria-hidden="true">${P.fmtDate(P.addDays(start, k), { weekday: 'short' })}</div>`).join('');
    let cells = '';
    for (let k = 0; k < weeks * 7; k++) {
      const d = P.addDays(start, k);
      const timed = P.timedOn(d);
      const s = timed.filter((i) => i.kind === 'session').length;
      const a = timed.filter((i) => i.kind === 'appointment' || i.kind === 'imported').length;
      const ro = timed.filter((i) => i.kind === 'routine').length;
      const dl = P.deadlinesOn(d).length;
      const fl = P.flexibleOn(d).length;
      const parts = [s && `${s} session${s > 1 ? 's' : ''}`, a && `${a} appointment${a > 1 ? 's' : ''}`, ro && `${ro} routine${ro > 1 ? 's' : ''}`, dl && `${dl} deadline${dl > 1 ? 's' : ''}`, fl && `${fl} flexible`].filter(Boolean);
      cells += `<button class="mo-cell ${d.slice(0, 7) !== ds.slice(0, 7) ? 'is-out' : ''} ${d === today ? 'is-today' : ''}" data-act="plOpenDay" data-date="${d}" aria-label="${P.fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}: ${parts.length ? parts.join(', ') : 'nothing planned'}">
        <b ${d === today ? 'class="todaynum"' : ''}>${+d.slice(8)}</b>
        <span class="mo-marks" aria-hidden="true">${s ? `<span class="mk mk--session">${P.ico('play')}${s}</span>` : ''}${a ? `<span class="mk mk--appointment">${P.ico('lock')}${a}</span>` : ''}${ro ? `<span class="mk mk--routine">${P.ico('repeat')}${ro}</span>` : ''}${dl ? `<span class="mk mk--deadline">${P.ico('flag')}${dl}</span>` : ''}${fl ? `<span class="mk">${P.ico('list')}${fl}</span>` : ''}</span>
      </button>`;
    }
    return `<div class="mo">${names}${cells}</div>`;
  }

  /* ---------- optional dragging: mouse and pen only, so touch scrolling stays natural ---------- */
  let drag = null;
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    const block = e.target.closest('.tl-block[data-drag]');
    if (!block) return;
    const lane = block.closest('.tl-lane');
    const se = P.session(block.dataset.drag);
    if (!se || !lane) return;
    drag = { block, lane, se, x: e.clientX, y: e.clientY, top: block.offsetTop, h: block.offsetHeight, resize: e.target.classList.contains('tl-resize'), moved: false, pid: e.pointerId };
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const dy = e.clientY - drag.y, dx = e.clientX - drag.x;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) { drag.moved = true; drag.block.classList.add('is-dragging'); try { drag.block.setPointerCapture(drag.pid); } catch (err) { /* ok */ } }
    const snap = 15 * HOUR / 60;
    if (drag.resize) drag.block.style.height = Math.max(snap, Math.round((drag.h + dy) / snap) * snap) + 'px';
    else {
      drag.block.style.top = Math.max(0, Math.round((drag.top + dy) / snap) * snap) + 'px';
      const lanes = [...document.querySelectorAll('.tl-lane')];
      const over = lanes.find((l) => { const r = l.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right; });
      drag.target = over || drag.lane;
      if (over && over !== drag.lane) drag.block.style.transform = `translateX(${over.getBoundingClientRect().left - drag.lane.getBoundingClientRect().left}px)`;
      else drag.block.style.transform = '';
    }
  });
  document.addEventListener('pointerup', async (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag; drag = null;
    if (!d.moved) return;
    window.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
    const h0 = +d.lane.dataset.h0;
    const lane = d.target || d.lane;
    const ds = lane.dataset.date;
    const dur = Math.round((d.se.end - d.se.start) / P.MIN);
    let start, end;
    if (d.resize) {
      const newDur = Math.round(parseFloat(d.block.style.height) / HOUR * 60 / 15) * 15;
      start = d.se.start; end = start + Math.max(15, newDur) * P.MIN;
    } else {
      const min = Math.round((parseFloat(d.block.style.top) / HOUR * 60 + h0 * 60) / 15) * 15;
      start = P.toMs(ds, min); end = start + dur * P.MIN;
    }
    const ok = await P.saveSession({ id: d.se.id, taskId: d.se.taskId, start, end });
    if (!ok) P.render();
  });
})();
