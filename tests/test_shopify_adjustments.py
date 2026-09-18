"""Regression cases for Shopify's canonical post-discount amounts and refunds."""
from decimal import Decimal

from shopify_adjustments_dashboard import allocate, refund_details


def line(order_id, line_id, amount, quantity=1):
    return {'provider': 'Shopify', 'order_id': order_id,
            'line_id': line_id, 'quantity': Decimal(quantity),
            'status': 'paid', 'item_revenue': Decimal(amount),
            'shipping_revenue': Decimal('0')}


def money(value):
    return {'shopMoney': {'amount': str(value), 'currencyCode': 'USD'}}


def test_order_3345_checkout_discount_is_applied_once():
    rows = [line('#3345', 'a', '560.10', 5)]
    allocate(Decimal('504.09'), rows, 'item_revenue')
    assert sum((row['item_revenue'] for row in rows), Decimal(0)) == Decimal('504.09')


def test_order_3352_fully_discounted_product_still_has_shipping_sales():
    rows = [line('#3352', 'b', '92.16')]
    allocate(Decimal('0'), rows, 'item_revenue')
    allocate(Decimal('21.37'), rows, 'shipping_revenue')
    assert rows[0]['item_revenue'] == Decimal('0')
    assert rows[0]['shipping_revenue'] == Decimal('21.37')


def test_multi_line_allocation_reconciles_exactly():
    rows = [line('order', 'a', '33.33'), line('order', 'b', '66.67')]
    allocate(Decimal('90.01'), rows, 'item_revenue')
    assert sum((row['item_revenue'] for row in rows), Decimal(0)) == Decimal('90.01')


def test_successful_refund_excludes_tax_and_tracks_shipping():
    refund = {'id': 'refund/123', 'processedAt': '2026-09-17T11:00:00Z',
        'transactions': {'pageInfo': {'hasNextPage': False}, 'nodes': [
            {'id': 'tx', 'kind': 'REFUND', 'status': 'SUCCESS',
             'amountSet': money('42.00')}]},
        'refundLineItems': {'pageInfo': {'hasNextPage': False}, 'nodes': [
            {'totalTaxSet': money('2.00')}]},
        'refundShippingLines': {'pageInfo': {'hasNextPage': False}, 'nodes': [
            {'subtotalAmountSet': money('5.00'), 'taxAmountSet': money('0.00')}]}}
    record = refund_details(refund, 'USD')
    assert record['amount'] == Decimal('40.00')
    assert record['shipping_amount'] == Decimal('5.00')


def test_failed_refund_is_not_counted():
    refund = {'id': 'refund/failed', 'processedAt': '2026-09-17T11:00:00Z',
        'transactions': {'pageInfo': {'hasNextPage': False}, 'nodes': [
            {'id': 'tx', 'kind': 'REFUND', 'status': 'FAILURE',
             'amountSet': money('42.00')}]},
        'refundLineItems': {'pageInfo': {'hasNextPage': False}, 'nodes': []},
        'refundShippingLines': {'pageInfo': {'hasNextPage': False}, 'nodes': []}}
    assert refund_details(refund, 'USD') is None
