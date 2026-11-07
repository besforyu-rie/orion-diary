// Confetti sekali (600 ms) saat entri tersimpan. Tidak muncul kalau gerakan dikurangi.
import { motionOK } from '../services/motion.js';

const COLORS = ['#B79CFF', '#FFD86B', '#FF9ED8', '#E9DFFF'];

export function confettiBurst() {
  if (!motionOK()) return;
  const box = document.createElement('div');
  box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
  const w = innerWidth, h = innerHeight;
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('i');
    p.style.left = `${w * (0.25 + Math.random() * 0.5)}px`;
    p.style.background = COLORS[i % COLORS.length];
    box.append(p);
    p.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${(Math.random() - 0.5) * w * 0.5}px, ${h * (0.35 + Math.random() * 0.3)}px) rotate(${Math.random() * 540}deg)`, opacity: 0 },
    ], { duration: 600, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 700);
}
