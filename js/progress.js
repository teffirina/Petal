'use strict';
/* Progress and weekly review: only recorded activity, in plain numbers. */
(function () {
  function range(period, ds) {
    if (period === 'day') return [ds, ds];
    if (period === 'week') { const s = P.weekStart(ds, P.state.prefs.weekStart); return [s, P.addDays(s, 6)]; }
    const s = P.monthStart(ds); return [s, P.addDays(s, P.daysInMonth(ds) - 1)];
  }
  P.activity = (d0, d1) => {
    const inR = (ms) => { if (!ms) return false; const d = P.local(ms).date; return d >= d0 && d <= d1; };
    const tasks = P.state.tasks.filter((t) => !P.isSeries(t) && t.status === 'done' && inR(t.completedAt));
    const subs = [];
    for (const t of P.state.tasks) for (const s of t.subtasks) if (s.done && inR(s.doneAt)) subs.push({ t, s });
    const occ = P.state.occurrences.filter((o) => o.status === 'done' && o.date >= d0 && o.date <= d1);
    const focus = P.state.focus.filter((f) => inR(f.start));
    const focusSec = focus.reduce((a, f) => a + f.sec, 0);
    return { tasks, subs, occ, focus, focusSec };
  };
  function bars(d0, d1, focus) {
    const days = P.diffDays(d0, d1) + 1;
    if (days < 2) return '';
    const per = {};
    for (const f of focus) { const d = P.local(f.start).date; per[d] = (per[d] || 0) + f.sec; }
    const vals = [...Array(days)].map((_, k) => { const d = P.addDays(d0, k); return [d, per[d] || 0]; });
    const max = Math.max(...vals.map((v) => v[1]), 1);
    return `<figure class="bars" aria-label="Focus time per day"><div class="bars__plot">${vals.map(([d, v]) => `<div class="bar" title="${P.fmtDate(d)}: ${P.fmtDur(Math.round(v / 60))}"><span class="bar__v" style="height:${Math.round((v / max) * 100)}%"></span><span class="bar__l">${days <= 7 ? P.fmtDate(d, { weekday: 'narrow' }) : (+d.slice(8) % 5 === 1 ? +d.slice(8) : '')}</span><span class="sr">${P.fmtDate(d)}: ${P.fmtDur(Math.round(v / 60))}</span></div>`).join('')}</div>
      <figcaption class="pt-muted body-sm">Focus time per day. Longest day: ${P.fmtDur(Math.round(max / 60))}.</figcaption></figure>`;
  }
  P.views.progress = (r) => {
    const tab = r.sub === 'review' ? 'review' : 'activity';
    const period = P.ui.progressPeriod;
    const ds = P.ui.progressDate || P.today();
    const head = `<header class="page-h"><div><p class="pt-eyebrow">Progress</p><h1 class="title-1">${tab === 'review' ? 'Weekly review' : 'What you’ve done'}</h1></div>
      <nav class="pt-seg" aria-label="Progress views"><a class="segl" href="#progress" ${tab === 'activity' ? 'aria-current="page"' : ''}>Activity</a><a class="segl" href="#progress-review" ${tab === 'review' ? 'aria-current="page"' : ''}>Weekly review</a></nav></header>`;
    return `<div class="page progress">${head}${tab === 'review' ? review() : activity(period, ds)}</div>`;
  };
  function activity(period, ds) {
    const [d0, d1] = range(period, ds);
    const a = P.activity(d0, d1);
    const step = (k) => (period === 'day' ? P.addDays(ds, k) : period === 'week' ? P.addDays(ds, 7 * k) : P.addMonths(ds, k));
    const label = period === 'day' ? P.relDate(d0) : period === 'week' ? `${P.fmtDate(d0, { day: 'numeric', month: 'short' })} – ${P.fmtDate(d1, { day: 'numeric', month: 'short' })}` : P.fmtDate(d0, { month: 'long', year: 'numeric' });
    const nothingEver = !P.state.focus.length && !P.state.tasks.some((t) => t.status === 'done') && !P.state.occurrences.some((o) => o.status === 'done') && !P.state.tasks.some((t) => t.subtasks.some((s) => s.done));
    const byProj = {};
    for (const t of a.tasks) { const k = t.projectId || ''; byProj[k] = (byProj[k] || 0) + 1; }
    const focusByProj = {};
    for (const f of a.focus) { const t = P.task(f.taskId); const k = (t ? t.projectId : f.projectId) || ''; focusByProj[k] = (focusByProj[k] || 0) + f.sec; }
    const projKeys = [...new Set([...Object.keys(byProj), ...Object.keys(focusByProj)])];
    const projects = P.state.projects.filter((p) => p.status === 'active');
    return `<div class="pl-tools"><div class="pt-row">
        <div class="pt-seg" role="group" aria-label="Period">${['day', 'week', 'month'].map((k) => `<button aria-pressed="${period === k}" data-act="prPeriod" data-v="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
        <span class="prnav"><button class="pt-btn pt-btn--icon pt-btn--secondary" data-act="prDate" data-date="${step(-1)}" aria-label="Previous ${period}">${P.ico('left')}</button>
        <span class="title-3 prlabel">${P.esc(label)}</span>
        <button class="pt-btn pt-btn--icon pt-btn--secondary" data-act="prDate" data-date="${step(1)}" aria-label="Next ${period}">${P.ico('right')}</button></span>
        ${d0 <= P.today() && d1 >= P.today() ? '' : `<button class="pt-btn pt-btn--quiet" data-act="prDate" data-date="${P.today()}">This ${period}</button>`}
      </div></div>
      ${nothingEver ? P.h.empty('No activity recorded yet', 'When you complete a task or run a focus session, it shows up here. Planned time doesn’t count until you do it.', `<a class="pt-btn pt-btn--primary" href="#today">Go to Today</a>`) : `
      <div class="stats">
        <div class="pt-card stat"><span class="pt-eyebrow">Tasks completed</span><b class="title-1">${a.tasks.length}</b><span class="pt-muted body-sm">Parent tasks only</span></div>
        <div class="pt-card stat"><span class="pt-eyebrow">Subtasks completed</span><b class="title-1">${a.subs.length}</b><span class="pt-muted body-sm">Counted separately</span></div>
        <div class="pt-card stat"><span class="pt-eyebrow">Focus time</span><b class="title-1">${P.fmtDur(Math.round(a.focusSec / 60))}</b><span class="pt-muted body-sm">${P.plural(a.focus.length, 'timed session')}. Breaks excluded</span></div>
        <div class="pt-card stat"><span class="pt-eyebrow">Repeating days done</span><b class="title-1">${a.occ.length}</b><span class="pt-muted body-sm">Routine occurrences</span></div>
      </div>
      ${bars(d0, d1, a.focus)}
      <div class="two">
        <section class="pt-card stack-sm" aria-labelledby="bp-h"><h2 class="pt-section-h" id="bp-h">By project <small>${P.esc(label)}</small></h2>
          ${projKeys.length ? `<table class="tbl"><thead><tr><th scope="col">Project</th><th scope="col">Completed tasks</th><th scope="col">Focus</th></tr></thead><tbody>${projKeys.map((k) => `<tr><th scope="row">${k ? P.esc(P.projectName(k) || 'Deleted project') : 'No project'}</th><td>${byProj[k] || 0}</td><td>${P.fmtDur(Math.round((focusByProj[k] || 0) / 60))}</td></tr>`).join('')}</tbody></table>` : `<p class="pt-muted body-sm">Nothing recorded in this ${period}.</p>`}
        </section>
        <section class="pt-card stack-sm" aria-labelledby="pc-h"><h2 class="pt-section-h" id="pc-h">Project task counts <small>All time</small></h2>
          ${projects.length ? `<ul class="plain counts">${projects.map((p) => { const c = P.projectCounts(p.id); return `<li><a href="#tasks-project-${p.id}">${P.esc(p.name)}</a><span>${c.done} of ${P.plural(c.total, 'task')} completed</span></li>`; }).join('')}</ul><p class="pt-muted body-sm">Counts tasks, not effort.</p>` : '<p class="pt-muted body-sm">No active projects.</p>'}
        </section>
      </div>
      <section class="stack-sm" aria-labelledby="cl-h"><h2 class="pt-section-h" id="cl-h">Completed in this ${period} <small>${a.tasks.length + a.occ.length}</small></h2>
        ${a.tasks.length || a.occ.length ? `<div class="pt-card list">${a.tasks.map((t) => P.h.taskRow(t)).join('')}${a.occ.map((o) => { const t = P.task(o.taskId); return t ? P.h.taskRow(t, { occDate: o.date }) : ''; }).join('')}</div>` : `<p class="pt-muted">Nothing completed in this ${period}.</p>`}
      </section>
      ${a.focus.length ? `<section class="stack-sm" aria-labelledby="fr-h"><h2 class="pt-section-h" id="fr-h">Focus records</h2><ul class="plain frs">${a.focus.slice().sort((x, y) => y.start - x.start).slice(0, 20).map((f) => { const t = P.task(f.taskId); return `<li><span class="time">${P.esc(P.relDate(P.local(f.start).date))} ${P.fmtTime(f.start)}</span><span>${P.esc(t ? t.title : f.taskTitle || 'Deleted task')}</span><span class="time">${P.fmtSec(f.sec)}${f.corrected ? ' · corrected' : ''}</span></li>`; }).join('')}</ul></section>` : ''}`}`;
  }
  P.act.prPeriod = (el) => { P.ui.progressPeriod = el.dataset.v; P.render(); };
  P.act.prDate = (el) => { P.ui.progressDate = el.dataset.date; P.render(); };

  function review() {
    const ws = P.ui.reviewWeek || P.weekStart(P.today(), P.state.prefs.weekStart);
    const we = P.addDays(ws, 6);
    const nextWs = P.addDays(ws, 7);
    const a = P.activity(ws, we);
    const notes = P.state.reviews[ws] || {};
    const today = P.today();
    const open = P.state.tasks.filter((t) => P.isOpen(t) && !P.isSeries(t));
    const important = open.filter((t) => t.list !== 'someday' && (t.priority === 'high' || (t.deadline && P.diffDays(today, t.deadline.date) <= 14))).slice(0, 12);
    const smaller = open.filter((t) => t.list !== 'someday' && !t.subtasks.length && ((t.estimate && t.estimate >= 90) || (t.plannedDate && t.plannedDate < ws) || P.focusFor(t.id) >= 45 * 60)).slice(0, 12);
    const move = open.filter((t) => t.plannedDate && t.plannedDate >= ws && t.plannedDate <= we).slice(0, 15);
    const acts = (t, extra = '') => `<span class="row-acts"><button class="pt-btn pt-btn--quiet sm" data-act="openTask" data-id="${t.id}">Edit</button><button class="pt-btn pt-btn--quiet sm" data-act="breakdown" data-id="${t.id}">Break down</button><button class="pt-btn pt-btn--quiet sm" data-act="newSession" data-task="${t.id}" data-date="${today}">Schedule</button>${extra}</span>`;
    const q = (n, title, list, key, ph) => `<section class="pt-card stack-sm rv" aria-labelledby="rq${n}"><h2 class="pt-section-h" id="rq${n}"><span><span class="rv-n">${n}</span>${title}</span></h2>${list}
      ${P.fld('Notes', `<textarea rows="2" data-chg="rvNote" data-week="${ws}" data-q="${key}" placeholder="${ph}">${P.esc(notes[key] || '')}</textarea>`)}</section>`;
    return `<div class="pl-tools"><div class="pt-row">
        <button class="pt-btn pt-btn--icon pt-btn--secondary" data-act="rvWeek" data-date="${P.addDays(ws, -7)}" aria-label="Previous week">${P.ico('left')}</button>
        <span class="title-3 prlabel">${P.fmtDate(ws, { day: 'numeric', month: 'short' })} – ${P.fmtDate(we, { day: 'numeric', month: 'short' })}</span>
        <button class="pt-btn pt-btn--icon pt-btn--secondary" data-act="rvWeek" data-date="${nextWs}" aria-label="Next week">${P.ico('right')}</button></div>
        ${notes.savedAt ? `<span class="pt-muted body-sm">Notes saved ${P.relDate(P.local(notes.savedAt).date).toLowerCase()} ${P.fmtTime(notes.savedAt)}</span>` : ''}</div>
      <div class="review">
      ${q(1, 'What was completed?', a.tasks.length || a.occ.length || a.focus.length ? `<p>${P.plural(a.tasks.length, 'task')} and ${P.plural(a.subs.length, 'subtask')} completed, ${P.plural(a.occ.length, 'repeating day')} done, ${P.fmtDur(Math.round(a.focusSec / 60))} focused.</p><ul class="plain bullets">${a.tasks.map((t) => `<li>${P.ico('check', 'pt-ico--sm')}${P.esc(t.title)}</li>`).join('')}</ul>` : '<p class="pt-muted">Nothing recorded this week yet. That’s fine. Start with what matters next.</p>', 'completed', 'Anything worth remembering?')}
      ${q(2, 'What remains important?', important.length ? `<div class="list">${important.map((t) => P.h.taskRow(t, { trailing: acts(t) })).join('')}</div>` : '<p class="pt-muted">No high-priority tasks or deadlines in the next two weeks.</p>', 'important', 'What matters most next?')}
      ${q(3, 'Which tasks need smaller steps?', smaller.length ? `<p class="pt-muted body-sm">Long estimates, carried over from earlier, or lots of focus without steps.</p><div class="list">${smaller.map((t) => P.h.taskRow(t, { trailing: acts(t) })).join('')}</div>` : '<p class="pt-muted">Nothing stands out. Use Break down on any task that feels heavy.</p>', 'smaller', 'Where do you get stuck?')}
      ${q(4, 'What should move to next week?', move.length ? `<div class="list">${move.map((t) => P.h.taskRow(t, { planned: true, trailing: `<span class="row-acts"><button class="pt-btn pt-btn--quiet sm" data-act="rvMove" data-id="${t.id}" data-date="${nextWs}">Plan ${P.fmtDate(nextWs, { weekday: 'short', day: 'numeric' })}</button><label class="mini"><span class="sr">Pick a day for ${P.esc(t.title)}</span><input type="date" data-chg="rvMoveDate" data-id="${t.id}" min="${today}"></label><button class="pt-btn pt-btn--quiet sm" data-act="someday" data-id="${t.id}">Someday</button></span>` })).join('')}</div>` : '<p class="pt-muted">Nothing planned for this week is left open.</p>', 'move', 'What will you carry forward?')}
      </div>`;
  }
  P.act.rvWeek = (el) => { P.ui.reviewWeek = el.dataset.date; P.render(); };
  P.chg.rvNote = (el) => {
    const ws = el.dataset.week;
    P.commit('Review notes saved.', (s) => { s.reviews[ws] = Object.assign({}, s.reviews[ws], { [el.dataset.q]: el.value, savedAt: Date.now() }); }, { toast: false, undo: false });
  };
  P.act.rvMove = (el) => P.planFor(el.dataset.id, el.dataset.date);
  P.chg.rvMoveDate = (el) => { if (el.value) P.planFor(el.dataset.id, el.value); };
})();
