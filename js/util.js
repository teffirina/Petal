'use strict';
/* Petal utilities: ids, escaping, dates and time zones.
   Date-only values are 'YYYY-MM-DD' strings and never shift. Timed values are UTC epoch ms,
   shown in the person's chosen time zone. */
const P = window.P = {};

P.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
P.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
P.clone = (o) => JSON.parse(JSON.stringify(o));
P.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
P.MIN = 60000;
P.DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ---------- date strings ---------- */
P.pad = (n) => String(n).padStart(2, '0');
P.ds = (y, m, d) => `${y}-${P.pad(m)}-${P.pad(d)}`;
P.parseDs = (ds) => { const [y, m, d] = ds.split('-').map(Number); return { y, m, d }; };
P.dsToUTC = (ds) => { const { y, m, d } = P.parseDs(ds); return Date.UTC(y, m - 1, d); };
P.utcToDs = (ms) => { const t = new Date(ms); return P.ds(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
P.addDays = (ds, n) => P.utcToDs(P.dsToUTC(ds) + n * 86400000);
P.dow = (ds) => new Date(P.dsToUTC(ds)).getUTCDay();
P.diffDays = (a, b) => Math.round((P.dsToUTC(b) - P.dsToUTC(a)) / 86400000);
P.isDs = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
P.weekStart = (ds, ws) => { const k = (P.dow(ds) - ws + 7) % 7; return P.addDays(ds, -k); };
P.monthStart = (ds) => ds.slice(0, 8) + '01';
P.addMonths = (ds, n) => { const { y, m } = P.parseDs(ds); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return P.utcToDs(t.getTime()); };
P.daysInMonth = (ds) => { const { y, m } = P.parseDs(ds); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

/* ---------- time zones ---------- */
const fmtCache = {};
function partsFmt(tz) {
  if (!fmtCache[tz]) {
    fmtCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  return fmtCache[tz];
}
P.validTz = (tz) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; } };
P.systemTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } };
P.tz = () => (P.state && P.state.prefs.timeZone) || P.systemTz();
function zparts(ms, tz) {
  const o = {};
  for (const p of partsFmt(tz).formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
}
function tzOffset(ms, tz) {
  const p = zparts(ms, tz);
  const asUTC = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return asUTC - Math.floor(ms / 1000) * 1000;
}
/* Wall-clock date + minutes in tz -> epoch ms. Times inside a DST gap move forward. */
P.toMs = (ds, min, tz = P.tz()) => {
  const { y, m, d } = P.parseDs(ds);
  const guess = Date.UTC(y, m - 1, d, 0, min);
  let t = guess - tzOffset(guess, tz);
  const off2 = tzOffset(t, tz);
  if (guess - off2 !== t) {
    const t2 = guess - off2;
    if (tzOffset(t2, tz) === off2) t = t2;
  }
  return t;
};
P.local = (ms, tz = P.tz()) => { const p = zparts(ms, tz); return { date: P.ds(p.y, p.m, p.d), min: p.h * 60 + p.mi }; };
P.dayStart = (ds) => P.toMs(ds, 0);
P.dayEnd = (ds) => P.toMs(P.addDays(ds, 1), 0);
P.today = () => P.local(Date.now()).date;
P.nowMin = () => P.local(Date.now()).min;

/* ---------- formatting ---------- */
P.fmtMin = (min) => {
  min = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(min / 60), m = min % 60;
  if (P.state && P.state.prefs.timeFormat === '12h') {
    const hh = h % 12 || 12;
    return `${hh}:${P.pad(m)} ${h < 12 ? 'am' : 'pm'}`;
  }
  return `${P.pad(h)}:${P.pad(m)}`;
};
P.fmtTime = (ms) => P.fmtMin(P.local(ms).min);
P.fmtRange = (a, b) => `${P.fmtTime(a)}–${P.fmtTime(b)}`;
P.fmtDur = (min) => {
  min = Math.round(min);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};
P.fmtSec = (sec) => {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${P.pad(m)}:${P.pad(s)}` : `${P.pad(m)}:${P.pad(s)}`;
};
P.fmtDate = (ds, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(P.dsToUTC(ds)));
P.relDate = (ds) => {
  const t = P.today(), k = P.diffDays(t, ds);
  if (k === 0) return 'Today';
  if (k === 1) return 'Tomorrow';
  if (k === -1) return 'Yesterday';
  if (k > 1 && k < 7) return P.fmtDate(ds, { weekday: 'long' });
  const sameYear = ds.slice(0, 4) === t.slice(0, 4);
  return P.fmtDate(ds, sameYear ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
};
P.parseHM = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); if (!m) return null; const v = +m[1] * 60 + +m[2]; return v >= 0 && v <= 1440 ? v : null; };
P.hm = (min) => `${P.pad(Math.floor(min / 60) % 24)}:${P.pad(min % 60)}`;
P.plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;

/* ---------- intervals ---------- */
P.union = (list) => {
  const s = list.filter((i) => i[1] > i[0]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const i of s) {
    const last = out[out.length - 1];
    if (last && i[0] <= last[1]) last[1] = Math.max(last[1], i[1]);
    else out.push([i[0], i[1]]);
  }
  return out;
};
P.subtract = (base, holes) => {
  let res = base.map((b) => [b[0], b[1]]);
  for (const h of P.union(holes)) {
    const next = [];
    for (const r of res) {
      if (h[1] <= r[0] || h[0] >= r[1]) { next.push(r); continue; }
      if (h[0] > r[0]) next.push([r[0], h[0]]);
      if (h[1] < r[1]) next.push([h[1], r[1]]);
    }
    res = next;
  }
  return res;
};
P.sumIv = (list) => list.reduce((a, i) => a + (i[1] - i[0]), 0);
P.overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
