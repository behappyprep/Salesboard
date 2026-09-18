/* Discount and refund metrics are included in net sales, never subtracted twice. */
(() => {
  'use strict';
  if (typeof render !== 'function') return;
  const previousRender = render;
  const formatMoney = (value, code) => value == null ? '—' :
    new Intl.NumberFormat('en', {style: 'currency', currency: code || 'USD'}).format(Number(value));

  function addMetric(cards, label, value, description, before) {
    const box = document.createElement('div');
    box.className = 'metric';
    const title = document.createElement('span');
    title.textContent = label;
    const amount = document.createElement('strong');
    amount.textContent = value;
    const note = document.createElement('small');
    note.textContent = description;
    box.append(title, amount, note);
    cards.insertBefore(box, before || null);
  }

  render = function () {
    previousRender();
    if (!report || !report.summary || !['overview', 'channels'].includes(view)) return;
    const root = document.getElementById('content');
    const cards = root && root.querySelector('.cards');
    if (!cards) return;
    const data = report.summary;
    const code = report.currency || 'USD';
    const beforeOrders = [...cards.children].find(card =>
      card.querySelector('span')?.textContent === 'Orders');
    addMetric(cards, 'Discounts · Shopify', formatMoney(data.shopify_discounts, code),
      'Applied at checkout · already deducted from sales', beforeOrders);
    addMetric(cards, 'Refunds · Shopify', formatMoney(data.shopify_refunds, code),
      'Completed refunds in this period · excludes refunded tax', beforeOrders);
    cards.style.gridTemplateColumns = 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))';

    if (view !== 'overview' || !Array.isArray(report.shopify_adjustments) ||
        report.shopify_adjustments.length === 0) return;
    const panel = document.createElement('section');
    panel.className = 'panel';
    const heading = document.createElement('h2');
    heading.textContent = 'Shopify discounts & refunds by order';
    const explanation = document.createElement('p');
    explanation.className = 'muted';
    explanation.textContent = 'Discounts reduce product sales. Refunds are shown on their processing date, including refunds for older orders. These values are already included in net sales.';
    const scroller = document.createElement('div');
    scroller.className = 'table';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const header = document.createElement('tr');
    ['Order', 'Order date', 'Discounts', 'Completed refunds'].forEach(name => {
      const cell = document.createElement('th');
      cell.textContent = name;
      header.append(cell);
    });
    thead.append(header);
    const tbody = document.createElement('tbody');
    report.shopify_adjustments.forEach(item => {
      const row = document.createElement('tr');
      [item.order_id, item.date, formatMoney(item.discount, code),
       formatMoney(item.refunded, code)].forEach(value => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });
      tbody.append(row);
    });
    table.append(thead, tbody);
    scroller.append(table);
    panel.append(heading, explanation, scroller);
    root.append(panel);
    if (report.warnings?.historic_refund_profit_unknown) {
      const notice = document.createElement('div');
      notice.className = 'warn';
      notice.textContent = 'Some refunds belong to older orders. Sales include those reversals; period profit is unavailable until returned product costs can be reconciled.';
      root.insertBefore(notice, cards);
    }
  };
})();
