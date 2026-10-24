import {
  h, field, selectEl, segmented, chip, btn, toast, confirmSheet, debounce, num,
  fmtNum, fmtTime, fmtRatio, fmtDateTime, toLocalInput, fromLocalInput,
} from '../util.js';
import * as D from '../data.js';
import { navigate, replace } from '../router.js';
import { tasteChips, openWheelSheet } from './taste.js';
import { beanFormSheet } from './beans.js';
import { grinderFormSheet, grinderUnit } from './grinders.js';
import { nameOf, pathOf } from '../flavors.js';

// ---------------------------------------------------------------- shared bits

export function grinderText(b) {
  const g = D.grinderById(b.grinderId);
  if (!g && (b.clicks === null || b.clicks === undefined)) return '';
  const unit = grinderUnit(g);
  return (g ? g.name + ' ' : '') + (b.clicks !== null && b.clicks !== undefined ? fmtNum(b.clicks, 1) + ' ' + unit : '');
}

export function recipeSummary(b) {
  const kind = D.methodKind(b.method);
  const r = D.recipeRatio(b);
  const bits = [];
  if (b.brewStyle === 'iced') {
    const ice = [b.iceBedG ? fmtNum(b.iceBedG, 0) + 'g bed' : null, b.iceG ? fmtNum(b.iceG, 0) + 'g server' : null].filter(Boolean);
    bits.push('Iced' + (ice.length ? ' (' + ice.join(' + ') + ' ice)' : ''));
  }
  if (b.dose || b.water) {
    bits.push(kind === 'espresso'
      ? `${fmtNum(b.dose)} g in → ${fmtNum(b.water)} g out${r ? ' (' + fmtRatio(r) + ')' : ''}`
      : `${fmtNum(b.dose)} g : ${fmtNum(b.water)} g${r ? ' (' + fmtRatio(r) + ')' : ''}`);
  }
  if (b.temp !== null && b.temp !== undefined) bits.push(fmtNum(b.temp) + '°C');
  const gt = grinderText(b);
  if (gt) bits.push(gt);
  if (b.totalTime) bits.push(fmtTime(b.totalTime));
  return bits.join(' · ') || 'No recipe details';
}

export function verdictChip(v) {
  return v ? h('span', { class: 'chip verdict verdict-' + v }, D.VERDICT[v]) : null;
}

export function brewCard(b, opts = {}) {
  const bean = D.beanById(b.beanId);
  return h('a', { class: 'card card-link brew-card', href: '#/brew/' + b.id },
    h('div', { class: 'card-head' },
      h('div', null,
        opts.hideBean ? null : h('h3', null, bean ? bean.name : 'Unknown bean'),
        h('p', { class: 'muted small' }, (!opts.hideBean && bean ? bean.roaster + ' · ' : '') + fmtDateTime(b.date))),
      h('div', { class: 'card-tags' },
        b.rating !== null && b.rating !== undefined ? h('span', { class: 'score' }, b.rating + '/10') : null,
        verdictChip(b.verdict))),
    h('p', { class: 'small recipe-line' }, h('strong', null, b.method), ' · ', recipeSummary(b)),
    (b.taste && b.taste.length) ? tasteChips(b.taste, { max: 4 }) : null);
}

function notFound(msg) {
  return { title: 'Not found', back: '#/', nav: 'brews', el: h('div', { class: 'empty' }, h('p', null, msg), h('a', { class: 'btn primary', href: '#/' }, 'Back to brews')) };
}

const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------- list

const F = { q: '', method: '', beanId: '', verdict: '' };

export async function brewsView() {
  const root = h('div', { class: 'stack' });
  const list = h('div', { class: 'stack' });
  const brews = D.brewsSorted();

  // backup nudge
  const last = D.store.meta.lastBackup;
  const stale = !last || (Date.now() - new Date(last).getTime()) > 30 * 86400000;
  if (brews.length >= 3 && stale) {
    root.appendChild(h('div', { class: 'banner' },
      h('span', null, last ? 'Your last backup was over 30 days ago.' : 'Your logs live only on this phone and have not been backed up.'),
      h('a', { class: 'btn small', href: '#/settings' }, 'Back up')));
  }

  if (!brews.length) {
    root.appendChild(h('div', { class: 'empty' },
      h('p', { class: 'empty-title' }, 'No brews logged yet'),
      h('p', { class: 'muted' }, 'Log a brew to record the recipe, how it tasted, and whether it worked.'),
      h('a', { class: 'btn primary', href: '#/brew/new' }, 'Log your first brew')));
    return { title: 'Brews', nav: 'brews', el: root };
  }

  const methods = D.usedMethods();
  const q = h('input', { type: 'search', placeholder: 'Search beans, roasters, flavours', value: F.q, 'aria-label': 'Search brews', oninput: (e) => { F.q = e.target.value; paint(); } });
  const filters = h('div', { class: 'filters' }, q,
    h('div', { class: 'filter-row' },
      selectEl([{ value: '', label: 'All methods' }, ...methods.map((m) => ({ value: m, label: m }))], F.method, (v) => { F.method = v; paint(); }),
      selectEl([{ value: '', label: 'All beans' }, ...D.store.beans.map((b) => ({ value: b.id, label: b.name }))], F.beanId, (v) => { F.beanId = v; paint(); }),
      selectEl([{ value: '', label: 'Any result' }, ...Object.entries(D.VERDICT).map(([value, label]) => ({ value, label }))], F.verdict, (v) => { F.verdict = v; paint(); })));
  root.appendChild(filters);
  root.appendChild(list);

  function paint() {
    const term = F.q.trim().toLowerCase();
    const rows = brews.filter((b) => {
      if (F.method && b.method !== F.method) return false;
      if (F.beanId && b.beanId !== F.beanId) return false;
      if (F.verdict && b.verdict !== F.verdict) return false;
      if (term) {
        const bean = D.beanById(b.beanId) || {};
        const hay = [bean.name, bean.roaster, bean.country, bean.variety, bean.process, b.method, b.notes, ...(b.taste || []).map(nameOf)].join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    list.replaceChildren(...(rows.length ? rows.map((b) => brewCard(b)) : [h('p', { class: 'muted center' }, 'No brews match these filters.')]));
  }
  paint();

  return { title: 'Brews', nav: 'brews', el: root, fab: { href: '#/brew/new', label: 'New brew' } };
}

// ---------------------------------------------------------------- detail

function meter(value, labels) {
  if (value === null || value === undefined) return h('span', { class: 'muted' }, 'Not set');
  return h('div', { class: 'meter-wrap' },
    h('div', { class: 'meter', role: 'img', 'aria-label': labels[value] }, labels.map((_, i) => h('span', { class: 'meter-seg' + (i === value ? ' on' : '') }))),
    h('span', { class: 'meter-label' }, labels[value]));
}

function kv(rows) {
  return h('dl', { class: 'kv' }, rows.filter((r) => r[1] !== '' && r[1] !== null && r[1] !== undefined).map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
}

const TIME_LABEL = { percolation: 'Total time', immersion: 'Steep time', hybrid: 'Total time', espresso: 'Shot time' };

export async function brewDetailView({ id }) {
  const b = D.brewById(id);
  if (!b) return notFound('That brew no longer exists.');
  const bean = D.beanById(b.beanId);
  const kind = D.methodKind(b.method);
  const root = h('div', { class: 'stack' });
  const age = D.daysOff(b);
  const r = D.recipeRatio(b);

  root.appendChild(h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', null,
        bean ? h('a', { class: 'bean-link', href: '#/bean/' + bean.id }, h('h2', { class: 'bean-name' }, bean.name)) : h('h2', { class: 'bean-name' }, 'Unknown bean'),
        h('p', { class: 'muted' }, (bean ? bean.roaster + ' · ' : '') + fmtDateTime(b.date))),
      h('div', { class: 'card-tags' }, b.rating !== null && b.rating !== undefined ? h('span', { class: 'score big' }, b.rating + '/10') : null, verdictChip(b.verdict))),
    h('div', { class: 'chips' }, chip(b.method, { cls: 'chip-method' }), chip(D.KIND_LABEL[kind]), age !== null ? chip(`Day ${age} off roast`) : null)));

  const pours = (b.pours || []);
  root.appendChild(h('div', { class: 'card' },
    h('h3', null, 'Recipe'),
    kv([
      ['Brew style', kind === 'percolation' ? BREW_STYLE_LABEL[b.brewStyle || 'hot'] : ''],
      ['Ice on bed', b.brewStyle === 'iced' && b.iceBedG != null ? fmtNum(b.iceBedG, 0) + ' g' : ''],
      ['Ice in server', b.brewStyle === 'iced' && b.iceG != null ? fmtNum(b.iceG, 0) + ' g' : ''],
      [kind === 'espresso' ? 'Dose in' : 'Coffee', b.dose != null ? fmtNum(b.dose) + ' g' : ''],
      [kind === 'espresso' ? 'Yield out' : 'Water', b.water != null ? fmtNum(b.water) + ' g' : ''],
      ['Ratio', r ? fmtRatio(r) : ''],
      ['Temperature', b.temp != null ? fmtNum(b.temp) + '°C' : ''],
      ['Grinder', grinderText(b)],
      ['Grind feel', b.grindFeel],
      ['Bloom', (b.bloomWater != null || b.bloomTime != null) ? [b.bloomWater != null ? fmtNum(b.bloomWater) + ' g' : null, b.bloomTime != null ? fmtTime(b.bloomTime) : null].filter(Boolean).join(' for ') : ''],
      ['Pouring done at', b.drawStart != null ? fmtTime(b.drawStart) : ''],
      [TIME_LABEL[kind], b.totalTime != null ? fmtTime(b.totalTime) : ''],
      ['Drawdown', (b.drawStart != null && b.totalTime > b.drawStart) ? fmtTime(b.totalTime - b.drawStart) : ''],
      ['Pre-infusion', b.preinfusion != null ? fmtTime(b.preinfusion) : ''],
      ['Pressure', b.pressure != null ? fmtNum(b.pressure) + ' bar' : ''],
      ['Avg flow', (kind === 'espresso' || kind === 'percolation') && b.water && b.totalTime ? fmtNum(b.water / b.totalTime, 1) + ' g/s' : ''],
    ]),
    pours.length ? h('table', { class: 'table' },
      h('thead', null, h('tr', null, h('th', null, 'Pour'), h('th', null, 'At'), h('th', null, 'Water'))),
      h('tbody', null, pours.map((p, i) => h('tr', null, h('td', null, '#' + (i + 1)), h('td', null, p.t != null ? fmtTime(p.t) : '–'), h('td', null, p.g != null ? fmtNum(p.g) + ' g' : '–'))))) : null,
    b.procedure ? h('p', { class: 'note' }, b.procedure) : null));

  root.appendChild(h('div', { class: 'card' },
    h('h3', null, 'How it tasted'),
    (b.taste && b.taste.length) ? tasteChips(b.taste) : h('p', { class: 'muted' }, 'No flavours logged.'),
    (b.taste && b.taste.length) ? h('p', { class: 'small muted' }, b.taste.map(pathOf).join(' · ')) : null,
    h('div', { class: 'meters' },
      h('div', null, h('span', { class: 'lbl' }, 'Balance'), meter(b.balance, D.BALANCE)),
      h('div', null, h('span', { class: 'lbl' }, 'Strength'), meter(b.strength, D.STRENGTH))),
    b.notes ? h('div', null, h('span', { class: 'lbl' }, 'Notes for next time'), h('p', { class: 'note' }, b.notes)) : null));

  root.appendChild(h('div', { class: 'row-actions left wrap' },
    h('a', { class: 'btn primary', href: '#/brew/new?clone=' + id }, 'Clone & tweak'),
    h('a', { class: 'btn', href: '#/brew/' + id + '/edit' }, 'Edit'),
    h('a', { class: 'btn', href: '#/compare?a=' + id }, 'Compare'),
    btn('Delete', async () => {
      if (await confirmSheet({ title: 'Delete brew', message: 'Delete this brew log? This cannot be undone.', confirmLabel: 'Delete', danger: true })) {
        await D.deleteBrew(id); toast('Brew deleted'); replace('/');
      }
    }, 'ghost danger-text')));

  return { title: b.method, back: '#/', nav: 'brews', el: root };
}

// ---------------------------------------------------------------- form

const RECIPE_KEYS = ['dose', 'water', 'temp', 'grinderId', 'clicks', 'grindFeel', 'brewStyle', 'iceBedG', 'iceG', 'bloomWater', 'bloomTime', 'pours', 'totalTime', 'drawStart', 'preinfusion', 'pressure', 'procedure'];
const RECIPE_DEFAULT = { grinderId: '', grindFeel: '', brewStyle: 'hot', procedure: '', pours: [] };
const BREW_STYLE_LABEL = { hot: 'Hot', iced: 'Japanese (iced)' };
const BAL_SHORT = ['Sour', 'Mild sour', 'Balanced', 'Mild bitter', 'Bitter'];
const STR_SHORT = ['Weak', 'Light', 'Just right', 'Rich', 'Strong'];
const DRAFT_KEY = 'bl.draft';

const loadDraft = () => { try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY)); return d && d.b ? d : null; } catch { return null; } };
const saveDraft = (b, timer) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ b, timer })); } catch { /* storage full or blocked */ } };
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } };
const hasContent = (b) => !!(b.dose || b.water || b.temp || b.clicks || (b.taste && b.taste.length) || b.notes || b.rating);

function blankBrew(beanId) {
  const last = D.brewsSorted()[0];
  return {
    id: null, date: new Date().toISOString(),
    beanId: beanId || (last ? last.beanId : ''), method: last ? last.method : 'V60',
    dose: null, water: null, temp: null, grinderId: last ? last.grinderId : '', clicks: null, grindFeel: '',
    brewStyle: 'hot', iceBedG: null, iceG: null,
    bloomWater: null, bloomTime: null, pours: [], totalTime: null, drawStart: null, preinfusion: null, pressure: null,
    procedure: '', rating: null, verdict: '', balance: null, strength: null, taste: [], notes: '',
  };
}

function cloneForNew(src) {
  const b = blankBrew(src.beanId);
  b.beanId = src.beanId; b.method = src.method;
  for (const k of RECIPE_KEYS) b[k] = clone(src[k] ?? (k in RECIPE_DEFAULT ? RECIPE_DEFAULT[k] : null));
  return b;
}

export async function brewFormView(params) {
  const editing = params.id ? D.brewById(params.id) : null;
  if (params.id && !editing) return notFound('That brew no longer exists.');

  let b;
  let timer = { running: false, startedAt: null, base: 0 };
  let restored = false;
  if (editing) b = clone(editing);
  else if (params.clone && D.brewById(params.clone)) b = cloneForNew(D.brewById(params.clone));
  else {
    const d = params.bean ? null : loadDraft();
    if (d && hasContent(d.b)) { b = d.b; timer = d.timer || timer; restored = true; } else b = blankBrew(params.bean);
  }
  b.pours = b.pours || [];
  b.taste = b.taste || [];

  let finished = false; // set once saved, so the draft is not re-created afterwards
  const persist = debounce(() => { if (!editing && !finished) saveDraft(b, timer); }, 350);
  const update = (k, v) => { b[k] = v; persist(); };

  const root = h('div', { class: 'form-wrap' });
  const secBanner = h('div');
  const secSetup = h('section', { class: 'card' });
  const secBest = h('div');
  const secRecipe = h('section', { class: 'card' });
  const secTimer = h('section', { class: 'card' });
  const secResult = h('section', { class: 'card' });
  let derivedEl = null;
  let timerDisplay = null;
  let totalTimeInput = null;
  let totalTimeHint = null;
  let totalAuto = b.totalTime == null; // only auto-sum while it hasn't been set by hand or by the timer

  // Hybrid has no separate drawdown mark, so its total still sums from bloom
  // time and any pours while untouched. Percolation's total is typed in
  // directly (minSecField below); stops once the timer measures a real one.
  function autoSumTotal() {
    if (!totalAuto) return;
    const kind = D.methodKind(b.method);
    if (kind !== 'hybrid') return;
    const last = Math.max(b.bloomTime || 0, ...b.pours.map((p) => p.t || 0));
    if (last > 0 && last !== b.totalTime) {
      b.totalTime = last; persist();
      if (totalTimeInput) { totalTimeInput.value = last; totalTimeHint.textContent = '= ' + fmtTime(last); }
      refreshDerived();
    }
  }

  // ----- derived readout
  function refreshDerived() {
    if (!derivedEl) return;
    const kind = D.methodKind(b.method);
    const bits = [];
    const r = D.recipeRatio(b);
    if (r) bits.push('Ratio ' + fmtRatio(r));
    if (kind === 'espresso') {
      if (b.water && b.totalTime) bits.push('Flow ' + fmtNum(b.water / b.totalTime, 1) + ' g/s');
    } else if (kind === 'percolation') {
      const poured = (b.bloomWater || 0) + b.pours.reduce((n, p) => n + (p.g || 0), 0);
      if (poured && b.water) bits.push(`Poured ${fmtNum(poured, 0)} of ${fmtNum(b.water, 0)} g`);
      if (b.water && b.totalTime) bits.push('Avg flow ' + fmtNum(b.water / b.totalTime, 1) + ' g/s');
      if (b.drawStart && b.totalTime && b.totalTime > b.drawStart) bits.push('Drawdown ' + fmtTime(b.totalTime - b.drawStart));
    }
    derivedEl.textContent = bits.join(' · ');
  }

  // ----- field builders
  function numField(label, key, opts = {}) {
    const input = h('input', {
      type: 'number', inputmode: 'decimal', step: opts.step || 'any', min: 0, placeholder: opts.ph || '', value: b[key] ?? '',
      oninput: (e) => { update(key, num(e.target.value)); refreshDerived(); },
    });
    return field(label, input, opts.hint);
  }
  function timeField(label, key, opts = {}) {
    const hint = h('div', { class: 'hint' }, b[key] != null ? '= ' + fmtTime(b[key]) : '');
    const input = h('input', {
      type: 'number', inputmode: 'numeric', step: 1, min: 0, value: b[key] ?? '', placeholder: 'seconds',
      oninput: (e) => {
        const v = num(e.target.value); update(key, v); hint.textContent = v != null ? '= ' + fmtTime(v) : ''; refreshDerived();
        if (key === 'totalTime') totalAuto = false; // typed by hand now, stop overwriting it
        if (opts.onInput) opts.onInput();
      },
    });
    const f = field(label, input);
    f.appendChild(hint);
    if (key === 'totalTime') { totalTimeInput = input; totalTimeHint = hint; }
    return f;
  }

  // Minutes/seconds picker (two native scroll wheels on phones) in place of
  // a raw seconds box, for a field people think of as "m:ss" like a stopwatch.
  function minSecField(label, key, opts = {}) {
    const maxMin = opts.maxMin ?? 5;
    const cur = b[key];
    const hint = h('div', { class: 'hint' }, cur != null ? '= ' + fmtTime(cur) : '');
    const commit = () => {
      const v = Number(minSel.value) * 60 + Number(secSel.value);
      update(key, v);
      hint.textContent = '= ' + fmtTime(v);
      refreshDerived();
      if (key === 'totalTime') totalAuto = false; // set by hand now, stop overwriting it
      if (opts.onInput) opts.onInput();
    };
    const minSel = selectEl(
      Array.from({ length: maxMin + 1 }, (_, i) => ({ value: i, label: String(i) })),
      cur != null ? Math.floor(cur / 60) : 0, commit);
    const secSel = selectEl(
      Array.from({ length: 60 }, (_, i) => ({ value: i, label: String(i).padStart(2, '0') })),
      cur != null ? cur % 60 : 0, commit);
    const row = h('div', { class: 'minsec' },
      h('div', { class: 'minsec-col' }, minSel, h('span', { class: 'minsec-lbl' }, 'min')),
      h('div', { class: 'minsec-col' }, secSel, h('span', { class: 'minsec-lbl' }, 'sec')));
    const f = field(label, row);
    f.appendChild(hint);
    return f;
  }

  // ----- setup
  function renderSetup() {
    const beans = [...D.store.beans].sort((x, y) => x.name.localeCompare(y.name));
    const beanSel = selectEl([
      { value: '', label: beans.length ? 'Choose a bean…' : 'No beans yet – add one' },
      ...beans.map((x) => ({ value: x.id, label: x.name + (x.roaster ? ' · ' + x.roaster : '') })),
      { value: '__new', label: '+ Add new bean…' }], b.beanId, (v) => {
      if (v === '__new') {
        beanSel.value = b.beanId || '';
        beanFormSheet(null, (saved) => { update('beanId', saved.id); renderSetup(); renderBest(); });
        return;
      }
      update('beanId', v); renderBest();
    });
    const groups = ['percolation', 'hybrid', 'immersion', 'espresso'];
    const methodSel = selectEl(
      groups.flatMap((k) => D.allMethods().filter((m) => m.kind === k).map((m) => ({ value: m.name, label: m.name, group: D.KIND_LABEL[k] }))),
      b.method, (v) => { update('method', v); renderRecipe(); renderTimer(); renderBest(); });
    secSetup.replaceChildren(
      h('h2', null, 'Coffee & method'),
      field('Date & time', h('input', { type: 'datetime-local', value: toLocalInput(b.date), onchange: (e) => { if (e.target.value) update('date', fromLocalInput(e.target.value)); } })),
      field('Bean', beanSel),
      field('Brew method', methodSel));
  }

  function applyRecipe(src) {
    for (const k of RECIPE_KEYS) b[k] = clone(src[k] ?? (k in RECIPE_DEFAULT ? RECIPE_DEFAULT[k] : null));
    persist(); renderRecipe(); renderTimer(); toast('Recipe copied – adjust what you want to change');
  }

  function renderBest() {
    secBest.replaceChildren();
    if (editing || !b.beanId) return;
    const best = D.bestBrew(b.beanId, b.method);
    if (!best) return;
    secBest.appendChild(h('div', { class: 'banner best-banner' },
      h('div', null,
        h('strong', null, 'Best so far with this bean'),
        h('p', { class: 'small' }, recipeSummary(best) + (best.rating != null ? ' · ' + best.rating + '/10' : ''))),
      btn('Use this recipe', () => applyRecipe(best), 'small')));
  }

  // ----- recipe
  function poursBlock() {
    const wrap = h('div', { class: 'pours' });
    // p.t stays the absolute elapsed time each pour finishes (matches the
    // detail view, CSV and any already-saved brews), but the box people type
    // into is that pour's own duration - the gap since the previous mark.
    // Editing an earlier pour's duration shifts every later p.t by the same
    // amount, so later pours keep the duration they were each given.
    const boundaryBefore = (i) => (i === 0 ? (b.bloomTime || 0) : (b.pours[i - 1].t ?? 0));
    let hintEls = []; // one per row, kept in sync without rebuilding inputs (would steal focus mid-type)
    const refreshHints = () => {
      hintEls.forEach((el, i) => {
        const p = b.pours[i];
        el.textContent = p.t != null ? `${fmtTime(boundaryBefore(i))} → ${fmtTime(p.t)}` : '';
      });
    };
    const paint = () => {
      hintEls = [];
      const rows = b.pours.map((p, i) => {
        const prevB = boundaryBefore(i);
        const dur = p.t != null ? p.t - prevB : null;
        const rangeHint = h('div', { class: 'hint' }, p.t != null ? `${fmtTime(prevB)} → ${fmtTime(p.t)}` : '');
        hintEls.push(rangeHint);
        const durInput = h('input', {
          type: 'number', inputmode: 'numeric', 'aria-label': `Pour ${i + 1} duration, seconds`, placeholder: 'duration (s)', value: dur ?? '',
          oninput: (e) => {
            const newDur = num(e.target.value);
            const prevBNow = boundaryBefore(i);
            const newT = prevBNow + (newDur || 0);
            const delta = p.t != null ? newT - p.t : 0;
            p.t = newT;
            if (delta) for (let j = i + 1; j < b.pours.length; j++) if (b.pours[j].t != null) b.pours[j].t += delta;
            refreshHints();
            persist(); autoSumTotal();
          },
        });
        return h('div', { class: 'pour-row' },
          h('span', { class: 'pour-n' }, '#' + (i + 1)),
          h('div', { class: 'pour-at' }, durInput, rangeHint),
          h('input', { type: 'number', inputmode: 'decimal', 'aria-label': `Pour ${i + 1} water, grams`, placeholder: 'water (g)', value: p.g ?? '', oninput: (e) => { p.g = num(e.target.value); persist(); refreshDerived(); } }),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove pour ${i + 1}`, onclick: () => { b.pours.splice(i, 1); persist(); paint(); refreshDerived(); } }, '×'));
      });
      wrap.replaceChildren(...rows, btn('+ Add pour', () => {
        const prevB = b.pours.length ? b.pours[b.pours.length - 1].t ?? 0 : (b.bloomTime || 0);
        b.pours.push({ t: prevB + 30, g: null });
        persist(); paint(); autoSumTotal();
      }, 'small ghost'));
    };
    paint();
    return wrap;
  }

  function renderRecipe() {
    const kind = D.methodKind(b.method);
    const espresso = kind === 'espresso';
    derivedEl = h('div', { class: 'derived', 'aria-live': 'polite' });

    const grinders = [...D.store.grinders].sort((x, y) => x.name.localeCompare(y.name));
    const grinderSel = selectEl([
      { value: '', label: grinders.length ? 'Not set' : 'No grinders yet – add one' },
      ...grinders.map((g) => ({ value: g.id, label: g.name })),
      { value: '__new', label: '+ Add new grinder…' }], b.grinderId, (v) => {
      if (v === '__new') {
        grinderSel.value = b.grinderId || '';
        grinderFormSheet(null, (saved) => { update('grinderId', saved.id); renderRecipe(); });
        return;
      }
      update('grinderId', v); renderRecipe();
    });
    const unit = grinderUnit(D.grinderById(b.grinderId));
    const feelSel = selectEl([{ value: '', label: 'Not set' }, ...D.GRIND_FEEL.map((x) => ({ value: x, label: x }))], b.grindFeel, (v) => update('grindFeel', v));

    const parts = [
      h('h2', null, 'Recipe'),
    ];
    if (kind === 'percolation') {
      parts.push(field('Brew style', segmented(
        [{ value: 'hot', label: 'Hot' }, { value: 'iced', label: 'Japanese (iced)' }],
        b.brewStyle || 'hot', (v) => { update('brewStyle', v || 'hot'); renderRecipe(); }, 'Hot or Japanese iced brew')));
      if (b.brewStyle === 'iced') {
        parts.push(h('div', { class: 'grid2' },
          numField('Ice on bed (g)', 'iceBedG', { step: 1, hint: 'Placed in the dripper before brewing' }),
          numField('Ice in server (g)', 'iceG', { step: 1, hint: 'Weighed into the server before or during the pour' })));
      }
    }
    parts.push(
      h('div', { class: 'grid2' },
        numField(espresso ? 'Dose in (g)' : 'Coffee (g)', 'dose', { step: 0.1 }),
        numField(espresso ? 'Yield out (g)' : 'Water (g)', 'water', { step: espresso ? 0.1 : 1 })),
      derivedEl,
      numField(espresso ? 'Brew temperature (°C)' : 'Water temperature (°C)', 'temp', { step: 0.5 }),
      field('Grinder', grinderSel),
      h('div', { class: 'grid2' },
        numField(`Setting (${unit})`, 'clicks', { step: 0.5, hint: 'Count from your grinder’s zero point' }),
        field('Grind feel', feelSel)),
    );

    if (kind === 'percolation' || kind === 'hybrid') {
      parts.push(h('div', { class: 'grid2' },
        numField(kind === 'hybrid' ? 'Bloom / pre-wet (g)' : 'Bloom water (g)', 'bloomWater', { step: 1 }),
        timeField('Bloom time (s)', 'bloomTime', { onInput: autoSumTotal })));
      const poursEl = h('div', null, h('span', { class: 'lbl' }, kind === 'hybrid' ? 'Pour steps (optional)' : 'Pours after the bloom'), poursBlock());
      parts.push(kind === 'hybrid'
        ? h('details', { class: 'more', open: b.pours.length > 0 }, h('summary', null, 'Pour steps (optional)'), poursBlock())
        : poursEl);
    }
    if (kind === 'percolation') {
      parts.push(minSecField('Total brew time', 'totalTime'));
    } else if (kind === 'hybrid') {
      parts.push(timeField('Total time (s)', 'totalTime'));
    } else if (kind === 'immersion') {
      parts.push(timeField('Steep time (s)', 'totalTime'));
    } else {
      parts.push(h('div', { class: 'grid2' }, timeField('Pre-infusion (s)', 'preinfusion'), numField('Pressure (bar)', 'pressure', { step: 0.5 })));
      parts.push(timeField('Shot time (s)', 'totalTime'));
    }
    parts.push(field('Procedure & equipment notes', h('textarea', {
      rows: 2, placeholder: 'Water, filter, agitation, stir, press…',
      oninput: (e) => update('procedure', e.target.value),
    }, b.procedure || '')));
    secRecipe.replaceChildren(...parts);
    refreshDerived();
  }

  // ----- timer
  const elapsedMs = () => timer.base + (timer.running ? Date.now() - timer.startedAt : 0);
  let lock = null;
  const acquireLock = async () => { try { if ('wakeLock' in navigator) lock = await navigator.wakeLock.request('screen'); } catch { /* not supported */ } };
  const releaseLock = () => { try { if (lock) lock.release(); } catch { /* ignore */ } lock = null; };
  const onVisible = () => { if (document.visibilityState === 'visible' && timer.running) acquireLock(); };
  document.addEventListener('visibilitychange', onVisible);

  function startTimer() {
    timer.running = true; timer.startedAt = Date.now();
    acquireLock(); saveDraft(b, timer); renderTimer();
  }
  function stopTimer() {
    timer.base = elapsedMs(); timer.running = false; timer.startedAt = null;
    releaseLock();
    update('totalTime', Math.round(timer.base / 1000));
    totalAuto = false; // timer measured it, don't let a later pour edit override it
    saveDraft(b, timer); renderRecipe(); renderTimer();
  }
  const nowSec = () => Math.round(elapsedMs() / 1000);

  function renderTimer() {
    const kind = D.methodKind(b.method);
    const running = timer.running;
    timerDisplay = h('div', { class: 'timer-display', role: 'timer', 'aria-live': 'off' }, fmtTime(elapsedMs() / 1000));
    const controls = [];
    if (!running) {
      controls.push(btn(timer.base > 0 ? 'Resume' : 'Start', startTimer, 'primary big'));
      if (timer.base > 0) controls.push(btn('Reset', () => { timer = { running: false, startedAt: null, base: 0 }; saveDraft(b, timer); renderTimer(); }, 'ghost'));
    } else {
      if (kind === 'percolation' || kind === 'hybrid') {
        controls.push(btn('Bloom done', () => { update('bloomTime', nowSec()); renderRecipe(); toast('Bloom ' + fmtTime(nowSec())); }, 'small'));
        controls.push(btn('+ Pour', () => { b.pours.push({ t: nowSec(), g: null }); persist(); renderRecipe(); toast('Pour at ' + fmtTime(nowSec())); }, 'small'));
      }
      controls.push(btn('Stop', stopTimer, 'danger big'));
    }
    const hint = { percolation: 'Marks fill in bloom time and pours. Stop sets total time.', hybrid: 'Stop sets total time.', immersion: 'Stop sets steep time.', espresso: 'Stop sets shot time.' }[kind];
    secTimer.replaceChildren(h('h2', null, 'Timer'), timerDisplay, h('div', { class: 'timer-controls' }, controls), h('p', { class: 'small muted' }, hint));
  }
  const tick = setInterval(() => { if (timerDisplay && timer.running) timerDisplay.textContent = fmtTime(elapsedMs() / 1000); }, 250);

  // ----- result
  function renderResult() {
    const chipsBox = h('div');
    const paintTaste = () => {
      chipsBox.replaceChildren(b.taste.length
        ? tasteChips(b.taste, { removable: (id) => { b.taste = b.taste.filter((x) => x !== id); persist(); paintTaste(); } })
        : h('p', { class: 'muted small' }, 'Nothing selected yet.'));
    };
    paintTaste();
    const rating = segmented(Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) })), b.rating, (v) => update('rating', v), 'Overall score out of 10');
    rating.classList.add('seg-wrap');
    secResult.replaceChildren(
      h('h2', null, 'How did it taste?'),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Flavours'), chipsBox,
        btn('Open flavour wheel', () => openWheelSheet(b.taste, (ids) => { b.taste = ids; persist(); paintTaste(); }), 'ghost')),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Balance'),
        segmented(BAL_SHORT.map((l, i) => ({ value: i, label: l })), b.balance, (v) => update('balance', v), 'Balance from sour to bitter')),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Strength'),
        segmented(STR_SHORT.map((l, i) => ({ value: i, label: l })), b.strength, (v) => update('strength', v), 'Strength from weak to strong')),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Did it work?'),
        segmented([{ value: 'worked', label: 'Worked', cls: 'v-worked' }, { value: 'okay', label: 'Okay', cls: 'v-okay' }, { value: 'failed', label: "Didn't work", cls: 'v-failed' }], b.verdict || null, (v) => update('verdict', v || ''), 'Did this brew work')),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Overall score'), rating),
      field('Notes & what to change next time', h('textarea', { rows: 3, placeholder: 'Finer? Hotter? Longer bloom?', oninput: (e) => update('notes', e.target.value) }, b.notes || '')));
  }

  // ----- banner for restored draft
  function renderBanner() {
    secBanner.replaceChildren();
    if (restored) {
      secBanner.appendChild(h('div', { class: 'banner' },
        h('span', null, 'Restored your unsaved brew.'),
        btn('Start fresh', () => {
          clearDraft(); b = blankBrew(); timer = { running: false, startedAt: null, base: 0 }; restored = false; renderAll();
        }, 'small')));
    }
  }

  function renderAll() { renderBanner(); renderSetup(); renderBest(); renderRecipe(); renderTimer(); renderResult(); }

  // ----- save
  async function onSave() {
    if (!b.beanId) { toast('Choose a bean first'); return; }
    if (timer.running) stopTimer();
    const out = { ...b, pours: b.pours.filter((p) => p.t != null || p.g != null) };
    const saved = await D.saveBrew(out);
    finished = true;
    clearDraft();
    toast(editing ? 'Changes saved' : 'Brew saved');
    replace('/brew/' + saved.id);
  }

  root.append(secBanner, secSetup, secBest, secRecipe, secTimer, secResult,
    h('div', { class: 'savebar' },
      btn('Cancel', () => { (history.length > 1) ? history.back() : navigate('/'); }, 'ghost'),
      btn(editing ? 'Save changes' : 'Save brew', onSave, 'primary')));
  renderAll();

  return {
    title: editing ? 'Edit brew' : 'New brew', back: editing ? '#/brew/' + editing.id : '#/', hideNav: true, nav: 'brews', el: root,
    cleanup() {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      releaseLock();
      if (!editing && !finished) saveDraft(b, timer);
    },
  };
}

// ---------------------------------------------------------------- compare

export async function compareView(params) {
  const all = D.brewsSorted();
  if (all.length < 2) {
    return { title: 'Compare', back: '#/insights', nav: 'insights', el: h('div', { class: 'empty' }, h('p', null, 'Log at least two brews to compare them.'), h('a', { class: 'btn primary', href: '#/brew/new' }, 'Log a brew')) };
  }
  let A = D.brewById(params.a) || all[0];
  let B = D.brewById(params.b)
    || all.find((x) => x.id !== A.id && x.beanId === A.beanId)
    || all.find((x) => x.id !== A.id);

  const root = h('div', { class: 'stack' });
  const out = h('div');
  const label = (x) => `${fmtDateTime(x.date)} · ${(D.beanById(x.beanId) || { name: 'Unknown' }).name} · ${x.method}`;
  const opts = all.map((x) => ({ value: x.id, label: label(x) }));
  const selA = selectEl(opts, A.id, (v) => { A = D.brewById(v); paint(); });
  const selB = selectEl(opts, B.id, (v) => { B = D.brewById(v); paint(); });
  root.append(h('div', { class: 'grid2' }, field('Brew A', selA), field('Brew B', selB)), out);

  const rows = [
    { label: 'Bean', get: (x) => (D.beanById(x.beanId) || {}).name },
    { label: 'Method', get: (x) => x.method },
    { label: 'Coffee (g)', get: (x) => x.dose, num: 1 },
    { label: 'Water / yield (g)', get: (x) => x.water, num: 1 },
    { label: 'Ratio', get: (x) => { const r = D.recipeRatio(x); return r ? Math.round(r * 10) / 10 : null; }, num: 1, fmt: (v) => fmtRatio(v) },
    { label: 'Temp (°C)', get: (x) => x.temp, num: 1 },
    { label: 'Grinder', get: (x) => (D.grinderById(x.grinderId) || {}).name },
    { label: 'Setting', get: (x) => x.clicks, num: 1 },
    { label: 'Grind feel', get: (x) => x.grindFeel },
    { label: 'Bloom (g)', get: (x) => x.bloomWater, num: 1 },
    { label: 'Bloom time', get: (x) => x.bloomTime, num: 0, fmt: fmtTime },
    { label: 'Pours', get: (x) => (x.pours || []).map((p) => `${p.t != null ? fmtTime(p.t) : '?'} ${p.g != null ? fmtNum(p.g) + 'g' : '?'}`).join(', ') },
    { label: 'Total time', get: (x) => x.totalTime, num: 0, fmt: fmtTime },
    { label: 'Days off roast', get: (x) => D.daysOff(x), num: 0 },
    { label: 'Score', get: (x) => x.rating, num: 1 },
    { label: 'Balance', get: (x) => (x.balance != null ? D.BALANCE[x.balance] : null) },
    { label: 'Strength', get: (x) => (x.strength != null ? D.STRENGTH[x.strength] : null) },
    { label: 'Result', get: (x) => (x.verdict ? D.VERDICT[x.verdict] : null) },
  ];

  function paint() {
    const body = rows.map((r) => {
      const va = r.get(A), vb = r.get(B);
      const fa = va === null || va === undefined || va === '' ? '–' : (r.fmt ? r.fmt(va) : (typeof va === 'number' ? fmtNum(va, 1) : va));
      const fb = vb === null || vb === undefined || vb === '' ? '–' : (r.fmt ? r.fmt(vb) : (typeof vb === 'number' ? fmtNum(vb, 1) : vb));
      const diff = JSON.stringify(va ?? null) !== JSON.stringify(vb ?? null);
      let delta = null;
      if (diff && r.num !== undefined && typeof va === 'number' && typeof vb === 'number') {
        const d = vb - va;
        delta = h('span', { class: 'delta' }, (d > 0 ? '+' : '') + (r.fmt === fmtTime ? fmtTime(Math.abs(d)).replace(/^/, d < 0 ? '-' : '+') : fmtNum(d, 1)));
      }
      return h('tr', { class: diff ? 'diff' : '' }, h('th', { scope: 'row' }, r.label), h('td', null, fa), h('td', null, fb, delta));
    });
    const ta = new Set(A.taste || []), tb = new Set(B.taste || []);
    const both = [...ta].filter((x) => tb.has(x)), onlyA = [...ta].filter((x) => !tb.has(x)), onlyB = [...tb].filter((x) => !ta.has(x));
    out.replaceChildren(
      h('table', { class: 'table compare' }, h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'A'), h('th', null, 'B'))), h('tbody', null, body)),
      h('div', { class: 'card' },
        h('h3', null, 'Flavours'),
        h('div', null, h('span', { class: 'lbl' }, 'In both'), both.length ? tasteChips(both) : h('p', { class: 'muted small' }, 'None in common')),
        h('div', null, h('span', { class: 'lbl' }, 'Only in A'), onlyA.length ? tasteChips(onlyA) : h('p', { class: 'muted small' }, '–')),
        h('div', null, h('span', { class: 'lbl' }, 'Only in B'), onlyB.length ? tasteChips(onlyB) : h('p', { class: 'muted small' }, '–'))),
      ...((A.notes || B.notes) ? [h('div', { class: 'card' }, h('h3', null, 'Notes'), A.notes ? h('p', { class: 'note' }, h('strong', null, 'A: '), A.notes) : null, B.notes ? h('p', { class: 'note' }, h('strong', null, 'B: '), B.notes) : null)] : []),
      h('div', { class: 'row-actions left wrap' }, h('a', { class: 'btn', href: '#/brew/' + A.id }, 'Open A'), h('a', { class: 'btn', href: '#/brew/' + B.id }, 'Open B')));
  }
  paint();
  return { title: 'Compare brews', back: '#/insights', nav: 'insights', el: root };
}
