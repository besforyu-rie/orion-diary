import { startRouter } from './router.js';
import { authReady, getUser, onUserChange, logout } from './services/auth.js';
import { renderHome } from './pages/home.js';
import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderDiary } from './pages/diary.js';
import { renderAlbums } from './pages/albums.js';
import { renderAlbum } from './pages/album.js';
import { showToast } from './components/toast.js';
import { renderWrite } from './pages/write.js';
import { renderEntry } from './pages/entry.js';
import { renderTimeline } from './pages/timeline.js';
import { renderFan } from './pages/fan.js';
import { renderSettings } from './pages/settings.js';
import { renderBestie } from './pages/bestie.js';
import { renderSendWish } from './pages/send-wish.js';
import { renderWall } from './pages/wall.js';
import { applyPrefs } from './services/prefs.js';
import { syncPrefsFor, prefsReady } from './services/prefs-sync.js';
import { renderNotFound } from './pages/not-found.js';
import { renderWelcome } from './pages/welcome.js';
import { renderSpace } from './pages/space.js';
import { renderJoin } from './pages/join.js';
import { renderNotifications } from './pages/notifications.js';
import { initNavUser } from './components/nav-user.js';
import { initMoreSheet } from './components/more-sheet.js';
import { translateStatic, t } from './i18n.js';

/** Halaman yang butuh login: kalau belum login, arahkan ke #/login. */
const protectedPage = (render) => (root, params) => {
  if (!getUser()) {
    sessionStorage.setItem('orion-after-login', location.hash); // mis. tautan undangan: kembali ke sini setelah masuk
    location.hash = '#/login';
    return;
  }
  return render(root, params);
};

for (const id of ['logout', 'logout-more']) { // menu avatar (desktop) dan lembar "Lainnya" (mobile)
  document.getElementById(id).onclick = async () => { await logout(); showToast(t('common.bye')); location.hash = '#/'; };
}
const setAuthState = (user) => { document.body.dataset.auth = user ? 'in' : 'out'; };
onUserChange(setAuthState);
onUserChange((user) => { syncPrefsFor(user); }); // ganti akun = ganti preferensi (nama, pengingat, dst.)

applyPrefs();
translateStatic();
window.addEventListener('langchange', () => translateStatic());
await authReady;
await Promise.race([prefsReady(), new Promise((r) => setTimeout(r, 2500))]); // tunggu data akun, tapi jangan lebih dari 2,5 detik
setAuthState(getUser());
initNavUser();
initMoreSheet();

startRouter(
  {
    '/': renderHome,
    '/login': renderLogin,
    '/dashboard': protectedPage(renderDashboard),
    '/diary': protectedPage(renderDiary),
    '/write': protectedPage(renderWrite),
    '/entry': protectedPage(renderEntry),
    '/timeline': protectedPage(renderTimeline),
    '/fan': protectedPage(renderFan),
    '/settings': protectedPage(renderSettings),
    '/welcome': protectedPage(renderWelcome),
    '/bestie': protectedPage(renderSpace),
    '/ucapan': protectedPage(renderBestie),
    '/join': protectedPage(renderJoin),
    '/notifications': protectedPage(renderNotifications),
    '/kirim': renderSendWish,
    '/dinding': renderWall,
    '/albums': renderAlbums,
    '/album': renderAlbum,
    '*': renderNotFound,
  },
  document.getElementById('app'),
);
