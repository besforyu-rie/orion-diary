// Beranda publik (A1): hero, pembuka, fitur, album, bestie, privasi, FAQ, ajakan penutup, footer.
import { getPrefs, setPrefs } from '../services/prefs.js';
import { getLang, t } from '../i18n.js';
import { el, icon } from '../utils.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });

const FEATURES = [
  ['write', 'notebook-pen', '#/login'], ['magic', 'sparkles', '#/albums'], ['fandom', 'book-heart', '#/login'],
];

export function renderHome(root) {
  const name = getPrefs().displayName || t('name.fallback');

  const topbar = el('div', { className: 'landing-bar' },
    el('nav', { className: 'landing-links', ariaLabel: t('home.sections') },
      ...[['lp-universe', 'home.nav1'], ['lp-album', 'home.nav2'], ['lp-made', 'home.nav3']].map(([id, k]) => {
        const b = el('button', { type: 'button', className: 'linklike' }, t(k)); b.onclick = () => scrollTo(id); return b;
      })),
    el('a', { className: 'btn', href: '#/login' }, t('home.startDiary')));

  const hero = el('section', { className: 'hero2', id: 'lp-universe' },
    el('div', { className: 'hero2-text' },
      el('p', { className: 'badge' }, icon('sparkles'), t('home.badge')),
      el('h1', {}, t('home.title')),
      el('p', { className: 'lead' }, t('home.text', { name })),
      el('div', { className: 'ctrl start' },
        el('a', { className: 'btn', href: '#/login' }, t('home.start')),
        (() => { const b = el('button', { type: 'button', className: 'ghost' }, t('home.peek')); b.onclick = () => scrollTo('lp-more'); return b; })()),
      el('p', { className: 'proof' },
        el('span', { className: 'avatars', ariaHidden: 'true' }, el('i', {}, 'A'), el('i', {}, 'M')),
        t('home.proof'))),
    el('div', { className: 'hero-art', role: 'img', ariaLabel: t('home.pipAlt') },
      el('img', { className: 'hero-book', src: 'assets/images/figma/album-cover.webp', alt: '' }),
      el('img', { className: 'hero-polaroid', src: 'assets/images/figma/polaroid-moon.webp', alt: '' }),
      el('img', { className: 'mascot hero-pip', src: 'assets/images/pip.png', alt: '' })));

  const intro = el('section', { className: 'lp-intro', id: 'lp-about' },
    el('h2', {}, t('home.intro1')), el('p', { className: 'hand' }, t('home.intro2')));

  const features = el('section', { className: 'lp-section', id: 'lp-more' },
    el('h2', {}, t('home.moreTitle')),
    el('div', { className: 'grid lp-cards' }, ...FEATURES.map(([k, ic, href]) =>
      el('article', { className: 'card lp-card' },
        el('span', { className: 'lp-ic' }, icon(ic)),
        el('h3', {}, t(`home.f.${k}`)), el('p', {}, t(`home.f.${k}.t`)),
        el('a', { href }, t('home.explore'), ' ', icon('arrow-right'))))));

  const album = el('section', { className: 'lp-split', id: 'lp-album' },
    el('div', { className: 'lp-polaroids', ariaHidden: 'true' },
      el('img', { src: 'assets/images/figma/polaroid-moon.webp', alt: '' }),
      el('img', { src: 'assets/images/figma/polaroid-home.webp', alt: '' })),
    el('div', {}, el('h2', {}, t('home.albumTitle')),
      el('ul', { className: 'lp-list' }, ...['1', '2', '3'].map((n) => el('li', {}, icon('check'), t(`home.albumP${n}`)))),
      el('a', { className: 'btn', href: '#/albums' }, t('home.albumBtn'))));

  const bestie = el('section', { className: 'lp-split rev', id: 'lp-made' },
    el('div', {}, el('h2', {}, t('home.bestieTitle')), el('p', {}, t('home.bestieText')),
      el('a', { className: 'btn', href: '#/login' }, t('home.bestieBtn'))),
    el('div', { className: 'card club', ariaHidden: 'true' },
      el('div', { className: 'avatars big' }, el('i', {}, 'A'), el('i', {}, 'M'), el('i', {}, 'N')),
      el('h3', {}, 'Moonbeam Club'), el('p', {}, t('home.clubText'))));

  const privacy = el('section', { className: 'lp-section', id: 'lp-privacy' },
    el('h2', {}, t('home.privTitle')),
    el('div', { className: 'grid lp-cards' }, ...['1', '2', '3'].map((n) =>
      el('div', { className: 'card' }, el('span', { className: 'lp-ic' }, icon(['lock-keyhole', 'user-check', 'book-heart'][n - 1])),
        el('h3', {}, t(`home.priv${n}`)), el('p', {}, t(`home.priv${n}.t`))))));

  const faq = el('section', { className: 'lp-section narrow', id: 'lp-faq' },
    el('h2', {}, t('home.faqTitle')),
    ...['1', '2', '3'].map((n) => el('details', { className: 'card faq' }, el('summary', {}, t(`home.q${n}`)), el('p', {}, t(`home.a${n}`)))));

  const closing = el('section', { className: 'lp-close' },
    el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
    el('h2', {}, t('home.closeTitle')),
    el('a', { className: 'btn', href: '#/login' }, t('home.closeBtn')));

  const langSel = el('select', { id: 'lp-lang', ariaLabel: t('set.language') },
    el('option', { value: 'en' }, 'English'), el('option', { value: 'id' }, 'Bahasa Indonesia'));
  langSel.value = getLang();
  langSel.onchange = () => setPrefs({ lang: langSel.value });
  const foot = (id, key) => { const b = el('button', { type: 'button', className: 'linklike' }, t(key)); b.onclick = () => scrollTo(id); return b; };
  const footer = el('footer', { className: 'lp-footer' },
    el('span', { className: 'logo' }, icon('sparkles', 'logo-icon'), 'orion diary'),
    el('nav', { className: 'lp-foot-links', ariaLabel: 'Footer' }, foot('lp-about', 'home.fAbout'), foot('lp-privacy', 'home.fPrivacy'), foot('lp-faq', 'home.fHelp')),
    langSel, el('small', {}, t('home.made')));

  root.append(el('div', { className: 'landing' }, topbar, hero, intro, features, album, bestie, privacy, faq, closing, footer));

  // Datang dari tautan footer di halaman lain (mis. Login): gulir ke bagian yang diminta.
  const want = sessionStorage.getItem('orion-scroll');
  if (want) { sessionStorage.removeItem('orion-scroll'); setTimeout(() => scrollTo(want), 50); }
}
