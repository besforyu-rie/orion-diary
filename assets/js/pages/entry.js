import { getEntry, getEntryPhotos, removeEntry } from '../services/storage.js';
import { sanitize } from '../services/rich.js';
import { showToast } from '../components/toast.js';
import { t } from '../i18n.js';
import { el, formatDate } from '../utils.js';

export async function renderEntry(root, params) {
  const entry = await getEntry(params.get('id') ?? '');
  if (!entry) {
    root.append(el('section', { className: 'page empty' }, el('h1', {}, t('entry.notFound')), el('a', { className: 'btn', href: '#/diary' }, t('entry.toDiary'))));
    return;
  }
  // Entri berformat (dari editor baru): tampilkan HTML yang sudah dibersihkan, lengkap dengan foto di dalamnya.
  let rich = null;
  if (entry.html) {
    const photos = entry.photoCount > 0 ? await getEntryPhotos(entry.id).catch(() => ({})) : {};
    rich = el('div', { className: 'rich' });
    rich.innerHTML = sanitize(entry.html, { photos });
  }
  const del = el('button', { className: 'ghost' }, t('common.delete'));
  del.onclick = async () => {
    if (!confirm(t('entry.confirm'))) return;
    await removeEntry(entry.id);
    showToast(t('entry.deleted'));
    location.hash = '#/diary';
  };
  root.append(el('section', { className: 'page' },
    el('div', { className: 'row' }, el('a', { href: '#/diary' }, t('entry.back')), el('span', { className: 'chip' }, entry.privacy === 'shared' ? t('write.shared') : t('write.private'))),
    el('article', { className: 'paper', style: 'margin-top:16px' },
      el('time', {}, `${formatDate(entry.createdAt)} ${entry.mood}`),
      el('h1', {}, entry.title),
      rich ?? el('div', { className: 'body', style: entry.handwritten ? '' : 'font:400 18px/1.7 var(--font-body)' }, entry.text),
      el('p', {}, ...(entry.tags ?? []).map((tag) => el('span', { className: 'chip', style: 'background:#6c3fd122' }, `#${tag}`)))),
    el('p', {}, del)));
}
