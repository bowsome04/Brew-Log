// Shared taste UI: chips for selected descriptors and the full-screen wheel picker.
import { h, chip, btn, openSheet } from '../util.js';
import { createWheel } from '../wheel.js';
import { nameOf, pathOf, colorOf } from '../flavors.js';

export function tasteChips(ids, { max = 99, removable = null } = {}) {
  const list = (ids || []).slice(0, max);
  const out = list.map((id) => {
    const c = chip(nameOf(id), { color: colorOf(id), title: pathOf(id), cls: removable ? 'chip-x' : '' });
    if (removable) {
      c.appendChild(h('button', { type: 'button', class: 'chip-remove', 'aria-label': 'Remove ' + nameOf(id), onclick: () => removable(id) }, '×'));
    }
    return c;
  });
  if ((ids || []).length > max) out.push(h('span', { class: 'chip chip-more' }, '+' + (ids.length - max)));
  return h('div', { class: 'chips' }, out);
}

export function openWheelSheet(initial, onDone) {
  let current = new Set(initial);
  const chipsBox = h('div', { class: 'wheel-chips' });
  const paintChips = () => {
    chipsBox.replaceChildren(current.size
      ? tasteChips([...current], { removable: (id) => { current.delete(id); wheel.setSelected(current); paintChips(); } })
      : h('p', { class: 'muted small' }, 'Tap a category, then tap the flavours you taste. Tap the centre to go back.'));
  };
  const wheel = createWheel({ mode: 'select', selected: current, onChange: (set) => { current = set; paintChips(); } });
  const content = h('div', { class: 'wheel-sheet' },
    h('div', { class: 'wheel-wrap' }, wheel.el),
    chipsBox,
    h('div', { class: 'row-actions' },
      btn('Clear', () => { current = new Set(); wheel.setSelected(current); paintChips(); }, 'ghost'),
      btn('Done', () => { sheet.close(); }, 'primary')),
    h('p', { class: 'credit' }, 'Descriptors follow the SCA / WCR Coffee Taster’s Flavor Wheel.'));
  paintChips();
  const sheet = openSheet({ title: 'Flavour wheel', content, tall: true, onClose: () => onDone([...current]) });
  return sheet;
}
