// Baca entri (B4), mengikuti frame Figma "A page worth keeping":
// kertas krem dengan polaroid bertape, tombol Edit/More, reaksi dan catatan sahabat (hanya kalau halamannya dibagikan).
import { getEntry, getEntryPhotos, removeEntry, setEntryShare } from '../services/storage.js';
import {
  loadSpaceBrief, loadSharedPost, addPost, setReaction, addNote, deleteNote, listNotes, MAX_POST_CHARS, MAX_NOTE_CHARS,
} from '../services/spaces.js';
import { getUser } from '../services/auth.js';
import { getPrefs } from '../services/prefs.js';
import { sanitize } from '../services/rich.js';
import { showToast } from '../components/toast.js';
import { makeDialog } from '../components/dialog.js';
import { locale, t } from '../i18n.js';
import { moodInfo } from '../components/entry-card.js';
import { el, formatDate, icon } from '../utils.js';

const REACTIONS = [['heart', 'hearts', '♡'], ['star', 'stars', '✦'], ['moon', 'moons', '☾']];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const myName = () => getPrefs().displayName || cap((getUser().email ?? '').split('@')[0]) || t('name.fallback');
const avatar = (name, i) => el('span', { className: `sp-avatar c${i % 2}`, title: name }, (name[0] ?? '✦').toUpperCase());
const noteTime = (ts) => new Date(ts).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Menu kecil (tombol "More"): Esc menutup dan fokus kembali, panah atas/bawah berpindah, klik di luar menutup. */
function popMenu(label, items) {
  const btn = el('button', { type: 'button', className: 'ghost' }, icon('more'), label);
  btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false');
  const menu = el('div', { className: 'pop-menu', role: 'menu', hidden: true });
  menu.setAttribute('aria-label', t('entry.moreMenu'));
  const buttons = items.map(({ text, ic, run, danger }) => {
    const b = el('button', { type: 'button', role: 'menuitem', className: `ghost${danger ? ' danger' : ''}` }, icon(ic), text);
    b.onclick = () => { close(); run(); };
    return b;
  });
  menu.append(...buttons);
  const close = (focus = false) => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', away); if (focus) btn.focus(); };
  const away = (e) => { if (!wrap.contains(e.target)) close(); };
  const open = () => { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); document.addEventListener('pointerdown', away); buttons[0]?.focus(); };
  btn.onclick = () => (menu.hidden ? open() : close(true));
  menu.onkeydown = (e) => {
    const i = buttons.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(i + 1) % buttons.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length].focus(); }
    else if (e.key === 'Tab') close();
  };
  const wrap = el('div', { className: 'pop-wrap' }, btn, menu);
  return { node: wrap, cleanup: () => document.removeEventListener('pointerdown', away) };
}

export async function renderEntry(root, params) {
  const entry = await getEntry(params.get('id') ?? '');
  if (!entry) {
    root.append(el('section', { className: 'page empty' }, el('h1', {}, t('entry.notFound')), el('a', { className: 'btn', href: '#/diary' }, t('entry.toDiary'))));
    return;
  }

  // Tulisan: HTML yang sudah dibersihkan (dengan foto di dalamnya) atau teks polos untuk entri lama.
  const photos = entry.html && entry.photoCount > 0 ? await getEntryPhotos(entry.id).catch(() => ({})) : {};
  const rich = el('div', { className: `rich${entry.handwritten ? ' hand' : ''}` });
  if (entry.html) rich.innerHTML = sanitize(entry.html, { photos });
  else rich.append(...entry.text.split(/\n{2,}/).map((p) => el('p', {}, p)));
  rich.querySelectorAll('figure').forEach((f) => { if (!f.querySelector('img[src]')) f.remove(); });

  // Ruang bersama: hanya dimuat kalau halaman ini ditandai/dibagikan, supaya halaman privat tidak menyentuh ruang mana pun.
  let shared = null, brief = null;
  const wantsSpace = entry.privacy === 'shared' || !!entry.sharedTo;
  if (wantsSpace) {
    try {
      if (entry.sharedTo) shared = await loadSharedPost(entry.sharedTo.sid, entry.sharedTo.pid);
      if (!shared) brief = await loadSpaceBrief();
    } catch (err) { console.error(err); }
  }

  const dateObj = new Date(entry.createdAt);
  const mi = moodInfo(entry.mood);
  const spaceName = shared?.space.name ?? entry.sharedTo?.name ?? brief?.name ?? 'Bestie Space';

  /* ---------- aksi ---------- */
  function confirmDelete() {
    const yes = el('button', { type: 'button', className: 'danger-fill' }, icon('trash'), t('common.delete'));
    const no = el('button', { type: 'button', className: 'ghost' }, t('common.cancel'));
    const dlg = makeDialog('', t('entry.deleteTitle'), el('h2', {}, t('entry.deleteTitle')),
      el('p', { className: 'hint-text' }, t('entry.deleteText')),
      ...(entry.sharedTo ? [el('p', { className: 'hint-text' }, t('entry.deleteCopy', { space: spaceName }))] : []),
      el('div', { className: 'actions' }, no, yes));
    no.onclick = () => dlg.close();
    yes.onclick = async () => {
      yes.disabled = true;
      try { await removeEntry(entry.id); dlg.close(); showToast(t('entry.deleted')); location.hash = '#/diary'; }
      catch (err) { console.error(err); showToast(t('sp.fail'), 'error'); yes.disabled = false; }
    };
  }

  const space = shared?.space ?? brief;
  function confirmShare() {
    const text = entry.text.length > MAX_POST_CHARS ? `${entry.text.slice(0, MAX_POST_CHARS - 1)}…` : entry.text;
    const yes = el('button', { type: 'button' }, t('entry.shareYes'));
    const no = el('button', { type: 'button', className: 'ghost' }, t('common.cancel'));
    const error = el('p', { role: 'alert', className: 'form-error' });
    const dlg = makeDialog('', t('entry.shareTitle', { space: space.name }), el('h2', {}, t('entry.shareTitle', { space: space.name })),
      el('p', { className: 'hint-text' }, t('entry.shareAsk', { space: space.name })),
      ...(text !== entry.text ? [el('p', { className: 'hint-text' }, t('entry.shareCut', { n: MAX_POST_CHARS }))] : []),
      error, el('div', { className: 'actions' }, no, yes));
    no.onclick = () => dlg.close();
    yes.onclick = async () => {
      yes.disabled = true; error.textContent = '';
      try {
        const ref = await addPost(space.id, { title: entry.title.slice(0, 80), text, mood: [...entry.mood].length <= 4 ? entry.mood : '', authorName: myName() });
        entry.sharedTo = { sid: space.id, pid: ref.id, name: space.name };
        await setEntryShare(entry.id, entry.sharedTo);
        dlg.close(); showToast(t('entry.shared'));
        window.dispatchEvent(new Event('hashchange')); // gambar ulang halaman dengan salinan yang baru
      } catch (err) { console.error(err); error.textContent = t('entry.shareFail'); yes.disabled = false; }
    };
  }

  const canShare = !!space && !shared;
  const menu = popMenu(t('entry.more'), [
    ...(canShare ? [{ text: t('entry.shareBtn', { space: space.name }), ic: 'users', run: confirmShare }] : []),
    { text: t('common.delete'), ic: 'trash', run: confirmDelete, danger: true },
  ]);

  /* ---------- kepala ---------- */
  const monthLabel = dateObj.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  const badge = entry.sharedTo ? t('entry.badgeShared', { space: spaceName })
    : entry.privacy === 'shared' ? t('entry.badgeMarked') : t('entry.badgeMe');
  const head = [
    el('h1', {}, t('entry.title')),
    el('p', { className: 'ed-sub' }, t('entry.crumb', { month: monthLabel, title: entry.title })),
    el('div', { className: 'entry-bar' },
      el('span', { className: `entry-badge${entry.privacy === 'shared' || entry.sharedTo ? ' shared' : ''}` },
        icon(entry.privacy === 'shared' || entry.sharedTo ? 'users' : 'lock-keyhole'), badge),
      el('div', { className: 'ctrl' },
        el('a', { className: 'btn ghost', href: `#/write?edit=${entry.id}` }, icon('pencil'), t('entry.edit')), menu.node)),
  ];

  /* ---------- kertas krem ---------- */
  const mood = mi
    ? el('span', { className: 'paper-mood hand' }, icon(mi.ic), t('entry.feeling', { mood: t(`mood.${mi.name}`).toLowerCase() }))
    : el('span', { className: 'paper-mood hand' }, entry.mood);
  const paper = el('article', { className: 'paper read-paper' },
    el('div', { className: 'paper-top' },
      el('time', { dateTime: dateObj.toISOString() }, dateObj.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()), mood),
    el('h2', { className: 'paper-title' }, entry.title),
    rich,
    el('div', { className: 'paper-foot' },
      el('p', { className: 'paper-tags' }, ...(entry.tags ?? []).map((tag) => el('span', {}, `#${tag}`))),
      el('p', { className: 'paper-sign hand' }, t('entry.love', { name: myName() }), ' ✦')));

  /* ---------- reaksi & catatan ---------- */
  const lower = el('div', { className: 'entry-lower' });
  const me = getUser().uid;

  function drawShared() {
    const { post, members } = shared;
    const who = (u) => members.find((m) => m.uid === u)?.name ?? '';
    const chips = el('div', { className: 'react-row' });
    const picker = el('div', { className: 'react-row', hidden: true });
    const more = el('button', { type: 'button', className: 'ghost' }, t('entry.react'));
    more.setAttribute('aria-expanded', 'false');
    more.onclick = () => { picker.hidden = !picker.hidden; more.setAttribute('aria-expanded', String(!picker.hidden)); };

    const drawReact = () => {
      const make = ([kind, field, glyph], always) => {
        const list = post[field], on = list.includes(me);
        const label = t(`entry.r.${kind}`);
        const b = el('button', { type: 'button', className: 'ghost react' }, `${glyph}${always ? ` ${label}` : ` ${list.length}`}`);
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', t('entry.rCount', { label, n: list.length }));
        if (list.length) b.title = list.map(who).filter(Boolean).join(', ');
        b.onclick = async () => {
          const next = !post[field].includes(me);
          post[field] = next ? [...post[field], me] : post[field].filter((u) => u !== me);
          drawReact();
          try { await setReaction(shared.space.id, post.id, kind, next); }
          catch (err) { console.error(err); post[field] = next ? post[field].filter((u) => u !== me) : [...post[field], me]; drawReact(); showToast(t('sp.fail'), 'error'); }
        };
        return b;
      };
      chips.replaceChildren(...REACTIONS.filter(([, f]) => post[f].length).map((r) => make(r, false)), more);
      picker.replaceChildren(...REACTIONS.map((r) => make(r, true)));
      live.textContent = '';
    };
    const live = el('span', { className: 'sr-only', role: 'status' });
    drawReact();

    const notesBox = el('div', { className: 'note-list' });
    const form = el('form', { className: 'sp-note-form', hidden: true });
    const input = el('input', { maxLength: MAX_NOTE_CHARS, placeholder: t('entry.noteBtn'), 'aria-label': t('sp.notePh'), autocomplete: 'off' });
    const send = el('button', { type: 'submit' }, t('sp.send'));
    form.append(input, send);
    const leave = el('button', { type: 'button', className: 'ghost' }, t('entry.noteBtn'));
    leave.setAttribute('aria-expanded', 'false');
    leave.onclick = () => { form.hidden = !form.hidden; leave.setAttribute('aria-expanded', String(!form.hidden)); if (!form.hidden) input.focus(); };

    async function drawNotes() {
      shared.notes = await listNotes(shared.space.id, post.id);
      notesBox.replaceChildren(...(shared.notes.length ? shared.notes.map((n) => {
        const row = el('div', { className: 'note-row' }, avatar(n.authorName, members.findIndex((m) => m.uid === n.authorId)),
          el('div', {}, el('strong', {}, `${n.authorName} · `), el('small', {}, noteTime(n.createdAt)), el('p', {}, n.text)));
        if (n.authorId === me) {
          const del = el('button', { type: 'button', className: 'ghost sp-note-del', 'aria-label': t('common.delete') }, icon('x'));
          del.onclick = async () => { try { await deleteNote(shared.space.id, post.id, n.id); await drawNotes(); } catch (err) { console.error(err); showToast(t('sp.fail'), 'error'); } };
          row.append(del);
        }
        return row;
      }) : [el('p', { className: 'muted' }, t('entry.notesNone'))]));
    }
    drawNotes().catch((err) => { console.error(err); notesBox.replaceChildren(el('p', {}, t('sp.fail'))); });
    form.onsubmit = async (e) => {
      e.preventDefault();
      const text = input.value.trim(); if (!text) return;
      send.disabled = true;
      try { await addNote(shared.space.id, post.id, { text, authorName: myName() }); input.value = ''; await drawNotes(); }
      catch (err) { console.error(err); showToast(t('sp.fail'), 'error'); }
      send.disabled = false;
    };

    const anyReaction = REACTIONS.some(([, f]) => post[f].length);
    lower.replaceChildren(
      el('section', { className: 'card love' }, el('h2', {}, t('entry.loveTitle')), chips, picker, live,
        ...(anyReaction ? [] : [el('p', { className: 'muted' }, t('entry.loveNone', { space: shared.space.name }))]),
        el('small', { className: 'muted' }, t('entry.loveNote', { space: shared.space.name }))),
      el('section', { className: 'card love' }, el('h2', { className: 'sr-only' }, t('entry.notes')), notesBox, form, el('div', {}, leave)));
  }

  const infoCard = (title, text, ...actions) => el('section', { className: 'card love wide-card' },
    el('h2', {}, title), el('p', { className: 'muted' }, text), ...(actions.length ? [el('div', { className: 'ctrl start' }, ...actions)] : []));

  if (shared) drawShared();
  else if (entry.sharedTo) { // salinan sudah tidak ada
    const again = brief ? Object.assign(el('button', { type: 'button' }, t('entry.shareBtn', { space: brief.name })), { onclick: confirmShare }) : null;
    lower.replaceChildren(infoCard(t('entry.goneTitle'), t('entry.goneText', { space: spaceName }), ...(again ? [again] : [])));
  } else if (entry.privacy === 'shared') {
    if (brief) lower.replaceChildren(infoCard(t('entry.readyTitle'), t('entry.readyText', { space: brief.name }),
      Object.assign(el('button', { type: 'button' }, icon('users'), t('entry.shareBtn', { space: brief.name })), { onclick: confirmShare })));
    else lower.replaceChildren(infoCard(t('entry.noSpaceTitle'), t('entry.noSpaceText'), el('a', { className: 'btn', href: '#/bestie' }, t('entry.noSpaceLink'))));
  } else lower.replaceChildren(infoCard(t('entry.privTitle'), t('entry.privText')));

  root.append(el('section', { className: 'page wide entry-page' }, ...head, paper,
    ...(entry.sharedTo && shared ? [el('p', { className: 'muted copy-note' }, t('entry.copyNote', { space: spaceName }))] : []), lower));
  return menu.cleanup;
}
