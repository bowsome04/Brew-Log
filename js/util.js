// Small DOM, formatting and UI helpers shared by every view.

const SVG_NS = 'http://www.w3.org/2000/svg';

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  let value;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'value') value = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'open') el[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  if (value !== undefined) el.value = value;
  return el;
}

export function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

// ---------- ids, numbers, dates ----------
export const uid = () =>
  (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function fmtNum(n, d = 1) {
  if (n === null || n === undefined || n === '' || Number.isNaN(+n)) return '–';
  return (+n).toFixed(d).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function fmtTime(sec) {
  if (sec === null || sec === undefined || Number.isNaN(+sec)) return '–';
  const t = Math.round(+sec);
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

export const ratioOf = (dose, out) => (dose > 0 && out > 0 ? out / dose : null);
export const fmtRatio = (r) => (r === null || r === undefined ? '–' : '1:' + fmtNum(r, 1));

export function fmtDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const opts = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleString('en-GB', opts);
}

export function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function toLocalInput(value = new Date()) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export const fromLocalInput = (v) => new Date(v).toISOString();

export function daysOffRoast(roastDate, brewIso) {
  if (!roastDate) return null;
  const [y, m, d] = roastDate.split('-').map(Number);
  if (!y) return null;
  const roast = new Date(y, m - 1, d);
  const b = new Date(brewIso);
  const brewDay = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  const n = Math.round((brewDay - roast) / 86400000);
  return n >= 0 ? n : null;
}

export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export const minmax = (a) => (a.length ? [Math.min(...a), Math.max(...a)] : null);

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---------- form controls ----------
let fieldId = 0;
export function field(label, control, hint) {
  const id = 'f' + (++fieldId);
  if (control.tagName === 'INPUT' || control.tagName === 'SELECT' || control.tagName === 'TEXTAREA') control.id = id;
  return h('div', { class: 'field' },
    h('label', { class: 'lbl', for: control.id || null }, label),
    control,
    hint ? h('div', { class: 'hint' }, hint) : null);
}

export function selectEl(options, value, onChange) {
  const sel = h('select', { onchange: (e) => onChange && onChange(e.target.value) });
  const groups = new Map();
  for (const o of options) {
    const opt = h('option', { value: o.value }, o.label);
    if (o.group) {
      if (!groups.has(o.group)) {
        const g = h('optgroup', { label: o.group });
        groups.set(o.group, g);
        sel.appendChild(g);
      }
      groups.get(o.group).appendChild(opt);
    } else sel.appendChild(opt);
  }
  sel.value = value ?? '';
  return sel;
}

export function segmented(options, value, onChange, label) {
  const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label || null });
  const render = (val) => {
    wrap.replaceChildren(...options.map((o) => h('button', {
      type: 'button', role: 'radio', class: 'seg-btn' + (o.cls ? ' ' + o.cls : ''),
      'aria-checked': String(o.value === val),
      onclick: () => {
        const next = o.value === val ? null : o.value; // tap again to clear
        render(next);
        onChange(next);
      },
    }, o.label)));
  };
  render(value);
  return wrap;
}

export function chip(text, opts = {}) {
  return h('span', { class: 'chip' + (opts.cls ? ' ' + opts.cls : ''), title: opts.title || null },
    opts.color ? h('i', { class: 'dot', style: { background: opts.color } }) : null, text);
}

export const btn = (label, onclick, cls = '') =>
  h('button', { type: 'button', class: 'btn ' + cls, onclick }, label);

// ---------- toast ----------
export function toast(msg, ms = 2600) {
  let box = document.getElementById('toasts');
  if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(box); }
  const t = h('div', { class: 'toast' }, msg);
  box.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// ---------- bottom sheets (Android back button closes the top one) ----------
const sheetStack = [];
let pendingPops = [];

window.addEventListener('popstate', () => {
  if (pendingPops.length) { pendingPops.shift()(); return; }
  const top = sheetStack[sheetStack.length - 1];
  if (top) top.finish(false);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sheetStack.length) sheetStack[sheetStack.length - 1].close();
});

function lockBodyScroll() {
  if (sheetStack.length === 1) document.body.classList.add('sheet-open');
}
function unlockBodyScroll() {
  if (!sheetStack.length) document.body.classList.remove('sheet-open');
}

export function openSheet({ title, content, onClose, tall = false }) {
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const body = h('div', { class: 'sheet-body' }, content);
  const sheet = h('div', { class: 'sheet' + (tall ? ' sheet-tall' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-head' },
      h('h2', null, title),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => api.close() }, '×')),
    body);
  backdrop.appendChild(sheet);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) api.close(); });

  let done = false;
  let resolveClosed;
  const closed = new Promise((r) => { resolveClosed = r; });

  const api = {
    body, closed,
    close: () => api.finish(true),
    finish(popHistory) {
      if (done) return;
      done = true;
      const i = sheetStack.indexOf(api);
      if (i >= 0) sheetStack.splice(i, 1);
      unlockBodyScroll();
      backdrop.remove();
      if (popHistory) {
        let settled = false;
        const settle = () => { if (!settled) { settled = true; resolveClosed(); } };
        pendingPops.push(() => settle());
        history.back();
        setTimeout(() => { pendingPops = pendingPops.filter((f) => f !== settle); settle(); }, 400);
      } else resolveClosed();
      if (onClose) onClose();
    },
  };
  sheetStack.push(api);
  lockBodyScroll();
  history.pushState({ sheet: true }, '');
  document.body.appendChild(backdrop);
  return api;
}

export function closeAllSheets() {
  while (sheetStack.length) sheetStack[sheetStack.length - 1].finish(false);
}

export function confirmSheet({ title = 'Are you sure?', message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const content = h('div', { class: 'confirm' },
      h('p', null, message),
      h('div', { class: 'row-actions' },
        btn('Cancel', () => sheet.close(), 'ghost'),
        btn(confirmLabel, () => { answer = true; sheet.close(); }, danger ? 'danger' : 'primary')));
    const sheet = openSheet({ title, content });
    sheet.closed.then(() => resolve(answer));
  });
}

// ---------- download / share ----------
export function downloadFile(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function shareFile(name, text, type) {
  const file = new File([text], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: name });
    return true;
  }
  return false;
}

export const install = { prompt: null };
