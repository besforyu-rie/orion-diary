// Notifikasi singkat. Wadahnya (#toasts) ada di index.html dan bersifat aria-live.
export function showToast(message, type = 'success') {
  const box = document.getElementById('toasts');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  box.append(toast);
  setTimeout(() => toast.remove(), 4000);
}
