// Dinding karya penggemar: karya orisinal yang ditambahkan sendiri, disimpan di Firestore per pengguna.
//   users/{uid}/fanart/{id}   { data (data URL JPEG, sudah dikecilkan), caption, createdAt }
// Aturan Firestore untuk users/{uid}/* sudah mencakup koleksi ini (hanya pemilik akun).
import {
  collection, doc, getDocs, addDoc, deleteDoc, query, orderBy,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase.js';
import { getUser } from './auth.js';
import { fileToDataUrl } from './image.js';

export const MAX_FANART = 12;
export const MAX_CAPTION = 80;

const col = () => {
  const user = getUser();
  if (!user) throw Object.assign(new Error('not-signed-in'), { code: 'not-signed-in' });
  return collection(db, 'users', user.uid, 'fanart');
};

/** Karya yang sudah ditambahkan, terbaru dulu. Kosong kalau belum login atau gagal dimuat. */
export async function loadFanArt() {
  if (!getUser()) return [];
  try {
    const snap = await getDocs(query(col(), orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) { console.error(err); return []; }
}

export async function addFanArt(file, caption, currentCount) {
  if (currentCount >= MAX_FANART) throw Object.assign(new Error('art-full'), { code: 'art-full' });
  const data = await fileToDataUrl(file);
  const entry = { data, caption: caption.trim().slice(0, MAX_CAPTION), createdAt: Date.now() };
  const ref = await addDoc(col(), entry);
  return { id: ref.id, ...entry };
}

export const removeFanArt = (id) => deleteDoc(doc(db, 'users', getUser().uid, 'fanart', id));
