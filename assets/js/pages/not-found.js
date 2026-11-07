import { getUser } from '../services/auth.js';
import { t } from '../i18n.js';
import { el, icon } from '../utils.js';

export function renderNotFound(root) {
  const signedIn = Boolean(getUser());
  root.append(
    el('section', { className: 'page nf' },
      el('div', { className: 'nf-art', ariaHidden: 'true' },
        el('span', {}, '4'), el('img', { src: 'assets/images/pip.png', alt: '' }), el('span', {}, '4')),
      el('h1', {}, t('notfound.title')),
      el('p', { className: 'nf-text' }, t('notfound.text')),
      el('div', { className: 'nf-actions' },
        el('a', { className: 'btn', href: signedIn ? '#/dashboard' : '#/' }, icon('home'), t('notfound.home')),
        signedIn ? el('a', { className: 'btn ghost', href: '#/diary' }, t('notfound.diary')) : ''),
      el('p', { className: 'nf-shared' }, t('notfound.shared')),
      el('p', { className: 'hand nf-hand' }, t('notfound.hand'))));
}
