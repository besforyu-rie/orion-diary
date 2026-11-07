// Kenangan: benang waktu dari diary dan album (Fan Corner dan Bestie Space menyusul), per bulan.
import { listEntries } from '../services/storage.js';
import { loadAlbums, loadAlbumCover } from '../services/albums.js';
import { loadMySpace } from '../services/spaces.js';
import { getUser } from '../services/auth.js';
import { locale, t } from '../i18n.js';
import { el, formatDate } from '../utils.js';

const MOOD_NAMES = { '😊': 'Happy', '🌙': 'Cozy', '🤩': 'Excited', '🥺': 'Low' };
const SNIPPET = 110;
const monthKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}`; };
const monthLabel = (ts) => new Date(ts).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
const snippet = (s) => { const one = s.replace(/\s+/g, ' ').trim(); return one.length > SNIPPET ? `${one.slice(0, SNIPPET).trimEnd()}…` : one; };

/** Entri dari tanggal + bulan yang sama di tahun-tahun sebelumnya. */
function onThisDay(entries) {
  const now = new Date();
  return entries.filter((e) => {
    const d = new Date(e.createdAt);
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() < now.getFullYear();
  });
}

const entryCard = (e) =>
  el('a', { className: 'card entry', href: `#/entry?id=${e.id}` },
    el('h3', {}, `${e.mood} ${e.title}`), el('time', {}, formatDate(e.createdAt)), el('p', {}, e.text));

/** Satu kejadian di benang waktu: { kind, at, title, text, label, privacy, href, cover } */
function diaryEvent(e) {
  const name = MOOD_NAMES[e.mood];
  return {
    kind: 'diary', at: e.createdAt, href: `#/entry?id=${e.id}`,
    label: [t('tl.kindDiary'), name ? t(`mood.${name}`).toUpperCase() : e.mood].filter(Boolean).join(' · '),
    title: e.title, text: snippet(e.text), shared: e.privacy === 'shared', cover: null,
  };
}
function albumEvent(a) {
  return {
    kind: 'albums', at: a.createdAt, href: `#/album?id=${encodeURIComponent(a.id)}`,
    label: t('tl.kindAlbum'), title: a.cover.title,
    text: a.photoCount ? t('tl.albumText', { n: a.photoCount }) : t('tl.albumEmpty'), shared: a.shared, album: a,
  };
}

/** Ruang bersama: cerita yang dibagikan dan sahabat yang bergabung. Diary pribadi tidak pernah ikut. */
function bestieEvents(space) {
  if (!space) return [];
  const me = getUser()?.uid;
  const posts = space.posts.map((p) => ({
    kind: 'bestie', at: p.createdAt, href: '#/bestie',
    label: [space.name, t('tl.kindBestiePost')].join(' · ').toUpperCase(),
    title: p.title, text: `${p.authorId === me ? t('tl.byMe') : p.authorName}: ${snippet(p.text)}`, shared: true,
  }));
  const joins = space.members.filter((m) => m.joinedAt).map((m) => ({
    kind: 'bestie', at: m.joinedAt, href: '#/bestie',
    label: [space.name, t('tl.kindBestieJoin')].join(' · ').toUpperCase(),
    title: m.uid === me ? t('tl.joinedMe', { space: space.name }) : t('tl.joinedOther', { who: m.name }),
    text: t('tl.joinedText'), shared: true,
  }));
  return [...posts, ...joins];
}

function eventRow(ev) {
  const d = new Date(ev.at);
  const thumb = el('div', { className: 'tl-thumb', hidden: true });
  const card = el('a', { className: 'tl-card', href: ev.href },
    el('div', { className: 'tl-text' },
      el('small', {}, ev.label), el('h3', {}, ev.title), el('p', {}, ev.text),
      el('span', { className: 'tl-privacy' }, ev.shared ? t('tl.shared') : t('tl.onlyMe'))),
    thumb);
  if (ev.album) {
    loadAlbumCover(ev.album).then((src) => {
      if (!src) return;
      thumb.style.backgroundImage = `url("${src}")`; thumb.hidden = false;
    });
  }
  return el('li', { className: 'tl-row' },
    el('div', { className: 'tl-date', 'aria-hidden': 'true' },
      el('b', {}, String(d.getDate()).padStart(2, '0')),
      el('span', {}, d.toLocaleDateString(locale(), { month: 'short' }).replace('.', '').toUpperCase())),
    card);
}

export async function renderTimeline(root) {
  const [entries, albumsResult, spaceResult] = await Promise.all([
    listEntries(),
    loadAlbums().then((list) => ({ list })).catch((err) => { console.error(err); return { failed: true, list: [] }; }),
    loadMySpace().then((space) => ({ space })).catch((err) => { console.error(err); return { failed: true, space: null }; }),
  ]);
  const albums = albumsResult.list.filter((a) => a.editable && a.createdAt);
  const events = [...entries.map(diaryEvent), ...albums.map(albumEvent), ...bestieEvents(spaceResult.space)].sort((a, b) => b.at - a.at);

  const page = el('section', { className: 'page wide tl-page' },
    el('h1', {}, t('tl.heading')), el('p', { className: 'tl-sub' }, t('tl.sub')));

  if (!events.length) {
    page.append(el('div', { className: 'empty' },
      el('img', { className: 'mascot', src: 'assets/images/pip.png', alt: '' }),
      el('p', {}, t('tl.empty')),
      el('a', { className: 'btn', href: '#/write' }, t('tl.writeNow'))));
    return root.append(page);
  }

  const state = { tab: 'all' };
  const tabs = [['all', 'tl.all'], ['diary', 'tl.diary'], ['albums', 'tl.albums'], ['fan', 'tl.fan'], ['bestie', 'tl.bestie']].map(([key, label]) => {
    const b = el('button', { type: 'button', className: 'ghost' }, t(label));
    b.dataset.tab = key;
    b.onclick = () => { state.tab = key; draw(); };
    return b;
  });
  const feed = el('div', { className: 'tl-feed' });
  const side = el('aside', { className: 'tl-side' });
  const chapters = new Map(); // monthKey -> elemen bagian bulan

  function draw() {
    tabs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === state.tab)));
    const shown = events.filter((e) => state.tab === 'all' || e.kind === state.tab);
    chapters.clear();
    const nodes = [];

    if (state.tab === 'all' || state.tab === 'diary') {
      const memories = onThisDay(entries);
      if (memories.length) nodes.push(el('div', { className: 'group' }, el('h2', {}, t('tl.onThisDay')), ...memories.map(entryCard)));
    }
    if (!shown.length) {
      nodes.push(el('p', { className: 'tl-none' }, t(state.tab === 'fan' ? 'tl.soon' : state.tab === 'bestie' ? 'tl.noSpace' : 'tl.emptyTab')));
    }
    const byMonth = new Map();
    shown.forEach((ev) => { const k = monthKey(ev.at); byMonth.set(k, [...(byMonth.get(k) ?? []), ev]); });
    byMonth.forEach((list, k) => {
      const section = el('section', { className: 'tl-month' },
        el('h2', {}, monthLabel(list[0].at)), el('ol', { className: 'tl-list' }, ...list.map(eventRow)));
      chapters.set(k, { node: section, label: monthLabel(list[0].at) });
      nodes.push(section);
    });
    if (albumsResult.failed || spaceResult.failed) nodes.push(el('p', { className: 'tl-none', role: 'status' }, t('tl.loadFail')));
    feed.replaceChildren(...nodes);
    drawSide();
  }

  function drawSide() {
    const now = new Date();
    const key = monthKey(now);
    const inMonth = entries.filter((e) => monthKey(e.createdAt) === key);
    const days = new Set(inMonth.map((e) => new Date(e.createdAt).getDate())).size;
    const jumps = [...new Map(events.map((e) => [monthKey(e.at), e.at])).entries()].map(([k, at]) => {
      const b = el('button', { type: 'button', className: 'ghost' }, k === key ? `${monthLabel(at)} ✓` : monthLabel(at));
      b.onclick = () => {
        const target = chapters.get(k);
        if (target) target.node.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      };
      return b;
    });
    side.replaceChildren(
      el('div', { className: 'card' },
        el('h3', {}, t('tl.joysTitle')),
        el('p', { className: 'tl-big', 'aria-label': String(days) }, String(days).padStart(2, '0')),
        el('p', {}, t('tl.joysText')),
        el('span', { className: 'chip' }, t('tl.joysBadge', { month: now.toLocaleDateString(locale(), { month: 'long' }), n: inMonth.length }))),
      el('div', { className: 'card' }, el('h3', {}, t('tl.jump')), el('div', { className: 'tl-jump' }, ...jumps)));
  }

  page.append(
    el('div', { className: 'tl-tabs', role: 'group', ariaLabel: t('tl.tabs') }, ...tabs),
    el('div', { className: 'tl-layout' }, feed, side));
  draw();
  root.append(page);
}
