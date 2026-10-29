# GoodWorld GA4 analytics and visitor consent

Last updated: 2026-10-30.

## Property

- GA4 web stream Measurement ID: `G-DRVQQFN3VD`.
- Site: `https://www.goodworld.news`.
- Tag: `analytics.js`, loaded on the main app, `privacy.html`, the generated `/stories/` archive, and every generated editorial article.
- Consent banner styles: `analytics.css`, matching Sunrise Garden.
- Browser local preference: `gw_analytics_consent_v1` = `accepted` or `declined`.
- Google Consent Mode v2 default: `analytics_storage=denied`, `ad_storage=denied`, `ad_user_data=denied`, `ad_personalization=denied`.
- Only the analytics storage category becomes granted after an explicit click on `Accept analytics`. All advertising categories remain denied. No Google Analytics tag is fetched before consent. Declining never loads it.
- Visitors may change the preference using the `Privacy choices` control, including on all article pages. Withdrawing consent stops future analytics events and reloads the site to unload the Google tag.

## Events

- `page_view`: first page visit after consent, plus SPA feed/donate/profile navigation. The page URL is sanitized, without auth query params or tokens.
- `read_article`: an indexed editorial article page was opened after consent. `content_id` is the public article slug only.
- `view_story`: a feed card is visible at least 65% for 1.2s after consent; recorded at most once per story per tab lifetime.
- `select_content`: tapped a full editorial article link from the feed.
- `like_story` or `unlike_story`: liked or unliked article successfully, only after server saved the action.
- `share`: native share, copied link, or open share link dialog, with public article slug and method.
- `donate_open`: opened the donation section; note that this is **not** a donation or conversion payment.
- `donation_network_selected`: changed the offered coin/network, network label only.
- `donation_address_copied`: copied a public receiving address, but only reports the network, **not the address**.

Google Analytics will receive data only from users who opt in. These are **not** total unique visitors, impressions or payments. For accurate count of all site requests, also use aggregated privacy-compliant server logs.

## Validation

1. In a fresh private browser session, open GoodWorld and verify **no** request to `googletagmanager.com/gtag/js` or `google-analytics.com/g/collect` before agreeing.
2. Click `Decline`: website remains usable and GA4 stays unloaded.
3. Reopen `Privacy choices` and click `Accept analytics`: a Google tag should load and initial `page_view` event should fire.
4. Scroll through stories; one `view_story` per visible story, then tap a Like/Repost or Donate.
5. Open a story HTML page and verify `read_article`.
6. In GA4 **Reports → Realtime** or **Admin → DebugView**, verify incoming events. Data can take some time to appear; ad blockers can suppress them.
7. Withdraw consent: analytics storage becomes denied and the page reloads without loading Google again.
8. In Render build logs verify generated article and archive pages include `analytics.js` and `analytics.css` references.

Privacy notice: `/privacy.html`. Google Search Console to GA4 linking remains a separate GA4 Admin action. Confirm privacy compliance and any required contractual disclosures before scaling to different regions.
