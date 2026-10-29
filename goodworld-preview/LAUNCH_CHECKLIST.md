# GoodWorld: free, growth-first launch plan

Last updated 2026-10-29. GitHub `behappyprep/Salesboard`, branch `goodworld-preview`.

## Product decision
- Free positive news for everyone. No subscription, paywall, paid trial or paid referrals.
- Account is optional for reading; required for likes. Editorial remains restricted to approved editors.
- Target: grow towards 100,000 real users before revisiting monetization.
- Optional voluntary crypto support, no special benefits, no misleading charitable claims.
- Public donation destinations have been supplied by owner: BTC on Bitcoin, SOL and USDC (SPL) on Solana, and selected assets on supported EVM networks. Verify network/token before transfers. Never include seed phrase or private keys.
- Each story retains its own repost/share action within the feed. Separate site-wide Share GoodWorld and Submit a story pages were removed from the menu on 2026-10-29 to reduce clutter.

## Infrastructure
- Canonical domain: https://www.goodworld.news/ .
- Registrar DNS: Namecheap; root A @ = 216.24.57.1; www CNAME = goodworld-app.onrender.com.
- Render static site: srv-dbbtbitpkucs73eel9u0, repo path goodworld-preview/.
- Render screenshot 2026-10-29: both domains verified; SSL issued for www.goodworld.news; apex goodworld.news certificate pending; apex redirects to www.
- Supabase project: jdmpmrhyjitmjyjuhtds (Frankfurt, eu-central-1).
- Supabase URL Configuration screenshot 2026-10-29 shows Site URL https://www.goodworld.news and four allowlisted redirects: confirm/reset on www domain and original Render domain.
- Keep onrender.com fallback while auth on real domain is tested.

## Critical pre-launch checklist
1. Verify Render deployment of latest free interface commit on www.goodworld.news, both mobile and desktop; validate HTTPS and apex redirect, then retest after apex SSL issued.
2. Test Supabase Auth: normal signup -> email confirmation; sign in; password reset; refresh; cross-browser and sign out. URL allowlist already entered per owner's screenshot; do not alter without reason.
3. Connect custom transactional SMTP provider using validated GoodWorld sender subdomain and SPF/DKIM/DMARC to avoid default Supabase mail limits. Do not expose SMTP secrets in repo.
4. Crypto Donate configured in frontend with Bitcoin address `bc1qtswv69s6fqjcykgaj4jdyzz6nx4063c999lxg2`, Solana address `DVCbn4ziBFb98ECvCXiouRAeJqzxx6nrY5MZVXBs7tTc`, EVM address `0xf0DE078f2bB149a891e479E5e6e2A951F3B15E38`. Network/asset selector and QR generated locally via pinned qrcode-generator 1.4.4. Test network selection, QR scanning against address, clipboard fallback and small test donations before sharing widely.
5. Review actual rights to all third-party story photographs; replace unlicensed images; keep source attribution and factual editorial review.
6. Privacy Policy, Terms, voluntary crypto support disclosure and real business/operator contact before inviting public traffic. GDPR considerations and optional analytics consent if adding trackers.
7. Test story feed, editorial moderation, mobile swipe, links, repost, login-dependent likes, 00:00 UTC Top Today ranking, automatic RSS candidate collection.
8. Set up privacy-respecting analytics for daily users/retention and referral source so progress towards 100k can be measured responsibly.
9. Improve indexable story pages and social preview assets (the current story sharing uses URL hashes which limit per-story social previews).
10. Plan consistent content and social distribution, not automatic publishing of unverified scraped stories.

## Deferred
- Stripe subscriptions, pricing, trials and paid referral incentives are explicitly deferred. Do not enable payment gating or promise paid memberships until the owner changes this decision.

## Deployment note
- GitHub changes for Donate are committed. Render service advertises automatic deployment on commits, but the latest deploy visible through the Render connector still references 2026-10-21. Verify a new deploy actually reaches live before claiming GoodWorld has the updated Donate UI. If Render does not deploy commits, diagnose auto-deploy/webhook or manually deploy latest commit through Render dashboard.


## 2026-10-29: hourly positive-news automation now configured
- Live Supabase Cron collector `goodworld-rss-discovery-hourly`: minute 05 UTC of every hour. Existing six-hour schedule removed.
- Live Supabase Cron publisher `goodworld-hourly-positive-news`: minute 15 UTC of every hour, considering clearly positive source articles published during the preceding six hours (to allow for slow RSS delivery).
- Supabase collector Edge Function version 3 ACTIVE with 22 RSS feed URLs and concurrent collection.
- PostgreSQL `goodworld_private.positive_score` ranks clear positive outcomes and rejects high-risk, speculative and negative headlines. Strict at-most-one-per-hour publisher uses `public.goodworld_hourly_runs` to record skipped hours and actual publication.
- Success test: version 2 collected 18 new candidates from 11 feeds with no errors; version 3 deployment active but first complete 22-source run not observed yet.
- Full SQL publication transaction was tested using a genuine saved Good News Network story; test reverted. One real weak hour was correctly skipped.
- Security checks: anonymous and authenticated users cannot execute the hourly scheduler RPCs or access the private schema; log table RLS enabled.
- The GitHub version of the UI defaults to New, labels auto-curated sourced briefs, uses a designed fallback if no licensed photo, and polls only occasionally while viewing the top of the feed. It requires latest Render deployment before these UI changes are visible.
- For source configurations, scoring policy, monitoring SQL, and known limitations, see `NEWS_AUTOMATION.md`. Never claim exhaustive worldwide coverage or exactly one article every hour regardless of quality.

- 2026-10-29 late update: Screenshot showed the New feed still 8 days old. Fixed missing fresh content by expanding publisher freshness window to six hours; one verified Good News Network brief was published on GoodWorld and confirmed first in the New RPC. See NEWS_AUTOMATION.md.
