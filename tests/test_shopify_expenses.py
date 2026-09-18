"""Run: python tests/test_shopify_expenses.py (dependency-isolated adapter tests)."""
import asyncio
import importlib.util
import sys
import types
from decimal import Decimal
from pathlib import Path
from unittest.mock import AsyncMock


def dec(value):
    result = Decimal(str('0' if value is None else value))
    if not result.is_finite():
        raise ValueError('Non-finite money amount')
    return result


server = types.ModuleType('shopify_server')
server.app = object()
server.SHOPIFY_SCOPES = 'read_orders,read_products,read_inventory'
providers = types.ModuleType('providers')
providers.SHOPIFY_SCOPES = server.SHOPIFY_SCOPES
providers.ORDERS_QUERY = 'query { orders { nodes { lineItems(first: 100) { nodes {id} } } } }'
providers.ProviderError = type('ProviderError', (Exception,), {})
providers.shopify_query = AsyncMock()
main = types.ModuleType('main')
main.shopify_orders = object()
main.upsert_line = lambda *args: args[-1]
finance = types.ModuleType('finance')
finance.dec = dec
sys.modules.update(shopify_server=server, providers=providers, main=main, finance=finance)
source = Path(__file__).resolve().parents[1] / 'shopify_expenses.py'
spec = importlib.util.spec_from_file_location('shopify_expenses', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_fee_classification():
    tx = {'id': 't1', 'kind': 'SALE', 'status': 'SUCCESS', 'gateway': 'shopify_payments',
          'fees': [{'id': 'f1', 'amount': {'amount': '3.10', 'currencyCode': 'USD'}}]}
    assert module.payment_fees([tx], 'USD') == Decimal('3.10')
    assert module.payment_fees([tx, tx], 'USD') == Decimal('3.10')
    assert module.payment_fees([tx], 'EUR') is None
    assert module.payment_fees([dict(tx, gateway='paypal')], 'USD') is None
    assert module.payment_fees([dict(tx, fees=[])], 'USD') is None
    assert module.payment_fees([dict(tx, kind='AUTHORIZATION')], 'USD') is None
    assert module.payment_fees([dict(tx, status='PENDING')], 'USD') is None
    assert module.payment_fees([tx, dict(tx, id='t2', gateway='paypal')], 'USD') is None


def test_shipping_label_coverage():
    data = {'parseErrors': [], 'tableData': {'rows': [
        {'order_name': '#100', 'shipping_label_costs': '4.25'},
        {'order_name': '#100', 'shipping_label_costs': '5.75'},
    ]}}
    assert module.parse_shipping_labels(data) == {'#100': Decimal('10.00')}
    assert module.parse_shipping_labels({'parseErrors': ['No permission'],
                                         'tableData': {'rows': []}}) == {}
    assert module.parse_shipping_labels({'parseErrors': [], 'tableData': {'rows': [
        {'order_name': '#100', 'shipping_label_costs': 'NaN'}]}}) == {}


async def test_exact_allocation():
    order = {'name': '#123', 'createdAt': '2026-09-18T00:00:00Z',
             'cancelledAt': None, 'currencyCode': 'USD',
             'totalShippingPriceSet': {'shopMoney': {'amount': '8.00'}},
             'transactions': [{'id': 't1', 'kind': 'SALE', 'status': 'SUCCESS',
                               'gateway': 'shopify_payments',
                               'fees': [{'id': 'f1', 'amount': {'amount': '2', 'currencyCode': 'USD'}}]}],
             'lineItems': {'pageInfo': {'hasNextPage': False}, 'nodes': [
                 {'id': 'l1', 'title': 'Camera', 'sku': 'SKU1', 'quantity': 1,
                  'currentQuantity': 1, 'discountedTotalSet': {'shopMoney': {'amount': '30', 'currencyCode': 'USD'}}},
                 {'id': 'l2', 'title': 'Film', 'sku': 'SKU2', 'quantity': 1,
                  'currentQuantity': 1, 'discountedTotalSet': {'shopMoney': {'amount': '20', 'currencyCode': 'USD'}}},
             ]}}
    async def fake_query(*args, **kwargs):
        return {'orders': {'nodes': [order], 'pageInfo': {'hasNextPage': False}}}
    providers.shopify_query.side_effect = fake_query
    module.shipping_label_costs = AsyncMock(return_value={'#123': Decimal('6')})
    from datetime import datetime, timezone
    rows = await module.shopify_orders_with_expenses('test.myshopify.com', 'test-token',
                                                     datetime.now(timezone.utc))
    assert len(rows) == 2
    assert sum(x['fees'] for x in rows) == Decimal('2')
    assert sum(x['shipping_cost'] for x in rows) == Decimal('6')
    assert sum(x['shipping_revenue'] for x in rows) == Decimal('8')
    module.shipping_label_costs = AsyncMock(return_value={})
    unknown = await module.shopify_orders_with_expenses('test.myshopify.com', 'test-token',
                                                        datetime.now(timezone.utc))
    assert all(x['shipping_cost'] is None for x in unknown)


if __name__ == '__main__':
    test_fee_classification()
    test_shipping_label_coverage()
    asyncio.run(test_exact_allocation())
    print('PASS: fees, label coverage, and exact order allocation')
