'use strict';
/* Tasks: Inbox, All tasks, Projects and Someday. */
(function () {
  const TABS = [['inbox', 'Inbox', 'inbox'], ['all', 'All tasks', 'tasks'], ['projects', 'Projects', 'folder'], ['someday', 'Someday', 'someday']];
  P.views.tasks = (r) => {
    const sub = r.sub === 'project' ? 'projects' : (TABS.find((t) => t[0] === r.sub) ? r.sub : 'inbox');
    const counts = {
      inbox: P.state.tasks.filter((t) => P.isOpen(t) && t.list === 'inbox').length,
      someday: P.state.tasks.filter((t) => P.isOpen(t) && t.list === 'someday').length,
      all: P.state.tasks.filter((t) => P.isOpen(t) && t.list !== 'someday').length,
      projects: P.state.projects.filter((p) => p.status === 'active').length,
    };
    let body = '';
    if (r.sub === 'project') body = projectDetail(r.id);
    else if (sub === 'inbox') body = inbox();
    else if (sub === 'all') body = allTasks();
    else if (sub === 'projects') body = projects();
    else body = someday();
    return `<div class="page tasks">
      <header class="page-h"><div><p class="pt-eyebrow">Tasks</p><h1 class="title-1">${r.sub === 'project' ? P.esc(P.projectName(r.id) || 'Project') : TABS.find((t) => t[0] === sub)[1]}</h1></div>
        <button class="pt-btn pt-btn--primary" data-act="quickAdd" ${sub === 'someday' ? 'data-list="someday"' : ''} ${r.sub === 'project' ? `data-project="${r.id}"` : ''}>${P.ico('plus')}Add task</button></header>
      <nav class="tabs" aria-label="Task views">${TABS.map(([k, l, i]) => `<a href="#tasks-${k}" ${sub === k ? 'aria-current="page"' : ''}>${P.ico(i, 'pt-ico--sm')}${l}<span class="count">${counts[k]}</span></a>`).join('')}</nav>
      ${body}
    </div>`;
  };

  function inbox() {
    const list = P.state.tasks.filter((t) => P.isOpen(t) && t.list === 'inbox').sort((a, b) => b.createdAt - a.createdAt);
    if (!list.length) return P.h.empty('Your Inbox is clear', 'New tasks with only a title land here until you organise them.', `<button class="pt-btn pt-btn--primary" data-act="quickAdd">${P.ico('plus')}Add task</button>`);
    return `<p class="pt-muted body-sm">Give each task a project, a day or a session, or move it to Someday. It leaves the Inbox without making a copy.</p>
      <div class="pt-card list">${list.map((t) => `<div class="inbox-item">${P.h.taskRow(t)}
        <div class="inbox-acts" role="group" aria-label="Organise ${P.esc(t.title)}">
          <label class="mini"><span class="sr">Project</span><select data-chg="inboxProject" data-id="${t.id}" aria-label="Assign project to ${P.esc(t.title)}">${P.h.projectOpts('', 'Assign project')}${'<option value="__new">New project…</option>'}</select></label>
          <label class="mini"><span class="sr">Plan for a day</span><input type="date" data-chg="inboxPlan" data-id="${t.id}" aria-label="Plan ${P.esc(t.title)} for a day"></label>
          <button class="pt-btn pt-btn--quiet sm" data-act="newSession" data-task="${t.id}">${P.ico('calendarPlus', 'pt-ico--sm')}Schedule</button>
          <button class="pt-btn pt-btn--quiet sm" data-act="someday" data-id="${t.id}">${P.ico('someday', 'pt-ico--sm')}Someday</button>
          <button class="pt-btn pt-btn--danger sm" data-act="delTask" data-id="${t.id}" aria-label="Delete ${P.esc(t.title)}">${P.ico('trash', 'pt-ico--sm')}</button>
        </div></div>`).join('')}</div>`;
  }
  P.chg.inboxProject = async (el) => {
    const t = P.task(el.dataset.id);
    let v = el.value;
    if (v === '__new') { const id = await P.newProjectDialog(); if (!id) { el.value = ''; return; } v = id; }
    if (!v) return;
    P.commit(`Moved “${t.title}” to ${P.projectName(v)}.`, () => { t.projectId = v; P.organised(t); });
  };
  P.chg.inboxPlan = (el) => { if (!el.value) return; const t = P.task(el.dataset.id); P.commit(`Planned “${t.title}” for ${P.relDate(el.value).toLowerCase()}. No time reserved.`, () => { t.plannedDate = el.value; P.organised(t); }); };

  function allTasks() {
    const f = P.ui.tasks;
    const today = P.today();
    let list = P.state.tasks.filter((t) => {
      if (t.archived && !f.showArchived) return false;
      if (t.status === 'done' && !f.showDone) return false;
      if (t.list === 'someday' && !t.archived && t.status !== 'done') return false;
      if (f.project === '__none' ? t.projectId : f.project && t.projectId !== f.project) return false;
      if (f.priority && t.priority !== f.priority) return false;
      if (f.deadline === 'has' && !t.deadline) return false;
      if (f.deadline === 'week' && !(t.deadline && P.diffDays(today, t.deadline.date) <= 7)) return false;
      if (f.deadline === 'none' && t.deadline) return false;
      if (f.planned === 'planned' && !t.plannedDate) return false;
      if (f.planned === 'unplanned' && t.plannedDate) return false;
      if (f.q) { const q = f.q.toLowerCase(); if (!(t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q))) return false; }
      return true;
    });
    const pr = { high: 0, medium: 1, low: 2, none: 3 };
    const sorters = {
      created: (a, b) => b.createdAt - a.createdAt,
      deadline: (a, b) => (a.deadline ? a.deadline.date : '9999').localeCompare(b.deadline ? b.deadline.date : '9999'),
      planned: (a, b) => (a.plannedDate || '9999').localeCompare(b.plannedDate || '9999'),
      priority: (a, b) => pr[a.priority] - pr[b.priority],
      title: (a, b) => a.title.localeCompare(b.title),
    };
    list.sort(sorters[f.sort] || sorters.created);
    const anyFilter = f.project || f.priority || f.deadline || f.planned || f.q;
    return `<form class="filters" data-sub="noop" role="search" aria-label="Filter tasks">
      <div class="pt-input grow">${P.ico('search')}<input type="search" placeholder="Filter by title or notes" aria-label="Filter by title or notes" value="${P.esc(f.q)}" data-inp="tfil" data-f="q" data-k="tfil-q"></div>
      <select aria-label="Project" data-chg="tfil" data-f="project">${P.h.opts([['', 'All projects'], ['__none', 'No project'], ...P.state.projects.map((p) => [p.id, p.name])], f.project)}</select>
      <select aria-label="Priority" data-chg="tfil" data-f="priority">${P.h.opts([['', 'Any priority'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low'], ['none', 'None']], f.priority)}</select>
      <select aria-label="Deadline" data-chg="tfil" data-f="deadline">${P.h.opts([['', 'Any deadline'], ['has', 'Has a deadline'], ['week', 'Due within 7 days'], ['none', 'No deadline']], f.deadline)}</select>
      <select aria-label="Planned date" data-chg="tfil" data-f="planned">${P.h.opts([['', 'Planned or not'], ['planned', 'Has a planned day'], ['unplanned', 'No planned day']], f.planned)}</select>
      <select aria-label="Sort" data-chg="tfil" data-f="sort">${P.h.opts([['created', 'Newest first'], ['deadline', 'By deadline'], ['planned', 'By planned day'], ['priority', 'By priority'], ['title', 'By title']], f.sort)}</select>
      <label class="switch"><input type="checkbox" ${f.showDone ? 'checked' : ''} data-chg="tfil" data-f="showDone"><span>Show completed</span></label>
      <label class="switch"><input type="checkbox" ${f.showArchived ? 'checked' : ''} data-chg="tfil" data-f="showArchived"><span>Show archived</span></label>
    </form>
    <p class="pt-muted body-sm" aria-live="polite">${P.plural(list.length, 'task')}${anyFilter ? ' match' : ''}. Someday tasks are in their own view.</p>
    ${list.length ? `<div class="pt-card list">${list.map((t) => P.h.taskRow(t, { planned: true, sessions: true })).join('')}</div>` : P.h.empty('No tasks here', anyFilter ? 'Try clearing a filter.' : 'Add a task to get started.', anyFilter ? `<button class="pt-btn pt-btn--secondary" data-act="clearFilters">Clear filters</button>` : `<button class="pt-btn pt-btn--primary" data-act="quickAdd">${P.ico('plus')}Add task</button>`)}`;
  }
  P.inp.tfil = (el) => { P.ui.tasks[el.dataset.f] = el.value; P.render(); };
  P.chg.tfil = (el) => { P.ui.tasks[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; P.render(); };
  P.act.clearFilters = () => { Object.assign(P.ui.tasks, { project: '', priority: '', deadline: '', planned: '', q: '' }); P.render(); };
  P.sub.noop = () => {};

  function projects() {
    const all = P.state.projects;
    const active = all.filter((p) => p.status === 'active');
    const closed = all.filter((p) => p.status !== 'active');
    const card = (p) => {
      const c = P.projectCounts(p.id);
      return `<a class="pt-card proj" href="#tasks-project-${p.id}"><h3 class="title-3">${P.ico('folder', 'pt-ico--sm')} ${P.esc(p.name)}</h3>
        ${p.outcome ? `<p class="pt-muted body-sm">${P.esc(p.outcome)}</p>` : ''}
        <p class="body-sm">${c.total ? `${c.done} of ${P.plural(c.total, 'task')} completed` : 'No tasks yet'}</p>
        <span class="pt-task__meta">${p.deadline ? P.h.chip(`Due ${P.relDate(p.deadline)}`, 'flag', 'pt-chip--deadline') : ''}${p.status !== 'active' ? P.h.chip(p.status === 'done' ? 'Completed' : 'Archived', p.status === 'done' ? 'check' : 'archive') : ''}</span></a>`;
    };
    return `<div class="pt-row"><button class="pt-btn pt-btn--secondary" data-act="newProject">${P.ico('plus')}New project</button></div>
      ${active.length ? `<div class="cards">${active.map(card).join('')}</div>` : P.h.empty('No projects yet', 'A project groups tasks around an outcome, like “Pass the stats exam”.', `<button class="pt-btn pt-btn--primary" data-act="newProject">${P.ico('plus')}New project</button>`)}
      ${closed.length ? `<details class="done-sec"><summary><h2 class="pt-section-h">Completed and archived <small>${closed.length}</small></h2></summary><div class="cards">${closed.map(card).join('')}</div></details>` : ''}
      <p class="pt-muted body-sm">Counts show tasks, not effort. Some tasks are bigger than others.</p>`;
  }
  function projectDetail(id) {
    const p = P.project(id);
    if (!p) return P.h.empty('Project not found', 'It may have been deleted.', '<a class="pt-btn pt-btn--secondary" href="#tasks-projects">Back to projects</a>');
    const ts = P.state.tasks.filter((t) => t.projectId === id);
    const open = ts.filter((t) => P.isOpen(t));
    const done = ts.filter((t) => t.status === 'done');
    const arch = ts.filter((t) => t.archived && t.status !== 'done');
    const c = P.projectCounts(id);
    return `<p><a class="linkbtn" href="#tasks-projects">${P.ico('left', 'pt-ico--sm')} All projects</a></p>
      <div class="proj-grid">
      <section class="pt-card stack" aria-label="Project details">
        ${P.fld('Name', `<input value="${P.esc(p.name)}" data-chg="projField" data-f="name" data-id="${p.id}">`)}
        ${P.fld('Outcome', `<input value="${P.esc(p.outcome)}" data-chg="projField" data-f="outcome" data-id="${p.id}" placeholder="What does done look like?">`)}
        ${P.fld('Deadline (optional)', `<input type="date" value="${P.esc(p.deadline || '')}" data-chg="projField" data-f="deadline" data-id="${p.id}">`)}
        ${P.fld('Notes', `<textarea rows="4" data-chg="projField" data-f="notes" data-id="${p.id}">${P.esc(p.notes)}</textarea>`)}
        <p class="body-sm">${c.total ? `${c.done} of ${P.plural(c.total, 'task')} completed` : 'No tasks yet'}. This counts tasks, not effort.</p>
        <div class="pt-row">${p.status === 'active' ? `<button class="pt-btn pt-btn--secondary" data-act="projClose" data-id="${p.id}" data-mode="done">${P.ico('check')}Complete project</button><button class="pt-btn pt-btn--secondary" data-act="projClose" data-id="${p.id}" data-mode="archive">${P.ico('archive')}Archive</button>` : `<button class="pt-btn pt-btn--secondary" data-act="projReopen" data-id="${p.id}">${P.ico('reopen')}Reopen project</button>`}</div>
      </section>
      <div class="stack-lg">
        <section class="stack-sm" aria-labelledby="po-h"><h2 class="pt-section-h" id="po-h">Open tasks <small>${open.length}</small></h2>
          ${open.length ? `<div class="pt-card list">${open.map((t) => P.h.taskRow(t, { noProject: true, planned: true, sessions: true })).join('')}</div>` : '<p class="pt-muted">No open tasks.</p>'}
          <button class="pt-btn pt-btn--quiet left" data-act="quickAdd" data-project="${p.id}">${P.ico('plus')}Add a task to this project</button></section>
        ${done.length ? `<details class="done-sec"><summary><h2 class="pt-section-h">Completed <small>${done.length}</small></h2></summary><div class="pt-card list">${done.map((t) => P.h.taskRow(t, { noProject: true })).join('')}</div></details>` : ''}
        ${arch.length ? `<details class="done-sec"><summary><h2 class="pt-section-h">Archived <small>${arch.length}</small></h2></summary><div class="pt-card list">${arch.map((t) => P.h.taskRow(t, { noProject: true })).join('')}</div></details>` : ''}
      </div></div>`;
  }
  P.chg.projField = (el) => {
    const p = P.project(el.dataset.id); const f = el.dataset.f;
    if (f === 'name' && !el.value.trim()) { el.value = p.name; P.toast('A project needs a name.'); return; }
    P.commit('Project saved.', () => { p[f] = f === 'deadline' ? (el.value || null) : el.value.trim(); }, { toast: false });
  };
  P.act.projClose = (el) => P.closeProject(el.dataset.id, el.dataset.mode);
  P.act.projReopen = (el) => P.reopenProject(el.dataset.id);

  P.newProjectDialog = () => new Promise((resolve) => { P.open('project', { resolve, onClose: () => resolve(null) }); });
  P.act.newProject = () => P.newProjectDialog().then((id) => { if (id && P.route().name === 'tasks') P.go('#tasks-project-' + id); });
  P.ov.project = {
    type: 'dialog', live: false, title: () => 'New project',
    render: () => `<form data-sub="project" id="pjForm" class="stack" novalidate>
      ${P.fld('Name', '<input name="name" required autofocus autocomplete="off">')}
      ${P.fld('Outcome', '<input name="outcome" placeholder="What does done look like?">')}
      ${P.fld('Deadline (optional)', '<input name="deadline" type="date">')}
      ${P.fld('Notes (optional)', '<textarea name="notes" rows="2"></textarea>')}
      <p class="fld__h err" id="pjErr" aria-live="polite"></p></form>`,
    foot: (p, o) => `<button class="pt-btn pt-btn--secondary" data-act="closeOv" data-ov-id="${o.id}">Cancel</button><button class="pt-btn pt-btn--primary" type="submit" form="pjForm">Create project</button>`,
  };
  P.sub.project = (f) => {
    const o = P.top();
    const name = f.name.value.trim();
    if (!name) { document.getElementById('pjErr').textContent = 'Add a name to create the project.'; f.name.focus(); return; }
    const id = P.saveProject({ name, outcome: f.outcome.value.trim(), deadline: f.deadline.value || null, notes: f.notes.value.trim() });
    if (o.props.resolve) o.props.resolve(id);
    P.close(o.id);
  };

  function someday() {
    const list = P.state.tasks.filter((t) => P.isOpen(t) && t.list === 'someday');
    if (!list.length) return P.h.empty('Nothing in Someday', 'Move tasks here when you want them out of Today and suggestions for now.', `<button class="pt-btn pt-btn--secondary" data-act="quickAdd" data-list="someday">${P.ico('plus')}Add to Someday</button>`);
    return `<p class="pt-muted body-sm">These stay out of Today and suggestions until you make them active or give them a day.</p>
      <div class="pt-card list">${list.map((t) => P.h.taskRow(t, { trailing: `<span class="row-acts"><button class="pt-btn pt-btn--quiet sm" data-act="activate" data-id="${t.id}">Make active</button><button class="pt-btn pt-btn--quiet sm" data-act="planQuick" data-id="${t.id}" data-d="0">Plan today</button></span>` })).join('')}</div>`;
  }
})();
