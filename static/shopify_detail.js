/* Separate Shopify financial reconciliation view. Uses authenticated, read-only API. */
(() => {
  'use strict';
  const nav = document.getElementById('nav');
  if (!nav || typeof render !== 'function') return;
  const button = document.createElement('button');
  button.dataset.view = 'shopify';
  button.textContent = '◈ Shopify details';
  const next = nav.querySelector('[data-view="channels"]');
  nav.insertBefore(button, next || null);
  const originalRender = render;
  const htmlSafe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const displayMoney = (value, code) => value === null || value === undefined ? '—' :
    new Intl.NumberFormat('en', {style: 'currency', currency: code}).format(Number(value));
  let requestId = 0;
  function detail(label, value, description, code) {
    return '<div class="metric"><span>' + htmlSafe(label) + '</span><strong>' +
      htmlSafe(displayMoney(value, code)) + '</strong><small>' + htmlSafe(description) + '</small></div>';
  }
  async function loadShopify() {
    const thisRequest = ++requestId;
    const content = document.getElementById('content');
    content.innerHTML = '<section class="panel">Loading Shopify financial details…</section>';
    try {
      const response = await fetch('/api/shopify/financials?period=' + encodeURIComponent(document.getElementById('period').value), {credentials:'same-origin'});
      if (!response.ok) throw new Error('Unable to load Shopify financial details (' + response.status + ')');
      const data = await response.json();
      if (view !== 'shopify' || thisRequest !== requestId) return;
      const warning = [];
      if (data.missing_fee_orders) warning.push(data.missing_fee_orders + ' order(s) have unavailable payment fees.');
      if (data.excluded_lines) warning.push(data.excluded_lines + ' order line(s) excluded because of missing FX rates: ' + data.missing_fx.join(', ') + '.');
      const cards = '<div class="cards">' +
        detail('Gross total', data.gross_total, 'Sales after refunds · excludes sales tax', data.currency) +
        detail('Payments fee', data.payments_fee, 'All known Shopify Payments fees; may include FX', data.currency) +
        detail('Currency conversion fee', data.currency_conversion_fee, 'Not separately available with current access', data.currency) +
        detail('Net total', data.net_total, 'Gross less all known transaction fees · not a payout', data.currency) + '</div>';
      const rows = data.rows.map(row => '<tr><td>' + htmlSafe(row.date) + '</td><td>' + htmlSafe(row.store) + '</td><td>' + htmlSafe(row.order_id) +
        '</td><td>' + htmlSafe(displayMoney(row.gross_total,data.currency)) + '</td><td>' + htmlSafe(displayMoney(row.payments_fee,data.currency)) +
        '</td><td>' + htmlSafe(displayMoney(row.currency_conversion_fee,data.currency)) + '</td><td>' + htmlSafe(displayMoney(row.net_total,data.currency)) + '</td></tr>').join('');
      content.innerHTML = (warning.length ? '<div class="warn">' + htmlSafe(warning.join(' ')) + '</div>' : '') + cards +
        '<section class="panel"><h2>Shopify fee reconciliation</h2><p class="muted">' + htmlSafe(data.orders) + ' orders · reporting currency ' + htmlSafe(data.currency) +
        '. ' + htmlSafe(data.note) + '</p>' +
        (data.rows.length ? '<div class="table"><table><thead><tr><th>Date</th><th>Store</th><th>Order</th><th>Gross total</th><th>Payments fee</th><th>Conversion fee</th><th>Net total</th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
        '<div class="empty">No Shopify orders in this period.</div>') +
        (data.rows_truncated ? '<p class="muted">Only the newest 250 orders are shown; totals include all selected orders.</p>' : '') + '</section>';
    } catch (error) {
      if (view === 'shopify' && thisRequest === requestId) content.innerHTML = '<div class="error">' + htmlSafe(error.message) + '</div>';
    }
  }
  render = function () {
    originalRender();
    if (view === 'shopify') {
      document.getElementById('crumb').textContent = 'Shopify details';
      document.getElementById('title').textContent = 'Shopify financial details.';
      loadShopify();
    }
  };
  button.onclick = () => { view = 'shopify'; message(''); render(); };
})();
