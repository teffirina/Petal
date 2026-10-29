'use strict';
/* Task, session and appointment operations. Each mutation is one commit with undo where it matters. */
(function () {
  /* ---------- tasks ---------- */
  P.addTask = (fields, session) => {
    let created = null;
    const ok = P.commit(`Added “${fields.title}”.`, (s) => {
      const t = P.newTask(fields);
      if (t.recurrence && !t.recurrence.start) t.recurrence.start = t.plannedDate || P.today();
      if (t.recurrence) t.plannedDate = null;
      s.tasks.push(t);
      if (session) s.sessions.push({ id: P.uid(), taskId: t.id, start: session.start, end: session.end, keepConflict: !!session.keepConflict, createdAt: Date.now() });
      P.inboxCheck(t);
      created = t;
    }, { action: { label: 'Open', fn: () => created && P.openTask(created.id) } });
    return ok === false ? null : created;
  };

  P.completeTask = async (id) => {
    const t = P.task(id);
    if (!t || t.status === 'done') return;
    const future = P.futureSessions(id);
    let remove = false;
    if (future.length) {
      const v = await P.ask({
        title: 'Complete task',
        body: `<p>“${P.esc(t.title)}” has ${P.plural(future.length, 'upcoming work session')}. Remove ${future.length === 1 ? 'it' : 'them'}? Past sessions and focus records stay.</p>`,
        buttons: [{ label: 'Keep sessions', value: 'keep' }, { label: 'Remove and complete', value: 'remove', kind: 'primary' }],
      });
      if (!v) return;
      remove = v === 'remove';
    }
    P.commit(`Completed “${t.title}”.`, (s) => {
      const x = P.task(id);
      x.status = 'done'; x.completedAt = Date.now();
      if (remove) { const ids = new Set(future.map((f) => f.id)); s.sessions = s.sessions.filter((se) => !ids.has(se.id)); }
      if (P.ui.suggestPick === id) P.ui.suggestPick = null;
    });
  };
  P.reopenTask = (id) => {
    const t = P.task(id);
    P.commit(`Reopened “${t.title}”.`, () => { t.status = 'open'; t.completedAt = null; });
  };
  P.act.toggleTask = (el) => {
    const t = P.task(el.dataset.id);
    if (!t) return;
    if (t.status === 'done') P.reopenTask(t.id); else P.completeTask(t.id);
  };
  P.act.toggleOcc = (el) => {
    const t = P.task(el.dataset.id), ds = el.dataset.date;
    const st = P.occDone(t, ds);
    const done = !!st;
    P.commit(done ? `Marked “${P.occTitle(t, ds)}” as open for ${P.relDate(ds).toLowerCase()}.` : `Done: “${P.occTitle(t, ds)}” for ${P.relDate(ds).toLowerCase()}. Other days are unchanged.`, () => {
      P.setOcc(t.id, ds, done ? { status: 'open', at: null } : { status: 'done', at: Date.now() });
    });
  };
  P.skipOcc = (id, ds) => {
    const t = P.task(id);
    P.commit(`Skipped “${P.occTitle(t, ds)}” for ${P.relDate(ds).toLowerCase()}.`, () => P.setOcc(id, ds, { status: 'skipped', at: Date.now() }));
  };

  P.duplicateTask = (id) => {
    const t = P.task(id);
    let n;
    P.commit(`Duplicated “${t.title}”.`, (s) => {
      n = P.clone(t);
      Object.assign(n, { id: P.uid(), title: t.title + ' (copy)', status: 'open', completedAt: null, archived: false, archivedAt: null, createdAt: Date.now(), reminder: null });
      n.subtasks = n.subtasks.map((st) => ({ id: P.uid(), title: st.title, done: false, doneAt: null }));
      if (n.recurrence) n.recurrence.start = P.today();
      s.tasks.push(n);
    }, { action: { label: 'Open copy', fn: () => P.openTask(n.id) } });
  };
  P.archiveTask = (id, on = true) => {
    const t = P.task(id);
    P.commit(on ? `Archived “${t.title}”.` : `Restored “${t.title}”.`, () => { t.archived = on; t.archivedAt = on ? Date.now() : null; });
  };
  P.deleteTask = async (id) => {
    const t = P.task(id);
    const n = P.taskSessions(id).length;
    const v = await P.ask({
      title: 'Delete task',
      body: `<p>Delete “${P.esc(t.title)}”${n ? ` and its ${P.plural(n, 'work session')}` : ''}? Recorded focus time stays in Progress. You can undo right after.</p>`,
      buttons: [{ label: 'Cancel', value: null }, { label: 'Delete', value: 'yes', kind: 'danger' }],
    });
    if (!v) return;
    P.stack.filter((o) => o.kind === 'task' && o.props.id === id).forEach((o) => P.close(o.id));
    P.commit(`Deleted “${t.title}”.`, (s) => {
      s.tasks = s.tasks.filter((x) => x.id !== id);
      s.sessions = s.sessions.filter((x) => x.taskId !== id);
      for (const f of s.focus) if (f.taskId === id) f.taskTitle = f.taskTitle || t.title;
    });
  };
  P.planFor = (id, ds) => {
    const t = P.task(id);
    P.commit(ds ? `Planned “${t.title}” for ${P.relDate(ds).toLowerCase()}. No time reserved.` : `Removed the planned day from “${t.title}”.`, () => {
      t.plannedDate = ds; if (ds && t.list === 'someday') t.list = 'active'; P.inboxCheck(t);
    });
  };
  P.moveToSomeday = (id) => {
    const t = P.task(id);
    P.commit(`Moved “${t.title}” to Someday.`, () => { t.list = 'someday'; t.plannedDate = null; });
  };
  P.activateTask = (id) => {
    const t = P.task(id);
    P.commit(`Moved “${t.title}” back to active tasks.`, () => { t.list = 'active'; });
  };

  /* ---------- subtasks ---------- */
  P.toggleSubtask = (tid, sid) => {
    const t = P.task(tid);
    const st = t.subtasks.find((x) => x.id === sid);
    P.commit(st.done ? 'Step reopened.' : 'Step done.', () => { st.done = !st.done; st.doneAt = st.done ? Date.now() : null; }, { toast: false });
    if (st.done && t.status === 'open' && t.subtasks.every((x) => x.done)) {
      P.toast('All steps are done. Complete the task too?', { action: { label: 'Complete task', fn: () => P.completeTask(t.id) } });
    }
  };

  /* ---------- sessions ---------- */
  /* Confirms conflicts explicitly. Resolves true when the person keeps the time. */
  P.checkConflicts = async (start, end, ignoreId, taskId) => {
    const c = P.conflictsFor(start, end, ignoreId);
    const t = P.task(taskId);
    const dl = P.deadlineMs(t);
    const warn = dl != null && end > dl ? [`Ends after the deadline (${P.h.deadlineText(t)})`] : [];
    if (!c.length && !warn.length) return { ok: true, keep: false };
    const v = await P.ask({
      title: c.length ? 'This time has a conflict' : 'This session is after the deadline',
      body: `<ul class="warn-list">${[...c, ...warn].map((x) => `<li>${P.ico('alert', 'pt-ico--sm')}${P.esc(x)}</li>`).join('')}</ul><p class="pt-muted">Keep it anyway, or go back and pick another time.</p>`,
      buttons: [{ label: 'Change time', value: 'change' }, { label: 'Keep anyway', value: 'keep', kind: 'primary' }],
    });
    return { ok: v === 'keep', keep: c.length > 0 };
  };
  P.saveSession = async ({ id, taskId, start, end }) => {
    if (!(end > start)) { P.toast('End time must be after the start.'); return false; }
    const chk = await P.checkConflicts(start, end, id, taskId);
    if (!chk.ok) return false;
    const t = P.task(taskId);
    if (id) {
      const se = P.session(id);
      const moved = se.start !== start || se.end !== end;
      P.commit(moved ? `Moved session for “${t.title}” to ${P.relDate(P.local(start).date).toLowerCase()} ${P.fmtRange(start, end)}. Deadline unchanged.` : 'Session saved.', () => {
        Object.assign(se, { start, end, keepConflict: chk.keep, taskId });
      });
    } else {
      P.commit(`Scheduled “${t.title}” ${P.relDate(P.local(start).date).toLowerCase()} ${P.fmtRange(start, end)}.`, (s) => {
        s.sessions.push({ id: P.uid(), taskId, start, end, keepConflict: chk.keep, createdAt: Date.now() });
        P.inboxCheck(t);
      });
    }
    return true;
  };
  P.removeSession = (id) => {
    const se = P.session(id), t = P.task(se.taskId);
    P.commit(`Removed a session. “${t.title}” is still in your tasks.`, (s) => { s.sessions = s.sessions.filter((x) => x.id !== id); });
  };

  /* ---------- appointments ---------- */
  P.saveAppt = async (a) => {
    if (!a.title.trim()) { P.toast('Add a title for the appointment.'); return false; }
    if (!(a.end > a.start)) { P.toast('End time must be after the start.'); return false; }
    const c = P.conflictsFor(a.start, a.end, a.id).filter((x) => x.startsWith('Overlaps'));
    if (c.length) {
      const v = await P.ask({ title: 'This appointment overlaps', body: `<ul class="warn-list">${c.map((x) => `<li>${P.ico('alert', 'pt-ico--sm')}${P.esc(x)}</li>`).join('')}</ul>`, buttons: [{ label: 'Change time', value: null }, { label: 'Keep anyway', value: 'keep', kind: 'primary' }] });
      if (!v) return false;
    }
    P.commit(a.id ? `Saved “${a.title}”.` : `Added appointment “${a.title}”.`, (s) => {
      if (a.id) Object.assign(P.appt(a.id), a);
      else s.appointments.push(Object.assign({ id: P.uid(), source: 'petal', createdAt: Date.now() }, a));
    });
    return true;
  };
  P.deleteAppt = (id) => {
    const a = P.appt(id);
    P.commit(`Deleted appointment “${a.title}”.`, (s) => { s.appointments = s.appointments.filter((x) => x.id !== id); });
  };

  /* ---------- projects ---------- */
  P.saveProject = (p) => {
    let id = p.id;
    P.commit(p.id ? `Saved project “${p.name}”.` : `Created project “${p.name}”.`, (s) => {
      if (p.id) Object.assign(P.project(p.id), p);
      else { id = P.uid(); s.projects.push(Object.assign({ id, outcome: '', deadline: null, notes: '', status: 'active', createdAt: Date.now(), completedAt: null, archivedAt: null }, p)); }
    });
    return id;
  };
  P.closeProject = async (id, mode) => {
    const p = P.project(id);
    const open = P.state.tasks.filter((t) => t.projectId === id && P.isOpen(t));
    let choice = 'keep';
    if (open.length) {
      const others = P.state.projects.filter((x) => x.id !== id && x.status === 'active');
      choice = await P.ask({
        title: mode === 'done' ? 'Complete project' : 'Archive project',
        body: `<p>“${P.esc(p.name)}” still has ${P.plural(open.length, 'open task')}. What should happen to ${open.length === 1 ? 'it' : 'them'}?</p>
          ${others.length ? `<label class="fld"><span>Move to</span><select id="moveTarget">${P.h.opts([['', 'No project'], ...others.map((o) => [o.id, o.name])], '')}</select></label>` : ''}`,
        buttons: [
          { label: 'Keep active in this project', value: 'keep' },
          { label: others.length ? 'Move to selected' : 'Move out of project', value: 'move' },
          { label: 'Archive with project', value: 'archive', kind: 'primary' },
        ],
      });
      if (!choice) return;
    }
    const target = (document.getElementById('moveTarget') || {}).value || null;
    P.commit(mode === 'done' ? `Completed project “${p.name}”.` : `Archived project “${p.name}”. History is kept.`, () => {
      p.status = mode === 'done' ? 'done' : 'archived';
      if (mode === 'done') p.completedAt = Date.now(); else p.archivedAt = Date.now();
      for (const t of open) {
        if (choice === 'move') t.projectId = target;
        if (choice === 'archive') { t.archived = true; t.archivedAt = Date.now(); }
      }
    });
  };
  P.reopenProject = (id) => { const p = P.project(id); P.commit(`Reopened project “${p.name}”.`, () => { p.status = 'active'; p.completedAt = null; p.archivedAt = null; }); };
  P.projectCounts = (id) => {
    const ts = P.state.tasks.filter((t) => t.projectId === id && !P.isSeries(t) && (!t.archived || t.status === 'done'));
    return { done: ts.filter((t) => t.status === 'done').length, total: ts.length };
  };

  /* ---------- data export / import ---------- */
  P.act.exportData = async () => {
    const json = JSON.stringify(Object.assign({ exportedAt: new Date().toISOString(), app: 'Petal' }, P.state), null, 2);
    const filename = `petal-backup-${P.today()}.json`;
    let dl = null;
    try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
    if (dl) {
      try { await dl.save({ filename, data: json }); P.toast('Backup saved.'); }
      catch (e) { P.toast(e && e.code === 'declined' ? 'Export cancelled.' : 'Couldn’t save the backup here. Try again in a moment.'); }
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    P.toast('Backup downloaded.');
  };
})();
