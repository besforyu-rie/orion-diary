// Menu atas setelah login: lonceng (sinyal belum dibaca) dan avatar huruf dengan menu akun.
import { getUser, onUserChange } from '../services/auth.js';
import { getPrefs } from '../services/prefs.js';
import { loadNotifications, unreadCount } from '../services/notifications.js';
import { t } from '../i18n.js';

let lastCheck = 0;

export function initNavUser() {
  const $ = (id) => document.getElementById(id);
  const avatar = $('avatar'), menu = $('user-menu'), bell = $('bell');
  const dot = bell.querySelector('.dot');
  const wrap = avatar.parentElement;

  function drawUser() {
    const user = getUser();
    if (!user) return;
    const name = getPrefs().displayName || '';
    avatar.textContent = ([...(name || user.email || '✦')][0] ?? '✦').toUpperCase();
    $('menu-name').textContent = name || user.email;
    $('menu-email').textContent = name ? user.email : '';
  }

  function drawBell() {
    const user = getUser();
    const unread = user ? unreadCount() : 0;
    dot.hidden = unread === 0;
    bell.setAttribute('aria-label', unread ? t('nav.bellNew', { n: unread }) : t('nav.bell'));
  }

  async function refreshCount(force = false) {
    const user = getUser();
    if (!user || (!force && Date.now() - lastCheck < 60000)) return;
    lastCheck = Date.now();
    try { await loadNotifications(force); } catch (err) { console.warn(err); }
    drawBell();
  }

  function setOpen(open, focusBack = false) {
    menu.hidden = !open;
    avatar.setAttribute('aria-expanded', String(open));
    if (open) { drawUser(); menu.querySelector('[role="menuitem"]')?.focus(); }
    else if (focusBack) avatar.focus();
  }
  const items = () => [...menu.querySelectorAll('[role="menuitem"]')];

  avatar.onclick = () => setOpen(menu.hidden);
  menu.addEventListener('click', (e) => { if (e.target.closest('[role="menuitem"]')) setOpen(false); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !wrap.contains(e.target)) setOpen(false); });
  wrap.addEventListener('focusout', (e) => { if (!menu.hidden && !wrap.contains(e.relatedTarget)) setOpen(false); });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { e.preventDefault(); setOpen(false, true); return; }
    if (e.key === 'ArrowDown' && menu.hidden && e.target === avatar) { e.preventDefault(); setOpen(true); return; }
    if (menu.hidden || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const list = items(), i = list.indexOf(document.activeElement);
    list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length].focus();
  });

  window.addEventListener('hashchange', () => { setOpen(false); refreshCount(); });
  window.addEventListener('langchange', () => { drawUser(); drawBell(); });
  window.addEventListener('prefschange', () => { drawUser(); drawBell(); });
  window.addEventListener('signalschange', drawBell);
  onUserChange((user) => { lastCheck = 0; drawUser(); drawBell(); if (user) refreshCount(true); });
  drawUser(); drawBell(); refreshCount(true);
}
