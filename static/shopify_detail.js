/* Shopify fees, original currency, actual Shopify FX, and customer-paid shipping. */
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
  const displayMoney = (value, code) => value === null || value === undefined || !code ? '—' :
    new Intl.NumberFormat('en', {style: 'currency', currency: code}).format(Number(value));
  const displayRate = (value, pair) => value === null || value === undefined || !pair ? '—' :
    '1 ' + htmlSafe(pair.split(' → ')[0]) + ' = ' +
    htmlSafe(new Intl.NumberFormat('en', {maximumFractionDigits: 12}).format(Number(value))) + ' ' +
    htmlSafe(pair.split(' → ')[1] || '');
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
      if (data.missing_fee_orders) warning.push(data.missing_fee_orders + ' order(s) have unavailable total payment fees.');
      if (data.missing_fee_breakdown_orders) warning.push(data.missing_fee_breakdown_orders + ' order(s) lack separate processing and conversion fees. The scheduled Shopify sync will backfill them; Sync now can speed this up.');
      const missingOriginal = data.rows.filter(row => row.original_total === null || row.original_total === undefined).length;
      if (missingOriginal) warning.push(missingOriginal + ' displayed order(s) await original-currency details in the next sync.');
      if (data.excluded_lines) warning.push(data.excluded_lines + ' order line(s) excluded because of unavailable reporting FX rates: ' + (data.missing_fx || []).join(', ') + '.');
      if (data.fx_rate_unavailable?.length) warning.push('Reference exchange rates are temporarily unavailable for: ' + data.fx_rate_unavailable.join(', ') + '.');
      if (data.shipping_excluded_orders) warning.push(data.shipping_excluded_orders + ' order(s) have unavailable shipping-currency conversion.');
      const cards = '<div class="cards" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))">' +
        detail('Gross total', data.gross_total, 'Shopify order total · includes tax and shipping', data.currency) +
        detail('Shipping charged', data.shipping_charged, 'Paid by customers · included in gross', data.currency) +
        detail('Payments fee', data.payments_fee, 'Processing and other non-FX transaction fees', data.currency) +
        detail('Currency conversion fee', data.currency_conversion_fee, 'Separately identified Shopify FX charge', data.currency) +
        detail('Net total', data.net_total, 'Gross less both fees · not a bank payout', data.currency) + '</div>';
      const rows = data.rows.map(row => '<tr><td>' + htmlSafe(row.date) + '</td><td>' + htmlSafe(row.store) + '</td><td>' + htmlSafe(row.order_id) +
        '</td><td>' + htmlSafe(displayMoney(row.original_total,row.original_currency)) + '</td>' +
        '<td>' + displayRate(row.shopify_conversion_rate,row.shopify_rate_pair) + '</td>' +
        '<td>' + htmlSafe(displayMoney(row.shopify_total,row.shopify_currency)) + '</td>' +
        '<td>' + htmlSafe(displayMoney(row.gross_total,data.currency)) + '</td>' +
        '<td>' + htmlSafe(displayMoney(row.shipping_charged,data.currency)) + '</td>' +
        '<td>' + htmlSafe(displayMoney(row.payments_fee,data.currency)) + '</td>' +
        '<td>' + htmlSafe(displayMoney(row.currency_conversion_fee,data.currency)) + '</td>' +
        '<td>' + htmlSafe(displayMoney(row.net_total,data.currency)) + '</td>' +
        '<td>' + displayRate(row.reporting_rate,row.reporting_rate_pair) +
        (row.reporting_rate_date ? '<br><small>' + htmlSafe(row.reporting_rate_date) + ' · reference</small>' : '') + '</td></tr>').join('');
      content.innerHTML = (warning.length ? '<div class="warn">' + htmlSafe(warning.join(' ')) + '</div>' : '') + cards +
        '<section class="panel"><h2>Shopify fee reconciliation</h2><p class="muted">' + htmlSafe(data.orders) + ' orders · reporting currency ' + htmlSafe(data.currency) +
        '. ' + htmlSafe(data.note) + '</p>' +
        (data.rows.length ? '<div class="table"><table><thead><tr><th>Date</th><th>Store</th><th>Order</th><th>Customer total</th><th>Shopify FX rate</th><th>Shopify order total (inc. tax)</th><th>Gross total</th><th>Shipping charged</th><th>Payments fee</th><th>Conversion fee</th><th>Net total</th><th>Reporting FX rate</th></tr></thead><tbody>' + rows + '</tbody></table></div>' :
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