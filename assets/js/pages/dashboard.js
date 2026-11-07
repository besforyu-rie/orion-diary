import { CONFIG } from '../config.js';
import { listEntries } from '../services/storage.js';
import { el, daysUntil, formatDate } from '../utils.js';

/** Streak = jumlah hari berturut-turut (sampai hari ini) yang ada entrinya. */
function streak(entries) {
  const days = new Set(entries.map((e) => new Date(e.createdAt).toDateString()));
  let count = 0;
  const d = new Date();
  while (days.has(d.toDateString())) { count++; d.setDate(d.getDate() - 1); }
  return count;
}

const stat = (value, label) =>
  el('div', { className: 'card' }, el('div', { className: 'stat' }, String(value)), label);

export async function renderDashboard(root) {
  const entries = await listEntries();
  const latest = entries.slice(0, 3).map((e) =>
    el('div', { className: 'card entry' },
      el('h3', {}, `${e.mood} ${e.title}`), el('time', {}, formatDate(e.createdAt))));

  root.append(el('section', { className: 'page' },
    el('h1', {}, `Hey ${CONFIG.userName}, welcome to your orbit ✦`),
    el('div', { className: 'grid' },
      stat(streak(entries), 'hari berturut-turut'),
      stat(entries.length, 'kenangan tertulis'),
      stat(daysUntil(CONFIG.birthday), 'hari menuju ulang tahun')),
    el('h2', { style: 'margin-top:28px' }, 'Tulisan terbaru'),
    ...(latest.length ? latest : [el('p', {}, 'Belum ada tulisan. Mulai dari menu Diary.')])));
}
