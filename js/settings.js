'use strict';
/* Settings, onboarding, calendar file import and in-app reminders. */
(function () {
  const pr = () => P.state.prefs;
  const tzList = () => { try { return Intl.supportedValuesOf('timeZone'); } catch (e) { return [P.systemTz(), 'UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney']; } };
  const tzOpts = (cur) => { const l = tzList(); if (!l.includes(cur)) l.unshift(cur); return P.h.opts(l.map((z) => [z, z.replace(/_/g, ' ')]), cur); };
  const ORDER = () => { const ws = pr().weekStart; return [...Array(7)].map((_, k) => (ws + k) % 7); };

  function hoursEditor(prefix = 'set') {
    return `<div class="hours">${ORDER().map((d) => { const h = pr().hours[d]; return `<div class="hrow ${h.on ? '' : 'is-off'}">
      <label class="switch"><input type="checkbox" ${h.on ? 'checked' : ''} data-chg="${prefix}Hours" data-d="${d}" data-f="on"><span>${P.DAY_NAMES[d]}</span></label>
      ${h.on ? `<span class="hrow__t"><label><span class="sr">${P.DAY_NAMES[d]} start</span><input type="time" step="900" value="${P.hm(h.start)}" data-chg="${prefix}Hours" data-d="${d}" data-f="start"></label><span aria-hidden="true">–</span><label><span class="sr">${P.DAY_NAMES[d]} end</span><input type="time" step="900" value="${P.hm(h.end)}" data-chg="${prefix}Hours" data-d="${d}" data-f="end"></label></span>` : '<span class="pt-muted body-sm">Not a planning day</span>'}
    </div>`; }).join('')}</div>`;
  }
  P.chg.setHours = (el) => {
    const h = pr().hours[el.dataset.d]; const f = el.dataset.f;
    P.commit('Planning hours saved.', () => {
      if (f === 'on') h.on = el.checked;
      else { const m = P.parseHM(el.value); if (m != null) h[f] = m; }
      if (h.end <= h.start) h.end = Math.min(1440, h.start + 60);
    }, { toast: false });
  };
  P.chg.onbHours = P.chg.setHours;

  P.views.settings = () => {
    const p = pr();
    const notif = !('Notification' in window) ? 'unsupported' : Notification.permission;
    return `<div class="page settings"><header class="page-h"><div><p class="pt-eyebrow">Settings</p><h1 class="title-1">Settings</h1></div></header>
      <div class="set-grid">
      <section class="pt-card stack" aria-labelledby="s-ap"><h2 class="title-3" id="s-ap">Appearance</h2>
        <div class="pt-seg" role="group" aria-label="Theme">${[['dark', 'Dark'], ['light', 'Light'], ['system', 'Match system']].map(([v, l]) => `<button aria-pressed="${p.theme === v}" data-act="setTheme" data-v="${v}">${l}</button>`).join('')}</div>
      </section>
      <section class="pt-card stack" aria-labelledby="s-tm"><h2 class="title-3" id="s-tm">Time and dates</h2>
        ${P.fld('Time zone', `<select data-chg="setPref" data-f="timeZone">${tzOpts(p.timeZone)}</select>`, `Timed events show in this zone. Date-only deadlines and planned days never shift. Device zone: ${P.esc(P.systemTz())}.`)}
        <div class="grid2">${P.fld('Time format', `<select data-chg="setPref" data-f="timeFormat">${P.h.opts([['24h', '24-hour (14:30)'], ['12h', '12-hour (2:30 pm)']], p.timeFormat)}</select>`)}
        ${P.fld('Week starts on', `<select data-chg="setPref" data-f="weekStart">${P.h.opts([[1, 'Monday'], [0, 'Sunday'], [6, 'Saturday']], p.weekStart)}</select>`)}</div>
      </section>
      <section class="pt-card stack wide" aria-labelledby="s-ph"><h2 class="title-3" id="s-ph">Planning hours</h2>
        <p class="pt-muted body-sm">Free time is counted inside these hours, minus appointments, sessions, routines, breaks and buffers.</p>
        ${hoursEditor()}
        <h3 class="label">Breaks <span class="pt-muted body-sm">(every planning day)</span></h3>
        <ul class="plain breaks">${p.breaks.map((b) => `<li class="brow"><input aria-label="Break name" value="${P.esc(b.label)}" data-chg="setBreak" data-id="${b.id}" data-f="label"><input type="time" step="300" aria-label="${P.esc(b.label)} start" value="${P.hm(b.start)}" data-chg="setBreak" data-id="${b.id}" data-f="start"><span aria-hidden="true">–</span><input type="time" step="300" aria-label="${P.esc(b.label)} end" value="${P.hm(b.end)}" data-chg="setBreak" data-id="${b.id}" data-f="end"><button class="pt-btn pt-btn--icon pt-btn--quiet sm" data-act="delBreak" data-id="${b.id}" aria-label="Remove ${P.esc(b.label)} break">${P.ico('x', 'pt-ico--sm')}</button></li>`).join('')}</ul>
        <button class="pt-btn pt-btn--quiet left" data-act="addBreak">${P.ico('plus')}Add a break</button>
        ${P.fld('Buffer after appointments', `<select data-chg="setPref" data-f="buffer">${P.h.opts([0, 5, 10, 15, 20, 30].map((m) => [m, m ? P.fmtDur(m) : 'None']), p.buffer)}</select>`, 'Kept free after each appointment when counting free time and adjusting today.')}
      </section>
      <section class="pt-card stack" aria-labelledby="s-fc"><h2 class="title-3" id="s-fc">Focus</h2>
        ${P.fld('Default countdown', `<select data-chg="setPref" data-f="focusDefault">${P.h.opts([5, 10, 15, 20, 25, 30, 45, 50, 60, 90].map((m) => [m, P.fmtDur(m)]), p.focusDefault)}</select>`, 'Start 5 min always starts five minutes.')}
      </section>
      <section class="pt-card stack" aria-labelledby="s-rm"><h2 class="title-3" id="s-rm">Reminders</h2>
        <label class="switch"><input type="checkbox" ${p.reminders.enabled ? 'checked' : ''} data-chg="setRem" data-f="enabled"><span>Remind me about tasks and sessions</span></label>
        <p class="note">${P.ico('info', 'pt-ico--sm')}<span>Reminders only work while Petal is open in a browser tab. Petal has no server, so nothing is delivered when the tab or browser is closed. ${notif === 'granted' ? 'Browser notifications are allowed.' : notif === 'denied' ? 'Browser notifications are blocked, so reminders show inside Petal only. You can allow them in your browser’s site settings.' : notif === 'unsupported' ? 'This browser doesn’t support notifications, so reminders show inside Petal only.' : 'Turning this on asks your browser for permission to show notifications.'}</span></p>
        ${p.reminders.enabled ? `${P.fld('Before each work session', `<select data-chg="setRem" data-f="sessionLead">${P.h.opts([['-1', 'Don’t remind'], [0, 'At start'], [5, '5 min before'], [10, '10 min before'], [15, '15 min before'], [30, '30 min before']], p.reminders.sessionLead)}</select>`, 'Task reminders are set in each task’s details.')}
          <label class="switch"><input type="checkbox" ${p.reminders.quietOn ? 'checked' : ''} data-chg="setRem" data-f="quietOn"><span>Quiet hours</span></label>
          ${p.reminders.quietOn ? `<div class="grid2">${P.fld('From', `<input type="time" step="900" value="${P.hm(p.reminders.quietStart)}" data-chg="setRem" data-f="quietStart">`)}${P.fld('Until', `<input type="time" step="900" value="${P.hm(p.reminders.quietEnd)}" data-chg="setRem" data-f="quietEnd">`)}</div><p class="fld__h">Reminders that fall in quiet hours wait until they end.</p>` : ''}
          <button class="pt-btn pt-btn--secondary left" data-act="testRem">${P.ico('bell')}Send a test reminder</button>` : ''}
      </section>
      <section class="pt-card stack wide" aria-labelledby="s-cal"><h2 class="title-3" id="s-cal">Calendars</h2>
        <p class="note">${P.ico('info', 'pt-ico--sm')}<span><b>Live calendar sync isn’t set up.</b> Connecting Google, Outlook or iCloud needs a server with sign-in (OAuth) and background sync, which this browser-only version doesn’t have. Nothing here is connected.</span></p>
        <p class="body-sm">What works now: import an <b>.ics</b> file exported from your calendar. Events show alongside your sessions, marked with their source, and stay read-only. Import the same calendar again to apply updates and cancellations. Repeating events are imported only as their first occurrence, and all-day events are skipped.</p>
        <div class="pt-row">${P.lessonsAvailable ? `<button class="pt-btn pt-btn--primary" data-act="loadLessons">${P.ico('planner')}${P.hasLessons() ? 'Reload my college lessons' : 'Add my college lessons'}</button>` : ''}<label class="pt-btn pt-btn--secondary filebtn">${P.ico('upload')}Import .ics file<input type="file" data-chg="icsFile" class="sr"></label></div>
        ${P.state.calendars.length ? `<ul class="plain cals">${P.state.calendars.map((c) => `<li class="calrow"><span>${P.ico('planner', 'pt-ico--sm')}<b>${P.esc(c.name)}</b><span class="pt-muted body-sm">${P.plural(c.count, 'event')} · imported ${P.esc(P.relDate(P.local(c.importedAt).date).toLowerCase())} ${P.fmtTime(c.importedAt)}${c.note ? ' · ' + P.esc(c.note) : ''}</span></span>
          <span class="pt-row"><label class="pt-btn pt-btn--quiet sm filebtn">Re-import<input type="file" data-chg="icsFile" data-cal="${c.id}" class="sr"></label><button class="pt-btn pt-btn--danger sm" data-act="calRemove" data-id="${c.id}">Remove</button></span></li>`).join('')}</ul>` : ''}
      </section>
      <section class="pt-card stack wide" aria-labelledby="s-dt"><h2 class="title-3" id="s-dt">Your data</h2>
        <p class="note">${P.ico('info', 'pt-ico--sm')}<span><b>No account.</b> Everything is saved in this browser on this device only. It isn’t backed up or synced, and clearing site data deletes it. Export a copy regularly.</span></p>
        <div class="pt-row"><button class="pt-btn pt-btn--secondary" data-act="exportData">${P.ico('download')}Export backup (.json)</button>
        <label class="pt-btn pt-btn--secondary filebtn">${P.ico('upload')}Restore from backup<input type="file" data-chg="importData" class="sr"></label>
        <button class="pt-btn pt-btn--danger" data-act="wipeData">${P.ico('trash')}Delete all data</button></div>
        <p class="pt-muted body-sm">${P.plural(P.state.tasks.length, 'task')}, ${P.plural(P.state.projects.length, 'project')}, ${P.plural(P.state.sessions.length, 'session')}, ${P.plural(P.state.focus.length, 'focus record')} stored.${P.storage.lastSaved ? ` Last saved ${P.fmtTime(P.storage.lastSaved)}.` : ''}</p>
        <p class="pt-muted body-sm">Shortcuts: <kbd>n</kbd> add task, <kbd>/</kbd> search, <kbd>Esc</kbd> close.</p>
      </section></div></div>`;
  };
  P.act.setTheme = (el) => P.commit('Theme saved.', () => { pr().theme = el.dataset.v; }, { toast: false, undo: false });
  P.chg.setPref = (el) => {
    const f = el.dataset.f;
    P.commit('Saved.', () => { pr()[f] = ['weekStart', 'buffer', 'focusDefault'].includes(f) ? +el.value : el.value; }, { toast: false, undo: false });
  };
  P.chg.setBreak = (el) => {
    const b = pr().breaks.find((x) => x.id === el.dataset.id); const f = el.dataset.f;
    P.commit('Break saved.', () => {
      if (f === 'label') b.label = el.value.trim() || 'Break';
      else { const m = P.parseHM(el.value); if (m != null) b[f] = m; }
      if (b.end <= b.start) b.end = b.start + 15;
    }, { toast: false });
  };
  P.act.addBreak = () => P.commit('Break added.', () => { pr().breaks.push({ id: P.uid(), label: 'Break', start: 15 * 60 + 30, end: 15 * 60 + 45 }); }, { toast: false });
  P.act.delBreak = (el) => P.commit('Break removed.', () => { pr().breaks = pr().breaks.filter((b) => b.id !== el.dataset.id); });
  P.chg.setRem = async (el) => {
    const f = el.dataset.f; const r = pr().reminders;
    if (f === 'enabled' && el.checked && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (e) { /* older browsers */ }
    }
    P.commit('Reminder settings saved.', () => {
      if (f === 'enabled' || f === 'quietOn') r[f] = el.checked;
      else if (f === 'sessionLead') r[f] = +el.value;
      else { const m = P.parseHM(el.value); if (m != null) r[f] = m; }
    }, { toast: false, undo: false });
  };
  P.act.testRem = () => fire('test', 'Test reminder', 'This is how Petal reminders look.');
  P.act.wipeData = async () => {
    const v = await P.ask({ title: 'Delete all data', body: '<p>This removes every task, project, session and record from this browser. It can’t be undone. Export a backup first if you might need it.</p>', buttons: [{ label: 'Cancel', value: null }, { label: 'Export first', value: 'export' }, { label: 'Delete everything', value: 'yes', kind: 'danger' }] });
    if (v === 'export') { P.act.exportData(); return; }
    if (v !== 'yes') return;
    P.state = P.blankState(); P.undoStack = []; P.save(true); location.hash = '#today'; P.render();
  };
  P.chg.importData = (el) => {
    const f = el.files && el.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      let data;
      try { data = JSON.parse(rd.result); } catch (e) { P.toast('That file isn’t a Petal backup.'); return; }
      if (!data || !Array.isArray(data.tasks) || !data.prefs) { P.toast('That file isn’t a Petal backup.'); return; }
      const v = await P.ask({ title: 'Restore backup', body: `<p>Replace everything in this browser with the backup from ${P.esc(data.exportedAt ? data.exportedAt.slice(0, 10) : 'that file')}? It has ${P.plural(data.tasks.length, 'task')}.</p>`, buttons: [{ label: 'Cancel', value: null }, { label: 'Replace', value: 1, kind: 'primary' }] });
      if (!v) return;
      P.commit('Backup restored.', () => { delete data.exportedAt; delete data.app; P.state = Object.assign(P.blankState(), data); P.state.prefs = Object.assign(P.blankState().prefs, data.prefs); });
    };
    rd.readAsText(f);
    el.value = '';
  };

  /* ---------- .ics import ---------- */
  function unfold(text) { return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, ''); }
  function parseDT(v, params) {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v.trim());
    if (!m) return null;
    const ds = `${m[1]}-${m[2]}-${m[3]}`;
    if (!m[4]) return { allDay: true, ds };
    const min = +m[4] * 60 + +m[5];
    if (m[7]) return { ms: Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) };
    const tz = params.TZID && P.validTz(params.TZID) ? params.TZID : P.tz();
    return { ms: P.toMs(ds, min, tz) };
  }
  P.parseIcs = (text) => {
    const lines = unfold(text).split('\n');
    const evs = []; let cur = null; let calName = null; let skipped = 0, recurring = 0;
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
      if (line === 'END:VEVENT') {
        if (cur && cur.start && cur.uid) {
          if (cur.start.allDay) skipped++;
          else {
            let end = cur.end && cur.end.ms ? cur.end.ms : null;
            if (!end && cur.dur) end = cur.start.ms + cur.dur;
            if (!end) end = cur.start.ms + 60 * P.MIN;
            evs.push({ uid: cur.uid + (cur.rid || ''), title: cur.summary || 'Busy', start: cur.start.ms, end, location: cur.location || '', notes: cur.description || '', cancelled: (cur.status || '').toUpperCase() === 'CANCELLED' });
            if (cur.rrule) recurring++;
          }
        }
        cur = null; continue;
      }
      const i = line.indexOf(':'); if (i < 0) continue;
      const left = line.slice(0, i), value = line.slice(i + 1);
      const [name, ...ps] = left.split(';');
      const params = {}; for (const p of ps) { const [k, v] = p.split('='); params[k.toUpperCase()] = (v || '').replace(/"/g, ''); }
      const N = name.toUpperCase();
      const txt = () => value.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
      if (!cur) { if (N === 'X-WR-CALNAME') calName = txt(); continue; }
      if (N === 'UID') cur.uid = value;
      else if (N === 'SUMMARY') cur.summary = txt();
      else if (N === 'DTSTART') cur.start = parseDT(value, params);
      else if (N === 'DTEND') cur.end = parseDT(value, params);
      else if (N === 'DURATION') { const d = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(value); if (d) cur.dur = ((+d[1] || 0) * 1440 + (+d[2] || 0) * 60 + (+d[3] || 0)) * P.MIN; }
      else if (N === 'STATUS') cur.status = value;
      else if (N === 'LOCATION') cur.location = txt();
      else if (N === 'DESCRIPTION') cur.description = txt();
      else if (N === 'RRULE') cur.rrule = value;
      else if (N === 'RECURRENCE-ID') cur.rid = '@' + value;
    }
    return { evs, calName, skipped, recurring };
  };
  P.chg.icsFile = (el) => {
    const f = el.files && el.files[0]; if (!f) return;
    const calId = el.dataset.cal || null;
    const rd = new FileReader();
    rd.onerror = () => P.toast('Couldn’t read that file. Try exporting it again.');
    rd.onload = () => {
      let r;
      try { r = P.parseIcs(String(rd.result)); } catch (e) { P.toast('Couldn’t read that calendar file.'); return; }
      if (!r.evs.length && !r.skipped) { P.toast('No events found in that file.'); return; }
      let added = 0, updated = 0, removed = 0;
      P.commit('Calendar imported.', (s) => {
        let cal = calId ? s.calendars.find((c) => c.id === calId) : null;
        if (!cal) { cal = { id: P.uid(), name: r.calName || f.name.replace(/\.ics$/i, ''), importedAt: Date.now(), count: 0 }; s.calendars.push(cal); }
        const existing = s.appointments.filter((a) => a.source === 'ics' && a.calId === cal.id);
        const seen = new Set();
        for (const e of r.evs) {
          if (seen.has(e.uid)) continue;
          seen.add(e.uid);
          const ex = existing.find((a) => a.uid === e.uid);
          if (e.cancelled) { if (ex) { s.appointments = s.appointments.filter((a) => a !== ex); removed++; } continue; }
          if (ex) { if (ex.title !== e.title || ex.start !== e.start || ex.end !== e.end || ex.location !== e.location) { Object.assign(ex, e); updated++; } }
          else { s.appointments.push(Object.assign({ id: P.uid(), source: 'ics', calId: cal.id, calName: cal.name, createdAt: Date.now() }, e)); added++; }
        }
        if (calId) for (const ex of existing) if (!seen.has(ex.uid) && s.appointments.includes(ex)) { s.appointments = s.appointments.filter((a) => a !== ex); removed++; }
        cal.importedAt = Date.now();
        cal.count = s.appointments.filter((a) => a.source === 'ics' && a.calId === cal.id).length;
        cal.note = [r.skipped && `${r.skipped} all-day skipped`, r.recurring && `${r.recurring} repeating, first occurrence only`].filter(Boolean).join(', ');
      }, { toast: false });
      P.toast(`Calendar imported: ${added} added, ${updated} updated, ${removed} removed.`, { undo: true });
    };
    rd.readAsText(f);
    el.value = '';
  };
  P.act.calRemove = (el) => {
    const c = P.state.calendars.find((x) => x.id === el.dataset.id);
    P.commit(`Removed “${c.name}” and its imported events.`, (s) => { s.calendars = s.calendars.filter((x) => x !== c); s.appointments = s.appointments.filter((a) => a.calId !== c.id); });
  };

  /* ---------- reminders (in-app, while the tab is open) ---------- */
  function inQuiet(min) {
    const r = pr().reminders; if (!r.quietOn) return false;
    return r.quietStart <= r.quietEnd ? min >= r.quietStart && min < r.quietEnd : min >= r.quietStart || min < r.quietEnd;
  }
  function fire(key, title, body) {
    P.toast(`${title}: ${body}`, key === 'test' ? {} : { action: { label: 'Snooze 10 min', fn: () => { P.state.snoozed[key] = Date.now() + 10 * P.MIN; delete P.state.fired[key]; P.save(); P.toast('Snoozed for 10 minutes.'); } } });
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(`Petal: ${title}`, { body, icon: 'petal-app-icon.svg', tag: key }); } catch (e) { /* some browsers need a service worker */ }
    }
  }
  function checkReminders() {
    if (!P.state || !P.state.prefs.onboarded || !pr().reminders.enabled) return;
    const now = Date.now();
    if (inQuiet(P.nowMin())) return;
    const due = [];
    for (const t of P.state.tasks) if (P.isOpen(t) && t.reminder && t.reminder <= now) due.push([`t:${t.id}:${t.reminder}`, t.title, `Reminder${now - t.reminder > 15 * P.MIN ? ` (was due ${P.fmtTime(t.reminder)})` : ''}`]);
    const lead = pr().reminders.sessionLead;
    if (lead >= 0) for (const s of P.state.sessions) { const t = P.task(s.taskId); if (P.isOpen(t) && s.start - lead * P.MIN <= now && s.end > now) due.push([`s:${s.id}:${s.start}`, t.title, `Work session ${s.start > now ? 'starts' : 'started'} at ${P.fmtTime(s.start)}`]); }
    let changed = false;
    for (const [key, title, body] of due) {
      if (P.state.fired[key]) continue;
      if (P.state.snoozed[key] && P.state.snoozed[key] > now) continue;
      P.state.fired[key] = now; delete P.state.snoozed[key]; changed = true;
      fire(key, title, body);
      break;
    }
    if (changed) P.save();
  }
  setInterval(checkReminders, 20000);
  P.checkReminders = checkReminders;

  /* ---------- onboarding ---------- */
  P.onb = { step: 0, project: '', task: '' };
  P.views.onboarding = (host) => {
    const s = P.onb; const p = pr();
    const steps = ['Time', 'Planning hours', 'Project', 'Calendar', 'First task'];
    let body = '';
    if (s.step === 0) body = `<h1 class="title-1">Welcome to Petal</h1><p class="pt-muted">A calm planner for studies, work and everyday life. First, confirm your time and week.</p>
      ${P.fld('Time zone', `<select data-chg="onbPref" data-f="timeZone">${tzOpts(p.timeZone)}</select>`, 'Detected from this device.')}
      <div class="grid2">${P.fld('Week starts on', `<select data-chg="onbPref" data-f="weekStart">${P.h.opts([[1, 'Monday'], [0, 'Sunday'], [6, 'Saturday']], p.weekStart)}</select>`)}${P.fld('Time format', `<select data-chg="onbPref" data-f="timeFormat">${P.h.opts([['24h', '24-hour'], ['12h', '12-hour']], p.timeFormat)}</select>`)}</div>`;
    if (s.step === 1) body = `<h1 class="title-1">When do you usually plan to work?</h1><p class="pt-muted">Petal counts free time inside these hours. Optional, and you can change it later.</p>${hoursEditor('onb')}`;
    if (s.step === 2) body = `<h1 class="title-1">Start a project?</h1><p class="pt-muted">A project groups tasks around an outcome, like “Finish the lab report”. Optional.</p>
      ${P.fld('Project name', `<input value="${P.esc(s.project)}" data-inp="onb" data-f="project" data-k="onb-project" placeholder="e.g. Thesis chapter 2">`)}`;
    if (s.step === 3) body = `<h1 class="title-1">Calendar connection</h1>
      <p class="note">${P.ico('info', 'pt-ico--sm')}<span>Live sync with Google, Outlook or iCloud isn’t available in this version: it needs a server with sign-in. You can import an .ics calendar file from Settings at any time, and imported events stay read-only.</span></p>`;
    if (s.step === 4) body = `<h1 class="title-1">What’s one thing on your mind?</h1><p class="pt-muted">Just a title is enough. It goes to your Inbox, and you can plan it from there.</p>
      ${P.fld('First task', `<input value="${P.esc(s.task)}" data-inp="onb" data-f="task" data-k="onb-task" placeholder="e.g. Email Sam about Friday">`)}
      <p class="note">${P.ico('info', 'pt-ico--sm')}<span>Your data stays in this browser only. There’s no account or sync. Export a backup from Settings.</span></p>`;
    const optional = s.step >= 1 && s.step <= 4;
    P.keepFocus(host, () => {
      host.innerHTML = `<div class="onb"><div class="onb__card pt-card">
      <div class="onb__brand">${window.PETAL_LOGO}</div>
      <ol class="onb__steps" aria-label="Setup steps">${steps.map((l, i) => `<li ${i === s.step ? 'aria-current="step"' : ''} class="${i < s.step ? 'is-done' : ''}"><span class="sr">${l}${i < s.step ? ', done' : ''}</span></li>`).join('')}</ol>
      <p class="pt-eyebrow">Step ${s.step + 1} of 5 · ${steps[s.step]}</p>
      <div class="stack">${body}</div>
      <div class="onb__foot">${s.step > 0 ? `<button class="pt-btn pt-btn--quiet" data-act="onbBack">${P.ico('left')}Back</button>` : '<span></span>'}
        <span class="pt-row">${optional ? `<button class="pt-btn pt-btn--secondary" data-act="onbSkip">Skip</button>` : ''}
        <button class="pt-btn pt-btn--primary" data-act="onbNext">${s.step === 4 ? 'Open Today' : 'Continue'}</button></span></div>
    </div></div>`;
    });
  };
  P.chg.onbPref = (el) => { const f = el.dataset.f; pr()[f] = f === 'weekStart' ? +el.value : el.value; P.save(); P.render(); };
  P.inp.onb = (el) => { P.onb[el.dataset.f] = el.value; };
  P.act.onbBack = () => { P.onb.step = Math.max(0, P.onb.step - 1); P.render(); };
  P.act.onbSkip = () => {
    if (P.onb.step === 2) P.onb.project = '';
    if (P.onb.step === 4) { P.onb.task = ''; return finish(); }
    P.onb.step++; P.render();
  };
  P.act.onbNext = () => {
    const s = P.onb;
    if (s.step === 4) return finish();
    s.step++; P.render();
    setTimeout(() => { const n = document.querySelector('.onb input, .onb select'); if (n) n.focus(); }, 0);
  };
  function finish() {
    const s = P.onb;
    if (s.project.trim()) P.state.projects.push({ id: P.uid(), name: s.project.trim(), outcome: '', deadline: null, notes: '', status: 'active', createdAt: Date.now(), completedAt: null, archivedAt: null });
    if (s.task.trim()) P.state.tasks.push(P.newTask({ title: s.task.trim() }));
    pr().onboarded = true;
    P.save(true);
    location.hash = '#today';
    P.render({ routeChange: true });
    if (s.task.trim()) P.toast(`“${s.task.trim()}” is in your Inbox.`);
  }
})();
