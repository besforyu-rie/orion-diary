// Dialog di halaman album: "Edit album", halaman teks bebas, dan layar "Susun" (Arrange).
// Semuanya hanya membangun UI; penyimpanan lewat services/albums.js.
import {
  updateAlbum, addNote, updateNote, removeNote, addPhoto, removePhoto, updatePhoto, reorderPhotos, MAX_NOTE_CHARS, MAX_PHOTOS,
} from '../services/albums.js';
import { MAX_UPLOAD_MB } from '../services/image.js';
import { showToast } from './toast.js';
import { t } from '../i18n.js';
import { el, icon } from '../utils.js';

let uid = 0;
const nextId = (prefix) => `${prefix}-${++uid}`;

function field(label, control, hint) {
  const id = nextId('f');
  control.id = id;
  return el('div', { className: 'field' },
    el('label', { htmlFor: id }, label), control,
    ...(hint ? [el('small', { className: 'field-hint' }, hint)] : []));
}

function makeDialog(className, label, ...children) {
  const dialog = el('dialog', { className: `sheet ${className}`.trim() }, ...children);
  dialog.setAttribute('aria-label', label);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

const splitParagraphs = (text) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/* ---------- Edit album: judul, label sampul, tanggal, untuk/dari, dedikasi, surat, penutup ---------- */

export function openEditAlbum(album, { onSaved }) {
  const title = el('input', { required: true, maxLength: 80, autocomplete: 'off', value: album.title });
  const label = el('input', { maxLength: 40, autocomplete: 'off', value: album.cover.label, placeholder: t('edit.labelPh') });
  const date = el('input', { maxLength: 40, autocomplete: 'off', value: album.date, placeholder: t('edit.datePh') });
  const to = el('input', { maxLength: 40, autocomplete: 'off', value: album.to });
  const from = el('input', { maxLength: 40, autocomplete: 'off', value: album.from });
  const dedication = el('textarea', { rows: 3, maxLength: 240, value: album.dedication });
  const letter = el('textarea', { rows: 8, value: album.letter.join('\n\n') });
  const ending = el('input', { maxLength: 100, autocomplete: 'off', value: album.ending });
  const error = el('p', { role: 'alert', className: 'form-error' });
  const submit = el('button', { type: 'submit' }, t('edit.save'));
  const cancel = el('button', { type: 'button', className: 'ghost' }, t('common.cancel'));

  const form = el('form', {},
    el('h2', {}, t('album.edit')),
    el('p', { className: 'hint-text' }, t('edit.hint')),
    field(t('edit.title'), title),
    el('div', { className: 'field-row' }, field(t('edit.label'), label), field(t('edit.date'), date)),
    el('div', { className: 'field-row' }, field(t('edit.to'), to), field(t('edit.from'), from)),
    field(t('edit.dedication'), dedication),
    field(t('edit.letter'), letter, t('edit.letterHint')),
    field(t('edit.ending'), ending),
    error,
    el('div', { className: 'actions' }, cancel, submit));
  const dialog = makeDialog('wide-sheet', t('album.edit'), form);
  cancel.onclick = () => dialog.close();
  title.focus();

  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = title.value.trim();
    if (!name) { error.textContent = t('albums.titleRequired'); title.focus(); return; }
    submit.disabled = true; error.textContent = '';
    try {
      await updateAlbum(album.id, {
        title: name,
        coverLabel: label.value.trim(),
        date: date.value.trim(),
        to: to.value.trim(),
        from: from.value.trim(),
        dedication: dedication.value.trim(),
        letter: splitParagraphs(letter.value),
        ending: ending.value.trim(),
      });
      dialog.close();
      showToast(t('edit.saved'));
      await onSaved();
    } catch (err) {
      console.error(err);
      error.textContent = `${t('edit.fail')} (${err?.code ?? err?.message ?? '?'})`;
      submit.disabled = false;
    }
  };
}

/* ---------- halaman teks bebas ---------- */

/** note = null untuk halaman baru. */
export function openNoteDialog(album, note, { onSaved }) {
  const text = el('textarea', { rows: 8, maxLength: MAX_NOTE_CHARS, value: note?.text ?? '' });
  const counter = el('small', { className: 'field-hint', 'aria-live': 'polite' });
  const drawCount = () => { counter.textContent = `${text.value.length} / ${MAX_NOTE_CHARS}`; };
  text.addEventListener('input', drawCount);
  drawCount();
  const error = el('p', { role: 'alert', className: 'form-error' });
  const submit = el('button', { type: 'submit' }, note ? t('edit.save') : t('note.add'));
  const cancel = el('button', { type: 'button', className: 'ghost' }, t('common.cancel'));
  const remove = note ? el('button', { type: 'button', className: 'ghost danger' }, icon('trash'), t('note.delete')) : null;

  const textField = field(t('note.text'), text, t('note.hint', { max: MAX_NOTE_CHARS }));
  const form = el('form', {},
    el('h2', {}, note ? t('note.edit') : t('note.new')),
    textField, counter, error,
    el('div', { className: 'actions' }, ...(remove ? [remove] : []), cancel, submit));
  const dialog = makeDialog('', note ? t('note.edit') : t('note.new'), form);
  cancel.onclick = () => dialog.close();
  text.focus();

  const run = async (job, doneMsg) => {
    submit.disabled = true; if (remove) remove.disabled = true; error.textContent = '';
    try {
      await job();
      dialog.close();
      showToast(doneMsg);
      await onSaved(note ? undefined : Infinity);
    } catch (err) {
      console.error(err);
      error.textContent = `${t('edit.fail')} (${err?.code ?? err?.message ?? '?'})`;
      submit.disabled = false; if (remove) remove.disabled = false;
    }
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const value = text.value.trim();
    if (!value) { error.textContent = t('note.empty'); text.focus(); return; }
    run(() => (note ? updateNote(album.id, note.id, value) : addNote(album.id, value)), t(note ? 'note.saved' : 'note.added'));
  };
  if (remove) {
    remove.onclick = () => { if (confirm(t('note.confirmDelete'))) run(() => removeNote(album.id, note.id), t('note.deleted')); };
  }
}

/* ---------- Susun (Arrange): urutan foto + halaman teks, unggah foto baru, keterangan, hapus ---------- */

const pad = (n) => String(n).padStart(2, '0');
const IMAGE_NAME = /\.(jpe?g|png|webp|hei[cf])$/i; // HEIC kadang tidak punya tipe MIME
const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');

export function openArrange(album, { onSaved }) {
  const items = album.items.map((i) => ({ ...i, orig: { caption: i.caption, alt: i.alt, text: i.text } }));
  let originalOrder = items.map((i) => i.id);
  const removed = new Set();
  let selected = items[0]?.id ?? null;
  let dragId = null;      // kartu yang sedang diseret mouse
  let dropAt = null;      // { id, after }: di mana penanda sisip berada
  let lift = null;        // { id, from }: kartu yang "diangkat" lewat keyboard
  let pendingSeq = 0;
  let lastBatch = 0;      // jumlah foto pada pilihan terakhir (untuk panel "Just added")
  let saving = false;
  let flip = false;

  const grid = el('ol', { className: 'arr-grid' });
  const panel = el('aside', { className: 'arr-panel', 'aria-live': 'polite' });
  const added = el('aside', { className: 'arr-panel arr-added', hidden: true });
  const status = el('p', { className: 'form-error', role: 'alert' });
  const live = el('p', { className: 'sr-only', role: 'status', 'aria-live': 'assertive' });
  const save = el('button', { type: 'button' }, t('arr.save'));
  const cancel = el('button', { type: 'button', className: 'ghost' }, t('common.cancel'));
  const badgeText = el('span');
  const badge = el('span', { className: 'pill', hidden: true }, el('i'), badgeText);
  const kbHint = el('p', { className: 'arr-kb-hint', id: nextId('kb') }, t('arr.kbHint'));
  const emptyMsg = el('p', { className: 'hint-text' }, t('arr.empty'));

  const announce = (msg) => { flip = !flip; live.textContent = msg + (flip ? '\u00a0' : ''); };
  const pendingItems = () => items.filter((i) => i.pending);

  const labelOf = (item) => {
    const same = items.filter((i) => i.kind === item.kind);
    return t(item.kind === 'note' ? 'arr.note' : 'arr.photo', { n: pad(same.indexOf(item) + 1) });
  };

  const columns = () => {
    const cards = [...grid.children];
    if (!cards.length) return 1;
    return Math.max(1, cards.filter((c) => c.offsetTop === cards[0].offsetTop).length);
  };

  function focusCard(id, what) {
    const li = grid.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!li) return;
    const target = what === 'pick'
      ? li.querySelector('.arr-pick')
      : (li.querySelector(`.arr-btn[data-act="${what}"]:not(:disabled)`) ?? li.querySelector('.arr-btn:not(:disabled)'));
    target?.focus();
  }

  function move(from, to, focus) {
    if (to < 0 || to >= items.length || from === to) return false;
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it);
    drawGrid();
    drawPanel();
    if (focus) focusCard(it.id, focus);
    announce(t('arr.moved', { label: labelOf(it), n: to + 1, total: items.length }));
    return true;
  }

  function cancelLift() {
    if (!lift) return;
    const { id, from } = lift;
    lift = null;
    const idx = items.findIndex((i) => i.id === id);
    if (idx !== from && idx >= 0) { const [it] = items.splice(idx, 1); items.splice(from, 0, it); }
    drawGrid(); drawPanel();
    focusCard(id, 'pick');
    announce(t('arr.cancelled', { label: labelOf(items[from]), n: from + 1 }));
  }

  function discard(item) {
    if (item.src?.startsWith('blob:')) URL.revokeObjectURL(item.src);
    const label = labelOf(item);
    items.splice(items.indexOf(item), 1);
    if (selected === item.id) selected = items[0]?.id ?? null;
    drawAll();
    announce(t('arr.discarded', { label }));
  }

  const clearMarks = () => grid.querySelectorAll('.ins-before,.ins-after').forEach((n) => n.classList.remove('ins-before', 'ins-after'));

  function card(item, index) {
    const gone = removed.has(item.id);
    const thumb = el('span', { className: `arr-thumb ${item.kind === 'note' ? 'note' : ''}` });
    if (item.kind === 'photo') {
      thumb.style.backgroundImage = `url("${item.src}")`;
      thumb.style.backgroundPosition = item.focus ?? '50% 50%';
    } else {
      thumb.textContent = item.text;
    }
    const suffix = gone ? t('arr.removed') : (item.pending ? t('arr.new') : '');
    const pick = el('button', { type: 'button', className: 'arr-pick' },
      el('span', { className: 'arr-top' }, el('span', { className: 'arr-label' }, suffix ? `${labelOf(item)} · ${suffix}` : labelOf(item)), icon('grip')),
      thumb);
    pick.setAttribute('aria-pressed', String(item.id === selected));
    pick.setAttribute('aria-describedby', kbHint.id);
    pick.onclick = () => { if (lift) return; selected = item.id; drawGrid(); drawPanel(); focusCard(item.id, 'pick'); };

    // Keyboard: Spasi angkat/taruh, panah pindah, Esc batal
    pick.addEventListener('keydown', (e) => {
      if (gone) return;
      if (e.key === ' ') {
        e.preventDefault();
        const idx = items.indexOf(item);
        if (lift?.id === item.id) {
          lift = null; drawGrid(); focusCard(item.id, 'pick');
          announce(t('arr.dropped', { label: labelOf(item), n: idx + 1, total: items.length }));
        } else {
          lift = { id: item.id, from: idx }; selected = item.id; drawGrid(); drawPanel(); focusCard(item.id, 'pick');
          announce(t('arr.pickedUp', { label: labelOf(item), n: idx + 1, total: items.length }));
        }
        return;
      }
      if (!lift || lift.id !== item.id) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelLift(); return; }
      const cols = columns();
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
      if (step === undefined) return;
      e.preventDefault();
      const idx = items.indexOf(item);
      move(idx, Math.min(items.length - 1, Math.max(0, idx + step)), 'pick');
    });
    pick.addEventListener('keyup', (e) => { if (e.key === ' ') e.preventDefault(); }); // cegah "klik" Spasi di Firefox

    const mk = (name, act, label, onClick, disabled) => {
      const b = el('button', { type: 'button', className: 'ghost arr-btn', disabled }, icon(name));
      b.dataset.act = act;
      b.setAttribute('aria-label', `${label}: ${labelOf(item)}`);
      b.onclick = onClick;
      return b;
    };
    const buttons = gone
      ? [el('button', { type: 'button', className: 'ghost arr-restore' }, t('arr.restore'))]
      : [mk('arrow-left', 'left', t('arr.left'), () => move(index, index - 1, 'left'), index === 0),
        mk('arrow-right', 'right', t('arr.right'), () => move(index, index + 1, 'right'), index === items.length - 1),
        mk('x', 'remove', t('arr.remove'), () => {
          if (item.pending) { discard(item); return; }
          removed.add(item.id); drawGrid(); drawPanel();
        })];
    if (gone) buttons[0].onclick = () => { removed.delete(item.id); drawGrid(); drawPanel(); };

    const cls = ['arr-card', gone && 'gone', item.pending && 'new', lift?.id === item.id && 'lifted'].filter(Boolean).join(' ');
    const li = el('li', { className: cls, draggable: !gone }, pick, el('div', { className: 'arr-btns' }, ...buttons));
    li.dataset.id = item.id;

    // Seret dengan mouse + penanda sisip (garis di sisi kiri/kanan kartu tujuan)
    li.addEventListener('dragstart', (e) => {
      dragId = item.id; lift = null;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.id);
      setTimeout(() => li.classList.add('dragging'), 0); // supaya gambar seretan tidak ikut redup
    });
    li.addEventListener('dragend', () => { dragId = null; dropAt = null; li.classList.remove('dragging'); clearMarks(); });
    li.addEventListener('dragover', (e) => {
      if (!dragId || dragId === item.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = li.getBoundingClientRect();
      const after = e.clientX > r.left + r.width / 2;
      if (dropAt?.id === item.id && dropAt.after === after) return;
      clearMarks();
      li.classList.add(after ? 'ins-after' : 'ins-before');
      dropAt = { id: item.id, after };
    });
    li.addEventListener('dragleave', (e) => { if (!li.contains(e.relatedTarget)) li.classList.remove('ins-before', 'ins-after'); });
    li.addEventListener('drop', (e) => {
      if (!dragId || !dropAt) return;
      e.preventDefault();
      const from = items.findIndex((i) => i.id === dragId);
      let to = items.findIndex((i) => i.id === dropAt.id) + (dropAt.after ? 1 : 0);
      if (from < to) to--;
      clearMarks();
      move(from, to);
    });
    return li;
  }

  function drawGrid() {
    grid.replaceChildren(...items.map(card));
    grid.hidden = !items.length;
    emptyMsg.hidden = items.length > 0;
    save.disabled = saving || !items.length;
  }

  function drawBadge() {
    const n = pendingItems().length;
    badge.hidden = !n;
    badgeText.textContent = n ? t(n === 1 ? 'arr.ready1' : 'arr.readyN', { n }) : '';
  }

  function drawAdded() {
    const n = pendingItems().length;
    added.hidden = !n;
    if (!n) return;
    added.replaceChildren(
      el('h3', {}, t('arr.justAdded')),
      el('p', {}, t(n === 1 ? 'arr.readyText1' : 'arr.readyTextN', { n })),
      el('span', { className: 'ok-chip' }, icon('check'), t('arr.readyDone')));
  }

  function drawPanel() {
    const item = items.find((i) => i.id === selected);
    const title = el('h3', {}, t('arr.selected'));
    if (!item) { panel.replaceChildren(title, el('p', { className: 'hint-text' }, t(items.length ? 'arr.pick' : 'arr.empty'))); return; }
    const gone = removed.has(item.id);
    const pos = items.indexOf(item) + 1;
    const head = el('p', { className: 'arr-slot' }, `${labelOf(item)} · ${t('arr.slot', { n: pos })}`);
    if (item.kind === 'note') {
      const text = el('textarea', { rows: 8, maxLength: MAX_NOTE_CHARS, value: item.text, disabled: gone });
      text.addEventListener('input', () => { item.text = text.value; grid.querySelector(`[data-id="${CSS.escape(item.id)}"] .arr-thumb`).textContent = text.value; });
      panel.replaceChildren(title, head, field(t('arr.noteText'), text));
      return;
    }
    const preview = el('div', { className: 'arr-preview' });
    preview.style.backgroundImage = `url("${item.src}")`;
    const caption = el('input', { maxLength: 120, autocomplete: 'off', value: item.caption, disabled: gone, placeholder: t('book.caption') });
    const alt = el('input', { maxLength: 200, autocomplete: 'off', value: item.alt, disabled: gone });
    caption.addEventListener('input', () => { item.caption = caption.value; });
    alt.addEventListener('input', () => { item.alt = alt.value; });
    panel.replaceChildren(title, preview, head, field(t('arr.caption'), caption), field(t('arr.alt'), alt));
  }

  const drawAll = () => { drawGrid(); drawPanel(); drawBadge(); drawAdded(); };

  /* ---------- kotak unggah: pilih atau seret foto dari komputer, ditahan dulu sampai "Simpan susunan" ---------- */

  const input = el('input', { type: 'file', multiple: true, hidden: true, accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif' });
  const choose = el('button', { type: 'button', className: 'ghost' }, t('arr.choose'));
  choose.onclick = () => input.click();
  const zone = el('div', { className: 'arr-drop' }, icon('upload-cloud'),
    el('div', { className: 'arr-drop-text' },
      el('strong', {}, t('arr.dropTitle')),
      el('small', {}, t('arr.dropHint', { mb: MAX_UPLOAD_MB, max: MAX_PHOTOS }))),
    choose, input);
  const errorBox = el('div', { className: 'arr-upload-error', role: 'alert', hidden: true });

  function showUploadErrors(errs) {
    if (!errs.length) { errorBox.hidden = true; errorBox.replaceChildren(); return; }
    const again = el('button', { type: 'button', className: 'ghost' }, t('arr.chooseAnother'));
    again.onclick = () => input.click();
    const shown = errs.slice(0, 3);
    errorBox.replaceChildren(
      el('h3', {}, t(errs.some((e) => e.big) ? 'arr.tooBigTitle' : 'arr.uploadIssue')),
      ...shown.map((e) => el('p', {}, el('strong', {}, e.name), ` · ${e.msg}`)),
      ...(errs.length > shown.length ? [el('p', {}, t('arr.more', { n: errs.length - shown.length }))] : []),
      again);
    errorBox.hidden = false;
  }

  async function stageFiles(files) {
    if (saving || !files.length) return;
    const errs = [];
    const ok = [];
    let room = MAX_PHOTOS - items.filter((i) => i.kind === 'photo' && !removed.has(i.id)).length;
    for (const f of files) {
      if (!(f.type.startsWith('image/') || IMAGE_NAME.test(f.name))) { errs.push({ name: f.name, msg: t('book.notImage') }); continue; }
      if (f.size > MAX_UPLOAD_MB * 1048576) { errs.push({ name: f.name, big: true, msg: t('arr.tooBig', { size: (f.size / 1048576).toFixed(1), max: MAX_UPLOAD_MB }) }); continue; }
      if (room <= 0) { errs.push({ name: f.name, msg: t('img.album-full', { max: MAX_PHOTOS }) }); continue; }
      try { (await createImageBitmap(f)).close?.(); } // cek sekarang, bukan baru saat disimpan
      catch { errs.push({ name: f.name, msg: t(/hei[cf]/i.test(`${f.type} ${f.name}`) ? 'img.heic' : 'img.unreadable') }); continue; }
      room--; ok.push(f);
    }
    showUploadErrors(errs);
    if (!ok.length) return;
    const fresh = ok.map((file) => ({
      id: `new-${++pendingSeq}`, kind: 'photo', pending: true, file,
      src: URL.createObjectURL(file), caption: '', alt: '', focus: '50% 50%', orig: { caption: '', alt: '' },
    }));
    items.push(...fresh);
    lastBatch = fresh.length;
    selected = fresh[0].id;
    drawAll();
    announce(t('arr.staged', { n: fresh.length }));
  }

  input.onchange = () => { const files = [...input.files]; input.value = ''; stageFiles(files); };

  /* ---------- rakitan dialog ---------- */

  const main = el('div', { className: 'arr-main' }, zone, errorBox,
    emptyMsg, grid, kbHint);
  const body = el('div', { className: 'arr-body' }, main, el('div', { className: 'arr-side' }, panel, added));
  const dialog = makeDialog('arrange', t('arr.title'),
    el('h2', {}, t('arr.title')),
    el('div', { className: 'arr-meta' }, badge),
    el('p', { className: 'hint-text' }, t('arr.hint')),
    body, live, status,
    el('div', { className: 'actions' }, cancel, save));
  drawAll();
  cancel.onclick = () => dialog.close();

  // Esc: saat kartu sedang diangkat, hanya batalkan angkatan (jangan tutup dialog); saat menyimpan, jangan tutup.
  dialog.addEventListener('cancel', (e) => {
    if (saving) { e.preventDefault(); return; }
    if (lift) { e.preventDefault(); cancelLift(); }
  });
  dialog.addEventListener('close', () => items.forEach((i) => { if (i.src?.startsWith('blob:')) URL.revokeObjectURL(i.src); }));
  grid.addEventListener('pointerdown', () => { lift = null; });

  // File yang dijatuhkan di mana saja di dalam dialog ikut masuk; seretan kartu tidak terpengaruh.
  dialog.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); zone.classList.add('over'); } });
  dialog.addEventListener('dragleave', (e) => { if (!dialog.contains(e.relatedTarget)) zone.classList.remove('over'); });
  dialog.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    zone.classList.remove('over');
    stageFiles([...e.dataTransfer.files]);
  });

  save.onclick = async () => {
    status.textContent = '';
    const blank = items.find((i) => i.kind === 'note' && !removed.has(i.id) && !i.text.trim());
    if (blank) { selected = blank.id; drawGrid(); drawPanel(); status.textContent = t('note.empty'); return; }
    if (removed.size && !confirm(t('arr.confirm', { n: removed.size }))) return;
    saving = true; lift = null;
    save.disabled = true; cancel.disabled = true; choose.disabled = true;
    try {
      // 1. hapus yang ditandai (dikeluarkan dari daftar begitu berhasil, supaya percobaan ulang tidak menghapus dua kali)
      for (const item of items.filter((i) => removed.has(i.id))) {
        await (item.kind === 'note' ? removeNote(album.id, item.id) : removePhoto(album.id, item.id));
        items.splice(items.indexOf(item), 1);
        removed.delete(item.id);
        originalOrder = originalOrder.filter((id) => id !== item.id);
      }
      // 2. unggah foto baru satu per satu; id sementara diganti id asli begitu berhasil
      const fresh = pendingItems();
      for (const [i, item] of fresh.entries()) {
        status.textContent = t('arr.uploading', { i: i + 1, n: fresh.length });
        const { id } = await addPhoto(album.id, item.file);
        if (selected === item.id) selected = id;
        item.id = id; item.pending = false; item.file = null;
      }
      status.textContent = '';
      // 3. keterangan dan teks yang berubah
      for (const item of items) {
        if (item.kind === 'note') {
          if (item.text !== item.orig.text) await updateNote(album.id, item.id, item.text.trim());
        } else if (item.caption !== item.orig.caption || item.alt !== item.orig.alt) {
          await updatePhoto(album.id, item.id, { caption: item.caption.trim(), alt: item.alt.trim() });
        }
      }
      // 4. urutan akhir
      const ids = items.map((i) => i.id);
      if (ids.length !== originalOrder.length || ids.some((id, i) => id !== originalOrder[i])) await reorderPhotos(album.id, ids);
      dialog.close();
      showToast(t('arr.saved'));
      await onSaved();
    } catch (err) {
      console.error(err);
      status.textContent = `${t('arr.fail')} (${err?.code ?? err?.message ?? '?'})`;
      saving = false;
      cancel.disabled = false; choose.disabled = false;
      drawAll();
    }
  };
}
