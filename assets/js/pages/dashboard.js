// Dashboard (B1), mengikuti frame Figma "Hey Naya, welcome to your orbit":
// cek perasaan harian, hitung mundur, tiga kartu angka, halaman dari orbitmu, dan satu pertanyaan kecil untuk malam ini.
import { getPrefs, setPrefs, getPrefsScope } from '../services/prefs.js';
import { CONFIG } from '../config.js';
import { listEntries } from '../services/storage.js';
import { loadAlbums } from '../services/albums.js';
import { thumb, metaLine, snippet, streak } from '../components/entry-card.js';
import { locale, t } from '../i18n.js';
import { el, daysUntil, nextBirthday, icon } from '../utils.js';

const MOODS = [['sun', 'Radiant'], ['sparkles', 'Happy'], ['moon', 'Cozy'], ['cloud', 'Low'], ['umbrella', 'Heavy']];
const PROMPT_KEYS = ['dash.p1', 'dash.p2', 'dash.p3'];
const moodKey = () => `orion-diary:mood:${getPrefsScope()}`; // per akun, tidak tercampur saat ganti akun
const moodLabel = (name) => t(`mood.${name}`);
const pad = (n) => String(n).padStart(2, '0');
const dayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Perasaan hari ini: { m, d }. Perasaan kemarin tidak ikut terbawa. Format lama (teks biasa) dianggap belum memilih. */
function readMood() {
  try {
    const v = JSON.parse(localStorage.getItem(moodKey()) ?? 'null');
    return v && typeof v === 'object' && v.d === dayStr() && MOODS.some(([, n]) => n === v.m) ? v.m : null;
  } catch { return null; }
}

function moodCard() {
  let saved = readMood();
  const note = el('p', { className: 'mood-note hand', role: 'status' });
  const say = () => {
    note.replaceChildren(saved
      ? `${t(`dash.feel.${saved}`, { day: new Date().toLocaleDateString(locale(), { weekday: 'long' }) })} `
      : t('mood.pick'));
    if (saved) note.append(el('span', { className: 'saved' }, icon('check'), t('dash.saved')));
  };
  const tiles = MOODS.map(([ic, name]) => {
    const b = el('button', { type: 'button', className: 'mood-tile' }, icon(ic), el('span', {}, moodLabel(name)));
    b.setAttribute('aria-pressed', String(saved === name));
    b.onclick = () => {
      saved = name;
      try { localStorage.setItem(moodKey(), JSON.stringify({ m: name, d: dayStr() })); } catch { /* mode privat: abaikan */ }
      tiles.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      say();
    };
    return b;
  });
  say();
  return el('section', { className: 'card mood-card' },
    el('div', { className: 'mood-top' },
      el('div', {}, el('p', { className: 'eyebrow' }, t('dash.checkin')), el('h2', {}, t('dash.weather')), el('p', { className: 'muted-p' }, t('dash.noRight'))),
      el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' })),
    el('div', { className: 'mood-tiles', role: 'group', 'aria-label': t('dash.weather') }, ...tiles), note);
}

function countdownCard() {
  const days = el('span', { className: 'cd-days' });
  const clock = el('span', { className: 'cd-clock' });
  const label = el('p', { className: 'cd-label' });
  const when = nextBirthday(CONFIG.birthday).toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
  const name = () => getPrefs().displayName || t('name.fallback');
  const remind = el('button', { type: 'button', className: 'ghost' });
  const drawRemind = () => {
    const on = getPrefs().reminders.includes('birthday');
    remind.replaceChildren(icon('bell'), t(on ? 'dash.remindOn' : 'dash.remindOff'));
    remind.setAttribute('aria-pressed', String(on));
  };
  remind.onclick = () => {
    const list = getPrefs().reminders;
    setPrefs({ reminders: list.includes('birthday') ? list.filter((x) => x !== 'birthday') : [...list, 'birthday'] });
    drawRemind();
  };
  drawRemind();
  function tick() {
    if (daysUntil(CONFIG.birthday) === 0) { days.textContent = ''; clock.textContent = '✦'; label.textContent = t('dash.birthdayToday', { name: name() }); return; }
    const s = Math.max(0, Math.floor((nextBirthday(CONFIG.birthday) - new Date()) / 1000));
    days.textContent = `${Math.floor(s / 86400)}${t('dash.dayUnit')}`;
    clock.textContent = `${pad(Math.floor(s % 86400 / 3600))} : ${pad(Math.floor(s % 3600 / 60))} : ${pad(s % 60)}`;
    label.textContent = `${t('dash.untilBirthday')} · ${when}`;
  }
  tick();
  const timer = setInterval(tick, 1000);
  return {
    node: el('section', { className: 'card count-card' },
      el('div', { className: 'count-head' }, icon('moon'), el('h2', {}, t('dash.tonight'))),
      el('div', { className: 'cd-row', role: 'timer', 'aria-label': t('dash.untilBirthday') }, days, clock), label, el('div', {}, remind)),
    stop: () => clearInterval(timer),
  };
}

const statCard = (ic, value, title, sub, foot) => el('section', { className: 'card stat-card' },
  el('div', { className: 'stat-top' }, icon(ic), el('div', {}, el('p', { className: 'stat-title' }, el('span', { className: 'stat' }, String(value)), ` ${title}`), el('p', { className: 'stat-sub' }, sub))),
  el('p', { className: 'stat-foot' }, foot));

function orbitCard(e) {
  const media = el('div', { className: 'oc-media' }, icon('book-heart'));
  const t0 = thumb(e, 'oc-thumb');
  if (t0) media.append(t0);
  return el('a', { className: 'card orbit-card', href: `#/entry?id=${e.id}` }, media,
    el('p', { className: 'ec-meta caps' }, metaLine(e, { withTime: false })), el('h3', {}, e.title), el('p', { className: 'ec-text' }, snippet(e.text, 90)));
}

export async function renderDashboard(root) {
  const [entries, albums] = await Promise.all([listEntries(), loadAlbums().catch(() => [])]);
  const countdown = countdownCard();
  const prompt = t(PROMPT_KEYS[new Date().getDate() % PROMPT_KEYS.length]);
  const name = getPrefs().displayName || t('name.fallback');
  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = entries.filter((e) => e.createdAt >= weekAgo).length;
  const photos = entries.reduce((n, e) => n + (e.photoCount ?? 0), 0) + albums.reduce((n, a) => n + (a.photoCount ?? 0), 0);
  const orbit = entries.slice(0, 3).map(orbitCard);

  root.append(el('section', { className: 'page wide dash-page' },
    el('div', { className: 'dy-top' },
      el('div', {}, el('h1', {}, t('dash.hey', { name })),
        el('p', { className: 'ed-sub' }, `${new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${t('dash.sub')}`)),
      el('a', { className: 'btn', href: '#/write' }, icon('plus'), t('dash.writeBtn'))),
    el('div', { className: 'dash-top' }, moodCard(), countdown.node),
    el('div', { className: 'stat-grid' },
      statCard('flame', streak(entries), t('dash.gentle'), t('dash.gentleSub'), t('dash.gentleFoot')),
      statCard('book-heart', entries.length, t('dash.mem'), t('dash.memSub'), t('dash.memFoot', { n: thisWeek })),
      statCard('images', photos, t('dash.moments'), t('dash.momentsSub'), t(albums.length === 1 ? 'dash.momentsFoot1' : 'dash.momentsFoot', { n: albums.length }))),
    el('div', { className: 'dash-row' }, el('h2', {}, t('dash.pages')), el('a', { href: '#/diary' }, `${t('dash.seeAll')} →`)),
    orbit.length ? el('div', { className: 'orbit-grid' }, ...orbit)
      : el('div', { className: 'card state-card center', role: 'status' }, el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
        el('h2', {}, t('st.freshTitle')), el('p', {}, t('dash.empty')),
        el('div', { className: 'ctrl' }, el('a', { className: 'btn', href: '#/write' }, icon('plus'), t('st.firstWrite')))),
    el('section', { className: 'card thought-card' },
      icon('sparkles'),
      el('div', {}, el('small', {}, t('dash.thought')), el('p', { className: 'hand' }, prompt)),
      el('a', { className: 'btn ghost', href: `#/write?prompt=${encodeURIComponent(prompt)}` }, t('dash.startThis')))));
  return countdown.stop;
}
