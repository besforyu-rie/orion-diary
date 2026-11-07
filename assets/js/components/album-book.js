import { esc } from '../utils.js';
import { playFlip } from './flip-sound.js';
import { getPrefs } from '../services/prefs.js';
import { t } from '../i18n.js';
import { showToast } from './toast.js';
import { MAX_UPLOAD_MB as MAX_PHOTO_MB, imageErrorMessage } from '../services/image.js'; // 20 MB, sama dengan desain Figma

export const STAR_SVG = '<svg viewBox="0 0 100 120" fill="none" stroke="#FFD86B" stroke-width=".6"><path d="M20 15 L45 40 L38 70 L62 62 L80 100 M45 40 L78 28 M38 70 L25 105"/><g fill="#FFD86B" stroke="none"><circle cx="20" cy="15" r="2"/><circle cx="45" cy="40" r="2.4"/><circle cx="78" cy="28" r="1.8"/><circle cx="38" cy="70" r="2"/><circle cx="62" cy="62" r="2"/><circle cx="80" cy="100" r="2.2"/></g></svg>';
const pad = (n) => String(n).padStart(2, '0');
const pageLabel = (page, total, single, half) => (page === 0 ? t('book.cover')
  : page === total ? t('book.end')
  : single ? t('book.single', { a: pad(half === 'L' ? page * 2 - 1 : page * 2), n: total * 2 })
  : t('book.pages', { a: pad(page * 2 - 1), b: pad(page * 2), n: total * 2 }));

const polaroid = (photo, i, rotate) => {
  const style = photo.src ? `style="background-image:url('${esc(photo.src)}');background-position:${esc(photo.focus ?? '50% 50%')}"` : '';
  const filler = photo.src ? '' : '✦';
  return `<div class="pol" style="--r:${rotate}deg"><i class="tape"></i>
    <div class="img g${(i % 5) + 1}" ${style} data-cap="${esc(photo.caption)}" data-pid="${esc(photo.id ?? '')}">${filler}</div>
    <b>${esc(photo.caption)}</b></div>`;
};

const leaf = (front, back) => `<div class="leaf"><div class="face pg"><div class="in">${front}</div></div><div class="face back pg l"><div class="in">${back}</div></div></div>`;

/**
 * Susunan sisi kertas setelah sampul. `kinds` = 'photo' / 'note' per item, urut.
 * Aturan: sisi foto pertama 2 foto, kedua 1 foto, lalu 2 foto per sisi; halaman teks selalu satu sisi sendiri
 * dan memutus kelompok foto; surat (kalau ada) menyusul setelah sisi foto kedua, atau di akhir kalau fotonya sedikit.
 * Dengan 5 foto tanpa halaman teks hasilnya sama dengan tata letak asli.
 */
export function layoutSides(kinds, hasLetter) {
  const sides = [];
  let cur = null, photoSides = 0, letterDone = !hasLetter;
  const flush = () => {
    if (!cur) return;
    sides.push(cur); cur = null; photoSides++;
    if (photoSides === 2 && !letterDone) { sides.push({ t: 'letter' }); letterDone = true; }
  };
  kinds.forEach((k, i) => {
    if (k === 'note') { flush(); sides.push({ t: 'note', idx: [i] }); return; }
    cur ??= { t: 'photos', idx: [] };
    cur.idx.push(i);
    if (cur.idx.length >= (photoSides === 1 ? 1 : 2)) flush();
  });
  flush();
  if (!letterDone) sides.push({ t: 'letter' });
  if (sides.length % 2) sides.push({ t: 'blank' }); // sisi terakhir butuh pasangan di balik lembar
  return sides;
}

/** Jumlah halaman (sisi kertas) sebuah album, termasuk sampul depan dan belakang. */
export function pageCount(album) {
  const kinds = album.kinds ?? Array(album.photoCount ?? 0).fill('photo');
  return layoutSides(kinds, (album.letter?.length ?? 0) > 0).length + 4;
}

const ROTATIONS = [-3, 2.5, 2, -2, 3];
const BLANK_SIDE = '<p class="script" style="margin:auto;opacity:.5">✦</p>';

// Isi tiap sisi mengikuti layoutSides() di atas.
function buildLeaves(d) {
  const backSide = d.to || d.dedication ? `<p class="script">${t('book.toFriend')}</p><h2 class="big">${esc(d.to)}</h2>
      ${d.dedication ? `<p class="txt">${esc(d.dedication)}</p>` : ''}
      ${d.from ? `<p class="script" style="text-align:right;margin-top:auto">${esc(t('book.from', { from: d.from }))}</p>` : ''}` : BLANK_SIDE;
  const cover = `<div class="leaf">
    <div class="face cover"><div class="in"><small>${esc(d.cover.label)}</small>${STAR_SVG}
      <h2 style="margin-top:34cqh">${esc(d.cover.title)}</h2><em>${esc(d.date)} ✦</em></div></div>
    <div class="face back pg l"><div class="in">${backSide}</div></div></div>`;

  const letterChars = d.letter.reduce((n, line) => n + line.length, 0);
  const letter = `<p class="script">${t('book.letter')}</p>${d.letter.map((line) => `<p class="txt ${letterChars > 700 ? 'xs' : 'sm'}">${esc(line)}</p>`).join('')}
    ${d.from ? `<p class="script" style="text-align:right;margin-top:auto">${esc(d.from)} ♡</p>` : ''}`;

  const items = d.items ?? d.photos;
  const pols = items.map((p, i) => (p.kind === 'note' ? null : polaroid(p, i, ROTATIONS[i % ROTATIONS.length])));
  const noteSide = (n) => {
    const size = n.text.length > 320 ? 'xs' : n.text.length > 180 ? 'sm' : '';
    const paras = n.text.split(/\n+/).filter(Boolean).map((line) => `<p class="txt ${size}">${esc(line)}</p>`).join('');
    const edit = d.editable ? `<button type="button" class="note-edit" data-note="${esc(n.id)}" aria-label="${esc(t('note.edit'))}"><svg class="icon" aria-hidden="true"><use href="#i-pencil"/></svg></button>` : '';
    return `<div class="note-page"><span class="script note-star" aria-hidden="true">✦</span>${paras || BLANK_SIDE}${edit}</div>`;
  };
  const sides = layoutSides(items.map((i) => i.kind ?? 'photo'), d.letter.length > 0).map((side) => {
    if (side.t === 'letter') return letter;
    if (side.t === 'note') return noteSide(items[side.idx[0]]);
    if (side.t === 'photos') return side.idx.map((i) => pols[i]).join('');
    return BLANK_SIDE;
  });

  let pages = '';
  for (let i = 0; i < sides.length; i += 2) pages += leaf(sides[i], sides[i + 1]);

  const ending = d.ending || t('book.endDefault');
  const wish = d.to ? `<p class="script">${esc(t('book.hb', { to: d.to }))}</p>` : '';
  return cover + pages + leaf(`<h2 class="big">${esc(ending)}</h2>`, wish);
}

/** Pasang album ke `root`. Mengembalikan fungsi cleanup. */
export function mountAlbum(root, data, opts = {}) {
  root.innerHTML = `
    <div class="book-panel">
      <i class="spark s1" aria-hidden="true">✦</i><i class="spark s2" aria-hidden="true">✧</i>
      <div class="stage"><div class="tilt closed"><div class="book">${buildLeaves(data)}</div></div></div>
      <button type="button" class="open-btn" data-act="open"><svg class="icon" aria-hidden="true"><use href="#i-book-open"/></svg>${t('book.open')}</button>
      <p class="panel-note"></p>
    </div>
    <div class="book-ctrl">
      <div class="group">
        <button class="ghost" data-act="prev" aria-label="${t('book.prev')}">‹ ${t('book.prevShort')}</button>
        <span class="count" aria-live="polite"></span>
        <button class="ghost" data-act="next" aria-label="${t('book.nextA')}">${t('book.nextShort')} ›</button>
      </div>
      <div class="group">
        <button class="ghost" data-act="play">${t('book.slideshow')}</button>
        <label class="opt"><span>${t('book.sound')}</span><input type="checkbox" role="switch" id="sound" ${getPrefs().flipSound ? 'checked' : ''}></label>
      </div>
    </div>
    <div id="lb" role="dialog" aria-label="${t('book.photo')}"><div class="card"><div class="img" id="lbimg"></div><p id="lbcap"></p></div>
      <input id="lbcapin" class="lb-input" maxlength="120" hidden placeholder="${esc(t('book.caption'))}" aria-label="${esc(t('book.caption'))}">
      <div class="ctrl"><label class="btn" tabindex="0">${t('book.change')}<input type="file" accept="image/*" hidden></label>
      <button class="ghost" data-act="delete" hidden>${t('book.delete')}</button>
      <button class="ghost" data-act="close">${t('book.close')}</button></div></div>`;

  const $ = (s) => root.querySelector(s);
  const leaves = [...root.querySelectorAll('.leaf')];
  const total = leaves.length;
  const book = $('.book'), tilt = $('.tilt'), lightbox = $('#lb'), lbImg = $('#lbimg'), capIn = $('#lbcapin');
  let page = 0, timer = null, current = null;
  if (opts.startPage > 0) page = Math.min(opts.startPage, Math.max(0, total - 1)); // mis. lompat ke foto yang baru ditambah
  // Mobile (<= 560 px): satu halaman sekali tampil. `half` = sisi yang terlihat dari lembar terbuka: 'L' (kiri) atau 'R' (kanan).
  const narrow = matchMedia('(max-width: 560px)');
  let single = narrow.matches;
  let half = page === total ? 'L' : page === 0 ? 'R' : 'L';
  const fixHalf = () => { if (page === 0) half = 'R'; else if (page === total) half = 'L'; };
  const panel = $('.book-panel');
  leaves.forEach((l, i) => { l.style.zIndex = i < page ? i : total - i; });

  function render() {
    leaves.forEach((l, i) => {
      const was = l.classList.contains('flipped');
      l.classList.toggle('flipped', i < page);
      if (was !== i < page) { // lembar sedang dibalik: beri kilau lengkung kertas selama gerakan
        l.classList.add('turning');
        setTimeout(() => l.classList.remove('turning'), 950);
      }
      setTimeout(() => { l.style.zIndex = i < page ? i : total - i; }, 450);
    });
    panel.classList.toggle('single', single);
    const shift = single ? (half === 'R' ? -0.5 : 0.5) : (page === 0 ? -0.5 : page === total ? 0.5 : 0); // setengah lebar halaman
    book.style.transform = `translateX(calc(var(--w) * ${shift}))`;
    tilt.classList.toggle('closed', page === 0);
    const openBtn = $('.open-btn');
    openBtn.classList.toggle('off', page > 0);
    openBtn.inert = page > 0;
    $('.panel-note').textContent = t(page === 0 ? 'book.noteClosed' : 'book.noteOpen');
    opts.onState?.({ page, total });
    $('.count').textContent = pageLabel(page, total, single, half);
    $('[data-act=prev]').disabled = page === 0;
    $('[data-act=next]').disabled = page === total;
    if (page === total) stopSlideshow();
  }
  const go = (d) => {
    const before = page;
    if (single) { // satu halaman per langkah: sampul → kiri 1 → kanan 1 → kiri 2 → ... → akhir
      if (d > 0) {
        if (page === 0) { page = 1; half = 'L'; }
        else if (half === 'L' && page < total) half = 'R';
        else if (half === 'R') { page = Math.min(total, page + 1); half = 'L'; }
      } else if (page === total) { page = total - 1; half = 'R'; }
      else if (half === 'R' && page > 0) half = 'L';
      else if (page > 0) { page -= 1; half = 'R'; }
      fixHalf();
    } else page = Math.max(0, Math.min(total, page + d));
    if (page !== before && $('#sound').checked) playFlip(); // bunyi hanya saat lembar benar-benar dibalik
    render();
  };
  function stopSlideshow() { clearInterval(timer); timer = null; $('[data-act=play]').textContent = t('book.slideshow'); }

  function toggleSlideshow() {
    if (timer) return stopSlideshow();
    if (page === total) page = 0;
    render();
    $('[data-act=play]').textContent = t('book.stop');
    timer = setInterval(() => go(1), 5000);
  }

  function openPhoto(img) {
    current = img;
    lbImg.className = img.className;
    lbImg.style.backgroundImage = img.style.backgroundImage;
    lbImg.textContent = img.textContent;
    $('#lbcap').textContent = img.dataset.cap;
    const editable = Boolean(opts.onSaveCaption && img.dataset.pid); // keterangan hanya bisa diubah di album tersimpan
    capIn.hidden = !editable;
    $('[data-act=delete]').hidden = !(opts.onDeletePhoto && img.dataset.pid);
    $('#lbcap').hidden = editable;
    if (editable) capIn.value = img.dataset.cap ?? '';
    lightbox.classList.add('on');
  }

  let swiped = false;
  leaves.forEach((l, i) => l.addEventListener('click', (e) => {
    if (e.target.closest('[data-note]') || swiped) return;
    if (single) { if (i === (half === 'R' ? page : page - 1)) go(1); return; } // ketuk halaman = lanjut
    if (i === page) go(1); else if (i === page - 1) go(-1);
  }));
  // Geser jari ke kiri = berikutnya, ke kanan = sebelumnya (hanya mode satu halaman)
  let sx = null;
  const stage = $('.stage');
  stage.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (sx === null || !single) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) < 48) return;
    swiped = true; setTimeout(() => { swiped = false; }, 350);
    go(dx < 0 ? 1 : -1);
  }, { passive: true });
  const onNarrow = () => { single = narrow.matches; fixHalf(); render(); };
  narrow.addEventListener?.('change', onNarrow);
  root.querySelectorAll('.pol').forEach((p) => p.addEventListener('click', (e) => { e.stopPropagation(); openPhoto(p.querySelector('.img')); }));
  root.addEventListener('click', (e) => {
    const act = e.target.closest?.('[data-act]')?.dataset.act;
    if (act === 'open') go(1);
    if (act === 'next') go(1);
    if (act === 'prev') go(-1);
    if (act === 'play') toggleSlideshow();
    if (act === 'close') lightbox.classList.remove('on');
    if (act === 'delete' && current && confirm(t('book.confirmDelete'))) {
      lightbox.classList.remove('on');
      opts.onDeletePhoto(current.dataset.pid);
    }
    const noteBtn = e.target.closest?.('[data-note]');
    if (noteBtn) { e.stopPropagation(); opts.onEditNote?.(noteBtn.dataset.note); }
  });
  capIn.addEventListener('change', async () => {
    const img = current;
    if (!img || !opts.onSaveCaption) return;
    const value = capIn.value.trim();
    try {
      await opts.onSaveCaption(img.dataset.pid, value);
      img.dataset.cap = value;
      const label = img.nextElementSibling; // <b> di bawah foto polaroid
      if (label) label.textContent = value;
      $('#lbcap').textContent = value;
      showToast(t('book.captionSaved'));
    } catch (err) { console.error(err); showToast(t('book.saveFail'), 'error'); }
  });
  $('input[type=file]').addEventListener('change', async (e) => {
    const input = e.target;
    const file = input.files[0];
    input.value = ''; // supaya file yang sama bisa dipilih lagi
    const img = current;
    if (!file || !img) return;
    if (!file.type.startsWith('image/')) return showToast(t('book.notImage'), 'error');
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      return showToast(t('book.tooBig', { name: file.name, size: (file.size / 1048576).toFixed(1), max: MAX_PHOTO_MB }), 'error');
    }
    const show = (src) => {
      const url = `url("${src}")`;
      img.style.backgroundImage = url; img.textContent = '';
      if (current === img) { lbImg.style.backgroundImage = url; lbImg.textContent = ''; }
    };
    const pid = img.dataset.pid;
    if (opts.onReplacePhoto && pid) { // album tersimpan: kecilkan lalu simpan permanen
      showToast(t('book.saving'));
      try { show(await opts.onReplacePhoto(pid, file)); showToast(t('book.saved')); }
      catch (err) { console.error(err); showToast(imageErrorMessage(err), 'error'); }
      return;
    }
    show(URL.createObjectURL(file)); // album dari file JSON: hanya sementara di browser
  });
  const onKey = (e) => {
    if (e.key === 'Escape') lightbox.classList.remove('on');
    if (lightbox.classList.contains('on')) return;
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  };
  /** Kalau tulisan satu halaman melebihi kertas, kecilkan sedikit-sedikit sampai muat (bukan dipotong). */
  function fitText() {
    root.querySelectorAll('.pg > .in').forEach((box) => {
      box.style.removeProperty('--k');
      for (let k = 1; box.scrollHeight > box.clientHeight + 1 && k > 0.45;) { k -= 0.05; box.style.setProperty('--k', k.toFixed(2)); }
    });
  }
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', render);
  render();
  fitText();
  document.fonts?.ready.then(fitText);

  return () => { stopSlideshow(); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', render); narrow.removeEventListener?.('change', onNarrow); };
}
