// Penyimpanan entri diary di Firestore: users/{uid}/entries/{id}
// Antarmuka (listEntries/addEntry/removeEntry) sama seperti versi localStorage.
import {
  collection, addDoc, getDocs, getDoc, deleteDoc, setDoc, updateDoc, deleteField, doc, query, orderBy,
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

/**
 * Ubah entri yang sudah ada (tombol "Edit entry").
 * `photos` = semua foto yang masih ada di tulisan; yang baru ditulis, yang sudah tidak dipakai dihapus.
 * Urutan sengaja: foto baru dulu, lalu entri, baru foto lama dihapus, supaya kegagalan di tengah tidak menghilangkan tulisan.
 */
export async function updateEntry(id, { title, text, mood, tags = [], privacy = 'private', handwritten = false, createdAt, html = '', photos = [] }) {
  const patch = { title, text, mood, tags, privacy, handwritten, createdAt };
  if (html) {
    if (html.length > MAX_HTML) throw Object.assign(new Error('too-long'), { code: 'too-long' });
    patch.html = html; patch.photoCount = photos.length;
  } else { patch.html = deleteField(); patch.photoCount = deleteField(); }

  const have = new Set((await getDocs(photosRef(id))).docs.map((d) => d.id));
  const keep = new Set(photos.map((p) => p.id));
  for (const p of photos) if (!have.has(p.id)) await setDoc(doc(photosRef(id), p.id), { data: p.data });
  await updateDoc(doc(db, 'users', getUser().uid, 'entries', id), patch);
  await Promise.all([...have].filter((pid) => !keep.has(pid)).map((pid) => deleteDoc(doc(photosRef(id), pid))));
}

/** Catat salinan entri yang dibagikan ke Bestie Space ({ sid, pid, name }), atau null untuk melepas. */
export const setEntryShare = (id, sharedTo) =>
  updateDoc(doc(db, 'users', getUser().uid, 'entries', id), { sharedTo: sharedTo ?? deleteField() });

const coverCache = new Map();
/** Foto pertama di dalam tulisan (data URL) untuk gambar kecil di daftar; hanya membaca satu dokumen. null kalau tidak ada. */
export async function getEntryCover(entry) {
  if (!entry.html || !(entry.photoCount > 0)) return null;
  if (coverCache.has(entry.id)) return coverCache.get(entry.id);
  const pid = /data-photo="([\w-]+)"/.exec(entry.html)?.[1];
  let src = null;
  try { if (pid) { const snap = await getDoc(doc(photosRef(entry.id), pid)); src = snap.exists() ? snap.data().data ?? null : null; } } catch { /* tanpa gambar kecil */ }
  coverCache.set(entry.id, src);
  return src;
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
  coverCache.delete(id);
}
