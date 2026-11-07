// Penyimpanan entri diary di Firestore: users/{uid}/entries/{id}
// Antarmuka (listEntries/addEntry/removeEntry) sama seperti versi localStorage.
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, orderBy,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase.js';
import { getUser } from './auth.js';

const entriesRef = () => collection(db, 'users', getUser().uid, 'entries');

export async function listEntries() {
  const snap = await getDocs(query(entriesRef(), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addEntry({ title, text, mood }) {
  const entry = { title, text, mood, createdAt: Date.now() };
  const ref = await addDoc(entriesRef(), entry);
  return { id: ref.id, ...entry };
}

export const removeEntry = (id) => deleteDoc(doc(db, 'users', getUser().uid, 'entries', id));
