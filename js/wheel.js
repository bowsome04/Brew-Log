// Interactive SCA-style flavour wheel (SVG sunburst).
// Overview: nine categories. Tap one to zoom into its sub-categories and descriptors.
// mode "select": tap descriptors to toggle them.  mode "heat": shade by how often you logged them.
import { s } from './util.js';
import { WHEEL, NODE } from './flavors.js';

const CX = 200, CY = 200;
const rad = (d) => (d * Math.PI) / 180;
const pt = (r, a) => [CX + r * Math.sin(rad(a)), CY - r * Math.cos(rad(a))];
const f = (n) => Math.round(n * 100) / 100;

function arcPath(r0, r1, a0, a1) {
  if (a1 - a0 >= 359.99) a1 = a0 + 359.99;
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0);
  return `M${f(x0)},${f(y0)}A${r1},${r1} 0 ${large} 1 ${f(x1)},${f(y1)}L${f(x2)},${f(y2)}A${r0},${r0} 0 ${large} 0 ${f(x3)},${f(y3)}Z`;
}

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(v * (1 - t) + B[i] * t).toString(16).padStart(2, '0')).join('');
}
function lum(c) {
  const [r, g, b] = hex(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const inkFor = (fill) => (lum(fill) > 0.32 ? '#1f1a16' : '#ffffff');

function wrapLabel(name) {
  if (name.length <= 9) return [name];
  let best = null;
  for (let i = 0; i < name.length; i++) {
    if (name[i] === ' ' || name[i] === '/') {
      const a = name[i] === '/' ? name.slice(0, i + 1) : name.slice(0, i);
      const b = name.slice(i + 1);
      const score = Math.abs(a.length - b.length);
      if (!best || score < best.score) best = { lines: [a, b], score };
    }
  }
  return best ? best.lines : [name];
}

function textRot(mid) {
  const a = ((mid % 360) + 360) % 360;
  return a > 180 ? mid - 90 + 180 : mid - 90;
}

function label(lines, r, mid, avail, arcW, fill, weight = 500, maxFs = 12) {
  const longest = Math.max(...lines.map((l) => l.length));
  let fs = Math.min(maxFs, avail / (0.56 * longest), arcW / (lines.length * 1.2));
  fs = Math.max(6.5, fs);
  const [x, y] = pt(r, mid);
  const rot = textRot(mid);
  return s('g', { 'pointer-events': 'none' }, lines.map((ln, i) => s('text', {
    transform: `translate(${f(x)} ${f(y)}) rotate(${f(rot)})`,
    y: f((i - (lines.length - 1) / 2) * fs * 1.15),
    'text-anchor': 'middle', 'dominant-baseline': 'central',
    'font-size': f(fs), 'font-weight': weight, fill: inkFor(fill),
  }, ln)));
}

const slotsOf = (cat) => cat.children.reduce((n, c) => n + Math.max(1, c.children.length), 0);

export function createWheel({ mode = 'select', selected = new Set(), counts = new Map(), onChange, onPick, onFocus } = {}) {
  const svg = s('svg', { viewBox: '0 0 400 400', class: 'wheel', role: 'group', 'aria-label': 'Flavour wheel' });
  let focus = null;
  let sel = selected;
  let cnt = counts;

  const maxCount = () => Math.max(1, ...cnt.values());
  const catTotal = new Map();
  const recomputeTotals = () => {
    catTotal.clear();
    for (const c of WHEEL) catTotal.set(c.name, 0);
    for (const [id, n] of cnt) {
      const node = NODE.get(id);
      if (node) catTotal.set(node.cat, (catTotal.get(node.cat) || 0) + n);
    }
  };

  function fillFor(node) {
    const base = node.color;
    if (mode === 'select') {
      if (sel.has(node.id)) return base;
      return mix('#ffffff', base, node.level === 1 ? 0.5 : node.level === 2 ? 0.2 : 0.11);
    }
    const n = node.level === 1 ? catTotal.get(node.name) || 0 : cnt.get(node.id) || 0;
    if (!n) return '#efece6';
    const top = node.level === 1 ? Math.max(1, ...catTotal.values()) : maxCount();
    return mix('#ffffff', base, 0.22 + 0.78 * (n / top));
  }

  function wedge(node, r0, r1, a0, a1, { onTap, interactive = true, name }) {
    const fill = fillFor(node);
    const isSel = mode === 'select' && sel.has(node.id);
    const p = s('path', {
      d: arcPath(r0, r1, a0, a1), fill, class: 'wedge' + (isSel ? ' on' : ''),
      'data-id': node.id,
      role: interactive ? 'button' : null, tabindex: interactive ? '0' : null,
      'aria-label': interactive ? `${name || node.name}${isSel ? ', selected' : ''}` : null,
      'aria-pressed': interactive && mode === 'select' && node.level > 1 ? String(isSel) : null,
    });
    if (interactive) {
      p.addEventListener('click', onTap);
      p.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(); } });
    }
    return p;
  }

  function tap(node) {
    if (mode === 'select') {
      if (sel.has(node.id)) sel.delete(node.id); else sel.add(node.id);
      if (onChange) onChange(new Set(sel));
      render();
    } else if (onPick) onPick(node);
    else render();
  }

  function setFocus(name) {
    focus = name;
    if (onFocus) onFocus(name);
    render();
  }

  function overview() {
    const kids = [];
    WHEEL.forEach((cat, i) => {
      const a0 = i * 40, a1 = a0 + 40;
      const go = () => setFocus(cat.name);
      const g = s('g', { class: 'cat-group' });
      // decorative sub / descriptor rings
      const per = 40 / slotsOf(cat);
      let a = a0;
      for (const sub of cat.children) {
        const n = Math.max(1, sub.children.length);
        if (!sub.children.length) {
          g.appendChild(wedge(sub, 128, 196, a, a + per, { onTap: go, name: cat.name }));
        } else {
          g.appendChild(wedge(sub, 128, 160, a, a + n * per, { onTap: go, name: cat.name }));
          sub.children.forEach((leaf, j) => g.appendChild(wedge(leaf, 160, 196, a + j * per, a + (j + 1) * per, { onTap: go, name: cat.name })));
        }
        a += n * per;
      }
      const cw = wedge(cat, 40, 126, a0, a1, { onTap: go, name: cat.name + ' category' });
      g.appendChild(cw);
      const fill = fillFor(cat);
      g.appendChild(label(wrapLabel(cat.name), 83, a0 + 20, 74, 58, fill, 650, 13));
      // badge with the number of selected descriptors
      const nSel = mode === 'select' ? [...sel].filter((id) => NODE.get(id) && NODE.get(id).cat === cat.name).length : 0;
      if (nSel) {
        const [bx, by] = pt(112, a0 + 20);
        g.appendChild(s('circle', { cx: f(bx), cy: f(by), r: 10, fill: '#1f1a16', 'pointer-events': 'none' }));
        g.appendChild(s('text', { x: f(bx), y: f(by), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 11, 'font-weight': 700, fill: '#fff', 'pointer-events': 'none' }, String(nSel)));
      }
      kids.push(g);
    });
    const total = mode === 'select' ? sel.size : 0;
    const centerLines = mode === 'select'
      ? (total ? [String(total), 'selected'] : ['Tap a', 'category'])
      : ['Tap to', 'explore'];
    kids.push(s('circle', { cx: CX, cy: CY, r: 38, fill: '#fbf8f3', 'pointer-events': 'none' }));
    centerLines.forEach((ln, i) => kids.push(s('text', {
      x: CX, y: CY + (i - 0.5) * 15, 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': i === 0 && total ? 18 : 11, 'font-weight': i === 0 && total ? 700 : 500, fill: '#5b5148', 'pointer-events': 'none',
    }, ln)));
    return kids;
  }

  function zoomed(cat) {
    const kids = [];
    const slots = slotsOf(cat);
    const per = 360 / slots;
    const R2a = 46, R2b = 118, R3b = 196;
    let a = 0;
    for (const sub of cat.children) {
      const n = Math.max(1, sub.children.length);
      const a0 = a, a1 = a + n * per;
      const mid = (a0 + a1) / 2;
      const lines2 = (node) => {
        const l = wrapLabel(node.name);
        if (mode === 'heat') {
          const c = cnt.get(node.id) || 0;
          if (c) l.push('×' + c);
        }
        return l;
      };
      if (!sub.children.length) {
        kids.push(wedge(sub, R2a, R3b, a0, a1, { onTap: () => tap(sub) }));
        const arcW = ((a1 - a0) * Math.PI / 180) * 120;
        kids.push(label(lines2(sub), (R2a + R3b) / 2 + 6, mid, R3b - R2a - 26, arcW, fillFor(sub), 600, 13));
      } else {
        kids.push(wedge(sub, R2a, R2b, a0, a1, { onTap: () => tap(sub) }));
        const arcW2 = ((a1 - a0) * Math.PI / 180) * 82;
        kids.push(label(lines2(sub), 82, mid, R2b - R2a - 12, Math.min(arcW2, 40), fillFor(sub), 650, 12));
        sub.children.forEach((leaf, j) => {
          const l0 = a0 + j * per, l1 = l0 + per;
          kids.push(wedge(leaf, R2b, R3b, l0, l1, { onTap: () => tap(leaf) }));
          const arcW3 = (per * Math.PI / 180) * 157;
          kids.push(label(lines2(leaf), 157, (l0 + l1) / 2, R3b - R2b - 10, arcW3, fillFor(leaf), 500, 12));
        });
      }
      a = a1;
    }
    kids.push(s('circle', {
      cx: CX, cy: CY, r: 44, fill: cat.color, class: 'wheel-center', role: 'button', tabindex: '0',
      'aria-label': `Back to all categories`,
      onclick: () => setFocus(null),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFocus(null); } },
    }));
    const lines = wrapLabel(cat.name);
    lines.forEach((ln, i) => kids.push(s('text', {
      x: CX, y: CY + (i - (lines.length - 1) / 2) * 14 - 4, 'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': 12, 'font-weight': 700, fill: inkFor(cat.color), 'pointer-events': 'none',
    }, ln)));
    kids.push(s('text', { x: CX, y: CY + 22, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 9.5, fill: inkFor(cat.color), 'pointer-events': 'none' }, '‹ back'));
    return kids;
  }

  function render() {
    recomputeTotals();
    const cat = focus ? WHEEL.find((c) => c.name === focus) : null;
    svg.replaceChildren(...(cat ? zoomed(cat) : overview()));
  }

  render();
  return {
    el: svg,
    setSelected(set) { sel = set; render(); },
    setCounts(map) { cnt = map; render(); },
    setFocus,
    get focus() { return focus; },
  };
}
