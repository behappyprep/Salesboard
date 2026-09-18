"""Shopify fee components in settlement currency; no fee rates guessed.

The Shopify OrderTransaction API returns fee *amounts* in presentment currency
for cross-border purchases. Convert via the transaction's settlementCurrencyRate,
then reconcile cent rounding against the total so fees are never double-counted.
"""
from datetime import timedelta
from decimal import Decimal

from fastapi import Depends, Query, HTTPException
from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, UniqueConstraint, select
from sqlalchemy.orm import Session

import main
import providers
import shopify_expenses
import shopify_dashboard
from finance import dec, cents, fmt
from models import Base, OrderLine, FxRate, User

app = shopify_dashboard.app
ZERO = Decimal('0')


class ShopifyFeeBreakdown(Base):
    __tablename__ = 'shopify_fee_breakdowns'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    external_account = Column(String(180), nullable=False)
    order_id = Column(String(180), nullable=False)
    currency = Column(String(3), nullable=False)
    payments_fee = Column(Numeric(18, 4), nullable=False)
    conversion_fee = Column(Numeric(18, 4), nullable=False)
    total_fee = Column(Numeric(18, 4), nullable=False)
    __table_args__ = (UniqueConstraint('user_id', 'external_account', 'order_id'),)


# Add only typed transaction fields. Existing OAuth read_orders permission suffices.
FEE_ORDER_QUERY = shopify_expenses.FEE_ORDER_QUERY.replace(
    'fees { id amount { amount currencyCode } }',
    'settlementCurrency settlementCurrencyRate fees { id type amount { amount currencyCode } }',
    1,
)
if FEE_ORDER_QUERY == shopify_expenses.FEE_ORDER_QUERY:
    raise RuntimeError('Shopify fee query changed; inspect its transaction selection')


def fee_breakdown(transactions, order_currency):
    """Return separately costed fees, or None for absent/unreliable data.

    The total is rounded *once*; FX is rounded once; payments receives the
    remaining cent to match total. This avoids double-counting FX and matches
    Shopify's per-order fee cents on orders like #3350.
    """
    if not isinstance(transactions, list) or not transactions or len(transactions) >= 100:
        return None
    relevant = [tx for tx in transactions if tx.get('status') == 'SUCCESS'
                and tx.get('kind') in ('SALE', 'CAPTURE', 'REFUND')]
    if not relevant or any('shopify_payments' not in str(tx.get('gateway') or '').lower()
                           for tx in relevant):
        return None
    total = ZERO
    exchange = ZERO
    seen = set()
    found = False
    for tx in relevant:
        fees = tx.get('fees') or []
        for fee in fees:
            amount = fee.get('amount') or {}
            source_currency = amount.get('currencyCode')
            if amount.get('amount') is None or not source_currency:
                return None
            identity = fee.get('id') or (tx.get('id'), fee.get('type'), str(amount))
            if identity in seen:
                continue
            seen.add(identity)
            value = dec(amount['amount'])
            if source_currency != order_currency:
                if tx.get('settlementCurrency') != order_currency:
                    return None
                rate = dec(tx.get('settlementCurrencyRate'))
                if rate <= ZERO:
                    return None
                value *= rate
            total += value
            if fee.get('type') == 'foreign_exchange_fee':
                exchange += value
            found = True
    if not found:
        return None  # Empty fee lists are not evidence of a zero fee.
    total = cents(total)
    exchange = cents(exchange)
    return {'currency': order_currency, 'payments': total - exchange,
            'conversion': exchange, 'total': total}


async def shopify_orders_with_fee_components(shop, token, since):
    """Existing order import plus typed fee components, preserving other costs."""
    labels = await shopify_expenses.shipping_label_costs(shop, token)
    after = None
    result = []
    filt = 'updated_at:>=' + since.strftime('%Y-%m-%dT%H:%M:%SZ')
    for _ in range(40):
        page = (await providers.shopify_query(shop, token, FEE_ORDER_QUERY,
                                             {'after': after, 'filter': filt}))['orders']
        for order in page['nodes']:
            lines = order['lineItems']
            if lines['pageInfo']['hasNextPage']:
                raise providers.ProviderError('Order has more than 100 items; not importing partial totals')
            items = lines['nodes']
            if not items:
                continue
            active = sum(1 for item in items if dec(item.get('currentQuantity')
                         if item.get('currentQuantity') is not None
                         else item.get('quantity', 0)) > ZERO)
            divisor = max(active, 1)
            shipping_revenue = dec(((order.get('totalShippingPriceSet') or {})
                                    .get('shopMoney') or {}).get('amount'))
            currency = order['currencyCode']
            breakdown = fee_breakdown(order.get('transactions'), currency)
            fees = breakdown['total'] if breakdown else None
            shipping_paid = labels.get(order['name'])
            canceled = bool(order.get('cancelledAt'))
            for item in items:
                qty = dec(item.get('currentQuantity') if item.get('currentQuantity') is not None
                          else item.get('quantity', 0))
                if qty < ZERO:
                    raise providers.ProviderError('Shopify returned negative line-item quantity')
                original_qty = dec(item.get('quantity', 0))
                price = item['discountedTotalSet']['shopMoney']
                if price['currencyCode'] != currency:
                    raise providers.ProviderError('Shopify order and item currencies differ')
                net_price = dec(price['amount']) * qty / original_qty if original_qty else ZERO
                is_active = qty > ZERO and not canceled
                result.append({
                    'provider': 'Shopify', 'external_account': shop,
                    'order_id': order['name'], 'line_id': item['id'],
                    'ordered_at': order['createdAt'], 'sku': item.get('sku') or '',
                    'product': item['title'], 'quantity': ZERO if canceled else qty,
                    'currency': currency,
                    'item_revenue': net_price if not canceled else ZERO,
                    'shipping_revenue': shipping_revenue / divisor if is_active else ZERO,
                    'item_refunds': ZERO, 'shipping_refunds': ZERO,
                    'fees': fees / divisor if fees is not None and is_active else None,
                    'shipping_cost': (shipping_paid / divisor
                                      if shipping_paid is not None and is_active else None),
                    'other_cost': ZERO,
                    'status': 'canceled' if canceled else 'refunded' if qty == ZERO else 'paid',
                    '_shopify_fee_breakdown': breakdown if is_active else None,
                })
        if not page['pageInfo']['hasNextPage']:
            return result
        after = page['pageInfo']['endCursor']
    raise providers.ProviderError('Shopify sync exceeds 2,000 orders; narrow window or use bulk operations')


_existing_upsert = main.upsert_line


def upsert_with_fee_components(db, user_id, record):
    line = _existing_upsert(db, user_id, record)
    breakdown = record.get('_shopify_fee_breakdown')
    if record.get('provider') == 'Shopify' and breakdown is not None:
        shop = record['external_account']
        order_id = str(record['order_id'])
        current = db.scalar(select(ShopifyFeeBreakdown).where(
            ShopifyFeeBreakdown.user_id == user_id,
            ShopifyFeeBreakdown.external_account == shop,
            ShopifyFeeBreakdown.order_id == order_id))
        if current is None:
            current = ShopifyFeeBreakdown(user_id=user_id, external_account=shop,
                                          order_id=order_id)
            db.add(current)
        current.currency = breakdown['currency']
        current.payments_fee = breakdown['payments']
        current.conversion_fee = breakdown['conversion']
        current.total_fee = breakdown['total']
        if current.id is None:
            db.flush()  # prevent duplicate inserts across multiple items in one order
    return line


main.shopify_orders = shopify_orders_with_fee_components
main.upsert_line = upsert_with_fee_components


def summarize_with_breakdown(lines, rates, report_currency, details):
    """Shopify fees are transaction costs, not COGS and not the bank payout."""
    groups = {}
    missing_fx = set()
    excluded = 0
    for line in lines:
        if line.status in ('canceled', 'refunded') and dec(line.quantity) == ZERO:
            continue
        rate = rates.get(line.currency)
        if rate is None or rate <= ZERO:
            missing_fx.add(line.currency)
            excluded += 1
            continue
        key = (line.external_account, line.order_id)
        group = groups.setdefault(key, {'store': line.external_account,
            'order_id': line.order_id, 'date': line.ordered_at.strftime('%Y-%m-%d'),
            'gross': ZERO, 'known_total_fee': ZERO, 'old_fee_complete': True})
        group['gross'] += (dec(line.item_revenue) + dec(line.shipping_revenue)
                           - dec(line.item_refunds) - dec(line.shipping_refunds)) * rate
        if line.fees is None:
            group['old_fee_complete'] = False
        else:
            group['known_total_fee'] += dec(line.fees) * rate

    groups_sorted = sorted(groups.values(), key=lambda g: (g['date'],g['order_id']), reverse=True)
    gross = sum((g['gross'] for g in groups_sorted), ZERO)
    known_fees = ZERO
    processing = ZERO
    conversion = ZERO
    missing_fee_orders = 0
    missing_split_orders = 0
    rows = []
    for group in groups_sorted:
        key = (group['store'], group['order_id'])
        detail = details.get(key)
        rate = rates.get(detail.currency) if detail is not None else None
        if detail is not None and rate is not None and rate > ZERO:
            processing_fee = dec(detail.payments_fee) * rate
            conversion_fee = dec(detail.conversion_fee) * rate
            total_fee = dec(detail.total_fee) * rate
        else:
            processing_fee = conversion_fee = None
            total_fee = (group['known_total_fee']
                         if group['old_fee_complete'] else None)
        if total_fee is None:
            missing_fee_orders += 1
            net_total = None
        else:
            known_fees += total_fee
            net_total = group['gross'] - total_fee
        if processing_fee is None or conversion_fee is None:
            missing_split_orders += 1
        else:
            processing += processing_fee
            conversion += conversion_fee
        if len(rows) < 250:
            rows.append({'store':group['store'], 'order_id':group['order_id'],
                'date':group['date'], 'gross_total':fmt(group['gross']),
                'payments_fee':fmt(processing_fee) if processing_fee is not None else None,
                'currency_conversion_fee':fmt(conversion_fee) if conversion_fee is not None else None,
                'net_total':fmt(net_total) if net_total is not None else None})
    all_fee_known = bool(groups_sorted) and missing_fee_orders == 0 and excluded == 0
    all_split_known = all_fee_known and missing_split_orders == 0
    return {'currency':report_currency, 'orders':len(groups_sorted),
        'gross_total':fmt(gross) if not excluded else None,
        'payments_fee':fmt(processing) if all_split_known else None,
        'currency_conversion_fee':fmt(conversion) if all_split_known else None,
        'known_transaction_fees':fmt(known_fees),
        'net_total':fmt(gross - known_fees) if all_fee_known else None,
        'missing_fee_orders':missing_fee_orders,
        'missing_fee_breakdown_orders':missing_split_orders,
        'missing_fx':sorted(missing_fx), 'excluded_lines':excluded, 'rows':rows,
        'rows_truncated':len(groups_sorted)>len(rows), 'fees_include_fx':False,
        'note': ('Gross is recorded sales after refunds, excluding sales tax. '
                 'Payments fee excludes the separately displayed FX fee. '
                 'Cross-currency fees are converted using the Shopify transaction settlement rate; '
                 'cent rounding is reconciled to the total fee. Net is gross minus both fees, '
                 'NOT the bank payout or accounting profit.')}


@app.get('/api/shopify/financials')
def accurate_financials(period: int = Query(30, ge=1, le=3650),
                        user: User = Depends(main.current),
                        db: Session = Depends(main.get_db)):
    since = main.now() - timedelta(days=period)
    lines = db.scalars(select(OrderLine).where(
        OrderLine.user_id == user.id,
        OrderLine.provider == 'Shopify',
        OrderLine.ordered_at >= since,
    ).order_by(OrderLine.ordered_at.desc()).limit(30001)).all()
    if len(lines) > 30000:
        raise HTTPException(422, 'More than 30,000 Shopify lines; choose a shorter period')
    rates = {r.currency:dec(r.rate) for r in db.scalars(select(FxRate).where(
        FxRate.user_id == user.id))}
    rates[user.report_currency] = Decimal('1')
    fees = db.scalars(select(ShopifyFeeBreakdown).where(
        ShopifyFeeBreakdown.user_id == user.id)).all()
    by_order = {(fee.external_account,fee.order_id):fee for fee in fees}
    return {'period':period, **summarize_with_breakdown(lines, rates,
        user.report_currency, by_order)}


# Starlette checks routes in declaration order: override old financial endpoint only.
app.router.routes.insert(0, app.router.routes.pop())
