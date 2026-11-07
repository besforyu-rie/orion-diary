import { startRouter } from './router.js';
import { renderHome } from './pages/home.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderDiary } from './pages/diary.js';
import { renderAlbum } from './pages/album.js';

startRouter(
  { '/': renderHome, '/dashboard': renderDashboard, '/diary': renderDiary, '/album': renderAlbum },
  document.getElementById('app'),
);
