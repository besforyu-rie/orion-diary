// Teks kaya untuk editor entri: membersihkan HTML dari contenteditable/paste supaya hanya tag aman yang tersimpan.
// Foto di dalam tulisan disimpan terpisah (sub-koleksi photos); di HTML hanya ada <img data-photo="id">.
const ALLOWED = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'FIGURE', 'FIGCAPTION', 'IMG']);
const RENAME = { B: 'STRONG', I: 'EM', DIV: 'P' };
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'BUTTON', 'SVG', 'TEMPLATE', 'NOSCRIPT', 'INPUT', 'SELECT', 'TEXTAREA']);
const DATA_IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const SAFE_URL = /^(https?:|mailto:)/i;

function walk(from, to, opt) {
  for (const n of [...from.childNodes]) {
    if (n.nodeType === 3) { to.append(document.createTextNode(n.nodeValue)); continue; }
    if (n.nodeType !== 1) continue;
    let tag = n.tagName.toUpperCase();
    if (DROP.has(tag)) continue;
    tag = RENAME[tag] ?? tag;
    if (!ALLOWED.has(tag)) { walk(n, to, opt); continue; } // tag asing: buang tag, simpan isinya
    if (tag === 'IMG') {
      const pid = (n.getAttribute('data-photo') ?? '').replace(/[^\w-]/g, '').slice(0, 40);
      if (!pid || !opt.images) continue;
      const img = document.createElement('img');
      img.setAttribute('data-photo', pid);
      img.setAttribute('alt', (n.getAttribute('alt') ?? '').slice(0, 200));
      const src = opt.photos?.[pid] ?? (opt.keepSrc ? n.getAttribute('src') : null);
      if (src && DATA_IMG.test(src)) img.setAttribute('src', src);
      to.append(img);
      continue;
    }
    if (tag === 'FIGURE' && !opt.images) continue;
    const c = document.createElement(tag.toLowerCase());
    if (tag === 'A') {
      const href = (n.getAttribute('href') ?? '').trim();
      if (!SAFE_URL.test(href)) { walk(n, to, opt); continue; } // tautan tidak aman: jadi teks biasa
      c.setAttribute('href', href); c.setAttribute('rel', 'noopener noreferrer'); c.setAttribute('target', '_blank');
    }
    walk(n, c, opt);
    to.append(c);
  }
}

/** Bersihkan HTML. keepSrc: pertahankan data URL foto (untuk editor/pratinjau); photos: {id: dataUrl} untuk membaca entri. */
export function sanitize(html, { keepSrc = false, photos = null, images = true } = {}) {
  const doc = new DOMParser().parseFromString(`<body>${html ?? ''}</body>`, 'text/html');
  const out = document.createElement('div');
  walk(doc.body, out, { keepSrc, photos, images });
  return out.innerHTML;
}

const BLOCKS = 'p,h2,h3,li,blockquote,figcaption';

/** Teks polos (untuk daftar diary, pencarian, linimasa, dan PDF). */
export function plainText(html) {
  const box = document.createElement('div');
  box.innerHTML = sanitize(html, { images: false });
  box.querySelectorAll(BLOCKS).forEach((b) => b.append(document.createTextNode('\n')));
  return box.textContent.replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
}

export const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length;
export const readMinutes = (words) => Math.max(1, Math.ceil(words / 200));
export const newPhotoId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Buang paragraf kosong di ujung tulisan (sisa kursor) dan ubah spasi non-breaking jadi spasi biasa. */
export const trimTail = (html) => html.replace(/(<p>(<br>)?<\/p>\s*)+$/, '').replace(/&nbsp;/g, ' ');
