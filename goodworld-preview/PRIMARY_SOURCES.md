# GoodWorld Primary Sources: rights-aware news pipeline
Updated and deployed 2026-10-30.

## Live architecture

- **The old syndication pipeline stays disabled.** Cron job IDs 2 and 3 are inactive; the old `goodworld-news-collector` version 5 has zero feeds and `goodworld_private.publish_hourly` returns disabled.
- **The new collector** is Supabase Edge Function `goodworld-primary-collector`, authenticated with JWT and writing only through its private service-role client. Only eight whitelisted *official government* feeds can be fetched. Three official organizations: NASA, NOAA and GOV.UK departments.
- **Verified feeds**: `nasa-news`, `nasa-tech`, `nasa-station`, `nasa-voyager`, `noaa-news`, `uk-defra`, `uk-natural-england`, `uk-science`. All are HTTPS and were tested via SQL outbound HTTP, returning HTTP 200 and RSS/Atom XML.
- **Source license registry** `goodworld_primary_sources` requires approved host, article pathname, explicit license ID, license URL, source credit and enabled flag. RSS fetch cannot dynamically follow an unapproved host's links.
- **Private queue** `goodworld_primary_candidates` stores only short official government headlines/excerpts, no images, no full articles. Collects only articles up to 120 hours old, rejects external hosts and third-party copyright disclaimers.
- **Publication** `goodworld_private.publish_primary_hourly()` only releases one item per slot if the strict completed-positive-result and sensitive-content filters pass and no identical source URL already exists in the public feed. It records a link in `goodworld_primary_story_licenses` giving the official source, original timestamp, license, credit and the content type. It does not republish photographs. Its auto briefs are `gov-` slugs, clearly labeled *Official source · licensed brief*, and intentionally excluded from Google article SEO pages.
- **Original reporting**: new independently written, source-linked GoodWorld editorial stories (`nasa-station-new-solar-array-2026`, `nasa-voyager-power-saved-2026`, `noaa-chesapeake-oyster-reef-2026`) were published using facts checked directly on NASA/NOAA official pages. They have explicit `original_editorial` provenance and get their own crawlable HTML, archive link and Sitemap entry on Render builds.
- **Cron jobs**: `goodworld-primary-collector-hourly` runs at minute :05 UTC (id 5); `goodworld-primary-publish-hourly` at :15 UTC (id 6). Separate daily SEO build remains at 03:30 UTC (id 4).
- **Quality**: Some hours will be skipped if no source-confirmed positive completed outcome is available. Never fabricate news or promise one item for each hour. This automated system uses rule-based evaluation, **not AI fact-checking or original AI writing**. Officially licensed auto briefs should not be presented as GoodWorld independent investigative reporting.

## Verified reuse policies

- NASA government information and media guidelines: https://www.nasa.gov/nasa-brand-center/images-and-media/ . Agency-made content ordinarily U.S. public domain; exclude third-party protected media and do not imply NASA affiliation or endorsement.
- NOAA public-domain information: https://oceanservice.noaa.gov/about/faq.html . Agency-produced articles generally reusable with credit, do not misrepresent as official or endorsed.
- UK government content: https://www.gov.uk/help/reuse-govuk-content and https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ . Government-owned content subject to OGL; provide correct credit and indicate adaptations, separately clear third-party content.
- Optional future EC sources are **not enabled** until a specific verified owned-content feed and any article-level exceptions have been examined. Policy: https://digital-strategy.ec.europa.eu/en/pages/legal-notice .
- This is a conservative publishing workflow, not a legal certification or universal rights clearance. Treat each downstream content item as subject to attribution requirements and possible third-party exceptions.

## Initial live validation (2026-10-30)

First Edge run: 4 allowed feeds; 50 items inspected, 4 candidates added, no errors.
Second run after expanding whitelist: 8 allowed feeds; 110 items inspected, 7 new candidates added, no errors. Total 11 candidate records after both runs.
The database publisher was tested inside a rolled-back transaction; after tightening quality screening, none of those eleven candidates was automatically published because the strongest actual outcomes had already been independently written and published. This is **expected and safe**, and is not evidence of a broken collector.

## Operational notes

1. Cron publishing logs: `select * from public.goodworld_primary_publish_logs order by slot desc limit 10`.
2. Collection logs: `select * from public.goodworld_primary_collection_logs order by id desc limit 10`.
3. Candidate queue: `select source_key,title,source_published_at,status from public.goodworld_primary_candidates order by source_published_at desc limit 50`.
4. Check article source URLs / credits before writing any new manual editorial material.
5. Separate automatic licensed government briefs (`gov-*`) from original SEO stories. Never allow external legacy publishers back without documented rights.
