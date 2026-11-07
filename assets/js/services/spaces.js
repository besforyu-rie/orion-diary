// Bestie Space: ruang bersama (mis. "Moonbeam Club"), terpisah dari kotak ucapan ulang tahun.
//   spaces/{sid}                      nama, kalimat kecil, pembuat
//   spaces/{sid}/members/{uid}        satu dokumen per anggota (nama panggilan di ruang ini)
//   spaces/{sid}/posts/{pid}          cerita bersama; hearts = daftar uid yang menyukai
//   spaces/{sid}/posts/{pid}/notes/*  catatan kecil di bawah cerita
//   spaceInvites/{token}              undangan (token acak = id dokumen), berlaku 7 hari, untuk satu email
//   spaces/{sid}/albums/main          album bersama (satu per ruang): judul, jumlah foto, penambah terakhir
//   spaces/{sid}/albums/main/photos/* satu foto per dokumen (data URL JPEG), addedBy = yang menambah
//   spaces/{sid}/albumActivity/*      satu dokumen per kali menambah foto ({ authorId, authorName, count }), bahan sinyal di lonceng
//   users/{uid}/spaces/{sid}          penunjuk ke ruang yang diikuti pengguna (hanya bisa dibaca pemiliknya)
// Hanya cerita yang sengaja dibagikan ke ruang yang terlihat anggota; diary pribadi tidak pernah ikut.
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, writeBatch,
  query, orderBy, limit, where, arrayUnion, arrayRemove, increment,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase.js';
import { getUser } from './auth.js';
import { fileToDataUrl } from './image.js';

export const INVITE_DAYS = 7;
export const MAX_POST_CHARS = 2000;
export const MAX_NOTE_CHARS = 300;
export const MAX_SHARED_PHOTOS = 100;
export const SHARED_ALBUM_ID = 'main'; // satu album bersama per ruang; id tetap mencegah dua anggota membuat album ganda

const uid = () => getUser().uid;
const spaceRef = (sid) => doc(db, 'spaces', sid);
const postsRef = (sid) => collection(db, 'spaces', sid, 'posts');
const postRef = (sid, pid) => doc(db, 'spaces', sid, 'posts', pid);
const notesRef = (sid, pid) => collection(db, 'spaces', sid, 'posts', pid, 'notes');
const memberRef = (sid, id) => doc(db, 'spaces', sid, 'members', id);
const pointerRef = (sid) => doc(db, 'users', uid(), 'spaces', sid);
const inviteRef = (token) => doc(db, 'spaceInvites', token);
const sharedAlbumRef = (sid) => doc(db, 'spaces', sid, 'albums', SHARED_ALBUM_ID);
const sharedPhotosRef = (sid) => collection(db, 'spaces', sid, 'albums', SHARED_ALBUM_ID, 'photos');
const sharedPhotoRef = (sid, pid) => doc(db, 'spaces', sid, 'albums', SHARED_ALBUM_ID, 'photos', pid);
const activityRef = (sid) => collection(db, 'spaces', sid, 'albumActivity');

/** Ruang pertama yang diikuti pengguna, lengkap dengan anggota dan cerita terbaru; null kalau belum punya. */
export async function loadMySpace() {
  const pointers = await getDocs(collection(db, 'users', uid(), 'spaces'));
  if (pointers.empty) return null;
  const sid = pointers.docs[0].id;
  let snap;
  try { snap = await getDoc(spaceRef(sid)); } catch (err) { if (err?.code === 'permission-denied') return null; throw err; }
  if (!snap.exists()) return null;
  const [members, posts, album] = await Promise.all([
    getDocs(collection(db, 'spaces', sid, 'members')),
    getDocs(query(postsRef(sid), orderBy('createdAt', 'desc'), limit(50))),
    getDoc(sharedAlbumRef(sid)).catch(() => null), // album gagal dimuat tidak boleh menjatuhkan seluruh ruang
  ]);
  return {
    id: sid, ...snap.data(),
    album: album?.exists() ? { id: album.id, ...album.data() } : null,
    members: members.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0)),
    posts: posts.docs.map((d) => ({ id: d.id, ...d.data(), hearts: d.data().hearts ?? [] })),
  };
}

/** Ruang pertama yang diikuti (tanpa cerita): { id, name, members }, atau null. Dipakai halaman baca entri. */
export async function loadSpaceBrief() {
  const pointers = await getDocs(collection(db, 'users', uid(), 'spaces'));
  if (pointers.empty) return null;
  const sid = pointers.docs[0].id;
  try {
    const [snap, members] = await Promise.all([getDoc(spaceRef(sid)), getDocs(collection(db, 'spaces', sid, 'members'))]);
    if (!snap.exists()) return null;
    return { id: sid, ...snap.data(), members: members.docs.map((d) => ({ uid: d.id, ...d.data() })) };
  } catch (err) { if (err?.code === 'permission-denied') return null; throw err; }
}

/** Satu cerita bersama beserta reaksi dan catatannya. null kalau sudah dihapus atau kamu tidak lagi anggota. */
export async function loadSharedPost(sid, pid) {
  try {
    const [space, post] = await Promise.all([getDoc(spaceRef(sid)), getDoc(postRef(sid, pid))]);
    if (!space.exists() || !post.exists()) return null;
    const [members, notes] = await Promise.all([getDocs(collection(db, 'spaces', sid, 'members')), listNotes(sid, pid)]);
    const d = post.data();
    return {
      space: { id: sid, ...space.data() },
      members: members.docs.map((m) => ({ uid: m.id, ...m.data() })),
      post: { id: pid, ...d, hearts: d.hearts ?? [], stars: d.stars ?? [], moons: d.moons ?? [] },
      notes,
    };
  } catch (err) { if (err?.code === 'permission-denied') return null; throw err; }
}

export async function createSpace({ name, tagline = '', myName }) {
  const ref = doc(collection(db, 'spaces'));
  const batch = writeBatch(db);
  batch.set(ref, { name, tagline, createdBy: uid(), createdAt: Date.now() });
  batch.set(memberRef(ref.id, uid()), { name: myName, role: 'owner', joinedAt: Date.now() });
  batch.set(pointerRef(ref.id), { name, joinedAt: Date.now() });
  await batch.commit();
  return ref.id;
}

export const updateSpace = (sid, { name, tagline }) => updateDoc(spaceRef(sid), { name, tagline });

/* ---------- cerita bersama ---------- */

export const addPost = (sid, { title, text, mood, authorName }) =>
  addDoc(postsRef(sid), { authorId: uid(), authorName, title, text, mood, hearts: [], createdAt: Date.now() });

export const deletePost = (sid, pid) => deleteDoc(postRef(sid, pid));

export const setHeart = (sid, pid, on) =>
  updateDoc(postRef(sid, pid), { hearts: on ? arrayUnion(uid()) : arrayRemove(uid()) });

/** Reaksi: heart = hearts (sama dengan tombol suka di Bestie Space), star = stars, moon = moons. */
export const REACTION_FIELD = { heart: 'hearts', star: 'stars', moon: 'moons' };
export const setReaction = (sid, pid, kind, on) =>
  updateDoc(postRef(sid, pid), { [REACTION_FIELD[kind]]: on ? arrayUnion(uid()) : arrayRemove(uid()) });

export async function listNotes(sid, pid) {
  const snap = await getDocs(query(notesRef(sid, pid), orderBy('createdAt')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export const addNote = (sid, pid, { text, authorName }) =>
  addDoc(notesRef(sid, pid), { authorId: uid(), authorName, text, createdAt: Date.now() });
export const deleteNote = (sid, pid, nid) => deleteDoc(doc(db, 'spaces', sid, 'posts', pid, 'notes', nid));

/* ---------- undangan ---------- */

const randomToken = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, '');

/** Membuat undangan untuk satu email. Mengembalikan token (bagian dari tautan). */
export async function createInvite({ space, inviterName, email, message }) {
  const token = randomToken();
  await setDoc(inviteRef(token), {
    spaceId: space.id, spaceName: space.name, inviterId: uid(), inviterName,
    email: email.trim().toLowerCase(), message, status: 'pending',
    createdAt: Date.now(), expiresAt: Date.now() + INVITE_DAYS * 864e5,
  });
  return token;
}

export async function listPendingInvites(sid) {
  const snap = await getDocs(query(collection(db, 'spaceInvites'), where('spaceId', '==', sid), where('status', '==', 'pending')));
  return snap.docs.map((d) => ({ token: d.id, ...d.data() })).filter((i) => i.expiresAt > Date.now());
}

/** Undangan yang masih berlaku untuk email akun ini (untuk halaman notifikasi). */
export async function listMyInvites(email) {
  const snap = await getDocs(query(collection(db, 'spaceInvites'),
    where('email', '==', email.trim().toLowerCase()), where('status', '==', 'pending')));
  return snap.docs.map((d) => ({ token: d.id, ...d.data() })).filter((i) => i.expiresAt > Date.now());
}

/** Sahabat yang diundang menolak: undangan ditutup, tidak ada akses yang diberikan. */
export const declineInvite = (token) => updateDoc(inviteRef(token), { status: 'declined' });

export const cancelInvite = (token) => updateDoc(inviteRef(token), { status: 'cancelled' });

export async function getInvite(token) {
  const snap = await getDoc(inviteRef(token));
  return snap.exists() ? { token, ...snap.data() } : null;
}

/** Sahabat yang diundang bergabung: jadi anggota, undangan ditandai terpakai, ruang muncul di akunnya. */
export async function acceptInvite(invite, myName) {
  const batch = writeBatch(db);
  batch.set(memberRef(invite.spaceId, uid()), { name: myName, role: 'member', joinedAt: Date.now(), inviteToken: invite.token });
  batch.update(inviteRef(invite.token), { status: 'accepted', acceptedBy: uid() });
  batch.set(pointerRef(invite.spaceId), { name: invite.spaceName, joinedAt: Date.now() });
  await batch.commit();
}

/** Tautan undangan yang dikirim ke sahabat: selalu alamat GitHub Pages (CONFIG.shareUrl), tidak pernah localhost. */
export function inviteLink(token, publicUrl) {
  return `${publicUrl.split('#')[0]}#/join?t=${token}`;
}

/** Keluar dari ruang: hapus keanggotaan sendiri (akses ke ruang itu berhenti). */
export const leaveSpace = (sid) => deleteDoc(memberRef(sid, uid()));

/* ---------- album bersama ---------- */

/** Ruang pertama beserta albumnya, tanpa cerita dan foto: { space, album }, atau null kalau belum punya ruang. Dipakai rak album. */
export async function loadSpaceAlbumBrief() {
  const space = await loadSpaceBrief();
  if (!space) return null;
  const snap = await getDoc(sharedAlbumRef(space.id));
  return { space, album: snap.exists() ? { id: snap.id, ...snap.data() } : null };
}

/** Teks di atas judul sampul: nama anggota, mis. "NAYA + ALYA". */
export const memberLabel = (members) => members.map((m) => m.name).join(' + ').toUpperCase();

export async function createSharedAlbum(sid, { title, date }) {
  await setDoc(sharedAlbumRef(sid), {
    title, date, createdBy: uid(), createdAt: Date.now(), updatedAt: Date.now(), photoCount: 0,
  });
}

export const renameSharedAlbum = (sid, title) => updateDoc(sharedAlbumRef(sid), { title, updatedAt: Date.now() });

/** Album bersama lengkap dengan foto (urut waktu ditambahkan), dalam bentuk yang dimengerti buku album. null kalau belum ada. */
export async function loadSharedAlbum(sid) {
  const [space, album, members, photos] = await Promise.all([
    getDoc(spaceRef(sid)), getDoc(sharedAlbumRef(sid)),
    getDocs(collection(db, 'spaces', sid, 'members')),
    getDocs(query(sharedPhotosRef(sid), orderBy('createdAt'))),
  ]);
  if (!space.exists() || !album.exists()) return null;
  const d = album.data();
  const names = members.docs.map((m) => ({ uid: m.id, ...m.data() })).sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
  const items = photos.docs.map((p) => {
    const x = p.data();
    return { id: p.id, kind: 'photo', src: x.data, caption: x.caption ?? '', alt: x.alt ?? '', focus: x.focus, addedBy: x.addedBy, addedByName: x.addedByName ?? '' };
  });
  const me = uid();
  return {
    id: album.id, spaceId: sid, spaceName: space.data().name,
    shared: true, sharedLabel: space.data().name, editable: false, isSpaceAlbum: true,
    canRename: d.createdBy === me || space.data().createdBy === me,
    title: d.title, cover: { label: memberLabel(names), title: d.title },
    to: '', from: '', date: d.date ?? '', dedication: '', letter: [], ending: '',
    updatedAt: d.updatedAt ?? d.createdAt ?? null,
    photos: items, items, kinds: items.map(() => 'photo'), photoCount: items.length,
  };
}

/** Beberapa foto terbaru (terbaru dulu) untuk deretan "Baru ditambahkan" di tab Album kami. */
export async function listRecentSharedPhotos(sid, n = 6) {
  const snap = await getDocs(query(sharedPhotosRef(sid), orderBy('createdAt', 'desc'), limit(n)));
  return snap.docs.map((d) => { const x = d.data(); return { id: d.id, src: x.data, caption: x.caption ?? '', addedByName: x.addedByName ?? '', addedBy: x.addedBy, createdAt: x.createdAt }; });
}

/** Kecilkan lalu simpan satu foto di akhir album bersama; penambah terakhir ikut dicatat di albumnya. */
export async function addSharedPhoto(sid, file, authorName) {
  const album = (await getDoc(sharedAlbumRef(sid))).data();
  if ((album?.photoCount ?? 0) >= MAX_SHARED_PHOTOS) throw Object.assign(new Error('album-full'), { code: 'album-full' });
  const data = await fileToDataUrl(file);
  const ref = doc(sharedPhotosRef(sid));
  const batch = writeBatch(db);
  batch.set(ref, { data, caption: '', alt: '', focus: '50% 50%', addedBy: uid(), addedByName: authorName, createdAt: Date.now() });
  batch.update(sharedAlbumRef(sid), {
    photoCount: increment(1), lastPhotoBy: uid(), lastPhotoByName: authorName, lastPhotoAt: Date.now(), updatedAt: Date.now(),
  });
  await batch.commit();
  return { id: ref.id, src: data };
}

/** Satu catatan per kali menambah foto ("Alya menambahkan 4 kenangan"), dibaca lonceng anggota lain. */
export const logAlbumActivity = (sid, { authorName, count }) =>
  addDoc(activityRef(sid), { authorId: uid(), authorName, count, createdAt: Date.now() });

export async function listAlbumActivity(sid) {
  const snap = await getDocs(query(activityRef(sid), orderBy('createdAt', 'desc'), limit(20)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Keterangan hanya bisa diubah oleh yang menambahkan fotonya (aturan Firestore). */
export const updateSharedPhoto = (sid, pid, { caption }) => updateDoc(sharedPhotoRef(sid, pid), { caption });

export async function removeSharedPhoto(sid, pid) {
  const batch = writeBatch(db);
  batch.delete(sharedPhotoRef(sid, pid));
  batch.update(sharedAlbumRef(sid), { photoCount: increment(-1), updatedAt: Date.now() });
  await batch.commit();
}

/** Hapus akun: foto yang kutambahkan dan catatan aktivitasku di album bersama ikut dihapus. */
export async function removeMyAlbumTraces(sid) {
  const me = uid();
  const mine = await getDocs(query(sharedPhotosRef(sid), where('addedBy', '==', me)));
  for (const p of mine.docs) await removeSharedPhoto(sid, p.id);
  const acts = await getDocs(query(activityRef(sid), where('authorId', '==', me)));
  await Promise.all(acts.docs.map((a) => deleteDoc(a.ref)));
}
