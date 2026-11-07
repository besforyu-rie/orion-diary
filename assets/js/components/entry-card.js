// Potongan yang dipakai bersama oleh daftar Diary, Dashboard, dan halaman baca: nama mood, label privasi, kartu entri.
import { getEntryCover } from '../services/storage.js';
import { locale, t } from '../i18n.js';
import { el, icon } from '../utils.js';

export const MOODS = {
  '😊': { name: 'Happy', ic: 'sun' }, '🌙': { name: 'Cozy', ic: 'moon' }, '🥰': { name: 'Grateful', ic: 'heart' },
  '🥺': { name: 'Low', ic: 'cloud' }, '🤩': { name: 'Excited', ic: 'sparkles' },
};
export const moodInfo = (emoji) => MOODS[emoji] ?? null;
export const moodLabel = (emoji) => (MOODS[emoji] ? t(`mood.${MOODS[emoji].name}`) : emoji ?? '');

export const isShared = (e) => e.privacy === 'shared' || !!e.sharedTo;
export const privacyLabel = (e) => (e.sharedTo ? e.sharedTo.name : isShared(e) ? t('nav.bestie') : t('entry.badgeMe'));

export const snippet = (s = '', max = 130) => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max).trimEnd()}…` : one;
};

/** Jam hanya ditampilkan kalau entrinya ditulis pada jam itu (entri bertanggal mundur disimpan pukul 12:00 tepat). */
const hasRealTime = (d) => !(d.getHours() === 12 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0);

/** "6 Nov · 22:14 · Cozy · Only me" */
export function metaLine(e, { withTime = true } = {}) {
  const d = new Date(e.createdAt);
  const date = d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  const time = withTime && hasRealTime(d) ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  return [date, time, moodLabel(e.mood), privacyLabel(e)].filter(Boolean).join(' · ');
}

const lazy = 'IntersectionObserver' in window ? new IntersectionObserver((items) => {
  for (const it of items) {
    if (!it.isIntersecting) continue;
    lazy.unobserve(it.target);
    it.target.load?.();
  }
}, { rootMargin: '200px' }) : null;

/** Kotak gambar kecil: memuat foto pertama entri hanya saat mendekati layar. Tanpa foto: null. */
export function thumb(entry, className = 'ec-thumb') {
  if (!(entry.photoCount > 0)) return null;
  const box = el('div', { className: `${className} loading`, 'aria-hidden': 'true' });
  box.load = async () => {
    const src = await getEntryCover(entry);
    if (!src) { box.remove(); return; }
    box.replaceChildren(Object.assign(new Image(), { src, alt: '', decoding: 'async' }));
    box.classList.remove('loading');
  };
  if (lazy) lazy.observe(box); else box.load();
  return box;
}

/** Kartu entri untuk daftar: meta, judul, cuplikan, label, gambar kecil. */
export function entryCard(e, { max = 130 } = {}) {
  const t0 = thumb(e);
  const mi = moodInfo(e.mood);
  return el('a', { className: `card entry-card${t0 ? ' has-thumb' : ''}`, href: `#/entry?id=${e.id}` },
    el('div', { className: 'ec-body' },
      el('p', { className: 'ec-meta' }, ...(mi ? [icon(mi.ic)] : []), metaLine(e)),
      el('h3', {}, e.title),
      el('p', { className: 'ec-text' }, snippet(e.text, max)),
      ...((e.tags ?? []).length ? [el('p', { className: 'ec-tags' }, ...e.tags.map((tag) => el('span', {}, `#${tag}`)))] : [])),
    ...(t0 ? [t0] : []));
}

/** Jumlah hari berturut-turut (sampai hari ini) yang ada entrinya. */
export function streak(entries) {
  const days = new Set(entries.map((e) => new Date(e.createdAt).toDateString()));
  let count = 0;
  for (const d = new Date(); days.has(d.toDateString()); d.setDate(d.getDate() - 1)) count++;
  return count;
}
