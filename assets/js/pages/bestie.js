// Bestie Space (#/bestie): inbox ucapan teman. Hanya pemilik yang bisa membalas dan memilih apa yang tampil.
import { listAllWishes, updateWish, removeWish } from '../services/wishes.js';
import { showToast } from '../components/toast.js';
import { markWishesSeen } from '../services/notifications.js';
import { CONFIG } from '../config.js';
import { t } from '../i18n.js';
import { el, formatDate } from '../utils.js';

// Selalu tautan GitHub Pages, bukan alamat tempat halaman ini sedang dibuka (mis. localhost).
const shareLink = () => CONFIG.shareUrl;

function wishCard(wish, onRemoved) {
  const reply = el('textarea', { id: `reply-${wish.id}`, maxLength: 500, rows: 3, value: wish.reply ?? '' });
  const save = el('button', {}, t('bestie.saveReply'));
  const shared = el('input', { type: 'checkbox', id: `shared-${wish.id}`, checked: !!wish.shared });
  shared.setAttribute('role', 'switch');

  const run = async (patch, message) => {
    try { await updateWish(wish.id, patch); showToast(message); }
    catch (err) { console.error(err); showToast(t('bestie.notSaved'), 'error'); }
  };
  save.onclick = () => run({ reply: reply.value.trim() }, t('bestie.replySaved'));
  shared.onchange = () => run({ shared: shared.checked }, shared.checked ? t('bestie.onWall') : t('bestie.offWall'));

  const del = el('button', { className: 'ghost' }, t('common.delete'));
  del.onclick = async () => {
    if (!confirm(t('bestie.confirmDel', { name: wish.name }))) return;
    try { await removeWish(wish.id); onRemoved(); showToast(t('bestie.deleted')); }
    catch (err) { console.error(err); showToast(t('bestie.delFail'), 'error'); }
  };

  return el('article', { className: 'card' },
    el('h3', {}, wish.name), el('time', {}, formatDate(wish.createdAt)), el('p', {}, wish.text),
    el('div', { className: 'field' }, el('label', { htmlFor: reply.id }, t('bestie.reply')), reply),
    el('div', { className: 'setting' },
      el('label', { htmlFor: shared.id }, t('bestie.showWall'), el('small', {}, t('bestie.showHint'))), shared),
    el('div', { className: 'ctrl start' }, save, del));
}

export async function renderBestie(root) {
  let wishes;
  try {
    wishes = await listAllWishes();
  } catch (err) {
    if (err?.code !== 'permission-denied') throw err; // galat lain tetap ditangani router
    // Akun selain pemilik diary tidak boleh membaca inbox: tampilkan halaman ramah, bukan galat koneksi.
    return root.append(el('section', { className: 'page empty' },
      el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
      el('h1', {}, t('bestie.guestTitle')), el('p', {}, t('bestie.guestText')),
      el('a', { className: 'btn', href: '#/kirim' }, t('bestie.guestCta'))));
  }
  markWishesSeen(wishes.length); // inbox dibuka: titik di lonceng hilang
  const list = el('div', { className: 'stack' });
  const draw = () => {
    list.replaceChildren(...(wishes.length
      ? wishes.map((w) => wishCard(w, () => { wishes.splice(wishes.indexOf(w), 1); draw(); }))
      : [el('div', { className: 'empty' }, el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
          el('p', {}, t('bestie.empty')))]));
  };

  const copy = el('button', { className: 'ghost' }, t('bestie.copy'));
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(shareLink()); showToast(t('bestie.copied')); }
    catch { showToast(t('bestie.copyFail'), 'error'); }
  };
  const link = el('input', { value: shareLink(), readOnly: true, ariaLabel: t('bestie.linkTitle') });

  root.append(el('section', { className: 'page' },
    el('h1', {}, t('bestie.title')),
    el('p', {}, t('bestie.count', { n: wishes.length })),
    el('div', { className: 'card' }, el('h3', {}, t('bestie.linkTitle')),
      el('p', {}, t('bestie.linkText')),
      el('div', { className: 'wish-form' }, link, copy),
      el('p', {}, el('a', { href: '#/dinding' }, t('bestie.viewWall')))),
    el('div', { style: 'height:16px' }), list));
  draw();
}
