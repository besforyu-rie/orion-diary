# Orion Diary ✦

Website diary + album foto 3D bertema galaksi ungu. HTML, CSS, dan JavaScript murni (tanpa build step).

## Struktur

```
index.html              Titik masuk
data/album.json         Isi album: nama, caption, surat, foto  <- edit ini untuk kado
assets/
  css/                  tokens (warna/font) · base · components · album
  js/
    main.js             Daftar halaman
    router.js           Router hash (#/diary)
    config.js           Nama, tanggal ulang tahun
    utils.js            Fungsi bantu
    pages/              Satu file per halaman
    components/         Komponen yang dipakai ulang (album-book)
    services/storage.js Penyimpanan data (localStorage, nanti Firebase)
  images/               Taruh foto di sini
```

## Menjalankan di komputer

Jangan buka file langsung (fetch JSON diblokir). Jalankan server lokal:

    python3 -m http.server 8000

lalu buka http://localhost:8000

## Deploy ke GitHub Pages

1. Buat repository baru di GitHub, upload semua isi folder ini.
2. Settings → Pages → Source: **Deploy from a branch** → branch `main`, folder `/ (root)`.
3. Tunggu 1-2 menit. Alamatnya `https://USERNAME.github.io/NAMA-REPO/`.

## Mengganti foto

Simpan foto di `assets/images/`, lalu isi `src` di `data/album.json`, misalnya `"src": "assets/images/foto1.jpg"`.
Kompres foto dulu (maks ~300 KB per foto) supaya cepat dibuka.

## Yang belum ada

Fan Corner, Bestie Space, timeline, pengaturan, login (Firebase), dark/light toggle.
