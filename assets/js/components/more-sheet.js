// Tab "Lainnya" di tab bawah (mobile): membuka lembar bawah berisi halaman yang tidak muat di 5 tab.
// Memakai <dialog> bawaan: fokus terkunci di dalam, Esc menutup, fokus kembali ke tombol "Lainnya".
export function initMoreSheet() {
  const dlg = document.getElementById('more-sheet');
  const btn = document.getElementById('tab-more');
  if (!dlg || !btn) return;
  btn.onclick = () => { if (!dlg.open) dlg.showModal(); btn.setAttribute('aria-expanded', 'true'); };
  dlg.addEventListener('close', () => btn.setAttribute('aria-expanded', 'false'));
  dlg.addEventListener('click', (e) => {
    // klik di luar kartu (latar gelap), tombol tutup, atau salah satu tautan/tombol di dalamnya
    if (e.target === dlg || e.target.closest('[data-close], a, #logout-more')) dlg.close();
  });
  window.addEventListener('hashchange', () => { if (dlg.open) dlg.close(); });
  matchMedia('(min-width: 761px)').addEventListener?.('change', (e) => { if (e.matches && dlg.open) dlg.close(); });
}
