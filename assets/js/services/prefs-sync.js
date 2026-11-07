// Menyambungkan preferensi akun ke Firestore: users/{uid}/meta/prefs.
// Aturan keamanan yang ada (users/{uid}/... hanya pemilik) sudah mencakup path ini.
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase.js';
import { getUser } from './auth.js';
import { accountPrefs, mergeAccountPrefs, setPrefsScope, onAccountPrefsSaved } from './prefs.js';

const ref = (uid) => doc(db, 'users', uid, 'meta', 'prefs');
let pending = Promise.resolve();
let status = 'none'; // 'found' | 'new' | 'failed' | 'none' (hasil memuat pengaturan akun terakhir)
export const prefsStatus = () => status;

/** Selesai ketika preferensi akun yang aktif sudah dimuat dari Firestore (atau gagal dengan tenang). */
export const prefsReady = () => pending;

async function pull(user) {
  status = 'none';
  try {
    const snap = await getDoc(ref(user.uid));
    if (getUser()?.uid !== user.uid) return; // sudah ganti akun selagi menunggu
    if (snap.exists()) {
      status = 'found';
      mergeAccountPrefs(snap.data());
    } else {
      status = 'new';
      const local = accountPrefs();
      if (local.onboarded || local.displayName || local.diaryName) await setDoc(ref(user.uid), local);
    }
  } catch (err) {
    status = 'failed';
    console.warn('Preferensi belum tersinkron, memakai salinan di perangkat ini:', err);
  }
}

/** Panggil saat pengguna masuk/keluar: ganti ruang penyimpanan lokal lalu ambil data akun itu. */
export function syncPrefsFor(user) {
  setPrefsScope(user?.uid);
  pending = user ? pull(user) : Promise.resolve();
  return pending;
}

// Simpan perubahan ke Firestore (ditunda sebentar supaya mengetik tidak menulis tiap huruf).
let timer = null;
let queued = {};
onAccountPrefsSaved((uid, patch) => {
  const user = getUser();
  if (!user || user.uid !== uid) return;
  Object.assign(queued, patch);
  clearTimeout(timer);
  // Penanda "sudah berkenalan" disimpan langsung, supaya tidak hilang kalau tab ditutup.
  timer = setTimeout(async () => {
    const data = queued; queued = {};
    try { await setDoc(ref(user.uid), data, { merge: true }); }
    catch (err) { console.warn('Preferensi belum tersimpan ke Firestore:', err); }
  }, patch.onboarded ? 0 : 800);
});
