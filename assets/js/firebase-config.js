// Konfigurasi Firebase. Aman ditaruh di repo publik:
// keamanan data dijaga oleh Security Rules di Firestore, bukan oleh kunci ini.
export const firebaseConfig = {
  apiKey: 'AIzaSyAIrIbaeElO2YHfqhHPnUvyViFifZTkeQE',
  authDomain: 'orion-diary.firebaseapp.com',
  projectId: 'orion-diary',
  storageBucket: 'orion-diary.firebasestorage.app',
  messagingSenderId: '440157856741',
  appId: '1:440157856741:web:bbb9ad0b66daaa29d2c50c',
};

// Ganti ke nama lain (mis. 'orion') kalau database yang dibuat bukan '(default)'.
export const FIRESTORE_DATABASE_ID = '(default)';
