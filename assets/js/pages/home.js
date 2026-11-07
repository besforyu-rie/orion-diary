import { CONFIG } from '../config.js';
import { el } from '../utils.js';

export function renderHome(root) {
  root.append(
    el('section', { className: 'page hero' },
      el('h1', {}, 'Your days. Your stars. Your little universe.'),
      el('p', {}, `Diary, album, dan sudut kecil galaksi untuk ${CONFIG.userName}.`),
      el('a', { className: 'btn', href: '#/diary' }, 'Mulai menulis'),
      ' ',
      el('a', { className: 'btn ghost', href: '#/album' }, 'Buka album'),
    ),
  );
}
