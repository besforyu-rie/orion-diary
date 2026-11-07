import { locale } from './i18n.js';

/** Buat elemen DOM dengan aman (teks tidak diparse sebagai HTML). */
export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

export const formatDate = (ts) =>
  new Date(ts).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });

/** Jumlah hari menuju ulang tahun berikutnya. */
export function daysUntil({ month, day }) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), month - 1, day);
  if (target < today) target = new Date(now.getFullYear() + 1, month - 1, day);
  return Math.round((target - today) / 864e5);
}

/** Ikon dari sprite di index.html (gaya garis). Warna mengikuti teks sekitarnya. */
export function icon(name, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `icon ${className}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

/** Escape teks untuk dipakai di dalam template HTML. */
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Tanggal ulang tahun berikutnya (jam 00:00); hari ini ikut dihitung. */
export function nextBirthday({ month, day }) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(now.getFullYear(), month - 1, day);
  return target < today ? new Date(now.getFullYear() + 1, month - 1, day) : target;
}
