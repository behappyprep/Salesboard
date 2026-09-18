"""Show customer-paid shipping as revenue without inventing postage expense.

The Shopify settlement breakdown and the tax-exclusive profitability overview
have different gross definitions. Neither changes when shipping is displayed
separately: customer shipping was already included in both gross totals.
"""
from datetime import timedelta
from decimal import Decimal

from fastapi import BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

import main
import shopify_autosync
import shopify_totals
from finance import compute_line, dec, fmt
from models import FxRate, OrderLine, User

app = shopify_totals.app
ZERO = Decimal('0')


def active(line):
    return not (line.status in ('canceled', 'refunded') and dec(line.quantity) == ZERO)


def rates_for(db, user):
    rates = {row.currency: dec(row.rate) for row in db.scalars(
        select(FxRate).where(FxRate.user_id == user.id)).all()}
    rates[user.report_currency] = Decimal('1')
    return rates


def shipping_amount(line, rates):
    rate = rates.get(line.currency)
    if rate is None or rate <= ZERO:
        return None
    return (dec(line.shipping_revenue) - dec(line.shipping_refunds)) * rate


@app.get('/api/report')
async def report_with_customer_shipping(
        tasks: BackgroundTasks, period: int = Query(30, ge=1, le=3650),
        channel: str = 'all', sales_type: str = 'all',
        user: User = Depends(main.current), db: Session = Depends(main.get_db)):
    # Preserves existing automatic FX updates and throttled Shopify sync.
    result = await shopify_autosync.auto_report(
        tasks=tasks, period=period, channel=channel, sales_type=sales_type,
        user=user, db=db)
    since = main.now() - timedelta(days=period)
    statement = select(OrderLine).where(
        OrderLine.user_id == user.id, OrderLine.ordered_at >= since)
    if channel != 'all':
        statement = statement.where(OrderLine.provider == channel)
    lines = db.scalars(statement.order_by(
        OrderLine.ordered_at.desc(), OrderLine.id.desc()).limit(30000)).all()
    rates = rates_for(db, user)
    shipping = ZERO
    before_shipping = ZERO
    considered = 0
    ready = 0
    missing_cogs = 0
    missing_fees = 0
    unknown_postage = 0
    for line in lines:
        if not active(line):
            continue
        if sales_type != 'all' and main.CHANNEL_TYPES[line.provider] != sales_type:
            continue
        # Match the overview's currency eligibility, so the shipping card
        # reconciles with the sales amount displayed beside it.
        if (line.currency not in rates or
                (line.cogs_snapshot is not None and line.cogs_currency not in rates)):
            continue
        considered += 1
        shipping += shipping_amount(line, rates)
        unknown_postage += line.shipping_cost is None
        missing_cogs += line.cogs_snapshot is None
        missing_fees += line.fees is None
        if line.cogs_snapshot is None or line.fees is None:
            continue
        calculated = compute_line(
            line.quantity, line.item_revenue, line.shipping_revenue,
            line.item_refunds, line.shipping_refunds, line.cogs_snapshot,
            line.fees, line.shipping_cost, line.other_cost, True,
            line.shipping_cost is not None,
            rates[line.cogs_currency], rates[line.currency])
        # This is explicitly BEFORE postage even if the actual postage cost
        # happens to be known. Customer-paid shipping remains revenue.
        before_shipping += (calculated['revenue'] - calculated['cogs'] -
                            calculated['fees'] - dec(line.other_cost) * rates[line.currency])
        ready += 1
    summary = result['summary']
    summary['shipping_charged'] = fmt(shipping)
    summary['product_sales'] = fmt(dec(summary['revenue']) - shipping)
    summary['pre_shipping_profit'] = (
        fmt(before_shipping) if considered and ready == considered and
        not result['warnings'].get('fx_excluded_lines') else None)
    summary['pre_shipping_ready_lines'] = ready
    summary['pre_shipping_missing_cogs_lines'] = missing_cogs
    summary['pre_shipping_missing_fee_lines'] = missing_fees
    summary['shipping_expense_unknown_lines'] = unknown_postage
    result['warnings']['shipping_explanation'] = (
        'Shipping charged to customers is revenue, already included in net sales. '
        'Actual postage expense is not inferred. Profit before postage excludes '
        'shipping expense; after-postage contribution stays unavailable without it.')
    return result


@app.get('/api/shopify/financials')
async def financials_with_customer_shipping(
        tasks: BackgroundTasks, period: int = Query(30, ge=1, le=3650),
        user: User = Depends(main.current), db: Session = Depends(main.get_db)):
    result = await shopify_totals.reconciled_financials(
        tasks=tasks, period=period, user=user, db=db)
    since = main.now() - timedelta(days=period)
    lines = db.scalars(select(OrderLine).where(
        OrderLine.user_id == user.id, OrderLine.provider == 'Shopify',
        OrderLine.ordered_at >= since).limit(30001)).all()
    if len(lines) > 30000:
        raise HTTPException(422, 'More than 30,000 Shopify lines; choose a shorter period')
    rates = rates_for(db, user)
    by_order = {}
    missing = set()
    for line in lines:
        if not active(line):
            continue
        key = (line.external_account, line.order_id)
        amount = shipping_amount(line, rates)
        if amount is None:
            missing.add(key)
        else:
            by_order[key] = by_order.get(key, ZERO) + amount
    for row in result['rows']:
        key = (row['store'], row['order_id'])
        row['shipping_charged'] = (
            fmt(by_order.get(key, ZERO)) if key not in missing else None)
    result['shipping_charged'] = (
        fmt(sum(by_order.values(), ZERO)) if not missing and
        not result.get('excluded_lines') else None)
    result['shipping_excluded_orders'] = len(missing)
    result['note'] += (' Shipping charged is customer-paid shipping revenue '
                       'already included in Gross total, not the cost of buying '
                       'shipping labels; it is not subtracted again from Net total.')
    return result


@app.get('/', include_in_schema=False)
def shipping_index():
    response = shopify_autosync.auto_refresh_index()
    html = response.body.decode('utf-8')
    html = html.replace('</body>',
        '<script defer src="/static/shipping_revenue.js"></script></body>')
    return HTMLResponse(html, headers={'Cache-Control': 'no-store'})


# Starlette resolves first matching route; prioritize our three overrides.
for path in ('/api/report', '/api/shopify/financials', '/'):
    matches = [route for route in app.router.routes
               if getattr(route, 'path', None) == path]
    app.router.routes[:] = matches[-1:] + [r for r in app.router.routes
                                           if r not in matches[-1:]]