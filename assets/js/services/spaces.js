// Bestie Space: ruang bersama (mis. "Moonbeam Club"), terpisah dari kotak ucapan ulang tahun.
//   spaces/{sid}                      nama, kalimat kecil, pembuat
//   spaces/{sid}/members/{uid}        satu dokumen per anggota (nama panggilan di ruang ini)
//   spaces/{sid}/posts/{pid}          cerita bersama; hearts = daftar uid yang menyukai
//   spaces/{sid}/posts/{pid}/notes/*  catatan kecil di bawah cerita
//   spaceInvites/{token}              undangan (token acak = id dokumen), berlaku 7 hari, untuk satu email
//   users/{uid}/spaces/{sid}          penunjuk ke ruang yang diikuti pengguna (hanya bisa dibaca pemiliknya)
// Hanya cerita yang sengaja dibagikan ke ruang yang terlihat anggota; diary pribadi tidak pernah ikut.
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, writeBatch,
  query, orderBy, limit, where, arrayUnion, arrayRemove,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase.js';
import { getUser } from './auth.js';

export const INVITE_DAYS = 7;
export const MAX_POST_CHARS = 2000;
export const MAX_NOTE_CHARS = 300;

const uid = () => getUser().uid;
const spaceRef = (sid) => doc(db, 'spaces', sid);
const postsRef = (sid) => collection(db, 'spaces', sid, 'posts');
const postRef = (sid, pid) => doc(db, 'spaces', sid, 'posts', pid);
const notesRef = (sid, pid) => collection(db, 'spaces', sid, 'posts', pid, 'notes');
const memberRef = (sid, id) => doc(db, 'spaces', sid, 'members', id);
const pointerRef = (sid) => doc(db, 'users', uid(), 'spaces', sid);
const inviteRef = (token) => doc(db, 'spaceInvites', token);

/** Ruang pertama yang diikuti pengguna, lengkap dengan anggota dan cerita terbaru; null kalau belum punya. */
export async function loadMySpace() {
  const pointers = await getDocs(collection(db, 'users', uid(), 'spaces'));
  if (pointers.empty) return null;
  const sid = pointers.docs[0].id;
  let snap;
  try { snap = await getDoc(spaceRef(sid)); } catch (err) { if (err?.code === 'permission-denied') return null; throw err; }
  if (!snap.exists()) return null;
  const [members, posts] = await Promise.all([
    getDocs(collection(db, 'spaces', sid, 'members')),
    getDocs(query(postsRef(sid), orderBy('createdAt', 'desc'), limit(50))),
  ]);
  return {
    id: sid, ...snap.data(),
    members: members.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0)),
    posts: posts.docs.map((d) => ({ id: d.id, ...d.data(), hearts: d.data().hearts ?? [] })),
  };
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
