import { mountAlbum } from '../components/album-book.js';
import { el } from '../utils.js';

export async function renderAlbum(root) {
  const res = await fetch('data/album.json');
  const data = await res.json();
  const wrap = el('section', { className: 'page album-wrap' });
  root.append(wrap);
  return mountAlbum(wrap, data); // mengembalikan fungsi cleanup
}
