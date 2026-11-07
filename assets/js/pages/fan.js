// Fan Corner: persona, pertemuan berikutnya, jadwal, momen favorit, dinding karya, kata-kata, daftar harapan.
import { el, icon } from '../utils.js';
import { getPrefs, setPrefs } from '../services/prefs.js';
import { loadFanArt, addFanArt, removeFanArt, MAX_FANART, MAX_CAPTION } from '../services/fanart.js';
import { MAX_UPLOAD_MB, imageErrorMessage } from '../services/image.js';
import { showToast } from '../components/toast.js';
import { t, locale } from '../i18n.js';

const toggleIn = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
const IMAGE_NAME = /\.(jpe?g|png|webp|hei[cf])$/i;
const dot = () => el('i', { className: 'dot' });

/** Tombol pengingat; statusnya tersimpan per jadwal. */
function reminderButton(id, title, full = false) {
  const button = el('button', { className: 'ghost' });
  const draw = () => {
    const on = getPrefs().reminders.includes(id);
    button.setAttribute('aria-pressed', String(on));
    button.setAttribute('aria-label', t('fan.remAria', { title }));
    button.replaceChildren(icon(on ? 'check' : 'bell'), ...(full ? [on ? t('fan.remOn') : t('fan.remOff')] : []));
  };
  button.onclick = () => { setPrefs({ reminders: toggleIn(getPrefs().reminders, id) }); draw(); };
  draw();
  return button;
}

function wishlistCard(initial) {
  const card = el('div', { className: 'card' });
  let adding = false;
  const draw = () => {
    const { wishDone, wishAdded } = getPrefs();
    const items = [...initial, ...wishAdded.map((text) => ({ text }))];
    const list = items.map((w) => {
      const box = el('input', { type: 'checkbox', className: 'wish-box', checked: wishDone.includes(w.text) });
      box.onchange = () => setPrefs({ wishDone: toggleIn(getPrefs().wishDone, w.text) });
      return el('label', { className: 'wish' }, box,
        el('span', {}, el('b', {}, w.text), ...(w.note ? [el('small', {}, w.note)] : [])));
    });

    let tail;
    if (adding) {
      const input = el('input', { placeholder: t('fan.wishPh'), ariaLabel: t('fan.wishAria'), maxLength: 80 });
      const form = el('form', { className: 'wish-form' }, input, el('button', {}, t('fan.add')));
      form.onsubmit = (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        if (!getPrefs().wishAdded.includes(text)) setPrefs({ wishAdded: [...getPrefs().wishAdded, text] });
        adding = false;
        draw();
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); adding = false; draw(); } });
      tail = form;
      queueMicrotask(() => input.focus());
    } else {
      const open = el('button', { type: 'button', className: 'ghost' }, t('fan.addWish'));
      open.onclick = () => { adding = true; draw(); };
      tail = open;
    }
    card.replaceChildren(el('h3', {}, t('fan.wishes')), el('div', { className: 'wishes' }, ...list), tail);
  };
  draw();
  return card;
}

/** Kartu dinding karya: karya contoh dari fan.json + karya yang ditambahkan sendiri. */
function artCard(sample) {
  const card = el('div', { className: 'card art-card' });
  let mine = [];
  let current = 'sample';

  const dateText = (ms) => new Date(ms).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });

  function openAddDialog(file) {
    const caption = el('input', { maxLength: MAX_CAPTION, autocomplete: 'off', placeholder: t('fan.artCaptionPh') });
    const label = el('label', { htmlFor: 'art-caption' }, t('fan.artCaption'));
    caption.id = 'art-caption';
    const preview = el('img', { className: 'art-preview', alt: '', src: URL.createObjectURL(file) });
    const error = el('p', { role: 'alert', className: 'form-error' });
    const submit = el('button', { type: 'submit' }, t('fan.artSave'));
    const cancel = el('button', { type: 'button', className: 'ghost' }, t('common.cancel'));
    const form = el('form', {},
      el('h2', {}, t('fan.artDialog')),
      el('p', { className: 'hint-text' }, t('fan.artOwnHint')),
      preview, el('div', { className: 'field' }, label, caption), error,
      el('div', { className: 'actions' }, cancel, submit));
    const dialog = el('dialog', { className: 'sheet' }, form);
    dialog.setAttribute('aria-label', t('fan.artDialog'));
    dialog.addEventListener('close', () => { URL.revokeObjectURL(preview.src); dialog.remove(); });
    document.body.append(dialog);
    dialog.showModal();
    caption.focus();
    cancel.onclick = () => dialog.close();
    form.onsubmit = async (e) => {
      e.preventDefault();
      submit.disabled = true; cancel.disabled = true; error.textContent = '';
      try {
        const art = await addFanArt(file, caption.value, mine.length);
        mine = [art, ...mine];
        current = art.id;
        dialog.close();
        draw();
        showToast(t('fan.artAdded'));
      } catch (err) {
        console.error(err);
        error.textContent = err?.code === 'art-full' ? t('fan.artFull', { max: MAX_FANART }) : imageErrorMessage(err);
        submit.disabled = false; cancel.disabled = false;
      }
    };
  }

  function draw() {
    const art = mine.find((a) => a.id === current);
    const shown = art
      ? { src: art.data, caption: art.caption, credit: t('fan.artOwn', { name: getPrefs().displayName || t('fan.artMe'), date: dateText(art.createdAt) }) }
      : sample;
    const input = el('input', { type: 'file', hidden: true, accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif' });
    const add = el('button', { type: 'button', className: 'ghost' }, icon('image-plus'), t('fan.addArt'));
    add.onclick = () => input.click();
    input.onchange = () => {
      const file = input.files[0];
      input.value = '';
      if (!file) return;
      if (!(file.type.startsWith('image/') || IMAGE_NAME.test(file.name))) { showToast(t('book.notImage'), 'error'); return; }
      if (file.size > MAX_UPLOAD_MB * 1048576) { showToast(t('book.tooBig', { name: file.name, size: (file.size / 1048576).toFixed(1), max: MAX_UPLOAD_MB }), 'error'); return; }
      openAddDialog(file);
    };

    // Deretan kecil untuk berpindah karya, hanya kalau sudah ada karya sendiri
    const thumbs = mine.length ? el('div', { className: 'art-thumbs', role: 'group', 'aria-label': t('fan.art') },
      ...[{ id: 'sample', src: sample.src, caption: sample.caption }, ...mine.map((a) => ({ id: a.id, src: a.data, caption: a.caption }))].map((a) => {
        const b = el('button', { type: 'button', className: 'art-thumb' });
        b.style.backgroundImage = `url("${a.src}")`;
        b.setAttribute('aria-label', a.caption || t('fan.art'));
        b.setAttribute('aria-pressed', String(a.id === current));
        b.onclick = () => { current = a.id; draw(); };
        return b;
      })) : null;

    const remove = art ? el('button', { type: 'button', className: 'ghost danger' }, icon('trash'), t('fan.artRemove')) : null;
    if (remove) remove.onclick = async () => {
      if (!confirm(t('fan.artConfirm'))) return;
      remove.disabled = true;
      try { await removeFanArt(art.id); mine = mine.filter((a) => a.id !== art.id); current = 'sample'; draw(); showToast(t('fan.artRemoved')); }
      catch (err) { console.error(err); showToast(t('fan.artFail'), 'error'); remove.disabled = false; }
    };

    card.replaceChildren(
      el('h3', {}, t('fan.art')),
      el('img', { className: 'fan-art', src: shown.src, alt: shown.caption }),
      ...(thumbs ? [thumbs] : []),
      el('p', { className: 'quote small' }, shown.caption),
      el('small', { className: 'art-credit' }, shown.credit),
      el('div', { className: 'art-actions' }, add, ...(remove ? [remove] : [])),
      input);
  }
  draw();
  loadFanArt().then((list) => { if (list.length) { mine = list; draw(); } });
  return card;
}

export async function renderFan(root) {
  const res = await fetch('data/fan.json');
  if (!res.ok) throw new Error('data/fan.json gagal dimuat');
  const { subtitle, persona, gathering, week, moments, words, art, wishlist } = await res.json();

  const personaCard = el('div', { className: 'card persona' },
    el('img', { src: persona.portrait, alt: persona.name }),
    el('div', {},
      el('span', { className: 'tag-pink' }, dot(), persona.badge),
      el('h2', { className: 'persona-name' }, persona.name),
      el('p', {}, persona.quote), el('p', {}, persona.bio),
      el('small', {}, persona.note)));

  const weekCard = el('div', { className: 'card' }, el('h3', {}, t('fan.week')),
    ...week.map((w) => el('div', { className: 'sched' },
      el('div', {}, el('small', {}, w.day), el('b', {}, w.time)),
      el('div', {}, el('strong', {}, w.title), el('small', {}, w.meta)),
      reminderButton(w.id, w.title))));

  const momentCards = moments.map((m) => el('article', { className: 'card moment' },
    el('div', { className: 'clip', role: 'img', 'aria-label': t('fan.clipAria', { date: m.date, length: m.length }) },
      icon('play'), el('span', {}, `${m.date} · ${m.length}`)),
    el('h3', {}, m.title),
    el('p', {}, m.text),
    el('span', { className: 'chip' }, dot(), `#${m.tag}`)));

  const wordsCard = el('div', { className: 'card' }, el('h3', {}, t('fan.words')),
    el('p', { className: 'quote big' }, words.text), el('small', {}, words.source));

  const gatheringCard = el('div', { className: 'card' }, el('h3', {}, t('fan.next')),
    el('span', { className: 'chip on' }, dot(), gathering.when), el('h2', { className: 'gather-title' }, gathering.title),
    el('p', {}, gathering.text), reminderButton('gathering', gathering.title, true));

  root.append(el('section', { className: 'page wide' },
    el('h1', {}, t('fan.title')), el('p', {}, subtitle),
    el('div', { className: 'fan-cols' },
      el('div', { className: 'stack' }, personaCard, weekCard,
        el('h2', {}, t('fan.moments')), el('div', { className: 'moments' }, ...momentCards), wordsCard),
      el('div', { className: 'stack' }, gatheringCard, artCard(art), wishlistCard(wishlist)))));
}
