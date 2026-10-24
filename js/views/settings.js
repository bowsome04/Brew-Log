import { h, field, selectEl, btn, toast, confirmSheet, downloadFile, shareFile, fmtDateTime, install } from '../util.js';
import * as D from '../data.js';

const stamp = () => new Date().toISOString().slice(0, 10);
export const APP_VERSION = '1.0.0';

export async function settingsView() {
  const root = h('div', { class: 'stack' });

  // ---- backup
  const lastEl = h('p', { class: 'muted small' });
  const paintLast = () => {
    const last = D.store.meta.lastBackup;
    lastEl.textContent = last ? 'Last backup: ' + fmtDateTime(last) : 'Not backed up yet.';
  };
  paintLast();
  const fileName = () => `brew-log-backup-${stamp()}.json`;
  const json = () => JSON.stringify(D.exportAll(), null, 2);

  const backupCard = h('div', { class: 'card' },
    h('h3', null, 'Back up'),
    h('p', { class: 'small' }, 'Your logs are stored on this phone only. Save a backup file now and then; you can also use it to open your logs on another device.'),
    lastEl,
    h('div', { class: 'row-actions left wrap' },
      btn('Save backup file', async () => { downloadFile(fileName(), json(), 'application/json'); await D.markBackedUp(); paintLast(); toast('Backup saved to Downloads'); }, 'primary'),
      (navigator.canShare ? btn('Share backup…', async () => {
        try {
          const ok = await shareFile(fileName(), json(), 'application/json');
          if (ok) { await D.markBackedUp(); paintLast(); } else toast('Sharing files is not supported here. Use Save backup file.');
        } catch (e) { if (e && e.name !== 'AbortError') toast('Could not share the file'); }
      }, '') : null),
      btn('Export CSV', () => { downloadFile(`brew-log-${stamp()}.csv`, D.brewsToCsv(), 'text/csv'); toast('CSV saved to Downloads'); }, 'ghost')));
  root.appendChild(backupCard);

  // ---- restore
  let mode = 'merge';
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'file-input' });
  const modeSel = selectEl([
    { value: 'merge', label: 'Merge into what is on this phone (keeps newer edits)' },
    { value: 'replace', label: 'Replace everything on this phone' }], mode, (v) => { mode = v; });
  root.appendChild(h('div', { class: 'card' },
    h('h3', null, 'Restore'),
    h('p', { class: 'small' }, 'Pick a backup file you saved earlier.'),
    field('How to restore', modeSel),
    field('Backup file', fileInput),
    btn('Restore from file', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) { toast('Choose a backup file first'); return; }
      let data;
      try { data = JSON.parse(await file.text()); D.validateBackup(data); } catch (e) { toast(e.message || 'That file could not be read'); return; }
      if (mode === 'replace' && !(await confirmSheet({ title: 'Replace everything?', message: 'This removes all logs currently on this phone and replaces them with the file.', confirmLabel: 'Replace', danger: true }))) return;
      const c = await D.importAll(data, mode);
      fileInput.value = '';
      toast(`Restored ${c.brews} brews, ${c.beans} beans, ${c.grinders} grinders`);
    }, '')));

  // ---- custom methods
  const methodsBox = h('div', { class: 'stack tight' });
  const paintMethods = () => {
    const list = D.store.meta.customMethods || [];
    methodsBox.replaceChildren(...(list.length ? list.map((m) => h('div', { class: 'row-between' },
      h('span', null, m.name, ' ', h('span', { class: 'muted small' }, D.KIND_LABEL[m.kind])),
      btn('Remove', async () => { await D.setMeta('customMethods', list.filter((x) => x.name !== m.name)); paintMethods(); }, 'small ghost danger-text'))) : [h('p', { class: 'muted small' }, 'No custom methods yet.')]));
  };
  paintMethods();
  const nameIn = h('input', { type: 'text', placeholder: 'e.g. Moka pot, April brewer', autocomplete: 'off' });
  const kindSel = selectEl(Object.entries(D.KIND_LABEL).map(([value, label]) => ({ value, label })), 'percolation');
  root.appendChild(h('div', { class: 'card' },
    h('h3', null, 'Brew methods'),
    h('p', { class: 'small' }, 'Add a method that is not in the list. The type decides which recipe fields it shows.'),
    methodsBox,
    h('div', { class: 'grid2' }, field('Name', nameIn), field('Type', kindSel)),
    btn('Add method', async () => {
      const name = nameIn.value.trim();
      if (!name) { toast('Give the method a name'); return; }
      if (D.allMethods().some((m) => m.name.toLowerCase() === name.toLowerCase())) { toast('That method already exists'); return; }
      await D.setMeta('customMethods', [...(D.store.meta.customMethods || []), { name, kind: kindSel.value }]);
      nameIn.value = ''; paintMethods(); toast('Method added');
    }, '')));

  // ---- storage + install
  const storageEl = h('p', { class: 'small' }, 'Checking…');
  const paintStorage = async () => {
    try {
      const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null;
      const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
      storageEl.textContent = (persisted === true ? 'Protected: the browser will not clear your logs automatically.' : persisted === false ? 'Not protected yet: the browser may clear data if the phone is very low on space.' : 'Storage protection status is unavailable here.')
        + (est && est.usage !== undefined ? ` Using ${(est.usage / 1024).toFixed(0)} KB.` : '');
    } catch { storageEl.textContent = 'Storage status is unavailable.'; }
  };
  paintStorage();
  const installBtn = install.prompt ? btn('Install on this phone', async () => { install.prompt.prompt(); await install.prompt.userChoice; install.prompt = null; installBtn.remove(); }, 'primary') : null;
  root.appendChild(h('div', { class: 'card' },
    h('h3', null, 'This phone'),
    storageEl,
    h('div', { class: 'row-actions left wrap' },
      btn('Protect my data', async () => {
        const ok = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false;
        toast(ok ? 'Data is now protected' : 'The browser did not grant protection. Installing the app to your home screen usually helps.');
        paintStorage();
      }, 'ghost'),
      installBtn),
    h('p', { class: 'small muted' }, 'Everything stays on this device. The app never sends your logs anywhere; the only network use is loading the app files.')));

  // ---- about + erase
  root.appendChild(h('div', { class: 'card' },
    h('h3', null, 'About'),
    h('p', { class: 'small' }, `Brew Log ${APP_VERSION}. Flavour descriptors follow the Coffee Taster’s Flavor Wheel by the Specialty Coffee Association and World Coffee Research (CC BY-NC-ND 4.0), used here for personal, non-commercial logging.`),
    h('div', { class: 'row-actions left' }, btn('Erase all data', async () => {
      if (await confirmSheet({ title: 'Erase everything?', message: 'This deletes all beans, grinders and brews on this phone. Save a backup first if you may want them back.', confirmLabel: 'Erase all', danger: true })) {
        await D.eraseAll(); toast('All data erased');
        location.hash = '#/';
      }
    }, 'small ghost danger-text'))));

  return { title: 'Settings', nav: 'settings', el: root };
}
