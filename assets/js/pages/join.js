// Halaman undangan (#/join?t=TOKEN): sahabat melihat ruangnya dulu, lalu memilih bergabung atau tidak.
import { getInvite, acceptInvite } from '../services/spaces.js';
import { getUser } from '../services/auth.js';
import { getPrefs } from '../services/prefs.js';
import { showToast } from '../components/toast.js';
import { field } from '../components/dialog.js';
import { t } from '../i18n.js';
import { el } from '../utils.js';

const note = (title, text, withLink = true) => el('section', { className: 'page empty' },
  el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
  el('h1', {}, title), ...(text ? [el('p', {}, text)] : []),
  ...(withLink ? [el('a', { className: 'btn', href: '#/dashboard' }, t('nav.dashboard'))] : []));

export async function renderJoin(root, params) {
  const token = params.get('t') ?? '';
  let invite = null;
  try { invite = token ? await getInvite(token) : null; } catch (err) { console.error(err); }

  if (!invite) return root.append(note(t('sp.invBad')));
  if (invite.status === 'accepted') return root.append(note(t('sp.invUsed'), invite.acceptedBy === getUser().uid ? t('sp.invMine') : '', false), el('p', { className: 'tl-none' }, el('a', { href: '#/bestie' }, t('nav.bestie'))));
  if (invite.status !== 'pending' || invite.expiresAt < Date.now()) return root.append(note(t('sp.invExpired')));
  const email = (getUser().email ?? '').toLowerCase();
  if (email !== invite.email) return root.append(note(t('sp.invEmail', { email: invite.email })));
  if (getPrefs().allowInvites === false) return root.append(note(t('sp.invOff'), t('sp.invOffText'), false), el('p', { className: 'tl-none' }, el('a', { href: '#/settings?s=privacy' }, t('set.privTitle'))));

  const name = el('input', { maxLength: 40, autocomplete: 'nickname', required: true, value: getPrefs().displayName, placeholder: t('ob.namePh') });
  const error = el('p', { role: 'alert', className: 'form-error' });
  const join = el('button', { type: 'submit' }, t('sp.join'));
  const later = el('a', { className: 'btn ghost', href: '#/dashboard' }, t('sp.notNow'));
  const form = el('form', { className: 'card sp-create', noValidate: true },
    el('div', { className: 'sp-envelope' },
      el('p', { className: 'hand' }, t('sp.joinTitle', { name: invite.inviterName })),
      el('p', {}, invite.message || t('sp.msgDefault')),
      el('small', {}, t('sp.joinSpace', { space: invite.spaceName }))),
    field(t('sp.joinYourName'), name), el('p', { className: 'sp-note-small' }, t('sp.joinPrivacy')),
    error, el('div', { className: 'ctrl start' }, join, later));
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!name.value.trim()) { error.textContent = t('name.required'); name.focus(); return; }
    join.disabled = true; error.textContent = '';
    try {
      await acceptInvite(invite, name.value.trim());
      showToast(t('sp.joined', { space: invite.spaceName }));
      location.hash = '#/bestie';
    } catch (err) {
      console.error(err);
      error.textContent = `${t('sp.joinFail')} (${err?.code ?? err?.message ?? '?'})`;
      join.disabled = false;
    }
  };
  root.append(el('section', { className: 'page' }, el('h1', {}, t('sp.joinHeading')), form));
}
