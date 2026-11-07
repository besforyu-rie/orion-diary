import { getPrefs, getPrefsScope } from '../services/prefs.js';
import { CONFIG } from '../config.js';
import { listEntries } from '../services/storage.js';
import { t } from '../i18n.js';
import { el, daysUntil, nextBirthday, formatDate, icon } from '../utils.js';

const MOODS = [['sun', 'Radiant'], ['sparkles', 'Happy'], ['moon', 'Cozy'], ['cloud', 'Low'], ['umbrella', 'Heavy']];
const PROMPT_KEYS = ['dash.p1', 'dash.p2', 'dash.p3'];
const moodKey = () => `orion-diary:mood:${getPrefsScope()}`; // mood disimpan per akun, tidak tercampur saat ganti akun
const moodLabel = (name) => t(`mood.${name}`);

/** Streak = jumlah hari berturut-turut (sampai hari ini) yang ada entrinya. */
function streak(entries) {
  const days = new Set(entries.map((e) => new Date(e.createdAt).toDateString()));
  let count = 0;
  for (const d = new Date(); days.has(d.toDateString()); d.setDate(d.getDate() - 1)) count++;
  return count;
}

const stat = (value, label) => el('div', { className: 'card' }, el('div', { className: 'stat' }, String(value)), label);
const pad = (n) => String(n).padStart(2, '0');

function moodCard() {
  let saved = localStorage.getItem(moodKey());
  if (saved === 'Misty') saved = 'Heavy'; // nama lama
  const note = el('p', { className: 'hand', style: 'font-size:22px;color:var(--pink)' });
  const say = () => { note.textContent = saved ? t('mood.feels', { mood: moodLabel(saved).toLowerCase() }) : t('mood.pick'); };
  const buttons = MOODS.map(([ic, name]) => {
    const b = el('button', { className: 'ghost', ariaLabel: moodLabel(name), title: moodLabel(name) }, icon(ic));
    b.setAttribute('aria-pressed', String(saved === name));
    b.onclick = () => {
      saved = name; localStorage.setItem(moodKey(), name);
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      say();
    };
    return b;
  });
  say();
  return el('div', { className: 'card row' },
    el('div', {}, el('h2', {}, t('dash.weather')), el('div', { className: 'moods' }, ...buttons), note),
    el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }));
}

function countdownCard() {
  const clock = el('div', { className: 'stat' });
  const label = el('p', {});
  function tick() {
    if (daysUntil(CONFIG.birthday) === 0) { clock.textContent = '🎂'; label.textContent = t('dash.birthdayToday', { name: getPrefs().displayName || t('name.fallback') }); return; }
    const s = Math.max(0, Math.floor((nextBirthday(CONFIG.birthday) - new Date()) / 1000));
    clock.textContent = `${Math.floor(s / 86400)}${t('dash.dayUnit')} ${pad(Math.floor(s % 86400 / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`;
    label.textContent = t('dash.untilBirthday');
  }
  tick();
  const timer = setInterval(tick, 1000);
  return { node: el('div', { className: 'card' }, el('h3', {}, t('dash.tonight')), clock, label), stop: () => clearInterval(timer) };
}

export async function renderDashboard(root) {
  const entries = await listEntries();
  const countdown = countdownCard();
  const prompt = t(PROMPT_KEYS[new Date().getDate() % PROMPT_KEYS.length]);
  const name = getPrefs().displayName || t('name.fallback');
  const orbit = entries.slice(0, 3).map((e) =>
    el('a', { className: 'card entry', href: `#/entry?id=${e.id}` },
      el('h3', {}, `${e.mood} ${e.title}`), el('time', {}, formatDate(e.createdAt)),
      el('p', {}, e.text.length > 90 ? `${e.text.slice(0, 90)}…` : e.text)));

  root.append(el('section', { className: 'page' },
    el('div', { className: 'row' },
      el('div', {}, el('h1', {}, t('dash.hey', { name })), el('p', {}, formatDate(Date.now()))),
      el('a', { className: 'btn', href: '#/write' }, t('dash.write'))),
    el('div', { className: 'two-col dash-top' }, moodCard(), countdown.node),
    el('div', { className: 'grid', style: 'margin-top:16px' },
      stat(streak(entries), t('dash.streak')), stat(entries.length, t('dash.memories')),
      stat(new Set(entries.flatMap((e) => e.tags ?? [])).size, t('dash.tags'))),
    el('div', { className: 'row', style: 'margin-top:28px' }, el('h2', {}, t('dash.pages')), el('a', { href: '#/diary' }, t('dash.seeAll'))),
    el('div', { className: 'grid' }, ...(orbit.length ? orbit : [el('p', {}, t('dash.empty'))])),
    el('div', { className: 'card row', style: 'margin-top:20px' },
      el('div', {}, el('small', {}, t('dash.thought')), el('p', { className: 'hand', style: 'font-size:24px;margin:4px 0' }, prompt)),
      el('a', { className: 'btn', href: `#/write?prompt=${encodeURIComponent(prompt)}` }, t('dash.startThis')))));
  return countdown.stop;
}
