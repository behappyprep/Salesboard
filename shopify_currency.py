"""Shopify order-native FX, separate payment/FX fees, and automatic reporting FX.

Shopify transaction settlement rates are actual transaction rates. Frankfurter
reference rates are only for reporting in a different chosen currency; they
must never be presented as Shopify's execution rate or a bank payout.
"""
import asyncio
import json
import re
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import httpx
from fastapi import Depends, HTTPException, Query, Request
from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, delete, select
from sqlalchemy.orm import Session

import main
import providers
import shopify_expenses
import shopify_server
import shopify_reconciliation as rec
from finance import dec, fmt
from models import Base, FxRate, OrderLine, ProductCost, User

app = rec.app
ZERO = Decimal('0')


class ShopifyOrderCurrency(Base):
    __tablename__ = 'shopify_order_currency'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    external_account = Column(String(180), nullable=False)
    order_id = Column(String(180), nullable=False)
    customer_currency = Column(String(3), nullable=False)
    customer_total = Column(Numeric(24, 6), nullable=False)
    shop_currency = Column(String(3), nullable=False)
    shop_total = Column(Numeric(24, 6), nullable=False)
    conversion_rate = Column(Numeric(24, 12), nullable=True)
    __table_args__ = (UniqueConstraint('user_id', 'external_account', 'order_id'),)


class AutomaticFxRate(Base):
    __tablename__ = 'automatic_fx_rates'
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    source_currency = Column(String(3), nullable=False)
    target_currency = Column(String(3), nullable=False)
    rate_date = Column(String(10), nullable=False)
    checked_at = Column(DateTime(timezone=True), nullable=False)
    __table_args__ = (UniqueConstraint('user_id', 'source_currency', 'target_currency'),)


# Shopify includes original customer currency and actual settlement rate;
# no reports access or extra OAuth scopes required.
ORDER_QUERY = rec.FEE_ORDER_QUERY.replace(
    'nodes { id name createdAt cancelledAt currencyCode',
    'nodes { id name createdAt cancelledAt currencyCode '
    'totalPriceSet { shopMoney { amount currencyCode } '
    'presentmentMoney { amount currencyCode } }',
    1,
).replace(
    'settlementCurrency settlementCurrencyRate fees',
    'settlementCurrency settlementCurrencyRate '
    'amountSet { shopMoney { amount currencyCode } '
    'presentmentMoney { amount currencyCode } } fees',
    1,
)
if ORDER_QUERY == rec.FEE_ORDER_QUERY or 'amountSet' not in ORDER_QUERY:
    raise RuntimeError('Shopify order query changed; review currency field selection')


def order_currency_info(order):
    bag = order.get('totalPriceSet') or {}
    shop = bag.get('shopMoney') or {}
    customer = bag.get('presentmentMoney') or {}
    if not shop.get('currencyCode') or shop.get('amount') is None:
        return None
    if not customer.get('currencyCode') or customer.get('amount') is None:
        return None
    info = {'customer_currency': customer['currencyCode'],
            'customer_total': dec(customer['amount']),
            'shop_currency': shop['currencyCode'],
            'shop_total': dec(shop['amount']), 'conversion_rate': None}
    if info['shop_currency'] != order['currencyCode']:
        return None
    if info['customer_currency'] == info['shop_currency']:
        info['conversion_rate'] = Decimal('1')
        return info
    rates = set()
    for tx in order.get('transactions') or []:
        if tx.get('status') != 'SUCCESS' or tx.get('kind') not in ('SALE', 'CAPTURE'):
            continue
        money = tx.get('amountSet') or {}
        original = money.get('presentmentMoney') or {}
        if (original.get('currencyCode') != info['customer_currency'] or
                tx.get('settlementCurrency') != info['shop_currency']):
            continue
        rate = dec(tx.get('settlementCurrencyRate'))
        if rate > ZERO:
            rates.add(rate)
    # Multiple captures can have distinct rates; don't invent one order-wide rate.
    if len(rates) == 1:
        info['conversion_rate'] = rates.pop()
    return info


async def shopify_orders_with_currency(shop, token, since):
    """One API traversal for all orders, exact fee components and currency info."""
    labels = await shopify_expenses.shipping_label_costs(shop, token)
    after = None
    output = []
    filt = 'updated_at:>=' + since.strftime('%Y-%m-%dT%H:%M:%SZ')
    for _ in range(40):
        page = (await providers.shopify_query(shop, token, ORDER_QUERY,
                                              {'after': after, 'filter': filt}))['orders']
        for order in page['nodes']:
            lines = order['lineItems']
            if lines['pageInfo']['hasNextPage']:
                raise providers.ProviderError('Order has more than 100 items; incomplete order refused')
            items = lines['nodes']
            if not items:
                continue
            currency = order['currencyCode']
            info = order_currency_info(order)
            fee = rec.fee_breakdown(order.get('transactions'), currency)
            shipping = dec(((order.get('totalShippingPriceSet') or {})
                            .get('shopMoney') or {}).get('amount'))
            shipping_paid = labels.get(order['name'])
            canceled = bool(order.get('cancelledAt'))
            active = sum(dec(x.get('currentQuantity') if x.get('currentQuantity') is not None
                             else x.get('quantity', 0)) > ZERO for x in items)
            divisor = max(active, 1)
            for item in items:
                qty = dec(item.get('currentQuantity') if item.get('currentQuantity') is not None
                          else item.get('quantity', 0))
                if qty < ZERO:
                    raise providers.ProviderError('Negative Shopify line-item quantity')
                original_qty = dec(item.get('quantity', 0))
                money = item['discountedTotalSet']['shopMoney']
                if money['currencyCode'] != currency:
                    raise providers.ProviderError('Order and line-item currencies differ')
                revenue = dec(money['amount']) * qty / original_qty if original_qty else ZERO
                live = qty > ZERO and not canceled
                output.append({
                    'provider': 'Shopify', 'external_account': shop,
                    'order_id': order['name'], 'line_id': item['id'],
                    'ordered_at': order['createdAt'], 'sku': item.get('sku') or '',
                    'product': item['title'], 'quantity': qty if not canceled else ZERO,
                    'currency': currency, 'item_revenue': revenue if not canceled else ZERO,
                    'shipping_revenue': shipping / divisor if live else ZERO,
                    'item_refunds': ZERO, 'shipping_refunds': ZERO,
                    'fees': fee['total'] / divisor if fee is not None and live else None,
                    'shipping_cost': (shipping_paid / divisor if shipping_paid is not None
                                      and live else None),
                    'other_cost': ZERO,
                    'status': 'canceled' if canceled else 'refunded' if qty == ZERO else 'paid',
                    '_shopify_fee_breakdown': fee if live else None,
                    '_shopify_currency_info': info,
                })
        if not page['pageInfo']['hasNextPage']:
            return output
        after = page['pageInfo']['endCursor']
    raise providers.ProviderError('Shopify sync exceeds 2,000 orders; use a smaller window')


_original_upsert = main.upsert_line


def upsert_with_currency(db, user_id, record):
    line = _original_upsert(db, user_id, record)
    info = record.get('_shopify_currency_info')
    if record.get('provider') == 'Shopify' and info is not None:
        match = db.scalar(select(ShopifyOrderCurrency).where(
            ShopifyOrderCurrency.user_id == user_id,
            ShopifyOrderCurrency.external_account == record['external_account'],
            ShopifyOrderCurrency.order_id == str(record['order_id'])))
        if match is None:
            match = ShopifyOrderCurrency(user_id=user_id,
                external_account=record['external_account'], order_id=str(record['order_id']))
            db.add(match)
        for field, value in info.items():
            setattr(match, field, value)
        if match.id is None:
            db.flush()  # prevent duplicate order metadata for multi-line orders
    return line


main.shopify_orders = shopify_orders_with_currency
main.upsert_line = upsert_with_currency


# Auto-rate conversion is optional and separate from Shopify's transaction rate.
# It never sends orders, account identities, or money amounts.
_cache = {}


async def reference_rate(source, target):
    if source == target:
        return Decimal('1'), 'same currency', None
    if not all(re.fullmatch('[A-Z]{3}', code) for code in (source, target)):
        raise ValueError('Invalid currency code')
    key = (source, target)
    saved = _cache.get(key)
    if saved and time.monotonic() - saved[0] < 12 * 3600:
        return saved[1]
    async with httpx.AsyncClient(timeout=7.0, follow_redirects=False) as client:
        response = await client.get('https://api.frankfurter.dev/v2/rate/' +
                                    source.lower() + '/' + target.lower())
        response.raise_for_status()
        payload = response.json()
    rate = dec(payload.get('rate'))
    if (rate <= ZERO or str(payload.get('base', source)).upper() != source or
            str(payload.get('quote', target)).upper() != target or
            not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(payload.get('date', '')))):
        raise ValueError('Invalid reference rate response')
    result = (rate, 'Frankfurter reference (not Shopify settlement)', payload['date'])
    _cache[key] = (time.monotonic(), result)
    return result


async def refresh_reporting_fx(db, user, *, replace=False):
    target = user.report_currency
    # No transaction or customer data is sent to the FX provider.
    sources = set(db.scalars(select(OrderLine.currency).where(
        OrderLine.user_id == user.id)).all())
    sources.update(x for x in db.scalars(select(OrderLine.cogs_currency).where(
        OrderLine.user_id == user.id)).all() if x)
    sources.update(db.scalars(select(ProductCost.currency).where(
        ProductCost.user_id == user.id)).all())
    existing = {x.currency: x for x in db.scalars(select(FxRate).where(
        FxRate.user_id == user.id)).all()}
    tags = {(x.source_currency, x.target_currency): x for x in db.scalars(
        select(AutomaticFxRate).where(AutomaticFxRate.user_id == user.id)).all()}
    changes = []
    errors = []
    sem = asyncio.Semaphore(5)

    async def fetch(source):
        async with sem:
            return await reference_rate(source, target)

    candidates = [source for source in sorted(sources) if source != target and
                  (replace or source not in existing or
                   ((source, target) in tags and
                    (datetime.now(timezone.utc) - main.aware(tags[(source, target)].checked_at))
                    >= timedelta(hours=12)))]
    results = await asyncio.gather(*(fetch(s) for s in candidates), return_exceptions=True)
    for source, result in zip(candidates, results):
        if isinstance(result, Exception):
            errors.append(source)
        else:
            changes.append((source, *result))
    if replace and errors:
        raise HTTPException(503, 'Currency cannot be changed: reference rates unavailable for ' +
                            ', '.join(errors) + '. No settings were changed.')
    if replace:
        db.execute(delete(FxRate).where(FxRate.user_id == user.id))
        db.execute(delete(AutomaticFxRate).where(AutomaticFxRate.user_id == user.id))
        existing.clear(); tags.clear()
    for source, rate, provider, date in changes:
        row = existing.get(source)
        if row is None:
            row = FxRate(user_id=user.id, currency=source)
            db.add(row)
        row.rate = rate
        tag = tags.get((source, target))
        if tag is None:
            tag = AutomaticFxRate(user_id=user.id, source_currency=source,
                                  target_currency=target)
            db.add(tag)
        tag.rate_date = date
        tag.checked_at = datetime.now(timezone.utc)
    if changes or replace:
        db.commit()
    return errors


@app.put('/api/settings/currency')
async def change_reporting_currency(payload: main.ReportCurrency,
                                    user: User = Depends(main.csrf),
                                    db: Session = Depends(main.get_db)):
    code = payload.currency.strip().upper()
    if not re.fullmatch('[A-Z]{3}', code):
        raise HTTPException(422, 'Invalid ISO currency')
    previous = user.report_currency
    if code != previous:
        user.report_currency = code
        try:
            await refresh_reporting_fx(db, user, replace=True)
        except Exception:
            db.rollback()
            raise
    return {'ok': True}


@app.get('/api/report')
async def report_with_auto_fx(period: int = Query(30, ge=1, le=3650),
                              channel: str = 'all', sales_type: str = 'all',
                              user: User = Depends(main.current),
                              db: Session = Depends(main.get_db)):
    missing = await refresh_reporting_fx(db, user)
    result = main.report(period=period, channel=channel, sales_type=sales_type,
                         user=user, db=db)
    result['warnings']['fx_rate_note'] = (
        'Automatic rates are latest available reference rates, not order-date '
        'Shopify settlement rates or historical accounting rates.')
    if missing:
        result['warnings']['fx_rate_unavailable'] = missing
    return result


@app.get('/api/shopify/financials')
async def financials_with_currency(period: int = Query(30, ge=1, le=3650),
                                  user: User = Depends(main.current),
                                  db: Session = Depends(main.get_db)):
    missing = await refresh_reporting_fx(db, user)
    since = main.now() - timedelta(days=period)
    lines = db.scalars(select(OrderLine).where(
        OrderLine.user_id == user.id, OrderLine.provider == 'Shopify',
        OrderLine.ordered_at >= since).order_by(OrderLine.ordered_at.desc())
        .limit(30001)).all()
    if len(lines) > 30000:
        raise HTTPException(422, 'More than 30,000 Shopify lines; choose a shorter period')
    rates = {x.currency: dec(x.rate) for x in db.scalars(
        select(FxRate).where(FxRate.user_id == user.id))}
    rates[user.report_currency] = Decimal('1')
    fees = db.scalars(select(rec.ShopifyFeeBreakdown).where(
        rec.ShopifyFeeBreakdown.user_id == user.id)).all()
    by_order = {(fee.external_account, fee.order_id): fee for fee in fees}
    result = rec.summarize_with_breakdown(lines, rates, user.report_currency, by_order)
    info = db.scalars(select(ShopifyOrderCurrency).where(
        ShopifyOrderCurrency.user_id == user.id)).all()
    by_money = {(x.external_account, x.order_id): x for x in info}
    tags = {(x.source_currency, x.target_currency): x for x in db.scalars(
        select(AutomaticFxRate).where(AutomaticFxRate.user_id == user.id)).all()}
    for row in result['rows']:
        money = by_money.get((row['store'], row['order_id']))
        if money is None:
            row.update({'original_total': None, 'original_currency': None,
                        'shopify_total': None, 'shopify_currency': None,
                        'shopify_conversion_rate': None,
                        'reporting_rate': None, 'reporting_rate_date': None})
            continue
        rate = rates.get(money.shop_currency)
        meta = tags.get((money.shop_currency, user.report_currency))
        row.update({
            'original_total': fmt(money.customer_total),
            'original_currency': money.customer_currency,
            'shopify_total': fmt(money.shop_total * rate) if rate is not None else None,
            'shopify_currency': user.report_currency if rate is not None else None,
            'shopify_conversion_rate': (str(money.conversion_rate)
                                        if money.conversion_rate is not None else None),
            'shopify_rate_pair': (money.customer_currency + ' → ' + money.shop_currency),
            'reporting_rate': str(rate) if rate is not None else None,
            'reporting_rate_pair': money.shop_currency + ' → ' + user.report_currency,
            'reporting_rate_date': (meta.rate_date if meta else None),
            'reporting_rate_source': ('Frankfurter reference' if meta else 'manual / identical'),
        })
    result['fx_rate_unavailable'] = missing
    result['note'] += (' Shopify conversion rate is the actual per-transaction '
                       'presentment-to-settlement rate. Reporting rates for other '
                       'currencies are latest available reference rates (dated per row), '
                       'not the realized Shopify settlement rate. Shopify order total '
                       'includes taxes, unlike the gross-sales figure.')
    return {'period': period, **result}


@app.post('/api/webhooks/shopify')
async def webhook_with_financial_redaction(request: Request,
                                          db: Session = Depends(main.get_db)):
    # Retain existing signed-webhook verifier. Only after it accepts a
    # shop/redact request do we delete the new per-shop financial metadata.
    outcome = await shopify_server.shopify_webhooks(request, db)
    if request.headers.get('x-shopify-topic') == 'shop/redact' and outcome.get('ok'):
        body = json.loads(await request.body())
        shop = providers.validate_shop(request.headers.get('x-shopify-shop-domain')
                                       or body['shop_domain'])
        db.execute(delete(rec.ShopifyFeeBreakdown).where(
            rec.ShopifyFeeBreakdown.external_account == shop))
        db.execute(delete(ShopifyOrderCurrency).where(
            ShopifyOrderCurrency.external_account == shop))
        db.commit()
    return outcome


# Starlette matches the first registered path, overriding only these endpoints.
for path in ('/api/settings/currency', '/api/report', '/api/shopify/financials',
             '/api/webhooks/shopify'):
    matches = [route for route in app.router.routes if getattr(route, 'path', None) == path]
    app.router.routes[:] = matches[-1:] + [r for r in app.router.routes if r not in matches[-1:]]