// Minimal IndexedDB wrapper. All data stays on this device.

const DB_NAME = 'brew-log';
const DB_VERSION = 1;
export const STORES = ['beans', 'grinders', 'brews', 'meta'];
let dbPromise;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ['beans', 'grinders', 'brews']) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(stores, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let out;
    try { out = fn(tx); } catch (e) { reject(e); return; }
    tx.oncomplete = () => resolve(out && typeof out === 'object' && 'result' in out ? out.result : out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const getAll = (store) => run(store, 'readonly', (tx) => tx.objectStore(store).getAll());
export const put = (store, obj) => run(store, 'readwrite', (tx) => tx.objectStore(store).put(obj));
export const remove = (store, id) => run(store, 'readwrite', (tx) => { tx.objectStore(store).delete(id); });
export const removeMany = (store, ids) => run(store, 'readwrite', (tx) => { const st = tx.objectStore(store); ids.forEach((i) => st.delete(i)); });
export const bulkPut = (store, arr) => run(store, 'readwrite', (tx) => { const st = tx.objectStore(store); arr.forEach((o) => st.put(o)); });

export function replaceAll(data) {
  return run(STORES, 'readwrite', (tx) => {
    for (const s of ['beans', 'grinders', 'brews']) {
      const st = tx.objectStore(s);
      st.clear();
      (data[s] || []).forEach((o) => st.put(o));
    }
  });
}

export function wipeAll() {
  return run(STORES, 'readwrite', (tx) => { STORES.forEach((s) => tx.objectStore(s).clear()); });
}
