"""Production entrypoint: one-time financial backfill for existing Shopify stores.

Without this, the normal two-day incremental sync would leave earlier orders
with their pre-fix, inflated line revenues in the 30-day dashboard.
"""
from datetime import timedelta

from fastapi import BackgroundTasks, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

import main
import shopify_adjustments_dashboard as adjustments
from finance import dec, fmt
from models import OrderLine, User

app = adjustments.app
_original_sync = main.sync_one


async def sync_with_first_adjustment_backfill(db, connection):
    if connection.provider != 'Shopify':
        return await _original_sync(db, connection)
    exists = db.scalar(select(adjustments.ShopifySaleAdjustment.id).where(
        adjustments.ShopifySaleAdjustment.user_id == connection.user_id,
        adjustments.ShopifySaleAdjustment.external_account == connection.external_id).limit(1))
    if exists is None:
        # The first sync uses the existing 59-day initial-import window.
        # Do not delete prior orders or fees; upserts update them in place.
        connection.last_sync = None
    return await _original_sync(db, connection)


main.sync_one = sync_with_first_adjustment_backfill


@app.get('/api/report')
async def report_with_backfill_status(tasks: BackgroundTasks,
                                    period: int = Query(30, ge=1, le=3650),
                                    channel: str = 'all', sales_type: str = 'all',
                                    user: User = Depends(main.current),
                                    db: Session = Depends(main.get_db)):
    result = await adjustments.adjusted_report(
        tasks=tasks, period=period, channel=channel, sales_type=sales_type,
        user=user, db=db)
    if channel not in ('all', 'Shopify') or sales_type not in ('all', 'retail'):
        return result
    since = main.now() - timedelta(days=period)
    existing = db.scalars(select(OrderLine).where(
        OrderLine.user_id == user.id, OrderLine.provider == 'Shopify',
        OrderLine.ordered_at >= since).limit(30001)).all()
    covered = {(order.external_account, order.order_id) for order in db.scalars(
        select(adjustments.ShopifySaleAdjustment).where(
            adjustments.ShopifySaleAdjustment.user_id == user.id,
            adjustments.ShopifySaleAdjustment.ordered_at >= since)).all()}
    uncovered = {(line.external_account, line.order_id) for line in existing
                 if (line.external_account, line.order_id) not in covered
                 and line.status != 'canceled'}
    if uncovered:
        result['summary']['orders'] += len(uncovered)
        result['summary']['shopify_discounts'] = None
        result['summary']['shopify_refunds'] = None
        result['warnings']['financial_backfill_needed'] = (
            f'{len(uncovered)} Shopify orders still have pre-fix financials. '
            'Click Sync now; the first sync reimports the last 59 days.')
    return result


matches = [route for route in app.router.routes
           if getattr(route, 'path', None) == '/api/report']
app.router.routes[:] = matches[-1:] + [route for route in app.router.routes
                                      if route not in matches[-1:]]
