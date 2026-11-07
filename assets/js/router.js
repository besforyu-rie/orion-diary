// Router hash sederhana: #/diary -> routes['/diary'].
// Halaman dirender ke elemen terpisah, jadi ada tampilan "memuat" dan penanganan error.
import { el, icon } from './utils.js';
import { t } from './i18n.js';

// Memuat: lencana diumumkan sekali ke pembaca layar; kerangka abu-abu hanya hiasan.
const skeletonRow = () => el('div', { className: 'skel-row' }, el('i', { className: 'skel skel-thumb' }),
  el('div', { className: 'skel-lines' }, el('i', { className: 'skel' }), el('i', { className: 'skel' }), el('i', { className: 'skel short' })));
const loadingView = () => el('section', { className: 'page loading', 'aria-busy': 'true' },
  el('p', { className: 'load-badge', role: 'status' }, el('i', { 'aria-hidden': 'true' }), t('router.loading')),
  el('div', { 'aria-hidden': 'true' }, skeletonRow(), skeletonRow(), skeletonRow()));

const errorView = (retry) => el('section', { className: 'page' },
  el('div', { className: 'card state-card error-card', role: 'alert' },
    el('span', { className: 'state-ic', 'aria-hidden': 'true' }, icon('cloud-off')),
    el('h1', {}, t('router.errTitle')),
    el('p', {}, t('router.errText')),
    el('div', { className: 'ctrl start' }, Object.assign(el('button', {}, icon('refresh-cw'), t('common.retry')), { onclick: retry }))));

export function startRouter(routes, outlet) {
  let cleanup = null;
  let current = 0;

  async function show() {
    const mine = ++current;
    const [path, query = ''] = (location.hash.slice(1) || '/').split('?');
    const page = routes[path] ?? routes['*'];
    if (cleanup) cleanup();
    cleanup = null;
    outlet.replaceChildren(loadingView());

    const view = document.createElement('div');
    try {
      const result = (await page(view, new URLSearchParams(query))) ?? null;
      if (mine !== current) { result?.(); return; } // pengguna sudah pindah halaman
      cleanup = result;
      outlet.replaceChildren(view);
    } catch (err) {
      console.error(err);
      if (mine === current) outlet.replaceChildren(errorView(show));
    }

    document.querySelectorAll('[data-route]').forEach((a) => {
      if (a.dataset.route === path || (a.dataset.also ?? '').split(' ').includes(path)) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  window.addEventListener('hashchange', show);
  window.addEventListener('langchange', show); // ganti bahasa: gambar ulang halaman
  show();
}
