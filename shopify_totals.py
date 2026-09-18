"""Make Shopify's fee view reconcile to Shopify order totals, including tax.

The general profitability overview deliberately excludes sales tax. This page
instead uses Shopify's own order total as its gross starting point, so the
payment/FX fees reconcile to the merchant's payment timeline. Payouts, refunds
and adjustments may still differ, and those differences are not fabricated.
"""
from datetime import timedelta
from decimal import Decimal

from fastapi import BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

import main
import shopify_autosync as autosync
import shopify_currency as currency
from finance import dec, fmt
from models import FxRate, OrderLine, User

app = autosync.app
ZERO = Decimal('0')


@app.get('/api/shopify/financials')
async def reconciled_financials(tasks: BackgroundTasks,
                                period: int = Query(30, ge=1, le=3650),
                                user: User = Depends(main.current),
                                db: Session = Depends(main.get_db)):
    result = await autosync.auto_financials(tasks=tasks, period=period,
                                             user=user, db=db)
    since = main.now() - timedelta(days=period)
    lines = db.scalars(select(OrderLine).where(
        OrderLine.user_id == user.id, OrderLine.provider == 'Shopify',
        OrderLine.ordered_at >= since).limit(30001)).all()
    if len(lines) > 30000:
        raise HTTPException(422, 'More than 30,000 Shopify lines; choose a shorter period')
    keys = {(line.external_account, line.order_id) for line in lines
            if not (line.status in ('canceled', 'refunded') and
                    dec(line.quantity) == ZERO)}
    rates = {r.currency: dec(r.rate) for r in db.scalars(select(FxRate).where(
        FxRate.user_id == user.id)).all()}
    rates[user.report_currency] = Decimal('1')
    money = {(item.external_account, item.order_id): item for item in db.scalars(
        select(currency.ShopifyOrderCurrency).where(
            currency.ShopifyOrderCurrency.user_id == user.id)).all()}
    gross_by_order = {}
    for key in keys:
        item = money.get(key)
        rate = rates.get(item.shop_currency) if item else None
        gross_by_order[key] = dec(item.shop_total) * rate if rate is not None else None

    for row in result['rows']:
        gross = gross_by_order.get((row['store'], row['order_id']))
        if gross is None:
            row['gross_total'] = None
            row['net_total'] = None
            continue
        # Old summary used tax-exclusive line revenue; recover its known total
        # fee before replacing gross, or use both explicitly split components.
        old_gross = row['gross_total']
        old_net = row['net_total']
        if row['payments_fee'] is not None and row['currency_conversion_fee'] is not None:
            fee = dec(row['payments_fee']) + dec(row['currency_conversion_fee'])
        elif old_gross is not None and old_net is not None:
            fee = dec(old_gross) - dec(old_net)
        else:
            fee = None
        row['gross_total'] = fmt(gross)
        row['net_total'] = fmt(gross - fee) if fee is not None else None

    missing_gross = [key for key, value in gross_by_order.items() if value is None]
    fully_known_gross = not missing_gross and not result['excluded_lines']
    if fully_known_gross:
        gross_total = sum(gross_by_order.values(), ZERO)
        result['gross_total'] = fmt(gross_total)
        all_fees_known = result['missing_fee_orders'] == 0
        result['net_total'] = (fmt(gross_total - dec(result['known_transaction_fees']))
                               if all_fees_known else None)
    else:
        result['gross_total'] = None
        result['net_total'] = None
    result['missing_shopify_totals'] = len(missing_gross)
    result['note'] = (
        'Gross is Shopify order total including tax and shipping, not tax-exclusive '
        'product sales. Payment fees and currency conversion fees are imported '
        'separately and subtracted once. The Shopify FX rate is the actual '
        'customer-currency to settlement-currency transaction rate. When the '
        'chosen reporting currency differs, the dated reference rate is '
        'indicative, not a Shopify settlement rate. Net is gross less these '
        'known fees, not a confirmed payout; refunds, disputes, adjustments '
        'and multiple payment captures may affect actual cash settlement.')
    return result


# The new endpoint shadows the legacy tax-exclusive financial breakdown only.
matches = [route for route in app.router.routes
           if getattr(route, 'path', None) == '/api/shopify/financials']
app.router.routes[:] = matches[-1:] + [r for r in app.router.routes
                                      if r not in matches[-1:]]
