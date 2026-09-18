"""One-time Shopify fee backfill and permissions-aware shipping report gate.

The initial installation may have already fetched sales before transaction fees
were supported. Reconcile the most recent Shopify-authorized 59 days once per
workspace and process, then return to incremental syncs. Replaying is safe
because order-line identities are upserted rather than duplicated.
"""
import os

import main
import shopify_expenses

app = shopify_expenses.app

# Do not send unauthorised ShopifyQL requests for stores using the standard
# read_orders/read_products/read_inventory permission set.
if os.getenv('SHOPIFY_REQUEST_REPORTS', '').lower() != 'true':
    async def shipping_labels_unavailable(shop, token):
        return {}
    shopify_expenses.shipping_label_costs = shipping_labels_unavailable

_original_sync_one = main.sync_one
_attempted = set()


async def sync_one_with_fee_backfill(db, connection):
    if connection.provider != 'Shopify':
        return await _original_sync_one(db, connection)
    key = (connection.user_id, connection.external_id)
    if key in _attempted or connection.last_sync is None:
        result = await _original_sync_one(db, connection)
        _attempted.add(key)
        return result
    previous_sync = connection.last_sync
    # main.sync_one uses a 59-day window when last_sync is None.
    connection.last_sync = None
    try:
        result = await _original_sync_one(db, connection)
    except Exception:
        connection.last_sync = previous_sync
        raise
    _attempted.add(key)
    return result


main.sync_one = sync_one_with_fee_backfill
