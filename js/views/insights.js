import { h, field, selectEl, chip, mean, minmax, fmtNum, fmtTime, fmtRatio, ratioOf, fmtDateTime } from '../util.js';
import * as D from '../data.js';
import { createWheel } from '../wheel.js';
import { scatter, verdictLegend, bars } from '../charts.js';
import { WHEEL, NODE, catOf, nameOf, pathOf, colorOf, CATEGORY_COLOR } from '../flavors.js';
import { brewCard, grinderText, recipeSummary, verdictChip } from './brews.js';
import { grinderUnit } from './grinders.js';
import { tasteChips } from './taste.js';

const ui = {
  tab: 'taste',
  taste: { method: '', beanId: '', onlyWorked: false },
  dial: { beanId: '', method: '', grinderId: '', x: 'clicks', y: 'rating', picked: null },
  patterns: { method: '', grinderId: '' },
};

const beanName = (id) => (D.beanById(id) || { name: 'Unknown bean' }).name;
const pct = (n, total) => (total ? Math.round((n / total) * 100) + '%' : '0%');

function emptyNote(text) { return h('div', { class: 'empty small' }, h('p', null, text)); }

// ---------------------------------------------------------------- taste tab

function tasteTab() {
  const box = h('div', { class: 'stack' });
  const t = ui.taste;
  const methods = D.usedMethods();
  const beansUsed = D.store.beans.filter((b) => D.store.brews.some((x) => x.beanId === b.id));
  const controls = h('div', { class: 'grid2' },
    field('Method', selectEl([{ value: '', label: 'All methods' }, ...methods.map((m) => ({ value: m, label: m }))], t.method, (v) => { t.method = v; paint(); })),
    field('Bean', selectEl([{ value: '', label: 'All beans' }, ...beansUsed.map((b) => ({ value: b.id, label: b.name }))], t.beanId, (v) => { t.beanId = v; paint(); })));
  const worked = h('label', { class: 'check' },
    h('input', { type: 'checkbox', checked: t.onlyWorked, onchange: (e) => { t.onlyWorked = e.target.checked; paint(); } }),
    h('span', null, 'Only brews marked “Worked”'));
  const out = h('div', { class: 'stack' });
  box.append(controls, worked, out);

  function paint() {
    let brews = D.store.brews.filter((b) => b.taste && b.taste.length);
    if (t.method) brews = brews.filter((b) => b.method === t.method);
    if (t.beanId) brews = brews.filter((b) => b.beanId === t.beanId);
    if (t.onlyWorked) brews = brews.filter((b) => b.verdict === 'worked');
    if (!brews.length) {
      out.replaceChildren(emptyNote('No brews with flavours logged for this selection yet. Tap the flavour wheel when you save a brew and your profile builds up here.'));
      return;
    }
    const counts = new Map();
    const catBrews = new Map(WHEEL.map((c) => [c.name, new Set()]));
    for (const b of brews) {
      for (const id of new Set(b.taste)) {
        counts.set(id, (counts.get(id) || 0) + 1);
        const c = catOf(id);
        if (catBrews.has(c)) catBrews.get(c).add(b.id);
      }
    }
    const detail = h('div', { class: 'card wheel-detail' }, h('p', { class: 'muted small' }, 'Tap a flavour on the wheel to see the brews behind it.'));
    const wheel = createWheel({
      mode: 'heat', counts,
      onPick: (node) => {
        const list = brews.filter((b) => b.taste.includes(node.id));
        const n = list.length;
        const avg = mean(list.filter((b) => b.rating != null).map((b) => b.rating));
        detail.replaceChildren(
          h('h3', null, chip(node.name, { color: node.color }), ' ', h('span', { class: 'muted small' }, pathOf(node.id))),
          h('p', { class: 'small' }, `${n} brew${n === 1 ? '' : 's'}${avg !== null ? ' · average score ' + fmtNum(avg, 1) : ''}`),
          n ? h('div', { class: 'stack tight' }, list.slice(0, 6).map((b) => h('a', { class: 'mini-link', href: '#/brew/' + b.id },
            h('span', null, beanName(b.beanId) + ' · ' + b.method), h('span', { class: 'muted small' }, fmtDateTime(b.date))))) : h('p', { class: 'muted small' }, 'Nothing logged for this one yet.'));
      },
    });
    // categories
    const catRows = [...catBrews.entries()].filter(([, s]) => s.size).sort((a, b) => b[1].size - a[1].size)
      .map(([name, s]) => ({ label: name, value: s.size, text: `${s.size} · ${pct(s.size, brews.length)}`, color: CATEGORY_COLOR[name] }));
    // top descriptors
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => {
      const list = brews.filter((b) => b.taste.includes(id) && b.rating != null);
      const avg = mean(list.map((b) => b.rating));
      return h('li', null, chip(nameOf(id), { color: colorOf(id), title: pathOf(id) }),
        h('span', { class: 'top-n' }, `${n} brew${n === 1 ? '' : 's'}`),
        h('span', { class: 'muted small' }, avg !== null ? `avg ${fmtNum(avg, 1)}/10` : ''));
    });

    out.replaceChildren(
      h('p', { class: 'muted small' }, `Based on ${brews.length} brew${brews.length === 1 ? '' : 's'} with flavours logged${t.method ? ' in ' + t.method : ''}.`),
      h('div', { class: 'wheel-wrap' }, wheel.el),
      detail,
      h('div', { class: 'card' }, h('h3', null, 'Flavour families'), bars(catRows, brews.length)),
      h('div', { class: 'card' }, h('h3', null, 'Most noted'), h('ul', { class: 'top-list' }, top)),
      recipeByFlavour(brews));
  }
  paint();
  return box;
}

function recipeByFlavour(brews) {
  const cats = WHEEL.map((c) => c.name).filter((c) => brews.filter((b) => b.taste.some((id) => catOf(id) === c)).length >= 2);
  if (!cats.length || brews.length < 4) {
    return h('div', { class: 'card' }, h('h3', null, 'Recipe by flavour'), h('p', { class: 'muted small' }, 'Once a flavour family shows up in at least two brews (and you have four or more), this compares the average recipe for brews that had it against the rest.'));
  }
  const metric = (list, f) => mean(list.map(f).filter((v) => v !== null && v !== undefined));
  const cell = (withL, withoutL, f, dec) => {
    const a = metric(withL, f), b = metric(withoutL, f);
    if (a === null) return h('td', null, '–');
    const d = b !== null ? a - b : null;
    return h('td', null, fmtNum(a, dec), d !== null && Math.abs(d) >= 0.05 ? h('span', { class: 'delta' }, (d > 0 ? '+' : '') + fmtNum(d, dec)) : null);
  };
  const rows = cats.map((c) => {
    const withL = brews.filter((b) => b.taste.some((id) => catOf(id) === c));
    const withoutL = brews.filter((b) => !b.taste.some((id) => catOf(id) === c));
    return h('tr', null,
      h('th', { scope: 'row' }, h('i', { class: 'dot', style: { background: CATEGORY_COLOR[c] } }), c),
      h('td', null, String(withL.length)),
      cell(withL, withoutL, (b) => b.temp, 1),
      cell(withL, withoutL, (b) => ratioOf(b.dose, b.water), 1),
      cell(withL, withoutL, (b) => b.totalTime, 0));
  });
  return h('div', { class: 'card' },
    h('h3', null, 'Recipe by flavour'),
    h('p', { class: 'muted small' }, 'Average for brews with that flavour family. The small number is the difference versus brews without it. With few brews, treat this as a hint.'),
    h('div', { class: 'table-scroll' }, h('table', { class: 'table' },
      h('thead', null, h('tr', null, h('th', null, 'Flavour'), h('th', null, 'Brews'), h('th', null, '°C'), h('th', null, '1:x'), h('th', null, 'Sec'))),
      h('tbody', null, rows))));
}

// ---------------------------------------------------------------- dial-in tab

const X_OPTIONS = [
  { value: 'clicks', label: 'Grind setting' },
  { value: 'temp', label: 'Temperature (°C)' },
  { value: 'ratio', label: 'Ratio (1:x)' },
  { value: 'time', label: 'Total time (s)' },
  { value: 'days', label: 'Days off roast' },
  { value: 'dose', label: 'Coffee dose (g)' },
];
const Y_OPTIONS = [
  { value: 'rating', label: 'Overall score' },
  { value: 'balance', label: 'Balance (sour to bitter)' },
  { value: 'strength', label: 'Strength' },
];

function xValue(b, key) {
  switch (key) {
    case 'clicks': return b.clicks;
    case 'temp': return b.temp;
    case 'ratio': return ratioOf(b.dose, b.water);
    case 'time': return b.totalTime;
    case 'days': return D.daysOff(b);
    case 'dose': return b.dose;
    default: return null;
  }
}
const yValue = (b, key) => (key === 'rating' ? b.rating : key === 'balance' ? b.balance : b.strength);

function dialTab() {
  const box = h('div', { class: 'stack' });
  const d = ui.dial;
  const beansUsed = D.store.beans.filter((b) => D.store.brews.some((x) => x.beanId === b.id));
  if (!beansUsed.length) return emptyNote('Log a few brews of the same bean and this chart shows where your sweet spot is.');
  if (!d.beanId || !beansUsed.some((b) => b.id === d.beanId)) {
    d.beanId = beansUsed.map((b) => ({ b, n: D.store.brews.filter((x) => x.beanId === b.id).length })).sort((a, c) => c.n - a.n)[0].b.id;
    d.method = ''; d.grinderId = '';
  }
  const out = h('div', { class: 'stack' });
  const controls = h('div', { class: 'stack tight' });
  box.append(controls, out);

  function paintControls() {
    const beanBrews = D.store.brews.filter((b) => b.beanId === d.beanId);
    const methods = [...new Set(beanBrews.map((b) => b.method))];
    const grinderIds = [...new Set(beanBrews.filter((b) => (!d.method || b.method === d.method)).map((b) => b.grinderId).filter(Boolean))];
    if (d.x === 'clicks' && !d.grinderId && grinderIds.length) d.grinderId = grinderIds[0];
    if (d.grinderId && !grinderIds.includes(d.grinderId)) d.grinderId = grinderIds[0] || '';
    controls.replaceChildren(
      field('Bean', selectEl(beansUsed.map((b) => ({ value: b.id, label: b.name })), d.beanId, (v) => { d.beanId = v; d.method = ''; d.grinderId = ''; d.picked = null; paintControls(); paint(); })),
      h('div', { class: 'grid2' },
        field('Method', selectEl([{ value: '', label: 'All methods' }, ...methods.map((m) => ({ value: m, label: m }))], d.method, (v) => { d.method = v; d.picked = null; paintControls(); paint(); })),
        field('Grinder', selectEl([{ value: '', label: 'All grinders' }, ...grinderIds.map((g) => ({ value: g, label: (D.grinderById(g) || { name: 'Unknown' }).name }))], d.grinderId, (v) => { d.grinderId = v; d.picked = null; paint(); }))),
      h('div', { class: 'grid2' },
        field('Across', selectEl(X_OPTIONS, d.x, (v) => { d.x = v; d.picked = null; paintControls(); paint(); })),
        field('Measure', selectEl(Y_OPTIONS, d.y, (v) => { d.y = v; d.picked = null; paint(); }))));
  }

  function paint() {
    let brews = D.store.brews.filter((b) => b.beanId === d.beanId);
    if (d.method) brews = brews.filter((b) => b.method === d.method);
    if (d.grinderId) brews = brews.filter((b) => b.grinderId === d.grinderId);
    const grinder = D.grinderById(d.grinderId);
    const xl = d.x === 'clicks' ? `Grind setting (${grinderUnit(grinder)})` : X_OPTIONS.find((o) => o.value === d.x).label;
    const yl = Y_OPTIONS.find((o) => o.value === d.y).label;
    const pts = brews.map((b) => ({ id: b.id, x: xValue(b, d.x), y: yValue(b, d.y), verdict: b.verdict || 'none', label: fmtDateTime(b.date) }))
      .filter((p) => p.x !== null && p.x !== undefined && p.y !== null && p.y !== undefined);
    const notes = [];
    if (d.x === 'clicks' && !d.grinderId) notes.push('Grind settings are only comparable within one grinder. Pick a grinder above.');
    if (pts.length < 2) {
      out.replaceChildren(...notes.map((n) => h('p', { class: 'muted small' }, n)),
        emptyNote(`Only ${pts.length} brew${pts.length === 1 ? ' has' : 's have'} both ${xl.toLowerCase()} and ${yl.toLowerCase()} logged. Log a few more to see a pattern.`));
      return;
    }
    let yDomain, yTicks, refLine;
    if (d.y === 'balance' || d.y === 'strength') {
      const labs = d.y === 'balance' ? D.BALANCE : D.STRENGTH;
      yDomain = [-0.3, 4.3];
      yTicks = labs.map((l, i) => ({ v: i, label: l.replace('Slightly ', 'Sl. ').replace('Just right', 'Right') }));
      refLine = 2;
    } else yDomain = [0, 10];
    // balanced zone: x range of brews that tasted balanced
    let band = null;
    const balanced = brews.filter((b) => b.balance === 2 && xValue(b, d.x) !== null && xValue(b, d.x) !== undefined).map((b) => xValue(b, d.x));
    if (d.y === 'balance' && balanced.length) { const [lo, hi] = minmax(balanced); band = { x0: lo - 0.15, x1: hi + 0.15 }; }
    const good = brews.filter((b) => b.verdict === 'worked' && xValue(b, d.x) !== null && xValue(b, d.x) !== undefined).map((b) => xValue(b, d.x));
    if (balanced.length) {
      const [lo, hi] = minmax(balanced);
      notes.push(`Brews that tasted balanced: ${xl.toLowerCase()} ${fmtNum(lo, 1)}${hi !== lo ? '–' + fmtNum(hi, 1) : ''} (${balanced.length} brew${balanced.length === 1 ? '' : 's'}).`);
    }
    if (good.length) {
      const [lo, hi] = minmax(good);
      notes.push(`Brews marked “Worked”: ${fmtNum(lo, 1)}${hi !== lo ? '–' + fmtNum(hi, 1) : ''} (${good.length}).`);
    }
    const detail = h('div', { class: 'stack tight' });
    const showPicked = () => {
      const b = d.picked ? D.brewById(d.picked) : null;
      detail.replaceChildren(...(b ? [brewCard(b)] : [h('p', { class: 'muted small' }, 'Tap a point to see that brew.')]));
    };
    const draw = () => {
      const chart = scatter({
        points: pts, xLabel: xl, yLabel: yl, yDomain, yTicks, refLine, band, selectedId: d.picked,
        onPick: (id) => { d.picked = id; draw(); },
      });
      holder.replaceChildren(chart);
      showPicked();
    };
    const holder = h('div', { class: 'chart-wrap' });
    out.replaceChildren(
      h('div', { class: 'card' }, h('h3', null, `${yl} by ${xl.toLowerCase()}`), holder, verdictLegend(),
        band ? h('p', { class: 'small muted' }, 'Shaded band: where brews tasted balanced.') : null),
      ...notes.map((n) => h('p', { class: 'small' }, n)),
      detail);
    draw();
  }
  paintControls();
  paint();
  return box;
}

// ---------------------------------------------------------------- patterns tab (worked vs not)

function patternsTab() {
  const box = h('div', { class: 'stack' });
  const p = ui.patterns;
  const methods = D.usedMethods();
  if (!methods.length) return emptyNote('Mark brews as Worked, Okay or Didn’t work and this compares their recipes.');
  if (!p.method || !methods.includes(p.method)) {
    p.method = methods.map((m) => ({ m, n: D.store.brews.filter((b) => b.method === m).length })).sort((a, b) => b.n - a.n)[0].m;
    p.grinderId = '';
  }
  const out = h('div', { class: 'stack' });
  const controls = h('div', { class: 'grid2' });
  box.append(controls, out);

  function paintControls() {
    const grinderIds = [...new Set(D.store.brews.filter((b) => b.method === p.method).map((b) => b.grinderId).filter(Boolean))];
    if (p.grinderId && !grinderIds.includes(p.grinderId)) p.grinderId = '';
    controls.replaceChildren(
      field('Method', selectEl(methods.map((m) => ({ value: m, label: m })), p.method, (v) => { p.method = v; p.grinderId = ''; paintControls(); paint(); })),
      field('Grinder (for settings)', selectEl([{ value: '', label: 'Any' }, ...grinderIds.map((g) => ({ value: g, label: (D.grinderById(g) || { name: 'Unknown' }).name }))], p.grinderId, (v) => { p.grinderId = v; paint(); })));
  }

  function paint() {
    const brews = D.store.brews.filter((b) => b.method === p.method);
    const groups = [['worked', 'Worked'], ['okay', 'Okay'], ['failed', "Didn't work"]].map(([k, label]) => ({ k, label, list: brews.filter((b) => b.verdict === k) }));
    const judged = groups.reduce((n, g) => n + g.list.length, 0);
    if (!judged) {
      out.replaceChildren(emptyNote(`None of your ${p.method} brews are marked yet. Choose Worked, Okay or Didn’t work when you log a brew.`));
      return;
    }
    const unit = grinderUnit(D.grinderById(p.grinderId));
    const params = [
      { label: 'Coffee (g)', f: (b) => b.dose, dec: 1 },
      { label: 'Water / yield (g)', f: (b) => b.water, dec: 0 },
      { label: 'Ratio (1:x)', f: (b) => ratioOf(b.dose, b.water), dec: 1 },
      { label: 'Temp (°C)', f: (b) => b.temp, dec: 1 },
      p.grinderId ? { label: `Setting (${unit})`, f: (b) => (b.grinderId === p.grinderId ? b.clicks : null), dec: 1 } : null,
      { label: 'Bloom time (s)', f: (b) => b.bloomTime, dec: 0 },
      { label: 'Total time (s)', f: (b) => b.totalTime, dec: 0 },
      { label: 'Days off roast', f: (b) => D.daysOff(b), dec: 0 },
    ].filter(Boolean);
    const rows = params.map((pr) => {
      const cells = groups.map((g) => {
        const vals = g.list.map(pr.f).filter((v) => v !== null && v !== undefined);
        if (!vals.length) return h('td', null, '–');
        const [lo, hi] = minmax(vals);
        return h('td', null, fmtNum(mean(vals), pr.dec), vals.length > 1 && lo !== hi ? h('span', { class: 'range' }, `${fmtNum(lo, pr.dec)}–${fmtNum(hi, pr.dec)}`) : null);
      });
      return h('tr', null, h('th', { scope: 'row' }, pr.label), ...cells);
    });
    // taste in worked vs failed
    const topTaste = (list) => {
      const c = new Map();
      list.forEach((b) => (b.taste || []).forEach((id) => c.set(id, (c.get(id) || 0) + 1)));
      return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
    };
    out.replaceChildren(
      h('div', { class: 'card' },
        h('h3', null, `${p.method}: what separates the results`),
        h('p', { class: 'muted small' }, 'Average per column, with the lowest to highest value underneath.'),
        h('div', { class: 'table-scroll' }, h('table', { class: 'table patterns' },
          h('thead', null, h('tr', null, h('th', null, ''), groups.map((g) => h('th', { class: 'v-' + g.k }, g.label, h('span', { class: 'range' }, g.list.length + (g.list.length === 1 ? ' brew' : ' brews'))))) ),
          h('tbody', null, rows))),
        judged < 6 ? h('p', { class: 'small muted' }, 'Few marked brews so far, so treat differences as hints rather than rules.') : null),
      h('div', { class: 'card' },
        h('h3', null, 'Flavours by result'),
        ...groups.filter((g) => g.list.length).map((g) => {
          const t = topTaste(g.list);
          return h('div', null, h('span', { class: 'lbl' }, g.label), t.length ? tasteChips(t) : h('p', { class: 'muted small' }, 'No flavours logged'));
        })));
  }
  paintControls();
  paint();
  return box;
}

// ---------------------------------------------------------------- view

export async function insightsView() {
  const root = h('div', { class: 'stack' });
  const body = h('div');
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const defs = [['taste', 'Taste'], ['dial', 'Dial-in'], ['patterns', 'What worked']];

  function paint() {
    tabs.replaceChildren(...defs.map(([k, label]) => h('button', {
      type: 'button', role: 'tab', class: 'tab', 'aria-selected': String(ui.tab === k),
      onclick: () => { ui.tab = k; paint(); },
    }, label)));
    body.replaceChildren(ui.tab === 'taste' ? tasteTab() : ui.tab === 'dial' ? dialTab() : patternsTab());
  }

  if (!D.store.brews.length) {
    root.appendChild(h('div', { class: 'empty' },
      h('p', { class: 'empty-title' }, 'Nothing to analyse yet'),
      h('p', { class: 'muted' }, 'Insights show your taste profile per method, where your grind and temperature sweet spots are, and what separates brews that worked from those that did not.'),
      h('a', { class: 'btn primary', href: '#/brew/new' }, 'Log a brew')));
    return { title: 'Insights', nav: 'insights', el: root };
  }
  root.append(tabs, body, h('a', { class: 'btn ghost', href: '#/compare' }, 'Compare two brews'));
  paint();
  return { title: 'Insights', nav: 'insights', el: root };
}
