"""Synthetic examples only: no customer or merchant transaction data."""
from decimal import Decimal

from shopify_currency import order_currency_info, ORDER_QUERY
from shopify_reconciliation import fee_breakdown


def test_shopify_processing_and_foreign_exchange_fees_are_separate():
    transaction = {
        'id': 'synthetic-transaction', 'kind': 'SALE', 'status': 'SUCCESS',
        'gateway': 'shopify_payments', 'settlementCurrency': 'USD',
        'settlementCurrencyRate': '0.01',
        'fees': [
            {'id': 'synthetic-processing', 'type': 'processing_fee',
             'amount': {'amount': '290', 'currencyCode': 'SEK'}},
            {'id': 'synthetic-fx', 'type': 'foreign_exchange_fee',
             'amount': {'amount': '150', 'currencyCode': 'SEK'}},
        ],
    }
    result = fee_breakdown([transaction], 'USD')
    assert result['payments'] == Decimal('2.90')
    assert result['conversion'] == Decimal('1.50')
    assert result['total'] == Decimal('4.40')
    assert Decimal('100.00') - result['total'] == Decimal('95.60')


def test_store_original_currency_and_transaction_rate_are_retained():
    order = {
        'currencyCode': 'USD',
        'totalPriceSet': {
            'shopMoney': {'amount': '100.00', 'currencyCode': 'USD'},
            'presentmentMoney': {'amount': '10000', 'currencyCode': 'SEK'},
        },
        'transactions': [{
            'status': 'SUCCESS', 'kind': 'SALE',
            'settlementCurrency': 'USD', 'settlementCurrencyRate': '0.01',
            'amountSet': {'presentmentMoney': {'amount': '10000', 'currencyCode': 'SEK'}},
        }],
    }
    info = order_currency_info(order)
    assert info['customer_currency'] == 'SEK'
    assert info['customer_total'] == Decimal('10000')
    assert info['shop_currency'] == 'USD'
    assert info['shop_total'] == Decimal('100.00')
    assert info['conversion_rate'] == Decimal('0.01')
    assert 'totalPriceSet' in ORDER_QUERY and 'settlementCurrencyRate' in ORDER_QUERY


def test_distinct_capture_rates_do_not_become_a_fictitious_order_rate():
    order = {
        'currencyCode': 'USD',
        'totalPriceSet': {
            'shopMoney': {'amount': '100.00', 'currencyCode': 'USD'},
            'presentmentMoney': {'amount': '10000', 'currencyCode': 'SEK'},
        },
        'transactions': [
            {'status': 'SUCCESS', 'kind': 'CAPTURE', 'settlementCurrency': 'USD',
             'settlementCurrencyRate': '0.01',
             'amountSet': {'presentmentMoney': {'amount': '5000', 'currencyCode': 'SEK'}}},
            {'status': 'SUCCESS', 'kind': 'CAPTURE', 'settlementCurrency': 'USD',
             'settlementCurrencyRate': '0.011',
             'amountSet': {'presentmentMoney': {'amount': '5000', 'currencyCode': 'SEK'}}},
        ],
    }
    assert order_currency_info(order)['conversion_rate'] is None
