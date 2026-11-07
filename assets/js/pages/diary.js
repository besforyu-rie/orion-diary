// Daftar Diary (B2), mengikuti frame Figma "Your diary, in little chapters":
// pencarian, tampilan Kalender/Daftar, filter mood dan privasi, kalender dengan penanda hari, label, dan kartu entri berfoto kecil.
import { listEntries } from '../services/storage.js';
import { entryCard, moodLabel, isShared, streak } from '../components/entry-card.js';
import { locale, t } from '../i18n.js';
import { el, icon } from '../utils.js';

const PAGE = 20;
const sameMonth = (ts, y, m) => { const d = new Date(ts); return d.getFullYear() === y && d.getMonth() === m; };
/** Nama hari singkat Senin-Minggu sesuai bahasa (5 Jan 2026 adalah hari Senin). */
const weekdays = () => Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i).toLocaleDateString(locale(), { weekday: 'narrow' }));
const monthName = (y, m, opt = { month: 'long' }) => new Date(y, m, 1).toLocaleDateString(locale(), opt);

export async function renderDiary(root) {
  const all = await listEntries(); // terbaru dulu
  const now = new Date();
  const state = { y: now.getFullYear(), m: now.getMonth(), day: null, tag: null, q: '', mood: 'all', priv: 'all', view: 'calendar', sort: 'desc', shown: PAGE };

  const search = el('input', { id: 'dy-search', type: 'search', placeholder: t('diary.search'), autocomplete: 'off' });
  search.oninput = () => { state.q = search.value.trim().toLowerCase(); state.shown = PAGE; draw(); };

  const viewBtns = [['calendar', 'diary.calendar'], ['list', 'diary.list']].map(([v, k]) => {
    const b = el('button', { type: 'button', className: 'ghost' }, t(k));
    b.onclick = () => { state.view = v; state.day = null; state.shown = PAGE; draw(); };
    return [b, v];
  });
  const moods = [...new Set(all.map((e) => e.mood).filter(Boolean))];
  const moodSel = el('select', { id: 'dy-mood', 'aria-label': t('diary.moodFilter') },
    el('option', { value: 'all' }, t('diary.allMoods')), ...moods.map((m) => el('option', { value: m }, moodLabel(m))));
  moodSel.onchange = () => { state.mood = moodSel.value; state.shown = PAGE; draw(); };
  const privSel = el('select', { id: 'dy-priv', 'aria-label': t('diary.privFilter') },
    el('option', { value: 'all' }, t('diary.allPriv')), el('option', { value: 'private' }, t('entry.badgeMe')), el('option', { value: 'shared' }, t('nav.bestie')));
  privSel.onchange = () => { state.priv = privSel.value; state.shown = PAGE; draw(); };

  const calBox = el('section', { className: 'card dy-cal' });
  const tagBox = el('section', { className: 'card' });
  const heading = el('h2', { className: 'dy-h' });
  const sortBtn = el('button', { type: 'button', className: 'linklike' });
  sortBtn.onclick = () => { state.sort = state.sort === 'desc' ? 'asc' : 'desc'; draw(); };
  const list = el('div', { className: 'dy-list' });
  const live = el('p', { className: 'sr-only', role: 'status' });

  const hasTag = (e, tag) => (e.tags ?? []).includes(tag);
  const base = () => all.filter((e) =>
    (!state.q || `${e.title} ${e.text} ${(e.tags ?? []).join(' ')}`.toLowerCase().includes(state.q))
    && (!state.tag || hasTag(e, state.tag))
    && (state.mood === 'all' || e.mood === state.mood)
    && (state.priv === 'all' || (state.priv === 'shared') === isShared(e)));
  const wide = () => !!(state.q || state.tag || state.view === 'list'); // bukan hanya satu bulan
  const filtered = () => base().filter((e) => wide() || (state.day ? new Date(e.createdAt).toDateString() === state.day : sameMonth(e.createdAt, state.y, state.m)));
  const dirty = () => !!(state.q || state.tag || state.mood !== 'all' || state.priv !== 'all' || state.day);
  const clear = () => { Object.assign(state, { q: '', tag: null, mood: 'all', priv: 'all', day: null, shown: PAGE }); search.value = ''; moodSel.value = 'all'; privSel.value = 'all'; draw(); };

  function drawCalendar() {
    const first = new Date(state.y, state.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(state.y, state.m + 1, 0).getDate();
    const counts = new Map();
    base().filter((e) => sameMonth(e.createdAt, state.y, state.m)).forEach((e) => { const d = new Date(e.createdAt).getDate(); counts.set(d, (counts.get(d) ?? 0) + 1); });
    const shift = (d) => { state.m += d; if (state.m < 0) { state.m = 11; state.y--; } if (state.m > 11) { state.m = 0; state.y++; } state.day = null; state.shown = PAGE; draw(); };
    const prev = el('button', { type: 'button', className: 'ghost cal-nav', 'aria-label': t('diary.prev') }, icon('arrow-left')); prev.onclick = () => shift(-1);
    const next = el('button', { type: 'button', className: 'ghost cal-nav', 'aria-label': t('diary.next') }, icon('arrow-right')); next.onclick = () => shift(1);
    const grid = el('div', { className: 'cal', role: 'group', 'aria-label': monthName(state.y, state.m, { month: 'long', year: 'numeric' }) },
      ...weekdays().map((w) => el('b', { 'aria-hidden': 'true' }, w)), ...Array(offset).fill(0).map(() => el('span')));
    for (let d = 1; d <= days; d++) {
      const date = new Date(state.y, state.m, d), key = date.toDateString(), n = counts.get(d) ?? 0;
      const b = el('button', { type: 'button', className: `${n ? 'has' : ''}${key === now.toDateString() ? ' today' : ''}` }, String(d));
      b.setAttribute('aria-label', `${date.toLocaleDateString(locale(), { day: 'numeric', month: 'long' })}${n ? `, ${t(n === 1 ? 'diary.n1' : 'diary.nN', { n })}` : ''}`);
      b.setAttribute('aria-pressed', String(state.day === key));
      if (key === now.toDateString()) b.setAttribute('aria-current', 'date');
      b.onclick = () => { state.day = state.day === key ? null : key; state.shown = PAGE; draw(); };
      grid.append(b);
    }
    calBox.replaceChildren(
      el('div', { className: 'cal-head' }, prev, el('strong', {}, monthName(state.y, state.m, { month: 'long', year: 'numeric' })), next), grid,
      el('p', { className: 'cal-legend' }, el('i', { 'aria-hidden': 'true' }), t('diary.legend', { date: now.toLocaleDateString(locale(), { day: 'numeric', month: 'long' }) })));
  }

  function drawTags() {
    const counts = new Map();
    all.forEach((e) => (e.tags ?? []).forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    const tags = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    tagBox.replaceChildren(el('h2', { className: 'dy-side-h' }, t('diary.tags')),
      tags.length ? el('div', { className: 'dy-tags' }, ...tags.map(([tag, n]) => {
        const c = el('button', { type: 'button', className: 'chip tag' }, `#${tag} · ${n}`);
        c.setAttribute('aria-pressed', String(state.tag === tag));
        c.onclick = () => { state.tag = state.tag === tag ? null : tag; state.shown = PAGE; draw(); };
        return c;
      })) : el('p', { className: 'muted' }, t('diary.noTags')),
      el('label', { className: 'sr-only', htmlFor: 'dy-priv' }, t('diary.privFilter')), privSel);
  }

  function drawList() {
    const items = filtered().sort((a, b) => (state.sort === 'desc' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt));
    const sub = state.tag ? `#${state.tag}` : state.q ? t('diary.results') : state.day ? new Date(state.day).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })
      : state.view === 'list' ? t('diary.allMoments') : t('diary.monthMoments', { month: monthName(state.y, state.m) });
    heading.textContent = sub;
    sortBtn.textContent = `${t(state.sort === 'desc' ? 'diary.newest' : 'diary.oldest')} ▾`;
    sortBtn.hidden = items.length < 2;
    live.textContent = t(items.length === 1 ? 'diary.n1' : 'diary.nN', { n: items.length });

    if (!all.length) { // belum ada entri sama sekali (E2: "A fresh little universe")
      list.replaceChildren(el('div', { className: 'card state-card center', role: 'status' },
        el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
        el('h2', {}, t('st.freshTitle')), el('p', {}, t('st.freshText')),
        el('div', { className: 'ctrl' }, el('a', { className: 'btn', href: '#/write' }, icon('plus'), t('st.firstWrite'))), el('small', {}, t('st.freshNote'))));
      return;
    }
    if (!items.length) {
      list.replaceChildren(dirty()
        ? el('div', { className: 'card state-card', role: 'status' }, // E2: "No search results"
          el('h2', {}, t('st.noResultsTitle')), el('p', {}, t('st.noResults')),
          el('div', { className: 'ctrl start' }, Object.assign(el('button', { type: 'button', className: 'ghost' }, t('st.clear')), { onclick: () => { clear(); search.focus(); } })))
        : el('div', { className: 'empty card' }, el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
          el('p', {}, t('diary.empty')), el('a', { className: 'btn', href: '#/write' }, t('diary.new'))));
      return;
    }
    const shown = items.slice(0, state.shown);
    const out = []; let last = '';
    shown.forEach((e) => {
      const d = new Date(e.createdAt), key = `${d.getFullYear()}-${d.getMonth()}`;
      if (wide() && key !== last) { out.push(el('h3', { className: 'dy-month' }, monthName(d.getFullYear(), d.getMonth(), { month: 'long', year: 'numeric' }))); last = key; }
      out.push(entryCard(e));
    });
    if (items.length > shown.length) {
      const more = el('button', { type: 'button', className: 'ghost' }, t('diary.more', { n: items.length - shown.length }));
      more.onclick = () => { state.shown += PAGE; draw(); more.focus?.(); };
      out.push(el('div', { className: 'dy-more' }, more));
    } else out.push(el('p', { className: 'dy-end' }, t(wide() ? 'diary.endAll' : 'diary.end'), ' ✦'));
    list.replaceChildren(...out);
  }

  function draw() {
    viewBtns.forEach(([b, v]) => b.setAttribute('aria-pressed', String(state.view === v)));
    calBox.hidden = state.view !== 'calendar';
    if (state.view === 'calendar') drawCalendar();
    drawTags(); drawList();
  }

  const s = streak(all);
  const subText = [t(all.length === 1 ? 'diary.m1' : 'diary.mN', { n: all.length }), ...(s ? [t('diary.streak', { n: s })] : []), t('diary.belongs')].join(' · ');
  root.append(el('section', { className: 'page wide dy-page' },
    el('div', { className: 'dy-top' },
      el('div', {}, el('h1', {}, t('diary.title')), el('p', { className: 'ed-sub' }, subText)),
      el('a', { className: 'btn', href: '#/write' }, icon('plus'), t('diary.newBtn'))),
    el('div', { className: 'dy-tools' },
      el('div', { className: 'dy-search' }, el('label', { htmlFor: 'dy-search' }, t('diary.searchLabel')), el('div', { className: 'dy-input' }, icon('search'), search)),
      el('div', { className: 'ctrl' }, ...viewBtns.map(([b]) => b), el('label', { className: 'sr-only', htmlFor: 'dy-mood' }, t('diary.moodFilter')), moodSel)),
    live,
    el('div', { className: 'dy-grid' }, el('div', { className: 'dy-side' }, calBox, tagBox),
      el('div', { className: 'dy-main' }, el('div', { className: 'dy-main-head' }, heading, sortBtn), list))));
  draw();
}
