/** Дневник замеров и настройки — всё в localStorage, без сервера. */

const HISTORY_KEY = 'pingdiary.history.v1';
const SETTINGS_KEY = 'pingdiary.settings.v1';

const DEFAULT_SETTINGS = { theme: 'dark', lang: 'ru', autoSave: true };

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // приватный режим или переполненное хранилище
    return false;
  }
}

/** Пропускаем через нормализацию всё, что пришло из хранилища или импорта. */
function normalize(rec) {
  if (!rec || typeof rec !== 'object') return null;
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const ts = num(rec.ts);
  if (ts == null) return null;
  return {
    id: typeof rec.id === 'string' && rec.id ? rec.id : `${ts.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    ts,
    label: typeof rec.label === 'string' ? rec.label.slice(0, 60) : '',
    down: num(rec.down) ?? 0,
    up: num(rec.up) ?? 0,
    ping: num(rec.ping) ?? 0,
    jitter: num(rec.jitter) ?? 0,
    isp: typeof rec.isp === 'string' ? rec.isp : null,
    ip: typeof rec.ip === 'string' ? rec.ip : null,
    colo: typeof rec.colo === 'string' ? rec.colo : null,
    city: typeof rec.city === 'string' ? rec.city : null,
    country: typeof rec.country === 'string' ? rec.country : null,
    protocol: typeof rec.protocol === 'string' ? rec.protocol : null,
    net: rec.net && typeof rec.net === 'object' ? rec.net : null,
    durationMs: num(rec.durationMs),
  };
}

export function loadHistory() {
  const raw = readJSON(HISTORY_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalize).filter(Boolean).sort((a, b) => b.ts - a.ts);
}

export function saveHistory(list) {
  return writeJSON(HISTORY_KEY, list);
}

export function addRecord(record) {
  const list = loadHistory();
  const clean = normalize(record);
  if (!clean) return list;
  list.unshift(clean);
  saveHistory(list);
  return list;
}

export function deleteRecord(id) {
  const list = loadHistory().filter((r) => r.id !== id);
  saveHistory(list);
  return list;
}

export function updateLabel(id, label) {
  const list = loadHistory();
  const rec = list.find((r) => r.id === id);
  if (rec) {
    rec.label = String(label).slice(0, 60);
    saveHistory(list);
  }
  return list;
}

export function clearHistory() {
  saveHistory([]);
  return [];
}

/** Импорт объединяет записи с текущими, дубли по id отбрасываются. */
export function mergeRecords(incoming) {
  const list = loadHistory();
  const known = new Set(list.map((r) => r.id));
  let added = 0;

  for (const item of incoming) {
    const clean = normalize(item);
    if (!clean || known.has(clean.id)) continue;
    known.add(clean.id);
    list.push(clean);
    added++;
  }

  list.sort((a, b) => b.ts - a.ts);
  saveHistory(list);
  return { list, added };
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...readJSON(SETTINGS_KEY, {}) };
}

export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  writeJSON(SETTINGS_KEY, next);
  return next;
}

/* --------------------------- экспорт файлов --------------------------- */

export function toJSON(list) {
  return JSON.stringify(
    { app: 'PingDiary', version: 1, exportedAt: new Date().toISOString(), records: list },
    null,
    2
  );
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",;\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

export function toCSV(list) {
  const head = [
    'datetime', 'timestamp', 'label', 'download_mbps', 'upload_mbps',
    'ping_ms', 'jitter_ms', 'isp', 'ip', 'server_colo', 'city', 'country', 'network',
  ];
  const rows = list.map((r) =>
    [
      new Date(r.ts).toISOString(),
      r.ts,
      r.label,
      r.down.toFixed(2),
      r.up.toFixed(2),
      r.ping.toFixed(1),
      r.jitter.toFixed(1),
      r.isp,
      r.ip,
      r.colo,
      r.city,
      r.country,
      r.net?.effectiveType || r.net?.type || '',
    ].map(csvCell).join(',')
  );
  return [head.join(','), ...rows].join('\n');
}

export function downloadFile(name, text, mime) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
