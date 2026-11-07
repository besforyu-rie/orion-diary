// Bestie Space (#/bestie): ruang bersama untuk cerita, mengikuti desain Figma "Moonbeam Club".
// Kotak ucapan ulang tahun (Kirim, Inbox, Dinding) tetap terpisah; inbox-nya ada di #/ucapan.
import {
  loadMySpace, createSpace, updateSpace, addPost, deletePost, setHeart, listNotes, addNote, deleteNote,
  createInvite, listPendingInvites, cancelInvite, inviteLink, INVITE_DAYS, MAX_POST_CHARS, MAX_NOTE_CHARS,
  createSharedAlbum, listRecentSharedPhotos, memberLabel,
} from '../services/spaces.js';
import { pageCount, STAR_SVG } from '../components/album-book.js';
import { getUser } from '../services/auth.js';
import { getPrefs } from '../services/prefs.js';
import { showToast } from '../components/toast.js';
import { field, makeDialog } from '../components/dialog.js';
import { CONFIG } from '../config.js';
import { locale, t } from '../i18n.js';
import { el, formatDate, icon } from '../utils.js';

const MOODS = [['😊', 'Happy'], ['🌙', 'Cozy'], ['🤩', 'Excited'], ['🥺', 'Low']];
const myName = () => getPrefs().displayName || (getUser().email ?? '').split('@')[0] || t('name.fallback');
const errCode = (err) => err?.code ?? err?.message ?? '?';
const avatar = (name, i) => el('span', { className: `sp-avatar c${i % 2}`, title: name, 'aria-label': name }, (name[0] ?? '✦').toUpperCase());
const when = (ts) => {
  const d = new Date(ts), now = new Date();
  const time = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === now.toDateString() ? t('sp.today', { time }) : `${formatDate(ts)} · ${time}`;
};

export async function renderSpace(root, params) {
  let space;
  try {
    space = await loadMySpace();
  } catch (err) {
    if (err?.code !== 'permission-denied') throw err;
    return root.append(el('section', { className: 'page empty' },
      el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
      el('h1', {}, t('sp.rulesTitle')), el('p', {}, t('sp.rulesText'))));
  }
  const page = el('section', { className: 'page wide sp-page' });
  root.append(page);
  let tab = params?.get('tab') === 'album' ? 'album' : 'diary';

  async function reload() {
    space = await loadMySpace();
    draw();
  }

  /* ---------- belum punya ruang: buat dulu ---------- */
  function drawCreate() {
    const name = el('input', { maxLength: 60, autocomplete: 'off', required: true, placeholder: t('sp.fNamePh') });
    const tagline = el('input', { maxLength: 80, autocomplete: 'off' });
    const error = el('p', { role: 'alert', className: 'form-error' });
    const submit = el('button', { type: 'submit' }, t('sp.create'));
    const form = el('form', { className: 'card sp-create', noValidate: true },
      field(t('sp.fName'), name), field(t('sp.fTagline'), tagline), error, submit);
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!name.value.trim()) { error.textContent = t('sp.nameReq'); name.focus(); return; }
      submit.disabled = true; error.textContent = '';
      try { await createSpace({ name: name.value.trim(), tagline: tagline.value.trim(), myName: myName() }); await reload(); }
      catch (err) { console.error(err); error.textContent = `${t('sp.fail')} (${errCode(err)})`; submit.disabled = false; }
    };
    page.replaceChildren(
      el('div', { className: 'pip-say' }, el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
        el('div', {}, el('h1', {}, t('sp.createTitle')), el('p', {}, t('sp.createText')))),
      form,
      el('p', {}, el('a', { href: '#/ucapan' }, t('sp.toWishes'))));
  }

  /* ---------- kepala ruang ---------- */
  function header() {
    const names = space.members.map((m) => m.name).join(' + ');
    const since = new Date(space.createdAt).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
    const isOwner = space.createdBy === getUser().uid;
    const settings = isOwner ? el('button', { type: 'button', className: 'ghost' }, t('sp.settings')) : null;
    if (settings) settings.onclick = () => openSettings();
    return [
      el('h1', {}, space.name),
      el('p', { className: 'tl-sub' }, t('sp.sub', { names, date: since })),
      el('div', { className: 'card sp-head' },
        el('div', { className: 'sp-head-row' },
          el('div', { className: 'sp-avatars' }, ...space.members.map((m, i) => avatar(m.name, i))),
          el('div', { className: 'sp-head-text' },
            el('h2', {}, space.tagline || space.name),
            el('p', {}, `${t('sp.meta', { m: space.members.length, p: space.posts.length })} · ${albumCount()}`)),
          ...(settings ? [settings] : [])),
        el('p', { className: 'sp-private' }, t('sp.private'))),
    ];
  }

  function openSettings() {
    const name = el('input', { maxLength: 60, autocomplete: 'off', value: space.name, required: true });
    const tagline = el('input', { maxLength: 80, autocomplete: 'off', value: space.tagline ?? '' });
    const error = el('p', { role: 'alert', className: 'form-error' });
    const save = el('button', { type: 'submit' }, t('edit.save'));
    const cancel = el('button', { type: 'button', className: 'ghost' }, t('common.cancel'));
    const form = el('form', { noValidate: true }, el('h2', {}, t('sp.settingsTitle')),
      field(t('sp.fName'), name), field(t('sp.fTagline'), tagline), error, el('div', { className: 'actions' }, cancel, save));
    const dialog = makeDialog('', t('sp.settingsTitle'), form);
    cancel.onclick = () => dialog.close();
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!name.value.trim()) { error.textContent = t('sp.nameReq'); name.focus(); return; }
      save.disabled = true;
      try { await updateSpace(space.id, { name: name.value.trim(), tagline: tagline.value.trim() }); dialog.close(); showToast(t('sp.saved')); await reload(); }
      catch (err) { console.error(err); error.textContent = `${t('sp.fail')} (${errCode(err)})`; save.disabled = false; }
    };
  }

  /* ---------- cerita bersama ---------- */
  function postCard(post) {
    const me = getUser().uid;
    const member = space.members.findIndex((m) => m.uid === post.authorId);
    const moodName = MOODS.find(([e]) => e === post.mood)?.[1];

    let hearts = [...post.hearts];
    const heart = el('button', { type: 'button', className: 'ghost sp-heart' });
    const drawHeart = () => {
      const on = hearts.includes(me);
      heart.replaceChildren(`${on ? '♥' : '♡'} ${hearts.length}`);
      heart.setAttribute('aria-pressed', String(on));
      heart.setAttribute('aria-label', t('sp.heart'));
    };
    drawHeart();
    heart.onclick = async () => {
      const on = !hearts.includes(me);
      hearts = on ? [...hearts, me] : hearts.filter((u) => u !== me);
      drawHeart();
      try { await setHeart(space.id, post.id, on); }
      catch (err) { console.error(err); hearts = on ? hearts.filter((u) => u !== me) : [...hearts, me]; drawHeart(); showToast(t('sp.fail'), 'error'); }
    };

    const notesBox = el('div', { className: 'sp-notes', hidden: true });
    const noteBtn = el('button', { type: 'button', className: 'ghost' }, t('sp.leaveNote'));
    noteBtn.setAttribute('aria-expanded', 'false');
    let loaded = false;
    async function drawNotes() {
      const list = await listNotes(space.id, post.id);
      const input = el('input', { maxLength: MAX_NOTE_CHARS, placeholder: t('sp.notePh'), 'aria-label': t('sp.notePh') });
      const send = el('button', { type: 'submit' }, t('sp.send'));
      const form = el('form', { className: 'sp-note-form' }, input, send);
      form.onsubmit = async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        send.disabled = true;
        try { await addNote(space.id, post.id, { text, authorName: myName() }); await drawNotes(); }
        catch (err) { console.error(err); showToast(`${t('sp.fail')} (${errCode(err)})`, 'error'); send.disabled = false; }
      };
      notesBox.replaceChildren(
        ...list.map((n) => {
          const row = el('p', { className: 'sp-note' }, el('strong', {}, n.authorName), ` ${n.text}`);
          if (n.authorId === me) {
            const del = el('button', { type: 'button', className: 'ghost sp-note-del', 'aria-label': t('common.delete') }, icon('x'));
            del.onclick = async () => { try { await deleteNote(space.id, post.id, n.id); await drawNotes(); } catch (err) { console.error(err); showToast(t('sp.fail'), 'error'); } };
            row.append(del);
          }
          return row;
        }), form);
    }
    noteBtn.onclick = async () => {
      const open = notesBox.hidden;
      notesBox.hidden = !open;
      noteBtn.setAttribute('aria-expanded', String(open));
      if (open && !loaded) {
        loaded = true;
        try { await drawNotes(); } catch (err) { console.error(err); loaded = false; notesBox.replaceChildren(el('p', {}, t('sp.fail'))); }
      }
    };

    const actions = [heart, noteBtn];
    if (post.authorId === me) {
      const del = el('button', { type: 'button', className: 'ghost danger' }, icon('trash'), t('common.delete'));
      del.onclick = async () => {
        if (!confirm(t('sp.confirmDel'))) return;
        try { await deletePost(space.id, post.id); showToast(t('sp.deleted')); await reload(); }
        catch (err) { console.error(err); showToast(`${t('sp.fail')} (${errCode(err)})`, 'error'); }
      };
      actions.push(del);
    }

    return el('article', { className: 'card sp-post' },
      el('div', { className: 'sp-post-head' }, avatar(post.authorName, member < 0 ? 0 : member),
        el('div', {}, el('strong', {}, post.authorName), el('small', {}, `${when(post.createdAt)} · ${t('sp.sharedWith', { name: space.name })}`))),
      el('h3', {}, post.title),
      el('p', { className: 'sp-text' }, post.text),
      ...(post.mood ? [el('span', { className: 'chip' }, `${post.mood}${moodName ? ` ${t(`mood.${moodName}`)}` : ''}`)] : []),
      el('div', { className: 'sp-actions' }, ...actions),
      notesBox);
  }

  function openNewPost() {
    let mood = MOODS[0][0];
    const title = el('input', { maxLength: 80, autocomplete: 'off', required: true });
    const text = el('textarea', { rows: 7, maxLength: MAX_POST_CHARS, required: true });
    const moodBtns = MOODS.map(([emoji, name]) => {
      const b = el('button', { type: 'button', className: 'ghost', title: t(`mood.${name}`) }, emoji);
      b.setAttribute('aria-label', t(`mood.${name}`));
      b.setAttribute('aria-pressed', String(emoji === mood));
      b.onclick = () => { mood = emoji; moodBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); };
      return b;
    });
    const error = el('p', { role: 'alert', className: 'form-error' });
    const submit = el('button', { type: 'submit' }, t('sp.post'));
    const cancel = el('button', { type: 'button', className: 'ghost' }, t('common.cancel'));
    const form = el('form', { noValidate: true }, el('h2', {}, t('sp.newTitle')),
      el('p', { className: 'hint-text' }, t('sp.newHint', { name: space.name })),
      field(t('sp.fTitle'), title), field(t('sp.fText'), text),
      el('div', { className: 'field' }, el('span', { className: 'label' }, t('write.feeling')), el('div', { className: 'moods' }, ...moodBtns)),
      error, el('div', { className: 'actions' }, cancel, submit));
    const dialog = makeDialog('wide-sheet', t('sp.newTitle'), form);
    cancel.onclick = () => dialog.close();
    title.focus();
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!title.value.trim() || !text.value.trim()) { error.textContent = t('sp.postReq'); (title.value.trim() ? text : title).focus(); return; }
      submit.disabled = true; error.textContent = '';
      try {
        await addPost(space.id, { title: title.value.trim(), text: text.value.trim(), mood, authorName: myName() });
        dialog.close(); showToast(t('sp.posted')); await reload();
      } catch (err) { console.error(err); error.textContent = `${t('sp.fail')} (${errCode(err)})`; submit.disabled = false; }
    };
  }

  /* ---------- album bersama ---------- */
  const albumHref = () => `#/album?space=${encodeURIComponent(space.id)}`;
  const albumCount = () => t(space.album ? 'sp.metaAlbum1' : 'sp.metaAlbumN', { n: space.album ? 1 : 0 });

  function openCreateAlbum() {
    const title = el('input', { maxLength: 80, autocomplete: 'off', required: true, placeholder: t('sp.alTitlePh') });
    const error = el('p', { role: 'alert', className: 'form-error' });
    const submit = el('button', { type: 'submit' }, t('sp.alCreate'));
    const cancel = el('button', { type: 'button', className: 'ghost' }, t('common.cancel'));
    const form = el('form', { noValidate: true }, el('h2', {}, t('sp.alCreateTitle')),
      el('p', { className: 'hint-text' }, t('sp.alCreateHint', { space: space.name })),
      field(t('sp.alTitleLabel'), title), error, el('div', { className: 'actions' }, cancel, submit));
    const dialog = makeDialog('', t('sp.alCreateTitle'), form);
    cancel.onclick = () => dialog.close();
    title.focus();
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!title.value.trim()) { error.textContent = t('sp.alTitleReq'); title.focus(); return; }
      submit.disabled = true; error.textContent = '';
      const now = new Date();
      const date = `${now.toLocaleDateString(locale(), { month: 'long' })}, ${now.getFullYear()}`;
      try {
        await createSharedAlbum(space.id, { title: title.value.trim(), date });
        dialog.close(); showToast(t('sp.alCreated'));
        location.hash = albumHref(); // langsung ke bukunya, siap diisi foto
      } catch (err) { console.error(err); error.textContent = `${t('sp.fail')} (${errCode(err)})`; submit.disabled = false; }
    };
  }

  /** Kartu di sisi kanan: sampul buku, jumlah foto dan halaman, penambah terakhir, tombol buka. Belum ada album: ajakan membuat. */
  function albumPanel() {
    const a = space.album;
    if (!a) {
      const create = el('button', { type: 'button' }, icon('plus'), t('sp.alCreate'));
      create.onclick = openCreateAlbum;
      return el('div', { className: 'card sp-album' }, el('h2', {}, t('sp.alNoneTitle')),
        el('p', { className: 'hint-text' }, t('sp.alNoneText')), create);
    }
    const n = a.photoCount ?? 0;
    const cover = el('div', { className: 'shelf-book' });
    cover.innerHTML = `<div class="face cover"><div class="in"><small></small>${STAR_SVG}<h2 style="margin-top:34cqh"></h2><em></em></div></div>`;
    cover.querySelector('small').textContent = memberLabel(space.members);
    cover.querySelector('h2').textContent = a.title;
    cover.querySelector('em').textContent = a.date ? `${a.date} ✦` : '✦';
    const stage = el('a', { className: 'shelf-stage', href: albumHref(), tabIndex: -1 }, cover);
    stage.setAttribute('aria-hidden', 'true'); // yang bisa difokus cukup tombol "Open our album"
    const meta = [
      t(n === 1 ? 'albums.photo1' : 'albums.photoN', { n }),
      t('albums.pages', { n: pageCount({ photoCount: n, letter: [] }) }),
      a.lastPhotoByName ? t('sp.alLast', { who: a.lastPhotoByName }) : '',
    ].filter(Boolean).join(' · ');
    return el('div', { className: 'card sp-album' }, el('h2', {}, a.title), stage,
      el('p', { className: 'sp-album-meta' }, meta),
      el('a', { className: 'btn ghost', href: albumHref() }, icon('book-open'), t('sp.alOpen')));
  }

  /** Tab "Our album": foto yang baru ditambahkan (maks. 6), dimuat setelah halaman tampil. */
  function albumTab() {
    const box = el('div', { className: 'sp-album-tab' });
    if (!space.album) {
      const create = el('button', { type: 'button' }, icon('plus'), t('sp.alCreate'));
      create.onclick = openCreateAlbum;
      box.append(el('p', { className: 'tl-none' }, t('sp.alNone')), el('div', {}, create));
      return box;
    }
    const grid = el('ul', { className: 'sp-recent', 'aria-busy': 'true' });
    const add = el('a', { className: 'btn', href: albumHref() }, icon('image-plus'), t('album.addPhotos'));
    const open = el('a', { className: 'btn ghost', href: albumHref() }, icon('book-open'), t('sp.alOpen'));
    box.append(el('h2', { className: 'sp-recent-title' }, t('sp.alRecent')), grid, el('div', { className: 'sp-actions' }, add, open));
    if (!(space.album.photoCount > 0)) {
      grid.replaceWith(el('p', { className: 'tl-none' }, t('sp.alNoPhotos')));
      return box;
    }
    listRecentSharedPhotos(space.id).then((list) => {
      grid.replaceChildren(...list.map((p) => {
        const alt = p.caption || t('sp.alPhotoBy', { who: p.addedByName });
        const link = el('a', { href: albumHref(), 'aria-label': alt }, el('img', { src: p.src, alt: '', loading: 'lazy' }));
        return el('li', {}, link, el('small', {}, `${p.addedByName} · ${formatDate(p.createdAt)}`));
      }));
    }).catch((err) => {
      console.error(err);
      grid.replaceWith(el('p', { className: 'tl-none' }, t('sp.alLoadFail')));
    }).finally(() => grid.removeAttribute('aria-busy'));
    return box;
  }

  /* ---------- undang sahabat ---------- */
  function invitePanel() {
    const email = el('input', { type: 'email', autocomplete: 'off', required: true, placeholder: 'mira@example.com' });
    const message = el('textarea', { rows: 2, maxLength: 200, value: t('sp.msgDefault') });
    const error = el('p', { role: 'alert', className: 'form-error' });
    const preview = el('button', { type: 'submit' }, icon('mail-heart'), t('sp.preview'));
    const pendingBox = el('div', { className: 'sp-pending' });
    const form = el('form', { noValidate: true }, field(t('sp.fEmail'), email), field(t('sp.fMsg'), message), error, preview);

    async function drawPending() {
      try {
        const list = await listPendingInvites(space.id);
        pendingBox.replaceChildren(...(list.length ? [el('h3', {}, t('sp.pending')), ...list.map((inv) => {
          const cancel = el('button', { type: 'button', className: 'ghost' }, t('sp.cancelInvite'));
          cancel.onclick = async () => { try { await cancelInvite(inv.token); await drawPending(); } catch (err) { console.error(err); showToast(t('sp.fail'), 'error'); } };
          const copy = el('button', { type: 'button', className: 'ghost' }, t('sp.copyLink'));
          copy.onclick = () => copyText(inviteLink(inv.token, CONFIG.shareUrl));
          return el('div', { className: 'sp-invite-row' }, el('span', {}, inv.email), copy, cancel);
        })] : []));
      } catch (err) { console.error(err); }
    }
    drawPending();

    form.onsubmit = (e) => {
      e.preventDefault();
      if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) { error.textContent = t('sp.emailInvalid'); email.focus(); return; }
      error.textContent = '';
      openPreview(email.value.trim(), message.value.trim(), drawPending);
    };
    return el('div', { className: 'card' }, el('h2', {}, t('sp.inviteTitle')),
      el('p', { className: 'hint-text' }, t('sp.inviteText')), form,
      el('p', { className: 'sp-note-small' }, t('sp.inviteNote', { days: INVITE_DAYS })), pendingBox);
  }

  function openPreview(to, msg, onSent) {
    const send = el('button', { type: 'button' }, t('sp.sendInvite'));
    const back = el('button', { type: 'button', className: 'ghost' }, t('sp.edit'));
    const error = el('p', { role: 'alert', className: 'form-error' });
    const dialog = makeDialog('', t('sp.pvTitle'),
      el('h2', {}, t('sp.pvTitle')),
      el('div', { className: 'sp-envelope' },
        el('p', { className: 'hand' }, t('sp.pvLine', { name: myName(), space: space.name })),
        el('p', {}, msg || t('sp.msgDefault')),
        el('small', {}, t('sp.pvTo', { email: to }))),
      el('p', { className: 'hint-text' }, t('sp.pvExpire', { days: INVITE_DAYS })),
      error, el('div', { className: 'actions' }, back, send));
    back.onclick = () => dialog.close();
    send.onclick = async () => {
      send.disabled = true; error.textContent = '';
      try {
        const token = await createInvite({ space, inviterName: myName(), email: to, message: msg });
        dialog.close();
        openSent(to, inviteLink(token, CONFIG.shareUrl));
        await onSent();
      } catch (err) { console.error(err); error.textContent = `${t('sp.fail')} (${errCode(err)})`; send.disabled = false; }
    };
  }

  function openSent(to, link) {
    const url = el('input', { value: link, readOnly: true, 'aria-label': t('sp.copyLink') });
    url.onfocus = () => url.select();
    const copy = el('button', { type: 'button' }, t('sp.copyLink'));
    copy.onclick = () => copyText(link);
    const subject = encodeURIComponent(t('sp.mailSubject', { space: space.name }));
    const body = encodeURIComponent(t('sp.mailBody', { name: myName(), space: space.name, link }));
    const mail = el('a', { className: 'btn ghost', href: `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}` }, icon('mail-heart'), t('sp.openMail'));
    const close = el('button', { type: 'button', className: 'ghost' }, t('sp.close'));
    const dialog = makeDialog('', t('sp.sentTitle'), el('h2', {}, t('sp.sentTitle')),
      el('p', { className: 'hint-text' }, t('sp.sentText', { email: to })),
      el('div', { className: 'field' }, url),
      el('div', { className: 'actions' }, close, mail, copy));
    close.onclick = () => dialog.close();
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); showToast(t('sp.copied')); }
    catch { showToast(t('bestie.copyFail'), 'error'); }
  }

  /* ---------- susun halaman ---------- */
  function draw() {
    if (!space) return drawCreate();
    const share = el('button', { type: 'button' }, icon('plus'), t('sp.share'));
    share.onclick = openNewPost;
    const tabs = [['diary', `${t('sp.tabDiary')} · ${space.posts.length}`], ['album', t('sp.tabAlbum')]].map(([key, label]) => {
      const b = el('button', { type: 'button', className: 'ghost' }, label);
      b.setAttribute('aria-pressed', String(tab === key));
      b.onclick = () => { tab = key; draw(); };
      return b;
    });
    page.replaceChildren(...header(),
      el('div', { className: 'tl-tabs', role: 'group', 'aria-label': t('sp.tabsLabel') }, ...tabs),
      el('div', { className: 'tl-layout' },
        tab === 'album'
          ? albumTab()
          : el('div', { className: 'sp-feed' },
            ...(space.posts.length ? space.posts.map(postCard) : [el('p', { className: 'tl-none' }, t('sp.empty'))]),
            el('div', {}, share)),
        el('aside', { className: 'tl-side' }, albumPanel(), invitePanel(),
          el('p', {}, el('a', { href: '#/ucapan' }, t('sp.toWishes'))))));
  }
  draw();
}
