// Satu pintu untuk "apakah boleh bergerak?": sistem (prefers-reduced-motion) DAN sakelar Kurangi gerakan di Pengaturan.
export const motionOK = () =>
  !matchMedia('(prefers-reduced-motion: reduce)').matches && document.documentElement.dataset.motion !== 'reduce';
