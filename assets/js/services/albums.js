// Album: disimpan di Firestore per pengguna.
//   users/{uid}/albums/{albumId}              judul, surat, urutan halaman (order), photoCount, noteIds
//   users/{uid}/albums/{albumId}/photos/{id}  satu foto per dokumen (data URL JPEG, sudah dikecilkan),
//                                             atau satu halaman teks bebas ({ kind: 'note', text }).
//   `order` memuat id foto DAN halaman teks; `noteIds` menandai mana yang halaman teks; `photoCount` hanya foto.
// Album kado Aretha (data/album.json) disalin ke Firestore sekali, saat pertama dibuka setelah login,
// supaya bisa diedit dan tersimpan permanen. Tanpa login, atau kalau Firestore gagal, album
// ditampilkan langsung dari file JSON (hanya baca).
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, writeBatch, query, orderBy,
  arrayUnion, arrayRemove, increment,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase.js';
import { getUser } from './auth.js';
import { fileToDataUrl } from './image.js';

export const MAX_PHOTOS = 100;

const uid = () => getUser().uid;
const albumsRef = () => collection(db, 'users', uid(), 'albums');
const albumRef = (id) => doc(db, 'users', uid(), 'albums', id);
const photosRef = (id) => collection(db, 'users', uid(), 'albums', id, 'photos');
const photoRef = (id, pid) => doc(db, 'users', uid(), 'albums', id, 'photos', pid);
const seedFlagRef = () => doc(db, 'users', uid(), 'meta', 'albums');

/* ---------- album dari file JSON (cadangan + bahan seed) ---------- */

let staticCache = null;
async function loadStatic() {
  if (!staticCache) {
    const files = await (await fetch('data/albums.json')).json();
    const raw = await Promise.all(files.map(async (file) => (await fetch(file)).json()));
    staticCache = raw.map((a) => ({
      id: a.id,
      editable: false, shared: false, sharedLabel: '', updatedAt: null,
      title: a.title ?? a.cover?.title ?? '',
      cover: { label: a.cover?.label ?? '', title: a.cover?.title ?? a.title ?? '' },
      to: a.to ?? '', from: a.from ?? '', date: a.date ?? '',
      dedication: a.dedication ?? '', letter: a.letter ?? [], ending: a.ending ?? '',
      photoCount: a.photos.length, order: [], noteIds: [], kinds: a.photos.map(() => 'photo'),
      photos: a.photos.map((p) => ({ id: null, kind: 'photo', src: p.src, caption: p.caption ?? '', alt: p.alt ?? '', focus: p.focus })),
    }));
    staticCache.forEach((a) => { a.items = a.photos; });
  }
  return staticCache.map((a) => ({ ...a, photos: [...a.photos], items: [...a.items] }));
}

/* ---------- bentuk data ---------- */

const fromDoc = (id, d) => ({
  id,
  editable: true,
  title: d.title,
  cover: { label: d.coverLabel ?? '', title: d.title },
  to: d.to ?? '', from: d.from ?? '', date: d.date ?? '',
  dedication: d.dedication ?? '', letter: d.letter ?? [], ending: d.ending ?? '',
  order: d.order ?? [],
  noteIds: d.noteIds ?? [],
  kinds: (d.order ?? []).map((pid) => ((d.noteIds ?? []).includes(pid) ? 'note' : 'photo')),
  photoCount: d.photoCount ?? 0,
  createdAt: d.createdAt ?? null,
  updatedAt: d.updatedAt ?? d.createdAt ?? null,
  shared: d.shared === true, sharedLabel: d.sharedLabel ?? '', // diisi nanti oleh Bestie Space
  photos: [], items: [],
});

/* ---------- seed album kado ---------- */

async function seedIfNeeded() {
  if ((await getDoc(seedFlagRef())).exists()) return;
  const statics = await loadStatic();
  for (const a of statics) {
    const ids = a.photos.map((_, i) => `seed-${String(i + 1).padStart(2, '0')}`);
    // Id tetap, jadi kalau seed terputus di tengah jalan, mengulang tidak membuat foto ganda.
    await setDoc(albumRef(a.id), {
      title: a.title, coverLabel: a.cover.label, to: a.to, from: a.from, date: a.date,
      dedication: a.dedication, letter: a.letter, ending: a.ending,
      order: ids, photoCount: ids.length, createdAt: Date.now(), updatedAt: Date.now(),
    });
    await Promise.all(a.photos.map(async (p, i) => {
      const blob = await (await fetch(p.src)).blob();
      const data = await fileToDataUrl(blob);
      await setDoc(photoRef(a.id, ids[i]), {
        data, caption: p.caption, alt: p.alt, focus: p.focus ?? '50% 50%', createdAt: Date.now() + i,
      });
    }));
  }
  await setDoc(seedFlagRef(), { seeded: true, at: Date.now() });
}

/* ---------- baca ---------- */

/** Daftar album (tanpa isi foto kalau dari Firestore; cukup untuk rak). */
export async function loadAlbums() {
  if (!getUser()) return loadStatic();
  try {
    await seedIfNeeded();
    const snap = await getDocs(query(albumsRef(), orderBy('createdAt')));
    return snap.docs.map((d) => fromDoc(d.id, d.data()));
  } catch (err) {
    console.error('Album dari Firestore gagal dimuat, memakai file JSON:', err);
    return loadStatic();
  }
}

/** Satu album lengkap dengan foto-fotonya, urut sesuai `order`. */
export async function loadAlbum(id) {
  const list = await loadAlbums();
  const album = list.find((a) => a.id === id) ?? list[0];
  if (!album || !album.editable) return album;
  const snap = await getDocs(photosRef(album.id));
  const byId = new Map(snap.docs.map((d) => [d.id, d.data()]));
  const known = album.order.filter((pid) => byId.has(pid));
  const extra = [...byId.keys()].filter((pid) => !album.order.includes(pid)); // jaga-jaga kalau order tertinggal
  album.items = [...known, ...extra].map((pid) => {
    const p = byId.get(pid);
    if (p.kind === 'note' || album.noteIds.includes(pid)) return { id: pid, kind: 'note', text: p.text ?? '' };
    return { id: pid, kind: 'photo', src: p.data, caption: p.caption ?? '', alt: p.alt ?? '', focus: p.focus };
  });
  album.photos = album.items.filter((i) => i.kind === 'photo');
  album.kinds = album.items.map((i) => i.kind);
  album.photoCount = album.photos.length;
  return album;
}

/** Foto pertama sebuah album (data URL) untuk gambar kecil, atau null. Hanya membaca satu dokumen. */
export async function loadAlbumCover(album) {
  if (!album.editable) return album.photos?.[0]?.src ?? null;
  const first = album.order.find((pid) => !album.noteIds.includes(pid));
  if (!first) return null;
  try {
    const snap = await getDoc(photoRef(album.id, first));
    return snap.exists() ? snap.data().data ?? null : null;
  } catch { return null; }
}

/* ---------- tulis (dipakai langkah berikutnya: rak, susun, upload) ---------- */

export async function createAlbum({ title, coverLabel = '', to = '', from = '', date = '', dedication = '', letter = [], ending = '' }) {
  const ref = await addDoc(albumsRef(), {
    title, coverLabel, to, from, date, dedication, letter, ending,
    order: [], noteIds: [], photoCount: 0, createdAt: Date.now(), updatedAt: Date.now(),
  });
  return ref.id;
}

export const updateAlbum = (id, fields) => updateDoc(albumRef(id), { ...fields, updatedAt: Date.now() });

/** Kecilkan lalu simpan satu foto di akhir album. Mengembalikan { id, src }. */
export async function addPhoto(albumId, file) {
  const album = (await getDoc(albumRef(albumId))).data();
  if ((album?.photoCount ?? 0) >= MAX_PHOTOS) throw Object.assign(new Error('album-full'), { code: 'album-full' });
  const data = await fileToDataUrl(file);
  const ref = doc(photosRef(albumId));
  const batch = writeBatch(db);
  batch.set(ref, { data, caption: '', alt: '', focus: '50% 50%', createdAt: Date.now() });
  batch.update(albumRef(albumId), { order: arrayUnion(ref.id), photoCount: increment(1), updatedAt: Date.now() });
  await batch.commit();
  return { id: ref.id, src: data };
}

/** Ganti gambar sebuah foto (caption dan posisinya tetap). Mengembalikan data URL baru. */
export async function replacePhotoImage(albumId, photoId, file) {
  const data = await fileToDataUrl(file);
  await updateDoc(photoRef(albumId, photoId), { data });
  await updateDoc(albumRef(albumId), { updatedAt: Date.now() });
  return data;
}

/** Ubah caption, teks alternatif, atau titik fokus foto. */
export function updatePhoto(albumId, photoId, { caption, alt, focus }) {
  const fields = Object.fromEntries(Object.entries({ caption, alt, focus }).filter(([, v]) => v !== undefined));
  return updateDoc(photoRef(albumId, photoId), fields);
}

export async function removePhoto(albumId, photoId) {
  const batch = writeBatch(db);
  batch.delete(photoRef(albumId, photoId));
  batch.update(albumRef(albumId), { order: arrayRemove(photoId), photoCount: increment(-1), updatedAt: Date.now() });
  await batch.commit();
}

/* ---------- halaman teks bebas (catatan tulisan tangan di antara foto) ---------- */

export const MAX_NOTE_CHARS = 450; // lebih dari ini tidak muat di satu sisi halaman

/** Tambah halaman teks di akhir album. Mengembalikan id-nya. */
export async function addNote(albumId, text) {
  const ref = doc(photosRef(albumId));
  const batch = writeBatch(db);
  batch.set(ref, { kind: 'note', text: text.slice(0, MAX_NOTE_CHARS), createdAt: Date.now() });
  batch.update(albumRef(albumId), { order: arrayUnion(ref.id), noteIds: arrayUnion(ref.id), updatedAt: Date.now() });
  await batch.commit();
  return ref.id;
}

export const updateNote = (albumId, noteId, text) => updateDoc(photoRef(albumId, noteId), { text: text.slice(0, MAX_NOTE_CHARS) });

export async function removeNote(albumId, noteId) {
  const batch = writeBatch(db);
  batch.delete(photoRef(albumId, noteId));
  batch.update(albumRef(albumId), { order: arrayRemove(noteId), noteIds: arrayRemove(noteId), updatedAt: Date.now() });
  await batch.commit();
}

/** Simpan urutan baru: `ids` adalah daftar id foto dan halaman teks dari depan ke belakang. */
export const reorderPhotos = (albumId, ids) => updateAlbum(albumId, { order: ids });

export async function deleteAlbum(albumId) {
  const snap = await getDocs(photosRef(albumId));
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  const batch = writeBatch(db);
  batch.delete(albumRef(albumId));
  await batch.commit();
}
