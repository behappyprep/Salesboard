"""Automatic, throttled refresh on authenticated dashboard reads.

Render's free web service can sleep, so its in-process 30-minute scheduler
cannot guarantee unattended updates. Sync when a merchant opens a report,
without requiring them to press Sync now. No tokens are sent to the browser.
"""
import time
from datetime import timedelta
from fastapi import BackgroundTasks, Depends, Query
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

import main
import shopify_currency as currency
import shopify_dashboard
import shopify_server
from models import Connection, User

app = currency.app
_pending = set()
_last_attempt = {}
MIN_INTERVAL_SECONDS = 30 * 60


async def _run_sync(connection_id):
    try:
        await shopify_server.first_shopify_sync(connection_id)
    finally:
        _pending.discard(connection_id)


def schedule_due_syncs(tasks, user_id, db):
    state = 'current'
    now = main.now()
    for connection in db.scalars(select(Connection).where(
            Connection.user_id == user_id,
            Connection.provider == 'Shopify')).all():
        identifier = connection.id
        if identifier in _pending:
            state = 'running'
            continue
        stale = (connection.last_sync is None or
                 main.aware(connection.last_sync) <= now - timedelta(minutes=30))
        if not stale:
            continue
        if time.monotonic() - _last_attempt.get(identifier, float('-inf')) < MIN_INTERVAL_SECONDS:
            if state != 'running':
                state = 'recently_attempted'
            continue
        _pending.add(identifier)
        _last_attempt[identifier] = time.monotonic()
        tasks.add_task(_run_sync, identifier)
        state = 'running'
    return state


@app.get('/api/report')
async def auto_report(tasks: BackgroundTasks,
                      period: int = Query(30, ge=1, le=3650),
                      channel: str = 'all', sales_type: str = 'all',
                      user: User = Depends(main.current),
                      db: Session = Depends(main.get_db)):
    state = schedule_due_syncs(tasks, user.id, db)
    report = await currency.report_with_auto_fx(period=period, channel=channel,
                                                sales_type=sales_type, user=user, db=db)
    report['shopify_sync_status'] = state
    return report


@app.get('/api/shopify/financials')
async def auto_financials(tasks: BackgroundTasks,
                          period: int = Query(30, ge=1, le=3650),
                          user: User = Depends(main.current),
                          db: Session = Depends(main.get_db)):
    state = schedule_due_syncs(tasks, user.id, db)
    report = await currency.financials_with_currency(period=period, user=user, db=db)
    report['shopify_sync_status'] = state
    return report


@app.get('/', include_in_schema=False)
def auto_refresh_index():
    response = shopify_dashboard.shopify_index()
    html = response.body.decode('utf-8')
    html = html.replace('</body>', '<script defer src="/static/auto_refresh.js"></script></body>')
    return HTMLResponse(html, headers={'Cache-Control': 'no-store'})


# Starlette chooses the earliest route with each path.
for path in ('/api/report', '/api/shopify/financials', '/'):
    matches = [r for r in app.router.routes if getattr(r, 'path', None) == path]
    app.router.routes[:] = matches[-1:] + [r for r in app.router.routes if r not in matches[-1:]]
