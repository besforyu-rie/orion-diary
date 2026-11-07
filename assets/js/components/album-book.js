import { esc } from '../utils.js';

const STAR_SVG = '<svg viewBox="0 0 100 120" fill="none" stroke="#FFD86B" stroke-width=".6"><path d="M20 15 L45 40 L38 70 L62 62 L80 100 M45 40 L78 28 M38 70 L25 105"/><g fill="#FFD86B" stroke="none"><circle cx="20" cy="15" r="2"/><circle cx="45" cy="40" r="2.4"/><circle cx="78" cy="28" r="1.8"/><circle cx="38" cy="70" r="2"/><circle cx="62" cy="62" r="2"/><circle cx="80" cy="100" r="2.2"/></g></svg>';
const PAGE_LABELS = ['Sampul', 'Halaman 1–2', 'Halaman 3–4', 'Halaman 5–6', 'Akhir'];

const polaroid = (photo, i, rotate) => {
  const style = photo.src ? `style="background-image:url('${esc(photo.src)}')"` : '';
  const filler = photo.src ? '' : '✦';
  return `<div class="pol" style="--r:${rotate}deg"><i class="tape"></i>
    <div class="img g${(i % 5) + 1}" ${style} data-cap="${esc(photo.caption)}">${filler}</div>
    <b>${esc(photo.caption)}</b></div>`;
};

const leaf = (front, back) => `<div class="leaf"><div class="face pg">${front}</div><div class="face back pg l">${back}</div></div>`;

function buildLeaves(d) {
  const [p1, p2, p3, p4, p5] = d.photos;
  const cover = `<div class="leaf">
    <div class="face cover"><small>${esc(d.cover.label)}</small>${STAR_SVG}
      <h2 style="margin-top:34cqh">${esc(d.cover.title)}</h2><em>${esc(d.date)} ✦</em></div>
    <div class="face back pg l"><p class="script">Untuk sahabatku,</p><h2 class="big">${esc(d.to)}</h2>
      <p class="txt">${esc(d.dedication)}</p><p class="script" style="text-align:right;margin-top:auto">dari ${esc(d.from)} ♡</p></div></div>`;
  const letter = `<p class="script">Surat kecil</p>${d.letter.map((t) => `<p class="txt">${esc(t)}</p>`).join('')}
    <p class="script" style="text-align:right;margin-top:auto">${esc(d.from)} ♡</p>`;
  return cover
    + leaf(polaroid(p1, 0, -3) + polaroid(p2, 1, 2.5), polaroid(p3, 2, 2))
    + leaf(letter, polaroid(p4, 3, -2) + polaroid(p5, 4, 3))
    + leaf(`<h2 class="big">${esc(d.ending)}</h2>`, `<p class="script">Happy birthday, ${esc(d.to)} ♡</p>`);
}

/** Pasang album ke `root`. Mengembalikan fungsi cleanup. */
export function mountAlbum(root, data) {
  root.innerHTML = `
    <h1>Happy Birthday, ${esc(data.to)} ✦</h1>
    <div class="stage"><div class="tilt closed"><div class="book">${buildLeaves(data)}</div></div>
      <div class="hint">Klik buku untuk membuka ✦</div></div>
    <div class="ctrl">
      <button class="ghost" data-act="prev" aria-label="Halaman sebelumnya">‹</button>
      <span class="count"></span>
      <button class="ghost" data-act="next" aria-label="Halaman berikutnya">›</button>
      <button data-act="play">▶ Slideshow</button></div>
    <div id="lb" role="dialog" aria-label="Foto"><div class="card"><div class="img" id="lbimg"></div><p id="lbcap"></p></div>
      <div class="ctrl"><label class="btn" tabindex="0">Ganti foto<input type="file" accept="image/*" hidden></label>
      <button class="ghost" data-act="close">Tutup</button></div></div>`;

  const $ = (s) => root.querySelector(s);
  const leaves = [...root.querySelectorAll('.leaf')];
  const total = leaves.length;
  const book = $('.book'), tilt = $('.tilt'), lightbox = $('#lb'), lbImg = $('#lbimg');
  let page = 0, timer = null, current = null;
  leaves.forEach((l, i) => { l.style.zIndex = total - i; });

  function render() {
    leaves.forEach((l, i) => {
      l.classList.toggle('flipped', i < page);
      setTimeout(() => { l.style.zIndex = i < page ? i : total - i; }, 450);
    });
    const w = book.offsetWidth;
    book.style.transform = `translateX(${page === 0 ? -w / 2 : page === total ? w / 2 : 0}px)`;
    tilt.classList.toggle('closed', page === 0);
    $('.hint').classList.toggle('off', page > 0);
    $('.count').textContent = PAGE_LABELS[page];
    $('[data-act=prev]').disabled = page === 0;
    $('[data-act=next]').disabled = page === total;
    if (page === total) stopSlideshow();
  }
  const go = (d) => { page = Math.max(0, Math.min(total, page + d)); render(); };
  function stopSlideshow() { clearInterval(timer); timer = null; $('[data-act=play]').textContent = '▶ Slideshow'; }

  function toggleSlideshow() {
    if (timer) return stopSlideshow();
    if (page === total) page = 0;
    render();
    $('[data-act=play]').textContent = '❚❚ Berhenti';
    timer = setInterval(() => go(1), 3500);
  }

  function openPhoto(img) {
    current = img;
    lbImg.className = img.className;
    lbImg.style.backgroundImage = img.style.backgroundImage;
    lbImg.textContent = img.textContent;
    $('#lbcap').textContent = img.dataset.cap;
    lightbox.classList.add('on');
  }

  leaves.forEach((l, i) => l.addEventListener('click', () => { if (i === page) go(1); else if (i === page - 1) go(-1); }));
  root.querySelectorAll('.pol').forEach((p) => p.addEventListener('click', (e) => { e.stopPropagation(); openPhoto(p.querySelector('.img')); }));
  root.addEventListener('click', (e) => {
    const act = e.target.dataset?.act;
    if (act === 'next') go(1);
    if (act === 'prev') go(-1);
    if (act === 'play') toggleSlideshow();
    if (act === 'close') lightbox.classList.remove('on');
  });
  $('input[type=file]').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !current) return;
    const url = `url(${URL.createObjectURL(file)})`; // sementara; foto permanen: isi "src" di data/album.json
    current.style.backgroundImage = url; current.textContent = '';
    lbImg.style.backgroundImage = url; lbImg.textContent = '';
  });
  const onKey = (e) => {
    if (e.key === 'Escape') lightbox.classList.remove('on');
    if (lightbox.classList.contains('on')) return;
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  };
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', render);
  render();

  return () => { stopSlideshow(); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', render); };
}
