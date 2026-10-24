// In-memory cache over IndexedDB plus the domain helpers (best brew, backup, CSV).
import * as db from './db.js';
import { uid, daysOffRoast, ratioOf, fmtNum } from './util.js';
import { pathOf } from './flavors.js';

export const store = { beans: [], grinders: [], brews: [], meta: {} };

export const KIND_LABEL = {
  percolation: 'Pour-over',
  immersion: 'Immersion',
  hybrid: 'Hybrid',
  espresso: 'Espresso',
};

export const BASE_METHODS = [
  { name: 'V60', kind: 'percolation' },
  { name: 'Kalita Wave', kind: 'percolation' },
  { name: 'Chemex', kind: 'percolation' },
  { name: 'Origami', kind: 'percolation' },
  { name: 'Orea', kind: 'percolation' },
  { name: 'Melitta / cone', kind: 'percolation' },
  { name: 'Pour-over (other)', kind: 'percolation' },
  { name: 'AeroPress', kind: 'hybrid' },
  { name: 'AeroPress (inverted)', kind: 'hybrid' },
  { name: 'Hario Switch', kind: 'hybrid' },
  { name: 'French press', kind: 'immersion' },
  { name: 'Clever Dripper', kind: 'immersion' },
  { name: 'Immersion (other)', kind: 'immersion' },
  { name: 'Espresso', kind: 'espresso' },
];

export const VERDICT = { worked: 'Worked', okay: 'Okay', failed: "Didn't work" };
export const BALANCE = ['Sour', 'Slightly sour', 'Balanced', 'Slightly bitter', 'Bitter'];
export const STRENGTH = ['Weak', 'Slightly weak', 'Just right', 'Slightly strong', 'Strong'];
export const GRIND_FEEL = ['Extra fine', 'Fine', 'Medium-fine', 'Medium', 'Medium-coarse', 'Coarse'];

export function allMethods() {
  return [...BASE_METHODS, ...(store.meta.customMethods || [])];
}
export function methodKind(name) {
  const m = allMethods().find((x) => x.name === name);
  return m ? m.kind : 'percolation';
}

// ---------- load / CRUD ----------
export async function loadAll() {
  const [beans, grinders, brews, meta] = await Promise.all([
    db.getAll('beans'), db.getAll('grinders'), db.getAll('brews'), db.getAll('meta'),
  ]);
  store.beans = beans;
  store.grinders = grinders;
  store.brews = brews;
  store.meta = Object.fromEntries(meta.map((m) => [m.key, m.value]));
}

export const beanById = (id) => store.beans.find((b) => b.id === id);
export const grinderById = (id) => store.grinders.find((g) => g.id === id);
export const brewById = (id) => store.brews.find((b) => b.id === id);

function upsert(arr, obj) {
  const i = arr.findIndex((x) => x.id === obj.id);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
}

async function save(storeName, arr, obj) {
  const now = new Date().toISOString();
  if (!obj.id) { obj.id = uid(); obj.createdAt = now; }
  obj.updatedAt = now;
  await db.put(storeName, obj);
  upsert(arr, obj);
  return obj;
}

export const saveBean = (b) => save('beans', store.beans, b);
export const saveGrinder = (g) => save('grinders', store.grinders, g);
export const saveBrew = (b) => save('brews', store.brews, b);

export async function deleteBrew(id) {
  await db.remove('brews', id);
  store.brews = store.brews.filter((b) => b.id !== id);
}
export async function deleteBean(id) {
  const ids = store.brews.filter((b) => b.beanId === id).map((b) => b.id);
  await db.removeMany('brews', ids);
  await db.remove('beans', id);
  store.brews = store.brews.filter((b) => b.beanId !== id);
  store.beans = store.beans.filter((b) => b.id !== id);
}
export async function deleteGrinder(id) {
  await db.remove('grinders', id);
  store.grinders = store.grinders.filter((g) => g.id !== id);
  for (const b of store.brews) {
    if (b.grinderId === id) { b.grinderId = ''; await db.put('brews', b); }
  }
}

export async function setMeta(key, value) {
  store.meta[key] = value;
  await db.put('meta', { key, value });
}

// ---------- derived ----------
export const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

export function brewsSorted() { return [...store.brews].sort(byDateDesc); }

// Ice melts into the final cup, so a Japanese iced brew's ratio is dose
// against water *plus* ice (on the bed and in the server), not just the
// hot water poured through the grounds.
export function totalWater(b) {
  const ice = b.brewStyle === 'iced' ? (b.iceBedG || 0) + (b.iceG || 0) : 0;
  const w = (b.water || 0) + ice;
  return w > 0 ? w : null;
}

export function recipeRatio(b) {
  return ratioOf(b.dose, totalWater(b));
}

export function daysOff(b) {
  const bean = beanById(b.beanId);
  return bean ? daysOffRoast(bean.roastDate, b.date) : null;
}

export function bestBrew(beanId, method) {
  const list = store.brews.filter((b) => b.beanId === beanId && (!method || b.method === method));
  const rated = list.filter((b) => b.rating !== null && b.rating !== undefined);
  if (rated.length) {
    return rated.sort((a, b) => b.rating - a.rating
      || (a.verdict === 'worked' ? -1 : 0) - (b.verdict === 'worked' ? -1 : 0)
      || byDateDesc(a, b))[0];
  }
  return list.filter((b) => b.verdict === 'worked').sort(byDateDesc)[0];
}

export function usedMethods(beanId) {
  const set = new Set(store.brews.filter((b) => !beanId || b.beanId === beanId).map((b) => b.method));
  return [...set];
}

// ---------- backup ----------
export function exportAll() {
  return {
    app: 'brew-log',
    version: 1,
    exportedAt: new Date().toISOString(),
    beans: store.beans,
    grinders: store.grinders,
    brews: store.brews,
    customMethods: store.meta.customMethods || [],
  };
}

export async function markBackedUp() { await setMeta('lastBackup', new Date().toISOString()); }

export function validateBackup(obj) {
  if (!obj || obj.app !== 'brew-log') throw new Error('This is not a Brew Log backup file.');
  for (const k of ['beans', 'grinders', 'brews']) {
    if (!Array.isArray(obj[k])) throw new Error('Backup file is missing "' + k + '".');
    for (const o of obj[k]) if (!o || typeof o.id !== 'string') throw new Error('Backup contains an entry without an id.');
  }
}

export async function importAll(obj, mode) {
  validateBackup(obj);
  const counts = { beans: 0, grinders: 0, brews: 0 };
  if (mode === 'replace') {
    await db.replaceAll(obj);
    counts.beans = obj.beans.length; counts.grinders = obj.grinders.length; counts.brews = obj.brews.length;
    await setMeta('customMethods', obj.customMethods || []);
  } else {
    for (const name of ['beans', 'grinders', 'brews']) {
      const existing = new Map(store[name].map((x) => [x.id, x]));
      const toWrite = obj[name].filter((inc) => {
        const cur = existing.get(inc.id);
        return !cur || (inc.updatedAt || '') > (cur.updatedAt || '');
      });
      await db.bulkPut(name, toWrite);
      counts[name] = toWrite.length;
    }
    const have = new Set((store.meta.customMethods || []).map((m) => m.name));
    const merged = [...(store.meta.customMethods || []), ...(obj.customMethods || []).filter((m) => !have.has(m.name))];
    await setMeta('customMethods', merged);
  }
  await loadAll();
  return counts;
}

export async function eraseAll() {
  await db.wipeAll();
  await loadAll();
}

// ---------- CSV ----------
function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function brewsToCsv() {
  const head = ['Date', 'Bean', 'Roaster', 'Origin', 'Variety', 'Process', 'Roast level', 'Roast date', 'Days off roast',
    'Method', 'Brew style', 'Ice on bed (g)', 'Ice in server (g)', 'Dose (g)', 'Water or yield (g)', 'Ratio (1:x)', 'Temp (C)', 'Grinder', 'Setting', 'Grind feel',
    'Bloom water (g)', 'Bloom time (s)', 'Pours (start s : water g)', 'Total time (s)', 'Pouring done at (s)',
    'Pre-infusion (s)', 'Pressure (bar)', 'Score', 'Verdict', 'Balance', 'Strength', 'Taste', 'Procedure', 'Notes'];
  const rows = brewsSorted().map((b) => {
    const bean = beanById(b.beanId) || {};
    const g = grinderById(b.grinderId);
    const r = recipeRatio(b);
    return [
      b.date, bean.name, bean.roaster, bean.country, bean.variety, bean.process, bean.roastLevel, bean.roastDate, daysOff(b),
      b.method, b.brewStyle === 'iced' ? 'Iced' : 'Hot', b.brewStyle === 'iced' ? b.iceBedG : '', b.brewStyle === 'iced' ? b.iceG : '',
      b.dose, b.water, r ? fmtNum(r, 2) : '', b.temp, g ? g.name : '', b.clicks, b.grindFeel,
      b.bloomWater, b.bloomTime, (b.pours || []).map((p) => (p.t ?? '') + ':' + (p.g ?? '')).join(' | '),
      b.totalTime, b.drawStart, b.preinfusion, b.pressure, b.rating, b.verdict ? VERDICT[b.verdict] : '',
      b.balance !== null && b.balance !== undefined ? BALANCE[b.balance] : '',
      b.strength !== null && b.strength !== undefined ? STRENGTH[b.strength] : '',
      (b.taste || []).map(pathOf).join('; '), b.procedure, b.notes,
    ].map(csvCell).join(',');
  });
  return '﻿' + [head.map(csvCell).join(','), ...rows].join('\r\n');
}
