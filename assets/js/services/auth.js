import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { auth } from './firebase.js';

const listeners = new Set();

/** Selesai ketika Firebase sudah tahu apakah pengguna login atau belum. */
export const authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => { resolve(user); listeners.forEach((fn) => fn(user)); });
});

export const getUser = () => auth.currentUser;
export const onUserChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const register = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);

const MESSAGES = {
  'auth/invalid-email': 'Format email belum benar.',
  'auth/invalid-credential': 'Email atau password salah.',
  'auth/email-already-in-use': 'Email ini sudah terdaftar. Coba masuk.',
  'auth/weak-password': 'Password minimal 6 karakter.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
  'auth/operation-not-allowed': 'Login Email/Password belum diaktifkan di Firebase.',
  'auth/network-request-failed': 'Koneksi bermasalah. Periksa internet kamu.',
};
export const authMessage = (err) => MESSAGES[err.code] ?? `Terjadi kesalahan (${err.code ?? 'unknown'}).`;
