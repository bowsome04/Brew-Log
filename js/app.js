// Brew Log: app shell, routing and start-up.
import { h, install, closeAllSheets } from './util.js';
import { route, match, parseHash } from './router.js';
import * as D from './data.js';
import { brewsView, brewDetailView, brewFormView, compareView } from './views/brews.js';
import { beansView, beanDetailView, beanFormView } from './views/beans.js';
import { grindersView } from './views/grinders.js';
import { insightsView } from './views/insights.js';
import { settingsView } from './views/settings.js';

route('/', brewsView);
route('/brew/new', brewFormView);
route('/brew/:id', brewDetailView);
route('/brew/:id/edit', brewFormView);
route('/beans', beansView);
route('/bean/new', beanFormView);
route('/bean/:id', beanDetailView);
route('/bean/:id/edit', beanFormView);
route('/grinders', grindersView);
route('/insights', insightsView);
route('/compare', compareView);
route('/settings', settingsView);

const NAV = [
  ['brews', '#/', 'Brews', 'M5 8h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8zm11 1h2a2 2 0 0 1 0 4h-2M7 4v1.5M10.5 3v2.5M14 4v1.5'],
  ['beans', '#/beans', 'Beans', 'M12 4c4 0 7 3.5 7 8s-3 8-7 8-7-3.5-7-8 3-8 7-8zm0 0c-2 3 2 5 0 8s2 5 0 8'],
  ['grinders', '#/grinders', 'Grinders', 'M7 4h10l-1.5 6h-7L7 4zm3 6v4m4-4v4M8 14h8v3H8zM6 20h12'],
  ['insights', '#/insights', 'Insights', 'M5 19V11m5 8V6m5 13v-6m5 6V9'],
  ['settings', '#/settings', 'Settings', 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm0-12v2m0 13v2M4.2 7l1.7 1M18.1 16l1.7 1M4.2 17l1.7-1M18.1 8l1.7-1'],
];

const svgIcon = (d) => {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', d);
  svg.appendChild(p);
  return svg;
};

const app = document.getElementById('app');
const topbar = h('header', { class: 'topbar' });
const main = h('main', { class: 'view', id: 'main', tabindex: '-1' });
const nav = h('nav', { class: 'nav', 'aria-label': 'Main' });
const fabSlot = h('div', { class: 'fab-slot' });
app.append(topbar, main, fabSlot, nav);

let current = null;
let token = 0;
const scrollMem = new Map();
let lastPath = null;

function paintNav(active) {
  nav.replaceChildren(...NAV.map(([key, href, label, d]) => h('a', { href, class: 'nav-item', 'aria-current': key === active ? 'page' : null }, svgIcon(d), h('span', null, label))));
}

function paint(view, path) {
  const bar = [];
  if (view.back) bar.push(h('a', { class: 'icon-btn back', href: view.back, 'aria-label': 'Back' }, '‹'));
  bar.push(h('h1', { class: 'title' }, view.title), h('div', { class: 'actions' }, view.actions || []));
  topbar.replaceChildren(...bar);
  main.replaceChildren(view.el);
  document.title = view.title + ' · Brew Log';
  app.classList.toggle('no-nav', !!view.hideNav);
  paintNav(view.nav);
  fabSlot.replaceChildren(...(view.fab ? [h('a', { class: 'fab', href: view.fab.href }, h('span', { 'aria-hidden': 'true' }, '+'), view.fab.label)] : []));
  const saved = scrollMem.get(path);
  window.scrollTo(0, saved || 0);
}

function errorView(e) {
  console.error(e);
  return { title: 'Something went wrong', nav: 'brews', el: h('div', { class: 'empty' }, h('p', { class: 'empty-title' }, 'Something went wrong'), h('p', { class: 'muted' }, String(e && e.message ? e.message : e)), h('a', { class: 'btn primary', href: '#/' }, 'Back to brews')) };
}

async function render() {
  const my = ++token;
  if (lastPath !== null) scrollMem.set(lastPath, window.scrollY);
  closeAllSheets();
  if (current && current.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } }
  current = null;
  const { path, query } = parseHash();
  const m = match(path);
  let view;
  try {
    view = m ? await m.handler({ ...query, ...m.params }) : { title: 'Not found', nav: 'brews', el: h('div', { class: 'empty' }, h('p', null, 'That page does not exist.'), h('a', { class: 'btn primary', href: '#/' }, 'Back to brews')) };
  } catch (e) { view = errorView(e); }
  if (my !== token) { if (view && view.cleanup) view.cleanup(); return; }
  current = view;
  const key = path + (query.id ? '' : '');
  paint(view, key);
  lastPath = key;
}

async function start() {
  try {
    await D.loadAll();
  } catch (e) {
    app.replaceChildren(h('div', { class: 'empty' }, h('p', { class: 'empty-title' }, 'Storage is not available'), h('p', { class: 'muted' }, 'Brew Log needs browser storage to keep your logs. Open it in a normal (not private) Chrome window.')));
    return;
  }
  window.addEventListener('hashchange', render);
  await render();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* ignore */ }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
  }
}

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); install.prompt = e; });

start();
