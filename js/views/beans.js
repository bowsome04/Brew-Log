import { h, field, selectEl, chip, btn, openSheet, confirmSheet, toast, debounce, fmtDate, fmtNum, fmtRatio, ratioOf, daysOffRoast } from '../util.js';
import * as D from '../data.js';
import { navigate, replace } from '../router.js';
import { brewCard, recipeSummary } from './brews.js';

const SPECIES = ['Arabica', 'Robusta', 'Liberica', 'Excelsa', 'Blend'];
const VARIETIES = ['Gesha / Geisha', 'SL28', 'SL34', 'Bourbon', 'Pink Bourbon', 'Typica', 'Caturra', 'Catuai', 'Pacamara', 'Heirloom', 'Castillo', 'Catimor', 'Sidra', 'Java', 'Ateng', 'Mixed / unknown'];
const PROCESSES = ['Washed', 'Natural', 'Honey', 'Anaerobic washed', 'Anaerobic natural', 'Wet-hulled (Giling Basah)', 'Carbonic maceration', 'Thermal shock', 'Decaf'];
const ROAST_LEVELS = ['Light', 'Medium-light', 'Medium', 'Medium-dark', 'Dark'];
const ROAST_FOR = ['Filter', 'Espresso', 'Omni'];

export function beanLabel(bean) {
  return bean ? bean.name + (bean.roaster ? ' · ' + bean.roaster : '') : 'Unknown bean';
}

// A half-filled "new bean" form is kept here so leaving the page or sheet
// (back button, nav tap, accidental dismiss) before saving doesn't lose it.
const BEAN_DRAFT_KEY = 'bl.draft.bean';
const loadBeanDraft = () => { try { return JSON.parse(localStorage.getItem(BEAN_DRAFT_KEY)) || null; } catch { return null; } };
const saveBeanDraft = (b) => { try { localStorage.setItem(BEAN_DRAFT_KEY, JSON.stringify(b)); } catch { /* storage full or blocked */ } };
const clearBeanDraft = () => { try { localStorage.removeItem(BEAN_DRAFT_KEY); } catch { /* ignore */ } };
const hasBeanContent = (b) => !!(b.name || b.roaster || b.country || b.region || b.variety || b.process || b.roastLevel || b.roastFor || b.roastDate || b.altitude || b.roasterNotes || b.notes);
const blankBean = () => ({ name: '', roaster: '', country: '', region: '', species: 'Arabica', variety: '', process: '', roastLevel: '', roastFor: '', roastDate: '', altitude: '', roasterNotes: '', notes: '' });

export function buildBeanForm(bean, { onSave, onCancel, useDraft = false }) {
  let restored = false;
  let b;
  if (bean) b = { ...bean };
  else {
    const d = useDraft ? loadBeanDraft() : null;
    if (d && hasBeanContent(d)) { b = d; restored = true; } else b = blankBean();
  }
  let finished = false;
  const persist = debounce(() => { if (useDraft && !finished) saveBeanDraft(b); }, 350);
  const touch = (key, v) => { b[key] = v; persist(); };

  const text = (key, ph, extra = {}) => h('input', { type: 'text', value: b[key] || '', placeholder: ph || '', autocomplete: 'off', oninput: (e) => touch(key, e.target.value), ...extra });
  const listInput = (key, options, ph) => {
    const id = 'dl-' + key + Math.random().toString(36).slice(2, 6);
    return [h('input', { type: 'text', list: id, value: b[key] || '', placeholder: ph || '', autocomplete: 'off', oninput: (e) => touch(key, e.target.value) }),
      h('datalist', { id }, options.map((o) => h('option', { value: o })))];
  };
  const [varietyInput, varietyList] = listInput('variety', VARIETIES, 'Gesha, SL28, Bourbon…');
  const [processInput, processList] = listInput('process', PROCESSES, 'Washed, Natural…');
  const nameInput = text('name', 'e.g. Ethiopia Guji Hambela');
  const roasterInput = text('roaster', 'e.g. Common Man Coffee');
  const form = h('form', {
    class: 'form-stack',
    onsubmit: async (e) => {
      e.preventDefault();
      if (!b.name.trim()) { toast('Give the bean a name'); nameInput.focus(); return; }
      if (!b.roaster.trim()) { toast('Add the roaster (or "Home roast")'); roasterInput.focus(); return; }
      b.name = b.name.trim(); b.roaster = b.roaster.trim();
      b.altitude = b.altitude === '' ? '' : Number(b.altitude) || '';
      const saved = await D.saveBean(b);
      finished = true;
      clearBeanDraft();
      onSave(saved);
    },
  },
    field('Bean name', nameInput),
    field('Roaster', roasterInput),
    h('div', { class: 'grid2' },
      field('Country', text('country', 'Ethiopia')),
      field('Region / farm', text('region', 'Guji, Hambela'))),
    h('div', { class: 'grid2' },
      field('Species', selectEl(SPECIES.map((v) => ({ value: v, label: v })), b.species, (v) => touch('species', v))),
      field('Variety', varietyInput)),
    varietyList,
    field('Process', processInput), processList,
    h('div', { class: 'grid2' },
      field('Roast level', selectEl([{ value: '', label: 'Not set' }, ...ROAST_LEVELS.map((v) => ({ value: v, label: v }))], b.roastLevel, (v) => touch('roastLevel', v))),
      field('Roasted for', selectEl([{ value: '', label: 'Not set' }, ...ROAST_FOR.map((v) => ({ value: v, label: v }))], b.roastFor, (v) => touch('roastFor', v)))),
    h('div', { class: 'grid2' },
      field('Roast date', h('input', { type: 'date', value: b.roastDate || '', onchange: (e) => touch('roastDate', e.target.value) })),
      field('Altitude (masl)', h('input', { type: 'number', inputmode: 'numeric', value: b.altitude ?? '', oninput: (e) => touch('altitude', e.target.value) }))),
    field('Roaster’s tasting notes', h('textarea', { rows: 2, placeholder: 'What the bag says', oninput: (e) => touch('roasterNotes', e.target.value) }, b.roasterNotes || '')),
    field('Your notes', h('textarea', { rows: 2, oninput: (e) => touch('notes', e.target.value) }, b.notes || '')),
    h('div', { class: 'row-actions' },
      btn('Cancel', onCancel, 'ghost'),
      h('button', { type: 'submit', class: 'btn primary' }, 'Save bean')));
  return { form, restored, flush: () => { if (useDraft && !finished) saveBeanDraft(b); } };
}

export function beanFormSheet(bean, onSaved) {
  const { form, restored, flush } = buildBeanForm(bean, {
    onSave: (saved) => { sheet.close(); if (onSaved) onSaved(saved); },
    onCancel: () => sheet.close(),
    useDraft: !bean,
  });
  const sheet = openSheet({ title: bean ? 'Edit bean' : 'New bean', content: form, tall: true, onClose: flush });
  if (restored) toast('Restored your unsaved bean');
  return sheet;
}

function beanTags(bean) {
  return h('div', { class: 'chips' }, [bean.country, bean.variety, bean.process, bean.roastLevel].filter(Boolean).map((t) => chip(t)));
}

export async function beansView() {
  const root = h('div', { class: 'stack' });
  if (!D.store.beans.length) {
    root.appendChild(h('div', { class: 'empty' },
      h('p', { class: 'empty-title' }, 'No beans yet'),
      h('p', { class: 'muted' }, 'Add the coffee you are brewing so each recipe is tied to the bean, roaster and roast.'),
      btn('Add a bean', () => navigate('/bean/new'), 'primary')));
  }
  const beans = [...D.store.beans].sort((a, b) => {
    const la = D.store.brews.filter((x) => x.beanId === a.id).sort(D.byDateDesc)[0];
    const lb = D.store.brews.filter((x) => x.beanId === b.id).sort(D.byDateDesc)[0];
    return (lb ? lb.date : lb_fallback(b)) .localeCompare(la ? la.date : lb_fallback(a));
  });
  for (const bean of beans) {
    const brews = D.store.brews.filter((b) => b.beanId === bean.id);
    const best = D.bestBrew(bean.id);
    root.appendChild(h('a', { class: 'card card-link', href: '#/bean/' + bean.id },
      h('h3', null, bean.name),
      h('p', { class: 'muted small' }, bean.roaster + (bean.roastDate ? ' · roasted ' + fmtDate(bean.roastDate) : '')),
      beanTags(bean),
      h('p', { class: 'small' }, `${brews.length} brew${brews.length === 1 ? '' : 's'}`,
        best ? ' · best: ' + best.method + (best.rating != null ? ' ' + best.rating + '/10' : '') : '')));
  }
  return {
    title: 'Beans', nav: 'beans', el: root,
    actions: [h('a', { class: 'btn small primary', href: '#/bean/new' }, 'Add bean')],
  };
}
function lb_fallback(b) { return b.createdAt || ''; }

export async function beanFormView({ id }) {
  const bean = id ? D.beanById(id) : null;
  if (id && !bean) return notFound('Bean not found');
  const wrap = h('div', { class: 'stack' });
  let flush = () => {};

  function build() {
    const built = buildBeanForm(bean, {
      onSave: (saved) => { toast('Bean saved'); replace('/bean/' + saved.id); },
      onCancel: () => { history.length > 1 ? history.back() : navigate('/beans'); },
      useDraft: !bean,
    });
    flush = built.flush;
    wrap.replaceChildren(
      built.restored ? h('div', { class: 'banner' },
        h('span', null, 'Restored your unsaved bean.'),
        btn('Start fresh', () => { clearBeanDraft(); build(); }, 'small')) : null,
      built.form);
  }
  build();

  return {
    title: bean ? 'Edit bean' : 'New bean', back: bean ? '#/bean/' + bean.id : '#/beans', hideNav: true, nav: 'beans', el: wrap,
    cleanup() { flush(); },
  };
}

function notFound(msg) {
  return { title: 'Not found', back: '#/', nav: 'brews', el: h('div', { class: 'empty' }, h('p', null, msg), h('a', { class: 'btn primary', href: '#/' }, 'Back to brews')) };
}

function kv(rows) {
  return h('dl', { class: 'kv' }, rows.filter((r) => r[1] !== '' && r[1] !== null && r[1] !== undefined).map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
}

export async function beanDetailView({ id }) {
  const bean = D.beanById(id);
  if (!bean) return notFound('Bean not found');
  const brews = D.store.brews.filter((b) => b.beanId === id).sort(D.byDateDesc);
  const root = h('div', { class: 'stack' });
  const age = bean.roastDate ? daysOffRoast(bean.roastDate, new Date().toISOString()) : null;
  root.appendChild(h('div', { class: 'card' },
    h('h2', { class: 'bean-name' }, bean.name),
    h('p', { class: 'muted' }, bean.roaster),
    kv([
      ['Origin', [bean.country, bean.region].filter(Boolean).join(', ')],
      ['Species', bean.species], ['Variety', bean.variety], ['Process', bean.process],
      ['Roast', [bean.roastLevel, bean.roastFor && 'for ' + bean.roastFor.toLowerCase()].filter(Boolean).join(' · ')],
      ['Roast date', bean.roastDate ? fmtDate(bean.roastDate) + (age !== null ? ` (${age} days ago)` : '') : ''],
      ['Altitude', bean.altitude ? bean.altitude + ' masl' : ''],
      ['Roaster notes', bean.roasterNotes], ['Your notes', bean.notes],
    ]),
    h('div', { class: 'row-actions left' },
      h('a', { class: 'btn primary', href: '#/brew/new?bean=' + id }, 'Brew this bean'),
      h('a', { class: 'btn ghost', href: '#/bean/' + id + '/edit' }, 'Edit'))));

  // best recipe per method
  const methods = D.usedMethods(id);
  const bests = methods.map((m) => D.bestBrew(id, m)).filter(Boolean);
  if (bests.length) {
    root.appendChild(h('h3', { class: 'section-title' }, 'Best recipe by method'));
    for (const b of bests) {
      root.appendChild(h('a', { class: 'card card-link best', href: '#/brew/' + b.id },
        h('div', { class: 'card-head' }, h('h3', null, b.method), b.rating != null ? h('span', { class: 'score' }, b.rating + '/10') : null),
        h('p', { class: 'small' }, recipeSummary(b))));
    }
  }

  root.appendChild(h('h3', { class: 'section-title' }, `All brews (${brews.length})`));
  if (!brews.length) root.appendChild(h('p', { class: 'muted' }, 'No brews logged with this bean yet.'));
  brews.forEach((b) => root.appendChild(brewCard(b, { hideBean: true })));

  root.appendChild(h('div', { class: 'row-actions left' }, btn('Delete bean', async () => {
    const msg = brews.length ? `This also deletes the ${brews.length} brew${brews.length === 1 ? '' : 's'} logged with ${bean.name}. This cannot be undone.` : `Delete ${bean.name}?`;
    if (await confirmSheet({ title: 'Delete bean', message: msg, confirmLabel: 'Delete', danger: true })) {
      await D.deleteBean(id); toast('Bean deleted'); replace('/beans');
    }
  }, 'small ghost danger-text')));

  return { title: 'Bean', back: '#/beans', nav: 'beans', el: root };
}
