import { listEntries, addEntry, removeEntry } from '../services/storage.js';
import { el, formatDate } from '../utils.js';

const MOODS = ['😊', '🌙', '💜', '😴'];

export async function renderDiary(root) {
  let mood = MOODS[0];
  const list = el('div');

  const title = el('input', { id: 'title', required: true, maxLength: 80 });
  const text = el('textarea', { id: 'text', rows: 6, required: true });
  const moodButtons = MOODS.map((m) => {
    const b = el('button', { type: 'button', className: 'ghost' }, m);
    b.setAttribute('aria-pressed', String(m === mood));
    b.onclick = () => {
      mood = m;
      moodButtons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    };
    return b;
  });

  const form = el('form', { className: 'card' },
    el('div', { className: 'field' }, el('label', { htmlFor: 'title' }, 'Judul'), title),
    el('div', { className: 'moods' }, ...moodButtons),
    el('div', { className: 'field' }, el('label', { htmlFor: 'text' }, 'Ceritamu hari ini'), text),
    el('button', { type: 'submit' }, 'Simpan entri'));

  form.onsubmit = async (e) => {
    e.preventDefault();
    await addEntry({ title: title.value.trim(), text: text.value.trim(), mood });
    form.reset();
    await refresh();
  };

  async function refresh() {
    const entries = await listEntries();
    list.replaceChildren(...(entries.length ? entries.map(entryCard) : [el('p', {}, 'Belum ada entri.')]));
  }

  function entryCard(e) {
    const del = el('button', { className: 'ghost', type: 'button' }, 'Hapus');
    del.onclick = async () => { await removeEntry(e.id); await refresh(); };
    return el('article', { className: 'card entry' },
      el('h3', {}, `${e.mood} ${e.title}`), el('time', {}, formatDate(e.createdAt)),
      el('p', {}, e.text), del);
  }

  root.append(el('section', { className: 'page' }, el('h1', {}, 'Diary'), form, list));
  await refresh();
}
