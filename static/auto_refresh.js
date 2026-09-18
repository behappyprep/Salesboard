/* On an open dashboard, refresh after the background Shopify import completes.
   No credentials or Shopify API calls run in the browser. */
(() => {
  'use strict';
  let lastRefresh = Date.now();
  setInterval(() => {
    if (typeof render !== 'function' || typeof view === 'undefined') return;
    if (document.visibilityState !== 'visible') return;
    if (!['shopify', 'overview', 'dashboard'].includes(view)) return;
    if (Date.now() - lastRefresh < 60_000) return;
    lastRefresh = Date.now();
    render();
  }, 30_000);
})();
