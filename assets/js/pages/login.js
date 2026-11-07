// Login (A2): dua kolom mengikuti Figma. Email/password, lupa password, dan Google.
import { login, register, loginWithGoogle, resetPassword, authMessage, getUser } from '../services/auth.js';
import { syncPrefsFor, prefsStatus } from '../services/prefs-sync.js';
import { getPrefs, setPrefs } from '../services/prefs.js';
import { getLang, t } from '../i18n.js';
import { el, icon } from '../utils.js';

export function renderLogin(root) {
  let isRegister = false;
  const email = el('input', { id: 'email', type: 'email', required: true, autocomplete: 'email' });
  const password = el('input', { id: 'password', type: 'password', required: true, minLength: 6, autocomplete: 'current-password' });
  const error = el('p', { role: 'alert', style: 'color:var(--pink);min-height:1.4em;margin:0 0 6px' });
  const info = el('p', { role: 'status', className: 'form-info' });
  const submit = el('button', { type: 'submit', className: 'wide' });
  const toggle = el('button', { type: 'button', className: 'linkbtn' });
  const heading = el('h1');
  const forgot = el('button', { type: 'button', className: 'linkbtn' }, t('login.forgot'));
  const google = el('button', { type: 'button', className: 'ghost wide' }, t('login.google'));
  const busy = (on) => { submit.disabled = on; google.disabled = on; };

  function refresh() {
    heading.textContent = isRegister ? t('login.register') : t('login.title');
    submit.textContent = isRegister ? t('login.signUp') : t('login.signIn');
    toggle.textContent = isRegister ? t('login.toLogin') : `${t('login.newHere')} ${t('login.create')}`;
    password.autocomplete = isRegister ? 'new-password' : 'current-password';
    forgot.hidden = isRegister;
  }
  toggle.onclick = () => { isRegister = !isRegister; error.textContent = ''; info.textContent = ''; refresh(); };

  // Setelah masuk: akun baru berkenalan dulu (onboarding), lainnya langsung ke Dashboard.
  async function afterAuth(isNew) {
    await syncPrefsFor(getUser()); // pakai nama & pengaturan akun ini, bukan akun sebelumnya
    // Kalau pengaturan akun gagal dimuat (mis. sinyal putus), jangan memaksa pengaturan ulang.
    const needsIntro = isNew || (prefsStatus() === 'new' && !getPrefs().onboarded);
    const back = sessionStorage.getItem('orion-after-login');
    sessionStorage.removeItem('orion-after-login');
    if (needsIntro) { if (back) sessionStorage.setItem('orion-after-welcome', back); location.hash = '#/welcome'; }
    else location.hash = back || '#/dashboard';
  }

  const form = el('form', { className: 'card login-card' },
    heading, el('p', { className: 'sub' }, t('login.card')),
    el('div', { className: 'field' }, el('label', { htmlFor: 'email' }, t('login.email')), email),
    el('div', { className: 'field' }, el('label', { htmlFor: 'password' }, t('login.password')), password, forgot),
    error, info, submit,
    el('div', { className: 'login-or', ariaHidden: 'true' }, t('login.or')), google,
    el('p', { className: 'login-note' }, t('login.consent')),
    el('div', { className: 'login-foot' }, toggle));

  form.onsubmit = async (e) => {
    e.preventDefault();
    busy(true); error.textContent = ''; info.textContent = '';
    try {
      await (isRegister ? register : login)(email.value.trim(), password.value);
      await afterAuth(isRegister);
    } catch (err) { error.textContent = authMessage(err); } finally { busy(false); }
  };

  forgot.onclick = async () => {
    error.textContent = ''; info.textContent = '';
    if (!email.value.trim()) { error.textContent = t('login.resetNeedEmail'); email.focus(); return; }
    try { await resetPassword(email.value.trim()); info.textContent = t('login.resetSent'); }
    catch (err) { error.textContent = authMessage(err); }
  };

  google.onclick = async () => {
    busy(true); error.textContent = ''; info.textContent = '';
    try { const { isNew } = await loginWithGoogle(); await afterAuth(isNew); }
    catch (err) { if (err.code !== 'auth/cancelled-popup-request') error.textContent = authMessage(err); }
    finally { busy(false); }
  };

  // Footer kecil: bahasa, privasi, bantuan (keduanya membuka bagian Beranda).
  const lang = (v, label) => {
    const b = el('button', { type: 'button', className: 'linkbtn' }, label);
    b.setAttribute('aria-pressed', String(getLang() === v));
    if (getLang() === v) b.style.textDecoration = 'none';
    b.onclick = () => setPrefs({ lang: v });
    return b;
  };
  const toHome = (id, key) => {
    const b = el('button', { type: 'button', className: 'linkbtn' }, t(key));
    b.onclick = () => { sessionStorage.setItem('orion-scroll', id); location.hash = '#/'; };
    return b;
  };
  const foot = el('div', { className: 'login-foot' }, lang('en', 'English'), lang('id', 'Bahasa Indonesia'), toHome('lp-privacy', 'login.privacy'), toHome('lp-faq', 'login.help'));

  refresh();
  root.append(el('section', { className: 'login-wrap' },
    el('div', { className: 'login-left' },
      el('div', { className: 'login-art' },
        el('img', { className: 'login-polaroid', src: 'assets/images/figma/polaroid-home.webp', alt: '' }),
        el('img', { className: 'mascot login-pip', src: 'assets/images/pip.png', alt: '' })),
      el('p', { className: 'hand' }, t('login.hand')),
      el('a', { href: '#/' }, icon('arrow-left'), ' ', t('login.back'))),
    el('div', {}, form, foot)));
}
