// Hapus akun dan semua datanya (permintaan dari Pengaturan, setelah konfirmasi).
// Urutan: cek login masih baru -> bersihkan jejak di Bestie Space -> hapus data pribadi -> hapus akun login.
// Tidak ada server: semuanya dari browser, sesuai aturan Firestore (pemilik boleh menghapus datanya sendiri).
import { collection, getDocs, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { deleteUser } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { db } from './firebase.js';
import { getUser } from './auth.js';
import { loadMySpace, listNotes, deleteNote, deletePost, setHeart, leaveSpace, removeMyAlbumTraces } from './spaces.js';

const RECENT_MS = 4 * 60e3; // Firebase menolak hapus akun kalau login sudah lama (sekitar 5 menit)

export const needsFreshLogin = () => {
  const last = Date.parse(getUser()?.metadata?.lastSignInTime ?? '');
  return !(last && Date.now() - last < RECENT_MS);
};

async function wipeCollection(path, subcollection) {
  const snap = await getDocs(collection(db, ...path));
  for (const d of snap.docs) {
    if (subcollection) {
      const inner = await getDocs(collection(d.ref, subcollection));
      await Promise.all(inner.docs.map((x) => deleteDoc(x.ref)));
    }
    await deleteDoc(d.ref);
  }
}

/** Jejak di ruang bersama: cerita, catatan, dan foto album milikku dihapus, hatiku dicabut, lalu keluar dari ruang. */
async function leaveSharedSpace(uid) {
  const space = await loadMySpace().catch(() => null);
  if (!space) return;
  for (const p of space.posts) {
    try {
      if (p.authorId === uid) { await deletePost(space.id, p.id); continue; }
      if (p.hearts.includes(uid)) await setHeart(space.id, p.id, false);
      for (const n of await listNotes(space.id, p.id)) if (n.authorId === uid) await deleteNote(space.id, p.id, n.id);
    } catch (err) { console.warn('Satu jejak di ruang bersama belum terhapus:', err?.code ?? err); }
  }
  try { await removeMyAlbumTraces(space.id); } catch (err) { console.warn('Foto di album bersama belum terhapus:', err?.code ?? err); }
  await leaveSpace(space.id);
}

export async function deleteMyAccount() {
  const user = getUser();
  if (!user) throw Object.assign(new Error('signed-out'), { code: 'signed-out' });
  if (needsFreshLogin()) throw Object.assign(new Error('needs-fresh-login'), { code: 'needs-fresh-login' });
  const uid = user.uid;
  await leaveSharedSpace(uid);
  await wipeCollection(['users', uid, 'entries'], 'photos');
  await wipeCollection(['users', uid, 'albums'], 'photos');
  for (const col of ['fanart', 'spaces', 'meta']) await wipeCollection(['users', uid, col]);
  await deleteUser(user);
  try { // sisa catatan di perangkat ini
    Object.keys(localStorage).filter((k) => k.includes(uid) || k === 'orion-prefs').forEach((k) => localStorage.removeItem(k));
  } catch { /* mode privat */ }
}
