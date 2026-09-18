"""Read-only Shopify fee reconciliation view for the existing ChannelPilot app.

With read_orders alone we know the total Shopify Payments transaction fees but
cannot reliably isolate the foreign-exchange portion. Never display an invented
FX fee or mistake a fee-inclusive number for a payout.
"""
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from fastapi import Depends, Query
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

import main
import shopify_backfill
from finance import dec, fmt
from models import FxRate, OrderLine, User

app = shopify_backfill.app


def summarize(lines, rates, report_currency):
    """Summarize Shopify orders; unknown fees and FX remain unknown, not zero."""
    groups = {}
    missing_fx = set()
    excluded = 0
    for line in lines:
        if line.status in ('canceled', 'refunded') and dec(line.quantity) == 0:
            continue
        rate = rates.get(line.currency)
        if rate is None or rate <= 0:
            missing_fx.add(line.currency)
            excluded += 1
            continue
        key = (line.external_account, line.order_id)
        group = groups.setdefault(key, {'store': line.external_account,
                                         'order_id': line.order_id,
                                         'date': line.ordered_at.strftime('%Y-%m-%d'),
                                         'gross': Decimal('0'), 'fees': Decimal('0'),
                                         'fee_known': True, 'line_count': 0})
        group['gross'] += (dec(line.item_revenue) + dec(line.shipping_revenue)
                           - dec(line.item_refunds) - dec(line.shipping_refunds)) * rate
        group['line_count'] += 1
        if line.fees is None:
            group['fee_known'] = False
        else:
            group['fees'] += dec(line.fees) * rate

    orders = sorted(groups.values(), key=lambda o: (o['date'], o['order_id']), reverse=True)
    gross = sum((o['gross'] for o in orders), Decimal('0'))
    known_fees = sum((o['fees'] for o in orders if o['fee_known']), Decimal('0'))
    missing_fees = sum(not o['fee_known'] for o in orders)
    # Never use partial fee totals as if all orders were accounted for.
    all_fees = known_fees if not missing_fees and not excluded and orders else None
    net = gross - all_fees if all_fees is not None else None
    rows = [{'store': o['store'], 'order_id': o['order_id'], 'date': o['date'],
             'gross_total': fmt(o['gross']),
             'payments_fee': fmt(o['fees']) if o['fee_known'] else None,
             'currency_conversion_fee': None,
             'net_total': fmt(o['gross'] - o['fees']) if o['fee_known'] else None}
            for o in orders[:250]]
    return {'currency': report_currency, 'orders': len(orders),
            'gross_total': fmt(gross) if not excluded else None,
            'payments_fee': fmt(all_fees) if all_fees is not None else None,
            'known_transaction_fees': fmt(known_fees),
            'currency_conversion_fee': None,
            'net_total': fmt(net) if net is not None else None,
            'missing_fee_orders': missing_fees, 'missing_fx': sorted(missing_fx),
            'excluded_lines': excluded, 'rows': rows,
            'rows_truncated': len(orders) > len(rows),
            'fees_include_fx': True,
            'note': 'Gross is recorded sales after refunds, excluding sales tax. Payments fee is the total Shopify Payments transaction fees and may already include FX charges; FX cannot yet be isolated without Shopify reports access. Net is gross less those fees, NOT a payout or net profit.'}


@app.get('/api/shopify/financials')
def shopify_financials(period: int = Query(30, ge=1, le=3650),
                       user: User = Depends(main.current),
                       db: Session = Depends(main.get_db)):
    since = main.now() - timedelta(days=period)
    lines = db.scalars(select(OrderLine).where(
        OrderLine.user_id == user.id,
        OrderLine.provider == 'Shopify',
        OrderLine.ordered_at >= since,
    ).order_by(OrderLine.ordered_at.desc()).limit(30001)).all()
    if len(lines) > 30000:
        from fastapi import HTTPException
        raise HTTPException(422, 'More than 30,000 Shopify lines; choose a shorter period')
    rates = {r.currency: dec(r.rate) for r in db.scalars(
        select(FxRate).where(FxRate.user_id == user.id))}
    rates[user.report_currency] = Decimal('1')
    return {'period': period, **summarize(lines, rates, user.report_currency)}


# Override ONLY the HTML page to load the Shopify section; leave existing
# login, settings, CSV, webhook, scheduler, and Shopify sync routes intact.
@app.get('/', include_in_schema=False)
def shopify_index():
    html = (Path(main.HERE) / 'static' / 'index.html').read_text(encoding='utf-8')
    html = html.replace('</body>', '<script defer src="/static/shopify_detail.js"></script></body>')
    return HTMLResponse(html, headers={'Cache-Control': 'no-store'})

# Starlette chooses the first matching route, so put our root route first.
app.router.routes.insert(0, app.router.routes.pop())
