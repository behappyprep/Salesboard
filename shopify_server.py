"""Shopify public-app installation and privacy webhook adapter for ChannelPilot.

The existing app keeps seller connections in PostgreSQL; this adapter adds
first-sync onboarding and verified GDPR/uninstallation handlers without adding
buyer identities to our database.
"""
import base64
import hashlib
import hmac
import json
from datetime import timedelta

from fastapi import BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import delete, select

import main
from main import (app, get_db, now, consume_oauth_state, save_connection,
                  SessionLocal, Connection, OrderLine, ProductCost, ProviderError)
from providers import (SHOPIFY_SCOPES, setting, shopify_hmac_valid,
                       shopify_token, validate_shop)

MAX_WEBHOOK_SIZE = 1_000_000
SUPPORTED_TOPICS = frozenset({
    'app/uninstalled', 'customers/data_request', 'customers/redact', 'shop/redact',
})


def check_shopify_token(data):
    """Fail closed on missing authorization, rather than claiming a connection."""
    if not isinstance(data, dict) or not data.get('access_token'):
        raise ProviderError('Shopify did not return an access token')
    granted = {s.strip() for s in str(data.get('scope') or '').split(',')}
    missing = set(SHOPIFY_SCOPES.split(',')) - granted
    if missing:
        raise ProviderError('Shopify did not grant the requested read permissions')
    if not data.get('refresh_token') or not data.get('expires_in'):
        raise ProviderError('Shopify did not return an expiring offline token and refresh token')
    try:
        lifetime = int(data['expires_in'])
    except (ValueError, TypeError) as exc:
        raise ProviderError('Invalid Shopify token expiry') from exc
    if lifetime <= 0:
        raise ProviderError('Invalid Shopify token expiry')
    return lifetime


def webhook_signature_valid(body, supplied, secret):
    """Shopify webhook HMAC is base64(HMAC-SHA256(raw request body))."""
    if not supplied or not secret:
        return False
    calculated = base64.b64encode(hmac.new(secret.encode(), body, hashlib.sha256).digest()).decode()
    return hmac.compare_digest(calculated, supplied.strip())


async def first_shopify_sync(connection_id):
    # A separate session survives the OAuth HTTP request that initiated the sync.
    with SessionLocal() as db:
        connection = db.get(Connection, connection_id)
        if connection and connection.provider == 'Shopify':
            try:
                await main.sync_one(db, connection)
            except Exception:
                # sync_one records expected provider errors on the connection;
                # unexpected failures must not expose credentials or break OAuth.
                db.rollback()


# Replace only the original Shopify callback; leave other provider routes intact.
app.router.routes[:] = [route for route in app.router.routes
                       if getattr(route, 'path', None) != '/api/oauth/shopify/callback']


@app.get('/api/oauth/shopify/callback')
async def shopify_callback(request: Request, tasks: BackgroundTasks, db=Depends(get_db)):
    params = dict(request.query_params)
    try:
        setting('SHOPIFY_CLIENT_ID')
        setting('SHOPIFY_CLIENT_SECRET')
        if not shopify_hmac_valid(params):
            raise HTTPException(403, 'Invalid Shopify authorization signature')
        shop = validate_shop(params.get('shop', ''))
        state = params.get('state', '')
        if not state or not params.get('code'):
            raise HTTPException(400, 'Shopify did not provide an authorization code')
        # HMAC + one-time state tie this exact store to the signed-in workspace.
        owner_id, metadata = consume_oauth_state(state, 'shopify', db)
        if metadata.get('shop') != shop:
            raise HTTPException(403, 'Shopify store domain does not match authorization')
        data = await shopify_token(shop, params['code'])
        lifetime = check_shopify_token(data)
        connection = save_connection(db, owner_id, 'Shopify', shop, shop,
                                     data['access_token'], data['refresh_token'],
                                     now() + timedelta(seconds=lifetime))
        tasks.add_task(first_shopify_sync, connection.id)
    except ProviderError as exc:
        # Do not embed token errors in the public redirect URL.
        raise HTTPException(422, str(exc)) from exc
    return RedirectResponse('/?connected=Shopify', status_code=303)


@app.post('/api/webhooks/shopify')
async def shopify_webhooks(request: Request, db=Depends(get_db)):
    """Verified Shopify privacy and uninstallation topics; no buyer PII retained."""
    if request.headers.get('content-type', '').split(';')[0].strip().lower() != 'application/json':
        raise HTTPException(415, 'Expected application/json')
    # Check size *before* JSON parsing or further processing.
    if request.headers.get('content-length', '').isdigit() and int(request.headers['content-length']) > MAX_WEBHOOK_SIZE:
        raise HTTPException(413, 'Webhook payload too large')
    body = await request.body()
    if len(body) > MAX_WEBHOOK_SIZE:
        raise HTTPException(413, 'Webhook payload too large')
    try:
        secret = setting('SHOPIFY_CLIENT_SECRET')
    except ProviderError:
        raise HTTPException(503, 'Shopify webhook configuration incomplete')
    if not webhook_signature_valid(body, request.headers.get('x-shopify-hmac-sha256', ''), secret):
        raise HTTPException(401, 'Invalid Shopify webhook signature')
    topic = request.headers.get('x-shopify-topic', '')
    if topic not in SUPPORTED_TOPICS:
        return {'ok': True, 'ignored': True}
    try:
        payload = json.loads(body)
    except (UnicodeDecodeError, ValueError) as exc:
        raise HTTPException(400, 'Invalid JSON') from exc
    if not isinstance(payload, dict):
        raise HTTPException(400, 'Invalid webhook object')
    shop_header = request.headers.get('x-shopify-shop-domain', '').strip().lower()
    shop_body = payload.get('shop_domain', '')
    if not isinstance(shop_body, str):
        raise HTTPException(400, 'Invalid shop domain')
    try:
        shop = validate_shop(shop_header or shop_body) if (shop_header or shop_body) else ''
    except ProviderError as exc:
        raise HTTPException(400, 'Invalid shop domain') from exc
    if not shop or (shop_body and shop != shop_body.lower()):
        raise HTTPException(400, 'Shop domain mismatch')
    if topic in ('customers/data_request', 'customers/redact'):
        # ChannelPilot stores no customer name, address, email, telephone, or
        # customer ID. Stored records are aggregate financial order-line data.
        return {'ok': True}
    if topic == 'app/uninstalled':
        db.execute(delete(Connection).where(Connection.provider == 'Shopify',
                                            Connection.external_id == shop))
        db.commit()
        return {'ok': True}
    # Shopify's shop/redact is the canonical store-data erasure request.
    ids = {x[0] for x in db.execute(select(OrderLine.user_id).where(
        OrderLine.provider == 'Shopify', OrderLine.external_account == shop)).all()}
    ids.update(x[0] for x in db.execute(select(Connection.user_id).where(
        Connection.provider == 'Shopify', Connection.external_id == shop)).all())
    db.execute(delete(OrderLine).where(OrderLine.provider == 'Shopify',
                                      OrderLine.external_account == shop))
    db.execute(delete(Connection).where(Connection.provider == 'Shopify',
                                       Connection.external_id == shop))
    for user_id in ids:
        other = db.scalar(select(Connection.id).where(Connection.user_id == user_id,
                        Connection.provider == 'Shopify').limit(1))
        if not other:
            db.execute(delete(ProductCost).where(ProductCost.user_id == user_id,
                                                 ProductCost.source == 'shopify'))
    db.commit()
    return {'ok': True}
