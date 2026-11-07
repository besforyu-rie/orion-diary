// Notifikasi: "Little signals from your universe". Sumber dan status baca ada di services/notifications.js.
import {
  loadNotifications, visible, isRead, isToday, markRead, markAllRead, dropFromCache, WINDOW_DAYS,
} from '../services/notifications.js';
import { declineInvite } from '../services/spaces.js';
import { showToast } from '../components/toast.js';
import { locale, t } from '../i18n.js';
import { el, icon } from '../utils.js';

const hhmm = (ts) => new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
const shortDate = (ts) => new Date(ts).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
const longDate = (ts) => new Date(ts).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });

/** Label kecil di atas judul: jam (hari ini) atau tanggal (sebelumnya), lalu jenisnya. */
const kindLabel = (n) => `${isToday(n) ? hhmm(n.at) : shortDate(n.at)} · ${t(`sig.kind.${n.type}`, n.vars).toUpperCase()}`;

function copyFor(n) {
  const v = { ...n.vars };
  switch (n.type) {
    case 'stream': return { title: t('sig.streamTitle', v), text: t('sig.streamText', v) };
    case 'bestie': return { title: t('sig.postTitle', v), text: `“${v.title}”. ${v.text}` };
    case 'bestieJoin': return { title: t('sig.joinTitle', v), text: t('sig.joinText', v) };
    case 'bestieAlbum': return { title: t(Number(v.n) === 1 ? 'sig.albumTitle1' : 'sig.albumTitleN', v), text: t('sig.albumText', v) };
    case 'wish': return { title: t('sig.wishTitle', v), text: v.text };
    case 'milestone': return { title: t('sig.streakTitle', v), text: t('sig.streakText') };
    case 'evening': return { title: t('sig.eveTitle'), text: t('sig.eveText') };
    case 'export': return { title: t('sig.exportTitle'), text: t('sig.exportText', { n: v.n, date: longDate(v.date) }) };
    default: return { title: '', text: '' };
  }
}

const unreadMark = () => el('span', { className: 'sig-dot' }, el('span', { className: 'sr-only' }, t('sig.unread')));

export async function renderNotifications(root) {
  let items = await loadNotifications(true);
  let filter = 'all';
  const page = el('section', { className: 'page sig' });
  root.append(page);

  function inviteCard(n) {
    const v = n.vars;
    const decline = el('button', { type: 'button', className: 'ghost' }, t('sig.decline'));
    const review = el('a', { className: 'btn', href: `#/join?t=${n.token}` }, icon('mail-heart'), t('sig.review'));
    review.onclick = () => markRead([n.id]);
    decline.onclick = async () => {
      decline.disabled = true;
      try {
        await declineInvite(n.token);
        markRead([n.id]); dropFromCache(n.id);
        items = items.filter((x) => x.id !== n.id);
        showToast(t('sig.declined', { space: v.space }));
        draw();
      } catch (err) { console.error(err); decline.disabled = false; showToast(t('sig.declineFail'), 'error'); }
    };
    return el('li', {}, el('article', { className: 'sig-card sig-invite', 'aria-label': t('sig.inviteTitle', v) },
      !isRead(n) ? unreadMark() : '',
      el('h3', {}, t('sig.inviteTitle', v)),
      el('p', {}, t('sig.inviteText', v)),
      v.message ? el('p', { className: 'sig-msg' }, `“${v.message}”`) : '',
      el('div', { className: 'ctrl start' }, review, decline),
      el('small', {}, t('sig.inviteMeta', { date: shortDate(n.at), exp: longDate(n.expiresAt) }))));
  }

  function plainCard(n) {
    const { title, text } = copyFor(n);
    const unread = !isRead(n);
    const card = el('a', { className: `sig-card${unread ? ' unread' : ''}`, href: n.href },
      unread ? unreadMark() : '',
      el('span', { className: 'sig-ic', 'aria-hidden': 'true' }, icon(n.icon)),
      el('div', { className: 'sig-text' }, el('small', {}, kindLabel(n)), el('h3', {}, title), text ? el('p', {}, text) : ''));
    card.onclick = () => markRead([n.id]);
    return el('li', {}, card);
  }

  function group(title, list) {
    if (!list.length) return '';
    return el('div', { className: 'sig-group' },
      el('h2', {}, title),
      el('ul', { className: 'sig-list' }, ...list.map((n) => (n.type === 'invite' ? inviteCard(n) : plainCard(n)))));
  }

  function sidePanel() {
    const go = el('a', { className: 'btn ghost', href: '#/settings?s=notifications' }, t('sig.settings'));
    return el('aside', { className: 'sig-side' }, el('div', { className: 'card' },
      el('h2', {}, t('sig.quietTitle')), el('span', { className: 'sig-moon', 'aria-hidden': 'true' }, icon('moon')),
      el('p', {}, t('sig.quietText', { days: WINDOW_DAYS })), go));
  }

  function draw() {
    const all = visible(items);
    const unread = all.filter((n) => !isRead(n));
    const shown = filter === 'unread' ? unread : all;
    const chip = (key, label) => {
      const b = el('button', { type: 'button', className: 'ghost' }, label);
      b.setAttribute('aria-pressed', String(filter === key));
      b.onclick = () => { filter = key; draw(); };
      return b;
    };
    const readAll = el('button', { type: 'button', className: 'ghost', disabled: unread.length === 0 }, t('sig.markAll'));
    readAll.onclick = () => { markAllRead(all); showToast(t('sig.allRead')); draw(); };

    const empty = !shown.length && el('div', { className: 'card sig-empty' },
      el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
      el('h2', {}, filter === 'unread' && all.length ? t('sig.noUnread') : t('sig.emptyTitle')),
      el('p', {}, filter === 'unread' && all.length ? t('sig.noUnreadText') : t('sig.emptyText')));

    page.replaceChildren(
      el('h1', {}, t('sig.title')),
      el('p', { className: 'tl-sub', role: 'status' }, `${unread.length ? t('sig.unreadN', { n: unread.length }) : t('sig.caughtUp')} · ${t('sig.sub')}`),
      el('div', { className: 'tl-tabs', role: 'group', 'aria-label': t('sig.filters') },
        chip('all', t('sig.all', { n: all.length })), chip('unread', t('sig.unreadChip', { n: unread.length })), readAll),
      el('div', { className: 'sig-layout' },
        el('div', {}, empty || '',
          group(t('sig.today'), shown.filter(isToday)),
          group(t('sig.earlier'), shown.filter((n) => !isToday(n)))),
        sidePanel()));
  }

  draw();
}
