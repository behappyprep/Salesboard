"""Shopify onboarding and privacy callbacks, without network or real credentials."""
import base64
import hashlib
import hmac
from urllib.parse import urlparse, parse_qs

from fastapi.testclient import TestClient
from test_app import create, csv_upload
import main
import shopify_server as connector

SHOP = 'jollylook-test.myshopify.com'


def oauth_signature(params, secret):
    content = '&'.join(f'{k}={v}' for k, v in sorted(params.items()))
    return hmac.new(secret.encode(), content.encode(), hashlib.sha256).hexdigest()


def webhook(client, topic, payload, secret='test-shopify-secret', signature=True):
    import json
    body = json.dumps(payload).encode()
    digest = base64.b64encode(hmac.new(secret.encode(), body, hashlib.sha256).digest()).decode()
    return client.post('/api/webhooks/shopify', content=body, headers={
        'content-type': 'application/json', 'x-shopify-topic': topic,
        'x-shopify-shop-domain': SHOP,
        'x-shopify-hmac-sha256': digest if signature else 'invalid',
    })


def test_token_requirements_and_webhook_mac():
    from providers import ProviderError, SHOPIFY_SCOPES
    data = {'access_token': 'shpat_test', 'scope': SHOPIFY_SCOPES,
            'expires_in': 3600, 'refresh_token': 'shprt_test'}
    assert connector.check_shopify_token(data) == 3600
    for bad in ({**data, 'scope': 'read_orders'},
                {**data, 'refresh_token': ''}, {**data, 'expires_in': 0}):
        try: connector.check_shopify_token(bad)
        except ProviderError: pass
        else: assert False, 'missing permission or refresh must fail'
    body = b'{"shop_domain":"jollylook-test.myshopify.com"}'
    digest = base64.b64encode(hmac.new(b'key', body, hashlib.sha256).digest()).decode()
    assert connector.webhook_signature_valid(body, digest, 'key')
    assert not connector.webhook_signature_valid(body + b' ', digest, 'key')
    assert not connector.webhook_signature_valid(body, digest, 'wrong')


def test_shopify_connect_starts_and_background_sync_is_scheduled(monkeypatch):
    monkeypatch.setenv('SHOPIFY_CLIENT_ID', 'test-client')
    monkeypatch.setenv('SHOPIFY_CLIENT_SECRET', 'test-shopify-secret')
    async def token(shop, code):
        assert shop == SHOP and code == 'valid-code'
        return {'access_token': 'secret-token', 'refresh_token': 'secret-refresh',
                'scope': 'read_orders,read_products,read_inventory', 'expires_in': 3600}
    monkeypatch.setattr(connector, 'shopify_token', token)
    invoked = []
    async def sync(cid): invoked.append(cid)
    monkeypatch.setattr(connector, 'first_shopify_sync', sync)
    with TestClient(main.app) as client:
        create(client, 'shopify-onboarding@example.com')
        start = client.get('/api/connect/shopify/start?shop=' + SHOP, follow_redirects=False)
        assert start.status_code == 302
        url = urlparse(start.headers['location'])
        assert url.hostname == SHOP
        assert url.path == '/admin/oauth/authorize'
        assert parse_qs(url.query)['redirect_uri'] == ['http://testserver/api/oauth/shopify/callback']
        state = parse_qs(url.query)['state'][0]
        params = {'shop': SHOP, 'code': 'valid-code', 'state': state, 'timestamp': '1789730000'}
        params['hmac'] = oauth_signature(params, 'test-shopify-secret')
        done = client.get('/api/oauth/shopify/callback', params=params, follow_redirects=False)
        assert done.status_code == 303, done.text
        assert done.headers['location'] == '/?connected=Shopify'
        conns = client.get('/api/connections').json()['connections']
        assert len(conns) == 1 and conns[0]['name'] == SHOP
        assert invoked == [conns[0]['id']]
        replay = client.get('/api/oauth/shopify/callback', params=params, follow_redirects=False)
        assert replay.status_code == 400


def test_privacy_webhooks_are_verified_and_isolated(monkeypatch):
    monkeypatch.setenv('SHOPIFY_CLIENT_SECRET', 'test-shopify-secret')
    with TestClient(main.app) as alice, TestClient(main.app) as bob:
        c1 = create(alice, 'shopify-redact@example.com')
        c2 = create(bob, 'shopify-other@example.com')
        csv_header = 'provider,external_account,order_id,line_id,ordered_at,sku,product,quantity,currency,item_revenue,shipping_revenue,item_refunds,shipping_refunds,fees,shipping_cost,other_cost,cogs_unit,cogs_currency\n'
        one = csv_header + f'Shopify,{SHOP},S-111,1,2026-09-16T12:00:00Z,X,Widget,1,EUR,10,0,0,0,1,1,0,,\n'
        other = csv_header + 'Shopify,different.myshopify.com,S-222,1,2026-09-16T12:00:00Z,Y,Other,1,EUR,20,0,0,0,1,1,0,,\n'
        assert csv_upload(alice, one, c1).status_code == 200
        assert csv_upload(bob, other, c2).status_code == 200
        payload = {'shop_domain': SHOP}
        assert webhook(alice, 'shop/redact', payload, signature=False).status_code == 401
        assert alice.get('/api/report?period=3650').json()['summary']['orders'] == 1
        assert webhook(alice, 'customers/data_request', payload).status_code == 200
        assert webhook(alice, 'shop/redact', payload).status_code == 200
        assert alice.get('/api/report?period=3650').json()['summary']['orders'] == 0
        assert bob.get('/api/report?period=3650').json()['summary']['orders'] == 1
        assert webhook(alice, 'app/uninstalled', payload).status_code == 200
