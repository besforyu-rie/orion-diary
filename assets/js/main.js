import { startRouter } from './router.js';
import { authReady, getUser, onUserChange, logout } from './services/auth.js';
import { renderHome } from './pages/home.js';
import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderDiary } from './pages/diary.js';
import { renderAlbum } from './pages/album.js';

/** Halaman yang butuh login: kalau belum login, arahkan ke #/login. */
const protectedPage = (render) => (root) => {
  if (!getUser()) { location.hash = '#/login'; return; }
  return render(root);
};

const logoutButton = document.getElementById('logout');
logoutButton.onclick = async () => { await logout(); location.hash = '#/'; };
onUserChange((user) => { logoutButton.hidden = !user; });

await authReady;
logoutButton.hidden = !getUser();

startRouter(
  {
    '/': renderHome,
    '/login': renderLogin,
    '/dashboard': protectedPage(renderDashboard),
    '/diary': protectedPage(renderDiary),
    '/album': renderAlbum,
  },
  document.getElementById('app'),
);
