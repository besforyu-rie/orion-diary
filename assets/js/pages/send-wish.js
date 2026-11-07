// Halaman publik #/kirim: teman-teman menulis ucapan tanpa perlu akun.
import { addWish } from '../services/wishes.js';
import { CONFIG } from '../config.js';
import { showToast } from '../components/toast.js';
import { t } from '../i18n.js';
import { el } from '../utils.js';

export function renderSendWish(root) {
  const owner = CONFIG.userName;
  const name = el('input', { id: 'wish-name', maxLength: 40, required: true, autocomplete: 'name' });
  const text = el('textarea', { id: 'wish-text', maxLength: 500, required: true, rows: 6 });
  const submit = el('button', { type: 'submit' }, t('send.submit'));
  const form = el('form', { className: 'card' },
    el('div', { className: 'field' }, el('label', { htmlFor: 'wish-name' }, t('send.yourName')), name),
    el('div', { className: 'field' }, el('label', { htmlFor: 'wish-text' }, t('send.msg', { name: owner })), text),
    el('p', {}, el('small', {}, t('send.note'))),
    submit);

  form.onsubmit = async (e) => {
    e.preventDefault();
    submit.disabled = true; submit.textContent = t('send.sending');
    try {
      await addWish({ name: name.value.trim(), text: text.value.trim() });
      form.replaceWith(el('div', { className: 'empty card' },
        el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
        el('h2', {}, t('send.done')), el('p', {}, t('send.doneText', { name: owner }))));
    } catch (err) {
      console.error(err);
      showToast(t('send.err'), 'error');
      submit.disabled = false; submit.textContent = t('send.submit');
    }
  };

  root.append(el('section', { className: 'page narrow' },
    el('h1', {}, t('send.title', { name: owner })),
    el('p', {}, t('send.sub')), form));
}
