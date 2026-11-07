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

## Album tersimpan di Firestore

- Album disimpan di `users/{uid}/albums/{id}`, fotonya di sub-koleksi `photos` (satu foto per dokumen). Foto dikecilkan di browser (sisi terpanjang 1200 px, JPEG, sekitar 150 KB) oleh `services/image.js`, jadi tidak perlu Firebase Storage.
- Pertama kali Aretha membuka album setelah login, album kado di `data/album.json` disalin ke Firestore (sekali saja, ditandai di `users/{uid}/meta/albums`). Setelah itu isinya diedit lewat aplikasi, bukan lewat JSON.
- Tanpa login, atau kalau Firestore gagal, album tetap tampil dari `data/album.json` (hanya baca).
- Rak album (`#/albums`) punya filter Semua / Hanya aku / Dibagikan, tombol "Album baru", dan banner "Buat album". Tombol pembuat album hanya muncul kalau sudah login dan album tersimpan di Firestore.
- Halaman album (`#/album?id=...`): kepala halaman dengan meta, tombol "Tambah foto" (bisa banyak file sekaligus, maks. 100 foto per album), buku tertutup dengan "Buka albumku", dan penunjuk halaman. Keterangan foto diubah di penampil foto (klik fotonya).
- **Langkah 4: edit isi album** (hanya album tersimpan di Firestore). Di halaman album ada tombol:
  - **Edit album**: judul, label sampul, tanggal, untuk/dari, dedikasi, surat (paragraf dipisah baris kosong), dan kalimat penutup. Album baru pun bisa diberi surat dan dedikasi.
  - **Halaman teks**: catatan tulisan tangan (maks. 450 huruf) yang menjadi satu sisi halaman sendiri. Di buku, tombol pensil di halaman itu mengubah atau menghapusnya.
  - **Susun**: kartu foto dan halaman teks bisa diseret (atau pakai tombol ← →) untuk mengatur urutan, ditandai × untuk dihapus, dan panel "Kenangan terpilih" mengubah keterangan, teks alternatif, atau isi halaman teks. Semua baru tersimpan saat menekan "Simpan susunan"; "Batal" membuang perubahan.
  - **Hapus foto**: ada juga tombol di penampil foto (klik fotonya).
- Halaman teks disimpan di sub-koleksi `photos` yang sama dengan foto (`{ kind: 'note', text }`). `order` memuat id foto dan halaman teks; `noteIds` menandai mana yang teks; `photoCount` hanya menghitung foto. Album lama tanpa `noteIds` tetap jalan.
- Tata letak buku ada di `layoutSides()` (`components/album-book.js`): 2 foto, 1 foto, surat, lalu 2 foto per sisi; halaman teks selalu satu sisi sendiri. Jumlah halaman di rak dan di kepala halaman memakai fungsi yang sama.
- Aturan keamanan baru ada di `firestore.rules` (batas ukuran foto, maks. 100 foto per album).

## Mengganti foto (album dari file JSON)

Simpan foto di `assets/images/`, lalu isi `src` di `data/album.json`, misalnya `"src": "assets/images/foto1.jpg"`.
Kompres foto dulu (maks ~300 KB per foto) supaya cepat dibuka.

## Onboarding, tema, bahasa, ekspor PDF

- **Onboarding** (`#/welcome`, `pages/welcome.js`): 3 langkah (Welcome, Your universe, Ready to glow). Muncul otomatis setelah daftar, atau setelah masuk bila belum pernah dilihat di perangkat ini. Bisa dilewati, dan diulang dari Pengaturan.
- **Mode terang**: Pengaturan → Bahasa & tampilan → Gelap / Terang / Ikuti sistem. Warna ada di `assets/css/tokens.css` (blok `:root[data-theme="light"]`).
- **Bahasa ID/EN**: semua teks antarmuka ada di `assets/js/i18n.js`. Isi diary, `data/*.json` (album, Fan Corner) tetap seperti yang kamu tulis.
- **Ekspor PDF** (Pengaturan → Kata-katamu, untuk disimpan): pilih bulan dan isi, lalu di dialog cetak pilih "Simpan sebagai PDF". Tampilan cetaknya di `assets/css/print.css`.
- **Tautan untuk teman** diatur di `assets/js/config.js` (`shareUrl`), bukan lagi mengikuti alamat yang sedang dibuka.

## Fan Corner & Pengaturan

Isi Fan Corner diedit di `data/fan.json` (nama, jadwal, momen, kutipan, wishlist). Pengaturan disimpan per akun (`services/prefs.js`): nama, nama diary, pengingat, wishlist, onboarding, dan minat tersimpan di browser dengan kunci `orion-prefs:{uid}` dan disalin ke Firestore (`users/{uid}/meta/prefs`, lewat `services/prefs-sync.js`) supaya ikut ke perangkat lain. Bahasa, tema, dan kurangi gerak adalah pilihan perangkat (`orion-device`), sama untuk semua akun di browser itu.

## Bestie Space (ucapan teman)

- `#/kirim` (publik): teman menulis ucapan tanpa akun. Bagikan tautan ini.
- `#/bestie` (khusus Aretha): inbox, balas, pilih ucapan yang tampil di dinding.
- `#/dinding` (publik): hanya ucapan yang dipilih Aretha, beserta balasannya.
- Aturan keamanan di `firestore.rules`: ganti `GANTI_DENGAN_UID_ARETHA` dengan UID akun Aretha, lalu Publish di Firebase Console.

## Kenangan (timeline)

- `#/timeline` (`pages/timeline.js`): benang waktu per bulan dari entri diary dan album baru, dengan tab Semua / Diary / Album / Fan Corner / Bestie Space, kartu "Sebulan penuh hal kecil yang indah" (jumlah hari menulis bulan ini), dan "Loncat ke bab" untuk melompat ke bulan lain. Kartu album memakai foto pertama album sebagai gambar kecil.
- Tab Bestie Space terisi dari cerita bersama dan anggota baru di ruangmu (diary pribadi tidak pernah ikut). Tab Fan Corner masih kosong: datanya (`fan.json`) belum punya tanggal.
- Bestie Space (ruang bersama Moonbeam Club) dibuat terpisah dari kotak ucapan ulang tahun (Kirim, Inbox, Dinding), yang tetap seperti sekarang.

## Bestie Space (ruang bersama)

Terpisah dari kotak ucapan ulang tahun. Ucapan (Kirim, Inbox, Dinding) tetap seperti semula; inbox-nya sekarang di `#/ucapan` (menu "Ucapan").

- `#/bestie` (`pages/space.js`): ruang bersama seperti "Moonbeam Club": kepala ruang dengan avatar anggota, "Diary bersama" berisi cerita yang sengaja dibagikan (suka ♡ dan catatan kecil di tiap cerita), tombol "Bagikan cerita kecil baru", dan panel "Beri tempat untuk sahabat". Akun yang belum punya ruang diajak membuatnya dulu.
- Undangan: isi email dan pesan, "Lihat undangan" (pratinjau), lalu "Buat undangan". Web statis ini tidak bisa mengirim email sendiri, jadi hasilnya berupa tautan yang disalin atau dibuka lewat aplikasi email. Undangan berlaku 7 hari, hanya bisa diterima akun dengan email yang sama, dan bisa dibatalkan.
- Tautan undangan `#/join?t=...` (`pages/join.js`): sahabat masuk (atau mendaftar), melihat ruangnya, lalu memilih "Gabung". Kalau belum login, ia dibawa kembali ke tautan itu setelah masuk.
- Data: `spaces/{id}` (+ `members`, `posts`, `posts/{id}/notes`), `spaceInvites/{token}`, dan penunjuk `users/{uid}/spaces/{id}`. Aturannya di `firestore.rules` — **tempel ulang ke Firebase Console dan Publish** setelah memperbarui kode.
- Belum ada: tab "Our album" (album bersama) dan foto di cerita bersama. Itu langkah berikutnya.

## Editor entri (langkah 10)

- `#/write` (`pages/write.js`, `css/editor.css`): editor teks kaya mengikuti frame Figma "Diary editor". Bilah alat: gaya paragraf, tebal, miring, garis bawah, judul bagian, daftar berpoin/bernomor, kutipan, tautan, foto, urungkan. Pintasan Ctrl/Cmd+S menyimpan.
- Tulisan disimpan di `users/{uid}/entries/{id}` sebagai `html` (sudah dibersihkan oleh `services/rich.js`, hanya tag aman) dan `text` (teks polos, dipakai daftar diary, pencarian, linimasa, dan PDF). Entri lama tanpa `html` tetap tampil seperti biasa.
- Foto di dalam tulisan disimpan satu dokumen per foto di `users/{uid}/entries/{id}/photos/{photoId}` (dikecilkan di browser, tanpa Firebase Storage). Di `html` hanya ada penanda `<img data-photo="id">`. Batas: JPG/PNG/HEIC, 20 MB per foto, 12 foto per halaman. Aturan Firestore yang sudah ada (`users/{uid}/{col}/**`) sudah mencakupnya, tidak perlu mengubah Rules.
- Draf otomatis tersimpan di browser (`orion-draft:{uid}`) dan dipulihkan saat editor dibuka lagi; dihapus setelah entri tersimpan.
- Pilihan "Bestie Space" baru menandai entri (`privacy: 'shared'`); entri itu belum otomatis muncul di ruang bersama.

## Notifikasi (D4)

- `#/notifications` (`pages/notifications.js`): "Sinyal kecil dari semestamu", dengan filter Semua / Belum dibaca, "Tandai semua terbaca", kelompok Hari ini dan Minggu ini sebelumnya, dan panel "Jaga orbitmu tetap tenang". Lonceng di menu atas membuka halaman ini dan titiknya muncul selama ada sinyal belum dibaca.
- Tidak ada koleksi notifikasi di server. `services/notifications.js` menghitung sinyal dari data yang sudah ada (dibatasi 7 hari terakhir):
  - **Pengingat stream**: jadwal Fan Corner yang tombol lonceng-nya aktif dan jatuh hari ini; muncul 2 jam sebelum mulai.
  - **Bestie Space**: cerita baru dari anggota lain dan anggota yang baru bergabung.
  - **Undangan** ke ruang bersama untuk email akunmu, dengan "Lihat undangan" dan "Tolak".
  - **Ucapan teman** (hanya akun pemilik).
  - **Tonggak menulis**: 3, 7, 14, 30, 60, 100 hari berturut-turut.
  - **Ekspor PDF** terakhir.
- Status "sudah dibaca" disimpan di preferensi akun (`notifRead`, `wishSeenAt`) dan ikut tersinkron. Pilihan jenis sinyal (stream, bestie, tonggak) ada di Pengaturan → Notifikasi.
- Sinyal hanya muncul di dalam aplikasi. Tidak ada push, email, atau "jam tenang" (frame Figma menyebutnya, tapi tanpa server tidak ada yang bisa dibungkam).
- **Wajib: Publish ulang `firestore.rules`.** Aturan undangan ditambah dua hal: sahabat boleh melihat undangan yang ditujukan ke emailnya sendiri, dan boleh menolaknya (`status: 'declined'`). Tanpa ini, kartu undangan tidak muncul dan tombol Tolak gagal.

## Pengaturan (E1)

- `#/settings` (`pages/settings.js`) punya menu samping (Profil, Bahasa & tampilan, Privasi & berbagi, Notifikasi, Ekspor & data; di ponsel jadi deretan tombol yang bisa digeser). `#/settings?s=privacy` (atau `profile`, `appearance`, `notifications`, `export`) langsung melompat ke kartunya.
- **Privasi**: "Entri baru bersifat pribadi" (`newPrivate`, dipakai editor sebagai pilihan awal) dan "Izinkan undangan sahabat" (`allowInvites`). Yang kedua bekerja di sisi penerima saja: undangan disembunyikan dari notifikasi dan halaman `#/join` menolak menerimanya. Pengirim tidak diberi tahu, dan aturan Firestore tidak bisa membaca pilihan ini.
- **Pengingat menulis malam hari** (`eveningReminder`): muncul sebagai sinyal di lonceng setelah pukul 21:00 waktu perangkat kalau hari ini belum ada entri. Hanya terlihat saat aplikasi dibuka (tidak ada push atau email).
- **Hapus akun** (`services/account.js`): dialog dengan konfirmasi ketik "HAPUS". Menghapus entri dan foto, album dan foto, karya fan-art, pengaturan, cerita dan catatanmu di Bestie Space (lalu keluar dari ruangnya), kemudian akun login. Firebase hanya mengizinkannya kalau login masih baru (sekitar 5 menit); kalau tidak, dialog meminta keluar-masuk dulu dan **tidak ada yang dihapus**. Ucapan teman di koleksi `wishes` tidak ikut terhapus.

## State sistem (E2)

- **Kosong**: daftar Diary memakai kartu "Semesta kecil yang masih segar" (Pip + "Tulis entri pertamaku") kalau belum ada entri, dan "Tidak ada hasil pencarian" + "Hapus pencarian & filter" kalau pencarian atau filter tidak menemukan apa-apa.
- **Memuat** (`router.js`): lencana "Mengumpulkan kenangan kecilmu…" diumumkan sekali ke pembaca layar, kerangka abu-abu hanya hiasan (tanpa animasi saat Reduce motion).
- **Galat**: halaman yang gagal dimuat menampilkan "Ada awan kecil di koneksi" dengan tombol coba lagi. Di editor, simpan yang gagal (atau tanpa internet, atau tidak dijawab dalam 25 detik) menyimpan draf di perangkat lalu menampilkan "Coba sinkron lagi" / "Terus menulis offline" beserta jam simpanan lokal terakhir.
- **Menyimpan ulang aman**: entri memakai ID yang dibuat sekali per sesi menulis (`newEntryId` di `services/storage.js`), jadi coba ulang menimpa entri yang sama dan tidak membuat entri dobel.
- **Sukses**: setelah "Simpan entri", editor diganti kartu "Satu kenangan, tersimpan aman" dengan tombol "Lihat entri" (sebelumnya langsung pindah halaman).
- **404** (`pages/not-found.js`): "Ups, sedikit keluar orbit." dengan Pip di antara angka 4 dan 4; tombol "Antar aku pulang" (ke Dashboard kalau sudah login) dan "Kembali ke diary-ku".
