/**
 * Мини-библиотека графиков на голом SVG: линия хода теста, история замеров
 * и столбики по времени суток. Внешних зависимостей нет намеренно —
 * сайт должен работать как есть, без сборки и CDN.
 */

import { fmtMetric, fmtDate, fmtDay } from './format.js';

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) node.setAttribute(k, String(v));
  }
  if (parent) parent.appendChild(node);
  return node;
}

function clear(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

/**
 * Подгоняем систему координат под реальный размер элемента: так текст не
 * растягивается, а линии остаются в пиксельной сетке.
 */
function fitViewBox(svg, fallbackW = 600, fallbackH = 200) {
  const rect = svg.getBoundingClientRect();
  const w = Math.max(120, Math.round(rect.width) || fallbackW);
  const h = Math.max(80, Math.round(rect.height) || fallbackH);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  return { w, h };
}

/** Округляем верх шкалы до «красивого» числа, чтобы подписи были ровными. */
function niceMax(value) {
  if (!isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const n = value / base;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * base;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const PAD = { top: 14, right: 14, bottom: 26, left: 48 };

function drawGrid(svg, { w, h, max, ticks = 4, unit = '' }) {
  for (let i = 0; i <= ticks; i++) {
    const value = (max / ticks) * i;
    const y = h - PAD.bottom - ((h - PAD.top - PAD.bottom) * i) / ticks;
    el('line', { x1: PAD.left, y1: y, x2: w - PAD.right, y2: y, class: i === 0 ? 'axis-line' : 'grid-line' }, svg);
    const label = el('text', { x: PAD.left - 8, y: y + 4, 'text-anchor': 'end', class: 'axis-text' }, svg);
    label.textContent = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(0) : value.toFixed(1);
  }
  if (unit) {
    const u = el('text', { x: PAD.left - 8, y: PAD.top - 2, 'text-anchor': 'end', class: 'axis-text' }, svg);
    u.textContent = unit;
  }
}

/* ------------------------- график хода теста ------------------------- */

/**
 * @param {SVGElement} svg
 * @param {{t:number, v:number, phase:string}[]} points — время от старта, Мбит/с
 */
export function drawLiveChart(svg, points) {
  const { w, h } = fitViewBox(svg, 600, 200);
  clear(svg);

  const maxV = niceMax(Math.max(1, ...points.map((p) => p.v)));
  drawGrid(svg, { w, h, max: maxV });

  if (!points.length) return;

  const maxT = Math.max(1000, ...points.map((p) => p.t));
  const x = (t) => PAD.left + ((w - PAD.left - PAD.right) * t) / maxT;
  const y = (v) => h - PAD.bottom - ((h - PAD.top - PAD.bottom) * Math.min(v, maxV)) / maxV;

  for (const [phase, color] of [['download', cssVar('--down')], ['upload', cssVar('--up')]]) {
    const pts = points.filter((p) => p.phase === phase);
    if (pts.length < 2) continue;

    const line = pts.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const area = `${x(pts[0].t).toFixed(1)},${h - PAD.bottom} ${line} ${x(pts[pts.length - 1].t).toFixed(1)},${h - PAD.bottom}`;

    el('polygon', { points: area, fill: color, opacity: '.14' }, svg);
    el('polyline', {
      points: line,
      fill: 'none',
      stroke: color,
      'stroke-width': 2.5,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    }, svg);
  }
}

/* --------------------------- история замеров --------------------------- */

const METRIC_COLOR = { down: '--down', up: '--up', ping: '--ping', jitter: '--jitter' };

/**
 * @param {SVGElement} svg
 * @param {object[]} records — по возрастанию времени
 * @param {{metric: string, locale: string, unit: string}} opts
 */
export function drawHistoryChart(svg, records, { metric, locale, unit }) {
  const { w, h } = fitViewBox(svg, 800, 300);
  clear(svg);

  const color = cssVar(METRIC_COLOR[metric] || '--accent');
  const values = records.map((r) => r[metric] ?? 0);
  const maxV = niceMax(Math.max(1, ...values) * 1.1);
  drawGrid(svg, { w, h, max: maxV, unit });

  if (!records.length) return;

  const innerW = w - PAD.left - PAD.right;
  const x = (i) => (records.length === 1 ? PAD.left + innerW / 2 : PAD.left + (innerW * i) / (records.length - 1));
  const y = (v) => h - PAD.bottom - ((h - PAD.top - PAD.bottom) * Math.min(v, maxV)) / maxV;

  const line = records.map((r, i) => `${x(i).toFixed(1)},${y(r[metric]).toFixed(1)}`).join(' ');
  const area = `${x(0).toFixed(1)},${h - PAD.bottom} ${line} ${x(records.length - 1).toFixed(1)},${h - PAD.bottom}`;

  el('polygon', { points: area, fill: color, opacity: '.12' }, svg);
  el('polyline', {
    points: line,
    fill: 'none',
    stroke: color,
    'stroke-width': 2.5,
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round',
  }, svg);

  // подписи по оси X — не чаще, чем влезает
  const stepLabels = Math.max(1, Math.ceil(records.length / Math.max(2, Math.floor(innerW / 90))));
  records.forEach((r, i) => {
    if (i % stepLabels && i !== records.length - 1) return;
    const label = el('text', { x: x(i), y: h - 8, 'text-anchor': 'middle', class: 'axis-text' }, svg);
    label.textContent = fmtDay(r.ts, locale);
  });

  // точки с всплывающей подсказкой
  const tip = el('g', { style: 'pointer-events:none', opacity: '0' }, svg);
  const tipBg = el('rect', {
    rx: 8, fill: cssVar('--card'), stroke: cssVar('--line'), 'stroke-width': 1,
  }, tip);
  const tipMain = el('text', { class: 'axis-text', fill: cssVar('--text'), 'font-size': 13 }, tip);
  const tipSub = el('text', { class: 'axis-text' }, tip);

  records.forEach((r, i) => {
    const cx = x(i);
    const cy = y(r[metric]);
    el('circle', { cx, cy, r: 3.5, fill: color }, svg);

    const hit = el('circle', { cx, cy, r: 14, fill: 'transparent', class: 'chart-point' }, svg);
    hit.addEventListener('mouseenter', () => {
      tipMain.textContent = `${fmtMetric(metric, r[metric])} ${unit}`;
      tipSub.textContent = `${fmtDate(r.ts, locale)}${r.label ? ' · ' + r.label : ''}`;

      const width = Math.max(tipMain.getComputedTextLength(), tipSub.getComputedTextLength()) + 20;
      const left = Math.min(Math.max(cx - width / 2, PAD.left), w - PAD.right - width);
      const top = Math.max(cy - 52, 4);

      tipBg.setAttribute('x', left);
      tipBg.setAttribute('y', top);
      tipBg.setAttribute('width', width);
      tipBg.setAttribute('height', 42);
      tipMain.setAttribute('x', left + 10);
      tipMain.setAttribute('y', top + 18);
      tipSub.setAttribute('x', left + 10);
      tipSub.setAttribute('y', top + 33);
      tip.setAttribute('opacity', '1');
    });
    hit.addEventListener('mouseleave', () => tip.setAttribute('opacity', '0'));
  });

  svg.appendChild(tip); // подсказка всегда поверх точек
}

/* ------------------------ распределение по часам ------------------------ */

export function drawHourChart(svg, records, { metric }) {
  const { w, h } = fitViewBox(svg, 800, 220);
  clear(svg);

  const buckets = Array.from({ length: 24 }, () => []);
  for (const r of records) buckets[new Date(r.ts).getHours()].push(r[metric] ?? 0);

  const means = buckets.map((b) => (b.length ? b.reduce((s, x) => s + x, 0) / b.length : 0));
  const maxV = niceMax(Math.max(1, ...means));
  const color = cssVar(METRIC_COLOR[metric] || '--accent');

  drawGrid(svg, { w, h, max: maxV, ticks: 3 });

  const innerW = w - PAD.left - PAD.right;
  const slot = innerW / 24;
  const barW = Math.max(4, slot * 0.6);

  means.forEach((v, hour) => {
    const cx = PAD.left + slot * hour + slot / 2;
    const height = ((h - PAD.top - PAD.bottom) * v) / maxV;

    el('rect', {
      x: cx - barW / 2,
      y: h - PAD.bottom - height,
      width: barW,
      height: Math.max(height, v > 0 ? 2 : 0),
      rx: 3,
      fill: color,
      opacity: buckets[hour].length ? 0.85 : 0.15,
    }, svg);

    if (hour % 3 === 0) {
      const label = el('text', { x: cx, y: h - 8, 'text-anchor': 'middle', class: 'axis-text' }, svg);
      label.textContent = `${hour}:00`;
    }
  });
}
