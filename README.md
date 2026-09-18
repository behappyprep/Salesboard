# ChannelPilot — multichannel sales application (MVP)

A runnable multi-tenant web app, not a static mock-up. Supports business sign-up, encrypted OAuth credentials, role-isolated sales data, Shopify COGS imports, order sync for Shopify and Etsy, Faire brand OAuth and cautiously validated order sync, CSV imports for all five channels, profit completeness, currency conversion, responsive analytics.

## Run locally

```bash
cd channelpilot_app
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Paste generated key into APP_KEY in .env; do not commit .env
set -a; source .env; set +a
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Open http://127.0.0.1:8000 (set `APP_URL=http://127.0.0.1:8000` if you use that URL; your browser's origin must exactly match APP_URL).

## Connecting providers

**Shopify**: Register a public/standalone Shopify app with redirect URL `<APP_URL>/api/oauth/shopify/callback`, set client ID/secret. Grant `read_orders`, `read_products`, `read_inventory`. The merchant/staff member must have "View product costs" permission to retrieve `InventoryItem.unitCost`. New public apps use expiring offline access tokens; the adapter stores rotated refresh tokens and refreshes expiring access tokens. Standard order API permissions generally cover only 60 days; obtain `read_all_orders` approval for older history. No marketplace customer personally identifiable information is requested or stored.

**Etsy**: Register a Personal app (and request Commercial Access to serve larger numbers of independent merchants), configure `<APP_URL>/api/oauth/etsy/callback` in its allowed redirect URLs, set client keystring and shared secret. OAuth 2 PKCE uses `transactions_r`. Receipt financial fees and refunds remain unknown in this MVP unless imported via CSV.

**Faire**: Register an integration partner app and configure `<APP_URL>/api/oauth/faire/callback`; set application ID/secret. OAuth requests `READ_ORDERS` and `READ_BRAND`. Faire brand order sync parses `amount_minor`, cursor pagination and post-discount subtotal, but **has not been verified using a real authorized seller account**. Unexpected order structures fail visibly rather than fabricating results. Fees remain unknown; import a payout report to establish them. Faire is for brand/wholesale sales; Faire retailer purchasing accounts cannot use the brand API.

**Amazon and Michaels**: normalized CSV import only in this version; no automatic OAuth/sync. Amazon requires public SP-API developer/app approval and current Orders API adapter. Michaels differs between Marketplace and MakerPlace and requires its seller API documentation/permission. No misleading Connect buttons are displayed for these channels.

Set `ENABLE_SCHEDULER=true` for a development server process to sync every 30 minutes. **Production**: a job queue or dedicated single scheduler/worker is required, with distributed rate limits; do not set it on multiple web workers.

## CSV import

Download template from the Connections page. Column names:

`provider,external_account,order_id,line_id,ordered_at,sku,product,quantity,currency,item_revenue,shipping_revenue,item_refunds,shipping_refunds,fees,shipping_cost,other_cost,cogs_unit,cogs_currency`

A row represents one item line, not the whole order. `item_revenue` is post-discount item revenue before returns (exclude tax), shipping revenue is the seller-collected shipping allocation, refunds are separate positive deductions. `fees`, `shipping_cost` and `cogs_unit` must be left **blank** when not known. Zero means **confirmed zero**. Shopify will match SKUs and snapshot its stored unit cost at import time. `external_account` distinguishes multiple shops on the same platform; default is `csv`. CSV rows for the same provider+order ID are removed when a subsequent API sync imports that order, to limit cross-source duplication. Platform-specific CSV exports may require column mapping to this normalized template.

## Profit terminology

* `net_sales = discounted_items + seller_collected_shipping − item_refunds − shipping_refunds`, excludes sales tax.
* `gross_profit = net_sales − (quantity × Shopify unit COGS)`; displayed when COGS is known.
* `contribution = gross_profit − platform fees − seller-paid shipping/fulfillment − other line costs`.
* Profit is displayed **only for complete lines** with COGS, fees and shipping cost. It is not business-wide net income: overhead, marketing spend, subscriptions, wages, income tax and financing costs are not included.
* Shopify prices/costs are in its shop currency. COGS is a snapshot **at first import**, which is a current-cost estimate for historical orders, not verified historical FIFO/weighted-average valuation. Existing order snapshots aren't changed on later cost sync.
* FX rates are manually entered reference rates; no transaction-date FX or settlement reconciliation. Unsupported currencies are excluded and flagged, never summed across currencies.
* Shopify line-item current quantity is used to estimate refunded merchandise and the API's shop-currency discounted line total is adjusted proportionally. Shipping refunds and processing fees do not come from the Shopify order adapter; import them if available. Etsy receipt adapter likewise omits verified fee and shipping allocations until mapped.

## Security & production readiness

This is an implementation MVP, **not an audited SaaS**. Use HTTPS (`COOKIE_SECURE=true`), rotate/secure APP_KEY, password reset and email verification, migration tool, account deletion and data retention policies, webhook signature validation and incremental delta sync, background job queue, per-provider rate limiting, monitoring/backups, SOC2/privacy legal review as appropriate, and deployment secrets manager before onboarding paying customers. Passwords are Argon2id-hashed, API tokens Fernet-encrypted at rest, session tokens hashed in DB, CSRF+Origin checking for writes, OAuth state is one-time and expires in 10 minutes, and all data reads/writes are scoped to the signed-in account. Never paste marketplace passwords into this app.

## Render pilot deployment (new)

A `render.yaml` Blueprint provisions a **paid** Frankfurt-region Docker web service and a **paid** Frankfurt-region managed PostgreSQL database. Review pricing in Render before approving provisioning. The database's public IP allow list is empty; the web service reaches it privately. Render issues an `https://...onrender.com` URL on successful deployment. No live address exists until Render reports deployment success.

1. Put this package's *contents* at the root of a new **private** GitHub repository. Do not upload `.env`, actual credentials, exported customer orders, or SQLite files.
2. Connect your GitHub account to Render, then create a Render Blueprint based on that repository's root-level `render.yaml`. Review/approve the paid service and DB. The Blueprint creates an APP_KEY as a persistent secret. Never regenerate APP_KEY unless you plan to reauthorize connections.
3. In Render's web service, set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET (and optionally ETSY_CLIENT_ID / ETSY_CLIENT_SECRET, FAIRE_APP_ID / FAIRE_APP_SECRET) only after obtaining approved application credentials; never paste shop passwords.
4. Configure marketplace OAuth redirect URLs using the actual Render service hostname: `https://YOUR-SERVICE.onrender.com/api/oauth/{shopify|etsy|faire}/callback`. APP_URL is optional for the Render-provided hostname because the service uses `RENDER_EXTERNAL_URL`. If you move to a custom domain, set APP_URL explicitly to its HTTPS origin and update each OAuth redirect.
5. Check `https://YOUR-SERVICE.onrender.com/health`, register a **test account**, verify Shopify COGS permissions and each platform's real payout/fee reporting before sharing with customers. Amazon and Michaels are CSV-only until their API approvals/adapters exist.

This is an early pilot, **not ready for public/customer production onboarding** without independent security review, email verification/password reset, terms/privacy policies, automated backups/recovery drills, migrations, and more complete provider fee/refund reconciliation. One web worker + in-process sync is a pilot-only scheduling compromise, not a horizontally scalable queue.
