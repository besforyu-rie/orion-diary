// Onboarding (#/welcome): 3 langkah mengikuti desain Figma.
// 01 Welcome -> 02 Your universe (nama, bahasa, inspirasi) -> 03 Ready to glow (privasi) -> Dashboard.
import { getPrefs, setPrefs } from '../services/prefs.js';
import { showToast } from '../components/toast.js';
import { getLang, t } from '../i18n.js';
import { el, icon } from '../utils.js';

const INTERESTS = [['cozy', 'ob.i.cozy'], ['photo', 'ob.i.photo'], ['joys', 'ob.i.joys'], ['music', 'ob.i.music'], ['art', 'ob.i.art']];

// Disimpan di modul supaya ganti bahasa (yang menggambar ulang halaman) tidak mengulang dari langkah 1.
let draft = null;
const fresh = () => {
  const p = getPrefs();
  return { step: 1, name: p.displayName, diary: p.diaryName, interests: [...p.interests] };
};

const finish = () => { draft = null; };
const who = () => draft.name.trim() || t('name.fallback');

export function renderWelcome(root) {
  draft ??= fresh();
  const page = el('section', { className: 'page wide onboarding' });
  root.append(page);

  const done = (message) => {
    setPrefs({ onboarded: true });
    finish();
    if (message) showToast(message);
    const back = sessionStorage.getItem('orion-after-welcome');
    sessionStorage.removeItem('orion-after-welcome');
    location.hash = back || '#/dashboard';
  };

  const progress = () => el('div', { className: 'steps', role: 'group', ariaLabel: t('ob.progress', { n: draft.step }) },
    ...[1, 2, 3].map((n) => el('div', { className: `step${n <= draft.step ? ' on' : ''}`, ariaCurrent: n === draft.step ? 'step' : 'false' },
      el('span', { className: 'bar', ariaHidden: 'true' }), el('b', {}, t(`ob.s${n}`)))));

  const pip = (text) => el('div', { className: 'pip-say' },
    el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }), el('p', { className: 'hand' }, text));

  function stepOne() {
    const begin = el('button', {}, t('ob.begin')); begin.onclick = () => { draft.step = 2; draw(); };
    const skip = el('button', { className: 'ghost' }, t('ob.skip')); skip.onclick = () => done();
    return el('div', { className: 'ob-grid' },
      el('div', {}, el('p', { className: 'eyebrow' }, t('ob.step', { n: 1 })), el('h1', {}, t('ob.t1', { name: who() })),
        el('p', {}, t('ob.p1')), pip(t('ob.pip1', { name: who() })),
        el('div', { className: 'ctrl start' }, begin, skip)));
  }

  function stepTwo() {
    const nameError = el('p', { role: 'alert', className: 'form-error' });
    const name = el('input', { id: 'ob-name', value: draft.name, maxLength: 40, autocomplete: 'nickname', required: true, placeholder: t('ob.namePh') });
    name.oninput = () => { draft.name = name.value; if (name.value.trim()) nameError.textContent = ''; };
    const diary = el('input', { id: 'ob-diary', value: draft.diary, maxLength: 60, placeholder: draft.name.trim() ? `${draft.name.trim()}'s little orbit` : t('set.diaryPh') });
    diary.oninput = () => { draft.diary = diary.value; };

    const langs = [['en', 'English'], ['id', 'Bahasa Indonesia']].map(([value, label]) => {
      const on = getLang() === value;
      const b = el('button', { type: 'button', className: 'ghost' }, on ? `${label} ✓` : label);
      b.setAttribute('aria-pressed', String(on));
      b.onclick = () => setPrefs({ lang: value }); // memicu gambar ulang lewat 'langchange'
      return b;
    });
    const chips = INTERESTS.map(([value, key]) => {
      const on = draft.interests.includes(value);
      const b = el('button', { type: 'button', className: 'ghost' }, on ? `${t(key)} ✓` : t(key));
      b.setAttribute('aria-pressed', String(on));
      b.onclick = () => {
        draft.interests = on ? draft.interests.filter((v) => v !== value) : [...draft.interests, value];
        draw();
      };
      return b;
    });

    const next = el('button', { type: 'submit' }, icon('sparkles'), t('ob.makeMine'));
    const back = el('button', { type: 'button', className: 'ghost' }, t('common.back')); back.onclick = () => { draft.step = 1; draw(); };
    const form = el('form', { className: 'card', noValidate: true },
      el('h2', {}, t('ob.cardTitle')),
      el('div', { className: 'field' }, el('label', { htmlFor: 'ob-name' }, t('ob.callYou')), name, el('small', {}, t('ob.callHint')), nameError),
      el('div', { className: 'field' }, el('label', { htmlFor: 'ob-diary' }, t('set.diaryName')), diary),
      el('div', { className: 'field' }, el('span', { className: 'label' }, t('set.language')), el('div', { className: 'ctrl start' }, ...langs)),
      el('div', { className: 'field' }, el('span', { className: 'label' }, t('ob.insp')), el('div', { className: 'ctrl start' }, ...chips)),
      el('p', {}, el('small', {}, t('ob.private'))),
      el('div', { className: 'ctrl start' }, next, back));
    form.onsubmit = (e) => {
      e.preventDefault();
      draft.name = draft.name.trim();
      if (!draft.name) { nameError.textContent = t('name.required'); name.focus(); return; }
      draft.step = 3; draw();
    };

    return el('div', { className: 'ob-grid' },
      el('div', {}, el('p', { className: 'eyebrow' }, t('ob.step', { n: 2 })), el('h1', {}, t('ob.t2')),
        el('p', {}, t('ob.p2')), pip(t('ob.pip1', { name: who() }))),
      form);
  }

  function stepThree() {
    const go = el('button', {}, t('ob.finish'));
    go.onclick = () => {
      setPrefs({ displayName: draft.name.trim(), diaryName: draft.diary.trim(), interests: draft.interests });
      done(t('ob.welcome', { name: who() }));
    };
    const back = el('button', { className: 'ghost' }, t('common.back')); back.onclick = () => { draft.step = 2; draw(); };
    return el('div', { className: 'ob-grid' },
      el('div', {}, el('p', { className: 'eyebrow' }, t('ob.step', { n: 3 })), el('h1', {}, t('ob.t3')), el('p', {}, t('ob.p3')),
        el('ul', { className: 'ob-list' }, ...['ob.b1', 'ob.b2', 'ob.b3'].map((k) => el('li', {}, t(k)))),
        el('div', { className: 'ctrl start' }, go, back)),
      el('div', { className: 'card lock', ariaHidden: 'true' }, el('div', { className: 'lock-icon' }, icon('lock-keyhole')), el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' })));
  }

  function draw() {
    page.replaceChildren(progress(), [stepOne, stepTwo, stepThree][draft.step - 1]());
    page.querySelector('h1')?.setAttribute('tabindex', '-1');
    page.querySelector('h1')?.focus({ preventScroll: true });
  }
  draw();
}
