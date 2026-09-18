"""Order-level Shopify discounts and dated successful refunds.

An order's lineItems.discountedTotalSet omits order-level/code discounts.
Import the canonical current order subtotal instead. Refunds are stored as
separate, uniquely identified events, never subtracted a second time from
current order totals. Older-order refunds appear in the period they occur.
This is order-based reporting, not a claim of ShopifyQL report equivalence.
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import BackgroundTasks, Depends, Query, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, delete, select
from sqlalchemy.orm import Session

import main
import providers
import shopify_currency as currency
import shipping_revenue_dashboard as shipping
from finance import dec, fmt
from models import Base, FxRate, OrderLine, User

app = shipping.app
ZERO = Decimal('0')


class ShopifySaleAdjustment(Base):
    __tablename__ = 'shopify_sale_adjustments'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    external_account = Column(String(180), nullable=False)
    order_id = Column(String(180), nullable=False)
    ordered_at = Column(DateTime(timezone=True), nullable=False, index=True)
    currency = Column(String(3), nullable=False)
    discount = Column(Numeric(24, 6), nullable=False, default=0)
    current_product_sales = Column(Numeric(24, 6), nullable=False, default=0)
    current_shipping = Column(Numeric(24, 6), nullable=False, default=0)
    canceled = Column(Integer, nullable=False, default=0)
    __table_args__ = (UniqueConstraint('user_id', 'external_account', 'order_id'),)


class ShopifyRefundEvent(Base):
    __tablename__ = 'shopify_refund_events'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    external_account = Column(String(180), nullable=False)
    order_id = Column(String(180), nullable=False)
    refund_id = Column(String(180), nullable=False)
    refunded_at = Column(DateTime(timezone=True), nullable=False, index=True)
    currency = Column(String(3), nullable=False)
    amount = Column(Numeric(24, 6), nullable=False)
    shipping_amount = Column(Numeric(24, 6), nullable=False)
    __table_args__ = (UniqueConstraint('user_id', 'external_account', 'refund_id'),)


AUDIT_QUERY = '''query Audit($after: String, $filter: String!) {
 orders(first: 50, after: $after, sortKey: UPDATED_AT, reverse: true, query: $filter) {
  pageInfo { hasNextPage endCursor }
  nodes { name createdAt cancelledAt currencyCode
   currentSubtotalPriceSet { shopMoney { amount currencyCode } }
   currentShippingPriceSet { shopMoney { amount currencyCode } }
   totalDiscountsSet { shopMoney { amount currencyCode } }
   refunds(first: 100) { id processedAt
    transactions(first: 100) { pageInfo { hasNextPage } nodes {
      id status kind amountSet { shopMoney { amount currencyCode } } } }
    refundLineItems(first: 100) { pageInfo { hasNextPage } nodes {
      totalTaxSet { shopMoney { amount currencyCode } } } }
    refundShippingLines(first: 100) { pageInfo { hasNextPage } nodes {
      subtotalAmountSet { shopMoney { amount currencyCode } }
      taxAmountSet { shopMoney { amount currencyCode } } } }
   }
  }
 }
}'''


def shop_amount(bag, expected):
    money = (bag or {}).get('shopMoney') or {}
    if money.get('amount') is None or money.get('currencyCode') != expected:
        raise providers.ProviderError('Shopify returned an incomplete or mixed-currency sale')
    value = dec(money['amount'])
    if value < ZERO:
        raise providers.ProviderError('Shopify returned a negative unsigned sale component')
    return value


def refund_details(refund, code):
    """Use only settled SUCCESS REFUND transactions; exclude separately refunded tax."""
    tx = refund['transactions']
    product = refund['refundLineItems']
    shipping_lines = refund['refundShippingLines']
    if any(part['pageInfo']['hasNextPage'] for part in (tx, product, shipping_lines)):
        raise providers.ProviderError('Refund has more than 100 entries; refusing partial refunds')
    successful = [entry for entry in tx['nodes']
                  if entry['kind'] == 'REFUND' and entry['status'] == 'SUCCESS']
    if not successful:
        return None  # Failed/pending refunds must not be reported as completed.
    received = sum((shop_amount(entry['amountSet'], code) for entry in successful), ZERO)
    tax = sum((shop_amount(item['totalTaxSet'], code) for item in product['nodes']), ZERO)
    tax += sum((shop_amount(item['taxAmountSet'], code) for item in shipping_lines['nodes']), ZERO)
    refunded_shipping = sum((shop_amount(item['subtotalAmountSet'], code)
                            for item in shipping_lines['nodes']), ZERO)
    if tax > received or refunded_shipping > received - tax:
        raise providers.ProviderError('Shopify refund breakdown exceeds settled refund')
    return {'refund_id': refund['id'], 'refunded_at': refund['processedAt'],
            'amount': received - tax, 'shipping_amount': refunded_shipping,
            'currency': code}


def allocate(total, rows, attr):
    """Allocate a canonical order total to active lines without losing rounding residual."""
    active = [row for row in rows if dec(row['quantity']) > ZERO and row['status'] != 'canceled']
    if not active:
        if total != ZERO:
            raise providers.ProviderError('Shopify has revenue but no active order lines')
        for row in rows:
            row[attr] = ZERO
        return
    weights = [max(ZERO, dec(row.get(attr))) for row in active]
    weight_sum = sum(weights, ZERO)
    if weight_sum <= ZERO:
        weights = [dec(row['quantity']) for row in active]
        weight_sum = sum(weights, ZERO)
    remaining = total
    for i, (row, weight) in enumerate(zip(active, weights)):
        value = remaining if i == len(active) - 1 else total * weight / weight_sum
        row[attr] = value
        remaining -= value
    for row in rows:
        if row not in active:
            row[attr] = ZERO


async def orders_with_adjustments(shop, token, since):
    # Keep currency, real transaction fees, label costs and existing OAuth logic.
    rows = await currency.shopify_orders_with_currency(shop, token, since)
    by_order = {}
    for row in rows:
        by_order.setdefault(row['order_id'], []).append(row)
    seen = set()
    after = None
    filt = 'updated_at:>=' + since.strftime('%Y-%m-%dT%H:%M:%SZ')
    for _ in range(40):
        page = (await providers.shopify_query(shop, token, AUDIT_QUERY,
                                             {'after': after, 'filter': filt}))['orders']
        for order in page['nodes']:
            name = order['name']
            lines = by_order.get(name)
            if not lines:
                continue
            code = order['currencyCode']
            subtotal = shop_amount(order['currentSubtotalPriceSet'], code)
            charged_shipping = shop_amount(order['currentShippingPriceSet'], code)
            discount = shop_amount(order['totalDiscountsSet'], code)
            # Canceled orders contribute neither sales nor costs, but retain a
            # recorded discount for transparent order-level inspection.
            if order.get('cancelledAt'):
                subtotal = charged_shipping = ZERO
            allocate(subtotal, lines, 'item_revenue')
            allocate(charged_shipping, lines, 'shipping_revenue')
            if len(order['refunds']) >= 100:
                raise providers.ProviderError('More than 99 refunds on one Shopify order')
            refunds = [detail for item in order['refunds']
                       if (detail := refund_details(item, code)) is not None]
            metadata = {'order_id': name, 'ordered_at': order['createdAt'],
                        'currency': code, 'discount': discount,
                        'current_product_sales': subtotal,
                        'current_shipping': charged_shipping,
                        'canceled': bool(order.get('cancelledAt')),
                        'refunds': refunds}
            for row in lines:
                row['_shopify_adjustment'] = metadata
            seen.add(name)
        if not page['pageInfo']['hasNextPage']:
            break
        after = page['pageInfo']['endCursor']
    else:
        raise providers.ProviderError('Shopify adjustment sync exceeded 2,000 orders')
    if seen != set(by_order):
        raise providers.ProviderError('Shopify orders changed during sync; please retry')
    return rows


_previous_upsert = main.upsert_line


def upsert_adjustments(db, user_id, record):
    line = _previous_upsert(db, user_id, record)
    info = record.get('_shopify_adjustment')
    if record.get('provider') != 'Shopify' or info is None:
        return line
    shop, order_id = record['external_account'], str(record['order_id'])
    row = db.scalar(select(ShopifySaleAdjustment).where(
        ShopifySaleAdjustment.user_id == user_id,
        ShopifySaleAdjustment.external_account == shop,
        ShopifySaleAdjustment.order_id == order_id))
    if row is None:
        row = ShopifySaleAdjustment(user_id=user_id, external_account=shop, order_id=order_id)
        db.add(row)
    for name in ('currency', 'discount', 'current_product_sales', 'current_shipping', 'canceled'):
        setattr(row, name, info[name])
    row.ordered_at = main.order_dt(info['ordered_at'])
    if row.id is None:
        db.flush()
    identities = []
    for refund in info['refunds']:
        identities.append(refund['refund_id'])
        event = db.scalar(select(ShopifyRefundEvent).where(
            ShopifyRefundEvent.user_id == user_id,
            ShopifyRefundEvent.external_account == shop,
            ShopifyRefundEvent.refund_id == refund['refund_id']))
        if event is None:
            event = ShopifyRefundEvent(user_id=user_id, external_account=shop,
                                       refund_id=refund['refund_id'])
            db.add(event)
        event.order_id = order_id
        event.refunded_at = main.order_dt(refund['refunded_at'])
        event.currency = refund['currency']
        event.amount = refund['amount']
        event.shipping_amount = refund['shipping_amount']
        if event.id is None:
            db.flush()
    obsolete = delete(ShopifyRefundEvent).where(
        ShopifyRefundEvent.user_id == user_id,
        ShopifyRefundEvent.external_account == shop,
        ShopifyRefundEvent.order_id == order_id)
    if identities:
        obsolete = obsolete.where(ShopifyRefundEvent.refund_id.not_in(identities))
    db.execute(obsolete)
    return line


main.shopify_orders = orders_with_adjustments
main.upsert_line = upsert_adjustments


def period_adjustments(db, user, period):
    since = main.now() - timedelta(days=period)
    orders = db.scalars(select(ShopifySaleAdjustment).where(
        ShopifySaleAdjustment.user_id == user.id,
        ShopifySaleAdjustment.ordered_at >= since)).all()
    refunds = db.scalars(select(ShopifyRefundEvent).where(
        ShopifyRefundEvent.user_id == user.id,
        ShopifyRefundEvent.refunded_at >= since)).all()
    rates = shipping.rates_for(db, user)
    missing = set()
    discount = ZERO
    refunded = ZERO
    shipping_refunded = ZERO
    historical = []
    for order in orders:
        rate = rates.get(order.currency)
        if rate is None:
            missing.add(order.currency)
        else:
            discount += dec(order.discount) * rate
    recent_keys = {(order.external_account, order.order_id) for order in orders}
    for item in refunds:
        rate = rates.get(item.currency)
        if rate is None:
            missing.add(item.currency)
            continue
        refunded += dec(item.amount) * rate
        shipping_refunded += dec(item.shipping_amount) * rate
        if (item.external_account, item.order_id) not in recent_keys:
            historical.append({'store': item.external_account, 'order_id': item.order_id,
                               'date': main.aware(item.refunded_at).strftime('%Y-%m-%d'),
                               'amount': dec(item.amount) * rate,
                               'shipping': dec(item.shipping_amount) * rate})
    return orders, refunds, discount, refunded, shipping_refunded, historical, missing


@app.get('/api/report')
async def adjusted_report(tasks: BackgroundTasks,
                          period: int = Query(30, ge=1, le=3650),
                          channel: str = 'all', sales_type: str = 'all',
                          user: User = Depends(main.current),
                          db: Session = Depends(main.get_db)):
    result = await shipping.report_with_customer_shipping(
        tasks=tasks, period=period, channel=channel, sales_type=sales_type,
        user=user, db=db)
    if channel not in ('all', 'Shopify') or sales_type not in ('all', 'retail'):
        result['summary'].update({'shopify_discounts': None, 'shopify_refunds': None})
        return result
    orders, refunds, discounts, refunded, shipping_refunded, historical, missing = (
        period_adjustments(db, user, period))
    summary = result['summary']
    summary['shopify_discounts'] = fmt(discounts) if not missing else None
    summary['shopify_refunds'] = fmt(refunded) if not missing else None
    # main.report already uses *current* order totals. Refunds from orders
    # created in this period are already netted, so never subtract them again.
    # Older orders are not present in main.report: add only their dated returns.
    if historical and not missing:
        reversal = sum((event['amount'] for event in historical), ZERO)
        shipping_reversal = sum((event['shipping'] for event in historical), ZERO)
        summary['revenue'] = fmt(dec(summary['revenue']) - reversal)
        summary['shipping_charged'] = fmt(dec(summary['shipping_charged']) - shipping_reversal)
        summary['product_sales'] = fmt(dec(summary['revenue']) - dec(summary['shipping_charged']))
        for channel_row in result['channels']:
            if channel_row['channel'] == 'Shopify':
                channel_row['revenue'] = fmt(dec(channel_row['revenue']) - reversal)
                break
        else:
            result['channels'].append({'channel': 'Shopify', 'revenue': fmt(-reversal),
                'gross_profit': None, 'profit': None, 'lines': 0,
                'cogs_lines': 0, 'complete': 0})
        daily = {item['date']: item for item in result['trend']}
        for event in historical:
            date = event['date']
            if date not in daily:
                daily[date] = {'date': date, 'revenue': fmt(ZERO), 'profit': fmt(ZERO)}
            daily[date]['revenue'] = fmt(dec(daily[date]['revenue']) - event['amount'])
        result['trend'] = sorted(daily.values(), key=lambda item: item['date'])
        # Refund COGS cannot be inferred from a cash refund: do not show a
        # misleading profit figure for a period with historic reversals.
        summary['gross_profit'] = None
        summary['known_profit'] = None
        summary['pre_shipping_profit'] = None
        result['warnings']['historic_refund_profit_unknown'] = True
    # Include fully discounted orders even when their current line quantity is 0.
    keys = {(line['provider'], line['order_id']) for line in result['orders']}
    not_shopify = len({key for key in keys if key[0] != 'Shopify'})
    summary['orders'] = not_shopify + sum(not order.canceled for order in orders)
    result['warnings']['refund_accounting_note'] = (
        'Shopify refunds are shown by refund processing date, excluding refunded tax. '
        'Current order subtotals already include refunds on those orders; they '
        'are not subtracted twice. Returns on older orders reduce period sales. '
        'Order-based periods and UTC dates can differ from Shopify Analytics '
        'event-based reporting and shop-local dates.')
    if missing:
        result['warnings']['adjustment_missing_fx'] = sorted(missing)
    result['shopify_adjustments'] = [{
        'order_id': item.order_id, 'date': main.aware(item.ordered_at).strftime('%Y-%m-%d'),
        'discount': fmt(dec(item.discount) * shipping.rates_for(db, user)[item.currency])
                    if item.currency not in missing else None,
        'refunded': fmt(sum((dec(r.amount) * shipping.rates_for(db, user)[r.currency]
                            for r in refunds if r.external_account == item.external_account
                            and r.order_id == item.order_id and r.currency not in missing), ZERO)),
    } for item in sorted(orders, key=lambda x: x.ordered_at, reverse=True)[:100]]
    return result


@app.get('/api/webhooks/shopify')
async def redact_adjustment_data(request: Request,
                                 db: Session = Depends(main.get_db)):
    outcome = await currency.webhook_with_financial_redaction(request, db)
    if request.headers.get('x-shopify-topic') == 'shop/redact' and outcome.get('ok'):
        shop = providers.validate_shop(request.headers.get('x-shopify-shop-domain'))
        db.execute(delete(ShopifyRefundEvent).where(ShopifyRefundEvent.external_account == shop))
        db.execute(delete(ShopifySaleAdjustment).where(ShopifySaleAdjustment.external_account == shop))
        db.commit()
    return outcome


@app.get('/', include_in_schema=False)
def adjustments_index():
    response = shipping.shipping_index()
    html = response.body.decode('utf-8')
    html = html.replace('</body>',
        '<script defer src="/static/shopify_adjustments.js"></script></body>')
    return HTMLResponse(html, headers={'Cache-Control': 'no-store'})


for path in ('/api/report', '/api/webhooks/shopify', '/'):
    matches = [route for route in app.router.routes if getattr(route, 'path', None) == path]
    app.router.routes[:] = matches[-1:] + [route for route in app.router.routes
                                           if route not in matches[-1:]]
