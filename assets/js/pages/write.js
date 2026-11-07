// Editor entri (B3), mengikuti frame Figma "Diary editor":
// bilah alat teks kaya, perasaan hari ini, label, foto di dalam tulisan, siapa yang boleh lihat, draf otomatis.
import { addEntry, newEntryId, getEntry, getEntryPhotos, updateEntry } from '../services/storage.js';
import { getPrefs, getPrefsScope } from '../services/prefs.js';
import { showToast } from '../components/toast.js';
import { confettiBurst } from '../components/confetti.js';
import { makeDialog } from '../components/dialog.js';
import { sanitize, plainText, countWords, readMinutes, newPhotoId, trimTail } from '../services/rich.js';
import { fileToDataUrl, imageErrorMessage, MAX_UPLOAD_MB } from '../services/image.js';
import { locale, t } from '../i18n.js';
import { el, esc, icon } from '../utils.js';

const MOODS = [['sun', 'Happy', '😊'], ['moon', 'Cozy', '🌙'], ['heart', 'Grateful', '🥰'], ['cloud', 'Low', '🥺']];
const MAX_PHOTOS = 12;
const MAX_TAGS = 10;
const pad = (n) => String(n).padStart(2, '0');
const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const draftKey = () => `orion-draft:${getPrefsScope()}`;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const tzName = () => (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Jakarta' ? 'WIB'
  : new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop());

export async function renderWrite(root, params) {
  // Mode ubah: #/write?edit=<id> membuka entri yang sudah ada (tombol "Edit entry" di halaman baca).
  const editId = params?.get('edit') || null;
  const original = editId ? await getEntry(editId) : null;
  if (editId && !original) {
    return root.append(el('section', { className: 'page empty' }, el('h1', {}, t('entry.notFound')), el('a', { className: 'btn', href: '#/diary' }, t('entry.toDiary'))));
  }
  const editing = !!original;
  // Foto di dalam tulisan wajib berhasil dimuat; kalau gagal, router menampilkan "coba lagi" (jangan sampai foto hilang saat disimpan).
  const origPhotos = editing && original.html && original.photoCount > 0 ? await getEntryPhotos(original.id) : {};

  const now = new Date();
  const state = { mood: MOODS[1][2], privacy: getPrefs().newPrivate === false ? 'shared' : 'private', tags: [], date: dayStr(now) };
  if (editing) Object.assign(state, { mood: original.mood, privacy: original.privacy ?? 'private', tags: [...(original.tags ?? [])], date: dayStr(new Date(original.createdAt)) });
  let saved = false, dirty = false, timer = null, range = null;
  const entryId = editing ? original.id : newEntryId(); // tetap sama kalau menyimpan diulang, jadi tidak dobel
  let pageEl = null;

  // ---------- Judul & isi ----------
  const title = el('textarea', { className: 'ed-title', rows: 1, maxLength: 80, placeholder: t('write.titlePh'), ariaLabel: t('write.titleLabel') });
  const fit = () => { title.style.height = 'auto'; if (title.scrollHeight) title.style.height = `${title.scrollHeight}px`; };
  window.addEventListener('resize', fit);
  title.addEventListener('input', () => { fit(); touch(); });
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); body.focus(); } });

  const body = el('div', { className: 'ed-body rich', contentEditable: 'true', role: 'textbox' });
  body.setAttribute('aria-multiline', 'true');
  body.setAttribute('aria-label', t('write.bodyLabel'));
  body.dataset.placeholder = params?.get('prompt') || t('write.body');
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* abaikan */ }

  // ---------- Status & hitungan ----------
  const status = el('span', { className: 'ed-status', role: 'status' });
  const setStatus = (text, ic = 'cloud-check') => status.replaceChildren(icon(ic), text);
  const counter = el('span', {});
  const hint = el('span', {}, t('write.shortcut'));

  function updateCount() {
    const w = countWords(plainText(body.innerHTML)), m = readMinutes(w);
    counter.textContent = `${t(w === 1 ? 'write.w1' : 'write.wN', { n: w })} · ${t(m === 1 ? 'write.m1' : 'write.mN', { n: m })}`;
  }

  // ---------- Foto di dalam tulisan ----------
  const figs = () => [...body.querySelectorAll('figure')];
  const photoCount = () => body.querySelectorAll('img[data-photo]').length;

  function decorate() {
    body.querySelectorAll('figure').forEach((fig) => {
      fig.contentEditable = 'false';
      let cap = fig.querySelector('figcaption');
      if (!cap) { cap = el('figcaption'); fig.append(cap); }
      cap.contentEditable = 'true';
      cap.dataset.placeholder = t('write.capPh');
      if (!fig.querySelector('.fig-x')) {
        const x = el('button', { type: 'button', className: 'fig-x', ariaLabel: t('write.removePhoto') }, icon('x'));
        x.onclick = () => { fig.remove(); keepTail(); sync(); };
        fig.prepend(x);
      }
    });
  }
  // Selalu ada paragraf kosong di akhir supaya kursor bisa turun setelah foto.
  function keepTail() {
    if (!body.lastElementChild || body.lastElementChild.tagName === 'FIGURE') body.append(el('p', {}, el('br')));
  }
  function ensureBlocks() {
    if (!body.firstElementChild) { body.replaceChildren(el('p', {}, el('br'))); }
    else [...body.childNodes].forEach((n) => { if (n.nodeType === 3 && n.nodeValue.trim()) { const p = el('p'); n.replaceWith(p); p.append(n); } });
  }

  const thumbs = el('div', { className: 'thumbs' });
  function drawThumbs() {
    const imgs = [...body.querySelectorAll('img[data-photo]')];
    thumbs.hidden = imgs.length === 0;
    thumbs.replaceChildren(...imgs.map((img, i) => {
      const open = el('button', { type: 'button', className: 'thumb', ariaLabel: t('write.thumbGo', { n: i + 1 }) }, el('img', { src: img.src, alt: '' }));
      open.onclick = () => { const f = img.closest('figure'); f?.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); f?.querySelector('figcaption')?.focus(); };
      const rm = el('button', { type: 'button', className: 'thumb-x', ariaLabel: t('write.removePhoto') }, icon('x'));
      rm.onclick = () => { img.closest('figure')?.remove(); keepTail(); sync(); };
      return el('span', { className: 'thumb-wrap' }, open, rm);
    }));
    info.textContent = t(imgs.length === 1 ? 'write.photoInfo1' : 'write.photoInfoN', { n: imgs.length, max: MAX_UPLOAD_MB });
  }

  function insertPhoto(data) {
    const fig = el('figure', {}, el('img', { src: data, alt: '' }), el('figcaption'));
    fig.querySelector('img').dataset.photo = newPhotoId();
    const sel = getSelection();
    let anchor = sel.rangeCount && body.contains(sel.anchorNode) ? sel.anchorNode : null;
    while (anchor && anchor.parentNode !== body) anchor = anchor.parentNode;
    if (anchor?.tagName === 'FIGURE') anchor = null;
    if (anchor) anchor.after(fig); else body.append(fig);
    decorate(); keepTail(); sync();
    fig.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  }

  const picker = el('input', { type: 'file', multiple: true, hidden: true, accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif' });
  picker.onchange = async () => { await addFiles([...picker.files]); picker.value = ''; };
  async function addFiles(files) {
    for (const f of files) {
      if (photoCount() >= MAX_PHOTOS) { showToast(t('write.photosFull', { max: MAX_PHOTOS }), 'error'); break; }
      const mb = f.size / 1048576;
      if (mb > MAX_UPLOAD_MB) { showToast(t('book.tooBig', { name: f.name, size: mb.toFixed(1), max: MAX_UPLOAD_MB }), 'error'); continue; }
      if (!/^image\/(jpeg|png|webp|hei[cf])$/i.test(f.type) && !/\.(jpe?g|png|webp|hei[cf])$/i.test(f.name)) { showToast(t('book.notImage'), 'error'); continue; }
      try { insertPhoto(await fileToDataUrl(f)); } catch (err) { showToast(imageErrorMessage(err), 'error'); }
    }
  }

  // ---------- Bilah alat ----------
  const exec = (cmd, val) => { body.focus(); document.execCommand(cmd, false, val); sync(); };
  const block = () => (document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
  const inside = (tag) => { const n = getSelection().anchorNode; return !!(n && body.contains(n) && (n.nodeType === 1 ? n : n.parentElement)?.closest(tag)); };
  const setBlock = (tag) => {
    body.focus();
    if (tag === 'p' && inside('blockquote')) { document.execCommand('formatBlock', false, '<p>'); if (inside('blockquote')) document.execCommand('outdent'); }
    else document.execCommand('formatBlock', false, `<${tag}>`);
    sync();
  };
  const toggleBlock = (tag) => setBlock(block() === tag || (tag === 'blockquote' && inside('blockquote')) ? 'p' : tag);

  const tools = [];
  const tool = (key, ic, run, state) => {
    const b = el('button', { type: 'button', className: 'tb', title: t(`write.t.${key}`), ariaLabel: t(`write.t.${key}`) }, icon(ic));
    b.addEventListener('mousedown', (e) => e.preventDefault()); // keep selection in the text
    b.onclick = run;
    if (state) b.setAttribute('aria-pressed', 'false');
    tools.push([b, state]);
    return b;
  };
  const fmt = el('select', { className: 'ed-select', ariaLabel: t('write.t.format') },
    ...[['p', 'write.f.p'], ['h2', 'write.f.h2'], ['h3', 'write.f.h3'], ['blockquote', 'write.f.quote']].map(([v, k]) => el('option', { value: v }, t(k))));
  fmt.onchange = () => { setBlock(fmt.value); };

  // Tautan: kolom kecil di bawah bilah alat (bukan prompt bawaan browser).
  const url = el('input', { type: 'url', placeholder: 'https://', ariaLabel: t('write.linkUrl') });
  const linkBar = el('div', { className: 'link-bar', hidden: true });
  const closeLink = (focus = true) => { linkBar.hidden = true; if (focus) body.focus(); };
  const restore = () => { body.focus(); if (range) { const s = getSelection(); s.removeAllRanges(); s.addRange(range); } };
  const apply = el('button', { type: 'button' }, t('write.linkApply'));
  const unlink = el('button', { type: 'button', className: 'ghost' }, t('write.linkRemove'));
  apply.onclick = () => {
    let v = url.value.trim(); if (!v) return;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = `https://${v}`;
    if (!/^(https?:|mailto:)/i.test(v)) { url.setCustomValidity(t('write.linkBad')); url.reportValidity(); return; }
    url.setCustomValidity(''); restore();
    if (getSelection().isCollapsed) document.execCommand('insertHTML', false, `<a href="${v.replace(/"/g, '%22')}">${v.replace(/[<>&]/g, '')}</a>`);
    else document.execCommand('createLink', false, v);
    closeLink(false); sync();
  };
  unlink.onclick = () => { restore(); document.execCommand('unlink'); closeLink(false); sync(); };
  url.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); apply.click(); } if (e.key === 'Escape') { e.stopPropagation(); closeLink(); } };
  linkBar.append(url, apply, unlink);
  const openLink = () => {
    const s = getSelection(); range = s.rangeCount && body.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
    const a = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement)?.closest('a');
    url.value = a?.getAttribute('href') ?? ''; linkBar.hidden = false; url.focus();
  };

  const toolbar = el('div', { className: 'ed-toolbar', role: 'toolbar', ariaLabel: t('write.t.bar') }, fmt,
    tool('bold', 'bold', () => exec('bold'), () => document.queryCommandState('bold')),
    tool('italic', 'italic', () => exec('italic'), () => document.queryCommandState('italic')),
    tool('underline', 'underline', () => exec('underline'), () => document.queryCommandState('underline')),
    tool('h2', 'heading-2', () => toggleBlock('h2'), () => block() === 'h2'),
    tool('ul', 'list', () => exec('insertUnorderedList'), () => document.queryCommandState('insertUnorderedList')),
    tool('ol', 'list-ordered', () => exec('insertOrderedList'), () => document.queryCommandState('insertOrderedList')),
    tool('quote', 'quote', () => toggleBlock('blockquote'), () => block() === 'blockquote' || inside('blockquote')),
    tool('link', 'link', openLink, () => inside('a')),
    tool('image', 'image-plus', () => picker.click()),
    tool('undo', 'undo', () => exec('undo')));
  // Roving tabindex (pola toolbar ARIA): satu perhentian tab untuk seluruh bilah alat, panah kiri/kanan (Home/End) berpindah.
  const btns = () => [fmt, ...tools.map(([b]) => b)];
  const setStop = (target) => btns().forEach((b) => { b.tabIndex = b === target ? 0 : -1; });
  setStop(fmt);
  toolbar.addEventListener('focusin', (e) => { if (btns().includes(e.target)) setStop(e.target); });
  toolbar.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || e.target === url) return;
    const l = btns(), i = l.indexOf(document.activeElement); if (i < 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? l.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + l.length) % l.length;
    l[next].focus();
  });

  function updateTools() {
    const s = getSelection();
    if (!s.anchorNode || !body.contains(s.anchorNode)) return;
    tools.forEach(([b, st]) => { if (st) { try { b.setAttribute('aria-pressed', String(!!st())); } catch { /* perintah tidak didukung */ } } });
    const cur = block(); fmt.value = ['h2', 'h3', 'blockquote'].includes(cur) ? cur : (inside('blockquote') ? 'blockquote' : 'p');
  }

  // ---------- Samping: perasaan, label, foto, privasi ----------
  const pill = (group, value, content, on, set) => {
    const b = el('button', { type: 'button', className: 'ghost pill' }, ...content);
    b.setAttribute('aria-pressed', String(on));
    b.onclick = () => { set(value); group.forEach(([x, v]) => x.setAttribute('aria-pressed', String(v === value))); touch(); };
    return b;
  };
  const moodGroup = [];
  const moodBtns = MOODS.map(([ic, name, emoji]) => {
    const b = pill(moodGroup, emoji, [icon(ic), t(`mood.${name}`)], emoji === state.mood, (v) => { state.mood = v; });
    moodGroup.push([b, emoji]); return b;
  });
  const privGroup = [];
  const privBtns = [['private', 'lock-keyhole', 'write.private'], ['shared', 'users', 'write.bestie']].map(([v, ic, k]) => {
    const b = pill(privGroup, v, [icon(ic), t(k)], v === state.privacy, (x) => { state.privacy = x; });
    privGroup.push([b, v]); return b;
  });
  // Tombol yang aktif diberi tanda centang seperti di Figma (lewat CSS ::after).

  const tagInput = el('input', { className: 'tag-input', ariaLabel: t('write.tagsAria'), placeholder: t('write.tagsPh'), maxLength: 30 });
  const tagBox = el('div', { className: 'tagbox' }, tagInput);
  tagBox.onclick = () => tagInput.focus();
  function drawTags() {
    tagBox.querySelectorAll('.tag').forEach((n) => n.remove());
    state.tags.forEach((tg) => {
      const x = el('button', { type: 'button', className: 'tag', ariaLabel: t('write.tagRemove', { tag: tg }) }, `#${tg}`);
      x.onclick = (e) => { e.stopPropagation(); state.tags = state.tags.filter((v) => v !== tg); drawTags(); touch(); tagInput.focus(); };
      tagInput.before(x);
    });
    tagInput.placeholder = state.tags.length ? '' : t('write.tagsPh');
  }
  const addTags = (raw) => {
    raw.split(/[\s,]+/).forEach((p) => {
      const v = p.replace(/^#+/, '').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 24);
      if (v && !state.tags.includes(v) && state.tags.length < MAX_TAGS) state.tags.push(v);
    });
    tagInput.value = ''; drawTags(); touch();
  };
  tagInput.addEventListener('keydown', (e) => {
    if (['Enter', ','].includes(e.key) || (e.key === ' ' && tagInput.value.trim())) { e.preventDefault(); if (tagInput.value.trim()) addTags(tagInput.value); }
    else if (e.key === 'Backspace' && !tagInput.value && state.tags.length) { state.tags.pop(); drawTags(); touch(); }
  });
  tagInput.addEventListener('blur', () => { if (tagInput.value.trim()) addTags(tagInput.value); });

  const info = el('small', { className: 'muted' });
  const addPhotos = el('button', { type: 'button', className: 'ghost' }, icon('image-plus'), t('write.addPhotos'));
  addPhotos.onclick = () => picker.click();

  const dateInput = el('input', { type: 'date', value: state.date, max: dayStr(now), ariaLabel: t('write.date'), hidden: true });
  dateInput.onchange = () => { state.date = dateInput.value || dayStr(now); drawDate(); touch(); };
  const dateText = el('span', { className: 'ed-eyebrow' });
  const changeDate = el('button', { type: 'button', className: 'linklike small' }, t('write.changeDate'));
  changeDate.onclick = () => { dateInput.hidden = !dateInput.hidden; if (!dateInput.hidden) dateInput.focus(); };
  function drawDate() {
    const d = new Date(`${state.date}T12:00:00`);
    const day = d.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
    dateText.textContent = !editing && state.date === dayStr(now) ? `${day} · ${clock(now)} ${tzName()}` : day;
  }

  const aside = el('aside', { className: 'ed-side' },
    el('section', { className: 'card' }, el('h2', {}, t('write.feeling')), el('div', { className: 'pills' }, ...moodBtns), el('small', { className: 'muted' }, t('write.moodNote'))),
    el('section', { className: 'card' }, el('h2', {}, t('write.extras')),
      el('span', { className: 'label' }, t('write.tags')), tagBox, el('small', { className: 'muted' }, t('write.tagHint')),
      thumbs, addPhotos, info),
    el('section', { className: 'card' }, el('h2', {}, t('write.who')), el('div', { className: 'pills col' }, ...privBtns), el('small', { className: 'muted' }, t('write.privNote'))));

  // ---------- Pratinjau & simpan ----------
  const cleanHtml = () => sanitize(body.innerHTML, { keepSrc: true });
  const hasContent = () => plainText(cleanHtml()) || photoCount();

  function preview() {
    const paper = el('article', { className: 'paper' },
      el('time', {}, `${dateText.textContent} ${state.mood}`), el('h1', {}, title.value.trim() || t('write.untitled')));
    const rich = el('div', { className: 'rich' }); rich.innerHTML = cleanHtml();
    paper.append(rich, el('p', {}, ...state.tags.map((tg) => el('span', { className: 'chip', style: 'background:#6c3fd122' }, `#${tg}`))));
    const close = el('button', { type: 'button' }, t('write.close'));
    const dlg = makeDialog('preview-sheet', t('write.preview'), el('h2', {}, t('write.preview')), paper, el('div', { className: 'actions' }, close));
    close.onclick = () => dlg.close();
  }

  const confirmShare = () => new Promise((resolve) => {
    const yes = el('button', { type: 'button' }, t('write.shareYes')), no = el('button', { type: 'button', className: 'ghost' }, t('common.cancel'));
    const dlg = makeDialog('', t('write.shareTitle'), el('h2', {}, t('write.shareTitle')), el('p', { className: 'hint-text' }, t('write.shareAsk')), el('div', { className: 'actions' }, no, yes));
    let ok = false; yes.onclick = () => { ok = true; dlg.close(); }; no.onclick = () => dlg.close();
    dlg.addEventListener('close', () => resolve(ok));
  });

  const error = el('p', { role: 'alert', className: 'form-error' });
  const saveBtn = el('button', { type: 'button' }, icon('sparkles'), t(editing ? 'wedit.save' : 'write.save'));
  const previewBtn = el('button', { type: 'button', className: 'ghost' }, t('write.preview'));
  previewBtn.onclick = preview;
  const cancelBtn = el('button', { type: 'button', className: 'ghost' }, t('common.cancel'));
  cancelBtn.onclick = () => {
    if (dirty && !confirm(t('wedit.discard'))) return;
    location.hash = `#/entry?id=${original.id}`;
  };

  // Galat sinkron (E2): draf aman di perangkat, tombol coba lagi atau lanjut menulis offline.
  const syncPanel = el('section', { className: 'card state-card sync-error', role: 'alert', hidden: true });
  function showSyncError() {
    if (editing) setStatus(t('wedit.unsaved'), 'cloud-off'); else { saveDraft(); setStatus(t('write.draftLocal'), 'cloud-off'); }
    const retry = el('button', { type: 'button' }, icon('refresh-cw'), t('st.syncRetry'));
    const offline = el('button', { type: 'button', className: 'ghost' }, t('st.syncOffline'));
    retry.onclick = () => { syncPanel.hidden = true; save(); };
    offline.onclick = () => { syncPanel.hidden = true; setStatus(t(editing ? 'wedit.unsaved' : 'write.draftLocal'), 'cloud-off'); (title.value ? body : title).focus(); };
    syncPanel.replaceChildren(
      el('span', { className: 'state-ic', 'aria-hidden': 'true' }, icon('cloud-off')),
      el('h2', {}, t('st.syncTitle')), el('p', {}, t('st.syncText')),
      el('div', { className: 'ctrl start' }, retry, offline),
      el('small', {}, t('st.syncLast', { time: clock(new Date()) })));
    syncPanel.hidden = false;
    retry.focus();
  }

  // Sukses (E2): kartu "A memory, safely kept" menggantikan editor.
  function showSaved(entry) {
    const view = el('a', { className: 'btn ghost', href: `#/entry?id=${entry.id}` }, t('st.okView'));
    const heading = el('h2', { tabIndex: -1 }, t('st.okTitle'));
    pageEl.replaceChildren(
      el('h1', {}, t('st.okHeading')),
      el('section', { className: 'card state-card ok', role: 'status' },
        el('span', { className: 'state-ic ok', 'aria-hidden': 'true' }, icon('circle-check')),
        el('div', { className: 'ok-text' }, heading,
          el('p', {}, [entry.privacy === 'shared' ? t('st.okShared') : t('st.okPrivate'), entry.title, entry.privacy === 'shared' ? '' : t('st.okNoChange')].filter(Boolean).join(' · '))),
        view));
    heading.focus();
    confettiBurst();
  }

  const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), ms))]);

  async function save() {
    if (saveBtn.disabled || saved) return;
    if (tagInput.value.trim()) addTags(tagInput.value);
    error.textContent = ''; syncPanel.hidden = true;
    if (!title.value.trim()) { error.textContent = t('write.needTitle'); title.focus(); return; }
    if (!hasContent()) { error.textContent = t('write.needBody'); body.focus(); return; }
    if (state.privacy === 'shared' && !(editing && original.privacy === 'shared') && !(await confirmShare())) return;
    if (navigator.onLine === false) { showSyncError(); return; }

    const html = cleanHtml();
    const box = el('div'); box.innerHTML = html;
    const photos = [...box.querySelectorAll('img[data-photo]')].filter((i) => i.getAttribute('src')).map((i) => ({ id: i.getAttribute('data-photo'), data: i.getAttribute('src') }));
    const same = state.date === dayStr(now);
    saveBtn.disabled = true; setStatus(t('write.saving'), 'cloud');
    try {
      const fields = {
        title: title.value.trim(), text: plainText(html), mood: state.mood, tags: state.tags, privacy: state.privacy,
        html: trimTail(sanitize(html, { keepSrc: false })), photos,
      };
      if (editing) {
        const keepDate = state.date === dayStr(new Date(original.createdAt));
        await withTimeout(updateEntry(original.id, { ...fields, handwritten: original.handwritten ?? false, createdAt: keepDate ? original.createdAt : new Date(`${state.date}T12:00:00`).getTime() }), 25000);
        saved = true; clearTimeout(timer); dirty = false;
        showToast(t('wedit.saved'));
        location.hash = `#/entry?id=${original.id}`;
      } else {
        const entry = await withTimeout(addEntry({
          id: entryId, ...fields, handwritten: false,
          createdAt: same ? Date.now() : new Date(`${state.date}T12:00:00`).getTime(),
        }), 25000);
        saved = true; clearTimeout(timer); dirty = false;
        try { localStorage.removeItem(draftKey()); } catch { /* abaikan */ }
        showSaved(entry);
      }
    } catch (err) {
      saveBtn.disabled = false; setStatus(t(editing ? 'wedit.unsaved' : 'write.draftLocal'), 'cloud-off');
      if (err?.code === 'too-long') { error.textContent = t('write.tooLong'); showToast(t('write.errToast'), 'error'); return; }
      showSyncError();
    }
  }
  saveBtn.onclick = save;

  // ---------- Draf otomatis (di perangkat ini) ----------
  function saveDraft() {
    if (saved || editing) return; // saat mengubah entri yang sudah ada, tidak ada draf lokal
    const data = { title: title.value, html: cleanHtml(), mood: state.mood, privacy: state.privacy, tags: state.tags, date: state.date, ts: Date.now() };
    if (!data.title.trim() && !plainText(data.html) && !state.tags.length) { try { localStorage.removeItem(draftKey()); } catch { /* abaikan */ } return; }
    try { localStorage.setItem(draftKey(), JSON.stringify(data)); }
    catch { // penyimpanan penuh (foto besar): simpan teksnya saja
      try { localStorage.setItem(draftKey(), JSON.stringify({ ...data, html: sanitize(data.html, { images: false }) })); } catch { setStatus(t('write.draftFail'), 'cloud-off'); return; }
    }
    dirty = false; setStatus(t('write.draftSaved', { time: clock(new Date()) }));
  }
  function touch() { dirty = true; if (editing) setStatus(t('wedit.unsaved'), 'cloud'); clearTimeout(timer); timer = setTimeout(saveDraft, 800); }
  function sync() { ensureBlocks(); body.classList.toggle('is-empty', !plainText(body.innerHTML) && !body.querySelector('figure')); body.querySelectorAll('figure img').forEach((i) => { i.alt = i.closest('figure')?.querySelector('figcaption')?.textContent.trim() ?? ''; }); updateCount(); drawThumbs(); updateTools(); touch(); }

  body.addEventListener('input', sync);
  body.addEventListener('focus', () => { ensureBlocks(); });
  body.addEventListener('paste', (e) => {
    e.preventDefault();
    const h = e.clipboardData.getData('text/html');
    if (h) document.execCommand('insertHTML', false, sanitize(h, { images: false }));
    else document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });
  body.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types ?? [])].includes('Files')) e.preventDefault(); });
  body.addEventListener('drop', (e) => { const f = [...(e.dataTransfer?.files ?? [])]; if (f.length) { e.preventDefault(); addFiles(f); } });
  const onSel = () => updateTools();
  const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } };
  document.addEventListener('selectionchange', onSel);
  document.addEventListener('keydown', onKey);

  // ---------- Susun halaman ----------
  const card = el('div', { className: 'ed-card' }, toolbar, linkBar,
    el('div', { className: 'ed-doc' },
      el('div', { className: 'ed-meta' }, dateText, changeDate, dateInput), title, body, error),
    el('div', { className: 'ed-foot' }, counter, hint));
  pageEl = el('section', { className: 'page wide editor-page' },
    el('header', { className: 'ed-head' }, el('h1', {}, t(editing ? 'wedit.title' : 'write.title')),
      el('p', { className: 'ed-sub' }, `${now.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${t(editing ? 'wedit.sub' : 'write.sub')}`)),
    el('div', { className: 'ed-bar' }, status, el('div', { className: 'ctrl' }, previewBtn, ...(editing ? [cancelBtn] : []), saveBtn)),
    syncPanel,
    el('div', { className: 'ed-grid' }, card, aside), picker);
  root.append(pageEl);

  if (editing) {
    title.value = original.title ?? '';
    body.innerHTML = original.html
      ? sanitize(original.html, { keepSrc: true, photos: origPhotos })
      : original.text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    dateInput.value = state.date;
    moodGroup.forEach(([b, v]) => b.setAttribute('aria-pressed', String(v === state.mood)));
    privGroup.forEach(([b, v]) => b.setAttribute('aria-pressed', String(v === state.privacy)));
  } else try { // Pulihkan draf (kecuali dibuka dengan ide dari Dashboard).
    const d = JSON.parse(localStorage.getItem(draftKey()) ?? 'null');
    if (d && !params?.get('prompt')) {
      title.value = d.title ?? ''; body.innerHTML = sanitize(d.html, { keepSrc: true });
      if (MOODS.some((m) => m[2] === d.mood)) state.mood = d.mood;
      if (['private', 'shared'].includes(d.privacy)) state.privacy = d.privacy;
      state.tags = Array.isArray(d.tags) ? d.tags.slice(0, MAX_TAGS) : [];
      if (/^\d{4}-\d{2}-\d{2}$/.test(d.date ?? '') && d.date <= dayStr(now)) state.date = d.date;
      dateInput.value = state.date;
      moodGroup.forEach(([b, v]) => b.setAttribute('aria-pressed', String(v === state.mood)));
      privGroup.forEach(([b, v]) => b.setAttribute('aria-pressed', String(v === state.privacy)));
      setStatus(t('write.draftSaved', { time: clock(new Date(d.ts ?? Date.now())) }));
    } else setStatus(t('write.draftNew'));
  } catch { setStatus(t('write.draftNew')); }
  decorate(); ensureBlocks(); drawTags(); drawDate(); fit(); sync(); dirty = false;
  if (editing) setStatus(t('wedit.open'));
  requestAnimationFrame(() => { fit(); if (!title.value) title.focus({ preventScroll: true }); }); // setelah halaman sudah terpasang di dokumen

  return () => { // dipanggil router saat pindah halaman atau ganti bahasa
    clearTimeout(timer); if (dirty) saveDraft();
    window.removeEventListener('resize', fit); document.removeEventListener('selectionchange', onSel); document.removeEventListener('keydown', onKey);
  };
}
