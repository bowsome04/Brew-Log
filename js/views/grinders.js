import { h, field, selectEl, btn, openSheet, confirmSheet, toast } from '../util.js';
import * as D from '../data.js';

export function grinderUnit(g) { return (g && g.unit) || 'clicks'; }

export function grinderFormSheet(grinder, onSaved) {
  const g = grinder ? { ...grinder } : { name: '', kind: 'Hand', unit: 'clicks', notes: '' };
  const name = h('input', { type: 'text', value: g.name, placeholder: 'e.g. Comandante C40 MK4', autocomplete: 'off', oninput: (e) => { g.name = e.target.value; } });
  const kind = selectEl([{ value: 'Hand', label: 'Hand grinder' }, { value: 'Electric', label: 'Electric grinder' }], g.kind, (v) => { g.kind = v; });
  const unit = selectEl([
    { value: 'clicks', label: 'clicks' }, { value: 'notches', label: 'notches' },
    { value: 'setting', label: 'setting number' }, { value: 'turns', label: 'turns' }], g.unit || 'clicks', (v) => { g.unit = v; });
  const notes = h('textarea', { rows: 3, placeholder: 'Zero point, burr set, how you count (e.g. 0 = burrs touching)', oninput: (e) => { g.notes = e.target.value; } }, g.notes || '');
  const content = h('form', {
    class: 'form-stack',
    onsubmit: async (e) => {
      e.preventDefault();
      if (!g.name.trim()) { toast('Give the grinder a name'); name.focus(); return; }
      g.name = g.name.trim();
      const saved = await D.saveGrinder(g);
      sheet.close();
      if (onSaved) onSaved(saved);
    },
  },
    field('Grinder name', name),
    h('div', { class: 'grid2' }, field('Type', kind), field('Setting counted in', unit)),
    field('Notes (optional)', notes),
    h('div', { class: 'row-actions' }, btn('Cancel', () => sheet.close(), 'ghost'), h('button', { type: 'submit', class: 'btn primary' }, 'Save grinder')));
  const sheet = openSheet({ title: grinder ? 'Edit grinder' : 'New grinder', content });
  setTimeout(() => name.focus(), 50);
  return sheet;
}

export async function grindersView() {
  const root = h('div', { class: 'stack' });
  const paint = () => {
    root.replaceChildren();
    root.appendChild(h('p', { class: 'muted' }, 'Settings are only comparable within one grinder, so each brew records which grinder and how many clicks.'));
    if (!D.store.grinders.length) {
      root.appendChild(h('div', { class: 'empty' }, h('p', null, 'No grinders yet.'), btn('Add your grinder', () => grinderFormSheet(null, paint), 'primary')));
      return;
    }
    for (const g of [...D.store.grinders].sort((a, b) => a.name.localeCompare(b.name))) {
      const uses = D.store.brews.filter((b) => b.grinderId === g.id).length;
      root.appendChild(h('div', { class: 'card' },
        h('div', { class: 'card-head' },
          h('div', null, h('h3', null, g.name), h('p', { class: 'muted small' }, `${g.kind || 'Hand'} · counted in ${grinderUnit(g)} · used in ${uses} brew${uses === 1 ? '' : 's'}`)),
        ),
        g.notes ? h('p', { class: 'small' }, g.notes) : null,
        h('div', { class: 'row-actions left' },
          btn('Edit', () => grinderFormSheet(g, paint), 'small ghost'),
          btn('Delete', async () => {
            const msg = uses ? `${g.name} is used in ${uses} brew${uses === 1 ? '' : 's'}. Those brews keep their click counts but lose the grinder name.` : `Delete ${g.name}?`;
            if (await confirmSheet({ title: 'Delete grinder', message: msg, confirmLabel: 'Delete', danger: true })) {
              await D.deleteGrinder(g.id); toast('Grinder deleted'); paint();
            }
          }, 'small ghost danger-text'))));
    }
  };
  paint();
  return {
    title: 'Grinders', nav: 'grinders', el: root,
    actions: [h('button', { type: 'button', class: 'btn small primary', onclick: () => grinderFormSheet(null, paint) }, 'Add grinder')],
  };
}
