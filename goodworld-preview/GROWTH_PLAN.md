# GoodWorld: growth-first roadmap to 100,000 monthly users

Date: 2026-10-29
Domain: https://www.goodworld.news
Business model: free news feed and voluntary crypto contributions. No paywalls or paid PR.

## Success metrics
- North star: 100,000 monthly unique active readers (state explicitly whether unique people or browser visitors; count bots out).
- Supporting metrics: monthly organic search clicks, impressions, indexed quality pages, 7-day and 30-day returning readers, reposts per 1,000 views, press/blogger referral visits, email opt-in only if added with consent.
- Set up Google Search Console and privacy-respecting analytics. No claims about traffic or conversion until verified.

## Phase 1: search discoverability and editorial credibility

Completed in source code on 2026-10-29, pending deployment/HTTP verification:
- Real, per-story HTML pages for 23 editorially written GoodWorld briefs under /stories/<slug>.html.
- /stories/ archive with real crawlable internal links.
- New sitemap.xml with 25 canonical URLs, linked from robots.txt.
- News pages with unique titles, descriptions, canonical URLs, original copy, linked reporting source, and Article structured data.
- Share from the GoodWorld feed uses the permanent article URL for those 23 curated briefs.
- Homepage title, description and WebSite/Organization schema improved.
- No automated short RSS summaries were represented as independently reported long-form articles.

Next technical work:
1. Deploy latest branch to Render. Confirm every representative page returns HTTP 200, robots.txt and sitemap.xml are served with correct content-type and root domain redirects to www.
2. In Google Search Console add DOMAIN property goodworld.news; verify via Namecheap DNS TXT; submit https://www.goodworld.news/sitemap.xml.
3. Use URL Inspection on home, /stories/, and a sample story; check that Google sees rendered HTML and no robots/noindex issues.
4. Publish accurate About, Editorial Methodology, Corrections/Contact and Privacy pages; provide real operator/contact details before going to press.
5. SEO prerender builder is implemented and tested in `build-seo.mjs`: future editor-approved stories receive real HTML article pages and are added to the archive and sitemap at each Render build. Next: enable the build command in Render and schedule a daily secure deploy hook through Supabase Vault/Cron. Hourly short RSS auto-briefs remain feed-only for editorial integrity; see `SEO_AUTOMATION.md`.
6. Secure original photo usage rights; optimize mobile performance, contrast, image sizes and accessibility.
7. Editorial focus: write source-attributed, original context and follow-ups on nature recovery, animal rescues, generosity, community improvements and meaningful science. Do not scrape, spin or mass-produce thin pages to game ranking.
8. Consider Google News/Discover only after transparency, consistency, original value and web performance meet current public guidance.

## Phase 2: visual design

Candidate direction (recommended): "Sunrise Garden".
- Background #FFF9F0 warm ivory.
- Headline/text #234A40 evergreen.
- Surface #DDF0E4 calm mint.
- Warm accent #F7D77E sunshine.
- Secondary accent #F4A085 coral.
- Content contrast check: #234A40 on #FFF9F0 = approx 9.44:1, exceeding WCAG AA normal text.
- Alternate directions: "Clear Skies" (airy blue) and "Soft Bloom" (peach/lilac).
- Rework image cards to avoid dark gradients covering most of the screen; preserve legible headings, swipe interactions, fast loading, and clear source links.
- Test on mobile at multiple screen sizes and compare perceived positivity, retention and willingness to share before finalizing.

## Sunrise Garden implementation (source committed 2026-10-29)

- `sunrise.css` is a layered, reversible light-theme override loaded after `style.css`.
- `index.html` now links the light theme, uses a bright browser theme-color and matching SVG favicon.
- `article.css` shares the Sunrise Garden colors with the main mobile feed.
- The photograph remains bright in the upper area of full-height news cards; below it, title, short summary, attribution, and likes/repost controls sit on an ivory readable background.
- Responsive compact-screen treatment prevents images from dominating or reducing text legibility.
- Donate wallet QR, Profile, sign-in/recovery and private Editorial all retain working DOM IDs and page handlers; only CSS and harmless head metadata changed.
- Contrast checks on primary UI color pairs (before real-device tests): evergreen #234A40 on ivory #FFF9F0 9.44:1; paragraph #425F52 on ivory 6.71:1; white on #21654F primary button 6.91:1; tag #20634D on mint #DDF0E4 5.98:1. Small helper text darkened to meet a normal-text 4.5:1 target.
- All changes committed to GitHub; **production Render deployment, actual browser rendering and mobile QA remain to be verified**. Do not claim live until a newer successful deployment than the theme commits is confirmed.

## Phase 3: earned media and creators

- Story: an always-free destination for authentic good news, built as an antidote to the negative news cycle, with hourly source-linked updates. Describe verified product reality honestly, avoid claims about effects on mental health.
- Press kit: founder quote, 1-page brand mission, transparent methodology, 3 real stories, screenshots, logo, contact email, official domain and source/copyright credits.
- Prioritize reporters writing about startups, media innovation, community stories, digital wellbeing, climate optimism; newsletters and creators who curate uplifting factual stories. Avoid assuming direct competitor outlets will cover the project.
- Research named journalists and creators individually, verify current public contact and editorial fit, then send short personalized pitches. Reject all paid placements and sponsored PR.
- Measure referral traffic and earned mentions; prioritize genuine relationships over mass blast emails.

## Phase 4: audience compounding

- Distribution: easy shareable story links, clean previews and consistent short formats on social media.
- Brand community: optional weekly digest with explicit consent and reliable transactional email before collecting addresses.
- Partner with positive-news curators and appropriate communities for mutual editorial cross-reference, not link buying.
- Revisit engagement by source/topic, reduce duplicates, retain repeat visitors without addictive dark patterns.

## Reality checks
- SEO and indexed URLs do not guarantee rankings, Google News inclusion, or 100,000 users.
- Short summaries based on external publisher reporting have limited original search value: invest in real editorial context and transparent sourcing.
- No launch-date promises without a verified deployment and metrics baseline.
- Source: Google Search Central SEO Starter Guide, JavaScript SEO, Article structured data, helpful people-first content; W3C WCAG contrast accessibility.
