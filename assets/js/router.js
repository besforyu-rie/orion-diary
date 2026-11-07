// Router hash sederhana: #/diary -> routes['/diary']
export function startRouter(routes, outlet) {
  let cleanup = null;

  async function show() {
    const path = location.hash.slice(1) || '/';
    const page = routes[path] ?? routes['/'];
    if (cleanup) cleanup();
    outlet.replaceChildren();
    cleanup = (await page(outlet)) ?? null;
    document.querySelectorAll('[data-route]').forEach((a) => {
      if (a.dataset.route === path) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  window.addEventListener('hashchange', show);
  show();
}
