// Mengecilkan foto di browser supaya muat di dokumen Firestore (batas 1 MiB per dokumen).
// Hasil: data URL JPEG dengan sisi terpanjang maks. 1200 px, panjang teks <= 850.000 karakter
// (aturan Firestore menolak di atas 900.000).
import { t } from '../i18n.js';

export const MAX_SIDE = 1200;
export const MAX_CHARS = 850000;
export const MAX_UPLOAD_MB = 20; // batas file asli, sama dengan desain Figma

const fail = (code) => Object.assign(new Error(code), { code });

export async function fileToDataUrl(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file); // sudah memutar foto sesuai EXIF
  } catch {
    throw fail(/hei[cf]/i.test(`${file.type} ${file.name ?? ''}`) ? 'heic' : 'unreadable');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  let w = Math.max(1, Math.round(bitmap.width * scale));
  let h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; // PNG transparan jadi latar putih (JPEG tidak punya alpha)
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bitmap, 0, 0, w, h);
      for (let q = 0.85; q >= 0.5; q -= 0.1) {
        const url = canvas.toDataURL('image/jpeg', q);
        if (url.length <= MAX_CHARS) return url;
      }
      w = Math.round(w * 0.8); h = Math.round(h * 0.8);
    }
  } finally {
    bitmap.close?.();
  }
  throw fail('too-big');
}

/** Pesan galat yang ramah untuk ditampilkan di toast. */
export function imageErrorMessage(err) {
  if (['heic', 'unreadable', 'too-big', 'album-full'].includes(err?.code)) {
    return t(`img.${err.code}`, { max: 100 });
  }
  return t('book.saveFail');
}
