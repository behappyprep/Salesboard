"""Dependency-isolated regression test for Shopify backfill entrypoint."""
import asyncio
import importlib.util
import os
import sys
import types
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock

main = types.ModuleType('main')
main.sync_one = AsyncMock(return_value={'synced': 62})
expense = types.ModuleType('shopify_expenses')
expense.app = object()
expense.shipping_label_costs = AsyncMock(return_value={'#100': 5})
sys.modules.update(main=main, shopify_expenses=expense)
os.environ.pop('SHOPIFY_REQUEST_REPORTS', None)
source = Path(__file__).resolve().parents[1] / 'shopify_backfill.py'
spec = importlib.util.spec_from_file_location('shopify_backfill', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

async def check():
    assert await expense.shipping_label_costs('some.myshopify.com', 'secret') == {}
    shop = types.SimpleNamespace(provider='Shopify', user_id=1,
        external_id='some.myshopify.com', last_sync=datetime.now(timezone.utc))
    await main.sync_one(object(), shop)
    assert shop.last_sync is None
    shop.last_sync = datetime.now(timezone.utc)
    await main.sync_one(object(), shop)
    assert shop.last_sync is not None
    assert module._original_sync_one.await_count == 2
    etsy = types.SimpleNamespace(provider='Etsy', user_id=1,
        external_id='etsy', last_sync=datetime.now(timezone.utc))
    await main.sync_one(object(), etsy)
    assert etsy.last_sync is not None
    print('PASS: backfill once, incremental thereafter, no ShopifyQL without read_reports')

if __name__ == '__main__':
    asyncio.run(check())
