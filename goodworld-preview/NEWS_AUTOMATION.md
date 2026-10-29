# GoodWorld: hourly positive-news automation

Configured 2026-10-29 in Supabase project `jdmpmrhyjitmjyjuhtds`.

## Live schedule (UTC)

- **:05 every hour:** `goodworld-rss-discovery-hourly` calls the Supabase Edge Function `goodworld-news-collector` (version 3). The old six-hour Cron job was disabled.
- **:15 every hour:** `goodworld-hourly-positive-news` calls `goodworld_private.publish_hourly()`.
- The publisher runs once hourly (at :15 UTC), prefers strongly positive **genuinely recent** source stories, and accepts source publications up to six hours old to compensate for RSS delivery delays. It never claims a late story was published within the last hour.
- At most **one** qualified article is published for each UTC hour. The unique slot key makes retried invocations idempotent.
- If no sufficiently positive, still-unpublished source article appeared in that six-hour window, it **skips** publication rather than inventing a story or recycling older items.
- The frontend has the **New** tab selected by default; while a visitor is viewing the start of the feed, it checks for updates every 10 minutes and on tab visibility restoration. Changes need a Render deployment to become public.

## Sources (22 feed URLs)

The Edge Function currently scans established publisher RSS feeds, including Good News Network (general news and animals), Good Good Good, Positive News, Reasons to be Cheerful, The Optimist Daily, YES! Magazine, ScienceDaily, Phys.org, The Guardian (environment, science, development), NPR Science, Mongabay, Euronews Green, Smithsonian Magazine and Fix The News.

Configuration and exact feed addresses live in:
`supabase/functions/goodworld-news-collector/index.ts`.

Feeds are fetched in batches of five with individual 4.5-second network timeouts. Broken or unreachable feeds are recorded as source errors but do not halt collection of others. New candidates are inserted uniquely by their original source URL and must include a trustworthy publication timestamp.

## Scoring and safety

The automated publisher considers source articles that were originally released within the preceding six hours, preferring a stronger positive outcome and using the source timestamp as a freshness constraint. It does not use a news item older than six hours, and every published article keeps a source reference.
It favors clearly reported positive outcomes (rescues, conservation, donations, completed community improvements and similar events) and penalizes or excludes medical claims, tragedies, politics, speculative claims, clickbait and non-news headlines.
Attribution to the original reporting outlet and its original HTTPS source link are mandatory.
The public feed uses short, attributed RSS excerpts, not a copied full article, and the automated brief does not use unlicensed scraped photos. It is visibly labeled "Automatically curated."

**Limits:** scoring is deterministic, not a semantic AI investigation. It cannot guarantee discovery of every publisher in the world, independent verification of every article, or exactly 24 publications per day. Sources can be delayed, unavailable or publish no suitable material in a given hour. Manual editorial review should periodically audit outcomes; fix misclassifications before raising the hourly threshold.

## Data stores and security

- `public.goodworld_candidates`: unique discovered source URLs, source timestamps, editorial status.
- `public.goodworld_stories`: published source-linked GoodWorld briefs; auto-story slugs have prefix `auto-`.
- `public.goodworld_collection_runs`: hourly RSS collection stats, error counts.
- `public.goodworld_hourly_runs`: one status record per previous UTC hour, including skipped reason or published story and score.
- `goodworld_private.positive_score`: SQL scoring rules, not exposed to public roles.
- `goodworld_private.publish_hourly`: runs within Postgres Cron as the owning DB role, not exposed through public Data API.
- `public.claim_goodworld_collection_hourly` and `public.finish_goodworld_collection_hourly`: service-role-only RPCs.
- The RSS discovery Cron reads the existing project JWT from Supabase Vault. No service-role key or password is committed to GitHub.

Source code: `supabase/functions/goodworld-news-collector/index.ts`.
Database snapshot and job definitions: `supabase/migrations/20261029_goodworld_hourly_positive_news.sql`.

## Monitoring queries

```sql
-- Live Cron configuration
select jobname,schedule,active from cron.job where jobname like 'goodworld%' order by jobname;

-- Last 12 successful/failed HTTP scheduling calls
select j.jobname,r.start_time,r.status,r.return_message
from cron.job_run_details r join cron.job j using(jobid)
where j.jobname like 'goodworld%'
order by r.start_time desc limit 12;

-- RSS ingestion health
select slot,finished_at,added_count,error_count
from public.goodworld_collection_runs order by slot desc limit 24;

-- Editorial decision health
select slot,status,candidates_considered,score,source_url,reason
from public.goodworld_hourly_runs order by slot desc limit 24;

-- Real published output
select published_at,source_name,title,source_url
from public.goodworld_stories where slug like 'auto-%'
order by published_at desc limit 24;
```

## Testing done 2026-10-29

- The first expanded 11-source collector deployment was triggered and completed without errors, adding 18 candidates.
- The 22-source version 3 was deployed ACTIVE, but its next full source sweep was not yet observed at time of setup.
- SQL publication was tested inside a rolled-back transaction with a real existing Good News Network donation story. Title, attributed summary, linked source and story record were generated successfully; the test did not persist fake news.
- An actual subsequent hourly invocation intentionally skipped a weak previous-hour candidate. This is expected when no qualifying positive story appeared.
- Two UTC cron schedules are confirmed active; the old six-hour collection schedule has been unscheduled.
- Check the first scheduled 22-source collection and the first successful automated publication before relying on a 24/7 production SLA.

## 2026-10-29 freshness repair
- A screenshot of the live `New` tab showed only eight-day-old news because the first strictly hour-scoped publishing job had skipped every recent run.
- Root cause: positive material can arrive in RSS more than one hour after the publisher's original source timestamp. Narrow previous-hour filtering discards it forever.
- The live PostgreSQL function and versioned migration now accept a rolling six-hour freshness window while still publishing at most one story per UTC hour and avoiding duplicate sources.
- Following a rollback-protected test, the first genuinely sourced automatic brief was successfully published on 2026-10-29 from a same-day Good News Network article about students donating a refurbished car to a veteran; the brief was editorially rewritten for clarity and source attribution.
- Verified `get_goodworld_feed('new')` returns the new brief first; re-running the same UTC slot skipped without duplicating the article. The feed should update on refresh or its normal periodic polling.
- Monitor several subsequent hourly runs and available RSS sources before asserting an ongoing publication frequency or claiming it selects the world's absolute most positive story.
