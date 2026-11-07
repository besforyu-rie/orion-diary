// Halaman publik #/dinding: ucapan + balasan yang dipilih untuk ditampilkan.
import { listSharedWishes } from '../services/wishes.js';
import { CONFIG } from '../config.js';
import { t } from '../i18n.js';
import { el, formatDate } from '../utils.js';

export async function renderWall(root) {
  const items = await listSharedWishes();
  const cards = items.map((w) => el('article', { className: 'card' },
    el('h3', {}, w.name), el('time', {}, formatDate(w.createdAt)), el('p', {}, w.text),
    w.reply ? el('div', { className: 'reply' }, el('strong', { className: 'hand' }, t('wall.reply', { name: CONFIG.userName })), el('p', {}, w.reply)) : ''));

  root.append(el('section', { className: 'page wide' },
    el('div', { className: 'row' }, el('h1', {}, t('wall.title')), el('a', { className: 'btn', href: '#/kirim' }, t('wall.write'))),
    items.length
      ? el('div', { className: 'wall' }, ...cards)
      : el('div', { className: 'empty' }, el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
          el('p', {}, t('wall.empty')))));
}
