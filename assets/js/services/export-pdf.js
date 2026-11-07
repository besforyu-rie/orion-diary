// Ekspor diary ke PDF lewat dialog cetak browser (pilih "Simpan sebagai PDF").
// Tanpa server dan tanpa pustaka tambahan, jadi tetap jalan di GitHub Pages.
import { listEntries } from './storage.js';
import { getPrefs, setPrefs } from './prefs.js';
import { CONFIG } from '../config.js';
import { locale, t } from '../i18n.js';
import { el, formatDate } from '../utils.js';

const monthKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/** Bulan-bulan yang punya entri, terbaru dulu: [{ value: '2026-11', label: 'November 2026' }]. */
export async function exportMonths() {
  const keys = [...new Set((await listEntries()).map((e) => monthKey(e.createdAt)))].sort().reverse();
  return keys.map((value) => {
    const [y, m] = value.split('-').map(Number);
    return { value, label: new Date(y, m - 1, 1).toLocaleDateString(locale(), { month: 'long', year: 'numeric' }) };
  });
}

function buildDocument(items) {
  const name = getPrefs().diaryName || t('exp.docTitle', { name: getPrefs().displayName || t('name.fallback') });
  return el('div', { id: 'print-root' },
    el('header', { className: 'print-head' },
      el('h1', {}, name),
      el('p', {}, t('exp.docRange', { date: formatDate(Date.now()), n: items.length }))),
    ...items.map((e) => el('article', { className: 'print-entry' },
      el('p', { className: 'print-meta' },
        `${formatDate(e.createdAt)} · ${e.mood} · ${e.privacy === 'shared' ? t('exp.sharedTag') : t('exp.private')}`),
      el('h2', {}, e.title),
      el('div', { className: `print-body${e.handwritten ? ' hand' : ''}` }, e.text),
      (e.tags ?? []).length ? el('p', { className: 'print-tags' }, e.tags.map((tag) => `#${tag}`).join('  ')) : '')));
}

/**
 * @param {{month: string, scope: 'all'|'private'|'shared'}} options
 * @returns {Promise<number>} jumlah entri yang diekspor (0 = tidak ada yang cocok)
 */
export async function exportDiary({ month, scope }) {
  const items = (await listEntries())
    .filter((e) => (month === 'all' || monthKey(e.createdAt) === month)
      && (scope === 'all' || (e.privacy === 'shared' ? 'shared' : 'private') === scope))
    .sort((a, b) => a.createdAt - b.createdAt);
  if (!items.length) return 0;

  const doc = buildDocument(items);
  document.body.append(doc);
  document.body.classList.add('printing');
  const cleanup = () => { doc.remove(); document.body.classList.remove('printing'); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  try { window.print(); } finally { setTimeout(cleanup, 1500); } // jaga-jaga bila afterprint tidak terpanggil
  setPrefs({ lastExport: { at: Date.now(), n: items.length } });
  return items.length;
}
