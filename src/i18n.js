/** Простая локализация: словарь + перевод узлов с data-i18n. */

const DICT = {
  ru: {
    'tab.test': 'Тест',
    'tab.history': 'Дневник',
    'tab.compare': 'Сравнение',
    'tab.stats': 'Статистика',

    'unit.mbps': 'Мбит/с',
    'unit.ms': 'мс',

    'phase.idle': 'Готов к тесту',
    'phase.meta': 'Определяем соединение',
    'phase.latency': 'Пинг',
    'phase.download': 'Загрузка',
    'phase.upload': 'Отдача',
    'phase.done': 'Готово',
    'phase.stopped': 'Остановлено',
    'phase.error': 'Ошибка',

    'btn.start': 'Начать тест',
    'btn.stop': 'Остановить',
    'btn.again': 'Повторить тест',
    'ph.label': 'Метка замера: Wi-Fi кухня, LTE, кабель…',
    'opt.autosave': 'Записывать в дневник',

    'm.download': 'Загрузка',
    'm.upload': 'Отдача',
    'm.ping': 'Пинг',
    'm.jitter': 'Джиттер',

    'live.title': 'Ход теста',
    'conn.title': 'Соединение',
    'conn.isp': 'Провайдер',
    'conn.ip': 'IP-адрес',
    'conn.server': 'Сервер',
    'conn.net': 'Сеть устройства',

    'ph.search': 'Поиск по метке или провайдеру',
    'sort.new': 'Сначала новые',
    'sort.old': 'Сначала старые',
    'sort.downdesc': 'Загрузка: больше',
    'sort.downasc': 'Загрузка: меньше',
    'sort.pingasc': 'Пинг: меньше',

    'btn.exportJson': 'Экспорт JSON',
    'btn.exportCsv': 'Экспорт CSV',
    'btn.import': 'Импорт',
    'btn.clear': 'Очистить',
    'btn.delete': 'Удалить замер',
    'btn.compareSel': 'Сравнить выбранные',

    'th.date': 'Дата',
    'th.label': 'Метка',
    'th.down': '↓ Мбит/с',
    'th.up': '↑ Мбит/с',
    'th.ping': 'Пинг',
    'th.jitter': 'Джиттер',
    'th.isp': 'Провайдер',

    'empty.history': 'Дневник пуст — запустите первый тест.',
    'empty.stats': 'Нужен хотя бы один сохранённый замер.',
    'empty.compare': 'Выберите два замера, чтобы увидеть разницу.',
    'empty.groups': 'Добавьте метки замерам — и здесь появится сравнение по местам и сетям.',

    'cmp.title': 'Сравнение двух замеров',
    'cmp.a': 'Замер A',
    'cmp.b': 'Замер B',
    'cmp.groups': 'Средние значения по меткам',
    'cmp.verdict.better': 'Замер B быстрее',
    'cmp.verdict.worse': 'Замер B медленнее',
    'cmp.verdict.same': 'Разницы почти нет',

    'range.7': '7 дней',
    'range.30': '30 дней',
    'range.all': 'Всё время',

    'stats.byHour': 'Средняя скорость по времени суток',
    'stats.avg': 'Среднее',
    'stats.median': 'Медиана',
    'stats.best': 'Лучший',
    'stats.worst': 'Худший',
    'stats.count': 'Замеров',
    'stats.last': 'Последний',
    'stats.days': 'за период',

    'page.h1': 'PingDiary — тест скорости интернета с дневником замеров',
    'about.title': 'Зачем вести дневник замеров',
    'about.rooms.h': 'Сравнить комнаты и сети',
    'about.rooms.p': 'Замерьте у роутера, на кухне и в дальней комнате, поставьте каждому замеру метку — и увидите, где Wi-Fi проседает и стоит ли переставлять роутер. Кабель, Wi-Fi и мобильный интернет сравниваются так же.',
    'about.evening.h': 'Поймать вечерние просадки',
    'about.evening.p': 'График по времени суток покажет, правда ли скорость падает вечером, или дело в конкретном сайте. Один замер об этом сказать не может — нужна история.',
    'about.plan.h': 'Проверить, соответствует ли скорость тарифу',
    'about.plan.p': 'Регулярные замеры показывают, получаете ли вы то, за что платите. Среднее за неделю — куда более честный аргумент в разговоре с провайдером, чем один скриншот.',
    'about.export.h': 'Выгрузить историю замеров',
    'about.export.p': 'Экспорт в CSV или JSON: пригодится и для обращения к провайдеру, и чтобы перенести дневник на другое устройство. Данные никуда не отправляются — они лежат в вашем браузере.',

    'noLabel': 'без метки',
    'measurements': 'замеров',
    'footer.note': 'Замеры хранятся только в вашем браузере. Тестовый трафик идёт через speed.cloudflare.com.',

    'toast.saved': 'Замер записан в дневник',
    'toast.deleted': 'Замер удалён',
    'toast.cleared': 'Дневник очищен',
    'toast.imported': 'Импортировано замеров: {n}',
    'toast.importError': 'Не удалось прочитать файл',
    'toast.netError': 'Сеть недоступна или тест заблокирован (проверьте VPN, блокировщик, прокси)',
    'toast.stopped': 'Тест остановлен',
    'confirm.clear': 'Удалить все замеры из дневника? Отменить это будет нельзя.',
  },

  en: {
    'tab.test': 'Test',
    'tab.history': 'Diary',
    'tab.compare': 'Compare',
    'tab.stats': 'Stats',

    'unit.mbps': 'Mbps',
    'unit.ms': 'ms',

    'phase.idle': 'Ready to test',
    'phase.meta': 'Detecting connection',
    'phase.latency': 'Latency',
    'phase.download': 'Download',
    'phase.upload': 'Upload',
    'phase.done': 'Done',
    'phase.stopped': 'Stopped',
    'phase.error': 'Error',

    'btn.start': 'Start test',
    'btn.stop': 'Stop',
    'btn.again': 'Run again',
    'ph.label': 'Label: kitchen Wi-Fi, LTE, cable…',
    'opt.autosave': 'Save to diary',

    'm.download': 'Download',
    'm.upload': 'Upload',
    'm.ping': 'Latency',
    'm.jitter': 'Jitter',

    'live.title': 'Live test',
    'conn.title': 'Connection',
    'conn.isp': 'ISP',
    'conn.ip': 'IP address',
    'conn.server': 'Server',
    'conn.net': 'Device network',

    'ph.search': 'Search by label or ISP',
    'sort.new': 'Newest first',
    'sort.old': 'Oldest first',
    'sort.downdesc': 'Download: high to low',
    'sort.downasc': 'Download: low to high',
    'sort.pingasc': 'Latency: low to high',

    'btn.exportJson': 'Export JSON',
    'btn.exportCsv': 'Export CSV',
    'btn.import': 'Import',
    'btn.clear': 'Clear',
    'btn.delete': 'Delete measurement',
    'btn.compareSel': 'Compare selected',

    'th.date': 'Date',
    'th.label': 'Label',
    'th.down': '↓ Mbps',
    'th.up': '↑ Mbps',
    'th.ping': 'Ping',
    'th.jitter': 'Jitter',
    'th.isp': 'ISP',

    'empty.history': 'The diary is empty — run your first test.',
    'empty.stats': 'At least one saved measurement is needed.',
    'empty.compare': 'Pick two measurements to see the difference.',
    'empty.groups': 'Label your measurements and this table will compare places and networks.',

    'cmp.title': 'Compare two measurements',
    'cmp.a': 'Measurement A',
    'cmp.b': 'Measurement B',
    'cmp.groups': 'Averages by label',
    'cmp.verdict.better': 'B is faster',
    'cmp.verdict.worse': 'B is slower',
    'cmp.verdict.same': 'Almost no difference',

    'range.7': '7 days',
    'range.30': '30 days',
    'range.all': 'All time',

    'stats.byHour': 'Average speed by hour of day',
    'stats.avg': 'Average',
    'stats.median': 'Median',
    'stats.best': 'Best',
    'stats.worst': 'Worst',
    'stats.count': 'Measurements',
    'stats.last': 'Latest',
    'stats.days': 'in range',

    'page.h1': 'PingDiary — internet speed test with a diary of measurements',
    'about.title': 'Why keep a diary of measurements',
    'about.rooms.h': 'Compare rooms and networks',
    'about.rooms.p': 'Measure next to the router, in the kitchen and in the far room, label every run — and you will see where Wi-Fi drops and whether the router is worth moving. Cable, Wi-Fi and mobile data compare the same way.',
    'about.evening.h': 'Catch the evening slowdowns',
    'about.evening.p': 'The by-hour chart shows whether the speed really drops in the evening or the problem is one particular site. A single run cannot tell you that — you need history.',
    'about.plan.h': 'Check the speed against your plan',
    'about.plan.p': 'Regular measurements show whether you get what you pay for. A weekly average is a far more honest argument in a conversation with your ISP than a single screenshot.',
    'about.export.h': 'Export the history',
    'about.export.p': 'Export to CSV or JSON: useful both for an ISP complaint and for moving the diary to another device. Nothing is uploaded anywhere — the data lives in your browser.',

    'noLabel': 'no label',
    'measurements': 'measurements',
    'footer.note': 'Measurements stay in your browser only. Test traffic goes through speed.cloudflare.com.',

    'toast.saved': 'Saved to diary',
    'toast.deleted': 'Measurement deleted',
    'toast.cleared': 'Diary cleared',
    'toast.imported': 'Imported: {n}',
    'toast.importError': 'Could not read the file',
    'toast.netError': 'Network unavailable or the test is blocked (check VPN, ad blocker, proxy)',
    'toast.stopped': 'Test stopped',
    'confirm.clear': 'Delete every measurement from the diary? This cannot be undone.',
  },
};

let lang = 'ru';

export function getLang() {
  return lang;
}

export function setLang(next) {
  lang = DICT[next] ? next : 'ru';
  document.documentElement.lang = lang;
  applyTranslations();
}

export function locale() {
  return lang === 'ru' ? 'ru-RU' : 'en-US';
}

export function t(key, vars) {
  let s = DICT[lang][key] ?? DICT.ru[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Переводит всё, что помечено data-i18n / data-i18n-ph, внутри root. */
export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPh);
  });
}
