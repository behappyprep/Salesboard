"""Shopify Payments fees and Shopify Shipping label costs for ChannelPilot.

Imported by the ASGI entrypoint after shopify_server, preserving its OAuth and
webhook routes. No guessed fees, estimated postage, or customer data is stored.
"""
import os
from decimal import Decimal

import shopify_server
import main
import providers
from finance import dec
from providers import ProviderError

app = shopify_server.app

# read_reports is optional: enabling it requires a new released Shopify app
# version, protected-data approval and merchant reauthorization. Existing
# connections keep syncing orders and Shopify Payments fees without it.
if os.getenv('SHOPIFY_REQUEST_REPORTS', '').lower() == 'true':
    providers.SHOPIFY_SCOPES = ','.join(dict.fromkeys(
        providers.SHOPIFY_SCOPES.split(',') + ['read_reports']))
    shopify_server.SHOPIFY_SCOPES = providers.SHOPIFY_SCOPES

ZERO = Decimal('0')
FEE_ORDER_QUERY = providers.ORDERS_QUERY.replace(
    'lineItems(first: 100)',
    'transactions(first: 100) { id kind status gateway fees { id amount { amount currencyCode } } } '
    'lineItems(first: 100)', 1,
)
LABEL_QUERY = '''query Labels($q: String!) {
  shopifyqlQuery(query: $q) {
    tableData { rows }
    parseErrors
  }
}'''


def payment_fees(transactions, currency):
    """Return real Shopify Payments fees, or None if not reliably available.

    Authorizations and failed transactions do not represent settled charges.
    An empty fee list is *not* evidence that processing was free. Other payment
    gateways require their own API, so never silently treat their fees as zero.
    """
    if not isinstance(transactions, list) or not transactions or len(transactions) >= 100:
        return None
    relevant = [tx for tx in transactions if tx.get('status') == 'SUCCESS'
                and tx.get('kind') in ('SALE', 'CAPTURE', 'REFUND')]
    if not relevant:
        return None
    if any('shopify_payments' not in str(tx.get('gateway') or '').lower()
           for tx in relevant):
        return None
    values = []
    seen = set()
    for tx in relevant:
        for fee in tx.get('fees') or []:
            amount = fee.get('amount') or {}
            if amount.get('currencyCode') != currency or amount.get('amount') is None:
                return None
            fee_id = fee.get('id') or (tx.get('id'), len(values))
            if fee_id in seen:
                continue
            seen.add(fee_id)
            values.append(dec(amount['amount']))
    return sum(values, ZERO) if values else None


def parse_shipping_labels(payload):
    """Read order-level cost rows; missing label is unknown, not free shipping."""
    if not isinstance(payload, dict) or payload.get('parseErrors') or not isinstance(
            (payload.get('tableData') or {}).get('rows'), list):
        return {}
    records = payload['tableData']['rows']
    # An API result at the limit might be incomplete: do not allocate a partial bill.
    if len(records) >= 2000:
        return {}
    costs = {}
    for row in records:
        if not isinstance(row, dict):
            return {}
        order_name = row.get('order_name')
        raw = row.get('shipping_label_costs')
        if not isinstance(order_name, str) or raw is None:
            return {}
        try:
            value = dec(raw)
        except (TypeError, ValueError):
            return {}
        if value < ZERO:
            return {}
        costs[order_name] = costs.get(order_name, ZERO) + value
    return costs


async def shipping_label_costs(shop, token):
    """Only actual Shopify-purchased labels (requires read_reports + approval).

    ShopifyQL reports label spend in the store's currency. Its 60-day window
    matches the initial order-sync window; older costs already saved are kept.
    """
    try:
        payload = await providers.shopify_query(shop, token, LABEL_QUERY, {
            'q': ('FROM shipping_labels SHOW shipping_label_costs '
                  'GROUP BY order_name SINCE -60d LIMIT 2000')
        })
        return parse_shipping_labels(payload.get('shopifyqlQuery'))
    except ProviderError:
        # No read_reports or no Shopify Shipping labels: don't fail order sync.
        return {}


async def shopify_orders_with_expenses(shop, token, since):
    """Fetch orders once, with per-transaction fees and optional real label cost."""
    labels = await shipping_label_costs(shop, token)
    after = None
    result = []
    filt = 'updated_at:>=' + since.strftime('%Y-%m-%dT%H:%M:%SZ')
    for _ in range(40):
        page = (await providers.shopify_query(shop, token, FEE_ORDER_QUERY,
                                             {'after': after, 'filter': filt}))['orders']
        for order in page['nodes']:
            lines = order['lineItems']
            if lines['pageInfo']['hasNextPage']:
                raise ProviderError('Order has more than 100 items; not importing partial totals')
            items = lines['nodes']
            if not items:
                continue
            active = sum(1 for item in items if dec(item.get('currentQuantity')
                         if item.get('currentQuantity') is not None
                         else item.get('quantity', 0)) > ZERO)
            divisor = max(active, 1)
            shipping_revenue = dec(((order.get('totalShippingPriceSet') or {})
                                    .get('shopMoney') or {}).get('amount'))
            currency = order['currencyCode']
            fees = payment_fees(order.get('transactions'), currency)
            shipping_paid = labels.get(order['name'])
            canceled = bool(order.get('cancelledAt'))
            for item in items:
                qty = dec(item.get('currentQuantity') if item.get('currentQuantity') is not None
                          else item.get('quantity', 0))
                if qty < ZERO:
                    raise ProviderError('Shopify returned negative line-item quantity')
                original_qty = dec(item.get('quantity', 0))
                price = item['discountedTotalSet']['shopMoney']
                if price['currencyCode'] != currency:
                    raise ProviderError('Shopify order and item currencies differ')
                net_price = dec(price['amount']) * qty / original_qty if original_qty else ZERO
                is_active = qty > ZERO and not canceled
                result.append({
                    'provider': 'Shopify', 'external_account': shop,
                    'order_id': order['name'], 'line_id': item['id'],
                    'ordered_at': order['createdAt'], 'sku': item.get('sku') or '',
                    'product': item['title'], 'quantity': ZERO if canceled else qty,
                    'currency': currency,
                    'item_revenue': net_price if not canceled else ZERO,
                    'shipping_revenue': shipping_revenue / divisor if is_active else ZERO,
                    'item_refunds': ZERO, 'shipping_refunds': ZERO,
                    'fees': fees / divisor if fees is not None and is_active else None,
                    'shipping_cost': (shipping_paid / divisor
                                      if shipping_paid is not None and is_active else None),
                    'other_cost': ZERO,
                    'status': 'canceled' if canceled else 'refunded' if qty == ZERO else 'paid',
                })
        if not page['pageInfo']['hasNextPage']:
            return result
        after = page['pageInfo']['endCursor']
    raise ProviderError('Shopify sync exceeds 2,000 orders; narrow window or use bulk operations')


# Store known direct expenses during future incremental syncs if a provider
# temporarily stops returning them. Explicit new amounts always take priority.
_original_upsert_line = main.upsert_line


def upsert_line_preserving_expenses(db, user_id, record):
    if record.get('provider') == 'Shopify' and (record.get('fees') is None or
                                               record.get('shipping_cost') is None):
        from sqlalchemy import select
        from models import OrderLine
        old = db.scalar(select(OrderLine).where(
            OrderLine.user_id == user_id,
            OrderLine.provider == 'Shopify',
            OrderLine.external_account == record.get('external_account'),
            OrderLine.order_id == str(record.get('order_id')),
            OrderLine.line_id == str(record.get('line_id')),
        ))
        if old:
            record = dict(record)
            for field in ('fees', 'shipping_cost'):
                if record.get(field) is None and getattr(old, field) is not None:
                    record[field] = getattr(old, field)
    return _original_upsert_line(db, user_id, record)


main.shopify_orders = shopify_orders_with_expenses
main.upsert_line = upsert_line_preserving_expenses
