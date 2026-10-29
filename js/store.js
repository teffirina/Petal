'use strict';
/* Petal store: one shared record per task, persisted in this browser's localStorage. */
(function () {
  const KEY = 'petal:data:v1';

  function defaultHours() {
    const h = {};
    for (let d = 0; d < 7; d++) h[d] = { on: d >= 1 && d <= 5, start: 9 * 60, end: 18 * 60 };
    return h;
  }
  P.blankState = () => ({
    version: 1,
    prefs: {
      onboarded: false,
      theme: 'system',
      timeZone: P.systemTz(),
      timeFormat: '24h',
      weekStart: 1,
      hours: defaultHours(),
      breaks: [{ id: P.uid(), label: 'Lunch', start: 12 * 60 + 30, end: 13 * 60 + 15 }],
      buffer: 10,
      focusDefault: 25,
      reminders: { enabled: false, sessionLead: 10, quietOn: false, quietStart: 22 * 60, quietEnd: 7 * 60 },
    },
    tasks: [],
    projects: [],
    sessions: [],
    appointments: [],
    calendars: [],
    occurrences: [],
    focus: [],
    reviews: {},
    timer: null,
    fired: {},
    snoozed: {},
  });

  /* ---------- persistence ---------- */
  P.storage = { ok: true, error: null, lastSaved: 0 };
  function probe() {
    try { const k = 'petal:probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; }
  }
  P.load = () => {
    P.storage.ok = probe();
    let s = null;
    if (P.storage.ok) {
      try { const raw = localStorage.getItem(KEY); if (raw) s = JSON.parse(raw); } catch (e) { P.storage.error = 'Saved data could not be read.'; }
    }
    P.state = migrate(s || P.blankState());
  };
  function migrate(s) {
    const b = P.blankState();
    for (const k of Object.keys(b)) if (s[k] === undefined) s[k] = b[k];
    s.prefs = Object.assign({}, b.prefs, s.prefs);
    s.prefs.reminders = Object.assign({}, b.prefs.reminders, s.prefs.reminders);
    if (!P.validTz(s.prefs.timeZone)) s.prefs.timeZone = P.systemTz();
    return s;
  }
  let saveTimer = null;
  P.save = (now) => {
    clearTimeout(saveTimer);
    if (now) return writeNow();
    saveTimer = setTimeout(writeNow, 250);
  };
  function writeNow() {
    if (!P.storage.ok) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(P.state));
      P.storage.error = null;
      P.storage.lastSaved = Date.now();
      return true;
    } catch (e) {
      P.storage.error = 'Couldn’t save to this browser. Your changes are still on screen. Export a copy or try again.';
      P.render && P.render();
      return false;
    }
  }
  P.retrySave = () => { P.storage.ok = probe(); writeNow(); P.render(); };
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try { P.state = migrate(JSON.parse(e.newValue)); P.render(); } catch (err) { /* ignore */ }
  });
  window.addEventListener('pagehide', () => P.save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) P.save(true); });

  /* ---------- commits and undo ---------- */
  P.undoStack = [];
  function snapshot() { const s = P.clone(P.state); delete s.timer; return s; }
  P.commit = (label, fn, opts = {}) => {
    const before = opts.undo === false ? null : snapshot();
    const res = fn(P.state);
    if (res === false) return res;
    if (before) {
      P.undoStack.push({ label, snap: before });
      if (P.undoStack.length > 40) P.undoStack.shift();
    }
    P.save();
    if (!opts.silent) P.render(opts.renderOpts);
    if (before && opts.toast !== false) P.toast(label, { undo: true, action: opts.action });
    return res;
  };
  P.undo = () => {
    const u = P.undoStack.pop();
    if (!u) return;
    const timer = P.state.timer;
    P.state = u.snap;
    P.state.timer = timer;
    P.save();
    P.render();
    P.toast(`Undone: ${u.label.replace(/\.$/, '')}`);
  };

  /* ---------- lookups ---------- */
  P.task = (id) => P.state.tasks.find((t) => t.id === id);
  P.project = (id) => P.state.projects.find((p) => p.id === id);
  P.session = (id) => P.state.sessions.find((s) => s.id === id);
  P.appt = (id) => P.state.appointments.find((a) => a.id === id);
  P.isOpen = (t) => t && t.status === 'open' && !t.archived;
  P.isSeries = (t) => !!(t && t.recurrence);
  P.projectName = (id) => { const p = P.project(id); return p ? p.name : ''; };

  P.newTask = (fields = {}) => Object.assign({
    id: P.uid(), title: '', notes: '', projectId: null, priority: 'none', deadline: null, plannedDate: null,
    estimate: null, nextStep: '', subtasks: [], reminder: null, recurrence: null, effort: null, links: [],
    list: 'inbox', status: 'open', archived: false, createdAt: Date.now(), completedAt: null, archivedAt: null,
  }, fields);

  /* A task leaves the Inbox as soon as it is organised in any way. */
  P.organised = (t) => { if (t.list === 'inbox') t.list = 'active'; };
  P.inboxCheck = (t) => {
    if (t.list === 'inbox' && (t.projectId || t.plannedDate || t.deadline || t.recurrence || P.state.sessions.some((s) => s.taskId === t.id))) t.list = 'active';
  };

  /* ---------- recurrence ---------- */
  P.ruleDays = (r) => (r.freq === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : r.freq === 'weekly' ? [P.dow(r.start)] : r.days || []);
  P.ruleMatches = (r, ds) => ds >= r.start && (!r.end || ds <= r.end) && P.ruleDays(r).includes(P.dow(ds));
  P.occ = (taskId, ds) => P.state.occurrences.find((o) => o.taskId === taskId && o.date === ds);
  P.occursOn = (t, ds) => {
    if (!P.isSeries(t) || t.archived || !P.ruleMatches(t.recurrence, ds)) return false;
    const o = P.occ(t.id, ds);
    return !(o && o.status === 'removed');
  };
  P.occTitle = (t, ds) => { const o = P.occ(t.id, ds); return (o && o.override && o.override.title) || t.title; };
  P.occTime = (t, ds) => {
    const o = P.occ(t.id, ds);
    if (o && o.override && o.override.time !== undefined) return o.override.time;
    return t.recurrence.time;
  };
  P.occDone = (t, ds) => { const o = P.occ(t.id, ds); return o ? o.status : null; };
  P.ruleText = (r) => {
    if (!r) return '';
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let s = r.freq === 'daily' ? 'Every day' : r.freq === 'weekly' ? `Every ${P.DAY_NAMES[P.dow(r.start)]}` :
      (JSON.stringify([...r.days].sort()) === '[1,2,3,4,5]' ? 'Weekdays' : 'Every ' + [...r.days].sort().map((d) => names[d]).join(', '));
    if (r.time != null) s += ` at ${P.fmtMin(r.time)}`;
    return s;
  };
  P.setOcc = (taskId, ds, patch) => {
    let o = P.occ(taskId, ds);
    if (!o) { o = { id: P.uid(), taskId, date: ds, status: 'open', at: null, override: null }; P.state.occurrences.push(o); }
    Object.assign(o, patch);
    if (o.status === 'open' && !o.override) P.state.occurrences = P.state.occurrences.filter((x) => x !== o);
    return o;
  };
  /* "This and future": end the old series the day before and start a new one with the changes. */
  P.splitSeries = (t, ds, changes) => {
    if (ds <= t.recurrence.start) { Object.assign(t, changes); return t; }
    const n = P.clone(t);
    n.id = P.uid(); n.createdAt = Date.now();
    n.recurrence.start = ds;
    if (t.recurrence.end && t.recurrence.end < ds) n.recurrence.end = null;
    Object.assign(n, changes);
    if (changes.recurrence) n.recurrence = Object.assign({}, n.recurrence, changes.recurrence, { start: changes.recurrence.start || ds });
    t.recurrence.end = P.addDays(ds, -1);
    for (const o of P.state.occurrences) if (o.taskId === t.id && o.date >= ds) o.taskId = n.id;
    P.state.tasks.push(n);
    return n;
  };
  P.missedOccurrences = () => {
    const today = P.today(), out = [];
    for (const t of P.state.tasks) {
      if (!P.isSeries(t) || t.archived) continue;
      for (let k = 1; k <= 14; k++) {
        const d = P.addDays(today, -k);
        if (d < t.recurrence.start) break;
        if (P.occursOn(t, d) && !P.occDone(t, d)) out.push({ task: t, date: d });
      }
    }
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  };

  /* ---------- day contents ---------- */
  function clip(start, end, ds) {
    const d0 = P.dayStart(ds), d1 = P.dayEnd(ds);
    const s = Math.max(start, d0), e = Math.min(end, d1);
    if (e <= s) return null;
    return [s === d0 ? 0 : P.local(s).min, e === d1 ? 1440 : P.local(e).min || 1440];
  }
  P.clip = clip;
  /* Every timed item on a day, each with local minute range [s,e]. */
  P.timedOn = (ds) => {
    const out = [];
    for (const a of P.state.appointments) {
      const r = clip(a.start, a.end, ds);
      if (r && !a.cancelled) out.push({ kind: a.source === 'ics' ? 'imported' : 'appointment', id: a.id, appt: a, title: a.title, start: a.start, end: a.end, s: r[0], e: r[1] });
    }
    for (const se of P.state.sessions) {
      const r = clip(se.start, se.end, ds);
      const t = P.task(se.taskId);
      if (r && t && !t.archived) out.push({ kind: 'session', id: se.id, session: se, task: t, title: t.title, start: se.start, end: se.end, s: r[0], e: r[1] });
    }
    for (const t of P.state.tasks) {
      if (!P.isSeries(t) || !P.occursOn(t, ds)) continue;
      const time = P.occTime(t, ds);
      if (time == null) continue;
      const dur = t.recurrence.duration || 30;
      const start = P.toMs(ds, time), end = start + dur * P.MIN;
      out.push({ kind: 'routine', id: t.id + '@' + ds, task: t, date: ds, title: P.occTitle(t, ds), start, end, s: time, e: Math.min(1440, time + dur), status: P.occDone(t, ds) });
    }
    return out.sort((a, b) => a.s - b.s || a.e - b.e);
  };
  P.deadlinesOn = (ds) => P.state.tasks.filter((t) => P.isOpen(t) && t.deadline && t.deadline.date === ds);
  P.flexibleOn = (ds) => {
    const sessIds = new Set(P.state.sessions.filter((s) => clip(s.start, s.end, ds)).map((s) => s.taskId));
    const out = [];
    for (const t of P.state.tasks) {
      if (!P.isOpen(t) || t.list === 'someday') continue;
      if (P.isSeries(t)) {
        if (P.occursOn(t, ds) && P.occTime(t, ds) == null && !P.occDone(t, ds)) out.push({ kind: 'occ', task: t, date: ds });
      } else if (t.plannedDate === ds && !sessIds.has(t.id)) out.push({ kind: 'task', task: t });
    }
    const pr = { high: 0, medium: 1, low: 2, none: 3 };
    return out.sort((a, b) => pr[a.task.priority] - pr[b.task.priority] || a.task.createdAt - b.task.createdAt);
  };
  P.completedOn = (ds) => {
    const out = [];
    for (const t of P.state.tasks) {
      if (!P.isSeries(t) && t.status === 'done' && t.completedAt && P.local(t.completedAt).date === ds) out.push({ kind: 'task', task: t });
    }
    for (const o of P.state.occurrences) {
      if (o.date === ds && o.status === 'done') { const t = P.task(o.taskId); if (t) out.push({ kind: 'occ', task: t, date: ds }); }
    }
    return out;
  };
  P.earlierPlanned = (ds) => P.state.tasks.filter((t) => P.isOpen(t) && !P.isSeries(t) && t.list !== 'someday' && t.plannedDate && t.plannedDate < ds);

  /* ---------- planning hours and free time ---------- */
  P.windowFor = (ds) => { const h = P.state.prefs.hours[P.dow(ds)]; return h && h.on && h.end > h.start ? [h.start, h.end] : null; };
  P.dayInfo = (ds, opts = {}) => {
    const win = opts.window || P.windowFor(ds);
    const items = P.timedOn(ds).filter((i) => !(opts.exclude && opts.exclude(i)));
    const buffer = P.state.prefs.buffer || 0;
    const occupied = P.union(items.map((i) => [i.s, i.e]));
    const bufs = items.filter((i) => i.kind === 'appointment' || i.kind === 'imported').map((i) => [i.e, i.e + buffer]);
    const breaks = win ? P.state.prefs.breaks.map((b) => [b.start, b.end]) : [];
    let base = win ? [win] : [];
    if (opts.from != null) base = P.subtract(base, [[0, opts.from]]);
    const free = P.subtract(base, [...occupied, ...breaks, ...bufs]);
    const total = P.sumIv(free);
    const gaps = free.filter((g) => g[1] - g[0] >= 15);
    const planned = win ? P.sumIv(P.subtract(occupied, P.subtract([[0, 1440]], [win]))) : 0;
    return { win, items, occupied, breaks, free, total, gaps, planned, available: win ? P.sumIv(P.subtract([win], breaks)) : 0 };
  };

  /* Overlaps, breaks and planning hours for a proposed timed block. */
  P.conflictsFor = (start, end, ignoreId) => {
    const out = [];
    const ds = P.local(start).date;
    const r = clip(start, end, ds) || [0, 0];
    for (const i of P.timedOn(ds)) {
      if (i.id === ignoreId) continue;
      if (P.overlaps(start, end, i.start, i.end)) out.push(`Overlaps ${i.kind === 'session' ? 'session' : i.kind === 'routine' ? 'routine' : 'appointment'} “${i.title}” (${P.fmtRange(i.start, i.end)})`);
    }
    const win = P.windowFor(ds);
    if (win) {
      for (const b of P.state.prefs.breaks) if (P.overlaps(r[0], r[1], b.start, b.end)) out.push(`Overlaps your ${b.label.toLowerCase()} break (${P.fmtMin(b.start)}–${P.fmtMin(b.end)})`);
      if (r[0] < win[0] || r[1] > win[1]) out.push(`Outside planning hours (${P.fmtMin(win[0])}–${P.fmtMin(win[1])})`);
    } else out.push(`${P.DAY_NAMES[P.dow(ds)]} isn’t a planning day`);
    return out;
  };
  P.deadlineMs = (t) => {
    if (!t || !t.deadline) return null;
    return t.deadline.time != null ? P.toMs(t.deadline.date, t.deadline.time) : P.dayEnd(t.deadline.date);
  };
  P.afterDeadline = (se) => { const t = P.task(se.taskId); const d = P.deadlineMs(t); return d != null && se.end > d; };
  P.sessionFlags = (se) => {
    const f = [];
    if (P.afterDeadline(se)) f.push('After deadline');
    if (se.keepConflict && P.conflictsFor(se.start, se.end, se.id).length) f.push('Conflict kept');
    return f;
  };
  P.futureSessions = (taskId) => P.state.sessions.filter((s) => s.taskId === taskId && s.start >= Date.now());
  P.taskSessions = (taskId) => P.state.sessions.filter((s) => s.taskId === taskId).sort((a, b) => a.start - b.start);
  P.focusFor = (taskId) => P.state.focus.filter((f) => f.taskId === taskId).reduce((a, f) => a + f.sec, 0);
  P.activeSession = () => {
    const now = Date.now();
    return P.state.sessions.find((s) => s.start <= now && s.end > now && P.isOpen(P.task(s.taskId)));
  };
})();
