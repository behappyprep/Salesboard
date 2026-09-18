"""ChannelPilot: multi-tenant sales app. Run: uvicorn main:app --reload.
API secrets never reach the browser. This is an MVP, not audited production software.
"""
import os, io, csv, json, re, secrets, hashlib, asyncio
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from pathlib import Path
from contextlib import asynccontextmanager
from urllib.parse import urlencode
from typing import Optional
from fastapi import FastAPI, Request, Depends, HTTPException, Response, UploadFile, File, Query
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from cryptography.fernet import Fernet, InvalidToken
from argon2 import PasswordHasher, exceptions as argon_errors
from sqlalchemy import select, delete, func, and_, text
from sqlalchemy.orm import Session as DbSession
from models import (Base,engine,SessionLocal,User,Session as LoginSession,OAuthState,Connection,
                    OrderLine,ProductCost,FxRate,utcnow)
from finance import dec, fmt, compute_line
from providers import (ProviderError, shopify_oauth_url,shopify_hmac_valid,shopify_token,refresh_shopify,
    shopify_costs,shopify_orders,etsy_oauth_url,etsy_token,refresh_etsy,etsy_shop_id,etsy_orders,
    faire_oauth_url,faire_token,faire_orders,validate_shop,setting,callback_url)

HERE=Path(__file__).resolve().parent
CHANNELS=('Shopify','Etsy','Amazon','Michaels','Faire')
CHANNEL_TYPES={'Faire':'wholesale','Shopify':'retail','Etsy':'retail','Amazon':'retail','Michaels':'retail'}
PH=PasswordHasher(time_cost=3,memory_cost=65536,parallelism=2)
F=None
if os.environ.get('APP_KEY'):
    try: F=Fernet(os.environ['APP_KEY'].encode())
    except Exception: raise RuntimeError('APP_KEY must be a valid Fernet key')

# App deliberately refuses real logins without a persistent encryption key.
def encryption():
    if F is None: raise HTTPException(503,'Server setup incomplete: set APP_KEY in .env')
    return F

def seal(text): return encryption().encrypt(text.encode()).decode()
def unseal(text): return encryption().decrypt(text.encode()).decode()
def sha(text): return hashlib.sha256(text.encode()).hexdigest()

def public_url():
    # Render injects the HTTPS URL at runtime; a custom domain can override APP_URL.
    return (os.getenv('APP_URL') or os.getenv('RENDER_EXTERNAL_URL') or 'http://localhost:8000').rstrip('/')
def now(): return datetime.now(timezone.utc)
def aware(d): return d.replace(tzinfo=timezone.utc) if d and d.tzinfo is None else d

def get_db():
    db=SessionLocal()
    try: yield db
    finally: db.close()

def csrf_origin_check(request):
    # Browsers set Origin on fetch POST; non-browser clients must present CSRF token.
    origin=request.headers.get('origin')
    if origin and origin.rstrip('/') != public_url():
        raise HTTPException(403,'Cross-origin request blocked')

def current(request:Request, db:DbSession=Depends(get_db)):
    raw=request.cookies.get('cp_session')
    if not raw: raise HTTPException(401,'Please sign in')
    session=db.scalar(select(LoginSession).where(LoginSession.token_hash==sha(raw)))
    if not session or aware(session.expires_at)<=now(): raise HTTPException(401,'Session expired')
    user=db.get(User,session.user_id)
    if not user: raise HTTPException(401,'Account not found')
    request.state.login_session=session
    return user

def csrf(request:Request,user:User=Depends(current)):
    csrf_origin_check(request)
    value=request.headers.get('x-csrf-token','')
    if not value or not secrets.compare_digest(sha(value),request.state.login_session.csrf_hash):
        raise HTTPException(403,'Missing or invalid CSRF token')
    return user

class AuthPayload(BaseModel):
    email: str
    password: str
    business_name: str = ''
class FxPayload(BaseModel):
    currency: str = Field(min_length=3,max_length=3)
    rate: str
class CostPayload(BaseModel):
    sku: str
    amount: str
    currency: str
class ReportCurrency(BaseModel):
    currency: str

failed_logins={}
def limiter(request, email):
    # Simple single-process development throttle; deploy behind IP-level rate limiting.
    key=(request.client.host if request.client else 'unknown',email)
    hits=[x for x in failed_logins.get(key,[]) if x>now()-timedelta(minutes=15)]
    failed_logins[key]=hits
    if len(hits)>=10: raise HTTPException(429,'Too many attempts; try later')
    return key

def set_session(response,user,db):
    raw=secrets.token_urlsafe(40); cs=secrets.token_urlsafe(32)
    login=LoginSession(user_id=user.id,token_hash=sha(raw),csrf_hash=sha(cs),expires_at=now()+timedelta(days=7))
    db.add(login); db.commit()
    response.set_cookie('cp_session',raw,httponly=True,samesite='lax',secure=os.getenv('COOKIE_SECURE','false').lower()=='true',max_age=7*86400,path='/')
    return cs

async def scheduler_loop():
    while True:
        await asyncio.sleep(1800)
        with SessionLocal() as db:
            ids=[r[0] for r in db.execute(select(Connection.id)).all()]
        for cid in ids:
            with SessionLocal() as db:
                c=db.get(Connection,cid)
                if not c: continue
                try: await sync_one(db,c)
                except Exception: pass  # sync_one persists sanitized error status

@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    task=None
    if os.getenv('ENABLE_SCHEDULER','false').lower()=='true':
        task=asyncio.create_task(scheduler_loop())
    yield
    if task:
        task.cancel()
        try: await task
        except asyncio.CancelledError: pass

app=FastAPI(title='ChannelPilot',version='0.1.0',lifespan=lifespan,docs_url=None,redoc_url=None)
app.mount('/static',StaticFiles(directory=HERE/'static'),name='static')

@app.get('/')
def index(): return FileResponse(HERE/'static'/'index.html',headers={'Cache-Control':'no-store'})

@app.get('/health')
def health():
    # Degraded database must fail the readiness check, not report false health.
    with engine.connect() as connection:
        connection.execute(text('SELECT 1'))
    return {'ok':True,'service':'channelpilot'}

@app.post('/api/auth/register')
def register(payload:AuthPayload,request:Request,response:Response,db:DbSession=Depends(get_db)):
    csrf_origin_check(request); encryption()
    email=payload.email.strip().lower(); name=payload.business_name.strip()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(email)>254:
        raise HTTPException(422,'Enter a valid email address')
    if len(payload.password)<12 or len(payload.password)>200: raise HTTPException(422,'Use a password of 12–200 characters')
    if not 2<=len(name)<=140: raise HTTPException(422,'Enter your business name')
    if db.scalar(select(User.id).where(User.email==email)): raise HTTPException(409,'Email already registered')
    user=User(email=email,password_hash=PH.hash(payload.password),business_name=name)
    db.add(user);db.flush();db.commit()
    csrf_token=set_session(response,user,db)
    return {'user':{'email':user.email,'business_name':user.business_name,'currency':user.report_currency},'csrf':csrf_token}

@app.post('/api/auth/login')
def login(payload:AuthPayload,request:Request,response:Response,db:DbSession=Depends(get_db)):
    csrf_origin_check(request); encryption(); email=payload.email.strip().lower(); key=limiter(request,email)
    user=db.scalar(select(User).where(User.email==email))
    try:
        if not user: PH.verify(PH.hash('dummy-password-unknown'),'invalid')
        else: PH.verify(user.password_hash,payload.password)
    except (argon_errors.VerifyMismatchError,argon_errors.VerificationError,argon_errors.InvalidHashError):
        failed_logins[key].append(now()); raise HTTPException(401,'Invalid email or password')
    failed_logins.pop(key,None)
    csrf_token=set_session(response,user,db)
    return {'user':{'email':user.email,'business_name':user.business_name,'currency':user.report_currency},'csrf':csrf_token}

@app.get('/api/me')
def me(request:Request,user:User=Depends(current)):
    # CSRF token is minted on each login and returned only once, then on reload create a new token for session.
    cs=secrets.token_urlsafe(32);request.state.login_session.csrf_hash=sha(cs)
    db=SessionLocal()
    try:
        existing=db.get(LoginSession,request.state.login_session.id)
        existing.csrf_hash=sha(cs);db.commit()
    finally:db.close()
    return {'user':{'email':user.email,'business_name':user.business_name,'currency':user.report_currency},'csrf':cs}

@app.post('/api/auth/logout')
def logout(request:Request,response:Response,user:User=Depends(csrf),db:DbSession=Depends(get_db)):
    db.execute(delete(LoginSession).where(LoginSession.id==request.state.login_session.id));db.commit()
    response.delete_cookie('cp_session',path='/');return {'ok':True}

@app.get('/api/connections')
def connections(user:User=Depends(current),db:DbSession=Depends(get_db)):
    arr=db.scalars(select(Connection).where(Connection.user_id==user.id).order_by(Connection.provider)).all()
    return {'connections':[{'id':c.id,'provider':c.provider,'name':c.display_name,'last_sync':c.last_sync,
                            'error':c.sync_error} for c in arr],
            'configured':{p:bool(os.getenv(k)) for p,k in [('Shopify','SHOPIFY_CLIENT_ID'),('Etsy','ETSY_CLIENT_ID'),('Faire','FAIRE_APP_ID')]},
            'csv_only':['Amazon','Michaels']}

def new_oauth_state(user,provider,meta,db):
    raw=secrets.token_urlsafe(40)
    row=OAuthState(user_id=user.id,provider=provider,state_hash=sha(raw),meta_encrypted=seal(json.dumps(meta)),expires_at=now()+timedelta(minutes=10))
    db.add(row);db.commit();return raw

def consume_oauth_state(raw,provider,db):
    row=db.scalar(select(OAuthState).where(OAuthState.state_hash==sha(raw),OAuthState.provider==provider))
    if not row or aware(row.expires_at)<=now(): raise HTTPException(400,'Authorization has expired. Start again.')
    meta=json.loads(unseal(row.meta_encrypted));uid=row.user_id
    db.delete(row);db.commit() # one-time state
    return uid,meta

@app.get('/api/connect/{provider}/start')
def connect_start(provider:str,shop:Optional[str]=None,user:User=Depends(current),db:DbSession=Depends(get_db)):
    provider=provider.lower()
    if provider=='shopify':
        if not shop: raise HTTPException(422,'Enter your .myshopify.com store domain')
        try:
            shop=validate_shop(shop);state=new_oauth_state(user,provider,{'shop':shop},db)
            url=shopify_oauth_url(shop,state)
        except ProviderError as exc:raise HTTPException(422,str(exc))
    elif provider=='etsy':
        setting('ETSY_CLIENT_ID');verifier=secrets.token_urlsafe(64)
        challenge=__import__('base64').urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
        state=new_oauth_state(user,provider,{'verifier':verifier},db)
        url=etsy_oauth_url(state,challenge)
    elif provider=='faire':
        setting('FAIRE_APP_ID');state=new_oauth_state(user,provider,{},db);url=faire_oauth_url(state)
    else: raise HTTPException(422,'This platform requires CSV import pending API credentials and approval')
    return RedirectResponse(url,status_code=302)

def save_connection(db,user_id,provider,external_id,display,token,refresh,expiry):
    old=db.scalar(select(Connection).where(Connection.user_id==user_id,Connection.provider==provider,Connection.external_id==external_id))
    if not old:
        old=Connection(user_id=user_id,provider=provider,external_id=external_id,display_name=display,token_encrypted=seal(token))
        db.add(old)
    old.token_encrypted=seal(token);old.refresh_encrypted=seal(refresh) if refresh else None
    old.expires_at=expiry;old.sync_error=None;db.commit();return old

@app.get('/api/oauth/shopify/callback')
async def shopify_callback(request:Request,db:DbSession=Depends(get_db)):
    params=dict(request.query_params)
    if not shopify_hmac_valid(params):raise HTTPException(403,'Invalid Shopify signature')
    uid,meta=consume_oauth_state(params.get('state',''),'shopify',db)
    shop=validate_shop(params.get('shop',''))
    if shop!=meta['shop']:raise HTTPException(403,'Store domain mismatch')
    try:
        data=await shopify_token(shop,params['code'])
        expiry=now()+timedelta(seconds=int(data['expires_in'])) if data.get('expires_in') else None
        save_connection(db,uid,'Shopify',shop,shop,data['access_token'],data.get('refresh_token'),expiry)
    except (KeyError,ProviderError) as exc:raise HTTPException(502,'Shopify connection failed') from exc
    return RedirectResponse('/?connected=Shopify',status_code=303)

@app.get('/api/oauth/etsy/callback')
async def etsy_callback(request:Request,db:DbSession=Depends(get_db)):
    uid,meta=consume_oauth_state(request.query_params.get('state',''),'etsy',db)
    try:
        data=await etsy_token(request.query_params['code'],meta['verifier'])
        shop_id,name=await etsy_shop_id(data['access_token'])
        expiry=now()+timedelta(seconds=int(data.get('expires_in',3600)))
        save_connection(db,uid,'Etsy',shop_id,name,data['access_token'],data.get('refresh_token'),expiry)
    except (KeyError,ProviderError) as exc:raise HTTPException(502,'Etsy connection failed') from exc
    return RedirectResponse('/?connected=Etsy',status_code=303)

@app.get('/api/oauth/faire/callback')
async def faire_callback(request:Request,db:DbSession=Depends(get_db)):
    uid,_=consume_oauth_state(request.query_params.get('state',''),'faire',db)
    try:
        data=await faire_token(request.query_params['authorizationCode'])
        # Faire does not expose a stable account id in OAuth token response; use scoped identity.
        # Re-authorizing the same workspace must not produce a new logical account id.
        prior=db.scalar(select(Connection).where(Connection.user_id==uid,Connection.provider=='Faire'))
        acct=prior.external_id if prior else 'faire-'+sha(data['access_token'])[:20]
        save_connection(db,uid,'Faire',acct,'Faire brand',data['access_token'],None,None)
    except (KeyError,ProviderError) as exc:raise HTTPException(502,'Faire connection failed') from exc
    return RedirectResponse('/?connected=Faire',status_code=303)

@app.post('/api/connections/{cid}/disconnect')
def disconnect(cid:int,user:User=Depends(csrf),db:DbSession=Depends(get_db)):
    c=db.scalar(select(Connection).where(Connection.id==cid,Connection.user_id==user.id))
    if not c:raise HTTPException(404,'Connection not found')
    db.delete(c);db.commit()
    # Existing sales remain unless user separately requests deletion.
    return {'ok':True}

async def valid_token(db,c):
    token=unseal(c.token_encrypted)
    if c.expires_at and aware(c.expires_at)<now()+timedelta(minutes=5):
        refresh=unseal(c.refresh_encrypted) if c.refresh_encrypted else None
        if not refresh:raise ProviderError('Access token expired. Reconnect the platform')
        if c.provider=='Shopify': data=await refresh_shopify(c.external_id,refresh)
        elif c.provider=='Etsy': data=await refresh_etsy(refresh)
        else: raise ProviderError('Reconnect platform to renew expired permission')
        token=data['access_token'];c.token_encrypted=seal(token)
        if data.get('refresh_token'):c.refresh_encrypted=seal(data['refresh_token'])
        c.expires_at=now()+timedelta(seconds=int(data.get('expires_in',3600)))
        db.commit()
    return token

def upsert_cost(db,user_id,item):
    sku=item['sku'].strip().upper()
    row=db.scalar(select(ProductCost).where(ProductCost.user_id==user_id,ProductCost.sku==sku))
    if row is None:
        row=ProductCost(user_id=user_id,sku=sku,currency=item.get('currency') or 'EUR')
        db.add(row)
    row.product=item.get('product') or row.product
    row.amount=item['amount']
    row.status=item['status']
    row.currency=item.get('currency') or row.currency
    row.updated_at=now()


def order_dt(value):
    if isinstance(value,datetime): dt=value
    else:
        try:dt=datetime.fromisoformat(str(value).replace('Z','+00:00'))
        except ValueError as exc:raise ValueError('Use ISO 8601 order dates') from exc
    return aware(dt)

def upsert_line(db,user_id,record):
    ch=record['provider'];sku=str(record.get('sku') or '').strip().upper()
    acct=str(record.get('external_account') or 'csv')
    order_id=str(record['order_id']);line_id=str(record['line_id'])
    line=db.scalar(select(OrderLine).where(OrderLine.user_id==user_id,OrderLine.provider==ch,
        OrderLine.external_account==acct,OrderLine.order_id==order_id,OrderLine.line_id==line_id))
    if line is None:
        line=OrderLine(user_id=user_id,provider=ch,external_account=acct,order_id=order_id,line_id=line_id)
        db.add(line)
    line.ordered_at=order_dt(record['ordered_at']);line.sku=sku
    line.product=str(record.get('product') or '')[:300];line.quantity=dec(record['quantity'])
    line.currency=str(record['currency']).upper()
    for key in ('item_revenue','shipping_revenue','item_refunds','shipping_refunds','fees','shipping_cost','other_cost'):
        value=record.get(key)
        setattr(line,key,dec(value) if value is not None and value!='' else (None if key in ('fees','shipping_cost') else Decimal('0')))
    line.status=str(record.get('status') or 'paid')[:50]
    # Costs are snapshotted when the order is first seen; CSV can provide actual historical unit costs.
    manual=record.get('cogs_unit')
    if manual is not None and manual!='':
        line.cogs_snapshot=dec(manual);line.cogs_currency=record.get('cogs_currency') or line.currency
        line.cogs_source='import'
    elif line.cogs_snapshot is None and sku:
        cost=db.scalar(select(ProductCost).where(ProductCost.user_id==user_id,ProductCost.sku==sku))
        if cost and cost.status=='available' and cost.amount is not None:
            line.cogs_snapshot=cost.amount;line.cogs_currency=cost.currency;line.cogs_source='shopify_current_estimate'
    return line

async def sync_one(db,c):
    try:
        token=await valid_token(db,c)
        # Shopify must sync ALL cost entries before updating orders.
        if c.provider=='Shopify':
            costs=await shopify_costs(c.external_id,token)
            for cost in costs:upsert_cost(db,c.user_id,cost)
            db.flush()
            # Existing imported sales with missing COGS pick up newly fetched Shopify costs.
            # Already snapshotted costs are never rewritten.
            unknown=db.scalars(select(OrderLine).where(OrderLine.user_id==c.user_id,
                OrderLine.cogs_snapshot.is_(None),OrderLine.sku!='')).all()
            cost_lookup={p.sku:p for p in db.scalars(select(ProductCost).where(
                ProductCost.user_id==c.user_id,ProductCost.status=='available')).all()}
            for line in unknown:
                match=cost_lookup.get(line.sku)
                if match and match.amount is not None:
                    line.cogs_snapshot=match.amount
                    line.cogs_currency=match.currency
                    line.cogs_source='shopify_current_estimate'
        since=aware(c.last_sync)-timedelta(days=2) if c.last_sync else now()-timedelta(days=59)
        if c.provider=='Shopify': rows=await shopify_orders(c.external_id,token,since)
        elif c.provider=='Etsy':rows=await etsy_orders(c.external_id,token,since)
        elif c.provider=='Faire':rows=await faire_orders(c.external_id,token,since)
        else:raise ProviderError('API integration unavailable; use CSV import')
        # Complete provider response obtained before changes are committed. Reconcile overlapping CSV order IDs.
        touched={r['order_id'] for r in rows}
        if touched:
            db.execute(delete(OrderLine).where(OrderLine.user_id==c.user_id,OrderLine.provider==c.provider,
                OrderLine.external_account=='csv',OrderLine.order_id.in_(touched)))
        for row in rows:upsert_line(db,c.user_id,row)
        c.last_sync=now();c.sync_error=None;db.commit()
        return {'synced':len(rows),'costs':len(costs) if c.provider=='Shopify' else 0,'at':c.last_sync.isoformat()}
    except (ProviderError,KeyError,ValueError) as exc:
        db.rollback()
        c=db.get(Connection,c.id)
        if c:
            c.sync_error=str(exc)[:250];db.commit()
        raise ProviderError(str(exc)) from exc

@app.post('/api/connections/{cid}/sync')
async def sync_now(cid:int,user:User=Depends(csrf),db:DbSession=Depends(get_db)):
    c=db.scalar(select(Connection).where(Connection.id==cid,Connection.user_id==user.id))
    if not c:raise HTTPException(404,'Connection not found')
    try:return await sync_one(db,c)
    except ProviderError as exc: raise HTTPException(502,str(exc))

@app.post('/api/sync/all')
async def sync_all(user:User=Depends(csrf),db:DbSession=Depends(get_db)):
    arr=db.scalars(select(Connection).where(Connection.user_id==user.id)).all()
    results=[]
    for c in arr:
        try: results.append({'provider':c.provider,'account':c.display_name,**(await sync_one(db,c))})
        except ProviderError as exc:results.append({'provider':c.provider,'account':c.display_name,'error':str(exc)})
    return {'results':results}

@app.get('/api/costs')
def get_costs(user:User=Depends(current),db:DbSession=Depends(get_db)):
    costs=db.scalars(select(ProductCost).where(ProductCost.user_id==user.id).order_by(ProductCost.sku)).all()
    return {'costs':[{'sku':c.sku,'product':c.product,'amount':str(c.amount) if c.amount is not None else None,
        'currency':c.currency,'status':c.status,'source':c.source} for c in costs]}

@app.put('/api/costs/{sku}')
def set_cost(sku:str,payload:CostPayload,user:User=Depends(csrf),db:DbSession=Depends(get_db)):
    sku=sku.strip().upper();currency=payload.currency.upper()
    if not sku or len(sku)>150 or not re.fullmatch('[A-Z]{3}',currency):raise HTTPException(422,'Invalid SKU or currency')
    amount=dec(payload.amount)
    if amount<0:raise HTTPException(422,'COGS cannot be negative')
    upsert_cost(db,user.id,{'sku':sku,'product':'','amount':amount,'currency':currency,'status':'available'})
    cost=db.scalar(select(ProductCost).where(ProductCost.user_id==user.id,ProductCost.sku==sku))
    cost.source='manual';db.commit();return {'ok':True}

@app.get('/api/settings')
def settings(user:User=Depends(current),db:DbSession=Depends(get_db)):
    return {'currency':user.report_currency,'fx':{r.currency:str(r.rate) for r in db.scalars(select(FxRate).where(FxRate.user_id==user.id))}}

@app.put('/api/settings/fx')
def set_fx(payload:FxPayload,user:User=Depends(csrf),db:DbSession=Depends(get_db)):
    code=payload.currency.upper();v=dec(payload.rate)
    if not re.fullmatch('[A-Z]{3}',code) or v<=0:raise HTTPException(422,'FX rate must be positive')
    row=db.scalar(select(FxRate).where(FxRate.user_id==user.id,FxRate.currency==code))
    if not row:row=FxRate(user_id=user.id,currency=code,rate=v);db.add(row)
    row.rate=v;db.commit();return {'ok':True}

@app.put('/api/settings/currency')
def set_report_currency(payload:ReportCurrency,user:User=Depends(csrf),db:DbSession=Depends(get_db)):
    code=payload.currency.upper()
    if not re.fullmatch('[A-Z]{3}',code): raise HTTPException(422,'Invalid ISO currency')
    user.report_currency=code;db.commit();return {'ok':True}

CSV_FIELDS=('provider','external_account','order_id','line_id','ordered_at','sku','product','quantity','currency',
    'item_revenue','shipping_revenue','item_refunds','shipping_refunds','fees','shipping_cost','other_cost',
    'cogs_unit','cogs_currency')
CSV_REQUIRED=('provider','order_id','ordered_at','quantity','currency','item_revenue')

@app.get('/api/import/template')
def template():
    return Response(','.join(CSV_FIELDS)+'\n',media_type='text/csv',headers={'Content-Disposition':'attachment; filename="channelpilot_import.csv"'})

@app.post('/api/import')
async def import_csv(file:UploadFile=File(...),user:User=Depends(csrf),db:DbSession=Depends(get_db)):
    raw=await file.read(5_000_001)
    if len(raw)>5_000_000:raise HTTPException(413,'CSV max size is 5 MB')
    try: text=raw.decode('utf-8-sig');reader=csv.DictReader(io.StringIO(text))
    except UnicodeDecodeError as exc:raise HTTPException(422,'Use UTF-8 CSV') from exc
    if not reader.fieldnames or not set(CSV_REQUIRED).issubset(set(reader.fieldnames)):
        raise HTTPException(422,'Missing CSV columns: '+', '.join(set(CSV_REQUIRED)-set(reader.fieldnames or [])))
    records=[];implicit_line_numbers={}
    try:
        for i,row in enumerate(reader,2):
            if i>10002:raise ValueError('Import up to 10,000 lines at a time')
            ch=(row.get('provider') or '').strip().capitalize()
            if ch not in CHANNELS:raise ValueError(f'Line {i}: unsupported provider')
            if not (row.get('order_id') or '').strip():raise ValueError(f'Line {i}: missing order ID')
            qty=dec(row['quantity'])
            if qty<=0:raise ValueError(f'Line {i}: quantity must be positive')
            if not re.fullmatch('[A-Z]{3}',(row['currency'] or '').upper()):raise ValueError(f'Line {i}: invalid currency')
            if dec(row['item_revenue'])<0:raise ValueError(f'Line {i}: item revenue cannot be negative')
            if row.get('fees') not in (None,'') and dec(row['fees'])<0:raise ValueError(f'Line {i}: fees must be positive cost')
            if row.get('shipping_cost') not in (None,'') and dec(row['shipping_cost'])<0:raise ValueError(f'Line {i}: shipping cost must be positive')
            order_dt(row['ordered_at'])
            rec={key:row.get(key) for key in CSV_FIELDS}
            rec['provider']=ch
            rec['external_account']=rec.get('external_account') or 'csv'
            if not rec.get('line_id'):
                # Reordered rows in future exports should not become different IDs.
                identity=(ch,rec['external_account'],rec['order_id'],(rec.get('sku') or '').upper())
                implicit_line_numbers[identity]=implicit_line_numbers.get(identity,0)+1
                rec['line_id']=f"{identity[3] or 'line'}-{implicit_line_numbers[identity]}"
            records.append(rec)
        for rec in records:upsert_line(db,user.id,rec)
        db.commit()
    except (ValueError,KeyError) as exc:
        db.rollback();raise HTTPException(422,str(exc)) from exc
    return {'imported':len(records)}

@app.get('/api/report')
def report(period:int=Query(30,ge=1,le=3650),channel:str='all',sales_type:str='all',
           user:User=Depends(current),db:DbSession=Depends(get_db)):
    if channel!='all' and channel not in CHANNELS:raise HTTPException(422,'Unknown channel')
    if sales_type not in ('all','retail','wholesale'):raise HTTPException(422,'Unknown sales type')
    since=now()-timedelta(days=period)
    statement=select(OrderLine).where(OrderLine.user_id==user.id,OrderLine.ordered_at>=since)
    if channel!='all':statement=statement.where(OrderLine.provider==channel)
    lines=db.scalars(statement.order_by(OrderLine.ordered_at.desc(),OrderLine.id.desc()).limit(30000)).all()
    fx={r.currency:dec(r.rate) for r in db.scalars(select(FxRate).where(FxRate.user_id==user.id))}
    fx[user.report_currency]=Decimal('1')
    total_rev=Decimal('0');total_profit=Decimal('0');total_gross_profit=Decimal('0');known_profit_revenue=Decimal('0');gross_profit_lines=0
    orders=set(); rows=[];chan={};prod={};day={};missing_fx=set();missing_cogs=set()
    for x in lines:
        if x.status in ('canceled','refunded') and dec(x.quantity)==0:continue
        kind=CHANNEL_TYPES[x.provider]
        if sales_type!='all' and kind!=sales_type:continue
        if x.currency not in fx or (x.cogs_snapshot is not None and x.cogs_currency not in fx):
            missing_fx.add(x.currency if x.currency not in fx else x.cogs_currency);continue
        calc=compute_line(x.quantity,x.item_revenue,x.shipping_revenue,x.item_refunds,x.shipping_refunds,
            x.cogs_snapshot,x.fees,x.shipping_cost,x.other_cost,x.fees is not None,
            x.shipping_cost is not None,fx[x.cogs_currency] if x.cogs_snapshot is not None else Decimal('1'),fx[x.currency])
        rev=calc['revenue'];profit=calc['profit'];total_rev+=rev
        if calc['gross_profit'] is not None:
            total_gross_profit+=calc['gross_profit'];gross_profit_lines+=1
        if profit is not None:total_profit+=profit;known_profit_revenue+=rev
        if x.cogs_snapshot is None:missing_cogs.add(x.sku or '(no SKU)')
        orders.add((x.provider,x.external_account,x.order_id))
        c=chan.setdefault(x.provider,{'channel':x.provider,'revenue':Decimal('0'),'gross_profit':Decimal('0'),'profit':Decimal('0'),'lines':0,'cogs_lines':0,'complete':0})
        c['revenue']+=rev;c['profit']+=profit or Decimal('0');c['gross_profit']+=calc['gross_profit'] or Decimal('0');c['lines']+=1;c['cogs_lines']+=int(calc['gross_profit'] is not None);c['complete']+=int(calc['complete'])
        p=prod.setdefault(x.sku or '(no SKU)',{'sku':x.sku or '(no SKU)','product':x.product,'revenue':Decimal('0'),'gross_profit':Decimal('0'),'profit':Decimal('0'),'units':Decimal('0'),'cogs_lines':0,'complete':0,'lines':0})
        p['revenue']+=rev;p['gross_profit']+=calc['gross_profit'] or Decimal('0');p['profit']+=profit or Decimal('0');p['units']+=dec(x.quantity);p['cogs_lines']+=int(calc['gross_profit'] is not None);p['complete']+=int(calc['complete']);p['lines']+=1
        date=x.ordered_at.strftime('%Y-%m-%d');d=day.setdefault(date,{'date':date,'revenue':Decimal('0'),'profit':Decimal('0')})
        d['revenue']+=rev;d['profit']+=profit or Decimal('0')
        rows.append({'id':x.id,'provider':x.provider,'order_id':x.order_id,'ordered_at':x.ordered_at.isoformat(),
          'sku':x.sku,'product':x.product,'quantity':fmt(x.quantity),'currency':x.currency,
          'revenue':fmt(rev),'cogs':fmt(calc['cogs']) if calc['cogs'] is not None else None,
          'gross_profit':fmt(calc['gross_profit']) if calc['gross_profit'] is not None else None,
          'profit':fmt(profit) if profit is not None else None,'fees_known':x.fees is not None,
          'shipping_known':x.shipping_cost is not None,'cogs_source':x.cogs_source})
    def out(items,fields):
        return [{k:(fmt(obj[k]) if k in fields else obj[k]) for k in obj} for obj in items]
    complete=sum(1 for r in rows if r['profit'] is not None)
    return {'currency':user.report_currency,'period':period,'sales_type':sales_type,'channel':channel,
        'summary':{'revenue':fmt(total_rev),'known_profit':fmt(total_profit),'gross_profit':fmt(total_gross_profit),'gross_profit_lines':gross_profit_lines,'known_profit_revenue':fmt(known_profit_revenue),
            'orders':len(orders),'lines':len(rows),'complete_lines':complete,'missing_cost_lines':len(rows)-complete,
            'margin_on_complete':fmt(total_profit/known_profit_revenue*100) if known_profit_revenue else None},
        'channels':out(sorted(chan.values(),key=lambda c:c['revenue'],reverse=True),('revenue','gross_profit','profit')),
        'products':out(sorted(prod.values(),key=lambda p:p['revenue'],reverse=True)[:25],('revenue','gross_profit','profit','units')),
        'trend':out(sorted(day.values(),key=lambda d:d['date']),('revenue','profit')),
        'orders':rows[:350],'warnings':{'missing_fx':sorted(missing_fx),'missing_cogs':sorted(missing_cogs)[:30],
        'fx_excluded_lines':len(lines)-len(rows),
        'profit_note':'Profit is reported ONLY for lines with recorded COGS, fees, and actual shipping cost. Excludes overhead and income tax. Shopify COGS for historical sales is a current-cost estimate, not historic inventory valuation.'}}

@app.get('/api/export')
def export_orders(user:User=Depends(current),db:DbSession=Depends(get_db)):
    rows=db.scalars(select(OrderLine).where(OrderLine.user_id==user.id).order_by(OrderLine.ordered_at.desc()).limit(30000)).all()
    b=io.StringIO();writer=csv.writer(b);writer.writerow(CSV_FIELDS)
    for x in rows:
        writer.writerow([getattr(x,'provider' if k=='provider' else k if k!='external_account' else 'external_account','') if k not in ('cogs_unit','cogs_currency')
              else getattr(x, 'cogs_snapshot' if k=='cogs_unit' else 'cogs_currency') for k in CSV_FIELDS])
    return Response(b.getvalue(),media_type='text/csv',headers={'Content-Disposition':'attachment; filename="channelpilot_orders.csv"'})

@app.exception_handler(ProviderError)
def provider_exception(request,exc):return JSONResponse(status_code=502,content={'detail':str(exc)})
