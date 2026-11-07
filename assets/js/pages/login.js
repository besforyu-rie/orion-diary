import { login, register, authMessage } from '../services/auth.js';
import { el } from '../utils.js';

export function renderLogin(root) {
  let isRegister = false;
  const email = el('input', { id: 'email', type: 'email', required: true, autocomplete: 'email' });
  const password = el('input', { id: 'password', type: 'password', required: true, minLength: 6, autocomplete: 'current-password' });
  const error = el('p', { role: 'alert', style: 'color:var(--pink);min-height:1.4em' });
  const submit = el('button', { type: 'submit' });
  const toggle = el('button', { type: 'button', className: 'ghost' });
  const heading = el('h1');

  function refresh() {
    heading.textContent = isRegister ? 'Buat diary-mu ✦' : 'Your universe missed you.';
    submit.textContent = isRegister ? 'Daftar' : 'Masuk';
    toggle.textContent = isRegister ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar';
    password.autocomplete = isRegister ? 'new-password' : 'current-password';
  }
  toggle.onclick = () => { isRegister = !isRegister; error.textContent = ''; refresh(); };

  const form = el('form', { className: 'card', style: 'max-width:420px' },
    el('div', { className: 'field' }, el('label', { htmlFor: 'email' }, 'Email'), email),
    el('div', { className: 'field' }, el('label', { htmlFor: 'password' }, 'Password'), password),
    error, submit, ' ', toggle);

  form.onsubmit = async (e) => {
    e.preventDefault();
    submit.disabled = true; error.textContent = '';
    try {
      await (isRegister ? register : login)(email.value.trim(), password.value);
      location.hash = '#/dashboard';
    } catch (err) {
      error.textContent = authMessage(err);
    } finally {
      submit.disabled = false;
    }
  };

  refresh();
  root.append(el('section', { className: 'page' }, heading, form));
}
