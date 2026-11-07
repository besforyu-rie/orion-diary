// Notifikasi dalam aplikasi ("Little signals"). Tidak ada koleksi notifikasi di server:
// semua sinyal dihitung dari data yang sudah ada (jadwal Fan Corner, ruang bersama, undangan,
// ucapan teman, entri diary, ekspor PDF). Yang disimpan hanya penanda "sudah dibaca" di
// preferensi akun (notifRead), jadi ikut tersinkron ke perangkat lain lewat prefs-sync.js.
// Tidak ada push atau email: sinyal hanya muncul di dalam Orion.
import { getUser } from './auth.js';
import { getPrefs, setPrefs } from './prefs.js';
import { listEntries } from './storage.js';
import { listAllWishes } from './wishes.js';
import { loadMySpace, listMyInvites } from './spaces.js';

export const WINDOW_DAYS = 7;           // sinyal lebih tua dari ini tidak ditampilkan
const DAY = 864e5;
const MAX_READ = 300;                    // batas daftar id yang sudah dibaca
const CACHE_MS = 60000;
const REMIND_LEAD_H = 2;                 // pengingat stream muncul 2 jam sebelum mulai
const MILESTONES = [100, 60, 30, 14, 7, 3];

let cache = { uid: null, at: 0, items: [] };
let inflight = null;

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const dayKey = (ts) => new Date(ts).toDateString();
const recent = (ts) => Date.now() - ts <= WINDOW_DAYS * DAY && ts <= Date.now() + 1000;
const snippet = (s, n = 90) => { const one = String(s ?? '').replace(/\s+/g, ' ').trim(); return one.length > n ? `${one.slice(0, n).trimEnd()}…` : one; };

/* ---------- sumber sinyal; masing-masing gagal dengan tenang ---------- */

async function streamSignals() {
  const res = await fetch('data/fan.json');
  if (!res.ok) return [];
  const fan = await res.json();
  const reminders = getPrefs().reminders ?? [];
  const who = (fan.persona?.name ?? '').replace(/[^\p{L}\p{N}\s'’-]/gu, '').trim();
  const now = new Date();
  const out = [];
  const add = (id, title, hhmm) => {
    if (!reminders.includes(id)) return;
    const m = /(\d{1,2})[.:](\d{2})/.exec(hhmm ?? '');
    if (!m) return;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(m[1]), Number(m[2]));
    const at = start.getTime() - REMIND_LEAD_H * 3600e3;
    if (Date.now() < at) return; // belum waktunya
    out.push({ id: `stream:${id}:${dayKey(now)}`, type: 'stream', at, icon: 'bell', href: '#/fan',
      vars: { title, who, time: `${String(m[1]).padStart(2, '0')}:${m[2]}` } });
  };
  for (const w of fan.week ?? []) {
    const day = Number(/\d+/.exec(w.day ?? '')?.[0]);
    if (day === now.getDate()) add(w.id, w.title, w.time);
  }
  const g = fan.gathering;
  if (g && /malam ini|hari ini|tonight|today/i.test(g.when ?? '')) add('gathering', g.title, g.when);
  return out;
}

async function bestieSignals() {
  const space = await loadMySpace();
  if (!space) return [];
  const me = getUser().uid;
  const out = [];
  for (const p of space.posts) {
    if (p.authorId === me || !recent(p.createdAt)) continue;
    out.push({ id: `post:${space.id}:${p.id}`, type: 'bestie', at: p.createdAt, icon: 'heart', href: '#/bestie',
      vars: { who: p.authorName, space: space.name, title: p.title, text: snippet(p.text) } });
  }
  for (const m of space.members) {
    if (m.uid === me || !recent(m.joinedAt ?? 0)) continue;
    out.push({ id: `join:${space.id}:${m.uid}`, type: 'bestieJoin', group: 'bestie', at: m.joinedAt, icon: 'users', href: '#/bestie',
      vars: { who: m.name, space: space.name } });
  }
  return out;
}

async function wishSignals() {
  const out = [];
  for (const w of await listAllWishes()) { // hanya akun pemilik yang boleh membaca; lainnya ditolak dan dilewati
    if (!recent(w.createdAt)) continue;
    out.push({ id: `wish:${w.id}`, type: 'wish', at: w.createdAt, icon: 'mail-heart', href: '#/ucapan',
      vars: { who: w.name, text: snippet(w.text) } });
  }
  return out;
}

async function inviteSignals() {
  const email = getUser().email;
  if (!email || getPrefs().allowInvites === false) return []; // "Allow bestie invitations" mati: undangan tidak ditampilkan
  return (await listMyInvites(email)).map((i) => ({
    id: `invite:${i.token}`, type: 'invite', at: i.createdAt, token: i.token, expiresAt: i.expiresAt, icon: 'mail-heart',
    vars: { who: i.inviterName, space: i.spaceName, message: i.message, date: i.createdAt },
  }));
}

/** Entri diary: tonggak "hari berturut-turut menulis". Hanya tonggak tertinggi yang sedang dijalani. */
async function diarySignals() {
  const entries = await listEntries();
  const days = new Map(); // tanggal -> waktu entri terakhir hari itu
  for (const e of entries) { const k = dayKey(e.createdAt); days.set(k, Math.max(days.get(k) ?? 0, e.createdAt)); }
  let count = 0;
  for (const d = new Date(); days.has(d.toDateString()); d.setDate(d.getDate() - 1)) count++;
  const out = [];
  const now = new Date();
  const nine = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 21, 0).getTime(); // pengingat menulis malam hari
  if (getPrefs().eveningReminder && Date.now() >= nine && !days.has(dayKey(now))) {
    out.push({ id: `evening:${dayKey(now)}`, type: 'evening', at: nine, icon: 'moon', href: '#/write', vars: {} });
  }
  const m = MILESTONES.find((x) => count >= x);
  if (!m) return out;
  const reached = new Date(); reached.setDate(reached.getDate() - (count - m)); // hari saat tonggak tercapai
  const at = days.get(reached.toDateString());
  if (!recent(at)) return out;
  const start = new Date(); start.setDate(start.getDate() - count + 1);
  out.push({ id: `streak:${m}:${dayKey(start)}`, type: 'milestone', at, icon: 'flame', href: '#/diary', vars: { n: m } });
  return out;
}

function exportSignals() {
  const last = getPrefs().lastExport;
  if (!last || !recent(last.at)) return [];
  return [{ id: `export:${last.at}`, type: 'export', at: last.at, icon: 'download', href: '#/settings', vars: { n: last.n, date: last.at } }];
}

/* ---------- daftar, status baca, jumlah ---------- */

/** Semua sinyal terbaru dulu (belum disaring pengaturan). Hasil disimpan 1 menit. */
export async function loadNotifications(force = false) {
  const user = getUser();
  if (!user) return [];
  if (!force && cache.uid === user.uid && Date.now() - cache.at < CACHE_MS) return cache.items;
  if (inflight) return inflight;
  const uid = user.uid;
  inflight = (async () => {
    const parts = await Promise.allSettled([streamSignals(), bestieSignals(), wishSignals(), inviteSignals(), diarySignals(), exportSignals()]);
    parts.filter((p) => p.status === 'rejected').forEach((p) => console.warn('Sebagian sinyal belum bisa dimuat:', p.reason?.code ?? p.reason));
    const items = parts.flatMap((p) => (p.status === 'fulfilled' ? p.value : [])).sort((a, b) => b.at - a.at);
    if (getUser()?.uid === uid) { cache = { uid, at: Date.now(), items }; window.dispatchEvent(new Event('signalschange')); }
    return items;
  })().finally(() => { inflight = null; });
  return inflight;
}

/** Hormati pilihan di Pengaturan. Undangan, ucapan, dan ekspor selalu tampil. */
export function visible(items) {
  const p = getPrefs();
  const off = { stream: p.notifStream === false, bestie: p.notifBestie === false, bestieJoin: p.notifBestie === false, milestone: p.notifNudge === false };
  return items.filter((n) => !off[n.type]);
}

export const isRead = (n) => getPrefs().notifRead.includes(n.id) || (n.type === 'wish' && n.at <= (getPrefs().wishSeenAt ?? 0));
export const isToday = (n) => sameDay(n.at, Date.now());

export const unreadCount = () => (cache.uid && cache.uid === getUser()?.uid ? visible(cache.items).filter((n) => !isRead(n)).length : 0);

const announce = () => window.dispatchEvent(new Event('signalschange'));

export function markRead(ids) {
  const have = getPrefs().notifRead;
  const add = ids.filter((id) => !have.includes(id));
  if (!add.length) return;
  setPrefs({ notifRead: [...have, ...add].slice(-MAX_READ) });
  announce();
}
export const markAllRead = (items) => markRead(items.filter((n) => !isRead(n)).map((n) => n.id));

/** Inbox ucapan dibuka: semua ucapan yang ada sekarang dianggap sudah dilihat. */
export function markWishesSeen() {
  setPrefs({ wishSeenAt: Date.now() });
  announce();
}

/** Setelah undangan ditolak: buang dari daftar tersimpan tanpa memuat ulang semuanya. */
export function dropFromCache(id) {
  cache = { ...cache, items: cache.items.filter((n) => n.id !== id) };
  announce();
}

/** Pengaturan berubah (mis. pengingat malam, undangan): muat ulang diam-diam supaya titik lonceng ikut berubah. */
export function invalidate() {
  cache = { ...cache, at: 0 };
  loadNotifications().catch(() => {});
}
