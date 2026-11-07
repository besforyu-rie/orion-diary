// Latar bintang yang berkelip pelan (hiasan; disembunyikan di tema terang dan saat gerakan dikurangi lewat CSS).
export function initStars() {
  if (document.querySelector('.stars')) return;
  const box = document.createElement('div');
  box.className = 'stars'; box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('i');
    s.style.left = `${(i * 37 + Math.random() * 30) % 100}%`;
    s.style.top = `${(i * 53 + Math.random() * 30) % 100}%`;
    s.style.animationDelay = `${(Math.random() * 6).toFixed(2)}s`;
    s.style.animationDuration = `${5 + Math.random() * 3}s`;
    s.style.opacity = '.2';
    box.append(s);
  }
  document.body.prepend(box);
}
