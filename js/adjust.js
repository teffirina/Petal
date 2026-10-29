'use strict';
/* Adjust today: a guided replan. Appointments, routines and locked sessions never move; only chosen flexible work does.
   Nothing changes until the person accepts, and the whole adjustment is one undo. */
(function () {
  const PRI = { high: 0, medium: 1, low: 2, none: 3 };
  P.act.adjustToday = () => P.open('adjust', {});

  function gather() {
    const today = P.today(), now = Date.now();
    const items = [];
    for (const s of P.state.sessions) {
      const t = P.task(s.taskId);
      if (!P.isOpen(t) || P.local(s.start).date !== today) continue;
      if (s.start <= now && s.end > now) items.push({ key: 's:' + s.id, kind: 'session', session: s, task: t, state: 'now' });
      else if (s.start > now) items.push({ key: 's:' + s.id, kind: 'session', session: s, task: t, state: 'later' });
      else items.push({ key: 's:' + s.id, kind: 'session', session: s, task: t, state: 'missed' });
    }
    for (const f of P.flexibleOn(today)) if (f.kind === 'task') items.push({ key: 't:' + f.task.id, kind: 'task', task: f.task });
    return items;
  }
  function initState(o) {
    const s = o.state;
    if (s.items) return;
    const win = P.windowFor(P.today());
    const nowR = Math.ceil(P.nowMin() / 5) * 5;
    s.until = P.hm(Math.min(1435, Math.max(nowR + 60, win ? win[1] : 18 * 60)));
    s.allowSplit = false;
    s.items = gather();
    s.cfg = {};
    for (const it of s.items) {
      s.cfg[it.key] = {
        use: it.kind === 'task' || it.state !== 'now',
        lock: it.kind === 'session' && it.state === 'now',
        priority: it.task.priority,
        dur: it.kind === 'session' ? Math.round((it.session.end - it.session.start) / P.MIN) : (it.task.estimate || ''),
      };
    }
    s.step = 'setup';
  }

  /* Places reconsidered items into free time, highest urgency first. */
  function propose(o) {
    const s = o.state;
    const today = P.today();
    const from = Math.ceil((P.nowMin() + 1) / 5) * 5;
    const until = P.parseHM(s.until) ?? 1440;
    const win = P.windowFor(today);
    const lo = win ? Math.max(from, win[0]) : from;
    const hi = win ? Math.min(until, win[1]) : until;
    const moving = new Set(s.items.filter((it) => s.cfg[it.key].use && !s.cfg[it.key].lock && it.kind === 'session').map((it) => it.session.id));
    const fixed = P.timedOn(today).filter((i) => !(i.kind === 'session' && moving.has(i.id)));
    const buffer = P.state.prefs.buffer || 0;
    const holes = [...fixed.map((i) => [i.s, i.e]), ...fixed.filter((i) => i.kind === 'appointment' || i.kind === 'imported').map((i) => [i.e, i.e + buffer]), ...(win ? P.state.prefs.breaks.map((b) => [b.start, b.end]) : [])];
    let free = hi > lo ? P.subtract([[lo, hi]], holes) : [];
    const todo = s.items.filter((it) => s.cfg[it.key].use && !s.cfg[it.key].lock).map((it) => {
      const c = s.cfg[it.key];
      return { it, c, dur: c.dur ? +c.dur : null, dl: P.deadlineMs(it.task), pr: PRI[c.priority], orig: it.session ? it.session.start : Infinity };
    });
    todo.sort((a, b) => (a.dl ?? Infinity) - (b.dl ?? Infinity) || a.pr - b.pr || a.orig - b.orig);
    const placed = [], unsched = [], conflicts = [];
    const take = (g, len) => { free = P.subtract(free, [[g, g + len]]); };
    for (const x of todo) {
      if (!x.dur) { unsched.push({ x, reason: 'Needs a duration. Add one above or leave it unscheduled.' }); continue; }
      const dlMin = x.dl != null && P.local(x.dl).date === today ? P.local(x.dl).min : null;
      let g = free.find((f) => f[1] - f[0] >= x.dur && (dlMin == null || f[0] + x.dur <= dlMin)) || free.find((f) => f[1] - f[0] >= x.dur);
      if (g) {
        const st = g[0]; take(st, x.dur);
        const pieces = [[st, st + x.dur]];
        placed.push({ x, pieces, shortened: 0 });
        if (dlMin != null && st + x.dur > dlMin) conflicts.push(`“${x.it.task.title}” ends after its deadline (${P.fmtMin(dlMin)}).`);
        else if (x.dl != null && P.local(x.dl).date < today) conflicts.push(`“${x.it.task.title}” is past its deadline (${P.h.deadlineText(x.it.task)}). The deadline stays as it is.`);
        continue;
      }
      if (s.allowSplit) {
        let left = x.dur; const pieces = [];
        for (const f of [...free]) {
          if (left <= 0) break;
          const len = Math.min(f[1] - f[0], left);
          if (len < 15) continue;
          pieces.push([f[0], f[0] + len]); left -= len; take(f[0], len);
        }
        if (pieces.length) {
          placed.push({ x, pieces, shortened: Math.max(0, left) });
          if (left > 0) unsched.push({ x, reason: `${P.fmtDur(left)} of it doesn’t fit today.`, partial: left });
          if (dlMin != null && pieces[pieces.length - 1][1] > dlMin) conflicts.push(`Part of “${x.it.task.title}” ends after its deadline (${P.fmtMin(dlMin)}).`);
          continue;
        }
      }
      unsched.push({ x, reason: `${P.fmtDur(x.dur)} doesn’t fit in the time left${s.allowSplit ? '' : '. Allowing splits might help'}.` });
    }
    for (const it of s.items) if (s.cfg[it.key].lock && it.kind === 'session' && it.session.end < Date.now()) { /* locked past sessions stay as they are */ }
    s.proposal = { placed, unsched, conflicts, lo, hi, capped: win && until > win[1], none: hi <= lo };
    s.choice = s.choice || {};
    for (const u of unsched) if (!s.choice[u.x.it.key]) s.choice[u.x.it.key] = 'keep';
    s.edits = {};
  }

  P.ov.adjust = {
    type: 'sheet', title: () => 'Adjust today',
    render(p, o) {
      initState(o);
      const s = o.state;
      return s.step === 'setup' ? setup(o) : review(o);
    },
    foot(p, o) {
      const s = o.state;
      if (s.step === 'setup') return `<button class="pt-btn pt-btn--secondary" data-act="closeOv" data-ov-id="${o.id}">Cancel</button><button class="pt-btn pt-btn--primary" data-act="adjPropose" ${s.items.length ? '' : 'disabled'}>Show proposal</button>`;
      return `<button class="pt-btn pt-btn--secondary" data-act="adjBack">${P.ico('left')}Edit choices</button><button class="pt-btn pt-btn--secondary" data-act="closeOv" data-ov-id="${o.id}">Cancel</button><button class="pt-btn pt-btn--primary" data-act="adjAccept">Accept changes</button>`;
    },
  };
  function setup(o) {
    const s = o.state;
    const fixed = P.timedOn(P.today()).filter((i) => i.kind !== 'session' && i.e > P.nowMin());
    const win = P.windowFor(P.today());
    if (!s.items.length) return `<div class="stack">${P.h.empty('Nothing flexible to adjust', 'Today has no sessions or planned tasks left to move. Appointments always stay where they are.', `<button class="pt-btn pt-btn--secondary" data-act="planFromInbox" data-date="${P.today()}">Plan from Inbox</button>`)}</div>`;
    return `<div class="stack-lg">
      <p class="pt-muted">Tell Petal what changed. Nothing moves until you review and accept.</p>
      <div class="grid2">
        ${P.fld('I’m available until', `<input type="time" step="300" value="${s.until}" data-chg="adj" data-f="until">`, win ? `Planning hours end at ${P.fmtMin(win[1])}. Petal won’t plan past that.` : 'Today isn’t a planning day, so only this limit applies.')}
        <div class="fld"><span class="fld__l">Long items</span><label class="switch"><input type="checkbox" ${s.allowSplit ? 'checked' : ''} data-chg="adj" data-f="allowSplit"><span>Allow splitting or shortening</span></label></div>
      </div>
      ${fixed.length ? `<section class="stack-sm"><h3 class="pt-section-h">Staying fixed <small>Never moved</small></h3>${fixed.map((i) => P.h.item(i)).join('')}</section>` : ''}
      <section class="stack-sm" aria-labelledby="adj-h"><h3 class="pt-section-h" id="adj-h">What to reconsider</h3>
        <ul class="plain adj-list">${s.items.map((it) => {
          const c = s.cfg[it.key];
          const label = it.kind === 'session' ? `${P.fmtRange(it.session.start, it.session.end)}${it.state === 'missed' ? ' · already passed' : it.state === 'now' ? ' · happening now' : ''}` : 'Planned, no time yet';
          return `<li class="adj-row ${c.use ? '' : 'is-off'}">
            <label class="switch"><input type="checkbox" ${c.use ? 'checked' : ''} data-chg="adjItem" data-key="${it.key}" data-f="use"><span><b>${P.esc(it.task.title)}</b><span class="pt-muted body-sm">${it.kind === 'session' ? P.ico('play', 'pt-ico--sm') : P.ico('list', 'pt-ico--sm')} ${label}${it.task.deadline ? ` · ${P.esc(P.h.deadlineText(it.task))}` : ''}</span></span></label>
            ${c.use ? `<div class="adj-opts">
              ${it.kind === 'session' ? `<label class="switch sm"><input type="checkbox" ${c.lock ? 'checked' : ''} data-chg="adjItem" data-key="${it.key}" data-f="lock"><span>${P.ico('lock', 'pt-ico--sm')}Keep fixed</span></label>` : ''}
              <label class="mini">Priority <select data-chg="adjItem" data-key="${it.key}" data-f="priority">${P.h.opts([['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['none', 'None']], c.priority)}</select></label>
              <label class="mini">Length <select data-chg="adjItem" data-key="${it.key}" data-f="dur">${P.h.durOpts(c.dur)}</select></label>
              ${!c.dur ? `<span class="flag-att">${P.ico('alert', 'pt-ico--sm')}No estimate. Pick a length or it stays unscheduled.</span>` : ''}
            </div>` : `<p class="pt-muted body-sm">Stays as it is.</p>`}
          </li>`;
        }).join('')}</ul></section>
    </div>`;
  }
  function review(o) {
    const s = o.state; const pr = s.proposal;
    const moved = pr.placed.filter((p) => p.x.it.kind === 'session' && p.pieces.length === 1 && !p.shortened && (p.pieces[0][0] !== P.local(p.x.it.session.start).min || p.pieces[0][1] - p.pieces[0][0] !== Math.round((p.x.it.session.end - p.x.it.session.start) / P.MIN)));
    const same = pr.placed.filter((p) => p.x.it.kind === 'session' && p.pieces.length === 1 && !p.shortened && !moved.includes(p));
    const added = pr.placed.filter((p) => p.x.it.kind === 'task' && p.pieces.length === 1 && !p.shortened);
    const split = pr.placed.filter((p) => p.pieces.length > 1 || p.shortened);
    const before = (p) => (p.x.it.kind === 'session' ? P.fmtRange(p.x.it.session.start, p.x.it.session.end) : 'No time');
    const piecesTxt = (p) => p.pieces.map((g) => `${P.fmtMin(g[0])}–${P.fmtMin(g[1])}`).join(' and ');
    const editRow = (p) => {
      const k = p.x.it.key; const e = s.edits[k];
      const st = e != null ? e : p.pieces[0][0];
      return `<li class="rv-row"><label class="switch"><input type="checkbox" ${s.skip && s.skip[k] ? '' : 'checked'} data-chg="adjSkip" data-key="${k}"><span><b>${P.esc(p.x.it.task.title)}</b></span></label>
        <span class="rv-ba"><span class="pt-muted">Before</span> <span class="time">${before(p)}</span> ${P.ico('right', 'pt-ico--sm')} <span class="pt-muted">After</span>
        <input type="time" step="300" value="${P.hm(st)}" aria-label="New start for ${P.esc(p.x.it.task.title)}" data-chg="adjEdit" data-key="${k}"> <span class="time">–${P.fmtMin(st + (p.pieces[0][1] - p.pieces[0][0]))}</span></span></li>`;
    };
    const anyChange = moved.length || added.length || split.length || pr.unsched.length;
    return `<div class="stack-lg">
      <p>${anyChange ? `${[moved.length && `${moved.length} moved`, added.length && `${added.length} given a time`, split.length && `${split.length} split or shortened`, pr.unsched.length && `${pr.unsched.length} can’t fit`].filter(Boolean).join(', ')}.` : 'Everything already fits. No changes needed.'} Appointments, routines and fixed sessions stay where they are.</p>
      ${pr.none ? `<div class="note">${P.ico('info', 'pt-ico--sm')}<span>There’s no planning time left today before ${P.esc(s.until)}.</span></div>` : ''}
      ${moved.length ? `<section><h3 class="pt-section-h">Sessions moved <small>Edit a time if you like</small></h3><ul class="plain">${moved.map(editRow).join('')}</ul></section>` : ''}
      ${added.length ? `<section><h3 class="pt-section-h">Planned tasks given a time</h3><ul class="plain">${added.map(editRow).join('')}</ul></section>` : ''}
      ${split.length ? `<section><h3 class="pt-section-h">Split or shortened</h3><ul class="plain">${split.map((p) => `<li class="rv-row"><label class="switch"><input type="checkbox" ${s.skip && s.skip[p.x.it.key] ? '' : 'checked'} data-chg="adjSkip" data-key="${p.x.it.key}"><span><b>${P.esc(p.x.it.task.title)}</b></span></label><span class="rv-ba"><span class="pt-muted">Before</span> <span class="time">${before(p)}</span> ${P.ico('right', 'pt-ico--sm')} <span class="time">${piecesTxt(p)}</span>${p.shortened ? ` <span class="flag-att">${P.fmtDur(p.shortened)} short</span>` : ''}</span></li>`).join('')}</ul></section>` : ''}
      ${same.length ? `<p class="pt-muted body-sm">Unchanged: ${same.map((p) => P.esc(p.x.it.task.title)).join(', ')}.</p>` : ''}
      ${pr.unsched.length ? `<section><h3 class="pt-section-h">Can’t fit today <small>Your choice</small></h3><ul class="plain">${pr.unsched.map((u) => {
        const k = u.x.it.key; const isS = u.x.it.kind === 'session';
        return `<li class="rv-row"><span><b>${P.esc(u.x.it.task.title)}</b><span class="pt-muted body-sm">${P.esc(u.reason)}</span></span>
        <select aria-label="What to do with ${P.esc(u.x.it.task.title)}" data-chg="adjChoice" data-key="${k}">${P.h.opts([['keep', isS ? 'Keep the session as it is' : 'Keep on today’s list'], ...(isS ? [['unschedule', 'Remove the time, keep on today’s list']] : []), ['tomorrow', 'Plan for tomorrow'], ['someday', 'Move to Someday']], s.choice[k])}</select></li>`;
      }).join('')}</ul></section>` : ''}
      ${pr.conflicts.length ? `<section><h3 class="pt-section-h">Deadline conflicts</h3><ul class="warn-list">${pr.conflicts.map((c) => `<li>${P.ico('alert', 'pt-ico--sm')}${P.esc(c)}</li>`).join('')}</ul><p class="pt-muted body-sm">Deadlines never change automatically.</p></section>` : ''}
      ${s.editWarn ? `<ul class="warn-list" aria-live="polite">${s.editWarn.map((c) => `<li>${P.ico('alert', 'pt-ico--sm')}${P.esc(c)}</li>`).join('')}</ul>` : ''}
    </div>`;
  }
  P.chg.adj = (el) => { const o = P.top(); o.state[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; P.refreshOverlay(o); };
  P.chg.adjItem = (el) => { const o = P.top(); const c = o.state.cfg[el.dataset.key]; const f = el.dataset.f; c[f] = el.type === 'checkbox' ? el.checked : f === 'dur' ? (el.value ? +el.value : '') : el.value; P.refreshOverlay(o); };
  P.act.adjPropose = () => { const o = P.top(); propose(o); o.state.step = 'review'; o.state.skip = {}; o.state.editWarn = null; P.refreshOverlay(o); };
  P.act.adjBack = () => { const o = P.top(); o.state.step = 'setup'; P.refreshOverlay(o); };
  P.chg.adjSkip = (el) => { const o = P.top(); o.state.skip[el.dataset.key] = !el.checked; };
  P.chg.adjChoice = (el) => { P.top().state.choice[el.dataset.key] = el.value; };
  P.chg.adjEdit = (el) => {
    const o = P.top(); const m = P.parseHM(el.value); if (m == null) return;
    o.state.edits[el.dataset.key] = m;
    const warn = [];
    for (const p of o.state.proposal.placed) {
      const st = o.state.edits[p.x.it.key] ?? p.pieces[0][0];
      const len = p.pieces[0][1] - p.pieces[0][0];
      const start = P.toMs(P.today(), st);
      const c = P.conflictsFor(start, start + len * P.MIN, p.x.it.session && p.x.it.session.id).filter((x) => !o.state.proposal.placed.some((q) => q.x.it.session && x.includes(`“${q.x.it.task.title}”`)));
      if (o.state.edits[p.x.it.key] != null) c.forEach((x) => warn.push(`${p.x.it.task.title}: ${x}`));
    }
    o.state.editWarn = warn.length ? warn : null;
    P.refreshOverlay(o);
  };
  P.act.adjAccept = async () => {
    const o = P.top(); const s = o.state; const pr = s.proposal;
    if (s.editWarn && s.editWarn.length) {
      const v = await P.ask({ title: 'Keep these conflicts?', body: `<ul class="warn-list">${s.editWarn.map((c) => `<li>${P.ico('alert', 'pt-ico--sm')}${P.esc(c)}</li>`).join('')}</ul>`, buttons: [{ label: 'Change times', value: null }, { label: 'Keep anyway', value: 1, kind: 'primary' }] });
      if (!v) return;
    }
    const today = P.today();
    let n = 0;
    P.commit('Adjusted today.', (st) => {
      for (const p of pr.placed) {
        const k = p.x.it.key; if (s.skip[k]) continue;
        const edited = s.edits[k];
        const pieces = p.pieces.map((g, i) => (i === 0 && edited != null ? [edited, edited + (g[1] - g[0])] : g));
        const ms = pieces.map((g) => [P.toMs(today, g[0]), P.toMs(today, g[1])]);
        if (p.x.it.kind === 'session') {
          const se = P.session(p.x.it.session.id);
          if (se.start !== ms[0][0] || se.end !== ms[0][1] || ms.length > 1) n++;
          se.start = ms[0][0]; se.end = ms[0][1]; se.keepConflict = edited != null && !!s.editWarn;
          for (const m of ms.slice(1)) st.sessions.push({ id: P.uid(), taskId: se.taskId, start: m[0], end: m[1], keepConflict: false, createdAt: Date.now() });
        } else {
          for (const m of ms) st.sessions.push({ id: P.uid(), taskId: p.x.it.task.id, start: m[0], end: m[1], keepConflict: false, createdAt: Date.now() });
          n++;
        }
      }
      for (const u of pr.unsched) {
        const k = u.x.it.key; const ch = s.choice[k]; const t = P.task(u.x.it.task.id);
        if (u.partial) continue;
        if (ch === 'keep') continue;
        n++;
        if (u.x.it.kind === 'session') st.sessions = st.sessions.filter((x) => x.id !== u.x.it.session.id);
        if (ch === 'unschedule') t.plannedDate = today;
        if (ch === 'tomorrow') t.plannedDate = P.addDays(today, 1);
        if (ch === 'someday') { t.list = 'someday'; t.plannedDate = null; }
      }
    }, { toast: false });
    P.close(o.id);
    P.toast(n ? `Adjusted today: ${P.plural(n, 'change')} applied. Appointments untouched.` : 'No changes were needed.', { undo: n > 0 });
  };
})();
