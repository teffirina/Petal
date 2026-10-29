'use strict';
/* Focus sessions. Elapsed time comes from stored timestamps, so refreshing or backgrounding never resets it.
   Breaks and pauses are never counted. Ending a session never completes the task. */
(function () {
  const RECOVER_AFTER = 5 * 60 * 1000;

  const tm = () => P.state.timer;
  P.timerElapsed = (t = tm(), now = Date.now()) => {
    if (!t) return 0;
    const ms = t.segs.reduce((a, s) => a + ((s.e || now) - s.s), 0);
    return Math.max(0, Math.floor(ms / 1000) + (t.adjust || 0));
  };
  /* A countdown stops counting the moment it reaches its target, even if the tab was closed. */
  function settle(now = Date.now()) {
    const t = tm();
    if (!t || t.mode !== 'countdown' || t.status !== 'running') return false;
    const el = P.timerElapsed(t, now);
    if (el < t.target) return false;
    const last = t.segs[t.segs.length - 1];
    last.e = now - (el - t.target) * 1000;
    t.status = 'finished';
    P.save();
    return true;
  }

  P.startFocus = async (taskId, opts = {}) => {
    const cur = tm();
    if (cur) {
      const ct = P.task(cur.taskId);
      const v = await P.ask({
        title: 'A focus session is running',
        body: `<p>You’re focusing on “${P.esc(ct ? ct.title : 'a task')}” (${P.fmtSec(P.timerElapsed())} so far). Only one timer runs at a time.</p>`,
        buttons: [{ label: 'Keep current', value: 'keep' }, { label: 'End it and switch', value: 'switch', kind: 'primary' }],
      });
      if (v !== 'switch') { openFocus(); return; }
      finalize({ silent: true });
    }
    const now = Date.now();
    P.state.timer = {
      id: P.uid(), taskId, occDate: opts.occDate || null, mode: opts.mode || 'countdown',
      target: (opts.minutes || 5) * 60, segs: [{ s: now, e: null }], status: 'running', startedAt: now, heartbeat: now, adjust: 0, intervals: 1,
    };
    P.save(true);
    openFocus();
    P.render();
  };
  function openFocus() {
    if (!P.stack.some((o) => o.kind === 'focus')) P.open('focus', {});
    else P.renderOverlays();
  }
  P.openFocus = openFocus;
  P.act.start5 = (el) => { const t = P.task(el.dataset.id); P.close && P.stack.filter((o) => o.kind === 'choose').forEach((o) => P.close(o.id)); P.startFocus(t.id, { minutes: 5, occDate: el.dataset.date || (P.isSeries(t) ? P.today() : null) }); };
  P.act.focusTask = (el) => {
    const t = P.task(el.dataset.id);
    if (tm() && tm().taskId === t.id) { openFocus(); return; }
    P.open('focusSetup', { id: t.id });
  };
  P.ov.focusSetup = {
    type: 'dialog', title: () => 'Start focus',
    render(p, o) {
      const t = P.task(p.id);
      if (!o.state.mode) { o.state.mode = 'countdown'; o.state.min = P.state.prefs.focusDefault; }
      return `<form data-sub="focusSetup" id="fsForm" class="stack"><p class="title-3">${P.esc(t.title)}</p>
        <div class="pt-seg" role="group" aria-label="Timer type">
          <button type="button" aria-pressed="${o.state.mode === 'countdown'}" data-act="fsMode" data-v="countdown">Countdown</button>
          <button type="button" aria-pressed="${o.state.mode === 'stopwatch'}" data-act="fsMode" data-v="stopwatch">Stopwatch</button></div>
        ${o.state.mode === 'countdown' ? `${P.fld('Minutes', `<input type="number" min="1" max="240" value="${o.state.min}" name="min" inputmode="numeric" data-inp="fsMin">`)}
          <div class="pt-row">${[5, 15, 25, 45].map((m) => `<button type="button" class="pt-btn pt-btn--quiet sm" data-act="fsPreset" data-m="${m}">${m} min</button>`).join('')}</div>` : '<p class="pt-muted body-sm">Counts up until you end it.</p>'}
        </form>`;
    },
    foot: (p, o) => `<button class="pt-btn pt-btn--secondary" data-act="closeOv" data-ov-id="${o.id}">Cancel</button><button class="pt-btn pt-btn--primary" type="submit" form="fsForm">${P.ico('play')}Start</button>`,
  };
  P.act.fsMode = (el) => { const o = P.top(); o.state.mode = el.dataset.v; P.refreshOverlay(o); };
  P.act.fsPreset = (el) => { const o = P.top(); o.state.min = +el.dataset.m; P.refreshOverlay(o); };
  P.inp.fsMin = (el) => { P.top().state.min = el.value; };
  P.sub.focusSetup = () => {
    const o = P.top(); const t = P.task(o.props.id);
    const min = Math.round(+o.state.min);
    if (o.state.mode === 'countdown' && !(min >= 1 && min <= 240)) { P.toast('Choose between 1 and 240 minutes.'); return; }
    P.close(o.id);
    P.startFocus(t.id, { mode: o.state.mode, minutes: min, occDate: P.isSeries(t) ? P.today() : null });
  };

  function pause() { const t = tm(); if (!t || t.status !== 'running') return; settle(); if (t.status !== 'running') return; t.segs[t.segs.length - 1].e = Date.now(); t.status = 'paused'; P.save(true); P.renderOverlays(); P.renderTimerPill(); }
  function resume() { const t = tm(); if (!t || t.status !== 'paused') return; t.segs.push({ s: Date.now(), e: null }); t.status = 'running'; t.heartbeat = Date.now(); P.save(true); P.renderOverlays(); P.renderTimerPill(); }
  P.act.fPause = pause;
  P.act.fResume = resume;

  /* Writes one focus record per timer id, so refreshes or double clicks can’t duplicate it. */
  function finalize(opts = {}) {
    const t = tm();
    if (!t || t.finalizing) return null;
    t.finalizing = true;
    const now = Date.now();
    settle(now);
    const last = t.segs[t.segs.length - 1];
    if (last && !last.e) last.e = now;
    const sec = P.timerElapsed(t, now);
    const task = P.task(t.taskId);
    let rec = null;
    if (!P.state.focus.some((f) => f.id === t.id) && sec > 0) {
      rec = { id: t.id, taskId: t.taskId, taskTitle: task ? task.title : '', occDate: t.occDate, start: t.startedAt, end: now, sec, mode: t.mode, corrected: !!t.adjust, projectId: task ? task.projectId : null };
      P.state.focus.push(rec);
    }
    P.state.timer = null;
    P.save(true);
    if (!opts.silent) P.render();
    return { sec, task, rec };
  }
  P.finalizeFocus = finalize;
  P.act.fEnd = () => {
    const o = P.stack.find((x) => x.kind === 'focus');
    const r = finalize({ silent: true });
    if (o && r) o.state.summary = { sec: r.sec, taskId: r.task && r.task.id };
    P.render();
  };
  P.act.fContinue = (el) => {
    const t = tm(); if (!t) return;
    const m = +(el.dataset.m || 5);
    t.target = P.timerElapsed(t) + m * 60; t.intervals += 1;
    t.segs.push({ s: Date.now(), e: null }); t.status = 'running'; t.heartbeat = Date.now();
    P.save(true); P.renderOverlays(); P.renderTimerPill();
  };
  P.act.fBreak = () => {
    const t = tm(); if (!t) return;
    t.status = 'break'; t.breakEnd = Date.now() + 5 * 60 * 1000;
    P.save(true); P.renderOverlays(); P.renderTimerPill();
  };
  P.act.fBreakEnd = () => { const t = tm(); if (!t) return; t.status = 'finished'; t.breakEnd = null; P.save(true); P.renderOverlays(); };
  P.act.fComplete = () => {
    const t = tm();
    const id = t ? t.taskId : (P.stack.find((x) => x.kind === 'focus') || { state: {} }).state.summary?.taskId;
    const occ = t ? t.occDate : null;
    if (t) finalize({ silent: true });
    P.closeFocus();
    const task = P.task(id);
    if (!task) return;
    if (occ && P.isSeries(task)) P.act.toggleOcc({ dataset: { id, date: occ } });
    else P.completeTask(id);
  };
  P.sub.fNext = (f) => {
    const v = f.step.value.trim();
    const t = tm();
    const id = t ? t.taskId : (P.stack.find((x) => x.kind === 'focus') || { state: {} }).state.summary?.taskId;
    const task = P.task(id);
    if (t) finalize({ silent: true });
    if (task && v) P.commit('Saved your next step. The task is still open.', () => { task.nextStep = v; }, { undo: false });
    P.closeFocus();
    P.render();
  };
  P.sub.fThought = (f) => {
    const v = f.thought.value.trim();
    if (!v) return;
    const t = P.newTask({ title: v, list: 'inbox' });
    P.state.tasks.push(t);
    P.save();
    f.thought.value = '';
    const msg = document.getElementById('fThoughtMsg');
    if (msg) msg.textContent = `Saved “${v}” to your Inbox. Keep going.`;
    P.render({ skip: (P.stack.find((x) => x.kind === 'focus') || {}).id });
    f.thought.focus();
  };
  P.closeFocus = () => { const o = P.stack.find((x) => x.kind === 'focus'); if (o) P.close(o.id); };
  P.act.fHide = () => P.closeFocus();
  P.sub.fRecover = (f, e) => {
    const t = tm(); if (!t) return;
    const min = +f.min.value;
    if (!(min >= 0 && min <= 24 * 60)) { P.toast('Enter minutes between 0 and 1440.'); return; }
    const raw = P.timerElapsed(Object.assign({}, t, { adjust: 0 }));
    t.adjust = Math.round(min * 60) - raw;
    t.recover = null;
    const o = P.stack.find((x) => x.kind === 'focus');
    if (e && e.submitter && e.submitter.dataset.mode === 'keep') { P.save(true); P.renderOverlays(); return; }
    const r = finalize({ silent: true });
    if (o && r) o.state.summary = { sec: r.sec, taskId: r.task && r.task.id };
    P.render();
  };
  P.act.fRecoverKeep = () => { const t = tm(); if (!t) return; t.recover = null; t.heartbeat = Date.now(); P.save(true); P.renderOverlays(); };

  function ring(frac) {
    const r = 100, c = 2 * Math.PI * r;
    return `<svg viewBox="0 0 220 220" aria-hidden="true"><defs><linearGradient id="pt-ring-grad" x1="0" y1="0" x2="1" y2="1" class="pt-ring-stops"><stop offset="0" class="a"/><stop offset="1" class="b"/></linearGradient></defs>
      <circle class="track" cx="110" cy="110" r="${r}"/><circle class="fill" cx="110" cy="110" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - P.clamp(frac, 0, 1))}" id="fRingFill"/></svg>`;
  }
  P.ov.focus = {
    type: 'full', noEsc: false,
    title: () => 'Focus',
    render(p, o) {
      const t = tm();
      if (o.state.summary) {
        const s = o.state.summary; const task = P.task(s.taskId);
        return `<div class="pt-focus fsum"><p class="pt-eyebrow">Session ended</p><h3 class="title-1">${s.sec ? `Recorded ${P.fmtDur(Math.max(1, Math.round(s.sec / 60)))}` : 'Nothing recorded'}</h3>
          <p class="pt-muted">${s.sec ? `${P.fmtSec(s.sec)} of focus on “${P.esc(task ? task.title : '')}”.` : ''} ${task && task.status === 'open' ? 'The task is still open.' : ''}</p>
          ${task && task.status === 'open' ? `<form data-sub="fNext" class="stack wide">${P.fld('Next step (optional)', `<input name="step" value="${P.esc(task.nextStep || '')}" placeholder="Where will you pick up?">`)}
            <div class="pt-row center"><button class="pt-btn pt-btn--secondary" type="submit">Save next step</button><button class="pt-btn pt-btn--secondary" type="button" data-act="fComplete">${P.ico('check')}Complete task</button><button class="pt-btn pt-btn--primary" type="button" data-act="fHide">Done</button></div></form>` : `<button class="pt-btn pt-btn--primary" data-act="fHide">Done</button>`}</div>`;
      }
      if (!t) return null;
      settle();
      const task = P.task(t.taskId);
      const title = task ? (t.occDate && P.isSeries(task) ? P.occTitle(task, t.occDate) : task.title) : 'Task';
      const step = task ? P.h.nextStepOf(task) : '';
      const el = P.timerElapsed(t);
      if (t.recover) {
        return `<div class="pt-focus"><p class="pt-eyebrow">Stopwatch recovered</p><h3 class="title-2">${P.esc(title)}</h3>
          <p>The stopwatch kept running while Petal was closed. It now shows <b>${P.fmtDur(Math.round(el / 60))}</b>, including about ${P.fmtDur(Math.round((Date.now() - t.recover.gapStart) / 60000))} while the app was closed.</p>
          <form data-sub="fRecover" class="stack wide">${P.fld('Minutes you actually focused', `<input name="min" type="number" min="0" max="1440" inputmode="numeric" value="${Math.round(t.recover.suggest / 60)}" autofocus>`, `Suggested: time until Petal was last open. Full time: ${Math.round(el / 60)} min.`)}
            <div class="pt-row center"><button class="pt-btn pt-btn--primary" type="submit">Save and end</button><button class="pt-btn pt-btn--secondary" type="submit" data-mode="keep">Correct and keep going</button><button class="pt-btn pt-btn--quiet" type="button" data-act="fRecoverKeep">Keep full time running</button></div></form></div>`;
      }
      const isCd = t.mode === 'countdown';
      const shown = isCd ? Math.max(0, t.target - el) : el;
      const frac = isCd ? el / t.target : (el % 3600) / 3600;
      const st = t.status;
      return `<div class="focus-wrap">
        <div class="pt-focus">
          <p class="pt-eyebrow">${st === 'break' ? 'Break · not counted' : st === 'paused' ? 'Paused' : st === 'finished' ? 'Time’s up' : isCd ? `Countdown · ${P.fmtDur(Math.round(t.target / 60))}` : 'Stopwatch'}</p>
          <h3 class="title-2">${P.esc(title)}</h3>
          ${task && task.projectId ? `<p class="pt-muted body-sm">${P.esc(P.projectName(task.projectId))}</p>` : ''}
          ${step ? `<p class="pt-step">${P.ico('steps')}<span>${P.esc(step)}</span></p>` : ''}
          <div class="pt-ring">${ring(st === 'break' ? 1 - (t.breakEnd - Date.now()) / 300000 : frac)}<div class="pt-ring__time"><span class="timer" id="fTime" role="timer" aria-live="off">${st === 'break' ? P.fmtSec((t.breakEnd - Date.now()) / 1000) : P.fmtSec(shown)}</span><span class="pt-muted body-sm" id="fSub">${st === 'break' ? 'Break' : isCd ? `${P.fmtSec(el)} focused` : 'focused'}</span></div></div>
          <p class="sr" aria-live="polite">${st === 'finished' ? 'Countdown finished.' : st === 'paused' ? 'Timer paused.' : ''}</p>
          ${st === 'running' ? `<div class="pt-row center"><button class="pt-btn pt-btn--secondary" data-act="fPause" autofocus>${P.ico('pause')}Pause</button><button class="pt-btn pt-btn--primary" data-act="fEnd">${P.ico('stop')}End</button></div>` : ''}
          ${st === 'paused' ? `<div class="pt-row center"><button class="pt-btn pt-btn--primary" data-act="fResume" autofocus>${P.ico('play')}Resume</button><button class="pt-btn pt-btn--secondary" data-act="fEnd">${P.ico('stop')}End</button></div>` : ''}
          ${st === 'finished' ? `<div class="stack wide"><div class="pt-row center">
              <button class="pt-btn pt-btn--primary" data-act="fContinue" data-m="${Math.max(5, Math.round((t.target / t.intervals) / 60))}">${P.ico('play')}Continue ${Math.max(5, Math.round((t.target / t.intervals) / 60))} min</button>
              <button class="pt-btn pt-btn--secondary" data-act="fBreak">${P.ico('coffee')}Take a 5 min break</button>
              <button class="pt-btn pt-btn--secondary" data-act="fComplete">${P.ico('check')}Complete task</button></div>
              <form data-sub="fNext" class="pt-input"><input name="step" placeholder="Next step, then stop" aria-label="Save next step and stop"><button class="pt-btn pt-btn--quiet sm" type="submit">Save and stop</button></form>
              <button class="pt-btn pt-btn--quiet" data-act="fEnd">End without a next step</button></div>` : ''}
          ${st === 'break' ? `<div class="pt-row center"><button class="pt-btn pt-btn--primary" data-act="fBreakEnd">End break</button></div>` : ''}
        </div>
        <aside class="focus-side stack">
          ${task && task.subtasks.length ? `<section aria-labelledby="fc-h"><h4 class="pt-section-h" id="fc-h">Checklist</h4><ul class="plain subs">${task.subtasks.map((s) => `<li class="sub ${s.done ? 'is-done' : ''}">${P.h.check(s.done, 'toggleSub', `data-id="${task.id}" data-sid="${s.id}"`, `${s.done ? 'Reopen' : 'Complete'} step: ${s.title}`)}<span>${P.esc(s.title)}</span></li>`).join('')}</ul></section>` : ''}
          <form data-sub="fThought" class="stack-sm" aria-labelledby="ft-h"><h4 class="pt-section-h h-ico" id="ft-h">${P.ico('thought', 'pt-ico--sm')} Capture a thought</h4>
            <div class="pt-input"><input name="thought" placeholder="Park it in the Inbox and keep going" aria-label="Capture a distracting thought" data-k="f-thought" autocomplete="off"><button class="pt-btn pt-btn--quiet sm" type="submit">Save</button></div>
            <p class="fld__h" id="fThoughtMsg" aria-live="polite"></p></form>
          <button class="pt-btn pt-btn--quiet left" data-act="fHide">${P.ico('down')}Hide focus view, keep timer running</button>
        </aside>
      </div>`;
    },
  };

  /* ---------- ticking: only the time text updates, so typing in the capture field is never disturbed ---------- */
  setInterval(() => {
    const t = tm();
    if (!t) return;
    if (settle()) { P.renderOverlays(); P.renderTimerPill(); notifyDone(); return; }
    if (t.status === 'break' && t.breakEnd <= Date.now()) { t.status = 'finished'; t.breakEnd = null; P.save(); P.renderOverlays(); }
    if (t.status === 'running' && Date.now() - t.heartbeat > 15000) { t.heartbeat = Date.now(); P.save(); }
    const el = P.timerElapsed(t);
    const ft = document.getElementById('fTime');
    if (ft) {
      ft.textContent = t.status === 'break' ? P.fmtSec((t.breakEnd - Date.now()) / 1000) : P.fmtSec(t.mode === 'countdown' ? Math.max(0, t.target - el) : el);
      const sub = document.getElementById('fSub'); if (sub && t.mode === 'countdown' && t.status !== 'break') sub.textContent = `${P.fmtSec(el)} focused`;
      const ringEl = document.getElementById('fRingFill');
      if (ringEl) { const c = 2 * Math.PI * 100; const frac = t.status === 'break' ? 1 - (t.breakEnd - Date.now()) / 300000 : t.mode === 'countdown' ? el / t.target : (el % 3600) / 3600; ringEl.setAttribute('stroke-dashoffset', c * (1 - P.clamp(frac, 0, 1))); }
    }
    const pt = document.getElementById('pillTime');
    if (pt) pt.textContent = P.fmtSec(t.mode === 'countdown' ? Math.max(0, t.target - el) : el);
  }, 500);
  function notifyDone() {
    const t = tm(); const task = t && P.task(t.taskId);
    if (P.state.prefs.reminders.enabled && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try { new Notification('Petal: time’s up', { body: task ? task.title : '', icon: 'petal-app-icon.svg' }); } catch (e) { /* not supported */ }
    }
  }

  P.renderTimerPill = () => {
    const host = document.getElementById('timerPill');
    if (!host) return;
    const t = tm();
    const open = P.stack.some((o) => o.kind === 'focus');
    if (!t || open) { host.innerHTML = ''; return; }
    const task = P.task(t.taskId);
    const el = P.timerElapsed(t);
    host.innerHTML = `<button class="timer-pill" data-act="openFocus">${P.ico(t.status === 'running' ? 'play' : t.status === 'paused' ? 'pause' : 'timer')}<span class="time" id="pillTime">${P.fmtSec(t.mode === 'countdown' ? Math.max(0, t.target - el) : el)}</span><span class="tp-title">${P.esc(task ? task.title : '')}</span><span class="sr">${t.status === 'paused' ? 'paused' : t.status === 'finished' ? 'time is up' : 'running'}. Open focus view.</span></button>`;
  };
  P.act.openFocus = () => openFocus();

  /* On launch: recover a running stopwatch that was left while the app was closed. */
  P.recoverTimer = () => {
    const t = tm();
    if (!t) return;
    t.finalizing = false;
    if (t.mode === 'stopwatch' && t.status === 'running' && Date.now() - t.heartbeat > RECOVER_AFTER) {
      const raw = P.timerElapsed(Object.assign({}, t, { adjust: 0 }), t.heartbeat);
      t.recover = { gapStart: t.heartbeat, suggest: raw + (t.adjust || 0) };
    }
    settle();
    P.save(true);
    openFocus();
  };
})();
