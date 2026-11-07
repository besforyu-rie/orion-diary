import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { auth } from './firebase.js';
import { t } from '../i18n.js';

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

export const authMessage = (err) => {
  const key = `auth.${String(err.code ?? '').replace('auth/', '')}`;
  const text = t(key);
  return text === key ? t('auth.unknown', { code: err.code ?? 'unknown' }) : text;
};
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

