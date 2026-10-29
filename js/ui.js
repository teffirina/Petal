'use strict';
/* Shell, routing, overlays, toasts, icons and shared markup. */
(function () {
  const I = {
    plus: '<path d="M5 12h14M12 5v14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
    planner: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    tasks: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    progress: '<path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    steps: '<path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
    thought: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    adjust: '<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    someday: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
    archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
    edit: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
    coffee: '<path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4ZM6 2v2M10 2v2M14 2v2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3M12 9v4M12 17h.01"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    calendarPlus: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v5M9.5 16.5h5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    timeline: '<path d="M3 4h18M3 20h18"/><rect x="6" y="8" width="10" height="3" rx="1"/><rect x="9" y="13" width="9" height="3" rx="1"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    project: '<circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/>',
    reopen: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/>',
  };
  P.ico = (name, cls = '') => `<svg class="pt-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${I[name] || ''}</svg>`;

  /* ---------- UI state (not persisted except where noted) ---------- */
  const uiPrefsKey = 'petal:ui:v1';
  let uiSaved = {};
  try { uiSaved = JSON.parse(localStorage.getItem(uiPrefsKey) || '{}'); } catch (e) { uiSaved = {}; }
  P.ui = Object.assign({
    date: null, todayView: 'list', plannerView: 'week', plannerDate: null, completedOpen: false,
    tasks: { project: '', priority: '', deadline: '', planned: '', sort: 'created', showDone: false, showArchived: false, q: '' },
    progressPeriod: 'week', progressDate: null, suggestSkip: [], suggestPick: null, scroll: {},
  }, { todayView: uiSaved.todayView || 'list', plannerView: uiSaved.plannerView || 'week' });
  P.saveUi = () => { try { localStorage.setItem(uiPrefsKey, JSON.stringify({ todayView: P.ui.todayView, plannerView: P.ui.plannerView })); } catch (e) { /* per-viewer convenience only */ } };

  /* ---------- routing ---------- */
  P.route = () => {
    const h = location.hash.replace(/^#\/?/, '') || 'today';
    const [path, query] = h.split('?');
    const parts = path.split(/[-/]/);
    return { name: parts[0] === 'prefs' ? 'settings' : parts[0], sub: parts[1] || '', id: parts[2] || '', query: new URLSearchParams(query || '') };
  };
  P.go = (hash) => { if (location.hash !== hash) location.hash = hash; else P.render(); };
  window.addEventListener('hashchange', () => { P.render({ routeChange: true }); const m = document.getElementById('main'); if (m && !P._restoringScroll) m.scrollTop = P.ui.scroll[location.hash] || 0; });

  /* ---------- theme ---------- */
  P.applyTheme = () => {
    const t = P.state.prefs.theme;
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  };

  /* ---------- shell ---------- */
  const NAV = [
    ['today', 'Today', 'today'], ['planner', 'Planner', 'planner'], ['tasks', 'Tasks', 'tasks'], ['progress', 'Progress', 'progress'],
  ];
  function shell() {
    const app = document.getElementById('app');
    if (app.dataset.shell === '1') return;
    app.dataset.shell = '1';
    app.innerHTML = `
      <button class="skip" data-act="skipMain">Skip to content</button>
      <aside class="pt-side side" aria-label="Main">
        <div class="pt-side__brand">${window.PETAL_LOGO}</div>
        <nav aria-label="Sections" class="side-nav" id="sideNav"></nav>
        <hr>
        <button class="pt-btn pt-btn--primary side-add" data-act="quickAdd">${P.ico('plus')}Add task</button>
        <button class="side-link" data-act="search">${P.ico('search')}Search</button>
        <button class="side-link" data-act="nav" data-to="#prefs">${P.ico('settings')}Settings</button>
        <div class="side-foot" id="sideFoot"></div>
      </aside>
      <div class="col">
        <header class="topbar">
          <div class="topbar__brand">${window.PETAL_LOGO}</div>
          <div class="topbar__actions">
            <button class="pt-btn pt-btn--icon pt-btn--quiet" data-act="search" aria-label="Search">${P.ico('search')}</button>
            <button class="pt-btn pt-btn--icon pt-btn--quiet" data-act="nav" data-to="#prefs" aria-label="Settings">${P.ico('settings')}</button>
          </div>
        </header>
        <div id="banner"></div>
        <main id="main" tabindex="-1"></main>
      </div>
      <nav class="pt-tabbar tabbar" aria-label="Sections" id="tabNav"></nav>
      <button class="pt-fab fab" data-act="quickAdd" aria-label="Add task">${P.ico('plus', 'pt-ico--lg')}</button>
      <div id="timerPill"></div>
      <div id="overlays"></div>
      <div class="toasts" id="toasts" role="status" aria-live="polite"></div>`;
    const main = document.getElementById('main');
    main.addEventListener('scroll', () => { P.ui.scroll[location.hash] = main.scrollTop; }, { passive: true });
  }
  function navMarkup(r) {
    const cur = r.name === 'review' ? 'progress' : r.name;
    const inboxCount = P.state.tasks.filter((t) => P.isOpen(t) && t.list === 'inbox').length;
    document.getElementById('sideNav').innerHTML = NAV.map(([k, label, ico]) =>
      `<a href="#${k}" ${cur === k ? 'aria-current="page"' : ''}>${P.ico(ico)}${label}${k === 'tasks' && inboxCount ? `<span class="pt-count" aria-label="${inboxCount} in Inbox">${inboxCount}</span>` : ''}</a>`).join('');
    document.getElementById('tabNav').innerHTML = NAV.map(([k, label, ico]) =>
      `<a class="pt-tab" href="#${k}" ${cur === k ? 'aria-current="page"' : ''}><span class="pt-tab__pill">${P.ico(ico)}</span>${label}</a>`).join('');
    document.getElementById('sideFoot').innerHTML = `${P.ico('info', 'pt-ico--sm')}<span>Saved in this browser only. <a href="#prefs">Export</a></span>`;
  }
  function banner() {
    const el = document.getElementById('banner');
    let html = '';
    if (!P.storage.ok) html = `<div class="banner" role="alert">${P.ico('alert')}<span>This browser isn’t letting Petal save. Your changes will be lost when this tab closes. <button class="linkbtn" data-act="exportData">Export a copy</button></span></div>`;
    else if (P.storage.error) html = `<div class="banner" role="alert">${P.ico('alert')}<span>${P.esc(P.storage.error)}</span><button class="pt-btn pt-btn--secondary sm" data-act="retrySave">Try again</button></div>`;
    else if (!navigator.onLine) html = `<div class="banner banner--quiet" role="status">${P.ico('cloud')}<span>You’re offline. Petal keeps working and saves in this browser.</span></div>`;
    el.innerHTML = html;
  }
  window.addEventListener('online', () => P.render());
  window.addEventListener('offline', () => P.render());

  /* ---------- render ---------- */
  P.views = {};
  P.render = (opts = {}) => {
    if (!P.state) return;
    P.applyTheme();
    const app = document.getElementById('app');
    if (!P.state.prefs.onboarded) {
      app.dataset.shell = '';
      app.innerHTML = `<div id="onb"></div><div id="overlays"></div><div class="toasts" id="toasts" role="status" aria-live="polite"></div>`;
      P.views.onboarding(document.getElementById('onb'));
      return;
    }
    shell();
    const r = P.route();
    navMarkup(r);
    banner();
    const main = document.getElementById('main');
    const keep = main.scrollTop;
    const view = P.views[r.name] || P.views.today;
    P.keepFocus(main, () => { main.innerHTML = view(r); });
    if (!opts.routeChange) main.scrollTop = keep;
    if (P.afterView) { const f = P.afterView; P.afterView = null; f(main); }
    P.renderTimerPill && P.renderTimerPill();
    renderOverlays(opts);
  };

  /* Re-render while keeping the focused control and its caret. */
  P.keepFocus = (root, fn) => {
    const a = document.activeElement;
    let key = null, sel = null;
    if (a && root.contains(a) && a.dataset && a.dataset.k) {
      key = a.dataset.k;
      try { sel = [a.selectionStart, a.selectionEnd]; } catch (e) { sel = null; }
    }
    fn();
    if (key) {
      const n = root.querySelector(`[data-k="${CSS.escape(key)}"]`);
      if (n) { n.focus({ preventScroll: true }); if (sel && sel[0] != null) { try { n.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not a text field */ } } }
    }
  };

  /* ---------- overlays: sheets and dialogs ---------- */
  P.ov = {};
  P.stack = [];
  P.open = (kind, props = {}) => {
    const o = { id: P.uid(), kind, props, opener: document.activeElement, state: {} };
    P.stack.push(o);
    renderOverlays({ fresh: o.id });
    return o;
  };
  P.close = (id) => {
    const o = id ? P.stack.find((x) => x.id === id) : P.stack[P.stack.length - 1];
    if (!o) return;
    P.stack = P.stack.filter((x) => x !== o);
    if (o.props.onClose) o.props.onClose();
    renderOverlays();
    if (o.opener && document.contains(o.opener)) o.opener.focus({ preventScroll: true });
  };
  P.top = () => P.stack[P.stack.length - 1];
  P.refreshOverlay = (o) => renderOverlays({ only: o.id });
  function renderOverlays(opts = {}) {
    const host = document.getElementById('overlays');
    if (!host) return;
    const ids = new Set(P.stack.map((o) => o.id));
    for (const el of [...host.children]) if (!ids.has(el.dataset.ov)) el.remove();
    P.stack.forEach((o, i) => {
      let el = host.querySelector(`[data-ov="${o.id}"]`);
      const def = P.ov[o.kind];
      const isNew = !el;
      if (isNew) {
        el = document.createElement('div');
        el.dataset.ov = o.id;
        el.className = `ov ov--${def.type || 'dialog'} is-new`;
        host.appendChild(el);
        setTimeout(() => el.classList.remove('is-new'), 320);
      }
      if (opts.skip === o.id) return;
      if (opts.only && opts.only !== o.id) return;
      if (!isNew && def.live === false && !opts.only) return;
      const titleId = 'ovt-' + o.id;
      const inner = def.render(o.props, o);
      if (inner === null) { P.stack = P.stack.filter((x) => x !== o); el.remove(); return; }
      const scroller = el.querySelector('.ov__body');
      const st = scroller ? scroller.scrollTop : 0;
      P.keepFocus(el, () => {
        el.innerHTML = `<div class="ov__scrim" data-act="closeOv" data-ov-id="${o.id}"></div>
          <section class="ov__panel" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
            <header class="ov__head"><h2 id="${titleId}" class="title-2">${def.title ? P.esc(def.title(o.props, o)) : ''}</h2>
            <button class="pt-btn pt-btn--icon pt-btn--quiet" data-act="closeOv" data-ov-id="${o.id}" aria-label="Close">${P.ico('x')}</button></header>
            <div class="ov__body">${inner}</div>
            ${def.foot ? `<footer class="ov__foot">${def.foot(o.props, o)}</footer>` : ''}
          </section>`;
      });
      const sc2 = el.querySelector('.ov__body');
      if (sc2) sc2.scrollTop = st;
      el.style.zIndex = 100 + i;
      el.setAttribute('aria-hidden', i === P.stack.length - 1 ? 'false' : 'true');
      if (isNew || opts.fresh === o.id) {
        if (def.mount) def.mount(el, o.props, o);
        const f = el.querySelector('[autofocus]') || el.querySelector('.ov__body input, .ov__body select, .ov__body textarea, .ov__body button') || el.querySelector('.ov__panel button');
        if (f) setTimeout(() => f.focus({ preventScroll: false }), 30);
      }
    });
    document.body.classList.toggle('has-ov', P.stack.length > 0);
    const main = document.querySelector('.col'), nav = document.getElementById('tabNav'), side = document.querySelector('.side');
    for (const n of [main, nav, side]) if (n) { if (P.stack.length) n.setAttribute('inert', ''); else n.removeAttribute('inert'); }
  }
  P.renderOverlays = renderOverlays;

  /* Promise-based choice dialog. buttons: [{label, value, kind}] */
  P.ask = ({ title, body, buttons }) => new Promise((resolve) => {
    let done = false;
    const o = P.open('ask', { title, body, buttons, resolve: (v) => { if (!done) { done = true; resolve(v); } }, onClose: () => { if (!done) { done = true; resolve(null); } } });
    return o;
  });
  P.ov.ask = {
    type: 'dialog', live: false,
    title: (p) => p.title,
    render: (p) => `<div class="stack">${p.body || ''}</div>`,
    foot: (p) => p.buttons.map((b, i) => `<button class="pt-btn pt-btn--${b.kind || 'secondary'}" data-act="askAnswer" data-i="${i}">${P.esc(b.label)}</button>`).join(''),
  };

  /* ---------- toasts ---------- */
  let toastTimer = null;
  P.toast = (msg, opts = {}) => {
    const el = document.getElementById('toasts');
    if (!el) return;
    P._toastAction = opts.action || null;
    el.innerHTML = `<div class="toast">${P.esc(msg)}
      ${opts.action ? `<button class="pt-btn pt-btn--quiet sm" data-act="toastAction">${P.esc(opts.action.label)}</button>` : ''}
      ${opts.undo ? `<button class="pt-btn pt-btn--quiet sm" data-act="undo">${P.ico('undo', 'pt-ico--sm')}Undo</button>` : ''}
      <button class="pt-btn pt-btn--icon pt-btn--quiet sm" data-act="dismissToast" aria-label="Dismiss">${P.ico('x', 'pt-ico--sm')}</button></div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.innerHTML = ''; }, opts.action || opts.undo ? 9000 : 4500);
  };

  /* ---------- delegated events ---------- */
  P.act = {}; P.chg = {}; P.inp = {}; P.sub = {};
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = P.act[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-chg]');
    if (el && P.chg[el.dataset.chg]) P.chg[el.dataset.chg](el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-inp]');
    if (el && P.inp[el.dataset.inp]) P.inp[el.dataset.inp](el, e);
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-sub]');
    if (f && P.sub[f.dataset.sub]) { e.preventDefault(); P.sub[f.dataset.sub](f, e); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && P.stack.length) {
      const top = P.top();
      if (P.ov[top.kind].noEsc) return;
      e.preventDefault(); P.close(); return;
    }
    if (e.key === 'Tab' && P.stack.length) {
      const panel = document.querySelector(`[data-ov="${P.top().id}"] .ov__panel`);
      if (!panel) return;
      const f = [...panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && n.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      return;
    }
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.metaKey || e.ctrlKey || e.altKey || P.stack.length) return;
    if (e.key === '/') { e.preventDefault(); P.act.search(); }
    if (e.key === 'n' && P.state.prefs.onboarded) { e.preventDefault(); P.act.quickAdd(); }
  });

  P.act.nav = (el) => P.go(el.dataset.to);
  P.act.skipMain = () => document.getElementById('main').focus();
  P.act.closeOv = (el) => P.close(el.dataset.ovId);
  P.act.askAnswer = (el) => {
    const o = P.top();
    const b = o.props.buttons[+el.dataset.i];
    o.props.resolve(b.value);
    P.close(o.id);
  };
  P.act.undo = () => { document.getElementById('toasts').innerHTML = ''; P.undo(); };
  P.act.dismissToast = () => { document.getElementById('toasts').innerHTML = ''; };
  P.act.toastAction = () => { const a = P._toastAction; document.getElementById('toasts').innerHTML = ''; if (a) a.fn(); };
  P.act.retrySave = () => P.retrySave();

  /* ---------- shared markup ---------- */
  P.h = {};
  P.h.check = (checked, act, data, label) =>
    `<button class="pt-check" role="checkbox" aria-checked="${checked}" aria-label="${P.esc(label)}" data-act="${act}" ${data}><span>${checked ? P.ico('check') : ''}</span></button>`;
  P.h.chip = (text, ico, mod = '') => `<span class="pt-chip ${mod}">${ico ? P.ico(ico) : ''}${P.esc(text)}</span>`;
  P.h.deadlineText = (t) => {
    if (!t.deadline) return '';
    return `Due ${P.relDate(t.deadline.date)}${t.deadline.time != null ? ' ' + P.fmtMin(t.deadline.time) : ''}`;
  };
  P.h.taskChips = (t, opts = {}) => {
    const c = [];
    if (P.isSeries(t)) c.push(P.h.chip(P.ruleText(t.recurrence), 'repeat'));
    if (t.projectId && !opts.noProject) c.push(P.h.chip(P.projectName(t.projectId), 'folder'));
    if (t.deadline) c.push(P.h.chip(P.h.deadlineText(t), 'flag', 'pt-chip--deadline'));
    if (opts.planned && t.plannedDate) c.push(P.h.chip(`Planned ${P.relDate(t.plannedDate)}`, 'planner'));
    if (t.estimate) c.push(P.h.chip(P.fmtDur(t.estimate), 'clock'));
    const n = P.taskSessions(t.id).filter((s) => s.end > Date.now()).length;
    if (opts.sessions && n) c.push(P.h.chip(P.plural(n, 'session'), 'play', 'pt-chip--petal'));
    if (t.priority !== 'none') c.push(P.h.chip(`${t.priority[0].toUpperCase() + t.priority.slice(1)} priority`, null));
    if (t.subtasks.length) c.push(P.h.chip(`${t.subtasks.filter((s) => s.done).length} of ${t.subtasks.length} steps`, 'steps'));
    if (t.list === 'someday') c.push(P.h.chip('Someday', 'someday'));
    if (t.archived) c.push(P.h.chip('Archived', 'archive'));
    return c.join('');
  };
  P.h.nextStepOf = (t) => {
    if (t.nextStep) return t.nextStep;
    const s = t.subtasks.find((x) => !x.done);
    return s ? s.title : '';
  };
  /* One task row: completion control, title, step and timing. Secondary actions live in details. */
  P.h.taskRow = (t, opts = {}) => {
    const done = opts.occDate ? P.occDone(t, opts.occDate) === 'done' : t.status === 'done';
    const title = opts.occDate ? P.occTitle(t, opts.occDate) : t.title;
    const step = P.h.nextStepOf(t);
    const series = P.isSeries(t) && !opts.occDate;
    const check = series
      ? `<span class="pt-check series-ico" title="Repeating">${P.ico('repeat')}</span>`
      : opts.occDate
        ? P.h.check(done, 'toggleOcc', `data-id="${t.id}" data-date="${opts.occDate}"`, `${done ? 'Mark not done' : 'Complete'}: ${title}, ${P.relDate(opts.occDate)}`)
        : P.h.check(done, 'toggleTask', `data-id="${t.id}"`, `${done ? 'Reopen' : 'Complete'}: ${title}`);
    return `<div class="pt-task ${done ? 'pt-task--done' : ''}" data-task-row="${t.id}">
      ${check}
      <button class="row-open" data-act="openTask" data-id="${t.id}" ${opts.occDate ? `data-date="${opts.occDate}"` : ''}>
        <span class="pt-task__title">${P.esc(title)}</span>
        ${step && !done ? `<span class="pt-task__step">Next: ${P.esc(step)}</span>` : ''}
        <span class="pt-task__meta">${P.h.taskChips(t, opts)}${opts.extra || ''}</span>
      </button>
      ${opts.trailing || ''}
    </div>`;
  };
  /* Timed schedule item using the reference components. */
  P.h.item = (i, opts = {}) => {
    const icon = { session: 'play', appointment: 'lock', imported: 'lock', routine: 'repeat' }[i.kind];
    const tag = { session: 'Session', appointment: 'Fixed', imported: (i.appt && i.appt.calName) || 'Imported', routine: 'Routine' }[i.kind];
    let meta = P.fmtRange(i.start, i.end);
    const flags = [];
    if (i.kind === 'session') {
      if (i.task.projectId) meta += ` · ${P.esc(P.projectName(i.task.projectId))}`;
      for (const f of P.sessionFlags(i.session)) flags.push(f);
      if (i.task.status === 'done') flags.push('Task completed');
    }
    if (i.kind === 'routine' && i.status) flags.push(i.status === 'done' ? 'Done' : 'Skipped');
    const act = i.kind === 'session' ? `data-act="openSession" data-id="${i.id}"` :
      i.kind === 'routine' ? `data-act="openTask" data-id="${i.task.id}" data-date="${i.date}"` : `data-act="openAppt" data-id="${i.id}"`;
    return `<button class="pt-item pt-item--${i.kind} ${i.status === 'done' || (i.task && i.task.status === 'done') ? 'is-done' : ''}" ${act} style="${opts.style || ''}">
      ${P.ico(icon, 'pt-item__ico')}
      <span class="pt-item__title">${P.esc(i.title)}</span>
      <span class="pt-item__meta">${meta}${flags.length ? ` <span class="flag-att">${P.ico('alert', 'pt-ico--sm')}${P.esc(flags.join(' · '))}</span>` : ''}</span>
      ${opts.noTag ? '' : `<span class="pt-item__tag">${P.ico(icon)}${P.esc(tag)}</span>`}
    </button>`;
  };
  P.h.deadline = (t) => `<button class="pt-item pt-item--deadline" data-act="openTask" data-id="${t.id}">${P.ico('flag', 'pt-item__ico')}<span class="pt-item__title">${P.esc(t.title)}</span><span class="pt-item__meta">Deadline${t.deadline.time != null ? ' ' + P.fmtMin(t.deadline.time) : ''}</span></button>`;
  P.h.empty = (title, body, actions = '') => `<div class="empty"><span class="empty__mark" aria-hidden="true"></span><h3 class="title-3">${title}</h3><p class="pt-muted">${body}</p>${actions ? `<div class="pt-row center">${actions}</div>` : ''}</div>`;
  P.h.opts = (list, cur) => list.map(([v, l]) => `<option value="${P.esc(v)}" ${String(v) === String(cur ?? '') ? 'selected' : ''}>${P.esc(l)}</option>`).join('');
  P.h.projectOpts = (cur, none = 'No project') => P.h.opts([['', none], ...P.state.projects.filter((p) => p.status === 'active' || p.id === cur).map((p) => [p.id, p.name])], cur);
  P.h.timeOpts = (cur, step = 15) => { const l = []; for (let m = 0; m < 1440; m += step) l.push([m, P.fmtMin(m)]); return P.h.opts(l, cur); };
  P.h.durOpts = (cur) => P.h.opts([['', 'Not set'], ...[5, 10, 15, 20, 25, 30, 45, 60, 75, 90, 120, 150, 180, 240].map((m) => [m, P.fmtDur(m)])], cur);
})();
