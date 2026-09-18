/* Customer-paid shipping is revenue, not an estimate of carrier expense. */
(() => {
  'use strict';
  if (typeof render !== 'function') return;
  const originalRender = render;
  const money = (amount, code) => amount == null ? '—' : new Intl.NumberFormat('en', {
    style: 'currency', currency: code || 'USD'
  }).format(Number(amount));

  function addMetric(cards, label, value, note, before) {
    const item = document.createElement('div');
    item.className = 'metric';
    const name = document.createElement('span');
    name.textContent = label;
    const number = document.createElement('strong');
    number.textContent = value;
    const subtitle = document.createElement('small');
    subtitle.textContent = note;
    item.append(name, number, subtitle);
    cards.insertBefore(item, before || null);
  }

  render = function () {
    originalRender();
    if (view !== 'overview' && view !== 'channels') return;
    if (!report || !report.summary) return;
    const content = document.getElementById('content');
    const cards = content.querySelector('.cards');
    if (!cards || cards.children.length < 4) return;
    const summary = report.summary;
    const code = report.currency || 'EUR';
    const beforeContribution = cards.children[3];
    addMetric(cards, 'Product sales', money(summary.product_sales, code),
      'Excludes shipping charged · after recorded refunds', cards.children[1]);
    addMetric(cards, 'Shipping charged', money(summary.shipping_charged, code),
      'Paid by customers · already included in net sales', cards.children[2]);

    const contribution = beforeContribution;
    contribution.querySelector('span').textContent = 'Profit before shipping expense';
    contribution.querySelector('strong').textContent = money(summary.pre_shipping_profit, code);
    contribution.querySelector('small').textContent =
      (summary.pre_shipping_ready_lines ?? 0) + '/' +
      (summary.lines ?? 0) + ' lines with known product costs and fees · excludes postage';
    cards.style.gridTemplateColumns = 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))';
    // The original blanket "all costs incomplete" warning conflates actual
    // postage expense with Shopify fees. Describe the missing components instead.
    const oldWarning = content.querySelector('.warn');
    const notices = [];
    if (summary.pre_shipping_missing_cogs_lines) notices.push(
      summary.pre_shipping_missing_cogs_lines + ' order lines have unknown product costs.');
    if (summary.pre_shipping_missing_fee_lines) notices.push(
      summary.pre_shipping_missing_fee_lines + ' order lines have unknown transaction fees.');
    if (report.warnings?.missing_fx?.length) notices.push(
      'Missing reporting exchange rates: ' + report.warnings.missing_fx.join(', ') + '.');
    if (summary.shipping_expense_unknown_lines) notices.push(
      'Actual postage cost is not tracked. Profit before shipping expense is not net profit.');
    if (oldWarning) {
      if (notices.length) {
        oldWarning.textContent = notices.join(' ');
        if (!summary.pre_shipping_missing_cogs_lines &&
            !summary.pre_shipping_missing_fee_lines &&
            !report.warnings?.missing_fx?.length) {
          oldWarning.style.background = '#edf3ff';
          oldWarning.style.color = '#425577';
          oldWarning.style.borderColor = '#dce5fb';
        }
      } else {
        oldWarning.remove();
      }
    }
  };
})();