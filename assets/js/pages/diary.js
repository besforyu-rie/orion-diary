import { listEntries } from '../services/storage.js';
import { locale, t } from '../i18n.js';
import { el, formatDate, icon } from '../utils.js';

const sameMonth = (ts, y, m) => { const d = new Date(ts); return d.getFullYear() === y && d.getMonth() === m; };
/** Nama hari singkat Senin-Minggu sesuai bahasa (5 Jan 2026 adalah hari Senin). */
const weekdays = () => Array.from({ length: 7 }, (_, i) =>
  new Date(2026, 0, 5 + i).toLocaleDateString(locale(), { weekday: 'narrow' }));

export async function renderDiary(root) {
  const all = await listEntries();
  const now = new Date();
  const state = { y: now.getFullYear(), m: now.getMonth(), day: null, tag: null, q: '' };
  const calBox = el('div', { className: 'card' });
  const tagBox = el('div', { className: 'card' });
  const list = el('div');
  const search = el('input', { className: 'search', type: 'search', placeholder: t('diary.search'), ariaLabel: t('diary.searchLabel') });
  search.oninput = () => { state.q = search.value.toLowerCase(); draw(); };

  const visible = () => all.filter((e) =>
    (state.q || state.tag || state.day ? true : sameMonth(e.createdAt, state.y, state.m))
    && (!state.day || new Date(e.createdAt).toDateString() === state.day)
    && (!state.tag || (e.tags ?? []).includes(state.tag))
    && (!state.q || `${e.title} ${e.text} ${(e.tags ?? []).join(' ')}`.toLowerCase().includes(state.q)));

  function drawCalendar() {
    const first = new Date(state.y, state.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(state.y, state.m + 1, 0).getDate();
    const withEntries = new Set(all.filter((e) => sameMonth(e.createdAt, state.y, state.m)).map((e) => new Date(e.createdAt).getDate()));
    const shift = (d) => { state.m += d; if (state.m < 0) { state.m = 11; state.y--; } if (state.m > 11) { state.m = 0; state.y++; } state.day = null; draw(); };
    const prev = el('button', { className: 'ghost', ariaLabel: t('diary.prev') }, '‹'); prev.onclick = () => shift(-1);
    const next = el('button', { className: 'ghost', ariaLabel: t('diary.next') }, '›'); next.onclick = () => shift(1);
    const grid = el('div', { className: 'cal' }, ...weekdays().map((w) => el('b', {}, w)), ...Array(offset).fill(0).map(() => el('span')));
    for (let d = 1; d <= days; d++) {
      const key = new Date(state.y, state.m, d).toDateString();
      const b = el('button', { className: withEntries.has(d) ? 'has' : '' }, String(d));
      b.setAttribute('aria-pressed', String(state.day === key));
      b.onclick = () => { state.day = state.day === key ? null : key; draw(); };
      grid.append(b);
    }
    calBox.replaceChildren(el('div', { className: 'row' }, prev, el('strong', {}, first.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })), next), grid);
  }

  function drawTags() {
    const tags = [...new Set(all.flatMap((e) => e.tags ?? []))];
    tagBox.replaceChildren(el('h3', {}, t('diary.tags')),
      ...(tags.length ? tags.map((tag) => {
        const c = el('button', { className: `chip tag ${state.tag === tag ? 'on' : ''}` }, `#${tag}`);
        c.onclick = () => { state.tag = state.tag === tag ? null : tag; draw(); };
        return c;
      }) : [el('p', {}, t('diary.noTags'))]));
  }

  function draw() {
    drawCalendar(); drawTags();
    const items = visible();
    const filtering = Boolean(state.q || state.tag || state.day);
    const clear = el('button', { type: 'button', className: 'ghost' }, t('st.clear'));
    clear.onclick = () => { search.value = ''; state.q = ''; state.tag = null; state.day = null; state.y = now.getFullYear(); state.m = now.getMonth(); draw(); search.focus(); };
    const firstWrite = el('a', { className: 'btn', href: '#/write' }, icon('plus'), t('st.firstWrite'));
    const emptyCard = !items.length && (filtering
      ? el('div', { className: 'card state-card', role: 'status' },
        el('h2', {}, t('st.noResultsTitle')), el('p', {}, t('st.noResults')), el('div', { className: 'ctrl start' }, clear))
      : !all.length
        ? el('div', { className: 'card state-card center', role: 'status' },
          el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
          el('h2', {}, t('st.freshTitle')), el('p', {}, t('st.freshText')),
          el('div', { className: 'ctrl' }, firstWrite), el('small', {}, t('st.freshNote')))
        : null);
    list.replaceChildren(...(items.length ? items.map((e) =>
      el('a', { className: 'card entry', href: `#/entry?id=${e.id}` },
        el('h3', {}, `${e.mood} ${e.title}`), el('time', {}, formatDate(e.createdAt)),
        el('p', {}, e.text.length > 140 ? `${e.text.slice(0, 140)}…` : e.text),
        ...(e.tags ?? []).map((tag) => el('span', { className: 'chip' }, `#${tag}`)))) : [
      emptyCard || el('div', { className: 'empty' }, el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
        el('p', {}, t('diary.empty')))]));
  }

  root.append(el('section', { className: 'page' },
    el('div', { className: 'row' }, el('h1', {}, t('diary.title')), el('a', { className: 'btn', href: '#/write' }, t('diary.new'))),
    el('div', { className: 'two-col' }, el('div', {}, calBox, el('div', { style: 'height:16px' }), tagBox), el('div', {}, search, list))));
  draw();
}
