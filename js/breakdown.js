'use strict';
/* Help me start: manual breakdown and matching first actions. No AI: starter steps are plain, labelled templates. */
(function () {
  const REASONS = [
    ['big', 'Too big', 'Split the work into small steps'],
    ['unclear', 'Unclear starting point', 'Define one concrete first action'],
    ['quality', 'Worried about quality', 'Start a rough draft'],
    ['energy', 'Low energy', 'Try a shorter session or another time'],
    ['distract', 'Distractions', 'Enter focus mode'],
  ];
  const TEMPLATES = [
    [/present|slides|talk|pitch|deck/i, 'presentations', ['Choose the main idea', 'Write three slide titles', 'Collect two examples', 'Draft the slides', 'Review and practise']],
    [/essay|report|paper|thesis|article|write|draft/i, 'writing', ['Write the main point in one sentence', 'List three sections as headings', 'Draft the easiest section', 'Draft the remaining sections', 'Edit once and check references']],
    [/exam|study|revise|revision|test|quiz|learn/i, 'studying', ['List the topics to cover', 'Pick the topic you feel least sure about', 'Do 20 minutes of practice questions', 'Review what you got wrong', 'Summarise it on one page']],
    [/clean|tidy|organi[sz]e|declutter/i, 'tidying', ['Clear one surface', 'Put away five things', 'Wipe down the surface', 'Take out the rubbish']],
    [/email|reply|message|call/i, 'messages', ['Open the message or contact', 'Write the key answer in one line', 'Draft the full reply', 'Send it']],
    [/apply|application|cv|resume|form/i, 'applications', ['Find the requirements and deadline', 'Gather the documents you need', 'Fill in the easy parts first', 'Write the longer answers', 'Check and submit']],
  ];
  P.act.breakdown = (el) => P.open('breakdown', { id: el.dataset.id });
  P.ov.breakdown = {
    type: 'sheet', title: () => 'Help me start',
    render(p, o) {
      const t = P.task(p.id);
      if (!t) return null;
      const s = o.state;
      if (!s.steps) { s.steps = [{ id: P.uid(), v: '' }, { id: P.uid(), v: '' }, { id: P.uid(), v: '' }]; s.mode = 'append'; s.reason = null; s.setNext = true; }
      const tpl = TEMPLATES.find(([rx]) => rx.test(t.title + ' ' + (t.notes || '')));
      let panel = '';
      const r = s.reason || 'big';
      if (r === 'big') {
        panel = `<section class="stack" aria-labelledby="bd-h"><h3 class="pt-section-h" id="bd-h">Split it into small steps <small>Edit, add, remove or reorder</small></h3>
          ${tpl && !s.usedTpl ? `<div class="note">${P.ico('info', 'pt-ico--sm')}<span>Petal has generic starter steps for ${tpl[1]}. They’re a template, not advice about your task. <button class="linkbtn" data-act="bdTpl">Use starter steps</button></span></div>` : ''}
          <ol class="plain bd-steps">${s.steps.map((x, i) => `<li class="bd-step"><span class="bd-n" aria-hidden="true">${i + 1}</span>
            <input value="${P.esc(x.v)}" aria-label="Step ${i + 1}" data-inp="bdStep" data-sid="${x.id}" data-k="bd-${x.id}" placeholder="${i === 0 ? 'A first step you could do in 10 minutes' : 'Next step'}">
            <span class="sub__btns"><button class="pt-btn pt-btn--icon pt-btn--quiet sm" data-act="bdMove" data-sid="${x.id}" data-dir="-1" aria-label="Move step ${i + 1} up" ${i === 0 ? 'disabled' : ''}>${P.ico('arrowUp', 'pt-ico--sm')}</button>
            <button class="pt-btn pt-btn--icon pt-btn--quiet sm" data-act="bdMove" data-sid="${x.id}" data-dir="1" aria-label="Move step ${i + 1} down" ${i === s.steps.length - 1 ? 'disabled' : ''}>${P.ico('arrowDown', 'pt-ico--sm')}</button>
            <button class="pt-btn pt-btn--icon pt-btn--quiet sm" data-act="bdDel" data-sid="${x.id}" aria-label="Remove step ${i + 1}">${P.ico('x', 'pt-ico--sm')}</button></span></li>`).join('')}</ol>
          <button class="pt-btn pt-btn--quiet left" data-act="bdAdd">${P.ico('plus')}Add a step</button>
          ${t.subtasks.length ? `<fieldset class="box"><legend class="fld__l">It already has ${P.plural(t.subtasks.length, 'step')}</legend>
            <label class="radio"><input type="radio" name="bdmode" value="append" ${s.mode === 'append' ? 'checked' : ''} data-chg="bdMode"><span>Add these after the existing steps</span></label>
            <label class="radio"><input type="radio" name="bdmode" value="replace" ${s.mode === 'replace' ? 'checked' : ''} data-chg="bdMode"><span>Replace the existing steps</span></label></fieldset>` : ''}
          <label class="switch"><input type="checkbox" ${s.setNext ? 'checked' : ''} data-chg="bdNext"><span>Make the first step the next step</span></label>
          <div class="pt-row"><button class="pt-btn pt-btn--primary" data-act="bdSave">Save steps</button></div></section>`;
      } else if (r === 'unclear') {
        panel = `<section class="stack"><h3 class="pt-section-h">Define one concrete first action</h3>
          <p class="pt-muted body-sm">Something you can see yourself doing in the next 10 minutes. Start it with a verb, like “Open”, “List” or “Write one sentence”.</p>
          ${P.fld('First action', `<input value="${P.esc(s.first ?? t.nextStep ?? '')}" data-inp="bdFirst" data-k="bd-first" placeholder="e.g. Open the brief and highlight the question">`)}
          <div class="pt-row"><button class="pt-btn pt-btn--primary" data-act="bdFirstSave" data-start="1">${P.ico('play')}Save and start 5 min</button><button class="pt-btn pt-btn--secondary" data-act="bdFirstSave">Save as next step</button></div></section>`;
      } else if (r === 'quality') {
        const v = s.draft ?? 'Write a rough first version for 10 minutes. It can be messy.';
        panel = `<section class="stack"><h3 class="pt-section-h">Start a rough draft</h3>
          <p class="pt-muted body-sm">A rough version is easier to improve than a blank page. You can edit later.</p>
          ${P.fld('Next step', `<input value="${P.esc(v)}" data-inp="bdDraft" data-k="bd-draft">`)}
          <div class="pt-row"><button class="pt-btn pt-btn--primary" data-act="bdDraftGo">${P.ico('play')}Save and start 10 min</button><button class="pt-btn pt-btn--secondary" data-act="bdDraftSave">Save as next step</button></div></section>`;
      } else if (r === 'energy') {
        panel = `<section class="stack"><h3 class="pt-section-h">Try a shorter session or choose another time</h3>
          <div class="pt-row"><button class="pt-btn pt-btn--primary" data-act="start5" data-id="${t.id}">${P.ico('play')}Start 5 min</button>
          <button class="pt-btn pt-btn--secondary" data-act="newSession" data-task="${t.id}">${P.ico('calendarPlus')}Schedule for later</button>
          <button class="pt-btn pt-btn--secondary" data-act="planQuick" data-id="${t.id}" data-d="1">Plan for tomorrow</button></div>
          ${t.effort ? '' : `<p class="pt-muted body-sm">Tip: set an effort level in task details to spot low-effort tasks for tired moments.</p>`}</section>`;
      } else {
        panel = `<section class="stack"><h3 class="pt-section-h">Enter focus mode</h3>
          <p class="pt-muted body-sm">Focus mode shows only this task and a timer. When a thought pops up, park it in the capture field and it goes to your Inbox.</p>
          <div class="pt-row">${[10, 15, 25].map((m) => `<button class="pt-btn pt-btn--${m === 15 ? 'primary' : 'secondary'}" data-act="bdFocus" data-m="${m}">${P.ico('timer')}Focus ${m} min</button>`).join('')}</div></section>`;
      }
      return `<div class="stack-lg"><div><p class="pt-muted">For</p><h3 class="title-2">${P.esc(t.title)}</h3></div>
        <fieldset class="stack-sm"><legend class="fld__l">What’s making it hard? (optional)</legend>
          <div class="pt-row">${REASONS.map(([k, l]) => `<button class="pt-chip chipbtn ${r === k ? 'pt-chip--petal' : ''}" aria-pressed="${r === k}" data-act="bdReason" data-r="${k}">${P.esc(l)}</button>`).join('')}</div>
          <p class="fld__h">${P.esc(REASONS.find((x) => x[0] === r)[2])}.</p></fieldset>
        ${panel}</div>`;
    },
  };
  const bo = () => P.stack.find((o) => o.kind === 'breakdown');
  P.act.bdReason = (el) => { const o = bo(); o.state.reason = el.dataset.r; P.refreshOverlay(o); };
  P.inp.bdStep = (el) => { const o = bo(); const x = o.state.steps.find((s) => s.id === el.dataset.sid); if (x) x.v = el.value; };
  P.act.bdAdd = () => { const o = bo(); const id = P.uid(); o.state.steps.push({ id, v: '' }); P.refreshOverlay(o); setTimeout(() => { const n = document.querySelector(`[data-k="bd-${id}"]`); if (n) n.focus(); }, 0); };
  P.act.bdDel = (el) => { const o = bo(); o.state.steps = o.state.steps.filter((s) => s.id !== el.dataset.sid); P.refreshOverlay(o); };
  P.act.bdMove = (el) => {
    const o = bo(); const a = o.state.steps; const i = a.findIndex((s) => s.id === el.dataset.sid); const j = i + +el.dataset.dir;
    if (j < 0 || j >= a.length) return;
    const [x] = a.splice(i, 1); a.splice(j, 0, x); P.refreshOverlay(o);
    setTimeout(() => { const b = document.querySelector(`[data-act="bdMove"][data-sid="${x.id}"][data-dir="${el.dataset.dir}"]`); if (b && !b.disabled) b.focus(); else { const n = document.querySelector(`[data-k="bd-${x.id}"]`); if (n) n.focus(); } }, 0);
  };
  P.act.bdTpl = () => {
    const o = bo(); const t = P.task(o.props.id);
    const tpl = TEMPLATES.find(([rx]) => rx.test(t.title + ' ' + (t.notes || '')));
    const filled = o.state.steps.filter((s) => s.v.trim());
    o.state.steps = [...filled, ...tpl[2].map((v) => ({ id: P.uid(), v }))];
    o.state.usedTpl = true; P.refreshOverlay(o);
  };
  P.chg.bdMode = (el) => { bo().state.mode = el.value; };
  P.chg.bdNext = (el) => { bo().state.setNext = el.checked; };
  P.act.bdSave = () => {
    const o = bo(); const t = P.task(o.props.id);
    const steps = o.state.steps.map((s) => s.v.trim()).filter(Boolean);
    if (!steps.length) { P.toast('Write at least one step.'); return; }
    const replace = o.state.mode === 'replace' && t.subtasks.length;
    P.commit(`${replace ? 'Replaced' : 'Added'} ${P.plural(steps.length, 'step')} on “${t.title}”.`, () => {
      const items = steps.map((v) => ({ id: P.uid(), title: v, done: false, doneAt: null }));
      t.subtasks = replace ? items : [...t.subtasks, ...items];
      if (o.state.setNext) t.nextStep = steps[0];
    });
    P.close(o.id);
  };
  P.inp.bdFirst = (el) => { bo().state.first = el.value; };
  P.act.bdFirstSave = (el) => {
    const o = bo(); const t = P.task(o.props.id); const v = (o.state.first ?? t.nextStep ?? '').trim();
    if (!v) { P.toast('Write a first action.'); return; }
    P.commit('Saved your first action as the next step.', () => { t.nextStep = v; });
    P.close(o.id);
    if (el.dataset.start) P.startFocus(t.id, { minutes: 5 });
  };
  P.inp.bdDraft = (el) => { bo().state.draft = el.value; };
  const saveDraft = () => { const o = bo(); const t = P.task(o.props.id); const v = (o.state.draft ?? 'Write a rough first version for 10 minutes. It can be messy.').trim(); P.commit('Saved the rough-draft step.', () => { t.nextStep = v; }); P.close(o.id); return t; };
  P.act.bdDraftSave = saveDraft;
  P.act.bdDraftGo = () => { const t = saveDraft(); P.startFocus(t.id, { minutes: 10 }); };
  P.act.bdFocus = (el) => { const o = bo(); const t = P.task(o.props.id); P.close(o.id); P.startFocus(t.id, { minutes: +el.dataset.m, occDate: P.isSeries(t) ? P.today() : null }); };
})();
