// Rak album: judul, filter, kartu buku, banner, dan dialog "Album baru".
import { loadAlbums, createAlbum } from '../services/albums.js';
import { loadSpaceAlbumBrief, memberLabel } from '../services/spaces.js';
import { getUser } from '../services/auth.js';
import { pageCount, STAR_SVG } from '../components/album-book.js';
import { locale, t } from '../i18n.js';
import { el, icon } from '../utils.js';

const count = (n, one, many) => t(n === 1 ? one : many, { n });
const updated = (ts) => (ts ? t('albums.updated', { date: new Date(ts).toLocaleDateString(locale(), { day: 'numeric', month: 'short' }) }) : '');

function albumCard(album) {
  const cover = el('div', { className: 'shelf-book' });
  cover.innerHTML = `<div class="face cover"><div class="in"><small></small>${STAR_SVG}<h2 style="margin-top:34cqh"></h2><em></em></div></div>`;
  cover.querySelector('small').textContent = album.cover.label;
  cover.querySelector('h2').textContent = album.cover.title;
  cover.querySelector('em').textContent = album.date ? `${album.date} ✦` : '✦';

  const href = album.href ?? `#/album?id=${encodeURIComponent(album.id)}`;
  const meta = [
    count(album.photoCount, 'albums.photo1', 'albums.photoN'),
    t('albums.pages', { n: pageCount(album) }),
    updated(album.updatedAt),
  ].filter(Boolean).join(' · ');
  const stage = el('a', { className: 'shelf-stage', href, tabIndex: -1 }, cover);
  stage.setAttribute('aria-hidden', 'true'); // tautan yang bisa difokus cukup tombol "Buka album"

  return el('article', { className: 'shelf-card' },
    stage,
    el('span', { className: 'badge' }, el('i'), album.shared ? (album.sharedLabel || t('albums.shared')) : t('albums.onlyMe')),
    el('h3', {}, album.cover.title),
    el('p', { className: 'meta' }, meta),
    el('a', { className: 'btn ghost', href }, icon('book-open'), t('albums.open')));
}

function openNewAlbum() {
  const title = el('input', { id: 'na-title', required: true, maxLength: 80, autocomplete: 'off', placeholder: t('albums.fTitlePh') });
  const to = el('input', { id: 'na-to', maxLength: 40, autocomplete: 'off' });
  const error = el('p', { role: 'alert', className: 'form-error' });
  const submit = el('button', { type: 'submit' }, t('albums.create'));
  const cancel = el('button', { type: 'button', className: 'ghost' }, t('common.cancel'));
  const form = el('form', {},
    el('h2', {}, t('albums.new')),
    el('p', { className: 'hint-text' }, t('albums.dlgHint')),
    el('div', { className: 'field' }, el('label', { htmlFor: 'na-title' }, t('albums.fTitle')), title),
    el('div', { className: 'field' }, el('label', { htmlFor: 'na-to' }, t('albums.fTo')), to),
    error,
    el('div', { className: 'actions' }, cancel, submit));
  const dialog = el('dialog', { className: 'sheet' }, form);
  dialog.setAttribute('aria-label', t('albums.new'));
  cancel.onclick = () => dialog.close();
  dialog.addEventListener('close', () => dialog.remove());

  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = title.value.trim();
    if (!name) { error.textContent = t('albums.titleRequired'); title.focus(); return; }
    submit.disabled = true; error.textContent = '';
    const now = new Date();
    const date = `${now.toLocaleDateString(locale(), { month: 'long' })}, ${now.getFullYear()}`;
    try {
      const id = await createAlbum({ title: name, to: to.value.trim(), coverLabel: date.toUpperCase(), date });
      dialog.close();
      location.hash = `#/album?id=${encodeURIComponent(id)}`;
    } catch (err) {
      console.error(err);
      error.textContent = t('albums.createFail');
      submit.disabled = false;
    }
  };
  document.body.append(dialog);
  dialog.showModal();
  title.focus();
}

/** Album bersama di Bestie Space, dalam bentuk kartu rak (tanpa memuat fotonya). Tanpa ruang atau album: null. */
async function loadSharedShelfCard() {
  if (!getUser()) return null;
  try {
    const brief = await loadSpaceAlbumBrief();
    if (!brief?.album) return null;
    const { space, album } = brief;
    const n = album.photoCount ?? 0;
    return {
      id: album.id, href: `#/album?space=${encodeURIComponent(space.id)}`,
      shared: true, sharedLabel: space.name, editable: false,
      cover: { label: memberLabel(space.members), title: album.title }, date: album.date ?? '',
      photoCount: n, kinds: Array(n).fill('photo'), letter: [], updatedAt: album.updatedAt ?? album.createdAt ?? null,
    };
  } catch (err) { console.warn('Album bersama belum bisa dimuat di rak:', err?.code ?? err); return null; }
}

export async function renderAlbums(root) {
  const mine = await loadAlbums();
  // Membuat album butuh akun, dan hanya kalau album tersimpan di Firestore (bukan cadangan dari file JSON).
  const canCreate = Boolean(getUser()) && mine.every((a) => a.editable);
  const sharedCard = await loadSharedShelfCard();
  const albums = sharedCard ? [...mine, sharedCard] : mine;
  const photos = albums.reduce((sum, a) => sum + a.photoCount, 0);
  const state = { filter: 'all' };

  const grid = el('div', { className: 'shelf-grid' });
  const filters = [
    ['all', 'albums.fAll', albums.length],
    ['mine', 'albums.fMine', albums.filter((a) => !a.shared).length],
    ['shared', 'albums.fShared', albums.filter((a) => a.shared).length],
  ].map(([key, label, n]) => {
    const b = el('button', { type: 'button', className: 'ghost' }, `${t(label)} · ${n}`);
    b.dataset.filter = key;
    b.onclick = () => { state.filter = key; draw(); };
    return b;
  });

  function draw() {
    filters.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)));
    const list = albums.filter((a) => state.filter === 'all' || (state.filter === 'shared') === a.shared);
    grid.replaceChildren(...(list.length ? list.map(albumCard) : [el('p', { className: 'meta' }, t('albums.emptyFilter'))]));
  }
  draw();

  const newButton = el('button', { type: 'button' }, icon('plus'), t('albums.new'));
  newButton.onclick = openNewAlbum;
  const createButton = el('button', { type: 'button' }, t('albums.create'));
  createButton.onclick = openNewAlbum;

  root.append(el('section', { className: 'page wide' },
    el('div', { className: 'shelf-head' },
      el('div', {},
        el('h1', {}, t('albums.title')),
        el('p', {}, [count(albums.length, 'albums.album1', 'albums.albumN'), count(photos, 'albums.photo1', 'albums.photoN'), t('albums.magic')].join(' · '))),
      ...(canCreate ? [newButton] : [])),
    el('div', { className: 'shelf-filters', role: 'group', ariaLabel: t('albums.filters') }, ...filters),
    grid,
    ...(canCreate ? [el('aside', { className: 'shelf-banner' },
      icon('sparkles', 'banner-icon'),
      el('div', {}, el('h2', {}, t('albums.bannerTitle')), el('p', {}, t('albums.bannerText'))),
      createButton)] : [])));

  return () => document.querySelector('dialog.sheet')?.close();
}
