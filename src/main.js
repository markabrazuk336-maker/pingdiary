/** Связка интерфейса: запуск теста, дневник, сравнение, статистика. */

import { SpeedTest, deviceNetwork, coloLabel } from './engine.js';
import * as store from './storage.js';
import { t, setLang, getLang, locale, applyTranslations } from './i18n.js';
import { fmtSpeed, fmtMs, fmtMetric, fmtDate, deltaPct, fmtDelta, avg, median } from './format.js';
import { drawLiveChart, drawHistoryChart, drawHourChart } from './charts.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 84;

const state = {
  history: store.loadHistory(),
  settings: store.loadSettings(),
  test: null,          // активный SpeedTest, если тест идёт
  meta: null,          // последние сведения о соединении
  livePoints: [],      // точки графика текущего теста
  testStartedAt: 0,
  selected: new Set(), // отмеченные в дневнике замеры
  tab: 'test',
  statMetric: 'down',
};

/* ------------------------------ мелочи ------------------------------ */

let toastTimer = null;
function toast(message, isError = false) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.toggle('is-error', isError);
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 3600);
}

const unitOf = (metric) => (metric === 'ping' || metric === 'jitter' ? t('unit.ms') : t('unit.mbps'));

/* ------------------------------ вкладки ------------------------------ */

function switchTab(name) {
  state.tab = name;
  $$('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === name));
  $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === `view-${name}`));

  // Графики рисуем только когда вкладка видима: у скрытых узлов нулевой размер.
  if (name === 'stats') renderStats();
  if (name === 'compare') renderCompare();
  if (name === 'test') drawLiveChart($('#live-chart'), state.livePoints);
}

/* ------------------------------ тест ------------------------------ */

function setGauge(fraction) {
  const value = Math.max(0, Math.min(1, fraction));
  const fill = $('#gauge-fill');
  fill.style.strokeDashoffset = String(GAUGE_CIRCUMFERENCE * (1 - value));
  // при нулевом прогрессе скруглённый конец линии выглядел бы точкой
  fill.style.opacity = value > 0.001 ? '1' : '0';
}

function setPhase(phase) {
  $('.gauge').dataset.phase = phase;
  $('#gauge-phase').textContent = t(`phase.${phase}`);
  $('#gauge-unit').textContent = phase === 'latency' ? t('unit.ms') : t('unit.mbps');
}

function resetTestUI() {
  state.livePoints = [];
  setGauge(0);
  $('#gauge-value').textContent = '0.00';
  ['#m-down', '#m-up', '#m-ping', '#m-jitter'].forEach((id) => { $(id).textContent = '—'; });
  drawLiveChart($('#live-chart'), []);
}

function showMeta(meta) {
  state.meta = meta; // чтобы перерисовать карточку при смене языка
  $('#c-isp').textContent = meta?.asOrganization || '—';
  $('#c-ip').textContent = meta?.clientIp || '—';
  $('#c-server').textContent = coloLabel(meta) || '—';

  const net = deviceNetwork();
  $('#c-net').textContent = net
    ? [net.type, net.effectiveType, net.downlink ? `~${net.downlink} ${t('unit.mbps')}` : null]
        .filter(Boolean).join(' · ') || '—'
    : '—';
}

async function startTest() {
  if (state.test) {                 // повторное нажатие = остановка
    state.test.cancel();
    return;
  }

  resetTestUI();
  state.testStartedAt = performance.now();

  const button = $('#btn-start');
  button.textContent = t('btn.stop');
  button.classList.add('is-running');

  const test = new SpeedTest({
    onPhase: setPhase,
    onProgress: setGauge,
    onMeta: showMeta,
    onLatency: ({ ping, jitter }) => {
      $('#m-ping').textContent = fmtMs(ping);
      $('#m-jitter').textContent = fmtMs(jitter);
    },
    onSpeed: (value, phase) => {
      $('#gauge-value').textContent = phase === 'latency' ? fmtMs(value) : fmtSpeed(value);

      if (phase === 'latency') {
        $('#m-ping').textContent = fmtMs(value);
        return;
      }
      $(phase === 'download' ? '#m-down' : '#m-up').textContent = fmtSpeed(value);
      state.livePoints.push({ t: performance.now() - state.testStartedAt, v: value, phase });
      if (state.tab === 'test') drawLiveChart($('#live-chart'), state.livePoints);
    },
  });
  state.test = test;

  try {
    const result = await test.run($('#run-label').value);

    $('#m-down').textContent = fmtSpeed(result.down);
    $('#m-up').textContent = fmtSpeed(result.up);
    $('#m-ping').textContent = fmtMs(result.ping);
    $('#m-jitter').textContent = fmtMs(result.jitter);
    $('#gauge-value').textContent = fmtSpeed(result.down);
    $('#gauge-unit').textContent = t('unit.mbps');
    setGauge(1);

    if ($('#auto-save').checked) {
      state.history = store.addRecord(result);
      renderHistory();
      renderCompare();
      toast(t('toast.saved'));
    }
  } catch (err) {
    if (test.signal.aborted || err?.name === 'AbortError') {
      setPhase('stopped');
      toast(t('toast.stopped'));
    } else {
      setPhase('error');
      toast(t('toast.netError'), true);
      console.error(err);
    }
    setGauge(0);
  } finally {
    state.test = null;
    button.textContent = t('btn.start');
    button.classList.remove('is-running');
  }
}

/* ------------------------------ дневник ------------------------------ */

function filteredHistory() {
  const query = $('#hist-search').value.trim().toLowerCase();
  let list = state.history;

  if (query) {
    list = list.filter((r) =>
      [r.label, r.isp, r.city, r.colo].filter(Boolean).join(' ').toLowerCase().includes(query)
    );
  }

  const sorters = {
    'ts-desc': (a, b) => b.ts - a.ts,
    'ts-asc': (a, b) => a.ts - b.ts,
    'down-desc': (a, b) => b.down - a.down,
    'down-asc': (a, b) => a.down - b.down,
    'ping-asc': (a, b) => a.ping - b.ping,
  };
  return [...list].sort(sorters[$('#hist-sort').value] || sorters['ts-desc']);
}

/** Ячейка метки: клик превращает её в поле ввода. */
function labelCell(record) {
  const td = document.createElement('td');

  const showText = () => {
    td.textContent = '';
    const span = document.createElement('span');
    span.style.cursor = 'pointer';
    if (record.label) {
      span.className = 'tag';
      span.textContent = record.label;
    } else {
      span.className = 'muted';
      span.textContent = `+ ${t('noLabel')}`;
    }
    span.addEventListener('click', showInput);
    td.appendChild(span);
  };

  const showInput = () => {
    td.textContent = '';
    const input = document.createElement('input');
    input.className = 'input';
    input.value = record.label;
    input.maxLength = 40;
    input.style.minWidth = '150px';

    let closed = false;
    const commit = (save) => {
      if (closed) return;
      closed = true;
      if (save) {
        record.label = input.value.trim().slice(0, 40);
        state.history = store.updateLabel(record.id, record.label);
        renderCompare();
      }
      showText();
    };

    input.addEventListener('blur', () => commit(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit(true);
      if (e.key === 'Escape') commit(false);
    });

    td.appendChild(input);
    input.focus();
    input.select();
  };

  showText();
  return td;
}

function renderHistory() {
  const body = $('#hist-body');
  const rows = filteredHistory();
  body.textContent = '';

  $('#hist-empty').hidden = rows.length > 0;
  $('#hist-count').textContent = `${state.history.length} ${t('measurements')}`;

  for (const record of rows) {
    const tr = document.createElement('tr');

    const tdCheck = document.createElement('td');
    tdCheck.className = 'td-check';
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = state.selected.has(record.id);
    check.addEventListener('change', () => {
      if (check.checked) state.selected.add(record.id);
      else state.selected.delete(record.id);
      updateSelectionUI();
    });
    tdCheck.appendChild(check);
    tr.appendChild(tdCheck);

    const tdDate = document.createElement('td');
    tdDate.textContent = fmtDate(record.ts, locale());
    tr.appendChild(tdDate);

    tr.appendChild(labelCell(record));

    for (const [key, formatter] of [['down', fmtSpeed], ['up', fmtSpeed], ['ping', fmtMs], ['jitter', fmtMs]]) {
      const td = document.createElement('td');
      td.className = 'num';
      td.textContent = formatter(record[key]);
      tr.appendChild(td);
    }

    const tdIsp = document.createElement('td');
    tdIsp.className = 'muted';
    tdIsp.textContent = record.isp || '—';
    tr.appendChild(tdIsp);

    const tdDel = document.createElement('td');
    const del = document.createElement('button');
    del.className = 'row-del';
    del.textContent = '×';
    del.title = t('btn.delete');
    del.addEventListener('click', () => {
      state.history = store.deleteRecord(record.id);
      state.selected.delete(record.id);
      renderHistory();
      renderCompare();
      toast(t('toast.deleted'));
    });
    tdDel.appendChild(del);
    tr.appendChild(tdDel);

    body.appendChild(tr);
  }

  updateSelectionUI();
}

function updateSelectionUI() {
  $('#btn-goto-compare').disabled = state.selected.size !== 2;
}

/* ------------------------------ сравнение ------------------------------ */

function optionLabel(record) {
  const parts = [fmtDate(record.ts, locale())];
  if (record.label) parts.push(record.label);
  parts.push(`↓ ${fmtSpeed(record.down)}`);
  return parts.join(' · ');
}

function fillCompareSelects() {
  for (const id of ['#cmp-a', '#cmp-b']) {
    const select = $(id);
    const previous = select.value;
    select.textContent = '';

    for (const record of state.history) {
      const option = document.createElement('option');
      option.value = record.id;
      option.textContent = optionLabel(record);
      select.appendChild(option);
    }
    if (previous && state.history.some((r) => r.id === previous)) select.value = previous;
  }

  // По умолчанию: свежий замер против предыдущего.
  if (state.history.length >= 2) {
    if (!$('#cmp-a').value) $('#cmp-a').value = state.history[1].id;
    if (!$('#cmp-b').value || $('#cmp-b').value === $('#cmp-a').value) $('#cmp-b').value = state.history[0].id;
  }
}

const METRICS = [
  { key: 'down', label: 'm.download', color: 'var(--down)', higherIsBetter: true },
  { key: 'up', label: 'm.upload', color: 'var(--up)', higherIsBetter: true },
  { key: 'ping', label: 'm.ping', color: 'var(--ping)', higherIsBetter: false },
  { key: 'jitter', label: 'm.jitter', color: 'var(--jitter)', higherIsBetter: false },
];

function renderCompare() {
  fillCompareSelects();
  renderGroups();

  const box = $('#cmp-result');
  const a = state.history.find((r) => r.id === $('#cmp-a').value);
  const b = state.history.find((r) => r.id === $('#cmp-b').value);

  box.textContent = '';
  if (!a || !b) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = t('empty.compare');
    box.appendChild(empty);
    return;
  }

  const heads = document.createElement('div');
  heads.className = 'cmp-heads';
  for (const [record, tag] of [[a, 'A'], [b, 'B']]) {
    const card = document.createElement('div');
    card.className = 'cmp-head';
    card.innerHTML =
      `<div class="h-date">${tag} · ${fmtDate(record.ts, locale())}</div>` +
      `<div class="h-sub"></div>`;
    card.querySelector('.h-sub').textContent =
      [record.label || t('noLabel'), record.isp, record.colo].filter(Boolean).join(' · ');
    heads.appendChild(card);
  }
  box.appendChild(heads);

  const grid = document.createElement('div');
  grid.className = 'cmp-grid';

  for (const metric of METRICS) {
    const valueA = a[metric.key] || 0;
    const valueB = b[metric.key] || 0;
    const scale = Math.max(valueA, valueB, 0.0001);

    const row = document.createElement('div');
    row.className = 'cmp-row';

    const name = document.createElement('div');
    name.className = 'cmp-name';
    name.textContent = t(metric.label);
    row.appendChild(name);

    const bars = document.createElement('div');
    bars.className = 'cmp-bars';
    for (const [value, tag] of [[valueA, 'A'], [valueB, 'B']]) {
      const bar = document.createElement('div');
      bar.className = 'cmp-bar';
      bar.innerHTML =
        `<span class="muted">${tag}</span>` +
        `<div class="cmp-bar-track"><div class="cmp-bar-fill" style="width:${(value / scale) * 100}%;background:${metric.color};opacity:${tag === 'A' ? '.55' : '1'}"></div></div>` +
        `<span class="cmp-bar-val">${fmtMetric(metric.key, value)} ${unitOf(metric.key)}</span>`;
      bars.appendChild(bar);
    }
    row.appendChild(bars);

    const pct = deltaPct(valueA, valueB);
    const delta = document.createElement('div');
    delta.className = 'delta';
    delta.textContent = fmtDelta(pct);
    if (pct == null || Math.abs(pct) < 1) delta.classList.add('same');
    else delta.classList.add((pct > 0) === metric.higherIsBetter ? 'up' : 'down');
    row.appendChild(delta);

    grid.appendChild(row);
  }

  box.appendChild(grid);

  const downDelta = deltaPct(a.down, b.down);
  const verdict = document.createElement('div');
  verdict.className = 'muted';
  verdict.style.marginTop = '14px';
  verdict.textContent =
    downDelta == null || Math.abs(downDelta) < 3
      ? t('cmp.verdict.same')
      : `${downDelta > 0 ? t('cmp.verdict.better') : t('cmp.verdict.worse')} — ${t('m.download')} ${fmtDelta(downDelta)}`;
  box.appendChild(verdict);
}

function renderGroups() {
  const box = $('#cmp-groups');
  box.textContent = '';

  const groups = new Map();
  for (const record of state.history) {
    const key = record.label.trim() || t('noLabel');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  if (!groups.size) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = t('empty.groups');
    box.appendChild(empty);
    return;
  }

  const rows = [...groups.entries()]
    .map(([name, list]) => ({
      name,
      count: list.length,
      down: avg(list.map((r) => r.down)),
      up: avg(list.map((r) => r.up)),
      ping: avg(list.map((r) => r.ping)),
    }))
    .sort((x, y) => y.down - x.down);

  const scale = Math.max(...rows.map((r) => r.down), 0.0001);

  for (const row of rows) {
    const node = document.createElement('div');
    node.className = 'group-row';
    node.innerHTML =
      `<div><div class="group-name"></div><div class="group-count">${row.count} ${t('measurements')}</div></div>` +
      `<div class="cmp-bar-track"><div class="cmp-bar-fill" style="width:${(row.down / scale) * 100}%;background:var(--down)"></div></div>` +
      `<div class="cmp-bar-val">↓ ${fmtSpeed(row.down)} · ↑ ${fmtSpeed(row.up)} · ${fmtMs(row.ping)} ${t('unit.ms')}</div>`;
    node.querySelector('.group-name').textContent = row.name;
    box.appendChild(node);
  }
}

/* ------------------------------ статистика ------------------------------ */

function statsRange() {
  const days = Number($('#stat-range').value);
  const list = days ? state.history.filter((r) => r.ts >= Date.now() - days * 864e5) : state.history;
  return [...list].sort((a, b) => a.ts - b.ts);
}

function summaryCard(label, value, sub) {
  const card = document.createElement('div');
  card.className = 'sum-card';
  card.innerHTML = `<div class="sum-label"></div><div class="sum-value"></div><div class="sum-sub"></div>`;
  card.querySelector('.sum-label').textContent = label;
  card.querySelector('.sum-value').textContent = value;
  card.querySelector('.sum-sub').textContent = sub || '';
  return card;
}

function renderStats() {
  const records = statsRange();
  const metric = state.statMetric;
  const unit = unitOf(metric);

  $('#stat-empty').hidden = records.length > 0;
  drawHistoryChart($('#stat-chart'), records, { metric, locale: locale(), unit });
  drawHourChart($('#hour-chart'), records, { metric });

  const box = $('#stat-summary');
  box.textContent = '';
  if (!records.length) return;

  const values = records.map((r) => r[metric] ?? 0);
  const lowerIsBetter = metric === 'ping' || metric === 'jitter';
  const best = lowerIsBetter ? Math.min(...values) : Math.max(...values);
  const worst = lowerIsBetter ? Math.max(...values) : Math.min(...values);
  const last = records[records.length - 1];

  const fmt = (v) => `${fmtMetric(metric, v)} ${unit}`;

  box.appendChild(summaryCard(t('stats.avg'), fmt(avg(values)), `${t('stats.median')} ${fmt(median(values))}`));
  box.appendChild(summaryCard(t('stats.best'), fmt(best)));
  box.appendChild(summaryCard(t('stats.worst'), fmt(worst)));
  box.appendChild(summaryCard(t('stats.last'), fmt(last[metric]), fmtDate(last.ts, locale())));
  box.appendChild(summaryCard(t('stats.count'), String(records.length), t('stats.days')));
}

/* ------------------------------ импорт/экспорт ------------------------------ */

function exportJSON() {
  const stamp = new Date().toISOString().slice(0, 10);
  store.downloadFile(`pingdiary-${stamp}.json`, store.toJSON(state.history), 'application/json');
}

function exportCSV() {
  const stamp = new Date().toISOString().slice(0, 10);
  store.downloadFile(`pingdiary-${stamp}.csv`, store.toCSV(state.history), 'text/csv');
}

async function importFile(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = Array.isArray(parsed) ? parsed : parsed.records;
    if (!Array.isArray(incoming)) throw new Error('bad format');

    const { list, added } = store.mergeRecords(incoming);
    state.history = list;
    renderHistory();
    renderCompare();
    toast(t('toast.imported', { n: added }));
  } catch (err) {
    console.error(err);
    toast(t('toast.importError'), true);
  }
}

/* ------------------------------ запуск ------------------------------ */

function applySettings() {
  document.documentElement.dataset.theme = state.settings.theme;
  $('#lang-toggle').textContent = state.settings.lang.toUpperCase();
  $('#auto-save').checked = state.settings.autoSave;
  setLang(state.settings.lang);
}

function redrawEverything() {
  applyTranslations();
  showMeta(state.meta);
  renderHistory();
  renderCompare();
  if (state.tab === 'stats') renderStats();
  if (state.tab === 'test') drawLiveChart($('#live-chart'), state.livePoints);
  setPhase(state.test ? state.test.phase || 'idle' : 'idle');
}

function bindEvents() {
  $('#tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) switchTab(tab.dataset.tab);
  });

  $('#btn-start').addEventListener('click', startTest);

  $('#auto-save').addEventListener('change', (e) => {
    state.settings = store.saveSettings({ autoSave: e.target.checked });
  });

  $('#theme-toggle').addEventListener('click', () => {
    const theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    state.settings = store.saveSettings({ theme });
    document.documentElement.dataset.theme = theme;
    // цвета графиков берутся из CSS-переменных — перерисовываем
    if (state.tab === 'stats') renderStats();
    if (state.tab === 'test') drawLiveChart($('#live-chart'), state.livePoints);
  });

  $('#lang-toggle').addEventListener('click', () => {
    const lang = getLang() === 'ru' ? 'en' : 'ru';
    state.settings = store.saveSettings({ lang });
    setLang(lang);
    $('#lang-toggle').textContent = lang.toUpperCase();
    redrawEverything();
  });

  $('#hist-search').addEventListener('input', renderHistory);
  $('#hist-sort').addEventListener('change', renderHistory);

  $('#check-all').addEventListener('change', (e) => {
    state.selected.clear();
    if (e.target.checked) filteredHistory().slice(0, 2).forEach((r) => state.selected.add(r.id));
    renderHistory();
  });

  $('#btn-goto-compare').addEventListener('click', () => {
    const [a, b] = [...state.selected];
    // в списке история отсортирована от новых к старым — A пусть будет старше
    const recordA = state.history.find((r) => r.id === a);
    const recordB = state.history.find((r) => r.id === b);
    const [older, newer] = recordA.ts <= recordB.ts ? [recordA, recordB] : [recordB, recordA];

    switchTab('compare');
    $('#cmp-a').value = older.id;
    $('#cmp-b').value = newer.id;
    renderCompare();
  });

  $('#btn-export-json').addEventListener('click', exportJSON);
  $('#btn-export-csv').addEventListener('click', exportCSV);
  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importFile(file);
    e.target.value = '';
  });

  $('#btn-clear').addEventListener('click', () => {
    if (!state.history.length) return;
    if (!confirm(t('confirm.clear'))) return;
    state.history = store.clearHistory();
    state.selected.clear();
    renderHistory();
    renderCompare();
    toast(t('toast.cleared'));
  });

  $('#cmp-a').addEventListener('change', renderCompare);
  $('#cmp-b').addEventListener('change', renderCompare);

  $('#stat-metric').addEventListener('click', (e) => {
    const seg = e.target.closest('.seg');
    if (!seg) return;
    state.statMetric = seg.dataset.metric;
    $$('#stat-metric .seg').forEach((b) => b.classList.toggle('is-active', b === seg));
    renderStats();
  });

  $('#stat-range').addEventListener('change', renderStats);

  // Графики зависят от ширины контейнера — перерисовываем при ресайзе.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.tab === 'stats') renderStats();
      if (state.tab === 'test') drawLiveChart($('#live-chart'), state.livePoints);
    }, 150);
  });

  // Пробел запускает тест, если фокус не в поле ввода.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.target.matches('input, select, textarea, button')) return;
    e.preventDefault();
    startTest();
  });
}

function init() {
  applySettings();
  bindEvents();
  showMeta(null);
  renderHistory();
  renderCompare();
  drawLiveChart($('#live-chart'), []);
  setGauge(0);
}

init();
