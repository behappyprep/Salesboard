import os, io, csv, sys
from pathlib import Path
from cryptography.fernet import Fernet
os.environ['DATABASE_URL']='sqlite:///' + str(Path('/tmp/channelpilot_test_'+str(os.getpid())+'.db'))
os.environ['APP_KEY']=Fernet.generate_key().decode()
os.environ['APP_URL']='http://testserver'
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from main import app
from finance import compute_line, dec


def create(client,email,name='Example Brand'):
    response=client.post('/api/auth/register',json={'email':email,'password':'long-secure-password-123','business_name':name})
    assert response.status_code==200,response.text
    return response.json()['csrf']

def put(client,route,payload,csrf):return client.put(route,json=payload,headers={'x-csrf-token':csrf})

def csv_upload(client,text,csrf):return client.post('/api/import',files={'file':('orders.csv',text.encode(),'text/csv')},headers={'x-csrf-token':csrf})


def test_app_end_to_end():
    with TestClient(app) as a, TestClient(app) as b:
        assert a.get('/health').json()['ok']
        csrf=create(a,'alpha@example.com','Alpha Company')
        token_b=create(b,'beta@example.com','Beta Company')
        # Auth and CSRF enforced; account A cannot modify B's data.
        assert a.put('/api/costs/SKU-A',json={'sku':'SKU-A','amount':'10','currency':'EUR'}).status_code==403
        assert put(a,'/api/costs/SKU-A',{'sku':'SKU-A','amount':'10','currency':'EUR'},csrf).status_code==200
        payload='provider,external_account,order_id,line_id,ordered_at,sku,product,quantity,currency,item_revenue,shipping_revenue,item_refunds,shipping_refunds,fees,shipping_cost,other_cost,cogs_unit,cogs_currency\n'
        payload+='Etsy,csv,E-1,LINE-1,2026-09-16T12:00:00Z,SKU-A,Example,2,EUR,60,5,10,0,6,4,2,,\n'
        r=csv_upload(a,payload,csrf);assert r.status_code==200,r.text
        report=a.get('/api/report?period=3650').json()
        assert report['summary']['revenue']=='55.00',report
        assert report['summary']['known_profit']=='23.00',report
        assert report['summary']['orders']==1
        assert report['summary']['complete_lines']==1
        assert report['orders'][0]['cogs_source']=='shopify_current_estimate'
        assert b.get('/api/report?period=3650').json()['summary']['orders']==0
        assert b.get('/api/costs').json()['costs']==[]
        # Idempotency: same provider/account/order/line overwrites, no duplicate.
        assert csv_upload(a,payload,csrf).status_code==200
        assert a.get('/api/report?period=3650').json()['summary']['orders']==1
        # Blank fees mean unknown, never fake profit.
        payload2=payload.splitlines()[0]+'\nShopify,csv,S-1,1,2026-09-16T12:00:00Z,SKU-A,Example,1,EUR,25,0,0,0,,0,0,,\n'
        assert csv_upload(a,payload2,csrf).status_code==200
        report=a.get('/api/report?period=3650').json()
        assert report['summary']['revenue']=='80.00'
        assert report['summary']['known_profit']=='23.00'
        assert report['summary']['complete_lines']==1
        assert report['summary']['missing_cost_lines']==1
        # Retail / wholesale filters cannot leak records.
        payload3=payload.splitlines()[0]+'\nFaire,csv,F-1,1,2026-09-16T12:00:00Z,SKU-A,Wholesale,2,EUR,40,0,0,0,4,2,0,,\n'
        assert csv_upload(a,payload3,csrf).status_code==200
        assert a.get('/api/report?period=3650&sales_type=wholesale').json()['summary']['revenue']=='40.00'
        assert a.get('/api/report?period=3650&sales_type=retail').json()['summary']['revenue']=='80.00'
        assert a.get('/api/report?period=3650&channel=Faire').json()['summary']['orders']==1
        # FX never defaults 1 for foreign currency.
        payload4=payload.splitlines()[0]+'\nAmazon,csv,A-1,1,2026-09-16T12:00:00Z,SKU-A,Example,1,USD,100,0,0,0,1,1,0,,\n'
        assert csv_upload(a,payload4,csrf).status_code==200
        data=a.get('/api/report?period=3650').json()
        assert data['summary']['revenue']=='120.00'
        assert data['warnings']['missing_fx']==['USD']
        assert put(a,'/api/settings/fx',{'currency':'USD','rate':'0.8'},csrf).status_code==200
        data=a.get('/api/report?period=3650').json()
        assert data['summary']['revenue']=='200.00'
        assert data['warnings']['missing_fx']==[]
        assert b.get('/api/export').text.count('A-1')==0
        # Dynamic OAuth start requires server configuration, no false success.
        assert a.get('/api/connect/amazon/start').status_code==422
        # invalid domain must not turn into SSRF
        os.environ['SHOPIFY_CLIENT_ID']='fake-client';os.environ['SHOPIFY_CLIENT_SECRET']='fake-secret'
        assert a.get('/api/connect/shopify/start?shop=evil.com').status_code==422
        # Logout ends session.
        assert a.post('/api/auth/logout',headers={'x-csrf-token':csrf}).status_code==200
        assert a.get('/api/report').status_code==401


def test_finance_zero_unknown_and_refunds():
    x=compute_line(2,60,5,10,0,10,6,4,2,True,True)
    assert x['revenue']==dec(55) and x['profit']==dec(23)
    y=compute_line(1,25,0,0,0,10,None,0,0,False,True)
    assert y['profit'] is None and not y['complete']
    z=compute_line(1,25,0,0,0,10,0,0,0,True,True)
    assert z['profit']==dec(15)
