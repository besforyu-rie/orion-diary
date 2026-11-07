// Preferensi pengguna. Dua jenis, disimpan terpisah:
//  - Perangkat (bahasa, tema, kurangi gerak): satu untuk semua akun di browser ini, kunci "orion-device".
//  - Akun (nama, nama diary, pengingat, wishlist, onboarding, minat, dst.): satu per akun, kunci
//    "orion-prefs:{uid}", jadi ganti akun di browser yang sama tidak mencampur data.
//    prefs-sync.js menyalinnya juga ke Firestore (users/{uid}/meta/prefs) supaya ikut ke perangkat lain.
const LEGACY_KEY = 'orion-prefs'; // versi lama: satu kunci untuk semua akun
const DEVICE_KEY = 'orion-device';
const DEVICE_DEFAULTS = { lang: 'id', theme: 'dark', reduceMotion: false };
const ACCOUNT_DEFAULTS = {
  displayName: '', diaryName: '', flipSound: false, reminders: [], wishDone: [], wishAdded: [],
  onboarded: false, interests: [], lastExport: null,
  newPrivate: true, allowInvites: true, eveningReminder: false, // privasi & pengingat (E1)
  notifRead: [], wishSeenAt: 0, notifStream: true, notifBestie: true, notifNudge: true, // notifikasi (D4)
};
const DEVICE_KEYS = Object.keys(DEVICE_DEFAULTS);
const ACCOUNT_KEYS = Object.keys(ACCOUNT_DEFAULTS);

let scope = 'guest'; // uid akun yang sedang masuk, atau "guest" kalau belum login
let accountListener = null;

const accountKey = () => `orion-prefs:${scope}`;
const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* mode privat: diabaikan */ } };
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj && typeof obj === 'object' && k in obj).map((k) => [k, obj[k]]));

function readDevice() {
  const own = read(DEVICE_KEY);
  // Pertama kali setelah pembaruan: ambil hanya pilihan perangkat dari kunci lama (data pribadi tidak ikut).
  return { ...DEVICE_DEFAULTS, ...pick(own ?? read(LEGACY_KEY), DEVICE_KEYS) };
}
const readAccount = () => pick(read(accountKey()), ACCOUNT_KEYS);

export function getPrefs() {
  return { ...ACCOUNT_DEFAULTS, ...readDevice(), ...readAccount() };
}

export function setPrefs(patch) {
  const before = getPrefs();
  const next = { ...before, ...patch };
  const device = pick(patch, DEVICE_KEYS);
  const account = pick(patch, ACCOUNT_KEYS);
  if (Object.keys(device).length) write(DEVICE_KEY, { ...readDevice(), ...device });
  if (Object.keys(account).length) {
    write(accountKey(), { ...readAccount(), ...account });
    accountListener?.(scope, account);
    window.dispatchEvent(new Event('prefschange'));
  }
  applyPrefs(next);
  if (next.lang !== before.lang) window.dispatchEvent(new Event('langchange'));
  return next;
}

/** Ganti akun aktif (uid, atau kosong kalau logout). Dipanggil dari main.js lewat prefs-sync.js. */
export function setPrefsScope(uid) {
  scope = uid || 'guest';
  applyPrefs();
}
export const getPrefsScope = () => scope;
export const accountPrefs = () => pick(getPrefs(), ACCOUNT_KEYS);
export const onAccountPrefsSaved = (fn) => { accountListener = fn; };

/** Gabungkan data dari Firestore ke akun aktif (data Firestore menang). */
export function mergeAccountPrefs(remote) {
  write(accountKey(), { ...readAccount(), ...pick(remote, ACCOUNT_KEYS) });
  applyPrefs();
  window.dispatchEvent(new Event('prefschange'));
}

const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)');
const resolveTheme = (theme) => (theme === 'system' ? (systemDark?.matches === false ? 'light' : 'dark') : theme);

export function applyPrefs(prefs = getPrefs()) {
  const root = document.documentElement;
  root.dataset.motion = prefs.reduceMotion ? 'reduce' : 'full';
  root.dataset.theme = resolveTheme(prefs.theme);
  root.lang = prefs.lang === 'en' ? 'en' : 'id';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', root.dataset.theme === 'light' ? '#F4EFFF' : '#1B1035');
}

// Tema "Ikuti sistem" ikut berubah saat pengaturan perangkat berubah.
systemDark?.addEventListener?.('change', () => { if (getPrefs().theme === 'system') applyPrefs(); });
