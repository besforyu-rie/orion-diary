// Ucapan teman: koleksi wishes/{id}. Aturan akses ada di firestore.rules.
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, where, serverTimestamp, getCountFromServer,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase.js';

const wishes = collection(db, 'wishes');
const toWish = (d) => {
  const data = d.data();
  return { id: d.id, ...data, createdAt: data.createdAt?.toMillis?.() ?? Date.now() };
};

/** Siapa saja boleh mengirim; tidak bisa langsung tampil di dinding. */
export const addWish = ({ name, text }) =>
  addDoc(wishes, { name, text, reply: '', shared: false, createdAt: serverTimestamp() });

/** Hanya pemilik (Aretha): semua ucapan. */
export async function listAllWishes() {
  const snap = await getDocs(query(wishes, orderBy('createdAt', 'desc')));
  return snap.docs.map(toWish);
}

/** Publik: hanya ucapan yang dipilih Aretha untuk ditampilkan. */
export async function listSharedWishes() {
  const snap = await getDocs(query(wishes, where('shared', '==', true)));
  return snap.docs.map(toWish).sort((a, b) => b.createdAt - a.createdAt);
}

export const updateWish = (id, patch) => updateDoc(doc(db, 'wishes', id), patch);
export const removeWish = (id) => deleteDoc(doc(db, 'wishes', id));

/** Jumlah semua ucapan (hanya pemilik; akun lain ditolak aturan Firestore). */
export const countWishes = async () => (await getCountFromServer(wishes)).data().count;
