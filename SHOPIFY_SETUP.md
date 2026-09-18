# Shopify connector setup for ChannelPilot

ChannelPilot is a standalone, non-embedded Shopify app. Each merchant enters the permanent `your-store.myshopify.com` domain in Connections and authorizes Shopify through OAuth. Never ask for store passwords or Admin API access tokens.

## Required connection

1. Create the ChannelPilot app in the [Shopify Dev Dashboard](https://dev.shopify.com/dashboard). Public distribution requires Shopify app review; use an authorized development store for testing.
2. App URL: `https://channelpilot-web.onrender.com`; redirect URL: `https://channelpilot-web.onrender.com/api/oauth/shopify/callback`; Embedded: **off**.
3. Release a Shopify app version with scopes `read_orders,read_products,read_inventory`. `read_orders` normally covers only the previous 60 days; separately approved `read_all_orders` is needed for older order history. Complete the applicable protected customer data requirements.
4. Configure compliance webhooks `customers/data_request`, `customers/redact`, `shop/redact` and uninstall webhook `app/uninstalled` at `https://channelpilot-web.onrender.com/api/webhooks/shopify`.
5. In Render's `channelpilot-web` Environment, set `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` as secret environment variables. Do not add them to GitHub or chat. Keep `APP_KEY` unchanged.
6. Log in to ChannelPilot → Connections → Shopify → enter the `.myshopify.com` domain → Connect → approve access → Sync. The app encrypts the OAuth token and syncs orders and current Shopify product unit costs automatically. Subsequent syncs are scheduled.

## What gets imported automatically

- **Sales and current COGS:** Order lines and Shopify variant `InventoryItem.unitCost` matched to SKUs. Today's cost is only an *estimate* for historical sales, not historical inventory valuation.
- **Shopify Payments transaction fees:** The app requests Shopify's actual `OrderTransaction.fees`, available using `read_orders`, and allocates verified fee totals once across the active order lines. Pending/empty fee lists, third-party payment gateways, or mismatched fee currencies remain **unknown**, not zero. Shopify Payments may post fees after an initial order sync; sync again later.
- **Shopify Shipping label costs (optional):** ShopifyQL `shipping_labels` reports can return actual label spend by order name. This requires a *separately approved* `read_reports` scope and ShopifyQL Level 2 protected customer data access. First release a new Shopify app version including `read_reports`, then set `SHOPIFY_REQUEST_REPORTS=true` in Render Environment, deploy, and have each merchant reconnect Shopify so the new scope is granted. The app attempts label reporting on every sync; without access it safely leaves shipping expense unknown. Only labels actually purchased through Shopify can be retrieved this way. Labels purchased from DHL, Slovenská pošta, Shippo, or another external carrier system require an integration with that provider or a cost import. Customer-paid shipping is revenue, **not** merchant shipping expense.

Profit is contribution after *known direct costs*, not accounting net income. Do not present an incomplete contribution total as full net profit. Fees for payment gateways other than Shopify Payments and third-party postage cannot be inferred from Shopify orders. The free Render PostgreSQL pilot expires and must be upgraded/backed up before storing paying customers' data.
