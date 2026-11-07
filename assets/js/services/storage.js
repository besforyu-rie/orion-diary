// Penyimpanan entri diary di Firestore: users/{uid}/entries/{id}
// Antarmuka (listEntries/addEntry/removeEntry) sama seperti versi localStorage.
import {
  collection, addDoc, getDocs, getDoc, deleteDoc, setDoc, doc, query, orderBy,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase.js';
import { getUser } from './auth.js';

const entriesRef = () => collection(db, 'users', getUser().uid, 'entries');

export async function listEntries() {
  const snap = await getDocs(query(entriesRef(), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getEntry(id) {
  const snap = await getDoc(doc(db, 'users', getUser().uid, 'entries', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

const MAX_HTML = 200000; // teks kaya (tanpa foto) jauh di bawah batas 1 MiB per dokumen
const photosRef = (id) => collection(db, 'users', getUser().uid, 'entries', id, 'photos');

/** Simpan entri. `html` = tulisan berformat (foto hanya berupa penanda data-photo), `photos` = [{ id, data }]. */
/** ID dibuat sekali di awal, jadi menyimpan ulang setelah gagal menimpa entri yang sama (tidak dobel). */
export const newEntryId = () => doc(entriesRef()).id;

export async function addEntry({ id, title, text, mood, tags = [], privacy = 'private', handwritten = false, createdAt = Date.now(), html = '', photos = [] }) {
  const entry = { title, text, mood, tags, privacy, handwritten, createdAt };
  if (html) {
    if (html.length > MAX_HTML) throw Object.assign(new Error('too-long'), { code: 'too-long' });
    entry.html = html; entry.photoCount = photos.length;
  }
  const ref = id ? doc(entriesRef(), id) : doc(entriesRef());
  await setDoc(ref, entry);
  try {
    for (const p of photos) await setDoc(doc(photosRef(ref.id), p.id), { data: p.data });
  } catch (err) { // jangan tinggalkan entri setengah jadi
    await removeEntry(ref.id).catch(() => {});
    throw err;
  }
  return { id: ref.id, ...entry };
}

/** Foto di dalam tulisan: { id: dataUrl }. */
export async function getEntryPhotos(id) {
  const snap = await getDocs(photosRef(id));
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data().data]));
}

export async function removeEntry(id) {
  const snap = await getDocs(photosRef(id));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, 'users', getUser().uid, 'entries', id));
}
