# GoodWorld production launch plan
Verified as of 2026-10-21. Source: behappyprep/Salesboard branch goodworld-preview.

## Current infrastructure
- Render static production service srv-dbbtbitpkucs73eel9u0 at https://goodworld-app.onrender.com.
- Supabase project jdmpmrhyjitmjyjuhtds (eu-central-1).
- Real news, login, likes, editorial and queued collection exist. Stripe billing, custom SMTP, referrals, legally reviewed policies and paid entitlement gating are not live.

## 1. Domain
- Preferred name: goodworld.news; backup goodworld.app. Availability, exact price, premium status and trademark collision must be checked at registrar checkout.
- Have the user buy domain in a registrar account under their control; enable auto-renew and use accurate business contact details.
- On Render Settings -> Custom Domains, add purchased apex domain; Render also supports www. See https://render.com/docs/custom-domains.
- Set Cloudflare DNS following https://render.com/docs/configure-cloudflare-dns, with root and www CNAME pointing to goodworld-app.onrender.com; remove conflicting AAAA records.
- In Cloudflare SSL/TLS set Full. Confirm Render domain verification, valid TLS, redirect to HTTPS and canonical www/apex.
- Keep the onrender.com hostname until all recovery/signup/payment callbacks work on new domain.

## 2. Auth and outbound email
- Update `GW_SITE` in app.js only after DNS and TLS are ready.
- Supabase Dashboard -> Authentication -> URL Configuration. Site URL and exact redirect allowlist for https://<domain>/?gw_reset=1 and https://<domain>/?gw_confirm=1.
- Configure custom SMTP sender (Resend or another vendor) and domain DNS SPF/DKIM/DMARC. Never paste SMTP credentials in code or commit them.
- Test signup, verification, reset link, expiry, invalid link, login/logout, editorial session, browser/device changes and email delivery.

## 3. $5/month product and 7-day access
- Connect the correct GoodWorld Stripe account, legal merchant entity and US$5 recurring price.
- Choose trial UX and whether to collect a card before or after the seven free days. User rule: access is paid-only after trial.
- Add Supabase Edge Functions for Stripe Checkout and Customer Portal with server-only keys and origin allowlist.
- Add signature-verified Stripe webhooks, event idempotency, subscriptions table and server-side entitlement enforcement.
- Test trial start/end, paid renewals, failed payment, cancellation/reactivation, refunds, account deletion and portal.
- Keep production paywall DISABLED until full testing and business registration decisions are complete.

## 4. Referrals
- Unique account referral URLs, attribution stored server-side.
- Three confirmed paying referrals => three months free for referrer, granted once per group; no self-referrals or trial-only signups.
- Define refund/fraud and cancellation handling before activation.

## 5. Editorial, quality, and compliance
- Manual factual verification of each story; licensed and attributed images. Editorial queue and 6-hour aggregator remain protected.
- Privacy Policy, Terms, subscription cancellation and refund notice, contact/seller info, tax/VAT compliance and GDPR.
- QA Android/iOS feed, share links, likes, Top Today/New, API and auth protection, site accessibility/performance/monitoring.

## Launch criterion
Domain purchased and verified; DNS, TLS, auth redirects, SMTP, payments, access gating and referrals all tested end to end. Do not call the product fully launched before then.