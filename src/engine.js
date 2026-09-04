/**
 * Движок замера скорости.
 *
 * Трафик гоняем через публичные CORS-эндпоинты Cloudflare:
 *   GET  /__down?bytes=N — отдаёт N байт;
 *   POST /__up           — принимает тело запроса;
 *   GET  /meta           — сведения о клиенте и точке присутствия.
 * Своего бэкенда проекту не нужно — сайт остаётся статикой.
 */

const ENDPOINT = 'https://speed.cloudflare.com';

export const CONFIG = {
  latencySamples: 12,      // сколько раз пингуем
  latencyTimeoutMs: 5000,

  downloadStreams: 4,      // параллельные соединения
  downloadChunkBytes: 25e6,
  downloadDurationMs: 8000,

  uploadStreams: 3,
  uploadChunkBytes: 4e6,
  uploadDurationMs: 6000,

  rampMs: 1200,            // разгон TCP не учитываем в итоговой цифре
  tickMs: 150,             // как часто обновляем «живую» скорость
};

/** Доля общего прогресса на каждую фазу — чтобы шкала ехала равномерно. */
const WEIGHTS = { meta: 0.03, latency: 0.12, download: 0.5, upload: 0.35 };

const bpsToMbps = (bytes, ms) => (ms > 0 ? (bytes * 8) / (ms / 1000) / 1e6 : 0);
const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Cloudflare отдаёт Server-Timing: cfRequestDuration — время обработки на их
 * стороне. Вычитаем его из RTT, чтобы пинг был ближе к сетевому.
 */
function serverProcessingMs(url) {
  try {
    const entry = performance.getEntriesByName(url).pop();
    const timing = entry?.serverTiming?.find((t) => t.name === 'cfRequestDuration');
    return timing ? timing.duration : null;
  } catch {
    return null;
  }
}

function randomBlob(size) {
  const buf = new Uint8Array(size);
  // crypto.getRandomValues ограничен 65536 байтами за вызов
  for (let off = 0; off < size; off += 65536) {
    crypto.getRandomValues(buf.subarray(off, Math.min(off + 65536, size)));
  }
  return new Blob([buf], { type: 'application/octet-stream' });
}

function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Джиттер = средняя разница между соседними пингами. */
function jitterOf(values) {
  if (values.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < values.length; i++) sum += Math.abs(values[i] - values[i - 1]);
  return sum / (values.length - 1);
}

/**
 * Точку присутствия Cloudflare отдаёт объектом ({iata, city, region}),
 * а в старых ответах — просто кодом аэропорта. Приводим к строке.
 */
export function coloLabel(meta) {
  const colo = meta?.colo;
  if (!colo) return null;
  if (typeof colo === 'string') return colo;
  return [colo.city, colo.iata ? `(${colo.iata})` : null].filter(Boolean).join(' ') || null;
}

/** Сведения о клиенте: провайдер, IP, ближайшая точка присутствия. */
export async function fetchMeta(signal) {
  const res = await fetch(`${ENDPOINT}/meta`, { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`meta ${res.status}`);
  return res.json();
}

/** Тип соединения глазами самого браузера (есть не везде). */
export function deviceNetwork() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return null;
  return {
    type: c.type || null,
    effectiveType: c.effectiveType || null,
    downlink: typeof c.downlink === 'number' ? c.downlink : null,
    rtt: typeof c.rtt === 'number' ? c.rtt : null,
  };
}

export class SpeedTest {
  /**
   * @param {object} handlers
   * @param {(phase: string) => void} [handlers.onPhase]
   * @param {(fraction: number) => void} [handlers.onProgress]  0..1
   * @param {(mbps: number, phase: string) => void} [handlers.onSpeed]
   * @param {(meta: object) => void} [handlers.onMeta]
   * @param {(latency: {ping: number, jitter: number}) => void} [handlers.onLatency]
   */
  constructor(handlers = {}) {
    this.h = handlers;
    this.ac = new AbortController();
    this.done = 0; // накопленный прогресс завершённых фаз
  }

  cancel() {
    this.ac.abort();
  }

  get signal() {
    return this.ac.signal;
  }

  emitPhase(phase) {
    this.phase = phase;
    this.h.onPhase?.(phase);
  }

  /** Прогресс внутри фазы (0..1) переводим в общий прогресс. */
  emitProgress(phase, fraction) {
    this.h.onProgress?.(Math.min(1, this.done + WEIGHTS[phase] * Math.min(1, fraction)));
  }

  finishPhase(phase) {
    this.done += WEIGHTS[phase];
    this.h.onProgress?.(Math.min(1, this.done));
  }

  async run(label = '') {
    const startedAt = Date.now();
    const t0 = performance.now();

    // --- 1. Кто мы и куда попали -------------------------------------
    this.emitPhase('meta');
    let meta = null;
    try {
      meta = await fetchMeta(this.signal);
      this.h.onMeta?.(meta);
    } catch (err) {
      if (this.signal.aborted) throw err;
      // без метаданных тест всё равно возможен
    }
    this.finishPhase('meta');

    // --- 2. Пинг и джиттер -------------------------------------------
    this.emitPhase('latency');
    const latency = await this.measureLatency();
    this.h.onLatency?.(latency);
    this.finishPhase('latency');

    // --- 3. Загрузка --------------------------------------------------
    this.emitPhase('download');
    const download = await this.measureDownload();
    this.finishPhase('download');

    // --- 4. Отдача ----------------------------------------------------
    this.emitPhase('upload');
    const upload = await this.measureUpload();
    this.finishPhase('upload');

    this.emitPhase('done');

    return {
      id: uniq(),
      ts: startedAt,
      label: label.trim(),
      down: download,
      up: upload,
      ping: latency.ping,
      jitter: latency.jitter,
      isp: meta?.asOrganization || null,
      ip: meta?.clientIp || null,
      colo: coloLabel(meta),
      city: meta?.city || null,
      country: meta?.country || null,
      protocol: meta?.httpProtocol || null,
      net: deviceNetwork(),
      durationMs: Math.round(performance.now() - t0),
    };
  }

  async measureLatency() {
    const samples = [];

    // Первый запрос прогревает соединение — в статистику не берём.
    try {
      await fetch(`${ENDPOINT}/__down?bytes=0&warm=${uniq()}`, {
        cache: 'no-store',
        signal: this.signal,
      }).then((r) => r.arrayBuffer());
    } catch (err) {
      if (this.signal.aborted) throw err;
      throw new Error('network');
    }

    for (let i = 0; i < CONFIG.latencySamples; i++) {
      const url = `${ENDPOINT}/__down?bytes=0&p=${uniq()}`;
      const start = performance.now();
      const res = await fetch(url, { cache: 'no-store', signal: this.signal });
      await res.arrayBuffer();
      let rtt = performance.now() - start;

      const server = serverProcessingMs(url);
      if (server != null && server > 0 && server < rtt) rtt -= server;

      samples.push(rtt);
      this.h.onSpeed?.(median(samples), 'latency');
      this.emitProgress('latency', (i + 1) / CONFIG.latencySamples);
    }

    return { ping: median(samples), jitter: jitterOf(samples) };
  }

  /**
   * Общая механика замера пропускной способности: несколько параллельных
   * потоков крутятся заданное время, счётчик байт растёт, а тикер раз в
   * CONFIG.tickMs считает мгновенную и итоговую скорость.
   */
  async runStreams({ phase, durationMs, streams, worker, useSettled = false }) {
    // bytes   — всё, что прошло через обработчики (для «живой» стрелки);
    // settled — только целиком доставленные куски (для итоговой цифры отдачи).
    const state = { bytes: 0, settled: 0, settleFrom: null, settleTo: 0, rampAt: null };
    const startedAt = performance.now();

    let rampBytes = null;
    let rampAt = null;
    let lastBytes = 0;
    let lastAt = startedAt;
    let smoothed = null; // экспоненциальное сглаживание — иначе стрелка дёргается

    const isOver = () => performance.now() - startedAt >= durationMs || this.signal.aborted;

    const ticker = setInterval(() => {
      const now = performance.now();
      const elapsed = now - startedAt;

      // фиксируем засечку сразу после разгона
      if (rampAt === null && elapsed >= CONFIG.rampMs) {
        rampAt = now;
        rampBytes = state.bytes;
        state.rampAt = now;
      }

      const instant = bpsToMbps(state.bytes - lastBytes, now - lastAt);
      lastBytes = state.bytes;
      lastAt = now;

      if (instant > 0) {
        smoothed = smoothed === null ? instant : smoothed * 0.55 + instant * 0.45;
        this.h.onSpeed?.(smoothed, phase);
      }
      this.emitProgress(phase, elapsed / durationMs);
    }, CONFIG.tickMs);

    try {
      await Promise.all(
        Array.from({ length: streams }, () => worker(state, isOver))
      );
    } finally {
      clearInterval(ticker);
    }

    const endAt = performance.now();

    // Отдача: берём только куски, которые начались после разгона и дошли
    // до сервера целиком, и делим на время от первой отправки до последнего
    // подтверждения. Иначе XHR-прогресс завышает скорость на размер буфера.
    if (useSettled && state.settled > 0 && state.settleFrom !== null && state.settleTo - state.settleFrom > 300) {
      return bpsToMbps(state.settled, state.settleTo - state.settleFrom);
    }

    // Загрузка (и медленные каналы, где ни один кусок не успел уйти целиком):
    // считаем по «устоявшемуся» участку — с момента разгона и до конца.
    if (rampAt !== null && endAt - rampAt > 500) {
      return bpsToMbps(state.bytes - rampBytes, endAt - rampAt);
    }
    // тест оборвался слишком рано — берём всё, что успели
    return bpsToMbps(state.bytes, endAt - startedAt);
  }

  measureDownload() {
    const worker = async (state, isOver) => {
      while (!isOver()) {
        const url = `${ENDPOINT}/__down?bytes=${CONFIG.downloadChunkBytes}&d=${uniq()}`;
        let res;
        try {
          res = await fetch(url, { cache: 'no-store', signal: this.signal });
        } catch (err) {
          if (this.signal.aborted) return;
          throw new Error('network');
        }

        if (!res.body) {
          // Совсем старые браузеры: без потокового чтения, но замер возможен.
          const buf = await res.arrayBuffer();
          state.bytes += buf.byteLength;
          continue;
        }

        const reader = res.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            state.bytes += value.length;
            if (isOver()) {
              reader.cancel().catch(() => {});
              return;
            }
          }
        } catch (err) {
          if (this.signal.aborted) return;
          throw new Error('network');
        }
      }
    };

    return this.runStreams({
      phase: 'download',
      durationMs: CONFIG.downloadDurationMs,
      streams: CONFIG.downloadStreams,
      worker,
    });
  }

  measureUpload() {
    // Один и тот же случайный кусок переиспользуем во всех потоках:
    // генерировать его заново дороже, чем отправить.
    const payload = randomBlob(CONFIG.uploadChunkBytes);

    const worker = async (state, isOver) => {
      while (!isOver()) {
        await this.uploadOnce(payload, state, isOver);
      }
    };

    return this.runStreams({
      phase: 'upload',
      durationMs: CONFIG.uploadDurationMs,
      streams: CONFIG.uploadStreams,
      worker,
      useSettled: true,
    });
  }

  /**
   * fetch не умеет сообщать прогресс отправки, поэтому здесь XHR:
   * xhr.upload.onprogress даёт нам байты по мере ухода в сокет.
   */
  uploadOnce(blob, state, isOver) {
    return new Promise((resolve, reject) => {
      if (this.signal.aborted) return resolve();

      const xhr = new XMLHttpRequest();
      const chunkStartedAt = performance.now();
      let sent = 0;
      let stopped = false;

      /** Кусок дошёл целиком — только такие идут в итоговую цифру. */
      const settle = () => {
        if (state.rampAt === null || chunkStartedAt < state.rampAt) return;
        state.settled += blob.size;
        state.settleFrom = state.settleFrom === null ? chunkStartedAt : Math.min(state.settleFrom, chunkStartedAt);
        state.settleTo = Math.max(state.settleTo, performance.now());
      };

      const cleanup = () => {
        this.signal.removeEventListener('abort', onAbort);
        clearInterval(watchdog);
      };
      const onAbort = () => {
        stopped = true;
        xhr.abort();
      };

      // Ждать конца 8-мегабайтной отправки после истечения времени незачем.
      const watchdog = setInterval(() => {
        if (isOver() && !stopped) {
          stopped = true;
          xhr.abort();
        }
      }, CONFIG.tickMs);

      this.signal.addEventListener('abort', onAbort, { once: true });

      xhr.open('POST', `${ENDPOINT}/__up?u=${uniq()}`, true);
      xhr.upload.onprogress = (e) => {
        state.bytes += e.loaded - sent;
        sent = e.loaded;
      };
      xhr.onload = () => { settle(); cleanup(); resolve(); };
      xhr.onabort = () => { cleanup(); resolve(); };
      xhr.onerror = () => {
        cleanup();
        if (this.signal.aborted) resolve();
        else reject(new Error('network'));
      };
      xhr.send(blob);
    });
  }
}
