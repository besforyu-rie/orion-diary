// Penyimpanan entri diary. Sekarang memakai localStorage.
// Nanti tinggal ganti isi fungsi di bawah dengan Firebase (Firestore),
// tanpa mengubah kode di pages/.
const KEY = 'orion-diary:entries';

const read = () => JSON.parse(localStorage.getItem(KEY) || '[]');
const write = (entries) => localStorage.setItem(KEY, JSON.stringify(entries));

export async function listEntries() {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

export async function addEntry({ title, text, mood }) {
  const entry = { id: crypto.randomUUID(), title, text, mood, createdAt: Date.now() };
  write([entry, ...read()]);
  return entry;
}

export async function removeEntry(id) {
  write(read().filter((e) => e.id !== id));
}
