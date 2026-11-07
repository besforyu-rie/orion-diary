// Halaman satu album: kepala halaman (judul, meta, tombol aksi) + buku 3D.
import { mountAlbum, pageCount } from '../components/album-book.js';
import { loadAlbum, replacePhotoImage, updatePhoto, addPhoto, removePhoto, MAX_PHOTOS } from '../services/albums.js';
import {
  loadSharedAlbum, addSharedPhoto, updateSharedPhoto, removeSharedPhoto, renameSharedAlbum, logAlbumActivity,
} from '../services/spaces.js';
import { getUser } from '../services/auth.js';
import { getPrefs } from '../services/prefs.js';
import { field, makeDialog } from '../components/dialog.js';
import { openEditAlbum, openNoteDialog, openArrange } from '../components/album-dialogs.js';
import { MAX_UPLOAD_MB, imageErrorMessage } from '../services/image.js';
import { showToast } from '../components/toast.js';
import { t } from '../i18n.js';
import { el, icon } from '../utils.js';

const IMAGE_NAME = /\.(jpe?g|png|webp|hei[cf])$/i; // HEIC kadang tidak punya tipe MIME
const count = (n, one, many) => t(n === 1 ? one : many, { n });

const myName = () => getPrefs().displayName || (getUser().email ?? '').split('@')[0] || t('name.fallback');

// Satu halaman untuk dua jenis album: album pribadi (#/album?id=…) dan album bersama di Bestie Space (#/album?space=…).
export async function renderAlbum(root, params) {
  const spaceId = params.get('space');
  const shared = Boolean(spaceId);
  const fetchAlbum = (id) => (shared ? loadSharedAlbum(spaceId) : loadAlbum(id));
  let album = await fetchAlbum(params.get('id'));
  if (!album) { location.hash = shared ? '#/bestie?tab=album' : '#/albums'; return; }

  const crumb = el('p', { className: 'album-meta' });
  const drawMeta = () => {
    const parts = [
      album.date,
      count(album.photoCount, 'albums.photo1', 'albums.photoN'),
      t('albums.pages', { n: pageCount(album) }),
      album.shared ? (album.sharedLabel || t('albums.shared')) : t('albums.onlyMe'),
    ].filter(Boolean);
    crumb.replaceChildren(shared ? el('a', { href: '#/bestie?tab=album' }, t('nav.bestie')) : el('a', { href: '#/albums' }, t('nav.albums')), ` / ${parts.join(' · ')}`);
  };
  drawMeta();

  const heading = el('h1', {}, album.cover.title);
  const pillText = el('span');
  const pill = el('span', { className: 'pill' }, el('i'), pillText);
  const host = el('div', { className: 'book-host' });
  let cleanup = null;
  let currentPage = 0;

  function mount(startPage = 0) {
    cleanup?.();
    host.replaceChildren();
    cleanup = mountAlbum(host, album, {
      startPage,
      onState: ({ page }) => { currentPage = page; pillText.textContent = t(page === 0 ? 'album.pillClosed' : 'album.pillOpen'); },
      // Album tersimpan (Firestore): ganti foto dan ubah keterangan permanen. Album dari file JSON: hanya baca/sementara.
      ...(album.editable ? {
        onReplacePhoto: (pid, file) => replacePhotoImage(album.id, pid, file),
        onSaveCaption: (pid, caption) => updatePhoto(album.id, pid, { caption }),
        onDeletePhoto: deletePhoto,
        onEditNote: (nid) => openNoteDialog(album, album.items.find((i) => i.id === nid), { onSaved: reload }),
      } : {}),
      // Album bersama: keterangan dan hapus hanya untuk foto yang kutambahkan sendiri; ganti gambar tidak ada.
      ...(shared ? {
        canChange: false,
        canEdit: (pid) => album.items.find((i) => i.id === pid)?.addedBy === getUser()?.uid,
        onSaveCaption: (pid, caption) => updateSharedPhoto(spaceId, pid, { caption }),
        onDeletePhoto: deletePhoto,
      } : {}),
    });
  }
  mount();

  /** Muat ulang album dari Firestore lalu pasang bukunya lagi (startPage: undefined = tetap di halaman sekarang). */
  async function reload(startPage = currentPage) {
    album = await fetchAlbum(album.id);
    heading.textContent = album.cover.title;
    drawMeta();
    syncButtons();
    mount(startPage);
  }
  async function deletePhoto(pid) {
    try { await (shared ? removeSharedPhoto(spaceId, pid) : removePhoto(album.id, pid)); showToast(t('book.deleted')); await reload(); }
    catch (err) { console.error(err); showToast(t('book.saveFail'), 'error'); }
  }

  let syncButtons = () => {};
  const actions = el('div', { className: 'album-actions' });
  if (album.editable || shared) {
    const status = el('p', { className: 'album-status', role: 'status' });
    const input = el('input', { type: 'file', multiple: true, hidden: true, accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif' });
    const addBtn = el('button', { type: 'button', className: album.photoCount ? 'ghost' : '' }, icon('image-plus'), t('album.addPhotos'));
    addBtn.onclick = () => input.click();

    input.onchange = async () => {
      const files = [...input.files];
      input.value = ''; // supaya file yang sama bisa dipilih lagi
      const ok = [];
      for (const f of files) {
        if (!(f.type.startsWith('image/') || IMAGE_NAME.test(f.name))) { showToast(t('book.notImage'), 'error'); continue; }
        if (f.size > MAX_UPLOAD_MB * 1048576) {
          showToast(t('book.tooBig', { name: f.name, size: (f.size / 1048576).toFixed(1), max: MAX_UPLOAD_MB }), 'error');
          continue;
        }
        ok.push(f);
      }
      const room = Math.max(0, MAX_PHOTOS - album.photoCount);
      if (ok.length > room) { showToast(t('img.album-full', { max: MAX_PHOTOS }), 'error'); ok.length = room; }
      if (!ok.length) return;

      addBtn.disabled = true;
      let added = 0, failed = 0, lastErr = null;
      for (const [i, file] of ok.entries()) {
        status.textContent = t('album.adding', { i: i + 1, n: ok.length });
        try { await (shared ? addSharedPhoto(spaceId, file, myName()) : addPhoto(album.id, file)); added++; } catch (err) { console.error(err); failed++; lastErr = err; }
      }
      status.textContent = '';
      if (failed) showToast(`${t('album.addFailed', { n: failed })} ${imageErrorMessage(lastErr)}`, 'error');
      if (added) {
        // Anggota lain melihatnya di lonceng sebagai satu sinyal ("Alya menambahkan 4 kenangan"); gagal mencatat tidak apa-apa.
        if (shared) logAlbumActivity(spaceId, { authorName: myName(), count: added }).catch((err) => console.warn('Aktivitas album belum tercatat:', err?.code ?? err));
        try {
          album = await fetchAlbum(album.id);
          drawMeta();
          syncButtons();
          mount(Infinity); // buka di halaman paling belakang, tempat foto baru
          showToast(t(added === 1 ? 'album.added1' : 'album.added', { n: added }));
        } catch (err) { console.error(err); showToast(t('book.saveFail'), 'error'); }
      }
      addBtn.disabled = false;
    };
    const noteBtn = el('button', { type: 'button', className: 'ghost' }, icon('notebook-pen'), t('album.addNote'));
    noteBtn.onclick = () => openNoteDialog(album, null, { onSaved: reload });
    const arrangeBtn = el('button', { type: 'button', className: 'ghost' }, icon('layout-grid'), t('album.arrange'));
    arrangeBtn.onclick = () => openArrange(album, { onSaved: reload });
    const editBtn = el('button', { type: 'button', className: 'ghost' }, icon('pencil'), t('album.edit'));
    editBtn.onclick = () => openEditAlbum(album, { onSaved: reload });
    syncButtons = () => { addBtn.className = album.photoCount ? 'ghost' : ''; arrangeBtn.hidden = !album.items.length; };
    syncButtons();
    if (shared) {
      actions.append(status, input);
      if (album.canRename) {
        const renameBtn = el('button', { type: 'button', className: 'ghost' }, icon('pencil'), t('album.rename'));
        renameBtn.onclick = () => openRename();
        actions.append(renameBtn);
      }
      actions.append(addBtn);
    } else actions.append(status, input, editBtn, arrangeBtn, noteBtn, addBtn);
  }

  function openRename() {
    const title = el('input', { maxLength: 80, autocomplete: 'off', required: true, value: album.title });
    const error = el('p', { role: 'alert', className: 'form-error' });
    const save = el('button', { type: 'submit' }, t('edit.save'));
    const cancel = el('button', { type: 'button', className: 'ghost' }, t('common.cancel'));
    const form = el('form', { noValidate: true }, el('h2', {}, t('album.renameTitle')),
      field(t('sp.alTitleLabel'), title), error, el('div', { className: 'actions' }, cancel, save));
    const dialog = makeDialog('', t('album.renameTitle'), form);
    cancel.onclick = () => dialog.close();
    title.focus(); title.select();
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!title.value.trim()) { error.textContent = t('sp.alTitleReq'); title.focus(); return; }
      save.disabled = true; error.textContent = '';
      try { await renameSharedAlbum(spaceId, title.value.trim()); dialog.close(); showToast(t('album.renamed')); await reload(); }
      catch (err) { console.error(err); error.textContent = t('book.saveFail'); save.disabled = false; }
    };
  }

  root.append(el('section', { className: 'page wide' },
    el('div', { className: 'album-head' }, heading, crumb),
    el('div', { className: 'album-bar' }, pill, actions),
    host));
  return () => cleanup?.();
}
