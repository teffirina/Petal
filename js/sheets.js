'use strict';
/* Quick capture, task details, session and appointment editors, search and planning pickers. */
(function () {
  const PRI = [['none', 'None'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
  const EFF = [['', 'Not set'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fld = (label, control, hint = '') => `<label class="fld"><span class="fld__l">${label}</span>${control}${hint ? `<span class="fld__h">${hint}</span>` : ''}</label>`;
  P.fld = fld;
  const sel = (attrs, options) => `<select ${attrs}>${options}</select>`;
  const val = (v) => (v == null ? '' : P.esc(v));

  /* Next free slot of `dur` minutes from now within planning hours, up to a week ahead. */
  P.suggestSlot = (dur, fromDs) => {
    const today = P.today();
    let ds = fromDs && fromDs > today ? fromDs : today;
    for (let k = 0; k < 8; k++, ds = P.addDays(ds, 1)) {
      const info = P.dayInfo(ds, { from: ds === today ? Math.ceil((P.nowMin() + 5) / 15) * 15 : null });
      const g = info.free.find((x) => x[1] - x[0] >= dur);
      if (g) { const start = P.toMs(ds, g[0]); return { start, end: start + dur * P.MIN }; }
    }
    const m = Math.ceil((P.nowMin() + 15) / 30) * 30;
    const start = P.toMs(today, Math.min(m, 1440 - dur));
    return { start, end: start + dur * P.MIN };
  };

  /* ---------- natural-language capture (simple, shown as editable fields) ---------- */
  const WDN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const wdIndex = (w) => WDN.findIndex((d) => d.startsWith(w.toLowerCase().slice(0, 3)));
  const nextWd = (wd, strict) => { const t = P.today(); let k = (wd - P.dow(t) + 7) % 7; if (strict && k === 0) k = 7; return P.addDays(t, k); };
  const parseClock = (h, m, ap) => { h = +h; m = +(m || 0); if (ap) { ap = ap.toLowerCase(); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; } return h < 24 && m < 60 ? h * 60 + m : null; };
  const dayWord = (w) => {
    w = w.toLowerCase();
    if (w === 'today') return P.today();
    if (w === 'tomorrow' || w === 'tmrw') return P.addDays(P.today(), 1);
    const i = wdIndex(w); return i >= 0 ? nextWd(i, false) : null;
  };
  const DAYRX = '(today|tomorrow|tmrw|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
  const TIMERX = '(?:\\s+at\\s+(\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?)?';
  P.parseQuick = (text) => {
    const found = [];
    let rest = ' ' + text + ' ';
    const take = (rx, fn) => { const m = rx.exec(rest); if (!m) return; const r = fn(m); if (!r) return; found.push(Object.assign({ raw: m[0].trim() }, r)); rest = rest.replace(m[0], ' '); };
    take(/\s(every\s+day|daily)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?(?=\s)/i, (m) => ({ key: 'repeat', label: `Repeats every day${m[2] ? ' at ' + P.fmtMin(parseClock(m[2], m[3], m[4])) : ''}`, v: { freq: 'daily', days: [], time: m[2] ? parseClock(m[2], m[3], m[4]) : null } }));
    take(/\s(every\s+weekday|weekdays)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?(?=\s)/i, (m) => ({ key: 'repeat', label: `Repeats on weekdays${m[2] ? ' at ' + P.fmtMin(parseClock(m[2], m[3], m[4])) : ''}`, v: { freq: 'custom', days: [1, 2, 3, 4, 5], time: m[2] ? parseClock(m[2], m[3], m[4]) : null } }));
    take(new RegExp(`\\severy\\s+${DAYRX.replace('(today|tomorrow|tmrw|', '(')}((?:\\s*(?:,|and)\\s*${DAYRX.replace('(today|tomorrow|tmrw|', '(')})*)${TIMERX}(?=\\s)`, 'i'), (m) => {
      const words = m[0].replace(/\s+at\s+.*/i, '').replace(/every/i, '').split(/,|and|\s/).filter(Boolean);
      const days = [...new Set(words.map(wdIndex).filter((i) => i >= 0))];
      const tm = /at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(m[0]);
      const time = tm ? parseClock(tm[1], tm[2], tm[3]) : null;
      return days.length ? { key: 'repeat', label: `Repeats every ${days.map((d) => WD[d]).join(', ')}${time != null ? ' at ' + P.fmtMin(time) : ''}`, v: { freq: 'custom', days, time } } : null;
    });
    take(new RegExp(`\\s(?:by|due)\\s+${DAYRX}${TIMERX}(?=\\s)`, 'i'), (m) => {
      const d = dayWord(m[1]); if (!d) return null;
      const time = m[2] ? parseClock(m[2], m[3], m[4]) : null;
      return { key: 'deadline', label: `Deadline ${P.relDate(d)}${time != null ? ' ' + P.fmtMin(time) : ''}`, v: { date: d, time } };
    });
    take(new RegExp(`\\s(?:on\\s+|next\\s+)?${DAYRX}(?=\\s)`, 'i'), (m) => {
      let d = dayWord(m[1]); if (!d) return null;
      if (/next\s/i.test(m[0])) d = nextWd(wdIndex(m[1]), true);
      return { key: 'planned', label: `Planned ${P.relDate(d)}`, v: d };
    });
    take(/\s(?:for\s+)?(\d{1,3})\s?(min|mins|minutes|m)(?=\s)/i, (m) => ({ key: 'estimate', label: `Estimate ${P.fmtDur(+m[1])}`, v: +m[1] }));
    take(/\s(?:for\s+)?(\d(?:\.5)?)\s?(h|hr|hrs|hour|hours)(?=\s)/i, (m) => ({ key: 'estimate', label: `Estimate ${P.fmtDur(+m[1] * 60)}`, v: Math.round(+m[1] * 60) }));
    take(/\s#([\w-]+)(?=\s)/, (m) => {
      const p = P.state.projects.find((x) => x.status === 'active' && x.name.toLowerCase().replace(/\s+/g, '-').startsWith(m[1].toLowerCase()));
      return p ? { key: 'project', label: `Project ${p.name}`, v: p.id } : null;
    });
    return { title: rest.replace(/\s+/g, ' ').trim(), found };
  };

  /* ---------- quick add ---------- */
  P.act.quickAdd = (el) => P.open('quick', el && el.dataset ? { plannedDate: el.dataset.date || null, projectId: el.dataset.project || null, list: el.dataset.list || null } : {});
  P.openQuick = (props) => P.open('quick', props);
  function qaDraft(o) {
    if (!o.state.d) {
      const p = o.props;
      o.state.d = { raw: p.title || '', notes: '', projectId: p.projectId || '', priority: 'none', dlDate: '', dlTime: '', plannedDate: p.plannedDate || '', estimate: '', nextStep: '', effort: '', freq: '', days: [], rtime: '', rdur: '', links: '', withSession: !!p.session, sDate: p.session ? p.session.date : P.today(), sStart: p.session ? P.hm(p.session.start) : '', sDur: p.session ? p.session.dur : 30 };
      o.state.ignore = new Set(); o.state.touched = new Set(); o.state.more = !!(p.session || p.projectId || p.plannedDate);
      if (p.session && !o.state.d.sStart) o.state.d.sStart = P.hm(Math.ceil((P.nowMin() + 15) / 15) * 15 % 1440);
    }
    return o.state.d;
  }
  function applyParse(o) {
    const d = o.state.d;
    const r = P.parseQuick(d.raw);
    o.state.parsed = r;
    for (const f of r.found) {
      if (o.state.ignore.has(f.raw)) continue;
      if (f.key === 'planned' && !o.state.touched.has('plannedDate')) d.plannedDate = f.v;
      if (f.key === 'deadline' && !o.state.touched.has('dl')) { d.dlDate = f.v.date; d.dlTime = f.v.time != null ? P.hm(f.v.time) : ''; }
      if (f.key === 'estimate' && !o.state.touched.has('estimate')) d.estimate = f.v;
      if (f.key === 'project' && !o.state.touched.has('projectId')) d.projectId = f.v;
      if (f.key === 'repeat' && !o.state.touched.has('repeat')) { d.freq = f.v.freq; d.days = f.v.days; d.rtime = f.v.time != null ? P.hm(f.v.time) : ''; }
    }
    if (r.found.some((f) => !o.state.ignore.has(f.raw))) o.state.more = true;
  }
  function qaTitle(o) {
    const r = o.state.parsed;
    if (!r) return o.state.d.raw.trim();
    let t = o.state.d.raw;
    for (const f of r.found) if (!o.state.ignore.has(f.raw)) t = t.replace(f.raw, ' ');
    return t.replace(/\s+/g, ' ').trim();
  }
  P.repeatFields = (d, prefix) => `
    <div class="grid2">
      ${fld('Repeat', sel(`data-chg="${prefix}" data-f="freq" data-k="${prefix}-freq"`, P.h.opts([['', 'Does not repeat'], ['daily', 'Every day'], ['weekly', 'Every week'], ['custom', 'Chosen weekdays']], d.freq)))}
      ${d.freq ? fld('Time (optional)', `<input type="time" step="300" value="${val(d.rtime)}" data-chg="${prefix}" data-f="rtime" data-k="${prefix}-rtime">`, 'With a time it shows as a routine block.') : ''}
    </div>
    ${d.freq === 'custom' ? `<fieldset class="days"><legend class="fld__l">On</legend>${WD.map((w, i) => `<label class="daychk"><input type="checkbox" ${d.days.includes(i) ? 'checked' : ''} data-chg="${prefix}" data-f="day" data-day="${i}"><span>${w}</span></label>`).join('')}</fieldset>` : ''}
    ${d.freq && d.rtime ? fld('Routine length', sel(`data-chg="${prefix}" data-f="rdur"`, P.h.durOpts(d.rdur || 30))) : ''}`;
  P.ov.quick = {
    type: 'dialog',
    title: (p) => (p.session ? 'New task and session' : p.list === 'someday' ? 'Add to Someday' : 'Add task'),
    render(p, o) {
      const d = qaDraft(o);
      const r = o.state.parsed;
      const recognised = r ? r.found : [];
      const finalTitle = qaTitle(o);
      return `<form data-sub="quick" id="qaForm" class="stack" novalidate>
        <label class="fld"><span class="fld__l">Title</span>
          <input class="big" name="title" autocomplete="off" value="${val(d.raw)}" data-inp="qa" data-f="raw" data-k="qa-title" placeholder="What do you need to do?" autofocus aria-describedby="qaHint" ${o.state.err ? 'aria-invalid="true"' : ''}></label>
        <p class="fld__h" id="qaHint">${o.state.err ? `<span class="err">${P.esc(o.state.err)}</span>` : 'Only a title is needed. Without a date or project it goes to the Inbox.'}</p>
        ${recognised.length ? `<div class="recog" aria-live="polite"><span class="fld__l">Recognised</span><div class="pt-row">${recognised.map((f) => {
          const ign = o.state.ignore.has(f.raw);
          return `<button type="button" class="pt-chip ${ign ? '' : 'pt-chip--petal'} chipbtn" data-act="qaIgnore" data-raw="${P.esc(f.raw)}" aria-pressed="${!ign}" aria-label="${ign ? 'Use' : 'Ignore'} ${P.esc(f.label)}">${ign ? P.ico('plus') : P.ico('check')}${P.esc(f.label)}</button>`;
        }).join('')}</div>${finalTitle !== d.raw.trim() ? `<p class="fld__h">Saves as “${P.esc(finalTitle)}”. Fields below are filled in and editable.</p>` : ''}</div>` : ''}
        <button type="button" class="pt-btn pt-btn--quiet left" data-act="qaMore" aria-expanded="${o.state.more}">${P.ico(o.state.more ? 'up' : 'down')}${o.state.more ? 'Fewer details' : 'More details'}</button>
        ${o.state.more ? `<div class="stack">
          <div class="grid2">
            ${fld('Project', sel('data-chg="qa" data-f="projectId"', P.h.projectOpts(d.projectId)))}
            ${fld('Priority', sel('data-chg="qa" data-f="priority"', P.h.opts(PRI, d.priority)))}
          </div>
          <div class="grid2">
            ${fld('Plan for a day', `<input type="date" value="${val(d.plannedDate)}" data-chg="qa" data-f="plannedDate">`, 'Intends a day. No time is reserved.')}
            ${fld('Estimated duration', sel('data-chg="qa" data-f="estimate"', P.h.durOpts(d.estimate)))}
          </div>
          <div class="grid2">
            ${fld('Deadline', `<input type="date" value="${val(d.dlDate)}" data-chg="qa" data-f="dlDate">`)}
            ${fld('Deadline time (optional)', `<input type="time" step="300" value="${val(d.dlTime)}" data-chg="qa" data-f="dlTime" ${d.dlDate ? '' : 'disabled'}>`)}
          </div>
          ${fld('Next small step', `<input value="${val(d.nextStep)}" data-inp="qa" data-f="nextStep" data-k="qa-step" placeholder="e.g. Open the document and write one heading">`)}
          ${fld('Notes', `<textarea rows="2" data-inp="qa" data-f="notes" data-k="qa-notes">${val(d.notes)}</textarea>`)}
          <div class="grid2">${fld('Effort (optional)', sel('data-chg="qa" data-f="effort"', P.h.opts(EFF, d.effort)))}
          ${fld('Links (one per line)', `<textarea rows="1" data-inp="qa" data-f="links" data-k="qa-links" placeholder="https://">${val(d.links)}</textarea>`)}</div>
          ${P.repeatFields(d, 'qa')}
          <fieldset class="box"><legend class="fld__l">Schedule a session</legend>
            <label class="switch"><input type="checkbox" ${d.withSession ? 'checked' : ''} data-chg="qa" data-f="withSession"><span>Reserve time now</span></label>
            ${d.withSession ? `<div class="grid3">${fld('Date', `<input type="date" value="${val(d.sDate)}" data-chg="qa" data-f="sDate">`)}${fld('Start', `<input type="time" step="300" value="${val(d.sStart)}" data-chg="qa" data-f="sStart">`)}${fld('Length', sel('data-chg="qa" data-f="sDur"', P.h.durOpts(d.sDur)))}</div>` : ''}
          </fieldset>
        </div>` : ''}
      </form>`;
    },
    foot: (p, o) => `${o.state.saveErr ? `<span class="err">${P.esc(o.state.saveErr)}</span>` : ''}<button class="pt-btn pt-btn--secondary" data-act="closeOv" data-ov-id="${o.id}">Cancel</button><button class="pt-btn pt-btn--primary" type="submit" form="qaForm">${P.ico('plus')}${p.session ? 'Add and schedule' : 'Add task'}</button>`,
  };
  P.inp.qa = (el) => {
    const o = P.top(); const d = o.state.d;
    d[el.dataset.f] = el.value;
    if (el.dataset.f === 'raw') { o.state.err = null; applyParse(o); P.refreshOverlay(o); }
  };
  P.chg.qa = (el) => {
    const o = P.top(); const d = o.state.d; const f = el.dataset.f;
    if (f === 'day') { const i = +el.dataset.day; d.days = el.checked ? [...new Set([...d.days, i])] : d.days.filter((x) => x !== i); }
    else if (f === 'withSession') d.withSession = el.checked;
    else d[f] = el.value;
    const touchMap = { plannedDate: 'plannedDate', dlDate: 'dl', dlTime: 'dl', estimate: 'estimate', projectId: 'projectId', freq: 'repeat', rtime: 'repeat', day: 'repeat' };
    if (touchMap[f]) o.state.touched.add(touchMap[f]);
    P.refreshOverlay(o);
  };
  P.act.qaMore = () => { const o = P.top(); o.state.more = !o.state.more; P.refreshOverlay(o); };
  P.act.qaIgnore = (el) => {
    const o = P.top(); const raw = el.dataset.raw;
    if (o.state.ignore.has(raw)) o.state.ignore.delete(raw); else {
      o.state.ignore.add(raw);
      const f = o.state.parsed.found.find((x) => x.raw === raw); const d = o.state.d;
      if (f.key === 'planned') d.plannedDate = o.props.plannedDate || '';
      if (f.key === 'deadline') { d.dlDate = ''; d.dlTime = ''; }
      if (f.key === 'estimate') d.estimate = '';
      if (f.key === 'project') d.projectId = o.props.projectId || '';
      if (f.key === 'repeat') { d.freq = ''; d.days = []; d.rtime = ''; }
    }
    applyParse(o); P.refreshOverlay(o);
  };
  P.draftToTask = (d, title) => {
    const fields = {
      title, notes: d.notes.trim(), projectId: d.projectId || null, priority: d.priority, plannedDate: d.plannedDate || null,
      estimate: d.estimate ? +d.estimate : null, nextStep: d.nextStep.trim(), effort: d.effort || null,
      deadline: d.dlDate ? { date: d.dlDate, time: P.parseHM(d.dlTime) } : null,
      links: d.links.split('\n').map((s) => s.trim()).filter(Boolean).map((url) => ({ url })),
    };
    if (d.freq && !(d.freq === 'custom' && !d.days.length)) {
      fields.recurrence = { freq: d.freq, days: d.freq === 'custom' ? d.days : [], start: d.plannedDate || P.today(), end: null, time: P.parseHM(d.rtime), duration: d.rtime ? +(d.rdur || 30) : null };
    }
    return fields;
  };
  P.sub.quick = async () => {
    const o = P.top(); const d = o.state.d;
    const title = qaTitle(o);
    if (!title) { o.state.err = 'Add a title to save the task.'; P.refreshOverlay(o); return; }
    if (o.state.saving) return;
    o.state.saving = true;
    const fields = P.draftToTask(d, title);
    if (o.props.list === 'someday') fields.list = 'someday';
    let session = null;
    if (d.withSession) {
      const sm = P.parseHM(d.sStart);
      if (!d.sDate || sm == null || !d.sDur) { o.state.saving = false; o.state.err = 'Pick a date, start time and length for the session, or turn it off.'; P.refreshOverlay(o); return; }
      const start = P.toMs(d.sDate, sm), end = start + +d.sDur * P.MIN;
      const chk = await P.checkConflicts(start, end, null, null);
      if (!chk.ok) { o.state.saving = false; return; }
      session = { start, end, keepConflict: chk.keep };
    }
    P.addTask(fields, session);
    if (!P.save(true) && P.storage.ok) {
      o.state.saveErr = 'Couldn’t save to this browser. Your task is on screen; export a copy to keep it.';
      o.state.saving = false; P.refreshOverlay(o); return;
    }
    P.close(o.id);
  };

  /* ---------- task details ---------- */
  P.openTask = (id, date) => {
    const ex = P.stack.find((o) => o.kind === 'task' && o.props.id === id);
    if (ex) { ex.props.date = date || ex.props.date; P.refreshOverlay(ex); return; }
    P.open('task', { id, date: date || null });
  };
  P.act.openTask = (el) => P.openTask(el.dataset.id, el.dataset.date);

  function sessionsBlock(t) {
    const ss = P.taskSessions(t.id);
    const now = Date.now();
    return `<section class="sec" aria-labelledby="ses-h"><h3 class="pt-section-h" id="ses-h">Work sessions <small>${ss.length ? P.plural(ss.length, 'session') : 'None yet'}</small></h3>
      ${ss.length ? `<ul class="plain">${ss.map((s) => {
        const flags = P.sessionFlags(s);
        return `<li class="srow ${s.end < now ? 'is-past' : ''}">${P.ico('play', 'pt-ico--sm')}<span class="srow__t"><b>${P.esc(P.relDate(P.local(s.start).date))}</b> <span class="time">${P.fmtRange(s.start, s.end)}</span>${s.end < now ? ' <span class="pt-muted">past</span>' : ''}${flags.length ? ` <span class="flag-att">${P.ico('alert', 'pt-ico--sm')}${P.esc(flags.join(' · '))}</span>` : ''}</span>
          <button class="pt-btn pt-btn--quiet sm" data-act="openSession" data-id="${s.id}">Edit</button>
          <button class="pt-btn pt-btn--quiet sm" data-act="removeSession" data-id="${s.id}" aria-label="Remove session ${P.esc(P.relDate(P.local(s.start).date))} ${P.fmtRange(s.start, s.end)}">Remove</button></li>`;
      }).join('')}</ul>` : `<p class="pt-muted body-sm">A session reserves time on your schedule. Planning a day doesn’t.</p>`}
      <button class="pt-btn pt-btn--secondary" data-act="newSession" data-task="${t.id}">${P.ico('calendarPlus')}Schedule a session</button>
    </section>`;
  }
  function subtasksBlock(t, ro) {
    return `<section class="sec" aria-labelledby="sub-h"><h3 class="pt-section-h" id="sub-h">Subtasks <small>${t.subtasks.length ? `${t.subtasks.filter((s) => s.done).length} of ${t.subtasks.length} done` : ''}</small></h3>
      <ul class="plain subs">${t.subtasks.map((s, i) => `<li class="sub ${s.done ? 'is-done' : ''}">
        ${P.h.check(s.done, 'toggleSub', `data-id="${t.id}" data-sid="${s.id}"`, `${s.done ? 'Reopen' : 'Complete'} step: ${s.title}`)}
        <input class="sub__in" value="${val(s.title)}" aria-label="Step ${i + 1}" data-chg="subEdit" data-id="${t.id}" data-sid="${s.id}" data-k="sub-${s.id}" ${ro ? 'readonly' : ''}>
        <span class="sub__btns">
        <button class="pt-btn pt-btn--icon pt-btn--quiet sm" data-act="subMove" data-id="${t.id}" data-sid="${s.id}" data-dir="-1" aria-label="Move step up" ${i === 0 ? 'disabled' : ''}>${P.ico('arrowUp', 'pt-ico--sm')}</button>
        <button class="pt-btn pt-btn--icon pt-btn--quiet sm" data-act="subMove" data-id="${t.id}" data-sid="${s.id}" data-dir="1" aria-label="Move step down" ${i === t.subtasks.length - 1 ? 'disabled' : ''}>${P.ico('arrowDown', 'pt-ico--sm')}</button>
        <button class="pt-btn pt-btn--icon pt-btn--quiet sm" data-act="subDel" data-id="${t.id}" data-sid="${s.id}" aria-label="Delete step">${P.ico('x', 'pt-ico--sm')}</button></span>
      </li>`).join('')}</ul>
      <form data-sub="subAdd" data-id="${t.id}" class="pt-input addsub"><input name="title" placeholder="Add a step" aria-label="Add a subtask" data-k="sub-new" autocomplete="off"><button class="pt-btn pt-btn--quiet sm" type="submit">${P.ico('plus')}Add</button></form>
    </section>`;
  }
  function focusBlock(t) {
    const recs = P.state.focus.filter((f) => f.taskId === t.id);
    if (!recs.length) return '';
    const sec = recs.reduce((a, f) => a + f.sec, 0);
    return `<p class="pt-muted body-sm">${P.ico('timer', 'pt-ico--sm')} Recorded focus: ${P.fmtDur(sec / 60)} across ${P.plural(recs.length, 'focus session')}.</p>`;
  }
  function actionRow(t, ds) {
    return `<div class="pt-row actions">
      <button class="pt-btn pt-btn--primary" data-act="start5" data-id="${t.id}" ${ds ? `data-date="${ds}"` : ''}>${P.ico('play')}Start 5 min</button>
      <button class="pt-btn pt-btn--secondary" data-act="focusTask" data-id="${t.id}">${P.ico('timer')}Focus</button>
      <button class="pt-btn pt-btn--secondary" data-act="breakdown" data-id="${t.id}">${P.ico('steps')}Help me start</button>
    </div>`;
  }

  P.ov.task = {
    type: 'sheet',
    title: (p) => { const t = P.task(p.id); return t ? (P.isSeries(t) ? 'Repeating task' : 'Task details') : 'Task'; },
    render(p, o) {
      const t = P.task(p.id);
      if (!t) return null;
      if (P.isSeries(t)) return seriesSheet(t, p, o);
      const done = t.status === 'done';
      const dl = t.deadline || {};
      const rem = t.reminder ? P.local(t.reminder) : null;
      return `<div class="stack tsheet">
        <div class="tsheet__top">
          ${P.h.check(done, 'toggleTask', `data-id="${t.id}"`, `${done ? 'Reopen' : 'Complete'}: ${t.title}`)}
          <label class="sr" for="tt-${t.id}">Title</label>
          <textarea id="tt-${t.id}" class="ttitle" rows="1" data-inp="tf" data-f="title" data-id="${t.id}" data-k="t-title">${val(t.title)}</textarea>
        </div>
        <div class="pt-row chips">${t.list === 'inbox' ? P.h.chip('Inbox', 'inbox') : ''}${done ? P.h.chip(`Completed ${P.relDate(P.local(t.completedAt).date).toLowerCase()}`, 'check', 'pt-chip--petal') : ''}${t.list === 'someday' ? P.h.chip('Someday', 'someday') : ''}${t.archived ? P.h.chip('Archived', 'archive') : ''}</div>
        ${!done ? actionRow(t) : ''}
        ${fld('Next small step', `<input value="${val(t.nextStep)}" data-inp="tf" data-f="nextStep" data-id="${t.id}" data-k="t-step" placeholder="The smallest thing you could do first">`)}
        <div class="grid2">
          ${fld('Project', sel(`data-chg="tf" data-f="projectId" data-id="${t.id}"`, P.h.projectOpts(t.projectId)))}
          ${fld('Priority', sel(`data-chg="tf" data-f="priority" data-id="${t.id}"`, P.h.opts(PRI, t.priority)))}
        </div>
        <div class="grid2">
          ${fld('Deadline', `<input type="date" value="${val(dl.date)}" data-chg="tf" data-f="dlDate" data-id="${t.id}">`, 'When it must be finished.')}
          ${fld('Deadline time (optional)', `<input type="time" step="300" value="${dl.time != null ? P.hm(dl.time) : ''}" data-chg="tf" data-f="dlTime" data-id="${t.id}" ${dl.date ? '' : 'disabled'}>`)}
        </div>
        <div class="grid2">
          ${fld('Plan for a day', `<input type="date" value="${val(t.plannedDate)}" data-chg="tf" data-f="plannedDate" data-id="${t.id}">`, 'Puts it on that day’s list. No time is reserved.')}
          ${fld('Estimated duration', sel(`data-chg="tf" data-f="estimate" data-id="${t.id}"`, P.h.durOpts(t.estimate)))}
        </div>
        <div class="pt-row quickplan">
          <button class="pt-btn pt-btn--quiet sm" data-act="planQuick" data-id="${t.id}" data-d="0">Plan for today</button>
          <button class="pt-btn pt-btn--quiet sm" data-act="planQuick" data-id="${t.id}" data-d="1">Plan for tomorrow</button>
          ${t.plannedDate ? `<button class="pt-btn pt-btn--quiet sm" data-act="planQuick" data-id="${t.id}" data-d="">Clear day</button>` : ''}
        </div>
        ${sessionsBlock(t)}
        ${subtasksBlock(t)}
        ${focusBlock(t)}
        <details class="more" ${o.state.moreOpen ? 'open' : ''} data-act-toggle="moreOpen">
          <summary>More fields</summary>
          <div class="stack">
            ${fld('Notes', `<textarea rows="3" data-inp="tf" data-f="notes" data-id="${t.id}" data-k="t-notes">${val(t.notes)}</textarea>`)}
            <div class="grid2">
              ${fld('Effort (optional)', sel(`data-chg="tf" data-f="effort" data-id="${t.id}"`, P.h.opts(EFF, t.effort || '')))}
              ${fld('Links (one per line)', `<textarea rows="2" data-chg="tf" data-f="links" data-id="${t.id}" data-k="t-links">${val(t.links.map((l) => l.url).join('\n'))}</textarea>`)}
            </div>
            ${t.links.length ? `<ul class="plain links">${t.links.map((l) => `<li><a href="${P.esc(/^https?:/i.test(l.url) ? l.url : 'https://' + l.url)}" target="_blank" rel="noopener">${P.ico('external', 'pt-ico--sm')}${P.esc(l.url)}</a></li>`).join('')}</ul>` : ''}
            <div class="grid2">
              ${fld('Reminder date', `<input type="date" value="${rem ? rem.date : ''}" data-chg="tf" data-f="remDate" data-id="${t.id}">`)}
              ${fld('Reminder time', `<input type="time" step="300" value="${rem ? P.hm(rem.min) : ''}" data-chg="tf" data-f="remTime" data-id="${t.id}">`, P.state.prefs.reminders.enabled ? 'Shown while Petal is open in a tab.' : 'Turn on reminders in Settings to get notified.')}
            </div>
            ${P.repeatFields({ freq: '', days: [], rtime: '' }, 'mkSeries" data-id="' + t.id)}
            <p class="fld__h">Attachments aren’t available: this version stores data only in your browser. Add a link instead.</p>
          </div>
        </details>
        <div class="pt-row danger-row">
          ${done ? `<button class="pt-btn pt-btn--secondary" data-act="toggleTask" data-id="${t.id}">${P.ico('reopen')}Reopen</button>` : ''}
          ${t.list === 'someday' ? `<button class="pt-btn pt-btn--secondary" data-act="activate" data-id="${t.id}">Make active</button>` : !done ? `<button class="pt-btn pt-btn--secondary" data-act="someday" data-id="${t.id}">${P.ico('someday')}Someday</button>` : ''}
          <button class="pt-btn pt-btn--secondary" data-act="dupTask" data-id="${t.id}">${P.ico('copy')}Duplicate</button>
          <button class="pt-btn pt-btn--secondary" data-act="archTask" data-id="${t.id}">${P.ico('archive')}${t.archived ? 'Restore' : 'Archive'}</button>
          <button class="pt-btn pt-btn--danger" data-act="delTask" data-id="${t.id}">${P.ico('trash')}Delete</button>
        </div>
      </div>`;
    },
    mount(el) { autoGrow(el); },
  };
  function autoGrow(el) { el.querySelectorAll('textarea.ttitle').forEach((ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }); }
  document.addEventListener('input', (e) => { if (e.target.classList && e.target.classList.contains('ttitle')) { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; } });
  document.addEventListener('toggle', (e) => { const d = e.target; if (d.dataset && d.dataset.actToggle) { const o = P.top(); if (o) o.state[d.dataset.actToggle] = d.open; } }, true);

  P.inp.tf = (el) => {
    const t = P.task(el.dataset.id); const f = el.dataset.f;
    let v = el.value;
    if (f === 'title') { v = v.replace(/\n/g, ' '); if (!v.trim()) return; }
    t[f] = v;
    P.save();
    P.render({ skip: P.top().id });
  };
  P.chg.tf = (el) => {
    const t = P.task(el.dataset.id); const f = el.dataset.f; const v = el.value;
    if (f === 'title' || f === 'notes' || f === 'nextStep') return;
    const sched = f === 'plannedDate' || f === 'dlDate' || f === 'dlTime';
    P.commit(f === 'plannedDate' ? (v ? `Planned for ${P.relDate(v).toLowerCase()}. No time reserved.` : 'Removed the planned day.') : sched ? 'Deadline updated.' : 'Saved.', () => {
      if (f === 'projectId') t.projectId = v || null;
      else if (f === 'priority') t.priority = v;
      else if (f === 'effort') t.effort = v || null;
      else if (f === 'estimate') t.estimate = v ? +v : null;
      else if (f === 'plannedDate') { t.plannedDate = v || null; if (v && t.list === 'someday') t.list = 'active'; }
      else if (f === 'dlDate') t.deadline = v ? { date: v, time: t.deadline ? t.deadline.time : null } : null;
      else if (f === 'dlTime') { if (t.deadline) t.deadline.time = P.parseHM(v); }
      else if (f === 'links') t.links = v.split('\n').map((s) => s.trim()).filter(Boolean).map((url) => ({ url }));
      else if (f === 'remDate' || f === 'remTime') {
        const cur = t.reminder ? P.local(t.reminder) : { date: P.today(), min: 9 * 60 };
        const date = f === 'remDate' ? v : cur.date; const min = f === 'remTime' ? P.parseHM(v) : cur.min;
        t.reminder = date && min != null ? P.toMs(date, min) : null;
        if (f === 'remDate' && !v) t.reminder = null;
      }
      P.inboxCheck(t);
    }, { toast: sched });
  };
  P.chg.mkSeries = async (el) => {
    const t = P.task(el.dataset.id);
    if (el.dataset.f !== 'freq' || !el.value) return;
    const freq = el.value;
    const ok = await P.ask({ title: 'Make this a repeating task?', body: `<p>“${P.esc(t.title)}” will repeat ${freq === 'daily' ? 'every day' : freq === 'weekly' ? 'every week' : 'on weekdays'} from ${P.relDate(t.plannedDate || P.today()).toLowerCase()}. Each day is tracked on its own. You can change the days afterwards.</p>`, buttons: [{ label: 'Cancel', value: null }, { label: 'Make it repeat', value: 1, kind: 'primary' }] });
    if (!ok) { P.refreshOverlay(P.top()); return; }
    P.commit(`“${t.title}” now repeats.`, (s) => {
      t.recurrence = { freq, days: freq === 'custom' ? [1, 2, 3, 4, 5] : [], start: t.plannedDate || P.today(), end: null, time: null, duration: null };
      t.plannedDate = null; P.inboxCheck(t);
      s.sessions = s.sessions.filter((x) => x.taskId !== t.id || x.end < Date.now());
    });
  };
  P.act.planQuick = (el) => P.planFor(el.dataset.id, el.dataset.d === '' ? null : P.addDays(P.today(), +el.dataset.d));
  P.act.someday = (el) => P.moveToSomeday(el.dataset.id);
  P.act.activate = (el) => P.activateTask(el.dataset.id);
  P.act.dupTask = (el) => P.duplicateTask(el.dataset.id);
  P.act.archTask = (el) => { const t = P.task(el.dataset.id); P.archiveTask(t.id, !t.archived); };
  P.act.delTask = (el) => P.deleteTask(el.dataset.id);
  P.act.toggleSub = (el) => P.toggleSubtask(el.dataset.id, el.dataset.sid);
  P.chg.subEdit = (el) => {
    const t = P.task(el.dataset.id); const s = t.subtasks.find((x) => x.id === el.dataset.sid);
    if (!el.value.trim()) { el.value = s.title; return; }
    P.commit('Step renamed.', () => { s.title = el.value.trim(); }, { toast: false });
  };
  P.act.subMove = (el) => {
    const t = P.task(el.dataset.id); const i = t.subtasks.findIndex((x) => x.id === el.dataset.sid); const j = i + +el.dataset.dir;
    if (j < 0 || j >= t.subtasks.length) return;
    P.commit('Step moved.', () => { const [x] = t.subtasks.splice(i, 1); t.subtasks.splice(j, 0, x); }, { toast: false });
    setTimeout(() => { const b = document.querySelector(`[data-act="subMove"][data-sid="${el.dataset.sid}"][data-dir="${el.dataset.dir}"]`); if (b && !b.disabled) b.focus(); }, 0);
  };
  P.act.subDel = (el) => {
    const t = P.task(el.dataset.id);
    P.commit('Step deleted.', () => { t.subtasks = t.subtasks.filter((x) => x.id !== el.dataset.sid); });
  };
  P.sub.subAdd = (f) => {
    const t = P.task(f.dataset.id); const v = f.title.value.trim();
    if (!v) return;
    P.commit('Step added.', () => { t.subtasks.push({ id: P.uid(), title: v, done: false, doneAt: null }); }, { toast: false });
    setTimeout(() => { const n = document.querySelector('[data-k="sub-new"]'); if (n) { n.value = ''; n.focus(); } }, 0);
  };

  /* Repeating tasks: occurrence actions plus series edits, scoped explicitly. */
  function seriesSheet(t, p, o) {
    const ds = p.date;
    const r = t.recurrence;
    if (!o.state.sd) o.state.sd = { title: t.title, notes: t.notes, projectId: t.projectId || '', priority: t.priority, estimate: t.estimate || '', nextStep: t.nextStep, freq: r.freq, days: [...(r.days || [])], rtime: r.time != null ? P.hm(r.time) : '', rdur: r.duration || 30, end: r.end || '' };
    const d = o.state.sd;
    const status = ds ? P.occDone(t, ds) : null;
    const occ = ds ? P.occ(t.id, ds) : null;
    const hist = [];
    for (let k = 0; k <= 13 && hist.length < 10; k++) { const x = P.addDays(P.today(), -k); if (x < r.start) break; if (P.ruleMatches(r, x)) hist.push([x, P.occDone(t, x)]); }
    return `<div class="stack tsheet">
      <div><h3 class="title-2">${P.esc(ds ? P.occTitle(t, ds) : t.title)}</h3><p class="pt-muted">${P.ico('repeat', 'pt-ico--sm')} ${P.esc(P.ruleText(r))} · from ${P.esc(P.relDate(r.start))}${r.end ? ` until ${P.esc(P.relDate(r.end))}` : ''}${t.projectId ? ` · ${P.esc(P.projectName(t.projectId))}` : ''}</p></div>
      ${ds ? `<section class="pt-card stack" aria-labelledby="occ-h">
        <h3 class="pt-section-h" id="occ-h">This occurrence · ${P.esc(P.relDate(ds))} <small>${status === 'done' ? 'Done' : status === 'skipped' ? 'Skipped' : 'Open'}</small></h3>
        <div class="pt-row">
          ${status === 'done' || status === 'skipped' ? `<button class="pt-btn pt-btn--secondary" data-act="toggleOcc" data-id="${t.id}" data-date="${ds}" ${status === 'skipped' ? 'data-skip="1"' : ''}>${P.ico('reopen')}Mark as open</button>`
            : `<button class="pt-btn pt-btn--primary" data-act="toggleOcc" data-id="${t.id}" data-date="${ds}">${P.ico('check')}Done for ${P.esc(P.relDate(ds).toLowerCase())}</button>
               <button class="pt-btn pt-btn--secondary" data-act="skipOcc" data-id="${t.id}" data-date="${ds}">Skip this one</button>
               <button class="pt-btn pt-btn--secondary" data-act="start5" data-id="${t.id}" data-date="${ds}">${P.ico('play')}Start 5 min</button>`}
        </div>
        <form data-sub="occEdit" data-id="${t.id}" data-date="${ds}" class="grid2">
          ${fld('Title for this day only', `<input name="title" value="${val((occ && occ.override && occ.override.title) || '')}" placeholder="${val(t.title)}">`)}
          ${fld('Time for this day only', `<input name="time" type="time" step="300" value="${occ && occ.override && occ.override.time != null ? P.hm(occ.override.time) : ''}">`, 'Leave empty to use the series time.')}
          <div class="pt-row"><button class="pt-btn pt-btn--secondary" type="submit">Save this occurrence</button>
          <button class="pt-btn pt-btn--danger" type="button" data-act="occRemove" data-id="${t.id}" data-date="${ds}">Remove this occurrence</button></div>
        </form>
      </section>` : ''}
      <section class="stack" aria-labelledby="ser-h">
        <h3 class="pt-section-h" id="ser-h">${ds && ds > r.start ? `This and future occurrences, from ${P.esc(P.relDate(ds))}` : 'The whole series'}</h3>
        <form data-sub="seriesEdit" data-id="${t.id}" data-date="${ds || ''}" class="stack">
          ${fld('Title', `<input name="title" value="${val(d.title)}" data-inp="sd" data-f="title" data-k="sd-title">`)}
          ${fld('Next small step', `<input value="${val(d.nextStep)}" data-inp="sd" data-f="nextStep" data-k="sd-step">`)}
          <div class="grid2">${fld('Project', sel('data-chg="sd" data-f="projectId"', P.h.projectOpts(d.projectId)))}${fld('Priority', sel('data-chg="sd" data-f="priority"', P.h.opts(PRI, d.priority)))}</div>
          ${P.repeatFields(d, 'sd')}
          <div class="grid2">${fld('Estimated duration', sel('data-chg="sd" data-f="estimate"', P.h.durOpts(d.estimate)))}${fld('Ends on (optional)', `<input type="date" value="${val(d.end)}" data-chg="sd" data-f="end">`)}</div>
          <p class="fld__h">Past days keep their history. ${ds && ds > r.start ? 'Days before ' + P.esc(P.relDate(ds).toLowerCase()) + ' stay as they are.' : ''}</p>
          <div class="pt-row"><button class="pt-btn pt-btn--primary" type="submit">Save ${ds && ds > r.start ? 'this and future' : 'series'}</button>
          <button class="pt-btn pt-btn--danger" type="button" data-act="seriesEnd" data-id="${t.id}" data-date="${ds || P.today()}">${ds && ds > r.start ? 'Delete this and future' : 'Delete series'}</button></div>
        </form>
      </section>
      ${hist.length ? `<section aria-labelledby="hist-h"><h3 class="pt-section-h" id="hist-h">Recent days</h3><ul class="plain hist">${hist.map(([x, s]) => `<li><span>${P.esc(P.relDate(x))}</span><span class="pt-chip ${s === 'done' ? 'pt-chip--petal' : ''}">${s === 'done' ? 'Done' : s === 'skipped' ? 'Skipped' : x === P.today() ? 'Open' : 'Not marked'}</span>${!s && x !== P.today() ? `<button class="pt-btn pt-btn--quiet sm" data-act="toggleOcc" data-id="${t.id}" data-date="${x}">Mark done</button>` : ''}</li>`).join('')}</ul></section>` : ''}
      ${focusBlock(t)}
      <div class="pt-row danger-row"><button class="pt-btn pt-btn--secondary" data-act="breakdown" data-id="${t.id}">${P.ico('steps')}Help me start</button><button class="pt-btn pt-btn--secondary" data-act="archTask" data-id="${t.id}">${P.ico('archive')}${t.archived ? 'Restore' : 'Archive series'}</button></div>
    </div>`;
  }
  P.inp.sd = (el) => { P.top().state.sd[el.dataset.f] = el.value; };
  P.chg.sd = (el) => {
    const o = P.top(); const d = o.state.sd; const f = el.dataset.f;
    if (f === 'day') { const i = +el.dataset.day; d.days = el.checked ? [...new Set([...d.days, i])] : d.days.filter((x) => x !== i); }
    else d[f] = el.value;
    if (f === 'freq' && !d.freq) d.freq = 'daily';
    P.refreshOverlay(o);
  };
  P.act.skipOcc = (el) => P.skipOcc(el.dataset.id, el.dataset.date);
  P.sub.occEdit = (f) => {
    const t = P.task(f.dataset.id); const ds = f.dataset.date;
    const title = f.title.value.trim(); const time = P.parseHM(f.time.value);
    P.commit(`Changed ${P.relDate(ds).toLowerCase()} only. Other days are unchanged.`, () => {
      const o = P.occ(t.id, ds);
      const ov = {};
      if (title) ov.title = title;
      if (time != null) ov.time = time;
      P.setOcc(t.id, ds, { status: o ? o.status : 'open', override: Object.keys(ov).length ? ov : null });
    });
  };
  P.act.occRemove = (el) => {
    const t = P.task(el.dataset.id); const ds = el.dataset.date;
    P.commit(`Removed ${P.relDate(ds).toLowerCase()}’s “${t.title}”. Other days are unchanged.`, () => P.setOcc(t.id, ds, { status: 'removed', at: Date.now() }));
    P.close();
  };
  P.sub.seriesEdit = (f) => {
    const o = P.top(); const t = P.task(f.dataset.id); const d = o.state.sd;
    if (!d.title.trim()) { P.toast('Add a title.'); return; }
    if (d.freq === 'custom' && !d.days.length) { P.toast('Choose at least one weekday.'); return; }
    const from = f.dataset.date && f.dataset.date > t.recurrence.start ? f.dataset.date : t.recurrence.start;
    const changes = { title: d.title.trim(), nextStep: d.nextStep, projectId: d.projectId || null, priority: d.priority, estimate: d.estimate ? +d.estimate : null,
      recurrence: Object.assign({}, t.recurrence, { freq: d.freq, days: d.freq === 'custom' ? d.days : [], time: P.parseHM(d.rtime), duration: d.rtime ? +(d.rdur || 30) : null, end: d.end || null }) };
    let nid = t.id;
    P.commit(from > t.recurrence.start ? `Updated from ${P.relDate(from).toLowerCase()} on. Earlier days are unchanged.` : 'Series updated.', () => {
      if (from > t.recurrence.start) { changes.recurrence.start = from; nid = P.splitSeries(t, from, changes).id; }
      else Object.assign(t, changes);
    });
    o.props.id = nid; o.state.sd = null; P.refreshOverlay(o);
  };
  P.act.seriesEnd = async (el) => {
    const t = P.task(el.dataset.id); const ds = el.dataset.date;
    const whole = ds <= t.recurrence.start;
    const v = await P.ask({ title: whole ? 'Delete series' : 'Delete this and future', body: `<p>${whole ? `Delete “${P.esc(t.title)}” and all its occurrences?` : `End “${P.esc(t.title)}” before ${P.esc(P.relDate(ds).toLowerCase())}? Earlier days and their history stay.`}</p>`, buttons: [{ label: 'Cancel', value: null }, { label: 'Delete', value: 1, kind: 'danger' }] });
    if (!v) return;
    P.close();
    P.commit(whole ? `Deleted “${t.title}”.` : `“${t.title}” now ends ${P.relDate(P.addDays(ds, -1)).toLowerCase()}.`, (s) => {
      if (whole) { s.tasks = s.tasks.filter((x) => x.id !== t.id); s.occurrences = s.occurrences.filter((x) => x.taskId !== t.id); }
      else { t.recurrence.end = P.addDays(ds, -1); s.occurrences = s.occurrences.filter((x) => x.taskId !== t.id || x.date < ds); }
    });
  };

  /* ---------- session editor ---------- */
  P.act.openSession = (el) => P.open('session', { id: el.dataset.id });
  P.act.newSession = (el) => {
    const props = { taskId: el.dataset.task || null };
    if (el.dataset.date) { props.date = el.dataset.date; props.start = el.dataset.min != null ? +el.dataset.min : null; }
    P.open('session', props);
  };
  P.act.removeSession = (el) => P.removeSession(el.dataset.id);
  P.ov.session = {
    type: 'dialog',
    title: (p) => (p.id ? 'Work session' : 'Schedule a session'),
    render(p, o) {
      if (p.id && !P.session(p.id)) return null;
      if (!o.state.d) {
        if (p.id) {
          const s = P.session(p.id); const l = P.local(s.start);
          o.state.d = { taskId: s.taskId, date: l.date, start: P.hm(l.min), dur: Math.round((s.end - s.start) / P.MIN) };
        } else {
          const t = p.taskId ? P.task(p.taskId) : null;
          const dur = (t && t.estimate && t.estimate <= 120 ? t.estimate : 30);
          if (p.date && p.start != null) o.state.d = { taskId: p.taskId || '', date: p.date, start: P.hm(p.start), dur };
          else { const sl = P.suggestSlot(dur, p.date); const l = P.local(sl.start); o.state.d = { taskId: p.taskId || '', date: l.date, start: P.hm(l.min), dur }; }
        }
      }
      const d = o.state.d;
      const t = d.taskId ? P.task(d.taskId) : null;
      const sm = P.parseHM(d.start);
      let warn = [];
      if (d.date && sm != null && d.dur) {
        const start = P.toMs(d.date, sm), end = start + d.dur * P.MIN;
        warn = P.conflictsFor(start, end, p.id);
        const dl = P.deadlineMs(t);
        if (dl != null && end > dl) warn.push(`Ends after the deadline (${P.h.deadlineText(t)}). The deadline stays where it is.`);
      }
      const candidates = P.state.tasks.filter((x) => P.isOpen(x) && !P.isSeries(x));
      return `<form data-sub="session" id="sesForm" class="stack" novalidate>
        ${p.id ? `<p class="title-3">${P.ico('play', 'pt-ico--sm')} ${P.esc(t ? t.title : '')}</p>` :
          candidates.length ? fld('Task', sel('data-chg="sd2" data-f="taskId" required', P.h.opts([['', 'Choose a task'], ...candidates.map((x) => [x.id, x.title])], d.taskId)), `Need a new task? <button type="button" class="linkbtn" data-act="newTaskSession" data-date="${d.date}" data-min="${sm ?? ''}">Create a task and session together</button>`)
            : `<p>No open tasks yet. <button type="button" class="linkbtn" data-act="newTaskSession" data-date="${d.date}" data-min="${sm ?? ''}">Create a task and session together</button></p>`}
        <div class="grid3">
          ${fld('Date', `<input type="date" value="${val(d.date)}" data-chg="sd2" data-f="date" required>`)}
          ${fld('Start', `<input type="time" step="300" value="${val(d.start)}" data-chg="sd2" data-f="start" required>`)}
          ${fld('Length', sel('data-chg="sd2" data-f="dur"', P.h.opts([5, 10, 15, 20, 25, 30, 45, 60, 75, 90, 120, 150, 180, 240].map((m) => [m, P.fmtDur(m)]).concat(d.dur && ![5, 10, 15, 20, 25, 30, 45, 60, 75, 90, 120, 150, 180, 240].includes(+d.dur) ? [[d.dur, P.fmtDur(d.dur)]] : []), d.dur)))}
        </div>
        <div class="pt-row nudge" aria-label="Nudge time">
          <button type="button" class="pt-btn pt-btn--quiet sm" data-act="nudge" data-m="-15">−15 min</button>
          <button type="button" class="pt-btn pt-btn--quiet sm" data-act="nudge" data-m="15">+15 min</button>
          <button type="button" class="pt-btn pt-btn--quiet sm" data-act="nudge" data-d="1">Next day</button>
          <button type="button" class="pt-btn pt-btn--quiet sm" data-act="nudgeFree">Next free slot</button>
        </div>
        ${t && t.deadline ? `<p class="pt-muted body-sm">${P.ico('flag', 'pt-ico--sm')} ${P.esc(P.h.deadlineText(t))}. Moving a session never changes the deadline.</p>` : ''}
        <div aria-live="polite">${warn.length ? `<ul class="warn-list">${warn.map((x) => `<li>${P.ico('alert', 'pt-ico--sm')}${P.esc(x)}</li>`).join('')}</ul>` : d.date && sm != null ? `<p class="ok-line">${P.ico('check', 'pt-ico--sm')} Fits your planning hours with no overlaps.</p>` : ''}</div>
        ${p.id ? `<div class="pt-row"><button type="button" class="pt-btn pt-btn--secondary" data-act="openTask" data-id="${d.taskId}">Open task</button><button type="button" class="pt-btn pt-btn--secondary" data-act="focusTask" data-id="${d.taskId}">${P.ico('timer')}Focus now</button><button type="button" class="pt-btn pt-btn--danger" data-act="removeSessionClose" data-id="${p.id}">${P.ico('trash')}Remove session</button></div><p class="fld__h">Removing a session keeps the task.</p>` : ''}
      </form>`;
    },
    foot: (p, o) => `<button class="pt-btn pt-btn--secondary" data-act="closeOv" data-ov-id="${o.id}">Cancel</button><button class="pt-btn pt-btn--primary" type="submit" form="sesForm">${p.id ? 'Save' : 'Schedule'}</button>`,
  };
  P.chg.sd2 = (el) => { const o = P.top(); o.state.d[el.dataset.f] = el.dataset.f === 'dur' ? +el.value : el.value; P.refreshOverlay(o); };
  P.act.nudge = (el) => {
    const o = P.top(); const d = o.state.d; const sm = P.parseHM(d.start) || 0;
    if (el.dataset.d) d.date = P.addDays(d.date, +el.dataset.d);
    else { let m = sm + +el.dataset.m; if (m < 0) { m += 1440; d.date = P.addDays(d.date, -1); } if (m >= 1440) { m -= 1440; d.date = P.addDays(d.date, 1); } d.start = P.hm(m); }
    P.refreshOverlay(o);
  };
  P.act.nudgeFree = () => {
    const o = P.top(); const d = o.state.d;
    const ignore = o.props.id;
    const saved = ignore ? P.session(ignore) : null;
    let tmp = null;
    if (saved) { tmp = saved.end; saved.end = saved.start; }
    const sl = P.suggestSlot(d.dur, d.date);
    if (saved) saved.end = tmp;
    const l = P.local(sl.start); d.date = l.date; d.start = P.hm(l.min);
    P.refreshOverlay(o);
  };
  P.act.removeSessionClose = (el) => { P.close(); P.removeSession(el.dataset.id); };
  P.act.newTaskSession = (el) => { P.close(); P.openQuick({ session: { date: el.dataset.date || P.today(), start: el.dataset.min !== '' ? +el.dataset.min : null, dur: 30 } }); };
  P.sub.session = async () => {
    const o = P.top(); const d = o.state.d;
    if (!d.taskId) { P.toast('Choose a task for this session.'); return; }
    const sm = P.parseHM(d.start);
    if (!d.date || sm == null) { P.toast('Pick a date and start time.'); return; }
    const start = P.toMs(d.date, sm);
    const ok = await P.saveSession({ id: o.props.id, taskId: d.taskId, start, end: start + d.dur * P.MIN });
    if (ok) P.close(o.id);
  };

  /* ---------- appointment editor ---------- */
  P.act.openAppt = (el) => P.open('appt', { id: el.dataset.id });
  P.act.newAppt = (el) => P.open('appt', { date: el.dataset.date || P.ui.date || P.today(), start: el.dataset.min ? +el.dataset.min : null });
  P.ov.appt = {
    type: 'dialog',
    title: (p) => { const a = p.id && P.appt(p.id); return a && a.source === 'ics' ? 'Imported event' : p.id ? 'Appointment' : 'New appointment'; },
    render(p, o) {
      const a = p.id ? P.appt(p.id) : null;
      if (p.id && !a) return null;
      if (a && a.source === 'ics') {
        const cal = P.state.calendars.find((c) => c.id === a.calId);
        return `<div class="stack"><p class="title-3">${P.ico('lock', 'pt-ico--sm')} ${P.esc(a.title)}</p>
          <p class="time">${P.esc(P.relDate(P.local(a.start).date))} · ${P.fmtRange(a.start, a.end)}</p>
          ${a.location ? `<p>${P.esc(a.location)}</p>` : ''}${a.notes ? `<p class="pt-muted">${P.esc(a.notes)}</p>` : ''}
          <p class="note">${P.ico('info', 'pt-ico--sm')} From “${P.esc(cal ? cal.name : 'imported calendar')}”. Imported events are read-only. Change it in the original calendar and import the file again.</p></div>`;
      }
      if (!o.state.d) {
        if (a) { const l = P.local(a.start), e = P.local(a.end); o.state.d = { title: a.title, date: l.date, start: P.hm(l.min), end: P.hm(e.min || 0), location: a.location || '', notes: a.notes || '' }; }
        else { const sm = p.start != null ? p.start : Math.ceil((P.nowMin() + 30) / 30) * 30 % 1380; o.state.d = { title: '', date: p.date, start: P.hm(sm), end: P.hm(Math.min(1435, sm + 60)), location: '', notes: '' }; }
      }
      const d = o.state.d;
      return `<form data-sub="appt" id="apForm" class="stack" novalidate>
        ${fld('Title', `<input value="${val(d.title)}" data-inp="ap" data-f="title" data-k="ap-title" required autofocus>`)}
        <div class="grid3">${fld('Date', `<input type="date" value="${val(d.date)}" data-inp="ap" data-f="date">`)}${fld('Starts', `<input type="time" step="300" value="${val(d.start)}" data-inp="ap" data-f="start">`)}${fld('Ends', `<input type="time" step="300" value="${val(d.end)}" data-inp="ap" data-f="end">`)}</div>
        ${fld('Location (optional)', `<input value="${val(d.location)}" data-inp="ap" data-f="location" data-k="ap-loc">`)}
        ${fld('Notes (optional)', `<textarea rows="2" data-inp="ap" data-f="notes" data-k="ap-notes">${val(d.notes)}</textarea>`)}
        <p class="fld__h">${P.ico('lock', 'pt-ico--sm')} Appointments are fixed. Adjust today never moves them.</p>
        ${a ? `<button type="button" class="pt-btn pt-btn--danger left" data-act="delAppt" data-id="${a.id}">${P.ico('trash')}Delete appointment</button>` : ''}
      </form>`;
    },
    foot: (p, o) => { const a = p.id && P.appt(p.id); return a && a.source === 'ics' ? `<button class="pt-btn pt-btn--secondary" data-act="closeOv" data-ov-id="${o.id}">Close</button>` : `<button class="pt-btn pt-btn--secondary" data-act="closeOv" data-ov-id="${o.id}">Cancel</button><button class="pt-btn pt-btn--primary" type="submit" form="apForm">Save</button>`; },
  };
  P.inp.ap = (el) => { P.top().state.d[el.dataset.f] = el.value; };
  P.act.delAppt = (el) => { P.close(); P.deleteAppt(el.dataset.id); };
  P.sub.appt = async () => {
    const o = P.top(); const d = o.state.d;
    const s = P.parseHM(d.start), e = P.parseHM(d.end);
    if (!d.date || s == null || e == null) { P.toast('Pick a date, start and end.'); return; }
    const start = P.toMs(d.date, s); let end = P.toMs(d.date, e);
    if (e <= s) end = P.toMs(P.addDays(d.date, 1), e);
    const ok = await P.saveAppt({ id: o.props.id || undefined, title: d.title.trim(), start, end, location: d.location.trim(), notes: d.notes.trim() });
    if (ok) P.close(o.id);
  };

  /* ---------- search ---------- */
  P.act.search = () => P.open('search', {});
  P.ov.search = {
    type: 'dialog',
    title: () => 'Search',
    render(p, o) {
      const q = (o.state.q || '').trim().toLowerCase();
      const arch = !!o.state.arch;
      let res = '';
      if (q) {
        const m = (s) => (s || '').toLowerCase().includes(q);
        const tasks = P.state.tasks.filter((t) => (arch || !t.archived) && (m(t.title) || m(t.notes) || m(t.nextStep) || t.subtasks.some((s) => m(s.title)))).slice(0, 30);
        const projects = P.state.projects.filter((x) => (arch || x.status !== 'archived') && (m(x.name) || m(x.notes) || m(x.outcome)));
        res = (projects.length ? `<h3 class="pt-eyebrow">Projects</h3><ul class="plain results">${projects.map((x) => `<li><button class="res" data-act="openProjectFromSearch" data-id="${x.id}">${P.ico('folder')}<span>${P.esc(x.name)}${x.status !== 'active' ? ` <span class="pt-muted">(${x.status === 'done' ? 'completed' : 'archived'})</span>` : ''}</span></button></li>`).join('')}</ul>` : '') +
          (tasks.length ? `<h3 class="pt-eyebrow">Tasks</h3><ul class="plain results">${tasks.map((t) => `<li><button class="res" data-act="openTask" data-id="${t.id}">${P.ico(t.status === 'done' ? 'check' : P.isSeries(t) ? 'repeat' : 'tasks')}<span>${P.esc(t.title)}<span class="pt-muted body-sm"> ${t.status === 'done' ? '· Completed' : ''}${t.archived ? ' · Archived' : ''}${t.list === 'inbox' ? ' · Inbox' : ''}${t.list === 'someday' ? ' · Someday' : ''}${t.projectId ? ' · ' + P.esc(P.projectName(t.projectId)) : ''}</span></span></button></li>`).join('')}</ul>` : '');
        if (!res) res = `<p class="pt-muted">Nothing matches “${P.esc(o.state.q)}”${arch ? '' : ' in active items'}.${arch ? '' : ' Try including archived items.'}</p>`;
      }
      return `<div class="stack"><div class="pt-input">${P.ico('search')}<input type="search" placeholder="Search tasks and projects" aria-label="Search tasks and projects" value="${val(o.state.q)}" data-inp="searchQ" data-k="search-q" autofocus></div>
        <label class="switch"><input type="checkbox" ${arch ? 'checked' : ''} data-chg="searchArch"><span>Include archived items</span></label>
        <div aria-live="polite">${res}</div></div>`;
    },
  };
  P.inp.searchQ = (el) => { const o = P.top(); o.state.q = el.value; P.refreshOverlay(o); };
  P.chg.searchArch = (el) => { const o = P.top(); o.state.arch = el.checked; P.refreshOverlay(o); };
  P.act.openProjectFromSearch = (el) => { P.close(); P.go('#tasks-project-' + el.dataset.id); };

  /* ---------- plan from Inbox ---------- */
  P.act.planFromInbox = (el) => P.open('planPick', { date: el.dataset.date || P.today() });
  P.ov.planPick = {
    type: 'dialog',
    title: (p) => `Plan for ${P.relDate(p.date).toLowerCase()}`,
    render(p) {
      const list = P.state.tasks.filter((t) => P.isOpen(t) && !P.isSeries(t) && t.list !== 'someday' && t.plannedDate !== p.date);
      const inbox = list.filter((t) => t.list === 'inbox');
      const other = list.filter((t) => t.list !== 'inbox' && !t.plannedDate);
      const row = (t) => `<li class="pickrow"><span><b>${P.esc(t.title)}</b><span class="pt-task__meta">${P.h.taskChips(t)}</span></span>
        <span class="pt-row"><button class="pt-btn pt-btn--secondary sm" data-act="pickPlan" data-id="${t.id}" data-date="${p.date}">Plan</button>
        <button class="pt-btn pt-btn--quiet sm" data-act="newSession" data-task="${t.id}" data-date="${p.date}">Schedule</button></span></li>`;
      if (!inbox.length && !other.length) return `<div class="stack">${P.h.empty('Nothing waiting', 'Your Inbox is empty and every active task already has a day.', `<button class="pt-btn pt-btn--primary" data-act="quickAdd" data-date="${p.date}">${P.ico('plus')}Add task</button>`)}</div>`;
      return `<div class="stack"><p class="pt-muted body-sm">Planning puts a task on the day’s list without reserving time. Schedule reserves a session.</p>
        ${inbox.length ? `<h3 class="pt-eyebrow">Inbox</h3><ul class="plain">${inbox.map(row).join('')}</ul>` : ''}
        ${other.length ? `<h3 class="pt-eyebrow">Active, no day yet</h3><ul class="plain">${other.map(row).join('')}</ul>` : ''}</div>`;
    },
  };
  P.act.pickPlan = (el) => P.planFor(el.dataset.id, el.dataset.date);
})();
