// Hand-rolled SVG scatter plot and HTML bars. No libraries, works offline.
import { h, s, fmtNum } from './util.js';

export function niceScale(min, max, n = 5) {
  if (min === max) { min -= 1; max += 1; }
  const step0 = (max - min) / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const norm = step0 / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return { lo, hi, ticks };
}

const W = 360, H = 270, M = { l: 50, r: 14, t: 14, b: 42 };

function marker(kind, x, y, extra = {}) {
  const common = { class: 'pt pt-' + kind, ...extra };
  if (kind === 'worked') return s('circle', { cx: x, cy: y, r: 6.5, ...common });
  if (kind === 'okay') return s('path', { d: `M${x},${y - 8}L${x + 8},${y}L${x},${y + 8}L${x - 8},${y}Z`, ...common });
  if (kind === 'failed') {
    return s('path', { d: `M${x - 6},${y - 6}L${x + 6},${y + 6}M${x - 6},${y + 6}L${x + 6},${y - 6}`, ...common });
  }
  return s('circle', { cx: x, cy: y, r: 5.5, ...common });
}

/**
 * points: [{id, x, y, verdict}]
 * yTicks: optional [{v, label}] for categorical y axes (balance, strength)
 */
export function scatter({ points, xLabel, yLabel, yDomain, yTicks, band, refLine, selectedId, onPick }) {
  const xs = points.map((p) => p.x);
  let xmin = Math.min(...xs), xmax = Math.max(...xs);
  if (xmin === xmax) { const pad = Math.max(1, Math.abs(xmin) * 0.05); xmin -= pad; xmax += pad; }
  const xpad = (xmax - xmin) * 0.06;
  const xs_ = niceScale(xmin - xpad, xmax + xpad, 5);
  let ylo, yhi, yt;
  if (yDomain) { [ylo, yhi] = yDomain; yt = yTicks || niceScale(ylo, yhi, 5).ticks.map((v) => ({ v, label: fmtNum(v, 1) })); }
  else {
    const ys = niceScale(Math.min(...points.map((p) => p.y)) - 0.3, Math.max(...points.map((p) => p.y)) + 0.3, 5);
    ylo = ys.lo; yhi = ys.hi; yt = ys.ticks.map((v) => ({ v, label: fmtNum(v, 1) }));
  }
  const X = (v) => M.l + ((v - xs_.lo) / (xs_.hi - xs_.lo)) * (W - M.l - M.r);
  const Y = (v) => H - M.b - ((v - ylo) / (yhi - ylo)) * (H - M.t - M.b);

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `${yLabel} against ${xLabel}, ${points.length} brews` });

  // grid + y ticks
  for (const t of yt) {
    svg.appendChild(s('line', { x1: M.l, x2: W - M.r, y1: Y(t.v), y2: Y(t.v), class: 'grid' }));
    svg.appendChild(s('text', { x: M.l - 6, y: Y(t.v), 'text-anchor': 'end', 'dominant-baseline': 'central', class: 'tick' }, t.label));
  }
  for (const v of xs_.ticks) {
    svg.appendChild(s('line', { x1: X(v), x2: X(v), y1: M.t, y2: H - M.b, class: 'grid grid-v' }));
    svg.appendChild(s('text', { x: X(v), y: H - M.b + 16, 'text-anchor': 'middle', class: 'tick' }, fmtNum(v, 1)));
  }
  if (band) {
    const x0 = X(Math.max(band.x0, xs_.lo)), x1 = X(Math.min(band.x1, xs_.hi));
    svg.appendChild(s('rect', { x: x0, y: M.t, width: Math.max(4, x1 - x0), height: H - M.t - M.b, class: 'band' }));
  }
  if (refLine !== undefined && refLine !== null) {
    svg.appendChild(s('line', { x1: M.l, x2: W - M.r, y1: Y(refLine), y2: Y(refLine), class: 'ref' }));
  }
  svg.appendChild(s('line', { x1: M.l, x2: W - M.r, y1: H - M.b, y2: H - M.b, class: 'axis' }));
  svg.appendChild(s('text', { x: (M.l + W - M.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis-label' }, xLabel));
  svg.appendChild(s('text', { transform: `translate(12 ${(M.t + H - M.b) / 2}) rotate(-90)`, 'text-anchor': 'middle', class: 'axis-label' }, yLabel));

  // spread identical points a little so none is hidden
  const seen = new Map();
  for (const p of points) {
    const key = `${Math.round(X(p.x))}:${Math.round(Y(p.y))}`;
    const n = seen.get(key) || 0;
    seen.set(key, n + 1);
    const dx = n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 9;
    const px = X(p.x) + dx, py = Y(p.y);
    const g = s('g', {
      class: 'pt-wrap' + (p.id === selectedId ? ' sel' : ''), role: 'button', tabindex: '0',
      'aria-label': `${p.label || 'Brew'}: ${fmtNum(p.x, 1)}, ${fmtNum(p.y, 1)}`,
    });
    if (p.id === selectedId) g.appendChild(s('circle', { cx: px, cy: py, r: 13, class: 'pt-ring' }));
    g.appendChild(s('circle', { cx: px, cy: py, r: 16, class: 'hit' }));
    g.appendChild(marker(p.verdict || 'none', px, py));
    if (onPick) {
      g.addEventListener('click', () => onPick(p.id));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(p.id); } });
    }
    svg.appendChild(g);
  }
  return svg;
}

export function verdictLegend() {
  const mk = (kind, label) => {
    const wrap = h('span', { class: 'legend-item' });
    const svg = s('svg', { viewBox: '0 0 20 20', width: 16, height: 16, 'aria-hidden': 'true' });
    svg.appendChild(marker(kind, 10, 10));
    wrap.appendChild(svg);
    wrap.appendChild(document.createTextNode(label));
    return wrap;
  };
  return h('div', { class: 'legend' }, mk('worked', 'Worked'), mk('okay', 'Okay'), mk('failed', "Didn't work"), mk('none', 'Not rated'));
}

// Horizontal bar rows: [{label, value, text, color}]
export function bars(rows, max) {
  const top = max || Math.max(1, ...rows.map((r) => r.value));
  return h('div', { class: 'bars' }, rows.map((r) => h('div', { class: 'bar-row' },
    h('span', { class: 'bar-label' }, r.label),
    h('span', { class: 'bar-track' }, h('i', { style: { width: Math.max(2, (r.value / top) * 100) + '%', background: r.color || 'var(--accent)' } })),
    h('span', { class: 'bar-val' }, r.text ?? String(r.value)))));
}
