/** Форматирование чисел и дат для интерфейса и экспорта. */

export function fmtSpeed(v) {
  if (v == null || !isFinite(v)) return '—';
  if (v >= 100) return v.toFixed(1);
  if (v >= 10) return v.toFixed(2);
  return v.toFixed(2);
}

export function fmtMs(v) {
  if (v == null || !isFinite(v)) return '—';
  return v >= 100 ? v.toFixed(0) : v.toFixed(1);
}

export function fmtMetric(kind, value) {
  return kind === 'ping' || kind === 'jitter' ? fmtMs(value) : fmtSpeed(value);
}

export function fmtDate(ts, locale = 'ru-RU') {
  return new Date(ts).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDay(ts, locale = 'ru-RU') {
  return new Date(ts).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

/** Разница B относительно A в процентах. */
export function deltaPct(a, b) {
  if (!a || !isFinite(a) || !isFinite(b)) return null;
  return ((b - a) / a) * 100;
}

export function fmtDelta(pct) {
  if (pct == null) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

export const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);

export function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
