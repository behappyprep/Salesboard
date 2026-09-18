"""Provider API adapters. All credentials stay server-side; no customer PII is stored.
Adapters fail closed on unknown monetary schemas instead of fabricating revenue.
"""
import os, re, base64, hashlib, secrets, hmac
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from urllib.parse import urlencode
import httpx
from finance import dec

SHOPIFY_SCOPES = 'read_orders,read_products,read_inventory'
ETSY_SCOPES = 'transactions_r'
FAIRE_SCOPES = ['READ_ORDERS','READ_BRAND']
HTTP_TIMEOUT = 25

class ProviderError(Exception): pass

def setting(name):
    val=os.getenv(name,'').strip()
    if not val or val.startswith('REPLACE_'):
        raise ProviderError(f'{name} is not configured on the server')
    return val

def validate_shop(value):
    value=value.strip().lower()
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,60}\.myshopify\.com',value):
        raise ProviderError('Enter your actual *.myshopify.com domain')
    return value

def callback_url(provider):
    base=(os.getenv('APP_URL') or os.getenv('RENDER_EXTERNAL_URL') or '').rstrip('/')
    if not base:raise ProviderError('Public APP_URL is not configured')
    return base+'/api/oauth/'+provider+'/callback'

def shopify_oauth_url(shop,state):
    shop=validate_shop(shop)
    return f'https://{shop}/admin/oauth/authorize?'+urlencode({
        'client_id':setting('SHOPIFY_CLIENT_ID'), 'scope':SHOPIFY_SCOPES,
        'redirect_uri':callback_url('shopify'), 'state':state})

def shopify_hmac_valid(params):
    received=params.get('hmac','')
    values={k:v for k,v in params.items() if k not in ('hmac','signature')}
    signed='&'.join(f'{k}={v}' for k,v in sorted(values.items()))
    expected=hmac.new(setting('SHOPIFY_CLIENT_SECRET').encode(),signed.encode(),hashlib.sha256).hexdigest()
    return bool(received) and hmac.compare_digest(received,expected)

def etsy_oauth_url(state,challenge):
    return 'https://www.etsy.com/oauth/connect?'+urlencode({
        'response_type':'code','client_id':setting('ETSY_CLIENT_ID'),
        'redirect_uri':callback_url('etsy'),'scope':ETSY_SCOPES,
        'state':state,'code_challenge':challenge,'code_challenge_method':'S256'})

def faire_oauth_url(state):
    return 'https://faire.com/oauth2/authorize?'+urlencode({
        'applicationId':setting('FAIRE_APP_ID'), 'scope':','.join(FAIRE_SCOPES),
        'state':state, 'redirectUrl':callback_url('faire')})

async def json_request(method,url,headers=None,params=None,data=None,body=None):
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, follow_redirects=False) as client:
            response=await client.request(method,url,headers=headers,params=params,data=data,json=body)
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPStatusError,httpx.RequestError,ValueError) as exc:
        # Don't leak response bodies or OAuth secrets into user-facing errors or logs.
        status=exc.response.status_code if isinstance(exc,httpx.HTTPStatusError) else 'network'
        raise ProviderError(f'Provider request failed ({status}); check connection and API permissions') from exc

async def shopify_token(shop,code):
    return await json_request('POST',f'https://{validate_shop(shop)}/admin/oauth/access_token',data={
        'client_id':setting('SHOPIFY_CLIENT_ID'),'client_secret':setting('SHOPIFY_CLIENT_SECRET'),
        'code':code,'expiring':1})

async def refresh_shopify(shop,refresh_token):
    return await json_request('POST',f'https://{validate_shop(shop)}/admin/oauth/access_token',data={
        'client_id':setting('SHOPIFY_CLIENT_ID'),'client_secret':setting('SHOPIFY_CLIENT_SECRET'),
        'grant_type':'refresh_token','refresh_token':refresh_token})

async def shopify_query(shop,token,query,variables):
    result=await json_request('POST',f'https://{validate_shop(shop)}/admin/api/2026-07/graphql.json',
        headers={'X-Shopify-Access-Token':token},body={'query':query,'variables':variables})
    if result.get('errors') or result.get('data') is None:
        raise ProviderError('Shopify rejected a GraphQL query; verify read scopes and product-cost permissions')
    return result['data']

COST_QUERY='''query Costs($after: String) { productVariants(first: 100, after: $after) {
  pageInfo { hasNextPage endCursor }
  nodes { sku product { title } inventoryItem { unitCost { amount currencyCode } } }
} }'''
ORDERS_QUERY='''query Orders($after: String, $filter: String!) { orders(first: 50, after: $after, sortKey: UPDATED_AT, reverse: true, query: $filter) {
  pageInfo { hasNextPage endCursor }
  nodes { id name createdAt cancelledAt currencyCode
    totalShippingPriceSet { shopMoney { amount currencyCode } }
    lineItems(first: 100) { pageInfo { hasNextPage }
      nodes { id title sku quantity currentQuantity discountedTotalSet { shopMoney { amount currencyCode } } }
    }
  }
} }'''

async def shopify_costs(shop,token):
    """All variants, not just first 50; duplicate SKUs are marked ambiguous."""
    out={}; after=None
    for _ in range(150):
        page=(await shopify_query(shop,token,COST_QUERY,{'after':after}))['productVariants']
        for item in page['nodes']:
            sku=(item.get('sku') or '').strip().upper()
            if not sku: continue
            unit=(item.get('inventoryItem') or {}).get('unitCost')
            candidate={'sku':sku,'product':(item.get('product') or {}).get('title') or '',
                       'amount': dec(unit['amount']) if unit else None,
                       'currency': unit['currencyCode'] if unit else None,
                       'status':'available' if unit else 'missing'}
            if sku in out:
                out[sku]['status']='ambiguous';out[sku]['amount']=None
            else: out[sku]=candidate
        if not page['pageInfo']['hasNextPage']: return list(out.values())
        after=page['pageInfo']['endCursor']
    raise ProviderError('Shopify catalog exceeded safe sync limit; no partial cost catalog was committed')

async def shopify_orders(shop,token,since):
    after=None; orders=[]
    # Incremental updates; include returns and cancellations, not only new sales.
    filt='updated_at:>='+since.strftime('%Y-%m-%dT%H:%M:%SZ')
    for _ in range(40):
        page=(await shopify_query(shop,token,ORDERS_QUERY,{'after':after,'filter':filt}))['orders']
        for order in page['nodes']:
            if order['lineItems']['pageInfo']['hasNextPage']:
                raise ProviderError('Order contains over 100 items; pagination adapter needed before importing it')
            items=order['lineItems']['nodes']
            count=sum(1 for l in items if dec(l.get('currentQuantity',l.get('quantity',0)))>0)
            if not items: continue
            # A canceled / fully returned order still emits zeroed lines to overwrite
            # earlier paid rows. No returned items remain in aggregated sales.
            count=max(count,1)
            shipping=dec(((order.get('totalShippingPriceSet') or {}).get('shopMoney') or {}).get('amount'))
            # Keep fees / actual shipping cost NULL: Shopify sales API does not supply either.
            for line in items:
                qty=dec(line.get('currentQuantity') if line.get('currentQuantity') is not None else line.get('quantity',0))
                if qty<0: raise ProviderError('Shopify item has negative currentQuantity')
                full_qty=dec(line.get('quantity',0))
                money=line['discountedTotalSet']['shopMoney']
                amt=dec(money['amount'])*(qty/full_qty) if full_qty else Decimal('0')
                canceled=bool(order.get('cancelledAt'))
                orders.append({'provider':'Shopify','external_account':shop,'order_id':order['name'],
                    'line_id':line['id'],'ordered_at':order['createdAt'],'sku':line.get('sku') or '',
                    'product':line['title'],'quantity':Decimal('0') if canceled else qty,'currency':money['currencyCode'],
                    'item_revenue':Decimal('0') if canceled else amt,
                    'shipping_revenue':(shipping/count if qty>0 and not canceled else Decimal('0')),
                    'item_refunds':0,'shipping_refunds':0,
                    'fees':None,'shipping_cost':None,'other_cost':0,
                    'status':'canceled' if canceled else 'refunded' if qty==0 else 'paid'})
        if not page['pageInfo']['hasNextPage']: return orders
        after=page['pageInfo']['endCursor']
    raise ProviderError('Shopify incremental sync exceeds 2,000 orders; narrow sync window or use bulk operations')

async def etsy_token(code,verifier):
    return await json_request('POST','https://api.etsy.com/v3/public/oauth/token', data={
        'grant_type':'authorization_code','client_id':setting('ETSY_CLIENT_ID'),
        'redirect_uri':callback_url('etsy'),'code':code,'code_verifier':verifier})

async def refresh_etsy(refresh):
    return await json_request('POST','https://api.etsy.com/v3/public/oauth/token',data={
        'grant_type':'refresh_token','client_id':setting('ETSY_CLIENT_ID'),'refresh_token':refresh})

def etsy_headers(token): return {'x-api-key':setting('ETSY_CLIENT_ID')+':'+setting('ETSY_CLIENT_SECRET'), 'Authorization':'Bearer '+token}

async def etsy_shop_id(token):
    uid=token.split('.',1)[0]
    if not uid.isdigit(): raise ProviderError('Etsy token did not include a shop-owner user ID')
    shop=await json_request('GET',f'https://api.etsy.com/v3/application/users/{uid}/shops',headers=etsy_headers(token))
    return str(shop['shop_id']), shop.get('shop_name') or 'Etsy shop'

def etsy_money(value):
    if value is None: return Decimal('0')
    if isinstance(value,dict):
        return dec(value.get('amount',0))/dec(value.get('divisor',100))
    return dec(value)

async def etsy_orders(shop_id,token,since):
    result=[]; offset=0; headers=etsy_headers(token)
    for _ in range(20):
        page=await json_request('GET',f'https://api.etsy.com/v3/application/shops/{shop_id}/receipts',
            headers=headers,params={'limit':100,'offset':offset,'min_last_modified':int(since.timestamp())})
        receipts=page.get('results',[])
        for rec in receipts:
            canceled=bool(rec.get('was_canceled') or rec.get('status')=='canceled')
            rid=rec['receipt_id']
            tx=await json_request('GET',f'https://api.etsy.com/v3/application/shops/{shop_id}/receipts/{rid}/transactions',headers=headers)
            lines=tx.get('results',[])
            if tx.get('count',len(lines))>len(lines): raise ProviderError('Etsy order has unpaginated line items; import halted')
            currency=rec.get('currency_code')
            if not currency:
                raise ProviderError('Etsy receipt currency is unavailable; refusing to assume USD')
            for line in lines:
                q=dec(line.get('quantity',0))
                if q<=0: continue
                amount=etsy_money(line.get('price'))*q
                result.append({'provider':'Etsy','external_account':shop_id,'order_id':str(rid),
                    'line_id':str(line['transaction_id']),'ordered_at':datetime.fromtimestamp(
                        rec.get('create_timestamp') or rec.get('created_timestamp'),tz=timezone.utc).isoformat(),
                    'sku':line.get('sku') or '', 'product':line.get('title') or '',
                    'quantity':0 if canceled else q,'currency':currency,'item_revenue':0 if canceled else amount,
                    'shipping_revenue':0,'item_refunds':0,'shipping_refunds':0,
                    'fees':None,'shipping_cost':None,'other_cost':0,'status':'canceled' if canceled else 'paid'})
        offset+=len(receipts)
        if offset>=page.get('count',offset) or not receipts: return result
    raise ProviderError('Etsy sync exceeded 2,000 receipts; narrow sync window')

async def faire_token(code):
    return await json_request('POST','https://www.faire.com/api/external-api-oauth2/token',body={
        'application_token':setting('FAIRE_APP_ID'),'application_secret':setting('FAIRE_APP_SECRET'),
        'redirect_url':callback_url('faire'),'scope':FAIRE_SCOPES,
        'grant_type':'AUTHORIZATION_CODE','authorization_code':code})

def faire_headers(token):
    creds=base64.b64encode((setting('FAIRE_APP_ID')+':'+setting('FAIRE_APP_SECRET')).encode()).decode()
    return {'X-FAIRE-APP-CREDENTIALS':creds,'X-FAIRE-OAUTH-ACCESS-TOKEN':token}

async def faire_orders(account_id,token,since):
    """Faire Brand External API v2: cursor pages, money.amount_minor (not decimal strings).
    Item price is per unit. Brand's post-discount order subtotal, if present, is
    authoritative and distributed across items. Fees intentionally remain unknown.
    """
    def amount(value,currency=None):
        if not isinstance(value,dict) or 'amount_minor' not in value or not value.get('currency'):
            raise ProviderError('Faire returned an unrecognized monetary field; sync halted safely')
        code=value['currency']
        if currency and code!=currency: raise ProviderError('Faire order mixes currencies; sync halted safely')
        digits=0 if code in ('JPY','KRW','CLP','VND') else 3 if code in ('KWD','BHD','OMR') else 2
        if code not in ('EUR','USD','GBP','CAD','AUD','CHF','NZD','SEK','NOK','DKK','PLN','CZK',
                        'JPY','KRW','CLP','VND','KWD','BHD','OMR'):
            raise ProviderError('Faire currency exponent is not configured for '+str(code))
        return dec(value['amount_minor'])/(Decimal(10)**digits),code
    result=[];cursor=None;seen=set()
    for _ in range(100):
        params={'limit':100,'updated_at_min':since.isoformat().replace('+00:00','Z')}
        if cursor:params['cursor']=cursor
        page=await json_request('GET','https://www.faire.com/external-api/v2/orders',headers=faire_headers(token),params=params)
        if not isinstance(page,dict) or not isinstance(page.get('orders'),list):
            raise ProviderError('Faire returned an unrecognized order response')
        for o in page['orders']:
            canceled=o.get('state')=='CANCELED'
            items=o.get('items',[])
            if not items:continue
            prepared=[]
            for item in items:
                qty=dec(item.get('quantity',0))
                if qty<0:raise ProviderError('Faire item has a negative quantity')
                unit,cc=amount(item.get('price'))
                raw=qty*unit
                discounts=Decimal('0')
                for discount in item.get('discounts') or []:
                    d,_=amount(discount.get('discount_amount'),cc);discounts+=d
                prepared.append((item,qty,raw,discounts,cc))
            currencies={x[4] for x in prepared}
            if len(currencies)!=1:raise ProviderError('Faire order contains different line currencies')
            currency=next(iter(currencies))
            gross=sum((x[2] for x in prepared),Decimal('0'))
            payout=o.get('payout_costs') or {}
            if payout.get('subtotal_after_brand_discounts'):
                subtotal,_=amount(payout['subtotal_after_brand_discounts'],currency)
            else:
                brand_discounts=sum((amount(d.get('discount_amount'),currency)[0] for d in o.get('brand_discounts') or []),Decimal('0'))
                subtotal=gross-sum((x[3] for x in prepared),Decimal('0'))-brand_discounts
            if subtotal<0 or (gross==0 and subtotal!=0):
                raise ProviderError('Faire discount/subtotal fields are inconsistent; sync halted safely')
            shipments=o.get('shipments') or []
            shipping=None
            if shipments and all(s.get('maker_cost') for s in shipments):
                shipping=sum((amount(s['maker_cost'],currency)[0] for s in shipments),Decimal('0'))
            for item,qty,raw,_,cc in prepared:
                if qty==0:continue
                # Weighted allocation preserves post-discount order subtotal exactly before storage rounding.
                line_revenue=subtotal*raw/gross if gross else Decimal('0')
                result.append({'provider':'Faire','external_account':account_id,'order_id':o['id'],
                    'line_id':str(item['id']),'ordered_at':o['created_at'],'sku':item.get('sku') or '',
                    'product':item.get('product_name') or '', 'quantity':0 if canceled else qty,'currency':cc,
                    'item_revenue':0 if canceled else line_revenue,'shipping_revenue':0,'item_refunds':0,'shipping_refunds':0,
                    'fees':None,'shipping_cost':shipping*raw/gross if shipping is not None and gross else None,
                    'other_cost':0,'status':'canceled' if canceled else o.get('state') or 'NEW'})
        new_cursor=page.get('cursor') or page.get('next_cursor')
        if not new_cursor:
            if len(page['orders'])>=100:
                raise ProviderError('Faire returned a full page without cursor; completeness not assured')
            return result
        if new_cursor in seen:raise ProviderError('Faire pagination cursor repeated; sync halted')
        seen.add(new_cursor);cursor=new_cursor
    raise ProviderError('Faire sync exceeded 10,000 orders; narrow sync window')
