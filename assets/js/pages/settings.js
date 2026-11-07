import { getUser, logout, resetPassword, authMessage } from '../services/auth.js';
import { getPrefs, setPrefs } from '../services/prefs.js';
import { exportMonths, exportDiary } from '../services/export-pdf.js';
import { invalidate } from '../services/notifications.js';
import { deleteMyAccount, needsFreshLogin } from '../services/account.js';
import { makeDialog } from '../components/dialog.js';
import { showToast } from '../components/toast.js';
import { CONFIG } from '../config.js';
import { getLang, t } from '../i18n.js';
import { el, formatDate, icon } from '../utils.js';

/** Baris pengaturan on/off yang langsung tersimpan. */
function switchRow(key, label, hint, after) {
  const input = el('input', { type: 'checkbox', id: `pref-${key}`, checked: getPrefs()[key] });
  input.setAttribute('role', 'switch');
  input.onchange = () => { setPrefs({ [key]: input.checked }); after?.(); };
  return el('div', { className: 'setting' },
    el('label', { htmlFor: input.id }, label, hint ? el('small', {}, hint) : ''), input);
}

/** Kelompok tombol pilih-satu (bahasa, tema). */
function choice(items, current, onPick, className = 'ghost') {
  const buttons = items.map(({ value, label }) => {
    const b = el('button', { type: 'button', className }, label);
    b.dataset.value = value;
    b.onclick = () => { onPick(value); buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); };
    b.setAttribute('aria-pressed', String(value === current));
    return b;
  });
  return buttons;
}

function profileCard(user) {
  const prefs = getPrefs();
  const name = el('input', { id: 'display-name', value: prefs.displayName, maxLength: 40, required: true, placeholder: t('ob.namePh') });
  const diary = el('input', { id: 'diary-name', value: prefs.diaryName, maxLength: 60, placeholder: t('set.diaryPh') });
  const nameError = el('p', { role: 'alert', className: 'form-error' });
  const form = el('form', { noValidate: true },
    el('div', { className: 'identity' },
      el('div', { className: 'avatar', ariaHidden: 'true' }, (name.value[0] ?? '✦').toUpperCase()),
      el('div', {}, el('strong', {}, name.value), el('small', {}, `${user.email} · ${t('set.joined', { date: formatDate(user.metadata.creationTime) })}`))),
    el('div', { className: 'field-row' },
      el('div', { className: 'field' }, el('label', { htmlFor: 'display-name' }, t('set.displayName')), name, nameError),
      el('div', { className: 'field' }, el('label', { htmlFor: 'diary-name' }, t('set.diaryName')), diary)),
    el('button', {}, t('set.saveProfile')));
  form.onsubmit = (e) => {
    e.preventDefault();
    if (!name.value.trim()) { nameError.textContent = t('name.required'); name.focus(); return; }
    nameError.textContent = '';
    setPrefs({ displayName: name.value.trim(), diaryName: diary.value.trim() });
    showToast(t('set.profileSaved'));
  };
  return el('div', { className: 'card', id: 'set-profile' }, el('h2', {}, t('set.identity')), form);
}

function themeTile(value, label, current) {
  const tile = el('button', { type: 'button', className: `theme-tile ${value}` },
    el('span', { className: 'swatch', ariaHidden: 'true' }, el('i'), el('b')), label);
  tile.dataset.value = value;
  tile.setAttribute('aria-pressed', String(value === current));
  return tile;
}

function appearanceCard() {
  const prefs = getPrefs();
  const langs = choice([{ value: 'en', label: 'English' }, { value: 'id', label: 'Bahasa Indonesia' }], getLang(), (value) => setPrefs({ lang: value }));
  langs.forEach((b) => { if (b.dataset.value === getLang()) b.textContent += ' ✓'; });

  const tiles = [['dark', t('set.dark')], ['light', t('set.light')], ['system', t('set.system')]].map(([v, l]) => themeTile(v, l, prefs.theme));
  tiles.forEach((tile) => {
    tile.onclick = () => { setPrefs({ theme: tile.dataset.value }); tiles.forEach((x) => x.setAttribute('aria-pressed', String(x === tile))); };
  });

  return el('div', { className: 'card', id: 'set-appearance' }, el('h2', {}, t('set.langTitle')),
    el('div', { className: 'field' }, el('span', { className: 'label' }, t('set.language')), el('div', { className: 'ctrl start' }, ...langs),
      el('small', {}, t('set.langNote'))),
    el('div', { className: 'field' }, el('span', { className: 'label' }, t('set.theme')), el('div', { className: 'themes' }, ...tiles)),
    switchRow('reduceMotion', t('set.reduce'), t('set.reduceHint')),
    switchRow('flipSound', t('set.flip'), t('set.flipHint')));
}

function privacyCard() {
  const manage = el('a', { className: 'btn ghost', href: '#/bestie' }, icon('lock-keyhole'), t('set.privManage'));
  return el('div', { className: 'card', id: 'set-privacy' }, el('h2', {}, t('set.privTitle')),
    switchRow('newPrivate', t('set.privNew'), t('set.privNewHint')),
    switchRow('allowInvites', t('set.privInvites'), t('set.privInvitesHint'), invalidate),
    el('p', {}, el('small', {}, t('set.privNote'))), el('div', { className: 'ctrl start' }, manage));
}

function notifCard() {
  return el('div', { className: 'card', id: 'set-notifications' }, el('h2', {}, t('set.notifTitle')), el('p', {}, t('set.notifText')),
    switchRow('notifStream', t('set.notifStream'), t('set.notifStreamHint')),
    switchRow('notifBestie', t('set.notifBestie'), t('set.notifBestieHint')),
    switchRow('notifNudge', t('set.notifNudge'), t('set.notifNudgeHint')));
}

async function exportCard() {
  const months = await exportMonths();
  const month = el('select', { id: 'exp-month', ariaLabel: t('exp.month') },
    el('option', { value: 'all' }, t('exp.all')), ...months.map((m) => el('option', { value: m.value }, m.label)));
  const scope = el('select', { id: 'exp-scope', ariaLabel: t('exp.scope') },
    el('option', { value: 'all' }, t('exp.scopeAll')), el('option', { value: 'private' }, t('exp.scopePrivate')), el('option', { value: 'shared' }, t('exp.scopeShared')));
  const button = el('button', {}, icon('download'), t('exp.button'));
  const last = getPrefs().lastExport;
  const lastNote = el('small', {}, last ? t('exp.last', { date: formatDate(last.at), n: last.n }) : '');

  button.onclick = async () => {
    button.disabled = true;
    try {
      const n = await exportDiary({ month: month.value, scope: scope.value });
      if (!n) showToast(t('exp.empty'), 'error');
      else { const l = getPrefs().lastExport; lastNote.textContent = t('exp.last', { date: formatDate(l.at), n: l.n }); }
    } catch (err) { console.error(err); showToast(t('exp.failed'), 'error'); }
    button.disabled = false;
  };

  return el('div', { className: 'card', id: 'set-export' }, el('h2', {}, t('exp.title')), el('p', {}, t('exp.text')),
    el('div', { className: 'ctrl start' }, month, scope), el('div', { className: 'ctrl start', style: 'margin-top:12px' }, button),
    lastNote, el('small', {}, t('exp.note')));
}

function deleteDialog(user) {
  const word = t('set.delWord');
  const typed = el('input', { autocomplete: 'off', autocapitalize: 'characters', spellcheck: false });
  const error = el('p', { role: 'alert', className: 'form-error' });
  const go = el('button', { type: 'button', className: 'danger', disabled: true }, t('set.delGo'));
  const cancel = el('button', { type: 'button', className: 'ghost' }, t('sp.close'));
  const fresh = needsFreshLogin();
  const dialog = makeDialog('', t('set.delTitle'),
    el('h2', {}, t('set.delTitle')),
    el('p', { className: 'hint-text' }, t('set.delText')),
    el('ul', { className: 'del-list' }, ...['set.del1', 'set.del2', 'set.del3', 'set.del4'].map((k) => el('li', {}, t(k)))),
    fresh ? el('p', { role: 'status', className: 'form-error' }, t('set.delFresh')) : '',
    el('div', { className: 'field' }, el('label', { htmlFor: 'del-confirm' }, t('set.delType', { word })), typed),
    error, el('div', { className: 'actions' }, cancel, go));
  typed.id = 'del-confirm';
  dialog.querySelector('label').htmlFor = 'del-confirm';
  typed.oninput = () => { go.disabled = fresh || typed.value.trim().toUpperCase() !== word; };
  cancel.onclick = () => dialog.close();
  go.onclick = async () => {
    go.disabled = true; cancel.disabled = true; error.textContent = t('set.delWorking');
    try {
      await deleteMyAccount();
      dialog.close();
      location.hash = '#/';
      showToast(t('set.delDone'));
    } catch (err) {
      console.error(err);
      error.textContent = err?.code === 'needs-fresh-login' || err?.code === 'auth/requires-recent-login' ? t('set.delFresh') : `${t('set.delFail')} (${err?.code ?? err?.message ?? '?'})`;
      cancel.disabled = false;
    }
  };
}

function accountCard(user) {
  const reset = el('button', { className: 'ghost' }, t('set.changePw'));
  reset.onclick = async () => {
    reset.disabled = true;
    try { await resetPassword(user.email); showToast(t('set.pwSent', { email: user.email })); }
    catch (err) { showToast(authMessage(err), 'error'); }
    reset.disabled = false;
  };
  const replay = el('a', { className: 'btn ghost', href: '#/welcome' }, t('set.replay'));
  const out = el('button', { className: 'ghost' }, t('nav.logout'));
  out.onclick = async () => { await logout(); showToast(t('common.bye')); location.hash = '#/'; };
  const del = el('button', { type: 'button', className: 'link-danger' }, t('set.delLink'));
  del.onclick = () => deleteDialog(user);
  return el('div', { className: 'card', id: 'set-account' }, el('h2', {}, t('set.account')),
    switchRow('eveningReminder', t('set.eve'), t('set.eveHint'), invalidate),
    el('p', {}, el('small', {}, t('set.accountText'))), el('div', { className: 'ctrl start' }, reset, out),
    el('p', {}, el('small', {}, t('set.replayText'))), el('div', { className: 'ctrl start' }, replay),
    el('p', { className: 'del-row' }, del, el('small', {}, ` → ${t('set.delNeeds')}`)));
}

const SECTIONS = [['profile', 'set.navProfile'], ['appearance', 'set.langTitle'], ['privacy', 'set.privTitleNav'], ['notifications', 'set.notifTitle'], ['export', 'set.navExport']];

export async function renderSettings(root, params) {
  const user = getUser();
  const cards = el('div', { className: 'set-cards' },
    profileCard(user), appearanceCard(), privacyCard(), notifCard(), await exportCard(), accountCard(user));
  const links = SECTIONS.map(([key, label]) => {
    const a = el('a', { className: 'btn ghost', href: `#/settings?s=${key}` }, t(label));
    a.dataset.section = key;
    a.onclick = (e) => { e.preventDefault(); go(key); };
    return a;
  });
  const mark = (key) => links.forEach((a) => (a.dataset.section === key ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  function go(key) {
    const card = document.getElementById(`set-${key}`);
    if (!card) return;
    mark(key);
    card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    card.querySelector('input, button, a')?.focus({ preventScroll: true });
  }
  root.append(el('section', { className: 'page wide settings' },
    el('h1', {}, t('set.title')), el('p', { className: 'tl-sub' }, t('set.sub')),
    el('div', { className: 'set-layout' }, el('nav', { className: 'set-nav', 'aria-label': t('set.navLabel') }, ...links), cards)));
  const first = params?.get('s');
  mark(SECTIONS.some(([k]) => k === first) ? first : 'profile');
  if (first) requestAnimationFrame(() => setTimeout(() => go(first), 0)); // dari tombol "Pengaturan notifikasi" dan sejenisnya
}
