# GoodWorld: hourly positive-news automation

Configured 2026-10-29 in Supabase project `jdmpmrhyjitmjyjuhtds`.

## Live schedule (UTC)

- **:05 every hour:** `goodworld-rss-discovery-hourly` calls the Supabase Edge Function `goodworld-news-collector` (version 3). The old six-hour Cron job was disabled.
- **:15 every hour:** `goodworld-hourly-positive-news` calls `goodworld_private.publish_hourly()`.
- The publisher evaluates the **previous completed UTC hour** only, e.g. publication at 15:15 UTC considers news published from 14:00 to 14:59:59 UTC.
- At most **one** qualified article is published for each UTC hour. The unique slot key makes retried invocations idempotent.
- If no sufficiently positive source article appeared during that hour, it **skips** publication rather than inventing a story or quietly publishing an older item.
- The frontend has the **New** tab selected by default; while a visitor is viewing the start of the feed, it checks for updates every 10 minutes and on tab visibility restoration. Changes need a Render deployment to become public.

## Sources (22 feed URLs)

The Edge Function currently scans established publisher RSS feeds, including Good News Network (general news and animals), Good Good Good, Positive News, Reasons to be Cheerful, The Optimist Daily, YES! Magazine, ScienceDaily, Phys.org, The Guardian (environment, science, development), NPR Science, Mongabay, Euronews Green, Smithsonian Magazine and Fix The News.

Configuration and exact feed addresses live in:
`supabase/functions/goodworld-news-collector/index.ts`.

Feeds are fetched in batches of five with individual 4.5-second network timeouts. Broken or unreachable feeds are recorded as source errors but do not halt collection of others. New candidates are inserted uniquely by their original source URL and must include a trustworthy publication timestamp.

## Scoring and safety

The automated publisher only considers still-unpublished candidates first released in the completed hour.
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
